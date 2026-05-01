import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Package, CheckCircle2, Clock, XCircle, Mail, ShieldCheck, ArrowRight, Loader2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BG = { background: "linear-gradient(140deg, #0b1020, #0d0724)" };
const CARD = "bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm";

function statusMeta(status: string) {
  switch (status) {
    case "success":
      return { label: "Payment confirmed", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", Icon: CheckCircle2 };
    case "pending":
      return { label: "Payment pending", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30", Icon: Clock };
    case "failed":
    case "cancelled":
      return { label: status === "cancelled" ? "Cancelled" : "Payment failed", color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", Icon: XCircle };
    default:
      return { label: status, color: "text-white/50", bg: "bg-white/5 border-white/10", Icon: Clock };
  }
}

export default function Track() {
  const [, setLocation] = useLocation();
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<any>(null);

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    const ref = reference.trim();
    const em  = email.trim();
    if (!ref || !em) { setError("Both fields are required"); return; }

    setLoading(true);
    setError("");
    setOrder(null);

    try {
      const res  = await fetch(`/api/track?reference=${encodeURIComponent(ref)}&email=${encodeURIComponent(em)}`);
      const data = await res.json();
      if (data.success) {
        setOrder(data.order);
      } else {
        setError(data.error || "Order not found");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() { setOrder(null); setError(""); }

  const inputCls = "bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-indigo-500/60 focus:ring-indigo-500/20 h-11 rounded-xl";

  return (
    <div className="min-h-screen flex flex-col" style={BG}>
      {/* Nav */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <Home className="w-4 h-4" />
          <span>Back to store</span>
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span className="text-white/50 text-xs">Secure order tracking</span>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center pt-16 px-4 pb-16">
        <div className="w-full max-w-md space-y-6">

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
              <Package className="w-7 h-7 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Track your order</h1>
            <p className="text-white/45 text-sm">Enter your order reference and email address — no login needed</p>
          </div>

          {/* Form */}
          {!order && (
            <form onSubmit={handleTrack} className={`${CARD} p-6 space-y-4`}>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50 font-medium uppercase tracking-wider">Order reference</label>
                <Input
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="e.g. REF-XXXXXXXX"
                  className={inputCls}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-[11px] text-white/30">Found in your confirmation email subject line</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-white/50 font-medium uppercase tracking-wider">Email address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="The email you used to order"
                  className={inputCls}
                  autoComplete="email"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 rounded-xl p-3">
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 border-0 text-white font-semibold rounded-xl gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Looking up order…</>
                ) : (
                  <><Search className="w-4 h-4" />Track order</>
                )}
              </Button>
            </form>
          )}

          {/* Result card */}
          {order && (() => {
            const { label, color, bg, Icon } = statusMeta(order.status);
            const delivered = order.status === "success" && (order.accountAssigned || order.emailSent);
            const date = order.createdAt ? new Date(order.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";

            return (
              <div className="space-y-4">
                {/* Status banner */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bg}`}>
                  <Icon className={`w-5 h-5 ${color} shrink-0`} />
                  <div>
                    <p className={`font-semibold text-sm ${color}`}>{label}</p>
                    <p className="text-white/40 text-xs">Updated in real-time</p>
                  </div>
                </div>

                {/* Order details */}
                <div className={`${CARD} p-5 space-y-4`}>
                  <h2 className="text-white font-semibold text-base">Order details</h2>

                  <div className="space-y-3 text-sm">
                    <Row label="Reference"    value={<span className="font-mono text-indigo-300 text-xs">{order.reference}</span>} />
                    <Row label="Plan"         value={order.planName} />
                    <Row label="Amount paid"  value={`KES ${(order.amount || 0).toLocaleString()}`} />
                    <Row label="Date"         value={date} />
                  </div>

                  <div className="border-t border-white/8 pt-4 space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Delivery status</p>
                    {order.status !== "success" ? (
                      <div className="flex items-center gap-2 text-amber-400/80 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>Awaiting payment confirmation</span>
                      </div>
                    ) : delivered ? (
                      <div className="flex items-center gap-2 text-emerald-400 text-sm">
                        <Mail className="w-4 h-4" />
                        <span>Account credentials sent to your email</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-400/80 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>Credentials being prepared — usually within minutes</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => setLocation("/auth")}
                    className="w-full h-10 bg-white/8 hover:bg-white/12 border border-white/10 text-white/80 rounded-xl gap-2 text-sm"
                  >
                    Sign in to view full order history
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                  <button
                    onClick={reset}
                    className="text-xs text-white/35 hover:text-white/60 transition-colors py-1"
                  >
                    Track a different order
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className="text-white text-right">{value}</span>
    </div>
  );
}
