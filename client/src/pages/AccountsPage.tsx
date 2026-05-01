import { useState, useEffect } from "react";
import { Users, Mail, CheckCircle, Copy, Check, Loader2, X, Package } from "lucide-react";

interface DigitalProduct {
  id: number;
  name: string;
  platform: string;
  category: string;
  price_kes: number;
  description: string;
  features: string;
  stock_count: number;
  sort_order: number;
}

const PLATFORM_EMOJI: Record<string, string> = {
  Instagram:"📸", TikTok:"🎵", Twitter:"🐦", Facebook:"📘", LinkedIn:"💼",
  Gmail:"📧", Outlook:"📨", Yahoo:"📮", "ProtonMail":"🔒", Other:"📱",
};

const SOCIAL_PLATFORMS = ["All","Instagram","TikTok","Twitter","Facebook","LinkedIn"];
const EMAIL_PLATFORMS  = ["All","Gmail","Outlook","Yahoo","ProtonMail"];

export default function AccountsPage() {
  const [tab, setTab] = useState<"social"|"email">("social");
  const [platform, setPlatform] = useState("All");
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState<DigitalProduct|null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [verifying, setVerifying] = useState<string|null>(null);
  const [credentials, setCredentials] = useState<string|null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/digital/products")
      .then(r=>r.json())
      .then(d=>{ if(d.success) setProducts(d.products); })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, []);

  // Handle Paystack return
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref") || new URLSearchParams(window.location.search).get("reference");
    if (!ref) return;
    setVerifying(ref);
    fetch(`/api/digital/verify/${ref}`)
      .then(r=>r.json())
      .then(d=>{ if(d.success && d.credentials) setCredentials(d.credentials); else setCredentials("Payment verified! Your account will be delivered to your email shortly."); })
      .catch(()=>setCredentials("Payment received. Check your email for account credentials."))
      .finally(()=>{ setVerifying(null); window.history.replaceState({}, "", "/accounts"); });
  }, []);

  const copy = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false), 2000); };

  const placeOrder = async () => {
    if (!ordering) return;
    setOrderLoading(true);
    try {
      const res = await fetch("/api/digital/order", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ productId: ordering.id }) });
      const data = await res.json();
      if (data.success && data.paymentUrl) window.location.href = data.paymentUrl;
      else alert(data.error || "Order failed. Please try again.");
    } catch { alert("Network error. Please try again."); }
    setOrderLoading(false);
  };

  const filtered = products.filter(p => {
    const catMatch = tab === "social" ? p.category === "social" : p.category === "email";
    const platMatch = platform === "All" || p.platform === platform;
    return catMatch && platMatch;
  });

  const tabs = tab === "social" ? SOCIAL_PLATFORMS : EMAIL_PLATFORMS;

  const feats = (f: string) => { try { return JSON.parse(f||"[]"); } catch { return f ? f.split("\n").filter(Boolean) : []; } };

  if (verifying) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center"><Loader2 className="w-10 h-10 animate-spin text-white/40 mx-auto mb-3"/><p className="text-white/60">Verifying payment...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Users className="w-5 h-5 text-violet-400"/>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Aged Accounts Store</h1>
              <p className="text-xs text-white/40">Verified aged social media and email accounts — instant delivery</p>
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-5">
          {[{k:"social",label:"📱 Social Media"},{k:"email",label:"📧 Email Accounts"}].map(({k,label}) => (
            <button key={k} onClick={()=>{ setTab(k as any); setPlatform("All"); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${tab===k?"bg-violet-500/20 border-violet-500/30 text-violet-300":"bg-white/5 border-white/10 text-white/50 hover:bg-white/10"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Platform sub-tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
          {tabs.map(p => (
            <button key={p} onClick={()=>setPlatform(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border shrink-0 transition-colors ${platform===p?"bg-violet-500/20 border-violet-500/30 text-violet-300":"bg-white/5 border-white/10 text-white/50 hover:bg-white/10"}`}>
              {PLATFORM_EMOJI[p]||""} {p}
            </button>
          ))}
        </div>

        {/* Products grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_,i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-5 animate-pulse">
                <div className="h-8 w-8 bg-white/10 rounded-lg mb-3"/><div className="h-4 w-32 bg-white/10 rounded mb-2"/>
                <div className="h-3 w-full bg-white/10 rounded mb-4"/><div className="h-10 w-full bg-white/10 rounded-xl"/>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-40"/>
            <p>No accounts in this category yet</p>
            <p className="text-xs mt-1">Check back soon or browse another platform</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => {
              const fs = feats(p.features);
              const inStock = p.stock_count > 0;
              return (
                <div key={p.id} className={`border rounded-2xl p-5 flex flex-col transition-all ${inStock?"bg-white/5 border-white/8 hover:bg-white/8 hover:border-violet-500/25":"bg-white/3 border-white/5 opacity-60"}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-3xl">{PLATFORM_EMOJI[p.platform]||"📱"}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-sm leading-snug">{p.name}</h3>
                      <p className="text-xs text-white/40 mt-0.5">{p.platform}</p>
                    </div>
                    <div className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${inStock?"bg-emerald-500/10 text-emerald-400 border-emerald-500/20":"bg-white/5 text-white/30 border-white/10"}`}>
                      {inStock ? `${p.stock_count} left` : "Out of stock"}
                    </div>
                  </div>
                  {p.description && <p className="text-xs text-white/50 mb-3 leading-relaxed">{p.description}</p>}
                  {fs.length > 0 && (
                    <ul className="space-y-1 mb-4 flex-1">
                      {fs.slice(0,4).map((f:string,i:number) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-white/50">
                          <CheckCircle className="w-3 h-3 text-violet-400 shrink-0"/>{f}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-2xl font-bold text-white">KES {p.price_kes.toLocaleString()}</p>
                    <p className="text-xs text-white/30">per account</p>
                  </div>
                  <button disabled={!inStock} onClick={()=>setOrdering(p)}
                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${inStock?"bg-violet-500/15 border border-violet-500/25 text-violet-400 hover:bg-violet-500/25":"bg-white/5 border border-white/10 text-white/25 cursor-not-allowed"}`}>
                    {inStock ? <><Users className="w-4 h-4"/>Buy Account</> : "Out of Stock"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 p-4 rounded-2xl bg-violet-500/5 border border-violet-500/15 text-center">
          <p className="text-sm text-white/50 mb-1">🔒 Secure instant delivery — credentials sent immediately after payment</p>
          <p className="text-xs text-white/30">All accounts are verified before listing. Need bulk quantities? Contact support.</p>
        </div>
      </div>

      {/* Order Modal */}
      {ordering && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)setOrdering(null);}}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">{PLATFORM_EMOJI[ordering.platform]||"📱"}</div>
              <div><h3 className="font-bold text-white">{ordering.name}</h3><p className="text-xs text-white/40">{ordering.platform} · {ordering.stock_count} in stock</p></div>
              <button onClick={()=>setOrdering(null)} className="ml-auto p-1.5 rounded-lg bg-white/5 hover:bg-white/10"><X className="w-4 h-4"/></button>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between mb-4">
              <span className="text-sm text-white/60">Total</span>
              <span className="text-2xl font-bold">KES {ordering.price_kes.toLocaleString()}</span>
            </div>
            <p className="text-xs text-white/30 text-center mb-4">Account credentials are delivered instantly after payment confirmation.</p>
            <div className="flex gap-2">
              <button onClick={()=>setOrdering(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10">Cancel</button>
              <button onClick={placeOrder} disabled={orderLoading} className="flex-1 py-2.5 rounded-xl bg-violet-500 text-white font-semibold text-sm hover:bg-violet-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {orderLoading?<Loader2 className="w-4 h-4 animate-spin"/>:null}{orderLoading?"Processing...":"Pay with Paystack"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {credentials && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-400"/>
              <h3 className="font-bold text-white text-lg">Payment Successful!</h3>
            </div>
            <p className="text-sm text-white/50 mb-3">Your account credentials — save these securely:</p>
            <pre className="bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-green-400 font-mono whitespace-pre-wrap break-all mb-4">{credentials}</pre>
            <div className="flex gap-2">
              <button onClick={()=>copy(credentials)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 flex items-center justify-center gap-2">
                {copied?<Check className="w-4 h-4 text-green-400"/>:<Copy className="w-4 h-4"/>}{copied?"Copied!":"Copy Credentials"}
              </button>
              <button onClick={()=>setCredentials(null)} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
