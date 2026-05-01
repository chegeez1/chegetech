import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Server, Zap, Shield, Clock, Globe, Cpu, HardDrive, Wifi,
  CheckCircle, MessageCircle, Star, Package, Loader2, User,
  Mail, Phone, Lock, X, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

declare global { interface Window { PaystackPop: any } }

const FEATURES = [
  { icon: Zap,    title: "Instant Provisioning",  desc: "Server ready within minutes after payment is confirmed." },
  { icon: Shield, title: "DDoS Protection",        desc: "Built-in protection keeps your services running 24/7." },
  { icon: Clock,  title: "99.9% Uptime SLA",       desc: "High-availability infrastructure for your bots & apps." },
  { icon: Globe,  title: "East Africa Datacenter", desc: "Low latency from Kenya, Uganda, Tanzania & beyond." },
];

function customerToken() {
  try { return localStorage.getItem("customer_token") || ""; } catch { return ""; }
}

interface VpsPlan {
  id: number;
  name: string;
  ram: string;
  cpu: string;
  storage: string;
  bandwidth: string;
  price_kes: number;
  popular: boolean;
  description?: string;
}

export default function VpsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ success: boolean; plans: VpsPlan[] }>({
    queryKey: ["/api/vps-plans"],
    queryFn: () => fetch("/api/vps-plans").then(r => r.json()),
    staleTime: 60000,
  });

  const { data: configData } = useQuery<{ paystackPublicKey: string | null }>({
    queryKey: ["/api/config"],
    queryFn: () => fetch("/api/config").then(r => r.json()),
    staleTime: 300000,
  });

  const plans = data?.plans || [];

  // Checkout modal state
  const [selectedPlan, setSelectedPlan] = useState<VpsPlan | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState<{ plan: string; reference: string } | null>(null);

  function handleBuy(plan: VpsPlan) {
    if (!customerToken()) { setLocation("/auth"); return; }
    setSelectedPlan(plan);
    setSuccess(null);
    // Pre-fill from localStorage if available
    try {
      const d = JSON.parse(localStorage.getItem("customer_data") || "{}");
      setForm(f => ({ ...f, name: d.name || "", email: d.email || "" }));
    } catch {}
  }

  async function handlePay() {
    if (!form.name || !form.email) {
      toast({ title: "Please fill in all required fields", variant: "destructive" }); return;
    }
    if (!selectedPlan) return;
    setPaying(true);
    try {
      const r = await fetch("/api/vps/payment/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${customerToken()}` },
        body: JSON.stringify({ planId: selectedPlan.id, customerName: form.name, email: form.email, phone: form.phone }),
      });
      const d = await r.json();
      if (!d.success) { toast({ title: "Error", description: d.error, variant: "destructive" }); setPaying(false); return; }

      if (!d.paystackConfigured || !d.authorizationUrl) {
        // Payment gateway not yet configured — inform admin
        toast({ title: "Order registered", description: "We'll contact you with payment details shortly." });
        setSuccess({ plan: d.plan, reference: d.reference });
        setPaying(false); return;
      }

      openPaystackPopup(d.authorizationUrl, d.reference, selectedPlan.price_kes);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setPaying(false);
    }
  }

  function openPaystackPopup(authUrl: string, reference: string, amount: number) {
    const pubKey = configData?.paystackPublicKey;
    if (!pubKey || !window.PaystackPop) {
      window.location.href = authUrl; return;
    }
    const handler = window.PaystackPop.setup({
      key: pubKey,
      email: form.email,
      amount: amount * 100,
      ref: reference,
      onClose: () => { setPaying(false); },
      callback: async (resp: any) => {
        const ref2 = resp.reference || reference;
        try {
          const v = await fetch("/api/vps/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: ref2 }),
          }).then(r => r.json());
          if (v.success) {
            setSuccess({ plan: v.planName || selectedPlan?.name || "", reference: ref2 });
          } else {
            toast({ title: "Payment issue", description: v.error || "Could not confirm payment", variant: "destructive" });
          }
        } catch {}
        setPaying(false);
      },
    });
    handler.openIframe();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Hero */}
      <div className="relative border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/30 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1.5 text-sm text-cyan-400 mb-6">
            <Server className="w-3.5 h-3.5" /> VPS Hosting — East Africa
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
            Reliable VPS Servers
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Blazing-fast virtual servers for your bots, websites, and apps — billed monthly in KES with Paystack.
          </p>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        {FEATURES.map(f => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="bg-white/3 border border-white/6 rounded-2xl p-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-cyan-400" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
              <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Plans */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Choose a Plan</h2>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No plans available yet</p>
            <p className="text-sm mt-1">Check back soon or contact us directly.</p>
            <button onClick={() => window.open("https://wa.me/254700000000", "_blank")} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors">
              <MessageCircle className="w-4 h-4" /> Chat with us
            </button>
          </div>
        ) : (
          <div className={`grid gap-5 ${plans.length === 1 ? "max-w-sm mx-auto" : plans.length === 2 ? "md:grid-cols-2 max-w-2xl mx-auto" : "md:grid-cols-3"}`}>
            {plans.map(plan => (
              <div key={plan.id} className={`relative rounded-2xl border p-6 flex flex-col transition-all duration-200 hover:scale-[1.01] ${plan.popular ? "border-indigo-500/40 bg-indigo-950/30 shadow-xl shadow-indigo-900/20" : "border-white/8 bg-white/3 hover:border-white/14"}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3" /> Most Popular
                    </span>
                  </div>
                )}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                {plan.description && <p className="text-white/40 text-xs mb-3">{plan.description}</p>}

                {/* Specs */}
                <div className="grid grid-cols-2 gap-2 my-3">
                  {[
                    { icon: Cpu,       val: plan.cpu },
                    { icon: Package,   val: plan.ram },
                    { icon: HardDrive, val: plan.storage },
                    { icon: Wifi,      val: plan.bandwidth },
                  ].filter(s => s.val).map(({ icon: Icon, val }) => (
                    <div key={val} className="flex items-center gap-1.5 text-xs text-white/60">
                      <Icon className="w-3.5 h-3.5 text-white/30 shrink-0" />{val}
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-4">
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold">KES {plan.price_kes.toLocaleString()}</span>
                    <span className="text-white/40 text-sm">/month</span>
                  </div>
                  <button
                    onClick={() => handleBuy(plan)}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${plan.popular ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg" : "bg-white/8 hover:bg-white/12 text-white border border-white/10 hover:border-white/20"}`}
                  >
                    <Zap className="w-4 h-4" /> Get Started
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-white/30 text-sm mt-8">
          Need a custom plan? <button onClick={() => window.open("https://wa.me/254700000000", "_blank")} className="text-cyan-400 hover:underline">Chat with us</button>
        </p>
      </div>

      {/* Checkout modal */}
      {selectedPlan && !success && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full sm:max-w-md bg-gray-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8">
              <div>
                <h3 className="font-bold text-white text-base">Order {selectedPlan.name} VPS</h3>
                <p className="text-cyan-400 text-sm font-semibold">KES {selectedPlan.price_kes.toLocaleString()}/month</p>
              </div>
              <button onClick={() => { setSelectedPlan(null); setPaying(false); }} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Plan summary */}
              <div className="bg-white/4 border border-white/8 rounded-xl p-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                {[selectedPlan.cpu, selectedPlan.ram, selectedPlan.storage, selectedPlan.bandwidth].filter(Boolean).map(v => (
                  <span key={v} className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-cyan-400" />{v}</span>
                ))}
              </div>

              {/* Form */}
              <div className="space-y-3">
                {[
                  { key: "name",  label: "Full Name *",      icon: User,  type: "text",  placeholder: "John Doe" },
                  { key: "email", label: "Email Address *",  icon: Mail,  type: "email", placeholder: "john@example.com" },
                  { key: "phone", label: "Phone (optional)", icon: Phone, type: "tel",   placeholder: "+254700000000" },
                ].map(({ key, label, icon: Icon, type, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs text-white/50 block mb-1">{label}</label>
                    <div className="relative">
                      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                      <input
                        type={type}
                        placeholder={placeholder}
                        value={(form as any)[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-white/30 bg-white/3 rounded-xl px-3 py-2">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                Secured by Paystack. Your payment info is never stored on our servers.
              </div>

              <button
                onClick={handlePay}
                disabled={paying || !form.name || !form.email}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white font-bold text-sm transition-all disabled:opacity-50 shadow-lg"
              >
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {paying ? "Processing…" : `Pay KES ${selectedPlan.price_kes.toLocaleString()} via Paystack`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-gray-900 border border-green-500/20 rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Order Placed!</h3>
            <p className="text-white/50 text-sm mb-1">Your <span className="text-white font-medium">{success.plan}</span> VPS is being provisioned.</p>
            <p className="text-white/30 text-xs mb-1">Ref: <span className="font-mono text-cyan-400">{success.reference}</span></p>
            <p className="text-white/30 text-xs mb-6">We'll send your server credentials to your email within a few minutes.</p>
            <div className="flex gap-3">
              <button onClick={() => { setSuccess(null); setSelectedPlan(null); }} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm transition-colors">Close</button>
              <button onClick={() => setLocation("/dashboard")} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors">My Dashboard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
