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
  ResponsiveContainer, PieChart, Pie, Cell,
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
    return { total, published, drafts, pending, totalViews, totalDownloads };
  }, [resources]);

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
        <StatCard title="Published" value={stats.published} sub="Visible to audience" icon={CheckCircle2}
          colorClass="text-green-700" bgClass="bg-green-50" borderClass="border-green-100" />
        <StatCard title="Drafts" value={stats.drafts} sub="Not yet published" icon={FileText}
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
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Engagement Snapshot</CardTitle>
              <CardDescription>Views vs downloads</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-violet-50 border border-violet-100 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Total Views</p>
                  <p className="text-xl font-bold text-violet-700">{stats.totalViews}</p>
                </div>
                <div className="rounded-lg bg-cyan-50 border border-cyan-100 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Total Downloads</p>
                  <p className="text-xl font-bold text-cyan-700">{stats.totalDownloads}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Archive className="h-3.5 w-3.5" />
                {stats.total} resources tracked across all libraries
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
