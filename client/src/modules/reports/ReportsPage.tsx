import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Download, AlertCircle, Coins, TrendingUp, FileX, Loader2 } from "lucide-react";
import { useCurrency } from "@/lib/useCurrency";
import { useQuery } from "@tanstack/react-query";
import { finesReportApi, librariesApi, paymentMethodsApi } from "@/lib/api";

const monthlyData = [
  { name: 'Jan', issues: 400, returns: 350 },
  { name: 'Feb', issues: 300, returns: 280 },
  { name: 'Mar', issues: 550, returns: 500 },
  { name: 'Apr', issues: 450, returns: 420 },
  { name: 'May', issues: 600, returns: 580 },
  { name: 'Jun', issues: 350, returns: 340 },
];

const categoryData = [
  { name: 'Computer Science', value: 450, color: 'hsl(var(--chart-1))' },
  { name: 'Fiction', value: 320, color: 'hsl(var(--chart-2))' },
  { name: 'History', value: 210, color: 'hsl(var(--chart-3))' },
  { name: 'Science', value: 180, color: 'hsl(var(--chart-4))' },
  { name: 'Biography', value: 150, color: 'hsl(var(--chart-5))' },
];

const PIE_COLORS = ['hsl(var(--chart-1))','hsl(var(--chart-2))','hsl(var(--chart-3))','hsl(var(--chart-4))','hsl(var(--chart-5))'];

function FinesAndRevenue() {
  const { format, currency } = useCurrency();
  const today = new Date();
  const monthAgo = new Date(today); monthAgo.setDate(today.getDate() - 30);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [libraryId, setLibraryId] = useState<string>("ALL");
  const [methodId, setMethodId] = useState<string>("ALL");
  const [type, setType] = useState<string>("ALL");

  const { data: libraries = [] } = useQuery({ queryKey: ["libraries"], queryFn: () => librariesApi.getAll() });
  const { data: methods = [] } = useQuery({ queryKey: ["payment-methods"], queryFn: () => paymentMethodsApi.getAll(false) });

  const filters = {
    from, to,
    libraryId: libraryId !== "ALL" ? parseInt(libraryId) : undefined,
    methodId: methodId !== "ALL" ? parseInt(methodId) : undefined,
    type: type !== "ALL" ? (type as 'FINE' | 'DAMAGE') : undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["fines-revenue", filters],
    queryFn: () => finesReportApi.get(filters),
  });

  const exportCsv = () => {
    if (!data?.payments?.length) return;
    const rows = [
      ["Date","Type","Method","Book","Borrower","Library","Amount","Reference","Collected by"],
      ...data.payments.map((p: any) => [
        new Date(p.paidAt).toISOString(),
        p.paymentType, p.methodName, p.bookTitle ?? "",
        p.borrowerName ?? "", p.libraryName ?? "",
        (p.amount / 100).toFixed(2), p.referenceNumber ?? "", p.collectorName ?? "",
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `fines-revenue-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-6">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="input-from" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="input-to" />
            </div>
            <div>
              <Label className="text-xs">Library</Label>
              <Select value={libraryId} onValueChange={setLibraryId}>
                <SelectTrigger data-testid="select-library"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All libraries</SelectItem>
                  {libraries.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment Method</Label>
              <Select value={methodId} onValueChange={setMethodId}>
                <SelectTrigger data-testid="select-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All methods</SelectItem>
                  {methods.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Fine + Damage</SelectItem>
                  <SelectItem value="FINE">Fine only</SelectItem>
                  <SelectItem value="DAMAGE">Damage only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={exportCsv} disabled={!data?.payments?.length} className="gap-2 w-full" data-testid="button-export-csv">
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5"><Coins className="h-3.5 w-3.5" />Total collected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-collected">{format(data.totals.collected)}</div>
                <p className="text-xs text-muted-foreground mt-1">{data.totals.paymentCount} payments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5 text-amber-600" />Outstanding</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600" data-testid="stat-outstanding">{format(data.totals.outstanding)}</div>
                <p className="text-xs text-muted-foreground mt-1">Across active &amp; returned</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5"><FileX className="h-3.5 w-3.5 text-blue-600" />Waived</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="stat-waived">{format(data.totals.waived)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Damage recovery</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-damage">{format(data.totals.damageCollected)}</div>
                <p className="text-xs text-muted-foreground mt-1">Fine: {format(data.totals.fineCollected)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily collections</CardTitle>
                <CardDescription>Total payments collected per day</CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                <div className="h-[300px]">
                  {data.timeSeries.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No payments in period</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.timeSeries.map((p: any) => ({ ...p, amount: p.amount / 100 }))} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${currency.symbol}${v}`} />
                        <Tooltip formatter={(v: any) => [`${currency.symbol}${v}`, "Collected"]} />
                        <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By payment method</CardTitle>
                <CardDescription>Distribution of collections per method</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {data.byMethod.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.byMethod.map((m: any) => ({ name: m.methodName, value: m.total / 100 }))}
                          cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={2}>
                          {data.byMethod.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => `${currency.symbol}${v}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* By library */}
          {data.byLibrary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Collections by library</CardTitle>
              </CardHeader>
              <CardContent className="pl-0">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byLibrary.map((b: any) => ({ name: b.libraryName, amount: b.total / 100 }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${currency.symbol}${v}`} />
                      <Tooltip formatter={(v: any) => `${currency.symbol}${v}`} />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transactions table */}
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>{data.payments.length} payment{data.payments.length === 1 ? "" : "s"} in period</CardDescription>
            </CardHeader>
            <CardContent>
              {data.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No payments match these filters.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Book</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Library</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.payments.map((p: any) => (
                      <TableRow key={p.id} data-testid={`row-payment-${p.id}`}>
                        <TableCell className="text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={p.paymentType === "FINE" ? "default" : "secondary"}>{p.paymentType}</Badge></TableCell>
                        <TableCell className="text-sm">{p.methodName}</TableCell>
                        <TableCell className="text-sm">{p.bookTitle ?? "—"}</TableCell>
                        <TableCell className="text-sm">{p.borrowerName ?? "—"}</TableCell>
                        <TableCell className="text-sm">{p.libraryName ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{format(p.amount)}</TableCell>
                        <TableCell className="text-xs font-mono">{p.referenceNumber ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export default function ReportsPage() {
  const { currency } = useCurrency();

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Detailed insights into library usage and performance.</p>
        </div>
      </div>

      <Tabs defaultValue="circulation" className="w-full">
        <TabsList>
          <TabsTrigger value="circulation">Circulation</TabsTrigger>
          <TabsTrigger value="acquisitions">Acquisitions</TabsTrigger>
          <TabsTrigger value="fines" data-testid="tab-fines">Fines & Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="circulation" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Circulation Trends</CardTitle>
                <CardDescription>Checkouts vs Returns over time</CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <Legend />
                      <Bar dataKey="issues" name="Issues" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="returns" name="Returns" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Popular Categories</CardTitle>
                <CardDescription>Distribution of borrowed items by genre</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={2} dataKey="value">
                        {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="acquisitions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Acquisitions report</CardTitle>
              <CardDescription>Coming soon</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-6 text-center">No data available yet.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fines">
          <FinesAndRevenue />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
