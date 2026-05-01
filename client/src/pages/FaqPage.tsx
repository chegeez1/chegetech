import { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, MessageCircle, Mail, Globe } from "lucide-react";
import PromoVideo from "../components/promo/PromoVideo";

const FAQS = [
  {
    category: "Orders & Delivery",
    items: [
      { q: "How fast do I get my account after payment?", a: "Delivery is instant — within seconds of payment confirmation. Your credentials are sent to your email and also available in your dashboard under My Products." },
      { q: "What if I don't receive my account?", a: "Check your spam/junk folder first. If it's not there, log into your dashboard and check My Products. Still nothing? Contact us on Telegram and we'll resolve it immediately." },
      { q: "Can I track my order?", a: "Yes! Visit streamvault-premium.site/track and enter your order reference number. You'll see live status updates." },
    ]
  },
  {
    category: "Payments",
    items: [
      { q: "What payment methods do you accept?", a: "We accept M-Pesa, card payments, and wallet balance top-ups via Paystack. All payments are secure and encrypted." },
      { q: "Can I pay using my wallet balance?", a: "Yes! Top up your wallet from the dashboard and use it to pay for any service — subscriptions, bots, VPS, and more." },
      { q: "Do you offer refunds?", a: "Since accounts are delivered instantly, refunds are only possible if the account doesn't work and we can't replace it within 24 hours. Contact support with proof." },
      { q: "Is there a promo code I can use?", a: "Yes! Follow us on Telegram for exclusive discount codes. Promo codes are entered at checkout." },
    ]
  },
  {
    category: "Accounts & Subscriptions",
    items: [
      { q: "Are the accounts safe to use?", a: "Yes. All accounts are sourced safely and tested before listing. Shared plans work best when used on one device at a time as agreed." },
      { q: "How long does my subscription last?", a: "Duration depends on the plan you choose — 1 month, 3 months, or 6 months. Your expiry date is shown in your dashboard." },
      { q: "What happens when my subscription expires?", a: "You'll receive a reminder email 3 days before expiry. Simply renew from your dashboard to keep access uninterrupted." },
      { q: "Can I share my account with others?", a: "Shared plans allow a set number of users as listed. Private plans are for one person only. Exceeding limits may cause the account to be revoked." },
    ]
  },
  {
    category: "WhatsApp & Telegram Bots",
    items: [
      { q: "What is a WhatsApp bot?", a: "A WhatsApp bot is an automated assistant deployed to your WhatsApp number. It can handle customer queries, send media, run commands, and more — 24/7." },
      { q: "How do I get my bot deployed?", a: "After payment, provide your WhatsApp number. We deploy and configure the bot within 24 hours. You'll receive full setup instructions." },
      { q: "Can I use it for my business?", a: "Yes! The bot is ideal for small businesses, online stores, and freelancers who want to automate customer communication." },
      { q: "What's the difference between WhatsApp Bot and Telegram Bot?", a: "WhatsApp bots run on your personal/business number using Baileys. Telegram bots use the official Bot API and can be added to groups or channels." },
    ]
  },
  {
    category: "VPS & Hosting",
    items: [
      { q: "What is a VPS?", a: "A Virtual Private Server is a remote computer you can use 24/7 for running bots, hosting websites, or automated scripts." },
      { q: "What OS options are available?", a: "We offer Ubuntu 20.04 and 22.04 LTS. You get root SSH access and can install any software you need." },
      { q: "How do I connect to my VPS?", a: "Use any SSH client (e.g. PuTTY on Windows, Terminal on Mac/Linux). Your server IP, username, and password are sent after deployment." },
      { q: "What are the specs?", a: "Plans range from 1 vCPU/1GB RAM to 4 vCPU/8GB RAM. All plans include SSD storage and 100Mbps network." },
    ]
  },
  {
    category: "Security & Privacy",
    items: [
      { q: "Is my personal data safe?", a: "Yes. We use encrypted connections (HTTPS), hashed passwords, and never sell your data. You can delete your account anytime." },
      { q: "Do you store my M-Pesa PIN?", a: "No. We never see or store your M-Pesa PIN. Payments are processed directly through Safaricom's STK push on your device." },
      { q: "What if I suspect unauthorized access?", a: "Change your password immediately from the dashboard. Then contact us on Telegram and we'll help secure your account." },
    ]
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<string | null>(null);

  const toggle = (key: string) => setOpen(prev => prev === key ? null : key);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-purple-600/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-4">
            <HelpCircle className="w-4 h-4 text-purple-400" />
            <span className="text-purple-400 text-sm font-medium">Help Centre</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Frequently Asked Questions</h1>
          <p className="text-muted-foreground text-lg">Everything you need to know about StreamVault Premium</p>
        </div>

        {/* Promo Video - live animated showcase */}
        <div className="mb-12">
          <PromoVideo />
        </div>

        {/* FAQ Sections */}
        <div className="space-y-8">
          {FAQS.map((section) => (
            <div key={section.category}>
              <h2 className="text-lg font-semibold text-purple-400 mb-3 border-b border-border pb-2">
                {section.category}
              </h2>
              <div className="space-y-2">
                {section.items.map((item, i) => {
                  const key = `${section.category}-${i}`;
                  const isOpen = open === key;
                  return (
                    <div
                      key={key}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggle(key)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <span className="font-medium text-sm pr-4">{item.q}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 text-sm text-muted-foreground border-t border-border pt-3">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Contact section */}
        <div className="mt-12 p-6 rounded-xl border border-border bg-muted/30 text-center">
          <h3 className="font-semibold text-lg mb-1">Still have questions?</h3>
          <p className="text-muted-foreground text-sm mb-4">Our team is available 24/7 to help you</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={import.meta.env.VITE_TELEGRAM_SUPPORT || "https://t.me/chegetech_support"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Chat on Telegram
            </a>
            <a
              href="mailto:support@streamvault-premium.site"
              className="inline-flex items-center gap-2 border border-border hover:bg-muted px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Mail className="w-4 h-4" />
              Email Support
            </a>
            <a
              href="/"
              className="inline-flex items-center gap-2 border border-border hover:bg-muted px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Globe className="w-4 h-4" />
              Back to Store
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
