import { registerBotRoutes, deployPendingOrders } from "./bot-routes";
import { registerTradingBotRoutes } from "./tradingbot-routes";
import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import axios from "axios";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage, dbSettingsGet, dbSettingsSet, getDb, dbType, runQuery, runMutation } from "./storage";
import { accountManager } from "./accounts";
import { sendAccountEmail, sendPasswordResetEmail, sendPasswordResetLinkEmail, sendSuspensionEmail, sendUnsuspensionEmail, sendBulkEmail } from "./email";
import { sendTelegramMessage, notifyNewOrder, notifyNewCustomer, notifyPaymentFailed, isTelegramConfigured, notifySupportEscalation } from "./telegram";
import { getWhatsAppStatus, connectWhatsApp, disconnectWhatsApp, isWhatsAppWebConnected, broadcastNewOrder, sendWhatsAppNotification } from "./whatsapp-web";
import { subscriptionPlans } from "./plans";
import { promoManager } from "./promo";
import { planOverridesManager } from "./plan-overrides";
import { vpsManager } from "./vps-manager";
import { countryRestrictions } from "./country-restrictions";
import {
  getAdminCredentials,
  isSetupComplete,
  generateSetup,
  saveSecret,
  verifyTotp,
  verifyTotpWithSecret,
  createAdminToken,
  validateAdminToken,
  adminAuthMiddleware,
  superAdminOnly,
  primarySuperAdminOnly,
  requirePermission,
  setStorageRef,
  createCustomerJwt,
  verifyCustomerJwt,
} from "./auth";
import { getPaystackSecretKey, getPaystackPublicKey, getSecretsStatus, getResendApiKey, getResendFrom, getResendOtpFrom, getEmailUser, getEmailPass, getCloudflareApiToken } from "./secrets";
import nodemailer from "nodemailer";
import { getAppConfig, saveAppConfig } from "./app-config";
import { getCredentialsOverride, saveCredentialsOverride } from "./credentials-store";
import { logAdminAction, getAdminLogs } from "./admin-logger";
import { logDelivery, getDeliveryProof, getDeliveryLogs } from "./delivery-log";
import { getAIChatResponse } from "./openai-chat";
import { processAdminCommand, getAutoStatus, runSecurityScan, banCustomerByEmail } from "./admin-bot";
import speakeasy from "speakeasy";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function parseDurationMs(duration: string): number {
  const d = duration.toLowerCase();
  if (d.includes("year")) return parseInt(d) * 365 * 86400000;
  if (d.includes("month")) return parseInt(d) * 30 * 86400000;
  if (d.includes("week")) return parseInt(d) * 7 * 86400000;
  if (d.includes("day")) return parseInt(d) * 86400000;
  return 30 * 86400000;
}

function getAffiliateTier(completedReferrals: number): { tier: string; multiplier: number; label: string } {
  const raw = dbSettingsGet("affiliate_tiers");
  const tiers = raw ? JSON.parse(raw) : [
    { name: "Silver", min: 5, multiplier: 1.25 },
    { name: "Gold", min: 15, multiplier: 1.5 },
    { name: "Platinum", min: 30, multiplier: 2.0 },
  ];
  tiers.sort((a: any, b: any) => b.min - a.min);
  for (const t of tiers) {
    if (completedReferrals >= t.min) {
      return { tier: t.name, multiplier: t.multiplier, label: `${t.name} Affiliate` };
    }
  }
  return { tier: "Basic", multiplier: 1.0, label: "Basic Affiliate" };
}

function getBaseUrl(req: any): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.get("host") || "";
  return `${proto}://${host}`;
}

function parseDeviceName(ua: string): string {
  if (!ua) return "Unknown Device";
  const mobile = /iphone/i.test(ua) ? "iPhone" : /ipad/i.test(ua) ? "iPad" : /android/i.test(ua) ? "Android" : null;
  const browser = /edg/i.test(ua) ? "Edge" : /chrome/i.test(ua) ? "Chrome" : /firefox/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : /opera|opr/i.test(ua) ? "Opera" : "Browser";
  const os = mobile ?? (/windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "Unknown OS");
  return `${browser} on ${os}`;
}

function getReqIp(req: any): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

function buildVerificationLink(email: string, token: string): string {
  const base = (getAppConfig().customDomain && `https://${getAppConfig().customDomain}`)
    || (getAppConfig().appDomain && `https://${getAppConfig().appDomain}`)
    || "https://streamvault-premium.site";
  return `${base}/api/auth/verify-link?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

async function sendVerificationEmail(email: string, token: string, name?: string): Promise<void> {
  const { Resend } = await import("resend");
  const key = getResendApiKey();
  if (!key || key.startsWith("re_xxx") || key === "re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") {
    console.warn("[email][verify] RESEND_API_KEY is missing or still a placeholder — verification email NOT sent.");
    return;
  }
  const resend = new Resend(key);
  const fromAddr = getResendOtpFrom() || getResendFrom() || "onboarding@resend.dev";
  const from = `StreamVault Premium <${fromAddr}>`;
  const link = buildVerificationLink(email, token);
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
    <div style="background:linear-gradient(135deg,#4169E1 0%,#7C3AED 100%);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0 0 6px;font-size:24px;font-weight:700;">Verify Your Email</h1>
      <p style="color:rgba(255,255,255,.85);margin:0;font-size:14px;">Chege Tech · StreamVault Premium</p>
    </div>
    <div style="padding:32px 32px 24px;text-align:center;">
      <p style="font-size:15px;color:#333;margin:0 0 8px;">Hi <strong>${name || "there"}</strong>, welcome!</p>
      <p style="font-size:14px;color:#555;margin:0 0 28px;">Click the button below to confirm your email address. The link expires in <strong>30 minutes</strong>.</p>
      <a href="${link}" target="_blank" rel="noopener" style="display:inline-block;background:linear-gradient(135deg,#4169E1 0%,#7C3AED 100%);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:15px 42px;border-radius:10px;letter-spacing:.3px;box-shadow:0 4px 14px rgba(65,105,225,.35);">Verify My Email</a>
      <p style="font-size:12px;color:#888;margin:24px 0 6px;">Or copy and paste this link into your browser:</p>
      <p style="font-size:11px;color:#4169E1;margin:0 0 8px;word-break:break-all;font-family:monospace;">${link}</p>
      <p style="font-size:12px;color:#aaa;margin:18px 0 0;">If you didn't sign up, you can safely ignore this email.</p>
    </div>
    <div style="background:#f8faff;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#aaa;margin:0;">&copy; ${new Date().getFullYear()} Chege Tech. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  const { error } = await resend.emails.send({ from, to: email, subject: "Verify your Chege Tech email", html });
  if (error) throw new Error(error.message);
}

async function sendWalletTransferEmail(opts: {
  toEmail: string;
  toName: string;
  type: "sent" | "received";
  amount: number;
  counterpartyName: string;
  counterpartyEmail: string;
  counterpartyId: number;
  note?: string;
  newBalance: number;
}): Promise<void> {
  const isSent = opts.type === "sent";
  const label = isSent ? "sender" : "receiver";
  const subject = isSent
    ? `Transfer Sent: KES ${opts.amount.toLocaleString()} to ${opts.counterpartyName}`
    : `💰 You Received KES ${opts.amount.toLocaleString()} from ${opts.counterpartyName}`;

  const accentColor = isSent ? "#EF4444" : "#10B981";
  const accentBg = isSent ? "#FEF2F2" : "#ECFDF5";
  const icon = isSent ? "💸" : "💰";
  const actionLine = isSent
    ? `You sent <strong>KES ${opts.amount.toLocaleString()}</strong> to <strong>${opts.counterpartyName}</strong>`
    : `<strong>${opts.counterpartyName}</strong> sent you <strong>KES ${opts.amount.toLocaleString()}</strong>`;

  const noteRow = opts.note
    ? `<tr><td style="padding:8px 0;color:#6B7280;font-size:14px;">Note</td><td style="padding:8px 0;color:#111;font-size:14px;text-align:right;font-style:italic;">"${opts.note}"</td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
    <div style="background:linear-gradient(135deg,#4169E1 0%,#7C3AED 100%);padding:32px;text-align:center;">
      <p style="font-size:40px;margin:0 0 10px;">${icon}</p>
      <h1 style="color:#fff;margin:0 0 6px;font-size:22px;font-weight:700;">${isSent ? "Transfer Sent" : "Transfer Received"}</h1>
      <p style="color:rgba(255,255,255,.8);margin:0;font-size:13px;">Chege Tech Wallet</p>
    </div>
    <div style="padding:32px;">
      <p style="font-size:15px;color:#333;margin:0 0 20px;">Hi <strong>${opts.toName}</strong>,</p>
      <p style="font-size:15px;color:#333;margin:0 0 24px;">${actionLine}.</p>
      <div style="background:${accentBg};border-left:4px solid ${accentColor};border-radius:8px;padding:20px 24px;margin-bottom:24px;">
        <p style="font-size:32px;font-weight:900;color:${accentColor};margin:0 0 4px;font-family:monospace;">
          ${isSent ? "−" : "+"}KES ${opts.amount.toLocaleString()}
        </p>
        <p style="font-size:13px;color:#666;margin:0;">Wallet balance: <strong>KES ${opts.newBalance.toLocaleString()}</strong></p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#6B7280;font-size:14px;border-top:1px solid #F3F4F6;">${isSent ? "Sent to" : "Sent by"}</td>
            <td style="padding:8px 0;color:#111;font-size:14px;text-align:right;border-top:1px solid #F3F4F6;">
              ${opts.counterpartyName} <span style="color:#9CA3AF;">(#${opts.counterpartyId})</span>
            </td></tr>
        <tr><td style="padding:8px 0;color:#6B7280;font-size:14px;border-top:1px solid #F3F4F6;">Email</td>
            <td style="padding:8px 0;color:#111;font-size:14px;text-align:right;border-top:1px solid #F3F4F6;">${opts.counterpartyEmail}</td></tr>
        ${noteRow}
        <tr><td style="padding:8px 0;color:#6B7280;font-size:14px;border-top:1px solid #F3F4F6;">Date</td>
            <td style="padding:8px 0;color:#111;font-size:14px;text-align:right;border-top:1px solid #F3F4F6;">${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</td></tr>
      </table>
      ${!isSent ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-top:20px;">
        <p style="color:#166534;font-size:13px;margin:0;">✅ The funds are now in your Chege Tech wallet. Log in to spend or withdraw them.</p>
      </div>` : ""}
      <p style="font-size:12px;color:#9CA3AF;margin:24px 0 0;">${isSent ? "If you did not initiate this transfer, please contact support immediately." : "Questions? Contact our support team anytime."}</p>
    </div>
    <div style="background:#F9FAFB;padding:16px;text-align:center;border-top:1px solid #F3F4F6;">
      <p style="font-size:12px;color:#aaa;margin:0;">&copy; ${new Date().getFullYear()} Chege Tech. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  // ── Try Resend first ──────────────────────────────────────────────────────
  const resendKey = getResendApiKey();
  const resendOk = resendKey && !resendKey.startsWith("re_xxx") && resendKey !== "re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

  if (resendOk) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      const fromAddr = getResendFrom() || "onboarding@resend.dev";
      const { error } = await resend.emails.send({ from: `Chege Tech <${fromAddr}>`, to: opts.toEmail, subject, html });
      if (error) {
        console.warn(`[email][wallet-transfer][${label}] Resend error for ${opts.toEmail}:`, error.message);
      } else {
        console.log(`[email][wallet-transfer][${label}] ✓ Resend → ${opts.toEmail}`);
        return;
      }
    } catch (err: any) {
      console.warn(`[email][wallet-transfer][${label}] Resend threw:`, err.message);
    }
  }

  // ── Fall back to SMTP / nodemailer ────────────────────────────────────────
  const emailUser = getEmailUser();
  const emailPass = getEmailPass();
  if (!emailUser || !emailPass) {
    console.warn(`[email][wallet-transfer][${label}] No email service configured — skipping email to ${opts.toEmail}`);
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_PORT === "465",
      auth: { user: emailUser, pass: emailPass },
    });
    await transporter.sendMail({ from: `Chege Tech <${emailUser}>`, to: opts.toEmail, subject, html });
    console.log(`[email][wallet-transfer][${label}] ✓ SMTP → ${opts.toEmail}`);
  } catch (err: any) {
    console.warn(`[email][wallet-transfer][${label}] SMTP error for ${opts.toEmail}:`, err.message);
  }
}

async function customerAuthMiddleware(req: any, res: any, next: any) {
  // Cookie-first; fall back to Bearer header for API clients
  const token: string =
    req.cookies?.customer_token ||
    (req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  // ── JWT path (fast — no DB session lookup) ──
  const jwtPayload = verifyCustomerJwt(token);
  if (jwtPayload) {
    const customer = await storage.getCustomerById(jwtPayload.customerId);
    if (!customer) return res.status(401).json({ error: "Unauthorized" });
    if (customer.suspended) return res.status(403).json({ error: "Account suspended. Contact support." });
    req.customer = customer;
    return next();
  }

  // ── Legacy UUID session fallback ──
  const session = await storage.getCustomerSession(token);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (new Date(session.expiresAt) < new Date()) {
    await storage.deleteCustomerSession(token);
    return res.status(401).json({ error: "Session expired" });
  }
  const customer = await storage.getCustomerById(session.customerId);
  if (!customer) return res.status(401).json({ error: "Unauthorized" });
  if (customer.suspended) return res.status(403).json({ error: "Account suspended. Contact support." });
  req.customer = customer;
  next();
}

function buildPlansResponse() {
  const overrides = planOverridesManager.getOverrides();
  const customPlans = planOverridesManager.getCustomPlans();

  const enriched = Object.entries(subscriptionPlans).reduce((acc, [key, cat]) => {
    const plans = Object.entries(cat.plans).reduce((pa, [planId, plan]) => {
      const override = overrides[planId] || {};
      if (override.disabled) return pa;
      const avail = accountManager.checkAvailability(planId);
      const effectivePrice = override.priceOverride ?? plan.price;
      pa[planId] = {
        ...plan,
        planId,
        categoryKey: key,
        inStock: avail.available,
        price: effectivePrice,
        originalPrice: override.priceOverride ? plan.price : undefined,
        offerLabel: override.offerLabel,
      };
      return pa;
    }, {} as Record<string, any>);

    const customForCat = customPlans.filter((cp) => cp.categoryKey === key);
    customForCat.forEach((cp) => {
      const override = overrides[cp.id] || {};
      if (!override.disabled) {
        const avail = accountManager.checkAvailability(cp.id);
        plans[cp.id] = {
          name: cp.name,
          price: override.priceOverride ?? cp.price,
          originalPrice: override.priceOverride ? cp.price : undefined,
          duration: cp.duration,
          features: cp.features,
          shared: true,
          maxUsers: cp.maxUsers,
          planId: cp.id,
          categoryKey: key,
          inStock: avail.available,
          isCustom: true,
          offerLabel: override.offerLabel,
        };
      }
    });

    if (Object.keys(plans).length > 0) {
      acc[key] = { ...cat, plans };
    }
    return acc;
  }, {} as Record<string, any>);

  const uncategorizedCustom = customPlans.filter(
    (cp) => !Object.keys(subscriptionPlans).includes(cp.categoryKey)
  );
  if (uncategorizedCustom.length > 0) {
    const customCat: Record<string, any> = {};
    uncategorizedCustom.forEach((cp) => {
      const override = overrides[cp.id] || {};
      if (!override.disabled) {
        const avail = accountManager.checkAvailability(cp.id);
        customCat[cp.id] = {
          name: cp.name,
          price: override.priceOverride ?? cp.price,
          originalPrice: override.priceOverride ? cp.price : undefined,
          duration: cp.duration,
          features: cp.features,
          shared: true,
          maxUsers: cp.maxUsers,
          planId: cp.id,
          categoryKey: "custom",
          inStock: avail.available,
          isCustom: true,
          offerLabel: override.offerLabel,
        };
      }
    });
    if (Object.keys(customCat).length > 0) {
      enriched["custom"] = {
        category: "Other Services",
        icon: "Sparkles",
        color: "#6366F1",
        plans: customCat,
      };
    }
  }

  return enriched;
}

async function verifyPaystackPayment(reference: string): Promise<{
  success: boolean;
  status?: string;
  amount?: number;
  configured: boolean;
}> {
  const secret = getPaystackSecretKey();
  if (!secret) return { success: false, status: "not_configured", configured: false };
  try {
    const res = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const d = res.data.data;
    return { success: d.status === "success", status: d.status, amount: d.amount / 100, configured: true };
  } catch (err: any) {
    console.error("Paystack verify error:", err.message);
    return { success: false, status: "error", configured: true };
  }
}

async function deliverAccount(transaction: any): Promise<{ success: boolean; error?: string }> {
  const logBase = {
    reference: transaction.reference,
    customerEmail: transaction.customerEmail,
    customerName: transaction.customerName || "Customer",
    planName: transaction.planName,
    planId: transaction.planId,
  };

  // ─── Compute expiry date from plan duration ───────────────────────
  let expiresAt: string | null = null;
  try {
    const cats = buildPlansResponse();
    for (const cat of Object.values(cats) as any[]) {
      if (cat.plans[transaction.planId]) {
        const dur = cat.plans[transaction.planId].duration || "1 Month";
        expiresAt = new Date(Date.now() + parseDurationMs(dur)).toISOString();
        break;
      }
    }
  } catch (_) {}

  const account = accountManager.assignAccount(
    transaction.planId,
    transaction.customerEmail,
    transaction.customerName || "Customer",
    expiresAt
  );
  if (!account) {
    logDelivery({ ...logBase, method: "account_assignment", status: "failed", details: "No account available in stock" });
    await storage.updateTransaction(transaction.reference, { status: "failed" });
    return { success: false, error: "No account available - contact support for refund" };
  }

  // ─── Low-stock Telegram alert ─────────────────────────────────────
  try {
    const allAccounts = accountManager.getAllAccounts();
    if (allAccounts) {
      const planAccounts = allAccounts[transaction.planId] || [];
      const available = planAccounts.filter((a: any) => !a.fullyUsed && !a.disabled);
      if (available.length <= 2) {
        sendTelegramMessage(`⚠️ <b>Low Stock Alert</b>\n\nPlan: <b>${transaction.planName}</b>\nRemaining accounts: <b>${available.length}</b>\n\nPlease restock urgently!`).catch(() => {});
      }
    }
  } catch (_) {}

  logDelivery({
    ...logBase,
    method: "account_assignment",
    status: "success",
    details: `Account assigned — ID: ${account.id}`,
    metadata: { accountId: account.id, accountEmail: account.email },
  });

  // ─── Gift support: deliver to giftEmail if set ────────────────────
  let deliveryEmail = transaction.customerEmail;
  let deliveryName = transaction.customerName || "Customer";
  let giftData: { giftEmail: string; giftMessage: string } | null = null;
  try {
    const raw = dbSettingsGet(`gift_${transaction.reference}`);
    if (raw) {
      giftData = JSON.parse(raw);
      if (giftData?.giftEmail) {
        deliveryEmail = giftData.giftEmail;
        deliveryName = "there"; // unknown name for recipient
      }
    }
  } catch (_) {}

  const emailResult = await sendAccountEmail(
    deliveryEmail,
    transaction.planName,
    account,
    deliveryName
  );

  // If it was a gift, also notify the buyer
  if (giftData?.giftEmail) {
    try {
      const { Resend } = await import("resend");
      const key = getResendApiKey();
      if (key && !key.startsWith("re_xxx")) {
        const resend = new Resend(key);
        const fromAddr = getResendFrom() || "onboarding@resend.dev";
        const msgLine = giftData.giftMessage ? `<p style="color:#555;font-size:14px;font-style:italic;">"${giftData.giftMessage}"</p>` : "";
        await resend.emails.send({
          from: `Chege Tech <${fromAddr}>`,
          to: transaction.customerEmail,
          subject: `🎁 Gift delivered — ${transaction.planName}`,
          html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f0f4f8;margin:0;padding:0">
          <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)">
            <div style="background:linear-gradient(135deg,#4169E1 0%,#7C3AED 100%);padding:28px;text-align:center">
              <p style="font-size:36px;margin:0 0 8px">🎁</p>
              <h1 style="color:#fff;margin:0;font-size:20px">Gift Delivered!</h1>
            </div>
            <div style="padding:28px">
              <p style="color:#333;font-size:15px">Hi <strong>${transaction.customerName || "there"}</strong>,</p>
              <p style="color:#555;font-size:14px">Your gift of <strong>${transaction.planName}</strong> has been delivered to <strong>${giftData.giftEmail}</strong>.</p>
              ${msgLine}
              <p style="color:#888;font-size:13px;margin-top:16px">Thank you for spreading the joy! 💜</p>
            </div>
          </div></body></html>`
        }).catch(() => {});
      }
    } catch (_) {}
    dbSettingsSet(`gift_${transaction.reference}`, "");
  }

  logDelivery({
    ...logBase,
    method: "email",
    status: emailResult.success ? "success" : "failed",
    details: emailResult.success
      ? `Credentials email sent to ${deliveryEmail}${giftData?.giftEmail ? ` (gift from ${transaction.customerEmail})` : ""}`
      : `Email delivery failed: ${emailResult.error || "unknown error"}`,
    metadata: { recipientEmail: deliveryEmail },
  });

  await storage.updateTransaction(transaction.reference, {
    status: "success",
    accountAssigned: true,
    emailSent: emailResult.success,
    paystackReference: transaction.reference,
    ...(expiresAt ? { expiresAt } : {}),
  });

  // ─── Referral rewards: first purchase + ongoing commissions ────────
  try {
    const customerOrders = await storage.getTransactionsByEmail(transaction.customerEmail);
    const successfulOrders = customerOrders.filter((o: any) => o.status === "success" && o.reference !== transaction.reference);
    const isFirstPurchase = successfulOrders.length === 0;

    if (isFirstPurchase) {
      // First purchase: complete the referral + welcome bonus
      const pendingReferralKey = `referral_pending_${transaction.customerEmail}`;
      const pendingCode = dbSettingsGet(pendingReferralKey);
      if (pendingCode && pendingCode !== "") {
        const referral = await storage.getReferralByCode(pendingCode);
        if (referral && referral.status === "pending") {
          const BASE_REFERRER_REWARD = 100;
          const REFEREE_REWARD = 50;
          const stats = await storage.getReferralStats(referral.referrerId);
          const tierInfo = getAffiliateTier(stats.completedReferrals);
          const referrerReward = Math.round(BASE_REFERRER_REWARD * tierInfo.multiplier);

          await storage.completeReferral(pendingCode, transaction.customerEmail, referrerReward);
          await storage.creditWallet(referral.referrerId, referrerReward, `${tierInfo.label} referral reward — ${transaction.customerEmail} first purchase`, transaction.reference);
          const refereeCustomer = await storage.getCustomerByEmail(transaction.customerEmail);
          if (refereeCustomer) {
            await storage.creditWallet(refereeCustomer.id, REFEREE_REWARD, "Welcome bonus — referral credit on first purchase", transaction.reference);
          }
          dbSettingsSet(pendingReferralKey, "");
          // Store permanent referrer mapping for ongoing commissions
          dbSettingsSet(`referral_by_${transaction.customerEmail}`, String(referral.referrerId));

          // ─── 10-referral milestone ────────────────────────────────
          try {
            const updatedStats = await storage.getReferralStats(referral.referrerId);
            if (updatedStats.completedReferrals === 10) {
              const referrerCustomer = await storage.getCustomerById(referral.referrerId);
              if (referrerCustomer) {
                const milestoneKey = `referral_milestone_10_${referral.referrerId}`;
                if (!dbSettingsGet(milestoneKey)) {
                  dbSettingsSet(milestoneKey, "claimed");
                  const FREE_PLAN_IDS = ["netflix-shared-1m", "netflix-shared", "showmax-1m", "showmax-shared", "netflix", "showmax"];
                  let freeAccount: any = null;
                  let freePlanName = "";
                  for (const pid of FREE_PLAN_IDS) {
                    freeAccount = accountManager.assignAccount(pid, referrerCustomer.email, referrerCustomer.name || "Customer");
                    if (freeAccount) { freePlanName = pid.replace(/-/g, " ").toUpperCase(); break; }
                  }
                  if (freeAccount) {
                    await sendAccountEmail(referrerCustomer.email, `${freePlanName} (10-Referral Reward)`, freeAccount, referrerCustomer.name || "Customer");
                    await storage.creditWallet(referral.referrerId, 0, "🎉 10-referral milestone unlocked — free subscription sent to your email!");
                  }
                }
              }
            }
          } catch (milestoneErr: any) {
            console.error("[referral] Milestone check error:", milestoneErr.message);
          }
        }
      }
    } else {
      // Repeat purchase: give ongoing commission to referrer (50 KES × tier multiplier)
      const referrerId = dbSettingsGet(`referral_by_${transaction.customerEmail}`);
      if (referrerId && referrerId !== "") {
        const ONGOING_REWARD = 50;
        const referrerIdNum = parseInt(referrerId, 10);
        if (!isNaN(referrerIdNum)) {
        const stats = await storage.getReferralStats(referrerIdNum);
        const tierInfo = getAffiliateTier(stats.completedReferrals);
        const ongoingReward = Math.round(ONGOING_REWARD * tierInfo.multiplier);
        await storage.creditWallet(referrerIdNum, ongoingReward, `${tierInfo.label} ongoing commission — ${transaction.customerEmail} purchased ${transaction.planName}`, transaction.reference);
        }
      }
    }
  } catch (refErr: any) {
    console.error("[referral] Error processing referral reward:", refErr.message);
  }

  // ─── Loyalty credit (every 3rd subscription purchase → KES 50 bonus) ─────
  try {
    const allCustOrders = await storage.getTransactionsByEmail(transaction.customerEmail);
    const completedSubOrders = allCustOrders.filter((o: any) => o.status === "success");
    const orderCount = completedSubOrders.length;
    if (orderCount > 0 && orderCount % 3 === 0) {
      const loyaltyKey = `loyalty_credit_${transaction.customerEmail}_${orderCount}`;
      if (!dbSettingsGet(loyaltyKey)) {
        dbSettingsSet(loyaltyKey, new Date().toISOString());
        const loyaltyCust = await storage.getCustomerByEmail(transaction.customerEmail);
        if (loyaltyCust) {
          await storage.creditWallet(loyaltyCust.id, 50, `🎉 Loyalty reward — ${orderCount} purchase milestone`, transaction.reference);
        }
      }
    }
  } catch (loyaltyErr: any) {
    console.error("[loyalty] Error:", loyaltyErr.message);
  }

  // ─── Reseller profit split ────────────────────────────────────────
  // Margin is computed from the locked transaction.amount (what the customer
  // actually paid) vs the base plan price, so mutating reseller prices after
  // payment init has no effect on the payout.
  try {
    if ((transaction as any).resellerId) {
      const resellerId = (transaction as any).resellerId;
      const cats = buildPlansResponse();
      for (const cat of Object.values(cats) as any[]) {
        if (cat.plans[transaction.planId]) {
          const basePrice = cat.plans[transaction.planId].price;
          const margin = Math.max(0, transaction.amount - basePrice);
          if (margin > 0) {
            await storage.creditResellerWallet(resellerId, margin, `Sale margin — ${transaction.planName} (ref: ${transaction.reference})`, transaction.reference);
          }
          break;
        }
      }
    }
  } catch (resellerErr: any) {
    console.error("[reseller] Error processing profit split:", resellerErr.message);
  }

  // ─── In-app notification for customer ────────────────────────────
  try {
    const cust = await storage.getCustomerByEmail(transaction.customerEmail);
    if (cust) {
      await storage.createNotification(
        cust.id,
        "order",
        "Order Confirmed ✅",
        `Your ${transaction.planName} subscription is ready. Check your email for credentials.`
      );
    }
  } catch (_) {}

  const orderOpts = {
    customerName: transaction.customerName || "Customer",
    customerEmail: transaction.customerEmail,
    planName: transaction.planName,
    amount: transaction.amount,
    reference: transaction.reference,
  };
  notifyNewOrder(orderOpts).then(() => {
    logDelivery({ ...logBase, method: "telegram_notification", status: "success", details: "Admin notified via Telegram" });
  }).catch(() => {
    logDelivery({ ...logBase, method: "telegram_notification", status: "failed", details: "Telegram notification failed" });
  });
  const override = getCredentialsOverride();
  if (override.whatsappAdminPhone) {
    broadcastNewOrder({ adminPhone: override.whatsappAdminPhone, ...orderOpts }).catch(() => {});
  }
  return { success: true };
}

const geoCache = new Map<string, { code: string | null; expires: number }>();

async function getCountryCode(ip: string): Promise<string | null> {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip.startsWith("::") || ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.")) return null;
  const cached = geoCache.get(ip);
  if (cached && cached.expires > Date.now()) return cached.code;
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode`);
    if (res.ok) {
      const data: any = await res.json();
      const code = data.status === "success" ? data.countryCode : null;
      geoCache.set(ip, { code, expires: Date.now() + 10 * 60 * 1000 });
      return code;
    }
  } catch {}
  return null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setStorageRef(storage);

  // ─── Country Restriction Middleware ───────────────────────────────────────
  app.use(async (req: any, res: any, next: any) => {
    // 1. Authenticated admins (super or sub) always bypass — checked via Bearer token
    const authHeader = (req.headers["authorization"] as string) || "";
    if (authHeader.startsWith("Bearer ")) {
      const tok = authHeader.slice(7).trim();
      if (tok && validateAdminToken(tok)) return next();
    }

    // 2. Admin panel pages and all admin API routes always bypass
    const p = req.path;
    if (
      p.startsWith("/api/admin") ||
      p.startsWith("/admin") ||
      p === "/api/auth/login" ||
      p === "/api/customer/login" ||
      p === "/api/auth/register" ||
      p === "/api/customer/register" ||
      p === "/api/config" ||
      p === "/api/track"
    ) {
      return next();
    }

    // 3. Apply country restriction to everyone else
    try {
      const { countries } = countryRestrictions.get();
      if (countries.length === 0) return next();
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
      const code = await getCountryCode(ip);
      if (code && countryRestrictions.isBlocked(code)) {
        return res.status(403).json({ success: false, error: "Access from your region is restricted.", blocked: true, countryCode: code });
      }
    } catch {}
    next();
  });

  // ─── Reseller Custom Domain Middleware ───────────────────────────────────
  app.use(async (req: any, _res: any, next: any) => {
    try {
      const hostname = req.hostname;
      if (hostname && hostname !== "localhost" && !hostname.endsWith(".replit.dev") && !hostname.endsWith(".repl.co")) {
        const reseller = await storage.getResellerByDomain(hostname);
        if (reseller && reseller.status === "approved" && !reseller.suspended) {
          req.resellerSlug = reseller.slug;
        }
      }
    } catch (_) {}
    next();
  });

  // ─── Public: Config ───────────────────────────────────────────────────────
  app.get("/api/config", (_req, res) => {
    const pub = getPaystackPublicKey();
    const sec = getPaystackSecretKey();
    res.json({
      paystackPublicKey: pub || null,
      paystackConfigured: !!(pub && sec),
    });
  });

  // ─── Plan Previews (custom uploaded media) ────────────────────────────────
  const previewUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
    fileFilter: (_req, file, cb) => {
      const ok = /^(image\/(png|jpe?g|gif|webp|avif)|video\/(mp4|webm|quicktime|ogg))$/.test(file.mimetype);
      if (!ok) return cb(new Error("Only image (png/jpg/gif/webp) or video (mp4/webm) files allowed"));
      cb(null, true);
    },
  });

  // Public: get preview for a plan (returns base64 data URL for inline rendering)
  app.get("/api/plans/:planId/preview", async (req, res) => {
    try {
      const planId = String(req.params.planId || "").trim();
      if (!planId) return res.status(400).json({ success: false, error: "planId required" });
      const rows = await runQuery(
        `SELECT media_type, mime_type, media_data, file_name, size_bytes, updated_at FROM plan_previews WHERE plan_id = $1 LIMIT 1`,
        [planId]
      );
      if (!rows || rows.length === 0) return res.json({ success: true, preview: null });
      const r = rows[0];
      res.json({
        success: true,
        preview: {
          mediaType: r.media_type,
          mimeType: r.mime_type,
          dataUrl: `data:${r.mime_type};base64,${r.media_data}`,
          fileName: r.file_name,
          sizeBytes: r.size_bytes,
          updatedAt: r.updated_at,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: upload preview for a plan
  app.post("/api/admin/plans/:planId/preview", adminAuthMiddleware, previewUpload.single("file"), async (req: any, res) => {
    try {
      const planId = String(req.params.planId || "").trim();
      const file = req.file;
      if (!planId) return res.status(400).json({ success: false, error: "planId required" });
      if (!file) return res.status(400).json({ success: false, error: "file required" });
      const mediaType = file.mimetype.startsWith("video/") ? "video" : "image";
      const base64 = file.buffer.toString("base64");

      // Upsert
      await runMutation(
        `INSERT INTO plan_previews (plan_id, media_type, mime_type, media_data, file_name, size_bytes, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()::text)
         ON CONFLICT (plan_id) DO UPDATE SET
           media_type = EXCLUDED.media_type,
           mime_type  = EXCLUDED.mime_type,
           media_data = EXCLUDED.media_data,
           file_name  = EXCLUDED.file_name,
           size_bytes = EXCLUDED.size_bytes,
           updated_at = NOW()::text`,
        [planId, mediaType, file.mimetype, base64, file.originalname || "preview", file.size]
      );

      try { logAdminAction({ adminEmail: req.admin?.email || "admin", action: "plan_preview_upload", target: planId, details: `${mediaType} ${file.size} bytes` }); } catch {}
      res.json({ success: true, planId, mediaType, mimeType: file.mimetype, sizeBytes: file.size });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Admin: list all plan previews (metadata only — no base64 to keep it light)
  app.get("/api/admin/plans/previews", adminAuthMiddleware, async (_req, res) => {
    try {
      const rows = await runQuery(
        `SELECT plan_id, media_type, mime_type, file_name, size_bytes, updated_at FROM plan_previews ORDER BY updated_at DESC`,
        []
      );
      res.json({ success: true, previews: rows });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: delete preview
  app.delete("/api/admin/plans/:planId/preview", adminAuthMiddleware, async (req: any, res) => {
    try {
      const planId = String(req.params.planId || "").trim();
      await runMutation(`DELETE FROM plan_previews WHERE plan_id = $1`, [planId]);
      try { logAdminAction({ adminEmail: req.admin?.email || "admin", action: "plan_preview_delete", target: planId, details: "" }); } catch {}
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Public: Plans ────────────────────────────────────────────────────────
  app.get("/api/plans", (_req, res) => {
    res.json({ success: true, categories: buildPlansResponse() });
  });

  // ─── Public: Music tracks proxy (Deezer) ─────────────────────────────────
  const MUSIC_QUERIES = ["drake", "weeknd", "travis scott", "lil tecca", "future", "polo g", "gunna", "pop smoke", "juice wrld", "lil baby"];
  let _musicCache: { tracks: any[]; fetchedAt: number } | null = null;

  app.get("/api/music-tracks", async (_req, res) => {
    try {
      const now = Date.now();
      if (_musicCache && now - _musicCache.fetchedAt < 30 * 60 * 1000) {
        return res.json({ success: true, tracks: _musicCache.tracks });
      }
      const picks = [...MUSIC_QUERIES].sort(() => Math.random() - 0.5).slice(0, 5);
      const all: any[] = [];
      for (const q of picks) {
        try {
          const r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`);
          const j: any = await r.json();
          if (j.data) {
            j.data.forEach((t: any) => {
              if (t.preview) all.push({ title: t.title, artist: t.artist?.name ?? "", preview: t.preview });
            });
          }
        } catch {}
      }
      const tracks = all.sort(() => Math.random() - 0.5);
      _musicCache = { tracks, fetchedAt: now };
      res.json({ success: true, tracks });
    } catch (err: any) {
      res.status(500).json({ success: false, error: "Failed to load tracks" });
    }
  });

  // ─── Public: Validate promo code ─────────────────────────────────────────
  app.post("/api/payment/validate-promo", (req, res) => {
    const { code, planId, amount, context } = req.body;
    const result = promoManager.validate(code, planId, context || "subscription");
    if (!result.valid) return res.status(400).json({ success: false, error: result.error });

    const promo = result.promo!;
    let discountAmount = 0;
    if (promo.discountType === "percent") {
      discountAmount = Math.round((amount * promo.discountValue) / 100);
    } else {
      discountAmount = promo.discountValue;
    }
    const finalAmount = Math.max(0, amount - discountAmount);
    res.json({ success: true, promo, discountAmount, finalAmount, originalAmount: amount });
  });

  // ─── Public: Initialize payment ──────────────────────────────────────────
  app.post("/api/payment/initialize", async (req: any, res) => {
    try {
      const { planId, customerName, email, promoCode, giftEmail, giftMessage, reseller: resellerSlugParam } = req.body;
      if (!email || !planId) return res.status(400).json({ success: false, error: "Email and planId are required" });
      // Detect reseller context: from query string (?reseller=slug), body param, or custom domain middleware
      const resellerSlug = (req.query?.reseller as string) || resellerSlugParam || req.resellerSlug || null;

      const categories = buildPlansResponse();
      let plan: any = null;
      for (const cat of Object.values(categories) as any[]) {
        if (cat.plans[planId]) { plan = cat.plans[planId]; break; }
      }
      if (!plan) return res.status(400).json({ success: false, error: "Invalid plan" });

      const avail = accountManager.checkAvailability(planId);
      if (!avail.available) {
        return res.status(400).json({ success: false, error: "This plan is currently out of stock", outOfStock: true });
      }

      let finalAmount = plan.price;
      let promoUsed: string | null = null;
      if (promoCode) {
        const promoResult = promoManager.validate(promoCode, planId, "subscription");
        if (promoResult.valid && promoResult.promo) {
          const p = promoResult.promo;
          if (p.discountType === "percent") {
            finalAmount = Math.max(0, finalAmount - Math.round((finalAmount * p.discountValue) / 100));
          } else {
            finalAmount = Math.max(0, finalAmount - p.discountValue);
          }
          promoUsed = promoCode.toUpperCase();
        }
      }

      // ─── Apply customer group discount ────────────────────────────────────
      try {
        if (dbType === "sqlite") {
          const rawDb = getDb();
          const custRow: any = rawDb.prepare("SELECT group_id FROM customers WHERE email=?").get(email);
          if (custRow?.group_id) {
            const grpRow: any = rawDb.prepare("SELECT discount_percent FROM customer_groups WHERE id=?").get(custRow.group_id);
            if (grpRow?.discount_percent > 0) {
              finalAmount = Math.max(0, finalAmount - Math.round((finalAmount * grpRow.discount_percent) / 100));
            }
          }
        }
      } catch (_) {}

      // ─── Apply flash sale discount ─────────────────────────────────────────
      try {
        const activeSales = getActiveFlashSales();
        const flashSale = activeSales.find((s: any) => s.planId === planId);
        if (flashSale?.discountPct > 0) {
          finalAmount = Math.max(0, finalAmount - Math.round((finalAmount * flashSale.discountPct) / 100));
        }
      } catch (_) {}

      // ─── Resolve reseller and adjust price if applicable ────────────────
      let resolvedResellerId: number | null = null;
      if (resellerSlug) {
        try {
          const resellerObj = await storage.getResellerBySlug(resellerSlug);
          if (resellerObj && resellerObj.status === "approved" && !resellerObj.suspended) {
            resolvedResellerId = resellerObj.id;
            const resellerPrices = await storage.getResellerPrices(resellerObj.id);
            const rp = resellerPrices.find((p: any) => p.planId === planId);
            if (rp) finalAmount = rp.price;
          }
        } catch (_) {}
      }

      const reference = `SUB-${planId.toUpperCase()}-${Date.now()}`;
      const txData: any = {
        reference,
        planId,
        planName: plan.name,
        customerEmail: email,
        customerName: customerName || "Customer",
        amount: finalAmount,
        status: "pending",
        emailSent: false,
        accountAssigned: false,
      };
      if (resolvedResellerId) txData.resellerId = resolvedResellerId;
      await storage.createTransaction(txData);
      if (giftEmail?.trim()) {
        dbSettingsSet(`gift_${reference}`, JSON.stringify({ giftEmail: giftEmail.trim(), giftMessage: giftMessage?.trim() || "" }));
      }

      const paystackSecret = getPaystackSecretKey();
      if (!paystackSecret) {
        return res.json({
          success: true,
          reference,
          authorizationUrl: null,
          paystackConfigured: false,
          plan: plan.name,
          amount: finalAmount,
        });
      }

      const psRes = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          amount: finalAmount * 100,
          reference,
          metadata: { planId, planName: plan.name, customerName, promoCode: promoUsed },
          callback_url: `${getBaseUrl(req)}/payment/success?ref=${reference}`,
        },
        { headers: { Authorization: `Bearer ${paystackSecret}` } }
      );

      if (promoUsed) promoManager.use(promoUsed);

      res.json({
        success: true,
        reference,
        authorizationUrl: psRes.data.data.authorization_url,
        accessCode: psRes.data.data.access_code,
        paystackConfigured: true,
        plan: plan.name,
        amount: finalAmount,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Public: Verify payment ───────────────────────────────────────────────
  app.post("/api/payment/verify", async (req, res) => {
    try {
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ success: false, error: "Reference required" });

      const transaction = await storage.getTransaction(reference);
      if (!transaction) return res.status(404).json({ success: false, error: "Transaction not found" });

      if (transaction.status === "success") {
        return res.json({ success: true, status: "success", alreadyProcessed: true, planName: transaction.planName });
      }
      if (transaction.status === "failed") {
        return res.json({ success: false, status: "failed", error: "This transaction has already failed" });
      }
      if (transaction.status === "cancelled") {
        const recheck = await verifyPaystackPayment(reference);
        if (recheck.configured && recheck.success) {
          await storage.updateTransaction(reference, { status: "pending" });
          transaction.status = "pending";
        } else {
          return res.json({ success: false, status: "cancelled", error: "This transaction was cancelled due to timeout" });
        }
      }

      const verify = await verifyPaystackPayment(reference);
      if (!verify.configured) {
        return res.status(503).json({ success: false, error: "Payment gateway not configured", notConfigured: true });
      }
      if (!verify.success) {
        await storage.updateTransaction(reference, { status: "failed" });
        return res.json({ success: false, status: "failed", error: "Payment was not successful" });
      }

      const delivery = await deliverAccount(transaction);
      if (!delivery.success) return res.json({ success: false, error: delivery.error });

      res.json({ success: true, status: "success", planName: transaction.planName });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Hybrid: wallet partial + Paystack remainder ──────────────────────────
  app.post("/api/payment/initialize-hybrid", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { planId, customerName, walletAmountToUse, promoCode } = req.body;
      const customerId = req.customer.id;
      const customer = await storage.getCustomerById(customerId);
      if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });

      const categories = buildPlansResponse();
      let plan: any = null;
      for (const cat of Object.values(categories) as any[]) {
        if (cat.plans[planId]) { plan = cat.plans[planId]; break; }
      }
      if (!plan) return res.status(400).json({ success: false, error: "Invalid plan" });

      const avail = accountManager.checkAvailability(planId);
      if (!avail.available) return res.status(400).json({ success: false, error: "This plan is currently out of stock", outOfStock: true });

      // Apply promo if any
      let finalAmount = plan.price;
      if (promoCode) {
        const pr = promoManager.validate(promoCode, planId, "subscription");
        if (pr.valid && pr.promo) {
          const p = pr.promo;
          finalAmount = p.discountType === "percent"
            ? Math.max(0, finalAmount - Math.round((finalAmount * p.discountValue) / 100))
            : Math.max(0, finalAmount - p.discountValue);
        }
      }

      // Apply group discount
      try {
        if (dbType === "sqlite") {
          const rawDb = getDb();
          const custGrpRow: any = rawDb.prepare(
            "SELECT cg.discount_percent FROM customers c LEFT JOIN customer_groups cg ON c.group_id=cg.id WHERE c.id=?"
          ).get(customerId);
          if (custGrpRow?.discount_percent > 0) {
            finalAmount = Math.max(0, finalAmount - Math.round((finalAmount * custGrpRow.discount_percent) / 100));
          }
        }
      } catch (_) {}

      const walletUse = Math.min(Math.max(0, walletAmountToUse || 0), finalAmount);
      const paystackAmount = finalAmount - walletUse;

      // Check wallet has enough for walletUse
      const wallet = await storage.getWallet(customerId);
      if ((wallet.balance || 0) < walletUse) {
        return res.status(400).json({ success: false, error: `Wallet balance (KES ${wallet.balance}) is less than requested wallet contribution (KES ${walletUse}).`, insufficientFunds: true });
      }

      const reference = `HYBRID-${planId.toUpperCase()}-${Date.now()}`;
      await storage.createTransaction({
        reference, planId, planName: plan.name,
        customerEmail: customer.email, customerName: customerName || customer.name || "Customer",
        amount: finalAmount, status: "pending", emailSent: false, accountAssigned: false,
      });

      // Store hybrid metadata so verify endpoint can deduct wallet
      dbSettingsSet(`hybrid_${reference}`, JSON.stringify({ customerId, walletAmountToUse: walletUse }));

      const paystackSecret = getPaystackSecretKey();
      if (!paystackSecret) {
        return res.json({ success: true, reference, authorizationUrl: null, paystackConfigured: false, paystackAmount, walletAmountToUse: walletUse });
      }

      const psRes = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: customer.email, amount: paystackAmount * 100, reference,
          metadata: { planId, planName: plan.name, customerName, hybrid: true, walletContribution: walletUse },
          callback_url: `${getBaseUrl(req)}/payment/success?ref=${reference}`,
        },
        { headers: { Authorization: `Bearer ${paystackSecret}` } }
      );

      res.json({
        success: true, reference,
        authorizationUrl: psRes.data.data.authorization_url,
        accessCode: psRes.data.data.access_code,
        paystackConfigured: true, paystackAmount, walletAmountToUse: walletUse,
        email: customer.email,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Hybrid: verify (deduct wallet + deliver) ─────────────────────────────
  app.post("/api/payment/verify-hybrid", async (req, res) => {
    try {
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ success: false, error: "Reference required" });

      const transaction = await storage.getTransaction(reference);
      if (!transaction) return res.status(404).json({ success: false, error: "Transaction not found" });
      if (transaction.status === "success") {
        return res.json({ success: true, alreadyProcessed: true, planName: transaction.planName });
      }

      const verify = await verifyPaystackPayment(reference);
      if (!verify.configured) return res.status(503).json({ success: false, error: "Payment gateway not configured" });
      if (!verify.success) {
        await storage.updateTransaction(reference, { status: "failed" });
        return res.json({ success: false, error: "Paystack payment was not successful" });
      }

      // Deduct the wallet contribution
      const hybridRaw = dbSettingsGet(`hybrid_${reference}`);
      if (hybridRaw) {
        try {
          const { customerId, walletAmountToUse } = JSON.parse(hybridRaw);
          if (customerId && walletAmountToUse > 0) {
            await storage.debitWallet(customerId, walletAmountToUse, `Hybrid purchase: ${transaction.planName} (wallet contribution)`, reference);
          }
        } catch { /* non-fatal — still deliver */ }
        dbSettingsSet(`hybrid_${reference}`, ""); // cleanup
      }

      const delivery = await deliverAccount(transaction);
      if (!delivery.success) return res.json({ success: false, error: delivery.error });

      res.json({ success: true, planName: transaction.planName });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Public: Initialize cart payment ──────────────────────────────────────
  app.post("/api/payment/initialize-cart", async (req, res) => {
    try {
      const { items, customerName, email } = req.body;
      if (!email || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: "Email and items are required" });
      }
      const paystackSecret = getPaystackSecretKey();
      if (!paystackSecret) {
        return res.json({ success: true, paystackConfigured: false, reference: "", authorizationUrl: "" });
      }
      const categories = buildPlansResponse();
      const expandedItems: Array<{ planId: string; planName: string; amount: number; categoryName: string }> = [];
      for (const item of items) {
        let plan: any = null;
        for (const cat of Object.values(categories) as any[]) {
          if (cat.plans[item.planId]) { plan = { ...cat.plans[item.planId], categoryName: cat.category }; break; }
        }
        if (!plan) return res.status(400).json({ success: false, error: `Invalid plan: ${item.planId}` });
        const avail = accountManager.checkAvailability(item.planId);
        const qty = Math.max(1, item.qty || 1);
        if (!avail.available) return res.status(400).json({ success: false, error: `${plan.name} is currently out of stock`, outOfStock: true, planName: plan.name });
        for (let q = 0; q < qty; q++) {
          expandedItems.push({ planId: item.planId, planName: plan.name, amount: plan.price, categoryName: plan.categoryName });
        }
      }
      const totalAmount = expandedItems.reduce((s, i) => s + i.amount, 0);
      const reference = `ct-cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      for (const item of expandedItems) {
        await storage.createTransaction({
          reference: `${reference}-${expandedItems.indexOf(item)}`,
          planId: item.planId, planName: item.planName, amount: item.amount,
          customerEmail: email, customerName: customerName || "Customer",
          status: "pending", accountAssigned: false, emailSent: false, paystackReference: reference,
        });
      }
      const psRes = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        { email, amount: totalAmount * 100, reference, currency: "KES",
          callback_url: `${getBaseUrl(req)}/payment/cart-success?ref=${reference}`,
          metadata: { cartRef: reference, items: expandedItems.length, customerName } },
        { headers: { Authorization: `Bearer ${paystackSecret}` } }
      );
      res.json({ success: true, reference, authorizationUrl: psRes.data.data.authorization_url, accessCode: psRes.data.data.access_code, paystackConfigured: true, totalAmount, itemCount: expandedItems.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Public: Verify cart payment ──────────────────────────────────────────
  app.post("/api/payment/verify-cart", async (req, res) => {
    try {
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ success: false, error: "Reference required" });
      const verify = await verifyPaystackPayment(reference);
      if (!verify.configured) return res.status(503).json({ success: false, error: "Payment gateway not configured" });
      if (!verify.success) return res.json({ success: false, error: "Payment was not successful" });
      const allTx = await storage.getAllTransactions();
      const cartTxs = allTx.filter((t) => t.paystackReference === reference && t.status === "pending");
      if (cartTxs.length === 0) {
        const done = allTx.filter((t) => t.paystackReference === reference && t.status === "success");
        if (done.length > 0) return res.json({ success: true, alreadyProcessed: true, planNames: done.map((t) => t.planName) });
        return res.status(404).json({ success: false, error: "Cart transactions not found" });
      }
      const results: string[] = [];
      for (const tx of cartTxs) {
        const delivery = await deliverAccount(tx);
        if (delivery.success) results.push(tx.planName);
        else await storage.updateTransaction(tx.reference, { status: "failed" });
      }
      res.json({ success: true, planNames: results, delivered: results.length, total: cartTxs.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Paystack redirect callback ───────────────────────────────────────────
  app.get("/api/payment/callback", async (req, res) => {
    const ref = ((req.query.reference || req.query.trxref) as string) || "";
    if (!ref) return res.redirect("/");
    try {
      const transaction = await storage.getTransaction(ref);
      if (!transaction || transaction.status === "success") {
        return res.redirect(`/payment/success?ref=${ref}&plan=${encodeURIComponent(transaction?.planName || "")}`);
      }
      if (transaction.status === "cancelled") {
        const recheck = await verifyPaystackPayment(ref);
        if (recheck.configured && recheck.success) {
          await storage.updateTransaction(ref, { status: "pending" });
          transaction.status = "pending";
        } else {
          return res.redirect(`/checkout?planId=${transaction.planId}&error=payment_cancelled`);
        }
      }
      const verify = await verifyPaystackPayment(ref);
      if (verify.success && verify.configured) {
        const delivery = await deliverAccount(transaction);
        if (delivery.success) {
          return res.redirect(`/payment/success?ref=${ref}&plan=${encodeURIComponent(transaction.planName)}&email=${encodeURIComponent(transaction.customerEmail)}`);
        }
      }
      res.redirect(`/checkout?planId=${transaction.planId}&error=payment_failed`);
    } catch {
      res.redirect("/");
    }
  });

  // ─── Paystack Webhook (server-to-server backup delivery) ─────────────────
  app.post("/api/paystack/webhook", async (req: any, res) => {
    try {
      const paystackSecret = getPaystackSecretKey();
      if (!paystackSecret) return res.sendStatus(200);

      const signature = req.headers["x-paystack-signature"];
      if (signature) {
        const hash = crypto.createHmac("sha512", paystackSecret)
          .update(typeof req.rawBody === "string" ? req.rawBody : (req.rawBody instanceof Buffer ? req.rawBody : JSON.stringify(req.body)))
          .digest("hex");
        if (hash !== signature) {
          console.log("[webhook] Invalid signature — ignoring");
          return res.sendStatus(200);
        }
      }

      const event = req.body;
      if (event.event !== "charge.success") return res.sendStatus(200);

      const reference = event.data?.reference;
      if (!reference) return res.sendStatus(200);

      console.log(`[webhook] charge.success for ref=${reference}`);

      if (reference.startsWith("ct-cart-")) {
        const allTx = await storage.getAllTransactions();
        const cartTxs = allTx.filter((t) => t.paystackReference === reference && (t.status === "pending" || t.status === "cancelled"));
        for (const tx of cartTxs) {
          if (tx.status === "cancelled") {
            await storage.updateTransaction(tx.reference, { status: "pending" });
            tx.status = "pending";
          }
          await deliverAccount(tx);
        }
      } else {
        const transaction = await storage.getTransaction(reference);
        if (transaction && (transaction.status === "pending" || transaction.status === "cancelled")) {
          if (transaction.status === "cancelled") {
            await storage.updateTransaction(reference, { status: "pending" });
            transaction.status = "pending";
          }
          await deliverAccount(transaction);
        }
      }

      res.sendStatus(200);
    } catch (err: any) {
      console.error("[webhook] Error:", err.message);
      res.sendStatus(200);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Admin: 2FA Setup Status ──────────────────────────────────────────────
  app.get("/api/admin/2fa-status", (_req, res) => {
    res.json({ setupComplete: isSetupComplete() });
  });

  // ─── Admin: Generate 2FA setup QR ────────────────────────────────────────
  app.post("/api/admin/2fa-setup", async (req, res) => {
    try {
      const { email, password } = req.body;
      const creds = getAdminCredentials();
      if (email !== creds.email || password !== creds.password) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }
      const setup = await generateSetup();
      res.json({ success: true, ...setup });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Complete 2FA Setup ────────────────────────────────────────────
  app.post("/api/admin/2fa-complete", (req, res) => {
    const { email, password, secret, totpCode } = req.body;
    const creds = getAdminCredentials();
    if (email !== creds.email || password !== creds.password) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }
    const valid = verifyTotpWithSecret(totpCode, secret);
    if (!valid) return res.status(400).json({ success: false, error: "Invalid authenticator code - check your app" });
    saveSecret(secret);
    const token = createAdminToken();
    res.json({ success: true, token });
  });

  // ─── Secondary Super Admin helpers ───────────────────────────────────────
  function getSecondarySuperAdmins(): any[] {
    try { return JSON.parse(dbSettingsGet("secondary_super_admins") || "[]"); } catch { return []; }
  }
  function saveSecondarySuperAdmins(list: any[]): void {
    dbSettingsSet("secondary_super_admins", JSON.stringify(list));
  }

  // ─── Admin: Login ─────────────────────────────────────────────────────────
  app.post("/api/admin/login", async (req, res) => {
    const { email, password, totpCode } = req.body;
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "unknown";
    const creds = getAdminCredentials();

    if (email === creds.email && password === creds.password) {
      if (isSetupComplete()) {
        if (!totpCode) {
          return res.status(403).json({ success: false, error: "2FA code required", requiresTotp: true });
        }
        if (!verifyTotp(totpCode)) {
          logAdminAction({ action: "Login failed — wrong 2FA code", category: "auth", details: `Email: ${email}`, ip, status: "error" });
          return res.status(401).json({ success: false, error: "Invalid 2FA code" });
        }
      }
      const token = createAdminToken({ role: "super" });
      logAdminAction({ action: "Super admin logged in", category: "auth", details: `Email: ${email}`, ip, status: "success" });
      return res.json({ success: true, token, role: "super" });
    }

    // Check secondary super admins
    const secondaryAdmins = getSecondarySuperAdmins();
    const secondaryMatch = secondaryAdmins.find((sa: any) => sa.email === email && sa.active);
    if (secondaryMatch) {
      const valid = await bcrypt.compare(password, secondaryMatch.passwordHash);
      if (valid) {
        const token = createAdminToken({ role: "super", secondaryId: secondaryMatch.id });
        logAdminAction({ action: "Secondary super admin logged in", category: "auth", details: `Email: ${email}`, ip, status: "success" });
        return res.json({ success: true, token, role: "super" });
      }
    }

    const subAdmin = await storage.getSubAdminByEmail(email);
    if (subAdmin && subAdmin.active) {
      const valid = await bcrypt.compare(password, subAdmin.passwordHash);
      if (valid) {
        const token = createAdminToken({ role: "subadmin", subAdminId: subAdmin.id, permissions: subAdmin.permissions });
        logAdminAction({ action: "Sub-admin logged in", category: "auth", details: `Email: ${email}`, ip, status: "success" });
        return res.json({ success: true, token, role: "subadmin" });
      }
    }

    logAdminAction({ action: "Login failed — wrong credentials", category: "auth", details: `Email: ${email}`, ip, status: "error" });
    return res.status(401).json({ success: false, error: "Invalid email or password" });
  });

  // ─── Admin: Current user info ────────────────────────────────────────────
  app.get("/api/admin/me", adminAuthMiddleware, async (req: any, res) => {
    if (req.adminRole === "super") {
      const isPrimary = !req.secondaryId;
      if (!isPrimary) {
        const all = getSecondarySuperAdmins();
        const sa = all.find((s: any) => s.id === req.secondaryId);
        return res.json({ success: true, role: "super", permissions: "all", isPrimary: false, name: sa?.name, email: sa?.email });
      }
      return res.json({ success: true, role: "super", permissions: "all", isPrimary: true });
    }
    const subAdmin = await storage.getSubAdminById(req.subAdminId);
    if (!subAdmin || !subAdmin.active) return res.status(401).json({ success: false, error: "Account deactivated" });
    res.json({ success: true, role: "subadmin", permissions: subAdmin.permissions, name: subAdmin.name, email: subAdmin.email });
  });

  // ─── Admin: Profile ───────────────────────────────────────────────────────
  app.get("/api/admin/profile", adminAuthMiddleware, async (req: any, res) => {
    if (req.adminRole === "super") {
      const override = (() => { try { return JSON.parse(dbSettingsGet("credentials_override") || "{}"); } catch { return {}; } })();
      return res.json({
        success: true,
        role: "super",
        name: dbSettingsGet("admin_name") || "Super Admin",
        avatar: dbSettingsGet("admin_avatar") || "CT",
        bio: dbSettingsGet("admin_bio") || "",
        email: override.adminEmail || process.env.ADMIN_EMAIL || "",
      });
    }
    const subAdmin = await storage.getSubAdminById(req.subAdminId);
    if (!subAdmin) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, role: "subadmin", name: subAdmin.name, avatar: subAdmin.name?.slice(0, 2).toUpperCase() || "SA", bio: "", email: subAdmin.email });
  });

  app.put("/api/admin/profile", adminAuthMiddleware, async (req: any, res) => {
    const { name, avatar, bio } = req.body;
    if (req.adminRole === "super") {
      if (name !== undefined) dbSettingsSet("admin_name", name.trim() || "Super Admin");
      if (avatar !== undefined) dbSettingsSet("admin_avatar", avatar.trim() || "CT");
      if (bio !== undefined) dbSettingsSet("admin_bio", bio.trim());
      return res.json({ success: true });
    }
    if (name !== undefined) await storage.updateSubAdmin(req.subAdminId, { name: name.trim() });
    res.json({ success: true });
  });

  // ─── Admin: Get secrets status ────────────────────────────────────────────
  app.get("/api/admin/secrets", adminAuthMiddleware, superAdminOnly, (_req, res) => {
    res.json({ success: true, secrets: getSecretsStatus() });
  });

  // ─── Admin: Test email ────────────────────────────────────────────────────
  app.post("/api/admin/test-email", adminAuthMiddleware, superAdminOnly, async (req, res) => {
    const to = (req.body?.to || process.env.ADMIN_EMAIL || "").trim();
    if (!to) return res.status(400).json({ success: false, error: "No recipient — set ADMIN_EMAIL or pass 'to' in the request body." });
    const result = await sendPasswordResetEmail(to, "TEST-OK", "Admin");
    // Also check domain verification status to warn the admin
    let domainWarning: string | undefined;
    try {
      const { Resend } = await import("resend");
      const { getResendApiKey, getResendOtpFrom } = await import("./secrets");
      const key = getResendApiKey();
      if (key) {
        const resend = new Resend(key);
        const { data: domainsData } = await resend.domains.list();
        const fromAddr = getResendOtpFrom();
        const fromDomain = fromAddr?.split("@")[1];
        if (domainsData && domainsData.data) {
          const verifiedDomains = domainsData.data.filter((d: any) => d.status === "verified").map((d: any) => d.name);
          if (fromDomain && !verifiedDomains.includes(fromDomain)) {
            domainWarning = verifiedDomains.length === 0
              ? `Your domain "${fromDomain}" is NOT verified on Resend. Emails will appear sent but will only deliver to your Resend account's registered email. Verify your domain at resend.com/domains.`
              : `Your sending domain "${fromDomain}" is not verified. Verified domains: ${verifiedDomains.join(", ")}. Add "${fromDomain}" at resend.com/domains.`;
          }
        } else if (!fromAddr || fromAddr.includes("onboarding@resend.dev")) {
          domainWarning = "No from address configured. Using Resend test address — emails only deliver to your own Resend account email.";
        }
      }
    } catch (_) {}
    res.json({ ...result, to, domainWarning });
  });

  // ─── Admin: Resend domain verification status ─────────────────────────────
  app.get("/api/admin/email/domain-status", adminAuthMiddleware, superAdminOnly, async (_req, res) => {
    try {
      const { Resend } = await import("resend");
      const { getResendApiKey, getResendFrom, getResendOtpFrom, getResendSupportFrom } = await import("./secrets");
      const key = getResendApiKey();
      if (!key) return res.json({ success: false, error: "Resend API key not configured", domains: [] });
      const resend = new Resend(key);
      const { data, error } = await resend.domains.list();
      if (error) return res.json({ success: false, error: error.message, domains: [] });
      const domains = (data?.data || []).map((d: any) => ({
        name: d.name,
        status: d.status,
        region: d.region,
        createdAt: d.created_at,
      }));
      const fromAddrs = [getResendFrom(), getResendOtpFrom(), getResendSupportFrom()].filter(Boolean);
      const fromDomains = Array.from(new Set(fromAddrs.map(a => a.split("@")[1]).filter(Boolean)));
      const unverified = fromDomains.filter(d => !domains.find((rd: any) => rd.name === d && rd.status === "verified"));
      res.json({ success: true, domains, fromDomains, unverifiedFromDomains: unverified, allVerified: unverified.length === 0 && domains.length > 0 });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, domains: [] });
    }
  });


  // ─── Flash Sales — Public ────────────────────────────────────────────────────
  app.get("/api/flash-sales", (_req, res) => {
    try {
      const sales = storage.getActiveFlashSales();
      res.json({ success: true, sales });
    } catch (err: any) {
      res.json({ success: true, sales: [] });
    }
  });

  // ─── Flash Sales — Admin CRUD ────────────────────────────────────────────────
  app.get("/api/admin/flash-sales", adminAuthMiddleware, (_req, res) => {
    try {
      res.json({ success: true, sales: storage.getAllFlashSales() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/flash-sales", adminAuthMiddleware, (req, res) => {
    try {
      const { label, planId, discountPercent, startsAt, endsAt } = req.body;
      if (!label || !discountPercent || !startsAt || !endsAt)
        return res.status(400).json({ success: false, error: "label, discountPercent, startsAt, endsAt are required" });
      const sale = storage.createFlashSale({ label, planId, discountPercent: Number(discountPercent), startsAt, endsAt });
      res.json({ success: true, sale });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch("/api/admin/flash-sales/:id", adminAuthMiddleware, (req, res) => {
    try {
      const id = Number(req.params.id);
      const sale = storage.updateFlashSale(id, req.body);
      res.json({ success: true, sale });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/admin/flash-sales/:id", adminAuthMiddleware, (req, res) => {
    try {
      storage.deleteFlashSale(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Stats ─────────────────────────────────────────────────────────
  app.get("/api/admin/stats", adminAuthMiddleware, async (_req, res) => {
    try {
      const [txStats, accStats] = await Promise.all([
        storage.getStats(),
        Promise.resolve(accountManager.getStats()),
      ]);

      // Include bot order revenue and counts
      let botStats = { total: 0, revenue: 0, deployed: 0 };
      try {
        const paidStatuses = `'paid','deployed','stopped','suspended','deploy_failed'`;
        const botRows = await runQuery(
          `SELECT COUNT(*) as total, COALESCE(SUM(amount),0) as revenue, COUNT(CASE WHEN status='deployed' THEN 1 END) as deployed FROM bot_orders WHERE status IN (${paidStatuses})`,
          []
        );
        if (botRows.length) {
          botStats = {
            total: Number(botRows[0].total || 0),
            revenue: Number(botRows[0].revenue || 0),
            deployed: Number(botRows[0].deployed || 0),
          };
        }
      } catch (_) {}

      res.json({
        success: true,
        transactions: {
          ...txStats,
          revenue: txStats.revenue + botStats.revenue,
          total: txStats.total + botStats.total,
        },
        accounts: accStats,
        bots: botStats,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Revenue Analytics (last 30 days) ──────────────────────────────
  app.get("/api/admin/analytics", adminAuthMiddleware, async (_req, res) => {
    try {
      const days: { date: string; revenue: number; orders: number; botRevenue: number }[] = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const nextD = new Date(d);
        nextD.setDate(nextD.getDate() + 1);
        let subRevenue = 0, subOrders = 0, botRev = 0;
        try {
          const txRows = await runQuery(
            `SELECT COALESCE(SUM(amount),0) as revenue, COUNT(*) as orders FROM transactions WHERE status='success' AND created_at >= $1 AND created_at < $2`,
            [d.toISOString(), nextD.toISOString()]
          );
          subRevenue = Number(txRows[0]?.revenue || 0);
          subOrders = Number(txRows[0]?.orders || 0);
        } catch (_) {}
        try {
          const botRows = await runQuery(
            `SELECT COALESCE(SUM(amount),0) as revenue FROM bot_orders WHERE status IN ('paid','deployed','stopped','suspended','deploy_failed') AND created_at >= $1 AND created_at < $2`,
            [d.toISOString(), nextD.toISOString()]
          );
          botRev = Number(botRows[0]?.revenue || 0);
        } catch (_) {}
        days.push({ date: dateStr, revenue: subRevenue + botRev, orders: subOrders, botRevenue: botRev });
      }
      res.json({ success: true, days });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Ratings ───────────────────────────────────────────────────────
  app.get("/api/admin/ratings", adminAuthMiddleware, async (_req, res) => {
    try {
      const ratings = await storage.getAllRatings(200);
      const avg = ratings.length ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length) : 0;
      res.json({ success: true, ratings, count: ratings.length, average: Math.round(avg * 10) / 10 });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Transactions ──────────────────────────────────────────────────
  app.get("/api/admin/transactions", adminAuthMiddleware, requirePermission("dashboard", "transactions"), async (_req, res) => {
    try {
      const txs = await storage.getAllTransactions();
      // Merge bot orders as transactions
      let botTxs: any[] = [];
      try {
        const botOrders = await runQuery("SELECT * FROM bot_orders ORDER BY created_at DESC", []);
        botTxs = botOrders.map((o: any) => ({
          id: `bot-${o.id}`,
          reference: o.reference,
          planId: `bot-${o.bot_id}`,
          planName: o.bot_name,
          customerEmail: o.customer_email,
          customerName: o.customer_name,
          amount: o.amount,
          status: (o.status === "paid" || o.status === "deployed" || o.status === "deploying" || o.status === "stopped" || o.status === "suspended") ? "success" : o.status === "failed" ? "failed" : "pending",
          emailSent: true,
          accountAssigned: o.status === "deployed",
          paystackReference: o.paystack_reference,
          createdAt: o.created_at,
          updatedAt: o.updated_at,
          isBotOrder: true,
          botStatus: o.status,
          deployUrl: o.render_service_url,
        }));
      } catch { /* bot_orders table may not exist yet */ }
      const allTxs = [...txs, ...botTxs].sort((a: any, b: any) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );
      res.json({ success: true, transactions: allTxs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Get all accounts ──────────────────────────────────────────────
  app.get("/api/admin/accounts", adminAuthMiddleware, requirePermission("accounts"), (_req, res) => {
    const raw = accountManager.getAllAccounts();
    // Strip plain-text passwords from the response — no admin should read them back
    const masked: Record<string, any[]> = {};
    for (const [planId, accs] of Object.entries(raw)) {
      masked[planId] = (accs as any[]).map((acc) => ({
        ...acc,
        password: undefined,
        hasPassword: !!(acc as any).password,
      }));
    }
    res.json({ success: true, accounts: masked });
  });

  // ─── Admin: Add account ───────────────────────────────────────────────────
  app.post("/api/admin/accounts", adminAuthMiddleware, requirePermission("accounts"), (req, res) => {
    try {
      const { planId, email, username, password, activationCode, redeemLink, instructions, maxUsers } = req.body;
      if (!planId) return res.status(400).json({ success: false, error: "planId is required" });
      const account = accountManager.addAccount(planId, {
        email, username, password, activationCode, redeemLink, instructions,
        maxUsers: parseInt(maxUsers) || 5,
      });
      const { password: _pw, ...safeAcc } = account as any;
      res.json({ success: true, account: { ...safeAcc, hasPassword: !!_pw } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Update account ────────────────────────────────────────────────
  app.put("/api/admin/accounts/:id", adminAuthMiddleware, requirePermission("accounts"), (req, res) => {
    // Only update the password if the admin explicitly provided a non-empty new one
    const updates = { ...req.body };
    if (!updates.password || updates.password.trim() === "") {
      delete updates.password; // keep the stored password untouched
    }
    const updated = accountManager.updateAccount(req.params.id, updates);
    if (!updated) return res.status(404).json({ success: false, error: "Account not found" });
    // Never return the password in the response
    const { password: _pw, ...safeAccount } = updated as any;
    res.json({ success: true, account: { ...safeAccount, hasPassword: !!_pw } });
  });

  // ─── Admin: Toggle account disabled ──────────────────────────────────────
  app.patch("/api/admin/accounts/:id/toggle", adminAuthMiddleware, requirePermission("accounts"), (req, res) => {
    const acc = accountManager.toggleAccountDisabled(req.params.id);
    if (!acc) return res.status(404).json({ success: false, error: "Account not found" });
    res.json({ success: true, account: acc });
  });

  // ─── Admin: Delete account ────────────────────────────────────────────────
  app.delete("/api/admin/accounts/:id", adminAuthMiddleware, requirePermission("accounts"), (req, res) => {
    const result = accountManager.removeAccount(req.params.id);
    if (result.removed) res.json({ success: true });
    else res.status(404).json({ success: false, error: "Account not found" });
  });

  // ─── Admin: Bulk add accounts ─────────────────────────────────────────────
  app.post("/api/admin/accounts/bulk", adminAuthMiddleware, requirePermission("accounts"), (req, res) => {
    try {
      const { planId, accounts: rows } = req.body;
      if (!planId) return res.status(400).json({ success: false, error: "planId is required" });
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ success: false, error: "accounts array is required" });
      const added: any[] = [];
      const errors: string[] = [];
      rows.forEach((row: any, i: number) => {
        try {
          if (!row.email && !row.username && !row.password) { errors.push(`Row ${i + 1}: at least email or password required`); return; }
          const acc = accountManager.addAccount(planId, {
            email: row.email || "",
            username: row.username || "",
            password: row.password || "",
            activationCode: row.activationCode || "",
            redeemLink: row.redeemLink || "",
            instructions: row.instructions || "",
            maxUsers: parseInt(row.maxUsers) || 5,
          });
          added.push(acc);
        } catch (e: any) {
          errors.push(`Row ${i + 1}: ${e.message}`);
        }
      });
      logAdminAction({ action: `Bulk upload: ${added.length} accounts added to ${planId}`, category: "accounts", details: `${added.length} added, ${errors.length} errors`, status: "success" });
      res.json({ success: true, added: added.length, errors });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Resend credentials ────────────────────────────────────────────
  app.post("/api/admin/transactions/:reference/resend", adminAuthMiddleware, requirePermission("transactions"), async (req, res) => {
    try {
      const tx = await storage.getTransaction(req.params.reference);
      if (!tx) return res.status(404).json({ success: false, error: "Transaction not found" });
      if (tx.status !== "success") return res.status(400).json({ success: false, error: "Can only resend for completed transactions" });
      const account = accountManager.findAccountByCustomer(tx.planId, tx.customerEmail);
      if (!account) return res.status(404).json({ success: false, error: "No assigned account found for this order" });
      const emailResult = await sendAccountEmail(tx.customerEmail, tx.planName, account, tx.customerName || "Customer");
      logDelivery({
        reference: tx.reference,
        customerEmail: tx.customerEmail,
        customerName: tx.customerName || "Customer",
        planName: tx.planName,
        planId: tx.planId,
        method: "resend_email",
        status: emailResult.success ? "success" : "failed",
        details: emailResult.success
          ? `Credentials re-sent to ${tx.customerEmail} (admin action)`
          : `Resend failed: ${emailResult.error || "unknown error"}`,
        metadata: { recipientEmail: tx.customerEmail, triggeredBy: "admin" },
      });
      logAdminAction({ action: `Credentials resent to ${tx.customerEmail} for ${tx.planName}`, category: "transactions", details: `Transaction: ${tx.reference}`, status: "success" });
      res.json({ success: true, emailSent: emailResult.success });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Manual Transaction Verification ─────────────────────────────
  app.post("/api/admin/transactions/:reference/verify", adminAuthMiddleware, requirePermission("transactions"), async (req, res) => {
    try {
      const tx = await storage.getTransaction(req.params.reference);
      if (!tx) return res.status(404).json({ success: false, error: "Transaction not found" });
      if (tx.status === "success") return res.status(400).json({ success: false, error: "Transaction already verified and delivered" });

      const freshTx = await storage.getTransaction(req.params.reference);
      if (freshTx?.status === "success") return res.status(400).json({ success: false, error: "Transaction was already delivered (concurrent action)" });

      let verificationMethod = "admin_force_override";
      const paystackCheck = await verifyPaystackPayment(tx.reference);
      if (paystackCheck.configured && paystackCheck.success) {
        verificationMethod = "admin_paystack_confirmed";
      }

      const delivery = await deliverAccount(tx);
      if (delivery.success) {
        logAdminAction({
          action: `Manually verified transaction ${tx.reference} for ${tx.customerEmail}`,
          category: "transactions",
          status: "success",
          details: `Method: ${verificationMethod}. Account delivered to ${tx.customerEmail}`,
        });
        res.json({
          success: true,
          message: "Transaction verified and credentials delivered",
          method: verificationMethod,
        });
      } else {
        logAdminAction({ action: `Manual verification attempted for ${tx.reference}`, category: "transactions", status: "error", details: delivery.error || "Failed to deliver account" });
        res.json({ success: false, error: delivery.error || "Failed to deliver account" });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Delivery Proof ──────────────────────────────────────────────
  app.get("/api/admin/delivery-proof/:reference", adminAuthMiddleware, requirePermission("transactions"), (req, res) => {
    try {
      const proof = getDeliveryProof(req.params.reference);
      res.json({ success: true, proof });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/admin/delivery-logs", adminAuthMiddleware, requirePermission("transactions"), (req, res) => {
    try {
      const email = req.query.email as string | undefined;
      const reference = req.query.reference as string | undefined;
      const logs = getDeliveryLogs(reference, email);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Analytics ─────────────────────────────────────────────────────
  app.get("/api/admin/analytics", adminAuthMiddleware, requirePermission("dashboard"), async (_req, res) => {
    try {
      const all = await storage.getAllTransactions();
      const successful = all.filter((t) => t.status === "success");
      const now = new Date();
      const daily: Record<string, { date: string; revenue: number; orders: number }> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        daily[key] = { date: key, revenue: 0, orders: 0 };
      }
      successful.forEach((t) => {
        if (t.createdAt) {
          const key = new Date(t.createdAt).toISOString().split("T")[0];
          if (daily[key]) { daily[key].revenue += t.amount; daily[key].orders += 1; }
        }
      });
      const planRevenue: Record<string, { planName: string; revenue: number; orders: number }> = {};
      successful.forEach((t) => {
        if (!planRevenue[t.planId]) planRevenue[t.planId] = { planName: t.planName, revenue: 0, orders: 0 };
        planRevenue[t.planId].revenue += t.amount;
        planRevenue[t.planId].orders += 1;
      });
      const topPlans = Object.values(planRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      res.json({ success: true, daily: Object.values(daily), topPlans });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Get plan overrides ────────────────────────────────────────────
  app.get("/api/admin/plan-overrides", adminAuthMiddleware, requirePermission("plans"), (_req, res) => {
    res.json({ success: true, overrides: planOverridesManager.getOverrides() });
  });

  // ─── Admin: Update plan override ─────────────────────────────────────────
  app.put("/api/admin/plans/:planId", adminAuthMiddleware, requirePermission("plans"), (req, res) => {
    planOverridesManager.setOverride(req.params.planId, req.body);
    res.json({ success: true });
  });

  // ─── Admin: Reset plan override ───────────────────────────────────────────
  app.delete("/api/admin/plans/:planId/override", adminAuthMiddleware, requirePermission("plans"), (req, res) => {
    planOverridesManager.deleteOverride(req.params.planId);
    res.json({ success: true });
  });

  // ─── Admin: Get custom plans ──────────────────────────────────────────────
  app.get("/api/admin/custom-plans", adminAuthMiddleware, requirePermission("plans"), (_req, res) => {
    res.json({ success: true, plans: planOverridesManager.getCustomPlans() });
  });

  // ─── Admin: Add custom plan ───────────────────────────────────────────────
  app.post("/api/admin/custom-plans", adminAuthMiddleware, requirePermission("plans"), (req, res) => {
    try {
      const plan = planOverridesManager.addCustomPlan(req.body);
      res.json({ success: true, plan });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Update custom plan ────────────────────────────────────────────
  app.put("/api/admin/custom-plans/:id", adminAuthMiddleware, requirePermission("plans"), (req, res) => {
    const plan = planOverridesManager.updateCustomPlan(req.params.id, req.body);
    if (!plan) return res.status(404).json({ success: false, error: "Custom plan not found" });
    res.json({ success: true, plan });
  });

  // ─── Admin: Delete custom plan ────────────────────────────────────────────
  app.delete("/api/admin/custom-plans/:id", adminAuthMiddleware, requirePermission("plans"), (req, res) => {
    const ok = planOverridesManager.deleteCustomPlan(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: "Custom plan not found" });
    res.json({ success: true });
  });

  // ─── Admin: Get promo codes ───────────────────────────────────────────────
  app.get("/api/admin/promo-codes", adminAuthMiddleware, requirePermission("plans"), (_req, res) => {
    res.json({ success: true, codes: promoManager.getAll() });
  });

  // ─── Admin: Create promo code ─────────────────────────────────────────────
  app.post("/api/admin/promo-codes", adminAuthMiddleware, requirePermission("plans"), (req, res) => {
    try {
      const code = promoManager.create(req.body);
      res.json({ success: true, code });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Update promo code ─────────────────────────────────────────────
  app.put("/api/admin/promo-codes/:code", adminAuthMiddleware, requirePermission("plans"), (req, res) => {
    const updated = promoManager.update(req.params.code, req.body);
    if (!updated) return res.status(404).json({ success: false, error: "Promo code not found" });
    res.json({ success: true, code: updated });
  });

  // ─── Admin: Delete promo code ───────────────────────────────────────�����─────
  app.delete("/api/admin/promo-codes/:code", adminAuthMiddleware, requirePermission("plans"), (req, res) => {
    const ok = promoManager.delete(req.params.code);
    if (!ok) return res.status(404).json({ success: false, error: "Promo code not found" });
    res.json({ success: true });
  });

  // ─── Admin: Get all API keys ──────────────────────────────────────────────
  app.get("/api/admin/api-keys", adminAuthMiddleware, requirePermission("api-keys"), async (_req, res) => {
    try {
      const keys = await storage.getAllApiKeys();
      res.json({ success: true, keys });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Generate API key ──────────────────────────────────────────────
  app.post("/api/admin/api-keys", adminAuthMiddleware, requirePermission("api-keys"), async (req, res) => {
    try {
      const { label, customerId } = req.body;
      if (!label) return res.status(400).json({ success: false, error: "Label is required" });
      const key = `ct_${uuidv4().replace(/-/g, "")}`;
      const apiKey = await storage.createApiKey({ key, label, customerId: customerId || undefined });
      res.json({ success: true, apiKey });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Delete API key ────────────────────────────────────────────────
  app.delete("/api/admin/api-keys/:id", adminAuthMiddleware, requirePermission("api-keys"), async (req, res) => {
    try {
      await storage.deleteApiKey(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Revoke API key ────────────────────────────────────────────────
  app.patch("/api/admin/api-keys/:id/revoke", adminAuthMiddleware, requirePermission("api-keys"), async (req, res) => {
    try {
      await storage.revokeApiKey(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER AUTH ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Customer: Register ───────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, name, password, referralCode } = req.body;
      if (!email || !password) return res.status(400).json({ success: false, error: "Email and password are required" });
      if (password.length < 6) return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });

      const existing = await storage.getCustomerByEmail(email);
      if (existing && existing.emailVerified) {
        return res.status(409).json({ success: false, error: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const verificationCode = crypto.randomBytes(32).toString("hex");
      const verificationExpiresDate = new Date(Date.now() + 30 * 60 * 1000);
      const verificationExpires = verificationExpiresDate.toISOString();

      if (existing && !existing.emailVerified) {
        await storage.updateCustomer(existing.id, { passwordHash, verificationCode, verificationExpires, name });
      } else {
        await storage.createCustomer({ email, name, passwordHash, verificationCode, verificationExpires: verificationExpiresDate });
      }

      if (referralCode && typeof referralCode === "string") {
        const referral = await storage.getReferralByCode(referralCode.trim().toUpperCase());
        if (referral && referral.status === "pending") {
          dbSettingsSet(`referral_pending_${email}`, referralCode.trim().toUpperCase());
        }
      }

      res.json({ success: true, message: "Verification link sent to your email", verificationMode: "link" });
      sendVerificationEmail(email, verificationCode, name).catch((err) => {
        console.error("[email] Failed to send verification code to", email, err?.message);
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Resend verification code (no password needed) ────────────────
  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, error: "Email is required" });
      const customer = await storage.getCustomerByEmail(email);
      if (!customer) return res.status(404).json({ success: false, error: "Account not found" });
      if (customer.emailVerified) return res.status(400).json({ success: false, error: "Email already verified" });
      const verificationCode = crypto.randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await storage.updateCustomer(customer.id, { verificationCode, verificationExpires });
      res.json({ success: true, message: "Verification link resent", verificationMode: "link" });
      sendVerificationEmail(email, verificationCode, customer.name || undefined).catch((err) => {
        console.error("[email] Failed to resend verification code to", email, err?.message);
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Verify email ───────────────────────────────────────────────
  // ─── Customer: Verify email via link (clicked from email) ───────────────────
  app.get("/api/auth/verify-link", async (req, res) => {
    const escapeHtml = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
    const sitePrefix = (() => {
      const cfg = getAppConfig();
      if (cfg.customDomain) return `https://${cfg.customDomain}`;
      if (cfg.appDomain) return `https://${cfg.appDomain}`;
      return "";
    })();
    const renderPage = (opts: { ok: boolean; title: string; body: string; cta?: { label: string; href: string } }) => {
      const color = opts.ok ? "#10B981" : "#EF4444";
      const icon = opts.ok ? "✓" : "✕";
      const cta = opts.cta ? `<a href="${opts.cta.href}" style="display:inline-block;margin-top:18px;background:linear-gradient(135deg,#4169E1 0%,#7C3AED 100%);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;">${escapeHtml(opts.cta.label)}</a>` : "";
      return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escapeHtml(opts.title)}</title></head><body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,'Segoe UI',Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;"><div style="max-width:440px;width:90%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:40px 28px;text-align:center;backdrop-filter:blur(12px);"><div style="width:64px;height:64px;border-radius:50%;background:${color}22;border:2px solid ${color};color:${color};font-size:32px;font-weight:bold;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 20px;">${icon}</div><h1 style="color:#fff;margin:0 0 10px;font-size:22px;font-weight:700;">${escapeHtml(opts.title)}</h1><p style="color:rgba(255,255,255,.65);margin:0;font-size:14px;line-height:1.5;">${opts.body}</p>${cta}</div></body></html>`;
    };

    try {
      const tokenParam = String((req.query.token ?? "")).trim();
      const emailParam = String((req.query.email ?? "")).trim();
      if (!tokenParam || !emailParam) {
        return res.status(400).type("html").send(renderPage({ ok: false, title: "Invalid link", body: "This verification link is missing required parameters.", cta: { label: "Back to sign in", href: `${sitePrefix}/auth` } }));
      }
      const customer = await storage.getCustomerByEmail(emailParam);
      if (!customer) {
        return res.status(404).type("html").send(renderPage({ ok: false, title: "Account not found", body: "We couldn't find an account for this email.", cta: { label: "Sign up", href: `${sitePrefix}/auth` } }));
      }
      if (customer.emailVerified) {
        return res.status(200).type("html").send(renderPage({ ok: true, title: "Already verified", body: "Your email has already been confirmed. You can sign in now.", cta: { label: "Go to sign in", href: `${sitePrefix}/auth` } }));
      }
      if (customer.verificationCode !== tokenParam) {
        return res.status(400).type("html").send(renderPage({ ok: false, title: "Invalid link", body: "This verification link is invalid. Please request a new one.", cta: { label: "Resend link", href: `${sitePrefix}/auth` } }));
      }
      if (customer.verificationExpires && new Date(customer.verificationExpires) < new Date()) {
        return res.status(400).type("html").send(renderPage({ ok: false, title: "Link expired", body: "This verification link has expired. Please request a new one.", cta: { label: "Resend link", href: `${sitePrefix}/auth` } }));
      }

      await storage.updateCustomer(customer.id, { emailVerified: true, verificationCode: null, verificationExpires: null });

      const sessionToken = createCustomerJwt(customer.id, customer.email);
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const ua = req.headers["user-agent"] || "";
      await storage.createCustomerSession(customer.id, sessionToken, expiresAt, {
        ip: getReqIp(req), userAgent: ua, deviceName: parseDeviceName(ua),
      });

      res.cookie("customer_token", sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 3 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      notifyNewCustomer({ name: customer.name || "", email: customer.email }).catch(() => {});

      // Redirect to a frontend success page (it will pick up the cookie via /api/auth/me)
      return res.redirect(`${sitePrefix}/verify-email?status=success`);
    } catch (err: any) {
      console.error("[verify-link]", err);
      return res.status(500).type("html").send(renderPage({ ok: false, title: "Something went wrong", body: escapeHtml(err.message || "Try again later."), cta: { label: "Back to sign in", href: `${sitePrefix}/auth` } }));
    }
  });

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { email, code, token: tokenParam } = req.body;
      const submitted = ((tokenParam || code) || "").toString().trim();
      const customer = await storage.getCustomerByEmail(email);
      if (!customer) return res.status(404).json({ success: false, error: "Account not found" });
      if (customer.emailVerified) return res.status(400).json({ success: false, error: "Email already verified" });
      if (!submitted || customer.verificationCode !== submitted) return res.status(400).json({ success: false, error: "Invalid or expired verification link" });
      if (customer.verificationExpires && new Date(customer.verificationExpires) < new Date()) {
        return res.status(400).json({ success: false, error: "Verification code has expired. Click resend to get a new one." });
      }

      await storage.updateCustomer(customer.id, { emailVerified: true, verificationCode: null, verificationExpires: null });

      const token = createCustomerJwt(customer.id, customer.email);
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const regUa = req.headers["user-agent"] || "";
      await storage.createCustomerSession(customer.id, token, expiresAt, {
        ip: getReqIp(req), userAgent: regUa, deviceName: parseDeviceName(regUa),
      });

      // Set persistent HttpOnly cookie (3 days)
      res.cookie("customer_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 3 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      notifyNewCustomer({ name: customer.name || "", email: customer.email }).catch(() => {});

      res.json({ success: true, token, customer: { id: customer.id, email: customer.email, name: customer.name, avatarUrl: customer.avatarUrl || null } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Login ──────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ success: false, error: "Email and password are required" });

      const customer = await storage.getCustomerByEmail(email);
      if (!customer) return res.status(401).json({ success: false, error: "Invalid email or password" });
      if (!customer.emailVerified) return res.status(403).json({ success: false, error: "Please verify your email first", needsVerification: true, email });
      if (!customer.passwordHash) return res.status(401).json({ success: false, error: "Invalid account" });
      if (customer.suspended) return res.status(403).json({ success: false, error: "Your account has been suspended. Please contact support to resolve this.", suspended: true });

      const valid = await bcrypt.compare(password, customer.passwordHash);
      if (!valid) return res.status(401).json({ success: false, error: "Invalid email or password" });

      const token = createCustomerJwt(customer.id, customer.email);
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      // ─── Login IP & geo detection ─────────────────────────────────────
      const rawIp = getReqIp(req);
      const userAgent = req.headers["user-agent"] || "";
      await storage.createCustomerSession(customer.id, token, expiresAt, {
        ip: rawIp, userAgent, deviceName: parseDeviceName(userAgent),
      });

      // Set persistent HttpOnly cookie (3 days, same lifetime as the session)
      res.cookie("customer_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 3 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      (async () => {
        try {
          let geoData: any = {};
          if (rawIp && rawIp !== "unknown" && rawIp !== "127.0.0.1" && !rawIp.startsWith("::")) {
            const geoRes = await fetch(`http://ip-api.com/json/${rawIp}?fields=status,country,countryCode,city,isp`);
            if (geoRes.ok) geoData = await geoRes.json();
          }
          await storage.createLoginLog(customer.id, {
            ip: rawIp,
            country: geoData.country,
            countryCode: geoData.countryCode,
            city: geoData.city,
            isp: geoData.isp,
            userAgent,
          });

          // ── Auto-suspend: 5+ distinct IPs ──────────��─��──────────────────
          const logs = await storage.getLoginLogs(customer.id);
          const privateIp = /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|::1$|::ffff:|localhost)/;
          const distinctIps = new Set(
            logs.map((l: any) => l.ip).filter((ip: string) => ip && !privateIp.test(ip))
          );
          if (distinctIps.size >= 5 && !customer.suspended) {
            await storage.updateCustomer(customer.id, { suspended: true });
            await storage.createNotification(
              customer.id, "security",
              "🔒 Account Suspended",
              "Your account was automatically suspended — logins detected from 5+ different IP addresses. Contact support to restore access."
            );
            sendSuspensionEmail(
              customer.email,
              customer.name || undefined,
              `Automatic suspension: logins detected from ${distinctIps.size} different IP addresses. This may indicate unauthorized account sharing or a compromised account.`
            ).catch(() => {});
            sendTelegramMessage(
              `🔒 <b>Auto-Suspension</b>\n\n` +
              `Customer: <code>${customer.email}</code>\n` +
              `Name: ${customer.name || "Unknown"}\n` +
              `Distinct IPs: <b>${distinctIps.size}</b>\n` +
              `IPs: ${Array.from(distinctIps).join(", ")}\n\n` +
              `Account has been <b>automatically suspended</b>.\n` +
              `Go to Admin → Customers to review and restore if legitimate.`
            ).catch(() => {});
            console.warn(`[security] Auto-suspended customer ${customer.email} — ${distinctIps.size} distinct IPs detected`);
          }
        } catch (_) {}
      })();

      res.json({ success: true, token, customer: { id: customer.id, email: customer.email, name: customer.name, avatarUrl: customer.avatarUrl || null } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Forgot Password ────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, error: "Email is required" });

      const customer = await storage.getCustomerByEmail(email);
      if (!customer || !customer.emailVerified) {
        return res.json({ success: true, message: "If this email exists, a reset code has been sent" });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await storage.updateCustomer(customer.id, { passwordResetCode: resetToken, passwordResetExpires: expires });
      res.json({ success: true, message: "Password reset link sent to your email", resetMode: "link" });
      sendPasswordResetLinkEmail(email, resetToken, customer.name || undefined).catch((err) => {
        console.error("[email] reset link send failed:", err?.message);
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Reset Password ─────────────────────────────────────────────
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, code, token: tokenParam, newPassword } = req.body;
      const submitted = ((tokenParam || code) || "").toString().trim();
      if (!email || !submitted || !newPassword) {
        return res.status(400).json({ success: false, error: "Email, token, and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
      }

      const customer = await storage.getCustomerByEmail(email);
      if (!customer || !customer.passwordResetCode) {
        return res.status(400).json({ success: false, error: "Invalid or expired reset code" });
      }
      if (customer.passwordResetCode !== submitted) {
        return res.status(400).json({ success: false, error: "Invalid or expired reset link" });
      }
      if (customer.passwordResetExpires && new Date(customer.passwordResetExpires) < new Date()) {
        return res.status(400).json({ success: false, error: "Reset code has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateCustomer(customer.id, {
        passwordHash,
        passwordResetCode: null,
        passwordResetExpires: null,
      });
      res.json({ success: true, message: "Password reset successfully" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Logout ─────────────────────────────────────────────────────
  app.post("/api/auth/logout", async (req, res) => {
    // Delete session from DB — accept token from cookie or Bearer header
    const cookieToken: string = req.cookies?.customer_token || "";
    const headerToken: string = req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : "";
    const token = cookieToken || headerToken;
    if (token) await storage.deleteCustomerSession(token).catch(() => {});
    // Always clear the cookie regardless
    res.clearCookie("customer_token", { path: "/" });
    res.json({ success: true });
  });

  // ─── Customer: Me ─────────────────────────────────────────────────────────
  app.get("/api/auth/me", customerAuthMiddleware, (req: any, res) => {
    const c = req.customer;
    // Return the token so the client can rehydrate localStorage from a cookie-only session
    const tok: string = req.cookies?.customer_token || (req.headers.authorization || "").replace("Bearer ", "") || "";
    res.json({ success: true, token: tok || undefined, customer: { id: c.id, email: c.email, name: c.name, avatarUrl: c.avatarUrl || null } });
  });

  // ─── Customer: Order history ──────────────────────────────────────────────
  app.get("/api/customer/me", customerAuthMiddleware, async (req: any, res) => {
    try {
      const c = await storage.getCustomerById(req.customer.id);
      if (!c) return res.status(404).json({ success: false, error: "Customer not found" });
      const { passwordHash, verificationCode, passwordResetCode, passwordResetExpires, ...safe } = c as any;
      res.json({ success: true, customer: safe });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/customer/orders", customerAuthMiddleware, async (req: any, res) => {
    try {
      // Auto-fail any pending transactions older than 30 minutes
      try { await storage.cancelExpiredTransactions(30); } catch (e) { console.warn("cancelExpiredTransactions:", e); }
      const orders = await storage.getTransactionsByEmail(req.customer.email);
      res.json({ success: true, orders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Get my bot orders ─────────────────────────────────────────
  app.get("/api/customer/my-bots", customerAuthMiddleware, async (req: any, res) => {
    try {
      // Auto-fail any pending bot orders older than 30 minutes
      try {
        await runMutation(
          `UPDATE bot_orders SET status = 'failed', updated_at = NOW() WHERE customer_email = $1 AND status = 'pending' AND created_at < NOW() - INTERVAL '30 minutes'`,
          [req.customer.email]
        );
      } catch (e) { console.warn("auto-fail bot_orders:", e); }
      const rows = await runQuery(
        `SELECT bo.id, bo.bot_id, bo.reference, bo.status, bo.amount, bo.session_id, bo.pm2_name, bo.vps_server_id, bo.deployed_at, bo.expires_at, bo.created_at, b.name as bot_name, b.image_url as bot_image, b.features as bot_features FROM bot_orders bo LEFT JOIN bots b ON bo.bot_id = b.id WHERE bo.customer_email = $1 ORDER BY bo.created_at DESC`,
        [req.customer.email]
      );
      const allVps = vpsManager.getAll();
      const bots = rows.map((r: any) => {
        const vps = allVps.find((s: any) => s.id === r.vps_server_id);
        return { ...r, vps_label: vps?.label ?? null };
      });
      res.json({ success: true, bots });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Get my API keys ────────────────────────────────────────────
  app.get("/api/customer/api-keys", customerAuthMiddleware, async (req: any, res) => {
    try {
      const keys = await storage.getApiKeysByCustomer(req.customer.id);
      res.json({ success: true, keys });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Generate API key ───────────────────────────────────────────
  app.post("/api/customer/api-keys", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { label } = req.body;
      if (!label) return res.status(400).json({ success: false, error: "Label is required" });
      const existing = await storage.getApiKeysByCustomer(req.customer.id);
      if (existing.length >= 5) return res.status(400).json({ success: false, error: "Maximum 5 API keys allowed" });
      const key = `ct_${uuidv4().replace(/-/g, "")}`;
      const apiKey = await storage.createApiKey({ key, label, customerId: req.customer.id });
      res.json({ success: true, apiKey });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Delete API key ─────────────────────────────────────────────
  app.delete("/api/customer/api-keys/:id", customerAuthMiddleware, async (req: any, res) => {
    try {
      const keys = await storage.getApiKeysByCustomer(req.customer.id);
      const key = keys.find((k) => k.id === parseInt(req.params.id));
      if (!key) return res.status(404).json({ success: false, error: "API key not found" });
      await storage.deleteApiKey(key.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Update profile ─────────────────────────────────────────────
  app.put("/api/customer/profile", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { name, currentPassword, newPassword } = req.body;
      const customer = req.customer;
      const updates: any = {};
      if (name && name.trim()) updates.name = name.trim();
      if (newPassword) {
        if (!currentPassword) return res.status(400).json({ success: false, error: "Current password is required to set a new password" });
        const valid = await bcrypt.compare(currentPassword, customer.passwordHash);
        if (!valid) return res.status(400).json({ success: false, error: "Current password is incorrect" });
        if (newPassword.length < 6) return res.status(400).json({ success: false, error: "New password must be at least 6 characters" });
        updates.passwordHash = await bcrypt.hash(newPassword, 10);
      }
      if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, error: "No changes provided" });
      const updated = await storage.updateCustomer(customer.id, updates);
      res.json({ success: true, customer: { id: updated?.id, email: updated?.email, name: updated?.name } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Avatar upload setup ─────────────────────────────────────────────────
  const AVATARS_DIR = path.join(process.cwd(), "uploads", "avatars");
  if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

  const avatarStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATARS_DIR),
    filename: (req: any, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${req.customer?.id || "admin"}-${Date.now()}${ext}`);
    },
  });
  const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      cb(null, allowed.includes(file.mimetype));
    },
  });

  // ─── Customer: Upload avatar ──────────────────────────────────────────────
  app.post("/api/customer/avatar", customerAuthMiddleware, (req: any, res) => {
    avatarUpload.single("avatar")(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message || "Upload failed" });
      if (!req.file) return res.status(400).json({ success: false, error: "No image file provided" });
      try {
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        // Remove old avatar file if present
        const customer = req.customer;
        if (customer.avatarUrl) {
          const oldPath = path.join(process.cwd(), customer.avatarUrl.replace(/^\//, ""));
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        const updated = await storage.updateCustomer(customer.id, { avatarUrl });
        res.json({ success: true, avatarUrl, customer: { id: updated?.id, email: updated?.email, name: updated?.name, avatarUrl: updated?.avatarUrl } });
      } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
      }
    });
  });

  // ─── Customer: Remove avatar ──────────────────────────────────────────────
  app.delete("/api/customer/avatar", customerAuthMiddleware, async (req: any, res) => {
    try {
      const customer = req.customer;
      if (customer.avatarUrl) {
        const oldPath = path.join(process.cwd(), customer.avatarUrl.replace(/^\//, ""));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      const updated = await storage.updateCustomer(customer.id, { avatarUrl: null as any });
      res.json({ success: true, customer: { id: updated?.id, email: updated?.email, name: updated?.name, avatarUrl: null } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ─── Admin: Upload avatar for a customer ─────────────────────────────────
  app.post("/api/admin/customers/:id/avatar", adminAuthMiddleware, (req: any, res) => {
    avatarUpload.single("avatar")(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message || "Upload failed" });
      if (!req.file) return res.status(400).json({ success: false, error: "No image file provided" });
      try {
        const customerId = parseInt(req.params.id);
        const customer = await storage.getCustomerById(customerId);
        if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });
        if (customer.avatarUrl) {
          const oldPath = path.join(process.cwd(), customer.avatarUrl.replace(/^\//, ""));
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const updated = await storage.updateCustomer(customerId, { avatarUrl });
        res.json({ success: true, avatarUrl, customer: { id: updated?.id, email: updated?.email, avatarUrl: updated?.avatarUrl } });
      } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
      }
    });
  });

  // ─── Admin: Remove avatar for a customer ─────────────────────────────────
  app.delete("/api/admin/customers/:id/avatar", adminAuthMiddleware, async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      const customer = await storage.getCustomerById(customerId);
      if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });
      if (customer.avatarUrl) {
        const oldPath = path.join(process.cwd(), customer.avatarUrl.replace(/^\//, ""));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      await storage.updateCustomer(customerId, { avatarUrl: null as any });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ─── Customer: View order credentials ────────────────────────────────────
  app.get("/api/customer/orders/:reference/credentials", customerAuthMiddleware, async (req: any, res) => {
    try {
      const tx = await storage.getTransaction(req.params.reference);
      if (!tx) return res.status(404).json({ success: false, error: "Order not found" });
      if (tx.customerEmail !== req.customer.email) return res.status(403).json({ success: false, error: "Access denied" });
      if (tx.status !== "success") return res.status(400).json({ success: false, error: "No credentials for this order" });
      const account = accountManager.findAccountByCustomer(tx.planId, req.customer.email);
      if (!account) return res.status(404).json({ success: false, error: "Account credentials not found. Please contact support." });
      res.json({ success: true, account: {
        email: account.email || "",
        username: account.username || "",
        password: account.password || "",
        activationCode: account.activationCode || "",
        redeemLink: account.redeemLink || "",
        instructions: account.instructions || "",
      }});
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Submit rating for a completed order ────────────────────────
  app.post("/api/customer/orders/:reference/rate", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { stars, comment } = req.body;
      const s = parseInt(stars, 10);
      if (!s || s < 1 || s > 5) return res.status(400).json({ success: false, error: "Stars must be 1–5" });
      const tx = await storage.getTransaction(req.params.reference);
      if (!tx) return res.status(404).json({ success: false, error: "Order not found" });
      if (tx.customerEmail !== req.customer.email) return res.status(403).json({ success: false, error: "Access denied" });
      if (tx.status !== "success") return res.status(400).json({ success: false, error: "Only completed orders can be rated" });
      await storage.createRating({
        reference: req.params.reference,
        customerEmail: req.customer.email,
        customerName: req.customer.name || undefined,
        planId: tx.planId,
        planName: tx.planName,
        stars: s,
        comment: (comment || "").trim() || undefined,
      });
      res.json({ success: true, message: "Thank you for your rating!" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Get my rating for an order ────────────────────────────────
  app.get("/api/customer/orders/:reference/rating", customerAuthMiddleware, async (req: any, res) => {
    try {
      const rating = await storage.getRatingByReference(req.params.reference);
      if (rating && rating.customer_email !== req.customer.email && rating.customerEmail !== req.customer.email) {
        return res.json({ success: true, rating: null });
      }
      res.json({ success: true, rating: rating || null });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Setup TOTP (generate QR) ──────────────────────────────────
  app.post("/api/customer/setup-totp", customerAuthMiddleware, async (req: any, res) => {
    try {
      const secret = speakeasy.generateSecret({ name: `Chege Tech (${req.customer.email})`, length: 20 });
      const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);
      res.json({ success: true, secret: secret.base32, qrCodeDataUrl });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Verify and save TOTP ──────────────────────────────────────
  app.post("/api/customer/verify-totp", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { secret, code } = req.body;
      if (!secret || !code) return res.status(400).json({ success: false, error: "Secret and code required" });
      const valid = speakeasy.totp.verify({ secret, encoding: "base32", token: code, window: 2 });
      if (!valid) return res.status(400).json({ success: false, error: "Invalid code. Please try again." });
      await storage.updateCustomer(req.customer.id, { totpSecret: secret, totpEnabled: true });
      res.json({ success: true, message: "2FA enabled successfully" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Disable TOTP ───────────────────────────────────────────────
  app.delete("/api/customer/disable-totp", customerAuthMiddleware, async (req: any, res) => {
    try {
      await storage.updateCustomer(req.customer.id, { totpSecret: null, totpEnabled: false });
      res.json({ success: true, message: "2FA disabled" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: TOTP status ────────────────────────────────────────────────
  app.get("/api/customer/totp-status", customerAuthMiddleware, async (req: any, res) => {
    res.json({ success: true, totpEnabled: req.customer.totpEnabled ?? false });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // APP CONFIG ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Public: Get app config (non-sensitive) ───────────────────────────────
  app.get("/api/app-config", (_req, res) => {
    const config = getAppConfig();
    res.json({ success: true, config: {
      siteName: config.siteName,
      whatsappNumber: config.whatsappNumber,
      whatsappChannel: config.whatsappChannel,
      supportEmail: config.supportEmail,
      chatAssistantEnabled: config.chatAssistantEnabled,
    }});
  });

  // ─── Admin: Get full app config ───────────────────────────────────────────
  app.get("/api/admin/app-config", adminAuthMiddleware, (_req, res) => {
    res.json({ success: true, config: getAppConfig() });
  });

  // ─── Admin: Save app config ───────────────────────────────────────────────
  app.put("/api/admin/app-config", adminAuthMiddleware, (req, res) => {
    try {
      const updated = saveAppConfig(req.body);
      res.json({ success: true, config: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN CUSTOMER MANAGEMENT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Admin: Get all customers ─────────────────────────────────────────────
  app.post("/api/admin/customers/bulk", adminAuthMiddleware, requirePermission("customers"), async (req, res) => {
    try {
      const { action, ids, emailSubject, emailBody } = req.body;
      if (!Array.isArray(ids) || ids.length === 0)
        return res.status(400).json({ success: false, error: "No customers selected" });
      let affected = 0;
      if (action === "suspend") {
        for (const id of ids) {
          const c = await storage.getCustomerById(id);
          if (c && !c.suspended) { await storage.updateCustomer(id, { suspended: true }); affected++; }
        }
      } else if (action === "unsuspend") {
        for (const id of ids) {
          const c = await storage.getCustomerById(id);
          if (c && c.suspended) { await storage.updateCustomer(id, { suspended: false }); affected++; }
        }
      } else if (action === "delete") {
        for (const id of ids) { await storage.deleteCustomer(id); affected++; }
      } else if (action === "email" && emailSubject && emailBody) {
        const custs = await Promise.all(ids.map((id: number) => storage.getCustomerById(id)));
        const emails = custs.filter(Boolean).map((c: any) => c.email);
        await sendBulkEmail(emails, emailSubject, emailBody);
        affected = emails.length;
      } else {
        return res.status(400).json({ success: false, error: "Invalid action" });
      }
      res.json({ success: true, affected });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/admin/customers", adminAuthMiddleware, requirePermission("customers"), async (_req, res) => {
    try {
      const all = await storage.getAllCustomers();
      const safeList = all.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        emailVerified: c.emailVerified,
        suspended: c.suspended,
        totpEnabled: c.totpEnabled,
        avatarUrl: c.avatarUrl || null,
        createdAt: c.createdAt,
      }));
      res.json({ success: true, customers: safeList });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Suspend / unsuspend customer ──────────────────────────────────
  app.patch("/api/admin/customers/:id/suspend", adminAuthMiddleware, requirePermission("customers"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const newSuspended = req.body.suspended === true;
      const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : undefined;
      const customer = await storage.getCustomerById(id);
      if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });
      if (customer.suspended === newSuspended) return res.json({ success: true, unchanged: true });
      await storage.updateCustomer(id, { suspended: newSuspended });
      if (newSuspended) {
        sendSuspensionEmail(customer.email, customer.name || undefined, reason).catch(() => {});
      } else {
        sendUnsuspensionEmail(customer.email, customer.name || undefined).catch(() => {});
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Manually verify customer email ──────────────────────────────
  app.patch("/api/admin/customers/:id/verify", adminAuthMiddleware, requirePermission("customers"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomerById(id);
      if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });
      await storage.updateCustomer(id, {
        emailVerified: true,
        verificationCode: null,
        verificationExpires: null,
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Send bulk email ──────────────────────────────────────────────
  app.post("/api/admin/email-blast", adminAuthMiddleware, requirePermission("customers"), async (req, res) => {
    try {
      const { subject, content, recipients, filter } = req.body;
      if (!subject || !content) return res.status(400).json({ success: false, error: "Subject and content are required" });

      let emailList: string[] = [];

      if (recipients && Array.isArray(recipients) && recipients.length > 0) {
        emailList = recipients;
      } else {
        const allCustomers = await storage.getAllCustomers();
        if (filter === "verified") {
          emailList = allCustomers.filter((c: any) => c.emailVerified && !c.suspended).map((c: any) => c.email);
        } else if (filter === "suspended") {
          emailList = allCustomers.filter((c: any) => c.suspended).map((c: any) => c.email);
        } else {
          emailList = allCustomers.filter((c: any) => c.emailVerified).map((c: any) => c.email);
        }
      }

      if (emailList.length === 0) return res.status(400).json({ success: false, error: "No recipients found" });
      if (emailList.length > 500) return res.status(400).json({ success: false, error: "Maximum 500 recipients per blast" });

      const uniqueEmails = Array.from(new Set(emailList.map((e: string) => e.toLowerCase().trim()))).filter(Boolean);

      const htmlContent = content
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

      const result = await sendBulkEmail(uniqueEmails, subject, htmlContent);
      logAdminAction({ action: "Bulk email sent", category: "settings", details: `Subject: "${subject}" — Sent: ${result.sent}, Failed: ${result.failed}`, status: result.failed > 0 ? "warning" : "success" });
      const success = result.sent > 0;
      res.json({ success, sent: result.sent, failed: result.failed, total: uniqueEmails.length, errors: result.errors.slice(0, 5) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Delete customer ───────────────────────────────────────────────
  app.delete("/api/admin/customers/:id", adminAuthMiddleware, requirePermission("customers"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateCustomer(id, { suspended: true });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/admin/customers/:id/login-history", adminAuthMiddleware, requirePermission("customers"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const logs = await storage.getLoginLogs(id);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Manual wallet top-up ─────────────────────────────────────────
  app.post("/api/admin/customers/:id/wallet/topup", adminAuthMiddleware, requirePermission("customers"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { amount, note } = req.body;
      const amountNum = parseFloat(amount);
      if (!id || isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ success: false, error: "Valid customer ID and positive amount required." });
      }
      const customer = await storage.getCustomerById(id);
      if (!customer) return res.status(404).json({ success: false, error: "Customer not found." });
      const description = note?.trim() ? `Admin top-up: ${note.trim()}` : "Admin manual wallet top-up";
      await storage.creditWallet(id, amountNum, description);
      const wallet = await storage.getWallet(id);
      res.json({ success: true, newBalance: wallet?.balance ?? 0 });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Deduct wallet balance ─────────────────────────────────────────
  app.post("/api/admin/customers/:id/wallet/deduct", adminAuthMiddleware, requirePermission("customers"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { amount, note } = req.body;
      const amountNum = parseFloat(amount);
      if (!id || isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ success: false, error: "Valid amount required." });
      }
      const customer = await storage.getCustomerById(id);
      if (!customer) return res.status(404).json({ success: false, error: "Customer not found." });
      const wallet = await storage.getWallet(id);
      if ((wallet?.balance ?? 0) < amountNum) {
        return res.status(400).json({ success: false, error: `Insufficient balance. Customer has KES ${wallet?.balance ?? 0}.` });
      }
      const description = note?.trim() ? `Admin deduction: ${note.trim()}` : "Admin wallet deduction";
      const ok = await storage.debitWallet(id, amountNum, description, `admin-deduct-${id}-${Date.now()}`);
      if (!ok) return res.status(400).json({ success: false, error: "Deduction failed — insufficient balance." });
      const updated = await storage.getWallet(id);
      res.json({ success: true, newBalance: updated?.balance ?? 0 });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Get customer wallet history ───────────────────────────────────
  app.get("/api/admin/customers/:id/wallet/history", adminAuthMiddleware, requirePermission("customers"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const wallet = await storage.getWallet(id);
      const transactions = await storage.getWalletTransactions(id);
      res.json({ success: true, balance: wallet?.balance ?? 0, transactions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Send wallet balance to another customer (P2P) ──────────────
  app.post("/api/customer/wallet/send", customerAuthMiddleware, async (req: any, res) => {
    try {
      const senderId = req.customer.id;
      const senderEmail = req.customer.email;
      const { recipientEmail, recipientId, amount, note } = req.body;

      // Accept either recipientEmail or recipientId
      const recipientKey = recipientEmail?.trim() || recipientId?.toString().trim();
      if (!recipientKey || !amount) {
        return res.status(400).json({ success: false, error: "Recipient (email or customer ID) and amount are required." });
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum < 10) {
        return res.status(400).json({ success: false, error: "Minimum transfer amount is KES 10." });
      }

      // Resolve recipient — match by email OR numeric ID
      let recipient: any = null;
      const lookupById = !recipientEmail?.trim() && recipientId;
      const numericId = parseInt(recipientKey, 10);
      const isId = !isNaN(numericId) && numericId > 0 && !recipientKey.includes("@");

      if (dbType === "sqlite") {
        if (isId) {
          recipient = getDb().prepare("SELECT id, email, name FROM customers WHERE id=? AND suspended=0").get(numericId) as any;
        } else {
          recipient = getDb().prepare("SELECT id, email, name FROM customers WHERE email=? AND suspended=0").get(recipientKey.toLowerCase()) as any;
        }
      } else {
        const customers = await storage.getAllCustomers();
        if (isId) {
          recipient = customers.find((c: any) => c.id === numericId && !c.suspended);
        } else {
          recipient = customers.find((c: any) => c.email.toLowerCase() === recipientKey.toLowerCase() && !c.suspended);
        }
      }

      if (!recipient) {
        return res.status(404).json({ success: false, error: "Recipient not found or account is suspended." });
      }

      // Self-send check (after resolving)
      if (recipient.id === senderId) {
        return res.status(400).json({ success: false, error: "You cannot send money to yourself." });
      }

      // Check sender balance
      const senderWallet = await storage.getWallet(senderId);
      if ((senderWallet?.balance ?? 0) < amountNum) {
        return res.status(400).json({ success: false, error: `Insufficient balance. Your wallet has KES ${senderWallet?.balance ?? 0}.` });
      }

      const ref = `TRANSFER-${senderId}-${recipient.id}-${Date.now()}`;
      const msgLabel = note?.trim() ? ` · "${note.trim()}"` : "";
      const senderName = req.customer.name || senderEmail;
      const recipientName = recipient.name || recipient.email;
      const recipientLabel = recipient.email;

      // Debit sender
      const ok = await storage.debitWallet(senderId, amountNum, `Sent to ${recipientLabel} (ID #${recipient.id})${msgLabel}`, ref);
      if (!ok) return res.status(400).json({ success: false, error: "Transfer failed — insufficient balance." });

      // Credit recipient
      await storage.creditWallet(recipient.id, amountNum, `Received from ${senderEmail} (ID #${senderId})${msgLabel}`, ref);

      // Notifications
      await storage.createNotification(senderId, "wallet", "Transfer Sent 💸", `KES ${amountNum.toLocaleString()} sent to ${recipientLabel} (ID #${recipient.id}).`);
      await storage.createNotification(recipient.id, "wallet", "Wallet Transfer Received 💰", `${senderName} sent you KES ${amountNum.toLocaleString()}${msgLabel}.`);

      const updatedSenderWallet = await storage.getWallet(senderId);
      const updatedRecipientWallet = await storage.getWallet(recipient.id);
      const senderNewBalance = updatedSenderWallet?.balance ?? 0;
      const recipientNewBalance = updatedRecipientWallet?.balance ?? 0;

      // Email notifications (fire-and-forget — don't block the response)
      Promise.allSettled([
        sendWalletTransferEmail({
          toEmail: senderEmail,
          toName: senderName,
          type: "sent",
          amount: amountNum,
          counterpartyName: recipientName,
          counterpartyEmail: recipient.email,
          counterpartyId: recipient.id,
          note: note?.trim() || undefined,
          newBalance: senderNewBalance,
        }),
        sendWalletTransferEmail({
          toEmail: recipient.email,
          toName: recipientName,
          type: "received",
          amount: amountNum,
          counterpartyName: senderName,
          counterpartyEmail: senderEmail,
          counterpartyId: senderId,
          note: note?.trim() || undefined,
          newBalance: recipientNewBalance,
        }),
      ]).then(results => {
        results.forEach((r, i) => {
          if (r.status === "rejected") console.warn(`[email][wallet-transfer] email ${i} failed:`, r.reason);
        });
      });

      res.json({ success: true, newBalance: senderNewBalance, recipientName, recipientId: recipient.id, recipientEmail: recipient.email });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDENTIALS OVERRIDE ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Admin: Get credentials (masked) ─────────────────────────────────────
  app.get("/api/admin/credentials", adminAuthMiddleware, superAdminOnly, (_req, res) => {
    const override = getCredentialsOverride();
    const status = getSecretsStatus();
    res.json({
      success: true,
      credentials: {
        paystackPublicKey: override.paystackPublicKey || "",
        paystackSecretKey: override.paystackSecretKey ? "••••••••••••••••" : "",
        paystackSecretKeySet: !!override.paystackSecretKey,
        resendApiKey: override.resendApiKey ? "••••••••••••••••" : "",
        resendApiKeySet: !!override.resendApiKey,
        resendFrom: override.resendFrom || "",
        emailUser: override.emailUser || "",
        emailPass: override.emailPass ? "••••••••••••••••" : "",
        emailPassSet: !!override.emailPass,
        adminEmail: override.adminEmail || "",
        adminPassword: override.adminPassword ? "••••••••••••••••" : "",
        adminPasswordSet: !!override.adminPassword,
        telegramBotToken: override.telegramBotToken ? "••••••••••••••••" : "",
        telegramBotTokenSet: !!override.telegramBotToken,
        telegramChatId: override.telegramChatId || "",
        whatsappAccessToken: override.whatsappAccessToken ? "••••••••••••••••" : "",
        whatsappAccessTokenSet: !!override.whatsappAccessToken,
        whatsappPhoneId: override.whatsappPhoneId || "",
        whatsappVerifyToken: override.whatsappVerifyToken || "",
        whatsappAdminPhone: override.whatsappAdminPhone || "",
        openaiApiKey: override.openaiApiKey ? "••••••••••••••••" : "",
        openaiApiKeySet: !!override.openaiApiKey,
        externalDatabaseUrl: override.externalDatabaseUrl ? "••••••••••••••••" : "",
        externalDatabaseUrlSet: !!override.externalDatabaseUrl,
        cloudflareApiToken: override.cloudflareApiToken ? "••••••••••••••••" : "",
        cloudflareApiTokenSet: !!override.cloudflareApiToken,
      },
      effective: {
        paystackPublicKey: status.paystackPublicKey,
        paystackConfigured: status.paystackConfigured,
        emailUser: status.emailUser,
        emailConfigured: status.emailConfigured,
        telegramConfigured: isTelegramConfigured(),
        whatsappConfigured: isWhatsAppWebConnected(),
        openaiApiKeySet: !!(override.openaiApiKey || process.env.OPENAI_API_KEY),
      },
      sourceOverride: {
        telegramBotToken: !!override.telegramBotToken,
        telegramChatId: !!override.telegramChatId,
        whatsappAccessToken: !!override.whatsappAccessToken,
        whatsappPhoneId: !!override.whatsappPhoneId,
        openaiApiKey: !!override.openaiApiKey,
        externalDatabaseUrl: !!override.externalDatabaseUrl,
        cloudflareApiToken: !!override.cloudflareApiToken,
      },
      envVarSet: {
        paystackPublicKey: !!process.env.PAYSTACK_PUBLIC_KEY,
        paystackSecretKey: !!process.env.PAYSTACK_SECRET_KEY,
        emailUser: !!process.env.EMAIL_USER,
        emailPass: !!process.env.EMAIL_PASS,
        adminEmail: !!process.env.ADMIN_EMAIL,
        adminPassword: !!process.env.ADMIN_PASSWORD,
        telegramBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
        telegramChatId: !!process.env.TELEGRAM_CHAT_ID,
        whatsappAccessToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
        whatsappPhoneId: !!process.env.WHATSAPP_PHONE_ID,
        openaiApiKey: !!process.env.OPENAI_API_KEY,
        externalDatabaseUrl: !!process.env.EXTERNAL_DATABASE_URL,
      },
    });
  });

  // ─── Admin: Save credentials ──────────────────────────────────────────────
  app.put("/api/admin/credentials", adminAuthMiddleware, superAdminOnly, (req, res) => {
    try {
      const { paystackPublicKey, paystackSecretKey, resendApiKey, resendFrom, emailUser, emailPass, adminEmail, adminPassword, telegramBotToken, telegramChatId,
        whatsappAccessToken, whatsappPhoneId, whatsappVerifyToken, whatsappAdminPhone, openaiApiKey, externalDatabaseUrl, cloudflareApiToken } = req.body;
      const toSave: Record<string, string | undefined> = {};
      if (paystackPublicKey !== undefined) toSave.paystackPublicKey = paystackPublicKey || undefined;
      if (paystackSecretKey !== undefined && paystackSecretKey !== "••••••••••••••••") toSave.paystackSecretKey = paystackSecretKey || undefined;
      if (resendApiKey !== undefined && resendApiKey !== "••••••••••••••••") toSave.resendApiKey = resendApiKey || undefined;
      if (resendFrom !== undefined) toSave.resendFrom = resendFrom || undefined;
      if (emailUser !== undefined) toSave.emailUser = emailUser || undefined;
      if (emailPass !== undefined && emailPass !== "••••••••••••••••") toSave.emailPass = emailPass || undefined;
      if (adminEmail !== undefined) toSave.adminEmail = adminEmail || undefined;
      if (adminPassword !== undefined && adminPassword !== "••••••••••••••••") toSave.adminPassword = adminPassword || undefined;
      if (telegramBotToken !== undefined && telegramBotToken !== "••••••••••••••••") toSave.telegramBotToken = telegramBotToken || undefined;
      if (telegramChatId !== undefined) toSave.telegramChatId = telegramChatId || undefined;
      if (whatsappAccessToken !== undefined && whatsappAccessToken !== "••••••••••••••••") toSave.whatsappAccessToken = whatsappAccessToken || undefined;
      if (whatsappPhoneId !== undefined) toSave.whatsappPhoneId = whatsappPhoneId || undefined;
      if (whatsappVerifyToken !== undefined) toSave.whatsappVerifyToken = whatsappVerifyToken || undefined;
      if (whatsappAdminPhone !== undefined) toSave.whatsappAdminPhone = whatsappAdminPhone || undefined;
      if (openaiApiKey !== undefined && openaiApiKey !== "••••••••••••••••") toSave.openaiApiKey = openaiApiKey || undefined;
      if (externalDatabaseUrl !== undefined && externalDatabaseUrl !== "••••••••••••••••") toSave.externalDatabaseUrl = externalDatabaseUrl || undefined;
      if (cloudflareApiToken !== undefined && cloudflareApiToken !== "••••••••••••••••") toSave.cloudflareApiToken = cloudflareApiToken || undefined;

      saveCredentialsOverride(toSave);
      logAdminAction({ action: "Credentials updated", category: "settings", details: `Updated: ${Object.keys(toSave).join(", ")}`, status: "success" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: WhatsApp Web Status ───────────────────────────────────────────
  app.get("/api/admin/whatsapp/status", adminAuthMiddleware, (_req, res) => {
    res.json({ success: true, ...getWhatsAppStatus() });
  });

  // ─── Admin: WhatsApp Web Connect ──────────────────────────────────────────
  app.post("/api/admin/whatsapp/connect", adminAuthMiddleware, async (req, res) => {
    const { phoneNumber } = req.body;
    try {
      await connectWhatsApp(phoneNumber);
      logAdminAction({ action: "WhatsApp connection initiated", category: "settings", details: `Phone: ${phoneNumber}`, status: "success" });
      res.json({ success: true, message: "Connecting... scan the QR code or use the pairing code." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: WhatsApp Web Disconnect ──────────────────────────────────────
  app.post("/api/admin/whatsapp/disconnect", adminAuthMiddleware, async (_req, res) => {
    try {
      await disconnectWhatsApp();
      logAdminAction({ action: "WhatsApp disconnected", category: "settings", details: "Admin triggered disconnect", status: "warning" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: WhatsApp Web Send Test ───────────────────────────────────────
  app.post("/api/admin/whatsapp/test", adminAuthMiddleware, async (_req, res) => {
    if (!isWhatsAppWebConnected()) {
      return res.status(400).json({ success: false, error: "WhatsApp not connected — scan QR code first" });
    }
    const override = getCredentialsOverride();
    const adminPhone = override.whatsappAdminPhone || "";
    if (!adminPhone) {
      return res.status(400).json({ success: false, error: "Set your admin WhatsApp number first" });
    }
    try {
      await sendWhatsAppNotification(adminPhone, "✅ *Chege Tech WhatsApp Bot is active!*\n\nYou will receive order notifications here.");
      logAdminAction({ action: "WhatsApp test message sent", category: "settings", details: `Sent to: ${adminPhone}`, status: "success" });
      res.json({ success: true, message: "Test message sent! Check your WhatsApp." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Test Telegram ─────────────────────────────────────────────────
  app.post("/api/admin/telegram/test", adminAuthMiddleware, async (_req, res) => {
    if (!isTelegramConfigured()) {
      return res.status(400).json({ success: false, error: "Telegram not configured — add Bot Token and Chat ID first" });
    }
    const result = await sendTelegramMessage(`✅ <b>Chege Tech Telegram Connected!</b>\n\nAdmin notifications are now active. You'll receive alerts for new orders, registrations, and low stock.`);
    if (result.success) {
      logAdminAction({ action: "Telegram test message sent", category: "settings", details: "Admin triggered test notification", status: "success" });
      res.json({ success: true, message: "Test message sent! Check your Telegram." });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUB-ADMIN MANAGEMENT (super admin only)
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/subadmins", adminAuthMiddleware, superAdminOnly, async (_req, res) => {
    try {
      const subAdmins = await storage.getAllSubAdmins();
      res.json({ success: true, subAdmins: subAdmins.map(sa => ({ ...sa, passwordHash: undefined })) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/subadmins", adminAuthMiddleware, superAdminOnly, async (req, res) => {
    try {
      const { email, name, password, permissions } = req.body;
      if (!email || !password) return res.status(400).json({ success: false, error: "Email and password are required" });
      if (password.length < 6) return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });

      const existing = await storage.getSubAdminByEmail(email);
      if (existing) return res.status(409).json({ success: false, error: "A sub-admin with this email already exists" });

      const creds = getAdminCredentials();
      if (email === creds.email) return res.status(400).json({ success: false, error: "Cannot create sub-admin with the super admin email" });

      const passwordHash = await bcrypt.hash(password, 10);
      const subAdmin = await storage.createSubAdmin({ email, name, passwordHash, permissions: permissions || [] });
      logAdminAction({ action: `Sub-admin created: ${email}`, category: "settings", details: `Name: ${name || "—"}, permissions: ${(permissions || []).join(", ") || "none"}`, status: "success" });
      res.json({ success: true, subAdmin: { ...subAdmin, passwordHash: undefined } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put("/api/admin/subadmins/:id", adminAuthMiddleware, superAdminOnly, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, password, permissions, active } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (password && password.length >= 6) updateData.passwordHash = await bcrypt.hash(password, 10);
      if (permissions !== undefined) updateData.permissions = permissions;
      if (active !== undefined) updateData.active = active;

      const updated = await storage.updateSubAdmin(id, updateData);
      if (!updated) return res.status(404).json({ success: false, error: "Sub-admin not found" });
      logAdminAction({ action: `Sub-admin updated: ${updated.email}`, category: "settings", details: `ID: ${id}`, status: "success" });
      res.json({ success: true, subAdmin: { ...updated, passwordHash: undefined } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/admin/subadmins/:id", adminAuthMiddleware, superAdminOnly, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subAdmin = await storage.getSubAdminById(id);
      if (!subAdmin) return res.status(404).json({ success: false, error: "Sub-admin not found" });
      await storage.deleteSubAdmin(id);
      logAdminAction({ action: `Sub-admin deleted: ${subAdmin.email}`, category: "settings", details: `ID: ${id}`, status: "warning" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Secondary Super Admins CRUD (primary super admin only) ──────────────
  app.get("/api/admin/super-admins", adminAuthMiddleware, primarySuperAdminOnly, (_req, res) => {
    const list = getSecondarySuperAdmins().map(({ passwordHash: _ph, ...rest }: any) => rest);
    res.json({ success: true, superAdmins: list });
  });

  app.post("/api/admin/super-admins", adminAuthMiddleware, primarySuperAdminOnly, async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!email || !password) return res.status(400).json({ success: false, error: "Email and password are required" });
      if (password.length < 8) return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
      const list = getSecondarySuperAdmins();
      if (list.find((sa: any) => sa.email === email)) {
        return res.status(400).json({ success: false, error: "A super admin with this email already exists" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const newAdmin = { id: Date.now(), name: name || email.split("@")[0], email, passwordHash, active: true, createdAt: new Date().toISOString() };
      list.push(newAdmin);
      saveSecondarySuperAdmins(list);
      logAdminAction({ action: `Secondary super admin added: ${email}`, category: "settings", details: `Name: ${newAdmin.name}`, status: "success" });
      const { passwordHash: _ph, ...safe } = newAdmin;
      res.json({ success: true, superAdmin: safe });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch("/api/admin/super-admins/:id/toggle", adminAuthMiddleware, primarySuperAdminOnly, (req, res) => {
    const id = parseInt(req.params.id);
    const list = getSecondarySuperAdmins();
    const idx = list.findIndex((sa: any) => sa.id === id);
    if (idx === -1) return res.status(404).json({ success: false, error: "Super admin not found" });
    list[idx].active = !list[idx].active;
    saveSecondarySuperAdmins(list);
    logAdminAction({ action: `Secondary super admin ${list[idx].active ? "activated" : "deactivated"}: ${list[idx].email}`, category: "settings", details: `ID: ${id}`, status: "warning" });
    res.json({ success: true, active: list[idx].active });
  });

  app.put("/api/admin/super-admins/:id/password", adminAuthMiddleware, primarySuperAdminOnly, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { password } = req.body;
      if (!password || password.length < 8) return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
      const list = getSecondarySuperAdmins();
      const idx = list.findIndex((sa: any) => sa.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Super admin not found" });
      list[idx].passwordHash = await bcrypt.hash(password, 10);
      saveSecondarySuperAdmins(list);
      logAdminAction({ action: `Secondary super admin password reset: ${list[idx].email}`, category: "settings", details: `ID: ${id}`, status: "warning" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/admin/super-admins/:id", adminAuthMiddleware, primarySuperAdminOnly, (req, res) => {
    const id = parseInt(req.params.id);
    const list = getSecondarySuperAdmins();
    const target = list.find((sa: any) => sa.id === id);
    if (!target) return res.status(404).json({ success: false, error: "Super admin not found" });
    saveSecondarySuperAdmins(list.filter((sa: any) => sa.id !== id));
    logAdminAction({ action: `Secondary super admin removed: ${target.email}`, category: "settings", details: `ID: ${id}`, status: "error" });
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN LOGS ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Admin: Get logs ──────────────────────────────────────────────────────
  app.get("/api/admin/logs", adminAuthMiddleware, requirePermission("logs"), (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const category = req.query.category as string | undefined;
    const logs = getAdminLogs(limit, category);
    res.json({ success: true, logs });
  });

  // ─── Admin: Clear logs ────────────────────────────────────────────────────
  app.delete("/api/admin/logs", adminAuthMiddleware, requirePermission("logs"), (req, res) => {
    try {
      const fs = require("fs");
      const path = require("path");
      const LOG_FILE = path.join(process.cwd(), "admin-logs.json");
      fs.writeFileSync(LOG_FILE, "[]");
      logAdminAction({ action: "Admin logs cleared", category: "settings", details: "All logs deleted", status: "warning" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPORT TICKET ROUTES (Customer-facing)
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/support/ticket", async (req, res) => {
    try {
      const { customerEmail, customerName, subject } = req.body;
      if (!customerEmail) return res.status(400).json({ success: false, error: "Customer email is required" });
      const ticket = await storage.createTicket({ customerEmail, customerName, subject });
      res.json({ success: true, ticket });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/support/ticket/:id/message", async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const { message, token, sender: senderHint } = req.body;
      if (!message) return res.status(400).json({ success: false, error: "Message is required" });
      if (!token) return res.status(401).json({ success: false, error: "Ticket token is required" });
      const ticket = await storage.getTicketById(ticketId);
      if (!ticket || ticket.token !== token) return res.status(403).json({ success: false, error: "Invalid ticket token" });
      const sender = senderHint === "ai" ? "ai" : "customer";
      const msg = await storage.addMessage({ ticketId, sender, message });
      res.json({ success: true, message: msg });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/support/ticket/:id/messages", async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const token = req.query.token as string;
      if (!token) return res.status(401).json({ success: false, error: "Ticket token is required" });
      const ticket = await storage.getTicketById(ticketId);
      if (!ticket || ticket.token !== token) return res.status(403).json({ success: false, error: "Invalid ticket token" });
      const messages = await storage.getMessages(ticketId);
      res.json({ success: true, messages });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/support/ticket/:id/escalate", async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const { token } = req.body;
      if (!token) return res.status(401).json({ success: false, error: "Ticket token is required" });
      const ticket = await storage.getTicketById(ticketId);
      if (!ticket || ticket.token !== token) return res.status(403).json({ success: false, error: "Invalid ticket token" });
      await storage.updateTicket(ticketId, { status: "escalated" });
      const messages = await storage.getMessages(ticketId);
      notifySupportEscalation({
        ticketId,
        customerName: ticket.customerName || "Unknown",
        customerEmail: ticket.customerEmail,
        subject: ticket.subject || "Support Request",
        recentMessages: messages.map((m) => ({ sender: m.sender, message: m.message })),
      }).catch(() => {});
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN SUPPORT TICKET ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/support/tickets", adminAuthMiddleware, requirePermission("support"), async (_req, res) => {
    try {
      const tickets = await storage.getOpenTickets();
      res.json({ success: true, tickets });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/admin/support/ticket/:id/messages", adminAuthMiddleware, requirePermission("support"), async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getTicketById(ticketId);
      if (!ticket) return res.status(404).json({ success: false, error: "Ticket not found" });
      const messages = await storage.getMessages(ticketId);
      res.json({ success: true, messages });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/support/ticket/:id/message", adminAuthMiddleware, requirePermission("support"), async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const { message } = req.body;
      if (!message) return res.status(400).json({ success: false, error: "Message is required" });
      const ticket = await storage.getTicketById(ticketId);
      if (!ticket) return res.status(404).json({ success: false, error: "Ticket not found" });
      const msg = await storage.addMessage({ ticketId, sender: "admin", message });
      // Notify customer of admin reply
      try {
        const customer = await storage.getCustomerByEmail(ticket.customerEmail);
        if (customer) {
          await storage.createNotification(customer.id, "ticket", "Support Reply 💬", `Your ticket #${ticketId} received a reply from our team.`);
        }
      } catch (_) {}
      res.json({ success: true, message: msg });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch("/api/admin/support/ticket/:id/close", adminAuthMiddleware, requirePermission("support"), async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getTicketById(ticketId);
      if (!ticket) return res.status(404).json({ success: false, error: "Ticket not found" });
      await storage.updateTicket(ticketId, { status: "closed" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // API KEY AUTHENTICATED ENDPOINTS (v1)
  // ═══════════════════════════════════════════════════════════════════════════

  async function apiKeyAuthMiddleware(req: any, res: any, next: any) {
    const key = req.headers["x-api-key"];
    if (!key) return res.status(401).json({ error: "Missing X-API-Key header" });
    const apiKey = await storage.getApiKeyByKey(key);
    if (!apiKey) return res.status(401).json({ error: "Invalid API key" });
    if (!apiKey.active) return res.status(403).json({ error: "API key has been revoked" });
    req.apiKey = apiKey;
    if (apiKey.customerId) {
      const customer = await storage.getCustomerById(apiKey.customerId);
      if (!customer) return res.status(403).json({ error: "Linked customer account not found" });
      if (customer.suspended) return res.status(403).json({ error: "Account suspended. Contact support." });
      req.customer = customer;
    }
    next();
  }

  // ─── Customer API: My Profile ──────────────────────────────────────────
  app.get("/api/v1/my-profile", apiKeyAuthMiddleware, async (req: any, res) => {
    if (!req.customer) return res.status(403).json({ error: "This API key is not linked to a customer" });
    const c = req.customer;
    res.json({ id: c.id, email: c.email, name: c.name, emailVerified: c.emailVerified, createdAt: c.createdAt });
  });

  // ─── Customer API: My Orders ──────────────────────────────────────────
  app.get("/api/v1/my-orders", apiKeyAuthMiddleware, async (req: any, res) => {
    if (!req.customer) return res.status(403).json({ error: "This API key is not linked to a customer" });
    const orders = await storage.getTransactionsByEmail(req.customer.email);
    res.json({
      count: orders.length,
      orders: orders.map((o: any) => ({
        reference: o.reference, plan: o.planName, amount: o.amount, status: o.status,
        accountAssigned: o.accountAssigned, emailSent: o.emailSent, createdAt: o.createdAt,
      })),
    });
  });

  // ─── Admin API: Transactions ──────────────────────────────────────────
  app.get("/api/v1/admin/transactions", apiKeyAuthMiddleware, async (req: any, res) => {
    if (req.apiKey.customerId) return res.status(403).json({ error: "Admin API key required (no customer linked)" });
    const all = await storage.getAllTransactions();
    res.json({
      count: all.length,
      transactions: all.map((t: any) => ({
        reference: t.reference, customerEmail: t.customerEmail, plan: t.planName,
        amount: t.amount, status: t.status, accountAssigned: t.accountAssigned,
        emailSent: t.emailSent, createdAt: t.createdAt,
      })),
    });
  });

  // ─── Admin API: Stats ─────────────────────────────────────────────────
  app.get("/api/v1/admin/stats", apiKeyAuthMiddleware, async (req: any, res) => {
    if (req.apiKey.customerId) return res.status(403).json({ error: "Admin API key required (no customer linked)" });
    const stats = await storage.getStats();
    res.json(stats);
  });

  // ─── Admin API: Customers ─────────────────────────────────────────────
  app.get("/api/v1/admin/customers", apiKeyAuthMiddleware, async (req: any, res) => {
    if (req.apiKey.customerId) return res.status(403).json({ error: "Admin API key required (no customer linked)" });
    const customers = await storage.getAllCustomers();
    res.json({
      count: customers.length,
      customers: customers.map((c: any) => ({
        id: c.id, email: c.email, name: c.name, emailVerified: c.emailVerified, createdAt: c.createdAt,
      })),
    });
  });

  // ─── v1: Public store info ────────────────────────────────────────────────
  app.get("/api/v1/store", (_req, res) => {
    const config = getAppConfig();
    const categories = buildPlansResponse();
    const planCount = Object.values(categories).reduce((n: number, cat: any) => n + Object.keys(cat.plans).length, 0);
    res.json({
      name: config.siteName,
      supportEmail: config.supportEmail || null,
      whatsappNumber: config.whatsappNumber || null,
      planCount,
    });
  });

  // ─── v1: Customer: My wallet ──────────────────────────────────────────────
  app.get("/api/v1/my-wallet", apiKeyAuthMiddleware, async (req: any, res) => {
    if (!req.apiKey.customerId) return res.status(403).json({ error: "Customer API key required" });
    const wallet = await storage.getWallet(req.apiKey.customerId);
    const txns = await storage.getWalletTransactions(req.apiKey.customerId);
    res.json({ balance: wallet.balance, transactions: txns.slice(0, 20) });
  });

  // ─── v1: Customer: My subscriptions (successful orders) ──────────────────
  app.get("/api/v1/my-subscriptions", apiKeyAuthMiddleware, async (req: any, res) => {
    if (!req.apiKey.customerId) return res.status(403).json({ error: "Customer API key required" });
    const customer = await storage.getCustomerById(req.apiKey.customerId);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const txns = await storage.getTransactionsByEmail(customer.email);
    const active = txns
      .filter((t: any) => t.status === "success")
      .map((t: any) => ({
        reference: t.reference, planId: t.planId, planName: t.planName,
        amount: t.amount, purchasedAt: t.createdAt, expiresAt: t.expiresAt || null,
      }));
    res.json({ count: active.length, subscriptions: active });
  });

  // ─── v1: Customer: My notifications ──────────────────────────────────────
  app.get("/api/v1/my-notifications", apiKeyAuthMiddleware, async (req: any, res) => {
    if (!req.apiKey.customerId) return res.status(403).json({ error: "Customer API key required" });
    const notifs = await storage.getNotifications(req.apiKey.customerId);
    res.json({ count: notifs.length, notifications: notifs.slice(0, 30) });
  });

  // ─── v1: Customer: My stats ───────────────────────────────────────────────
  app.get("/api/v1/my-stats", apiKeyAuthMiddleware, async (req: any, res) => {
    if (!req.apiKey.customerId) return res.status(403).json({ error: "Customer API key required" });
    const customer = await storage.getCustomerById(req.apiKey.customerId);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const stats = await storage.getCustomerSpendingStats(customer.email);
    const wallet = await storage.getWallet(req.apiKey.customerId);
    res.json({ walletBalance: wallet.balance, ...stats });
  });

  // ─── v1: Customer: My referral ────────────────────────────────────────────
  app.get("/api/v1/my-referral", apiKeyAuthMiddleware, async (req: any, res) => {
    if (!req.apiKey.customerId) return res.status(403).json({ error: "Customer API key required" });
    const customer = await storage.getCustomerById(req.apiKey.customerId);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const stats = await storage.getReferralStats(req.apiKey.customerId);
    const config = getAppConfig();
    const origin = (config as any).customDomain
      ? `https://${(config as any).customDomain}`
      : "";
    res.json({
      referralCode: customer.referralCode,
      referralLink: customer.referralCode ? `${origin}/?ref=${customer.referralCode}` : null,
      totalReferrals: stats.totalReferrals,
      completedReferrals: stats.completedReferrals,
      totalEarned: stats.totalEarned,
    });
  });

  // ─── v1: Customer: My support tickets ────────────────────────────────────
  app.get("/api/v1/my-tickets", apiKeyAuthMiddleware, async (req: any, res) => {
    if (!req.apiKey.customerId) return res.status(403).json({ error: "Customer API key required" });
    const customer = await storage.getCustomerById(req.apiKey.customerId);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const tickets = await storage.getTicketsByEmail(customer.email);
    res.json({ count: tickets.length, tickets: tickets.map((t: any) => ({ id: t.id, subject: t.subject, status: t.status, createdAt: t.createdAt })) });
  });

  // ─── v1: Customer: Open a support ticket ─────────────────────────────────
  app.post("/api/v1/tickets", apiKeyAuthMiddleware, async (req: any, res) => {
    if (!req.apiKey.customerId) return res.status(403).json({ error: "Customer API key required" });
    const customer = await storage.getCustomerById(req.apiKey.customerId);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const { subject, message } = req.body;
    if (!subject?.trim() || !message?.trim()) return res.status(400).json({ error: "subject and message are required" });
    const ticket = await storage.createTicket({ customerEmail: customer.email, customerName: customer.name, subject: subject.trim() });
    await storage.addMessage({ ticketId: ticket.id, sender: "customer", message: message.trim() });
    res.json({ success: true, ticketId: ticket.id, token: ticket.token });
  });

  // ─── v1: Customer: Get credentials for an order ──────────────────────────
  app.get("/api/v1/my-credentials/:reference", apiKeyAuthMiddleware, async (req: any, res) => {
    if (!req.apiKey.customerId) return res.status(403).json({ error: "Customer API key required" });
    const customer = await storage.getCustomerById(req.apiKey.customerId);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const txn = await storage.getTransactionByReference(req.params.reference);
    if (!txn || txn.customerEmail !== customer.email) return res.status(404).json({ error: "Order not found" });
    if (txn.status !== "success") return res.status(400).json({ error: "Order not yet completed" });
    const override = getCredentialsOverride(req.params.reference);
    const account = override || (txn.planId ? await accountManager.findAccountByCustomer(txn.planId, customer.email) : null);
    if (!account) return res.json({ reference: req.params.reference, credentials: null, note: "No credentials assigned yet" });
    res.json({
      reference: req.params.reference,
      plan: txn.planName,
      credentials: { email: (account as any).email ?? null, password: (account as any).password ?? null, extra: (account as any).extra ?? null },
    });
  });

  // ─── v1: Admin: Single customer detail ───────────────────────────────────
  app.get("/api/v1/admin/customers/:id", apiKeyAuthMiddleware, async (req: any, res) => {
    if (req.apiKey.customerId) return res.status(403).json({ error: "Admin API key required" });
    const c = await storage.getCustomerById(parseInt(req.params.id));
    if (!c) return res.status(404).json({ error: "Customer not found" });
    const stats = await storage.getCustomerSpendingStats(c.email);
    const wallet = await storage.getWallet(c.id);
    res.json({
      id: c.id, email: c.email, name: c.name, suspended: c.suspended,
      emailVerified: c.emailVerified, createdAt: c.createdAt,
      walletBalance: wallet.balance, ...stats,
    });
  });

  // ─── v1: Admin: Suspend / unsuspend customer ──────────────────────────────
  app.patch("/api/v1/admin/customers/:id/suspend", apiKeyAuthMiddleware, async (req: any, res) => {
    if (req.apiKey.customerId) return res.status(403).json({ error: "Admin API key required" });
    const { suspended } = req.body;
    if (typeof suspended !== "boolean") return res.status(400).json({ error: "suspended must be a boolean" });
    const c = await storage.updateCustomer(parseInt(req.params.id), { suspended });
    if (!c) return res.status(404).json({ error: "Customer not found" });
    res.json({ success: true, id: c.id, email: c.email, suspended: c.suspended });
  });

  // ─── v1: Admin: Customer wallet balance + history ─────────────────────────
  app.get("/api/v1/admin/customers/:id/wallet", apiKeyAuthMiddleware, async (req: any, res) => {
    if (req.apiKey.customerId) return res.status(403).json({ error: "Admin API key required" });
    const customerId = parseInt(req.params.id);
    const wallet = await storage.getWallet(customerId);
    const txns = await storage.getWalletTransactions(customerId);
    res.json({ balance: wallet.balance, transactions: txns.slice(0, 50) });
  });

  // ─── v1: Admin: Top up customer wallet ───────────────────────────────────
  app.post("/api/v1/admin/wallet/topup", apiKeyAuthMiddleware, async (req: any, res) => {
    if (req.apiKey.customerId) return res.status(403).json({ error: "Admin API key required" });
    const { customerId, amount, description } = req.body;
    if (!customerId || !amount || amount <= 0) return res.status(400).json({ error: "customerId and positive amount are required" });
    const c = await storage.getCustomerById(customerId);
    if (!c) return res.status(404).json({ error: "Customer not found" });
    await storage.creditWallet(customerId, amount, description || "Admin top-up via API");
    const wallet = await storage.getWallet(customerId);
    res.json({ success: true, customerId, amount, newBalance: wallet.balance });
  });

  // ─── v1: Admin: Single order by reference ────────────────────────────────
  app.get("/api/v1/admin/orders/:reference", apiKeyAuthMiddleware, async (req: any, res) => {
    if (req.apiKey.customerId) return res.status(403).json({ error: "Admin API key required" });
    const tx = await storage.getTransaction(req.params.reference);
    if (!tx) return res.status(404).json({ error: "Order not found" });
    res.json({ order: tx });
  });

  // ─── v1: Admin: Re-deliver order credentials ─────────────────────────────
  app.post("/api/v1/admin/orders/:reference/deliver", apiKeyAuthMiddleware, async (req: any, res) => {
    if (req.apiKey.customerId) return res.status(403).json({ error: "Admin API key required" });
    const tx = await storage.getTransaction(req.params.reference);
    if (!tx) return res.status(404).json({ error: "Order not found" });
    if (tx.status !== "success") return res.status(400).json({ error: "Can only re-deliver successful orders" });
    const delivery = await deliverAccount(tx as any);
    res.json({ success: delivery.success, error: delivery.error || null });
  });

  // ─── Customer: Support Tickets ───────────────────────────────────────
  app.get("/api/customer/tickets", customerAuthMiddleware, async (req: any, res) => {
    try {
      const tickets = await storage.getTicketsByEmail(req.customer.email);
      res.json({ success: true, tickets });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/customer/tickets/:id/messages", customerAuthMiddleware, async (req: any, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getTicketById(ticketId);
      if (!ticket || ticket.customerEmail !== req.customer.email) {
        return res.status(403).json({ success: false, error: "Ticket not found" });
      }
      const messages = await storage.getMessages(ticketId);
      res.json({ success: true, ticket, messages });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/customer/tickets", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { subject, message } = req.body;
      if (!message) return res.status(400).json({ success: false, error: "Message is required" });
      const ticket = await storage.createTicket({
        customerEmail: req.customer.email,
        customerName: req.customer.name || undefined,
        subject: subject || "Support Request",
      });
      await storage.addMessage({ ticketId: ticket.id, sender: "customer", message });
      res.json({ success: true, ticket });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/customer/tickets/:id/reply", customerAuthMiddleware, async (req: any, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const ticket = await storage.getTicketById(ticketId);
      if (!ticket || ticket.customerEmail !== req.customer.email) {
        return res.status(403).json({ success: false, error: "Ticket not found" });
      }
      const { message } = req.body;
      if (!message) return res.status(400).json({ success: false, error: "Message is required" });
      const msg = await storage.addMessage({ ticketId, sender: "customer", message });
      res.json({ success: true, message: msg });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COUNTRY RESTRICTIONS ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/country-restrictions", adminAuthMiddleware, superAdminOnly, (_req, res) => {
    res.json({ success: true, config: countryRestrictions.get() });
  });

  app.put("/api/admin/country-restrictions", adminAuthMiddleware, superAdminOnly, (req, res) => {
    try {
      const { mode, countries } = req.body;
      if (mode) countryRestrictions.setMode(mode);
      if (Array.isArray(countries)) countryRestrictions.setCountries(countries);
      res.json({ success: true, config: countryRestrictions.get() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/country-restrictions/add", adminAuthMiddleware, superAdminOnly, (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ success: false, error: "Country code required" });
      countryRestrictions.addCountry(code);
      res.json({ success: true, config: countryRestrictions.get() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/admin/country-restrictions/:code", adminAuthMiddleware, superAdminOnly, (req, res) => {
    try {
      countryRestrictions.removeCountry(req.params.code);
      res.json({ success: true, config: countryRestrictions.get() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VPS MANAGEMENT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/vps", adminAuthMiddleware, superAdminOnly, (_req, res) => {
    const servers = vpsManager.getAll().map((s) => ({ ...s, password: s.password ? "***" : undefined, privateKey: s.privateKey ? "***" : undefined }));
    res.json({ success: true, servers });
  });

  app.post("/api/admin/vps", adminAuthMiddleware, superAdminOnly, (req, res) => {
    try {
      const { label, host, port, username, authType, password, privateKey, osType } = req.body;
      if (!host || !username) return res.status(400).json({ success: false, error: "Host and username are required" });
      const server = vpsManager.add({ label: label || host, host, port: parseInt(port) || 22, username, authType: authType || "password", password, privateKey, osType: osType || "ubuntu" });
      res.json({ success: true, server: { ...server, password: server.password ? "***" : undefined, privateKey: server.privateKey ? "***" : undefined } });
      // Auto-deploy any pending paid orders to this newly added VPS
      setTimeout(() => deployPendingOrders().catch((e: any) => console.error("[VPS Add] deploy error:", e.message)), 1500);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put("/api/admin/vps/:id", adminAuthMiddleware, superAdminOnly, (req, res) => {
    try {
      const server = vpsManager.update(req.params.id, req.body);
      if (!server) return res.status(404).json({ success: false, error: "Server not found" });
      res.json({ success: true, server: { ...server, password: server.password ? "***" : undefined, privateKey: server.privateKey ? "***" : undefined } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/admin/vps/:id", adminAuthMiddleware, superAdminOnly, (req, res) => {
    try {
      const deleted = vpsManager.delete(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, error: "Server not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/vps/:id/reboot", adminAuthMiddleware, superAdminOnly, async (req, res) => {
    try {
      const result = await vpsManager.reboot(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/admin/vps/:id/ping", adminAuthMiddleware, superAdminOnly, async (req, res) => {
    try {
      const result = await vpsManager.ping(req.params.id);
      res.json({ success: true, ping: result });
    } catch (err: any) {
      res.status(500).json({ success: false });
    }
  });

  app.post("/api/admin/vps/:id/exec", adminAuthMiddleware, superAdminOnly, async (req, res) => {
    try {
      const server = vpsManager.getById(req.params.id);
      if (!server) return res.status(404).json({ success: false, error: "Server not found" });
      const { command } = req.body;
      if (!command) return res.status(400).json({ success: false, error: "Command required" });
      const result = await vpsManager.execCommand(server, command);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Agent: backfill tokens for existing VPS servers ───────────────────────
  vpsManager.ensureAgentTokens();

  // ─── Public: VPS deploy-agent endpoints (token-authenticated) ───────────────
  // GET /api/agent/pending?token=<agentToken>  — returns orders for this agent to deploy
  app.get("/api/agent/pending", async (req: any, res) => {
    try {
      const { token } = req.query;
      if (!token) return res.status(401).json({ error: "Missing token" });
      const server = vpsManager.getByAgentToken(String(token));
      if (!server) return res.status(401).json({ error: "Invalid token" });

      // Auto-reset orders stuck in 'deploying' for > 5 minutes (crashed mid-deploy)
      const stuckCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      await runMutation(
        `UPDATE bot_orders SET status = 'deploy_failed', deployment_notes = 'Auto-reset: stuck in deploying state' WHERE status = 'deploying' AND updated_at < ?`,
        [stuckCutoff]
      ).catch(() => {});

      const pending = await runQuery(
        `SELECT bo.*, b.repo_url, b.name as bot_name FROM bot_orders bo LEFT JOIN bots b ON bo.bot_id = b.id WHERE bo.status IN ('paid','deploy_failed') AND (bo.pm2_name IS NULL OR bo.pm2_name = '') ORDER BY bo.created_at LIMIT 5`,
        []
      );
      res.json({ success: true, vpsId: server.id, orders: pending });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/agent/deployed  — agent reports successful deployment
  app.post("/api/agent/deployed", async (req: any, res) => {
    try {
      const { token, orderId, pm2Name, error: deployError } = req.body;
      if (!token) return res.status(401).json({ error: "Missing token" });
      const server = vpsManager.getByAgentToken(String(token));
      if (!server) return res.status(401).json({ error: "Invalid token" });

      const updNow = dbType === "pg" ? "NOW()::text" : "datetime('now')";
      if (deployError) {
        await runMutation(
          `UPDATE bot_orders SET status = 'deploy_failed', deployment_notes = ?, updated_at = ${updNow} WHERE id = ?`,
          ["Agent deploy failed: " + String(deployError).slice(0, 200), orderId]
        );
        return res.json({ success: true, status: "failed" });
      }
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await runMutation(
        `UPDATE bot_orders SET status = 'deployed', pm2_name = ?, vps_server_id = ?, deployed_at = ${updNow}, expires_at = ?, updated_at = ${updNow} WHERE id = ?`,
        [pm2Name, server.id, expiresAt, orderId]
      );
      console.log(`[Agent] ✓ Order ${orderId} → ${pm2Name} on ${server.label}`);
      res.json({ success: true, status: "deployed" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/agent/script/:vpsId  — generate the bash install script for this VPS agent
  app.get("/api/agent/script/:vpsId", adminAuthMiddleware, superAdminOnly, (req: any, res) => {
    const server = vpsManager.getById(req.params.vpsId);
    if (!server) return res.status(404).json({ error: "VPS not found" });

    const appUrl = (process.env.APP_URL || `https://${req.get("host")}`).replace(/\/$/, "");
    const token = server.agentToken!;
    const osType = server.osType || "ubuntu";
    const isRhel = ["almalinux","centos","rhel","fedora","rocky","oracle"].includes(osType);

    const agentJs = `#!/usr/bin/env node
// Chege Tech — VPS Deploy Agent
// Auto-generated for: ${server.label} (${server.host})
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const { execSync } = require('child_process');

const API   = '${appUrl}';
const TOKEN = '${token}';
const POLL_MS = 60000; // poll every 60 seconds

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + path);
    const lib = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search, method,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
    };
    const req = lib.request(opts, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function run(cmd) {
  try { return execSync(cmd, { stdio: 'pipe', timeout: 300000 }).toString().trim(); }
  catch (e) { return e.stdout?.toString().trim() || e.message; }
}

async function deployOrder(order) {
  const pm2Name = 'bot-' + order.reference;
  const botDir  = '/opt/bots/' + pm2Name;
  const repoUrl = (order.repo_url || '').replace(/\\.git$/, '');
  if (!repoUrl) throw new Error('No repo_url');

  const nvmSrc = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';

  // Ensure Node
  const nodeVer = run('node --version 2>/dev/null || echo NOT_FOUND');
  if (nodeVer.includes('NOT_FOUND') || !nodeVer.startsWith('v')) {
    console.log('[Agent] Installing Node.js via nvm...');
    run('curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash');
    run(nvmSrc + ' && nvm install 20 && nvm alias default 20 && nvm use default && ln -sf $(which node) /usr/local/bin/node; ln -sf $(which npm) /usr/local/bin/npm; true');
  }

  // Ensure PM2
  const pm2Ver = run('pm2 --version 2>/dev/null || echo NOT_FOUND');
  if (pm2Ver.includes('NOT_FOUND')) {
    console.log('[Agent] Installing PM2...');
    run(nvmSrc + '; npm install -g pm2 && ln -sf $(which pm2) /usr/local/bin/pm2 2>/dev/null; true');
  }

  // Clone or pull
  run('mkdir -p /opt/bots');
  const pullOut = run('git -C ' + botDir + ' pull --ff-only 2>&1 || git clone ' + repoUrl + ' ' + botDir + ' 2>&1');
  console.log('[Agent] Repo:', pullOut.slice(0, 80));

  // Write .env
  const envLines = [
    'NODE_ENV=production',
    order.session_id ? 'SESSION_ID=' + order.session_id : '',
    order.db_url     ? 'DB_URL='     + order.db_url     : '',
    order.mode       ? 'MODE='       + order.mode       : '',
    order.timezone   ? 'TIMEZONE='   + order.timezone   : '',
  ].filter(Boolean).join('\\n');
  fs.writeFileSync(botDir + '/.env', envLines + '\\n');

  // npm install
  run(nvmSrc + '; cd ' + botDir + ' && npm install --production 2>&1');

  // Start PM2
  run(nvmSrc + '; pm2 delete ' + pm2Name + ' 2>/dev/null; true');
  const startOut = run(nvmSrc + '; cd ' + botDir + ' && (pm2 start . --name ' + pm2Name + ' 2>&1 || pm2 start index.js --name ' + pm2Name + ' 2>&1)');
  run(nvmSrc + '; pm2 save');
  console.log('[Agent] PM2:', startOut.slice(0, 80));
  return pm2Name;
}

async function poll() {
  try {
    const data = await apiRequest('GET', '/api/agent/pending?token=' + TOKEN, null);
    if (!data.orders?.length) { console.log('[Agent] No pending orders at', new Date().toLocaleTimeString()); return; }
    console.log('[Agent] Found', data.orders.length, 'pending order(s)');
    for (const order of data.orders) {
      console.log('[Agent] Deploying', order.reference, '...');
      try {
        const pm2Name = await deployOrder(order);
        await apiRequest('POST', '/api/agent/deployed', { token: TOKEN, orderId: order.id, pm2Name });
        console.log('[Agent] ✓', order.reference, '->', pm2Name);
      } catch (e) {
        console.error('[Agent] ✗', order.reference, e.message);
        await apiRequest('POST', '/api/agent/deployed', { token: TOKEN, orderId: order.id, error: e.message });
      }
    }
  } catch (e) { console.error('[Agent] Poll error:', e.message); }
}

console.log('[Agent] Started — polling ${appUrl} every', POLL_MS / 1000, 's');
poll();
setInterval(poll, POLL_MS);
`;

    const installGit = isRhel
      ? "dnf install -y git curl 2>/dev/null || yum install -y git curl 2>/dev/null"
      : "apt-get install -y git curl 2>/dev/null";

    const bashScript = `#!/bin/bash
set -e
echo "==> Installing Chege Tech Deploy Agent for: ${server.label}"
mkdir -p /opt/deploy-agent
cat > /opt/deploy-agent/agent.js << 'AGENT_EOF'
${agentJs}
AGENT_EOF

# Ensure git + curl
which git &>/dev/null || (${installGit})

# Ensure Node / PM2
export NVM_DIR="$HOME/.nvm"
if ! command -v node &>/dev/null; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 20 && nvm alias default 20 && nvm use default
  ln -sf $(which node) /usr/local/bin/node
  ln -sf $(which npm)  /usr/local/bin/npm
fi
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
  ln -sf $(which pm2) /usr/local/bin/pm2 2>/dev/null || true
fi

pm2 delete chege-deploy-agent 2>/dev/null || true
pm2 start /opt/deploy-agent/agent.js --name chege-deploy-agent --interpreter node
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "✅  Deploy agent installed and running!"
echo "    It polls every 60 s for new paid orders and deploys them automatically."
echo "    Check logs: pm2 logs chege-deploy-agent"
`;

    res.json({ success: true, script: bashScript, vpsLabel: server.label });
  });

  // ─── Admin: Deploy bot order to VPS via SSH ──────────────────────────────
  app.post("/api/admin/bot-orders/:id/deploy-vps", adminAuthMiddleware, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { vpsId } = req.body;
      if (!vpsId) return res.status(400).json({ success: false, error: "vpsId is required" });

      // Get bot order + repo URL
      const orderRows = await runQuery(
        `SELECT bo.*, b.repo_url as bot_repo_url, b.name as bot_name FROM bot_orders bo LEFT JOIN bots b ON bo.bot_id = b.id WHERE bo.id = $1`,
        [orderId]
      );
      if (!orderRows.length) return res.status(404).json({ success: false, error: "Order not found" });
      const order = orderRows[0];
      if (!order.bot_repo_url) return res.status(400).json({ success: false, error: "Bot has no GitHub repo URL configured" });

      const server = vpsManager.getById(vpsId);
      if (!server) return res.status(404).json({ success: false, error: "VPS server not found" });

      // Mark as deploying
      await runMutation(`UPDATE bot_orders SET status = 'deploying', updated_at = NOW() WHERE id = $1`, [orderId]);

      const appDir = `/opt/chegetech_bots/order_${orderId}`;
      const sessionId = (order.session_id || "").replace(/'/g, "");

      const steps: [string, string][] = [
        ["Create bot directory", `mkdir -p ${appDir}`],
        ["Check Node.js", `which node || (curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs 2>/dev/null)`],
        ["Install pm2", `which pm2 2>/dev/null || sudo npm install -g pm2 2>/dev/null || npm install -g pm2`],
        ["Clone/update repo", `if [ -d "${appDir}/.git" ]; then git -C ${appDir} fetch origin && git -C ${appDir} reset --hard origin/HEAD; else git clone ${order.bot_repo_url} ${appDir}; fi`],
        ["Install dependencies", `cd ${appDir} && npm install --omit=dev 2>&1 | tail -5`],
        ["Write .env", `printf 'SESSION_ID=%s\nNODE_ENV=production\n' '${sessionId}' > ${appDir}/.env`],
        ["Stop old process", `pm2 delete order_${orderId} 2>/dev/null; true`],
        ["Start bot", `cd ${appDir} && (pm2 start . --name order_${orderId} 2>/dev/null || pm2 start index.js --name order_${orderId} 2>/dev/null || nohup node index.js >> ${appDir}/bot.log 2>&1 &)`],
        ["Save pm2 list", `pm2 save 2>/dev/null; true`],
      ];

      const log: string[] = [];
      let success = true;

      for (const [label, cmd] of steps) {
        try {
          const result = await vpsManager.execCommand(server, cmd);
          const out = [result.stdout, result.stderr ? `[stderr]: ${result.stderr.slice(0, 300)}` : ""].filter(Boolean).join("\n");
          log.push(`[${label}]\n${out || "(no output)"}`);
          if (result.code !== 0 && !label.includes("old process") && !label.includes("pm2 list") && !label.includes("pm2") && !label.includes("Check")) {
            success = false;
            log.push(`❌ Step failed (exit code ${result.code})`);
            break;
          }
        } catch (err: any) {
          log.push(`[${label}]\n[ERROR]: ${err.message}`);
          if (!label.includes("old process") && !label.includes("pm2 list") && !label.includes("pm2")) {
            success = false;
            break;
          }
        }
      }

      const fullLog = log.join("\n\n---\n\n").slice(0, 3000);
      await runMutation(
        `UPDATE bot_orders SET status = $1, deployment_notes = $2, updated_at = NOW() WHERE id = $3`,
        [success ? "deployed" : "deploy_failed", fullLog, orderId]
      );

      res.json({ success, log: fullLog, status: success ? "deployed" : "deploy_failed" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Wallet ────────────────────────────────────────────────
  app.get("/api/customer/wallet", customerAuthMiddleware, async (req: any, res) => {
    try {
      const customerId = req.customer.id;
      const wallet = await storage.getWallet(customerId);
      const transactions = await storage.getWalletTransactions(customerId);
      res.json({ success: true, balance: wallet.balance, transactions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Notifications ─────────────────────────────────────────
  app.get("/api/customer/notifications", customerAuthMiddleware, async (req: any, res) => {
    try {
      const notifications = await storage.getNotifications(req.customer.id);
      const unread = notifications.filter((n: any) => !n.read).length;
      res.json({ success: true, notifications, unread });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put("/api/customer/notifications/read", customerAuthMiddleware, async (req: any, res) => {
    try {
      await storage.markNotificationsRead(req.customer.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Spending Stats ─────────────────────────────────────────
  app.get("/api/customer/stats", customerAuthMiddleware, async (req: any, res) => {
    try {
      const stats = await storage.getCustomerSpendingStats(req.customer.email);
      res.json({ success: true, ...stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Login History ──────────────────────────────────────────
  app.get("/api/customer/login-history", customerAuthMiddleware, async (req: any, res) => {
    try {
      const logs = await storage.getLoginLogs(req.customer.id);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Active Sessions ────────────────────────────────────────
  app.get("/api/customer/sessions", customerAuthMiddleware, async (req: any, res) => {
    try {
      const currentToken = req.headers.authorization?.replace("Bearer ", "") || "";
      const now = new Date();
      const all = await storage.getCustomerSessions(req.customer.id);
      const active = all
        .filter((s: any) => new Date(s.expiresAt) > now)
        .map((s: any) => ({
          id: s.id,
          deviceName: s.deviceName || parseDeviceName(s.userAgent || ""),
          ip: s.ip || "unknown",
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          isCurrent: s.token === currentToken,
        }));
      res.json({ success: true, sessions: active });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/customer/sessions/others", customerAuthMiddleware, async (req: any, res) => {
    try {
      const currentToken = req.headers.authorization?.replace("Bearer ", "") || "";
      const count = await storage.deleteOtherSessions(currentToken, req.customer.id);
      res.json({ success: true, revoked: count });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/customer/sessions/:id", customerAuthMiddleware, async (req: any, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      if (isNaN(sessionId)) return res.status(400).json({ success: false, error: "Invalid session ID" });
      const currentToken = req.headers.authorization?.replace("Bearer ", "") || "";
      const all = await storage.getCustomerSessions(req.customer.id);
      const target = all.find((s: any) => s.id === sessionId);
      if (!target) return res.status(404).json({ success: false, error: "Session not found" });
      if (target.token === currentToken) return res.status(400).json({ success: false, error: "Cannot revoke your current session. Use logout instead." });
      await storage.deleteCustomerSessionById(sessionId, req.customer.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Referral ───────────────────────────────────────────────
  app.get("/api/customer/referral", customerAuthMiddleware, async (req: any, res) => {
    try {
      const customerId = req.customer.id;
      let referral = await storage.getReferralByReferrer(customerId);
      if (!referral) {
        const code = `REF${customerId}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        await storage.createReferral(customerId, code);
        referral = await storage.getReferralByReferrer(customerId);
      }
      const stats = await storage.getReferralStats(customerId);
      const baseUrl = process.env.REPLIT_DOMAINS?.split(",")[0] || req.get("host") || "localhost";
      const referralLink = `https://${baseUrl}/auth?ref=${referral?.referralCode}`;
      res.json({ success: true, code: referral?.referralCode, link: referralLink, stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Full Payment History ──────────────────────────────────
  app.get("/api/customer/payment-history", customerAuthMiddleware, async (req: any, res) => {
    try {
      const customer = req.customer;
      const [orders, walletTxns] = await Promise.all([
        storage.getTransactionsByEmail(customer.email),
        storage.getWalletTransactions(customer.id),
      ]);
      res.json({ success: true, orders, walletTransactions: walletTxns });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Custom Domain Management ────────────────────────────────
  type CustomDomain = { id: string; domain: string; label: string; addedAt: string; primary: boolean };

  function getDomains(): CustomDomain[] {
    try { return JSON.parse(dbSettingsGet("custom_domains") || "[]"); } catch { return []; }
  }
  function saveDomains(domains: CustomDomain[]) { dbSettingsSet("custom_domains", JSON.stringify(domains)); }

  app.get("/api/admin/domains", adminAuthMiddleware, superAdminOnly, (_req, res) => {
    const config = getAppConfig();
    const replitDomain = config.appDomain || process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || null;
    res.json({ success: true, domains: getDomains(), replitDomain, appDomain: config.appDomain || "" });
  });

  app.put("/api/admin/domains/cname-target", adminAuthMiddleware, superAdminOnly, (req, res) => {
    try {
      const { appDomain } = req.body;
      saveAppConfig({ appDomain: (appDomain || "").trim() });
      logAdminAction({ action: "CNAME target updated", category: "settings", details: `appDomain set to: ${appDomain}`, status: "success" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Cloudflare auto-verify (push CNAME record) ───────────────────
  app.post("/api/admin/domains/:id/cloudflare-verify", adminAuthMiddleware, superAdminOnly, async (req, res) => {
    try {
      const token = getCloudflareApiToken();
      if (!token) return res.status(400).json({ success: false, error: "Cloudflare API token not configured. Add it in Settings → Credentials." });

      const domains = getDomains();
      const domain = domains.find((d: any) => d.id === req.params.id);
      if (!domain) return res.status(404).json({ success: false, error: "Domain not found" });

      const config = getAppConfig();
      const cnameDest = config.appDomain || process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "";
      if (!cnameDest) return res.status(400).json({ success: false, error: "CNAME target not set. Configure it in Domains tab first." });

      const cfHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // Extract root domain (e.g. store.streamvault-premium.site → streamvault-premium.site)
      const parts = domain.domain.split(".");
      const rootDomain = parts.length > 2 ? parts.slice(-2).join(".") : domain.domain;
      const subdomain = parts.length > 2 ? parts.slice(0, -2).join(".") : "@";

      // Find Cloudflare zone
      const zonesResp = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(rootDomain)}&status=active`, { headers: cfHeaders });
      const zonesData = await zonesResp.json() as any;
      if (!zonesData.success || !zonesData.result?.length) {
        return res.status(404).json({ success: false, error: `Zone for "${rootDomain}" not found in your Cloudflare account. Make sure the domain is active there.` });
      }
      const zoneId = zonesData.result[0].id;

      // Check for existing CNAME
      const existResp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(domain.domain)}`, { headers: cfHeaders });
      const existData = await existResp.json() as any;
      const existing = existData.result?.[0];

      let result: any;
      if (existing) {
        // Update existing record
        const upResp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existing.id}`, {
          method: "PUT",
          headers: cfHeaders,
          body: JSON.stringify({ type: "CNAME", name: subdomain, content: cnameDest, ttl: 1, proxied: false }),
        });
        result = await upResp.json() as any;
      } else {
        // Create new record
        const crResp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
          method: "POST",
          headers: cfHeaders,
          body: JSON.stringify({ type: "CNAME", name: subdomain, content: cnameDest, ttl: 1, proxied: false }),
        });
        result = await crResp.json() as any;
      }

      if (!result.success) {
        const errMsg = result.errors?.[0]?.message || "Cloudflare API error";
        return res.status(400).json({ success: false, error: errMsg });
      }

      const action = existing ? "updated" : "created";
      logAdminAction({ action: `Cloudflare CNAME ${action}`, category: "settings", details: `${domain.domain} → ${cnameDest}`, status: "success" });
      res.json({ success: true, action, record: { name: domain.domain, content: cnameDest }, zone: rootDomain });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Verify domain DNS (CNAME check via Google DoH) ───────────────
  app.get("/api/admin/domains/:id/verify", adminAuthMiddleware, superAdminOnly, async (req, res) => {
    try {
      const domains = getDomains();
      const domain = domains.find((d: any) => d.id === req.params.id);
      if (!domain) return res.status(404).json({ success: false, error: "Domain not found" });

      const config = getAppConfig();
      const expectedTarget = config.appDomain || process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "";

      const dohResp = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(domain.domain)}&type=CNAME`,
        { headers: { Accept: "application/dns-json" } }
      );
      const dohData = await dohResp.json() as any;

      const answers: any[] = dohData.Answer || [];
      const cnameRecords = answers.filter((a: any) => a.type === 5);
      const found = cnameRecords[0]?.data?.replace(/\.$/, "") || null;

      const verified = expectedTarget
        ? !!(found && found.toLowerCase() === expectedTarget.toLowerCase())
        : !!found;

      res.json({
        success: true,
        verified,
        domain: domain.domain,
        found,
        expected: expectedTarget || null,
        dnsStatus: dohData.Status,
        propagated: dohData.Status === 0 && answers.length > 0,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/domains", adminAuthMiddleware, superAdminOnly, (req, res) => {
    const { domain, label } = req.body;
    if (!domain) return res.status(400).json({ success: false, error: "domain is required" });
    const clean = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
    const existing = getDomains();
    if (existing.some((d) => d.domain === clean)) return res.status(400).json({ success: false, error: "Domain already added" });
    const entry: CustomDomain = { id: uuidv4(), domain: clean, label: label || clean, addedAt: new Date().toISOString(), primary: existing.length === 0 };
    existing.push(entry);
    saveDomains(existing);
    logAdminAction({ action: `Custom domain added: ${clean}`, category: "settings", details: `Label: ${label || clean}`, status: "success" });
    res.json({ success: true, domain: entry });
  });

  app.put("/api/admin/domains/:id/primary", adminAuthMiddleware, superAdminOnly, (req, res) => {
    const domains = getDomains().map((d) => ({ ...d, primary: d.id === req.params.id }));
    saveDomains(domains);
    res.json({ success: true });
  });

  app.delete("/api/admin/domains/:id", adminAuthMiddleware, superAdminOnly, (req, res) => {
    const all = getDomains();
    const target = all.find((d) => d.id === req.params.id);
    if (!target) return res.status(404).json({ success: false, error: "Not found" });
    const filtered = all.filter((d) => d.id !== req.params.id);
    if (target.primary && filtered.length > 0) filtered[0].primary = true;
    saveDomains(filtered);
    logAdminAction({ action: `Custom domain removed: ${target.domain}`, category: "settings", details: `ID: ${target.id}`, status: "warning" });
    res.json({ success: true });
  });

  // ─── Customer: Wallet Top-Up ──────────────────────────────────────────────
  app.post("/api/customer/wallet/topup/initiate", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { amount, label } = req.body;
      const customerId = req.customer.id;
      const customer = await storage.getCustomerById(customerId);
      if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });

      const amountNum = parseInt(amount);
      if (!amountNum || amountNum < 50) return res.status(400).json({ success: false, error: "Minimum top-up is KES 50" });

      const paystackSecret = getPaystackSecretKey();
      const reference = `TOPUP-${customerId}-${Date.now()}`;
      const topupLabel = label?.trim() ? label.trim() : "Wallet Top-Up";

      // Store label for use during verify
      dbSettingsSet(`topup_label_${reference}`, topupLabel);

      await storage.createTransaction({
        reference,
        planId: "WALLET_TOPUP",
        planName: topupLabel,
        customerEmail: customer.email,
        customerName: customer.name || "Customer",
        amount: amountNum,
        status: "pending",
        emailSent: false,
        accountAssigned: false,
      });

      if (!paystackSecret) {
        return res.json({ success: true, paystackConfigured: false, reference, authorizationUrl: null });
      }

      const psRes = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: customer.email,
          amount: amountNum * 100,
          reference,
          currency: "KES",
          metadata: { type: "wallet_topup", customerId, amount: amountNum, label: topupLabel },
          callback_url: `${getBaseUrl(req)}/dashboard?tab=wallet&topup=success`,
        },
        { headers: { Authorization: `Bearer ${paystackSecret}` } }
      );

      res.json({ success: true, reference, authorizationUrl: psRes.data.data.authorization_url, accessCode: psRes.data.data.access_code, paystackConfigured: true, amount: amountNum, label: topupLabel });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/customer/wallet/topup/verify", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { reference } = req.body;
      const customerId = req.customer.id;

      const transaction = await storage.getTransaction(reference);
      if (!transaction || transaction.planId !== "WALLET_TOPUP") {
        return res.status(404).json({ success: false, error: "Top-up transaction not found" });
      }
      if (transaction.status === "success") {
        return res.json({ success: true, alreadyProcessed: true, amount: transaction.amount });
      }

      const verify = await verifyPaystackPayment(reference);
      if (!verify.configured) return res.status(503).json({ success: false, error: "Payment gateway not configured" });
      if (!verify.success) {
        await storage.updateTransaction(reference, { status: "failed" });
        return res.json({ success: false, error: "Payment was not successful" });
      }

      const storedLabel = dbSettingsGet(`topup_label_${reference}`) || transaction.planName || "Wallet Top-Up";
      const creditDesc = storedLabel === "Wallet Top-Up"
        ? `Wallet top-up — KES ${transaction.amount}`
        : `${storedLabel} — KES ${transaction.amount}`;
      await storage.creditWallet(customerId, transaction.amount, creditDesc, reference);
      dbSettingsSet(`topup_label_${reference}`, ""); // cleanup
      await storage.updateTransaction(reference, { status: "success", accountAssigned: true, emailSent: true });
      await storage.createNotification(customerId, "wallet", "Wallet Topped Up 💰", `KES ${transaction.amount} has been added to your wallet.`);

      res.json({ success: true, amount: transaction.amount });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Pay with Wallet ────────────────────────────────────────────
  app.post("/api/customer/wallet/pay", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { planId, customerName } = req.body;
      const customerId = req.customer.id;
      const customer = await storage.getCustomerById(customerId);
      if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });

      const categories = buildPlansResponse();
      let plan: any = null;
      for (const cat of Object.values(categories) as any[]) {
        if (cat.plans[planId]) { plan = cat.plans[planId]; break; }
      }
      if (!plan) return res.status(400).json({ success: false, error: "Invalid plan" });

      const avail = accountManager.checkAvailability(planId);
      if (!avail.available) return res.status(400).json({ success: false, error: "This plan is currently out of stock", outOfStock: true });

      const wallet = await storage.getWallet(customerId);
      if ((wallet.balance || 0) < plan.price) {
        return res.status(400).json({ success: false, error: `Insufficient wallet balance. You need KES ${plan.price} but have KES ${wallet.balance}.`, insufficientFunds: true });
      }

      const reference = `WALLET-${planId.toUpperCase()}-${Date.now()}`;
      const transaction = await storage.createTransaction({
        reference,
        planId,
        planName: plan.name,
        customerEmail: customer.email,
        customerName: customerName || customer.name || "Customer",
        amount: plan.price,
        status: "pending",
        emailSent: false,
        accountAssigned: false,
      });

      await storage.debitWallet(customerId, plan.price, `Purchase: ${plan.name}`, reference);
      const delivery = await deliverAccount(transaction);
      if (!delivery.success) {
        await storage.creditWallet(customerId, plan.price, `Refund: ${plan.name} (delivery failed)`, reference);
        return res.json({ success: false, error: delivery.error });
      }

      res.json({ success: true, planName: plan.name, reference });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: Wallet pay (cart) ─────────────────────────────────────────
  app.post("/api/customer/wallet/pay-cart", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { items, customerName } = req.body; // items: [{planId, qty}]
      const customerId = req.customer.id;
      const customer = await storage.getCustomerById(customerId);
      if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: "No items provided" });
      }

      const categories = buildPlansResponse();

      // Expand items and validate
      type CartLine = { planId: string; planName: string; price: number };
      const lines: CartLine[] = [];
      for (const item of items) {
        let plan: any = null;
        for (const cat of Object.values(categories) as any[]) {
          if (cat.plans[item.planId]) { plan = cat.plans[item.planId]; break; }
        }
        if (!plan) return res.status(400).json({ success: false, error: `Invalid plan: ${item.planId}` });
        const avail = accountManager.checkAvailability(item.planId);
        if (!avail.available) return res.status(400).json({ success: false, error: `${plan.name} is currently out of stock`, outOfStock: true, planName: plan.name });
        const qty = Math.max(1, Number(item.qty) || 1);
        for (let q = 0; q < qty; q++) {
          lines.push({ planId: item.planId, planName: plan.name, price: plan.price });
        }
      }

      const totalAmount = lines.reduce((s, l) => s + l.price, 0);
      const wallet = await storage.getWallet(customerId);
      if ((wallet.balance || 0) < totalAmount) {
        return res.status(400).json({
          success: false, error: `Insufficient wallet balance. You need KES ${totalAmount} but have KES ${wallet.balance}.`, insufficientFunds: true,
        });
      }

      // Debit wallet upfront
      const cartRef = `WALLET-CART-${Date.now()}`;
      await storage.debitWallet(customerId, totalAmount, `Cart purchase (${lines.length} item${lines.length > 1 ? "s" : ""})`, cartRef);

      const planNames: string[] = [];
      let refundAmount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const reference = `${cartRef}-${i}`;
        const tx = await storage.createTransaction({
          reference, planId: line.planId, planName: line.planName,
          customerEmail: customer.email, customerName: customerName || customer.name || "Customer",
          amount: line.price, status: "pending", emailSent: false, accountAssigned: false,
        });
        const delivery = await deliverAccount(tx);
        if (delivery.success) {
          planNames.push(line.planName);
        } else {
          refundAmount += line.price;
          await storage.updateTransaction(reference, { status: "failed" });
        }
      }

      // Refund any failed deliveries
      if (refundAmount > 0) {
        await storage.creditWallet(customerId, refundAmount, `Partial refund — ${lines.length - planNames.length} item(s) could not be delivered`, cartRef);
      }

      if (planNames.length === 0) {
        return res.json({ success: false, error: "All items failed to deliver. Your wallet has been fully refunded." });
      }

      res.json({ success: true, planNames, delivered: planNames.length, total: lines.length, refundAmount });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Customer: PDF Receipt ────────────────────────────────────────────────
  app.get("/api/customer/orders/:reference/receipt", customerAuthMiddleware, async (req: any, res) => {
    try {
      const { reference } = req.params;
      const customer = await storage.getCustomerById(req.customer.id);
      if (!customer) return res.status(404).json({ success: false, error: "Not found" });

      const transaction = await storage.getTransaction(reference);
      if (!transaction || transaction.customerEmail !== customer.email) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }
      if (transaction.status !== "success") {
        return res.status(400).json({ success: false, error: "Receipt only available for completed orders" });
      }

      const { siteName } = getAppConfig();
      const receiptNum = `RCT-${reference.slice(-8).toUpperCase()}`;
      const storeBase = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : (getAppConfig() as any).customDomain
          ? `https://${(getAppConfig() as any).customDomain}`
          : "";
      const verifyUrl = `${storeBase}/api/receipt/verify/${reference}`;

      const QRCode = await import("qrcode");
      const qrBuffer = await QRCode.default.toBuffer(verifyUrl, { margin: 1, width: 100 });

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="receipt-${reference}.pdf"`);
      doc.pipe(res);

      doc.rect(0, 0, doc.page.width, 100).fill("#4F46E5");
      doc.fillColor("#ffffff").fontSize(24).font("Helvetica-Bold").text(siteName, 50, 30);
      doc.fontSize(10).font("Helvetica").text("Payment Receipt", 50, 60);
      doc.fontSize(9).fillColor("rgba(255,255,255,0.7)").text(`Receipt No: ${receiptNum}`, 50, 76);

      doc.fillColor("#1f2937").fontSize(18).font("Helvetica-Bold").text("RECEIPT", 50, 120);
      doc.fontSize(10).font("Helvetica").fillColor("#6b7280")
        .text(`Reference: ${reference}`, 50, 145)
        .text(`Date: ${new Date(transaction.createdAt || Date.now()).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}`, 50, 160);

      doc.moveTo(50, 185).lineTo(545, 185).strokeColor("#e5e7eb").lineWidth(1).stroke();

      doc.fillColor("#1f2937").fontSize(13).font("Helvetica-Bold").text("Customer Details", 50, 200);
      doc.fontSize(10).font("Helvetica").fillColor("#374151")
        .text(`Name: ${transaction.customerName || customer.name || "Customer"}`, 50, 220)
        .text(`Email: ${transaction.customerEmail}`, 50, 235);

      doc.moveTo(50, 255).lineTo(545, 255).strokeColor("#e5e7eb").stroke();

      doc.fillColor("#1f2937").fontSize(13).font("Helvetica-Bold").text("Order Details", 50, 270);
      doc.rect(50, 290, 495, 36).fill("#f3f4f6");
      doc.fillColor("#374151").fontSize(10).font("Helvetica-Bold")
        .text("Description", 60, 301).text("Amount", 460, 301);
      doc.fillColor("#374151").fontSize(10).font("Helvetica")
        .text(transaction.planName, 60, 328)
        .text(`KES ${(transaction.amount || 0).toLocaleString()}`, 460, 328);

      doc.moveTo(50, 355).lineTo(545, 355).strokeColor("#e5e7eb").stroke();
      doc.rect(380, 365, 165, 40).fill("#4F46E5");
      doc.fillColor("#ffffff").fontSize(12).font("Helvetica-Bold")
        .text("TOTAL PAID", 390, 373).text(`KES ${(transaction.amount || 0).toLocaleString()}`, 460, 373);

      if (transaction.expiresAt) {
        doc.fillColor("#374151").fontSize(10).font("Helvetica")
          .text(`Subscription expires: ${new Date(transaction.expiresAt).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}`, 50, 420);
      }

      // ── Verification section ──────────────────────────────────────────────
      const verifyY = 450;
      doc.rect(50, verifyY, 495, 110).fill("#f0fdf4").stroke("#d1fae5");
      doc.image(qrBuffer, 430, verifyY + 8, { width: 94, height: 94 });
      doc.fillColor("#065f46").fontSize(10).font("Helvetica-Bold")
        .text("✓ VERIFIED AUTHENTIC RECEIPT", 60, verifyY + 12);
      doc.fillColor("#374151").fontSize(8).font("Helvetica")
        .text("Scan the QR code or visit the link below to verify this receipt online:", 60, verifyY + 30, { width: 355 });
      doc.fillColor("#4F46E5").fontSize(8).font("Helvetica")
        .text(verifyUrl, 60, verifyY + 55, { width: 355 });
      doc.fillColor("#6b7280").fontSize(8).font("Helvetica")
        .text(`Receipt No: ${receiptNum}`, 60, verifyY + 80);

      doc.moveTo(50, doc.page.height - 80).lineTo(545, doc.page.height - 80).strokeColor("#e5e7eb").stroke();
      doc.fillColor("#9ca3af").fontSize(9).font("Helvetica")
        .text("Thank you for your purchase! For support, contact us via WhatsApp or email.", 50, doc.page.height - 65, { align: "center" });
      doc.end();
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Announcements ────────────────────────────────────────────────────────
  function getAnnouncements(): any[] {
    try { return JSON.parse(dbSettingsGet("announcements") || "[]"); } catch { return []; }
  }
  function saveAnnouncements(list: any[]) { dbSettingsSet("announcements", JSON.stringify(list)); }

  app.get("/api/announcements", (req, res) => {
    const now = new Date();
    const active = getAnnouncements().filter((a: any) => !a.expiresAt || new Date(a.expiresAt) > now);
    res.json({ announcements: active });
  });

  app.post("/api/admin/announcements", adminAuthMiddleware, (req, res) => {
    const { title, message, type = "info", expiresAt, link, linkLabel } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, error: "Title and message are required." });
    const list = getAnnouncements();
    const ann = { id: `ann-${Date.now()}`, title, message, type, expiresAt: expiresAt || null, link: link || null, linkLabel: linkLabel || null, createdAt: new Date().toISOString() };
    list.unshift(ann);
    saveAnnouncements(list);
    res.json({ success: true, announcement: ann });
  });

  app.delete("/api/admin/announcements/:id", adminAuthMiddleware, (req, res) => {
    const list = getAnnouncements().filter((a: any) => a.id !== req.params.id);
    saveAnnouncements(list);
    res.json({ success: true });
  });

  app.get("/api/admin/announcements", adminAuthMiddleware, (req, res) => {
    res.json({ announcements: getAnnouncements() });
  });

  // ─── Waitlist ─────────────────────────────────────────────────────────────
  function getWaitlist(): any[] {
    try { return JSON.parse(dbSettingsGet("waitlist") || "[]"); } catch { return []; }
  }
  function saveWaitlist(list: any[]) { dbSettingsSet("waitlist", JSON.stringify(list)); }

  app.post("/api/waitlist", async (req, res) => {
    try {
      const { email, planId } = req.body;
      if (!email || !planId) return res.status(400).json({ success: false, error: "Email and planId are required." });
      const list = getWaitlist();
      const existing = list.find((w: any) => w.email.toLowerCase() === email.toLowerCase() && w.planId === planId);
      if (existing) return res.json({ success: true, alreadyJoined: true });
      const categories = buildPlansResponse();
      let planName = planId;
      for (const cat of Object.values(categories) as any[]) {
        if (cat.plans[planId]) { planName = cat.plans[planId].name; break; }
      }
      list.push({ id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, email, planId, planName, joinedAt: new Date().toISOString() });
      saveWaitlist(list);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.get("/api/admin/waitlist", adminAuthMiddleware, (req, res) => {
    const list = getWaitlist();
    res.json({ waitlist: list, total: list.length });
  });

  app.delete("/api/admin/waitlist/:id", adminAuthMiddleware, (req, res) => {
    const list = getWaitlist().filter((w: any) => w.id !== req.params.id);
    saveWaitlist(list);
    res.json({ success: true });
  });

  app.post("/api/admin/waitlist/notify/:planId", adminAuthMiddleware, async (req, res) => {
    try {
      const { planId } = req.params;
      const list = getWaitlist().filter((w: any) => w.planId === planId);
      if (!list.length) return res.json({ success: true, notified: 0 });
      const categories = buildPlansResponse();
      let plan: any = null;
      for (const cat of Object.values(categories) as any[]) {
        if (cat.plans[planId]) { plan = cat.plans[planId]; break; }
      }
      const planName = plan?.name || planId;
      const storeUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "";
      const { Resend } = await import("resend");
      const key = getResendApiKey();
      let notified = 0;
      if (key && !key.startsWith("re_xxx")) {
        const resend = new Resend(key);
        const fromAddr = getResendFrom() || "onboarding@resend.dev";
        for (const entry of list) {
          const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f0f4f8;margin:0;padding:0">
          <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)">
            <div style="background:linear-gradient(135deg,#4169E1 0%,#7C3AED 100%);padding:28px;text-align:center">
              <p style="font-size:32px;margin:0 0 8px">🎉</p>
              <h1 style="color:#fff;margin:0;font-size:20px">Back in Stock!</h1>
            </div>
            <div style="padding:28px">
              <p style="color:#333;font-size:15px">Good news! <strong>${planName}</strong> is now available again.</p>
              <p style="color:#555;font-size:14px">You joined the waitlist and we wanted you to be the first to know. Grab your spot before it sells out!</p>
              <a href="${storeUrl}" style="display:inline-block;background:#4169E1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px">Shop Now →</a>
            </div>
            <div style="background:#F9FAFB;padding:14px;text-align:center;border-top:1px solid #F3F4F6">
              <p style="font-size:11px;color:#aaa;margin:0">&copy; ${new Date().getFullYear()} Chege Tech</p>
            </div>
          </div></body></html>`;
          await resend.emails.send({ from: `Chege Tech <${fromAddr}>`, to: entry.email, subject: `✅ ${planName} is back in stock!`, html }).catch(() => {});
          notified++;
        }
      }
      res.json({ success: true, notified });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // ─── Admin: CSV Exports ───────────────────────────────────────────────────
  function toCSV(headers: string[], rows: any[][]): string {
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  }

  app.get("/api/admin/export/customers", adminAuthMiddleware, async (_req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      const csv = toCSV(
        ["ID", "Email", "Name", "Email Verified", "Suspended", "Created At"],
        customers.map((c: any) => [c.id, c.email, c.name || "", c.emailVerified ? "Yes" : "No", c.suspended ? "Yes" : "No", c.createdAt || ""])
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=customers.csv");
      res.send(csv);
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.get("/api/admin/export/orders", adminAuthMiddleware, async (_req, res) => {
    try {
      const txs = await storage.getAllTransactions();
      const csv = toCSV(
        ["Reference", "Plan", "Customer Email", "Customer Name", "Amount (KES)", "Status", "Email Sent", "Expires At", "Created At"],
        txs.map((t: any) => [t.reference, t.planName, t.customerEmail, t.customerName || "", t.amount, t.status, t.emailSent ? "Yes" : "No", t.expiresAt || "", t.createdAt || ""])
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
      res.send(csv);
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.get("/api/admin/export/transactions", adminAuthMiddleware, async (_req, res) => {
    try {
      const txs = await storage.getAllTransactions();
      const success = txs.filter((t: any) => t.status === "success");
      const csv = toCSV(
        ["Reference", "Plan", "Customer Email", "Amount (KES)", "Expires At", "Date"],
        success.map((t: any) => [t.reference, t.planName, t.customerEmail, t.amount, t.expiresAt || "", t.createdAt || ""])
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=transactions.csv");
      res.send(csv);
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // ─── Admin: Affiliate Tier Config ─────────────────────────────────────────
  app.get("/api/admin/affiliate-tiers", adminAuthMiddleware, (_req, res) => {
    const raw = dbSettingsGet("affiliate_tiers");
    const tiers = raw ? JSON.parse(raw) : [
      { name: "Silver", min: 5, multiplier: 1.25 },
      { name: "Gold", min: 15, multiplier: 1.5 },
      { name: "Platinum", min: 30, multiplier: 2.0 },
    ];
    res.json({ success: true, tiers });
  });

  app.put("/api/admin/affiliate-tiers", adminAuthMiddleware, (req, res) => {
    const { tiers } = req.body;
    if (!Array.isArray(tiers)) return res.status(400).json({ success: false, error: "tiers must be an array" });
    dbSettingsSet("affiliate_tiers", JSON.stringify(tiers));
    res.json({ success: true });
  });

  // ─── Customer: Referral Tier ───────────────────────────────────────────────
  app.get("/api/customer/referral/tier", customerAuthMiddleware, async (req: any, res) => {
    try {
      const stats = await storage.getReferralStats(req.customer.id);
      const tier = getAffiliateTier(stats.completedReferrals);
      res.json({ success: true, tier: tier.tier, multiplier: tier.multiplier, label: tier.label, completedReferrals: stats.completedReferrals });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // ─── Admin: Email Campaigns ───────────────────────────────────────────────
  type Campaign = { id: string; name: string; subject: string; body: string; segment: string; status: string; scheduledAt?: string; sentAt?: string; sentCount?: number; createdAt: string };

  function getCampaigns(): Campaign[] {
    try { return JSON.parse(dbSettingsGet("email_campaigns") || "[]"); } catch { return []; }
  }
  function saveCampaigns(c: Campaign[]) { dbSettingsSet("email_campaigns", JSON.stringify(c)); }

  app.get("/api/admin/campaigns", adminAuthMiddleware, (_req, res) => {
    res.json({ success: true, campaigns: getCampaigns() });
  });

  app.post("/api/admin/campaigns", adminAuthMiddleware, async (req, res) => {
    try {
      const { name, subject, body, segment, scheduledAt, sendNow } = req.body;
      if (!subject || !body) return res.status(400).json({ success: false, error: "Subject and body are required" });

      const campaign: Campaign = {
        id: uuidv4(),
        name: name || "Campaign",
        subject,
        body,
        segment: segment || "all",
        status: sendNow ? "sending" : scheduledAt ? "scheduled" : "draft",
        scheduledAt: scheduledAt || undefined,
        createdAt: new Date().toISOString(),
      };

      const all = getCampaigns();
      all.unshift(campaign);
      saveCampaigns(all);
      logAdminAction({ action: `Campaign created: ${campaign.name}`, category: "settings", details: `Segment: ${campaign.segment}, Send now: ${sendNow}`, status: "success" });

      if (sendNow) {
        const { checkScheduledCampaigns } = await import("./cron");
        const allWithSending = getCampaigns();
        const idx = allWithSending.findIndex((c) => c.id === campaign.id);
        if (idx !== -1) allWithSending[idx].scheduledAt = new Date().toISOString();
        saveCampaigns(allWithSending);
        checkScheduledCampaigns().catch(() => {});
      }

      res.json({ success: true, campaign });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.post("/api/admin/campaigns/:id/send", adminAuthMiddleware, async (req, res) => {
    try {
      const campaigns = getCampaigns();
      const idx = campaigns.findIndex((c) => c.id === req.params.id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Campaign not found" });
      campaigns[idx].status = "sending";
      campaigns[idx].scheduledAt = new Date().toISOString();
      saveCampaigns(campaigns);
      const { checkScheduledCampaigns } = await import("./cron");
      checkScheduledCampaigns().catch(() => {});
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.delete("/api/admin/campaigns/:id", adminAuthMiddleware, (req, res) => {
    const all = getCampaigns().filter((c) => c.id !== req.params.id);
    saveCampaigns(all);
    res.json({ success: true });
  });

  // ─── Public: Reseller API ─────────────────────────────────────────────────
  async function resellerApiKeyMiddleware(req: any, res: any, next: any) {
    const apiKey = req.headers["x-api-key"] as string;
    if (!apiKey) return res.status(401).json({ success: false, error: "API key required. Include X-API-Key header." });
    const allKeys = await storage.getAllApiKeys?.() || [];
    const found = allKeys.find((k: any) => k.key === apiKey && k.active);
    if (!found) return res.status(401).json({ success: false, error: "Invalid or inactive API key" });
    const customer = await storage.getCustomerById(found.customerId!);
    if (!customer || customer.suspended) return res.status(403).json({ success: false, error: "Account suspended or not found" });
    req.resellerCustomer = customer;
    next();
  }

  app.get("/api/v1/plans", resellerApiKeyMiddleware, (_req, res) => {
    const categories = buildPlansResponse();
    const plans: any[] = [];
    for (const [catKey, cat] of Object.entries(categories) as any[]) {
      for (const [planId, plan] of Object.entries(cat.plans)) {
        plans.push({ planId, ...(plan as any), category: cat.category, categoryKey: catKey });
      }
    }
    res.json({ success: true, plans });
  });

  app.post("/api/v1/orders", resellerApiKeyMiddleware, async (req: any, res) => {
    try {
      const { planId, customerEmail, customerName } = req.body;
      if (!planId || !customerEmail) return res.status(400).json({ success: false, error: "planId and customerEmail are required" });

      const categories = buildPlansResponse();
      let plan: any = null;
      for (const cat of Object.values(categories) as any[]) {
        if (cat.plans[planId]) { plan = cat.plans[planId]; break; }
      }
      if (!plan) return res.status(400).json({ success: false, error: "Invalid planId" });

      const avail = accountManager.checkAvailability(planId);
      if (!avail.available) return res.status(400).json({ success: false, error: "Plan out of stock", outOfStock: true });

      const wallet = await storage.getWallet(req.resellerCustomer.id);
      if ((wallet.balance || 0) < plan.price) {
        return res.status(402).json({ success: false, error: `Insufficient wallet balance. Need KES ${plan.price}, have KES ${wallet.balance}.`, insufficientFunds: true });
      }

      const reference = `API-${planId.toUpperCase()}-${Date.now()}`;
      const transaction = await storage.createTransaction({
        reference,
        planId,
        planName: plan.name,
        customerEmail,
        customerName: customerName || "Customer",
        amount: plan.price,
        status: "pending",
        emailSent: false,
        accountAssigned: false,
      });

      await storage.debitWallet(req.resellerCustomer.id, plan.price, `API Order: ${plan.name} for ${customerEmail}`, reference);
      const delivery = await deliverAccount(transaction);
      if (!delivery.success) {
        await storage.creditWallet(req.resellerCustomer.id, plan.price, `Refund: ${plan.name} (delivery failed)`, reference);
        return res.status(500).json({ success: false, error: delivery.error });
      }

      res.json({ success: true, reference, planName: plan.name, amount: plan.price, customerEmail, message: "Order placed and credentials sent to customer email." });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // ─── Public: AI Support Chat ─────────────────────────────────────────
  app.post("/api/support/chat", async (req, res) => {
    try {
      const { message, sessionId } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ success: false, error: "Message is required" });
      }
      const sid = sessionId || `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const result = await getAIChatResponse(sid, message);
      res.json({ success: true, response: result.response, sessionId: result.sessionId });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin Monitor Bot ────────────────────────────────────────────────────
  app.get("/api/admin/bot/autolog", adminAuthMiddleware, (_req: any, res: any) => {
    try {
      const { getAutoFixLog, getBotStatus } = require("./admin-bot");
      res.json({ success: true, actions: getAutoFixLog(), status: getBotStatus() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, actions: [] });
    }
  });

  app.get("/api/admin/bot/status", adminAuthMiddleware, (_req: any, res: any) => {
    try {
      res.json({ success: true, response: getAutoStatus() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/admin/bot/scan", adminAuthMiddleware, (_req: any, res: any) => {
    try {
      const threats = runSecurityScan();
      res.json({ success: true, threats, scannedAt: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, threats: [] });
    }
  });

  app.post("/api/admin/bot/ban", adminAuthMiddleware, async (req: any, res: any) => {
    try {
      const { email, reason } = req.body;
      if (!email) return res.status(400).json({ success: false, error: "Email required" });
      const result = await banCustomerByEmail(email, reason || "Flagged by security bot");
      if (result.success) {
        logAdminAction({ action: `Security bot banned: ${email}`, category: "customers", details: reason || "Flagged by security bot — unusual activity", status: "warning" });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/ai-assistant", adminAuthMiddleware, async (req: any, res: any) => {
    try {
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ success: false, error: "Message required" });

      // ── Auto-topup command: topup <email> <amount> ──────────────────────
      const topupMatch = message.trim().match(/^topup\s+(\S+@\S+)\s+(\d+(?:\.\d+)?)/i);
      if (topupMatch) {
        const email = topupMatch[1].toLowerCase();
        const amount = parseFloat(topupMatch[2]);
        const customer = await storage.getCustomerByEmail(email);
        if (!customer) return res.json({ success: true, response: `❌ No customer found with email **${email}**` });
        await storage.creditWallet(customer.id, amount, `Admin bot top-up: KES ${amount}`, `bot-topup-${Date.now()}`);
        const wallet = await storage.getWallet(customer.id);
        return res.json({ success: true, response: `✅ Topped up **${email}** with **KES ${amount}**\n💰 New balance: **KES ${wallet.balance.toLocaleString()}**` });
      }

      // ── Topup all customers: topup all <amount> ─────────────────────────
      const topupAllMatch = message.trim().match(/^topup\s+all\s+(\d+(?:\.\d+)?)/i);
      if (topupAllMatch) {
        const amount = parseFloat(topupAllMatch[1]);
        const allCustomers = await storage.getAllCustomers();
        let count = 0;
        for (const c of allCustomers) {
          await storage.creditWallet(c.id, amount, `Admin bot mass top-up: KES ${amount}`, `bot-topup-all-${Date.now()}-${c.id}`);
          count++;
        }
        return res.json({ success: true, response: `✅ Topped up **${count} customers** each with **KES ${amount}**\n🎉 Mass wallet credit complete!` });
      }

      const response = processAdminCommand(message.trim());
      res.json({ success: true, response });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/admin/ai-assistant/session/:sessionId", adminAuthMiddleware, (_req: any, res: any) => {
    res.json({ success: true });
  });

  // ─── Admin: Full customer profile ────────────────────────────────────────
  app.get("/api/admin/customers/:id/profile", adminAuthMiddleware, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomerById(id);
      if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });
      const [wallet, txs, referralStats, loginLogs, ratings] = await Promise.all([
        storage.getWallet(id),
        storage.getTransactionsByEmail(customer.email),
        storage.getReferralStats(id),
        storage.getLoginLogs ? storage.getLoginLogs(id) : [],
        storage.getAllRatings(100).then((all: any[]) => all.filter((r: any) => r.customerEmail === customer.email)),
      ]);
      res.json({
        success: true,
        customer: {
          id: customer.id, email: customer.email, name: customer.name, avatarUrl: (customer as any).avatarUrl,
          emailVerified: customer.emailVerified, suspended: customer.suspended, totpEnabled: (customer as any).totpEnabled,
          createdAt: (customer as any).createdAt,
        },
        wallet: { balance: wallet.balance },
        orders: txs.slice(0, 20),
        referral: referralStats,
        loginHistory: loginLogs.slice(0, 10),
        ratings,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Feature Requests (customer submits, admin views) ────────────────────
  function getFeatureRequests(): any[] {
    try { return JSON.parse(dbSettingsGet("feature_requests") || "[]"); } catch { return []; }
  }
  function saveFeatureRequests(list: any[]) { dbSettingsSet("feature_requests", JSON.stringify(list)); }

  app.post("/api/customer/feature-requests", customerAuthMiddleware, async (req: any, res: any) => {
    try {
      const { title, description } = req.body;
      if (!title?.trim()) return res.status(400).json({ success: false, error: "Title is required" });
      const all = getFeatureRequests();
      const req_obj = {
        id: Date.now().toString(),
        customerEmail: req.customer.email,
        customerName: req.customer.name || req.customer.email.split("@")[0],
        title: title.trim().slice(0, 120),
        description: (description || "").trim().slice(0, 1000),
        status: "pending" as const,
        votes: 1,
        createdAt: new Date().toISOString(),
      };
      all.unshift(req_obj);
      saveFeatureRequests(all.slice(0, 500));
      res.json({ success: true, request: req_obj });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/customer/feature-requests", customerAuthMiddleware, async (_req: any, res: any) => {
    try {
      const all = getFeatureRequests();
      res.json({ success: true, requests: all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/customer/feature-requests/:id/vote", customerAuthMiddleware, async (req: any, res: any) => {
    try {
      const all = getFeatureRequests();
      const idx = all.findIndex((r: any) => r.id === req.params.id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Not found" });
      all[idx].votes = (all[idx].votes || 1) + 1;
      saveFeatureRequests(all);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/admin/feature-requests", adminAuthMiddleware, (_req: any, res: any) => {
    try {
      const all = getFeatureRequests();
      res.json({ success: true, requests: all });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch("/api/admin/feature-requests/:id", adminAuthMiddleware, (req: any, res: any) => {
    try {
      const { status, adminNote } = req.body;
      const all = getFeatureRequests();
      const idx = all.findIndex((r: any) => r.id === req.params.id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Not found" });
      if (status) all[idx].status = status;
      if (adminNote !== undefined) all[idx].adminNote = adminNote;
      all[idx].updatedAt = new Date().toISOString();
      saveFeatureRequests(all);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/admin/feature-requests/:id", adminAuthMiddleware, (req: any, res: any) => {
    try {
      const all = getFeatureRequests().filter((r: any) => r.id !== req.params.id);
      saveFeatureRequests(all);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Funnel Tracking (public — no auth) ────────────────────────────────────
  app.post("/api/track", async (req, res) => {
    try {
      const { event_type, session_id, plan_id, plan_name, customer_email } = req.body;
      if (!event_type) return res.json({ success: true });
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
      if (dbType === "sqlite") {
        getDb().prepare(
          `INSERT INTO funnel_events (event_type, session_id, plan_id, plan_name, customer_email, ip) VALUES (?,?,?,?,?,?)`
        ).run(event_type, session_id || null, plan_id || null, plan_name || null, customer_email || null, ip);
      }
      res.json({ success: true });
    } catch { res.json({ success: true }); }
  });

  // ─── Admin: Funnel Analytics ────────────────────────────────────────────────
  app.get("/api/admin/funnel", adminAuthMiddleware, (req, res) => {
    try {
      const days = parseInt((req.query.days as string) || "30");
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      if (dbType !== "sqlite") {
        return res.json({ success: true, funnel: [], conversionRate: 0, topPlans: [], dailyPaid: [], days });
      }
      const db = getDb();

      const steps = ["page_view", "plan_view", "checkout_start"] as const;
      const funnel: { step: string; count: number }[] = steps.map(step => {
        const row = db.prepare(
          `SELECT COUNT(DISTINCT COALESCE(session_id, ip, 'anon')) as cnt FROM funnel_events WHERE event_type=? AND created_at >= ?`
        ).get(step, since) as any;
        return { step, count: row?.cnt || 0 };
      });

      const paidRow = db.prepare(
        `SELECT COUNT(*) as cnt FROM transactions WHERE status='paid' AND created_at >= ?`
      ).get(since) as any;
      funnel.push({ step: "checkout_complete", count: paidRow?.cnt || 0 });

      const conversionRate = funnel[0].count > 0
        ? Math.round((funnel[funnel.length - 1].count / funnel[0].count) * 100) : 0;

      const topPlans = db.prepare(
        `SELECT plan_name, COUNT(*) as cnt FROM funnel_events WHERE event_type='plan_view' AND plan_name IS NOT NULL AND created_at >= ? GROUP BY plan_name ORDER BY cnt DESC LIMIT 6`
      ).all(since) as any[];

      const dailyPaid = db.prepare(
        `SELECT date(created_at) as day, COUNT(*) as cnt FROM transactions WHERE status='paid' AND created_at >= ? GROUP BY day ORDER BY day`
      ).all(since) as any[];

      const recentEvents = db.prepare(
        `SELECT event_type, plan_name, ip, created_at FROM funnel_events ORDER BY id DESC LIMIT 30`
      ).all() as any[];

      res.json({ success: true, funnel, conversionRate, topPlans, dailyPaid, recentEvents, days });
    } catch {
      res.json({ success: true, funnel: [], conversionRate: 0, topPlans: [], dailyPaid: [], recentEvents: [], days: 30 });
    }
  });

  // ─── Admin: Customer Groups CRUD ───────────────────────────────────────────
  app.get("/api/admin/customer-groups", adminAuthMiddleware, (_req, res) => {
    try {
      if (dbType !== "sqlite") return res.json({ success: true, groups: [] });
      const db = getDb();
      const groups = db.prepare(`SELECT * FROM customer_groups ORDER BY created_at DESC`).all() as any[];
      const withCounts = groups.map((g: any) => {
        const row = db.prepare(`SELECT COUNT(*) as cnt FROM customers WHERE group_id=?`).get(g.id) as any;
        return { ...g, member_count: row?.cnt || 0 };
      });
      res.json({ success: true, groups: withCounts });
    } catch { res.json({ success: true, groups: [] }); }
  });

  app.post("/api/admin/customer-groups", adminAuthMiddleware, (req, res) => {
    try {
      if (dbType !== "sqlite") return res.status(400).json({ success: false, error: "Not supported" });
      const { name, color, discount_percent, is_banned, description } = req.body;
      if (!name?.trim()) return res.status(400).json({ success: false, error: "Name required" });
      const result = getDb().prepare(
        `INSERT INTO customer_groups (name, color, discount_percent, is_banned, description) VALUES (?,?,?,?,?)`
      ).run(name.trim(), color || "#6366f1", discount_percent || 0, is_banned ? 1 : 0, description || null);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.put("/api/admin/customer-groups/:id", adminAuthMiddleware, (req, res) => {
    try {
      if (dbType !== "sqlite") return res.json({ success: false });
      const { name, color, discount_percent, is_banned, description } = req.body;
      const db = getDb();
      db.prepare(
        `UPDATE customer_groups SET name=?, color=?, discount_percent=?, is_banned=?, description=? WHERE id=?`
      ).run(name, color || "#6366f1", discount_percent || 0, is_banned ? 1 : 0, description || null, req.params.id);
      // Sync banned status: if marked is_banned, suspend all members
      if (is_banned) {
        db.prepare(`UPDATE customers SET suspended=1 WHERE group_id=?`).run(req.params.id);
      } else {
        db.prepare(`UPDATE customers SET suspended=0 WHERE group_id=?`).run(req.params.id);
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.delete("/api/admin/customer-groups/:id", adminAuthMiddleware, (req, res) => {
    try {
      if (dbType !== "sqlite") return res.json({ success: false });
      const db = getDb();
      db.prepare(`UPDATE customers SET group_id=NULL WHERE group_id=?`).run(req.params.id);
      db.prepare(`DELETE FROM customer_groups WHERE id=?`).run(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.patch("/api/admin/customers/:id/group", adminAuthMiddleware, (req, res) => {
    try {
      if (dbType !== "sqlite") return res.json({ success: false });
      const { group_id } = req.body;
      const db = getDb();
      db.prepare(`UPDATE customers SET group_id=? WHERE id=?`).run(group_id || null, req.params.id);
      if (group_id) {
        const grp = db.prepare(`SELECT is_banned FROM customer_groups WHERE id=?`).get(group_id) as any;
        if (grp?.is_banned) db.prepare(`UPDATE customers SET suspended=1 WHERE id=?`).run(req.params.id);
        else db.prepare(`UPDATE customers SET suspended=0 WHERE id=?`).run(req.params.id);
      } else {
        db.prepare(`UPDATE customers SET suspended=0 WHERE id=?`).run(req.params.id);
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.get("/api/admin/customer-groups/:id/members", adminAuthMiddleware, (req, res) => {
    try {
      if (dbType !== "sqlite") return res.json({ success: true, members: [] });
      const members = getDb().prepare(
        `SELECT id, email, name, suspended, created_at FROM customers WHERE group_id=? ORDER BY created_at DESC`
      ).all(req.params.id) as any[];
      res.json({ success: true, members });
    } catch { res.json({ success: true, members: [] }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FLASH SALES
  // ═══════════════════════════════════════════════════════════════════════════

  function getFlashSales(): any[] {
    try { return JSON.parse(dbSettingsGet("flash_sales") || "[]"); } catch { return []; }
  }
  function saveFlashSales(sales: any[]) { dbSettingsSet("flash_sales", JSON.stringify(sales)); }
  function getActiveFlashSales(): any[] {
    const now = new Date();
    return getFlashSales().filter((s: any) => new Date(s.endsAt) > now);
  }

  // Public: get active flash sales (used by store)
  app.get("/api/flash-sales", (_req, res) => {
    try {
      const active = getActiveFlashSales();
      res.json({ success: true, sales: active });
    } catch { res.json({ success: true, sales: [] }); }
  });

  // Admin: get all flash sales
  app.get("/api/admin/flash-sales", adminAuthMiddleware, (_req, res) => {
    try { res.json({ success: true, sales: getFlashSales() }); }
    catch { res.json({ success: true, sales: [] }); }
  });

  // Admin: create flash sale
  app.post("/api/admin/flash-sales", adminAuthMiddleware, (req, res) => {
    try {
      const { planId, planName, discountPct, label, durationHours } = req.body;
      if (!planId || !discountPct || !durationHours) {
        return res.status(400).json({ success: false, error: "planId, discountPct, and durationHours are required" });
      }
      const sale = {
        id: `flash-${Date.now()}`,
        planId,
        planName: planName || planId,
        discountPct: Math.min(99, Math.max(1, parseInt(discountPct))),
        label: label || `🔥 Flash Sale — ${discountPct}% Off`,
        endsAt: new Date(Date.now() + parseFloat(durationHours) * 3600000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      const sales = getFlashSales();
      sales.push(sale);
      saveFlashSales(sales);
      res.json({ success: true, sale });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Admin: delete flash sale
  app.delete("/api/admin/flash-sales/:id", adminAuthMiddleware, (req, res) => {
    try {
      const sales = getFlashSales().filter((s: any) => s.id !== req.params.id);
      saveFlashSales(sales);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Apply flash sale discount at checkout — hook into payment/initialize
  // (Adds flash discount on top of any promo discount — flash is applied first)

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC RECEIPT VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Public: Order tracking ───────────────────────────────────────────────
  app.get("/api/track", async (req, res) => {
    try {
      const reference = ((req.query.reference as string) || "").trim();
      const email     = ((req.query.email     as string) || "").trim();
      if (!reference || !email) {
        return res.status(400).json({ success: false, error: "Reference and email are required" });
      }
      const tx = await storage.getTransaction(reference);
      // Deliberately use the same "not found" message for wrong-email or missing order
      // so bad actors can't enumerate references
      if (!tx || tx.customerEmail.toLowerCase() !== email.toLowerCase()) {
        return res.status(404).json({ success: false, error: "No order found for that reference and email combination. Double-check and try again." });
      }
      res.json({
        success: true,
        order: {
          reference:       tx.reference,
          planName:        tx.planName,
          amount:          tx.amount,
          status:          tx.status,
          createdAt:       tx.createdAt,
          accountAssigned: !!(tx as any).accountAssigned || !!(tx as any).account_assigned,
          emailSent:       !!(tx as any).emailSent      || !!(tx as any).email_sent,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/receipt/verify/:reference", async (req, res) => {
    try {
      const { reference } = req.params;
      const tx = await storage.getTransaction(reference);
      const { siteName } = getAppConfig();

      if (!tx || tx.status !== "success") {
        return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt Not Found — ${siteName}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}.card{background:#1e293b;border-radius:16px;padding:40px;max-width:480px;width:100%;text-align:center;border:1px solid #334155}.icon{font-size:56px;margin-bottom:16px}.title{font-size:22px;font-weight:700;margin-bottom:8px;color:#ef4444}.sub{color:#94a3b8;font-size:15px;line-height:1.5}</style></head><body><div class="card"><div class="icon">❌</div><div class="title">Receipt Not Found</div><p class="sub">This receipt could not be verified. It may be invalid or does not exist.</p></div></body></html>`);
      }

      const receiptNum = `RCT-${reference.slice(-8).toUpperCase()}`;
      const date = new Date(tx.createdAt || Date.now()).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" });
      const expiry = tx.expiresAt ? new Date(tx.expiresAt).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" }) : null;

      return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt Verified — ${siteName}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}.card{background:#1e293b;border-radius:16px;padding:40px;max-width:480px;width:100%;border:1px solid #334155}.header{text-align:center;margin-bottom:28px}.icon{font-size:56px;margin-bottom:12px}.title{font-size:22px;font-weight:700;color:#10b981;margin-bottom:4px}.brand{font-size:14px;color:#64748b}.divider{border:none;border-top:1px solid #334155;margin:20px 0}.row{display:flex;justify-content:space-between;align-items:center;padding:8px 0}.label{color:#94a3b8;font-size:13px}.value{font-weight:600;font-size:14px;text-align:right;max-width:60%}.stamp{display:inline-block;border:2px solid #10b981;border-radius:8px;padding:6px 16px;color:#10b981;font-weight:700;font-size:13px;letter-spacing:1px;margin-top:20px}.footer{text-align:center;margin-top:24px;color:#475569;font-size:12px}</style></head><body><div class="card"><div class="header"><div class="icon">✅</div><div class="title">Receipt Verified</div><div class="brand">${siteName}</div></div><hr class="divider"><div class="row"><span class="label">Receipt No.</span><span class="value">${receiptNum}</span></div><div class="row"><span class="label">Customer</span><span class="value">${tx.customerName || tx.customerEmail}</span></div><div class="row"><span class="label">Plan</span><span class="value">${tx.planName}</span></div><div class="row"><span class="label">Amount Paid</span><span class="value">KES ${(tx.amount || 0).toLocaleString()}</span></div><div class="row"><span class="label">Purchase Date</span><span class="value">${date}</span></div>${expiry ? `<div class="row"><span class="label">Expires</span><span class="value">${expiry}</span></div>` : ""}<div class="row"><span class="label">Reference</span><span class="value" style="font-family:monospace;font-size:12px">${reference}</span></div><div class="row"><span class="label">Status</span><span class="value" style="color:#10b981">✓ Authentic</span></div><div style="text-align:center"><span class="stamp">VERIFIED GENUINE</span></div><div class="footer">This receipt was issued by ${siteName} and is cryptographically linked to the original transaction.</div></div></body></html>`);
    } catch (err: any) {
      res.status(500).send("Error verifying receipt.");
    }
  });

  // ══════════════════════════════════════════════════════════════════��══��═════
  // CUSTOMER BADGES
  // ═══════════════════════════════════════════════════════════════════════════

  const BADGE_DEFS = [
    { id: "verified",        emoji: "✅", name: "Verified Member",  desc: "Email address verified",               rarity: "common" },
    { id: "first_purchase",  emoji: "🛒", name: "First Purchase",   desc: "Completed your first order",           rarity: "common" },
    { id: "wallet_user",     emoji: "👛", name: "Wallet User",      desc: "Topped up your wallet",                rarity: "common" },
    { id: "buyer_5x",        emoji: "🔥", name: "5× Buyer",         desc: "Completed 5 orders",                   rarity: "uncommon" },
    { id: "security_pro",    emoji: "🔒", name: "Security Pro",     desc: "Enabled two-factor authentication",    rarity: "uncommon" },
    { id: "gift_giver",      emoji: "🎁", name: "Gift Giver",       desc: "Gifted a subscription to someone",     rarity: "uncommon" },
    { id: "referral_star",   emoji: "🤝", name: "Referral Star",    desc: "Successfully referred someone",        rarity: "rare" },
    { id: "buyer_10x",       emoji: "💎", name: "Power Buyer",      desc: "Completed 10 orders",                  rarity: "rare" },
    { id: "big_spender",     emoji: "💰", name: "Big Spender",      desc: "Spent over KES 5,000 total",           rarity: "rare" },
    { id: "early_adopter",   emoji: "🌟", name: "Early Adopter",    desc: "Among the first 50 customers",         rarity: "epic" },
    { id: "vip",             emoji: "👑", name: "VIP",              desc: "Spent over KES 15,000 total",          rarity: "epic" },
  ];

  app.get("/api/customer/badges", customerAuthMiddleware, async (req: any, res) => {
    try {
      const customer = await storage.getCustomerById(req.customer.id);
      if (!customer) return res.status(404).json({ success: false, error: "Not found" });

      const txs = await storage.getTransactionsByEmail(customer.email);
      const successful = txs.filter((t: any) => t.status === "success");
      const totalSpend = successful.reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const walletTxs = await storage.getWalletTransactions(req.customer.id);
      const hasTopup = walletTxs.some((w: any) => w.type === "topup" || w.type === "credit");
      const referral = await storage.getReferralByReferrer(req.customer.id);
      const referralStats = referral ? await storage.getReferralStats(req.customer.id) : null;
      const hasGifted = successful.some((t: any) => t.giftEmail);

      const earned: string[] = [];
      if (customer.emailVerified)              earned.push("verified");
      if (successful.length >= 1)             earned.push("first_purchase");
      if (hasTopup)                            earned.push("wallet_user");
      if (successful.length >= 5)             earned.push("buyer_5x");
      if ((customer as any).totpEnabled)       earned.push("security_pro");
      if (hasGifted)                           earned.push("gift_giver");
      if (referralStats && (referralStats as any).total >= 1) earned.push("referral_star");
      if (successful.length >= 10)            earned.push("buyer_10x");
      if (totalSpend >= 5000)                 earned.push("big_spender");
      if (req.customer.id <= 50)              earned.push("early_adopter");
      if (totalSpend >= 15000)               earned.push("vip");

      const badges = BADGE_DEFS.map(b => ({ ...b, earned: earned.includes(b.id) }));
      res.json({ success: true, badges, earnedCount: earned.length, totalCount: BADGE_DEFS.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TELEGRAM ACCOUNT LINKING
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/customer/telegram-code", customerAuthMiddleware, async (req: any, res) => {
    try {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      dbSettingsSet(`tg_link_${code}`, String(req.customer.id));
      // code expires in 10 minutes
      setTimeout(() => {
        const current = dbSettingsGet(`tg_link_${code}`);
        if (current && current !== "used") dbSettingsSet(`tg_link_${code}`, "");
      }, 10 * 60 * 1000);
      res.json({ success: true, code });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/customer/telegram-status", customerAuthMiddleware, async (req: any, res) => {
    try {
      const chatId = dbSettingsGet(`tg_customer_${req.customer.id}`);
      res.json({ success: true, linked: !!chatId, chatId: chatId || null });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/customer/telegram-unlink", customerAuthMiddleware, async (req: any, res) => {
    try {
      const chatId = dbSettingsGet(`tg_customer_${req.customer.id}`);
      if (chatId) {
        dbSettingsSet(`tg_chatid_${chatId}`, "");
        dbSettingsSet(`tg_customer_${req.customer.id}`, "");
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WALLET TOPUP WITH LABEL
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Admin: manually trigger monthly summary emails ────────────────────────
  app.post("/api/admin/cron/monthly-summary", adminAuthMiddleware, superAdminOnly, async (req, res) => {
    try {
      const { email } = req.body;
      const { sendMonthlySummaries } = await import("./cron");
      // Manual trigger uses current-month-to-date window so testing doesn't require waiting for month end
      const sent = await sendMonthlySummaries(email?.trim() || undefined, "current_month");
      res.json({ success: true, sent });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Admin: credit wallet with label (label appears in wallet tx history)
  app.post("/api/admin/customers/:id/wallet/credit", adminAuthMiddleware, requirePermission("customers"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { amount, label } = req.body;
      const amountNum = parseFloat(amount);
      if (!amountNum || amountNum <= 0) return res.status(400).json({ success: false, error: "Invalid amount" });
      const description = label?.trim() ? label.trim() : "Admin wallet credit";
      await storage.creditWallet(id, amountNum, description, `admin-credit-${id}-${Date.now()}`);
      const wallet = await storage.getWallet(id);
      res.json({ success: true, newBalance: wallet?.balance ?? 0 });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RESELLER PLATFORM
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Reseller Auth Middleware ─────────────────────────────────────────────
  async function resellerAuthMiddleware(req: any, res: any, next: any) {
    const token: string =
      req.cookies?.reseller_token ||
      (req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const session = await storage.getResellerSession(token);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (new Date(session.expiresAt) < new Date()) {
      await storage.deleteResellerSession(token);
      return res.status(401).json({ error: "Session expired" });
    }
    const reseller = await storage.getResellerById(session.resellerId);
    if (!reseller) return res.status(401).json({ error: "Unauthorized" });
    if (reseller.suspended) return res.status(403).json({ error: "Account suspended. Contact admin." });
    if (reseller.status !== "approved") return res.status(403).json({ error: "Account not yet approved." });
    req.reseller = reseller;
    next();
  }

  // ─── Public: Submit reseller application ─────────────────────────────────
  app.post("/api/reseller/apply", async (req, res) => {
    try {
      const { name, email, businessName, phone, why } = req.body;
      if (!name || !email) return res.status(400).json({ success: false, error: "Name and email are required" });
      const existing = await storage.getResellerByEmail(email);
      if (existing) return res.status(409).json({ success: false, error: "An application with this email already exists" });
      const reseller = await storage.createReseller({ name, email, businessName, phone, why });
      // Telegram notification
      try {
        const { siteName } = getAppConfig();
        sendTelegramMessage(
          `📋 <b>New Reseller Application</b>\n\nName: <b>${name}</b>\nEmail: <b>${email}</b>\nBusiness: ${businessName || "N/A"}\nPhone: ${phone || "N/A"}\n\nWhy: ${why || "N/A"}\n\n<a href="admin panel">Review in Admin Panel</a>`
        ).catch(() => {});
      } catch (_) {}
      res.json({ success: true, id: reseller.id, message: "Application submitted. We'll review and get back to you." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Reseller Login ───────────────────────────────────────────────────────
  app.post("/api/reseller/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ success: false, error: "Username and password are required" });
      const reseller = await storage.getResellerByUsername(username);
      if (!reseller || !reseller.passwordHash) return res.status(401).json({ success: false, error: "Invalid credentials" });
      const valid = await bcrypt.compare(password, reseller.passwordHash);
      if (!valid) return res.status(401).json({ success: false, error: "Invalid credentials" });
      if (reseller.status !== "approved") return res.status(403).json({ success: false, error: "Account not yet approved" });
      if (reseller.suspended) return res.status(403).json({ success: false, error: "Account suspended" });
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await storage.createResellerSession(reseller.reseller_id || reseller.id, token, expiresAt);
      res.cookie("reseller_token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 3 * 24 * 60 * 60 * 1000 });
      const { passwordHash: _ph, ...safe } = reseller;
      res.json({ success: true, reseller: safe });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Reseller Me ─────────────────────────────────────────────────────────
  app.get("/api/reseller/me", resellerAuthMiddleware, async (req: any, res) => {
    const { passwordHash: _ph, ...safe } = req.reseller;
    res.json({ success: true, reseller: safe });
  });

  // ─── Reseller Logout ──────────────────────────────────────────────────────
  app.post("/api/reseller/logout", async (req: any, res) => {
    try {
      const token = req.cookies?.reseller_token || (req.headers.authorization || "").replace("Bearer ", "");
      if (token) await storage.deleteResellerSession(token);
      res.clearCookie("reseller_token");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Reseller Dashboard ───────────────────────────────────────────────────
  app.get("/api/reseller/dashboard", resellerAuthMiddleware, async (req: any, res) => {
    try {
      const resellerId = req.reseller.id;
      const orders = await storage.getResellerOrders(resellerId);
      const prices = await storage.getResellerPrices(resellerId);
      const successOrders = orders.filter((o: any) => o.status === "success");
      const totalOrders = successOrders.length;
      const priceMap: Record<string, number> = {};
      for (const p of prices) priceMap[p.planId] = p.price;
      let totalEarnings = 0;
      for (const o of successOrders) {
        const resellerPrice = priceMap[o.planId];
        if (resellerPrice) {
          const cats = buildPlansResponse();
          for (const cat of Object.values(cats) as any[]) {
            if (cat.plans[o.planId]) {
              const basePrice = cat.plans[o.planId].price;
              totalEarnings += Math.max(0, resellerPrice - basePrice);
              break;
            }
          }
        }
      }
      const walletBalance = req.reseller.walletBalance;
      res.json({ success: true, totalOrders, totalEarnings, walletBalance });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Reseller Prices ─────────────────────────────────────────────────────
  app.get("/api/reseller/prices", resellerAuthMiddleware, async (req: any, res) => {
    try {
      const prices = await storage.getResellerPrices(req.reseller.id);
      res.json({ success: true, prices });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put("/api/reseller/prices", resellerAuthMiddleware, async (req: any, res) => {
    try {
      const { prices } = req.body;
      if (!Array.isArray(prices)) return res.status(400).json({ success: false, error: "prices must be an array" });
      const cats = buildPlansResponse();
      const basePrices: Record<string, number> = {};
      for (const cat of Object.values(cats) as any[]) {
        for (const [id, plan] of Object.entries(cat.plans || {}) as any[]) {
          basePrices[id] = plan.price;
        }
      }
      for (const entry of prices) {
        const { planId, price } = entry;
        if (!planId || typeof price !== "number") continue;
        const base = basePrices[planId];
        if (base === undefined) continue;
        if (price < base) return res.status(400).json({ success: false, error: `Price for ${planId} must be >= base price (${base})` });
        await storage.setResellerPrice(req.reseller.id, planId, price);
      }
      const updated = await storage.getResellerPrices(req.reseller.id);
      res.json({ success: true, prices: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Reseller Orders ──────────────────────────────────────────────────────
  app.get("/api/reseller/orders", resellerAuthMiddleware, async (req: any, res) => {
    try {
      const orders = await storage.getResellerOrders(req.reseller.id);
      res.json({ success: true, orders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Reseller Wallet ──────────────────────────────────────────────────────
  app.get("/api/reseller/wallet", resellerAuthMiddleware, async (req: any, res) => {
    try {
      const reseller = await storage.getResellerById(req.reseller.id);
      const transactions = await storage.getResellerWalletTransactions(req.reseller.id, 30);
      res.json({ success: true, balance: reseller?.walletBalance ?? 0, transactions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Reseller Withdrawal ──────────────────────────────────────────────────
  app.post("/api/reseller/withdrawal", resellerAuthMiddleware, async (req: any, res) => {
    try {
      const { amount, phone, note } = req.body;
      if (!amount || !phone) return res.status(400).json({ success: false, error: "Amount and phone are required" });
      const amountNum = parseInt(amount);
      if (isNaN(amountNum) || amountNum <= 0) return res.status(400).json({ success: false, error: "Invalid amount" });
      const reseller = await storage.getResellerById(req.reseller.id);
      if (!reseller || reseller.walletBalance < amountNum) {
        return res.status(400).json({ success: false, error: "Insufficient wallet balance" });
      }
      const withdrawal = await storage.createWithdrawalRequest({ resellerId: req.reseller.id, amount: amountNum, phone, note });
      // Telegram notification
      try {
        sendTelegramMessage(
          `💸 <b>New Reseller Withdrawal Request</b>\n\nReseller: <b>${reseller.name}</b> (${reseller.email})\nAmount: <b>KES ${amountNum.toLocaleString()}</b>\nPhone: ${phone}\nNote: ${note || "N/A"}\n\nBalance: KES ${reseller.walletBalance.toLocaleString()}`
        ).catch(() => {});
      } catch (_) {}
      res.json({ success: true, withdrawal });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/reseller/withdrawals", resellerAuthMiddleware, async (req: any, res) => {
    try {
      const withdrawals = await storage.getWithdrawalsByReseller(req.reseller.id);
      res.json({ success: true, withdrawals });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Reseller Profile ─────────────────────────────────────────────────────
  app.get("/api/reseller/profile", resellerAuthMiddleware, async (req: any, res) => {
    const { passwordHash: _ph, ...safe } = req.reseller;
    res.json({ success: true, reseller: safe });
  });

  app.put("/api/reseller/profile", resellerAuthMiddleware, async (req: any, res) => {
    try {
      const { storeName, slug, customDomain, logoUrl } = req.body;
      const updates: Record<string, any> = {};
      if (storeName !== undefined) updates.storeName = storeName;
      if (logoUrl !== undefined) updates.logoUrl = logoUrl;
      if (slug !== undefined) {
        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 60);
        const conflict = await storage.getResellerBySlug(cleanSlug);
        if (conflict && conflict.id !== req.reseller.id) return res.status(409).json({ success: false, error: "Slug already taken" });
        updates.slug = cleanSlug;
      }
      if (customDomain !== undefined) {
        if (customDomain) {
          const existing = await storage.getResellerByDomain(customDomain);
          if (existing && existing.id !== req.reseller.id) return res.status(409).json({ success: false, error: "Custom domain already in use" });
        }
        updates.customDomain = customDomain || null;
      }
      const updated = await storage.updateReseller(req.reseller.id, updates);
      const { passwordHash: _ph, ...safe } = updated;
      res.json({ success: true, reseller: safe });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Public: Storefront (custom domain fallback — no slug in path) ────────
  app.get("/api/storefront", async (req: any, res) => {
    try {
      const slug = req.resellerSlug;
      if (!slug) return res.status(404).json({ success: false, error: "Storefront not found" });
      const reseller = await storage.getResellerBySlug(slug);
      if (!reseller || reseller.status !== "approved" || reseller.suspended) {
        return res.status(404).json({ success: false, error: "Storefront not found" });
      }
      const prices = await storage.getResellerPrices(reseller.id);
      const priceMap: Record<string, number> = {};
      for (const p of prices) priceMap[p.planId] = p.price;
      const cats = buildPlansResponse();
      const storefrontCats: any = {};
      for (const [catKey, cat] of Object.entries(cats) as any[]) {
        const plans: any = {};
        for (const [planId, plan] of Object.entries(cat.plans || {}) as any[]) {
          plans[planId] = { ...plan, price: priceMap[planId] ?? plan.price, basePrice: plan.price };
        }
        storefrontCats[catKey] = { ...cat, plans };
      }
      res.json({
        success: true,
        reseller: { id: reseller.id, storeName: reseller.storeName || reseller.name, slug: reseller.slug, logoUrl: reseller.logoUrl, customDomain: reseller.customDomain },
        categories: storefrontCats,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Public: Storefront ───────────────────────────────────────────────────
  app.get("/api/storefront/:slug", async (req: any, res) => {
    try {
      // Prefer domain-matched slug from middleware; fall back to URL slug
      const slug = req.resellerSlug || req.params.slug;
      const reseller = await storage.getResellerBySlug(slug);
      if (!reseller || reseller.status !== "approved" || reseller.suspended) {
        return res.status(404).json({ success: false, error: "Storefront not found" });
      }
      const prices = await storage.getResellerPrices(reseller.id);
      const priceMap: Record<string, number> = {};
      for (const p of prices) priceMap[p.planId] = p.price;
      const cats = buildPlansResponse();
      const storefrontCats: any = {};
      for (const [catKey, cat] of Object.entries(cats) as any[]) {
        const plans: any = {};
        for (const [planId, plan] of Object.entries(cat.plans || {}) as any[]) {
          plans[planId] = {
            ...plan,
            price: priceMap[planId] ?? plan.price,
            basePrice: plan.price,
          };
        }
        storefrontCats[catKey] = { ...cat, plans };
      }
      res.json({
        success: true,
        reseller: {
          id: reseller.id,
          storeName: reseller.storeName || reseller.name,
          slug: reseller.slug,
          logoUrl: reseller.logoUrl,
          customDomain: reseller.customDomain,
        },
        categories: storefrontCats,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Reseller Applications ────────────────────────────────────────
  app.get("/api/admin/reseller-applications", adminAuthMiddleware, async (_req, res) => {
    try {
      const applications = await storage.getAllResellerApplications();
      res.json({ success: true, applications });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/reseller-applications/:id/approve", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ success: false, error: "username and password are required" });
      const reseller = await storage.getResellerById(id);
      if (!reseller) return res.status(404).json({ success: false, error: "Application not found" });
      const passwordHash = await bcrypt.hash(password, 12);
      const baseSlug = username.toLowerCase().replace(/[^a-z0-9]/g, "-");
      let slug = baseSlug;
      let attempt = 0;
      while (await storage.getResellerBySlug(slug)) {
        slug = `${baseSlug}-${++attempt}`;
      }
      await storage.updateReseller(id, { status: "approved", username, passwordHash, slug, storeName: reseller.businessName || reseller.name });
      res.json({ success: true, message: "Application approved", slug });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/reseller-applications/:id/reject", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateReseller(id, { status: "rejected" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Reseller Management ───────────────────────────────────────────
  app.get("/api/admin/resellers", adminAuthMiddleware, async (_req, res) => {
    try {
      const resellers = await storage.getAllResellers();
      res.json({ success: true, resellers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/admin/resellers/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const reseller = await storage.getResellerById(id);
      if (!reseller) return res.status(404).json({ success: false, error: "Reseller not found" });
      const { passwordHash: _ph, ...safe } = reseller;
      res.json({ success: true, reseller: safe });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/resellers/:id/suspend", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateReseller(id, { suspended: 1 });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/resellers/:id/unsuspend", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateReseller(id, { suspended: 0 });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Admin: Reseller Withdrawals ──────────────────────────────────────────
  app.get("/api/admin/reseller-withdrawals", adminAuthMiddleware, async (_req, res) => {
    try {
      const withdrawals = await storage.getPendingWithdrawals();
      res.json({ success: true, withdrawals });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/reseller-withdrawals/:id/approve", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { adminNote } = req.body;
      const withdrawal = await storage.getWithdrawalById(id);
      if (!withdrawal) return res.status(404).json({ success: false, error: "Withdrawal not found" });
      if (withdrawal.status !== "pending") return res.status(400).json({ success: false, error: "Withdrawal is not pending" });
      await storage.approveWithdrawal(id, adminNote);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/reseller-withdrawals/:id/reject", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { adminNote } = req.body;
      const withdrawal = await storage.getWithdrawalById(id);
      if (!withdrawal) return res.status(404).json({ success: false, error: "Withdrawal not found" });
      if (withdrawal.status !== "pending") return res.status(400).json({ success: false, error: "Withdrawal is not pending" });
      await storage.rejectWithdrawal(id, adminNote);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });


  // ─── CC Checker (mass card check) ────────────────────────────────────────
  app.post("/api/tools/cc/check", async (req, res) => {
    try {
      const { cards } = req.body as { cards: string[] };
      if (!Array.isArray(cards) || cards.length === 0) {
        return res.status(400).json({ success: false, error: "cards array required" });
      }
      const limited = cards.slice(0, 30);
      const results = await Promise.allSettled(
        limited.map(async (card) => {
          const [num, month, year, cvv] = card.trim().split(/[|\/ ]/);
          if (!num) return { card, status: "invalid", error: "bad format" };
          const r = await fetch("https://api.chkr.cc/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
            body: JSON.stringify({ data: `${num}|${month||"01"}|${year||"26"}|${cvv||"000"}` }),
          });
          const d = await r.json() as any;
          return {
            card: `${num}|${month||"01"}|${year||"26"}|${cvv||"000"}`,
            status: d.status === "success" ? "live" : "dead",
            bank: d.bank || "",
            type: d.type || "",
            country: d.country || "",
            raw: d,
          };
        })
      );
      const data = results.map((r, i) =>
        r.status === "fulfilled" ? r.value : { card: limited[i], status: "error", error: String((r as any).reason) }
      );
      res.json({ success: true, results: data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });


  // CC Generator (Luhn) + Checker
  app.post("/api/tools/cc/generate", async (req, res) => {
    try {
      const { bin = "", count = 5, month, year, cvv } = req.body;
      function luhnComplete(partial) {
        while (partial.length < 15) partial += String(Math.floor(Math.random() * 10));
        let sum = 0; let alt = false;
        for (let i = partial.length - 1; i >= 0; i--) {
          let n = parseInt(partial[i]);
          if (alt) { n *= 2; if (n > 9) n -= 9; }
          sum += n; alt = !alt;
        }
        const check = (10 - (sum % 10)) % 10;
        return partial + check;
      }
      const prefix = bin || "4";
      const cards = [];
      const n = Math.min(parseInt(count) || 5, 20);
      for (let i = 0; i < n; i++) {
        const num = luhnComplete(prefix);
        const mm = month || String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
        const yy = year || String(new Date().getFullYear() + 2).slice(-2);
        const cv = cvv || String(Math.floor(Math.random() * 900) + 100);
        cards.push(num + "|" + mm + "|" + yy + "|" + cv);
      }
      res.json({ success: true, cards });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/tools/cc/check", async (req, res) => {
    try {
      const { cards } = req.body;
      if (!Array.isArray(cards) || !cards.length) return res.status(400).json({ success: false, error: "cards array required" });
      const limited = cards.slice(0, 30);
      const results = await Promise.allSettled(
        limited.map(async (card) => {
          const parts = card.trim().split(/[|\/\s]+/);
          const [num, month, year, cvv] = parts;
          if (!num) return { card, status: "invalid" };
          const r = await fetch("https://api.chkr.cc/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
            body: JSON.stringify({ data: num + "|" + (month||"01") + "|" + (year||"26") + "|" + (cvv||"000") }),
          });
          const d = await r.json();
          return { card: num + "|" + (month||"01") + "|" + (year||"26") + "|" + (cvv||"000"), status: d.status === "success" ? "live" : "dead", bank: d.bank||"", type: d.type||"", country: d.country||"" };
        })
      );
      const data = results.map((r, i) => r.status === "fulfilled" ? r.value : { card: limited[i], status: "error", error: String(r.reason) });
      res.json({ success: true, results: data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  registerTradingBotRoutes(app);
  registerBotRoutes(app, adminAuthMiddleware);


  // ── Free Temp Numbers ──────────────────────────────────────────────────────
  app.get("/api/free-numbers", async (req, res) => {
    try {
      const { getFreeNumbers } = await import("./tempNumbers");
      const numbers = await getFreeNumbers();
      res.json({ success: true, numbers, total: numbers.length });
    } catch (e: any) {
      req.log?.error({ err: e }, "free-numbers fetch failed");
      res.json({ success: false, numbers: [], total: 0 });
    }
  });

  app.get("/api/free-numbers/:digits/sms", async (req, res) => {
    try {
      const { getNumberMessages } = await import("./tempNumbers");
      const { digits } = req.params;
      const source = (req.query.source as string) || "sms-online";
      const slug   = (req.query.slug   as string) || digits;
      const messages = await getNumberMessages(digits, source, slug);
      res.json({ success: true, messages });
    } catch (e: any) {
      req.log?.error({ err: e }, "number-sms fetch failed");
      res.json({ success: false, messages: [] });
    }
  });

  return httpServer;
    }
  });

}