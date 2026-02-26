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

export function getAdminEmail(): string {
  return getCredentialsOverride().adminEmail || process.env.ADMIN_EMAIL || "admin@example.com";
}

export function getAdminPassword(): string {
  return getCredentialsOverride().adminPassword || process.env.ADMIN_PASSWORD || "admin123";
}

export function getSecretsStatus() {
  const override = getCredentialsOverride();
  const paystackPublicKey = override.paystackPublicKey || process.env.PAYSTACK_PUBLIC_KEY || "";
  const paystackSecretKey = override.paystackSecretKey || process.env.PAYSTACK_SECRET_KEY || "";
  const emailUser = override.emailUser || process.env.EMAIL_USER || "";
  const emailPass = override.emailPass || process.env.EMAIL_PASS || "";
  const adminEmail = override.adminEmail || process.env.ADMIN_EMAIL || "admin@example.com";

  return {
    paystackPublicKey,
    paystackSecretKeySet: !!paystackSecretKey,
    paystackConfigured: !!(paystackPublicKey && paystackSecretKey),
    emailUser,
    emailPassSet: !!emailPass,
    emailConfigured: !!(emailUser && emailPass),
    adminEmail,
    adminPasswordSet: !!(override.adminPassword || process.env.ADMIN_PASSWORD),
    sourceOverride: {
      paystackPublicKey: !!override.paystackPublicKey,
      paystackSecretKey: !!override.paystackSecretKey,
      emailUser: !!override.emailUser,
      emailPass: !!override.emailPass,
      adminEmail: !!override.adminEmail,
      adminPassword: !!override.adminPassword,
    },
  };
}
