import { useState, useEffect } from "react";
import { Cookie, X, ChevronDown, ChevronUp, ExternalLink, Check } from "lucide-react";

const STORAGE_KEY = "cookie_consent_v1";

interface CookiePrefs {
  essential: true;
  functional: boolean;
  analytics: boolean;
  decided: boolean;
}

function getPrefs(): CookiePrefs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function savePrefs(prefs: { functional: boolean; analytics: boolean }): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ essential: true, decided: true, ...prefs }));
}

const CATEGORIES = [
  {
    id: "essential",
    label: "Essential",
    always: true,
    color: "#34d399",
    desc: "Required for the site to function. Includes your login session, cart state, and security tokens. Cannot be disabled.",
    examples: ["customer_token (authentication)", "sidebar state", "payment session"],
  },
  {
    id: "functional",
    label: "Functional",
    always: false,
    color: "#818cf8",
    desc: "Remembers your preferences to give you a better experience across visits.",
    examples: ["dismissed banners", "referral code", "wallet display preferences"],
  },
  {
    id: "analytics",
    label: "Analytics",
    always: false,
    color: "#fbbf24",
    desc: "Helps us understand how the store is used so we can improve it. No personal data is shared with third parties.",
    examples: ["page view counts", "purchase funnel metrics"],
  },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className="relative w-10 h-6 rounded-full transition-colors shrink-0"
      style={{ background: checked ? (disabled ? "rgba(52,211,153,.4)" : "rgba(52,211,153,.7)") : "rgba(255,255,255,.12)", cursor: disabled ? "not-allowed" : "pointer" }}
    >
      <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all"
        style={{ left: checked ? "22px" : "4px" }} />
    </button>
  );
}

function CategoryRow({ cat, enabled, onChange }: { cat: typeof CATEGORIES[0]; enabled: boolean; onChange: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)" }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setOpen(o => !o)}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
          <span className="text-sm font-medium text-white/80">{cat.label}</span>
          {cat.always && <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">Always on</span>}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-white/30 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30 ml-auto" />}
        </div>
        <Toggle checked={enabled} onChange={onChange} disabled={cat.always} />
      </div>
      {open && (
        <div className="px-4 pb-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
          <p className="text-[12px] text-white/45 pt-2 leading-relaxed">{cat.desc}</p>
          <div className="flex flex-wrap gap-1.5">
            {cat.examples.map(ex => (
              <span key={ex} className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full font-mono">{ex}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CookieConsent() {
  const [prefs, setPrefs] = useState<CookiePrefs | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showFloat, setShowFloat] = useState(false);
  const [draft, setDraft] = useState({ functional: true, analytics: false });

  useEffect(() => {
    const saved = getPrefs();
    setPrefs(saved);
    setLoaded(true);
    if (saved?.decided) setShowFloat(true);
    if (saved) setDraft({ functional: saved.functional, analytics: saved.analytics });
  }, []);

  function acceptAll() {
    const p = { functional: true, analytics: true };
    savePrefs(p);
    setPrefs({ essential: true, decided: true, ...p });
    setShowModal(false);
    setShowFloat(true);
  }

  function rejectNonEssential() {
    const p = { functional: false, analytics: false };
    savePrefs(p);
    setPrefs({ essential: true, decided: true, ...p });
    setShowModal(false);
    setShowFloat(true);
  }

  function saveCustom() {
    savePrefs(draft);
    setPrefs({ essential: true, decided: true, ...draft });
    setShowModal(false);
    setShowFloat(true);
  }

  if (!loaded) return null;

  const showBanner = loaded && (!prefs || !prefs.decided) && !showModal;

  return (
    <>
      {/* ── Banner ─────────────────────────────────────────────── */}
      {showBanner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-2xl"
          style={{ filter: "drop-shadow(0 8px 40px rgba(0,0,0,.6))" }}>
          <div className="rounded-2xl px-5 py-4" style={{ background: "rgba(15,15,30,.97)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,.1)" }}>
            <div className="flex gap-3 items-start mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(99,102,241,.2)" }}>
                <Cookie className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white mb-1">We use cookies & local storage</p>
                <p className="text-xs text-white/45 leading-relaxed">
                  We store small files on your device to keep you logged in, remember preferences, and improve your experience.
                  Essential cookies are always active. You can choose which others to allow.{" "}
                  <a href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors">Privacy policy</a>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={acceptAll}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
                style={{ background: "rgba(99,102,241,.7)", border: "1px solid rgba(99,102,241,.5)" }}>
                Accept all
              </button>
              <button onClick={rejectNonEssential}
                className="px-4 py-1.5 rounded-xl text-xs font-medium text-white/60 hover:text-white/80 transition-all"
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                Essential only
              </button>
              <button onClick={() => setShowModal(true)}
                className="px-4 py-1.5 rounded-xl text-xs text-white/40 hover:text-white/60 transition-all">
                Manage preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating cookie button ──────────────────────────────── */}
      {showFloat && !showModal && (
        <button
          onClick={() => { setShowModal(true); if (prefs) setDraft({ functional: prefs.functional, analytics: prefs.analytics }); }}
          className="fixed bottom-4 left-4 z-[9998] w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ background: "rgba(15,15,30,.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,.1)" }}
          title="Manage cookie preferences"
        >
          <Cookie className="w-4 h-4 text-white/40" />
        </button>
      )}

      {/* ── Preferences Modal ───────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: "rgba(12,12,24,.98)", border: "1px solid rgba(255,255,255,.1)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}>
              <div className="flex items-center gap-2">
                <Cookie className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-white">Cookie Preferences</span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white/60 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-white/40 leading-relaxed">
                Choose which types of cookies and local storage your browser allows this site to use.
                Your choices are saved and can be changed at any time.
              </p>
              {CATEGORIES.map(cat => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  enabled={cat.id === "essential" ? true : draft[cat.id as "functional" | "analytics"]}
                  onChange={v => setDraft(d => ({ ...d, [cat.id]: v }))}
                />
              ))}

              <a href="/privacy" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-indigo-400/70 hover:text-indigo-400 transition-all pt-1">
                <ExternalLink className="w-3 h-3" /> View full privacy policy
              </a>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 flex flex-wrap gap-2" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
              <button onClick={saveCustom}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
                style={{ background: "rgba(99,102,241,.65)", border: "1px solid rgba(99,102,241,.4)" }}>
                <Check className="w-3.5 h-3.5" /> Save my choices
              </button>
              <button onClick={acceptAll}
                className="px-4 py-1.5 rounded-xl text-xs font-medium text-white/60 hover:text-white/80 transition-all"
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                Accept all
              </button>
              <button onClick={rejectNonEssential}
                className="px-4 py-1.5 rounded-xl text-xs text-white/40 hover:text-white/60 transition-all">
                Essential only
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Hook — use this in any component to read current cookie consent */
export function useCookieConsent(): CookiePrefs {
  const prefs = getPrefs();
  return prefs ?? { essential: true, functional: false, analytics: false, decided: false };
}
