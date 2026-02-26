import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { getAdminEmail, getAdminPassword } from "./secrets";
import { dbSettingsGet, dbSettingsSet } from "./storage";

const SETTINGS_KEY = "admin_config";

interface AdminConfig {
  totpSecret: string | null;
  totpSetupComplete: boolean;
}

function readConfig(): AdminConfig {
  try {
    const raw = dbSettingsGet(SETTINGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch { }
  return { totpSecret: null, totpSetupComplete: false };
}

function writeConfig(config: AdminConfig): void {
  dbSettingsSet(SETTINGS_KEY, JSON.stringify(config));
}

export function getAdminCredentials() {
  return {
    email: getAdminEmail(),
    password: getAdminPassword(),
  };
}

export function isSetupComplete(): boolean {
  const config = readConfig();
  return config.totpSetupComplete && !!config.totpSecret;
}

export function getTotpSecret(): string | null {
  return readConfig().totpSecret;
}

export async function generateSetup(): Promise<{ secret: string; qrCodeDataUrl: string; otpauthUrl: string }> {
  const adminEmail = getAdminEmail();
  const generated = speakeasy.generateSecret({
    name: `Premium Subscriptions (${adminEmail})`,
    length: 20,
  });
  const secret = generated.base32;
  const otpauthUrl = generated.otpauth_url || speakeasy.otpauthURL({
    secret,
    label: encodeURIComponent(adminEmail),
    issuer: "Premium Subscriptions Admin",
    encoding: "base32",
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, qrCodeDataUrl, otpauthUrl };
}

export function saveSecret(secret: string): void {
  const config = readConfig();
  config.totpSecret = secret;
  config.totpSetupComplete = true;
  writeConfig(config);
}

export function verifyTotp(token: string): boolean {
  const config = readConfig();
  if (!config.totpSecret) return false;
  return speakeasy.totp.verify({
    secret: config.totpSecret,
    encoding: "base32",
    token,
    window: 2,
  });
}

export function verifyTotpWithSecret(token: string, secret: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 2,
  });
}

export function createAdminToken(): string {
  const { password } = getAdminCredentials();
  const timestamp = Date.now();
  return Buffer.from(`admin:${password}:${timestamp}`).toString("base64");
}

export function validateAdminToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const parts = decoded.split(":");
    if (parts[0] !== "admin") return false;
    const { password } = getAdminCredentials();
    if (parts[1] !== password) return false;
    const timestamp = parseInt(parts[2]);
    const sessionAge = Date.now() - timestamp;
    const maxAge = 24 * 60 * 60 * 1000;
    return sessionAge < maxAge;
  } catch {
    return false;
  }
}

export function adminAuthMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const token = auth.replace("Bearer ", "");
  if (validateAdminToken(token)) return next();
  res.status(401).json({ error: "Unauthorized" });
}
