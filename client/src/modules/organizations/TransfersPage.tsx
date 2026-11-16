import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/lib/auth";
import { libraryAccessApi, librariesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Truck, ArrowRightLeft, PackageCheck } from "lucide-react";

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Transfer request failed");
  return body;
}
const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
function parseAllocations(value: string, itemId: number) {
  if (!value.trim()) return [];
  return value.split(",").map(entry => {
    const [libraryId, quantity] = entry.split(":").map(Number);
    if (!Number.isInteger(libraryId) || !Number.isInteger(quantity) || libraryId < 1 || quantity < 1) throw new Error("Use libraryId:quantity pairs, separated by commas");
    return { itemId, libraryId, quantity };
  });
}

export default function TransfersPage() {
  const [pathname] = useLocation();
  const queueOnly = pathname === "/transfers/acquisitions";
  const reviewOnly = pathname === "/transfer-approvals";
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const localAdmin = user?.role === "ADMIN" && user.isLocalUser;
  const { data: access } = useQuery({ queryKey: ["library-access"], queryFn: libraryAccessApi.getMine, enabled: user?.role === "LIBRARIAN" });
  const { data: libraries = [] } = useQuery({ queryKey: ["libraries"], queryFn: librariesApi.getAll, enabled: !!localAdmin });
  const [libraryId, setLibraryId] = useState<number | null>(null);
  const destinationId = libraryId || access?.libraries[0]?.id || libraries[0]?.id || 0;
  const canActForDestination = !!localAdmin || !!access?.libraries.some((library: any) => library.id === destinationId);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [withdrawDialogRequestId, setWithdrawDialogRequestId] = useState<number | null>(null);
  const [rejectRequestId, setRejectRequestId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [sourceReviewRequest, setSourceReviewRequest] = useState<any>(null);
  const [sourceAllocations, setSourceAllocations] = useState<Record<number, { libraryId: number; quantity: number }[]>>({});
  const [acquisitionQuantities, setAcquisitionQuantities] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<Record<number, { quantity: number; sourceId: number; sourceQuantity: number; preferredSources: { libraryId: number; quantity: number }[] }>>({});
  const { data: catalog = [] } = useQuery({
    queryKey: ["transfer-catalog", destinationId, search],
    queryFn: () => api<any[]>(`/transfers/catalog?libraryId=${destinationId}&search=${encodeURIComponent(search)}`),
    enabled: destinationId > 0 && search.trim().length >= 2,
  });
  const { data: requests = [], isLoading } = useQuery({ queryKey: ["transfers"], queryFn: () => api<any[]>("/transfers"), refetchInterval: 15000 });
  const sourceCatalogQueries = useQueries({
    queries: (sourceReviewRequest?.items || []).map((item: any) => ({
      queryKey: ["transfer-approval-catalog", sourceReviewRequest.destinationLibraryId, item.bookId],
      queryFn: () => api<any[]>(`/transfers/catalog?libraryId=${sourceReviewRequest.destinationLibraryId}&search=${encodeURIComponent(item.book?.isbn || item.book?.title || "")}`),
      enabled: !!sourceReviewRequest,
    })),
  });
  const { data: acquisitionRows = [] } = useQuery({
    queryKey: ["transfer-acquisitions"],
    queryFn: () => api<any[]>("/transfers/acquisitions"),
    enabled: !!localAdmin,
  });
  const { data: notifications = [] } = useQuery({ queryKey: ["transfer-notifications"], queryFn: () => api<any[]>("/transfers/notifications") });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["transfers"] });
    queryClient.invalidateQueries({ queryKey: ["transfer-catalog"] });
    queryClient.invalidateQueries({ queryKey: ["transfer-acquisitions"] });
    queryClient.invalidateQueries({ queryKey: ["transfer-notifications"] });
  };
  const mutate = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) => api(path, json(body)),
    onSuccess: () => { toast.success("Transfer updated"); setSourceReviewRequest(null); setRejectRequestId(null); setRejectionReason(""); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const createRequest = useMutation({
    mutationFn: () => api("/transfers", json({
      destinationLibraryId: destinationId,
      reason,
      items: Object.entries(selected).filter(([, row]) => row.quantity > 0).map(([bookId, row]) => ({
        bookId: Number(bookId), quantity: row.quantity,
        preferredSources: row.preferredSources,
      })),
    })),
    onSuccess: () => { toast.success("Transfer request submitted"); setSelected({}); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const mine = useMemo(() => requests, [requests]);
  const withdrawnRequests = useMemo(
    () => requests.filter((request: any) => request.status === "CANCELLED"),
    [requests],
  );
  const reviewRequests = useMemo(
    () => requests.filter((request: any) => ["PENDING_REVIEW", "NEEDS_REALLOCATION"].includes(request.status)),
    [requests],
  );
  const setBook = (bookId: number, patch: Partial<{ quantity: number; sourceId: number; sourceQuantity: number; preferredSources: { libraryId: number; quantity: number }[] }>) =>
    setSelected(current => {
      const previous = current[bookId] || { quantity: 1, sourceId: 0, sourceQuantity: 1, preferredSources: [] };
      return { ...current, [bookId]: { ...previous, ...patch } };
    });

  const approve = (request: any) => {
    const allocations: any[] = [];
    const acquisitions: any[] = [];
    for (const item of request.items) {
      const preferred = (item.legs || []).filter((leg: any) => leg.status === "PREFERRED");
      let allocated = 0;
      for (const leg of preferred) {
        const quantity = Math.min(leg.requestedQuantity, item.requestedQuantity - allocated);
        if (quantity > 0) {
          allocations.push({ itemId: item.id, libraryId: leg.sourceLibraryId, quantity });
          allocated += quantity;
        }
      }
      if (allocated < item.requestedQuantity) acquisitions.push({ itemId: item.id, quantity: item.requestedQuantity - allocated });
    }
    mutate.mutate({ path: `/transfers/${request.id}/review`, body: { action: "approve", allocations, acquisitions } });
  };
  const hasSuggestedSources = (request: any) => request.items.some((item: any) =>
    (item.legs || []).some((leg: any) => leg.status === "PREFERRED" && leg.requestedQuantity > 0),
  );
  const openSourceAllocation = (request: any) => {
    const initial: Record<number, { libraryId: number; quantity: number }[]> = {};
    const acquisitionInitial: Record<number, number> = {};
    for (const item of request.items) {
      const byLibrary = new Map<number, number>();
      for (const leg of (item.legs || []).filter((entry: any) => entry.status === "PREFERRED")) {
        byLibrary.set(leg.sourceLibraryId, (byLibrary.get(leg.sourceLibraryId) || 0) + leg.requestedQuantity);
      }
      initial[item.id] = Array.from(byLibrary, ([libraryId, quantity]) => ({ libraryId, quantity }));
      const preferredTotal = initial[item.id].reduce((sum, row) => sum + row.quantity, 0);
      acquisitionInitial[item.id] = Math.max(0, item.requestedQuantity - preferredTotal);
    }
    setSourceAllocations(initial);
    setAcquisitionQuantities(acquisitionInitial);
    setSourceReviewRequest(request);
  };
  const updateItemSourceAllocations = (item: any, nextRows: { libraryId: number; quantity: number }[]) => {
    const previousRows = sourceAllocations[item.id] || [];
    const previousTotal = previousRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
    const nextTotal = nextRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
    setSourceAllocations(current => ({ ...current, [item.id]: nextRows }));
    setAcquisitionQuantities(current => {
      const currentQuantity = current[item.id] ?? Math.max(0, item.requestedQuantity - previousTotal);
      return {
        ...current,
        [item.id]: Math.max(0, Math.min(item.requestedQuantity, currentQuantity + previousTotal - nextTotal)),
      };
    });
  };
  const sourceCatalogForItem = (itemId: number) => {
    const index = (sourceReviewRequest?.items || []).findIndex((item: any) => item.id === itemId);
    const item = sourceReviewRequest?.items?.[index];
    const results = sourceCatalogQueries[index]?.data as any[] | undefined;
    return results?.find((book: any) => book.id === item?.bookId);
  };
  const submitSourceAllocation = () => {
    if (!sourceReviewRequest) return;
    const allocations: any[] = [];
    const acquisitions: any[] = [];
    for (const item of sourceReviewRequest.items) {
      const rows = sourceAllocations[item.id] || [];
      const total = rows.reduce((sum, row) => sum + row.quantity, 0);
      const acquisitionQuantity = acquisitionQuantities[item.id] ?? Math.max(0, item.requestedQuantity - total);
      if (rows.some(row => !Number.isInteger(row.libraryId) || row.libraryId < 1 || !Number.isInteger(row.quantity) || row.quantity < 1)) {
        toast.error(`Choose a source and valid quantity for ${item.book?.title}`);
        return;
      }
      if (total > item.requestedQuantity) {
        toast.error(`Source quantities exceed the request for ${item.book?.title}`);
        return;
      }
      if (!Number.isInteger(acquisitionQuantity) || acquisitionQuantity < 0
        || total + acquisitionQuantity !== item.requestedQuantity) {
        toast.error(`Assign all ${item.requestedQuantity} copies of ${item.book?.title} to libraries or the Acquisition Queue`);
        return;
      }
      const book = sourceCatalogForItem(item.id);
      const sources = book?.sources || [];
      for (const row of rows) {
        const source = sources.find((entry: any) => entry.libraryId === row.libraryId);
        if (!source || row.quantity > source.quantity) {
          toast.error(`The selected source does not have enough available copies for ${item.book?.title}`);
          return;
        }
        allocations.push({ itemId: item.id, libraryId: row.libraryId, quantity: row.quantity });
      }
      if (acquisitionQuantity > 0) acquisitions.push({ itemId: item.id, quantity: acquisitionQuantity });
    }
    mutate.mutate({ path: `/transfers/${sourceReviewRequest.id}/review`, body: { action: "approve", allocations, acquisitions } });
  };
  const resolveShortfall = (request: any) => {
    const allocations: any[] = [];
    const acquisitions: any[] = [];
    const sources = libraries.map((library: any) => `${library.id}: ${library.name}`).join("\n");
    for (const item of request.items) {
      const committed = item.legs.reduce((sum: number, leg: any) => sum + (leg.status === "DISCREPANCY" ? (leg.receivedQuantity || 0) : (leg.acceptedQuantity ?? leg.approvedQuantity)), 0);
      const existingAcq = item.acquisitions.filter((row: any) => row.status !== "CANCELLED").reduce((sum: number, row: any) => sum + row.quantity, 0);
      const remaining = Math.max(0, item.requestedQuantity - committed - existingAcq);
      if (!remaining) continue;
      const value = window.prompt(`Reassign ${remaining} copies of ${item.book?.title} (libraryId:quantity pairs). Available libraries:\n${sources}`, "");
      if (value === null) return;
      let rows: any[];
      try { rows = parseAllocations(value, item.id); }
      catch (error) { toast.error((error as Error).message); return; }
      const allocated = rows.reduce((sum, row) => sum + row.quantity, 0);
      if (allocated > remaining) { toast.error("Source quantities exceed the shortfall"); return; }
      allocations.push(...rows);
      const queueQty = remaining - allocated;
      if (queueQty > 0) acquisitions.push({ itemId: item.id, quantity: queueQty });
    }
    mutate.mutate({ path: `/transfers/${request.id}/resolve-shortfall`, body: { allocations, acquisitions } });
  };

  return <MainLayout>
    <div className="flex-1 space-y-6 overflow-auto p-6 md:p-8">
      <header>
        <div className="flex items-center gap-2"><ArrowRightLeft className="h-6 w-6 text-primary" /><h1 className="text-3xl font-bold">{queueOnly ? "Acquisition Queue" : reviewOnly ? "Transfer Approvals" : "Library Transfers"}</h1></div>
        <p className="mt-2 text-muted-foreground">{reviewOnly
          ? "Review requests across libraries, set source quantities, reject with a reason, or route shortages to acquisition."
          : queueOnly
            ? "Track new-copy requests routed from transfer approvals."
            : "Request books from other libraries and track source acceptance, handover, and receipt."}</p>
      </header>
      {!!notifications.length && <Card className="border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
        <CardHeader><CardTitle className="text-orange-950 dark:text-orange-100">Transfer notifications</CardTitle></CardHeader>
        <CardContent className="space-y-2">{notifications.map((notification: any) => <div key={notification.id} className="flex items-center justify-between gap-3 rounded border border-orange-200 bg-white p-3 text-sm text-orange-950 dark:border-orange-800 dark:bg-orange-900 dark:text-orange-50">
          <span>{notification.message}</span><Button size="sm" variant="outline" onClick={() => mutate.mutate({ path: `/transfers/notifications/${notification.id}/read`, body: {} })}>Mark read</Button>
        </div>)}</CardContent>
      </Card>}

      {!queueOnly && !reviewOnly && <Card>
        <CardHeader><CardTitle>Find books across libraries</CardTitle><CardDescription>Choose books, quantities, and an optional preferred source.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_2fr]">
            {localAdmin && <div><Label>Requesting library</Label><select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={destinationId} onChange={e => setLibraryId(Number(e.target.value))}>{libraries.map((library: any) => <option key={library.id} value={library.id}>{library.name}</option>)}</select></div>}
            <div><Label htmlFor="transfer-search">Search catalog</Label><div className="mt-2 flex gap-2"><Input id="transfer-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Enter at least 2 characters" /><Button variant="outline" type="button" aria-label="Search catalog" disabled={search.trim().length < 2} onClick={() => queryClient.invalidateQueries({ queryKey: ["transfer-catalog", destinationId, search] })}><Search className="h-4 w-4" /></Button></div></div>
          </div>
          <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/50">
            <Label htmlFor="transfer-reason">Reason for request <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input id="transfer-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are these copies needed?" required aria-required="true" className="border-sky-200 bg-white dark:border-sky-800 dark:bg-background" />
            <p className="text-xs text-sky-900 dark:text-sky-100">A reason is required before this request can be submitted.</p>
          </div>
          <div className="space-y-3">
            {catalog.map((book: any) => {
              const row = selected[book.id] || { quantity: 0, sourceId: 0, sourceQuantity: 1, preferredSources: [] };
              return <div key={book.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_100px_1fr_100px_auto] md:items-end">
                <div><div className="font-medium">{book.title}</div><div className="text-sm text-muted-foreground">{book.author} · {book.isbn}</div><div className="mt-1 text-xs font-medium text-primary">Your library: {book.localInventory?.total ?? 0} copies{book.localInventory?.total ? ` · ${Object.entries(book.localInventory.byStatus || {}).map(([status, quantity]) => `${status.toLowerCase()}: ${quantity}`).join(", ")}` : ""}</div><div className="text-xs text-muted-foreground">{book.sources.map((source: any) => `${source.libraryName}: ${source.quantity} available`).join(" · ") || "No available copies in other libraries"}</div></div>
                <div><Label>Request</Label><Input type="number" min="0" value={row.quantity} onChange={e => setBook(book.id, { quantity: Number(e.target.value) })} /></div>
                <div><Label>Preferred source</Label><select className="h-10 w-full rounded-md border bg-background px-2" value={row.sourceId} onChange={e => setBook(book.id, { sourceId: Number(e.target.value) })}><option value={0}>No preference</option>{book.sources.map((source: any) => <option key={source.libraryId} value={source.libraryId}>{source.libraryName} ({source.quantity} available)</option>)}</select></div>
                <div><Label>From source</Label><Input type="number" min="1" value={row.sourceQuantity} onChange={e => setBook(book.id, { sourceQuantity: Number(e.target.value) })} /></div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={!row.sourceId || row.preferredSources.some(source => source.libraryId === row.sourceId)} onClick={() => setBook(book.id, { preferredSources: [...row.preferredSources, { libraryId: row.sourceId, quantity: row.sourceQuantity }] })}>Add source</Button>
                  <Button type="button" variant={row.quantity ? "secondary" : "outline"} onClick={() => setBook(book.id, { quantity: row.quantity ? 0 : 1 })}>{row.quantity ? "Selected" : "Add"}</Button>
                </div>
                {row.preferredSources.length > 0 && <div className="md:col-span-5 flex flex-wrap gap-2 text-xs">{row.preferredSources.map(source => {
                  const name = book.sources.find((entry: any) => entry.libraryId === source.libraryId)?.libraryName || `Library ${source.libraryId}`;
                  return <Badge key={source.libraryId} variant="outline" className="cursor-pointer" onClick={() => setBook(book.id, { preferredSources: row.preferredSources.filter(value => value.libraryId !== source.libraryId) })}>{name} · {source.quantity} × remove</Badge>;
                })}</div>}
              </div>;
            })}
            {!catalog.length && <p className="py-4 text-center text-sm text-muted-foreground">{search.trim().length < 2 ? "Enter at least 2 characters to search the global catalog." : "No matching books found."}</p>}
          </div>
          <div className="flex justify-end"><Button disabled={!reason.trim() || !Object.values(selected).some(row => row.quantity > 0 && row.preferredSources.reduce((sum, source) => sum + source.quantity, 0) <= row.quantity) || createRequest.isPending} onClick={() => createRequest.mutate()}>Submit transfer request</Button></div>
        </CardContent>
      </Card>}

      {queueOnly && localAdmin && <Card>
        <CardHeader><CardTitle>Acquisition Queue</CardTitle><CardDescription>Requests routed for new copies instead of a library transfer.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {acquisitionRows.map((row: any) => <div key={row.item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div><div className="font-medium">{row.book.title}</div><div className="text-sm text-muted-foreground"><Link className="underline" href="/transfers">Request #{row.request.id}</Link> · Qty {row.item.quantity} · {row.item.status}</div></div>
            <select className="h-9 rounded-md border bg-background px-2" value={row.item.status} onChange={e => mutate.mutate({ path: `/transfers/acquisitions/${row.item.id}`, body: { status: e.target.value } })}>{["QUEUED", "ORDERED", "RECEIVED", "CANCELLED"].map(status => <option key={status}>{status}</option>)}</select>
          </div>)}
          {!acquisitionRows.length && <p className="text-sm text-muted-foreground">No acquisition items yet.</p>}
        </CardContent>
      </Card>}

      {!queueOnly && !reviewOnly && <section className="space-y-4">
        <h2 className="text-xl font-semibold">Requests and active transfers</h2>
        {isLoading && <p className="text-sm text-muted-foreground">Loading transfers…</p>}
        {mine.filter((request: any) => request.status !== "CANCELLED").map((request: any) => <Card key={request.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div><CardTitle>Request #{request.id} · {request.destination?.name}</CardTitle><CardDescription>{request.reason} · {new Date(request.createdAt).toLocaleString()}</CardDescription></div>
            <Badge variant={request.status === "REJECTED" ? "destructive" : "secondary"}>{request.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {request.items.map((item: any) => <div key={item.id} className="space-y-2 rounded-md bg-muted/30 p-3">
              <div className="flex justify-between gap-3"><span className="font-medium">{item.book?.title}</span><span className="text-sm">Requested: {item.requestedQuantity}</span></div>
              {item.legs.map((leg: any) => <div key={leg.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
                <span>{leg.source?.name} · {leg.approvedQuantity || leg.requestedQuantity} · {leg.status}</span>
                {leg.status === "AWAITING_SOURCE" && <Button size="sm" onClick={() => {
                  const value = Number(window.prompt(`Accept quantity (up to ${leg.approvedQuantity})`, String(leg.approvedQuantity)));
                  if (value > 0) {
                    const reason = value < leg.approvedQuantity ? window.prompt("Reason for reducing the quantity", "") : "";
                    if (value < leg.approvedQuantity && !reason?.trim()) return;
                    mutate.mutate({ path: `/transfers/legs/${leg.id}/accept`, body: { quantity: value, reason } });
                  }
                }}>Accept</Button>}
                {localAdmin && !reviewOnly && leg.status === "ACCEPTED" && <Button size="sm" onClick={() => {
                  const type = window.prompt("Handover type: EMPLOYEE or COURIER", "COURIER");
                  if (!type) return;
                  const details = type.toUpperCase() === "EMPLOYEE"
                    ? { employeeId: window.prompt("Employee ID", ""), name: window.prompt("Employee name", ""), phone: window.prompt("Telephone number", "") }
                    : { agency: window.prompt("Courier agency", ""), docketNumber: window.prompt("Docket number", ""), date: window.prompt("Handover date", new Date().toISOString().slice(0, 10)) };
                  if (Object.values(details).every(value => !!value?.trim())) mutate.mutate({ path: `/transfers/legs/${leg.id}/dispatch`, body: { type: type.toUpperCase(), details } });
                }}>Record handover</Button>}
                {leg.status === "IN_TRANSIT" && canActForDestination && <Button size="sm" onClick={() => {
                  const value = Number(window.prompt(`Received quantity (up to ${leg.acceptedQuantity})`, String(leg.acceptedQuantity)));
                  if (Number.isInteger(value) && value >= 0) {
                    const condition = window.prompt("Condition: GOOD, DAMAGED, or MIXED", "GOOD") || "GOOD";
                    const discrepancy = value < leg.acceptedQuantity ? window.prompt("Describe the missing quantity or discrepancy", "") : "";
                    if (value < leg.acceptedQuantity && !discrepancy?.trim()) return;
                    mutate.mutate({ path: `/transfers/legs/${leg.id}/receive`, body: { quantity: value, condition, discrepancy } });
                  }
                }}>Record receipt</Button>}
              </div>)}
              {item.acquisitions.map((acquisition: any) => <div key={acquisition.id} className="text-sm text-muted-foreground">Acquisition queue: {acquisition.quantity} · {acquisition.status}</div>)}
            </div>)}
            {request.status === "PENDING_REVIEW" && (localAdmin || request.requestedBy === user?.id) && <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setWithdrawDialogRequestId(request.id)}
            >Withdraw request</Button>}
            {reviewOnly && localAdmin && request.status === "PENDING_REVIEW" && <div className="flex gap-2">
              <Button onClick={() => approve(request)} disabled={!hasSuggestedSources(request)}><PackageCheck className="mr-2 h-4 w-4" />Approve sources and queue remainder</Button>
              <Button variant="outline" onClick={() => openSourceAllocation(request)}>Choose sources</Button>
              <Button variant="outline" onClick={() => { setRejectRequestId(request.id); setRejectionReason(""); }}>Reject</Button>
            </div>}
            {reviewOnly && localAdmin && request.status === "NEEDS_REALLOCATION" && <Button onClick={() => resolveShortfall(request)}>Resolve shortfall</Button>}
            {request.rejectionReason && <p className="text-sm text-destructive">Reason: {request.rejectionReason}</p>}
            <Separator />
            <details><summary className="cursor-pointer text-sm font-medium">History ({request.events.length})</summary><div className="mt-2 space-y-1 text-xs text-muted-foreground">{request.events.map((entry: any) => <div key={entry.id}>{new Date(entry.createdAt).toLocaleString()} · {entry.action} · {JSON.stringify(entry.details)}</div>)}</div></details>
          </CardContent>
        </Card>)}
      </section>}
      {reviewOnly && <section className="space-y-4">
        <h2 className="text-xl font-semibold">Requests awaiting review</h2>
        {isLoading && <p className="text-sm text-muted-foreground">Loading approval requests…</p>}
        {reviewRequests.map((request: any) => <Card key={request.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div><CardTitle>Request #{request.id} · {request.destination?.name}</CardTitle><CardDescription>{request.reason} · {new Date(request.createdAt).toLocaleString()}</CardDescription></div>
            <Badge variant="secondary">{request.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {request.items.map((item: any) => <div key={item.id} className="rounded-md border p-3">
              <div className="font-medium">{item.book?.title}</div>
              <div className="text-sm text-muted-foreground">Requested {item.requestedQuantity} · ISBN {item.book?.isbn}</div>
              {item.legs.map((leg: any) => <div key={leg.id} className="mt-2 text-sm">{leg.source?.name} · {leg.requestedQuantity} requested from this source · {leg.status}</div>)}
              {request.status === "PENDING_REVIEW" && (() => {
                const suggested = item.legs
                  .filter((leg: any) => leg.status === "PREFERRED")
                  .reduce((sum: number, leg: any) => sum + leg.requestedQuantity, 0);
                const suggestedTransfer = Math.min(suggested, item.requestedQuantity);
                const acquisitionRemainder = item.requestedQuantity - suggestedTransfer;
                return <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100">
                  <p className="font-medium">If you approve the suggestions:</p>
                  <p>{suggestedTransfer} {suggestedTransfer === 1 ? "copy" : "copies"} will transfer from suggested libraries.</p>
                  <p>{acquisitionRemainder} {acquisitionRemainder === 1 ? "copy" : "copies"} will be added to the Acquisition Queue.</p>
                  <p className="mt-1 text-xs">Use “Choose sources” to change the split or select full acquisition.</p>
                </div>;
              })()}
              {item.acquisitions.map((entry: any) => <div key={entry.id} className="mt-2 text-sm">Acquisition queue: {entry.quantity} · {entry.status}</div>)}
            </div>)}
            {request.status === "PENDING_REVIEW" && <div className="flex flex-wrap gap-2">
              <Button onClick={() => approve(request)} disabled={!hasSuggestedSources(request)}><PackageCheck className="mr-2 h-4 w-4" />Approve sources and queue remainder</Button>
              <Button variant="outline" onClick={() => openSourceAllocation(request)}>Choose sources</Button>
              <Button variant="outline" onClick={() => { setRejectRequestId(request.id); setRejectionReason(""); }}>Reject</Button>
            </div>}
            {request.status === "NEEDS_REALLOCATION" && <Button onClick={() => resolveShortfall(request)}>Resolve shortfall</Button>}
            {request.status === "PENDING_REVIEW" && localAdmin && <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setWithdrawDialogRequestId(request.id)}
            >Withdraw request</Button>}
            <Separator />
            <details><summary className="cursor-pointer text-sm font-medium">History ({request.events.length})</summary><div className="mt-2 space-y-1 text-xs text-muted-foreground">{request.events.map((entry: any) => <div key={entry.id}>{new Date(entry.createdAt).toLocaleString()} · {entry.actorName} · {entry.action} · {JSON.stringify(entry.details)}</div>)}</div></details>
          </CardContent>
        </Card>)}
        {!reviewRequests.length && !isLoading && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No requests are awaiting review.</CardContent></Card>}
      </section>}
      {!!withdrawnRequests.length && <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">Withdrawn requests ({withdrawnRequests.length})</summary>
        <div className="mt-3 space-y-3">
          {withdrawnRequests.map((request: any) => <div key={request.id} className="rounded-md bg-muted/30 p-3">
            <div className="font-medium">Request #{request.id} · {request.destination?.name}</div>
            <p className="text-sm text-muted-foreground">{request.reason} · {new Date(request.createdAt).toLocaleString()}</p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {request.events.map((entry: any) => <div key={entry.id}>{new Date(entry.createdAt).toLocaleString()} · {entry.actorName || "Admin"} · {entry.action} · {JSON.stringify(entry.details)}</div>)}
            </div>
          </div>)}
        </div>
      </details>}
      {(!reviewOnly && !queueOnly) && <div className="flex gap-4 text-sm"><Link href="/libraries" className="text-primary underline">Libraries</Link><Truck className="h-4 w-4 text-muted-foreground" /></div>}
    </div>
    <AlertDialog
      open={withdrawDialogRequestId !== null}
      onOpenChange={open => { if (!open) setWithdrawDialogRequestId(null); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw transfer request?</AlertDialogTitle>
          <AlertDialogDescription>
            This request will be removed from active lists. Its audit history will be retained.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep request</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutate.isPending || withdrawDialogRequestId === null}
            onClick={() => {
              if (withdrawDialogRequestId !== null) {
                mutate.mutate({ path: `/transfers/${withdrawDialogRequestId}/withdraw`, body: {} });
                setWithdrawDialogRequestId(null);
              }
            }}
          >Withdraw request</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Dialog
      open={!!sourceReviewRequest}
      onOpenChange={open => { if (!open && !mutate.isPending) setSourceReviewRequest(null); }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose transfer sources</DialogTitle>
          <DialogDescription>
            For each book, divide the requested copies between available libraries and the Acquisition Queue. Each quantity must be assigned before approval.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {(sourceReviewRequest?.items || []).map((item: any, itemIndex: number) => {
            const results = sourceCatalogQueries[itemIndex]?.data as any[] | undefined;
            const book = results?.find((entry: any) => entry.id === item.bookId);
            const sources = book?.sources || [];
            const rows = sourceAllocations[item.id] || [];
            const allocated = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
            const acquisitionQuantity = acquisitionQuantities[item.id] ?? Math.max(0, item.requestedQuantity - allocated);
            const assigned = allocated + acquisitionQuantity;
            const unassigned = Math.max(0, item.requestedQuantity - assigned);
            const excess = Math.max(0, assigned - item.requestedQuantity);

            return <section key={item.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{item.book?.title || "Book"}</h3>
                  <p className="text-sm text-muted-foreground">Requested: {item.requestedQuantity} copies · ISBN {item.book?.isbn || "—"}</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Library transfers</p>
                  <p className="text-lg font-semibold">{allocated} copies</p>
                </div>
                <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100">
                  <Label htmlFor={`acquisition-quantity-${item.id}`} className="text-xs">Send to Acquisition Queue</Label>
                  <Input
                    id={`acquisition-quantity-${item.id}`}
                    aria-label={`Copies to Acquisition Queue for ${item.book?.title || "book"}`}
                    className="mt-1 bg-white dark:bg-background"
                    type="number"
                    min={0}
                    max={item.requestedQuantity}
                    value={acquisitionQuantity}
                    onChange={event => setAcquisitionQuantities(current => ({
                      ...current,
                      [item.id]: event.target.value === "" ? 0 : Number(event.target.value),
                    }))}
                  />
                  <p className="mt-1 text-xs">{acquisitionQuantity === item.requestedQuantity
                    ? "Full request goes to acquisition."
                    : acquisitionQuantity > 0
                      ? "Partial request goes to acquisition."
                      : "No copies will go to acquisition."}</p>
                </div>
                <div className={`rounded-md p-3 ${unassigned || excess ? "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100" : "bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-100"}`}>
                  <p className="text-xs">Request allocation</p>
                  <p className="text-lg font-semibold">{unassigned ? `${unassigned} unassigned` : excess ? `${excess} over request` : "Fully assigned"}</p>
                </div>
              </div>
              {sourceCatalogQueries[itemIndex]?.isLoading && <p className="text-sm text-muted-foreground">Checking available copies…</p>}
              {!sourceCatalogQueries[itemIndex]?.isLoading && !sources.length && <p className="text-sm text-amber-700">No other library has available copies. The full amount can go to acquisition.</p>}
              <div className="space-y-2">
                {rows.map((row, rowIndex) => {
                  const selectedSource = sources.find((entry: any) => entry.libraryId === row.libraryId);
                  const usedByOtherRows = rows.filter((_, index) => index !== rowIndex).map(entry => entry.libraryId);
                  return <div key={`${item.id}-${rowIndex}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
                    <div className="space-y-1">
                      <Label htmlFor={`transfer-source-${item.id}-${rowIndex}`}>Source library</Label>
                      <select
                        id={`transfer-source-${item.id}-${rowIndex}`}
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={row.libraryId || ""}
                        onChange={event => {
                          const libraryId = Number(event.target.value);
                          updateItemSourceAllocations(item, rows.map((entry, index) => index === rowIndex ? { ...entry, libraryId } : entry));
                        }}
                      >
                        <option value="">Choose available library</option>
                        {row.libraryId > 0 && !selectedSource && <option value={row.libraryId} disabled>Previously selected source is no longer available</option>}
                        {sources.filter((source: any) => !usedByOtherRows.includes(source.libraryId)).map((source: any) => (
                          <option key={source.libraryId} value={source.libraryId}>{source.libraryName} · {source.quantity} available</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`transfer-quantity-${item.id}-${rowIndex}`}>Quantity</Label>
                      <Input
                        id={`transfer-quantity-${item.id}-${rowIndex}`}
                        aria-label={`Quantity from source ${rowIndex + 1}`}
                        type="number"
                        min={1}
                        max={selectedSource?.quantity}
                        value={row.quantity}
                        onChange={event => {
                          const quantity = event.target.value === "" ? 0 : Number(event.target.value);
                          updateItemSourceAllocations(item, rows.map((entry, index) => index === rowIndex ? { ...entry, quantity } : entry));
                        }}
                      />
                      {selectedSource && <p className="text-xs text-muted-foreground">{selectedSource.quantity} available</p>}
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateItemSourceAllocations(item, rows.filter((_, index) => index !== rowIndex))}
                      >Remove</Button>
                    </div>
                  </div>;
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!sources.length || rows.length >= sources.length}
                onClick={() => updateItemSourceAllocations(item, [...rows, { libraryId: 0, quantity: 1 }])}
              >Add source library</Button>
            </section>;
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setSourceReviewRequest(null)} disabled={mutate.isPending}>Cancel</Button>
          <Button type="button" onClick={submitSourceAllocation} disabled={mutate.isPending}>
            {mutate.isPending ? "Approving…" : "Approve allocations"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog
      open={rejectRequestId !== null}
      onOpenChange={open => {
        if (!open && !mutate.isPending) {
          setRejectRequestId(null);
          setRejectionReason("");
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reject transfer request?</DialogTitle>
          <DialogDescription>
            Enter a reason for rejecting request #{rejectRequestId}. The reason will be saved in the transfer history and shared with the requester.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="transfer-rejection-reason">Rejection reason <span className="text-destructive">*</span></Label>
          <Textarea
            id="transfer-rejection-reason"
            value={rejectionReason}
            onChange={event => setRejectionReason(event.target.value)}
            placeholder="Explain why this transfer request is being rejected"
            rows={4}
            required
            aria-required="true"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { setRejectRequestId(null); setRejectionReason(""); }} disabled={mutate.isPending}>Cancel</Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!rejectionReason.trim() || mutate.isPending || rejectRequestId === null}
            onClick={() => {
              if (rejectRequestId !== null && rejectionReason.trim()) {
                mutate.mutate({
                  path: `/transfers/${rejectRequestId}/review`,
                  body: { action: "reject", reason: rejectionReason.trim() },
                });
              }
            }}
          >{mutate.isPending ? "Rejecting…" : "Reject request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </MainLayout>;
}
