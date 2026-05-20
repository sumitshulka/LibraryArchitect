import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Book, Users, Repeat, AlertCircle, BookOpen, Banknote,
  TrendingUp, TrendingDown,
  ArrowRight, CheckCircle2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { statsApi, pendingFinesApi } from "@/lib/api";
import { useCurrency } from "@/lib/useCurrency";
import { Link } from "wouter";
import { format as fmtDate } from "date-fns";

async function fetchCirculationReport() {
  const res = await fetch("/api/reports/circulation");
  if (!res.ok) throw new Error("Failed to fetch report");
  return res.json();
}

function StatCard({
  title, value, sub, icon: Icon,
  colorClass, bgClass, borderClass,
  trend, trendLabel, href,
}: {
  title: string; value: string | number; sub?: string;
  icon: any; colorClass: string; bgClass: string; borderClass: string;
  trend?: "up" | "down" | "neutral"; trendLabel?: string; href?: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground";
  const card = (
    <Card className={`border ${borderClass} ${bgClass} hover:shadow-md transition-shadow h-full`}>
      <CardContent className="p-5 h-full">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
            <p className={`text-2xl font-bold ${colorClass} leading-tight`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            {trendLabel && TrendIcon && (
              <div className={`flex items-center gap-1 mt-1.5 text-xs ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                <span>{trendLabel}</span>
              </div>
            )}
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${bgClass.replace("50","100").replace("bg-white","bg-muted")}`}>
            <Icon className={`h-5 w-5 ${colorClass}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="block h-full">{card}</Link> : card;
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleString("default", { month: "short", year: "2-digit" });
}

export default function DashboardPage() {
  const { format: fmtMoney } = useCurrency();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: statsApi.getDashboard,
  });

  const { data: finesData } = useQuery({
    queryKey: ["pending-fines"],
    queryFn: () => pendingFinesApi.getAll(),
  });

  const { data: report } = useQuery({
    queryKey: ["circ-report"],
    queryFn: fetchCirculationReport,
  });

  const monthlyTrends = (report?.monthlyTrends ?? []).map((m: any) => ({
    ...m,
    label: monthLabel(m.month),
  }));

  const topBooks: { title: string; author: string; checkouts: number }[] = report?.topBooks ?? [];
  const topBorrowers: { name: string; role: string; checkouts: number }[] = report?.topBorrowers ?? [];
  const recentRecords: any[] = (report?.records ?? []).slice(0, 5);

  const totalFinesCollectedCents = (report?.records ?? [])
    .reduce((s: number, r: any) => s + (r.finePaidAmount ?? 0), 0);

  const pendingCount = finesData?.total ?? 0;
  const pendingCents = finesData?.grandTotalCents ?? 0;

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Library operations at a glance · Updated {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Link href="/circulation">
          <Button size="sm" className="gap-2">
            <Repeat className="h-4 w-4" /> Circulation
          </Button>
        </Link>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 items-stretch mb-6">
        <StatCard
          title="Total Catalog"
          value={stats?.totalBooks ?? 0}
          sub={`${stats?.availableBooks ?? 0} available`}
          icon={Book}
          colorClass="text-blue-700"
          bgClass="bg-blue-50"
          borderClass="border-blue-100"
          href="/catalog"
        />
        <StatCard
          title="Active Loans"
          value={stats?.activeCirculation ?? 0}
          sub={`${stats?.checkedOutBooks ?? 0} copies out`}
          icon={Repeat}
          colorClass="text-violet-700"
          bgClass="bg-violet-50"
          borderClass="border-violet-100"
          href="/circulation"
        />
        <StatCard
          title="Overdue"
          value={stats?.overdueItems ?? 0}
          sub="items past due date"
          icon={AlertCircle}
          colorClass="text-amber-700"
          bgClass="bg-amber-50"
          borderClass="border-amber-100"
          trend={stats?.overdueItems ? "down" : "neutral"}
          trendLabel={stats?.overdueItems ? "Needs attention" : "All clear"}
          href="/circulation"
        />
        <StatCard
          title="Members"
          value={stats?.activeMembers ?? 0}
          sub="registered patrons"
          icon={Users}
          colorClass="text-green-700"
          bgClass="bg-green-50"
          borderClass="border-green-100"
          href="/users"
        />
        <StatCard
          title="Pending Fines"
          value={fmtMoney(pendingCents)}
          sub={`${pendingCount} member${pendingCount !== 1 ? "s" : ""} with dues`}
          icon={Banknote}
          colorClass="text-red-700"
          bgClass="bg-red-50"
          borderClass="border-red-100"
          trend={pendingCount > 0 ? "down" : "neutral"}
          trendLabel={pendingCount > 0 ? "Collection pending" : "No outstanding fines"}
          href="/circulation/pending-fines"
        />
      </div>

      {/* ── Circulation Chart + Fine Summary ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7 mb-4">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Circulation Trends</CardTitle>
            <CardDescription>Monthly checkouts vs returns</CardDescription>
          </CardHeader>
          <CardContent className="pl-1">
            <div className="h-[260px]">
              {monthlyTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrends} barGap={4} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis dataKey="label" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="checkouts" name="Checkouts" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="returns" name="Returns" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No circulation data yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Fine Overview</CardTitle>
                <CardDescription>Outstanding and collected amounts</CardDescription>
              </div>
              <Link href="/circulation/pending-fines">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">View all <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                <p className="text-xl font-bold text-red-700">{fmtMoney(pendingCents)}</p>
                <p className="text-xs text-muted-foreground">{pendingCount} member{pendingCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                <p className="text-xs text-muted-foreground mb-1">Collected</p>
                <p className="text-xl font-bold text-green-700">{fmtMoney(totalFinesCollectedCents)}</p>
                <p className="text-xs text-muted-foreground">all time</p>
              </div>
            </div>
            <Separator className="mb-3" />
            <p className="text-xs font-medium text-muted-foreground mb-2">Members with pending dues</p>
            <div className="space-y-2">
              {(finesData?.users ?? []).slice(0, 4).map((u: any) => (
                <div key={u.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                      {u.userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{u.userName}</p>
                      <p className="text-xs text-muted-foreground">{u.membershipId}</p>
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-xs shrink-0">{fmtMoney(u.totalOutstandingCents)}</Badge>
                </div>
              ))}
              {pendingCount === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-green-500" />
                  <p className="text-xs">No pending fines</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Activity + Top Books / Borrowers ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Circulation</CardTitle>
                <CardDescription>Latest checkout and return activity</CardDescription>
              </div>
              <Link href="/circulation">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">View all <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No recent activity</p>
            ) : (
              <div className="space-y-0">
                {recentRecords.map((r: any, i: number) => (
                  <div key={r.id}>
                    <div className="flex items-start gap-3 py-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${
                        r.status === "OVERDUE" ? "bg-amber-50 border-amber-200 text-amber-600" :
                        r.status === "RETURNED" ? "bg-green-50 border-green-200 text-green-600" :
                        "bg-blue-50 border-blue-200 text-blue-600"
                      }`}>
                        {r.status === "RETURNED" ? <CheckCircle2 className="h-4 w-4" /> :
                         r.status === "OVERDUE" ? <AlertCircle className="h-4 w-4" /> :
                         <BookOpen className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{r.bookTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.status === "RETURNED" ? "Returned by" : "Issued to"}{" "}
                          <span className="font-medium text-foreground">{r.borrowerName}</span>
                          {" · "}{r.libraryName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={r.status === "RETURNED" ? "secondary" : r.status === "OVERDUE" ? "destructive" : "default"} className="text-xs mb-1">
                          {r.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {r.status === "RETURNED" && r.returnDate
                            ? fmtDate(new Date(r.returnDate), "dd MMM")
                            : fmtDate(new Date(r.checkoutDate), "dd MMM")}
                        </p>
                        {r.fineAmount > 0 && (
                          <p className="text-xs text-red-600 font-medium">{fmtMoney(r.fineAmount)}</p>
                        )}
                      </div>
                    </div>
                    {i < recentRecords.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 flex flex-col gap-4">
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Borrowed Books</CardTitle>
              <CardDescription>Most checked-out titles</CardDescription>
            </CardHeader>
            <CardContent>
              {topBooks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {topBooks.slice(0, 4).map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground/40 w-5 text-center shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{b.author}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5">
                        <Repeat className="h-3 w-3" />
                        <span className="text-xs font-bold">{b.checkouts}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Borrowers</CardTitle>
              <CardDescription>Most active patrons</CardDescription>
            </CardHeader>
            <CardContent>
              {topBorrowers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {topBorrowers.slice(0, 4).map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.name}</p>
                        <Badge variant="outline" className="text-xs mt-0.5">{b.role}</Badge>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-violet-700">{b.checkouts}</p>
                        <p className="text-xs text-muted-foreground">books</p>
                      </div>
                    </div>
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
