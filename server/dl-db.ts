/**
 * dl-db.ts
 * Lightweight SQLite database for the video downloader feature.
 *
 * Tables:
 *   dl_subscribers  — emails with unlimited access (survives server restarts)
 *   dl_usage        — daily download counts per IP (resets each calendar day)
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR  = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "downloads.db");

let _db: ReturnType<typeof Database> | null = null;

function db(): ReturnType<typeof Database> {
  if (_db) return _db;
  fs.mkdirSync(DB_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS dl_subscribers (
      email TEXT PRIMARY KEY,
      granted_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dl_usage (
      ip   TEXT NOT NULL,
      date TEXT NOT NULL,
      cnt  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ip, date)
    );
  `);
  // Prune usage records older than 3 days to keep the DB tiny
  _db.prepare("DELETE FROM dl_usage WHERE date < date('now', '-3 days')").run();
  return _db;
}

// ── Initialise at import time ─────────────────────────────────────────────────
export function initDlDb() { db(); }

// ── Subscribers ───────────────────────────────────────────────────────────────
export function isSubscriber(email: string): boolean {
  const row = db().prepare("SELECT 1 FROM dl_subscribers WHERE email = ?").get(email.toLowerCase());
  return !!row;
}

export function addSubscriber(email: string): void {
  db().prepare(
    "INSERT INTO dl_subscribers (email) VALUES (?) ON CONFLICT(email) DO NOTHING"
  ).run(email.toLowerCase());
}

export function removeSubscriber(email: string): void {
  db().prepare("DELETE FROM dl_subscribers WHERE email = ?").run(email.toLowerCase());
}

export function listSubscribers(): string[] {
  const rows = db().prepare(
    "SELECT email FROM dl_subscribers ORDER BY granted_at DESC"
  ).all() as { email: string }[];
  return rows.map(r => r.email);
}

// ── Daily usage ───────────────────────────────────────────────────────────────
function todayKey(): string {
  // YYYY-MM-DD in UTC (consistent with server timezone)
  return new Date().toISOString().slice(0, 10);
}

export function getDailyUsage(ip: string): number {
  const row = db().prepare(
    "SELECT cnt FROM dl_usage WHERE ip = ? AND date = ?"
  ).get(ip, todayKey()) as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

export function incrementDailyUsage(ip: string): number {
  db().prepare(`
    INSERT INTO dl_usage (ip, date, cnt) VALUES (?, ?, 1)
    ON CONFLICT(ip, date) DO UPDATE SET cnt = cnt + 1
  `).run(ip, todayKey());
  return getDailyUsage(ip);
}
