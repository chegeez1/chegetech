import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, CheckCircle, Lock, Mail, User, Zap, CreditCard,
  AlertCircle, ShoppingCart, Trash2, Package, Wallet, ChevronRight,
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

interface CartItem {
  planId: string;
  name: string;
  price: number;
  duration: string;
  categoryKey: string;
  qty: number;
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  streaming: "from-blue-500 to-indigo-600",
  music: "from-amber-400 to-orange-500",
  productivity: "from-cyan-400 to-teal-500",
  vpn: "from-teal-400 to-emerald-500",
  gaming: "from-violet-500 to-purple-600",
  custom: "from-indigo-400 to-violet-500",
};

function getCartFromStorage(): CartItem[] {
  try { return JSON.parse(localStorage.getItem("ct_cart") || "[]"); } catch { return []; }
}
function clearCart() { localStorage.removeItem("ct_cart"); }
function getCustomerData() {
  try { return JSON.parse(localStorage.getItem("customer_data") || "null"); } catch { return null; }
}
function getCustomerToken() { try { return localStorage.getItem("customer_token") || ""; } catch { return ""; } }

export default function CartCheckout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartItem[]>(() => getCartFromStorage());
  const [isProcessing, setIsProcessing] = useState(false);
  const [payMethod, setPayMethod] = useState<"paystack" | "wallet">("paystack");

  const customerToken = getCustomerToken();
  const customer = getCustomerData();
  const totalAmount = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  const { data: configData } = useQuery<{ paystackPublicKey: string | null; paystackConfigured: boolean }>({
    queryKey: ["/api/config"],
  });

  const { data: walletData } = useQuery<{ success: boolean; balance: number }>({
    queryKey: ["/api/customer/wallet"],
    queryFn: async () => {
      const r = await fetch("/api/customer/wallet", { headers: { Authorization: `Bearer ${customerToken}` } });
      return r.json();
    },
    enabled: !!customerToken,
  });

  const walletBalance = walletData?.balance ?? 0;
  const hasEnoughWallet = walletBalance >= totalAmount;

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: customer?.email || "",
      customerName: customer?.name || "",
    },
  });

  useEffect(() => {
    if (cart.length === 0) setLocation("/");
  }, []);

  function removeItem(planId: string) {
    setCart((prev) => {
      const updated = prev.filter((i) => i.planId !== planId);
      localStorage.setItem("ct_cart", JSON.stringify(updated));
      return updated;
    });
  }

  // ── Paystack mutations ─────────────────────────────────────────────────────
  const initMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      const items = cart.map((i) => ({ planId: i.planId, qty: i.qty }));
      const res = await apiRequest("POST", "/api/payment/initialize-cart", { ...data, items });
      return res.json();
    },
    onSuccess: (data: any) => {
      setIsProcessing(false);
      if (!data.paystackConfigured) {
        toast({ title: "Payments unavailable", description: "Please try again or WhatsApp us.", variant: "destructive" });
        return;
      }
      if (data.authorizationUrl) openPaystackPopup(data);
    },
    onError: (err: any) => {
      setIsProcessing(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (reference: string) => {
      const res = await apiRequest("POST", "/api/payment/verify-cart", { reference });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        clearCart();
        const planNames = (data.planNames || []).join(",");
        setLocation(`/payment/success?plan=${encodeURIComponent(planNames)}&email=${encodeURIComponent(form.getValues("email"))}&cart=1`);
      } else {
        toast({ title: "Payment Failed", description: data.error || "Could not deliver accounts", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Verification failed", description: "Contact support with your payment reference", variant: "destructive" });
    },
  });

  // ── Wallet mutation ────────────────────────────────────────────────────────
  const walletMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      const items = cart.map((i) => ({ planId: i.planId, qty: i.qty }));
      const r = await fetch("/api/customer/wallet/pay-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ items, customerName: data.customerName }),
      });
      return r.json();
    },
    onSuccess: (data: any) => {
      setIsProcessing(false);
      if (data.success) {
        clearCart();
        const planNames = (data.planNames || []).join(",");
        if (data.refundAmount > 0) {
          toast({ title: `${data.delivered}/${data.total} items delivered`, description: `KES ${data.refundAmount} refunded for undelivered items.`, variant: "default" });
        }
        setLocation(`/payment/success?plan=${encodeURIComponent(planNames)}&email=${encodeURIComponent(form.getValues("email"))}&cart=1`);
      } else {
        toast({ title: "Wallet payment failed", description: data.error, variant: "destructive" });
      }
    },
    onError: () => {
      setIsProcessing(false);
      toast({ title: "Payment failed", variant: "destructive" });
    },
  });

  function openPaystackPopup(initData: any) {
    const key = configData?.paystackPublicKey;
    if (!key || !window.PaystackPop) {
      toast({ title: "Payment could not open", description: "Please refresh and try again.", variant: "destructive" });
      return;
    }
    const handler = window.PaystackPop.setup({
      key,
      email: form.getValues("email"),
      amount: totalAmount * 100,
      ref: initData.reference,
      currency: "KES",
      callback: (response: any) => { setIsProcessing(true); verifyMutation.mutate(response.reference); },
      onClose: () => toast({ title: "Payment cancelled" }),
    });
    handler.openIframe();
  }

  function onSubmit(values: CheckoutForm) {
    if (cart.length === 0) return;
    setIsProcessing(true);
    if (payMethod === "wallet") {
      walletMutation.mutate(values);
    } else {
      initMutation.mutate(values);
    }
  }

  const busy = isProcessing || initMutation.isPending || verifyMutation.isPending || walletMutation.isPending;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center glass-card p-10 rounded-3xl">
          <ShoppingCart className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <p className="text-lg font-semibold text-white mb-4">Your cart is empty</p>
          <Button onClick={() => setLocation("/")} className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white">Back to Store</Button>
        </div>
      </div>
    );
  }

  const inputCls = "glass border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-indigo-500/50";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="bg-orb w-[500px] h-[500px] bg-indigo-600 top-[-150px] left-[-100px]" style={{ opacity: 0.25 }} />
        <div className="bg-orb w-[400px] h-[400px] bg-violet-700 bottom-[-100px] right-[-80px]" style={{ opacity: 0.2 }} />
      </div>

      <header className="sticky top-0 z-50 glass-nav">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="text-white/60 hover:text-white hover:bg-white/10" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white">Cart Checkout</span>
          </div>
          <Badge className="ml-1 bg-indigo-600/80 text-white border-0">{totalItems} item{totalItems !== 1 ? "s" : ""}</Badge>
        </div>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* ── Order Summary ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Order Summary</h2>
            <div className="space-y-3">
              {cart.map((item) => {
                const gradient = CATEGORY_GRADIENTS[item.categoryKey] ?? "from-indigo-500 to-violet-600";
                return (
                  <div key={item.planId} className="glass-card rounded-2xl overflow-hidden" data-testid={`cart-checkout-item-${item.planId}`}>
                    <div className={`bg-gradient-to-br ${gradient} p-4 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                          <Package className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{item.name}</p>
                          <p className="text-xs text-white/70">{item.duration}{item.qty > 1 ? ` × ${item.qty}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">KES {(item.price * item.qty).toLocaleString()}</span>
                        <button onClick={() => removeItem(item.planId)} className="text-white/50 hover:text-white/90 transition-colors" data-testid={`button-remove-item-${item.planId}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="glass-card rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/40">Subtotal ({totalItems} item{totalItems !== 1 ? "s" : ""})</span>
                <span className="text-white/70">KES {totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between font-bold border-t border-white/8 pt-2">
                <span className="text-white">Total</span>
                <span className="text-2xl text-indigo-400">KES {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 space-y-3">
              {[
                { icon: Lock, text: "Secured checkout — your payment is fully protected" },
                { icon: Mail, text: "All credentials delivered instantly to your email" },
                { icon: CheckCircle, text: "One payment for all your selected plans" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-white/50">
                  <Icon className="w-4 h-4 text-indigo-400 shrink-0" />{text}
                </div>
              ))}
            </div>
          </div>

          {/* ── Payment Form ────────────────────────────────────────────────── */}
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
                      <p className="text-xs text-white/30">All account details will be sent to this email</p>
                    </FormItem>
                  )} />

                  {/* ── Payment Method Selector ───────────────────────────── */}
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-3">Payment Method</p>
                    <div className="grid grid-cols-2 gap-3">

                      {/* Paystack card */}
                      <button
                        type="button"
                        onClick={() => setPayMethod("paystack")}
                        data-testid="pay-method-paystack"
                        className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-left ${
                          payMethod === "paystack"
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-white/10 bg-white/3 hover:border-white/20"
                        }`}
                      >
                        {payMethod === "paystack" && (
                          <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </span>
                        )}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${payMethod === "paystack" ? "bg-indigo-500/20" : "bg-white/5"}`}>
                          <CreditCard className={`w-5 h-5 ${payMethod === "paystack" ? "text-indigo-400" : "text-white/40"}`} />
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-bold ${payMethod === "paystack" ? "text-white" : "text-white/50"}`}>Paystack</p>
                          <p className="text-[10px] text-white/30 mt-0.5">Card / M-Pesa</p>
                        </div>
                      </button>

                      {/* Wallet card */}
                      <button
                        type="button"
                        onClick={() => { if (customerToken) setPayMethod("wallet"); }}
                        data-testid="pay-method-wallet"
                        disabled={!customerToken}
                        className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-left ${
                          !customerToken
                            ? "border-white/5 bg-white/2 opacity-40 cursor-not-allowed"
                            : payMethod === "wallet"
                              ? "border-emerald-500 bg-emerald-500/10"
                              : "border-white/10 bg-white/3 hover:border-white/20"
                        }`}
                      >
                        {payMethod === "wallet" && (
                          <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </span>
                        )}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${payMethod === "wallet" ? "bg-emerald-500/20" : "bg-white/5"}`}>
                          <Wallet className={`w-5 h-5 ${payMethod === "wallet" ? "text-emerald-400" : "text-white/40"}`} />
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-bold ${payMethod === "wallet" ? "text-white" : "text-white/50"}`}>Wallet</p>
                          {customerToken ? (
                            <p className={`text-[10px] mt-0.5 font-semibold ${hasEnoughWallet ? "text-emerald-400" : "text-amber-400"}`}>
                              KES {walletBalance.toLocaleString()}
                            </p>
                          ) : (
                            <p className="text-[10px] text-white/25 mt-0.5">Login to use</p>
                          )}
                        </div>
                      </button>
                    </div>

                    {/* Wallet warnings */}
                    {payMethod === "wallet" && customerToken && !hasEnoughWallet && (
                      <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-amber-300 font-semibold">Insufficient wallet balance</p>
                          <p className="text-[11px] text-amber-300/70 mt-0.5">
                            You need KES {totalAmount.toLocaleString()} but have KES {walletBalance.toLocaleString()}.{" "}
                            <button type="button" className="underline text-amber-400" onClick={() => setLocation("/dashboard?tab=wallet")}>Top up →</button>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Paystack not configured warning */}
                    {payMethod === "paystack" && configData && !configData.paystackConfigured && (
                      <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-300 font-semibold">Payments temporarily unavailable. Please try again later.</p>
                      </div>
                    )}
                  </div>

                  {/* ── Pay Button ────────────────────────────────────────── */}
                  <Button
                    type="submit"
                    className={`w-full h-13 border-0 text-white font-bold text-base shadow-xl hover:opacity-90 transition-opacity ${
                      payMethod === "wallet"
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600"
                        : "bg-gradient-to-r from-indigo-600 to-violet-600"
                    }`}
                    style={{ boxShadow: payMethod === "wallet" ? "0 0 24px rgba(16,185,129,0.3)" : "0 0 24px rgba(99,102,241,0.3)" }}
                    disabled={
                      busy ||
                      (payMethod === "wallet" && !hasEnoughWallet) ||
                      (payMethod === "paystack" && configData !== undefined && !configData?.paystackConfigured)
                    }
                    data-testid="button-pay-all"
                  >
                    {busy ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Processing...</>
                    ) : payMethod === "wallet" ? (
                      <><Wallet className="w-4 h-4 mr-2" />Pay KES {totalAmount.toLocaleString()} from Wallet</>
                    ) : (
                      <><CreditCard className="w-4 h-4 mr-2" />Pay KES {totalAmount.toLocaleString()} with Paystack</>
                    )}
                  </Button>

                  {payMethod === "wallet" && customerToken && (
                    <div className="flex items-center justify-between text-xs text-white/30 -mt-2">
                      <span>Wallet balance after payment:</span>
                      <span className="font-semibold text-white/50">KES {Math.max(0, walletBalance - totalAmount).toLocaleString()}</span>
                    </div>
                  )}

                  {!customerToken && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/15">
                      <Wallet className="w-4 h-4 text-indigo-400 shrink-0" />
                      <p className="text-xs text-white/40">
                        <button type="button" className="underline text-indigo-400" onClick={() => setLocation("/auth")}>Log in</button>{" "}
                        to pay with your wallet balance and earn referral coins.
                      </p>
                      <ChevronRight className="w-3 h-3 text-white/20 ml-auto shrink-0" />
                    </div>
                  )}

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
