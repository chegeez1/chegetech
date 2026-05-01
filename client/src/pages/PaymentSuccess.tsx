import { useEffect, useState } from "react";
  import { useSearch, useLocation } from "wouter";
  import { useMutation, useQuery } from "@tanstack/react-query";
  import {
    CheckCircle, Mail, Home, Loader2, XCircle, MessageCircle,
    Bot, Cog, Sparkles, ShieldCheck, Clock, Activity, Settings2, Send,
  } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { apiRequest } from "@/lib/queryClient";

  type BotOrder = {
    id: number; reference: string; bot_name?: string; bot_id?: number; status: string;
    created_at?: string;
  };

  type EnvVar = { key: string; defaultValue: string; required: boolean };

  const BOT_STEPS = [
    { id: "paid",        label: "Payment confirmed",     icon: CheckCircle },
    { id: "configuring", label: "Configuring your bot",  icon: Settings2 },
    { id: "deploying",   label: "Deploying your bot",    icon: Loader2 },
    { id: "deployed",    label: "Bot is live",           icon: Sparkles },
  ];

  function StepIndex(status: string) {
    const idx = BOT_STEPS.findIndex(s => s.id === status);
    return idx < 0 ? 0 : idx;
  }

  // ── Configure Form ───────────────────────────────────────────────────────────
  function ConfigureForm({ botOrder, onSubmitted }: { botOrder: BotOrder; onSubmitted: () => void }) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState(false);

    const { data: tplData, isLoading: tplLoading } = useQuery<any>({
      queryKey: ["/api/bots/env-template", botOrder.bot_id],
      queryFn: () => fetch(`/api/bots/env-template/${botOrder.bot_id}`).then(r => r.json()),
      enabled: !!botOrder.bot_id,
    });
    const vars: EnvVar[] = tplData?.vars ?? [];

    useEffect(() => {
      if (vars.length) {
        setValues(prev => {
          const init: Record<string, string> = {};
          vars.forEach(v => { init[v.key] = prev[v.key] ?? v.defaultValue; });
          return init;
        });
      }
    }, [vars.length]);

    const configureMutation = useMutation({
      mutationFn: (envVars: Record<string, string>) =>
        apiRequest("POST", `/api/bots/order/${botOrder.reference}/configure`, { envVars }),
      onSuccess: () => { setSubmitted(true); onSubmitted(); },
    });

    if (tplLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="ml-2 text-white/60 text-sm">Loading configuration...</span>
        </div>
      );
    }

    if (submitted || configureMutation.isPending) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="ml-2 text-white/60 text-sm">Saving and deploying your bot...</span>
        </div>
      );
    }

    if (vars.length === 0) {
      return (
        <div className="text-center py-6">
          <p className="text-white/50 text-sm mb-4">No configuration required for this bot.</p>
          <Button
            onClick={() => configureMutation.mutate({})}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white"
          >
            <Send className="w-4 h-4 mr-2" />Deploy Bot Now
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-left">
        <p className="text-white/60 text-sm mb-4">
          Fill in the configuration values for your bot. These will be set as environment variables on the server.
        </p>
        {vars.map(v => (
          <div key={v.key} className="space-y-1">
            <Label className="text-white/80 text-xs font-medium flex items-center gap-1">
              {v.key}
              {v.required && <span className="text-red-400 text-[10px]">*required</span>}
            </Label>
            <Input
              value={values[v.key] ?? ""}
              onChange={e => setValues(prev => ({ ...prev, [v.key]: e.target.value }))}
              placeholder={v.defaultValue || v.key}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 text-sm"
            />
          </div>
        ))}
        {configureMutation.isError && (
          <p className="text-red-400 text-xs">{(configureMutation.error as any)?.message || "Failed to configure. Please try again."}</p>
        )}
        <Button
          onClick={() => configureMutation.mutate(values)}
          disabled={configureMutation.isPending || vars.filter(v => v.required).some(v => !values[v.key]?.trim())}
          className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white"
          data-testid="button-configure"
        >
          <Send className="w-4 h-4 mr-2" />Deploy My Bot
        </Button>
      </div>
    );
  }

  export default function PaymentSuccess() {
    const [, setLocation] = useLocation();
    const search = useSearch();
    const params = new URLSearchParams(search);
    const plan = params.get("plan") ?? "";
    const email = params.get("email") ?? "";
    const reference = params.get("ref") ?? "";
    const botRef = params.get("botRef") ?? "";
    const isBot = !!botRef;

    const [verified, setVerified] = useState(!reference);
    const [verifyError, setVerifyError] = useState("");
    const [verifiedPlan, setVerifiedPlan] = useState(plan);
    const [configSubmitted, setConfigSubmitted] = useState(false);

    const { data: cfgData } = useQuery<any>({ queryKey: ["/api/app-config"] });
    const whatsappChannel = cfgData?.config?.whatsappChannel || "https://whatsapp.com/channel/0029VbBx7NeDp2QGF7qoZ02A";
    const whatsappNumber = cfgData?.config?.whatsappNumber || "+254114291301";

    const verifyMutation = useMutation({
      mutationFn: (ref: string) => apiRequest("POST", "/api/payment/verify", { reference: ref }),
      onSuccess: (data: any) => {
        if (data.success) { setVerified(true); if (data.planName) setVerifiedPlan(data.planName); }
        else setVerifyError(data.error || "Payment verification failed");
      },
      onError: () => setVerifyError("Failed to verify payment. Please contact support."),
    });

    useEffect(() => { if (reference && !verified) verifyMutation.mutate(reference); }, [reference]);

    // Poll bot order status
    const { data: botOrderData, refetch: refetchBot } = useQuery<any>({
      queryKey: ["/api/bots/order", botRef],
      queryFn: () => fetch(`/api/bots/order/${botRef}`).then(r => r.json()),
      enabled: !!botRef,
      refetchInterval: (q: any) => {
        const s = q?.state?.data?.order?.status;
        return (s === "deployed" || s === "deploy_failed" || s === "failed") ? false : 4000;
      },
    });
    const botOrder: BotOrder | null = botOrderData?.success ? botOrderData.order : null;

    if (verifyMutation.isPending) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
          <div className="fixed inset-0 pointer-events-none">
            <div className="bg-orb w-[500px] h-[500px] bg-indigo-600 top-[-150px] left-[-100px]" style={{ opacity: 0.25 }} />
            <div className="bg-orb w-[400px] h-[400px] bg-violet-700 bottom-[-100px] right-[-80px]" style={{ opacity: 0.2 }} />
          </div>
          <div className="relative z-10 glass-card rounded-3xl p-12 text-center">
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
            <p className="font-semibold text-lg text-white">Verifying your payment...</p>
            <p className="text-white/40 text-sm mt-1">Confirming and delivering your account</p>
          </div>
        </div>
      );
    }

    if (verifyError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
          <div className="fixed inset-0 pointer-events-none">
            <div className="bg-orb w-[500px] h-[500px] bg-red-600 top-[-150px] left-[-100px]" style={{ opacity: 0.15 }} />
          </div>
          <div className="relative z-10 glass-card rounded-3xl p-10 max-w-md w-full text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/15 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Payment Issue</h1>
            <p className="text-white/50 mb-6">{verifyError}</p>
            <Button onClick={() => setLocation("/")} className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white" data-testid="button-home">
              <Home className="w-4 h-4 mr-2" />Back to Store
            </Button>
            <p className="text-xs text-white/20 mt-6">Ref: <span className="font-mono">{reference}</span></p>
          </div>
        </div>
      );
    }

    // ─── Bot order success view ─────────────────────────────────────────
    if (isBot) {
      const status = botOrder?.status ?? "paid";
      const stepIdx = StepIndex(status);
      const isFailed = status === "deploy_failed" || status === "failed";
      const isLive = status === "deployed";
      const needsConfig = status === "paid" && !configSubmitted;
      const isDeploying = status === "configuring" || status === "deploying" || configSubmitted;

      return (
        <div className="min-h-screen bg-background py-10 px-4 relative overflow-hidden">
          <div className="fixed inset-0 pointer-events-none">
            <div className="bg-orb w-[500px] h-[500px] bg-emerald-600 top-[-150px] left-[-100px]" style={{ opacity: 0.18 }} />
            <div className="bg-orb w-[400px] h-[400px] bg-indigo-700 bottom-[-100px] right-[-80px]" style={{ opacity: 0.18 }} />
          </div>

          <div className="relative z-10 max-w-xl mx-auto space-y-4">
            <div className={`glass-card rounded-3xl p-8 border ${isLive ? "border-emerald-500/30" : isFailed ? "border-red-500/30" : "border-indigo-500/30"}`}>
              <div className="text-center mb-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${isLive ? "bg-emerald-500/15 border border-emerald-500/40" : isFailed ? "bg-red-500/15 border border-red-500/40" : "bg-indigo-500/15 border border-indigo-500/40"}`}>
                  {isLive ? <Sparkles className="w-10 h-10 text-emerald-400" /> : isFailed ? <XCircle className="w-10 h-10 text-red-400" /> : needsConfig ? <Cog className="w-10 h-10 text-indigo-400" /> : <Bot className="w-10 h-10 text-indigo-400" />}
                </div>
                <h1 className="text-2xl font-bold text-white mb-1" data-testid="text-bot-status">
                  {isLive ? "Your bot is live!" : isFailed ? "Deployment hit a snag" : needsConfig ? "Configure your bot" : "Deploying your bot..."}
                </h1>
                <p className="text-white/50 text-sm">
                  {isLive ? "It's running and ready to use." : isFailed ? "Don't worry — our team is on it. Reach out below." : needsConfig ? "Payment confirmed! Fill in the settings below to deploy your bot." : "This usually takes a couple of minutes."}
                </p>
              </div>

              {/* Progress steps (shown when deploying or live) */}
              {!isFailed && !needsConfig && (
                <div className="space-y-3 mb-6">
                  {BOT_STEPS.map((step, i) => {
                    const done = i < stepIdx || isLive;
                    const active = i === stepIdx && !isLive;
                    const Icon = step.icon;
                    return (
                      <div key={step.id} data-testid={`step-${step.id}`} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${done ? "bg-emerald-500/10 border-emerald-500/30" : active ? "bg-indigo-500/10 border-indigo-500/30" : "bg-white/3 border-white/10"}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-emerald-500/30 text-emerald-300" : active ? "bg-indigo-500/30 text-indigo-300" : "bg-white/10 text-white/40"}`}>
                          {done ? <CheckCircle className="w-4 h-4" /> : <Icon className={`w-3.5 h-3.5 ${active ? "animate-spin" : ""}`} />}
                        </div>
                        <span className={`text-sm font-medium ${done ? "text-emerald-200" : active ? "text-white" : "text-white/40"}`}>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Configure form */}
              {needsConfig && botOrder && (
                <ConfigureForm botOrder={botOrder} onSubmitted={() => { setConfigSubmitted(true); refetchBot(); }} />
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <Button onClick={() => setLocation("/dashboard?tab=my-bots")} className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white" data-testid="button-my-bots">
                  <Bot className="w-4 h-4 mr-2" />Manage My Bots
                </Button>
                <a href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener" className="flex-1">
                  <Button variant="outline" className="w-full border-white/15 bg-white/5 text-white/80 hover:bg-white/10" data-testid="button-support">
                    <MessageCircle className="w-4 h-4 mr-2" />Need Help?
                  </Button>
                </a>
              </div>

              <p className="text-[11px] text-white/30 mt-5 font-mono text-center">Order: {botRef}</p>
            </div>
          </div>
        </div>
      );
    }

    // ─── Subscription success view ──────────────────────────────────────
    return (
      <div className="min-h-screen bg-background py-10 px-4 relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none">
          <div className="bg-orb w-[500px] h-[500px] bg-emerald-600 top-[-150px] left-[-100px]" style={{ opacity: 0.18 }} />
          <div className="bg-orb w-[400px] h-[400px] bg-indigo-700 bottom-[-100px] right-[-80px]" style={{ opacity: 0.18 }} />
        </div>

        <div className="relative z-10 max-w-xl mx-auto">
          <div className="glass-card rounded-3xl p-8 text-center border border-emerald-500/30">
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Payment successful!</h1>
            {verifiedPlan && <p className="text-emerald-300 font-semibold text-base mb-3">{verifiedPlan}</p>}

            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 mb-5 text-left flex items-start gap-3">
              <Mail className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="text-white font-semibold mb-0.5">Account credentials sent</p>
                <p className="text-white/50 text-xs">Check <span className="text-indigo-300">{email || "your email"}</span> in the next 1-2 minutes. Don't see it? Look in spam or the Promotions tab.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-5 text-xs">
              <div className="rounded-lg bg-white/3 border border-white/10 p-3 text-left">
                <ShieldCheck className="w-4 h-4 text-emerald-400 mb-1" />
                <p className="text-white/70 font-medium">Verified account</p>
                <p className="text-white/40">Working credentials guaranteed</p>
              </div>
              <div className="rounded-lg bg-white/3 border border-white/10 p-3 text-left">
                <Clock className="w-4 h-4 text-indigo-400 mb-1" />
                <p className="text-white/70 font-medium">Instant delivery</p>
                <p className="text-white/40">Within minutes</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => setLocation("/dashboard?tab=orders")} className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white" data-testid="button-dashboard">
                <Activity className="w-4 h-4 mr-2" />My Orders
              </Button>
              <a href={whatsappChannel} target="_blank" rel="noopener" className="flex-1">
                <Button variant="outline" className="w-full border-white/15 bg-white/5 text-white/80 hover:bg-white/10" data-testid="button-channel">
                  <MessageCircle className="w-4 h-4 mr-2" />Join WhatsApp Channel
                </Button>
              </a>
            </div>

            <Button variant="ghost" onClick={() => setLocation("/")} className="mt-3 text-white/50 hover:text-white text-sm" data-testid="button-home">
              <Home className="w-4 h-4 mr-1.5" />Back to Store
            </Button>

            {reference && <p className="text-[11px] text-white/30 mt-5 font-mono">Ref: {reference}</p>}
          </div>
        </div>
      </div>
    );
  }
  