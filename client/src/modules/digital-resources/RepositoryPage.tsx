import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Grid3x3, List, Search, Upload, FileText, Video, Music, Image as ImageIcon,
  FileArchive, Link as LinkIcon, Eye, Download, Calendar, X,
} from "lucide-react";
import { digitalResourcesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { DigitalResource } from "@shared/schema";
import { format as fmtDate } from "date-fns";

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

export default function RepositoryPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isStaff = user?.role === "ADMIN" || user?.role === "LIBRARIAN";
  const canUpload = isStaff || user?.role === "FACULTY";

  const params = new URLSearchParams(window.location.search);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [resourceType, setResourceType] = useState<string>(params.get("resourceType") || "all");
  const [category, setCategory] = useState<string>(params.get("category") || "all");
  const [status, setStatus] = useState<string>(isStaff ? (params.get("status") || "all") : "all");
  const [tagFilter, setTagFilter] = useState<string | null>(params.get("tag"));

  const { data: resources = [], isLoading } = useQuery<DigitalResource[]>({
    queryKey: ["digital-resources", "repository", search, resourceType, category, status],
    queryFn: () =>
      digitalResourcesApi.getAll({
        search: search || undefined,
        resourceType: resourceType !== "all" ? resourceType : undefined,
        category: category !== "all" ? category : undefined,
        status: isStaff && status !== "all" ? status : undefined,
        limit: 200,
      }),
  });

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
    setLocation("/digital-resources/repository");
  };

  const hasActiveFilters = search || resourceType !== "all" || category !== "all" || status !== "all" || tagFilter;

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Repository</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Browse and search digital resources</p>
        </div>
        {canUpload && (
          <Link href="/digital-resources/upload">
            <Button size="sm" className="gap-2" data-testid="button-upload">
              <Upload className="h-4 w-4" /> Upload Resource
            </Button>
          </Link>
        )}
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
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1" data-testid="button-clear-filters">
                  <X className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
              <div className="flex border rounded-md overflow-hidden ml-auto">
                <Button
                  variant={view === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="rounded-none h-9 w-9"
                  onClick={() => setView("grid")}
                  data-testid="button-view-grid"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={view === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="rounded-none h-9 w-9"
                  onClick={() => setView("list")}
                  data-testid="button-view-list"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
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
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="grid-resources">
          {filtered.map((r) => {
            const Icon = typeIcon(r.resourceType);
            return (
              <Link key={r.id} href={`/digital-resources/${r.id}`} data-testid={`card-resource-${r.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full cursor-pointer">
                  <CardContent className="p-4 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-2">
                      <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <Badge variant={r.status === "PUBLISHED" ? "default" : r.status === "PENDING_APPROVAL" ? "secondary" : "outline"} className="text-xs">
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1" data-testid={`text-title-${r.id}`}>{r.title}</h3>
                    {r.shortDescription && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{r.shortDescription}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(r.tags || []).slice(0, 3).map(t => (
                        <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
                      ))}
                    </div>
                    <div className="mt-auto pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                      <span>{r.resourceType} · {formatFileSize(r.fileSizeBytes)}</span>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{r.viewCount}</span>
                        <span className="flex items-center gap-0.5"><Download className="h-3 w-3" />{r.downloadCount}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y" data-testid="list-resources">
              {filtered.map((r) => {
                const Icon = typeIcon(r.resourceType);
                return (
                  <Link key={r.id} href={`/digital-resources/${r.id}`} className="flex items-center gap-4 p-4 hover:bg-muted/40" data-testid={`row-resource-${r.id}`}>
                    <div className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.resourceType} · v{r.versionNumber}{r.department ? ` · ${r.department}` : ""}{r.course ? ` · ${r.course}` : ""}
                      </p>
                    </div>
                    <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Calendar className="h-3.5 w-3.5" />
                      {r.updatedAt ? fmtDate(new Date(r.updatedAt as any), "dd MMM yyyy") : "—"}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <span className="flex items-center gap-0.5"><Eye className="h-3.5 w-3.5" />{r.viewCount}</span>
                      <span className="flex items-center gap-0.5"><Download className="h-3.5 w-3.5" />{r.downloadCount}</span>
                    </div>
                    <Badge variant={r.status === "PUBLISHED" ? "default" : r.status === "PENDING_APPROVAL" ? "secondary" : "outline"} className="text-xs shrink-0">
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
}
