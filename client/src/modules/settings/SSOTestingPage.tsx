import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { erpIntegrationsApi } from "@/lib/api";
import type { ErpIntegration } from "@shared/schema";
import { toast } from "sonner";
import { 
  Key, 
  Play, 
  Copy, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  FileCode,
  Shield,
  Clock,
  User,
  Users,
  Code2,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TokenResponse {
  token: string;
  callbackUrl: string;
  expiresIn: number;
  instructions: {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
}

interface SimulateLoginResponse {
  success: boolean;
  userCreated: boolean;
  user: {
    id: number;
    name: string;
    email: string;
    category: string;
    role: string;
    department?: string;
  };
  session: {
    id: string;
    expiresAt: string;
  };
  tokenDetails: {
    token: string;
    payload: {
      appId: string;
      userId: string;
      userType: string;
      role?: string;
      name: string;
      email: string;
      timestamp: number;
    };
    signatureValid: boolean;
    mappedRole: string;
    mappedCategory: string;
  };
}

export default function SSOTestingPage() {
  const [selectedIntegration, setSelectedIntegration] = useState<string>("");
  const [secretKey, setSecretKey] = useState("");
  const [userId, setUserId] = useState("EMP-001");
  const [userType, setUserType] = useState<string>("EMPLOYEE");
  const [role, setRole] = useState("LIBRARIAN");
  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john.doe@example.edu");
  const [department, setDepartment] = useState("Library Services");
  const [tokenResponse, setTokenResponse] = useState<TokenResponse | null>(null);
  const [loginResponse, setLoginResponse] = useState<SimulateLoginResponse | null>(null);

  const { data: integrations = [] } = useQuery({
    queryKey: ["erp-integrations"],
    queryFn: erpIntegrationsApi.getAll,
  });

  type ErpIntegrationPublic = Omit<ErpIntegration, 'secretHash' | 'secretSalt'>;

  const selectedIntegrationData = integrations.find(i => i.id.toString() === selectedIntegration);

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIntegrationData) throw new Error("Select an integration");
      
      const response = await fetch("/api/sso/test/generate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: selectedIntegrationData.appId,
          secretKey,
          userId,
          userType,
          role,
          name,
          email,
          department
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate token");
      }
      
      return response.json() as Promise<TokenResponse>;
    },
    onSuccess: (data) => {
      setTokenResponse(data);
      setLoginResponse(null);
      toast.success("Token generated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const simulateLoginMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIntegrationData) throw new Error("Select an integration");
      
      const response = await fetch("/api/sso/test/simulate-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: selectedIntegrationData.appId,
          secretKey,
          userId,
          userType,
          role,
          name,
          email,
          department
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to simulate login");
      }
      
      return response.json() as Promise<SimulateLoginResponse>;
    },
    onSuccess: (data) => {
      setLoginResponse(data);
      toast.success(data.userCreated ? "New user created and logged in" : "User logged in successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">SSO Testing & Documentation</h1>
          <p className="text-muted-foreground mt-1">Test Single Sign-On integration and generate authentication tokens</p>
        </div>

        <Tabs defaultValue="testing" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="testing" className="gap-2" data-testid="tab-sso-testing">
              <Play className="h-4 w-4" />
              API Sandbox
            </TabsTrigger>
            <TabsTrigger value="documentation" className="gap-2" data-testid="tab-sso-docs">
              <FileCode className="h-4 w-4" />
              Documentation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="testing" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Token Generator
                  </CardTitle>
                  <CardDescription>
                    Generate SSO tokens to test ERP-to-Library authentication
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>ERP Integration</Label>
                    <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
                      <SelectTrigger data-testid="select-integration">
                        <SelectValue placeholder="Select an integration" />
                      </SelectTrigger>
                      <SelectContent>
                        {integrations.map((integration) => (
                          <SelectItem key={integration.id} value={integration.id.toString()}>
                            {integration.name} ({integration.appId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedIntegrationData && (
                    <div className="p-3 rounded-lg bg-muted/50 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">App ID:</span>
                        <code className="font-mono">{selectedIntegrationData.appId}</code>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="secret-key">Secret Key</Label>
                    <Input
                      id="secret-key"
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      placeholder="Enter the secret key for this integration"
                      data-testid="input-secret-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      This is the secret key shown when the integration was created
                    </p>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium mb-3">User Information (from ERP)</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="user-id">User ID</Label>
                        <Input
                          id="user-id"
                          value={userId}
                          onChange={(e) => setUserId(e.target.value)}
                          placeholder="EMP-001 or STU-001"
                          data-testid="input-user-id"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>User Type</Label>
                        <Select value={userType} onValueChange={setUserType}>
                          <SelectTrigger data-testid="select-user-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EMPLOYEE">Employee (Staff)</SelectItem>
                            <SelectItem value="STUDENT">Student</SelectItem>
                            <SelectItem value="FACULTY">Faculty</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="grid gap-2">
                        <Label htmlFor="user-name">Name</Label>
                        <Input
                          id="user-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          data-testid="input-name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="user-email">Email</Label>
                        <Input
                          id="user-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          data-testid="input-email"
                        />
                      </div>
                    </div>

                    {userType === "EMPLOYEE" && (
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="grid gap-2">
                          <Label>ERP Role</Label>
                          <Select value={role} onValueChange={setRole}>
                            <SelectTrigger data-testid="select-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LIBRARY_ADMIN">Library Admin</SelectItem>
                              <SelectItem value="LIBRARIAN">Librarian</SelectItem>
                              <SelectItem value="MANAGER">Manager (Denied)</SelectItem>
                              <SelectItem value="STAFF">Staff (Denied)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="department">Department</Label>
                          <Input
                            id="department"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            data-testid="input-department"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={() => generateTokenMutation.mutate()}
                      disabled={!selectedIntegration || !secretKey || generateTokenMutation.isPending}
                      className="flex-1"
                      variant="outline"
                      data-testid="button-generate-token"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      {generateTokenMutation.isPending ? "Generating..." : "Generate Token"}
                    </Button>
                    <Button 
                      onClick={() => simulateLoginMutation.mutate()}
                      disabled={!selectedIntegration || !secretKey || simulateLoginMutation.isPending}
                      className="flex-1"
                      data-testid="button-simulate-login"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {simulateLoginMutation.isPending ? "Testing..." : "Simulate Login"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                {tokenResponse && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Generated Token
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label>Token</Label>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(tokenResponse.token)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="p-3 rounded bg-muted font-mono text-xs break-all">
                          {tokenResponse.token}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Expires in {tokenResponse.expiresIn} seconds
                      </div>

                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="callback">
                          <AccordionTrigger className="text-sm">
                            <span className="flex items-center gap-2">
                              <ExternalLink className="h-4 w-4" />
                              Callback URL
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="p-3 rounded bg-muted font-mono text-xs break-all">
                              {tokenResponse.callbackUrl}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => copyToClipboard(tokenResponse.callbackUrl)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy URL
                            </Button>
                          </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="instructions">
                          <AccordionTrigger className="text-sm">
                            <span className="flex items-center gap-2">
                              <Code2 className="h-4 w-4" />
                              Request Instructions
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <ScrollArea className="h-[200px]">
                              <pre className="p-3 rounded bg-muted font-mono text-xs whitespace-pre-wrap">
{`// ERP should make this request:
${tokenResponse.instructions.method} ${tokenResponse.instructions.url}

Headers:
${Object.entries(tokenResponse.instructions.headers).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

// Example with curl:
curl -X GET "${tokenResponse.callbackUrl}" \\
  -H "X-Secret-Key: YOUR_SECRET_KEY"`}
                              </pre>
                            </ScrollArea>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                )}

                {loginResponse && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {loginResponse.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        Login Simulation Result
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={loginResponse.userCreated ? "default" : "secondary"}>
                          {loginResponse.userCreated ? "New User Created" : "Existing User"}
                        </Badge>
                        <Badge variant="outline">
                          {loginResponse.user.category} / {loginResponse.user.role}
                        </Badge>
                      </div>

                      <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                        <div className="flex items-center gap-3">
                          <User className="h-8 w-8 text-primary" />
                          <div>
                            <div className="font-medium">{loginResponse.user.name}</div>
                            <div className="text-sm text-muted-foreground">{loginResponse.user.email}</div>
                          </div>
                        </div>
                      </div>

                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="mapping">
                          <AccordionTrigger className="text-sm">
                            <span className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4" />
                              Role Mapping Details
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between p-2 rounded bg-muted">
                                <span className="text-muted-foreground">ERP User Type:</span>
                                <code>{loginResponse.tokenDetails.payload.userType}</code>
                              </div>
                              <div className="flex items-center justify-center">
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex justify-between p-2 rounded bg-muted">
                                <span className="text-muted-foreground">Library Category:</span>
                                <Badge>{loginResponse.tokenDetails.mappedCategory}</Badge>
                              </div>
                              <div className="flex justify-between p-2 rounded bg-muted">
                                <span className="text-muted-foreground">Library Role:</span>
                                <Badge variant="outline">{loginResponse.tokenDetails.mappedRole}</Badge>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="session">
                          <AccordionTrigger className="text-sm">
                            <span className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Session Details
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Session ID:</span>
                                <code className="font-mono text-xs">{loginResponse.session.id}</code>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Expires:</span>
                                <span>{new Date(loginResponse.session.expiresAt).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Signature Valid:</span>
                                {loginResponse.tokenDetails.signatureValid ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                )}

                {!tokenResponse && !loginResponse && (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                      <Key className="h-12 w-12 mb-4 opacity-50" />
                      <p className="font-medium">No test results yet</p>
                      <p className="text-sm mt-1">
                        Select an integration, enter the secret key, and generate a token or simulate login
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="documentation" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>SSO Authentication Flow</CardTitle>
                    <CardDescription>
                      How ERP systems authenticate users with the Library Management System
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                          1
                        </div>
                        <div>
                          <h4 className="font-medium">User Clicks Library Link in ERP</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            When a user wants to access the library from the ERP system, they click a link that triggers the SSO process.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                          2
                        </div>
                        <div>
                          <h4 className="font-medium">ERP Generates Signed Token</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            The ERP creates a JSON payload with user info, adds a timestamp, and signs it using HMAC-SHA256 with the shared secret key.
                          </p>
                          <pre className="mt-2 p-3 rounded bg-muted text-xs overflow-x-auto">
{`{
  "appId": "LIBRA-001",
  "userId": "EMP-1234",
  "userType": "EMPLOYEE",
  "role": "ADMIN",
  "name": "John Smith",
  "email": "john@company.edu",
  "department": "Library Services",
  "timestamp": 1706726400,
  "signature": "hmac_sha256(payload, SECRET_KEY)"
}`}
                          </pre>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                          3
                        </div>
                        <div>
                          <h4 className="font-medium">Redirect to Library SSO Callback</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            ERP redirects the user's browser to the library's SSO callback URL with the token and secret key header.
                          </p>
                          <pre className="mt-2 p-3 rounded bg-muted text-xs overflow-x-auto">
{`GET /api/sso/callback?token=BASE64_ENCODED_TOKEN
Headers:
  X-Secret-Key: YOUR_SECRET_KEY`}
                          </pre>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                          4
                        </div>
                        <div>
                          <h4 className="font-medium">Library Validates and Provisions User</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            The library validates the token signature, checks expiration, verifies origin whitelist, creates/updates the user, and establishes a session.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                          5
                        </div>
                        <div>
                          <h4 className="font-medium">User Accesses Library Dashboard</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            After successful authentication, the user is redirected to the appropriate dashboard based on their role (Staff → Dashboard, Patrons → Catalog).
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>API Reference</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="callback">
                        <AccordionTrigger>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">GET</Badge>
                            <code className="font-mono text-sm">/api/sso/callback</code>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              Main SSO callback endpoint. ERP redirects users here with a signed token.
                            </p>
                            <div>
                              <h5 className="font-medium text-sm mb-2">Query Parameters</h5>
                              <div className="rounded border">
                                <div className="p-2 border-b flex justify-between">
                                  <code className="text-sm">token</code>
                                  <Badge variant="destructive" className="text-xs">Required</Badge>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-medium text-sm mb-2">Headers</h5>
                              <div className="rounded border">
                                <div className="p-2 flex justify-between">
                                  <code className="text-sm">X-Secret-Key</code>
                                  <Badge variant="destructive" className="text-xs">Required</Badge>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-medium text-sm mb-2">Response</h5>
                              <p className="text-sm text-muted-foreground">
                                302 Redirect to /dashboard (Staff) or /catalog (Patrons) with session cookie
                              </p>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="session">
                        <AccordionTrigger>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">GET</Badge>
                            <code className="font-mono text-sm">/api/sso/session</code>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              Check current session status and get authenticated user info.
                            </p>
                            <div>
                              <h5 className="font-medium text-sm mb-2">Response (Authenticated)</h5>
                              <pre className="p-3 rounded bg-muted text-xs">
{`{
  "authenticated": true,
  "user": { ... },
  "sessionExpiresAt": "2024-02-01T..."
}`}
                              </pre>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="logout">
                        <AccordionTrigger>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-orange-500">POST</Badge>
                            <code className="font-mono text-sm">/api/sso/logout</code>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              End the current session and clear the session cookie.
                            </p>
                            <div>
                              <h5 className="font-medium text-sm mb-2">Response</h5>
                              <pre className="p-3 rounded bg-muted text-xs">
{`{
  "success": true
}`}
                              </pre>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Role Mapping</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h5 className="font-medium text-sm">Staff (Library Employees)</h5>
                        <p className="text-xs text-muted-foreground mb-2">Only employees with specific library roles are authorized</p>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">EMPLOYEE + LIBRARY_ADMIN</Badge>
                            <ArrowRight className="h-3 w-3" />
                            <Badge>ADMIN</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">EMPLOYEE + LIBRARIAN</Badge>
                            <ArrowRight className="h-3 w-3" />
                            <Badge>LIBRARIAN</Badge>
                          </div>
                          <div className="flex items-center gap-2 opacity-60">
                            <Badge variant="outline" className="font-mono">EMPLOYEE + other</Badge>
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="destructive">ACCESS DENIED</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h5 className="font-medium text-sm">Patrons (Library Users)</h5>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">STUDENT</Badge>
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="secondary">STUDENT</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">FACULTY</Badge>
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="secondary">FACULTY</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Library User Provisioning API
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Important</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          Library Staff (Admin/Librarian) must be pre-provisioned via API before they can log in via SSO.
                          Patrons (Students/Faculty) are auto-provisioned on first login.
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="font-mono text-xs text-green-600 dark:text-green-400">POST /api/erp/library-users</p>
                          <p className="text-xs text-muted-foreground mt-1">Create/update a library staff user</p>
                          <pre className="mt-2 text-xs bg-background p-2 rounded overflow-x-auto">{`{
  "appId": "ERP_APP_ID",
  "externalId": "EMP001",
  "name": "Jane Doe",
  "email": "jane@example.edu",
  "role": "LIBRARIAN", // or LIBRARY_ADMIN
  "department": "Library Services"
}`}</pre>
                        </div>
                        
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="font-mono text-xs text-blue-600 dark:text-blue-400">GET /api/erp/library-users?appId=...</p>
                          <p className="text-xs text-muted-foreground mt-1">List all library staff users</p>
                        </div>
                        
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="font-mono text-xs text-red-600 dark:text-red-400">DELETE /api/erp/library-users/:externalId?appId=...</p>
                          <p className="text-xs text-muted-foreground mt-1">Deactivate a library staff user</p>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        All endpoints require <code className="px-1 py-0.5 bg-muted rounded">X-Secret-Key</code> header.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Token Format</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Encoding:</span>
                        <span>Base64URL</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Signature:</span>
                        <span>HMAC-SHA256</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expiry:</span>
                        <span>5 minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Session Duration:</span>
                        <span>24 hours</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Security Checklist</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Token signature verification</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Timestamp expiration check (5 min)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Origin/Referer whitelist validation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Secret key verification</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>HTTP-only session cookies</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Secure cookie in production</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
