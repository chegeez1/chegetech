import { useState, useEffect, useCallback } from "react";
import { Gift, Copy, Check, Loader2, X, Package, CheckCircle } from "lucide-react";

const BRAND_EMOJI: Record<string,string> = {
  "Google Play":"🎮","iTunes":"🍎","Steam":"🎲","Amazon":"📦","Netflix":"🎬",
  "Spotify":"🎵","Xbox":"🟢","PlayStation":"🎯","Roblox":"🟡","Razer Gold":"💚",
  "Fortnite":"🔷","Valorant":"🔴","Binance":"🟡","Other":"🎁",
};

interface GCProduct { id:number; name:string; brand:string; denomination:string; currency:string; price_kes:number; description:string; stock_count:number; }

export default function GiftCardsPage() {
  const [products, setProducts] = useState<GCProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState("All");
  const [ordering, setOrdering] = useState<GCProduct|null>(null);
  const [email, setEmail] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);
  const [code, setCode] = useState<string|null>(null);
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState<string|null>(null);

  useEffect(()=>{
    fetch("/api/giftcards/products").then(r=>r.json()).then(d=>{if(d.success)setProducts(d.products);}).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{
    const ref = new URLSearchParams(window.location.search).get("ref");
    if(!ref) return;
    setVerifying(ref);
    fetch(`/api/giftcards/verify/${ref}`,{method:"POST"}).then(r=>r.json()).then(d=>{
      if(d.success&&d.code) setCode(d.code);
      else setCode("Payment received! Your gift card code will be sent to your email shortly.");
    }).catch(()=>setCode("Payment received! Check your email for the gift card code.")).finally(()=>{setVerifying(null);window.history.replaceState({},"","/giftcards");});
  },[]);

  const brands = ["All",...Array.from(new Set(products.map(p=>p.brand)))];
  const filtered = products.filter(p=>brandFilter==="All"||p.brand===brandFilter);

  const placeOrder = async () => {
    if(!ordering||!email.trim()) return;
    if(!/\S+@\S+\.\S+/.test(email)) return alert("Please enter a valid email");
    setOrderLoading(true);
    try {
      const r = await fetch("/api/giftcards/order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId:ordering.id,email:email.trim()})});
      const d = await r.json();
      if(d.success&&d.paymentUrl) window.location.href=d.paymentUrl;
      else alert(d.error||"Order failed");
    } catch { alert("Network error"); }
    setOrderLoading(false);
  };

  if(verifying) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-center"><Loader2 className="w-10 h-10 animate-spin text-yellow-400/50 mx-auto mb-3"/><p className="text-white/50">Verifying payment...</p></div></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20"><Gift className="w-5 h-5 text-yellow-400"/></div>
          <div><h1 className="text-2xl font-bold">Gift Cards Store</h1><p className="text-xs text-white/40">Google Play, iTunes, Steam, Xbox & more — instant code delivery</p></div>
        </div>

        {/* Brand filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
          {brands.map(b=>(
            <button key={b} onClick={()=>setBrandFilter(b)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap border shrink-0 transition-colors ${brandFilter===b?"bg-yellow-500/20 border-yellow-500/30 text-yellow-300":"bg-white/5 border-white/10 text-white/50 hover:bg-white/10"}`}>
              {BRAND_EMOJI[b]||"🎁"} {b}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_,i)=><div key={i} className="bg-white/5 rounded-2xl p-4 animate-pulse h-36"/>)}
          </div>
        ) : filtered.length===0 ? (
          <div className="text-center py-16 text-white/30"><Gift className="w-10 h-10 mx-auto mb-3 opacity-30"/><p>No cards in this brand</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(p=>{
              const inStock=p.stock_count>0;
              return (
                <div key={p.id} className={`border rounded-2xl p-4 flex flex-col transition-all ${inStock?"bg-white/5 border-white/8 hover:bg-white/8 hover:border-yellow-500/25":"bg-white/3 border-white/5 opacity-60"}`}>
                  <div className="text-4xl text-center mb-2">{BRAND_EMOJI[p.brand]||"🎁"}</div>
                  <p className="text-xs text-white/40 text-center mb-0.5">{p.brand}</p>
                  <p className="text-sm font-bold text-white text-center mb-1">{p.denomination} {p.currency}</p>
                  {p.description&&<p className="text-xs text-white/30 text-center mb-2 leading-tight">{p.description}</p>}
                  <div className="mt-auto">
                    <div className={`text-xs text-center mb-2 ${inStock?"text-emerald-400":"text-white/30"}`}>{inStock?`${p.stock_count} in stock`:"Out of stock"}</div>
                    <p className="text-xl font-bold text-center mb-2">KES {p.price_kes.toLocaleString()}</p>
                    <button disabled={!inStock} onClick={()=>setOrdering(p)}
                      className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors ${inStock?"bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 hover:bg-yellow-500/25":"bg-white/5 border border-white/10 text-white/20 cursor-not-allowed"}`}>
                      {inStock?"Buy Now":"Sold Out"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-8 p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/15 text-center">
          <p className="text-xs text-white/40">🔒 Codes are delivered instantly to your screen + email after payment</p>
        </div>
      </div>

      {/* Order modal */}
      {ordering&&(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)setOrdering(null);}}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">{BRAND_EMOJI[ordering.brand]||"🎁"}</span>
              <div className="flex-1"><p className="font-bold">{ordering.brand} — {ordering.denomination} {ordering.currency}</p><p className="text-xs text-white/40">Instant code delivery</p></div>
              <button onClick={()=>setOrdering(null)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10"><X className="w-4 h-4"/></button>
            </div>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com (code sent here)"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/40 mb-3"/>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between mb-4">
              <span className="text-sm text-white/60">Total</span>
              <span className="text-2xl font-bold">KES {ordering.price_kes.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setOrdering(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm">Cancel</button>
              <button onClick={placeOrder} disabled={orderLoading||!email.trim()} className="flex-1 py-2.5 rounded-xl bg-yellow-500 text-black font-bold text-sm hover:bg-yellow-400 disabled:opacity-50 flex items-center justify-center gap-2">
                {orderLoading?<Loader2 className="w-4 h-4 animate-spin"/>:null}{orderLoading?"Processing...":"Pay Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code delivery modal */}
      {code&&(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4"><CheckCircle className="w-6 h-6 text-yellow-400"/><h3 className="font-bold text-white text-lg">Your Gift Card Code</h3></div>
            <pre className="bg-black/40 border border-white/10 rounded-xl p-4 text-2xl font-mono font-bold text-yellow-400 text-center mb-4 tracking-widest">{code}</pre>
            <div className="flex gap-2">
              <button onClick={()=>{navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),2000);}} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm flex items-center justify-center gap-2">
                {copied?<Check className="w-4 h-4 text-green-400"/>:<Copy className="w-4 h-4"/>}{copied?"Copied!":"Copy Code"}
              </button>
              <button onClick={()=>setCode(null)} className="flex-1 py-2.5 rounded-xl bg-yellow-500 text-black font-bold text-sm">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
