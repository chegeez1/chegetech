import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from "recharts";
import {
  ArrowDownRight, ArrowUpRight, Bell, Check, Copy, ExternalLink,
  LineChart, LogOut, Package, Percent, Save,
  Search, Settings, ShoppingBag, TrendingUp, Users, Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Tab = "overview" | "pricing" | "orders" | "wallet" | "referrals" | "profile";

async function resellerFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || "Request failed");
  return data;
}

function money(value: number) {
  return `KES ${(value || 0).toLocaleString()}`;
}

function flattenPlans(data: any) {
  const rows: any[] = [];
  for (const [categoryKey, cat] of Object.entries(data?.categories || {}) as any[]) {
    for (const [planId, plan] of Object.entries((cat as any).plans || {}) as any[]) {
      rows.push({ ...plan, planId, category: (cat as any).category, categoryKey });
    }
  }
  return rows;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-400/15 text-emerald-300",
    completed: "bg-emerald-400/15 text-emerald-300",
    pending: "bg-amber-400/15 text-amber-300",
    approved: "bg-emerald-400/15 text-emerald-300",
    processing: "bg-blue-400/15 text-blue-300",
    rejected: "bg-red-400/15 text-red-300",
    failed: "bg-red-400/15 text-red-300",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] || "bg-white/10 text-white/60"}`}>
      {status}
    </span>
  );
}

// Build chart data from orders
function buildChartData(orders: any[]) {
  const byDate: Record<string, { date: string; earnings: number; orders: number }> = {};
  const now = new Date();
  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    byDate[key] = { date: key, earnings: 0, orders: 0 };
  }
  (orders || []).forEach((o: any) => {
    if (!o.createdAt) return;
    const d = new Date(o.createdAt);
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (byDate[key]) {
      byDate[key].orders += 1;
      byDate[key].earnings += o.margin || 0;
    }
  });
  return Object.values(byDate);
}

const TIERS = [
  { name: "Silver", min: 5, bonus: "×1.25", color: "text-slate-300", ring: "border-slate-400/30 bg-slate-400/5", icon: "🥈" },
  { name: "Gold", min: 15, bonus: "×1.5", color: "text-amber-300", ring: "border-amber-400/30 bg-amber-400/5", icon: "🥇" },
  { name: "Platinum", min: 30, bonus: "×2.0", color: "text-cyan-300", ring: "border-cyan-400/30 bg-cyan-400/5", icon: "💎" },
];

function currentTier(referralCount: number) {
  if (referralCount >= 30) return TIERS[2];
  if (referralCount >= 15) return TIERS[1];
  if (referralCount >= 5) return TIERS[0];
  return null;
}

function nextTier(referralCount: number) {
  if (referralCount >= 30) return null;
  if (referralCount >= 15) return TIERS[2];
  if (referralCount >= 5) return TIERS[1];
  return TIERS[0];
}

export default function ResellerDashboard() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const me = useQuery<any>({ queryKey: ["/api/reseller/me"], queryFn: () => resellerFetch("/api/reseller/me"), retry: false });
  const dashboard = useQuery<any>({ queryKey: ["/api/reseller/dashboard"], queryFn: () => resellerFetch("/api/reseller/dashboard"), enabled: !!me.data });
  const plans = useQuery<any>({ queryKey: ["/api/plans"], enabled: !!me.data });
  const prices = useQuery<any>({ queryKey: ["/api/reseller/prices"], queryFn: () => resellerFetch("/api/reseller/prices"), enabled: !!me.data });
  const orders = useQuery<any>({ queryKey: ["/api/reseller/orders"], queryFn: () => resellerFetch("/api/reseller/orders"), enabled: !!me.data });
  const wallet = useQuery<any>({ queryKey: ["/api/reseller/wallet"], queryFn: () => resellerFetch("/api/reseller/wallet"), enabled: !!me.data });
  const withdrawals = useQuery<any>({ queryKey: ["/api/reseller/withdrawals"], queryFn: () => resellerFetch("/api/reseller/withdrawals"), enabled: !!me.data });
  const referrals = useQuery<any>({ queryKey: ["/api/reseller/referrals"], queryFn: () => resellerFetch("/api/reseller/referrals"), enabled: !!me.data });

  const reseller = me.data?.reseller;
  const storeUrl = reseller?.slug ? `${window.location.origin}/r/${reseller.slug}` : "";
  const referralLink = reseller?.slug ? `${window.location.origin}/reseller?ref=${reseller.slug}` : "";

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await resellerFetch("/api/reseller/notifications");
      setNotifications(data.notifications || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (me.data) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [me.data, fetchNotifications]);

  // Close notifications on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    try {
      await resellerFetch("/api/reseller/notifications/read", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  }

  useEffect(() => { if (me.isError) setLocation("/reseller"); }, [me.isError, setLocation]);

  async function logout() {
    await resellerFetch("/api/reseller/logout", { method: "POST" }).catch(() => {});
    setLocation("/reseller");
  }

  const chartData = useMemo(() => buildChartData(orders.data?.orders || []), [orders.data]);

  const navItems: Array<{ id: Tab; icon: any; label: string }> = [
    { id: "overview", icon: LineChart, label: "Overview" },
    { id: "pricing", icon: Package, label: "Pricing" },
    { id: "orders", icon: ShoppingBag, label: "Orders" },
    { id: "wallet", icon: Wallet, label: "Wallet" },
    { id: "referrals", icon: Users, label: "Referrals" },
    { id: "profile", icon: Settings, label: "Profile" },
  ];

  if (me.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          <p className="text-sm text-white/50">Loading your portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-sm sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Reseller Portal</p>
            <h1 className="text-xl font-black leading-tight">{reseller?.storeName || reseller?.businessName || reseller?.name}</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs && unreadCount > 0) markAllRead(); }}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-white/10 bg-gray-950 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <p className="text-sm font-bold">Notifications</p>
                    {notifications.length > 0 && (
                      <button onClick={markAllRead} className="text-xs text-white/40 hover:text-white">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="py-6 text-center text-sm text-white/35">No notifications yet</p>
                    ) : (
                      notifications.slice(0, 10).map((n: any) => (
                        <div key={n.id} className={`border-b border-white/5 px-4 py-3 ${!n.read ? "bg-emerald-400/5" : ""}`}>
                          <p className="text-sm font-semibold">{n.title}</p>
                          <p className="text-xs text-white/45">{n.body}</p>
                          <p className="mt-1 text-[10px] text-white/25">{n.createdAt}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button variant="outline" className="hidden border-white/10 text-white sm:flex" onClick={() => navigator.clipboard.writeText(storeUrl).then(() => toast({ title: "Store link copied!" }))}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Copy link
            </Button>
            <Button className="hidden bg-emerald-500 text-gray-950 hover:bg-emerald-400 sm:flex" onClick={() => window.open(storeUrl, "_blank")}>
              <ExternalLink className="mr-2 h-3.5 w-3.5" /> Open store
            </Button>
            <Button variant="outline" className="border-white/10 text-white" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar nav */}
        <nav className="h-fit rounded-xl border border-white/10 bg-white/[0.03] p-2">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                tab === id ? "bg-white text-gray-950" : "text-white/55 hover:bg-white/8 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}

          <div className="mt-4 border-t border-white/8 pt-4 px-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Store link</p>
            <div className="flex items-center gap-1">
              <p className="truncate text-xs text-white/45 font-mono">/r/{reseller?.slug}</p>
              <button onClick={() => navigator.clipboard.writeText(storeUrl).then(() => toast({ title: "Copied!" }))} className="text-white/30 hover:text-white transition">
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        </nav>

        {/* Content */}
        <section>
          {tab === "overview" && (
            <Overview
              data={dashboard.data}
              wallet={wallet.data}
              chartData={chartData}
              orders={orders.data?.orders || []}
            />
          )}
          {tab === "pricing" && (
            <Pricing
              plans={plans.data}
              prices={prices.data?.prices || []}
              onSaved={() => { qc.invalidateQueries({ queryKey: ["/api/reseller/prices"] }); toast({ title: "Prices saved ✅" }); }}
            />
          )}
          {tab === "orders" && <Orders orders={orders.data?.orders || []} />}
          {tab === "wallet" && (
            <WalletTab
              wallet={wallet.data}
              withdrawals={withdrawals.data?.withdrawals || []}
              onDone={() => { qc.invalidateQueries({ queryKey: ["/api/reseller/wallet"] }); qc.invalidateQueries({ queryKey: ["/api/reseller/withdrawals"] }); }}
            />
          )}
          {tab === "referrals" && (
            <Referrals referralLink={referralLink} referrals={referrals.data} />
          )}
          {tab === "profile" && (
            <Profile reseller={reseller} onSaved={() => qc.invalidateQueries({ queryKey: ["/api/reseller/me"] })} />
          )}
        </section>
      </main>
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function Overview({ data, wallet, chartData, orders }: { data: any; wallet: any; chartData: any[]; orders: any[] }) {
  const totalOrders = data?.totalOrders ?? 0;
  const totalEarnings = data?.totalEarnings ?? 0;
  const balance = wallet?.balance ?? data?.walletBalance ?? 0;
  const recentOrders = orders.slice(0, 5);

  const todayEarnings = chartData[chartData.length - 1]?.earnings ?? 0;
  const yesterdayEarnings = chartData[chartData.length - 2]?.earnings ?? 0;
  const earningsTrend = yesterdayEarnings > 0 ? ((todayEarnings - yesterdayEarnings) / yesterdayEarnings) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Orders",
            value: totalOrders,
            icon: ShoppingBag,
            iconColor: "text-cyan-300",
            bg: "bg-cyan-400/5",
          },
          {
            label: "Total Earnings",
            value: money(totalEarnings),
            icon: TrendingUp,
            iconColor: "text-emerald-300",
            bg: "bg-emerald-400/5",
            trend: earningsTrend,
          },
          {
            label: "Wallet Balance",
            value: money(balance),
            icon: Wallet,
            iconColor: "text-amber-300",
            bg: "bg-amber-400/5",
          },
        ].map((item) => (
          <div key={item.label} className={`rounded-xl border border-white/8 ${item.bg} p-5`}>
            <div className="flex items-start justify-between">
              <item.icon className={`h-5 w-5 ${item.iconColor}`} />
              {item.trend !== undefined && item.trend !== 0 && (
                <div className={`flex items-center gap-1 text-xs font-semibold ${item.trend > 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {item.trend > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {Math.abs(item.trend).toFixed(0)}%
                </div>
              )}
            </div>
            <p className="mt-4 text-sm text-white/45">{item.label}</p>
            <p className="mt-1 text-2xl font-black">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Earnings chart */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
        <h3 className="mb-4 text-sm font-bold text-white/70">Earnings — Last 7 Days</h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }}
              labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              formatter={(v: any) => [money(v), "Earnings"]}
            />
            <Area type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={2} fill="url(#earningsGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Orders chart */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
        <h3 className="mb-4 text-sm font-bold text-white/70">Orders — Last 7 Days</h3>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }}
              formatter={(v: any) => [v, "Orders"]}
            />
            <Bar dataKey="orders" fill="#22d3ee" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <h3 className="mb-4 text-sm font-bold text-white/70">Recent Orders</h3>
          <div className="space-y-2">
            {recentOrders.map((o: any) => (
              <div key={o.reference} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold">{o.planName}</p>
                  <p className="text-xs text-white/35">{o.customerEmail}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-300">{money(o.amount)}</p>
                  <StatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

function Pricing({ plans, prices, onSaved }: { plans: any; prices: any[]; onSaved: () => void }) {
  const { toast } = useToast();
  const basePlans = flattenPlans(plans);
  const initial = useMemo(() => Object.fromEntries(prices.map((p) => [p.planId, String(p.price)])), [prices]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [markupPct, setMarkupPct] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => setValues(initial), [initial]);

  function applyBulkMarkup() {
    const pct = parseFloat(markupPct);
    if (isNaN(pct) || pct < 0) { toast({ title: "Enter a valid percentage", variant: "destructive" }); return; }
    const newValues: Record<string, string> = {};
    basePlans.forEach((p) => {
      const base = p.price;
      const newPrice = Math.ceil(base * (1 + pct / 100));
      newValues[p.planId] = String(newPrice);
    });
    setValues(newValues);
    toast({ title: `Applied ${pct}% markup to all plans` });
  }

  async function save() {
    try {
      const payload = basePlans.map((p) => {
        const raw = values[p.planId];
        const parsed = parseInt(raw, 10);
        const price = isNaN(parsed) || parsed < p.price ? p.price : parsed;
        return { planId: p.planId, price };
      });
      await resellerFetch("/api/reseller/prices", { method: "PUT", body: JSON.stringify({ prices: payload }) });
      onSaved();
    } catch (err: any) {
      toast({ title: "Could not save prices", description: err.message, variant: "destructive" });
    }
  }

  const filtered = basePlans.filter((p) =>
    `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black">Selling Prices</h2>
          <p className="text-sm text-white/45">Set prices above base. Your margin goes to your wallet on every sale.</p>
        </div>
        <Button onClick={save} className="bg-emerald-500 text-gray-950 hover:bg-emerald-400">
          <Save className="mr-2 h-4 w-4" /> Save all prices
        </Button>
      </div>

      {/* Bulk markup */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4">
        <Percent className="h-4 w-4 text-cyan-300 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold">Bulk markup</p>
          <p className="text-xs text-white/45">Apply a percentage above base price to all plans at once.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Input
            className="w-28 h-8 text-sm"
            type="number"
            min="0"
            max="1000"
            placeholder="e.g. 20"
            value={markupPct}
            onChange={(e) => setMarkupPct(e.target.value)}
          />
          <span className="text-sm text-white/60">%</span>
          <Button size="sm" variant="outline" className="border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/10" onClick={applyBulkMarkup}>
            Apply
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/35" />
        <Input className="pl-8 h-9 text-sm" placeholder="Search plans..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Base price</TableHead>
              <TableHead>Your price</TableHead>
              <TableHead>Your margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((plan) => {
              const price = parseInt(values[plan.planId] || String(plan.price), 10);
              const margin = Math.max(0, price - plan.price);
              return (
                <TableRow key={plan.planId}>
                  <TableCell>
                    <p className="font-semibold text-white">{plan.name}</p>
                    <p className="text-xs text-white/35">{plan.category}</p>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{money(plan.price)}</TableCell>
                  <TableCell>
                    <Input
                      className="w-32 h-8 text-sm font-mono"
                      type="number"
                      min={plan.price}
                      value={values[plan.planId] ?? String(plan.price)}
                      onChange={(e) => setValues({ ...values, [plan.planId]: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const raw = values[plan.planId];
                      const parsed = parseInt(raw, 10);
                      const safePrice = isNaN(parsed) ? plan.price : parsed;
                      const safeMargin = Math.max(0, safePrice - plan.price);
                      return (
                        <>
                          <span className={`font-bold ${safeMargin > 0 ? "text-emerald-300" : "text-white/30"}`}>
                            {money(safeMargin)}
                          </span>
                          {safeMargin > 0 && (
                            <span className="ml-1 text-xs text-emerald-400/60">
                              (+{Math.round((safeMargin / plan.price) * 100)}%)
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Orders ──────────────────────────────────────────────────────────────────

function Orders({ orders }: { orders: any[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = orders.filter((o) => {
    const matchSearch = `${o.reference} ${o.planName} ${o.customerEmail}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = ["all", ...Array.from(new Set(orders.map((o) => o.status)))];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-black">Orders ({orders.length})</h2>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${statusFilter === s ? "bg-white text-gray-950" : "border border-white/10 text-white/50 hover:text-white"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/35" />
        <Input className="pl-8 h-9 text-sm" placeholder="Search by reference, plan, or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/8 py-12 text-center">
          <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-white/15" />
          <p className="text-white/35">No orders yet</p>
        </div>
      ) : (
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => (
                <TableRow key={order.reference}>
                  <TableCell className="font-mono text-xs text-white/60">{order.reference}</TableCell>
                  <TableCell className="font-semibold">{order.planName}</TableCell>
                  <TableCell className="text-sm text-white/60">{order.customerEmail}</TableCell>
                  <TableCell className="font-mono font-bold">{money(order.amount)}</TableCell>
                  <TableCell><StatusBadge status={order.status} /></TableCell>
                  <TableCell className="text-xs text-white/40">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

function WalletTab({ wallet, withdrawals, onDone }: { wallet: any; withdrawals: any[]; onDone: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ amount: "", phone: "", note: "" });
  const [loading, setLoading] = useState(false);
  const balance = wallet?.balance || 0;

  async function withdraw(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await resellerFetch("/api/reseller/withdrawal", { method: "POST", body: JSON.stringify(form) });
      toast({ title: "Withdrawal requested ✅", description: "Admin will process your M-Pesa payment." });
      setForm({ amount: "", phone: "", note: "" });
      onDone();
    } catch (err: any) {
      toast({ title: "Withdrawal failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      {/* Withdraw form */}
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-300/60">Available balance</p>
          <p className="mt-1 text-4xl font-black text-emerald-300">{money(balance)}</p>
        </div>

        <form onSubmit={withdraw} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <h3 className="font-black">Request withdrawal</h3>
          <div>
            <label className="mb-1 block text-xs font-semibold text-white/45">Amount (KES)</label>
            <Input required type="number" min="1" max={balance} placeholder={`Max: ${balance}`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-white/45">M-Pesa phone number</label>
            <Input required placeholder="e.g. 0712345678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-white/45">Note (optional)</label>
            <Textarea placeholder="Any note for admin" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <Button disabled={loading || balance === 0} className="w-full bg-emerald-500 text-gray-950 hover:bg-emerald-400">
            {loading ? "Submitting..." : "Request payout"}
          </Button>
          {balance === 0 && <p className="text-center text-xs text-white/35">No balance available to withdraw</p>}
        </form>
      </div>

      {/* Transaction history + withdrawals */}
      <div className="space-y-5">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-4 font-black">Recent Transactions</h3>
          {(wallet?.transactions || []).length === 0 ? (
            <p className="text-sm text-white/35">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {(wallet?.transactions || []).map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{tx.description}</p>
                    <p className="text-xs text-white/30">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}</p>
                  </div>
                  <p className={`font-bold font-mono text-sm ${tx.type === "credit" ? "text-emerald-300" : "text-red-300"}`}>
                    {tx.type === "credit" ? "+" : "−"}{money(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-4 font-black">Withdrawal Requests</h3>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-white/35">No withdrawal requests yet</p>
          ) : (
            <div className="space-y-2">
              {withdrawals.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{money(Number(w.amount || 0))} → {w.phone}</p>
                    {w.adminNote && <p className="text-xs text-white/40">{w.adminNote}</p>}
                    <p className="text-xs text-white/25">{w.createdAt ? new Date(w.createdAt).toLocaleDateString() : ""}</p>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Referrals ────────────────────────────────────────────────────────────────

function Referrals({ referralLink, referrals }: { referralLink: string; referrals: any }) {
  const { toast } = useToast();
  const referralCount = referrals?.count ?? 0;
  const current = currentTier(referralCount);
  const next = nextTier(referralCount);
  const nextMin = next?.min ?? 0;
  const progress = next ? Math.min(100, (referralCount / nextMin) * 100) : 100;

  return (
    <div className="space-y-5">
      {/* Referral link */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-1 text-lg font-black">Your referral link</h2>
        <p className="mb-4 text-sm text-white/45">
          Share this link. When someone applies and gets approved as a reseller through it, it counts as your referral.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm text-white/70 truncate">
            {referralLink || "Set your slug in Profile to get a referral link"}
          </div>
          {referralLink && (
            <Button variant="outline" className="border-white/10 text-white flex-shrink-0" onClick={() => navigator.clipboard.writeText(referralLink).then(() => toast({ title: "Link copied!" }))}>
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tier progress */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">Affiliate tier</h2>
          {current ? (
            <span className={`text-lg font-black ${current.color}`}>{current.icon} {current.name}</span>
          ) : (
            <span className="text-sm text-white/35">No tier yet</span>
          )}
        </div>

        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-white/50">{referralCount} referral{referralCount !== 1 ? "s" : ""}</span>
          {next && <span className="text-white/50">{nextMin} needed for {next.icon} {next.name}</span>}
          {!next && <span className="text-emerald-300 font-bold">Max tier reached! 🎉</span>}
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-700 ${current ? (current.name === "Platinum" ? "bg-cyan-400" : current.name === "Gold" ? "bg-amber-400" : "bg-slate-400") : "bg-emerald-400"}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {TIERS.map((tier) => {
            const unlocked = referralCount >= tier.min;
            return (
              <div key={tier.name} className={`rounded-xl border p-4 ${unlocked ? tier.ring : "border-white/8 bg-white/[0.02] opacity-50"}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xl">{tier.icon}</span>
                  <div>
                    <p className={`font-black text-sm ${unlocked ? tier.color : "text-white/40"}`}>{tier.name}</p>
                    <p className="text-xs text-white/30">{tier.bonus} earnings</p>
                  </div>
                  {unlocked && <Check className="ml-auto h-4 w-4 text-emerald-300" />}
                </div>
                <p className="text-xs text-white/35">{tier.min}+ referrals</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Referred list */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="mb-4 font-black">Referred Resellers</h3>
        {(referrals?.list || []).length === 0 ? (
          <div className="rounded-xl border border-white/8 py-10 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-white/15" />
            <p className="text-sm text-white/35">No referrals yet. Share your link to start earning bonuses.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(referrals.list || []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-white/35">{r.email}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={r.status} />
                  <p className="text-xs text-white/25 mt-0.5">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

function Profile({ reseller, onSaved }: { reseller: any; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    storeName: reseller?.storeName || "",
    slug: reseller?.slug || "",
    customDomain: reseller?.customDomain || "",
    logoUrl: reseller?.logoUrl || "",
  });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await resellerFetch("/api/reseller/profile", { method: "PUT", body: JSON.stringify(form) });
      toast({ title: "Profile saved ✅" });
      onSaved();
    } catch (err: any) {
      toast({ title: "Could not save profile", description: err.message, variant: "destructive" });
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" }); return;
    }
    if (pwForm.newPassword.length < 6) {
      toast({ title: "Password too short (min 6 chars)", variant: "destructive" }); return;
    }
    setPwLoading(true);
    try {
      await resellerFetch("/api/reseller/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      toast({ title: "Password changed ✅" });
      setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err: any) {
      toast({ title: "Password change failed", description: err.message, variant: "destructive" });
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Store profile */}
      <form onSubmit={save} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <div>
          <h2 className="text-lg font-black">Store Profile</h2>
          <p className="text-sm text-white/45">Update your store name, slug, and branding.</p>
        </div>

        {form.logoUrl && (
          <div className="flex items-center gap-3">
            <img src={form.logoUrl} className="h-14 w-14 rounded-xl object-cover border border-white/10" alt="Logo preview" />
            <p className="text-xs text-white/40">Logo preview</p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold text-white/45">Store name</label>
          <Input placeholder="My Awesome Store" value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-white/45">Store slug (URL)</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30">/r/</span>
            <Input placeholder="yourbrand" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-white/45">Logo URL</label>
          <Input placeholder="https://..." value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-white/45">Custom domain (optional)</label>
          <Input placeholder="shop.yourdomain.com" value={form.customDomain} onChange={(e) => setForm({ ...form, customDomain: e.target.value })} />
        </div>
        <Button className="w-full bg-emerald-500 text-gray-950 hover:bg-emerald-400">
          <Save className="mr-2 h-4 w-4" /> Save profile
        </Button>
      </form>

      {/* Change password */}
      <form onSubmit={changePassword} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <div>
          <h2 className="text-lg font-black">Change Password</h2>
          <p className="text-sm text-white/45">Update your portal login password.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-white/45">Current password</label>
          <Input required type="password" placeholder="••••••••" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-white/45">New password</label>
          <Input required type="password" placeholder="••••••••" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-white/45">Confirm new password</label>
          <Input required type="password" placeholder="••••••••" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
        </div>
        <Button disabled={pwLoading} className="w-full bg-cyan-500 text-gray-950 hover:bg-cyan-400">
          {pwLoading ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}
