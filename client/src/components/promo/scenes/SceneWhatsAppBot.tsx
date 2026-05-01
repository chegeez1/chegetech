import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

// ─── Conversation flow ─────────────────────────────────────────────────────────
const CONVERSATIONS: Array<{ from: 'user' | 'bot'; text: string }[]> = [
  [
    { from: 'user', text: 'Hi!' },
    { from: 'bot',  text: '👋 Welcome to ChegeTech Bot!\nReply with a number:\n1️⃣ Trading Bot\n2️⃣ Premium Accounts\n3️⃣ VPS & Proxies\n4️⃣ Order Status' },
    { from: 'user', text: '1' },
    { from: 'bot',  text: '🤖 ChegeBot Pro — automated trading on Boom & Crash.\n• Plans from KES 500/mo\n• 74% average win rate\nReply PAY to subscribe now!' },
    { from: 'user', text: 'PAY' },
    { from: 'bot',  text: '✅ Invoice sent! Pay via M-Pesa:\n*Paybill 247247*\nAcc: CHEGEBOT\nAmount: KES 500\nYour bot activates instantly.' },
  ],
  [
    { from: 'user', text: '/status ORD-9812' },
    { from: 'bot',  text: '📦 Order ORD-9812\nProduct: Netflix Premium\n✅ Status: Delivered\n📧 Sent to: j***@gmail.com\nExpiry: 28 May 2026' },
  ],
  [
    { from: 'user', text: '/menu' },
    { from: 'bot',  text: '🛒 ChegeTech Store\nChoose a category:\n🎬 Premium Streaming\n🤖 Trading Bots\n🌐 VPS Hosting\n🔒 Proxies\n🎁 Gift Cards\n\nReply with category name.' },
    { from: 'user', text: 'VPS Hosting' },
    { from: 'bot',  text: '🖥️ VPS Plans\n• Basic  — KES 800/mo (1 vCPU, 1GB)\n• Pro    — KES 1,500/mo (2 vCPU, 4GB)\n• Ultra  — KES 3,000/mo (4 vCPU, 8GB)\nLinux & Windows available.\nReply PLAN [name] to order.' },
  ],
];

const WA_GREEN = '#25D366';
const WA_DARK  = '#111b21';
const WA_PANEL = '#1f2c34';
const WA_BUBBLE_BOT  = '#1e2d38';
const WA_BUBBLE_USER = '#056162';

// ─── Chat bubble ──────────────────────────────────────────────────────────────
function Bubble({ msg, delay }: { msg: typeof CONVERSATIONS[0][0]; delay: number }) {
  const isUser = msg.from === 'user';
  return (
    <motion.div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-3`}
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className="max-w-[78%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-line"
        style={{
          background: isUser ? WA_BUBBLE_USER : WA_BUBBLE_BOT,
          color: '#e9edef',
          borderBottomRightRadius: isUser ? 4 : undefined,
          borderBottomLeftRadius: isUser ? undefined : 4,
        }}
      >
        {msg.text}
        <span className="block text-right mt-1 text-[9px] opacity-50">
          {isUser ? '✓✓' : ''} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Fake WhatsApp window ─────────────────────────────────────────────────────
function WAChat({ convIdx }: { convIdx: number }) {
  const conv = CONVERSATIONS[convIdx % CONVERSATIONS.length];
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    conv.forEach((_, i) => {
      setTimeout(() => setVisible(i + 1), 500 + i * 900);
    });
  }, [convIdx]);

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: WA_DARK, height: '100%', border: `1px solid ${WA_GREEN}22` }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: WA_PANEL }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold"
          style={{ background: WA_GREEN, color: '#fff' }}>C</div>
        <div>
          <div className="text-sm font-semibold" style={{ color: '#e9edef', fontFamily: 'var(--font-display)' }}>ChegeTech Bot</div>
          <div className="text-xs flex items-center gap-1.5" style={{ color: WA_GREEN }}>
            <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: WA_GREEN }}
              animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            online
          </div>
        </div>
        <div className="ml-auto text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: `${WA_GREEN}22`, color: WA_GREEN }}>BOT</div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col gap-2 py-3 overflow-hidden"
        style={{ background: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E") ${WA_DARK}` }}>
        <AnimatePresence>
          {conv.slice(0, visible).map((msg, i) => (
            <Bubble key={i} msg={msg} delay={0} />
          ))}
        </AnimatePresence>
        {visible < conv.length && (
          <motion.div className="flex justify-start px-3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="rounded-2xl px-4 py-2.5 flex items-center gap-1" style={{ background: WA_BUBBLE_BOT, borderBottomLeftRadius: 4 }}>
              {[0, 0.15, 0.3].map((d, i) => (
                <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: WA_GREEN }}
                  animate={{ y: [-2, 2, -2] }} transition={{ duration: 0.6, delay: d, repeat: Infinity }} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: WA_PANEL }}>
        <div className="flex-1 rounded-full px-4 py-2 text-xs" style={{ background: '#2a3942', color: '#8696a0' }}>
          Type a message
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: WA_GREEN }}>
          <span className="text-white text-sm">➤</span>
        </div>
      </div>
    </div>
  );
}

// ─── Deployment steps ─────────────────────────────────────────────────────────
const STEPS = [
  { icon: '📱', label: 'Connect WhatsApp', desc: 'Scan QR — no API fees', color: WA_GREEN },
  { icon: '🤖', label: 'Configure Bot Logic', desc: 'Commands, menus, auto-reply', color: '#7c3aed' },
  { icon: '🛒', label: 'Link Your Store', desc: 'Products, pricing, checkout', color: '#ec4899' },
  { icon: '💸', label: 'Enable M-Pesa Pay', desc: 'Instant STK push invoices', color: '#22c55e' },
  { icon: '🚀', label: 'Go Live', desc: 'Deployed in under 2 minutes', color: '#f59e0b' },
];

const FEATURES = [
  '24/7 automated customer service',
  'Bulk broadcast messages',
  'Order tracking & invoice sending',
  'M-Pesa STK push integration',
  'Multi-user session handling',
  'Custom menu command trees',
];

// ─── Main Scene ───────────────────────────────────────────────────────────────
export default function SceneWhatsAppBot() {
  const [convIdx, setConvIdx] = useState(0);

  useEffect(() => {
    const last = CONVERSATIONS[convIdx % CONVERSATIONS.length];
    const dur = 500 + last.length * 900 + 1200;
    const t = setTimeout(() => setConvIdx(p => p + 1), dur);
    return () => clearTimeout(t);
  }, [convIdx]);

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
        <span className="text-sm font-mono uppercase tracking-widest" style={{ color: WA_GREEN }}>Automation</span>
        <h2 className="text-5xl font-bold mt-1 flex items-center gap-4" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
          <span className="text-5xl">💬</span> WhatsApp Bot Deployment
        </h2>
        <p className="mt-1 text-sm" style={{ color: '#52525b' }}>
          Sell, support, and automate — 24/7 on WhatsApp · M-Pesa payments built-in · Live in minutes
        </p>
      </motion.div>

      <div className="grid grid-cols-3 gap-5 flex-1 min-h-0">
        {/* Left: live chat demo */}
        <motion.div
          className="col-span-1 flex flex-col"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          style={{ minHeight: 0 }}
        >
          <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: '#3f3f46' }}>Live Demo</div>
          <div className="flex-1 min-h-0">
            <WAChat convIdx={convIdx} />
          </div>
        </motion.div>

        {/* Middle: deployment steps */}
        <motion.div
          className="col-span-1 flex flex-col gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.6 }}
        >
          <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: '#3f3f46' }}>Deploy in 5 Steps</div>
          {STEPS.map((s, i) => (
            <motion.div
              key={s.label}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: '#111111', border: `1px solid ${s.color}22` }}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: `${s.color}18` }}>
                {s.icon}
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: '#ffffff', fontFamily: 'var(--font-display)' }}>{s.label}</div>
                <div className="text-xs" style={{ color: '#52525b' }}>{s.desc}</div>
              </div>
              <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: `${s.color}22`, color: s.color }}>
                {i + 1}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Right: features + pricing */}
        <motion.div
          className="col-span-1 flex flex-col gap-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.54, duration: 0.6 }}
        >
          {/* Features */}
          <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: '#111111', border: `1px solid ${WA_GREEN}22` }}>
            <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: '#3f3f46' }}>Bot Features</div>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f}
                className="flex items-center gap-2 text-xs"
                style={{ color: '#a1a1aa' }}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.07 }}
              >
                <span style={{ color: WA_GREEN }}>✓</span> {f}
              </motion.div>
            ))}
          </div>

          {/* Pricing */}
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: '#111111', border: '1px solid #1a1a1a' }}>
            <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: '#3f3f46' }}>Pricing</div>
            {[
              { plan: 'Starter',    price: 'KES 1,500/mo', detail: '1 number · 500 msgs/day', color: WA_GREEN },
              { plan: 'Business',   price: 'KES 3,000/mo', detail: '3 numbers · unlimited',   color: '#7c3aed' },
              { plan: 'Enterprise', price: 'KES 8,000/mo', detail: 'Custom · API access',      color: '#ec4899' },
            ].map((p, i) => (
              <motion.div
                key={p.plan}
                className="flex items-center justify-between rounded-xl px-3 py-2.5"
                style={{ background: `${p.color}0d`, border: `1px solid ${p.color}2a` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 + i * 0.1 }}
              >
                <div>
                  <div className="text-xs font-bold" style={{ color: p.color, fontFamily: 'var(--font-display)' }}>{p.plan}</div>
                  <div className="text-xs" style={{ color: '#52525b' }}>{p.detail}</div>
                </div>
                <div className="text-sm font-bold font-mono" style={{ color: '#ffffff' }}>{p.price}</div>
              </motion.div>
            ))}
            <div className="text-xs text-center pt-1" style={{ color: '#3f3f46' }}>
              streamvault-premium.site · instant setup
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
