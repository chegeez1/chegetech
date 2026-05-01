import { motion } from 'framer-motion';

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" fill="#22c55e"/>
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Auto-Pilot Trading',
    desc: 'Runs 24/7 on Deriv Volatility Indices — Boom, Crash, Step',
    color: '#22c55e',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Smart Strategies',
    desc: 'Martingale, D\'Alembert & custom stake multipliers built in',
    color: '#7c3aed',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="11" width="18" height="11" rx="2" stroke="#ec4899" strokeWidth="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Risk Controls',
    desc: 'Take-profit & stop-loss limits. Protect your capital automatically',
    color: '#ec4899',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M3 17l4-8 4 4 4-6 4 10" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Live P&L Dashboard',
    desc: 'Real-time profit/loss tracker with trade-by-trade history log',
    color: '#22c55e',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Paystack Paywall',
    desc: 'M-Pesa · Card · Wallet. KES 500/mo or lifetime access',
    color: '#7c3aed',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="2" width="14" height="20" rx="2" stroke="#ec4899" strokeWidth="2"/>
        <path d="M12 18h.01" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Mobile Friendly',
    desc: 'Trade from any device — responsive UI, no app install needed',
    color: '#ec4899',
  },
];

export default function Scene3Features() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col px-14 py-10"
      style={{ backgroundColor: '#0a0a0a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="mb-8 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7 }}
      >
        <span className="text-sm font-mono uppercase tracking-widest" style={{ color: '#22c55e' }}>
          What You Get
        </span>
        <h2 className="text-5xl font-bold mt-2" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
          Packed with Power
        </h2>
      </motion.div>

      <div className="grid grid-cols-3 gap-5 flex-1">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            className="rounded-2xl p-6 flex flex-col gap-3"
            style={{
              background: `linear-gradient(135deg, ${f.color}0d 0%, #111111 100%)`,
              border: `1px solid ${f.color}22`,
            }}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: `${f.color}18` }}
            >
              {f.icon}
            </div>
            <div>
              <div className="text-lg font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
                {f.title}
              </div>
              <div className="text-sm leading-relaxed" style={{ color: '#71717a' }}>
                {f.desc}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
