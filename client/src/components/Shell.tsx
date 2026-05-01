import { useLocation } from "wouter";
import {
  ShoppingBag, Bot, Server, LayoutDashboard, LogOut, Zap, Smartphone, TrendingUp, Shield, Users, Mail, Gift, MessageSquare, HelpCircle, Download, Send
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortLabel: string;
  path: string;
  color: string;
  activeBg: string;
  activeTextBg: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: ShoppingBag, label: "Premium Accounts", shortLabel: "Accounts", path: "/",          color: "text-indigo-400", activeBg: "bg-indigo-500/20 border-indigo-500/30", activeTextBg: "bg-indigo-500/15" },
  { icon: Bot,         label: "WhatsApp Bots",    shortLabel: "Bots",     path: "/bots",       color: "text-green-400",  activeBg: "bg-green-500/20 border-green-500/30",  activeTextBg: "bg-green-500/15"  },
  { icon: Server,      label: "VPS Hosting",      shortLabel: "VPS",      path: "/vps",        color: "text-cyan-400",   activeBg: "bg-cyan-500/20 border-cyan-500/30",    activeTextBg: "bg-cyan-500/15"   },
  { icon: Gift,          label: "Gift Cards",   shortLabel: "Gifts",   path: "/giftcards",color: "text-yellow-400", activeBg: "bg-yellow-500/20 border-yellow-500/30",   activeTextBg: "bg-yellow-500/15"  },
  { icon: Zap,           label: "Trading Bot",  shortLabel: "Bot",     path: "/tradingbot", color: "text-lime-400",   activeBg: "bg-lime-500/20 border-lime-500/30",       activeTextBg: "bg-lime-500/15"    },
  { icon: Smartphone, label: "Free Numbers", shortLabel: "Numbers", path: "/numbers", color: "text-cyan-400", activeBg: "bg-cyan-500/20 border-cyan-500/30", activeTextBg: "bg-cyan-500/15" },
  { icon: TrendingUp,   label: "SMM Boost",    shortLabel: "SMM",     path: "/smm",     color: "text-pink-400",   activeBg: "bg-pink-500/20 border-pink-500/30",    activeTextBg: "bg-pink-500/15"   },
  { icon: Shield,        label: "Proxies",      shortLabel: "Proxy",   path: "/proxy",   color: "text-emerald-400", activeBg: "bg-emerald-500/20 border-emerald-500/30", activeTextBg: "bg-emerald-500/15" },
  { icon: Users,         label: "Aged Accts",   shortLabel: "Accts",   path: "/accounts",color: "text-violet-400",  activeBg: "bg-violet-500/20 border-violet-500/30",   activeTextBg: "bg-violet-500/15"  },
  { icon: Mail,          label: "TempMail",     shortLabel: "Mail",    path: "/tempmail",color: "text-sky-400",    activeBg: "bg-sky-500/20 border-sky-500/30",         activeTextBg: "bg-sky-500/15"     },
  { icon: Send,          label: "Bulk WA",     shortLabel: "Bulk WA", path: "/bulk-whatsapp", color: "text-green-400", activeBg: "bg-green-500/20 border-green-500/30", activeTextBg: "bg-green-500/15" },
  { icon: Download,      label: "Downloader",   shortLabel: "Download", path: "/downloader", color: "text-red-400",    activeBg: "bg-red-500/20 border-red-500/30",    activeTextBg: "bg-red-500/15"    },
  { icon: MessageSquare, label: "Bulk SMS",     shortLabel: "SMS",     path: "/sms",      color: "text-green-400",  activeBg: "bg-green-500/20 border-green-500/30",     activeTextBg: "bg-green-500/15"   },
  { icon: HelpCircle, label: "Help & FAQ", shortLabel: "FAQ", path: "/faq", color: "text-amber-400", activeBg: "bg-amber-500/20 border-amber-500/30", activeTextBg: "bg-amber-500/15" },
  { icon: LayoutDashboard, label: "My Account",   shortLabel: "Account",  path: "/dashboard",  color: "text-purple-400", activeBg: "bg-purple-500/20 border-purple-500/30", activeTextBg: "bg-purple-500/15" },
];

function logout() {
  localStorage.removeItem("customer_token");
  localStorage.removeItem("customer_data");
  fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  window.location.href = "/auth";
}

interface ShellProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
}

export default function Shell({ children, isAuthenticated }: ShellProps) {
  const [location, setLocation] = useLocation();
  const [tooltip, setTooltip] = useState<string | null>(null);

  if (!isAuthenticated) return <>{children}</>;

  const activePath = location;

  function isActive(path: string) {
    if (path === "/" && activePath === "/") return true;
    if (path !== "/" && activePath.startsWith(path)) return true;
    return false;
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* ── Desktop left sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-16 z-50 bg-gray-900/95 backdrop-blur-md border-r border-white/5">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 border-b border-white/5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
            <Zap className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Nav icons */}
        <nav className="flex flex-col items-center gap-1.5 px-2 py-4 flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <div key={item.path} className="relative w-full">
                <button
                  onClick={() => setLocation(item.path)}
                  onMouseEnter={() => setTooltip(item.label)}
                  onMouseLeave={() => setTooltip(null)}
                  className={`w-full flex items-center justify-center h-11 rounded-xl border transition-all duration-150 ${
                    active
                      ? `${item.activeBg} ${item.color}`
                      : "border-transparent text-white/40 hover:text-white/70 hover:bg-white/5"
                  }`}
                  aria-label={item.label}
                >
                  <Icon className="w-5 h-5" />
                </button>
                {tooltip === item.label && (
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none z-50 border border-white/10">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-2 pb-4 shrink-0 relative">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center h-11 rounded-xl border border-transparent text-white/30 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-150"
            aria-label="Logout"
            onMouseEnter={() => setTooltip("Logout")}
            onMouseLeave={() => setTooltip(null)}
          >
            <LogOut className="w-5 h-5" />
          </button>
          {tooltip === "Logout" && (
            <div className="absolute left-full ml-3 bottom-4 whitespace-nowrap bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none z-50 border border-white/10">
              Logout
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────────────── */}
      <main className="flex-1 md:pl-16 min-h-screen" style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="md:pb-0" style={{ paddingBottom: "0" }}>
          {children}
        </div>
      </main>

      {/* ── Mobile bottom nav ─────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900/98 backdrop-blur-lg border-t border-white/8"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around px-1 h-[4.25rem]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className="flex flex-col items-center justify-center gap-1 flex-1 py-1.5 mx-0.5 rounded-2xl transition-all duration-150 active:scale-95 min-w-0"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <div className={`flex items-center justify-center w-10 h-7 rounded-xl transition-all duration-150 ${active ? item.activeTextBg : ""}`}>
                  <Icon className={`w-5 h-5 transition-colors ${active ? item.color : "text-white/35"}`} />
                </div>
                <span className={`text-[10px] font-semibold leading-none truncate w-full text-center transition-colors ${active ? item.color : "text-white/35"}`}>
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
          <button
            onClick={logout}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-1.5 mx-0.5 rounded-2xl transition-all duration-150 active:scale-95 min-w-0"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <div className="flex items-center justify-center w-10 h-7 rounded-xl">
              <LogOut className="w-5 h-5 text-white/25" />
            </div>
            <span className="text-[10px] font-semibold leading-none text-white/25">Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
