import nodemailer from "nodemailer";
import type { AccountEntry } from "@shared/schema";
import { getEmailUser, getEmailPass } from "./secrets";

function createTransporter() {
  const user = getEmailUser();
  const pass = getEmailPass();
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendAccountEmail(
  customerEmail: string,
  planName: string,
  account: AccountEntry,
  customerName: string
): Promise<{ success: boolean; error?: string }> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("Email service not configured - skipping email");
    return { success: false, error: "Email service not configured" };
  }

  const senderEmail = getEmailUser();

  try {
    const accountRows = [
      account.email ? `<tr><td style="padding:8px 12px;font-weight:600;color:#555;">Email</td><td style="padding:8px 12px;">${account.email}</td></tr>` : "",
      account.username ? `<tr><td style="padding:8px 12px;font-weight:600;color:#555;">Username</td><td style="padding:8px 12px;">${account.username}</td></tr>` : "",
      account.password ? `<tr style="background:#f9f9f9;"><td style="padding:8px 12px;font-weight:600;color:#555;">Password</td><td style="padding:8px 12px;font-family:monospace;font-size:15px;letter-spacing:1px;">${account.password}</td></tr>` : "",
      account.activationCode ? `<tr><td style="padding:8px 12px;font-weight:600;color:#555;">Activation Code</td><td style="padding:8px 12px;font-family:monospace;">${account.activationCode}</td></tr>` : "",
      account.redeemLink ? `<tr style="background:#f9f9f9;"><td style="padding:8px 12px;font-weight:600;color:#555;">Redeem Link</td><td style="padding:8px 12px;"><a href="${account.redeemLink}" style="color:#4169E1;">Click to activate</a></td></tr>` : "",
      account.instructions ? `<tr><td style="padding:8px 12px;font-weight:600;color:#555;">Instructions</td><td style="padding:8px 12px;">${account.instructions}</td></tr>` : "",
    ].filter(Boolean).join("");

    const html = `
<!DOCTYPE html>
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

      <p style="font-size:13px;color:#888;text-align:center;margin:0;">Need help? Reply to this email or contact our support team.</p>
    </div>
    <div style="background:#f8faff;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#aaa;margin:0;">&copy; ${new Date().getFullYear()} Premium Subscriptions. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: `"Premium Subscriptions" <${senderEmail}>`,
      to: customerEmail,
      subject: `Your ${planName} Account Details`,
      html,
    });

    return { success: true };
  } catch (err: any) {
    console.error("Email error:", err.message);
    return { success: false, error: err.message };
  }
}

export async function sendPasswordResetEmail(
  customerEmail: string,
  code: string,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  const transporter = createTransporter();
  if (!transporter) return { success: false, error: "Email service not configured" };
  const senderEmail = getEmailUser();
  try {
    const html = `
<!DOCTYPE html>
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
    </div>
    <div style="background:#f8faff;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#aaa;margin:0;">&copy; ${new Date().getFullYear()} Chege Tech. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
    await transporter.sendMail({
      from: `"Chege Tech" <${senderEmail}>`,
      to: customerEmail,
      subject: `Your Password Reset Code`,
      html,
    });
    return { success: true };
  } catch (err: any) {
    console.error("Password reset email error:", err.message);
    return { success: false, error: err.message };
  }
}

