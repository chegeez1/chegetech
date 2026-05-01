import type { Express } from "express";
import { runQuery, runMutation, dbType } from "./storage";
import { getPaystackSecretKey, getPaystackPublicKey } from "./secrets";
import axios from "axios";
import { promoManager } from "./promo";
import { customerAuthMiddleware } from "./auth";
import { vpsManager } from "./vps-manager";

function generateReference(): string {
  return `CTB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function parseFeatures(f: string | null | undefined): string[] {
  try { return JSON.parse(f ?? "[]"); } catch { return []; }
}

function fmtBot(b: Record<string, any>) {
  return {
    ...b,
    features: parseFeatures(b.features),
    requiresSessionId: !!b.requires_session_id,
    requiresDbUrl: !!b.requires_db_url,
    active: !!b.active,
    repoUrl: b.repo_url ?? b.repoUrl,
    imageUrl: b.image_url ?? b.imageUrl,
    createdAt: b.created_at ?? b.createdAt,
  };
}

function fmtOrder(o: Record<string, any>) {
  return {
    ...o,
    botId: o.bot_id ?? o.botId,
    botName: o.bot_name ?? o.botName,
    customerName: o.customer_name ?? o.customerName,
    customerEmail: o.customer_email ?? o.customerEmail,
    customerPhone: o.customer_phone ?? o.customerPhone,
    sessionId: o.session_id ?? o.sessionId,
    dbUrl: o.db_url ?? o.dbUrl,
    paystackReference: o.paystack_reference ?? o.paystackReference,
    deploymentNotes: o.deployment_notes ?? o.deploymentNotes,
    deploymentLog: o.deployment_log ?? o.deploymentLog,
    herokuAppName: o.render_service_id ?? o.herokuAppName,
    herokuAppUrl: o.render_service_url ?? o.herokuAppUrl,
    deployedAt: o.deployed_at ?? o.deployedAt,
    createdAt: o.created_at ?? o.createdAt,
    updatedAt: o.updated_at ?? o.updatedAt,
  };
}

function buildQuery(template: string, params: any[]): { query: string; params: any[] } {
  if (dbType === "pg") {
    let i = 1;
    const query = template.replace(/\?/g, () => `$${i++}`);
    return { query, params };
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

// ── Deploy bot to VPS via SSH + PM2 ─────────────────────────────────────────
async function deployBotToVps(
    order: Record<string, any>,
    bot: Record<string, any>,
    envVars: Record<string, string>
  ): Promise<{ pm2Name: string; vpsServerId: string } | null> {
    const servers = vpsManager.getAll();
    if (servers.length === 0) {
      console.log("[Bot Deploy] No VPS servers configured — skipping deploy");
      return null;
    }
    // Load-balance: pick VPS with fewest deployed bots
      const deployedCountRows = await q(
        `SELECT vps_server_id, COUNT(*) as cnt FROM bot_orders WHERE status = 'deployed' AND vps_server_id IS NOT NULL GROUP BY vps_server_id`
      ).catch(() => []);
      const deployedCounts: Record<string,number> = {};
      for (const row of deployedCountRows) deployedCounts[row.vps_server_id] = Number(row.cnt ?? 0);
      const server = servers.reduce((best: any, s: any) =>
        (deployedCounts[s.id] ?? 0) < (deployedCounts[best.id] ?? 0) ? s : best
      , servers[0]);
    const ref = order.reference;
    const pm2Name = `bot-${ref}`;
    const botDir = `/opt/bots/${pm2Name}`;
    const repoUrl = (bot.repo_url || bot.repoUrl || "").replace(/\.git$/, "");
    if (!repoUrl) throw new Error("Bot has no repoUrl configured");

    // Build .env content line by line
    const envLines = Object.entries(envVars)
      .map(([k, v]) => `${k}=${String(v).replace(/\r?\n/g, "\\n")}`)
      .join("\n");

    // Determine OS family from stored osType
    const osType = (server as any).osType || "ubuntu";
    const isRhel = ["almalinux","centos","rhel","fedora","rocky","oracle"].includes(osType);
    const isArch = osType === "arch";
    const isWindows = osType === "windows";
    const installGit = isRhel ? "dnf install -y git 2>/dev/null || yum install -y git 2>/dev/null"
                      : isArch ? "pacman -S --noconfirm git 2>/dev/null"
                      : isWindows ? "echo 'Windows — ensure git is pre-installed'"
                      : "DEBIAN_FRONTEND=noninteractive apt-get install -y git 2>/dev/null";
    const nvmSource = `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`;

    console.log(`[Bot Deploy] Deploying ${pm2Name} on ${server.host} (${osType})`);

    // 0. Ensure Node.js is installed (nvm works on all Linux; Windows needs pre-installed node)
    const nodeCheck = await vpsManager.execCommand(server,
      isWindows
        ? `node --version 2>nul || echo NOT_FOUND`
        : `node --version 2>/dev/null || echo "NOT_FOUND"`
    );
    if (nodeCheck.stdout.includes("NOT_FOUND") || !nodeCheck.stdout.trim().startsWith("v")) {
      console.log(`[Bot Deploy] Node.js not found — installing via nvm`);
      await vpsManager.execCommand(server,
        `curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && ` +
        `${nvmSource} && nvm install 20 && nvm alias default 20 && nvm use default && ` +
        `ln -sf $(which node) /usr/local/bin/node 2>/dev/null; ln -sf $(which npm) /usr/local/bin/npm 2>/dev/null; true`
      );
      console.log(`[Bot Deploy] ✓ Node.js installed`);
    }

    // 0b. Ensure PM2 is installed
    const pm2Check = await vpsManager.execCommand(server,
      isWindows ? `pm2 --version 2>nul || echo NOT_FOUND` : `pm2 --version 2>/dev/null || echo "NOT_FOUND"`
    );
    if (pm2Check.stdout.includes("NOT_FOUND")) {
      console.log(`[Bot Deploy] PM2 not found — installing`);
      await vpsManager.execCommand(server,
        `${nvmSource}; npm install -g pm2 && ln -sf $(which pm2) /usr/local/bin/pm2 2>/dev/null; true`
      );
      console.log(`[Bot Deploy] ✓ PM2 installed`);
    }

    // 1. Ensure git is available
    await vpsManager.execCommand(server,
      `which git 2>/dev/null || git --version 2>/dev/null || (${installGit}); echo "git ok"`
    );

    // 2. Clone or pull repo
    await vpsManager.execCommand(server,
      `mkdir -p /opt/bots && (git -C ${botDir} pull --ff-only 2>/dev/null || git clone ${repoUrl} ${botDir})`
    );
    console.log(`[Bot Deploy] ✓ Repo ready at ${botDir}`);

    // 3. Write .env file
    await vpsManager.execCommand(server,
      `printf '%s\\n' ${JSON.stringify(envLines)} > ${botDir}/.env`
    );
    console.log(`[Bot Deploy] ✓ .env written`);

    // 4. npm install
    const { stdout: installOut } = await vpsManager.execCommand(server,
      `${nvmSource}; cd ${botDir} && npm install --production 2>&1 | tail -5`
    );
    console.log(`[Bot Deploy] npm install: ${installOut.slice(0, 120)}`);

    // 5. Start with PM2
    await vpsManager.execCommand(server,
      `${nvmSource}; pm2 delete ${pm2Name} 2>/dev/null || true; ` +
      `cd ${botDir} && (pm2 start . --name ${pm2Name} 2>/dev/null || pm2 start index.js --name ${pm2Name}); pm2 save`
    );
    console.log(`[Bot Deploy] ✓ PM2 ${pm2Name} started`);

    return { pm2Name, vpsServerId: server.id };
  }

// Global lock — prevents the scheduler from running two instances at once
let autoDeployRunning = false;

// ── Exported: deploy ONE pending order per run (sequential, never parallel) ──
export async function deployPendingOrders(): Promise<void> {
  if (autoDeployRunning) {
    console.log("[Auto Deploy] Already running — skipping this tick");
    return;
  }
  autoDeployRunning = true;
  try {
    const servers = vpsManager.getAll();
    if (!servers.length) {
      console.log("[Auto Deploy] No VPS servers configured — skipping");
      return;
    }
    const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";

    // Only grab ONE pending order per run — avoids flooding the VPS
    const pending = await q(
      "SELECT * FROM bot_orders WHERE status IN ('paid', 'deploy_failed') AND (pm2_name IS NULL OR pm2_name = '') ORDER BY created_at ASC LIMIT 1"
    ).catch(() => []);
    if (!pending.length) { console.log("[Auto Deploy] No pending orders"); return; }

    const order = pending[0];
    console.log(`[Auto Deploy] Processing ${order.reference}`);

    const bots = await q("SELECT * FROM bots WHERE id = ?", [order.bot_id]).catch(() => []);
    if (!bots.length) { console.log(`[Auto Deploy] Bot not found for ${order.reference}`); return; }

    const autoEnv: Record<string, string> = { NODE_ENV: "production" };
    if (order.session_id) autoEnv["SESSION_ID"] = order.session_id;
    if (order.db_url) autoEnv["DB_URL"] = order.db_url;
    if (order.mode) autoEnv["MODE"] = order.mode;
    if (order.timezone) autoEnv["TIMEZONE"] = order.timezone;

    try {
      const result = await deployBotToVps(order, bots[0], autoEnv);
      if (result) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await m(
          `UPDATE bot_orders SET status = 'deployed', pm2_name = ?, vps_server_id = ?, deployed_at = ${updNow}, expires_at = ?, updated_at = ${updNow} WHERE id = ?`,
          [result.pm2Name, result.vpsServerId, expiresAt, order.id]
        );
        console.log(`[Auto Deploy] ✓ ${order.reference} → VPS ${result.vpsServerId}`);
      }
    } catch (e: any) {
      console.error(`[Auto Deploy] ✗ ${order.reference}:`, e.message);
      await m(`UPDATE bot_orders SET status = 'deploy_failed', deployment_notes = ?, updated_at = ${updNow} WHERE id = ?`,
        ["Auto-deploy failed: " + e.message.slice(0, 200), order.id]).catch(() => {});
    }
  } finally {
    autoDeployRunning = false;
  }
}

// Per-VPS deploy lock — prevents simultaneous npm install on the same server
const vpsDeployLock = new Set<string>();

export function registerBotRoutes(app: Express, adminAuthMiddleware: any) {

  // ── Public: validate promo code for bots ───────────────────────────────────
  app.post("/api/bots/promo/validate", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ valid: false, error: "Code required" });
      const result = promoManager.validate(code, undefined, "bot");
      if (!result.valid) return res.json({ valid: false, error: result.error });
      const promo = result.promo!;
      res.json({
        valid: true,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        label: promo.label,
        code: promo.code,
      });
    } catch (err: any) {
      res.status(500).json({ valid: false, error: err.message });
    }
  });

  // ── Public: list active bots ────────────────────────────────────────────────
  app.get("/api/bots", async (_req, res) => {
    try {
      const activeVal = dbType === "pg" ? true : 1;
      const rows = await q("SELECT * FROM bots WHERE active = ? ORDER BY created_at DESC", [activeVal]);
      res.json({ success: true, bots: rows.map(fmtBot) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Public: initialize bot order + Paystack payment ────────────────────────
  app.post("/api/bots/order/initialize", async (req, res) => {
    try {
      const { botId, customerName, customerEmail, customerPhone, sessionId, dbUrl, mode, timezone, promoCode } = req.body;
      if (!botId || !customerName || !customerEmail || !customerPhone) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }
      const bots = await q("SELECT * FROM bots WHERE id = ?", [parseInt(botId)]);
      if (!bots.length) return res.status(404).json({ success: false, error: "Bot not found" });
      const bot = bots[0];
      const reference = generateReference();

      // Apply promo discount
      let finalAmount = bot.price;
      let promoUsed: string | null = null;
      if (promoCode) {
        const pr = promoManager.validate(promoCode, undefined, "bot");
        if (pr.valid && pr.promo) {
          if (pr.promo.discountType === "percent") {
            finalAmount = Math.max(0, Math.round(bot.price * (1 - pr.promo.discountValue / 100)));
          } else {
            finalAmount = Math.max(0, bot.price - pr.promo.discountValue);
          }
          promoUsed = pr.promo.code;
        }
      }

      await m(
        "INSERT INTO bot_orders (reference, bot_id, bot_name, customer_name, customer_email, customer_phone, session_id, db_url, mode, timezone, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
        [reference, bot.id, bot.name, customerName, customerEmail, customerPhone, sessionId || null, dbUrl || null, mode || "public", timezone || "Africa/Nairobi", finalAmount]
      );

      const secretKey = getPaystackSecretKey();
      if (!secretKey) {
        return res.json({ success: true, reference, amount: bot.price, paystackConfigured: false });
      }

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customerEmail, amount: bot.price * 100, currency: "KES", reference,
          metadata: { botId: bot.id, botName: bot.name, customerName, customerPhone },
        }),
      });
      const paystackData = await paystackRes.json() as any;
      if (promoUsed) promoManager.use(promoUsed);
      res.json({
        success: true, reference, amount: finalAmount, originalAmount: bot.price,
        promoApplied: promoUsed,
        authorizationUrl: paystackData.data?.authorization_url,
        paystackConfigured: true, paystackPublicKey: getPaystackPublicKey(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Public: verify Paystack payment + auto-deploy ───────────────────────────
  app.post("/api/bots/order/verify", async (req, res) => {
    try {
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ success: false, error: "Reference required" });

      const orders = await q("SELECT * FROM bot_orders WHERE reference = ?", [reference]);
      if (!orders.length) return res.status(404).json({ success: false, error: "Order not found" });
      const order = orders[0];

      if (order.status !== "pending") return res.json({ success: true, order: fmtOrder(order) });

      const secretKey = getPaystackSecretKey();
      let paymentOk = false;

      if (!secretKey) {
        paymentOk = true;
      } else {
        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          headers: { Authorization: `Bearer ${secretKey}` },
        });
        const data = await verifyRes.json() as any;
        paymentOk = data.data?.status === "success";
        if (!paymentOk) {
          return res.status(400).json({ success: false, error: "Payment not confirmed", paystackStatus: data.data?.status });
        }
      }

      const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
      await m(`UPDATE bot_orders SET status = 'paid', paystack_reference = ?, updated_at = ${updNow} WHERE reference = ?`, [reference, reference]);

      const updated = await q("SELECT * FROM bot_orders WHERE reference = ?", [reference]);
      const paidOrder = updated[0];
      res.json({ success: true, order: fmtOrder(paidOrder) });

      // Auto-deploy to VPS immediately after payment (non-blocking)
      const bots = await q("SELECT * FROM bots WHERE id = ?", [paidOrder.bot_id]).catch(() => []);
      if (bots.length) {
        const autoEnv: Record<string, string> = { NODE_ENV: "production" };
        if (paidOrder.session_id) autoEnv["SESSION_ID"] = paidOrder.session_id;
        if (paidOrder.db_url) autoEnv["DB_URL"] = paidOrder.db_url;
        if (paidOrder.mode) autoEnv["MODE"] = paidOrder.mode;
        if (paidOrder.timezone) autoEnv["TIMEZONE"] = paidOrder.timezone;
        deployBotToVps(paidOrder, bots[0], autoEnv).then(async (result) => {
          if (result) {
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await m(
              `UPDATE bot_orders SET status = 'deployed', pm2_name = ?, vps_server_id = ?, deployed_at = ${updNow}, expires_at = ?, updated_at = ${updNow} WHERE reference = ?`,
              [result.pm2Name, result.vpsServerId, expiresAt, reference]
            );
            console.log(`[Auto Deploy] ✓ ${reference} deployed — ${result.pm2Name}`);
          } else {
            console.log(`[Auto Deploy] No VPS available for ${reference}`);
          }
        }).catch((e: any) => {
          console.error(`[Auto Deploy] ✗ ${reference}:`, e.message);
          m(`UPDATE bot_orders SET status = 'deploy_failed', deployment_notes = ?, updated_at = ${updNow} WHERE reference = ?`,
            ["Auto-deploy failed: " + e.message.slice(0, 200), reference]).catch(() => {});
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Wallet pay + auto-deploy ────────────────────────────────────────────────
  app.post("/api/bots/order/wallet-pay", async (req: any, res) => {
    try {
      const { botId, customerName, customerEmail, customerPhone, sessionId, dbUrl, mode, timezone, promoCode: walletPromoCode } = req.body;
      const token = ((req.headers.authorization as string) || "").replace("Bearer ", "").trim();
      if (!token) return res.status(401).json({ success: false, error: "Not authenticated" });
      if (!botId || !customerName || !customerEmail || !customerPhone) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      const now = new Date().toISOString();
      const sessions = await q(
        "SELECT customer_id FROM customer_sessions WHERE token = ? AND expires_at > ? LIMIT 1",
        [token, now]
      );
      if (!sessions.length) return res.status(401).json({ success: false, error: "Session expired or invalid" });
      const customerId = sessions[0].customer_id;

      const bots = await q("SELECT * FROM bots WHERE id = ?", [parseInt(botId)]);
      if (!bots.length) return res.status(404).json({ success: false, error: "Bot not found" });
      const bot = bots[0];

      const wallets = await q("SELECT balance FROM wallets WHERE customer_id = ?", [customerId]);
      const walletBalance = wallets.length ? Number(wallets[0].balance) : 0;

      // Apply promo discount for wallet pay
      let walletFinalAmount = bot.price;
      let walletPromoUsed: string | null = null;
      if (walletPromoCode) {
        const pr = promoManager.validate(walletPromoCode, undefined, "bot");
        if (pr.valid && pr.promo) {
          if (pr.promo.discountType === "percent") {
            walletFinalAmount = Math.max(0, Math.round(bot.price * (1 - pr.promo.discountValue / 100)));
          } else {
            walletFinalAmount = Math.max(0, bot.price - pr.promo.discountValue);
          }
          walletPromoUsed = pr.promo.code;
        }
      }

      if (walletBalance < walletFinalAmount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient wallet balance. You have KES ${walletBalance}, need KES ${walletFinalAmount}.`,
        });
      }

      const reference = generateReference();
      const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";

      await m(`UPDATE wallets SET balance = balance - ?, updated_at = ${updNow} WHERE customer_id = ?`, [walletFinalAmount, customerId]);
      await m(
        "INSERT INTO wallet_transactions (customer_id, type, amount, description, reference) VALUES (?, 'debit', ?, ?, ?)",
        [customerId, walletFinalAmount, `Bot deployment: ${bot.name}${walletPromoUsed ? ` [${walletPromoUsed}]` : ""}`, reference]
      );
      if (walletPromoUsed) promoManager.use(walletPromoUsed);
      await m(
        "INSERT INTO bot_orders (reference, bot_id, bot_name, customer_name, customer_email, customer_phone, session_id, db_url, mode, timezone, amount, status, paystack_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'wallet')",
        [reference, bot.id, bot.name, customerName, customerEmail, customerPhone, sessionId || null, dbUrl || null, mode || "public", timezone || "Africa/Nairobi", walletFinalAmount]
      );

      const created = await q("SELECT * FROM bot_orders WHERE reference = ?", [reference]);
      const walletOrder = created[0];
      res.json({ success: true, reference, order: fmtOrder(walletOrder) });

      // Auto-deploy to VPS immediately after wallet payment (non-blocking)
      const autoEnvW: Record<string, string> = { NODE_ENV: "production" };
      if (sessionId) autoEnvW["SESSION_ID"] = sessionId;
      if (dbUrl) autoEnvW["DB_URL"] = dbUrl;
      if (mode) autoEnvW["MODE"] = mode;
      if (timezone) autoEnvW["TIMEZONE"] = timezone;
      deployBotToVps(walletOrder, bot, autoEnvW).then(async (result) => {
        if (result) {
          const updNowW = dbType === "pg" ? "NOW()::text" : "datetime('now')";
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await m(
            `UPDATE bot_orders SET status = 'deployed', pm2_name = ?, vps_server_id = ?, deployed_at = ${updNowW}, expires_at = ?, updated_at = ${updNowW} WHERE reference = ?`,
            [result.pm2Name, result.vpsServerId, expiresAt, reference]
          );
          console.log(`[Auto Deploy] ✓ ${reference} deployed — ${result.pm2Name}`);
        } else {
          console.log(`[Auto Deploy] No VPS available for ${reference}`);
        }
      }).catch((e: any) => {
        console.error(`[Auto Deploy] ✗ ${reference}:`, e.message);
        const updNowW = dbType === "pg" ? "NOW()::text" : "datetime('now')";
        m(`UPDATE bot_orders SET status = 'deploy_failed', deployment_notes = ?, updated_at = ${updNowW} WHERE reference = ?`,
          ["Auto-deploy failed: " + e.message.slice(0, 200), reference]).catch(() => {});
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Public: get order by reference ─────────────────────────────────────────
  app.get("/api/bots/order/:reference", async (req, res) => {
    try {
      const rows = await q("SELECT * FROM bot_orders WHERE reference = ?", [req.params.reference]);
      if (!rows.length) return res.status(404).json({ success: false, error: "Order not found" });
      res.json({ success: true, order: fmtOrder(rows[0]) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Public: get single bot by ID ────────────────────────────────────────────
  app.get("/api/bots/:botId", async (req, res) => {
    try {
      const id = parseInt(req.params.botId);
      if (isNaN(id)) return res.status(404).json({ success: false, error: "Bot not found" });
      const rows = await q("SELECT * FROM bots WHERE id = ?", [id]);
      if (!rows.length) return res.status(404).json({ success: false, error: "Bot not found" });
      res.json({ success: true, bot: fmtBot(rows[0]) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Admin: list all bots ────────────────────────────────────────────────────
  app.get("/api/admin/bots", adminAuthMiddleware, async (_req, res) => {
    try {
      const rows = await q("SELECT * FROM bots ORDER BY created_at DESC", []);
      res.json({ success: true, bots: rows.map(fmtBot) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Admin: create bot ───────────────────────────────────────────────────────
  app.post("/api/admin/bots", adminAuthMiddleware, async (req, res) => {
    try {
      const { name, description, repoUrl, imageUrl, price, features, requiresSessionId, requiresDbUrl, category } = req.body;
      if (!name || !description || !repoUrl) return res.status(400).json({ success: false, error: "Missing fields" });
      const reqSession = dbType === "pg" ? (requiresSessionId !== false) : (requiresSessionId !== false ? 1 : 0);
      const reqDb = dbType === "pg" ? !!requiresDbUrl : (requiresDbUrl ? 1 : 0);
      const activeVal = dbType === "pg" ? true : 1;
      await m(
        "INSERT INTO bots (name, description, repo_url, image_url, price, features, requires_session_id, requires_db_url, active, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [name, description, repoUrl, imageUrl || null, price || 70, JSON.stringify(features || []), reqSession, reqDb, activeVal, category || "general"]
      );
      const rows = await q("SELECT * FROM bots ORDER BY id DESC LIMIT 1", []);
      res.json({ success: true, bot: fmtBot(rows[0]) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Admin: update bot ───────────────────────────────────────────────────────
  app.put("/api/admin/bots/:botId", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.botId);
      const { name, description, repoUrl, imageUrl, price, features, requiresSessionId, requiresDbUrl, active, category } = req.body;
      const sets: string[] = [];
      const vals: any[] = [];
      if (name !== undefined) { sets.push("name = ?"); vals.push(name); }
      if (description !== undefined) { sets.push("description = ?"); vals.push(description); }
      if (repoUrl !== undefined) { sets.push("repo_url = ?"); vals.push(repoUrl); }
      if (imageUrl !== undefined) { sets.push("image_url = ?"); vals.push(imageUrl); }
      if (price !== undefined) { sets.push("price = ?"); vals.push(price); }
      if (features !== undefined) { sets.push("features = ?"); vals.push(JSON.stringify(features)); }
      if (requiresSessionId !== undefined) { sets.push("requires_session_id = ?"); vals.push(dbType === "pg" ? requiresSessionId : (requiresSessionId ? 1 : 0)); }
      if (requiresDbUrl !== undefined) { sets.push("requires_db_url = ?"); vals.push(dbType === "pg" ? requiresDbUrl : (requiresDbUrl ? 1 : 0)); }
      if (active !== undefined) { sets.push("active = ?"); vals.push(dbType === "pg" ? active : (active ? 1 : 0)); }
      if (category !== undefined) { sets.push("category = ?"); vals.push(category); }
      if (!sets.length) return res.status(400).json({ success: false, error: "No fields to update" });
      vals.push(id);
      await m(`UPDATE bots SET ${sets.join(", ")} WHERE id = ?`, vals);
      const rows = await q("SELECT * FROM bots WHERE id = ?", [id]);
      res.json({ success: true, bot: fmtBot(rows[0]) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Admin: delete bot ───────────────────────────────────────────────────────
  app.delete("/api/admin/bots/:botId", adminAuthMiddleware, async (req, res) => {
    try {
      await m("DELETE FROM bots WHERE id = ?", [parseInt(req.params.botId)]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Admin: list all bot orders ──────────────────────────────────────────────
  app.get("/api/admin/bot-orders", adminAuthMiddleware, async (req, res) => {
    try {
      // Auto-reset orders stuck in 'deploying' for > 5 minutes (Render redeployed mid-deploy)
      const stuckCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const updN = dbType === "pg" ? "NOW()::text" : "datetime('now')";
      await m(
        `UPDATE bot_orders SET status = 'deploy_failed', deployment_notes = 'Auto-reset: deployment process was interrupted', updated_at = ${updN} WHERE status = 'deploying' AND updated_at < ?`,
        [stuckCutoff]
      ).catch(() => {});

      const { status } = req.query;
      let rows: any[];
      if (status && typeof status === "string") {
        rows = await q("SELECT * FROM bot_orders WHERE status = ? ORDER BY created_at DESC", [status]);
      } else {
        rows = await q("SELECT * FROM bot_orders ORDER BY created_at DESC", []);
      }
      const allVps = vpsManager.getAll();
      const orders = rows.map(fmtOrder).map((o: any) => {
        const vps = allVps.find((s: any) => s.id === (o.vpsServerId ?? o.vps_server_id));
        return { ...o, vpsLabel: vps?.label ?? null };
      });
      res.json({ success: true, orders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Admin: update bot order status + manual redeploy ───────────────────────
  app.patch("/api/admin/bot-orders/:orderId/status", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.orderId);
      const { status, deploymentNotes, redeploy } = req.body;
      const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
      await m(
        `UPDATE bot_orders SET status = ?, deployment_notes = ?, updated_at = ${updNow} WHERE id = ?`,
        [status, deploymentNotes || null, id]
      );
      const rows = await q("SELECT * FROM bot_orders WHERE id = ?", [id]);
      const order = rows[0];


      // Manual redeploy via VPS/PM2 (non-blocking)
        if (redeploy && order) {
          const bots = await q("SELECT * FROM bots WHERE id = ?", [order.bot_id]);
          if (bots.length) {
            const envVars = JSON.parse(order.env_vars || "{}");
            deployBotToVps(order, bots[0], envVars).then(async (result) => {
              if (result) {
                const expiresAtAdmin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                await m(
                  `UPDATE bot_orders SET status = 'deployed', pm2_name = ?, vps_server_id = ?, deployed_at = ${updNow}, expires_at = ?, updated_at = ${updNow} WHERE id = ?`,
                  [result.pm2Name, result.vpsServerId, expiresAtAdmin, id]
                );
              }
            }).catch(async (e: any) => {
              await m(
                `UPDATE bot_orders SET status = 'deploy_failed', deployment_notes = ?, updated_at = ${updNow} WHERE id = ?`,
                ["VPS redeploy failed: " + e.message.slice(0, 200), id]
              );
            });
          }
        }


      res.json({ success: true, order: fmtOrder(order) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });



    // ── Admin: VPS bot status (PM2) ─────────────────────────────────────────────
    app.get("/api/admin/bot-orders/:orderId/vps-status", adminAuthMiddleware, async (req, res) => {
      try {
        const id = parseInt(req.params.orderId);
        const rows = await q("SELECT * FROM bot_orders WHERE id = ?", [id]);
        if (!rows.length) return res.status(404).json({ success: false, error: "Order not found" });
        const order = rows[0];
        const pm2Name = order.pm2_name;
        if (!pm2Name) return res.json({ success: true, deployed: false, message: "Not yet deployed to VPS" });
        const servers = vpsManager.getAll();
        if (!servers.length) return res.json({ success: true, deployed: true, status: order.status, message: "No VPS configured" });
        const server = servers.find((s: any) => s.id === order.vps_server_id) ?? servers[0];
        try {
          const { stdout } = await vpsManager.execCommand(server, `pm2 describe ${pm2Name} 2>&1 || echo 'NOT_FOUND'`);
          const running = stdout.includes("online");
          const stopped = stdout.includes("stopped");
          const pm2Status = running ? "online" : stopped ? "stopped" : "unknown";
          res.json({ success: true, deployed: true, status: order.status, pm2Name, pm2Status, raw: stdout.slice(0, 500) });
        } catch (e: any) {
          res.json({ success: true, deployed: true, status: order.status, pm2Name, pm2Status: "unknown", error: e.message });
        }
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });

    // Admin VPS helper: get pm2Name + server for an order
    async function getOrderVps(orderId: number) {
      const rows = await q("SELECT * FROM bot_orders WHERE id = ?", [orderId]);
      if (!rows.length) return null;
      const order = rows[0];
      const servers = vpsManager.getAll();
      if (!order.pm2_name || !servers.length) return null;
      const server = servers.find((s: any) => s.id === order.vps_server_id) ?? servers[0];
      return { order, server, pm2Name: order.pm2_name as string };
    }

    // Reboot: pm2 restart with fallback to pm2 start for failed/stopped bots
    app.post("/api/admin/bot-orders/:orderId/vps/reboot", adminAuthMiddleware, async (req, res) => {
      try {
        const id = parseInt(req.params.orderId);
        const info = await getOrderVps(id);
        if (!info) return res.status(404).json({ success: false, error: "No VPS process linked to this order" });
        const botDir = `/home/bots/${info.pm2Name}`;
        const nvmSource = `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`;
        const smartRestart = `${nvmSource}; pm2 restart ${info.pm2Name} 2>/dev/null || (cd ${botDir} && (pm2 start . --name ${info.pm2Name} 2>/dev/null || pm2 start index.js --name ${info.pm2Name}) && pm2 save)`;
        await vpsManager.execCommand(info.server, smartRestart);
        const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
        await m(`UPDATE bot_orders SET status = 'deployed', updated_at = ${updNow} WHERE id = ?`, [id]);
        res.json({ success: true, message: "Bot restarted" });
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });

    // Live logs: tail pm2 logs for a bot
    app.get("/api/admin/bot-orders/:orderId/live-logs", adminAuthMiddleware, async (req, res) => {
      try {
        const info = await getOrderVps(parseInt(req.params.orderId));
        if (!info) return res.status(404).json({ success: false, error: "No VPS process linked" });
        const lines = Math.min(parseInt((req.query.lines as string) || "150"), 500);
        const nvmSource = `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`;
        const { stdout } = await vpsManager.execCommand(
          info.server,
          `${nvmSource}; pm2 logs ${info.pm2Name} --lines ${lines} --nostream --raw 2>&1 | tail -${lines}`,
          20000
        );
        const logLines = stdout.split("\n").filter(Boolean);
        res.json({ success: true, logs: logLines, pm2Name: info.pm2Name });
      } catch (e: any) {
        res.json({ success: false, error: e.message, logs: [] });
      }
    });

    // Stop: pm2 stop
    app.post("/api/admin/bot-orders/:orderId/vps/stop", adminAuthMiddleware, async (req, res) => {
      try {
        const id = parseInt(req.params.orderId);
        const info = await getOrderVps(id);
        if (!info) return res.status(404).json({ success: false, error: "No VPS process linked to this order" });
        await vpsManager.execCommand(info.server, `pm2 stop ${info.pm2Name}`);
        const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
        await m(`UPDATE bot_orders SET status = 'stopped', updated_at = ${updNow} WHERE id = ?`, [id]);
        res.json({ success: true, message: "Bot stopped" });
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });

    // Resume: pm2 start
    app.post("/api/admin/bot-orders/:orderId/vps/resume", adminAuthMiddleware, async (req, res) => {
      try {
        const id = parseInt(req.params.orderId);
        const info = await getOrderVps(id);
        if (!info) return res.status(404).json({ success: false, error: "No VPS process linked to this order" });
        await vpsManager.execCommand(info.server, `pm2 start ${info.pm2Name}`);
        const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
        await m(`UPDATE bot_orders SET status = 'deployed', updated_at = ${updNow} WHERE id = ?`, [id]);
        res.json({ success: true, message: "Bot resumed" });
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });

    // Get .env (config vars)
    app.get("/api/admin/bot-orders/:orderId/vps/config-vars", adminAuthMiddleware, async (req, res) => {
      try {
        const info = await getOrderVps(parseInt(req.params.orderId));
        if (!info) return res.status(404).json({ success: false, error: "No VPS process linked to this order" });
        const botDir = `/opt/bots/${info.pm2Name}`;
        const { stdout } = await vpsManager.execCommand(info.server, `cat ${botDir}/.env 2>/dev/null || echo ''`);
        const configVars: Record<string, string> = {};
        stdout.split("\n").forEach(line => {
          const eq = line.indexOf("=");
          if (eq > 0) configVars[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        });
        res.json({ success: true, configVars });
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });

    // Update .env (config vars) and restart
    app.patch("/api/admin/bot-orders/:orderId/vps/config-vars", adminAuthMiddleware, async (req, res) => {
      try {
        const info = await getOrderVps(parseInt(req.params.orderId));
        if (!info) return res.status(404).json({ success: false, error: "No VPS process linked to this order" });
        const { configVars } = req.body as { configVars: Record<string, string> };
        const botDir = `/opt/bots/${info.pm2Name}`;
        const envLines = Object.entries(configVars)
          .map(([k, v]) => `${k}=${String(v).replace(/\r?\n/g, "\\n")}`)
          .join("\n");
        await vpsManager.execCommand(info.server, `printf '%s\n' ${JSON.stringify(envLines)} > ${botDir}/.env`);
        await vpsManager.execCommand(info.server, `pm2 restart ${info.pm2Name}`);
        const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
        await m(`UPDATE bot_orders SET env_vars = ?, updated_at = ${updNow} WHERE id = ?`, [JSON.stringify(configVars), info.order.id]);
        res.json({ success: true, message: "Config updated and bot restarted" });
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });

    // ── Public: fetch .env.example template for a bot ───────────────────────────
    app.get("/api/bots/env-template/:botId", async (req, res) => {
      try {
        const botId = parseInt(req.params.botId);
        const bots = await q("SELECT * FROM bots WHERE id = ?", [botId]);
        if (!bots.length) return res.status(404).json({ success: false, error: "Bot not found" });
        const repoUrl = (bots[0].repo_url || bots[0].repoUrl || "").replace(/\.git$/, "").replace(/\/$/, "");
        if (!repoUrl) return res.json({ success: true, vars: [] });
        const rawBase = repoUrl.replace("https://github.com/", "https://raw.githubusercontent.com/") + "/HEAD/.env.example";
        const r = await fetch(rawBase);
        if (!r.ok) return res.json({ success: true, vars: [] });
        const text = await r.text();
        const vars: Array<{ key: string; defaultValue: string; required: boolean }> = [];
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq < 0) continue;
          const key = trimmed.slice(0, eq).trim();
          const defaultValue = trimmed.slice(eq + 1).trim();
          vars.push({ key, defaultValue, required: defaultValue === "" });
        }
        res.json({ success: true, vars });
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });

    // ── Public: customer submits env vars and triggers deploy ───────────────────
    app.post("/api/bots/order/:reference/configure", async (req, res) => {
      try {
        const { reference } = req.params;
        const { envVars } = req.body as { envVars: Record<string, string> };
        if (!envVars || typeof envVars !== "object") {
          return res.status(400).json({ success: false, error: "envVars object required" });
        }
        const rows = await q("SELECT * FROM bot_orders WHERE reference = ?", [reference]);
        if (!rows.length) return res.status(404).json({ success: false, error: "Order not found" });
        const order = rows[0];
        if (!["paid", "deploy_failed", "configuring"].includes(order.status)) {
          return res.status(400).json({ success: false, error: `Order status '${order.status}' cannot be configured` });
        }
        const bots = await q("SELECT * FROM bots WHERE id = ?", [order.bot_id]);
        if (!bots.length) return res.status(404).json({ success: false, error: "Bot not found" });

        const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
        await m(
          `UPDATE bot_orders SET status = 'configuring', env_vars = ?, updated_at = ${updNow} WHERE reference = ?`,
          [JSON.stringify(envVars), reference]
        );

        const freshOrder = (await q("SELECT * FROM bot_orders WHERE reference = ?", [reference]))[0];
        deployBotToVps(freshOrder, bots[0], envVars).then(async (result) => {
          if (result) {
            await m(
              `UPDATE bot_orders SET status = 'deployed', pm2_name = ?, vps_server_id = ?, deployed_at = ${updNow}, expires_at = ?, renewal_reminded = NULL, updated_at = ${updNow} WHERE reference = ?`,
              [result.pm2Name, result.vpsServerId, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), reference]
            );
            console.log(`[Bot Deploy] ✓ Order ${reference} deployed — PM2 ${result.pm2Name}`);
          } else {
            await m(
              `UPDATE bot_orders SET status = 'deploy_failed', deployment_notes = ?, updated_at = ${updNow} WHERE reference = ?`,
              ["No VPS servers configured", reference]
            );
          }
        }).catch(async (e: any) => {
          console.error("[Bot Deploy] ✗ Configure deploy failed:", e.message);
          await m(
            `UPDATE bot_orders SET status = 'deploy_failed', deployment_notes = ?, updated_at = ${updNow} WHERE reference = ?`,
            ["VPS deploy failed: " + e.message.slice(0, 200), reference]
          );
        });

        res.json({ success: true, message: "Configuration saved, deploying now" });
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });


    // ═══════════════════════════════════════════════════════════════════════
    // ── CUSTOMER bot management (own bots only, VPS/PM2) ──────────────────
    // ═══════════════════════════════════════════════════════════════════════
    async function getOwnedBotOrder(req: any, orderId: number) {
      if (!req.customer?.email) return null;
      const rows = await q("SELECT * FROM bot_orders WHERE id = ? AND customer_email = ?", [orderId, req.customer.email]);
      return rows[0] || null;
    }

    async function getCustomerVps(req: any, orderId: number) {
      const order = await getOwnedBotOrder(req, orderId);
      if (!order) return null;
      const servers = vpsManager.getAll();
      if (!order.pm2_name || !servers.length) return { order, server: null as any, pm2Name: null as string | null };
      const server = servers.find((s: any) => s.id === order.vps_server_id) ?? servers[0];
      return { order, server, pm2Name: order.pm2_name as string };
    }

    // Get PM2 status for an owned bot
    app.get("/api/customer/bots/:orderId/status", customerAuthMiddleware, async (req: any, res) => {
      try {
        const info = await getCustomerVps(req, parseInt(req.params.orderId));
        if (!info) return res.status(404).json({ success: false, error: "Bot not found or not yours" });
        if (!info.pm2Name || !info.server) {
          return res.json({ success: true, deployed: false, status: info.order.status, message: "Not yet deployed" });
        }
        try {
          const { stdout } = await vpsManager.execCommand(info.server, `pm2 describe ${info.pm2Name} 2>&1 || echo 'NOT_FOUND'`);
          const pm2Status = stdout.includes("online") ? "online" : stdout.includes("stopped") ? "stopped" : "unknown";
          res.json({ success: true, deployed: true, status: info.order.status, pm2Name: info.pm2Name, pm2Status });
        } catch (e: any) {
          res.json({ success: true, deployed: true, status: info.order.status, pm2Name: info.pm2Name, pm2Status: "unknown", error: e.message });
        }
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });

    // Tail PM2 logs for an owned bot
    app.get("/api/customer/bots/:orderId/logs", customerAuthMiddleware, async (req: any, res) => {
      try {
        const info = await getCustomerVps(req, parseInt(req.params.orderId));
        if (!info) return res.status(404).json({ success: false, error: "Bot not found or not yours" });
        if (!info.pm2Name || !info.server) {
          return res.json({ success: true, logs: "Bot is not yet deployed.", lines: [] });
        }
        try {
          const { stdout } = await vpsManager.execCommand(info.server,
            `pm2 logs ${info.pm2Name} --lines 200 --nostream --raw 2>&1 | tail -200`
          );
          const logLines = stdout.split("\n").filter(Boolean).slice(-200);
          res.json({ success: true, logs: logLines.join("\n"), lines: logLines });
        } catch (e: any) {
          res.json({ success: true, logs: `Failed to fetch logs: ${e.message}`, lines: [] });
        }
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });

    // Restart owned bot
    app.post("/api/customer/bots/:orderId/restart", customerAuthMiddleware, async (req: any, res) => {
      try {
        const info = await getCustomerVps(req, parseInt(req.params.orderId));
        if (!info) return res.status(404).json({ success: false, error: "Bot not found or not yours" });
        if (!info.pm2Name || !info.server) return res.status(400).json({ success: false, error: "Bot is not yet deployed" });
        await vpsManager.execCommand(info.server, `pm2 restart ${info.pm2Name}`);
        res.json({ success: true, message: "Bot restarted" });
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });

    // Stop owned bot
    app.post("/api/customer/bots/:orderId/stop", customerAuthMiddleware, async (req: any, res) => {
      try {
        const id = parseInt(req.params.orderId);
        const info = await getCustomerVps(req, id);
        if (!info) return res.status(404).json({ success: false, error: "Bot not found or not yours" });
        if (!info.pm2Name || !info.server) return res.status(400).json({ success: false, error: "Bot is not yet deployed" });
        await vpsManager.execCommand(info.server, `pm2 stop ${info.pm2Name}`);
        const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
        await m(`UPDATE bot_orders SET status = 'stopped', updated_at = ${updNow} WHERE id = ?`, [id]);
        res.json({ success: true, message: "Bot stopped" });
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });

    // Start owned bot
    app.post("/api/customer/bots/:orderId/start", customerAuthMiddleware, async (req: any, res) => {
      try {
        const id = parseInt(req.params.orderId);
        const info = await getCustomerVps(req, id);
        if (!info) return res.status(404).json({ success: false, error: "Bot not found or not yours" });
        if (!info.pm2Name || !info.server) return res.status(400).json({ success: false, error: "Bot is not yet deployed" });
        await vpsManager.execCommand(info.server, `pm2 start ${info.pm2Name}`);
        const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
        await m(`UPDATE bot_orders SET status = 'deployed', updated_at = ${updNow} WHERE id = ?`, [id]);
        res.json({ success: true, message: "Bot started" });
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });

    // Customer self-deploy: trigger deploy for a paid/failed order they own
    app.post("/api/customer/bots/:orderId/self-deploy", customerAuthMiddleware, async (req: any, res) => {
      try {
        const id = parseInt(req.params.orderId);
        const order = await getOwnedBotOrder(req, id);
        if (!order) return res.status(404).json({ success: false, error: "Order not found or not yours" });
        if (!["paid", "deploy_failed", "stopped"].includes(order.status)) {
          return res.status(400).json({ success: false, error: `Cannot deploy order with status '${order.status}'` });
        }
        const bots = await q("SELECT * FROM bots WHERE id = ?", [order.bot_id]);
        if (!bots.length) return res.status(404).json({ success: false, error: "Bot configuration not found" });
        const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
        await m(`UPDATE bot_orders SET status = 'deploying', updated_at = ${updNow} WHERE id = ?`, [id]);
        // Fire-and-forget — deploy runs in background
        const envVars: Record<string, string> = {};
        try { Object.assign(envVars, JSON.parse(order.env_vars || "{}")); } catch {}
        deployBotToVps(order, bots[0], envVars).then(async (result) => {
          const updN2 = dbType === "pg" ? "NOW()::text" : "datetime('now')";
          if (result) {
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await m(
              `UPDATE bot_orders SET status = 'deployed', pm2_name = ?, vps_server_id = ?, deployed_at = ${updN2}, expires_at = ?, updated_at = ${updN2} WHERE id = ?`,
              [result.pm2Name, result.vpsServerId, expiresAt, id]
            );
          } else {
            await m(`UPDATE bot_orders SET status = 'deploy_failed', deployment_notes = 'Self-deploy failed — no VPS available', updated_at = ${updN2} WHERE id = ?`, [id]);
          }
        }).catch(async (e: any) => {
          const updN3 = dbType === "pg" ? "NOW()::text" : "datetime('now')";
          await m(`UPDATE bot_orders SET status = 'deploy_failed', deployment_notes = ?, updated_at = ${updN3} WHERE id = ?`, [e.message?.slice(0, 200) || "Unknown error", id]);
        });
        res.json({ success: true, message: "Deployment started — this usually takes 1-3 minutes." });
      } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
    });
  



      // ─── Customer: Read env vars ─────────────────────────────────────────────
      app.get("/api/customer/bots/:orderId/env-vars", customerAuthMiddleware, async (req: any, res) => {
        try {
          const customerId = req.customer.id;
          const orderId = parseInt(req.params.orderId);
          const rows = await q("SELECT * FROM bot_orders WHERE id = ? AND customer_id = ?", [orderId, customerId]);
          if (!rows.length) return res.status(404).json({ success: false, error: "Order not found" });
          const order = rows[0];
          const envVars: Record<string,string> = order.env_vars ? JSON.parse(order.env_vars) : {};
          return res.json({ success: true, envVars });
        } catch (e: any) {
          return res.status(500).json({ success: false, error: e.message });
        }
      });

      // ─── Customer: Update env vars + restart bot ────────────────────────────
      app.patch("/api/customer/bots/:orderId/env-vars", customerAuthMiddleware, async (req: any, res) => {
        try {
          const customerId = req.customer.id;
          const orderId = parseInt(req.params.orderId);
          const { envVars } = req.body as { envVars: Record<string, string> };
          if (!envVars || typeof envVars !== "object") {
            return res.status(400).json({ success: false, error: "envVars object required" });
          }
          const rows = await q("SELECT * FROM bot_orders WHERE id = ? AND customer_id = ?", [orderId, customerId]);
          if (!rows.length) return res.status(404).json({ success: false, error: "Order not found" });
          const order = rows[0];
          if (!order.pm2_name || !order.vps_server_id) {
            return res.status(400).json({ success: false, error: "Bot not deployed yet" });
          }
          const servers = vpsManager.getAll();
          const server = servers.find((s: any) => s.id === order.vps_server_id);
          if (!server) return res.status(404).json({ success: false, error: "VPS server not found" });

          // Write new .env to VPS
          const envLines = Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join("\n");
          const botDir = `/opt/bots/bot-${order.reference}`;
          const escapedEnv = envLines.replace(/'/g, "'\''");
          await vpsManager.execCommand(server, `printf '%s\n' '${escapedEnv}' > ${botDir}/.env && pm2 restart ${order.pm2_name} --update-env`);

          const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
          await m(
            `UPDATE bot_orders SET env_vars = ?, updated_at = ${updNow} WHERE id = ?`,
            [JSON.stringify(envVars), orderId]
          );
          return res.json({ success: true, message: "Env vars updated and bot restarted" });
        } catch (e: any) {
          return res.status(500).json({ success: false, error: e.message });
        }
      });

      // ─── Customer: 7-day uptime history ─────────────────────────────────────
      app.get("/api/customer/bots/:orderId/uptime", customerAuthMiddleware, async (req: any, res) => {
        try {
          const orderId = parseInt(req.params.orderId);
          const customerId = req.customer.id;
          const rows = await q("SELECT * FROM bot_orders WHERE id = ? AND customer_id = ?", [orderId, customerId]);
          if (!rows.length) return res.status(404).json({ success: false, error: "Order not found" });
          const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const pings = await q(
            "SELECT pm2_status, checked_at FROM bot_pings WHERE bot_order_id = ? AND checked_at >= ? ORDER BY checked_at ASC",
            [orderId, since]
          );
          return res.json({ success: true, pings });
        } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
      });

      // ─── Customer: Mini terminal ─────────────────────────────────────────────
      app.post("/api/customer/bots/:orderId/terminal", customerAuthMiddleware, async (req: any, res) => {
        try {
          const orderId = parseInt(req.params.orderId);
          const customerId = req.customer.id;
          const { command } = req.body as { command: string };
          if (!command || typeof command !== "string") return res.status(400).json({ success: false, error: "command required" });
          const trimmed = command.trim();
          const allowed = ["pm2 logs", "pm2 status", "pm2 list", "pm2 describe", "pm2 restart", "pm2 stop", "pm2 start", "ls", "cat .env", "tail", "node -v", "npm -v", "git log"];
          if (!allowed.some(p => trimmed.startsWith(p))) {
            return res.status(403).json({ success: false, error: "Command not allowed. Permitted: " + allowed.join(", ") });
          }
          const rows = await q("SELECT * FROM bot_orders WHERE id = ? AND customer_id = ?", [orderId, customerId]);
          if (!rows.length) return res.status(404).json({ success: false, error: "Order not found" });
          const order = rows[0];
          if (!order.pm2_name || !order.vps_server_id) return res.status(400).json({ success: false, error: "Bot not deployed yet" });
          const svrs = vpsManager.getAll();
          const svr = svrs.find((s: any) => s.id === order.vps_server_id);
          if (!svr) return res.status(404).json({ success: false, error: "VPS not found" });
          const botDir = `/opt/bots/bot-${order.reference}`;
          const fullCmd = trimmed.startsWith("pm2 logs")
            ? `${trimmed} --lines 50 --nostream 2>&1 | tail -100`
            : (trimmed.startsWith("ls") || trimmed.startsWith("tail") || trimmed.startsWith("cat"))
            ? `cd ${botDir} && ${trimmed} 2>&1`
            : `${trimmed} 2>&1`;
          const { stdout, stderr } = await vpsManager.execCommand(svr, fullCmd);
          return res.json({ success: true, output: (stdout + (stderr ? "\n[stderr]: " + stderr : "")).slice(0, 8000) });
        } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
      });

      // ─── Admin: Bulk actions ─────────────────────────────────────────────────
      app.post("/api/admin/bots/bulk/restart-vps/:vpsId", async (req, res) => {
        try {
          const svr = vpsManager.getById(req.params.vpsId);
          if (!svr) return res.status(404).json({ success: false, error: "VPS not found" });
          const orders = await q(
            "SELECT * FROM bot_orders WHERE vps_server_id = ? AND status IN ('deployed','stopped','deploy_failed') AND pm2_name IS NOT NULL AND pm2_name != ''",
            [req.params.vpsId]
          );
          const nvmSource = `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`;
          const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
          let restarted = 0;
          for (const o of orders) {
            try {
              const botDir = `/home/bots/${o.pm2_name}`;
              const smartRestart = `${nvmSource}; pm2 restart ${o.pm2_name} 2>/dev/null || (cd ${botDir} && (pm2 start . --name ${o.pm2_name} 2>/dev/null || pm2 start index.js --name ${o.pm2_name}) && pm2 save)`;
              await vpsManager.execCommand(svr, smartRestart);
              await m(`UPDATE bot_orders SET status = 'deployed', updated_at = ${updNow} WHERE id = ?`, [o.id]);
              restarted++;
            } catch {}
          }
          return res.json({ success: true, restarted, total: orders.length });
        } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
      });

      app.post("/api/admin/bots/bulk/suspend-expired", async (req, res) => {
        try {
          const now = new Date().toISOString();
          const expired = await q("SELECT * FROM bot_orders WHERE status = 'deployed' AND expires_at IS NOT NULL AND expires_at != '' AND expires_at < ?", [now]);
          const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
          let suspended = 0;
          for (const o of expired) {
            if (o.pm2_name && o.vps_server_id) {
              const svr = vpsManager.getAll().find((s: any) => s.id === o.vps_server_id);
              if (svr) { try { await vpsManager.execCommand(svr, `pm2 stop ${o.pm2_name}`); } catch {} }
            }
            await m(`UPDATE bot_orders SET status = 'suspended', updated_at = ${updNow} WHERE id = ?`, [o.id]);
            suspended++;
          }
          return res.json({ success: true, suspended, total: expired.length });
        } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
      });

      app.post("/api/admin/bots/bulk/restart-all", async (req, res) => {
        try {
          const orders = await q(
            "SELECT * FROM bot_orders WHERE status IN ('deployed','stopped','deploy_failed') AND pm2_name IS NOT NULL AND pm2_name != '' AND vps_server_id IS NOT NULL"
          );
          const svrs = vpsManager.getAll();
          const nvmSource = `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`;
          const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
          let restarted = 0;
          for (const o of orders) {
            const svr = svrs.find((s: any) => s.id === o.vps_server_id);
            if (!svr) continue;
            try {
              const botDir = `/home/bots/${o.pm2_name}`;
              const smartRestart = `${nvmSource}; pm2 restart ${o.pm2_name} 2>/dev/null || (cd ${botDir} && (pm2 start . --name ${o.pm2_name} 2>/dev/null || pm2 start index.js --name ${o.pm2_name}) && pm2 save)`;
              await vpsManager.execCommand(svr, smartRestart);
              await m(`UPDATE bot_orders SET status = 'deployed', updated_at = ${updNow} WHERE id = ?`, [o.id]);
              restarted++;
            } catch {}
          }
          return res.json({ success: true, restarted, total: orders.length });
        } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
      });

      // ── Admin: auto-deploy all paid/failed orders that haven't been deployed yet ─
      app.post("/api/admin/bots/bulk/deploy-pending", adminAuthMiddleware, async (req, res) => {
        try {
          const pending = await q(
            "SELECT * FROM bot_orders WHERE status IN ('paid', 'deploy_failed') AND (pm2_name IS NULL OR pm2_name = '')"
          );
          res.json({ success: true, message: `Triggering deploy for ${pending.length} orders…`, count: pending.length });
          deployPendingOrders().catch((e: any) => console.error("[Bulk Deploy] error:", e.message));
        } catch (e: any) { return res.status(500).json({ success: false, error: e.message }); }
      });

  // ── Admin: streaming deploy with live SSH logs ───────────────────────────────
  app.post("/api/admin/bot-orders/:id/deploy-stream", adminAuthMiddleware, async (req: any, res: any) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    const logLines: string[] = [];
    const emit = (msg: string) => {
      logLines.push(msg);
      try { res.write(msg + "\n"); } catch {}
    };
    const saveLog = async (orderId: string) => {
      const updN = dbType === "pg" ? "NOW()::text" : "datetime('now')";
      await m(`UPDATE bot_orders SET deployment_log = ?, updated_at = ${updN} WHERE id = ?`,
        [logLines.join("\n"), orderId]).catch(() => {});
    };
    const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";

    try {
      const orders = await q("SELECT * FROM bot_orders WHERE id = ?", [req.params.id]);
      if (!orders.length) { emit("❌ Order not found"); emit("__DONE__:failed"); return res.end(); }
      const order = orders[0];

      const bots = await q("SELECT * FROM bots WHERE id = ?", [order.bot_id]);
      if (!bots.length) { emit("❌ Bot not found"); emit("__DONE__:failed"); return res.end(); }
      const bot = bots[0];

      const servers = vpsManager.getAll();
      if (!servers.length) { emit("❌ No VPS servers configured. Add one in VPS Manager first."); emit("__DONE__:failed"); return res.end(); }

      // Use explicitly selected VPS if provided, otherwise auto-pick least-loaded
      let server: any;
      const requestedVpsId = req.body?.vpsId;
      if (requestedVpsId) {
        server = servers.find((s: any) => s.id === requestedVpsId);
        if (!server) { emit(`❌ VPS server "${requestedVpsId}" not found`); emit("__DONE__:failed"); return res.end(); }
      } else {
        const deployedCountRows = await q(`SELECT vps_server_id, COUNT(*) as cnt FROM bot_orders WHERE status = 'deployed' AND vps_server_id IS NOT NULL GROUP BY vps_server_id`).catch(() => []);
        const deployedCounts: Record<string, number> = {};
        for (const row of deployedCountRows) deployedCounts[row.vps_server_id] = Number(row.cnt ?? 0);
        server = servers.reduce((best: any, s: any) =>
          (deployedCounts[s.id] ?? 0) < (deployedCounts[best.id] ?? 0) ? s : best
        , servers[0]);
      }

      const osType = (server as any).osType || "ubuntu";
      const isRhel = ["almalinux","centos","rhel","fedora","rocky","oracle"].includes(osType);
      const isArch = osType === "arch";
      const isWindows = osType === "windows";
      const installGit = isRhel ? "dnf install -y git 2>/dev/null || yum install -y git 2>/dev/null"
                        : isArch ? "pacman -S --noconfirm git 2>/dev/null"
                        : isWindows ? "echo Windows: ensure git is pre-installed"
                        : "DEBIAN_FRONTEND=noninteractive apt-get install -y git 2>/dev/null";
      const nvmSource = `export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`;

      const repoUrl = (bot.repo_url || "").replace(/\.git$/, "");
      if (!repoUrl) { emit("❌ Bot has no GitHub repo URL configured"); emit("__DONE__:failed"); return res.end(); }

      const pm2Name = `bot-${order.reference}`;
      const botDir = `/opt/bots/${pm2Name}`;

      // VPS deploy lock — only one deploy per VPS at a time
      if (vpsDeployLock.has(server.id)) {
        emit(`⏳ VPS ${server.label} is already running a deployment. Please wait for it to finish before starting another.`);
        emit("__DONE__:failed");
        return res.end();
      }
      vpsDeployLock.add(server.id);

      emit(`🎯 VPS: ${server.label} (${server.host}) — OS: ${osType}`);
      emit(`📦 Bot: ${bot.name || bot.id}`);
      emit(`📋 Ref: ${order.reference}`);
      emit("─────────────────────────────────────────────────");

      await m(`UPDATE bot_orders SET status = 'deploying', deployment_notes = 'Connecting to VPS...', updated_at = ${updNow} WHERE id = ?`, [req.params.id]);

      const setPhase = async (phase: string) => {
        await m(`UPDATE bot_orders SET deployment_notes = ?, updated_at = ${updNow} WHERE id = ?`, [phase, req.params.id]).catch(() => {});
      };

      const execStep = async (label: string, cmd: string, timeoutMs = 300000) => {
        emit(`\n⚡ ${label}...`);
        const r = await vpsManager.execCommand(server, cmd, timeoutMs);
        const outLines = (r.stdout || "").split("\n").filter((l: string) => l.trim()).slice(0, 12);
        if (outLines.length) emit("   " + outLines.join("\n   "));
        if (r.stderr) {
          const errLines = r.stderr.split("\n").filter((l: string) => l.trim()).slice(0, 5);
          if (errLines.length) emit("   ⚠ " + errLines.join("\n   ⚠ "));
        }
        return r;
      };

      // 0. Kill any leftover npm/git processes from previous failed deploys
      await setPhase("🧹 Clearing stuck processes...");
      emit("\n🧹 Clearing any stuck processes from previous deploys...");
      const loadInfo = await vpsManager.execCommand(server,
        `cat /proc/loadavg 2>/dev/null; pkill -TERM -f "npm install" 2>/dev/null; pkill -TERM -f "npm ci" 2>/dev/null; pkill -TERM -f "git clone" 2>/dev/null; sleep 2; pkill -KILL -f "npm install" 2>/dev/null; pkill -KILL -f "npm ci" 2>/dev/null; echo "cleanup_done"`,
        30000
      );
      const loadLine = (loadInfo.stdout || "").split("\n")[0] || "";
      const loadAvg = loadLine.split(" ")[0];
      if (loadAvg) emit(`   📊 VPS load: ${loadAvg} (1min avg)`);
      emit("   ✓ Cleanup done");

      // 1. Ensure Node.js + PM2 — source nvm first so PATH is always correct
      await setPhase("🔍 Checking Node.js & PM2...");
      emit("\n🔍 Checking Node.js & PM2...");
      const envCheck = await vpsManager.execCommand(
        server,
        `(${nvmSource}; node --version 2>/dev/null || echo "NODE_MISSING") && (${nvmSource}; pm2 --version 2>/dev/null || echo "PM2_MISSING")`,
        60000  // 60s — just version checks, should be instant
      );
      const needsNode = envCheck.stdout.includes("NODE_MISSING") || !envCheck.stdout.includes("v");
      const needsPm2  = envCheck.stdout.includes("PM2_MISSING");

      if (needsNode) {
        await setPhase("⬇ Installing Node.js via nvm...");
        emit("   ⬇ Node.js not found — installing via nvm (1-3 min)...");
        await execStep("Install Node.js 20 via nvm",
          `curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && ${nvmSource} && nvm install 20 && nvm alias default 20 && nvm use default && ln -sf "$(${nvmSource}; which node)" /usr/local/bin/node 2>/dev/null; ln -sf "$(${nvmSource}; which npm)" /usr/local/bin/npm 2>/dev/null; true`,
          300000
        );
        emit("   ✓ Node.js 20 installed");
      } else {
        const ver = envCheck.stdout.split("\n").find((l: string) => l.startsWith("v")) || "";
        emit(`   ✓ Node.js ${ver.trim()}`);
      }

      if (needsPm2) {
        await execStep("Install PM2 globally", `${nvmSource}; npm install -g pm2 && ln -sf "$(${nvmSource}; which pm2)" /usr/local/bin/pm2 2>/dev/null; true`);
        emit("   ✓ PM2 installed");
      } else {
        const pm2ver = envCheck.stdout.split("\n").find((l: string) => /^\d/.test(l)) || "";
        emit(`   ✓ PM2 ${pm2ver.trim()}`);
      }

      // 2. Git
      await setPhase("🔍 Checking git...");
      emit("\n🔍 Checking git...");
      await execStep("Ensure git", `which git 2>/dev/null || git --version 2>/dev/null || (${installGit}); echo "git ready"`, 60000);

      // 4. Clone or pull — shallow clone for speed
      await setPhase("📂 Cloning / updating repo...");
      emit("\n📂 Cloning / updating repo...");
      await execStep("Clone or pull",
        `mkdir -p /opt/bots && (git -C ${botDir} fetch --depth=1 origin 2>&1 && git -C ${botDir} reset --hard FETCH_HEAD 2>&1 || git clone --depth=1 ${repoUrl} ${botDir} 2>&1)`,
        120000  // 2 min max for git
      );

      // 5. .env
      const envVars: Record<string, string> = { NODE_ENV: "production" };
      if (order.session_id) envVars["SESSION_ID"] = order.session_id;
      if (order.db_url) envVars["DB_URL"] = order.db_url;
      if (order.mode) envVars["MODE"] = order.mode;
      if (order.timezone) envVars["TIMEZONE"] = order.timezone;
      const envLines = Object.entries(envVars).map(([k, v]) => `${k}=${String(v).replace(/\r?\n/g, "\\n")}`).join("\n");
      await setPhase("📝 Configuring environment...");
      emit("\n📝 Writing .env file...");
      await vpsManager.execCommand(server, `printf '%s\\n' ${JSON.stringify(envLines)} > ${botDir}/.env`);
      emit("   ✓ .env written");

      // 6. npm install — wipe node_modules first to avoid stale/corrupt cache issues
      await setPhase("📦 Installing dependencies...");
      await execStep(
        "npm install --production",
        `${nvmSource}; cd ${botDir} && rm -rf node_modules package-lock.json 2>/dev/null; npm install --production --no-audit --no-fund --loglevel=error 2>&1 | tail -10`,
        600000 // 10 minutes
      );

      // 7. Start PM2
      await setPhase("🚀 Starting bot with PM2...");
      await execStep("Start with PM2",
        `${nvmSource}; pm2 delete ${pm2Name} 2>/dev/null || true; cd ${botDir} && (pm2 start . --name ${pm2Name} 2>&1 || pm2 start index.js --name ${pm2Name} 2>&1); pm2 save 2>&1`
      );

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await m(
        `UPDATE bot_orders SET status = 'deployed', pm2_name = ?, vps_server_id = ?, deployed_at = ${updNow}, expires_at = ?, updated_at = ${updNow} WHERE id = ?`,
        [pm2Name, server.id, expiresAt, req.params.id]
      );

      emit("\n─────────────────────────────────────────────────");
      emit("✅ DEPLOYMENT COMPLETE! Bot is live.");
      emit(`   PM2: ${pm2Name}`);
      emit(`   VPS: ${server.label} (${server.host})`);
      await saveLog(req.params.id);
      emit("__DONE__:success");
      vpsDeployLock.delete(server.id);
    } catch (e: any) {
      vpsDeployLock.delete(server?.id);
      const updNow2 = dbType === "pg" ? "NOW()::text" : "datetime('now')";
      await m(`UPDATE bot_orders SET status = 'deploy_failed', deployment_notes = ?, updated_at = ${updNow2} WHERE id = ?`,
        ["Deploy failed: " + e.message.slice(0, 200), req.params.id]).catch(() => {});
      emit(`\n❌ FAILED: ${e.message}`);
      await saveLog(req.params.id);
      emit("__DONE__:failed");
    }
    res.end();
  });

  // ── Public VPS Plans listing ───────────────────────────────────────────────
  app.get("/api/vps-plans", async (_req, res) => {
    try {
      const plans = await q("SELECT * FROM vps_plans WHERE active = true ORDER BY sort_order ASC, price_kes ASC");
      res.json({ success: true, plans });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ── Admin VPS Plans CRUD ───────────────────────────────────────────────────
  app.get("/api/admin/vps-plans", adminAuthMiddleware, async (_req, res) => {
    try {
      const plans = await q("SELECT * FROM vps_plans ORDER BY sort_order ASC, price_kes ASC");
      res.json({ success: true, plans });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post("/api/admin/vps-plans", adminAuthMiddleware, async (req, res) => {
    try {
      const { name, ram, cpu, storage: stor, bandwidth, price_kes, popular, active, description, sort_order } = req.body;
      if (!name || price_kes === undefined) return res.status(400).json({ success: false, error: "name and price_kes are required" });
      const now = dbType === "pg" ? "NOW()::text" : "datetime('now')";
      const rows = await q(
        `INSERT INTO vps_plans (name, ram, cpu, storage, bandwidth, price_kes, popular, active, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${now}) RETURNING *`,
        [name, ram || null, cpu || null, stor || null, bandwidth || null, Number(price_kes) || 0, popular ? 1 : 0, active !== false ? 1 : 0, description || null, Number(sort_order) || 0]
      );
      res.json({ success: true, plan: rows[0] });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put("/api/admin/vps-plans/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const fields = ["name", "ram", "cpu", "storage", "bandwidth", "price_kes", "popular", "active", "description", "sort_order"];
      const updates: string[] = [];
      const vals: any[] = [];
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          updates.push(`${f} = ?`);
          vals.push(f === "popular" || f === "active" ? (req.body[f] ? 1 : 0) : req.body[f]);
        }
      }
      if (!updates.length) return res.status(400).json({ success: false, error: "Nothing to update" });
      vals.push(id);
      await m(`UPDATE vps_plans SET ${updates.join(", ")} WHERE id = ?`, vals);
      const rows = await q("SELECT * FROM vps_plans WHERE id = ?", [id]);
      res.json({ success: true, plan: rows[0] });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete("/api/admin/vps-plans/:id", adminAuthMiddleware, async (req, res) => {
    try {
      await m("DELETE FROM vps_plans WHERE id = ?", [parseInt(req.params.id)]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ── VPS Payment: initialize (Paystack) ────────────────────────────────────
  app.post("/api/vps/payment/initialize", async (req: any, res) => {
    try {
      const { planId, customerName, email, phone } = req.body;
      if (!planId || !customerName || !email) return res.status(400).json({ success: false, error: "planId, customerName and email are required" });

      const plans = await q("SELECT * FROM vps_plans WHERE id = ? AND active = true", [Number(planId)]);
      if (!plans.length) return res.status(404).json({ success: false, error: "Plan not found or inactive" });
      const plan = plans[0];

      const paystackSecret = getPaystackSecretKey();
      const reference = "VPS-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

      // Create pending order
      const now = dbType === "pg" ? "NOW()::text" : "datetime('now')";
      await m(
        `INSERT INTO vps_orders (reference, plan_id, customer_name, customer_email, customer_phone, plan_name, ram, cpu, storage, bandwidth, price_kes, status, paystack_reference, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ${now}, ${now})`,
        [reference, plan.id, customerName, email, phone || null, plan.name, plan.ram, plan.cpu, plan.storage, plan.bandwidth, plan.price_kes, reference]
      );

      if (!paystackSecret) {
        return res.json({ success: true, reference, authorizationUrl: null, paystackConfigured: false, plan: plan.name, amount: plan.price_kes });
      }

      const baseUrl = req.protocol + "://" + req.get("host");
      const psRes = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          amount: plan.price_kes * 100,
          reference,
          metadata: { type: "vps", planId: plan.id, planName: plan.name, customerName, phone },
          callback_url: `${baseUrl}/payment/success?ref=${reference}&type=vps`,
        },
        { headers: { Authorization: `Bearer ${paystackSecret}` } }
      );

      res.json({
        success: true,
        reference,
        authorizationUrl: psRes.data.data.authorization_url,
        accessCode: psRes.data.data.access_code,
        paystackConfigured: true,
        plan: plan.name,
        amount: plan.price_kes,
      });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ── VPS Payment: verify ───────────────────────────────────────────────────
  app.post("/api/vps/payment/verify", async (req, res) => {
    try {
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ success: false, error: "Reference required" });

      const orders = await q("SELECT * FROM vps_orders WHERE reference = ? OR paystack_reference = ?", [reference, reference]);
      if (!orders.length) return res.status(404).json({ success: false, error: "Order not found" });
      const order = orders[0];

      if (order.status === "paid" || order.status === "active") {
        return res.json({ success: true, alreadyProcessed: true, planName: order.plan_name, reference: order.reference });
      }

      const paystackSecret = getPaystackSecretKey();
      if (!paystackSecret) return res.status(503).json({ success: false, error: "Payment gateway not configured" });

      const verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${paystackSecret}` },
      });

      const psTx = verifyRes.data.data;
      if (psTx.status !== "success") {
        return res.json({ success: false, error: "Payment not confirmed by Paystack" });
      }

      const now = dbType === "pg" ? "NOW()::text" : "datetime('now')";
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await m(
        `UPDATE vps_orders SET status = 'paid', paid_at = ${now}, expires_at = ?, updated_at = ${now} WHERE id = ?`,
        [expiresAt, order.id]
      );

      res.json({ success: true, planName: order.plan_name, reference: order.reference });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ── Admin VPS Sales / Seller Dashboard endpoints ──────────────────────────

  // Generate a short reference
  function genVpsRef() {
    return "VPS-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 5).toUpperCase();
  }

  // List all VPS orders with summary stats
  app.get("/api/admin/vps-orders", adminAuthMiddleware, async (_req, res) => {
    try {
      const orders = await q("SELECT * FROM vps_orders ORDER BY created_at DESC");
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const stats = {
        total: orders.length,
        active: orders.filter((o: any) => o.status === "active").length,
        pending: orders.filter((o: any) => o.status === "pending").length,
        expiring7d: orders.filter((o: any) => o.status === "active" && o.expires_at && o.expires_at <= in7).length,
        revenueKes: orders.filter((o: any) => o.status === "active").reduce((s: number, o: any) => s + (Number(o.price_kes) || 0), 0),
      };
      res.json({ success: true, orders, stats });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Create a new VPS order (manual entry by admin)
  app.post("/api/admin/vps-orders", adminAuthMiddleware, async (req, res) => {
    try {
      const { customer_name, customer_email, customer_phone, plan_name, ram, cpu, storage: stor, bandwidth, price_kes, status, assigned_ip, server_username, server_password, ssh_port, os_type, notes, paid_at, expires_at } = req.body;
      if (!customer_name || !customer_email || !plan_name) return res.status(400).json({ success: false, error: "customer_name, customer_email and plan_name are required" });
      const ref = genVpsRef();
      const now = dbType === "pg" ? "NOW()::text" : "datetime('now')";
      const row = await q(
        `INSERT INTO vps_orders (reference, customer_name, customer_email, customer_phone, plan_name, ram, cpu, storage, bandwidth, price_kes, status, assigned_ip, server_username, server_password, ssh_port, os_type, notes, paid_at, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${now}, ${now}) RETURNING *`,
        [ref, customer_name, customer_email, customer_phone || null, plan_name, ram || null, cpu || null, stor || null, bandwidth || null, Number(price_kes) || 0, status || "pending", assigned_ip || null, server_username || null, server_password || null, Number(ssh_port) || 22, os_type || "ubuntu", notes || null, paid_at || null, expires_at || null]
      );
      res.json({ success: true, order: row[0] });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Update a VPS order (assign credentials, change status, etc.)
  app.put("/api/admin/vps-orders/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const fields = ["customer_name", "customer_email", "customer_phone", "plan_name", "ram", "cpu", "storage", "bandwidth", "price_kes", "status", "assigned_ip", "server_username", "server_password", "ssh_port", "os_type", "notes", "paid_at", "expires_at"];
      const updates: string[] = [];
      const vals: any[] = [];
      for (const f of fields) {
        if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(req.body[f]); }
      }
      if (!updates.length) return res.status(400).json({ success: false, error: "No fields to update" });
      const now = dbType === "pg" ? "NOW()::text" : "datetime('now')";
      updates.push(`updated_at = ${now}`);
      vals.push(id);
      await m(`UPDATE vps_orders SET ${updates.join(", ")} WHERE id = ?`, vals);
      const rows = await q("SELECT * FROM vps_orders WHERE id = ?", [id]);
      res.json({ success: true, order: rows[0] });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Delete a VPS order
  app.delete("/api/admin/vps-orders/:id", adminAuthMiddleware, async (req, res) => {
    try {
      await m("DELETE FROM vps_orders WHERE id = ?", [parseInt(req.params.id)]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });




  // ── Free Temp Numbers — multi-source scraper ────────────────────────────────
  function fetchPageHtml(hostname: string, urlPath: string, extraHeaders?: Record<string,string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const httpsModule = require('https') as typeof import('https');
      const req = httpsModule.request({
        hostname, path: urlPath, method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'identity',
          ...(extraHeaders || {}),
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.end();
    });
  }

  // Numbers list cache — 10 minutes
  let numbersCache: { data: any[]; ts: number } | null = null;

  async function scrapeAllNumbers(): Promise<any[]> {
    if (numbersCache && Date.now() - numbersCache.ts < 3 * 60 * 1000) return numbersCache.data;
    const results: any[] = [];

    // ── sms-online.co ─────────────────────────────────────────────────────────
    try {
      const html = await fetchPageHtml('sms-online.co', '/receive-free-sms');
      const rx = /number-boxes-item-number">([^<]+)<\/h4>\s*<h5[^>]*>([^<]+)<\/h5>[\s\S]*?href="[^"]+\/receive-free-sms\/(\d+)"/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(html)) !== null)
        results.push({ number: m[1].trim(), country: m[2].trim(), digits: m[3].trim(), source: 'sms-online' });
    } catch (e: any) { console.error('[numbers] sms-online.co:', e.message); }

    // ── receive-sms-online.info ───────────────────────────────────────────────
    try {
      const html = await fetchPageHtml('receive-sms-online.info', '/');
      const seen = new Set<string>();
      const rx = /href="((\d{8,15})-([^"]{2,30}))"/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(html)) !== null) {
        const digits = m[2];
        if (seen.has(digits)) continue;
        seen.add(digits);
        const country = m[3].replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        results.push({ number: '+' + digits, country, digits, source: 'rsoi' });
      }
    } catch (e: any) { console.error('[numbers] receive-sms-online.info:', e.message); }

    // ── receive-sms.cc ────────────────────────────────────────────────────────
    try {
      const html = await fetchPageHtml('receive-sms.cc', '/');
      const rx = /href="(\/[A-Z]{2}-Phone-Number\/([\d]+))"[\s\S]{0,300}?<p class="text-muted mb-1">([^<]+)<\/p>\s*<h4>\+?([\d ]+)<\/h4>/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(html)) !== null) {
        const digits = m[2];
        const country = m[3].replace(' Phone Number', '').trim();
        const number = '+' + m[4].replace(/\s/g, '');
        results.push({ number, country, digits, source: 'rscc', rsccPath: m[1] });
      }
    } catch (e: any) { console.error('[numbers] receive-sms.cc:', e.message); }

    numbersCache = { data: results, ts: Date.now() };
    console.log(`[numbers] total scraped: ${results.length}`);
    return results;
  }

  app.get('/api/free-numbers', async (_req, res) => {
    try {
      const numbers = await scrapeAllNumbers();
      res.json({ success: true, numbers, total: numbers.length, lastUpdated: new Date().toISOString() });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/free-numbers/:digits/sms', async (req, res) => {
    try {
      const { digits } = req.params;
      const source = (req.query.source as string) || 'sms-online';
      if (!/^\d{5,20}$/.test(digits)) return res.status(400).json({ success: false, error: 'Invalid digits' });

      const messages: { sender: string; time: string; body: string }[] = [];

      if (source === 'rsoi') {
        // receive-sms-online.info AJAX endpoint
        const ts = Math.floor(Date.now() / 1000).toString();
        const data = await fetchPageHtml('receive-sms-online.info', `/get_sms_register.php?phone=${digits}`, {
          'Referer': `https://receive-sms-online.info/${digits}`,
          'X-Alt-Data': ts,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
        });
        try {
          const json = JSON.parse(data) as any[];
          for (const item of json) {
            if (item.mesaj && item.mesaj !== 'no result') {
              messages.push({ sender: item.telefon || 'Unknown', time: item.data || '', body: item.mesaj });
            }
          }
        } catch {}
      } else if (source === 'rscc') {
        // receive-sms.cc — try to scrape the number page
        const numbers = await scrapeAllNumbers();
        const found = numbers.find((n: any) => n.digits === digits && n.source === 'rscc');
        if (found && found.rsccPath) {
          const html = await fetchPageHtml('receive-sms.cc', found.rsccPath);
          const rx = /<div class="card-body">\s*<p[^>]*>([^<]+)<\/p>\s*<p[^>]*>([^<]+)<\/p>\s*<p[^>]*>([^<]+)<\/p>/g;
          let m: RegExpExecArray | null;
          while ((m = rx.exec(html)) !== null)
            messages.push({ sender: m[1].trim(), time: m[3].trim(), body: m[2].trim() });
        }
      } else {
        // sms-online.co — server-rendered HTML
        const html = await fetchPageHtml('sms-online.co', `/receive-free-sms/${digits}`);
        const rx = /list-item-title">\s*([\s\S]*?)\s*<\/h3>[\s\S]*?list-item-meta[^>]*>[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?list-item-content break-word">([\s\S]*?)<\/div>/g;
        let m: RegExpExecArray | null;
        while ((m = rx.exec(html)) !== null) {
          const sender = m[1].replace(/<[^>]+>/g, '').trim();
          const time = m[2].trim();
          const body = m[3].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
          if (sender && body) messages.push({ sender, time, body });
        }
      }

      res.json({ success: true, messages });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  
  // ── SMM Boost — smmstone.com scraper ─────────────────────────────────────
  let smmCache: { services: any[]; ts: number } | null = null;

  function detectPlatform(text: string): string {
    const t = text.toLowerCase();
    if (t.includes('instagram')) return 'Instagram';
    if (t.includes('tiktok')) return 'TikTok';
    if (t.includes('youtube')) return 'YouTube';
    if (t.includes('telegram')) return 'Telegram';
    if (t.includes('facebook')) return 'Facebook';
    if (t.includes('twitter') || t.includes(' x ')) return 'Twitter';
    if (t.includes('spotify')) return 'Spotify';
    if (t.includes('whatsapp')) return 'WhatsApp';
    if (t.includes('discord')) return 'Discord';
    return 'Other';
  }

  async function scrapeSmmServices(): Promise<any[]> {
    if (smmCache && Date.now() - smmCache.ts < 60 * 60 * 1000) return smmCache.services;
    console.log('[SMM] Scraping smmstone.com...');
    const html = await fetchPageHtml('smmstone.com', '/services');

    // Build category-id → category-name map
    const catMap: Record<string, string> = {};
    const catRx = /category-id="(\d+)"[^>]*category-name="([^"]+)"/g;
    let cm: RegExpExecArray | null;
    while ((cm = catRx.exec(html)) !== null) catMap[cm[1]] = cm[2];

    // Extract services: id, categoryId, name, price, min, max
    const services: any[] = [];
    const svcRx = /service-id="(\d+)"[^>]*data-filter-table-category-id="(\d+)"[\s\S]{0,150}<span class="ss-name">([^<]+)<\/span>[\s\S]{0,300}?\$(\d+\.\d+)[\s\S]{0,200}?<\/div>/g;
    let sm: RegExpExecArray | null;
    while ((sm = svcRx.exec(html)) !== null && services.length < 3000) {
      const catName = catMap[sm[2]] || 'Other';
      const name = sm[3].replace(/[\uD800-\uDFFF]|[\u{1F000}-\u{1FFFF}]/gu, '').replace(/\s+/g, ' ').trim();
      const rate = parseFloat(sm[4]);
      const platform = detectPlatform(catName + ' ' + name);
      services.push({ id: sm[1], name, category: catName, rate, platform });
    }

    // Fallback: simpler name+price only approach if above yields <100
    if (services.length < 100) {
      const rx2 = /<span class="ss-name">([^<]+)<\/span>[\s\S]{0,400}?\$(\d+\.\d+)/g;
      let m2: RegExpExecArray | null;
      while ((m2 = rx2.exec(html)) !== null && services.length < 3000) {
        const name = m2[1].replace(/\s+/g, ' ').trim();
        const rate = parseFloat(m2[2]);
        services.push({ id: services.length, name, category: 'General', rate, platform: detectPlatform(name) });
      }
    }

    smmCache = { services, ts: Date.now() };
    console.log(`[SMM] Scraped ${services.length} services`);
    return services;
  }

  // Mark: 2.5× markup on wholesale rate
  const SMM_MARKUP = 2.5;

  app.get('/api/smm/services', async (req, res) => {
    try {
      const all = await scrapeSmmServices();
      const { platform, q } = req.query as Record<string, string>;
      let filtered = all;
      if (platform && platform !== 'All') filtered = filtered.filter((s: any) => s.platform === platform);
      if (q) { const ql = q.toLowerCase(); filtered = filtered.filter((s: any) => s.name.toLowerCase().includes(ql) || s.category.toLowerCase().includes(ql)); }
      const result = filtered.slice(0, 200).map((s: any) => ({ ...s, ourRate: +(s.rate * SMM_MARKUP).toFixed(4) }));
      res.json({ success: true, services: result, total: filtered.length });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/smm/platforms', async (_req, res) => {
    try {
      const all = await scrapeSmmServices();
      const counts: Record<string, number> = {};
      all.forEach((s: any) => { counts[s.platform] = (counts[s.platform] || 0) + 1; });
      const platforms = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
      res.json({ success: true, platforms });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/smm/order', customerAuthMiddleware, async (req: any, res) => {
    try {
      const { serviceId, serviceName, platform, quantity, link, rate, ourRate } = req.body;
      if (!serviceId || !quantity || !link || !ourRate) return res.status(400).json({ success: false, error: 'Missing fields' });
      const totalUSD = (quantity / 1000) * ourRate;
      const amountKes = Math.round(totalUSD * 130); // ~130 KES per USD
      const amountKobo = amountKes * 100;
      const email = req.customer?.email || req.session?.customerEmail || 'customer@chegetech.com';
      const ref = 'SMM-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

      const paystackBody = JSON.stringify({
        email, amount: amountKobo, reference: ref, currency: 'KES',
        metadata: { serviceId, serviceName, platform, quantity, link, rate, ourRate, totalUSD: totalUSD.toFixed(4) },
        callback_url: process.env.BASE_URL ? process.env.BASE_URL + '/payment/callback' : undefined,
      });
      const paystackRes = await new Promise<any>((resolve, reject) => {
        const httpsM = require('https') as typeof import('https');
        const r = httpsM.request({ hostname: 'api.paystack.co', path: '/transaction/initialize', method: 'POST', headers: { 'Authorization': 'Bearer ' + process.env.PAYSTACK_SECRET_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(paystackBody) } }, (resp) => { let d = ''; resp.on('data', (c: Buffer) => d += c); resp.on('end', () => resolve(JSON.parse(d))); });
        r.on('error', reject); r.write(paystackBody); r.end();
      });

      if (!paystackRes.status) return res.status(500).json({ success: false, error: 'Payment init failed' });

      // Save order to DB
      try {
        const pg = require('./storage').pgPool || (await import('./storage')).pgPool;
        if (pg) {
          await pg.query(
            'INSERT INTO smm_orders (reference,customer_email,service_id,service_name,platform,quantity,link,rate,our_rate,total_usd,amount_kes,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (reference) DO NOTHING',
            [ref, email, serviceId, serviceName, platform, quantity, link, rate || 0, ourRate, totalUSD.toFixed(4), amountKes, 'pending']
          );
        }
      } catch (dbErr: any) { console.error('[SMM] DB save error:', dbErr.message); }

      res.json({ success: true, paymentUrl: paystackRes.data.authorization_url, reference: ref });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });



  // ── SMM Admin Endpoints ───────────────────────────────────────────────────
  app.get('/api/admin/smm-orders', async (req: any, res) => {
    try {
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      if (!pg) return res.json({ success: true, orders: [] });
      const { rows } = await pg.query('SELECT * FROM smm_orders ORDER BY id DESC LIMIT 500');
      res.json({ success: true, orders: rows });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.patch('/api/admin/smm-orders/:id/status', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const allowed = ['pending','processing','completed','failed'];
      if (!allowed.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      if (!pg) return res.status(500).json({ success: false, error: 'No DB' });
      await pg.query('UPDATE smm_orders SET status=$1 WHERE id=$2', [status, id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });


  // ── Proxy / Residential IPs ───────────────────────────────────────────────

  // Customer: list active plans



  // ── Free Proxies Admin — DB-backed with checker ──────────────────────────

  function parseProxyLine(line: string): { ip: string; port: string; user: string; pass: string; raw: string } | null {
    line = line.trim().replace(/^https?:\/\//, '');
    if (!line) return null;
    // user:pass@ip:port
    const authAt = line.match(/^([^:]+):([^@]+)@([\d.]+):(\d+)$/);
    if (authAt) return { user: authAt[1], pass: authAt[2], ip: authAt[3], port: authAt[4], raw: line };
    // ip:port:user:pass
    const parts = line.split(':');
    if (parts.length === 4 && /^\d+$/.test(parts[1])) return { ip: parts[0], port: parts[1], user: parts[2], pass: parts[3], raw: line };
    if (parts.length === 4 && /^\d+$/.test(parts[3])) return { ip: parts[2], port: parts[3], user: parts[0], pass: parts[1], raw: line };
    // ip:port
    if (parts.length === 2 && /^\d+$/.test(parts[1])) return { ip: parts[0], port: parts[1], user: '', pass: '', raw: line };
    return null;
  }

  async function checkSingleProxy(ip: string, port: string): Promise<{ alive: boolean; speed_ms: number; country: string; country_code: string; anonymity: string }> {
    return new Promise((resolve) => {
      const httpM = require('http') as typeof import('http');
      const start = Date.now();
      try {
        const req = httpM.request({
          host: ip, port: parseInt(port), method: 'GET',
          path: 'http://ip-api.com/json?fields=country,countryCode,proxy,hosting',
          headers: { 'Host': 'ip-api.com', 'User-Agent': 'Mozilla/5.0', 'Proxy-Connection': 'Keep-Alive' },
          timeout: 9000,
        }, (res) => {
          let data = '';
          res.on('data', (d: Buffer) => data += d);
          res.on('end', () => {
            const ms = Date.now() - start;
            try {
              const j = JSON.parse(data);
              const anonymity = j.proxy || j.hosting ? 'anonymous' : 'transparent';
              resolve({ alive: true, speed_ms: ms, country: j.country || 'Unknown', country_code: j.countryCode || '', anonymity });
            } catch { resolve({ alive: true, speed_ms: ms, country: 'Unknown', country_code: '', anonymity: 'anonymous' }); }
          });
        });
        req.on('timeout', () => { req.destroy(); resolve({ alive: false, speed_ms: 0, country: '', country_code: '', anonymity: '' }); });
        req.on('error', () => resolve({ alive: false, speed_ms: 0, country: '', country_code: '', anonymity: '' }));
        req.end();
      } catch { resolve({ alive: false, speed_ms: 0, country: '', country_code: '', anonymity: '' }); }
    });
  }

  // Admin: list all free proxies
  app.get('/api/admin/free-proxies', async (_req, res) => {
    try {
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      const { rows } = await pg.query('SELECT * FROM free_proxies ORDER BY id DESC LIMIT 2000');
      res.json({ success: true, proxies: rows });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: bulk import
  app.post('/api/admin/free-proxies/bulk', async (req, res) => {
    try {
      const { proxies: raw, type: proxyType } = req.body;
      if (!raw) return res.status(400).json({ success: false, error: 'No proxies provided' });
      const lines = (raw as string).split('\n').map((l: string) => l.trim()).filter((l: string) => l);
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      let added = 0, dupes = 0;
      for (const line of lines) {
        const p = parseProxyLine(line);
        if (!p) continue;
        try {
          await pg.query(
            'INSERT INTO free_proxies (raw, ip, port, username, password, type, status) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (raw) DO NOTHING',
            [p.raw, p.ip, p.port, p.user, p.pass, (proxyType || 'HTTP').toUpperCase(), 'unchecked']
          );
          added++;
        } catch { dupes++; }
      }
      res.json({ success: true, added, dupes, total: lines.length });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: check proxies (batch, up to 100 at a time, 8 concurrent)
  app.post('/api/admin/free-proxies/check', async (req, res) => {
    try {
      const { ids } = req.body; // optional: array of ids, else check all unchecked
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      let rows: any[];
      if (ids && ids.length) {
        const { rows: r } = await pg.query('SELECT * FROM free_proxies WHERE id = ANY($1) LIMIT 200', [ids]);
        rows = r;
      } else {
        const { rows: r } = await pg.query("SELECT * FROM free_proxies WHERE status='unchecked' OR status='alive' ORDER BY id DESC LIMIT 200");
        rows = r;
      }
      if (!rows.length) return res.json({ success: true, checked: 0, alive: 0 });

      // Run 8 concurrent checks
      const CONCURRENCY = 8;
      let alive = 0, dead = 0;
      for (let i = 0; i < rows.length; i += CONCURRENCY) {
        const batch = rows.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (proxy: any) => {
          const result = await checkSingleProxy(proxy.ip, proxy.port);
          const status = result.alive ? 'alive' : 'dead';
          if (result.alive) alive++; else dead++;
          await pg.query(
            'UPDATE free_proxies SET status=$1,speed_ms=$2,country=$3,country_code=$4,anonymity=$5,last_checked=NOW()::text WHERE id=$6',
            [status, result.speed_ms, result.country, result.country_code, result.anonymity, proxy.id]
          );
        }));
      }
      res.json({ success: true, checked: rows.length, alive, dead });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: delete one
  app.delete('/api/admin/free-proxies/:id', async (req, res) => {
    try {
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      await pg.query('DELETE FROM free_proxies WHERE id=$1', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: delete all dead
  app.delete('/api/admin/free-proxies/bulk/dead', async (_req, res) => {
    try {
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      const { rowCount } = await pg.query("DELETE FROM free_proxies WHERE status='dead'");
      res.json({ success: true, deleted: rowCount });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Public: free proxies — DB-backed first, fallback to geonode
  let freeProxyCacheGeo: { data: any[]; ts: number } | null = null;
  app.get('/api/proxy/free', async (_req, res) => {
    try {
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      const { rows } = await pg.query("SELECT ip,port,type,country,country_code,anonymity,speed_ms FROM free_proxies WHERE status='alive' ORDER BY speed_ms ASC, id DESC LIMIT 300");
      if (rows.length > 0) {
        return res.json({ success: true, proxies: rows.map((r: any) => ({ ip: r.ip, port: r.port, type: r.type || 'HTTP', country: r.country || 'Unknown', countryCode: r.country_code || '', anonymity: r.anonymity || 'anonymous', speed: r.speed_ms || 0, upTime: 100 })) });
      }
    } catch {}
    // Fallback to geonode cache
    try {
      if (freeProxyCacheGeo && Date.now() - freeProxyCacheGeo.ts < 5 * 60 * 1000) {
        return res.json({ success: true, proxies: freeProxyCacheGeo.data, cached: true });
      }
      const axiosM = require('axios');
      const r = await axiosM.get('https://proxylist.geonode.com/api/proxy-list?limit=200&page=1&sort_by=lastChecked&sort_type=desc&filterUpTime=50', { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }, timeout: 12000 });
      const proxies = (r.data?.data || []).map((p: any) => ({ ip: p.ip, port: p.port, type: (p.protocols?.[0] || 'http').toUpperCase(), country: p.country || 'Unknown', countryCode: p.country_code || p.countryCode || '', anonymity: (p.anonymityLevel || 'transparent').toLowerCase(), speed: p.speed || 0, upTime: p.upTime || 0 }));
      freeProxyCacheGeo = { data: proxies, ts: Date.now() };
      res.json({ success: true, proxies });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });


  app.get('/api/proxy/plans', async (_req, res) => {
    try {
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      if (!pg) return res.json({ success: true, plans: [] });
      const { rows } = await pg.query("SELECT * FROM proxy_plans WHERE is_active=true ORDER BY sort_order ASC, price_kes ASC");
      res.json({ success: true, plans: rows });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Customer: create order + Paystack
  app.post('/api/proxy/order', async (req: any, res) => {
    try {
      const { planId } = req.body;
      if (!planId) return res.status(400).json({ success: false, error: 'Plan ID required' });
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      if (!pg) return res.status(500).json({ success: false, error: 'DB unavailable' });
      const { rows } = await pg.query("SELECT * FROM proxy_plans WHERE id=$1 AND is_active=true", [planId]);
      if (!rows.length) return res.status(404).json({ success: false, error: 'Plan not found' });
      const plan = rows[0];
      const email = req.customer?.email || req.session?.customerEmail || 'customer@chegetech.com';
      const ref = 'PROXY-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
      const amountKobo = Math.round(plan.price_kes * 100);
      const paystackBody = JSON.stringify({
        email, amount: amountKobo, reference: ref, currency: 'KES',
        metadata: { type: 'proxy_order', planId: plan.id, planName: plan.name, amountKes: plan.price_kes },
        callback_url: process.env.BASE_URL ? process.env.BASE_URL + '/payment/callback' : undefined,
      });
      const httpsM = require('https') as typeof import('https');
      const paystackRes = await new Promise<any>((resolve, reject) => {
        const r = httpsM.request({ hostname:'api.paystack.co', path:'/transaction/initialize', method:'POST', headers:{ 'Authorization':'Bearer '+process.env.PAYSTACK_SECRET_KEY, 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(paystackBody) } }, (resp) => { let d=''; resp.on('data',(c:Buffer)=>d+=c); resp.on('end',()=>resolve(JSON.parse(d))); });
        r.on('error',reject); r.write(paystackBody); r.end();
      });
      if (!paystackRes.status) return res.status(500).json({ success: false, error: 'Payment init failed' });
      await pg.query(
        "INSERT INTO proxy_orders (reference,customer_email,plan_id,plan_name,amount_kes,status) VALUES ($1,$2,$3,$4,$5,'pending') ON CONFLICT DO NOTHING",
        [ref, email, plan.id, plan.name, plan.price_kes]
      );
      res.json({ success: true, paymentUrl: paystackRes.data.authorization_url, reference: ref });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: list all plans
  app.get('/api/admin/proxy-plans', async (_req, res) => {
    try {
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      if (!pg) return res.json({ success: true, plans: [] });
      const { rows } = await pg.query("SELECT * FROM proxy_plans ORDER BY sort_order ASC, id ASC");
      res.json({ success: true, plans: rows });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: create plan
  app.post('/api/admin/proxy-plans', async (req, res) => {
    try {
      const { name, description, type, gb_amount, country, price_kes, bandwidth, speed, features, is_active, sort_order } = req.body;
      if (!name || !price_kes) return res.status(400).json({ success: false, error: 'Name and price required' });
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      const { rows } = await pg.query(
        "INSERT INTO proxy_plans (name,description,type,gb_amount,country,price_kes,bandwidth,speed,features,is_active,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
        [name, description||'', type||'residential', gb_amount||null, country||null, price_kes, bandwidth||'Unlimited', speed||'100Mbps', features||'', is_active!==false, sort_order||0]
      );
      res.json({ success: true, plan: rows[0] });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: update plan
  app.put('/api/admin/proxy-plans/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, type, gb_amount, country, price_kes, bandwidth, speed, features, is_active, sort_order } = req.body;
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      await pg.query(
        "UPDATE proxy_plans SET name=COALESCE($1,name),description=COALESCE($2,description),type=COALESCE($3,type),gb_amount=$4,country=$5,price_kes=COALESCE($6,price_kes),bandwidth=COALESCE($7,bandwidth),speed=COALESCE($8,speed),features=COALESCE($9,features),is_active=COALESCE($10,is_active),sort_order=COALESCE($11,sort_order) WHERE id=$12",
        [name, description, type, gb_amount||null, country||null, price_kes, bandwidth, speed, features, is_active, sort_order||0, id]
      );
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: delete plan
  app.delete('/api/admin/proxy-plans/:id', async (req, res) => {
    try {
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      await pg.query("DELETE FROM proxy_plans WHERE id=$1", [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: list orders
  app.get('/api/admin/proxy-orders', async (_req, res) => {
    try {
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      if (!pg) return res.json({ success: true, orders: [] });
      const { rows } = await pg.query("SELECT * FROM proxy_orders ORDER BY id DESC LIMIT 500");
      res.json({ success: true, orders: rows });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: update order status + credentials
  app.patch('/api/admin/proxy-orders/:id/status', async (req, res) => {
    try {
      const { status, credentials } = req.body;
      const allowed = ['pending','processing','active','completed','failed'];
      if (!allowed.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      await pg.query("UPDATE proxy_orders SET status=$1,credentials=COALESCE($2,credentials) WHERE id=$3", [status, credentials||null, req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });



  // ── Digital Accounts (Social Media + Email) ───────────────────────────────

  // Customer: list products with live stock count
  app.get('/api/digital/products', async (_req, res) => {
    try {
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      if (!pg) return res.json({ success: true, products: [] });
      const { rows } = await pg.query(`
        SELECT p.*, COUNT(s.id) FILTER (WHERE s.is_sold=false) AS stock_count
        FROM digital_products p
        LEFT JOIN digital_accounts_stock s ON s.product_id=p.id
        WHERE p.is_active=true
        GROUP BY p.id
        ORDER BY p.sort_order ASC, p.id ASC
      `);
      res.json({ success: true, products: rows.map((r: any) => ({ ...r, stock_count: parseInt(r.stock_count)||0 })) });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Customer: create order + Paystack
  app.post('/api/digital/order', async (req: any, res) => {
    try {
      const { productId } = req.body;
      if (!productId) return res.status(400).json({ success: false, error: 'Product ID required' });
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      const { rows: prods } = await pg.query("SELECT * FROM digital_products WHERE id=$1 AND is_active=true", [productId]);
      if (!prods.length) return res.status(404).json({ success: false, error: 'Product not found' });
      const product = prods[0];
      const { rows: stock } = await pg.query("SELECT id FROM digital_accounts_stock WHERE product_id=$1 AND is_sold=false LIMIT 1", [productId]);
      if (!stock.length) return res.status(400).json({ success: false, error: 'Out of stock' });
      const email = req.customer?.email || req.session?.customerEmail || 'customer@chegetech.com';
      const ref = 'ACCT-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
      const amountKobo = Math.round(product.price_kes * 100);
      const paystackBody = JSON.stringify({
        email, amount: amountKobo, reference: ref, currency: 'KES',
        metadata: { type: 'digital_account', productId: product.id, productName: product.name, platform: product.platform },
        callback_url: (process.env.BASE_URL || '') + '/accounts?ref=' + ref,
      });
      const httpsM = require('https') as typeof import('https');
      const psRes = await new Promise<any>((resolve, reject) => {
        const r = httpsM.request({ hostname:'api.paystack.co', path:'/transaction/initialize', method:'POST', headers:{'Authorization':'Bearer '+process.env.PAYSTACK_SECRET_KEY,'Content-Type':'application/json','Content-Length':Buffer.byteLength(paystackBody)} }, (resp) => { let d=''; resp.on('data',(c:Buffer)=>d+=c); resp.on('end',()=>resolve(JSON.parse(d))); }); r.on('error',reject); r.write(paystackBody); r.end();
      });
      if (!psRes.status) return res.status(500).json({ success: false, error: 'Payment init failed' });
      await pg.query("INSERT INTO digital_orders (reference,customer_email,product_id,product_name,platform,amount_kes,status) VALUES ($1,$2,$3,$4,$5,$6,'pending') ON CONFLICT DO NOTHING",
        [ref, email, product.id, product.name, product.platform, product.price_kes]);
      res.json({ success: true, paymentUrl: psRes.data.authorization_url, reference: ref });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Customer: verify payment + auto-deliver account
  app.get('/api/digital/verify/:reference', async (req, res) => {
    try {
      const { reference } = req.params;
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      const { rows: orders } = await pg.query("SELECT * FROM digital_orders WHERE reference=$1", [reference]);
      if (!orders.length) return res.status(404).json({ success: false, error: 'Order not found' });
      const order = orders[0];
      if (order.status === 'delivered' && order.credentials) {
        return res.json({ success: true, credentials: order.credentials, already: true });
      }
      // Verify with Paystack
      const httpsM = require('https') as typeof import('https');
      const psCheck = await new Promise<any>((resolve) => {
        const r = httpsM.request({ hostname:'api.paystack.co', path:'/transaction/verify/'+reference, method:'GET', headers:{'Authorization':'Bearer '+process.env.PAYSTACK_SECRET_KEY} }, (resp) => { let d=''; resp.on('data',(c:Buffer)=>d+=c); resp.on('end',()=>{ try{resolve(JSON.parse(d));}catch{resolve({data:{status:'failed'}});} }); }); r.on('error',()=>resolve({data:{status:'failed'}})); r.end();
      });
      if (psCheck.data?.status !== 'success') return res.status(402).json({ success: false, error: 'Payment not confirmed yet' });
      // Assign account from stock
      const { rows: stock } = await pg.query("SELECT * FROM digital_accounts_stock WHERE product_id=$1 AND is_sold=false LIMIT 1 FOR UPDATE SKIP LOCKED", [order.product_id]);
      if (!stock.length) return res.status(400).json({ success: false, error: 'Out of stock - contact support' });
      const acct = stock[0];
      await pg.query("UPDATE digital_accounts_stock SET is_sold=true,sold_to_email=$1,sold_at=NOW()::text WHERE id=$2", [order.customer_email, acct.id]);
      await pg.query("UPDATE digital_orders SET status='delivered',credentials=$1,account_stock_id=$2 WHERE reference=$3", [acct.credentials, acct.id, reference]);
      res.json({ success: true, credentials: acct.credentials });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: list all digital products
  app.get('/api/admin/digital-products', async (_req, res) => {
    try {
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      const { rows } = await pg.query(`SELECT p.*, COUNT(s.id) FILTER (WHERE s.is_sold=false) AS stock_count, COUNT(s.id) AS total_stock FROM digital_products p LEFT JOIN digital_accounts_stock s ON s.product_id=p.id GROUP BY p.id ORDER BY p.sort_order ASC, p.id ASC`);
      res.json({ success: true, products: rows.map((r: any) => ({ ...r, stock_count: parseInt(r.stock_count)||0, total_stock: parseInt(r.total_stock)||0 })) });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/admin/digital-products', async (req, res) => {
    try {
      const { name, platform, category, price_kes, description, features, is_active, sort_order } = req.body;
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      const { rows } = await pg.query("INSERT INTO digital_products (name,platform,category,price_kes,description,features,is_active,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [name, platform, category||'social', price_kes, description||'', features||'', is_active!==false, sort_order||0]);
      res.json({ success: true, product: rows[0] });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put('/api/admin/digital-products/:id', async (req, res) => {
    try {
      const { name, platform, category, price_kes, description, features, is_active, sort_order } = req.body;
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      await pg.query("UPDATE digital_products SET name=COALESCE($1,name),platform=COALESCE($2,platform),category=COALESCE($3,category),price_kes=COALESCE($4,price_kes),description=COALESCE($5,description),features=COALESCE($6,features),is_active=COALESCE($7,is_active),sort_order=COALESCE($8,sort_order) WHERE id=$9",
        [name, platform, category, price_kes, description, features, is_active, sort_order||0, req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete('/api/admin/digital-products/:id', async (req, res) => {
    try {
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      await pg.query("DELETE FROM digital_products WHERE id=$1", [req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: bulk add accounts to stock
  app.post('/api/admin/digital-products/:id/stock', async (req, res) => {
    try {
      const { credentials } = req.body; // newline-separated
      if (!credentials) return res.status(400).json({ success: false, error: 'No credentials provided' });
      const lines = credentials.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      if (!lines.length) return res.status(400).json({ success: false, error: 'No valid lines found' });
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      let added = 0;
      for (const line of lines) {
        try { await pg.query("INSERT INTO digital_accounts_stock (product_id,credentials) VALUES ($1,$2)", [req.params.id, line]); added++; } catch {}
      }
      res.json({ success: true, added, total: lines.length });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: list digital orders
  app.get('/api/admin/digital-orders', async (_req, res) => {
    try {
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      const { rows } = await pg.query("SELECT * FROM digital_orders ORDER BY id DESC LIMIT 500");
      res.json({ success: true, orders: rows });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.patch('/api/admin/digital-orders/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      const pgMod = await import('./storage');
      const pg = (pgMod as any).pgPool;
      await pg.query("UPDATE digital_orders SET status=$1 WHERE id=$2", [status, req.params.id]);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });



  // ── TempMail (mail.tm proxy) ──────────────────────────────────────────────
  app.post('/api/tempmail/create', async (_req, res) => {
    try {
      const axiosM = require('axios');
      // Get available domains
      const domsRes = await axiosM.get('https://api.mail.tm/domains', { headers: { 'Accept': 'application/ld+json' }, timeout: 10000 });
      const domsData = domsRes.data;
      const domains: any[] = Array.isArray(domsData) ? domsData : (domsData?.['hydra:member'] || []);
      if (!domains.length) return res.status(503).json({ success: false, error: 'No domains available' });
      const domain = domains[0].domain;
      const user = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
      const address = `${user}@${domain}`;
      const password = Math.random().toString(36).slice(2, 18);
      // Create account
      await axiosM.post('https://api.mail.tm/accounts', { address, password }, { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, timeout: 10000 });
      // Get token
      const tokRes = await axiosM.post('https://api.mail.tm/token', { address, password }, { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, timeout: 10000 });
      const token: string = tokRes.data?.token;
      if (!token) return res.status(500).json({ success: false, error: 'Token generation failed' });
      res.json({ success: true, address, token });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get('/api/tempmail/inbox', async (req, res) => {
    try {
      const { token } = req.query as { token: string };
      if (!token) return res.status(400).json({ success: false, error: 'Token required' });
      const axiosM = require('axios');
      const r = await axiosM.get('https://api.mail.tm/messages', { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/ld+json' }, timeout: 10000 });
      const messages = (r.data?.['hydra:member'] || []).map((m: any) => ({
        id: m.id, from: m.from, subject: m.subject, createdAt: m.createdAt, seen: m.seen,
      }));
      res.json({ success: true, messages });
    } catch (e: any) {
      if (e.response?.status === 401) return res.json({ success: false, expired: true });
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/tempmail/read/:id', async (req, res) => {
    try {
      const { token } = req.query as { token: string };
      if (!token) return res.status(400).json({ success: false, error: 'Token required' });
      const axiosM = require('axios');
      const r = await axiosM.get(`https://api.mail.tm/messages/${req.params.id}`, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }, timeout: 10000 });
      res.json({ success: true, message: { id: r.data.id, from: r.data.from, subject: r.data.subject, createdAt: r.data.createdAt, seen: r.data.seen, html: r.data.html, text: r.data.text } });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });



  // ── Proxy Auto-Scheduler ──────────────────────────────────────────────────
  const proxyScheduler = {
    enabled: true,
    running: false,
    lastRun: null as string|null,
    nextRun: null as string|null,
    lastStats: { fetched:0, added:0, alive:0, dead:0, deleted:0 } as Record<string,number>,
    intervalMs: 6 * 60 * 60 * 1000, // 6 hours
    timer: null as any,
  };

  async function fetchProxyScrape(protocol: string): Promise<string[]> {
    return new Promise((resolve) => {
      const httpsM = require('https') as typeof import('https');
      const url = `/v2/?request=displayproxies&protocol=${protocol}&timeout=10000&country=all&ssl=all&anonymity=all&simplified=true`;
      const r = httpsM.get({ hostname:'api.proxyscrape.com', path:url, timeout:15000 }, (res) => {
        let b=''; res.on('data',(d:Buffer)=>b+=d);
        res.on('end',()=>resolve(b.split('\n').map((l:string)=>l.trim()).filter((l:string)=>/^\d+\.\d+\.\d+\.\d+:\d+$/.test(l))));
      }); r.on('error',()=>resolve([])); r.on('timeout',()=>{r.destroy();resolve([]);});
    });
  }

  async function fetchGeonode(protocol: string): Promise<string[]> {
    return new Promise((resolve) => {
      const httpsM = require('https') as typeof import('https');
      const path = `/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc&protocols=${protocol}`;
      const r = httpsM.get({ hostname:'proxylist.geonode.com', path, timeout:15000, headers:{'User-Agent':'Mozilla/5.0'} }, (res) => {
        let b=''; res.on('data',(d:Buffer)=>b+=d);
        res.on('end',()=>{
          try { const j=JSON.parse(b); resolve((j.data||[]).map((p:any)=>`${p.ip}:${p.port}`)); }
          catch { resolve([]); }
        });
      }); r.on('error',()=>resolve([])); r.on('timeout',()=>{r.destroy();resolve([]);});
    });
  }

  async function runProxyScheduler() {
    if (proxyScheduler.running) return;
    proxyScheduler.running = true;
    const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
    const stats = { fetched:0, added:0, alive:0, dead:0, deleted:0 };
    try {
      console.log('[ProxyScheduler] Starting fetch run...');

      // 1. Fetch from all sources in parallel
      const [http1, http2, socks4_1, socks5_1, geoHttp, geoSocks4, geoSocks5] = await Promise.all([
        fetchProxyScrape('http'),
        fetchProxyScrape('https'),
        fetchProxyScrape('socks4'),
        fetchProxyScrape('socks5'),
        fetchGeonode('http'),
        fetchGeonode('socks4'),
        fetchGeonode('socks5'),
      ]);

      const sources = [
        { list: http1, type: 'HTTP' }, { list: http2, type: 'HTTPS' },
        { list: socks4_1, type: 'SOCKS4' }, { list: socks5_1, type: 'SOCKS5' },
        { list: geoHttp, type: 'HTTP' }, { list: geoSocks4, type: 'SOCKS4' },
        { list: geoSocks5, type: 'SOCKS5' },
      ];

      // 2. Insert into DB, skip duplicates
      for (const { list, type } of sources) {
        stats.fetched += list.length;
        for (const raw of list) {
          const parts = raw.split(':');
          if (parts.length !== 2) continue;
          const [ip, port] = parts;
          try {
            const res = await pg.query(
              'INSERT INTO free_proxies (raw,ip,port,username,password,type,status) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (raw) DO NOTHING',
              [raw, ip, port, '', '', type, 'unchecked']
            );
            if ((res.rowCount||0) > 0) stats.added++;
          } catch {}
        }
      }
      console.log(`[ProxyScheduler] Fetched ${stats.fetched}, added ${stats.added} new proxies`);

      // 3. Check up to 300 unchecked proxies (12 concurrent for scheduler)
      const { rows: unchecked } = await pg.query("SELECT * FROM free_proxies WHERE status='unchecked' ORDER BY id DESC LIMIT 300");
      const CONCURRENCY = 12;
      for (let i=0; i<unchecked.length; i+=CONCURRENCY) {
        const batch = unchecked.slice(i, i+CONCURRENCY);
        await Promise.all(batch.map(async (proxy: any) => {
          const result = await checkSingleProxy(proxy.ip, proxy.port);
          const status = result.alive ? 'alive' : 'dead';
          if (result.alive) stats.alive++; else stats.dead++;
          await pg.query(
            'UPDATE free_proxies SET status=$1,speed_ms=$2,country=$3,country_code=$4,anonymity=$5,last_checked=NOW()::text WHERE id=$6',
            [status, result.speed_ms, result.country, result.country_code, result.anonymity, proxy.id]
          ).catch(()=>{});
        }));
      }
      console.log(`[ProxyScheduler] Checked ${unchecked.length}: ${stats.alive} alive, ${stats.dead} dead`);

      // 4. Delete dead proxies older than 48 hours
      const { rowCount } = await pg.query(
        "DELETE FROM free_proxies WHERE status='dead' AND last_checked < (NOW() - INTERVAL '48 hours')::text"
      );
      stats.deleted = rowCount||0;
      console.log(`[ProxyScheduler] Deleted ${stats.deleted} stale dead proxies`);

    } catch (e:any) { console.error('[ProxyScheduler] Error:', e.message); }
    finally {
      proxyScheduler.running = false;
      proxyScheduler.lastRun = new Date().toISOString();
      proxyScheduler.lastStats = stats;
      // Set next run
      const next = new Date(Date.now() + proxyScheduler.intervalMs);
      proxyScheduler.nextRun = next.toISOString();
    }
  }

  function startProxySchedulerTimer() {
    if (proxyScheduler.timer) clearInterval(proxyScheduler.timer);
    proxyScheduler.timer = setInterval(() => {
      if (proxyScheduler.enabled) runProxyScheduler();
    }, proxyScheduler.intervalMs);
    proxyScheduler.nextRun = new Date(Date.now() + proxyScheduler.intervalMs).toISOString();
  }

  // Start scheduler: first run after 2 minutes, then every 6 hours
  setTimeout(() => {
    if (proxyScheduler.enabled) runProxyScheduler();
    startProxySchedulerTimer();
  }, 2 * 60 * 1000);
  console.log('[ProxyScheduler] Started — first run in 2 min, then every 6 hours');

  // Admin endpoints for scheduler control
  app.get('/api/admin/proxy-scheduler/status', (_req: any, res: any) => {
    res.json({ success: true, ...proxyScheduler, timer: undefined });
  });
  app.post('/api/admin/proxy-scheduler/toggle', (req: any, res: any) => {
    proxyScheduler.enabled = req.body.enabled !== false ? !proxyScheduler.enabled : false;
    if (req.body.enabled !== undefined) proxyScheduler.enabled = !!req.body.enabled;
    if (!proxyScheduler.enabled) {
      if (proxyScheduler.timer) clearInterval(proxyScheduler.timer);
      proxyScheduler.timer = null; proxyScheduler.nextRun = null;
    } else { startProxySchedulerTimer(); }
    res.json({ success: true, enabled: proxyScheduler.enabled });
  });
  app.post('/api/admin/proxy-scheduler/run', (_req: any, res: any) => {
    if (proxyScheduler.running) return res.json({ success: false, error: 'Already running' });
    runProxyScheduler().catch(()=>{});
    res.json({ success: true, message: 'Scheduler triggered — check status in a few minutes' });
  });



  // ── Background scheduler: auto-deploy pending orders every 5 minutes ────────
  const RUN_DEPLOY = () => deployPendingOrders().catch((e: any) => console.error("[Scheduler]", e.message));
  setTimeout(() => { RUN_DEPLOY(); setInterval(RUN_DEPLOY, 5 * 60 * 1000); }, 30 * 1000);
  console.log("[Bot Routes] Background deploy scheduler started (runs every 5 min, first run in 30s)");


  // ── Gift Cards ─────────────────────────────────────────────────────────────
  app.get('/api/giftcards/products', async (_req, res) => {
    try {
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      const { rows } = await pg.query(`SELECT p.*, COUNT(s.id) FILTER (WHERE s.is_sold=false) AS stock_count FROM gift_card_products p LEFT JOIN gift_card_stock s ON s.product_id=p.id WHERE p.is_active=true GROUP BY p.id ORDER BY p.sort_order ASC, p.id ASC`);
      res.json({ success: true, products: rows.map((r:any)=>({...r,stock_count:parseInt(r.stock_count)||0})) });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/giftcards/order', async (req, res) => {
    try {
      const { productId, email } = req.body;
      if (!productId || !email) return res.status(400).json({ success: false, error: 'Product and email required' });
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      const { rows: prods } = await pg.query("SELECT * FROM gift_card_products WHERE id=$1 AND is_active=true", [productId]);
      if (!prods.length) return res.status(404).json({ success: false, error: 'Product not found' });
      const product = prods[0];
      const { rows: stock } = await pg.query("SELECT id FROM gift_card_stock WHERE product_id=$1 AND is_sold=false LIMIT 1", [productId]);
      if (!stock.length) return res.status(400).json({ success: false, error: 'Out of stock' });
      const ref = 'GC-' + Date.now() + '-' + Math.random().toString(36).slice(2,7).toUpperCase();
      await pg.query("INSERT INTO gift_card_orders (reference,customer_email,product_id,product_name,brand,denomination,currency,amount_kes,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') ON CONFLICT DO NOTHING",
        [ref, email, product.id, product.name, product.brand, product.denomination, product.currency, product.price_kes]);
      const httpsM = require('https') as typeof import('https');
      const paystackBody = JSON.stringify({ email, amount: Math.round(product.price_kes*100), reference: ref, currency: 'KES', metadata: { type:'gift_card', productId: product.id }, callback_url: (process.env.BASE_URL||'') + '/giftcards?ref=' + ref });
      const psRes = await new Promise<any>((resolve,reject) => {
        const r = httpsM.request({ hostname:'api.paystack.co', path:'/transaction/initialize', method:'POST', headers:{'Authorization':'Bearer '+process.env.PAYSTACK_SECRET_KEY,'Content-Type':'application/json','Content-Length':Buffer.byteLength(paystackBody)} }, (resp) => { let d=''; resp.on('data',(c:Buffer)=>d+=c); resp.on('end',()=>resolve(JSON.parse(d))); }); r.on('error',reject); r.write(paystackBody); r.end();
      });
      if (!psRes.status) return res.status(500).json({ success: false, error: 'Payment init failed' });
      res.json({ success: true, paymentUrl: psRes.data.authorization_url });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/giftcards/verify/:reference', async (req, res) => {
    try {
      const { reference } = req.params;
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      const { rows: orders } = await pg.query("SELECT * FROM gift_card_orders WHERE reference=$1", [reference]);
      if (!orders.length) return res.status(404).json({ success: false, error: 'Order not found' });
      const order = orders[0];
      if (order.status === 'delivered' && order.code) return res.json({ success: true, code: order.code });
      const httpsM = require('https') as typeof import('https');
      const psCheck = await new Promise<any>((resolve) => {
        const r = httpsM.request({ hostname:'api.paystack.co', path:'/transaction/verify/'+reference, method:'GET', headers:{'Authorization':'Bearer '+process.env.PAYSTACK_SECRET_KEY} }, (resp) => { let d=''; resp.on('data',(c:Buffer)=>d+=c); resp.on('end',()=>{try{resolve(JSON.parse(d));}catch{resolve({data:{status:'failed'}});}}); }); r.on('error',()=>resolve({data:{status:'failed'}})); r.end();
      });
      if (psCheck.data?.status !== 'success') return res.status(402).json({ success: false, error: 'Payment not confirmed' });
      const { rows: stock } = await pg.query("SELECT * FROM gift_card_stock WHERE product_id=$1 AND is_sold=false LIMIT 1 FOR UPDATE SKIP LOCKED", [order.product_id]);
      if (!stock.length) return res.status(400).json({ success: false, error: 'Out of stock - contact support' });
      const item = stock[0];
      await pg.query("UPDATE gift_card_stock SET is_sold=true,sold_to_email=$1,sold_at=NOW()::text WHERE id=$2", [order.customer_email, item.id]);
      await pg.query("UPDATE gift_card_orders SET status='delivered',code=$1,stock_id=$2 WHERE reference=$3", [item.code, item.id, reference]);
      res.json({ success: true, code: item.code });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin Gift Cards
  app.get('/api/admin/gift-card-products', async (_req, res) => {
    try {
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      const { rows } = await pg.query(`SELECT p.*, COUNT(s.id) FILTER (WHERE s.is_sold=false) AS stock_count, COUNT(s.id) AS total_stock FROM gift_card_products p LEFT JOIN gift_card_stock s ON s.product_id=p.id GROUP BY p.id ORDER BY p.sort_order ASC, p.id ASC`);
      res.json({ success: true, products: rows.map((r:any)=>({...r,stock_count:parseInt(r.stock_count)||0,total_stock:parseInt(r.total_stock)||0})) });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });
  app.post('/api/admin/gift-card-products', async (req, res) => {
    try {
      const { name, brand, denomination, currency, price_kes, description, is_active, sort_order } = req.body;
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      const { rows } = await pg.query("INSERT INTO gift_card_products (name,brand,denomination,currency,price_kes,description,is_active,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [name, brand, denomination||'', currency||'USD', price_kes, description||'', is_active!==false, sort_order||0]);
      res.json({ success: true, product: rows[0] });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });
  app.put('/api/admin/gift-card-products/:id', async (req, res) => {
    try {
      const { name, brand, denomination, currency, price_kes, description, is_active, sort_order } = req.body;
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      await pg.query("UPDATE gift_card_products SET name=COALESCE($1,name),brand=COALESCE($2,brand),denomination=COALESCE($3,denomination),currency=COALESCE($4,currency),price_kes=COALESCE($5,price_kes),description=COALESCE($6,description),is_active=COALESCE($7,is_active),sort_order=COALESCE($8,sort_order) WHERE id=$9",
        [name, brand, denomination, currency, price_kes, description, is_active, sort_order, req.params.id]);
      res.json({ success: true });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });
  app.delete('/api/admin/gift-card-products/:id', async (req, res) => {
    try { const pgMod = await import('./storage'); const pg = (pgMod as any).pgPool; await pg.query("DELETE FROM gift_card_products WHERE id=$1",[req.params.id]); res.json({ success: true }); } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });
  app.post('/api/admin/gift-card-products/:id/stock', async (req, res) => {
    try {
      const { codes } = req.body;
      const lines = (codes||'').split('\n').map((l:string)=>l.trim()).filter((l:string)=>l.length>0);
      if (!lines.length) return res.status(400).json({ success: false, error: 'No codes provided' });
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      let added=0; for (const code of lines) { try { await pg.query("INSERT INTO gift_card_stock (product_id,code) VALUES ($1,$2)",[req.params.id,code]); added++; } catch {} }
      res.json({ success: true, added });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });
  app.get('/api/admin/gift-card-orders', async (_req, res) => {
    try { const pgMod = await import('./storage'); const pg = (pgMod as any).pgPool; const { rows } = await pg.query("SELECT * FROM gift_card_orders ORDER BY id DESC LIMIT 500"); res.json({ success: true, orders: rows }); } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ── Bulk SMS ───────────────────────────────────────────────────────────────
  app.get('/api/sms/plans', async (_req, res) => {
    try { const pgMod = await import('./storage'); const pg = (pgMod as any).pgPool; const { rows } = await pg.query("SELECT * FROM sms_plans WHERE is_active=true ORDER BY sms_count ASC"); res.json({ success: true, plans: rows }); } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });
  app.post('/api/sms/order', async (req, res) => {
    try {
      const { planId, email, senderNote } = req.body;
      if (!planId || !email) return res.status(400).json({ success: false, error: 'Plan and email required' });
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      const { rows: plans } = await pg.query("SELECT * FROM sms_plans WHERE id=$1 AND is_active=true",[planId]);
      if (!plans.length) return res.status(404).json({ success: false, error: 'Plan not found' });
      const plan = plans[0];
      const ref = 'SMS-' + Date.now() + '-' + Math.random().toString(36).slice(2,7).toUpperCase();
      await pg.query("INSERT INTO sms_orders (reference,customer_email,plan_id,plan_name,sms_count,amount_kes,sender_note,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') ON CONFLICT DO NOTHING",
        [ref, email, plan.id, plan.name, plan.sms_count, plan.price_kes, senderNote||'']);
      const httpsM = require('https') as typeof import('https');
      const paystackBody = JSON.stringify({ email, amount: Math.round(plan.price_kes*100), reference: ref, currency: 'KES', metadata: { type:'sms', planId: plan.id }, callback_url: (process.env.BASE_URL||'') + '/sms' });
      const psRes = await new Promise<any>((resolve,reject) => {
        const r = httpsM.request({ hostname:'api.paystack.co', path:'/transaction/initialize', method:'POST', headers:{'Authorization':'Bearer '+process.env.PAYSTACK_SECRET_KEY,'Content-Type':'application/json','Content-Length':Buffer.byteLength(paystackBody)} }, (resp) => { let d=''; resp.on('data',(c:Buffer)=>d+=c); resp.on('end',()=>resolve(JSON.parse(d))); }); r.on('error',reject); r.write(paystackBody); r.end();
      });
      if (!psRes.status) return res.status(500).json({ success: false, error: 'Payment init failed' });
      res.json({ success: true, paymentUrl: psRes.data.authorization_url });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });
  app.get('/api/admin/sms-plans', async (_req, res) => {
    try { const pgMod = await import('./storage'); const pg = (pgMod as any).pgPool; const { rows } = await pg.query("SELECT * FROM sms_plans ORDER BY sms_count ASC"); res.json({ success: true, plans: rows }); } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });
  app.post('/api/admin/sms-plans', async (req, res) => {
    try {
      const { name, sms_count, price_kes, description, features, is_active, sort_order, validity_days } = req.body;
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      const { rows } = await pg.query("INSERT INTO sms_plans (name,sms_count,price_kes,description,features,is_active,sort_order,validity_days) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [name, sms_count, price_kes, description||'', features||'', is_active!==false, sort_order||0, validity_days||30]);
      res.json({ success: true, plan: rows[0] });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });
  app.put('/api/admin/sms-plans/:id', async (req, res) => {
    try {
      const { name, sms_count, price_kes, description, features, is_active, sort_order, validity_days } = req.body;
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      await pg.query("UPDATE sms_plans SET name=COALESCE($1,name),sms_count=COALESCE($2,sms_count),price_kes=COALESCE($3,price_kes),description=COALESCE($4,description),features=COALESCE($5,features),is_active=COALESCE($6,is_active),sort_order=COALESCE($7,sort_order),validity_days=COALESCE($8,validity_days) WHERE id=$9",
        [name,sms_count,price_kes,description,features,is_active,sort_order,validity_days,req.params.id]);
      res.json({ success: true });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });
  app.delete('/api/admin/sms-plans/:id', async (req, res) => {
    try { const pgMod = await import('./storage'); const pg = (pgMod as any).pgPool; await pg.query("DELETE FROM sms_plans WHERE id=$1",[req.params.id]); res.json({ success: true }); } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });
  app.get('/api/admin/sms-orders', async (_req, res) => {
    try { const pgMod = await import('./storage'); const pg = (pgMod as any).pgPool; const { rows } = await pg.query("SELECT * FROM sms_orders ORDER BY id DESC LIMIT 500"); res.json({ success: true, orders: rows }); } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });
  app.patch('/api/admin/sms-orders/:id/fulfill', async (req, res) => {
    try {
      const { notes } = req.body;
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      await pg.query("UPDATE sms_orders SET status='fulfilled',notes=$1 WHERE id=$2",[notes||'',req.params.id]);
      res.json({ success: true });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ── Customer All Orders (unified history) ──────────────────────────────────
  app.get('/api/customer/all-orders', async (req: any, res) => {
    try {
      const token = (req.headers.authorization||'').replace('Bearer ','');
      if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });
      const pgMod = await import('./storage');
    const pg = (pgMod as any).getPgPool?.();
    if (!pg) {
      console.log('[ProxyScheduler] PostgreSQL pool not ready — skipping run');
      proxyScheduler.running = false;
      return;
    }
      // Get email from customer token via existing sessions/customer lookup
      const { rows: sessions } = await pg.query("SELECT email FROM customers WHERE session_token=$1 OR id=(SELECT customer_id FROM customer_sessions WHERE token=$1 LIMIT 1) LIMIT 1",[token]).catch(()=>({rows:[]}));
      let email = sessions[0]?.email;
      if (!email) {
        // Try JWT decode
        try { const jwt = require('jsonwebtoken'); const decoded: any = jwt.verify(token, process.env.JWT_SECRET||process.env.SESSION_SECRET||'secret'); email = decoded.email; } catch {}
      }
      if (!email) return res.status(401).json({ success: false, error: 'Invalid token' });
      const results: any[] = [];
      // SMM orders
      try { const { rows } = await pg.query("SELECT id,reference,created_at,amount_kes,status,'smm' AS type,'SMM Boost' AS category,service AS name FROM smm_orders WHERE customer_email=$1 ORDER BY id DESC LIMIT 50",[email]); results.push(...rows); } catch {}
      // Proxy orders
      try { const { rows } = await pg.query("SELECT id,reference,created_at,amount_kes,status,'proxy' AS type,'Proxy Plan' AS category,plan_name AS name FROM proxy_orders WHERE customer_email=$1 ORDER BY id DESC LIMIT 50",[email]); results.push(...rows); } catch {}
      // Digital (aged accounts)
      try { const { rows } = await pg.query("SELECT id,reference,created_at,amount_kes,status,'digital' AS type,'Aged Account' AS category,product_name AS name FROM digital_orders WHERE customer_email=$1 ORDER BY id DESC LIMIT 50",[email]); results.push(...rows); } catch {}
      // Gift cards
      try { const { rows } = await pg.query("SELECT id,reference,created_at,amount_kes,status,'giftcard' AS type,'Gift Card' AS category,product_name AS name FROM gift_card_orders WHERE customer_email=$1 ORDER BY id DESC LIMIT 50",[email]); results.push(...rows); } catch {}
      // SMS orders
      try { const { rows } = await pg.query("SELECT id,reference,created_at,amount_kes,status,'sms' AS type,'Bulk SMS' AS category,plan_name AS name FROM sms_orders WHERE customer_email=$1 ORDER BY id DESC LIMIT 50",[email]); results.push(...rows); } catch {}
      // Sort all by date desc
      results.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
      res.json({ success: true, orders: results.slice(0,200), email });
    } catch (e:any) { res.status(500).json({ success: false, error: e.message }); }
  });


}

