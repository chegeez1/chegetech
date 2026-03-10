import { getCredentialsOverride } from "./credentials-store";

function getTelegramConfig() {
  const override = getCredentialsOverride();
  const botToken = override.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = override.telegramChatId || process.env.TELEGRAM_CHAT_ID || "";
  return { botToken, chatId, configured: !!(botToken && chatId) };
}

export function isTelegramConfigured(): boolean {
  return getTelegramConfig().configured;
}

export async function sendTelegramMessage(text: string): Promise<{ success: boolean; error?: string }> {
  const { botToken, chatId, configured } = getTelegramConfig();
  if (!configured) return { success: false, error: "Telegram not configured" };

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = await res.json() as any;
    if (!data.ok) return { success: false, error: data.description };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function notifyNewOrder(opts: {
  customerName: string;
  customerEmail: string;
  planName: string;
  amount: number;
  reference: string;
}): Promise<void> {
  const text = [
    `🛒 <b>New Order!</b>`,
    ``,
    `👤 Customer: ${opts.customerName}`,
    `📧 Email: ${opts.customerEmail}`,
    `📦 Plan: ${opts.planName}`,
    `💰 Amount: KES ${opts.amount.toLocaleString()}`,
    `🔖 Ref: <code>${opts.reference}</code>`,
  ].join("\n");
  await sendTelegramMessage(text).catch(() => {});
}

export async function notifyNewCustomer(opts: {
  name: string;
  email: string;
}): Promise<void> {
  const text = [
    `🎉 <b>New Customer Registered!</b>`,
    ``,
    `👤 Name: ${opts.name || "Unknown"}`,
    `📧 Email: ${opts.email}`,
  ].join("\n");
  await sendTelegramMessage(text).catch(() => {});
}

export async function notifyLowStock(planName: string, remaining: number): Promise<void> {
  const text = [
    `⚠️ <b>Low Stock Alert</b>`,
    ``,
    `📦 Plan: ${planName}`,
    `🪣 Remaining slots: ${remaining}`,
    ``,
    `Please add more accounts to avoid order failures.`,
  ].join("\n");
  await sendTelegramMessage(text).catch(() => {});
}

export async function notifyPaymentFailed(opts: {
  customerEmail: string;
  planName: string;
  amount: number;
  reference: string;
}): Promise<void> {
  const text = [
    `❌ <b>Payment Failed / Pending</b>`,
    ``,
    `📧 Email: ${opts.customerEmail}`,
    `📦 Plan: ${opts.planName}`,
    `💰 Amount: KES ${opts.amount.toLocaleString()}`,
    `🔖 Ref: <code>${opts.reference}</code>`,
  ].join("\n");
  await sendTelegramMessage(text).catch(() => {});
}

export async function notifySupportEscalation(opts: {
  ticketId: number;
  customerName: string;
  customerEmail: string;
  subject: string;
  recentMessages: Array<{ sender: string; message: string }>;
}): Promise<void> {
  const msgPreview = opts.recentMessages
    .slice(-5)
    .map((m) => `[${m.sender}] ${m.message}`)
    .join("\n");
  const text = [
    `🆘 <b>Support Escalation — Ticket #${opts.ticketId}</b>`,
    ``,
    `👤 Customer: ${opts.customerName || "Unknown"}`,
    `📧 Email: ${opts.customerEmail}`,
    `📋 Subject: ${opts.subject || "N/A"}`,
    ``,
    `💬 Recent messages:`,
    msgPreview,
    ``,
    `Reply from the Admin Dashboard or use /reply ${opts.ticketId} &lt;message&gt;`,
  ].join("\n");
  await sendTelegramMessage(text).catch(() => {});
}

export async function notifyCustomerSupport(opts: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  const text = [
    `💬 <b>Customer Support Message</b>`,
    ``,
    `👤 Name: ${opts.name || "Unknown"}`,
    `📧 Email: ${opts.email}`,
    ``,
    `📩 Message:`,
    opts.message,
  ].join("\n");
  await sendTelegramMessage(text).catch(() => {});
}
