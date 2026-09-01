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
  AVAILABLE: { label: "Available", className: "bg-[#e1eee9] text-[#2d6258]", dotClassName: "bg-[#4f8d7f]" },
  CHECKED_OUT: { label: "Checked out", className: "bg-[#e8e5f0] text-[#625c7b]", dotClassName: "bg-[#8179a6]" },
  MAINTENANCE: { label: "Maintenance", className: "bg-[#f4e7d7] text-[#9b633d]", dotClassName: "bg-[#c88551]" },
  LOST: { label: "Lost", className: "bg-[#f3dfdc] text-[#984f4d]", dotClassName: "bg-[#bf7167]" },
  RESERVED: { label: "Reserved", className: "bg-[#eee6f3] text-[#755a86]", dotClassName: "bg-[#9b7ab1]" },
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
    <div className={`rounded-sm border p-5 ${accent ? "border-[#355e57] bg-[#355e57] text-[#f8f6ef] shadow-[4px_4px_0_#c8ba72]" : "border-[#d6d9ce] bg-[#f8f6ef]"}`}>
      <div className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] ${accent ? "text-[#b8d0c3]" : "text-[#80908b]"}`}>
        {label}
        <Icon className={`h-4 w-4 ${accent ? "text-[#c8ba72]" : "text-[#5c8b82]"}`} />
      </div>
      <div className={`mt-3 font-serif text-[32px] leading-none ${accent ? "text-[#f8f6ef]" : "text-[#20333a]"}`}>{value}</div>
      <div className={`mt-2 text-[11px] ${accent ? "text-[#b8d0c3]" : "text-[#71817c]"}`}>{detail}</div>
    </div>
  );
}

function Cover({ book }: { book: Book }) {
  return book.coverUrl ? (
    <img src={book.coverUrl} alt={`${book.title} cover`} className="h-14 w-10 rounded-[3px] border border-[#d6d9ce] object-cover shadow-[2px_3px_0_rgba(28,43,47,0.08)]" />
  ) : (
    <div className="grid h-14 w-10 place-items-center rounded-[3px] border border-[#d6d9ce] bg-[#e7eee7] text-[#5c8b82]">
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
      <div className="-m-6 min-h-full bg-[#f4f1e8] p-6 text-[#20333a] md:p-8">
        <div className="mx-auto w-full max-w-[1240px]">
          <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#658a81]">
                <span className="h-px w-7 bg-[#c8ba72]" />
                Collection desk · Today
              </div>
              <h1 className="font-serif text-[38px] font-semibold leading-[0.95] tracking-[-0.04em] md:text-[46px]" data-testid="text-catalog-title">Catalog overview</h1>
              <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#71817c]">A measured view of the collection, its current availability, and the records that need a librarian&apos;s attention.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => flash("Catalog export prepared")} className="h-9 rounded-sm border-[#cbd4ca] bg-[#f8f6ef] text-[11px] text-[#45635e] hover:bg-[#e9eee7]" data-testid="button-export">
                <Download className="mr-2 h-3.5 w-3.5" />Export
              </Button>
              <Link href="/catalog/bulk-upload">
                <Button variant="outline" size="sm" className="h-9 rounded-sm border-[#cbd4ca] bg-[#f8f6ef] text-[11px] text-[#45635e] hover:bg-[#e9eee7]" data-testid="button-bulk-upload">
                  <Upload className="mr-2 h-3.5 w-3.5" />Bulk upload
                </Button>
              </Link>
              <Link href="/catalog/new">
                <Button size="sm" className="h-9 rounded-sm bg-[#355e57] text-[11px] text-[#f8f6ef] shadow-[3px_3px_0_#c8ba72] hover:bg-[#2c514b]" data-testid="button-add-resource">
                  <Plus className="mr-2 h-3.5 w-3.5" />Add resource
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

          <div className="mt-6 flex flex-col justify-between gap-3 border-b border-[#d6d9ce] pb-3 sm:flex-row sm:items-end">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#658a81]">Primary task</div>
              <h2 className="mt-1 font-serif text-[25px] font-semibold">Manage collection</h2>
            </div>
            <Button variant="outline" onClick={() => setAnalyticsOpen(true)} className="h-9 self-start rounded-sm border-[#bdcbc0] bg-[#e8eee7] px-3 text-[11px] font-semibold text-[#355e57] hover:bg-[#dce8df] sm:self-auto" data-testid="button-catalog-analytics">
              <BarChart3 className="mr-2 h-3.5 w-3.5" />Open catalog analytics
            </Button>
          </div>

          <div className="mt-3 overflow-hidden rounded-sm border border-[#d6d9ce] bg-[#f8f6ef] shadow-[0_5px_0_rgba(69,99,94,0.05)]">
            <div className="flex flex-col gap-3 border-b border-[#d6d9ce] p-4 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-[370px]">
                <Search className="absolute left-3 top-[11px] h-3.5 w-3.5 text-[#80908b]" />
                <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-9 rounded-sm border-[#cbd4ca] bg-[#fcfbf6] pl-9 text-[12px] placeholder:text-[#99a7a0] focus-visible:ring-[#5c8b82]" placeholder="Search title, author, or ISBN" data-testid="input-search" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                <SearchAttributesFilter selectedValueIds={attributeValueIds} onChange={setAttributeValueIds} />
                <span className="text-[11px] text-[#80908b]">{filteredBooks.length} of {books.length} visible</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 rounded-sm border-[#cbd4ca] bg-[#fcfbf6] px-3 text-[11px] text-[#45635e]" data-testid="button-filter">
                      <Filter className="mr-2 h-3.5 w-3.5" />{statusFilter ? statusMeta[statusFilter]?.label ?? statusFilter : "All statuses"}<ChevronDown className="ml-2 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-sm border-[#d6d9ce] bg-[#f8f6ef]">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.15em] text-[#80908b]">Filter by status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setStatusFilter(null)}>All statuses</DropdownMenuItem>
                    {Object.entries(statusMeta).map(([value, meta]) => <DropdownMenuItem key={value} onClick={() => setStatusFilter(value)}>{meta.label}</DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="bg-[#edf1ea] text-[10px] font-bold uppercase tracking-[0.15em] text-[#78908a]">
                  <tr>
                    <th className="w-16 px-4 py-3 font-semibold">Cover</th>
                    <th className="px-3 py-3 font-semibold">Title &amp; author</th>
                    <th className="px-3 py-3 font-semibold">Category</th>
                    <th className="px-3 py-3 font-semibold">ISBN</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="w-14 px-4 py-3 text-right font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e2d9]">
                  {isLoading ? (
                    <tr><td colSpan={6} className="h-24 text-center text-sm text-[#80908b]"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading catalog...</td></tr>
                  ) : filteredBooks.length > 0 ? filteredBooks.map((book: BookWithSearchAttributes) => (
                    <tr key={book.id} className="group transition-colors hover:bg-[#fbfaf5]" data-testid={`row-book-${book.id}`}>
                      <td className="px-4 py-3"><Cover book={book} /></td>
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => handleBookClick(book.id)} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8b82]" data-testid={`text-title-${book.id}`}>
                          <div className="text-[13px] font-semibold text-[#29434a] group-hover:text-[#47786e]">{book.title}</div>
                          <div className="mt-0.5 text-[11px] text-[#80908b]">{book.author} <span className="px-1 text-[#b1bbb3]">·</span> {book.publishedYear}</div>
                        </button>
                        {book.searchAttributes?.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{book.searchAttributes.map((attribute) => <Badge key={attribute.attributeValueId} variant="outline" className="h-4 rounded-sm border-[#d1d9cf] bg-[#f8f6ef] px-1.5 text-[9px] font-medium text-[#72857e]">{attribute.attributeValue}</Badge>)}</div>}
                      </td>
                      <td className="px-3 py-3"><Badge variant="outline" className="rounded-sm border-[#d1d9cf] bg-transparent px-2 py-1 text-[10px] font-medium text-[#5d746d]">{book.category || "Uncategorized"}</Badge></td>
                      <td className="px-3 py-3 font-mono text-[10px] tracking-[-0.04em] text-[#82938b]">{formatIsbn(book.isbn)}</td>
                      <td className="px-3 py-3"><StatusBadge status={book.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${book.title}`} className="h-8 w-8 rounded-sm text-[#80908b] hover:bg-[#e6eee7] hover:text-[#355e57]" data-testid={`button-actions-${book.id}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-sm border-[#d6d9ce] bg-[#f8f6ef]">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.15em] text-[#80908b]">Record actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => { setEditingBook(book); setEditDialogOpen(true); }} data-testid={`button-edit-${book.id}`}><Pencil className="mr-2 h-3.5 w-3.5" />Edit details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setMarcBook(book)} data-testid={`button-marc-${book.id}`}><FileText className="mr-2 h-3.5 w-3.5" />View MARC record</DropdownMenuItem>
                            <DropdownMenuItem><Sparkles className="mr-2 h-3.5 w-3.5" />View history</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-[#a9544d] focus:text-[#a9544d]" onClick={() => handleDelete(book.id)} data-testid={`button-delete-${book.id}`}>Delete record</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="h-36 text-center text-sm text-[#80908b]"><Search className="mb-2 inline h-5 w-5 text-[#a7b5ad]" /><div>No records match this view</div><button className="mt-1 text-[11px] text-[#47786e] underline-offset-2 hover:underline" onClick={() => { setSearchQuery(""); setStatusFilter(null); setAttributeValueIds([]); }}>Clear search and filters</button></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[#d6d9ce] px-4 py-3 text-[10px] text-[#80908b]">
              <span>Showing {filteredBooks.length} of {books.length} entries</span>
              <span className="rounded-sm bg-[#e7eee7] px-2 py-1 font-semibold text-[#47786e]">Page 1</span>
            </div>
          </div>

          <div className="mt-5 flex flex-col justify-between gap-3 border-t border-[#d6d9ce] pt-4 text-[11px] text-[#80908b] sm:flex-row">
            <span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#5c8b82]" />Catalog synced with the latest local records</span>
            <Link href="/settings" className="flex items-center gap-1.5 font-semibold text-[#47786e] hover:text-[#2c514b]" data-testid="link-catalog-settings">Catalog settings <Settings2 className="h-3.5 w-3.5" /></Link>
          </div>
        </div>

        {notice && <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-sm border border-[#9db9a8] bg-[#355e57] px-4 py-3 text-xs font-semibold text-[#f8f6ef] shadow-[4px_4px_0_#c8ba72]"><Check className="h-4 w-4 text-[#c8ba72]" />{notice}</div>}
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