/**
 * bulk-whatsapp-routes.ts
 * Bulk WhatsApp Messaging — uses the existing gifted-baileys socket
 *
 * Endpoints (admin-protected):
 *   POST   /api/bulk-wa/campaigns            create campaign
 *   GET    /api/bulk-wa/campaigns            list all campaigns
 *   GET    /api/bulk-wa/campaigns/:id        get campaign + progress
 *   DELETE /api/bulk-wa/campaigns/:id        delete campaign
 *   POST   /api/bulk-wa/campaigns/:id/contacts  upload contacts (CSV text in body)
 *   POST   /api/bulk-wa/campaigns/:id/start  start sending
 *   POST   /api/bulk-wa/campaigns/:id/pause  pause sending
 *   POST   /api/bulk-wa/campaigns/:id/cancel cancel sending
 *   POST   /api/bulk-wa/send-single          send one message immediately
 *
 * External REST API (Bearer token auth):
 *   POST   /api/v1/whatsapp/send             { to, message, apiKey }
 *   GET    /api/v1/whatsapp/status           connection status
 */

import type { Express, Request, Response } from "express";
import crypto from "crypto";

// ── Lazy-import to avoid circular deps ───────────────────────────────────────
async function getWA() {
  const m = await import("./whatsapp-web.js");
  return m;
}

// ── In-memory store ───────────────────────────────────────────────────────────
export interface Contact { name: string; phone: string; }
export interface CampaignResult { phone: string; name: string; status: "sent" | "failed" | "skipped"; error?: string; at: string; }

export interface Campaign {
  id:        string;
  name:      string;
  message:   string;       // supports {{name}} {{phone}}
  contacts:  Contact[];
  status:    "draft" | "running" | "paused" | "done" | "cancelled";
  results:   CampaignResult[];
  createdAt: string;
  startedAt?: string;
  doneAt?:   string;
  delayMs:   number;       // ms between messages (default 4000)
}

const campaigns = new Map<string, Campaign>();

// Simple API keys store: apiKey -> label
const apiKeys = new Map<string, string>([
  ["chege-default-key", "Default Key"],
]);

function mkId() { return crypto.randomBytes(6).toString("hex"); }

// ── CSV parser ────────────────────────────────────────────────────────────────
/**
 * Accepts any of:
 *   phone                     (one column)
 *   name,phone
 *   phone,name
 *   name;phone  (semicolon)
 *   +254712345678             (plain list)
 */
function parseContacts(csv: string): Contact[] {
  const lines = csv.replace(/\r/g, "").split("\n").map(l => l.trim()).filter(Boolean);
  const contacts: Contact[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (line.startsWith("#")) continue;           // comments
    const cols = line.split(/[,;|\t]/).map(c => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length === 1) {
      // just a phone number
      const phone = normalisePhone(cols[0]);
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      contacts.push({ name: "", phone });
    } else {
      // figure out which col is phone (contains digits+)
      const isPhone = (s: string) => /^\+?[\d\s\-().]{7,}$/.test(s);
      let name = "", phone = "";
      if (isPhone(cols[0]) && !isPhone(cols[1])) { phone = cols[0]; name = cols[1]; }
      else if (isPhone(cols[1]) && !isPhone(cols[0])) { name = cols[0]; phone = cols[1]; }
      else if (isPhone(cols[0])) { phone = cols[0]; name = cols[1] ?? ""; }
      else if (isPhone(cols[1])) { phone = cols[1]; name = cols[0] ?? ""; }
      else continue; // skip header rows like "name,phone"
      phone = normalisePhone(phone);
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      contacts.push({ name, phone });
    }
  }
  return contacts;
}

function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return "";
  // Kenya: 07xx → 2547xx
  if (digits.startsWith("07") && digits.length === 10) return "254" + digits.slice(1);
  if (digits.startsWith("01") && digits.length === 10) return "254" + digits.slice(1);
  // Already has country code
  return digits;
}

function fillTemplate(tpl: string, contact: Contact): string {
  return tpl
    .replace(/\{\{name\}\}/gi, contact.name || "there")
    .replace(/\{\{phone\}\}/gi, contact.phone);
}

// ── Campaign runner ───────────────────────────────────────────────────────────
const runnerState = new Map<string, { active: boolean }>();

async function runCampaign(id: string) {
  const camp = campaigns.get(id);
  if (!camp) return;

  const state = { active: true };
  runnerState.set(id, state);

  camp.status    = "running";
  camp.startedAt = new Date().toISOString();

  const wa = await getWA();

  for (const contact of camp.contacts) {
    // Check if paused / cancelled
    if (!state.active || camp.status === "cancelled" || camp.status === "paused") break;

    // Skip if already processed
    const alreadyDone = camp.results.find(r => r.phone === contact.phone);
    if (alreadyDone) continue;

    const jid = contact.phone + "@s.whatsapp.net";
    const text = fillTemplate(camp.message, contact);

    try {
      const connected = wa.isWhatsAppWebConnected();
      if (!connected) {
        camp.results.push({ phone: contact.phone, name: contact.name, status: "failed", error: "WhatsApp not connected", at: new Date().toISOString() });
        continue;
      }
      await wa.sendWhatsAppNotification(contact.phone, text);
      camp.results.push({ phone: contact.phone, name: contact.name, status: "sent", at: new Date().toISOString() });
    } catch (err: any) {
      camp.results.push({ phone: contact.phone, name: contact.name, status: "failed", error: err?.message || "Unknown error", at: new Date().toISOString() });
    }

    // Delay between messages to avoid WhatsApp ban
    await new Promise(r => setTimeout(r, camp.delayMs));
  }

  runnerState.delete(id);
  if (camp.status === "running") {
    camp.status  = "done";
    camp.doneAt  = new Date().toISOString();
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
export function registerBulkWhatsAppRoutes(app: Express) {

  // ── API key auth middleware for external /api/v1/* ──────────────────────────
  function apiKeyAuth(req: Request, res: Response, next: () => void) {
    const key = req.headers["x-api-key"] as string || req.query.apiKey as string || req.body?.apiKey;
    if (!key || !apiKeys.has(key)) return res.status(401).json({ error: "Invalid or missing API key" });
    next();
  }

  // ── GET /api/bulk-wa/status ─────────────────────────────────────────────────
  app.get("/api/bulk-wa/status", async (_req, res) => {
    const wa = await getWA();
    const s  = wa.getWhatsAppStatus();
    res.json({ connected: wa.isWhatsAppWebConnected(), status: s.status, qrCode: s.qrCode, pairingCode: s.pairingCode });
  });

  // ── GET /api/bulk-wa/campaigns ──────────────────────────────────────────────
  app.get("/api/bulk-wa/campaigns", (_req, res) => {
    const list = [...campaigns.values()].map(c => ({
      id: c.id, name: c.name, status: c.status,
      total:  c.contacts.length,
      sent:   c.results.filter(r => r.status === "sent").length,
      failed: c.results.filter(r => r.status === "failed").length,
      createdAt: c.createdAt, startedAt: c.startedAt, doneAt: c.doneAt,
    }));
    res.json({ campaigns: list.reverse() });
  });

  // ── POST /api/bulk-wa/campaigns ─────────────────────────────────────────────
  app.post("/api/bulk-wa/campaigns", (req, res) => {
    const { name, message, delayMs } = req.body as { name?: string; message?: string; delayMs?: number };
    if (!name || !message) return res.status(400).json({ error: "name and message are required" });
    const id = mkId();
    const camp: Campaign = {
      id, name, message,
      contacts: [], results: [],
      status: "draft",
      createdAt: new Date().toISOString(),
      delayMs: Math.max(2000, delayMs ?? 4000),
    };
    campaigns.set(id, camp);
    res.json({ success: true, campaign: { id, name, status: camp.status } });
  });

  // ── GET /api/bulk-wa/campaigns/:id ─────────────────────────────────────────
  app.get("/api/bulk-wa/campaigns/:id", (req, res) => {
    const camp = campaigns.get(req.params.id);
    if (!camp) return res.status(404).json({ error: "Campaign not found" });
    res.json({ campaign: camp });
  });

  // ── DELETE /api/bulk-wa/campaigns/:id ──────────────────────────────────────
  app.delete("/api/bulk-wa/campaigns/:id", (req, res) => {
    const camp = campaigns.get(req.params.id);
    if (!camp) return res.status(404).json({ error: "Campaign not found" });
    if (camp.status === "running") {
      const state = runnerState.get(req.params.id);
      if (state) state.active = false;
      camp.status = "cancelled";
    }
    campaigns.delete(req.params.id);
    res.json({ success: true });
  });

  // ── POST /api/bulk-wa/campaigns/:id/contacts ────────────────────────────────
  app.post("/api/bulk-wa/campaigns/:id/contacts", (req, res) => {
    const camp = campaigns.get(req.params.id);
    if (!camp) return res.status(404).json({ error: "Campaign not found" });
    if (camp.status === "running") return res.status(409).json({ error: "Campaign is running" });

    const { csv, append } = req.body as { csv?: string; append?: boolean };
    if (!csv) return res.status(400).json({ error: "csv field required" });

    const parsed = parseContacts(csv);
    if (append) {
      const existing = new Set(camp.contacts.map(c => c.phone));
      for (const c of parsed) { if (!existing.has(c.phone)) camp.contacts.push(c); }
    } else {
      camp.contacts = parsed;
      camp.results  = [];
    }
    res.json({ success: true, total: camp.contacts.length, added: parsed.length });
  });

  // ── POST /api/bulk-wa/campaigns/:id/start ──────────────────────────────────
  app.post("/api/bulk-wa/campaigns/:id/start", (req, res) => {
    const camp = campaigns.get(req.params.id);
    if (!camp) return res.status(404).json({ error: "Campaign not found" });
    if (!camp.contacts.length) return res.status(400).json({ error: "No contacts uploaded" });
    if (camp.status === "running") return res.status(409).json({ error: "Already running" });
    if (camp.status === "done") return res.status(409).json({ error: "Campaign already finished" });

    // Resume from paused: reset paused state
    if (camp.status === "paused") camp.status = "draft";

    runCampaign(camp.id).catch(console.error);
    res.json({ success: true, message: "Campaign started" });
  });

  // ── POST /api/bulk-wa/campaigns/:id/pause ──────────────────────────────────
  app.post("/api/bulk-wa/campaigns/:id/pause", (req, res) => {
    const camp = campaigns.get(req.params.id);
    if (!camp) return res.status(404).json({ error: "Campaign not found" });
    const state = runnerState.get(req.params.id);
    if (state) state.active = false;
    camp.status = "paused";
    res.json({ success: true, message: "Campaign paused" });
  });

  // ── POST /api/bulk-wa/campaigns/:id/cancel ─────────────────────────────────
  app.post("/api/bulk-wa/campaigns/:id/cancel", (req, res) => {
    const camp = campaigns.get(req.params.id);
    if (!camp) return res.status(404).json({ error: "Campaign not found" });
    const state = runnerState.get(req.params.id);
    if (state) state.active = false;
    camp.status = "cancelled";
    res.json({ success: true, message: "Campaign cancelled" });
  });

  // ── POST /api/bulk-wa/send-single ──────────────────────────────────────────
  app.post("/api/bulk-wa/send-single", async (req, res) => {
    const { phone, message } = req.body as { phone?: string; message?: string };
    if (!phone || !message) return res.status(400).json({ error: "phone and message required" });
    const wa = await getWA();
    if (!wa.isWhatsAppWebConnected()) return res.status(503).json({ error: "WhatsApp not connected" });
    try {
      const normalised = normalisePhone(phone);
      await wa.sendWhatsAppNotification(normalised, message);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Send failed" });
    }
  });

  // ── GET /api/bulk-wa/apikeys ────────────────────────────────────────────────
  app.get("/api/bulk-wa/apikeys", (_req, res) => {
    res.json({ keys: [...apiKeys.entries()].map(([key, label]) => ({ key, label })) });
  });

  // ── POST /api/bulk-wa/apikeys ───────────────────────────────────────────────
  app.post("/api/bulk-wa/apikeys", (req, res) => {
    const { label } = req.body as { label?: string };
    const key = "chege-" + crypto.randomBytes(8).toString("hex");
    apiKeys.set(key, label || "API Key");
    res.json({ success: true, key, label: label || "API Key" });
  });

  // ── DELETE /api/bulk-wa/apikeys/:key ───────────────────────────────────────
  app.delete("/api/bulk-wa/apikeys/:key", (req, res) => {
    apiKeys.delete(req.params.key);
    res.json({ success: true });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // External REST API  (for developers / third-party integrations)
  // ══════════════════════════════════════════════════════════════════════════

  // POST /api/v1/whatsapp/send
  app.post("/api/v1/whatsapp/send", apiKeyAuth, async (req, res) => {
    const { to, message } = req.body as { to?: string; message?: string };
    if (!to || !message) return res.status(400).json({ error: "to and message required" });
    const wa = await getWA();
    if (!wa.isWhatsAppWebConnected()) return res.status(503).json({ error: "WhatsApp gateway not connected" });
    try {
      const phone = normalisePhone(to);
      if (!phone) return res.status(400).json({ error: "Invalid phone number" });
      await wa.sendWhatsAppNotification(phone, message);
      res.json({ success: true, to: phone });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Send failed" });
    }
  });

  // POST /api/v1/whatsapp/bulk
  app.post("/api/v1/whatsapp/bulk", apiKeyAuth, async (req, res) => {
    const { contacts, message, delayMs } = req.body as {
      contacts?: { to: string; name?: string }[];
      message?: string;
      delayMs?: number;
    };
    if (!contacts?.length || !message) return res.status(400).json({ error: "contacts[] and message required" });
    const wa = await getWA();
    if (!wa.isWhatsAppWebConnected()) return res.status(503).json({ error: "WhatsApp gateway not connected" });

    // Create and immediately start a campaign
    const id = mkId();
    const camp: Campaign = {
      id, name: "API Campaign " + new Date().toLocaleString("en-KE"),
      message, contacts: contacts.map(c => ({ phone: normalisePhone(c.to), name: c.name || "" })),
      results: [], status: "draft",
      createdAt: new Date().toISOString(),
      delayMs: Math.max(2000, delayMs ?? 3000),
    };
    campaigns.set(id, camp);
    runCampaign(id).catch(console.error);
    res.json({ success: true, campaignId: id, total: camp.contacts.length });
  });

  // GET /api/v1/whatsapp/status
  app.get("/api/v1/whatsapp/status", apiKeyAuth, async (_req, res) => {
    const wa = await getWA();
    res.json({ connected: wa.isWhatsAppWebConnected(), status: wa.getWhatsAppStatus().status });
  });

  // GET /api/v1/whatsapp/campaign/:id
  app.get("/api/v1/whatsapp/campaign/:id", apiKeyAuth, (req, res) => {
    const camp = campaigns.get(req.params.id);
    if (!camp) return res.status(404).json({ error: "Not found" });
    res.json({
      id: camp.id, status: camp.status,
      total:  camp.contacts.length,
      sent:   camp.results.filter(r => r.status === "sent").length,
      failed: camp.results.filter(r => r.status === "failed").length,
    });
  });
}
