import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Package, ChevronDown, ChevronRight, Library, Loader2, CheckCircle, AlertCircle, Hash } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { allocationsApi, librariesApi, type UnallocatedCopyInfo } from "@/lib/api";
import { toast } from "sonner";

export default function AllocationsPage() {
  const queryClient = useQueryClient();
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set());
  const [selectedCopies, setSelectedCopies] = useState<Map<number, Set<number>>>(new Map());
  const [showAllocationDialog, setShowAllocationDialog] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [generateSSN, setGenerateSSN] = useState(true);
  const [ssnPrefix, setSsnPrefix] = useState("SSN");

  const { data: unallocatedBooks = [], isLoading: loadingUnallocated, refetch } = useQuery({
    queryKey: ["unallocated-copies"],
    queryFn: allocationsApi.getUnallocated,
  });

  const { data: libraries = [], isLoading: loadingLibraries } = useQuery({
    queryKey: ["libraries"],
    queryFn: librariesApi.getAll,
  });

  const activeLibraries = libraries.filter(lib => lib.isActive);

  const allocateMutation = useMutation({
    mutationFn: allocationsApi.allocate,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["unallocated-copies"] });
      toast.success(`Successfully allocated ${result.allocatedCount} copies`);
      setShowAllocationDialog(false);
      setSelectedCopies(new Map());
      setSelectedLibraryId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleBookExpanded = (bookId: number) => {
    const newExpanded = new Set(expandedBooks);
    if (newExpanded.has(bookId)) {
      newExpanded.delete(bookId);
    } else {
      newExpanded.add(bookId);
    }
    setExpandedBooks(newExpanded);
  };

  const toggleCopySelection = (bookId: number, copyId: number) => {
    const newSelected = new Map(selectedCopies);
    if (!newSelected.has(bookId)) {
      newSelected.set(bookId, new Set());
    }
    const bookCopies = newSelected.get(bookId)!;
    if (bookCopies.has(copyId)) {
      bookCopies.delete(copyId);
    } else {
      bookCopies.add(copyId);
    }
    if (bookCopies.size === 0) {
      newSelected.delete(bookId);
    }
    setSelectedCopies(newSelected);
  };

  const selectAllCopies = (bookId: number, copies: UnallocatedCopyInfo["copies"]) => {
    const newSelected = new Map(selectedCopies);
    const currentlySelected = newSelected.get(bookId) || new Set();
    
    if (currentlySelected.size === copies.length) {
      newSelected.delete(bookId);
    } else {
      newSelected.set(bookId, new Set(copies.map(c => c.id)));
    }
    setSelectedCopies(newSelected);
  };

  const getTotalSelectedCount = () => {
    let count = 0;
    selectedCopies.forEach(copies => {
      count += copies.size;
    });
    return count;
  };

  const getAllSelectedCopyIds = (): number[] => {
    const ids: number[] = [];
    selectedCopies.forEach(copies => {
      copies.forEach(id => ids.push(id));
    });
    return ids;
  };

  const handleAllocate = () => {
    if (!selectedLibraryId) {
      toast.error("Please select a library");
      return;
    }

    const copyIds = getAllSelectedCopyIds();
    if (copyIds.length === 0) {
      toast.error("Please select at least one copy to allocate");
      return;
    }

    allocateMutation.mutate({
      copyIds,
      libraryId: selectedLibraryId,
      generateSSN,
      ssnPrefix: generateSSN ? ssnPrefix : undefined,
    });
  };

  const totalUnallocated = unallocatedBooks.reduce((sum, book) => sum + book.totalUnallocatedCopies, 0);
  const selectedCount = getTotalSelectedCount();

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
            Resource Allocations
          </h1>
          <p className="text-muted-foreground mt-1">
            Distribute book copies to libraries and assign Internal SSNs for tracking.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {selectedCount > 0 && (
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {selectedCount} copies selected
            </Badge>
          )}
          <Button
            onClick={() => setShowAllocationDialog(true)}
            disabled={selectedCount === 0}
            data-testid="button-allocate"
          >
            <Package className="h-4 w-4 mr-2" />
            Allocate Selected
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Unallocated Resources
          </CardTitle>
          <CardDescription>
            {totalUnallocated > 0 
              ? `${totalUnallocated} copies across ${unallocatedBooks.length} resources are awaiting allocation to libraries.`
              : "All copies have been allocated to libraries."}
          </CardDescription>
        </CardHeader>
      </Card>

      {loadingUnallocated ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : unallocatedBooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All Resources Allocated</h3>
            <p className="text-muted-foreground">
              All book copies have been allocated to libraries. Add new resources to the catalog to create more copies for allocation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {unallocatedBooks.map((book) => {
            const isExpanded = expandedBooks.has(book.bookId);
            const selectedForBook = selectedCopies.get(book.bookId) || new Set();
            const allSelected = selectedForBook.size === book.copies.length;
            const someSelected = selectedForBook.size > 0 && !allSelected;

            return (
              <Card key={book.bookId} data-testid={`card-book-${book.bookId}`}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleBookExpanded(book.bookId)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => selectAllCopies(book.bookId, book.copies)}
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`checkbox-book-${book.bookId}`}
                              className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                            />
                          </div>
                          <div>
                            <CardTitle className="text-base">{book.bookTitle}</CardTitle>
                            <CardDescription className="mt-1">
                              {book.bookAuthor} · ISBN: {book.bookIsbn}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={book.bookFormat === 'PHYSICAL' ? 'default' : 'secondary'}>
                            {book.bookFormat}
                          </Badge>
                          <Badge variant="outline" className="font-mono">
                            {book.totalUnallocatedCopies} copies
                          </Badge>
                          {selectedForBook.size > 0 && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              {selectedForBook.size} selected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Barcode</TableHead>
                            <TableHead>Shelf Location</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {book.copies.map((copy) => {
                            const isSelected = selectedForBook.has(copy.id);
                            return (
                              <TableRow 
                                key={copy.id} 
                                className={isSelected ? "bg-blue-50" : ""}
                                data-testid={`row-copy-${copy.id}`}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleCopySelection(book.bookId, copy.id)}
                                    data-testid={`checkbox-copy-${copy.id}`}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm">{copy.barcode}</TableCell>
                                <TableCell>{copy.shelfLocation || "-"}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {copy.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {new Date(copy.createdAt).toLocaleDateString()}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAllocationDialog} onOpenChange={setShowAllocationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate Copies to Library</DialogTitle>
            <DialogDescription>
              You are about to allocate {selectedCount} copies to a library.
              {generateSSN && " Internal SSNs will be generated for each physical copy."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="library">Target Library *</Label>
              {loadingLibraries ? (
                <div className="text-sm text-muted-foreground">Loading libraries...</div>
              ) : activeLibraries.length === 0 ? (
                <div className="text-sm text-amber-600">No active libraries available.</div>
              ) : (
                <Select 
                  value={selectedLibraryId?.toString() || ""} 
                  onValueChange={(val) => setSelectedLibraryId(parseInt(val))}
                >
                  <SelectTrigger data-testid="select-library">
                    <SelectValue placeholder="Select a library" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeLibraries.map((lib) => (
                      <SelectItem key={lib.id} value={lib.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Library className="h-4 w-4" />
                          {lib.name} ({lib.code})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="generate-ssn" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Generate Internal SSNs
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Create unique serial numbers for physical copies to track circulation.
                  </p>
                </div>
                <Switch
                  id="generate-ssn"
                  checked={generateSSN}
                  onCheckedChange={setGenerateSSN}
                  data-testid="switch-generate-ssn"
                />
              </div>
              
              {generateSSN && (
                <div className="space-y-2">
                  <Label htmlFor="ssn-prefix">SSN Prefix</Label>
                  <Input
                    id="ssn-prefix"
                    placeholder="e.g., LIB-CS"
                    value={ssnPrefix}
                    onChange={(e) => setSsnPrefix(e.target.value.toUpperCase())}
                    className="font-mono"
                    data-testid="input-ssn-prefix"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example SSN: {ssnPrefix}-{Date.now()}-0001
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAllocationDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAllocate} 
              disabled={!selectedLibraryId || allocateMutation.isPending}
              data-testid="button-confirm-allocate"
            >
              {allocateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Allocating...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Allocate {selectedCount} Copies
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
