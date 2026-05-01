import { getCredentialsOverride } from "./credentials-store";
import { storage } from "./storage";
import { accountManager } from "./accounts";
import { sendAccountEmail } from "./email";
import { getAppConfig } from "./app-config";

function getWAConfig() {
  const override = getCredentialsOverride();
  const accessToken = override.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneNumberId = override.whatsappPhoneId || process.env.WHATSAPP_PHONE_ID || "";
  const verifyToken = override.whatsappVerifyToken || process.env.WHATSAPP_VERIFY_TOKEN || "chegetech_verify";
  return { accessToken, phoneNumberId, verifyToken, configured: !!(accessToken && phoneNumberId) };
}

export function isWhatsAppConfigured(): boolean {
  return getWAConfig().configured;
}

export function getWhatsAppVerifyToken(): string {
  return getWAConfig().verifyToken;
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<{ success: boolean; error?: string }> {
  const { accessToken, phoneNumberId, configured } = getWAConfig();
  if (!configured) return { success: false, error: "WhatsApp not configured" };

  try {
    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    const data = await res.json() as any;
    if (!res.ok) return { success: false, error: data.error?.message || "Send failed" };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function notifyAdminWhatsApp(text: string): Promise<void> {
  const override = getCredentialsOverride();
  const adminPhone = override.whatsappAdminPhone || process.env.WHATSAPP_ADMIN_PHONE || "";
  if (!adminPhone || !isWhatsAppConfigured()) return;
  await sendWhatsAppMessage(adminPhone, text).catch(() => {});
}

export async function notifyNewOrderWhatsApp(opts: {
  customerName: string;
  customerEmail: string;
  planName: string;
  amount: number;
  reference: string;
}): Promise<void> {
  const text = [
    "🛒 *New Order!*",
    "",
    `👤 Customer: ${opts.customerName}`,
    `📧 Email: ${opts.customerEmail}`,
    `📦 Plan: ${opts.planName}`,
    `💰 Amount: KES ${opts.amount.toLocaleString()}`,
    `🔖 Ref: ${opts.reference}`,
  ].join("\n");
  await notifyAdminWhatsApp(text);
}

const MENU_TEXT = `👋 *Welcome to Chege Tech!*

We sell premium shared subscription accounts.

Reply with a number:

1️⃣ - My Orders / Get Credentials
2️⃣ - Resend Credentials
3️⃣ - Browse Plans & Prices
4️⃣ - Contact Support

Type *menu* anytime to see this again.`;

const RANSOM_PREVIEW_URL = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/2a/17/cc/2a17cc34-099b-8db4-8426-6a777636b981/mzaf_2270249946485081165.plus.aac.p.m4a";

async function sendWhatsAppAudio(to: string, audioUrl: string): Promise<void> {
  const { accessToken, phoneNumberId, configured } = getWAConfig();
  if (!configured) return;
  try {
    await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "audio",
        audio: { link: audioUrl },
      }),
    });
  } catch {}
}

async function sendMenuWA(from: string): Promise<void> {
  await sendWhatsAppMessage(from, MENU_TEXT);
  // Send audio — plays inline in WhatsApp
  await sendWhatsAppAudio(from, RANSOM_PREVIEW_URL);
  // Channel link as text after audio
  const { whatsappChannel } = getAppConfig();
  const caption =
    `🎵 *This is CHEGE TECH INCOPORATIVE*\n` +
    `🎶 _Ransom — Lil Tecca_` +
    (whatsappChannel ? `\n\n📣 *Join our WhatsApp Channel:*\n${whatsappChannel}` : "");
  await sendWhatsAppMessage(from, caption);
}

const sessionState: Record<string, { step: string; data?: any }> = {};

// ─── Natural language keyword detection ────────────────────────────────────

function detectIntent(msg: string): "menu" | "orders" | "resend" | "plans" | "support" | null {
  const m = msg.toLowerCase().trim();
  if (["menu", "hi", "hello", "start", "hey", "hii", "help"].includes(m)) return "menu";
  if (["1", "my orders", "orders", "my order", "check order"].includes(m)) return "orders";
  if (["2", "resend", "resend credentials", "credentials", "i didn't receive", "didnt receive",
       "didn't get", "didnt get", "not received", "haven't received", "havent received",
       "send again", "account not sent", "email not received", "re-send"].some(k => m.includes(k))) return "resend";
  if (["3", "plans", "browse plans", "available plans", "prices", "price list"].includes(m)) return "plans";
  if (["4", "support", "help me", "contact", "problem", "issue", "complaint"].includes(m)) return "support";
  return null;
}

// ─── Resend logic ──────────────────────────────────────────────────────────

async function tryResendCredentials(email: string): Promise<string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "❌ That doesn't look like a valid email. Please send your email address:";
  }

  try {
    const txs = await storage.getTransactionsByEmail(email);
    const done = txs.filter((t: any) => t.status === "success");

    if (!done.length) {
      return (
        `😔 No completed orders found for *${email}*.\n\n` +
        `Make sure you use the exact email you purchased with.\n\n` +
        `If you think this is an error, type *4* to contact support.`
      );
    }

    const latest = done.sort((a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )[0];

    const account = accountManager.findAccountByCustomer(latest.planId, email);
    if (!account) {
      return (
        `⚠️ We found your order for *${latest.planName}* but the account hasn't been assigned yet.\n\n` +
        `Our team has been notified. Type *4* to report this and we'll resolve it quickly.`
      );
    }

    const result = await sendAccountEmail(email, latest.planName, account, latest.customerName || "Customer");
    if (result.success) {
      return (
        `✅ *Credentials Resent!*\n\n` +
        `📦 Plan: ${latest.planName}\n` +
        `📧 Sent to: ${email}\n\n` +
        `Please check your inbox (and spam folder). If you still don't receive it, type *4* to contact support.`
      );
    } else {
      return (
        `❌ Failed to send email. Please type *4* to contact support and we'll send your credentials manually.`
      );
    }
  } catch {
    return "❌ Something went wrong. Please type *4* to contact support.";
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function handleInboundWhatsApp(
  from: string,
  messageText: string,
  context: {
    getOrdersByEmail: (email: string) => Promise<any[]>;
    getInStockPlans: () => any[];
    notifySupport: (phone: string, message: string) => Promise<void>;
  }
): Promise<void> {
  const raw = messageText.trim();
  const msg = raw.toLowerCase();
  const state = sessionState[from] || { step: "idle" };

  // ── Intent detection takes priority over current state ─────────────────
  const intent = detectIntent(msg);

  if (intent === "menu") {
    sessionState[from] = { step: "menu" };
    await sendMenuWA(from);
    return;
  }

  // ── Active flow steps ───────────────────────────────────────────────────

  if (state.step === "await_email_orders") {
    const email = raw;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await sendWhatsAppMessage(from, "❌ That doesn't look like a valid email. Please send your email address:");
      return;
    }
    try {
      const orders = await context.getOrdersByEmail(email);
      const completed = orders.filter((o: any) => o.status === "success");
      if (!completed.length) {
        await sendWhatsAppMessage(from,
          `😔 No completed orders found for *${email}*.\n\n` +
          `Make sure you use the email you purchased with.\n\nType *menu* to go back.`
        );
      } else {
        const lines = [`✅ *Your Orders for ${email}:*`, ""];
        for (const o of completed.slice(0, 8)) {
          const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "";
          lines.push(`📦 ${o.planName} — KES ${o.amount} (${date})`);
        }
        lines.push("", "📩 Your account credentials were sent to your email.");
        lines.push("", "Did not receive them? Type *2* to resend credentials.");
        await sendWhatsAppMessage(from, lines.join("\n"));
      }
    } catch {
      await sendWhatsAppMessage(from, "❌ Could not look up orders. Please try again later.\n\nType *menu* to go back.");
    }
    sessionState[from] = { step: "menu" };
    return;
  }

  if (state.step === "await_email_resend") {
    const email = raw;
    const reply = await tryResendCredentials(email);
    await sendWhatsAppMessage(from, reply);
    sessionState[from] = { step: "menu" };
    return;
  }

  if (state.step === "await_support_msg") {
    await context.notifySupport(from, raw);
    await sendWhatsAppMessage(from,
      "✅ Your message has been received! Our team will respond shortly.\n\nType *menu* to go back."
    );
    sessionState[from] = { step: "menu" };
    return;
  }

  // ── Intent actions ──────────────────────────────────────────────────────

  if (intent === "orders" || (state.step === "menu" && msg === "1")) {
    sessionState[from] = { step: "await_email_orders" };
    await sendWhatsAppMessage(from, "📧 Please send your *email address* used when purchasing:");
    return;
  }

  if (intent === "resend" || (state.step === "menu" && msg === "2")) {
    sessionState[from] = { step: "await_email_resend" };
    await sendWhatsAppMessage(from,
      "📧 Please send the *email address* you used when purchasing and we'll resend your credentials immediately:"
    );
    return;
  }

  if (intent === "plans" || (state.step === "menu" && msg === "3")) {
    const plans = context.getInStockPlans();
    if (!plans.length) {
      await sendWhatsAppMessage(from,
        "😔 No plans currently in stock. Check back soon or type *4* to contact support."
      );
    } else {
      const lines = ["📦 *Available Plans:*", ""];
      for (const p of plans.slice(0, 15)) {
        lines.push(`• ${p.name} — KES ${p.price} (${p.duration})`);
      }
      lines.push("", "🛒 Visit our store to purchase:");
      lines.push(`https://chegetech.replit.app`);
      await sendWhatsAppMessage(from, lines.join("\n"));
    }
    sessionState[from] = { step: "menu" };
    return;
  }

  if (intent === "support" || (state.step === "menu" && msg === "4")) {
    sessionState[from] = { step: "await_support_msg" };
    await sendWhatsAppMessage(from, "💬 Please type your message and we'll get back to you shortly:");
    return;
  }

  // ── Fallback ────────────────────────────────────────────────────────────

  if (state.step === "idle" || state.step === "menu") {
    sessionState[from] = { step: "menu" };
    await sendMenuWA(from);
    return;
  }

  await sendWhatsAppMessage(from, "Type *menu* to see the options.");
  sessionState[from] = { step: "menu" };
}
