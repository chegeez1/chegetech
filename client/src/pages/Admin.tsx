import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import React, { useState, useEffect, useRef, useCallback, Component } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import {
  LayoutDashboard, Package, ArrowLeftRight, Tags,
  LogOut, TrendingUp, CheckCircle, Clock, XCircle, Mail,
  Plus, Trash2, Edit2, Eye, EyeOff, RefreshCw, Users,
  Shield, QrCode, Key, Power, ChevronDown, ChevronUp,
  Save, X, BadgePercent, Star, RotateCcw, Zap, Settings,
  CreditCard, AlertTriangle, Lock, Unlock, Copy, Activity,
  Terminal, Info, TriangleAlert, Filter, Upload, Download,
  Search, BarChart2, Loader2, FileCheck, ClipboardCheck, Send,
  MessageCircle, Globe, Server, RotateCw, Play, MapPin, Ban,
  Wifi, HardDrive, Cpu, MemoryStick, Link2, ExternalLink, CheckCircle2, Camera,
  Bot, Sparkles, Minimize2, Database, UserCircle, Wallet, Pencil,
  MinusCircle, History, ArrowUpCircle, ArrowDownCircle, Bell, ShoppingBag, MessageSquare, Gift
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

type Tab = "dashboard" | "analytics" | "plans" | "accounts" | "promos" | "transactions" | "apikeys" | "customers" | "ratings" | "feature-requests" | "emailblast" | "campaigns" | "logs" | "settings" | "support" | "subadmins" | "super-admins" | "geo-restrict" | "vps" | "vps-sales" | "domains" | "funnel" | "groups" | "flash-sales" | "whatsapp" | "bot-store" | "bot-orders" | "smm-orders" | "proxy-plans" | "proxy-orders" | "digital-products" | "digital-orders" | "free-proxies" | "gift-cards" | "gc-orders" | "sms-plans" | "sms-orders" | "cc-checker" | "email-gen" | "chegebot-subs" | "downloader";

class SettingsErrorBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e: any) { return { error: e?.message || "Unknown error" }; }
  componentDidCatch(e: any, info: any) { console.error("[Settings crash]", e, info); }
  render() {
    if (this.state.error) return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/25 space-y-3">
        <p className="text-red-400 font-semibold">Settings failed to load</p>
        <p className="text-red-300/70 text-sm font-mono break-all">{this.state.error}</p>
        <button onClick={() => this.setState({ error: null })}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-300 transition-colors">
          Retry
        </button>
      </div>
    );
    return this.props.children;
  }
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  success: { label: "Completed", icon: CheckCircle, color: "text-emerald-400" },
  pending: { label: "Pending", icon: Clock, color: "text-amber-400" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-400" },
};

function getToken() { return localStorage.getItem("admin_token"); }
function setToken(t: string) { localStorage.setItem("admin_token", t); }
function clearToken() { localStorage.removeItem("admin_token"); }
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// Module-level callback so authFetch can trigger graceful logout without reloading
let _onSessionExpired: (() => void) | null = null;
function registerSessionExpiredHandler(fn: () => void) { _onSessionExpired = fn; }

// authFetch: for authenticated admin API calls (graceful logout on 401)
async function authFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) } as HeadersInit,
  });
  if (res.status === 401) {
    clearToken();
    if (_onSessionExpired) _onSessionExpired();
    else window.location.reload();
    return {};
  }
  return res.json();
}

// plainFetch: for login and pre-auth flows (never auto-logout)
async function plainFetch(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// MAIN ADMIN
// ═══════════════════════════════════════════════════════════════
const SENSITIVE_TABS: Tab[] = ["settings", "subadmins"];

// ─── Analytics Tab ─────────────────────────────────────────────────────────
function AnalyticsTab() {
  const { toast } = useToast();
  const [range, setRange] = useState<"7"|"14"|"30">("30");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/analytics"],
    queryFn: () => authFetch("/api/admin/analytics"),
    staleTime: 60000,
  });

  const days: any[] = data?.days ?? [];
  const filtered = range === "30" ? days : range === "14" ? days.slice(-14) : days.slice(-7);

  const totalRevenue = filtered.reduce((s: number, d: any) => s + (d.revenue || 0), 0);
  const totalOrders = filtered.reduce((s: number, d: any) => s + (d.orders || 0), 0);
  const totalBots = filtered.reduce((s: number, d: any) => s + (d.botRevenue || 0), 0);
  const avgPerDay = filtered.length ? Math.round(totalRevenue / filtered.length) : 0;

  const chartData = filtered.map((d: any) => ({
    date: d.date?.slice(5) ?? "",
    Revenue: d.revenue || 0,
    Subscriptions: (d.revenue || 0) - (d.botRevenue || 0),
    Bots: d.botRevenue || 0,
    Orders: d.orders || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Revenue Analytics</h1>
          <p className="text-xs text-white/40 mt-0.5">Track daily revenue and order trends</p>
        </div>
        <div className="flex gap-1">
          {(["7","14","30"] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${range === r ? "bg-indigo-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Revenue", value: `KES ${totalRevenue.toLocaleString()}`, color: "from-indigo-600 to-violet-600" },
          { label: "Total Orders", value: totalOrders.toLocaleString(), color: "from-emerald-600 to-teal-600" },
          { label: "Bot Revenue", value: `KES ${totalBots.toLocaleString()}`, color: "from-blue-600 to-cyan-600" },
          { label: "Avg / Day", value: `KES ${avgPerDay.toLocaleString()}`, color: "from-orange-600 to-amber-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4 border border-white/8 bg-white/3">
            <p className="text-xs text-white/40 mb-1">{label}</p>
            <p className={`text-xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Daily Revenue (KES)</h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorSub" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorBot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1e1b4b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }} />
              <Area type="monotone" dataKey="Subscriptions" stroke="#6366f1" strokeWidth={2} fill="url(#colorSub)" />
              <Area type="monotone" dataKey="Bots" stroke="#10b981" strokeWidth={2} fill="url(#colorBot)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Orders Bar Chart */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Daily Orders</h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1e1b4b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontSize: "12px" }} />
              <Bar dataKey="Orders" fill="#6366f1" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [adminRole, setAdminRole] = useState<"super" | "subadmin" | null>(null);
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [adminProfile, setAdminProfile] = useState<{ name: string; avatar: string; email: string } | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    registerSessionExpiredHandler(() => {
      setTokenState(null);
      setAdminRole(null);
      setAdminPermissions([]);
      setAdminProfile(null);
    });
  }, []);

  useEffect(() => {
    if (token) {
      authFetch("/api/admin/me").then((d) => {
        if (d.success) {
          setAdminRole(d.role);
          if (d.role === "super") setIsPrimary(d.isPrimary === true);
          if (d.role === "subadmin") setAdminPermissions(d.permissions || []);
        }
      }).catch(() => {});
      authFetch("/api/admin/profile").then((d) => {
        if (d.success) setAdminProfile({ name: d.name, avatar: d.avatar, email: d.email });
      }).catch(() => {});
    }
  }, [token]);

  function login(t: string, role?: string) {
    setToken(t);
    setTokenState(t);
    if (role === "subadmin") setAdminRole("subadmin");
    else setAdminRole("super");
  }
  function logout() { clearToken(); setTokenState(null); setAdminRole(null); setAdminPermissions([]); }

  if (!token) return <LoginFlow onLogin={login} />;

  const allTabs: { id: Tab; label: string; icon: any; superOnly?: boolean; alwaysVisible?: boolean }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "plans", label: "Plans & Offers", icon: Tags },
    { id: "accounts", label: "Accounts", icon: Package },
    { id: "promos", label: "Promo Codes", icon: BadgePercent },
    { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
    { id: "apikeys", label: "API Keys", icon: Key },
    { id: "customers", label: "Customers", icon: Users },
    { id: "groups", label: "Customer Groups", icon: Tags },
    { id: "funnel", label: "Conversion Funnel", icon: TrendingUp },
    { id: "flash-sales", label: "Flash Sales", icon: Zap },
    { id: "ratings", label: "Ratings", icon: Star },
    { id: "feature-requests", label: "Feature Requests", icon: Sparkles },
    { id: "emailblast", label: "Email Blast", icon: Send },
    { id: "campaigns", label: "Campaigns", icon: Send },
    { id: "support", label: "Support", icon: MessageCircle },
    { id: "whatsapp", label: "WhatsApp Bot", icon: MessageCircle, alwaysVisible: true },
    { id: "bot-store", label: "Bot Store", icon: Bot, alwaysVisible: true },
    { id: "bot-orders", label: "Bot Orders", icon: Package, alwaysVisible: true },
    { id: "smm-orders", label: "SMM Orders", icon: TrendingUp, alwaysVisible: true },
    { id: "proxy-plans", label: "Proxy Plans", icon: Shield, alwaysVisible: true },
    { id: "proxy-orders", label: "Proxy Orders", icon: Shield, alwaysVisible: true },
    { id: "digital-products", label: "Aged Accounts", icon: Users, alwaysVisible: true },
    { id: "digital-orders", label: "Acct Orders", icon: Users, alwaysVisible: true },
    { id: "free-proxies", label: "Free Proxies", icon: Shield, alwaysVisible: true },
    { id: "gift-cards", label: "Gift Cards", icon: Gift, alwaysVisible: true },
    { id: "gc-orders", label: "GC Orders", icon: Gift, alwaysVisible: true },
    { id: "sms-plans", label: "SMS Plans", icon: MessageSquare, alwaysVisible: true },
    { id: "sms-orders", label: "SMS Orders", icon: MessageSquare, alwaysVisible: true },
    { id: "cc-checker", label: "CC Checker", icon: CreditCard, alwaysVisible: true },
    { id: "email-gen", label: "Email Generator", icon: Mail, alwaysVisible: true },
    { id: "chegebot-subs", label: "ChegeBot Pro", icon: Zap, alwaysVisible: true },
    { id: "downloader", label: "Downloader", icon: Download, alwaysVisible: true },
    { id: "logs", label: "Activity Logs", icon: Activity },
    { id: "subadmins", label: "Sub-Admins", icon: Users, superOnly: true },
    { id: "super-admins", label: "Super Admins", icon: Shield, superOnly: true },
    { id: "geo-restrict", label: "Geo Restrict", icon: Globe, superOnly: true },
    { id: "vps", label: "VPS Manager", icon: Server, superOnly: true },
    { id: "vps-sales", label: "VPS Sales", icon: ShoppingBag },
    { id: "domains", label: "Domains", icon: Link2, superOnly: true },
    { id: "settings", label: "Settings", icon: Settings, superOnly: true },
  ];

  const visibleTabs = allTabs.filter(tab => {
    if (tab.alwaysVisible) return true;
    if (tab.id === "super-admins") return adminRole === "super" && isPrimary;
    if (adminRole === "super") return true;
    if (tab.superOnly) return false;
    if (adminPermissions.length === 0) return false;
    return adminPermissions.includes(tab.id);
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background relative">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="bg-orb w-[500px] h-[500px] bg-indigo-600 top-[-150px] left-[-100px]" style={{ opacity: 0.3 }} />
        <div className="bg-orb w-[400px] h-[400px] bg-violet-700 bottom-[-100px] right-[-80px]" style={{ opacity: 0.25 }} />
      </div>

      {/* Sidebar */}
      <aside className="relative z-10 w-56 shrink-0 glass-nav border-r border-white/8 flex flex-col">
        {/* Brand */}
        <div className="p-4 border-b border-white/8 flex items-center gap-2.5">
          <img src="/favicon.svg" alt="Chege Tech" className="w-8 h-8 rounded-xl shadow-lg" style={{ boxShadow: "0 0 14px rgba(99,102,241,0.4)" }} />
          <p className="font-bold text-sm text-white tracking-tight">Chege Tech</p>
        </div>
        {/* Admin Profile Card */}
        <button
          onClick={() => setActiveTab("settings")}
          className="p-3 border-b border-white/8 flex items-center gap-3 hover:bg-white/5 transition-all text-left group"
          title="Edit profile"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg">
            {adminProfile?.avatar || (adminRole === "subadmin" ? "SA" : "CT")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{adminProfile?.name || (adminRole === "subadmin" ? "Sub-Admin" : "Super Admin")}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${adminRole === "subadmin" ? "bg-blue-500/20 text-blue-300" : "bg-violet-500/20 text-violet-300"}`}>
                {adminRole === "subadmin" ? "Sub-Admin" : "Super Admin"}
              </span>
            </div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </button>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleTabs.map(({ id, label, icon: Icon }) => {
            const isWA = id === "whatsapp";
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                data-testid={`nav-${id}`}
                onClick={() => setActiveTab(id as Tab)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive && isWA
                    ? "text-white shadow-lg border"
                    : isActive
                    ? "bg-gradient-to-r from-indigo-600/80 to-violet-600/80 text-white shadow-lg border border-white/10"
                    : isWA
                    ? "hover:bg-white/5"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
                style={isWA && isActive
                  ? { background: "linear-gradient(135deg,rgba(18,140,126,.7),rgba(37,211,102,.5))", borderColor: "rgba(37,211,102,.3)" }
                  : isWA && !isActive
                  ? { color: "#25D366" }
                  : {}}
              >
                {isWA ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                  </svg>
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                {label}
                {id === "support" && <SupportBadgeCount />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/8 space-y-1">
          <button
            onClick={() => setLocation("/")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all"
            data-testid="button-view-store"
          >
            <Zap className="w-4 h-4" />View Store
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="p-6">
          {activeTab === "dashboard" && <DashboardTab />}
          {activeTab === "analytics" && <AnalyticsTab />}
          {activeTab === "plans" && <PlansTab />}
          {activeTab === "accounts" && <AccountsTab />}
          {activeTab === "promos" && <PromosTab />}
          {activeTab === "transactions" && <TransactionsTab />}
          {activeTab === "apikeys" && <ApiKeysTab />}
          {activeTab === "customers" && <CustomersTab />}
          {activeTab === "groups" && <CustomerGroupsTab />}
          {activeTab === "funnel" && <ConversionFunnelTab />}
          {activeTab === "flash-sales" && <FlashSalesTab />}
          {activeTab === "ratings" && <RatingsTab />}
          {activeTab === "feature-requests" && <FeatureRequestsAdminTab />}
          {activeTab === "emailblast" && <EmailBlastTab />}
          {activeTab === "campaigns" && <CampaignsTab />}
          {activeTab === "support" && <SupportTab />}
          {activeTab === "logs" && <LogsTab />}
          {activeTab === "whatsapp" && <WhatsAppTab />}
          {activeTab === "bot-store" && <BotStoreAdminTab />}
          {activeTab === "bot-orders" && <BotOrdersAdminTab />}
          {activeTab === "smm-orders" && <SmmOrdersAdminTab />}
          {activeTab === "proxy-plans" && <ProxyPlansAdminTab />}
          {activeTab === "proxy-orders" && <ProxyOrdersAdminTab />}
          {activeTab === "digital-products" && <DigitalProductsAdminTab />}
          {activeTab === "digital-orders" && <DigitalOrdersAdminTab />}
          {activeTab === "free-proxies" && <FreeProxiesAdminTab />}
          {activeTab === "gift-cards" && <GiftCardsAdminTab />}
          {activeTab === "gc-orders" && <GiftCardOrdersAdminTab />}
          {activeTab === "sms-plans" && <SmsPlansAdminTab />}
          {activeTab === "sms-orders" && <SmsOrdersAdminTab />}
          {activeTab === "cc-checker" && <BulkCcCheckerAdminTab />}
          {activeTab === "email-gen" && <EmailGenAdminTab />}
          {activeTab === "chegebot-subs" && <ChegeBotSubsAdminTab />}
          {activeTab === "downloader" && <DownloaderAdminTab />}
          {activeTab === "subadmins" && adminRole === "super" && <SubAdminsTab />}
          {activeTab === "super-admins" && adminRole === "super" && isPrimary && <SuperAdminsTab />}
          {activeTab === "geo-restrict" && adminRole === "super" && <GeoRestrictTab />}
          {activeTab === "vps" && adminRole === "super" && <VpsTab />}
          {activeTab === "vps-sales" && <VpsSellerTab />}
          {activeTab === "domains" && adminRole === "super" && <DomainsTab />}
          {activeTab === "settings" && adminRole === "super" && <SettingsErrorBoundary><SettingsTab /></SettingsErrorBoundary>}
        </div>
      </main>

      {/* Floating Admin AI Bot */}
      <AdminMonitorBot />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADMIN AI BOT
// ═══════════════════════════════════════════════════════════════

type BotMessage = { role: "user" | "bot"; content: string; ts: number; isAuto?: boolean };

const QUICK_CMDS = [
  { label: "📊 Stats", cmd: "stats" },
  { label: "📦 Orders", cmd: "orders" },
  { label: "⏳ Pending", cmd: "pending orders" },
  { label: "👥 Customers", cmd: "customers" },
  { label: "🗄️ Stock", cmd: "stock" },
  { label: "⚠️ Expiring", cmd: "expiring 7 days" },
  { label: "💹 Revenue", cmd: "revenue breakdown" },
  { label: "🏷️ Promos", cmd: "promo codes" },
  { label: "💰 Top-up", cmd: "topup customer@email.com 30" },
  { label: "🎁 Mass top-up", cmd: "topup all 10" },
  { label: "🔥 Flash Sales", cmd: "flash sales" },
  { label: "👥 Groups", cmd: "groups" },
  { label: "📈 Funnel", cmd: "funnel" },
  { label: "🚫 Ban", cmd: "ban customer@email.com spam" },
  { label: "✅ Unban", cmd: "unban customer@email.com" },
  { label: "🔁 Resend", cmd: "resend customer@email.com" },
  { label: "💳 Wallets", cmd: "wallets" },
  { label: "📉 Deduct", cmd: "deduct customer@email.com 50 reason" },
  { label: "📊 Wallet", cmd: "wallet customer@email.com" },
  { label: "🎯 Referrals", cmd: "referrals" },
  { label: "❓ Help", cmd: "help" },
];

function renderBotText(text: string) {
  return text.split("\n").map((line, i) => {
    const html = line
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.*?)`/g, "<code style='background:rgba(99,102,241,0.2);padding:1px 5px;border-radius:3px;font-size:10px;color:#a5b4fc'>$1</code>");
    const isBullet = /^[-•*]\s/.test(line) || /^\d+\.\s/.test(line);
    return (
      <p key={i} className={`${isBullet ? "ml-3" : ""} ${i < text.split("\n").length - 1 ? "mb-0.5" : ""}`}
        dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }} />
    );
  });
}

type ThreatItem = {
  id: string; severity: "critical"|"high"|"medium"|"low";
  type: string; email: string; description: string; detail: string; canBan: boolean;
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-500/15 border-red-500/30 text-red-400",
  high:     "bg-orange-500/15 border-orange-500/30 text-orange-400",
  medium:   "bg-yellow-500/15 border-yellow-500/25 text-yellow-400",
  low:      "bg-blue-500/10 border-blue-500/20 text-blue-400",
};
const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500 text-white",
  high:     "bg-orange-500 text-white",
  medium:   "bg-yellow-500 text-black",
  low:      "bg-blue-500 text-white",
};

function AdminMonitorBot() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"monitor"|"security"|"auto">("monitor");
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  // Bot running state — persisted so it survives page refresh
  const [botRunning, setBotRunning] = useState(() => localStorage.getItem("chege_bot_running") === "true");
  // Security / protection mode
  const [scanning, setScanning] = useState(false);
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [banningEmail, setBanningEmail] = useState<string | null>(null);
  const [bannedEmails, setBannedEmails] = useState<Set<string>>(new Set());
  // Auto-fix log
  const [autoActions, setAutoActions] = useState<any[]>([]);
  const [autoLogLoading, setAutoLogLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const monitorPoll = useRef<ReturnType<typeof setInterval> | null>(null);
  const securityPoll = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoLogPoll = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchStatus(silent = false) {
    try {
      const res = await authFetch("/api/admin/bot/status");
      if (res.success) {
        const botMsg: BotMessage = { role: "bot", content: res.response, ts: Date.now(), isAuto: true };
        setMessages(prev => [botMsg, ...prev.filter(m => !m.isAuto)]);
        setLastRefresh(new Date());
        const n = (res.response.match(/🚨|⚠️|⏳|🔴|🟡/g) || []).length;
        if (!open) setAlerts(n);
      }
    } catch { /* silent */ }
  }

  async function runScan() {
    setScanning(true);
    try {
      const res = await authFetch("/api/admin/bot/scan");
      if (res.success) {
        setThreats(res.threats || []);
        setLastScan(new Date());
        const critical = (res.threats || []).filter((t: ThreatItem) => t.severity === "critical" || t.severity === "high").length;
        if (!open && critical > 0) setAlerts(prev => Math.max(prev, critical));
      }
    } catch { /* silent */ }
    finally { setScanning(false); }
  }

  async function fetchAutoLog() {
    setAutoLogLoading(true);
    try {
      const res = await authFetch("/api/admin/bot/autolog");
      if (res.success) setAutoActions(res.actions || []);
    } catch {}
    finally { setAutoLogLoading(false); }
  }

  // Persist botRunning to localStorage
  useEffect(() => {
    localStorage.setItem("chege_bot_running", String(botRunning));
    if (!botRunning) {
      if (monitorPoll.current) clearInterval(monitorPoll.current);
      if (securityPoll.current) clearInterval(securityPoll.current);
      if (autoLogPoll.current) clearInterval(autoLogPoll.current);
    }
  }, [botRunning]);

  function startBot() {
    setBotRunning(true);
    fetchStatus(false);
    runScan();
    fetchAutoLog();
    setMessages([]);
  }
  function stopBot() {
    setBotRunning(false);
    setMessages([]);
    setThreats([]);
    setAutoActions([]);
    setLastRefresh(null);
    setLastScan(null);
  }

  // Polling when panel is open AND bot is running
  useEffect(() => {
    if (open && botRunning) {
      setAlerts(0);
      fetchStatus(false);
      runScan();
      fetchAutoLog();
      setTimeout(() => inputRef.current?.focus(), 150);
      monitorPoll.current = setInterval(() => fetchStatus(true), 30000);
      securityPoll.current = setInterval(runScan, 60000);
      autoLogPoll.current = setInterval(fetchAutoLog, 30000);
    } else {
      if (monitorPoll.current) clearInterval(monitorPoll.current);
      if (securityPoll.current) clearInterval(securityPoll.current);
      if (autoLogPoll.current) clearInterval(autoLogPoll.current);
    }
    return () => {
      if (monitorPoll.current) clearInterval(monitorPoll.current);
      if (securityPoll.current) clearInterval(securityPoll.current);
      if (autoLogPoll.current) clearInterval(autoLogPoll.current);
    };
  }, [open, botRunning]);

  // Background poll every 60s (only when bot is running and panel is closed)
  useEffect(() => {
    if (!botRunning) return;
    const bg = setInterval(() => { if (!open) fetchStatus(true); }, 60000);
    return () => clearInterval(bg);
  }, [open, botRunning]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg, ts: Date.now() }]);
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/ai-assistant", { method: "POST", body: JSON.stringify({ message: msg }) });
      setMessages(prev => [...prev, { role: "bot", content: res.success ? res.response : `Error: ${res.error}`, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: "bot", content: "Network error.", ts: Date.now() }]);
    } finally { setLoading(false); }
  }

  async function banCustomer(email: string, reason: string) {
    setBanningEmail(email);
    try {
      const res = await authFetch("/api/admin/bot/ban", { method: "POST", body: JSON.stringify({ email, reason }) });
      if (res.success) {
        setBannedEmails(prev => new Set<string>(Array.from(prev).concat([email])));
        setThreats(prev => prev.map(t => t.email === email ? { ...t, canBan: false } : t));
      }
    } catch { /* silent */ }
    finally { setBanningEmail(null); }
  }

  const statusMsg = messages.find(m => m.isAuto);
  const chatMsgs = messages.filter(m => !m.isAuto);
  const criticalCount = threats.filter(t => t.severity === "critical" || t.severity === "high").length;
  const badgeCount = criticalCount || alerts;
  const autoFixedCount = autoActions.filter(a => a.result === "success").length;

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full shadow-2xl shadow-black/60 flex items-center justify-center transition-all hover:scale-105 active:scale-95 relative"
        style={{ background: botRunning ? "linear-gradient(135deg,#059669,#4f46e5)" : "linear-gradient(135deg,#374151,#1f2937)" }}
        title={botRunning ? "Admin Bot — Running" : "Admin Bot — Stopped"}>
        {open ? <Minimize2 className="w-5 h-5 text-white" /> : <Bot className="w-6 h-6 text-white" />}
        <span className={`absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0b0b18] ${botRunning ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
        {!open && badgeCount > 0 && botRunning && (
          <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center z-10">
            {badgeCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 left-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#0b0b18] shadow-2xl shadow-black/80 flex flex-col overflow-hidden"
          style={{ height: "580px" }}>

          {/* Header */}
          <div className="px-4 py-2.5 border-b border-white/8 flex-shrink-0"
            style={{ background: "rgba(5,150,105,0.08)" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 relative"
                style={{ background: "linear-gradient(135deg,#059669,#4f46e5)" }}>
                <Bot className="w-3.5 h-3.5 text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-[#0b0b18] bg-emerald-400 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">Admin Protection Bot</p>
                <p className="text-[10px]">
                  {botRunning
                    ? <span className="text-emerald-400">● Running · monitoring 24/7{lastRefresh && <span className="text-white/25 ml-1">· {lastRefresh.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</span>}</span>
                    : <span className="text-red-400">● Stopped · click Start to begin monitoring</span>
                  }
                </p>
              </div>
              {botRunning ? (
                <button
                  onClick={stopBot}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors"
                  title="Stop bot"
                >
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={startBot}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600/25 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-600/40 transition-colors"
                  title="Start bot"
                >
                  <Play className="w-2.5 h-2.5" />
                  Start
                </button>
              )}
              {botRunning && (
                <button onClick={() => fetchStatus(false)} title="Refresh" className="text-white/25 hover:text-white/60 p-1 transition-colors">
                  <RotateCw className={`w-3 h-3 ${scanning ? "animate-spin text-indigo-400" : ""}`} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-white/25 hover:text-white/60 p-1 transition-colors">
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-2">
              {([["monitor","📡 Monitor"],["security","🛡️ Security"],["auto","🤖 Auto-Fix"]] as [string,string][]).map(([t,label]) => (
                <button key={t} onClick={() => setTab(t as any)}
                  className={`text-[11px] px-3 py-1 rounded-lg transition-colors ${
                    tab === t ? "bg-white/10 text-white font-medium" : "text-white/35 hover:text-white/60"
                  }`}>
                  {label}
                  {t === "security" && criticalCount > 0 && (
                    <span className="ml-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold inline-flex items-center justify-center">{criticalCount}</span>
                  )}
                  {t === "auto" && autoFixedCount > 0 && (
                    <span className="ml-1 w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold inline-flex items-center justify-center">{autoFixedCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── BOT STOPPED SCREEN ── */}
          {!botRunning && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(55,65,81,.6)", border: "2px solid rgba(255,255,255,.08)" }}>
                <Bot className="w-8 h-8 text-white/25" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-base mb-1">Bot is not running</p>
                <p className="text-white/35 text-xs max-w-[240px] leading-relaxed">Start the bot to enable live monitoring, security scanning, and auto-fix actions.</p>
              </div>
              <button
                onClick={startBot}
                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-bold text-sm text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-900/30"
                style={{ background: "linear-gradient(135deg,#059669,#4f46e5)" }}
              >
                <Play className="w-4 h-4" />
                Start Bot
              </button>
              <p className="text-white/20 text-[10px]">Bot state is saved across page refreshes</p>
            </div>
          )}

          {/* ── MONITOR TAB ── */}
          {botRunning && tab === "monitor" && (
            <>
              {statusMsg ? (
                <div className="px-3 py-2 border-b border-white/6 flex-shrink-0 bg-white/2 text-[11px] text-white/70 leading-relaxed max-h-36 overflow-y-auto">
                  {renderBotText(statusMsg.content)}
                </div>
              ) : (
                <div className="px-3 py-2 border-b border-white/6 flex-shrink-0 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                  <p className="text-[11px] text-white/25">Loading live status…</p>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatMsgs.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2 pb-4">
                    <Bot className="w-8 h-8 text-indigo-500/30" />
                    <p className="text-[11px] text-white/20 text-center">Tap a command below or type your query</p>
                  </div>
                )}
                {chatMsgs.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                    {m.role === "bot" && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[84%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${m.role === "user" ? "bg-indigo-600 text-white" : "bg-white/7 text-white/85 border border-white/6"}`}>
                      {m.role === "bot" ? renderBotText(m.content) : <p>{m.content}</p>}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                    <div className="bg-white/7 border border-white/6 rounded-xl px-3 py-2 flex gap-1 items-center">
                      {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay:`${d}ms` }} />)}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              {/* Scrollable quick-command chips — always visible */}
              <div className="px-3 pt-2 pb-1 border-t border-white/6 flex-shrink-0">
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                  {QUICK_CMDS.map(q => (
                    <button key={q.cmd} onClick={() => send(q.cmd)} disabled={loading}
                      className="flex-shrink-0 text-[10px] font-medium text-indigo-300 bg-indigo-600/12 hover:bg-indigo-600/30 border border-indigo-500/25 rounded-full px-2.5 py-1 transition-colors whitespace-nowrap disabled:opacity-40">
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-3 pb-3 pt-1 flex-shrink-0">
                <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2">
                  <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                    placeholder="Type a command or question…" disabled={loading}
                    className="flex-1 bg-white/6 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-colors" />
                  <button type="submit" disabled={loading || !input.trim()}
                    className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 flex items-center justify-center transition-colors self-center flex-shrink-0">
                    <Send className="w-3.5 h-3.5 text-white" />
                  </button>
                </form>
              </div>
            </>
          )}

          {/* ── SECURITY TAB ── */}
          {botRunning && tab === "security" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Scan bar */}
              <div className="px-3 py-2 border-b border-white/6 flex-shrink-0 flex items-center gap-2">
                <button onClick={runScan} disabled={scanning}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-medium transition-colors">
                  {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  {scanning ? "Scanning…" : "Scan Now"}
                </button>
                <div className="flex-1 min-w-0">
                  {lastScan ? (
                    <p className="text-[10px] text-white/35">
                      Last scan: {lastScan.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
                      <span className="text-emerald-400 ml-1">· auto every 60s</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-emerald-400/60">Bot auto-scans every 60s · scanning now…</p>
                  )}
                </div>
                {threats.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/25">
                    {threats.length} threat{threats.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Threats list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {!lastScan && scanning && (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                    <p className="text-sm text-white/50">Bot scanning for threats…</p>
                    <p className="text-[10px] text-white/25">card testing · rapid purchases · spend spikes · suspended accounts</p>
                  </div>
                )}

                {scanning && threats.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    <p className="text-sm text-white/50">Scanning for threats…</p>
                  </div>
                )}

                {lastScan && !scanning && threats.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-white">All Clear</p>
                    <p className="text-xs text-white/35">No suspicious activity detected</p>
                  </div>
                )}

                {threats.map(t => {
                  const isBanned = bannedEmails.has(t.email);
                  return (
                    <div key={t.id} className={`rounded-xl border p-3 space-y-1.5 ${SEVERITY_COLOR[t.severity]}`}>
                      <div className="flex items-start gap-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide flex-shrink-0 mt-0.5 ${SEVERITY_BADGE[t.severity]}`}>
                          {t.severity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-white">{t.type}</p>
                          <p className="text-[10px] opacity-80 truncate">{t.email}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-white/70">{t.description}</p>
                      <p className="text-[10px] text-white/40 italic">{t.detail}</p>
                      {t.canBan && (
                        <button
                          disabled={isBanned || banningEmail === t.email}
                          onClick={() => banCustomer(t.email, `${t.type}: ${t.description}`)}
                          className={`mt-1 w-full py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                            isBanned
                              ? "bg-white/5 text-white/25 cursor-default border border-white/10"
                              : "bg-red-600 hover:bg-red-500 text-white active:scale-95"
                          }`}>
                          {banningEmail === t.email ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Banning…</>
                          ) : isBanned ? (
                            <><CheckCircle className="w-3 h-3" /> Banned</>
                          ) : (
                            <><Ban className="w-3 h-3" /> Ban Account</>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── AUTO-FIX TAB ── */}
          {botRunning && tab === "auto" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header bar */}
              <div className="px-3 py-2 border-b border-white/6 flex-shrink-0 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/70 font-medium">Bot Auto-Actions Log</p>
                  <p className="text-[10px] text-emerald-400/70">Runs every 2 min · verifies payments · resends credentials · bans threats</p>
                </div>
                <button onClick={fetchAutoLog} disabled={autoLogLoading}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-white/40 hover:text-white/70 transition-colors border border-white/10 hover:border-white/20">
                  <RotateCw className={`w-3 h-3 ${autoLogLoading ? "animate-spin text-indigo-400" : ""}`} />
                  Refresh
                </button>
              </div>
              {/* Action list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {autoLogLoading && autoActions.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
                    <p className="text-xs text-white/35">Loading auto-fix log…</p>
                  </div>
                )}
                {!autoLogLoading && autoActions.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">No actions yet</p>
                      <p className="text-xs text-white/30 mt-1">The bot runs every 2 minutes.<br/>Actions will appear here automatically.</p>
                    </div>
                    <div className="text-[10px] text-white/20 space-y-0.5 border border-white/8 rounded-xl p-3 text-left w-full">
                      <p className="font-semibold text-white/35 mb-1">What the bot fixes automatically:</p>
                      <p>💳 Pending payments → verifies with Paystack</p>
                      <p>📧 Missing credentials → assigns account + emails</p>
                      <p>🛡️ Critical threats → auto-bans suspended accounts</p>
                      <p>🚨 Card testers → flags for admin review</p>
                    </div>
                  </div>
                )}
                {autoActions.map((a: any) => {
                  const typeColor = a.type === "security" ? "text-red-400" : a.type === "payment" ? "text-yellow-400" : "text-blue-400";
                  const typeIcon = a.type === "security" ? "🛡️" : a.type === "payment" ? "💳" : "📧";
                  const resultColor = a.result === "success" ? "text-emerald-400" : a.result === "failed" ? "text-red-400" : "text-white/40";
                  const resultIcon = a.result === "success" ? "✅" : a.result === "failed" ? "❌" : "⏭️";
                  const timeStr = new Date(a.time).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
                  const dateStr = new Date(a.time).toLocaleDateString([], { month:"short", day:"numeric" });
                  return (
                    <div key={a.id} className="rounded-xl border border-white/8 bg-white/2 p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{typeIcon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-white truncate">{a.action}</p>
                          <p className="text-[10px] text-white/40 truncate">{a.email}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-[10px] font-semibold ${resultColor}`}>{resultIcon} {a.result}</p>
                          <p className="text-[9px] text-white/25">{dateStr} {timeStr}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-white/50 leading-relaxed">{a.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// LOGIN FLOW  (pre-auth - uses plainFetch only)
// ═══════════════════════════════════════════════════════════════
function LoginFlow({ onLogin }: { onLogin: (token: string, role?: string) => void }) {
  const [showPwd, setShowPwd] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const { data: statusData } = useQuery<{ setupComplete: boolean }>({
    queryKey: ["/api/admin/2fa-status"],
  });
  const setupComplete = statusData?.setupComplete ?? false;

  const form = useForm({
    defaultValues: { email: "", password: "", totpCode: "" },
  });

  async function handleLogin(values: { email: string; password: string; totpCode: string }) {
    setIsLoading(true);
    setLoginError("");
    try {
      const data = await plainFetch("/api/admin/login", {
        email: values.email,
        password: values.password,
        totpCode: values.totpCode || undefined,
      });
      if (data.success) {
        onLogin(data.token, data.role);
      } else {
        setLoginError(data.error || "Login failed. Check your credentials.");
      }
    } catch {
      setLoginError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="bg-orb w-[600px] h-[600px] bg-indigo-600 top-[-200px] left-[-150px]" style={{ opacity: 0.35 }} />
        <div className="bg-orb w-[500px] h-[500px] bg-violet-700 bottom-[-150px] right-[-100px]" style={{ opacity: 0.30 }} />
        <div className="bg-orb w-[300px] h-[300px] bg-blue-500 top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2" style={{ opacity: 0.15 }} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-5 shadow-2xl" style={{ boxShadow: "0 0 40px rgba(99,102,241,0.4)" }}>
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Admin Login</h1>
          <p className="text-white/40 text-sm">Secure admin access</p>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/60 text-xs uppercase tracking-wider">Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="admin@example.com" autoComplete="email"
                      className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-indigo-500/50"
                      data-testid="input-admin-email" />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/60 text-xs uppercase tracking-wider">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input {...field} type={showPwd ? "text" : "password"} placeholder="••••••••" autoComplete="current-password"
                        className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-indigo-500/50 pr-10"
                        data-testid="input-admin-password" />
                      <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                </FormItem>
              )} />

              {setupComplete && (
                <FormField control={form.control} name="totpCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/60 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Key className="w-3 h-3" />Authenticator Code
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="000000" maxLength={6} inputMode="numeric"
                        className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25 text-center font-mono text-xl tracking-[0.5em] focus:border-indigo-500/50"
                        data-testid="input-totp" />
                    </FormControl>
                  </FormItem>
                )} />
              )}

              {loginError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {loginError}
                </div>
              )}

              <Button type="submit" disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white font-semibold h-11 shadow-lg hover:opacity-90 transition-opacity mt-2"
                style={{ boxShadow: "0 0 20px rgba(99,102,241,0.3)" }}
                data-testid="button-login">
                {isLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Logging in...</>
                ) : "Login"}
              </Button>
            </form>
          </Form>

          {!setupComplete && (
            <div className="mt-4 pt-4 border-t border-white/8">
              <p className="text-xs text-white/30 text-center">
                2FA not set up — configure it inside the admin panel after logging in
              </p>
            </div>
          )}
        </div>

        <div className="text-center mt-5">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-white/30 hover:text-white/60">
            Back to Store
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS TAB  (2FA setup + Paystack config)
// ═══════════════════════════════════════════════════════════════
function AdminProfileSection({ inputCls }: { inputCls: string }) {
  const { toast } = useToast();
  const AVATAR_PRESETS = ["CT", "AT", "SA", "MG", "🚀", "⚡", "🔥", "💎", "👑", "🛡️"];

  const { data, refetch } = useQuery<any>({
    queryKey: ["/api/admin/profile"],
    queryFn: () => authFetch("/api/admin/profile"),
  });

  const [form, setForm] = useState<{ name: string; avatar: string; bio: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.success && !form) setForm({ name: data.name || "", avatar: data.avatar || "CT", bio: data.bio || "" });
  }, [data]);

  function update(key: string, value: string) {
    setForm(prev => prev ? { ...prev, [key]: value } : prev);
    setDirty(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => authFetch("/api/admin/profile", { method: "PUT", body: JSON.stringify(form) }),
    onSuccess: (d) => {
      if (d.success) { toast({ title: "Profile saved" }); setDirty(false); refetch(); }
      else toast({ title: "Failed", description: d.error, variant: "destructive" });
    },
  });

  const isSuperAdmin = data?.role === "super";

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <p className="font-semibold text-white">Admin Profile</p>
            <p className="text-xs text-white/40">Your display name, avatar, and bio</p>
          </div>
        </div>
        {dirty && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white text-xs h-8 px-3">
            <Save className="w-3.5 h-3.5 mr-1.5" />{saveMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        )}
      </div>
      {form ? (
        <div className="p-5 space-y-5">
          {/* Avatar + name row */}
          <div className="flex items-start gap-4">
            {/* Avatar preview */}
            <div className="shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20">
                {form.avatar || "CT"}
              </div>
              <p className="text-[10px] text-white/30 text-center mt-1.5">Preview</p>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-xs text-white/40 block mb-1.5">Display Name</label>
                <Input value={form.name} onChange={e => update("name", e.target.value)}
                  placeholder="Super Admin" className={inputCls} maxLength={32} />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1.5">Role</label>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${data?.role === "super" ? "bg-violet-500/20 text-violet-300" : "bg-blue-500/20 text-blue-300"}`}>
                  <Shield className="w-3 h-3" />
                  {data?.role === "super" ? "Super Admin" : "Sub-Admin"}
                </div>
              </div>
            </div>
          </div>

          {/* Avatar picker */}
          {isSuperAdmin && (
            <div>
              <label className="text-xs text-white/40 block mb-2">Avatar — pick initials or emoji</label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_PRESETS.map(a => (
                  <button key={a} onClick={() => update("avatar", a)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all border ${
                      form.avatar === a
                        ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white border-indigo-400/50 shadow-lg"
                        : "glass border-white/10 text-white/60 hover:border-indigo-400/40 hover:text-white"
                    }`}>
                    {a}
                  </button>
                ))}
                {/* Custom input */}
                <input
                  value={AVATAR_PRESETS.includes(form.avatar) ? "" : form.avatar}
                  onChange={e => update("avatar", e.target.value.slice(0, 3))}
                  placeholder="…"
                  maxLength={3}
                  className="w-10 h-10 rounded-xl glass border border-white/10 text-white text-sm font-bold text-center bg-transparent focus:border-indigo-400/50 outline-none placeholder:text-white/20"
                  title="Custom avatar (up to 3 chars)"
                />
              </div>
            </div>
          )}

          {/* Bio */}
          {isSuperAdmin && (
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Bio <span className="text-white/20">(optional)</span></label>
              <textarea
                value={form.bio}
                onChange={e => update("bio", e.target.value)}
                placeholder="Brief description about this admin account..."
                maxLength={160}
                rows={2}
                className={`w-full rounded-xl px-3 py-2 text-sm resize-none ${inputCls}`}
              />
              <p className="text-[10px] text-white/25 mt-1">{form.bio.length}/160</p>
            </div>
          )}

          {/* Email (read-only) */}
          {data?.email && (
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Email <span className="text-white/20">(change in Credentials section)</span></label>
              <div className="glass rounded-xl px-3 py-2.5 text-sm text-white/50 font-mono">{data.email}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-5 text-center text-white/30 text-sm">Loading...</div>
      )}
    </div>
  );
}

function AffiliateTiersSection({ inputCls }: { inputCls: string }) {
  const { toast } = useToast();
  const tierColors: Record<string, { bg: string; text: string; border: string; badge: string }> = {
    Silver:   { bg: "bg-slate-400/10",  text: "text-slate-300",  border: "border-slate-400/20",  badge: "bg-slate-500/30 text-slate-200" },
    Gold:     { bg: "bg-amber-400/10",  text: "text-amber-300",  border: "border-amber-400/20",  badge: "bg-amber-500/30 text-amber-200" },
    Platinum: { bg: "bg-violet-400/10", text: "text-violet-300", border: "border-violet-400/20", badge: "bg-violet-500/30 text-violet-200" },
  };

  const { data, refetch } = useQuery<{ success: boolean; tiers: any[] }>({
    queryKey: ["/api/admin/affiliate-tiers"],
    queryFn: () => authFetch("/api/admin/affiliate-tiers"),
  });

  const [tiers, setTiers] = useState<any[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (Array.isArray(data?.tiers) && tiers.length === 0) setTiers(data.tiers);
  }, [data?.tiers]);

  function updateTier(index: number, field: string, value: any) {
    setTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: field === "name" ? value : Number(value) } : t));
    setDirty(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => authFetch("/api/admin/affiliate-tiers", { method: "PUT", body: JSON.stringify({ tiers }) }),
    onSuccess: (d) => {
      if (d.success) { toast({ title: "Affiliate tiers saved" }); setDirty(false); refetch(); }
      else toast({ title: "Failed to save", description: d.error, variant: "destructive" });
    },
  });

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600/20 flex items-center justify-center">
            <Star className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-white">Affiliate Tier Thresholds</p>
            <p className="text-xs text-white/40">Set referral counts and coin multipliers for each tier</p>
          </div>
        </div>
        {dirty && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
            className="bg-gradient-to-r from-amber-600 to-orange-600 border-0 text-white text-xs h-8 px-3">
            <Save className="w-3.5 h-3.5 mr-1.5" />{saveMutation.isPending ? "Saving..." : "Save Tiers"}
          </Button>
        )}
      </div>
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-3 gap-2 mb-1">
          <p className="text-xs text-white/30 font-medium uppercase tracking-wide">Tier</p>
          <p className="text-xs text-white/30 font-medium uppercase tracking-wide">Min Referrals</p>
          <p className="text-xs text-white/30 font-medium uppercase tracking-wide">Coin Multiplier</p>
        </div>
        {!Array.isArray(tiers) || tiers.length === 0 ? (
          <div className="text-center text-white/30 text-sm py-4">Loading...</div>
        ) : (
          tiers.map((tier, i) => {
            const c = tierColors[tier.name] || tierColors["Silver"];
            return (
              <div key={i} className={`grid grid-cols-3 gap-2 items-center p-3 rounded-xl border ${c.border} ${c.bg}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{tier.name}</span>
                </div>
                <div>
                  <Input
                    type="number" min={1} value={tier.min}
                    onChange={(e) => updateTier(i, "min", e.target.value)}
                    className={`${inputCls} h-8 text-sm`}
                    placeholder="5"
                  />
                </div>
                <div className="relative">
                  <Input
                    type="number" min={1} step={0.05} value={tier.multiplier}
                    onChange={(e) => updateTier(i, "multiplier", e.target.value)}
                    className={`${inputCls} h-8 text-sm pr-8`}
                    placeholder="1.25"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-white/30">×</span>
                </div>
              </div>
            );
          })
        )}
        <p className="text-[11px] text-white/25 pt-1">
          Referrers automatically upgrade tiers as they accumulate referrals. Each tier earns coins at the set multiplier on every purchase by referred users.
        </p>
      </div>
    </div>
  );
}

// ─── ANNOUNCEMENTS SECTION ───────────────────────────────────────────────────
function MonthlySummarySection({ inputCls }: { inputCls: string }) {
  const { toast } = useToast();
  const [targetEmail, setTargetEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sent: number } | null>(null);

  async function handleSend() {
    setLoading(true);
    setResult(null);
    try {
      const r = await authFetch("/api/admin/cron/monthly-summary", {
        method: "POST",
        body: JSON.stringify({ email: targetEmail.trim() || undefined }),
      });
      if (r.success) {
        setResult({ sent: r.sent });
        if (r.sent === 0) toast({ title: "No emails sent", description: "No customers had successful orders this month so far" });
        else toast({ title: `${r.sent} summary email${r.sent !== 1 ? "s" : ""} sent` });
      } else {
        toast({ title: r.error ?? "Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
          <Mail className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white">Monthly Spending Summary Emails</p>
          <p className="text-xs text-white/40">Automatically sent to all customers on the 1st of each month · Shows previous month's orders and estimated savings</p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 shrink-0">
          Cron: 1st of month
        </span>
      </div>
      <div className="p-5 space-y-4">
        <div className="rounded-xl p-3.5 text-xs space-y-1.5" style={{ background: "rgba(99,102,241,.07)", border: "1px solid rgba(99,102,241,.18)" }}>
          <p className="text-indigo-300 font-semibold">How it works</p>
          <ul className="text-indigo-200/60 space-y-1 list-disc list-inside">
            <li>Runs automatically on the 1st of every month at 9am</li>
            <li>Each customer with at least one successful order in the previous month gets a personalised email</li>
            <li>Shows itemised order list, total spent, and estimated savings vs buying directly</li>
            <li>Deduplication prevents re-sending — each customer gets at most one summary per month</li>
            <li>Customers with zero orders are silently skipped</li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">Manual Trigger</p>
          <p className="text-xs text-white/35">
            Trigger the summary right now — useful for testing. Uses <strong className="text-white/50">current month so far</strong> as the order window (cron uses previous month). Deduplication is bypassed for all manual triggers, so you can safely re-send without affecting the scheduled cron run. Leave the email field blank to send to all eligible customers, or enter a specific email to test with one recipient.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="customer@example.com (optional — blank = all customers)"
              value={targetEmail}
              onChange={e => setTargetEmail(e.target.value)}
              className="flex-1 text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-white/25 outline-none focus:border-indigo-500/50"
            />
            <button
              disabled={loading}
              onClick={handleSend}
              className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? "Sending..." : "Send Now"}
            </button>
          </div>
          {result !== null && (
            <div className="flex items-center gap-2.5 rounded-xl p-3 text-sm" style={{ background: result.sent > 0 ? "rgba(16,185,129,.08)" : "rgba(156,163,175,.08)", border: result.sent > 0 ? "1px solid rgba(16,185,129,.2)" : "1px solid rgba(156,163,175,.15)" }}>
              {result.sent > 0
                ? <><CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /><p className="text-emerald-300 font-semibold">{result.sent} summary email{result.sent !== 1 ? "s" : ""} sent successfully</p></>
                : <><Info className="w-4 h-4 text-white/30 shrink-0" /><p className="text-white/40">No eligible customers found for the current month so far</p></>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnnouncementsSection({ inputCls }: { inputCls: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/announcements"],
    queryFn: () => fetch("/api/announcements").then(r => r.json()),
  });
  const announcements: any[] = data?.announcements ?? [];

  const [form, setForm] = useState({ title: "", message: "", type: "info", link: "", linkLabel: "", expiresAt: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate() {
    if (!form.title.trim() || !form.message.trim()) { toast({ title: "Title and message required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await authFetch("/api/admin/announcements", { method: "POST", body: JSON.stringify(form) });
      if (r.success) {
        toast({ title: "Announcement created" });
        setForm({ title: "", message: "", type: "info", link: "", linkLabel: "", expiresAt: "" });
        refetch(); qc.invalidateQueries({ queryKey: ["/api/announcements"] });
      } else toast({ title: r.error ?? "Failed", variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const r = await authFetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      if (r.success) { refetch(); qc.invalidateQueries({ queryKey: ["/api/announcements"] }); }
      else toast({ title: r.error ?? "Failed", variant: "destructive" });
    } finally { setDeletingId(null); }
  }

  const typeColors: Record<string, string> = {
    info: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    urgent: "bg-red-500/15 text-red-300 border-red-500/30",
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
          <Info className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <p className="font-semibold text-white">In-App Announcements</p>
          <p className="text-xs text-white/40">Broadcast banners shown on customers' dashboards</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {/* Create form */}
        <div className="space-y-3 p-4 rounded-xl border border-white/8 bg-white/2">
          <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">New Announcement</p>
          <Input className={inputCls} placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <textarea
            className={`${inputCls} w-full min-h-[72px] rounded-md px-3 py-2 text-sm resize-none`}
            placeholder="Message *"
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <select className={`${inputCls} rounded-md px-3 py-2 text-sm bg-white/5`} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
              <option value="urgent">Urgent</option>
            </select>
            <Input className={inputCls} type="datetime-local" placeholder="Expires At (optional)" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input className={inputCls} placeholder="Link URL (optional)" value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} />
            <Input className={inputCls} placeholder="Link label" value={form.linkLabel} onChange={e => setForm(f => ({ ...f, linkLabel: e.target.value }))} />
          </div>
          <Button onClick={handleCreate} disabled={saving} className="bg-gradient-to-r from-violet-600 to-indigo-600 border-0 text-white text-xs h-8 px-4">
            <Plus className="w-3.5 h-3.5 mr-1.5" />{saving ? "Creating..." : "Post Announcement"}
          </Button>
        </div>

        {/* Existing announcements */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /></div>
        ) : announcements.length === 0 ? (
          <p className="text-center text-white/25 text-sm py-4">No announcements yet</p>
        ) : (
          <div className="space-y-2">
            {announcements.map((a: any) => (
              <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border ${typeColors[a.type] ?? typeColors.info}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.title}</p>
                  <p className="text-xs opacity-70 mt-0.5 line-clamp-2">{a.message}</p>
                  {a.expiresAt && <p className="text-xs opacity-50 mt-1">Expires {new Date(a.expiresAt).toLocaleString("en-KE")}</p>}
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
                >
                  {deletingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WAITLIST SECTION ─────────────────────────────────────────────────────────
function WaitlistSection({ inputCls }: { inputCls: string }) {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/waitlist"],
    queryFn: () => authFetch("/api/admin/waitlist"),
  });
  const entries: any[] = data?.waitlist ?? [];

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notifyingPlan, setNotifyingPlan] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const r = await authFetch(`/api/admin/waitlist/${id}`, { method: "DELETE" });
      if (r.success) refetch();
      else toast({ title: r.error ?? "Failed", variant: "destructive" });
    } finally { setDeletingId(null); }
  }

  async function handleNotify(planId: string, planName: string) {
    setNotifyingPlan(planId);
    try {
      const r = await authFetch(`/api/admin/waitlist/notify/${planId}`, { method: "POST" });
      if (r.success) toast({ title: `Notified ${r.count ?? "all"} subscribers for ${planName}` });
      else toast({ title: r.error ?? "Failed", variant: "destructive" });
    } finally { setNotifyingPlan(null); }
  }

  // Group entries by planId
  const planGroups = entries.reduce((acc: Record<string, any[]>, e: any) => {
    if (!acc[e.planId]) acc[e.planId] = [];
    acc[e.planId].push(e); return acc;
  }, {});

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-600/20 flex items-center justify-center">
          <Bell className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p className="font-semibold text-white">Waitlist</p>
          <p className="text-xs text-white/40">{entries.length} customer{entries.length !== 1 ? "s" : ""} waiting · Notify when back in stock</p>
        </div>
      </div>
      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /></div>
        ) : entries.length === 0 ? (
          <p className="text-center text-white/25 text-sm py-4">No waitlist entries yet</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(planGroups).map(([planId, planEntries]) => (
              <div key={planId} className="border border-white/8 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white/3 border-b border-white/5">
                  <div>
                    <p className="text-sm font-semibold text-white">{planEntries[0]?.planName ?? planId}</p>
                    <p className="text-xs text-white/35">{planEntries.length} waiting</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleNotify(planId, planEntries[0]?.planName ?? planId)}
                    disabled={notifyingPlan === planId}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs h-7 px-3"
                  >
                    <Send className="w-3 h-3 mr-1.5" />
                    {notifyingPlan === planId ? "Notifying..." : "Notify All"}
                  </Button>
                </div>
                <div className="divide-y divide-white/5">
                  {planEntries.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-white/70 truncate">{e.email}</p>
                        <p className="text-xs text-white/25">{new Date(e.joinedAt).toLocaleDateString("en-KE")}</p>
                      </div>
                      <button onClick={() => handleDelete(e.id)} disabled={deletingId === e.id}
                        className="shrink-0 text-red-400/50 hover:text-red-400 transition-colors">
                        {deletingId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsTab() {
  const { toast } = useToast();
  const inputCls = "glass border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-indigo-500/50";

  const { data: secretsData, isLoading: secretsLoading } = useQuery<{ secrets: any }>({
    queryKey: ["/api/admin/secrets"],
    queryFn: () => authFetch("/api/admin/secrets"),
  });
  const rawVars = secretsData?.secrets?.vars;
  const envVars: { key: string; label: string; set: boolean; group: string }[] = Array.isArray(rawVars) ? rawVars : [];
  const groups = Array.from(new Set(envVars.map((v) => v.group)));

  // ─── Test email state ───────────────────────────────────────────────────
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; to?: string; error?: string; domainWarning?: string } | null>(null);
  const [domainStatus, setDomainStatus] = useState<{ loaded: boolean; allVerified: boolean; unverified: string[]; domains: { name: string; status: string }[] }>({ loaded: false, allVerified: false, unverified: [], domains: [] });

  useEffect(() => {
    authFetch("/api/admin/email/domain-status").then((r: any) => {
      if (r.success !== undefined) {
        setDomainStatus({ loaded: true, allVerified: r.allVerified ?? false, unverified: r.unverifiedFromDomains ?? [], domains: r.domains ?? [] });
      }
    }).catch(() => {});
  }, []);

  // ─── 2FA state ──────────────────────────────────────────────
  const [tfaStep, setTfaStep] = useState<"idle" | "qr" | "verify">("idle");
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [isLoadingTfa, setIsLoadingTfa] = useState(false);
  const [tfaError, setTfaError] = useState("");
  const [tfaCreds, setTfaCreds] = useState({ email: "", password: "" });
  const [showTfaPwd, setShowTfaPwd] = useState(false);

  const { data: statusData, refetch: refetchStatus } = useQuery<{ setupComplete: boolean }>({
    queryKey: ["/api/admin/2fa-status"],
  });
  const setupComplete = statusData?.setupComplete ?? false;

  async function startSetup() {
    if (!tfaCreds.email || !tfaCreds.password) { setTfaError("Enter your admin credentials first"); return; }
    setIsLoadingTfa(true); setTfaError("");
    try {
      const data = await plainFetch("/api/admin/2fa-setup", tfaCreds);
      if (data.success) { setSetupData({ secret: data.secret, qrCodeDataUrl: data.qrCodeDataUrl }); setTfaStep("qr"); }
      else setTfaError(data.error || "Failed to generate QR code");
    } catch { setTfaError("Connection error"); }
    finally { setIsLoadingTfa(false); }
  }

  async function verifySetup() {
    if (verifyCode.length !== 6) { setTfaError("Enter the 6-digit code"); return; }
    setIsLoadingTfa(true); setTfaError("");
    try {
      const data = await plainFetch("/api/admin/2fa-complete", { ...tfaCreds, secret: setupData?.secret, totpCode: verifyCode });
      if (data.success) {
        toast({ title: "2FA enabled!" });
        setTfaStep("idle"); setSetupData(null); setVerifyCode(""); setTfaCreds({ email: "", password: "" });
        refetchStatus();
      } else setTfaError(data.error || "Invalid code");
    } catch { setTfaError("Connection error"); }
    finally { setIsLoadingTfa(false); }
  }


  return (
    <>
      <h1 className="text-xl font-bold text-white mb-6">Settings</h1>
      <div className="space-y-5 max-w-2xl">

        {/* ─── Admin Profile ───────────────────────────────── */}
        <AdminProfileSection inputCls={inputCls} />

        {/* ─── Announcements ───────────────────────────────── */}
        <AnnouncementsSection inputCls={inputCls} />

        {/* ─── Waitlist ─────────────────────────────────────── */}
        <WaitlistSection inputCls={inputCls} />

        {/* ─── Environment Variables Status ────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
              <Key className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-white">Environment Variables</p>
              <p className="text-xs text-white/40">All secrets are loaded from your <code className="text-emerald-400/80 bg-white/5 px-1 rounded">.env</code> file — edit that file to make changes</p>
            </div>
          </div>
          <div className="p-5">
            {secretsLoading ? (
              <div className="flex items-center gap-2 text-white/30 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : envVars.length === 0 ? (
              <p className="text-white/30 text-sm">No status available</p>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group}>
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">{group}</p>
                    <div className="space-y-1.5">
                      {envVars.filter((v) => v.group === group).map((v) => (
                        <div key={v.key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/3 border border-white/6">
                          <div>
                            <span className="text-xs text-white/70 font-medium">{v.label}</span>
                            <span className="ml-2 text-[10px] text-white/25 font-mono">{v.key}</span>
                          </div>
                          {v.set
                            ? <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><CheckCircle className="w-3 h-3" /> Set</span>
                            : <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold"><XCircle className="w-3 h-3" /> Missing</span>
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-white/20 pt-1">Edit <code className="text-white/35">chegetech/.env</code> then restart the server to apply changes</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── Test Email ──────────────────────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600/20 flex items-center justify-center">
              <Mail className="w-5 h-5 text-sky-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">Test Email Delivery</p>
              <p className="text-xs text-white/40">Send a test email to confirm your Resend API key works</p>
            </div>
            {domainStatus.loaded && (
              domainStatus.allVerified ? (
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Domain Verified
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Domain Unverified
                </span>
              )
            )}
          </div>

          {/* Domain verification warning banner */}
          {domainStatus.loaded && !domainStatus.allVerified && (
            <div className="mx-5 mt-4 rounded-xl p-3.5" style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)" }}>
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-1.5">
                  <p className="text-amber-300 text-sm font-semibold">Why emails appear sent but never arrive</p>
                  <p className="text-amber-200/70 text-xs leading-relaxed">
                    Resend accepts the email request and returns "success" — but <strong>silently drops emails</strong> sent to customer addresses until your domain is verified. This is a Resend restriction, not a code bug.
                  </p>
                  {domainStatus.unverified.length > 0 && (
                    <p className="text-amber-200/70 text-xs">
                      Unverified domain{domainStatus.unverified.length > 1 ? "s" : ""}: <span className="font-mono text-amber-300">{domainStatus.unverified.join(", ")}</span>
                    </p>
                  )}
                  <div className="pt-1">
                    <p className="text-amber-200/60 text-xs font-semibold mb-1">To fix this:</p>
                    <ol className="text-amber-200/60 text-xs space-y-0.5 list-decimal list-inside">
                      <li>Go to <strong className="text-amber-300">resend.com/domains</strong> → Add Domain</li>
                      <li>Enter <span className="font-mono text-amber-300">{domainStatus.unverified[0] || "streamvault-premium.site"}</span></li>
                      <li>Add the DNS records shown (TXT + MX + DKIM) to your domain registrar</li>
                      <li>Click Verify — emails will start delivering immediately</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-5 space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="recipient@example.com (leave blank = ADMIN_EMAIL)"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                className="flex-1 text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-white/25 outline-none focus:border-indigo-500/50"
              />
              <button
                disabled={testEmailLoading}
                onClick={async () => {
                  setTestEmailLoading(true);
                  setTestEmailResult(null);
                  try {
                    const r = await authFetch("/api/admin/test-email", {
                      method: "POST",
                      body: JSON.stringify({ to: testEmailTo.trim() || undefined }),
                    });
                    setTestEmailResult(r);
                    // Refresh domain status after test
                    authFetch("/api/admin/email/domain-status").then((ds: any) => {
                      if (ds.success !== undefined) setDomainStatus({ loaded: true, allVerified: ds.allVerified ?? false, unverified: ds.unverifiedFromDomains ?? [], domains: ds.domains ?? [] });
                    }).catch(() => {});
                  } catch (e: any) {
                    setTestEmailResult({ success: false, error: e.message || "Network error" });
                  } finally {
                    setTestEmailLoading(false);
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/20 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {testEmailLoading ? "Sending…" : "Send Test"}
              </button>
            </div>
            {testEmailResult && (
              testEmailResult.success ? (
                <div className="rounded-xl p-3 text-sm space-y-1.5" style={{ background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)" }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-emerald-400 font-semibold">Request accepted by Resend</p>
                  </div>
                  <p className="text-white/40 text-xs pl-6">Sent to <span className="text-white/60">{testEmailResult.to}</span> — check your inbox and spam folder</p>
                  {testEmailResult.domainWarning && (
                    <div className="mt-2 pl-6 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-amber-300/80 text-xs">{testEmailResult.domainWarning}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-xl p-3 text-sm" style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)" }}>
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-red-400 font-semibold">Send failed</p>
                    <p className="text-white/50 text-xs mt-1 font-mono break-all">{testEmailResult.error}</p>
                    {testEmailResult.error?.includes("not configured") || testEmailResult.error?.includes("API key") ? (
                      <p className="text-amber-400/70 text-xs mt-2">RESEND_API_KEY is missing. Add it in .env or in Settings → Credentials → Resend API Key.</p>
                    ) : testEmailResult.error?.includes("Invalid") || testEmailResult.error?.includes("Unauthorized") ? (
                      <p className="text-amber-400/70 text-xs mt-2">The API key was rejected by Resend. Check it at <strong className="text-amber-300">resend.com/api-keys</strong> and make sure it has send permission.</p>
                    ) : null}
                  </div>
                </div>
              )
            )}

            {/* Resend domains list */}
            {domainStatus.loaded && domainStatus.domains.length > 0 && (
              <div className="pt-1">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Your Resend Domains</p>
                <div className="space-y-1.5">
                  {domainStatus.domains.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs bg-white/3 rounded-lg px-3 py-1.5">
                      <span className="text-white/60 font-mono">{d.name}</span>
                      <span className={`font-semibold ${d.status === "verified" ? "text-emerald-400" : "text-amber-400"}`}>{d.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Monthly Summary Emails ──────────────────────── */}
        <MonthlySummarySection inputCls={inputCls} />

        {/* ─── Affiliate Tiers ─────────────────────────────── */}
        <AffiliateTiersSection inputCls={inputCls} />

        {/* ─── 2FA ─────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">Two-Factor Authentication (2FA)</p>
                  <p className="text-xs text-white/40">Require an authenticator app code on every login</p>
                </div>
              </div>
              {setupComplete
                ? <Badge className="bg-emerald-600/80 text-white border-0 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                : <Badge className="glass border-white/10 text-white/50 text-xs">Not Set Up</Badge>}
            </div>
          </div>
          <div className="p-5">
            {tfaStep === "idle" && (
              <div className="space-y-4">
                {setupComplete ? (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15 text-xs text-emerald-300">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    2FA is active. Enter your credentials below to reconfigure.
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/8 border border-amber-500/15 text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    2FA is not set up. Protect your account by enabling it below.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 block mb-1">Your Admin Email</label>
                    <Input value={tfaCreds.email} onChange={(e) => setTfaCreds(p => ({ ...p, email: e.target.value }))} type="email" placeholder="admin@example.com" className={inputCls} data-testid="input-2fa-email" />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 block mb-1">Your Admin Password</label>
                    <div className="relative">
                      <Input value={tfaCreds.password} onChange={(e) => setTfaCreds(p => ({ ...p, password: e.target.value }))} type={showTfaPwd ? "text" : "password"} placeholder="••••••••" className={inputCls + " pr-9"} data-testid="input-2fa-password" />
                      <button type="button" onClick={() => setShowTfaPwd(!showTfaPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                        {showTfaPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                {tfaError && <p className="text-xs text-red-400">{tfaError}</p>}
                <Button onClick={startSetup} disabled={isLoadingTfa} data-testid="button-start-2fa"
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white shadow-lg hover:opacity-90">
                  <QrCode className="w-4 h-4 mr-2" />
                  {isLoadingTfa ? "Generating..." : `${setupComplete ? "Reconfigure" : "Set Up"} 2FA`}
                </Button>
              </div>
            )}
            {tfaStep === "qr" && setupData && (
              <div className="space-y-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <img src={setupData.qrCodeDataUrl} alt="2FA QR Code" className="w-44 h-44 rounded-lg" />
                  </div>
                  <div className="flex-1 space-y-3 min-w-0">
                    <p className="text-sm font-semibold text-white">Scan with your authenticator app</p>
                    <p className="text-xs text-white/40">Works with Google Authenticator, Authy, Microsoft Authenticator, or any TOTP app.</p>
                    <div className="glass rounded-xl p-3">
                      <p className="text-xs text-white/30 mb-1">Or enter this code manually:</p>
                      <p className="font-mono text-xs text-indigo-300 break-all">{setupData.secret}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setTfaStep("verify")} className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white hover:opacity-90" data-testid="button-next-verify">
                    I've Scanned It → Verify
                  </Button>
                  <Button variant="outline" className="glass border-white/10 text-white/60 hover:text-white" onClick={() => { setTfaStep("idle"); setSetupData(null); setTfaError(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {tfaStep === "verify" && (
              <div className="space-y-4">
                <p className="text-sm text-white/70">Enter the 6-digit code from your authenticator app:</p>
                <Input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" maxLength={6} inputMode="numeric"
                  className={inputCls + " text-center font-mono text-3xl tracking-[0.5em] h-16"}
                  data-testid="input-verify-code" />
                {tfaError && <p className="text-xs text-red-400">{tfaError}</p>}
                <div className="flex gap-3">
                  <Button onClick={verifySetup} disabled={verifyCode.length !== 6 || isLoadingTfa}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 border-0 text-white hover:opacity-90" data-testid="button-enable-2fa">
                    {isLoadingTfa ? "Verifying..." : "Enable 2FA"}
                  </Button>
                  <Button variant="outline" className="glass border-white/10 text-white/60 hover:text-white" onClick={() => setTfaStep("qr")}>
                    Back to QR
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}

function SettingsSection({ icon: Icon, iconBg, iconColor, title, subtitle, badge, children }: {
  icon: any; iconBg: string; iconColor: string; title: string; subtitle: string; badge?: any; children: any;
}) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <p className="font-semibold text-white">{title}</p>
              <p className="text-xs text-white/40">{subtitle}</p>
            </div>
          </div>
          {badge}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════
function DashboardTab() {
  const { data: statsData, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => authFetch("/api/admin/stats"),
    refetchInterval: 30000,
  });
  const { data: analyticsData } = useQuery<any>({
    queryKey: ["/api/admin/analytics"],
    queryFn: () => authFetch("/api/admin/analytics"),
    refetchInterval: 60000,
  });
  const stats = statsData?.transactions;
  const accStats = statsData?.accounts;
  const botStats = statsData?.bots;
  const { data: smmData }     = useQuery<any>({ queryKey:["/api/admin/smm-orders"],     queryFn:()=>authFetch("/api/admin/smm-orders"),     refetchInterval:60000 });
  const { data: proxyData }   = useQuery<any>({ queryKey:["/api/admin/proxy-orders"],   queryFn:()=>authFetch("/api/admin/proxy-orders"),   refetchInterval:60000 });
  const { data: digitalData } = useQuery<any>({ queryKey:["/api/admin/digital-orders"], queryFn:()=>authFetch("/api/admin/digital-orders"), refetchInterval:60000 });
  const { data: cbData }      = useQuery<any>({ queryKey:["/api/admin/tradingbot/stats"],  queryFn:()=>authFetch("/api/admin/tradingbot/stats"),  refetchInterval:60000 });
  const smmOrders     = smmData?.orders     || [];
  const proxyOrders   = proxyData?.orders   || [];
  const digitalOrders = digitalData?.orders || [];
  const smmRevenue     = smmOrders.filter((o:any)=>o.status!=='failed').reduce((s:number,o:any)=>s+(parseFloat(o.amount_kes)||0),0);
  const proxyRevenue   = proxyOrders.filter((o:any)=>o.status!=='failed').reduce((s:number,o:any)=>s+(parseFloat(o.amount_kes)||0),0);
  const digitalRevenue = digitalOrders.filter((o:any)=>o.status==='delivered').reduce((s:number,o:any)=>s+(parseFloat(o.amount_kes)||0),0);
  const cbRevenue      = parseFloat(cbData?.totalRevenue || 0);
  const totalStoreRevenue = (stats?.revenue||0) + (botStats?.revenue||0) + smmRevenue + proxyRevenue + digitalRevenue + cbRevenue;
  const daily: Array<{ date: string; revenue: number; orders: number }> = analyticsData?.daily ?? [];
  const topPlans: Array<{ planName: string; revenue: number; orders: number }> = analyticsData?.topPlans ?? [];
  const maxRevenue = Math.max(...daily.map((d) => d.revenue), 1);
  const maxPlanRev = Math.max(...topPlans.map((p) => p.revenue), 1);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <Button size="sm" variant="outline" onClick={() => refetch()}
          className="glass border-white/10 text-white/60 hover:text-white" data-testid="button-refresh">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl glass animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <GlassStatCard title="Total Revenue" value={`KES ${(stats?.revenue || 0).toLocaleString()}`} icon={TrendingUp} gradient="from-emerald-500 to-teal-600" glow="rgba(16,185,129,0.3)" />
            <GlassStatCard title="Total Orders" value={stats?.total ?? 0} icon={ArrowLeftRight} gradient="from-indigo-500 to-blue-600" glow="rgba(99,102,241,0.3)" />
            <GlassStatCard title="Emails Sent" value={stats?.emailsSent ?? 0} icon={Mail} gradient="from-violet-500 to-purple-600" glow="rgba(139,92,246,0.3)" />
            <GlassStatCard title="Active Accounts" value={accStats?.totalAccounts ?? 0} icon={Package} gradient="from-cyan-500 to-blue-500" glow="rgba(6,182,212,0.3)" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <GlassStatCard title="Bot Orders" value={botStats?.total ?? 0} icon={Bot} gradient="from-green-500 to-emerald-600" glow="rgba(34,197,94,0.3)" />
            <GlassStatCard title="Bot Revenue" value={`KES ${(botStats?.revenue || 0).toLocaleString()}`} icon={TrendingUp} gradient="from-lime-500 to-green-600" glow="rgba(132,204,22,0.3)" />
            <GlassStatCard title="Bots Deployed" value={botStats?.deployed ?? 0} icon={Zap} gradient="from-teal-500 to-cyan-600" glow="rgba(20,184,166,0.3)" />
          </div>
          <div className="glass-card rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">⚡</span>
              <h3 className="font-semibold text-white text-sm">ChegeBot Pro — Deriv Trading Bot</h3>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">Subscriptions</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/5 border border-white/8 rounded-xl p-3">
                <p className="text-xs text-white/40 mb-1">Active Subscribers</p>
                <p className="text-2xl font-bold text-white">{cbData?.activeSubs ?? '—'}</p>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-xl p-3">
                <p className="text-xs text-white/40 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-amber-400">KES {(cbData?.totalRevenue || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-xl p-3">
                <p className="text-xs text-white/40 mb-1">This Month</p>
                <p className="text-2xl font-bold text-cyan-400">KES {(cbData?.monthRevenue || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white/5 border border-white/8 rounded-xl p-3">
                <p className="text-xs text-white/40 mb-1">Lifetime Members</p>
                <p className="text-2xl font-bold text-purple-400">{cbData?.lifetimeSubs ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: "Completed", value: stats?.completed ?? 0, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Pending", value: stats?.pending ?? 0, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
              { label: "Available Slots", value: accStats?.availableSlots ?? 0, icon: Users, color: "text-cyan-400", bg: "bg-cyan-500/10" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="glass-card rounded-2xl p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}><Icon className={`w-4 h-4 ${color}`} /></div>
                <div><p className="text-xs text-white/40">{label}</p><p className="text-xl font-bold text-white">{value}</p></div>
              </div>
            ))}
          </div>

          {/* ── Revenue Streams ─────────────────────────────────────── */}
          <div className="glass-card rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <h3 className="font-semibold text-white text-sm">All Revenue Streams</h3>
              </div>
              <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-lg">Total: <span className="text-emerald-400 font-bold">KES {totalStoreRevenue.toLocaleString()}</span></span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label:"Premium Accounts", revenue:stats?.revenue||0,    orders:stats?.total||0,          color:"from-indigo-500 to-blue-600",    icon:"🛒" },
                { label:"WhatsApp Bots",    revenue:botStats?.revenue||0,  orders:botStats?.total||0,       color:"from-green-500 to-emerald-600",  icon:"🤖" },
                { label:"SMM Boost",        revenue:smmRevenue,            orders:smmOrders.length,         color:"from-pink-500 to-rose-600",      icon:"📈" },
                { label:"Proxies",          revenue:proxyRevenue,          orders:proxyOrders.length,       color:"from-emerald-500 to-teal-600",   icon:"🛡️" },
                { label:"Aged Accounts",    revenue:digitalRevenue,        orders:digitalOrders.length,     color:"from-violet-500 to-purple-600",  icon:"👤" },
                { label:"ChegeBot Pro",      revenue:cbRevenue,             orders:cbData?.totalSubs||0,     color:"from-amber-500 to-orange-600",   icon:"⚡" },
              ].map(s=>(
                <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-base">{s.icon}</span>
                    <span className="text-xs text-white/40 truncate">{s.label}</span>
                  </div>
                  <p className="text-lg font-bold text-white">KES {s.revenue.toLocaleString()}</p>
                  <p className="text-xs text-white/30 mt-0.5">{s.orders} orders</p>
                  <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${s.color}`} style={{width:totalStoreRevenue>0?`${Math.round((s.revenue/totalStoreRevenue)*100)}%`:'0%'}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── New product order counters ─────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {[
              { label:"SMM Orders",          value:smmOrders.length,                                                               icon:TrendingUp, color:"text-pink-400",    bg:"bg-pink-500/10"    },
              { label:"SMM Pending",         value:smmOrders.filter((o:any)=>o.status==='pending').length,                         icon:Clock,      color:"text-amber-400",   bg:"bg-amber-500/10"   },
              { label:"Proxy Orders",        value:proxyOrders.length,                                                             icon:Shield,     color:"text-emerald-400", bg:"bg-emerald-500/10" },
              { label:"Proxy Active",        value:proxyOrders.filter((o:any)=>o.status==='active').length,                        icon:Zap,        color:"text-cyan-400",    bg:"bg-cyan-500/10"    },
              { label:"Aged Acct Orders",    value:digitalOrders.length,                                                           icon:Users,      color:"text-violet-400",  bg:"bg-violet-500/10"  },
              { label:"Accts Delivered",     value:digitalOrders.filter((o:any)=>o.status==='delivered').length,                   icon:CheckCircle,color:"text-emerald-400", bg:"bg-emerald-500/10" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="glass-card rounded-xl p-3 flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}><Icon className={`w-3.5 h-3.5 ${color}`} /></div>
                <div><p className="text-xs text-white/40 leading-tight">{label}</p><p className="text-lg font-bold text-white">{value}</p></div>
              </div>
            ))}
          </div>

          {daily.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-semibold text-white text-sm">Revenue — Last 14 Days</h3>
                </div>
                <div className="flex items-end gap-1 h-24">
                  {daily.map((d) => {
                    const heightPct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
                    const label = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${label}: KES ${d.revenue.toLocaleString()}`}>
                        <div
                          className="w-full rounded-t-sm bg-gradient-to-t from-indigo-600 to-violet-500 opacity-70 group-hover:opacity-100 transition-all min-h-[2px]"
                          style={{ height: `${Math.max(heightPct, d.revenue > 0 ? 8 : 2)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-white/25">{daily[0]?.date ? new Date(daily[0].date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
                  <span className="text-xs text-white/25">Today</span>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-semibold text-white text-sm">Top Plans by Revenue</h3>
                </div>
                {topPlans.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-6">No sales yet</p>
                ) : (
                  <div className="space-y-3">
                    {topPlans.map((plan, i) => (
                      <div key={plan.planName}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-white/70 font-medium truncate max-w-[60%]">{plan.planName}</span>
                          <span className="text-xs text-indigo-400 font-bold">KES {plan.revenue.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${i === 0 ? "bg-gradient-to-r from-indigo-500 to-violet-500" : i === 1 ? "bg-gradient-to-r from-cyan-500 to-blue-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"}`}
                            style={{ width: `${(plan.revenue / maxPlanRev) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-white/30 mt-0.5">{plan.orders} order{plan.orders !== 1 ? "s" : ""}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLANS TAB
// ═══════════════════════════════════════════════════════════════
function PlansTab() {
  const { toast } = useToast();
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ price: string; offerLabel: string }>({ price: "", offerLabel: "" });
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [expandedCat, setExpandedCat] = useState<Record<string, boolean>>({});
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatDisplayName, setNewCatDisplayName] = useState("");
  const [newCatKey, setNewCatKey] = useState("");

  const { data: plansData, refetch: refetchPlans } = useQuery<any>({ queryKey: ["/api/plans"] });
  const { data: overridesData, refetch: refetchOverrides } = useQuery<any>({
    queryKey: ["/api/admin/plan-overrides"],
    queryFn: () => authFetch("/api/admin/plan-overrides"),
  });
  const { data: customPlansData, refetch: refetchCustom } = useQuery<any>({
    queryKey: ["/api/admin/custom-plans"],
    queryFn: () => authFetch("/api/admin/custom-plans"),
  });

  const overrides: Record<string, any> = overridesData?.overrides ?? {};
  const categories = plansData?.categories ?? {};

  const updatePlanMutation = useMutation({
    mutationFn: ({ planId, data }: { planId: string; data: any }) =>
      authFetch(`/api/admin/plans/${planId}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Plan updated" }); refetchPlans(); refetchOverrides(); setEditingPlan(null); },
  });

  const toggleDisableMutation = useMutation({
    mutationFn: ({ planId, disabled }: { planId: string; disabled: boolean }) =>
      authFetch(`/api/admin/plans/${planId}`, { method: "PUT", body: JSON.stringify({ disabled }) }),
    onSuccess: () => { refetchPlans(); refetchOverrides(); },
  });

  const resetOverrideMutation = useMutation({
    mutationFn: (planId: string) => authFetch(`/api/admin/plans/${planId}/override`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Override removed" }); refetchPlans(); refetchOverrides(); },
  });

  const deleteCustomMutation = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/custom-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Custom plan removed" }); refetchPlans(); refetchCustom(); },
  });

  const addCustomForm = useForm({
    defaultValues: { name: "", price: "", duration: "1 Month", features: "", categoryKey: "streaming", categoryName: "Streaming Services", maxUsers: "5", clientId: "", clientSecret: "", serviceUrl: "" },
  });

  const addCustomMutation = useMutation({
    mutationFn: (d: any) => authFetch("/api/admin/custom-plans", {
      method: "POST",
      body: JSON.stringify({ ...d, price: parseInt(d.price), maxUsers: parseInt(d.maxUsers), features: d.features.split(",").map((f: string) => f.trim()).filter(Boolean) }),
    }),
    onSuccess: () => { toast({ title: "Custom plan added" }); setShowAddCustom(false); addCustomForm.reset(); setNewCatMode(false); setNewCatDisplayName(""); setNewCatKey(""); refetchPlans(); refetchCustom(); },
  });

  const allPlanEntries = Object.entries(categories).flatMap(([catKey, cat]: [string, any]) =>
    Object.entries(cat.plans).map(([planId, plan]: [string, any]) => ({ planId, plan, catKey, catName: cat.category }))
  );

  const grouped = allPlanEntries.reduce((acc, entry) => {
    if (!acc[entry.catKey]) acc[entry.catKey] = { name: entry.catName, plans: [] };
    acc[entry.catKey].plans.push(entry);
    return acc;
  }, {} as Record<string, { name: string; plans: typeof allPlanEntries }>);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Plans & Offers</h1>
        <Button size="sm" onClick={() => setShowAddCustom(!showAddCustom)}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white shadow-lg hover:opacity-90"
          data-testid="button-add-custom-plan">
          <Plus className="w-3.5 h-3.5 mr-1.5" />Add Custom Plan
        </Button>
      </div>

      {showAddCustom && (
        <div className="glass-card rounded-2xl p-5 mb-6">
          <h3 className="font-semibold text-white mb-4">Add Custom Plan</h3>
          <form
            onSubmit={addCustomForm.handleSubmit((d) => {
              const finalKey = newCatMode ? newCatKey.trim() : d.categoryKey;
              const finalName = newCatMode ? newCatDisplayName.trim() : (categories[d.categoryKey]?.category ?? d.categoryKey);
              addCustomMutation.mutate({ ...d, categoryKey: finalKey, categoryName: finalName });
            })}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-white/50 block mb-1">Plan Name</label><Input {...addCustomForm.register("name")} placeholder="e.g. Disney+" className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Price (KES)</label><Input {...addCustomForm.register("price")} type="number" placeholder="250" className="glass border-white/10 bg-white/5 text-white" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Duration</label><Input {...addCustomForm.register("duration")} placeholder="1 Month" className="glass border-white/10 bg-white/5 text-white" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Max Users</label><Input {...addCustomForm.register("maxUsers")} type="number" placeholder="5" className="glass border-white/10 bg-white/5 text-white" /></div>

              {/* ── Category picker ── */}
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-white/50">Category</label>
                  <button
                    type="button"
                    onClick={() => { setNewCatMode(m => !m); setNewCatDisplayName(""); setNewCatKey(""); }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                  >
                    {newCatMode ? (
                      <><X className="w-3 h-3" />Use existing</>
                    ) : (
                      <><Plus className="w-3 h-3" />New category</>
                    )}
                  </button>
                </div>

                {newCatMode ? (
                  /* ── Inline new-category creator ── */
                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 space-y-2">
                    <p className="text-xs text-indigo-300/70 mb-2">Enter a name for your new category and we'll generate its ID automatically.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-white/40 block mb-1">Display Name <span className="text-red-400">*</span></label>
                        <Input
                          value={newCatDisplayName}
                          onChange={e => {
                            const val = e.target.value;
                            setNewCatDisplayName(val);
                            setNewCatKey(val.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
                          }}
                          placeholder="e.g. Sports & Live TV"
                          className="glass border-white/10 bg-white/5 text-white placeholder:text-white/20 h-8 text-sm"
                          required={newCatMode}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/40 block mb-1">Category ID <span className="text-white/25">(auto)</span></label>
                        <Input
                          value={newCatKey}
                          onChange={e => setNewCatKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                          placeholder="sports_live_tv"
                          className="glass border-white/10 bg-white/5 text-white/60 placeholder:text-white/20 h-8 text-sm font-mono"
                          required={newCatMode}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Existing category select (dynamic from plansData) ── */
                  <select
                    {...addCustomForm.register("categoryKey")}
                    className="w-full h-9 rounded-lg glass border border-white/10 bg-background/50 text-white/80 px-3 text-sm"
                  >
                    {Object.entries(categories).map(([key, cat]: [string, any]) => (
                      <option key={key} value={key}>{cat.category}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div><label className="text-xs text-white/50 block mb-1">Features (comma-separated)</label><Input {...addCustomForm.register("features")} placeholder="HD Streaming, Multiple Devices" className="glass border-white/10 bg-white/5 text-white" /></div>

            {/* ── Service / API credentials ── */}
            <div className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-3">
              <p className="text-xs text-white/40 font-medium tracking-wide uppercase">Service Credentials <span className="normal-case text-white/25 font-normal">(optional — stored securely)</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1">Client ID</label>
                  <Input
                    {...addCustomForm.register("clientId")}
                    placeholder="e.g. cid_abc123"
                    className="glass border-white/10 bg-white/5 text-white placeholder:text-white/20 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">Client Secret</label>
                  <Input
                    {...addCustomForm.register("clientSecret")}
                    type="password"
                    placeholder="••••••••••••"
                    className="glass border-white/10 bg-white/5 text-white placeholder:text-white/20 font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Service URL <span className="text-white/25">(API / dashboard endpoint)</span></label>
                <Input
                  {...addCustomForm.register("serviceUrl")}
                  placeholder="https://api.yourservice.com"
                  className="glass border-white/10 bg-white/5 text-white placeholder:text-white/20 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={addCustomMutation.isPending || (newCatMode && (!newCatDisplayName.trim() || !newCatKey.trim()))}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white"
              >
                {addCustomMutation.isPending ? "Saving..." : "Save Plan"}
              </Button>
              <Button type="button" variant="outline" className="glass border-white/10 text-white/60" onClick={() => { setShowAddCustom(false); setNewCatMode(false); }}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(grouped).map(([catKey, { name, plans }]) => {
          const isExpanded = expandedCat[catKey] !== false;
          return (
            <div key={catKey} className="glass-card rounded-2xl overflow-hidden">
              <button className="w-full p-4 flex items-center justify-between text-left" onClick={() => setExpandedCat((p) => ({ ...p, [catKey]: !isExpanded }))}>
                <span className="font-semibold text-white">{name}</span>
                <div className="flex items-center gap-2">
                  <Badge className="glass border-white/10 text-white/60 text-xs">{plans.length} plans</Badge>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-white/8 divide-y divide-white/5">
                  {plans.map(({ planId, plan }) => {
                    const override = overrides[planId] || {};
                    const isDisabled = override.disabled;
                    const isEditing = editingPlan === planId;
                    const hasOverride = override.priceOverride !== undefined || override.offerLabel;
                    return (
                      <div key={planId} className={`p-4 ${isDisabled ? "opacity-50" : ""}`} data-testid={`plan-row-${planId}`}>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-white">{plan.name}</span>
                              {plan.isCustom && <Badge className="glass border-white/10 text-white/50 text-xs">Custom</Badge>}
                              {override.offerLabel && <Badge className="bg-amber-500/80 text-white border-0 text-xs">{override.offerLabel}</Badge>}
                              {isDisabled && <Badge className="glass border-white/10 text-white/40 text-xs">Disabled</Badge>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {override.priceOverride ? (
                                <>
                                  <span className="text-sm font-bold text-indigo-400">KES {(override.priceOverride ?? 0).toLocaleString()}</span>
                                  <span className="text-xs text-white/30 line-through">KES {(plan.originalPrice ?? plan.price ?? 0).toLocaleString()}</span>
                                </>
                              ) : (
                                <span className="text-sm font-bold text-white/80">KES {(plan.price ?? 0).toLocaleString()}</span>
                              )}
                              <span className="text-xs text-white/30">· {plan.duration}</span>
                            </div>
                            {(plan.clientId || plan.serviceUrl) && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {plan.clientId && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-violet-500/10 border border-violet-500/20 text-violet-300/70 rounded px-1.5 py-0.5">
                                    <span className="text-violet-400/50">id:</span>{plan.clientId}
                                  </span>
                                )}
                                {plan.clientSecret && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-white/5 border border-white/10 text-white/30 rounded px-1.5 py-0.5">
                                    secret: ••••••••
                                  </span>
                                )}
                                {plan.serviceUrl && (
                                  <a href={plan.serviceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400/60 hover:text-indigo-400 underline truncate max-w-[140px]">
                                    {plan.serviceUrl.replace(/^https?:\/\//, "")}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Input value={editValues.price} onChange={(e) => setEditValues((p) => ({ ...p, price: e.target.value }))} className="w-28 h-8 text-sm glass border-white/10 bg-white/5 text-white" placeholder="Price KES" />
                              <Input value={editValues.offerLabel} onChange={(e) => setEditValues((p) => ({ ...p, offerLabel: e.target.value }))} className="w-32 h-8 text-sm glass border-white/10 bg-white/5 text-white" placeholder="Offer label" />
                              <Button size="sm" onClick={() => {
                                const price = parseInt(editValues.price);
                                if (isNaN(price) || price <= 0) { toast({ title: "Invalid price", variant: "destructive" }); return; }
                                updatePlanMutation.mutate({ planId, data: { priceOverride: price, offerLabel: editValues.offerLabel || undefined } });
                              }} disabled={updatePlanMutation.isPending} className="bg-indigo-600 border-0 text-white h-8">
                                <Save className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-white/40 h-8" onClick={() => setEditingPlan(null)}><X className="w-3.5 h-3.5" /></Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button size="sm" variant="outline" className="glass border-white/10 text-white/60 hover:text-white h-8"
                                onClick={() => { setEditingPlan(planId); setEditValues({ price: String(override.priceOverride ?? plan.price), offerLabel: override.offerLabel ?? "" }); }}>
                                <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                              </Button>
                              {hasOverride && (
                                <Button size="sm" variant="ghost" className="text-white/30 hover:text-white/60 h-8" onClick={() => resetOverrideMutation.mutate(planId)} title="Reset to original">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <div className="flex items-center gap-1.5" title={isDisabled ? "Enable plan" : "Disable plan"}>
                                {isDisabled ? <Lock className="w-3 h-3 text-white/30" /> : <Unlock className="w-3 h-3 text-white/30" />}
                                <Switch checked={!isDisabled} onCheckedChange={(v) => toggleDisableMutation.mutate({ planId, disabled: !v })} />
                              </div>
                              {plan.isCustom && (
                                <Button size="icon" variant="ghost" className="text-red-400/60 hover:text-red-400 h-8 w-8" onClick={() => deleteCustomMutation.mutate(planId)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// ACCOUNTS TAB
// ═══════════════════════════════════════════════════════════════
function BulkUploadModal({ planOptions, onClose, onSuccess }: { planOptions: any[]; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [planId, setPlanId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const HEADERS = ["email", "password", "username", "activationCode", "redeemLink", "instructions", "maxUsers"];

  function parseCSV(text: string): any[] {
    const lines = text.trim().split("\n").filter((l) => l.trim());
    if (!lines.length) return [];
    const first = lines[0].toLowerCase();
    const hasHeader = HEADERS.some((h) => first.includes(h));
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      return {
        email: cols[0] || "", password: cols[1] || "", username: cols[2] || "",
        activationCode: cols[3] || "", redeemLink: cols[4] || "", instructions: cols[5] || "",
        maxUsers: parseInt(cols[6]) || 5,
      };
    }).filter((r) => r.email || r.password);
  }

  const parsed = csvText ? parseCSV(csvText) : [];

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string || "");
    reader.readAsText(file);
  }

  async function handleSubmit() {
    if (!planId) { toast({ title: "Select a plan first", variant: "destructive" }); return; }
    if (!parsed.length) { toast({ title: "No valid rows found", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const res = await authFetch("/api/admin/accounts/bulk", {
        method: "POST",
        body: JSON.stringify({ planId, accounts: parsed }),
      });
      if (res.success) {
        toast({ title: `${res.added} account${res.added !== 1 ? "s" : ""} added!`, description: res.errors?.length ? `${res.errors.length} row(s) had errors` : undefined });
        onSuccess();
        onClose();
      } else {
        toast({ title: "Upload failed", description: res.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl glass-card rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-white text-lg">Bulk Account Upload</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs text-white/50 block mb-1">Plan *</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)}
              className="w-full h-9 rounded-lg glass border border-white/10 bg-background/50 text-white/80 px-3 text-sm"
              data-testid="select-bulk-plan">
              <option value="">Select a plan</option>
              {planOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.name} ({opt.category})</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-white/50">CSV Data *</label>
              <label className="text-xs text-indigo-400 cursor-pointer hover:text-indigo-300 flex items-center gap-1" data-testid="label-upload-file">
                <Upload className="w-3 h-3" />Upload .csv file
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
              </label>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`Paste CSV rows here. Supported format:\nemail,password,username,activationCode,redeemLink,instructions,maxUsers\n\nExample:\nuser@netflix.com,pass123,,,,,5\nuser2@netflix.com,pass456`}
              rows={8}
              className="w-full rounded-xl glass border border-white/10 bg-white/5 text-white placeholder:text-white/20 p-3 text-sm font-mono resize-none focus:outline-none focus:border-indigo-500/50"
              data-testid="textarea-csv"
            />
            <p className="text-xs text-white/30 mt-1">Header row is auto-detected and skipped. Minimum: email,password</p>
          </div>

          {parsed.length > 0 && (
            <div>
              <p className="text-xs text-white/50 mb-2">{parsed.length} row{parsed.length !== 1 ? "s" : ""} detected — preview:</p>
              <div className="rounded-xl overflow-hidden border border-white/8 max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-white/5 text-white/40"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Password</th><th className="px-3 py-2 text-left">Slots</th></tr></thead>
                  <tbody>
                    {parsed.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-white/5 hover:bg-white/3" data-testid={`preview-row-${i}`}>
                        <td className="px-3 py-1.5 text-white/30">{i + 1}</td>
                        <td className="px-3 py-1.5 text-white/70 font-mono">{r.email || <span className="text-white/20">—</span>}</td>
                        <td className="px-3 py-1.5 text-white/50 font-mono">{r.password ? "••••••" : <span className="text-white/20">—</span>}</td>
                        <td className="px-3 py-1.5 text-white/50">{r.maxUsers}</td>
                      </tr>
                    ))}
                    {parsed.length > 20 && <tr><td colSpan={4} className="px-3 py-2 text-white/30 text-center">... and {parsed.length - 20} more</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSubmit} disabled={submitting || !planId || !parsed.length}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white flex-1"
              data-testid="button-bulk-submit">
              {submitting ? "Uploading..." : `Upload ${parsed.length || ""} Account${parsed.length !== 1 ? "s" : ""}`}
            </Button>
            <Button variant="outline" className="glass border-white/10 text-white/60" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});

  const { data: accData, refetch } = useQuery<any>({
    queryKey: ["/api/admin/accounts"],
    queryFn: () => authFetch("/api/admin/accounts"),
  });
  const { data: plansData } = useQuery<any>({ queryKey: ["/api/plans"] });

  const allPlanOptions = plansData?.categories
    ? Object.entries(plansData.categories).flatMap(([, cat]: [string, any]) =>
        Object.entries(cat.plans).map(([planId, plan]: [string, any]) => ({ id: planId, name: plan.name, category: cat.category }))
      )
    : [];

  const addForm = useForm({ defaultValues: { planId: "", email: "", username: "", password: "", activationCode: "", redeemLink: "", instructions: "", maxUsers: "5" } });

  const addMutation = useMutation({
    mutationFn: (d: any) => authFetch("/api/admin/accounts", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: (d: any) => {
      if (d.success) { toast({ title: "Account added" }); addForm.reset(); setShowAddForm(false); refetch(); qc.invalidateQueries({ queryKey: ["/api/plans"] }); }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => authFetch(`/api/admin/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Account updated" }); setEditingId(null); refetch(); },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/accounts/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ["/api/plans"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Account removed" }); refetch(); qc.invalidateQueries({ queryKey: ["/api/plans"] }); },
  });

  const accounts: Record<string, any[]> = accData?.accounts ?? {};
  const inputCls = "glass border-white/10 bg-white/5 text-white placeholder:text-white/25 h-8 text-sm";

  return (
    <>
      {showBulkUpload && (
        <BulkUploadModal
          planOptions={allPlanOptions}
          onClose={() => setShowBulkUpload(false)}
          onSuccess={() => { refetch(); qc.invalidateQueries({ queryKey: ["/api/plans"] }); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Account Inventory</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowBulkUpload(true)}
            className="glass border-white/10 text-white/60 hover:text-white"
            data-testid="button-bulk-upload">
            <Upload className="w-3.5 h-3.5 mr-1.5" />Bulk Upload
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white shadow-lg hover:opacity-90"
            data-testid="button-add-account">
            <Plus className="w-3.5 h-3.5 mr-1.5" />Add Account
          </Button>
        </div>
      </div>

      {showAddForm && (
        <div className="glass-card rounded-2xl p-5 mb-6">
          <h3 className="font-semibold text-white mb-4">Add New Account</h3>
          <form onSubmit={addForm.handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 block mb-1">Plan</label>
                <select {...addForm.register("planId")} className="w-full h-9 rounded-lg glass border border-white/10 bg-background/50 text-white/80 px-3 text-sm" data-testid="select-plan">
                  <option value="">Select a plan</option>
                  {allPlanOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.name} ({opt.category})</option>)}
                </select>
              </div>
              <div><label className="text-xs text-white/50 block mb-1">Max Slots</label><Input {...addForm.register("maxUsers")} type="number" className={inputCls} data-testid="input-max-users" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Email</label><Input {...addForm.register("email")} placeholder="account@service.com" className={inputCls} data-testid="input-account-email" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Password</label><Input {...addForm.register("password")} className={inputCls} data-testid="input-account-password" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Username (optional)</label><Input {...addForm.register("username")} className={inputCls} /></div>
              <div><label className="text-xs text-white/50 block mb-1">Activation Code (optional)</label><Input {...addForm.register("activationCode")} className={inputCls} /></div>
              <div className="sm:col-span-2"><label className="text-xs text-white/50 block mb-1">Instructions (optional)</label><Input {...addForm.register("instructions")} className={inputCls} /></div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={addMutation.isPending} className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white">
                {addMutation.isPending ? "Saving..." : "Save Account"}
              </Button>
              <Button type="button" variant="outline" className="glass border-white/10 text-white/60" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {Object.keys(accounts).length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl">
          <Package className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
          <p className="font-semibold text-white">No accounts yet</p>
          <p className="text-sm text-white/40">Click "Add Account" to add your first account</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(accounts).map(([planId, accs]) => {
            const planName = allPlanOptions.find((p) => p.id === planId)?.name ?? planId;
            const isExpanded = expandedPlans[planId] !== false;
            return (
              <div key={planId} className="glass-card rounded-2xl overflow-hidden" data-testid={`account-group-${planId}`}>
                <button className="w-full p-4 flex items-center justify-between gap-4 text-left" onClick={() => setExpandedPlans((p) => ({ ...p, [planId]: !isExpanded }))}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600/20 flex items-center justify-center"><Package className="w-4 h-4 text-indigo-400" /></div>
                    <div><p className="font-semibold text-sm text-white">{planName}</p><p className="text-xs text-white/40">{accs.length} account{accs.length !== 1 ? "s" : ""}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${accs.some((a) => !a.fullyUsed && !a.disabled) ? "bg-emerald-600/80 text-white border-0" : "glass border-white/10 text-white/50"}`}>
                      {accs.filter((a) => !a.fullyUsed && !a.disabled).length} available
                    </Badge>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/8 divide-y divide-white/5">
                    {accs.map((acc: any) => (
                      <div key={acc.id} className={`p-4 ${acc.disabled ? "opacity-50" : ""}`} data-testid={`account-row-${acc.id}`}>
                        {editingId === acc.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div><label className="text-xs text-white/40">Email</label><Input value={editValues.email ?? ""} onChange={(e) => setEditValues((p: any) => ({ ...p, email: e.target.value }))} className={inputCls + " mt-1"} /></div>
                              <div>
                                <label className="text-xs text-white/40">Password</label>
                                {acc.hasPassword && <span className="text-[10px] text-amber-400/70 ml-2">Password set — leave blank to keep</span>}
                                <Input type="password" value={editValues.password ?? ""} onChange={(e) => setEditValues((p: any) => ({ ...p, password: e.target.value }))} className={inputCls + " mt-1"} placeholder={acc.hasPassword ? "Leave blank to keep current" : "No password set"} autoComplete="new-password" />
                              </div>
                              <div><label className="text-xs text-white/40">Username</label><Input value={editValues.username ?? ""} onChange={(e) => setEditValues((p: any) => ({ ...p, username: e.target.value }))} className={inputCls + " mt-1"} /></div>
                              <div><label className="text-xs text-white/40">Max Slots</label><Input type="number" value={editValues.maxUsers ?? 5} onChange={(e) => setEditValues((p: any) => ({ ...p, maxUsers: parseInt(e.target.value) }))} className={inputCls + " mt-1"} /></div>
                              <div className="col-span-2"><label className="text-xs text-white/40">Instructions</label><Input value={editValues.instructions ?? ""} onChange={(e) => setEditValues((p: any) => ({ ...p, instructions: e.target.value }))} className={inputCls + " mt-1"} /></div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => updateMutation.mutate({ id: acc.id, data: editValues })} disabled={updateMutation.isPending} className="bg-indigo-600 border-0 text-white h-8">
                                <Save className="w-3.5 h-3.5 mr-1" />Save
                              </Button>
                              <Button size="sm" variant="ghost" className="text-white/40 h-8" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-white">{acc.email || acc.username || "No identifier"}</span>
                                {acc.disabled ? (
                                  <Badge className="glass border-white/10 text-white/40 text-xs">Disabled</Badge>
                                ) : acc.fullyUsed ? (
                                  <Badge className="glass border-white/10 text-white/40 text-xs">Full</Badge>
                                ) : (
                                  <Badge className="bg-emerald-600/70 text-white border-0 text-xs">{acc.currentUsers}/{acc.maxUsers} slots</Badge>
                                )}
                                {acc.hasPassword && <Badge className="glass border-white/10 text-white/30 text-xs">🔑 Password set</Badge>}
                              </div>
                              <p className="text-xs text-white/30 mt-0.5">Added {new Date(acc.addedAt).toLocaleDateString()} · {acc.usedBy?.length ?? 0} assigned</p>
                              {acc.usedBy && acc.usedBy.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {acc.usedBy.map((u: any, ui: number) => {
                                    const expDate = u.expiresAt ? new Date(u.expiresAt) : null;
                                    const isExpired = expDate && expDate < new Date();
                                    const expSoon = expDate && !isExpired && expDate < new Date(Date.now() + 3*86400000);
                                    return (
                                      <div key={ui} className="flex items-center gap-2 text-[11px]">
                                        <span className="text-white/50 truncate max-w-[160px]">{u.customerEmail}</span>
                                        {expDate ? (
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isExpired ? "bg-red-500/20 text-red-400" : expSoon ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-white/30"}`}>
                                            {isExpired ? "Expired" : "Expires"} {expDate.toLocaleDateString()}
                                          </span>
                                        ) : <span className="text-white/20">No expiry</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button size="sm" variant="outline" className="glass border-white/10 text-white/60 hover:text-white h-8"
                                onClick={() => { setEditingId(acc.id); setEditValues({ email: acc.email, password: "", username: acc.username, maxUsers: acc.maxUsers, instructions: acc.instructions }); }}>
                                <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                              </Button>
                              <Button size="sm" variant="outline"
                                className={`h-8 ${acc.disabled ? "bg-indigo-600/80 border-indigo-500/50 text-white" : "glass border-white/10 text-white/60 hover:text-white"}`}
                                onClick={() => toggleMutation.mutate(acc.id)}>
                                <Power className="w-3.5 h-3.5 mr-1" />{acc.disabled ? "Enable" : "Disable"}
                              </Button>
                              <Button size="icon" variant="ghost" className="text-red-400/50 hover:text-red-400 h-8 w-8" onClick={() => deleteMutation.mutate(acc.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── PlanSelector: multi-select checklist for promo plan restriction ─────────
function PlanSelector({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const { data } = useQuery<any>({
    queryKey: ["/api/plans"],
    queryFn: () => fetch("/api/plans").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const categories: Record<string, any> = data?.categories ?? {};
  const allPlans: { id: string; name: string; category: string }[] = [];
  for (const [, cat] of Object.entries(categories)) {
    for (const [id, plan] of Object.entries((cat as any).plans ?? {})) {
      allPlans.push({ id, name: (plan as any).name, category: (cat as any).category });
    }
  }

  if (!allPlans.length) return <p className="text-xs text-white/30 italic">Loading plans…</p>;

  const grouped: Record<string, typeof allPlans> = {};
  for (const p of allPlans) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className="glass border border-white/10 rounded-xl p-3 max-h-52 overflow-y-auto space-y-3">
      {Object.entries(grouped).map(([cat, plans]) => (
        <div key={cat}>
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1">{cat}</p>
          <div className="flex flex-wrap gap-1.5">
            {plans.map((p) => {
              const active = selected.includes(p.id);
              return (
                <button key={p.id} type="button" onClick={() => toggle(p.id)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${active ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/60"}`}>
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// PROMO CODES TAB
// ═══════════════════════════════════════════════════════════════
function PromosTab() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);

  const { data, refetch } = useQuery<any>({
    queryKey: ["/api/admin/promo-codes"],
    queryFn: () => authFetch("/api/admin/promo-codes"),
  });
  const codes: any[] = data?.codes ?? [];

  const form = useForm({
    defaultValues: { code: "", label: "", discountType: "percent", discountValue: "", maxUses: "", expiresAt: "", applicableTo: "all", applicablePlans: [] as string[] },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => authFetch("/api/admin/promo-codes", {
      method: "POST",
      body: JSON.stringify({ ...d, active: true, discountValue: parseInt(d.discountValue), maxUses: d.maxUses ? parseInt(d.maxUses) : null, expiresAt: d.expiresAt || null, applicablePlans: Array.isArray(d.applicablePlans) && d.applicablePlans.length > 0 ? d.applicablePlans : null, applicableTo: d.applicableTo || "all" }),
    }),
    onSuccess: (d: any) => {
      if (d.success) { toast({ title: "Promo code created!" }); form.reset({ code: "", label: "", discountType: "percent", discountValue: "", maxUses: "", expiresAt: "", applicableTo: "all", applicablePlans: [] }); setShowAdd(false); refetch(); }
      else toast({ title: "Error", description: d.error, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ code, active }: { code: string; active: boolean }) =>
      authFetch(`/api/admin/promo-codes/${code}`, { method: "PUT", body: JSON.stringify({ active }) }),
    onSuccess: (d: any) => {
      if (d.success) refetch();
      else toast({ title: "Failed to update promo code", description: d.error || "Unknown error", variant: "destructive" });
    },
    onError: (err: any) => {
      toast({ title: "Network error", description: err.message || "Could not update promo code", variant: "destructive" });
      refetch(); // revert switch to server state
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) => authFetch(`/api/admin/promo-codes/${code}`, { method: "DELETE" }),
    onSuccess: (d: any) => { if (d.success) { toast({ title: "Promo code deleted" }); refetch(); } else toast({ title: "Delete failed", description: d.error, variant: "destructive" }); },
  });

  const inputCls = "glass border-white/10 bg-white/5 text-white placeholder:text-white/25";

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Promo Codes</h1>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}
          className="bg-gradient-to-r from-amber-500 to-orange-600 border-0 text-white shadow-lg hover:opacity-90"
          data-testid="button-add-promo">
          <Plus className="w-3.5 h-3.5 mr-1.5" />Create Code
        </Button>
      </div>

      {showAdd && (
        <div className="glass-card rounded-2xl p-5 mb-6">
          <h3 className="font-semibold text-white mb-4">Create Promo Code</h3>
          <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-white/50 block mb-1">Code</label><Input {...form.register("code")} placeholder="SAVE20" className={inputCls + " uppercase font-mono"} data-testid="input-promo-code" /></div>
              <div><label className="text-xs text-white/50 block mb-1">Label (optional)</label><Input {...form.register("label")} placeholder="20% off summer" className={inputCls} /></div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Discount Type</label>
                <select {...form.register("discountType")} className="w-full h-9 rounded-lg glass border border-white/10 bg-background/50 text-white/80 px-3 text-sm">
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (KES)</option>
                </select>
              </div>
              <div><label className="text-xs text-white/50 block mb-1">Discount Value</label><Input {...form.register("discountValue")} type="number" placeholder="20" className={inputCls} /></div>
              <div><label className="text-xs text-white/50 block mb-1">Max Uses (blank = unlimited)</label><Input {...form.register("maxUses")} type="number" placeholder="Unlimited" className={inputCls} /></div>
              <div className="col-span-2">
                <label className="text-xs text-white/50 block mb-2">Restrict to Specific Plans <span className="text-white/25">(leave all unchecked = any plan)</span></label>
                <PlanSelector selected={form.watch("applicablePlans") || []} onChange={(ids) => form.setValue("applicablePlans", ids)} />
              </div>
              <div><label className="text-xs text-white/50 block mb-1">Expires At (optional)</label><Input {...form.register("expiresAt")} type="date" className={inputCls} /></div>
              <div><label className="text-xs text-white/50 block mb-1">Applies To</label>
                <select {...form.register("applicableTo")} className="w-full h-9 rounded-lg glass border border-white/10 bg-background/50 text-white/80 px-3 text-sm">
                  <option value="subscriptions">Subscriptions only</option>
                  <option value="bots">Bot Deployments only</option>
                  <option value="all">All services</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-amber-500 to-orange-600 border-0 text-white">
                {createMutation.isPending ? "Creating..." : "Create Code"}
              </Button>
              <Button type="button" variant="outline" className="glass border-white/10 text-white/60" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {codes.length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl">
          <BadgePercent className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-white">No promo codes yet</p>
          <p className="text-sm text-white/40">Create your first discount code above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {codes.map((promo: any) => (
            <div key={promo.code} className="glass-card rounded-2xl p-4" data-testid={`promo-row-${promo.code}`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <BadgePercent className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold font-mono text-white">{promo.code}</span>
                      {!promo.active && <Badge className="glass border-white/10 text-white/40 text-xs">Inactive</Badge>}
                      {promo.expiresAt && new Date(promo.expiresAt) < new Date() && <Badge className="bg-red-600/70 text-white border-0 text-xs">Expired</Badge>}
                    </div>
                    <p className="text-xs text-white/40">
                      {promo.discountType === "percent" ? `${promo.discountValue}% off` : `KES ${promo.discountValue} off`}
                      {promo.label ? ` · ${promo.label}` : ""}
                      {" · "}Used {promo.uses}/{promo.maxUses ?? "∞"}
                      {promo.expiresAt ? ` · Expires ${new Date(promo.expiresAt).toLocaleDateString()}` : ""}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {promo.applicableTo === "bots" && <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5">Bots only</span>}
                      {promo.applicableTo === "all" && <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-1.5 py-0.5">All services</span>}
                      {(!promo.applicableTo || promo.applicableTo === "subscriptions") && <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded px-1.5 py-0.5">Subscriptions only</span>}
                      {promo.applicablePlans && promo.applicablePlans.length > 0 && <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded px-1.5 py-0.5">Plans: {promo.applicablePlans.join(", ")}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={promo.active} onCheckedChange={(v) => toggleMutation.mutate({ code: promo.code, active: v })} />
                  <Button size="icon" variant="ghost" className="text-red-400/50 hover:text-red-400 h-8 w-8" onClick={() => deleteMutation.mutate(promo.code)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTIONS TAB
// ═══════════════════════════════════════════════════════════════
function TransactionsTab() {
  const { toast } = useToast();
  const { data: txData, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/transactions"],
    queryFn: () => authFetch("/api/admin/transactions"),
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "pending" | "failed">("all");
  const [resendingRef, setResendingRef] = useState<string | null>(null);
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);
  const [proofRef, setProofRef] = useState<string | null>(null);
  const [proofData, setProofData] = useState<any>(null);
  const [proofLoading, setProofLoading] = useState(false);

  async function loadDeliveryProof(reference: string) {
    setProofRef(reference);
    setProofLoading(true);
    setProofData(null);
    try {
      const res = await authFetch(`/api/admin/delivery-proof/${reference}`);
      if (res.success) setProofData(res.proof);
    } catch {}
    setProofLoading(false);
  }

  const allTxs: any[] = txData?.transactions ?? [];
  const filtered = allTxs.filter((tx) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || tx.customerEmail?.toLowerCase().includes(q) || tx.planName?.toLowerCase().includes(q) || tx.reference?.toLowerCase().includes(q) || tx.customerName?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || tx.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function resendCredentials(reference: string) {
    setResendingRef(reference);
    try {
      const res = await authFetch(`/api/admin/transactions/${reference}/resend`, { method: "POST" });
      if (res.success) toast({ title: "Credentials resent", description: "Email sent to customer" });
      else toast({ title: "Resend failed", description: res.error, variant: "destructive" });
    } catch {
      toast({ title: "Resend failed", variant: "destructive" });
    } finally {
      setResendingRef(null);
    }
  }

  const queryClient = useQueryClient();

  async function manualVerify(reference: string) {
    if (!window.confirm(`Are you sure you want to manually verify this transaction and deliver account credentials?\n\nReference: ${reference}\n\nThis will assign an account and send credentials to the customer even if the payment was not confirmed by Paystack.`)) return;
    setVerifyingRef(reference);
    try {
      const res = await authFetch(`/api/admin/transactions/${reference}/verify`, { method: "POST" });
      if (res.success) {
        toast({ title: "Transaction verified", description: "Account credentials have been delivered to the customer" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      } else {
        toast({ title: "Verification failed", description: res.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Verification failed", variant: "destructive" });
    } finally {
      setVerifyingRef(null);
    }
  }

  function exportCSV() {
    const rows = [["Reference", "Plan", "Customer Name", "Customer Email", "Amount (KES)", "Status", "Email Sent", "Date"]];
    filtered.forEach((tx) => {
      rows.push([
        tx.reference || "", tx.planName || "", tx.customerName || "", tx.customerEmail || "",
        String(tx.amount || 0), tx.status || "", tx.emailSent ? "Yes" : "No",
        tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "",
      ]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `chege-tech-transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: `Exported ${filtered.length} transactions` });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Transactions</h1>
        <Button size="sm" variant="outline" onClick={exportCSV} className="glass border-white/10 text-white/60 hover:text-white" data-testid="button-export-csv">
          <Download className="w-3.5 h-3.5 mr-1.5" />Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, plan, or reference..."
            className="pl-9 glass border-white/10 bg-white/5 text-white placeholder:text-white/25 h-9 text-sm"
            data-testid="input-tx-search"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "success", "pending", "failed"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? "bg-indigo-600 text-white" : "glass border border-white/10 text-white/50 hover:text-white"}`}
              data-testid={`filter-${s}`}>
              {s === "all" ? "All" : s === "success" ? "Completed" : s === "pending" ? "Pending" : "Failed"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl glass animate-pulse" />)}</div>
      ) : !filtered.length ? (
        <div className="text-center py-20 glass-card rounded-2xl">
          <ArrowLeftRight className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
          <p className="font-semibold text-white">{allTxs.length === 0 ? "No transactions yet" : "No results match your search"}</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5 text-xs text-white/30">{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/8 hover:bg-transparent">
                  <TableHead className="text-white/40 text-xs">Reference</TableHead>
                  <TableHead className="text-white/40 text-xs">Plan</TableHead>
                  <TableHead className="text-white/40 text-xs">Customer</TableHead>
                  <TableHead className="text-white/40 text-xs">Amount</TableHead>
                  <TableHead className="text-white/40 text-xs">Status</TableHead>
                  <TableHead className="text-white/40 text-xs">Email</TableHead>
                  <TableHead className="text-white/40 text-xs">Date</TableHead>
                  <TableHead className="text-white/40 text-xs">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tx: any) => {
                  const status = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={tx.id} className="border-white/5 hover:bg-white/3" data-testid={`tx-row-${tx.id}`}>
                      <TableCell className="font-mono text-xs text-white/30">{tx.reference?.split("-").slice(-1)[0]}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm text-white">{tx.planName}</span>
                          {tx.isBotOrder && <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5">Bot Deploy</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-white/80">{tx.customerName}</div>
                        <div className="text-xs text-white/30">{tx.customerEmail}</div>
                      </TableCell>
                      <TableCell className="font-semibold text-sm text-indigo-400">KES {tx.amount?.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${status.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />{status.label}
                        </div>
                      </TableCell>
                      <TableCell>
                        {tx.isBotOrder
                          ? <Badge className={`text-xs border ${tx.botStatus === "deployed" ? "bg-green-500/10 text-green-400 border-green-500/20" : tx.botStatus === "stopped" || tx.botStatus === "suspended" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>{tx.botStatus}</Badge>
                          : tx.emailSent
                            ? <Badge className="bg-emerald-600/70 text-white border-0 text-xs">Sent</Badge>
                            : <Badge className="glass border-white/10 text-white/40 text-xs">Pending</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-white/30">{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {!tx.isBotOrder && <Button size="sm" variant="ghost"
                            className="h-7 px-2 text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => loadDeliveryProof(tx.reference)}
                            title="View delivery proof"
                            data-testid={`button-proof-${tx.id}`}>
                            <ClipboardCheck className="w-3.5 h-3.5" />
                          </Button>}
                          {tx.isBotOrder && tx.deployUrl && (
                            <a href={tx.deployUrl} target="_blank" rel="noopener noreferrer"
                              className="h-7 px-2 flex items-center text-emerald-400/60 hover:text-emerald-400 text-xs">
                              <Bot className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {!tx.isBotOrder && tx.status === "success" && (
                            <Button size="sm" variant="ghost"
                              className="h-7 px-2 text-white/40 hover:text-indigo-400 hover:bg-indigo-500/10"
                              onClick={() => resendCredentials(tx.reference)}
                              disabled={resendingRef === tx.reference}
                              title="Resend credentials to customer"
                              data-testid={`button-resend-${tx.id}`}>
                              {resendingRef === tx.reference
                                ? <div className="w-3.5 h-3.5 border border-white/40 border-t-transparent rounded-full animate-spin" />
                                : <RotateCcw className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                          {!tx.isBotOrder && (tx.status === "pending" || tx.status === "failed") && (
                            <Button size="sm" variant="ghost"
                              className="h-7 px-2 text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10"
                              onClick={() => manualVerify(tx.reference)}
                              disabled={verifyingRef === tx.reference}
                              title="Manually verify and deliver credentials"
                              data-testid={`button-verify-${tx.id}`}>
                              {verifyingRef === tx.reference
                                ? <div className="w-3.5 h-3.5 border border-white/40 border-t-transparent rounded-full animate-spin" />
                                : <CheckCircle className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {proofRef && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setProofRef(null); setProofData(null); } }}>
          <div className="glass border border-white/10 rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" data-testid="modal-delivery-proof">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Delivery Proof</h2>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setProofRef(null); setProofData(null); }}
                className="text-white/40 hover:text-white" data-testid="button-close-proof">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {proofLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-white/40 mx-auto" />
              </div>
            ) : proofData ? (
              <div className="p-4 space-y-4">
                <div className="text-xs text-white/40 font-mono mb-2">Ref: {proofRef}</div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="glass border border-white/10 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{proofData.summary.totalAttempts}</div>
                    <div className="text-xs text-white/50">Total Attempts</div>
                  </div>
                  <div className="glass border border-white/10 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-400">{proofData.summary.successfulDeliveries}</div>
                    <div className="text-xs text-white/50">Successful</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className={proofData.summary.accountAssigned
                    ? "bg-emerald-600/70 text-white border-0" : "bg-red-600/70 text-white border-0"}>
                    {proofData.summary.accountAssigned ? "✓ Account Assigned" : "✗ Not Assigned"}
                  </Badge>
                  <Badge className={proofData.summary.emailDelivered
                    ? "bg-emerald-600/70 text-white border-0" : "bg-red-600/70 text-white border-0"}>
                    {proofData.summary.emailDelivered ? "✓ Email Delivered" : "✗ Email Not Sent"}
                  </Badge>
                </div>

                {proofData.summary.methods.length > 0 && (
                  <div className="text-xs text-white/40">
                    Methods used: {proofData.summary.methods.map((m: string) => m.replace(/_/g, " ")).join(", ")}
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                    <Activity className="w-4 h-4" /> Delivery Timeline
                  </h3>
                  {proofData.logs.length === 0 ? (
                    <div className="text-center py-6 text-white/30 text-sm">
                      No delivery logs recorded for this transaction.
                      <br />
                      <span className="text-xs text-white/20">Logs are recorded for new orders going forward.</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {proofData.logs.map((log: any, i: number) => (
                        <div key={log.id || i}
                          className="glass border border-white/5 rounded-lg p-3"
                          data-testid={`delivery-log-${i}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              {log.status === "success"
                                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                              <span className="text-xs font-medium text-white/80">
                                {log.method === "email" && "Email Delivery"}
                                {log.method === "resend_email" && "Email Resend"}
                                {log.method === "account_assignment" && "Account Assignment"}
                                {log.method === "telegram_notification" && "Telegram Notification"}
                                {log.method === "whatsapp_notification" && "WhatsApp Notification"}
                              </span>
                            </div>
                            <Badge className={log.status === "success"
                              ? "bg-emerald-600/50 text-emerald-200 border-0 text-[10px]"
                              : "bg-red-600/50 text-red-200 border-0 text-[10px]"}>
                              {log.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-white/50 mb-1">{log.details}</p>
                          <div className="text-[10px] text-white/25 font-mono">
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {proofData.summary.firstAttempt && (
                  <div className="text-[11px] text-white/30 border-t border-white/5 pt-3 space-y-0.5">
                    <div>First attempt: {new Date(proofData.summary.firstAttempt).toLocaleString()}</div>
                    <div>Last attempt: {new Date(proofData.summary.lastAttempt).toLocaleString()}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-white/30 text-sm">Failed to load delivery proof.</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────
function ApiKeysTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/api-keys"],
    queryFn: () => authFetch("/api/admin/api-keys"),
  });

  const { data: custData } = useQuery<any>({
    queryKey: ["/api/admin/customers"],
    queryFn: () => authFetch("/api/admin/customers"),
  });
  const custMap: Record<number, string> = {};
  (custData?.customers ?? []).forEach((c: any) => { custMap[c.id] = c.email; });

  const generateMutation = useMutation({
    mutationFn: () => authFetch("/api/admin/api-keys", { method: "POST", body: JSON.stringify({ label: newLabel.trim() }) }),
    onSuccess: (d) => {
      if (d.success) { toast({ title: "API key generated" }); setNewLabel(""); refetch(); }
      else toast({ title: "Failed", description: d.error, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/api/admin/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "API key deleted" }); refetch(); },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/api/admin/api-keys/${id}/revoke`, { method: "PATCH" }),
    onSuccess: () => { toast({ title: "API key revoked" }); refetch(); },
  });

  function copyKey(key: string, id: number) {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  }

  const keys = data?.keys ?? [];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">API Keys</h1>
        <Badge className="glass border-white/10 text-white/50">{keys.length} keys</Badge>
      </div>

      {/* Generate form */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <p className="text-sm font-semibold text-white mb-3">Generate New API Key</p>
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Key label (e.g. Integration Key)"
            className="flex-1 glass border-white/10 bg-white/5 text-white placeholder:text-white/25"
            data-testid="input-apikey-label"
            onKeyDown={(e) => { if (e.key === "Enter" && newLabel.trim()) generateMutation.mutate(); }}
          />
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!newLabel.trim() || generateMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
            data-testid="button-generate-apikey"
          >
            <Plus className="w-4 h-4 mr-1" />Generate
          </Button>
        </div>
        <p className="text-xs text-white/30 mt-2">Keys are prefixed with <code className="bg-white/10 px-1 rounded">ct_</code></p>
      </div>

      {/* Keys list */}
      {isLoading ? (
        <div className="text-center py-12 text-white/40">Loading...</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 glass-card rounded-2xl">
          <Key className="w-9 h-9 text-white/20 mx-auto mb-2" />
          <p className="text-white/40">No API keys yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((k: any) => (
            <div key={k.id} data-testid={`card-adminkey-${k.id}`} className="glass-card rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Key className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-semibold text-white text-sm">{k.label}</span>
                  <Badge className={`text-xs border-0 ${k.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                    {k.active ? "Active" : "Revoked"}
                  </Badge>
                  {k.customerId && (
                    <Badge className="text-xs bg-blue-500/20 text-blue-400 border-0">
                      {custMap[k.customerId] || `Customer #${k.customerId}`}
                    </Badge>
                  )}
                  {!k.customerId && (
                    <Badge className="text-xs bg-violet-500/20 text-violet-400 border-0">Admin</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyKey(k.key, k.id)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                    data-testid={`button-copy-adminkey-${k.id}`}
                    title="Copy key"
                  >
                    {copiedId === k.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {k.active && (
                    <button
                      onClick={() => revokeMutation.mutate(k.id)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                      data-testid={`button-revoke-adminkey-${k.id}`}
                      title="Revoke key"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(k.id)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    data-testid={`button-delete-adminkey-${k.id}`}
                    title="Delete key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <code className="text-xs font-mono text-white/40 bg-white/5 rounded-lg px-3 py-1.5 block break-all" data-testid={`text-adminkey-${k.id}`}>
                {k.key}
              </code>
              <p className="text-xs text-white/25 mt-1.5">Created {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : ""}</p>
            </div>
          ))}
        </div>
      )}

      {keys.length > 0 && (
        <div className="glass-card rounded-2xl p-5 mt-6">
          <p className="text-sm font-semibold text-white mb-3" data-testid="text-admin-api-docs-title">API Documentation</p>
          <p className="text-xs text-white/40 mb-1">Admin keys (no customer linked) can access admin endpoints. Customer-linked keys access customer endpoints.</p>
          <p className="text-xs text-white/40 mb-3">Authenticate using the <code className="bg-white/10 px-1 rounded">X-API-Key</code> header.</p>
          <div className="space-y-3">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Admin Endpoints</p>
            <div className="rounded-lg p-3 bg-white/5 border border-white/8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">GET</span>
                <code className="text-xs text-white/70 font-mono">/api/v1/admin/transactions</code>
              </div>
              <p className="text-xs text-white/35 mb-2">List all transactions</p>
              <code className="text-[10px] text-white/30 bg-black/30 rounded px-2 py-1 block break-all" data-testid="text-curl-admin-transactions">
                curl -H "X-API-Key: YOUR_ADMIN_KEY" {window.location.origin}/api/v1/admin/transactions
              </code>
            </div>
            <div className="rounded-lg p-3 bg-white/5 border border-white/8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">GET</span>
                <code className="text-xs text-white/70 font-mono">/api/v1/admin/stats</code>
              </div>
              <p className="text-xs text-white/35 mb-2">Get revenue & order statistics</p>
              <code className="text-[10px] text-white/30 bg-black/30 rounded px-2 py-1 block break-all" data-testid="text-curl-admin-stats">
                curl -H "X-API-Key: YOUR_ADMIN_KEY" {window.location.origin}/api/v1/admin/stats
              </code>
            </div>
            <div className="rounded-lg p-3 bg-white/5 border border-white/8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">GET</span>
                <code className="text-xs text-white/70 font-mono">/api/v1/admin/customers</code>
              </div>
              <p className="text-xs text-white/35 mb-2">List all registered customers</p>
              <code className="text-[10px] text-white/30 bg-black/30 rounded px-2 py-1 block break-all" data-testid="text-curl-admin-customers">
                curl -H "X-API-Key: YOUR_ADMIN_KEY" {window.location.origin}/api/v1/admin/customers
              </code>
            </div>
            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mt-4">Customer Endpoints</p>
            <div className="rounded-lg p-3 bg-white/5 border border-white/8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">GET</span>
                <code className="text-xs text-white/70 font-mono">/api/v1/my-profile</code>
              </div>
              <p className="text-xs text-white/35">Get the linked customer's profile</p>
            </div>
            <div className="rounded-lg p-3 bg-white/5 border border-white/8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">GET</span>
                <code className="text-xs text-white/70 font-mono">/api/v1/my-orders</code>
              </div>
              <p className="text-xs text-white/35">Get the linked customer's orders</p>
            </div>
            <p className="text-xs font-bold text-violet-400 uppercase tracking-wider mt-4">Public Reseller Endpoints</p>
            <p className="text-xs text-white/30 mb-2">Use <code className="bg-black/30 px-1 rounded">X-Reseller-Key</code> header with an admin key that has reseller scope</p>
            <div className="rounded-lg p-3 bg-white/5 border border-white/8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">GET</span>
                <code className="text-xs text-white/70 font-mono">/api/v1/plans</code>
              </div>
              <p className="text-xs text-white/35 mb-2">List all available plans with prices (public reseller catalogue)</p>
              <code className="text-[10px] text-white/30 bg-black/30 rounded px-2 py-1 block break-all">
                curl -H "X-API-Key: YOUR_KEY" {window.location.origin}/api/v1/plans
              </code>
            </div>
            <div className="rounded-lg p-3 bg-white/5 border border-white/8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-orange-400 bg-orange-500/15 px-2 py-0.5 rounded">POST</span>
                <code className="text-xs text-white/70 font-mono">/api/v1/orders</code>
              </div>
              <p className="text-xs text-white/35 mb-2">Create a reseller order — delivers account credentials instantly if in stock</p>
              <code className="text-[10px] text-white/30 bg-black/30 rounded px-2 py-1 block break-all">
                {`curl -X POST -H "X-API-Key: KEY" -H "Content-Type: application/json" -d '{"planId":"PLAN_ID","customerEmail":"customer@email.com","customerName":"John"}' ${window.location.origin}/api/v1/orders`}
              </code>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Email Blast Tab ──────────────────────────────────────────
function EmailBlastTab() {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "suspended">("all");
  const [customEmails, setCustomEmails] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const { data: custData } = useQuery<any>({
    queryKey: ["/api/admin/customers"],
    queryFn: () => authFetch("/api/admin/customers"),
  });

  const allCustomers = custData?.customers ?? [];
  const recipientCount = useCustom
    ? customEmails.split(/[,\n]/).filter((e: string) => e.trim()).length
    : filter === "verified"
      ? allCustomers.filter((c: any) => c.emailVerified && !c.suspended).length
      : filter === "suspended"
        ? allCustomers.filter((c: any) => c.suspended).length
        : allCustomers.filter((c: any) => c.emailVerified).length;

  const sendMutation = useMutation({
    mutationFn: () => {
      const body: any = { subject: subject.trim(), content: content.trim() };
      if (useCustom) {
        body.recipients = customEmails.split(/[,\n]/).map((e: string) => e.trim()).filter(Boolean);
      } else {
        body.filter = filter;
      }
      return authFetch("/api/admin/email-blast", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (d) => {
      if (d.success) {
        setResult({ sent: d.sent, failed: d.failed, total: d.total });
        toast({ title: `Email sent to ${d.sent} recipient(s)`, description: d.failed > 0 ? `${d.failed} failed` : undefined });
      } else {
        toast({ title: "Failed", description: d.error, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Error", description: "Failed to send emails", variant: "destructive" }),
  });

  const templates = [
    { label: "New Promo Code", subject: "Exclusive Discount Just for You!", content: "Hey there!\n\nWe have a special promo code just for you: **SAVE20**\n\nUse it at checkout to get 20% off any plan. Hurry — this offer expires soon!\n\nVisit our store to grab your deal." },
    { label: "New Plan Available", subject: "New Premium Plan Just Launched!", content: "We're excited to announce a brand new plan is now available in our store!\n\nCheck out the latest additions and grab your subscription before stock runs out.\n\nHead over to the store now to see what's new." },
    { label: "General Update", subject: "Important Update from Chege Tech", content: "Hi there!\n\nWe have some important updates to share with you.\n\n[Write your update here]\n\nThank you for being a valued customer!" },
    { label: "Special Offer", subject: "Limited Time Offer - Don't Miss Out!", content: "Great news!\n\nFor a limited time, we're running a special offer on selected plans.\n\n[Describe the offer]\n\nThis offer won't last forever — visit the store now!" },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Email Blast</h1>
          <p className="text-xs text-white/40 mt-0.5">Send bulk emails to your customers — promos, offers, updates</p>
        </div>
        <Badge className="glass border-white/10 text-white/50">{allCustomers.length} total customers</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-3">Compose Email</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Subject</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject line..."
                  className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25"
                  data-testid="input-blast-subject"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Content <span className="text-white/30">(Use **bold** for emphasis, new lines become line breaks)</span></label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your email content here..."
                  rows={8}
                  className="w-full rounded-xl px-4 py-3 text-sm glass border border-white/10 bg-white/5 text-white placeholder:text-white/25 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  data-testid="input-blast-content"
                />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-3">Recipients</p>
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => setUseCustom(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!useCustom ? "bg-indigo-600 text-white" : "bg-white/5 text-white/40 hover:text-white/70"}`}
                data-testid="button-filter-mode"
              >
                By Filter
              </button>
              <button
                onClick={() => setUseCustom(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${useCustom ? "bg-indigo-600 text-white" : "bg-white/5 text-white/40 hover:text-white/70"}`}
                data-testid="button-custom-mode"
              >
                Custom List
              </button>
            </div>

            {!useCustom ? (
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: "all", label: "All Verified", desc: "Active + verified customers" },
                  { value: "verified", label: "Active Only", desc: "Verified & not suspended" },
                  { value: "suspended", label: "Suspended", desc: "Suspended accounts only" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    data-testid={`button-filter-${opt.value}`}
                    className={`px-3 py-2 rounded-xl text-xs transition-all border ${
                      filter === opt.value
                        ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300"
                        : "bg-white/5 border-white/8 text-white/40 hover:text-white/70"
                    }`}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="block text-[10px] opacity-60 mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <label className="text-xs text-white/50 mb-1 block">Email addresses (comma or newline separated)</label>
                <textarea
                  value={customEmails}
                  onChange={(e) => setCustomEmails(e.target.value)}
                  placeholder="user1@email.com, user2@email.com..."
                  rows={4}
                  className="w-full rounded-xl px-4 py-3 text-sm glass border border-white/10 bg-white/5 text-white placeholder:text-white/25 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                  data-testid="input-custom-emails"
                />
              </div>
            )}
            <p className="text-xs text-white/30 mt-2">
              {recipientCount} recipient{recipientCount !== 1 ? "s" : ""} will receive this email
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!subject.trim() || !content.trim() || recipientCount === 0 || sendMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6"
              data-testid="button-send-blast"
            >
              {sendMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" />Send to {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}</>
              )}
            </Button>
          </div>

          {result && (
            <div className={`glass-card rounded-2xl p-4 border ${result.failed > 0 ? "border-amber-500/30" : "border-emerald-500/30"}`}>
              <div className="flex items-center gap-3">
                {result.failed === 0 ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                )}
                <div>
                  <p className="text-sm font-semibold text-white" data-testid="text-blast-result">
                    {result.sent} of {result.total} email{result.total !== 1 ? "s" : ""} sent successfully
                  </p>
                  {result.failed > 0 && (
                    <p className="text-xs text-amber-400/70">{result.failed} failed to send</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-3">Quick Templates</p>
            <div className="space-y-2">
              {templates.map((t, i) => (
                <button
                  key={i}
                  onClick={() => { setSubject(t.subject); setContent(t.content); }}
                  data-testid={`button-template-${i}`}
                  className="w-full text-left px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white/60 hover:text-white hover:bg-white/10 transition-all text-xs"
                >
                  <span className="font-medium block">{t.label}</span>
                  <span className="text-[10px] text-white/30 block mt-0.5 truncate">{t.subject}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-2">Tips</p>
            <ul className="text-xs text-white/40 space-y-1.5 list-disc list-inside">
              <li>Use **double asterisks** for bold text</li>
              <li>Each new line becomes a line break</li>
              <li>Emails are sent with Chege Tech branding</li>
              <li>Large batches may take a few moments</li>
              <li>Check Activity Logs for delivery status</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Support Badge Count ──────────────────────────────────────
function SupportBadgeCount() {
  const { data } = useQuery<any>({
    queryKey: ["/api/admin/support/tickets"],
    queryFn: () => authFetch("/api/admin/support/tickets"),
    refetchInterval: 10000,
  });
  const count = (data?.tickets ?? []).filter((t: any) => t.status === "open" || t.status === "escalated").length;
  if (count === 0) return null;
  return (
    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
      {count > 9 ? "9+" : count}
    </span>
  );
}

// ─── Support Tab ──────────────────────────────────────────────
function SupportTab() {
  const { toast } = useToast();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: ticketsData, refetch: refetchTickets } = useQuery<any>({
    queryKey: ["/api/admin/support/tickets"],
    queryFn: () => authFetch("/api/admin/support/tickets"),
    refetchInterval: 5000,
  });

  const tickets: any[] = ticketsData?.tickets ?? [];

  const { data: messagesData, refetch: refetchMessages } = useQuery<any>({
    queryKey: ["/api/admin/support/messages", selectedTicketId],
    queryFn: () => authFetch(`/api/admin/support/ticket/${selectedTicketId}/messages`),
    enabled: !!selectedTicketId,
    refetchInterval: selectedTicketId ? 3000 : false,
  });

  const messages: any[] = messagesData?.messages ?? [];

  const selectedTicket = tickets.find((t: any) => t.id === selectedTicketId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      authFetch(`/api/admin/support/ticket/${selectedTicketId}/message`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    onSuccess: (d) => {
      if (d.success) {
        setReplyText("");
        refetchMessages();
      } else {
        toast({ title: "Failed to send", description: d.error, variant: "destructive" });
      }
    },
  });

  const closeMutation = useMutation({
    mutationFn: (ticketId: number) =>
      authFetch(`/api/admin/support/ticket/${ticketId}/close`, { method: "PATCH" }),
    onSuccess: (d) => {
      if (d.success) {
        toast({ title: "Ticket closed" });
        setSelectedTicketId(null);
        refetchTickets();
      } else {
        toast({ title: "Failed", description: d.error, variant: "destructive" });
      }
    },
  });

  function handleSend() {
    const msg = replyText.trim();
    if (!msg || !selectedTicketId) return;
    sendMutation.mutate(msg);
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "escalated":
        return <Badge className="bg-red-500/20 text-red-400 border-0 text-xs">Escalated</Badge>;
      case "open":
        return <Badge className="bg-amber-500/20 text-amber-400 border-0 text-xs">Open</Badge>;
      case "closed":
        return <Badge className="bg-white/10 text-white/40 border-0 text-xs">Closed</Badge>;
      default:
        return <Badge className="glass border-white/10 text-white/50 text-xs">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Support Tickets</h1>
          <p className="text-xs text-white/40 mt-0.5">Manage customer support conversations</p>
        </div>
        <Badge className="glass border-white/10 text-white/50">
          {tickets.filter((t: any) => t.status !== "closed").length} active
        </Badge>
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)]">
        <div className="w-80 shrink-0 glass-card rounded-2xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-white/8">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Tickets</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {tickets.length === 0 ? (
              <div className="p-6 text-center">
                <MessageCircle className="w-8 h-8 text-white/15 mx-auto mb-2" />
                <p className="text-sm text-white/30">No support tickets</p>
              </div>
            ) : (
              tickets.map((ticket: any) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  data-testid={`ticket-${ticket.id}`}
                  className={`w-full text-left p-3 transition-all ${
                    selectedTicketId === ticket.id
                      ? "bg-indigo-600/20 border-l-2 border-indigo-500"
                      : "hover:bg-white/5 border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {ticket.customerName || ticket.customerEmail}
                      </p>
                      <p className="text-xs text-white/40 truncate mt-0.5">
                        {ticket.subject || "Support Request"}
                      </p>
                      <p className="text-[10px] text-white/25 mt-1">
                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "—"}
                      </p>
                    </div>
                    {statusBadge(ticket.status)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 glass-card rounded-2xl overflow-hidden flex flex-col">
          {selectedTicket ? (
            <>
              <div className="p-4 border-b border-white/8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0">
                    <span className="text-indigo-400 font-bold text-xs">
                      {(selectedTicket.customerEmail || "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {selectedTicket.customerName || selectedTicket.customerEmail}
                    </p>
                    <p className="text-xs text-white/40">
                      {selectedTicket.subject || "Support Request"} · #{selectedTicket.id}
                    </p>
                  </div>
                  <div className="ml-2">{statusBadge(selectedTicket.status)}</div>
                </div>
                {selectedTicket.status !== "closed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => closeMutation.mutate(selectedTicket.id)}
                    disabled={closeMutation.isPending}
                    className="glass border-white/10 text-white/60 hover:text-white h-8"
                    data-testid="button-close-ticket"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    {closeMutation.isPending ? "Closing..." : "Close Ticket"}
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        msg.sender === "admin"
                          ? "bg-gradient-to-r from-indigo-600/80 to-violet-600/80 text-white"
                          : msg.sender === "ai"
                          ? "bg-white/5 border border-white/10 text-white/80"
                          : "bg-white/10 text-white/90"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                          msg.sender === "admin" ? "text-white/60" : msg.sender === "ai" ? "text-indigo-400/70" : "text-white/40"
                        }`}>
                          {msg.sender === "admin" ? "You" : msg.sender === "ai" ? "AI Bot" : "Customer"}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${msg.sender === "admin" ? "text-white/40" : "text-white/25"}`}>
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {selectedTicket.status !== "closed" && (
                <div className="p-4 border-t border-white/8">
                  <div className="flex gap-2">
                    <Input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Type your reply..."
                      className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25 flex-1"
                      data-testid="input-admin-reply"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!replyText.trim() || sendMutation.isPending}
                      className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white shadow-lg hover:opacity-90"
                      data-testid="button-send-reply"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 font-medium">Select a ticket to view</p>
                <p className="text-xs text-white/20 mt-1">Choose a conversation from the left panel</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Customers Tab ────────────────────────────────────────────
function parseUA(ua: string) {
  if (!ua) return { browser: "Unknown browser", os: "Unknown OS", device: "Desktop" };
  const tablet = /ipad|tablet|(android(?!.*mobile))/i.test(ua);
  const mobile = /mobile|android|iphone/i.test(ua);
  const device = tablet ? "Tablet" : mobile ? "Mobile" : "Desktop";
  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\/\d/i.test(ua)) browser = "Chrome";
  else if (/Firefox\/\d/i.test(ua)) browser = "Firefox";
  else if (/Safari\/\d/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/MSIE|Trident/i.test(ua)) browser = "IE";
  const bVer = ua.match(new RegExp(browser.split(" ")[0] + "\\/(\\d+)", "i"));
  if (bVer) browser += ` ${bVer[1]}`;
  let os = "Unknown OS";
  if (/Windows NT 10|Windows 11/i.test(ua)) os = "Windows 10/11";
  else if (/Windows NT 6\.3/i.test(ua)) os = "Windows 8.1";
  else if (/Windows NT 6\.1/i.test(ua)) os = "Windows 7";
  else if (/Mac OS X/i.test(ua)) { const m = ua.match(/Mac OS X ([\d_]+)/); os = m ? `macOS ${m[1].replace(/_/g, ".")}` : "macOS"; }
  else if (/Android/i.test(ua)) { const m = ua.match(/Android ([\d.]+)/); os = m ? `Android ${m[1]}` : "Android"; }
  else if (/iPhone|iPad/i.test(ua)) { const m = ua.match(/OS ([\d_]+)/); os = m ? `iOS ${m[1].replace(/_/g, ".")}` : "iOS"; }
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return { browser, os, device };
}

function CustomersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<"suspend"|"unsuspend"|"delete"|"email">( "suspend");
  const [bulkEmailSubject, setBulkEmailSubject] = useState("");
  const [bulkEmailBody, setBulkEmailBody] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [avatarTargetId, setAvatarTargetId] = useState<number | null>(null);
  const adminAvatarInputRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loginHistoryCache, setLoginHistoryCache] = useState<Record<number, any[]>>({});
  const [loginHistoryLoading, setLoginHistoryLoading] = useState<number | null>(null);
  const [walletTopupId, setWalletTopupId] = useState<number | null>(null);
  const [walletAction, setWalletAction] = useState<"credit" | "deduct" | "history">("credit");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNote, setWalletNote] = useState("");
  const [walletHistoryId, setWalletHistoryId] = useState<number | null>(null);
  const [walletHistoryData, setWalletHistoryData] = useState<any>(null);
  const [walletHistoryLoading, setWalletHistoryLoading] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  async function openProfile(id: number) {
    setProfileId(id);
    setProfileData(null);
    setProfileLoading(true);
    try {
      const d = await authFetch(`/api/admin/customers/${id}/profile`);
      if (d.success) setProfileData(d);
    } catch {}
    finally { setProfileLoading(false); }
  }

  async function loadLoginHistory(id: number) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (loginHistoryCache[id]) return;
    setLoginHistoryLoading(id);
    try {
      const data = await authFetch(`/api/admin/customers/${id}/login-history`);
      setLoginHistoryCache(prev => ({ ...prev, [id]: data.logs || [] }));
    } catch {
      setLoginHistoryCache(prev => ({ ...prev, [id]: [] }));
    } finally {
      setLoginHistoryLoading(null);
    }
  }

  async function handleAdminAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !avatarTargetId) return;
    const form = new FormData();
    form.append("avatar", file);
    try {
      const res = await fetch(`/api/admin/customers/${avatarTargetId}/avatar`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("admin_token") || ""}` },
        body: form,
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Avatar updated!" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      } else {
        toast({ title: "Upload failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setAvatarTargetId(null);
    if (adminAvatarInputRef.current) adminAvatarInputRef.current.value = "";
  }

  async function handleAdminAvatarRemove(id: number) {
    try {
      const res = await fetch(`/api/admin/customers/${id}/avatar`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("admin_token") || ""}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) { toast({ title: "Avatar removed" }); queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] }); }
      else toast({ title: "Failed", description: data.error, variant: "destructive" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  }

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/customers"],
    queryFn: () => authFetch("/api/admin/customers"),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, suspended }: { id: number; suspended: boolean }) =>
      authFetch(`/api/admin/customers/${id}/suspend`, { method: "PATCH", body: JSON.stringify({ suspended }) }),
    onSuccess: (d, vars) => {
      if (d.success) {
        toast({ title: vars.suspended ? "Account suspended" : "Account unsuspended" });
        refetch();
      } else toast({ title: "Failed", description: d.error, variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(`/api/admin/customers/${id}/verify`, { method: "PATCH" }),
    onSuccess: (d) => {
      if (d.success) {
        toast({ title: "Customer verified successfully" });
        refetch();
      } else toast({ title: "Failed", description: d.error, variant: "destructive" });
    },
  });

  const walletTopupMutation = useMutation({
    mutationFn: ({ id, amount, note }: { id: number; amount: string; note: string }) =>
      authFetch(`/api/admin/customers/${id}/wallet/topup`, {
        method: "POST",
        body: JSON.stringify({ amount: parseFloat(amount), note }),
      }),
    onSuccess: (d) => {
      if (d.success) {
        toast({ title: "Wallet credited!", description: `New balance: KES ${d.newBalance.toLocaleString()}` });
        setWalletTopupId(null); setWalletAmount(""); setWalletNote(""); refetch();
      } else { toast({ title: "Credit failed", description: d.error, variant: "destructive" }); }
    },
  });

  const walletDeductMutation = useMutation({
    mutationFn: ({ id, amount, note }: { id: number; amount: string; note: string }) =>
      authFetch(`/api/admin/customers/${id}/wallet/deduct`, {
        method: "POST",
        body: JSON.stringify({ amount: parseFloat(amount), note }),
      }),
    onSuccess: (d) => {
      if (d.success) {
        toast({ title: "Wallet deducted", description: `New balance: KES ${d.newBalance.toLocaleString()}` });
        setWalletTopupId(null); setWalletAmount(""); setWalletNote(""); refetch();
      } else { toast({ title: "Deduction failed", description: d.error, variant: "destructive" }); }
    },
  });

  async function loadWalletHistory(customerId: number) {
    if (walletHistoryId === customerId) { setWalletHistoryId(null); setWalletHistoryData(null); return; }
    setWalletHistoryLoading(true);
    setWalletTopupId(null);
    try {
      const d = await authFetch(`/api/admin/customers/${customerId}/wallet/history`);
      setWalletHistoryId(customerId);
      setWalletHistoryData(d);
    } finally { setWalletHistoryLoading(false); }
  }

  const customers = (data?.customers ?? []).filter((c: any) =>
    !search || c.email.toLowerCase().includes(search.toLowerCase()) || (c.name || "").toLowerCase().includes(search.toLowerCase())
  );

  async function executeBulkAction() {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const d = await authFetch("/api/admin/customers/bulk", {
        method: "POST",
        body: JSON.stringify({ action: bulkAction, ids: Array.from(selectedIds), emailSubject: bulkEmailSubject, emailBody: bulkEmailBody })
      });
      if (d.success) {
        toast({ title: "Bulk action completed", description: `${d.affected} customer(s) affected` });
        setSelectedIds(new Set());
        queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      } else { toast({ title: "Error", description: d.error, variant: "destructive" }); }
    } catch { toast({ title: "Error", description: "Bulk action failed", variant: "destructive" }); }
    finally { setBulkLoading(false); }
  }

  return (
    <>
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-wrap items-center gap-3">
          <span className="text-indigo-300 text-sm font-medium">{selectedIds.size} selected</span>
          <select value={bulkAction} onChange={e => setBulkAction(e.target.value as any)}
            className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white">
            <option value="suspend">Suspend</option>
            <option value="unsuspend">Unsuspend</option>
            <option value="delete">Delete</option>
            <option value="email">Send Email</option>
          </select>
          {bulkAction === "email" && (
            <>
              <input value={bulkEmailSubject} onChange={e => setBulkEmailSubject(e.target.value)}
                placeholder="Subject" className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white w-40" />
              <input value={bulkEmailBody} onChange={e => setBulkEmailBody(e.target.value)}
                placeholder="Message" className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white w-48" />
            </>
          )}
          <button onClick={executeBulkAction} disabled={bulkLoading}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
            {bulkLoading ? "Processing..." : "Apply"}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-white/40 hover:text-white">Clear</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Customers</h1>
          <p className="text-xs text-white/40 mt-0.5">Manage registered customer accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="glass border-white/10 text-white/50">{data?.customers?.length ?? 0} total</Badge>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name..."
            className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25 w-60"
            data-testid="input-search-customers"
          />
          <Button size="sm" variant="outline" onClick={() => {
            const link = document.createElement("a");
            link.href = "/api/admin/export/customers";
            fetch("/api/admin/export/customers", { headers: { Authorization: `Bearer ${getToken()}` } })
              .then(r => r.blob()).then(blob => {
                const url = URL.createObjectURL(blob);
                link.href = url; link.download = "customers.csv"; link.click(); URL.revokeObjectURL(url);
              });
          }} className="glass border-white/10 text-white/60 hover:text-white shrink-0">
            <Download className="w-3.5 h-3.5 mr-1.5" />Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-white/40">Loading...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-2xl">
          <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 font-medium">{search ? "No matching customers" : "No customers yet"}</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/8">
                <TableHead className="text-white/40 text-xs">Customer</TableHead>
                <TableHead className="text-white/40 text-xs">Status</TableHead>
                <TableHead className="text-white/40 text-xs">2FA</TableHead>
                <TableHead className="text-white/40 text-xs">Joined</TableHead>
                <TableHead className="text-white/40 text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c: any) => (
                <React.Fragment key={c.id}>
                <TableRow className="border-white/5 hover:bg-white/3" data-testid={`row-customer-${c.id}`}>
                  <TableCell className="w-8">
                    <input type="checkbox" checked={selectedIds.has(c.id)}
                      onChange={e => setSelectedIds(prev => { const n = new Set(prev); e.target.checked ? n.add(c.id) : n.delete(c.id); return n; })}
                      className="accent-indigo-500 w-4 h-4 rounded cursor-pointer" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0 overflow-hidden">
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt={c.name || c.email} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-indigo-400 font-bold text-xs">{(c.email || "?")[0].toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white" data-testid={`text-customer-email-${c.id}`}>{c.email}</p>
                        {c.name && <p className="text-xs text-white/40">{c.name}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {c.suspended ? (
                        <Badge className="bg-red-500/20 text-red-400 border-0 text-xs w-fit">Suspended</Badge>
                      ) : c.emailVerified ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs w-fit">Active</Badge>
                      ) : (
                        <Badge className="bg-amber-500/20 text-amber-400 border-0 text-xs w-fit">Unverified</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.totpEnabled ? (
                      <Badge className="bg-indigo-500/20 text-indigo-400 border-0 text-xs">2FA On</Badge>
                    ) : (
                      <span className="text-white/25 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-white/40">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* View Profile button */}
                      <button
                        onClick={() => openProfile(c.id)}
                        title="View full profile"
                        className="p-1.5 rounded-lg transition-all text-xs font-medium px-2.5 py-1 flex items-center gap-1 text-white/30 hover:text-violet-400 hover:bg-violet-500/10"
                      >
                        <UserCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Profile</span>
                      </button>
                      {/* Login history button */}
                      <button
                        onClick={() => loadLoginHistory(c.id)}
                        title="Login history"
                        className={`p-1.5 rounded-lg transition-all text-xs font-medium px-2.5 py-1 flex items-center gap-1 ${expandedId === c.id ? "bg-indigo-500/25 text-indigo-300" : "text-white/30 hover:text-indigo-400 hover:bg-indigo-500/10"}`}
                      >
                        {loginHistoryLoading === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">Logins</span>
                      </button>
                      {/* Avatar button */}
                      <button
                        onClick={() => { setAvatarTargetId(c.id); setTimeout(() => adminAvatarInputRef.current?.click(), 50); }}
                        title="Change profile photo"
                        className="p-1.5 rounded-lg transition-all text-white/30 hover:text-indigo-400 hover:bg-indigo-500/10"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                      {c.avatarUrl && (
                        <button
                          onClick={() => handleAdminAvatarRemove(c.id)}
                          title="Remove profile photo"
                          className="p-1.5 rounded-lg transition-all text-white/30 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!c.emailVerified && !c.suspended && (
                        <button
                          onClick={() => verifyMutation.mutate(c.id)}
                          disabled={verifyMutation.isPending}
                          data-testid={`button-verify-${c.id}`}
                          title="Manually verify customer"
                          className="p-1.5 rounded-lg transition-all text-xs font-medium px-3 py-1 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 flex items-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />Verify
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (walletTopupId === c.id && walletAction === "credit") {
                            setWalletTopupId(null); setWalletAmount(""); setWalletNote("");
                          } else {
                            setWalletTopupId(c.id); setWalletAction("credit");
                            setWalletAmount(""); setWalletNote("");
                            setWalletHistoryId(null);
                          }
                        }}
                        title="Credit wallet"
                        className={`p-1.5 rounded-lg transition-all text-xs font-medium px-2.5 py-1 flex items-center gap-1 ${walletTopupId === c.id && walletAction === "credit" ? "bg-emerald-500/25 text-emerald-300" : "text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10"}`}
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Credit</span>
                      </button>
                      <button
                        onClick={() => {
                          if (walletTopupId === c.id && walletAction === "deduct") {
                            setWalletTopupId(null); setWalletAmount(""); setWalletNote("");
                          } else {
                            setWalletTopupId(c.id); setWalletAction("deduct");
                            setWalletAmount(""); setWalletNote("");
                            setWalletHistoryId(null);
                          }
                        }}
                        title="Deduct from wallet"
                        className={`p-1.5 rounded-lg transition-all text-xs font-medium px-2.5 py-1 flex items-center gap-1 ${walletTopupId === c.id && walletAction === "deduct" ? "bg-red-500/25 text-red-300" : "text-white/30 hover:text-red-400 hover:bg-red-500/10"}`}
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Deduct</span>
                      </button>
                      <button
                        onClick={() => loadWalletHistory(c.id)}
                        title="View wallet history"
                        className={`p-1.5 rounded-lg transition-all text-xs font-medium px-2.5 py-1 flex items-center gap-1 ${walletHistoryId === c.id ? "bg-indigo-500/25 text-indigo-300" : "text-white/30 hover:text-indigo-400 hover:bg-indigo-500/10"}`}
                      >
                        <History className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{walletHistoryLoading ? "…" : "History"}</span>
                      </button>
                      <button
                        onClick={() => suspendMutation.mutate({ id: c.id, suspended: !c.suspended })}
                        disabled={suspendMutation.isPending}
                        data-testid={`button-suspend-${c.id}`}
                        title={c.suspended ? "Unsuspend account" : "Suspend account"}
                        className={`p-1.5 rounded-lg transition-all text-xs font-medium px-3 py-1 ${
                          c.suspended
                            ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                            : "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                        }`}
                      >
                        {c.suspended ? "Unsuspend" : "Suspend"}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>

                {/* ── Wallet Action Inline Panel ── */}
                {walletTopupId === c.id && (
                  <TableRow className="border-0">
                    <TableCell colSpan={5} className="p-0">
                      <div className={`px-4 pb-4 pt-3 border-b border-white/5 ${walletAction === "deduct" ? "bg-red-950/30" : "bg-emerald-950/30"}`}>
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          {walletAction === "credit" ? <Wallet className="w-3 h-3 text-emerald-400" /> : <MinusCircle className="w-3 h-3 text-red-400" />}
                          {walletAction === "credit" ? "Credit Wallet" : "Deduct Wallet"} · {c.email}
                        </p>
                        <div className="flex items-end gap-3 flex-wrap">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-white/40 uppercase tracking-wider">Amount (KES)</label>
                            <Input type="number" min="1" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)}
                              placeholder="e.g. 500"
                              className="w-36 h-8 text-sm glass border-white/10 bg-white/5 text-white placeholder:text-white/25"
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                            <label className="text-[10px] text-white/40 uppercase tracking-wider">Note / Reason</label>
                            <Input type="text" value={walletNote} onChange={(e) => setWalletNote(e.target.value)}
                              placeholder={walletAction === "credit" ? "e.g. Compensation, gift…" : "e.g. Chargeback, fraud recovery…"}
                              className="h-8 text-sm glass border-white/10 bg-white/5 text-white placeholder:text-white/25"
                            />
                          </div>
                          <button
                            onClick={() => {
                              if (!walletAmount || parseFloat(walletAmount) <= 0) return;
                              if (walletAction === "credit") walletTopupMutation.mutate({ id: c.id, amount: walletAmount, note: walletNote });
                              else walletDeductMutation.mutate({ id: c.id, amount: walletAmount, note: walletNote });
                            }}
                            disabled={(walletTopupMutation.isPending || walletDeductMutation.isPending) || !walletAmount || parseFloat(walletAmount) <= 0}
                            className={`h-8 px-4 rounded-lg disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors ${walletAction === "credit" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}
                          >
                            {(walletTopupMutation.isPending || walletDeductMutation.isPending)
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : walletAction === "credit" ? <Wallet className="w-3.5 h-3.5" /> : <MinusCircle className="w-3.5 h-3.5" />}
                            {walletAction === "credit" ? "Credit" : "Deduct"}
                          </button>
                          <button onClick={() => { setWalletTopupId(null); setWalletAmount(""); setWalletNote(""); }}
                            className="h-8 px-3 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 text-xs transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* ── Wallet History Inline Panel ── */}
                {walletHistoryId === c.id && walletHistoryData && (
                  <TableRow className="border-0">
                    <TableCell colSpan={5} className="p-0">
                      <div className="px-4 pb-4 pt-3 bg-indigo-950/30 border-b border-white/5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest flex items-center gap-1.5">
                            <History className="w-3 h-3 text-indigo-400" />
                            Wallet History · {c.email} · Balance: <span className="text-indigo-300 font-bold">KES {(walletHistoryData.balance ?? 0).toLocaleString()}</span>
                          </p>
                          <button onClick={() => { setWalletHistoryId(null); setWalletHistoryData(null); }}
                            className="text-white/20 hover:text-white/50 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        {(walletHistoryData.transactions ?? []).length === 0 ? (
                          <p className="text-white/30 text-xs text-center py-4">No wallet transactions yet</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {(walletHistoryData.transactions ?? []).slice(0, 30).map((t: any) => (
                              <div key={t.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-white/3 hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-2 min-w-0">
                                  {t.type === "credit"
                                    ? <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    : <ArrowDownCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                                  <span className="text-white/60 truncate">{t.description}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                  <span className={`font-bold ${t.type === "credit" ? "text-emerald-400" : "text-red-400"}`}>
                                    {t.type === "credit" ? "+" : "-"}KES {t.amount}
                                  </span>
                                  <span className="text-white/25">{new Date(t.createdAt || t.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* ── Login History Expanded Row ── */}
                {expandedId === c.id && (
                  <TableRow className="border-0">
                    <TableCell colSpan={5} className="p-0">
                      <div className="px-4 pb-4 pt-2 bg-indigo-950/30 border-b border-white/5">
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <Activity className="w-3 h-3" />
                          Login History · last 20 sessions
                        </p>
                        {loginHistoryLoading === c.id ? (
                          <div className="flex items-center gap-2 py-4 text-white/30 text-xs">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                          </div>
                        ) : !loginHistoryCache[c.id] || loginHistoryCache[c.id].length === 0 ? (
                          <p className="text-xs text-white/25 py-3">No login records found for this account</p>
                        ) : (
                          <div className="space-y-2">
                            {loginHistoryCache[c.id].map((log: any, i: number) => {
                              const { browser, os, device } = parseUA(log.user_agent || "");
                              const deviceIcon = device === "Mobile" ? "📱" : device === "Tablet" ? "📲" : "🖥️";
                              const flag = log.country_code ? `https://flagcdn.com/16x12/${log.country_code.toLowerCase()}.png` : null;
                              return (
                                <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/6">
                                  <span className="text-base mt-0.5">{deviceIcon}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-semibold text-white">{browser}</span>
                                      <span className="text-[10px] text-white/35">on {os}</span>
                                      <span className="text-[10px] text-indigo-300/60 font-medium">{device}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <span className="font-mono text-[11px] text-white/50">{log.ip || "—"}</span>
                                      {flag && <img src={flag} alt="" className="w-4 h-3 rounded-sm" />}
                                      {(log.city || log.country) && (
                                        <span className="text-[11px] text-white/40">{[log.city, log.country].filter(Boolean).join(", ")}</span>
                                      )}
                                      {log.isp && <span className="text-[10px] text-white/25 truncate max-w-[120px]">{log.isp}</span>}
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-white/25 shrink-0 mt-0.5">
                                    {log.created_at ? new Date(log.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {/* Hidden file input for admin avatar upload */}
      <input
        ref={adminAvatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleAdminAvatarUpload}
      />

      {/* ── Customer Profile Modal ── */}
      {profileId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.75)", backdropFilter: "blur(10px)" }}>
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 flex flex-col overflow-hidden shadow-2xl"
            style={{ background: "linear-gradient(135deg,rgba(11,16,32,.98),rgba(20,12,40,.98))", maxHeight: "90vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
              <div className="flex items-center gap-3">
                {profileData?.customer?.avatarUrl ? (
                  <img src={profileData.customer.avatarUrl} className="w-10 h-10 rounded-full object-cover border border-white/15" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-600/30 flex items-center justify-center">
                    <span className="text-indigo-300 font-bold text-base">{(profileData?.customer?.email || "?")[0].toUpperCase()}</span>
                  </div>
                )}
                <div>
                  <p className="text-white font-bold">{profileData?.customer?.name || profileData?.customer?.email || "Loading…"}</p>
                  <p className="text-white/40 text-xs font-mono">{profileData?.customer?.email}</p>
                </div>
              </div>
              <button onClick={() => { setProfileId(null); setProfileData(null); }} className="text-white/30 hover:text-white/70 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {profileLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
              ) : profileData ? (
                <>
                  {/* Status badges + wallet */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl p-3 border border-white/8 text-center" style={{ background: "rgba(255,255,255,.04)" }}>
                      <p className="text-white/40 text-[11px] mb-1">Wallet</p>
                      <p className="text-emerald-400 font-bold text-lg">KES {(profileData.wallet?.balance ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl p-3 border border-white/8 text-center" style={{ background: "rgba(255,255,255,.04)" }}>
                      <p className="text-white/40 text-[11px] mb-1">Orders</p>
                      <p className="text-white font-bold text-lg">{profileData.orders?.length ?? 0}</p>
                    </div>
                    <div className="rounded-xl p-3 border border-white/8 text-center" style={{ background: "rgba(255,255,255,.04)" }}>
                      <p className="text-white/40 text-[11px] mb-1">Referrals</p>
                      <p className="text-white font-bold text-lg">{profileData.referral?.completedReferrals ?? 0}</p>
                    </div>
                    <div className="rounded-xl p-3 border border-white/8 text-center" style={{ background: "rgba(255,255,255,.04)" }}>
                      <p className="text-white/40 text-[11px] mb-1">Referral Earned</p>
                      <p className="text-amber-400 font-bold text-lg">KES {(profileData.referral?.totalEarned ?? 0).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Account info */}
                  <div className="rounded-xl border border-white/8 p-4" style={{ background: "rgba(255,255,255,.03)" }}>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Account Info</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {[
                        ["Email Verified", profileData.customer.emailVerified ? "✅ Yes" : "❌ No"],
                        ["2FA Enabled", profileData.customer.totpEnabled ? "🔐 On" : "Off"],
                        ["Status", profileData.customer.suspended ? "🔴 Suspended" : "🟢 Active"],
                        ["Member Since", profileData.customer.createdAt ? new Date(profileData.customer.createdAt).toLocaleDateString() : "—"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between py-1 border-b border-white/5">
                          <span className="text-white/40 text-xs">{label}</span>
                          <span className="text-white/80 text-xs font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent orders */}
                  {(profileData.orders?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,.03)" }}>
                      <p className="text-white/40 text-xs font-semibold uppercase tracking-widest px-4 pt-3 pb-2">Recent Orders</p>
                      <table className="w-full text-xs">
                        <tbody>
                          {profileData.orders.slice(0, 8).map((o: any) => (
                            <tr key={o.reference || o.id} className="border-t border-white/5">
                              <td className="px-4 py-2 text-white/70">{o.planName || "—"}</td>
                              <td className="px-4 py-2 text-right text-indigo-300 font-mono">KES {(o.amount ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-2 text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${o.status === "success" ? "bg-emerald-500/20 text-emerald-400" : o.status === "failed" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>
                                  {o.status}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right text-white/30">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Ratings given */}
                  {(profileData.ratings?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-white/8 p-4" style={{ background: "rgba(255,255,255,.03)" }}>
                      <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Ratings Given</p>
                      <div className="space-y-2">
                        {profileData.ratings.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-3">
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= r.stars ? "text-amber-400 fill-amber-400" : "text-white/15"}`} />)}
                            </div>
                            <span className="text-white/60 text-xs">{r.planName || "—"}</span>
                            {r.comment && <span className="text-white/35 text-xs italic truncate max-w-[200px]">"{r.comment}"</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent logins */}
                  {(profileData.loginHistory?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-white/8 p-4" style={{ background: "rgba(255,255,255,.03)" }}>
                      <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Recent Logins</p>
                      <div className="space-y-1.5">
                        {profileData.loginHistory.slice(0, 5).map((log: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            <span className="font-mono text-white/40">{log.ip || "—"}</span>
                            <span className="text-white/30 text-[11px]">{log.created_at ? new Date(log.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-white/30 text-center py-8">Failed to load profile</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── WhatsApp Tab (dedicated page for all admin roles) ───────────────────────
function WhatsAppTab() {
  const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50";

  const { data } = useQuery<any>({
    queryKey: ["/api/admin/whatsapp/status"],
    queryFn: () => fetch("/api/admin/whatsapp/status", {
      headers: { Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}` }
    }).then(r => r.json()),
    refetchInterval: (d) => {
      const s = d?.state?.data?.status;
      return (s === "connecting" || s === "qr_ready") ? 2000 : 5000;
    },
  });
  const status = data?.status ?? "disconnected";
  const isConnected = status === "connected";

  const COMMANDS = [
    { cmd: "stats", desc: "Today's revenue, weekly & all-time totals" },
    { cmd: "orders 10", desc: "Last N completed orders with customer details" },
    { cmd: "pending", desc: "All unprocessed/pending orders" },
    { cmd: "customers", desc: "Total, verified, suspended, new in 24h" },
    { cmd: "stock", desc: "Every plan — in stock or out of stock" },
    { cmd: "tickets", desc: "Open & escalated support tickets" },
    { cmd: "find email@x.com", desc: "Full customer profile with orders & wallet" },
    { cmd: "wallet email@x.com", desc: "Check a customer's wallet balance" },
    { cmd: "suspend email@x.com", desc: "Suspend a customer account instantly" },
    { cmd: "unsuspend email@x.com", desc: "Restore a suspended account" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Hero header */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="relative px-6 py-8 flex items-center gap-5"
          style={{ background: "linear-gradient(135deg, rgba(37,211,102,.12) 0%, rgba(37,211,102,.04) 100%)", borderBottom: "1px solid rgba(37,211,102,.15)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-xl"
            style={{ background: "linear-gradient(135deg,#128C7E,#25D366)", boxShadow: "0 0 30px rgba(37,211,102,.35)" }}>
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white mb-1">WhatsApp Admin Bot</h1>
            <p className="text-sm text-white/50 leading-relaxed">
              Link your WhatsApp to command the store directly — check stats, manage customers, and monitor orders from your phone.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isConnected ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.3)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Linked
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-white/40 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                Not linked
              </span>
            )}
          </div>
        </div>

        {/* Connection panel */}
        <div className="p-6">
          <WhatsAppWebPanel inputCls={inputCls} />
        </div>
      </div>

      {/* Admin command reference */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "rgba(99,102,241,.2)" }}>
            <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Available Admin Commands</p>
          <span className="text-[10px] text-white/20 ml-auto">Only works from your linked admin number</span>
        </div>
        <div className="space-y-1.5">
          {COMMANDS.map(({ cmd, desc }) => (
            <div key={cmd} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,.03)" }}>
              <code className="text-xs font-mono font-bold text-emerald-400 shrink-0 min-w-[140px]">{cmd}</code>
              <span className="text-xs text-white/40">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-white/20 pt-1">
          Commands work with or without a leading slash. Just type <code className="text-white/35">help</code> in WhatsApp after linking to see the full list.
        </p>
      </div>
    </div>
  );
}

// ─── WhatsApp Web Panel ────────────────────────────────────────
function WhatsAppWebPanel({ inputCls }: { inputCls: string }) {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [method, setMethod] = useState<"qr" | "code">("code");

  const token = () => localStorage.getItem("admin_token") || "";
  const authHeader = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });

  const { data, refetch } = useQuery<any>({
    queryKey: ["/api/admin/whatsapp/status"],
    queryFn: () => fetch("/api/admin/whatsapp/status", { headers: authHeader() }).then(r => r.json()),
    refetchInterval: (d) => {
      const s = d?.state?.data?.status;
      return (s === "connecting" || s === "qr_ready") ? 2000 : 5000;
    },
  });

  const status = data?.status ?? "disconnected";
  const qrCode = data?.qrCode;
  const pairingCode = data?.pairingCode;
  const blockError = data?.error;

  async function connect() {
    setConnecting(true);
    try {
      const phone = method === "code" ? phoneNumber.replace(/\D/g, "") : undefined;
      const res = await fetch("/api/admin/whatsapp/connect", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const d = await res.json();
      if (d.success) {
        toast({ title: "Connecting…", description: method === "code" ? "Your pairing code will appear below" : "Scan the QR code with WhatsApp" });
        refetch();
      } else {
        toast({ title: "Failed", description: d.error, variant: "destructive" });
      }
    } catch { toast({ title: "Connection error", variant: "destructive" }); }
    finally { setConnecting(false); }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/admin/whatsapp/disconnect", { method: "POST", headers: authHeader() });
      toast({ title: "WhatsApp disconnected" });
      refetch();
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setDisconnecting(false); }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/whatsapp/test", { method: "POST", headers: authHeader() });
      const d = await res.json();
      if (d.success) toast({ title: "Test sent!", description: d.message });
      else toast({ title: "Test failed", description: d.error, variant: "destructive" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setTesting(false); }
  }

  async function saveAdminPhone() {
    try {
      const t = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ whatsappAdminPhone: adminPhone }),
      });
      const d = await res.json();
      if (d.success) toast({ title: "Admin number saved" });
      else toast({ title: "Save failed", description: d.error, variant: "destructive" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    disconnected: { label: "Disconnected", color: "text-white/40", dot: "bg-white/20" },
    connecting:   { label: "Connecting…", color: "text-amber-400", dot: "bg-amber-400 animate-pulse" },
    qr_ready:     { label: "Waiting for code entry", color: "text-amber-400", dot: "bg-amber-400 animate-pulse" },
    connected:    { label: "Connected", color: "text-emerald-400", dot: "bg-emerald-400" },
    blocked:      { label: "Blocked by WhatsApp", color: "text-red-400", dot: "bg-red-400" },
  };
  const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;

  return (
    <div className="glass rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "#25D36622" }}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
          </div>
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">WhatsApp Bot</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
          <span className={`text-xs font-medium ${sc.color}`}>{sc.label}</span>
        </div>
      </div>

      {/* Connected state */}
      {status === "connected" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(37,211,102,.08)", border: "1px solid rgba(37,211,102,.2)" }}>
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300">WhatsApp is linked and the bot is active. Customers can message you!</p>
          </div>
          <div className="flex gap-2">
            <button onClick={sendTest} disabled={testing} className="px-3 py-2 rounded-lg text-xs font-semibold transition-all" style={{ background: "#25D36622", color: "#25D366", border: "1px solid #25D36644" }} data-testid="button-test-whatsapp">
              {testing ? "Sending…" : "Send Test Message"}
            </button>
            <button onClick={disconnect} disabled={disconnecting} className="px-3 py-2 rounded-lg text-xs font-semibold text-red-400 transition-all hover:bg-red-500/10" style={{ border: "1px solid rgba(239,68,68,.2)" }} data-testid="button-disconnect-whatsapp">
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
          <div>
            <p className="text-xs text-white/40 mb-1.5">Your WhatsApp number (for order notifications)</p>
            <div className="flex gap-2">
              <Input value={adminPhone} onChange={e => setAdminPhone(e.target.value)} placeholder="254712345678" className={inputCls} data-testid="input-admin-phone" />
              <button onClick={saveAdminPhone} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-all shrink-0">Save</button>
            </div>
            <p className="text-[11px] text-white/25 mt-1">Country code + number, no + or spaces (e.g. 254712345678)</p>
          </div>
        </div>
      )}

      {/* Blocked by WhatsApp */}
      {status === "blocked" && (
        <div className="space-y-3">
          {/* Error banner */}
          <div className="flex gap-2.5 p-3 rounded-xl" style={{ background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.18)" }}>
            <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            <div>
              <p className="text-xs font-semibold text-red-400 mb-0.5">Blocked by WhatsApp</p>
              <p className="text-[11px] text-white/40 leading-relaxed">WhatsApp actively blocks WebSocket connections from cloud-hosted servers (Replit, Render, AWS, etc.). This is a WhatsApp policy — not a bug in the code.</p>
            </div>
          </div>

          {/* Option 1 — Official Meta API */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(99,102,241,.2)" }}>
            <div className="px-3 py-2 flex items-center gap-2" style={{ background: "rgba(99,102,241,.1)" }}>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Option 1 — Recommended</span>
              <span className="ml-auto text-[9px] text-indigo-300/60 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">Works from cloud</span>
            </div>
            <div className="p-3 space-y-1.5">
              <p className="text-xs font-semibold text-white/70">Official WhatsApp Business API (Meta)</p>
              <p className="text-[11px] text-white/40 leading-relaxed">Meta's official API works from any server. Go to Settings → Credentials and fill in <strong className="text-white/55">WhatsApp Access Token</strong> + <strong className="text-white/55">Phone Number ID</strong> to enable it.</p>
              <div className="text-[11px] text-white/30 space-y-1 pt-1">
                <p>1. Go to <strong className="text-white/45">developers.facebook.com</strong></p>
                <p>2. Create an app → Add WhatsApp product</p>
                <p>3. Get your <strong className="text-white/45">Phone Number ID</strong> + <strong className="text-white/45">Access Token</strong></p>
                <p>4. Paste both in Admin → Settings → Credentials</p>
              </div>
            </div>
          </div>

          {/* Option 2 — Telegram */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(37,211,102,.15)" }}>
            <div className="px-3 py-2 flex items-center gap-2" style={{ background: "rgba(37,211,102,.06)" }}>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Option 2 — Already working</span>
            </div>
            <div className="p-3">
              <p className="text-xs font-semibold text-white/70 mb-1">Telegram Admin Bot</p>
              <p className="text-[11px] text-white/40">Your Telegram bot is already set up and works perfectly from cloud servers. You get instant order alerts, stock warnings, and weekly reports — all without any restrictions.</p>
            </div>
          </div>

          {/* Option 3 — VPS */}
          <div className="p-3 rounded-xl space-y-1" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
            <p className="text-[11px] font-semibold text-white/40">Option 3 — Self-hosted VPS</p>
            <p className="text-[11px] text-white/25">Deploy the app on a VPS with a residential or non-datacenter IP (e.g. Contabo, Hetzner). WhatsApp is less likely to block those IPs. Use Admin → VPS Manager to set one up.</p>
          </div>

          <button onClick={disconnect} className="text-[11px] text-white/20 hover:text-white/40 transition-all">
            Clear session and try again
          </button>
        </div>
      )}

      {/* QR / Pairing code display */}
      {(status === "qr_ready" || status === "connecting") && (
        <div className="space-y-3">
          {pairingCode && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(37,211,102,.25)" }}>
              <div className="px-4 pt-4 pb-3 text-center" style={{ background: "rgba(37,211,102,.07)" }}>
                <p className="text-[11px] font-semibold text-emerald-400/70 uppercase tracking-widest mb-3">Your Pairing Code</p>
                {/* Format as XXXX-XXXX */}
                <p className="text-4xl font-mono font-black tracking-[0.25em] text-emerald-300" data-testid="text-pairing-code">
                  {pairingCode.length === 8
                    ? `${pairingCode.slice(0, 4)}-${pairingCode.slice(4)}`
                    : pairingCode}
                </p>
              </div>
              <div className="px-4 py-3 space-y-1.5" style={{ background: "rgba(0,0,0,.2)" }}>
                <p className="text-xs font-semibold text-white/60">How to link:</p>
                <ol className="text-[11px] text-white/35 space-y-1 list-decimal list-inside">
                  <li>Open WhatsApp on your phone</li>
                  <li>Tap ⋮ (3 dots) → <strong className="text-white/50">Linked Devices</strong></li>
                  <li>Tap <strong className="text-white/50">Link a Device</strong></li>
                  <li>Tap <strong className="text-white/50">"Link with phone number instead"</strong></li>
                  <li>Enter the code above</li>
                </ol>
              </div>
            </div>
          )}
          {qrCode && !pairingCode && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-white/40">Scan with WhatsApp → ⋮ → Linked Devices → Link a Device</p>
              <div className="p-3 bg-white rounded-2xl shadow-xl">
                <img src={qrCode} alt="WhatsApp QR Code" className="w-52 h-52 rounded-lg" data-testid="img-whatsapp-qr" />
              </div>
            </div>
          )}
          {status === "connecting" && !qrCode && !pairingCode && (
            <div className="flex items-center gap-2 text-amber-400/70 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Requesting pairing code from WhatsApp…
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={disconnect} disabled={disconnecting} className="text-xs text-red-400/60 hover:text-red-400 transition-all">
              Cancel
            </button>
            <span className="text-white/10">·</span>
            <button onClick={connect} disabled={connecting} className="text-xs text-white/40 hover:text-white/60 transition-all">
              {connecting ? "Generating…" : "Generate new code"}
            </button>
          </div>
        </div>
      )}

      {/* Disconnected — show connect options */}
      {status === "disconnected" && (
        <div className="space-y-3">
          <div className="flex gap-2 p-1 rounded-lg" style={{ background: "rgba(255,255,255,.04)" }}>
            {(["code", "qr"] as const).map(m => (
              <button key={m} onClick={() => setMethod(m)} className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={method === m ? { background: "rgba(37,211,102,.2)", color: "#25D366" } : { color: "rgba(255,255,255,.4)" }}>
                {m === "code" ? "📱 Pairing Code" : "📷 QR Code"}
              </button>
            ))}
          </div>

          {method === "code" && (
            <div>
              <p className="text-xs text-white/40 mb-1.5">Enter your WhatsApp number with country code</p>
              <Input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="254712345678" className={inputCls} data-testid="input-wa-phone" />
              <p className="text-[11px] text-white/25 mt-1">No + or spaces — e.g. 254712345678 for Kenya</p>
            </div>
          )}

          <button
            onClick={connect}
            disabled={connecting || (method === "code" && !phoneNumber.trim())}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(90deg, #25D366, #128C7E)", color: "#fff" }}
            data-testid="button-connect-whatsapp"
          >
            {connecting ? "Starting…" : method === "code" ? "Get Pairing Code" : "Show QR Code"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Telegram Test Button ─────────────────────────────────────
function TelegramTestButton({ telegramConfigured, dirty }: { telegramConfigured: boolean; dirty: boolean }) {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);

  async function test() {
    setTesting(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) toast({ title: "Test sent!", description: data.message });
      else toast({ title: "Test failed", description: data.error, variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "Connection failed", variant: "destructive" });
    } finally { setTesting(false); }
  }

  if (dirty) return <p className="text-[11px] text-amber-400/70 mt-1">Save credentials first, then test the connection.</p>;

  return (
    <button
      type="button"
      onClick={test}
      disabled={!telegramConfigured || testing}
      data-testid="button-test-telegram"
      className="mt-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: telegramConfigured ? "#2AABEE22" : "rgba(255,255,255,.05)", color: telegramConfigured ? "#2AABEE" : "rgba(255,255,255,.3)", border: `1px solid ${telegramConfigured ? "#2AABEE44" : "rgba(255,255,255,.08)"}` }}
    >
      {testing ? "Sending..." : telegramConfigured ? "Send Test Message" : "Configure above to test"}
    </button>
  );
}

// ─── Credentials Editor ───────────────────────────────────────
function CredentialsEditor({ inputCls }: { inputCls: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const { data, refetch } = useQuery<any>({
    queryKey: ["/api/admin/credentials"],
    queryFn: () => authFetch("/api/admin/credentials"),
  });
  const creds = data?.credentials ?? {};
  const effective = data?.effective ?? {};
  const sourceOverride = data?.sourceOverride ?? {};
  const envVarSet = data?.envVarSet ?? {};

  function val(key: string) {
    return form[key] !== undefined ? form[key] : creds[key] ?? "";
  }

  function update(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => authFetch("/api/admin/credentials", { method: "PUT", body: JSON.stringify(form) }),
    onSuccess: (d) => {
      if (d.success) { toast({ title: "Credentials saved", description: "Changes take effect immediately" }); setDirty(false); setForm({}); refetch(); }
      else toast({ title: "Failed", description: d.error, variant: "destructive" });
    },
  });

  const CredRow = ({ label, field, type = "text", placeholder, hint }: { label: string; field: string; type?: string; placeholder?: string; hint?: string }) => {
    const isSecret = type === "password";
    const revealed = show[field];
    const currentVal = val(field);
    const isMasked = currentVal === "••••••••••••••••";
    const fromOverride = !!sourceOverride[field];
    const fromEnv = !!envVarSet[field];
    const isSet = fromOverride || fromEnv || creds[`${field}Set`] || !!creds[field];
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-white/50 font-medium">{label}</label>
          <div className="flex items-center gap-1.5">
            {fromOverride && <Badge className="text-[9px] bg-violet-500/20 text-violet-400 border-0 px-1.5 py-0">Admin Set</Badge>}
            {!fromOverride && fromEnv && <Badge className="text-[9px] bg-slate-500/20 text-slate-400 border-0 px-1.5 py-0">Env Var</Badge>}
            {!isSet && <Badge className="text-[9px] bg-red-500/20 text-red-400 border-0 px-1.5 py-0">Not Set</Badge>}
          </div>
        </div>
        <div className="relative">
          <Input
            value={isSecret && !revealed && isMasked ? "••••••••••••••••" : currentVal}
            onChange={(e) => update(field, e.target.value)}
            onFocus={() => { if (isMasked) update(field, ""); }}
            type={isSecret && !revealed ? "password" : "text"}
            placeholder={placeholder || `Enter ${label}`}
            className={inputCls + (isSecret ? " pr-9" : "")}
            data-testid={`input-cred-${field}`}
          />
          {isSecret && (
            <button type="button" onClick={() => setShow((p) => ({ ...p, [field]: !p[field] }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        {hint && <p className="text-[10px] text-white/25">{hint}</p>}
      </div>
    );
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-white/8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600/20 flex items-center justify-center">
            <Key className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-white">API Credentials</p>
            <p className="text-xs text-white/40">Paystack keys, email config, admin login — override env vars here</p>
          </div>
        </div>
        {dirty && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
            className="bg-gradient-to-r from-amber-600 to-orange-600 border-0 text-white text-xs h-8 px-3" data-testid="button-save-credentials">
            <Save className="w-3.5 h-3.5 mr-1.5" />{saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>
      <div className="p-5 space-y-5">
        {/* Paystack */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Paystack</p>
            {effective.paystackConfigured && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0 px-1.5">Active</Badge>}
          </div>
          <CredRow label="Public Key" field="paystackPublicKey" placeholder="pk_live_..." hint="Used in the browser for Paystack popup" />
          <CredRow label="Secret Key" field="paystackSecretKey" type="password" placeholder="sk_live_..." hint="Used server-side to verify payments" />
        </div>
        {/* Email — Resend */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-3.5 h-3.5 text-indigo-400" />
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Email (Resend)</p>
            {effective.emailConfigured && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0 px-1.5">Active</Badge>}
          </div>
          <CredRow label="Resend API Key" field="resendApiKey" type="password" placeholder="re_••••••••••••"
            hint="Get your key at resend.com/api-keys — starts with re_" />
          <CredRow label="From Address" field="resendFrom" placeholder="hello@yourdomain.com"
            hint="Must be a verified sender in your Resend account. Leave blank to use onboarding@resend.dev (test only)" />
        </div>
        {/* Admin Login */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-3.5 h-3.5 text-violet-400" />
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Admin Login</p>
          </div>
          <CredRow label="Admin Email" field="adminEmail" placeholder="admin@example.com" />
          <CredRow label="Admin Password" field="adminPassword" type="password" placeholder="New password"
            hint="Leave blank to keep current password" />
        </div>
        {/* Telegram */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "#2AABEE22" }}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#2AABEE"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              </div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Telegram Bot</p>
            </div>
            {effective.telegramConfigured && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0 px-1.5">Active</Badge>}
          </div>
          <CredRow label="Bot Token" field="telegramBotToken" type="password" placeholder="123456789:ABC..."
            hint="Create a bot via @BotFather on Telegram, then copy the token" />
          <CredRow label="Chat ID" field="telegramChatId" placeholder="-1001234567890"
            hint="Your Telegram user/group/channel ID. Send a message to @userinfobot to find yours." />
          <TelegramTestButton telegramConfigured={!!effective.telegramConfigured} dirty={dirty} />
        </div>

        {/* OpenAI */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500/20">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">OpenAI (AI Chat Support)</p>
            </div>
            {(creds.openaiApiKeySet || !!effective.openaiApiKeySet) && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0 px-1.5">Active</Badge>}
          </div>
          <CredRow label="API Key" field="openaiApiKey" type="password" placeholder="sk-..."
            hint="Powers the AI chat assistant. Get one from platform.openai.com/api-keys" />
        </div>

        {/* WhatsApp Bot */}
        <WhatsAppWebPanel inputCls={inputCls} />

        {/* Cloudflare */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-3.5 h-3.5 text-orange-400" />
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Cloudflare DNS</p>
            {(creds.cloudflareApiTokenSet || !!envVarSet?.cloudflareApiToken) && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0 px-1.5">Active</Badge>}
          </div>
          <CredRow label="API Token" field="cloudflareApiToken" type="password" placeholder="••••••••••••••••••••••••••••••••••••••••"
            hint="Create at dash.cloudflare.com → My Profile → API Tokens. Needs Zone:DNS:Edit permission for your domain." />
        </div>

        {/* Database */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">PostgreSQL Database</p>
            {(creds.externalDatabaseUrlSet || !!envVarSet?.externalDatabaseUrl) && (
              <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0 px-1.5">Connected</Badge>
            )}
          </div>
          <CredRow
            label="External Database URL"
            field="externalDatabaseUrl"
            type="password"
            placeholder="postgresql://user:pass@host:5432/dbname"
            hint="PostgreSQL connection string from Neon, Supabase, or Render. Replaces SQLite — requires server restart to take effect."
          />
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-300/70">After saving, restart the server for the database switch to take effect. Get a free PostgreSQL at <strong className="text-amber-300">neon.tech</strong> or <strong className="text-amber-300">render.com</strong></p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.15)" }}>
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-xs text-white/40">Values set here override Replit environment variables. <strong className="text-indigo-300">Admin Set</strong> = saved here. <strong className="text-slate-300">Env Var</strong> = from Replit Secrets. Changes take effect immediately — no restart needed.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Logs Tab ──────────────────────────────────────────────────
function LogsTab() {
  const { toast } = useToast();
  const [category, setCategory] = useState<string>("all");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/logs", category],
    queryFn: () => authFetch(`/api/admin/logs?limit=200${category !== "all" ? `&category=${category}` : ""}`),
    refetchInterval: 15000,
  });

  const clearMutation = useMutation({
    mutationFn: () => authFetch("/api/admin/logs", { method: "DELETE" }),
    onSuccess: (d) => { if (d.success) { toast({ title: "Logs cleared" }); refetch(); } },
  });

  const logs = data?.logs ?? [];

  const LOG_STATUS: Record<string, { color: string; bg: string; icon: any }> = {
    success: { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle },
    warning: { color: "text-amber-400", bg: "bg-amber-500/10", icon: TriangleAlert },
    error: { color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
  };

  const CATEGORIES = [
    { id: "all", label: "All" },
    { id: "auth", label: "Auth" },
    { id: "settings", label: "Settings" },
    { id: "plans", label: "Plans" },
    { id: "accounts", label: "Accounts" },
    { id: "promos", label: "Promos" },
    { id: "customers", label: "Customers" },
    { id: "transactions", label: "Transactions" },
    { id: "apikeys", label: "API Keys" },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Activity Logs</h1>
          <p className="text-xs text-white/40 mt-0.5">Admin actions and events — last 200 entries</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending || logs.length === 0}
            variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs" data-testid="button-clear-logs">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />Clear Logs
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.id)}
            data-testid={`filter-log-${c.id}`}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              category === c.id
                ? "bg-indigo-600/80 text-white"
                : "glass border-white/10 text-white/40 hover:text-white"
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-white/40">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-2xl">
          <Terminal className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 font-medium">No logs yet</p>
          <p className="text-white/25 text-sm mt-1">Admin actions will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => {
            const conf = LOG_STATUS[log.status] ?? LOG_STATUS.success;
            const StatusIcon = conf.icon;
            return (
              <div key={log.id} data-testid={`log-entry-${log.id}`}
                className="glass-card rounded-xl px-4 py-3 flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${conf.bg}`}>
                  <StatusIcon className={`w-3.5 h-3.5 ${conf.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white">{log.action}</p>
                    <Badge className="text-[9px] bg-white/8 text-white/40 border-0 px-1.5">{log.category}</Badge>
                  </div>
                  {log.details && <p className="text-xs text-white/40 mt-0.5">{log.details}</p>}
                  {log.ip && <p className="text-[10px] text-white/20 mt-0.5">IP: {log.ip}</p>}
                </div>
                <p className="text-[10px] text-white/25 shrink-0 mt-0.5">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Sub-Admins Tab ──────────────────────────────────────────
const ALL_PERMISSION_TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "plans", label: "Plans & Offers" },
  { id: "accounts", label: "Accounts" },
  { id: "promos", label: "Promo Codes" },
  { id: "transactions", label: "Transactions" },
  { id: "apikeys", label: "API Keys" },
  { id: "customers", label: "Customers" },
  { id: "emailblast", label: "Email Blast" },
  { id: "support", label: "Support" },
  { id: "logs", label: "Activity Logs" },
];

function SubAdminsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputCls = "glass border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-indigo-500/50";

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/subadmins"],
    queryFn: () => authFetch("/api/admin/subadmins"),
  });
  const subAdmins = data?.subAdmins ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setShowForm(false); setEditId(null);
    setFormEmail(""); setFormName(""); setFormPassword(""); setFormPermissions([]);
  }

  function startEdit(sa: any) {
    setEditId(sa.id); setFormEmail(sa.email); setFormName(sa.name || "");
    setFormPassword(""); setFormPermissions(sa.permissions || []);
    setShowForm(true);
  }

  function togglePermission(id: string) {
    setFormPermissions(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  async function saveSubAdmin() {
    if (!formEmail || (!editId && !formPassword)) {
      toast({ title: "Email and password are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body: any = { email: formEmail, name: formName, permissions: formPermissions };
      if (formPassword) body.password = formPassword;

      const url = editId ? `/api/admin/subadmins/${editId}` : "/api/admin/subadmins";
      const method = editId ? "PUT" : "POST";
      const res = await authFetch(url, { method, body: JSON.stringify(body) });

      if (res.success) {
        toast({ title: editId ? "Sub-admin updated" : "Sub-admin created" });
        resetForm(); refetch();
      } else {
        toast({ title: "Failed", description: res.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: number, currentActive: boolean) {
    const res = await authFetch(`/api/admin/subadmins/${id}`, {
      method: "PUT", body: JSON.stringify({ active: !currentActive }),
    });
    if (res.success) { toast({ title: currentActive ? "Sub-admin deactivated" : "Sub-admin activated" }); refetch(); }
  }

  async function deleteSubAdmin(id: number, email: string) {
    if (!window.confirm(`Delete sub-admin ${email}? This cannot be undone.`)) return;
    const res = await authFetch(`/api/admin/subadmins/${id}`, { method: "DELETE" });
    if (res.success) { toast({ title: "Sub-admin deleted" }); refetch(); }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Sub-Admins</h1>
          <p className="text-xs text-white/40 mt-0.5">Create admin accounts with limited permissions</p>
        </div>
        {!showForm && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white">
            <Plus className="w-4 h-4 mr-1.5" />Add Sub-Admin
          </Button>
        )}
      </div>

      {showForm && (
        <div className="glass-card rounded-2xl p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">{editId ? "Edit Sub-Admin" : "New Sub-Admin"}</p>
            <Button size="sm" variant="ghost" onClick={resetForm} className="text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Email</label>
              <Input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="subadmin@example.com"
                className={inputCls} disabled={!!editId} />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Name</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="John Doe" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">{editId ? "New Password (leave blank to keep)" : "Password"}</label>
            <Input value={formPassword} onChange={e => setFormPassword(e.target.value)} type="password"
              placeholder={editId ? "Leave blank to keep current" : "Min 6 characters"} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-2">Permissions</label>
            <div className="grid grid-cols-3 gap-2">
              {ALL_PERMISSION_TABS.map(tab => (
                <button key={tab.id} onClick={() => togglePermission(tab.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    formPermissions.includes(tab.id)
                      ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-300"
                      : "glass border-white/10 text-white/40 hover:text-white/60"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/25 mt-2">Sub-admins cannot access Settings, API Credentials, or Sub-Admin management.</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={saveSubAdmin} disabled={saving}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white">
              <Save className="w-4 h-4 mr-1.5" />{saving ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
            <Button variant="outline" onClick={resetForm} className="glass border-white/10 text-white/50">Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-white/40">Loading...</div>
      ) : subAdmins.length === 0 && !showForm ? (
        <div className="text-center py-16 glass-card rounded-2xl">
          <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 font-medium">No sub-admins yet</p>
          <p className="text-white/25 text-xs mt-1">Create one to delegate admin tasks with limited access</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/8">
                <TableHead className="text-white/40 text-xs">Sub-Admin</TableHead>
                <TableHead className="text-white/40 text-xs">Status</TableHead>
                <TableHead className="text-white/40 text-xs">Permissions</TableHead>
                <TableHead className="text-white/40 text-xs">Created</TableHead>
                <TableHead className="text-white/40 text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subAdmins.map((sa: any) => (
                <TableRow key={sa.id} className="border-white/5 hover:bg-white/3">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center shrink-0">
                        <span className="text-violet-400 font-bold text-xs">{(sa.email || "?")[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{sa.name || sa.email}</p>
                        <p className="text-xs text-white/40">{sa.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {sa.active
                      ? <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">Active</Badge>
                      : <Badge className="bg-red-500/20 text-red-400 border-0 text-xs">Disabled</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(sa.permissions || []).length === 0
                        ? <span className="text-xs text-white/25">None</span>
                        : (sa.permissions || []).slice(0, 4).map((p: string) => (
                          <Badge key={p} className="text-[9px] bg-white/8 text-white/50 border-0 px-1.5">{p}</Badge>
                        ))}
                      {(sa.permissions || []).length > 4 && (
                        <Badge className="text-[9px] bg-white/8 text-white/50 border-0 px-1.5">+{sa.permissions.length - 4}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-white/40">{sa.createdAt ? new Date(sa.createdAt).toLocaleDateString() : "—"}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(sa)}
                        className="h-7 px-2 text-white/40 hover:text-indigo-400 hover:bg-indigo-500/10" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(sa.id, sa.active)}
                        className={`h-7 px-2 ${sa.active ? "text-white/40 hover:text-amber-400 hover:bg-amber-500/10" : "text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10"}`}
                        title={sa.active ? "Deactivate" : "Activate"}>
                        {sa.active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteSubAdmin(sa.id, sa.email)}
                        className="h-7 px-2 text-white/40 hover:text-red-400 hover:bg-red-500/10" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

// ─── Glass Stat Card ──────────────────────────────────────────
function GlassStatCard({ title, value, icon: Icon, gradient, glow }: { title: string; value: string | number; icon: any; gradient: string; glow: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${glow}, transparent)`, transform: "translate(30%, -30%)" }} />
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs text-white/40 font-medium">{title}</p>
        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}
          style={{ boxShadow: `0 0 12px ${glow}` }}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

// ─── Country / GEO RESTRICT TAB ──────────────────────────────────────────
const COUNTRY_LIST = [
  { code: "AF", name: "Afghanistan" }, { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" }, { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" }, { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" }, { code: "AM", name: "Armenia" },
  { code: "AU", name: "Australia" }, { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" }, { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" }, { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" }, { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" }, { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" }, { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" }, { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" }, { code: "BR", name: "Brazil" },
  { code: "BN", name: "Brunei" }, { code: "BG", name: "Bulgaria" },
  { code: "BF", name: "Burkina Faso" }, { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cabo Verde" }, { code: "KH", name: "Cambodia" },
  { code: "CM", name: "Cameroon" }, { code: "CA", name: "Canada" },
  { code: "CF", name: "Central African Republic" }, { code: "TD", name: "Chad" },
  { code: "CL", name: "Chile" }, { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" }, { code: "KM", name: "Comoros" },
  { code: "CD", name: "Congo (DRC)" }, { code: "CG", name: "Congo (Republic)" },
  { code: "CR", name: "Costa Rica" }, { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" }, { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" }, { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" }, { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" }, { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" }, { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" }, { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" }, { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopia" }, { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" }, { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" }, { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" }, { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" }, { code: "GR", name: "Greece" },
  { code: "GD", name: "Grenada" }, { code: "GT", name: "Guatemala" },
  { code: "GN", name: "Guinea" }, { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" }, { code: "HT", name: "Haiti" },
  { code: "HN", name: "Honduras" }, { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" }, { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" }, { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" }, { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" }, { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" }, { code: "JP", name: "Japan" },
  { code: "JO", name: "Jordan" }, { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" }, { code: "KI", name: "Kiribati" },
  { code: "KW", name: "Kuwait" }, { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Laos" }, { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" }, { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" }, { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" }, { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" }, { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" }, { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" }, { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" }, { code: "MH", name: "Marshall Islands" },
  { code: "MR", name: "Mauritania" }, { code: "MU", name: "Mauritius" },
  { code: "MX", name: "Mexico" }, { code: "FM", name: "Micronesia" },
  { code: "MD", name: "Moldova" }, { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" }, { code: "ME", name: "Montenegro" },
  { code: "MA", name: "Morocco" }, { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" }, { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" }, { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" }, { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" }, { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" }, { code: "KP", name: "North Korea" },
  { code: "MK", name: "North Macedonia" }, { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" }, { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" }, { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" }, { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" }, { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" }, { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" }, { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" }, { code: "RW", name: "Rwanda" },
  { code: "KN", name: "Saint Kitts and Nevis" }, { code: "LC", name: "Saint Lucia" },
  { code: "VC", name: "Saint Vincent and the Grenadines" }, { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" }, { code: "ST", name: "Sao Tome and Principe" },
  { code: "SA", name: "Saudi Arabia" }, { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" }, { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" }, { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" }, { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" }, { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa" }, { code: "SS", name: "South Sudan" },
  { code: "KR", name: "South Korea" }, { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" }, { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" }, { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" }, { code: "SY", name: "Syria" },
  { code: "TW", name: "Taiwan" }, { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania" }, { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" }, { code: "TG", name: "Togo" },
  { code: "TO", name: "Tonga" }, { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia" }, { code: "TR", name: "Turkey" },
  { code: "TM", name: "Turkmenistan" }, { code: "TV", name: "Tuvalu" },
  { code: "UG", name: "Uganda" }, { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" }, { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" }, { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" }, { code: "VU", name: "Vanuatu" },
  { code: "VE", name: "Venezuela" }, { code: "VN", name: "Vietnam" },
  { code: "YE", name: "Yemen" }, { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
];

function SuperAdminsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [resetId, setResetId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const inputCls = "w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all";
  const glassInput = { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" };

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/super-admins"],
    queryFn: () => authFetch("/api/admin/super-admins"),
  });
  const admins: any[] = data?.superAdmins ?? [];

  async function handleAdd() {
    if (!form.email || !form.password) return toast({ title: "Email and password required", variant: "destructive" });
    if (form.password.length < 8) return toast({ title: "Password must be at least 8 characters", variant: "destructive" });
    setSaving(true);
    const r = await authFetch("/api/admin/super-admins", { method: "POST", body: JSON.stringify(form) });
    setSaving(false);
    if (r.success) {
      toast({ title: "Super admin added" });
      setForm({ name: "", email: "", password: "" });
      setShowForm(false);
      refetch();
      qc.invalidateQueries({ queryKey: ["/api/admin/super-admins"] });
    } else {
      toast({ title: r.error || "Failed to add", variant: "destructive" });
    }
  }

  async function handleToggle(id: number) {
    const r = await authFetch(`/api/admin/super-admins/${id}/toggle`, { method: "PATCH" });
    if (r.success) { refetch(); toast({ title: r.active ? "Activated" : "Deactivated" }); }
    else toast({ title: r.error || "Failed", variant: "destructive" });
  }

  async function handleDelete(id: number, email: string) {
    if (!confirm(`Remove super admin ${email}? This cannot be undone.`)) return;
    const r = await authFetch(`/api/admin/super-admins/${id}`, { method: "DELETE" });
    if (r.success) { refetch(); toast({ title: "Super admin removed" }); }
    else toast({ title: r.error || "Failed", variant: "destructive" });
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 8) return toast({ title: "Password must be at least 8 characters", variant: "destructive" });
    setResetting(true);
    const r = await authFetch(`/api/admin/super-admins/${resetId}/password`, { method: "PUT", body: JSON.stringify({ password: newPassword }) });
    setResetting(false);
    if (r.success) { toast({ title: "Password updated" }); setResetId(null); setNewPassword(""); }
    else toast({ title: r.error || "Failed", variant: "destructive" });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-400" /> Super Admins
          </h2>
          <p className="text-sm text-white/40 mt-0.5">These accounts have full admin access, identical to yours. Only you can manage them.</p>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{ background: "rgba(139,92,246,.2)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,.3)" }}>
          <Plus className="w-3.5 h-3.5" /> Add Super Admin
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="glass rounded-2xl p-5 space-y-3" style={{ border: "1px solid rgba(139,92,246,.2)" }}>
          <p className="text-sm font-semibold text-white/70">New Super Admin</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Display name (optional)" className={inputCls} style={glassInput} />
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email address *" type="email" className={inputCls} style={glassInput} />
          </div>
          <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="Password (min 8 characters) *" type="password" className={inputCls} style={glassInput} />
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={saving}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
              style={{ background: saving ? "rgba(139,92,246,.3)" : "rgba(139,92,246,.6)" }}>
              {saving ? "Adding…" : "Add Super Admin"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 rounded-xl text-xs text-white/40 hover:text-white/60 transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="glass rounded-2xl p-8 text-center text-white/30 text-sm">Loading…</div>
      ) : admins.length === 0 && !showForm ? (
        <div className="glass rounded-2xl p-10 text-center space-y-2">
          <Shield className="w-8 h-8 text-white/20 mx-auto" />
          <p className="text-white/30 text-sm">No additional super admins yet</p>
          <p className="text-white/20 text-xs">Click "Add Super Admin" to grant full admin access to another account.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {admins.map((sa: any) => (
            <div key={sa.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3" style={{ border: "1px solid rgba(255,255,255,.07)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ background: sa.active ? "rgba(139,92,246,.25)" : "rgba(255,255,255,.06)", color: sa.active ? "#c4b5fd" : "rgba(255,255,255,.3)" }}>
                {(sa.name || sa.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{sa.name}</p>
                <p className="text-xs text-white/40 truncate">{sa.email}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${sa.active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                {sa.active ? "Active" : "Suspended"}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {resetId === sa.id ? (
                  <div className="flex items-center gap-1">
                    <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password"
                      placeholder="New password" className="text-xs px-2 py-1 rounded-lg w-32"
                      style={{ background: "rgba(255,255,255,.08)", color: "#fff", border: "1px solid rgba(255,255,255,.1)" }} />
                    <button onClick={handleResetPassword} disabled={resetting}
                      className="text-xs px-2 py-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all">
                      {resetting ? "…" : "Save"}
                    </button>
                    <button onClick={() => { setResetId(null); setNewPassword(""); }}
                      className="text-xs px-2 py-1 rounded-lg text-white/30 hover:text-white/50">✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setResetId(sa.id); setNewPassword(""); }}
                    className="text-[11px] px-2 py-1 rounded-lg text-white/30 hover:text-white/60 transition-all">
                    Reset pw
                  </button>
                )}
                <button onClick={() => handleToggle(sa.id)}
                  className="text-[11px] px-2 py-1 rounded-lg transition-all"
                  style={{ color: sa.active ? "#fca5a5" : "#86efac" }}>
                  {sa.active ? "Suspend" : "Activate"}
                </button>
                <button onClick={() => handleDelete(sa.id, sa.email)}
                  className="text-[11px] px-2 py-1 rounded-lg text-red-400/60 hover:text-red-400 transition-all">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reset password modal for inline is already inline above */}

      <div className="p-3 rounded-xl text-[11px] text-white/30 leading-relaxed" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
        <strong className="text-white/50">Note:</strong> Secondary super admins have full access to the admin panel — plans, orders, customers, settings, and everything else. The only thing they cannot do is manage other super admins (only your primary account can do that).
      </div>
    </div>
  );
}

function GeoRestrictTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Use Authorization: Bearer — the middleware reads req.headers.authorization
  const geoFetch = (url: string, opts: any = {}) => fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("admin_token") || ""}`,
      ...(opts.headers || {}),
    },
    body: opts.body,
  }).then(async (r) => {
    const json = await r.json();
    if (!r.ok) throw new Error(json?.error || `Request failed (${r.status})`);
    return json;
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/country-restrictions"],
    queryFn: () => geoFetch("/api/admin/country-restrictions"),
  });

  const config = data?.config;
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const mode: "blacklist" | "whitelist" = config?.mode || "blacklist";
  const blocked: string[] = Array.isArray(config?.countries) ? config.countries : [];

  const filteredList = COUNTRY_LIST.filter((c) =>
    !blocked.includes(c.code) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))
  );

  const setModeMutation = useMutation({
    mutationFn: (m: string) => geoFetch("/api/admin/country-restrictions", { method: "PUT", body: JSON.stringify({ mode: m }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/country-restrictions"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addCountryMutation = useMutation({
    mutationFn: (code: string) => geoFetch("/api/admin/country-restrictions/add", { method: "POST", body: JSON.stringify({ code }) }),
    onSuccess: (_data, code) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/country-restrictions"] });
      const name = COUNTRY_LIST.find((c) => c.code === code)?.name || code;
      toast({ title: `${name} added` });
      setSearch("");
      // keep panel open so user can add more; they can close with the × button
    },
    onError: (e: any) => toast({ title: "Failed to add", description: e.message, variant: "destructive" }),
  });

  const removeCountryMutation = useMutation({
    mutationFn: (code: string) => geoFetch(`/api/admin/country-restrictions/${code}`, { method: "DELETE" }),
    onSuccess: (_data, code) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/country-restrictions"] });
      const name = COUNTRY_LIST.find((c) => c.code === code)?.name || code;
      toast({ title: `${name} removed` });
    },
    onError: (e: any) => toast({ title: "Failed to remove", description: e.message, variant: "destructive" }),
  });

  // Focus search input when panel opens
  useEffect(() => {
    if (adding) setTimeout(() => searchRef.current?.focus(), 60);
  }, [adding]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Geo Restrictions</h2>
        <p className="text-sm text-white/40 mt-1">Control which countries can access your store</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : (
        <>
          {/* Mode Toggle */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Restriction Mode</h3>
            <div className="grid grid-cols-2 gap-3">
              {(["blacklist", "whitelist"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setModeMutation.mutate(m)}
                  disabled={setModeMutation.isPending}
                  className={`p-4 rounded-xl border transition-all text-left ${mode === m ? "border-indigo-500/60 bg-indigo-500/10" : "border-white/8 bg-white/3 opacity-60 hover:opacity-80"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {m === "blacklist" ? <Ban className="w-4 h-4 text-red-400" /> : <Globe className="w-4 h-4 text-emerald-400" />}
                    <span className="font-semibold text-white capitalize">{m}</span>
                    {mode === m && <Badge className="bg-indigo-600/70 text-white border-0 text-xs ml-auto">Active</Badge>}
                  </div>
                  <p className="text-xs text-white/40">
                    {m === "blacklist" ? "Block listed countries, allow everyone else" : "Only allow listed countries, block everyone else"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Active country list + Add panel */}
          <div className="glass-card rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {mode === "blacklist" ? "Blocked Countries" : "Allowed Countries"}
                  {blocked.length > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-indigo-600/40 text-indigo-300">{blocked.length}</span>
                  )}
                </h3>
                <p className="text-xs text-white/30 mt-0.5">
                  {mode === "blacklist" ? "Visitors from these countries see a 403 error" : "Only these countries can access the store"}
                </p>
              </div>
              <button
                onClick={() => { setAdding((v) => !v); setSearch(""); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${adding ? "bg-white/8 text-white/60 border border-white/10" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}
              >
                {adding ? <><X className="w-4 h-4" /> Close</> : <><Plus className="w-4 h-4" /> Add Country</>}
              </button>
            </div>

            {/* Add panel — search & pick */}
            {adding && (
              <div className="px-5 py-4 border-b border-white/8 bg-indigo-950/20">
                <p className="text-xs text-white/40 mb-2.5">
                  Search and click a country to {mode === "blacklist" ? "block" : "allow"} it:
                </p>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search country name or code…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-indigo-500/50"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-white/8 bg-white/3">
                  {filteredList.length === 0 ? (
                    <p className="text-xs text-white/30 text-center py-6">
                      {search ? "No countries match your search" : "All countries already added"}
                    </p>
                  ) : (
                    filteredList.slice(0, 30).map((c) => (
                      <button
                        key={c.code}
                        onClick={() => addCountryMutation.mutate(c.code)}
                        disabled={addCountryMutation.isPending}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-indigo-500/15 hover:text-white text-left transition-colors border-b border-white/4 last:border-0 disabled:opacity-50"
                      >
                        <img src={`https://flagcdn.com/16x12/${c.code.toLowerCase()}.png`} alt="" className="w-5 h-3.5 rounded-sm object-cover shrink-0" />
                        <span className="flex-1">{c.name}</span>
                        <span className="text-[10px] text-white/25 font-mono">{c.code}</span>
                        <Plus className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100" />
                      </button>
                    ))
                  )}
                </div>
                {filteredList.length > 30 && (
                  <p className="text-[10px] text-white/20 mt-2 text-center">Showing 30 of {filteredList.length} — type to narrow down</p>
                )}
              </div>
            )}

            {/* Current list */}
            <div className="p-5">
              {blocked.length === 0 ? (
                <div className="text-center py-10">
                  <Globe className="w-8 h-8 text-white/15 mx-auto mb-2" />
                  <p className="text-white/30 text-sm">No countries {mode === "blacklist" ? "blocked" : "allowed"} yet</p>
                  <p className="text-white/20 text-xs mt-1">
                    {mode === "blacklist" ? "All visitors can access the store" : "Click \"Add Country\" to allow a country"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {blocked.map((code) => {
                    const country = COUNTRY_LIST.find((c) => c.code === code);
                    return (
                      <div key={code} className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${mode === "blacklist" ? "border-red-500/15 bg-red-500/5" : "border-emerald-500/15 bg-emerald-500/5"}`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={`https://flagcdn.com/16x12/${code.toLowerCase()}.png`} alt="" className="w-5 h-3.5 rounded-sm object-cover shrink-0" />
                          <span className="text-sm text-white truncate">{country?.name || code}</span>
                          <span className="text-[10px] text-white/25 font-mono shrink-0">{code}</span>
                        </div>
                        <button
                          onClick={() => removeCountryMutation.mutate(code)}
                          disabled={removeCountryMutation.isPending}
                          title="Remove"
                          className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Info box */}
          <div className="rounded-xl p-4 border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-200/70 space-y-1">
                <p><strong>Blacklist mode:</strong> Countries in the list are blocked. Empty list = no restrictions.</p>
                <p><strong>Whitelist mode:</strong> Only countries in the list can access. Empty list = everyone blocked.</p>
                <p>The admin panel is always accessible regardless of geo restrictions.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── VPS SELLER DASHBOARD TAB ───────────────────────────────────────────────
const VPS_PLANS = [
  { name: "Starter",  ram: "1 GB",  cpu: "1 vCPU",  storage: "25 GB SSD",  bandwidth: "1 TB/mo",  price: 800 },
  { name: "Standard", ram: "2 GB",  cpu: "2 vCPU",  storage: "50 GB SSD",  bandwidth: "2 TB/mo",  price: 1500 },
  { name: "Pro",      ram: "4 GB",  cpu: "4 vCPU",  storage: "100 GB SSD", bandwidth: "4 TB/mo",  price: 2800 },
  { name: "Custom",   ram: "",      cpu: "",         storage: "",           bandwidth: "",          price: 0 },
];

const VPS_STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  active:    "bg-green-500/15 text-green-400 border-green-500/25",
  expired:   "bg-red-500/15 text-red-400 border-red-500/25",
  suspended: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  cancelled: "bg-gray-500/15 text-gray-400 border-gray-500/25",
};

function VpsSellerTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  function aFetch(url: string, opts: any = {}) {
    return fetch(url, {
      ...opts,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("admin_token") || ""}`, ...(opts.headers || {}) },
      body: opts.body,
    }).then((r) => r.json());
  }

  const [view, setView] = useState<"orders" | "plans">("orders");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/vps-orders"],
    queryFn: () => aFetch("/api/admin/vps-orders"),
    refetchInterval: 30000,
  });

  const { data: plansData, isLoading: plansLoading, refetch: refetchPlans } = useQuery<any>({
    queryKey: ["/api/admin/vps-plans"],
    queryFn: () => aFetch("/api/admin/vps-plans"),
  });

  const orders: any[] = data?.orders || [];
  const stats = data?.stats || {};
  const allPlans: any[] = plansData?.plans || [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editOrder, setEditOrder] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState<Record<number, boolean>>({});

  // Plans CRUD state
  const emptyPlanForm = { name: "", ram: "", cpu: "", storage: "", bandwidth: "", price_kes: "", popular: false, active: true, description: "", sort_order: "0" };
  const [planForm, setPlanForm] = useState({ ...emptyPlanForm });
  const [showPlanCreate, setShowPlanCreate] = useState(false);
  const [editPlan, setEditPlan] = useState<any | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [confirmDeletePlan, setConfirmDeletePlan] = useState<number | null>(null);

  async function handleCreatePlan() {
    setSavingPlan(true);
    try {
      const d = await aFetch("/api/admin/vps-plans", { method: "POST", body: JSON.stringify({ ...planForm, price_kes: Number(planForm.price_kes) || 0, sort_order: Number(planForm.sort_order) || 0 }) });
      if (d.success) { toast({ title: "Plan created" }); setShowPlanCreate(false); setPlanForm({ ...emptyPlanForm }); qc.invalidateQueries({ queryKey: ["/api/admin/vps-plans"] }); }
      else toast({ title: "Error", description: d.error, variant: "destructive" });
    } finally { setSavingPlan(false); }
  }
  async function handleUpdatePlan() {
    if (!editPlan) return;
    setSavingPlan(true);
    try {
      const d = await aFetch(`/api/admin/vps-plans/${editPlan.id}`, { method: "PUT", body: JSON.stringify({ ...planForm, price_kes: Number(planForm.price_kes) || 0, sort_order: Number(planForm.sort_order) || 0 }) });
      if (d.success) { toast({ title: "Plan updated" }); setEditPlan(null); qc.invalidateQueries({ queryKey: ["/api/admin/vps-plans"] }); }
      else toast({ title: "Error", description: d.error, variant: "destructive" });
    } finally { setSavingPlan(false); }
  }
  async function handleDeletePlan(id: number) {
    const d = await aFetch(`/api/admin/vps-plans/${id}`, { method: "DELETE" });
    if (d.success) { toast({ title: "Plan deleted" }); setConfirmDeletePlan(null); qc.invalidateQueries({ queryKey: ["/api/admin/vps-plans"] }); }
    else toast({ title: "Error", description: d.error, variant: "destructive" });
  }
  function openEditPlan(p: any) {
    setPlanForm({ name: p.name || "", ram: p.ram || "", cpu: p.cpu || "", storage: p.storage || "", bandwidth: p.bandwidth || "", price_kes: String(p.price_kes || ""), popular: !!p.popular, active: p.active !== false && p.active !== 0, description: p.description || "", sort_order: String(p.sort_order || 0) });
    setEditPlan(p);
  }

  const PlanFormModal = ({ title, onSubmit, onClose }: { title: string; onSubmit: () => void; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h3 className="font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {([["name","Plan Name"],["price_kes","Price (KES)"],["ram","RAM"],["cpu","CPU"],["storage","Storage"],["bandwidth","Bandwidth"],["sort_order","Sort Order"],["description","Description"]] as [string,string][]).map(([k,l]) => (
              <div key={k} className={k === "description" || k === "name" ? "col-span-2" : ""}>
                <label className="text-xs text-white/50 block mb-1">{l}</label>
                <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50" value={(planForm as any)[k]} onChange={e => setPlanForm(f => ({ ...f, [k]: e.target.value }))} placeholder={l} />
              </div>
            ))}
          </div>
          <div className="flex gap-4 pt-1">
            {([["popular","⭐ Mark as Popular"],["active","✅ Active (visible)"]] as [string,string][]).map(([k,l]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-cyan-500" checked={(planForm as any)[k]} onChange={e => setPlanForm(f => ({ ...f, [k]: e.target.checked }))} />
                <span className="text-sm text-white/60">{l}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-white/8">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm">Cancel</button>
          <button onClick={onSubmit} disabled={savingPlan} className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {savingPlan && <Loader2 className="w-4 h-4 animate-spin" />}{savingPlan ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  const emptyForm = { customer_name: "", customer_email: "", customer_phone: "", plan_name: "Standard", ram: "2 GB", cpu: "2 vCPU", storage: "50 GB SSD", bandwidth: "2 TB/mo", price_kes: "1500", status: "pending", assigned_ip: "", server_username: "root", server_password: "", ssh_port: "22", os_type: "ubuntu", notes: "", paid_at: "", expires_at: "" };
  const [form, setForm] = useState({ ...emptyForm });

  function applyPlanPreset(planName: string) {
    const plan = VPS_PLANS.find(p => p.name === planName);
    if (plan) setForm(f => ({ ...f, plan_name: plan.name, ram: plan.ram, cpu: plan.cpu, storage: plan.storage, bandwidth: plan.bandwidth, price_kes: String(plan.price) }));
  }

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchQ = !q || o.customer_name?.toLowerCase().includes(q) || o.customer_email?.toLowerCase().includes(q) || o.assigned_ip?.includes(q) || o.reference?.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || o.status === statusFilter;
    return matchQ && matchS;
  });

  async function handleCreate() {
    setSaving(true);
    try {
      const d = await aFetch("/api/admin/vps-orders", { method: "POST", body: JSON.stringify({ ...form, price_kes: Number(form.price_kes) || 0, ssh_port: Number(form.ssh_port) || 22 }) });
      if (d.success) { toast({ title: "Order created", description: d.order.reference }); setShowCreate(false); setForm({ ...emptyForm }); qc.invalidateQueries({ queryKey: ["/api/admin/vps-orders"] }); }
      else toast({ title: "Error", description: d.error, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleUpdate() {
    if (!editOrder) return;
    setSaving(true);
    try {
      const d = await aFetch(`/api/admin/vps-orders/${editOrder.id}`, { method: "PUT", body: JSON.stringify({ ...form, price_kes: Number(form.price_kes) || 0, ssh_port: Number(form.ssh_port) || 22 }) });
      if (d.success) { toast({ title: "Updated" }); setEditOrder(null); qc.invalidateQueries({ queryKey: ["/api/admin/vps-orders"] }); }
      else toast({ title: "Error", description: d.error, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    const d = await aFetch(`/api/admin/vps-orders/${id}`, { method: "DELETE" });
    if (d.success) { toast({ title: "Deleted" }); setConfirmDelete(null); qc.invalidateQueries({ queryKey: ["/api/admin/vps-orders"] }); }
    else toast({ title: "Error", description: d.error, variant: "destructive" });
  }

  function openEdit(o: any) {
    setForm({ customer_name: o.customer_name || "", customer_email: o.customer_email || "", customer_phone: o.customer_phone || "", plan_name: o.plan_name || "Custom", ram: o.ram || "", cpu: o.cpu || "", storage: o.storage || "", bandwidth: o.bandwidth || "", price_kes: String(o.price_kes || ""), status: o.status || "pending", assigned_ip: o.assigned_ip || "", server_username: o.server_username || "root", server_password: o.server_password || "", ssh_port: String(o.ssh_port || 22), os_type: o.os_type || "ubuntu", notes: o.notes || "", paid_at: o.paid_at ? o.paid_at.slice(0, 10) : "", expires_at: o.expires_at ? o.expires_at.slice(0, 10) : "" });
    setEditOrder(o);
  }

  const FormModal = ({ title, onSubmit, onClose }: { title: string; onSubmit: () => void; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h3 className="font-bold text-white text-base">{title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {/* Plan preset */}
          <div>
            <label className="text-xs text-white/50 block mb-1.5">Plan Preset</label>
            <div className="flex flex-wrap gap-2">
              {VPS_PLANS.map(p => (
                <button key={p.name} onClick={() => applyPlanPreset(p.name)} className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${form.plan_name === p.name ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" : "border-white/10 text-white/50 hover:border-white/20"}`}>{p.name}</button>
              ))}
            </div>
          </div>
          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            {[["customer_name","Customer Name"],["customer_email","Email"],["customer_phone","Phone (optional)"],["price_kes","Price (KES)"]].map(([k,l]) => (
              <div key={k}>
                <label className="text-xs text-white/50 block mb-1">{l}</label>
                <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={l} />
              </div>
            ))}
          </div>
          {/* Specs */}
          <div className="grid grid-cols-2 gap-3">
            {[["ram","RAM"],["cpu","CPU"],["storage","Storage"],["bandwidth","Bandwidth"]].map(([k,l]) => (
              <div key={k}>
                <label className="text-xs text-white/50 block mb-1">{l}</label>
                <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={l} />
              </div>
            ))}
          </div>
          {/* Server credentials */}
          <div className="border-t border-white/6 pt-3">
            <p className="text-xs text-white/40 mb-2 font-semibold uppercase tracking-wider">Server Credentials</p>
            <div className="grid grid-cols-2 gap-3">
              {[["assigned_ip","Server IP"],["server_username","Username"],["ssh_port","SSH Port"],["os_type","OS Type"]].map(([k,l]) => (
                <div key={k}>
                  <label className="text-xs text-white/50 block mb-1">{l}</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={l} />
                </div>
              ))}
            </div>
            <div className="mt-2">
              <label className="text-xs text-white/50 block mb-1">Password / Key</label>
              <input type="password" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50" value={form.server_password} onChange={e => setForm(f => ({ ...f, server_password: e.target.value }))} placeholder="Server password" />
            </div>
          </div>
          {/* Status & dates */}
          <div className="grid grid-cols-3 gap-3 border-t border-white/6 pt-3">
            <div>
              <label className="text-xs text-white/50 block mb-1">Status</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {["pending","active","expired","suspended","cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {[["paid_at","Paid Date"],["expires_at","Expires"]].map(([k,l]) => (
              <div key={k}>
                <label className="text-xs text-white/50 block mb-1">{l}</label>
                <input type="date" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
          </div>
          {/* Notes */}
          <div>
            <label className="text-xs text-white/50 block mb-1">Notes</label>
            <textarea rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 resize-none" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes…" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-white/8">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm transition-colors">Cancel</button>
          <button onClick={onSubmit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Server className="w-5 h-5 text-cyan-400" /> VPS Sales Dashboard</h2>
          <p className="text-white/40 text-sm mt-0.5">Manage VPS plans and customer orders</p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/8">
            <button onClick={() => setView("orders")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === "orders" ? "bg-cyan-600 text-white" : "text-white/50 hover:text-white"}`}>Orders</button>
            <button onClick={() => setView("plans")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === "plans" ? "bg-cyan-600 text-white" : "text-white/50 hover:text-white"}`}>Plans</button>
          </div>
          {view === "orders" && <>
            <button onClick={() => refetch()} className="px-3 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm flex items-center gap-1.5 transition-colors"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
            <button onClick={() => { setForm({ ...emptyForm }); setShowCreate(true); }} className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm flex items-center gap-1.5 transition-colors"><Plus className="w-4 h-4" />New Order</button>
          </>}
          {view === "plans" && <>
            <button onClick={() => refetchPlans()} className="px-3 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm flex items-center gap-1.5 transition-colors"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
            <button onClick={() => { setPlanForm({ ...emptyPlanForm }); setShowPlanCreate(true); }} className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm flex items-center gap-1.5 transition-colors"><Plus className="w-4 h-4" />New Plan</button>
          </>}
        </div>
      </div>

      {/* ── PLANS VIEW ─────────────────────────────────────────────── */}
      {view === "plans" && (
        <div className="space-y-4">
          {plansLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
          ) : allPlans.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No VPS plans yet</p>
              <p className="text-sm mt-1">Click "New Plan" to create your first plan. It'll appear on the VPS page for customers to purchase.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allPlans.map((p: any) => (
                <div key={p.id} className={`relative rounded-2xl border p-5 flex flex-col gap-3 ${p.popular ? "border-cyan-500/30 bg-cyan-950/20" : "border-white/8 bg-white/3"}`}>
                  {p.popular && <span className="absolute -top-2 left-4 bg-cyan-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Popular</span>}
                  {!p.active && <span className="absolute -top-2 right-4 bg-gray-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Hidden</span>}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base">{p.name}</h3>
                      {p.description && <p className="text-white/40 text-xs mt-0.5">{p.description}</p>}
                    </div>
                    <span className="text-cyan-400 font-bold text-sm whitespace-nowrap">KES {Number(p.price_kes || 0).toLocaleString()}/mo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-white/50">
                    {[["CPU", p.cpu],["RAM", p.ram],["Storage", p.storage],["Bandwidth", p.bandwidth]].filter(([,v]) => v).map(([k,v]) => (
                      <span key={k} className="flex gap-1"><span className="text-white/25">{k}:</span>{v}</span>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-auto pt-1">
                    <button onClick={() => openEditPlan(p)} className="flex-1 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors"><Pencil className="w-3.5 h-3.5" />Edit</button>
                    <button onClick={() => setConfirmDeletePlan(p.id)} className="py-2 px-3 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Plan modals */}
          {showPlanCreate && <PlanFormModal title="New VPS Plan" onSubmit={handleCreatePlan} onClose={() => setShowPlanCreate(false)} />}
          {editPlan && <PlanFormModal title={`Edit — ${editPlan.name}`} onSubmit={handleUpdatePlan} onClose={() => setEditPlan(null)} />}
          {confirmDeletePlan !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <div className="bg-gray-900 border border-red-500/20 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
                <Trash2 className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <h3 className="text-white font-bold mb-2">Delete this plan?</h3>
                <p className="text-white/40 text-sm mb-5">Existing orders will not be affected.</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmDeletePlan(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm">Cancel</button>
                  <button onClick={() => handleDeletePlan(confirmDeletePlan!)} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm">Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ORDERS VIEW ────────────────────────────────────────────── */}
      {view === "orders" && <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Orders",    val: stats.total ?? 0,      color: "text-white",        bg: "bg-white/4" },
          { label: "Active",          val: stats.active ?? 0,     color: "text-green-400",    bg: "bg-green-500/8" },
          { label: "Pending",         val: stats.pending ?? 0,    color: "text-yellow-400",   bg: "bg-yellow-500/8" },
          { label: "Expiring 7d",     val: stats.expiring7d ?? 0, color: "text-orange-400",   bg: "bg-orange-500/8" },
          { label: "Active Revenue",  val: `KES ${(stats.revenueKes ?? 0).toLocaleString()}`, color: "text-cyan-400", bg: "bg-cyan-500/8" },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className={`${bg} border border-white/6 rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
            <p className="text-xs text-white/40 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/40" placeholder="Search name, email, IP…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {["all","pending","active","expired","suspended","cancelled"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize ${statusFilter === s ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300" : "border-white/8 text-white/40 hover:text-white/60"}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Orders table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No VPS orders yet</p>
          <p className="text-sm mt-1">Click "New Order" to create the first one.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/8">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/3 border-b border-white/8">
                {["Reference","Customer","Plan","IP / Credentials","Status","Expires","Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o: any) => (
                <tr key={o.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-cyan-400/80">{o.reference}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white text-sm font-medium">{o.customer_name}</p>
                    <p className="text-white/40 text-xs">{o.customer_email}</p>
                    {o.customer_phone && <p className="text-white/30 text-xs">{o.customer_phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{o.plan_name}</p>
                    <p className="text-white/40 text-xs">{[o.ram, o.cpu, o.storage].filter(Boolean).join(" · ")}</p>
                    <p className="text-cyan-400 text-xs font-semibold">KES {Number(o.price_kes || 0).toLocaleString()}/mo</p>
                  </td>
                  <td className="px-4 py-3">
                    {o.assigned_ip ? (
                      <div>
                        <span className="font-mono text-xs text-green-400">{o.assigned_ip}</span>
                        {o.server_username && <p className="text-white/40 text-xs">user: {o.server_username}</p>}
                        {o.server_password && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-xs text-white/30">{showPass[o.id] ? o.server_password : "••••••••"}</span>
                            <button onClick={() => setShowPass(p => ({ ...p, [o.id]: !p[o.id] }))} className="text-white/20 hover:text-white/50">
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : <span className="text-white/20 text-xs italic">Not assigned</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${VPS_STATUS_COLORS[o.status] || "bg-gray-500/15 text-gray-400 border-gray-500/25"}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {o.expires_at ? (
                      <span className={`text-xs ${new Date(o.expires_at) <= new Date(Date.now() + 7*24*60*60*1000) && o.status === "active" ? "text-orange-400 font-semibold" : "text-white/50"}`}>
                        {new Date(o.expires_at).toLocaleDateString()}
                      </span>
                    ) : <span className="text-white/20 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(o)} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDelete(o.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && <FormModal title="New VPS Order" onSubmit={handleCreate} onClose={() => setShowCreate(false)} />}

      {/* Edit modal */}
      {editOrder && <FormModal title={`Edit — ${editOrder.reference}`} onSubmit={handleUpdate} onClose={() => setEditOrder(null)} />}

      {/* Delete confirm */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <Trash2 className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-bold text-base mb-2">Delete this order?</h3>
            <p className="text-white/40 text-sm mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete!)} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

// ─── VPS MANAGER TAB ────────────────────────────────────────────────────────
function VpsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const authFetch = (url: string, opts: any = {}) => fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("admin_token") || ""}`, ...(opts.headers || {}) },
    body: opts.body,
  }).then((r) => r.json());

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/vps"],
    queryFn: () => authFetch("/api/admin/vps"),
  });

  const servers: any[] = data?.servers || [];
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ label: "", host: "", port: "22", username: "root", authType: "password", password: "", privateKey: "", osType: "ubuntu" });
  const [pingResults, setPingResults] = useState<Record<string, any>>({});
  const [agentScriptVps, setAgentScriptVps] = useState<string | null>(null);
  const [agentScript, setAgentScript] = useState<string>("");
  const [agentScriptLoading, setAgentScriptLoading] = useState(false);

  const OS_OPTIONS = [
    { group: "Debian-based", items: [
      { value: "ubuntu",   label: "Ubuntu",           icon: "🟠" },
      { value: "debian",   label: "Debian",           icon: "🔴" },
      { value: "kali",     label: "Kali Linux",       icon: "🐉" },
      { value: "mint",     label: "Linux Mint",       icon: "🟢" },
      { value: "pop",      label: "Pop!_OS",          icon: "🟡" },
      { value: "raspbian", label: "Raspberry Pi OS",  icon: "🍓" },
    ]},
    { group: "RHEL-based", items: [
      { value: "almalinux", label: "AlmaLinux",      icon: "🔵" },
      { value: "centos",    label: "CentOS",         icon: "🟣" },
      { value: "rocky",     label: "Rocky Linux",   icon: "🪨" },
      { value: "fedora",    label: "Fedora",         icon: "🎩" },
      { value: "rhel",      label: "RHEL",           icon: "🔴" },
      { value: "oracle",    label: "Oracle Linux",   icon: "🔴" },
    ]},
    { group: "Other", items: [
      { value: "windows", label: "Windows (RDP/SSH)", icon: "🪟" },
      { value: "arch",    label: "Arch Linux",        icon: "🏔️" },
      { value: "other",   label: "Other Linux",       icon: "🐧" },
    ]},
  ];
  const allOsItems = OS_OPTIONS.flatMap(g => g.items);
  const getOsInfo = (val: string) => allOsItems.find(o => o.value === val) ?? { icon: "🐧", label: val || "Unknown OS" };
  const [pingLoading, setPingLoading] = useState<Record<string, boolean>>({});
  const [rebootLoading, setRebootLoading] = useState<Record<string, boolean>>({});
  const [terminalState, setTerminalState] = useState<Record<string, { open: boolean; cmd: string; output: string; loading: boolean }>>({});
  const [confirmReboot, setConfirmReboot] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: () => authFetch("/api/admin/vps", { method: "POST", body: JSON.stringify({ ...form, port: parseInt(form.port) || 22 }) }),
    onSuccess: (res) => {
      if (res.success) {
        toast({ title: "VPS added!", description: res.server.label });
        setShowAdd(false);
        setForm({ label: "", host: "", port: "22", username: "root", authType: "password", password: "", privateKey: "", osType: "ubuntu" });
        qc.invalidateQueries({ queryKey: ["/api/admin/vps"] });
      } else {
        toast({ title: "Failed", description: res.error, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/vps/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Server removed" }); qc.invalidateQueries({ queryKey: ["/api/admin/vps"] }); },
  });

  const pingServer = async (id: string) => {
    setPingLoading((p) => ({ ...p, [id]: true }));
    try {
      const res = await authFetch(`/api/admin/vps/${id}/ping`);
      setPingResults((p) => ({ ...p, [id]: { success: res.success, ...(res.ping || {}) } }));
    } catch { setPingResults((p) => ({ ...p, [id]: { success: false } })); }
    finally { setPingLoading((p) => ({ ...p, [id]: false })); }
  };

  const loadAgentScript = async (id: string) => {
    setAgentScriptVps(id);
    setAgentScript("");
    setAgentScriptLoading(true);
    try {
      const data = await authFetch(`/api/agent/script/${id}`);
      setAgentScript(data.script || "Error: empty script returned");
    } catch (e: any) { setAgentScript("Error: " + e.message); }
    finally { setAgentScriptLoading(false); }
  };

  const rebootServer = async (id: string) => {
    setRebootLoading((r) => ({ ...r, [id]: true }));
    setConfirmReboot(null);
    try {
      const res = await authFetch(`/api/admin/vps/${id}/reboot`, { method: "POST" });
      toast({ title: res.success ? "Rebooting!" : "Failed", description: res.message });
    } finally { setRebootLoading((r) => ({ ...r, [id]: false })); }
  };

  const execCommand = async (id: string) => {
    const t = terminalState[id];
    if (!t?.cmd.trim()) return;
    setTerminalState((s) => ({ ...s, [id]: { ...t, loading: true, output: "" } }));
    try {
      const res = await authFetch(`/api/admin/vps/${id}/exec`, { method: "POST", body: JSON.stringify({ command: t.cmd }) });
      setTerminalState((s) => ({ ...s, [id]: { ...s[id], loading: false, output: res.stdout || res.stderr || res.error || "No output" } }));
    } catch (err: any) {
      setTerminalState((s) => ({ ...s, [id]: { ...s[id], loading: false, output: err.message } }));
    }
  };

  const inputCls = "bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-indigo-500/50";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">VPS Manager</h2>
          <p className="text-sm text-white/40 mt-1">Monitor, reboot and manage your servers via SSH</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
          <Plus className="w-4 h-4 mr-1.5" />Add VPS
        </Button>
      </div>

      {/* ── Agent script modal ─────────────────────────────────────────────── */}
      {agentScriptVps && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.85)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setAgentScriptVps(null); }}>
          <div className="w-full max-w-2xl rounded-2xl border border-emerald-500/20 overflow-hidden" style={{ background: "#0a0f1e", boxShadow: "0 25px 60px rgba(0,0,0,.6)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <h3 className="font-bold text-white text-sm">Deploy Agent Install Script</h3>
                <p className="text-xs text-white/40 mt-0.5">Copy and paste this into your VPS terminal — runs everything automatically</p>
              </div>
              <button onClick={() => setAgentScriptVps(null)} className="text-white/30 hover:text-white text-lg leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-300 space-y-1">
                <p className="font-semibold text-emerald-200">What this does:</p>
                <p>✓ Installs Node.js + PM2 if not already installed</p>
                <p>✓ Creates a deploy agent at <code className="text-white/70">/opt/deploy-agent/agent.js</code></p>
                <p>✓ Starts the agent with PM2 (survives reboots)</p>
                <p>✓ Agent polls your app every <strong>60 seconds</strong> for new paid orders and deploys them automatically</p>
              </div>
              {agentScriptLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-emerald-400 animate-spin" /></div>
              ) : (
                <>
                  <div className="relative rounded-xl border border-white/10 bg-black/50 overflow-hidden">
                    <pre className="text-xs text-white/70 font-mono p-4 overflow-auto max-h-72 whitespace-pre-wrap">{agentScript}</pre>
                    <button
                      onClick={() => { navigator.clipboard.writeText(agentScript); toast({ title: "Copied to clipboard!" }); }}
                      className="absolute top-2 right-2 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-xs rounded-lg transition-colors">
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-white/30">Run as <code className="text-white/50">root</code> or with <code className="text-white/50">sudo</code>. After install: <code className="text-white/50">pm2 logs chege-deploy-agent</code> to monitor.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="glass-card rounded-2xl p-5 border border-indigo-500/20">
          <h3 className="text-sm font-semibold text-white mb-4">Add New VPS Server</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs text-white/40 block mb-1">Label / Name</label>
              <Input placeholder="My Production Server" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className={inputCls} /></div>
            <div><label className="text-xs text-white/40 block mb-1">Host / IP Address *</label>
              <Input placeholder="123.45.67.89" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} className={inputCls} /></div>
            <div><label className="text-xs text-white/40 block mb-1">SSH Port</label>
              <Input placeholder="22" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} className={inputCls} /></div>
            <div><label className="text-xs text-white/40 block mb-1">Username *</label>
              <Input placeholder="root" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className={inputCls} /></div>
            <div><label className="text-xs text-white/40 block mb-1">Operating System *</label>
              <select value={form.osType} onChange={(e) => setForm((f) => ({ ...f, osType: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm text-white bg-white/5 border border-white/10 outline-none">
                {OS_OPTIONS.map(group => (
                  <optgroup key={group.group} label={group.group}>
                    {group.items.map(os => (
                      <option key={os.value} value={os.value}>{os.icon} {os.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select></div>
            <div><label className="text-xs text-white/40 block mb-1">Auth Type</label>
              <select value={form.authType} onChange={(e) => setForm((f) => ({ ...f, authType: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm text-white bg-white/5 border border-white/10 outline-none">
                <option value="password">Password</option>
                <option value="key">Private Key (PEM)</option>
              </select></div>
            {form.authType === "password" ? (
              <div><label className="text-xs text-white/40 block mb-1">Password</label>
                <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} /></div>
            ) : (
              <div className="sm:col-span-2"><label className="text-xs text-white/40 block mb-1">Private Key (PEM format)</label>
                <textarea value={form.privateKey} onChange={(e) => setForm((f) => ({ ...f, privateKey: e.target.value }))}
                  rows={4} placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..." className="w-full rounded-lg px-3 py-2 text-xs text-white bg-white/5 border border-white/10 outline-none resize-none font-mono" /></div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => addMutation.mutate()} disabled={!form.host || !form.username || addMutation.isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}<span className="ml-1.5">Add Server</span>
            </Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)} className="text-white/40 hover:text-white">Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : servers.length === 0 ? (
        <div className="glass-card rounded-2xl text-center py-16">
          <Server className="w-10 h-10 text-white/15 mx-auto mb-3" />
          <p className="text-white/40 font-medium">No VPS servers added yet</p>
          <p className="text-white/25 text-sm mt-1">Add your first server to start managing it</p>
        </div>
      ) : (
        <div className="space-y-4">
          {servers.map((server: any) => {
            const ping = pingResults[server.id];
            const isTermOpen = terminalState[server.id]?.open;
            return (
              <div key={server.id} className="glass-card rounded-2xl overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,.2)" }}>
                        <Server className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{server.label}</p>
                        <p className="text-xs text-white/40 font-mono">{server.username}@{server.host}:{server.port}</p>
                        <p className="text-xs text-white/30 mt-0.5">
                          {server.osType && <span className="mr-2">{getOsInfo(server.osType).icon} {getOsInfo(server.osType).label}</span>}
                          Auth: {server.authType} · Added {new Date(server.addedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => pingServer(server.id)} disabled={pingLoading[server.id]}
                        variant="outline" className="border-white/10 text-white/60 hover:text-white hover:bg-white/5">
                        {pingLoading[server.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                        <span className="ml-1.5">Ping</span>
                      </Button>
                      <Button size="sm" onClick={() => setTerminalState((s) => ({ ...s, [server.id]: { open: !isTermOpen, cmd: s[server.id]?.cmd || "", output: s[server.id]?.output || "", loading: false } }))}
                        variant="outline" className="border-white/10 text-white/60 hover:text-white hover:bg-white/5">
                        <Terminal className="w-3.5 h-3.5" /><span className="ml-1.5">Terminal</span>
                      </Button>
                      <Button size="sm" onClick={() => loadAgentScript(server.id)}
                        variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                        <Zap className="w-3.5 h-3.5" /><span className="ml-1.5">Get Script</span>
                      </Button>
                      <Button size="sm" onClick={() => setConfirmReboot(server.id)} disabled={rebootLoading[server.id]}
                        className="bg-amber-600/70 hover:bg-amber-600 text-white border-0">
                        {rebootLoading[server.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                        <span className="ml-1.5">Reboot</span>
                      </Button>
                      <Button size="sm" onClick={() => deleteMutation.mutate(server.id)}
                        variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {confirmReboot === server.id && (
                    <div className="mt-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/8 flex items-center justify-between gap-3">
                      <p className="text-xs text-amber-300">⚠️ Are you sure you want to reboot <strong>{server.label}</strong>? This will cause a brief downtime.</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => rebootServer(server.id)} className="bg-amber-600 hover:bg-amber-500 text-white h-7 text-xs">Reboot Now</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmReboot(null)} className="text-white/40 h-7 text-xs">Cancel</Button>
                      </div>
                    </div>
                  )}

                  {ping && (
                    <div className={`mt-3 p-3 rounded-xl border ${ping.success ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                      {ping.success ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div><p className="text-white/40 mb-0.5"><Cpu className="w-3 h-3 inline mr-1" />Load</p><p className="text-white font-mono">{ping.load || "—"}</p></div>
                          <div><p className="text-white/40 mb-0.5"><MemoryStick className="w-3 h-3 inline mr-1" />Memory</p><p className="text-white font-mono">{ping.memory || "—"}</p></div>
                          <div><p className="text-white/40 mb-0.5"><HardDrive className="w-3 h-3 inline mr-1" />Disk</p><p className="text-white font-mono">{ping.disk || "—"}</p></div>
                          <div><p className="text-white/40 mb-0.5"><Power className="w-3 h-3 inline mr-1" />Uptime</p><p className="text-white font-mono text-xs">{ping.uptime || "—"}</p></div>
                        </div>
                      ) : (
                        <p className="text-xs text-red-400">⚠️ Could not connect to server — check host, port, and credentials</p>
                      )}
                    </div>
                  )}
                </div>

                {isTermOpen && (
                  <div className="border-t border-white/8 p-4 bg-black/20">
                    <p className="text-xs text-white/40 mb-2"><Terminal className="w-3 h-3 inline mr-1" />Remote Terminal — {server.username}@{server.host}</p>
                    <div className="flex gap-2">
                      <Input
                        value={terminalState[server.id]?.cmd || ""}
                        onChange={(e) => setTerminalState((s) => ({ ...s, [server.id]: { ...s[server.id], cmd: e.target.value } }))}
                        onKeyDown={(e) => { if (e.key === "Enter") execCommand(server.id); }}
                        placeholder="e.g. df -h / | cat /etc/os-release | systemctl status nginx"
                        className="flex-1 font-mono text-xs bg-black/30 border-white/10 text-green-300 placeholder-white/20"
                      />
                      <Button size="sm" onClick={() => execCommand(server.id)} disabled={terminalState[server.id]?.loading || !terminalState[server.id]?.cmd?.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white">
                        {terminalState[server.id]?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </Button>
                    </div>
                    {terminalState[server.id]?.output && (
                      <pre className="mt-2 p-3 rounded-lg bg-black/40 text-green-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto border border-white/5">
                        {terminalState[server.id].output}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DOMAINS TAB ────────────────────────────────────────────────────────────
function DomainsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const authFetchD = (url: string, opts: any = {}) =>
    fetch(url, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}`, ...(opts.headers || {}) },
      body: opts.body,
    }).then((r) => r.json());

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/domains"],
    queryFn: () => authFetchD("/api/admin/domains"),
  });

  const domains: any[] = data?.domains || [];
  const replitDomain: string | null = data?.replitDomain || null;

  const [newDomain, setNewDomain] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingCname, setEditingCname] = useState(false);
  const [cnameInput, setCnameInput] = useState("");

  const inputCls = "bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-indigo-500/50";

  const addMutation = useMutation({
    mutationFn: () => authFetchD("/api/admin/domains", { method: "POST", body: JSON.stringify({ domain: newDomain, label: newLabel || newDomain }) }),
    onSuccess: (res) => {
      if (res.success) {
        toast({ title: "Domain added!", description: res.domain.domain });
        setNewDomain(""); setNewLabel(""); setShowAdd(false);
        qc.invalidateQueries({ queryKey: ["/api/admin/domains"] });
      } else {
        toast({ title: "Failed", description: res.error, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authFetchD(`/api/admin/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Domain removed" }); qc.invalidateQueries({ queryKey: ["/api/admin/domains"] }); },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (id: string) => authFetchD(`/api/admin/domains/${id}/primary`, { method: "PUT" }),
    onSuccess: () => { toast({ title: "Primary domain updated" }); qc.invalidateQueries({ queryKey: ["/api/admin/domains"] }); },
  });

  const saveCnameMutation = useMutation({
    mutationFn: () => authFetchD("/api/admin/domains/cname-target", { method: "PUT", body: JSON.stringify({ appDomain: cnameInput.trim() }) }),
    onSuccess: (res) => {
      if (res.success) {
        toast({ title: "CNAME target saved" });
        setEditingCname(false);
        qc.invalidateQueries({ queryKey: ["/api/admin/domains"] });
      } else {
        toast({ title: "Failed to save", variant: "destructive" });
      }
    },
  });

  const [cfVerifyingId, setCfVerifyingId] = useState<string | null>(null);
  const cfVerifyMutation = useMutation({
    mutationFn: (id: string) => {
      setCfVerifyingId(id);
      return authFetchD(`/api/admin/domains/${id}/cloudflare-verify`, { method: "POST" });
    },
    onSuccess: (res, id) => {
      setCfVerifyingId(null);
      if (res.success) {
        toast({ title: `DNS record ${res.action === "updated" ? "updated" : "created"} on Cloudflare`, description: `${res.record?.name} → ${res.record?.content}` });
      } else {
        toast({ title: "Cloudflare error", description: res.error, variant: "destructive" });
      }
    },
    onError: (_err, _id) => { setCfVerifyingId(null); toast({ title: "Request failed", variant: "destructive" }); },
  });

  const [dnsResults, setDnsResults] = useState<Record<string, { verified: boolean; found: string | null; expected: string | null; propagated: boolean } | null>>({});
  const [dnsCheckingId, setDnsCheckingId] = useState<string | null>(null);
  async function checkDns(id: string) {
    setDnsCheckingId(id);
    try {
      const res = await authFetchD(`/api/admin/domains/${id}/verify`);
      setDnsResults((prev) => ({ ...prev, [id]: res.success ? res : null }));
      if (!res.success) toast({ title: "DNS check failed", description: res.error, variant: "destructive" });
    } catch {
      toast({ title: "DNS check failed", variant: "destructive" });
    } finally {
      setDnsCheckingId(null);
    }
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const cnameDest = replitDomain
    ? replitDomain.split(",")[0].trim()
    : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Custom Domains</h2>
          <p className="text-sm text-white/40 mt-1">Manage additional domains that point to your store</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
          <Plus className="w-4 h-4 mr-1.5" />Add Domain
        </Button>
      </div>

      {/* CNAME target — always shown, always editable */}
      <div className="glass-card rounded-2xl p-5 border border-indigo-500/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">CNAME Target (Points To)</p>
          </div>
          {!editingCname && (
            <Button size="sm" variant="outline" onClick={() => { setCnameInput(cnameDest); setEditingCname(true); }}
              className="border-white/10 text-white/50 hover:text-white h-7 text-xs">
              <Pencil className="w-3 h-3 mr-1" />Edit
            </Button>
          )}
        </div>
        {editingCname ? (
          <div className="space-y-3">
            <Input
              value={cnameInput}
              onChange={(e) => setCnameInput(e.target.value)}
              placeholder="your-app.replit.app or myapp.onrender.com"
              className={inputCls + " font-mono"}
            />
            <p className="text-xs text-white/35">Enter your deployed app domain — this is what DNS CNAME records should point to.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveCnameMutation.mutate()} disabled={saveCnameMutation.isPending || !cnameInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {saveCnameMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingCname(false)} className="text-white/40 hover:text-white">Cancel</Button>
            </div>
          </div>
        ) : cnameDest ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-mono text-white font-medium">{cnameDest}</p>
              <p className="text-xs text-white/40 mt-0.5">All custom domains should CNAME to this address</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copyText(cnameDest, "replit")}
                className="border-white/10 text-white/60 hover:text-white">
                {copiedId === "replit" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="ml-1.5">Copy</span>
              </Button>
              <a href={`https://${cnameDest}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="border-white/10 text-white/60 hover:text-white">
                  <ExternalLink className="w-3.5 h-3.5" /><span className="ml-1.5">Open</span>
                </Button>
              </a>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-white/40">No CNAME target set yet.</p>
            <p className="text-xs text-white/25 mt-1">Click <strong className="text-white/40">Edit</strong> to enter your deployed app domain (e.g. <span className="font-mono">myapp.onrender.com</span>).</p>
          </div>
        )}
      </div>

      {/* Add domain form */}
      {showAdd && (
        <div className="glass-card rounded-2xl p-5 border border-indigo-500/20">
          <h3 className="text-sm font-semibold text-white mb-4">Add Custom Domain</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 block mb-1">Domain name *</label>
              <Input
                placeholder="shop.yourdomain.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1">Label (optional)</label>
              <Input
                placeholder="My Store Domain"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* DNS instructions preview */}
          {newDomain && (
            <div className="mt-4 p-4 rounded-xl border border-white/8 bg-white/3">
              <p className="text-xs text-white/50 mb-3 font-medium">DNS record to add at your registrar:</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-white/30">
                      <th className="text-left pb-2 pr-4">Type</th>
                      <th className="text-left pb-2 pr-4">Name / Host</th>
                      <th className="text-left pb-2">Points to</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-white/70">
                      <td className="pr-4 py-1"><Badge className="bg-blue-600/40 text-blue-300 border-0 text-xs">CNAME</Badge></td>
                      <td className="pr-4 py-1">{newDomain.replace(/\..+$/, "") || "@"}</td>
                      <td className="py-1 text-indigo-300">{cnameDest}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!newDomain.trim() || addMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              Add Domain
            </Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)} className="text-white/40 hover:text-white">Cancel</Button>
          </div>
        </div>
      )}

      {/* Domain list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : domains.length === 0 ? (
        <div className="glass-card rounded-2xl text-center py-16">
          <Link2 className="w-10 h-10 text-white/15 mx-auto mb-3" />
          <p className="text-white/40 font-medium">No custom domains added yet</p>
          <p className="text-white/25 text-sm mt-1">Add a domain to serve your store under your own brand</p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d: any) => (
            <div key={d.id} className={`glass-card rounded-2xl p-5 border ${d.primary ? "border-indigo-500/30" : "border-white/8"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${d.primary ? "bg-indigo-500/20" : "bg-white/5"}`}>
                    <Link2 className={`w-4 h-4 ${d.primary ? "text-indigo-400" : "text-white/40"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white font-mono">{d.domain}</p>
                      {d.primary && <Badge className="bg-indigo-600/60 text-white border-0 text-xs">Primary</Badge>}
                    </div>
                    {d.label !== d.domain && <p className="text-xs text-white/40">{d.label}</p>}
                    <p className="text-xs text-white/25 mt-0.5">Added {new Date(d.addedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyText(d.domain, d.id + "-copy")}
                    className="border-white/10 text-white/50 hover:text-white h-8">
                    {copiedId === d.id + "-copy" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="ml-1.5 text-xs">Copy</span>
                  </Button>
                  <a href={`https://${d.domain}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="border-white/10 text-white/50 hover:text-white h-8">
                      <ExternalLink className="w-3.5 h-3.5" /><span className="ml-1.5 text-xs">Visit</span>
                    </Button>
                  </a>
                  {!d.primary && (
                    <Button size="sm" variant="outline" onClick={() => setPrimaryMutation.mutate(d.id)} disabled={setPrimaryMutation.isPending}
                      className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 h-8">
                      <Star className="w-3.5 h-3.5" /><span className="ml-1.5 text-xs">Set Primary</span>
                    </Button>
                  )}
                  <Button size="sm" variant="outline"
                    onClick={() => cfVerifyMutation.mutate(d.id)}
                    disabled={cfVerifyingId === d.id}
                    title="Auto-add CNAME record on Cloudflare"
                    className="border-orange-500/25 text-orange-400 hover:bg-orange-500/10 h-8">
                    {cfVerifyingId === d.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Zap className="w-3.5 h-3.5" />}
                    <span className="ml-1.5 text-xs">CF Auto</span>
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => checkDns(d.id)}
                    disabled={dnsCheckingId === d.id}
                    title="Check if DNS is pointing correctly"
                    className="border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10 h-8">
                    {dnsCheckingId === d.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span className="ml-1.5 text-xs">Verify</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(d.id)} disabled={deleteMutation.isPending}
                    className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-8">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* DNS instruction per domain */}
              <div className="mt-4 p-3 rounded-xl bg-black/20 border border-white/5">
                <p className="text-xs text-white/35 mb-2 font-medium">DNS Configuration</p>
                <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
                  <span className="text-white/30">Type:</span><Badge className="bg-blue-600/40 text-blue-300 border-0">CNAME</Badge>
                  <span className="text-white/30">Host:</span><span className="text-white/60">{d.domain.split(".")[0]}</span>
                  <span className="text-white/30">Points to:</span>
                  <span className="text-indigo-300">{cnameDest}</span>
                  <button onClick={() => copyText(cnameDest, d.id + "-dns")} className="text-white/30 hover:text-white transition-colors">
                    {copiedId === d.id + "-dns" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* DNS verify result */}
              {dnsResults[d.id] !== undefined && dnsResults[d.id] !== null && (() => {
                const r = dnsResults[d.id]!;
                return (
                  <div className={`mt-2 p-3 rounded-xl border text-xs font-mono flex flex-col gap-1 ${r.verified ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"}`}>
                    <div className="flex items-center gap-2">
                      {r.verified
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                      <span className={r.verified ? "text-emerald-300 font-semibold" : "text-red-300 font-semibold"}>
                        {r.verified ? "DNS verified — pointing correctly" : r.propagated ? "DNS found but points elsewhere" : "DNS not yet propagated"}
                      </span>
                    </div>
                    {r.found && <span className="text-white/40 pl-5">Found: <span className="text-white/70">{r.found}</span></span>}
                    {!r.found && <span className="text-white/40 pl-5">No CNAME record found yet — may still be propagating (up to 48h)</span>}
                    {r.expected && !r.verified && <span className="text-white/40 pl-5">Expected: <span className="text-white/70">{r.expected}</span></span>}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl p-4 border border-white/8 bg-white/3">
        <p className="text-xs font-semibold text-white/50 mb-3">How to connect a custom domain</p>
        <ol className="space-y-2 text-xs text-white/40 list-none">
          {[
            "Go to your domain registrar (Namecheap, Cloudflare, GoDaddy, etc.)",
            `Add a CNAME record pointing to: ${cnameDest}`,
            "Wait for DNS to propagate (can take up to 48 hours, usually under 1 hour)",
            "Click 'Visit' to verify your domain is live",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FEATURE REQUESTS TAB (Admin)
// ═══════════════════════════════════════════════════════════════

const FR_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: "Pending",    color: "bg-amber-500/20 text-amber-300" },
  planned:  { label: "Planned",    color: "bg-indigo-500/20 text-indigo-300" },
  building: { label: "Building",   color: "bg-violet-500/20 text-violet-300" },
  done:     { label: "Done ✓",     color: "bg-emerald-500/20 text-emerald-300" },
  declined: { label: "Declined",   color: "bg-red-500/20 text-red-400" },
};

function FeatureRequestsAdminTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/feature-requests"],
    queryFn: () => authFetch("/api/admin/feature-requests"),
    refetchInterval: 60000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, adminNote }: { id: string; status?: string; adminNote?: string }) =>
      authFetch(`/api/admin/feature-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminNote }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-requests"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/feature-requests/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Request deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-requests"] });
    },
  });

  const all = data?.requests ?? [];
  const requests = filterStatus === "all" ? all : all.filter((r: any) => r.status === filterStatus);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Feature Requests</h2>
          <p className="text-white/40 text-sm mt-0.5">Ideas and requests submitted by your customers</p>
        </div>
        <div className="flex items-center gap-2">
          {["all", "pending", "planned", "building", "done", "declined"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`text-[11px] px-3 py-1.5 rounded-lg capitalize font-medium transition-colors ${filterStatus === s ? "bg-white/12 text-white" : "text-white/35 hover:text-white/60"}`}>
              {s === "all" ? `All (${all.length})` : s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-white/8" style={{ background: "rgba(255,255,255,.03)" }}>
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-white/10" />
          <p className="text-white/30">No feature requests {filterStatus !== "all" ? `with status "${filterStatus}"` : "yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r: any) => {
            const st = FR_STATUS[r.status] || FR_STATUS.pending;
            return (
              <div key={r.id} className="rounded-xl border border-white/8 p-4" style={{ background: "rgba(255,255,255,.03)" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      <span className="text-[11px] text-white/35 flex items-center gap-1">
                        <span className="text-amber-400">▲</span> {r.votes || 1} vote{r.votes !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-white font-semibold text-sm mb-0.5">{r.title}</p>
                    {r.description && <p className="text-white/50 text-xs leading-relaxed">{r.description}</p>}
                    <p className="text-white/25 text-[11px] mt-2">
                      by <span className="text-white/40">{r.customerName || r.customerEmail}</span>
                      {r.createdAt && <span> · {new Date(r.createdAt).toLocaleDateString()}</span>}
                    </p>
                    {r.adminNote && (
                      <p className="mt-2 text-xs text-indigo-300/80 border-l-2 border-indigo-500/40 pl-2">Admin: {r.adminNote}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={r.status}
                      onChange={e => updateMutation.mutate({ id: r.id, status: e.target.value })}
                      className="text-[11px] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none"
                    >
                      {Object.keys(FR_STATUS).map(s => <option key={s} value={s}>{FR_STATUS[s].label}</option>)}
                    </select>
                    <button onClick={() => { setNoteId(r.id); setNoteText(r.adminNote || ""); }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition-colors">
                      Note
                    </button>
                    <button onClick={() => deleteMutation.mutate(r.id)}
                      className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline note editor */}
                {noteId === r.id && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add admin note (visible to customer)…"
                      className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/50"
                    />
                    <button onClick={() => { updateMutation.mutate({ id: r.id, adminNote: noteText }); setNoteId(null); toast({ title: "Note saved" }); }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors">Save</button>
                    <button onClick={() => setNoteId(null)} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RATINGS TAB
// ═══════════════════════════════════════════════════════════════

function RatingsTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/ratings"],
    queryFn: () => authFetch("/api/admin/ratings"),
    refetchInterval: 60000,
  });
  const ratings = data?.ratings ?? [];
  const avg = data?.average ?? 0;
  const count = data?.count ?? 0;

  const starDist = [5,4,3,2,1].map(n => ({
    stars: n,
    count: ratings.filter((r: any) => r.stars === n).length,
  }));

  function StarDisplay({ stars, size = "w-4 h-4" }: { stars: number; size?: string }) {
    return (
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(s => (
          <Star key={s} className={`${size} ${s <= stars ? "text-amber-400 fill-amber-400" : "text-white/15"}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Customer Ratings</h2>
        <p className="text-white/40 text-sm mt-0.5">Reviews submitted by customers after completed orders</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-4 border border-white/10" style={{ background: "rgba(255,255,255,.04)" }}>
          <p className="text-white/50 text-xs mb-1">Average Rating</p>
          <p className="text-3xl font-bold text-amber-400">{avg > 0 ? avg.toFixed(1) : "—"}</p>
          <div className="mt-1"><StarDisplay stars={Math.round(avg)} /></div>
        </div>
        <div className="rounded-xl p-4 border border-white/10" style={{ background: "rgba(255,255,255,.04)" }}>
          <p className="text-white/50 text-xs mb-1">Total Reviews</p>
          <p className="text-3xl font-bold text-white">{count}</p>
        </div>
        <div className="rounded-xl p-4 border border-white/10 space-y-1" style={{ background: "rgba(255,255,255,.04)" }}>
          <p className="text-white/50 text-xs mb-2">Distribution</p>
          {starDist.map(({ stars, count: c }) => (
            <div key={stars} className="flex items-center gap-2 text-xs">
              <span className="text-white/50 w-4 text-right">{stars}</span>
              <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-amber-400" style={{ width: count > 0 ? `${(c / count) * 100}%` : "0%" }} />
              </div>
              <span className="text-white/40 w-5 text-right">{c}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden" style={{ background: "rgba(255,255,255,.03)" }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
        ) : ratings.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Star className="w-10 h-10 mx-auto mb-3 text-white/10" />
            <p>No ratings yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-4 py-3 text-white/40 font-medium">Customer</th>
                <th className="text-left px-4 py-3 text-white/40 font-medium">Plan</th>
                <th className="text-left px-4 py-3 text-white/40 font-medium">Stars</th>
                <th className="text-left px-4 py-3 text-white/40 font-medium">Comment</th>
                <th className="text-left px-4 py-3 text-white/40 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {ratings.map((r: any) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white/80 font-medium">{r.customerName || r.customerEmail?.split("@")[0]}</p>
                    <p className="text-white/30 text-xs font-mono">{r.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">{r.planName || "—"}</td>
                  <td className="px-4 py-3"><StarDisplay stars={r.stars} size="w-3.5 h-3.5" /></td>
                  <td className="px-4 py-3 text-white/50 text-xs max-w-[220px]">
                    <p className="line-clamp-2">{r.comment || <span className="text-white/20 italic">No comment</span>}</p>
                  </td>
                  <td className="px-4 py-3 text-white/30 text-xs whitespace-nowrap">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CampaignsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState("all");
  const [name, setName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/campaigns"],
    queryFn: () => authFetch("/api/admin/campaigns"),
    refetchInterval: 10000,
  });

  async function createCampaign(sendNow = false) {
    if (!subject.trim() || !body.trim()) { toast({ title: "Subject and body are required", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const res = await authFetch("/api/admin/campaigns", {
        method: "POST",
        body: JSON.stringify({ name: name || subject, subject, body, segment, scheduledAt: scheduledAt || undefined, sendNow }),
      });
      if (res.success) {
        toast({ title: sendNow ? "Campaign sending..." : "Campaign saved!" });
        setSubject(""); setBody(""); setName(""); setScheduledAt(""); setShowForm(false);
        queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      } else toast({ title: res.error || "Failed", variant: "destructive" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setCreating(false); }
  }

  async function sendNow(id: string) {
    const res = await authFetch(`/api/admin/campaigns/${id}/send`, { method: "POST" });
    if (res.success) { toast({ title: "Sending..." }); queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] }); }
    else toast({ title: res.error || "Failed", variant: "destructive" });
  }

  async function deleteCampaign(id: string) {
    const res = await authFetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
    if (res.success) { toast({ title: "Deleted" }); queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] }); }
  }

  const campaigns = data?.campaigns ?? [];
  const segmentLabels: Record<string, string> = { all: "All Customers", active: "Active Buyers", recent: "Last 30 Days" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Email Campaigns</h1>
          <p className="text-xs text-white/40 mt-0.5">Schedule or send bulk email campaigns to customer segments</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
          <Plus className="w-4 h-4 mr-2" />New Campaign
        </Button>
      </div>

      {showForm && (
        <div className="glass-card rounded-2xl p-6 space-y-4 border border-indigo-500/20">
          <h2 className="text-base font-bold text-white">Create Campaign</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/40 uppercase mb-1.5 block">Campaign Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. December Promo" className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25" />
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase mb-1.5 block">Audience</label>
              <select value={segment} onChange={e => setSegment(e.target.value)} className="w-full h-10 px-3 rounded-lg glass border border-white/10 bg-white/5 text-white text-sm">
                {Object.entries(segmentLabels).map(([v, l]) => <option key={v} value={v} className="bg-gray-900">{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase mb-1.5 block">Subject Line</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="🔥 Special offer just for you!" className="glass border-white/10 bg-white/5 text-white placeholder:text-white/25" />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase mb-1.5 block">Email Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Write your email message here..." className="w-full px-3 py-2.5 rounded-lg glass border border-white/10 bg-white/5 text-white placeholder:text-white/25 text-sm resize-none focus:outline-none focus:border-indigo-500/50" />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase mb-1.5 block">Schedule (optional — leave empty to save as draft)</label>
            <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="glass border-white/10 bg-white/5 text-white" />
          </div>
          <div className="flex gap-3">
            <Button onClick={() => createCampaign(false)} disabled={creating} variant="outline" className="glass border-white/10 text-white/70 hover:text-white">
              {scheduledAt ? "Schedule" : "Save Draft"}
            </Button>
            <Button onClick={() => createCampaign(true)} disabled={creating} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : "Send Now"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 glass rounded-xl animate-pulse" />)}</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl">
          <Send className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">No campaigns yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c: any) => (
            <div key={c.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-white text-sm truncate">{c.name}</p>
                  <Badge className={`text-xs px-2 py-0 border-0 ${
                    c.status === "sent" ? "bg-emerald-500/20 text-emerald-400" :
                    c.status === "sending" ? "bg-blue-500/20 text-blue-400" :
                    c.status === "scheduled" ? "bg-amber-500/20 text-amber-400" :
                    "bg-white/5 text-white/40"}`}>{c.status}</Badge>
                </div>
                <p className="text-xs text-white/40 truncate">{c.subject}</p>
                <p className="text-xs text-white/30 mt-0.5">
                  {segmentLabels[c.segment] ?? c.segment}
                  {c.sentCount && ` · ${c.sentCount} sent`}
                  {c.scheduledAt && c.status === "scheduled" && ` · Scheduled ${new Date(c.scheduledAt).toLocaleString()}`}
                  {c.sentAt && ` · Sent ${new Date(c.sentAt).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(c.status === "draft" || c.status === "scheduled") && (
                  <Button size="sm" onClick={() => sendNow(c.id)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-7 px-3">Send Now</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => deleteCampaign(c.id)} className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 h-7 w-7 p-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONVERSION FUNNEL TAB
// ═══════════════════════════════════════════════════════════════
function ConversionFunnelTab() {
  const { toast } = useToast();
  const [days, setDays] = useState(30);
  const authFetch = (url: string, opts: any = {}) => fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${localStorage.getItem("admin_token")}`, "Content-Type": "application/json" } });

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/funnel", days],
    queryFn: () => authFetch(`/api/admin/funnel?days=${days}`).then(r => r.json()),
  });

  const funnel: any[] = data?.funnel ?? [];
  const maxCount = Math.max(...funnel.map((f: any) => f.count), 1);

  const STEP_META: Record<string, { label: string; color: string }> = {
    page_view:         { label: "Store Visits",        color: "from-blue-600 to-blue-500" },
    plan_view:         { label: "Plan Interactions",   color: "from-indigo-600 to-indigo-500" },
    checkout_start:    { label: "Checkout Started",    color: "from-violet-600 to-violet-500" },
    checkout_complete: { label: "Paid Orders",         color: "from-emerald-600 to-emerald-500" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Conversion Funnel</h2>
          <p className="text-xs text-white/40 mt-0.5">Track how visitors move from browsing to paying</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${days === d ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white/5 border-white/10 text-white/50 hover:text-white"}`}>
              {d}d
            </button>
          ))}
          <button onClick={() => refetch()} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: "linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.08))", border: "1px solid rgba(99,102,241,.2)" }}>
        <div className="w-12 h-12 rounded-xl bg-indigo-600/20 flex items-center justify-center shrink-0">
          <TrendingUp className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <p className="text-white/50 text-xs">Overall conversion rate (visits → paid)</p>
          <p className="text-3xl font-bold text-white mt-0.5">{data?.conversionRate ?? 0}%</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-white/30 text-xs">Period</p>
          <p className="text-white font-semibold text-sm">Last {days} days</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {funnel.map((step: any, i: number) => {
            const meta = STEP_META[step.step] || { label: step.step, color: "from-gray-600 to-gray-500" };
            const widthPct = maxCount > 0 ? Math.max((step.count / maxCount) * 100, 4) : 4;
            const dropoff = i > 0 && funnel[i - 1].count > 0
              ? Math.round(((funnel[i - 1].count - step.count) / funnel[i - 1].count) * 100) : null;
            return (
              <div key={step.step}>
                {dropoff !== null && (
                  <div className="flex items-center gap-2 py-1 px-2">
                    <div className="w-px h-4 bg-white/10 mx-4" />
                    <span className="text-[11px] text-red-400/70">▼ {dropoff}% dropped off</span>
                  </div>
                )}
                <div className="rounded-xl border border-white/8 p-4" style={{ background: "rgba(255,255,255,.03)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm font-semibold text-white">{meta.label}</p>
                        <p className="text-xl font-bold text-white">{step.count.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${meta.color} transition-all duration-700`}
                      style={{ width: `${widthPct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/8 p-4" style={{ background: "rgba(255,255,255,.03)" }}>
          <p className="text-sm font-semibold text-white mb-3">🔥 Most Viewed Plans</p>
          {(data?.topPlans ?? []).length === 0 ? (
            <p className="text-white/25 text-xs">No plan views recorded yet</p>
          ) : (
            <div className="space-y-2">
              {(data.topPlans as any[]).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <p className="text-xs text-white/70 truncate max-w-[180px]">{p.plan_name}</p>
                  <span className="text-xs font-bold text-indigo-400 ml-2">{p.cnt}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-white/8 p-4" style={{ background: "rgba(255,255,255,.03)" }}>
          <p className="text-sm font-semibold text-white mb-3">⚡ Live Activity</p>
          {(data?.recentEvents ?? []).length === 0 ? (
            <p className="text-white/25 text-xs">No events recorded yet</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {(data.recentEvents as any[]).map((e: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    e.event_type === "page_view" ? "bg-blue-500/20 text-blue-400" :
                    e.event_type === "plan_view" ? "bg-indigo-500/20 text-indigo-400" :
                    e.event_type === "checkout_start" ? "bg-violet-500/20 text-violet-400" :
                    "bg-emerald-500/20 text-emerald-400"
                  }`}>{e.event_type.replace("_"," ")}</span>
                  {e.plan_name && <span className="text-[10px] text-white/50 truncate">{e.plan_name}</span>}
                  <span className="text-[10px] text-white/20 ml-auto">{e.created_at?.slice(11,16)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMER GROUPS TAB
// ═══════════════════════════════════════════════════════════════
function CustomerGroupsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const authFetch = (url: string, opts: any = {}) => fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${localStorage.getItem("admin_token")}`, "Content-Type": "application/json" } });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/customer-groups"],
    queryFn: () => authFetch("/api/admin/customer-groups").then(r => r.json()),
  });

  const groups: any[] = data?.groups ?? [];
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [discountPct, setDiscountPct] = useState(0);
  const [isBanned, setIsBanned] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  const GROUP_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#ef4444","#3b82f6","#14b8a6","#f97316","#64748b"];

  function openCreate() { setEditing(null); setName(""); setColor("#6366f1"); setDiscountPct(0); setIsBanned(false); setDescription(""); setShowForm(true); }
  function openEdit(g: any) { setEditing(g); setName(g.name); setColor(g.color||"#6366f1"); setDiscountPct(g.discount_percent||0); setIsBanned(!!g.is_banned); setDescription(g.description||""); setShowForm(true); }

  async function saveGroup() {
    if (!name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = JSON.stringify({ name, color, discount_percent: discountPct, is_banned: isBanned, description });
      const url = editing ? `/api/admin/customer-groups/${editing.id}` : "/api/admin/customer-groups";
      const d = await authFetch(url, { method: editing ? "PUT" : "POST", body }).then(r => r.json());
      if (d.success) { toast({ title: editing ? "Group updated" : "Group created ✅" }); qc.invalidateQueries({ queryKey: ["/api/admin/customer-groups"] }); setShowForm(false); }
      else toast({ title: d.error || "Failed", variant: "destructive" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    setSaving(false);
  }

  async function deleteGroup(id: number) {
    if (!confirm("Delete this group? Members will be unassigned.")) return;
    await authFetch(`/api/admin/customer-groups/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["/api/admin/customer-groups"] });
    toast({ title: "Group deleted" });
    if (selectedGroup?.id === id) setSelectedGroup(null);
  }

  async function loadMembers(g: any) {
    setSelectedGroup(g); setMembersLoading(true); setMembers([]);
    const d = await authFetch(`/api/admin/customer-groups/${g.id}/members`).then(r => r.json());
    setMembers(d.members || []); setMembersLoading(false);
  }

  async function assignCustomer() {
    if (!assignEmail.trim() || !selectedGroup) return;
    setAssignLoading(true);
    try {
      const custsR = await authFetch("/api/admin/customers").then(r => r.json());
      const cust = (custsR.customers || []).find((c: any) => c.email.toLowerCase() === assignEmail.trim().toLowerCase());
      if (!cust) { toast({ title: "Customer not found", variant: "destructive" }); setAssignLoading(false); return; }
      const d = await authFetch(`/api/admin/customers/${cust.id}/group`, { method: "PATCH", body: JSON.stringify({ group_id: selectedGroup.id }) }).then(r => r.json());
      if (d.success) { toast({ title: `${cust.email} assigned to ${selectedGroup.name}` }); setAssignEmail(""); loadMembers(selectedGroup); qc.invalidateQueries({ queryKey: ["/api/admin/customer-groups"] }); }
      else toast({ title: d.error || "Failed", variant: "destructive" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    setAssignLoading(false);
  }

  async function removeFromGroup(custId: number) {
    await authFetch(`/api/admin/customers/${custId}/group`, { method: "PATCH", body: JSON.stringify({ group_id: null }) });
    loadMembers(selectedGroup); qc.invalidateQueries({ queryKey: ["/api/admin/customer-groups"] });
    toast({ title: "Removed from group" });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">Customer Groups</h2>
          <p className="text-xs text-white/40 mt-0.5">Tags customers as VIP, Reseller, Banned etc. and apply group discounts</p>
        </div>
        <Button onClick={openCreate} className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white font-bold hover:opacity-90 gap-2 h-9">
          <Plus className="w-4 h-4" /> New Group
        </Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-indigo-500/25 p-5 space-y-4" style={{ background: "rgba(99,102,241,.07)" }}>
          <p className="text-sm font-semibold text-indigo-300">{editing ? "Edit Group" : "Create New Group"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Group Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. VIP Customers"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/60" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Discount % (0 = none)</label>
              <input type="number" min="0" max="100" value={discountPct} onChange={e => setDiscountPct(parseInt(e.target.value)||0)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Group Color</label>
            <div className="flex gap-2 flex-wrap">
              {GROUP_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${color===c?"border-white scale-110":"border-transparent hover:scale-105"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Description (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Internal note about this group"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/60" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isBanned} onCheckedChange={setIsBanned} />
            <span className="text-sm text-white/70">Banned group — suspend all members automatically</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveGroup} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 border-0 text-white font-bold gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Group"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)} className="text-white/50 hover:text-white">Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-14 rounded-xl border border-white/8" style={{ background: "rgba(255,255,255,.02)" }}>
          <Users className="w-8 h-8 text-white/10 mx-auto mb-2" />
          <p className="text-white/30 text-sm">No groups yet — create your first one</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((g: any) => (
            <div key={g.id}
              className={`rounded-xl border p-4 cursor-pointer transition-all ${selectedGroup?.id===g.id?"border-indigo-500/50 bg-indigo-600/10":"border-white/8 hover:border-white/15"}`}
              style={selectedGroup?.id!==g.id?{background:"rgba(255,255,255,.03)"}:{}}
              onClick={() => loadMembers(g)}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: (g.color||"#6366f1")+"22" }}>
                  <div className="w-4 h-4 rounded-full" style={{ background: g.color||"#6366f1" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{g.name}</p>
                  {g.is_banned ? <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Banned</span>
                    : g.discount_percent>0 ? <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">{g.discount_percent}% off</span> : null}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">{g.member_count||0} member{g.member_count!==1?"s":""}</span>
                <div className="flex gap-1">
                  <button onClick={e => { e.stopPropagation(); openEdit(g); }} className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={e => { e.stopPropagation(); deleteGroup(g.id); }} className="p-1 rounded hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedGroup && (
        <div className="rounded-2xl border border-white/10 p-5 space-y-4" style={{ background: "rgba(255,255,255,.03)" }}>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ background: selectedGroup.color||"#6366f1" }} />
            <h3 className="text-sm font-bold text-white">{selectedGroup.name} — Members</h3>
            <span className="ml-auto text-xs text-white/30">{members.length} member{members.length!==1?"s":""}</span>
          </div>
          <div className="flex gap-2">
            <input value={assignEmail} onChange={e => setAssignEmail(e.target.value)} placeholder="customer@email.com"
              onKeyDown={e => e.key==="Enter" && assignCustomer()}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/60" />
            <Button onClick={assignCustomer} disabled={assignLoading||!assignEmail.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 border-0 text-white font-bold gap-1.5 shrink-0">
              {assignLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Assign
            </Button>
          </div>
          {membersLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /></div>
          ) : members.length===0 ? (
            <p className="text-white/25 text-sm text-center py-4">No members yet — assign a customer above</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5" style={{ background: "rgba(255,255,255,.03)" }}>
                  <div className="w-7 h-7 rounded-full bg-indigo-600/30 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-indigo-400">{(m.name||m.email)[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{m.name||"—"}</p>
                    <p className="text-[11px] text-white/40 truncate">{m.email}</p>
                  </div>
                  {m.suspended?<span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 rounded">Suspended</span>:null}
                  <button onClick={() => removeFromGroup(m.id)} className="p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FLASH SALES TAB
// ═══════════════════════════════════════════════════════════════
function FlashSalesTab() {
  const { toast } = useToast();
  const [planId, setPlanId] = useState("");
  const [planName, setPlanName] = useState("");
  const [discountPct, setDiscountPct] = useState("20");
  const [label, setLabel] = useState("");
  const [durationHours, setDurationHours] = useState("2");
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Live countdown ticker
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading, refetch } = useQuery<{ success: boolean; sales: any[] }>({
    queryKey: ["/api/admin/flash-sales"],
    queryFn: async () => {
      const token = localStorage.getItem("admin_token");
      const r = await fetch("/api/admin/flash-sales", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
    refetchInterval: 10000,
  });

  const sales = data?.sales ?? [];
  const active = sales.filter((s: any) => new Date(s.endsAt).getTime() > now);
  const expired = sales.filter((s: any) => new Date(s.endsAt).getTime() <= now);

  function countdown(endsAt: string) {
    const ms = new Date(endsAt).getTime() - now;
    if (ms <= 0) return "Expired";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h > 0 ? `${h}h ` : ""}${m}m ${s}s`;
  }

  async function create() {
    if (!planId.trim() || !discountPct || !durationHours) {
      toast({ title: "Plan ID, discount %, and duration are required", variant: "destructive" }); return;
    }
    setCreating(true);
    try {
      const token = localStorage.getItem("admin_token");
      const r = await fetch("/api/admin/flash-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId: planId.trim(), planName: planName.trim() || planId.trim(), discountPct: parseInt(discountPct), label: label.trim(), durationHours: parseFloat(durationHours) }),
      });
      const d = await r.json();
      if (!d.success) { toast({ title: d.error || "Failed to create", variant: "destructive" }); return; }
      toast({ title: `Flash sale created! Ends in ${durationHours}h` });
      setPlanId(""); setPlanName(""); setLabel(""); setDiscountPct("20"); setDurationHours("2");
      refetch();
    } finally { setCreating(false); }
  }

  async function deleteSale(id: string) {
    const token = localStorage.getItem("admin_token");
    await fetch(`/api/admin/flash-sales/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    toast({ title: "Flash sale removed" });
    refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Flash Sales</h2>
          <p className="text-sm text-white/40">Time-limited discounts that countdown live on the store</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">{active.length} active</span>
          {expired.length > 0 && <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-white/30 border border-white/10">{expired.length} expired</span>}
        </div>
      </div>

      {/* Create form */}
      <div className="glass-card rounded-2xl p-5 border border-white/8">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-400" /> Create Flash Sale
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-white/40 block mb-1">Plan ID <span className="text-red-400">*</span></label>
            <input
              className="w-full glass border border-white/10 rounded-xl px-3 py-2 text-sm text-white bg-white/5 focus:outline-none focus:border-amber-500/50"
              placeholder="e.g. netflix-4k"
              value={planId}
              onChange={e => setPlanId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Plan Display Name</label>
            <input
              className="w-full glass border border-white/10 rounded-xl px-3 py-2 text-sm text-white bg-white/5 focus:outline-none focus:border-amber-500/50"
              placeholder="e.g. Netflix 4K"
              value={planName}
              onChange={e => setPlanName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Discount % <span className="text-red-400">*</span></label>
            <input
              type="number" min={1} max={99}
              className="w-full glass border border-white/10 rounded-xl px-3 py-2 text-sm text-white bg-white/5 focus:outline-none focus:border-amber-500/50"
              placeholder="e.g. 30"
              value={discountPct}
              onChange={e => setDiscountPct(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Duration (hours) <span className="text-red-400">*</span></label>
            <input
              type="number" min={0.5} step={0.5}
              className="w-full glass border border-white/10 rounded-xl px-3 py-2 text-sm text-white bg-white/5 focus:outline-none focus:border-amber-500/50"
              placeholder="e.g. 2"
              value={durationHours}
              onChange={e => setDurationHours(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-white/40 block mb-1">Banner Label (optional)</label>
            <input
              className="w-full glass border border-white/10 rounded-xl px-3 py-2 text-sm text-white bg-white/5 focus:outline-none focus:border-amber-500/50"
              placeholder="e.g. 🔥 Weekend Flash — 30% Off!"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={create}
            disabled={creating}
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0 shadow-lg hover:opacity-90"
          >
            <Zap className="w-4 h-4 mr-1.5" />
            {creating ? "Creating..." : "Launch Flash Sale"}
          </Button>
          <p className="text-xs text-white/30">The countdown timer will appear live on your storefront immediately.</p>
        </div>
      </div>

      {/* Active sales */}
      {isLoading ? (
        <div className="text-center py-10 text-white/30 text-sm">Loading flash sales...</div>
      ) : active.length === 0 && expired.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center border border-white/8">
          <Zap className="w-12 h-12 text-amber-400/30 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No flash sales yet. Create one above to show a live countdown on your store.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-2">Active</h3>
              {active.map((s: any) => (
                <div key={s.id} className="glass-card rounded-xl p-4 border border-amber-500/20 bg-amber-500/5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{s.label}</p>
                    <p className="text-xs text-white/40">{s.planName} · {s.discountPct}% off</p>
                  </div>
                  <div className="text-center shrink-0">
                    <p className="text-lg font-bold text-amber-400 tabular-nums">{countdown(s.endsAt)}</p>
                    <p className="text-[10px] text-white/30">remaining</p>
                  </div>
                  <button
                    onClick={() => deleteSale(s.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors shrink-0"
                    title="End flash sale"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {expired.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-white/20 uppercase tracking-widest mb-2">Expired</h3>
              {expired.map((s: any) => (
                <div key={s.id} className="glass-card rounded-xl p-4 border border-white/8 opacity-50 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-white/30" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white/50 text-sm truncate">{s.label}</p>
                    <p className="text-xs text-white/30">{s.planName} · {s.discountPct}% off · ended {new Date(s.endsAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => deleteSale(s.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bot Store Admin Tab ──────────────────────────────────────────────────────
function BotStoreAdminTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", description: "", repoUrl: "", imageUrl: "", price: 70,
    category: "Multi-Purpose", features: "", requiresSessionId: true, requiresDbUrl: false,
  });

  const { data, isLoading } = useQuery<{ success: boolean; bots: any[] }>({
    queryKey: ["/api/admin/bots"],
    queryFn: () => fetch("/api/admin/bots", { headers: authHeaders() as any }).then((r) => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editing ? `/api/admin/bots/${editing.id}` : "/api/admin/bots";
      const method = editing ? "PUT" : "POST";
      return fetch(url, { method, headers: { ...authHeaders() as any, "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json());
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: editing ? "Bot updated" : "Bot added" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/bots"] });
        setShowForm(false); setEditing(null);
        setForm({ name: "", description: "", repoUrl: "", imageUrl: "", price: 70, category: "Multi-Purpose", features: "", requiresSessionId: true, requiresDbUrl: false });
      } else { toast({ title: "Error", description: data.error, variant: "destructive" }); }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/bots/${id}`, { method: "DELETE", headers: authHeaders() as any }).then((r) => r.json()),
    onSuccess: () => { toast({ title: "Bot deleted" }); queryClient.invalidateQueries({ queryKey: ["/api/admin/bots"] }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      fetch(`/api/admin/bots/${id}`, { method: "PUT", headers: { ...authHeaders() as any, "Content-Type": "application/json" }, body: JSON.stringify({ active }) }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/bots"] }),
  });

  function openEdit(bot: any) {
    setEditing(bot);
    setForm({ name: bot.name, description: bot.description, repoUrl: bot.repoUrl, imageUrl: bot.imageUrl || "", price: bot.price, category: bot.category || "Multi-Purpose", features: (bot.features || []).join(", "), requiresSessionId: bot.requiresSessionId, requiresDbUrl: bot.requiresDbUrl });
    setShowForm(true);
  }

  function handleSave() {
    const payload = { ...form, features: form.features.split(",").map((s: string) => s.trim()).filter(Boolean) };
    saveMutation.mutate(payload);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Bot Store Management</h2>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-green-600 hover:bg-green-700 text-white text-sm">
          <Plus className="w-4 h-4 mr-1" /> Add Bot
        </Button>
      </div>

      {showForm && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-white">{editing ? "Edit Bot" : "New Bot"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-xs text-gray-400 mb-1 block">Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border-white/10 text-white" /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Price (KES) *</label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 70 })} className="bg-white/5 border-white/10 text-white" /></div>
          </div>
          <div><label className="text-xs text-gray-400 mb-1 block">Description *</label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-white/5 border-white/10 text-white" /></div>
          <div><label className="text-xs text-gray-400 mb-1 block">GitHub Repo URL *</label>
            <Input value={form.repoUrl} onChange={(e) => setForm({ ...form, repoUrl: e.target.value })} placeholder="https://github.com/..." className="bg-white/5 border-white/10 text-white" /></div>
          <div><label className="text-xs text-gray-400 mb-1 block">Image URL</label>
            <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="bg-white/5 border-white/10 text-white" /></div>
          <div><label className="text-xs text-gray-400 mb-1 block">Category</label>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Multi-Purpose, AI, etc." className="bg-white/5 border-white/10 text-white" /></div>
          <div><label className="text-xs text-gray-400 mb-1 block">Features (comma-separated)</label>
            <Input value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="Auto-reply, Group tools, Media download..." className="bg-white/5 border-white/10 text-white" /></div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <Switch checked={form.requiresSessionId} onCheckedChange={(v) => setForm({ ...form, requiresSessionId: v })} />
              Requires Session ID
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <Switch checked={form.requiresDbUrl} onCheckedChange={(v) => setForm({ ...form, requiresDbUrl: v })} />
              Requires DB URL
            </label>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }} className="border-white/10 text-gray-400">Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-green-400 mx-auto" /></div>
      ) : (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="text-gray-400">Bot</TableHead>
                <TableHead className="text-gray-400">Category</TableHead>
                <TableHead className="text-gray-400">Price</TableHead>
                <TableHead className="text-gray-400">Active</TableHead>
                <TableHead className="text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.bots || []).map((bot) => (
                <TableRow key={bot.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell>
                    <div>
                      <p className="text-white font-medium text-sm">{bot.name}</p>
                      <p className="text-gray-500 text-xs truncate max-w-xs">{bot.description}</p>
                    </div>
                  </TableCell>
                  <TableCell><Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">{bot.category}</Badge></TableCell>
                  <TableCell className="text-white font-semibold">KES {bot.price}</TableCell>
                  <TableCell>
                    <Switch checked={!!bot.active} onCheckedChange={(v) => toggleMutation.mutate({ id: bot.id, active: v })} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(bot)} className="border-white/10 text-gray-400 hover:text-white h-7 px-2"><Edit2 className="w-3 h-3" /></Button>
                      <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(bot.id)} className="border-red-500/20 text-red-400 hover:text-red-300 h-7 px-2"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!(data?.bots?.length) && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">No bots yet. Add your first bot above.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Bot Orders Admin Tab ─────────────────────────────────────────────────────
function VpsServerSelector({ value, onChange }) {
  const { data } = useQuery({
    queryKey: ["/api/admin/vps"],
    queryFn: () => fetch("/api/admin/vps", { headers: authHeaders() }).then(r => r.json()),
  });
  const servers = data?.servers || [];
  return (
    <div>
      <label className="text-xs text-white/50 mb-1.5 block">Select VPS Server</label>
      {servers.length === 0 ? (
        <p className="text-xs text-amber-400 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">No VPS servers added. Go to VPS Manager tab first.</p>
      ) : (
        <div className="grid gap-2">
          {servers.map((s) => (
            <button key={s.id} onClick={() => onChange(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${value === s.id ? "bg-violet-600/20 border-violet-500/40 text-violet-200" : "bg-white/[0.03] border-white/8 text-white/70 hover:bg-white/5"}`}>
              <span className="font-medium">{s.label}</span>
              <span className="text-xs text-white/40 ml-2">{s.username}@{s.host}:{s.port}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BotOrdersAdminTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [notes, setNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [vpsStatus, setVpsStatus] = useState<any>(null);
  const [vpsLoading, setVpsLoading] = useState(false);
  const [configVars, setConfigVars] = useState<Record<string, string>>({});
  const [configLoading, setConfigLoading] = useState(false);
  const [configEditing, setConfigEditing] = useState(false);
  const [configDraft, setConfigDraft] = useState<{ key: string; value: string }[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [vpsDeployOpen, setVpsDeployOpen] = useState(false);
  const [vpsDeployVpsId, setVpsDeployVpsId] = useState("");
  const [vpsDeployLoading, setVpsDeployLoading] = useState(false);
  const [vpsDeployLog, setVpsDeployLog] = useState("");
  const [vpsDeployStatus, setVpsDeployStatus] = useState<"idle"|"success"|"failed">("idle");
const [bulkLoading, setBulkLoading] = useState<string | null>(null);
const [bulkResult, setBulkResult] = useState<string | null>(null);
const [bulkVpsId, setBulkVpsId] = useState("");
const [deployStreamLog, setDeployStreamLog] = useState<string[]>([]);
const [deployStreaming, setDeployStreaming] = useState(false);
const [deployStreamStatus, setDeployStreamStatus] = useState<"idle"|"running"|"success"|"failed">("idle");
const deployLogRef = useRef<HTMLDivElement>(null);
const [botLogs, setBotLogs] = useState<string[]>([]);
const [botLogsLoading, setBotLogsLoading] = useState(false);
const [botLogsTs, setBotLogsTs] = useState<Date | null>(null);
const [botLogsAuto, setBotLogsAuto] = useState(true);
const botLogsRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<{ success: boolean; orders: any[] }>({
    queryKey: ["/api/admin/bot-orders"],
    queryFn: () => fetch("/api/admin/bot-orders", { headers: authHeaders() as any }).then((r) => r.json()),
    refetchInterval: (query) => {
      const orders = (query.state.data as any)?.orders ?? [];
      return orders.some((o: any) => o.status === "deploying") ? 3000 : 30000;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, deploymentNotes, redeploy }: any) =>
      fetch(`/api/admin/bot-orders/${id}/status`, {
        method: "PATCH",
        headers: { ...authHeaders() as any, "Content-Type": "application/json" },
        body: JSON.stringify({ status, deploymentNotes, redeploy }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Order updated" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-orders"] });
        setSelectedOrder((o: any) => o ? { ...o, status: newStatus, deploymentNotes: notes } : null);
      } else { toast({ title: "Error", description: data.error, variant: "destructive" }); }
    },
  });

  const vpsAction = async (orderId: number, action: string, body?: any) => {
    setActionLoading(action);
    try {
      const method = body ? "PATCH" : "POST";
      const res = await fetch(`/api/admin/bot-orders/${orderId}/vps/${action}`, {
        method,
        headers: { ...authHeaders() as any, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json();
      if (data.success !== false) {
        toast({ title: data.message || "Done" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-orders"] });
        loadVpsStatus(selectedOrder);
      } else {
        toast({ title: "VPS Error", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const doBulkAction = async (actionType: string) => {
    setBulkLoading(actionType); setBulkResult(null);
    try {
      const url = actionType === "restart-all" ? "/api/admin/bots/bulk/restart-all"
        : actionType === "suspend-expired" ? "/api/admin/bots/bulk/suspend-expired"
        : actionType === "deploy-pending" ? "/api/admin/bots/bulk/deploy-pending"
        : `/api/admin/bots/bulk/restart-vps/${bulkVpsId}`;
      if (actionType === "restart-vps" && !bulkVpsId) { setBulkResult("Enter a VPS ID first"); setBulkLoading(null); return; }
      const r = await fetch(url, { method: "POST", headers: authHeaders() as any });
      const d = await r.json();
      if (d.success) {
        const msg = actionType === "restart-all" ? `Restarted ${d.restarted}/${d.total} bots`
          : actionType === "suspend-expired" ? `Suspended ${d.suspended} expired bots`
          : actionType === "deploy-pending" ? (d.message || `Deploying ${d.count} pending bots…`)
          : `Restarted ${d.restarted}/${d.total} bots on VPS`;
        setBulkResult(msg);
        toast({ title: msg });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-orders"] });
      } else { setBulkResult("Error: " + (d.error || "Unknown")); }
    } catch (e: any) { setBulkResult("Error: " + e.message); }
    finally { setBulkLoading(null); }
  };

  async function deployViaVps() {
    if (!selectedOrder || !vpsDeployVpsId) return;
    setVpsDeployLoading(true);
    setVpsDeployLog("");
    setVpsDeployStatus("idle");
    try {
      const res = await fetch(`/api/admin/bot-orders/${selectedOrder.id}/deploy-vps`, {
        method: "POST",
        headers: { ...authHeaders() as any, "Content-Type": "application/json" },
        body: JSON.stringify({ vpsId: vpsDeployVpsId }),
      });
      const data = await res.json();
      setVpsDeployLog(data.log || data.error || "No output");
      setVpsDeployStatus(data.success ? "success" : "failed");
      if (data.success) {
        toast({ title: "Bot deployed!", description: "Bot is running on your VPS" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-orders"] });
        setSelectedOrder((o: any) => o ? { ...o, status: "deployed" } : null);
      } else {
        toast({ title: "Deploy failed", description: data.error || "Check the log below", variant: "destructive" });
      }
    } catch (e: any) {
      setVpsDeployLog(e.message);
      setVpsDeployStatus("failed");
    } finally {
      setVpsDeployLoading(false);
    }
  }

  const patchOrderInCache = (id: number, patch: any) => {
    queryClient.setQueryData(["/api/admin/bot-orders"], (old: any) => {
      if (!old?.orders) return old;
      return { ...old, orders: old.orders.map((o: any) => o.id === id ? { ...o, ...patch } : o) };
    });
  };

  async function deployWithStream(orderId: number, vpsId?: string) {
    setDeployStreamLog([]);
    setDeployStreaming(true);
    setDeployStreamStatus("running");
    // Optimistically mark as deploying in the list immediately
    patchOrderInCache(orderId, { status: "deploying" });
    setSelectedOrder((o: any) => o ? { ...o, status: "deploying" } : null);
    try {
      const res = await fetch(`/api/admin/bot-orders/${orderId}/deploy-stream`, {
        method: "POST",
        headers: { ...authHeaders() as any, "Content-Type": "application/json" },
        body: vpsId ? JSON.stringify({ vpsId }) : undefined,
      });
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line === "__DONE__:success") {
            setDeployStreamStatus("success");
            patchOrderInCache(orderId, { status: "deployed" });
            setSelectedOrder((o: any) => o ? { ...o, status: "deployed" } : null);
            queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-orders"] });
          } else if (line === "__DONE__:failed") {
            setDeployStreamStatus("failed");
            patchOrderInCache(orderId, { status: "deploy_failed" });
            setSelectedOrder((o: any) => o ? { ...o, status: "deploy_failed" } : null);
            queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-orders"] });
          } else {
            setDeployStreamLog(prev => { const next = [...prev, line]; setTimeout(() => { deployLogRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, 30); return next; });
          }
        }
      }
    } catch (e: any) {
      setDeployStreamLog(prev => [...prev, "❌ " + e.message]);
      setDeployStreamStatus("failed");
      patchOrderInCache(orderId, { status: "deploy_failed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-orders"] });
    } finally {
      setDeployStreaming(false);
    }
  }

  const loadVpsStatus = async (order: any) => {
    if (!order?.id) return;
    setVpsLoading(true);
    try {
      const r = await fetch(`/api/admin/bot-orders/${order.id}/vps-status`, { headers: authHeaders() as any });
      const d = await r.json();
      setVpsStatus(d);
    } catch { setVpsStatus(null); }
    setVpsLoading(false);
  };

  const loadConfigVars = async (order: any) => {
    if (!order.pm2Name) return;
    setConfigLoading(true);
    try {
      const r = await fetch(`/api/admin/bot-orders/${order.id}/vps/config-vars`, { headers: authHeaders() as any });
      const d = await r.json();
      if (d.success && d.configVars) {
        setConfigVars(d.configVars);
        setConfigDraft(Object.entries(d.configVars).map(([key, value]) => ({ key, value: value as string })));
      }
    } catch {}
    setConfigLoading(false);
    setConfigEditing(true);
  };

  const saveConfigVars = async (order: any) => {
    const vars: Record<string, string> = {};
    configDraft.forEach(({ key, value }) => { if (key.trim()) vars[key.trim()] = value; });
    setActionLoading("config-save");
    try {
      const r = await fetch(`/api/admin/bot-orders/${order.id}/vps/config-vars`, {
        method: "PATCH",
        headers: { ...authHeaders() as any, "Content-Type": "application/json" },
        body: JSON.stringify({ configVars: vars }),
      });
      const d = await r.json();
      if (d.success) { toast({ title: "Config vars updated — bot will restart" }); setConfigEditing(false); }
      else toast({ title: "Error", description: d.error, variant: "destructive" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setActionLoading(null);
  };

  const fetchBotLogs = async (order: any) => {
    if (!order?.id) return;
    setBotLogsLoading(true);
    try {
      const r = await fetch(`/api/admin/bot-orders/${order.id}/live-logs`, { headers: authHeaders() as any });
      const d = await r.json();
      if (d.success) {
        setBotLogs(d.logs || []);
        setBotLogsTs(new Date());
        setTimeout(() => { botLogsRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, 50);
      } else {
        setBotLogs([`❌ ${d.error || "Failed to fetch logs"}`]);
      }
    } catch (e: any) { setBotLogs([`❌ ${e.message}`]); }
    setBotLogsLoading(false);
  };

  // Auto-refresh bot logs every 5s when bot is deployed
  React.useEffect(() => {
    if (!selectedOrder || !["deployed", "stopped"].includes(selectedOrder.status)) return;
    if (!botLogsAuto) return;
    fetchBotLogs(selectedOrder);
    const iv = setInterval(() => fetchBotLogs(selectedOrder), 5000);
    return () => clearInterval(iv);
  }, [selectedOrder?.id, botLogsAuto, selectedOrder?.status]);

  const selectOrder = (order: any) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setNotes(order.deploymentNotes || "");
    setVpsStatus(null);
    setConfigEditing(false);
    setDeployStreaming(false);
    setBotLogs([]);
    setBotLogsTs(null);
    // Restore persisted deployment log from DB if available
    if (order.deploymentLog) {
      const lines = order.deploymentLog.split("\n").filter((l: string) => !l.startsWith("__DONE__"));
      setDeployStreamLog(lines);
      setDeployStreamStatus(
        order.status === "deployed" ? "success"
        : order.status === "deploy_failed" ? "failed"
        : "idle"
      );
    } else {
      setDeployStreamLog([]);
      setDeployStreamStatus("idle");
    }
    loadVpsStatus(order);
  };

  const STATUS_BADGES: Record<string, string> = {
    pending:       "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    paid:          "bg-blue-500/10 text-blue-400 border-blue-500/20",
    deploying:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
    deployed:      "bg-green-500/10 text-green-400 border-green-500/20",
    stopped:       "bg-orange-500/10 text-orange-400 border-orange-500/20",
    suspended:     "bg-red-500/10 text-red-400 border-red-500/20",
    failed:        "bg-red-500/10 text-red-400 border-red-500/20",
    deploy_failed: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const allOrders = data?.orders || [];
  const filtered = statusFilter === "all" ? allOrders : allOrders.filter((o: any) => o.status === statusFilter);
  const isDeployed = selectedOrder && (selectedOrder.pm2Name || selectedOrder.pm2_name || selectedOrder.status === "deployed");

  return (
    <div className="space-y-5">
      {/* VPS Deploy Modal */}
      {vpsDeployOpen && selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.8)" }} onClick={(e) => { if (e.target === e.currentTarget) setVpsDeployOpen(false); }}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4" style={{ background: "#0f0e1c", boxShadow: "0 25px 50px rgba(0,0,0,.5)" }}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Server className="w-4 h-4 text-violet-400" />Deploy via VPS — {selectedOrder.botName}
              </h3>
              <button onClick={() => setVpsDeployOpen(false)} className="text-white/30 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-white/50">SSH into your VPS, clone the bot repo, install dependencies automatically, then start the bot.</p>
            <VpsServerSelector value={vpsDeployVpsId} onChange={setVpsDeployVpsId} />
            {vpsDeployLog && (
              <div className={`rounded-xl p-3 font-mono text-xs whitespace-pre-wrap overflow-auto max-h-56 border ${vpsDeployStatus === "success" ? "bg-emerald-900/30 text-emerald-300 border-emerald-500/20" : vpsDeployStatus === "failed" ? "bg-red-900/30 text-red-300 border-red-500/20" : "bg-white/5 text-white/70 border-white/10"}`}>
                {vpsDeployLog}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="outline" onClick={() => setVpsDeployOpen(false)} className="border-white/10 text-white/60 h-8">Cancel</Button>
              <Button size="sm" onClick={() => { setVpsDeployOpen(false); deployWithStream(selectedOrder.id, vpsDeployVpsId); }} disabled={!vpsDeployVpsId || vpsDeployLoading}
                className="bg-violet-600 hover:bg-violet-700 text-white h-8 px-4">
                <Zap className="w-3 h-3 mr-1.5" />Deploy Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header + filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white">Bot Orders</h2>
        <div className="flex gap-2 flex-wrap text-xs">
          {["all","pending","paid","deploying","deployed","stopped","suspended","failed"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full font-medium transition-all capitalize ${statusFilter === s ? "bg-green-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
            >{s}</button>
          ))}
        </div>
      </div>

              {/* ── Bulk Actions Panel ─────────────────────────────────────────────── */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wide">Bulk Actions</span>
                  {bulkResult && <span className={`text-xs px-2 py-0.5 rounded ${bulkResult.startsWith("Error") ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>{bulkResult}</span>}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={() => doBulkAction("deploy-pending")} disabled={!!bulkLoading} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-medium disabled:opacity-50 flex items-center gap-1.5">
                    {bulkLoading === "deploy-pending" ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" /> : "🚀"} Deploy Pending Bots
                  </button>
                  <button onClick={() => doBulkAction("suspend-expired")} disabled={!!bulkLoading} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 font-medium disabled:opacity-50 flex items-center gap-1.5">
                    {bulkLoading === "suspend-expired" ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" /> : "⏸"} Suspend All Expired
                  </button>
                  <button onClick={() => doBulkAction("restart-all")} disabled={!!bulkLoading} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 font-medium disabled:opacity-50 flex items-center gap-1.5">
                    {bulkLoading === "restart-all" ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" /> : "↻"} Restart All Bots
                  </button>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input placeholder="VPS ID" value={bulkVpsId} onChange={e => setBulkVpsId(e.target.value)} className="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white/70 w-36 focus:outline-none focus:border-indigo-500/50" />
                    <button onClick={() => doBulkAction("restart-vps")} disabled={!!bulkLoading || !bulkVpsId} className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 font-medium disabled:opacity-50 flex items-center gap-1.5">
                      {bulkLoading === "restart-vps" ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" /> : "🔄"} Restart VPS Bots
                    </button>
                  </div>
                </div>
              </div>


      {/* Management panel */}
      {selectedOrder && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white text-base">{selectedOrder.botName}</h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedOrder.reference}</p>
              {selectedOrder.deployUrl && (
                <a href={selectedOrder.deployUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:underline mt-1 inline-block">
                  {selectedOrder.deployUrl}
                </a>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setSelectedOrder(null)} className="border-white/10 text-gray-400 h-7 px-2 shrink-0">
              <X className="w-3 h-3" />
            </Button>
          </div>

          {/* Customer info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-gray-500">Customer</p><p className="text-gray-200">{selectedOrder.customerName}</p></div>
            <div><p className="text-xs text-gray-500">Email</p><p className="text-gray-200 truncate">{selectedOrder.customerEmail}</p></div>
            <div><p className="text-xs text-gray-500">Phone</p><p className="text-gray-200">{selectedOrder.customerPhone}</p></div>
            <div><p className="text-xs text-gray-500">Amount</p><p className="text-gray-200 font-bold">KES {selectedOrder.amount}</p></div>
            <div><p className="text-xs text-gray-500">Mode</p><p className="text-gray-200 capitalize">{selectedOrder.mode}</p></div>
            <div><p className="text-xs text-gray-500">Timezone</p><p className="text-gray-200">{selectedOrder.timezone}</p></div>
            {selectedOrder.sessionId && (
              <div className="col-span-2"><p className="text-xs text-gray-500">Session ID</p>
                <p className="text-gray-200 font-mono text-xs break-all">{selectedOrder.sessionId}</p></div>
            )}
            {selectedOrder.pm2Name && (
              <div><p className="text-xs text-gray-500">PM2 Name</p><p className="text-emerald-400 text-xs">{selectedOrder.pm2Name || selectedOrder.pm2_name}</p></div>
            )}
            {selectedOrder.vpsLabel && (
              <div><p className="text-xs text-gray-500">VPS Server</p><p className="text-sky-300 text-xs font-medium">{selectedOrder.vpsLabel}</p></div>
            )}
            {selectedOrder.deployedAt && (
              <div><p className="text-xs text-gray-500">Last Deployed</p><p className="text-gray-200 text-xs">{new Date(selectedOrder.deployedAt).toLocaleString()}</p></div>
            )}
          </div>

          {/* ── Live Deploy Terminal ───────────────────────────────── */}
          <div className="rounded-2xl border border-violet-500/20 bg-black/30 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                <span className="text-xs text-white/40 ml-1 font-mono">deployment — {selectedOrder.reference}</span>
              </div>
              <button
                onClick={() => deployWithStream(selectedOrder.id)}
                disabled={deployStreaming}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  deployStreaming ? "bg-violet-800/50 text-violet-400 cursor-not-allowed"
                  : deployStreamStatus === "success" ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : deployStreamStatus === "failed" ? "bg-red-600 hover:bg-red-500 text-white"
                  : "bg-violet-600 hover:bg-violet-500 text-white"
                }`}
              >
                {deployStreaming
                  ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />Deploying...</>
                  : deployStreamStatus === "success" ? <><Zap className="w-3 h-3" />Redeploy</>
                  : deployStreamStatus === "failed" ? <><Zap className="w-3 h-3" />Retry Deploy</>
                  : <><Zap className="w-3 h-3" />Deploy to VPS</>}
              </button>
            </div>
            <div ref={deployLogRef} className="font-mono text-xs p-4 h-52 overflow-y-auto space-y-0.5 scroll-smooth">
              {deployStreamLog.length === 0 && !deployStreaming ? (
                <div className="space-y-1">
                  {selectedOrder?.deploymentNotes ? (
                    <>
                      <div className={`leading-relaxed mb-2 ${selectedOrder.status === 'deployed' ? 'text-emerald-400' : selectedOrder.status === 'deploy_failed' ? 'text-red-400' : 'text-amber-300'}`}>
                        {selectedOrder.status === 'deployed' ? '✅ Deployed successfully' : selectedOrder.status === 'deploy_failed' ? '❌ Deployment failed' : `ℹ️ Status: ${selectedOrder.status}`}
                      </div>
                      {selectedOrder.deploymentNotes.split('\n').map((line: string, i: number) => (
                        <div key={i} className={`leading-relaxed whitespace-pre-wrap ${line.startsWith('❌') || line.includes('FAILED') || line.includes('failed') ? 'text-red-400' : line.startsWith('✅') || line.includes('success') ? 'text-emerald-400' : 'text-white/50'}`}>{line || '\u00a0'}</div>
                      ))}
                      {selectedOrder.pm2Name && <div className="mt-2 text-emerald-400/60">PM2: {selectedOrder.pm2Name}</div>}
                      {selectedOrder.deployedAt && <div className="text-white/30">Deployed: {new Date(selectedOrder.deployedAt).toLocaleString()}</div>}
                      <div className="mt-2 text-white/20 border-t border-white/5 pt-2">Click "Deploy to VPS" to redeploy manually.</div>
                    </>
                  ) : (
                    <span className="text-white/20">Click "Deploy to VPS" to start — VPS is auto-selected, logs stream here live.</span>
                  )}
                </div>
              ) : (
                deployStreamLog.map((line, i) => (
                  <div key={i} className={`leading-relaxed whitespace-pre ${
                    line.startsWith("✅") ? "text-emerald-400 font-bold"
                    : line.startsWith("   ✓") ? "text-emerald-400"
                    : line.startsWith("❌") || line.startsWith("   ⚠") ? "text-red-400"
                    : line.startsWith("🎯") || line.startsWith("📦") || line.startsWith("📋") ? "text-sky-300"
                    : line.startsWith("⚡") || line.startsWith("🔍") || line.startsWith("📂") || line.startsWith("📝") || line.startsWith("🚀") ? "text-amber-300"
                    : line.startsWith("─") ? "text-white/20"
                    : "text-white/65"
                  }`}>{line || "\u00a0"}</div>
                ))
              )}
              {deployStreaming && <div className="text-violet-400 animate-pulse mt-1">▋</div>}
            </div>
          </div>

          {/* Heroku live status */}
          {isDeployed && (
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Live Status</p>
                <button onClick={() => loadHerokuStatus(selectedOrder)} className="text-xs text-gray-500 hover:text-white flex items-center gap-1">
                  <RefreshCw className={`w-3 h-3 ${vpsLoading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
              {vpsLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="w-3 h-3 animate-spin" /> Loading status...</div>
              ) : vpsStatus?.deployed ? (
                <div className="flex flex-wrap gap-4 text-xs">
                  {vpsStatus.pm2Name && (
                    <div><span className="text-gray-500">PM2: </span><span className="text-indigo-300 font-mono">{vpsStatus.pm2Name}</span></div>
                  )}
                  <div><span className="text-gray-500">Status: </span>
                    <span className={vpsStatus.pm2Status === "online" ? "text-green-400" : vpsStatus.pm2Status === "stopped" ? "text-orange-400" : "text-yellow-400"}>
                      {vpsStatus.pm2Status ?? "unknown"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">{vpsStatus?.message || "Status unavailable"}</p>
              )}
            </div>
          )}

          {/* Live Bot Logs */}
          {isDeployed && (
            <div className="rounded-xl border border-white/5 overflow-hidden" style={{ background: "#080810" }}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-xs font-medium text-white/70 uppercase tracking-wide">Live Bot Logs</p>
                  {botLogsTs && (
                    <span className="text-[10px] text-white/25">· {botLogsTs.toLocaleTimeString()}</span>
                  )}
                  {botLogsLoading && <span className="text-[10px] text-white/30 animate-pulse">fetching...</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBotLogsAuto(a => !a)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${botLogsAuto ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-white/5 text-white/30 border-white/10"}`}
                  >{botLogsAuto ? "● Auto" : "○ Paused"}</button>
                  <button onClick={() => fetchBotLogs(selectedOrder)} className="text-white/25 hover:text-white/60 transition-colors">
                    <RefreshCw className={`w-3 h-3 ${botLogsLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
              <div ref={botLogsRef} className="font-mono text-[11px] leading-relaxed overflow-auto p-3 text-green-300/80 whitespace-pre-wrap" style={{ maxHeight: "320px", minHeight: "120px" }}>
                {botLogs.length === 0 ? (
                  <span className="text-white/20">{botLogsLoading ? "Loading logs..." : "No logs yet — logs will appear here when the bot runs."}</span>
                ) : (
                  botLogs.map((line, i) => {
                    const isError = /error|fail|crash|exception|logout|disconnect/i.test(line);
                    const isWarn = /warn|timeout|retry/i.test(line);
                    const isQr = /qr|scan|pairing|code/i.test(line);
                    const isOk = /success|connected|ready|online|start/i.test(line);
                    const color = isError ? "text-red-400" : isQr ? "text-yellow-300 font-bold" : isOk ? "text-emerald-400" : isWarn ? "text-amber-400" : "text-green-300/70";
                    return <div key={i} className={color}>{line}</div>;
                  })
                )}
              </div>
            </div>
          )}

          {/* VPS action buttons */}
          {isDeployed && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Bot Controls</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm"
                  onClick={() => vpsAction(selectedOrder.id, "reboot")}
                  disabled={actionLoading === "reboot"}
                  className="bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 h-8 px-3 text-xs">
                  {actionLoading === "reboot" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                  Reboot
                </Button>
                <Button size="sm"
                  onClick={() => vpsAction(selectedOrder.id, "stop")}
                  disabled={actionLoading === "stop"}
                  className="bg-orange-600/20 border border-orange-500/30 text-orange-300 hover:bg-orange-600/30 h-8 px-3 text-xs">
                  {actionLoading === "stop" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Power className="w-3 h-3 mr-1" />}
                  Stop
                </Button>
                <Button size="sm"
                  onClick={() => vpsAction(selectedOrder.id, "resume")}
                  disabled={actionLoading === "resume"}
                  className="bg-green-600/20 border border-green-500/30 text-green-300 hover:bg-green-600/30 h-8 px-3 text-xs">
                  {actionLoading === "resume" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                  Resume
                </Button>
                <Button size="sm"
                   onClick={() => vpsAction(selectedOrder.id, "stop")}
                   disabled={actionLoading === "stop"}
                  className="bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30 h-8 px-3 text-xs">
                   {actionLoading === "stop" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
                  Suspend
                </Button>
                <Button size="sm"
                  onClick={() => { setVpsDeployOpen(true); setVpsDeployLog(""); setVpsDeployStatus("idle"); }}
                  className="bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 h-8 px-3 text-xs">
                  <Server className="w-3 h-3 mr-1" />Deploy via VPS
                </Button>
                <Button size="sm"
                   onClick={() => vpsAction(selectedOrder.id, "resume")}
                   disabled={actionLoading === "resume"}
                  className="bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 h-8 px-3 text-xs">
                   {actionLoading === "resume" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
                  Unsuspend
                </Button>
                <Button size="sm"
                  onClick={() => updateMutation.mutate({ id: selectedOrder.id, status: newStatus, deploymentNotes: notes, redeploy: true })}
                  disabled={updateMutation.isPending}
                  className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 h-8 px-3 text-xs">
                  {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                  Redeploy
                </Button>
              </div>
            </div>
          )}

          {/* Config Vars editor */}
          {isDeployed && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Config Variables</p>
                {!configEditing && (
                  <Button size="sm" variant="outline" onClick={() => loadConfigVars(selectedOrder)}
                    disabled={configLoading}
                    className="border-white/10 text-gray-400 hover:text-white h-7 px-2 text-xs">
                    {configLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Edit2 className="w-3 h-3 mr-1" />}
                    Edit Vars
                  </Button>
                )}
              </div>
              {configEditing && (
                <div className="space-y-2 bg-black/20 border border-white/5 rounded-xl p-3">
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {configDraft.map((entry, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          value={entry.key}
                          onChange={(e) => setConfigDraft(d => d.map((x, i) => i === idx ? { ...x, key: e.target.value } : x))}
                          placeholder="KEY"
                          className="h-7 text-xs font-mono bg-white/[0.03] border-white/10 text-gray-200 w-40 shrink-0"
                        />
                        <Input
                          value={entry.value}
                          onChange={(e) => setConfigDraft(d => d.map((x, i) => i === idx ? { ...x, value: e.target.value } : x))}
                          placeholder="value"
                          className="h-7 text-xs font-mono bg-white/[0.03] border-white/10 text-gray-200 flex-1"
                        />
                        <button onClick={() => setConfigDraft(d => d.filter((_, i) => i !== idx))}
                          className="text-gray-600 hover:text-red-400 shrink-0"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setConfigDraft(d => [...d, { key: "", value: "" }])}
                      className="border-white/10 text-gray-400 hover:text-white h-7 px-2 text-xs">
                      <Plus className="w-3 h-3 mr-1" /> Add Var
                    </Button>
                    <Button size="sm" onClick={() => saveConfigVars(selectedOrder)} disabled={actionLoading === "config-save"}
                      className="bg-green-600 hover:bg-green-500 text-white h-7 px-3 text-xs">
                      {actionLoading === "config-save" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                      Save & Apply
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfigEditing(false)}
                      className="border-white/10 text-gray-400 h-7 px-2 text-xs">Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status + notes update */}
          <div className="border-t border-white/5 pt-4 space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Update Order Status</p>
            <div className="flex gap-2 flex-wrap">
              {["pending","paid","deploying","deployed","stopped","suspended","failed"].map((s) => (
                <button key={s} onClick={() => setNewStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${newStatus === s ? "bg-green-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                  {s}
                </button>
              ))}
            </div>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Deployment notes (optional)"
              rows={2}
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-green-500/50"
            />
            <Button size="sm" onClick={() => updateMutation.mutate({ id: selectedOrder.id, status: newStatus, deploymentNotes: notes })}
              disabled={updateMutation.isPending}
              className="bg-green-600 hover:bg-green-500 text-white h-8 px-4 text-xs">
              {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Orders table */}
      {isLoading ? (
        <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-green-400 mx-auto" /></div>
      ) : (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="text-gray-400">Reference</TableHead>
                <TableHead className="text-gray-400">Customer</TableHead>
                <TableHead className="text-gray-400">Bot</TableHead>
                <TableHead className="text-gray-400">Amount</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">VPS</TableHead>
                <TableHead className="text-gray-400">Date</TableHead>
                <TableHead className="text-gray-400">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order: any) => (
                <TableRow key={order.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="text-gray-400 text-xs font-mono">{order.reference}</TableCell>
                  <TableCell>
                    <div><p className="text-white text-sm">{order.customerName}</p>
                      <p className="text-gray-500 text-xs">{order.customerEmail}</p></div>
                  </TableCell>
                  <TableCell className="text-white text-sm">{order.botName}</TableCell>
                  <TableCell className="text-white font-semibold text-sm">KES {order.amount}</TableCell>
                  <TableCell>
                    {order.status === "deploying" ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                          deploying
                        </span>
                        {order.deploymentNotes && (
                          <span className="text-[10px] text-purple-300/70 pl-1 max-w-[140px] truncate">{order.deploymentNotes}</span>
                        )}
                      </div>
                    ) : (
                      <Badge className={`text-xs border ${STATUS_BADGES[order.status] || "bg-gray-500/10 text-gray-400"}`}>
                        {order.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.pm2Name ? (
                      <span className="text-xs text-emerald-400 font-mono">{order.pm2Name}</span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-400 text-xs">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline"
                      onClick={() => selectOrder(order)}
                      className="border-white/10 text-gray-400 hover:text-white h-7 px-2 text-xs">
                      <Settings className="w-3 h-3 mr-1" /> Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-8">No orders found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── SMM Orders Admin Tab ─────────────────────────────────────────────────────
function SmmOrdersAdminTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/smm-orders"],
    queryFn: () => fetch("/api/admin/smm-orders", { headers: authHeaders() as any }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const orders: any[] = data?.orders || [];

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/admin/smm-orders/${id}/status`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" } as any,
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: (res) => {
      if (res.success) {
        toast({ title: "Status updated" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/smm-orders"] });
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    },
  });

  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchSearch = !search || [o.reference, o.service_name, o.platform, o.customer_email, o.link].some(v => (v || "").toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const totalKes = orders.filter(o => o.status !== "failed").reduce((s: number, o: any) => s + (o.amount_kes || 0), 0);
  const pending = orders.filter(o => o.status === "pending").length;
  const processing = orders.filter(o => o.status === "processing").length;

  const STATUS_OPTS = [
    { v: "pending",    label: "Pending",    cls: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
    { v: "processing", label: "Processing", cls: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
    { v: "completed",  label: "Completed",  cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
    { v: "failed",     label: "Failed",     cls: "text-red-400 border-red-500/30 bg-red-500/10" },
  ];
  const statusCls = (s: string) => STATUS_OPTS.find(x => x.v === s)?.cls || "text-gray-400 border-gray-500/30 bg-gray-500/10";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">SMM Orders</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage social media boost orders from customers</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="border-white/10 text-gray-400 hover:text-white gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Orders", value: orders.length, color: "text-white" },
          { label: "Pending", value: pending, color: "text-amber-400" },
          { label: "Processing", value: processing, color: "text-blue-400" },
          { label: "Revenue (KES)", value: `KES ${totalKes.toLocaleString()}`, color: "text-emerald-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by reference, service, email..." className="pl-8 bg-white/5 border-white/10 text-white text-sm h-9" />
        </div>
        <div className="flex gap-1.5">
          {["all", "pending", "processing", "completed", "failed"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${statusFilter === s ? "bg-pink-500/20 border-pink-500/30 text-pink-300" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading orders...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No SMM orders yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                {["Reference","Platform","Service","Qty","Link","Amount","Status","Date","Action"].map(h => (
                  <TableHead key={h} className="text-gray-400 text-xs font-medium">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order: any) => (
                <TableRow key={order.id} className="border-white/5 hover:bg-white/3">
                  <TableCell className="font-mono text-xs text-gray-300">{order.reference?.slice(0, 14)}…</TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-pink-500/10 text-pink-400 border-pink-500/20">{order.platform || "—"}</span>
                  </TableCell>
                  <TableCell className="text-xs text-gray-300 max-w-48">
                    <p className="truncate" title={order.service_name}>{order.service_name || "—"}</p>
                    <p className="text-gray-500">{order.customer_email}</p>
                  </TableCell>
                  <TableCell className="text-sm text-white font-medium">{(order.quantity || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-xs max-w-32">
                    <a href={order.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 truncate">
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{order.link}</span>
                    </a>
                  </TableCell>
                  <TableCell className="text-sm text-emerald-400 font-medium">KES {(order.amount_kes || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusCls(order.status)}`}>{order.status}</span>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <select
                      value={order.status}
                      onChange={e => updateStatus.mutate({ id: order.id, status: e.target.value })}
                      className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-300 focus:outline-none focus:border-pink-500/40"
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Proxy Plans Admin Tab ────────────────────────────────────────────────────
function ProxyPlansAdminTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name:"", description:"", type:"residential", gb_amount:"", country:"", price_kes:"", bandwidth:"Unlimited", speed:"100Mbps", features:"", is_active:true, sort_order:"0" });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/proxy-plans"],
    queryFn: () => fetch("/api/admin/proxy-plans", { headers: authHeaders() as any }).then(r => r.json()),
  });
  const plans: any[] = data?.plans || [];

  const reset = () => { setForm({ name:"", description:"", type:"residential", gb_amount:"", country:"", price_kes:"", bandwidth:"Unlimited", speed:"100Mbps", features:"", is_active:true, sort_order:"0" }); setEditing(null); setShowForm(false); };

  const startEdit = (p: any) => {
    setForm({ name:p.name, description:p.description||"", type:p.type, gb_amount:p.gb_amount||"", country:p.country||"", price_kes:p.price_kes, bandwidth:p.bandwidth||"Unlimited", speed:p.speed||"100Mbps", features:p.features||"", is_active:p.is_active, sort_order:p.sort_order||"0" });
    setEditing(p); setShowForm(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, price_kes: parseFloat(form.price_kes as any), gb_amount: form.gb_amount ? parseFloat(form.gb_amount as any) : null, sort_order: parseInt(form.sort_order as any)||0 };
      const url = editing ? `/api/admin/proxy-plans/${editing.id}` : "/api/admin/proxy-plans";
      return fetch(url, { method: editing ? "PUT" : "POST", headers: { ...authHeaders(), "Content-Type":"application/json" } as any, body: JSON.stringify(body) }).then(r => r.json());
    },
    onSuccess: (res) => {
      if (res.success) { toast({ title: editing ? "Plan updated" : "Plan created" }); queryClient.invalidateQueries({ queryKey:["/api/admin/proxy-plans"] }); reset(); }
      else toast({ title:"Error", description:res.error, variant:"destructive" });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/proxy-plans/${id}`, { method:"DELETE", headers: authHeaders() as any }).then(r=>r.json()),
    onSuccess: () => { toast({ title:"Plan deleted" }); queryClient.invalidateQueries({ queryKey:["/api/admin/proxy-plans"] }); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: any) => fetch(`/api/admin/proxy-plans/${id}`, { method:"PUT", headers:{...authHeaders(),"Content-Type":"application/json"} as any, body:JSON.stringify({ is_active:!is_active }) }).then(r=>r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey:["/api/admin/proxy-plans"] }),
  });

  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/40";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-white">Proxy Plans</h2><p className="text-sm text-gray-400">Create and manage proxy packages customers can purchase</p></div>
        <Button size="sm" onClick={() => { reset(); setShowForm(true); }} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"><Plus className="w-4 h-4"/>Add Plan</Button>
      </div>

      {showForm && (
        <div className="bg-white/5 border border-emerald-500/20 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-white">{editing ? "Edit Plan" : "New Proxy Plan"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-400 mb-1 block">Plan Name *</label><input className={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Kenya Residential 5GB" /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Type *</label>
              <select className={inp} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                <option value="residential">Residential</option><option value="rotating">Rotating</option><option value="datacenter">Datacenter</option><option value="static">Static</option>
              </select>
            </div>
            <div><label className="text-xs text-gray-400 mb-1 block">Price (KES) *</label><input type="number" className={inp} value={form.price_kes} onChange={e=>setForm(f=>({...f,price_kes:e.target.value}))} placeholder="e.g. 1500" /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Country (optional)</label><input className={inp} value={form.country} onChange={e=>setForm(f=>({...f,country:e.target.value}))} placeholder="e.g. Kenya, USA, Global" /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">GB Amount (optional)</label><input type="number" className={inp} value={form.gb_amount} onChange={e=>setForm(f=>({...f,gb_amount:e.target.value}))} placeholder="e.g. 5" /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Bandwidth</label><input className={inp} value={form.bandwidth} onChange={e=>setForm(f=>({...f,bandwidth:e.target.value}))} placeholder="e.g. Unlimited, 5GB" /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Speed</label><input className={inp} value={form.speed} onChange={e=>setForm(f=>({...f,speed:e.target.value}))} placeholder="e.g. 100Mbps" /></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Sort Order</label><input type="number" className={inp} value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:e.target.value}))} /></div>
            <div className="sm:col-span-2"><label className="text-xs text-gray-400 mb-1 block">Description</label><textarea className={inp} rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Brief plan description..." /></div>
            <div className="sm:col-span-2"><label className="text-xs text-gray-400 mb-1 block">Features (one per line)</label><textarea className={inp} rows={3} value={form.features} onChange={e=>setForm(f=>({...f,features:e.target.value}))} placeholder={"HTTP/HTTPS/SOCKS5 support\nUnlimited threads\n99.9% uptime"} /></div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} className="w-4 h-4 rounded" />
              Active (visible to customers)
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.price_kes} className="bg-emerald-600 hover:bg-emerald-700">
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}{editing ? "Update" : "Create"} Plan
            </Button>
            <Button variant="outline" onClick={reset} className="border-white/10 text-gray-400">Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-center py-8 text-gray-500">Loading plans...</div> : plans.length === 0 ? (
        <div className="text-center py-12 text-gray-500"><Shield className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No plans yet. Add your first proxy plan.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                {["Name","Type","Country","Data","Price (KES)","Speed","Status","Actions"].map(h=>(
                  <TableHead key={h} className="text-gray-400 text-xs">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p:any) => (
                <TableRow key={p.id} className="border-white/5 hover:bg-white/3">
                  <TableCell className="text-sm text-white font-medium">{p.name}</TableCell>
                  <TableCell><span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 capitalize">{p.type}</span></TableCell>
                  <TableCell className="text-xs text-gray-400">{p.country||"Global"}</TableCell>
                  <TableCell className="text-xs text-gray-400">{p.gb_amount ? p.gb_amount+"GB" : p.bandwidth||"—"}</TableCell>
                  <TableCell className="text-sm text-emerald-400 font-medium">KES {(p.price_kes||0).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-gray-400">{p.speed||"—"}</TableCell>
                  <TableCell>
                    <button onClick={() => toggle.mutate({ id:p.id, is_active:p.is_active })}
                      className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${p.is_active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-gray-500 border-white/10"}`}>
                      {p.is_active ? "Active" : "Hidden"}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => startEdit(p)} className="border-white/10 text-gray-400 h-7 px-2 text-xs"><Edit2 className="w-3 h-3"/></Button>
                      <Button size="sm" variant="outline" onClick={() => { if(confirm("Delete this plan?")) del.mutate(p.id); }} className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-7 px-2 text-xs"><Trash2 className="w-3 h-3"/></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Proxy Orders Admin Tab ───────────────────────────────────────────────────
function ProxyOrdersAdminTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [credModal, setCredModal] = useState<any>(null);
  const [credText, setCredText] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/proxy-orders"],
    queryFn: () => fetch("/api/admin/proxy-orders", { headers: authHeaders() as any }).then(r=>r.json()),
    refetchInterval: 30000,
  });
  const orders: any[] = data?.orders || [];

  const updateStatus = useMutation({
    mutationFn: ({ id, status, credentials }: any) =>
      fetch(`/api/admin/proxy-orders/${id}/status`, { method:"PATCH", headers:{...authHeaders(),"Content-Type":"application/json"} as any, body:JSON.stringify({ status, credentials }) }).then(r=>r.json()),
    onSuccess: (res) => { if(res.success){toast({title:"Updated"});queryClient.invalidateQueries({queryKey:["/api/admin/proxy-orders"]});setCredModal(null);}else toast({title:"Error",description:res.error,variant:"destructive"}); },
  });

  const filtered = orders.filter(o => {
    const ms = statusFilter==="all"||o.status===statusFilter;
    const mq = !search||[o.reference,o.plan_name,o.customer_email].some(v=>(v||"").toLowerCase().includes(search.toLowerCase()));
    return ms && mq;
  });

  const totalKes = orders.filter(o=>o.status!=="failed").reduce((s:number,o:any)=>s+(o.amount_kes||0),0);
  const statusCls = (s:string) => ({ pending:"text-amber-400 border-amber-500/30 bg-amber-500/10", processing:"text-blue-400 border-blue-500/30 bg-blue-500/10", active:"text-emerald-400 border-emerald-500/30 bg-emerald-500/10", completed:"text-gray-400 border-gray-500/30 bg-gray-500/10", failed:"text-red-400 border-red-500/30 bg-red-500/10" }[s] || "text-gray-400 border-gray-500/30");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-white">Proxy Orders</h2><p className="text-sm text-gray-400">Manage customer proxy orders and deliver credentials</p></div>
        <Button size="sm" variant="outline" onClick={()=>refetch()} className="border-white/10 text-gray-400 gap-1.5"><RefreshCw className="w-3.5 h-3.5"/>Refresh</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:"Total Orders",value:orders.length,color:"text-white"},
          {label:"Pending",value:orders.filter((o:any)=>o.status==="pending").length,color:"text-amber-400"},
          {label:"Active",value:orders.filter((o:any)=>o.status==="active").length,color:"text-emerald-400"},
          {label:"Revenue (KES)",value:`KES ${totalKes.toLocaleString()}`,color:"text-emerald-400"},
        ].map(s=>(
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search orders..." className="pl-8 bg-white/5 border-white/10 text-white text-sm h-9"/>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all","pending","processing","active","completed","failed"].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${statusFilter===s?"bg-emerald-500/20 border-emerald-500/30 text-emerald-300":"bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"}`}>{s}</button>
          ))}
        </div>
      </div>

      {isLoading ? <div className="text-center py-8 text-gray-500">Loading...</div> : filtered.length===0 ? (
        <div className="text-center py-12 text-gray-500"><Shield className="w-8 h-8 mx-auto mb-2 opacity-30"/><p>No proxy orders yet</p></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                {["Reference","Plan","Customer","Amount","Status","Date","Actions"].map(h=>(
                  <TableHead key={h} className="text-gray-400 text-xs">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o:any)=>(
                <TableRow key={o.id} className="border-white/5 hover:bg-white/3">
                  <TableCell className="font-mono text-xs text-gray-300">{(o.reference||"").slice(0,14)}…</TableCell>
                  <TableCell className="text-sm text-white">{o.plan_name}</TableCell>
                  <TableCell className="text-xs text-gray-400">{o.customer_email}</TableCell>
                  <TableCell className="text-sm text-emerald-400 font-medium">KES {(o.amount_kes||0).toLocaleString()}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusCls(o.status)}`}>{o.status}</span></TableCell>
                  <TableCell className="text-xs text-gray-500">{o.created_at?new Date(o.created_at).toLocaleDateString():"—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <select value={o.status} onChange={e=>updateStatus.mutate({id:o.id,status:e.target.value})}
                        className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-300 focus:outline-none">
                        <option value="pending">Pending</option><option value="processing">Processing</option>
                        <option value="active">Active</option><option value="completed">Completed</option><option value="failed">Failed</option>
                      </select>
                      <Button size="sm" variant="outline" onClick={()=>{setCredModal(o);setCredText(o.credentials||"");}}
                        className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 h-7 px-2 text-xs">
                        <Key className="w-3 h-3 mr-1"/>Creds
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {credModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)setCredModal(null);}}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6">
            <h3 className="font-bold mb-1">Deliver Credentials</h3>
            <p className="text-sm text-gray-400 mb-4">{credModal.customer_email} — {credModal.plan_name}</p>
            <textarea value={credText} onChange={e=>setCredText(e.target.value)} rows={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500/40 mb-4"
              placeholder={"host: proxy.example.com\nport: 8080\nusername: user123\npassword: pass456\nprotocol: HTTP/HTTPS/SOCKS5"} />
            <div className="flex gap-2">
              <Button onClick={()=>updateStatus.mutate({id:credModal.id,status:"active",credentials:credText})} disabled={updateStatus.isPending} className="bg-emerald-600 hover:bg-emerald-700 flex-1">
                {updateStatus.isPending?<Loader2 className="w-4 h-4 animate-spin mr-1"/>:null}Save & Mark Active
              </Button>
              <Button variant="outline" onClick={()=>setCredModal(null)} className="border-white/10 text-gray-400">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Digital Products Admin Tab ───────────────────────────────────────────────
function DigitalProductsAdminTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [stockModal, setStockModal] = useState<any>(null);
  const [stockText, setStockText] = useState("");
  const [stockLoading, setStockLoading] = useState(false);
  const [form, setForm] = useState({ name:"", platform:"Instagram", category:"social", price_kes:"", description:"", features:"", is_active:true, sort_order:"0" });

  const { data, isLoading, refetch } = useQuery({
    queryKey:["/api/admin/digital-products"],
    queryFn:()=>fetch("/api/admin/digital-products",{headers:authHeaders() as any}).then(r=>r.json()),
  });
  const products:any[] = data?.products||[];

  const SOCIAL_PLATS = ["Instagram","TikTok","Twitter","Facebook","LinkedIn","Other"];
  const EMAIL_PLATS  = ["Gmail","Outlook","Yahoo","ProtonMail","Other"];

  const reset = () => { setForm({name:"",platform:"Instagram",category:"social",price_kes:"",description:"",features:"",is_active:true,sort_order:"0"}); setEditing(null); setShowForm(false); };
  const startEdit = (p:any) => { setForm({name:p.name,platform:p.platform,category:p.category,price_kes:p.price_kes,description:p.description||"",features:p.features||"",is_active:p.is_active,sort_order:p.sort_order||"0"}); setEditing(p); setShowForm(true); };

  const save = useMutation({
    mutationFn:()=>{
      const body={...form,price_kes:parseFloat(form.price_kes as any),sort_order:parseInt(form.sort_order as any)||0};
      const url=editing?`/api/admin/digital-products/${editing.id}`:"/api/admin/digital-products";
      return fetch(url,{method:editing?"PUT":"POST",headers:{...authHeaders(),"Content-Type":"application/json"} as any,body:JSON.stringify(body)}).then(r=>r.json());
    },
    onSuccess:(res)=>{ if(res.success){toast({title:editing?"Product updated":"Product created"});queryClient.invalidateQueries({queryKey:["/api/admin/digital-products"]});reset();}else toast({title:"Error",description:res.error,variant:"destructive"}); },
  });

  const del = useMutation({
    mutationFn:(id:number)=>fetch(`/api/admin/digital-products/${id}`,{method:"DELETE",headers:authHeaders() as any}).then(r=>r.json()),
    onSuccess:()=>{toast({title:"Deleted"});queryClient.invalidateQueries({queryKey:["/api/admin/digital-products"]});},
  });

  const addStock = async () => {
    if(!stockModal||!stockText.trim()) return;
    setStockLoading(true);
    try {
      const res = await fetch(`/api/admin/digital-products/${stockModal.id}/stock`,{method:"POST",headers:{...authHeaders(),"Content-Type":"application/json"} as any,body:JSON.stringify({credentials:stockText})}).then(r=>r.json());
      if(res.success){toast({title:`Added ${res.added} accounts`});queryClient.invalidateQueries({queryKey:["/api/admin/digital-products"]});setStockModal(null);setStockText("");}
      else toast({title:"Error",description:res.error,variant:"destructive"});
    }catch{toast({title:"Network error",variant:"destructive"});}
    setStockLoading(false);
  };

  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40";
  const plats = form.category==="social" ? SOCIAL_PLATS : EMAIL_PLATS;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-white">Aged Accounts Products</h2><p className="text-sm text-gray-400">Manage social media and email account listings with stock</p></div>
        <Button size="sm" onClick={()=>{reset();setShowForm(true);}} className="bg-violet-600 hover:bg-violet-700 gap-1.5"><Plus className="w-4 h-4"/>Add Product</Button>
      </div>

      {showForm && (
        <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-white">{editing?"Edit Product":"New Account Product"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-400 mb-1 block">Category *</label>
              <select className={inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value,platform:e.target.value==="social"?"Instagram":"Gmail"}))}>
                <option value="social">Social Media</option><option value="email">Email Accounts</option>
              </select>
            </div>
            <div><label className="text-xs text-gray-400 mb-1 block">Platform *</label>
              <select className={inp} value={form.platform} onChange={e=>setForm(f=>({...f,platform:e.target.value}))}>
                {plats.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-400 mb-1 block">Product Name *</label><input className={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Aged Instagram (2yr+ PVA)"/></div>
            <div><label className="text-xs text-gray-400 mb-1 block">Price (KES) *</label><input type="number" className={inp} value={form.price_kes} onChange={e=>setForm(f=>({...f,price_kes:e.target.value}))} placeholder="e.g. 800"/></div>
            <div className="sm:col-span-2"><label className="text-xs text-gray-400 mb-1 block">Description</label><input className={inp} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Brief description shown to customers"/></div>
            <div className="sm:col-span-2"><label className="text-xs text-gray-400 mb-1 block">Features (one per line)</label>
              <textarea className={inp} rows={4} value={form.features} onChange={e=>setForm(f=>({...f,features:e.target.value}))} placeholder={"Phone Verified (PVA)\n2+ Years Old\n500+ Followers\nFull account access\nEmail + password included"}/>
            </div>
            <div><label className="text-xs text-gray-400 mb-1 block">Sort Order</label><input type="number" className={inp} value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:e.target.value}))}/></div>
            <div className="flex items-center gap-2 self-end pb-2">
              <input type="checkbox" checked={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} className="w-4 h-4 rounded"/>
              <label className="text-sm text-gray-300">Active (visible to customers)</label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={()=>save.mutate()} disabled={save.isPending||!form.name||!form.price_kes} className="bg-violet-600 hover:bg-violet-700">
              {save.isPending?<Loader2 className="w-4 h-4 animate-spin mr-1"/>:null}{editing?"Update":"Create"} Product
            </Button>
            <Button variant="outline" onClick={reset} className="border-white/10 text-gray-400">Cancel</Button>
          </div>
        </div>
      )}

      {isLoading?<div className="text-center py-8 text-gray-500">Loading...</div>:products.length===0?(
        <div className="text-center py-12 text-gray-500"><Users className="w-8 h-8 mx-auto mb-2 opacity-30"/><p>No products yet. Add your first account product.</p></div>
      ):(
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <Table>
            <TableHeader><TableRow className="border-white/10 hover:bg-transparent">{["Platform","Name","Category","Price (KES)","Stock","Status","Actions"].map(h=><TableHead key={h} className="text-gray-400 text-xs">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {products.map((p:any)=>(
                <TableRow key={p.id} className="border-white/5 hover:bg-white/3">
                  <TableCell className="text-lg">{{"Instagram":"📸","TikTok":"🎵","Twitter":"🐦","Facebook":"📘","Gmail":"📧","Outlook":"📨","Yahoo":"📮"}[p.platform]||"📱"} <span className="text-xs text-gray-400 ml-1">{p.platform}</span></TableCell>
                  <TableCell className="text-sm text-white font-medium max-w-40"><p className="truncate">{p.name}</p></TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${p.category==="social"?"bg-violet-500/10 text-violet-400 border-violet-500/20":"bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>{p.category}</span></TableCell>
                  <TableCell className="text-sm text-emerald-400 font-medium">KES {(p.price_kes||0).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${p.stock_count>0?"text-emerald-400":"text-red-400"}`}>{p.stock_count}</span>
                      <span className="text-xs text-gray-500">/ {p.total_stock} total</span>
                    </div>
                  </TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border ${p.is_active?"bg-emerald-500/10 text-emerald-400 border-emerald-500/20":"bg-white/5 text-gray-500 border-white/10"}`}>{p.is_active?"Active":"Hidden"}</span></TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={()=>{setStockModal(p);setStockText("");}} className="border-violet-500/20 text-violet-400 hover:bg-violet-500/10 h-7 px-2 text-xs"><Plus className="w-3 h-3 mr-1"/>Stock</Button>
                      <Button size="sm" variant="outline" onClick={()=>startEdit(p)} className="border-white/10 text-gray-400 h-7 px-2 text-xs"><Edit2 className="w-3 h-3"/></Button>
                      <Button size="sm" variant="outline" onClick={()=>{if(confirm("Delete?"))del.mutate(p.id);}} className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-7 px-2 text-xs"><Trash2 className="w-3 h-3"/></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Stock Modal */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget){setStockModal(null);setStockText("");}}}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg p-6">
            <h3 className="font-bold mb-1">Add Account Stock</h3>
            <p className="text-sm text-gray-400 mb-1">{stockModal.name} — Current stock: <span className="text-emerald-400 font-bold">{stockModal.stock_count}</span></p>
            <p className="text-xs text-gray-500 mb-3">Paste accounts below — one per line. Format: <code className="text-violet-400">username:password:email:recovery</code></p>
            <textarea value={stockText} onChange={e=>setStockText(e.target.value)} rows={10}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-green-400 font-mono focus:outline-none focus:border-violet-500/40 mb-4"
              placeholder={"user1:pass1:backup@gmail.com\nuser2:pass2:backup@gmail.com\nuser3:pass3:backup@gmail.com"}/>
            <p className="text-xs text-gray-500 mb-3">{stockText.split('\n').filter(l=>l.trim()).length} accounts ready to import</p>
            <div className="flex gap-2">
              <Button onClick={addStock} disabled={stockLoading||!stockText.trim()} className="bg-violet-600 hover:bg-violet-700 flex-1">
                {stockLoading?<Loader2 className="w-4 h-4 animate-spin mr-1"/>:<Plus className="w-4 h-4 mr-1"/>}Import Accounts
              </Button>
              <Button variant="outline" onClick={()=>{setStockModal(null);setStockText("");}} className="border-white/10 text-gray-400">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Digital Orders Admin Tab ─────────────────────────────────────────────────
function DigitalOrdersAdminTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey:["/api/admin/digital-orders"],
    queryFn:()=>fetch("/api/admin/digital-orders",{headers:authHeaders() as any}).then(r=>r.json()),
    refetchInterval:30000,
  });
  const orders:any[] = data?.orders||[];

  const filtered = orders.filter(o=>{
    const ms=statusFilter==="all"||o.status===statusFilter;
    const mq=!search||[o.reference,o.product_name,o.platform,o.customer_email].some((v:string)=>(v||"").toLowerCase().includes(search.toLowerCase()));
    return ms&&mq;
  });
  const totalKes=orders.filter((o:any)=>o.status==="delivered").reduce((s:number,o:any)=>s+(parseFloat(o.amount_kes)||0),0);
  const sCls=(s:string)=>({pending:"text-amber-400 border-amber-500/30 bg-amber-500/10",delivered:"text-emerald-400 border-emerald-500/30 bg-emerald-500/10",failed:"text-red-400 border-red-500/30 bg-red-500/10"}[s]||"text-gray-400 border-gray-500/30 bg-gray-500/10");

  const [credView, setCredView] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const copy=(t:string)=>{navigator.clipboard.writeText(t);setCopied(true);setTimeout(()=>setCopied(false),2000);};

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-white">Digital Account Orders</h2><p className="text-sm text-gray-400">All social media and email account purchases</p></div>
        <Button size="sm" variant="outline" onClick={()=>refetch()} className="border-white/10 text-gray-400 gap-1.5"><RefreshCw className="w-3.5 h-3.5"/>Refresh</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{label:"Total Orders",value:orders.length,c:"text-white"},{label:"Delivered",value:orders.filter((o:any)=>o.status==="delivered").length,c:"text-emerald-400"},{label:"Pending",value:orders.filter((o:any)=>o.status==="pending").length,c:"text-amber-400"},{label:"Revenue",value:`KES ${totalKes.toLocaleString()}`,c:"text-emerald-400"}].map(s=>(
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-xs text-gray-400 mb-1">{s.label}</p><p className={`text-xl font-bold ${s.c}`}>{s.value}</p></div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="pl-8 bg-white/5 border-white/10 text-white text-sm h-9"/></div>
        {["all","pending","delivered","failed"].map(s=><button key={s} onClick={()=>setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${statusFilter===s?"bg-violet-500/20 border-violet-500/30 text-violet-300":"bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"}`}>{s}</button>)}
      </div>
      {isLoading?<div className="text-center py-8 text-gray-500">Loading...</div>:filtered.length===0?(
        <div className="text-center py-12 text-gray-500"><Users className="w-8 h-8 mx-auto mb-2 opacity-30"/><p>No orders yet</p></div>
      ):(
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <Table>
            <TableHeader><TableRow className="border-white/10 hover:bg-transparent">{["Reference","Platform","Product","Customer","Amount","Status","Date","Creds"].map(h=><TableHead key={h} className="text-gray-400 text-xs">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {filtered.map((o:any)=>(
                <TableRow key={o.id} className="border-white/5 hover:bg-white/3">
                  <TableCell className="font-mono text-xs text-gray-300">{(o.reference||"").slice(0,14)}…</TableCell>
                  <TableCell className="text-sm">{"📸📧🎵🐦📘".includes(o.platform)?"":<span className="text-base">{{Instagram:"📸",TikTok:"🎵",Twitter:"🐦",Facebook:"📘",Gmail:"📧",Outlook:"📨",Yahoo:"📮"}[o.platform]||"📱"}</span>}<span className="text-xs text-gray-400 ml-1">{o.platform}</span></TableCell>
                  <TableCell className="text-xs text-white max-w-32"><p className="truncate">{o.product_name}</p></TableCell>
                  <TableCell className="text-xs text-gray-400">{o.customer_email}</TableCell>
                  <TableCell className="text-sm text-emerald-400 font-medium">KES {parseFloat(o.amount_kes||0).toLocaleString()}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${sCls(o.status)}`}>{o.status}</span></TableCell>
                  <TableCell className="text-xs text-gray-500">{o.created_at?new Date(o.created_at).toLocaleDateString():"—"}</TableCell>
                  <TableCell>
                    {o.credentials?<Button size="sm" variant="outline" onClick={()=>setCredView(o)} className="border-violet-500/20 text-violet-400 hover:bg-violet-500/10 h-7 px-2 text-xs"><Eye className="w-3 h-3"/></Button>:<span className="text-xs text-gray-600">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {credView && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)setCredView(null);}}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6">
            <h3 className="font-bold mb-1">Delivered Credentials</h3>
            <p className="text-sm text-gray-400 mb-4">{credView.customer_email} — {credView.product_name}</p>
            <pre className="bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-green-400 font-mono whitespace-pre-wrap break-all mb-4">{credView.credentials}</pre>
            <div className="flex gap-2">
              <Button onClick={()=>copy(credView.credentials)} className="flex-1 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm">
                {copied?<Check className="w-4 h-4 text-green-400 mr-1"/>:<Copy className="w-4 h-4 mr-1"/>}{copied?"Copied":"Copy"}
              </Button>
              <Button onClick={()=>setCredView(null)} className="flex-1 bg-violet-600 hover:bg-violet-700 text-sm">Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Free Proxies Admin Tab ───────────────────────────────────────────────────
function FreeProxiesAdminTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bulkText, setBulkText] = useState("");
  const [proxyType, setProxyType] = useState("HTTP");
  const [importing, setImporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{checked:number;alive:number;dead:number}|null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey:["/api/admin/free-proxies"],
    queryFn:()=>fetch("/api/admin/free-proxies",{headers:authHeaders() as any}).then(r=>r.json()),
    refetchInterval: checking ? 5000 : false,
  });
  const { data: schedData, refetch: refetchSched } = useQuery({
    queryKey:["/api/admin/proxy-scheduler/status"],
    queryFn:()=>fetch("/api/admin/proxy-scheduler/status",{headers:authHeaders() as any}).then(r=>r.json()),
    refetchInterval: 8000,
  });
  const sched = schedData || {};
  const [triggering, setTriggering] = useState(false);
  const toggleScheduler = async () => {
    await fetch("/api/admin/proxy-scheduler/toggle",{method:"POST",headers:{...authHeaders(),"Content-Type":"application/json"} as any,body:JSON.stringify({enabled:!sched.enabled})});
    refetchSched();
  };
  const triggerNow = async () => {
    if(triggering||sched.running) return;
    setTriggering(true);
    const r = await fetch("/api/admin/proxy-scheduler/run",{method:"POST",headers:authHeaders() as any}).then(r=>r.json()).catch(()=>({}));
    toast({title: r.success ? "Scheduler triggered!" : (r.error||"Error"), description: r.success ? "Fetching + checking proxies now..." : undefined});
    setTriggering(false); setTimeout(()=>refetchSched(),3000);
  };
  const proxies: any[] = data?.proxies || [];

  const alive    = proxies.filter(p=>p.status==='alive').length;
  const dead     = proxies.filter(p=>p.status==='dead').length;
  const unchecked= proxies.filter(p=>p.status==='unchecked').length;

  const filtered = proxies.filter(p => {
    const ms = statusFilter==='all' || p.status===statusFilter;
    const mq = !search || (p.ip||'').includes(search) || (p.country||'').toLowerCase().includes(search.toLowerCase()) || (p.raw||'').includes(search);
    return ms && mq;
  });

  const COUNTRY_FLAG = (code: string) => code ? String.fromCodePoint(...[...code.toUpperCase()].map(c=>c.charCodeAt(0)+127397)) : '🌍';

  const importProxies = async () => {
    if (!bulkText.trim()) return;
    setImporting(true);
    try {
      const lines = bulkText.split('\n').filter(l=>l.trim()).length;
      const res = await fetch('/api/admin/free-proxies/bulk',{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'} as any,body:JSON.stringify({proxies:bulkText,type:proxyType})}).then(r=>r.json());
      if(res.success){
        toast({title:`✅ Imported ${res.added} proxies`,description:`${res.dupes||0} duplicates skipped out of ${lines} lines`});
        setBulkText(''); setShowImport(false);
        queryClient.invalidateQueries({queryKey:["/api/admin/free-proxies"]});
      } else toast({title:'Error',description:res.error,variant:'destructive'});
    } catch { toast({title:'Network error',variant:'destructive'}); }
    setImporting(false);
  };

  const checkAll = async () => {
    setChecking(true); setCheckResult(null);
    try {
      const res = await fetch('/api/admin/free-proxies/check',{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'} as any,body:JSON.stringify({})}).then(r=>r.json());
      if(res.success){
        setCheckResult({checked:res.checked,alive:res.alive,dead:res.dead});
        toast({title:`✅ Check done — ${res.alive} alive, ${res.dead} dead`});
        queryClient.invalidateQueries({queryKey:["/api/admin/free-proxies"]});
      }
    } catch { toast({title:'Check failed',variant:'destructive'}); }
    setChecking(false);
  };

  const deleteDead = async () => {
    if(!confirm('Delete all dead proxies?')) return;
    try {
      const res = await fetch('/api/admin/free-proxies/bulk/dead',{method:'DELETE',headers:authHeaders() as any}).then(r=>r.json());
      if(res.success){ toast({title:`Deleted ${res.deleted} dead proxies`}); queryClient.invalidateQueries({queryKey:["/api/admin/free-proxies"]}); }
    } catch {}
  };

  const deleteOne = async (id:number) => {
    try {
      await fetch(`/api/admin/free-proxies/${id}`,{method:'DELETE',headers:authHeaders() as any});
      queryClient.invalidateQueries({queryKey:["/api/admin/free-proxies"]});
    } catch {}
  };

  const copyAll = () => {
    const alive=proxies.filter(p=>p.status==='alive').map(p=>p.raw).join('\n');
    navigator.clipboard.writeText(alive);
    toast({title:`Copied ${proxies.filter(p=>p.status==='alive').length} alive proxies`});
  };

  const ANON_COLOR: Record<string,string> = { elite:'text-emerald-400', anonymous:'text-blue-400', transparent:'text-amber-400' };
  const STATUS_STYLE: Record<string,string> = {
    alive:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dead:    'bg-red-500/10 text-red-400 border-red-500/20',
    unchecked:'bg-white/5 text-white/40 border-white/10',
  };
  const inp = "bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/40";

  const lineCount = bulkText.split('\n').filter(l=>l.trim()).length;

  return (
    <div className="space-y-5">
      {/* Scheduler Status */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${sched.running?"bg-blue-400 animate-pulse":sched.enabled?"bg-emerald-400":"bg-white/20"}`}/>
            <span className="text-sm font-semibold text-white">Auto-Scraper</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${sched.running?"bg-blue-500/10 border-blue-500/20 text-blue-400":sched.enabled?"bg-emerald-500/10 border-emerald-500/20 text-emerald-400":"bg-white/5 border-white/10 text-white/30"}`}>
              {sched.running?"Running…":sched.enabled?"Active":"Disabled"}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <Button size="sm" variant="outline" onClick={triggerNow} disabled={triggering||sched.running} className="border-white/10 text-gray-300 h-7 px-3 text-xs gap-1.5">
              {triggering||sched.running?<Loader2 className="w-3 h-3 animate-spin"/>:<Zap className="w-3 h-3"/>}
              {sched.running?"Running…":"Run Now"}
            </Button>
            <button onClick={toggleScheduler} className={`relative w-10 h-5 rounded-full transition-colors ${sched.enabled?"bg-emerald-500":"bg-white/15"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${sched.enabled?"left-5":"left-0.5"}`}/>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/8">
          {([
            {label:"Last Run", value: sched.lastRun ? new Date(sched.lastRun).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+" · "+new Date(sched.lastRun).toLocaleDateString([],{month:"short",day:"numeric"}) : "Never"},
            {label:"Next Run", value: sched.nextRun ? new Date(sched.nextRun).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+" · "+new Date(sched.nextRun).toLocaleDateString([],{month:"short",day:"numeric"}) : "—"},
            {label:"Added Last Run", value: sched.lastStats?.added ?? "—"},
            {label:"Alive / Checked", value: sched.lastStats ? `${sched.lastStats.alive||0} / ${(sched.lastStats.alive||0)+(sched.lastStats.dead||0)}` : "—"},
          ] as const).map((s:any)=>(
            <div key={s.label} className="px-3 py-2 text-center">
              <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
              <p className="text-xs font-semibold text-white">{String(s.value)}</p>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-white/8 text-xs text-white/25 flex justify-between">
          <span>Sources: ProxyScrape + Geonode (HTTP · HTTPS · SOCKS4 · SOCKS5)</span>
          <span>Every 6 h · 300 checked · 12 concurrent · dead cleared after 48 h</span>
        </div>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Free Proxies Manager</h2>
          <p className="text-sm text-gray-400">Upload, check, and manage your free proxy pool</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={copyAll} disabled={!alive} className="border-white/10 text-gray-400 gap-1.5 text-xs"><Copy className="w-3 h-3"/>Copy Alive</Button>
          <Button size="sm" variant="outline" onClick={deleteDead} disabled={!dead} className="border-red-500/20 text-red-400 hover:bg-red-500/10 gap-1.5 text-xs"><Trash2 className="w-3 h-3"/>Delete Dead ({dead})</Button>
          <Button size="sm" onClick={checkAll} disabled={checking||!proxies.length} className="bg-blue-600 hover:bg-blue-700 gap-1.5 text-xs">
            {checking?<Loader2 className="w-3 h-3 animate-spin"/>:<Zap className="w-3 h-3"/>}{checking?'Checking...':'Check All'}
          </Button>
          <Button size="sm" onClick={()=>setShowImport(v=>!v)} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 text-xs"><Plus className="w-3 h-3"/>Import Proxies</Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[{label:'Total',value:proxies.length,c:'text-white',b:'bg-white/5'},{label:'Alive',value:alive,c:'text-emerald-400',b:'bg-emerald-500/10'},{label:'Dead',value:dead,c:'text-red-400',b:'bg-red-500/10'},{label:'Unchecked',value:unchecked,c:'text-amber-400',b:'bg-amber-500/10'}].map(s=>(
          <div key={s.label} className={`${s.b} border border-white/8 rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${s.c}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Check result banner */}
      {checkResult && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0"/>
          <span className="text-emerald-300">Last check: <strong>{checkResult.checked}</strong> tested — <strong className="text-emerald-400">{checkResult.alive} alive</strong> · <strong className="text-red-400">{checkResult.dead} dead</strong></span>
          <button onClick={()=>setCheckResult(null)} className="ml-auto text-white/30 hover:text-white"><X className="w-4 h-4"/></button>
        </div>
      )}

      {/* Import panel */}
      {showImport && (
        <div className="bg-white/5 border border-emerald-500/20 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-400"/>Bulk Import Proxies</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['HTTP','HTTPS','SOCKS4','SOCKS5'].map(t=>(
              <button key={t} onClick={()=>setProxyType(t)}
                className={`py-2 rounded-xl text-sm font-medium border transition-colors ${proxyType===t?'bg-emerald-500/20 border-emerald-500/30 text-emerald-300':'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}>
                {t}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Paste proxies — one per line</label>
            <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} rows={10}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-green-400 font-mono focus:outline-none focus:border-emerald-500/40"
              placeholder={"192.168.1.1:8080\n10.0.0.1:3128\nuser:pass@192.168.1.2:8080\n192.168.1.3:8080:user:pass"}/>
            <p className="text-xs text-gray-500 mt-1.5">Supported: <code className="text-emerald-400">ip:port</code> · <code className="text-emerald-400">ip:port:user:pass</code> · <code className="text-emerald-400">user:pass@ip:port</code> — <strong className="text-white">{lineCount}</strong> lines ready</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={importProxies} disabled={importing||!bulkText.trim()} className="bg-emerald-600 hover:bg-emerald-700">
              {importing?<Loader2 className="w-4 h-4 animate-spin mr-1"/>:<Plus className="w-4 h-4 mr-1"/>}Import {lineCount>0?lineCount+' Proxies':'Proxies'}
            </Button>
            <Button variant="outline" onClick={()=>{setShowImport(false);setBulkText('');}} className="border-white/10 text-gray-400">Cancel</Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-36">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search IP, country..." className="pl-8 bg-white/5 border-white/10 text-white text-sm h-9"/>
        </div>
        {['all','alive','dead','unchecked'].map(s=>(
          <button key={s} onClick={()=>setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${statusFilter===s?'bg-emerald-500/20 border-emerald-500/30 text-emerald-300':'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
            {s}
          </button>
        ))}
        <Button size="sm" variant="outline" onClick={()=>refetch()} className="border-white/10 text-gray-400 h-9 gap-1.5 text-xs"><RefreshCw className="w-3 h-3"/>Refresh</Button>
      </div>

      {/* Proxy table */}
      {isLoading ? (
        <div className="text-center py-10 text-gray-500">Loading proxies...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 text-gray-500">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-30"/>
          <p>{proxies.length===0?'No proxies yet — import your first batch':'No proxies match the current filter'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-[2.5fr_1fr_1.5fr_1.2fr_1fr_0.8fr_auto] gap-2 px-4 py-2 bg-white/5 border-b border-white/10 text-xs text-white/30 font-medium uppercase tracking-wide">
            <span>Proxy</span><span>Type</span><span>Country</span><span>Anonymity</span><span>Speed</span><span>Status</span><span></span>
          </div>
          <div className="divide-y divide-white/5 max-h-[55vh] overflow-y-auto">
            {filtered.map((p:any) => (
              <div key={p.id} className="grid grid-cols-[2.5fr_1fr_1.5fr_1.2fr_1fr_0.8fr_auto] gap-2 px-4 py-2.5 items-center hover:bg-white/3 transition-colors">
                <code className="text-xs font-mono text-green-400 truncate" title={p.raw}>{p.ip}:{p.port}{p.username?<span className="text-white/20"> [auth]</span>:null}</code>
                <span className="text-xs font-bold text-white/50">{p.type||'HTTP'}</span>
                <span className="text-xs text-white/60 truncate">{p.country_code?COUNTRY_FLAG(p.country_code):''} {p.country||'—'}</span>
                <span className={`text-xs capitalize ${p.anonymity?ANON_COLOR[p.anonymity]||'text-white/40':'text-white/20'}`}>{p.anonymity||'—'}</span>
                <span className="text-xs">
                  {p.speed_ms ? (
                    <span className={`font-medium ${p.speed_ms<1000?'text-emerald-400':p.speed_ms<3000?'text-amber-400':'text-red-400'}`}>{p.speed_ms}ms</span>
                  ) : <span className="text-white/20">—</span>}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLE[p.status]||STATUS_STYLE.unchecked}`}>{p.status}</span>
                <button onClick={()=>deleteOne(p.id)} className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-white/30 transition-colors">
                  <Trash2 className="w-3 h-3"/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Gift Cards Admin Tab ─────────────────────────────────────────────────────
function GiftCardsAdminTab() {
  const { toast } = useToast(); const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const [stockModal, setStockModal] = useState<any>(null); const [stockText, setStockText] = useState("");
  const [stockLoading, setStockLoading] = useState(false);
  const [form, setForm] = useState({name:"",brand:"Google Play",denomination:"",currency:"USD",price_kes:"",description:"",is_active:true,sort_order:"0"});
  const BRANDS = ["Google Play","iTunes","Steam","Amazon","Netflix","Spotify","Xbox","PlayStation","Roblox","Razer Gold","Fortnite","Valorant","Other"];
  const BRAND_EMOJI: Record<string,string> = {"Google Play":"🎮","iTunes":"🍎","Steam":"🎲","Amazon":"📦","Netflix":"🎬","Spotify":"🎵","Xbox":"🟢","PlayStation":"🎯","Roblox":"🟡","Razer Gold":"💚","Fortnite":"🔷","Valorant":"🔴","Other":"🎁"};
  const { data, isLoading, refetch } = useQuery({ queryKey:["/api/admin/gift-card-products"], queryFn:()=>fetch("/api/admin/gift-card-products",{headers:authHeaders() as any}).then(r=>r.json()) });
  const products:any[]=data?.products||[];
  const inp="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/40";
  const reset=()=>{setForm({name:"",brand:"Google Play",denomination:"",currency:"USD",price_kes:"",description:"",is_active:true,sort_order:"0"});setEditing(null);setShowForm(false);};
  const startEdit=(p:any)=>{setForm({name:p.name,brand:p.brand,denomination:p.denomination||"",currency:p.currency||"USD",price_kes:p.price_kes,description:p.description||"",is_active:p.is_active,sort_order:p.sort_order||"0"});setEditing(p);setShowForm(true);};
  const save=useMutation({mutationFn:()=>{ const body={...form,price_kes:parseFloat(form.price_kes as any),sort_order:parseInt(form.sort_order as any)||0}; return fetch(editing?`/api/admin/gift-card-products/${editing.id}`:"/api/admin/gift-card-products",{method:editing?"PUT":"POST",headers:{...authHeaders(),"Content-Type":"application/json"} as any,body:JSON.stringify(body)}).then(r=>r.json()); },onSuccess:(r)=>{if(r.success){toast({title:editing?"Updated":"Created"});queryClient.invalidateQueries({queryKey:["/api/admin/gift-card-products"]});reset();}else toast({title:"Error",description:r.error,variant:"destructive"});},});
  const del=useMutation({mutationFn:(id:number)=>fetch(`/api/admin/gift-card-products/${id}`,{method:"DELETE",headers:authHeaders() as any}).then(r=>r.json()),onSuccess:()=>{toast({title:"Deleted"});queryClient.invalidateQueries({queryKey:["/api/admin/gift-card-products"]});}});
  const addStock=async()=>{if(!stockModal||!stockText.trim())return;setStockLoading(true);try{const r=await fetch(`/api/admin/gift-card-products/${stockModal.id}/stock`,{method:"POST",headers:{...authHeaders(),"Content-Type":"application/json"} as any,body:JSON.stringify({codes:stockText})}).then(r=>r.json());if(r.success){toast({title:`Added ${r.added} codes`});queryClient.invalidateQueries({queryKey:["/api/admin/gift-card-products"]});setStockModal(null);setStockText("");}else toast({title:"Error",description:r.error,variant:"destructive"});}catch{toast({title:"Error",variant:"destructive"});}setStockLoading(false);};
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">Gift Cards</h2><p className="text-sm text-gray-400">Manage gift card products and code inventory</p></div><Button size="sm" onClick={()=>{reset();setShowForm(true);}} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold gap-1.5"><Plus className="w-4 h-4"/>Add Product</Button></div>
      {showForm&&(<div className="bg-white/5 border border-yellow-500/20 rounded-2xl p-5 space-y-3"><h3 className="font-semibold">{editing?"Edit":"New"} Gift Card Product</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-3"><div><label className="text-xs text-gray-400 mb-1 block">Brand</label><select className={inp} value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))}>{BRANDS.map(b=><option key={b} value={b}>{BRAND_EMOJI[b]} {b}</option>)}</select></div><div><label className="text-xs text-gray-400 mb-1 block">Product Name</label><input className={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Google Play $10"/></div><div><label className="text-xs text-gray-400 mb-1 block">Denomination</label><input className={inp} value={form.denomination} onChange={e=>setForm(f=>({...f,denomination:e.target.value}))} placeholder="10"/></div><div><label className="text-xs text-gray-400 mb-1 block">Currency</label><input className={inp} value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} placeholder="USD"/></div><div><label className="text-xs text-gray-400 mb-1 block">Price (KES)</label><input type="number" className={inp} value={form.price_kes} onChange={e=>setForm(f=>({...f,price_kes:e.target.value}))} placeholder="1500"/></div><div><label className="text-xs text-gray-400 mb-1 block">Sort Order</label><input type="number" className={inp} value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:e.target.value}))}/></div><div className="col-span-2 sm:col-span-3"><label className="text-xs text-gray-400 mb-1 block">Description (optional)</label><input className={inp} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Works worldwide, no expiry"/></div><div className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} className="w-4 h-4"/><label className="text-sm text-gray-300">Active</label></div></div><div className="flex gap-2"><Button onClick={()=>save.mutate()} disabled={save.isPending||!form.name||!form.price_kes} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold">{save.isPending?<Loader2 className="w-4 h-4 animate-spin mr-1"/>:null}{editing?"Update":"Create"}</Button><Button variant="outline" onClick={reset} className="border-white/10 text-gray-400">Cancel</Button></div></div>)}
      {isLoading?<div className="text-center py-8 text-gray-500">Loading...</div>:products.length===0?<div className="text-center py-12 text-gray-500"><Gift className="w-8 h-8 mx-auto mb-2 opacity-30"/><p>No products yet</p></div>:(
        <div className="overflow-x-auto rounded-xl border border-white/10"><Table><TableHeader><TableRow className="border-white/10 hover:bg-transparent">{["Brand","Product","Denom","Price KES","Stock","Status","Actions"].map(h=><TableHead key={h} className="text-gray-400 text-xs">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{products.map((p:any)=>(
          <TableRow key={p.id} className="border-white/5 hover:bg-white/3">
            <TableCell className="text-lg">{BRAND_EMOJI[p.brand]||"🎁"} <span className="text-xs text-gray-400">{p.brand}</span></TableCell>
            <TableCell className="text-sm text-white font-medium max-w-32"><p className="truncate">{p.name}</p></TableCell>
            <TableCell className="text-sm text-white/60">{p.denomination} {p.currency}</TableCell>
            <TableCell className="text-sm text-yellow-400 font-bold">KES {(p.price_kes||0).toLocaleString()}</TableCell>
            <TableCell><span className={`text-sm font-bold ${p.stock_count>0?"text-emerald-400":"text-red-400"}`}>{p.stock_count}</span><span className="text-xs text-gray-500 ml-1">/ {p.total_stock}</span></TableCell>
            <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border ${p.is_active?"bg-emerald-500/10 text-emerald-400 border-emerald-500/20":"bg-white/5 text-gray-500 border-white/10"}`}>{p.is_active?"Active":"Hidden"}</span></TableCell>
            <TableCell><div className="flex gap-1.5"><Button size="sm" variant="outline" onClick={()=>{setStockModal(p);setStockText("");}} className="border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/10 h-7 px-2 text-xs"><Plus className="w-3 h-3 mr-1"/>Codes</Button><Button size="sm" variant="outline" onClick={()=>startEdit(p)} className="border-white/10 text-gray-400 h-7 px-2 text-xs"><Edit2 className="w-3 h-3"/></Button><Button size="sm" variant="outline" onClick={()=>{if(confirm("Delete?"))del.mutate(p.id);}} className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-7 px-2 text-xs"><Trash2 className="w-3 h-3"/></Button></div></TableCell>
          </TableRow>
        ))}</TableBody></Table></div>
      )}
      {stockModal&&(<div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget){setStockModal(null);setStockText("");}}}><div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg p-6"><h3 className="font-bold mb-1">Add Gift Card Codes</h3><p className="text-sm text-gray-400 mb-3">{stockModal.name} — Stock: <span className="text-yellow-400 font-bold">{stockModal.stock_count}</span></p><textarea value={stockText} onChange={e=>setStockText(e.target.value)} rows={8} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-yellow-400 font-mono focus:outline-none focus:border-yellow-500/40 mb-3" placeholder={"XXXX-XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY-YYYY\nZZZZ-ZZZZ-ZZZZ-ZZZZ"}/><p className="text-xs text-gray-500 mb-3">{stockText.split('\n').filter(l=>l.trim()).length} codes ready</p><div className="flex gap-2"><Button onClick={addStock} disabled={stockLoading||!stockText.trim()} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold flex-1">{stockLoading?<Loader2 className="w-4 h-4 animate-spin mr-1"/>:<Plus className="w-4 h-4 mr-1"/>}Import Codes</Button><Button variant="outline" onClick={()=>{setStockModal(null);setStockText("");}} className="border-white/10 text-gray-400">Cancel</Button></div></div></div>)}
    </div>
  );
}

// ─── Gift Card Orders Admin Tab ───────────────────────────────────────────────
function GiftCardOrdersAdminTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState(""); const [credView, setCredView] = useState<any>(null); const [copied, setCopied] = useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey:["/api/admin/gift-card-orders"], queryFn:()=>fetch("/api/admin/gift-card-orders",{headers:authHeaders() as any}).then(r=>r.json()), refetchInterval:30000 });
  const orders:any[]=data?.orders||[];
  const filtered=orders.filter(o=>!search||[o.reference,o.product_name,o.brand,o.customer_email].some((v:string)=>(v||"").toLowerCase().includes(search.toLowerCase())));
  const revenue=orders.filter((o:any)=>o.status==="delivered").reduce((s:number,o:any)=>s+(parseFloat(o.amount_kes)||0),0);
  const sCls=(s:string)=>({pending:"text-amber-400 border-amber-500/30 bg-amber-500/10",delivered:"text-emerald-400 border-emerald-500/30 bg-emerald-500/10",failed:"text-red-400 border-red-500/30 bg-red-500/10"}[s]||"text-gray-400 border-gray-500/30 bg-gray-500/10");
  const EMOJI: Record<string,string>={"Google Play":"🎮","iTunes":"🍎","Steam":"🎲","Amazon":"📦","Netflix":"🎬","Spotify":"🎵","Xbox":"🟢","PlayStation":"🎯","Roblox":"🟡","Other":"🎁"};
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">Gift Card Orders</h2><p className="text-sm text-gray-400">All gift card purchases and code deliveries</p></div><Button size="sm" variant="outline" onClick={()=>refetch()} className="border-white/10 text-gray-400 gap-1.5"><RefreshCw className="w-3.5 h-3.5"/>Refresh</Button></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[{label:"Total",value:orders.length,c:"text-white"},{label:"Delivered",value:orders.filter((o:any)=>o.status==="delivered").length,c:"text-emerald-400"},{label:"Pending",value:orders.filter((o:any)=>o.status==="pending").length,c:"text-amber-400"},{label:"Revenue",value:`KES ${revenue.toLocaleString()}`,c:"text-yellow-400"}].map(s=>(<div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-xs text-gray-400 mb-1">{s.label}</p><p className={`text-xl font-bold ${s.c}`}>{s.value}</p></div>))}</div>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search orders..." className="pl-8 bg-white/5 border-white/10 text-white text-sm h-9"/></div>
      {isLoading?<div className="text-center py-8 text-gray-500">Loading...</div>:filtered.length===0?<div className="text-center py-10 text-gray-500"><Gift className="w-8 h-8 mx-auto mb-2 opacity-30"/><p>No orders</p></div>:(
        <div className="overflow-x-auto rounded-xl border border-white/10"><Table><TableHeader><TableRow className="border-white/10 hover:bg-transparent">{["Ref","Brand","Product","Customer","Amount","Status","Code"].map(h=><TableHead key={h} className="text-gray-400 text-xs">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{filtered.map((o:any)=>(
          <TableRow key={o.id} className="border-white/5 hover:bg-white/3">
            <TableCell className="font-mono text-xs text-gray-300">{(o.reference||"").slice(0,12)}…</TableCell>
            <TableCell className="text-base">{EMOJI[o.brand]||"🎁"} <span className="text-xs text-gray-400">{o.brand}</span></TableCell>
            <TableCell className="text-xs text-white max-w-28"><p className="truncate">{o.product_name}</p></TableCell>
            <TableCell className="text-xs text-gray-400">{o.customer_email}</TableCell>
            <TableCell className="text-sm text-yellow-400 font-medium">KES {parseFloat(o.amount_kes||0).toLocaleString()}</TableCell>
            <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${sCls(o.status)}`}>{o.status}</span></TableCell>
            <TableCell>{o.code?<Button size="sm" variant="outline" onClick={()=>setCredView(o)} className="border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/10 h-7 px-2 text-xs"><Eye className="w-3 h-3"/></Button>:<span className="text-xs text-gray-600">—</span>}</TableCell>
          </TableRow>
        ))}</TableBody></Table></div>
      )}
      {credView&&(<div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)setCredView(null);}}><div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm p-6"><h3 className="font-bold mb-1">Delivered Code</h3><p className="text-sm text-gray-400 mb-4">{credView.customer_email} — {credView.product_name}</p><div className="bg-black/40 border border-white/10 rounded-xl p-4 text-xl font-mono font-bold text-yellow-400 text-center tracking-widest mb-4">{credView.code}</div><div className="flex gap-2"><Button onClick={()=>{navigator.clipboard.writeText(credView.code);setCopied(true);setTimeout(()=>setCopied(false),2000);}} className="flex-1 bg-white/5 border border-white/10 text-white/70 text-sm">{copied?<Check className="w-4 h-4 text-green-400 mr-1"/>:<Copy className="w-4 h-4 mr-1"/>}Copy</Button><Button onClick={()=>setCredView(null)} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-sm">Close</Button></div></div></div>)}
    </div>
  );
}

// ─── SMS Plans Admin Tab ──────────────────────────────────────────────────────
function SmsPlansAdminTab() {
  const { toast } = useToast(); const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({name:"",sms_count:"",price_kes:"",description:"",features:"",is_active:true,sort_order:"0",validity_days:"30"});
  const { data, isLoading } = useQuery({ queryKey:["/api/admin/sms-plans"], queryFn:()=>fetch("/api/admin/sms-plans",{headers:authHeaders() as any}).then(r=>r.json()) });
  const plans:any[]=data?.plans||[];
  const inp="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500/40";
  const reset=()=>{setForm({name:"",sms_count:"",price_kes:"",description:"",features:"",is_active:true,sort_order:"0",validity_days:"30"});setEditing(null);setShowForm(false);};
  const startEdit=(p:any)=>{setForm({name:p.name,sms_count:p.sms_count,price_kes:p.price_kes,description:p.description||"",features:p.features||"",is_active:p.is_active,sort_order:p.sort_order||"0",validity_days:p.validity_days||"30"});setEditing(p);setShowForm(true);};
  const save=useMutation({mutationFn:()=>fetch(editing?`/api/admin/sms-plans/${editing.id}`:"/api/admin/sms-plans",{method:editing?"PUT":"POST",headers:{...authHeaders(),"Content-Type":"application/json"} as any,body:JSON.stringify({...form,sms_count:parseInt(form.sms_count as any),price_kes:parseFloat(form.price_kes as any),sort_order:parseInt(form.sort_order as any)||0,validity_days:parseInt(form.validity_days as any)||30})}).then(r=>r.json()),onSuccess:(r)=>{if(r.success){toast({title:editing?"Updated":"Created"});queryClient.invalidateQueries({queryKey:["/api/admin/sms-plans"]});reset();}else toast({title:"Error",description:r.error,variant:"destructive"});},});
  const del=useMutation({mutationFn:(id:number)=>fetch(`/api/admin/sms-plans/${id}`,{method:"DELETE",headers:authHeaders() as any}).then(r=>r.json()),onSuccess:()=>{toast({title:"Deleted"});queryClient.invalidateQueries({queryKey:["/api/admin/sms-plans"]});}});
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">Bulk SMS Plans</h2><p className="text-sm text-gray-400">Manage SMS credit packages for customers</p></div><Button size="sm" onClick={()=>{reset();setShowForm(true);}} className="bg-green-600 hover:bg-green-700 gap-1.5"><Plus className="w-4 h-4"/>Add Plan</Button></div>
      {showForm&&(<div className="bg-white/5 border border-green-500/20 rounded-2xl p-5 space-y-3"><h3 className="font-semibold">{editing?"Edit":"New"} SMS Plan</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-3"><div><label className="text-xs text-gray-400 mb-1 block">Plan Name</label><input className={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Starter 1000"/></div><div><label className="text-xs text-gray-400 mb-1 block">SMS Count</label><input type="number" className={inp} value={form.sms_count} onChange={e=>setForm(f=>({...f,sms_count:e.target.value}))} placeholder="1000"/></div><div><label className="text-xs text-gray-400 mb-1 block">Price (KES)</label><input type="number" className={inp} value={form.price_kes} onChange={e=>setForm(f=>({...f,price_kes:e.target.value}))} placeholder="500"/></div><div><label className="text-xs text-gray-400 mb-1 block">Validity (days)</label><input type="number" className={inp} value={form.validity_days} onChange={e=>setForm(f=>({...f,validity_days:e.target.value}))}/></div><div><label className="text-xs text-gray-400 mb-1 block">Sort Order</label><input type="number" className={inp} value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:e.target.value}))}/></div><div className="flex items-center gap-2 self-end pb-2"><input type="checkbox" checked={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))} className="w-4 h-4"/><label className="text-sm text-gray-300">Active</label></div><div className="col-span-2 sm:col-span-3"><label className="text-xs text-gray-400 mb-1 block">Description</label><input className={inp} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Great for small businesses"/></div><div className="col-span-2 sm:col-span-3"><label className="text-xs text-gray-400 mb-1 block">Features (one per line)</label><textarea className={inp} rows={3} value={form.features} onChange={e=>setForm(f=>({...f,features:e.target.value}))} placeholder={"Custom sender ID\nDelivery reports\nAPI access"}/></div></div><div className="flex gap-2"><Button onClick={()=>save.mutate()} disabled={save.isPending||!form.name||!form.sms_count||!form.price_kes} className="bg-green-600 hover:bg-green-700">{save.isPending?<Loader2 className="w-4 h-4 animate-spin mr-1"/>:null}{editing?"Update":"Create"}</Button><Button variant="outline" onClick={reset} className="border-white/10 text-gray-400">Cancel</Button></div></div>)}
      {isLoading?<div className="text-center py-8 text-gray-500">Loading...</div>:plans.length===0?<div className="text-center py-12 text-gray-500"><MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30"/><p>No SMS plans yet</p></div>:(
        <div className="overflow-x-auto rounded-xl border border-white/10"><Table><TableHeader><TableRow className="border-white/10 hover:bg-transparent">{["Name","SMS Count","Price KES","Per SMS","Validity","Status","Actions"].map(h=><TableHead key={h} className="text-gray-400 text-xs">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{plans.map((p:any)=>(
          <TableRow key={p.id} className="border-white/5 hover:bg-white/3">
            <TableCell className="text-sm text-white font-medium">{p.name}</TableCell>
            <TableCell className="text-lg font-bold text-green-400">{(p.sms_count||0).toLocaleString()}</TableCell>
            <TableCell className="text-sm text-yellow-400 font-medium">KES {(p.price_kes||0).toLocaleString()}</TableCell>
            <TableCell className="text-xs text-white/50">KES {((p.price_kes||0)/(p.sms_count||1)).toFixed(2)}</TableCell>
            <TableCell className="text-xs text-white/50">{p.validity_days||30} days</TableCell>
            <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border ${p.is_active?"bg-emerald-500/10 text-emerald-400 border-emerald-500/20":"bg-white/5 text-gray-500 border-white/10"}`}>{p.is_active?"Active":"Hidden"}</span></TableCell>
            <TableCell><div className="flex gap-1.5"><Button size="sm" variant="outline" onClick={()=>startEdit(p)} className="border-white/10 text-gray-400 h-7 px-2 text-xs"><Edit2 className="w-3 h-3"/></Button><Button size="sm" variant="outline" onClick={()=>{if(confirm("Delete?"))del.mutate(p.id);}} className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-7 px-2 text-xs"><Trash2 className="w-3 h-3"/></Button></div></TableCell>
          </TableRow>
        ))}</TableBody></Table></div>
      )}
    </div>
  );
}


// ─── Bulk CC Checker Admin Tab ──────────────────────────────────────────────
function luhnValid(num: string): boolean {
  const digits = num.replace(/\D/g, '').split('').reverse().map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i];
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

const EG_DOMAINS = ['yopmail.com','guerrillamail.com','mailsac.com','sharklasers.com','throwam.com','trashmail.com','spamoff.de','maildrop.cc','dispostable.com','10minutemail.com'];
const EG_WORDS = ['alpha','beta','delta','echo','foxtrot','gamma','hotel','india','juliet','kilo','lima','mike','nova','oscar','papa','quebec','romeo','sierra','tango','ultra'];
const EG_NAMES = ['alex','blake','casey','drew','elliot','finley','gray','harper','indigo','jordan','kendall','lane','morgan','noel','ocean','parker','quinn','river','sage','taylor'];

type CcResult = { card: string; status: 'Live'|'Dead'; bank?: string; cardType?: string; country?: string; flag?: string; message?: string };

function BulkCcCheckerAdminTab() {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<CcResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sessionChecked, setSessionChecked] = useState(0);

  const live = results.filter(r => r.status === 'Live');
  const dead = results.filter(r => r.status === 'Dead');

  async function checkAll() {
    const lines = input.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 50);
    if (!lines.length) return toast({ title: 'No cards', description: 'Paste at least one card', variant: 'destructive' });
    setLoading(true); setResults([]); setProgress(0);
    const parsed = lines.map(line => {
      const [num, mm, yy, cvv] = line.split('|');
      return { raw: line, num: (num || '').replace(/\D/g, ''), mm, yy, cvv };
    });
    const uniqueBins = [...new Set(parsed.filter(c => c.num.length >= 6).map(c => c.num.slice(0, 6)))];
    let binData: Record<string, any> = {};
    try {
      const r = await fetch('https://bins.antipublic.cc/bins/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uniqueBins)
      });
      if (r.ok) {
        const arr: any[] = await r.json();
        arr.forEach((b: any) => { if (b?.bin) binData[b.bin] = b; });
      }
    } catch {}
    const out: CcResult[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const c = parsed[i];
      if (!luhnValid(c.num)) {
        out.push({ card: c.raw, status: 'Dead', message: 'Luhn failed' });
      } else {
        const b = binData[c.num.slice(0, 6)] || binData[c.num.slice(0, 8)];
        if (b) {
          const cc = b.country_code || '';
          const flag = cc ? String.fromCodePoint(...[...cc].map((ch: string) => ch.charCodeAt(0) + 127397)) : '';
          out.push({ card: c.raw, status: 'Live', bank: b.bank || 'Unknown', cardType: [b.scheme, b.type, b.level].filter(Boolean).join(' '), country: b.country_name || cc, flag });
        } else {
          out.push({ card: c.raw, status: 'Live', bank: 'Unknown BIN', cardType: 'Unknown' });
        }
      }
      setProgress(Math.round(((i + 1) / parsed.length) * 100));
    }
    setResults(out); setSessionChecked(p => p + out.length); setLoading(false);
  }

  function downloadLive() {
    const txt = live.map(r => r.card).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = 'live_cards.txt'; a.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-white">CC Bulk Checker</h2><p className="text-sm text-gray-400">Validate up to 50 cards — Luhn + BIN lookup</p></div>
        {sessionChecked > 0 && <span className="text-xs text-gray-500">Session: {sessionChecked} checked</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[{label:'Checked',value:results.length,c:'text-white'},{label:'Live',value:live.length,c:'text-emerald-400'},{label:'Dead',value:dead.length,c:'text-red-400'}].map(s=>(
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center"><p className="text-xs text-gray-400 mb-1">{s.label}</p><p className={`text-2xl font-bold ${s.c}`}>{s.value}</p></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-medium text-gray-300">Paste Cards <span className="text-xs text-gray-500">(number|mm|yy|cvv · one per line · max 50)</span></p>
          <textarea value={input} onChange={e=>setInput(e.target.value)} rows={12} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-green-400 font-mono focus:outline-none focus:border-green-500/40 resize-none" placeholder="4532015112830366|12|27|123" />
          <Button onClick={checkAll} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2"/>Checking… {progress}%</> : <><CreditCard className="w-4 h-4 mr-2"/>Check All</>}
          </Button>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-300">Results</p>
            {live.length > 0 && <Button size="sm" variant="outline" onClick={downloadLive} className="border-white/10 text-gray-400 h-7 px-2 text-xs gap-1"><Download className="w-3 h-3"/>Live</Button>}
          </div>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-600"><CreditCard className="w-10 h-10 mb-2 opacity-30"/><p className="text-sm">Paste cards and click Check All</p></div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {results.map((r, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 border ${r.status==='Live'?'bg-emerald-500/5 border-emerald-500/20':'bg-red-500/5 border-red-500/15'}`}>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded mt-0.5 ${r.status==='Live'?'bg-emerald-500/20 text-emerald-400':'bg-red-500/20 text-red-400'}`}>{r.status}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-white/80 truncate">{r.card}</p>
                    <p className="text-xs text-gray-400">{r.flag} {r.bank}{r.cardType?' · '+r.cardType:''}{r.country?' · '+r.country:''}{r.message?' · '+r.message:''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Email Generator Admin Tab ────────────────────────────────────────────────
function EmailGenAdminTab() {
  const { toast } = useToast();
  const [count, setCount] = useState(20);
  const [domain, setDomain] = useState('random');
  const [format, setFormat] = useState('name_num');
  const [emails, setEmails] = useState<string[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);

  function rnd(n: number) { return Math.floor(Math.random() * n); }
  function uid() { return Math.random().toString(36).slice(2, 9); }

  function genEmail(d: string, f: string): string {
    const domains = d === 'random' ? EG_DOMAINS : [d];
    const pick = domains[rnd(domains.length)];
    let user = '';
    if (f === 'name_num') user = EG_NAMES[rnd(EG_NAMES.length)] + (100 + rnd(9900));
    else if (f === 'word_word') user = EG_WORDS[rnd(EG_WORDS.length)] + EG_WORDS[rnd(EG_WORDS.length)] + rnd(99);
    else user = uid();
    return user + '@' + pick;
  }

  function generate() {
    const n = Math.min(Math.max(1, count), 100);
    const list = Array.from({ length: n }, () => genEmail(domain, format));
    setEmails(list); setSessionTotal(p => p + list.length);
  }

  function copyAll() { navigator.clipboard.writeText(emails.join('\n')); toast({ title: 'Copied!', description: emails.length + ' emails copied' }); }
  function download() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([emails.join('\n')], { type: 'text/plain' }));
    a.download = 'emails.txt'; a.click();
  }
  function copyOne(e: string) { navigator.clipboard.writeText(e); toast({ title: 'Copied', description: e }); }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-white">Email Generator</h2><p className="text-sm text-gray-400">Generate up to 100 disposable addresses</p></div>
        {sessionTotal > 0 && <span className="text-xs text-gray-500">Session: {sessionTotal} generated</span>}
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Count (max 100)</label>
            <Input type="number" min={1} max={100} value={count} onChange={e=>setCount(Number(e.target.value))} className="bg-black/40 border-white/10 text-white h-9"/>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Domain</label>
            <select value={domain} onChange={e=>setDomain(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 h-9 text-sm text-white focus:outline-none focus:border-green-500/40">
              <option value="random">Random mix</option>
              {EG_DOMAINS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Format</label>
            <select value={format} onChange={e=>setFormat(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 h-9 text-sm text-white focus:outline-none focus:border-green-500/40">
              <option value="name_num">name + numbers</option>
              <option value="word_word">word + word</option>
              <option value="random">random chars</option>
            </select>
          </div>
        </div>
        <Button onClick={generate} className="w-full bg-green-600 hover:bg-green-700"><Mail className="w-4 h-4 mr-2"/>Generate</Button>
      </div>
      {emails.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-300">{emails.length} emails generated</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyAll} className="border-white/10 text-gray-400 h-7 px-2 text-xs gap-1"><Copy className="w-3 h-3"/>Copy All</Button>
              <Button size="sm" variant="outline" onClick={download} className="border-white/10 text-gray-400 h-7 px-2 text-xs gap-1"><Download className="w-3 h-3"/>Download</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
            {emails.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-2 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-1.5 group">
                <span className="text-xs font-mono text-green-400 truncate">{e}</span>
                <button onClick={()=>copyOne(e)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white"><Copy className="w-3 h-3"/></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SMS Orders Admin Tab ─────────────────────────────────────────────────────
function SmsOrdersAdminTab() {
  const { toast } = useToast(); const queryClient = useQueryClient();
  const [search, setSearch] = useState(""); const [fulfillModal, setFulfillModal] = useState<any>(null); const [notes, setNotes] = useState(""); const [fulfilling, setFulfilling] = useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey:["/api/admin/sms-orders"], queryFn:()=>fetch("/api/admin/sms-orders",{headers:authHeaders() as any}).then(r=>r.json()), refetchInterval:30000 });
  const orders:any[]=data?.orders||[];
  const filtered=orders.filter(o=>!search||[o.reference,o.plan_name,o.customer_email].some((v:string)=>(v||"").toLowerCase().includes(search.toLowerCase())));
  const revenue=orders.filter((o:any)=>o.status==="fulfilled").reduce((s:number,o:any)=>s+(parseFloat(o.amount_kes)||0),0);
  const sCls=(s:string)=>({pending:"text-amber-400 border-amber-500/30 bg-amber-500/10",fulfilled:"text-emerald-400 border-emerald-500/30 bg-emerald-500/10",failed:"text-red-400 border-red-500/30 bg-red-500/10"}[s]||"text-gray-400 border-gray-500/30 bg-gray-500/10");
  const fulfill=async()=>{if(!fulfillModal)return;setFulfilling(true);try{const r=await fetch(`/api/admin/sms-orders/${fulfillModal.id}/fulfill`,{method:"PATCH",headers:{...authHeaders(),"Content-Type":"application/json"} as any,body:JSON.stringify({notes})}).then(r=>r.json());if(r.success){toast({title:"Order fulfilled"});queryClient.invalidateQueries({queryKey:["/api/admin/sms-orders"]});setFulfillModal(null);setNotes("");}else toast({title:"Error",description:r.error,variant:"destructive"});}catch{toast({title:"Error",variant:"destructive"});}setFulfilling(false);};
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">SMS Orders</h2><p className="text-sm text-gray-400">Manage bulk SMS purchases and fulfillment</p></div><Button size="sm" variant="outline" onClick={()=>refetch()} className="border-white/10 text-gray-400 gap-1.5"><RefreshCw className="w-3.5 h-3.5"/>Refresh</Button></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[{label:"Total",value:orders.length,c:"text-white"},{label:"Fulfilled",value:orders.filter((o:any)=>o.status==="fulfilled").length,c:"text-emerald-400"},{label:"Pending",value:orders.filter((o:any)=>o.status==="pending").length,c:"text-amber-400"},{label:"Revenue",value:`KES ${revenue.toLocaleString()}`,c:"text-green-400"}].map(s=>(<div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-xs text-gray-400 mb-1">{s.label}</p><p className={`text-xl font-bold ${s.c}`}>{s.value}</p></div>))}</div>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="pl-8 bg-white/5 border-white/10 text-white text-sm h-9"/></div>
      {isLoading?<div className="text-center py-8 text-gray-500">Loading...</div>:filtered.length===0?<div className="text-center py-10 text-gray-500"><MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30"/><p>No orders</p></div>:(
        <div className="overflow-x-auto rounded-xl border border-white/10"><Table><TableHeader><TableRow className="border-white/10 hover:bg-transparent">{["Reference","Plan","SMS","Customer","Sender ID","Amount","Status","Action"].map(h=><TableHead key={h} className="text-gray-400 text-xs">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{filtered.map((o:any)=>(
          <TableRow key={o.id} className="border-white/5 hover:bg-white/3">
            <TableCell className="font-mono text-xs text-gray-300">{(o.reference||"").slice(0,12)}…</TableCell>
            <TableCell className="text-sm text-white font-medium">{o.plan_name}</TableCell>
            <TableCell className="text-sm text-green-400 font-bold">{(o.sms_count||0).toLocaleString()}</TableCell>
            <TableCell className="text-xs text-gray-400">{o.customer_email}</TableCell>
            <TableCell className="text-xs text-white/50">{o.sender_note||"—"}</TableCell>
            <TableCell className="text-sm text-yellow-400 font-medium">KES {parseFloat(o.amount_kes||0).toLocaleString()}</TableCell>
            <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${sCls(o.status)}`}>{o.status}</span></TableCell>
            <TableCell>{o.status!=="fulfilled"&&<Button size="sm" onClick={()=>{setFulfillModal(o);setNotes(o.notes||"");}} className="bg-green-600 hover:bg-green-700 h-7 px-2 text-xs">Fulfill</Button>}</TableCell>
          </TableRow>
        ))}</TableBody></Table></div>
      )}
      {fulfillModal&&(<div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget){setFulfillModal(null);setNotes("");}}}><div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6"><h3 className="font-bold mb-1">Fulfill SMS Order</h3><p className="text-sm text-gray-400 mb-4">{fulfillModal.customer_email} — {fulfillModal.sms_count?.toLocaleString()} SMS</p>{fulfillModal.sender_note&&<p className="text-xs text-white/50 mb-3">Requested sender ID: <span className="text-green-400 font-medium">{fulfillModal.sender_note}</span></p>}<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500/40 mb-4" placeholder="Add notes (API credentials, login details, etc.)"/><div className="flex gap-2"><Button onClick={fulfill} disabled={fulfilling} className="flex-1 bg-green-600 hover:bg-green-700">{fulfilling?<Loader2 className="w-4 h-4 animate-spin mr-1"/>:null}Mark Fulfilled</Button><Button variant="outline" onClick={()=>{setFulfillModal(null);setNotes("");}} className="flex-1 border-white/10 text-gray-400">Cancel</Button></div></div></div>)}
    </div>
  );
}



// ─── ChegeBot Pro Subscriptions Admin Tab ─────────────────────────────────────
function ChegeBotSubsAdminTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [grantModal, setGrantModal] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantPlan, setGrantPlan] = useState("monthly");
  const [grantDays, setGrantDays] = useState(30);
  const [granting, setGranting] = useState(false);
  const [editingPlans, setEditingPlans] = useState(false);
  const [planDraft, setPlanDraft] = useState<any[]>([]);
  const [savingPlans, setSavingPlans] = useState(false);
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/tradingbot/stats"],
    queryFn: () => authFetch("/api/admin/tradingbot/stats"),
    staleTime: 30000,
  });

  const { data: subData, isLoading: subsLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/tradingbot/subscriptions", search, statusFilter],
    queryFn: () => authFetch(`/api/admin/tradingbot/subscriptions?search=${encodeURIComponent(search)}&status=${statusFilter}`),
    staleTime: 15000,
  });

  const { data: plansData, refetch: refetchPlans } = useQuery<any>({
    queryKey: ["/api/admin/tradingbot/plans-config"],
    queryFn: () => authFetch("/api/admin/tradingbot/plans-config"),
    staleTime: 60000,
  });

  const livePlans: any[] = plansData?.plans ?? [];

  function startEditPlans() {
    setPlanDraft(livePlans.map(p => ({ ...p })));
    setEditingPlans(true);
  }

  function updateDraftPlan(id: string, field: string, value: any) {
    setPlanDraft(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  async function savePlans() {
    setSavingPlans(true);
    const r = await authFetch("/api/admin/tradingbot/plans-config", {
      method: "PUT",
      body: JSON.stringify({ plans: planDraft }),
    });
    setSavingPlans(false);
    if (r.success) {
      toast({ title: "Plans updated", description: "New prices are live immediately" });
      setEditingPlans(false);
      refetchPlans();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tradingbot/stats"] });
    } else {
      toast({ title: "Error", description: r.error, variant: "destructive" });
    }
  }

  const subs: any[] = subData?.subscriptions ?? [];

  async function handleRevoke(id: number) {
    if (!confirm("Revoke this subscription?")) return;
    const r = await authFetch(`/api/admin/tradingbot/revoke/${id}`, { method: "POST" });
    if (r.success) { toast({ title: "Subscription revoked" }); refetch(); }
    else toast({ title: "Error", description: r.error, variant: "destructive" });
  }

  async function handleActivate(id: number) {
    const r = await authFetch(`/api/admin/tradingbot/activate/${id}`, { method: "POST" });
    if (r.success) { toast({ title: "Subscription activated" }); refetch(); }
    else toast({ title: "Error", description: r.error, variant: "destructive" });
  }

  async function handleGrant() {
    if (!grantEmail.trim()) return;
    setGranting(true);
    const r = await authFetch("/api/admin/tradingbot/grant", {
      method: "POST",
      body: JSON.stringify({ email: grantEmail.trim(), plan: grantPlan, days: grantDays }),
    });
    setGranting(false);
    if (r.success) {
      toast({ title: "Access granted", description: `${grantEmail} now has ${grantPlan} access` });
      setGrantModal(false); setGrantEmail(""); refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tradingbot/stats"] });
    } else {
      toast({ title: "Error", description: r.error, variant: "destructive" });
    }
  }

  const planBadge: Record<string, string> = {
    monthly:   "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    quarterly: "bg-green-500/15 text-green-400 border border-green-500/20",
    lifetime:  "bg-purple-500/15 text-purple-400 border border-purple-500/20",
  };
  const statusBadge: Record<string, string> = {
    active:  "bg-green-500/15 text-green-400",
    pending: "bg-yellow-500/15 text-yellow-400",
    revoked: "bg-red-500/15 text-red-400",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center">
            <Zap className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">ChegeBot Pro Subscriptions</h2>
            <p className="text-sm text-gray-400">Manage trading bot subscribers</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={startEditPlans}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-xl transition-all">
            <Pencil className="w-4 h-4" /> Edit Plans
          </button>
          <button onClick={() => setGrantModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-green-900/20">
            <Plus className="w-4 h-4" /> Grant Access
          </button>
        </div>
      </div>

      {/* ── Plans & Pricing Editor ─────────────────────────────────────────── */}
      {editingPlans && (
        <div className="rounded-2xl bg-white/[0.03] border border-green-500/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tags className="w-4 h-4 text-green-400" />
              <span className="font-semibold">Edit Plans & Pricing</span>
              <span className="text-xs text-gray-500 ml-1">Changes go live immediately</span>
            </div>
            <button onClick={() => setEditingPlans(false)} className="text-gray-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {planDraft.map(p => (
              <div key={p.id} className="rounded-xl bg-black/40 border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${planBadge[p.id] ?? "bg-gray-500/15 text-gray-400 border border-gray-500/20"}`}>{p.id}</span>
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={!!p.popular} onChange={e => updateDraftPlan(p.id, "popular", e.target.checked)}
                      className="accent-green-500" />
                    Popular
                  </label>
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">Label</label>
                  <input value={p.label} onChange={e => updateDraftPlan(p.id, "label", e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 h-9 text-sm text-white focus:outline-none focus:border-green-500/40" />
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">Price (KES)</label>
                  <input type="number" min={0} value={p.price} onChange={e => updateDraftPlan(p.id, "price", parseInt(e.target.value) || 0)}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 h-9 text-sm text-white focus:outline-none focus:border-green-500/40 font-mono" />
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">Duration (days, blank = lifetime)</label>
                  <input type="number" min={1} value={p.durationDays ?? ""} placeholder="∞ lifetime"
                    onChange={e => updateDraftPlan(p.id, "durationDays", e.target.value === "" ? null : parseInt(e.target.value) || null)}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 h-9 text-sm text-white focus:outline-none focus:border-green-500/40 font-mono placeholder:text-gray-600" />
                </div>

                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">Badge text (optional)</label>
                  <input value={p.badge ?? ""} placeholder="e.g. Save 20%" onChange={e => updateDraftPlan(p.id, "badge", e.target.value || null)}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 h-9 text-sm text-white focus:outline-none focus:border-green-500/40 placeholder:text-gray-600" />
                </div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="border-t border-white/5 pt-4">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide font-medium">Preview</p>
            <div className="flex flex-wrap gap-3">
              {planDraft.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5">
                  <span className={planBadge[p.id] ? `px-2 py-0.5 rounded-md text-xs font-medium ${planBadge[p.id]}` : "text-sm font-semibold"}>{p.label}</span>
                  <span className="font-bold">KES {p.price.toLocaleString()}</span>
                  <span className="text-xs text-gray-500">{p.durationDays ? p.durationDays + "d" : "lifetime"}</span>
                  {p.badge && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">{p.badge}</span>}
                  {p.popular && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Popular</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setEditingPlans(false)} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
            <button onClick={savePlans} disabled={savingPlans}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-sm font-semibold transition-all">
              {savingPlans ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingPlans ? "Saving…" : "Save Plans"}
            </button>
          </div>
        </div>
      )}

      {/* ── Current Plans (read-only when not editing) ─────────────────────── */}
      {!editingPlans && livePlans.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {livePlans.map((p: any) => (
            <div key={p.id} className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 flex items-center justify-between">
              <div>
                <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium mb-1 ${planBadge[p.id] ?? "bg-gray-500/15 text-gray-400 border border-gray-500/20"}`}>{p.label}</span>
                <p className="text-xl font-bold">KES {(p.price ?? 0).toLocaleString()}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{p.durationDays ? p.durationDays + " days" : "lifetime"}{p.badge ? " · " + p.badge : ""}</p>
              </div>
              <button onClick={startEditPlans} className="text-gray-600 hover:text-gray-300 transition-colors" title="Edit">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statsLoading ? (
          [...Array(4)].map((_,i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5 animate-pulse h-24" />
          ))
        ) : ([
          { label: "Total Revenue", value: `KES ${(stats?.totalRevenue ?? 0).toLocaleString()}`, icon: TrendingUp, color: "text-green-400", sub: "all time" },
          { label: "Active Subs",   value: stats?.activeSubs ?? 0,    icon: CheckCircle, color: "text-green-400", sub: `of ${stats?.totalSubs ?? 0} total` },
          { label: "This Month",    value: `KES ${(stats?.monthRevenue ?? 0).toLocaleString()}`, icon: BarChart2, color: "text-blue-400", sub: `${stats?.monthCount ?? 0} new` },
          { label: "Lifetime",      value: stats?.lifetimeSubs ?? 0,  icon: Star, color: "text-purple-400", sub: `${stats?.quarterlySubs ?? 0} quarterly` },
        ]).map(s => (
          <div key={s.label} className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5">
            <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500">{s.label}</span><s.icon className="w-3.5 h-3.5 text-gray-600" /></div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-gray-500 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Plan breakdown */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { plan: "monthly",   label: "Monthly",   count: stats.monthlySubs,   revenue: stats.monthlyRevenue,   price: livePlans.find((p:any)=>p.id==="monthly")?.price   ?? 500  },
            { plan: "quarterly", label: "Quarterly", count: stats.quarterlySubs, revenue: stats.quarterlyRevenue, price: livePlans.find((p:any)=>p.id==="quarterly")?.price ?? 1200 },
            { plan: "lifetime",  label: "Lifetime",  count: stats.lifetimeSubs,  revenue: stats.lifetimeRevenue,  price: livePlans.find((p:any)=>p.id==="lifetime")?.price  ?? 5000 },
          ].map(p => (
            <div key={p.plan} className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4">
              <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium mb-2 ${planBadge[p.plan]}`}>{p.label}</span>
              <p className="text-xl font-bold">{p.count ?? 0}</p>
              <p className="text-[11px] text-gray-500">KES {(p.revenue ?? 0).toLocaleString()} · KES {p.price}/sub</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email or reference…"
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 h-10 text-sm text-white focus:outline-none focus:border-green-500/40" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-xl px-3 h-10 text-sm text-white focus:outline-none focus:border-green-500/40">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="revoked">Revoked</option>
        </select>
        <button onClick={() => refetch()} title="Refresh"
          className="h-10 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Subscribers Table */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
        {subsLoading ? (
          <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-gray-500 mx-auto" /></div>
        ) : subs.length === 0 ? (
          <div className="p-12 text-center">
            <Zap className="w-10 h-10 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500">No subscriptions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.06]">
                <tr className="text-gray-500 text-xs">
                  {["ID","Customer","Plan","Amount","Status","Started","Expires","Reference","Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map((sub: any) => {
                  const expired = sub.expires_at && new Date(sub.expires_at) < new Date();
                  const effectiveStatus = sub.status === "active" && expired ? "expired" : sub.status;
                  return (
                    <tr key={sub.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{sub.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{sub.customer_name || "—"}</div>
                        <div className="text-xs text-gray-400">{sub.customer_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${planBadge[sub.plan] ?? "bg-gray-500/15 text-gray-400"}`}>
                          {sub.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-white">KES {(sub.amount ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${effectiveStatus === "expired" ? "bg-orange-500/15 text-orange-400" : statusBadge[effectiveStatus] ?? "bg-gray-500/15 text-gray-400"}`}>
                          {effectiveStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{sub.created_at ? new Date(sub.created_at).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : <span className="text-purple-400">Never</span>}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{sub.paystack_reference?.slice(0,16)}…</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {sub.status !== "active" && (
                            <button onClick={() => handleActivate(sub.id)}
                              className="px-2.5 py-1 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 text-xs font-medium transition-colors whitespace-nowrap">
                              Activate
                            </button>
                          )}
                          {sub.status === "active" && (
                            <button onClick={() => handleRevoke(sub.id)}
                              className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-medium transition-colors whitespace-nowrap">
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-600 text-right">{subs.length} result{subs.length !== 1 ? "s" : ""}</p>

      {/* Grant Modal */}
      {grantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setGrantModal(false)}>
          <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Grant Free Access</h3>
              <button onClick={() => setGrantModal(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Customer Email</label>
                <input value={grantEmail} onChange={e => setGrantEmail(e.target.value)} placeholder="customer@email.com"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 h-10 text-sm text-white focus:outline-none focus:border-green-500/40" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Plan</label>
                  <select value={grantPlan} onChange={e => setGrantPlan(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 h-10 text-sm text-white focus:outline-none focus:border-green-500/40">
                    {livePlans.map((p: any) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Duration (days, 0=∞)</label>
                  <input type="number" value={grantDays} onChange={e => setGrantDays(Number(e.target.value))} min={0}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 h-10 text-sm text-white focus:outline-none focus:border-green-500/40" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setGrantModal(false)} className="flex-1 h-10 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
              <button onClick={handleGrant} disabled={granting || !grantEmail.trim()}
                className="flex-1 h-10 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
                {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {granting ? "Granting…" : "Grant Access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PO TOKEN INSTRUCTIONS COMPONENT
// ═══════════════════════════════════════════════════════════════
const CONSOLE_SCRIPT = `// Step 1: Open youtube.com, play any video, then paste this in the Console tab:
(function() {
  const visitorData = ytcfg.get('VISITOR_DATA') || '';
  console.log('%c✅ visitorData:', 'color:lime;font-weight:bold', visitorData);
  if (!visitorData) { console.warn('Not on YouTube or not loaded yet — refresh the page and try again.'); return; }
  // Step 2: Intercept the next player API call to grab poToken
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const res = await origFetch(...args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (url.includes('youtubei') && url.includes('player')) {
        const clone = res.clone();
        const json = await clone.json();
        const pt = json?.playerConfig?.attestationConfig?.botguardData?.poToken || json?.poToken || '';
        if (pt) { console.log('%c✅ poToken:', 'color:lime;font-weight:bold', pt); window.fetch = origFetch; }
      }
    } catch {}
    return res;
  };
  console.log('%c⏳ Now RELOAD or click a video to capture poToken...', 'color:orange');
  copy(visitorData);
  console.log('%c📋 visitorData copied to clipboard!', 'color:cyan');
})();`;

function PoTokenInstructions({ onSet }: { onSet: (po: string, vd: string) => void }) {
  const [copied, setCopied] = useState(false);

  function copyScript() {
    navigator.clipboard.writeText(CONSOLE_SCRIPT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="text-xs bg-orange-500/10 rounded-xl p-3 space-y-2">
      <p className="font-semibold text-orange-300 text-sm">Get PO Token from YouTube (2 ways)</p>

      <div className="space-y-1">
        <p className="text-orange-200 font-medium">Method A — Network tab (you can see it now!):</p>
        <ol className="list-decimal list-inside space-y-1 text-orange-200/80">
          <li>Click any request (e.g. <code className="bg-black/30 px-1 rounded">ad_break</code>) in the Network panel</li>
          <li>Click the <strong className="text-white">Payload</strong> sub-tab on the right</li>
          <li>Find <code className="bg-black/30 px-1 rounded">visitorData</code> — copy it</li>
          <li>Find <code className="bg-black/30 px-1 rounded">poToken</code> — copy it (may be inside <code className="bg-black/30 px-1 rounded">attestationConfig</code>)</li>
        </ol>
      </div>

      <div className="border-t border-orange-500/20 pt-2 space-y-1">
        <p className="text-orange-200 font-medium">Method B — Console script (easier):</p>
        <ol className="list-decimal list-inside space-y-1 text-orange-200/80">
          <li>Click the <strong className="text-white">Console</strong> tab in DevTools</li>
          <li>Click <strong>Copy Script</strong> below, paste it, press Enter</li>
          <li>Reload YouTube — both values print automatically in green</li>
        </ol>
        <button
          onClick={copyScript}
          className={`w-full h-8 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${copied ? "bg-green-600 text-white" : "bg-orange-600 hover:bg-orange-500 text-white"}`}
        >
          {copied ? "✓ Copied!" : "Copy Script"}
        </button>
      </div>

      <p className="text-gray-500 text-[10px]">After getting both values, click "Set Token" above and paste them in.</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DOWNLOADER ADMIN TAB
// ═══════════════════════════════════════════════════════════════
function DownloaderAdminTab() {
  const [subscribers, setSubscribers] = useState<string[]>([]);
  const [status, setStatus]           = useState<{ ready: boolean; path: string; cookiesReady?: boolean; poTokenReady?: boolean } | null>(null);
  const [loading, setLoading]         = useState(true);
  const [grantEmail, setGrantEmail]   = useState("");
  const [granting, setGranting]       = useState(false);
  const [revoking, setRevoking]       = useState<string | null>(null);
  const [cookieText, setCookieText]   = useState("");
  const [savingCookies, setSavingCookies] = useState(false);
  const [showCookieInput, setShowCookieInput] = useState(false);
  const [poTokenInput, setPoTokenInput]     = useState("");
  const [visitorDataInput, setVisitorDataInput] = useState("");
  const [savingPoToken, setSavingPoToken]   = useState(false);
  const [showPoTokenInput, setShowPoTokenInput] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const [subRes, statusRes] = await Promise.all([
        fetch("/api/dl/admin/subscribers", { headers: { "x-admin-key": "chegetech-admin" } }),
        fetch("/api/dl/admin/status",      { headers: { "x-admin-key": "chegetech-admin" } }),
      ]);
      if (subRes.ok)    setSubscribers((await subRes.json()).subscribers ?? []);
      if (statusRes.ok) setStatus(await statusRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleGrant() {
    if (!grantEmail.trim()) return;
    setGranting(true);
    try {
      const r = await fetch("/api/dl/admin/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": "chegetech-admin" },
        body: JSON.stringify({ email: grantEmail.trim().toLowerCase() }),
      });
      if (r.ok) {
        toast({ title: "Access granted", description: `${grantEmail} can now download unlimited videos.` });
        setGrantEmail("");
        load();
      } else {
        toast({ title: "Error", variant: "destructive" });
      }
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke(email: string) {
    setRevoking(email);
    try {
      const r = await fetch("/api/dl/admin/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": "chegetech-admin" },
        body: JSON.stringify({ email }),
      });
      if (r.ok) {
        toast({ title: "Access revoked", description: `${email} is back to the free tier.` });
        load();
      } else {
        toast({ title: "Error", variant: "destructive" });
      }
    } finally {
      setRevoking(null);
    }
  }

  async function handleSavePoToken() {
    if (!poTokenInput.trim()) return;
    setSavingPoToken(true);
    try {
      const r = await fetch("/api/dl/admin/set-po-token", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": "chegetech-admin" },
        body: JSON.stringify({ poToken: poTokenInput.trim(), visitorData: visitorDataInput.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        toast({ title: "PO Token saved", description: "YouTube will now use the PO Token for downloads." });
        setPoTokenInput(""); setVisitorDataInput(""); setShowPoTokenInput(false);
        load();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } finally {
      setSavingPoToken(false);
    }
  }

  async function handleSaveCookies() {
    if (!cookieText.trim()) return;
    setSavingCookies(true);
    try {
      const r = await fetch("/api/dl/admin/set-cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": "chegetech-admin" },
        body: JSON.stringify({ cookies: cookieText.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        toast({ title: "Cookies updated", description: "YouTube downloads will now use these cookies." });
        setCookieText("");
        setShowCookieInput(false);
        load();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } finally {
      setSavingCookies(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
          <Download className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Video Downloader</h2>
          <p className="text-xs text-gray-400">Manage unlimited-access subscribers and yt-dlp status</p>
        </div>
      </div>

      {/* yt-dlp status */}
      <div className={`rounded-2xl border p-4 flex items-center gap-3 ${status?.ready ? "border-green-500/20 bg-green-500/5" : "border-yellow-500/20 bg-yellow-500/5"}`}>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status?.ready ? "bg-green-400" : "bg-yellow-400 animate-pulse"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">
            {status === null ? "Checking yt-dlp…" : status.ready ? "yt-dlp is ready" : "yt-dlp downloading in background…"}
          </p>
          {status?.path && <p className="text-xs text-gray-500 mt-0.5 truncate">{status.path}</p>}
          {status && !status.ready && (
            <p className="text-xs text-yellow-400 mt-0.5">Should be ready within 60 s of server start.</p>
          )}
        </div>
        <button onClick={load} className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded-lg border border-white/10 hover:border-white/20 transition-colors flex-shrink-0">
          Refresh
        </button>
      </div>

      {/* YouTube Cookies */}
      <div className={`rounded-2xl border p-5 space-y-3 ${status?.cookiesReady ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${status?.cookiesReady ? "bg-green-400" : "bg-red-400 animate-pulse"}`} />
              YouTube Cookies
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {status?.cookiesReady
                ? "Cookies are active — YouTube downloads should work."
                : "No cookies set — YouTube will block server downloads."}
            </p>
          </div>
          <button
            onClick={() => setShowCookieInput(v => !v)}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
          >
            {showCookieInput ? "Cancel" : status?.cookiesReady ? "Update" : "Set Cookies"}
          </button>
        </div>

        {!status?.cookiesReady && !showCookieInput && (
          <div className="text-xs text-red-300 bg-red-500/10 rounded-xl p-3 space-y-1">
            <p className="font-semibold">How to fix YouTube downloads:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-red-200/80">
              <li>Install <strong>"Get cookies.txt LOCALLY"</strong> Chrome extension</li>
              <li>Go to <strong>youtube.com</strong> while logged into your Google account</li>
              <li>Click the extension → Export → <strong>Cookies for this site</strong></li>
              <li>Paste the file content below and click Save</li>
            </ol>
          </div>
        )}

        {showCookieInput && (
          <div className="space-y-2">
            <textarea
              value={cookieText}
              onChange={e => setCookieText(e.target.value)}
              placeholder={"# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\t..."}
              rows={6}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-red-500/40 resize-none"
            />
            <button
              onClick={handleSaveCookies}
              disabled={savingCookies || !cookieText.trim()}
              className="w-full h-9 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
            >
              {savingCookies ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save Cookies
            </button>
          </div>
        )}
      </div>

      {/* PO Token */}
      <div className={`rounded-2xl border p-5 space-y-3 ${status?.poTokenReady ? "border-green-500/20 bg-green-500/5" : "border-orange-500/20 bg-orange-500/5"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${status?.poTokenReady ? "bg-green-400" : "bg-orange-400 animate-pulse"}`} />
              PO Token (Recommended)
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {status?.poTokenReady
                ? "PO Token active — YouTube web client mode enabled."
                : "No PO Token — recommended for reliable YouTube access."}
            </p>
          </div>
          <button
            onClick={() => setShowPoTokenInput(v => !v)}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
          >
            {showPoTokenInput ? "Cancel" : status?.poTokenReady ? "Update" : "Set Token"}
          </button>
        </div>

        {!status?.poTokenReady && !showPoTokenInput && (
          <PoTokenInstructions onSet={(po, vd) => { setPoTokenInput(po); setVisitorDataInput(vd); setShowPoTokenInput(true); }} />
        )}

        {showPoTokenInput && (
          <div className="space-y-2">
            <input
              value={poTokenInput}
              onChange={e => setPoTokenInput(e.target.value)}
              placeholder="PO Token (required)"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 h-9 text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-orange-500/40"
            />
            <input
              value={visitorDataInput}
              onChange={e => setVisitorDataInput(e.target.value)}
              placeholder="visitorData (optional but recommended)"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 h-9 text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-orange-500/40"
            />
            <button
              onClick={handleSavePoToken}
              disabled={savingPoToken || !poTokenInput.trim()}
              className="w-full h-9 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
            >
              {savingPoToken ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save PO Token
            </button>
          </div>
        )}
      </div>

      {/* Grant unlimited access */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">Grant Unlimited Access</h3>
        <p className="text-xs text-gray-400">Bypasses the 2 free downloads/day limit for this email.</p>
        <div className="flex gap-2">
          <input
            value={grantEmail}
            onChange={e => setGrantEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGrant()}
            placeholder="user@example.com"
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 h-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/40"
          />
          <button
            onClick={handleGrant}
            disabled={granting || !grantEmail.trim()}
            className="h-10 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center gap-2"
          >
            {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Grant
          </button>
        </div>
      </div>

      {/* Subscriber list */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Unlimited Subscribers</h3>
          <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{subscribers.length} total</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
        ) : subscribers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No unlimited subscribers yet.</div>
        ) : (
          <div className="space-y-2">
            {subscribers.map(email => (
              <div key={email} className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-2.5 border border-white/5">
                <span className="text-sm text-white font-mono">{email}</span>
                <button
                  onClick={() => handleRevoke(email)}
                  disabled={revoking === email}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {revoking === email && <Loader2 className="w-3 h-3 animate-spin" />}
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
