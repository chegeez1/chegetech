import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X, Send, User, Bot, Headphones, Loader2 } from "lucide-react";

interface Message {
  id?: number;
  sender: "customer" | "ai" | "admin";
  message: string;
  created_at?: string;
}

interface Ticket {
  id: number;
  token: string;
  status: string;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [escalated, setEscalated] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ email: "", name: "" });
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: cfgData } = useQuery<any>({
    queryKey: ["/api/app-config"],
    staleTime: 60_000,
  });

  const chatEnabled = cfgData?.config?.chatAssistantEnabled !== false;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const startPolling = useCallback((ticketId: number, ticketToken: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/support/ticket/${ticketId}/messages?token=${encodeURIComponent(ticketToken)}`);
        const data = await res.json();
        if (data.success && data.messages) {
          setMessages(data.messages.map((m: any) => ({
            id: m.id,
            sender: m.sender,
            message: m.message,
            created_at: m.createdAt || m.created_at,
          })));
        }
      } catch {}
    }, 3000);
  }, []);

  const createTicket = async () => {
    try {
      const res = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: customerInfo.email,
          customerName: customerInfo.name || "Customer",
          subject: "AI Chat Support",
        }),
      });
      const data = await res.json();
      if (data.success && data.ticket) {
        setTicket(data.ticket);
        return data.ticket;
      }
    } catch {}
    return null;
  };

  const saveMessageToTicket = async (ticketObj: Ticket, sender: string, message: string) => {
    try {
      await fetch(`/api/support/ticket/${ticketObj.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sender, token: ticketObj.token }),
      });
    } catch {}
  };

  const handleStart = async () => {
    if (!customerInfo.email.trim()) return;
    setStarted(true);
    const t = await createTicket();
    const greeting: Message = {
      sender: "ai",
      message: "Hi! 👋 Welcome to **Chege Tech** support. I'm your AI assistant. How can I help you today?",
    };
    setMessages([greeting]);
    if (t) {
      await saveMessageToTicket(t, "ai", greeting.message);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: Message = { sender: "customer", message: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    if (ticket) {
      await saveMessageToTicket(ticket, "customer", text);
    }

    if (escalated) {
      setIsTyping(false);
      return;
    }

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.sessionId) setSessionId(data.sessionId);
        const aiMsg: Message = { sender: "ai", message: data.response };
        setMessages((prev) => [...prev, aiMsg]);
        if (ticket) {
          await saveMessageToTicket(ticket, "ai", data.response);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", message: "Sorry, I'm having trouble right now. Please try again or talk to a human agent." },
      ]);
    }
    setIsTyping(false);
  };

  const handleEscalate = async () => {
    if (!ticket) return;
    setEscalated(true);
    try {
      await fetch(`/api/support/ticket/${ticket.id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: ticket.token }),
      });
      const escalateMsg: Message = {
        sender: "ai",
        message: "I've connected you with our support team. An admin will respond shortly. Please wait...",
      };
      setMessages((prev) => [...prev, escalateMsg]);
      await saveMessageToTicket(ticket, "ai", escalateMsg.message);
      startPolling(ticket.id, ticket.token);
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderMessage = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (!chatEnabled) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          className="w-80 sm:w-96 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{
            background: "linear-gradient(145deg, #0f172a, #0b1120)",
            border: "1px solid rgba(99,102,241,0.25)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.15)",
            maxHeight: "32rem",
          }}
          data-testid="chat-widget-panel"
        >
          <div
            className="p-4 flex items-center justify-between shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.4), rgba(168,85,247,0.3))",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  background: escalated ? "rgba(168,85,247,0.3)" : "rgba(99,102,241,0.3)",
                  boxShadow: escalated
                    ? "0 0 12px rgba(168,85,247,0.4)"
                    : "0 0 12px rgba(99,102,241,0.4)",
                }}
              >
                {escalated ? (
                  <Headphones className="w-5 h-5 text-purple-400" />
                ) : (
                  <Bot className="w-5 h-5 text-indigo-400" />
                )}
              </div>
              <div>
                <p className="font-bold text-white text-sm">
                  {escalated ? "Live Support" : "AI Support"}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-xs text-green-400">
                    {escalated ? "Connected to agent" : "Online"}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
              data-testid="button-close-chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!started ? (
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <div
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg, rgba(99,102,241,.6), rgba(168,85,247,.6))",
                  }}
                >
                  <Bot className="w-4 h-4" />
                </div>
                <div
                  className="rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-white/80 max-w-[85%]"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  Hi! 👋 Welcome to <strong className="text-white">Chege Tech</strong> support. Enter
                  your details to start chatting.
                </div>
              </div>

              <div className="space-y-2 ml-9">
                <input
                  type="email"
                  placeholder="Your email *"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 outline-none"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 outline-none"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
                <button
                  onClick={handleStart}
                  disabled={!customerInfo.email.trim()}
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg, rgba(99,102,241,0.5), rgba(168,85,247,0.5))",
                    border: "1px solid rgba(99,102,241,0.3)",
                  }}
                >
                  Start Chat
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className="flex-1 overflow-y-auto p-4 space-y-3"
                style={{ minHeight: "12rem", maxHeight: "20rem" }}
              >
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${msg.sender === "customer" ? "flex-row-reverse" : ""}`}
                  >
                    {msg.sender !== "customer" && (
                      <div
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                        style={{
                          background:
                            msg.sender === "admin"
                              ? "linear-gradient(135deg, rgba(168,85,247,.6), rgba(236,72,153,.6))"
                              : "linear-gradient(135deg, rgba(99,102,241,.6), rgba(168,85,247,.6))",
                        }}
                      >
                        {msg.sender === "admin" ? (
                          <Headphones className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Bot className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm max-w-[80%] ${
                        msg.sender === "customer"
                          ? "rounded-tr-sm text-white"
                          : msg.sender === "admin"
                            ? "rounded-tl-sm text-purple-100"
                            : "rounded-tl-sm text-white/80"
                      }`}
                      style={{
                        background:
                          msg.sender === "customer"
                            ? "linear-gradient(135deg, rgba(99,102,241,0.4), rgba(99,102,241,0.25))"
                            : msg.sender === "admin"
                              ? "rgba(168,85,247,0.15)"
                              : "rgba(255,255,255,0.07)",
                        border:
                          msg.sender === "customer"
                            ? "1px solid rgba(99,102,241,0.3)"
                            : msg.sender === "admin"
                              ? "1px solid rgba(168,85,247,0.25)"
                              : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {msg.sender === "admin" && (
                        <span className="text-[10px] text-purple-400 font-semibold block mb-0.5">
                          Support Agent
                        </span>
                      )}
                      <span>{renderMessage(msg.message)}</span>
                    </div>
                    {msg.sender === "customer" && (
                      <div
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                        style={{
                          background: "linear-gradient(135deg, rgba(34,197,94,.5), rgba(22,163,74,.5))",
                        }}
                      >
                        <User className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </div>
                ))}

                {isTyping && (
                  <div className="flex gap-2">
                    <div
                      className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, rgba(99,102,241,.6), rgba(168,85,247,.6))",
                      }}
                    >
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div
                      className="rounded-2xl rounded-tl-sm px-4 py-3"
                      style={{
                        background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="flex gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="shrink-0 border-t border-white/5">
                {!escalated && (
                  <button
                    onClick={handleEscalate}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs transition-all"
                    style={{
                      background: "rgba(168,85,247,0.08)",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <Headphones className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-purple-300">Talk to human</span>
                  </button>
                )}
                <div className="p-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={escalated ? "Type a message to support..." : "Type a message..."}
                    disabled={isTyping}
                    className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-white/30 outline-none disabled:opacity-50"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isTyping}
                    className="p-2 rounded-xl transition-all disabled:opacity-30"
                    style={{
                      background: "linear-gradient(135deg, rgba(99,102,241,0.5), rgba(168,85,247,0.5))",
                    }}
                  >
                    {isTyping ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        data-testid="button-open-chat"
        className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 relative"
        style={{
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          boxShadow: open
            ? "0 0 30px rgba(99,102,241,0.5), 0 8px 24px rgba(0,0,0,0.4)"
            : "0 0 20px rgba(99,102,241,0.35), 0 6px 20px rgba(0,0,0,0.35)",
        }}
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-purple-300 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-purple-400" />
          </>
        )}
      </button>
    </div>
  );
}
