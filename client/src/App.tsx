import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Store from "@/pages/Store";
import Checkout from "@/pages/Checkout";
import CartCheckout from "@/pages/CartCheckout";
import PaymentSuccess from "@/pages/PaymentSuccess";
import Admin from "@/pages/Admin";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/not-found";
import ChatWidget from "@/components/ChatWidget";

const NO_CHAT_PATHS = ["/admin"];

function Router() {
  const [location] = useLocation();
  const showChat = !NO_CHAT_PATHS.some((p) => location.startsWith(p));
  return (
    <>
      <Switch>
        <Route path="/" component={Store} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/cart-checkout" component={CartCheckout} />
        <Route path="/payment/callback" component={PaymentSuccess} />
        <Route path="/payment/success" component={PaymentSuccess} />
        <Route path="/auth" component={Auth} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
      {showChat && <ChatWidget />}
    </>
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
