import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';

// ─── Luhn helpers ─────────────────────────────────────────────────────────────
function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, '').split('').map(Number);
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function luhnComplete(partial: string): string {
  const base = partial.replace(/\D/g, '');
  for (let d = 0; d <= 9; d++) {
    const candidate = base + d;
    if (luhnCheck(candidate)) return candidate;
  }
  return base + '0';
}

function randomDigits(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
}

const BIN_PROFILES = [
  { bin: '4532', brand: 'Visa',       type: 'Debit',   bank: 'Chase Bank',       country: '🇺🇸 US', color: '#3b82f6' },
  { bin: '5412', brand: 'Mastercard', type: 'Credit',  bank: 'Barclays Bank',    country: '🇬🇧 UK', color: '#f59e0b' },
  { bin: '3782', brand: 'Amex',       type: 'Charge',  bank: 'American Express', country: '🇺🇸 US', color: '#22c55e' },
  { bin: '6011', brand: 'Discover',   type: 'Debit',   bank: 'Discover Bank',    country: '🇺🇸 US', color: '#ec4899' },
  { bin: '4716', brand: 'Visa',       type: 'Prepaid', bank: 'KCB Bank',         country: '🇰🇪 KE', color: '#3b82f6' },
  { bin: '5399', brand: 'Mastercard', type: 'Credit',  bank: 'Equity Bank',      country: '🇰🇪 KE', color: '#f59e0b' },
];

function generateCard(profile: typeof BIN_PROFILES[0]) {
  const len = profile.brand === 'Amex' ? 15 : 16;
  const partial = profile.bin + randomDigits(len - profile.bin.length - 1);
  const full = luhnComplete(partial);
  const year = new Date().getFullYear() + 1 + Math.floor(Math.random() * 4);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const cvv = randomDigits(profile.brand === 'Amex' ? 4 : 3);
  const formatted = full.match(/.{1,4}/g)!.join(' ');
  return { number: formatted, raw: full, exp: `${month}/${year}`, cvv, profile };
}

// ─── CC Generator Panel ───────────────────────────────────────────────────────
function CCGenPanel({ delay }: { delay: number }) {
  const [profileIdx, setProfileIdx] = useState(0);
  const [cards, setCards] = useState<ReturnType<typeof generateCard>[]>([]);
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(() => {
    setGenerating(true);
    const profile = BIN_PROFILES[profileIdx];
    setTimeout(() => {
      setCards(Array.from({ length: 5 }, () => generateCard(profile)));
      setGenerating(false);
    }, 380);
  }, [profileIdx]);

  // Auto-cycle and regenerate
  useEffect(() => {
    generate();
    const t = setInterval(() => {
      setProfileIdx(p => (p + 1) % BIN_PROFILES.length);
    }, 2800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { generate(); }, [profileIdx]);

  const profile = BIN_PROFILES[profileIdx];

  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col"
      style={{ background: '#111111', border: `1px solid ${profile.color}22` }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: `${profile.color}18` }}>💳</div>
        <div>
          <div className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>CC Generator</div>
          <div className="text-xs" style={{ color: '#52525b' }}>Luhn-valid · BIN-accurate · Dev testing</div>
        </div>
        <div className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: `${profile.color}18`, color: profile.color, fontFamily: 'var(--font-mono)' }}>
          {profile.brand}
        </div>
      </div>

      {/* BIN profile tabs */}
      <div className="flex gap-1 mb-3 overflow-hidden">
        {BIN_PROFILES.map((p, i) => (
          <button key={p.bin}
            className="flex-1 text-xs py-1 rounded-lg font-bold transition-all"
            style={{
              background: i === profileIdx ? `${p.color}22` : '#0d0d0d',
              color: i === profileIdx ? p.color : '#3f3f46',
              border: `1px solid ${i === profileIdx ? p.color + '44' : '#1a1a1a'}`,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.55rem',
            }}
          >
            {p.brand}
          </button>
        ))}
      </div>

      {/* BIN info */}
      <div className="rounded-xl px-3 py-2 mb-3 grid grid-cols-3 gap-2" style={{ background: '#0d0d0d', border: `1px solid ${profile.color}22` }}>
        {[
          { l: 'BIN', v: profile.bin + 'xxxxxxxxxx' },
          { l: 'Bank', v: profile.bank },
          { l: 'Country', v: profile.country },
        ].map(row => (
          <div key={row.l}>
            <div className="text-xs" style={{ color: '#3f3f46' }}>{row.l}</div>
            <div className="text-xs font-mono" style={{ color: '#a1a1aa' }}>{row.v}</div>
          </div>
        ))}
      </div>

      {/* Generated cards */}
      <div className="flex flex-col gap-1.5 flex-1">
        <AnimatePresence mode="popLayout">
          {generating ? (
            <motion.div key="spin" className="flex-1 flex items-center justify-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="w-5 h-5 rounded-full border-2"
                style={{ borderTopColor: 'transparent', borderRightColor: profile.color, borderBottomColor: profile.color, borderLeftColor: profile.color }}
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.6, ease: 'linear' }} />
            </motion.div>
          ) : cards.map((card, i) => (
            <motion.div key={`${card.number}-${i}`}
              className="flex items-center gap-3 rounded-xl px-3 py-2"
              style={{ background: '#0d0d0d', border: '1px solid #141414' }}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <span className="font-mono text-xs flex-1" style={{ color: '#a1a1aa', letterSpacing: '0.04em' }}>{card.number}</span>
              <span className="font-mono text-xs" style={{ color: '#52525b' }}>{card.exp}</span>
              <span className="font-mono text-xs" style={{ color: '#52525b' }}>{card.cvv}</span>
              <span className="text-xs w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e', flexShrink: 0 }} title="Luhn valid" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-2 text-xs text-center" style={{ color: '#3f3f46' }}>All numbers pass Luhn algorithm · For dev/testing only</div>
    </motion.div>
  );
}

// ─── CC Checker Panel ─────────────────────────────────────────────────────────
const CHECK_QUEUE = [
  { number: '4532 7153 3790 1241', exp: '09/2026', cvv: '382' },
  { number: '5412 7543 8821 0034', exp: '03/2027', cvv: '541' },
  { number: '4716 2241 9983 0072', exp: '12/2025', cvv: '207' },
  { number: '6011 0009 9013 9424', exp: '06/2028', cvv: '819' },
  { number: '5399 1122 3344 5566', exp: '11/2026', cvv: '334' },
];

type CheckResult = { status: 'valid' | 'invalid' | 'expired'; brand: string; bank: string };

function checkCard(c: typeof CHECK_QUEUE[0]): CheckResult {
  const raw = c.number.replace(/\s/g, '');
  const luhn = luhnCheck(raw);
  const [m, y] = c.exp.split('/');
  const expDate = new Date(2000 + parseInt(y), parseInt(m) - 1);
  const expired = expDate < new Date();
  const brands: Record<string, string> = { '4': 'Visa', '5': 'Mastercard', '6': 'Discover', '3': 'Amex' };
  const brand = brands[raw[0]] ?? 'Unknown';
  const banks = ['Chase', 'Equity Bank', 'KCB', 'Barclays', 'Discover'];
  const bank = banks[parseInt(raw[0]) % banks.length];
  if (expired) return { status: 'expired', brand, bank };
  if (!luhn) return { status: 'invalid', brand, bank };
  return { status: 'valid', brand, bank };
}

function CCCheckerPanel({ delay }: { delay: number }) {
  const [results, setResults] = useState<(CheckResult & typeof CHECK_QUEUE[0] & { checking?: boolean })[]>([]);
  const [qIdx, setQIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      const card = CHECK_QUEUE[qIdx % CHECK_QUEUE.length];
      const placeholder = { ...card, status: 'valid' as const, brand: '...', bank: '...', checking: true };
      setResults(prev => [...prev.slice(-4), placeholder]);
      setTimeout(() => {
        const result = checkCard(card);
        setResults(prev => [...prev.slice(0, -1), { ...card, ...result, checking: false }]);
      }, 600);
      setQIdx(p => p + 1);
    }, 1300);
    return () => clearInterval(t);
  }, [qIdx]);

  const statusStyle = (s: string) => ({
    valid:   { color: '#22c55e', bg: '#22c55e18', label: '✓ VALID' },
    invalid: { color: '#ef4444', bg: '#ef444418', label: '✗ INVALID' },
    expired: { color: '#f59e0b', bg: '#f59e0b18', label: '⚠ EXPIRED' },
  }[s] ?? { color: '#52525b', bg: '#1a1a1a', label: '...' });

  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col"
      style={{ background: '#111111', border: '1px solid #7c3aed22' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: '#7c3aed18' }}>🔍</div>
        <div>
          <div className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>CC Checker</div>
          <div className="text-xs" style={{ color: '#52525b' }}>Luhn · BIN lookup · Expiry check</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
          <span className="text-xs font-mono" style={{ color: '#22c55e' }}>Live</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        {/* Header row */}
        <div className="grid gap-2 px-2 text-xs font-bold uppercase tracking-wider" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr', color: '#3f3f46', fontFamily: 'var(--font-mono)', borderBottom: '1px solid #1a1a1a', paddingBottom: 6 }}>
          <span>Number</span><span>Exp</span><span>Brand</span><span>Status</span>
        </div>

        <AnimatePresence mode="popLayout">
          {results.map((r, i) => {
            const st = statusStyle(r.status);
            return (
              <motion.div key={`${r.number}-${i}`}
                className="grid gap-2 px-2 py-2 rounded-xl items-center"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr', background: '#0d0d0d' }}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.3 }}
              >
                <span className="font-mono text-xs" style={{ color: '#71717a' }}>{r.number}</span>
                <span className="font-mono text-xs" style={{ color: '#52525b' }}>{r.exp}</span>
                <span className="text-xs" style={{ color: '#a1a1aa' }}>{r.brand}</span>
                {r.checking ? (
                  <motion.div className="w-4 h-4 rounded-full border-2"
                    style={{ borderTopColor: 'transparent', borderRightColor: '#7c3aed', borderBottomColor: '#7c3aed', borderLeftColor: '#7c3aed' }}
                    animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.5, ease: 'linear' }} />
                ) : (
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: st.bg, color: st.color, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>
                    {st.label}
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="mt-2 text-xs text-center" style={{ color: '#3f3f46' }}>Luhn algorithm · BIN database · Format validation</div>
    </motion.div>
  );
}

// ─── BIN database ─────────────────────────────────────────────────────────────
const BIN_DB = [
  { bin: '453275', brand: 'Visa',       scheme: 'VISA',       type: 'Debit',   tier: 'Classic',  bank: 'JPMorgan Chase',    country: '🇺🇸', cc: 'US', sec: true  },
  { bin: '541274', brand: 'Mastercard', scheme: 'MC',         type: 'Credit',  tier: 'Gold',     bank: 'Barclays Bank',     country: '🇬🇧', cc: 'GB', sec: true  },
  { bin: '378282', brand: 'Amex',       scheme: 'AMEX',       type: 'Charge',  tier: 'Platinum', bank: 'American Express',  country: '🇺🇸', cc: 'US', sec: false },
  { bin: '601100', brand: 'Discover',   scheme: 'DISC',       type: 'Debit',   tier: 'Classic',  bank: 'Discover Bank',     country: '🇺🇸', cc: 'US', sec: true  },
  { bin: '471622', brand: 'Visa',       scheme: 'VISA',       type: 'Prepaid', tier: 'Classic',  bank: 'KCB Bank Kenya',    country: '🇰🇪', cc: 'KE', sec: false },
  { bin: '539941', brand: 'Mastercard', scheme: 'MC',         type: 'Credit',  tier: 'Gold',     bank: 'Equity Bank',       country: '🇰🇪', cc: 'KE', sec: true  },
  { bin: '676338', brand: 'Maestro',    scheme: 'MAESTRO',    type: 'Debit',   tier: 'Standard', bank: 'HSBC Holdings',     country: '🇬🇧', cc: 'GB', sec: true  },
  { bin: '400022', brand: 'Visa',       scheme: 'VISA',       type: 'Credit',  tier: 'Infinite', bank: 'Citibank N.A.',     country: '🇺🇸', cc: 'US', sec: true  },
  { bin: '558060', brand: 'Mastercard', scheme: 'MC',         type: 'Debit',   tier: 'Black',    bank: 'Standard Chartered',country: '🇿🇦', cc: 'ZA', sec: true  },
  { bin: '491596', brand: 'Visa',       scheme: 'VISA',       type: 'Credit',  tier: 'Signature',bank: 'Bank of America',   country: '🇺🇸', cc: 'US', sec: true  },
];

const SCHEME_COLORS: Record<string, string> = {
  VISA: '#3b82f6', MC: '#f59e0b', AMEX: '#22c55e', DISC: '#ec4899',
  MAESTRO: '#a78bfa', UNKNOWN: '#52525b',
};

// ─── BIN Checker Panel ────────────────────────────────────────────────────────
function BINCheckerPanel({ delay }: { delay: number }) {
  const [qIdx, setQIdx] = useState(0);
  const [current, setCurrent] = useState<typeof BIN_DB[0] | null>(null);
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<'typing' | 'result'>('typing');

  useEffect(() => {
    const bin = BIN_DB[qIdx % BIN_DB.length];
    setTyped('');
    setPhase('typing');
    setCurrent(null);

    let i = 0;
    const ti = setInterval(() => {
      i++;
      setTyped(bin.bin.slice(0, i));
      if (i >= bin.bin.length) {
        clearInterval(ti);
        setTimeout(() => { setCurrent(bin); setPhase('result'); }, 280);
        setTimeout(() => setQIdx(p => p + 1), 2400);
      }
    }, 90);

    return () => clearInterval(ti);
  }, [qIdx]);

  const schemeColor = current ? (SCHEME_COLORS[current.scheme] ?? SCHEME_COLORS.UNKNOWN) : '#52525b';

  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col"
      style={{ background: '#111111', border: `1px solid ${schemeColor}22` }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: '#ec489918' }}>🏦</div>
        <div>
          <div className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>BIN Checker</div>
          <div className="text-xs" style={{ color: '#52525b' }}>Bank · Country · Type · Tier</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: '#ec4899' }}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
          <span className="text-xs font-mono" style={{ color: '#ec4899' }}>DB</span>
        </div>
      </div>

      {/* BIN input */}
      <div className="rounded-xl px-4 py-3 mb-3" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: '#3f3f46' }}>BIN / IIN (first 6 digits)</div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-mono font-bold tracking-widest" style={{ color: '#ffffff', letterSpacing: '0.15em' }}>
            {typed.padEnd(6, '·')}
          </span>
          {phase === 'typing' && <motion.div className="w-0.5 h-6 rounded-full" style={{ background: '#ec4899' }}
            animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.6, repeat: Infinity }} />}
          {phase === 'result' && <motion.div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: '#22c55e22', color: '#22c55e' }}
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>✓</motion.div>}
        </div>
      </div>

      {/* Result panel */}
      <AnimatePresence mode="wait">
        {phase === 'result' && current && (
          <motion.div key={current.bin}
            className="flex flex-col gap-2 flex-1"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* Scheme badge */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: `${schemeColor}12`, border: `1px solid ${schemeColor}33` }}>
              <span className="text-lg font-bold font-mono" style={{ color: schemeColor }}>{current.scheme}</span>
              <span className="text-sm font-bold" style={{ color: '#ffffff', fontFamily: 'var(--font-display)' }}>{current.brand}</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: `${schemeColor}22`, color: schemeColor, fontFamily: 'var(--font-mono)' }}>
                {current.tier}
              </span>
            </div>

            {/* Info rows */}
            {[
              { label: 'Bank',    value: current.bank,    color: '#a1a1aa' },
              { label: 'Country', value: `${current.country} ${current.cc}`, color: '#a1a1aa' },
              { label: 'Type',    value: current.type,    color: '#a1a1aa' },
            ].map((row, i) => (
              <motion.div key={row.label}
                className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{ background: '#0d0d0d', border: '1px solid #141414' }}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#3f3f46' }}>{row.label}</span>
                <span className="text-xs font-medium" style={{ color: row.color }}>{row.value}</span>
              </motion.div>
            ))}

            {/* 3D Secure badge */}
            <motion.div
              className="flex items-center gap-2 rounded-xl px-3 py-2 mt-auto"
              style={{
                background: current.sec ? '#22c55e10' : '#ef444410',
                border: `1px solid ${current.sec ? '#22c55e33' : '#ef444433'}`,
              }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
            >
              <span className="text-sm">{current.sec ? '🔒' : '⚠️'}</span>
              <span className="text-xs" style={{ color: current.sec ? '#22c55e' : '#ef4444' }}>
                3D Secure {current.sec ? 'Supported' : 'Not Supported'}
              </span>
            </motion.div>
          </motion.div>
        )}
        {phase === 'typing' && (
          <motion.div key="idle" className="flex-1 flex flex-col items-center justify-center gap-2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="text-3xl">🔍</div>
            <div className="text-xs" style={{ color: '#3f3f46' }}>Looking up BIN database…</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Scene ───────────────────────────────────────────────────────────────
export default function SceneCardTools() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col px-8 py-7"
      style={{ backgroundColor: '#0a0a0a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div
        className="mb-4"
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.7 }}
      >
        <span className="text-sm font-mono uppercase tracking-widest" style={{ color: '#7c3aed' }}>Dev Tools</span>
        <h2 className="text-4xl font-bold mt-1" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
          CC Generator · CC Checker · BIN Lookup
        </h2>
        <p className="mt-1 text-sm" style={{ color: '#52525b' }}>
          Generate Luhn-valid test cards · Validate any card · Full BIN intelligence — bank, country, tier, 3D Secure
        </p>
      </motion.div>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-5 flex-1 min-h-0">
        <CCGenPanel delay={0.3} />
        <CCCheckerPanel delay={0.42} />
        <BINCheckerPanel delay={0.54} />
      </div>
    </motion.div>
  );
}
