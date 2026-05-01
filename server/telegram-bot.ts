import { getCredentialsOverride } from "./credentials-store";
import { getAppConfig } from "./app-config";
import { accountManager } from "./accounts";
import { subscriptionPlans } from "./plans";
import { storage } from "./storage";
import { sendAccountEmail } from "./email";

// ─── Telegram API helpers ─────────────────────────────────────────────────

function getConfig() {
  const o = getCredentialsOverride();
  const botToken = o.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId   = o.telegramChatId   || process.env.TELEGRAM_CHAT_ID   || "";
  return { botToken, chatId, ok: !!(botToken && chatId) };
}

function getStoreUrl(): string {
  const { customDomain } = getAppConfig();
  if (customDomain) return customDomain.startsWith("http") ? customDomain : `https://${customDomain}`;
  const replDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG;
  if (replDomain) return `https://${replDomain}`;
  return "";
}

async function tgApi(botToken: string, method: string, body: object) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<any>;
}

async function sendMsg(chatId: string, botToken: string, text: string, extra: object = {}) {
  await tgApi(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  }).catch(() => {});
}

// ─── Conversation state (per user) ───────────────────────────────────────

type AdminStep =
  | { type: "idle" }
  | { type: "add_pick_plan" }
  | { type: "add_creds";  planId: string; planName: string }
  | { type: "add_slots";  planId: string; planName: string; email: string; password: string };

type UserStep =
  | { type: "idle" }
  | { type: "buy_pick_plan" }
  | { type: "orders_email" };

const adminState: { step: AdminStep } = { step: { type: "idle" } };
const userStates = new Map<string, UserStep>();

function getUserState(chatId: string): UserStep {
  return userStates.get(chatId) ?? { type: "idle" };
}
function setUserState(chatId: string, s: UserStep) {
  userStates.set(chatId, s);
}

// ─── Plan helpers ─────────────────────────────────────────────────────────

function getInStockPlans() {
  const plans: { id: string; name: string; price: number; duration: string; category: string }[] = [];
  for (const [, cat] of Object.entries(subscriptionPlans)) {
    const c = cat as any;
    for (const [, plan] of Object.entries(c.plans || {})) {
      const p = plan as any;
      if (p.inStock) plans.push({ id: p.planId, name: p.name, price: p.price, duration: p.duration, category: c.category });
    }
  }
  return plans;
}

function getAllPlans() {
  const plans: { id: string; name: string; price: number; duration: string; category: string }[] = [];
  for (const [, cat] of Object.entries(subscriptionPlans)) {
    const c = cat as any;
    for (const [, plan] of Object.entries(c.plans || {})) {
      const p = plan as any;
      plans.push({ id: p.planId, name: p.name, price: p.price, duration: p.duration, category: c.category });
    }
  }
  return plans;
}

function findPlan(query: string, plans = getAllPlans()) {
  const q = query.toLowerCase().trim();
  return plans.find(p => p.id.toLowerCase() === q || p.name.toLowerCase().includes(q));
}

function stockBar(avail: number, total: number) {
  if (!total) return "";
  const filled = Math.round((avail / total) * 5);
  return "█".repeat(filled) + "░".repeat(5 - filled);
}

// ─── Account linking helpers ──────────────────────────────────────────────

function getTgCustomerId(chatId: string): string | null {
  const { dbSettingsGet } = require("./storage") as typeof import("./storage");
  return dbSettingsGet(`tg_chatid_${chatId}`) || null;
}

async function handleLink(chatId: string, token: string, text: string) {
  const { dbSettingsGet, dbSettingsSet } = await import("./storage");
  const parts = text.trim().split(/\s+/);
  const code = parts[1]?.trim();

  if (!code || !/^\d{6}$/.test(code)) {
    await sendMsg(chatId, token,
      `🔗 <b>Link your Chege Tech account</b>\n\n` +
      `1. Open the store in your browser\n` +
      `2. Go to Dashboard → Profile tab\n` +
      `3. Click <b>Connect Telegram</b> to get your 6-digit code\n` +
      `4. Send: <code>/link 123456</code> (replace with your code)\n\n` +
      `Code expires after 10 minutes.`
    );
    return;
  }

  const customerId = dbSettingsGet(`tg_link_${code}`);
  if (!customerId || customerId === "used" || customerId === "") {
    await sendMsg(chatId, token, `❌ Invalid or expired code. Generate a new one from Dashboard → Profile.`);
    return;
  }

  dbSettingsSet(`tg_link_${code}`, "used");
  dbSettingsSet(`tg_chatid_${chatId}`, customerId);
  dbSettingsSet(`tg_customer_${customerId}`, chatId);

  const customer = await storage.getCustomerById(parseInt(customerId)).catch(() => null);
  await sendMsg(chatId, token,
    `✅ <b>Account linked!</b>\n\n` +
    `Welcome, <b>${customer?.name || customer?.email || "friend"}</b>!\n\n` +
    `You can now use:\n` +
    `/balance — Check wallet balance\n` +
    `/myorders — View your orders\n` +
    `/me — Your account info`
  );
}

async function handleBalance(chatId: string, token: string) {
  const customerId = getTgCustomerId(chatId);
  if (!customerId) {
    await sendMsg(chatId, token,
      `🔒 Your Telegram is not linked yet.\n\nSend /link to connect your Chege Tech account.`
    );
    return;
  }
  try {
    const wallet = await storage.getWallet(parseInt(customerId));
    const balance = wallet?.balance ?? 0;
    await sendMsg(chatId, token,
      `💰 <b>Wallet Balance</b>\n\n` +
      `<b>KES ${balance.toLocaleString()}</b>\n\n` +
      `Top up via the store: ${getStoreUrl()}`
    );
  } catch {
    await sendMsg(chatId, token, `❌ Could not fetch balance. Try again later.`);
  }
}

async function handleMe(chatId: string, token: string) {
  const customerId = getTgCustomerId(chatId);
  if (!customerId) {
    await sendMsg(chatId, token,
      `🔒 Your Telegram is not linked yet.\n\nSend /link to connect your Chege Tech account.`
    );
    return;
  }
  try {
    const customer = await storage.getCustomerById(parseInt(customerId));
    if (!customer) { await sendMsg(chatId, token, "❌ Account not found."); return; }
    const wallet = await storage.getWallet(parseInt(customerId));
    const txs = await storage.getTransactionsByEmail(customer.email);
    const orders = txs.filter((t: any) => t.status === "success");
    await sendMsg(chatId, token,
      `👤 <b>Your Account</b>\n\n` +
      `Name: ${customer.name || "Not set"}\n` +
      `Email: ${customer.email}\n` +
      `Wallet: KES ${(wallet?.balance ?? 0).toLocaleString()}\n` +
      `Orders: ${orders.length} completed\n` +
      `2FA: ${customer.totpEnabled ? "✅ Enabled" : "❌ Disabled"}\n\n` +
      `Visit the store: ${getStoreUrl()}`
    );
  } catch {
    await sendMsg(chatId, token, `❌ Could not fetch account info.`);
  }
}

// ─── USER commands (open to everyone) ────────────────────────────────────

let _tgRansomUrl: string | null = null;
let _tgRansomFetchedAt = 0;

async function getTgRansomUrl(): Promise<string | null> {
  const now = Date.now();
  if (_tgRansomUrl && now - _tgRansomFetchedAt < 45 * 60 * 1000) return _tgRansomUrl;
  try {
    const res = await fetch("https://api.deezer.com/search?q=ransom%20lil%20tecca&limit=1");
    const json: any = await res.json();
    const preview: string | undefined = json?.data?.[0]?.preview;
    if (preview) {
      _tgRansomUrl = preview;
      _tgRansomFetchedAt = now;
      console.log("[TG] Refreshed Ransom preview URL from Deezer");
      return preview;
    }
  } catch (err: any) {
    console.error("[TG] Deezer fetch error:", err?.message);
  }
  return null;
}

async function sendTgAudio(chatId: string, token: string, audioUrl: string, caption: string) {
  try {
    await tgApi(token, "sendVoice", {
      chat_id: chatId,
      voice: audioUrl,
      caption,
      parse_mode: "HTML",
    });
  } catch {
    try {
      await tgApi(token, "sendAudio", {
        chat_id: chatId,
        audio: audioUrl,
        caption,
        parse_mode: "HTML",
        performer: "Lil Tecca",
        title: "Ransom",
      });
    } catch {
      await sendMsg(chatId, token, caption);
    }
  }
}

async function sendMenuJingle(chatId: string, token: string) {
  const { whatsappChannel } = getAppConfig();
  const audioUrl = await getTgRansomUrl();
  const caption =
    `🎵 <b>This is CHEGE TECH INCOPORATIVE</b>\n` +
    `🎶 <i>Ransom — Lil Tecca</i>` +
    (whatsappChannel ? `\n\n📣 <b>Join our WhatsApp Channel:</b>\n${whatsappChannel}` : "");
  if (audioUrl) {
    await sendTgAudio(chatId, token, audioUrl, caption);
  } else if (whatsappChannel) {
    await sendMsg(chatId, token, `📣 <b>Join our WhatsApp Channel:</b>\n${whatsappChannel}`);
  }
}

async function handleUserStart(chatId: string, token: string) {
  const { siteName } = getAppConfig();
  const isLinked = !!getTgCustomerId(chatId);
  setUserState(chatId, { type: "idle" });
  await sendMsg(chatId, token,
    `👋 Welcome to <b>${siteName}</b>!\n\n` +
    `We sell premium shared subscription accounts at great prices.\n\n` +
    `<b>Shopping:</b>\n` +
    `/buy — Browse plans and purchase\n` +
    `/myorders — Check your order status\n\n` +
    `<b>Your Account:</b>\n` +
    (isLinked
      ? `/balance — Wallet balance\n/me — Account info\n`
      : `/link — Connect your store account\n`) +
    `\n/help — Show this menu`
  );
  await sendMenuJingle(chatId, token);
}

async function handleBuy(chatId: string, token: string) {
  const plans = getInStockPlans();

  if (!plans.length) {
    await sendMsg(chatId, token,
      `😔 <b>No plans in stock right now.</b>\n\n` +
      `Check back soon or contact support.`
    );
    return;
  }

  const lines = [`🛒 <b>Available Plans</b>\n`];
  plans.forEach((p, i) => {
    lines.push(`${i + 1}. <b>${p.name}</b> — KES ${p.price.toLocaleString()} / ${p.duration}`);
  });
  lines.push(`\nReply with a number to get the payment link.`);

  setUserState(chatId, { type: "buy_pick_plan" });
  await sendMsg(chatId, token, lines.join("\n"));
}

async function handleBuyPickPlan(chatId: string, token: string, text: string) {
  const plans = getInStockPlans();
  const idx = parseInt(text);
  let plan = null;

  if (!isNaN(idx) && idx >= 1 && idx <= plans.length) {
    plan = plans[idx - 1];
  } else {
    plan = findPlan(text, plans);
  }

  if (!plan) {
    await sendMsg(chatId, token,
      `❌ Plan not found. Reply with a number from the list, or type /buy to see the list again.`
    );
    return;
  }

  setUserState(chatId, { type: "idle" });

  const storeUrl = getStoreUrl();
  const { siteName, supportEmail, whatsappNumber } = getAppConfig();
  const info = accountManager.getStockInfo(plan.id);

  if (info.available === 0) {
    await sendMsg(chatId, token,
      `😔 <b>${plan.name}</b> just ran out of stock!\n\n` +
      `Type /buy to see other available plans.`
    );
    return;
  }

  const lines = [
    `✅ <b>${plan.name}</b>`,
    `💰 Price: KES ${plan.price.toLocaleString()}`,
    `⏰ Duration: ${plan.duration}`,
    `📊 Slots available: ${info.available}`,
    ``,
  ];

  if (storeUrl) {
    lines.push(`🛒 <b>Buy now:</b>`);
    lines.push(`${storeUrl}`);
    lines.push(``);
    lines.push(`👉 Visit the link, pick <b>${plan.name}</b>, and pay with M-Pesa or card.`);
    lines.push(`📩 Credentials will be sent to your email instantly after payment.`);
  } else {
    lines.push(`To purchase, contact us:`);
    if (whatsappNumber) lines.push(`📱 WhatsApp: ${whatsappNumber}`);
    if (supportEmail) lines.push(`📧 Email: ${supportEmail}`);
  }

  await sendMsg(chatId, token, lines.join("\n"));
}

async function handleMyOrders(chatId: string, token: string) {
  setUserState(chatId, { type: "orders_email" });
  await sendMsg(chatId, token,
    `📧 Enter the email address you used when purchasing:`
  );
}

async function handleOrdersEmail(chatId: string, token: string, text: string) {
  const email = text.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await sendMsg(chatId, token, `❌ That doesn't look like a valid email. Try again:`);
    return;
  }

  setUserState(chatId, { type: "idle" });

  try {
    const txs = await storage.getTransactionsByEmail(email);
    const done = txs.filter((t: any) => t.status === "success");

    if (!done.length) {
      await sendMsg(chatId, token,
        `😔 No completed orders found for <code>${email}</code>.\n\n` +
        `Make sure you used the same email when purchasing.\n` +
        `Type /buy to place an order.`
      );
      return;
    }

    const lines = [`✅ <b>Orders for ${email}:</b>\n`];
    done.slice(0, 8).forEach((o: any, i: number) => {
      const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "";
      lines.push(`${i + 1}. ${o.planName} — KES ${o.amount} (${date})`);
    });
    lines.push(`\n📩 Credentials were sent to your email after payment.\nNeed help? Contact support.`);

    await sendMsg(chatId, token, lines.join("\n"));
  } catch {
    await sendMsg(chatId, token, `❌ Could not look up orders. Please try again later.`);
    setUserState(chatId, { type: "idle" });
  }
}

// ─── ADMIN commands (restricted to admin chat ID) ─────────────────────────

async function handleAdminStart(chatId: string, token: string) {
  adminState.step = { type: "idle" };
  await sendMsg(chatId, token,
    `🔧 <b>Admin Commands</b>\n\n` +
    `<b>📦 Accounts & Stock:</b>\n` +
    `/addaccount — Add account to a plan\n` +
    `/stock — View stock levels\n` +
    `/stats — Revenue & order stats\n\n` +
    `<b>🆘 Support & Resolution:</b>\n` +
    `/lookup &lt;email&gt; — Full customer profile\n` +
    `/resend &lt;email&gt; — Resend credentials\n` +
    `/order &lt;ref&gt; — Order details\n` +
    `/verify &lt;ref&gt; — Force verify & deliver\n` +
    `/creditwallet &lt;email&gt; &lt;amt&gt; — Add wallet balance\n` +
    `/suspend &lt;email&gt; — Suspend account\n` +
    `/unsuspend &lt;email&gt; — Restore account\n\n` +
    `<b>🎫 Tickets:</b>\n` +
    `/tickets — View open tickets\n` +
    `/reply &lt;id&gt; &lt;msg&gt; — Reply to ticket\n` +
    `/close &lt;id&gt; — Close ticket\n\n` +
    `/cancel — Cancel current action`
  );
}

async function handleStock(chatId: string, token: string) {
  const plans = getAllPlans();
  if (!plans.length) { await sendMsg(chatId, token, "No plans configured."); return; }

  const lines = [`📦 <b>Stock Levels</b>\n`];
  for (const plan of plans) {
    const info = accountManager.getStockInfo(plan.id);
    const bar  = stockBar(info.available, info.total);
    const flag = info.available === 0 ? "🔴" : info.available <= 2 ? "🟡" : "🟢";
    lines.push(`${flag} <b>${plan.name}</b>: ${info.available}/${info.total} ${bar}`);
  }
  await sendMsg(chatId, token, lines.join("\n"));
}

async function handleStats(chatId: string, token: string) {
  try {
    const txs = await storage.getAllTransactions();
    const today = new Date().toISOString().slice(0, 10);
    const todayTxs = txs.filter((t: any) => t.status === "success" && (t.createdAt || "").startsWith(today));
    const allDone  = txs.filter((t: any) => t.status === "success");
    const todayRev = todayTxs.reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const totalRev = allDone.reduce((s: number, t: any) => s + (t.amount || 0), 0);

    await sendMsg(chatId, token,
      `📊 <b>Stats</b>\n\n` +
      `📅 Today: ${todayTxs.length} orders · KES ${todayRev.toLocaleString()}\n` +
      `💰 All time: ${allDone.length} orders · KES ${totalRev.toLocaleString()}`
    );
  } catch {
    await sendMsg(chatId, token, "❌ Could not fetch stats.");
  }
}

async function handleAddAccount(chatId: string, token: string) {
  const plans = getAllPlans();
  if (!plans.length) {
    await sendMsg(chatId, token, "❌ No plans exist. Create plans in the admin panel first.");
    return;
  }
  const lines = [`📋 <b>Pick a plan</b> — reply with the number:\n`];
  plans.forEach((p, i) => {
    const info = accountManager.getStockInfo(p.id);
    lines.push(`${i + 1}. ${p.name} (${info.available} slots free)`);
  });
  lines.push(`\nOr type the plan name/ID. Type /cancel to stop.`);
  adminState.step = { type: "add_pick_plan" };
  await sendMsg(chatId, token, lines.join("\n"));
}

// ─── Support ticket commands (admin only) ──────────────────────────────────

async function handleTickets(chatId: string, token: string) {
  try {
    const tickets = await storage.getOpenTickets();
    if (!tickets.length) {
      await sendMsg(chatId, token, "✅ No open or escalated support tickets.");
      return;
    }
    const lines = [`🎫 <b>Open/Escalated Tickets</b>\n`];
    for (const t of tickets) {
      const statusIcon = t.status === "escalated" ? "🆘" : "📩";
      lines.push(
        `${statusIcon} <b>#${t.id}</b> [${t.status}] — ${t.customerEmail}\n` +
        `   📋 ${t.subject || "No subject"}\n`
      );
    }
    lines.push(`\nUse /reply &lt;id&gt; &lt;message&gt; to respond\nUse /close &lt;id&gt; to close a ticket`);
    await sendMsg(chatId, token, lines.join("\n"));
  } catch {
    await sendMsg(chatId, token, "❌ Could not fetch tickets.");
  }
}

async function handleReply(chatId: string, token: string, text: string) {
  const match = text.match(/^\/reply\s+(\d+)\s+([\s\S]+)$/);
  if (!match) {
    await sendMsg(chatId, token, "❌ Usage: /reply &lt;ticketId&gt; &lt;message&gt;\n\nExample: /reply 5 We're looking into it!");
    return;
  }
  const ticketId = parseInt(match[1]);
  const message = match[2].trim();
  try {
    const ticket = await storage.getTicketById(ticketId);
    if (!ticket) {
      await sendMsg(chatId, token, `❌ Ticket #${ticketId} not found.`);
      return;
    }
    await storage.addMessage({ ticketId, sender: "admin", message });
    await sendMsg(chatId, token, `✅ Reply sent to ticket #${ticketId}.`);
  } catch {
    await sendMsg(chatId, token, `❌ Failed to reply to ticket #${ticketId}.`);
  }
}

async function handleClose(chatId: string, token: string, text: string) {
  const match = text.match(/^\/close\s+(\d+)$/);
  if (!match) {
    await sendMsg(chatId, token, "❌ Usage: /close &lt;ticketId&gt;\n\nExample: /close 5");
    return;
  }
  const ticketId = parseInt(match[1]);
  try {
    const ticket = await storage.getTicketById(ticketId);
    if (!ticket) {
      await sendMsg(chatId, token, `❌ Ticket #${ticketId} not found.`);
      return;
    }
    await storage.updateTicket(ticketId, { status: "closed" });
    await sendMsg(chatId, token, `✅ Ticket #${ticketId} closed.`);
  } catch {
    await sendMsg(chatId, token, `❌ Failed to close ticket #${ticketId}.`);
  }
}

// ─── Admin support commands ────────────────────────────────────────────────

async function handleAdminResend(chatId: string, token: string, text: string) {
  const email = text.trim().split(/\s+/)[1]?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await sendMsg(chatId, token, "❌ Usage: /resend &lt;email&gt;\n\nExample: /resend customer@gmail.com");
    return;
  }
  try {
    const txs = await storage.getTransactionsByEmail(email);
    const done = txs.filter((t: any) => t.status === "success");
    if (!done.length) {
      await sendMsg(chatId, token, `❌ No completed orders found for <code>${email}</code>`);
      return;
    }
    const latest = done.sort((a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )[0];
    const account = accountManager.findAccountByCustomer(latest.planId, email);
    if (!account) {
      await sendMsg(chatId, token,
        `⚠️ No assigned account for <code>${email}</code> on <b>${latest.planName}</b>.\n\n` +
        `Use /verify <code>${latest.reference}</code> to force-deliver.`
      );
      return;
    }
    const result = await sendAccountEmail(email, latest.planName, account, latest.customerName || "Customer");
    if (result.success) {
      await sendMsg(chatId, token,
        `✅ <b>Credentials resent!</b>\n\n📧 To: <code>${email}</code>\n📦 Plan: ${latest.planName}\n🔖 Ref: <code>${latest.reference}</code>`
      );
    } else {
      await sendMsg(chatId, token, `❌ Email failed: ${result.error || "unknown"}\n\nCheck SMTP settings in admin panel.`);
    }
  } catch (err: any) {
    await sendMsg(chatId, token, `❌ Error: ${err.message}`);
  }
}

async function handleLookup(chatId: string, token: string, text: string) {
  const email = text.trim().split(/\s+/)[1]?.trim();
  if (!email) {
    await sendMsg(chatId, token, "❌ Usage: /lookup &lt;email&gt;\n\nExample: /lookup customer@gmail.com");
    return;
  }
  try {
    const customer = await storage.getCustomerByEmail(email);
    const txs = await storage.getTransactionsByEmail(email);
    const done = txs.filter((t: any) => t.status === "success");
    const pending = txs.filter((t: any) => t.status === "pending");
    if (!customer && !txs.length) {
      await sendMsg(chatId, token, `❌ No customer or orders found for <code>${email}</code>`);
      return;
    }
    const wallet = customer ? await storage.getWallet(customer.id) : null;
    const totalSpent = done.reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const lines: string[] = [`👤 <b>Customer: ${email}</b>\n`];
    if (customer) {
      lines.push(`Name: ${customer.name || "Not set"}`);
      lines.push(`Verified: ${customer.emailVerified ? "✅" : "❌"}`);
      lines.push(`Status: ${customer.suspended ? "⛔ SUSPENDED" : "✅ Active"}`);
      lines.push(`Wallet: KES ${(wallet?.balance ?? 0).toLocaleString()}`);
      lines.push(`2FA: ${customer.totpEnabled ? "✅" : "Not set"}`);
    } else {
      lines.push("Account: Guest (no login)");
    }
    lines.push(`\n📦 ${done.length} completed${pending.length ? `, ${pending.length} pending` : ""} · KES ${totalSpent.toLocaleString()} total`);
    done.slice(0, 5).forEach((o: any) => {
      const d = o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "";
      lines.push(`• ${o.planName} — KES ${o.amount} · <code>${o.reference}</code> (${d})`);
    });
    lines.push(`\n<b>Quick actions:</b>`);
    lines.push(`/resend ${email}`);
    if (customer?.suspended) lines.push(`/unsuspend ${email}`);
    else if (customer) lines.push(`/suspend ${email}`);
    if (customer) lines.push(`/creditwallet ${email} 500`);
    await sendMsg(chatId, token, lines.join("\n"));
  } catch (err: any) {
    await sendMsg(chatId, token, `❌ Error: ${err.message}`);
  }
}

async function handleAdminOrder(chatId: string, token: string, text: string) {
  const ref = text.trim().split(/\s+/)[1]?.trim();
  if (!ref) {
    await sendMsg(chatId, token, "❌ Usage: /order &lt;reference&gt;\n\nExample: /order REF-ABC123");
    return;
  }
  try {
    const tx = await storage.getTransaction(ref);
    if (!tx) { await sendMsg(chatId, token, `❌ No order found: <code>${ref}</code>`); return; }
    const icon = tx.status === "success" ? "✅" : tx.status === "pending" ? "⏳" : "❌";
    const account = accountManager.findAccountByCustomer(tx.planId, tx.customerEmail);
    const date = tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "Unknown";
    const lines = [
      `🔖 <b>Order: ${ref}</b>\n`,
      `Customer: <code>${tx.customerEmail}</code>`,
      `Plan: ${tx.planName}`,
      `Amount: KES ${(tx.amount || 0).toLocaleString()}`,
      `Status: ${icon} ${tx.status}`,
      `Date: ${date}`,
      `Account assigned: ${account ? "✅" : "❌"}`,
      `Email sent: ${(tx as any).emailSent || (tx as any).email_sent ? "✅" : "❌"}`,
    ];
    if (tx.status !== "success") lines.push(`\n👉 /verify ${ref} — force verify & deliver`);
    else if (account) lines.push(`\n👉 /resend ${tx.customerEmail} — resend credentials`);
    await sendMsg(chatId, token, lines.join("\n"));
  } catch (err: any) {
    await sendMsg(chatId, token, `❌ Error: ${err.message}`);
  }
}

async function handleAdminVerify(chatId: string, token: string, text: string) {
  const ref = text.trim().split(/\s+/)[1]?.trim();
  if (!ref) {
    await sendMsg(chatId, token, "❌ Usage: /verify &lt;reference&gt;\n\nExample: /verify REF-ABC123");
    return;
  }
  try {
    const tx = await storage.getTransaction(ref);
    if (!tx) { await sendMsg(chatId, token, `❌ Order not found: <code>${ref}</code>`); return; }
    if (tx.status === "success") {
      await sendMsg(chatId, token,
        `ℹ️ Already verified and delivered.\n\nUse /resend ${tx.customerEmail} to re-send credentials.`
      );
      return;
    }
    await sendMsg(chatId, token, `⏳ Verifying <code>${ref}</code>...`);
    await storage.updateTransaction(ref, { status: "success" });
    const account = accountManager.assignAccount(tx.planId, tx.customerEmail, tx.customerName || "Customer", null);
    if (!account) {
      await sendMsg(chatId, token,
        `⚠️ Order marked paid, but <b>no stock</b> for ${tx.planName}.\n\n` +
        `Use /addaccount to restock, then /resend ${tx.customerEmail}.`
      );
      return;
    }
    const emailResult = await sendAccountEmail(tx.customerEmail, tx.planName, account, tx.customerName || "Customer");
    await sendMsg(chatId, token,
      `✅ <b>Verified & Delivered!</b>\n\n` +
      `Customer: <code>${tx.customerEmail}</code>\n` +
      `Plan: ${tx.planName}\n` +
      `Email: ${emailResult.success ? "✅ Sent" : "❌ Failed — use /resend " + tx.customerEmail}`
    );
  } catch (err: any) {
    await sendMsg(chatId, token, `❌ Error: ${err.message}`);
  }
}

async function handleCreditWallet(chatId: string, token: string, text: string) {
  const parts = text.trim().split(/\s+/);
  const email = parts[1]?.trim();
  const amount = parseInt(parts[2] || "");
  if (!email || isNaN(amount) || amount <= 0) {
    await sendMsg(chatId, token,
      "❌ Usage: /creditwallet &lt;email&gt; &lt;amount&gt;\n\nExample: /creditwallet customer@gmail.com 500"
    );
    return;
  }
  try {
    const customer = await storage.getCustomerByEmail(email);
    if (!customer) {
      await sendMsg(chatId, token, `❌ No account found for <code>${email}</code>. Customer must be registered.`);
      return;
    }
    await storage.creditWallet(customer.id, amount, "Admin credit via Telegram");
    const wallet = await storage.getWallet(customer.id);
    await sendMsg(chatId, token,
      `✅ <b>Wallet credited!</b>\n\n` +
      `Customer: <code>${email}</code>\n` +
      `Added: KES ${amount.toLocaleString()}\n` +
      `New balance: KES ${(wallet?.balance ?? 0).toLocaleString()}`
    );
  } catch (err: any) {
    await sendMsg(chatId, token, `❌ Error: ${err.message}`);
  }
}

async function handleSuspend(chatId: string, token: string, text: string) {
  const email = text.trim().split(/\s+/)[1]?.trim();
  if (!email) { await sendMsg(chatId, token, "❌ Usage: /suspend &lt;email&gt;"); return; }
  try {
    const customer = await storage.getCustomerByEmail(email);
    if (!customer) { await sendMsg(chatId, token, `❌ No account found for <code>${email}</code>`); return; }
    if (customer.suspended) {
      await sendMsg(chatId, token, `ℹ️ Already suspended. Use /unsuspend ${email} to restore.`);
      return;
    }
    await storage.updateCustomer(customer.id, { suspended: true });
    await sendMsg(chatId, token, `⛔ Suspended: <code>${email}</code>`);
  } catch (err: any) {
    await sendMsg(chatId, token, `❌ Error: ${err.message}`);
  }
}

async function handleUnsuspend(chatId: string, token: string, text: string) {
  const email = text.trim().split(/\s+/)[1]?.trim();
  if (!email) { await sendMsg(chatId, token, "❌ Usage: /unsuspend &lt;email&gt;"); return; }
  try {
    const customer = await storage.getCustomerByEmail(email);
    if (!customer) { await sendMsg(chatId, token, `❌ No account found for <code>${email}</code>`); return; }
    if (!customer.suspended) {
      await sendMsg(chatId, token, `ℹ️ Account <code>${email}</code> is not suspended.`);
      return;
    }
    await storage.updateCustomer(customer.id, { suspended: false });
    await sendMsg(chatId, token, `✅ Restored: <code>${email}</code>`);
  } catch (err: any) {
    await sendMsg(chatId, token, `❌ Error: ${err.message}`);
  }
}

// ─── Master message dispatcher ────────────────────────────────────────────

async function handleMessage(msg: any, botToken: string, adminChatId: string) {
  const chatId  = String(msg.chat?.id ?? "");
  const isAdmin = chatId === String(adminChatId);
  const text    = (msg.text || "").trim();
  if (!text || !chatId) return;

  // ── Commands ─────────────────────────────────────────────────────────────

  if (text === "/cancel") {
    if (isAdmin) adminState.step = { type: "idle" };
    setUserState(chatId, { type: "idle" });
    await sendMsg(chatId, botToken, "✅ Cancelled."); return;
  }

  if (text === "/buy") { return handleBuy(chatId, botToken); }
  if (text === "/myorders") { return handleMyOrders(chatId, botToken); }
  if (text === "/balance" || text === "/wallet") { return handleBalance(chatId, botToken); }
  if (text === "/me") { return handleMe(chatId, botToken); }
  if (text.startsWith("/link")) { return handleLink(chatId, botToken, text); }

  if (text === "/start" || text === "/help" || text === "/menu") {
    if (isAdmin) return handleAdminStart(chatId, botToken);
    return handleUserStart(chatId, botToken);
  }

  // Admin-only commands
  if (isAdmin) {
    if (text === "/addaccount" || text === "/add") { return handleAddAccount(chatId, botToken); }
    if (text === "/stock")  { return handleStock(chatId, botToken); }
    if (text === "/stats")  { return handleStats(chatId, botToken); }
    if (text === "/tickets") { return handleTickets(chatId, botToken); }
    if (text.startsWith("/reply ")) { return handleReply(chatId, botToken, text); }
    if (text.startsWith("/close ")) { return handleClose(chatId, botToken, text); }
    if (text.startsWith("/resend")) { return handleAdminResend(chatId, botToken, text); }
    if (text.startsWith("/lookup")) { return handleLookup(chatId, botToken, text); }
    if (text.startsWith("/order ") || text === "/order") { return handleAdminOrder(chatId, botToken, text); }
    if (text.startsWith("/verify")) { return handleAdminVerify(chatId, botToken, text); }
    if (text.startsWith("/creditwallet")) { return handleCreditWallet(chatId, botToken, text); }
    if (text.startsWith("/suspend") && !text.startsWith("/unsuspend")) { return handleSuspend(chatId, botToken, text); }
    if (text.startsWith("/unsuspend")) { return handleUnsuspend(chatId, botToken, text); }
  }

  // ── Conversation flows ────────────────────────────────────────────────────

  // Admin flow
  if (isAdmin && adminState.step.type !== "idle") {
    const step = adminState.step;

    if (step.type === "add_pick_plan") {
      const plans = getAllPlans();
      const idx = parseInt(text);
      const found = (!isNaN(idx) && idx >= 1 && idx <= plans.length)
        ? plans[idx - 1]
        : findPlan(text);

      if (!found) {
        await sendMsg(chatId, botToken, `❌ Plan not found. Reply with a number or plan name. /cancel to stop.`);
        return;
      }
      adminState.step = { type: "add_creds", planId: found.id, planName: found.name };
      await sendMsg(chatId, botToken,
        `✅ Plan: <b>${found.name}</b>\n\n` +
        `Send credentials:\n<code>email|password</code>\n\nExample: <code>user@netflix.com|Pass123</code>\n\n/cancel to stop.`
      );
      return;
    }

    if (step.type === "add_creds") {
      const parts = text.split("|");
      if (parts.length < 2 || !parts[0].trim() || !parts.slice(1).join("|").trim()) {
        await sendMsg(chatId, botToken, `❌ Use format: <code>email|password</code>\n\n/cancel to stop.`);
        return;
      }
      const email    = parts[0].trim();
      const password = parts.slice(1).join("|").trim();
      adminState.step = { type: "add_slots", planId: step.planId, planName: step.planName, email, password };
      await sendMsg(chatId, botToken,
        `✅ Credentials saved.\n\nHow many users can share this account?\nReply with a number (e.g. <code>5</code>)\n\n/cancel to stop.`
      );
      return;
    }

    if (step.type === "add_slots") {
      const slots = parseInt(text);
      if (isNaN(slots) || slots < 1 || slots > 100) {
        await sendMsg(chatId, botToken, `❌ Enter a number between 1 and 100.\n\n/cancel to stop.`);
        return;
      }
      const { planId, planName, email, password } = step;
      accountManager.addAccount(planId, { email, password, maxUsers: slots } as any);
      adminState.step = { type: "idle" };
      const info = accountManager.getStockInfo(planId);
      await sendMsg(chatId, botToken,
        `🎉 <b>Account Added!</b>\n\n` +
        `📦 ${planName}\n📧 <code>${email}</code>\n🔑 <code>${password}</code>\n👥 Max users: ${slots}\n\n` +
        `📊 ${planName} now has <b>${info.available} slot${info.available !== 1 ? "s" : ""} available</b>\n\n` +
        `/addaccount to add another · /stock to see all`
      );
      return;
    }
  }

  // User flow
  const uState = getUserState(chatId);

  if (uState.type === "buy_pick_plan") {
    return handleBuyPickPlan(chatId, botToken, text);
  }

  if (uState.type === "orders_email") {
    return handleOrdersEmail(chatId, botToken, text);
  }

  // Default
  if (isAdmin) {
    await sendMsg(chatId, botToken,
      `Send /addaccount to add accounts, /stock to check inventory, /stats for revenue, or /buy to see available plans.`
    );
  } else {
    await sendMsg(chatId, botToken,
      `Type /buy to browse plans, /myorders to check your orders, or /help for the full menu.`
    );
  }
}

// ─── Long polling loop ────────────────────────────────────────────────────

let polling = false;
let pollingTimeout: ReturnType<typeof setTimeout> | null = null;

export function startTelegramBot() {
  if (polling) return;
  polling = true;
  poll(0).catch(() => {});
}

export function stopTelegramBot() {
  polling = false;
  if (pollingTimeout) { clearTimeout(pollingTimeout); pollingTimeout = null; }
}

async function poll(offset: number) {
  if (!polling) return;

  const { botToken, chatId, ok } = getConfig();
  if (!ok) {
    pollingTimeout = setTimeout(() => poll(offset), 30_000);
    return;
  }

  try {
    const data: any = await tgApi(botToken, "getUpdates", {
      offset,
      timeout: 20,
      allowed_updates: ["message"],
    });

    let nextOffset = offset;
    if (data.ok && data.result?.length) {
      for (const update of data.result) {
        nextOffset = update.update_id + 1;
        if (update.message) {
          await handleMessage(update.message, botToken, chatId).catch(() => {});
        }
      }
    }

    if (!polling) return;
    pollingTimeout = setTimeout(() => poll(nextOffset), 100);
  } catch {
    if (!polling) return;
    pollingTimeout = setTimeout(() => poll(offset), 5_000);
  }
}
