import { useState, useEffect, useCallback } from "react";
import { Shield, Globe, Zap, Copy, Check, Loader2, Wifi, RefreshCw, Download, Lock, Unlock, RotateCw, X } from "lucide-react";

interface ProxyPlan {
  id: number; name: string; description: string; type: string;
  gb_amount: number | null; country: string | null; price_kes: number;
  bandwidth: string; speed: string; features: string; is_active: boolean;
}

interface FreeProxy {
  ip: string; port: string; type: string; country: string; countryCode: string;
  anonymity: string; speed: number; upTime: number;
}

const TYPE_COLORS: Record<string, string> = {
  residential: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  rotating:    "bg-blue-500/15 text-blue-400 border-blue-500/25",
  datacenter:  "bg-violet-500/15 text-violet-400 border-violet-500/25",
  static:      "bg-amber-500/15 text-amber-400 border-amber-500/25",
};

const ANON_META: Record<string, {label:string; color:string; icon:any}> = {
  elite:       { label:"Elite",       color:"text-emerald-400", icon: Lock   },
  anonymous:   { label:"Anonymous",   color:"text-blue-400",    icon: Shield },
  transparent: { label:"Transparent", color:"text-amber-400",   icon: Unlock },
};

const COUNTRY_FLAG = (code: string) => code ? String.fromCodePoint(...[...code.toUpperCase()].map(c=>c.charCodeAt(0)+127397)) : "🌍";

const PROTO_TYPES = ["all","http","https","socks4","socks5"];

export default function ProxyPage() {
  const [tab, setTab] = useState<"free"|"paid">("free");

  // ── Paid plans state ────────────────────────────────────────────────────
  const [plans, setPlans] = useState<ProxyPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [paidFilter, setPaidFilter] = useState("all");
  const [ordering, setOrdering] = useState<ProxyPlan | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // ── Free proxies state ──────────────────────────────────────────────────
  const [freeProxies, setFreeProxies] = useState<FreeProxy[]>([]);
  const [freeLoading, setFreeLoading] = useState(false);
  const [protoFilter, setProtoFilter] = useState("all");
  const [copiedProxy, setCopiedProxy] = useState<string|null>(null);
  const [lastFetched, setLastFetched] = useState<Date|null>(null);
  const [copyAllDone, setCopyAllDone] = useState(false);

  useEffect(() => {
    fetch("/api/proxy/plans")
      .then(r => r.json())
      .then(d => { if (d.success) setPlans(d.plans); })
      .catch(() => {})
      .finally(() => setPlansLoading(false));
  }, []);

  const fetchFree = useCallback(async () => {
    setFreeLoading(true);
    try {
      const r = await fetch("/api/proxy/free");
      const d = await r.json();
      if (d.success) { setFreeProxies(d.proxies); setLastFetched(new Date()); }
    } catch {}
    setFreeLoading(false);
  }, []);

  useEffect(() => { if (tab === "free" && !freeProxies.length) fetchFree(); }, [tab]);

  const copyProxy = (proxy: FreeProxy) => {
    const text = `${proxy.ip}:${proxy.port}`;
    navigator.clipboard.writeText(text);
    setCopiedProxy(text); setTimeout(() => setCopiedProxy(null), 1500);
  };
  const copyAll = () => {
    const filtered = freeProxies.filter(p => protoFilter === "all" || p.type.toLowerCase() === protoFilter);
    navigator.clipboard.writeText(filtered.map(p=>`${p.ip}:${p.port}`).join('\n'));
    setCopyAllDone(true); setTimeout(()=>setCopyAllDone(false),2000);
  };
  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(t); setTimeout(()=>setCopied(null),2000); };

  const placeOrder = async () => {
    if (!ordering) return; setOrderLoading(true);
    try {
      const res = await fetch("/api/proxy/order", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ planId: ordering.id }) });
      const data = await res.json();
      if (data.success && data.paymentUrl) window.location.href = data.paymentUrl;
      else alert(data.error || "Order failed. Please try again.");
    } catch { alert("Network error. Please try again."); }
    setOrderLoading(false);
  };

  const filteredFree = freeProxies.filter(p => protoFilter === "all" || p.type.toLowerCase() === protoFilter);
  const filteredPaid = plans.filter(p => paidFilter === "all" || p.type === paidFilter);
  const feats = (f: string) => { try { return JSON.parse(f||"[]"); } catch { return f ? f.split("\n").filter(Boolean) : []; } };
  const timeAgo = (d: Date) => { const s=Math.floor((Date.now()-d.getTime())/1000); if(s<60) return `${s}s ago`; return `${Math.floor(s/60)}m ago`; };

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Shield className="w-5 h-5 text-emerald-400"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Proxy Store</h1>
            <p className="text-xs text-white/40">Free public proxies or premium private plans</p>
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex gap-2 mb-6">
          {[{k:"free",label:"🆓 Free Proxies"},{k:"paid",label:"💎 Paid Plans"}].map(({k,label})=>(
            <button key={k} onClick={()=>setTab(k as any)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${tab===k?"bg-emerald-500/20 border-emerald-500/30 text-emerald-300":"bg-white/5 border-white/10 text-white/50 hover:bg-white/10"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── FREE PROXIES TAB ─────────────────────────────────────────── */}
        {tab === "free" && (
          <div>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {/* Protocol filters */}
              <div className="flex gap-1.5 flex-wrap">
                {PROTO_TYPES.map(t=>(
                  <button key={t} onClick={()=>setProtoFilter(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase border transition-colors ${protoFilter===t?"bg-emerald-500/20 border-emerald-500/30 text-emerald-300":"bg-white/5 border-white/10 text-white/40 hover:bg-white/10"}`}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {lastFetched && <span className="text-xs text-white/20">{timeAgo(lastFetched)}</span>}
                <button onClick={fetchFree} disabled={freeLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 disabled:opacity-40 transition-colors">
                  <RefreshCw className={`w-3 h-3 ${freeLoading?"animate-spin":""}`}/>Refresh
                </button>
                <button onClick={copyAll} disabled={!filteredFree.length}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${copyAllDone?"bg-emerald-500/20 border-emerald-500/30 text-emerald-400":"bg-white/5 border-white/10 text-white/50 hover:bg-white/10"}`}>
                  {copyAllDone?<Check className="w-3 h-3"/>:<Download className="w-3 h-3"/>}
                  {copyAllDone?"Copied!":"Copy All"}
                </button>
              </div>
            </div>

            {/* Stats bar */}
            {filteredFree.length > 0 && (
              <div className="flex gap-3 mb-4 text-xs text-white/30">
                <span className="text-emerald-400 font-bold">{filteredFree.length}</span> proxies
                <span>·</span>
                <span>{filteredFree.filter(p=>p.anonymity==="elite").length} elite</span>
                <span>·</span>
                <span>{filteredFree.filter(p=>p.anonymity==="anonymous").length} anonymous</span>
              </div>
            )}

            {freeLoading ? (
              <div className="flex flex-col items-center py-16 gap-3 text-white/30">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400/40"/>
                <p className="text-sm">Fetching fresh proxies...</p>
              </div>
            ) : filteredFree.length === 0 ? (
              <div className="text-center py-16 text-white/30">
                <Globe className="w-10 h-10 mx-auto mb-3 opacity-30"/>
                <p className="text-sm">No proxies found</p>
                <button onClick={fetchFree} className="mt-3 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm hover:bg-emerald-500/20">Fetch Proxies</button>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1fr_auto] gap-2 px-4 py-2 bg-white/5 border-b border-white/10 text-xs text-white/30 font-medium uppercase tracking-wide">
                  <span>IP : Port</span><span>Type</span><span>Country</span><span>Anonymity</span><span>Speed</span><span></span>
                </div>
                <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
                  {filteredFree.map((p, i) => {
                    const anonMeta = ANON_META[p.anonymity] || ANON_META.transparent;
                    const AnonIcon = anonMeta.icon;
                    const proxyStr = `${p.ip}:${p.port}`;
                    const speedBar = Math.min(100, Math.round(p.speed || 0));
                    return (
                      <div key={i} className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1fr_auto] gap-2 px-4 py-2.5 items-center hover:bg-white/3 transition-colors">
                        <code className="text-xs font-mono text-green-400 truncate">{proxyStr}</code>
                        <span className="text-xs uppercase font-bold text-white/50">{p.type}</span>
                        <span className="text-xs text-white/50 truncate">{COUNTRY_FLAG(p.countryCode)} {p.country||"Unknown"}</span>
                        <span className={`flex items-center gap-1 text-xs ${anonMeta.color}`}>
                          <AnonIcon className="w-3 h-3 shrink-0"/>{anonMeta.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${speedBar>60?"bg-emerald-500":speedBar>30?"bg-amber-500":"bg-red-500"}`} style={{width:`${speedBar}%`}}/>
                          </div>
                        </div>
                        <button onClick={()=>copyProxy(p)}
                          className={`p-1.5 rounded-lg border transition-colors shrink-0 ${copiedProxy===proxyStr?"bg-emerald-500/10 border-emerald-500/20 text-emerald-400":"bg-white/5 border-white/10 text-white/30 hover:text-white hover:bg-white/10"}`}>
                          {copiedProxy===proxyStr?<Check className="w-3 h-3"/>:<Copy className="w-3 h-3"/>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15">
              <p className="text-xs text-amber-400/70 font-medium mb-1">⚠️ Free proxy disclaimer</p>
              <p className="text-xs text-white/30">Free proxies are public and shared — not suitable for sensitive tasks. For privacy, speed, and dedicated IPs switch to a Paid Plan.</p>
            </div>
          </div>
        )}

        {/* ── PAID PLANS TAB ───────────────────────────────────────────── */}
        {tab === "paid" && (
          <div>
            {/* Type filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
              {["all","residential","rotating","datacenter","static"].map(t=>(
                <button key={t} onClick={()=>setPaidFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border shrink-0 transition-colors capitalize ${paidFilter===t?"bg-emerald-500/20 border-emerald-500/30 text-emerald-300":"bg-white/5 border-white/10 text-white/50 hover:bg-white/10"}`}>
                  {t}
                </button>
              ))}
            </div>

            {plansLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(4)].map((_,i)=>(
                  <div key={i} className="bg-white/5 rounded-2xl p-5 animate-pulse">
                    <div className="h-4 w-24 bg-white/10 rounded mb-3"/><div className="h-6 w-40 bg-white/10 rounded mb-4"/><div className="h-10 w-full bg-white/10 rounded-xl"/>
                  </div>
                ))}
              </div>
            ) : filteredPaid.length === 0 ? (
              <div className="text-center py-16 text-white/30">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-30"/>
                <p>No plans in this category yet</p>
                <p className="text-xs mt-1 text-white/20">Check back soon or try another type</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredPaid.map(plan => {
                  const fs = feats(plan.features);
                  return (
                    <div key={plan.id} className="bg-white/5 border border-white/8 rounded-2xl p-5 hover:bg-white/8 hover:border-emerald-500/20 transition-all flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${TYPE_COLORS[plan.type]||"bg-white/5 text-white/40 border-white/10"}`}>
                          {plan.type}
                        </span>
                        {plan.country && <span className="text-xs text-white/30 flex items-center gap-1"><Globe className="w-3 h-3"/>{plan.country}</span>}
                      </div>
                      <h3 className="font-bold text-white text-base mb-1">{plan.name}</h3>
                      {plan.description && <p className="text-xs text-white/40 mb-3 leading-relaxed">{plan.description}</p>}
                      <div className="flex gap-3 mb-3 text-xs text-white/40">
                        {plan.bandwidth && <span className="flex items-center gap-1"><Wifi className="w-3 h-3"/>{plan.bandwidth}</span>}
                        {plan.speed && <span className="flex items-center gap-1"><Zap className="w-3 h-3"/>{plan.speed}</span>}
                        {plan.gb_amount && <span className="flex items-center gap-1"><Globe className="w-3 h-3"/>{plan.gb_amount} GB</span>}
                      </div>
                      {fs.length > 0 && (
                        <ul className="space-y-1 mb-4 flex-1">
                          {fs.slice(0,4).map((f:string,i:number)=>(
                            <li key={i} className="flex items-center gap-1.5 text-xs text-white/50">
                              <Check className="w-3 h-3 text-emerald-400 shrink-0"/>{f}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-2xl font-bold">KES {(plan.price_kes||0).toLocaleString()}</p>
                        <p className="text-xs text-white/30">one-time</p>
                      </div>
                      <button onClick={()=>setOrdering(plan)}
                        className="w-full py-2.5 rounded-xl text-sm font-medium bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-colors flex items-center justify-center gap-2">
                        <Shield className="w-4 h-4"/>Get Proxy
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order modal */}
      {ordering && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)setOrdering(null);}}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20"><Shield className="w-5 h-5 text-emerald-400"/></div>
              <div className="flex-1"><h3 className="font-bold text-white">{ordering.name}</h3><p className="text-xs text-white/40 capitalize">{ordering.type} proxy</p></div>
              <button onClick={()=>setOrdering(null)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10"><X className="w-4 h-4"/></button>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between mb-4">
              <span className="text-sm text-white/60">Total</span>
              <span className="text-2xl font-bold">KES {(ordering.price_kes||0).toLocaleString()}</span>
            </div>
            <p className="text-xs text-white/30 text-center mb-4">After payment, credentials will be delivered to you by the admin within a few hours.</p>
            <div className="flex gap-2">
              <button onClick={()=>setOrdering(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm">Cancel</button>
              <button onClick={placeOrder} disabled={orderLoading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {orderLoading?<Loader2 className="w-4 h-4 animate-spin"/>:null}{orderLoading?"Processing...":"Pay with Paystack"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
