import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Store from "@/pages/Store";
import Checkout from "@/pages/Checkout";
import CartCheckout from "@/pages/CartCheckout";
import PaymentSuccess from "@/pages/PaymentSuccess";
import Admin from "@/pages/Admin";
import AdminPlanPreviews from "@/pages/AdminPlanPreviews";
import Auth from "@/pages/Auth";
import VerifyEmail from "@/pages/VerifyEmail";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/not-found";
import Docs from "@/pages/Docs";
import Privacy from "@/pages/Privacy";
import Track from "@/pages/Track";
import BotStore from "@/pages/BotStore";
import BotCheckout from "@/pages/BotCheckout";
import BotOrder from "@/pages/BotOrder";
import VpsPage from "@/pages/VpsPage";
import SmmPage from "./pages/SmmPage";
import ProxyPage from "./pages/ProxyPage";
import AccountsPage from "./pages/AccountsPage";
import TempMailPage from "./pages/TempMailPage";
import GiftCardsPage from "./pages/GiftCardsPage";
import TradingBotPage from "./pages/TradingBotPage";
import SmsPage from "./pages/SmsPage";
import TempNumbers from "@/pages/TempNumbers";
import Downloader from "@/pages/Downloader";
import FaqPage from "@/pages/FaqPage";
import Shell from "@/components/Shell";
import ChatWidget from "@/components/ChatWidget";
import CookieConsent from "@/components/CookieConsent";

const NO_CHAT_PATHS = ["/admin", "/docs", "/privacy", "/track", "/bots"];
const PUBLIC_PATHS = ["/downloader", "/auth", "/faq", "/admin", "/payment/callback", "/payment/success", "/docs", "/privacy", "/track", "/bots", "/verify-email", "/reset-password", "/smm", "/numbers", "/proxy", "/accounts", "/tempmail", "/giftcards", "/sms", "/tradingbot"];
const NO_COOKIE_PATHS = ["/admin"];
const SHELL_PATHS = ["/downloader", "/", "/bots", "/faq", "/vps", "/dashboard", "/numbers", "/smm", "/proxy", "/checkout", "/cart-checkout", "/payment", "/accounts", "/tempmail", "/giftcards", "/sms", "/tradingbot"];

function Router() {
  const [location] = useLocation();
  const showChat = !NO_CHAT_PATHS.some((p) => location.startsWith(p));
  const showCookies = !NO_COOKIE_PATHS.some((p) => location.startsWith(p));

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() => {
    const token = localStorage.getItem("customer_token");
    const data = localStorage.getItem("customer_data");
    return (token && data) ? true : null;
  });

  useEffect(() => {
    if (isAuthenticated !== null) return;
    const token = localStorage.getItem("customer_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch("/api/auth/me", { headers, credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          if (d.token) localStorage.setItem("customer_token", d.token);
          localStorage.setItem("customer_data", JSON.stringify(d.customer));
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem("customer_token");
          localStorage.removeItem("customer_data");
          setIsAuthenticated(false);
        }
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated((prev) => {
        if (prev === null) return prev;
        return !!localStorage.getItem("customer_token");
      });
    };
    window.addEventListener("storage", checkAuth);
    const interval = setInterval(checkAuth, 1000);
    return () => {
      window.removeEventListener("storage", checkAuth);
      clearInterval(interval);
    };
  }, []);

  const isPublic = PUBLIC_PATHS.some((p) => location.startsWith(p));

  if (isAuthenticated === null && !isPublic) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
      </div>
    );
  }

  if (!isAuthenticated && !isPublic) {
    return <Redirect to="/auth" />;
  }

  const useShell = isAuthenticated === true && SHELL_PATHS.some((p) =>
    p === "/" ? location === "/" : location.startsWith(p)
  );

  return (
    <Shell isAuthenticated={useShell}>
      <Switch>
        <Route path="/" component={Store} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/cart-checkout" component={CartCheckout} />
        <Route path="/payment/callback" component={PaymentSuccess} />
        <Route path="/payment/success" component={PaymentSuccess} />
        <Route path="/auth" component={Auth} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/vps" component={VpsPage} />
        <Route path="/numbers" component={TempNumbers} />
        <Route path="/smm" component={SmmPage} />
        <Route path="/proxy" component={ProxyPage} />
        <Route path="/accounts" component={AccountsPage} />
        <Route path="/tempmail" component={TempMailPage} />
                <Route path="/giftcards" component={GiftCardsPage} />
                <Route path="/tradingbot" component={TradingBotPage} />
                <Route path="/sms" component={SmsPage} />
        <Route path="/admin/plan-previews" component={AdminPlanPreviews} />
        <Route path="/admin" component={Admin} />
        <Route path="/track" component={Track} />
        <Route path="/docs" component={Docs} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/bots" component={BotStore} />
        <Route path="/bots/checkout/:botId" component={BotCheckout} />
        <Route path="/bots/order/:reference" component={BotOrder} />
        <Route path="/faq" component={FaqPage} />
        <Route component={NotFound} />
      </Switch>
      {showChat && <ChatWidget />}
      {showCookies && <CookieConsent />}
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
