import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Globe, Download, Loader2, AlertCircle } from "lucide-react";
import { formatIsbn } from "@/lib/isbn";
import { z3950Api, type Z3950SearchResult } from "@/lib/api";

export function Z3950Search() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [selectedServer, setSelectedServer] = useState("auto");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Z3950SearchResult[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError("Enter an ISBN, title, or author to search.");
      return;
    }

    setIsSearching(true);
    setSearchPerformed(false);
    setError(null);
    setResults([]);
    try {
      const liveResults = await z3950Api.search(trimmedQuery, selectedServer);
      setResults(liveResults);
      setSearchPerformed(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Failed to search external catalogs.");
      setSearchPerformed(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportRecord = (record: Z3950SearchResult) => {
    const params = new URLSearchParams({
      source: "z3950",
      isbn: record.isbn,
      title: record.title,
      author: record.author,
      publisher: record.publisher,
      year: record.year,
      category: record.category,
    });
    setLocation(`/catalog/new?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Z39.50 Remote Search
          </CardTitle>
          <CardDescription>
            Query external library catalogs to import MARC records directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid gap-4 md:grid-cols-[220px_1fr_auto]">
              <Select value={selectedServer} onValueChange={setSelectedServer}>
                <SelectTrigger data-testid="select-z3950-server">
                <SelectValue placeholder="Select Server" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="auto">All live sources</SelectItem>
                  <SelectItem value="open-library">Open Library</SelectItem>
                  <SelectItem value="google-books">Google Books</SelectItem>
                  <SelectItem value="abebooks">AbeBooks</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSearch();
                  }}
                  placeholder="Search by ISBN, title, or author..."
                  className="pl-9"
                  data-testid="input-z3950-query"
                />
            </div>

              <Button onClick={handleSearch} disabled={isSearching || !query.trim()} className="w-[120px]" data-testid="button-search-z3950">
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching
                </>
              ) : (
                'Search'
              )}
            </Button>
          </div>
            {error && (
              <div className="mt-4 flex items-center gap-2 text-sm text-destructive" role="alert">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
        </CardContent>
      </Card>

      {searchPerformed && !isSearching && results.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
            <Search className="h-8 w-8 opacity-50" />
            <p className="font-medium text-foreground">No live results found</p>
            <p className="text-sm">Try a different ISBN, title, or author.</p>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Title & Author</TableHead>
                  <TableHead>ISBN</TableHead>
                  <TableHead>Publisher / Year</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-normal text-xs">
                        {result.source}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{result.title}</span>
                        <span className="text-xs text-muted-foreground">{result.author}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {result.isbn ? formatIsbn(result.isbn) : <span className="font-sans text-muted-foreground">Not available</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.publisher}, {result.year}
                    </TableCell>
                    <TableCell className="text-right">
                                 <Button
                                   size="sm"
                                   variant="secondary"
                                   className="gap-2"
                                   onClick={() => handleImportRecord(result)}
                                   disabled={!result.isbn}
                                   title={result.isbn ? "Review this record in Add Resource" : "An ISBN is required before this record can be imported"}
                                   data-testid={`button-import-z3950-${result.id}`}
                                 >
                        <Download className="h-4 w-4" />
                                   {result.isbn ? "Import" : "ISBN required"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
