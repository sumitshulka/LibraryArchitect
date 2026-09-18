import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, isPast } from "date-fns";
import { toast } from "sonner";
import {
  BookOpen, CalendarDays, Check, Clock3, Info, Library, Plus, Search, Sparkles, Trash2,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { AccountHeader, EmptyPanel, PatronError, PatronPagination } from "./patronShared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { booksApi, patronAccountApi, reservationsApi, type ReservationApi } from "@/lib/api";

const statusLabels: Record<string, string> = { ACTIVE: "Active", FULFILLED: "Collected", CANCELLED: "Cancelled", EXPIRED: "Expired" };
const statusStyles: Record<string, string> = {
  ACTIVE: "border-teal-200 bg-teal-50 text-teal-800",
  FULFILLED: "border-sky-200 bg-sky-50 text-sky-800",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-600",
  EXPIRED: "border-amber-200 bg-amber-50 text-amber-800",
};

export default function PatronReservationsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ReservationApi | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const query = useQuery({ queryKey: ["patron-reservations", "all"], queryFn: () => reservationsApi.list() });
  const cancel = useMutation({
    mutationFn: (id: number) => reservationsApi.cancel(id),
    onSuccess: () => { toast.success("Reservation cancelled"); setCancelTarget(null); qc.invalidateQueries({ queryKey: ["patron-reservations"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = query.data ?? [];
  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = `${row.bookTitle ?? ""} ${row.bookAuthor ?? ""} ${row.libraryName ?? ""}`.toLowerCase();
    return (status === "ALL" || row.status === status) && (!search || haystack.includes(search.toLowerCase()));
  }), [rows, search, status]);
  useEffect(() => setPage(1), [search, status]);
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const active = rows.filter((row) => row.status === "ACTIVE");
  const readySoon = active.filter((row) => !isPast(new Date(row.expiresAt))).length;

  if (query.isLoading) return <MainLayout><div className="space-y-7"><Skeleton className="h-40 rounded-2xl" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></div><Skeleton className="h-96 rounded-xl" /></div></MainLayout>;
  if (query.isError) return <PatronError onRetry={() => query.refetch()} />;

  return <MainLayout>
    <div className="space-y-7">
      <AccountHeader eyebrow="Your reading space" title="Reservations, held for you" description="Keep a place in line for the books you want next. We will hold an available copy at your chosen library." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Clock3} label="Active holds" value={active.length} tone="teal" />
        <Stat icon={CalendarDays} label="Ready to collect" value={readySoon} tone="amber" />
        <Stat icon={BookOpen} label="All time" value={rows.length} tone="sky" />
      </div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Your queue</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Books waiting in your orbit</h2><p className="mt-1 text-sm text-slate-500">Manage active holds and revisit your reading trail.</p></div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-teal-700 shadow-sm hover:bg-teal-800" data-testid="button-new-reservation"><Plus className="h-4 w-4" /> Reserve a book</Button>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="border-slate-200 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your reservations" aria-label="Search reservations" /></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full border-slate-200 md:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All reservations</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="FULFILLED">Collected</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem><SelectItem value="EXPIRED">Expired</SelectItem></SelectContent></Select>
        </CardContent>
      </Card>
      {filtered.length === 0 ? <EmptyPanel icon={Sparkles} title={search || status !== "ALL" ? "Nothing matches this view" : "Your next read starts here"} description={search || status !== "ALL" ? "Try another search or show all reservations." : "Browse the catalog and reserve a title when you are ready."} href="/catalog" /> :
         <><div className="grid gap-4 lg:grid-cols-2">{visibleRows.map((row) => <ReservationCard key={row.id} row={row} onCancel={setCancelTarget} />)}</div><PatronPagination page={page} total={filtered.length} pageSize={pageSize} onPageChange={setPage} /></>}
    </div>
    <CreateReservationDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
      <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Cancel this reservation?</DialogTitle><DialogDescription>This will release your place in the queue for {cancelTarget?.bookTitle || "this book"}.</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" onClick={() => setCancelTarget(null)}>Keep reservation</Button><Button variant="destructive" onClick={() => cancelTarget && cancel.mutate(cancelTarget.id)} disabled={cancel.isPending} data-testid={cancelTarget ? `button-cancel-mine-${cancelTarget.id}` : undefined}>{cancel.isPending ? "Cancelling…" : "Cancel reservation"}</Button></DialogFooter></DialogContent>
    </Dialog>
  </MainLayout>;
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: number; tone: "teal" | "amber" | "sky" }) {
  const colors = { teal: "bg-teal-50 text-teal-700", amber: "bg-amber-50 text-amber-700", sky: "bg-sky-50 text-sky-700" };
  return <Card className="border-slate-200 shadow-sm"><CardContent className="flex items-center gap-3 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></div><div><p className="text-2xl font-semibold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div></CardContent></Card>;
}

function ReservationCard({ row, onCancel }: { row: ReservationApi; onCancel: (row: ReservationApi) => void }) {
  const active = row.status === "ACTIVE";
  const expires = new Date(row.expiresAt);
  return <Card className="group overflow-hidden border-slate-200 shadow-sm transition-shadow hover:shadow-md" data-testid={`row-reservation-${row.id}`}><CardContent className="p-0"><div className="flex gap-4 p-5"><div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-100 to-sky-100 text-teal-700"><BookOpen className="h-6 w-6" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate font-semibold text-slate-900">{row.bookTitle || `Book #${row.bookId}`}</h3><p className="mt-0.5 truncate text-sm text-slate-500">{row.bookAuthor || "Author not listed"}</p></div><Badge variant="outline" className={statusStyles[row.status]}>{statusLabels[row.status]}</Badge></div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><Library className="h-3.5 w-3.5 text-teal-600" />{row.libraryName || "Library"}</span><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-teal-600" />Reserved {format(new Date(row.reservedFor), "d MMM yyyy")}</span></div></div></div>{active && <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3"><p className={`text-xs ${isPast(expires) ? "text-amber-700" : "text-slate-500"}`}>{isPast(expires) ? "This hold has passed its collection date" : `Held until ${format(expires, "d MMM yyyy")}`}</p><Button variant="ghost" size="sm" className="gap-1 text-slate-500 hover:text-red-700" onClick={() => onCancel(row)} data-testid={`button-cancel-mine-${row.id}`}><Trash2 className="h-3.5 w-3.5" />Cancel</Button></div>}</CardContent></Card>;
}

function CreateReservationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [libraryId, setLibraryId] = useState("");
  const [bookId, setBookId] = useState<number | null>(null);
  const [bookSearch, setBookSearch] = useState("");
  const [reservedFor, setReservedFor] = useState("");
  const libraries = useQuery({ queryKey: ["patron-reservation-libraries"], queryFn: patronAccountApi.getReservationLibraries, enabled: open });
  const books = useQuery({ queryKey: ["patron-reservation-books", bookSearch], queryFn: () => booksApi.getAll(bookSearch || undefined), enabled: open });
  const selectedLibrary = libraries.data?.find((library) => String(library.id) === libraryId);
  const holdStartsAt = reservedFor ? new Date(`${reservedFor}T12:00:00`) : new Date();
  const estimatedExpiry = selectedLibrary ? addDays(holdStartsAt, selectedLibrary.reservationDays) : null;
  const create = useMutation({ mutationFn: () => reservationsApi.create({ items: [{ bookId: bookId!, libraryId: Number(libraryId), reservedFor: reservedFor ? new Date(`${reservedFor}T12:00:00`).toISOString() : undefined }] }), onSuccess: (res) => { if (res.created.length) toast.success("Your reservation is ready"); if (res.failed.length) toast.error(res.failed.map((f: any) => f.error).join(", ")); qc.invalidateQueries({ queryKey: ["patron-reservations"] }); onClose(); setBookId(null); setLibraryId(""); setBookSearch(""); setReservedFor(""); }, onError: (e: Error) => toast.error(e.message) });
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-teal-700" />Reserve your next read</DialogTitle><DialogDescription>Choose a title and the library where you would like to collect it.</DialogDescription></DialogHeader><div className="space-y-5"><div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 text-sm text-teal-950"><div className="flex items-start gap-3"><Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /><div><p className="font-semibold">Before you reserve</p><ul className="mt-2 space-y-1.5 text-xs leading-5 text-teal-900/80"><li><strong>One book at a time:</strong> this form creates one reservation per submission.</li><li><strong>More titles:</strong> submit the form again for each additional book.</li><li><strong>Collection window:</strong> the hold period is set by the library you choose. Select a library to see the exact number of days.</li></ul></div></div></div><div><Label>Library</Label><Select value={libraryId} onValueChange={setLibraryId}><SelectTrigger className="mt-1"><SelectValue placeholder="Choose a collection point" /></SelectTrigger><SelectContent>{(libraries.data ?? []).map((library) => <SelectItem key={library.id} value={String(library.id)}>{library.name} · {library.reservationDays} days</SelectItem>)}</SelectContent></Select>{selectedLibrary && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-teal-700"><Clock3 className="h-3.5 w-3.5" />{selectedLibrary.name} holds reserved books for {selectedLibrary.reservationDays} {selectedLibrary.reservationDays === 1 ? "day" : "days"}.</p>}</div><div><Label>Book</Label><div className="relative mt-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" value={bookSearch} onChange={(e) => { setBookSearch(e.target.value); setBookId(null); }} placeholder="Search title or author" data-testid="input-book-search" /></div><div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200">{(books.data ?? []).slice(0, 20).map((book) => <button type="button" key={book.id} onClick={() => { setBookId(book.id); setBookSearch(book.title); }} className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-teal-50 ${bookId === book.id ? "bg-teal-50 text-teal-900" : ""}`} data-testid={`book-option-${book.id}`}><span><span className="font-medium">{book.title}</span><span className="ml-2 text-xs text-slate-500">{book.author}</span></span>{bookId === book.id && <Check className="h-4 w-4 text-teal-700" />}</button>)}{books.isLoading && <p className="p-3 text-xs text-slate-500">Searching the catalog…</p>}{!books.isLoading && !books.data?.length && <p className="p-3 text-xs text-slate-500">No books found.</p>}</div></div><div><Label>Collection date <span className="font-normal text-slate-400">(optional)</span></Label><Input className="mt-1" type="date" min={format(new Date(), "yyyy-MM-dd")} value={reservedFor} onChange={(e) => setReservedFor(e.target.value)} data-testid="input-reserved-for" /><p className="mt-1.5 text-xs text-slate-500">Leave blank to start the hold today.</p></div>{selectedLibrary && estimatedExpiry && <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"><span className="text-slate-600">Estimated collection deadline</span><strong className="text-slate-900">{format(estimatedExpiry, "d MMM yyyy")}</strong></div>}</div><DialogFooter><Button variant="ghost" onClick={onClose}>Not now</Button><Button className="bg-teal-700 hover:bg-teal-800" onClick={() => create.mutate()} disabled={!libraryId || !bookId || create.isPending} data-testid="button-submit-reservation">{create.isPending ? "Reserving…" : "Place reservation"}</Button></DialogFooter></DialogContent></Dialog>;
}