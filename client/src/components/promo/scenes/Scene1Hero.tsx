import { motion } from 'framer-motion';
const signupImg = '/promo/streamvault-premium_site_auth.png';
import { useCountUp } from '../../hooks/useCountUp';

const STATS = [
  { label: 'Active Traders', target: 10000, suffix: '+', prefix: '', color: '#22c55e' },
  { label: 'Starting From', target: 500, suffix: '', prefix: 'KES ', color: '#7c3aed' },
  { label: 'Win Rate', target: 74, suffix: '%', prefix: '', color: '#ec4899' },
  { label: 'Strategies', target: 5, suffix: '', prefix: '', color: '#22c55e' },
];

function StatCounter({ target, prefix, suffix, label, color, delay }: typeof STATS[0] & { delay: number }) {
  const value = useCountUp(target, 1800, delay + 1400);
  const display = target >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K` : `${value}`;
  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000 + 1.2, duration: 0.6 }}
    >
      <div className="text-3xl font-bold font-mono" style={{ color, fontFamily: 'var(--font-display)' }}>
        {prefix}{display}{suffix}
      </div>
      <div className="text-xs uppercase tracking-widest mt-1" style={{ color: '#3f3f46', fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
    </motion.div>
  );
}

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  x: `${(i * 5.5) % 100}%`,
  y: `${(i * 7.3) % 100}%`,
  delay: i * 0.18,
  duration: 3 + (i % 3) * 0.8,
}));

function BrowserMockup({ src, url, className }: { src: string; url: string; className?: string }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-2xl ${className ?? ''}`}
      style={{ border: '1px solid #2a2a2a', background: '#141414' }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-3 px-4"
        style={{ height: 38, background: '#1a1a1a', borderBottom: '1px solid #222' }}
      >
        <div className="flex gap-1.5 shrink-0">
          {['#ff5f57', '#ffbd2e', '#28ca41'].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div
          className="flex-1 text-center text-xs rounded-md px-3 py-1"
          style={{ background: '#242424', color: '#666', fontFamily: 'monospace' }}
        >
          🔒 {url}
        </div>
      </div>
      <img src={src} alt="StreamVault site" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
    </div>
  );
}

export default function Scene1Hero() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center"
      style={{ backgroundColor: '#0a0a0a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Ambient glow */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 700, height: 700, left: '35%', top: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, #7c3aed0a 0%, #22c55e06 50%, transparent 70%)',
        }}
      />

      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{ left: p.x, top: p.y, background: '#22c55e' }}
          animate={{ y: [-40, -100], opacity: [0, 0.7, 0] }}
          transition={{ delay: p.delay, duration: p.duration, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      {/* Left — text */}
      <div className="relative z-10 flex flex-col pl-20 pr-8 w-[52%]">
        <motion.div
          className="flex items-center gap-3 mb-6"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#22c55e' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M3 17l4-8 4 4 4-6 4 10" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-wider uppercase" style={{ fontFamily: 'var(--font-display)', color: '#ffffff', letterSpacing: '0.15em' }}>
            Chege<span style={{ color: '#22c55e' }}>Tech</span>
          </span>
        </motion.div>

        <motion.h1
          className="text-[5.5rem] font-bold leading-none mb-5"
          style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          Stream<span style={{ color: '#22c55e' }}>Vault</span>
          <br />
          <span style={{ color: '#ec4899', fontSize: '0.75em' }}>Premium</span>
        </motion.h1>

        <motion.p
          className="text-xl mb-8 leading-relaxed max-w-md"
          style={{ fontFamily: 'var(--font-body)', color: '#a1a1aa' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.8 }}
        >
          Trading bots · Premium accounts · AI tools · VPS hosting — all in one platform.
        </motion.p>

        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.7 }}
        >
          {[
            { color: '#22c55e', label: 'Auto Trading' },
            { color: '#7c3aed', label: 'Premium Streaming' },
            { color: '#ec4899', label: 'AI Tools' },
          ].map(tag => (
            <div
              key={tag.label}
              className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ background: `${tag.color}18`, color: tag.color, border: `1px solid ${tag.color}33`, fontFamily: 'var(--font-mono)' }}
            >
              {tag.label}
            </div>
          ))}
        </motion.div>

        <motion.div
          className="mt-6 h-px w-40"
          style={{ background: 'linear-gradient(90deg, #22c55e, transparent)' }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        />
        <motion.div
          className="mt-3 text-sm"
          style={{ color: '#3f3f46' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          streamvault-premium.site
        </motion.div>

        {/* Animated stat counters */}
        <motion.div
          className="mt-8 flex items-center gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
        >
          {STATS.map((s, i) => (
            <StatCounter key={s.label} {...s} delay={i * 120} />
          ))}
        </motion.div>
      </div>

      {/* Right — real site screenshot */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 flex items-center pr-10 pl-4"
        style={{ width: '50%' }}
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.55, duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Slight tilt + shadow for depth */}
        <motion.div
          className="w-full"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ perspective: 1000, transform: 'perspective(1200px) rotateY(-6deg) rotateX(2deg)' }}
        >
          <BrowserMockup src={signupImg} url="streamvault-premium.site/auth" />
          {/* Reflection */}
          <div
            className="w-full overflow-hidden pointer-events-none select-none"
            style={{
              height: 60, marginTop: 4,
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent)',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent)',
              transform: 'scaleY(-1)',
            }}
          >
            <img src={signupImg} style={{ width: '100%', objectFit: 'cover', objectPosition: 'top' }} />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
