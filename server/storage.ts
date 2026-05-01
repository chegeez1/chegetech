import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { eq, desc, sql, and, lt } from "drizzle-orm";
import fs from "fs";
import path from "path";
import {
  transactions, customers, customerSessions, apiKeys,
  type Transaction, type InsertTransaction,
  type Customer, type CustomerSession, type ApiKey,
} from "@shared/schema";

let db: any;
let sqliteInstance: any = null;
let pgPool: any = null;
export let dbType: "sqlite" | "pg" = "sqlite";

const settingsCache: Map<string, string> = new Map();

export function getDb() {
  if (db) return db;
  throw new Error("Database not initialized. Call initializeDatabase() first.");
}

export async function initializeDatabase() {
  // Primary source: environment variable
  let externalDbUrl = process.env.EXTERNAL_DATABASE_URL;

  // Fallback: read the URL saved via the admin panel from SQLite (bootstrap)
  if (!externalDbUrl) {
    try {
      const sqlitePath = path.join(process.cwd(), "data", "database.sqlite");
      if (fs.existsSync(sqlitePath)) {
        const tmpDb = new Database(sqlitePath, { readonly: true });
        const row = tmpDb.prepare("SELECT value FROM settings WHERE key = ?").get("credentials") as any;
        tmpDb.close();
        if (row?.value) {
          const parsed = JSON.parse(row.value);
          if (parsed.externalDatabaseUrl) {
            externalDbUrl = parsed.externalDatabaseUrl;
            console.log("[db] Using database URL from admin settings (bootstrap)");
          }
        }
      }
    } catch { /* ignore — SQLite may not exist yet */ }
  }

  if (externalDbUrl) {
    try {
      const pg = await import("pg");
      const Pool = pg.default?.Pool || pg.Pool;
      pgPool = new Pool({ connectionString: externalDbUrl, ssl: { rejectUnauthorized: false } });

      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          reference TEXT UNIQUE NOT NULL,
          plan_id TEXT NOT NULL,
          plan_name TEXT NOT NULL,
          customer_email TEXT NOT NULL,
          customer_name TEXT,
          amount INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          email_sent BOOLEAN DEFAULT false,
          account_assigned BOOLEAN DEFAULT false,
          paystack_reference TEXT,
          created_at TEXT DEFAULT (NOW()::text),
          updated_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS customers (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          password_hash TEXT,
          email_verified BOOLEAN DEFAULT false,
          verification_code TEXT,
          verification_expires TEXT,
          suspended BOOLEAN DEFAULT false,
          totp_secret TEXT,
          totp_enabled BOOLEAN DEFAULT false,
          password_reset_code TEXT,
          password_reset_expires TEXT,
          avatar_url TEXT,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS customer_sessions (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          created_at TEXT DEFAULT (NOW()::text),
          expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS api_keys (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER,
          key TEXT UNIQUE NOT NULL,
          label TEXT NOT NULL,
          active BOOLEAN DEFAULT true,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS support_tickets (
          id SERIAL PRIMARY KEY,
          token TEXT UNIQUE NOT NULL,
          customer_email TEXT NOT NULL,
          customer_name TEXT,
          subject TEXT,
          status TEXT DEFAULT 'open',
          created_at TEXT DEFAULT (NOW()::text),
          updated_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS support_messages (
          id SERIAL PRIMARY KEY,
          ticket_id INTEGER NOT NULL,
          sender TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS sub_admins (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          password_hash TEXT NOT NULL,
          permissions TEXT NOT NULL DEFAULT '[]',
          active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS wallets (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER NOT NULL UNIQUE,
          balance INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          description TEXT NOT NULL,
          reference TEXT,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS referrals (
          id SERIAL PRIMARY KEY,
          referrer_id INTEGER NOT NULL,
          referral_code TEXT UNIQUE NOT NULL,
          referee_email TEXT,
          status TEXT DEFAULT 'pending',
          reward_amount INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS customer_notifications (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          read INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS login_logs (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER NOT NULL,
          ip TEXT NOT NULL,
          country TEXT,
          country_code TEXT,
          city TEXT,
          isp TEXT,
          user_agent TEXT,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS ratings (
          id SERIAL PRIMARY KEY,
          reference TEXT UNIQUE NOT NULL,
          customer_email TEXT NOT NULL,
          customer_name TEXT,
          plan_id TEXT,
          plan_name TEXT,
          stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
          comment TEXT,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS funnel_events (
          id SERIAL PRIMARY KEY,
          event_type TEXT NOT NULL,
          session_id TEXT,
          plan_id TEXT,
          plan_name TEXT,
          customer_email TEXT,
          ip TEXT,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS customer_groups (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT DEFAULT '#6366f1',
          discount_percent INTEGER DEFAULT 0,
          is_banned BOOLEAN DEFAULT false,
          description TEXT,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS resellers (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          business_name TEXT,
          phone TEXT,
          why TEXT,
          status TEXT DEFAULT 'pending',
          username TEXT UNIQUE,
          password_hash TEXT,
          slug TEXT UNIQUE,
          store_name TEXT,
          custom_domain TEXT,
          logo_url TEXT,
          wallet_balance INTEGER NOT NULL DEFAULT 0,
          suspended INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS reseller_sessions (
          id SERIAL PRIMARY KEY,
          reseller_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          created_at TEXT DEFAULT (NOW()::text),
          expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reseller_prices (
          id SERIAL PRIMARY KEY,
          reseller_id INTEGER NOT NULL,
          plan_id TEXT NOT NULL,
          price INTEGER NOT NULL,
          UNIQUE(reseller_id, plan_id)
        );

        CREATE TABLE IF NOT EXISTS reseller_wallet_transactions (
          id SERIAL PRIMARY KEY,
          reseller_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          description TEXT NOT NULL,
          reference TEXT,
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS reseller_withdrawals (
          id SERIAL PRIMARY KEY,
          reseller_id INTEGER NOT NULL,
          amount INTEGER NOT NULL,
          phone TEXT NOT NULL,
          note TEXT,
          status TEXT DEFAULT 'pending',
          admin_note TEXT,
          created_at TEXT DEFAULT (NOW()::text),
          updated_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS bots (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          repo_url TEXT NOT NULL,
          image_url TEXT,
          price INTEGER NOT NULL DEFAULT 70,
          features TEXT NOT NULL DEFAULT '[]',
          requires_session_id BOOLEAN DEFAULT true,
          requires_db_url BOOLEAN DEFAULT false,
          active BOOLEAN DEFAULT true,
          category TEXT DEFAULT 'general',
          created_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS plan_previews (
          plan_id TEXT PRIMARY KEY,
          media_type TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          media_data TEXT NOT NULL,
          file_name TEXT,
          size_bytes INTEGER DEFAULT 0,
          updated_at TEXT DEFAULT (NOW()::text)
        );

        CREATE TABLE IF NOT EXISTS bot_orders (
          id SERIAL PRIMARY KEY,
          reference TEXT UNIQUE NOT NULL,
          bot_id INTEGER NOT NULL,
          bot_name TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_email TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          session_id TEXT,
          db_url TEXT,
          mode TEXT DEFAULT 'public',
          timezone TEXT DEFAULT 'Africa/Nairobi',
          amount INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          paystack_reference TEXT,
          deployment_notes TEXT,
          created_at TEXT DEFAULT (NOW()::text),
          updated_at TEXT DEFAULT (NOW()::text)
        );
      `);

      // Migrate: add avatar_url column if missing (safe for existing PG DBs)
      await pgPool.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT");
      await pgPool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expires_at TEXT");
      await pgPool.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS group_id INTEGER");
      // Migrate: add device/ip tracking to sessions
      await pgPool.query("ALTER TABLE customer_sessions ADD COLUMN IF NOT EXISTS ip TEXT");
      await pgPool.query("ALTER TABLE customer_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT");
      await pgPool.query("ALTER TABLE customer_sessions ADD COLUMN IF NOT EXISTS device_name TEXT");
      await pgPool.query("ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS render_service_id TEXT");
      await pgPool.query("ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS render_service_url TEXT");
      await pgPool.query("ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS deployed_at TEXT");
        await pgPool.query("ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS env_vars TEXT");
        await pgPool.query("ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS vps_server_id TEXT");
        await pgPool.query("ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS pm2_name TEXT");
        await pgPool.query("ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS expires_at TEXT");
        await pgPool.query("ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS renewal_reminded TEXT");
        await pgPool.query("ALTER TABLE bot_orders ADD COLUMN IF NOT EXISTS deployment_log TEXT");
        await pgPool.query("CREATE TABLE IF NOT EXISTS bot_pings (id SERIAL PRIMARY KEY, bot_order_id INTEGER NOT NULL, pm2_status TEXT NOT NULL, checked_at TEXT DEFAULT (NOW()::text))");
        await pgPool.query(`CREATE TABLE IF NOT EXISTS vps_plans (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          ram TEXT,
          cpu TEXT,
          storage TEXT,
          bandwidth TEXT,
          price_kes INTEGER NOT NULL DEFAULT 0,
          popular BOOLEAN DEFAULT false,
          active BOOLEAN DEFAULT true,
          description TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (NOW()::text)
        )`);
        await pgPool.query(`CREATE TABLE IF NOT EXISTS vps_orders (
          id SERIAL PRIMARY KEY,
          reference TEXT UNIQUE NOT NULL,
          plan_id INTEGER,
          customer_name TEXT NOT NULL,
          customer_email TEXT NOT NULL,
          customer_phone TEXT,
          plan_name TEXT NOT NULL,
          ram TEXT,
          cpu TEXT,
          storage TEXT,
          bandwidth TEXT,
          price_kes INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',
          paystack_reference TEXT,
          assigned_ip TEXT,
          server_username TEXT,
          server_password TEXT,
          ssh_port INTEGER DEFAULT 22,
          os_type TEXT DEFAULT 'ubuntu',
          notes TEXT,
          paid_at TEXT,
          expires_at TEXT,
          created_at TEXT DEFAULT (NOW()::text),
          updated_at TEXT DEFAULT (NOW()::text)
        )`);
        await pgPool.query("ALTER TABLE vps_orders ADD COLUMN IF NOT EXISTS plan_id INTEGER");
        await pgPool.query("ALTER TABLE vps_orders ADD COLUMN IF NOT EXISTS paystack_reference TEXT");
      // Migrate: add reseller_id to transactions
      await pgPool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reseller_id INTEGER");

      const drizzlePgModule = await import("drizzle-orm/node-postgres");
      const drizzlePg = drizzlePgModule.drizzle;
      db = drizzlePg(pgPool);
      dbType = "pg";

      const allSettings = await pgPool.query("SELECT key, value FROM settings");
      for (const row of allSettings.rows) {
        settingsCache.set(row.key, row.value);
      }

      console.log("[db] Connected to PostgreSQL (external), loaded", allSettings.rows.length, "settings");
    } catch (err: any) {
      console.error("[db] PostgreSQL connection failed, falling back to SQLite:", err.message);
      initSqlite();
    }
  } else {
    initSqlite();
  }
}

function initSqlite() {
  dbType = "sqlite";
  const DB_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const DB_PATH = path.join(DB_DIR, "database.sqlite");

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  sqliteInstance = new Database(DB_PATH);
  sqliteInstance.pragma("journal_mode = WAL");
  sqliteInstance.pragma("foreign_keys = ON");
  db = drizzleSqlite(sqliteInstance);

  sqliteInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      plan_id TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_name TEXT,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      email_sent INTEGER DEFAULT 0,
      account_assigned INTEGER DEFAULT 0,
      paystack_reference TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT,
      email_verified INTEGER DEFAULT 0,
      verification_code TEXT,
      verification_expires TEXT,
      suspended INTEGER DEFAULT 0,
      totp_secret TEXT,
      totp_enabled INTEGER DEFAULT 0,
      password_reset_code TEXT,
      password_reset_expires TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      device_name TEXT
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      customer_email TEXT NOT NULL,
      customer_name TEXT,
      subject TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sub_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT '[]',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL UNIQUE,
      balance INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL,
      reference TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      referral_code TEXT UNIQUE NOT NULL,
      referee_email TEXT,
      status TEXT DEFAULT 'pending',
      reward_amount INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      ip TEXT NOT NULL,
      country TEXT,
      country_code TEXT,
      city TEXT,
      isp TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      customer_email TEXT NOT NULL,
      customer_name TEXT,
      plan_id TEXT,
      plan_name TEXT,
      stars INTEGER NOT NULL,
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS funnel_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      session_id TEXT,
      plan_id TEXT,
      plan_name TEXT,
      customer_email TEXT,
      ip TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      discount_percent INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      business_name TEXT,
      phone TEXT,
      why TEXT,
      status TEXT DEFAULT 'pending',
      username TEXT UNIQUE,
      password_hash TEXT,
      slug TEXT UNIQUE,
      store_name TEXT,
      custom_domain TEXT,
      logo_url TEXT,
      wallet_balance INTEGER NOT NULL DEFAULT 0,
      suspended INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reseller_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reseller_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reseller_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reseller_id INTEGER NOT NULL,
      plan_id TEXT NOT NULL,
      price INTEGER NOT NULL,
      UNIQUE(reseller_id, plan_id)
    );

    CREATE TABLE IF NOT EXISTS reseller_wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reseller_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL,
      reference TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reseller_withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reseller_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      phone TEXT NOT NULL,
      note TEXT,
      status TEXT DEFAULT 'pending',
      admin_note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      repo_url TEXT NOT NULL,
      image_url TEXT,
      price INTEGER NOT NULL DEFAULT 70,
      features TEXT NOT NULL DEFAULT '[]',
      requires_session_id INTEGER DEFAULT 1,
      requires_db_url INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      category TEXT DEFAULT 'general',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bot_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      bot_id INTEGER NOT NULL,
      bot_name TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      session_id TEXT,
      db_url TEXT,
      mode TEXT DEFAULT 'public',
      timezone TEXT DEFAULT 'Africa/Nairobi',
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      paystack_reference TEXT,
      deployment_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  // Migrate: add avatar_url column if missing (safe for existing DBs)
  try { sqliteInstance!.prepare("ALTER TABLE customers ADD COLUMN avatar_url TEXT").run(); } catch {}
  // Migrate: add expires_at to transactions
  try { sqliteInstance!.prepare("ALTER TABLE transactions ADD COLUMN expires_at TEXT").run(); } catch {}
  // Migrate: add group_id to customers
  try { sqliteInstance!.prepare("ALTER TABLE customers ADD COLUMN group_id INTEGER").run(); } catch {}
  // Migrate: add device/ip tracking to sessions
  try { sqliteInstance!.prepare("ALTER TABLE customer_sessions ADD COLUMN ip TEXT").run(); } catch {}
  try { sqliteInstance!.prepare("ALTER TABLE customer_sessions ADD COLUMN user_agent TEXT").run(); } catch {}
  try { sqliteInstance!.prepare("ALTER TABLE customer_sessions ADD COLUMN device_name TEXT").run(); } catch {}
  // Migrate: add reseller_id to transactions
  try { sqliteInstance!.prepare("ALTER TABLE transactions ADD COLUMN reseller_id INTEGER").run(); } catch {}

  try { sqliteInstance!.prepare("ALTER TABLE bot_orders ADD COLUMN render_service_id TEXT").run(); } catch {}
  try { sqliteInstance!.prepare("ALTER TABLE bot_orders ADD COLUMN render_service_url TEXT").run(); } catch {}
  try { sqliteInstance!.prepare("ALTER TABLE bot_orders ADD COLUMN deployed_at TEXT").run(); } catch {}
    try { sqliteInstance!.prepare("ALTER TABLE bot_orders ADD COLUMN env_vars TEXT").run(); } catch {}
    try { sqliteInstance!.prepare("ALTER TABLE bot_orders ADD COLUMN vps_server_id TEXT").run(); } catch {}
    try { sqliteInstance!.prepare("ALTER TABLE bot_orders ADD COLUMN pm2_name TEXT").run(); } catch {}
    try { sqliteInstance!.prepare("ALTER TABLE bot_orders ADD COLUMN expires_at TEXT").run(); } catch {}
    try { sqliteInstance!.prepare("ALTER TABLE bot_orders ADD COLUMN renewal_reminded TEXT").run(); } catch {}
    try { sqliteInstance!.prepare("ALTER TABLE bot_orders ADD COLUMN deployment_log TEXT").run(); } catch {}
    try { sqliteInstance!.prepare("CREATE TABLE IF NOT EXISTS bot_pings (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_order_id INTEGER NOT NULL, pm2_status TEXT NOT NULL, checked_at TEXT DEFAULT (datetime('now')))").run(); } catch {}
  console.log("[db] Connected to SQLite");
}

export async function runQuery(query: string, params: any[] = []): Promise<any[]> {
  if (dbType === "pg" && pgPool) {
    const result = await pgPool.query(query, params);
    return result.rows;
  } else if (sqliteInstance) {
    try {
      const stmt = sqliteInstance.prepare(query);
      const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
      return rows;
    } catch (e: any) {
      throw e;
    }
  }
  throw new Error("No database connection available");
}

export async function runMutation(query: string, params: any[] = []): Promise<void> {
  if (dbType === "pg" && pgPool) {
    await pgPool.query(query, params);
  } else if (sqliteInstance) {
    const stmt = sqliteInstance.prepare(query);
    params.length > 0 ? stmt.run(...params) : stmt.run();
  } else {
    throw new Error("No database connection available");
  }
}

async function migrateJsonToDbAsync() {
  const migrations: { key: string; file: string }[] = [
    { key: "accounts", file: "accounts.json" },
    { key: "admin_config", file: "admin-config.json" },
    { key: "app_config", file: "app-config.json" },
    { key: "credentials", file: "credentials-override.json" },
    { key: "plan_overrides", file: "plan-overrides.json" },
    { key: "custom_plans", file: "custom-plans.json" },
    { key: "promo_codes", file: "promo-codes.json" },
    { key: "delivery_logs", file: "delivery-logs.json" },
    { key: "admin_logs", file: "admin-logs.json" },
  ];

  for (const { key, file } of migrations) {
    const existing = dbSettingsGet(key);
    if (existing) continue;

    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        JSON.parse(raw);
        dbSettingsSet(key, raw);
        if (dbType === "pg" && pgPool) {
          await pgPool.query(
            "INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()::text) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()::text",
            [key, raw]
          );
        }
        console.log(`[db] Migrated ${file} → settings.${key}`);
      } catch (err: any) {
        console.error(`[db] Failed to migrate ${file}:`, err.message);
      }
    }
  }
}

export { migrateJsonToDbAsync as migrateJsonToDb };

// Non-sensitive keys that also persist to a committed JSON file so they
// survive fresh deploys where the SQLite database doesn't exist yet.
const JSON_PERSIST_MAP: Record<string, string> = {
  app_config: "app-config.json",
  promo_codes: "promo-codes.json",
  plan_overrides: "plan-overrides.json",
  custom_plans: "custom-plans.json",
  affiliate_tiers: "affiliate-tiers.json",
};

function persistToJsonFile(key: string, value: string): void {
  const fileName = JSON_PERSIST_MAP[key];
  if (!fileName) return;
  try {
    const dataDir = process.env.DATA_DIR || process.cwd();
    fs.writeFileSync(path.join(dataDir, fileName), value, "utf8");
  } catch { /* non-fatal */ }
}

export function dbSettingsGet(key: string): string | null {
  try {
    if (dbType === "pg") {
      return settingsCache.get(key) || null;
    }
    if (sqliteInstance) {
      const row = sqliteInstance.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
      if (row?.value) return row.value;
    }
    // Fallback: read from committed JSON file if SQLite has no value yet
    const fileName = JSON_PERSIST_MAP[key];
    if (fileName) {
      const dataDir2 = process.env.DATA_DIR || process.cwd();
      const filePath = path.join(dataDir2, fileName);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf8").trim();
        if (raw) return raw;
      }
    }
  } catch {}
  return null;
}

export function dbSettingsSet(key: string, value: string): void {
  try {
    // Always dual-write non-sensitive settings to a JSON file so they survive
    // fresh deploys where the SQLite database doesn't exist yet.
    persistToJsonFile(key, value);

    if (dbType === "pg") {
      settingsCache.set(key, value);
      if (pgPool) {
        pgPool.query(
          "INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()::text) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()::text",
          [key, value]
        ).catch((err: any) => console.error(`[db] PG settings write error for ${key}:`, err.message));
      }
      return;
    }
    if (sqliteInstance) {
      sqliteInstance.prepare(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
      ).run(key, value);
    }
  } catch (err: any) {
    console.error(`[db] settings set error for key=${key}:`, err.message);
  }
}

export interface SupportTicket {
  id: number;
  token: string;
  customerEmail: string;
  customerName: string | null;
  subject: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: number;
  ticketId: number;
  sender: string;
  message: string;
  createdAt: string;
}

export interface SubAdmin {
  id: number;
  email: string;
  name: string | null;
  passwordHash: string;
  permissions: string[];
  active: boolean;
  createdAt: string;
}

export interface IStorage {
  createTransaction(data: InsertTransaction): Promise<Transaction>;
  getTransaction(reference: string): Promise<Transaction | undefined>;
  updateTransaction(reference: string, data: Partial<Transaction>): Promise<Transaction | undefined>;
  getAllTransactions(): Promise<Transaction[]>;
  getStats(): Promise<{ total: number; completed: number; pending: number; revenue: number; emailsSent: number }>;
  getTransactionsByEmail(email: string): Promise<Transaction[]>;

  createCustomer(data: { email: string; name?: string; passwordHash: string; verificationCode: string; verificationExpires: Date }): Promise<Customer>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  getCustomerById(id: number): Promise<Customer | undefined>;
  updateCustomer(id: number, data: Partial<Customer>): Promise<Customer | undefined>;

  createCustomerSession(customerId: number, token: string, expiresAt: Date, meta?: { ip?: string; userAgent?: string; deviceName?: string }): Promise<CustomerSession>;
  getCustomerSession(token: string): Promise<CustomerSession | undefined>;
  getCustomerSessions(customerId: number): Promise<CustomerSession[]>;
  deleteCustomerSession(token: string): Promise<void>;
  deleteCustomerSessionById(id: number, customerId: number): Promise<void>;
  deleteOtherSessions(currentToken: string, customerId: number): Promise<number>;
  deleteExpiredSessions(): Promise<void>;

  getAllCustomers(): Promise<Customer[]>;

  cancelExpiredTransactions(minutesOld?: number): Promise<number>;
  getApiKeyByKey(key: string): Promise<ApiKey | undefined>;

  createApiKey(data: { customerId?: number; key: string; label: string }): Promise<ApiKey>;
  getApiKeysByCustomer(customerId: number): Promise<ApiKey[]>;
  getAllApiKeys(): Promise<ApiKey[]>;
  revokeApiKey(id: number): Promise<void>;
  deleteApiKey(id: number): Promise<void>;

  createTicket(data: { customerEmail: string; customerName?: string; subject?: string }): Promise<SupportTicket>;
  getTicketById(id: number): Promise<SupportTicket | undefined>;
  getTicketByToken(token: string): Promise<SupportTicket | undefined>;
  updateTicket(id: number, data: Partial<SupportTicket>): Promise<SupportTicket | undefined>;
  getOpenTickets(): Promise<SupportTicket[]>;
  getTicketsByEmail(email: string): Promise<SupportTicket[]>;
  addMessage(data: { ticketId: number; sender: string; message: string }): Promise<SupportMessage>;
  getMessages(ticketId: number): Promise<SupportMessage[]>;

  createSubAdmin(data: { email: string; name?: string; passwordHash: string; permissions: string[] }): Promise<SubAdmin>;
  getSubAdminByEmail(email: string): Promise<SubAdmin | undefined>;
  getSubAdminById(id: number): Promise<SubAdmin | undefined>;
  getAllSubAdmins(): Promise<SubAdmin[]>;
  updateSubAdmin(id: number, data: Partial<{ name: string; passwordHash: string; permissions: string[]; active: boolean }>): Promise<SubAdmin | undefined>;
  deleteSubAdmin(id: number): Promise<void>;

  getWallet(customerId: number): Promise<{ balance: number }>;
  creditWallet(customerId: number, amount: number, description: string, reference?: string): Promise<void>;
  debitWallet(customerId: number, amount: number, description: string, reference?: string): Promise<boolean>;
  getWalletTransactions(customerId: number): Promise<Array<{ id: number; type: string; amount: number; description: string; reference: string | null; createdAt: string }>>;

  getReferralByCode(code: string): Promise<{ id: number; referrerId: number; referralCode: string; refereeEmail: string | null; status: string; rewardAmount: number; createdAt: string } | undefined>;
  getReferralByReferrer(referrerId: number): Promise<{ id: number; referrerId: number; referralCode: string; refereeEmail: string | null; status: string; rewardAmount: number; createdAt: string } | undefined>;
  createReferral(referrerId: number, code: string): Promise<void>;
  completeReferral(code: string, refereeEmail: string, rewardAmount: number): Promise<void>;
  getReferralStats(referrerId: number): Promise<{ totalReferrals: number; completedReferrals: number; totalEarned: number; code: string | null }>;

  createReseller(data: { name: string; email: string; businessName?: string; phone?: string; why?: string }): Promise<any>;
  getResellerById(id: number): Promise<any | undefined>;
  getResellerByEmail(email: string): Promise<any | undefined>;
  getResellerBySlug(slug: string): Promise<any | undefined>;
  getResellerByUsername(username: string): Promise<any | undefined>;
  getResellerByDomain(domain: string): Promise<any | undefined>;
  getAllResellers(): Promise<any[]>;
  getAllResellerApplications(): Promise<any[]>;
  updateReseller(id: number, data: Record<string, any>): Promise<any | undefined>;
  createResellerSession(resellerId: number, token: string, expiresAt: Date): Promise<any>;
  getResellerSession(token: string): Promise<any | undefined>;
  deleteResellerSession(token: string): Promise<void>;
  getResellerPrices(resellerId: number): Promise<any[]>;
  setResellerPrice(resellerId: number, planId: string, price: number): Promise<void>;
  creditResellerWallet(resellerId: number, amount: number, description: string, reference?: string): Promise<void>;
  debitResellerWallet(resellerId: number, amount: number, description: string, reference?: string): Promise<boolean>;
  getResellerWalletTransactions(resellerId: number, limit?: number): Promise<any[]>;
  createWithdrawalRequest(data: { resellerId: number; amount: number; phone: string; note?: string }): Promise<any>;
  getWithdrawalsByReseller(resellerId: number): Promise<any[]>;
  getPendingWithdrawals(): Promise<any[]>;
  getWithdrawalById(id: number): Promise<any | undefined>;
  approveWithdrawal(id: number, adminNote?: string): Promise<void>;
  rejectWithdrawal(id: number, adminNote?: string): Promise<void>;
  getResellerOrders(resellerId: number): Promise<any[]>;
}

export class DbStorage implements IStorage {
  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const [result] = await getDb().insert(transactions).values(data).returning();
    return result;
  }

  async getTransaction(reference: string): Promise<Transaction | undefined> {
    const [result] = await getDb().select().from(transactions).where(eq(transactions.reference, reference));
    return result;
  }

  async updateTransaction(reference: string, data: Partial<Transaction>): Promise<Transaction | undefined> {
    const updateData: any = { ...data };
    updateData.updatedAt = new Date().toISOString();
    const [result] = await getDb()
      .update(transactions)
      .set(updateData)
      .where(eq(transactions.reference, reference))
      .returning();
    return result;
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return getDb().select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByEmail(email: string): Promise<Transaction[]> {
    return getDb().select().from(transactions)
      .where(eq(transactions.customerEmail, email))
      .orderBy(desc(transactions.createdAt));
  }

  async getStats() {
    const all = await getDb().select().from(transactions);
    const completed = all.filter((t: any) => t.status === "success");
    return {
      total: all.length,
      completed: completed.length,
      pending: all.filter((t: any) => t.status === "pending").length,
      revenue: completed.reduce((sum: number, t: any) => sum + t.amount, 0),
      emailsSent: all.filter((t: any) => t.emailSent).length,
    };
  }

  async createCustomer(data: { email: string; name?: string; passwordHash: string; verificationCode: string; verificationExpires: Date }): Promise<Customer> {
    const [result] = await getDb().insert(customers).values({
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      emailVerified: false,
      verificationCode: data.verificationCode,
      verificationExpires: data.verificationExpires.toISOString(),
    }).returning();
    return result;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [result] = await getDb().select().from(customers).where(eq(customers.email, email));
    return result;
  }

  async getCustomerById(id: number): Promise<Customer | undefined> {
    const [result] = await getDb().select().from(customers).where(eq(customers.id, id));
    return result;
  }

  async updateCustomer(id: number, data: Partial<Customer>): Promise<Customer | undefined> {
    const updateData: any = { ...data };
    if (updateData.verificationExpires instanceof Date) {
      updateData.verificationExpires = updateData.verificationExpires.toISOString();
    }
    if (updateData.passwordResetExpires instanceof Date) {
      updateData.passwordResetExpires = updateData.passwordResetExpires.toISOString();
    }
    const [result] = await getDb().update(customers).set(updateData).where(eq(customers.id, id)).returning();
    return result;
  }

  async createCustomerSession(
    customerId: number,
    token: string,
    expiresAt: Date,
    meta?: { ip?: string; userAgent?: string; deviceName?: string }
  ): Promise<CustomerSession> {
    const [result] = await getDb().insert(customerSessions).values({
      customerId,
      token,
      expiresAt: expiresAt.toISOString(),
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
      deviceName: meta?.deviceName ?? null,
    }).returning();
    return result;
  }

  async getCustomerSession(token: string): Promise<CustomerSession | undefined> {
    const [result] = await getDb().select().from(customerSessions).where(eq(customerSessions.token, token));
    return result;
  }

  async getCustomerSessions(customerId: number): Promise<CustomerSession[]> {
    return getDb()
      .select()
      .from(customerSessions)
      .where(eq(customerSessions.customerId, customerId))
      .orderBy(desc(customerSessions.createdAt));
  }

  async deleteCustomerSession(token: string): Promise<void> {
    await getDb().delete(customerSessions).where(eq(customerSessions.token, token));
  }

  async deleteCustomerSessionById(id: number, customerId: number): Promise<void> {
    await getDb()
      .delete(customerSessions)
      .where(and(eq(customerSessions.id, id), eq(customerSessions.customerId, customerId)));
  }

  async deleteOtherSessions(currentToken: string, customerId: number): Promise<number> {
    const all = await this.getCustomerSessions(customerId);
    const others = all.filter(s => s.token !== currentToken);
    for (const s of others) {
      await getDb().delete(customerSessions).where(eq(customerSessions.id, s.id));
    }
    return others.length;
  }

  async deleteExpiredSessions(): Promise<void> {
    await getDb().delete(customerSessions);
  }

  async getAllCustomers(): Promise<Customer[]> {
    return getDb().select().from(customers).orderBy(desc(customers.createdAt));
  }

  async cancelExpiredTransactions(minutesOld: number = 10): Promise<number> {
    const all = await getDb().select().from(transactions).where(eq(transactions.status, "pending"));
    const now = Date.now();
    const cutoffMs = minutesOld * 60 * 1000;
    const expiredRefs: string[] = [];
    for (const t of all) {
      if (!t.createdAt) continue;
      const created = new Date(t.createdAt.replace(" ", "T") + (t.createdAt.includes("Z") ? "" : "Z")).getTime();
      if (isNaN(created)) continue;
      if (now - created > cutoffMs) expiredRefs.push(t.reference);
    }
    if (expiredRefs.length === 0) return 0;
    let count = 0;
    for (const ref of expiredRefs) {
      await getDb().update(transactions).set({ status: "cancelled", updatedAt: new Date().toISOString() }).where(eq(transactions.reference, ref));
      count++;
    }
    return count;
  }

  async getApiKeyByKey(key: string): Promise<ApiKey | undefined> {
    const [result] = await getDb().select().from(apiKeys).where(eq(apiKeys.key, key));
    return result;
  }

  async createApiKey(data: { customerId?: number; key: string; label: string }): Promise<ApiKey> {
    const [result] = await getDb().insert(apiKeys).values({
      customerId: data.customerId ?? null,
      key: data.key,
      label: data.label,
      active: true,
    }).returning();
    return result;
  }

  async getApiKeysByCustomer(customerId: number): Promise<ApiKey[]> {
    return getDb().select().from(apiKeys).where(eq(apiKeys.customerId, customerId)).orderBy(desc(apiKeys.createdAt));
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    return getDb().select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }

  async revokeApiKey(id: number): Promise<void> {
    await getDb().update(apiKeys).set({ active: false }).where(eq(apiKeys.id, id));
  }

  async deleteApiKey(id: number): Promise<void> {
    await getDb().delete(apiKeys).where(eq(apiKeys.id, id));
  }

  async createTicket(data: { customerEmail: string; customerName?: string; subject?: string }): Promise<SupportTicket> {
    const token = crypto.randomUUID();
    if (dbType === "pg" && pgPool) {
      const result = await pgPool.query(
        "INSERT INTO support_tickets (token, customer_email, customer_name, subject, status, created_at, updated_at) VALUES ($1, $2, $3, $4, 'open', NOW()::text, NOW()::text) RETURNING *",
        [token, data.customerEmail, data.customerName || null, data.subject || null]
      );
      const row = result.rows[0];
      return { id: row.id, token: row.token, customerEmail: row.customer_email, customerName: row.customer_name, subject: row.subject, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
    }
    const stmt = sqliteInstance!.prepare(
      "INSERT INTO support_tickets (token, customer_email, customer_name, subject) VALUES (?, ?, ?, ?)"
    );
    const info = stmt.run(token, data.customerEmail, data.customerName || null, data.subject || null);
    const row = sqliteInstance!.prepare("SELECT * FROM support_tickets WHERE id = ?").get(info.lastInsertRowid) as any;
    return { id: row.id, token: row.token, customerEmail: row.customer_email, customerName: row.customer_name, subject: row.subject, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async getTicketById(id: number): Promise<SupportTicket | undefined> {
    if (dbType === "pg" && pgPool) {
      const result = await pgPool.query("SELECT * FROM support_tickets WHERE id = $1", [id]);
      if (result.rows.length === 0) return undefined;
      const row = result.rows[0];
      return { id: row.id, token: row.token, customerEmail: row.customer_email, customerName: row.customer_name, subject: row.subject, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
    }
    const row = sqliteInstance!.prepare("SELECT * FROM support_tickets WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return { id: row.id, token: row.token, customerEmail: row.customer_email, customerName: row.customer_name, subject: row.subject, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async getTicketByToken(token: string): Promise<SupportTicket | undefined> {
    if (dbType === "pg" && pgPool) {
      const result = await pgPool.query("SELECT * FROM support_tickets WHERE token = $1", [token]);
      if (result.rows.length === 0) return undefined;
      const row = result.rows[0];
      return { id: row.id, token: row.token, customerEmail: row.customer_email, customerName: row.customer_name, subject: row.subject, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
    }
    const row = sqliteInstance!.prepare("SELECT * FROM support_tickets WHERE token = ?").get(token) as any;
    if (!row) return undefined;
    return { id: row.id, token: row.token, customerEmail: row.customer_email, customerName: row.customer_name, subject: row.subject, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async updateTicket(id: number, data: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    const sets: string[] = [];
    const values: any[] = [];
    if (data.status !== undefined) { sets.push("status"); values.push(data.status); }
    if (data.subject !== undefined) { sets.push("subject"); values.push(data.subject); }
    if (sets.length === 0) return this.getTicketById(id);

    if (dbType === "pg" && pgPool) {
      const setClauses = sets.map((s, i) => `${s} = $${i + 1}`).join(", ");
      values.push(id);
      await pgPool.query(`UPDATE support_tickets SET ${setClauses}, updated_at = NOW()::text WHERE id = $${values.length}`, values);
    } else {
      const setClauses = sets.map((s) => `${s} = ?`).join(", ");
      values.push(id);
      sqliteInstance!.prepare(`UPDATE support_tickets SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    }
    return this.getTicketById(id);
  }

  async getAllTickets(): Promise<SupportTicket[]> {
    if (dbType === "pg" && pgPool) {
      const result = await pgPool.query("SELECT * FROM support_tickets ORDER BY updated_at DESC");
      return result.rows.map((row: any) => ({
        id: row.id, token: row.token, customerEmail: row.customer_email, customerName: row.customer_name, subject: row.subject, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
      }));
    }
    const rows = sqliteInstance!.prepare("SELECT * FROM support_tickets ORDER BY updated_at DESC").all() as any[];
    return rows.map((row: any) => ({
      id: row.id, token: row.token, customerEmail: row.customer_email, customerName: row.customer_name, subject: row.subject, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    }));
  }

  async getOpenTickets(): Promise<SupportTicket[]> {
    if (dbType === "pg" && pgPool) {
      const result = await pgPool.query("SELECT * FROM support_tickets WHERE status IN ('open', 'escalated') ORDER BY updated_at DESC");
      return result.rows.map((row: any) => ({
        id: row.id, token: row.token, customerEmail: row.customer_email, customerName: row.customer_name, subject: row.subject, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
      }));
    }
    const rows = sqliteInstance!.prepare("SELECT * FROM support_tickets WHERE status IN ('open', 'escalated') ORDER BY updated_at DESC").all() as any[];
    return rows.map((row: any) => ({
      id: row.id, token: row.token, customerEmail: row.customer_email, customerName: row.customer_name, subject: row.subject, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    }));
  }

  async getTicketsByEmail(email: string): Promise<SupportTicket[]> {
    if (dbType === "pg" && pgPool) {
      const result = await pgPool.query("SELECT * FROM support_tickets WHERE customer_email = $1 ORDER BY updated_at DESC", [email]);
      return result.rows.map((row: any) => ({
        id: row.id, token: row.token, customerEmail: row.customer_email, customerName: row.customer_name, subject: row.subject, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
      }));
    }
    const rows = sqliteInstance!.prepare("SELECT * FROM support_tickets WHERE customer_email = ? ORDER BY updated_at DESC").all(email) as any[];
    return rows.map((row: any) => ({
      id: row.id, token: row.token, customerEmail: row.customer_email, customerName: row.customer_name, subject: row.subject, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    }));
  }

  async addMessage(data: { ticketId: number; sender: string; message: string }): Promise<SupportMessage> {
    if (dbType === "pg" && pgPool) {
      const result = await pgPool.query(
        "INSERT INTO support_messages (ticket_id, sender, message, created_at) VALUES ($1, $2, $3, NOW()::text) RETURNING *",
        [data.ticketId, data.sender, data.message]
      );
      const row = result.rows[0];
      await pgPool.query("UPDATE support_tickets SET updated_at = NOW()::text WHERE id = $1", [data.ticketId]);
      return { id: row.id, ticketId: row.ticket_id, sender: row.sender, message: row.message, createdAt: row.created_at };
    }
    const stmt = sqliteInstance!.prepare("INSERT INTO support_messages (ticket_id, sender, message) VALUES (?, ?, ?)");
    const info = stmt.run(data.ticketId, data.sender, data.message);
    sqliteInstance!.prepare("UPDATE support_tickets SET updated_at = datetime('now') WHERE id = ?").run(data.ticketId);
    const row = sqliteInstance!.prepare("SELECT * FROM support_messages WHERE id = ?").get(info.lastInsertRowid) as any;
    return { id: row.id, ticketId: row.ticket_id, sender: row.sender, message: row.message, createdAt: row.created_at };
  }

  async getMessages(ticketId: number): Promise<SupportMessage[]> {
    if (dbType === "pg" && pgPool) {
      const result = await pgPool.query("SELECT * FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC", [ticketId]);
      return result.rows.map((row: any) => ({
        id: row.id, ticketId: row.ticket_id, sender: row.sender, message: row.message, createdAt: row.created_at,
      }));
    }
    const rows = sqliteInstance!.prepare("SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC").all(ticketId) as any[];
    return rows.map((row: any) => ({
      id: row.id, ticketId: row.ticket_id, sender: row.sender, message: row.message, createdAt: row.created_at,
    }));
  }
  private mapSubAdmin(row: any): SubAdmin {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      permissions: JSON.parse(row.permissions || "[]"),
      active: row.active === 1 || row.active === true,
      createdAt: row.created_at,
    };
  }

  async createSubAdmin(data: { email: string; name?: string; passwordHash: string; permissions: string[] }): Promise<SubAdmin> {
    const perms = JSON.stringify(data.permissions);
    if (dbType === "pg" && pgPool) {
      const result = await pgPool.query(
        "INSERT INTO sub_admins (email, name, password_hash, permissions, created_at) VALUES ($1, $2, $3, $4, NOW()::text) RETURNING *",
        [data.email, data.name || null, data.passwordHash, perms]
      );
      return this.mapSubAdmin(result.rows[0]);
    }
    const stmt = sqliteInstance!.prepare("INSERT INTO sub_admins (email, name, password_hash, permissions) VALUES (?, ?, ?, ?)");
    const info = stmt.run(data.email, data.name || null, data.passwordHash, perms);
    const row = sqliteInstance!.prepare("SELECT * FROM sub_admins WHERE id = ?").get(info.lastInsertRowid) as any;
    return this.mapSubAdmin(row);
  }

  async getSubAdminByEmail(email: string): Promise<SubAdmin | undefined> {
    if (dbType === "pg" && pgPool) {
      const result = await pgPool.query("SELECT * FROM sub_admins WHERE email = $1", [email]);
      return result.rows[0] ? this.mapSubAdmin(result.rows[0]) : undefined;
    }
    const row = sqliteInstance!.prepare("SELECT * FROM sub_admins WHERE email = ?").get(email) as any;
    return row ? this.mapSubAdmin(row) : undefined;
  }

  async getSubAdminById(id: number): Promise<SubAdmin | undefined> {
    if (dbType === "pg" && pgPool) {
      const result = await pgPool.query("SELECT * FROM sub_admins WHERE id = $1", [id]);
      return result.rows[0] ? this.mapSubAdmin(result.rows[0]) : undefined;
    }
    const row = sqliteInstance!.prepare("SELECT * FROM sub_admins WHERE id = ?").get(id) as any;
    return row ? this.mapSubAdmin(row) : undefined;
  }

  async getAllSubAdmins(): Promise<SubAdmin[]> {
    if (dbType === "pg" && pgPool) {
      const result = await pgPool.query("SELECT * FROM sub_admins ORDER BY created_at DESC");
      return result.rows.map((r: any) => this.mapSubAdmin(r));
    }
    const rows = sqliteInstance!.prepare("SELECT * FROM sub_admins ORDER BY created_at DESC").all() as any[];
    return rows.map((r: any) => this.mapSubAdmin(r));
  }

  async updateSubAdmin(id: number, data: Partial<{ name: string; passwordHash: string; permissions: string[]; active: boolean }>): Promise<SubAdmin | undefined> {
    const sets: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { sets.push("name"); values.push(data.name); }
    if (data.passwordHash !== undefined) { sets.push("password_hash"); values.push(data.passwordHash); }
    if (data.permissions !== undefined) { sets.push("permissions"); values.push(JSON.stringify(data.permissions)); }
    if (data.active !== undefined) { sets.push("active"); values.push(data.active ? 1 : 0); }
    if (sets.length === 0) return this.getSubAdminById(id);

    if (dbType === "pg" && pgPool) {
      const setClauses = sets.map((s, i) => `${s} = $${i + 1}`).join(", ");
      values.push(id);
      await pgPool.query(`UPDATE sub_admins SET ${setClauses} WHERE id = $${values.length}`, values);
    } else {
      const setClauses = sets.map((s) => `${s} = ?`).join(", ");
      values.push(id);
      sqliteInstance!.prepare(`UPDATE sub_admins SET ${setClauses} WHERE id = ?`).run(...values);
    }
    return this.getSubAdminById(id);
  }

  async deleteSubAdmin(id: number): Promise<void> {
    if (dbType === "pg" && pgPool) {
      await pgPool.query("DELETE FROM sub_admins WHERE id = $1", [id]);
    } else {
      sqliteInstance!.prepare("DELETE FROM sub_admins WHERE id = ?").run(id);
    }
  }

  async getWallet(customerId: number): Promise<{ balance: number }> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT balance FROM wallets WHERE customer_id = $1", [customerId]);
      return { balance: r.rows[0]?.balance ?? 0 };
    }
    const row = sqliteInstance!.prepare("SELECT balance FROM wallets WHERE customer_id = ?").get(customerId) as any;
    return { balance: row?.balance ?? 0 };
  }

  async creditWallet(customerId: number, amount: number, description: string, reference?: string): Promise<void> {
    if (dbType === "pg" && pgPool) {
      await pgPool.query(
        "INSERT INTO wallets (customer_id, balance, updated_at) VALUES ($1, $2, NOW()::text) ON CONFLICT(customer_id) DO UPDATE SET balance = wallets.balance + $2, updated_at = NOW()::text",
        [customerId, amount]
      );
      await pgPool.query(
        "INSERT INTO wallet_transactions (customer_id, type, amount, description, reference, created_at) VALUES ($1, 'credit', $2, $3, $4, NOW()::text)",
        [customerId, amount, description, reference || null]
      );
    } else {
      sqliteInstance!.prepare(
        "INSERT INTO wallets (customer_id, balance) VALUES (?, ?) ON CONFLICT(customer_id) DO UPDATE SET balance = balance + ?, updated_at = datetime('now')"
      ).run(customerId, amount, amount);
      sqliteInstance!.prepare(
        "INSERT INTO wallet_transactions (customer_id, type, amount, description, reference) VALUES (?, 'credit', ?, ?, ?)"
      ).run(customerId, amount, description, reference || null);
    }
  }

  async debitWallet(customerId: number, amount: number, description: string, reference?: string): Promise<boolean> {
    const wallet = await this.getWallet(customerId);
    if (wallet.balance < amount) return false;
    if (dbType === "pg" && pgPool) {
      await pgPool.query(
        "UPDATE wallets SET balance = balance - $1, updated_at = NOW()::text WHERE customer_id = $2",
        [amount, customerId]
      );
      await pgPool.query(
        "INSERT INTO wallet_transactions (customer_id, type, amount, description, reference, created_at) VALUES ($1, 'debit', $2, $3, $4, NOW()::text)",
        [customerId, amount, description, reference || null]
      );
    } else {
      sqliteInstance!.prepare(
        "UPDATE wallets SET balance = balance - ?, updated_at = datetime('now') WHERE customer_id = ?"
      ).run(amount, customerId);
      sqliteInstance!.prepare(
        "INSERT INTO wallet_transactions (customer_id, type, amount, description, reference) VALUES (?, 'debit', ?, ?, ?)"
      ).run(customerId, amount, description, reference || null);
    }
    return true;
  }

  async getWalletTransactions(customerId: number): Promise<Array<{ id: number; type: string; amount: number; description: string; reference: string | null; createdAt: string }>> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query(
        "SELECT * FROM wallet_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50",
        [customerId]
      );
      return r.rows.map((row: any) => ({ id: row.id, type: row.type, amount: row.amount, description: row.description, reference: row.reference, createdAt: row.created_at }));
    }
    const rows = sqliteInstance!.prepare(
      "SELECT * FROM wallet_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50"
    ).all(customerId) as any[];
    return rows.map((row: any) => ({ id: row.id, type: row.type, amount: row.amount, description: row.description, reference: row.reference, createdAt: row.created_at }));
  }

  private mapReferral(row: any) {
    return { id: row.id, referrerId: row.referrer_id, referralCode: row.referral_code, refereeEmail: row.referee_email, status: row.status, rewardAmount: row.reward_amount, createdAt: row.created_at };
  }

  async getReferralByCode(code: string) {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM referrals WHERE referral_code = $1", [code]);
      return r.rows[0] ? this.mapReferral(r.rows[0]) : undefined;
    }
    const row = sqliteInstance!.prepare("SELECT * FROM referrals WHERE referral_code = ?").get(code) as any;
    return row ? this.mapReferral(row) : undefined;
  }

  async getReferralByReferrer(referrerId: number) {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM referrals WHERE referrer_id = $1 LIMIT 1", [referrerId]);
      return r.rows[0] ? this.mapReferral(r.rows[0]) : undefined;
    }
    const row = sqliteInstance!.prepare("SELECT * FROM referrals WHERE referrer_id = ? LIMIT 1").get(referrerId) as any;
    return row ? this.mapReferral(row) : undefined;
  }

  async createReferral(referrerId: number, code: string): Promise<void> {
    if (dbType === "pg" && pgPool) {
      await pgPool.query(
        "INSERT INTO referrals (referrer_id, referral_code) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [referrerId, code]
      );
    } else {
      sqliteInstance!.prepare(
        "INSERT OR IGNORE INTO referrals (referrer_id, referral_code) VALUES (?, ?)"
      ).run(referrerId, code);
    }
  }

  async completeReferral(code: string, refereeEmail: string, rewardAmount: number): Promise<void> {
    if (dbType === "pg" && pgPool) {
      await pgPool.query(
        "UPDATE referrals SET status = 'completed', referee_email = $1, reward_amount = $2 WHERE referral_code = $3",
        [refereeEmail, rewardAmount, code]
      );
    } else {
      sqliteInstance!.prepare(
        "UPDATE referrals SET status = 'completed', referee_email = ?, reward_amount = ? WHERE referral_code = ?"
      ).run(refereeEmail, rewardAmount, code);
    }
  }

  async getReferralStats(referrerId: number): Promise<{ totalReferrals: number; completedReferrals: number; totalEarned: number; code: string | null }> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM referrals WHERE referrer_id = $1", [referrerId]);
      const rows = r.rows;
      const completed = rows.filter((rw: any) => rw.status === "completed");
      const myCode = rows[0]?.referral_code || null;
      return { totalReferrals: completed.length, completedReferrals: completed.length, totalEarned: completed.reduce((s: number, rw: any) => s + (rw.reward_amount || 0), 0), code: myCode };
    }
    const rows = sqliteInstance!.prepare("SELECT * FROM referrals WHERE referrer_id = ?").all(referrerId) as any[];
    const completed = rows.filter((rw: any) => rw.status === "completed");
    const myCode = rows[0]?.referral_code || null;
    return { totalReferrals: completed.length, completedReferrals: completed.length, totalEarned: completed.reduce((s: number, rw: any) => s + (rw.reward_amount || 0), 0), code: myCode };
  }

  async createNotification(customerId: number, type: string, title: string, message: string): Promise<void> {
    if (dbType === "pg" && pgPool) {
      await pgPool.query(
        "INSERT INTO customer_notifications (customer_id, type, title, message) VALUES ($1, $2, $3, $4)",
        [customerId, type, title, message]
      );
    } else {
      sqliteInstance!.prepare(
        "INSERT INTO customer_notifications (customer_id, type, title, message) VALUES (?, ?, ?, ?)"
      ).run(customerId, type, title, message);
    }
  }

  async getNotifications(customerId: number): Promise<any[]> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query(
        "SELECT * FROM customer_notifications WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 30",
        [customerId]
      );
      return r.rows.map((row: any) => ({
        id: row.id, customerId: row.customer_id, type: row.type,
        title: row.title, message: row.message, read: !!row.read, createdAt: row.created_at,
      }));
    }
    const rows = sqliteInstance!.prepare(
      "SELECT * FROM customer_notifications WHERE customer_id = ? ORDER BY created_at DESC LIMIT 30"
    ).all(customerId) as any[];
    return rows.map((row) => ({
      id: row.id, customerId: row.customer_id, type: row.type,
      title: row.title, message: row.message, read: !!row.read, createdAt: row.created_at,
    }));
  }

  async markNotificationsRead(customerId: number): Promise<void> {
    if (dbType === "pg" && pgPool) {
      await pgPool.query("UPDATE customer_notifications SET read = 1 WHERE customer_id = $1", [customerId]);
    } else {
      sqliteInstance!.prepare("UPDATE customer_notifications SET read = 1 WHERE customer_id = ?").run(customerId);
    }
  }

  async createLoginLog(customerId: number, data: {
    ip: string; country?: string; countryCode?: string; city?: string; isp?: string; userAgent?: string;
  }): Promise<void> {
    if (dbType === "pg" && pgPool) {
      await pgPool.query(
        "INSERT INTO login_logs (customer_id, ip, country, country_code, city, isp, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [customerId, data.ip, data.country || null, data.countryCode || null, data.city || null, data.isp || null, data.userAgent || null]
      );
    } else {
      sqliteInstance!.prepare(
        "INSERT INTO login_logs (customer_id, ip, country, country_code, city, isp, user_agent) VALUES (?,?,?,?,?,?,?)"
      ).run(customerId, data.ip, data.country || null, data.countryCode || null, data.city || null, data.isp || null, data.userAgent || null);
    }
  }

  async getLoginLogs(customerId: number): Promise<any[]> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query(
        "SELECT * FROM login_logs WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20",
        [customerId]
      );
      return r.rows.map((row: any) => ({
        id: row.id, ip: row.ip, country: row.country, countryCode: row.country_code,
        city: row.city, isp: row.isp, userAgent: row.user_agent, createdAt: row.created_at,
      }));
    }
    const rows = sqliteInstance!.prepare(
      "SELECT * FROM login_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20"
    ).all(customerId) as any[];
    return rows.map((row) => ({
      id: row.id, ip: row.ip, country: row.country, countryCode: row.country_code,
      city: row.city, isp: row.isp, userAgent: row.user_agent, createdAt: row.created_at,
    }));
  }

  async getLoginLogsByEmail(email: string): Promise<any[]> {
    const customer = await this.getCustomerByEmail(email);
    if (!customer) return [];
    return this.getLoginLogs(customer.id);
  }

  async createRating(data: { reference: string; customerEmail: string; customerName?: string; planId?: string; planName?: string; stars: number; comment?: string }): Promise<void> {
    if (dbType === "pg" && pgPool) {
      await pgPool.query(
        "INSERT INTO ratings (reference, customer_email, customer_name, plan_id, plan_name, stars, comment) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (reference) DO UPDATE SET stars=$6, comment=$7",
        [data.reference, data.customerEmail, data.customerName || null, data.planId || null, data.planName || null, data.stars, data.comment || null]
      );
    } else {
      sqliteInstance!.prepare(
        "INSERT INTO ratings (reference, customer_email, customer_name, plan_id, plan_name, stars, comment) VALUES (?,?,?,?,?,?,?) ON CONFLICT(reference) DO UPDATE SET stars=excluded.stars, comment=excluded.comment"
      ).run(data.reference, data.customerEmail, data.customerName || null, data.planId || null, data.planName || null, data.stars, data.comment || null);
    }
  }

  async getRatingByReference(reference: string): Promise<any | null> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM ratings WHERE reference = $1", [reference]);
      return r.rows[0] || null;
    }
    return (sqliteInstance!.prepare("SELECT * FROM ratings WHERE reference = ?").get(reference) as any) || null;
  }

  async getAllRatings(limit = 100): Promise<any[]> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM ratings ORDER BY created_at DESC LIMIT $1", [limit]);
      return r.rows.map((row: any) => ({
        id: row.id, reference: row.reference, customerEmail: row.customer_email, customerName: row.customer_name,
        planId: row.plan_id, planName: row.plan_name, stars: row.stars, comment: row.comment, createdAt: row.created_at,
      }));
    }
    const rows = sqliteInstance!.prepare("SELECT * FROM ratings ORDER BY created_at DESC LIMIT ?").all(limit) as any[];
    return rows.map((row) => ({
      id: row.id, reference: row.reference, customerEmail: row.customer_email, customerName: row.customer_name,
      planId: row.plan_id, planName: row.plan_name, stars: row.stars, comment: row.comment, createdAt: row.created_at,
    }));
  }

  async getCustomerSpendingStats(email: string): Promise<{ totalSpent: number; totalOrders: number; topPlan: string | null }> {
    let rows: any[] = [];
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query(
        "SELECT amount, plan_name FROM transactions WHERE customer_email = $1 AND status = 'success'",
        [email]
      );
      rows = r.rows;
    } else {
      rows = sqliteInstance!.prepare(
        "SELECT amount, plan_name FROM transactions WHERE customer_email = ? AND status = 'success'"
      ).all(email) as any[];
    }
    const totalSpent = rows.reduce((s, r) => s + (r.amount || r.amount || 0), 0);
    const totalOrders = rows.length;
    const planCounts: Record<string, number> = {};
    for (const r of rows) {
      const pn = r.plan_name || r.planName || "Unknown";
      planCounts[pn] = (planCounts[pn] || 0) + 1;
    }
    const topPlan = Object.entries(planCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return { totalSpent, totalOrders, topPlan };
  }

  private mapReseller(row: any) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      businessName: row.business_name,
      phone: row.phone,
      why: row.why,
      status: row.status,
      username: row.username,
      passwordHash: row.password_hash,
      slug: row.slug,
      storeName: row.store_name,
      customDomain: row.custom_domain,
      logoUrl: row.logo_url,
      walletBalance: row.wallet_balance ?? 0,
      suspended: row.suspended === 1 || row.suspended === true,
      createdAt: row.created_at,
    };
  }

  async createReseller(data: { name: string; email: string; businessName?: string; phone?: string; why?: string }): Promise<any> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query(
        "INSERT INTO resellers (name, email, business_name, phone, why) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        [data.name, data.email, data.businessName || null, data.phone || null, data.why || null]
      );
      return this.mapReseller(r.rows[0]);
    }
    const stmt = sqliteInstance!.prepare(
      "INSERT INTO resellers (name, email, business_name, phone, why) VALUES (?,?,?,?,?)"
    );
    const info = stmt.run(data.name, data.email, data.businessName || null, data.phone || null, data.why || null);
    const row = sqliteInstance!.prepare("SELECT * FROM resellers WHERE id = ?").get(info.lastInsertRowid) as any;
    return this.mapReseller(row);
  }

  async getResellerById(id: number): Promise<any | undefined> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM resellers WHERE id = $1", [id]);
      return r.rows[0] ? this.mapReseller(r.rows[0]) : undefined;
    }
    const row = sqliteInstance!.prepare("SELECT * FROM resellers WHERE id = ?").get(id) as any;
    return row ? this.mapReseller(row) : undefined;
  }

  async getResellerByEmail(email: string): Promise<any | undefined> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM resellers WHERE email = $1", [email]);
      return r.rows[0] ? this.mapReseller(r.rows[0]) : undefined;
    }
    const row = sqliteInstance!.prepare("SELECT * FROM resellers WHERE email = ?").get(email) as any;
    return row ? this.mapReseller(row) : undefined;
  }

  async getResellerBySlug(slug: string): Promise<any | undefined> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM resellers WHERE slug = $1", [slug]);
      return r.rows[0] ? this.mapReseller(r.rows[0]) : undefined;
    }
    const row = sqliteInstance!.prepare("SELECT * FROM resellers WHERE slug = ?").get(slug) as any;
    return row ? this.mapReseller(row) : undefined;
  }

  async getResellerByUsername(username: string): Promise<any | undefined> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM resellers WHERE username = $1", [username]);
      return r.rows[0] ? this.mapReseller(r.rows[0]) : undefined;
    }
    const row = sqliteInstance!.prepare("SELECT * FROM resellers WHERE username = ?").get(username) as any;
    return row ? this.mapReseller(row) : undefined;
  }

  async getResellerByDomain(domain: string): Promise<any | undefined> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM resellers WHERE custom_domain = $1", [domain]);
      return r.rows[0] ? this.mapReseller(r.rows[0]) : undefined;
    }
    const row = sqliteInstance!.prepare("SELECT * FROM resellers WHERE custom_domain = ?").get(domain) as any;
    return row ? this.mapReseller(row) : undefined;
  }

  async getAllResellers(): Promise<any[]> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM resellers WHERE status = 'approved' ORDER BY created_at DESC");
      return r.rows.map((row: any) => this.mapReseller(row));
    }
    const rows = sqliteInstance!.prepare("SELECT * FROM resellers WHERE status = 'approved' ORDER BY created_at DESC").all() as any[];
    return rows.map((row: any) => this.mapReseller(row));
  }

  async getAllResellerApplications(): Promise<any[]> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM resellers ORDER BY created_at DESC");
      return r.rows.map((row: any) => this.mapReseller(row));
    }
    const rows = sqliteInstance!.prepare("SELECT * FROM resellers ORDER BY created_at DESC").all() as any[];
    return rows.map((row: any) => this.mapReseller(row));
  }

  async updateReseller(id: number, data: Record<string, any>): Promise<any | undefined> {
    const colMap: Record<string, string> = {
      name: "name",
      email: "email",
      businessName: "business_name",
      phone: "phone",
      why: "why",
      status: "status",
      username: "username",
      passwordHash: "password_hash",
      slug: "slug",
      storeName: "store_name",
      customDomain: "custom_domain",
      logoUrl: "logo_url",
      walletBalance: "wallet_balance",
      suspended: "suspended",
    };
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, col] of Object.entries(colMap)) {
      if (data[key] !== undefined) {
        sets.push(col);
        values.push(data[key]);
      }
    }
    if (sets.length === 0) return this.getResellerById(id);
    if (dbType === "pg" && pgPool) {
      const setClauses = sets.map((s, i) => `${s} = $${i + 1}`).join(", ");
      values.push(id);
      await pgPool.query(`UPDATE resellers SET ${setClauses} WHERE id = $${values.length}`, values);
    } else {
      const setClauses = sets.map((s) => `${s} = ?`).join(", ");
      values.push(id);
      sqliteInstance!.prepare(`UPDATE resellers SET ${setClauses} WHERE id = ?`).run(...values);
    }
    return this.getResellerById(id);
  }

  async createResellerSession(resellerId: number, token: string, expiresAt: Date): Promise<any> {
    const expiresStr = expiresAt.toISOString();
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query(
        "INSERT INTO reseller_sessions (reseller_id, token, expires_at) VALUES ($1,$2,$3) RETURNING *",
        [resellerId, token, expiresStr]
      );
      const row = r.rows[0];
      return { id: row.id, resellerId: row.reseller_id, token: row.token, createdAt: row.created_at, expiresAt: row.expires_at };
    }
    const stmt = sqliteInstance!.prepare(
      "INSERT INTO reseller_sessions (reseller_id, token, expires_at) VALUES (?,?,?)"
    );
    const info = stmt.run(resellerId, token, expiresStr);
    const row = sqliteInstance!.prepare("SELECT * FROM reseller_sessions WHERE id = ?").get(info.lastInsertRowid) as any;
    return { id: row.id, resellerId: row.reseller_id, token: row.token, createdAt: row.created_at, expiresAt: row.expires_at };
  }

  async getResellerSession(token: string): Promise<any | undefined> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM reseller_sessions WHERE token = $1", [token]);
      if (!r.rows[0]) return undefined;
      const row = r.rows[0];
      return { id: row.id, resellerId: row.reseller_id, token: row.token, createdAt: row.created_at, expiresAt: row.expires_at };
    }
    const row = sqliteInstance!.prepare("SELECT * FROM reseller_sessions WHERE token = ?").get(token) as any;
    if (!row) return undefined;
    return { id: row.id, resellerId: row.reseller_id, token: row.token, createdAt: row.created_at, expiresAt: row.expires_at };
  }

  async deleteResellerSession(token: string): Promise<void> {
    if (dbType === "pg" && pgPool) {
      await pgPool.query("DELETE FROM reseller_sessions WHERE token = $1", [token]);
    } else {
      sqliteInstance!.prepare("DELETE FROM reseller_sessions WHERE token = ?").run(token);
    }
  }

  async getResellerPrices(resellerId: number): Promise<any[]> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM reseller_prices WHERE reseller_id = $1", [resellerId]);
      return r.rows.map((row: any) => ({ id: row.id, resellerId: row.reseller_id, planId: row.plan_id, price: row.price }));
    }
    const rows = sqliteInstance!.prepare("SELECT * FROM reseller_prices WHERE reseller_id = ?").all(resellerId) as any[];
    return rows.map((row: any) => ({ id: row.id, resellerId: row.reseller_id, planId: row.plan_id, price: row.price }));
  }

  async setResellerPrice(resellerId: number, planId: string, price: number): Promise<void> {
    if (dbType === "pg" && pgPool) {
      await pgPool.query(
        "INSERT INTO reseller_prices (reseller_id, plan_id, price) VALUES ($1,$2,$3) ON CONFLICT(reseller_id, plan_id) DO UPDATE SET price = $3",
        [resellerId, planId, price]
      );
    } else {
      sqliteInstance!.prepare(
        "INSERT INTO reseller_prices (reseller_id, plan_id, price) VALUES (?,?,?) ON CONFLICT(reseller_id, plan_id) DO UPDATE SET price = excluded.price"
      ).run(resellerId, planId, price);
    }
  }

  async creditResellerWallet(resellerId: number, amount: number, description: string, reference?: string): Promise<void> {
    if (dbType === "pg" && pgPool) {
      await pgPool.query(
        "UPDATE resellers SET wallet_balance = wallet_balance + $1 WHERE id = $2",
        [amount, resellerId]
      );
      await pgPool.query(
        "INSERT INTO reseller_wallet_transactions (reseller_id, type, amount, description, reference, created_at) VALUES ($1,'credit',$2,$3,$4,NOW()::text)",
        [resellerId, amount, description, reference || null]
      );
    } else {
      sqliteInstance!.prepare("UPDATE resellers SET wallet_balance = wallet_balance + ? WHERE id = ?").run(amount, resellerId);
      sqliteInstance!.prepare(
        "INSERT INTO reseller_wallet_transactions (reseller_id, type, amount, description, reference) VALUES (?,'credit',?,?,?)"
      ).run(resellerId, amount, description, reference || null);
    }
  }

  async debitResellerWallet(resellerId: number, amount: number, description: string, reference?: string): Promise<boolean> {
    const reseller = await this.getResellerById(resellerId);
    if (!reseller || reseller.walletBalance < amount) return false;
    if (dbType === "pg" && pgPool) {
      await pgPool.query(
        "UPDATE resellers SET wallet_balance = wallet_balance - $1 WHERE id = $2",
        [amount, resellerId]
      );
      await pgPool.query(
        "INSERT INTO reseller_wallet_transactions (reseller_id, type, amount, description, reference, created_at) VALUES ($1,'debit',$2,$3,$4,NOW()::text)",
        [resellerId, amount, description, reference || null]
      );
    } else {
      sqliteInstance!.prepare("UPDATE resellers SET wallet_balance = wallet_balance - ? WHERE id = ?").run(amount, resellerId);
      sqliteInstance!.prepare(
        "INSERT INTO reseller_wallet_transactions (reseller_id, type, amount, description, reference) VALUES (?,'debit',?,?,?)"
      ).run(resellerId, amount, description, reference || null);
    }
    return true;
  }

  async getResellerWalletTransactions(resellerId: number, limit = 30): Promise<any[]> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query(
        "SELECT * FROM reseller_wallet_transactions WHERE reseller_id = $1 ORDER BY created_at DESC LIMIT $2",
        [resellerId, limit]
      );
      return r.rows.map((row: any) => ({ id: row.id, resellerId: row.reseller_id, type: row.type, amount: row.amount, description: row.description, reference: row.reference, createdAt: row.created_at }));
    }
    const rows = sqliteInstance!.prepare(
      "SELECT * FROM reseller_wallet_transactions WHERE reseller_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(resellerId, limit) as any[];
    return rows.map((row: any) => ({ id: row.id, resellerId: row.reseller_id, type: row.type, amount: row.amount, description: row.description, reference: row.reference, createdAt: row.created_at }));
  }

  async createWithdrawalRequest(data: { resellerId: number; amount: number; phone: string; note?: string }): Promise<any> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query(
        "INSERT INTO reseller_withdrawals (reseller_id, amount, phone, note) VALUES ($1,$2,$3,$4) RETURNING *",
        [data.resellerId, data.amount, data.phone, data.note || null]
      );
      return this.mapWithdrawal(r.rows[0]);
    }
    const stmt = sqliteInstance!.prepare(
      "INSERT INTO reseller_withdrawals (reseller_id, amount, phone, note) VALUES (?,?,?,?)"
    );
    const info = stmt.run(data.resellerId, data.amount, data.phone, data.note || null);
    const row = sqliteInstance!.prepare("SELECT * FROM reseller_withdrawals WHERE id = ?").get(info.lastInsertRowid) as any;
    return this.mapWithdrawal(row);
  }

  private mapWithdrawal(row: any) {
    return {
      id: row.id,
      resellerId: row.reseller_id,
      amount: row.amount,
      phone: row.phone,
      note: row.note,
      status: row.status,
      adminNote: row.admin_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getWithdrawalsByReseller(resellerId: number): Promise<any[]> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM reseller_withdrawals WHERE reseller_id = $1 ORDER BY created_at DESC", [resellerId]);
      return r.rows.map((row: any) => this.mapWithdrawal(row));
    }
    const rows = sqliteInstance!.prepare("SELECT * FROM reseller_withdrawals WHERE reseller_id = ? ORDER BY created_at DESC").all(resellerId) as any[];
    return rows.map((row: any) => this.mapWithdrawal(row));
  }

  async getPendingWithdrawals(): Promise<any[]> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query(
        "SELECT w.*, r.name as reseller_name, r.email as reseller_email FROM reseller_withdrawals w LEFT JOIN resellers r ON r.id = w.reseller_id WHERE w.status = 'pending' ORDER BY w.created_at ASC"
      );
      return r.rows.map((row: any) => ({ ...this.mapWithdrawal(row), resellerName: row.reseller_name, resellerEmail: row.reseller_email }));
    }
    const rows = sqliteInstance!.prepare(
      "SELECT w.*, r.name as reseller_name, r.email as reseller_email FROM reseller_withdrawals w LEFT JOIN resellers r ON r.id = w.reseller_id WHERE w.status = 'pending' ORDER BY w.created_at ASC"
    ).all() as any[];
    return rows.map((row: any) => ({ ...this.mapWithdrawal(row), resellerName: row.reseller_name, resellerEmail: row.reseller_email }));
  }

  async getWithdrawalById(id: number): Promise<any | undefined> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query("SELECT * FROM reseller_withdrawals WHERE id = $1", [id]);
      return r.rows[0] ? this.mapWithdrawal(r.rows[0]) : undefined;
    }
    const row = sqliteInstance!.prepare("SELECT * FROM reseller_withdrawals WHERE id = ?").get(id) as any;
    return row ? this.mapWithdrawal(row) : undefined;
  }

  async approveWithdrawal(id: number, adminNote?: string): Promise<void> {
    const w = await this.getWithdrawalById(id);
    if (!w) throw new Error("Withdrawal not found");
    if (w.status !== "pending") throw new Error("Withdrawal is no longer pending");
    // Conditional update: only proceed if the row is still 'pending' (guards against concurrent approvals)
    let rowsAffected = 0;
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query(
        "UPDATE reseller_withdrawals SET status='processing', admin_note=$1, updated_at=NOW()::text WHERE id=$2 AND status='pending' RETURNING id",
        [adminNote || null, id]
      );
      rowsAffected = r.rowCount ?? 0;
    } else {
      const result = sqliteInstance!.prepare(
        "UPDATE reseller_withdrawals SET status='processing', admin_note=?, updated_at=datetime('now') WHERE id=? AND status='pending'"
      ).run(adminNote || null, id);
      rowsAffected = result.changes;
    }
    if (rowsAffected === 0) throw new Error("Withdrawal already processed by another request");
    const debited = await this.debitResellerWallet(w.resellerId, w.amount, `Withdrawal #${id} approved`, `withdrawal-${id}`);
    if (!debited) {
      // Rollback the status change since debit failed
      if (dbType === "pg" && pgPool) {
        await pgPool.query("UPDATE reseller_withdrawals SET status='pending', updated_at=NOW()::text WHERE id=$1", [id]);
      } else {
        sqliteInstance!.prepare("UPDATE reseller_withdrawals SET status='pending', updated_at=datetime('now') WHERE id=?").run(id);
      }
      throw new Error("Insufficient wallet balance — debit failed");
    }
    // Mark as approved now that debit succeeded
    if (dbType === "pg" && pgPool) {
      await pgPool.query(
        "UPDATE reseller_withdrawals SET status='approved', updated_at=NOW()::text WHERE id=$1",
        [id]
      );
    } else {
      sqliteInstance!.prepare(
        "UPDATE reseller_withdrawals SET status='approved', updated_at=datetime('now') WHERE id=?"
      ).run(id);
    }
  }

  async rejectWithdrawal(id: number, adminNote?: string): Promise<void> {
    if (dbType === "pg" && pgPool) {
      await pgPool.query(
        "UPDATE reseller_withdrawals SET status='rejected', admin_note=$1, updated_at=NOW()::text WHERE id=$2",
        [adminNote || null, id]
      );
    } else {
      sqliteInstance!.prepare(
        "UPDATE reseller_withdrawals SET status='rejected', admin_note=?, updated_at=datetime('now') WHERE id=?"
      ).run(adminNote || null, id);
    }
  }

  async getResellerOrders(resellerId: number): Promise<any[]> {
    if (dbType === "pg" && pgPool) {
      const r = await pgPool.query(
        "SELECT * FROM transactions WHERE reseller_id = $1 ORDER BY created_at DESC",
        [resellerId]
      );
      return r.rows.map((row: any) => ({
        id: row.id, reference: row.reference, planId: row.plan_id, planName: row.plan_name,
        customerEmail: row.customer_email, customerName: row.customer_name,
        amount: row.amount, status: row.status, createdAt: row.created_at,
      }));
    }
    const rows = sqliteInstance!.prepare(
      "SELECT * FROM transactions WHERE reseller_id = ? ORDER BY created_at DESC"
    ).all(resellerId) as any[];
    return rows.map((row: any) => ({
      id: row.id, reference: row.reference, planId: row.plan_id, planName: row.plan_name,
      customerEmail: row.customer_email, customerName: row.customer_name,
      amount: row.amount, status: row.status, createdAt: row.created_at,
    }));
  }
}

export const storage = new DbStorage();
