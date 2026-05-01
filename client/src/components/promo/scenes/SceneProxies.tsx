import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

// ─── Free proxy pool (simulated live feed) ────────────────────────────────────
const FREE_POOL = [
  { ip: '103.152.112.145', port: '8080', country: '🇺🇸', cc: 'US', type: 'HTTP',   anon: 'Elite',       ms: 210 },
  { ip: '185.199.228.220', port: '65000',country: '🇩🇪', cc: 'DE', type: 'HTTPS',  anon: 'Anonymous',   ms: 145 },
  { ip: '47.74.152.29',    port: '8888', country: '🇸🇬', cc: 'SG', type: 'SOCKS5', anon: 'Elite',       ms: 98  },
  { ip: '179.96.28.58',    port: '3128', country: '🇧🇷', cc: 'BR', type: 'HTTP',   anon: 'Transparent', ms: 320 },
  { ip: '194.165.16.16',   port: '8080', country: '🇳🇱', cc: 'NL', type: 'HTTPS',  anon: 'Elite',       ms: 55  },
  { ip: '45.33.32.179',    port: '1080', country: '🇬🇧', cc: 'GB', type: 'SOCKS4', anon: 'Anonymous',   ms: 180 },
  { ip: '8.219.97.248',    port: '80',   country: '🇯🇵', cc: 'JP', type: 'HTTP',   anon: 'Elite',       ms: 72  },
  { ip: '91.108.4.179',    port: '3128', country: '🇫🇷', cc: 'FR', type: 'HTTPS',  anon: 'Anonymous',   ms: 130 },
  { ip: '203.78.235.132',  port: '8080', country: '🇮🇳', cc: 'IN', type: 'HTTP',   anon: 'Elite',       ms: 260 },
  { ip: '134.195.101.21',  port: '3128', country: '🇨🇦', cc: 'CA', type: 'HTTPS',  anon: 'Elite',       ms: 88  },
];

const PAID_PLANS = [
  {
    type: 'Residential',
    icon: '🏠',
    color: '#22c55e',
    tag: 'Most Trusted',
    tagColor: '#22c55e',
    desc: 'Real ISP IPs — undetectable',
    features: ['Rotating & sticky sessions', '50+ countries', '99.5% success rate', 'KES 800 / 1 GB'],
    badge: 'POPULAR',
  },
  {
    type: 'Datacenter',
    icon: '🖥️',
    color: '#3b82f6',
    tag: 'Fastest',
    tagColor: '#3b82f6',
    desc: 'Dedicated & shared pools',
    features: ['10 Gbps speed', 'IPv4 & IPv6', 'Unlimited bandwidth', 'KES 300 / proxy'],
    badge: null,
  },
  {
    type: 'Mobile 4G/5G',
    icon: '📱',
    color: '#7c3aed',
    tag: 'Best Bypass',
    tagColor: '#7c3aed',
    desc: 'Carrier IPs — ultra-clean',
    features: ['Real mobile networks', 'Auto IP rotation', 'East Africa coverage', 'KES 1,200 / GB'],
    badge: 'NEW',
  },
  {
    type: 'IPv6 Proxies',
    icon: '⚡',
    color: '#f59e0b',
    tag: 'Bulk Ready',
    tagColor: '#f59e0b',
    desc: 'Unlimited scale, low cost',
    features: ['100K+ IPs pool', 'Instant provisioning', 'API access', 'KES 50 / 100 IPs'],
    badge: null,
  },
];

function TypePill({ type }: { type: string }) {
  const colors: Record<string, string> = {
    HTTP:    '#3b82f6',
    HTTPS:   '#22c55e',
    SOCKS5:  '#7c3aed',
    SOCKS4:  '#a78bfa',
  };
  const c = colors[type] ?? '#52525b';
  return (
    <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: `${c}22`, color: c, fontFamily: 'var(--font-mono)' }}>
      {type}
    </span>
  );
}

function SpeedBar({ ms }: { ms: number }) {
  const pct = Math.max(5, Math.min(100, 100 - ms / 4));
  const color = ms < 100 ? '#22c55e' : ms < 200 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: '#1e1e1e' }}>
        <motion.div className="h-full rounded-full" style={{ background: color, width: `${pct}%` }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
      </div>
      <span className="text-xs" style={{ color, fontFamily: 'var(--font-mono)', minWidth: 36 }}>{ms}ms</span>
    </div>
  );
}

function AnonBadge({ level }: { level: string }) {
  const map: Record<string, string> = { Elite: '#22c55e', Anonymous: '#f59e0b', Transparent: '#71717a' };
  const c = map[level] ?? '#52525b';
  return <span className="text-xs" style={{ color: c }}>{level}</span>;
}

type Row = typeof FREE_POOL[0] & { uid: number };
let uidCounter = 0;

function FreeProxyTable() {
  const [rows, setRows] = useState<Row[]>(() =>
    FREE_POOL.slice(0, 7).map(p => ({ ...p, uid: uidCounter++ }))
  );
  const [highlight, setHighlight] = useState<number | null>(null);
  const tickerRef = useRef(0);

  useEffect(() => {
    const t = setInterval(() => {
      const replaceIdx = Math.floor(Math.random() * 7);
      const newProxy = FREE_POOL[(tickerRef.current + 7) % FREE_POOL.length];
      setHighlight(replaceIdx);
      setTimeout(() => {
        setRows(prev => {
          const next = [...prev];
          next[replaceIdx] = { ...newProxy, ms: newProxy.ms + Math.floor(Math.random() * 30 - 15), uid: uidCounter++ };
          return next;
        });
        setHighlight(null);
      }, 300);
      tickerRef.current += 1;
    }, 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col gap-1.5 overflow-hidden flex-1">
      {/* Header */}
      <div className="grid gap-2 px-3 pb-1 text-xs font-bold uppercase tracking-widest"
        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr', color: '#3f3f46', fontFamily: 'var(--font-mono)', borderBottom: '1px solid #1a1a1a' }}>
        <span>IP : PORT</span><span>CC</span><span>TYPE</span><span>ANON</span><span>SPEED</span>
      </div>
      <AnimatePresence mode="popLayout">
        {rows.map((p, i) => (
          <motion.div
            key={p.uid}
            layout
            className="grid gap-2 px-3 py-2 rounded-xl items-center"
            style={{
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr',
              background: highlight === i ? '#22c55e08' : '#0d0d0d',
              border: `1px solid ${highlight === i ? '#22c55e33' : '#111111'}`,
              transition: 'background 0.3s, border-color 0.3s',
            }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3 }}
          >
            <span className="font-mono text-xs truncate" style={{ color: '#a1a1aa' }}>{p.ip}<span style={{ color: '#3f3f46' }}>:{p.port}</span></span>
            <span className="text-xs" style={{ color: '#71717a' }}>{p.country} {p.cc}</span>
            <TypePill type={p.type} />
            <AnonBadge level={p.anon} />
            <SpeedBar ms={p.ms} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function SceneProxies() {
  const [liveCount, setLiveCount] = useState(12847);
  useEffect(() => {
    const t = setInterval(() => setLiveCount(c => c + Math.floor(Math.random() * 5 - 2)), 600);
    return () => clearInterval(t);
  }, []);

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
        className="flex items-end justify-between mb-5"
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.7 }}
      >
        <div>
          <span className="text-sm font-mono uppercase tracking-widest" style={{ color: '#22c55e' }}>Proxy Services</span>
          <h2 className="text-5xl font-bold mt-1" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
            Free &amp; Paid Proxies
          </h2>
          <p className="mt-1 text-sm" style={{ color: '#52525b' }}>
            Residential · Datacenter · Mobile · IPv6 — fully anonymous, always online
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-4 py-2" style={{ background: '#111', border: '1px solid #22c55e22' }}>
          <motion.div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
          <span className="text-sm font-mono" style={{ color: '#22c55e' }}>{liveCount.toLocaleString()} live IPs</span>
        </div>
      </motion.div>

      {/* Body: Free table + Paid cards */}
      <div className="flex gap-6 flex-1 min-h-0">

        {/* ── Free proxy panel ── */}
        <motion.div
          className="flex flex-col rounded-2xl p-5 flex-1"
          style={{ background: '#111111', border: '1px solid #22c55e22' }}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: '#22c55e18' }}>🆓</div>
            <div>
              <div className="font-bold" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>Free Proxies</div>
              <div className="text-xs" style={{ color: '#52525b' }}>Live feed · Updated every 60s</div>
            </div>
            <div className="ml-auto flex gap-2 text-xs" style={{ color: '#3f3f46' }}>
              {['HTTP','HTTPS','SOCKS4','SOCKS5'].map(t => <TypePill key={t} type={t} />)}
            </div>
          </div>
          <FreeProxyTable />
          <div className="mt-3 text-xs text-center" style={{ color: '#3f3f46' }}>
            Free proxies are shared &amp; limited · <span style={{ color: '#f59e0b' }}>Upgrade for guaranteed uptime</span>
          </div>
        </motion.div>

        {/* ── Paid proxy cards ── */}
        <motion.div
          className="flex flex-col w-80 gap-3"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.38, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: '#7c3aed18' }}>💎</div>
            <div>
              <div className="font-bold" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>Premium Proxies</div>
              <div className="text-xs" style={{ color: '#52525b' }}>Guaranteed · SLA uptime</div>
            </div>
          </div>
          {PAID_PLANS.map((plan, i) => (
            <motion.div
              key={plan.type}
              className="rounded-2xl p-4 flex flex-col relative overflow-hidden"
              style={{ background: '#111111', border: `1px solid ${plan.color}22` }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.09, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {plan.badge && (
                <div className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${plan.color}22`, color: plan.color, fontFamily: 'var(--font-mono)' }}>
                  {plan.badge}
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{plan.icon}</span>
                <div>
                  <div className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>{plan.type}</div>
                  <div className="text-xs" style={{ color: '#52525b' }}>{plan.desc}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {plan.features.map((f, j) => (
                  <div key={f} className="flex items-center gap-1.5 text-xs">
                    <span style={{ color: plan.color }}>✓</span>
                    <span style={{ color: j === plan.features.length - 1 ? plan.color : '#71717a', fontFamily: j === plan.features.length - 1 ? 'var(--font-mono)' : 'inherit', fontWeight: j === plan.features.length - 1 ? 700 : 400 }}>
                      {f}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs px-2 py-0.5 rounded inline-block self-start" style={{ background: `${plan.color}15`, color: plan.tagColor }}>
                {plan.tag}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
