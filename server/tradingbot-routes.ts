import type { Express } from "express";
import { runQuery, runMutation, dbType, dbSettingsGet, dbSettingsSet } from "./storage";
import { getPaystackSecretKey, getPaystackPublicKey } from "./secrets";
import { customerAuthMiddleware, adminAuthMiddleware } from "./auth";
import axios from "axios";

function buildQuery(template: string, params: any[]): { query: string; params: any[] } {
  if (dbType === "pg") {
    let i = 1;
    return { query: template.replace(/\?/g, () => `$${i++}`), params };
  }
  return { query: template, params };
}
async function q(template: string, params: any[] = []): Promise<any[]> {
  const { query, params: p } = buildQuery(template, params);
  return runQuery(query, p);
}
async function m(template: string, params: any[] = []): Promise<void> {
  const { query, params: p } = buildQuery(template, params);
  return runMutation(query, p);
}

// Always generate timestamps in JS — no DB-specific functions needed
function now() { return new Date().toISOString(); }

function generateReference(): string {
  return `CTBOT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const DEFAULT_PLANS = [
  { id: "monthly",   label: "Monthly",   price: 500,  durationDays: 30,  popular: false },
  { id: "quarterly", label: "Quarterly", price: 1200, durationDays: 90,  popular: true  },
  { id: "lifetime",  label: "Lifetime",  price: 5000, durationDays: null, popular: false },
];
export function getPlans() {
  try { const raw = dbSettingsGet("tradingbot_plans"); if (raw) return JSON.parse(raw); } catch {}
  return DEFAULT_PLANS;
}
export const TRADING_BOT_PLANS = DEFAULT_PLANS;

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  if (dbType === "pg") {
    await m(`
      CREATE TABLE IF NOT EXISTS trading_bot_subscriptions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER,
        customer_email TEXT NOT NULL,
        customer_name TEXT,
        plan TEXT NOT NULL,
        amount INTEGER NOT NULL,
        paystack_reference TEXT UNIQUE,
        status TEXT DEFAULT 'pending',
        expires_at TEXT,
        created_at TEXT,
        updated_at TEXT,
        telegram_chat_id TEXT,
        telegram_bot_token TEXT
      )
    `);
    // Add columns if upgrading existing table
    try { await m(`ALTER TABLE trading_bot_subscriptions ADD COLUMN telegram_chat_id TEXT`); } catch {}
    try { await m(`ALTER TABLE trading_bot_subscriptions ADD COLUMN telegram_bot_token TEXT`); } catch {}
  } else {
    await m(`
      CREATE TABLE IF NOT EXISTS trading_bot_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        customer_email TEXT NOT NULL,
        customer_name TEXT,
        plan TEXT NOT NULL,
        amount INTEGER NOT NULL,
        paystack_reference TEXT UNIQUE,
        status TEXT DEFAULT 'pending',
        expires_at TEXT,
        created_at TEXT,
        updated_at TEXT,
        telegram_chat_id TEXT,
        telegram_bot_token TEXT
      )
    `);
    try { await m(`ALTER TABLE trading_bot_subscriptions ADD COLUMN telegram_chat_id TEXT`); } catch {}
    try { await m(`ALTER TABLE trading_bot_subscriptions ADD COLUMN telegram_bot_token TEXT`); } catch {}
  }
  tableReady = true;
}

export function registerTradingBotRoutes(app: Express) {
  ensureTable().catch(console.error);

  // ── Customer: Get plans ────────────────────────────────────────────────────
  app.get("/api/tradingbot/plans", (_req, res) => {
    res.json({ success: true, plans: getPlans() });
  });

  // ── Customer: Check access ─────────────────────────────────────────────────
  app.get("/api/tradingbot/access", customerAuthMiddleware, async (req: any, res) => {
    try {
      await ensureTable();
      const ts = now();
      const rows = await q(
        `SELECT * FROM trading_bot_subscriptions WHERE customer_email = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 1`,
        [req.customer.email, ts]
      );
      res.json({ success: true, hasAccess: rows.length > 0, subscription: rows[0] || null });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // ── Customer: My subscription ──────────────────────────────────────────────
  app.get("/api/tradingbot/subscription", customerAuthMiddleware, async (req: any, res) => {
    try {
      await ensureTable();
      const rows = await q(
        `SELECT * FROM trading_bot_subscriptions WHERE customer_email = ? ORDER BY created_at DESC LIMIT 1`,
        [req.customer.email]
      );
      res.json({ success: true, subscription: rows[0] || null });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // ── Customer: Create checkout ──────────────────────────────────────────────
  app.post("/api/tradingbot/checkout", customerAuthMiddleware, async (req: any, res) => {
    try {
      await ensureTable();
      const { planId, payMode } = req.body;
      const plan = getPlans().find((p: any) => p.id === planId);
      if (!plan) return res.status(400).json({ success: false, error: "Invalid plan" });

      const customer = req.customer;
      const reference = generateReference();
      const ts = now();
      const expiresAt = plan.durationDays
        ? new Date(Date.now() + plan.durationDays * 86400000).toISOString()
        : null;

      if (payMode === "wallet") {
        const [wallet] = await q(`SELECT * FROM wallets WHERE customer_id = ?`, [customer.id]);
        if (!wallet || wallet.balance < plan.price)
          return res.status(400).json({ success: false, error: "Insufficient wallet balance" });

        await m(`UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE customer_id = ?`,
          [plan.price, ts, customer.id]);
        await m(`INSERT INTO wallet_transactions (customer_id, type, amount, description, reference) VALUES (?, 'debit', ?, ?, ?)`,
          [customer.id, plan.price, `ChegeBot Pro ${plan.label} subscription`, reference]);
        await m(`INSERT INTO trading_bot_subscriptions (customer_id, customer_email, customer_name, plan, amount, paystack_reference, status, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
          [customer.id, customer.email, customer.name || "", plan.id, plan.price, reference, expiresAt, ts, ts]);
        return res.json({ success: true, method: "wallet", activated: true });
      }

      const secretKey = getPaystackSecretKey();
      if (!secretKey) return res.status(500).json({ success: false, error: "Payment not configured" });

      await m(`INSERT INTO trading_bot_subscriptions (customer_id, customer_email, customer_name, plan, amount, paystack_reference, status, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        [customer.id, customer.email, customer.name || "", plan.id, plan.price, reference, expiresAt, ts, ts]);

      res.json({ success: true, method: "paystack", reference, publicKey: getPaystackPublicKey(), amount: plan.price * 100, email: customer.email });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // ── Customer: Verify Paystack ──────────────────────────────────────────────
  app.post("/api/tradingbot/verify", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { reference } = req.body;
      const secretKey = getPaystackSecretKey();
      if (!secretKey) return res.status(500).json({ success: false, error: "Payment not configured" });

      const { data } = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (data.data?.status !== "success")
        return res.status(400).json({ success: false, error: "Payment not confirmed by Paystack" });

      await m(`UPDATE trading_bot_subscriptions SET status = 'active', updated_at = ? WHERE paystack_reference = ?`,
        [now(), reference]);
      res.json({ success: true, activated: true });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/tradingbot/plans-config", adminAuthMiddleware, (_req, res) => {
    res.json({ success: true, plans: getPlans() });
  });

  app.put("/api/admin/tradingbot/plans-config", adminAuthMiddleware, async (req: any, res) => {
    try {
      const { plans } = req.body;
      if (!Array.isArray(plans) || plans.length === 0)
        return res.status(400).json({ success: false, error: "Invalid plans array" });
      const validated = plans.map((p: any) => ({
        id:          String(p.id),
        label:       String(p.label),
        price:       Math.max(0, parseInt(p.price) || 0),
        durationDays: p.durationDays ? Math.max(1, parseInt(p.durationDays) || 1) : null,
        popular:     !!p.popular,
        badge:       p.badge ? String(p.badge) : null,
      }));
      dbSettingsSet("tradingbot_plans", JSON.stringify(validated));
      res.json({ success: true, plans: validated });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.get("/api/admin/tradingbot/stats", adminAuthMiddleware, async (_req, res) => {
    try {
      await ensureTable();
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [totals]   = await q(`SELECT COUNT(*) as total, SUM(amount) as revenue FROM trading_bot_subscriptions WHERE status = 'active'`, []);
      const [allTotals]= await q(`SELECT COUNT(*) as total, SUM(amount) as revenue FROM trading_bot_subscriptions`, []);
      const [monthData]= await q(`SELECT COUNT(*) as count, SUM(amount) as revenue FROM trading_bot_subscriptions WHERE status = 'active' AND created_at >= ?`, [monthStart]);
      const planRows   = await q(`SELECT plan, COUNT(*) as count, SUM(amount) as revenue FROM trading_bot_subscriptions WHERE status = 'active' GROUP BY plan`, []);
      const pm: Record<string, any> = {};
      planRows.forEach((r: any) => { pm[r.plan] = r; });
      res.json({ success: true,
        totalRevenue: totals?.revenue || 0, activeSubs: totals?.total || 0, totalSubs: allTotals?.total || 0,
        monthRevenue: monthData?.revenue || 0, monthCount: monthData?.count || 0,
        monthlySubs: pm.monthly?.count || 0,   monthlyRevenue: pm.monthly?.revenue || 0,
        quarterlySubs: pm.quarterly?.count || 0, quarterlyRevenue: pm.quarterly?.revenue || 0,
        lifetimeSubs: pm.lifetime?.count || 0,  lifetimeRevenue: pm.lifetime?.revenue || 0,
      });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.get("/api/admin/tradingbot/subscriptions", adminAuthMiddleware, async (req: any, res) => {
    try {
      await ensureTable();
      const { search = "", status = "all" } = req.query;
      let where = "WHERE 1=1"; const params: any[] = [];
      if (status !== "all") { where += " AND status = ?"; params.push(status); }
      if (search) { where += " AND (customer_email LIKE ? OR customer_name LIKE ? OR paystack_reference LIKE ?)"; const s = `%${search}%`; params.push(s, s, s); }
      const rows = await q(`SELECT * FROM trading_bot_subscriptions ${where} ORDER BY created_at DESC LIMIT 200`, params);
      res.json({ success: true, subscriptions: rows });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.post("/api/admin/tradingbot/activate/:id", adminAuthMiddleware, async (req: any, res) => {
    try {
      await m(`UPDATE trading_bot_subscriptions SET status = 'active', updated_at = ? WHERE id = ?`, [now(), req.params.id]);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.post("/api/admin/tradingbot/revoke/:id", adminAuthMiddleware, async (req: any, res) => {
    try {
      await m(`UPDATE trading_bot_subscriptions SET status = 'revoked', updated_at = ? WHERE id = ?`, [now(), req.params.id]);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.post("/api/admin/tradingbot/grant", adminAuthMiddleware, async (req: any, res) => {
    try {
      await ensureTable();
      const { email, plan = "monthly", days = 30 } = req.body;
      if (!email) return res.status(400).json({ success: false, error: "Email required" });
      const planData = getPlans().find((p: any) => p.id === plan) ?? getPlans()[0];
      const reference = `GRANT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const ts = now();
      const expiresAt = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
      await m(`UPDATE trading_bot_subscriptions SET status = 'revoked', updated_at = ? WHERE customer_email = ? AND status = 'active'`,
        [ts, email]);
      await m(`INSERT INTO trading_bot_subscriptions (customer_email, plan, amount, paystack_reference, status, expires_at, created_at, updated_at) VALUES (?, ?, 0, ?, 'active', ?, ?, ?)`,
        [email, planData.id, reference, expiresAt, ts, ts]);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // ── Telegram helpers ──────────────────────────────────────────────────────
  async function sendTelegram(botToken: string, chatId: string, text: string): Promise<boolean> {
    if (!botToken || !chatId) return false;
    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId, text, parse_mode: "HTML",
      });
      return true;
    } catch (err: any) {
      console.error("Telegram send error:", err?.response?.data || err.message);
      return false;
    }
  }

  // Link Telegram chat ID to subscriber account
  app.post("/api/tradingbot/telegram/link", customerAuthMiddleware, async (req: any, res) => {
    try {
      await ensureTable();
      const { chatId, botToken } = req.body;
      if (!chatId || String(chatId).trim() === "")
        return res.status(400).json({ success: false, error: "Chat ID is required" });
      if (!botToken || String(botToken).trim() === "")
        return res.status(400).json({ success: false, error: "Bot token is required" });
      const cid = String(chatId).trim();
      const tok = String(botToken).trim();
      await m(
        `UPDATE trading_bot_subscriptions SET telegram_chat_id = ?, telegram_bot_token = ? WHERE customer_email = ? AND status = 'active'`,
        [cid, tok, req.customer.email]
      );
      // Send a test message using the subscriber's own bot
      const sent = await sendTelegram(tok, cid, "✅ <b>ChegeBot Pro</b>\n\nYour Telegram alerts are now active! You\'ll get notified here when your bot wins, loses, or hits a risk limit.");
      if (!sent) {
        // Rollback if bot token is invalid
        await m(`UPDATE trading_bot_subscriptions SET telegram_chat_id = NULL, telegram_bot_token = NULL WHERE customer_email = ? AND status = 'active'`, [req.customer.email]);
        return res.status(400).json({ success: false, error: "Could not send test message — double-check your Bot Token and Chat ID" });
      }
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // Unlink Telegram
  app.delete("/api/tradingbot/telegram/link", customerAuthMiddleware, async (req: any, res) => {
    try {
      await ensureTable();
      await m(`UPDATE trading_bot_subscriptions SET telegram_chat_id = NULL, telegram_bot_token = NULL WHERE customer_email = ? AND status = 'active'`, [req.customer.email]);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // Get linked Telegram status
  app.get("/api/tradingbot/telegram/link", customerAuthMiddleware, async (req: any, res) => {
    try {
      await ensureTable();
      const rows = await q(`SELECT telegram_chat_id FROM trading_bot_subscriptions WHERE customer_email = ? AND status = 'active' LIMIT 1`, [req.customer.email]);
      res.json({ success: true, linked: !!(rows[0]?.telegram_chat_id), chatId: rows[0]?.telegram_chat_id || null, hasToken: !!(rows[0]?.telegram_chat_id) });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // Send trade alert (called by client on win/loss/risk events)
  app.post("/api/tradingbot/telegram/alert", customerAuthMiddleware, async (req: any, res) => {
    try {
      await ensureTable();
      const { event, symbol, type, stake, pnl, sessionPnl, confidence } = req.body;
      const rows = await q(
        `SELECT telegram_chat_id, telegram_bot_token FROM trading_bot_subscriptions WHERE customer_email = ? AND status = 'active' LIMIT 1`,
        [req.customer.email]
      );
      const chatId = rows[0]?.telegram_chat_id;
      const botToken = rows[0]?.telegram_bot_token;
      if (!chatId || !botToken) return res.json({ success: false, reason: "no_telegram_linked" });

      let msg = "";
      const sym = symbol || "?";
      const pnlStr = pnl >= 0 ? `+$${Number(pnl).toFixed(2)}` : `-$${Math.abs(Number(pnl)).toFixed(2)}`;
      const sessionStr = sessionPnl >= 0 ? `+$${Number(sessionPnl).toFixed(2)}` : `-$${Math.abs(Number(sessionPnl)).toFixed(2)}`;

      if (event === "win") {
        msg = `✅ <b>Trade WON</b> — ${sym}\n💰 P&amp;L: ${pnlStr} | Stake: $${Number(stake).toFixed(2)}\n📊 Session: ${sessionStr} | ${confidence}% confidence`;
      } else if (event === "loss") {
        msg = `❌ <b>Trade LOST</b> — ${sym}\n💸 P&amp;L: ${pnlStr} | Stake: $${Number(stake).toFixed(2)}\n📊 Session: ${sessionStr} | ${confidence}% confidence`;
      } else if (event === "stop_loss") {
        msg = `🛑 <b>Stop Loss Hit</b> — ${sym}\n📊 Session P&amp;L: ${sessionStr}\n⏸ Bot has paused automatically.`;
      } else if (event === "take_profit") {
        msg = `🎯 <b>Take Profit Hit</b> — ${sym}\n📊 Session P&amp;L: ${sessionStr}\n⏸ Bot has paused automatically.`;
      } else if (event === "daily_limit") {
        msg = `⚠️ <b>Daily Loss Limit Hit</b> — ${sym}\n📊 Session P&amp;L: ${sessionStr}\n⏹ Bot stopped for today.`;
      }

      if (!msg) return res.status(400).json({ success: false, error: "unknown event" });
      const sent = await sendTelegram(botToken, chatId, msg);
      res.json({ success: sent });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

}