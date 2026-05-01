import { useState, useEffect, useCallback } from "react";
import { Mail, Copy, Check, RefreshCw, Inbox, ArrowLeft, Loader2, Trash2, CreditCard, CheckCircle, XCircle, AlertCircle, Zap } from "lucide-react";

const SESSION_KEY = "ct_tempmail";

interface MailSession { address: string; token: string; }
interface Message { id: string; from: { address: string; name: string }; subject: string; createdAt: string; seen: boolean; }
interface FullMessage extends Message { html?: string[]; text?: string; }
interface CardResult { card: string; status: "live"|"dead"|"error"|"invalid"; bank?: string; type?: string; country?: string; error?: string; }

function saveSession(s: MailSession) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
function loadSession(): MailSession | null { try { return JSON.parse(localStorage.getItem(SESSION_KEY)||"null"); } catch { return null; } }

// Luhn-complete a partial card number
function luhnComplete(partial: string): string {
  while (partial.length < 15) partial += String(Math.floor(Math.random() * 10));
  let sum = 0; let alt = false;
  for (let i = partial.length - 1; i >= 0; i--) {
    let n = parseInt(partial[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return partial + ((10 - (sum % 10)) % 10);
}

export default function TempMailPage() {
  const [activeTab, setActiveTab] = useState<"mail"|"cc">("mail");

  // ── TempMail state ──
  const [session, setSession] = useState<MailSession|null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<FullMessage|null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date|null>(null);
  const [newCount, setNewCount] = useState(0);

  // ── CC Tools state ──
  const [ccTab, setCcTab] = useState<"generate"|"check">("generate");
  // Generator
  const [genBin, setGenBin] = useState("");
  const [genCount, setGenCount] = useState("10");
  const [genMonth, setGenMonth] = useState("");
  const [genYear, setGenYear] = useState("");
  const [genCvv, setGenCvv] = useState("");
  const [genCards, setGenCards] = useState<string[]>([]);
  const [genCopied, setGenCopied] = useState<string|null>(null);
  // Checker
  const [ccInput, setCcInput] = useState("");
  const [ccResults, setCcResults] = useState<CardResult[]>([]);
  const [ccChecking, setCcChecking] = useState(false);
  const [ccCopied, setCcCopied] = useState<string|null>(null);

  const create = useCallback(async () => {
    setCreating(true); setMessages([]); setSelected(null); setNewCount(0);
    try {
      const r = await fetch("/api/tempmail/create", { method:"POST" });
      const d = await r.json();
      if (d.success) { const s = { address: d.address, token: d.token }; saveSession(s); setSession(s); }
    } catch(e) { console.error(e); }
    setCreating(false); setLoading(false);
  }, []);

  const fetchInbox = useCallback(async (tok: string, silent=false) => {
    if (!silent) setRefreshing(true);
    try {
      const r = await fetch(`/api/tempmail/inbox?token=${encodeURIComponent(tok)}`);
      const d = await r.json();
      if (d.success) {
        setMessages(prev => {
          const ids = new Set(prev.map(m=>m.id));
          const fresh = (d.messages as Message[]).filter(m=>!ids.has(m.id));
          if (fresh.length) setNewCount(n=>n+fresh.length);
          return d.messages;
        });
        setLastRefresh(new Date());
      } else if (d.expired) { localStorage.removeItem(SESSION_KEY); setSession(null); create(); }
    } catch {}
    if (!silent) setRefreshing(false);
  }, [create]);

  const readMessage = useCallback(async (msg: Message) => {
    if (!session) return;
    setSelected(msg as FullMessage);
    setNewCount(n=>Math.max(0,n-1));
    try {
      const r = await fetch(`/api/tempmail/read/${msg.id}?token=${encodeURIComponent(session.token)}`);
      const d = await r.json();
      if (d.success) setSelected(d.message);
    } catch {}
  }, [session]);

  useEffect(() => {
    const saved = loadSession();
    if (saved) { setSession(saved); fetchInbox(saved.token).finally(()=>setLoading(false)); }
    else create();
  }, []);

  useEffect(() => {
    if (!session) return;
    const t = setInterval(()=>fetchInbox(session.token, true), 12000);
    return ()=>clearInterval(t);
  }, [session, fetchInbox]);

  const copy = () => { if(!session) return; navigator.clipboard.writeText(session.address); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const clear = () => { localStorage.removeItem(SESSION_KEY); create(); };
  const timeAgo = (d: string) => {
    const s = Math.floor((Date.now()-new Date(d).getTime())/1000);
    if(s<60) return `${s}s ago`; if(s<3600) return `${Math.floor(s/60)}m ago`; return `${Math.floor(s/3600)}h ago`;
  };

  // CC generator (client-side Luhn)
  const generateCards = () => {
    const prefix = genBin.trim() || "4";
    const n = Math.min(parseInt(genCount)||10, 20);
    const cards: string[] = [];
    for (let i = 0; i < n; i++) {
      const num = luhnComplete(prefix);
      const mm = genMonth || String(Math.floor(Math.random()*12)+1).padStart(2,"0");
      const yy = genYear || String(new Date().getFullYear()+2).slice(-2);
      const cv = genCvv || String(Math.floor(Math.random()*900)+100);
      cards.push(`${num}|${mm}|${yy}|${cv}`);
    }
    setGenCards(cards);
  };

  const checkCards = async () => {
    const lines = ccInput.split("\n").map(l=>l.trim()).filter(Boolean);
    if (!lines.length) return;
    setCcChecking(true); setCcResults([]);
    try {
      const r = await fetch("/api/tools/cc/check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: lines })
      });
      const d = await r.json();
      if (d.success) setCcResults(d.results);
      else setCcResults([{ card:"", status:"error", error: d.error }]);
    } catch(e:any) { setCcResults([{ card:"", status:"error", error: e.message }]); }
    setCcChecking(false);
  };

  const copyCard = (card: string, setter: (v:string|null)=>void) => {
    navigator.clipboard.writeText(card); setter(card); setTimeout(()=>setter(null),1500);
  };

  const liveCards = ccResults.filter(r=>r.status==="live");

  if (loading || creating) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3">
      <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 mb-2"><Mail className="w-7 h-7 text-sky-400"/></div>
      <Loader2 className="w-6 h-6 animate-spin text-sky-400"/>
      <p className="text-white/40 text-sm">{creating?"Generating your inbox...":"Loading..."}</p>
    </div>
  );

  if (selected) return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={()=>setSelected(null)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10"><ArrowLeft className="w-4 h-4"/></button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{selected.subject||"(no subject)"}</p>
          <p className="text-xs text-white/40">From: {selected.from?.address}</p>
        </div>
        <span className="text-xs text-white/30">{timeAgo(selected.createdAt)}</span>
      </div>
      <div className="flex-1 p-4">
        {selected.html?.length ? (
          <iframe srcDoc={selected.html.join("")} className="w-full min-h-96 rounded-xl border border-white/10 bg-white" sandbox="allow-same-origin" title="email-content"/>
        ) : (
          <pre className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed bg-white/5 border border-white/10 rounded-xl p-4">{selected.text||"(empty message)"}</pre>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <Mail className="w-5 h-5 text-sky-400"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Free Tools</h1>
            <p className="text-xs text-white/40">TempMail & CC Tools — free, no tracking</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-xl border border-white/8">
          <button onClick={()=>setActiveTab("mail")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab==="mail" ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" : "text-white/40 hover:text-white/60"}`}>
            <Mail className="w-4 h-4"/> TempMail
            {newCount > 0 && <span className="bg-sky-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold leading-none">{newCount}</span>}
          </button>
          <button onClick={()=>setActiveTab("cc")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab==="cc" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-white/40 hover:text-white/60"}`}>
            <CreditCard className="w-4 h-4"/> CC Tools
          </button>
        </div>

        {/* ── TempMail Tab ── */}
        {activeTab === "mail" && (
          <div>
            {/* Email address card */}
            <div className="bg-white/5 border border-sky-500/20 rounded-2xl p-5 mb-5">
              <p className="text-xs text-white/40 mb-2">Your temporary inbox</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3">
                  <p className="text-base font-mono font-bold text-sky-300 break-all select-all">{session?.address}</p>
                </div>
                <button onClick={copy} className={`shrink-0 p-3 rounded-xl border transition-colors ${copied?"bg-emerald-500/10 border-emerald-500/30 text-emerald-400":"bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}>
                  {copied?<Check className="w-5 h-5"/>:<Copy className="w-5 h-5"/>}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={()=>session&&fetchInbox(session.token)} disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 disabled:opacity-40 transition-colors">
                  <RefreshCw className={`w-3 h-3 ${refreshing?"animate-spin":""}`}/> Refresh
                </button>
                <button onClick={clear} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors">
                  <Trash2 className="w-3 h-3"/> New Address
                </button>
                {lastRefresh && <span className="ml-auto text-xs text-white/20">Updated {timeAgo(lastRefresh.toISOString())}</span>}
              </div>
            </div>
            {/* Inbox */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Inbox className="w-4 h-4 text-white/30"/>
                <h2 className="text-sm font-medium text-white/50">Inbox</h2>
                {newCount > 0 && <span className="text-xs bg-sky-500 text-white px-2 py-0.5 rounded-full font-bold">{newCount} new</span>}
                {messages.length > 0 && <span className="ml-auto text-xs text-white/20">{messages.length} message{messages.length!==1?"s":""}</span>}
              </div>
              {messages.length === 0 ? (
                <div className="text-center py-16 text-white/20">
                  <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30"/>
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1 text-white/15">Emails sent to your address appear here automatically</p>
                  <p className="text-xs mt-3 text-white/15">Inbox refreshes every 12 seconds</p>
                </div>
              ) : (
                messages.map(m => (
                  <button key={m.id} onClick={()=>readMessage(m)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${!m.seen?"bg-sky-500/5 border-sky-500/20":"bg-white/3 border-white/8 hover:bg-white/5"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${!m.seen?"bg-sky-400":"bg-transparent"}`}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className={`text-sm truncate ${!m.seen?"font-semibold text-white":"font-normal text-white/60"}`}>
                            {m.from?.name||m.from?.address||"Unknown sender"}
                          </p>
                          <span className="text-xs text-white/25 shrink-0">{timeAgo(m.createdAt)}</span>
                        </div>
                        <p className={`text-sm truncate ${!m.seen?"text-white/80":"text-white/40"}`}>{m.subject||"(no subject)"}</p>
                        <p className="text-xs text-white/25 truncate mt-0.5">{m.from?.address}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="mt-8 p-4 rounded-2xl bg-white/3 border border-white/8 text-center">
              <p className="text-xs text-white/30">Inbox is temporary — messages deleted after 24 hours.</p>
            </div>
          </div>
        )}

        {/* ── CC Tools Tab ── */}
        {activeTab === "cc" && (
          <div>
            {/* CC sub-tabs */}
            <div className="flex gap-2 mb-5 bg-white/3 p-1 rounded-xl border border-white/8">
              <button onClick={()=>setCcTab("generate")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${ccTab==="generate" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-white/40 hover:text-white/60"}`}>
                <Zap className="w-4 h-4"/> Generate
              </button>
              <button onClick={()=>setCcTab("check")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${ccTab==="check" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "text-white/40 hover:text-white/60"}`}>
                <CheckCircle className="w-4 h-4"/> Check
              </button>
            </div>

            {/* Generator */}
            {ccTab === "generate" && (
              <div>
                <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5 mb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">BIN prefix (optional)</label>
                      <input value={genBin} onChange={e=>setGenBin(e.target.value)} placeholder="e.g. 411111" maxLength={16}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-white/80 placeholder-white/20 focus:outline-none focus:border-violet-500/40"/>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Count (max 20)</label>
                      <input value={genCount} onChange={e=>setGenCount(e.target.value)} type="number" min="1" max="20" placeholder="10"
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-violet-500/40"/>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Month (optional)</label>
                      <input value={genMonth} onChange={e=>setGenMonth(e.target.value)} placeholder="01–12" maxLength={2}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-white/80 placeholder-white/20 focus:outline-none focus:border-violet-500/40"/>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Year (optional)</label>
                      <input value={genYear} onChange={e=>setGenYear(e.target.value)} placeholder="26" maxLength={4}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-white/80 placeholder-white/20 focus:outline-none focus:border-violet-500/40"/>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-white/40 mb-1 block">CVV (optional)</label>
                      <input value={genCvv} onChange={e=>setGenCvv(e.target.value)} placeholder="random 3-digit" maxLength={4}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-white/80 placeholder-white/20 focus:outline-none focus:border-violet-500/40"/>
                    </div>
                  </div>
                  <button onClick={generateCards}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/30 transition-colors">
                    <Zap className="w-4 h-4"/> Generate Cards
                  </button>
                </div>
                {genCards.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-white/40">{genCards.length} cards generated</p>
                      <button onClick={()=>{ navigator.clipboard.writeText(genCards.join("\n")); }}
                        className="text-xs text-violet-400 hover:text-violet-300 px-3 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition-colors">
                        Copy all
                      </button>
                    </div>
                    {genCards.map((c,i) => (
                      <div key={i} className="flex items-center gap-2 bg-white/3 border border-white/8 rounded-xl px-3 py-2.5">
                        <p className="flex-1 text-xs font-mono text-white/70 truncate">{c}</p>
                        <button onClick={()=>copyCard(c, setGenCopied)} className="shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
                          {genCopied===c ? <Check className="w-3.5 h-3.5 text-emerald-400"/> : <Copy className="w-3.5 h-3.5"/>}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Checker */}
            {ccTab === "check" && (
              <div>
                <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5 mb-4">
                  <label className="text-xs text-white/40 mb-2 block">Paste cards — one per line (number|mm|yy|cvv)</label>
                  <textarea value={ccInput} onChange={e=>setCcInput(e.target.value)}
                    placeholder={"4111111111111111|01|26|123\n5500005555555559|12|27|456"}
                    rows={7}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white/80 placeholder-white/20 resize-y focus:outline-none focus:border-violet-500/40"/>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-white/30">{ccInput.split("\n").filter(l=>l.trim()).length} card(s) · max 30</p>
                    <button onClick={checkCards} disabled={ccChecking||!ccInput.trim()}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/30 disabled:opacity-40 transition-colors">
                      {ccChecking ? <Loader2 className="w-4 h-4 animate-spin"/> : <CreditCard className="w-4 h-4"/>}
                      {ccChecking ? "Checking..." : "Check Cards"}
                    </button>
                  </div>
                </div>
                {ccResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex gap-3 mb-3">
                      <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-center">
                        <p className="text-lg font-bold text-emerald-400">{liveCards.length}</p>
                        <p className="text-xs text-white/40">Live</p>
                      </div>
                      <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-center">
                        <p className="text-lg font-bold text-red-400">{ccResults.filter(r=>r.status==="dead").length}</p>
                        <p className="text-xs text-white/40">Dead</p>
                      </div>
                      <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center">
                        <p className="text-lg font-bold text-white/60">{ccResults.length}</p>
                        <p className="text-xs text-white/40">Total</p>
                      </div>
                    </div>
                    {ccResults.map((r,i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${r.status==="live"?"bg-emerald-500/5 border-emerald-500/20":r.status==="dead"?"bg-red-500/5 border-red-500/15":"bg-white/3 border-white/8"}`}>
                        <div className="shrink-0">
                          {r.status==="live" ? <CheckCircle className="w-4 h-4 text-emerald-400"/> : r.status==="dead" ? <XCircle className="w-4 h-4 text-red-400"/> : <AlertCircle className="w-4 h-4 text-white/30"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-white/70 truncate">{r.card}</p>
                          {r.bank && <p className="text-xs text-white/35 mt-0.5">{r.bank}{r.country?` · ${r.country}`:""}{r.type?` · ${r.type}`:""}</p>}
                          {r.error && <p className="text-xs text-red-400/70 mt-0.5">{r.error}</p>}
                        </div>
                        <button onClick={()=>copyCard(r.card, setCcCopied)} className="shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
                          {ccCopied===r.card ? <Check className="w-3.5 h-3.5 text-emerald-400"/> : <Copy className="w-3.5 h-3.5"/>}
                        </button>
                      </div>
                    ))}
                    {liveCards.length > 0 && (
                      <button onClick={()=>navigator.clipboard.writeText(liveCards.map(r=>r.card).join("\n"))}
                        className="w-full mt-2 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors">
                        Copy all live ({liveCards.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}