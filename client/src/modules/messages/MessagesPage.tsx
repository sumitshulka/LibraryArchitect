import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, ExternalLink, Inbox, MessageSquare, UserRound } from "lucide-react";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { libraryAccessApi, type LibraryAccessRequest } from "@/lib/api";
import { toast } from "sonner";

function MessageCard({ request, onResolve, resolving }: {
  request: LibraryAccessRequest;
  onResolve: (id: number) => void;
  resolving: boolean;
}) {
  const isPending = request.status === "PENDING";
  return (
    <Card className={isPending ? "border-blue-200" : ""} data-testid={`message-${request.id}`}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isPending ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
              {isPending ? <Inbox className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">Library access request</h3>
                <Badge variant={isPending ? "default" : "secondary"}>{isPending ? "Pending" : "Resolved"}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {request.requesterName} · {request.requesterRole}
              </p>
            </div>
          </div>
          {isPending && (
            <Button size="sm" onClick={() => onResolve(request.id)} disabled={resolving} data-testid={`button-resolve-message-${request.id}`}>
              {resolving ? "Saving…" : "Mark as resolved"}
            </Button>
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
  const queryClient = useQueryClient();
  const { data: messages = [], isLoading, error } = useQuery({
    queryKey: ["admin-messages", status],
    queryFn: () => libraryAccessApi.getAdminMessages(status),
    refetchInterval: 15_000,
  });
  const resolveMutation = useMutation({
    mutationFn: (id: number) => libraryAccessApi.resolveMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
      toast.success("Message marked as resolved");
    },
    onError: (resolveError: Error) => toast.error(resolveError.message),
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
          <Link href="/users">
            <Button variant="outline" className="gap-2"><ExternalLink className="h-4 w-4" /> Manage library assignments</Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Administrator inbox</CardTitle>
            <CardDescription>Assign a library in User Management before resolving an access request.</CardDescription>
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
                      onResolve={(id) => resolveMutation.mutate(id)}
                      resolving={resolveMutation.isPending && resolveMutation.variables === message.id}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}