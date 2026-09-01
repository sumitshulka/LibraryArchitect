import { useMemo, useState } from "react";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SearchAttributesFilter } from "@/components/SearchAttributesFilter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  Database,
  Download,
  FileText,
  Filter,
  Gauge,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { booksApi, statsApi, type BookWithSearchAttributes } from "@/lib/api";
import type { Book } from "@shared/schema";
import { formatIsbn } from "@/lib/isbn";
import { toast } from "sonner";
import { BookDetailsSheet, CatalogAnalyticsDialog, EditBookDialog } from "./CatalogPage";
import { MarcEditor } from "./MarcEditor";

const statusMeta: Record<string, { label: string; className: string; dotClassName: string }> = {
  AVAILABLE: { label: "Available", className: "bg-green-100 text-green-800", dotClassName: "bg-green-500" },
  CHECKED_OUT: { label: "Checked out", className: "bg-blue-100 text-blue-800", dotClassName: "bg-blue-500" },
  MAINTENANCE: { label: "Maintenance", className: "bg-orange-100 text-orange-800", dotClassName: "bg-orange-500" },
  LOST: { label: "Lost", className: "bg-red-100 text-red-800", dotClassName: "bg-red-500" },
  RESERVED: { label: "Reserved", className: "bg-purple-100 text-purple-800", dotClassName: "bg-purple-500" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status.replace("_", " "), className: "bg-muted text-muted-foreground", dotClassName: "bg-muted-foreground" };
  return (
    <Badge className={`gap-1.5 border-0 px-2.5 py-1 text-[10px] font-semibold ${meta.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} />
      {meta.label}
    </Badge>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: typeof Gauge;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-5 shadow-sm ${accent ? "border-blue-100 bg-blue-50" : "bg-card"}`}>
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        <Icon className={`h-4 w-4 ${accent ? "text-blue-700" : "text-primary"}`} />
      </div>
      <div className={`mt-2 text-2xl font-bold leading-tight ${accent ? "text-blue-700" : "text-foreground"}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function Cover({ book }: { book: Book }) {
  return book.coverUrl ? (
    <img src={book.coverUrl} alt={`${book.title} cover`} className="h-14 w-10 rounded border object-cover shadow-sm" />
  ) : (
    <div className="grid h-14 w-10 place-items-center rounded border bg-muted text-muted-foreground">
      <ImageIcon className="h-4 w-4" />
    </div>
  );
}

export default function CatalogOverviewPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [attributeValueIds, setAttributeValueIds] = useState<number[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [marcBook, setMarcBook] = useState<Book | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const queryClient = useQueryClient();

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["books", searchQuery, attributeValueIds],
    queryFn: () => booksApi.getAll(searchQuery || undefined, attributeValueIds.length ? attributeValueIds : undefined),
  });
  const { data: summaryBooks = [] } = useQuery({
    queryKey: ["catalog-summary-books"],
    queryFn: () => booksApi.getAll(),
  });
  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: statsApi.getDashboard,
  });

  const filteredBooks = useMemo(
    () => books.filter((book) => !statusFilter || book.status === statusFilter),
    [books, statusFilter],
  );
  const attentionCount = summaryBooks.filter((book) => book.status === "LOST" || book.status === "MAINTENANCE").length + (dashboardStats?.overdueItems ?? 0);
  const totalBooks = dashboardStats?.totalBooks ?? summaryBooks.length;
  const availableBooks = dashboardStats?.availableBooks ?? summaryBooks.filter((book) => book.status === "AVAILABLE").length;
  const checkedOutBooks = dashboardStats?.checkedOutBooks ?? summaryBooks.filter((book) => book.status === "CHECKED_OUT").length;
  const availablePercent = totalBooks ? Math.round((availableBooks / totalBooks) * 100) : 0;

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const handleBookClick = (bookId: number) => {
    setSelectedBookId(bookId);
    setSheetOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: booksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-summary-books"] });
      toast.success("Book deleted successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this book?")) deleteMutation.mutate(id);
  };

  return (
    <MainLayout>
      <div className="w-full">
        <div className="w-full">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-catalog-title">Catalog overview</h1>
              <p className="mt-1 text-sm text-muted-foreground">Manage books, journals, and media resources across your collection.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => flash("Catalog export prepared")} className="gap-2" data-testid="button-export">
                <Download className="h-4 w-4" />Export
              </Button>
              <Link href="/catalog/bulk-upload">
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-bulk-upload">
                  <Upload className="h-4 w-4" />Bulk upload
                </Button>
              </Link>
              <Link href="/catalog/new">
                <Button size="sm" className="gap-2" data-testid="button-add-resource">
                  <Plus className="h-4 w-4" />Add resource
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <SummaryCard label="Collection at a glance" value={statsLoading ? "—" : totalBooks.toLocaleString()} detail="total records · live from catalog" icon={BookOpen} accent />
            <SummaryCard label="On shelf" value={statsLoading ? "—" : availableBooks.toLocaleString()} detail={`${availablePercent}% of the collection`} icon={Gauge} />
            <SummaryCard label="Circulating" value={statsLoading ? "—" : checkedOutBooks.toLocaleString()} detail={`${dashboardStats?.activeCirculation ?? checkedOutBooks} active loans`} icon={Database} />
            <SummaryCard label="Needs attention" value={statsLoading ? "—" : attentionCount.toLocaleString()} detail={`${dashboardStats?.overdueItems ?? 0} overdue items`} icon={ShieldCheck} />
          </div>

          <div className="mt-6 flex flex-col justify-between gap-3 border-b pb-3 sm:flex-row sm:items-end">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Primary task</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Manage collection</h2>
            </div>
            <Button variant="outline" onClick={() => setAnalyticsOpen(true)} className="gap-2 self-start sm:self-auto" data-testid="button-catalog-analytics">
              <BarChart3 className="h-4 w-4" />Open catalog analytics
            </Button>
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-[370px]">
                <Search className="absolute left-3 top-[11px] h-3.5 w-3.5 text-muted-foreground" />
                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-9 pl-9 text-sm" placeholder="Search title, author, or ISBN" data-testid="input-search" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                <SearchAttributesFilter selectedValueIds={attributeValueIds} onChange={setAttributeValueIds} />
                <span className="text-xs text-muted-foreground">{filteredBooks.length} of {books.length} visible</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2" data-testid="button-filter">
                      <Filter className="h-3.5 w-3.5" />{statusFilter ? statusMeta[statusFilter]?.label ?? statusFilter : "All statuses"}<ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setStatusFilter(null)}>All statuses</DropdownMenuItem>
                    {Object.entries(statusMeta).map(([value, meta]) => <DropdownMenuItem key={value} onClick={() => setStatusFilter(value)}>{meta.label}</DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="bg-muted/50 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-16 px-4 py-3 font-semibold">Cover</th>
                    <th className="px-3 py-3 font-semibold">Title &amp; author</th>
                    <th className="px-3 py-3 font-semibold">Category</th>
                    <th className="px-3 py-3 font-semibold">ISBN</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="w-14 px-4 py-3 text-right font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr><td colSpan={6} className="h-24 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading catalog...</td></tr>
                  ) : filteredBooks.length > 0 ? filteredBooks.map((book: BookWithSearchAttributes) => (
                    <tr key={book.id} className="group transition-colors hover:bg-muted/30" data-testid={`row-book-${book.id}`}>
                      <td className="px-4 py-3"><Cover book={book} /></td>
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => handleBookClick(book.id)} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`text-title-${book.id}`}>
                          <div className="text-sm font-semibold text-foreground group-hover:text-primary">{book.title}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{book.author} <span className="px-1 text-muted-foreground/60">·</span> {book.publishedYear}</div>
                        </button>
                        {book.searchAttributes?.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{book.searchAttributes.map((attribute) => <Badge key={attribute.attributeValueId} variant="secondary" className="h-4 px-1.5 text-[9px] font-normal">{attribute.attributeValue}</Badge>)}</div>}
                      </td>
                      <td className="px-3 py-3"><Badge variant="outline" className="px-2 py-1 text-xs font-normal">{book.category || "Uncategorized"}</Badge></td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{formatIsbn(book.isbn)}</td>
                      <td className="px-3 py-3"><StatusBadge status={book.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${book.title}`} className="h-8 w-8" data-testid={`button-actions-${book.id}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Record actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => { setEditingBook(book); setEditDialogOpen(true); }} data-testid={`button-edit-${book.id}`}><Pencil className="mr-2 h-3.5 w-3.5" />Edit details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setMarcBook(book)} data-testid={`button-marc-${book.id}`}><FileText className="mr-2 h-3.5 w-3.5" />View MARC record</DropdownMenuItem>
                            <DropdownMenuItem><Sparkles className="mr-2 h-3.5 w-3.5" />View history</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(book.id)} data-testid={`button-delete-${book.id}`}>Delete record</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="h-36 text-center text-sm text-muted-foreground"><Search className="mb-2 inline h-5 w-5 text-muted-foreground/60" /><div>No records match this view</div><button className="mt-1 text-xs text-primary underline-offset-2 hover:underline" onClick={() => { setSearchQuery(""); setStatusFilter(null); setAttributeValueIds([]); }}>Clear search and filters</button></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
              <span>Showing {filteredBooks.length} of {books.length} entries</span>
              <span className="rounded bg-muted px-2 py-1 font-medium text-muted-foreground">Page 1</span>
            </div>
          </div>

          <div className="mt-5 flex flex-col justify-between gap-3 border-t pt-4 text-xs text-muted-foreground sm:flex-row">
            <span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-600" />Catalog synced with the latest local records</span>
            <Link href="/settings?section=catalog" className="flex items-center gap-1.5 font-medium text-primary hover:underline" data-testid="link-catalog-settings">Catalog settings <Settings2 className="h-3.5 w-3.5" /></Link>
          </div>
        </div>

        {notice && <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-lg"><Check className="h-4 w-4 text-green-600" />{notice}</div>}
      </div>

      <CatalogAnalyticsDialog open={analyticsOpen} onOpenChange={setAnalyticsOpen} />
      <BookDetailsSheet open={sheetOpen} onOpenChange={setSheetOpen} bookId={selectedBookId} />
      <EditBookDialog book={editingBook} open={editDialogOpen} onOpenChange={setEditDialogOpen} />
      <Dialog open={!!marcBook} onOpenChange={(open) => { if (!open) setMarcBook(null); }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>MARC record</DialogTitle>
            <DialogDescription>View and edit the bibliographic record for {marcBook?.title}.</DialogDescription>
          </DialogHeader>
          {marcBook && <MarcEditor book={marcBook} />}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}