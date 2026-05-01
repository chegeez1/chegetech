import { useState, useEffect, useRef } from "react";
import { Copy, Check, ChevronDown, ChevronRight, ExternalLink, Zap, Shield, User, Settings, ShoppingCart, Globe } from "lucide-react";

function useBaseUrl() {
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(window.location.origin); }, []);
  return url;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-all"
      style={{ background: copied ? "rgba(52,211,153,.15)" : "rgba(255,255,255,.07)", color: copied ? "#34d399" : "rgba(255,255,255,.4)" }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Badge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "rgba(52,211,153,.18) #34d399",
    POST: "rgba(99,102,241,.22) #818cf8",
    PATCH: "rgba(251,191,36,.18) #fbbf24",
    DELETE: "rgba(239,68,68,.18) #f87171",
  };
  const [bg, text] = (colors[method] || "rgba(255,255,255,.1) #fff").split(" ");
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0" style={{ background: bg, color: text }}>
      {method}
    </span>
  );
}

function AuthBadge({ type }: { type: "none" | "customer" | "admin" | "reseller" }) {
  const cfg = {
    none: { label: "No auth", bg: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.4)" },
    customer: { label: "Customer Key", bg: "rgba(99,102,241,.12)", color: "#a5b4fc" },
    admin: { label: "Admin Key", bg: "rgba(239,68,68,.12)", color: "#fca5a5" },
    reseller: { label: "Reseller Key", bg: "rgba(251,191,36,.12)", color: "#fde68a" },
  }[type];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: cfg.bg, color: cfg.color }}>
      <Shield className="w-2.5 h-2.5" /> {cfg.label}
    </span>
  );
}

interface Param { name: string; type: string; required?: boolean; desc: string; }
interface EndpointDef {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  auth: "none" | "customer" | "admin" | "reseller";
  desc: string;
  headers?: Param[];
  body?: Param[];
  query?: Param[];
  response: string;
}

function EndpointCard({ ep, baseUrl }: { ep: EndpointDef; baseUrl: string }) {
  const [open, setOpen] = useState(false);
  const curl = `curl -X ${ep.method} "${baseUrl}${ep.path}" \\${ep.auth !== "none" ? '\n  -H "X-API-Key: YOUR_API_KEY" \\' : ""}\n  -H "Content-Type: application/json"${ep.body ? ' \\\n  -d \'{ ... }\'' : ""}`;
  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)" }}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[.03] transition-all"
        onClick={() => setOpen(o => !o)}
      >
        <Badge method={ep.method} />
        <code className="text-sm text-white/80 font-mono flex-1">{ep.path}</code>
        <AuthBadge type={ep.auth} />
        {open ? <ChevronDown className="w-4 h-4 text-white/30 shrink-0" /> : <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <p className="text-sm text-white/50 pt-3">{ep.desc}</p>

          {ep.query && ep.query.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2">Query Parameters</p>
              <div className="space-y-1.5">
                {ep.query.map(p => (
                  <div key={p.name} className="flex gap-2 items-start">
                    <code className="text-xs text-indigo-300/70 shrink-0">{p.name}</code>
                    <span className="text-[11px] text-white/25 shrink-0">{p.type}</span>
                    {!p.required && <span className="text-[10px] text-white/20 shrink-0">optional</span>}
                    <span className="text-[11px] text-white/40">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ep.body && ep.body.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2">Request Body</p>
              <div className="space-y-1.5">
                {ep.body.map(p => (
                  <div key={p.name} className="flex gap-2 items-start">
                    <code className="text-xs text-amber-300/70 shrink-0">{p.name}</code>
                    <span className="text-[11px] text-white/25 shrink-0">{p.type}</span>
                    {p.required && <span className="text-[10px] text-red-400/60 shrink-0">required</span>}
                    <span className="text-[11px] text-white/40">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Example Response</p>
              <CopyButton text={ep.response} />
            </div>
            <pre className="text-[11px] text-emerald-300/70 rounded-lg p-3 overflow-x-auto leading-relaxed" style={{ background: "rgba(0,0,0,.35)", fontFamily: "monospace" }}>
              {ep.response}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">cURL Example</p>
              <CopyButton text={curl} />
            </div>
            <pre className="text-[11px] text-sky-300/70 rounded-lg p-3 overflow-x-auto leading-relaxed" style={{ background: "rgba(0,0,0,.35)", fontFamily: "monospace" }}>
              {curl}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

interface Section { id: string; label: string; icon: any; color: string; endpoints: EndpointDef[]; }

export default function Docs() {
  const baseUrl = useBaseUrl();
  const [activeSection, setActiveSection] = useState("public");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sections: Section[] = [
    {
      id: "public", label: "Public", icon: Globe, color: "#34d399",
      endpoints: [
        {
          id: "store-info", method: "GET", path: "/api/v1/store", auth: "none",
          desc: "Returns public store metadata: name, brand color, logo URL, and total plan count. No authentication required.",
          response: JSON.stringify({ name: "Chege Tech", supportEmail: "support@chegetech.com", whatsappNumber: "+254114291301", planCount: 12 }, null, 2),
        },
        {
          id: "plans-public", method: "GET", path: "/api/v1/plans", auth: "reseller",
          desc: "Returns all available subscription plans with pricing and stock availability. Requires a reseller API key.",
          response: JSON.stringify({ success: true, plans: [{ planId: "netflix-1m", name: "Netflix 1 Month", price: 350, category: "Netflix", categoryKey: "netflix" }] }, null, 2),
        },
      ],
    },
    {
      id: "customer", label: "Customer", icon: User, color: "#818cf8",
      endpoints: [
        {
          id: "my-profile", method: "GET", path: "/api/v1/my-profile", auth: "customer",
          desc: "Returns the authenticated customer's profile information.",
          response: JSON.stringify({ id: 42, email: "jane@example.com", name: "Jane Doe", emailVerified: true, createdAt: "2025-01-15T10:00:00.000Z" }, null, 2),
        },
        {
          id: "my-orders", method: "GET", path: "/api/v1/my-orders", auth: "customer",
          desc: "Returns all orders placed by the authenticated customer.",
          response: JSON.stringify({ count: 2, orders: [{ reference: "PS-NETFLIX-1700000000000", planName: "Netflix 1 Month", amount: 350, status: "success", createdAt: "2025-03-01T09:00:00.000Z" }] }, null, 2),
        },
        {
          id: "my-wallet", method: "GET", path: "/api/v1/my-wallet", auth: "customer",
          desc: "Returns the customer's current wallet balance and the 20 most recent wallet transactions.",
          response: JSON.stringify({ balance: 1500, transactions: [{ id: 1, type: "credit", amount: 500, description: "Top-up via Paystack", reference: "TXN-123", createdAt: "2025-03-20T12:00:00.000Z" }] }, null, 2),
        },
        {
          id: "my-subscriptions", method: "GET", path: "/api/v1/my-subscriptions", auth: "customer",
          desc: "Returns all successfully purchased subscriptions for the authenticated customer, including expiry dates where applicable.",
          response: JSON.stringify({ count: 1, subscriptions: [{ reference: "PS-NETFLIX-1700000000000", planId: "netflix-1m", planName: "Netflix 1 Month", amount: 350, purchasedAt: "2025-03-01T09:00:00.000Z", expiresAt: "2025-04-01T09:00:00.000Z" }] }, null, 2),
        },
      ],
    },
    {
      id: "admin", label: "Admin", icon: Settings, color: "#f87171",
      endpoints: [
        {
          id: "admin-stats", method: "GET", path: "/api/v1/admin/stats", auth: "admin",
          desc: "Returns platform-wide statistics: total revenue, order count, customer count, and pending orders.",
          response: JSON.stringify({ totalRevenue: 125000, totalOrders: 340, totalCustomers: 89, pendingOrders: 2 }, null, 2),
        },
        {
          id: "admin-transactions", method: "GET", path: "/api/v1/admin/transactions", auth: "admin",
          desc: "Returns all transactions across the platform, sorted newest first.",
          response: JSON.stringify({ count: 2, transactions: [{ reference: "PS-NETFLIX-1700000000000", planName: "Netflix 1 Month", customerEmail: "jane@example.com", amount: 350, status: "success", createdAt: "2025-03-01T09:00:00.000Z" }] }, null, 2),
        },
        {
          id: "admin-customers-list", method: "GET", path: "/api/v1/admin/customers", auth: "admin",
          desc: "Returns all registered customers with basic profile information.",
          response: JSON.stringify({ count: 89, customers: [{ id: 42, email: "jane@example.com", name: "Jane Doe", emailVerified: true, createdAt: "2025-01-15T10:00:00.000Z" }] }, null, 2),
        },
        {
          id: "admin-customer-detail", method: "GET", path: "/api/v1/admin/customers/:id", auth: "admin",
          desc: "Returns full details for a single customer including wallet balance, total spend, and order count.",
          response: JSON.stringify({ id: 42, email: "jane@example.com", name: "Jane Doe", suspended: false, emailVerified: true, createdAt: "2025-01-15T10:00:00.000Z", walletBalance: 1500, totalSpent: 3500, totalOrders: 10, topPlan: "Netflix 1 Month" }, null, 2),
        },
        {
          id: "admin-suspend", method: "PATCH", path: "/api/v1/admin/customers/:id/suspend", auth: "admin",
          desc: "Suspend or unsuspend a customer account. Set suspended: true to block access, false to restore.",
          body: [
            { name: "suspended", type: "boolean", required: true, desc: "true to suspend, false to unsuspend" },
          ],
          response: JSON.stringify({ success: true, id: 42, email: "jane@example.com", suspended: true }, null, 2),
        },
        {
          id: "admin-customer-wallet", method: "GET", path: "/api/v1/admin/customers/:id/wallet", auth: "admin",
          desc: "Returns the wallet balance and full transaction history for a specific customer.",
          response: JSON.stringify({ balance: 1500, transactions: [{ id: 1, type: "credit", amount: 500, description: "Admin top-up", reference: null, createdAt: "2025-03-20T12:00:00.000Z" }] }, null, 2),
        },
        {
          id: "admin-topup", method: "POST", path: "/api/v1/admin/wallet/topup", auth: "admin",
          desc: "Add funds to any customer's wallet. Useful for manual top-ups, refunds, or rewards.",
          body: [
            { name: "customerId", type: "number", required: true, desc: "The ID of the customer to top up" },
            { name: "amount", type: "number", required: true, desc: "Amount in KES to add (must be positive)" },
            { name: "description", type: "string", required: false, desc: "Optional note shown in wallet history" },
          ],
          response: JSON.stringify({ success: true, customerId: 42, amount: 500, newBalance: 2000 }, null, 2),
        },
        {
          id: "admin-order-detail", method: "GET", path: "/api/v1/admin/orders/:reference", auth: "admin",
          desc: "Returns full details of a single order by its reference code.",
          response: JSON.stringify({ order: { reference: "PS-NETFLIX-1700000000000", planName: "Netflix 1 Month", customerEmail: "jane@example.com", amount: 350, status: "success", emailSent: true, accountAssigned: true, createdAt: "2025-03-01T09:00:00.000Z" } }, null, 2),
        },
        {
          id: "admin-deliver", method: "POST", path: "/api/v1/admin/orders/:reference/deliver", auth: "admin",
          desc: "Re-sends the credentials email for a successful order. Useful if the customer did not receive their email.",
          response: JSON.stringify({ success: true, error: null }, null, 2),
        },
      ],
    },
    {
      id: "reseller", label: "Reseller", icon: ShoppingCart, color: "#fbbf24",
      endpoints: [
        {
          id: "reseller-plans", method: "GET", path: "/api/v1/plans", auth: "reseller",
          desc: "Lists all available subscription plans. Use to display products in your own storefront.",
          response: JSON.stringify({ success: true, plans: [{ planId: "netflix-1m", name: "Netflix 1 Month", price: 350, category: "Netflix", categoryKey: "netflix" }] }, null, 2),
        },
        {
          id: "reseller-orders", method: "POST", path: "/api/v1/orders", auth: "reseller",
          desc: "Places an order on behalf of a customer. Deducts from your wallet balance and immediately delivers credentials to the specified customer email.",
          body: [
            { name: "planId", type: "string", required: true, desc: "Plan ID from GET /api/v1/plans (e.g. netflix-1m)" },
            { name: "customerEmail", type: "string", required: true, desc: "Email to send the subscription credentials to" },
            { name: "customerName", type: "string", required: false, desc: "Customer's display name (optional)" },
          ],
          response: JSON.stringify({ success: true, reference: "API-NETFLIX1M-1700000000000", planName: "Netflix 1 Month", amount: 350, customerEmail: "customer@example.com", message: "Order placed and credentials sent to customer email." }, null, 2),
        },
      ],
    },
  ];

  function scrollTo(id: string) {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg,#0a0a1a 0%,#0d0f1e 50%,#0a0c18 100%)" }}>
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b" style={{ background: "rgba(10,10,26,.9)", backdropFilter: "blur(20px)", borderColor: "rgba(255,255,255,.07)" }}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(99,102,241,.25)" }}>
              <Zap className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <span className="text-sm font-bold text-white">API Reference</span>
              <span className="ml-2 text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded font-mono">v1</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <code className="text-[11px] text-white/30 font-mono hidden sm:block">{baseUrl}/api/v1/</code>
            <a href="/" className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 transition-all">
              <ExternalLink className="w-3 h-3" /> Store
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 hidden lg:block">
          <div className="sticky top-20 space-y-6">
            {/* Intro links */}
            <div className="space-y-1">
              {["overview", "authentication", "errors"].map(id => (
                <button key={id} onClick={() => scrollTo(id)}
                  className="w-full text-left text-xs px-3 py-1.5 rounded-lg capitalize transition-all"
                  style={{ color: activeSection === id ? "#fff" : "rgba(255,255,255,.35)", background: activeSection === id ? "rgba(255,255,255,.06)" : "transparent" }}>
                  {id === "overview" ? "Overview" : id === "authentication" ? "Authentication" : "Error Codes"}
                </button>
              ))}
            </div>

            {sections.map(s => (
              <div key={s.id}>
                <button onClick={() => scrollTo(s.id)}
                  className="w-full text-left flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                  style={{ color: activeSection === s.id ? s.color : "rgba(255,255,255,.45)", background: activeSection === s.id ? "rgba(255,255,255,.05)" : "transparent" }}>
                  <s.icon className="w-3.5 h-3.5" />
                  {s.label} Endpoints
                </button>
                {activeSection === s.id && (
                  <div className="mt-1 ml-5 space-y-0.5">
                    {s.endpoints.map(ep => (
                      <div key={ep.id} className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold" style={{ color: ep.method === "GET" ? "#34d399" : ep.method === "POST" ? "#818cf8" : ep.method === "PATCH" ? "#fbbf24" : "#f87171" }}>{ep.method}</span>
                        <span className="text-[11px] text-white/30 truncate">{ep.path.replace("/api/v1/", "")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-12">
          {/* Overview */}
          <div ref={el => { sectionRefs.current["overview"] = el; }}>
            <h1 className="text-2xl font-bold text-white mb-2">API Reference</h1>
            <p className="text-sm text-white/50 mb-6 max-w-2xl">
              The Chege Tech REST API lets you integrate your store programmatically. Access customer data,
              manage orders, top up wallets, and build your own storefront using reseller keys — all over HTTPS.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              {[
                { label: "Base URL", value: `${baseUrl}/api/v1`, mono: true },
                { label: "Auth Header", value: "X-API-Key", mono: true },
                { label: "Response Format", value: "JSON", mono: false },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{item.label}</p>
                  <p className={`text-sm text-white/80 ${item.mono ? "font-mono" : ""}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Authentication */}
          <div ref={el => { sectionRefs.current["authentication"] = el; }}>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" /> Authentication
            </h2>
            <div className="p-4 rounded-xl mb-4 space-y-3" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
              <p className="text-sm text-white/60">
                All protected endpoints require an API key passed in the <code className="text-indigo-300 bg-white/5 px-1 rounded">X-API-Key</code> HTTP header.
                There are three key types with different access levels:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { type: "Customer Key", color: "#a5b4fc", bg: "rgba(99,102,241,.1)", desc: "Access your own profile, orders, wallet, and subscriptions. Get yours in Dashboard → API Keys." },
                  { type: "Admin Key", color: "#fca5a5", bg: "rgba(239,68,68,.1)", desc: "Full access to all customers, orders, and wallet management. Generated by the super admin." },
                  { type: "Reseller Key", color: "#fde68a", bg: "rgba(251,191,36,.1)", desc: "Place orders on behalf of customers using your wallet balance. Available to reseller accounts." },
                ].map(k => (
                  <div key={k.type} className="p-3 rounded-lg" style={{ background: k.bg }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: k.color }}>{k.type}</p>
                    <p className="text-[11px] text-white/40">{k.desc}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] text-white/30">Example request header</p>
                  <CopyButton text='curl -H "X-API-Key: sk_live_your_api_key_here" https://yourdomain.com/api/v1/my-profile' />
                </div>
                <pre className="text-[11px] text-sky-300/70 rounded-lg p-3" style={{ background: "rgba(0,0,0,.35)", fontFamily: "monospace" }}>
{`curl -H "X-API-Key: sk_live_your_api_key_here" \\
  "${baseUrl}/api/v1/my-profile"`}
                </pre>
              </div>
            </div>
          </div>

          {/* Error Codes */}
          <div ref={el => { sectionRefs.current["errors"] = el; }}>
            <h2 className="text-lg font-bold text-white mb-4">Error Codes</h2>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,.07)" }}>
              {[
                { code: "200", label: "OK", desc: "Request succeeded" },
                { code: "400", label: "Bad Request", desc: "Missing or invalid parameters in the request body" },
                { code: "401", label: "Unauthorized", desc: "Missing or invalid API key" },
                { code: "402", label: "Payment Required", desc: "Insufficient wallet balance (reseller orders)" },
                { code: "403", label: "Forbidden", desc: "Wrong key type (e.g. customer key on admin route)" },
                { code: "404", label: "Not Found", desc: "The requested resource does not exist" },
                { code: "500", label: "Server Error", desc: "Unexpected server error — check response body for details" },
              ].map((row, i) => (
                <div key={row.code} className="flex items-center gap-4 px-4 py-2.5 text-sm"
                  style={{ background: i % 2 === 0 ? "rgba(255,255,255,.02)" : "transparent", borderBottom: i < 6 ? "1px solid rgba(255,255,255,.04)" : "none" }}>
                  <code className="w-10 font-mono font-bold text-xs shrink-0"
                    style={{ color: row.code.startsWith("2") ? "#34d399" : row.code.startsWith("4") ? "#fbbf24" : "#f87171" }}>
                    {row.code}
                  </code>
                  <span className="w-36 text-xs text-white/60 shrink-0">{row.label}</span>
                  <span className="text-xs text-white/35">{row.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Endpoint Sections */}
          {sections.map(section => (
            <div key={section.id} ref={el => { sectionRefs.current[section.id] = el; }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${section.color}18` }}>
                  <section.icon className="w-3.5 h-3.5" style={{ color: section.color }} />
                </div>
                <h2 className="text-lg font-bold text-white">{section.label} Endpoints</h2>
                <span className="text-[11px] text-white/25 ml-1">{section.endpoints.length} endpoint{section.endpoints.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {section.endpoints.map(ep => (
                  <EndpointCard key={ep.id} ep={ep} baseUrl={baseUrl} />
                ))}
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="pt-8 pb-12 text-center">
            <p className="text-xs text-white/20">Chege Tech REST API v1 · All rights reserved</p>
          </div>
        </main>
      </div>
    </div>
  );
}
