import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, Search, Plus, MoreHorizontal, Filter, RefreshCw,
  CheckCircle2, Clock, FileText, Wrench, Trash2, DollarSign,
  ClipboardList, BookOpen, User, ChevronDown, X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCurrency } from "@/lib/useCurrency";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportStatus = "REPORTED" | "UNDER_REVIEW" | "FINE_PENDING" | "REPLACEMENT_PENDING" | "RESOLVED" | "CLOSED";
type ReportType = "LOST" | "DAMAGED";
type Resolution = "FOUND" | "REPAIRED" | "REPLACED" | "WRITTEN_OFF" | "FINE_RECOVERED" | "FINE_WAIVED";

interface Report {
  id: number;
  type: ReportType;
  status: ReportStatus;
  bookId: number;
  bookTitle: string;
  bookIsbn: string;
  bookCopyId: number | null;
  bookCopyAccession: string | null;
  circulationId: number | null;
  patronId: number | null;
  patronName: string | null;
  libraryId: number | null;
  libraryName: string | null;
  reportDate: string;
  description: string | null;
  fineAmount: number;
  finePaidAmount: number;
  fineWaivedAmount: number;
  replacementRequired: boolean;
  replacementCost: number;
  resolution: Resolution | null;
  resolvedAt: string | null;
  resolvedNotes: string | null;
  createdAt: string;
  createdByName: string | null;
  history?: HistoryEntry[];
}

interface HistoryEntry {
  id: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  notes: string | null;
  performedByName: string | null;
  performedAt: string;
}

interface Book { id: number; title: string; isbn: string; author: string; }
interface BookCopy { id: number; barcode: string; bookId: number; internalSSN?: string; }
interface LibraryUser { id: number; name: string; role: string; email: string; }
interface Library { id: number; name: string; code: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string }> = {
  REPORTED: { label: "Reported", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  UNDER_REVIEW: { label: "Under Review", color: "bg-blue-100 text-blue-800 border-blue-200" },
  FINE_PENDING: { label: "Fine Pending", color: "bg-orange-100 text-orange-800 border-orange-200" },
  REPLACEMENT_PENDING: { label: "Replacement Pending", color: "bg-purple-100 text-purple-800 border-purple-200" },
  RESOLVED: { label: "Resolved", color: "bg-green-100 text-green-800 border-green-200" },
  CLOSED: { label: "Closed", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

const RESOLUTION_CONFIG: Record<Resolution, { label: string; icon: React.ReactNode }> = {
  FOUND: { label: "Marked as Found", icon: <CheckCircle2 className="h-3 w-3" /> },
  REPAIRED: { label: "Repaired", icon: <Wrench className="h-3 w-3" /> },
  REPLACED: { label: "Replaced", icon: <RefreshCw className="h-3 w-3" /> },
  WRITTEN_OFF: { label: "Written Off", icon: <Trash2 className="h-3 w-3" /> },
  FINE_RECOVERED: { label: "Fine Recovered", icon: <DollarSign className="h-3 w-3" /> },
  FINE_WAIVED: { label: "Fine Waived", icon: <X className="h-3 w-3" /> },
};

const STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  REPORTED: ["UNDER_REVIEW", "FINE_PENDING", "CLOSED"],
  UNDER_REVIEW: ["FINE_PENDING", "REPLACEMENT_PENDING", "RESOLVED", "CLOSED"],
  FINE_PENDING: ["UNDER_REVIEW", "REPLACEMENT_PENDING", "RESOLVED", "CLOSED"],
  REPLACEMENT_PENDING: ["FINE_PENDING", "RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

// ─── API ──────────────────────────────────────────────────────────────────────

async function apiJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

// ─── Create Report Dialog ────────────────────────────────────────────────────

function CreateReportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<ReportType>("LOST");
  const [bookId, setBookId] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [copyId, setCopyId] = useState("");
  const [patronId, setPatronId] = useState("");
  const [patronSearch, setPatronSearch] = useState("");
  const [selectedPatron, setSelectedPatron] = useState<LibraryUser | null>(null);
  const [libraryId, setLibraryId] = useState("");
  const [description, setDescription] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [replacementRequired, setReplacementRequired] = useState(false);
  const [replacementCost, setReplacementCost] = useState("");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split("T")[0]);

  const { data: books = [] } = useQuery<Book[]>({
    queryKey: ["books"],
    queryFn: () => apiJson("/api/books"),
  });

  const { data: libraries = [] } = useQuery<Library[]>({
    queryKey: ["libraries"],
    queryFn: () => apiJson("/api/libraries"),
  });

  const { data: users = [] } = useQuery<LibraryUser[]>({
    queryKey: ["users"],
    queryFn: () => apiJson("/api/users"),
  });

  const { data: copies = [] } = useQuery<BookCopy[]>({
    queryKey: ["book-copies-all", selectedBook?.id],
    queryFn: () => selectedBook ? apiJson(`/api/books/${selectedBook.id}/copies`) : Promise.resolve([]),
    enabled: !!selectedBook,
  });

  const filteredBooks = bookSearch ? books.filter(b =>
    b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.isbn.toLowerCase().includes(bookSearch.toLowerCase())
  ).slice(0, 8) : [];

  const filteredPatrons = patronSearch ? users.filter(u =>
    u.name.toLowerCase().includes(patronSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(patronSearch.toLowerCase())
  ).filter(u => ["STUDENT", "FACULTY"].includes(u.role)).slice(0, 8) : [];

  const mutation = useMutation({
    mutationFn: () => apiJson("/api/lost-damaged", {
      method: "POST",
      body: JSON.stringify({
        type,
        bookId: parseInt(bookId),
        bookCopyId: copyId ? parseInt(copyId) : null,
        patronId: patronId ? parseInt(patronId) : null,
        libraryId: libraryId ? parseInt(libraryId) : null,
        reportDate,
        description: description || null,
        fineAmount: fineAmount ? Math.round(parseFloat(fineAmount) * 100) : 0,
        replacementRequired,
        replacementCost: replacementCost ? Math.round(parseFloat(replacementCost) * 100) : 0,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lost-damaged"] });
      toast.success("Report created successfully");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setType("LOST"); setBookId(""); setBookSearch(""); setSelectedBook(null);
    setCopyId(""); setPatronId(""); setPatronSearch(""); setSelectedPatron(null);
    setLibraryId(""); setDescription(""); setFineAmount(""); setReplacementRequired(false);
    setReplacementCost(""); setReportDate(new Date().toISOString().split("T")[0]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Create Lost/Damaged Report
          </DialogTitle>
          <DialogDescription>Report a lost or damaged library item.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-2">
          <div className="space-y-4 py-1">
            {/* Report Type */}
            <div className="grid grid-cols-2 gap-2">
              {(["LOST", "DAMAGED"] as ReportType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                    type === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                  }`}
                  data-testid={`btn-type-${t.toLowerCase()}`}
                >
                  {t === "LOST" ? "🔴 Lost" : "🟠 Damaged"}
                </button>
              ))}
            </div>

            {/* Book Search */}
            <div className="space-y-1.5">
              <Label>Resource <span className="text-red-500">*</span></Label>
              {selectedBook ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                  <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedBook.title}</p>
                    <p className="text-xs text-muted-foreground">{selectedBook.isbn}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedBook(null); setBookId(""); setCopyId(""); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by title or ISBN..."
                    className="pl-9"
                    value={bookSearch}
                    onChange={e => setBookSearch(e.target.value)}
                    data-testid="input-book-search"
                  />
                  {filteredBooks.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
                      {filteredBooks.map(b => (
                        <button key={b.id} type="button" onClick={() => { setSelectedBook(b); setBookId(String(b.id)); setBookSearch(""); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
                          <p className="font-medium">{b.title}</p>
                          <p className="text-xs text-muted-foreground">{b.isbn} · {b.author}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Copy selection */}
            {selectedBook && copies.length > 0 && (
              <div className="space-y-1.5">
                <Label>Book Copy (Accession)</Label>
                <Select value={copyId || "__none__"} onValueChange={v => setCopyId(v === "__none__" ? "" : v)}>
                  <SelectTrigger data-testid="select-copy">
                    <SelectValue placeholder="Select copy (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Not specified —</SelectItem>
                    {copies.map((c: BookCopy) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.barcode} {c.internalSSN ? `(${c.internalSSN})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Patron */}
            <div className="space-y-1.5">
              <Label>Patron (if applicable)</Label>
              {selectedPatron ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedPatron.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedPatron.email}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedPatron(null); setPatronId(""); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search patron by name or email..."
                    className="pl-9"
                    value={patronSearch}
                    onChange={e => setPatronSearch(e.target.value)}
                    data-testid="input-patron-search"
                  />
                  {filteredPatrons.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-auto">
                      {filteredPatrons.map(u => (
                        <button key={u.id} type="button" onClick={() => { setSelectedPatron(u); setPatronId(String(u.id)); setPatronSearch(""); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.role} · {u.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Library + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Library</Label>
                <Select value={libraryId || "__none__"} onValueChange={v => setLibraryId(v === "__none__" ? "" : v)}>
                  <SelectTrigger data-testid="select-library">
                    <SelectValue placeholder="Select library" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {libraries.map((l: Library) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Report Date</Label>
                <Input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} data-testid="input-report-date" />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description / Remarks</Label>
              <Textarea
                placeholder="Describe the condition, circumstances, or any relevant details..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                data-testid="textarea-description"
              />
            </div>

            {/* Fine & Replacement */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fine Amount (₹)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={fineAmount} onChange={e => setFineAmount(e.target.value)} data-testid="input-fine-amount" />
              </div>
              <div className="space-y-1.5">
                <Label>Replacement Cost (₹)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={replacementCost} onChange={e => setReplacementCost(e.target.value)} data-testid="input-replacement-cost" />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={replacementRequired} onChange={e => setReplacementRequired(e.target.checked)} className="rounded" data-testid="checkbox-replacement-required" />
              <span className="text-sm">Replacement Required</span>
            </label>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!bookId || mutation.isPending}
            data-testid="button-create-report"
          >
            {mutation.isPending ? "Creating..." : "Create Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report Detail Dialog ────────────────────────────────────────────────────

function ReportDetailDialog({
  report,
  open,
  onOpenChange,
}: {
  report: Report | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const isAdmin = user?.role === "ADMIN";
  const [statusNotes, setStatusNotes] = useState("");
  const [resolveMode, setResolveMode] = useState(false);
  const [resolution, setResolution] = useState<Resolution>("FOUND");
  const [resolveNotes, setResolveNotes] = useState("");
  const [fineCollect, setFineCollect] = useState("");
  const [fineWaive, setFineWaive] = useState("");
  const [fineNotes, setFineNotes] = useState("");
  const [showFinePanel, setShowFinePanel] = useState(false);

  const { data: detail } = useQuery<Report>({
    queryKey: ["lost-damaged-detail", report?.id],
    queryFn: () => apiJson(`/api/lost-damaged/${report!.id}`),
    enabled: open && !!report?.id,
  });

  const r = detail ?? report;

  const statusMutation = useMutation({
    mutationFn: (newStatus: ReportStatus) => apiJson(`/api/lost-damaged/${r!.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus, notes: statusNotes }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lost-damaged"] }); qc.invalidateQueries({ queryKey: ["lost-damaged-detail", r?.id] }); toast.success("Status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveMutation = useMutation({
    mutationFn: () => apiJson(`/api/lost-damaged/${r!.id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ resolution, notes: resolveNotes, updateCopyStatus: "auto" }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lost-damaged"] }); qc.invalidateQueries({ queryKey: ["lost-damaged-detail", r?.id] }); toast.success("Report resolved"); setResolveMode(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fineMutation = useMutation({
    mutationFn: () => apiJson(`/api/lost-damaged/${r!.id}/fine`, {
      method: "PATCH",
      body: JSON.stringify({
        collect: fineCollect ? Math.round(parseFloat(fineCollect) * 100) : undefined,
        waive: fineWaive ? Math.round(parseFloat(fineWaive) * 100) : undefined,
        notes: fineNotes,
      }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lost-damaged"] }); qc.invalidateQueries({ queryKey: ["lost-damaged-detail", r?.id] }); toast.success("Fine updated"); setShowFinePanel(false); setFineCollect(""); setFineWaive(""); setFineNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!r) return null;
  const statusCfg = STATUS_CONFIG[r.status];
  const nextStatuses = STATUS_TRANSITIONS[r.status];
  const fineOutstanding = (r.fineAmount ?? 0) - (r.finePaidAmount ?? 0) - (r.fineWaivedAmount ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Report #{r.id} — {r.type === "LOST" ? "🔴 Lost" : "🟠 Damaged"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-5 py-1 pr-2">
            {/* Header info */}
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-base">{r.bookTitle}</p>
                <p className="text-sm text-muted-foreground font-mono">{r.bookIsbn}</p>
                {r.bookCopyAccession && <p className="text-xs text-muted-foreground">Accession: {r.bookCopyAccession}</p>}
              </div>
              <Badge className={`${statusCfg.color} border`}>{statusCfg.label}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-muted-foreground">Patron:</span> <span className="ml-1">{r.patronName ?? "—"}</span></div>
              <div><span className="text-muted-foreground">Library:</span> <span className="ml-1">{r.libraryName ?? "—"}</span></div>
              <div><span className="text-muted-foreground">Report Date:</span> <span className="ml-1">{format(new Date(r.reportDate), "dd MMM yyyy")}</span></div>
              <div><span className="text-muted-foreground">Created By:</span> <span className="ml-1">{r.createdByName ?? "—"}</span></div>
              {r.resolution && <div><span className="text-muted-foreground">Resolution:</span> <span className="ml-1 capitalize">{r.resolution.replace(/_/g, " ")}</span></div>}
              {r.resolvedAt && <div><span className="text-muted-foreground">Resolved:</span> <span className="ml-1">{format(new Date(r.resolvedAt), "dd MMM yyyy")}</span></div>}
            </div>

            {r.description && (
              <div className="p-3 bg-muted/40 rounded-md text-sm">
                <p className="text-muted-foreground text-xs font-medium mb-1">DESCRIPTION</p>
                <p>{r.description}</p>
              </div>
            )}

            {/* Fine Summary */}
            {(r.fineAmount ?? 0) > 0 && (
              <div className="p-3 border rounded-md space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fine Summary</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <p className="font-bold">{formatCurrency(r.fineAmount ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">Assessed</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-green-600">{formatCurrency(r.finePaidAmount ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">Collected</p>
                  </div>
                  <div className="text-center">
                    <p className={`font-bold ${fineOutstanding > 0 ? "text-red-600" : "text-muted-foreground"}`}>{formatCurrency(Math.max(0, fineOutstanding))}</p>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                  </div>
                </div>
                {r.replacementRequired && <p className="text-xs text-muted-foreground">Replacement Cost: {formatCurrency(r.replacementCost ?? 0)}</p>}
              </div>
            )}

            <Separator />

            {/* Actions */}
            {r.status !== "CLOSED" && r.status !== "RESOLVED" && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Actions</p>

                {/* Status transition */}
                {nextStatuses.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {nextStatuses.map(s => (
                      <Button key={s} variant="outline" size="sm"
                        onClick={() => statusMutation.mutate(s)}
                        disabled={statusMutation.isPending}
                        data-testid={`btn-status-${s.toLowerCase()}`}
                      >
                        {STATUS_CONFIG[s].label}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Fine action */}
                {!showFinePanel && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFinePanel(true)}>
                    <DollarSign className="h-4 w-4" />
                    Fine Action
                  </Button>
                )}
                {showFinePanel && (
                  <div className="border rounded-md p-3 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Fine Action</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Collect (₹)</Label>
                        <Input size={1} type="number" min="0" step="0.01" value={fineCollect} onChange={e => setFineCollect(e.target.value)} placeholder="0.00" />
                      </div>
                      {isAdmin && (
                        <div className="space-y-1">
                          <Label className="text-xs">Waive (₹)</Label>
                          <Input size={1} type="number" min="0" step="0.01" value={fineWaive} onChange={e => setFineWaive(e.target.value)} placeholder="0.00" />
                        </div>
                      )}
                    </div>
                    <Input placeholder="Notes..." value={fineNotes} onChange={e => setFineNotes(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => fineMutation.mutate()} disabled={fineMutation.isPending}>Apply</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowFinePanel(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {/* Resolve */}
                {!resolveMode && (
                  <Button size="sm" className="gap-1.5" onClick={() => setResolveMode(true)} data-testid="btn-resolve">
                    <CheckCircle2 className="h-4 w-4" />
                    Resolve Report
                  </Button>
                )}
                {resolveMode && (
                  <div className="border rounded-md p-3 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Resolution</p>
                    <Select value={resolution} onValueChange={v => setResolution(v as Resolution)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(RESOLUTION_CONFIG) as [Resolution, { label: string; icon: React.ReactNode }][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea placeholder="Resolution notes..." value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} rows={2} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}>Confirm Resolution</Button>
                      <Button size="sm" variant="ghost" onClick={() => setResolveMode(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* History */}
            <div>
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Activity History
              </p>
              {(detail?.history ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No history yet.</p>
              ) : (
                <div className="space-y-2">
                  {(detail?.history ?? []).map(h => (
                    <div key={h.id} className="flex gap-3 text-sm">
                      <div className="w-1 bg-border rounded-full flex-shrink-0 self-stretch" />
                      <div className="flex-1 pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{h.action.replace(/_/g, " ")}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(h.performedAt), "dd MMM, HH:mm")}</span>
                        </div>
                        {h.toStatus && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            {h.fromStatus && <span>{STATUS_CONFIG[h.fromStatus as ReportStatus]?.label ?? h.fromStatus}</span>}
                            {h.fromStatus && <span>→</span>}
                            <span className="font-medium text-foreground">{STATUS_CONFIG[h.toStatus as ReportStatus]?.label ?? h.toStatus}</span>
                          </div>
                        )}
                        {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                        {h.performedByName && <p className="text-xs text-muted-foreground">by {h.performedByName}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function LostDamagedPage() {
  const { format: formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: summaryData } = useQuery({
    queryKey: ["lost-damaged-summary"],
    queryFn: () => apiJson("/api/lost-damaged/summary"),
  });

  const { data, isLoading } = useQuery<{ reports: Report[]; total: number }>({
    queryKey: ["lost-damaged", typeFilter, statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      return apiJson(`/api/lost-damaged?${params}`);
    },
  });

  const reports = data?.reports ?? [];
  const total = data?.total ?? 0;

  const openDetail = (r: Report) => { setSelectedReport(r); setDetailOpen(true); };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              Lost &amp; Damaged Items
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Manage lost and damaged library resources</p>
          </div>
          <Button className="gap-2" onClick={() => setCreateOpen(true)} data-testid="button-create-report">
            <Plus className="h-4 w-4" />
            New Report
          </Button>
        </div>

        {/* Summary Cards */}
        {summaryData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Lost Items</p>
                <p className="text-2xl font-bold text-red-600">{summaryData.totalLost}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Damaged Items</p>
                <p className="text-2xl font-bold text-orange-600">{summaryData.totalDamaged}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{summaryData.pending}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Fines Outstanding</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(Math.max(0, summaryData.totalFinesAssessed - summaryData.totalFinesCollected))}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters + Table */}
        <div className="bg-card rounded-lg border shadow-sm">
          <div className="p-4 border-b flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search title, ISBN, patron, accession..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={typeFilter || "__all__"} onValueChange={v => setTypeFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-36" data-testid="select-type-filter">
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Types</SelectItem>
                  <SelectItem value="LOST">🔴 Lost</SelectItem>
                  <SelectItem value="DAMAGED">🟠 Damaged</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter || "__all__"} onValueChange={v => setStatusFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-44" data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Statuses</SelectItem>
                  {(Object.entries(STATUS_CONFIG) as [ReportStatus, { label: string }][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(typeFilter || statusFilter || search) && (
                <Button variant="ghost" size="sm" onClick={() => { setTypeFilter(""); setStatusFilter(""); setSearch(""); }}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Accession No.</TableHead>
                <TableHead>Resource Title</TableHead>
                <TableHead>Patron</TableHead>
                <TableHead>Report Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Fine</TableHead>
                <TableHead>Replacement</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-muted-foreground">No reports found</p>
                    {!typeFilter && !statusFilter && !search && (
                      <Button variant="link" size="sm" className="mt-1" onClick={() => setCreateOpen(true)}>
                        Create the first report
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                reports.map(r => {
                  const statusCfg = STATUS_CONFIG[r.status];
                  const fineOutstanding = (r.fineAmount ?? 0) - (r.finePaidAmount ?? 0) - (r.fineWaivedAmount ?? 0);
                  return (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openDetail(r)} data-testid={`row-report-${r.id}`}>
                      <TableCell className="font-mono text-xs">{r.bookCopyAccession ?? "—"}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm line-clamp-1">{r.bookTitle}</p>
                          <p className="text-xs text-muted-foreground font-mono">{r.bookIsbn}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{r.patronName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(r.reportDate), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <Badge className={`${statusCfg.color} border text-xs`}>{statusCfg.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.type === "LOST" ? "destructive" : "secondary"} className="text-xs">
                          {r.type === "LOST" ? "🔴 Lost" : "🟠 Damaged"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {(r.fineAmount ?? 0) > 0 ? (
                          <span className={fineOutstanding > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                            {formatCurrency(r.fineAmount ?? 0)}
                            {fineOutstanding > 0 && <span className="text-xs block">{formatCurrency(fineOutstanding)} due</span>}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.replacementRequired ? (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Required</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`btn-actions-${r.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDetail(r)}>
                              <FileText className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {STATUS_TRANSITIONS[r.status].map(s => (
                              <DropdownMenuItem key={s} onClick={() => {
                                fetch(`/api/lost-damaged/${r.id}/status`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: s }),
                                }).then(() => {
                                  const qc2 = (window as any).__queryClient;
                                  if (qc2) qc2.invalidateQueries({ queryKey: ["lost-damaged"] });
                                  toast.success(`Status changed to ${STATUS_CONFIG[s].label}`);
                                }).catch(() => toast.error("Failed to update status"));
                              }}>
                                Move to {STATUS_CONFIG[s].label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {total > 0 && (
            <div className="p-3 border-t text-sm text-muted-foreground text-right">
              Showing {reports.length} of {total} reports
            </div>
          )}
        </div>
      </div>

      <CreateReportDialog open={createOpen} onOpenChange={setCreateOpen} />
      {selectedReport && (
        <ReportDetailDialog
          report={selectedReport}
          open={detailOpen}
          onOpenChange={v => { setDetailOpen(v); if (!v) setSelectedReport(null); }}
        />
      )}
    </MainLayout>
  );
}
