import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

// ─── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_URLS = [
  {
    long:  'https://streamvault-premium.site/tradingbot?ref=youtube&utm_source=promo&campaign=apr26',
    short: 'sv.pm/bot',
    clicks: 4820, today: 312, ctr: '18.4%',
    refs: [{ label: 'YouTube', pct: 54 }, { label: 'Telegram', pct: 28 }, { label: 'WhatsApp', pct: 18 }],
    countries: ['🇰🇪', '🇳🇬', '🇬🇭', '🇺🇸', '🇬🇧'],
  },
  {
    long:  'https://streamvault-premium.site/proxies?tier=residential&plan=monthly&ref=blog',
    short: 'sv.pm/prx',
    clicks: 2190, today: 147, ctr: '11.2%',
    refs: [{ label: 'Blog', pct: 62 }, { label: 'Twitter', pct: 22 }, { label: 'Direct', pct: 16 }],
    countries: ['🇺🇸', '🇬🇧', '🇰🇪', '🇩🇪', '🇿🇦'],
  },
  {
    long:  'https://streamvault-premium.site/giftcards?category=netflix&country=us&ref=smm',
    short: 'sv.pm/gc',
    clicks: 6340, today: 421, ctr: '24.7%',
    refs: [{ label: 'SMM', pct: 48 }, { label: 'Telegram', pct: 35 }, { label: 'Other', pct: 17 }],
    countries: ['🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇰🇪'],
  },
];

const FEATURES = [
  { icon: '🔗', label: 'Custom slugs',    desc: 'sv.pm/your-brand — memorable links' },
  { icon: '📊', label: 'Click analytics', desc: 'Real-time geo, referrer, device data'  },
  { icon: '📱', label: 'QR codes',        desc: 'Auto-generated for every short link'   },
  { icon: '🌍', label: 'Geo tracking',    desc: 'See exactly where clicks come from'    },
  { icon: '🔒', label: 'Password lock',   desc: 'Protect links with a PIN'              },
  { icon: '⏳', label: 'Expiry dates',    desc: 'Auto-expire links on a schedule'       },
];

// ─── Typing URL animation ──────────────────────────────────────────────────────
function useTypedUrl(url: string, speed = 22) {
  const [typed, setTyped] = useState('');
  const [done, setDone]   = useState(false);

  useEffect(() => {
    setTyped('');
    setDone(false);
    let i = 0;
    const ti = setInterval(() => {
      i++;
      setTyped(url.slice(0, i));
      if (i >= url.length) { clearInterval(ti); setTimeout(() => setDone(true), 280); }
    }, speed);
    return () => clearInterval(ti);
  }, [url, speed]);

  return { typed, done };
}

// ─── Click counter ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const raf = (ts: number) => {
      const p = Math.min((ts - start) / duration, 1);
      setCount(Math.round(p * target));
      if (p < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [target, duration]);
  return count;
}

// ─── Mini bar chart ────────────────────────────────────────────────────────────
function RefBar({ refs }: { refs: { label: string; pct: number }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {refs.map((r, i) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="text-xs w-16 shrink-0" style={{ color: '#71717a', fontFamily: 'var(--font-mono)' }}>{r.label}</span>
          <div className="flex-1 rounded-full overflow-hidden" style={{ background: '#1a1a1a', height: 6 }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: ['#22c55e', '#7c3aed', '#ec4899'][i % 3] }}
              initial={{ width: 0 }}
              animate={{ width: `${r.pct}%` }}
              transition={{ delay: 0.1 * i, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="text-xs w-8 text-right shrink-0" style={{ color: '#52525b' }}>{r.pct}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Scene ───────────────────────────────────────────────────────────────
export default function SceneLinkShortener() {
  const [dIdx, setDIdx] = useState(0);
  const demo = DEMO_URLS[dIdx % DEMO_URLS.length];
  const { typed, done } = useTypedUrl(demo.long);
  const clicks = useCountUp(demo.clicks, 1000);
  const todayClicks = useCountUp(demo.today, 800);

  // cycle to next demo after enough time
  useEffect(() => {
    const dur = demo.long.length * 22 + 3200;
    const t = setTimeout(() => setDIdx(p => p + 1), dur);
    return () => clearTimeout(t);
  }, [dIdx]);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col px-10 py-7"
      style={{ backgroundColor: '#0a0a0a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div
        className="mb-5"
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.7 }}
      >
        <span className="text-sm font-mono uppercase tracking-widest" style={{ color: '#22c55e' }}>Free Tool</span>
        <h2 className="text-5xl font-bold mt-1 flex items-center gap-3" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
          🔗 ChegeTech Link Shortener
        </h2>
        <p className="mt-1 text-sm" style={{ color: '#52525b' }}>
          Shorten any URL · Track every click · QR codes · Geo & referrer analytics — 100% free
        </p>
      </motion.div>

      <div className="grid grid-cols-3 gap-5 flex-1 min-h-0">

        {/* ── Left: live URL shortening demo ── */}
        <motion.div
          className="col-span-1 rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: '#111111', border: '1px solid #22c55e22' }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="flex items-center gap-2">
            <motion.div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }}
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#3f3f46' }}>Live shortener</span>
          </div>

          {/* Input */}
          <div className="rounded-xl px-4 py-3" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
            <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: '#3f3f46' }}>Paste your long URL</div>
            <div className="text-xs font-mono break-all leading-relaxed" style={{ color: '#71717a', minHeight: 48 }}>
              {typed}
              {!done && <span className="animate-pulse" style={{ color: '#22c55e' }}>|</span>}
            </div>
          </div>

          {/* Shorten button → result */}
          <AnimatePresence mode="wait">
            {done && (
              <motion.div key={demo.short}
                className="flex flex-col gap-3"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px" style={{ background: '#22c55e33' }} />
                  <span className="text-xs font-mono" style={{ color: '#22c55e' }}>✓ Shortened</span>
                  <div className="flex-1 h-px" style={{ background: '#22c55e33' }} />
                </div>
                <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                  style={{ background: '#0d0d0d', border: '1px solid #22c55e44' }}>
                  <span className="text-lg font-mono font-bold" style={{ color: '#22c55e' }}>
                    https://{demo.short}
                  </span>
                  <motion.div className="text-xs px-3 py-1.5 rounded-lg font-bold font-mono"
                    style={{ background: '#22c55e22', color: '#22c55e' }}
                    animate={{ scale: [1, 1.08, 1] }} transition={{ delay: 0.5, duration: 0.3 }}>
                    ✓ Copied
                  </motion.div>
                </div>

                {/* QR placeholder */}
                <div className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
                  <div className="w-12 h-12 rounded-lg grid grid-cols-3 gap-0.5 shrink-0" style={{ background: '#1a1a1a', padding: 4 }}>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="rounded-sm" style={{ background: [0,1,2,3,5,6,7,8].includes(i) ? '#22c55e' : '#0d0d0d' }} />
                    ))}
                  </div>
                  <div>
                    <div className="text-xs font-bold" style={{ color: '#ffffff', fontFamily: 'var(--font-display)' }}>QR Code Ready</div>
                    <div className="text-xs" style={{ color: '#52525b' }}>Scan to open link instantly</div>
                  </div>
                </div>
              </motion.div>
            )}
            {!done && (
              <motion.div key="idle" className="flex-1 flex items-center justify-center"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-3xl">⌨️</div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-auto text-xs text-center" style={{ color: '#3f3f46' }}>sv.pm · powered by ChegeTech</div>
        </motion.div>

        {/* ── Middle: analytics dashboard ── */}
        <motion.div
          className="col-span-1 flex flex-col gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.6 }}
        >
          <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#3f3f46' }}>Click Analytics</div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Clicks', val: clicks.toLocaleString(), color: '#22c55e', icon: '👆' },
              { label: 'Today',        val: todayClicks.toLocaleString(), color: '#7c3aed', icon: '📅' },
              { label: 'CTR',          val: demo.ctr, color: '#ec4899', icon: '📈' },
              { label: 'Countries',    val: demo.countries.join(' '), color: '#f59e0b', icon: '🌍' },
            ].map((s, i) => (
              <motion.div key={s.label}
                className="rounded-xl p-3"
                style={{ background: '#111111', border: `1px solid ${s.color}22` }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.07 }}
              >
                <div className="text-sm mb-0.5">{s.icon}</div>
                <div className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.val}</div>
                <div className="text-xs" style={{ color: '#3f3f46' }}>{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Referrer breakdown */}
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: '#111111', border: '1px solid #1a1a1a' }}>
            <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#3f3f46' }}>Traffic Sources</div>
            <AnimatePresence mode="wait">
              <motion.div key={dIdx}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <RefBar refs={demo.refs} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Platform total */}
          <div className="rounded-2xl p-4 grid grid-cols-3 gap-3" style={{ background: '#111111', border: '1px solid #1a1a1a' }}>
            {[
              { label: 'Links', val: '48.2K' },
              { label: 'Clicks', val: '1.3M' },
              { label: 'Speed', val: '0.3s' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-bold font-mono" style={{ color: '#22c55e' }}>{s.val}</div>
                <div className="text-xs" style={{ color: '#3f3f46' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Right: features list ── */}
        <motion.div
          className="col-span-1 flex flex-col gap-3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.54, duration: 0.6 }}
        >
          <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: '#3f3f46' }}>Features</div>
          {FEATURES.map((f, i) => (
            <motion.div key={f.label}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: '#111111', border: '1px solid #22c55e18' }}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.08 }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: '#22c55e12' }}>{f.icon}</div>
              <div>
                <div className="text-sm font-semibold" style={{ color: '#ffffff', fontFamily: 'var(--font-display)' }}>{f.label}</div>
                <div className="text-xs" style={{ color: '#52525b' }}>{f.desc}</div>
              </div>
              <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center text-xs shrink-0"
                style={{ background: '#22c55e22', color: '#22c55e' }}>✓</div>
            </motion.div>
          ))}

          {/* CTA */}
          <motion.div
            className="mt-auto rounded-2xl p-4 text-center"
            style={{ background: '#22c55e12', border: '1px solid #22c55e33' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            <div className="text-2xl font-bold mb-1" style={{ color: '#22c55e', fontFamily: 'var(--font-display)' }}>100% Free</div>
            <div className="text-xs" style={{ color: '#71717a' }}>No account needed · No limits on free tier</div>
            <div className="mt-2 text-xs font-mono font-bold" style={{ color: '#22c55e' }}>streamvault-premium.site/links</div>
          </motion.div>
        </motion.div>

      </div>
    </motion.div>
  );
}
