import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, CheckCircle, Lock, Mail, User, Zap, CreditCard,
  AlertCircle, BadgePercent, Tag, X, Wallet, ChevronRight,
  ArrowRight, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import ServicePreview from "@/components/ServicePreview";

const checkoutSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  customerName: z.string().min(2, "Name must be at least 2 characters"),
});
type CheckoutForm = z.infer<typeof checkoutSchema>;

declare global { interface Window { PaystackPop: any; } }

type PayMode = "paystack" | "wallet";

const CATEGORY_GRADIENTS: Record<string, string> = {
  streaming: "from-blue-500 to-indigo-600",
  music: "from-amber-400 to-orange-500",
  productivity: "from-cyan-400 to-teal-500",
  vpn: "from-teal-400 to-emerald-500",
  gaming: "from-violet-500 to-purple-600",
  custom: "from-indigo-400 to-violet-500",
};

interface Plan {
  name: string; price: number; originalPrice?: number; offerLabel?: string;
  duration: string; features: string[]; inStock: boolean; planId: string; categoryKey?: string;
}

function getCustomerToken() { try { return localStorage.getItem("customer_token") || ""; } catch { return ""; } }

export default function Checkout() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const planId = params.get("planId") ?? "";
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [payMode, setPayMode] = useState<PayMode>("paystack");

  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string; discountAmount: number; finalAmount: number; label: string; discountType: string; discountValue: number;
  } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  const [isGift, setIsGift] = useState(false);
  const [giftEmail, setGiftEmail] = useState("");
  const [giftMessage, setGiftMessage] = useState("");

  const customerToken = getCustomerToken();

  const { data: plansData, isLoading } = useQuery<{ categories: Record<string, any> }>({ queryKey: ["/api/plans"] });
  const { data: configData } = useQuery<{ paystackPublicKey: string | null; paystackConfigured: boolean }>({ queryKey: ["/api/config"] });
  const { data: walletData } = useQuery<{ success: boolean; balance: number }>({
    queryKey: ["/api/customer/wallet"],
    queryFn: async () => {
      const r = await fetch("/api/customer/wallet", { headers: { Authorization: `Bearer ${customerToken}` } });
      return r.json();
    },
    enabled: !!customerToken,
  });
  const walletBalance = walletData?.balance ?? 0;

  let selectedPlan: (Plan & { categoryName?: string }) | null = null;
  if (plansData?.categories) {
    for (const cat of Object.values(plansData.categories)) {
      if (cat.plans[planId]) { selectedPlan = { ...cat.plans[planId], categoryName: cat.category }; break; }
    }
  }

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { email: "", customerName: "" },
  });

  const finalAmount = appliedPromo ? appliedPromo.finalAmount : (selectedPlan?.price ?? 0);
  const saving = (selectedPlan?.price ?? 0) - finalAmount;

  // Wallet analysis
  const walletCoversAll = walletBalance >= finalAmount;
  const walletCoversPartial = walletBalance > 0 && !walletCoversAll;
  const walletRemainder = Math.max(0, finalAmount - walletBalance);

  async function applyPromo() {
    if (!promoInput.trim() || !selectedPlan) return;
    setPromoLoading(true); setPromoError("");
    try {
      const raw = await apiRequest("POST", "/api/payment/validate-promo", { code: promoInput.trim(), planId, context: "subscription", amount: selectedPlan.price });
      const res = await raw.json();
      if (res.success) {
        setAppliedPromo({ code: res.promo.code, discountAmount: res.discountAmount, finalAmount: res.finalAmount, label: res.promo.label, discountType: res.promo.discountType, discountValue: res.promo.discountValue });
        setPromoInput("");
        toast({ title: "Promo applied!", description: `You saved KES ${res.discountAmount.toLocaleString()}` });
      } else setPromoError(res.error || "Invalid promo code");
    } catch { setPromoError("Failed to validate promo code"); }
    finally { setPromoLoading(false); }
  }

  function removePromo() { setAppliedPromo(null); setPromoError(""); }

  // ── Paystack full payment ─────────────────────────────────────────────────
  const initMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      const res = await apiRequest("POST", "/api/payment/initialize", {
        ...data, planId, promoCode: appliedPromo?.code ?? null,
        ...(isGift && giftEmail.trim() ? { giftEmail: giftEmail.trim(), giftMessage: giftMessage.trim() } : {}),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setIsProcessing(false);
      if (!data.paystackConfigured) {
        toast({ title: "Payments unavailable", description: "Please try again or WhatsApp us on +254114291301.", variant: "destructive" }); return;
      }
      if (data.authorizationUrl) openPaystackPopup(data.authorizationUrl, data.reference, finalAmount);
    },
    onError: (err: any) => { setIsProcessing(false); toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const verifyMutation = useMutation({
    mutationFn: async (reference: string) => {
      const res = await apiRequest("POST", "/api/payment/verify", { reference });
      return res.json();
    },
    onSuccess: (data: any) => {
      setIsProcessing(false);
      if (data.success) setLocation(`/payment/success?plan=${encodeURIComponent(data.planName || "")}&email=${encodeURIComponent(form.getValues("email"))}`);
      else toast({ title: "Payment Failed", description: data.error, variant: "destructive" });
    },
    onError: () => { setIsProcessing(false); },
  });

  // ── Wallet full payment ───────────────────────────────────────────────────
  const walletMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      const r = await fetch("/api/customer/wallet/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ planId, email: data.email, customerName: data.customerName, promoCode: appliedPromo?.code ?? null,
          ...(isGift && giftEmail.trim() ? { giftEmail: giftEmail.trim(), giftMessage: giftMessage.trim() } : {}),
        }),
      });
      return r.json();
    },
    onSuccess: (data: any) => {
      setIsProcessing(false);
      if (data.success) setLocation(`/payment/success?plan=${encodeURIComponent(data.planName || "")}&email=${encodeURIComponent(form.getValues("email"))}`);
      else toast({ title: "Wallet payment failed", description: data.error, variant: "destructive" });
    },
    onError: () => { setIsProcessing(false); toast({ title: "Payment failed", variant: "destructive" }); },
  });

  // ── Hybrid: wallet partial + Paystack remainder ───────────────────────────
  const hybridMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      const r = await fetch("/api/payment/initialize-hybrid", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ planId, customerName: data.customerName, walletAmountToUse: walletBalance, promoCode: appliedPromo?.code ?? null,
          ...(isGift && giftEmail.trim() ? { giftEmail: giftEmail.trim(), giftMessage: giftMessage.trim() } : {}),
        }),
      });
      return r.json();
    },
    onSuccess: (data: any) => {
      setIsProcessing(false);
      if (!data.success) { toast({ title: data.error || "Failed to initialize payment", variant: "destructive" }); return; }
      if (!data.paystackConfigured) { toast({ title: "Payments unavailable", variant: "destructive" }); return; }
      if (data.authorizationUrl) openPaystackPopup(data.authorizationUrl, data.reference, data.paystackAmount, true);
    },
    onError: () => { setIsProcessing(false); toast({ title: "Payment failed", variant: "destructive" }); },
  });

  const verifyHybridMutation = useMutation({
    mutationFn: async (reference: string) => {
      const res = await apiRequest("POST", "/api/payment/verify-hybrid", { reference });
      return res.json();
    },
    onSuccess: (data: any) => {
      setIsProcessing(false);
      if (data.success) setLocation(`/payment/success?plan=${encodeURIComponent(data.planName || "")}&email=${encodeURIComponent(form.getValues("email"))}`);
      else toast({ title: "Payment Failed", description: data.error, variant: "destructive" });
    },
    onError: () => { setIsProcessing(false); },
  });

  function openPaystackPopup(authUrl: string, reference: string, amount: number, isHybrid = false) {
    const PAYSTACK_PUBLIC_KEY = configData?.paystackPublicKey;
    if (!PAYSTACK_PUBLIC_KEY || !window.PaystackPop) {
      toast({ title: "Payment could not open", description: "Please refresh and try again.", variant: "destructive" }); return;
    }
    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: form.getValues("email"),
      amount: amount * 100,
      ref: reference,
      currency: "KES",
      callback: (response: any) => {
        setIsProcessing(true);
        if (isHybrid) verifyHybridMutation.mutate(response.reference);
        else verifyMutation.mutate(response.reference);
      },
      onClose: () => toast({ title: "Payment cancelled" }),
    });
    handler.openIframe();
  }

  function onSubmit(values: CheckoutForm) {
    if (!selectedPlan?.inStock) { toast({ title: "Out of Stock", variant: "destructive" }); return; }
    setIsProcessing(true);

    if (payMode === "wallet") {
      if (walletCoversAll) {
        walletMutation.mutate(values);
      } else if (walletCoversPartial) {
        // hybrid: use wallet balance + Paystack for remainder
        hybridMutation.mutate(values);
      } else {
        setIsProcessing(false);
        toast({ title: "No wallet balance", description: "Please top up your wallet or switch to Paystack.", variant: "destructive" });
      }
    } else {
      initMutation.mutate(values);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!selectedPlan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center glass-card p-10 rounded-3xl">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-lg font-semibold text-white mb-4">Plan not found</p>
          <Button onClick={() => setLocation("/")} className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white">Back to Store</Button>
        </div>
      </div>
    );
  }

  const catKey = (selectedPlan as any).categoryKey ?? "streaming";
  const gradient = CATEGORY_GRADIENTS[catKey] ?? "from-indigo-500 to-violet-600";
  const inputCls = "glass border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-indigo-500/50";
  const busy = isProcessing || initMutation.isPending || verifyMutation.isPending || walletMutation.isPending || hybridMutation.isPending || verifyHybridMutation.isPending;

  // What will the pay button do?
  const isHybridMode = payMode === "wallet" && walletCoversPartial && customerToken;
  const isFullWalletMode = payMode === "wallet" && walletCoversAll && customerToken;
  const isWalletEmpty = payMode === "wallet" && walletBalance === 0 && customerToken;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="bg-orb w-[500px] h-[500px] bg-indigo-600 top-[-150px] left-[-100px]" style={{ opacity: 0.25 }} />
        <div className="bg-orb w-[400px] h-[400px] bg-violet-700 bottom-[-100px] right-[-80px]" style={{ opacity: 0.2 }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass-nav">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="text-white/60 hover:text-white hover:bg-white/10" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white">Checkout</span>
          </div>
          {customerToken && walletData && (
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
              <Wallet className="w-3 h-3" />
              KES {walletBalance.toLocaleString()}
            </div>
          )}
        </div>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* ── Order Summary ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Order Summary</h2>
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className={`bg-gradient-to-br ${gradient} p-6 relative`}>
                <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at top right, rgba(255,255,255,0.3), transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Badge className="mb-2 bg-white/20 text-white border-0 text-xs backdrop-blur-sm">{(selectedPlan as any).categoryName}</Badge>
                      <h3 className="font-bold text-xl text-white">{selectedPlan.name}</h3>
                      <p className="text-sm text-white/70">{selectedPlan.duration}</p>
                      {selectedPlan.offerLabel && <Badge className="mt-2 bg-amber-500/80 text-white border-0 text-xs">{selectedPlan.offerLabel}</Badge>}
                    </div>
                    <div className="text-right shrink-0">
                      {selectedPlan.originalPrice && <p className="text-sm text-white/50 line-through">KES {selectedPlan.originalPrice.toLocaleString()}</p>}
                      <p className="text-3xl font-bold text-white">KES {selectedPlan.price.toLocaleString()}</p>
                      <p className="text-xs text-white/60">one-time</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-2.5">
                {selectedPlan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-white/60">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />{f}
                  </div>
                ))}
              </div>
            </div>

            <ServicePreview planId={planId} />

            <div className="glass-card rounded-2xl p-4 space-y-3">
              {[
                { icon: Lock, text: "Secured checkout — your payment is fully protected" },
                { icon: Mail, text: "Account credentials delivered instantly to your email" },
                { icon: CheckCircle, text: "Verified shared accounts with guaranteed access" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-white/50">
                  <Icon className="w-4 h-4 text-indigo-400 shrink-0" />{text}
                </div>
              ))}
            </div>
          </div>

          {/* ── Checkout Form ────────────────────────────────────────────── */}
          <div>
            <h2 className="text-lg font-bold text-white mb-4">Your Details</h2>
            <div className="glass-card rounded-2xl p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/60 text-xs uppercase tracking-wider">Full Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                          <Input {...field} placeholder="John Doe" className={inputCls + " pl-9"} data-testid="input-name" />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/60 text-xs uppercase tracking-wider">Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                          <Input {...field} type="email" placeholder="you@example.com" className={inputCls + " pl-9"} data-testid="input-email" />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400" />
                      <p className="text-xs text-white/30">Account details will be sent to this email</p>
                    </FormItem>
                  )} />

                  {/* Promo Code */}
                  <div className="space-y-2">
                    <label className="text-white/60 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3 h-3" />Promo Code
                    </label>
                    {appliedPromo ? (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="flex items-center gap-2">
                          <BadgePercent className="w-4 h-4 text-emerald-400" />
                          <div>
                            <p className="text-sm font-semibold font-mono text-emerald-400">{appliedPromo.code}</p>
                            <p className="text-xs text-emerald-400/70">
                              {appliedPromo.discountType === "percent" ? `${appliedPromo.discountValue}% off` : `KES ${appliedPromo.discountValue} off`}
                              {appliedPromo.label ? ` · ${appliedPromo.label}` : ""}
                            </p>
                          </div>
                        </div>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-white/30 hover:text-white/60" onClick={removePromo} data-testid="button-remove-promo">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={promoInput}
                          onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }}
                          placeholder="ENTER CODE"
                          className={inputCls + " font-mono tracking-widest"}
                          data-testid="input-promo"
                        />
                        <Button type="button" variant="outline" className="glass border-white/10 text-white/60 hover:text-white hover:border-indigo-500/50 shrink-0"
                          onClick={applyPromo} disabled={!promoInput.trim() || promoLoading} data-testid="button-apply-promo">
                          {promoLoading ? "..." : "Apply"}
                        </Button>
                      </div>
                    )}
                    {promoError && <p className="text-xs text-red-400">{promoError}</p>}
                  </div>

                  {/* Gift Toggle */}
                  <div className="rounded-xl border border-white/8 p-4" style={{ background: "rgba(99,102,241,.06)" }}>
                    <button type="button" onClick={() => setIsGift(g => !g)}
                      className="flex items-center gap-3 w-full group">
                      <div className={`w-10 h-6 rounded-full transition-colors relative ${isGift ? "bg-indigo-500" : "bg-white/10"}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isGift ? "left-5" : "left-1"}`} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white/80 flex items-center gap-1.5">
                          🎁 Gift this to someone
                        </p>
                        <p className="text-xs text-white/35">Credentials will be sent to the recipient</p>
                      </div>
                    </button>
                    {isGift && (
                      <div className="mt-3 space-y-2">
                        <Input type="email" placeholder="Recipient's email address *"
                          value={giftEmail} onChange={e => setGiftEmail(e.target.value)}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/25" />
                        <Input placeholder="Personal message (optional)"
                          value={giftMessage} onChange={e => setGiftMessage(e.target.value)}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-xs h-8" />
                        {isGift && giftEmail.trim() && (
                          <p className="text-xs text-indigo-400">✓ Credentials will be delivered to <strong>{giftEmail}</strong></p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Price Breakdown */}
                  <div className="rounded-xl bg-white/3 border border-white/8 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/40">Subtotal</span>
                      <span className="text-white/70">KES {selectedPlan.price.toLocaleString()}</span>
                    </div>
                    {appliedPromo && (
                      <div className="flex items-center justify-between text-sm text-emerald-400">
                        <span>Discount ({appliedPromo.code})</span>
                        <span>- KES {appliedPromo.discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between font-bold border-t border-white/8 pt-2 mt-1">
                      <span className="text-white">Total</span>
                      <span className="text-xl text-indigo-400">KES {finalAmount.toLocaleString()}</span>
                    </div>
                    {saving > 0 && <p className="text-xs text-emerald-400 text-right">You're saving KES {saving.toLocaleString()}!</p>}
                  </div>

                  {/* ── Payment Method Selector ─────────────────────────── */}
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-3">Payment Method</p>
                    <div className="grid grid-cols-2 gap-3">

                      {/* Paystack */}
                      <button type="button" onClick={() => setPayMode("paystack")} data-testid="pay-method-paystack"
                        className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                          payMode === "paystack"
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-white/10 bg-white/3 hover:border-white/20"
                        }`}
                      >
                        {payMode === "paystack" && (
                          <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </span>
                        )}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${payMode === "paystack" ? "bg-indigo-500/20" : "bg-white/5"}`}>
                          <CreditCard className={`w-5 h-5 ${payMode === "paystack" ? "text-indigo-400" : "text-white/40"}`} />
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-bold ${payMode === "paystack" ? "text-white" : "text-white/50"}`}>Paystack</p>
                          <p className="text-[10px] text-white/30 mt-0.5">Card / M-Pesa</p>
                        </div>
                      </button>

                      {/* Wallet */}
                      <button type="button"
                        onClick={() => { if (customerToken) setPayMode("wallet"); else setLocation("/auth"); }}
                        data-testid="pay-method-wallet"
                        className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                          payMode === "wallet"
                            ? walletCoversAll
                              ? "border-emerald-500 bg-emerald-500/10"
                              : walletCoversPartial
                                ? "border-amber-500 bg-amber-500/10"
                                : "border-red-500/50 bg-red-500/5"
                            : "border-white/10 bg-white/3 hover:border-white/20"
                        }`}
                      >
                        {payMode === "wallet" && (
                          <span className={`absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center ${walletCoversAll ? "bg-emerald-500" : walletCoversPartial ? "bg-amber-500" : "bg-red-500/60"}`}>
                            <CheckCircle className="w-3 h-3 text-white" />
                          </span>
                        )}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          payMode === "wallet"
                            ? walletCoversAll ? "bg-emerald-500/20" : walletCoversPartial ? "bg-amber-500/20" : "bg-red-500/10"
                            : "bg-white/5"
                        }`}>
                          <Wallet className={`w-5 h-5 ${
                            payMode === "wallet"
                              ? walletCoversAll ? "text-emerald-400" : walletCoversPartial ? "text-amber-400" : "text-red-400"
                              : "text-white/40"
                          }`} />
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-bold ${payMode === "wallet" ? "text-white" : "text-white/50"}`}>
                            {customerToken ? "Wallet" : "Log in"}
                          </p>
                          {customerToken ? (
                            <p className={`text-[10px] mt-0.5 font-semibold ${
                              walletCoversAll ? "text-emerald-400"
                                : walletCoversPartial ? "text-amber-400"
                                : "text-red-400/70"
                            }`}>
                              KES {walletBalance.toLocaleString()}
                            </p>
                          ) : (
                            <p className="text-[10px] text-white/25 mt-0.5">Tap to login</p>
                          )}
                        </div>
                      </button>
                    </div>

                    {/* ── Wallet details panel ──────────────────────────── */}
                    {payMode === "wallet" && customerToken && (
                      <div className="mt-3 space-y-2">

                        {/* Full wallet payment */}
                        {walletCoversAll && (
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs text-emerald-300 font-semibold">Your wallet covers the full amount</p>
                              <p className="text-[11px] text-emerald-300/60 mt-0.5">Balance after: KES {(walletBalance - finalAmount).toLocaleString()}</p>
                            </div>
                          </div>
                        )}

                        {/* Hybrid payment */}
                        {walletCoversPartial && (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                            <p className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                              <Wallet className="w-3.5 h-3.5" />
                              Not enough — split payment
                            </p>
                            <div className="flex items-center gap-2 text-[11px]">
                              <div className="flex-1 text-center p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
                                <p className="text-white/50">From Wallet</p>
                                <p className="font-bold text-emerald-400 text-sm">KES {walletBalance.toLocaleString()}</p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-white/20 shrink-0" />
                              <div className="flex-1 text-center p-2 rounded-lg bg-indigo-500/15 border border-indigo-500/20">
                                <p className="text-white/50">Via Paystack</p>
                                <p className="font-bold text-indigo-400 text-sm">KES {walletRemainder.toLocaleString()}</p>
                              </div>
                            </div>
                            <p className="text-[10px] text-amber-300/60">
                              We'll deduct KES {walletBalance.toLocaleString()} from your wallet and charge KES {walletRemainder.toLocaleString()} via card/M-Pesa.
                            </p>
                          </div>
                        )}

                        {/* Empty wallet */}
                        {isWalletEmpty && (
                          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs text-red-300 font-semibold">Wallet is empty</p>
                              <p className="text-[11px] text-red-300/60 mt-0.5">
                                <button type="button" className="underline text-amber-400" onClick={() => setLocation("/dashboard?tab=wallet")}>Top up your wallet</button>
                                {" "}or switch to Paystack.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Not logged in nudge */}
                    {!customerToken && (
                      <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/15 cursor-pointer" onClick={() => setLocation("/auth")}>
                        <Wallet className="w-4 h-4 text-indigo-400 shrink-0" />
                        <p className="text-xs text-white/40">
                          <span className="underline text-indigo-400">Log in</span> to pay with wallet or earn referral coins.
                        </p>
                        <ChevronRight className="w-3 h-3 text-white/20 ml-auto shrink-0" />
                      </div>
                    )}

                    {/* Paystack unavailable warning */}
                    {payMode === "paystack" && configData && !configData.paystackConfigured && (
                      <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-red-300 font-semibold">Payments temporarily unavailable</p>
                          <p className="text-[10px] text-red-300/70 mt-0.5">Please try again later or <a href="https://wa.me/254114291301" target="_blank" rel="noopener noreferrer" className="underline text-green-400">chat us on WhatsApp</a>.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Pay Button ────────────────────────────────────────── */}
                  <Button
                    type="submit"
                    className={`w-full h-12 border-0 text-white font-bold text-base shadow-xl hover:opacity-90 transition-opacity ${
                      isHybridMode
                        ? "bg-gradient-to-r from-amber-500 to-indigo-600"
                        : isFullWalletMode
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600"
                          : `bg-gradient-to-r ${gradient}`
                    }`}
                    style={{ boxShadow: isFullWalletMode ? "0 0 24px rgba(16,185,129,0.3)" : "0 0 24px rgba(99,102,241,0.3)" }}
                    disabled={!!(
                      busy ||
                      (payMode === "wallet" && !customerToken) ||
                      (payMode === "wallet" && isWalletEmpty) ||
                      (payMode === "paystack" && configData !== undefined && !configData?.paystackConfigured)
                    )}
                    data-testid="button-pay"
                  >
                    {busy ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Processing...</>
                    ) : isHybridMode ? (
                      <><Wallet className="w-4 h-4 mr-1.5" />KES {walletBalance.toLocaleString()} Wallet <ArrowRight className="w-3 h-3 mx-1.5" /> KES {walletRemainder.toLocaleString()} Paystack</>
                    ) : isFullWalletMode ? (
                      <><Wallet className="w-4 h-4 mr-2" />Pay KES {finalAmount.toLocaleString()} from Wallet</>
                    ) : (
                      <><CreditCard className="w-4 h-4 mr-2" />Pay KES {finalAmount.toLocaleString()} with Paystack</>
                    )}
                  </Button>

                  <p className="text-xs text-center text-white/25">
                    By completing your purchase, you agree to receive account credentials via email.
                  </p>
                </form>
              </Form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
