import { useState, useEffect, useCallback } from "react";
import { Phone, RefreshCw, MessageSquare, Clock, Copy, Check, ChevronLeft, Signal } from "lucide-react";

interface FreeNumber {
  number: string;
  country: string;
  digits: string;
  source: string;
}

interface SmsMessage {
  sender: string;
  time: string;
  body: string;
}

const SOURCE_LABEL: Record<string, string> = {
  'sms-online': 'Live SMS',
  'rsoi': 'Sweden/EU',
  'rscc': 'US/UK',
};

export default function TempNumbersPage() {
  const [numbers, setNumbers] = useState<FreeNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<FreeNumber | null>(null);
  const [sms, setSms] = useState<SmsMessage[]>([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/free-numbers");
      const data = await res.json();
      if (data.success) { setNumbers(data.numbers); setTotal(data.total || data.numbers.length); }
    } catch {}
    setLoading(false);
  }, []);

  const fetchSms = useCallback(async (num: FreeNumber) => {
    setSmsLoading(true);
    setSms([]);
    try {
      const res = await fetch(`/api/free-numbers/${num.digits}/sms?source=${num.source}`);
      const data = await res.json();
      if (data.success) { setSms(data.messages); setLastRefresh(new Date()); }
    } catch {}
    setSmsLoading(false);
  }, []);

  useEffect(() => { fetchNumbers(); }, [fetchNumbers]);

  useEffect(() => {
    if (!selected) return;
    fetchSms(selected);
    const t = setInterval(() => fetchSms(selected), 20000);
    return () => clearInterval(t);
  }, [selected, fetchSms]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = filter === "all" ? numbers : numbers.filter(n => n.source === filter);

  if (selected) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setSelected(null); setSms([]); }} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold font-mono tracking-wide">{selected.number}</span>
                <button onClick={() => copy(selected.number)} className="p-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors">
                  {copied === selected.number ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/50" />}
                </button>
              </div>
              <p className="text-sm text-white/40 mt-0.5">{selected.country} · {SOURCE_LABEL[selected.source] || selected.source}</p>
            </div>
            <button onClick={() => fetchSms(selected)} disabled={smsLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${smsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {lastRefresh && (
            <div className="flex items-center gap-1.5 text-xs text-white/30 mb-4">
              <Clock className="w-3 h-3" />
              Updated {lastRefresh.toLocaleTimeString()} · auto-refreshes every 20s
            </div>
          )}

          {smsLoading && sms.length === 0 ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-4 animate-pulse">
                  <div className="h-3 w-24 bg-white/10 rounded mb-2" />
                  <div className="h-4 w-full bg-white/10 rounded mb-1.5" />
                  <div className="h-4 w-3/4 bg-white/10 rounded" />
                </div>
              ))}
            </div>
          ) : sms.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No messages yet</p>
              <p className="text-xs mt-1">Messages will appear here as they arrive</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sms.map((msg, i) => (
                <div key={i} className="bg-white/5 border border-white/8 rounded-xl p-4 hover:bg-white/8 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-medium text-sm text-white/90 font-mono">{msg.sender}</span>
                    <span className="text-xs text-white/30 whitespace-nowrap shrink-0">{msg.time}</span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed break-words">{msg.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <Signal className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Free Temp Numbers</h1>
              {total > 0 && <p className="text-xs text-white/40">{total} numbers available</p>}
            </div>
          </div>
          <p className="text-white/40 text-sm">Receive SMS online — no registration required. Pick a number and use it for verifications.</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { key: "all", label: "All" },
            { key: "sms-online", label: "Live SMS" },
            { key: "rsoi", label: "Sweden/EU" },
            { key: "rscc", label: "US/UK" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border ${
                filter === tab.key
                  ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300"
                  : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button onClick={fetchNumbers} disabled={loading} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-sm hover:bg-white/10 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-5 animate-pulse">
                <div className="h-5 w-32 bg-white/10 rounded mb-2" />
                <div className="h-3 w-20 bg-white/10 rounded mb-4" />
                <div className="h-9 w-full bg-white/10 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Phone className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No numbers available right now</p>
            <button onClick={fetchNumbers} className="mt-3 text-cyan-400 text-sm hover:underline">Try again</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((n) => (
              <div key={n.digits} className="bg-white/5 border border-white/8 rounded-2xl p-5 hover:bg-white/8 hover:border-cyan-500/30 transition-all cursor-pointer group" onClick={() => setSelected(n)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold font-mono text-base text-white group-hover:text-cyan-300 transition-colors truncate">{n.number}</p>
                    <p className="text-xs text-white/40 mt-0.5">{n.country}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-xs text-green-400/80">Live</span>
                    </div>
                    <span className="text-xs text-white/25">{SOURCE_LABEL[n.source] || n.source}</span>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); copy(n.number); }} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-3 transition-colors">
                  {copied === n.number ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copied === n.number ? "Copied!" : "Copy number"}
                </button>
                <button className="w-full py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-sm font-medium hover:bg-cyan-500/25 transition-colors flex items-center justify-center gap-2" onClick={() => setSelected(n)}>
                  <MessageSquare className="w-4 h-4" />
                  View SMS
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-white/20 mt-8">Numbers aggregated from multiple public sources</p>
      </div>
    </div>
  );
}
