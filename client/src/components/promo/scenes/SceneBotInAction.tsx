import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useCountUp } from '../../../hooks/useCountUp';

const BASE_PRICE = 1842.5;
const TICK_MS = 140;
const SIGNAL_INTERVAL_MS = 2400;

interface Trade {
  id: number;
  type: 'BUY' | 'SELL';
  price: number;
  profit: number;
  time: string;
}

interface Tick {
  price: number;
  delta: number;
}

interface Signal {
  id: number;
  type: 'BUY' | 'SELL';
  price: number;
}

function useSimulatedBot() {
  const [ticks, setTicks] = useState<Tick[]>(() =>
    Array.from({ length: 40 }, (_, i) => ({ price: BASE_PRICE + (Math.random() - 0.49) * 8, delta: 0 }))
  );
  const [currentPrice, setCurrentPrice] = useState(BASE_PRICE);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pnl, setPnl] = useState(0);
  const priceRef = useRef(BASE_PRICE);
  const tradeIdRef = useRef(0);

  useEffect(() => {
    const tickTimer = setInterval(() => {
      const delta = (Math.random() - 0.485) * 1.8;
      priceRef.current = Math.max(1820, Math.min(1870, priceRef.current + delta));
      const price = parseFloat(priceRef.current.toFixed(2));
      setCurrentPrice(price);
      setTicks(prev => [...prev.slice(-39), { price, delta }]);
    }, TICK_MS);

    const sigTimer = setInterval(() => {
      const type = Math.random() > 0.45 ? 'BUY' : 'SELL';
      const price = parseFloat(priceRef.current.toFixed(2));
      const id = ++tradeIdRef.current;
      setSignal({ id, type, price });

      const profit = type === 'BUY'
        ? parseFloat((Math.random() * 28 + 5).toFixed(2))
        : parseFloat((-(Math.random() * 10 + 2)).toFixed(2));

      const now = new Date();
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      setTimeout(() => {
        setPnl(p => parseFloat((p + profit).toFixed(2)));
        setTrades(prev => [{ id, type, price, profit, time }, ...prev.slice(0, 6)]);
        setSignal(null);
      }, 900);
    }, SIGNAL_INTERVAL_MS);

    return () => { clearInterval(tickTimer); clearInterval(sigTimer); };
  }, []);

  return { ticks, currentPrice, signal, trades, pnl };
}

function MiniChart({ ticks }: { ticks: Tick[] }) {
  const w = 480, h = 90;
  const prices = ticks.map(t => t.price);
  const min = Math.min(...prices) - 0.5;
  const max = Math.max(...prices) + 0.5;
  const range = max - min || 1;

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const last = prices[prices.length - 1];
  const prev = prices[prices.length - 2] ?? last;
  const rising = last >= prev;

  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={rising ? '#22c55e' : '#ef4444'} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={rising ? '#22c55e' : '#ef4444'} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#chartGrad)"/>
      <polyline points={points} fill="none" stroke={rising ? '#22c55e' : '#ef4444'} strokeWidth="2"/>
    </svg>
  );
}

function RSIBar({ value }: { value: number }) {
  const color = value > 70 ? '#ef4444' : value < 30 ? '#22c55e' : '#7c3aed';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: '#52525b', fontFamily: 'var(--font-mono)' }}>
        <span>RSI(14)</span>
        <span style={{ color }}>{value.toFixed(1)}</span>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 6, background: '#1a1a1a' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
}

export default function SceneBotInAction() {
  const { ticks, currentPrice, signal, trades, pnl } = useSimulatedBot();
  const [rsi, setRsi] = useState(52);
  const [macd, setMacd] = useState(0.12);

  useEffect(() => {
    const t = setInterval(() => {
      setRsi(r => parseFloat(Math.max(25, Math.min(78, r + (Math.random() - 0.48) * 4)).toFixed(1)));
      setMacd(m => parseFloat((m + (Math.random() - 0.48) * 0.05).toFixed(3)));
    }, 600);
    return () => clearInterval(t);
  }, []);

  const pnlDisplay = useCountUp(Math.abs(Math.floor(pnl * 100)), 400, 0);
  const winRate = useCountUp(74, 1200, 600);
  const tradesCount = useCountUp(38 + trades.length, 600, 0);

  const priceUp = ticks.length > 1 && ticks[ticks.length - 1].price >= ticks[ticks.length - 2].price;

  return (
    <motion.div
      className="absolute inset-0 flex"
      style={{ backgroundColor: '#0a0a0a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Left panel: main chart + indicators */}
      <div className="flex flex-col flex-1 min-w-0 px-10 pt-10 pb-6 gap-4">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <div>
            <div className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: '#52525b' }}>
              DERIV · BOOM 1000 · LIVE
            </div>
            <div className="text-4xl font-bold" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
              ChegeBot <span style={{ color: '#22c55e' }}>Pro</span> — In Action
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: '#ef444418', border: '1px solid #ef444433' }}>
            <motion.div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: '#ef4444' }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="text-sm font-bold" style={{ color: '#ef4444', fontFamily: 'var(--font-mono)' }}>LIVE</span>
          </div>
        </motion.div>

        {/* Price ticker */}
        <motion.div
          className="flex items-baseline gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <motion.span
            key={currentPrice}
            className="text-6xl font-bold font-mono"
            style={{ color: priceUp ? '#22c55e' : '#ef4444', fontFamily: 'var(--font-mono)' }}
            initial={{ y: priceUp ? -8 : 8, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            {currentPrice.toFixed(2)}
          </motion.span>
          <motion.span
            key={`d${currentPrice}`}
            className="text-2xl font-mono font-bold"
            style={{ color: priceUp ? '#22c55e' : '#ef4444' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            {priceUp ? '▲' : '▼'} {Math.abs(ticks[ticks.length - 1]?.delta ?? 0).toFixed(3)}
          </motion.span>
          <span className="text-lg" style={{ color: '#3f3f46', fontFamily: 'var(--font-mono)' }}>USD</span>
        </motion.div>

        {/* Mini chart */}
        <motion.div
          className="rounded-2xl p-4 flex-1 flex flex-col gap-3"
          style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', minHeight: 0 }}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45, duration: 0.7 }}
        >
          <div className="flex-1 min-h-0">
            <MiniChart ticks={ticks} />
          </div>

          {/* Indicator bars */}
          <div className="grid grid-cols-2 gap-4 pt-2" style={{ borderTop: '1px solid #1a1a1a' }}>
            <RSIBar value={rsi} />
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: '#52525b', fontFamily: 'var(--font-mono)' }}>
                <span>MACD</span>
                <span style={{ color: macd >= 0 ? '#22c55e' : '#ef4444' }}>{macd >= 0 ? '+' : ''}{macd.toFixed(3)}</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 6, background: '#1a1a1a' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: macd >= 0 ? '#22c55e' : '#ef4444', marginLeft: '50%', transformOrigin: 'left' }}
                  animate={{ width: `${Math.min(Math.abs(macd) * 200, 50)}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="grid grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          {[
            { label: 'Win Rate', value: `${winRate}%`, color: '#22c55e' },
            { label: 'Trades', value: `${tradesCount}`, color: '#ffffff' },
            {
              label: 'Session P&L',
              value: `${pnl >= 0 ? '+' : '-'}KES ${(Math.abs(pnl)).toFixed(2)}`,
              color: pnl >= 0 ? '#22c55e' : '#ef4444',
            },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: '#111111', border: '1px solid #1e1e1e' }}>
              <div className="text-xs font-mono uppercase tracking-widest mb-1.5" style={{ color: '#3f3f46' }}>{s.label}</div>
              <div className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Right panel: signals + trade log */}
      <div
        className="flex flex-col w-72 shrink-0 py-10 pr-10 pl-4 gap-4"
        style={{ borderLeft: '1px solid #141414' }}
      >
        {/* Strategy */}
        <motion.div
          className="rounded-xl p-4"
          style={{ background: '#7c3aed18', border: '1px solid #7c3aed33' }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: '#7c3aed' }}>Active Strategy</div>
          <div className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>Martingale</div>
          <div className="text-xs mt-1" style={{ color: '#52525b' }}>RSI + MACD consensus</div>
        </motion.div>

        {/* Live signal */}
        <div className="relative h-16 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {signal ? (
              <motion.div
                key={signal.id}
                className="w-full rounded-xl px-5 py-3 flex items-center justify-between"
                style={{
                  background: signal.type === 'BUY' ? '#22c55e18' : '#ef444418',
                  border: `2px solid ${signal.type === 'BUY' ? '#22c55e' : '#ef4444'}66`,
                }}
                initial={{ opacity: 0, scale: 0.85, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ duration: 0.25 }}
              >
                <div>
                  <div className="text-xs font-mono" style={{ color: '#52525b' }}>SIGNAL</div>
                  <div
                    className="text-xl font-bold"
                    style={{ color: signal.type === 'BUY' ? '#22c55e' : '#ef4444', fontFamily: 'var(--font-display)' }}
                  >
                    {signal.type === 'BUY' ? '▲ BUY' : '▼ SELL'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono" style={{ color: '#52525b' }}>@ PRICE</div>
                  <div className="text-sm font-mono font-bold" style={{ color: '#ffffff' }}>{signal.price.toFixed(2)}</div>
                </div>
                <motion.div
                  className="absolute inset-0 rounded-xl"
                  style={{ border: `2px solid ${signal.type === 'BUY' ? '#22c55e' : '#ef4444'}` }}
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                className="w-full rounded-xl px-5 py-3 flex items-center gap-3"
                style={{ background: '#111111', border: '1px solid #1e1e1e' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  className="w-2 h-2 rounded-full"
                  style={{ background: '#22c55e' }}
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-sm font-mono" style={{ color: '#3f3f46' }}>Scanning market…</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Trade log */}
        <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
          <div className="text-xs font-mono uppercase tracking-widest" style={{ color: '#3f3f46' }}>Trade Log</div>
          <div className="flex flex-col gap-2 overflow-hidden">
            <AnimatePresence initial={false}>
              {trades.map(trade => (
                <motion.div
                  key={trade.id}
                  className="rounded-xl px-3 py-2.5 flex items-center justify-between shrink-0"
                  style={{
                    background: '#111111',
                    border: `1px solid ${trade.profit > 0 ? '#22c55e22' : '#ef444422'}`,
                  }}
                  initial={{ opacity: 0, x: 20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{
                        background: trade.type === 'BUY' ? '#22c55e22' : '#ef444422',
                        color: trade.type === 'BUY' ? '#22c55e' : '#ef4444',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {trade.type}
                    </div>
                    <span className="text-xs font-mono" style={{ color: '#52525b' }}>{trade.time}</span>
                  </div>
                  <div
                    className="text-xs font-bold font-mono"
                    style={{ color: trade.profit > 0 ? '#22c55e' : '#ef4444' }}
                  >
                    {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {trades.length === 0 && (
              <div className="text-xs text-center py-6" style={{ color: '#27272a' }}>Awaiting first trade…</div>
            )}
          </div>
        </div>

        {/* WebSocket ticks */}
        <motion.div
          className="rounded-xl p-3"
          style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: '#3f3f46' }}>WS Ticks</div>
          <div className="flex flex-wrap gap-1">
            {ticks.slice(-14).map((t, i) => (
              <motion.span
                key={i}
                className="text-xs font-mono px-1 rounded"
                style={{
                  color: t.delta >= 0 ? '#22c55e' : '#ef4444',
                  background: t.delta >= 0 ? '#22c55e0a' : '#ef44440a',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {t.price.toFixed(1)}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
