import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { mockBooks, BookItem } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookDialog } from "@/modules/catalog/BookDialog";
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
import { Search, MoreHorizontal, Filter, Download } from "lucide-react";

export default function CatalogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filteredBooks = mockBooks.filter((book) => {
    const matchesSearch = 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.isbn.includes(searchQuery);
    
    const matchesStatus = statusFilter ? book.status === statusFilter : true;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: BookItem['status']) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'CHECKED_OUT': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'LOST': return 'bg-red-100 text-red-800 hover:bg-red-100';
      case 'MAINTENANCE': return 'bg-orange-100 text-orange-800 hover:bg-orange-100';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Catalog</h1>
          <p className="text-muted-foreground mt-1">Manage books, journals, and media resources.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <BookDialog />
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by title, author, or ISBN..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
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
            {filteredBooks.map((book) => (
              <TableRow key={book.id}>
                <TableCell>
                  <div className="h-12 w-8 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                    Img
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{book.title}</span>
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
                  <Badge className={getStatusColor(book.status) + " border-none"}>
                    {book.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>Edit Details</DropdownMenuItem>
                      <DropdownMenuItem>View History</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">Delete Record</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filteredBooks.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        
        <div className="p-4 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {filteredBooks.length} of {mockBooks.length} entries</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm" disabled>Next</Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
