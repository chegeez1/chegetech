import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Upload, Play, Pause, Trash2, Plus, Send,
  CheckCircle, XCircle, Clock, Wifi, WifiOff, RefreshCw,
  Copy, Check, Key, ChevronDown, ChevronUp, AlertCircle, Users
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WAStatus { connected: boolean; status: string; qrCode?: string; pairingCode?: string; }
interface CampaignSummary {
  id: string; name: string; status: string;
  total: number; sent: number; failed: number;
  createdAt: string; startedAt?: string; doneAt?: string;
}
interface Contact { name: string; phone: string; }
interface CampaignResult { phone: string; name: string; status: "sent"|"failed"|"skipped"; error?: string; at: string; }
interface CampaignDetail {
  id: string; name: string; message: string; status: string;
  contacts: Contact[]; results: CampaignResult[]; delayMs: number;
  createdAt: string; startedAt?: string; doneAt?: string;
}
interface ApiKey { key: string; label: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusColor = (s: string) => ({
  draft:"text-gray-400", running:"text-green-400", paused:"text-yellow-400",
  done:"text-blue-400",  cancelled:"text-red-400",
}[s] ?? "text-gray-400");

const statusBg = (s: string) => ({
  draft:"bg-gray-700", running:"bg-green-500/20 border-green-500/30",
  paused:"bg-yellow-500/20 border-yellow-500/30",
  done:"bg-blue-500/20 border-blue-500/30",
  cancelled:"bg-red-500/20 border-red-500/30",
}[s] ?? "bg-gray-700");

function Progress({ sent, failed, total }: { sent:number; failed:number; total:number }) {
  const pct  = total ? Math.round(((sent+failed)/total)*100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{sent+failed}/{total} processed</span><span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(sent/Math.max(total,1))*100}%` }} />
      </div>
      <div className="flex gap-3 mt-1 text-xs">
        <span className="text-green-400">✓ {sent} sent</span>
        <span className="text-red-400">✗ {failed} failed</span>
        <span className="text-gray-500">○ {total-sent-failed} pending</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BulkWhatsApp() {
  const [tab, setTab] = useState<"campaigns"|"compose"|"api">("campaigns");

  // WA status
  const [waStatus, setWaStatus] = useState<WAStatus>({ connected: false, status: "disconnected" });
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [apiKeys, setApiKeys]     = useState<ApiKey[]>([]);
  const [loading, setLoading]     = useState(false);

  // Compose form
  const [campName,    setCampName]    = useState("");
  const [campMsg,     setCampMsg]     = useState("");
  const [csvText,     setCsvText]     = useState("");
  const [delayMs,     setDelayMs]     = useState(4000);
  const [parsedCount, setParsedCount] = useState(0);
  const [creating,    setCreating]    = useState(false);
  const [createErr,   setCreateErr]   = useState("");

  // Detail view
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Single send
  const [singlePhone, setSinglePhone] = useState("");
  const [singleMsg,   setSingleMsg]   = useState("");
  const [singleSending, setSingleSending] = useState(false);

  // API key
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [copied,      setCopied]      = useState<string|null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/bulk-wa/status");
      setWaStatus(await r.json());
    } catch {}
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      const r  = await fetch("/api/bulk-wa/campaigns");
      const d  = await r.json();
      setCampaigns(d.campaigns || []);
    } catch {}
  }, []);

  const fetchApiKeys = useCallback(async () => {
    try {
      const r = await fetch("/api/bulk-wa/apikeys");
      const d = await r.json();
      setApiKeys(d.keys || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus(); fetchCampaigns(); fetchApiKeys();
    pollRef.current = setInterval(() => { fetchStatus(); fetchCampaigns(); }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus, fetchCampaigns, fetchApiKeys]);

  // Poll detail if running
  useEffect(() => {
    if (!detail) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/bulk-wa/campaigns/${detail.id}`);
      const d = await r.json();
      if (d.campaign) setDetail(d.campaign);
    }, 3000);
    return () => clearInterval(t);
  }, [detail?.id]);

  // Count CSV lines on change
  useEffect(() => {
    const lines = csvText.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
    setParsedCount(lines.length);
  }, [csvText]);

  async function createCampaign() {
    if (!campName || !campMsg || !csvText) { setCreateErr("Fill in all fields and add contacts"); return; }
    setCreating(true); setCreateErr("");
    try {
      // 1. Create campaign
      const r1 = await fetch("/api/bulk-wa/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: campName, message: campMsg, delayMs }),
      });
      const d1 = await r1.json();
      if (!r1.ok) { setCreateErr(d1.error || "Create failed"); return; }

      // 2. Upload contacts
      const r2 = await fetch(`/api/bulk-wa/campaigns/${d1.campaign.id}/contacts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const d2 = await r2.json();
      if (!r2.ok) { setCreateErr(d2.error || "Contact upload failed"); return; }

      // Reset form
      setCampName(""); setCampMsg(""); setCsvText(""); setDelayMs(4000);
      await fetchCampaigns();
      setTab("campaigns");
    } catch (e: any) { setCreateErr(e.message || "Error"); }
    finally { setCreating(false); }
  }

  async function startCampaign(id: string) {
    setLoading(true);
    await fetch(`/api/bulk-wa/campaigns/${id}/start`, { method: "POST" });
    await fetchCampaigns(); setLoading(false);
  }
  async function pauseCampaign(id: string) {
    await fetch(`/api/bulk-wa/campaigns/${id}/pause`, { method: "POST" });
    await fetchCampaigns();
  }
  async function cancelCampaign(id: string) {
    await fetch(`/api/bulk-wa/campaigns/${id}/cancel`, { method: "POST" });
    await fetchCampaigns();
  }
  async function deleteCampaign(id: string) {
    if (!confirm("Delete this campaign?")) return;
    await fetch(`/api/bulk-wa/campaigns/${id}`, { method: "DELETE" });
    if (detail?.id === id) setDetail(null);
    await fetchCampaigns();
  }
  async function openDetail(id: string) {
    const r = await fetch(`/api/bulk-wa/campaigns/${id}`);
    const d = await r.json();
    setDetail(d.campaign); setShowResults(false);
  }

  async function sendSingle() {
    if (!singlePhone || !singleMsg) return;
    setSingleSending(true);
    const r = await fetch("/api/bulk-wa/send-single", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: singlePhone, message: singleMsg }),
    });
    const d = await r.json();
    setSingleSending(false);
    if (r.ok) { setSinglePhone(""); setSingleMsg(""); alert("Message sent!"); }
    else alert("Error: " + d.error);
  }

  async function createApiKey() {
    if (!newKeyLabel) return;
    const r = await fetch("/api/bulk-wa/apikeys", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newKeyLabel }),
    });
    setNewKeyLabel(""); await fetchApiKeys();
  }
  async function deleteApiKey(key: string) {
    await fetch(`/api/bulk-wa/apikeys/${encodeURIComponent(key)}`, { method: "DELETE" });
    await fetchApiKeys();
  }
  function copyKey(key: string) {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopied(key); setTimeout(() => setCopied(null), 2000);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText(ev.target?.result as string || "");
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-green-400" /> Bulk WhatsApp
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Send campaigns to thousands of contacts</p>
        </div>
        {/* WA Connection badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${
          waStatus.connected
            ? "bg-green-500/20 border-green-500/30 text-green-400"
            : "bg-red-500/20 border-red-500/30 text-red-400"
        }`}>
          {waStatus.connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {waStatus.connected ? "Connected" : "Disconnected"}
        </div>
      </div>

      {/* WA not connected warning */}
      {!waStatus.connected && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium text-sm">WhatsApp not connected</p>
            <p className="text-gray-400 text-xs mt-1">
              Go to Admin → WhatsApp to link your number first. Campaigns will fail if WhatsApp is disconnected.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6 border border-gray-800">
        {(["campaigns","compose","api"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-green-600 text-white" : "text-gray-400 hover:text-white"
            }`}>
            {t === "campaigns" ? "📋 Campaigns" : t === "compose" ? "✏️ New Campaign" : "🔑 API & Keys"}
          </button>
        ))}
      </div>

      {/* ── CAMPAIGNS TAB ─────────────────────────────────────────────────── */}
      {tab === "campaigns" && (
        <div className="space-y-3">
          {campaigns.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No campaigns yet.</p>
              <button onClick={() => setTab("compose")} className="mt-3 text-green-400 hover:underline text-sm">
                Create your first campaign →
              </button>
            </div>
          )}
          {campaigns.map(c => (
            <div key={c.id} className={`bg-gray-900 border rounded-xl p-4 ${statusBg(c.status)}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <button onClick={() => openDetail(c.id)} className="font-semibold hover:text-green-400 transition-colors text-left">
                    {c.name}
                  </button>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-medium capitalize ${statusColor(c.status)}`}>{c.status}</span>
                    <span className="text-gray-600 text-xs">·</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {c.total} contacts
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {c.status === "draft" && (
                    <button onClick={() => startCampaign(c.id)} disabled={!waStatus.connected}
                      className="p-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 transition-colors" title="Start">
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {c.status === "running" && (
                    <button onClick={() => pauseCampaign(c.id)}
                      className="p-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 transition-colors" title="Pause">
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {c.status === "paused" && (
                    <button onClick={() => startCampaign(c.id)} disabled={!waStatus.connected}
                      className="p-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 transition-colors" title="Resume">
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(c.status === "running" || c.status === "paused") && (
                    <button onClick={() => cancelCampaign(c.id)}
                      className="p-1.5 rounded-lg bg-red-600/40 hover:bg-red-600 transition-colors" title="Cancel">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => deleteCampaign(c.id)}
                    className="p-1.5 rounded-lg bg-gray-700 hover:bg-red-600 transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <Progress sent={c.sent} failed={c.failed} total={c.total} />
            </div>
          ))}

          {/* Detail panel */}
          {detail && (
            <div className="mt-4 bg-gray-900 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{detail.name}</h3>
                <button onClick={() => setDetail(null)} className="text-gray-500 hover:text-white text-xs">✕ Close</button>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap mb-3 font-mono text-xs">
                {detail.message}
              </div>
              <Progress
                sent={detail.results.filter(r=>r.status==="sent").length}
                failed={detail.results.filter(r=>r.status==="failed").length}
                total={detail.contacts.length}
              />
              {detail.results.length > 0 && (
                <div className="mt-3">
                  <button onClick={() => setShowResults(p=>!p)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white">
                    {showResults ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showResults ? "Hide" : "Show"} results ({detail.results.length})
                  </button>
                  {showResults && (
                    <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                      {detail.results.map((r, i) => (
                        <div key={i} className={`flex items-center justify-between text-xs p-2 rounded-lg ${
                          r.status==="sent" ? "bg-green-500/10" : "bg-red-500/10"
                        }`}>
                          <span className="text-gray-300">{r.name || r.phone}</span>
                          <span className={r.status==="sent" ? "text-green-400" : "text-red-400"}>
                            {r.status==="sent" ? "✓ Sent" : "✗ " + (r.error || "Failed")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick single send */}
          <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Send className="w-4 h-4 text-green-400" /> Send Single Message
            </h3>
            <div className="space-y-2">
              <input value={singlePhone} onChange={e=>setSinglePhone(e.target.value)}
                placeholder="+254712345678 or 0712345678"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500/50" />
              <textarea value={singleMsg} onChange={e=>setSingleMsg(e.target.value)}
                placeholder="Your message…" rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-500/50" />
              <button onClick={sendSingle} disabled={singleSending || !waStatus.connected || !singlePhone || !singleMsg}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                {singleSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COMPOSE TAB ───────────────────────────────────────────────────── */}
      {tab === "compose" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Campaign Name</label>
            <input value={campName} onChange={e=>setCampName(e.target.value)}
              placeholder="e.g. June Promo 2025"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500/50" />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Message Template <span className="text-gray-600">(use {"{{name}}"} and {"{{phone}}"} as placeholders)</span>
            </label>
            <textarea value={campMsg} onChange={e=>setCampMsg(e.target.value)}
              placeholder={"Hi {{name}}! 👋 Special offer just for you. Visit chegetech.co today! 🎉"}
              rows={5}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-green-500/50 font-mono" />
            <div className="flex gap-2 mt-1">
              {["{{name}}", "{{phone}}"].map(tag => (
                <button key={tag} onClick={() => setCampMsg(m=>m+tag)}
                  className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-gray-400 hover:text-white">
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-gray-400">Contacts (CSV)</label>
              <label className="flex items-center gap-1 text-xs text-green-400 cursor-pointer hover:text-green-300">
                <Upload className="w-3 h-3" /> Upload CSV file
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            <textarea value={csvText} onChange={e=>setCsvText(e.target.value)}
              placeholder={"name,phone\nJohn Doe,+254712345678\nJane,0712000001\n\nOr just paste phone numbers (one per line)"}
              rows={7}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-green-500/50 font-mono text-xs" />
            {parsedCount > 0 && (
              <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> ~{parsedCount} contacts detected
              </p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              Supports: name,phone · phone,name · one number per line · +254 or 07xx format
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Delay between messages</label>
            <select value={delayMs} onChange={e=>setDelayMs(Number(e.target.value))}
              className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500/50">
              <option value={2000}>2 seconds (faster, higher ban risk)</option>
              <option value={4000}>4 seconds (recommended)</option>
              <option value={7000}>7 seconds (safer for large lists)</option>
              <option value={10000}>10 seconds (safest)</option>
            </select>
          </div>

          {createErr && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {createErr}
            </div>
          )}

          <button onClick={createCampaign} disabled={creating || !campName || !campMsg || !csvText}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
            {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Campaign
          </button>
          <p className="text-xs text-gray-500 text-center">Campaign is created as a draft — start it from the Campaigns tab</p>
        </div>
      )}

      {/* ── API & KEYS TAB ────────────────────────────────────────────────── */}
      {tab === "api" && (
        <div className="space-y-6">
          {/* API keys */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Key className="w-4 h-4 text-yellow-400" /> API Keys
            </h3>
            <div className="space-y-2 mb-3">
              {apiKeys.map(k => (
                <div key={k.key} className="flex items-center justify-between bg-gray-800 rounded-lg p-2.5">
                  <div>
                    <p className="text-xs font-medium text-gray-300">{k.label}</p>
                    <p className="text-xs font-mono text-gray-500">{k.key}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => copyKey(k.key)} className="p-1.5 rounded text-gray-400 hover:text-white">
                      {copied===k.key ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => deleteApiKey(k.key)} className="p-1.5 rounded text-gray-400 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newKeyLabel} onChange={e=>setNewKeyLabel(e.target.value)}
                placeholder="Key label (e.g. My App)"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500/50" />
              <button onClick={createApiKey} disabled={!newKeyLabel}
                className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Generate
              </button>
            </div>
          </div>

          {/* API docs */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="font-semibold mb-3">API Reference</h3>
            <div className="space-y-4 text-xs">
              {[
                {
                  method: "POST", path: "/api/v1/whatsapp/send",
                  desc: "Send a single message",
                  body: `{ "to": "+254712345678", "message": "Hello!", "apiKey": "YOUR_KEY" }`
                },
                {
                  method: "POST", path: "/api/v1/whatsapp/bulk",
                  desc: "Send to multiple numbers",
                  body: `{ "contacts": [{ "to": "+254712345678", "name": "John" }], "message": "Hi {{name}}!", "apiKey": "YOUR_KEY", "delayMs": 3000 }`
                },
                {
                  method: "GET", path: "/api/v1/whatsapp/status",
                  desc: "Check connection status",
                  body: null
                },
                {
                  method: "GET", path: "/api/v1/whatsapp/campaign/:id",
                  desc: "Get campaign progress",
                  body: null
                },
              ].map(ep => (
                <div key={ep.path} className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${ep.method==="GET" ? "bg-blue-600" : "bg-green-700"}`}>
                      {ep.method}
                    </span>
                    <code className="text-gray-300 font-mono">{ep.path}</code>
                  </div>
                  <p className="text-gray-500 mb-2">{ep.desc}</p>
                  {ep.body && (
                    <pre className="bg-gray-950 rounded p-2 text-gray-400 overflow-x-auto whitespace-pre-wrap">{ep.body}</pre>
                  )}
                  <p className="text-gray-600 mt-2">Auth: header <code>x-api-key: YOUR_KEY</code> or body/query <code>apiKey</code></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
