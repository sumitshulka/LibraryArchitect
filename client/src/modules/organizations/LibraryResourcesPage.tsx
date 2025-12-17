import { useState, useMemo, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Barcode from "react-barcode";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Search, 
  Book, 
  BookOpen, 
  Headphones, 
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Truck,
  ChevronDown,
  ChevronUp,
  X,
  History,
  ChevronRight,
  ArrowLeftCircle,
  Printer,
} from "lucide-react";
import { librariesApi, bookCopiesApi, type LibraryResourceStats } from "@/lib/api";
import type { BookCopy, Circulation } from "@shared/schema";
import { format } from "date-fns";

const FORMAT_OPTIONS = [
  { value: "", label: "All Formats" },
  { value: "PHYSICAL", label: "Physical Books" },
  { value: "EBOOK", label: "E-Books" },
  { value: "AUDIOBOOK", label: "Audiobooks" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "AVAILABLE", label: "Has Available" },
  { value: "CHECKED_OUT", label: "Has Checked Out" },
  { value: "RESERVED", label: "Has Reserved" },
  { value: "DAMAGED", label: "Has Damaged" },
  { value: "LOST", label: "Has Lost" },
  { value: "IN_TRANSIT", label: "Has In Transit" },
  { value: "ALL_ISSUED", label: "All Copies Issued" },
];

type StatusFilter = "all" | "AVAILABLE" | "CHECKED_OUT" | "RESERVED" | "DAMAGED" | "LOST" | "IN_TRANSIT";

function ResourceCard({ 
  resource,
  onStatClick,
}: { 
  resource: LibraryResourceStats;
  onStatClick: (resource: LibraryResourceStats, statusFilter: StatusFilter) => void;
}) {
  const formatIcon = {
    PHYSICAL: Book,
    EBOOK: BookOpen,
    AUDIOBOOK: Headphones,
  }[resource.format] || Book;
  
  const FormatIcon = formatIcon;

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`resource-card-${resource.bookId}`}>
      <CardContent className="pt-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-16 h-20 bg-muted rounded-md flex items-center justify-center">
            <FormatIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate" data-testid={`resource-title-${resource.bookId}`}>
              {resource.title}
            </h3>
            <p className="text-sm text-muted-foreground truncate" data-testid={`resource-author-${resource.bookId}`}>
              {resource.author}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {resource.isbn}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {resource.category}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {resource.format.toLowerCase()}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 mt-4 pt-4 border-t">
          <CopyStat
            label="Total"
            value={resource.totalCopies}
            icon={Book}
            variant="default"
            testId={`stat-total-${resource.bookId}`}
            onClick={() => onStatClick(resource, "all")}
          />
          <CopyStat
            label="Available"
            value={resource.available}
            icon={CheckCircle2}
            variant={resource.available > 0 ? "success" : "muted"}
            testId={`stat-available-${resource.bookId}`}
            onClick={() => onStatClick(resource, "AVAILABLE")}
          />
          <CopyStat
            label="Issued"
            value={resource.checkedOut}
            icon={XCircle}
            variant={resource.checkedOut > 0 ? "info" : "muted"}
            testId={`stat-issued-${resource.bookId}`}
            onClick={() => onStatClick(resource, "CHECKED_OUT")}
          />
          <CopyStat
            label="Reserved"
            value={resource.reserved}
            icon={Clock}
            variant={resource.reserved > 0 ? "warning" : "muted"}
            testId={`stat-reserved-${resource.bookId}`}
            onClick={() => onStatClick(resource, "RESERVED")}
          />
          <CopyStat
            label="Damaged"
            value={resource.damaged}
            icon={AlertTriangle}
            variant={resource.damaged > 0 ? "danger" : "muted"}
            testId={`stat-damaged-${resource.bookId}`}
            onClick={() => onStatClick(resource, "DAMAGED")}
          />
          <CopyStat
            label="Lost"
            value={resource.lost}
            icon={AlertTriangle}
            variant={resource.lost > 0 ? "danger" : "muted"}
            testId={`stat-lost-${resource.bookId}`}
            onClick={() => onStatClick(resource, "LOST")}
          />
          <CopyStat
            label="In Transit"
            value={resource.inTransit}
            icon={Truck}
            variant={resource.inTransit > 0 ? "info" : "muted"}
            testId={`stat-transit-${resource.bookId}`}
            onClick={() => onStatClick(resource, "IN_TRANSIT")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CopyStat({ 
  label, 
  value, 
  icon: Icon, 
  variant,
  testId,
  onClick,
}: { 
  label: string; 
  value: number; 
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "success" | "warning" | "danger" | "info" | "muted";
  testId: string;
  onClick?: () => void;
}) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-green-600",
    warning: "text-amber-600",
    danger: "text-red-600",
    info: "text-blue-600",
    muted: "text-muted-foreground",
  };

  return (
    <button 
      type="button"
      onClick={onClick}
      className="flex flex-col items-center p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" 
      data-testid={testId}
    >
      <Icon className={`h-4 w-4 ${variantStyles[variant]}`} />
      <span className={`text-lg font-bold ${variantStyles[variant]}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "AVAILABLE": return "default";
    case "CHECKED_OUT": return "secondary";
    case "RESERVED": return "outline";
    case "DAMAGED":
    case "LOST": return "destructive";
    case "IN_TRANSIT": return "secondary";
    default: return "outline";
  }
}

function printBarcodeSheet(ssns: string[]) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  const stickerDivs = ssns.map((ssn, index) => `
    <div class="sticker">
      <svg id="barcode-${index}"></svg>
      <div class="ssn">${ssn}</div>
    </div>
  `).join('');
  
  const barcodeScripts = ssns.map((ssn, index) => `
    JsBarcode("#barcode-${index}", "${ssn}", {
      format: "CODE128",
      width: 1.2,
      height: 35,
      displayValue: false,
      margin: 0
    });
  `).join('\n');
  
  printWindow.document.write(`
    <html>
      <head>
        <title>Print SSN Barcodes</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            margin: 0;
            padding: 5mm;
            font-family: monospace;
          }
          .sticker-grid {
            display: grid;
            grid-template-columns: repeat(3, 66.5mm);
            grid-template-rows: repeat(8, 33.9mm);
            gap: 0;
            width: 200mm;
            height: 271mm;
          }
          .sticker {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 2mm;
            box-sizing: border-box;
            overflow: hidden;
          }
          .sticker svg {
            max-width: 60mm;
            height: 18mm;
          }
          .ssn { 
            font-size: 7pt; 
            margin-top: 1mm;
            word-break: break-all;
            max-width: 60mm;
          }
          @media screen {
            .sticker { border: 1px dashed #ccc; }
          }
          @media print {
            .sticker { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="sticker-grid">
          ${stickerDivs}
        </div>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <script>
          ${barcodeScripts}
          setTimeout(() => window.print(), 500);
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function CopyDetailsSheet({
  open,
  onOpenChange,
  resource,
  statusFilter,
  libraryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: LibraryResourceStats | null;
  statusFilter: StatusFilter;
  libraryId: number;
}) {
  const [selectedCopy, setSelectedCopy] = useState<BookCopy | null>(null);
  const [selectedForPrint, setSelectedForPrint] = useState<Set<number>>(new Set());

  const { data: copies = [], isLoading: copiesLoading } = useQuery({
    queryKey: ["book-copies", resource?.bookId, libraryId],
    queryFn: () => bookCopiesApi.getByBookAndLibrary(resource!.bookId, libraryId),
    enabled: open && !!resource,
  });

  const { data: circulationHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["circulation-history", selectedCopy?.id],
    queryFn: () => bookCopiesApi.getCirculationHistory(selectedCopy!.id),
    enabled: !!selectedCopy,
  });

  const filteredCopies = useMemo(() => {
    if (statusFilter === "all") return copies;
    return copies.filter(copy => copy.status === statusFilter);
  }, [copies, statusFilter]);

  const statusLabels: Record<StatusFilter, string> = {
    all: "All Copies",
    AVAILABLE: "Available",
    CHECKED_OUT: "Issued",
    RESERVED: "Reserved",
    DAMAGED: "Damaged",
    LOST: "Lost",
    IN_TRANSIT: "In Transit",
  };

  const handleBackToList = () => {
    setSelectedCopy(null);
  };

  const handleClose = (value: boolean) => {
    onOpenChange(value);
    if (!value) {
      setSelectedCopy(null);
      setSelectedForPrint(new Set());
    }
  };

  const togglePrintSelection = (copyId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForPrint(prev => {
      const next = new Set(prev);
      if (next.has(copyId)) {
        next.delete(copyId);
      } else {
        next.add(copyId);
      }
      return next;
    });
  };

  const handleBatchPrint = () => {
    const ssnsToprint = filteredCopies
      .filter(copy => selectedForPrint.has(copy.id) && copy.internalSSN)
      .map(copy => copy.internalSSN as string);
    if (ssnsToprint.length > 0) {
      printBarcodeSheet(ssnsToprint);
    }
  };

  const selectAllForPrint = () => {
    const allWithSSN = filteredCopies.filter(c => c.internalSSN).map(c => c.id);
    setSelectedForPrint(new Set(allWithSSN));
  };

  const clearPrintSelection = () => {
    setSelectedForPrint(new Set());
  };

  if (!resource) return null;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-[95vw] sm:w-[1000px] sm:max-w-[1000px] p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          {selectedCopy ? (
            <>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleBackToList} data-testid="button-back-to-list">
                  <ArrowLeftCircle className="h-4 w-4" />
                </Button>
                <div>
                  <SheetTitle className="text-left">Circulation History</SheetTitle>
                  <SheetDescription className="text-left">
                    SSN: {selectedCopy.internalSSN || "N/A"} - {selectedCopy.barcode}
                  </SheetDescription>
                </div>
              </div>
            </>
          ) : (
            <>
              <SheetTitle className="text-left">{resource.title}</SheetTitle>
              <SheetDescription className="text-left">
                {statusLabels[statusFilter]} - {filteredCopies.length} {filteredCopies.length === 1 ? "copy" : "copies"}
              </SheetDescription>
            </>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          {selectedCopy ? (
            <div className="p-6">
              <div className="mb-4 p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">SSN:</span>
                    <span className="ml-2 font-mono">{selectedCopy.internalSSN || "Not assigned"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Barcode:</span>
                    <span className="ml-2 font-mono">{selectedCopy.barcode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge className="ml-2" variant={getStatusBadgeVariant(selectedCopy.status)}>
                      {selectedCopy.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <span className="ml-2">{selectedCopy.shelfLocation || "-"}</span>
                  </div>
                </div>
              </div>

              {/* SSN Barcode Display */}
              {selectedCopy.internalSSN && (
                <div className="mb-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm">SSN Barcode Label</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>Print SSN Barcode</title>
                                <style>
                                  @page {
                                    size: A4;
                                    margin: 0;
                                  }
                                  body { 
                                    margin: 0;
                                    padding: 5mm;
                                    font-family: monospace;
                                  }
                                  .sticker-grid {
                                    display: grid;
                                    grid-template-columns: repeat(3, 66.5mm);
                                    grid-template-rows: repeat(8, 33.9mm);
                                    gap: 0;
                                    width: 200mm;
                                    height: 271mm;
                                  }
                                  .sticker {
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    justify-content: center;
                                    text-align: center;
                                    padding: 2mm;
                                    box-sizing: border-box;
                                    overflow: hidden;
                                  }
                                  .sticker svg {
                                    max-width: 60mm;
                                    height: 18mm;
                                  }
                                  .ssn { 
                                    font-size: 7pt; 
                                    margin-top: 1mm;
                                    word-break: break-all;
                                    max-width: 60mm;
                                  }
                                  @media screen {
                                    .sticker { border: 1px dashed #ccc; }
                                  }
                                  @media print {
                                    .sticker { border: none; }
                                  }
                                </style>
                              </head>
                              <body>
                                <div class="sticker-grid">
                                  <div class="sticker">
                                    <svg id="barcode"></svg>
                                    <div class="ssn">${selectedCopy.internalSSN}</div>
                                  </div>
                                </div>
                                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
                                <script>
                                  JsBarcode("#barcode", "${selectedCopy.internalSSN}", {
                                    format: "CODE128",
                                    width: 1.2,
                                    height: 35,
                                    displayValue: false,
                                    margin: 0
                                  });
                                  setTimeout(() => window.print(), 500);
                                </script>
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                        }
                      }}
                      data-testid="button-print-barcode"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print Label
                    </Button>
                  </div>
                  <div className="flex justify-center bg-white p-4 rounded border">
                    <Barcode 
                      value={selectedCopy.internalSSN} 
                      format="CODE128"
                      width={1.2}
                      height={40}
                      fontSize={10}
                      margin={5}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Sized for A4 sticker sheets (3×8 layout, 24 stickers per page)
                  </p>
                </div>
              )}

              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <History className="h-4 w-4" />
                Movement History
              </h4>
              
              {historyLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading history...</div>
              ) : circulationHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No circulation history</p>
                  <p className="text-sm">This copy has not been issued yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {circulationHistory.map((record) => (
                    <div key={record.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={record.status === "ACTIVE" ? "default" : "secondary"}>
                          {record.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          #{record.id}
                        </span>
                      </div>
                      <div className="grid gap-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Checkout:</span>
                          <span>{format(new Date(record.checkoutDate), "MMM d, yyyy HH:mm")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Due:</span>
                          <span>{format(new Date(record.dueDate), "MMM d, yyyy")}</span>
                        </div>
                        {record.returnDate && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Returned:</span>
                            <span>{format(new Date(record.returnDate), "MMM d, yyyy HH:mm")}</span>
                          </div>
                        )}
                        {record.fineAmount && record.fineAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Fine:</span>
                            <span className="text-red-600">${(record.fineAmount / 100).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              {copiesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading copies...</div>
              ) : filteredCopies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                  <Book className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No copies found</p>
                  <p className="text-sm">No copies match the selected status filter.</p>
                </div>
              ) : (
                <>
                  {/* Batch Print Controls */}
                  <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={selectAllForPrint}
                        data-testid="button-select-all"
                      >
                        Select All
                      </Button>
                      {selectedForPrint.size > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={clearPrintSelection}
                          data-testid="button-clear-selection"
                        >
                          Clear ({selectedForPrint.size})
                        </Button>
                      )}
                    </div>
                    <Button 
                      variant="default" 
                      size="sm"
                      disabled={selectedForPrint.size === 0}
                      onClick={handleBatchPrint}
                      data-testid="button-batch-print"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print Selected ({selectedForPrint.size})
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select copies to print barcodes on A4 sticker sheet (3×8 layout, up to 24 per page)
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>SSN</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCopies.map((copy) => (
                        <TableRow 
                          key={copy.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedCopy(copy)}
                          data-testid={`row-copy-${copy.id}`}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {copy.internalSSN && (
                              <input
                                type="checkbox"
                                checked={selectedForPrint.has(copy.id)}
                                onChange={(e) => togglePrintSelection(copy.id, e as any)}
                                onClick={(e) => togglePrintSelection(copy.id, e)}
                                className="h-4 w-4 rounded border-gray-300"
                                data-testid={`checkbox-copy-${copy.id}`}
                              />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {copy.internalSSN || (
                              <span className="text-muted-foreground italic">No SSN</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(copy.status)}>
                              {copy.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {copy.shelfLocation || "-"}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function LibraryResourcesPage() {
  const params = useParams<{ libraryId: string }>();
  const libraryId = parseInt(params.libraryId || "0");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [format, setFormat] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  // Sheet state for copy details
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<LibraryResourceStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const handleStatClick = (resource: LibraryResourceStats, filter: StatusFilter) => {
    setSelectedResource(resource);
    setStatusFilter(filter);
    setSheetOpen(true);
  };

  const { data: library } = useQuery({
    queryKey: ["library", libraryId],
    queryFn: () => librariesApi.getById(libraryId),
    enabled: libraryId > 0,
  });

  const { data: resourcesData, isLoading, error } = useQuery({
    queryKey: ["library-resources", libraryId, debouncedQuery, format, category, status],
    queryFn: () => librariesApi.getResources(libraryId, {
      query: debouncedQuery || undefined,
      format: format || undefined,
      category: category || undefined,
      status: status || undefined,
    }),
    enabled: libraryId > 0,
  });

  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const hasActiveFilters = format || category || status;

  const clearFilters = () => {
    setFormat("");
    setCategory("");
    setStatus("");
  };

  return (
    <MainLayout>
      <div className="flex-1 space-y-6 p-8 overflow-auto">
        <div className="flex items-center gap-4">
          <Link href={`/organizations/libraries/${libraryId}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
              Library Resources
            </h1>
            {library && (
              <p className="text-muted-foreground">
                {library.name} - Catalog with copy statistics
              </p>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, author, ISBN, or publisher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" data-testid="button-filters">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-2">
                        {[format, category, status].filter(Boolean).length}
                      </Badge>
                    )}
                    {filtersOpen ? (
                      <ChevronUp className="h-4 w-4 ml-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-2" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>

            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select value={format} onValueChange={setFormat}>
                      <SelectTrigger data-testid="select-format">
                        <SelectValue placeholder="All Formats" />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value || "all"}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {resourcesData?.categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Copy Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value || "all"}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {hasActiveFilters && (
                  <div className="flex items-center justify-end pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      data-testid="button-clear-filters"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="text-center py-12 text-muted-foreground" data-testid="loading-state">
            Loading resources...
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-red-600" data-testid="error-state">
                Failed to load resources. Please try again.
              </div>
            </CardContent>
          </Card>
        )}

        {resourcesData && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground" data-testid="text-result-count">
                Showing {resourcesData.resources.length} of {resourcesData.total} resources
              </p>
            </div>

            {resourcesData.resources.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Book className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p data-testid="empty-state">No resources found matching your criteria.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {resourcesData.resources.map((resource) => (
                  <ResourceCard 
                    key={resource.bookId} 
                    resource={resource}
                    onStatClick={handleStatClick}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <CopyDetailsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        resource={selectedResource}
        statusFilter={statusFilter}
        libraryId={libraryId}
      />
    </MainLayout>
  );
}

export default LibraryResourcesPage;
