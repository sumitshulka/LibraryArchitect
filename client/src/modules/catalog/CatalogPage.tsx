import { useState, useRef } from "react";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarcEditor } from "@/modules/catalog/MarcEditor";
import { Z3950Search } from "@/modules/catalog/Z3950Search";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Search, MoreHorizontal, Filter, Download, Database, FileText, Plus, Upload, Camera, Loader2,
  Book as BookIcon, Library, CheckCircle2, Clock, AlertTriangle, Truck, XCircle, History,
  DollarSign, ShoppingCart, Receipt, ImageIcon
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { booksApi, type BookDashboard, type BookLibraryAllocation } from "@/lib/api";
import type { Book, Circulation } from "@shared/schema";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCurrency } from "@/lib/useCurrency";

function BookDetailsSheet({
  open,
  onOpenChange,
  bookId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: number | null;
}) {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const { format: formatCurrency } = useCurrency();
  
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["book-dashboard", bookId],
    queryFn: () => booksApi.getDashboard(bookId!),
    enabled: open && bookId !== null,
  });

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bookId) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("cover", file);
      
      const res = await fetch(`/api/books/${bookId}/cover`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to upload cover");
      }
      
      queryClient.invalidateQueries({ queryKey: ["book-dashboard", bookId] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Cover image uploaded successfully");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (!bookId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[95vw] sm:w-[1100px] sm:max-w-[1100px] p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="text-left flex items-center gap-2">
            <BookIcon className="h-5 w-5" />
            Resource Dashboard
          </SheetTitle>
          <SheetDescription className="text-left">
            Overview of allocations and circulation history
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Loading...</div>
          ) : dashboard ? (
            <div className="p-6 space-y-6">
              {/* Book Details with Cover */}
              <div className="flex gap-6">
                {/* Cover Image Section */}
                <div className="flex-shrink-0">
                  <div className="relative group">
                    {dashboard.book.coverUrl ? (
                      <img 
                        src={dashboard.book.coverUrl} 
                        alt={dashboard.book.title}
                        className="w-32 h-48 object-cover rounded-lg border shadow-sm"
                      />
                    ) : (
                      <div className="w-32 h-48 bg-muted rounded-lg border flex flex-col items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8 mb-2" />
                        <span className="text-xs">No Cover</span>
                      </div>
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleCoverUpload}
                        className="hidden"
                        disabled={isUploading}
                        data-testid="input-cover-upload"
                      />
                      {isUploading ? (
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      ) : (
                        <div className="text-center text-white">
                          <Camera className="h-6 w-6 mx-auto mb-1" />
                          <span className="text-xs">Upload Cover</span>
                        </div>
                      )}
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Hover to upload
                  </p>
                </div>

                {/* Book Info */}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">{dashboard.book.title}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Author:</span>
                      <span className="ml-2">{dashboard.book.author}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ISBN:</span>
                      <span className="ml-2 font-mono">{dashboard.book.isbn}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Category:</span>
                      <span className="ml-2">{dashboard.book.category}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Format:</span>
                      <span className="ml-2 capitalize">{dashboard.book.format?.toLowerCase()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Publisher:</span>
                      <span className="ml-2">{dashboard.book.publisher || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Year:</span>
                      <span className="ml-2">{dashboard.book.publishedYear || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <BookIcon className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <div className="text-xl font-bold">{dashboard.totalCopies}</div>
                    <div className="text-xs text-muted-foreground">Total Copies</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                  <div>
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(dashboard.financials.totalFinesCollected)}
                    </div>
                    <div className="text-xs text-muted-foreground">Fines Collected</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg">
                  <Receipt className="h-6 w-6 text-amber-600" />
                  <div>
                    <div className="text-xl font-bold text-amber-600">
                      {formatCurrency(dashboard.financials.totalFinesOutstanding)}
                    </div>
                    <div className="text-xs text-muted-foreground">Fines Outstanding</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                  <div>
                    <div className="text-xl font-bold text-blue-600">
                      {formatCurrency(dashboard.financials.totalAcquisitionCost)}
                    </div>
                    <div className="text-xs text-muted-foreground">Acquisition Cost</div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Acquisition History */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Acquisition History
                </h4>
                {dashboard.acquisitionHistory.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground border rounded-lg border-dashed">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No acquisition records</p>
                    <p className="text-sm">No acquisition data available for this resource.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dashboard.acquisitionHistory.map((entry, index) => (
                      <div key={index} className="p-3 border rounded-lg text-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <ShoppingCart className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {entry.quantity} {entry.quantity === 1 ? "copy" : "copies"} acquired
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {entry.date ? format(new Date(entry.date), "MMM d, yyyy") : "Date unknown"}
                              {entry.source && ` • ${entry.source}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">
                            {formatCurrency(entry.cost)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(Math.round(entry.cost / entry.quantity))}/copy
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Library Allocations */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Library className="h-4 w-4" />
                  Library Allocations
                </h4>
                {dashboard.libraryAllocations.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground border rounded-lg border-dashed">
                    <Library className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No library allocations</p>
                    <p className="text-sm">This resource has not been allocated to any library yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.libraryAllocations.map((alloc) => (
                      <Card key={alloc.libraryId}>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm flex items-center justify-between">
                            <span>{alloc.libraryName}</span>
                            <Badge variant="outline" className="font-mono text-xs">
                              {alloc.libraryCode}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="flex flex-col items-center p-2 bg-green-50 rounded">
                              <CheckCircle2 className="h-4 w-4 text-green-600 mb-1" />
                              <span className="font-bold text-green-600">{alloc.available}</span>
                              <span className="text-muted-foreground">Available</span>
                            </div>
                            <div className="flex flex-col items-center p-2 bg-blue-50 rounded">
                              <XCircle className="h-4 w-4 text-blue-600 mb-1" />
                              <span className="font-bold text-blue-600">{alloc.checkedOut}</span>
                              <span className="text-muted-foreground">Issued</span>
                            </div>
                            <div className="flex flex-col items-center p-2 bg-amber-50 rounded">
                              <Clock className="h-4 w-4 text-amber-600 mb-1" />
                              <span className="font-bold text-amber-600">{alloc.reserved}</span>
                              <span className="text-muted-foreground">Reserved</span>
                            </div>
                            <div className="flex flex-col items-center p-2 bg-gray-50 rounded">
                              <BookIcon className="h-4 w-4 text-gray-600 mb-1" />
                              <span className="font-bold">{alloc.total}</span>
                              <span className="text-muted-foreground">Total</span>
                            </div>
                          </div>
                          {(alloc.damaged > 0 || alloc.lost > 0 || alloc.inTransit > 0) && (
                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                              {alloc.damaged > 0 && (
                                <span className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                  {alloc.damaged} damaged
                                </span>
                              )}
                              {alloc.lost > 0 && (
                                <span className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                  {alloc.lost} lost
                                </span>
                              )}
                              {alloc.inTransit > 0 && (
                                <span className="flex items-center gap-1">
                                  <Truck className="h-3 w-3 text-blue-500" />
                                  {alloc.inTransit} in transit
                                </span>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Recent Circulation History */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Recent Circulation
                </h4>
                {dashboard.recentCirculation.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground border rounded-lg border-dashed">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No circulation history</p>
                    <p className="text-sm">This resource has not been checked out yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dashboard.recentCirculation.map((record) => (
                      <div key={record.id} className="p-3 border rounded-lg text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant={record.status === "ACTIVE" ? "default" : "secondary"}>
                            {record.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Copy #{record.bookCopyId}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div>
                            <span className="text-muted-foreground">Checkout:</span>
                            <span className="ml-1">{format(new Date(record.checkoutDate), "MMM d, yyyy")}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Due:</span>
                            <span className="ml-1">{format(new Date(record.dueDate), "MMM d, yyyy")}</span>
                          </div>
                          {record.returnDate && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Returned:</span>
                              <span className="ml-1">{format(new Date(record.returnDate), "MMM d, yyyy")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default function CatalogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("browse");
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["books", searchQuery],
    queryFn: () => searchQuery ? booksApi.getAll(searchQuery) : booksApi.getAll(),
  });

  const handleBookClick = (bookId: number) => {
    setSelectedBookId(bookId);
    setSheetOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: booksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Book deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filteredBooks = books.filter((book) => {
    const matchesStatus = statusFilter ? book.status === statusFilter : true;
    return matchesStatus;
  });

  const getStatusColor = (status: Book['status']) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'CHECKED_OUT': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'LOST': return 'bg-red-100 text-red-800 hover:bg-red-100';
      case 'MAINTENANCE': return 'bg-orange-100 text-orange-800 hover:bg-orange-100';
      case 'RESERVED': return 'bg-purple-100 text-purple-800 hover:bg-purple-100';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this book?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-catalog-title">Catalog</h1>
          <p className="text-muted-foreground mt-1">Manage books, journals, and media resources.</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "browse" && (
            <>
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-export">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Link href="/catalog/bulk-upload">
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-bulk-upload">
                  <Upload className="h-4 w-4" />
                  Bulk Upload
                </Button>
              </Link>
            </>
          )}
          <Link href="/catalog/new">
            <Button size="sm" className="gap-2" data-testid="button-add-resource">
              <Plus className="h-4 w-4" />
              Add Resource
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="browse" className="w-full mt-6" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse" data-testid="tab-browse">Browse Collection</TabsTrigger>
          <TabsTrigger value="marc" className="gap-2" data-testid="tab-marc">
            <FileText className="h-4 w-4" />
            MARC Editor
          </TabsTrigger>
          <TabsTrigger value="z3950" className="gap-2" data-testid="tab-z3950">
            <Database className="h-4 w-4" />
            Z39.50 Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-6">
          <div className="bg-card rounded-lg border shadow-sm">
            <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by title, author, or ISBN..." 
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto" data-testid="button-filter">
                      <Filter className="h-4 w-4" />
                      Filter: {statusFilter || 'All'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setStatusFilter(null)}>All</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('AVAILABLE')}>Available</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('CHECKED_OUT')}>Checked Out</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('LOST')}>Lost</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('MAINTENANCE')}>Maintenance</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Cover</TableHead>
                  <TableHead>Title & Author</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden md:table-cell">ISBN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredBooks.length > 0 ? (
                  filteredBooks.map((book) => (
                    <TableRow key={book.id} data-testid={`row-book-${book.id}`}>
                      <TableCell>
                        {book.coverUrl ? (
                          <img 
                            src={book.coverUrl} 
                            alt={book.title}
                            className="h-12 w-8 object-cover rounded border"
                          />
                        ) : (
                          <div className="h-12 w-8 bg-muted rounded border flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => handleBookClick(book.id)}
                            className="font-medium text-left hover:text-primary hover:underline cursor-pointer"
                            data-testid={`text-title-${book.id}`}
                          >
                            {book.title}
                          </button>
                          <span className="text-xs text-muted-foreground">{book.author} • {book.publishedYear}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {book.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                        {book.isbn}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(book.status) + " border-none"} data-testid={`status-${book.id}`}>
                          {book.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${book.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>Edit Details</DropdownMenuItem>
                            <DropdownMenuItem>View MARC Record</DropdownMenuItem>
                            <DropdownMenuItem>View History</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleDelete(book.id)}
                              data-testid={`button-delete-${book.id}`}
                            >
                              Delete Record
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            
            <div className="p-4 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>Showing {filteredBooks.length} of {books.length} entries</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled>Previous</Button>
                <Button variant="outline" size="sm" disabled>Next</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="marc" className="mt-6">
          <MarcEditor />
        </TabsContent>

        <TabsContent value="z3950" className="mt-6">
          <Z3950Search />
        </TabsContent>
      </Tabs>

      <BookDetailsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        bookId={selectedBookId}
      />
    </MainLayout>
  );
}
