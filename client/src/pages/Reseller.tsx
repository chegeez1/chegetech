import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "wouter";
import { ArrowRight, BadgeCheck, Banknote, LineChart, Link as LinkIcon, LogIn, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

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
      toast({ title: "Application submitted", description: data.message });
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
      <div className="mx-auto grid min-h-screen max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
        <section>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300">
            <Store className="h-4 w-4" /> Chege Tech Resellers
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">
            Sell premium subscriptions under your own store.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/60">
            We handle stock, payments, delivery, and support tooling. You set your selling prices, share your store link, and earn the markup on every successful order.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { icon: LinkIcon, title: "Your own link", text: "Get a public storefront like /r/yourbrand." },
              { icon: Banknote, title: "Markup wallet", text: "Profit is credited after each paid order." },
              { icon: LineChart, title: "Live dashboard", text: "Track orders, prices, withdrawals, and sales." },
              { icon: BadgeCheck, title: "Chege delivery", text: "Accounts are delivered from your existing inventory." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <item.icon className="mb-3 h-5 w-5 text-cyan-300" />
                <p className="font-bold">{item.title}</p>
                <p className="mt-1 text-sm text-white/50">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-black/20 p-1">
            <button onClick={() => setMode("apply")} className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === "apply" ? "bg-white text-gray-950" : "text-white/55"}`}>Apply</button>
            <button onClick={() => setMode("login")} className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === "login" ? "bg-white text-gray-950" : "text-white/55"}`}>Login</button>
          </div>

          {mode === "apply" ? (
            <form onSubmit={submitApplication} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input required placeholder="Full name" value={apply.name} onChange={(e) => setApply({ ...apply, name: e.target.value })} />
                <Input required type="email" placeholder="Email" value={apply.email} onChange={(e) => setApply({ ...apply, email: e.target.value })} />
              </div>
              <Input placeholder="Business name" value={apply.businessName} onChange={(e) => setApply({ ...apply, businessName: e.target.value })} />
              <Input placeholder="WhatsApp phone" value={apply.phone} onChange={(e) => setApply({ ...apply, phone: e.target.value })} />
              <Textarea placeholder="Tell us how you plan to sell" value={apply.why} onChange={(e) => setApply({ ...apply, why: e.target.value })} />
              <Button disabled={loading} className="w-full bg-emerald-500 text-gray-950 hover:bg-emerald-400">
                Submit application <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-center text-xs text-white/35">Admin approval creates your username, password, and store slug.</p>
            </form>
          ) : (
            <form onSubmit={submitLogin} className="space-y-3">
              <Input required placeholder="Username" value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} />
              <Input required type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
              <Button disabled={loading} className="w-full bg-cyan-500 text-gray-950 hover:bg-cyan-400">
                <LogIn className="mr-2 h-4 w-4" /> Login to portal
              </Button>
            </form>
          )}

          <button onClick={() => setLocation("/store")} className="mt-5 flex w-full items-center justify-center gap-2 text-sm text-white/45 hover:text-white">
            <Users className="h-4 w-4" /> Back to main store
          </button>
        </section>
      </div>
    </div>
  );
}
