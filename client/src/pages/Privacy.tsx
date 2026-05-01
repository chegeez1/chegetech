import { ArrowLeft, Cookie, Shield, Database, Mail, Eye, Lock, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

export default function Privacy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg,#0a0a1a 0%,#0f0f2a 100%)" }}>
      <div className="max-w-2xl mx-auto px-5 py-10">
        {/* Back */}
        <button onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to store
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(99,102,241,.2)", border: "1px solid rgba(99,102,241,.3)" }}>
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Privacy &amp; Cookie Policy</h1>
            <p className="text-xs text-white/30">Last updated: March 2025</p>
          </div>
        </div>
        <p className="text-sm text-white/40 mb-10 leading-relaxed">
          This policy explains what data Chege Tech collects, why, and how you can control it.
        </p>

        {/* Sections */}
        {[
          {
            icon: Database,
            title: "What data we collect",
            content: `When you create an account or make a purchase we collect your name, email address, and transaction details. We do not store card numbers — payments are processed securely by Paystack. We also log IP addresses for security purposes.`,
          },
          {
            icon: Eye,
            title: "How we use your data",
            content: `Your data is used exclusively to deliver your subscription, send order confirmations and renewal reminders, provide customer support, and (with your consent) improve the store experience. We never sell your data to third parties.`,
          },
          {
            icon: Cookie,
            title: "Cookies & local storage",
            content: `We use browser local storage (not traditional cookies) to keep you logged in, remember your cart, and store your display preferences. The only true cookie we set is a sidebar-state preference. You can manage these in the cookie banner at any time.`,
            table: [
              { name: "customer_token", type: "Essential", purpose: "Keeps you logged into your account" },
              { name: "ct_cart", type: "Essential", purpose: "Saves your shopping cart between page loads" },
              { name: "ct_theme", type: "Functional", purpose: "Remembers your light/dark theme choice" },
              { name: "sidebar_state", type: "Functional", purpose: "Remembers the sidebar open/closed state (true cookie)" },
              { name: "cookie_consent_v1", type: "Essential", purpose: "Saves your cookie preference choices" },
            ],
          },
          {
            icon: Mail,
            title: "Email communications",
            content: `We send transactional emails (order confirmation, account credentials, renewal reminders) as part of your service. We do not send marketing emails unless you have explicitly opted in. You can opt out of non-essential emails at any time by contacting support.`,
          },
          {
            icon: Lock,
            title: "Data security",
            content: `All passwords are bcrypt-hashed and never stored in plain text. Sessions use secure tokens. Communication between your browser and our servers is encrypted with TLS. We conduct regular security reviews.`,
          },
          {
            icon: RefreshCw,
            title: "Your rights",
            content: `You can request a copy of your personal data, ask us to correct inaccurate data, or request deletion of your account at any time. To exercise these rights, contact us via the in-app support chat or email us directly.`,
          },
        ].map(({ icon: Icon, title, content, table }) => (
          <section key={title} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4 text-indigo-400 shrink-0" />
              <h2 className="text-sm font-semibold text-white">{title}</h2>
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
              <p className="text-sm text-white/50 leading-relaxed">{content}</p>
              {table && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                        {["Name", "Type", "Purpose"].map(h => (
                          <th key={h} className="text-left text-white/30 pb-2 pr-4 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.map(row => (
                        <tr key={row.name} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                          <td className="py-2 pr-4 font-mono text-white/60 whitespace-nowrap">{row.name}</td>
                          <td className="py-2 pr-4">
                            <span className="px-1.5 py-0.5 rounded text-[10px]"
                              style={{
                                background: row.type === "Essential" ? "rgba(52,211,153,.15)" : "rgba(129,140,248,.15)",
                                color: row.type === "Essential" ? "#34d399" : "#818cf8",
                              }}>
                              {row.type}
                            </span>
                          </td>
                          <td className="py-2 text-white/40">{row.purpose}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ))}

        <p className="text-xs text-white/20 mt-8 text-center">
          &copy; {new Date().getFullYear()} Chege Tech. All rights reserved.
        </p>
      </div>
    </div>
  );
}
