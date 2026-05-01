import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle, XCircle, KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") || "";
  const email = params.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = !!token && !!email;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword: password }),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error || "Reset failed"); return; }
      setDone(true);
      setTimeout(() => setLocation("/auth"), 2000);
    } catch {
      setError("Connection failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-indigo-950/30 to-zinc-950 p-4">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
        {!valid ? (
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Invalid reset link</h1>
            <p className="text-white/60 text-sm mb-5">This link is missing required parameters.</p>
            <button onClick={() => setLocation("/auth")} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold" data-testid="button-back">Back to sign in</button>
          </div>
        ) : done ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Password updated</h1>
            <p className="text-white/60 text-sm">Redirecting you to sign in...</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-violet-600 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Choose a new password</h1>
              <p className="text-white/50 text-xs mt-1">For <span className="text-indigo-300">{email}</span></p>
            </div>

            <div>
              <label className="text-xs text-white/60 block mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:border-indigo-500/50 outline-none pr-10"
                  placeholder="At least 6 characters"
                  required
                  data-testid="input-password"
                />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70" tabIndex={-1}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60 block mb-1.5">Confirm new password</label>
              <input
                type={showPass ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:border-indigo-500/50 outline-none"
                placeholder="Repeat password"
                required
                data-testid="input-confirm"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300 flex items-start gap-2" data-testid="error-message">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-red-500 to-violet-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-reset"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
