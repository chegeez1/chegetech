import { useLocation } from "wouter";
import {
  ShoppingBag, Bot, Server, Zap, Gift, Download, Smartphone,
  TrendingUp, Shield, Users, Mail, Send, MessageSquare,
  ArrowRight, Sparkles, ChevronRight
} from "lucide-react";

interface ServiceCard {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  path: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
}

const SERVICES: ServiceCard[] = [
  {
    icon: ShoppingBag,
    title: "Premium Accounts",
    description: "Netflix, Spotify, Canva, NordVPN & 30+ services. Instant delivery to your email.",
    path: "/store",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/20",
    glowColor: "shadow-indigo-500/20",
  },
  {
    icon: Bot,
    title: "WhatsApp Bot Deployment",
    description: "Deploy Atassa-MD, Gifted-MD & more — fully hosted, always online.",
    path: "/bots",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    glowColor: "shadow-green-500/20",
  },
  {
    icon: Zap,
    title: "Trading Bot",
    description: "Automated trading bots for crypto & forex markets.",
    path: "/tradingbot",
    color: "text-lime-400",
    bgColor: "bg-lime-500/10",
    borderColor: "border-lime-500/20",
    glowColor: "shadow-lime-500/20",
  },
  {
    icon: TrendingUp,
    title: "SMM Boost",
    description: "Instagram, TikTok, YouTube, Telegram & more. Grow your social presence.",
    path: "/smm",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    glowColor: "shadow-pink-500/20",
  },
  {
    icon: Smartphone,
    title: "Free Numbers",
    description: "Virtual numbers for SMS verification worldwide.",
    path: "/numbers",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    glowColor: "shadow-cyan-500/20",
  },
  {
    icon: Server,
    title: "VPS Hosting",
    description: "Reliable VPS servers for bots, apps & projects.",
    path: "/vps",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    glowColor: "shadow-cyan-500/20",
  },
  {
    icon: Shield,
    title: "Proxies",
    description: "Residential & datacenter proxies for any use case.",
    path: "/proxy",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    glowColor: "shadow-emerald-500/20",
  },
  {
    icon: Users,
    title: "Aged Accounts",
    description: "Buy verified aged social media & platform accounts.",
    path: "/accounts",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    glowColor: "shadow-violet-500/20",
  },
  {
    icon: Gift,
    title: "Gift Cards",
    description: "Amazon, iTunes, Google Play, Steam & more gift cards.",
    path: "/giftcards",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
    glowColor: "shadow-yellow-500/20",
  },
  {
    icon: Mail,
    title: "TempMail",
    description: "Disposable temporary email addresses instantly.",
    path: "/tempmail",
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/20",
    glowColor: "shadow-sky-500/20",
  },
  {
    icon: Download,
    title: "Downloader",
    description: "Download videos, music & files from any platform.",
    path: "/downloader",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    glowColor: "shadow-red-500/20",
  },
  {
    icon: Send,
    title: "Bulk WhatsApp",
    description: "Send bulk WhatsApp messages to your contacts.",
    path: "/bulk-whatsapp",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    glowColor: "shadow-green-500/20",
  },
  {
    icon: MessageSquare,
    title: "Bulk SMS",
    description: "Send bulk SMS campaigns to any phone number.",
    path: "/sms",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    glowColor: "shadow-green-500/20",
  },
];

export default function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-950 relative overflow-x-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="bg-orb w-[600px] h-[600px] bg-indigo-600 top-[-200px] left-[-100px]" />
        <div className="bg-orb w-[500px] h-[500px] bg-violet-600 bottom-[-100px] right-[-100px]" style={{ animationDelay: "2s" }} />
        <div className="bg-orb w-[400px] h-[400px] bg-blue-600 top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2" style={{ opacity: 0.15 }} />
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <section className="pt-12 pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm mb-6">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>Your one-stop digital services hub</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Chege Tech
              </span>
            </h1>
            <p className="text-lg text-white/50 max-w-2xl mx-auto mb-8">
              Premium accounts, bot deployment, SMM services, virtual numbers, VPS hosting & more — all in one place.
            </p>

            {/* Quick stats badges */}
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              {[
                { label: "30+ Services", color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25" },
                { label: "Instant Delivery", color: "bg-green-500/15 text-green-300 border-green-500/25" },
                { label: "Paystack Secured", color: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
                { label: "24/7 Support", color: "bg-purple-500/15 text-purple-300 border-purple-500/25" },
              ].map((badge) => (
                <span
                  key={badge.label}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border ${badge.color}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Service Cards Grid */}
        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {SERVICES.map((service) => {
                const Icon = service.icon;
                return (
                  <button
                    key={service.path}
                    onClick={() => setLocation(service.path)}
                    className={`group relative text-left p-5 rounded-2xl border ${service.borderColor} ${service.bgColor} 
                      backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${service.glowColor}
                      active:scale-[0.98] cursor-pointer`}
                  >
                    {/* Icon */}
                    <div className={`w-11 h-11 rounded-xl ${service.bgColor} border ${service.borderColor} flex items-center justify-center mb-3
                      group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className={`w-5 h-5 ${service.color}`} />
                    </div>

                    {/* Title */}
                    <h3 className="text-white font-semibold text-base mb-1.5 group-hover:text-white transition-colors">
                      {service.title}
                    </h3>

                    {/* Description */}
                    <p className="text-white/40 text-sm leading-relaxed mb-3">
                      {service.description}
                    </p>

                    {/* CTA */}
                    <div className={`flex items-center gap-1 text-sm font-medium ${service.color} opacity-60 group-hover:opacity-100 transition-opacity`}>
                      <span>Explore</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Footer hint */}
        <section className="px-4 sm:px-6 lg:px-8 pb-8">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-white/30 text-sm">
              Use the sidebar or bottom nav to jump between services anytime.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
