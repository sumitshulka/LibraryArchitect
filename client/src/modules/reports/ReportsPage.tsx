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
import { Download, AlertCircle, Coins, TrendingUp, FileX, Loader2, BarChart2, X, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCurrency } from "@/lib/useCurrency";
import { useQuery } from "@tanstack/react-query";
import { finesReportApi, librariesApi, paymentMethodsApi, acquisitionsReportApi, circulationReportApi, usersApi } from "@/lib/api";

const PIE_COLORS = ['hsl(var(--chart-1))','hsl(var(--chart-2))','hsl(var(--chart-3))','hsl(var(--chart-4))','hsl(var(--chart-5))'];

function UserSearchCombobox({ users, value, onChange, testId }: {
  users: any[];
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  testId?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = value !== undefined ? users.find(u => u.id === value) : null;
  const filtered = query.trim()
    ? users.filter(u =>
        `${u.name} ${u.username} ${u.studentId ?? ''} ${u.employeeId ?? ''}`.toLowerCase()
          .includes(query.toLowerCase())
      ).slice(0, 8)
    : users.slice(0, 8);

  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center gap-1 h-9 px-3 rounded-md border bg-background text-sm">
          <span className="flex-1 truncate font-medium">{selected.name}</span>
          <span className="text-xs text-muted-foreground mr-1">{selected.role}</span>
          <button
            type="button"
            onClick={() => { onChange(undefined); setQuery(""); }}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
            data-testid={testId ? `${testId}-clear` : undefined}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-9"
            placeholder="Search borrower…"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 160)}
            data-testid={testId}
          />
        </div>
      )}
      {open && !selected && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[220px] rounded-md border bg-popover shadow-md max-h-52 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No users found</div>
          ) : filtered.map((u: any) => (
            <button
              key={u.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2"
              onMouseDown={() => { onChange(u.id); setQuery(""); setOpen(false); }}
            >
              <span className="truncate">{u.name}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">{u.role}</span>
            </button>
          ))}
          {users.length > 8 && !query.trim() && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-t">Type to search all {users.length} users</div>
          )}
        </div>
      )}
    </div>
  );
}

function FinesAndRevenue() {
  const { format, currency } = useCurrency();
  const today = new Date();
  const monthAgo = new Date(today); monthAgo.setDate(today.getDate() - 30);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [libraryId, setLibraryId] = useState<string>("ALL");
  const [methodId, setMethodId] = useState<string>("ALL");
  const [type, setType] = useState<string>("ALL");
  const [userId, setUserId] = useState<number | undefined>(undefined);

  const { data: libraries = [] } = useQuery({ queryKey: ["libraries"], queryFn: () => librariesApi.getAll() });
  const { data: methods = [] } = useQuery({ queryKey: ["payment-methods"], queryFn: () => paymentMethodsApi.getAll(false) });
  const { data: allUsers = [] } = useQuery({ queryKey: ["all-users"], queryFn: () => usersApi.getAll() });

  const filters = {
    from, to,
    libraryId: libraryId !== "ALL" ? parseInt(libraryId) : undefined,
    methodId: methodId !== "ALL" ? parseInt(methodId) : undefined,
    type: type !== "ALL" ? (type as 'FINE' | 'DAMAGE') : undefined,
    userId,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["fines-revenue", filters],
    queryFn: () => finesReportApi.get(filters),
  });

  const exportCsv = () => {
    if (!data?.payments?.length) return;
    const rows: Array<Array<string | number>> = [
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
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
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
            <div>
              <Label className="text-xs">Borrower</Label>
              <UserSearchCombobox users={allUsers} value={userId} onChange={setUserId} testId="input-fines-user" />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" onClick={exportCsv} disabled={!data?.payments?.length} className="gap-2" data-testid="button-export-csv">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
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

function CirculationReport() {
  const { format } = useCurrency();
  const today = new Date();
  const yearAgo = new Date(today); yearAgo.setFullYear(today.getFullYear() - 1);
  const [from, setFrom] = useState(yearAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [libraryId, setLibraryId] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [userId, setUserId] = useState<number | undefined>(undefined);
  const [chartsOpen, setChartsOpen] = useState(false);

  const { data: libraries = [] } = useQuery({ queryKey: ["libraries"], queryFn: () => librariesApi.getAll() });
  const { data: allUsers = [] } = useQuery({ queryKey: ["all-users"], queryFn: () => usersApi.getAll() });

  const filters = {
    from, to,
    libraryId: libraryId !== "ALL" ? parseInt(libraryId) : undefined,
    status: status !== "ALL" ? status : undefined,
    userId,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["circulation-report", filters],
    queryFn: () => circulationReportApi.get(filters),
  });

  const exportCsv = () => {
    if (!data?.records?.length) return;
    const rows = [
      ["Checkout Date", "Due Date", "Return Date", "Status", "Overdue", "Loan Days", "Title", "ISBN", "Author", "Category", "Borrower", "Role", "Library", "Renewals", "Fine Amount"],
      ...data.records.map((r: any) => [
        new Date(r.checkoutDate).toISOString().slice(0, 10),
        new Date(r.dueDate).toISOString().slice(0, 10),
        r.returnDate ? new Date(r.returnDate).toISOString().slice(0, 10) : "",
        r.status, r.isOverdue ? "Yes" : "No", r.loanDays ?? "",
        r.bookTitle, r.bookIsbn, r.author, r.category,
        r.borrowerName, r.borrowerRole, r.libraryName,
        r.renewalCount, (r.fineAmount / 100).toFixed(2),
      ]),
    ];
    const csv = rows.map((r: any[]) => r.map((x: any) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `circulation-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow by date range, library, or status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} data-testid="input-circ-from" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} data-testid="input-circ-to" />
            </div>
            <div>
              <Label className="text-xs">Library</Label>
              <Select value={libraryId} onValueChange={setLibraryId}>
                <SelectTrigger data-testid="select-circ-library"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All libraries</SelectItem>
                  {libraries.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-circ-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="RETURNED">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Borrower</Label>
              <UserSearchCombobox users={allUsers} value={userId} onChange={setUserId} testId="input-circ-user" />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : !data ? null : (
        <>
          {/* KPI cards + action buttons */}
          <div className="flex flex-wrap gap-4 items-stretch">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5 flex-1">
              <Card>
                <CardHeader className="pb-2"><CardDescription>Total Checkouts</CardDescription></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-circ-total">{data.totals.totalCheckouts}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Currently Active</CardDescription></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-circ-active">{data.totals.activeCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Returned</CardDescription></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-circ-returned">{data.totals.returnedCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Overdue</CardDescription></CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${data.totals.overdueCount > 0 ? "text-destructive" : ""}`} data-testid="text-circ-overdue">{data.totals.overdueCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Avg Loan Days</CardDescription></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-circ-avg-days">{data.totals.avgLoanDays > 0 ? data.totals.avgLoanDays : "—"}</div>
                </CardContent>
              </Card>
            </div>
            <div className="flex items-stretch gap-2">
              <Button className="h-full flex flex-col gap-1 px-5 bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setChartsOpen(true)} data-testid="button-circ-charts">
                <BarChart2 className="w-5 h-5" />
                <span className="text-xs">Analytics</span>
              </Button>
              <Button onClick={exportCsv} disabled={!data.records.length} className="h-full flex flex-col gap-1 px-5 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-circ-export">
                <Download className="w-5 h-5" />
                <span className="text-xs">Export CSV</span>
              </Button>
            </div>
          </div>

          {/* Transaction detail table */}
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                {data.records.length} {data.records.length === 1 ? "record" : "records"} match the current filters
                {data.records.length > 500 ? " — showing first 500, export CSV for all" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {data.records.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No transactions match the selected filters.</p>
              ) : (
                <div className="overflow-auto max-h-[560px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Checkout Date</TableHead>
                        <TableHead>Title / Author</TableHead>
                        <TableHead>Borrower</TableHead>
                        <TableHead>Library</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Return Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Loan Days</TableHead>
                        <TableHead className="text-right">Renewals</TableHead>
                        <TableHead className="text-right">Fine</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.records.slice(0, 500).map((r: any) => (
                        <TableRow key={r.id} data-testid={`row-circ-${r.id}`} className={r.isOverdue ? "bg-destructive/5" : ""}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(r.checkoutDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm min-w-[180px]">
                            <div className="font-medium">{r.bookTitle}</div>
                            <div className="text-xs text-muted-foreground">{r.author}</div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{r.borrowerName}</div>
                            <div className="text-xs text-muted-foreground">{r.borrowerRole}</div>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{r.libraryName}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(r.dueDate).toLocaleDateString()}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                            {r.returnDate ? new Date(r.returnDate).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.isOverdue ? "destructive" : r.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">
                              {r.isOverdue ? "OVERDUE" : r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{r.loanDays ?? "—"}</TableCell>
                          <TableCell className="text-right">{r.renewalCount}</TableCell>
                          <TableCell className="text-right font-semibold">{r.fineAmount > 0 ? format(r.fineAmount) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analytics sheet */}
          <Sheet open={chartsOpen} onOpenChange={setChartsOpen}>
            <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
              <SheetHeader className="px-6 pt-6 pb-4 border-b">
                <SheetTitle>Circulation Analytics</SheetTitle>
                <SheetDescription>Visual breakdowns for the current filter selection ({data.totals.totalCheckouts} transactions).</SheetDescription>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-100px)]">
                <div className="px-6 py-4 space-y-8">

                  {/* Monthly trend */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Monthly Checkouts vs Returns</h3>
                    <div className="h-[260px]">
                      {data.monthlyTrends.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">No data in this range.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.monthlyTrends}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="checkouts" name="Checkouts" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="returns" name="Returns" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* By category pie */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Checkouts by Category</h3>
                    <div className="h-[230px]">
                      {data.byCategory.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No data.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={data.byCategory.slice(0, 7).map((c: any) => ({ name: c.category, value: c.count }))}
                                 cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                              {data.byCategory.slice(0, 7).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={32} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* By library */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">By Library</h3>
                    {data.byLibrary.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No data.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Library</TableHead>
                            <TableHead className="text-right">Checkouts</TableHead>
                            <TableHead className="text-right">Returned</TableHead>
                            <TableHead className="text-right">Overdue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.byLibrary.map((r: any) => (
                            <TableRow key={r.libraryId} data-testid={`row-circ-lib-${r.libraryId}`}>
                              <TableCell className="text-sm">{r.libraryName}</TableCell>
                              <TableCell className="text-right">{r.checkouts}</TableCell>
                              <TableCell className="text-right">{r.returns}</TableCell>
                              <TableCell className={`text-right font-semibold ${r.overdue > 0 ? "text-destructive" : ""}`}>{r.overdue}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {/* Top books */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Most Borrowed Books</h3>
                    {data.topBooks.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No data.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Checkouts</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.topBooks.map((b: any) => (
                            <TableRow key={b.bookId} data-testid={`row-circ-book-${b.bookId}`}>
                              <TableCell className="text-sm">
                                <div className="font-medium">{b.title}</div>
                                <div className="text-xs text-muted-foreground">{b.author}</div>
                              </TableCell>
                              <TableCell className="text-sm">{b.category || "—"}</TableCell>
                              <TableCell className="text-right font-semibold">{b.checkouts}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {/* Top borrowers */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Most Active Borrowers</h3>
                    {data.topBorrowers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No data.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Borrower</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Checkouts</TableHead>
                            <TableHead className="text-right">Overdue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.topBorrowers.map((u: any) => (
                            <TableRow key={u.userId} data-testid={`row-circ-borrower-${u.userId}`}>
                              <TableCell className="text-sm font-medium">{u.name}</TableCell>
                              <TableCell className="text-sm">{u.role}</TableCell>
                              <TableCell className="text-right">{u.checkouts}</TableCell>
                              <TableCell className={`text-right font-semibold ${u.overdue > 0 ? "text-destructive" : ""}`}>{u.overdue}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}

function AcqBreakdownTable({ rows, format }: { rows: any[]; format: (v: number) => string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground text-center py-4">No data.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Copies</TableHead>
          <TableHead className="text-right">Titles</TableHead>
          <TableHead className="text-right">Spend</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r: any) => (
          <TableRow key={String(r.key)}>
            <TableCell className="text-sm">{r.label || "—"}</TableCell>
            <TableCell className="text-right">{r.copies}</TableCell>
            <TableCell className="text-right">{r.titles}</TableCell>
            <TableCell className="text-right font-semibold">{format(r.spend)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AcquisitionsReport() {
  const { format } = useCurrency();
  const today = new Date();
  const yearAgo = new Date(today); yearAgo.setFullYear(today.getFullYear() - 1);
  const [from, setFrom] = useState(yearAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [libraryId, setLibraryId] = useState<string>("ALL");
  const [source, setSource] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [condition, setCondition] = useState<string>("ALL");
  const [fmt, setFmt] = useState<string>("ALL");
  const [q, setQ] = useState<string>("");
  const [chartsOpen, setChartsOpen] = useState(false);

  const { data: libraries = [] } = useQuery({ queryKey: ["libraries"], queryFn: () => librariesApi.getAll() });

  const filters = {
    from, to,
    libraryId: libraryId !== "ALL" ? parseInt(libraryId) : undefined,
    source: source !== "ALL" ? source : undefined,
    category: category !== "ALL" ? category : undefined,
    status: status !== "ALL" ? status : undefined,
    condition: condition !== "ALL" ? condition : undefined,
    format: fmt !== "ALL" ? fmt : undefined,
    q: q.trim() || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["acquisitions-report", filters],
    queryFn: () => acquisitionsReportApi.get(filters),
  });

  const activeFilterCount = [source, category, status, condition, fmt].filter(v => v !== "ALL").length + (q.trim() ? 1 : 0);

  const exportCsv = () => {
    if (!data?.copies?.length) return;
    const rows = [
      ["Acquisition Date", "Barcode", "Title", "ISBN", "Author", "Category", "Format", "Library", "Source", "Price", "Price Source", "Status", "Condition"],
      ...data.copies.map((c: any) => [
        c.acquisitionDate ? new Date(c.acquisitionDate).toISOString().slice(0, 10) : "",
        c.barcode, c.bookTitle, c.bookIsbn, c.author, c.category, c.format,
        c.libraryName, c.acquisitionSource, (c.price / 100).toFixed(2), c.priceSource,
        c.status, c.condition ?? "",
      ]),
    ];
    const csv = rows.map((r: any[]) => r.map((x: any) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `acquisitions-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSource("ALL"); setCategory("ALL"); setStatus("ALL");
    setCondition("ALL"); setFmt("ALL"); setQ("");
  };

  return (
    <div className="space-y-4">
      {/* Filters card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Narrow down acquired copies by any combination of fields.</CardDescription>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters} data-testid="button-acq-reset">
                <X className="w-3 h-3 mr-1" /> Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Row 1: date range + search */}
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="input-acq-from" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="input-acq-to" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Search title / author / ISBN / barcode</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="e.g. Carnegie, 978-…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  data-testid="input-acq-search"
                />
              </div>
            </div>
          </div>
          {/* Row 2: dropdowns */}
          <div className="grid gap-3 md:grid-cols-5">
            <div>
              <Label className="text-xs">Library</Label>
              <Select value={libraryId} onValueChange={setLibraryId}>
                <SelectTrigger data-testid="select-acq-library"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All libraries</SelectItem>
                  {libraries.map((l: any) => (<SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger data-testid="select-acq-source"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All sources</SelectItem>
                  {(data?.filters?.sources ?? []).map((s: string) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-acq-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All categories</SelectItem>
                  {(data?.filters?.categories ?? []).map((c: string) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-acq-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  {(data?.filters?.statuses ?? []).map((s: string) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger data-testid="select-acq-condition"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All conditions</SelectItem>
                  {(data?.filters?.conditions ?? []).map((c: string) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <div>
              <Label className="text-xs">Format</Label>
              <Select value={fmt} onValueChange={setFmt}>
                <SelectTrigger data-testid="select-acq-format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All formats</SelectItem>
                  {(data?.filters?.formats ?? []).map((f: string) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : !data ? null : (
        <>
          {/* KPI cards + analytics button */}
          <div className="flex flex-wrap gap-4 items-stretch">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 flex-1">
              <Card>
                <CardHeader className="pb-2"><CardDescription>Total Spend</CardDescription></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-acq-total-spend">{format(data.totals.totalSpend)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{data.totals.pricedCopies} priced copies</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Avg Unit Price</CardDescription></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-acq-avg-price">{format(data.totals.avgUnitPrice)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Copies Acquired</CardDescription></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-acq-total-copies">{data.totals.totalCopies}</div>
                  <p className="text-xs text-muted-foreground mt-1">{data.totals.datedCopies} with acq. dates</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Unique Titles</CardDescription></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-acq-unique-titles">{data.totals.uniqueTitles}</div>
                </CardContent>
              </Card>
            </div>
            <div className="flex items-stretch gap-2">
              <Button
                className="h-full flex flex-col gap-1 px-5 bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => setChartsOpen(true)}
                data-testid="button-acq-charts"
              >
                <BarChart2 className="w-5 h-5" />
                <span className="text-xs">Analytics</span>
              </Button>
              <Button onClick={exportCsv} disabled={!data.copies.length} className="h-full flex flex-col gap-1 px-5 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-acq-export">
                <Download className="w-5 h-5" />
                <span className="text-xs">Export CSV</span>
              </Button>
            </div>
          </div>

          {/* Copies detail table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Acquired Copies</CardTitle>
                  <CardDescription>
                    {data.copies.length} {data.copies.length === 1 ? "copy" : "copies"} match the current filters
                    {data.copies.length > 500 ? " — showing first 500, export CSV for full data" : ""}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {data.copies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No copies match the selected filters.</p>
              ) : (
                <div className="overflow-auto max-h-[560px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Acq. Date</TableHead>
                        <TableHead>Title / Author</TableHead>
                        <TableHead>Barcode</TableHead>
                        <TableHead>Library</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Format</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Condition</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.copies.slice(0, 500).map((c: any) => (
                        <TableRow key={c.id} data-testid={`row-acq-copy-${c.id}`}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {c.acquisitionDate ? new Date(c.acquisitionDate).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-sm min-w-[180px]">
                            <div className="font-medium">{c.bookTitle}</div>
                            <div className="text-xs text-muted-foreground">{c.author}</div>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{c.barcode}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{c.libraryName}</TableCell>
                          <TableCell className="text-sm">{c.acquisitionSource || "—"}</TableCell>
                          <TableCell className="text-sm">{c.category || "—"}</TableCell>
                          <TableCell className="text-sm">{c.format || "—"}</TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">
                            {format(c.price)}
                            {c.priceSource === "book" && (
                              <span className="text-xs text-muted-foreground ml-1" title="Price from book record">*</span>
                            )}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{c.status}</Badge></TableCell>
                          <TableCell className="text-sm">{c.condition || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analytics right-side sheet */}
          <Sheet open={chartsOpen} onOpenChange={setChartsOpen}>
            <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
              <SheetHeader className="px-6 pt-6 pb-4 border-b">
                <SheetTitle>Analytics</SheetTitle>
                <SheetDescription>Visual breakdowns for the current filter selection ({data.totals.totalCopies} copies).</SheetDescription>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-100px)]">
                <div className="px-6 py-4 space-y-8">

                  {/* Monthly trend */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Monthly Acquisition Trend</h3>
                    <div className="h-[240px]">
                      {data.timeSeries.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">No dated acquisitions in this range.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.timeSeries.map((s: any) => ({ ...s, spend: +(s.spend / 100).toFixed(2) }))}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="spend" name="Spend" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="copies" name="Copies" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Spend by source pie */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Spend by Source</h3>
                    <div className="h-[220px]">
                      {data.bySource.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No data.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={data.bySource.slice(0, 7).map((s: any) => ({ name: s.label, value: +(s.spend / 100).toFixed(2) }))}
                                 cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                              {data.bySource.slice(0, 7).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={32} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* By Library */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">By Library</h3>
                    <AcqBreakdownTable rows={data.byLibrary} format={format} />
                  </div>

                  {/* By Category */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">By Category</h3>
                    <AcqBreakdownTable rows={data.byCategory} format={format} />
                  </div>

                  {/* By Format */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">By Format</h3>
                    <AcqBreakdownTable rows={data.byFormat} format={format} />
                  </div>

                  {/* By Status */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">By Copy Status</h3>
                    <AcqBreakdownTable rows={data.byStatus} format={format} />
                  </div>

                  {/* By Condition */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">By Condition</h3>
                    <AcqBreakdownTable rows={data.byCondition} format={format} />
                  </div>

                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </>
      )}
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

        <TabsContent value="circulation" className="mt-6">
          <CirculationReport />
        </TabsContent>

        <TabsContent value="acquisitions" className="mt-6">
          <AcquisitionsReport />
        </TabsContent>

        <TabsContent value="fines">
          <FinesAndRevenue />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
