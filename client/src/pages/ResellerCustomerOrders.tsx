import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Clock, Package, ShoppingBag, Store, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const [orders, setOrders] = useState<any[]>([]);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/storefront/${slug}/my-orders`, { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401) { setLocation(`/r/${slug}`); return; }
        const d = await r.json();
        if (d.success) { setOrders(d.orders); setStoreName(d.storeName); }
        else setError(d.error || "Could not load orders");
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

        {!loading && !error && orders.length === 0 && (
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
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
