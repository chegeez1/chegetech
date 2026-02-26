import { getCredentialsOverride } from "./credentials-store";

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
2️⃣ - Browse Plans & Prices
3️⃣ - Contact Support

Type *menu* anytime to see this again.`;

const sessionState: Record<string, { step: string; data?: any }> = {};

export async function handleInboundWhatsApp(
  from: string,
  messageText: string,
  context: {
    getOrdersByEmail: (email: string) => Promise<any[]>;
    getInStockPlans: () => any[];
    notifySupport: (phone: string, message: string) => Promise<void>;
  }
): Promise<void> {
  const msg = messageText.trim().toLowerCase();
  const state = sessionState[from] || { step: "idle" };

  if (msg === "menu" || msg === "hi" || msg === "hello" || msg === "start" || msg === "hey") {
    sessionState[from] = { step: "menu" };
    await sendWhatsAppMessage(from, MENU_TEXT);
    return;
  }

  if (state.step === "idle") {
    await sendWhatsAppMessage(from, MENU_TEXT);
    sessionState[from] = { step: "menu" };
    return;
  }

  if (state.step === "menu" || state.step === "idle") {
    if (msg === "1") {
      sessionState[from] = { step: "await_email_orders" };
      await sendWhatsAppMessage(from, "📧 Please send your *email address* used when purchasing:");
      return;
    }
    if (msg === "2") {
      const plans = context.getInStockPlans();
      if (!plans.length) {
        await sendWhatsAppMessage(from, "😔 No plans currently in stock. Check back soon or type *3* to contact support.");
      } else {
        const lines = ["📦 *Available Plans:*", ""];
        for (const p of plans.slice(0, 15)) {
          lines.push(`• ${p.name} — KES ${p.price} (${p.duration})`);
        }
        lines.push("", `🛒 Visit our store to purchase:`);
        lines.push(`https://chegetech.replit.app`);
        await sendWhatsAppMessage(from, lines.join("\n"));
      }
      sessionState[from] = { step: "menu" };
      return;
    }
    if (msg === "3") {
      sessionState[from] = { step: "await_support_msg" };
      await sendWhatsAppMessage(from, "💬 Please type your message and we'll get back to you shortly:");
      return;
    }
    await sendWhatsAppMessage(from, `Please reply with *1*, *2*, or *3*.\n\nType *menu* to see the options.`);
    return;
  }

  if (state.step === "await_email_orders") {
    const email = messageText.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await sendWhatsAppMessage(from, "❌ That doesn't look like a valid email. Please send your email address:");
      return;
    }
    try {
      const orders = await context.getOrdersByEmail(email);
      const completed = orders.filter((o: any) => o.status === "success");
      if (!completed.length) {
        await sendWhatsAppMessage(from, `😔 No completed orders found for *${email}*.\n\nMake sure you use the email you purchased with.\n\nType *menu* to go back.`);
      } else {
        const lines = [`✅ *Your Orders for ${email}:*`, ""];
        for (const o of completed.slice(0, 8)) {
          const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "";
          lines.push(`📦 ${o.planName} — KES ${o.amount} (${date})`);
        }
        lines.push("", "📩 Your account credentials were sent to your email.");
        lines.push("Need them resent? Reply *resend* and your email address.");
        await sendWhatsAppMessage(from, lines.join("\n"));
      }
    } catch {
      await sendWhatsAppMessage(from, "❌ Could not look up orders. Please try again later.\n\nType *menu* to go back.");
    }
    sessionState[from] = { step: "menu" };
    return;
  }

  if (state.step === "await_support_msg") {
    await context.notifySupport(from, messageText.trim());
    await sendWhatsAppMessage(from, "✅ Your message has been received! Our team will respond shortly.\n\nType *menu* to go back.");
    sessionState[from] = { step: "menu" };
    return;
  }

  await sendWhatsAppMessage(from, "Type *menu* to see the options.");
  sessionState[from] = { step: "menu" };
}
