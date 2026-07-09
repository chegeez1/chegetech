import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight, BadgeCheck, Banknote, ChevronRight, LineChart,
  Link as LinkIcon, LogIn, Shield, Star, Store, TrendingUp, Users, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const TIERS = [
  {
    name: "Silver",
    color: "from-slate-400/20 to-slate-300/5 border-slate-400/30",
    badge: "text-slate-300 bg-slate-400/15",
    icon: "🥈",
    minReferrals: 5,
    bonus: "×1.25",
    perks: ["Custom store link", "Markup wallet", "Live dashboard"],
  },
  {
    name: "Gold",
    color: "from-amber-400/20 to-amber-300/5 border-amber-400/30",
    badge: "text-amber-300 bg-amber-400/15",
    icon: "🥇",
    minReferrals: 15,
    bonus: "×1.5",
    perks: ["Everything in Silver", "Priority support", "Earnings multiplier"],
  },
  {
    name: "Platinum",
    color: "from-cyan-400/20 to-cyan-300/5 border-cyan-400/30",
    badge: "text-cyan-300 bg-cyan-400/15",
    icon: "💎",
    minReferrals: 30,
    bonus: "×2.0",
    perks: ["Everything in Gold", "2× earnings bonus", "Dedicated account manager"],
  },
];

const STEPS = [
  { step: "01", title: "Apply", desc: "Fill the short form — we review in under 24 hours." },
  { step: "02", title: "Get your store", desc: "We assign credentials and your personal store link." },
  { step: "03", title: "Set prices & sell", desc: "Mark up plans at any price. Profit lands in your wallet instantly." },
];

const FEATURES = [
  { icon: LinkIcon, title: "Your own store link", text: "Public storefront at /r/yourbrand — share it, brand it, own it." },
  { icon: Banknote, title: "Instant profit wallet", text: "Every paid order credits your markup to your wallet immediately." },
  { icon: LineChart, title: "Live analytics", text: "Track orders, revenue, referrals, and withdrawals in real time." },
  { icon: BadgeCheck, title: "Zero stock headaches", text: "We manage inventory and deliver accounts automatically." },
  { icon: Shield, title: "Affiliate tiers", text: "Refer resellers and unlock Silver, Gold, Platinum earning bonuses." },
  { icon: Zap, title: "Instant payouts", text: "Request M-Pesa withdrawals any time directly from your dashboard." },
];

export default function Reseller() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"apply" | "login">("apply");
  const [loading, setLoading] = useState(false);
  const [apply, setApply] = useState({ name: "", email: "", businessName: "", phone: "", why: "" });
  const [login, setLogin] = useState({ username: "", password: "" });

  async function submitApplication(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/reseller/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apply),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Application failed");
      toast({ title: "Application submitted! ✅", description: "We'll review and send your credentials within 24 hours." });
      setApply({ name: "", email: "", businessName: "", phone: "", why: "" });
    } catch (err: any) {
      toast({ title: "Could not submit", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/reseller/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(login),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Login failed");
      setLocation("/reseller/dashboard");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_60%_0%,rgba(16,185,129,0.12)_0%,transparent_70%)]" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <section>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-1.5 text-sm font-semibold text-emerald-300">
              <Store className="h-3.5 w-3.5" /> Chege Tech Reseller Program
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-[1.1] tracking-tight sm:text-6xl">
              Sell premium subscriptions{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                under your own brand.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/55">
              We handle stock, payments, delivery, and support. You set your prices, share your link,
              and earn the markup on every order — no inventory, no hassle.
            </p>

            {/* Stats */}
            <div className="mt-8 flex flex-wrap gap-6">
              {[
                { value: "200+", label: "Active resellers" },
                { value: "KES 0", label: "Startup cost" },
                { value: "24 hrs", label: "Approval time" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-2xl font-black text-emerald-300">{s.value}</p>
                  <p className="text-xs text-white/45">{s.label}</p>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="mt-10 flex flex-wrap gap-3">
              {STEPS.map((s, i) => (
                <div key={s.step} className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-black text-emerald-300">
                    {s.step}
                  </div>
                  <div>
                    <p className="text-xs font-bold">{s.title}</p>
                    <p className="text-xs text-white/40">{s.desc}</p>
                  </div>
                  {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-white/20" />}
                </div>
              ))}
            </div>
          </section>

          {/* Form */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-sm">
            <div className="mb-5 grid grid-cols-2 rounded-xl bg-black/20 p-1">
              <button
                onClick={() => setMode("apply")}
                className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${mode === "apply" ? "bg-white text-gray-950" : "text-white/55 hover:text-white"}`}
              >
                Apply now
              </button>
              <button
                onClick={() => setMode("login")}
                className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${mode === "login" ? "bg-white text-gray-950" : "text-white/55 hover:text-white"}`}
              >
                Reseller login
              </button>
            </div>

            {mode === "apply" ? (
              <form onSubmit={submitApplication} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input required placeholder="Full name" value={apply.name} onChange={(e) => setApply({ ...apply, name: e.target.value })} />
                  <Input required type="email" placeholder="Email address" value={apply.email} onChange={(e) => setApply({ ...apply, email: e.target.value })} />
                </div>
                <Input placeholder="Business name (optional)" value={apply.businessName} onChange={(e) => setApply({ ...apply, businessName: e.target.value })} />
                <Input placeholder="WhatsApp phone number" value={apply.phone} onChange={(e) => setApply({ ...apply, phone: e.target.value })} />
                <Textarea
                  rows={3}
                  placeholder="How do you plan to sell? (e.g., social media, WhatsApp groups, website...)"
                  value={apply.why}
                  onChange={(e) => setApply({ ...apply, why: e.target.value })}
                />
                <Button disabled={loading} className="w-full bg-emerald-500 text-gray-950 hover:bg-emerald-400">
                  {loading ? "Submitting..." : "Submit application"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-center text-xs text-white/35">
                  Admin approval sets up your account, credentials, and store link.
                </p>
              </form>
            ) : (
              <form onSubmit={submitLogin} className="space-y-3">
                <Input required placeholder="Username" value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} />
                <Input required type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
                <Button disabled={loading} className="w-full bg-cyan-500 text-gray-950 hover:bg-cyan-400">
                  <LogIn className="mr-2 h-4 w-4" /> {loading ? "Logging in..." : "Login to portal"}
                </Button>
              </form>
            )}

            <button
              onClick={() => setLocation("/store")}
              className="mt-5 flex w-full items-center justify-center gap-2 text-xs text-white/35 hover:text-white/60 transition"
            >
              <Users className="h-3.5 w-3.5" /> Browse main store instead
            </button>
          </section>
        </div>
      </div>

      {/* Features grid */}
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-400">What you get</p>
          <h2 className="text-3xl font-black">Everything you need to sell</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition hover:border-white/15 hover:bg-white/[0.06]">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
                <f.icon className="h-4.5 w-4.5 text-emerald-300" />
              </div>
              <p className="font-bold">{f.title}</p>
              <p className="mt-1.5 text-sm text-white/50">{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Affiliate tiers */}
      <div className="border-t border-white/8 bg-white/[0.015]">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-400">Affiliate tiers</p>
            <h2 className="text-3xl font-black">Refer resellers, earn more</h2>
            <p className="mt-3 text-white/50">Bring in other resellers and unlock earnings multipliers on all your sales.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {TIERS.map((tier) => (
              <div key={tier.name} className={`rounded-2xl border bg-gradient-to-b p-5 ${tier.color}`}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-3xl">{tier.icon}</span>
                  <div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tier.badge}`}>{tier.name}</span>
                    <p className="mt-1 text-xl font-black">{tier.bonus} bonus</p>
                  </div>
                </div>
                <p className="mb-4 text-sm text-white/50">{tier.minReferrals}+ referrals to unlock</p>
                <ul className="space-y-2">
                  {tier.perks.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-white/70">
                      <Star className="h-3.5 w-3.5 text-amber-300/60" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-white/8">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <TrendingUp className="mx-auto mb-4 h-10 w-10 text-emerald-300" />
          <h2 className="text-3xl font-black">Ready to start earning?</h2>
          <p className="mt-3 text-white/50">Apply takes 2 minutes. Approval in under 24 hours. Zero upfront cost.</p>
          <Button onClick={() => { setMode("apply"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mt-6 bg-emerald-500 text-gray-950 hover:bg-emerald-400">
            Apply now — it's free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
