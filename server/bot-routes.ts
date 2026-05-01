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

    // ── Background scheduler: auto-deploy pending orders every 5 minutes ────────
  const RUN_DEPLOY = () => deployPendingOrders().catch((e: any) => console.error("[Scheduler]", e.message));
  setTimeout(() => { RUN_DEPLOY(); setInterval(RUN_DEPLOY, 5 * 60 * 1000); }, 30 * 1000);
  console.log("[Bot Routes] Background deploy scheduler started (runs every 5 min, first run in 30s)");

}

