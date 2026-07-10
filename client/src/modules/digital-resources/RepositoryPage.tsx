import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Upload, FileText, Video, Music, Image as ImageIcon,
  FileArchive, Link as LinkIcon, Eye, Download, Calendar, X, User as UserIcon,
  Building2, GraduationCap, Tag as TagIcon, HardDrive, Tags, Loader2, Save,
  LayoutDashboard,
} from "lucide-react";
import { digitalResourcesApi, resourceTypeSettingsApi, searchAttributesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { DigitalResource } from "@shared/schema";
import { format as fmtDate } from "date-fns";
import { DigitalResourceAttributesEditor } from "@/components/DigitalResourceAttributesEditor";
import { SearchAttributesFilter } from "@/components/SearchAttributesFilter";
import { toast } from "sonner";

const RESOURCE_TYPES = ["PDF", "DOC", "DOCX", "PPT", "PPTX", "XLS", "XLSX", "ZIP", "IMAGE", "VIDEO", "AUDIO", "HTML", "SCORM", "EXTERNAL_URL", "YOUTUBE", "GOOGLE_DRIVE", "ONEDRIVE"];
const CATEGORIES = ["TEXTBOOK", "LECTURE_NOTES", "LAB_MANUAL", "QUESTION_BANK", "PRESENTATION", "RESEARCH_PAPER", "ASSIGNMENT", "CASE_STUDY", "REFERENCE_MATERIAL", "TUTORIAL", "VIDEO_LECTURE", "POLICY_DOCUMENT", "OTHER"];
const STATUSES = ["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "ARCHIVED"];

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

function ResourceAttributeBadges({ resourceId }: { resourceId: number }) {
  const { data: attrs = [] } = useQuery({
    queryKey: ["digital-resource-search-attributes", resourceId],
    queryFn: () => searchAttributesApi.getDigitalResourceAttributes(resourceId),
  });

  if (attrs.length === 0) return null;

  return (
    <>
      {attrs.map((a) => (
        <Badge key={a.id} variant="outline" className="text-[10px] px-1.5 py-0 gap-1" data-testid={`badge-resource-attr-${a.id}`}>
          <Tags className="h-2.5 w-2.5" />{a.attributeValue}
        </Badge>
      ))}
    </>
  );
}

function EditResourceAttributesDialog({
  resourceId,
  open,
  onOpenChange,
}: {
  resourceId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: currentAttrs = [] } = useQuery({
    queryKey: ["digital-resource-search-attributes", resourceId],
    queryFn: () => searchAttributesApi.getDigitalResourceAttributes(resourceId!),
    enabled: open && !!resourceId,
  });

  useEffect(() => {
    if (open) setSelectedIds(currentAttrs.map((a) => a.attributeValueId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resourceId, JSON.stringify(currentAttrs.map((a) => a.attributeValueId))]);

  const saveMutation = useMutation({
    mutationFn: () => searchAttributesApi.setDigitalResourceAttributes(resourceId!, selectedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["digital-resource-search-attributes", resourceId] });
      toast.success("Search attributes updated");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-4 w-4" /> Search Attributes
          </DialogTitle>
        </DialogHeader>
        <DigitalResourceAttributesEditor selectedValueIds={selectedIds} onChange={setSelectedIds} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-attributes">
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2"
            data-testid="button-save-resource-attributes"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RepositoryPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isStaff = user?.role === "ADMIN" || user?.role === "LIBRARIAN";
  const canUpload = isStaff || user?.role === "FACULTY";
  const [editingAttrsFor, setEditingAttrsFor] = useState<number | null>(null);

  const params = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState("");
  const [resourceType, setResourceType] = useState<string>(params.get("resourceType") || "all");
  const [category, setCategory] = useState<string>(params.get("category") || "all");
  const [status, setStatus] = useState<string>(isStaff ? (params.get("status") || "all") : "all");
  const [tagFilter, setTagFilter] = useState<string | null>(params.get("tag"));
  const [attributeValueIds, setAttributeValueIds] = useState<number[]>([]);

  const { data: resources = [], isLoading } = useQuery<DigitalResource[]>({
    queryKey: ["digital-resources", "repository", search, resourceType, category, status, attributeValueIds],
    queryFn: () =>
      digitalResourcesApi.getAll({
        search: search || undefined,
        resourceType: resourceType !== "all" ? resourceType : undefined,
        category: category !== "all" ? category : undefined,
        status: isStaff && status !== "all" ? status : undefined,
        attributeValueIds: attributeValueIds.length > 0 ? attributeValueIds : undefined,
        limit: 200,
      }),
  });

  const { data: typeSettings = [] } = useQuery({
    queryKey: ["resource-type-settings"],
    queryFn: resourceTypeSettingsApi.getAll,
  });

  const typeColor = (resourceType: string) =>
    typeSettings.find(s => s.resourceType === resourceType)?.color || "#3b82f6";

  const filtered = useMemo(() => {
    if (!tagFilter) return resources;
    return resources.filter(r => (r.tags || []).includes(tagFilter));
  }, [resources, tagFilter]);

  const clearFilters = () => {
    setSearch("");
    setResourceType("all");
    setCategory("all");
    setStatus("all");
    setTagFilter(null);
    setAttributeValueIds([]);
    setLocation("/digital-resources/repository");
  };

  const hasActiveFilters = search || resourceType !== "all" || category !== "all" || status !== "all" || tagFilter || attributeValueIds.length > 0;

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Digital Repository</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Browse and search digital resources</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/digital-resources">
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-digital-dashboard">
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Button>
          </Link>
          {canUpload && (
            <Link href="/digital-resources/upload">
              <Button size="sm" className="gap-2" data-testid="button-upload">
                <Upload className="h-4 w-4" /> Upload Resource
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, description, keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger className="w-[150px]" data-testid="select-resource-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {RESOURCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[170px]" data-testid="select-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              {isStaff && (
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[150px]" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <SearchAttributesFilter
                selectedValueIds={attributeValueIds}
                onChange={setAttributeValueIds}
              />
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1" data-testid="button-clear-filters">
                  <X className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>
          </div>
          {tagFilter && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtering by tag:</span>
              <Badge variant="secondary" className="gap-1">
                {tagFilter}
                <button onClick={() => setTagFilter(null)} aria-label="Remove tag filter">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading resources...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="text-empty-state">
          No digital resources found matching your filters.
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="list-resources">
          {filtered.map((r) => {
            const Icon = typeIcon(r.resourceType);
            const academicBits = [r.department, r.course, r.semester, r.batch].filter(Boolean);
            const color = typeColor(r.resourceType);
            return (
              <Link key={r.id} href={`/digital-resources/${r.id}`} data-testid={`card-resource-${r.id}`}>
                <Card
                  className="hover:shadow-md transition-shadow cursor-pointer border-l-4"
                  style={{ borderLeftColor: color }}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div
                        className="h-14 w-14 rounded-xl border flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}1a`, borderColor: `${color}40` }}
                      >
                        <Icon className="h-7 w-7" style={{ color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-base leading-tight truncate" data-testid={`text-title-${r.id}`}>{r.title}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {r.resourceType} · v{r.versionNumber} · {formatFileSize(r.fileSizeBytes)}
                              {r.category ? ` · ${r.category.replace(/_/g, " ")}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={r.status === "PUBLISHED" ? "default" : r.status === "PENDING_APPROVAL" ? "secondary" : "outline"} className="text-xs" data-testid={`badge-status-${r.id}`}>
                              {r.status.replace(/_/g, " ")}
                            </Badge>
                            {r.difficulty && (
                              <Badge variant="outline" className="text-xs">{r.difficulty}</Badge>
                            )}
                            {canUpload && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Edit search attributes"
                                data-testid={`button-edit-attributes-${r.id}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setEditingAttrsFor(r.id);
                                }}
                              >
                                <Tags className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {(r.shortDescription || r.description) && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                            {r.shortDescription || r.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-muted-foreground">
                          {(r.author || r.faculty) && (
                            <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" />{r.author || r.faculty}</span>
                          )}
                          {academicBits.length > 0 && (
                            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{academicBits.join(" · ")}</span>
                          )}
                          {r.program && (
                            <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{r.program}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {r.publishDate ? `Published ${fmtDate(new Date(r.publishDate as any), "dd MMM yyyy")}` : `Updated ${r.updatedAt ? fmtDate(new Date(r.updatedAt as any), "dd MMM yyyy") : "—"}`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t flex-wrap">
                          <div className="flex flex-wrap gap-1">
                            {(r.tags || []).slice(0, 5).map(t => (
                              <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 gap-1"><TagIcon className="h-2.5 w-2.5" />{t}</Badge>
                            ))}
                            <ResourceAttributeBadges resourceId={r.id} />
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{r.viewCount} views</span>
                            <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" />{r.downloadCount} downloads</span>
                            <span className="flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" />{formatFileSize(r.fileSizeBytes)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <EditResourceAttributesDialog
        resourceId={editingAttrsFor}
        open={editingAttrsFor !== null}
        onOpenChange={(open) => !open && setEditingAttrsFor(null)}
      />
    </MainLayout>
  );
}
