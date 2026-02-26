import { dbSettingsGet, dbSettingsSet } from "./storage";

const SETTINGS_KEY = "admin_logs";
const MAX_ENTRIES = 500;

export interface AdminLogEntry {
  id: string;
  timestamp: string;
  action: string;
  category: "auth" | "plans" | "accounts" | "promos" | "settings" | "customers" | "apikeys" | "transactions";
  details: string;
  ip?: string;
  status: "success" | "warning" | "error";
}

function loadLogs(): AdminLogEntry[] {
  try {
    const raw = dbSettingsGet(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLogs(entries: AdminLogEntry[]): void {
  dbSettingsSet(SETTINGS_KEY, JSON.stringify(entries));
}

export function logAdminAction(params: Omit<AdminLogEntry, "id" | "timestamp">): void {
  try {
    const entries = loadLogs();
    const entry: AdminLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...params,
    };
    entries.unshift(entry);
    saveLogs(entries.slice(0, MAX_ENTRIES));
  } catch {}
}

export function getAdminLogs(limit = 100, category?: string): AdminLogEntry[] {
  const entries = loadLogs();
  const filtered = category ? entries.filter((e) => e.category === category) : entries;
  return filtered.slice(0, limit);
}
