import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Barcode,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  History,
  Library,
  Loader2,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { bookCopiesApi, booksApi, circulationApi, type BookCopyReviewerDetails, type BookDashboard, type BookWithSearchAttributes } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useCurrency } from "@/lib/useCurrency";
import { formatIsbn } from "@/lib/isbn";
import type { Book, User } from "@shared/schema";

type SafeUser = Omit<User, "password">;

type IdentifierMatch = {
  book: Book;
  copy: NonNullable<Awaited<ReturnType<typeof circulationApi.lookupBook>>["copy"]>;
};

type SearchResults = {
  books: BookWithSearchAttributes[];
  users: SafeUser[];
  identifierMatch: IdentifierMatch | null;
};

function displayDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function statusVariant(status: string) {
  if (status === "OVERDUE") return "destructive" as const;
  if (status === "ACTIVE") return "default" as const;
  return "secondary" as const;
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function BookDashboardView({ dashboard }: { dashboard: BookDashboard }) {
  const { format: formatMoney } = useCurrency();
  const { book } = dashboard;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="h-28 w-20 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
            <BookOpen className="h-7 w-7" />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-semibold">{book.title}</h3>
          <p className="text-sm text-muted-foreground">by {book.author}</p>
          <p className="font-mono text-xs text-muted-foreground">ISBN: {formatIsbn(book.isbn)}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline">{book.status}</Badge>
            <Badge variant="secondary">{book.format}</Badge>
            {book.category && <Badge variant="secondary">{book.category}</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Total copies" value={String(dashboard.totalCopies)} icon={<BookOpen className="h-3.5 w-3.5" />} />
        <Metric label="Libraries" value={String(dashboard.libraryAllocations.length)} icon={<Library className="h-3.5 w-3.5" />} />
        <Metric label="Acquisition cost" value={formatMoney(dashboard.financials.totalAcquisitionCost)} icon={<DollarSign className="h-3.5 w-3.5" />} />
        <Metric label="Outstanding fines" value={formatMoney(dashboard.financials.totalFinesOutstanding)} icon={<DollarSign className="h-3.5 w-3.5" />} />
      </div>

      <section>
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <CalendarDays className="h-4 w-4" />
          Acquisition history
        </h3>
        {dashboard.acquisitionHistory.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No purchase or acquisition records.</p>
        ) : (
          <div className="space-y-2">
            {dashboard.acquisitionHistory.map((entry, index) => (
              <div key={`${entry.date}-${entry.source}-${index}`} className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-sm sm:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Purchased</p><p>{displayDate(entry.date)}</p></div>
                <div><p className="text-xs text-muted-foreground">Source</p><p>{entry.source || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Copies</p><p>{entry.quantity}</p></div>
                <div><p className="text-xs text-muted-foreground">Cost</p><p>{formatMoney(entry.cost)}</p></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Library className="h-4 w-4" />
          Library assignments
        </h3>
        {dashboard.libraryAllocations.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No copies are assigned to a library.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {dashboard.libraryAllocations.map((allocation) => (
              <div key={allocation.libraryId} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{allocation.libraryName}</p>
                    <p className="text-xs text-muted-foreground">{allocation.libraryCode}</p>
                  </div>
                  <Badge variant="outline">{allocation.total} copies</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{allocation.available} available</span>
                  <span>{allocation.checkedOut} checked out</span>
                  {allocation.reserved > 0 && <span>{allocation.reserved} reserved</span>}
                  {allocation.damaged > 0 && <span>{allocation.damaged} damaged</span>}
                  {allocation.lost > 0 && <span>{allocation.lost} lost</span>}
                  {allocation.inTransit > 0 && <span>{allocation.inTransit} in transit</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <History className="h-4 w-4" />
          Issue and return ledger
        </h3>
        {dashboard.recentCirculation.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No circulation history.</p>
        ) : (
          <div className="space-y-2">
            {dashboard.recentCirculation.map((record: any) => (
              <div key={record.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
                    <span className="font-medium">{record.userName || "Unknown member"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{record.libraryName || "Unassigned library"}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <span>Issued: {displayDate(record.checkoutDate)}</span>
                  <span>Due: {displayDate(record.dueDate)}</span>
                  <span>Returned: {displayDate(record.returnDate)}</span>
                  <span>Copy: {record.bookCopyId ? `#${record.bookCopyId}` : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CopyReviewerView({ details }: { details: BookCopyReviewerDetails }) {
  const { format: formatMoney } = useCurrency();
  const currentCheckout = details.history.find((record) => record.status === "ACTIVE" || record.status === "OVERDUE");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Book</p>
            <h3 className="text-lg font-semibold">{details.book.title}</h3>
            <p className="text-sm text-muted-foreground">by {details.book.author}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">ISBN: {formatIsbn(details.book.isbn)}</p>
          </div>
          <Badge variant="outline">{details.copy.status}</Badge>
        </div>
        <Separator className="my-4" />
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Internal SSN</p><p className="font-mono">{details.copy.internalSSN || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">User-defined SSN</p><p className="font-mono">{details.copy.userDefinedSSN || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Barcode</p><p className="font-mono">{details.copy.barcode || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Library</p><p>{details.library?.name || "Unallocated"}</p></div>
          <div><p className="text-xs text-muted-foreground">Shelf location</p><p>{details.copy.shelfLocation || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Condition</p><p>{details.copy.condition || "—"}</p></div>
        </div>
      </div>

      {currentCheckout ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Currently issued
          </div>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Member</p><p className="font-medium">{currentCheckout.userName}</p><p className="text-xs text-muted-foreground">{currentCheckout.userEmail}</p></div>
            <div><p className="text-xs text-muted-foreground">Issued / due</p><p>{displayDate(currentCheckout.checkoutDate)} / {displayDate(currentCheckout.dueDate)}</p></div>
            <div><p className="text-xs text-muted-foreground">Fine outstanding</p><p className={currentCheckout.fineOutstanding > 0 ? "font-semibold text-red-600" : "font-medium"}>{formatMoney(currentCheckout.fineOutstanding)}</p></div>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">This copy is not currently issued.</p>
      )}

      <section>
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <History className="h-4 w-4" />
          Full issue and return ledger
        </h3>
        {details.history.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No issue or return records for this copy.</p>
        ) : (
          <div className="space-y-2">
            {details.history.map((record) => (
              <div key={record.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
                    <span className="font-medium">{record.userName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{record.libraryName || "Unassigned library"}</span>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <span>Issued: {displayDate(record.checkoutDate)}</span>
                  <span>Due: {displayDate(record.dueDate)}</span>
                  <span>Returned: {displayDate(record.returnDate)}</span>
                </div>
                {(record.accruedFine > 0 || record.fineOutstanding > 0 || record.damageOutstanding > 0) && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {record.accruedFine > 0 && <span>Accrued fine: {formatMoney(record.accruedFine)}</span>}
                    {record.fineOutstanding > 0 && <span className="font-medium text-red-600">Fine outstanding: {formatMoney(record.fineOutstanding)}</span>}
                    {record.damageOutstanding > 0 && <span className="font-medium text-red-600">Damage outstanding: {formatMoney(record.damageOutstanding)}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function ReviewerDetailsDialog({
  open,
  onOpenChange,
  bookId,
  copyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: number | null;
  copyId: number | null;
}) {
  const dashboardQuery = useQuery({
    queryKey: ["global-search-book-dashboard", bookId],
    queryFn: () => booksApi.getDashboard(bookId!),
    enabled: open && bookId !== null && copyId === null,
  });
  const copyQuery = useQuery({
    queryKey: ["global-search-copy-reviewer-details", copyId],
    queryFn: () => bookCopiesApi.getReviewerDetails(copyId!),
    enabled: open && copyId !== null,
  });

  const title = copyId !== null ? "SSN Copy Review" : "Book Review Dashboard";
  const isLoading = dashboardQuery.isLoading || copyQuery.isLoading;
  const error = dashboardQuery.error || copyQuery.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Search className="h-5 w-5" />{title}</DialogTitle>
          <DialogDescription>
            {copyId !== null
              ? "Complete copy-level history for the scanned SSN or barcode."
              : "Acquisition, inventory, library allocation, and circulation details."}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Unable to load reviewer details."}
          </p>
        ) : copyQuery.data ? (
          <CopyReviewerView details={copyQuery.data} />
        ) : dashboardQuery.data ? (
          <BookDashboardView dashboard={dashboardQuery.data} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<{ bookId: number; copyId: number | null } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const { data: results, isFetching } = useQuery<SearchResults>({
    queryKey: ["global-search", debouncedQuery],
    enabled: isOpen && debouncedQuery.length >= 2,
    queryFn: async () => {
      const [books, usersResponse, identifierResponse] = await Promise.all([
        booksApi.getAll(debouncedQuery),
        fetch(`/api/users/search?q=${encodeURIComponent(debouncedQuery)}&status=ACTIVE&limit=8`).then(async (response) => {
          if (!response.ok) throw new Error("Failed to search members");
          return response.json() as Promise<{ users: SafeUser[] }>;
        }),
        circulationApi.lookupBook(debouncedQuery).catch(() => null),
      ]);
      return {
        books: books.slice(0, 8),
        users: usersResponse.users,
        identifierMatch: identifierResponse?.copy
          ? { book: identifierResponse.book, copy: identifierResponse.copy }
          : null,
      };
    },
  });

  const hasResults = !!results && (
    results.books.length > 0 ||
    results.users.length > 0 ||
    results.identifierMatch !== null
  );

  const openDetails = (bookId: number, copyId: number | null = null) => {
    setSelected({ bookId, copyId });
    setIsOpen(false);
  };

  return (
    <>
      <div ref={containerRef} className="relative w-full max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search books, ISBN, SSN, barcode, or members..."
          className="bg-muted/40 pl-9 pr-8 border-muted-foreground/20 focus-visible:ring-sidebar-primary"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          data-testid="input-search"
        />
        {query && (
          <button
            type="button"
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            onClick={() => { setQuery(""); setDebouncedQuery(""); setIsOpen(false); }}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isOpen && debouncedQuery.length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,520px)] overflow-y-auto rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg">
            {isFetching ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Searching catalog and members...</div>
            ) : !hasResults ? (
              <p className="p-4 text-sm text-muted-foreground">No books, copies, or members found.</p>
            ) : (
              <div className="space-y-3">
                {results?.identifierMatch && (
                  <div>
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Copy identifier match</p>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-accent"
                      onClick={() => openDetails(results.identifierMatch!.book.id, results.identifierMatch!.copy.id)}
                      data-testid="global-search-copy-result"
                    >
                      <Barcode className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{results.identifierMatch.book.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {results.identifierMatch.copy.userDefinedSSN || results.identifierMatch.copy.internalSSN || results.identifierMatch.copy.barcode} · {results.identifierMatch.copy.status}
                        </span>
                      </span>
                    </button>
                  </div>
                )}
                {results?.books.length ? (
                  <div>
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Books</p>
                    {results.books.map((book) => (
                      <button key={book.id} type="button" className="flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-accent" onClick={() => openDetails(book.id)} data-testid={`global-search-book-${book.id}`}>
                        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{book.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{book.author} · ISBN {formatIsbn(book.isbn)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {results?.users.length ? (
                  <div>
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Members</p>
                    {results.users.map((user) => (
                      <div key={user.id} className="flex items-start gap-3 rounded-md p-2">
                        <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{user.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{user.email} · {user.studentId || user.employeeId || user.username}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
      <ReviewerDetailsDialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        bookId={selected?.bookId ?? null}
        copyId={selected?.copyId ?? null}
      />
    </>
  );
}