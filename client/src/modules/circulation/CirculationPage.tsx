import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { circulationApi, booksApi, usersApi } from "@/lib/api";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Search, BookOpen, RefreshCw, AlertCircle, CheckCircle2,
  Loader2, ArrowRight, RotateCcw, User, BookCopy, Calendar, Hash,
} from "lucide-react";
import { formatIsbn } from "@/lib/isbn";
import { toast } from "sonner";
import type { Book, User as UserType } from "@shared/schema";

export default function CirculationPage() {
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState("");
  const [isbnInput, setIsbnInput] = useState("");
  const [resolvedBook, setResolvedBook] = useState<Book | null>(null);
  const [resolvedUser, setResolvedUser] = useState<UserType | null>(null);
  const [bookError, setBookError] = useState("");
  const [isLookingUpBook, setIsLookingUpBook] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [txSearch, setTxSearch] = useState("");
  const [returnIsbn, setReturnIsbn] = useState("");
  const [returnInfo, setReturnInfo] = useState<{ circulationId: number; book: Book; user: UserType; dueDate: string; isOverdue: boolean } | null>(null);
  const [isLookingUpReturn, setIsLookingUpReturn] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const { data: circulation = [], isLoading: isLoadingCirculation } = useQuery({
    queryKey: ["circulation"],
    queryFn: () => circulationApi.getAll(),
  });

  const { data: books = [] } = useQuery({
    queryKey: ["books"],
    queryFn: () => booksApi.getAll(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.getAll,
  });

  const activeTransactions = circulation.filter(c => c.status === "ACTIVE" || c.status === "OVERDUE");

  useEffect(() => {
    if (selectedUserId) {
      const user = users.find(u => u.id === parseInt(selectedUserId));
      setResolvedUser(user || null);
    } else {
      setResolvedUser(null);
    }
  }, [selectedUserId, users]);

  const lookupBook = async () => {
    if (!isbnInput.trim()) return;
    setBookError("");
    setResolvedBook(null);
    setIsLookingUpBook(true);
    try {
      const cleanIsbn = isbnInput.replace(/[-\s]/g, "");
      const book = books.find(
        b => b.isbn.replace(/[-\s]/g, "") === cleanIsbn || b.isbn === isbnInput.trim()
      );
      if (!book) {
        setBookError("No book found with this ISBN");
        return;
      }
      if (book.status !== "AVAILABLE") {
        setBookError(`This book is currently ${book.status.toLowerCase()}`);
        return;
      }
      setResolvedBook(book);
    } finally {
      setIsLookingUpBook(false);
    }
  };

  const handleIssue = () => {
    if (!resolvedUser || !resolvedBook) {
      toast.error("Please select a member and look up a valid book");
      return;
    }
    setShowConfirmation(true);
  };

  const checkoutMutation = useMutation({
    mutationFn: () =>
      circulationApi.checkout({
        bookId: resolvedBook!.id,
        userId: resolvedUser!.id,
        dueDate: new Date(dueDate),
      }),
    onSuccess: () => {
      toast.success("Book issued successfully!");
      queryClient.invalidateQueries({ queryKey: ["circulation"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      setShowConfirmation(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const returnMutation = useMutation({
    mutationFn: (id: number) => circulationApi.returnBook(id),
    onSuccess: () => {
      toast.success("Book returned successfully!");
      queryClient.invalidateQueries({ queryKey: ["circulation"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      setReturnInfo(null);
      setReturnIsbn("");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const resetForm = () => {
    setSelectedUserId("");
    setIsbnInput("");
    setResolvedBook(null);
    setResolvedUser(null);
    setBookError("");
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDueDate(d.toISOString().split("T")[0]);
  };

  const lookupReturn = () => {
    if (!returnIsbn.trim()) return;
    setIsLookingUpReturn(true);
    setReturnInfo(null);
    try {
      const cleanIsbn = returnIsbn.replace(/[-\s]/g, "");
      const book = books.find(
        b => b.isbn.replace(/[-\s]/g, "") === cleanIsbn || b.isbn === returnIsbn.trim()
      );
      if (!book) {
        toast.error("No book found with this ISBN");
        return;
      }
      const activeCirc = circulation.find(c => c.bookId === book.id && (c.status === "ACTIVE" || c.status === "OVERDUE"));
      if (!activeCirc) {
        toast.error("This book does not have an active checkout");
        return;
      }
      const user = users.find(u => u.id === activeCirc.userId);
      if (!user) {
        toast.error("Could not find the borrower");
        return;
      }
      setReturnInfo({
        circulationId: activeCirc.id,
        book,
        user,
        dueDate: new Date(activeCirc.dueDate).toLocaleDateString(),
        isOverdue: new Date() > new Date(activeCirc.dueDate),
      });
    } finally {
      setIsLookingUpReturn(false);
    }
  };

  const filteredTransactions = activeTransactions.filter(record => {
    if (!txSearch) return true;
    const search = txSearch.toLowerCase();
    const book = books.find(b => b.id === record.bookId);
    const user = users.find(u => u.id === record.userId);
    return (
      book?.title.toLowerCase().includes(search) ||
      book?.isbn.toLowerCase().includes(search) ||
      user?.name.toLowerCase().includes(search) ||
      user?.email?.toLowerCase().includes(search) ||
      String(record.id).includes(search)
    );
  });

  const patronUsers = users.filter(u => u.status === "ACTIVE");

  const filteredUsers = userSearch
    ? patronUsers.filter(u =>
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.studentId && u.studentId.toLowerCase().includes(userSearch.toLowerCase())) ||
        (u.employeeId && u.employeeId.toLowerCase().includes(userSearch.toLowerCase()))
      )
    : patronUsers;

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
            Circulation
          </h1>
          <p className="text-muted-foreground mt-1">
            Issue and return books, manage active transactions.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Direct Checkout
            </CardTitle>
            <CardDescription>Issue a book to a library member</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Library Member
                </Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger data-testid="select-member" className="h-10">
                    <SelectValue placeholder="Select a member..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input
                        placeholder="Search members..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="h-8"
                        data-testid="input-member-search"
                      />
                    </div>
                    {filteredUsers.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        <div className="flex items-center gap-2">
                          <span>{u.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({u.role.toLowerCase()}{u.studentId ? ` - ${u.studentId}` : u.employeeId ? ` - ${u.employeeId}` : ""})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                    {filteredUsers.length === 0 && (
                      <div className="py-4 text-center text-sm text-muted-foreground">No members found</div>
                    )}
                  </SelectContent>
                </Select>
                {resolvedUser && (
                  <div className="text-xs text-muted-foreground p-2 bg-muted rounded-md">
                    <span className="font-medium">{resolvedUser.name}</span> &middot; {resolvedUser.email}
                    {resolvedUser.studentId && <> &middot; ID: {resolvedUser.studentId}</>}
                    {resolvedUser.employeeId && <> &middot; Emp: {resolvedUser.employeeId}</>}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  Book ISBN
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter or scan ISBN..."
                    value={isbnInput}
                    onChange={(e) => { setIsbnInput(e.target.value); setBookError(""); setResolvedBook(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupBook(); } }}
                    className="h-10"
                    data-testid="input-isbn"
                  />
                  <Button
                    variant="secondary"
                    onClick={lookupBook}
                    disabled={isLookingUpBook || !isbnInput.trim()}
                    className="h-10 px-3"
                    data-testid="button-lookup-isbn"
                  >
                    {isLookingUpBook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {bookError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {bookError}
                  </p>
                )}
                {resolvedBook && (
                  <div className="text-xs p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md space-y-0.5">
                    <div className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Book Found
                    </div>
                    <p className="font-medium text-foreground">{resolvedBook.title}</p>
                    <p className="text-muted-foreground">by {resolvedBook.author}</p>
                    <p className="text-muted-foreground">ISBN: {formatIsbn(resolvedBook.isbn)}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-end gap-4">
              <div className="space-y-2 w-48">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Due Date
                </Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="h-10"
                  data-testid="input-due-date"
                />
              </div>
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="gap-1.5"
                  data-testid="button-reset-checkout"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  onClick={handleIssue}
                  disabled={!resolvedUser || !resolvedBook}
                  className="gap-1.5"
                  data-testid="button-issue"
                >
                  <ArrowRight className="h-4 w-4" />
                  Issue Book
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Quick Return
            </CardTitle>
            <CardDescription>Process a book return</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Book ISBN</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Scan ISBN to return..."
                  value={returnIsbn}
                  onChange={(e) => { setReturnIsbn(e.target.value); setReturnInfo(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupReturn(); } }}
                  className="flex-1"
                  data-testid="input-return-isbn"
                />
                <Button
                  variant="secondary"
                  onClick={lookupReturn}
                  disabled={isLookingUpReturn || !returnIsbn.trim()}
                  data-testid="button-lookup-return"
                >
                  {isLookingUpReturn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                </Button>
              </div>
            </div>
            {returnInfo ? (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{returnInfo.book.title}</p>
                  <p className="text-xs text-muted-foreground">by {returnInfo.book.author}</p>
                  <p className="text-xs text-muted-foreground">ISBN: {formatIsbn(returnInfo.book.isbn)}</p>
                </div>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs"><span className="text-muted-foreground">Borrower:</span> {returnInfo.user.name}</p>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Due:</span>{" "}
                    <span className={returnInfo.isOverdue ? "text-red-600 font-medium" : ""}>
                      {returnInfo.dueDate}
                      {returnInfo.isOverdue && " (Overdue)"}
                    </span>
                  </p>
                </div>
                <Button
                  className="w-full gap-1.5"
                  onClick={() => returnMutation.mutate(returnInfo.circulationId)}
                  disabled={returnMutation.isPending}
                  data-testid="button-process-return"
                >
                  {returnMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Process Return
                </Button>
              </div>
            ) : (
              <div className="p-4 bg-muted/50 rounded-md text-sm text-muted-foreground text-center border border-dashed flex items-center justify-center min-h-[120px]">
                Scan a book ISBN to see return details
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-lg border shadow-sm mt-6">
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold" data-testid="text-active-transactions">Active Transactions</h3>
            <Badge variant="secondary" className="text-xs">{activeTransactions.length}</Badge>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              className="pl-9 h-9"
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              data-testid="input-search-transactions"
            />
          </div>
        </div>
        {isLoadingCirculation ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BookCopy className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">{txSearch ? "No matching transactions" : "No active transactions"}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Txn ID</TableHead>
                <TableHead>Book Details</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((record) => {
                const book = books.find(b => b.id === record.bookId);
                const user = users.find(u => u.id === record.userId);

                return (
                  <TableRow key={record.id} data-testid={`row-transaction-${record.id}`}>
                    <TableCell className="font-mono text-xs">#{record.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{book?.title || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">
                          ISBN: {book?.isbn ? formatIsbn(book.isbn) : "-"} &middot; {book?.author}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{user?.name || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">
                          {user?.studentId || user?.employeeId || user?.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(record.checkoutDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className={`text-sm ${record.status === "OVERDUE" ? "text-red-600 font-medium" : ""}`}>
                      {new Date(record.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`
                          ${record.status === "OVERDUE" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" : ""}
                          ${record.status === "ACTIVE" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" : ""}
                        `}
                      >
                        {record.status === "OVERDUE" && <AlertCircle className="mr-1 h-3 w-3" />}
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => returnMutation.mutate(record.id)}
                        disabled={returnMutation.isPending}
                        data-testid={`button-return-${record.id}`}
                      >
                        Return
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Book Issue</DialogTitle>
            <DialogDescription>Review the details below before issuing the book.</DialogDescription>
          </DialogHeader>
          {resolvedUser && resolvedBook && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <User className="h-4 w-4" />
                    Member Details
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <p className="text-xs text-muted-foreground">Member ID</p>
                      <p className="text-sm font-medium" data-testid="text-confirm-member-id">
                        {resolvedUser.studentId || resolvedUser.employeeId || `#${resolvedUser.id}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="text-sm font-medium" data-testid="text-confirm-member-name">{resolvedUser.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm">{resolvedUser.email}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    Book Details
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <p className="text-xs text-muted-foreground">ISBN</p>
                      <p className="text-sm font-medium font-mono" data-testid="text-confirm-isbn">{formatIsbn(resolvedBook.isbn)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Title</p>
                      <p className="text-sm font-medium" data-testid="text-confirm-title">{resolvedBook.title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Author</p>
                      <p className="text-sm">{resolvedBook.author}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div>
                  <p className="text-xs text-muted-foreground">Issue Date</p>
                  <p className="text-sm font-medium" data-testid="text-confirm-issue-date">{new Date().toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Return Date</p>
                  <p className="text-sm font-medium" data-testid="text-confirm-return-date">{new Date(dueDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              className="gap-1.5"
              data-testid="button-confirm-issue"
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Issue
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
