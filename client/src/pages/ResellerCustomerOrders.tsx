import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Bot, CheckCircle2, Clock, Copy, Eye, KeyRound, Package, ShoppingBag, Store, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function money(v: number) { return `KES ${(v || 0).toLocaleString()}`; }

function statusMeta(status: string) {
  switch (status) {
    case "success": return { label: "Delivered", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", Icon: CheckCircle2 };
    case "pending": return { label: "Pending", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/25", Icon: Clock };
    default:        return { label: "Failed",   color: "text-red-400",    bg: "bg-red-500/10 border-red-500/25",     Icon: XCircle };
  }
}

export default function ResellerCustomerOrders() {
  const [, params] = useRoute("/r/:slug/orders");
  const [, setLocation] = useLocation();
  const slug = params?.slug || "";
  const { toast } = useToast();

  const [orders, setOrders] = useState<any[]>([]);
  const [botOrders, setBotOrders] = useState<any[]>([]);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Credentials modal ─────────────────────────────────────────────────────
  const [credModal, setCredModal] = useState<{ reference: string; account: any } | null>(null);
  const [credsLoading, setCredsLoading] = useState<string | null>(null); // reference being loaded

  async function viewCredentials(reference: string) {
    setCredsLoading(reference);
    try {
      const res = await fetch(`/api/customer/orders/${reference}/credentials`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not load credentials");
      setCredModal({ reference, account: data.account });
    } catch (err: any) {
      toast({ title: "Failed to load credentials", description: err.message, variant: "destructive" });
    } finally {
      setCredsLoading(null);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() =>
      toast({ title: `${label} copied!` })
    ).catch(() => toast({ title: "Copy failed", variant: "destructive" }));
  }

  useEffect(() => {
    if (!slug) return;
    // Load plan orders + bot orders in parallel
    Promise.all([
      fetch(`/api/storefront/${slug}/my-orders`, { credentials: "include" }),
      fetch(`/api/storefront/${slug}/my-bot-orders`, { credentials: "include" }),
    ])
      .then(async ([planRes, botRes]) => {
        if (planRes.status === 401) { setLocation(`/r/${slug}`); return; }
        const planData = await planRes.json();
        if (planData.success) { setOrders(planData.orders); setStoreName(planData.storeName); }
        else setError(planData.error || "Could not load orders");
        if (botRes.ok) {
          const botData = await botRes.json();
          if (botData.success) setBotOrders(botData.orders || []);
        }
      })
      .catch(() => setError("Connection error"))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-gray-950">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-black leading-tight">{storeName || "My Orders"}</h1>
              <p className="text-xs text-white/35">Order history</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-white text-xs"
            onClick={() => setLocation(`/r/${slug}`)}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to store
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
            <XCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {!loading && !error && orders.length === 0 && botOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
              <ShoppingBag className="h-8 w-8 text-white/25" />
            </div>
            <h2 className="text-xl font-black">No orders yet</h2>
            <p className="text-sm text-white/45 max-w-xs">
              You haven't placed any orders through this store. Head back and pick a plan!
            </p>
            <Button
              onClick={() => setLocation(`/r/${slug}`)}
              className="mt-2 bg-emerald-500 text-gray-950 hover:bg-emerald-400"
            >
              Browse plans
            </Button>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black mb-6">
              {orders.length} order{orders.length !== 1 ? "s" : ""}
            </h2>
            {orders.map((order: any) => {
              const { label, color, bg, Icon } = statusMeta(order.status);
              return (
                <div
                  key={order.reference}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                        <Package className="h-4.5 w-4.5 text-emerald-300" />
                      </div>
                      <div>
                        <p className="font-bold leading-tight">{order.planName || "Order"}</p>
                        <p className="mt-0.5 text-xs text-white/40 font-mono">{order.reference}</p>
                        {order.createdAt && (
                          <p className="mt-1 text-xs text-white/35">
                            {new Date(order.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-bold">{money(order.amount || 0)}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${bg} ${color}`}>
                        <Icon className="h-3 w-3" /> {label}
                      </span>
                    </div>
                  </div>
                  {order.status === "success" && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs h-8"
                        disabled={credsLoading === order.reference}
                        onClick={() => viewCredentials(order.reference)}
                      >
                        {credsLoading === order.reference ? (
                          <span className="h-3 w-3 mr-1.5 animate-spin rounded-full border border-emerald-400 border-t-transparent inline-block" />
                        ) : (
                          <Eye className="h-3 w-3 mr-1.5" />
                        )}
                        View credentials
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Credentials modal ──────────────────────────────────────────── */}
      {credModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
                  <KeyRound className="h-4 w-4 text-emerald-300" />
                </div>
                <h3 className="font-black text-base">Your credentials</h3>
              </div>
              <button
                onClick={() => setCredModal(null)}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { label: "Email", value: credModal.account.email },
                { label: "Password", value: credModal.account.password },
                { label: "Username", value: credModal.account.username },
                { label: "Activation code", value: credModal.account.activationCode },
                { label: "Redeem link", value: credModal.account.redeemLink },
                { label: "Instructions", value: credModal.account.instructions },
              ]
                .filter((f) => f.value)
                .map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-white/[0.04] border border-white/8 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase text-white/35 mb-1">{label}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-mono text-white/90 break-all leading-snug">{value}</p>
                      <button
                        onClick={() => copyToClipboard(value, label)}
                        className="flex-shrink-0 rounded-md p-1.5 text-white/30 hover:bg-white/10 hover:text-white transition"
                        title={`Copy ${label}`}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            <p className="mt-4 text-center text-xs text-white/25">
              Keep these credentials safe. Don't share them.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
