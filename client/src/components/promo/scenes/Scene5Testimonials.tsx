import { motion } from 'framer-motion';

const TESTIMONIALS = [
  {
    name: 'James M.',
    location: 'Nairobi, KE',
    text: 'Made back my KES 500 in the first week. The bot trades while I sleep — this is the future.',
    profit: '+KES 4,200',
    avatar: 'JM',
    color: '#22c55e',
  },
  {
    name: 'Aisha K.',
    location: 'Mombasa, KE',
    text: 'I was skeptical, but the win-rate speaks for itself. Subscribed to lifetime immediately.',
    profit: '+KES 9,850',
    avatar: 'AK',
    color: '#7c3aed',
  },
  {
    name: 'Brian O.',
    location: 'Kisumu, KE',
    text: 'M-Pesa payment was instant. Bot was live in 5 minutes. ChegeBot Pro delivers.',
    profit: '+KES 6,400',
    avatar: 'BO',
    color: '#ec4899',
  },
];

const STATS = [
  { value: '10,000+', label: 'Active Traders' },
  { value: '74%', label: 'Avg Win Rate' },
  { value: 'KES 2.4M+', label: 'Profits Generated' },
  { value: '4.9★', label: 'User Rating' },
];

export default function Scene5Testimonials() {
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
          Traders Love It
        </span>
        <h2 className="text-5xl font-bold mt-2" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
          Real Results
        </h2>
      </motion.div>

      <div className="grid grid-cols-3 gap-5 mb-8">
        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={t.name}
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: '#111111', border: '1px solid #222222' }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: `${t.color}22`, color: t.color, fontFamily: 'var(--font-display)' }}
                >
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: '#ffffff' }}>{t.name}</div>
                  <div className="text-xs" style={{ color: '#52525b' }}>{t.location}</div>
                </div>
              </div>
              <motion.div
                className="text-sm font-bold font-mono"
                style={{ color: '#22c55e' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.12 }}
              >
                {t.profit}
              </motion.div>
            </div>

            <p className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>
              "{t.text}"
            </p>

            <div className="flex gap-0.5">
              {[...Array(5)].map((_, j) => (
                <motion.span
                  key={j}
                  style={{ color: '#f59e0b', fontSize: '14px' }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + i * 0.1 + j * 0.05 }}
                >
                  ★
                </motion.span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="grid grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.7 }}
      >
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            className="rounded-xl px-5 py-4 text-center"
            style={{ background: '#111111', border: '1px solid #1a1a1a' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 + i * 0.08 }}
          >
            <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: '#22c55e' }}>
              {s.value}
            </div>
            <div className="text-xs mt-1 uppercase tracking-wider" style={{ color: '#52525b', fontFamily: 'var(--font-mono)' }}>
              {s.label}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
