import { useState, useEffect, useRef } from "react";
import VideoTemplate, { TOTAL_DURATION_MS } from "./VideoTemplate";
import { Play, Pause, RefreshCw, Volume2, VolumeX, Download, Square } from "lucide-react";

const NARRATIONS: Record<string, string> = {
  whatsappBot:     "Deploy a custom WhatsApp bot to your number in under 24 hours. Automate customer replies, send media, and run commands — around the clock.",
  hero:            "Welcome to ChegeTech StreamVault Premium — your all-in-one digital platform for tools, accounts, and automation.",
  tradingChart:    "Our automated crypto trading bot runs 24 hours a day, 7 days a week — analysing markets and maximising your returns hands-free.",
  freeTools:       "Access powerful free tools including temporary email addresses and disposable phone numbers — no sign-up required.",
  premiumAccounts: "Get instant access to premium streaming and software accounts at the best prices — delivered to your dashboard in seconds.",
  aiTools:         "Unlock the world's top A.I. tools — ChatGPT Plus, Claude Pro, Midjourney, GitHub Copilot, and more — all under one subscription.",
  vpsHosting:      "Need a server that never sleeps? Our V.P.S. plans give you root access, SSD storage, and 100 megabit uptime — starting from just a few dollars.",
  features:        "Everything in one place — subscriptions, bots, hosting, free tools, and A.I. access — managed from a single clean dashboard.",
  pricing:         "Flexible pricing plans for every budget. Pay monthly or save big with our 3 and 6-month bundles. Top up your wallet and pay anytime.",
  testimonials:    "Thousands of satisfied customers across Kenya and beyond. Real reviews, real results — join the StreamVault community today.",
  linkShortener:   "Shorten any link in one click with our built-in URL shortener. Track clicks, share cleanly, and boost your brand.",
  cardTools:       "Generate and validate card details for testing — perfect for developers, testers, and digital marketers.",
  proxies:         "Stay private online with our residential and datacenter proxies. Fast, reliable, and available in multiple countries.",
  digitalStore:    "Browse our digital store for software licences, gift cards, and exclusive accounts — all verified and ready to use.",
  botInAction:     "Watch our trading bot in action — real-time chart analysis, automated entries and exits, and profit tracking built right in.",
  cta:             "Ready to get started? Visit ChegeTech StreamVault Premium today and take your digital life to the next level.",
};

const SCENE_LABELS: Record<string, string> = {
  whatsappBot: "WhatsApp Bot", hero: "Welcome", tradingChart: "Trading Bot",
  freeTools: "Free Tools", premiumAccounts: "Premium Accounts", aiTools: "AI Tools",
  vpsHosting: "VPS Hosting", features: "Features", pricing: "Pricing",
  testimonials: "Reviews", linkShortener: "Link Shortener", cardTools: "Card Tools",
  proxies: "Proxy Services", digitalStore: "Digital Store",
  botInAction: "Bot in Action", cta: "Get Started",
};

function speak(text: string, muted: boolean) {
  if (muted || typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt    = new SpeechSynthesisUtterance(text);
  utt.rate     = 0.97;
  utt.pitch    = 1.05;
  utt.volume   = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    /google us english|microsoft david|microsoft zira|samantha|karen|daniel|aaron/i.test(v.name)
  ) ?? voices.find(v => /en[-_]US|en[-_]GB/i.test(v.lang)) ?? voices[0];
  if (preferred) utt.voice = preferred;
  window.speechSynthesis.speak(utt);
}

export default function PromoVideo() {
  const [key, setKey]               = useState(0);
  const [paused, setPaused]         = useState(false);
  const [muted, setMuted]           = useState(false);
  const [sceneKey, setSceneKey]     = useState("whatsappBot");
  const [sceneLabel, setSceneLabel] = useState("WhatsApp Bot");
  const [recording, setRecording]   = useState(false);
  const [recMsg, setRecMsg]         = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => {};
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  useEffect(() => {
    if (!paused) speak(NARRATIONS[sceneKey] ?? "", muted);
  }, [sceneKey, paused, muted]);

  useEffect(() => {
    if (paused && window.speechSynthesis) window.speechSynthesis.cancel();
  }, [paused]);

  const handleSceneChange = (k: string) => {
    setSceneKey(k);
    setSceneLabel(SCENE_LABELS[k] ?? k);
  };

  const restart = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setKey(k => k + 1);
    setPaused(false);
  };

  // ── Download: record the animation with getDisplayMedia ────────────────────
  const handleDownload = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      setRecMsg("Select this browser tab when prompted, then recording starts automatically.");
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
      recorderRef.current = rec;

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = "streamvault-promo.webm";
        a.click();
        URL.revokeObjectURL(url);
        setRecording(false);
        setRecMsg("");
      };

      rec.start(1000);
      setRecording(true);
      setRecMsg(`Recording… ${Math.round(TOTAL_DURATION_MS / 1000)}s — click Stop when done`);

      // Restart animation so viewer records from beginning
      restart();

      // Auto-stop after full video duration
      setTimeout(() => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      }, TOTAL_DURATION_MS + 2000);

    } catch {
      setRecMsg("Screen sharing cancelled or not supported in this browser.");
      setTimeout(() => setRecMsg(""), 4000);
    }
  };

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden shadow-2xl bg-[#0a0a0a]"
      style={{ aspectRatio: "16/9" }}
    >
      {!paused && (
        <VideoTemplate key={key} loop={true} onSceneChange={handleSceneChange} />
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

      {/* Recording badge */}
      {recording && (
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600/90 text-white text-xs px-3 py-1.5 rounded-full font-semibold animate-pulse">
          <span className="w-2 h-2 rounded-full bg-white inline-block" />
          REC
        </div>
      )}

      {/* Instruction message */}
      {recMsg && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[90%] text-center bg-black/80 text-white text-xs px-4 py-2 rounded-xl border border-white/10">
          {recMsg}
        </div>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setPaused(p => !p)}
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          title={paused ? "Play" : "Pause"}
        >
          {paused ? <Play className="w-4 h-4 text-white ml-0.5" /> : <Pause className="w-4 h-4 text-white" />}
        </button>

        <button
          onClick={restart}
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          title="Restart"
        >
          <RefreshCw className="w-4 h-4 text-white" />
        </button>

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
          {muted ? <VolumeX className="w-4 h-4 text-white/50" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>

        <span className="text-white/70 text-xs flex-1">{sceneLabel}</span>

        <span className="text-purple-400 text-xs font-semibold">StreamVault Premium</span>

        {/* Download / Stop recording button */}
        <button
          onClick={handleDownload}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            recording
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-purple-600 hover:bg-purple-700 text-white"
          }`}
          title={recording ? "Stop recording & download" : "Download video"}
        >
          {recording ? (
            <><Square className="w-3 h-3" /> Stop</>
          ) : (
            <><Download className="w-3 h-3" /> Download</>
          )}
        </button>
      </div>
    </div>
  );
}
