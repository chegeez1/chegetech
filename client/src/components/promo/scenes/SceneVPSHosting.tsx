import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const VPS_PLANS = [
  {
    name: 'Starter VPS',
    cpu: '1 vCPU',
    ram: '1 GB RAM',
    ssd: '25 GB SSD',
    bandwidth: '1 TB',
    os: 'Ubuntu · Debian · CentOS',
    price: 'KES 800/mo',
    color: '#22c55e',
    popular: false,
  },
  {
    name: 'Pro VPS',
    cpu: '2 vCPU',
    ram: '4 GB RAM',
    ssd: '80 GB SSD',
    bandwidth: '3 TB',
    os: 'Linux · Windows Server',
    price: 'KES 2,000/mo',
    color: '#7c3aed',
    popular: true,
  },
  {
    name: 'Business VPS',
    cpu: '4 vCPU',
    ram: '8 GB RAM',
    ssd: '160 GB SSD',
    bandwidth: 'Unlimited',
    os: 'Any OS · Custom',
    price: 'KES 4,500/mo',
    color: '#ec4899',
    popular: false,
  },
];

const TERMINAL_LINES = [
  { text: '$ ssh root@196.250.x.x', color: '#a1a1aa', delay: 0.5 },
  { text: 'Welcome to Ubuntu 22.04 LTS', color: '#22c55e', delay: 1.1 },
  { text: '─────────────────────────────', color: '#3f3f46', delay: 1.4 },
  { text: 'CPU:  2 cores @ 3.4 GHz', color: '#71717a', delay: 1.7 },
  { text: 'RAM:  4 GB / 4 GB free', color: '#71717a', delay: 2.0 },
  { text: 'DISK: 80 GB SSD — mounted', color: '#71717a', delay: 2.3 },
  { text: 'IP:   196.250.xx.xx (KE)', color: '#71717a', delay: 2.6 },
  { text: '─────────────────────────────', color: '#3f3f46', delay: 2.9 },
  { text: '$ apt update && apt upgrade', color: '#a1a1aa', delay: 3.3 },
  { text: 'Reading package lists... Done', color: '#22c55e', delay: 3.9 },
  { text: '78 packages can be upgraded.', color: '#52525b', delay: 4.2 },
  { text: '$ _', color: '#22c55e', delay: 4.5 },
];

const SERVICES_ROW = [
  { icon: '🖥️', label: 'Linux VPS' },
  { icon: '🪟', label: 'Windows VPS' },
  { icon: '🌐', label: 'Web Hosting' },
  { icon: '🔐', label: 'Dedicated IPs' },
  { icon: '☁️', label: 'Cloud Storage' },
  { icon: '🔄', label: 'Auto Backups' },
];

export default function SceneVPSHosting() {
  const [terminalIdx, setTerminalIdx] = useState(0);

  useEffect(() => {
    if (terminalIdx >= TERMINAL_LINES.length) return;
    const next = TERMINAL_LINES[terminalIdx];
    const t = setTimeout(() => setTerminalIdx(p => p + 1), next.delay * 1000);
    return () => clearTimeout(t);
  }, [terminalIdx]);

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
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7 }}
      >
        <span className="text-sm font-mono uppercase tracking-widest" style={{ color: '#22c55e' }}>
          Cloud Infrastructure
        </span>
        <h2 className="text-5xl font-bold mt-2" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
          VPS & Hosting
        </h2>
        <p className="mt-2 text-base" style={{ color: '#71717a' }}>
          Fast · Reliable · African data-centres · M-Pesa payments
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-8 flex-1">
        {/* Left: Plans */}
        <div className="flex flex-col gap-4">
          {VPS_PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              className="rounded-2xl px-6 py-5 flex items-center gap-5 relative"
              style={{
                background: plan.popular ? `linear-gradient(135deg, ${plan.color}15, #111111)` : '#111111',
                border: `1px solid ${plan.popular ? plan.color + '55' : '#1e1e1e'}`,
              }}
              initial={{ opacity: 0, x: -25 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {plan.popular && (
                <div
                  className="absolute -top-3 left-5 text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: plan.color, color: '#0a0a0a', fontFamily: 'var(--font-mono)' }}
                >
                  MOST POPULAR
                </div>
              )}

              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${plan.color}18` }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="3" width="20" height="5" rx="2" stroke={plan.color} strokeWidth="2"/>
                  <rect x="2" y="10" width="20" height="5" rx="2" stroke={plan.color} strokeWidth="2"/>
                  <rect x="2" y="17" width="20" height="4" rx="2" stroke={plan.color} strokeWidth="2"/>
                  <circle cx="18" cy="5.5" r="1" fill={plan.color}/>
                  <circle cx="18" cy="12.5" r="1" fill={plan.color}/>
                </svg>
              </div>

              <div className="flex-1">
                <div className="text-base font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
                  {plan.name}
                </div>
                <div className="flex gap-3 flex-wrap">
                  {[plan.cpu, plan.ram, plan.ssd, plan.bandwidth].map(spec => (
                    <span key={spec} className="text-xs font-mono" style={{ color: '#71717a' }}>{spec}</span>
                  ))}
                </div>
                <div className="text-xs mt-1" style={{ color: '#3f3f46' }}>{plan.os}</div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-lg font-bold" style={{ color: plan.color, fontFamily: 'var(--font-display)' }}>
                  {plan.price}
                </div>
              </div>
            </motion.div>
          ))}

          <motion.div
            className="grid grid-cols-3 gap-3 mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {SERVICES_ROW.map((s, i) => (
              <motion.div
                key={s.label}
                className="rounded-xl px-3 py-3 flex items-center gap-2.5"
                style={{ background: '#111111', border: '1px solid #1a1a1a' }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85 + i * 0.07 }}
              >
                <span className="text-lg">{s.icon}</span>
                <span className="text-xs font-medium" style={{ color: '#71717a' }}>{s.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Right: Terminal */}
        <motion.div
          className="rounded-2xl overflow-hidden flex flex-col"
          style={{ background: '#0d1117', border: '1px solid #1e1e1e' }}
          initial={{ opacity: 0, x: 25 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
        >
          <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: '#1e1e1e', background: '#161b22' }}>
            <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
            <div className="ml-4 text-xs font-mono" style={{ color: '#52525b' }}>root@chegetech-vps ~ bash</div>
          </div>

          <div className="flex-1 px-5 py-5 flex flex-col gap-1.5 overflow-hidden">
            {TERMINAL_LINES.map((line, i) => (
              i < terminalIdx ? (
                <motion.div
                  key={i}
                  className="text-sm font-mono"
                  style={{ color: line.color, fontFamily: 'var(--font-mono)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {line.text}
                  {i === terminalIdx - 1 && line.text.endsWith('_') && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    >
                      {' '}
                    </motion.span>
                  )}
                </motion.div>
              ) : null
            ))}
          </div>

          <div className="px-5 py-4 border-t flex items-center gap-2" style={{ borderColor: '#1e1e1e' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
            <span className="text-xs font-mono" style={{ color: '#52525b' }}>Connected · 99.9% uptime SLA</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
