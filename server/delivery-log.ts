import { dbSettingsGet, dbSettingsSet } from "./storage";

const SETTINGS_KEY = "delivery_logs";

export interface DeliveryLogEntry {
  id: string;
  reference: string;
  customerEmail: string;
  customerName: string;
  planName: string;
  planId: string;
  timestamp: string;
  method: "email" | "resend_email" | "account_assignment" | "telegram_notification" | "whatsapp_notification";
  status: "success" | "failed";
  details: string;
  metadata?: Record<string, any>;
}

function readLogs(): DeliveryLogEntry[] {
  try {
    const raw = dbSettingsGet(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function writeLogs(logs: DeliveryLogEntry[]) {
  dbSettingsSet(SETTINGS_KEY, JSON.stringify(logs));
}

export function logDelivery(entry: Omit<DeliveryLogEntry, "id" | "timestamp">): DeliveryLogEntry {
  const logs = readLogs();
  const newEntry: DeliveryLogEntry = {
    ...entry,
    id: `DL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  logs.unshift(newEntry);
  if (logs.length > 5000) logs.length = 5000;
  writeLogs(logs);
  return newEntry;
}

export function getDeliveryLogs(reference?: string, email?: string): DeliveryLogEntry[] {
  const logs = readLogs();
  if (reference) return logs.filter(l => l.reference === reference);
  if (email) return logs.filter(l => l.customerEmail === email);
  return logs;
}

export function getDeliveryProof(reference: string): {
  reference: string;
  logs: DeliveryLogEntry[];
  summary: {
    totalAttempts: number;
    successfulDeliveries: number;
    failedAttempts: number;
    firstAttempt: string | null;
    lastAttempt: string | null;
    methods: string[];
    emailDelivered: boolean;
    accountAssigned: boolean;
  };
} {
  const logs = getDeliveryLogs(reference);
  const successful = logs.filter(l => l.status === "success");
  const failed = logs.filter(l => l.status === "failed");
  const methods = [...new Set(logs.map(l => l.method))];

  return {
    reference,
    logs,
    summary: {
      totalAttempts: logs.length,
      successfulDeliveries: successful.length,
      failedAttempts: failed.length,
      firstAttempt: logs.length ? logs[logs.length - 1].timestamp : null,
      lastAttempt: logs.length ? logs[0].timestamp : null,
      methods,
      emailDelivered: logs.some(l => (l.method === "email" || l.method === "resend_email") && l.status === "success"),
      accountAssigned: logs.some(l => l.method === "account_assignment" && l.status === "success"),
    },
  };
}
