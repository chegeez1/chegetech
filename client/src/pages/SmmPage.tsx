import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Search, X, ExternalLink, Loader2, ShoppingCart, CheckCircle } from "lucide-react";

interface SmmService {
  id: string;
  name: string;
  category: string;
  platform: string;
  rate: number;
  ourRate: number;
}

const PLATFORMS = ["All", "Instagram", "TikTok", "YouTube", "Telegram", "Facebook", "Twitter", "Spotify", "WhatsApp", "Discord", "Other"];

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "bg-pink-500/15 text-pink-400 border-pink-500/25",
  TikTok: "bg-slate-500/15 text-slate-300 border-slate-500/25",
  YouTube: "bg-red-500/15 text-red-400 border-red-500/25",
  Telegram: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  Facebook: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  Twitter: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  Spotify: "bg-green-500/15 text-green-400 border-green-500/25",
  WhatsApp: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  Discord: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  Other: "bg-white/10 text-white/50 border-white/15",
};

export default function SmmPage() {
  const [services, setServices] = useState<SmmService[]>([]);
  const [platforms, setPlatforms] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [platform, setPlatform] = useState("All");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [ordering, setOrdering] = useState<SmmService | null>(null);
  const [orderLink, setOrderLink] = useState("");
  const [orderQty, setOrderQty] = useState(1000);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (platform !== "All") params.set("platform", platform);
      if (debouncedQ) params.set("q", debouncedQ);
      const res = await fetch(`/api/smm/services?${params}`);
      const data = await res.json();
      if (data.success) { setServices(data.services); setTotal(data.total); }
    } catch {}
    setLoading(false);
  }, [platform, debouncedQ]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  useEffect(() => {
    fetch("/api/smm/platforms").then(r => r.json()).then(d => { if (d.success) setPlatforms(d.platforms); }).catch(() => {});
  }, []);

  const openOrder = (svc: SmmService) => {
    setOrdering(svc);
    setOrderLink("");
    setOrderQty(1000);
    setOrderSuccess(false);
  };

  const placeOrder = async () => {
    if (!ordering || !orderLink.trim()) return;
    setOrderLoading(true);
    try {
      const res = await fetch("/api/smm/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: ordering.id,
          serviceName: ordering.name,
          platform: ordering.platform,
          quantity: orderQty,
          link: orderLink.trim(),
          rate: ordering.rate,
          ourRate: ordering.ourRate,
        }),
      });
      const data = await res.json();
      if (data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        alert(data.error || "Order failed. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    }
    setOrderLoading(false);
  };

  const totalPrice = ordering ? ((orderQty / 1000) * ordering.ourRate).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20">
              <TrendingUp className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">SMM Boost</h1>
              <p className="text-xs text-white/40">{total > 0 ? `${total}+ services available` : "Loading services..."}</p>
            </div>
          </div>
          <p className="text-white/40 text-sm">Grow your social media with real followers, likes, and views. Fast delivery, competitive pricing.</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search services (e.g. Instagram followers, TikTok views...)"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-pink-500/40 transition-colors"
          />
          {q && <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>}
        </div>

        {/* Platform tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {PLATFORMS.map(p => {
            const pl = platforms.find(x => x.name === p);
            return (
              <button key={p} onClick={() => setPlatform(p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border shrink-0 ${
                  platform === p ? "bg-pink-500/20 border-pink-500/30 text-pink-300" : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                }`}>
                {p}
                {pl && <span className="text-xs opacity-60">({pl.count})</span>}
              </button>
            );
          })}
        </div>

        {/* Services grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-4 animate-pulse">
                <div className="h-3 w-16 bg-white/10 rounded mb-2" />
                <div className="h-4 w-full bg-white/10 rounded mb-1.5" />
                <div className="h-4 w-3/4 bg-white/10 rounded mb-4" />
                <div className="h-8 w-full bg-white/10 rounded-lg" />
              </div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No services found</p>
            {q && <button onClick={() => setQ("")} className="mt-2 text-pink-400 text-sm hover:underline">Clear search</button>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {services.map(svc => (
                <div key={svc.id} className="bg-white/5 border border-white/8 rounded-2xl p-4 hover:bg-white/8 hover:border-pink-500/25 transition-all flex flex-col">
                  <div className="mb-3 flex-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border mb-2 ${PLATFORM_COLORS[svc.platform] || PLATFORM_COLORS.Other}`}>
                      {svc.platform}
                    </span>
                    <p className="text-sm text-white/85 leading-snug line-clamp-2 font-medium">{svc.name}</p>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-lg font-bold text-white">${svc.ourRate.toFixed(3)}</p>
                      <p className="text-xs text-white/30">per 1,000</p>
                    </div>
                  </div>
                  <button onClick={() => openOrder(svc)}
                    className="w-full py-2 rounded-lg bg-pink-500/15 border border-pink-500/25 text-pink-400 text-sm font-medium hover:bg-pink-500/25 transition-colors flex items-center justify-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Order
                  </button>
                </div>
              ))}
            </div>
            {total > services.length && (
              <p className="text-center text-xs text-white/30 mt-4">Showing {services.length} of {total} — use search to narrow down</p>
            )}
          </>
        )}
      </div>

      {/* Order Modal */}
      {ordering && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setOrdering(null); }}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6">
            {orderSuccess ? (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold mb-1">Order Placed!</h3>
                <p className="text-white/50 text-sm">Redirecting to payment...</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-5">
                  <div className="flex-1 pr-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border mb-1.5 ${PLATFORM_COLORS[ordering.platform] || PLATFORM_COLORS.Other}`}>
                      {ordering.platform}
                    </span>
                    <h3 className="text-sm font-semibold text-white leading-snug">{ordering.name}</h3>
                  </div>
                  <button onClick={() => setOrdering(null)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">Your Link / Username / URL</label>
                    <input
                      type="text"
                      placeholder="https://instagram.com/yourpage"
                      value={orderLink}
                      onChange={e => setOrderLink(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-pink-500/40 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">Quantity</label>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={orderQty}
                      onChange={e => setOrderQty(Math.max(100, parseInt(e.target.value) || 100))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40 transition-colors"
                    />
                    <p className="text-xs text-white/30 mt-1">Rate: ${ordering.ourRate.toFixed(4)} per 1,000</p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-white/60">Total</span>
                    <span className="text-xl font-bold text-white">${totalPrice}</span>
                  </div>

                  <button
                    onClick={placeOrder}
                    disabled={orderLoading || !orderLink.trim()}
                    className="w-full py-3 rounded-xl bg-pink-500 text-white font-semibold text-sm hover:bg-pink-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {orderLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                    {orderLoading ? "Processing..." : "Pay with Paystack"}
                  </button>
                  <p className="text-center text-xs text-white/25">Secure payment · Instant delivery starts after payment</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
