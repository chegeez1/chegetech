import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import { storage } from "./storage";
import { subscriptionPlans } from "./plans";
import { sendTelegramMessage } from "./telegram";

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
  const { version } = await fetchLatestBaileysVersion();

  connectionStatus = "connecting";
  qrCodeDataUrl = null;
  pairingCode = null;

  const localSock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, SILENT_LOGGER),
    },
    printQRInTerminal: false,
    logger: SILENT_LOGGER,
    browser: ["Chege Tech Bot", "Chrome", "120.0"],
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 10_000, // send pings every 10s to keep connection alive
    retryRequestDelayMs: 2000,
  });
  sock = localSock;

  // Request pairing code right away if phone provided and not yet registered
  // Baileys queues this internally until the handshake is ready
  if (phone && !state.creds.registered) {
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

      // Clean up auth dir always on close during initial pairing
      try { if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}

      if (loggedOut || statusCode === 401) {
        // WhatsApp rejected the connection (commonly happens on cloud IPs)
        connectionStatus = "blocked";
        connectionError = "WhatsApp rejected the connection. This usually happens because WhatsApp blocks cloud server IPs. Try connecting from your local machine or use Telegram notifications instead.";
        savedPhoneNumber = null;
        qrCodeDataUrl = null;
        pairingCode = null;
        sock = null;
        // Do NOT auto-reconnect — it will keep getting blocked
      } else if (!replaced) {
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

async function sendMessage(jid: string, text: string) {
  if (!sock || connectionStatus !== "connected") return;
  try {
    await sock.sendMessage(jid, { text });
  } catch (err: any) {
    console.error("[WA] Send error:", err?.message);
  }
}

const MENU = `👋 *Welcome to Chege Tech!*

We sell premium shared subscription accounts.

Reply with a number:

1️⃣ - My Orders / Get Credentials
2️⃣ - Browse Plans & Prices
3️⃣ - Contact Support

Type *menu* anytime to see options again.`;

async function handleMessage(from: string, text: string) {
  const msg = text.toLowerCase().trim();
  const state = sessionState[from] || { step: "idle" };

  if (["menu", "hi", "hello", "start", "hey", "hii"].includes(msg)) {
    sessionState[from] = { step: "menu" };
    await sendMessage(from, MENU);
    return;
  }

  if (state.step === "idle") {
    sessionState[from] = { step: "menu" };
    await sendMessage(from, MENU);
    return;
  }

  if (state.step === "menu") {
    if (msg === "1") {
      sessionState[from] = { step: "await_email" };
      await sendMessage(from, "📧 Enter your *email address* used when purchasing:");
      return;
    }
    if (msg === "2") {
      const plans: string[] = [];
      for (const cat of Object.values(subscriptionPlans)) {
        for (const plan of Object.values((cat as any).plans || {})) {
          const p = plan as any;
          if (p.inStock) plans.push(`• ${p.name} — KES ${p.price} (${p.duration})`);
        }
      }
      if (!plans.length) {
        await sendMessage(from, "😔 No plans in stock right now. Type *3* to contact support or check back later.");
      } else {
        await sendMessage(from, `📦 *Available Plans:*\n\n${plans.slice(0, 15).join("\n")}\n\n🛒 Visit our store to buy!`);
      }
      sessionState[from] = { step: "menu" };
      return;
    }
    if (msg === "3") {
      sessionState[from] = { step: "await_support" };
      await sendMessage(from, "💬 Type your message and we'll reply shortly:");
      return;
    }
    await sendMessage(from, "Please reply with *1*, *2*, or *3*.\n\nType *menu* to see options again.");
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
        lines.push("Need them resent? Contact support — type *3* then *menu*.");
        await sendMessage(from, lines.join("\n"));
      }
    } catch {
      await sendMessage(from, "❌ Could not look up orders. Please try later.\n\nType *menu* to go back.");
    }
    sessionState[from] = { step: "menu" };
    return;
  }

  if (state.step === "await_support") {
    const phone = from.replace("@s.whatsapp.net", "");
    await sendTelegramMessage(`💬 <b>WhatsApp Support</b>\n\nFrom: +${phone}\n\n${text}`).catch(() => {});
    await sendMessage(from, "✅ Message received! We'll get back to you shortly.\n\nType *menu* to go back.");
    sessionState[from] = { step: "menu" };
    return;
  }

  sessionState[from] = { step: "menu" };
  await sendMessage(from, MENU);
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
