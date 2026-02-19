import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { auditLogsApi } from "@/lib/api";
import { ChevronLeft, ChevronRight, X, Search, Loader2 } from "lucide-react";

const CATEGORIES = [
  "AUTHENTICATION",
  "USER_MANAGEMENT",
  "CATALOG",
  "CIRCULATION",
  "FINES",
  "INVENTORY",
  "REPORTS",
  "ERP_INTEGRATION",
  "SYSTEM_CONFIG",
  "STAFF_ALLOCATION",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  AUTHENTICATION: "bg-blue-100 text-blue-800 border-blue-200",
  USER_MANAGEMENT: "bg-purple-100 text-purple-800 border-purple-200",
  CATALOG: "bg-green-100 text-green-800 border-green-200",
  CIRCULATION: "bg-orange-100 text-orange-800 border-orange-200",
  FINES: "bg-red-100 text-red-800 border-red-200",
  INVENTORY: "bg-yellow-100 text-yellow-800 border-yellow-200",
  REPORTS: "bg-indigo-100 text-indigo-800 border-indigo-200",
  ERP_INTEGRATION: "bg-teal-100 text-teal-800 border-teal-200",
  SYSTEM_CONFIG: "bg-gray-100 text-gray-800 border-gray-200",
  STAFF_ALLOCATION: "bg-pink-100 text-pink-800 border-pink-200",
};

const PAGE_SIZE = 25;

function formatTimestamp(ts: string | Date) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuditLogsPage() {
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const filters = {
    category: category || undefined,
    status: status || undefined,
    search: search || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", category, status, search, startDate, endDate, page],
    queryFn: () => auditLogsApi.query(filters),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const clearFilters = () => {
    setCategory("");
    setStatus("");
    setSearch("");
    setStartDate("");
    setEndDate("");
    setPage(0);
  };

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const hasFilters = category || status || search || startDate || endDate;

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-description">
            Track all system activities and security events
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-48">
              <Select value={category} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setPage(0); }}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-36">
              <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(0); }}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="SUCCESS">SUCCESS</SelectItem>
                  <SelectItem value="FAILURE">FAILURE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-56 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="input-search"
                placeholder="Search logs..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <Input
                data-testid="input-start-date"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                className="w-40"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                data-testid="input-end-date"
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                className="w-40"
              />
            </div>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                data-testid="button-clear-filters"
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <p className="text-sm text-muted-foreground" data-testid="text-results-count">
              {total} result{total !== 1 ? "s" : ""} found
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground" data-testid="text-no-results">
              No audit logs found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[160px]">Category</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[140px]">User</TableHead>
                  <TableHead className="w-[120px]">Target</TableHead>
                  <TableHead className="w-[130px]">IP Address</TableHead>
                  <TableHead className="w-[80px]">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <>
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRow(log.id)}
                      data-testid={`row-audit-log-${log.id}`}
                    >
                      <TableCell className="text-sm font-mono">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={CATEGORY_COLORS[log.category] || ""}
                          data-testid={`badge-category-${log.id}`}
                        >
                          {log.category.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{log.action}</TableCell>
                      <TableCell>
                        <Badge
                          variant={log.status === "SUCCESS" ? "default" : "destructive"}
                          className={
                            log.status === "SUCCESS"
                              ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100"
                              : "bg-red-100 text-red-800 border-red-200 hover:bg-red-100"
                          }
                          data-testid={`badge-status-${log.id}`}
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.userName || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {log.targetType && log.targetId
                          ? `${log.targetType}:${log.targetId}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-xs">
                        {log.ipAddress || "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-expand-${log.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(log.id);
                          }}
                        >
                          {expandedRows.has(log.id) ? "▲" : "▼"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(log.id) && (
                      <TableRow key={`${log.id}-details`}>
                        <TableCell colSpan={8} className="bg-muted/30 p-4">
                          <div className="space-y-3 text-sm" data-testid={`details-audit-log-${log.id}`}>
                            {log.details ? (
                              <div>
                                <span className="font-semibold text-muted-foreground">Details:</span>
                                <pre className="mt-1 p-3 bg-background rounded-md border text-xs overflow-x-auto">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            ) : null}
                            {log.errorMessage && (
                              <div>
                                <span className="font-semibold text-red-600">Error:</span>
                                <p className="mt-1 text-red-700 bg-red-50 p-2 rounded-md border border-red-200">
                                  {log.errorMessage}
                                </p>
                              </div>
                            )}
                            {log.userAgent && (
                              <div>
                                <span className="font-semibold text-muted-foreground">User Agent:</span>
                                <p className="mt-1 text-xs text-muted-foreground font-mono break-all">
                                  {log.userAgent}
                                </p>
                              </div>
                            )}
                            {!log.details && !log.errorMessage && !log.userAgent && (
                              <p className="text-muted-foreground italic">No additional details available</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                data-testid="button-previous-page"
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground" data-testid="text-page-info">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                data-testid="button-next-page"
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
