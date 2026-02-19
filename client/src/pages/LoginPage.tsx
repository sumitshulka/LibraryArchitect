import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2 text-primary">
              <BookOpen className="h-10 w-10" />
              <span className="text-2xl font-bold">LibraTech</span>
            </div>
          </div>
          <CardTitle className="text-xl">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your library management account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" data-testid="alert-login-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Username or Email</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
                data-testid="input-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
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

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              <strong>First time setup?</strong>
              <br />
              Use default credentials:
              <br />
              Username: <code className="px-1 py-0.5 bg-background rounded">admin</code>
              <br />
              Password: <code className="px-1 py-0.5 bg-background rounded">admin123</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
