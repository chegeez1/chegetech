import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { eq, desc, sql } from "drizzle-orm";
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
let dbType: "sqlite" | "pg" = "sqlite";

const settingsCache: Map<string, string> = new Map();

function getDb() {
  if (db) return db;
  throw new Error("Database not initialized. Call initializeDatabase() first.");
}

export async function initializeDatabase() {
  const externalDbUrl = process.env.EXTERNAL_DATABASE_URL;

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
      `);

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
  const DB_DIR = path.join(process.cwd(), "data");
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
      expires_at TEXT NOT NULL
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
  `);
  console.log("[db] Connected to SQLite");
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

export function dbSettingsGet(key: string): string | null {
  try {
    if (dbType === "pg") {
      return settingsCache.get(key) || null;
    }
    if (sqliteInstance) {
      const row = sqliteInstance.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
      return row?.value || null;
    }
  } catch {}
  return null;
}

export function dbSettingsSet(key: string, value: string): void {
  try {
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

  createCustomerSession(customerId: number, token: string, expiresAt: Date): Promise<CustomerSession>;
  getCustomerSession(token: string): Promise<CustomerSession | undefined>;
  deleteCustomerSession(token: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;

  getAllCustomers(): Promise<Customer[]>;

  createApiKey(data: { customerId?: number; key: string; label: string }): Promise<ApiKey>;
  getApiKeysByCustomer(customerId: number): Promise<ApiKey[]>;
  getAllApiKeys(): Promise<ApiKey[]>;
  revokeApiKey(id: number): Promise<void>;
  deleteApiKey(id: number): Promise<void>;
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

  async createCustomerSession(customerId: number, token: string, expiresAt: Date): Promise<CustomerSession> {
    const [result] = await getDb().insert(customerSessions).values({
      customerId,
      token,
      expiresAt: expiresAt.toISOString(),
    }).returning();
    return result;
  }

  async getCustomerSession(token: string): Promise<CustomerSession | undefined> {
    const [result] = await getDb().select().from(customerSessions).where(eq(customerSessions.token, token));
    return result;
  }

  async deleteCustomerSession(token: string): Promise<void> {
    await getDb().delete(customerSessions).where(eq(customerSessions.token, token));
  }

  async deleteExpiredSessions(): Promise<void> {
    await getDb().delete(customerSessions);
  }

  async getAllCustomers(): Promise<Customer[]> {
    return getDb().select().from(customers).orderBy(desc(customers.createdAt));
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
}

export const storage = new DbStorage();
