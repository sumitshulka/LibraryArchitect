import { useState } from "react";
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
import { Search, Globe, Download, Loader2 } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  year: string;
  source: string;
}

export function Z3950Search() {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleSearch = () => {
    setIsSearching(true);
    // Simulate API call
    setTimeout(() => {
      setResults([
        { id: '1', title: 'The Design of Everyday Things', author: 'Norman, Donald A.', isbn: '978-0465050659', publisher: 'Basic Books', year: '2013', source: 'Library of Congress' },
        { id: '2', title: 'The Design of Everyday Things', author: 'Norman, Don', isbn: '978-0262525671', publisher: 'MIT Press', year: '1988', source: 'Oxford University' },
        { id: '3', title: 'Design of Everyday Things: Revised and Expanded', author: 'Norman, Donald A.', isbn: '978-0465050659', publisher: 'Basic Books', year: '2013', source: 'British Library' },
      ]);
      setIsSearching(false);
    }, 1500);
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
          <div className="grid gap-4 md:grid-cols-[200px_1fr_auto]">
            <Select defaultValue="loc">
              <SelectTrigger>
                <SelectValue placeholder="Select Server" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="loc">Library of Congress</SelectItem>
                <SelectItem value="ox">Oxford University</SelectItem>
                <SelectItem value="bl">British Library</SelectItem>
                <SelectItem value="worldcat">WorldCat (OCLC)</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by ISBN, Title, or Author..." className="pl-9" />
            </div>

            <Button onClick={handleSearch} disabled={isSearching} className="w-[120px]">
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
        </CardContent>
      </Card>

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
                    <TableCell className="font-mono text-xs">{result.isbn}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.publisher}, {result.year}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="secondary" className="gap-2">
                        <Download className="h-4 w-4" />
                        Import
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
