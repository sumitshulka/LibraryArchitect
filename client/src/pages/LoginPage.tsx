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
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-indigo-400 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 backdrop-blur-sm rounded-xl">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">LibraTech</span>
          </div>

          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-white leading-tight">
                Enterprise Library<br />Management System
              </h1>
              <p className="mt-4 text-lg text-blue-200 max-w-md">
                Streamline your library operations with intelligent catalog management, circulation tracking, and analytics.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md">
              {[
                { icon: "📚", title: "Smart Catalog", desc: "MARC21 & Z39.50 ready" },
                { icon: "🔄", title: "Circulation", desc: "Automated workflows" },
                { icon: "📊", title: "Analytics", desc: "Real-time insights" },
                { icon: "🔗", title: "ERP Ready", desc: "SSO integration" },
              ].map((feature) => (
                <div key={feature.title} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                  <span className="text-xl">{feature.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{feature.title}</p>
                    <p className="text-xs text-blue-300">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-blue-300/60">
            LibraTech &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="p-2 bg-blue-600 rounded-xl">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">LibraTech</span>
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
            LibraTech &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
