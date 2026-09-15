import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Library, Send } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { libraryAccessApi } from "@/lib/api";
import { toast } from "sonner";

export default function NoLibraryAccessPage() {
  const queryClient = useQueryClient();
  const [requested, setRequested] = useState(false);
  const { data: access } = useQuery({
    queryKey: ["library-access"],
    queryFn: libraryAccessApi.getMine,
    staleTime: 0,
  });
  const requestMutation = useMutation({
    mutationFn: libraryAccessApi.requestAccess,
    onSuccess: () => {
      setRequested(true);
      queryClient.invalidateQueries({ queryKey: ["library-access"] });
      toast.success("Your library access request was sent to the administrators");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <MainLayout>
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-10">
        <Card className="w-full max-w-2xl overflow-hidden border-0 shadow-lg">
          <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
          <CardHeader className="items-center px-6 pt-10 text-center sm:px-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Library className="h-8 w-8" />
            </div>
            <CardTitle className="mt-5 text-2xl">No library assigned yet</CardTitle>
            <CardDescription className="max-w-lg text-base leading-7">
              You have not been assigned to any library. Please contact your administrator to assign library access before using library operations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-6 pb-10 sm:px-12">
            <Alert className="border-blue-200 bg-blue-50/70">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle>Library access is required</AlertTitle>
              <AlertDescription>
                Your administrator will review the request and assign the relevant library. Once assigned, this page will update automatically.
              </AlertDescription>
            </Alert>
            {requested || access?.pendingRequest ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                Access request sent. Your administrator has been notified.
              </div>
            ) : (
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={() => requestMutation.mutate()}
                disabled={requestMutation.isPending}
                data-testid="button-request-library-access"
              >
                <Send className="h-4 w-4" />
                {requestMutation.isPending ? "Sending request…" : "Request for library access"}
              </Button>
            )}
            <div className="flex justify-center">
              <Badge variant="outline" className="font-normal text-muted-foreground">
                Library access is managed by administrators
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}