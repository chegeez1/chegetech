import cron from "node-cron";
import { storage } from "./storage";
import { sendTelegramMessage } from "./telegram";
import { getAppConfig } from "./app-config";
import { dbSettingsGet, dbSettingsSet } from "./storage";
import { sendAdminEmail, sendBulkEmail, sendRawEmail } from "./email";
import { runQuery, runMutation, dbType } from "./storage";
import { vpsManager } from "./vps-manager";

// ─── Daily: check expiring accounts + renewal reminders ───────────────────

async function checkExpiringAccounts() {
  try {
    const txs = await storage.getAllTransactions();
    const { siteName } = getAppConfig();
    const now = new Date();
    const storeUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "";

    const REMINDER_DAYS = [7, 3, 1];

    const expiringWithin7 = txs.filter((t: any) => {
      if (t.status !== "success" || !t.expiresAt) return false;
      const exp = new Date(t.expiresAt);
      return exp > now && exp <= new Date(now.getTime() + 7 * 86400000);
    });

    for (const tx of expiringWithin7) {
      if (!tx.customerEmail) continue;
      const exp = new Date(tx.expiresAt!);
      const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
      const expDate = exp.toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" });

      for (const day of REMINDER_DAYS) {
        if (daysLeft > day) continue; // too far away
        const key = `renewal_reminder_${tx.reference}_${day}d`;
        if (dbSettingsGet(key)) continue; // already sent this reminder
        dbSettingsSet(key, new Date().toISOString());

        const urgency = day === 1 ? "🚨 Last Day!" : day === 3 ? "⚠️ 3 Days Left" : "⏰ 7 Days Left";
        const badgeBg = day === 1 ? "#EF4444" : day === 3 ? "#F59E0B" : "#4F46E5";

        const html = `<!DOCTYPE html><html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
    <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:28px;text-align:center;">
      <span style="background:${badgeBg};color:#fff;font-size:12px;font-weight:700;padding:4px 14px;border-radius:99px;letter-spacing:.5px;">${urgency}</span>
      <h1 style="color:#fff;margin:14px 0 4px;font-size:20px;">${siteName}</h1>
      <p style="color:rgba(255,255,255,.75);margin:0;font-size:13px;">Subscription Renewal Reminder</p>
    </div>
    <div style="padding:28px;">
      <p style="color:#374151;font-size:15px;margin:0 0 12px;">Hi there,</p>
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">
        Your <strong>${tx.planName}</strong> subscription expires on <strong>${expDate}</strong>
        — that's <strong>${daysLeft === 1 ? "today!" : `in ${daysLeft} days`}</strong>
      </p>
      <a href="${storeUrl}" style="display:inline-block;background:#4F46E5;color:#fff;padding:13px 28px;border-radius:9px;text-decoration:none;font-weight:700;font-size:15px;">
        Renew Now →
      </a>
      <p style="color:#9CA3AF;font-size:12px;margin-top:20px;">Renew before it expires to keep uninterrupted access.</p>
    </div>
    <div style="background:#F9FAFB;padding:14px;text-align:center;border-top:1px solid #F3F4F6;">
      <p style="font-size:11px;color:#aaa;margin:0;">&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
    </div>
  </div>
</body></html>`;

        await sendRawEmail(
          tx.customerEmail,
          `${urgency} — Your ${tx.planName} expires on ${expDate}`,
          html
        ).catch(() => {});
        break; // only send the most urgent one per run
      }
    }

    const expiring3 = expiringWithin7.filter((t: any) => {
      const exp = new Date(t.expiresAt!);
      return exp <= new Date(now.getTime() + 3 * 86400000);
    });

    if (expiring3.length > 0) {
      await sendTelegramMessage(
        `⏰ <b>Expiry Alert</b>\n\n${expiring3.length} subscription(s) expire in ≤3 days:\n` +
        expiring3.slice(0, 10).map((t: any) => `• ${t.planName} — ${t.customerEmail} (${new Date(t.expiresAt).toLocaleDateString()})`).join("\n")
      );
    }
  } catch (err: any) {
    console.error("[cron] Expiry check error:", err.message);
  }
}

// ─── Weekly: revenue report ────────────────────────────────────────────────

async function weeklyReport() {
  try {
    const txs = await storage.getAllTransactions();
    const customers = await storage.getAllCustomers();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const weekDone = txs.filter((t: any) => t.status === "success" && new Date(t.createdAt || 0) >= weekAgo);
    const weekRev = weekDone.reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const allDone = txs.filter((t: any) => t.status === "success");
    const allRev = allDone.reduce((s: number, t: any) => s + (t.amount || 0), 0);

    const planCounts: Record<string, number> = {};
    for (const t of weekDone) { planCounts[t.planName] = (planCounts[t.planName] || 0) + 1; }
    const topPlan = Object.entries(planCounts).sort((a, b) => b[1] - a[1])[0];

    const msg =
      `📊 <b>Weekly Report</b>\n\n` +
      `📅 <b>This week</b>\n` +
      `• Orders: ${weekDone.length}\n` +
      `• Revenue: KES ${weekRev.toLocaleString()}\n` +
      `• Top plan: ${topPlan ? `${topPlan[0]} (${topPlan[1]}×)` : "N/A"}\n\n` +
      `📈 <b>All time</b>\n` +
      `• Total orders: ${allDone.length}\n` +
      `• Total revenue: KES ${allRev.toLocaleString()}\n` +
      `• Total customers: ${customers.length}`;

    await sendTelegramMessage(msg);
    await sendAdminEmail(
      "📊 Weekly Business Report",
      `<pre style="font-family:sans-serif">${msg.replace(/<[^>]*>/g, "")}</pre>`
    );
  } catch (err: any) {
    console.error("[cron] Weekly report error:", err.message);
  }
}

// ─── Scheduled email campaigns ─────────────────────────────────────────────

export async function checkScheduledCampaigns() {
  try {
    const raw = dbSettingsGet("email_campaigns");
    if (!raw) return;
    const campaigns: any[] = JSON.parse(raw);
    const now = new Date();
    let changed = false;

    for (const c of campaigns) {
      if (c.status !== "scheduled" || !c.scheduledAt) continue;
      if (new Date(c.scheduledAt) <= now) {
        c.status = "sending";
        changed = true;
        sendScheduledCampaign(c).catch(() => {});
      }
    }

    if (changed) {
      const { dbSettingsSet } = await import("./storage");
      dbSettingsSet("email_campaigns", JSON.stringify(campaigns));
    }
  } catch {}
}

async function sendScheduledCampaign(campaign: any) {
  try {
    const { sendBulkEmail } = await import("./email");
    const customers = await storage.getAllCustomers();
    let recipients: string[] = customers.map((c: any) => c.email).filter(Boolean);

    if (campaign.segment === "active") {
      const txs = await storage.getAllTransactions();
      const activeEmails = new Set(txs.filter((t: any) => t.status === "success").map((t: any) => t.customerEmail));
      recipients = recipients.filter(e => activeEmails.has(e));
    } else if (campaign.segment === "recent") {
      const txs = await storage.getAllTransactions();
      const cutoff = new Date(Date.now() - 30 * 86400000);
      const recentEmails = new Set(txs.filter((t: any) => t.status === "success" && new Date(t.createdAt || 0) >= cutoff).map((t: any) => t.customerEmail));
      recipients = recipients.filter(e => recentEmails.has(e));
    }

    if (!recipients.length) return;
    await sendBulkEmail(recipients, campaign.subject, `<div style="font-family:sans-serif;line-height:1.6">${campaign.body.replace(/\n/g, "<br>")}</div>`);

    const raw = dbSettingsGet("email_campaigns");
    if (raw) {
      const campaigns: any[] = JSON.parse(raw);
      const idx = campaigns.findIndex((c: any) => c.id === campaign.id);
      if (idx !== -1) {
        campaigns[idx].status = "sent";
        campaigns[idx].sentAt = new Date().toISOString();
        campaigns[idx].sentCount = recipients.length;
        const { dbSettingsSet } = await import("./storage");
        dbSettingsSet("email_campaigns", JSON.stringify(campaigns));
      }
    }
  } catch (err: any) {
    console.error("[campaign] Error sending campaign:", err.message);
  }
}

// ─── Monthly: spending summary per customer ────────────────────────────────

// RETAIL_MULTIPLIER: shared plans are ~46% cheaper than retail, so retail ≈ totalSpent × 1.85
const RETAIL_MULTIPLIER = 1.85;

// Escape HTML entities in values interpolated into email templates
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

export async function sendMonthlySummaries(targetEmail?: string, mode: "previous_month" | "current_month" = "previous_month") {
  try {
    const { siteName } = getAppConfig();
    const storeUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "";

    const now = new Date();

    let periodStart: number;
    let periodEnd: number;
    let periodDate: Date;

    if (mode === "current_month") {
      // Current month, 1st to now (for manual trigger / testing)
      periodDate  = new Date(now.getFullYear(), now.getMonth(), 1);
      periodStart = periodDate.getTime();
      periodEnd   = now.getTime();
    } else {
      // Previous full calendar month (default — used by cron)
      periodDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      periodStart = periodDate.getTime();
      periodEnd   = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    const monthName = periodDate.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
    const dedupKey  = `${periodDate.getFullYear()}_${String(periodDate.getMonth() + 1).padStart(2, "0")}`;

    const txs = await storage.getAllTransactions();
    const customers = await storage.getAllCustomers();

    let sent = 0;

    for (const customer of customers as any[]) {
      if (!customer.email) continue;
      if (targetEmail && customer.email.toLowerCase() !== targetEmail.toLowerCase()) continue;

      const dedup = `monthly_summary_${customer.id}_${dedupKey}`;
      // Dedup is only applied/written for the cron mode (previous_month).
      // Manual current_month triggers never read or write the dedup key,
      // so they cannot interfere with the next scheduled cron run.
      if (mode === "previous_month" && !targetEmail && dbSettingsGet(dedup)) continue;

      // Filter this customer's successful orders in the period (case-insensitive email match)
      const customerEmailLower = customer.email.toLowerCase();
      const orders = txs.filter((t: any) =>
        t.status === "success" &&
        (t.customerEmail || "").toLowerCase() === customerEmailLower &&
        new Date(t.createdAt || 0).getTime() >= periodStart &&
        new Date(t.createdAt || 0).getTime() < periodEnd
      );

      if (orders.length === 0) continue;

      const totalSpent = orders.reduce((s: number, t: any) => s + (t.amount || 0), 0);
      // Retail equivalent: shared plans are ~46% cheaper, so direct cost ≈ totalSpent × 1.85
      const estimatedRetail = Math.round(totalSpent * RETAIL_MULTIPLIER);
      const estimatedSavings = estimatedRetail - totalSpent;

      // Build order rows
      const orderRows = orders.map((t: any) => {
        const date = new Date(t.createdAt || 0).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
        const safePlanName = escHtml(t.planName || "Subscription");
        return `<tr>
          <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #F3F4F6;">${safePlanName}</td>
          <td style="padding:10px 12px;font-size:13px;color:#6B7280;border-bottom:1px solid #F3F4F6;">${date}</td>
          <td style="padding:10px 12px;font-size:13px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #F3F4F6;">KES ${(t.amount || 0).toLocaleString()}</td>
        </tr>`;
      }).join("");

      const firstName = escHtml((customer.name || "there").split(" ")[0]);
      const safeMonthName = escHtml(monthName);
      const safeSiteName  = escHtml(siteName);

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${safeMonthName} Spending Summary</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.12);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:36px 32px;text-align:center;">
      <p style="color:rgba(255,255,255,.7);font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">Monthly Summary</p>
      <h1 style="color:#fff;margin:0 0 6px;font-size:26px;font-weight:800;">${safeMonthName}</h1>
      <p style="color:rgba(255,255,255,.75);margin:0;font-size:14px;">${safeSiteName}</p>
    </div>

    <!-- Greeting -->
    <div style="padding:28px 32px 0;">
      <p style="color:#374151;font-size:16px;margin:0 0 6px;">Hi <strong>${firstName}</strong> 👋</p>
      <p style="color:#6B7280;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Here's a look at what you unlocked in <strong>${safeMonthName}</strong> — ${orders.length} subscription${orders.length !== 1 ? "s" : ""} at a fraction of the direct price.
      </p>
    </div>

    <!-- Orders table -->
    <div style="padding:0 32px 20px;">
      <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #F3F4F6;">
        <thead>
          <tr style="background:#F9FAFB;">
            <th style="padding:10px 12px;font-size:11px;color:#9CA3AF;font-weight:600;text-align:left;text-transform:uppercase;letter-spacing:.5px;">Plan</th>
            <th style="padding:10px 12px;font-size:11px;color:#9CA3AF;font-weight:600;text-align:left;text-transform:uppercase;letter-spacing:.5px;">Date</th>
            <th style="padding:10px 12px;font-size:11px;color:#9CA3AF;font-weight:600;text-align:right;text-transform:uppercase;letter-spacing:.5px;">Paid</th>
          </tr>
        </thead>
        <tbody>
          ${orderRows}
        </tbody>
      </table>
    </div>

    <!-- Totals card -->
    <div style="padding:0 32px 28px;">
      <div style="background:linear-gradient(135deg,rgba(79,70,229,.07) 0%,rgba(124,58,237,.07) 100%);border:1px solid rgba(99,102,241,.2);border-radius:14px;padding:22px 24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="color:#6B7280;font-size:14px;">Total spent in ${safeMonthName}</span>
          <span style="color:#111827;font-size:20px;font-weight:800;">KES ${totalSpent.toLocaleString()}</span>
        </div>
        <div style="height:1px;background:rgba(99,102,241,.15);margin-bottom:12px;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#6B7280;font-size:13px;">Estimated retail value</span>
          <span style="color:#9CA3AF;font-size:14px;text-decoration:line-through;">KES ${estimatedRetail.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <span style="color:#10B981;font-size:13px;font-weight:600;">You saved approximately</span>
          <span style="color:#10B981;font-size:16px;font-weight:800;">KES ${estimatedSavings.toLocaleString()}</span>
        </div>
        <p style="color:#9CA3AF;font-size:11px;margin:10px 0 0;line-height:1.5;">
          *Savings estimated vs buying subscriptions individually at full retail price.
        </p>
      </div>
    </div>

    <!-- CTA -->
    <div style="padding:0 32px 32px;text-align:center;">
      <a href="${storeUrl}" style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.3px;">
        Shop Again →
      </a>
      <p style="color:#9CA3AF;font-size:12px;margin:16px 0 0;">
        Keep saving every month with ${safeSiteName}.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #F3F4F6;text-align:center;">
      <p style="font-size:11px;color:#D1D5DB;margin:0;">
        &copy; ${now.getFullYear()} ${safeSiteName}. All rights reserved.<br>
        <span style="color:#E5E7EB;">To unsubscribe from summary emails, contact support.</span>
      </p>
    </div>
  </div>
</body>
</html>`;

      const emailOk = await sendRawEmail(
        customer.email,
        `Your ${safeMonthName} Spending Summary — ${safeSiteName}`,
        html
      ).then(() => true).catch((e: any) => {
        console.warn(`[cron][monthly-summary] Failed to send to ${customer.email}:`, e.message);
        return false;
      });

      if (emailOk) {
        // Write dedup key ONLY for cron (previous_month) mode to avoid poisoning
        // the cron dedup for a future scheduled run with a manual "send-all" test.
        if (mode === "previous_month" && !targetEmail) {
          dbSettingsSet(dedup, new Date().toISOString());
        }
        sent++;
      }
    }

    console.log(`[cron][monthly-summary] Sent ${sent} summary emails for ${monthName}`);
    return sent;
  } catch (err: any) {
    console.error("[cron] Monthly summary error:", err.message);
    return 0;
  }
}


  // ─── Daily: check expiring & expired bot orders ──────────────────────────────

  async function checkExpiringBotOrders() {
    try {
      const { siteName } = getAppConfig();
      const rows: any[] = await runQuery(
        "SELECT * FROM bot_orders WHERE (status = 'deployed' OR status = 'suspended') AND expires_at IS NOT NULL AND expires_at != ''"
      ).catch(() => []);
      if (!rows.length) return;

      const now = new Date();
      const REMINDER_DAYS = [7, 3, 1];
      const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";

      for (const order of rows) {
        if (!order.expires_at) continue;
        const exp = new Date(order.expires_at);
        const msLeft = exp.getTime() - now.getTime();
        const daysLeft = msLeft / 86400000;

        // ── Already expired and still deployed → suspend ──────────────────────
        if (daysLeft <= 0 && order.status === "deployed") {
          try {
            if (order.pm2_name && order.vps_server_id) {
              const servers = vpsManager.getAll();
              const server = servers.find((s: any) => s.id === order.vps_server_id);
              if (server) await vpsManager.execCommand(server, `pm2 stop ${order.pm2_name}`).catch(() => {});
            }
          } catch (e: any) { console.warn("[cron][bot-expiry] PM2 stop failed:", e.message); }
          await runMutation(
            `UPDATE bot_orders SET status = 'suspended', updated_at = ${updNow} WHERE id = ?`,
            [order.id]
          ).catch(() => {});
          if (order.customer_email) {
            const expDate = exp.toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" });
            const html = `<!DOCTYPE html><html>
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
      <div style="background:linear-gradient(135deg,#EF4444 0%,#DC2626 100%);padding:28px;text-align:center;">
        <span style="background:#fff;color:#EF4444;font-size:12px;font-weight:700;padding:4px 14px;border-radius:99px;">Bot Suspended</span>
        <h1 style="color:#fff;margin:14px 0 4px;font-size:20px;">${siteName}</h1>
      </div>
      <div style="padding:28px;">
        <p style="color:#374151;font-size:15px;">Your bot subscription has expired. Your bot <strong>${order.reference}</strong> has been suspended as of <strong>${expDate}</strong>.</p>
        <p style="color:#374151;font-size:15px;">To restore your bot, please renew your subscription.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${process.env.APP_URL || ""}/bots" style="background:#4F46E5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Renew Now</a>
        </div>
      </div>
    </div>
  </body></html>`;
            await sendRawEmail(order.customer_email, `Your Bot Has Been Suspended — ${siteName}`, html).catch(() => {});
          }
          console.log(`[cron][bot-expiry] Suspended bot order ${order.reference}`);
          continue;
        }

        // ── Send renewal reminder emails ───────────────────────────────────────
        if (daysLeft > 0 && order.status === "deployed") {
          for (const day of REMINDER_DAYS) {
            if (daysLeft > day) continue;
            const key = `bot_renewal_reminder_${order.reference}_${day}d`;
            if (dbSettingsGet(key)) continue;
            dbSettingsSet(key, new Date().toISOString());

            const urgency = day === 1 ? "🚨 Last Day!" : day === 3 ? "⚠️ 3 Days Left" : "⏰ 7 Days Left";
            const badgeBg = day === 1 ? "#EF4444" : day === 3 ? "#F59E0B" : "#4F46E5";
            const expDate = exp.toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" });

            if (order.customer_email) {
              const html = `<!DOCTYPE html><html>
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
      <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:28px;text-align:center;">
        <span style="background:${badgeBg};color:#fff;font-size:12px;font-weight:700;padding:4px 14px;border-radius:99px;letter-spacing:.5px;">${urgency}</span>
        <h1 style="color:#fff;margin:14px 0 4px;font-size:20px;">${siteName}</h1>
        <p style="color:rgba(255,255,255,.75);margin:0;font-size:13px;">Bot Subscription Renewal Reminder</p>
      </div>
      <div style="padding:28px;">
        <p style="color:#374151;font-size:15px;margin:0 0 12px;">Hi there,</p>
        <p style="color:#374151;font-size:15px;">Your bot subscription (ref: <strong>${order.reference}</strong>) expires on <strong>${expDate}</strong> — that's in ${Math.ceil(daysLeft)} day${Math.ceil(daysLeft) !== 1 ? "s" : ""}.</p>
        <p style="color:#374151;font-size:15px;">Renew before it expires to keep your bot running without interruption.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${process.env.APP_URL || ""}/bots" style="background:#4F46E5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Renew Subscription</a>
        </div>
        <p style="color:#6B7280;font-size:13px;text-align:center;">If not renewed by ${expDate}, your bot will be automatically suspended.</p>
      </div>
    </div>
  </body></html>`;
              await sendRawEmail(order.customer_email, `Bot Renewal Reminder — ${urgency} — ${siteName}`, html).catch(() => {});
            }
            console.log(`[cron][bot-renewal] Sent ${day}d reminder for order ${order.reference}`);
            break; // Only send the most urgent reminder per run
          }
        }
      }
    } catch (err: any) {
      console.error("[cron][bot-expiry] Error:", err.message);
    }
  }

// ─── Every 15min: ping all deployed bots, record uptime to bot_pings ─────────
async function pingBotOrders() {
  try {
    const orders: any[] = await runQuery(
      "SELECT * FROM bot_orders WHERE status = 'deployed' AND pm2_name IS NOT NULL AND vps_server_id IS NOT NULL"
    ).catch(() => []);
    if (!orders.length) return;
    const servers = vpsManager.getAll();
    const byVps: Record<string, any[]> = {};
    for (const o of orders) (byVps[o.vps_server_id] = byVps[o.vps_server_id] || []).push(o);
    const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
    for (const [vpsId, vpsOrders] of Object.entries(byVps)) {
      const server = servers.find((s: any) => s.id === vpsId);
      if (!server) continue;
      for (const order of vpsOrders) {
        try {
          const { stdout } = await vpsManager.execCommand(
            server, `pm2 describe ${order.pm2_name} 2>/dev/null | grep -i status | head -1`
          );
          const pm2Status = stdout.toLowerCase().includes("online") ? "online"
            : stdout.toLowerCase().includes("stopped") ? "stopped"
            : stdout.toLowerCase().includes("errored") ? "errored" : "unknown";
          await runMutation(
            `INSERT INTO bot_pings (bot_order_id, pm2_status, checked_at) VALUES (?, ?, ${updNow})`,
            [order.id, pm2Status]
          ).catch(() => {});
        } catch {
          await runMutation(
            `INSERT INTO bot_pings (bot_order_id, pm2_status, checked_at) VALUES (?, ?, ${updNow})`,
            [order.id, "offline"]
          ).catch(() => {});
        }
      }
    }
    // Trim old pings (keep 8 days)
    const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    await runMutation("DELETE FROM bot_pings WHERE checked_at < ?", [cutoff]).catch(() => {});
  } catch (err: any) { console.error("[cron][bot-ping]", err.message); }
}

export function startCronJobs() {
  // Daily at 9am: check expiring subscriptions
  cron.schedule("0 9 * * *", checkExpiringAccounts);

  // Every Sunday at 8am: weekly report
  cron.schedule("0 8 * * 0", weeklyReport);

  // Every 5 minutes: check scheduled campaigns
  cron.schedule("*/5 * * * *", checkScheduledCampaigns);

  // 1st of every month at 9am: monthly spending summary emails
  cron.schedule("0 9 1 * *", () => sendMonthlySummaries());

  // Daily at 10am: check expiring & expired bot orders
    cron.schedule("0 10 * * *", checkExpiringBotOrders);

    // Every 15min: bot uptime pings
    cron.schedule("*/15 * * * *", pingBotOrders);

      console.log("[cron] Jobs scheduled: expiry check (daily 9am), weekly report (Sunday 8am), campaigns (every 5min), monthly summary (1st of month 9am), bot-expiry check (daily 10am), bot pings (every 15min)");
}
