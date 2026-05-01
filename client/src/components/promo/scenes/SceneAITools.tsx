import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const CHAT_MESSAGES = [
  { role: 'user', text: 'What does ChegeTech StreamVault offer?', delay: 0.3 },
  {
    role: 'ai',
    text: 'ChegeTech StreamVault is a one-stop premium platform. You get: trading bot access, streaming subscriptions, VPS hosting, temp mail & SMS tools, and premium accounts — all under one subscription.',
    delay: 1.4,
  },
  { role: 'user', text: 'Which AI tools can I access?', delay: 3.6 },
  {
    role: 'ai',
    text: 'You get premium access to ChatGPT Plus (GPT-4o), Claude Pro, Midjourney v6, GitHub Copilot, and more. All accounts are verified and delivered instantly.',
    delay: 4.7,
  },
];

const AI_SERVICES = [
  { name: 'ChatGPT Plus', model: 'GPT-4o · DALL·E 3', emoji: '🤖', color: '#22c55e' },
  { name: 'Claude Pro', model: 'Claude 3.5 Sonnet', emoji: '💜', color: '#7c3aed' },
  { name: 'Midjourney', model: 'v6 · Imagine · Blend', emoji: '🎨', color: '#ec4899' },
  { name: 'GitHub Copilot', model: 'AI code completion', emoji: '👨‍💻', color: '#22c55e' },
  { name: 'Perplexity Pro', model: 'AI search · Research', emoji: '🔍', color: '#3b82f6' },
  { name: 'Sora', model: 'AI video generation', emoji: '🎥', color: '#f59e0b' },
];

function TypingDots() {
  return (
    <div className="flex gap-1 items-center px-4 py-3">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ background: '#7c3aed' }}
          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ delay: i * 0.15, duration: 0.7, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

export default function SceneAITools() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    CHAT_MESSAGES.forEach((msg, i) => {
      if (msg.role === 'ai') {
        // show typing dots just before AI replies
        timers.push(setTimeout(() => setShowTyping(true), (msg.delay - 0.8) * 1000));
        timers.push(setTimeout(() => { setShowTyping(false); setVisibleCount(i + 1); }, msg.delay * 1000));
      } else {
        timers.push(setTimeout(() => setVisibleCount(i + 1), msg.delay * 1000));
      }
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex gap-0"
      style={{ backgroundColor: '#0a0a0a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Left: AI chat panel */}
      <div className="w-[52%] flex flex-col px-12 py-10 border-r" style={{ borderColor: '#1a1a1a' }}>
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          <span className="text-sm font-mono uppercase tracking-widest" style={{ color: '#7c3aed' }}>
            AI-Powered
          </span>
          <h2 className="text-4xl font-bold mt-1" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
            See What AI Says
          </h2>
        </motion.div>

        {/* Chat header */}
        <div className="rounded-2xl overflow-hidden flex flex-col flex-1" style={{ background: '#111111', border: '1px solid #1e1e1e' }}>
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: '#1e1e1e' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
              <span className="text-base">✨</span>
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: '#ffffff', fontFamily: 'var(--font-display)' }}>StreamVault AI</div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
                <span className="text-xs" style={{ color: '#52525b' }}>Online</span>
              </div>
            </div>
            <div className="ml-auto text-xs px-2.5 py-1 rounded-full" style={{ background: '#22c55e18', color: '#22c55e' }}>
              Powered by GPT-4o
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-3 px-5 py-5 overflow-hidden">
            {CHAT_MESSAGES.slice(0, visibleCount).map((msg, i) => (
              <motion.div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div
                  className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                  style={
                    msg.role === 'user'
                      ? { background: '#22c55e', color: '#0a0a0a', fontWeight: 600 }
                      : { background: '#1a1a1a', color: '#d4d4d8', border: '1px solid #252525' }
                  }
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}

            {showTyping && (
              <motion.div className="flex justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="rounded-2xl" style={{ background: '#1a1a1a', border: '1px solid #252525' }}>
                  <TypingDots />
                </div>
              </motion.div>
            )}
          </div>

          <div className="px-4 py-3 border-t flex items-center gap-3" style={{ borderColor: '#1e1e1e' }}>
            <div className="flex-1 rounded-xl px-4 py-2.5 text-sm" style={{ background: '#0a0a0a', color: '#3f3f46', border: '1px solid #1e1e1e' }}>
              Ask anything about ChegeTech…
            </div>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#22c55e' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Right: AI services grid */}
      <div className="flex-1 flex flex-col px-10 py-10">
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <span className="text-sm font-mono uppercase tracking-widest" style={{ color: '#ec4899' }}>
            Premium AI Access
          </span>
          <h2 className="text-4xl font-bold mt-1" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
            Top AI Tools
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 flex-1">
          {AI_SERVICES.map((ai, i) => (
            <motion.div
              key={ai.name}
              className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: '#111111', border: `1px solid ${ai.color}22` }}
              initial={{ opacity: 0, scale: 0.93, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between">
                <div className="text-3xl">{ai.emoji}</div>
                <div
                  className="text-xs px-2.5 py-1 rounded-full font-bold"
                  style={{ background: `${ai.color}18`, color: ai.color, fontFamily: 'var(--font-mono)' }}
                >
                  Premium
                </div>
              </div>
              <div>
                <div className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
                  {ai.name}
                </div>
                <div className="text-xs mt-1" style={{ color: '#52525b' }}>{ai.model}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
