import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fineWaiverRequestsApi } from "@/lib/api";
import { useCurrency } from "@/lib/useCurrency";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Check, X, Inbox } from "lucide-react";
import { toast } from "sonner";

export default function WaiverRequestsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [reviewing, setReviewing] = useState<{ id: number; action: "approve" | "reject" } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["fine-waiver-requests", tab],
    queryFn: () => fineWaiverRequestsApi.getAll(tab),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) => fineWaiverRequestsApi.approve(id, notes),
    onSuccess: () => {
      toast.success("Waiver approved");
      queryClient.invalidateQueries({ queryKey: ["fine-waiver-requests"] });
      queryClient.invalidateQueries({ queryKey: ["circulation"] });
      setReviewing(null); setReviewNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) => fineWaiverRequestsApi.reject(id, notes),
    onSuccess: () => {
      toast.success("Waiver rejected");
      queryClient.invalidateQueries({ queryKey: ["fine-waiver-requests"] });
      setReviewing(null); setReviewNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitReview = () => {
    if (!reviewing) return;
    if (reviewing.action === "approve") approveMut.mutate({ id: reviewing.id, notes: reviewNotes });
    else rejectMut.mutate({ id: reviewing.id, notes: reviewNotes });
  };

  return (
    <MainLayout>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Fine Waiver Requests</h1>
          <p className="text-muted-foreground mt-1">Review and approve waiver requests submitted by librarians.</p>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>Filter by status to review requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="PENDING" data-testid="tab-pending">Pending</TabsTrigger>
              <TabsTrigger value="APPROVED" data-testid="tab-approved">Approved</TabsTrigger>
              <TabsTrigger value="REJECTED" data-testid="tab-rejected">Rejected</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Inbox className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">No {tab.toLowerCase()} requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Req #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Circulation</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Requested by</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                      {isAdmin && tab === "PENDING" && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r: any) => (
                      <TableRow key={r.id} data-testid={`row-waiver-${r.id}`}>
                        <TableCell className="font-mono text-xs">#{r.id}</TableCell>
                        <TableCell><Badge variant={r.requestType === "FINE" ? "default" : "secondary"}>{r.requestType}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">#{r.circulationId}</TableCell>
                        <TableCell className="text-sm">{r.borrowerName ?? r.borrowerId ?? "—"}</TableCell>
                        <TableCell className="text-sm">{r.requestedByName ?? `User #${r.requestedBy}`}</TableCell>
                        <TableCell className="text-right font-semibold">{format(r.requestedAmount)}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={r.reason}>{r.reason || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</TableCell>
                        {isAdmin && tab === "PENDING" && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" className="text-green-700 hover:text-green-800 hover:bg-green-50"
                                onClick={() => { setReviewing({ id: r.id, action: "approve" }); setReviewNotes(""); }}
                                data-testid={`button-approve-${r.id}`}>
                                <Check className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-700 hover:text-red-800 hover:bg-red-50"
                                onClick={() => { setReviewing({ id: r.id, action: "reject" }); setReviewNotes(""); }}
                                data-testid={`button-reject-${r.id}`}>
                                <X className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={reviewing !== null} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewing?.action === "approve" ? "Approve" : "Reject"} waiver request</DialogTitle>
            <DialogDescription>Add an optional review note.</DialogDescription>
          </DialogHeader>
          <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Notes…" rows={3} data-testid="textarea-review-notes" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button onClick={submitReview} disabled={approveMut.isPending || rejectMut.isPending} data-testid="button-confirm-review">
              {(approveMut.isPending || rejectMut.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
