import { useState, useEffect, useRef } from "react";
import VideoTemplate from "./VideoTemplate";
import { Play, Pause, RefreshCw, Volume2, VolumeX } from "lucide-react";

// Narration script for each scene — spoken by the browser's TTS engine
const NARRATIONS: Record<string, string> = {
  hero:             "Welcome to ChegeTech StreamVault Premium — your all-in-one digital platform for tools, accounts, and automation.",
  tradingChart:     "Our automated crypto trading bot runs 24 hours a day, 7 days a week — analysing markets and maximising your returns hands-free.",
  freeTools:        "Access powerful free tools including temporary email addresses and disposable phone numbers — no sign-up required.",
  premiumAccounts:  "Get instant access to premium streaming and software accounts at the best prices — delivered to your dashboard in seconds.",
  aiTools:          "Unlock the world's top A.I. tools — ChatGPT Plus, Claude Pro, Midjourney, GitHub Copilot, and more — all under one subscription.",
  vpsHosting:       "Need a server that never sleeps? Our V.P.S. plans give you root access, SSD storage, and 100 megabit uptime — starting from just a few dollars.",
  features:         "Everything in one place — subscriptions, bots, hosting, free tools, and A.I. access — managed from a single clean dashboard.",
  pricing:          "Flexible pricing plans for every budget. Pay monthly or save big with our 3 and 6-month bundles. Top up your wallet and pay anytime.",
  testimonials:     "Thousands of satisfied customers across Kenya and beyond. Real reviews, real results — join the StreamVault community today.",
  linkShortener:    "Shorten any link in one click with our built-in URL shortener. Track clicks, share cleanly, and boost your brand.",
  cardTools:        "Generate and validate card details for testing — perfect for developers, testers, and digital marketers.",
  proxies:          "Stay private online with our residential and datacenter proxies. Fast, reliable, and available in multiple countries.",
  digitalStore:     "Browse our digital store for software licences, gift cards, and exclusive accounts — all verified and ready to use.",
  botInAction:      "Watch our trading bot in action — real-time chart analysis, automated entries and exits, and profit tracking built right in.",
  whatsappBot:      "Deploy a custom WhatsApp bot to your number in under 24 hours. Automate customer replies, send media, and run commands — around the clock.",
  cta:              "Ready to get started? Visit ChegeTech StreamVault Premium today and take your digital life to the next level.",
};

function speak(text: string, muted: boolean) {
  if (muted || typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate  = 0.97;
  utt.pitch = 1.05;
  utt.volume = 1;

  // Prefer a natural-sounding English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    /google us english|microsoft david|microsoft zira|samantha|karen|daniel|aaron/i.test(v.name)
  ) ?? voices.find(v => /en[-_]US|en[-_]GB/i.test(v.lang)) ?? voices[0];
  if (preferred) utt.voice = preferred;

  window.speechSynthesis.speak(utt);
}

export default function PromoVideo() {
  const [key, setKey]             = useState(0);
  const [paused, setPaused]       = useState(false);
  const [muted, setMuted]         = useState(false);
  const [sceneKey, setSceneKey]   = useState("hero");
  const [sceneLabel, setSceneLabel] = useState("StreamVault Premium");
  const voicesReady               = useRef(false);

  const sceneNames: Record<string, string> = {
    hero: "Welcome", tradingChart: "Trading Bot", freeTools: "Free Tools",
    premiumAccounts: "Premium Accounts", aiTools: "AI Tools", vpsHosting: "VPS Hosting",
    features: "Features", pricing: "Pricing", testimonials: "Reviews",
    linkShortener: "Link Shortener", cardTools: "Card Tools", proxies: "Proxy Services",
    digitalStore: "Digital Store", botInAction: "Bot in Action",
    whatsappBot: "WhatsApp Bot", cta: "Get Started",
  };

  // Ensure voices are loaded (Chrome loads them async)
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => { voicesReady.current = true; };
    window.speechSynthesis.addEventListener("voiceschanged", load);
    if (window.speechSynthesis.getVoices().length > 0) voicesReady.current = true;
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // Speak when scene changes (and not paused / muted)
  useEffect(() => {
    if (!paused) speak(NARRATIONS[sceneKey] ?? "", muted);
  }, [sceneKey, paused, muted]);

  // Stop speech when paused
  useEffect(() => {
    if (paused && window.speechSynthesis) window.speechSynthesis.cancel();
  }, [paused]);

  const handleSceneChange = (k: string) => {
    setSceneKey(k);
    setSceneLabel(sceneNames[k] ?? k);
  };

  const restart = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setKey(k => k + 1);
    setPaused(false);
  };

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden shadow-2xl bg-[#0a0a0a]"
      style={{ aspectRatio: "16/9" }}
    >
      {!paused && (
        <VideoTemplate
          key={key}
          loop={true}
          onSceneChange={handleSceneChange}
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

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 flex items-center gap-3">
        {/* Play / Pause */}
        <button
          onClick={() => setPaused(p => !p)}
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          title={paused ? "Play" : "Pause"}
        >
          {paused
            ? <Play  className="w-4 h-4 text-white ml-0.5" />
            : <Pause className="w-4 h-4 text-white" />}
        </button>

        {/* Restart */}
        <button
          onClick={restart}
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          title="Restart"
        >
          <RefreshCw className="w-4 h-4 text-white" />
        </button>

        {/* Mute / Unmute */}
        <button
          onClick={() => {
            const next = !muted;
            setMuted(next);
            if (next && window.speechSynthesis) window.speechSynthesis.cancel();
            else speak(NARRATIONS[sceneKey] ?? "", false);
          }}
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          title={muted ? "Unmute narration" : "Mute narration"}
        >
          {muted
            ? <VolumeX className="w-4 h-4 text-white/50" />
            : <Volume2 className="w-4 h-4 text-white" />}
        </button>

        <span className="text-white/70 text-xs flex-1">{sceneLabel}</span>
        <span className="text-purple-400 text-xs font-semibold">StreamVault Premium</span>
      </div>
    </div>
  );
}
