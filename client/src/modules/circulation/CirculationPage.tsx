import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { circulationApi, booksApi, bookCopiesApi, librariesApi, libraryMembershipsApi, reservationsApi } from "@/lib/api";
import { Link } from "wouter";
import { useCurrency } from "@/lib/useCurrency";
import { ReturnBookDialog } from "./ReturnBookDialog";
import { ReviewerDetailsDialog } from "@/components/layout/GlobalSearch";
import { useAuth } from "@/lib/auth";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search, BookOpen, RefreshCw, AlertCircle, CheckCircle2,
  Loader2, ArrowRight, RotateCcw, User, BookCopy as BookCopyIcon, Calendar, Hash,
  X, Filter, Tag, Building2,
} from "lucide-react";
import { formatIsbn } from "@/lib/isbn";
import { toast } from "sonner";
import type { Book, User as UserType, BookCopy as BookCopyType, Library, LibraryMembership } from "@shared/schema";

type SafeUser = Omit<UserType, "password">;
type CheckoutItem = {
  book: Book;
  copy: BookCopyType;
};

type ReturnInfo = {
  circulationId: number;
  book: Book;
  copy: BookCopyType | null;
  user: SafeUser;
  dueDate: string;
  isOverdue: boolean;
  accruedFine: number;
  fineOutstanding: number;
  damageOutstanding: number;
  daysOverdue: number;
};

function MemberSearchBox({
  selectedUser,
  onSelect,
  onClear,
}: {
  selectedUser: SafeUser | null;
  onSelect: (user: SafeUser) => void;
  onClear: () => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const { data, isFetching } = useQuery({
    queryKey: ["users-search", debouncedSearch, roleFilter, deptFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "ACTIVE", limit: "20" });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (roleFilter && roleFilter !== "ALL") params.set("role", roleFilter);
      if (deptFilter) params.set("department", deptFilter);
      const res = await fetch(`/api/users/search?${params}`);
      if (!res.ok) throw new Error("Failed to search users");
      return res.json() as Promise<{ users: SafeUser[]; totalCount: number }>;
    },
    enabled: isOpen,
    staleTime: 10000,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (user: SafeUser) => {
    onSelect(user);
    setIsOpen(false);
    setSearchText("");
  };

  if (selectedUser) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {selectedUser.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" data-testid="text-selected-member-name">{selectedUser.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {selectedUser.role.toLowerCase()}
                {selectedUser.studentId && ` · ${selectedUser.studentId}`}
                {selectedUser.employeeId && ` · ${selectedUser.employeeId}`}
                {selectedUser.department && ` · ${selectedUser.department}`}
                {" · "}{selectedUser.email}
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="shrink-0 h-7 w-7 p-0"
          data-testid="button-clear-member"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search by name, ID, email, or phone..."
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            className="h-10 pl-9 pr-10"
            data-testid="input-member-search"
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex gap-2">
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setIsOpen(true); }}>
            <SelectTrigger className="h-8 text-xs w-[130px]" data-testid="select-role-filter">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Roles</SelectItem>
              <SelectItem value="STUDENT">Student</SelectItem>
              <SelectItem value="FACULTY">Faculty</SelectItem>
              <SelectItem value="LIBRARIAN">Librarian</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Filter by department..."
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setIsOpen(true); }}
            className="h-8 text-xs flex-1"
            data-testid="input-dept-filter"
          />
          {(roleFilter !== "ALL" || deptFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => { setRoleFilter("ALL"); setDeptFilter(""); }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-[320px] overflow-hidden">
          {!data ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : data.users.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {searchText ? `No members found for "${searchText}"` : "No active members found"}
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[280px]">
              {data.totalCount > data.users.length && (
                <div className="px-3 py-1.5 bg-muted/50 text-xs text-muted-foreground border-b">
                  Showing {data.users.length} of {data.totalCount} results — type more to narrow down
                </div>
              )}
              {data.users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors border-b last:border-b-0"
                  data-testid={`button-select-member-${user.id}`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{user.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {user.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {user.studentId && <span>ID: {user.studentId}</span>}
                      {user.employeeId && <span>Emp: {user.employeeId}</span>}
                      {user.department && <span>{user.department}</span>}
                      <span className="truncate">{user.email}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BookSearchBox({
  books,
  selectedBook,
  onSelect,
  onClear,
}: {
  books: Book[];
  selectedBook: Book | null;
  onSelect: (book: Book) => void;
  onClear: () => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredBooks = useMemo(() => {
    if (!searchText.trim()) return books.slice(0, 15);
    const q = searchText.toLowerCase();
    const qClean = q.replace(/[-\s]/g, "");
    return books.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.isbn.replace(/[-\s]/g, "").includes(qClean) ||
      (b.category && b.category.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [searchText, books]);

  const handleSelect = (book: Book) => {
    onSelect(book);
    setIsOpen(false);
    setSearchText("");
  };

  if (selectedBook) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
        <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" data-testid="text-selected-book-title">{selectedBook.title}</p>
          <p className="text-xs text-muted-foreground truncate">by {selectedBook.author} · {formatIsbn(selectedBook.isbn)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="shrink-0 h-7 w-7 p-0" data-testid="button-clear-book">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search by title, author, ISBN, or category..."
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filteredBooks.length === 1) {
              e.preventDefault();
              handleSelect(filteredBooks[0]);
            }
            if (e.key === "Escape") setIsOpen(false);
          }}
          className="h-10 pl-9"
          data-testid="input-book-search"
          autoComplete="off"
        />
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-[300px] overflow-hidden">
          {filteredBooks.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {searchText ? `No books found for "${searchText}"` : "No books in catalog"}
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[300px]">
              {books.length > filteredBooks.length && searchText && (
                <div className="px-3 py-1.5 bg-muted/50 text-xs text-muted-foreground border-b">
                  Showing {filteredBooks.length} of {books.length} — type more to narrow down
                </div>
              )}
              {filteredBooks.map((book) => (
                <button
                  key={book.id}
                  onClick={() => handleSelect(book)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors border-b last:border-b-0"
                  data-testid={`button-select-book-${book.id}`}
                >
                  <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{book.title}</span>
                      {book.category && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{book.category}</Badge>
                      )}
                      {book.status !== "AVAILABLE" && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{book.status}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="truncate">by {book.author}</span>
                      <span>·</span>
                      <span className="font-mono shrink-0">{formatIsbn(book.isbn)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CirculationPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [resolvedBook, setResolvedBook] = useState<Book | null>(null);
  const [resolvedUser, setResolvedUser] = useState<SafeUser | null>(null);
  const [isbnInput, setIsbnInput] = useState("");
  const [bookError, setBookError] = useState("");
  const [isLookingUpBook, setIsLookingUpBook] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [availableCopies, setAvailableCopies] = useState<BookCopyType[]>([]);
  const [selectedCopy, setSelectedCopy] = useState<BookCopyType | null>(null);
  const [hasCopiesWithSSN, setHasCopiesWithSSN] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [txSearch, setTxSearch] = useState("");
  const [returnIdentifier, setReturnIdentifier] = useState("");
  const [returnItems, setReturnItems] = useState<ReturnInfo[]>([]);
  const [returnErrors, setReturnErrors] = useState<Record<number, string>>({});
  const [returnLookupError, setReturnLookupError] = useState("");
  const [isLookingUpReturn, setIsLookingUpReturn] = useState(false);
  const [bookLookupMode, setBookLookupMode] = useState<"isbn" | "browse">("isbn");
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
  const [reviewCopyId, setReviewCopyId] = useState<number | null>(null);

  const isAdmin = currentUser?.role === 'ADMIN';

  const { data: libraries = [] } = useQuery({
    queryKey: ["libraries-active"],
    queryFn: () => librariesApi.getActive(),
  });

  const { data: userMemberships = [] } = useQuery<LibraryMembership[]>({
    queryKey: ["user-memberships", currentUser?.id],
    queryFn: () => libraryMembershipsApi.getByUser(currentUser!.id),
    enabled: !!currentUser && !isAdmin,
  });

  const assignedLibrary = !isAdmin && userMemberships.length > 0
    ? userMemberships.find(m => m.isPrimaryLibrary && m.isActive) || userMemberships.find(m => m.isActive) || null
    : null;

  useEffect(() => {
    if (assignedLibrary && !selectedLibraryId) {
      setSelectedLibraryId(assignedLibrary.libraryId);
    }
  }, [assignedLibrary, selectedLibraryId]);

  const selectedLibrary = libraries.find(l => l.id === selectedLibraryId) || null;

  const { data: circulation = [], isLoading: isLoadingCirculation } = useQuery({
    queryKey: ["circulation"],
    queryFn: () => circulationApi.getAll(undefined, true),
  });

  const { data: books = [] } = useQuery({
    queryKey: ["books"],
    queryFn: () => booksApi.getAll(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const accessibleLibraryIds = new Set(
    userMemberships.filter(membership => membership.isActive).map(membership => membership.libraryId),
  );
  const activeTransactions = circulation.filter(c =>
    (c.status === "ACTIVE" || c.status === "OVERDUE") &&
    (isAdmin || (c.libraryId !== null && accessibleLibraryIds.has(c.libraryId))),
  );

  const clearBook = useCallback(() => {
    setIsbnInput("");
    setResolvedBook(null);
    setBookError("");
    setAvailableCopies([]);
    setSelectedCopy(null);
    setHasCopiesWithSSN(false);
  }, []);

  const handleBookSelect = useCallback(async (book: Book, preferredCopyId?: number) => {
    setBookError("");
    setResolvedBook(null);
    setAvailableCopies([]);
    setSelectedCopy(null);
    setHasCopiesWithSSN(false);
    if (book.status !== "AVAILABLE") {
      setBookError(`This book is currently ${book.status.toLowerCase()}`);
      return;
    }
    setResolvedBook(book);
    try {
      const copies = selectedLibraryId
        ? await bookCopiesApi.getByBookAndLibrary(book.id, selectedLibraryId)
        : await bookCopiesApi.getByBook(book.id);
      const issuableCopies = copies.filter(c => c.status === "AVAILABLE");
      setAvailableCopies(issuableCopies);
      setHasCopiesWithSSN(issuableCopies.length > 0);
      const preferredCopy = preferredCopyId
        ? issuableCopies.find(copy => copy.id === preferredCopyId)
        : undefined;
      if (preferredCopy) {
        setSelectedCopy(preferredCopy);
      } else if (issuableCopies.length === 1) {
        setSelectedCopy(issuableCopies[0]);
      } else if (preferredCopyId) {
        setBookError("The scanned copy is not available at the selected library");
      }
    } catch {}
  }, [selectedLibraryId]);

  const lookupBook = async () => {
    if (!isbnInput.trim()) return;
    setIsLookingUpBook(true);
    try {
      const result = await circulationApi.lookupBook(isbnInput.trim());
      await handleBookSelect(result.book, result.copy?.id);
    } catch (error) {
      setBookError(error instanceof Error ? error.message : "No book found with that ISBN, SSN, or barcode");
      setResolvedBook(null);
    } finally {
      setIsLookingUpBook(false);
    }
  };

  const pendingCheckoutItems = useMemo(() => {
    if (!resolvedBook || !selectedCopy) return checkoutItems;
    if (checkoutItems.some(item => item.copy.id === selectedCopy.id || item.book.id === resolvedBook.id)) {
      return checkoutItems;
    }
    return [...checkoutItems, { book: resolvedBook, copy: selectedCopy }];
  }, [checkoutItems, resolvedBook, selectedCopy]);

  const addCurrentBookToIssueList = () => {
    if (!resolvedBook || !selectedCopy) {
      toast.error("Look up a book and select an available copy first");
      return;
    }
    if (checkoutItems.some(item => item.copy.id === selectedCopy.id || item.book.id === resolvedBook.id)) {
      toast.error("This book is already in the issue list");
      return;
    }
    setCheckoutItems(items => [...items, { book: resolvedBook, copy: selectedCopy }]);
    clearBook();
    toast.success("Book added to issue list");
  };

  const removeCheckoutItem = (bookId: number) => {
    setCheckoutItems(items => items.filter(item => item.book.id !== bookId));
  };

  const handleIssue = () => {
    if (!selectedLibraryId) {
      toast.error("Please select a library before issuing");
      return;
    }
    if (!resolvedUser) {
      toast.error("Please select a member before issuing");
      return;
    }
    if (resolvedBook && hasCopiesWithSSN && !selectedCopy) {
      toast.error("Please select a copy before issuing");
      return;
    }
    if (pendingCheckoutItems.length === 0) {
      toast.error("Look up a valid book before issuing");
      return;
    }
    if (resolvedBook && availableCopies.length === 0 && selectedLibraryId) {
      toast.error("No available copies at the selected library");
      return;
    }
    setShowConfirmation(true);
  };

  const checkoutMutation = useMutation({
    mutationFn: () => circulationApi.checkoutMany(
      pendingCheckoutItems.map(({ book, copy }) => ({
        bookId: book.id,
        userId: resolvedUser!.id,
        dueDate: new Date(dueDate),
        libraryId: selectedLibraryId!,
        bookCopyId: copy.id,
      }))
    ),
    onSuccess: () => {
      toast.success(`${pendingCheckoutItems.length} ${pendingCheckoutItems.length === 1 ? "book" : "books"} issued successfully!`);
      queryClient.invalidateQueries({ queryKey: ["circulation"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      setShowConfirmation(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const [returnDialogId, setReturnDialogId] = useState<number | null>(null);
  const [returnDialogMeta, setReturnDialogMeta] = useState<{ title?: string; borrower?: string }>({});
  const { format: formatMoney } = useCurrency();

  const returnMutation = useMutation({
    mutationFn: (items: ReturnInfo[]) => circulationApi.returnMany(items.map(item => item.circulationId)),
    onSuccess: (result) => {
      const succeededIds = new Set(result.succeeded.map(item => item.circulationId));
      const nextErrors = Object.fromEntries(result.failed.map(item => [item.circulationId, item.error]));
      setReturnErrors(nextErrors);
      setReturnItems(current => current.filter(item => !succeededIds.has(item.circulationId)));

      if (result.failed.length === 0) {
        toast.success(`${result.succeeded.length} ${result.succeeded.length === 1 ? "book" : "books"} returned successfully!`);
        setReturnIdentifier("");
        setReturnLookupError("");
      } else if (result.succeeded.length > 0) {
        toast.error(`${result.succeeded.length} returned, but ${result.failed.length} could not be returned. Review the failed items below.`);
      } else {
        toast.error("No books were returned. Review the errors below and try again.");
      }
      queryClient.invalidateQueries({ queryKey: ["circulation"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["pending-fines"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const resetForm = () => {
    setResolvedUser(null);
    setIsbnInput("");
    setResolvedBook(null);
    setBookError("");
    setAvailableCopies([]);
    setSelectedCopy(null);
    setHasCopiesWithSSN(false);
    setCheckoutItems([]);
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDueDate(d.toISOString().split("T")[0]);
  };

  const handleLibraryChange = (libId: string) => {
    const id = parseInt(libId);
    setSelectedLibraryId(id);
    setResolvedBook(null);
    setIsbnInput("");
    setBookError("");
    setAvailableCopies([]);
    setSelectedCopy(null);
    setHasCopiesWithSSN(false);
    setCheckoutItems([]);
  };

  const lookupReturn = async () => {
    const identifier = returnIdentifier.trim();
    if (!identifier) return;
    setIsLookingUpReturn(true);
    setReturnLookupError("");
    try {
      const { book, copy } = await circulationApi.lookupBook(identifier);
      const activeCirculations = circulation.filter(c =>
        c.bookId === book.id && (c.status === "ACTIVE" || c.status === "OVERDUE")
      );
      const queuedIds = new Set(returnItems.map(item => item.circulationId));
      const activeCirc = copy
        ? activeCirculations.find(c => c.bookCopyId === copy.id)
        : activeCirculations.find(c => !queuedIds.has(c.id));
      if (!activeCirc) {
        const message = copy
          ? "This copy does not have an active checkout"
          : activeCirculations.length > 0
            ? "All active checkouts for this book are already in the return list"
            : "This book does not have an active checkout";
        setReturnLookupError(message);
        toast.error(message);
        return;
      }
      const user = allUsers.find((u: any) => u.id === activeCirc.userId);
      if (!user) {
        const message = "Could not find the borrower";
        setReturnLookupError(message);
        toast.error(message);
        return;
      }
      const returnItem: ReturnInfo = {
        circulationId: activeCirc.id,
        book,
        copy,
        user,
        dueDate: new Date(activeCirc.dueDate).toLocaleDateString(),
        isOverdue: (activeCirc as any).isOverdue ?? new Date() > new Date(activeCirc.dueDate),
        accruedFine: (activeCirc as any).accruedFine ?? activeCirc.fineAmount ?? 0,
        fineOutstanding: (activeCirc as any).fineOutstanding ?? 0,
        damageOutstanding: (activeCirc as any).damageOutstanding ?? 0,
        daysOverdue: (activeCirc as any).daysOverdue ?? 0,
      };
      if (returnItems.some(item => item.circulationId === returnItem.circulationId)) {
        const message = "This checkout is already in the return list";
        setReturnLookupError(message);
        toast.error(message);
        return;
      }
      setReturnItems(items => [...items, returnItem]);
      setReturnIdentifier("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not look up this book";
      setReturnLookupError(message);
      toast.error(message);
    } finally {
      setIsLookingUpReturn(false);
    }
  };

  const removeReturnItem = (circulationId: number) => {
    setReturnItems(items => items.filter(item => item.circulationId !== circulationId));
    setReturnErrors(errors => {
      const next = { ...errors };
      delete next[circulationId];
      return next;
    });
  };

  const processReturns = () => {
    if (returnItems.length === 0) {
      toast.error("Scan or look up at least one active checkout first");
      return;
    }
    returnMutation.mutate(returnItems);
  };

  const filteredTransactions = activeTransactions.filter(record => {
    if (!txSearch) return true;
    const search = txSearch.toLowerCase();
    const book = books.find(b => b.id === record.bookId);
    const user = allUsers.find((u: any) => u.id === record.userId);
    const matchesBookOrMember = (
      book?.title.toLowerCase().includes(search) ||
      book?.isbn.toLowerCase().includes(search) ||
      user?.name?.toLowerCase().includes(search) ||
      user?.email?.toLowerCase().includes(search) ||
      String(record.id).includes(search)
    );
    return matchesBookOrMember ||
      record.bookTitle?.toLowerCase().includes(search) ||
      record.bookIsbn?.toLowerCase().includes(search) ||
      record.copySSN?.toLowerCase().includes(search) ||
      record.copyBarcode?.toLowerCase().includes(search) ||
      record.libraryName?.toLowerCase().includes(search);
  });

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

      <Tabs defaultValue="checkout" className="mt-6">
        <TabsList data-testid="tabs-circulation">
          <TabsTrigger value="checkout" className="gap-1.5" data-testid="tab-checkout">
            <BookOpen className="h-4 w-4" />
            Direct Checkout
          </TabsTrigger>
          <TabsTrigger value="return" className="gap-1.5" data-testid="tab-return">
            <RefreshCw className="h-4 w-4" />
            Quick Return
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkout">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Issue a Book
              </CardTitle>
              <CardDescription>Search for a library member, scan an ISBN, SSN, or copy barcode, and issue one or more books</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Building2 className="h-3.5 w-3.5" />
                  Issuing Library
                </Label>
                {isAdmin ? (
                  <Select
                    value={selectedLibraryId ? String(selectedLibraryId) : ""}
                    onValueChange={handleLibraryChange}
                  >
                    <SelectTrigger className="h-10 w-full max-w-md" data-testid="select-library">
                      <SelectValue placeholder="Select a library..." />
                    </SelectTrigger>
                    <SelectContent>
                      {libraries.map((lib) => (
                        <SelectItem key={lib.id} value={String(lib.id)} data-testid={`select-library-${lib.id}`}>
                          {lib.name} ({lib.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : selectedLibrary ? (
                  <div className="flex items-center gap-2 h-10 px-3 bg-muted/50 border rounded-md w-full max-w-md">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid="text-assigned-library">
                      {selectedLibrary.name} ({selectedLibrary.code})
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> No library assigned. Contact an administrator.
                  </p>
                )}
                {!selectedLibraryId && isAdmin && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> You must select a library before issuing books
                  </p>
                )}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <User className="h-3.5 w-3.5" />
                    Library Member
                  </Label>
                  <MemberSearchBox
                    selectedUser={resolvedUser}
                    onSelect={setResolvedUser}
                    onClear={() => setResolvedUser(null)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Hash className="h-3.5 w-3.5" />
                      Book
                    </Label>
                    <div className="flex text-xs border rounded-md overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => { setBookLookupMode("isbn"); clearBook(); }}
                        className={`px-2.5 py-1 transition-colors ${bookLookupMode === "isbn" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        data-testid="button-mode-isbn"
                      >
                         ISBN / SSN / Barcode
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBookLookupMode("browse"); clearBook(); }}
                        className={`px-2.5 py-1 border-l transition-colors ${bookLookupMode === "browse" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        data-testid="button-mode-browse"
                      >
                        Browse Catalog
                      </button>
                    </div>
                  </div>

                  {bookLookupMode === "isbn" ? (
                    <>
                      <div className="flex gap-2">
                        <Input
                           placeholder="Enter or scan ISBN, SSN, or copy barcode..."
                          value={isbnInput}
                          onChange={(e) => { setIsbnInput(e.target.value); setBookError(""); setResolvedBook(null); setAvailableCopies([]); setSelectedCopy(null); setHasCopiesWithSSN(false); }}
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
                           {selectedCopy && (
                             <p className="text-muted-foreground">
                               Copy: {selectedCopy.userDefinedSSN || selectedCopy.internalSSN || selectedCopy.barcode}
                             </p>
                           )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <BookSearchBox
                        books={books}
                        selectedBook={resolvedBook}
                        onSelect={handleBookSelect}
                        onClear={clearBook}
                      />
                      {bookError && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {bookError}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {resolvedBook && selectedLibraryId && availableCopies.length === 0 && !isLookingUpBook && (
                <div className="space-y-2">
                  <div className="text-xs p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-amber-700 dark:text-amber-300">
                      No available copies of this book at {selectedLibrary?.name || 'the selected library'}.
                    </span>
                  </div>
                  <BookReservationsHint bookId={resolvedBook.id} libraryId={selectedLibraryId} />
                </div>
              )}

              {hasCopiesWithSSN && resolvedBook && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <Tag className="h-3.5 w-3.5" />
                    Select Copy{selectedLibrary ? ` from ${selectedLibrary.name}` : ''}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {availableCopies.length} available {availableCopies.length === 1 ? "copy" : "copies"}{selectedLibrary ? ` at ${selectedLibrary.name}` : ''}. Select the specific copy to issue.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {availableCopies.map((copy) => {
                      const ssn = copy.userDefinedSSN || copy.internalSSN;
                      const isSelected = selectedCopy?.id === copy.id;
                      return (
                        <button
                          key={copy.id}
                          onClick={() => setSelectedCopy(isSelected ? null : copy)}
                          className={`text-left p-3 rounded-lg border-2 transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-primary/40 hover:bg-muted/50"
                          }`}
                          data-testid={`button-select-copy-${copy.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {ssn && (
                                <p className="text-sm font-semibold font-mono truncate" data-testid={`text-copy-ssn-${copy.id}`}>
                                  SSN: {ssn}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Barcode: {copy.barcode}
                              </p>
                              {copy.shelfLocation && (
                                <p className="text-xs text-muted-foreground">
                                  Shelf: {copy.shelfLocation}
                                </p>
                              )}
                              {copy.condition && (
                                <p className="text-xs text-muted-foreground">
                                  Condition: {copy.condition}
                                </p>
                              )}
                            </div>
                            <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                            }`}>
                              {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!selectedCopy && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Please select a copy before issuing
                    </p>
                  )}
                </div>
              )}

              {checkoutItems.length > 0 && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium">Books ready to issue</Label>
                    <Badge variant="secondary">{checkoutItems.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {checkoutItems.map(({ book, copy }) => (
                      <div key={book.id} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
                        <BookOpen className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{book.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatIsbn(book.isbn)} · {copy.userDefinedSSN || copy.internalSSN || copy.barcode}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCheckoutItem(book.id)}
                          className="h-7 w-7 shrink-0 p-0"
                          data-testid={`button-remove-checkout-book-${book.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                    onClick={addCurrentBookToIssueList}
                    disabled={!resolvedBook || !selectedCopy || checkoutItems.some(item => item.book.id === resolvedBook?.id)}
                    className="gap-1.5"
                    data-testid="button-add-book-to-issue-list"
                  >
                    <BookOpen className="h-4 w-4" />
                    Add Book
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    className="gap-1.5"
                    data-testid="button-reset-checkout"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Checkout New
                  </Button>
                  <Button
                    onClick={handleIssue}
                    disabled={Boolean(!selectedLibraryId || !resolvedUser || pendingCheckoutItems.length === 0 || (resolvedBook && hasCopiesWithSSN && !selectedCopy) || (resolvedBook && selectedLibraryId && availableCopies.length === 0))}
                    className="gap-1.5"
                    data-testid="button-issue"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Issue {pendingCheckoutItems.length || 1} {pendingCheckoutItems.length === 1 ? "Book" : "Books"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="return">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Quick Return
              </CardTitle>
              <CardDescription>Scan or enter several ISBNs, SSNs, or copy barcodes, review each checkout, and return them together</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <Hash className="h-3.5 w-3.5" />
                    Book Identifier
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter or scan ISBN, SSN, or copy barcode..."
                      value={returnIdentifier}
                      onChange={(e) => { setReturnIdentifier(e.target.value); setReturnLookupError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupReturn(); } }}
                      className="h-10 flex-1"
                      data-testid="input-return-isbn"
                    />
                    <Button
                      variant="secondary"
                      onClick={lookupReturn}
                      disabled={isLookingUpReturn || !returnIdentifier.trim()}
                      className="h-10"
                      data-testid="button-lookup-return"
                    >
                      {isLookingUpReturn ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-1.5" />Add to List</>}
                    </Button>
                  </div>
                  {returnLookupError && (
                    <p className="text-xs text-red-600 flex items-center gap-1" data-testid="text-return-lookup-error">
                      <AlertCircle className="h-3 w-3" /> {returnLookupError}
                    </p>
                  )}
                </div>

                {returnItems.length === 0 ? (
                  <div className="p-6 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center border border-dashed flex flex-col items-center justify-center min-h-[140px]">
                    <RefreshCw className="h-8 w-8 mb-2 opacity-40" />
                    <p>Scan or enter a book identifier to add the first return</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">Return list</p>
                        <p className="text-xs text-muted-foreground">Review the borrower, due date, and fine information before confirming.</p>
                      </div>
                      <Badge variant="secondary">{returnItems.length}</Badge>
                    </div>
                    {returnItems.map((item) => (
                      <div
                        key={item.circulationId}
                        className={`p-4 rounded-lg border space-y-3 ${returnErrors[item.circulationId] ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30" : "bg-muted/50"}`}
                        data-testid={`return-item-${item.circulationId}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Book</p>
                            <p className="text-sm font-semibold">{item.book.title}</p>
                            <p className="text-xs text-muted-foreground">by {item.book.author} · ISBN: {formatIsbn(item.book.isbn)}</p>
                            {item.copy && (
                              <p className="text-xs text-muted-foreground">
                                Copy: {item.copy.userDefinedSSN || item.copy.internalSSN || item.copy.barcode}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeReturnItem(item.circulationId)}
                            className="h-7 w-7 shrink-0 p-0"
                            aria-label={`Remove ${item.book.title} from return list`}
                            data-testid={`button-remove-return-${item.circulationId}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Borrower</p>
                            <p className="text-sm font-medium mt-0.5">{item.user.name}</p>
                            <p className="text-xs text-muted-foreground">{item.user.email}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Due Date</p>
                            <p className={`text-sm font-medium mt-0.5 ${item.isOverdue ? "text-red-600" : ""}`}>{item.dueDate}</p>
                            {item.isOverdue && <Badge variant="destructive" className="text-[10px] mt-1">Overdue</Badge>}
                          </div>
                        </div>
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                          <p className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">Fine information</p>
                          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Accrued fine</p>
                              <p className="font-semibold">{formatMoney(item.accruedFine)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Outstanding fine</p>
                              <p className={`font-semibold ${item.fineOutstanding > 0 ? "text-red-600" : ""}`}>{formatMoney(item.fineOutstanding)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Outstanding damage</p>
                              <p className={`font-semibold ${item.damageOutstanding > 0 ? "text-red-600" : ""}`}>{formatMoney(item.damageOutstanding)}</p>
                            </div>
                          </div>
                        </div>
                        {returnErrors[item.circulationId] && (
                          <p className="text-xs text-red-700 dark:text-red-300 flex items-center gap-1" data-testid={`text-return-error-${item.circulationId}`}>
                            <AlertCircle className="h-3 w-3 shrink-0" /> {returnErrors[item.circulationId]}
                          </p>
                        )}
                      </div>
                    ))}
                    <Button
                      className="w-full gap-1.5"
                      onClick={processReturns}
                      disabled={returnMutation.isPending}
                      data-testid="button-process-return"
                    >
                      {returnMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Confirm {returnItems.length} {returnItems.length === 1 ? "Return" : "Returns"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="bg-card rounded-lg border shadow-sm mt-6">
        <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold" data-testid="text-active-transactions">Active Transactions</h3>
            <Badge variant="secondary" className="text-xs">{activeTransactions.length}</Badge>
            <span className="hidden text-xs text-muted-foreground lg:inline">
              {isAdmin ? "All libraries" : "Your assigned libraries"}
            </span>
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
            <BookCopyIcon className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">{txSearch ? "No matching transactions" : "No active transactions"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Txn ID</TableHead>
                <TableHead>Book Details</TableHead>
                <TableHead>Copy / SSN</TableHead>
                <TableHead>Issued From</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Accrued Fine</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((record) => {
                const book = books.find(b => b.id === record.bookId);
                const user = allUsers.find((u: any) => u.id === record.userId);

                return (
                  <TableRow key={record.id} data-testid={`row-transaction-${record.id}`}>
                    <TableCell className="font-mono text-xs">#{record.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{book?.title || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">
                          ISBN: {record.bookIsbn ? formatIsbn(record.bookIsbn) : book?.isbn ? formatIsbn(book.isbn) : "-"} · {record.bookAuthor || book?.author}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span className="font-mono font-medium">
                          SSN: {record.copySSN || "—"}
                        </span>
                        <span className="text-muted-foreground">
                          Barcode: {record.copyBarcode || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{record.libraryName || "Unallocated"}</span>
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
                    <TableCell className={`text-sm ${(record as any).isOverdue || record.status === "OVERDUE" ? "text-red-600 font-medium" : ""}`}>
                      {new Date(record.dueDate).toLocaleDateString()}
                      {(record as any).daysOverdue > 0 && (
                        <span className="block text-xs text-red-600">{(record as any).daysOverdue}d overdue</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`
                          ${(record as any).isOverdue || record.status === "OVERDUE" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" : ""}
                          ${!(record as any).isOverdue && record.status === "ACTIVE" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" : ""}
                        `}
                      >
                        {((record as any).isOverdue || record.status === "OVERDUE") && <AlertCircle className="mr-1 h-3 w-3" />}
                        {(record as any).isOverdue ? "OVERDUE" : record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-accrued-fine-${record.id}`}>
                      {(record as any).accruedFine > 0 ? (
                        <span className={(record as any).fineOutstanding > 0 ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                          {formatMoney((record as any).accruedFine)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {record.bookCopyId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReviewCopyId(record.bookCopyId!)}
                            data-testid={`button-view-transaction-${record.id}`}
                          >
                            Details
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReturnDialogId(record.id);
                            setReturnDialogMeta({ title: book?.title || record.bookTitle || undefined, borrower: user?.name });
                          }}
                          data-testid={`button-return-${record.id}`}
                        >
                          Return
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </div>

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
         <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
             <DialogTitle>Confirm Book Issue{pendingCheckoutItems.length === 1 ? "" : "s"}</DialogTitle>
             <DialogDescription>
               Review the {pendingCheckoutItems.length} {pendingCheckoutItems.length === 1 ? "book" : "books"} below before issuing.
             </DialogDescription>
          </DialogHeader>
           {resolvedUser && pendingCheckoutItems.length > 0 && (
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
                    Book Details ({pendingCheckoutItems.length})
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {pendingCheckoutItems.map(({ book, copy }, index) => (
                      <div key={book.id} className="rounded-md border bg-background p-3" data-testid={`row-confirm-book-${book.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Book {index + 1}</p>
                            <p className="truncate text-sm font-medium" data-testid={index === 0 ? "text-confirm-title" : undefined}>{book.title}</p>
                            <p className="text-xs text-muted-foreground">by {book.author}</p>
                          </div>
                          <div className="shrink-0 text-right text-xs">
                            <p className="font-mono">{formatIsbn(book.isbn)}</p>
                            <p className="text-muted-foreground">{copy.userDefinedSSN || copy.internalSSN || copy.barcode}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selectedLibrary && (
                <div className="flex items-center gap-2 p-3 bg-violet-50 dark:bg-violet-950 rounded-lg border border-violet-200 dark:border-violet-800">
                  <Building2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Issuing Library</p>
                    <p className="text-sm font-semibold" data-testid="text-confirm-library">{selectedLibrary.name} ({selectedLibrary.code})</p>
                  </div>
                </div>
              )}

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
      <ReturnBookDialog
        circulationId={returnDialogId}
        bookTitle={returnDialogMeta.title}
        borrowerName={returnDialogMeta.borrower}
        onClose={() => setReturnDialogId(null)}
      />
      <ReviewerDetailsDialog
        open={reviewCopyId !== null}
        onOpenChange={(open) => !open && setReviewCopyId(null)}
        bookId={null}
        copyId={reviewCopyId}
      />
    </MainLayout>
  );
}

function BookReservationsHint({ bookId, libraryId }: { bookId: number; libraryId: number }) {
  const { data: reservations = [] } = useQuery({
    queryKey: ["book-reservations", bookId, libraryId],
    queryFn: () => reservationsApi.forBook(bookId, libraryId),
  });
  const active = reservations.filter((r: any) => r.status === 'ACTIVE');
  if (active.length === 0) return null;
  return (
    <div className="text-xs p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md space-y-1.5">
      <div className="font-medium text-blue-700 dark:text-blue-300 flex items-center justify-between">
        <span>{active.length} active reservation{active.length === 1 ? '' : 's'} on this book at this library</span>
        <Link href="/reservations" className="underline text-blue-700 dark:text-blue-300" data-testid="link-go-to-reservations">Manage →</Link>
      </div>
      <ul className="space-y-0.5">
        {active.slice(0, 5).map((r: any) => (
          <li key={r.id} className="text-blue-900 dark:text-blue-200 flex justify-between gap-2">
            <span>• {r.userName} <span className="text-muted-foreground">({r.userIdentifier})</span></span>
            <span className="font-mono text-[10px]">{r.copySSN || r.copyBarcode || ''}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">Reserved copies are held for the patron. Use the Reservations page to process pickup or cancel a hold to free a copy.</p>
    </div>
  );
}
