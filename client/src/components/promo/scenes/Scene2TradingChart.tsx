import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const CANDLES = [
  { open: 42, close: 58, low: 35, high: 65, bull: true },
  { open: 58, close: 52, low: 48, high: 62, bull: false },
  { open: 52, close: 71, low: 49, high: 76, bull: true },
  { open: 71, close: 65, low: 61, high: 74, bull: false },
  { open: 65, close: 84, low: 62, high: 88, bull: true },
  { open: 84, close: 79, low: 75, high: 87, bull: false },
  { open: 79, close: 92, low: 77, high: 96, bull: true },
  { open: 92, close: 88, low: 83, high: 94, bull: false },
  { open: 88, close: 105, low: 85, high: 109, bull: true },
  { open: 105, close: 98, low: 93, high: 108, bull: false },
  { open: 98, close: 118, low: 95, high: 122, bull: true },
];

const SCALE = 3.5;
const BASE_Y = 200;

function mapY(val: number) {
  return BASE_Y - val * SCALE;
}

const TICKER_LABELS = ['+2.4%', 'KES 22,480', 'BOOM 1000', '↑ 94.2%'];

export default function Scene2TradingChart() {
  const [tickIdx, setTickIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTickIdx(p => (p + 1) % TICKER_LABELS.length), 800);
    return () => clearInterval(t);
  }, []);

  const linePoints = CANDLES.map((c, i) => {
    const x = 60 + i * 60 + 15;
    const y = mapY((c.open + c.close) / 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      style={{ backgroundColor: '#0a0a0a' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="absolute inset-0 opacity-5">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#22c55e" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>
      </div>

      <motion.div
        className="relative z-10 px-16 pt-12 pb-4 flex items-center justify-between"
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.7 }}
      >
        <div>
          <div className="text-sm font-mono uppercase tracking-widest" style={{ color: '#52525b' }}>DERIV · BOOM 1000</div>
          <div className="text-4xl font-bold mt-1" style={{ fontFamily: 'var(--font-display)', color: '#ffffff' }}>
            Live Trading
          </div>
        </div>
        <motion.div
          key={tickIdx}
          className="text-3xl font-bold font-mono"
          style={{ color: '#22c55e' }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {TICKER_LABELS[tickIdx]}
        </motion.div>
      </motion.div>

      <div className="flex-1 relative px-8">
        <svg viewBox="0 0 720 280" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {CANDLES.map((c, i) => {
            const x = 60 + i * 60;
            const bodyTop = mapY(Math.max(c.open, c.close));
            const bodyH = Math.abs(c.open - c.close) * SCALE || 4;
            const color = c.bull ? '#22c55e' : '#ef4444';
            return (
              <motion.g
                key={i}
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: `${x + 15}px ${BASE_Y}px` }}
              >
                <line x1={x + 15} y1={mapY(c.high)} x2={x + 15} y2={mapY(c.low)} stroke={color} strokeWidth="2"/>
                <rect x={x + 2} y={bodyTop} width={26} height={bodyH} fill={color} fillOpacity={0.9} rx={2}/>
              </motion.g>
            );
          })}

          <motion.polyline
            points={linePoints}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            animate={{ strokeDashoffset: 0 }}
            transition={{ delay: 1.2, duration: 1.4, ease: 'easeOut' }}
            opacity="0.5"
          />

          {CANDLES.map((c, i) => {
            if (!c.bull) return null;
            const x = 60 + i * 60;
            return (
              <motion.g key={`win-${i}`} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 + i * 0.08 }}>
                <circle cx={x + 15} cy={mapY(c.high) - 12} r="8" fill="#22c55e" fillOpacity="0.2"/>
                <text x={x + 15} y={mapY(c.high) - 8} textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="bold">✓</text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      <motion.div
        className="px-16 pb-10 flex items-center gap-8"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.7 }}
      >
        {[
          { label: 'Win Rate', value: '74%', color: '#22c55e' },
          { label: 'Trades Today', value: '38', color: '#ffffff' },
          { label: 'P&L', value: '+KES 4,820', color: '#22c55e' },
          { label: 'Strategy', value: 'Martingale', color: '#7c3aed' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className="flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.7 + i * 0.1 }}
          >
            <span className="text-xs uppercase tracking-widest mb-1" style={{ color: '#52525b', fontFamily: 'var(--font-mono)' }}>{stat.label}</span>
            <span className="text-2xl font-bold" style={{ color: stat.color, fontFamily: 'var(--font-display)' }}>{stat.value}</span>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
