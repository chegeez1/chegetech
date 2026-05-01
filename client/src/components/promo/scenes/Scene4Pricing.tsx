import { motion } from 'framer-motion';
const pricingImg = '/promo/streamvault-premium_site_tradingbot.png';

const PLANS = [
  {
    name: 'Monthly',
    price: 'KES 500',
    period: '/month',
    color: '#22c55e',
    features: ['Full bot access', 'All strategies', 'Live P&L dashboard', 'Email support'],
    badge: null,
  },
  {
    name: 'Quarterly',
    price: 'KES 1,200',
    period: '/3 months',
    color: '#7c3aed',
    features: ['Everything in Monthly', 'Priority support', 'Advanced risk settings', 'Save 20%'],
    badge: 'POPULAR',
  },
  {
    name: 'Lifetime',
    price: 'KES 5,000',
    period: 'one time',
    color: '#ec4899',
    features: ['Lifetime bot access', 'All future features', 'VIP support', 'Best value'],
    badge: 'BEST DEAL',
  },
];

const PAYMENT_METHODS = [
  { label: 'M-Pesa', color: '#22c55e', icon: '📱' },
  { label: 'Card', color: '#7c3aed', icon: '💳' },
  { label: 'Wallet', color: '#ec4899', icon: '👛' },
];

function BrowserMockup({ src, url }: { src: string; url: string }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #222', background: '#141414' }}>
      <div className="flex items-center gap-2 px-3" style={{ height: 32, background: '#1a1a1a', borderBottom: '1px solid #222' }}>
        <div className="flex gap-1">
          {['#ff5f57', '#ffbd2e', '#28ca41'].map(c => (
            <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div className="flex-1 text-center text-xs rounded px-2 py-0.5" style={{ background: '#242424', color: '#666', fontFamily: 'monospace', fontSize: 10 }}>
          🔒 {url}
        </div>
      </div>
      <img src={src} alt="Pricing page" style={{ width: '100%', display: 'block' }} />
    </div>
  );
}

export default function Scene4Pricing() {
  return (
    <motion.div
      className="absolute inset-0 flex gap-0"
      style={{ backgroundColor: '#0a0a0a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Left: pricing cards */}
      <div className="flex flex-col px-12 py-10 w-[58%]">
        <motion.div
          className="mb-7"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
        >
          <span className="text-sm font-mono uppercase tracking-widest" style={{ color: '#22c55e' }}>Pricing Plans</span>
          <h2 className="text-5xl font-bold mt-1.5" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
            Pick Your Plan
          </h2>
          <p className="mt-2 text-sm" style={{ color: '#52525b' }}>Instant activation after payment</p>
        </motion.div>

        <div className="grid grid-cols-3 gap-4 flex-1">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              className="relative rounded-2xl p-5 flex flex-col"
              style={{
                background: i === 1 ? `linear-gradient(160deg, ${plan.color}1a 0%, #111111 60%)` : '#111111',
                border: `1px solid ${i === 1 ? plan.color + '55' : '#222222'}`,
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {plan.badge && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-0.5 rounded-full"
                  style={{ background: plan.color, color: '#0a0a0a', fontFamily: 'var(--font-mono)' }}
                >
                  {plan.badge}
                </div>
              )}

              <div className="mb-4">
                <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: plan.color }}>{plan.name}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
                    {plan.price}
                  </span>
                  <span className="text-xs" style={{ color: '#52525b' }}>{plan.period}</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2.5">
                {plan.features.map((f, j) => (
                  <motion.div
                    key={f}
                    className="flex items-center gap-2 text-xs"
                    style={{ color: '#a1a1aa' }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55 + i * 0.12 + j * 0.06 }}
                  >
                    <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{ background: `${plan.color}22` }}>
                      <svg width="8" height="8" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke={plan.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    {f}
                  </motion.div>
                ))}
              </div>

              <div
                className="mt-5 rounded-xl py-2.5 text-center text-xs font-bold"
                style={{
                  background: i === 1 ? plan.color : 'transparent',
                  color: i === 1 ? '#0a0a0a' : plan.color,
                  border: i === 1 ? 'none' : `1px solid ${plan.color}44`,
                  fontFamily: 'var(--font-display)',
                }}
              >
                Get Started
              </div>
            </motion.div>
          ))}
        </div>

        {/* Payment methods */}
        <motion.div
          className="mt-5 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
        >
          <span className="text-xs" style={{ color: '#3f3f46' }}>Pay via:</span>
          {PAYMENT_METHODS.map(m => (
            <div
              key={m.label}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold"
              style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}33` }}
            >
              {m.icon} {m.label}
            </div>
          ))}
          <span className="text-xs ml-1" style={{ color: '#3f3f46' }}>· Secured by Paystack</span>
        </motion.div>
      </div>

      {/* Right: real pricing page screenshot */}
      <motion.div
        className="flex-1 flex items-center justify-center px-8 py-10"
        style={{ borderLeft: '1px solid #161616' }}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="w-full">
          <div className="text-xs font-mono uppercase tracking-widest mb-3 text-center" style={{ color: '#3f3f46' }}>
            Live site preview
          </div>
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <BrowserMockup src={pricingImg} url="streamvault-premium.site/tradingbot" />
          </motion.div>
          <div className="text-center mt-3 text-xs" style={{ color: '#22c55e' }}>
            ✓ Instant activation after payment
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
