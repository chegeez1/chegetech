import { motion } from 'framer-motion';
const signupImg = '/promo/streamvault-premium_site_auth.png';
const pricingImg = '/promo/streamvault-premium_site_tradingbot.png';

const ORBITING = [
  { label: 'M-Pesa', color: '#22c55e', angle: 0 },
  { label: 'Boom 1000', color: '#7c3aed', angle: 72 },
  { label: 'Deriv API', color: '#ec4899', angle: 144 },
  { label: 'Auto Trade', color: '#22c55e', angle: 216 },
  { label: 'Live P&L', color: '#7c3aed', angle: 288 },
];

function toXY(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * r, y: Math.sin(rad) * r };
}

function FloatingScreen({ src, url, style, delay }: { src: string; url: string; style?: React.CSSProperties; delay: number }) {
  return (
    <motion.div
      className="rounded-xl overflow-hidden shadow-2xl"
      style={{ border: '1px solid #2a2a2a', background: '#141414', ...style }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: [0, -8, 0] }}
      transition={{
        opacity: { delay, duration: 0.8 },
        y: { delay: delay + 0.8, duration: 5 + delay, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      <div className="flex items-center gap-1.5 px-3" style={{ height: 26, background: '#1a1a1a', borderBottom: '1px solid #222' }}>
        <div className="flex gap-1">
          {['#ff5f57', '#ffbd2e', '#28ca41'].map(c => (
            <div key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div className="flex-1 text-center text-xs rounded px-2 py-0.5" style={{ background: '#242424', color: '#555', fontFamily: 'monospace', fontSize: 9 }}>
          🔒 {url}
        </div>
      </div>
      <img src={src} alt={url} style={{ width: '100%', display: 'block' }} />
    </motion.div>
  );
}

export default function Scene6CTA() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center"
      style={{ backgroundColor: '#0a0a0a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute rounded-full"
          style={{ width: 500, height: 500, left: '30%', top: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, #22c55e08 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Left: text + orbital */}
      <div className="relative z-10 flex flex-col items-center pl-16 pr-8 w-[52%]">
        {/* Orbital ring */}
        <motion.div
          className="relative mb-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {ORBITING.map((o) => {
            const pos = toXY(o.angle, 120);
            return (
              <motion.div
                key={o.label}
                className="absolute text-xs font-mono font-bold px-2.5 py-1 rounded-full"
                style={{
                  left: `calc(50% + ${pos.x}px)`, top: `calc(50% + ${pos.y}px)`,
                  transform: 'translate(-50%, -50%)',
                  background: `${o.color}1a`, color: o.color, border: `1px solid ${o.color}44`, whiteSpace: 'nowrap',
                }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + ORBITING.indexOf(o) * 0.1, duration: 0.5 }}
              >
                {o.label}
              </motion.div>
            );
          })}

          <div
            className="w-32 h-32 rounded-3xl flex flex-col items-center justify-center relative z-10"
            style={{ background: 'linear-gradient(135deg, #22c55e, #7c3aed)', boxShadow: '0 0 50px #22c55e33' }}
          >
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <path d="M3 17l4-8 4 4 4-6 4 10" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="text-xs font-bold mt-1" style={{ color: '#ffffff', fontFamily: 'var(--font-display)' }}>BOT</div>
          </div>
        </motion.div>

        <motion.h2
          className="text-6xl font-bold mb-3 text-center"
          style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.8 }}
        >
          Start Today
        </motion.h2>

        <motion.p
          className="text-lg mb-2 max-w-sm text-center"
          style={{ color: '#a1a1aa', fontFamily: 'var(--font-body)' }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7 }}
        >
          Join 10,000+ traders automating profits on Deriv
        </motion.p>

        <motion.div
          className="flex flex-col items-center gap-3 mt-4"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.7 }}
        >
          <div
            className="px-8 py-3.5 rounded-2xl text-lg font-bold flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#0a0a0a', fontFamily: 'var(--font-display)', boxShadow: '0 0 28px #22c55e44' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            streamvault-premium.site
          </div>
          <div className="text-sm" style={{ color: '#52525b' }}>
            From <span style={{ color: '#22c55e', fontWeight: 'bold' }}>KES 500/mo</span> · M-Pesa accepted
          </div>
        </motion.div>

        <motion.div
          className="mt-5 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          {['🔒 Secure Checkout', '⚡ Instant Access', '📱 Any Device'].map(tag => (
            <span
              key={tag}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: '#1a1a1a', color: '#71717a', border: '1px solid #222' }}
            >
              {tag}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Right: floating real site screenshots */}
      <div className="relative flex-1 h-full flex items-center justify-center pr-10">
        {/* Sign-up page (main, centered) */}
        <motion.div className="absolute" style={{ width: '88%', top: '8%' }}>
          <FloatingScreen
            src={signupImg}
            url="streamvault-premium.site/auth"
            delay={0.5}
          />
        </motion.div>

        {/* Pricing page (overlapping below) */}
        <motion.div
          className="absolute"
          style={{ width: '78%', bottom: '5%', right: '2%' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: [0, -5, 0] }}
          transition={{
            opacity: { delay: 0.85, duration: 0.8 },
            y: { delay: 1.7, duration: 6, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <div className="rounded-xl overflow-hidden shadow-2xl" style={{ border: '1px solid #2a2a2a', background: '#141414' }}>
            <div className="flex items-center gap-1.5 px-3" style={{ height: 26, background: '#1a1a1a', borderBottom: '1px solid #222' }}>
              <div className="flex gap-1">
                {['#ff5f57', '#ffbd2e', '#28ca41'].map(c => (
                  <div key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
                ))}
              </div>
              <div className="flex-1 text-center text-xs rounded px-2 py-0.5" style={{ background: '#242424', color: '#555', fontFamily: 'monospace', fontSize: 9 }}>
                🔒 streamvault-premium.site/tradingbot
              </div>
            </div>
            <img src={pricingImg} alt="pricing" style={{ width: '100%', display: 'block' }} />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
