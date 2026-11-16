import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/lib/auth";
import { libraryAccessApi, librariesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  const [selected, setSelected] = useState<Record<number, { quantity: number; sourceId: number; sourceQuantity: number; preferredSources: { libraryId: number; quantity: number }[] }>>({});
  const { data: catalog = [] } = useQuery({
    queryKey: ["transfer-catalog", destinationId, search],
    queryFn: () => api<any[]>(`/transfers/catalog?libraryId=${destinationId}&search=${encodeURIComponent(search)}`),
    enabled: destinationId > 0,
  });
  const { data: requests = [], isLoading } = useQuery({ queryKey: ["transfers"], queryFn: () => api<any[]>("/transfers"), refetchInterval: 15000 });
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
    onSuccess: () => { toast.success("Transfer updated"); refresh(); },
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
  const customApprove = (request: any) => {
    const allocations: any[] = [];
    const acquisitions: any[] = [];
    const sources = libraries.map((library: any) => `${library.id}: ${library.name}`).join("\n");
    for (const item of request.items) {
      const preferred = item.legs.filter((leg: any) => leg.status === "PREFERRED");
      const suggested = preferred.map((leg: any) => `${leg.sourceLibraryId}:${leg.requestedQuantity}`).join(",");
      const value = window.prompt(`Source allocations for ${item.book?.title} (libraryId:quantity pairs). Leave blank to send all to acquisition.\nAvailable libraries:\n${sources}`, suggested);
      if (value === null) return;
      let rows: any[];
      try { rows = parseAllocations(value, item.id); }
      catch (error) { toast.error((error as Error).message); return; }
      const total = rows.reduce((sum, row) => sum + row.quantity, 0);
      if (total > item.requestedQuantity) { toast.error(`Source quantities exceed the request for ${item.book?.title}`); return; }
      allocations.push(...rows);
      const queued = item.requestedQuantity - total;
      if (queued > 0) acquisitions.push({ itemId: item.id, quantity: queued });
    }
    mutate.mutate({ path: `/transfers/${request.id}/review`, body: { action: "approve", allocations, acquisitions } });
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
        <div className="flex items-center gap-2"><ArrowRightLeft className="h-6 w-6 text-primary" /><h1 className="text-3xl font-bold">{queueOnly ? "Acquisition Queue" : "Library Transfers"}</h1></div>
        <p className="mt-2 text-muted-foreground">Request books from other libraries, review allocations, and track each handover through receipt.</p>
      </header>
      {!!notifications.length && <Card>
        <CardHeader><CardTitle>Transfer notifications</CardTitle></CardHeader>
        <CardContent className="space-y-2">{notifications.map((notification: any) => <div key={notification.id} className="flex items-center justify-between gap-3 rounded border p-3 text-sm">
          <span>{notification.message}</span><Button size="sm" variant="outline" onClick={() => mutate.mutate({ path: `/transfers/notifications/${notification.id}/read`, body: {} })}>Mark read</Button>
        </div>)}</CardContent>
      </Card>}

      {!queueOnly && <Card>
        <CardHeader><CardTitle>Find books across libraries</CardTitle><CardDescription>Choose books, quantities, and an optional preferred source.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_2fr]">
            {localAdmin && <div><Label>Requesting library</Label><select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={destinationId} onChange={e => setLibraryId(Number(e.target.value))}>{libraries.map((library: any) => <option key={library.id} value={library.id}>{library.name}</option>)}</select></div>}
            <div><Label htmlFor="transfer-search">Search catalog</Label><div className="mt-2 flex gap-2"><Input id="transfer-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Title, author, or ISBN" /><Button variant="outline" type="button"><Search className="h-4 w-4" /></Button></div></div>
          </div>
          <div><Label htmlFor="transfer-reason">Reason for request</Label><Input id="transfer-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are these copies needed?" /></div>
          <div className="space-y-3">
            {catalog.map((book: any) => {
              const row = selected[book.id] || { quantity: 0, sourceId: 0, sourceQuantity: 1, preferredSources: [] };
              return <div key={book.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_100px_1fr_100px_auto] md:items-end">
                <div><div className="font-medium">{book.title}</div><div className="text-sm text-muted-foreground">{book.author} · {book.isbn}</div><div className="text-xs text-muted-foreground">{book.sources.map((source: any) => `${source.libraryName}: ${source.quantity}`).join(" · ") || "No available copies"}</div></div>
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
            {!catalog.length && <p className="py-4 text-center text-sm text-muted-foreground">{search ? "No matching books found." : "Search the catalog to begin."}</p>}
          </div>
          <div className="flex justify-end"><Button disabled={!reason.trim() || !Object.values(selected).some(row => row.quantity > 0 && row.preferredSources.reduce((sum, source) => sum + source.quantity, 0) <= row.quantity) || createRequest.isPending} onClick={() => createRequest.mutate()}>Submit transfer request</Button></div>
        </CardContent>
      </Card>}

      {localAdmin && <Card>
        <CardHeader><CardTitle>Acquisition Queue</CardTitle><CardDescription>Requests routed for new copies instead of a library transfer.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {acquisitionRows.map((row: any) => <div key={row.item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div><div className="font-medium">{row.book.title}</div><div className="text-sm text-muted-foreground"><Link className="underline" href="/transfers">Request #{row.request.id}</Link> · Qty {row.item.quantity} · {row.item.status}</div></div>
            <select className="h-9 rounded-md border bg-background px-2" value={row.item.status} onChange={e => mutate.mutate({ path: `/transfers/acquisitions/${row.item.id}`, body: { status: e.target.value } })}>{["QUEUED", "ORDERED", "RECEIVED", "CANCELLED"].map(status => <option key={status}>{status}</option>)}</select>
          </div>)}
          {!acquisitionRows.length && <p className="text-sm text-muted-foreground">No acquisition items yet.</p>}
        </CardContent>
      </Card>}

      {!queueOnly && <section className="space-y-4">
        <h2 className="text-xl font-semibold">Requests and active transfers</h2>
        {isLoading && <p className="text-sm text-muted-foreground">Loading transfers…</p>}
        {mine.map((request: any) => <Card key={request.id}>
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
                {localAdmin && leg.status === "ACCEPTED" && <Button size="sm" onClick={() => {
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
            {localAdmin && request.status === "PENDING_REVIEW" && <div className="flex gap-2">
              <Button onClick={() => approve(request)}><PackageCheck className="mr-2 h-4 w-4" />Approve suggested sources</Button>
              <Button variant="outline" onClick={() => {
                customApprove(request);
              }}>Choose sources</Button>
              <Button variant="outline" onClick={() => {
                const reason = window.prompt("Reason for rejection");
                if (reason?.trim()) mutate.mutate({ path: `/transfers/${request.id}/review`, body: { action: "reject", reason } });
              }}>Reject</Button>
            </div>}
            {localAdmin && request.status === "NEEDS_REALLOCATION" && <Button onClick={() => resolveShortfall(request)}>Resolve shortfall</Button>}
            {request.rejectionReason && <p className="text-sm text-destructive">Reason: {request.rejectionReason}</p>}
            <Separator />
            <details><summary className="cursor-pointer text-sm font-medium">History ({request.events.length})</summary><div className="mt-2 space-y-1 text-xs text-muted-foreground">{request.events.map((entry: any) => <div key={entry.id}>{new Date(entry.createdAt).toLocaleString()} · {entry.action} · {JSON.stringify(entry.details)}</div>)}</div></details>
          </CardContent>
        </Card>)}
        {!requests.length && !isLoading && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No transfer requests yet.</CardContent></Card>}
      </section>}
      <div className="flex gap-4 text-sm"><Link href="/libraries" className="text-primary underline">Libraries</Link><Link href="/transfers" className="text-primary underline">Refresh transfers</Link><Truck className="h-4 w-4 text-muted-foreground" /></div>
    </div>
  </MainLayout>;
}
