import { useState, useEffect } from "react";
import { Zap, X, Clock } from "lucide-react";

interface FlashSale {
  id: number;
  label: string;
  planId: string | null;
  discountPercent: number;
  endsAt: string;
}

function useCountdown(endsAt: string) {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, new Date(endsAt).getTime() - Date.now()));
  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft(t => Math.max(0, new Date(endsAt).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  const h = Math.floor(timeLeft / 3600000);
  const m = Math.floor((timeLeft % 3600000) / 60000);
  const s = Math.floor((timeLeft % 60000) / 1000);
  return { h, m, s, expired: timeLeft <= 0 };
}

function SaleItem({ sale, onClose }: { sale: FlashSale; onClose: () => void }) {
  const { h, m, s, expired } = useCountdown(sale.endsAt);
  if (expired) return null;
  const fmt = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="relative flex items-center justify-between gap-3 bg-gradient-to-r from-orange-500/20 via-red-500/20 to-pink-500/20 border border-orange-500/30 rounded-2xl px-4 py-3 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent pointer-events-none" />
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
          <Zap className="w-4 h-4 text-orange-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">
            ⚡ {sale.discountPercent}% OFF — {sale.label}
          </p>
          <p className="text-xs text-white/50">Flash sale · limited time only</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 bg-black/30 rounded-lg px-2 py-1 border border-white/10">
          <Clock className="w-3 h-3 text-orange-400" />
          <span className="text-xs font-mono font-bold text-orange-300">
            {fmt(h)}:{fmt(m)}:{fmt(s)}
          </span>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function FlashSaleBanner() {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch("/api/flash-sales")
      .then(r => r.json())
      .then(d => { if (d.success) setSales(d.sales); })
      .catch(() => {});
  }, []);

  const visible = sales.filter(s => !dismissed.has(s.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map(sale => (
        <SaleItem
          key={sale.id}
          sale={sale}
          onClose={() => setDismissed(prev => new Set([...prev, sale.id]))}
        />
      ))}
    </div>
  );
}
