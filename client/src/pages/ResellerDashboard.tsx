import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Banknote, Copy, ExternalLink, LineChart, LogOut, Package, Save, Settings, ShoppingBag, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Tab = "overview" | "pricing" | "orders" | "wallet" | "profile";

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
    for (const [planId, plan] of Object.entries(cat.plans || {}) as any[]) {
      rows.push({ ...plan, planId, category: cat.category, categoryKey });
    }
  }
  return rows;
}

export default function ResellerDashboard() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const me = useQuery<any>({ queryKey: ["/api/reseller/me"], queryFn: () => resellerFetch("/api/reseller/me"), retry: false });
  const dashboard = useQuery<any>({ queryKey: ["/api/reseller/dashboard"], queryFn: () => resellerFetch("/api/reseller/dashboard"), enabled: !!me.data });
  const plans = useQuery<any>({ queryKey: ["/api/plans"], enabled: !!me.data });
  const prices = useQuery<any>({ queryKey: ["/api/reseller/prices"], queryFn: () => resellerFetch("/api/reseller/prices"), enabled: !!me.data });
  const orders = useQuery<any>({ queryKey: ["/api/reseller/orders"], queryFn: () => resellerFetch("/api/reseller/orders"), enabled: !!me.data });
  const wallet = useQuery<any>({ queryKey: ["/api/reseller/wallet"], queryFn: () => resellerFetch("/api/reseller/wallet"), enabled: !!me.data });
  const withdrawals = useQuery<any>({ queryKey: ["/api/reseller/withdrawals"], queryFn: () => resellerFetch("/api/reseller/withdrawals"), enabled: !!me.data });
  const reseller = me.data?.reseller;
  const storeUrl = reseller?.slug ? `${window.location.origin}/r/${reseller.slug}` : "";
  const navItems: Array<{ id: Tab; icon: any; label: string }> = [
    { id: "overview", icon: LineChart, label: "Overview" },
    { id: "pricing", icon: Package, label: "Pricing" },
    { id: "orders", icon: ShoppingBag, label: "Orders" },
    { id: "wallet", icon: Wallet, label: "Wallet" },
    { id: "profile", icon: Settings, label: "Profile" },
  ];

  useEffect(() => { if (me.isError) setLocation("/reseller"); }, [me.isError, setLocation]);

  async function logout() {
    await resellerFetch("/api/reseller/logout", { method: "POST" }).catch(() => {});
    setLocation("/reseller");
  }

  if (me.isLoading) return <div className="min-h-screen bg-background p-8 text-white/50">Loading reseller portal...</div>;

  return (
    <div className="min-h-screen bg-background text-white">
      <header className="border-b border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-emerald-300">Reseller Portal</p>
            <h1 className="text-2xl font-black">{reseller?.storeName || reseller?.businessName || reseller?.name}</h1>
            <p className="text-sm text-white/45">{storeUrl}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-white/10 text-white" onClick={() => navigator.clipboard.writeText(storeUrl)}><Copy className="mr-2 h-4 w-4" /> Copy link</Button>
            <Button className="bg-emerald-500 text-gray-950 hover:bg-emerald-400" onClick={() => window.open(storeUrl, "_blank")}><ExternalLink className="mr-2 h-4 w-4" /> Open store</Button>
            <Button variant="outline" className="border-white/10 text-white" onClick={logout}><LogOut className="mr-2 h-4 w-4" /> Logout</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <nav className="h-fit rounded-xl border border-white/10 bg-white/[0.04] p-2">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === id ? "bg-white text-gray-950" : "text-white/55 hover:bg-white/10 hover:text-white"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        <section>
          {tab === "overview" && <Overview data={dashboard.data} wallet={wallet.data} />}
          {tab === "pricing" && <Pricing plans={plans.data} prices={prices.data?.prices || []} onSaved={() => { qc.invalidateQueries({ queryKey: ["/api/reseller/prices"] }); toast({ title: "Prices saved" }); }} />}
          {tab === "orders" && <Orders orders={orders.data?.orders || []} />}
          {tab === "wallet" && <WalletTab wallet={wallet.data} withdrawals={withdrawals.data?.withdrawals || []} onDone={() => { qc.invalidateQueries({ queryKey: ["/api/reseller/wallet"] }); qc.invalidateQueries({ queryKey: ["/api/reseller/withdrawals"] }); }} />}
          {tab === "profile" && <Profile reseller={reseller} onSaved={() => qc.invalidateQueries({ queryKey: ["/api/reseller/me"] })} />}
        </section>
      </main>
    </div>
  );
}

function Overview({ data, wallet }: { data: any; wallet: any }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[
        { label: "Successful Orders", value: data?.totalOrders ?? 0, icon: ShoppingBag },
        { label: "Total Earnings", value: money(data?.totalEarnings ?? 0), icon: Banknote },
        { label: "Wallet Balance", value: money(wallet?.balance ?? data?.walletBalance ?? 0), icon: Wallet },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <item.icon className="mb-4 h-5 w-5 text-cyan-300" />
          <p className="text-sm text-white/45">{item.label}</p>
          <p className="mt-1 text-2xl font-black">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function Pricing({ plans, prices, onSaved }: { plans: any; prices: any[]; onSaved: () => void }) {
  const { toast } = useToast();
  const basePlans = flattenPlans(plans);
  const initial = useMemo(() => Object.fromEntries(prices.map((p) => [p.planId, String(p.price)])), [prices]);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => setValues(initial), [initial]);

  async function save() {
    try {
      const payload = basePlans.map((p) => ({ planId: p.planId, price: parseInt(values[p.planId] || String(p.price), 10) }));
      await resellerFetch("/api/reseller/prices", { method: "PUT", body: JSON.stringify({ prices: payload }) });
      onSaved();
    } catch (err: any) {
      toast({ title: "Could not save prices", description: err.message, variant: "destructive" });
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-black">Selling Prices</h2><p className="text-sm text-white/45">Set your price above base price. Your margin goes to your wallet.</p></div>
        <Button onClick={save} className="bg-emerald-500 text-gray-950 hover:bg-emerald-400"><Save className="mr-2 h-4 w-4" /> Save</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Base</TableHead><TableHead>Your Price</TableHead><TableHead>Margin</TableHead></TableRow></TableHeader>
        <TableBody>
          {basePlans.map((plan) => {
            const price = parseInt(values[plan.planId] || String(plan.price), 10);
            return (
              <TableRow key={plan.planId}>
                <TableCell><p className="font-semibold text-white">{plan.name}</p><p className="text-xs text-white/35">{plan.category}</p></TableCell>
                <TableCell>{money(plan.price)}</TableCell>
                <TableCell><Input className="w-32" value={values[plan.planId] ?? String(plan.price)} onChange={(e) => setValues({ ...values, [plan.planId]: e.target.value })} /></TableCell>
                <TableCell className="font-bold text-emerald-300">{money(Math.max(0, price - plan.price))}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function Orders({ orders }: { orders: any[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <h2 className="mb-4 text-lg font-black">Orders</h2>
      <Table>
        <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Plan</TableHead><TableHead>Customer</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>{orders.map((order) => <TableRow key={order.reference}><TableCell className="font-mono text-xs">{order.reference}</TableCell><TableCell>{order.planName}</TableCell><TableCell>{order.customerEmail}</TableCell><TableCell>{money(order.amount)}</TableCell><TableCell><span className="rounded-full bg-white/10 px-2 py-1 text-xs capitalize">{order.status}</span></TableCell></TableRow>)}</TableBody>
      </Table>
    </div>
  );
}

function WalletTab({ wallet, withdrawals, onDone }: { wallet: any; withdrawals: any[]; onDone: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ amount: "", phone: "", note: "" });
  async function withdraw(e: FormEvent) {
    e.preventDefault();
    try {
      await resellerFetch("/api/reseller/withdrawal", { method: "POST", body: JSON.stringify(form) });
      toast({ title: "Withdrawal requested" });
      setForm({ amount: "", phone: "", note: "" });
      onDone();
    } catch (err: any) {
      toast({ title: "Withdrawal failed", description: err.message, variant: "destructive" });
    }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
      <form onSubmit={withdraw} className="h-fit rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm text-white/45">Available balance</p><p className="mb-4 text-3xl font-black">{money(wallet?.balance || 0)}</p>
        <Input required placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mb-3" />
        <Input required placeholder="M-Pesa phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mb-3" />
        <Textarea placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mb-3" />
        <Button className="w-full bg-emerald-500 text-gray-950 hover:bg-emerald-400">Request withdrawal</Button>
      </form>
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <h2 className="mb-4 text-lg font-black">Recent Wallet Activity</h2>
        <div className="space-y-2">{(wallet?.transactions || []).map((tx: any) => <div key={tx.id} className="flex items-center justify-between rounded-lg bg-black/20 p-3 text-sm"><div><p className="font-semibold">{tx.description}</p><p className="text-xs text-white/35">{tx.createdAt}</p></div><p className={tx.type === "credit" ? "text-emerald-300" : "text-red-300"}>{tx.type === "credit" ? "+" : "-"}{money(tx.amount)}</p></div>)}</div>
        <h3 className="mb-2 mt-5 font-bold">Withdrawals</h3>
        {withdrawals.map((w) => <p key={w.id} className="text-sm text-white/55">{money(w.amount)} to {w.phone} - {w.status}</p>)}
      </div>
    </div>
  );
}

function Profile({ reseller, onSaved }: { reseller: any; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ storeName: reseller?.storeName || "", slug: reseller?.slug || "", customDomain: reseller?.customDomain || "", logoUrl: reseller?.logoUrl || "" });
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await resellerFetch("/api/reseller/profile", { method: "PUT", body: JSON.stringify(form) });
      toast({ title: "Profile saved" });
      onSaved();
    } catch (err: any) {
      toast({ title: "Could not save profile", description: err.message, variant: "destructive" });
    }
  }
  return (
    <form onSubmit={save} className="max-w-2xl rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <h2 className="mb-4 text-lg font-black">Store Profile</h2>
      <Input className="mb-3" placeholder="Store name" value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
      <Input className="mb-3" placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
      <Input className="mb-3" placeholder="Custom domain" value={form.customDomain} onChange={(e) => setForm({ ...form, customDomain: e.target.value })} />
      <Input className="mb-3" placeholder="Logo URL" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
      <Button className="bg-emerald-500 text-gray-950 hover:bg-emerald-400">Save profile</Button>
    </form>
  );
}
