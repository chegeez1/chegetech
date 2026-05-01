import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const GIFT_CARDS = [
  { name: 'Amazon', value: '$5–$500', color: '#f59e0b', icon: '📦' },
  { name: 'iTunes / Apple', value: '$15–$200', color: '#a78bfa', icon: '🍎' },
  { name: 'Google Play', value: '$10–$100', color: '#22c55e', icon: '▶️' },
  { name: 'Steam', value: '$20–$100', color: '#3b82f6', icon: '🎮' },
  { name: 'Xbox / PSN', value: '$10–$50', color: '#10b981', icon: '🕹️' },
  { name: 'Uber / Bolt', value: '$5–$50', color: '#f97316', icon: '🚗' },
];

const SMM_SERVICES = [
  { platform: 'Instagram', icon: '📸', color: '#ec4899', items: ['Followers', 'Likes', 'Views', 'Story views'] },
  { platform: 'TikTok', icon: '🎵', color: '#ffffff', items: ['Followers', 'Likes', 'Views', 'Comments'] },
  { platform: 'YouTube', icon: '▶', color: '#ef4444', items: ['Subscribers', 'Views', 'Likes', 'Watch hours'] },
  { platform: 'Twitter / X', icon: '𝕏', color: '#a1a1aa', items: ['Followers', 'Retweets', 'Likes'] },
];

const OLD_ACCOUNTS = [
  { platform: 'Facebook', age: '2–10 yrs', color: '#3b82f6', icon: 'f', friends: '200+', verified: true },
  { platform: 'Twitter / X', age: '3–8 yrs', color: '#a1a1aa', icon: '𝕏', friends: '500+', verified: true },
  { platform: 'Instagram', age: '2–6 yrs', color: '#ec4899', icon: '📸', friends: '300+', verified: false },
  { platform: 'TikTok', age: '1–4 yrs', color: '#ffffff', icon: '🎵', friends: '1K+', verified: false },
  { platform: 'Reddit', age: '3–10 yrs', color: '#f97316', icon: '🤖', friends: '5K karma', verified: true },
];

const PROXY_TYPES = [
  { type: 'Residential', desc: 'Real ISP IPs · Rotating', color: '#22c55e', tag: 'Most trusted' },
  { type: 'Datacenter', desc: 'Fast · Shared/Dedicated', color: '#3b82f6', tag: 'Cheapest' },
  { type: 'Mobile 4G/5G', desc: 'Carrier IPs · Ultra-clean', color: '#7c3aed', tag: 'Best bypass' },
  { type: 'IPv6 Proxies', desc: 'Unlimited · Bulk ready', color: '#f59e0b', tag: 'For scale' },
];

function GiftCardsPanel({ delay }: { delay: number }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % GIFT_CARDS.length), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col h-full"
      style={{ background: '#111111', border: '1px solid #f59e0b22' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#f59e0b18' }}>🎁</div>
        <div>
          <div className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>Gift Cards</div>
          <div className="text-xs" style={{ color: '#52525b' }}>Instant · Any country</div>
        </div>
        <div className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: '#f59e0b18', color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>HOT</div>
      </div>
      <div className="grid grid-cols-2 gap-2 flex-1">
        {GIFT_CARDS.map((gc, i) => (
          <motion.div
            key={gc.name}
            className="rounded-xl px-3 py-2.5 flex items-center gap-2"
            style={{
              background: i === active ? `${gc.color}14` : '#0d0d0d',
              border: `1px solid ${i === active ? gc.color + '55' : '#1a1a1a'}`,
              transition: 'all 0.3s ease',
            }}
          >
            <span className="text-base">{gc.icon}</span>
            <div>
              <div className="text-xs font-bold" style={{ color: i === active ? gc.color : '#a1a1aa', fontFamily: 'var(--font-display)' }}>{gc.name}</div>
              <div className="text-xs" style={{ color: '#3f3f46', fontFamily: 'var(--font-mono)' }}>{gc.value}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SMMPanel({ delay }: { delay: number }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % SMM_SERVICES.length), 1200);
    return () => clearInterval(t);
  }, []);
  const svc = SMM_SERVICES[active];
  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col h-full"
      style={{ background: '#111111', border: '1px solid #ec489922' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#ec489918' }}>📊</div>
        <div>
          <div className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>SMM Panel</div>
          <div className="text-xs" style={{ color: '#52525b' }}>Grow any account fast</div>
        </div>
        <div className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: '#ec489918', color: '#ec4899', fontFamily: 'var(--font-mono)' }}>PANEL</div>
      </div>

      {/* Platform tabs */}
      <div className="flex gap-1.5 mb-3">
        {SMM_SERVICES.map((s, i) => (
          <button
            key={s.platform}
            className="flex-1 text-xs py-1 rounded-lg font-bold transition-all"
            style={{
              background: i === active ? `${s.color}22` : '#0d0d0d',
              color: i === active ? s.color : '#3f3f46',
              border: `1px solid ${i === active ? s.color + '44' : '#1a1a1a'}`,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {s.icon}
          </button>
        ))}
      </div>

      <motion.div
        key={active}
        className="flex-1 rounded-xl p-3 flex flex-col gap-2"
        style={{ background: '#0d0d0d', border: `1px solid ${svc.color}22` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-xs font-bold mb-1" style={{ color: svc.color, fontFamily: 'var(--font-display)' }}>{svc.platform}</div>
        {svc.items.map((item, j) => (
          <motion.div
            key={item}
            className="flex items-center justify-between text-xs rounded-lg px-3 py-1.5"
            style={{ background: '#141414' }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: j * 0.07 }}
          >
            <span style={{ color: '#a1a1aa' }}>{item}</span>
            <span style={{ color: '#22c55e', fontFamily: 'var(--font-mono)' }}>
              {['1K', '5K', '10K', '50K'][j % 4]}+
            </span>
          </motion.div>
        ))}
        <div className="mt-auto text-xs" style={{ color: '#3f3f46' }}>Starting from <span style={{ color: '#22c55e' }}>KES 50</span></div>
      </motion.div>
    </motion.div>
  );
}

function OldAccountsPanel({ delay }: { delay: number }) {
  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col h-full"
      style={{ background: '#111111', border: '1px solid #3b82f622' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#3b82f618' }}>👤</div>
        <div>
          <div className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>Aged Accounts</div>
          <div className="text-xs" style={{ color: '#52525b' }}>Old · Trusted · Ready to use</div>
        </div>
        <div className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: '#3b82f618', color: '#3b82f6', fontFamily: 'var(--font-mono)' }}>AGED</div>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {OLD_ACCOUNTS.map((acc, i) => (
          <motion.div
            key={acc.platform}
            className="rounded-xl px-3 py-2 flex items-center gap-3"
            style={{ background: '#0d0d0d', border: `1px solid ${acc.color}1a` }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.1 + i * 0.07, duration: 0.4 }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: `${acc.color}18`, color: acc.color }}
            >
              {acc.icon}
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold" style={{ color: '#ffffff', fontFamily: 'var(--font-display)' }}>{acc.platform}</div>
              <div className="text-xs" style={{ color: '#52525b' }}>{acc.friends} connections · {acc.age} old</div>
            </div>
            {acc.verified && (
              <div className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#22c55e15', color: '#22c55e', fontFamily: 'var(--font-mono)' }}>✓</div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function ProxiesPanel({ delay }: { delay: number }) {
  const [counter, setCounter] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCounter(p => p + Math.floor(Math.random() * 3 + 1)), 180);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col h-full"
      style={{ background: '#111111', border: '1px solid #22c55e22' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#22c55e18' }}>🌐</div>
        <div>
          <div className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>Proxies</div>
          <div className="text-xs" style={{ color: '#52525b' }}>Residential · DC · Mobile</div>
        </div>
        <div className="ml-auto text-xs font-mono" style={{ color: '#22c55e' }}>
          {(1200 + counter).toLocaleString()} IPs
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {PROXY_TYPES.map((p, i) => (
          <motion.div
            key={p.type}
            className="rounded-xl px-3 py-2.5 flex items-center gap-3"
            style={{ background: '#0d0d0d', border: `1px solid ${p.color}22` }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.1 + i * 0.08, duration: 0.4 }}
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
            <div className="flex-1">
              <div className="text-xs font-bold" style={{ color: '#ffffff', fontFamily: 'var(--font-display)' }}>{p.type}</div>
              <div className="text-xs" style={{ color: '#52525b' }}>{p.desc}</div>
            </div>
            <div className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: `${p.color}18`, color: p.color, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>
              {p.tag}
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-3 rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ background: '#22c55e' }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
        <span className="text-xs font-mono" style={{ color: '#3f3f46' }}>IP rotation active · </span>
        <span className="text-xs font-mono" style={{ color: '#22c55e' }}>99.9% uptime</span>
      </div>
    </motion.div>
  );
}

export default function SceneDigitalStore() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col px-10 py-8"
      style={{ backgroundColor: '#0a0a0a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.7 }}
      >
        <span className="text-sm font-mono uppercase tracking-widest" style={{ color: '#f59e0b' }}>
          Digital Store
        </span>
        <h2 className="text-5xl font-bold mt-1.5" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
          Everything Digital, One Platform
        </h2>
        <p className="mt-2 text-sm" style={{ color: '#52525b' }}>
          Gift Cards · SMM Panel · Aged Accounts · Proxies — all at ChegeTech
        </p>
      </motion.div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">
        <GiftCardsPanel delay={0.3} />
        <SMMPanel delay={0.42} />
        <OldAccountsPanel delay={0.54} />
        <ProxiesPanel delay={0.66} />
      </div>

      {/* Bottom strip */}
      <motion.div
        className="mt-4 flex items-center justify-center gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0 }}
      >
        {[
          { icon: '⚡', text: 'Instant delivery' },
          { icon: '🔒', text: 'Secure & private' },
          { icon: '📱', text: 'M-Pesa / Card' },
          { icon: '💬', text: '24/7 support' },
          { icon: '♻️', text: 'Bulk orders welcome' },
        ].map(tag => (
          <div key={tag.text} className="flex items-center gap-1.5 text-sm" style={{ color: '#3f3f46' }}>
            <span>{tag.icon}</span>
            <span>{tag.text}</span>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
