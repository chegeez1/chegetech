import { useState } from "react";
import VideoTemplate from "./VideoTemplate";
import { Play, Pause, RefreshCw } from "lucide-react";

export default function PromoVideo() {
  const [key, setKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sceneLabel, setSceneLabel] = useState("StreamVault Premium");

  const sceneNames: Record<string, string> = {
    hero: "Welcome",
    tradingChart: "Trading Bot",
    freeTools: "Free Tools",
    premiumAccounts: "Premium Accounts",
    aiTools: "AI Tools",
    vpsHosting: "VPS Hosting",
    features: "Features",
    pricing: "Pricing",
    testimonials: "Reviews",
    linkShortener: "Link Shortener",
    cardTools: "Card Tools",
    proxies: "Proxy Services",
    digitalStore: "Digital Store",
    botInAction: "Bot in Action",
    whatsappBot: "WhatsApp Bot",
    cta: "Get Started",
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden shadow-2xl bg-[#0a0a0a]" style={{ aspectRatio: "16/9" }}>
      {!paused && (
        <VideoTemplate
          key={key}
          loop={true}
          onSceneChange={(k) => setSceneLabel(sceneNames[k] ?? k)}
        />
      )}
      {paused && (
        <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a]">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full border-2 border-purple-500 flex items-center justify-center mx-auto mb-4">
              <Play className="w-8 h-8 text-purple-400 ml-1" />
            </div>
            <p className="text-gray-400 text-sm">Paused</p>
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setPaused(p => !p)}
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
        >
          {paused ? <Play className="w-4 h-4 text-white ml-0.5" /> : <Pause className="w-4 h-4 text-white" />}
        </button>
        <button
          onClick={() => { setKey(k => k + 1); setPaused(false); }}
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-white" />
        </button>
        <span className="text-white/70 text-xs flex-1">{sceneLabel}</span>
        <span className="text-purple-400 text-xs font-semibold">StreamVault Premium</span>
      </div>
    </div>
  );
}
