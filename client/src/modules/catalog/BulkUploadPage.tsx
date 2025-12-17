import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  Search,
  FileText,
  Check,
  X,
  AlertCircle,
  Loader2,
  Calendar,
  CheckCircle2,
  XCircle,
  RefreshCw
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { resourceTypesApi } from "@/lib/api";

type TemplateMode = "search" | "manual";
type UploadStep = "template" | "upload" | "review" | "complete";

interface BulkUploadRow {
  rowId: number;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publishedYear: string;
  category: string;
  resourceTypeId: number | null;
  format: string;
  copies: number;
  acquisitionDate: string;
  acquisitionSource: string;
  shelfLocation: string;
  price: number | null;
  status: "pending" | "enriched" | "error" | "excluded";
  errorMessage?: string;
  source?: string;
  coverUrl?: string;
}

interface PreviewResponse {
  rows: BulkUploadRow[];
  stats: {
    total: number;
    enriched: number;
    errors: number;
  };
  templateMode: TemplateMode;
}

interface CommitResponse {
  createdBooks: number;
  createdCopies: number;
  skippedRows: number;
  errors: { rowId: number; message: string }[];
}

export default function BulkUploadPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<UploadStep>("template");
  const [templateMode, setTemplateMode] = useState<TemplateMode>("search");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [rows, setRows] = useState<BulkUploadRow[]>([]);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);

  const { data: resourceTypes = [] } = useQuery({
    queryKey: ["resource-types"],
    queryFn: resourceTypesApi.getAll,
  });

  const downloadTemplate = useCallback((mode: TemplateMode) => {
    window.open(`/api/catalog/bulk-upload/template?mode=${mode}`, "_blank");
  }, []);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", templateMode);

      const response = await fetch("/api/catalog/bulk-upload/preview", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      return response.json() as Promise<PreviewResponse>;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setRows(data.rows);
      setStep("review");
      toast.success(`Loaded ${data.stats.total} records`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const enrichMutation = useMutation({
    mutationFn: async (rowId: number) => {
      const row = rows.find(r => r.rowId === rowId);
      if (!row) throw new Error("Row not found");

      const response = await fetch("/api/z3950/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isbn: row.isbn }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const results = await response.json();
      if (results.length === 0) {
        throw new Error("No results found");
      }

      return { rowId, result: results[0] };
    },
    onSuccess: ({ rowId, result }) => {
      setRows(prev => prev.map(row => 
        row.rowId === rowId ? {
          ...row,
          title: result.title || row.title,
          author: result.author || row.author,
          publisher: result.publisher || row.publisher,
          publishedYear: result.year || row.publishedYear,
          category: result.category || row.category,
          coverUrl: result.cover,
          source: result.source,
          status: "enriched" as const,
          errorMessage: undefined,
        } : row
      ));
      toast.success(`Enriched: ${result.title}`);
    },
    onError: (error: Error, rowId: number) => {
      setRows(prev => prev.map(row =>
        row.rowId === rowId ? {
          ...row,
          status: "error" as const,
          errorMessage: error.message,
        } : row
      ));
    },
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      const validRows = rows.filter(r => r.status !== "excluded" && r.status !== "error");
      
      const response = await fetch("/api/catalog/bulk-upload/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          rows: validRows,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Commit failed");
      }

      return response.json() as Promise<CommitResponse>;
    },
    onSuccess: (data) => {
      setCommitResult(data);
      setStep("complete");
      toast.success(`Successfully imported ${data.createdBooks} books with ${data.createdCopies} copies`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const toggleRowExclusion = (rowId: number) => {
    setRows(prev => prev.map(row =>
      row.rowId === rowId ? {
        ...row,
        status: row.status === "excluded" ? "pending" : "excluded",
      } : row
    ));
  };

  const updateRowField = (rowId: number, field: keyof BulkUploadRow, value: any) => {
    setRows(prev => prev.map(row =>
      row.rowId === rowId ? { ...row, [field]: value } : row
    ));
  };

  const validRows = rows.filter(r => r.status !== "excluded");
  const enrichedRows = rows.filter(r => r.status === "enriched");
  const errorRows = rows.filter(r => r.status === "error");

  return (
    <MainLayout>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/catalog")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Bulk Upload Resources</h1>
            <p className="text-muted-foreground">Import multiple resources from an Excel file</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <Badge variant={step === "template" ? "default" : "secondary"} className="px-4 py-1">
            1. Select Template
          </Badge>
          <Badge variant={step === "upload" ? "default" : "secondary"} className="px-4 py-1">
            2. Upload File
          </Badge>
          <Badge variant={step === "review" ? "default" : "secondary"} className="px-4 py-1">
            3. Review & Edit
          </Badge>
          <Badge variant={step === "complete" ? "default" : "secondary"} className="px-4 py-1">
            4. Complete
          </Badge>
        </div>

        {step === "template" && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card 
              className={`cursor-pointer transition-all ${templateMode === "search" ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
              onClick={() => setTemplateMode("search")}
              data-testid="card-template-search"
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Search className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>ISBN Lookup Template</CardTitle>
                    <CardDescription>Auto-fill book details using Z39.50 search</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Provide only ISBN and basic info. The system will automatically fetch complete 
                  book details from external library catalogs (Open Library, Google Books).
                </p>
                <div className="text-sm">
                  <strong>Template columns:</strong>
                  <ul className="list-disc list-inside mt-2 text-muted-foreground">
                    <li>Resource Type</li>
                    <li>ISBN (required)</li>
                    <li>Book Name (optional - for reference)</li>
                    <li>Copies (default: 1)</li>
                    <li>Acquisition Date</li>
                    <li>Acquisition Source</li>
                  </ul>
                </div>
                <Button 
                  variant="outline" 
                  className="mt-4 w-full"
                  onClick={(e) => { e.stopPropagation(); downloadTemplate("search"); }}
                  data-testid="button-download-search-template"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Search Template
                </Button>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all ${templateMode === "manual" ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
              onClick={() => setTemplateMode("manual")}
              data-testid="card-template-manual"
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <FileText className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle>Manual Entry Template</CardTitle>
                    <CardDescription>Enter all book details manually</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Enter complete book information manually. Use this when ISBN lookup 
                  is not available or for specialized resources.
                </p>
                <div className="text-sm">
                  <strong>Template columns:</strong>
                  <ul className="list-disc list-inside mt-2 text-muted-foreground">
                    <li>Resource Type, ISBN, Title, Author</li>
                    <li>Publisher, Published Year</li>
                    <li>Category, Format</li>
                    <li>Copies, Acquisition Date</li>
                    <li>Acquisition Source, Shelf Location, Price</li>
                  </ul>
                </div>
                <Button 
                  variant="outline" 
                  className="mt-4 w-full"
                  onClick={(e) => { e.stopPropagation(); downloadTemplate("manual"); }}
                  data-testid="button-download-manual-template"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Manual Template
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "template" && (
          <div className="flex justify-end mt-6">
            <Button onClick={() => setStep("upload")} data-testid="button-next-step">
              Continue to Upload
            </Button>
          </div>
        )}

        {step === "upload" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Upload Excel File
              </CardTitle>
              <CardDescription>
                Upload your filled {templateMode === "search" ? "ISBN Lookup" : "Manual Entry"} template
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop your Excel file here, or click to browse
                </p>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="max-w-xs mx-auto"
                  data-testid="input-file-upload"
                />
                {selectedFile && (
                  <p className="mt-4 text-sm text-green-600 flex items-center justify-center gap-2">
                    <Check className="h-4 w-4" />
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep("template")} data-testid="button-back-template">
                  Back
                </Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={!selectedFile || uploadMutation.isPending}
                  data-testid="button-process-file"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Process File
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <Badge variant="outline" className="px-3 py-1">
                  Total: {rows.length}
                </Badge>
                <Badge variant="default" className="px-3 py-1 bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Enriched: {enrichedRows.length}
                </Badge>
                <Badge variant="destructive" className="px-3 py-1">
                  <XCircle className="h-3 w-3 mr-1" />
                  Errors: {errorRows.length}
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  To Import: {validRows.length}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("upload")} data-testid="button-back-upload">
                  Back
                </Button>
                <Button 
                  onClick={() => commitMutation.mutate()}
                  disabled={validRows.length === 0 || commitMutation.isPending}
                  data-testid="button-approve-import"
                >
                  {commitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Approve & Import ({validRows.length})
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Card>
              <ScrollArea className="h-[calc(100vh-320px)]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[50px]">Include</TableHead>
                      <TableHead className="w-[80px]">Status</TableHead>
                      <TableHead className="w-[120px]">ISBN</TableHead>
                      <TableHead className="min-w-[200px]">Title</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Publisher</TableHead>
                      <TableHead className="w-[60px]">Year</TableHead>
                      <TableHead className="w-[80px]">Copies</TableHead>
                      <TableHead className="w-[120px]">Acq. Date</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow 
                        key={row.rowId}
                        className={row.status === "excluded" ? "opacity-50" : ""}
                        data-testid={`row-bulk-${row.rowId}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={row.status !== "excluded"}
                            onCheckedChange={() => toggleRowExclusion(row.rowId)}
                            data-testid={`checkbox-include-${row.rowId}`}
                          />
                        </TableCell>
                        <TableCell>
                          {row.status === "enriched" && (
                            <Badge variant="default" className="bg-green-500 text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          )}
                          {row.status === "error" && (
                            <Badge variant="destructive" className="text-xs" title={row.errorMessage}>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                          {row.status === "pending" && (
                            <Badge variant="secondary" className="text-xs">
                              Pending
                            </Badge>
                          )}
                          {row.status === "excluded" && (
                            <Badge variant="outline" className="text-xs">
                              <X className="h-3 w-3 mr-1" />
                              Skip
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.isbn}</TableCell>
                        <TableCell>
                          <Input
                            value={row.title}
                            onChange={(e) => updateRowField(row.rowId, "title", e.target.value)}
                            className="h-8 text-sm"
                            disabled={row.status === "excluded"}
                            data-testid={`input-title-${row.rowId}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.author}
                            onChange={(e) => updateRowField(row.rowId, "author", e.target.value)}
                            className="h-8 text-sm"
                            disabled={row.status === "excluded"}
                            data-testid={`input-author-${row.rowId}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.publisher}
                            onChange={(e) => updateRowField(row.rowId, "publisher", e.target.value)}
                            className="h-8 text-sm"
                            disabled={row.status === "excluded"}
                            data-testid={`input-publisher-${row.rowId}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.publishedYear}
                            onChange={(e) => updateRowField(row.rowId, "publishedYear", e.target.value)}
                            className="h-8 text-sm w-[70px]"
                            disabled={row.status === "excluded"}
                            data-testid={`input-year-${row.rowId}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={row.copies}
                            onChange={(e) => updateRowField(row.rowId, "copies", parseInt(e.target.value) || 1)}
                            className="h-8 text-sm w-[60px]"
                            min={1}
                            disabled={row.status === "excluded"}
                            data-testid={`input-copies-${row.rowId}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={row.acquisitionDate}
                            onChange={(e) => updateRowField(row.rowId, "acquisitionDate", e.target.value)}
                            className="h-8 text-sm"
                            disabled={row.status === "excluded"}
                            data-testid={`input-acqdate-${row.rowId}`}
                          />
                        </TableCell>
                        <TableCell>
                          {templateMode === "search" && row.status !== "enriched" && row.status !== "excluded" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => enrichMutation.mutate(row.rowId)}
                              disabled={enrichMutation.isPending}
                              data-testid={`button-retry-${row.rowId}`}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </div>
        )}

        {step === "complete" && commitResult && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/10 rounded-full">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <div>
                  <CardTitle>Import Complete!</CardTitle>
                  <CardDescription>Your resources have been successfully imported</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{commitResult.createdBooks}</div>
                  <div className="text-sm text-muted-foreground">Books Created</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{commitResult.createdCopies}</div>
                  <div className="text-sm text-muted-foreground">Copies Generated</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-gray-500">{commitResult.skippedRows}</div>
                  <div className="text-sm text-muted-foreground">Rows Skipped</div>
                </div>
              </div>

              {commitResult.errors.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-2 text-red-600">Errors ({commitResult.errors.length})</h4>
                  <div className="bg-red-50 rounded-lg p-3 text-sm">
                    {commitResult.errors.map((err, i) => (
                      <div key={i} className="text-red-700">
                        Row {err.rowId}: {err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={() => navigate("/catalog")} data-testid="button-go-catalog">
                  Go to Catalog
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setStep("template");
                    setRows([]);
                    setSelectedFile(null);
                    setPreviewData(null);
                    setCommitResult(null);
                  }}
                  data-testid="button-upload-more"
                >
                  Upload More
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
