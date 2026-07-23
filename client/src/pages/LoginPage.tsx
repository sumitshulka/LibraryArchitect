import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Loader2, AlertCircle, ArrowLeft, Mail, KeyRound, ShieldCheck, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const SSO_ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "SSO login failed: The authentication token is invalid or missing.",
  token_expired: "SSO login failed: The authentication token has expired. Please try again from your portal.",
  invalid_integration: "SSO login failed: The ERP integration could not be identified.",
  integration_disabled: "SSO login failed: The ERP integration is currently disabled.",
  origin_blocked: "SSO login failed: The request origin is not authorized.",
  auth_failed: "SSO login failed: Authentication could not be verified.",
  access_denied: "SSO login failed: Your role does not have access to the library system.",
  not_provisioned: "SSO login failed: Your library staff account has not been set up yet. Please contact your administrator.",
  account_inactive: "SSO login failed: Your account has been deactivated. Please contact your administrator.",
  sso_failed: "SSO login failed: An unexpected error occurred. Please try again.",
};

type FlowStep = "login" | "forgot-identify" | "forgot-otp" | "forgot-reset" | "forgot-success";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  const [step, setStep] = useState<FlowStep>("login");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const ssoError = params.get("error");
    if (ssoError && SSO_ERROR_MESSAGES[ssoError]) {
      setError(SSO_ERROR_MESSAGES[ssoError]);
    } else if (ssoError) {
      setError("SSO login failed. Please try again or contact your administrator.");
    }
  }, [searchString]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await login(username, password);
    if (result.success) {
      setLocation("/");
    } else {
      setError(result.error || "Login failed");
    }
    setIsLoading(false);
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotIdentifier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMaskedEmail(data.email);
      setStep("forgot-otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process request");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotIdentifier, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResetToken(data.resetToken);
      setStep("forgot-reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Password must contain both letters and numbers");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: forgotIdentifier,
          resetToken,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep("forgot-success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForgotFlow = () => {
    setStep("login");
    setForgotIdentifier("");
    setMaskedEmail("");
    setOtp("");
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };

  const passwordStrength = () => {
    if (!newPassword) return null;
    const hasLetters = /[a-zA-Z]/.test(newPassword);
    const hasNumbers = /[0-9]/.test(newPassword);
    const hasMinLength = newPassword.length >= 6;
    const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
    const checks = [hasLetters, hasNumbers, hasMinLength, hasSpecial].filter(Boolean).length;
    if (checks <= 2) return { label: "Weak", color: "bg-red-500", width: "w-1/3" };
    if (checks === 3) return { label: "Medium", color: "bg-yellow-500", width: "w-2/3" };
    return { label: "Strong", color: "bg-green-500", width: "w-full" };
  };

  const strength = passwordStrength();

  return (
    <div className="min-h-screen flex">
      <style>{`
        @keyframes float1 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-22px) scale(1.04)} }
        @keyframes float2 { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(18px) rotate(8deg)} }
        @keyframes float3 { 0%,100%{transform:translateY(0) scale(1)} 60%{transform:translateY(-14px) scale(1.07)} }
        @keyframes pulseRing { 0%,100%{transform:scale(1);opacity:.35} 50%{transform:scale(1.12);opacity:.15} }
        @keyframes pulseRing2 { 0%,100%{transform:scale(1);opacity:.2} 50%{transform:scale(1.18);opacity:.06} }
        @keyframes drift { 0%{transform:translate(0,0)} 33%{transform:translate(12px,-16px)} 66%{transform:translate(-10px,10px)} 100%{transform:translate(0,0)} }
        @keyframes shimmer { 0%,100%{opacity:.6} 50%{opacity:1} }
        .orb1{animation:float1 7s ease-in-out infinite}
        .orb2{animation:float2 9s ease-in-out infinite}
        .orb3{animation:float3 6s ease-in-out infinite}
        .ring1{animation:pulseRing 4s ease-in-out infinite}
        .ring2{animation:pulseRing2 6s ease-in-out infinite 1s}
        .drift1{animation:drift 12s ease-in-out infinite}
        .drift2{animation:drift 15s ease-in-out infinite reverse}
        .shimmer{animation:shimmer 3s ease-in-out infinite}
      `}</style>

      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{background:"linear-gradient(135deg,#0f1e5c 0%,#1a3a8f 30%,#0d2d7a 60%,#1e1060 100%)"}}>

        {/* Dot grid */}
        <div className="absolute inset-0" style={{backgroundImage:"radial-gradient(circle,rgba(255,255,255,0.12) 1px,transparent 1px)",backgroundSize:"28px 28px"}} />

        {/* Large glowing orbs */}
        <div className="orb1 absolute -top-20 -left-20 w-96 h-96 rounded-full" style={{background:"radial-gradient(circle,rgba(99,102,241,0.65) 0%,transparent 70%)",filter:"blur(40px)"}} />
        <div className="orb2 absolute -bottom-24 -right-16 w-[28rem] h-[28rem] rounded-full" style={{background:"radial-gradient(circle,rgba(220,38,38,0.45) 0%,rgba(59,130,246,0.3) 50%,transparent 70%)",filter:"blur(50px)"}} />
        <div className="orb3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full" style={{background:"radial-gradient(circle,rgba(139,92,246,0.4) 0%,transparent 65%)",filter:"blur(35px)"}} />

        {/* Pulsing rings */}
        <div className="ring1 absolute top-16 right-16 w-40 h-40 rounded-full border-2 border-indigo-400/40" />
        <div className="ring2 absolute top-16 right-16 w-56 h-56 rounded-full border border-indigo-300/20" style={{margin:"-32px"}} />
        <div className="ring1 absolute bottom-24 left-12 w-28 h-28 rounded-full border-2 border-red-400/35" style={{animationDelay:"2s"}} />
        <div className="ring2 absolute bottom-24 left-12 w-44 h-44 rounded-full border border-red-300/15" style={{margin:"-24px",animationDelay:"2s"}} />

        {/* Floating geometric accents */}
        <div className="drift1 absolute top-28 right-28 w-14 h-14 rounded-xl border-2 border-white/20 backdrop-blur-sm" style={{transform:"rotate(18deg)"}} />
        <div className="drift2 absolute bottom-40 right-20 w-8 h-8 rounded-lg border-2 border-indigo-300/40" style={{transform:"rotate(-12deg)"}} />
        <div className="drift1 absolute top-1/3 left-8 w-6 h-6 rounded-full bg-red-400/50" style={{animationDelay:"3s"}} />
        <div className="drift2 absolute top-2/3 right-12 w-4 h-4 rounded-full bg-indigo-300/60" style={{animationDelay:"1.5s"}} />
        <div className="drift1 absolute bottom-32 left-1/3 w-5 h-5 rounded-full bg-blue-300/50" style={{animationDelay:"4s"}} />

        {/* Glowing streak */}
        <div className="absolute top-0 left-0 w-full h-1" style={{background:"linear-gradient(90deg,transparent,rgba(139,92,246,0.8),rgba(220,38,38,0.6),transparent)"}} />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center">
            <img src="/sc24lib-logo.png" alt="SC24Lib" className="h-10 w-auto drop-shadow-lg" />
          </div>

          <div className="space-y-8">
            <div>
              <div className="shimmer inline-block mb-3 px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase" style={{background:"rgba(139,92,246,0.25)",border:"1px solid rgba(139,92,246,0.4)",color:"#c4b5fd"}}>
                Enterprise Platform
              </div>
              <h1 className="text-4xl font-bold text-white leading-tight drop-shadow-md">
                Enterprise Library<br />Management System
              </h1>
              <p className="mt-4 text-base text-blue-200/90 max-w-md leading-relaxed">
                Streamline your library operations with intelligent catalog management, circulation tracking, and analytics.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-md">
              {[
                { icon: "📚", title: "Smart Catalog", desc: "MARC21 & Z39.50 ready", accent: "rgba(99,102,241,0.3)" },
                { icon: "🔄", title: "Circulation", desc: "Automated workflows", accent: "rgba(59,130,246,0.3)" },
                { icon: "📊", title: "Analytics", desc: "Real-time insights", accent: "rgba(139,92,246,0.3)" },
                { icon: "🔗", title: "ERP Ready", desc: "SSO integration", accent: "rgba(220,38,38,0.25)" },
              ].map((feature) => (
                <div key={feature.title} className="flex items-start gap-3 p-3.5 rounded-xl backdrop-blur-sm border border-white/15 hover:border-white/30 transition-colors" style={{background:`linear-gradient(135deg,${feature.accent},rgba(255,255,255,0.04))`}}>
                  <span className="text-xl leading-none mt-0.5">{feature.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{feature.title}</p>
                    <p className="text-xs text-blue-200/70 mt-0.5">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Live stats strip */}
            <div className="flex items-center gap-6 pt-2">
              {[
                { value: "50K+", label: "Books" },
                { value: "99.9%", label: "Uptime" },
                { value: "24/7", label: "Support" },
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <p className="text-xl font-bold text-white drop-shadow">{stat.value}</p>
                  <p className="text-[11px] text-blue-300/70 uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-blue-300/50">
            SC24Lib &copy; {new Date().getFullYear()} · Enterprise Library Platform
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6" style={{background:"linear-gradient(135deg,#f0f4ff 0%,#e8eeff 50%,#f5f0ff 100%)"}}>
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="px-4 py-2 bg-blue-700 rounded-xl">
              <img src="/sc24lib-logo.png" alt="SC24Lib" className="h-8 w-auto" />
            </div>
          </div>

          {step === "login" && (
            <Card className="shadow-xl border-0 shadow-gray-200/50 dark:shadow-gray-900/50">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold tracking-tight" data-testid="text-login-title">Welcome back</h2>
                  <p className="text-muted-foreground mt-1">Sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <Alert variant="destructive" data-testid="alert-login-error">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium">Username or Email</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter your username or email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      required
                      className="h-11"
                      data-testid="input-username"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                      <button
                        type="button"
                        onClick={() => { setError(""); setStep("forgot-identify"); }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                        data-testid="link-forgot-password"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        required
                        className="h-11 pr-10"
                        data-testid="input-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 text-base font-medium bg-blue-600 hover:bg-blue-700"
                    disabled={isLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {step === "forgot-identify" && (
            <Card className="shadow-xl border-0 shadow-gray-200/50 dark:shadow-gray-900/50">
              <CardContent className="p-8">
                <button
                  onClick={resetForgotFlow}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </button>

                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-full">
                    <KeyRound className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">Forgot your password?</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your username or email and we'll send you a verification code.
                  </p>
                </div>

                <form onSubmit={handleForgotRequest} className="space-y-5">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="forgot-identifier">Username or Email</Label>
                    <Input
                      id="forgot-identifier"
                      type="text"
                      placeholder="Enter your username or email"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      disabled={isLoading}
                      required
                      className="h-11"
                      data-testid="input-forgot-identifier"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700"
                    disabled={isLoading || !forgotIdentifier}
                    data-testid="button-send-otp"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Verification Code
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {step === "forgot-otp" && (
            <Card className="shadow-xl border-0 shadow-gray-200/50 dark:shadow-gray-900/50">
              <CardContent className="p-8">
                <button
                  onClick={() => { setStep("forgot-identify"); setOtp(""); setError(""); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
                  data-testid="button-back-to-identify"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Change email
                </button>

                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-full">
                    <ShieldCheck className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">Check your email</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    We sent a 6-digit code to <strong>{maskedEmail}</strong>
                  </p>
                </div>

                <div className="space-y-5">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={setOtp}
                      data-testid="input-otp"
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <span className="text-muted-foreground">-</span>
                      <InputOTPGroup>
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button
                    onClick={handleVerifyOtp}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700"
                    disabled={isLoading || otp.length !== 6}
                    data-testid="button-verify-otp"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify Code"
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => { setOtp(""); setError(""); handleForgotRequest({ preventDefault: () => {} } as React.FormEvent); }}
                      className="text-xs text-blue-600 hover:underline"
                      disabled={isLoading}
                      data-testid="button-resend-otp"
                    >
                      Didn't receive the code? Resend
                    </button>
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    The code expires in 10 minutes
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "forgot-reset" && (
            <Card className="shadow-xl border-0 shadow-gray-200/50 dark:shadow-gray-900/50">
              <CardContent className="p-8">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-full">
                    <KeyRound className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">Set new password</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your identity has been verified. Create a new password.
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-5">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={isLoading}
                        required
                        className="h-11 pr-10"
                        data-testid="input-new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                    {strength && (
                      <div className="space-y-1">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                        </div>
                        <p className="text-xs text-muted-foreground">Strength: {strength.label}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className="h-11"
                      data-testid="input-confirm-password"
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500">Passwords do not match</p>
                    )}
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Password requirements:</p>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { label: "At least 6 characters", valid: newPassword.length >= 6 },
                        { label: "Contains letters", valid: /[a-zA-Z]/.test(newPassword) },
                        { label: "Contains numbers", valid: /[0-9]/.test(newPassword) },
                        { label: "Passwords match", valid: newPassword === confirmPassword && confirmPassword.length > 0 },
                      ].map((req) => (
                        <div key={req.label} className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${req.valid ? "bg-green-500" : "bg-gray-300"}`} />
                          <span className={`text-xs ${req.valid ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                            {req.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700"
                    disabled={isLoading || newPassword.length < 6 || newPassword !== confirmPassword}
                    data-testid="button-reset-password"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {step === "forgot-success" && (
            <Card className="shadow-xl border-0 shadow-gray-200/50 dark:shadow-gray-900/50">
              <CardContent className="p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-full">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <h2 className="text-xl font-bold mb-2">Password reset successful</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Your password has been updated. You can now sign in with your new password.
                </p>
                <Button
                  onClick={resetForgotFlow}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700"
                  data-testid="button-back-to-login-success"
                >
                  Back to Sign In
                </Button>
              </CardContent>
            </Card>
          )}

          <p className="text-center text-xs text-muted-foreground mt-6 lg:hidden">
            SC24Lib &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
