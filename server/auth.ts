import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
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

export interface AdminTokenPayload {
  role: "super" | "subadmin";
  subAdminId?: number;
  secondaryId?: number;
  permissions?: string[];
}

function getTokenSecret(): string {
  const { password } = getAdminCredentials();
  return password + "_chege_admin_secret";
}

function hmacSign(data: string): string {
  return crypto.createHmac("sha256", getTokenSecret()).update(data).digest("hex");
}

export function createAdminToken(payload?: AdminTokenPayload): string {
  const timestamp = Date.now();
  if (payload && payload.role === "subadmin") {
    const data = `subadmin:${payload.subAdminId}:${timestamp}`;
    const sig = hmacSign(data);
    return Buffer.from(`${data}:${sig}`).toString("base64");
  }
  if (payload && payload.role === "super" && payload.secondaryId) {
    const data = `superadmin2:${payload.secondaryId}:${timestamp}`;
    const sig = hmacSign(data);
    return Buffer.from(`${data}:${sig}`).toString("base64");
  }
  const data = `admin:${timestamp}`;
  const sig = hmacSign(data);
  return Buffer.from(`${data}:${sig}`).toString("base64");
}

export function validateAdminToken(token: string): AdminTokenPayload | false {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const maxAge = 3 * 24 * 60 * 60 * 1000;

    if (decoded.startsWith("subadmin:")) {
      const parts = decoded.split(":");
      const subAdminId = parseInt(parts[1]);
      const timestamp = parseInt(parts[2]);
      const sig = parts[3];
      const data = `subadmin:${subAdminId}:${timestamp}`;
      if (hmacSign(data) !== sig) return false;
      if (Date.now() - timestamp >= maxAge) return false;
      return { role: "subadmin", subAdminId };
    }

    if (decoded.startsWith("superadmin2:")) {
      const parts = decoded.split(":");
      const secondaryId = parseInt(parts[1]);
      const timestamp = parseInt(parts[2]);
      const sig = parts[3];
      const data = `superadmin2:${secondaryId}:${timestamp}`;
      if (hmacSign(data) !== sig) return false;
      if (Date.now() - timestamp >= maxAge) return false;
      return { role: "super", secondaryId };
    }

    if (decoded.startsWith("admin:")) {
      const parts = decoded.split(":");
      const timestamp = parseInt(parts[1]);
      const sig = parts[2];
      const data = `admin:${timestamp}`;
      if (hmacSign(data) !== sig) return false;
      if (Date.now() - timestamp >= maxAge) return false;
      return { role: "super" };
    }

    return false;
  } catch {
    return false;
  }
}

// ─── Customer JWT ─────────────────────────────────────────────────────────────

const CUSTOMER_JWT_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function getCustomerJwtSecret(): string {
  const { password } = getAdminCredentials();
  return (process.env.SESSION_SECRET || password) + "_customer_jwt_v1";
}

function b64url(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function hmacCustomer(data: string): string {
  return crypto.createHmac("sha256", getCustomerJwtSecret()).update(data).digest("base64url");
}

export function createCustomerJwt(customerId: number, email: string): string {
  const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const nowSec  = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    sub: customerId,
    email,
    iat: nowSec,
    exp: nowSec + Math.floor(CUSTOMER_JWT_EXPIRY_MS / 1000),
  }));
  const sig = hmacCustomer(`${header}.${payload}`);
  return `${header}.${payload}.${sig}`;
}

export function verifyCustomerJwt(token: string): { customerId: number; email: string } | null {
  try {
    if (!token || !token.includes(".")) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expected = hmacCustomer(`${header}.${payload}`);
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || Math.floor(Date.now() / 1000) > data.exp) return null;
    if (!data.sub || typeof data.sub !== "number") return null;
    return { customerId: data.sub, email: data.email || "" };
  } catch {
    return null;
  }
}

// ─── Refs ──────────────────────────────────────────────────────────────────────

let _storageRef: any = null;
export function setStorageRef(s: any) { _storageRef = s; }

export async function adminAuthMiddleware(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });
  const token = auth.replace("Bearer ", "");
  const payload = validateAdminToken(token);
  if (!payload) return res.status(401).json({ error: "Unauthorized" });

  if (payload.role === "subadmin" && _storageRef && payload.subAdminId) {
    const subAdmin = await _storageRef.getSubAdminById(payload.subAdminId);
    if (!subAdmin || !subAdmin.active) return res.status(401).json({ error: "Account deactivated" });
    req.adminPermissions = subAdmin.permissions;
  } else {
    req.adminPermissions = [];
  }

  req.adminRole = payload.role;
  req.subAdminId = payload.subAdminId;
  req.secondaryId = payload.secondaryId;
  next();
}

export function superAdminOnly(req: any, res: any, next: any) {
  if (req.adminRole !== "super") {
    return res.status(403).json({ success: false, error: "Super admin access required" });
  }
  next();
}

export function primarySuperAdminOnly(req: any, res: any, next: any) {
  if (req.adminRole !== "super" || req.secondaryId) {
    return res.status(403).json({ success: false, error: "Primary super admin access required" });
  }
  next();
}

export function requirePermission(...perms: string[]) {
  return (req: any, res: any, next: any) => {
    if (req.adminRole === "super") return next();
    const hasPermission = perms.some(p => req.adminPermissions?.includes(p));
    if (!hasPermission) return res.status(403).json({ success: false, error: "You don't have permission to access this" });
    next();
  };
}

export async function customerAuthMiddleware(req: any, res: any, next: any) {
  // Cookie-first; fall back to Bearer header for API clients
  const token: string =
    req.cookies?.customer_token ||
    (req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  if (!_storageRef) return res.status(500).json({ error: "Server not ready" });

  // ── JWT path (fast — no DB lookup for token) ──
  const jwtPayload = verifyCustomerJwt(token);
  if (jwtPayload) {
    const customer = await _storageRef.getCustomerById(jwtPayload.customerId);
    if (!customer) return res.status(401).json({ error: "Unauthorized" });
    if (customer.suspended) return res.status(403).json({ error: "Account suspended. Contact support." });
    req.customer = customer;
    return next();
  }

  // ── Legacy UUID session fallback (for existing logged-in users) ──
  const session = await _storageRef.getCustomerSession(token);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (new Date(session.expiresAt) < new Date()) {
    await _storageRef.deleteCustomerSession(token);
    return res.status(401).json({ error: "Session expired" });
  }
  const customer = await _storageRef.getCustomerById(session.customerId);
  if (!customer) return res.status(401).json({ error: "Unauthorized" });
  if (customer.suspended) return res.status(403).json({ error: "Account suspended. Contact support." });
  req.customer = customer;
  next();
}
  