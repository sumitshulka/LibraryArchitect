import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Save, Building2, Lock, Globe, Mail, Database, BookOpen, Plus, Pencil, Trash2, 
  Key, RefreshCw, Shield, Copy, Eye, EyeOff, AlertTriangle, CheckCircle2, Link2,
  ChevronRight, ChevronDown, Building, School, GraduationCap, Library, Users
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { resourceTypesApi, erpIntegrationsApi, orgUnitsApi, librariesApi, type ErpIntegrationPublic, type ErpCredentials } from "@/lib/api";
import { toast } from "sonner";
import type { ResourceType, ErpWhitelist, OrgUnit, Library as LibraryType } from "@shared/schema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
    </div>
  );
}

const ORG_TYPE_ICONS: Record<string, typeof Building> = {
  UNIVERSITY: Building,
  CAMPUS: Building2,
  COLLEGE: School,
  DEPARTMENT: GraduationCap,
};

const ORG_TYPE_LABELS: Record<string, string> = {
  UNIVERSITY: "University",
  CAMPUS: "Campus",
  COLLEGE: "College/School",
  DEPARTMENT: "Department",
};

function OrgUnitDialog({ 
  orgUnit, 
  parentId,
  onClose 
}: { 
  orgUnit?: OrgUnit;
  parentId?: number | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(orgUnit?.code || "");
  const [name, setName] = useState(orgUnit?.name || "");
  const [type, setType] = useState<string>(orgUnit?.type || "UNIVERSITY");
  const [description, setDescription] = useState(orgUnit?.description || "");
  const [isActive, setIsActive] = useState(orgUnit?.isActive ?? true);

  const createMutation = useMutation({
    mutationFn: (data: any) => orgUnitsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-units"] });
      toast.success("Organizational unit created");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => orgUnitsApi.update(orgUnit!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-units"] });
      toast.success("Organizational unit updated");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error("Code and Name are required");
      return;
    }

    const data = { 
      code, 
      name, 
      type, 
      description: description || null, 
      parentId: parentId ?? orgUnit?.parentId ?? null,
      isActive,
      sortOrder: 0
    };
    
    if (orgUnit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{orgUnit ? "Edit" : "Add"} Organizational Unit</DialogTitle>
        <DialogDescription>
          Organizational units form the hierarchy structure (University → Campus → College → Department).
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="org-code">Code *</Label>
          <Input
            id="org-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g., UNIV-001"
            data-testid="input-org-code"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="org-name">Name *</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Central University"
            data-testid="input-org-name"
          />
        </div>
        <div className="grid gap-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger data-testid="select-org-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNIVERSITY">University</SelectItem>
              <SelectItem value="CAMPUS">Campus</SelectItem>
              <SelectItem value="COLLEGE">College/School</SelectItem>
              <SelectItem value="DEPARTMENT">Department</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="org-description">Description</Label>
          <Input
            id="org-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            data-testid="input-org-description"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Active</Label>
            <p className="text-xs text-muted-foreground">
              Inactive units are hidden from selection
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-org-active" />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-org">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function LibraryDialog({ 
  library, 
  orgUnits,
  onClose 
}: { 
  library?: LibraryType;
  orgUnits: OrgUnit[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(library?.code || "");
  const [name, setName] = useState(library?.name || "");
  const [orgUnitId, setOrgUnitId] = useState<number | undefined>(library?.orgUnitId ?? undefined);
  const [address, setAddress] = useState(library?.address || "");
  const [contactEmail, setContactEmail] = useState(library?.contactEmail || "");
  const [contactPhone, setContactPhone] = useState(library?.contactPhone || "");
  const [isActive, setIsActive] = useState(library?.isActive ?? true);

  const createMutation = useMutation({
    mutationFn: (data: any) => librariesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
      toast.success("Library created");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => librariesApi.update(library!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
      toast.success("Library updated");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !orgUnitId) {
      toast.error("Code, Name, and Organizational Unit are required");
      return;
    }

    const data = { 
      code, 
      name, 
      orgUnitId,
      address: address || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      isActive,
    };
    
    if (library) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{library ? "Edit" : "Add"} Library</DialogTitle>
        <DialogDescription>
          Libraries belong to organizational units and can have their own book collections and policies.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="grid gap-2">
          <Label htmlFor="lib-code">Code *</Label>
          <Input
            id="lib-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g., LIB-MAIN"
            data-testid="input-lib-code"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lib-name">Name *</Label>
          <Input
            id="lib-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Main University Library"
            data-testid="input-lib-name"
          />
        </div>
        <div className="grid gap-2">
          <Label>Organizational Unit *</Label>
          <Select value={orgUnitId?.toString()} onValueChange={(v) => setOrgUnitId(parseInt(v))}>
            <SelectTrigger data-testid="select-lib-org">
              <SelectValue placeholder="Select organizational unit" />
            </SelectTrigger>
            <SelectContent>
              {orgUnits.map((unit) => (
                <SelectItem key={unit.id} value={unit.id.toString()}>
                  {unit.name} ({ORG_TYPE_LABELS[unit.type]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lib-address">Address</Label>
          <Input
            id="lib-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Physical location"
            data-testid="input-lib-address"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="lib-email">Contact Email</Label>
            <Input
              id="lib-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="library@example.edu"
              data-testid="input-lib-email"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lib-phone">Contact Phone</Label>
            <Input
              id="lib-phone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              data-testid="input-lib-phone"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Active</Label>
            <p className="text-xs text-muted-foreground">
              Inactive libraries are hidden from users
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-lib-active" />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-lib">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function OrgTreeNode({ 
  unit, 
  allUnits, 
  libraries,
  onEditUnit,
  onDeleteUnit,
  onAddChild,
  onEditLibrary,
  onDeleteLibrary,
  onAddLibrary,
  level = 0 
}: { 
  unit: OrgUnit;
  allUnits: OrgUnit[];
  libraries: LibraryType[];
  onEditUnit: (unit: OrgUnit) => void;
  onDeleteUnit: (id: number) => void;
  onAddChild: (parentId: number) => void;
  onEditLibrary: (lib: LibraryType) => void;
  onDeleteLibrary: (id: number) => void;
  onAddLibrary: (orgUnitId: number) => void;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(level < 2);
  
  const children = allUnits.filter(u => u.parentId === unit.id);
  const unitLibraries = libraries.filter(l => l.orgUnitId === unit.id);
  const hasChildren = children.length > 0 || unitLibraries.length > 0;
  
  const Icon = ORG_TYPE_ICONS[unit.type] || Building;

  return (
    <div className="border-l-2 border-muted pl-4 ml-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 py-2 group">
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-6" />
          )}
          
          <Icon className="h-4 w-4 text-muted-foreground" />
          
          <div className="flex-1">
            <span className="font-medium">{unit.name}</span>
            <span className="text-xs text-muted-foreground ml-2">({unit.code})</span>
            {!unit.isActive && (
              <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>
            )}
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => onAddChild(unit.id)}
              title="Add child unit"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => onAddLibrary(unit.id)}
              title="Add library"
            >
              <Library className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => onEditUnit(unit)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => onDeleteUnit(unit.id)}
            >
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          </div>
        </div>
        
        <CollapsibleContent>
          {unitLibraries.map(lib => (
            <div 
              key={lib.id} 
              className="flex items-center gap-2 py-2 pl-6 group border-l-2 border-blue-200 ml-2 bg-blue-50/30"
            >
              <Library className="h-4 w-4 text-blue-500" />
              <div className="flex-1">
                <span className="text-sm">{lib.name}</span>
                <span className="text-xs text-muted-foreground ml-2">({lib.code})</span>
                {!lib.isActive && (
                  <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>
                )}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => onEditLibrary(lib)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => onDeleteLibrary(lib.id)}
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          
          {children.map(child => (
            <OrgTreeNode
              key={child.id}
              unit={child}
              allUnits={allUnits}
              libraries={libraries}
              onEditUnit={onEditUnit}
              onDeleteUnit={onDeleteUnit}
              onAddChild={onAddChild}
              onEditLibrary={onEditLibrary}
              onDeleteLibrary={onDeleteLibrary}
              onAddLibrary={onAddLibrary}
              level={level + 1}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function OrganizationTab() {
  const queryClient = useQueryClient();
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [libDialogOpen, setLibDialogOpen] = useState(false);
  const [editingOrgUnit, setEditingOrgUnit] = useState<OrgUnit | undefined>();
  const [editingLibrary, setEditingLibrary] = useState<LibraryType | undefined>();
  const [parentIdForNew, setParentIdForNew] = useState<number | null>(null);
  const [orgUnitIdForLib, setOrgUnitIdForLib] = useState<number | undefined>();

  const { data: orgUnits = [], isLoading: loadingUnits } = useQuery({
    queryKey: ["org-units"],
    queryFn: orgUnitsApi.getAll,
  });

  const { data: libraries = [], isLoading: loadingLibs } = useQuery({
    queryKey: ["libraries"],
    queryFn: librariesApi.getAll,
  });

  const deleteOrgMutation = useMutation({
    mutationFn: orgUnitsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-units"] });
      toast.success("Organizational unit deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteLibMutation = useMutation({
    mutationFn: librariesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
      toast.success("Library deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rootUnits = orgUnits.filter(u => u.parentId === null);

  const handleAddRootUnit = () => {
    setEditingOrgUnit(undefined);
    setParentIdForNew(null);
    setOrgDialogOpen(true);
  };

  const handleAddChildUnit = (parentId: number) => {
    setEditingOrgUnit(undefined);
    setParentIdForNew(parentId);
    setOrgDialogOpen(true);
  };

  const handleEditUnit = (unit: OrgUnit) => {
    setEditingOrgUnit(unit);
    setParentIdForNew(null);
    setOrgDialogOpen(true);
  };

  const handleDeleteUnit = (id: number) => {
    if (confirm("Are you sure you want to delete this organizational unit? This cannot be undone.")) {
      deleteOrgMutation.mutate(id);
    }
  };

  const handleAddLibrary = (orgUnitId?: number) => {
    setEditingLibrary(undefined);
    setOrgUnitIdForLib(orgUnitId);
    setLibDialogOpen(true);
  };

  const handleEditLibrary = (lib: LibraryType) => {
    setEditingLibrary(lib);
    setLibDialogOpen(true);
  };

  const handleDeleteLibrary = (id: number) => {
    if (confirm("Are you sure you want to delete this library? This cannot be undone.")) {
      deleteLibMutation.mutate(id);
    }
  };

  const isLoading = loadingUnits || loadingLibs;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Organizational Hierarchy
              </CardTitle>
              <CardDescription>
                Define your organization structure: University → Campus → College → Department.
                Each unit can have libraries and child units.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={libDialogOpen} onOpenChange={setLibDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => handleAddLibrary()}
                    data-testid="button-add-library"
                  >
                    <Library className="h-4 w-4" />
                    Add Library
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <LibraryDialog 
                    library={editingLibrary}
                    orgUnits={orgUnits}
                    onClose={() => {
                      setLibDialogOpen(false);
                      setEditingLibrary(undefined);
                    }}
                  />
                </DialogContent>
              </Dialog>
              
              <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm" 
                    className="gap-2"
                    onClick={handleAddRootUnit}
                    data-testid="button-add-org-unit"
                  >
                    <Plus className="h-4 w-4" />
                    Add Unit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <OrgUnitDialog 
                    orgUnit={editingOrgUnit}
                    parentId={parentIdForNew}
                    onClose={() => {
                      setOrgDialogOpen(false);
                      setEditingOrgUnit(undefined);
                      setParentIdForNew(null);
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : rootUnits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
              <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No organizational units configured yet.</p>
              <p className="text-sm">Start by adding your university or top-level organization.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {rootUnits.map(unit => (
                <OrgTreeNode
                  key={unit.id}
                  unit={unit}
                  allUnits={orgUnits}
                  libraries={libraries}
                  onEditUnit={handleEditUnit}
                  onDeleteUnit={handleDeleteUnit}
                  onAddChild={handleAddChildUnit}
                  onEditLibrary={handleEditLibrary}
                  onDeleteLibrary={handleDeleteLibrary}
                  onAddLibrary={handleAddLibrary}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Libraries Summary
          </CardTitle>
          <CardDescription>
            Overview of all libraries across your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : libraries.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No libraries configured. Add libraries to organizational units above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {libraries.map((lib) => {
                  const orgUnit = orgUnits.find(u => u.id === lib.orgUnitId);
                  return (
                    <TableRow key={lib.id} data-testid={`row-lib-${lib.id}`}>
                      <TableCell className="font-mono text-sm">{lib.code}</TableCell>
                      <TableCell className="font-medium">{lib.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {orgUnit?.name || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={lib.isActive ? "default" : "secondary"}
                          className={lib.isActive ? "bg-green-100 text-green-800" : ""}
                        >
                          {lib.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditLibrary(lib)}
                          data-testid={`button-edit-lib-${lib.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteLibrary(lib.id)}
                          data-testid={`button-delete-lib-${lib.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
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
  const [editingType, setEditingType] = useState<ResourceType | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: resourceTypes = [], isLoading } = useQuery({
    queryKey: ["resource-types"],
    queryFn: resourceTypesApi.getAll,
  });

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

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-settings-title">
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">Configure library rules, integrations, and preferences.</p>
        </div>
        <Button className="gap-2" data-testid="button-save-settings">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
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
                value="organization" 
                className="justify-start px-3 py-2 h-10 data-[state=active]:bg-muted data-[state=active]:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Building className="mr-2 h-4 w-4" />
                Organization & Libraries
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
                  <div className="grid gap-2">
                    <Label htmlFor="fine-amount">Fine per Day ($)</Label>
                    <Input id="fine-amount" type="number" defaultValue="0.50" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="organization" className="mt-0">
              <OrganizationTab />
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
