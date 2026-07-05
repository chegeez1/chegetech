import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, CheckCircle, CreditCard, Mail, Search, ShoppingBag, Store, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

function money(value: number) {
  return `KES ${(value || 0).toLocaleString()}`;
}

export default function ResellerStorefront() {
  const [, params] = useRoute("/r/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug || "";
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [form, setForm] = useState({ email: "", customerName: "" });
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/storefront/${slug}`],
    queryFn: () => fetch(`/api/storefront/${slug}`).then((r) => r.json()),
    enabled: !!slug,
  });

  const plans = useMemo(() => {
    const rows: any[] = [];
    for (const [categoryKey, cat] of Object.entries(data?.categories || {}) as any[]) {
      for (const [planId, plan] of Object.entries(cat.plans || {}) as any[]) rows.push({ ...plan, planId, category: cat.category, categoryKey });
    }
    return rows.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payment/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selected.planId, email: form.email, customerName: form.customerName, reseller: slug }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || "Could not initialize payment");
      if (!payload.paystackConfigured) {
        toast({ title: "Payments unavailable", description: "Please contact the store owner to complete this order.", variant: "destructive" });
        return;
      }
      window.location.href = payload.authorizationUrl;
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) return <div className="min-h-screen bg-background p-8 text-white/50">Loading storefront...</div>;
  if (!data?.success) return <div className="min-h-screen bg-background p-8 text-white">Storefront not found.</div>;

  return (
    <div className="min-h-screen bg-background text-white">
      <header className="border-b border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {data.reseller.logoUrl ? <img src={data.reseller.logoUrl} className="h-12 w-12 rounded-xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-gray-950"><Store /></div>}
            <div>
              <h1 className="text-2xl font-black">{data.reseller.storeName}</h1>
              <p className="text-sm text-white/45">Powered by Chege Tech</p>
            </div>
          </div>
          <Button variant="outline" className="border-white/10 text-white" onClick={() => setLocation("/store")}><ArrowLeft className="mr-2 h-4 w-4" /> Main store</Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-white/35" />
            <Input className="pl-9" placeholder="Search plans" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <button key={plan.planId} onClick={() => { setSelected(plan); setForm({ email: "", customerName: "" }); }} className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-emerald-400/40 hover:bg-white/[0.07]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-emerald-300">{plan.category}</p>
                  <h2 className="mt-1 text-lg font-black">{plan.name}</h2>
                </div>
                {plan.popular && <span className="rounded-full bg-amber-400/15 px-2 py-1 text-xs font-bold text-amber-200">Popular</span>}
              </div>
              <p className="mb-4 text-3xl font-black">{money(plan.price)}</p>
              <p className="mb-4 text-sm text-white/45">{plan.duration}</p>
              <div className="space-y-2">
                {(plan.features || []).slice(0, 4).map((feature: string) => (
                  <p key={feature} className="flex items-center gap-2 text-sm text-white/60"><CheckCircle className="h-4 w-4 text-emerald-300" /> {feature}</p>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2 text-sm font-bold text-emerald-300"><ShoppingBag className="h-4 w-4" /> Buy now</div>
            </button>
          ))}
        </div>
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={pay} className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-950 p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">{selected.name}</h2>
                <p className="text-emerald-300">{money(selected.price)} - {selected.duration}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-white/45 hover:text-white">Close</button>
            </div>
            <label className="mb-2 block text-xs font-bold uppercase text-white/45"><Mail className="mr-1 inline h-3 w-3" /> Delivery email</label>
            <Input required type="email" className="mb-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <label className="mb-2 block text-xs font-bold uppercase text-white/45"><User className="mr-1 inline h-3 w-3" /> Name</label>
            <Input required className="mb-5" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            <Button disabled={loading} className="w-full bg-emerald-500 text-gray-950 hover:bg-emerald-400">
              <CreditCard className="mr-2 h-4 w-4" /> Pay {money(selected.price)}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
