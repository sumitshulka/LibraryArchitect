import { useState } from "react";
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
  ArrowDownToLine, Play, Clock, Settings2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { resourceTypesApi, categoriesApi, erpIntegrationsApi, configApi, type ErpIntegrationPublic, type ErpCredentials, type ErpPullEndpoint } from "@/lib/api";
import { toast } from "sonner";
import type { ResourceType, Category, ErpWhitelist } from "@shared/schema";
import { useLocation } from "wouter";
import { CURRENCIES, getCurrencyByCode } from "@/lib/currency";
import { useCurrency } from "@/lib/useCurrency";

function FinePerDayField() {
  const { currency } = useCurrency();
  return (
    <div className="grid gap-2">
      <Label htmlFor="fine-amount">Fine per Day ({currency.symbol})</Label>
      <Input id="fine-amount" type="number" defaultValue="0.50" />
    </div>
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

      <PullEndpointsCard integrationId={integration.id} />
    </div>
  );
}

function PullEndpointsCard({ integrationId }: { integrationId: number }) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [endpointDialogOpen, setEndpointDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<ErpPullEndpoint | undefined>();

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
  const [name, setName] = useState(endpoint?.name || "");
  const [endpointType, setEndpointType] = useState(endpoint?.endpointType || "ALL_STUDENTS");
  const [urlPath, setUrlPath] = useState(endpoint?.urlPath || "");
  const [httpMethod, setHttpMethod] = useState(endpoint?.httpMethod || "GET");
  const [description, setDescription] = useState(endpoint?.description || "");
  const [isActive, setIsActive] = useState(endpoint?.isActive ?? true);

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
    };

    if (endpoint) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{endpoint ? "Edit" : "Add"} Pull Endpoint</DialogTitle>
        <DialogDescription>
          Configure an API endpoint to pull data from the ERP system.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
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
                <SelectItem value="LIBRARY_EMPLOYEES">Library Employees</SelectItem>
                <SelectItem value="PROGRAMS">Programs</SelectItem>
                <SelectItem value="PROGRAM_DEPARTMENTS">Program Departments</SelectItem>
                <SelectItem value="COURSES">Courses</SelectItem>
                <SelectItem value="PROGRAM_COURSES">Program Courses</SelectItem>
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
                <SelectItem value="DELETE">DELETE</SelectItem>
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
      </div>
      <DialogFooter>
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

export default function SettingsPage() {
  const queryClient = useQueryClient();
  
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

      <Tabs defaultValue="general" className="w-full">
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
            </TabsContent>

            <TabsContent value="circulation" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Loan Policies</CardTitle>
                  <CardDescription>Set default borrowing durations and limits.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="student-days">Student Loan Period (Days)</Label>
                      <Input id="student-days" type="number" defaultValue="14" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="staff-days">Staff Loan Period (Days)</Label>
                      <Input id="staff-days" type="number" defaultValue="30" />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow Renewals</Label>
                      <p className="text-xs text-muted-foreground">Patrons can renew items online</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Late Fines</Label>
                      <p className="text-xs text-muted-foreground">Automatically calculate fines for overdue items</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <FinePerDayField />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integration" className="mt-0">
              <ErpIntegrationsTab />
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Notifications</CardTitle>
                  <CardDescription>Configure automated email alerts.</CardDescription>
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
          </div>
        </div>
      </Tabs>
    </MainLayout>
  );
}
