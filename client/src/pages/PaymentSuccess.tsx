import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle, Mail, Home, ArrowRight, Loader2, XCircle, MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const plan = params.get("plan") ?? "";
  const email = params.get("email") ?? "";
  const reference = params.get("ref") ?? "";
  const [verified, setVerified] = useState(!reference);
  const [verifyError, setVerifyError] = useState("");
  const [verifiedPlan, setVerifiedPlan] = useState(plan);

  const { data: cfgData } = useQuery<any>({
    queryKey: ["/api/app-config"],
  });
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="bg-orb w-[500px] h-[500px] bg-indigo-600 top-[-150px] left-[-100px]" style={{ opacity: 0.25 }} />
        <div className="bg-orb w-[400px] h-[400px] bg-emerald-600 bottom-[-100px] right-[-80px]" style={{ opacity: 0.2 }} />
      </div>

      <div className="relative z-10 glass-card rounded-3xl p-10 max-w-md w-full text-center">
        <div className="relative inline-block mb-6">
          <div className="w-24 h-24 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto"
            style={{ boxShadow: "0 0 40px rgba(16,185,129,0.3)" }}>
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
        {verifiedPlan && (
          <p className="text-white/50 mb-6">
            Your <strong className="text-white">{verifiedPlan}</strong> account details have been sent to your email.
          </p>
        )}

        {/* Email notification */}
        <div className="glass rounded-2xl p-4 mb-4 flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Check your inbox</p>
            <p className="text-xs text-white/40">{email || "The email you used at checkout"}</p>
          </div>
        </div>

        {/* WhatsApp Channel CTA */}
        <a
          href={whatsappChannel}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-4"
          data-testid="link-whatsapp-channel"
        >
          <div className="glass rounded-2xl p-4 flex items-center gap-3 text-left border border-green-500/20 hover:border-green-500/40 transition-all cursor-pointer"
            style={{ background: "rgba(22,163,74,0.08)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(22,163,74,0.2)" }}>
              <MessageCircle className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-400">Follow Chege Tech on WhatsApp</p>
              <p className="text-xs text-white/40">Get updates, tips & exclusive deals on our channel</p>
            </div>
            <ExternalLink className="w-4 h-4 text-green-400/60 shrink-0" />
          </div>
        </a>

        {/* Instructions */}
        <div className="glass rounded-2xl p-4 mb-6 text-sm text-white/50 text-left space-y-1.5">
          <p className="font-semibold text-white/70 mb-2">What to do next:</p>
          {[
            "Check your email for the account credentials",
            "Do not change the account password or email",
            "This is a shared account — use it respectfully",
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 text-xs flex items-center justify-center shrink-0 font-bold">{i + 1}</span>
              {step}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 text-xs flex items-center justify-center shrink-0 font-bold">4</span>
            <span>WhatsApp us on <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-400 underline font-medium">{whatsappNumber}</a> for any issues</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 glass border-white/10 text-white/60 hover:text-white" onClick={() => setLocation("/")} data-testid="button-home">
            <Home className="w-4 h-4 mr-2" />Store
          </Button>
          <Button className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 border-0 text-white shadow-lg hover:opacity-90" onClick={() => setLocation("/")} data-testid="button-buy-more"
            style={{ boxShadow: "0 0 20px rgba(99,102,241,0.3)" }}>
            Buy More <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
