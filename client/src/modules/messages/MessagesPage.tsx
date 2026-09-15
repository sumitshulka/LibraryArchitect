import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Inbox, Loader2, MessageSquare, RefreshCw, UserRound, XCircle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { libraryAccessApi, librariesApi, type LibraryAccessRequest } from "@/lib/api";
import { toast } from "sonner";

function MessageCard({ request, onAllocate, onReject, resolving }: {
  request: LibraryAccessRequest;
  onAllocate: (request: LibraryAccessRequest) => void;
  onReject: (request: LibraryAccessRequest) => void;
  resolving: boolean;
}) {
  const isPending = request.status === "PENDING";
  const isRejected = request.resolutionAction === "REJECTED";
  return (
    <Card className={isPending ? "border-blue-200" : ""} data-testid={`message-${request.id}`}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isPending ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
              {isPending ? <Inbox className="h-5 w-5" /> : isRejected ? <XCircle className="h-5 w-5 text-rose-600" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">Library access request</h3>
                <Badge variant={isPending ? "default" : "secondary"}>{isPending ? "Pending" : isRejected ? "Rejected" : "Allocated"}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {request.requesterName} · {request.requesterRole}
              </p>
            </div>
          </div>
          {isPending && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onAllocate(request)} disabled={resolving} data-testid={`button-allocate-message-${request.id}`}>
                {resolving ? "Saving…" : "Allocate library"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onReject(request)} disabled={resolving} data-testid={`button-reject-message-${request.id}`}>
                Reject
              </Button>
            </div>
          )}
        </div>
        <div className="rounded-lg bg-muted/40 p-4 text-sm leading-6">{request.message}</div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> {request.requesterEmail}</span>
          <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {new Date(request.createdAt).toLocaleString()}</span>
          {request.resolvedAt && request.resolvedByName && (
            <span>Resolved by {request.resolvedByName} on {new Date(request.resolvedAt).toLocaleString()}</span>
          )}
        </div>
        {request.resolutionNote && <p className="text-sm text-muted-foreground">Resolution note: {request.resolutionNote}</p>}
      </CardContent>
    </Card>
  );
}

export default function MessagesPage() {
  const [status, setStatus] = useState<"PENDING" | "RESOLVED">("PENDING");
  const [action, setAction] = useState<{ type: "ALLOCATE" | "REJECT"; request: LibraryAccessRequest } | null>(null);
  const [selectedLibraryId, setSelectedLibraryId] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const queryClient = useQueryClient();
  const { data: messages = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-messages", status],
    queryFn: () => libraryAccessApi.getAdminMessages(status),
    refetchInterval: 15_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const { data: libraries = [], isLoading: isLoadingLibraries } = useQuery({
    queryKey: ["libraries", "active"],
    queryFn: librariesApi.getActive,
    enabled: action?.type === "ALLOCATE",
  });
  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error("Choose an action");
      if (action.type === "ALLOCATE") {
        const libraryId = Number(selectedLibraryId);
        if (!libraryId) throw new Error("Select a library");
        return libraryAccessApi.allocateMessage(action.request.id, libraryId, resolutionNote || undefined);
      }
      return libraryAccessApi.rejectMessage(action.request.id, resolutionNote || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
      setAction(null);
      setSelectedLibraryId("");
      setResolutionNote("");
      toast.success("Library access request updated");
    },
    onError: (actionError: Error) => toast.error(actionError.message),
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><MessageSquare className="h-5 w-5" /></div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
                <p className="text-muted-foreground">Review requests from librarians and keep access decisions recorded.</p>
              </div>
            </div>
          </div>
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle>Administrator inbox</CardTitle>
                <CardDescription className="mt-1">Allocate a library or reject each librarian request directly from this inbox.</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-fit gap-2"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-refresh-messages"
              >
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={status} onValueChange={(value) => setStatus(value as "PENDING" | "RESOLVED")}>
              <TabsList>
                <TabsTrigger value="PENDING">Pending</TabsTrigger>
                <TabsTrigger value="RESOLVED">Resolved</TabsTrigger>
              </TabsList>
              <TabsContent value={status} className="mt-5 space-y-4">
                {isLoading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">Loading messages…</div>
                ) : error ? (
                  <div className="py-12 text-center text-sm text-destructive">Messages could not be loaded.</div>
                ) : messages.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-14 text-center">
                    <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-3 font-medium">No {status.toLowerCase()} messages</p>
                    <p className="mt-1 text-sm text-muted-foreground">Librarian access requests will appear here.</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <MessageCard
                      key={message.id}
                      request={message}
                      onAllocate={(request) => {
                        setAction({ type: "ALLOCATE", request });
                        setSelectedLibraryId("");
                        setResolutionNote("");
                      }}
                      onReject={(request) => {
                        setAction({ type: "REJECT", request });
                        setResolutionNote("");
                      }}
                      resolving={actionMutation.isPending && action?.request.id === message.id}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <Dialog open={!!action} onOpenChange={(open) => !open && !actionMutation.isPending && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.type === "ALLOCATE" ? "Allocate library access" : "Reject library access request"}</DialogTitle>
            <DialogDescription>
              {action?.type === "ALLOCATE"
                ? `Choose the library to assign to ${action.request.requesterName}. The request will be marked allocated after the assignment succeeds.`
                : `Reject ${action?.request.requesterName}'s request. You can add a note explaining the decision.`}
            </DialogDescription>
          </DialogHeader>
          {action?.type === "ALLOCATE" && (
            <div className="space-y-2">
              <Label htmlFor="message-library">Library</Label>
              <select
                id="message-library"
                value={selectedLibraryId}
                onChange={(event) => setSelectedLibraryId(event.target.value)}
                disabled={isLoadingLibraries || actionMutation.isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="select-message-library"
              >
                <option value="">{isLoadingLibraries ? "Loading libraries…" : "Select a library"}</option>
                {libraries.map((library) => <option key={library.id} value={library.id}>{library.name} ({library.code})</option>)}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="message-resolution-note">Note (optional)</Label>
            <Textarea
              id="message-resolution-note"
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder={action?.type === "ALLOCATE" ? "Add context about the assignment…" : "Explain why the request was rejected…"}
              maxLength={1000}
              disabled={actionMutation.isPending}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={actionMutation.isPending}>Cancel</Button>
            <Button
              variant={action?.type === "REJECT" ? "destructive" : "default"}
              onClick={() => actionMutation.mutate()}
              disabled={actionMutation.isPending || (action?.type === "ALLOCATE" && !selectedLibraryId)}
            >
              {actionMutation.isPending ? "Saving…" : action?.type === "ALLOCATE" ? "Allocate and close" : "Reject request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}