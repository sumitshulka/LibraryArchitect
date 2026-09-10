import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Package, ChevronDown, ChevronRight, Library, Loader2, CheckCircle, AlertCircle, Hash, Upload, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { allocationsApi, librariesApi, type UnallocatedCopyInfo } from "@/lib/api";
import { appendScannedSsns, parseMappedSsns, parseOrderedSsns } from "./allocation-ssn";
import { toast } from "sonner";

type SsnMode = "GENERATE" | "SUPPLIED";
type SsnInputMethod = "ORDERED" | "SCAN" | "MAPPED";

export default function AllocationsPage() {
  const queryClient = useQueryClient();
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set());
  const [selectedCopies, setSelectedCopies] = useState<Map<number, Set<number>>>(new Map());
  const [showAllocationDialog, setShowAllocationDialog] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [ssnMode, setSsnMode] = useState<SsnMode>("GENERATE");
  const [ssnInputMethod, setSsnInputMethod] = useState<SsnInputMethod>("ORDERED");
  const [ssnInput, setSsnInput] = useState("");
  const [scannedSsns, setScannedSsns] = useState<string[]>([]);
  const [scanValue, setScanValue] = useState("");
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
      toast.success(`Allocated ${result.allocatedCount} copies; ${result.barcodeReadyCount} barcode labels ready`);
      setShowAllocationDialog(false);
      setSelectedCopies(new Map());
      setSelectedLibraryId(null);
      setSsnInput("");
      setScannedSsns([]);
      setScanValue("");
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

  const selectedCopyDetails = unallocatedBooks.flatMap((book) =>
    book.copies
      .filter((copy) => selectedCopies.get(book.bookId)?.has(copy.id))
      .map((copy) => ({
        id: copy.id,
        barcode: copy.barcode,
        bookTitle: book.bookTitle,
      })),
  );

  const suppliedSsnValidation = (() => {
    if (ssnMode !== "SUPPLIED") {
      return { assignments: [] as Array<{ copyId: number; ssn: string }>, errors: [] as string[] };
    }

    const errors: string[] = [];
    let assignments: Array<{ copyId: number; ssn: string }> = [];
    if (ssnInputMethod === "ORDERED" || ssnInputMethod === "SCAN") {
      const ssns = ssnInputMethod === "SCAN" ? scannedSsns : parseOrderedSsns(ssnInput);
      if (ssns.length !== selectedCopyDetails.length) {
        errors.push(`Enter exactly ${selectedCopyDetails.length} SSNs; ${ssns.length} provided.`);
      }
      assignments = selectedCopyDetails.slice(0, ssns.length).map((copy, index) => ({
        copyId: copy.id,
        ssn: ssns[index],
      }));
    } else {
      const parsed = parseMappedSsns(ssnInput);
      if (parsed.invalidLineNumbers.length > 0) {
        errors.push(`Invalid barcode/SSN rows: ${parsed.invalidLineNumbers.join(", ")}.`);
      }
      const selectedByBarcode = new Map(selectedCopyDetails.map((copy) => [copy.barcode.toLocaleLowerCase(), copy]));
      const seenBarcodes = new Set<string>();
      for (const row of parsed.rows) {
        const barcodeKey = row.barcode.toLocaleLowerCase();
        if (seenBarcodes.has(barcodeKey)) {
          errors.push(`System barcode "${row.barcode}" appears more than once.`);
          continue;
        }
        seenBarcodes.add(barcodeKey);
        const copy = selectedByBarcode.get(barcodeKey);
        if (!copy) {
          errors.push(`System barcode "${row.barcode}" is not one of the selected copies.`);
          continue;
        }
        assignments.push({ copyId: copy.id, ssn: row.ssn });
      }
      const missingCount = selectedCopyDetails.filter((copy) => !seenBarcodes.has(copy.barcode.toLocaleLowerCase())).length;
      if (missingCount > 0) errors.push(`${missingCount} selected copies do not have a mapped SSN.`);
    }

    const normalizedSsns = assignments.map((assignment) => assignment.ssn.toLocaleLowerCase());
    if (new Set(normalizedSsns).size !== normalizedSsns.length) {
      errors.push("Every supplied SSN must be unique.");
    }
    return { assignments, errors: Array.from(new Set(errors)) };
  })();
  const suppliedSsnByCopyId = new Map(
    suppliedSsnValidation.assignments.map((assignment) => [assignment.copyId, assignment.ssn]),
  );

  const addScannedSsns = () => {
    if (!scanValue.trim()) return;
    setScannedSsns((current) => appendScannedSsns(current, scanValue));
    setScanValue("");
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

    if (ssnMode === "SUPPLIED" && suppliedSsnValidation.errors.length > 0) {
      toast.error(suppliedSsnValidation.errors[0]);
      return;
    }

    allocateMutation.mutate(ssnMode === "GENERATE" ? {
      copyIds,
      libraryId: selectedLibraryId,
      ssnMode: "GENERATE",
      ssnPrefix,
    } : {
      copyIds,
      libraryId: selectedLibraryId,
      ssnMode: "SUPPLIED",
      ssnAssignments: suppliedSsnValidation.assignments,
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Allocate Copies to Library</DialogTitle>
            <DialogDescription>
              You are about to allocate {selectedCount} copies to a library.
              Choose whether to generate new Internal SSNs or preserve the library's existing SSNs.
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

            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <RadioGroup value={ssnMode} onValueChange={(value) => setSsnMode(value as SsnMode)}>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3">
                  <RadioGroupItem value="GENERATE" data-testid="radio-ssn-generate" />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Hash className="h-4 w-4" /> Generate new Internal SSNs
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Create unique system SSNs for all selected copies.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3">
                  <RadioGroupItem value="SUPPLIED" data-testid="radio-ssn-supplied" />
                  <span>
                    <span className="text-sm font-medium">Use the library's existing SSNs</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Preserve original SSNs and prepare barcode labels that encode them.
                    </span>
                  </span>
                </label>
              </RadioGroup>

              {ssnMode === "GENERATE" ? (
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
              ) : (
                <div className="space-y-4">
                  <RadioGroup
                    value={ssnInputMethod}
                    onValueChange={(value) => {
                      setSsnInputMethod(value as SsnInputMethod);
                      setSsnInput("");
                      setScannedSsns([]);
                      setScanValue("");
                    }}
                    className="grid sm:grid-cols-3"
                  >
                    <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-background p-3">
                      <RadioGroupItem value="ORDERED" data-testid="radio-ssn-ordered" />
                      <span>
                        <span className="block text-sm font-medium">One SSN per line</span>
                        <span className="block text-xs text-muted-foreground">Assigned in the displayed copy order.</span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-background p-3">
                      <RadioGroupItem value="SCAN" data-testid="radio-ssn-scan" />
                      <span>
                        <span className="block text-sm font-medium">Scan one at a time</span>
                        <span className="block text-xs text-muted-foreground">Scan or enter each SSN, then press Enter.</span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-background p-3">
                      <RadioGroupItem value="MAPPED" data-testid="radio-ssn-mapped" />
                      <span>
                        <span className="block text-sm font-medium">Map barcode to SSN</span>
                        <span className="block text-xs text-muted-foreground">CSV or tab-separated pairs; safest for migration.</span>
                      </span>
                    </label>
                  </RadioGroup>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor={ssnInputMethod === "SCAN" ? "scan-supplied-ssn" : "supplied-ssns"}>
                        {ssnInputMethod === "ORDERED"
                          ? "Original SSNs"
                          : ssnInputMethod === "SCAN"
                            ? "Scan or enter the next original SSN"
                            : "System barcode and original SSN"}
                      </Label>
                      {ssnInputMethod !== "SCAN" && (
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary">
                          <Upload className="h-3.5 w-3.5" />
                          Load CSV/TXT
                          <input
                            type="file"
                            accept=".csv,.txt,text/csv,text/plain"
                            className="sr-only"
                            onChange={async (event) => {
                              const file = event.target.files?.[0];
                              if (file) setSsnInput(await file.text());
                              event.target.value = "";
                            }}
                            data-testid="input-ssn-file"
                          />
                        </label>
                      )}
                    </div>
                    {ssnInputMethod === "SCAN" ? (
                      <div className="flex gap-2">
                        <Input
                          id="scan-supplied-ssn"
                          autoFocus
                          value={scanValue}
                          onChange={(event) => setScanValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addScannedSsns();
                            }
                          }}
                          placeholder="Scan or type an SSN, then press Enter"
                          className="font-mono text-xs"
                          data-testid="input-scan-supplied-ssn"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addScannedSsns}
                          disabled={!scanValue.trim()}
                          data-testid="button-add-scanned-ssn"
                        >
                          Add
                        </Button>
                      </div>
                    ) : (
                      <Textarea
                        id="supplied-ssns"
                        rows={9}
                        value={ssnInput}
                        onChange={(event) => setSsnInput(event.target.value)}
                        placeholder={ssnInputMethod === "ORDERED"
                          ? "LIB-00001\nLIB-00002\nLIB-00003"
                          : "barcode,ssn\nBC-101,LIB-00001\nBC-102,LIB-00002"}
                        className="font-mono text-xs"
                        data-testid="textarea-supplied-ssns"
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {suppliedSsnValidation.assignments.length} of {selectedCount} copies mapped.
                      {ssnInputMethod === "SCAN"
                        ? " Each scan is assigned to the next selected copy."
                        : " Barcode labels will use the supplied SSNs after allocation."}
                    </p>
                    {ssnInputMethod === "SCAN" && scannedSsns.length > 0 && (
                      <div className="flex flex-wrap gap-2 rounded-md border bg-background p-3">
                        {scannedSsns.slice(0, 100).map((ssn, index) => (
                          <Badge key={`${ssn}-${index}`} variant="secondary" className="gap-1 font-mono">
                            {index + 1}. {ssn}
                            <button
                              type="button"
                              className="rounded-sm hover:bg-muted"
                              onClick={() => setScannedSsns((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                              aria-label={`Remove scanned SSN ${index + 1}`}
                              data-testid={`button-remove-scanned-ssn-${index}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                        {scannedSsns.length > 100 && (
                          <span className="self-center text-xs text-muted-foreground">
                            Showing the first 100 scans.
                          </span>
                        )}
                      </div>
                    )}
                    {suppliedSsnValidation.errors.length > 0 && ssnInput.trim() && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                        {suppliedSsnValidation.errors.slice(0, 4).map((error) => <p key={error}>{error}</p>)}
                      </div>
                    )}
                  </div>

                  <div className="max-h-36 overflow-y-auto rounded-md border bg-background">
                    {selectedCopyDetails.slice(0, 100).map((copy, index) => (
                      <div key={copy.id} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b px-3 py-2 text-xs last:border-b-0">
                        <span className="text-muted-foreground">{index + 1}.</span>
                        <span className="truncate font-mono">{copy.barcode}</span>
                        <span className="truncate">
                          {suppliedSsnByCopyId.get(copy.id) || "Not mapped"}
                        </span>
                      </div>
                    ))}
                    {selectedCopyDetails.length > 100 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        Previewing the first 100 of {selectedCopyDetails.length} selected copies.
                      </p>
                    )}
                  </div>
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
              disabled={
                !selectedLibraryId
                || allocateMutation.isPending
                || (ssnMode === "GENERATE" ? !ssnPrefix.trim() : suppliedSsnValidation.errors.length > 0)
              }
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
