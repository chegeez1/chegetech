import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, CheckCircle, CreditCard, Flame, Mail, Search, ShoppingBag, Star, Store, User, X, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

function money(value: number) {
  return `KES ${(value || 0).toLocaleString()}`;
}

function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    streaming: "text-purple-300 bg-purple-400/15 border-purple-400/20",
    vpn: "text-cyan-300 bg-cyan-400/15 border-cyan-400/20",
    music: "text-pink-300 bg-pink-400/15 border-pink-400/20",
    gaming: "text-amber-300 bg-amber-400/15 border-amber-400/20",
    productivity: "text-blue-300 bg-blue-400/15 border-blue-400/20",
  };
  const key = category.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (key.includes(k)) return v;
  }
  return "text-emerald-300 bg-emerald-400/15 border-emerald-400/20";
}

export default function ResellerStorefront() {
  const [, params] = useRoute("/r/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug || "";
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selected, setSelected] = useState<any | null>(null);
  const [form, setForm] = useState({ email: "", customerName: "" });
  const [loading, setLoading] = useState(false);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/storefront/${slug}`],
    queryFn: async () => {
      const r = await fetch(`/api/storefront/${slug}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!slug,
    retry: 1,
  });

  const allPlans = useMemo(() => {
    const rows: any[] = [];
    for (const [categoryKey, cat] of Object.entries(data?.categories || {}) as any[]) {
      for (const [planId, plan] of Object.entries((cat as any).plans || {}) as any[]) {
        rows.push({ ...plan, planId, category: (cat as any).category, categoryKey });
      }
    }
    return rows;
  }, [data]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(allPlans.map((p) => p.category)));
    return ["All", ...cats];
  }, [allPlans]);

  const plans = useMemo(() => {
    return allPlans.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [allPlans, search, activeCategory]);

  const popularPlans = allPlans.filter((p) => p.popular);

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
        toast({ title: "Payments unavailable", description: "Please contact the store owner to complete your order.", variant: "destructive" });
        return;
      }
      window.location.href = payload.authorizationUrl;
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          <p className="text-sm text-white/50">Loading storefront...</p>
        </div>
      </div>
    );
  }

  if (isError || !data?.success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-white">
        <div className="text-center">
          <Store className="mx-auto mb-4 h-12 w-12 text-white/20" />
          <h2 className="text-xl font-bold">Storefront not found</h2>
          <p className="mt-2 text-sm text-white/50">This store link may be invalid or the store is offline.</p>
          <Button onClick={() => setLocation("/store")} variant="outline" className="mt-6 border-white/10 text-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go to main store
          </Button>
        </div>
      </div>
    );
  }

  const reseller = data.reseller;

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            {reseller.logoUrl ? (
              <img src={reseller.logoUrl} className="h-10 w-10 rounded-xl object-cover" alt="Store logo" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-gray-950">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-black leading-tight">{reseller.storeName}</h1>
              <p className="text-xs text-white/35">Powered by Chege Tech</p>
            </div>
          </div>
          <Button variant="outline" className="border-white/10 text-white text-sm" onClick={() => setLocation("/store")}>
            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Main store
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Hero banner */}
        <div className="mb-8 rounded-2xl border border-emerald-400/15 bg-gradient-to-r from-emerald-900/30 to-cyan-900/20 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="h-5 w-5 text-emerald-300" />
            <span className="text-sm font-semibold text-emerald-300">Premium subscriptions, delivered instantly</span>
          </div>
          <h2 className="text-2xl font-black sm:text-3xl">Shop {reseller.storeName}</h2>
          <p className="mt-2 text-white/50">
            {plans.length} plan{plans.length !== 1 ? "s" : ""} available — secure checkout powered by Paystack
          </p>
        </div>

        {/* Popular picks */}
        {popularPlans.length > 0 && activeCategory === "All" && !search && (
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-300" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">Popular picks</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {popularPlans.map((plan) => (
                <button
                  key={plan.planId}
                  onClick={() => { setSelected(plan); setForm({ email: "", customerName: "" }); }}
                  className="min-w-[220px] flex-shrink-0 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-left transition hover:border-amber-400/50 hover:bg-amber-400/10"
                >
                  <p className="text-xs font-semibold text-amber-300">{plan.category}</p>
                  <p className="mt-1 font-black">{plan.name}</p>
                  <p className="mt-1 text-xl font-black text-white">{money(plan.price)}</p>
                  <p className="mt-0.5 text-xs text-white/40">{plan.duration}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search + filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/35" />
            <Input
              className="pl-9"
              placeholder="Search plans..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  activeCategory === cat
                    ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                    : "border-white/10 text-white/50 hover:border-white/20 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Plans grid */}
        {plans.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] py-20 text-center">
            <Search className="mx-auto mb-4 h-10 w-10 text-white/20" />
            <p className="text-white/40">No plans match your search.</p>
            <button onClick={() => { setSearch(""); setActiveCategory("All"); }} className="mt-3 text-sm text-emerald-400 hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const catStyle = getCategoryColor(plan.category);
              return (
                <button
                  key={plan.planId}
                  onClick={() => { setSelected(plan); setForm({ email: "", customerName: "" }); }}
                  className="group rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-left transition duration-200 hover:border-emerald-400/30 hover:bg-white/[0.07] hover:shadow-lg hover:shadow-emerald-900/20"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${catStyle}`}>
                        {plan.category}
                      </span>
                      <h2 className="mt-2 text-lg font-black">{plan.name}</h2>
                    </div>
                    {plan.popular && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-1 text-xs font-bold text-amber-200">
                        <Star className="h-3 w-3" /> Popular
                      </span>
                    )}
                  </div>
                  <p className="mb-1 text-3xl font-black">{money(plan.price)}</p>
                  <p className="mb-4 text-sm text-white/40">{plan.duration}</p>
                  <div className="space-y-1.5">
                    {(plan.features || []).slice(0, 4).map((feature: string) => (
                      <p key={feature} className="flex items-center gap-2 text-sm text-white/55">
                        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-emerald-300" /> {feature}
                      </p>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center gap-2 font-bold text-emerald-300 group-hover:text-emerald-200 transition">
                    <ShoppingBag className="h-4 w-4" /> Buy now
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/8 mt-12 py-6 text-center text-xs text-white/25">
        {reseller.storeName} is a reseller powered by{" "}
        <button onClick={() => setLocation("/store")} className="text-white/40 hover:text-white/60 underline">
          Chege Tech
        </button>
      </footer>

      {/* Checkout modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={pay}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-950 p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-300">{selected.category}</p>
                <h2 className="mt-1 text-xl font-black">{selected.name}</h2>
                <p className="text-emerald-300 font-bold">{money(selected.price)}</p>
                <p className="text-sm text-white/45">{selected.duration}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-white/45 hover:bg-white/10 hover:text-white transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Features mini-list */}
            {selected.features?.length > 0 && (
              <div className="mb-5 rounded-xl bg-white/[0.04] p-3 space-y-1">
                {selected.features.slice(0, 3).map((f: string) => (
                  <p key={f} className="flex items-center gap-2 text-xs text-white/55">
                    <CheckCircle className="h-3 w-3 text-emerald-300 flex-shrink-0" /> {f}
                  </p>
                ))}
              </div>
            )}

            <div className="mb-3">
              <label className="mb-1.5 block text-xs font-bold uppercase text-white/45">
                <Mail className="mr-1 inline h-3 w-3" /> Delivery email
              </label>
              <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 block text-xs font-bold uppercase text-white/45">
                <User className="mr-1 inline h-3 w-3" /> Full name
              </label>
              <Input required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="John Doe" />
            </div>

            <Button disabled={loading} className="w-full bg-emerald-500 text-gray-950 hover:bg-emerald-400 font-bold">
              <CreditCard className="mr-2 h-4 w-4" />
              {loading ? "Redirecting..." : `Pay ${money(selected.price)} via Paystack`}
            </Button>
            <p className="mt-3 text-center text-xs text-white/30">
              Secure checkout powered by Paystack. Account delivered to your email.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
