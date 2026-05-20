import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pendingFinesApi, circulationApi, paymentMethodsApi, librariesApi, type PendingFineUser, type PendingFineCirculation, type PaymentSplit, type ReturnPayload } from "@/lib/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrency } from "@/lib/useCurrency";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Banknote, Search, ChevronDown, ChevronRight, AlertCircle,
  Users, Plus, Trash2, Loader2, BookOpen, RefreshCw,
} from "lucide-react";
import { format as fmtDate } from "date-fns";

function roleBadgeVariant(role: string) {
  if (role === "STUDENT") return "secondary";
  if (role === "FACULTY") return "outline";
  return "default";
}

interface CollectPaymentDialogProps {
  circ: PendingFineCirculation | null;
  userName: string;
  onClose: () => void;
}

function CollectPaymentDialog({ circ, userName, onClose }: CollectPaymentDialogProps) {
  const open = circ !== null;
  const { format, currency } = useCurrency();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods", "active"],
    queryFn: () => paymentMethodsApi.getAll(true),
    enabled: open,
  });

  const [splits, setSplits] = useState<Array<{
    paymentMethodId: number | null;
    amountMajor: string;
    paymentType: "FINE" | "DAMAGE";
    referenceNumber: string;
  }>>([]);
  const [waiveFineMajor, setWaiveFineMajor] = useState("");
  const [waiveDamageMajor, setWaiveDamageMajor] = useState("");
  const [waiveReason, setWaiveReason] = useState("");

  const fineOutCents = circ?.fineOutstandingCents ?? 0;
  const dmgOutCents = circ?.damageOutstandingCents ?? 0;
  const waiveFineCents = Math.round(parseFloat(waiveFineMajor || "0") * 100);
  const waiveDamageCents = Math.round(parseFloat(waiveDamageMajor || "0") * 100);

  const fineSplitCents = useMemo(() =>
    splits.filter(s => s.paymentType === "FINE").reduce((sum, s) => sum + Math.round(parseFloat(s.amountMajor || "0") * 100), 0),
    [splits]);
  const dmgSplitCents = useMemo(() =>
    splits.filter(s => s.paymentType === "DAMAGE").reduce((sum, s) => sum + Math.round(parseFloat(s.amountMajor || "0") * 100), 0),
    [splits]);

  const fineOver = fineSplitCents + waiveFineCents > fineOutCents;
  const dmgOver = dmgSplitCents + waiveDamageCents > dmgOutCents;
  const fineRemaining = Math.max(0, fineOutCents - fineSplitCents - waiveFineCents);
  const dmgRemaining = Math.max(0, dmgOutCents - dmgSplitCents - waiveDamageCents);

  const addSplit = (paymentType: "FINE" | "DAMAGE") => {
    const remaining = paymentType === "FINE" ? Math.max(0, fineOutCents - fineSplitCents - waiveFineCents) : Math.max(0, dmgOutCents - dmgSplitCents - waiveDamageCents);
    setSplits(prev => [...prev, {
      paymentMethodId: paymentMethods[0]?.id ?? null,
      amountMajor: remaining > 0 ? (remaining / 100).toFixed(2) : "",
      paymentType,
      referenceNumber: "",
    }]);
  };

  const updateSplit = (idx: number, field: string, value: any) =>
    setSplits(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));

  const removeSplit = (idx: number) =>
    setSplits(prev => prev.filter((_, i) => i !== idx));

  const collectMutation = useMutation({
    mutationFn: (payload: ReturnPayload) => circulationApi.collectFine(circ!.circulationId, payload),
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      queryClient.invalidateQueries({ queryKey: ["pending-fines"] });
      queryClient.invalidateQueries({ queryKey: ["circulation"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (fineOver) { toast.error("Fine payments + waiver exceed outstanding balance"); return; }
    if (dmgOver) { toast.error("Damage payments + waiver exceed damage balance"); return; }
    const validSplits = splits.filter(s => s.paymentMethodId && parseFloat(s.amountMajor || "0") > 0);
    for (const s of validSplits) {
      if (!s.paymentMethodId) { toast.error("Choose a payment method for every payment line"); return; }
    }
    if ((waiveFineCents > 0 || waiveDamageCents > 0) && !waiveReason.trim()) {
      toast.error("Please provide a reason for the waiver");
      return;
    }
    if (validSplits.length === 0 && waiveFineCents === 0 && waiveDamageCents === 0) {
      toast.error("Add at least one payment or waiver amount");
      return;
    }
    const payload: ReturnPayload = {
      payments: validSplits.map<PaymentSplit>(s => ({
        paymentMethodId: s.paymentMethodId!,
        amount: Math.round(parseFloat(s.amountMajor) * 100),
        paymentType: s.paymentType,
        referenceNumber: s.referenceNumber || undefined,
      })),
      waiveFineAmount: waiveFineCents || undefined,
      waiveDamageAmount: waiveDamageCents || undefined,
      waiveReason: (waiveFineCents > 0 || waiveDamageCents > 0) ? waiveReason : undefined,
    };
    collectMutation.mutate(payload);
  };

  const handleClose = () => {
    setSplits([]);
    setWaiveFineMajor("");
    setWaiveDamageMajor("");
    setWaiveReason("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" data-testid="dialog-collect-payment">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Banknote className="h-5 w-5" /> Collect Fine Payment</DialogTitle>
          <DialogDescription>
            {circ ? `${circ.bookTitle} · ${userName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {circ && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/30 grid grid-cols-2 gap-3 text-sm">
              {fineOutCents > 0 && (
                <div>
                  <div className="text-muted-foreground text-xs">Fine outstanding</div>
                  <div className="font-bold text-base text-red-600" data-testid="text-fine-outstanding">{format(fineOutCents)}</div>
                </div>
              )}
              {dmgOutCents > 0 && (
                <div>
                  <div className="text-muted-foreground text-xs">Damage outstanding</div>
                  <div className="font-bold text-base text-orange-600" data-testid="text-damage-outstanding">{format(dmgOutCents)}</div>
                </div>
              )}
              <div className="col-span-2 text-xs text-muted-foreground">
                Returned: {circ.returnDate ? fmtDate(new Date(circ.returnDate), "dd MMM yyyy") : "–"}
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Payment lines</Label>
                <div className="flex gap-2">
                  {fineOutCents > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addSplit("FINE")} data-testid="button-add-fine-split">
                      <Plus className="h-3 w-3 mr-1" /> Fine
                    </Button>
                  )}
                  {dmgOutCents > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => addSplit("DAMAGE")} data-testid="button-add-damage-split">
                      <Plus className="h-3 w-3 mr-1" /> Damage
                    </Button>
                  )}
                </div>
              </div>
              {splits.length === 0 && <p className="text-xs text-muted-foreground">No payment lines added yet.</p>}
              {splits.map((s, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center" data-testid={`row-split-${idx}`}>
                  <Badge variant={s.paymentType === "FINE" ? "default" : "secondary"} className="col-span-2 justify-center text-xs">{s.paymentType}</Badge>
                  <div className="col-span-4">
                    <Select value={s.paymentMethodId?.toString() ?? ""} onValueChange={v => updateSplit(idx, "paymentMethodId", parseInt(v))}>
                      <SelectTrigger className="h-8" data-testid={`select-method-${idx}`}><SelectValue placeholder="Method" /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input type="number" step="0.01" min="0" placeholder={currency.symbol}
                    value={s.amountMajor} onChange={e => updateSplit(idx, "amountMajor", e.target.value)}
                    className="col-span-3 h-8" data-testid={`input-amount-${idx}`} />
                  <Input placeholder="Ref #" value={s.referenceNumber}
                    onChange={e => updateSplit(idx, "referenceNumber", e.target.value)}
                    className="col-span-2 h-8" data-testid={`input-ref-${idx}`} />
                  <Button type="button" variant="ghost" size="icon" className="col-span-1 h-8 w-8" onClick={() => removeSplit(idx)} data-testid={`button-remove-split-${idx}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {splits.length > 0 && (
                <div className="text-xs text-muted-foreground pt-2 border-t flex flex-wrap gap-x-4 gap-y-1">
                  {fineOutCents > 0 && <span>Fine: <strong className={fineOver ? "text-red-600" : ""}>{format(fineSplitCents)}</strong> / {format(fineOutCents)}</span>}
                  {dmgOutCents > 0 && <span>Damage: <strong className={dmgOver ? "text-red-600" : ""}>{format(dmgSplitCents)}</strong> / {format(dmgOutCents)}</span>}
                </div>
              )}
            </div>

            {(fineOutCents > 0 || dmgOutCents > 0) && (
              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <Label className="text-sm font-medium">{isAdmin ? "Waive amount" : "Request waiver"}</Label>
                  <p className="text-xs text-muted-foreground">{isAdmin ? "Applied immediately as admin." : "Sent to an admin for approval."}</p>
                </div>
                {fineOutCents > 0 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-32">Fine waiver ({currency.symbol})</Label>
                    <Input type="number" step="0.01" min="0" value={waiveFineMajor}
                      onChange={e => setWaiveFineMajor(e.target.value)} className="h-8" data-testid="input-waive-fine" />
                  </div>
                )}
                {dmgOutCents > 0 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-32">Damage waiver ({currency.symbol})</Label>
                    <Input type="number" step="0.01" min="0" value={waiveDamageMajor}
                      onChange={e => setWaiveDamageMajor(e.target.value)} className="h-8" data-testid="input-waive-damage" />
                  </div>
                )}
                {(waiveFineCents > 0 || waiveDamageCents > 0) && (
                  <Textarea placeholder="Reason for waiver (required)" rows={2}
                    value={waiveReason} onChange={e => setWaiveReason(e.target.value)}
                    data-testid="textarea-waive-reason" />
                )}
              </div>
            )}

            <Separator />
            <div className="space-y-1 text-sm">
              {fineOutCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fine remaining after collection:</span>
                  <span className={fineRemaining > 0 ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>{format(fineRemaining)}</span>
                </div>
              )}
              {dmgOutCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Damage remaining:</span>
                  <span className={dmgRemaining > 0 ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>{format(dmgRemaining)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-collect">Cancel</Button>
          <Button onClick={handleSubmit} disabled={collectMutation.isPending || fineOver || dmgOver} data-testid="button-confirm-collect">
            {collectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UserRowProps {
  userEntry: PendingFineUser;
  onCollect: (circ: PendingFineCirculation, userName: string) => void;
}

function UserRow({ userEntry, onCollect }: UserRowProps) {
  const [open, setOpen] = useState(false);
  const { format } = useCurrency();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50 select-none" data-testid={`row-user-${userEntry.userId}`}>
          <TableCell className="w-8">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </TableCell>
          <TableCell>
            <div className="font-medium">{userEntry.userName}</div>
            <div className="text-xs text-muted-foreground">{userEntry.userEmail}</div>
          </TableCell>
          <TableCell>
            <Badge variant={roleBadgeVariant(userEntry.userRole)} className="text-xs">{userEntry.userRole}</Badge>
          </TableCell>
          <TableCell className="text-muted-foreground text-sm">{userEntry.membershipId || "–"}</TableCell>
          <TableCell className="text-right">
            <span className="font-bold text-red-600" data-testid={`text-total-due-${userEntry.userId}`}>{format(userEntry.totalOutstandingCents)}</span>
          </TableCell>
          <TableCell className="text-center text-xs text-muted-foreground">{userEntry.circulations.length} record{userEntry.circulations.length !== 1 ? "s" : ""}</TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <>
          {userEntry.circulations.map(circ => (
            <TableRow key={circ.circulationId} className="bg-muted/20 border-l-4 border-l-amber-400" data-testid={`row-circ-${circ.circulationId}`}>
              <TableCell />
              <TableCell>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium">{circ.bookTitle}</div>
                    {circ.bookIsbn && <div className="text-xs text-muted-foreground">ISBN {circ.bookIsbn}</div>}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {circ.libraryName && <span className="text-xs text-muted-foreground">{circ.libraryName}</span>}
              </TableCell>
              <TableCell>
                <div className="text-xs space-y-0.5">
                  <div className="text-muted-foreground">Due: {fmtDate(new Date(circ.dueDate), "dd MMM yy")}</div>
                  {circ.returnDate && <div className="text-muted-foreground">Returned: {fmtDate(new Date(circ.returnDate), "dd MMM yy")}</div>}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="text-sm space-y-0.5">
                  {circ.fineOutstandingCents > 0 && (
                    <div className="text-red-600 font-medium">{format(circ.fineOutstandingCents)} <span className="text-xs font-normal text-muted-foreground">fine</span></div>
                  )}
                  {circ.damageOutstandingCents > 0 && (
                    <div className="text-orange-600 font-medium">{format(circ.damageOutstandingCents)} <span className="text-xs font-normal text-muted-foreground">damage</span></div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Button size="sm" variant="outline" onClick={() => onCollect(circ, userEntry.userName)}
                  data-testid={`button-collect-${circ.circulationId}`}>
                  <Banknote className="h-3.5 w-3.5 mr-1" /> Collect
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function PendingFinesPage() {
  const { format } = useCurrency();
  const [libraryFilter, setLibraryFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [collectTarget, setCollectTarget] = useState<{ circ: PendingFineCirculation; userName: string } | null>(null);

  const { data: libraries = [] } = useQuery({
    queryKey: ["libraries"],
    queryFn: () => librariesApi.getAll(),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["pending-fines", libraryFilter, search],
    queryFn: () => pendingFinesApi.getAll({
      libraryId: libraryFilter !== "all" ? parseInt(libraryFilter) : undefined,
      search: search || undefined,
    }),
  });

  const users = data?.users ?? [];
  const grandTotal = data?.grandTotalCents ?? 0;

  const handleSearch = () => setSearch(searchInput.trim());

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Banknote className="h-6 w-6" /> Pending Fine Cases
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Returned books with outstanding fine or damage balances
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-fines">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Patrons with Due Fines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="stat-patron-count">{data?.total ?? "–"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Banknote className="h-4 w-4" /> Total Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600" data-testid="stat-grand-total">{format(grandTotal)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Total Circulation Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="stat-circ-count">
                {users.reduce((s, u) => s + u.circulations.length, 0) || "–"}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or ID…"
              className="pl-9"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              data-testid="input-search-fines"
            />
          </div>
          <Button onClick={handleSearch} data-testid="button-search-fines">
            <Search className="h-4 w-4 mr-2" /> Search
          </Button>
          <Select value={libraryFilter} onValueChange={setLibraryFilter} data-testid="select-library-filter">
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All libraries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All libraries</SelectItem>
              {libraries.map((lib: any) => (
                <SelectItem key={lib.id} value={String(lib.id)}>{lib.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <AlertCircle className="h-8 w-8" />
            <p>Failed to load pending fines. <Button variant="link" onClick={() => refetch()}>Try again</Button></p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground border rounded-lg bg-muted/10">
            <Banknote className="h-10 w-10 opacity-30" />
            <p className="font-medium">No pending fine cases found</p>
            <p className="text-sm text-center max-w-sm">
              {search || libraryFilter !== "all"
                ? "Try clearing your filters."
                : "All outstanding fines have been collected or waived."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Patron</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Member ID</TableHead>
                  <TableHead className="text-right">Total Due</TableHead>
                  <TableHead className="text-center">Records</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <UserRow
                    key={u.userId}
                    userEntry={u}
                    onCollect={(circ, userName) => setCollectTarget({ circ, userName })}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Only <strong>returned</strong> circulations with an unpaid fine or damage balance appear here.
            Active loans with accruing fines are shown in the Circulation page.
            Click a patron row to expand and view per-book details, then click <strong>Collect</strong> to record a payment.
          </span>
        </div>
      </div>

      <CollectPaymentDialog
        circ={collectTarget?.circ ?? null}
        userName={collectTarget?.userName ?? ""}
        onClose={() => setCollectTarget(null)}
      />
    </MainLayout>
  );
}
