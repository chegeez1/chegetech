import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bot, ArrowLeft, CheckCircle, Loader2, CreditCard, Info, Wallet, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ServicePreview from "@/components/ServicePreview";
import { useToast } from "@/hooks/use-toast";

declare global { interface Window { PaystackPop: any; } }

type PayMode = "paystack" | "wallet";

interface BotItem {
  id: number; name: string; description: string; repoUrl: string; price: number;
  features: string[]; requiresSessionId: boolean; requiresDbUrl: boolean;
}

function apiRequest(method: string, url: string, body?: any, token?: string) {
  return fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());
}

function getCustomerData() {
  try { return JSON.parse(localStorage.getItem("customer_data") || "null"); } catch { return null; }
}
function getCustomerToken() {
  try { return localStorage.getItem("customer_token") || ""; } catch { return ""; }
}

const TIMEZONES = [
  "Africa/Nairobi", "Africa/Lagos", "Africa/Johannesburg", "Africa/Accra",
  "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore",
];

export default function BotCheckout() {
  const { botId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const customer = getCustomerData();
  const customerToken = getCustomerToken();

  const [form, setForm] = useState({
    customerName: customer?.name || "",
    customerEmail: customer?.email || "",
    customerPhone: "",
    sessionId: "",
    dbUrl: "",
    mode: "public",
    timezone: "Africa/Nairobi",
  });
  const [payMode, setPayMode] = useState<PayMode>("paystack");
  const [step, setStep] = useState<"form" | "processing">("form");
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<{ valid: boolean; discountType?: string; discountValue?: number; label?: string; code?: string; error?: string } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; bot: BotItem }>({
    queryKey: [`/api/bots/${botId}`],
  });

  const { data: walletData } = useQuery<{ success: boolean; balance: number }>({
    queryKey: ["/api/customer/wallet"],
    queryFn: () =>
      fetch("/api/customer/wallet", {
        headers: { Authorization: `Bearer ${customerToken}` },
      }).then((r) => r.json()),
    enabled: !!customerToken,
  });

  const bot = data?.bot;
  const walletBalance = walletData?.balance ?? 0;

  const discountedPrice = bot && promoResult?.valid
    ? promoResult.discountType === "percent"
      ? Math.max(0, Math.round(bot.price * (1 - (promoResult.discountValue ?? 0) / 100)))
      : Math.max(0, bot.price - (promoResult.discountValue ?? 0))
    : bot?.price ?? 0;

  const walletCoversAll = bot ? walletBalance >= discountedPrice : false;
  const walletCoversPartial = bot ? walletBalance > 0 && !walletCoversAll : false;

  async function validatePromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await apiRequest("POST", "/api/bots/promo/validate", { code: promoCode.trim() });
      setPromoResult(res);
      if (res.valid) toast({ title: `Promo applied: ${res.discountType === "percent" ? res.discountValue + "% off" : "KES " + res.discountValue + " off"}` });
      else toast({ title: "Invalid promo code", description: res.error, variant: "destructive" });
    } catch { setPromoResult({ valid: false, error: "Failed to validate" }); }
    setPromoLoading(false);
  }
  const walletRemainder = bot ? Math.max(0, bot.price - walletBalance) : 0;

  const initMutation = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/bots/order/initialize", payload),
    onSuccess: (data) => {
      if (!data.success) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        setStep("form");
        return;
      }
      if (data.paystackConfigured && data.authorizationUrl) {
        openPaystackPopup(data.authorizationUrl, data.reference, data.paystackPublicKey, data.amount);
      } else {
        toast({ title: "Order Created", description: "Your order was submitted. Admin will contact you for payment." });
        setLocation(`/bots/order/${data.reference}`);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to initialize order", variant: "destructive" });
      setStep("form");
    },
  });

  const walletMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest("POST", "/api/bots/order/wallet-pay", payload, customerToken),
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Payment Confirmed!", description: "Paid with wallet credits. Your bot will be deployed shortly." });
        setLocation(`/bots/order/${data.reference}`);
      } else {
        toast({ title: "Wallet payment failed", description: data.error, variant: "destructive" });
        setStep("form");
      }
    },
    onError: () => {
      toast({ title: "Payment failed", variant: "destructive" });
      setStep("form");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (ref: string) => apiRequest("POST", "/api/bots/order/verify", { reference: ref }),
    onSuccess: (data, ref) => {
      if (data.success) {
        toast({ title: "Payment Confirmed!", description: "Your bot will be deployed shortly." });
        setLocation(`/bots/order/${ref}`);
      } else {
        toast({ title: "Payment pending", description: "Please check your order status.", variant: "destructive" });
        setStep("form");
      }
    },
    onError: () => { setStep("form"); },
  });

  function openPaystackPopup(authUrl: string, reference: string, pubKey: string, amount: number) {
    if (!pubKey || !window.PaystackPop) {
      window.open(authUrl, "_blank");
      return;
    }
    const handler = window.PaystackPop.setup({
      key: pubKey,
      email: form.customerEmail,
      amount: amount * 100,
      currency: "KES",
      ref: reference,
      onSuccess: (response: any) => {
        setStep("processing");
        verifyMutation.mutate(response.reference);
      },
      onClose: () => {
        toast({ title: "Payment cancelled" });
        setStep("form");
      },
    });
    handler.openIframe();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerName || !form.customerEmail || !form.customerPhone) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    if (bot?.requiresSessionId && !form.sessionId) {
      toast({ title: "Session ID required", description: "Please provide your WhatsApp session ID.", variant: "destructive" });
      return;
    }
    setStep("processing");

    if (payMode === "wallet") {
      if (!customerToken) {
        setStep("form");
        toast({ title: "Sign in required", description: "Please sign in to pay with wallet credits.", variant: "destructive" });
        return;
      }
      if (walletCoversAll) {
        walletMutation.mutate({ botId, ...form, promoCode: promoResult?.valid ? promoResult.code : undefined });
      } else if (walletCoversPartial) {
        initMutation.mutate({ botId, ...form, walletAmountToUse: walletBalance, promoCode: promoResult?.valid ? promoResult.code : undefined });
      } else {
        setStep("form");
        toast({ title: "Insufficient wallet balance", description: "Please top up your wallet or switch to Paystack.", variant: "destructive" });
      }
    } else {
      initMutation.mutate({ botId, ...form, promoCode: promoResult?.valid ? promoResult.code : undefined });
    }
  }

  const busy = step === "processing" || initMutation.isPending || walletMutation.isPending || verifyMutation.isPending;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-400" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Bot not found</p>
          <Button onClick={() => setLocation("/bots")} className="bg-green-500 hover:bg-green-600">Back to Bots</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setLocation("/bots")} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Bots
        </button>

        {/* Order summary */}
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Deploying</p>
              <h2 className="font-semibold text-white">{bot.name}</h2>
            </div>
            <div className="ml-auto text-right">
              <span className="text-2xl font-bold text-green-400">KES {bot.price}</span>
              <p className="text-xs text-gray-500">One-time</p>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-1.5">
            {bot.features.map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-xs text-gray-400">
                <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />{f}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <ServicePreview planId={"bot:" + botId} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-5">
          <h3 className="font-semibold text-white text-lg">Your Details</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Full Name *</Label>
              <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="John Doe" className="bg-white/5 border-white/10 text-white" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Email *</Label>
              <Input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                placeholder="john@example.com" className="bg-white/5 border-white/10 text-white" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">Phone Number *</Label>
            <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              placeholder="+254 7XX XXX XXX" className="bg-white/5 border-white/10 text-white" required />
          </div>

          {bot.requiresSessionId && (
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Session ID *</Label>
              <Input value={form.sessionId} onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
                placeholder='Gifted~xxxxxx...' className="bg-white/5 border-white/10 text-white font-mono text-xs" required />
              <p className="text-xs text-gray-500 flex items-start gap-1">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Get your session ID by running the bot locally and scanning the QR code. Starts with "Gifted~".
              </p>
            </div>
          )}

          {bot.requiresDbUrl && (
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Database URL (optional)</Label>
              <Input value={form.dbUrl} onChange={(e) => setForm({ ...form, dbUrl: e.target.value })}
                placeholder="postgresql://..." className="bg-white/5 border-white/10 text-white font-mono text-xs" />
              <p className="text-xs text-gray-500">Leave blank to use a shared database.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Mode</Label>
              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public (everyone can use)</SelectItem>
                  <SelectItem value="private">Private (only you)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Promo Code */}
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">Promo Code (optional)</Label>
            <div className="flex gap-2">
              <Input
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); }}
                placeholder="Enter promo code"
                className="bg-white/5 border-white/10 text-white uppercase font-mono flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); validatePromo(); } }}
              />
              <Button type="button" size="sm" variant="outline" onClick={validatePromo} disabled={promoLoading || !promoCode.trim()}
                className="border-white/10 text-gray-300 hover:text-white shrink-0">
                {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
              </Button>
            </div>
            {promoResult?.valid && (
              <p className="text-xs text-emerald-400">✓ {promoResult.label || promoResult.code} — {promoResult.discountType === "percent" ? promoResult.discountValue + "% off" : "KES " + promoResult.discountValue + " off"}</p>
            )}
            {promoResult && !promoResult.valid && (
              <p className="text-xs text-red-400">{promoResult.error}</p>
            )}
          </div>

          {/* Payment method selector */}
          <div className="space-y-3">
            <Label className="text-gray-300 text-sm">Payment Method</Label>
            <div className="grid grid-cols-2 gap-3">
              {/* Paystack */}
              <button
                type="button"
                onClick={() => setPayMode("paystack")}
                className={`relative p-4 rounded-xl border text-left transition-all ${
                  payMode === "paystack"
                    ? "border-green-500/50 bg-green-500/10"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                {payMode === "paystack" && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500" />
                )}
                <CreditCard className={`w-5 h-5 mb-2 ${payMode === "paystack" ? "text-green-400" : "text-gray-500"}`} />
                <p className={`text-sm font-semibold ${payMode === "paystack" ? "text-white" : "text-gray-400"}`}>Paystack</p>
                <p className="text-xs text-gray-500 mt-0.5">Card / M-Pesa</p>
              </button>

              {/* Wallet */}
              <button
                type="button"
                onClick={() => {
                  if (!customerToken) {
                    setLocation("/auth");
                    return;
                  }
                  setPayMode("wallet");
                }}
                className={`relative p-4 rounded-xl border text-left transition-all ${
                  payMode === "wallet"
                    ? "border-indigo-500/50 bg-indigo-500/10"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                {payMode === "wallet" && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500" />
                )}
                <Wallet className={`w-5 h-5 mb-2 ${payMode === "wallet" ? "text-indigo-400" : "text-gray-500"}`} />
                <p className={`text-sm font-semibold ${payMode === "wallet" ? "text-white" : "text-gray-400"}`}>Wallet</p>
                {customerToken && walletData ? (
                  <p className={`text-xs mt-0.5 font-medium ${walletCoversAll ? "text-green-400" : walletCoversPartial ? "text-yellow-400" : "text-red-400"}`}>
                    KES {walletBalance.toLocaleString()} balance
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5">Sign in to use</p>
                )}
              </button>
            </div>

            {/* Wallet status messages */}
            {payMode === "wallet" && customerToken && walletData && (
              <div className={`rounded-xl p-3 text-sm flex items-start gap-2 ${
                walletCoversAll
                  ? "bg-green-500/10 border border-green-500/20 text-green-300"
                  : walletCoversPartial
                  ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-300"
                  : "bg-red-500/10 border border-red-500/20 text-red-300"
              }`}>
                {walletCoversAll ? (
                  <><CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Your wallet covers the full amount. Payment will be instant!</span></>
                ) : walletCoversPartial ? (
                  <><Zap className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>KES {walletBalance} from wallet + KES {walletRemainder} via Paystack (hybrid payment)</span></>
                ) : (
                  <><Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Insufficient balance (KES {walletBalance}). Top up your wallet or switch to Paystack.</span></>
                )}
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={busy || (payMode === "wallet" && walletBalance === 0 && !!customerToken)}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-5 text-base"
          >
            {busy ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
            ) : payMode === "wallet" && walletCoversAll ? (
              <><Wallet className="w-4 h-4 mr-2" /> Pay KES {discountedPrice} with Wallet</>
            ) : payMode === "wallet" && walletCoversPartial ? (
              <><Zap className="w-4 h-4 mr-2" /> Pay KES {walletRemainder} via Paystack (KES {walletBalance} from wallet)</>
            ) : (
              <><CreditCard className="w-4 h-4 mr-2" /> Pay KES {discountedPrice} & Deploy</>
            )}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            Secured by Paystack · One-time payment · No recurring charges
          </p>
        </form>
      </div>
    </div>
  );
}
