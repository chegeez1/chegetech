import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const FAKE_EMAILS = [
  'thunder_xyz@tempmail.io',
  'anon_8821@dropmail.me',
  'ghost_user@mailnull.com',
  'priv_4490@guerrillamail.net',
];

const FAKE_SMS = [
  { number: '+1 (555) 302-8847', country: '🇺🇸 US', msg: 'Your OTP is 482910' },
  { number: '+44 7700 900412', country: '🇬🇧 UK', msg: 'Verification code: 739251' },
  { number: '+254 712 334 900', country: '🇰🇪 KE', msg: 'Code: 561807 — expires in 5 min' },
];

export default function Scene3FreeTools() {
  const [emailIdx, setEmailIdx] = useState(0);
  const [smsIdx, setSmsIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setEmailIdx(p => (p + 1) % FAKE_EMAILS.length), 1800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setSmsIdx(p => (p + 1) % FAKE_SMS.length), 2200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setCopied(true), 1400);
    const t2 = setTimeout(() => setCopied(false), 3000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [emailIdx]);

  const sms = FAKE_SMS[smsIdx];

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
        className="text-center mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7 }}
      >
        <span className="text-sm font-mono uppercase tracking-widest" style={{ color: '#22c55e' }}>
          Always Free
        </span>
        <h2 className="text-5xl font-bold mt-2" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
          Free Tools for Everyone
        </h2>
        <p className="mt-3 text-base" style={{ color: '#71717a' }}>
          No account required · Instant access · No ads
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-8 flex-1">
        {/* Temp Mail */}
        <motion.div
          className="rounded-2xl p-8 flex flex-col"
          style={{ background: '#111111', border: '1px solid #22c55e22' }}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#22c55e18' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="#22c55e" strokeWidth="2"/>
                <path d="M2 7l10 7 10-7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
                Temp Mail
              </div>
              <div className="text-sm" style={{ color: '#52525b' }}>Disposable · Private · Instant</div>
            </div>
            <div className="ml-auto text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#22c55e22', color: '#22c55e' }}>
              FREE
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4">
            <div className="text-sm font-mono uppercase tracking-widest mb-1" style={{ color: '#52525b' }}>
              Your temporary address
            </div>
            <motion.div
              key={emailIdx}
              className="rounded-xl px-5 py-4 flex items-center justify-between"
              style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span className="font-mono text-base" style={{ color: '#22c55e' }}>
                {FAKE_EMAILS[emailIdx]}
              </span>
              <motion.div
                className="text-xs px-3 py-1 rounded-lg font-bold ml-3"
                style={{
                  background: copied ? '#22c55e22' : '#1e1e1e',
                  color: copied ? '#22c55e' : '#52525b',
                  fontFamily: 'var(--font-mono)',
                }}
                animate={{ scale: copied ? [1, 1.1, 1] : 1 }}
                transition={{ duration: 0.2 }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </motion.div>
            </motion.div>

            <div className="flex-1 rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
              <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: '#52525b' }}>Inbox</div>
              {[
                { from: 'noreply@google.com', subject: 'Verify your email address', time: '0:12', unread: true },
                { from: 'accounts@twitter.com', subject: 'Confirm your account', time: '2:45', unread: false },
                { from: 'support@discord.com', subject: 'Your verification code', time: '5:30', unread: false },
              ].map((mail, i) => (
                <motion.div
                  key={mail.from}
                  className="flex items-center gap-3 py-2.5 border-b"
                  style={{ borderColor: '#1a1a1a' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                >
                  {mail.unread && <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#22c55e' }} />}
                  {!mail.unread && <div className="w-2 h-2 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: mail.unread ? '#ffffff' : '#71717a' }}>{mail.from}</div>
                    <div className="text-xs truncate" style={{ color: '#52525b' }}>{mail.subject}</div>
                  </div>
                  <div className="text-xs shrink-0" style={{ color: '#3f3f46', fontFamily: 'var(--font-mono)' }}>{mail.time}s</div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Free SMS */}
        <motion.div
          className="rounded-2xl p-8 flex flex-col"
          style={{ background: '#111111', border: '1px solid #7c3aed22' }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.45, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#7c3aed18' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
                Free SMS
              </div>
              <div className="text-sm" style={{ color: '#52525b' }}>Real numbers · Global · OTP ready</div>
            </div>
            <div className="ml-auto text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#7c3aed22', color: '#7c3aed' }}>
              FREE
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4">
            <div className="text-sm font-mono uppercase tracking-widest mb-1" style={{ color: '#52525b' }}>
              Pick a number
            </div>

            <div className="flex flex-col gap-2">
              {FAKE_SMS.map((s, i) => (
                <motion.div
                  key={s.number}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{
                    background: i === smsIdx ? '#7c3aed15' : '#0a0a0a',
                    border: `1px solid ${i === smsIdx ? '#7c3aed55' : '#1e1e1e'}`,
                  }}
                  animate={{ scale: i === smsIdx ? 1.02 : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-lg">{s.country.split(' ')[0]}</span>
                  <div className="flex-1">
                    <div className="text-sm font-mono" style={{ color: i === smsIdx ? '#a78bfa' : '#71717a' }}>{s.number}</div>
                    <div className="text-xs" style={{ color: '#52525b' }}>{s.country.split(' ')[1]} number</div>
                  </div>
                  {i === smsIdx && (
                    <div className="w-2 h-2 rounded-full" style={{ background: '#7c3aed' }} />
                  )}
                </motion.div>
              ))}
            </div>

            <motion.div
              key={smsIdx}
              className="flex-1 rounded-xl p-5"
              style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: '#52525b' }}>
                Latest message
              </div>
              <motion.div
                className="rounded-xl px-4 py-3 inline-block"
                style={{ background: '#7c3aed22', maxWidth: '85%' }}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <div className="text-sm font-mono" style={{ color: '#c4b5fd' }}>{sms.msg}</div>
              </motion.div>
              <div className="mt-2 text-xs" style={{ color: '#3f3f46' }}>Received just now</div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
