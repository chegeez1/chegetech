import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X, Send, ExternalLink, ChevronDown } from "lucide-react";

const QUICK_REPLIES = [
  { label: "How to activate?", msg: "Hi! How do I activate my subscription after purchase?" },
  { label: "Payment issues", msg: "Hi! I'm having payment issues on Chege Tech." },
  { label: "Account not received", msg: "Hi! I paid but didn't receive my account credentials." },
  { label: "Pricing inquiry", msg: "Hi! I'd like to know more about your pricing plans." },
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  const { data: cfgData } = useQuery<any>({
    queryKey: ["/api/app-config"],
    staleTime: 60_000,
  });

  const chatEnabled = cfgData?.config?.chatAssistantEnabled !== false;
  const whatsappNumber = (cfgData?.config?.whatsappNumber || "+254114291301").replace(/\D/g, "");
  const channelUrl = cfgData?.config?.whatsappChannel || "https://whatsapp.com/channel/0029VbBx7NeDp2QGF7qoZ02A";

  function openWhatsApp(message: string) {
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  if (!chatEnabled) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          className="w-80 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: "linear-gradient(145deg, #0f172a, #0b1120)",
            border: "1px solid rgba(99,102,241,0.25)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.15)",
          }}
          data-testid="chat-widget-panel"
        >
          {/* Header */}
          <div className="p-4 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.4), rgba(168,85,247,0.3))", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "rgba(22,163,74,0.3)", boxShadow: "0 0 12px rgba(22,163,74,0.4)" }}>
                <MessageCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Chege Tech Support</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-xs text-green-400">Online via WhatsApp</p>
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all" data-testid="button-close-chat">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Greeting */}
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg, rgba(99,102,241,.6), rgba(168,85,247,.6))" }}>CT</div>
              <div className="rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-white/80 max-w-[85%]"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Hi! 👋 Welcome to <strong className="text-white">Chege Tech</strong>. How can we help you today?
              </div>
            </div>

            {/* Quick reply chips */}
            <div className="space-y-2">
              <p className="text-xs text-white/30 ml-9">Choose a topic or send a custom message:</p>
              {QUICK_REPLIES.map((qr, i) => (
                <button
                  key={i}
                  onClick={() => openWhatsApp(qr.msg)}
                  data-testid={`chat-quick-reply-${i}`}
                  className="w-full ml-9 text-left text-xs px-3 py-2 rounded-xl transition-all flex items-center justify-between gap-2 group"
                  style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}
                >
                  <span className="text-indigo-300 group-hover:text-white transition-colors">{qr.label}</span>
                  <Send className="w-3 h-3 text-indigo-400/60 group-hover:text-indigo-300 shrink-0 transition-colors" />
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-white/6 pt-3 space-y-2">
              {/* WhatsApp CTA */}
              <button
                onClick={() => openWhatsApp("Hi! I need help with my Chege Tech subscription.")}
                data-testid="button-open-whatsapp"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.25)" }}
              >
                <MessageCircle className="w-4 h-4 text-green-400 shrink-0" />
                <span className="text-sm text-green-400 font-semibold">Open WhatsApp Chat</span>
                <ExternalLink className="w-3.5 h-3.5 text-green-400/60 ml-auto shrink-0" />
              </button>

              {/* Channel link */}
              <a
                href={channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-follow-channel"
                className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <ChevronDown className="w-4 h-4 text-white/30 shrink-0 rotate-90" />
                <span className="text-xs text-white/50">Follow our WhatsApp Channel</span>
                <ExternalLink className="w-3 h-3 text-white/25 ml-auto shrink-0" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(!open)}
        data-testid="button-open-chat"
        className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 relative"
        style={{
          background: "linear-gradient(135deg, #22c55e, #16a34a)",
          boxShadow: open
            ? "0 0 30px rgba(34,197,94,0.5), 0 8px 24px rgba(0,0,0,0.4)"
            : "0 0 20px rgba(34,197,94,0.35), 0 6px 20px rgba(0,0,0,0.35)",
        }}
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-300 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400" />
          </>
        )}
      </button>
    </div>
  );
}
