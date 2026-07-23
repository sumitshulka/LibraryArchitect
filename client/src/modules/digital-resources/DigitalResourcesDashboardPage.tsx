import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderOpen, FileText, Eye, Download, Upload, ArrowRight,
  CheckCircle2, Clock, Archive, TrendingUp, Tag as TagIcon,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { digitalResourcesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { format as fmtDate } from "date-fns";
import type { DigitalResource } from "@shared/schema";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16"];

function StatCard({
  title, value, sub, icon: Icon, colorClass, bgClass, borderClass, href,
}: {
  title: string; value: string | number; sub?: string; icon: any;
  colorClass: string; bgClass: string; borderClass: string; href?: string;
}) {
  const card = (
    <Card className={`border ${borderClass} ${bgClass} hover:shadow-md transition-shadow h-full`}>
      <CardContent className="p-5 h-full">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
            <p className={`text-2xl font-bold ${colorClass} leading-tight`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-white/70`}>
            <Icon className={`h-5 w-5 ${colorClass}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="block h-full" data-testid={`link-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>{card}</Link> : card;
}

export default function DigitalResourcesDashboardPage() {
  const { user } = useAuth();
  const isStaff = user?.role === "ADMIN" || user?.role === "LIBRARIAN";

  const { data: resources = [], isLoading } = useQuery<DigitalResource[]>({
    queryKey: ["digital-resources", "dashboard"],
    queryFn: () => digitalResourcesApi.getAll({ limit: 500 }),
  });

  const stats = useMemo(() => {
    const total = resources.length;
    const published = resources.filter(r => r.status === "PUBLISHED").length;
    const drafts = resources.filter(r => r.status === "DRAFT").length;
    const pending = resources.filter(r => r.status === "PENDING_APPROVAL").length;
    const totalViews = resources.reduce((s, r) => s + (r.viewCount || 0), 0);
    const totalDownloads = resources.reduce((s, r) => s + (r.downloadCount || 0), 0);
    const totalStorageBytes = resources.reduce((s, r) => s + (r.fileSizeBytes || 0), 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentlyUploaded = resources.filter(r => r.createdAt && new Date(r.createdAt as any) >= sevenDaysAgo).length;
    return { total, published, drafts, pending, totalViews, totalDownloads, totalStorageBytes, recentlyUploaded };
  }, [resources]);

  function formatStorage(bytes: number): string {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    resources.forEach(r => map.set(r.resourceType, (map.get(r.resourceType) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [resources]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    resources.forEach(r => {
      const cat = r.category || "UNCATEGORIZED";
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [resources]);

  const topTags = useMemo(() => {
    const map = new Map<string, number>();
    resources.forEach(r => (r.tags || []).forEach(t => map.set(t, (map.get(t) || 0) + 1)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [resources]);

  const recentActivity = useMemo(() => {
    return [...resources]
      .sort((a, b) => new Date(b.updatedAt as any).getTime() - new Date(a.updatedAt as any).getTime())
      .slice(0, 6);
  }, [resources]);

  const byMonth = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const count = resources.filter(r => {
        const c = r.createdAt ? new Date(r.createdAt as any) : null;
        if (!c) return false;
        return `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}` === monthStr;
      }).length;
      return { month: label, count };
    });
  }, [resources]);

  const topDownloaded = useMemo(() =>
    [...resources].sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0)).slice(0, 5),
    [resources]);

  const topViewed = useMemo(() =>
    [...resources].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 5),
    [resources]);

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Digital Resources Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            E-content library — documents, media, and course materials
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/digital-resources/repository">
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-browse-repository">
              <FolderOpen className="h-4 w-4" /> Browse Repository
            </Button>
          </Link>
          {isStaff || user?.role === "FACULTY" ? (
            <Link href="/digital-resources/upload">
              <Button size="sm" className="gap-2" data-testid="button-quick-upload">
                <Upload className="h-4 w-4" /> Upload Resource
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 items-stretch mb-6">
        <StatCard title="Total Resources" value={stats.total} sub={`${stats.published} published`} icon={FolderOpen}
          colorClass="text-blue-700" bgClass="bg-blue-50" borderClass="border-blue-100" href="/digital-resources/repository" />
        <StatCard title="Storage Used" value={formatStorage(stats.totalStorageBytes)} sub={`${stats.total} resources`} icon={Archive}
          colorClass="text-green-700" bgClass="bg-green-50" borderClass="border-green-100" />
        <StatCard title="Recently Uploaded" value={stats.recentlyUploaded} sub="Last 7 days" icon={Upload}
          colorClass="text-slate-700" bgClass="bg-slate-50" borderClass="border-slate-200" />
        <StatCard title="Pending Approval" value={stats.pending} sub="Awaiting review" icon={Clock}
          colorClass="text-amber-700" bgClass="bg-amber-50" borderClass="border-amber-100" />
        <StatCard title="Total Views" value={stats.totalViews} sub="All-time" icon={Eye}
          colorClass="text-violet-700" bgClass="bg-violet-50" borderClass="border-violet-100" />
        <StatCard title="Downloads" value={stats.totalDownloads} sub="All-time" icon={Download}
          colorClass="text-cyan-700" bgClass="bg-cyan-50" borderClass="border-cyan-100" />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7 mb-4">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resources by Type</CardTitle>
            <CardDescription>Distribution across file/media types</CardDescription>
          </CardHeader>
          <CardContent className="pl-1">
            <div className="h-[260px]">
              {byType.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byType} barGap={4} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", fontSize: 12 }} />
                    <Bar dataKey="value" name="Resources" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  {isLoading ? "Loading…" : "No resources yet"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Category</CardTitle>
            <CardDescription>Content categorization breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              {byCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.name}>
                      {byCategory.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7 mb-4">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Monthly Upload Trend</CardTitle>
            <CardDescription>Resources added per month (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent className="pl-1">
            <div className="h-[200px]">
              {byMonth.some(m => m.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={byMonth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis dataKey="month" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", fontSize: 12 }} />
                    <Area type="monotone" dataKey="count" name="Uploads" fill="#6366f120" stroke="#6366f1" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  {isLoading ? "Loading…" : "No upload data yet"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" /> Top Downloads</CardTitle>
            <CardDescription>Most downloaded resources all-time</CardDescription>
          </CardHeader>
          <CardContent>
            {topDownloaded.every(r => !r.downloadCount) ? (
              <p className="text-sm text-muted-foreground text-center py-4">No downloads yet</p>
            ) : (
              <div className="space-y-1" data-testid="list-top-downloads">
                {topDownloaded.filter(r => r.downloadCount).map((r, i) => (
                  <Link key={r.id} href={`/digital-resources/${r.id}`} className="flex items-center gap-2 py-1.5 hover:bg-muted/40 rounded px-1 -mx-1" data-testid={`row-top-download-${r.id}`}>
                    <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.resourceType}</p>
                    </div>
                    <span className="text-xs font-semibold text-cyan-700 shrink-0 flex items-center gap-1">
                      <Download className="h-3 w-3" />{r.downloadCount}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription>Recently added or updated resources</CardDescription>
              </div>
              <Link href="/digital-resources/repository">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">View all <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No recent activity</p>
            ) : (
              <div className="space-y-0" data-testid="list-recent-activity">
                {recentActivity.map((r, i) => (
                  <div key={r.id}>
                    <Link href={`/digital-resources/${r.id}`} className="flex items-start gap-3 py-3 hover:bg-muted/40 rounded-md px-1 -mx-1" data-testid={`row-recent-${r.id}`}>
                      <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border bg-blue-50 border-blue-200 text-blue-600">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground">
                          v{r.versionNumber} · {r.resourceType}{r.department ? ` · ${r.department}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={r.status === "PUBLISHED" ? "default" : r.status === "PENDING_APPROVAL" ? "secondary" : "outline"} className="text-xs mb-1">
                          {r.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {r.updatedAt ? fmtDate(new Date(r.updatedAt as any), "dd MMM") : ""}
                        </p>
                      </div>
                    </Link>
                    {i < recentActivity.length - 1 && <div className="border-t mx-1" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 flex flex-col gap-4">
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><TagIcon className="h-4 w-4" /> Popular Tags</CardTitle>
              <CardDescription>Most used tags across the repository</CardDescription>
            </CardHeader>
            <CardContent>
              {topTags.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No tags yet</p>
              ) : (
                <div className="flex flex-wrap gap-2" data-testid="list-popular-tags">
                  {topTags.map(([tag, count]) => (
                    <Link key={tag} href={`/digital-resources/repository?tag=${encodeURIComponent(tag)}`}>
                      <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/70" data-testid={`chip-tag-${tag}`}>
                        {tag} <span className="text-muted-foreground">({count})</span>
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Most Viewed</CardTitle>
              <CardDescription>Top resources by total views</CardDescription>
            </CardHeader>
            <CardContent>
              {topViewed.every(r => !r.viewCount) ? (
                <p className="text-sm text-muted-foreground text-center py-4">No views yet</p>
              ) : (
                <div className="space-y-1" data-testid="list-top-viewed">
                  {topViewed.filter(r => r.viewCount).map((r, i) => (
                    <Link key={r.id} href={`/digital-resources/${r.id}`} className="flex items-center gap-2 py-1.5 hover:bg-muted/40 rounded px-1 -mx-1" data-testid={`row-top-viewed-${r.id}`}>
                      <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground">{r.resourceType}</p>
                      </div>
                      <span className="text-xs font-semibold text-violet-700 shrink-0 flex items-center gap-1">
                        <Eye className="h-3 w-3" />{r.viewCount}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
