import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reservationsApi, librariesApi, booksApi, usersApi, type ReservationApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, BookmarkCheck, Trash2, ScanLine, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { format as formatDate } from "date-fns";

type Filters = {
  status?: string;
  libraryId?: number;
  bookId?: number;
  userId?: number;
};

export default function ReservationsPage() {
  const { user } = useAuth();
  const isStaff = user?.role === "ADMIN" || user?.role === "LIBRARIAN";
  const qc = useQueryClient();

  const [filters, setFilters] = useState<Filters>({ status: "ACTIVE" });
  const [createOpen, setCreateOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupSeed, setPickupSeed] = useState<ReservationApi[] | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["reservations", filters],
    queryFn: () => reservationsApi.list(filters as any),
  });
  const { data: libraries = [] } = useQuery({ queryKey: ["libraries"], queryFn: () => librariesApi.getAll() });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => reservationsApi.cancel(id, reason),
    onSuccess: () => { toast.success("Reservation cancelled"); qc.invalidateQueries({ queryKey: ["reservations"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const groupedByUser = useMemo(() => {
    const map: Record<number, ReservationApi[]> = {};
    rows.forEach(r => {
      if (r.status !== 'ACTIVE') return;
      (map[r.userId] = map[r.userId] || []).push(r);
    });
    return map;
  }, [rows]);

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><BookmarkCheck className="h-6 w-6" /> Reservations</h1>
            <p className="text-sm text-muted-foreground">Holds placed by patrons. Active holds tie up an available copy until expiry.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} data-testid="button-new-reservation">
            <Plus className="h-4 w-4 mr-2" /> New Reservation
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={filters.status || 'ALL'} onValueChange={v => setFilters(f => ({ ...f, status: v === 'ALL' ? undefined : v }))}>
                  <SelectTrigger data-testid="select-filter-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="FULFILLED">Fulfilled</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Library</Label>
                <Select value={filters.libraryId ? String(filters.libraryId) : 'ALL'} onValueChange={v => setFilters(f => ({ ...f, libraryId: v === 'ALL' ? undefined : parseInt(v) }))}>
                  <SelectTrigger data-testid="select-filter-library"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All libraries</SelectItem>
                    {libraries.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Patron name / identifier</Label>
                <Input placeholder="Search will filter list below"
                  data-testid="input-filter-patron"
                  onChange={(e) => setFilters(f => ({ ...f, _q: e.target.value } as any))} />
              </div>
              <div>
                <Label className="text-xs">Book title</Label>
                <Input placeholder="Search will filter list below"
                  data-testid="input-filter-book"
                  onChange={(e) => setFilters(f => ({ ...f, _b: e.target.value } as any))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Reservations</CardTitle>
              <CardDescription>{isLoading ? "Loading…" : `${rows.length} record(s)`}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patron</TableHead>
                  <TableHead>Book</TableHead>
                  <TableHead>Library</TableHead>
                  <TableHead>Copy</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No reservations</TableCell></TableRow>
                ) : rows
                    .filter((r: any) => {
                      const q = (filters as any)._q?.toLowerCase();
                      const b = (filters as any)._b?.toLowerCase();
                      if (q && !(r.userName?.toLowerCase().includes(q) || r.userIdentifier?.toLowerCase().includes(q))) return false;
                      if (b && !(r.bookTitle?.toLowerCase().includes(b))) return false;
                      return true;
                    })
                    .map(r => (
                  <TableRow key={r.id} data-testid={`row-reservation-${r.id}`}>
                    <TableCell>
                      <div className="font-medium">{r.userName || `User #${r.userId}`}</div>
                      <div className="text-xs text-muted-foreground">{r.userIdentifier}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.bookTitle || `Book #${r.bookId}`}</div>
                      <div className="text-xs text-muted-foreground">{r.bookAuthor}</div>
                    </TableCell>
                    <TableCell>{r.libraryName}</TableCell>
                    <TableCell className="font-mono text-xs">{r.copySSN || r.copyBarcode || '—'}</TableCell>
                    <TableCell className="text-xs">{formatDate(new Date(r.reservedFor), "PP")}</TableCell>
                    <TableCell className="text-xs">{formatDate(new Date(r.expiresAt), "PP")}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.status === 'ACTIVE' && isStaff && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => { setPickupSeed(groupedByUser[r.userId] || [r]); setPickupOpen(true); }} data-testid={`button-pickup-${r.id}`}>
                            <ScanLine className="h-3 w-3 mr-1" /> Pickup
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => {
                            const reason = prompt("Cancel reason (optional)") || undefined;
                            cancelMut.mutate({ id: r.id, reason });
                          }} data-testid={`button-cancel-${r.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {r.status === 'ACTIVE' && !isStaff && r.userId === user?.id && (
                        <Button size="sm" variant="ghost" onClick={() => cancelMut.mutate({ id: r.id })} data-testid={`button-cancel-mine-${r.id}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <CreateReservationDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultUserId={isStaff ? undefined : user?.id}
        showPatronPicker={isStaff}
      />
      {pickupOpen && pickupSeed && (
        <PickupWizard
          open={pickupOpen}
          onClose={() => { setPickupOpen(false); setPickupSeed(null); }}
          candidateReservations={pickupSeed}
        />
      )}
    </MainLayout>
  );
}

function StatusBadge({ status }: { status: ReservationApi["status"] }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-blue-100 text-blue-800",
    FULFILLED: "bg-green-100 text-green-800",
    CANCELLED: "bg-gray-200 text-gray-700",
    EXPIRED: "bg-amber-100 text-amber-800",
  };
  return <Badge variant="secondary" className={map[status]} data-testid={`status-${status.toLowerCase()}`}>{status}</Badge>;
}

// ---------------- Create Reservation Dialog ----------------

function CreateReservationDialog({ open, onClose, defaultUserId, showPatronPicker }: {
  open: boolean; onClose: () => void; defaultUserId?: number; showPatronPicker: boolean;
}) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<number | undefined>(defaultUserId);
  const [libraryId, setLibraryId] = useState<number | undefined>();
  const [bookIds, setBookIds] = useState<number[]>([]);
  const [reservedFor, setReservedFor] = useState<string>("");
  const [bookSearch, setBookSearch] = useState("");
  const [patronSearch, setPatronSearch] = useState("");

  const { data: libraries = [] } = useQuery({ queryKey: ["libraries"], queryFn: () => librariesApi.getAll() });
  const { data: books = [] } = useQuery({
    queryKey: ["books", bookSearch],
    queryFn: () => booksApi.getAll(bookSearch || undefined),
  });
  const { data: patrons = [] } = useQuery({
    queryKey: ["patrons-search"],
    queryFn: () => usersApi.getAll(),
    enabled: showPatronPicker,
  });

  const createMut = useMutation({
    mutationFn: () => reservationsApi.create({
      userId: showPatronPicker ? userId : undefined,
      items: bookIds.map(bookId => ({ bookId, libraryId: libraryId!, reservedFor: reservedFor || undefined })),
    }),
    onSuccess: (res) => {
      const okCount = res.created.length;
      const failCount = res.failed.length;
      if (okCount > 0) toast.success(`${okCount} reservation(s) created${failCount ? `, ${failCount} failed` : ''}`);
      if (failCount > 0) {
        const msg = res.failed.map((f: any) => `Book #${f.bookId}: ${f.error}`).join("\n");
        toast.error(msg);
      }
      qc.invalidateQueries({ queryKey: ["reservations"] });
      onClose();
      setBookIds([]); setLibraryId(undefined); setReservedFor("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredPatrons = patrons.filter((p: any) => {
    if (p.category !== 'PATRON') return false;
    if (!patronSearch) return true;
    const q = patronSearch.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q) || p.studentId?.toLowerCase().includes(q) || p.employeeId?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
  }).slice(0, 50);

  const canSubmit = libraryId && bookIds.length > 0 && (!showPatronPicker || userId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Reservation</DialogTitle>
          <DialogDescription>System will hold an available copy in the chosen library for each book.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {showPatronPicker && (
            <div>
              <Label>Patron</Label>
              <Input placeholder="Search by name, username, ID, email" value={patronSearch} onChange={e => setPatronSearch(e.target.value)} data-testid="input-patron-search" />
              {patronSearch && (
                <div className="border rounded mt-2 max-h-40 overflow-y-auto">
                  {filteredPatrons.map((p: any) => (
                    <div key={p.id}
                      className={`px-2 py-1.5 cursor-pointer hover:bg-muted text-sm ${userId === p.id ? 'bg-muted' : ''}`}
                      onClick={() => { setUserId(p.id); setPatronSearch(p.name); }}
                      data-testid={`patron-option-${p.id}`}>
                      <span className="font-medium">{p.name}</span>{' '}
                      <span className="text-xs text-muted-foreground">({p.studentId || p.employeeId || p.username})</span>
                    </div>
                  ))}
                  {filteredPatrons.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No patrons match</div>}
                </div>
              )}
              {userId && <div className="text-xs text-muted-foreground mt-1">Selected user ID: {userId}</div>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Library</Label>
              <Select value={libraryId ? String(libraryId) : ''} onValueChange={v => setLibraryId(parseInt(v))}>
                <SelectTrigger data-testid="select-reserve-library"><SelectValue placeholder="Choose library" /></SelectTrigger>
                <SelectContent>{libraries.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reservation date (optional)</Label>
              <Input type="date" value={reservedFor} onChange={e => setReservedFor(e.target.value ? new Date(e.target.value).toISOString() : '')} data-testid="input-reserved-for" />
            </div>
          </div>

          <div>
            <Label>Books</Label>
            <Input placeholder="Search title / author / ISBN" value={bookSearch} onChange={e => setBookSearch(e.target.value)} data-testid="input-book-search" />
            <div className="border rounded mt-2 max-h-48 overflow-y-auto">
              {books.slice(0, 50).map((b: any) => {
                const selected = bookIds.includes(b.id);
                return (
                  <div key={b.id}
                    className={`px-2 py-1.5 cursor-pointer hover:bg-muted text-sm flex items-center justify-between ${selected ? 'bg-muted' : ''}`}
                    onClick={() => setBookIds(prev => selected ? prev.filter(x => x !== b.id) : [...prev, b.id])}
                    data-testid={`book-option-${b.id}`}>
                    <div>
                      <span className="font-medium">{b.title}</span>{' '}
                      <span className="text-xs text-muted-foreground">— {b.author}</span>
                    </div>
                    {selected && <Badge variant="secondary">selected</Badge>}
                  </div>
                );
              })}
              {books.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No books found</div>}
            </div>
            {bookIds.length > 0 && <div className="text-xs text-muted-foreground mt-1">{bookIds.length} book(s) selected</div>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={!canSubmit || createMut.isPending} data-testid="button-submit-reservation">
            {createMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Reserve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Pickup Wizard ----------------

function PickupWizard({ open, onClose, candidateReservations }: {
  open: boolean; onClose: () => void; candidateReservations: ReservationApi[];
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [scannedSSNs, setScannedSSNs] = useState<string[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [pickupId, setPickupId] = useState<number | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string>("");

  // Match scanned SSN/barcode against the candidate set
  const matched = useMemo(() => {
    return candidateReservations.filter(r => {
      const tag = (r.copySSN || r.copyBarcode || '').toLowerCase();
      return scannedSSNs.some(s => s.toLowerCase() === tag);
    });
  }, [scannedSSNs, candidateReservations]);

  const initiateMut = useMutation({
    mutationFn: () => reservationsApi.initiatePickup({
      reservationIds: matched.map(m => m.id),
      userIdentifier: identifier.trim(),
    }),
    onSuccess: (res) => {
      setPickupId(res.pickupId);
      setMaskedEmail(res.maskedEmail);
      setStep(3);
      toast.success(`OTP sent to ${res.maskedEmail}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: () => reservationsApi.confirmPickup({ pickupId: pickupId!, otp: otp.trim() }),
    onSuccess: () => {
      toast.success("Reservation(s) fulfilled — books issued");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["circulation"] });
      setStep(4);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addScan = () => {
    const v = scanInput.trim();
    if (!v) return;
    if (!scannedSSNs.includes(v)) setScannedSSNs(prev => [...prev, v]);
    setScanInput("");
  };

  const patron = candidateReservations[0];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reservation Pickup — {patron?.userName}</DialogTitle>
          <DialogDescription>
            Step {step} of 4 — {step === 1 ? "Scan/enter book SSN(s)" : step === 2 ? "Confirm patron identity" : step === 3 ? "Verify OTP" : "Complete"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Available reserved books for {patron?.userName}</Label>
              <div className="border rounded mt-1 max-h-40 overflow-y-auto">
                {candidateReservations.map(r => {
                  const tag = r.copySSN || r.copyBarcode;
                  const isMatched = matched.some(m => m.id === r.id);
                  return (
                    <div key={r.id} className={`px-2 py-1.5 text-sm flex items-center justify-between ${isMatched ? 'bg-green-50' : ''}`}>
                      <div>
                        <span className="font-medium">{r.bookTitle}</span>{' '}
                        <span className="text-xs text-muted-foreground font-mono">[{tag}]</span>
                      </div>
                      {isMatched && <Badge className="bg-green-100 text-green-800">scanned</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Scan or enter SSN / barcode</Label>
              <div className="flex gap-2">
                <Input value={scanInput} onChange={e => setScanInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addScan())}
                  placeholder="e.g. SSN001 or 9780553213119" data-testid="input-scan-ssn" autoFocus />
                <Button onClick={addScan} data-testid="button-add-scan">Add</Button>
              </div>
              {scannedSSNs.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {scannedSSNs.map(s => (
                    <Badge key={s} variant="outline" className="font-mono">
                      {s}
                      <button className="ml-1" onClick={() => setScannedSSNs(prev => prev.filter(x => x !== s))} data-testid={`button-remove-scan-${s}`}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {matched.length} of {candidateReservations.length} reservation(s) matched.
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-sm">
              Enter the patron's <strong>enrollment number</strong>, <strong>employee ID</strong>, or username to confirm identity.
            </div>
            <div>
              <Label>Patron identifier</Label>
              <Input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="STU2025001 / EMP123 / username" data-testid="input-identifier" autoFocus />
              <div className="text-xs text-muted-foreground mt-1">An OTP will be emailed to {patron?.userEmail ? patron.userEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3") : 'the patron'}.</div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="text-sm">An OTP has been sent to <span className="font-mono">{maskedEmail}</span>. Ask the patron to read it out and enter it below.</div>
            <div>
              <Label>OTP</Label>
              <Input value={otp} onChange={e => setOtp(e.target.value)} placeholder="6-digit code" maxLength={8} data-testid="input-otp" autoFocus className="font-mono text-lg tracking-widest" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-center py-6">
            <BookmarkCheck className="h-12 w-12 mx-auto text-green-600" />
            <div className="text-lg font-medium">Books issued successfully</div>
            <div className="text-sm text-muted-foreground">{matched.length} reservation(s) fulfilled and circulation records created.</div>
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button disabled={matched.length === 0} onClick={() => setStep(2)} data-testid="button-next-to-identity">Next</Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button disabled={!identifier.trim() || initiateMut.isPending} onClick={() => initiateMut.mutate()} data-testid="button-send-otp">
                {initiateMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Send OTP
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button disabled={otp.trim().length < 4 || confirmMut.isPending} onClick={() => confirmMut.mutate()} data-testid="button-confirm-otp">
                {confirmMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirm & Issue
              </Button>
            </>
          )}
          {step === 4 && <Button onClick={onClose} data-testid="button-close-pickup">Close</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
