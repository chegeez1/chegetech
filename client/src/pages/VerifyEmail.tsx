import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const status = params.get("status");
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // After the link click, the server has already set the cookie.
    // Hit /api/auth/me to materialize the session in localStorage.
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          if (d.token) localStorage.setItem("customer_token", d.token);
          localStorage.setItem("customer_data", JSON.stringify(d.customer));
          setMe(d.customer);
          // Redirect to home after a brief celebration
          setTimeout(() => setLocation("/"), 1800);
        } else {
          setError("Could not establish session. Please sign in.");
        }
      })
      .catch(() => setError("Connection failed."))
      .finally(() => setChecking(false));
  }, []);

  const ok = status === "success" && !error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-indigo-950/30 to-zinc-950 p-4">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center">
        {checking ? (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-indigo-400 animate-spin mb-4" />
            <p className="text-white/70">Confirming your email...</p>
          </>
        ) : ok ? (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-5" data-testid="icon-success">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Email verified!</h1>
            <p className="text-white/60 text-sm mb-1">Welcome, <span className="text-emerald-300 font-semibold">{me?.name || me?.email}</span>.</p>
            <p className="text-white/40 text-xs">Taking you to your dashboard...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto mb-5" data-testid="icon-error">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verification incomplete</h1>
            <p className="text-white/60 text-sm mb-5">{error || "We couldn't confirm your email automatically."}</p>
            <button
              onClick={() => setLocation("/auth")}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold hover:opacity-90"
              data-testid="button-go-auth"
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
