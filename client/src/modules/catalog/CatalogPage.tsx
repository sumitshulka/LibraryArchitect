import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookDialog } from "@/modules/catalog/BookDialog";
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
import { Search, MoreHorizontal, Filter, Download, Database, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { booksApi } from "@/lib/api";
import type { Book } from "@shared/schema";
import { toast } from "sonner";

export default function CatalogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("browse");
  const queryClient = useQueryClient();

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["books", searchQuery],
    queryFn: () => searchQuery ? booksApi.getAll(searchQuery) : booksApi.getAll(),
  });

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
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-export">
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
          <BookDialog />
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
                        <div className="h-12 w-8 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                          Img
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium" data-testid={`text-title-${book.id}`}>{book.title}</span>
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
    </MainLayout>
  );
}
