import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type SetupUser = { name: string; username: string; email: string };

export default function PasswordSetupPage() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const token = useMemo(() => new URLSearchParams(searchString).get("token") || "", [searchString]);
  const [user, setUser] = useState<SetupUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("This password setup link is missing or incomplete.");
      setLoading(false);
      return;
    }
    fetch(`/api/auth/password-setup?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "This password setup link is invalid.");
        setUser(data.user);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to validate this link."))
      .finally(() => setLoading(false));
  }, [token]);

  const checks = {
    length: newPassword.length >= 8,
    letters: /[a-zA-Z]/.test(newPassword),
    numbers: /[0-9]/.test(newPassword),
    match: Boolean(newPassword) && newPassword === confirmPassword,
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!Object.values(checks).every(Boolean)) {
      setError("Choose a password that meets all the requirements and matches the confirmation.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to set your password.");
      setComplete(true);
      window.setTimeout(() => setLocation("/login?setup=complete"), 1800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to set your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-2xl shadow-indigo-950/40 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-950 via-blue-900 to-violet-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />
            <div className="relative">
              <img src="/sc24lib-logo.png" alt="SC24Lib" className="h-10 w-auto brightness-0 invert" />
              <div className="mt-20 max-w-sm">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                  <KeyRound className="h-7 w-7 text-blue-200" />
                </div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200">Your library workspace</p>
                <h1 className="mt-4 text-4xl font-semibold leading-tight">A secure start to everything your library offers.</h1>
                <p className="mt-5 text-base leading-7 text-blue-100/75">Set your password once, then sign in to access your catalog, circulation tools, and personalized library services.</p>
              </div>
            </div>
            <div className="relative flex items-center gap-3 text-sm text-blue-100/70">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              Your invitation link is private and can only be used once.
            </div>
          </div>

          <div className="flex min-h-[620px] items-center justify-center bg-slate-50 p-6 sm:p-12">
            <div className="w-full max-w-md">
              <div className="mb-8 lg:hidden">
                <img src="/sc24lib-logo.png" alt="SC24Lib" className="h-9 w-auto" />
              </div>
              {loading ? (
                <div className="flex flex-col items-center gap-4 py-20 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-sm text-slate-500">Checking your invitation…</p>
                </div>
              ) : complete ? (
                <Card className="border-0 bg-white shadow-xl shadow-slate-200/60">
                  <CardContent className="p-8 text-center sm:p-10">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h2 className="mt-6 text-2xl font-semibold text-slate-900">Password set successfully</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-500">Your account is ready. We’re taking you to the sign-in page now.</p>
                    <Button className="mt-8 w-full" onClick={() => setLocation("/login?setup=complete")}>Continue to sign in <ArrowRight className="ml-2 h-4 w-4" /></Button>
                  </CardContent>
                </Card>
              ) : error ? (
                <Card className="border-0 bg-white shadow-xl shadow-slate-200/60">
                  <CardContent className="p-8 text-center sm:p-10">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                      <XCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <h2 className="mt-6 text-2xl font-semibold text-slate-900">This link is unavailable</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-500">{error}</p>
                    <Button variant="outline" className="mt-8 w-full" onClick={() => setLocation("/login")}>Return to sign in</Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-0 bg-white shadow-xl shadow-slate-200/60">
                  <CardContent className="p-8 sm:p-10">
                    <div className="mb-8">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Welcome to SC24Lib</p>
                      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Set your password</h2>
                      <p className="mt-3 text-sm leading-6 text-slate-500">Hi {user?.name}, create a password to activate your local account.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {error && <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                      <div className="space-y-2">
                        <Label htmlFor="setup-password">New password</Label>
                        <div className="relative">
                          <Input id="setup-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-12 pr-11" autoFocus />
                          <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="setup-confirm-password">Confirm password</Label>
                        <div className="relative">
                          <Input id="setup-confirm-password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-12 pr-11" />
                          <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowConfirmPassword((value) => !value)}>{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4 text-sm">
                        <p className="mb-2 font-medium text-slate-700">Password requirements</p>
                        <div className="grid gap-2 text-xs sm:grid-cols-2">
                          {[["length", "At least 8 characters"], ["letters", "At least one letter"], ["numbers", "At least one number"], ["match", "Passwords match"]].map(([key, label]) => (
                            <div key={key} className={`flex items-center gap-2 ${checks[key as keyof typeof checks] ? "text-emerald-700" : "text-slate-500"}`}>
                              <CheckCircle2 className={`h-3.5 w-3.5 ${checks[key as keyof typeof checks] ? "text-emerald-500" : "text-slate-300"}`} />{label}
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button type="submit" className="h-12 w-full bg-blue-600 text-base hover:bg-blue-700" disabled={submitting}>
                        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting password…</> : <>Set password <ArrowRight className="ml-2 h-4 w-4" /></>}
                      </Button>
                    </form>
                    <p className="mt-6 text-center text-xs text-slate-400">Account: {user?.username} · {user?.email}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}