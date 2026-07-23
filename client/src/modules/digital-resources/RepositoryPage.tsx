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
  LayoutDashboard, FolderOpen, CheckCircle2, SlidersHorizontal, LayoutGrid, List,
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [deptFilter, setDeptFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
    let result = resources;
    if (tagFilter) result = result.filter(r => (r.tags || []).includes(tagFilter));
    if (deptFilter) result = result.filter(r => (r.department || '').toLowerCase().includes(deptFilter.toLowerCase()));
    if (courseFilter) result = result.filter(r => (r.course || '').toLowerCase().includes(courseFilter.toLowerCase()));
    if (semesterFilter) result = result.filter(r => (r.semester || '').toLowerCase().includes(semesterFilter.toLowerCase()));
    if (facultyFilter) result = result.filter(r => ((r.faculty || '') + ' ' + (r.author || '')).toLowerCase().includes(facultyFilter.toLowerCase()));
    if (visibilityFilter !== 'all') result = result.filter(r => r.visibility === visibilityFilter);
    if (dateFrom) result = result.filter(r => r.createdAt && new Date(r.createdAt as any) >= new Date(dateFrom));
    if (dateTo) result = result.filter(r => r.createdAt && new Date(r.createdAt as any) <= new Date(dateTo + 'T23:59:59'));
    return result;
  }, [resources, tagFilter, deptFilter, courseFilter, semesterFilter, facultyFilter, visibilityFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setSearch("");
    setResourceType("all");
    setCategory("all");
    setStatus("all");
    setTagFilter(null);
    setAttributeValueIds([]);
    setDeptFilter('');
    setCourseFilter('');
    setSemesterFilter('');
    setFacultyFilter('');
    setVisibilityFilter('all');
    setDateFrom('');
    setDateTo('');
    setLocation("/digital-resources/repository");
  };

  const hasActiveFilters = search || resourceType !== "all" || category !== "all" || status !== "all" || tagFilter || attributeValueIds.length > 0 || deptFilter || courseFilter || semesterFilter || facultyFilter || visibilityFilter !== 'all' || dateFrom || dateTo;

  const totalViews = filtered.reduce((sum, r) => sum + (r.viewCount || 0), 0);
  const totalDownloads = filtered.reduce((sum, r) => sum + (r.downloadCount || 0), 0);
  const publishedCount = filtered.filter((r) => r.status === "PUBLISHED").length;

  return (
    <MainLayout>
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-background mb-6">
        <div className="relative flex items-center justify-between gap-4 flex-wrap p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <FolderOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Digital Repository</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Browse, search, and manage institutional digital resources</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/digital-resources">
              <Button variant="outline" size="sm" className="gap-2 bg-background/80 backdrop-blur" data-testid="button-digital-dashboard">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Button>
            </Link>
            {canUpload && (
              <Link href="/digital-resources/upload">
                <Button size="sm" className="gap-2 shadow-sm" data-testid="button-upload">
                  <Upload className="h-4 w-4" /> Upload Resource
                </Button>
              </Link>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border-t">
          <div className="bg-card px-6 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Resources</p>
            <p className="text-xl font-bold mt-0.5" data-testid="stat-total-resources">{filtered.length}</p>
          </div>
          <div className="bg-card px-6 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Published</p>
            <p className="text-xl font-bold mt-0.5" data-testid="stat-published-resources">{publishedCount}</p>
          </div>
          <div className="bg-card px-6 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Eye className="h-3 w-3" /> Total Views</p>
            <p className="text-xl font-bold mt-0.5" data-testid="stat-total-views">{totalViews}</p>
          </div>
          <div className="bg-card px-6 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Download className="h-3 w-3" /> Total Downloads</p>
            <p className="text-xl font-bold mt-0.5" data-testid="stat-total-downloads">{totalDownloads}</p>
          </div>
        </div>
      </div>

      <Card className="mb-4 border-indigo-100 dark:border-indigo-900/40 shadow-sm bg-gradient-to-br from-indigo-50/70 via-slate-50/60 to-violet-50/50 dark:from-indigo-950/20 dark:via-slate-900/30 dark:to-violet-950/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700/80 dark:text-indigo-300/80 uppercase tracking-wide">
            <span className="flex items-center justify-center h-5 w-5 rounded-md bg-indigo-100 dark:bg-indigo-900/40">
              <SlidersHorizontal className="h-3 w-3 text-indigo-600 dark:text-indigo-300" />
            </span>
            Filters
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400" />
              <Input
                placeholder="Search by title, description, keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white/70 dark:bg-slate-900/40 border-indigo-100 dark:border-indigo-900/40 focus-visible:ring-indigo-300"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger className="w-[150px] bg-white/70 dark:bg-slate-900/40 border-indigo-100 dark:border-indigo-900/40" data-testid="select-resource-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {RESOURCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[170px] bg-white/70 dark:bg-slate-900/40 border-indigo-100 dark:border-indigo-900/40" data-testid="select-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              {isStaff && (
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[150px] bg-white/70 dark:bg-slate-900/40 border-indigo-100 dark:border-indigo-900/40" data-testid="select-status">
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
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-100/60 dark:text-indigo-300" data-testid="button-clear-filters">
                  <X className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t mt-1">
              <Input
                placeholder="Department…"
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="w-[140px] h-8 text-sm"
                data-testid="input-filter-department"
              />
              <Input
                placeholder="Course…"
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
                className="w-[120px] h-8 text-sm"
                data-testid="input-filter-course"
              />
              <Input
                placeholder="Semester…"
                value={semesterFilter}
                onChange={e => setSemesterFilter(e.target.value)}
                className="w-[115px] h-8 text-sm"
                data-testid="input-filter-semester"
              />
              <Input
                placeholder="Faculty / Author…"
                value={facultyFilter}
                onChange={e => setFacultyFilter(e.target.value)}
                className="w-[150px] h-8 text-sm"
                data-testid="input-filter-faculty"
              />
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger className="w-[155px] h-8 text-sm" data-testid="select-visibility-filter">
                  <SelectValue placeholder="All Visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Visibility</SelectItem>
                  {["INSTITUTION","LIBRARY","DEPARTMENT","COURSE","BATCH","FACULTY_ONLY","STUDENTS_ONLY","ROLE_BASED"].map(v => (
                    <SelectItem key={v} value={v}>{v.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[140px] h-8 text-sm" title="Uploaded from" data-testid="input-filter-date-from" />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[140px] h-8 text-sm" title="Uploaded until" data-testid="input-filter-date-to" />
            </div>
          </div>
          {tagFilter && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtering by tag:</span>
              <Badge variant="secondary" className="gap-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300">
                {tagFilter}
                <button onClick={() => setTagFilter(null)} aria-label="Remove tag filter">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${filtered.length} resource${filtered.length !== 1 ? "s" : ""}`}
        </p>
        <div className="flex items-center border rounded-md overflow-hidden">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 rounded-none px-3"
            onClick={() => setViewMode("list")}
            data-testid="button-view-list"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 rounded-none px-3"
            onClick={() => setViewMode("grid")}
            data-testid="button-view-grid"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3" data-testid="loading-resources">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 sm:p-5">
                <div className="flex gap-4">
                  <div className="h-14 w-14 rounded-xl bg-muted shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center" data-testid="text-empty-state">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-medium">No digital resources found</p>
            <p className="text-muted-foreground text-sm mt-1">Try adjusting your search or filters.</p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="gap-1 mt-4" onClick={clearFilters} data-testid="button-clear-filters-empty">
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" data-testid="grid-resources">
          {filtered.map(r => {
            const Icon = typeIcon(r.resourceType);
            const color = typeColor(r.resourceType);
            return (
              <Link key={r.id} href={`/digital-resources/${r.id}`} data-testid={`card-grid-resource-${r.id}`}>
                <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full">
                  <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center mt-2" style={{ backgroundColor: `${color}1a`, border: `1px solid ${color}40` }}>
                      <Icon className="h-6 w-6" style={{ color }} />
                    </div>
                    <p className="text-xs font-medium line-clamp-2 leading-tight">{r.title}</p>
                    <div className="flex flex-col gap-0.5 items-center">
                      <Badge variant={r.status === "PUBLISHED" ? "default" : "outline"} className="text-[10px] px-1.5 py-0">{r.status.replace(/_/g, " ")}</Badge>
                      <span className="text-[10px] text-muted-foreground">{r.resourceType}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
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
                  className="hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer border-l-4 border-border/70"
                  style={{ borderLeftColor: color }}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div
                        className="h-14 w-14 rounded-xl border flex items-center justify-center shrink-0 shadow-sm"
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
