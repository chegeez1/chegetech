import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, ShieldCheck, ArrowLeft, Loader2, KeyRound, RotateCcw, Gift } from "lucide-react";

function setCustomerToken(t: string) { localStorage.setItem("customer_token", t); }
function setCustomerData(c: any) { localStorage.setItem("customer_data", JSON.stringify(c)); }

type Mode = "login" | "signup" | "verify" | "forgot" | "forgotSent" | "reset";

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [suspended, setSuspended] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [referralCode, setReferralCode] = useState(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return params.get("ref") || "";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) { setReferralCode(ref); setMode("signup"); return; }

    // Already logged in — check localStorage first, then fall back to cookie session
    const token = localStorage.getItem("customer_token");
    const cachedData = localStorage.getItem("customer_data");
    if (token && cachedData) { setLocation("/"); return; }

    // Either no localStorage token, or token exists but no cached data —
    // ask the server (cookie will be sent automatically for same-origin requests)
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch("/api/auth/me", { headers, credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          if (d.token) localStorage.setItem("customer_token", d.token);
          localStorage.setItem("customer_data", JSON.stringify(d.customer));
          setLocation("/");
        } else {
          localStorage.removeItem("customer_token");
          localStorage.removeItem("customer_data");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  function startCooldown() {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleResendVerification() {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Link resent!", description: "Check your inbox for a new verification link" });
      }
    } catch {
      toast({ title: "Error", description: "Connection failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleResendResetCode() {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Link resent!", description: "Check your inbox for a new verification link" });
      }
    } catch {
      toast({ title: "Error", description: "Connection failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setPassword("");
    setConfirmPassword("");
    setVerifyCode("");
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomerToken(data.token);
        setCustomerData(data.customer);
        toast({ title: "Welcome back!", description: `Logged in as ${data.customer.email}` });
        setLocation("/");
      } else if (data.needsVerification) {
        setMode("verify");
        toast({ title: "Verify your email", description: "Enter the code sent to your email" });
      } else if (data.suspended) {
        toast({ title: "Account Suspended", description: "Your account has been suspended. Please contact support to resolve this.", variant: "destructive" });
        setSuspended(true);
      } else {
        toast({ title: "Login failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Connection failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" }); return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "At least 6 characters required", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, referralCode: referralCode.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setMode("verify");
        toast({ title: "Check your email!", description: "Click the verification link we sent you" });
      } else {
        toast({ title: "Registration failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Connection failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = verifyCode.replace(/\D/g, "").trim();
    if (cleanCode.length !== 6) {
      toast({ title: "Enter the 6-digit code", description: "Check your email inbox or spam folder", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: cleanCode }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomerToken(data.token);
        setCustomerData(data.customer);
        toast({ title: "Email verified!", description: "Your account is now active" });
        setLocation("/");
      } else {
        toast({ title: "Verification failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Connection failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setMode("forgotSent");
        toast({ title: "Reset link sent!", description: "Check your inbox for a password reset link" });
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Connection failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" }); return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "At least 6 characters required", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: resetCode, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Password reset!", description: "You can now sign in with your new password" });
        switchMode("login");
      } else {
        toast({ title: "Reset failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Connection failed", variant: "destructive" });
    } finally { setLoading(false); }
  }

  const modeTitle: Record<Mode, string> = {
    login: "Welcome Back",
    signup: "Create Account",
    verify: "Verify Email",
    forgot: "Forgot Password",
    forgotSent: "Check your email",
    reset: "Reset Password",
  };

  const modeSubtitle: Record<Mode, string> = {
    login: "Sign in to your Chege Tech account",
    signup: "Join Chege Tech for exclusive access",
    verify: `Enter the code sent to ${email}`,
    forgot: "Enter your email to get a reset link",
    forgotSent: "Reset link sent to your inbox",
    reset: `Enter the code sent to ${email}`,
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4" style={{
      background: "radial-gradient(900px 700px at 15% 25%, rgba(255,43,214,.18), transparent 55%), radial-gradient(700px 600px at 85% 80%, rgba(99,102,241,.20), transparent 55%), linear-gradient(140deg, #0b1020, #0d0724)"
    }}>
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "conic-gradient(from 0deg, rgba(99,102,241,.12), rgba(255,43,214,.09), rgba(140,255,0,.06), rgba(99,102,241,.12))",
        filter: "blur(80px)",
        animation: "spin 20s linear infinite",
        opacity: 0.6,
        mixBlendMode: "screen",
      }} />
      <div className="fixed pointer-events-none" style={{ left: -120, top: "10%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, rgba(255,43,214,.3), transparent 60%)", filter: "blur(20px)", opacity: 0.25 }} />
      <div className="fixed pointer-events-none" style={{ right: -140, top: "55%", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, rgba(99,102,241,.35), transparent 62%)", filter: "blur(20px)", opacity: 0.25 }} />

      <button
        onClick={() => setLocation("/")}
        className="fixed top-5 left-5 z-20 flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors"
        data-testid="link-back-store"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Store
      </button>

      <div className="relative w-full max-w-md z-10">
        <div className="absolute inset-[-2px] rounded-2xl z-0" style={{
          background: "conic-gradient(from 0deg, rgba(99,102,241,.9), rgba(255,43,214,.85), rgba(140,255,0,.6), rgba(99,102,241,.9))",
          filter: "blur(7px)",
          animation: "spin 4s linear infinite",
          opacity: 0.9,
        }} />

        <div className="relative z-10 rounded-2xl p-8 border border-white/10" style={{
          background: "linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.04))",
          backdropFilter: "blur(20px)",
          boxShadow: "0 20px 70px rgba(0,0,0,.5)",
        }}>
          <div className="mb-7 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3" style={{
              background: "linear-gradient(135deg, rgba(99,102,241,.6), rgba(168,85,247,.6))",
              boxShadow: "0 0 24px rgba(99,102,241,.4)",
            }}>
              {mode === "forgot" || mode === "reset"
                ? <KeyRound className="w-6 h-6 text-white" />
                : <ShieldCheck className="w-6 h-6 text-white" />}
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight" style={{
              textShadow: "0 0 20px rgba(99,102,241,.4), 0 0 30px rgba(255,43,214,.2)",
            }}>
              {modeTitle[mode]}
            </h1>
            <p className="text-white/50 text-sm mt-1">{modeSubtitle[mode]}</p>
          </div>

          {/* Mode toggle — only for login/signup */}
          {(mode === "login" || mode === "signup") && (
            <div className="flex gap-2 mb-6 p-1.5 rounded-xl border border-white/10" style={{ background: "rgba(255,255,255,.05)" }}>
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  data-testid={`button-mode-${m}`}
                  onClick={() => switchMode(m)}
                  className="flex-1 py-2 rounded-lg text-sm font-bold transition-all capitalize"
                  style={mode === m ? {
                    background: "linear-gradient(90deg, rgba(99,102,241,.4), rgba(168,85,247,.3))",
                    color: "rgba(255,255,255,.95)",
                    boxShadow: "0 8px 20px rgba(0,0,0,.2)",
                  } : { color: "rgba(255,255,255,.5)" }}
                >
                  {m === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>
          )}

          {/* VERIFY FORM */}
          {mode === "verify" && (
            <div className="space-y-4">
              <div className="rounded-xl p-5 text-center" style={{ background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.2)" }}>
                <div className="w-14 h-14 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6 text-indigo-300" />
                </div>
                <p className="text-white font-semibold text-sm mb-1">Check your inbox</p>
                <p className="text-white/60 text-xs leading-relaxed">
                  We sent a verification link to{" "}
                  <span className="text-indigo-300 font-semibold">{email}</span>.<br />
                  Click the button in the email to confirm your account.
                </p>
                <p className="text-white/35 text-[11px] mt-3">Don't see it? Check your spam folder.</p>
              </div>

              <p className="text-center text-white/40 text-xs">
                Didn't get it?{" "}
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendCooldown > 0 || loading}
                  className="text-indigo-400 font-bold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-resend-verify"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend link"}
                </button>
                {" "}· valid for 30 min
              </p>

              <button type="button" onClick={() => switchMode("login")} className="w-full text-center text-white/40 text-sm hover:text-white/70 transition-colors mt-2">
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />Back to login
              </button>
            </div>
          )}

          {/* FORGOT PASSWORD: link sent confirmation */}
          {mode === "forgotSent" && (
            <div className="space-y-4">
              <div className="rounded-xl p-5 text-center" style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)" }}>
                <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-400/40 flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6 text-red-300" />
                </div>
                <p className="text-white font-semibold text-sm mb-1">Check your inbox</p>
                <p className="text-white/60 text-xs leading-relaxed">
                  We sent a password reset link to{" "}
                  <span className="text-red-300 font-semibold">{email}</span>.<br />
                  Click the button in the email to choose a new password.
                </p>
                <p className="text-white/35 text-[11px] mt-3">Don't see it? Check your spam folder. Link expires in 30 min.</p>
              </div>
              <button type="button" onClick={() => switchMode("login")} className="w-full text-center text-white/40 text-sm hover:text-white/70 transition-colors mt-2">
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />Back to login
              </button>
            </div>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="text-xs text-white/60 block mb-1.5">Email Address</label>
                <NeonInput
                  icon={<Mail className="w-4 h-4" />}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  testId="input-forgot-email"
                />
              </div>
              <NeonButton type="submit" loading={loading} testId="button-send-reset">
                Send Reset Code
              </NeonButton>
              <button type="button" onClick={() => switchMode("login")} className="w-full text-center text-white/40 text-sm hover:text-white/70 transition-colors mt-2">
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />Back to login
              </button>
            </form>
          )}

          {/* RESET PASSWORD FORM */}
          {mode === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs text-white/60 block mb-1.5">Reset Code</label>
                <NeonInput
                  icon={<KeyRound className="w-4 h-4" />}
                  type="text"
                  placeholder="123456"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  maxLength={6}
                  testId="input-reset-code"
                />
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1.5">New Password</label>
                <NeonInput
                  icon={<Lock className="w-4 h-4" />}
                  type={showPass ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  testId="input-new-password"
                  suffix={
                    <button type="button" onClick={() => setShowPass(!showPass)} className="text-white/30 hover:text-white/70 transition-colors">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1.5">Confirm New Password</label>
                <NeonInput icon={<Lock className="w-4 h-4" />} type="password" placeholder="Same password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required testId="input-confirm-new-password" />
              </div>
              <NeonButton type="submit" loading={loading} testId="button-reset-password">
                Reset Password
              </NeonButton>
              <p className="text-center text-white/30 text-xs">
                Didn't receive the code? Check your spam folder or{" "}
                <button
                  type="button"
                  onClick={handleResendResetCode}
                  disabled={resendCooldown > 0 || loading}
                  className="text-indigo-400 font-bold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-resend-reset"
                >
                  {resendCooldown > 0 ? `resend (${resendCooldown}s)` : "resend"}
                </button>
              </p>
              <button type="button" onClick={() => switchMode("login")} className="w-full text-center text-white/40 text-sm hover:text-white/70 transition-colors mt-2">
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />Back to login
              </button>
            </form>
          )}

          {/* LOGIN FORM */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              {suspended && (
                <div className="rounded-xl p-4 border border-red-500/30" style={{ background: "rgba(239,68,68,.1)" }}>
                  <p className="text-red-400 text-sm font-semibold mb-1">Account Suspended</p>
                  <p className="text-red-300/80 text-xs">Your account has been suspended. Please contact our support team to resolve this issue.</p>
                  <button
                    type="button"
                    onClick={() => window.open("https://wa.me/" + "254114291301", "_blank")}
                    className="mt-2 text-xs text-red-300 underline hover:text-red-200"
                  >
                    Contact Support on WhatsApp →
                  </button>
                </div>
              )}
              <div>
                <label className="text-xs text-white/60 block mb-1.5">Email Address</label>
                <NeonInput icon={<Mail className="w-4 h-4" />} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required testId="input-login-email" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-white/60">Password</label>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                    data-testid="button-forgot-password"
                  >
                    Forgot password?
                  </button>
                </div>
                <NeonInput
                  icon={<Lock className="w-4 h-4" />}
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  testId="input-login-password"
                  suffix={
                    <button type="button" onClick={() => setShowPass(!showPass)} className="text-white/30 hover:text-white/70 transition-colors">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>
              <NeonButton type="submit" loading={loading} testId="button-login">
                Sign In
              </NeonButton>
              <p className="text-center text-white/40 text-xs">
                No account?{" "}
                <button type="button" onClick={() => switchMode("signup")} className="text-indigo-400 font-bold hover:underline">
                  Create one
                </button>
              </p>
            </form>
          )}

          {/* SIGNUP FORM */}
          {mode === "signup" && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="text-xs text-white/60 block mb-1.5">Full Name</label>
                <NeonInput icon={<User className="w-4 h-4" />} type="text" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} testId="input-signup-name" />
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1.5">Email Address</label>
                <NeonInput icon={<Mail className="w-4 h-4" />} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required testId="input-signup-email" />
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1.5">Password</label>
                <NeonInput
                  icon={<Lock className="w-4 h-4" />}
                  type={showPass ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  testId="input-signup-password"
                  suffix={
                    <button type="button" onClick={() => setShowPass(!showPass)} className="text-white/30 hover:text-white/70 transition-colors">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1.5">Confirm Password</label>
                <NeonInput icon={<Lock className="w-4 h-4" />} type="password" placeholder="Same password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required testId="input-signup-confirm" />
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1.5">Referral Code <span className="text-white/30">(optional)</span></label>
                <NeonInput icon={<Gift className="w-4 h-4" />} type="text" placeholder="e.g. REF1A2B3" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} testId="input-signup-referral" />
              </div>
              <NeonButton type="submit" loading={loading} testId="button-signup">
                Create Account
              </NeonButton>
              <p className="text-center text-white/40 text-xs">
                Have an account?{" "}
                <button type="button" onClick={() => switchMode("login")} className="text-indigo-400 font-bold hover:underline">
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function NeonInput({ icon, suffix, testId, ...props }: {
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  testId?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-3 rounded-xl border border-white/10 transition-all focus-within:border-indigo-500/50 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" style={{ background: "rgba(255,255,255,.05)" }}>
      {icon && <span className="text-white/40 shrink-0">{icon}</span>}
      <input
        data-testid={testId}
        className="flex-1 bg-transparent outline-none text-white text-sm placeholder:text-white/25"
        {...props}
      />
      {suffix && <span className="shrink-0">{suffix}</span>}
    </div>
  );
}

function NeonButton({ children, loading, testId, ...props }: {
  children: React.ReactNode;
  loading?: boolean;
  testId?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      data-testid={testId}
      disabled={loading}
      className="w-full py-3 rounded-xl font-black text-sm text-white tracking-wide transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        background: "conic-gradient(from 0deg, rgba(99,102,241,.5), rgba(168,85,247,.45), rgba(255,43,214,.35), rgba(99,102,241,.5))",
        border: "1px solid rgba(255,255,255,.12)",
        boxShadow: "0 12px 35px rgba(0,0,0,.3)",
      }}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Processing...
        </span>
      ) : children}
    </button>
  );
}
