import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bot, Zap, CheckCircle, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface BotItem {
  id: number;
  name: string;
  description: string;
  repoUrl: string;
  imageUrl?: string;
  price: number;
  features: string[];
  requiresSessionId: boolean;
  requiresDbUrl: boolean;
  active: boolean;
  category: string;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Multi-Purpose": "from-green-500 to-emerald-600",
  "AI": "from-violet-500 to-purple-600",
  "Downloader": "from-blue-500 to-indigo-600",
  "Group Manager": "from-orange-400 to-red-500",
  "general": "from-teal-400 to-cyan-500",
};

function getCustomerToken() {
  try { return localStorage.getItem("customer_token") || ""; } catch { return ""; }
}

export default function BotStore() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; bots: BotItem[] }>({
    queryKey: ["/api/bots"],
  });

  const allBots = data?.bots || [];

  const categories = Array.from(new Set(allBots.map((b) => b.category)));

  const filtered = allBots.filter((b) => {
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = !activeCategory || b.category === activeCategory;
    return matchSearch && matchCat;
  });

  function handleDeploy(bot: BotItem) {
    if (!getCustomerToken()) {
      setLocation("/auth");
      return;
    }
    setLocation(`/bots/checkout/${bot.id}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Hero */}
      <div className="relative border-b border-white/5 bg-gradient-to-br from-green-950/40 via-gray-900 to-gray-950">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 text-sm text-green-400 mb-6">
            <Zap className="w-3.5 h-3.5" />
            WhatsApp Bot Deployments
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-green-100 to-green-400 bg-clip-text text-transparent">
            Deploy Your WhatsApp Bot
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
            Choose a bot, enter your session ID, and we handle the rest. Running in minutes for just <span className="text-green-400 font-semibold">KES 70</span>.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            {["Instant Setup", "Secure & Private", "24/7 Running", "All Bots Supported"].map((f) => (
              <div key={f} className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-500" />{f}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search bots..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-green-500/50"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!activeCategory ? "bg-green-500 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${activeCategory === cat ? "bg-green-500 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Bot grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl bg-white/5" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No bots found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((bot) => (
              <div
                key={bot.id}
                className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:border-green-500/30 hover:bg-white/[0.05] transition-all duration-300 cursor-pointer"
                onClick={() => setLocation(`/bots/${bot.id}`)}
              >
                {/* Category badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${CATEGORY_COLORS[bot.category] || CATEGORY_COLORS.general} flex items-center justify-center`}>
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">
                    KES {bot.price}
                  </Badge>
                </div>

                <h3 className="font-semibold text-white text-lg mb-1">{bot.name}</h3>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{bot.description}</p>

                {/* Features */}
                <ul className="space-y-1.5 mb-5">
                  {bot.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-400">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                  {bot.features.length > 3 && (
                    <li className="text-xs text-gray-500">+{bot.features.length - 3} more features</li>
                  )}
                </ul>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium"
                    onClick={(e) => { e.stopPropagation(); handleDeploy(bot); }}
                  >
                    Deploy Now
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 text-gray-400 hover:text-white hover:border-white/20 px-2"
                    onClick={(e) => { e.stopPropagation(); window.open(bot.repoUrl, "_blank"); }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
