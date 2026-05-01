/**
 * dl-db.ts
 * Persistent storage for the video downloader feature.
 *
 * Uses PostgreSQL when EXTERNAL_DATABASE_URL or DATABASE_URL is set (production),
 * otherwise falls back to SQLite (local dev).
 *
 * Tables:
 *   dl_subscribers  — emails with unlimited access
 *   dl_usage        — daily download counts per IP (resets each calendar day)
 */

// ─── PostgreSQL path ──────────────────────────────────────────────────────────

import pg from "pg";
const { Pool } = pg;

const PG_URL = process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL;

let pgPool: InstanceType<typeof Pool> | null = null;

async function getPool(): Promise<InstanceType<typeof Pool>> {
  if (pgPool) return pgPool;
  pgPool = new Pool({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS dl_subscribers (
      email      TEXT PRIMARY KEY,
      granted_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS dl_config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS dl_usage (
      ip   TEXT    NOT NULL,
      date TEXT    NOT NULL,
      cnt  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ip, date)
    );
  `);
  // Prune old usage
  await pgPool.query("DELETE FROM dl_usage WHERE date < (NOW() AT TIME ZONE 'UTC' - INTERVAL '3 days')::DATE::TEXT");
  return pgPool;
}

// ─── SQLite fallback (local dev only) ─────────────────────────────────────────

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let _sqlite: ReturnType<typeof Database> | null = null;

function getSqlite(): ReturnType<typeof Database> {
  if (_sqlite) return _sqlite;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  _sqlite = new Database(path.join(dir, "downloads.db"));
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.exec(`
    CREATE TABLE IF NOT EXISTS dl_subscribers (
      email TEXT PRIMARY KEY,
      granted_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dl_config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS dl_usage (
      ip   TEXT NOT NULL,
      date TEXT NOT NULL,
      cnt  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ip, date)
    );
  `);
  _sqlite.prepare("DELETE FROM dl_usage WHERE date < date('now', '-3 days')").run();
  return _sqlite;
}

// ─── Initialise ───────────────────────────────────────────────────────────────

export async function initDlDb(): Promise<void> {
  if (PG_URL) {
    await getPool();
    console.log("[dl-db] using PostgreSQL for downloader data");
  } else {
    getSqlite();
    console.log("[dl-db] using SQLite for downloader data (dev mode)");
  }
}

// ─── Today key (UTC) ─────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Subscribers ──────────────────────────────────────────────────────────────

export async function isSubscriber(email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (PG_URL) {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT 1 FROM dl_subscribers WHERE email = $1", [e]);
    return rows.length > 0;
  }
  const row = getSqlite().prepare("SELECT 1 FROM dl_subscribers WHERE email = ?").get(e);
  return !!row;
}

export async function addSubscriber(email: string): Promise<void> {
  const e = email.toLowerCase();
  if (PG_URL) {
    const pool = await getPool();
    await pool.query(
      "INSERT INTO dl_subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING", [e]
    );
  } else {
    getSqlite().prepare(
      "INSERT INTO dl_subscribers (email) VALUES (?) ON CONFLICT(email) DO NOTHING"
    ).run(e);
  }
}

export async function removeSubscriber(email: string): Promise<void> {
  const e = email.toLowerCase();
  if (PG_URL) {
    const pool = await getPool();
    await pool.query("DELETE FROM dl_subscribers WHERE email = $1", [e]);
  } else {
    getSqlite().prepare("DELETE FROM dl_subscribers WHERE email = ?").run(e);
  }
}

export async function listSubscribers(): Promise<string[]> {
  if (PG_URL) {
    const pool = await getPool();
    const { rows } = await pool.query(
      "SELECT email FROM dl_subscribers ORDER BY granted_at DESC"
    );
    return rows.map((r: { email: string }) => r.email);
  }
  const rows = getSqlite().prepare(
    "SELECT email FROM dl_subscribers ORDER BY granted_at DESC"
  ).all() as { email: string }[];
  return rows.map(r => r.email);
}

// ─── Daily usage ──────────────────────────────────────────────────────────────

export async function getDailyUsage(ip: string): Promise<number> {
  if (PG_URL) {
    const pool = await getPool();
    const { rows } = await pool.query(
      "SELECT cnt FROM dl_usage WHERE ip = $1 AND date = $2", [ip, todayKey()]
    );
    return rows[0]?.cnt ?? 0;
  }
  const row = getSqlite().prepare(
    "SELECT cnt FROM dl_usage WHERE ip = ? AND date = ?"
  ).get(ip, todayKey()) as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

export async function incrementDailyUsage(ip: string): Promise<number> {
  if (PG_URL) {
    const pool = await getPool();
    await pool.query(
      `INSERT INTO dl_usage (ip, date, cnt) VALUES ($1, $2, 1)
       ON CONFLICT (ip, date) DO UPDATE SET cnt = dl_usage.cnt + 1`,
      [ip, todayKey()]
    );
    return getDailyUsage(ip);
  }
  getSqlite().prepare(`
    INSERT INTO dl_usage (ip, date, cnt) VALUES (?, ?, 1)
    ON CONFLICT(ip, date) DO UPDATE SET cnt = cnt + 1
  `).run(ip, todayKey());
  const row = getSqlite().prepare(
    "SELECT cnt FROM dl_usage WHERE ip = ? AND date = ?"
  ).get(ip, todayKey()) as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

// ─── Config (cookies, po_token, visitor_data) ────────────────────────────────

/** Persist a config value (upsert) */
export async function setConfig(key: string, value: string): Promise<void> {
  if (PG_URL) {
    const pool = await getPool();
    await pool.query(
      `INSERT INTO dl_config (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
  } else {
    getSqlite().prepare(`
      INSERT INTO dl_config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `).run(key, value, value);
  }
}

/** Retrieve a config value, returns empty string if missing */
export async function getConfig(key: string): Promise<string> {
  if (PG_URL) {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT value FROM dl_config WHERE key = $1", [key]);
    return rows[0]?.value ?? "";
  }
  const row = getSqlite().prepare("SELECT value FROM dl_config WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? "";
}
