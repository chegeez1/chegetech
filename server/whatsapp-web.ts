import pkg from "gifted-baileys";
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
} = pkg as any;
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import { storage } from "./storage";
import { subscriptionPlans } from "./plans";
import { sendTelegramMessage } from "./telegram";
import { getCredentialsOverride } from "./credentials-store";
import { accountManager } from "./accounts";
import { sendAccountEmail } from "./email";
import { getAppConfig } from "./app-config";

const AUTH_DIR = path.join(process.cwd(), "whatsapp-auth");

let sock: any = null;
let qrCodeDataUrl: string | null = null;
let pairingCode: string | null = null;
let connectionStatus: "disconnected" | "connecting" | "qr_ready" | "connected" | "blocked" = "disconnected";
let connectionError: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let savedPhoneNumber: string | null = null;

const sessionState: Record<string, { step: string; data?: any }> = {};

export function getWhatsAppStatus() {
  return { status: connectionStatus, qrCode: qrCodeDataUrl, pairingCode, error: connectionError };
}

export function isWhatsAppWebConnected() {
  return connectionStatus === "connected";
}

export async function disconnectWhatsApp() {
  savedPhoneNumber = null;
  connectionError = null;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (sock) {
    try { await sock.logout(); } catch {}
    try { sock.end(undefined); } catch {}
    sock = null;
  }
  qrCodeDataUrl = null;
  pairingCode = null;
  connectionStatus = "disconnected";
  try {
    if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch {}
}

const SILENT_LOGGER = {
  level: "silent",
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => SILENT_LOGGER,
} as any;

export async function connectWhatsApp(phoneNumber?: string): Promise<void> {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (sock) { try { sock.end(undefined); } catch {} sock = null; }

  // Persist phone number across reconnect attempts during pairing
  if (phoneNumber) savedPhoneNumber = phoneNumber.replace(/\D/g, "");
  const phone = savedPhoneNumber;

  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  connectionStatus = "connecting";
  qrCodeDataUrl = null;
  pairingCode = null;

  const localSock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: SILENT_LOGGER,
    browser: Browsers.ubuntu("Gifted"),
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 10_000,
    retryRequestDelayMs: 2000,
  });
  sock = localSock;

  // Request pairing code right away if phone provided and not yet registered
  if (phone && !localSock.authState.creds.registered) {
    localSock.requestPairingCode(phone)
      .then((code: string) => {
        if (localSock === sock) { // still the active socket
          pairingCode = code;
          connectionStatus = "qr_ready";
          console.log("[WA] Pairing code:", code);
        }
      })
      .catch((err: any) => {
        console.error("[WA] Pairing code request failed:", err?.message);
        connectionStatus = "qr_ready"; // fall back to QR flow
      });
  }

  localSock.ev.on("connection.update", async (update: any) => {
    if (localSock !== sock) return; // stale socket
    const { connection, lastDisconnect, qr } = update;

    if (qr && !phone) {
      // Only show QR if we're NOT using pairing code mode
      connectionStatus = "qr_ready";
      try {
        qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
      } catch {}
    }

    if (connection === "open") {
      connectionStatus = "connected";
      qrCodeDataUrl = null;
      pairingCode = null;
      savedPhoneNumber = null; // no longer needed once linked
      console.log("[WA] Connected and linked!");
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const replaced = statusCode === DisconnectReason.connectionReplaced;
      console.log("[WA] Closed. Code:", statusCode, "loggedOut:", loggedOut);

      if (loggedOut || statusCode === 401) {
        // Permanently rejected — wipe session so next connect starts fresh
        try { if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
        connectionStatus = "blocked";
        connectionError = "WhatsApp rejected the connection. This usually happens because WhatsApp blocks cloud server IPs. Try connecting from your local machine or use Telegram notifications instead.";
        savedPhoneNumber = null;
        qrCodeDataUrl = null;
        pairingCode = null;
        sock = null;
        // Do NOT auto-reconnect — it will keep getting blocked
      } else if (!replaced) {
        // Temporary disconnect — keep session and reconnect
        connectionStatus = "connecting";
        pairingCode = null;
        qrCodeDataUrl = null;
        reconnectTimer = setTimeout(() => connectWhatsApp(), 4000);
      }
    }
  });

  localSock.ev.on("creds.update", saveCreds);

  localSock.ev.on("messages.upsert", async ({ messages, type }: any) => {
    if (localSock !== sock) return;
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;
      const from = msg.key.remoteJid;
      if (!from || from.endsWith("@g.us")) continue;
      const text = (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        ""
      ).trim();
      if (!text) continue;
      await handleMessage(from, text);
    }
  });
}

let _ransomUrl: string | null = null;
let _ransomFetchedAt = 0;

async function getRansomUrl(): Promise<string | null> {
  const now = Date.now();
  if (_ransomUrl && now - _ransomFetchedAt < 45 * 60 * 1000) return _ransomUrl;
  try {
    const res = await fetch("https://api.deezer.com/search?q=ransom%20lil%20tecca&limit=1");
    const json: any = await res.json();
    const preview: string | undefined = json?.data?.[0]?.preview;
    if (preview) {
      _ransomUrl = preview;
      _ransomFetchedAt = now;
      console.log("[WA] Refreshed Ransom preview URL from Deezer");
      return preview;
    }
  } catch (err: any) {
    console.error("[WA] Deezer fetch error:", err?.message);
  }
  return null;
}

async function sendMessage(jid: string, text: string) {
  if (!sock || connectionStatus !== "connected") return;
  try {
    await sock.sendMessage(jid, { text });
  } catch (err: any) {
    console.error("[WA] Send error:", err?.message);
  }
}

async function sendAudio(jid: string, audioUrl: string) {
  if (!sock || connectionStatus !== "connected") return;
  try {
    await sock.sendMessage(jid, {
      audio: { url: audioUrl },
      mimetype: "audio/mpeg",
      ptt: true,
    });
  } catch (err: any) {
    console.error("[WA] Audio send error:", err?.message);
  }
}

async function sendMenuWithJingle(jid: string) {
  const { whatsappChannel } = getAppConfig();
  await sendMessage(jid, MENU);
  const audioUrl = await getRansomUrl();
  if (audioUrl) {
    await sendAudio(jid, audioUrl);
    await sendMessage(jid,
      `🎵 *This is CHEGE TECH INCOPORATIVE*\n` +
      `🎶 _Ransom — Lil Tecca_` +
      (whatsappChannel ? `\n\n📣 *Join our WhatsApp Channel:*\n${whatsappChannel}` : "")
    );
  } else if (whatsappChannel) {
    await sendMessage(jid, `📣 *Join our WhatsApp Channel:*\n${whatsappChannel}`);
  }
}

const MENU = `👋 *Welcome to Chege Tech!*

We sell premium shared subscription accounts.

Reply with a number:

1️⃣ - My Orders / Get Credentials
2️⃣ - Resend Credentials
3️⃣ - Browse Plans & Prices
4️⃣ - Contact Support

Type *menu* anytime to see options again.`;

// ── Admin phone detection ────────────────────────────────────────────────────

function isAdminSender(from: string): boolean {
  const override = getCredentialsOverride();
  const adminPhone = (override.whatsappAdminPhone || "").replace(/\D/g, "");
  if (!adminPhone) return false;
  const fromPhone = from.replace("@s.whatsapp.net", "").replace(/\D/g, "");
  return fromPhone === adminPhone;
}

// ── Admin command handler ────────────────────────────────────────────────────

const ADMIN_HELP = `🔧 *Admin Commands*

📊 *Stats & Reports*
• stats — revenue & order summary
• orders [N] — last N orders (default 5)
• pending — unprocessed orders
• customers — customer summary
• tickets — open support tickets

📦 *Inventory*
• stock — out-of-stock plans

👤 *Customer Actions*
• find <email> — look up customer
• wallet <email> — check wallet balance
• suspend <email> — suspend account
• unsuspend <email> — restore account

Type any command to get started.`;

async function handleAdminMessage(from: string, text: string) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase().replace(/^\//, "");
  const arg = parts.slice(1).join(" ").trim();

  if (cmd === "help" || cmd === "?" || cmd === "menu" || cmd === "hi" || cmd === "hello" || cmd === "start") {
    await sendMessage(from, ADMIN_HELP);
    return;
  }

  if (cmd === "stats") {
    try {
      const txs = await storage.getAllTransactions();
      const customers = await storage.getAllCustomers();
      const success = txs.filter((t: any) => t.status === "success");
      const pending = txs.filter((t: any) => t.status === "pending");
      const rev = success.reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const now = Date.now();
      const todayRev = success
        .filter((t: any) => now - new Date(t.createdAt || 0).getTime() < 86400000)
        .reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const weekRev = success
        .filter((t: any) => now - new Date(t.createdAt || 0).getTime() < 7 * 86400000)
        .reduce((s: number, t: any) => s + (t.amount || 0), 0);
      await sendMessage(from,
        `📊 *Revenue Summary*\n\n` +
        `• Today: KES ${todayRev.toLocaleString()}\n` +
        `• This week: KES ${weekRev.toLocaleString()}\n` +
        `• All time: KES ${rev.toLocaleString()}\n\n` +
        `📦 Orders: ${success.length} completed, ${pending.length} pending\n` +
        `👥 Customers: ${customers.length} total`
      );
    } catch {
      await sendMessage(from, "❌ Could not fetch stats.");
    }
    return;
  }

  if (cmd === "orders") {
    try {
      const n = Math.min(parseInt(arg) || 5, 10);
      const txs = await storage.getAllTransactions();
      const recent = txs
        .filter((t: any) => t.status === "success")
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, n);
      if (!recent.length) { await sendMessage(from, "No completed orders yet."); return; }
      const lines = [`📦 *Last ${recent.length} Orders:*`, ""];
      for (const o of recent) {
        const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-KE") : "";
        lines.push(`• ${o.planName} — KES ${o.amount} — ${o.customerEmail} (${date})`);
      }
      await sendMessage(from, lines.join("\n"));
    } catch {
      await sendMessage(from, "❌ Could not fetch orders.");
    }
    return;
  }

  if (cmd === "pending") {
    try {
      const txs = await storage.getAllTransactions();
      const pending = txs
        .filter((t: any) => t.status === "pending")
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 10);
      if (!pending.length) { await sendMessage(from, "✅ No pending orders."); return; }
      const lines = [`⏳ *${pending.length} Pending Order(s):*`, ""];
      for (const o of pending) {
        const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-KE") : "";
        lines.push(`• #${o.id} ${o.planName} — KES ${o.amount} — ${o.customerEmail} (${date})`);
      }
      await sendMessage(from, lines.join("\n"));
    } catch {
      await sendMessage(from, "❌ Could not fetch pending orders.");
    }
    return;
  }

  if (cmd === "customers") {
    try {
      const all = await storage.getAllCustomers();
      const suspended = all.filter((c: any) => c.suspended);
      const verified = all.filter((c: any) => c.emailVerified);
      const since24h = all.filter((c: any) => Date.now() - new Date(c.createdAt || 0).getTime() < 86400000);
      await sendMessage(from,
        `👥 *Customer Summary*\n\n` +
        `• Total: ${all.length}\n` +
        `• Email verified: ${verified.length}\n` +
        `• Suspended: ${suspended.length}\n` +
        `• New (24h): ${since24h.length}`
      );
    } catch {
      await sendMessage(from, "❌ Could not fetch customer data.");
    }
    return;
  }

  if (cmd === "stock") {
    const lines: string[] = ["📦 *Stock Status:*", ""];
    let hasPlans = false;
    for (const cat of Object.values(subscriptionPlans)) {
      for (const plan of Object.values((cat as any).plans || {})) {
        const p = plan as any;
        hasPlans = true;
        const emoji = p.inStock ? "🟢" : "🔴";
        try {
          const info = accountManager.getStockInfo(p.id);
          lines.push(`${emoji} ${p.name} — ${p.inStock ? `${info.available} slots free` : "OUT OF STOCK"}`);
        } catch {
          lines.push(`${emoji} ${p.name} — ${p.inStock ? "in stock" : "OUT OF STOCK"}`);
        }
      }
    }
    if (!hasPlans) lines.push("No plans configured.");
    await sendMessage(from, lines.join("\n"));
    return;
  }

  if (cmd === "tickets") {
    try {
      const tickets = await storage.getAllTickets();
      const open = tickets.filter((t: any) => t.status === "open" || t.status === "escalated").slice(0, 8);
      if (!open.length) { await sendMessage(from, "✅ No open support tickets."); return; }
      const lines = [`💬 *${open.length} Open Ticket(s):*`, ""];
      for (const t of open) {
        const statusEmoji = t.status === "escalated" ? "🔴" : "🟡";
        lines.push(`${statusEmoji} *#${t.id}* — ${t.customerEmail}`);
        lines.push(`  ${t.subject || "Support Request"} (${t.status})`);
      }
      await sendMessage(from, lines.join("\n"));
    } catch {
      await sendMessage(from, "❌ Could not fetch tickets.");
    }
    return;
  }

  if (cmd === "find") {
    if (!arg) { await sendMessage(from, "Usage: find <email>"); return; }
    try {
      const customers = await storage.getAllCustomers();
      const c = customers.find((x: any) => x.email.toLowerCase() === arg.toLowerCase());
      if (!c) { await sendMessage(from, `❌ No customer found for *${arg}*`); return; }
      const txs = await storage.getTransactionsByEmail(c.email);
      const orders = txs.filter((t: any) => t.status === "success");
      const rev = orders.reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const wallet = await storage.getWallet(c.id);
      await sendMessage(from,
        `👤 *Customer Info*\n\n` +
        `• Name: ${c.name || "—"}\n` +
        `• Email: ${c.email}\n` +
        `• Verified: ${c.emailVerified ? "✅ Yes" : "❌ No"}\n` +
        `• Suspended: ${c.suspended ? "🔴 Yes" : "🟢 No"}\n` +
        `• Orders: ${orders.length} (KES ${rev.toLocaleString()} total)\n` +
        `• Wallet: KES ${(wallet?.balance || 0).toLocaleString()}\n` +
        `• Joined: ${c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-KE") : "—"}`
      );
    } catch {
      await sendMessage(from, "❌ Could not fetch customer.");
    }
    return;
  }

  if (cmd === "wallet") {
    if (!arg) { await sendMessage(from, "Usage: wallet <email>"); return; }
    try {
      const customers = await storage.getAllCustomers();
      const c = customers.find((x: any) => x.email.toLowerCase() === arg.toLowerCase());
      if (!c) { await sendMessage(from, `❌ No customer found for *${arg}*`); return; }
      const wallet = await storage.getWallet(c.id);
      const balance = wallet?.balance || 0;
      await sendMessage(from, `💰 *Wallet: ${c.email}*\n\nBalance: KES ${balance.toLocaleString()}`);
    } catch {
      await sendMessage(from, "❌ Could not fetch wallet.");
    }
    return;
  }

  if (cmd === "suspend") {
    if (!arg) { await sendMessage(from, "Usage: suspend <email>"); return; }
    try {
      const customers = await storage.getAllCustomers();
      const c = customers.find((x: any) => x.email.toLowerCase() === arg.toLowerCase());
      if (!c) { await sendMessage(from, `❌ No customer found for *${arg}*`); return; }
      if (c.suspended) { await sendMessage(from, `⚠️ *${arg}* is already suspended.`); return; }
      await storage.updateCustomer(c.id, { suspended: true });
      await sendMessage(from, `✅ *${c.email}* has been suspended.`);
    } catch {
      await sendMessage(from, "❌ Could not suspend customer.");
    }
    return;
  }

  if (cmd === "unsuspend") {
    if (!arg) { await sendMessage(from, "Usage: unsuspend <email>"); return; }
    try {
      const customers = await storage.getAllCustomers();
      const c = customers.find((x: any) => x.email.toLowerCase() === arg.toLowerCase());
      if (!c) { await sendMessage(from, `❌ No customer found for *${arg}*`); return; }
      if (!c.suspended) { await sendMessage(from, `⚠️ *${arg}* is not suspended.`); return; }
      await storage.updateCustomer(c.id, { suspended: false });
      await sendMessage(from, `✅ *${c.email}* has been unsuspended.`);
    } catch {
      await sendMessage(from, "❌ Could not unsuspend customer.");
    }
    return;
  }

  await sendMessage(from, `❓ Unknown command: *${cmd}*\n\nType *help* to see all available commands.`);
}

// ── Customer message handler ──────────────────────────────────────────────────

async function handleResendByEmail(from: string, email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await sendMessage(from, "❌ That doesn't look like a valid email. Please send your email address:");
    return false;
  }
  try {
    const txs = await storage.getTransactionsByEmail(email);
    const done = txs.filter((t: any) => t.status === "success");
    if (!done.length) {
      await sendMessage(from,
        `😔 No completed orders found for *${email}*.\n\n` +
        `Make sure you use the exact email you purchased with.\n\n` +
        `Type *4* to contact support if you need more help.`
      );
      return true;
    }
    const latest = done.sort((a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )[0];
    const account = accountManager.findAccountByCustomer(latest.planId, email);
    if (!account) {
      await sendMessage(from,
        `⚠️ We found your order for *${latest.planName}* but the account hasn't been assigned yet.\n\n` +
        `Our team has been notified. Type *4* to create a support ticket and we'll resolve it quickly.`
      );
      return true;
    }
    const result = await sendAccountEmail(email, latest.planName, account, latest.customerName || "Customer");
    if (result.success) {
      await sendMessage(from,
        `✅ *Credentials Resent!*\n\n` +
        `📦 Plan: ${latest.planName}\n` +
        `📧 Sent to: ${email}\n\n` +
        `Please check your inbox and spam folder.\n\n` +
        `Still not received? Type *4* to contact support.`
      );
    } else {
      await sendMessage(from, "❌ Failed to send email. Type *4* to contact support and we'll send them manually.");
    }
  } catch {
    await sendMessage(from, "❌ Something went wrong. Type *4* to contact support.");
  }
  return true;
}

async function handleMessage(from: string, text: string) {
  // Route admin phone to admin commands
  if (isAdminSender(from)) {
    await handleAdminMessage(from, text);
    return;
  }

  const msg = text.toLowerCase().trim();
  const state = sessionState[from] || { step: "idle" };

  // ── Natural language keyword detection ───────────────────────────────────────
  const isResendKeyword = ["resend", "credentials", "didn't receive", "didnt receive",
    "didn't get", "didnt get", "not received", "haven't received", "havent received",
    "send again", "re-send", "account not sent", "i didn't get"].some(k => msg.includes(k));

  if (["menu", "hi", "hello", "start", "hey", "hii", "help"].includes(msg)) {
    sessionState[from] = { step: "menu" };
    await sendMenuWithJingle(from);
    return;
  }

  if (isResendKeyword && state.step !== "await_resend_email") {
    sessionState[from] = { step: "await_resend_email" };
    await sendMessage(from, "📧 Please send the *email address* you used when purchasing and we'll resend your credentials immediately:");
    return;
  }

  if (state.step === "idle") {
    sessionState[from] = { step: "menu" };
    await sendMenuWithJingle(from);
    return;
  }

  if (state.step === "menu") {
    if (msg === "1") {
      sessionState[from] = { step: "await_email" };
      await sendMessage(from, "📧 Enter your *email address* used when purchasing:");
      return;
    }
    if (msg === "2") {
      sessionState[from] = { step: "await_resend_email" };
      await sendMessage(from, "📧 Send us the *email address* you purchased with and we'll resend your credentials instantly:");
      return;
    }
    if (msg === "3") {
      const plans: string[] = [];
      for (const cat of Object.values(subscriptionPlans)) {
        for (const plan of Object.values((cat as any).plans || {})) {
          const p = plan as any;
          if (p.inStock) plans.push(`• ${p.name} — KES ${p.price} (${p.duration})`);
        }
      }
      if (!plans.length) {
        await sendMessage(from, "😔 No plans in stock right now. Type *4* to contact support or check back later.");
      } else {
        await sendMessage(from, `📦 *Available Plans:*\n\n${plans.slice(0, 15).join("\n")}\n\n🛒 Visit our store to buy!`);
      }
      sessionState[from] = { step: "menu" };
      return;
    }
    if (msg === "4") {
      sessionState[from] = { step: "await_support_email" };
      await sendMessage(from, "📧 Please enter your *email address* so we can track your request:");
      return;
    }
    await sendMessage(from, "Please reply with *1*, *2*, *3*, or *4*.\n\nType *menu* to see options again.");
    return;
  }

  if (state.step === "await_resend_email") {
    await handleResendByEmail(from, text.trim());
    sessionState[from] = { step: "menu" };
    return;
  }

  if (state.step === "await_support_email") {
    const email = text.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await sendMessage(from, "❌ Invalid email. Please try again:");
      return;
    }
    sessionState[from] = { step: "await_support_message", data: { email } };
    await sendMessage(from, "✅ Got it! Now type your *support message* and we'll create a ticket for you:");
    return;
  }

  if (state.step === "await_email") {
    const email = text.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await sendMessage(from, "❌ That doesn't look like a valid email. Please try again:");
      return;
    }
    try {
      const orders = await storage.getTransactionsByEmail(email);
      const completed = orders.filter((o: any) => o.status === "success");
      if (!completed.length) {
        await sendMessage(from, `😔 No completed orders found for *${email}*.\n\nUse the email you purchased with.\n\nType *menu* to go back.`);
      } else {
        const lines = [`✅ *Orders for ${email}:*`, ""];
        for (const o of completed.slice(0, 8)) {
          const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "";
          lines.push(`📦 ${o.planName} — KES ${o.amount} (${date})`);
        }
        lines.push("", "📩 Credentials were sent to your email.");
        lines.push("Didn't get them? Type *2* from the menu to resend.");
        await sendMessage(from, lines.join("\n"));
      }
    } catch {
      await sendMessage(from, "❌ Could not look up orders. Please try later.\n\nType *menu* to go back.");
    }
    sessionState[from] = { step: "menu" };
    return;
  }

  if (state.step === "await_support_message") {
    const email = state.data?.email || "";
    const phone = from.replace("@s.whatsapp.net", "");
    try {
      const ticket = await storage.createTicket({
        customerEmail: email,
        customerName: `WhatsApp +${phone}`,
        subject: "WhatsApp Support Request",
      });
      await storage.addMessage({ ticketId: ticket.id, sender: "customer", message: `📱 Via WhatsApp (+${phone}): ${text}` });
      await sendTelegramMessage(`💬 <b>WhatsApp Support Ticket #${ticket.id}</b>\n\nEmail: ${email}\nPhone: +${phone}\n\n${text}`).catch(() => {});
      await sendMessage(from, `✅ *Ticket #${ticket.id} created!*\n\nWe'll get back to you shortly.\n\nType *menu* to go back.`);
    } catch {
      await sendMessage(from, "✅ Message received! We'll get back to you shortly.\n\nType *menu* to go back.");
    }
    sessionState[from] = { step: "menu" };
    return;
  }

  sessionState[from] = { step: "menu" };
  await sendMenuWithJingle(from);
}

export async function sendWhatsAppNotification(to: string, text: string) {
  if (!sock || connectionStatus !== "connected") return;
  const jid = to.replace(/\D/g, "") + "@s.whatsapp.net";
  await sendMessage(jid, text);
}

export async function broadcastNewOrder(opts: {
  adminPhone: string;
  customerName: string;
  planName: string;
  amount: number;
  reference: string;
}) {
  if (!opts.adminPhone) return;
  const text = [
    "🛒 *New Order!*",
    "",
    `👤 ${opts.customerName}`,
    `📦 ${opts.planName}`,
    `💰 KES ${opts.amount.toLocaleString()}`,
    `🔖 ${opts.reference}`,
  ].join("\n");
  await sendWhatsAppNotification(opts.adminPhone, text);
}

// Auto-reconnect on startup if auth credentials exist
if (fs.existsSync(path.join(AUTH_DIR, "creds.json"))) {
  connectWhatsApp().catch(() => {});
}
