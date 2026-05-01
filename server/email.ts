import { Resend } from "resend";
import type { AccountEntry } from "@shared/schema";
import { getResendApiKey, getResendFrom, getResendOtpFrom, getResendSupportFrom } from "./secrets";
import { getAppConfig } from "./app-config";

function getSiteUrl(): string {
  const cfg = getAppConfig();
  if (cfg.customDomain) return `https://${cfg.customDomain}`;
  if (cfg.appDomain) return `https://${cfg.appDomain}`;
  return "https://streamvault-premium.site";
}

function siteButton(label = "Visit Our Store"): string {
  const url = getSiteUrl();
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${url}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#4169E1 0%,#7C3AED 100%);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;letter-spacing:.3px;">${label}</a>
  </div>`;
}

function getResend(): Resend | null {
  const key = getResendApiKey();
  if (!key) return null;
  return new Resend(key);
}

function from(addr: string, label = "Chege Tech"): string {
  return addr ? `${label} <${addr}>` : `${label} <onboarding@resend.dev>`;
}

function accountsFrom(): string  { return from(getResendFrom(), "StreamVault Premium"); }
function otpFrom(): string       { return from(getResendOtpFrom(), "StreamVault Premium"); }
function supportFrom(): string   { return from(getResendSupportFrom(), "StreamVault Support"); }

export async function sendAccountEmail(
  customerEmail: string,
  planName: string,
  account: AccountEntry,
  customerName: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.log("[email] Resend not configured — skipping email");
    return { success: false, error: "Email service not configured" };
  }

  const accountRows = [
    account.email ? `<tr><td style="padding:8px 12px;font-weight:600;color:#555;">Email</td><td style="padding:8px 12px;">${account.email}</td></tr>` : "",
    account.username ? `<tr><td style="padding:8px 12px;font-weight:600;color:#555;">Username</td><td style="padding:8px 12px;">${account.username}</td></tr>` : "",
    account.password ? `<tr style="background:#f9f9f9;"><td style="padding:8px 12px;font-weight:600;color:#555;">Password</td><td style="padding:8px 12px;font-family:monospace;font-size:15px;letter-spacing:1px;">${account.password}</td></tr>` : "",
    account.activationCode ? `<tr><td style="padding:8px 12px;font-weight:600;color:#555;">Activation Code</td><td style="padding:8px 12px;font-family:monospace;">${account.activationCode}</td></tr>` : "",
    account.redeemLink ? `<tr style="background:#f9f9f9;"><td style="padding:8px 12px;font-weight:600;color:#555;">Redeem Link</td><td style="padding:8px 12px;"><a href="${account.redeemLink}" style="color:#4169E1;">Click to activate</a></td></tr>` : "",
    account.instructions ? `<tr><td style="padding:8px 12px;font-weight:600;color:#555;">Instructions</td><td style="padding:8px 12px;">${account.instructions}</td></tr>` : "",
  ].filter(Boolean).join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
    <div style="background:linear-gradient(135deg,#4169E1 0%,#7C3AED 100%);padding:36px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0 0 6px;font-size:26px;font-weight:700;">Premium Subscriptions</h1>
      <p style="color:rgba(255,255,255,.85);margin:0;font-size:15px;">Your account details are ready</p>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;color:#333;margin:0 0 8px;">Hello <strong>${customerName || "Valued Customer"}</strong>,</p>
      <p style="font-size:15px;color:#555;margin:0 0 24px;">Thank you for purchasing <strong>${planName}</strong>. Your account details are below — keep them safe!</p>
      <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <div style="background:#4169E1;padding:10px 16px;">
          <span style="color:#fff;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">Account Credentials</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
          ${accountRows || '<tr><td style="padding:16px;color:#888;">Contact support for account details</td></tr>'}
        </table>
      </div>
      <div style="background:#fff8e1;border:1px solid #ffd54f;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="font-weight:700;color:#f57f17;margin:0 0 8px;font-size:14px;">Important Notes</p>
        <ul style="margin:0;padding-left:18px;color:#555;font-size:13px;line-height:1.8;">
          <li>Do not change the account password or email</li>
          <li>Do not share these credentials with others</li>
          <li>This is a shared account — use it respectfully</li>
          <li>Contact support immediately if you face any issues</li>
        </ul>
      </div>
      ${siteButton()}
      <p style="font-size:13px;color:#888;text-align:center;margin:0;">Need help? Reply to this email or contact our support team.</p>
    </div>
    <div style="background:#f8faff;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#aaa;margin:0 0 4px;">&copy; ${new Date().getFullYear()} Premium Subscriptions. All rights reserved.</p>
      <p style="font-size:12px;margin:0;"><a href="${getSiteUrl()}" style="color:#4169E1;text-decoration:none;">Visit our store</a></p>
    </div>
  </div>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: accountsFrom(),
      to: customerEmail,
      subject: `Your ${planName} Account Details`,
      html,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: any) {
    console.error("[email] sendAccountEmail:", err.message);
    return { success: false, error: err.message };
  }
}

export async function sendSuspensionEmail(
  customerEmail: string,
  name?: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: "Email service not configured" };

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:500px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
    <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0 0 6px;font-size:24px;font-weight:700;">Account Suspended</h1>
      <p style="color:rgba(255,255,255,.85);margin:0;font-size:14px;">Chege Tech</p>
    </div>
    <div style="padding:32px;">
      <p style="font-size:15px;color:#333;margin:0 0 8px;">Hello <strong>${name || "there"}</strong>,</p>
      <p style="font-size:14px;color:#555;margin:0 0 20px;">Your Chege Tech account (<strong>${customerEmail}</strong>) has been <strong style="color:#dc2626;">suspended</strong>.</p>
      ${reason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;margin-bottom:20px;"><p style="font-size:13px;color:#991b1b;margin:0;"><strong>Reason:</strong> ${reason}</p></div>` : ""}
      <ul style="margin:0 0 20px;padding-left:18px;color:#555;font-size:13px;line-height:1.8;">
        <li>Access your dashboard or purchased accounts</li>
        <li>Make new purchases</li>
        <li>Use your API keys</li>
      </ul>
      <p style="font-size:13px;color:#888;margin:0;">If you believe this is a mistake, please contact our support team by replying to this email.</p>
    </div>
    <div style="background:#f8faff;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#aaa;margin:0 0 4px;">&copy; ${new Date().getFullYear()} Chege Tech. All rights reserved.</p>
      <p style="font-size:12px;margin:0;"><a href="${getSiteUrl()}" style="color:#4169E1;text-decoration:none;">streamvault-premium.site</a></p>
    </div>
  </div>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({ from: supportFrom(), to: customerEmail, subject: "Your Account Has Been Suspended", html });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: any) {
    console.error("[email] sendSuspensionEmail:", err.message);
    return { success: false, error: err.message };
  }
}

export async function sendUnsuspensionEmail(
  customerEmail: string,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: "Email service not configured" };

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:500px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
    <div style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0 0 6px;font-size:24px;font-weight:700;">Account Restored</h1>
      <p style="color:rgba(255,255,255,.85);margin:0;font-size:14px;">Chege Tech</p>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="font-size:15px;color:#333;margin:0 0 8px;">Hello <strong>${name || "there"}</strong>,</p>
      <p style="font-size:14px;color:#555;margin:0 0 20px;">Your account (<strong>${customerEmail}</strong>) has been <strong style="color:#059669;">unsuspended</strong> and is now fully active again.</p>
      <p style="font-size:14px;color:#555;margin:0 0 8px;">You can now access all your purchases, dashboard, and API keys as before.</p>
      <p style="font-size:13px;color:#888;margin:20px 0 0;">Welcome back!</p>
    </div>
    <div style="background:#f8faff;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#aaa;margin:0;">&copy; ${new Date().getFullYear()} Chege Tech. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({ from: supportFrom(), to: customerEmail, subject: "Your Account Has Been Restored", html });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: any) {
    console.error("[email] sendUnsuspensionEmail:", err.message);
    return { success: false, error: err.message };
  }
}

export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  htmlContent: string
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const resend = getResend();
  if (!resend) return { sent: 0, failed: recipients.length, errors: ["Email service not configured"] };

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
    <div style="background:linear-gradient(135deg,#4169E1 0%,#7C3AED 100%);padding:36px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0 0 6px;font-size:26px;font-weight:700;">Chege Tech</h1>
      <p style="color:rgba(255,255,255,.85);margin:0;font-size:15px;">Premium Subscriptions</p>
    </div>
    <div style="padding:32px;font-size:14px;color:#333;line-height:1.7;">${htmlContent}</div>
    <div style="background:#f8faff;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#aaa;margin:0;">&copy; ${new Date().getFullYear()} Chege Tech. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  let sent = 0, failed = 0;
  const errors: string[] = [];
  for (const email of recipients) {
    try {
      const { error } = await resend.emails.send({ from: supportFrom(), to: email, subject, html });
      if (error) throw new Error(error.message);
      sent++;
    } catch (err: any) {
      failed++;
      errors.push(`${email}: ${err.message}`);
    }
  }
  return { sent, failed, errors };
}

export async function sendPasswordResetEmail(
  customerEmail: string,
  code: string,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: "Email service not configured" };

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:500px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
    <div style="background:linear-gradient(135deg,#4169E1 0%,#7C3AED 100%);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0 0 6px;font-size:24px;font-weight:700;">Password Reset</h1>
      <p style="color:rgba(255,255,255,.85);margin:0;font-size:14px;">Chege Tech</p>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="font-size:15px;color:#333;margin:0 0 8px;">Hello <strong>${name || "there"}</strong>,</p>
      <p style="font-size:14px;color:#555;margin:0 0 28px;">Use the code below to reset your password. It expires in <strong>15 minutes</strong>.</p>
      <div style="background:#f0f4ff;border:2px dashed #4169E1;border-radius:12px;padding:20px 32px;display:inline-block;margin-bottom:28px;">
        <p style="font-size:36px;font-weight:800;letter-spacing:8px;color:#4169E1;margin:0;font-family:monospace;">${code}</p>
      </div>
      <p style="font-size:13px;color:#888;margin:0;">If you didn't request this, you can safely ignore this email.</p>
      ${siteButton("Go to Store")}
    </div>
    <div style="background:#f8faff;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#aaa;margin:0;">&copy; ${new Date().getFullYear()} Chege Tech. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({ from: otpFrom(), to: customerEmail, subject: "Your Password Reset Code", html });
    if (error) throw new Error(error.message);
    return { success: true };
  } catch (err: any) {
    console.error("[email] sendPasswordResetEmail:", err.message);
    return { success: false, error: err.message };
  }
}

export async function sendRawEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({ from: accountsFrom(), to, subject, html });
  } catch (err: any) {
    console.error("[email] sendRawEmail:", err.message);
  }
}


export async function sendPasswordResetLinkEmail(
  customerEmail: string,
  token: string,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: "Email service not configured" };

  const siteUrl = process.env.SITE_URL || "https://streamvault-premium.site";
  const resetUrl = `${siteUrl}/reset-password?token=${token}`;
  const displayName = name || "Customer";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:500px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);">
    <div style="background:linear-gradient(135deg,#4169E1 0%,#7C3AED 100%);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0 0 6px;font-size:24px;font-weight:700;">Reset Your Password</h1>
      <p style="color:rgba(255,255,255,.8);margin:0;font-size:14px;">StreamVault Premium</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;margin:0 0 20px;">Hi <strong>${displayName}</strong>,</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px;">We received a request to reset your password. Click the button below to choose a new password. This link expires in <strong>30 minutes</strong>.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}" style="background:linear-gradient(135deg,#4169E1,#7C3AED);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;display:inline-block;">Reset Password</a>
      </div>
      <p style="color:#6B7280;font-size:13px;margin:20px 0 0;">If the button doesn't work, copy and paste this link:<br><a href="${resetUrl}" style="color:#4169E1;word-break:break-all;">${resetUrl}</a></p>
      <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;">If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const senderEmail = process.env.SENDER_EMAIL || process.env.RESEND_FROM || "noreply@streamvault-premium.site";
    const result = await resend.emails.send({ from: senderEmail, to: customerEmail, subject: "Reset your StreamVault password", html });
    if (result.error) return { success: false, error: result.error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send email" };
  }
}

export async function sendAdminEmail(subject: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const adminTo = process.env.ADMIN_EMAIL || getResendFrom() || "onboarding@resend.dev";
  try {
    await resend.emails.send({ from: supportFrom(), to: adminTo, subject, html });
  } catch (err: any) {
    console.error("[email] sendAdminEmail:", err.message);
  }
}
