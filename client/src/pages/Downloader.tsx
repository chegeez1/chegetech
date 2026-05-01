import { useState, useEffect } from "react";
import { Download, Link2, Play, Clock, Loader2, AlertCircle, CheckCircle, Zap } from "lucide-react";

const PAYSTACK_PUBLIC_KEY = (window as any).__PAYSTACK_KEY__ || "";
const MONTHLY_PRICE_KES   = 100;

interface VideoInfo {
  title:     string;
  thumbnail: string;
  duration:  number;
  uploader:  string;
  platform:  string;
}

interface Quota { used: number; limit: number; remaining: number; }

function formatDuration(s: number) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function Downloader() {
  const [url,          setUrl]          = useState("");
  const [info,         setInfo]         = useState<VideoInfo | null>(null);
  const [infoLoading,  setInfoLoading]  = useState(false);
  const [infoError,    setInfoError]    = useState("");
  const [dlLoading,    setDlLoading]    = useState(false);
  const [dlError,      setDlError]      = useState("");
  const [quota,        setQuota]        = useState<Quota>({ used: 0, limit: 2, remaining: 2 });
  const [subEmail,     setSubEmail]     = useState(() => localStorage.getItem("dl_email") || "");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [payLoading,   setPayLoading]   = useState(false);

  useEffect(() => {
    fetch("/api/dl/quota").then(r => r.json()).then(setQuota).catch(() => {});
    const saved = localStorage.getItem("dl_email");
    if (saved) checkSub(saved);
  }, []);

  async function checkSub(email: string) {
    try {
      const r = await fetch(`/api/dl/check-sub?email=${encodeURIComponent(email)}`);
      const d = await r.json();
      setIsSubscribed(d.subscribed);
    } catch {}
  }

  async function fetchInfo() {
    if (!url.trim()) return;
    setInfo(null); setInfoError(""); setInfoLoading(true);
    try {
      const r = await fetch("/api/dl/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setInfoError(d.error || "Failed to fetch video info"); return; }
      setInfo(d);
    } catch { setInfoError("Network error. Please try again."); }
    finally { setInfoLoading(false); }
  }

  async function download() {
    if (!info) return;
    setDlError(""); setDlLoading(true);

    try {
      // Quick quota check before triggering the long yt-dlp call
      if (!isSubscribed) {
        const qRes = await fetch("/api/dl/quota");
        const q    = await qRes.json();
        if (q.remaining <= 0) {
          setShowSubModal(true);
          setQuota(q);
          setDlLoading(false);
          return;
        }
      }

      // Build stream URL — server proxies the video with correct headers, no 403s
      const params = new URLSearchParams({ url: url.trim(), title: info.title });
      if (subEmail) params.set("email", subEmail);
      const streamUrl = `/api/dl/stream?${params.toString()}`;

      // HEAD probe to catch quota/error responses before streaming
      const probe = await fetch(streamUrl, { method: "HEAD" });

      if (probe.status === 402) {
        setShowSubModal(true);
        fetch("/api/dl/quota").then(r => r.json()).then(setQuota).catch(() => {});
        return;
      }

      if (!probe.ok) {
        setDlError("Could not start download. Please try again.");
        return;
      }

      // Trigger the browser download — file streams from our server, not TikTok/YouTube CDN
      const a = document.createElement("a");
      a.href     = streamUrl;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Refresh quota after download starts
      setTimeout(() => {
        fetch("/api/dl/quota").then(r => r.json()).then(setQuota).catch(() => {});
      }, 3000);

    } catch { setDlError("Network error. Please try again."); }
    finally { setDlLoading(false); }
  }

  function paystackPay() {
    if (!subEmail) { alert("Enter your email first"); return; }
    setPayLoading(true);
    const handler = (window as any).PaystackPop?.setup({
      key:      PAYSTACK_PUBLIC_KEY,
      email:    subEmail,
      amount:   MONTHLY_PRICE_KES * 100,
      currency: "KES",
      ref:      "DL-" + Date.now(),
      metadata: { plan: "downloader_monthly" },
      callback: async () => {
        localStorage.setItem("dl_email", subEmail);
        await fetch("/api/dl/admin/grant", {
          method:  "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": "chegetech-admin" },
          body:    JSON.stringify({ email: subEmail }),
        }).catch(() => {});
        setIsSubscribed(true);
        setShowSubModal(false);
        setPayLoading(false);
        alert("Subscribed! Enjoy unlimited downloads.");
      },
      onClose: () => setPayLoading(false),
    });
    handler?.openIframe();
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <script src="https://js.paystack.co/v1/inline.js" async />

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-full px-4 py-1.5 text-red-400 text-sm font-medium mb-4">
            <Download className="w-4 h-4" /> Video Downloader
          </div>
          <h1 className="text-3xl font-bold mb-2">YouTube &amp; TikTok Downloader</h1>
          <p className="text-gray-400">Paste any YouTube, TikTok, Instagram or Twitter video link</p>
        </div>

        {/* Quota bar */}
        <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl p-3 mb-6">
          {isSubscribed ? (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" /> Unlimited downloads active
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-400">
                Free downloads this month:
                <span className={`ml-2 font-bold ${quota.remaining === 0 ? "text-red-400" : "text-green-400"}`}>
                  {quota.used}/{quota.limit} used
                </span>
              </div>
              <button onClick={() => setShowSubModal(true)}
                className="text-xs bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 px-3 py-1 rounded-full hover:bg-yellow-500/30 transition-colors">
                Ksh 100/month — Unlimited
              </button>
            </>
          )}
        </div>

        {/* URL input */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="url"
                value={url}
                onChange={e => { setUrl(e.target.value); setInfo(null); setInfoError(""); setDlError(""); }}
                onKeyDown={e => e.key === "Enter" && fetchInfo()}
                placeholder="Paste YouTube, TikTok, Instagram link…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
              />
            </div>
            <button onClick={fetchInfo} disabled={!url.trim() || infoLoading}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 transition-colors">
              {infoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {infoLoading ? "Loading…" : "Fetch"}
            </button>
          </div>
        </div>

        {/* Info error */}
        {infoError && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {infoError}
          </div>
        )}

        {/* Video info card */}
        {info && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-4">
            <div className="flex gap-4 p-4">
              {info.thumbnail && (
                <img src={info.thumbnail} alt="thumbnail"
                  className="w-28 h-20 object-cover rounded-xl shrink-0 bg-gray-800" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-snug line-clamp-2 mb-1">{info.title}</p>
                <p className="text-gray-400 text-xs">{info.uploader}</p>
                {info.duration > 0 && (
                  <div className="flex items-center gap-1 text-gray-500 text-xs mt-1">
                    <Clock className="w-3 h-3" /> {formatDuration(info.duration)}
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 pb-4">
              {dlError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-3 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {dlError}
                </div>
              )}
              <button
                onClick={download}
                disabled={dlLoading || (!isSubscribed && quota.remaining === 0)}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors">
                {dlLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing download…</>
                  : <><Download className="w-4 h-4" /> Download MP4</>}
              </button>
              {!isSubscribed && quota.remaining === 0 && (
                <p className="text-center text-yellow-400 text-xs mt-2">
                  Free limit reached —{" "}
                  <button onClick={() => setShowSubModal(true)} className="underline hover:text-yellow-300">
                    Subscribe for Ksh 100/month
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Supported platforms */}
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 text-center">
          {["YouTube", "TikTok", "Instagram Reels", "Twitter / X"].map(p => (
            <div key={p} className="bg-gray-900 border border-gray-800 rounded-lg py-2 px-3">{p}</div>
          ))}
        </div>
      </div>

      {/* Subscription modal */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-lg mb-1">
              <Zap className="w-5 h-5" /> Go Unlimited
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Ksh 100/month — unlimited downloads, all platforms, no ads.
            </p>
            <div className="space-y-3 mb-4">
              {["Unlimited downloads every month", "YouTube, TikTok, Instagram, Twitter", "720p MP4 quality", "Priority support"].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" /> {f}
                </div>
              ))}
            </div>
            <input
              type="email"
              value={subEmail}
              onChange={e => setSubEmail(e.target.value)}
              placeholder="Your email address"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 mb-3"
            />
            <button onClick={paystackPay} disabled={payLoading || !subEmail}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
              {payLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Pay Ksh 100 via Card / M-Pesa
            </button>
            <p className="text-center text-gray-600 text-xs mt-2">Powered by Paystack · Secure</p>
            <button onClick={() => setShowSubModal(false)}
              className="w-full text-gray-500 hover:text-gray-300 text-sm mt-3 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
