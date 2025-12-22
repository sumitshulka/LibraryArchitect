import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Search, 
  AlertTriangle, 
  RefreshCcw, 
  CheckCircle, 
  Clock,
  Package,
  Scan,
  XCircle,
  FileText,
  Plus,
  Play,
  Square
} from "lucide-react";
import { format } from "date-fns";

type AuditSession = {
  id: number;
  sessionCode: string;
  libraryId: number | null;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  conductedBy: number | null;
  totalScanned: number | null;
  totalMissing: number | null;
  discrepancies: number | null;
  notes: string | null;
};

type InventoryItem = {
  id: number;
  auditSessionId: number;
  bookCopyId: number;
  status: string;
  scannedLocation: string | null;
  expectedLocation: string | null;
  condition: string | null;
  notes: string | null;
  scannedAt: Date | null;
  createdAt: Date;
};

type BookCopy = {
  id: number;
  bookId: number;
  libraryId: number;
  internalSSN: string;
  userDefinedSSN: string | null;
  shelfLocation: string | null;
  condition: string;
  status: string;
};

type SessionStats = {
  total: number;
  verified: number;
  missing: number;
  pending: number;
  discrepancy: number;
};

type Library = {
  id: number;
  name: string;
  code: string;
};

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [newSessionLibraryId, setNewSessionLibraryId] = useState<string>("");
  const [newSessionNotes, setNewSessionNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions = [] } = useQuery<AuditSession[]>({
    queryKey: ["/api/audit-sessions"],
    staleTime: 30000,
  });

  const { data: libraries = [] } = useQuery<Library[]>({
    queryKey: ["/api/libraries"],
    staleTime: 60000,
  });

  const { data: copies = [] } = useQuery<BookCopy[]>({
    queryKey: ["/api/book-copies"],
    staleTime: 60000,
  });

  const activeSession = sessions.find(s => s.status === 'ACTIVE');
  const currentSessionId = selectedSession || activeSession?.id;

  const { data: sessionStats } = useQuery<SessionStats>({
    queryKey: [`/api/audit-sessions/${currentSessionId}/stats`],
    enabled: !!currentSessionId,
    staleTime: 10000,
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory-items", { sessionId: currentSessionId }],
    enabled: !!currentSessionId,
    staleTime: 10000,
  });

  const createSessionMutation = useMutation({
    mutationFn: async (data: { libraryId?: number; notes?: string }) => {
      const sessionCode = `AUD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
      const res = await apiRequest("POST", "/api/audit-sessions", {
        sessionCode,
        libraryId: data.libraryId || null,
        status: "ACTIVE",
        notes: data.notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/audit-sessions"] });
      setShowNewSessionDialog(false);
      setNewSessionLibraryId("");
      setNewSessionNotes("");
      toast({
        title: "Audit Session Started",
        description: "New inventory audit session has been created.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create audit session",
        variant: "destructive",
      });
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const res = await apiRequest("POST", `/api/audit-sessions/${sessionId}/complete`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/audit-sessions"] });
      toast({
        title: "Session Completed",
        description: "Audit session has been marked as complete.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete session",
        variant: "destructive",
      });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (ssn: string) => {
      if (!currentSessionId) throw new Error("No active session");
      const res = await apiRequest("POST", `/api/audit-sessions/${currentSessionId}/scan`, { ssn });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-items"] });
      queryClient.invalidateQueries({ queryKey: [`/api/audit-sessions/${currentSessionId}/stats`] });
      setScanInput("");
      
      if (data.duplicate) {
        toast({
          title: "Already Scanned",
          description: "This item was already verified in this session.",
          variant: "default",
        });
      } else if (data.warning) {
        toast({
          title: "Discrepancy Detected",
          description: data.warning,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Item Verified",
          description: `SSN ${data.copy?.userDefinedSSN || data.copy?.internalSSN} has been verified.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Scan Failed",
        description: error.message || "Item not found in system",
        variant: "destructive",
      });
    },
  });

  const handleScan = () => {
    if (!scanInput.trim()) return;
    if (!currentSessionId) {
      toast({
        title: "No Active Session",
        description: "Please start an audit session first.",
        variant: "destructive",
      });
      return;
    }
    scanMutation.mutate(scanInput.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
      case 'FOUND':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="mr-1 h-3 w-3" /> Verified
          </Badge>
        );
      case 'MISSING':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <AlertTriangle className="mr-1 h-3 w-3" /> Missing
          </Badge>
        );
      case 'DISCREPANCY':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <XCircle className="mr-1 h-3 w-3" /> Discrepancy
          </Badge>
        );
      case 'PENDING':
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            <Clock className="mr-1 h-3 w-3" /> Pending
          </Badge>
        );
    }
  };

  const getCopyDetails = (copyId: number) => {
    return copies.find(c => c.id === copyId);
  };

  const totalAssets = copies.length;
  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="page-title">
            Inventory Audit
          </h1>
          <p className="text-muted-foreground mt-1">Stock verification and asset management.</p>
        </div>
        <div className="flex gap-2">
          {activeSession ? (
            <Button 
              size="sm" 
              variant="outline"
              className="gap-2"
              onClick={() => completeSessionMutation.mutate(activeSession.id)}
              disabled={completeSessionMutation.isPending}
              data-testid="button-complete-session"
            >
              <Square className="h-4 w-4" />
              Complete Session
            </Button>
          ) : null}
          <Dialog open={showNewSessionDialog} onOpenChange={setShowNewSessionDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" data-testid="button-start-audit">
                <RefreshCcw className="h-4 w-4" />
                Start New Audit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start New Audit Session</DialogTitle>
                <DialogDescription>
                  Begin a new inventory audit session. You can optionally scope this audit to a specific library.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="library">Library (Optional)</Label>
                  <Select value={newSessionLibraryId} onValueChange={setNewSessionLibraryId}>
                    <SelectTrigger data-testid="select-library">
                      <SelectValue placeholder="All Libraries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Libraries</SelectItem>
                      {libraries.map((lib) => (
                        <SelectItem key={lib.id} value={String(lib.id)}>
                          {lib.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes for this audit session..."
                    value={newSessionNotes}
                    onChange={(e) => setNewSessionNotes(e.target.value)}
                    data-testid="input-session-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setShowNewSessionDialog(false)}
                  data-testid="button-cancel-session"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createSessionMutation.mutate({
                    libraryId: newSessionLibraryId && newSessionLibraryId !== 'all' ? parseInt(newSessionLibraryId) : undefined,
                    notes: newSessionNotes || undefined,
                  })}
                  disabled={createSessionMutation.isPending}
                  data-testid="button-confirm-start"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Audit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-assets">{totalAssets}</div>
            <p className="text-xs text-muted-foreground mt-1">Physical copies in system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-verified">
              {sessionStats?.verified || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {sessionStats && totalAssets > 0 
                ? `${Math.round((sessionStats.verified / totalAssets) * 100)}% completion rate`
                : 'No active session'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Missing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-missing">
              {sessionStats?.missing || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Items not found</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Discrepancies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600" data-testid="stat-discrepancies">
              {sessionStats?.discrepancy || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Location or library mismatch</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold">
              {currentSession ? (
                <>
                  Session: #{currentSession.sessionCode}
                  {currentSession.status === 'ACTIVE' && (
                    <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">Active</Badge>
                  )}
                  {currentSession.status === 'COMPLETED' && (
                    <Badge variant="secondary" className="ml-2">Completed</Badge>
                  )}
                </>
              ) : (
                "No Active Session"
              )}
            </h3>
            {sessions.length > 1 && (
              <Select 
                value={currentSessionId?.toString() || ""} 
                onValueChange={(v) => setSelectedSession(parseInt(v))}
              >
                <SelectTrigger className="w-[180px]" data-testid="select-session">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={String(session.id)}>
                      {session.sessionCode} {session.status === 'ACTIVE' ? '(Active)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Scan className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Scan SSN barcode..." 
                className="pl-9 h-9" 
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!currentSession || currentSession.status !== 'ACTIVE'}
                data-testid="input-scan-ssn"
              />
            </div>
            <Button 
              size="sm" 
              onClick={handleScan}
              disabled={!scanInput.trim() || scanMutation.isPending || !currentSession || currentSession.status !== 'ACTIVE'}
              data-testid="button-scan"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Verify
            </Button>
          </div>
        </div>

        {!currentSession ? (
          <div className="p-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No Active Audit Session</p>
            <p className="text-sm mt-1">Start a new audit session to begin scanning and verifying inventory.</p>
          </div>
        ) : inventoryItems.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Scan className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Ready to Scan</p>
            <p className="text-sm mt-1">Scan book copy SSN barcodes to verify inventory items.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SSN</TableHead>
                <TableHead>Expected Location</TableHead>
                <TableHead>Scanned Location</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Scanned At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryItems.map((item) => {
                const copy = getCopyDetails(item.bookCopyId);
                return (
                  <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                    <TableCell className="font-mono text-xs">{copy?.userDefinedSSN || copy?.internalSSN || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{item.expectedLocation || copy?.shelfLocation || '-'}</TableCell>
                    <TableCell>{item.scannedLocation || '-'}</TableCell>
                    <TableCell>{item.condition || copy?.condition || '-'}</TableCell>
                    <TableCell>
                      {item.scannedAt 
                        ? format(new Date(item.scannedAt), 'MMM d, h:mm a')
                        : format(new Date(item.createdAt), 'MMM d, h:mm a')}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {item.notes || '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {sessions.length > 0 && (
        <div className="bg-card rounded-lg border shadow-sm">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Recent Audit Sessions</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Scanned</TableHead>
                <TableHead>Missing</TableHead>
                <TableHead>Discrepancies</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.slice(0, 10).map((session) => (
                <TableRow 
                  key={session.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedSession(session.id)}
                  data-testid={`row-session-${session.id}`}
                >
                  <TableCell className="font-mono">{session.sessionCode}</TableCell>
                  <TableCell>
                    <Badge variant={session.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(session.startedAt), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    {session.completedAt ? format(new Date(session.completedAt), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell>{session.totalScanned ?? '-'}</TableCell>
                  <TableCell>{session.totalMissing ?? '-'}</TableCell>
                  <TableCell>{session.discrepancies ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </MainLayout>
  );
}
