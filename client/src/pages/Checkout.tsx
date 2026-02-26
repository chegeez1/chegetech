import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, CheckCircle, Lock, Mail, User, Zap, CreditCard,
  AlertCircle, BadgePercent, Tag, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const checkoutSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  customerName: z.string().min(2, "Name must be at least 2 characters"),
});
type CheckoutForm = z.infer<typeof checkoutSchema>;

declare global { interface Window { PaystackPop: any; } }

const CATEGORY_GRADIENTS: Record<string, string> = {
  streaming: "from-blue-500 to-indigo-600",
  music: "from-amber-400 to-orange-500",
  productivity: "from-cyan-400 to-teal-500",
  vpn: "from-teal-400 to-emerald-500",
  gaming: "from-violet-500 to-purple-600",
  custom: "from-indigo-400 to-violet-500",
};

interface Plan {
  name: string;
  price: number;
  originalPrice?: number;
  offerLabel?: string;
  duration: string;
  features: string[];
  inStock: boolean;
  planId: string;
  categoryKey?: string;
}

export default function Checkout() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const planId = params.get("planId") ?? "";
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string; discountAmount: number; finalAmount: number; label: string; discountType: string; discountValue: number;
  } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  const { data: plansData, isLoading } = useQuery<{ categories: Record<string, any> }>({ queryKey: ["/api/plans"] });
  const { data: configData } = useQuery<{ paystackPublicKey: string | null; paystackConfigured: boolean }>({ queryKey: ["/api/config"] });

  let selectedPlan: (Plan & { categoryName?: string }) | null = null;
  if (plansData?.categories) {
    for (const cat of Object.values(plansData.categories)) {
      if (cat.plans[planId]) {
        selectedPlan = { ...cat.plans[planId], categoryName: cat.category };
        break;
      }
    }
  }

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { email: "", customerName: "" },
  });

  const finalAmount = appliedPromo ? appliedPromo.finalAmount : (selectedPlan?.price ?? 0);
  const saving = (selectedPlan?.price ?? 0) - finalAmount;

  async function applyPromo() {
    if (!promoInput.trim() || !selectedPlan) return;
    setPromoLoading(true); setPromoError("");
    try {
      const raw = await apiRequest("POST", "/api/payment/validate-promo", { code: promoInput.trim(), planId, amount: selectedPlan.price });
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

  const initMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      const res = await apiRequest("POST", "/api/payment/initialize", { ...data, planId, promoCode: appliedPromo?.code ?? null });
      return res.json();
    },
    onSuccess: (data: any) => {
      setIsProcessing(false);
      if (!data.paystackConfigured) {
        toast({ title: "Payments unavailable", description: "Please try again or WhatsApp us on +254114291301.", variant: "destructive" });
        return;
      }
      if (data.authorizationUrl) openPaystackPopup(data);
    },
    onError: (err: any) => { setIsProcessing(false); toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const verifyMutation = useMutation({
    mutationFn: async (reference: string) => {
      const res = await apiRequest("POST", "/api/payment/verify", { reference });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) setLocation(`/payment/success?plan=${encodeURIComponent(data.planName || "")}&email=${encodeURIComponent(form.getValues("email"))}`);
      else toast({ title: "Payment Failed", description: data.error, variant: "destructive" });
    },
  });

  function openPaystackPopup(initData: any) {
    const PAYSTACK_PUBLIC_KEY = configData?.paystackPublicKey;
    if (!PAYSTACK_PUBLIC_KEY || !window.PaystackPop) {
      toast({ title: "Payment could not open", description: "Please refresh the page and try again.", variant: "destructive" }); return;
    }
    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: form.getValues("email"),
      amount: finalAmount * 100,
      ref: initData.reference,
      currency: "KES",
      callback: (response: any) => { setIsProcessing(true); verifyMutation.mutate(response.reference); },
      onClose: () => toast({ title: "Payment cancelled" }),
    });
    handler.openIframe();
  }

  function onSubmit(values: CheckoutForm) {
    if (!selectedPlan?.inStock) { toast({ title: "Out of Stock", variant: "destructive" }); return; }
    setIsProcessing(true);
    initMutation.mutate(values);
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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background orbs */}
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
        </div>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Order Summary */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Order Summary</h2>
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className={`bg-gradient-to-br ${gradient} p-6 relative`}>
                <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at top right, rgba(255,255,255,0.3), transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Badge className="mb-2 bg-white/20 text-white border-0 text-xs backdrop-blur-sm">
                        {(selectedPlan as any).categoryName}
                      </Badge>
                      <h3 className="font-bold text-xl text-white">{selectedPlan.name}</h3>
                      <p className="text-sm text-white/70">{selectedPlan.duration}</p>
                      {selectedPlan.offerLabel && (
                        <Badge className="mt-2 bg-amber-500/80 text-white border-0 text-xs">{selectedPlan.offerLabel}</Badge>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {selectedPlan.originalPrice && (
                        <p className="text-sm text-white/50 line-through">KES {selectedPlan.originalPrice.toLocaleString()}</p>
                      )}
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

            <div className="glass-card rounded-2xl p-4 space-y-3">
              {[
                { icon: Lock, text: "Secured by Paystack — Africa's leading payment gateway" },
                { icon: Mail, text: "Account credentials delivered instantly to your email" },
                { icon: CheckCircle, text: "Verified shared accounts with guaranteed access" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-white/50">
                  <Icon className="w-4 h-4 text-indigo-400 shrink-0" />{text}
                </div>
              ))}
            </div>
          </div>

          {/* Checkout Form */}
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

                  {/* Price breakdown */}
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
                    {saving > 0 && (
                      <p className="text-xs text-emerald-400 text-right">You're saving KES {saving.toLocaleString()}!</p>
                    )}
                  </div>

                  {configData && !configData.paystackConfigured && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-sm text-red-300">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Payments temporarily unavailable</p>
                        <p className="text-xs text-red-300/70 mt-0.5">Please try again later or <a href="https://wa.me/254114291301" target="_blank" rel="noopener noreferrer" className="underline text-green-400">chat us on WhatsApp</a>.</p>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className={`w-full h-12 bg-gradient-to-r ${gradient} border-0 text-white font-bold text-base shadow-xl hover:opacity-90 transition-opacity`}
                    style={{ boxShadow: "0 0 24px rgba(99,102,241,0.3)" }}
                    disabled={isProcessing || initMutation.isPending || verifyMutation.isPending || (configData !== undefined && !configData?.paystackConfigured)}
                    data-testid="button-pay"
                  >
                    {isProcessing || initMutation.isPending || verifyMutation.isPending ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Processing...</>
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
