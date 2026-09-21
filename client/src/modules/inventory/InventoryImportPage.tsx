import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Library,
  Loader2,
  PackageCheck,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type ImportMode = "EXISTING_SSN" | "GENERATE_SSN";
type Step = "mode" | "upload" | "review" | "complete";

interface PreviewError {
  sheet: string;
  row: number;
  message: string;
  severity: "error" | "warning";
}

interface PreviewResponse {
  previewToken: string;
  mode: ImportMode;
  stats: {
    books: number;
    existingBooks: number;
    newBooks: number;
    copies: number;
    libraries: number;
    errors: number;
    warnings: number;
  };
  errors: PreviewError[];
  sampleRows: Array<Record<string, unknown>>;
  truncatedErrors: boolean;
}

interface CommitResponse {
  success: boolean;
  mode: ImportMode;
  createdBooks: number;
  createdCopies: number;
  failedRows: number;
  errors: Array<{ row: number; message: string }>;
}

const modeDetails: Record<ImportMode, {
  title: string;
  description: string;
  sheetLabel: string;
  bullets: string[];
}> = {
  EXISTING_SSN: {
    title: "Migrate existing SSNs",
    description: "Bring in one row per physical copy with its current library and client SSN.",
    sheetLabel: "Books + Copies",
    bullets: [
      "Use this when the client already has an SSN for every copy.",
      "Existing SSNs are preserved as user-defined identifiers.",
      "Copies are assigned directly to the library from the workbook.",
    ],
  },
  GENERATE_SSN: {
    title: "Generate SSNs from allocations",
    description: "Provide copy counts by book and library; the system creates and assigns each copy.",
    sheetLabel: "Books + Allocations",
    bullets: [
      "Use this when the client provides allocation counts instead of individual SSNs.",
      "SSNs and barcodes are generated uniquely for the import.",
      "One allocation row can create thousands of copies.",
    ],
  },
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

export default function InventoryImportPage() {
  const [mode, setMode] = useState<ImportMode>("EXISTING_SSN");
  const [step, setStep] = useState<Step>("mode");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const downloadTemplate = () => {
    window.open(`/api/inventory-import/template?mode=${mode}`, "_blank");
  };

  const previewWorkbook = async () => {
    if (!file) return;
    setIsPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      const response = await fetch("/api/inventory-import/preview", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not preview workbook");
      setPreview(data as PreviewResponse);
      setStep("review");
      toast.success("Workbook validated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not preview workbook");
    } finally {
      setIsPreviewing(false);
    }
  };

  const commitImport = async () => {
    if (!preview || preview.stats.errors > 0) return;
    setIsCommitting(true);
    try {
      const response = await fetch("/api/inventory-import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewToken: preview.previewToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");
      setResult(data as CommitResponse);
      setStep("complete");
      if (data.success) toast.success(`Imported ${formatNumber(data.createdCopies)} copies`);
      else toast.error("Import completed with errors");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsCommitting(false);
    }
  };

  const downloadErrors = () => {
    if (!preview?.errors.length && !result?.errors.length) return;
    const rows = preview
      ? [["Sheet", "Row", "Severity", "Message"], ...preview.errors.map((error) => [error.sheet, String(error.row), error.severity, error.message])]
      : [["Row", "Message"], ...(result?.errors || []).map((error) => [String(error.row), error.message])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "inventory-import-errors.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep("mode");
  };

  const selectedMode = modeDetails[mode];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Inventory Import</h1>
                <p className="text-muted-foreground">Migrate book copies and library allocations from an Excel workbook.</p>
              </div>
            </div>
          </div>
          {step !== "mode" && (
            <Button variant="outline" onClick={reset} data-testid="button-start-over">
              Start over
            </Button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {(["mode", "upload", "review", "complete"] as Step[]).map((item, index) => (
            <div key={item} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${step === item ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${step === item ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{index + 1}</span>
              <span className="capitalize">{item === "mode" ? "Choose mode" : item}</span>
            </div>
          ))}
        </div>

        {step === "mode" && (
          <div className="space-y-6">
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Administrator-only import</AlertTitle>
              <AlertDescription>Validation runs before any books or copies are created. Keep ISBN and SSN columns formatted as text in Excel.</AlertDescription>
            </Alert>
            <div className="grid gap-4 lg:grid-cols-2">
              {(Object.keys(modeDetails) as ImportMode[]).map((option) => {
                const details = modeDetails[option];
                const selected = option === mode;
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => setMode(option)}
                    className={`rounded-xl border p-6 text-left transition-colors ${selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/50"}`}
                    data-testid={`card-import-mode-${option.toLowerCase()}`}
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="rounded-lg bg-muted p-3">
                        {option === "EXISTING_SSN" ? <Copy className="h-5 w-5" /> : <PackageCheck className="h-5 w-5" />}
                      </div>
                      {selected && <Badge>Selected</Badge>}
                    </div>
                    <h2 className="text-lg font-semibold">{details.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{details.description}</p>
                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      {details.bullets.map((bullet) => <li key={bullet} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{bullet}</li>)}
                    </ul>
                    <Badge variant="secondary" className="mt-5">{details.sheetLabel}</Badge>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep("upload")} data-testid="button-continue-to-upload">Continue to upload</Button>
            </div>
          </div>
        )}

        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle>{selectedMode.title}</CardTitle>
              <CardDescription>Download the matching template, complete both worksheets, then upload the workbook.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <Download className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Use the {selectedMode.sheetLabel} template</p>
                    <p className="text-sm text-muted-foreground">It includes the required headers and an example row.</p>
                  </div>
                </div>
                <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-import-template"><Download className="h-4 w-4" />Download template</Button>
              </div>
              <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/10 px-6 text-center hover:border-primary/50">
                <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
                <span className="font-medium">{file ? file.name : "Choose an Excel workbook"}</span>
                <span className="mt-1 text-sm text-muted-foreground">.xlsx or .xls, up to 25 MB</span>
                <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} data-testid="input-inventory-import-file" />
              </label>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep("mode")}>Back</Button>
                <Button onClick={previewWorkbook} disabled={!file || isPreviewing} data-testid="button-preview-inventory-import">
                  {isPreviewing ? <><Loader2 className="animate-spin" />Validating workbook…</> : <>Validate and preview</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "review" && preview && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Books", preview.stats.books, <FileSpreadsheet className="h-4 w-4" />],
                ["New books", preview.stats.newBooks, <PackageCheck className="h-4 w-4" />],
                ["Copies", preview.stats.copies, <Copy className="h-4 w-4" />],
                ["Libraries", preview.stats.libraries, <Library className="h-4 w-4" />],
                ["Errors", preview.stats.errors, preview.stats.errors ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />],
              ].map(([label, value, icon]) => (
                <Card key={String(label)}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={`rounded-md p-2 ${label === "Errors" && preview.stats.errors ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{icon}</div>
                    <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{formatNumber(Number(value))}</p></div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><CardTitle>Validation result</CardTitle><CardDescription>{preview.stats.errors ? "Fix the errors in the workbook and upload it again." : "This workbook is ready to import."}</CardDescription></div>
                  {preview.errors.length > 0 && <Button variant="outline" onClick={downloadErrors} data-testid="button-download-import-errors"><Download className="h-4 w-4" />Download errors</Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {preview.stats.errors > 0 ? (
                  <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>{formatNumber(preview.stats.errors)} blocking error{preview.stats.errors === 1 ? "" : "s"}</AlertTitle><AlertDescription>The import is locked until every blocking error is resolved.</AlertDescription></Alert>
                ) : (
                  <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>No blocking errors found</AlertTitle><AlertDescription>{formatNumber(preview.stats.existingBooks)} books will be matched and {formatNumber(preview.stats.newBooks)} new books will be created.</AlertDescription></Alert>
                )}
                {preview.errors.length > 0 && (
                  <div className="max-h-80 overflow-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted"><tr><th className="p-3 text-left">Sheet</th><th className="p-3 text-left">Row</th><th className="p-3 text-left">Severity</th><th className="p-3 text-left">Message</th></tr></thead>
                      <tbody>{preview.errors.map((error, index) => <tr key={`${error.sheet}-${error.row}-${index}`} className="border-t"><td className="p-3">{error.sheet}</td><td className="p-3">{error.row}</td><td className="p-3"><Badge variant={error.severity === "error" ? "destructive" : "secondary"}>{error.severity}</Badge></td><td className="p-3">{error.message}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
                {preview.truncatedErrors && <p className="text-sm text-muted-foreground">Only the first 250 errors are shown in this preview.</p>}
                {preview.sampleRows.length > 0 && preview.stats.errors === 0 && (
                  <div className="rounded-lg border p-4">
                    <p className="mb-3 text-sm font-medium">First imported rows</p>
                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                      {preview.sampleRows.slice(0, 8).map((row, index) => <div key={index} className="rounded bg-muted/50 p-2">{String(row.bookRef)} · {String(row.libraryCode)}{mode === "EXISTING_SSN" ? ` · ${String(row.existingSSN)}` : ` · ${String(row.copyCount)} copies`}</div>)}
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep("upload")}>Back</Button>
                  <Button onClick={commitImport} disabled={preview.stats.errors > 0 || isCommitting} data-testid="button-commit-inventory-import">
                    {isCommitting ? <><Loader2 className="animate-spin" />Importing copies…</> : <>Import inventory</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "complete" && result && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-3 ${result.success ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {result.success ? <CheckCircle2 className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
                </div>
                <div><CardTitle>{result.success ? "Inventory import complete" : "Import completed with errors"}</CardTitle><CardDescription>{result.success ? "The books and copies are now available in the catalog." : "Some rows could not be created. Review the error report before retrying."}</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/40 p-4"><p className="text-xs text-muted-foreground">Books created</p><p className="text-2xl font-semibold">{formatNumber(result.createdBooks)}</p></div>
                <div className="rounded-lg bg-muted/40 p-4"><p className="text-xs text-muted-foreground">Copies created</p><p className="text-2xl font-semibold">{formatNumber(result.createdCopies)}</p></div>
                <div className="rounded-lg bg-muted/40 p-4"><p className="text-xs text-muted-foreground">Failed rows</p><p className="text-2xl font-semibold">{formatNumber(result.failedRows)}</p></div>
              </div>
              {result.errors.length > 0 && <><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Some rows failed</AlertTitle><AlertDescription>Download the error report for the affected workbook rows.</AlertDescription></Alert><Button variant="outline" onClick={downloadErrors}><Download className="h-4 w-4" />Download errors</Button></>}
              <div className="flex justify-end"><Button onClick={reset} data-testid="button-new-inventory-import">Start a new import</Button></div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}