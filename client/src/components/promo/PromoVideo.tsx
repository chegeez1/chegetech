import { useState, useEffect, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import VideoTemplate, { TOTAL_DURATION_MS } from "./VideoTemplate";
import { Play, Pause, RefreshCw, Volume2, VolumeX, Download, X } from "lucide-react";

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

type ExportPhase = "idle" | "recording" | "converting" | "done" | "error";

function fmtTime(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function speak(text: string, muted: boolean) {
  if (muted || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt  = new SpeechSynthesisUtterance(text);
  utt.rate   = 0.97; utt.pitch = 1.05; utt.volume = 1;
  const v    = window.speechSynthesis.getVoices();
  const best = v.find(x => /google us english|microsoft david|samantha/i.test(x.name))
    ?? v.find(x => /en[-_]US|en[-_]GB/i.test(x.lang)) ?? v[0];
  if (best) utt.voice = best;
  window.speechSynthesis.speak(utt);
}

export default function PromoVideo() {
  const [vidKey, setVidKey]           = useState(0);
  const [paused, setPaused]           = useState(false);
  const [muted, setMuted]             = useState(false);
  const [sceneKey, setSceneKey]       = useState("whatsappBot");
  const [sceneLabel, setSceneLabel]   = useState("WhatsApp Bot");
  const [phase, setPhase]             = useState<ExportPhase>("idle");
  const [elapsed, setElapsed]         = useState(0);
  const [errMsg, setErrMsg]           = useState("");
  const containerRef  = useRef<HTMLDivElement | null>(null);
  const recorderRef   = useRef<MediaRecorder | null>(null);
  const chunksRef     = useRef<Blob[]>([]);
  const capturingRef  = useRef(false);
  const ffmpegRef     = useRef<FFmpeg | null>(null);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => {};
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  useEffect(() => { if (!paused) speak(NARRATIONS[sceneKey] ?? "", muted); }, [sceneKey, paused, muted]);
  useEffect(() => { if (paused) window.speechSynthesis?.cancel(); }, [paused]);

  const handleSceneChange = (k: string) => { setSceneKey(k); setSceneLabel(SCENE_LABELS[k] ?? k); };

  const restart = useCallback(() => {
    window.speechSynthesis?.cancel();
    setVidKey(k => k + 1);
    setPaused(false);
  }, []);

  // ── Real MP4 export: html2canvas frames → WebM → MP4 via ffmpeg.wasm CDN ──
  const handleExport = useCallback(async () => {
    if (phase === "recording") { capturingRef.current = false; recorderRef.current?.stop(); return; }
    if (phase !== "idle" && phase !== "done" && phase !== "error") return;

    const container = containerRef.current;
    if (!container) return;

    try {
      setErrMsg(""); setElapsed(0); setPhase("recording");

      const W = container.offsetWidth  || 1280;
      const H = container.offsetHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const stream = canvas.captureStream(0);
      const track  = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;

      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9" : "video/webm";
      const rec  = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
      recorderRef.current = rec;
      chunksRef.current   = [];
      capturingRef.current = true;

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const webm = new Blob(chunksRef.current, { type: mime });
        setPhase("converting");
        try {
          if (!ffmpegRef.current) {
            const ff = new FFmpeg();
            // Load ffmpeg-core from CDN — ~30MB, cached after first use
            await ff.load({
              coreURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
              wasmURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
            });
            ffmpegRef.current = ff;
          }
          const ff = ffmpegRef.current;
          await ff.writeFile("input.webm", await fetchFile(webm));
          // Remux WebM → MP4 container — no re-encoding, just a fast container swap
          await ff.exec(["-i", "input.webm", "-c", "copy", "-f", "mp4", "output.mp4"]);
          const mp4Data = await ff.readFile("output.mp4") as Uint8Array;
          const mp4Blob = new Blob([mp4Data as unknown as BlobPart], { type: "video/mp4" });
          const url = URL.createObjectURL(mp4Blob);
          const a = document.createElement("a");
          a.href = url; a.download = "streamvault-promo.mp4";
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch {
          // Fallback: download as WebM (compatible with Chrome, Firefox, Edge)
          const url = URL.createObjectURL(webm);
          const a = document.createElement("a");
          a.href = url; a.download = "streamvault-promo.webm";
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        setPhase("done");
        setTimeout(() => setPhase("idle"), 4000);
      };

      // Restart from scene 1, wait for first frame to paint
      restart();
      await new Promise(r => setTimeout(r, 600));
      rec.start(1000);
      const started = Date.now();

      const loop = async () => {
        if (!capturingRef.current) return;
        const e = Date.now() - started;
        setElapsed(e);
        if (e >= TOTAL_DURATION_MS) { capturingRef.current = false; rec.stop(); return; }
        try {
          await html2canvas(container, {
            canvas, useCORS: true, allowTaint: true,
            backgroundColor: "#0a0a0a", scale: 1,
            logging: false, imageTimeout: 0, removeContainer: false,
          });
          track.requestFrame();
        } catch { /* skip bad frame */ }
        setTimeout(loop, 67); // ~15fps
      };
      loop();

    } catch (err: unknown) {
      capturingRef.current = false;
      setErrMsg(err instanceof Error ? err.message : String(err));
      setPhase("error");
      setTimeout(() => setPhase("idle"), 5000);
    }
  }, [phase, restart]);

  const pct = Math.min(100, (elapsed / TOTAL_DURATION_MS) * 100);
  const remaining = Math.max(0, TOTAL_DURATION_MS - elapsed);

  return (
    <div ref={containerRef} className="relative w-full rounded-xl overflow-hidden shadow-2xl bg-[#0a0a0a]" style={{ aspectRatio: "16/9" }}>
      {!paused && <VideoTemplate key={vidKey} loop onSceneChange={handleSceneChange} />}
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

      {/* Export overlay */}
      {phase !== "idle" && (
        <div className="absolute inset-x-4 bottom-16 rounded-xl px-5 py-3 flex items-center gap-4"
          style={{ background: "#111", border: "1px solid #22c55e33", boxShadow: "0 8px 32px #00000088" }}>
          <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg" style={{ background: "#22c55e18" }}>
            {phase === "recording"  && <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />}
            {phase === "converting" && <div className="w-4 h-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />}
            {phase === "done"       && <span>✅</span>}
            {phase === "error"      && <span>❌</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-bold text-white">
                {phase === "recording"  && "Capturing frames…"}
                {phase === "converting" && "Converting to MP4…"}
                {phase === "done"       && "Download complete ✓"}
                {phase === "error"      && "Export failed"}
              </span>
              <span style={{ color: "#71717a" }}>
                {phase === "recording"  && `${fmtTime(remaining)} left`}
                {phase === "converting" && "almost done…"}
                {phase === "done"       && "streamvault-promo.mp4"}
                {phase === "error"      && errMsg.slice(0, 40)}
              </span>
            </div>
            {phase === "recording" && (
              <div className="rounded-full overflow-hidden" style={{ background: "#1a1a1a", height: 4 }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: "linear-gradient(90deg,#22c55e,#7c3aed)" }} />
              </div>
            )}
          </div>
          {phase === "recording" && (
            <button onClick={handleExport} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10" style={{ color: "#71717a" }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 flex items-center gap-3">
        <button onClick={() => setPaused(p => !p)}
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
          {paused ? <Play className="w-4 h-4 text-white ml-0.5" /> : <Pause className="w-4 h-4 text-white" />}
        </button>
        <button onClick={restart}
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
          <RefreshCw className="w-4 h-4 text-white" />
        </button>
        <button onClick={() => { const n = !muted; setMuted(n); if (n) window.speechSynthesis?.cancel(); else speak(NARRATIONS[sceneKey] ?? "", false); }}
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
          {muted ? <VolumeX className="w-4 h-4 text-white/50" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>
        <span className="text-white/70 text-xs flex-1">{sceneLabel}</span>
        <span className="text-purple-400 text-xs font-semibold">StreamVault Premium</span>
        <button onClick={handleExport}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            phase === "recording" ? "bg-red-600 hover:bg-red-700 text-white"
            : phase !== "idle" ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-700 text-white"
          }`}
          disabled={phase !== "idle" && phase !== "recording" && phase !== "done" && phase !== "error"}
          title="Download as MP4">
          <Download className="w-3 h-3" />
          {phase === "recording" ? "Stop" : phase === "converting" ? "Converting…" : "Download MP4"}
        </button>
      </div>
    </div>
  );
}
