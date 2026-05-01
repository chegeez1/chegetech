import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bot, CheckCircle, Clock, Loader2, XCircle, Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BotOrderData {
  id: number; reference: string; botName: string; status: string;
  customerName: string; customerEmail: string; amount: number;
  sessionId?: string; deploymentNotes?: string; createdAt: string; updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  pending: { label: "Awaiting Payment", color: "text-yellow-400", icon: Clock, bg: "bg-yellow-500/10 border-yellow-500/20" },
  paid: { label: "Payment Confirmed", color: "text-blue-400", icon: CheckCircle, bg: "bg-blue-500/10 border-blue-500/20" },
  deploying: { label: "Deploying Bot", color: "text-purple-400", icon: Loader2, bg: "bg-purple-500/10 border-purple-500/20" },
  deployed: { label: "Bot Deployed!", color: "text-green-400", icon: Zap, bg: "bg-green-500/10 border-green-500/20" },
  failed: { label: "Deployment Failed", color: "text-red-400", icon: XCircle, bg: "bg-red-500/10 border-red-500/20" },
  deploy_failed: { label: "Deployment Failed", color: "text-red-400", icon: XCircle, bg: "bg-red-500/10 border-red-500/20" },
  stopped: { label: "Bot Stopped", color: "text-orange-400", icon: XCircle, bg: "bg-orange-500/10 border-orange-500/20" },
  suspended: { label: "Bot Suspended", color: "text-orange-400", icon: XCircle, bg: "bg-orange-500/10 border-orange-500/20" },
};

const STATUS_STEPS = ["pending", "paid", "deploying", "deployed"];

export default function BotOrder() {
  const { reference } = useParams();
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<{ success: boolean; order: BotOrderData }>({
    queryKey: [`/api/bots/order/${reference}`],
    refetchInterval: 10000,
  });

  const order = data?.order;
  const isFailedState = order?.status === "failed" || order?.status === "deploy_failed";
  const statusCfg = order ? (STATUS_CONFIG[order.status] || STATUS_CONFIG.pending) : null;
  const StatusIcon = statusCfg?.icon;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-400" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Order not found</p>
          <Button onClick={() => setLocation("/bots")} className="bg-green-500 hover:bg-green-600">Browse Bots</Button>
        </div>
      </div>
    );
  }

  const currentStepIdx = STATUS_STEPS.indexOf(order.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white py-8 px-4">
      <div className="max-w-xl mx-auto">
        <button onClick={() => setLocation("/bots")} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Bot Store
        </button>

        {/* Status card */}
        <div className={`border rounded-2xl p-6 mb-6 text-center ${statusCfg?.bg}`}>
          {StatusIcon && (
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
              <StatusIcon className={`w-7 h-7 ${statusCfg?.color} ${order.status === "deploying" ? "animate-spin" : ""}`} />
            </div>
          )}
          <h2 className={`text-xl font-bold mb-1 ${statusCfg?.color}`}>{statusCfg?.label}</h2>
          <p className="text-gray-400 text-sm">
            {order.status === "pending" && "Complete your payment to proceed with deployment."}
            {order.status === "paid" && "Your payment has been received. We're preparing to deploy your bot."}
            {order.status === "deploying" && "Your bot is being deployed. This usually takes a few minutes."}
            {order.status === "deployed" && "Your bot is live and running on our servers!"}
            {order.status === "failed" && "There was an issue deploying your bot. Please contact support."}
            {order.status === "deploy_failed" && "Deployment to VPS failed. See the error details below."}
            {order.status === "stopped" && "Your bot has been stopped by admin."}
            {order.status === "suspended" && "Your bot has been suspended."}
          </p>
        </div>

        {/* Progress steps */}
        {!isFailedState && order.status !== "stopped" && order.status !== "suspended" && (
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((step, i) => {
                const cfg = STATUS_CONFIG[step];
                const Icon = cfg.icon;
                const done = i < currentStepIdx || order.status === "deployed";
                const active = i === currentStepIdx && order.status !== "deployed";
                return (
                  <div key={step} className="flex items-center flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${done || (order.status === "deployed") ? "bg-green-500 border-green-500 text-white" : active ? "border-blue-400 text-blue-400" : "border-white/10 text-gray-600"}`}>
                      {done && order.status !== "deployed" ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 ${i < currentStepIdx ? "bg-green-500" : "bg-white/10"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2">
              {STATUS_STEPS.map((step) => (
                <div key={step} className="flex-1 text-center">
                  <p className="text-xs text-gray-500">{STATUS_CONFIG[step].label.split(" ")[0]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order details */}
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">{order.botName}</p>
              <p className="text-xs text-gray-500">{order.reference}</p>
            </div>
            <p className="ml-auto font-bold text-green-400">KES {order.amount}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Customer</p>
              <p className="text-gray-300">{order.customerName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Email</p>
              <p className="text-gray-300 truncate">{order.customerEmail}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Ordered</p>
              <p className="text-gray-300">{new Date(order.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Updated</p>
              <p className="text-gray-300">{new Date(order.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>

          {order.deploymentNotes && (
            <div className="pt-3 border-t border-white/5">
              <p className="text-xs text-gray-500 mb-1">{isFailedState ? "Error Details" : "Admin Notes"}</p>
              <p className={`text-sm ${isFailedState ? "text-red-400" : "text-gray-300"}`}>{order.deploymentNotes}</p>
              {isFailedState && (
                <p className="text-xs text-gray-500 mt-2">Please contact support with your order reference: <span className="text-gray-300">{order.reference}</span></p>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-600 text-center mt-6">
          This page auto-refreshes every 30 seconds · Order ref: {order.reference}
        </p>

        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={() => setLocation("/bots")} className="flex-1 border-white/10 text-gray-400 hover:text-white">
            Browse More Bots
          </Button>
          <Button onClick={() => setLocation("/track")} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300">
            Track Subscription
          </Button>
        </div>
      </div>
    </div>
  );
}
