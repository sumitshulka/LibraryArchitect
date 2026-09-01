import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, Lock, Globe, Mail, Database, BookOpen, Plus, Pencil, Trash2, 
  Key, RefreshCw, Shield, Copy, Eye, EyeOff, AlertTriangle, CheckCircle2, Link2, Coins,
  ArrowDownToLine, Play, Clock, Settings2, Zap, Send, ChevronDown, ChevronUp,
  Users, Repeat, Layers, PieChart, Loader2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { resourceTypesApi, categoriesApi, erpIntegrationsApi, configApi, paymentMethodsApi, resourceTypeSettingsApi, type ErpIntegrationPublic, type ErpCredentials, type ErpPullEndpoint, type PaymentMethodApi, type ResourceTypeSettingApi } from "@/lib/api";
import { toast } from "sonner";
import type { ResourceType, Category, ErpWhitelist } from "@shared/schema";
import { useLocation, useSearch } from "wouter";
import { CURRENCIES, getCurrencyByCode } from "@/lib/currency";
import { useCurrency } from "@/lib/useCurrency";

import { circulationPolicyApi, fineCalculationModeApi, type CirculationPolicy, type FineCalculationMode } from "@/lib/api";
import { PolicyChangeDialog, PolicyHistoryList } from "@/components/PolicyChangeDialog";
import { Z3950Search } from "@/modules/catalog/Z3950Search";

function CirculationRulesForm() {
  const { currency } = useCurrency();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["circulation-policy"],
    queryFn: () => circulationPolicyApi.get(),
  });

  const { data: modeData } = useQuery({
    queryKey: ["fine-calculation-mode"],
    queryFn: () => fineCalculationModeApi.get(),
  });

  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ["circulation-policy-history", "GLOBAL"],
    queryFn: () => circulationPolicyApi.history({ scope: "GLOBAL", limit: 50 }),
  });

  const [form, setForm] = useState<CirculationPolicy>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: { policy: CirculationPolicy; reason: string; effectiveFrom: string }) => circulationPolicyApi.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circulation-policy"] });
      queryClient.invalidateQueries({ queryKey: ["circulation-policy-history", "GLOBAL"] });
      refetchHistory();
      toast.success("Policy version saved");
      setConfirmOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const modeMutation = useMutation({
    mutationFn: (mode: FineCalculationMode) => fineCalculationModeApi.update(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fine-calculation-mode"] });
      toast.success("Fine calculation mode updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const numField = (key: keyof CirculationPolicy, val: string) => {
    setForm((f) => ({ ...f, [key]: val === "" ? undefined : Number(val) }));
  };
  const boolField = (key: keyof CirculationPolicy, val: boolean) => {
    setForm((f) => ({ ...f, [key]: val }));
  };

  const v = (k: keyof CirculationPolicy) => {
    const x = form[k];
    return x === undefined || x === null ? "" : String(x);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan & Fine Policies</CardTitle>
        <CardDescription>
          Default rules applied to all libraries. Each library can override these on its own settings page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="loan-days">Default Loan Period (Days)</Label>
            <Input
              id="loan-days"
              type="number"
              min={0}
              value={v("loanPeriodDays")}
              onChange={(e) => numField("loanPeriodDays", e.target.value)}
              data-testid="input-loan-days"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="max-books">Max Books per User</Label>
            <Input
              id="max-books"
              type="number"
              min={0}
              value={v("maxBooksPerUser")}
              onChange={(e) => numField("maxBooksPerUser", e.target.value)}
              data-testid="input-max-books"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="renewal-limit">Renewal Limit</Label>
            <Input
              id="renewal-limit"
              type="number"
              min={0}
              value={v("renewalLimit")}
              onChange={(e) => numField("renewalLimit", e.target.value)}
              data-testid="input-renewal-limit"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reservation-days">Reservation Hold (Days)</Label>
            <Input
              id="reservation-days"
              type="number"
              min={0}
              value={v("reservationDays")}
              onChange={(e) => numField("reservationDays", e.target.value)}
              data-testid="input-reservation-days"
            />
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Allow Renewals</Label>
            <p className="text-xs text-muted-foreground">Patrons can renew items online</p>
          </div>
          <Switch
            checked={form.allowRenewals ?? false}
            onCheckedChange={(c) => boolField("allowRenewals", c)}
            data-testid="switch-allow-renewals"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable Late Fines</Label>
            <p className="text-xs text-muted-foreground">Automatically calculate fines for overdue items</p>
          </div>
          <Switch
            checked={form.enableLateFines ?? false}
            onCheckedChange={(c) => boolField("enableLateFines", c)}
            data-testid="switch-enable-fines"
          />
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fine-amount">Fine per Day ({currency.symbol})</Label>
            <Input
              id="fine-amount"
              type="number"
              min={0}
              step="0.01"
              value={v("finePerDay")}
              onChange={(e) => numField("finePerDay", e.target.value)}
              data-testid="input-fine-per-day"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="grace-days">Grace Period (Days)</Label>
            <Input
              id="grace-days"
              type="number"
              min={0}
              value={v("gracePeriodDays")}
              onChange={(e) => numField("gracePeriodDays", e.target.value)}
              data-testid="input-grace-days"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fine-cap">Max Fine Cap ({currency.symbol})</Label>
            <Input
              id="fine-cap"
              type="number"
              min={0}
              step="0.01"
              value={v("maxFineCap")}
              onChange={(e) => numField("maxFineCap", e.target.value)}
              data-testid="input-max-fine-cap"
            />
            <p className="text-xs text-muted-foreground">Leave empty for no cap</p>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Fine Calculation Mode</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant={modeData?.mode === "LOCK_TO_DUE_DATE" ? "default" : "outline"}
              size="sm"
              onClick={() => modeMutation.mutate("LOCK_TO_DUE_DATE")}
              disabled={modeMutation.isPending}
              data-testid="button-mode-lock-due-date"
            >
              Lock to Due Date (default)
            </Button>
            <Button
              type="button"
              variant={modeData?.mode === "SEGMENT_PER_DAY" ? "default" : "outline"}
              size="sm"
              onClick={() => modeMutation.mutate("SEGMENT_PER_DAY")}
              disabled={modeMutation.isPending}
              data-testid="button-mode-segment-per-day"
            >
              Segment Per Day
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Lock to Due Date</strong>: the policy effective on a book's due date is used for the entire overdue window (predictable, recommended).{" "}
            <strong>Segment Per Day</strong>: each overdue day is charged at that day's rate, so policy changes apply going forward without retroactively re-pricing past days.
          </p>
        </div>
        <div className="flex justify-between items-center pt-2 gap-2 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((s) => !s)}
            data-testid="button-toggle-policy-history"
          >
            {showHistory ? "Hide" : "View"} policy history ({history?.length ?? 0})
          </Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={mutation.isPending || isLoading}
            data-testid="button-save-circulation-policy"
          >
            Save Policy…
          </Button>
        </div>
        {showHistory && (
          <div className="pt-2">
            <PolicyHistoryList versions={(history || []) as any} currencySymbol={currency.symbol} />
          </div>
        )}
      </CardContent>
      <PolicyChangeDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save Global Circulation Policy"
        description="Record a new version of the global circulation policy. A reason is required and will be saved to the audit log."
        isSubmitting={mutation.isPending}
        onConfirm={({ reason, effectiveFrom }) => mutation.mutate({ policy: form, reason, effectiveFrom })}
      />
    </Card>
  );
}

function ResourceTypeDialog({ 
  resourceType, 
  onClose 
}: { 
  resourceType?: ResourceType; 
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(resourceType?.name || "");
  const [description, setDescription] = useState(resourceType?.description || "");
  const [isActive, setIsActive] = useState(resourceType?.isActive ?? true);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string | null; isActive: boolean }) => 
      resourceTypesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-types"] });
      queryClient.invalidateQueries({ queryKey: ["resource-types", "active"] });
      toast.success("Resource type created");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; description: string | null; isActive: boolean }) => 
      resourceTypesApi.update(resourceType!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-types"] });
      queryClient.invalidateQueries({ queryKey: ["resource-types", "active"] });
      toast.success("Resource type updated");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    const data = { name, description: description || null, isActive };
    
    if (resourceType) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{resourceType ? "Edit" : "Add"} Resource Type</DialogTitle>
        <DialogDescription>
          Resource types help categorize your library materials (e.g., Hard Bound Book, eBook, Journal).
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Hard Bound Book"
            data-testid="input-type-name"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            data-testid="input-type-description"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Active</Label>
            <p className="text-xs text-muted-foreground">
              Active types can be selected when adding resources
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-active" />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-type">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CategoryDialog({ 
  category, 
  onClose 
}: { 
  category?: Category; 
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [isActive, setIsActive] = useState(category?.isActive ?? true);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string | null; isActive: boolean }) => 
      categoriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "active"] });
      toast.success("Category created");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; description: string | null; isActive: boolean }) => 
      categoriesApi.update(category!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "active"] });
      toast.success("Category updated");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    const data = { name, description: description || null, isActive };
    
    if (category) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{category ? "Edit" : "Add"} Category</DialogTitle>
        <DialogDescription>
          Categories help organize your library materials (e.g., Fiction, Non-Fiction, Science).
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="cat-name">Name *</Label>
          <Input
            id="cat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Fiction"
            data-testid="input-category-name"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cat-description">Description</Label>
          <Input
            id="cat-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            data-testid="input-category-description"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Active</Label>
            <p className="text-xs text-muted-foreground">
              Active categories can be selected when adding resources
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-category-active" />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-category">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CredentialsDisplay({ 
  credentials, 
  onClose 
}: { 
  credentials: ErpCredentials; 
  onClose: () => void;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<"appId" | "secret" | null>(null);

  const copyToClipboard = async (text: string, type: "appId" | "secret") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success(`${type === "appId" ? "App ID" : "Secret Key"} copied to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          ERP Integration Credentials
        </DialogTitle>
        <DialogDescription>
          Save these credentials securely. The Secret Key will only be shown once.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            {credentials.note}
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4 p-4 bg-muted rounded-lg">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">App ID</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-background rounded border font-mono text-sm break-all">
                {credentials.appId}
              </code>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(credentials.appId, "appId")}
              >
                {copied === "appId" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Secret Key</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-background rounded border font-mono text-sm break-all">
                {showSecret ? credentials.secretKey : "••••••••••••••••••••••••••••••••"}
              </code>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(credentials.secretKey, "secret")}
              >
                {copied === "secret" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onClose}>I have saved these credentials</Button>
      </DialogFooter>
    </>
  );
}

function CreateErpIntegrationDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [erpType, setErpType] = useState("");
  const [connectionMode, setConnectionMode] = useState<"HOST" | "CLIENT" | "BIDIRECTIONAL">("BIDIRECTIONAL");
  const [outboundBaseUrl, setOutboundBaseUrl] = useState("");
  const [description, setDescription] = useState("");
  const [credentials, setCredentials] = useState<ErpCredentials | null>(null);

  const createMutation = useMutation({
    mutationFn: erpIntegrationsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["erp-integrations"] });
      setCredentials(data.credentials);
      toast.success("ERP integration created");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !erpType.trim()) {
      toast.error("Name and ERP Type are required");
      return;
    }

    createMutation.mutate({
      name,
      erpType,
      connectionMode,
      outboundBaseUrl: outboundBaseUrl || null,
      description: description || null,
    });
  };

  if (credentials) {
    return <CredentialsDisplay credentials={credentials} onClose={onClose} />;
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Add ERP Integration</DialogTitle>
        <DialogDescription>
          Configure a new ERP system connection. Secure credentials will be generated automatically.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="erp-name">Integration Name *</Label>
          <Input
            id="erp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., University ERP Main"
            data-testid="input-erp-name"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="erp-type">ERP Type *</Label>
          <Input
            id="erp-type"
            value={erpType}
            onChange={(e) => setErpType(e.target.value)}
            placeholder="e.g., SAP, Oracle, Custom"
            data-testid="input-erp-type"
          />
        </div>
        <div className="grid gap-2">
          <Label>Connection Mode</Label>
          <Select value={connectionMode} onValueChange={(v) => setConnectionMode(v as any)}>
            <SelectTrigger data-testid="select-connection-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HOST">Host Only (LMS provides data)</SelectItem>
              <SelectItem value="CLIENT">Client Only (LMS receives data)</SelectItem>
              <SelectItem value="BIDIRECTIONAL">Bidirectional (Both ways)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Determines how data flows between LMS and ERP
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="outbound-url">ERP Base URL (for outbound requests)</Label>
          <Input
            id="outbound-url"
            value={outboundBaseUrl}
            onChange={(e) => setOutboundBaseUrl(e.target.value)}
            placeholder="https://api.erp-system.edu/v1"
            data-testid="input-outbound-url"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="erp-description">Description</Label>
          <Input
            id="erp-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            data-testid="input-erp-description"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-erp">
          {createMutation.isPending ? "Creating..." : "Create Integration"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function WhitelistDialog({ 
  integrationId,
  whitelist,
  onClose 
}: { 
  integrationId: number;
  whitelist?: ErpWhitelist;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [urlPattern, setUrlPattern] = useState(whitelist?.urlPattern || "");
  const [description, setDescription] = useState(whitelist?.description || "");
  const [isActive, setIsActive] = useState(whitelist?.isActive ?? true);

  const createMutation = useMutation({
    mutationFn: (data: { urlPattern: string; description: string | null; isActive: boolean }) =>
      erpIntegrationsApi.addWhitelist(integrationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-whitelist", integrationId] });
      toast.success("URL pattern added");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { urlPattern: string; description: string | null; isActive: boolean }) =>
      erpIntegrationsApi.updateWhitelist(integrationId, whitelist!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-whitelist", integrationId] });
      toast.success("URL pattern updated");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlPattern.trim()) {
      toast.error("URL pattern is required");
      return;
    }

    const data = { urlPattern, description: description || null, isActive };
    if (whitelist) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{whitelist ? "Edit" : "Add"} Whitelisted URL</DialogTitle>
        <DialogDescription>
          Only requests from whitelisted URLs will be accepted. Use patterns like https://erp.university.edu/*
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="url-pattern">URL Pattern *</Label>
          <Input
            id="url-pattern"
            value={urlPattern}
            onChange={(e) => setUrlPattern(e.target.value)}
            placeholder="https://erp.university.edu/*"
            data-testid="input-url-pattern"
          />
          <p className="text-xs text-muted-foreground">
            Use * as wildcard. Example: https://*.university.edu/api/*
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="whitelist-description">Description</Label>
          <Input
            id="whitelist-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Production ERP server"
            data-testid="input-whitelist-description"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Active</Label>
            <p className="text-xs text-muted-foreground">
              Inactive patterns are not enforced
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ErpIntegrationDetails({ 
  integration, 
  onBack 
}: { 
  integration: ErpIntegrationPublic;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [whitelistDialogOpen, setWhitelistDialogOpen] = useState(false);
  const [editingWhitelist, setEditingWhitelist] = useState<ErpWhitelist | undefined>();
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [rotatedCredentials, setRotatedCredentials] = useState<ErpCredentials | null>(null);

  const { data: whitelist = [], isLoading: loadingWhitelist } = useQuery({
    queryKey: ["erp-whitelist", integration.id],
    queryFn: () => erpIntegrationsApi.getWhitelist(integration.id),
  });

  const rotateMutation = useMutation({
    mutationFn: () => erpIntegrationsApi.rotateSecret(integration.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["erp-integrations"] });
      setRotatedCredentials(data.credentials);
      toast.success("Secret key rotated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteWhitelistMutation = useMutation({
    mutationFn: (id: number) => erpIntegrationsApi.deleteWhitelist(integration.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-whitelist", integration.id] });
      toast.success("URL pattern removed");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleEditWhitelist = (entry: ErpWhitelist) => {
    setEditingWhitelist(entry);
    setWhitelistDialogOpen(true);
  };

  const handleAddWhitelist = () => {
    setEditingWhitelist(undefined);
    setWhitelistDialogOpen(true);
  };

  const handleDeleteWhitelist = (id: number) => {
    if (confirm("Are you sure you want to remove this URL pattern?")) {
      deleteWhitelistMutation.mutate(id);
    }
  };

  const handleRotateSecret = () => {
    if (confirm("Are you sure you want to rotate the secret key? The old key will stop working immediately.")) {
      rotateMutation.mutate();
    }
  };

  if (rotatedCredentials) {
    return (
      <Dialog open={true} onOpenChange={() => setRotatedCredentials(null)}>
        <DialogContent>
          <CredentialsDisplay 
            credentials={rotatedCredentials} 
            onClose={() => setRotatedCredentials(null)} 
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          &larr; Back to Integrations
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="text-muted-foreground font-mono text-base">#{integration.id}</span>
                {integration.name}
                <Badge variant={integration.isActive ? "default" : "secondary"}>
                  {integration.isActive ? "Active" : "Inactive"}
                </Badge>
              </CardTitle>
              <CardDescription>{integration.erpType} - {integration.connectionMode}</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={handleRotateSecret}
              disabled={rotateMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${rotateMutation.isPending ? "animate-spin" : ""}`} />
              Rotate Secret
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">App ID</Label>
              <code className="block p-2 bg-muted rounded text-sm font-mono">{integration.appId}</code>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Last Secret Rotation</Label>
              <p className="p-2 text-sm">
                {new Date(integration.secretLastRotatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          {integration.outboundBaseUrl && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Outbound URL</Label>
              <code className="block p-2 bg-muted rounded text-sm font-mono">{integration.outboundBaseUrl}</code>
            </div>
          )}
          {integration.description && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm text-muted-foreground">{integration.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                URL Whitelist
              </CardTitle>
              <CardDescription>
                Only requests from these URLs will be accepted (max 5 patterns)
              </CardDescription>
            </div>
            <Dialog open={whitelistDialogOpen} onOpenChange={setWhitelistDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  className="gap-2" 
                  onClick={handleAddWhitelist}
                  disabled={whitelist.length >= 5}
                  data-testid="button-add-whitelist"
                >
                  <Plus className="h-4 w-4" />
                  Add URL Pattern
                </Button>
              </DialogTrigger>
              <DialogContent>
                <WhitelistDialog 
                  integrationId={integration.id}
                  whitelist={editingWhitelist}
                  onClose={() => {
                    setWhitelistDialogOpen(false);
                    setEditingWhitelist(undefined);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingWhitelist ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : whitelist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No URL patterns configured</p>
              <p className="text-sm">Add URL patterns to restrict incoming requests to trusted sources.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL Pattern</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {whitelist.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">{entry.urlPattern}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={entry.isActive ? "default" : "secondary"}>
                          {entry.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditWhitelist(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteWhitelist(entry.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-2">
                {whitelist.length}/5 URL patterns configured
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <OutboundAuthCard integration={integration} />

      <PullEndpointsCard integrationId={integration.id} />
    </div>
  );
}

function OutboundAuthCard({ integration }: { integration: ErpIntegrationPublic & { hasApiSecret?: boolean } }) {
  const queryClient = useQueryClient();
  const [apiSecret, setApiSecret] = useState("");
  const [tokenTtl, setTokenTtl] = useState(String(integration.authTokenTtlSeconds || 3600));
  const [loginUrlOverride, setLoginUrlOverride] = useState(integration.authLoginUrl || "");
  const [showSecret, setShowSecret] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Sync state when integration data changes (after save/refetch)
  useEffect(() => {
    setTokenTtl(String(integration.authTokenTtlSeconds || 3600));
    setLoginUrlOverride(integration.authLoginUrl || "");
  }, [integration.authTokenTtlSeconds, integration.authLoginUrl]);

  const defaultLoginUrl = integration.outboundBaseUrl 
    ? `${integration.outboundBaseUrl.replace(/\/$/, '')}/auth/login`
    : '';
  
  const hasApiSecret = integration.hasApiSecret;

  const updateAuthMutation = useMutation({
    mutationFn: () => {
      const updates: Record<string, any> = {};
      if (loginUrlOverride !== (integration.authLoginUrl || "")) {
        updates.authLoginUrl = loginUrlOverride || null;
      }
      if (apiSecret) {
        updates.authClientSecret = apiSecret;
      }
      const newTtl = parseInt(tokenTtl) || 3600;
      if (newTtl !== (integration.authTokenTtlSeconds || 3600)) {
        updates.authTokenTtlSeconds = newTtl;
      }
      return erpIntegrationsApi.updateAuthConfig(integration.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-integrations"] });
      toast.success("Outbound authentication settings saved");
      setIsEditing(false);
      setApiSecret("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: () => erpIntegrationsApi.testConnection(integration.id),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Connection successful");
      } else {
        toast.error(data.message || "Connection failed");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Outbound Authentication
            </CardTitle>
            <CardDescription>
              Configure credentials for Library to authenticate with ERP when fetching user data
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => testConnectionMutation.mutate()}
              disabled={testConnectionMutation.isPending}
            >
              <Zap className={`h-4 w-4 ${testConnectionMutation.isPending ? "animate-pulse" : ""}`} />
              Test Connection
            </Button>
            {!isEditing && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">App ID (used for authentication)</Label>
            <code className="block p-2 bg-muted rounded text-sm font-mono">{integration.appId}</code>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Login Endpoint</Label>
            {isEditing ? (
              <Input
                value={loginUrlOverride}
                onChange={(e) => setLoginUrlOverride(e.target.value)}
                placeholder={defaultLoginUrl || "Set outbound base URL first"}
                data-testid="input-login-url-override"
              />
            ) : (
              <code className="block p-2 bg-muted rounded text-sm font-mono">
                {loginUrlOverride || defaultLoginUrl || "Not configured - set outbound base URL"}
              </code>
            )}
            <p className="text-xs text-muted-foreground">
              Default: {defaultLoginUrl || "(requires outbound base URL)"} - Override only if different
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">API Secret (for outbound calls to ERP)</Label>
            {isEditing ? (
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder={hasApiSecret ? "Leave blank to keep existing" : "Enter API secret provided by ERP"}
                  data-testid="input-api-secret"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="p-2 bg-muted rounded text-sm flex items-center gap-2">
                {hasApiSecret ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Configured (hidden)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Not configured</span>
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              This secret is used when Library calls ERP APIs to fetch user details
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Token TTL (seconds)</Label>
            {isEditing ? (
              <Input
                type="number"
                value={tokenTtl}
                onChange={(e) => setTokenTtl(e.target.value)}
                placeholder="3600"
                data-testid="input-token-ttl"
              />
            ) : (
              <code className="block p-2 bg-muted rounded text-sm font-mono">
                {tokenTtl} seconds ({Math.round(parseInt(tokenTtl) / 60)} minutes)
              </code>
            )}
            <p className="text-xs text-muted-foreground">
              How long auth tokens are cached before refreshing (default: 3600 = 1 hour)
            </p>
          </div>
        </div>

        {isEditing && (
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={() => updateAuthMutation.mutate()}
              disabled={updateAuthMutation.isPending}
              data-testid="button-save-auth"
            >
              {updateAuthMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditing(false);
                setApiSecret("");
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PullEndpointsCard({ integrationId }: { integrationId: number }) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [endpointDialogOpen, setEndpointDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<ErpPullEndpoint | undefined>();
  const [sandboxOpen, setSandboxOpen] = useState(false);

  const { data: endpoints = [], isLoading } = useQuery({
    queryKey: ["erp-pull-endpoints", integrationId],
    queryFn: () => erpIntegrationsApi.getPullEndpoints(integrationId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => erpIntegrationsApi.deletePullEndpoint(integrationId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-pull-endpoints", integrationId] });
      toast.success("Pull endpoint deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const testMutation = useMutation({
    mutationFn: erpIntegrationsApi.testPullEndpoint,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["erp-pull-endpoints", integrationId] });
      if (result.success) {
        toast.success(`Test successful (${result.responseTimeMs}ms)`);
      } else {
        toast.error(`Test failed: ${result.error || 'Unknown error'}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAddEndpoint = () => {
    setEditingEndpoint(undefined);
    setEndpointDialogOpen(true);
  };

  const handleEditEndpoint = (endpoint: ErpPullEndpoint) => {
    setEditingEndpoint(endpoint);
    setEndpointDialogOpen(true);
  };

  const handleDeleteEndpoint = (id: number) => {
    if (confirm("Are you sure you want to delete this pull endpoint?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleTestEndpoint = (id: number) => {
    testMutation.mutate(id);
  };

  const getEndpointTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ALL_STUDENTS: "All Students",
      SINGLE_STUDENT: "Single Student",
      LIBRARY_EMPLOYEES: "Library Employees",
      PROGRAMS: "Programs",
      PROGRAM_DEPARTMENTS: "Program Departments",
      COURSES: "Courses",
      PROGRAM_COURSES: "Program Courses",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">Not Tested</Badge>;
    switch (status) {
      case "SUCCESS":
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      case "ERROR":
        return <Badge variant="destructive">Error</Badge>;
      case "TIMEOUT":
        return <Badge variant="secondary">Timeout</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5" />
                Pull Endpoints (Data Import)
              </CardTitle>
              <CardDescription>
                Configure API endpoints to pull data from the ERP system
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                className="gap-2" 
                onClick={() => setSandboxOpen(true)}
                disabled={endpoints.length === 0}
                data-testid="button-open-swagger"
              >
                <Zap className="h-4 w-4" />
                API Sandbox
              </Button>
              <Button 
                size="sm" 
                className="gap-2" 
                onClick={handleAddEndpoint}
                data-testid="button-add-pull-endpoint"
              >
                <Plus className="h-4 w-4" />
                Add Endpoint
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : endpoints.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
              <ArrowDownToLine className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No pull endpoints configured</p>
              <p className="text-sm">Add endpoints to import data from the ERP system.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>URL Path</TableHead>
                  <TableHead>Last Test</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((endpoint) => (
                  <TableRow key={endpoint.id}>
                    <TableCell className="font-medium">{endpoint.name}</TableCell>
                    <TableCell>{getEndpointTypeLabel(endpoint.endpointType)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{endpoint.httpMethod}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm max-w-[200px] truncate">
                      {endpoint.urlPath}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(endpoint.lastTestStatus)}
                        {endpoint.lastTestedAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(endpoint.lastTestedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleTestEndpoint(endpoint.id)}
                        disabled={testMutation.isPending}
                        title="Test endpoint"
                      >
                        <Play className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleEditEndpoint(endpoint)}
                        title="Edit endpoint"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteEndpoint(endpoint.id)}
                        title="Delete endpoint"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={endpointDialogOpen} onOpenChange={setEndpointDialogOpen}>
        <DialogContent className="max-w-2xl">
          <PullEndpointDialog 
            integrationId={integrationId}
            endpoint={editingEndpoint}
            onClose={() => {
              setEndpointDialogOpen(false);
              setEditingEndpoint(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={sandboxOpen} onOpenChange={setSandboxOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <ApiSandbox 
            integrationId={integrationId}
            endpoints={endpoints}
            onClose={() => setSandboxOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ApiSandbox({ 
  integrationId, 
  endpoints, 
  onClose 
}: { 
  integrationId: number;
  endpoints: ErpPullEndpoint[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedEndpoint, setSelectedEndpoint] = useState<ErpPullEndpoint | null>(
    endpoints.length > 0 ? endpoints[0] : null
  );
  const [customHeaders, setCustomHeaders] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [customQueryParams, setCustomQueryParams] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: unknown;
    responseTimeMs: number;
    error?: string;
  } | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    request: true,
    response: true,
  });

  const testMutation = useMutation({
    mutationFn: erpIntegrationsApi.testPullEndpoint,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["erp-pull-endpoints", integrationId] });
      setTestResult(result);
      if (result.success) {
        toast.success(`Request successful (${result.responseTimeMs}ms)`);
      } else {
        toast.error(`Request failed: ${result.error || 'Unknown error'}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setTestResult({
        success: false,
        error: error.message,
        responseTimeMs: 0,
      });
    },
  });

  const handleSelectEndpoint = (endpoint: ErpPullEndpoint) => {
    setSelectedEndpoint(endpoint);
    setCustomHeaders(endpoint.requestHeaders ? JSON.stringify(endpoint.requestHeaders, null, 2) : "");
    setCustomBody(endpoint.requestBodyTemplate ? JSON.stringify(endpoint.requestBodyTemplate, null, 2) : "");
    setCustomQueryParams(endpoint.queryParameters ? JSON.stringify(endpoint.queryParameters, null, 2) : "");
    setTestResult(null);
  };

  const handleTest = () => {
    if (selectedEndpoint) {
      testMutation.mutate(selectedEndpoint.id);
    }
  };

  const toggleSection = (section: 'request' | 'response') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-500';
      case 'POST': return 'bg-blue-500';
      case 'PUT': return 'bg-yellow-500';
      case 'PATCH': return 'bg-orange-500';
      case 'DELETE': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          API Sandbox
        </DialogTitle>
        <DialogDescription>
          Test your ERP API endpoints with a Swagger-like interface
        </DialogDescription>
      </DialogHeader>
      
      <div className="flex-1 overflow-auto grid grid-cols-3 gap-4 mt-4">
        <div className="col-span-1 border rounded-lg overflow-auto max-h-[60vh]">
          <div className="p-3 border-b bg-muted/50 sticky top-0">
            <h4 className="font-medium text-sm">Endpoints</h4>
          </div>
          <div className="p-2 space-y-1">
            {endpoints.map((ep) => (
              <button
                key={ep.id}
                onClick={() => handleSelectEndpoint(ep)}
                className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                  selectedEndpoint?.id === ep.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Badge className={`${getMethodColor(ep.httpMethod)} text-white text-xs px-1.5`}>
                    {ep.httpMethod}
                  </Badge>
                  <span className="truncate">{ep.name}</span>
                </div>
                <code className="text-xs opacity-70 truncate block mt-1">{ep.urlPath}</code>
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2 space-y-4 overflow-auto max-h-[60vh]">
          {selectedEndpoint ? (
            <>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Badge className={`${getMethodColor(selectedEndpoint.httpMethod)} text-white`}>
                  {selectedEndpoint.httpMethod}
                </Badge>
                <code className="flex-1 text-sm font-mono truncate">{selectedEndpoint.urlPath}</code>
                <Button 
                  size="sm" 
                  onClick={handleTest}
                  disabled={testMutation.isPending}
                  className="gap-2"
                  data-testid="button-sandbox-test"
                >
                  <Send className="h-4 w-4" />
                  {testMutation.isPending ? "Sending..." : "Send Request"}
                </Button>
              </div>

              <div className="border rounded-lg">
                <button 
                  onClick={() => toggleSection('request')}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50"
                >
                  <span className="font-medium text-sm">Request Configuration</span>
                  {expandedSections.request ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {expandedSections.request && (
                  <div className="p-3 border-t space-y-3">
                    <div>
                      <Label className="text-xs">Headers (JSON)</Label>
                      <textarea
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                        value={customHeaders}
                        onChange={(e) => setCustomHeaders(e.target.value)}
                        placeholder='{"Authorization": "Bearer token"}'
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Query Parameters (JSON)</Label>
                      <textarea
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                        value={customQueryParams}
                        onChange={(e) => setCustomQueryParams(e.target.value)}
                        placeholder='{"page": 1, "limit": 10}'
                      />
                    </div>
                    {['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.httpMethod) && (
                      <div>
                        <Label className="text-xs">Request Body (JSON)</Label>
                        <textarea
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                          value={customBody}
                          onChange={(e) => setCustomBody(e.target.value)}
                          placeholder='{"key": "value"}'
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border rounded-lg">
                <button 
                  onClick={() => toggleSection('response')}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">Response</span>
                    {testResult && (
                      <>
                        <Badge variant={testResult.success ? "default" : "destructive"} className={testResult.success ? "bg-green-500" : ""}>
                          {testResult.success ? "Success" : "Failed"}
                        </Badge>
                        {testResult.status && (
                          <Badge variant="outline">HTTP {testResult.status}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{testResult.responseTimeMs}ms</span>
                      </>
                    )}
                  </div>
                  {expandedSections.response ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {expandedSections.response && (
                  <div className="p-3 border-t">
                    {testResult ? (
                      <div className="space-y-3">
                        {testResult.error && (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{testResult.error}</AlertDescription>
                          </Alert>
                        )}
                        {testResult.headers && (
                          <div>
                            <Label className="text-xs">Response Headers</Label>
                            <pre className="p-2 bg-muted rounded text-xs font-mono overflow-auto max-h-24">
                              {JSON.stringify(testResult.headers, null, 2)}
                            </pre>
                          </div>
                        )}
                        {testResult.body !== undefined && (
                          <div>
                            <Label className="text-xs">Response Body</Label>
                            <pre className="p-2 bg-muted rounded text-xs font-mono overflow-auto max-h-64">
                              {typeof testResult.body === 'string' 
                                ? testResult.body 
                                : JSON.stringify(testResult.body, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Click "Send Request" to test this endpoint</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select an endpoint from the list to test it</p>
            </div>
          )}
        </div>
      </div>

      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}

function PullEndpointDialog({ 
  integrationId,
  endpoint,
  onClose 
}: { 
  integrationId: number;
  endpoint?: ErpPullEndpoint;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("basic");
  const [name, setName] = useState(endpoint?.name || "");
  const [endpointType, setEndpointType] = useState(endpoint?.endpointType || "ALL_STUDENTS");
  const [urlPath, setUrlPath] = useState(endpoint?.urlPath || "");
  const [httpMethod, setHttpMethod] = useState(endpoint?.httpMethod || "GET");
  const [description, setDescription] = useState(endpoint?.description || "");
  const [isActive, setIsActive] = useState(endpoint?.isActive ?? true);
  const [requestHeaders, setRequestHeaders] = useState(
    endpoint?.requestHeaders ? JSON.stringify(endpoint.requestHeaders, null, 2) : ""
  );
  const [requestBodyTemplate, setRequestBodyTemplate] = useState(
    endpoint?.requestBodyTemplate ? JSON.stringify(endpoint.requestBodyTemplate, null, 2) : ""
  );
  const [queryParameters, setQueryParameters] = useState(
    endpoint?.queryParameters ? JSON.stringify(endpoint.queryParameters, null, 2) : ""
  );
  const [responseRootPath, setResponseRootPath] = useState(endpoint?.responseRootPath || "");
  const [paginationConfig, setPaginationConfig] = useState(
    endpoint?.paginationConfig ? JSON.stringify(endpoint.paginationConfig, null, 2) : ""
  );

  const { data: testLogs = [] } = useQuery({
    queryKey: ["erp-test-logs", endpoint?.id],
    queryFn: () => endpoint ? erpIntegrationsApi.getTestLogs(endpoint.id, 5) : Promise.resolve([]),
    enabled: !!endpoint,
  });

  const parseJsonField = (value: string): Record<string, unknown> | null => {
    if (!value.trim()) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof erpIntegrationsApi.createPullEndpoint>[1]) =>
      erpIntegrationsApi.createPullEndpoint(integrationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-pull-endpoints", integrationId] });
      toast.success("Pull endpoint created");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof erpIntegrationsApi.updatePullEndpoint>[2]) =>
      erpIntegrationsApi.updatePullEndpoint(integrationId, endpoint!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-pull-endpoints", integrationId] });
      toast.success("Pull endpoint updated");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const testMutation = useMutation({
    mutationFn: erpIntegrationsApi.testPullEndpoint,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["erp-pull-endpoints", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["erp-test-logs", endpoint?.id] });
      if (result.success) {
        toast.success(`Test successful (${result.responseTimeMs}ms)`);
      } else {
        toast.error(`Test failed: ${result.error || 'Unknown error'}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !urlPath.trim()) {
      toast.error("Name and URL path are required");
      return;
    }

    const data = {
      name,
      endpointType,
      urlPath,
      httpMethod,
      description: description || null,
      isActive,
      requestHeaders: parseJsonField(requestHeaders),
      requestBodyTemplate: parseJsonField(requestBodyTemplate),
      queryParameters: parseJsonField(queryParameters),
      responseRootPath: responseRootPath || null,
      paginationConfig: parseJsonField(paginationConfig),
    };

    if (endpoint) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleTest = () => {
    if (endpoint) {
      testMutation.mutate(endpoint.id);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      case "ERROR":
        return <Badge variant="destructive">Error</Badge>;
      case "TIMEOUT":
        return <Badge variant="secondary">Timeout</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{endpoint ? "Edit" : "Add"} Pull Endpoint</DialogTitle>
        <DialogDescription>
          Configure an API endpoint to pull data from the ERP system.
        </DialogDescription>
      </DialogHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          {endpoint && <TabsTrigger value="logs">Test Logs</TabsTrigger>}
        </TabsList>

        <TabsContent value="basic" className="space-y-4 max-h-[50vh] overflow-y-auto">
          <div className="grid gap-2">
            <Label htmlFor="endpoint-name">Name *</Label>
            <Input
              id="endpoint-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Get All Students"
              data-testid="input-endpoint-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Endpoint Type *</Label>
              <Select value={endpointType} onValueChange={setEndpointType}>
                <SelectTrigger data-testid="select-endpoint-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_STUDENTS">All Students</SelectItem>
                  <SelectItem value="SINGLE_STUDENT">Single Student</SelectItem>
                  <SelectItem value="ALL_EMPLOYEES">All Employees</SelectItem>
                  <SelectItem value="SINGLE_EMPLOYEE">Single Employee</SelectItem>
                  <SelectItem value="PROGRAMS">Programs</SelectItem>
                  <SelectItem value="DEPARTMENTS">Departments</SelectItem>
                  <SelectItem value="COURSES">Courses</SelectItem>
                  <SelectItem value="STUDENT_PROGRAM_MAPPING">Student-Program Mapping</SelectItem>
                  <SelectItem value="EMPLOYEE_DEPARTMENT_MAPPING">Employee-Department Mapping</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>HTTP Method</Label>
              <Select value={httpMethod} onValueChange={setHttpMethod}>
                <SelectTrigger data-testid="select-http-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="url-path">URL Path *</Label>
            <Input
              id="url-path"
              value={urlPath}
              onChange={(e) => setUrlPath(e.target.value)}
              placeholder="/api/students"
              data-testid="input-url-path"
            />
            <p className="text-xs text-muted-foreground">
              Path relative to the ERP base URL
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="endpoint-description">Description</Label>
            <Input
              id="endpoint-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              data-testid="input-endpoint-description"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive endpoints won't be used for data sync
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 max-h-[50vh] overflow-y-auto">
          <div className="grid gap-2">
            <Label htmlFor="request-headers">Request Headers (JSON)</Label>
            <textarea
              id="request-headers"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={requestHeaders}
              onChange={(e) => setRequestHeaders(e.target.value)}
              placeholder='{"Authorization": "Bearer {{token}}"}'
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="query-params">Query Parameters (JSON)</Label>
            <textarea
              id="query-params"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={queryParameters}
              onChange={(e) => setQueryParameters(e.target.value)}
              placeholder='{"page": 1, "limit": 100}'
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="request-body">Request Body Template (JSON)</Label>
            <textarea
              id="request-body"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={requestBodyTemplate}
              onChange={(e) => setRequestBodyTemplate(e.target.value)}
              placeholder='{"filter": {"status": "active"}}'
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="response-root">Response Root Path</Label>
            <Input
              id="response-root"
              value={responseRootPath}
              onChange={(e) => setResponseRootPath(e.target.value)}
              placeholder="data.students"
            />
            <p className="text-xs text-muted-foreground">
              JSON path to the array of records in the response
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pagination-config">Pagination Config (JSON)</Label>
            <textarea
              id="pagination-config"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={paginationConfig}
              onChange={(e) => setPaginationConfig(e.target.value)}
              placeholder='{"type": "offset", "pageParam": "page", "limitParam": "limit"}'
            />
          </div>
        </TabsContent>

        {endpoint && (
          <TabsContent value="logs" className="space-y-4 max-h-[50vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Recent test results</p>
              <Button 
                type="button" 
                size="sm" 
                variant="outline"
                onClick={handleTest}
                disabled={testMutation.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                {testMutation.isPending ? "Testing..." : "Run Test"}
              </Button>
            </div>
            {testLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No test logs yet</p>
                <p className="text-sm">Run a test to see results here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {testLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(log.status)}
                        {log.responseStatus && (
                          <Badge variant="outline">HTTP {log.responseStatus}</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {log.responseTimeMs && <span>{log.responseTimeMs}ms</span>}
                        <span className="ml-2">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    {log.errorMessage && (
                      <p className="text-sm text-red-500">{log.errorMessage}</p>
                    )}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View Details
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div>
                          <p className="font-medium">Request:</p>
                          <code className="block p-2 bg-muted rounded text-xs overflow-auto max-h-24">
                            {log.requestMethod} {log.requestUrl}
                          </code>
                        </div>
                        {log.responseBody && (
                          <div>
                            <p className="font-medium">Response:</p>
                            <code className="block p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                              {JSON.stringify(log.responseBody, null, 2)}
                            </code>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <DialogFooter className="mt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-endpoint">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ErpIntegrationsTab() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<ErpIntegrationPublic | null>(null);

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["erp-integrations"],
    queryFn: erpIntegrationsApi.getAll,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      erpIntegrationsApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-integrations"] });
      toast.success("Integration status updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: erpIntegrationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp-integrations"] });
      toast.success("Integration deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this ERP integration? This action cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  };

  if (selectedIntegration) {
    return (
      <ErpIntegrationDetails 
        integration={selectedIntegration} 
        onBack={() => setSelectedIntegration(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                ERP Integrations
              </CardTitle>
              <CardDescription>
                Manage connections to external Education ERP systems for student data exchange.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <a href="/api-docs" target="_blank" rel="noopener noreferrer" data-testid="link-api-docs">
                <Button variant="outline" size="sm" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  API Docs
                </Button>
              </a>
              <a href="/settings/sso-testing" data-testid="link-sso-testing">
                <Button variant="outline" size="sm" className="gap-2">
                  <Shield className="h-4 w-4" />
                  SSO Testing
                </Button>
              </a>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2" data-testid="button-add-erp">
                  <Plus className="h-4 w-4" />
                  Add Integration
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <CreateErpIntegrationDialog onClose={() => setCreateDialogOpen(false)} />
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : integrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No ERP integrations configured</p>
              <p className="text-sm">Add an ERP integration to enable student data synchronization.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>App ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((integration) => (
                  <TableRow key={integration.id} data-testid={`row-erp-${integration.id}`}>
                    <TableCell className="font-mono text-sm font-medium text-muted-foreground">
                      #{integration.id}
                    </TableCell>
                    <TableCell className="font-medium">
                      <button 
                        className="hover:underline text-left"
                        onClick={() => setSelectedIntegration(integration)}
                      >
                        {integration.name}
                      </button>
                    </TableCell>
                    <TableCell>{integration.erpType}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{integration.connectionMode}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{integration.appId.slice(0, 16)}...</TableCell>
                    <TableCell>
                      <Switch 
                        checked={integration.isActive}
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ id: integration.id, isActive: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setSelectedIntegration(integration)}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(integration.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication Mode</CardTitle>
          <CardDescription>Configure how user authentication works with ERP systems.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="auth-mode">Authentication Mode</Label>
            <Select defaultValue="erp">
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local Database Only</SelectItem>
                <SelectItem value="erp">ERP / SSO Integration</SelectItem>
                <SelectItem value="hybrid">Hybrid (Local + ERP)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Determines how users are authenticated in the library system
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const AUDIT_CATEGORIES = [
  { key: "AUTHENTICATION", icon: Shield, label: "Authentication", description: "Login attempts, logouts, password changes" },
  { key: "USER_MANAGEMENT", icon: Users, label: "User Management", description: "User creation, updates, role changes" },
  { key: "CATALOG", icon: BookOpen, label: "Catalog", description: "Book additions, updates, deletions" },
  { key: "CIRCULATION", icon: Repeat, label: "Circulation", description: "Checkouts, returns, renewals" },
  { key: "FINES", icon: Coins, label: "Fines", description: "Fine creation, payment, waiver" },
  { key: "INVENTORY", icon: Layers, label: "Inventory", description: "Audit sessions, item scanning" },
  { key: "REPORTS", icon: PieChart, label: "Reports", description: "Report generation events" },
  { key: "ERP_INTEGRATION", icon: Link2, label: "ERP Integration", description: "ERP provisioning, sync events" },
  { key: "SYSTEM_CONFIG", icon: Settings2, label: "System Config", description: "Configuration changes" },
  { key: "STAFF_ALLOCATION", icon: Building2, label: "Staff Allocation", description: "Staff library allocations" },
  { key: "API_ACCESS", icon: Zap, label: "API Access Logging", description: "Log ALL API requests including failures (verbose)" },
];

function AuditLoggingConfig() {
  const queryClient = useQueryClient();

  const { data: auditConfig = [], isLoading } = useQuery<{ category: string; enabled: boolean }[]>({
    queryKey: ["/api/audit-config"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ category, enabled }: { category: string; enabled: boolean }) => {
      const res = await fetch(`/api/audit-config/${category}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/audit-config"] });
      toast.success("Audit configuration updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update audit configuration");
    },
  });

  const getEnabled = (category: string) => {
    const config = auditConfig.find((c) => c.category === category);
    return config?.enabled ?? true;
  };

  return (
    <Card data-testid="card-audit-logging-config">
      <CardHeader>
        <CardTitle>Audit Logging Configuration</CardTitle>
        <CardDescription>
          Control which activities are logged. Turn off categories you don't need, or enable API Access logging for integration testing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          AUDIT_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isApiAccess = cat.key === "API_ACCESS";
            const enabled = getEnabled(cat.key);
            return (
              <div
                key={cat.key}
                className={`flex items-center justify-between p-3 rounded-lg ${isApiAccess ? "border-2 border-orange-300 bg-orange-50/50" : "hover:bg-muted/50"}`}
                data-testid={`row-audit-category-${cat.key}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${isApiAccess ? "text-orange-500" : "text-muted-foreground"}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{cat.label}</span>
                      {isApiAccess && (
                        <Badge variant="outline" className="border-orange-300 text-orange-700 text-xs" data-testid="badge-api-access-warning">
                          Verbose - recommended only during integration testing
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => toggleMutation.mutate({ category: cat.key, enabled: checked })}
                  data-testid={`switch-audit-${cat.key}`}
                />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

const EMAIL_PROVIDERS = [
  { value: "gmail", label: "Gmail", host: "smtp.gmail.com", port: "587", secure: "false" },
  { value: "gws", label: "Google Workspace (GWS)", host: "smtp.gmail.com", port: "587", secure: "false" },
  { value: "outlook", label: "Outlook / Hotmail", host: "smtp-mail.outlook.com", port: "587", secure: "false" },
  { value: "o365", label: "Microsoft 365 (O365)", host: "smtp.office365.com", port: "587", secure: "false" },
  { value: "yahoo", label: "Yahoo Mail", host: "smtp.mail.yahoo.com", port: "465", secure: "true" },
  { value: "zoho", label: "Zoho Mail", host: "smtp.zoho.com", port: "465", secure: "true" },
  { value: "sendgrid", label: "SendGrid", host: "smtp.sendgrid.net", port: "587", secure: "false" },
  { value: "ses", label: "Amazon SES", host: "email-smtp.us-east-1.amazonaws.com", port: "587", secure: "false" },
  { value: "custom", label: "Custom / Other SMTP", host: "", port: "587", secure: "true" },
];

function EmailProviderSettings() {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState("false");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  const { data: emailConfig, isLoading } = useQuery({
    queryKey: ["/api/email-config"],
    queryFn: async () => {
      const res = await fetch("/api/email-config");
      if (!res.ok) throw new Error("Failed to fetch email config");
      return res.json();
    },
  });

  useEffect(() => {
    if (emailConfig) {
      setProvider(emailConfig.provider || "");
      setSmtpHost(emailConfig.smtpHost || "");
      setSmtpPort(emailConfig.smtpPort || "587");
      setSmtpSecure(emailConfig.smtpSecure || "true");
      setSmtpUser(emailConfig.smtpUser || "");
      setSmtpPass(emailConfig.smtpPass || "");
      setSmtpFrom(emailConfig.smtpFrom || "");
      setIsConfigured(emailConfig.configured || false);
      if (emailConfig.provider === "custom") {
        setShowAdvanced(true);
      }
    }
  }, [emailConfig]);

  const handleProviderChange = (value: string) => {
    setProvider(value);
    const preset = EMAIL_PROVIDERS.find(p => p.value === value);
    if (preset && value !== "custom") {
      setSmtpHost(preset.host);
      setSmtpPort(preset.port);
      setSmtpSecure(preset.secure);
      setShowAdvanced(false);
    } else {
      setSmtpHost("");
      setSmtpPort("587");
      setSmtpSecure("true");
      setShowAdvanced(true);
    }
  };

  const handleSave = async () => {
    if (!provider || !smtpHost || !smtpUser || !smtpPass) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/email-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          smtpHost,
          smtpPort,
          smtpSecure,
          smtpUser,
          smtpPass: smtpPass === "••••••••" ? undefined : smtpPass,
          smtpFrom: smtpFrom || smtpUser,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      toast.success("Email configuration saved successfully");
      setIsConfigured(true);
      queryClient.invalidateQueries({ queryKey: ["/api/email-config"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save email configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast.error("Please enter a test email address");
      return;
    }
    setIsTesting(true);
    try {
      const res = await fetch("/api/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test failed");
      toast.success(data.message);
      setShowTestDialog(false);
      setTestEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test email");
    } finally {
      setIsTesting(false);
    }
  };

  const selectedProvider = EMAIL_PROVIDERS.find(p => p.value === provider);
  const providerHint = provider === "gmail" || provider === "gws"
    ? "Use an App Password (not your regular password). Enable 2FA first, then create an App Password at myaccount.google.com > Security > App Passwords."
    : provider === "outlook" || provider === "o365"
    ? "Use an App Password if you have 2FA enabled. Otherwise, you may need to enable SMTP AUTH in your admin settings."
    : provider === "yahoo"
    ? "Generate an App Password at login.yahoo.com > Account Security > App Passwords."
    : null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Provider
              </CardTitle>
              <CardDescription>Configure your SMTP email provider for sending notifications and alerts.</CardDescription>
            </div>
            {isConfigured && (
              <Badge variant="outline" className="gap-1 text-green-700 border-green-300 bg-green-50">
                <CheckCircle2 className="h-3 w-3" />
                Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email-provider">Email Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger id="email-provider" data-testid="select-email-provider">
                <SelectValue placeholder="Select an email provider" />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_PROVIDERS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {provider && (
            <>
              {providerHint && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Important</AlertTitle>
                  <AlertDescription className="text-xs">{providerHint}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp-user">Email Address / Username</Label>
                  <Input
                    id="smtp-user"
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="your-email@example.com"
                    data-testid="input-smtp-user"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-pass">App Password</Label>
                  <div className="relative">
                    <Input
                      id="smtp-pass"
                      type={showPassword ? "text" : "password"}
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="Enter app password"
                      className="pr-10"
                      data-testid="input-smtp-pass"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-from">From Address (optional)</Label>
                <Input
                  id="smtp-from"
                  type="email"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  placeholder={smtpUser || "library@yourdomain.com"}
                  data-testid="input-smtp-from"
                />
                <p className="text-xs text-muted-foreground">
                  The "From" address for outgoing emails. Defaults to the email address above if left empty.
                </p>
              </div>

              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs px-0"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  data-testid="button-toggle-smtp-advanced"
                >
                  {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showAdvanced ? "Hide" : "Show"} SMTP Settings
                </Button>

                {showAdvanced && (
                  <div className="grid gap-4 md:grid-cols-3 mt-3 p-4 bg-muted/50 rounded-lg border">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-host">SMTP Host</Label>
                      <Input
                        id="smtp-host"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.example.com"
                        data-testid="input-smtp-host"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-port">SMTP Port</Label>
                      <Input
                        id="smtp-port"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        placeholder="587"
                        data-testid="input-smtp-port"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-secure">Connection Security</Label>
                      <Select value={smtpSecure} onValueChange={setSmtpSecure}>
                        <SelectTrigger id="smtp-secure" data-testid="select-smtp-secure">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">STARTTLS (Port 587)</SelectItem>
                          <SelectItem value="true">SSL/TLS (Port 465)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !provider || !smtpHost || !smtpUser || !smtpPass}
                    data-testid="button-save-email-config"
                  >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Configuration
                  </Button>
                  {isConfigured && (
                    <Button
                      variant="outline"
                      onClick={() => setShowTestDialog(true)}
                      data-testid="button-test-email"
                      className="gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Send Test Email
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test email to verify your email configuration is working correctly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Recipient Email</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email address to send test to"
                data-testid="input-test-email"
              />
            </div>
            {selectedProvider && (
              <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg space-y-1">
                <p><strong>Provider:</strong> {selectedProvider.label}</p>
                <p><strong>SMTP:</strong> {smtpHost}:{smtpPort}</p>
                <p><strong>From:</strong> {smtpFrom || smtpUser}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTest}
              disabled={isTesting || !testEmail}
              data-testid="button-send-test-email"
              className="gap-2"
            >
              {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isTesting ? "Sending..." : "Send Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const DIGITAL_RESOURCE_TYPES = ["PDF", "DOC", "DOCX", "PPT", "PPTX", "XLS", "XLSX", "ZIP", "IMAGE", "VIDEO", "AUDIO", "HTML", "SCORM", "EXTERNAL_URL", "YOUTUBE", "GOOGLE_DRIVE", "ONEDRIVE"];

function ResourceTypeSettings() {
  const queryClient = useQueryClient();
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["resource-type-settings"],
    queryFn: resourceTypeSettingsApi.getAll,
  });

  const [drafts, setDrafts] = useState<Record<string, { color: string; maxSizeMb: number }>>({});

  const getSetting = (type: string): ResourceTypeSettingApi | undefined =>
    settings.find(s => s.resourceType === type);

  const getDraft = (type: string) => {
    if (drafts[type]) return drafts[type];
    const s = getSetting(type);
    return { color: s?.color ?? "#3b82f6", maxSizeMb: s?.maxSizeMb ?? 200 };
  };

  const updateMut = useMutation({
    mutationFn: ({ type, data }: { type: string; data: { color?: string; maxSizeMb?: number } }) =>
      resourceTypeSettingsApi.update(type, data),
    onSuccess: (_res, vars) => {
      toast.success(`${vars.type} settings saved`);
      queryClient.invalidateQueries({ queryKey: ["resource-type-settings"] });
      setDrafts(prev => { const next = { ...prev }; delete next[vars.type]; return next; });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ type, isActive }: { type: string; isActive: boolean }) =>
      resourceTypeSettingsApi.update(type, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resource-type-settings"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" />Digital Resource Types</CardTitle>
        <CardDescription>Configure the color badge and maximum upload size for each digital resource type.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="rounded-md border divide-y">
            {DIGITAL_RESOURCE_TYPES.map((type) => {
              const setting = getSetting(type);
              const draft = getDraft(type);
              const dirty = drafts[type] !== undefined && (drafts[type].color !== (setting?.color ?? "#3b82f6") || drafts[type].maxSizeMb !== (setting?.maxSizeMb ?? 200));
              return (
                <div key={type} className="flex items-center justify-between gap-4 p-3 flex-wrap" data-testid={`row-resource-type-${type}`}>
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <span className="h-4 w-4 rounded-full border shrink-0" style={{ backgroundColor: draft.color }} />
                    <span className="font-medium text-sm">{type.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Color</Label>
                    <input
                      type="color"
                      value={draft.color}
                      onChange={(e) => setDrafts(prev => ({ ...prev, [type]: { ...draft, color: e.target.value } }))}
                      className="h-8 w-10 rounded border cursor-pointer"
                      data-testid={`input-color-${type}`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Max size (MB)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5000}
                      value={draft.maxSizeMb}
                      onChange={(e) => setDrafts(prev => ({ ...prev, [type]: { ...draft, maxSizeMb: Number(e.target.value) || 1 } }))}
                      className="w-24 h-8"
                      data-testid={`input-max-size-${type}`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={setting?.isActive ?? true}
                      onCheckedChange={(v) => toggleMut.mutate({ type, isActive: v })}
                      data-testid={`switch-active-${type}`}
                    />
                    <span className="text-xs text-muted-foreground w-14">{(setting?.isActive ?? true) ? "Active" : "Inactive"}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!dirty || updateMut.isPending}
                    onClick={() => updateMut.mutate({ type, data: { color: draft.color, maxSizeMb: draft.maxSizeMb } })}
                    data-testid={`button-save-type-${type}`}
                  >
                    Save
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentMethodsSettings() {
  const queryClient = useQueryClient();
  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => paymentMethodsApi.getAll(false),
  });
  const [editing, setEditing] = useState<PaymentMethodApi | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "", isActive: true });

  const reset = () => setForm({ name: "", code: "", description: "", isActive: true });

  const createMut = useMutation({
    mutationFn: () => paymentMethodsApi.create(form),
    onSuccess: () => {
      toast.success("Payment method added");
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      setShowAdd(false); reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => paymentMethodsApi.update(editing!.id, form),
    onSuccess: () => {
      toast.success("Payment method updated");
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      setEditing(null); reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => paymentMethodsApi.delete(id),
    onSuccess: () => {
      toast.success("Payment method removed");
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => paymentMethodsApi.update(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment-methods"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (m: PaymentMethodApi) => {
    setEditing(m);
    setForm({ name: m.name, code: m.code, description: m.description ?? "", isActive: m.isActive });
  };

  const isOpen = showAdd || editing !== null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5" />Payment Methods</CardTitle>
          <CardDescription>Configure how fines and damage charges can be collected.</CardDescription>
        </div>
        <Button size="sm" onClick={() => { reset(); setShowAdd(true); }} data-testid="button-add-payment-method">
          Add method
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="rounded-md border divide-y">
            {methods.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No payment methods yet.</div>}
            {methods.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3" data-testid={`row-payment-method-${m.id}`}>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-xs">{m.code}</Badge>
                  <div>
                    <div className="font-medium text-sm">{m.name}</div>
                    {m.description && <div className="text-xs text-muted-foreground">{m.description}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={m.isActive} onCheckedChange={(v) => toggleMut.mutate({ id: m.id, isActive: v })} data-testid={`switch-active-${m.id}`} />
                    <span className="text-xs text-muted-foreground w-14">{m.isActive ? "Active" : "Inactive"}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(m)} data-testid={`button-edit-method-${m.id}`}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700"
                    onClick={() => { if (confirm(`Remove ${m.name}?`)) deleteMut.mutate(m.id); }}
                    data-testid={`button-delete-method-${m.id}`}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditing(null); reset(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit payment method" : "New payment method"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. UPI" data-testid="input-method-name" />
            </div>
            <div>
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. UPI" data-testid="input-method-code" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-method-description" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} data-testid="switch-method-active" />
              <Label className="text-sm">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditing(null); reset(); }}>Cancel</Button>
            <Button
              onClick={() => editing ? updateMut.mutate() : createMut.mutate()}
              disabled={!form.name || !form.code || createMut.isPending || updateMut.isPending}
              data-testid="button-save-method"
            >
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const searchString = useSearch();
  const initialSection = new URLSearchParams(searchString).get("section") === "catalog"
    ? "catalog"
    : "general";
  
  // Resource Types state
  const [editingType, setEditingType] = useState<ResourceType | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Categories state
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  const { data: resourceTypes = [], isLoading } = useQuery({
    queryKey: ["resource-types"],
    queryFn: resourceTypesApi.getAll,
  });

  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.getAll,
  });

  // Currency settings
  const { data: systemConfigs = [] } = useQuery({
    queryKey: ["system-config"],
    queryFn: configApi.getAll,
  });

  const currencyConfig = systemConfigs.find(c => c.key === "currency");
  const selectedCurrency = currencyConfig?.value || "USD";

  const currencyMutation = useMutation({
    mutationFn: (currencyCode: string) => configApi.set({
      key: "currency",
      value: currencyCode,
      category: "general",
      description: "Default currency for the library system",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-config"] });
      toast.success("Currency updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCurrencyChange = (currencyCode: string) => {
    currencyMutation.mutate(currencyCode);
  };

  const erpCatalogLimitConfig = systemConfigs.find(c => c.key === "erp_catalog_limit");
  const [catalogLimitValue, setCatalogLimitValue] = useState("");

  useEffect(() => {
    if (erpCatalogLimitConfig) {
      setCatalogLimitValue(erpCatalogLimitConfig.value);
    }
  }, [erpCatalogLimitConfig?.value]);

  const catalogLimitMutation = useMutation({
    mutationFn: (limit: string) => configApi.set({
      key: "erp_catalog_limit",
      value: limit,
      category: "catalog",
      description: "Maximum number of books returned in ERP catalog search before requiring refinement",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-config"] });
      toast.success("ERP catalog limit updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCatalogLimitSave = () => {
    const num = parseInt(catalogLimitValue, 10);
    if (isNaN(num) || num < 1) {
      toast.error("Please enter a valid number greater than 0");
      return;
    }
    catalogLimitMutation.mutate(String(num));
  };

  const deleteMutation = useMutation({
    mutationFn: resourceTypesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-types"] });
      queryClient.invalidateQueries({ queryKey: ["resource-types", "active"] });
      toast.success("Resource type deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: categoriesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories", "active"] });
      toast.success("Category deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleEdit = (type: ResourceType) => {
    setEditingType(type);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingType(undefined);
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this resource type?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingType(undefined);
  };

  // Category handlers
  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryDialogOpen(true);
  };

  const handleAddCategory = () => {
    setEditingCategory(undefined);
    setCategoryDialogOpen(true);
  };

  const handleDeleteCategory = (id: number) => {
    if (confirm("Are you sure you want to delete this category?")) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const handleCategoryDialogClose = () => {
    setCategoryDialogOpen(false);
    setEditingCategory(undefined);
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-settings-title">
          System Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure library rules, integrations, and preferences.</p>
      </div>

      <Tabs defaultValue={initialSection} className="w-full">
        <div className="grid md:grid-cols-[250px_1fr] gap-6">
          <div className="flex flex-col">
            <TabsList className="flex flex-col h-auto items-stretch bg-transparent p-0 space-y-1">
              <TabsTrigger 
                value="general" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Building2 className="mr-2 h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger 
                value="catalog" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Catalog Settings
              </TabsTrigger>
              <TabsTrigger 
                value="circulation" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Globe className="mr-2 h-4 w-4" />
                Circulation Rules
              </TabsTrigger>
              <TabsTrigger 
                value="integration" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Database className="mr-2 h-4 w-4" />
                Integrations (ERP)
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Mail className="mr-2 h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Lock className="mr-2 h-4 w-4" />
                Security & Access
              </TabsTrigger>
              <TabsTrigger
                value="payment-methods"
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
                data-testid="tab-payment-methods"
              >
                <Coins className="h-4 w-4 mr-2" />
                Payment Methods
              </TabsTrigger>
              <TabsTrigger
                value="digital-resources"
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
                data-testid="tab-digital-resources"
              >
                <Layers className="h-4 w-4 mr-2" />
                Digital Resources
              </TabsTrigger>
              <TabsTrigger 
                value="audit" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Shield className="h-4 w-4 mr-2" />
                Audit Logging
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1">
            <TabsContent value="general" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Library Information</CardTitle>
                  <CardDescription>Basic details about your library instance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="lib-name">Library Name</Label>
                    <Input id="lib-name" defaultValue="Central University Library" data-testid="input-lib-name" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lib-code">Branch Code</Label>
                    <Input id="lib-code" defaultValue="MAIN-01" data-testid="input-lib-code" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select defaultValue="utc-5">
                      <SelectTrigger data-testid="select-timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utc">UTC</SelectItem>
                        <SelectItem value="utc-5">Eastern Time (US & Canada)</SelectItem>
                        <SelectItem value="utc-8">Pacific Time (US & Canada)</SelectItem>
                        <SelectItem value="gmt">London (GMT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5" />
                    Currency Settings
                  </CardTitle>
                  <CardDescription>Configure the currency used for fines, fees, and financial displays.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Default Currency</Label>
                    <Select 
                      value={selectedCurrency} 
                      onValueChange={handleCurrencyChange}
                    >
                      <SelectTrigger data-testid="select-currency">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] overflow-y-auto">
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            <span className="flex items-center gap-2">
                              <span className="font-mono w-8">{currency.symbol}</span>
                              <span>{currency.name}</span>
                              <span className="text-muted-foreground">({currency.code})</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      This currency will be used throughout the system for displaying fines, fees, and acquisition costs.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="catalog" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Resource Types</CardTitle>
                      <CardDescription>
                        Define the types of materials in your library (e.g., Hard Bound Book, eBook, Journal).
                      </CardDescription>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-2" onClick={handleAdd} data-testid="button-add-type">
                          <Plus className="h-4 w-4" />
                          Add Type
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <ResourceTypeDialog 
                          resourceType={editingType} 
                          onClose={handleDialogClose} 
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : resourceTypes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No resource types configured yet.</p>
                      <p className="text-sm">Add resource types to categorize your library materials.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resourceTypes.map((type) => (
                          <TableRow key={type.id} data-testid={`row-type-${type.id}`}>
                            <TableCell className="font-medium">{type.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {type.description || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={type.isActive ? "default" : "secondary"}
                                className={type.isActive ? "bg-green-100 text-green-800" : ""}
                              >
                                {type.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEdit(type)}
                                data-testid={`button-edit-${type.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDelete(type.id)}
                                data-testid={`button-delete-${type.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Categories</CardTitle>
                      <CardDescription>
                        Organize resources by subject or genre (e.g., Fiction, Science, History).
                      </CardDescription>
                    </div>
                    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-2" onClick={handleAddCategory} data-testid="button-add-category">
                          <Plus className="h-4 w-4" />
                          Add Category
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <CategoryDialog 
                          category={editingCategory} 
                          onClose={handleCategoryDialogClose} 
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {isCategoriesLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : categories.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No categories configured yet.</p>
                      <p className="text-sm">Add categories to organize your library resources.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((cat) => (
                          <TableRow key={cat.id} data-testid={`row-category-${cat.id}`}>
                            <TableCell className="font-medium">{cat.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {cat.description || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={cat.isActive ? "default" : "secondary"}
                                className={cat.isActive ? "bg-green-100 text-green-800" : ""}
                              >
                                {cat.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEditCategory(cat)}
                                data-testid={`button-edit-category-${cat.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDeleteCategory(cat.id)}
                                data-testid={`button-delete-category-${cat.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ERP Catalog Search Limit</CardTitle>
                  <CardDescription>
                    Set the maximum number of books returned when students search the catalog via ERP integration. 
                    If a search returns more results than this limit, the student will be asked to refine their search with more specific filters.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-4">
                    <div className="grid gap-2 flex-1 max-w-xs">
                      <Label htmlFor="erp-catalog-limit">Maximum Results</Label>
                      <Input
                        id="erp-catalog-limit"
                        type="number"
                        min="1"
                        value={catalogLimitValue}
                        onChange={(e) => setCatalogLimitValue(e.target.value)}
                        placeholder="50"
                        data-testid="input-erp-catalog-limit"
                      />
                    </div>
                    <Button
                      onClick={handleCatalogLimitSave}
                      disabled={catalogLimitMutation.isPending}
                      data-testid="button-save-catalog-limit"
                    >
                      {catalogLimitMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Current limit: {erpCatalogLimitConfig?.value || "50"} books. Students searching via ERP will need to use search attributes to narrow results below this threshold.
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-z3950-search">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">Z39.50 Search</CardTitle>
                  <CardDescription>
                    Search remote library catalogs and import bibliographic records into your collection.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Z3950Search />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="circulation" className="mt-0 space-y-6">
              <CirculationRulesForm />
            </TabsContent>

            <TabsContent value="integration" className="mt-0">
              <ErpIntegrationsTab />
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 space-y-6">
              <EmailProviderSettings />
              <Card>
                <CardHeader>
                  <CardTitle>Email Notifications</CardTitle>
                  <CardDescription>Configure automated email alerts. These require a working email provider configured above.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Due Date Reminders</Label>
                      <p className="text-xs text-muted-foreground">Send reminders before items are due</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Overdue Notices</Label>
                      <p className="text-xs text-muted-foreground">Notify patrons of overdue items</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Hold Notifications</Label>
                      <p className="text-xs text-muted-foreground">Alert when held items become available</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Access Control</CardTitle>
                  <CardDescription>Manage security settings and permissions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-xs text-muted-foreground">Require 2FA for admin accounts</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Session Timeout</Label>
                      <p className="text-xs text-muted-foreground">Auto logout after inactivity</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="timeout">Timeout Duration (minutes)</Label>
                    <Input id="timeout" type="number" defaultValue="30" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="digital-resources" className="mt-0 space-y-6">
              <ResourceTypeSettings />
            </TabsContent>

            <TabsContent value="payment-methods" className="mt-0 space-y-6">
              <PaymentMethodsSettings />
            </TabsContent>

            <TabsContent value="audit" className="mt-0 space-y-6">
              <AuditLoggingConfig />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </MainLayout>
  );
}
