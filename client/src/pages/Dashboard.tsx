import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingBag, Key, LogOut, User, Plus, Trash2, Copy,
  CheckCircle, Clock, XCircle, Shield, Eye, EyeOff,
  Loader2, ArrowLeft, QrCode, Lock, AlertTriangle,
  ChevronDown, ChevronUp, AlertCircle, Save, Package,
  Wallet, Link2, History, TrendingUp, Gift, ArrowUpCircle, ArrowDownCircle,
  MessageCircle, Send, PlusCircle, Ticket,
  Bell, BellDot, ShoppingCart, TrendingDown, Star, Sparkles,
  MapPin, Monitor, Globe, Wifi, Camera, X, Download, Trophy, ThumbsUp,
  Bot, Play, Square, RotateCw, FileText, Server, Mail, Terminal, Edit3, RefreshCw, Zap
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function getToken() { return localStorage.getItem("customer_token") || ""; }
function getCustomerData() {
  try { return JSON.parse(localStorage.getItem("customer_data") || "null"); } catch { return null; }
}
function clearAuth() { localStorage.removeItem("customer_token"); localStorage.removeItem("customer_data"); }

function customerHeaders() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

async function customerFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, { ...opts, headers: { ...customerHeaders(), ...(opts.headers || {}) } });
  if (res.status === 401) { clearAuth(); window.location.href = "/auth"; }
  return res.json();
}

type DashTab = "orders" | "my-bots" | "wallet" | "referral" | "payment-history" | "receipts" | "support" | "apikeys" | "security" | "profile" | "requests";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  success: { label: "Completed", color: "text-emerald-400", icon: CheckCircle },
  pending: { label: "Pending", color: "text-amber-400", icon: Clock },
  failed: { label: "Failed", color: "text-red-400", icon: XCircle },
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();
  const initialTab = (new URLSearchParams(search).get("tab") as DashTab) || "orders";
  const [tab, setTab] = useState<DashTab>(initialTab);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Credentials viewer state
  const [expandedCreds, setExpandedCreds] = useState<Set<string>>(new Set());
  const [credentialsData, setCredentialsData] = useState<Record<string, any>>({});
  const [loadingCreds, setLoadingCreds] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Wallet top-up state
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLabel, setTopupLabel] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  // Wallet send / P2P transfer state
  const [sendEmail, setSendEmail] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendConfirm, setSendConfirm] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<{ recipient: string; amount: number } | null>(null);

  // TOTP state
  const [totpStep, setTotpStep] = useState<"idle" | "qr" | "verify">("idle");
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState("");

  // ─── Rating modal state ───────────────────────────────────────────────────
  const [ratingModal, setRatingModal] = useState<{ reference: string; planName: string } | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [submittedRatings, setSubmittedRatings] = useState<Record<string, number>>({});

  async function submitRating() {
    if (!ratingModal || !ratingStars) return;
    setRatingSubmitting(true);
    try {
      const data = await customerFetch(`/api/customer/orders/${ratingModal.reference}/rate`, {
        method: "POST",
        body: JSON.stringify({ stars: ratingStars, comment: ratingComment }),
      });
      if (data.success) {
        setSubmittedRatings(prev => ({ ...prev, [ratingModal.reference]: ratingStars }));
        toast({ title: "Thank you for your rating! ⭐" });
        setRatingModal(null);
        setRatingStars(0);
        setRatingComment("");
      } else {
        toast({ title: data.error || "Failed to submit rating", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to submit rating", variant: "destructive" });
    } finally {
      setRatingSubmitting(false);
    }
  }

  const [customer, setCustomer] = useState<any>(() => getCustomerData());
  const [authChecked, setAuthChecked] = useState(() => {
    const token = localStorage.getItem("customer_token");
    const data = localStorage.getItem("customer_data");
    return !!(token && data); // if both present, no need to do async check
  });

  // Validate session on mount — cookie-first: if localStorage is missing,
  // the HttpOnly cookie is sent automatically and can restore the session
  useEffect(() => {
    if (authChecked) return; // already verified via localStorage
    const token = getToken();
    // Build request — include Bearer header if we have a token, always send credentials (cookie)
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch("/api/auth/me", { headers, credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          // Re-hydrate localStorage from server response (handles cookie-only sessions)
          if (d.token) localStorage.setItem("customer_token", d.token);
          localStorage.setItem("customer_data", JSON.stringify(d.customer));
          setCustomer(d.customer);
          setAuthChecked(true);
        } else {
          clearAuth();
          setLocation("/auth");
        }
      })
      .catch(() => { clearAuth(); setLocation("/auth"); });
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(140deg, #0b1020, #0d0724)" }}>
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  const { data: ordersData, isLoading: ordersLoading } = useQuery<any>({
    queryKey: ["/api/customer/orders"],
    queryFn: () => customerFetch("/api/customer/orders"),
    enabled: tab === "orders" || tab === "receipts",
  });

  const { data: meData, refetch: refetchMe } = useQuery<any>({
    queryKey: ["/api/customer/me"],
    queryFn: () => customerFetch("/api/customer/me"),
    staleTime: 60_000,
  });
  const me = meData?.customer ?? getCustomerData();
  const isUnverified = !!me && me.emailVerified === false;

  const [resending, setResending] = useState(false);
  const [resentOk, setResentOk] = useState(false);
  async function resendVerificationLink() {
    if (!me?.email || resending) return;
    setResending(true);
    try {
      const r = await fetch("/api/auth/resend-verification", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: me.email }),
      });
      const d = await r.json();
      if (d.success) {
        setResentOk(true);
        toast({ title: "Verification link sent", description: "Check your inbox" });
        setTimeout(() => setResentOk(false), 8000);
      } else {
        toast({ title: "Failed to resend", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally { setResending(false); }
  }

  // ─── Bot management dialog state ───────────────────────────────────────
  const [manageBotId, setManageBotId] = useState<number | null>(null);
  const [botStatus, setBotStatus] = useState<any>(null);
  const [botLogs, setBotLogs] = useState<string>("");
  const [botBusy, setBotBusy] = useState<string | null>(null);
  const [selfDeploying, setSelfDeploying] = useState(false);
  const [selfDeployMsg, setSelfDeployMsg] = useState<string | null>(null);
  const [botStatusLoading, setBotStatusLoading] = useState(false);
    const [botLogsLoading, setBotLogsLoading] = useState(false);
  const [botEnvVars, setBotEnvVars] = useState<Record<string, string>>({});
  const [botEnvEditing, setBotEnvEditing] = useState(false);
  const [botEnvSaving, setBotEnvSaving] = useState(false);
  const [botEnvLoading, setBotEnvLoading] = useState(false);
  const [terminalHistory, setTerminalHistory] = useState<Array<{cmd: string; output: string; ts: number}>>([]);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalRunning, setTerminalRunning] = useState(false);
  const [botUptimeMap, setBotUptimeMap] = useState<Record<number, any[]>>({});
  async function loadBotStatus(orderId: number) {
    setBotStatusLoading(true);
    try {
      const d = await customerFetch(`/api/customer/bots/${orderId}/status`);
      setBotStatus(d);
    } finally { setBotStatusLoading(false); }
  }
  async function loadBotLogs(orderId: number) {
    setBotLogsLoading(true);
    try {
      const d = await customerFetch(`/api/customer/bots/${orderId}/logs`);
      setBotLogs(d?.logs || "(no logs)");
    } finally { setBotLogsLoading(false); }
  }
  async function selfDeploy(orderId: number) {
    setSelfDeploying(true);
    setSelfDeployMsg(null);
    try {
      const d = await customerFetch(`/api/customer/bots/${orderId}/self-deploy`, { method: "POST" });
      if (!d.success) {
        toast({ title: "Deploy failed", description: d.error, variant: "destructive" });
        setSelfDeploying(false);
        return;
      }
      setSelfDeployMsg("⚡ Deploying… this takes 1–3 minutes");
      // Poll status every 5s until deployed or failed
      const poll = setInterval(async () => {
        const s = await customerFetch(`/api/customer/bots/${orderId}/status`);
        setBotStatus(s);
        if (s?.pm2Status === "online" || s?.deployed) {
          clearInterval(poll);
          setSelfDeploying(false);
          setSelfDeployMsg(null);
          toast({ title: "🎉 Bot deployed!", description: "Your bot is now live." });
          await loadBotLogs(orderId);
        } else if (s?.message?.toLowerCase().includes("fail") || s?.message?.toLowerCase().includes("error")) {
          clearInterval(poll);
          setSelfDeploying(false);
          setSelfDeployMsg("Deploy failed — check with support");
        }
      }, 5000);
      // Safety timeout — stop polling after 10 min
      setTimeout(() => { clearInterval(poll); setSelfDeploying(false); }, 600000);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setSelfDeploying(false);
    }
  }

  async function botAction(orderId: number, action: "restart" | "stop" | "start") {
    setBotBusy(action);
    try {
      const d = await customerFetch(`/api/customer/bots/${orderId}/${action}`, { method: "POST" });
      toast({ title: d.success ? d.message : (d.error || "Failed"), variant: d.success ? "default" : "destructive" });
      if (d.success) await loadBotStatus(orderId);
    } finally { setBotBusy(null); }
  }
  async function loadBotEnvVars(orderId: number) {
    setBotEnvLoading(true);
    try {
      const r = await customerFetch(`/api/customer/bots/${orderId}/env-vars`);
      if (r.success) setBotEnvVars(r.envVars || {});
    } catch (e) { console.warn("loadBotEnvVars:", e); }
    finally { setBotEnvLoading(false); }
  }

  async function loadBotEnvVars(orderId: number) {
    setBotEnvLoading(true);
    try { const r = await customerFetch(`/api/customer/bots/${orderId}/env-vars`); if (r.success) setBotEnvVars(r.envVars || {}); }
    catch {} finally { setBotEnvLoading(false); }
  }
  async function loadBotUptime(orderId: number) {
    try { const r = await customerFetch(`/api/customer/bots/${orderId}/uptime`); if (r.success) setBotUptimeMap(prev => ({ ...prev, [orderId]: r.pings || [] })); }
    catch {}
  }
  async function runTerminalCommand(orderId: number, cmd: string) {
    if (!cmd.trim() || terminalRunning) return;
    const ts = Date.now();
    setTerminalHistory(h => [...h, { cmd, output: "Running...", ts }]);
    setTerminalInput("");
    setTerminalRunning(true);
    try {
      const r = await customerFetch(`/api/customer/bots/${orderId}/terminal`, { method: "POST", body: JSON.stringify({ command: cmd }) });
      setTerminalHistory(h => h.map(e => e.ts === ts ? { ...e, output: r.success ? r.output : `Error: ${r.error}` } : e));
    } catch (e: any) { setTerminalHistory(h => h.map(e => e.ts === ts ? { ...e, output: `Error: ${e.message}` } : e)); }
    finally { setTerminalRunning(false); }
  }
  function openManageBot(orderId: number) {
    setManageBotId(orderId);
    setBotStatus(null); setBotLogs(""); setBotEnvVars({}); setBotEnvEditing(false); setTerminalHistory([]);
    loadBotStatus(orderId); loadBotLogs(orderId); loadBotEnvVars(orderId); loadBotUptime(orderId);
  }
  function closeManageBot() {
    setManageBotId(null);
    setBotStatus(null); setBotLogs(""); setBotEnvVars({}); setBotEnvEditing(false);
  }

  const { data: myBotsData, isLoading: myBotsLoading } = useQuery<any>({
    queryKey: ["/api/customer/my-bots"],
    queryFn: () => customerFetch("/api/customer/my-bots"),
    enabled: tab === "my-bots" || tab === "orders",
  });

  const { data: announcementsData } = useQuery<any>({
    queryKey: ["/api/announcements"],
    queryFn: () => fetch("/api/announcements").then(r => r.json()),
    staleTime: 60000,
  });
  const [dismissedAnns, setDismissedAnns] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dismissed_anns") || "[]")); } catch { return new Set(); }
  });
  function dismissAnn(id: string) {
    setDismissedAnns(prev => {
      const next = new Set(Array.from(prev)); next.add(id);
      try { localStorage.setItem("dismissed_anns", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }

  const { data: badgesData } = useQuery<any>({
    queryKey: ["/api/customer/badges"],
    queryFn: () => customerFetch("/api/customer/badges"),
    enabled: tab === "profile",
    staleTime: 60000,
  });

  const { data: tgStatusData, refetch: refetchTgStatus } = useQuery<any>({
    queryKey: ["/api/customer/telegram-status"],
    queryFn: () => customerFetch("/api/customer/telegram-status"),
    enabled: tab === "profile",
    staleTime: 30000,
  });
  const [tgCode, setTgCode] = useState<string | null>(null);
  const [tgCodeLoading, setTgCodeLoading] = useState(false);
  async function generateTgCode() {
    setTgCodeLoading(true);
    try {
      const d = await customerFetch("/api/customer/telegram-code");
      if (d.success) setTgCode(d.code);
    } finally { setTgCodeLoading(false); }
  }
  async function unlinkTelegram() {
    await customerFetch("/api/customer/telegram-unlink", { method: "POST" });
    setTgCode(null);
    refetchTgStatus();
  }

  const { data: keysData, isLoading: keysLoading } = useQuery<any>({
    queryKey: ["/api/customer/api-keys"],
    queryFn: () => customerFetch("/api/customer/api-keys"),
    enabled: tab === "apikeys",
  });

  const { data: totpStatus, refetch: refetchTotpStatus } = useQuery<any>({
    queryKey: ["/api/customer/totp-status"],
    queryFn: () => customerFetch("/api/customer/totp-status"),
    enabled: tab === "security",
  });

  const { data: walletData, isLoading: walletLoading } = useQuery<any>({
    queryKey: ["/api/customer/wallet"],
    queryFn: () => customerFetch("/api/customer/wallet"),
    enabled: tab === "wallet",
  });

  const { data: referralData, isLoading: referralLoading } = useQuery<any>({
    queryKey: ["/api/customer/referral"],
    queryFn: () => customerFetch("/api/customer/referral"),
    enabled: tab === "referral",
  });

  const { data: payHistData, isLoading: payHistLoading } = useQuery<any>({
    queryKey: ["/api/customer/payment-history"],
    queryFn: () => customerFetch("/api/customer/payment-history"),
    enabled: tab === "payment-history",
  });

  const [copiedReferral, setCopiedReferral] = useState(false);
  function copyReferralLink(link: string) {
    navigator.clipboard.writeText(link);
    setCopiedReferral(true);
    toast({ title: "Referral link copied!" });
    setTimeout(() => setCopiedReferral(false), 2000);
  }

  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const { data: notifData, refetch: refetchNotifs } = useQuery<any>({
    queryKey: ["/api/customer/notifications"],
    queryFn: () => customerFetch("/api/customer/notifications"),
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: () => customerFetch("/api/customer/notifications/read", { method: "PUT" }),
    onSuccess: () => refetchNotifs(),
  });

  const { data: spendingStats } = useQuery<any>({
    queryKey: ["/api/customer/stats"],
    queryFn: () => customerFetch("/api/customer/stats"),
    enabled: tab === "wallet",
  });

  const { data: configData } = useQuery<any>({
    queryKey: ["/api/config"],
    queryFn: () => fetch("/api/config").then(r => r.json()),
  });

  const { data: referralTier } = useQuery<any>({
    queryKey: ["/api/customer/referral/tier"],
    queryFn: () => customerFetch("/api/customer/referral/tier"),
    enabled: tab === "referral",
  });

  async function initiateWalletTopup() {
    const amount = parseInt(topupAmount);
    if (!amount || amount < 50) { toast({ title: "Minimum top-up is KES 50", variant: "destructive" }); return; }
    setTopupLoading(true);
    try {
      const data = await customerFetch("/api/customer/wallet/topup/initiate", { method: "POST", body: JSON.stringify({ amount, label: topupLabel.trim() || undefined }) });
      if (!data.success) { toast({ title: data.error || "Failed to initiate top-up", variant: "destructive" }); return; }
      if (!data.paystackConfigured || !data.authorizationUrl) {
        toast({ title: "Payment gateway not configured. Contact admin.", variant: "destructive" }); return;
      }
      if (window.PaystackPop && configData?.paystackPublicKey) {
        const handler = window.PaystackPop.setup({
          key: configData.paystackPublicKey,
          email: customer.email,
          amount: amount * 100,
          ref: data.reference,
          currency: "KES",
          callback: async (response: any) => {
            const verifyData = await customerFetch("/api/customer/wallet/topup/verify", { method: "POST", body: JSON.stringify({ reference: response.reference }) });
            if (verifyData.success) {
              toast({ title: `KES ${amount} added to your wallet! 💰` });
              queryClient.invalidateQueries({ queryKey: ["/api/customer/wallet"] });
              setTopupAmount(""); setTopupLabel("");
            } else { toast({ title: verifyData.error || "Top-up verification failed", variant: "destructive" }); }
          },
          onClose: () => toast({ title: "Top-up cancelled" }),
        });
        handler.openIframe();
      } else {
        window.location.href = data.authorizationUrl;
      }
    } catch { toast({ title: "Failed to initiate top-up", variant: "destructive" }); }
    finally { setTopupLoading(false); }
  }

  // Determine if input is email or numeric ID
  const sendRecipientIsEmail = sendEmail.includes("@");
  const sendRecipientIsId = !sendRecipientIsEmail && /^\d+$/.test(sendEmail.trim());

  async function sendWalletBalance() {
    const amount = parseFloat(sendAmount);
    const recipient = sendEmail.trim();
    if (!recipient) { toast({ title: "Enter recipient's email or customer ID", variant: "destructive" }); return; }
    if (!sendRecipientIsEmail && !sendRecipientIsId) { toast({ title: "Enter a valid email address or numeric customer ID", variant: "destructive" }); return; }
    if (!amount || amount < 10) { toast({ title: "Minimum transfer is KES 10", variant: "destructive" }); return; }
    if (!sendConfirm) { setSendConfirm(true); return; }
    setSendLoading(true);
    const body: Record<string, any> = { amount, note: sendNote.trim() || undefined };
    if (sendRecipientIsEmail) body.recipientEmail = recipient;
    else body.recipientId = parseInt(recipient, 10);
    try {
      const data = await customerFetch("/api/customer/wallet/send", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!data.success) { toast({ title: data.error || "Transfer failed", variant: "destructive" }); setSendConfirm(false); return; }
      setSendSuccess({ recipient: data.recipientName || sendEmail, amount });
      setSendEmail(""); setSendAmount(""); setSendNote(""); setSendConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/customer/wallet"] });
      setTimeout(() => setSendSuccess(null), 5000);
    } catch { toast({ title: "Transfer failed", variant: "destructive" }); setSendConfirm(false); }
    finally { setSendLoading(false); }
  }

  const { data: loginHistoryData, isLoading: loginHistoryLoading } = useQuery<any>({
    queryKey: ["/api/customer/login-history"],
    queryFn: () => customerFetch("/api/customer/login-history"),
    enabled: tab === "security",
  });

  const { data: sessionsData, refetch: refetchSessions } = useQuery<any>({
    queryKey: ["/api/customer/sessions"],
    queryFn: () => customerFetch("/api/customer/sessions"),
    enabled: tab === "security",
  });
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  async function revokeSession(id: number) {
    setRevokingId(id);
    try {
      const r = await customerFetch(`/api/customer/sessions/${id}`, { method: "DELETE" });
      if (r.success) { toast({ title: "Session revoked" }); refetchSessions(); }
      else toast({ title: r.error || "Failed to revoke", variant: "destructive" });
    } catch { toast({ title: "Failed to revoke session", variant: "destructive" }); }
    finally { setRevokingId(null); }
  }

  async function revokeOtherSessions() {
    setRevokingOthers(true);
    try {
      const r = await customerFetch("/api/customer/sessions/others", { method: "DELETE" });
      if (r.success) { toast({ title: `Signed out from ${r.revoked} other device(s)` }); refetchSessions(); }
      else toast({ title: r.error || "Failed", variant: "destructive" });
    } catch { toast({ title: "Failed to sign out other sessions", variant: "destructive" }); }
    finally { setRevokingOthers(false); }
  }

  // ─── Feature Requests state ──────────────────────────────────────────────
  const [frTitle, setFrTitle] = useState("");
  const [frDesc, setFrDesc] = useState("");
  const [frSubmitting, setFrSubmitting] = useState(false);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());

  const { data: frData, refetch: refetchFr } = useQuery<any>({
    queryKey: ["/api/customer/feature-requests"],
    queryFn: () => customerFetch("/api/customer/feature-requests"),
    enabled: tab === "requests",
  });

  async function submitFeatureRequest() {
    if (!frTitle.trim()) { toast({ title: "Please enter a title", variant: "destructive" }); return; }
    setFrSubmitting(true);
    try {
      const d = await customerFetch("/api/customer/feature-requests", {
        method: "POST",
        body: JSON.stringify({ title: frTitle, description: frDesc }),
      });
      if (d.success) {
        toast({ title: "Your idea has been submitted! 💡" });
        setFrTitle(""); setFrDesc("");
        refetchFr();
      } else {
        toast({ title: d.error || "Failed to submit", variant: "destructive" });
      }
    } catch { toast({ title: "Failed to submit", variant: "destructive" }); }
    finally { setFrSubmitting(false); }
  }

  async function voteFeatureRequest(id: string) {
    if (votedIds.has(id)) return;
    setVotedIds(prev => new Set(Array.from(prev).concat([id])));
    await customerFetch(`/api/customer/feature-requests/${id}/vote`, { method: "POST" }).catch(() => {});
    refetchFr();
  }

  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [replyText, setReplyText] = useState("");

  const { data: ticketsData, isLoading: ticketsLoading, refetch: refetchTickets } = useQuery<any>({
    queryKey: ["/api/customer/tickets"],
    queryFn: () => customerFetch("/api/customer/tickets"),
    enabled: tab === "support",
  });

  const { data: ticketMessagesData, isLoading: ticketMsgsLoading, refetch: refetchTicketMsgs } = useQuery<any>({
    queryKey: ["/api/customer/tickets", selectedTicketId, "messages"],
    queryFn: () => customerFetch(`/api/customer/tickets/${selectedTicketId}/messages`),
    enabled: !!selectedTicketId,
  });

  const createTicketMutation = useMutation({
    mutationFn: () => customerFetch("/api/customer/tickets", {
      method: "POST",
      body: JSON.stringify({ subject: newTicketSubject.trim() || "Support Request", message: newTicketMessage.trim() }),
    }),
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Ticket created!", description: `Ticket #${data.ticket.id} has been opened` });
        setShowNewTicket(false);
        setNewTicketSubject("");
        setNewTicketMessage("");
        refetchTickets();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    },
  });

  const replyTicketMutation = useMutation({
    mutationFn: (ticketId: number) => customerFetch(`/api/customer/tickets/${ticketId}/reply`, {
      method: "POST",
      body: JSON.stringify({ message: replyText.trim() }),
    }),
    onSuccess: (data) => {
      if (data.success) {
        setReplyText("");
        refetchTicketMsgs();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    },
  });

  const generateKeyMutation = useMutation({
    mutationFn: () => customerFetch("/api/customer/api-keys", {
      method: "POST",
      body: JSON.stringify({ label: newKeyLabel.trim() }),
    }),
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "API key generated!", description: "Copy it now — it won't be shown in full again" });
        setNewKeyLabel("");
        queryClient.invalidateQueries({ queryKey: ["/api/customer/api-keys"] });
        if (data.apiKey) setRevealedKeys((prev) => new Set(Array.from(prev).concat([data.apiKey.id])));
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (id: number) => customerFetch(`/api/customer/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "API key deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/customer/api-keys"] });
    },
  });

  const disableTotpMutation = useMutation({
    mutationFn: () => customerFetch("/api/customer/disable-totp", { method: "DELETE" }),
    onSuccess: (data) => {
      if (data.success) { toast({ title: "2FA disabled" }); refetchTotpStatus(); }
      else toast({ title: "Failed", description: data.error, variant: "destructive" });
    },
  });

  function copyKey(key: string, id: number) {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleReveal(id: number) {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const profileMutation = useMutation({
    mutationFn: (data: any) => customerFetch("/api/customer/profile", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Profile updated successfully" });
        if (data.customer?.name) {
          const stored = getCustomerData();
          localStorage.setItem("customer_data", JSON.stringify({ ...stored, name: data.customer.name }));
        }
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      } else {
        toast({ title: "Update failed", description: data.error, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  async function toggleCredentials(reference: string) {
    if (expandedCreds.has(reference)) {
      setExpandedCreds((prev) => { const n = new Set(Array.from(prev)); n.delete(reference); return n; });
      return;
    }
    if (credentialsData[reference]) {
      setExpandedCreds((prev) => new Set(Array.from(prev).concat([reference])));
      return;
    }
    setLoadingCreds((prev) => new Set(Array.from(prev).concat([reference])));
    try {
      const data = await customerFetch(`/api/customer/orders/${reference}/credentials`);
      if (data.success) {
        setCredentialsData((prev) => ({ ...prev, [reference]: data.account }));
        setExpandedCreds((prev) => new Set(Array.from(prev).concat([reference])));
      } else {
        toast({ title: "Credentials unavailable", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load credentials", variant: "destructive" });
    } finally {
      setLoadingCreds((prev) => { const n = new Set(prev); n.delete(reference); return n; });
    }
  }

  function copyCredField(key: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    toast({ title: "Copied!" });
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "File too large", description: "Max 5MB allowed", variant: "destructive" }); return; }
    // Show instant preview
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Upload
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const res = await fetch("/api/customer/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      const data = await res.json();
      if (data.success) {
        const stored = getCustomerData();
        localStorage.setItem("customer_data", JSON.stringify({ ...stored, avatarUrl: data.avatarUrl }));
        toast({ title: "Profile photo updated!" });
      } else {
        toast({ title: "Upload failed", description: data.error, variant: "destructive" });
        setAvatarPreview(null);
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    setAvatarUploading(true);
    try {
      const res = await fetch("/api/customer/avatar", { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.success) {
        const stored = getCustomerData();
        localStorage.setItem("customer_data", JSON.stringify({ ...stored, avatarUrl: null }));
        setAvatarPreview(null);
        toast({ title: "Profile photo removed" });
      }
    } catch {
      toast({ title: "Failed to remove photo", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  }

  function handleProfileSave() {
    if (newPassword && newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" }); return;
    }
    const updates: any = {};
    if (profileName.trim()) updates.name = profileName.trim();
    if (newPassword) { updates.currentPassword = currentPassword; updates.newPassword = newPassword; }
    if (!Object.keys(updates).length) {
      toast({ title: "No changes to save", variant: "destructive" }); return;
    }
    profileMutation.mutate(updates);
  }

  function logout() {
    fetch("/api/auth/logout", { method: "POST", headers: customerHeaders() }).catch(() => {});
    clearAuth();
    setLocation("/");
    toast({ title: "Logged out successfully" });
  }

  async function startTotpSetup() {
    setTotpLoading(true); setTotpError("");
    try {
      const data = await customerFetch("/api/customer/setup-totp", { method: "POST" });
      if (data.success) { setTotpSetupData({ secret: data.secret, qrCodeDataUrl: data.qrCodeDataUrl }); setTotpStep("qr"); }
      else setTotpError(data.error || "Failed to generate QR code");
    } catch { setTotpError("Connection error"); }
    finally { setTotpLoading(false); }
  }

  async function verifyTotpSetup() {
    if (totpCode.length !== 6) { setTotpError("Enter the 6-digit code"); return; }
    setTotpLoading(true); setTotpError("");
    try {
      const data = await customerFetch("/api/customer/verify-totp", {
        method: "POST",
        body: JSON.stringify({ secret: totpSetupData?.secret, code: totpCode }),
      });
      if (data.success) {
        toast({ title: "2FA enabled!", description: "Your account is now protected" });
        setTotpStep("idle"); setTotpSetupData(null); setTotpCode("");
        refetchTotpStatus();
      } else setTotpError(data.error || "Invalid code");
    } catch { setTotpError("Connection error"); }
    finally { setTotpLoading(false); }
  }

  const orders = ordersData?.orders ?? [];
  const apiKeys = keysData?.keys ?? [];
  const totpEnabled = totpStatus?.totpEnabled ?? false;

  const inputCls = "bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-indigo-500/50";

  return (
    <>
    {isUnverified && (
        <div className="fixed top-0 inset-x-0 z-50 bg-gradient-to-r from-amber-500/95 to-orange-500/95 backdrop-blur-sm text-white px-4 py-2.5 shadow-lg border-b border-amber-300/30" data-testid="banner-unverified">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-3 text-sm">
            <Mail className="w-4 h-4 shrink-0" />
            <span className="font-medium">Your email isn't verified yet.</span>
            <span className="text-white/85 hidden sm:inline">Some features may be limited.</span>
            <button
              onClick={resendVerificationLink}
              disabled={resending || resentOk}
              data-testid="button-resend-verify-banner"
              className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 disabled:opacity-50 text-xs font-bold border border-white/30 flex items-center gap-1.5"
            >
              {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {resentOk ? "Link sent ✓" : resending ? "Sending..." : "Resend verification link"}
            </button>
          </div>
        </div>
      )}
      <div className="min-h-screen relative overflow-hidden" style={{
      background: "radial-gradient(900px 700px at 15% 25%, rgba(99,102,241,.15), transparent 55%), radial-gradient(700px 600px at 85% 80%, rgba(168,85,247,.12), transparent 55%), linear-gradient(140deg, #0b1020, #0d0724)"
    }}>
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute rounded-full" style={{ width: 500, height: 500, top: -150, left: -100, background: "radial-gradient(circle, rgba(99,102,241,.25), transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute rounded-full" style={{ width: 400, height: 400, bottom: -100, right: -80, background: "radial-gradient(circle, rgba(168,85,247,.2), transparent 70%)", filter: "blur(40px)" }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} className="text-white/40 hover:text-white transition-colors mr-1" data-testid="link-back-home">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div
              className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer relative group"
              style={{ background: "linear-gradient(135deg, rgba(99,102,241,.6), rgba(168,85,247,.6))", boxShadow: "0 0 20px rgba(99,102,241,.3)" }}
              onClick={() => setTab("profile")}
              title="Edit profile photo"
            >
              {(avatarPreview || customer?.avatarUrl) ? (
                <img src={avatarPreview || customer.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <p className="font-bold text-white">{customer?.name || customer?.email}</p>
              <p className="text-xs text-white/40">{customer?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifDropdown(!showNotifDropdown);
                  if (!showNotifDropdown && (notifData?.unread ?? 0) > 0) markReadMutation.mutate();
                }}
                className="relative p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                data-testid="button-notifications"
              >
                {(notifData?.unread ?? 0) > 0 ? (
                  <>
                    <BellDot className="w-5 h-5 text-indigo-400" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                  </>
                ) : (
                  <Bell className="w-5 h-5" />
                )}
              </button>
              {showNotifDropdown && (
                <div
                  className="absolute right-0 top-10 w-80 rounded-xl border border-white/10 shadow-2xl z-50"
                  style={{ background: "rgba(15,15,25,.97)", backdropFilter: "blur(20px)" }}
                >
                  <div className="p-3 border-b border-white/8 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Notifications</span>
                    <button onClick={() => setShowNotifDropdown(false)} className="text-white/30 hover:text-white text-xs">✕</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {(notifData?.notifications ?? []).length === 0 ? (
                      <div className="text-center py-8">
                        <Bell className="w-6 h-6 text-white/15 mx-auto mb-2" />
                        <p className="text-white/30 text-xs">No notifications yet</p>
                      </div>
                    ) : (notifData?.notifications ?? []).map((notif: any) => {
                      const iconMap: Record<string, string> = { order: "✅", ticket: "💬", wallet: "💰", referral: "🎁" };
                      const icon = iconMap[notif.type] || "🔔";
                      return (
                        <div
                          key={notif.id}
                          className={`p-3 border-b border-white/5 last:border-0 ${!notif.read ? "bg-indigo-500/5" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-base">{icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white">{notif.title}</p>
                              <p className="text-xs text-white/50 mt-0.5">{notif.message}</p>
                              <p className="text-xs text-white/25 mt-1">{new Date(notif.createdAt).toLocaleDateString()}</p>
                            </div>
                            {!notif.read && <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1 flex-shrink-0" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-white/40 hover:text-white hover:bg-white/5"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-1.5" />Logout
            </Button>
          </div>
        </div>

        {/* Announcements Banner */}
        {(announcementsData?.announcements ?? [])
          .filter((a: any) => !dismissedAnns.has(a.id))
          .map((a: any) => {
            const colors: Record<string, string> = {
              info: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
              warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
              success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
              urgent: "border-red-500/40 bg-red-500/10 text-red-300",
            };
            const cls = colors[a.type] || colors.info;
            return (
              <div key={a.id} className={`mb-3 px-4 py-3 rounded-xl border flex items-start gap-3 ${cls}`}>
                <Bell className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs opacity-80 mt-0.5">{a.message}</p>
                  {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-xs underline mt-1 inline-block opacity-70 hover:opacity-100">{a.linkLabel || a.link}</a>}
                </div>
                <button onClick={() => dismissAnn(a.id)} className="shrink-0 opacity-40 hover:opacity-70 transition-opacity mt-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1.5 rounded-xl border border-white/10 w-fit flex-wrap" style={{ background: "rgba(255,255,255,.04)" }}>
          {([
            { id: "orders", label: "My Products", icon: Package },
            { id: "my-bots", label: "My Bots", icon: Bot },
            { id: "wallet", label: "Wallet", icon: Wallet },
            { id: "referral", label: "Referral", icon: Gift },
            { id: "receipts", label: "Receipts", icon: Download },
            { id: "payment-history", label: "Payments", icon: History },
            { id: "support", label: "Support", icon: MessageCircle },
            { id: "requests", label: "Ideas", icon: Sparkles },
            { id: "apikeys", label: "API Keys", icon: Key },
            { id: "security", label: "Security", icon: Shield },
            { id: "profile", label: "Profile", icon: User },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-testid={`tab-${id}`}
              onClick={() => setTab(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={tab === id ? {
                background: "linear-gradient(90deg, rgba(99,102,241,.5), rgba(168,85,247,.4))",
                color: "rgba(255,255,255,.95)",
                boxShadow: "0 6px 20px rgba(0,0,0,.25)",
              } : { color: "rgba(255,255,255,.45)" }}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* ORDERS TAB */}
        {tab === "orders" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">Purchase History</h2>
              <Badge className="bg-white/10 text-white/60 border-white/10">{orders.length + ((myBotsData?.bots ?? []).length)} orders</Badge>
            </div>
            {ordersLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : orders.length === 0 && (myBotsData?.bots ?? []).length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-white/8" style={{ background: "rgba(255,255,255,.03)" }}>
                <ShoppingBag className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 font-medium">No orders yet</p>
                <p className="text-white/25 text-sm mt-1">Your subscription purchases will appear here</p>
                <Button onClick={() => setLocation("/")} size="sm" className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white" data-testid="button-shop-now">
                  Browse Plans
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order: any) => {
                  const statusConf = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = statusConf.icon;
                  const isExpanded = expandedCreds.has(order.reference);
                  const creds = credentialsData[order.reference];
                  const isLoadingCreds = loadingCreds.has(order.reference);
                  return (
                    <div
                      key={order.id}
                      data-testid={`card-order-${order.id}`}
                      className="rounded-xl border border-white/8 overflow-hidden"
                      style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}
                    >
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,.2)" }}>
                            <ShoppingBag className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white text-sm truncate" data-testid={`text-order-plan-${order.id}`}>{order.planName}</p>
                            <p className="text-xs text-white/40 font-mono">{order.reference?.split("-").slice(-1)[0]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-indigo-300" data-testid={`text-order-amount-${order.id}`}>KES {order.amount?.toLocaleString()}</p>
                            <p className="text-xs text-white/30">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}</p>
                          </div>
                          <div className={`flex items-center gap-1 text-xs font-semibold ${statusConf.color}`} data-testid={`status-order-${order.id}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConf.label}
                          </div>
                          {order.status === "success" && (
                            <>
                              <button
                                onClick={() => toggleCredentials(order.reference)}
                                disabled={isLoadingCreds}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/10 transition-all"
                                data-testid={`button-view-creds-${order.id}`}
                              >
                                {isLoadingCreds ? <Loader2 className="w-3 h-3 animate-spin" /> : isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {isExpanded ? "Hide" : "Credentials"}
                              </button>
                              <a
                                href={`/api/customer/orders/${order.reference}/receipt`}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  const resp = await fetch(`/api/customer/orders/${order.reference}/receipt`, { headers: { Authorization: `Bearer ${getToken()}` } });
                                  const blob = await resp.blob();
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url; a.download = `receipt-${order.reference}.pdf`; a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-emerald-400/70 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all"
                                title="Download PDF receipt"
                              >
                                <Download className="w-3 h-3" />
                              </a>
                              {submittedRatings[order.reference] ? (
                                <div className="flex items-center gap-0.5 px-2 py-1.5" title="Your rating">
                                  {[1,2,3,4,5].map(s => (
                                    <Star key={s} className={`w-3 h-3 ${s <= submittedRatings[order.reference] ? "text-amber-400 fill-amber-400" : "text-white/20"}`} />
                                  ))}
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setRatingModal({ reference: order.reference, planName: order.planName }); setRatingStars(0); setRatingComment(""); }}
                                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-amber-400/70 border border-amber-500/20 hover:bg-amber-500/10 transition-all"
                                  title="Rate this order"
                                >
                                  <Star className="w-3 h-3" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {isExpanded && creds && (
                        <div className="border-t border-white/8 p-4 space-y-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                            <p className="text-xs text-amber-400/80">Keep these safe — do not share with anyone</p>
                          </div>
                          {[
                            { key: "email", label: "Email" },
                            { key: "password", label: "Password" },
                            { key: "username", label: "Username" },
                            { key: "activationCode", label: "Activation Code" },
                            { key: "redeemLink", label: "Redeem Link" },
                            { key: "instructions", label: "Instructions" },
                          ].filter(({ key }) => creds[key]).map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                              <div className="min-w-0">
                                <p className="text-xs text-white/40">{label}</p>
                                <p className="text-sm text-white font-mono break-all">{creds[key]}</p>
                              </div>
                              <button
                                onClick={() => copyCredField(`${order.reference}-${key}`, creds[key])}
                                className="shrink-0 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                                data-testid={`button-copy-${key}-${order.id}`}
                              >
                                {copiedField === `${order.reference}-${key}` ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* RECEIPTS TAB */}
        {tab === "receipts" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-400" /> Invoice Portal
            </h2>
            <p className="text-sm text-white/40">Download PDF receipts for all your completed orders.</p>
            {ordersLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
            ) : (() => {
              const receipts = (ordersData?.orders ?? []).filter((o: any) => o.status === "success");
              if (!receipts.length) return (
                <div className="text-center py-16 rounded-xl border border-white/10" style={{ background: "rgba(255,255,255,.03)" }}>
                  <Download className="w-10 h-10 text-white/15 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No completed orders yet</p>
                </div>
              );
              return (
                <div className="space-y-2">
                  {receipts.map((order: any) => (
                    <div key={order.reference} className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border border-white/8 hover:border-white/15 transition-colors" style={{ background: "rgba(255,255,255,.03)" }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                          <Download className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white/90 truncate">{order.planName}</p>
                          <p className="text-xs text-white/35">{new Date(order.createdAt).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" })} · KES {(order.amount ?? 0).toLocaleString()} · Ref: {order.reference}</p>
                        </div>
                      </div>
                      <a
                        href={`/api/customer/orders/${order.reference}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        onClick={() => {
                          const el = document.createElement("a");
                          el.href = `/api/customer/orders/${order.reference}/receipt`;
                          el.setAttribute("download", `receipt-${order.reference}.pdf`);
                          Object.assign(el.style, { position: "fixed", left: "-9999px" });
                          document.body.appendChild(el);
                          const headers: Record<string, string> = {};
                          const token = localStorage.getItem("customer_token") || "";
                          if (token) headers["Authorization"] = `Bearer ${token}`;
                          fetch(`/api/customer/orders/${order.reference}/receipt`, { headers })
                            .then(r => r.blob())
                            .then(blob => {
                              const url = URL.createObjectURL(blob);
                              el.href = url;
                              el.click();
                              setTimeout(() => URL.revokeObjectURL(url), 5000);
                            })
                            .finally(() => document.body.removeChild(el));
                        }}
                        className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </a>
                    </div>
                  ))}
                </div>
              );
            })()}
            {/* Bot Purchases inside My Products */}
            {(myBotsData?.bots ?? []).length > 0 && (
              <div className="space-y-3 mt-3">
                {(myBotsData?.bots ?? []).map((bot: any) => {
                  const statusMap: Record<string, { label: string; color: string; icon: any }> = {
                    paid:          { label: "Paid",        color: "text-emerald-400", icon: CheckCircle },
                    deployed:      { label: "Deployed",    color: "text-emerald-400", icon: CheckCircle },
                    pending:       { label: "Pending",     color: "text-amber-400",   icon: Clock },
                    deploying:     { label: "Deploying",   color: "text-amber-400",   icon: Clock },
                    failed:        { label: "Failed",      color: "text-red-400",     icon: XCircle },
                    deploy_failed: { label: "Failed",      color: "text-red-400",     icon: XCircle },
                    stopped:       { label: "Stopped",     color: "text-white/40",    icon: XCircle },
                    suspended:     { label: "Suspended",   color: "text-red-400",     icon: XCircle },
                  };
                  const sc = statusMap[bot.status] ?? { label: bot.status || "Unknown", color: "text-white/40", icon: Clock };
                  const SIcon = sc.icon;
                  return (
                    <div key={`bot-${bot.id}`} data-testid={`card-bot-order-${bot.id}`} className="rounded-xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,.2)" }}>
                            <Bot className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{bot.bot_name || "WhatsApp Bot"}</p>
                            <p className="text-xs text-white/40 font-mono">Bot Order #{bot.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-indigo-300">KES {Number(bot.amount || 0).toLocaleString()}</p>
                            <p className="text-xs text-white/30">{bot.created_at ? new Date(bot.created_at).toLocaleDateString() : ""}</p>
                          </div>
                          <div className={`flex items-center gap-1 text-xs font-semibold ${sc.color}`}>
                            <SIcon className="w-3.5 h-3.5" />
                            {sc.label}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* WALLET TAB */}
        {/* MY BOTS TAB */}
        {tab === "my-bots" && (() => {
          const allBots: any[] = myBotsData?.bots ?? [];
          const deployedBots = allBots.filter((b: any) => b.status === "deployed");
          const otherBots    = allBots.filter((b: any) => b.status !== "deployed");

          const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
            deployed:     { label: "Running",        color: "text-emerald-400", bg: "bg-emerald-500/10" },
            paid:         { label: "Pending Deploy",  color: "text-amber-400",  bg: "bg-amber-500/10" },
            deploy_failed:{ label: "Deploy Failed",   color: "text-red-400",    bg: "bg-red-500/10" },
            configuring:  { label: "Configuring",     color: "text-blue-400",   bg: "bg-blue-500/10" },
            deploying:    { label: "Deploying",       color: "text-indigo-400", bg: "bg-indigo-500/10" },
            stopped:      { label: "Stopped",         color: "text-gray-400",   bg: "bg-gray-500/10" },
            suspended:    { label: "Suspended",       color: "text-red-400",    bg: "bg-red-500/10" },
            pending:      { label: "Pending",         color: "text-amber-400",  bg: "bg-amber-500/10" },
          };

          const BotCard = ({ bot }: { bot: any }) => {
            const s = statusConfig[bot.status] ?? { label: bot.status, color: "text-white/40", bg: "bg-white/5" };
            const features = (() => { try { return JSON.parse(bot.bot_features || "[]"); } catch { return []; } })();
            const daysLeft = bot.expires_at ? Math.ceil((new Date(bot.expires_at).getTime() - Date.now()) / 86400000) : null;
            return (
              <div key={bot.id} className="rounded-2xl border border-white/8 p-4" style={{ background: "rgba(255,255,255,.03)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{bot.bot_name || "WhatsApp Bot"}</p>
                      {bot.deployed_at ? (
                        <p className="text-xs text-white/40 mt-0.5">
                          Last updated: {(() => {
                            const diff = Date.now() - new Date(bot.deployed_at).getTime();
                            if (diff < 60000) return "just now";
                            if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
                            if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
                            return new Date(bot.deployed_at).toLocaleDateString();
                          })()}
                        </p>
                      ) : (
                        <p className="text-xs text-white/40 mt-0.5">Ordered {new Date(bot.created_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>{s.label}</span>
                    {bot.deployed_at && Date.now() - new Date(bot.deployed_at).getTime() < 86400000 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">🆕 Updated</span>
                    )}
                  </div>
                </div>
                {(bot.pm2_name || bot.vps_label) && (
                  <div className="mt-3 flex items-center gap-3 flex-wrap text-xs text-white/40">
                    {bot.pm2_name && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/30">PM2:</span>
                        <span className="font-mono bg-white/5 px-2 py-1 rounded-lg text-indigo-300">{bot.pm2_name}</span>
                      </div>
                    )}
                    {bot.vps_label && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/30">Server:</span>
                        <span className="bg-white/5 px-2 py-1 rounded-lg text-white/60">{bot.vps_label}</span>
                      </div>
                    )}
                  </div>
                )}
                {bot.status === "deployed" && (botUptimeMap[bot.id] || []).length > 0 && (() => {
                  const pings = botUptimeMap[bot.id];
                  const buckets: string[] = [];
                  for (let h = 167; h >= 0; h--) {
                    const st = Date.now() - h * 3600000, e2 = st + 3600000;
                    const inB = pings.filter((p: any) => { const t = new Date(p.checked_at).getTime(); return t >= st && t < e2; });
                    if (!inB.length) { buckets.push("empty"); continue; }
                    buckets.push(inB.filter((p: any) => p.pm2_status === "online").length / inB.length >= 0.5 ? "online" : "offline");
                  }
                  const pct = Math.round((buckets.filter(b => b === "online").length / 168) * 100);
                  return (<div className="mt-3"><div className="flex items-center justify-between text-[10px] text-white/30 mb-1"><span>7-day uptime</span><span className={pct >= 95 ? "text-emerald-400" : pct >= 80 ? "text-amber-400" : "text-red-400"}>{pct}%</span></div><div className="flex gap-px h-3">{buckets.map((b, idx) => <div key={idx} className={`flex-1 rounded-sm ${b === "online" ? "bg-emerald-500/70" : b === "offline" ? "bg-red-500/60" : "bg-white/5"}`} />)}</div></div>);
                })()}
                {daysLeft !== null && bot.status === "deployed" && daysLeft <= 14 && (
                  <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border w-fit ${daysLeft <= 0 ? "text-red-400 bg-red-500/10 border-red-500/20" : daysLeft <= 3 ? "text-red-400 bg-red-500/10 border-red-500/20" : daysLeft <= 7 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"}`}>
                    <Bell className="w-3 h-3" />{daysLeft <= 0 ? "Expired" : `Expires in ${daysLeft}d`}
                  </div>
                )}
                {daysLeft !== null && bot.status === "deployed" && daysLeft > 0 && daysLeft <= 7 && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Your bot expires in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>. Renew to keep it running.</span>
                  </div>
                )}
                {features.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {features.slice(0, 4).map((f: string) => (
                      <span key={f} className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/50">{f}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2 flex-wrap">
                  {(bot.status === "deploy_failed" || bot.status === "stopped") ? (
                    <a href="/bots" className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors">Redeploy / Renew</a>
                  ) : bot.status === "deployed" ? (
                    <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium">✓ Bot is live</span>
                  ) : bot.status === "paid" || bot.status === "pending" ? (
                    <span className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 font-medium">⏳ Awaiting deployment</span>
                  ) : null}
                  <button onClick={() => openManageBot(bot.id)} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 font-medium transition-colors flex items-center gap-1.5" data-testid={`button-manage-bot-${bot.id}`}>
                    <Server className="w-3 h-3" />Manage
                  </button>
                  <a href="/bots" className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 font-medium transition-colors">Get Another Bot</a>
                </div>
              </div>
            );
          };

          return (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">My WhatsApp Bots</h2>
                <span className="text-xs text-white/40">{deployedBots.length} running · {allBots.length} total</span>
              </div>

              {myBotsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                </div>
              ) : allBots.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-white/8" style={{ background: "rgba(255,255,255,.02)" }}>
                  <Bot className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">No bots yet</p>
                  <a href="/bots" className="inline-block mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">Browse Bots</a>
                </div>
              ) : (
                <>
                  {/* ── DEPLOYED BOTS ─────────────────────────── */}
                  {deployedBots.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <h3 className="text-sm font-semibold text-emerald-400">Deployed Bots</h3>
                        <span className="text-xs text-white/25 ml-auto">{deployedBots.length} running</span>
                      </div>
                      {deployedBots.map((bot: any) => <BotCard key={bot.id} bot={bot} />)}
                    </div>
                  )}

                  {/* ── OTHER BOTS ────────────────────────────── */}
                  {otherBots.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-white/20" />
                        <h3 className="text-sm font-semibold text-white/50">Other Bots</h3>
                        <span className="text-xs text-white/25 ml-auto">{otherBots.length} order{otherBots.length !== 1 ? "s" : ""}</span>
                      </div>
                      {otherBots.map((bot: any) => <BotCard key={bot.id} bot={bot} />)}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {tab === "wallet" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">My Wallet</h2>
            {walletLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
            ) : (
              <>
                <div className="rounded-2xl p-6 border border-white/10" style={{ background: "linear-gradient(135deg, rgba(99,102,241,.25), rgba(168,85,247,.15))" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Wallet className="w-6 h-6 text-indigo-400" />
                      <span className="text-white/60 text-sm font-medium">Available Balance</span>
                    </div>
                  </div>
                  <p className="text-4xl font-bold text-white">KES {(walletData?.balance ?? 0).toLocaleString()}</p>
                  <p className="text-white/40 text-xs mt-2">Earn by referring friends • Top up with Paystack • Use at checkout</p>
                </div>

                {/* Top-Up Section */}
                <div className="rounded-xl p-5 border border-emerald-500/20" style={{ background: "rgba(16,185,129,.06)" }}>
                  <h3 className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Top Up Wallet
                  </h3>
                  <div className="flex gap-2 mb-3">
                    {[500, 1000, 2000, 5000].map(amt => (
                      <button key={amt} onClick={() => setTopupAmount(String(amt))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${topupAmount === String(amt) ? "bg-emerald-600 border-emerald-500 text-white" : "border-white/10 text-white/50 hover:border-emerald-500/50 hover:text-white/80"}`}>
                        {amt >= 1000 ? `${amt/1000}K` : amt}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mb-2">
                    <Input
                      type="number"
                      placeholder="Custom amount (min KES 50)"
                      value={topupAmount}
                      onChange={e => setTopupAmount(e.target.value)}
                      className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/25"
                    />
                    <Button onClick={initiateWalletTopup} disabled={topupLoading || !topupAmount}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 shrink-0">
                      {topupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Top Up"}
                    </Button>
                  </div>
                  <Input
                    placeholder="Label / note (e.g. Welcome Bonus, Promo Credit) — optional"
                    value={topupLabel}
                    onChange={e => setTopupLabel(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-xs h-8"
                  />
                  {topupLabel && (
                    <p className="text-xs text-emerald-400/70 mt-1">This will appear as <strong>{topupLabel}</strong> in your wallet history</p>
                  )}
                </div>

                {/* ── Send to Friend (P2P Transfer) ── */}
                <div className="rounded-xl p-5 border border-indigo-500/20" style={{ background: "rgba(99,102,241,.06)" }}>
                  <h3 className="text-sm font-semibold text-indigo-300 mb-3 flex items-center gap-2">
                    <Send className="w-4 h-4" /> Send to Friend
                    <span className="text-xs text-white/25 font-normal ml-1">· Min KES 10</span>
                  </h3>

                  {sendSuccess ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-300">Transfer sent!</p>
                        <p className="text-xs text-white/50">KES {sendSuccess.amount.toLocaleString()} sent to {sendSuccess.recipient}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder="Email address or Customer ID (e.g. 42)"
                            value={sendEmail}
                            onChange={e => { setSendEmail(e.target.value); setSendConfirm(false); }}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/25"
                          />
                          {sendEmail.trim() && (
                            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold px-1.5 py-0.5 rounded ${sendRecipientIsEmail ? "bg-emerald-500/20 text-emerald-400" : sendRecipientIsId ? "bg-indigo-500/20 text-indigo-400" : "bg-red-500/20 text-red-400"}`}>
                              {sendRecipientIsEmail ? "Email" : sendRecipientIsId ? "ID" : "Invalid"}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Amount (min KES 10)"
                            value={sendAmount}
                            onChange={e => { setSendAmount(e.target.value); setSendConfirm(false); }}
                            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/25"
                          />
                          <Button
                            onClick={sendWalletBalance}
                            disabled={sendLoading || !sendEmail.trim() || !sendAmount || (!sendRecipientIsEmail && !sendRecipientIsId)}
                            className={`shrink-0 font-semibold px-4 ${sendConfirm ? "bg-amber-600 hover:bg-amber-500 animate-pulse" : "bg-indigo-600 hover:bg-indigo-500"} text-white`}
                          >
                            {sendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : sendConfirm ? "Confirm Send" : "Send"}
                          </Button>
                        </div>
                        <Input
                          placeholder="Note / message (optional)"
                          value={sendNote}
                          onChange={e => setSendNote(e.target.value)}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-xs h-8"
                        />
                      </div>
                      {sendConfirm && (
                        <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2">
                          <p className="text-xs text-amber-300">
                            Send <strong>KES {parseFloat(sendAmount).toLocaleString()}</strong> to{" "}
                            <strong>{sendRecipientIsId ? `Customer #${sendEmail}` : sendEmail}</strong>?
                          </p>
                          <button onClick={() => setSendConfirm(false)} className="text-white/30 hover:text-white/60 text-xs">Cancel</button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {spendingStats && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl p-3 border border-white/10 text-center" style={{ background: "rgba(255,255,255,.03)" }}>
                      <ShoppingCart className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{spendingStats.totalOrders ?? 0}</p>
                      <p className="text-xs text-white/40">Orders</p>
                    </div>
                    <div className="rounded-xl p-3 border border-white/10 text-center" style={{ background: "rgba(255,255,255,.03)" }}>
                      <TrendingDown className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">KES {(spendingStats.totalSpent ?? 0).toLocaleString()}</p>
                      <p className="text-xs text-white/40">Total Spent</p>
                    </div>
                    <div className="rounded-xl p-3 border border-white/10 text-center" style={{ background: "rgba(255,255,255,.03)" }}>
                      <Star className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                      <p className="text-xs font-bold text-white truncate">{spendingStats.topPlan ?? "—"}</p>
                      <p className="text-xs text-white/40">Fav Plan</p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl p-4 border border-white/10" style={{ background: "rgba(255,255,255,.03)" }}>
                  <h3 className="text-sm font-semibold text-white/70 mb-3">Transaction History</h3>
                  {(walletData?.transactions ?? []).length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-8">No wallet transactions yet. Refer a friend to earn credits!</p>
                  ) : (
                    <div className="space-y-2">
                      {(walletData?.transactions ?? []).map((txn: any) => (
                        <div key={txn.id} className="flex items-center justify-between p-3 rounded-lg border border-white/8" style={{ background: "rgba(255,255,255,.03)" }}>
                          <div className="flex items-center gap-3">
                            {txn.type === "credit" ? (
                              <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <ArrowDownCircle className="w-5 h-5 text-red-400" />
                            )}
                            <div>
                              <p className="text-sm text-white/80 font-medium">{txn.description}</p>
                              <p className="text-xs text-white/30">{new Date(txn.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <span className={`font-bold text-sm ${txn.type === "credit" ? "text-emerald-400" : "text-red-400"}`}>
                            {txn.type === "credit" ? "+" : "-"}KES {txn.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* REFERRAL TAB */}
        {tab === "referral" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Referral Program</h2>
              {referralTier && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  referralTier.tier === "Platinum" ? "bg-violet-500/20 border-violet-500/40 text-violet-300" :
                  referralTier.tier === "Gold" ? "bg-amber-500/20 border-amber-500/40 text-amber-300" :
                  referralTier.tier === "Silver" ? "bg-slate-400/20 border-slate-400/40 text-slate-300" :
                  "bg-white/5 border-white/10 text-white/50"
                }`}>
                  <Trophy className="w-3 h-3" />
                  {referralTier.tier} Affiliate
                  {referralTier.multiplier > 1 && <span className="opacity-70">· {referralTier.multiplier}x</span>}
                </div>
              )}
            </div>
            {referralLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Referrals", value: referralData?.stats?.totalReferrals ?? 0, icon: Link2, color: "text-indigo-400" },
                    { label: "Completed", value: referralData?.stats?.completedReferrals ?? 0, icon: CheckCircle, color: "text-emerald-400" },
                    { label: "Total Earned", value: `KES ${referralData?.stats?.totalEarned ?? 0}`, icon: TrendingUp, color: "text-amber-400" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="rounded-xl p-4 border border-white/10 text-center" style={{ background: "rgba(255,255,255,.04)" }}>
                      <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
                      <p className="text-xl font-bold text-white">{value}</p>
                      <p className="text-xs text-white/40">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Affiliate Tiers Card */}
                <div className="rounded-xl p-4 border border-white/10" style={{ background: "rgba(255,255,255,.03)" }}>
                  <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2"><Trophy className="w-3.5 h-3.5 text-amber-400" /> Affiliate Tiers</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { tier: "Silver", min: 5, multiplier: 1.25, color: "text-slate-300", bg: "rgba(148,163,184,.1)", border: "border-slate-400/20" },
                      { tier: "Gold", min: 15, multiplier: 1.5, color: "text-amber-300", bg: "rgba(245,158,11,.1)", border: "border-amber-500/20" },
                      { tier: "Platinum", min: 30, multiplier: 2.0, color: "text-violet-300", bg: "rgba(139,92,246,.1)", border: "border-violet-500/20" },
                    ].map(t => (
                      <div key={t.tier} className={`p-3 rounded-lg border ${t.border} text-center`} style={{ background: t.bg }}>
                        <p className={`text-sm font-bold ${t.color}`}>{t.tier}</p>
                        <p className="text-xs text-white/40">{t.min}+ referrals</p>
                        <p className={`text-xs font-semibold ${t.color} mt-1`}>{t.multiplier}x reward</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-5 border border-white/10" style={{ background: "rgba(255,255,255,.04)" }}>
                  <h3 className="text-sm font-semibold text-white mb-3">Your Referral Link</h3>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={referralData?.link ?? ""}
                      className="flex-1 text-white/60 text-xs bg-white/5 border-white/10"
                    />
                    <Button
                      size="sm"
                      onClick={() => copyReferralLink(referralData?.link ?? "")}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      {copiedReferral ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-white/30 mt-2">Referral code: <span className="font-mono text-white/60">{referralData?.code ?? "—"}</span></p>
                </div>
                <div className="rounded-xl p-4 border border-amber-500/20" style={{ background: "rgba(245,158,11,.06)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-amber-300">🎯 10-Referral Milestone</h3>
                    <span className="text-xs text-amber-400 font-bold">{referralData?.stats?.completedReferrals ?? 0}/10</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 mb-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
                      style={{ width: `${Math.min(100, ((referralData?.stats?.completedReferrals ?? 0) / 10) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-amber-200/60">
                    {(referralData?.stats?.completedReferrals ?? 0) >= 10
                      ? "🎉 Milestone unlocked! Check your email for your free subscription."
                      : `Refer ${10 - (referralData?.stats?.completedReferrals ?? 0)} more friend${10 - (referralData?.stats?.completedReferrals ?? 0) === 1 ? "" : "s"} to unlock a FREE Netflix or Showmax subscription!`
                    }
                  </p>
                </div>
                <div className="rounded-xl p-4 border border-indigo-500/20" style={{ background: "rgba(99,102,241,.08)" }}>
                  <h3 className="text-sm font-semibold text-indigo-300 mb-2">How it works</h3>
                  <ul className="space-y-1.5 text-xs text-white/50">
                    <li>• Share your referral link with friends</li>
                    <li>• They sign up using your link and make their first purchase</li>
                    <li>• You earn <span className="text-emerald-400 font-semibold">KES 100</span> wallet credit on their first purchase</li>
                    <li>• Earn <span className="text-emerald-400 font-semibold">KES 50</span> every time your referral makes any future purchase</li>
                    <li>• Your friend also gets <span className="text-emerald-400 font-semibold">KES 50</span> as a welcome bonus</li>
                    <li>• Reach <span className="text-amber-400 font-semibold">Silver/Gold/Platinum</span> tier for higher commission multipliers</li>
                    <li>• Get <span className="text-amber-400 font-semibold">10 referrals</span> and receive a <span className="text-amber-400 font-semibold">FREE Netflix or Showmax</span> account!</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {/* PAYMENT HISTORY TAB */}
        {tab === "payment-history" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Payment History</h2>
            {payHistLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
            ) : (
              <>
                <div className="rounded-xl p-4 border border-white/10" style={{ background: "rgba(255,255,255,.03)" }}>
                  <h3 className="text-sm font-semibold text-white/70 mb-3">Subscription Purchases</h3>
                  {(payHistData?.orders ?? []).length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-8">No purchases yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(payHistData?.orders ?? []).map((order: any) => {
                        const st = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
                        return (
                          <div key={order.reference} className="flex items-center justify-between p-3 rounded-lg border border-white/8" style={{ background: "rgba(255,255,255,.03)" }}>
                            <div>
                              <p className="text-sm text-white/80 font-medium">{order.planName || "Subscription"}</p>
                              <p className="text-xs text-white/30">{order.reference} · {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-white">KES {(order.amount / 100).toLocaleString()}</p>
                              <span className={`text-xs ${st.color}`}>{st.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="rounded-xl p-4 border border-white/10" style={{ background: "rgba(255,255,255,.03)" }}>
                  <h3 className="text-sm font-semibold text-white/70 mb-3">Wallet Transactions</h3>
                  {(payHistData?.walletTransactions ?? []).length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-8">No wallet transactions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(payHistData?.walletTransactions ?? []).map((txn: any) => (
                        <div key={txn.id} className="flex items-center justify-between p-3 rounded-lg border border-white/8" style={{ background: "rgba(255,255,255,.03)" }}>
                          <div className="flex items-center gap-3">
                            {txn.type === "credit" ? (
                              <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <ArrowDownCircle className="w-4 h-4 text-red-400" />
                            )}
                            <div>
                              <p className="text-xs text-white/70">{txn.description}</p>
                              <p className="text-xs text-white/30">{new Date(txn.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <span className={`text-sm font-bold ${txn.type === "credit" ? "text-emerald-400" : "text-red-400"}`}>
                            {txn.type === "credit" ? "+" : "-"}KES {txn.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* SUPPORT TICKETS TAB */}
        {tab === "support" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Support Tickets</h2>
              <Button
                size="sm"
                onClick={() => { setShowNewTicket(true); setSelectedTicketId(null); }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
                data-testid="button-new-ticket"
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />New Ticket
              </Button>
            </div>

            {showNewTicket && (
              <div className="rounded-xl p-5 border border-indigo-500/30" style={{ background: "rgba(99,102,241,.08)" }}>
                <h3 className="text-sm font-semibold text-white mb-3">Create New Support Ticket</h3>
                <div className="space-y-3">
                  <Input
                    placeholder="Subject (e.g. Account activation issue)"
                    value={newTicketSubject}
                    onChange={(e) => setNewTicketSubject(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder-white/30"
                  />
                  <textarea
                    placeholder="Describe your issue in detail..."
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 bg-white/5 border border-white/10 resize-none outline-none focus:border-indigo-500/50"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => createTicketMutation.mutate()}
                      disabled={!newTicketMessage.trim() || createTicketMutation.isPending}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      {createTicketMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      <span className="ml-1.5">Submit</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewTicket(false)} className="text-white/40 hover:text-white">
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selectedTicketId && ticketMessagesData?.success && (
              <div className="rounded-xl border border-white/10" style={{ background: "rgba(255,255,255,.03)" }}>
                <div className="flex items-center gap-2 p-4 border-b border-white/8">
                  <button onClick={() => setSelectedTicketId(null)} className="text-white/40 hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <p className="text-sm font-semibold text-white">{ticketMessagesData.ticket?.subject || "Support Request"}</p>
                    <p className="text-xs text-white/40">Ticket #{selectedTicketId} · {ticketMessagesData.ticket?.status}</p>
                  </div>
                </div>
                <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                  {ticketMsgsLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /></div>
                  ) : (ticketMessagesData.messages ?? []).map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-xs rounded-xl px-3 py-2 text-sm ${msg.sender === "customer" ? "bg-indigo-600/40 text-white" : "bg-white/8 text-white/80"}`}>
                        <p className={`text-xs mb-1 ${msg.sender === "customer" ? "text-indigo-300" : "text-emerald-400"}`}>
                          {msg.sender === "customer" ? "You" : "Support"}
                        </p>
                        <p>{msg.message}</p>
                        <p className="text-xs text-white/30 mt-1">{new Date(msg.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {ticketMessagesData.ticket?.status !== "closed" && (
                  <div className="flex gap-2 p-4 border-t border-white/8">
                    <Input
                      placeholder="Type a reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 bg-white/5 border-white/10 text-white placeholder-white/30"
                      onKeyDown={(e) => { if (e.key === "Enter" && replyText.trim()) replyTicketMutation.mutate(selectedTicketId); }}
                    />
                    <Button
                      size="sm"
                      onClick={() => replyTicketMutation.mutate(selectedTicketId)}
                      disabled={!replyText.trim() || replyTicketMutation.isPending}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      {replyTicketMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!selectedTicketId && (
              ticketsLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
              ) : (ticketsData?.tickets ?? []).length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-white/8" style={{ background: "rgba(255,255,255,.03)" }}>
                  <Ticket className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 font-medium">No support tickets yet</p>
                  <p className="text-white/25 text-sm mt-1">Create a ticket if you need help with your account or order</p>
                  <Button size="sm" className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white" onClick={() => setShowNewTicket(true)}>
                    Open a Ticket
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {(ticketsData?.tickets ?? []).map((ticket: any) => {
                    const statusColor = ticket.status === "open" ? "text-amber-400" : ticket.status === "escalated" ? "text-red-400" : "text-emerald-400";
                    const statusDot = ticket.status === "open" ? "bg-amber-400" : ticket.status === "escalated" ? "bg-red-400" : "bg-emerald-400";
                    return (
                      <button
                        key={ticket.id}
                        onClick={() => { setSelectedTicketId(ticket.id); setShowNewTicket(false); }}
                        className="w-full flex items-center justify-between p-4 rounded-xl border border-white/8 hover:border-white/15 transition-all text-left"
                        style={{ background: "rgba(255,255,255,.03)" }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${statusDot}`} />
                          <div>
                            <p className="text-sm font-medium text-white">{ticket.subject || "Support Request"}</p>
                            <p className="text-xs text-white/30">#{ticket.id} · {new Date(ticket.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${statusColor}`}>{ticket.status}</span>
                          <ChevronDown className="w-4 h-4 text-white/20 rotate-[-90deg]" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}

        {/* API KEYS TAB */}
        {tab === "apikeys" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-bold text-white">API Keys</h2>
                <p className="text-xs text-white/40 mt-0.5">Use these keys to access the Chege Tech API</p>
              </div>
              <Badge className="bg-white/10 text-white/60 border-white/10">{apiKeys.length}/5 keys</Badge>
            </div>

            <div className="rounded-xl p-4 border border-white/10" style={{ background: "rgba(255,255,255,.04)" }}>
              <p className="text-sm font-semibold text-white mb-3">Generate New Key</p>
              <div className="flex gap-2">
                <Input
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Key label (e.g. My App)"
                  className={`flex-1 ${inputCls}`}
                  data-testid="input-key-label"
                  onKeyDown={(e) => { if (e.key === "Enter" && newKeyLabel.trim()) generateKeyMutation.mutate(); }}
                />
                <Button
                  onClick={() => generateKeyMutation.mutate()}
                  disabled={!newKeyLabel.trim() || generateKeyMutation.isPending || apiKeys.length >= 5}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
                  data-testid="button-generate-key"
                >
                  {generateKeyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Generate</>}
                </Button>
              </div>
            </div>

            {keysLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-white/8" style={{ background: "rgba(255,255,255,.03)" }}>
                <Key className="w-9 h-9 text-white/20 mx-auto mb-2" />
                <p className="text-white/40 font-medium">No API keys yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((apiKey: any) => {
                  const revealed = revealedKeys.has(apiKey.id);
                  const masked = apiKey.key.slice(0, 6) + "•".repeat(26) + apiKey.key.slice(-4);
                  return (
                    <div key={apiKey.id} data-testid={`card-apikey-${apiKey.id}`}
                      className="rounded-xl p-4 border border-white/8"
                      style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="font-semibold text-white text-sm">{apiKey.label}</span>
                          <Badge className={`text-xs border-0 ${apiKey.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                            {apiKey.active ? "Active" : "Revoked"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleReveal(apiKey.id)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                            data-testid={`button-reveal-key-${apiKey.id}`}>
                            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => copyKey(apiKey.key, apiKey.id)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                            data-testid={`button-copy-key-${apiKey.id}`}>
                            {copiedId === apiKey.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => deleteKeyMutation.mutate(apiKey.id)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            data-testid={`button-delete-key-${apiKey.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <code className="text-xs font-mono text-white/50 bg-white/5 rounded-lg px-3 py-2 block break-all" data-testid={`text-apikey-${apiKey.id}`}>
                        {revealed ? apiKey.key : masked}
                      </code>
                      <p className="text-xs text-white/25 mt-2">Created {apiKey.createdAt ? new Date(apiKey.createdAt).toLocaleDateString() : ""}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {apiKeys.length > 0 && (
              <div className="rounded-xl p-4 border border-white/10 mt-4" style={{ background: "rgba(255,255,255,.04)" }}>
                <p className="text-sm font-semibold text-white mb-1" data-testid="text-api-docs-title">API Documentation</p>
                <p className="text-xs text-white/40 mb-4">Authenticate with the <code className="bg-white/10 px-1 rounded">X-API-Key: YOUR_KEY</code> header on all requests.</p>
                <div className="space-y-2">
                  {[
                    { method: "GET", path: "/api/v1/my-profile", desc: "Your account profile (email, name, verified status)" },
                    { method: "GET", path: "/api/v1/my-orders", desc: "All your orders and their statuses" },
                    { method: "GET", path: "/api/v1/my-subscriptions", desc: "Your active subscriptions with expiry dates" },
                    { method: "GET", path: "/api/v1/my-wallet", desc: "Wallet balance + last 20 transactions" },
                    { method: "GET", path: "/api/v1/my-stats", desc: "Total spend, order count, wallet balance" },
                    { method: "GET", path: "/api/v1/my-referral", desc: "Referral code, link, earnings and counts" },
                    { method: "GET", path: "/api/v1/my-notifications", desc: "Your last 30 notifications" },
                    { method: "GET", path: "/api/v1/my-tickets", desc: "All your support tickets" },
                    { method: "POST", path: "/api/v1/tickets", desc: 'Open a support ticket — body: {"subject":"...","message":"..."}' },
                    { method: "GET", path: "/api/v1/my-credentials/:reference", desc: "Get login credentials for a completed order" },
                    { method: "GET", path: "/api/v1/store", desc: "Public store info — no API key needed" },
                  ].map(({ method, path, desc }) => (
                    <div key={path} className="rounded-lg p-3 bg-white/5 border border-white/8">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${method === "GET" ? "text-emerald-400 bg-emerald-500/15" : "text-amber-400 bg-amber-500/15"}`}>{method}</span>
                        <code className="text-xs text-white/70 font-mono truncate">{path}</code>
                      </div>
                      <p className="text-[11px] text-white/35">{desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg p-3 bg-black/30 border border-white/8">
                  <p className="text-[10px] text-white/40 font-semibold mb-1.5 uppercase tracking-wide">Example request</p>
                  <code className="text-[10px] text-indigo-300 break-all" data-testid="text-curl-profile">
                    curl -H "X-API-Key: YOUR_KEY" {window.location.origin}/api/v1/my-profile
                  </code>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FEATURE REQUESTS TAB */}
        {tab === "requests" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">Share Your Ideas 💡</h2>
              <p className="text-xs text-white/40 mt-0.5">Request new features or vote on existing ones — we build what you need</p>
            </div>

            {/* Submit form */}
            <div className="rounded-2xl border border-indigo-500/20 p-5 space-y-3" style={{ background: "rgba(99,102,241,.06)" }}>
              <p className="text-sm font-semibold text-indigo-300 flex items-center gap-2"><Sparkles className="w-4 h-4" />Suggest a Feature</p>
              <input
                value={frTitle}
                onChange={e => setFrTitle(e.target.value)}
                placeholder="What would you like us to build?"
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 placeholder:text-white/25 focus:outline-none focus:border-indigo-500/60"
              />
              <textarea
                value={frDesc}
                onChange={e => setFrDesc(e.target.value)}
                placeholder="Describe your idea in detail (optional)…"
                rows={3}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 resize-none placeholder:text-white/25 focus:outline-none focus:border-indigo-500/60"
              />
              <Button
                onClick={submitFeatureRequest}
                disabled={frSubmitting || !frTitle.trim()}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white font-bold hover:opacity-90 gap-2"
              >
                {frSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {frSubmitting ? "Submitting…" : "Submit Idea"}
              </Button>
            </div>

            {/* Existing requests */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-white/50">All Requested Features</p>
              {(frData?.requests ?? []).length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-white/8" style={{ background: "rgba(255,255,255,.03)" }}>
                  <Sparkles className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <p className="text-white/30 text-sm">No ideas yet — be the first!</p>
                </div>
              ) : (
                (frData.requests as any[]).map((r: any) => {
                  const statusColors: Record<string, string> = {
                    pending: "bg-amber-500/20 text-amber-300",
                    planned: "bg-indigo-500/20 text-indigo-300",
                    building: "bg-violet-500/20 text-violet-300",
                    done: "bg-emerald-500/20 text-emerald-300",
                    declined: "bg-red-500/20 text-red-400",
                  };
                  const st = statusColors[r.status] || statusColors.pending;
                  return (
                    <div key={r.id} className="rounded-xl border border-white/8 p-4" style={{ background: "rgba(255,255,255,.03)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st}`}>{r.status}</span>
                          </div>
                          <p className="text-white font-semibold text-sm">{r.title}</p>
                          {r.description && <p className="text-white/45 text-xs mt-1 leading-relaxed">{r.description}</p>}
                          {r.adminNote && (
                            <p className="mt-2 text-xs text-indigo-300/80 border-l-2 border-indigo-500/40 pl-2">💬 {r.adminNote}</p>
                          )}
                        </div>
                        <button
                          onClick={() => voteFeatureRequest(r.id)}
                          disabled={votedIds.has(r.id)}
                          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border transition-all shrink-0 ${
                            votedIds.has(r.id)
                              ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                              : "border-white/10 hover:border-amber-500/40 hover:bg-amber-500/10 text-white/35 hover:text-amber-400"
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-bold">{r.votes || 1}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {tab === "security" && (
          <div className="space-y-4">
            <div className="mb-2">
              <h2 className="text-lg font-bold text-white">Account Security</h2>
              <p className="text-xs text-white/40 mt-0.5">Protect your account with Two-Factor Authentication</p>
            </div>

            <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
              <div className="p-5 border-b border-white/8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,.2)" }}>
                    <Shield className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Two-Factor Authentication</p>
                    <p className="text-xs text-white/40">Require a code from your authenticator app at login</p>
                  </div>
                </div>
                {totpEnabled
                  ? <Badge className="bg-emerald-600/80 text-white border-0 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                  : <Badge className="bg-white/10 text-white/50 border-0 text-xs">Not Set Up</Badge>}
              </div>

              <div className="p-5">
                {totpEnabled && totpStep === "idle" ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 rounded-xl text-xs text-emerald-300" style={{ background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)" }}>
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      2FA is active. Your account is protected by an authenticator app.
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <Button onClick={startTotpSetup} disabled={totpLoading} size="sm"
                        className="bg-indigo-600/80 hover:bg-indigo-600 text-white border-0" data-testid="button-reconfigure-totp">
                        <QrCode className="w-3.5 h-3.5 mr-1.5" />Reconfigure 2FA
                      </Button>
                      <Button onClick={() => disableTotpMutation.mutate()} disabled={disableTotpMutation.isPending} size="sm"
                        variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300" data-testid="button-disable-totp">
                        <Lock className="w-3.5 h-3.5 mr-1.5" />Disable 2FA
                      </Button>
                    </div>
                  </div>
                ) : !totpEnabled && totpStep === "idle" ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 rounded-xl text-xs text-amber-300" style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)" }}>
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      2FA is not enabled. We strongly recommend protecting your account.
                    </div>
                    <Button onClick={startTotpSetup} disabled={totpLoading}
                      className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white" data-testid="button-setup-totp">
                      <QrCode className="w-4 h-4 mr-2" />{totpLoading ? "Generating..." : "Set Up 2FA"}
                    </Button>
                  </div>
                ) : null}

                {totpStep === "qr" && totpSetupData && (
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-white">Scan this QR code with your authenticator app</p>
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="p-3 bg-white rounded-2xl shadow-xl">
                        <img src={totpSetupData.qrCodeDataUrl} alt="2FA QR Code" className="w-44 h-44 rounded-lg" />
                      </div>
                      <div className="flex-1 space-y-3 min-w-0">
                        <p className="text-xs text-white/40">Works with Google Authenticator, Authy, Microsoft Authenticator, or any TOTP app.</p>
                        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.06)" }}>
                          <p className="text-xs text-white/30 mb-1">Or enter this code manually:</p>
                          <p className="font-mono text-xs text-indigo-300 break-all">{totpSetupData.secret}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={() => setTotpStep("verify")} className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white hover:opacity-90" data-testid="button-next-verify">
                        I've Scanned It → Verify
                      </Button>
                      <Button variant="outline" className="border-white/10 text-white/60 hover:text-white" onClick={() => { setTotpStep("idle"); setTotpSetupData(null); setTotpError(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {totpStep === "verify" && (
                  <div className="space-y-4">
                    <p className="text-sm text-white/70">Enter the 6-digit code from your authenticator app:</p>
                    <Input
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      inputMode="numeric"
                      className={`${inputCls} text-center font-mono text-3xl tracking-[0.5em] h-16`}
                      data-testid="input-totp-code"
                    />
                    {totpError && <p className="text-xs text-red-400">{totpError}</p>}
                    <div className="flex gap-3">
                      <Button onClick={verifyTotpSetup} disabled={totpCode.length !== 6 || totpLoading}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 border-0 text-white hover:opacity-90" data-testid="button-enable-totp">
                        {totpLoading ? "Verifying..." : "Enable 2FA"}
                      </Button>
                      <Button variant="outline" className="border-white/10 text-white/60 hover:text-white" onClick={() => setTotpStep("qr")}>
                        Back to QR
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Active Sessions */}
            <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
              <div className="p-4 border-b border-white/8 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,.15)" }}>
                    <Monitor className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">Active Sessions</p>
                    <p className="text-xs text-white/40">Devices currently signed into your account</p>
                  </div>
                </div>
                {(sessionsData?.sessions ?? []).filter((s: any) => !s.isCurrent).length > 0 && (
                  <button
                    onClick={revokeOtherSessions}
                    disabled={revokingOthers}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0"
                    style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)" }}
                  >
                    {revokingOthers ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                    Sign out all others
                  </button>
                )}
              </div>
              <div className="divide-y divide-white/5">
                {!sessionsData ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /></div>
                ) : (sessionsData?.sessions ?? []).length === 0 ? (
                  <div className="text-center py-8">
                    <Monitor className="w-6 h-6 text-white/15 mx-auto mb-2" />
                    <p className="text-white/30 text-sm">No active sessions</p>
                  </div>
                ) : (sessionsData?.sessions ?? []).map((session: any) => {
                  const isMobile = /iphone|android|ipad/i.test(session.deviceName || "");
                  const isTablet = /ipad/i.test(session.deviceName || "");
                  const created = new Date(session.createdAt);
                  const expires = new Date(session.expiresAt);
                  return (
                    <div key={session.id} className="flex items-center gap-3 p-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: session.isCurrent ? "rgba(52,211,153,.15)" : "rgba(255,255,255,.06)" }}>
                        {isTablet ? <Monitor className="w-4 h-4 text-violet-400" />
                          : isMobile ? <Monitor className="w-4 h-4 text-blue-400" />
                          : <Monitor className="w-4 h-4" style={{ color: session.isCurrent ? "#34d399" : "rgba(255,255,255,.3)" }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white truncate">{session.deviceName || "Unknown Device"}</span>
                          {session.isCurrent && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                              style={{ background: "rgba(52,211,153,.2)", color: "#34d399" }}>
                              This device
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-white/30 font-mono">{session.ip}</span>
                          <span className="text-xs text-white/20">·</span>
                          <span className="text-xs text-white/25">Signed in {created.toLocaleDateString()}</span>
                          <span className="text-xs text-white/20">·</span>
                          <span className="text-xs text-white/20">Expires {expires.toLocaleDateString()}</span>
                        </div>
                      </div>
                      {!session.isCurrent && (
                        <button
                          onClick={() => revokeSession(session.id)}
                          disabled={revokingId === session.id}
                          className="text-xs text-red-400/70 hover:text-red-400 transition-colors px-2.5 py-1 rounded-lg shrink-0"
                          style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.15)" }}
                        >
                          {revokingId === session.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Revoke"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Login History */}
            <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
              <div className="p-4 border-b border-white/8 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,.2)" }}>
                  <Globe className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Login History</p>
                  <p className="text-xs text-white/40">Recent sign-ins to your account — last 20 sessions</p>
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {loginHistoryLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /></div>
                ) : (loginHistoryData?.logs ?? []).length === 0 ? (
                  <div className="text-center py-10">
                    <Globe className="w-7 h-7 text-white/15 mx-auto mb-2" />
                    <p className="text-white/30 text-sm">No login history yet</p>
                    <p className="text-white/20 text-xs mt-1">It will appear here after your next login</p>
                  </div>
                ) : (loginHistoryData?.logs ?? []).map((log: any, idx: number) => {
                  const ua = log.userAgent || "";
                  const isMobile = /mobile|android|iphone|ipad/i.test(ua);
                  const browser = /chrome/i.test(ua) ? "Chrome" : /firefox/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : /edge/i.test(ua) ? "Edge" : "Browser";
                  const os = /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : /android/i.test(ua) ? "Android" : /iphone|ipad/i.test(ua) ? "iOS" : "Unknown OS";
                  const flagUrl = log.countryCode ? `https://flagcdn.com/16x12/${log.countryCode.toLowerCase()}.png` : null;
                  return (
                    <div key={log.id} className={`flex items-center justify-between gap-3 p-4 ${idx === 0 ? "bg-indigo-500/5" : ""}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,.06)" }}>
                          {isMobile ? <Monitor className="w-4 h-4 text-white/40" /> : <Monitor className="w-4 h-4 text-white/40" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white">{browser} on {os}</span>
                            {idx === 0 && <Badge className="bg-emerald-600/70 text-white border-0 text-xs py-0">Current</Badge>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {flagUrl && <img src={flagUrl} alt={log.countryCode} className="w-4 h-3 rounded-sm" />}
                            <span className="text-xs text-white/40">
                              {[log.city, log.country].filter(Boolean).join(", ") || "Unknown Location"}
                            </span>
                            <span className="text-xs text-white/25">·</span>
                            <span className="text-xs text-white/30 font-mono">{log.ip}</span>
                            {log.isp && <><span className="text-xs text-white/25">·</span><span className="text-xs text-white/30"><Wifi className="w-3 h-3 inline mr-0.5" />{log.isp}</span></>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-white/30">{new Date(log.createdAt).toLocaleDateString()}</p>
                        <p className="text-xs text-white/20">{new Date(log.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {tab === "profile" && (
          <div className="space-y-5">
            <div className="mb-2">
              <h2 className="text-lg font-bold text-white">Profile Settings</h2>
              <p className="text-xs text-white/40 mt-0.5">Update your photo, name, or password</p>
            </div>

            {/* Avatar upload card */}
            <div className="rounded-2xl border border-white/8 p-5" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
              <div className="flex items-center gap-3 pb-4 border-b border-white/8 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,.2)" }}>
                  <Camera className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">Profile Photo</p>
                  <p className="text-xs text-white/40">Click the photo to upload a new one</p>
                </div>
              </div>

              <div className="flex items-center gap-5">
                {/* Clickable avatar */}
                <div className="relative group shrink-0">
                  <div
                    className="w-24 h-24 rounded-2xl overflow-hidden cursor-pointer border-2 border-white/10 group-hover:border-indigo-500/50 transition-colors"
                    style={{ background: "linear-gradient(135deg, rgba(99,102,241,.3), rgba(168,85,247,.3))" }}
                    onClick={() => !avatarUploading && avatarInputRef.current?.click()}
                  >
                    {(avatarPreview || customer?.avatarUrl) ? (
                      <img src={avatarPreview || customer.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-10 h-10 text-white/40" />
                      </div>
                    )}
                    {/* Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                      {avatarUploading ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6 text-white" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <p className="text-sm text-white font-medium">{customer?.name || "No name set"}</p>
                  <p className="text-xs text-white/40">{customer?.email}</p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs"
                    >
                      {avatarUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Camera className="w-3.5 h-3.5 mr-1" />}
                      {customer?.avatarUrl || avatarPreview ? "Change Photo" : "Upload Photo"}
                    </Button>
                    {(customer?.avatarUrl || avatarPreview) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAvatarRemove}
                        disabled={avatarUploading}
                        className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-8 text-xs"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-white/25 mt-1">JPG, PNG, GIF or WebP · Max 5MB</p>
                </div>
              </div>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            <div className="rounded-2xl border border-white/8 p-5 space-y-4" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
              <div className="flex items-center gap-3 pb-3 border-b border-white/8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,.2)" }}>
                  <User className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">Personal Information</p>
                  <p className="text-xs text-white/40">Update your display name</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">Full Name</label>
                  <Input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder={customer?.name || "Your name"}
                    className={inputCls}
                    data-testid="input-profile-name"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">Email Address</label>
                  <Input value={customer?.email || ""} disabled className={inputCls + " opacity-50 cursor-not-allowed"} data-testid="input-profile-email" />
                  <p className="text-xs text-white/25 mt-1">Email cannot be changed</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 p-5 space-y-4" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
              <div className="flex items-center gap-3 pb-3 border-b border-white/8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,.2)" }}>
                  <Lock className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">Change Password</p>
                  <p className="text-xs text-white/40">Leave blank if you don't want to change it</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">Current Password</label>
                  <div className="relative">
                    <Input
                      type={showCurrentPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className={inputCls + " pr-9"}
                      data-testid="input-current-password"
                    />
                    <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">New Password</label>
                  <div className="relative">
                    <Input
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className={inputCls + " pr-9"}
                      data-testid="input-new-password"
                    />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1.5">Confirm New Password</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className={inputCls + (newPassword && confirmPassword && newPassword !== confirmPassword ? " border-red-500/50" : "")}
                    data-testid="input-confirm-password"
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleProfileSave}
              disabled={profileMutation.isPending}
              className="w-full h-11 bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white font-bold hover:opacity-90"
              data-testid="button-save-profile"
            >
              {profileMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />Save Changes</>
              )}
            </Button>

            {/* ── Telegram Connect ───────────────────────────────────────── */}
            <div className="rounded-2xl border border-white/8 p-5 space-y-4" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
              <div className="flex items-center gap-3 pb-3 border-b border-white/8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,136,204,.2)" }}>
                  <Send className="w-5 h-5 text-sky-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">Telegram Storefront</p>
                  <p className="text-xs text-white/40">Link your account to check balance &amp; orders in Telegram</p>
                </div>
                {tgStatusData?.linked && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium">Connected</span>
                )}
              </div>
              {tgStatusData?.linked ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/60">Your Telegram is connected. You can now use <span className="text-sky-400 font-mono">/balance</span>, <span className="text-sky-400 font-mono">/me</span>, and <span className="text-sky-400 font-mono">/myorders</span> in the bot.</p>
                  <Button size="sm" variant="outline" onClick={unlinkTelegram} className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-8 text-xs">
                    Disconnect Telegram
                  </Button>
                </div>
              ) : tgCode ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/60">Open the Telegram bot and send this command:</p>
                  <div className="flex items-center gap-2 bg-black/30 rounded-xl px-4 py-3 border border-white/8">
                    <code className="text-sky-300 font-mono text-sm flex-1">/link {tgCode}</code>
                    <button onClick={() => { navigator.clipboard.writeText(`/link ${tgCode}`); }} className="text-white/40 hover:text-white/80 transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-white/30">This code expires in 10 minutes. <button className="text-indigo-400 underline" onClick={generateTgCode}>Generate new code</button></p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-white/50">Connect your account to the Telegram bot to check your wallet balance and orders without opening the browser.</p>
                  <Button size="sm" onClick={generateTgCode} disabled={tgCodeLoading} className="bg-sky-600 hover:bg-sky-500 text-white border-0 h-9 text-sm">
                    {tgCodeLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Connect Telegram
                  </Button>
                </div>
              )}
            </div>

            {/* ── Badge Wall ─────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-white/8 p-5 space-y-4" style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(12px)" }}>
              <div className="flex items-center gap-3 pb-3 border-b border-white/8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,.2)" }}>
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">Badge Wall</p>
                  <p className="text-xs text-white/40">
                    {badgesData ? `${badgesData.earnedCount} of ${badgesData.totalCount} earned` : "Achievements you've unlocked"}
                  </p>
                </div>
              </div>
              {badgesData?.badges ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {badgesData.badges.map((b: any) => (
                    <div
                      key={b.id}
                      className={`rounded-xl p-3 border transition-all ${b.earned
                        ? b.rarity === "epic" ? "border-amber-500/40 bg-amber-500/10"
                          : b.rarity === "rare" ? "border-indigo-500/40 bg-indigo-500/10"
                          : b.rarity === "uncommon" ? "border-emerald-500/30 bg-emerald-500/8"
                          : "border-white/12 bg-white/5"
                        : "border-white/5 bg-white/2 opacity-40 grayscale"}`}
                      title={b.desc}
                    >
                      <div className="text-2xl mb-1.5">{b.emoji}</div>
                      <p className={`text-xs font-semibold ${b.earned ? "text-white" : "text-white/40"}`}>{b.name}</p>
                      <p className="text-[10px] text-white/30 mt-0.5 leading-tight">{b.desc}</p>
                      {b.earned && b.rarity !== "common" && (
                        <span className={`inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                          b.rarity === "epic" ? "bg-amber-500/20 text-amber-400"
                          : b.rarity === "rare" ? "bg-indigo-500/20 text-indigo-400"
                          : "bg-emerald-500/20 text-emerald-400"
                        }`}>{b.rarity}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Array.from({length: 6}).map((_, i) => (
                    <div key={i} className="rounded-xl p-3 border border-white/5 bg-white/2 h-20 animate-pulse" />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Rating Modal ──────────────────────────────────────────────────── */}
      {ratingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl border border-white/15 p-6 space-y-5" style={{ background: "linear-gradient(135deg,rgba(20,20,40,.98),rgba(30,20,60,.98))" }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg">Rate your order</h3>
                <p className="text-white/50 text-sm mt-0.5 truncate max-w-[220px]">{ratingModal.planName}</p>
              </div>
              <button onClick={() => setRatingModal(null)} className="text-white/40 hover:text-white/80 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            {/* Stars */}
            <div className="flex items-center justify-center gap-2">
              {[1,2,3,4,5].map(s => (
                <button
                  key={s}
                  onMouseEnter={() => setRatingHover(s)}
                  onMouseLeave={() => setRatingHover(0)}
                  onClick={() => setRatingStars(s)}
                  className="transition-transform hover:scale-110"
                >
                  <Star className={`w-9 h-9 transition-colors ${s <= (ratingHover || ratingStars) ? "text-amber-400 fill-amber-400" : "text-white/20"}`} />
                </button>
              ))}
            </div>
            {ratingStars > 0 && (
              <p className="text-center text-sm text-amber-300/80 font-medium">
                {["", "Poor", "Fair", "Good", "Great", "Excellent!"][ratingStars]}
              </p>
            )}
            {/* Comment */}
            <textarea
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
              placeholder="Optional — share your experience…"
              rows={3}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm px-3 py-2.5 resize-none placeholder:text-white/25 focus:outline-none focus:border-indigo-500/60"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRatingModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-all"
              >Cancel</button>
              <button
                onClick={submitRating}
                disabled={!ratingStars || ratingSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm disabled:opacity-40 hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                {ratingSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4 fill-white" />}
                {ratingSubmitting ? "Submitting…" : "Submit Rating"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bot Management Dialog ───────────────────────────────────── */}
      {manageBotId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closeManageBot} data-testid="dialog-manage-bot">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-zinc-950/95 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-400" />
                <h3 className="text-white font-bold text-sm">Manage Bot</h3>
              </div>
              <button onClick={closeManageBot} className="text-white/40 hover:text-white p-1" data-testid="button-close-manage"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-5">
              {/* Status card */}
              <div className="rounded-xl border border-white/10 bg-white/3 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-white/50 font-bold">Live Status</p>
                  <button onClick={() => loadBotStatus(manageBotId!)} disabled={botStatusLoading} className="text-xs text-indigo-300 hover:text-indigo-200 disabled:opacity-50" data-testid="button-refresh-status">
                    {botStatusLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
                  </button>
                </div>
                {botStatusLoading && !botStatus ? (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                ) : !botStatus?.success ? (
                  <p className="text-white/40 text-sm">Couldn't load status</p>
                ) : !botStatus.deployed ? (
                  <div className="space-y-3">
                    {selfDeploying ? (
                      <div className="flex items-center gap-2 text-indigo-300 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>{selfDeployMsg || "Starting deployment..."}</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-amber-300 text-sm">{selfDeployMsg || botStatus.message || "Not yet deployed"}</p>
                        <button
                          onClick={() => selfDeploy(manageBotId!)}
                          disabled={selfDeploying}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
                          data-testid="button-self-deploy"
                        >
                          <Zap className="w-4 h-4" />
                          Deploy My Bot Now
                        </button>
                        <p className="text-[11px] text-white/30 text-center">Automatically installs and starts your bot on the server. Takes 1–3 min.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {botStatus.pm2Name && (
                      <div className="text-xs text-white/60"><span className="text-white/40">PM2:</span> <span className="font-mono text-indigo-300">{botStatus.pm2Name}</span></div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-white/40">Status:</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${botStatus.pm2Status === "online" ? "bg-emerald-500/15 text-emerald-300" : botStatus.pm2Status === "stopped" ? "bg-gray-500/15 text-gray-300" : "bg-amber-500/15 text-amber-300"}`}>
                        {botStatus.pm2Status ?? "unknown"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => botAction(manageBotId!, "restart")} disabled={!!botBusy} className="px-3 py-2 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5" data-testid="button-bot-restart">
                  {botBusy === "restart" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}Restart
                </button>
                <button onClick={() => botAction(manageBotId!, "stop")} disabled={!!botBusy} className="px-3 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-200 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5" data-testid="button-bot-stop">
                  {botBusy === "stop" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}Stop
                </button>
                <button onClick={() => botAction(manageBotId!, "start")} disabled={!!botBusy} className="px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5" data-testid="button-bot-start">
                  {botBusy === "start" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}Start
                </button>
              </div>

              {/* Logs */}
              <div className="rounded-xl border border-white/10 bg-black/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/3">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <p className="text-xs text-white/70 font-bold uppercase tracking-wide">Logs (last 200)</p>
                  </div>
                  <button onClick={() => loadBotLogs(manageBotId!)} disabled={botLogsLoading} className="text-xs text-indigo-300 hover:text-indigo-200 disabled:opacity-50" data-testid="button-refresh-logs">
                    {botLogsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
                  </button>
                </div>
                <pre className="text-[10.5px] text-emerald-300/90 p-3 max-h-72 overflow-auto font-mono leading-relaxed whitespace-pre-wrap break-words" data-testid="text-bot-logs">
{botLogsLoading && !botLogs ? "Loading logs..." : botLogs || "(no logs yet)"}
                </pre>
              </div>

              {/* ── Env Vars Editor ─────────────────────────────────────────────── */}
              <div className="rounded-xl border border-white/10 bg-white/3 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-semibold text-white/80">Environment Variables</span>
                  </div>
                  {!botEnvEditing && (
                    <button onClick={() => setBotEnvEditing(true)} className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1">
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  )}
                </div>
                {botEnvLoading ? (
                  <div className="flex items-center gap-2 text-xs text-white/40 py-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading env vars…</div>
                ) : Object.keys(botEnvVars).length === 0 ? (
                  <p className="text-xs text-white/30 py-1">No env vars stored.</p>
                ) : botEnvEditing ? (
                  <div className="space-y-2">
                    {Object.entries(botEnvVars).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-white/40 w-36 shrink-0 truncate">{k}</span>
                        <input
                          className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white/80 font-mono focus:outline-none focus:border-indigo-500/50"
                          value={v}
                          onChange={e => setBotEnvVars(prev => ({ ...prev, [k]: e.target.value }))}
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 mt-3">
                      <button
                        disabled={botEnvSaving}
                        onClick={async () => {
                          setBotEnvSaving(true);
                          try {
                            const r = await customerFetch(`/api/customer/bots/${manageBotId}/env-vars`, {
                              method: "PATCH",
                              body: JSON.stringify({ envVars: botEnvVars }),
                            });
                            if (r.success) { setBotEnvEditing(false); toast({ title: "Env vars saved & bot restarted" }); }
                            else toast({ title: "Failed to save", description: r.error, variant: "destructive" });
                          } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
                          finally { setBotEnvSaving(false); }
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {botEnvSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        {botEnvSaving ? "Saving…" : "Save & Restart"}
                      </button>
                      <button onClick={() => { setBotEnvEditing(false); loadBotEnvVars(manageBotId!); }} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(botEnvVars).map(([k]) => (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-white/50 text-[10px]">{k}</span>
                        <span className="text-white/20 text-[10px]">= ••••••••</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Mini Terminal ────────────────────────────────────────── */}
              <div className="rounded-xl border border-white/10 bg-zinc-900 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                  <div className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs font-semibold text-white/70">Terminal</span></div>
                  <button onClick={() => setTerminalHistory([])} className="text-[10px] text-white/20 hover:text-white/50">Clear</button>
                </div>
                <div className="font-mono text-[11px] max-h-52 overflow-y-auto p-3 space-y-2 bg-black/40">
                  {terminalHistory.length === 0 && <p className="text-white/20">Allowed: pm2 logs, pm2 status, pm2 list, pm2 restart, ls, cat .env, git log…</p>}
                  {terminalHistory.map((entry, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-1 text-indigo-300/70"><span className="text-white/20">$</span><span>{entry.cmd}</span></div>
                      <pre className="whitespace-pre-wrap break-words text-emerald-300/80 mt-0.5 leading-relaxed">{entry.output}</pre>
                    </div>
                  ))}
                  {terminalRunning && <div className="text-white/30 animate-pulse">Running…</div>}
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-black/20 border-t border-white/5">
                  <span className="text-emerald-400 font-mono text-xs shrink-0">$</span>
                  <input
                    className="flex-1 bg-transparent text-xs text-white/80 font-mono focus:outline-none placeholder:text-white/20"
                    placeholder="pm2 status, pm2 logs, ls ..."
                    value={terminalInput}
                    onChange={e => setTerminalInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && manageBotId) runTerminalCommand(manageBotId, terminalInput); }}
                    disabled={terminalRunning}
                  />
                  <button
                    onClick={() => manageBotId && runTerminalCommand(manageBotId, terminalInput)}
                    disabled={terminalRunning || !terminalInput.trim()}
                    className="text-xs px-2.5 py-1 rounded-lg bg-indigo-600/50 hover:bg-indigo-600/80 text-indigo-200 disabled:opacity-30 flex items-center gap-1"
                  >
                    {terminalRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Run
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
    );
}
