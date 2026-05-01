import { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, MessageCircle, Mail, Globe } from "lucide-react";

const FAQS = [
  {
    category: "Orders & Delivery",
    items: [
      {
        q: "How fast do I get my account after payment?",
        a: "Delivery is instant — within seconds of payment confirmation. Your credentials are sent to your email and also available in your dashboard under My Products."
      },
      {
        q: "What if I don\'t receive my account?",
        a: "Check your spam/junk folder first. If it\'s not there, log into your dashboard and check My Products. Still nothing? Contact us on Telegram and we\'ll resolve it immediately."
      },
      {
        q: "Can I track my order?",
        a: "Yes! Visit streamvault-premium.site/track and enter your order reference number. You\'ll see live status updates."
      },
    ]
  },
  {
    category: "Payments",
    items: [
      {
        q: "What payment methods do you accept?",
        a: "We accept M-Pesa, card payments, and wallet balance top-ups via Paystack. All payments are secure and encrypted."
      },
      {
        q: "Can I pay using my wallet balance?",
        a: "Yes! Top up your wallet from the dashboard and use it to pay for any service — subscriptions, bots, VPS, and more."
      },
      {
        q: "Do you offer refunds?",
        a: "Since accounts are delivered instantly, refunds are only possible if the account doesn\'t work and we can\'t replace it within 24 hours. Contact support with proof."
      },
      {
        q: "Is there a promo code I can use?",
        a: "Yes! Follow us on Telegram for exclusive discount codes. Promo codes are entered at checkout."
      },
    ]
  },
  {
    category: "Accounts & Subscriptions",
    items: [
      {
        q: "Are the accounts safe to use?",
        a: "Yes. All accounts are sourced safely and tested before listing. Shared plans work best when used on one device at a time as agreed."
      },
      {
        q: "How long does my subscription last?",
        a: "Duration depends on the plan you choose — 1 month, 3 months, or 6 months. Your expiry date is shown in your dashboard."
      },
      {
        q: "What happens when my subscription expires?",
        a: "You\'ll receive a reminder email 3 days before expiry. Simply renew from your dashboard to keep access uninterrupted."
      },
      {
        q: "Can I share my account with others?",
        a: "Shared plans allow a set number of users as listed. Private plans are for one person only. Exceeding limits may cause the account to be revoked."
      },
    ]
  },
  {
    category: "WhatsApp & Telegram Bots",
    items: [
      {
        q: "What is a WhatsApp bot?",
        a: "A WhatsApp bot is an automated assistant deployed to your WhatsApp number. It can handle customer queries, send media, run commands, and more — 24/7."
      },
      {
        q: "How do I get my bot deployed?",
        a: "After payment, provide your WhatsApp session ID. Our team deploys your bot on a VPS server within a few hours. You\'ll get live logs during deployment."
      },
      {
        q: "Can I restart or stop my bot?",
        a: "Yes. From your dashboard under My Bots, you can restart, stop, or view logs for your deployed bot anytime."
      },
    ]
  },
  {
    category: "VPS Hosting",
    items: [
      {
        q: "What VPS plans do you offer?",
        a: "We offer various VPS plans with different RAM, CPU, and storage options. Visit the VPS page to see current plans and pricing."
      },
      {
        q: "What OS options are available?",
        a: "Ubuntu, Debian, AlmaLinux/RHEL, and more. Select your preferred OS when ordering."
      },
    ]
  },
  {
    category: "Account & Security",
    items: [
      {
        q: "How do I reset my password?",
        a: "Click \'Forgot password\' on the login page, enter your email, and you\'ll receive a reset link. The link is valid for 30 minutes."
      },
      {
        q: "My account is suspended — what do I do?",
        a: "Contact support immediately on Telegram with your account email. Suspensions are reviewed within 24 hours."
      },
      {
        q: "How do I become an affiliate/reseller?",
        a: "Log into your dashboard and go to the Referrals section. Share your referral link and earn commission on every sale."
      },
    ]
  },
];

const PROMO_VIDEO_URL = (() => {
  try {
    // Set via window.__ENV__.PROMO_VIDEO_URL in index.html or injected by server
    const env = (window as any).__ENV__ || {};
    return env.PROMO_VIDEO_URL || import.meta.env.VITE_PROMO_VIDEO_URL || "";
  } catch { return ""; }
})();
const TELEGRAM = process.env.TELEGRAM_SUPPORT || "https://t.me/chegetech_support";
const SITE_URL = "https://streamvault-premium.site";

export default function FaqPage() {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <HelpCircle className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Help & FAQ</h1>
          <p className="text-white/50 text-sm">Everything you need to know about StreamVault Premium</p>
        </div>

        
        {/* Promo Video */}
        {PROMO_VIDEO_URL && (
          <div className="mb-10 rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl">
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-white/30 mx-auto">StreamVault Premium — Platform Overview</span>
            </div>
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src={PROMO_VIDEO_URL}
                title="StreamVault Premium Promo Video"
                className="absolute inset-0 w-full h-full border-0"
                allow="autoplay; fullscreen"
                loading="lazy"
              />
            </div>
          </div>
        )}

{/* FAQ Sections */}
        {FAQS.map((section) => (
          <div key={section.category} className="mb-6">
            <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3 px-1">{section.category}</h2>
            <div className="space-y-2">
              {section.items.map((item, idx) => {
                const key = `${section.category}-${idx}`;
                const isOpen = !!open[key];
                return (
                  <div key={key} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                    <button
                      onClick={() => toggle(key)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
                    >
                      <span className="text-sm font-medium text-white/90 pr-4">{item.q}</span>
                      {isOpen
                        ? <ChevronUp className="w-4 h-4 text-indigo-400 shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-sm text-white/60 leading-relaxed border-t border-white/10 pt-3">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Still need help */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h3 className="text-lg font-semibold mb-1">Still need help?</h3>
          <p className="text-white/50 text-sm mb-5">Our support team is available 24/7 on Telegram</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://t.me/chegetech_support"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-medium hover:bg-blue-500/30 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Chat on Telegram
            </a>
            <a
              href="mailto:support@streamvault-premium.site"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Email Support
            </a>
            <a
              href={SITE_URL}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors"
            >
              <Globe className="w-4 h-4" />
              Visit Website
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
