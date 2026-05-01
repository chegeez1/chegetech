import { getCredentialsOverride } from "./credentials-store";

export function getPaystackSecretKey(): string {
  return getCredentialsOverride().paystackSecretKey || process.env.PAYSTACK_SECRET_KEY || "";
}

export function getPaystackPublicKey(): string {
  return getCredentialsOverride().paystackPublicKey || process.env.PAYSTACK_PUBLIC_KEY || "";
}

export function getEmailUser(): string {
  return getCredentialsOverride().emailUser || process.env.EMAIL_USER || "";
}

export function getEmailPass(): string {
  return getCredentialsOverride().emailPass || process.env.EMAIL_PASS || "";
}

export function getResendApiKey(): string {
  return getCredentialsOverride().resendApiKey || process.env.RESEND_API_KEY || "";
}

export function getResendFrom(): string {
  return getCredentialsOverride().resendFrom || process.env.RESEND_FROM || "";
}

export function getResendOtpFrom(): string {
  return process.env.RESEND_OTP_FROM || getResendFrom();
}

export function getResendSupportFrom(): string {
  return process.env.RESEND_SUPPORT_FROM || getResendFrom();
}

export function getAdminEmail(): string {
  return getCredentialsOverride().adminEmail || process.env.ADMIN_EMAIL || "admin@example.com";
}

export function getAdminPassword(): string {
  return getCredentialsOverride().adminPassword || process.env.ADMIN_PASSWORD || "admin123";
}

export function getCloudflareApiToken(): string {
  return getCredentialsOverride().cloudflareApiToken || process.env.CLOUDFLARE_API_TOKEN || "";
}

export function getSecretsStatus() {
  const paystackPublicKey  = process.env.PAYSTACK_PUBLIC_KEY  || "";
  const paystackSecretKey  = process.env.PAYSTACK_SECRET_KEY  || "";
  const emailUser          = process.env.EMAIL_USER           || "";
  const emailPass          = process.env.EMAIL_PASS           || "";
  const resendApiKey       = process.env.RESEND_API_KEY       || "";
  const resendFrom         = process.env.RESEND_FROM          || "";
  const adminEmail         = process.env.ADMIN_EMAIL          || "";
  const adminPassword      = process.env.ADMIN_PASSWORD       || "";
  const telegramToken      = process.env.TELEGRAM_BOT_TOKEN   || "";
  const telegramChatId     = process.env.TELEGRAM_CHAT_ID     || "";
  const openaiKey          = process.env.OPENAI_API_KEY       || "";
  const databaseUrl        = process.env.EXTERNAL_DATABASE_URL || "";

  return {
    vars: [
      { key: "ADMIN_EMAIL",           label: "Admin Email",         set: !!adminEmail,        group: "Admin" },
      { key: "ADMIN_PASSWORD",        label: "Admin Password",      set: !!adminPassword,     group: "Admin" },
      { key: "PAYSTACK_PUBLIC_KEY",   label: "Paystack Public Key", set: !!paystackPublicKey, group: "Paystack" },
      { key: "PAYSTACK_SECRET_KEY",   label: "Paystack Secret Key", set: !!paystackSecretKey, group: "Paystack" },
      { key: "RESEND_API_KEY",        label: "Resend API Key",      set: !!resendApiKey,      group: "Email" },
      { key: "RESEND_FROM",           label: "Resend From Address", set: !!resendFrom,         group: "Email" },
      { key: "EMAIL_USER",            label: "Gmail Address (legacy)", set: !!emailUser,       group: "Email" },
      { key: "EMAIL_PASS",            label: "Gmail App Password (legacy)", set: !!emailPass,  group: "Email" },
      { key: "TELEGRAM_BOT_TOKEN",    label: "Telegram Bot Token",  set: !!telegramToken,     group: "Telegram" },
      { key: "TELEGRAM_CHAT_ID",      label: "Telegram Chat ID",    set: !!telegramChatId,    group: "Telegram" },
      { key: "OPENAI_API_KEY",        label: "OpenAI API Key",      set: !!openaiKey,         group: "OpenAI" },
      { key: "EXTERNAL_DATABASE_URL", label: "Database URL",        set: !!databaseUrl,       group: "Database" },
    ],
    paystackConfigured: !!(paystackPublicKey && paystackSecretKey),
    emailConfigured:    !!(resendApiKey),
    paystackPublicKey,
    emailUser,
    adminEmail,
  };
}

export function getHerokuApiKey(): string {
  return process.env.HEROKU_API_KEY || "";
}
