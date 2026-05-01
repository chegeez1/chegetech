import { useEffect, useState } from "react";
import {
  Play, Music, Briefcase, Shield, Gamepad2, Tv, Headphones,
  Sparkles, Trophy, Star, Mic, Globe, BookOpen, Palette,
  Volume2, Disc, Radio, Camera, Lock, Wifi, Server, MapPin,
  Crown, Award, Flame, Clock, Users, Zap,
} from "lucide-react";

// Stable TMDB poster CDN URLs
const TMDB = (p: string) => `https://image.tmdb.org/t/p/w342${p}`;

interface PreviewItem { title: string; tag?: string; poster?: string; gradient?: string; icon?: any; }

interface PreviewTheme {
  brand: string;
  tagline: string;
  bg: string;          // tailwind background classes (gradient/color)
  accent: string;      // tailwind text/border accent
  pillBg: string;      // tailwind pill bg
  badge: string;       // small label
  Icon: any;
  items: PreviewItem[];
}

// Pattern matchers — keys are tested as substring against planId (lowercased)
const PREVIEWS: Array<{ match: RegExp; theme: PreviewTheme }> = [
  {
    match: /netflix/i,
    theme: {
      brand: "Netflix",
      tagline: "Top picks streaming this week",
      bg: "bg-gradient-to-br from-black via-zinc-950 to-red-950",
      accent: "text-red-500",
      pillBg: "bg-red-600/20 border border-red-500/30 text-red-300",
      badge: "TRENDING NOW",
      Icon: Tv,
      items: [
        { title: "Stranger Things", tag: "Sci-Fi", poster: TMDB("/49WJfeN0moxb9IPfGn8AIqMGskD.jpg") },
        { title: "Wednesday", tag: "Mystery", poster: TMDB("/9PFonBhy4cQy7Jz20NpMygczOkv.jpg") },
        { title: "Squid Game", tag: "Thriller", poster: TMDB("/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg") },
        { title: "Money Heist", tag: "Crime", poster: TMDB("/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg") },
        { title: "The Witcher", tag: "Fantasy", poster: TMDB("/7vjaCdMw15FEbXyLQTVa04URsPm.jpg") },
        { title: "Bridgerton", tag: "Drama", poster: TMDB("/luoKpgVwi1E5nQsi7W0UuKHu2Rq.jpg") },
      ],
    },
  },
  {
    match: /primevideo/i,
    theme: {
      brand: "Prime Video",
      tagline: "Featured on Prime",
      bg: "bg-gradient-to-br from-[#00050d] via-[#001b35] to-[#003e7c]",
      accent: "text-cyan-400",
      pillBg: "bg-cyan-500/15 border border-cyan-400/30 text-cyan-200",
      badge: "PRIME ORIGINAL",
      Icon: Tv,
      items: [
        { title: "The Boys", tag: "Action", poster: TMDB("/stTEycfG9928HYGEISBFaG1ngjM.jpg") },
        { title: "Fallout", tag: "Sci-Fi", poster: TMDB("/AnsSPFRDPTH8YOcTxVyZ9p3hg6w.jpg") },
        { title: "Reacher", tag: "Action", poster: TMDB("/vQUodOzUz4ENJgZbKRzBT5LnL5j.jpg") },
        { title: "Mrs. Maisel", tag: "Comedy", poster: TMDB("/bxLCUhkHo1xH8FbDlPq8tLjlLwY.jpg") },
        { title: "The Lord of the Rings: Rings of Power", tag: "Fantasy", poster: TMDB("/mYLOqiStMxDK3fYZFirgrMt8z5d.jpg") },
        { title: "Citadel", tag: "Spy", poster: TMDB("/2Ku5fE7BjQHpklqjFs98DcsLDEi.jpg") },
      ],
    },
  },
  {
    match: /showmax/i,
    theme: {
      brand: "Showmax",
      tagline: "Stories that move Africa",
      bg: "bg-gradient-to-br from-[#0a001a] via-[#1f0033] to-[#5b0099]",
      accent: "text-fuchsia-400",
      pillBg: "bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-200",
      badge: "SHOWMAX ORIGINAL",
      Icon: Tv,
      items: [
        { title: "The Wife", tag: "Drama", gradient: "from-rose-700 via-pink-700 to-purple-800" },
        { title: "Outlaws", tag: "Crime", gradient: "from-yellow-700 via-orange-800 to-red-900" },
        { title: "Adulting", tag: "Drama", gradient: "from-indigo-700 via-violet-800 to-fuchsia-900" },
        { title: "Crown Gospel", tag: "Music", gradient: "from-amber-600 via-orange-700 to-red-800" },
        { title: "Premier League", tag: "Live Sports", gradient: "from-emerald-700 via-green-800 to-teal-900" },
        { title: "UFC", tag: "MMA", gradient: "from-red-700 via-rose-800 to-pink-900" },
      ],
    },
  },
  {
    match: /peacock/i,
    theme: {
      brand: "Peacock",
      tagline: "Stream NBC, sports & originals",
      bg: "bg-gradient-to-br from-black via-[#1a0033] to-[#0033cc]",
      accent: "text-yellow-400",
      pillBg: "bg-yellow-500/15 border border-yellow-400/30 text-yellow-200",
      badge: "ON PEACOCK",
      Icon: Tv,
      items: [
        { title: "The Office", tag: "Comedy", poster: TMDB("/qWnJzyZhyy74gjpSjIXWmuk0ifX.jpg") },
        { title: "Yellowstone", tag: "Drama", poster: TMDB("/s4QRRYc1V2e68Aq39CKHkkN39pq.jpg") },
        { title: "Premier League", tag: "Live Sports", gradient: "from-purple-700 to-indigo-900" },
        { title: "WWE Raw", tag: "Wrestling", gradient: "from-yellow-600 to-red-800" },
        { title: "SNL", tag: "Late Night", gradient: "from-pink-600 to-purple-900" },
        { title: "Bel-Air", tag: "Drama", poster: TMDB("/7Q8L8wxqQzM7XKQXzj1n7Q7v3l4.jpg") },
      ],
    },
  },
  {
    match: /spotify/i,
    theme: {
      brand: "Spotify",
      tagline: "Made for you, ad-free",
      bg: "bg-gradient-to-br from-black via-emerald-950 to-green-900",
      accent: "text-emerald-400",
      pillBg: "bg-emerald-500/15 border border-emerald-400/30 text-emerald-200",
      badge: "PREMIUM",
      Icon: Music,
      items: [
        { title: "Discover Weekly", tag: "Made for you", icon: Sparkles, gradient: "from-purple-600 via-pink-600 to-orange-500" },
        { title: "Daily Mix 1", tag: "Your favorites", icon: Disc, gradient: "from-emerald-600 to-teal-700" },
        { title: "Top Hits 2026", tag: "Trending", icon: Flame, gradient: "from-rose-600 to-red-700" },
        { title: "Chill Vibes", tag: "Lofi", icon: Headphones, gradient: "from-indigo-600 to-violet-800" },
        { title: "Afrobeats", tag: "Hot", icon: Volume2, gradient: "from-amber-600 to-orange-700" },
        { title: "Workout", tag: "Energy", icon: Zap, gradient: "from-pink-600 to-fuchsia-700" },
      ],
    },
  },
  {
    match: /applemusic/i,
    theme: {
      brand: "Apple Music",
      tagline: "Lossless, spatial, ad-free",
      bg: "bg-gradient-to-br from-black via-zinc-900 to-rose-950",
      accent: "text-rose-400",
      pillBg: "bg-rose-500/15 border border-rose-400/30 text-rose-200",
      badge: "APPLE MUSIC",
      Icon: Music,
      items: [
        { title: "New Music Daily", tag: "Apple Picks", icon: Sparkles, gradient: "from-pink-600 to-rose-700" },
        { title: "Today's Hits", tag: "Pop", icon: Flame, gradient: "from-purple-600 to-indigo-700" },
        { title: "Spatial Audio", tag: "Dolby Atmos", icon: Volume2, gradient: "from-fuchsia-600 to-pink-800" },
        { title: "Hip-Hop/R&B", tag: "Top Charts", icon: Disc, gradient: "from-amber-600 to-red-700" },
        { title: "Replay 2026", tag: "Your Year", icon: Star, gradient: "from-cyan-600 to-blue-800" },
        { title: "Acoustic", tag: "Chill", icon: Headphones, gradient: "from-emerald-600 to-teal-800" },
      ],
    },
  },
  {
    match: /youtubepremium/i,
    theme: {
      brand: "YouTube Premium",
      tagline: "Ad-free, background play, YT Music",
      bg: "bg-gradient-to-br from-black via-zinc-950 to-red-950",
      accent: "text-red-500",
      pillBg: "bg-red-500/15 border border-red-400/30 text-red-200",
      badge: "PREMIUM",
      Icon: Play,
      items: [
        { title: "Ad-Free Videos", tag: "All content", icon: Shield, gradient: "from-red-600 to-rose-800" },
        { title: "Background Play", tag: "Mobile", icon: Headphones, gradient: "from-zinc-700 to-zinc-900" },
        { title: "YouTube Music", tag: "100M+ songs", icon: Music, gradient: "from-purple-600 to-fuchsia-800" },
        { title: "Offline Downloads", tag: "Anywhere", icon: Globe, gradient: "from-blue-600 to-indigo-800" },
        { title: "Premium Originals", tag: "Exclusive", icon: Crown, gradient: "from-amber-600 to-orange-800" },
        { title: "Picture-in-Picture", tag: "Multitask", icon: Tv, gradient: "from-emerald-600 to-teal-800" },
      ],
    },
  },
  {
    match: /deezer/i,
    theme: {
      brand: "Deezer",
      tagline: "Your Flow, your sound",
      bg: "bg-gradient-to-br from-black via-fuchsia-950 to-pink-900",
      accent: "text-pink-400",
      pillBg: "bg-pink-500/15 border border-pink-400/30 text-pink-200",
      badge: "DEEZER PREMIUM",
      Icon: Music,
      items: [
        { title: "My Flow", tag: "Personalized", icon: Sparkles, gradient: "from-pink-600 to-purple-700" },
        { title: "Trending", tag: "Global", icon: Flame, gradient: "from-orange-600 to-red-700" },
        { title: "HiFi Sound", tag: "Lossless", icon: Volume2, gradient: "from-violet-600 to-fuchsia-800" },
        { title: "Podcasts", tag: "Daily", icon: Mic, gradient: "from-amber-600 to-orange-700" },
        { title: "Editor's Picks", tag: "Curated", icon: Star, gradient: "from-emerald-600 to-teal-800" },
        { title: "Radio", tag: "Stations", icon: Radio, gradient: "from-indigo-600 to-blue-800" },
      ],
    },
  },
  {
    match: /tidal/i,
    theme: {
      brand: "TIDAL",
      tagline: "Master quality audio",
      bg: "bg-gradient-to-br from-black via-cyan-950 to-sky-900",
      accent: "text-cyan-300",
      pillBg: "bg-cyan-500/15 border border-cyan-400/30 text-cyan-200",
      badge: "TIDAL HiFi",
      Icon: Disc,
      items: [
        { title: "Master Tracks", tag: "MQA", icon: Award, gradient: "from-cyan-600 to-blue-800" },
        { title: "Dolby Atmos", tag: "Immersive", icon: Volume2, gradient: "from-violet-600 to-indigo-800" },
        { title: "TIDAL Rising", tag: "New Artists", icon: Sparkles, gradient: "from-rose-600 to-pink-800" },
        { title: "HiFi Charts", tag: "Top 100", icon: Trophy, gradient: "from-amber-600 to-orange-800" },
        { title: "Live Sessions", tag: "Exclusive", icon: Mic, gradient: "from-emerald-600 to-green-800" },
        { title: "Editorial Picks", tag: "Curated", icon: Star, gradient: "from-fuchsia-600 to-purple-800" },
      ],
    },
  },
  {
    match: /audible/i,
    theme: {
      brand: "Audible",
      tagline: "Listen to your next great story",
      bg: "bg-gradient-to-br from-black via-orange-950 to-amber-900",
      accent: "text-amber-400",
      pillBg: "bg-amber-500/15 border border-amber-400/30 text-amber-200",
      badge: "AUDIBLE PLUS",
      Icon: BookOpen,
      items: [
        { title: "Atomic Habits", tag: "Self-help", icon: BookOpen, gradient: "from-amber-600 to-orange-800" },
        { title: "Project Hail Mary", tag: "Sci-Fi", icon: BookOpen, gradient: "from-cyan-600 to-indigo-800" },
        { title: "The Psychology of Money", tag: "Finance", icon: BookOpen, gradient: "from-emerald-600 to-teal-800" },
        { title: "Dune", tag: "Fantasy", icon: BookOpen, gradient: "from-yellow-700 to-orange-900" },
        { title: "Educated", tag: "Memoir", icon: BookOpen, gradient: "from-rose-600 to-red-800" },
        { title: "The Subtle Art", tag: "Self-help", icon: BookOpen, gradient: "from-violet-600 to-fuchsia-800" },
      ],
    },
  },
  {
    match: /canva/i,
    theme: {
      brand: "Canva Pro",
      tagline: "Design anything, in minutes",
      bg: "bg-gradient-to-br from-[#001a33] via-[#003366] to-[#00cccc]",
      accent: "text-cyan-300",
      pillBg: "bg-cyan-500/15 border border-cyan-400/30 text-cyan-200",
      badge: "PRO ACCESS",
      Icon: Palette,
      items: [
        { title: "Brand Kit", tag: "Logos & fonts", icon: Sparkles, gradient: "from-cyan-600 to-teal-700" },
        { title: "100M+ Stock Photos", tag: "Premium", icon: Camera, gradient: "from-violet-600 to-fuchsia-800" },
        { title: "Background Remover", tag: "1-click", icon: Zap, gradient: "from-rose-600 to-pink-800" },
        { title: "Magic Resize", tag: "Any platform", icon: Tv, gradient: "from-amber-600 to-orange-800" },
        { title: "Premium Templates", tag: "610K+", icon: Star, gradient: "from-emerald-600 to-green-800" },
        { title: "Magic Studio", tag: "AI tools", icon: Sparkles, gradient: "from-indigo-600 to-purple-800" },
      ],
    },
  },
  {
    match: /nordvpn|vpn/i,
    theme: {
      brand: "NordVPN",
      tagline: "Browse private. Stream global.",
      bg: "bg-gradient-to-br from-black via-blue-950 to-indigo-900",
      accent: "text-blue-400",
      pillBg: "bg-blue-500/15 border border-blue-400/30 text-blue-200",
      badge: "PROTECTED",
      Icon: Shield,
      items: [
        { title: "United States", tag: "5,500+ servers", icon: MapPin, gradient: "from-blue-600 to-indigo-800" },
        { title: "United Kingdom", tag: "440+ servers", icon: MapPin, gradient: "from-rose-600 to-red-800" },
        { title: "Japan", tag: "180+ servers", icon: MapPin, gradient: "from-pink-600 to-fuchsia-800" },
        { title: "Threat Protection", tag: "Built-in", icon: Shield, gradient: "from-emerald-600 to-teal-800" },
        { title: "Kill Switch", tag: "Auto", icon: Lock, gradient: "from-amber-600 to-orange-800" },
        { title: "10 Gbps Servers", tag: "Ultra-fast", icon: Zap, gradient: "from-violet-600 to-purple-800" },
      ],
    },
  },
];

function pickTheme(planId: string): PreviewTheme | null {
  for (const p of PREVIEWS) if (p.match.test(planId)) return p.theme;
  return null;
}

export default function ServicePreview({ planId }: { planId: string }) {
  const [custom, setCustom] = useState<{ mediaType: "image" | "video"; mimeType: string; dataUrl: string } | null>(null);
  const [loadingCustom, setLoadingCustom] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoadingCustom(true);
    setCustom(null);
    if (!planId) { setLoadingCustom(false); return; }
    fetch(`/api/plans/${encodeURIComponent(planId)}/preview`)
      .then(r => r.json())
      .then(j => { if (!cancel && j?.success && j.preview) setCustom(j.preview); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoadingCustom(false); });
    return () => { cancel = true; };
  }, [planId]);

  // Custom uploaded media takes priority over built-in themed preview
  if (custom) {
    return (
      <div data-testid="service-preview-custom" className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
        {custom.mediaType === "video" ? (
          <video
            src={custom.dataUrl}
            className="w-full h-auto max-h-[420px] object-cover"
            autoPlay loop muted playsInline controls
            data-testid="custom-preview-video"
          />
        ) : (
          <img
            src={custom.dataUrl}
            alt="Plan preview"
            className="w-full h-auto max-h-[420px] object-cover"
            data-testid="custom-preview-image"
          />
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white/80">
          <Sparkles className="w-3 h-3" />
          PREVIEW
        </div>
      </div>
    );
  }

  // While checking for custom preview, render nothing to avoid flicker
  if (loadingCustom) return null;

  const theme = pickTheme(planId);
  if (!theme) return null;
  const { Icon } = theme;

  return (
    <div data-testid="service-preview" className={`relative overflow-hidden rounded-2xl border border-white/10 ${theme.bg}`}>
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle at 20% 0%, rgba(255,255,255,0.15), transparent 40%), radial-gradient(circle at 80% 100%, rgba(255,255,255,0.1), transparent 40%)",
      }} />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center ${theme.accent}`}>
              <Icon className="w-4.5 h-4.5" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">{theme.brand}</p>
              <p className="text-white/60 text-xs">{theme.tagline}</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full ${theme.pillBg}`}>
            {theme.badge}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {theme.items.slice(0, 6).map((it, i) => (
            <div
              key={i}
              data-testid={`preview-item-${i}`}
              className="relative group rounded-xl overflow-hidden aspect-[2/3] border border-white/10 hover:border-white/30 transition-all hover:scale-[1.03] cursor-default"
            >
              {it.poster ? (
                <img
                  src={it.poster}
                  alt={it.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : null}
              <div className={`absolute inset-0 bg-gradient-to-br ${it.gradient || "from-zinc-800 to-zinc-900"} ${it.poster ? "opacity-0" : ""}`} />
              {!it.poster && it.icon ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <it.icon className="w-7 h-7 text-white/85" strokeWidth={1.8} />
                </div>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                <p className="text-white text-[11px] font-bold leading-tight line-clamp-2">{it.title}</p>
                {it.tag ? <p className="text-white/60 text-[9px] mt-0.5 uppercase tracking-wider">{it.tag}</p> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 text-[11px] text-white/50">
          <Clock className="w-3 h-3" />
          <span>Instant access after payment</span>
          <span className="mx-1">·</span>
          <Users className="w-3 h-3" />
          <span>Shared verified account</span>
        </div>
      </div>
    </div>
  );
}
