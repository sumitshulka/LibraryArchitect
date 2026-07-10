import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Download, Eye, FileText, Video, Music, Image as ImageIcon,
  FileArchive, Link as LinkIcon, Calendar, User as UserIcon, Building2,
  Tag as TagIcon, History, Upload, Trash2, CheckCircle2, XCircle, Loader2, ExternalLink,
  Globe2, BookOpen, BarChart3, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { digitalResourcesApi, resourceTypeSettingsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { format as fmtDate } from "date-fns";

function typeIcon(resourceType: string) {
  if (["VIDEO", "YOUTUBE"].includes(resourceType)) return Video;
  if (resourceType === "AUDIO") return Music;
  if (resourceType === "IMAGE") return ImageIcon;
  if (resourceType === "ZIP") return FileArchive;
  if (["EXTERNAL_URL", "GOOGLE_DRIVE", "ONEDRIVE"].includes(resourceType)) return LinkIcon;
  return FileText;
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

export default function ResourceDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionNotes, setVersionNotes] = useState("");
  const [versionNumber, setVersionNumber] = useState("");

  const { data: resource, isLoading, error } = useQuery({
    queryKey: ["digital-resources", id],
    queryFn: () => digitalResourcesApi.getById(id),
    enabled: !!id,
  });

  const { data: typeSettings = [] } = useQuery({
    queryKey: ["resource-type-settings"],
    queryFn: resourceTypeSettingsApi.getAll,
  });

  const typeColor = resource ? (typeSettings.find(s => s.resourceType === resource.resourceType)?.color || "#3b82f6") : "#3b82f6";

  useEffect(() => {
    if (resource) digitalResourcesApi.recordView(id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!resource]);

  const isStaff = user?.role === "ADMIN" || user?.role === "LIBRARIAN";
  const isOwner = resource?.uploadedBy === user?.id;
  const canManage = isStaff || (user?.role === "FACULTY" && isOwner);

  const publishMutation = useMutation({
    mutationFn: (publish: boolean) => digitalResourcesApi.publish(id, publish),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["digital-resources"] });
      toast.success(updated.status === "PUBLISHED" ? "Resource published" : "Resource unpublished");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => digitalResourcesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["digital-resources"] });
      toast.success("Resource deleted");
      setLocation("/digital-resources/repository");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addVersionMutation = useMutation({
    mutationFn: () =>
      digitalResourcesApi.addVersion(id, {
        file: versionFile || undefined,
        versionNumber: versionNumber || undefined,
        releaseNotes: versionNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["digital-resources", id] });
      toast.success("New version added");
      setVersionDialogOpen(false);
      setVersionFile(null);
      setVersionNotes("");
      setVersionNumber("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadMutation = useMutation({
    mutationFn: () => digitalResourcesApi.recordDownload(id),
    onSuccess: (data) => {
      const url = data.fileUrl || data.externalUrl;
      if (url) window.open(url, "_blank");
      queryClient.invalidateQueries({ queryKey: ["digital-resources", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center gap-4 mb-6 animate-pulse">
          <div className="h-9 w-9 rounded-md bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-1/5" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="animate-pulse"><CardContent className="p-6"><div className="h-[300px] bg-muted rounded-lg" /></CardContent></Card>
          </div>
          <Card className="animate-pulse"><CardContent className="p-6 space-y-3">
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </CardContent></Card>
        </div>
      </MainLayout>
    );
  }

  if (error || !resource) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-medium mb-1">Resource not found</p>
          <p className="text-muted-foreground text-sm mb-4" data-testid="text-error">You don't have access, or it may have been removed.</p>
          <Link href="/digital-resources/repository">
            <Button variant="outline" data-testid="button-back-to-repository">Back to Repository</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const Icon = typeIcon(resource.resourceType);
  const previewUrl = resource.fileUrl || resource.externalUrl;
  const isPreviewable = resource.allowPreview && previewUrl && ["PDF", "IMAGE"].includes(resource.resourceType);

  return (
    <MainLayout>
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-background mb-6">
        <div className="flex items-start gap-4 flex-wrap p-6">
          <Button variant="ghost" size="icon" className="shrink-0 bg-background/70" onClick={() => setLocation("/digital-resources/repository")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div
            className="h-12 w-12 rounded-xl border flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: `${typeColor}1a`, borderColor: `${typeColor}40` }}
          >
            <Icon className="h-6 w-6" style={{ color: typeColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate" data-testid="text-title">{resource.title}</h1>
              <Badge variant={resource.status === "PUBLISHED" ? "default" : resource.status === "PENDING_APPROVAL" ? "secondary" : "outline"} data-testid="badge-status">
                {resource.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{resource.resourceType}</span>
              <span aria-hidden>·</span>
              <span>v{resource.versionNumber}</span>
              {resource.category && (
                <>
                  <span aria-hidden>·</span>
                  <span>{resource.category.replace(/_/g, " ")}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {resource.allowDownload && (resource.fileUrl || resource.externalUrl) && (
              <Button variant="outline" size="sm" className="gap-2 bg-background/80" onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending} data-testid="button-download">
                <Download className="h-4 w-4" /> Download
              </Button>
            )}
            {canManage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-background/80"
                  onClick={() => publishMutation.mutate(resource.status !== "PUBLISHED")}
                  disabled={publishMutation.isPending}
                  data-testid="button-toggle-publish"
                >
                  {resource.status === "PUBLISHED" ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {resource.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                </Button>
                <Button variant="outline" size="sm" className="gap-2 bg-background/80" onClick={() => setVersionDialogOpen(true)} data-testid="button-add-version">
                  <Upload className="h-4 w-4" /> New Version
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive bg-background/80"
                  onClick={() => {
                    if (confirm("Delete this resource? This cannot be undone.")) deleteMutation.mutate();
                  }}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete"
                >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </>
          )}
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-6">
              {isPreviewable ? (
                resource.resourceType === "IMAGE" ? (
                  <img src={previewUrl!} alt={resource.title} className="w-full rounded-lg max-h-[480px] object-contain bg-muted" data-testid="img-preview" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-muted/40 rounded-lg" data-testid="preview-pdf-fallback">
                    <Icon className="h-14 w-14 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-1 font-medium">{resource.fileName || resource.title}</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      PDF preview opens in a new tab (browsers block embedded PDF viewers inside this preview).
                    </p>
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => window.open(previewUrl!, "_blank", "noopener,noreferrer")}
                      data-testid="button-open-pdf-preview"
                    >
                      <ExternalLink className="h-4 w-4" /> Open PDF in New Tab
                    </Button>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-12 bg-muted/40 rounded-lg">
                  <Icon className="h-14 w-14 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    {resource.allowPreview ? "Preview not available for this file type." : "Preview disabled for this resource."}
                  </p>
                  {previewUrl && (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(previewUrl, "_blank")} data-testid="button-open-external">
                      <ExternalLink className="h-4 w-4" /> Open Source
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-description">
                {resource.description || resource.shortDescription || "No description provided."}
              </p>
              {(resource.topics || resource.learningOutcomes) && (
                <div className="mt-4 space-y-3">
                  {resource.topics && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Topics</p>
                      <p className="text-sm">{resource.topics}</p>
                    </div>
                  )}
                  {resource.learningOutcomes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Learning Outcomes</p>
                      <p className="text-sm">{resource.learningOutcomes}</p>
                    </div>
                  )}
                </div>
              )}
              {(resource.tags && resource.tags.length > 0) && (
                <div className="flex flex-wrap gap-1 mt-4">
                  {resource.tags.map(t => (
                    <Badge key={t} variant="secondary" className="text-xs gap-1"><TagIcon className="h-3 w-3" />{t}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="versions">
            <TabsList>
              <TabsTrigger value="versions" className="gap-2" data-testid="tab-versions"><History className="h-4 w-4" /> Version History</TabsTrigger>
            </TabsList>
            <TabsContent value="versions">
              <Card>
                <CardContent className="p-0">
                  {resource.versions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Clock className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No prior versions recorded.</p>
                    </div>
                  ) : (
                    <div className="divide-y" data-testid="list-versions">
                      {resource.versions
                        .slice()
                        .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
                        .map((v, idx) => (
                          <div key={v.id} className="p-4 flex items-start gap-3" data-testid={`row-version-${v.id}`}>
                            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-xs font-semibold text-primary">v{v.versionNumber}</span>
                            </div>
                            <div className="min-w-0 flex-1 flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm font-medium flex items-center gap-2">
                                  Version {v.versionNumber}
                                  {idx === 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Current</Badge>}
                                </p>
                                {v.releaseNotes && <p className="text-xs text-muted-foreground mt-0.5">{v.releaseNotes}</p>}
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {v.createdAt ? fmtDate(new Date(v.createdAt as any), "dd MMM yyyy, HH:mm") : ""}
                                </p>
                              </div>
                              {(v.fileUrl || v.externalUrl) && (
                                <Button variant="ghost" size="sm" className="gap-1 shrink-0" onClick={() => window.open(v.fileUrl || v.externalUrl!, "_blank")} data-testid={`button-view-version-${v.id}`}>
                                  <ExternalLink className="h-3.5 w-3.5" /> View
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border/80">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Eye className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight" data-testid="stat-view-count">{resource.viewCount}</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Download className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight" data-testid="stat-download-count">{resource.downloadCount}</p>
                  <p className="text-xs text-muted-foreground">Downloads</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground" /> Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserIcon className="h-4 w-4 shrink-0" />
                <span className="text-foreground">{resource.author || resource.faculty || "Unknown author"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="text-foreground">{resource.department || "—"}{resource.course ? ` · ${resource.course}` : ""}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span className="text-foreground">{resource.publishDate ? fmtDate(new Date(resource.publishDate as any), "dd MMM yyyy") : "Not published"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe2 className="h-4 w-4 shrink-0" />
                <span className="text-foreground">{resource.visibility.replace(/_/g, " ")}</span>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-2">
                <div>
                  <p className="text-xs text-muted-foreground">File Size</p>
                  <p className="font-medium">{formatFileSize(resource.fileSizeBytes)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium truncate">{resource.category?.replace(/_/g, " ") || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Difficulty</p>
                  <p className="font-medium">{resource.difficulty || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Language</p>
                  <p className="font-medium">{resource.language || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent data-testid="dialog-add-version">
          <DialogHeader>
            <DialogTitle>Add New Version</DialogTitle>
            <DialogDescription>Upload an updated file and record what changed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="version-file">File</Label>
              <Input id="version-file" type="file" onChange={(e) => setVersionFile(e.target.files?.[0] || null)} data-testid="input-version-file" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version-number">Version Number</Label>
              <Input id="version-number" placeholder="e.g. 2.0" value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} data-testid="input-version-number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version-notes">Release Notes</Label>
              <Textarea id="version-notes" rows={3} value={versionNotes} onChange={(e) => setVersionNotes(e.target.value)} data-testid="input-version-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionDialogOpen(false)} data-testid="button-cancel-version">Cancel</Button>
            <Button onClick={() => addVersionMutation.mutate()} disabled={addVersionMutation.isPending} className="gap-2" data-testid="button-submit-version">
              {addVersionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
