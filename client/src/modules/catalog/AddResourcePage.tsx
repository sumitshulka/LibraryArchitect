import { useState } from "react";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Globe, Download, Loader2, Save, Settings, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { booksApi, resourceTypesApi, categoriesApi, z3950Api, type Z3950SearchResult } from "@/lib/api";
import { toast } from "sonner";
import { Link } from "wouter";
import { useCurrency } from "@/lib/useCurrency";
import { formatIsbn } from "@/lib/isbn";

export default function AddResourcePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { currency } = useCurrency();
  
  const [isbn, setIsbn] = useState("");
  const [showZ3950Search, setShowZ3950Search] = useState(false);
  const [selectedServer, setSelectedServer] = useState("loc");
  const [z3950Results, setZ3950Results] = useState<Z3950SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [isbnError, setIsbnError] = useState<string | null>(null);

  const validateIsbn = (value: string): string | null => {
    const cleanIsbn = value.replace(/[-\s]/g, '');
    if (cleanIsbn.length === 0) return null;
    if (cleanIsbn.length < 10) return "ISBN must be at least 10 characters";
    if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
      return "ISBN must be exactly 10 or 13 digits (excluding hyphens)";
    }
    if (!/^\d+$/.test(cleanIsbn.slice(0, -1))) {
      return "ISBN should contain only digits (last character can be X for ISBN-10)";
    }
    return null;
  };
  
  const [formData, setFormData] = useState({
    isbn: "",
    title: "",
    author: "",
    publisher: "",
    publishedYear: new Date().getFullYear(),
    category: "",
    resourceTypeId: null as number | null,
    shelfLocation: "",
    status: "AVAILABLE" as const,
    format: "PHYSICAL" as "PHYSICAL" | "EBOOK" | "AUDIOBOOK",
    coverUrl: null as string | null,
    marcRecord: null as string | null,
    quantity: 1,
    acquisitionDate: new Date().toISOString().split('T')[0],
    acquisitionSource: "",
    unitPrice: "" as string,
  });

  const { data: resourceTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ["resource-types", "active"],
    queryFn: resourceTypesApi.getActive,
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["categories", "active"],
    queryFn: categoriesApi.getActive,
  });

  const createMutation = useMutation({
    mutationFn: booksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Resource added successfully");
      setLocation("/catalog");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleIsbnChange = (value: string) => {
    setIsbn(value);
    setFormData({ ...formData, isbn: value });
    setSearchPerformed(false);
    setZ3950Results([]);
    
    const error = validateIsbn(value);
    setIsbnError(error);
    
    if (value.replace(/[-\s]/g, '').length >= 10 && !error) {
      setShowZ3950Search(true);
    } else {
      setShowZ3950Search(false);
    }
  };

  const handleZ3950Search = async () => {
    if (!isbn) return;
    
    const error = validateIsbn(isbn);
    if (error) {
      setIsbnError(error);
      return;
    }
    
    setIsSearching(true);
    setSearchPerformed(false);
    try {
      const results = await z3950Api.search(isbn, selectedServer);
      setZ3950Results(results);
      setSearchPerformed(true);
      if (results.length === 0) {
        toast.info("No results found in external catalogs. You can enter the details manually.");
      }
    } catch (error) {
      toast.error("Failed to search external catalogs");
      setSearchPerformed(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportRecord = (record: Z3950SearchResult) => {
    setFormData({
      ...formData,
      isbn: record.isbn,
      title: record.title,
      author: record.author,
      publisher: record.publisher,
      publishedYear: parseInt(record.year) || new Date().getFullYear(),
      category: record.category,
    });
    setIsbn(record.isbn);
    setZ3950Results([]);
    setShowZ3950Search(false);
    toast.success("Record imported from " + record.source);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.isbn || !formData.title || !formData.author || !formData.category) {
      toast.error("Please fill in all required fields (ISBN, Title, Author, Category)");
      return;
    }

    if (!formData.resourceTypeId) {
      toast.error("Please select a resource type");
      return;
    }

    createMutation.mutate({
      ...formData,
      unitPrice: formData.unitPrice === "" ? null : parseFloat(formData.unitPrice),
    });
  };

  return (
    <MainLayout>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/catalog")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
            Add New Resource
          </h1>
          <p className="text-muted-foreground mt-1">
            Add a new book, journal, or media item to the catalog.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              ISBN Lookup
            </CardTitle>
            <CardDescription>
              Enter the ISBN to search external catalogs for book metadata, or enter details manually.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="isbn">ISBN *</Label>
                <Input
                  id="isbn"
                  placeholder="Enter ISBN (e.g., 978-0132350884)"
                  value={isbn}
                  onChange={(e) => handleIsbnChange(e.target.value)}
                  className={`font-mono ${isbnError ? 'border-red-500' : ''}`}
                  data-testid="input-isbn"
                />
                {isbnError && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {isbnError}
                  </p>
                )}
              </div>
            </div>

            {showZ3950Search && (
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Search External Catalogs (Z39.50)</span>
                  </div>
                  <Button 
                    type="button" 
                    variant="link" 
                    size="sm"
                    onClick={() => setShowZ3950Search(false)}
                  >
                    Skip & Enter Manually
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Select value={selectedServer} onValueChange={setSelectedServer}>
                    <SelectTrigger className="w-[200px]" data-testid="select-server">
                      <SelectValue placeholder="Select Server" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loc">Library of Congress</SelectItem>
                      <SelectItem value="ox">Oxford University</SelectItem>
                      <SelectItem value="bl">British Library</SelectItem>
                      <SelectItem value="worldcat">WorldCat (OCLC)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    type="button" 
                    onClick={handleZ3950Search} 
                    disabled={isSearching}
                    data-testid="button-search-z3950"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Search Catalog
                      </>
                    )}
                  </Button>
                </div>

                {z3950Results.length > 0 ? (
                  <div className="border rounded-md">
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
                        {z3950Results.map((result) => (
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
                            <TableCell className="font-mono text-xs">{formatIsbn(result.isbn)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {result.publisher}, {result.year}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                type="button"
                                size="sm" 
                                variant="secondary" 
                                className="gap-2"
                                onClick={() => handleImportRecord(result)}
                                data-testid={`button-import-${result.id}`}
                              >
                                <Download className="h-4 w-4" />
                                Import
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : searchPerformed && !isSearching ? (
                  <Alert className="bg-amber-50 border-amber-200">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <p className="font-medium">No results found for ISBN: {isbn}</p>
                      <p className="text-sm mt-1">
                        This ISBN was not found in Open Library or Google Books catalogs. 
                        This can happen with regional publishers or newer publications.
                      </p>
                      <p className="text-sm mt-2">
                        You can still add this resource by entering the details manually below.
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resource Details</CardTitle>
            <CardDescription>
              Fill in the details for the new resource. Fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="resourceType">Resource Type *</Label>
                {resourceTypes.length === 0 && !loadingTypes ? (
                  <div className="p-3 border rounded-md bg-muted/50 text-sm text-muted-foreground">
                    <p>No resource types configured.</p>
                    <Link href="/settings" className="text-primary hover:underline inline-flex items-center gap-1 mt-1">
                      <Settings className="h-3 w-3" />
                      Configure in Settings
                    </Link>
                  </div>
                ) : (
                  <Select 
                    value={formData.resourceTypeId?.toString() || ""} 
                    onValueChange={(value) => setFormData({ ...formData, resourceTypeId: parseInt(value) })}
                  >
                    <SelectTrigger data-testid="select-resource-type">
                      <SelectValue placeholder="Select resource type" />
                    </SelectTrigger>
                    <SelectContent>
                      {resourceTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                {categories.length === 0 && !loadingCategories ? (
                  <div className="p-3 border rounded-md bg-muted/50 text-sm text-muted-foreground">
                    <p>No categories configured.</p>
                    <Link href="/settings" className="text-primary hover:underline inline-flex items-center gap-1 mt-1">
                      <Settings className="h-3 w-3" />
                      Configure in Settings
                    </Link>
                  </div>
                ) : (
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter book title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="author">Author *</Label>
                <Input
                  id="author"
                  placeholder="Enter author name"
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  data-testid="input-author"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="publisher">Publisher</Label>
                <Input
                  id="publisher"
                  placeholder="Enter publisher name"
                  value={formData.publisher}
                  onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                  data-testid="input-publisher"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Published Year</Label>
                <Input
                  id="year"
                  type="number"
                  placeholder="Enter year"
                  value={formData.publishedYear}
                  onChange={(e) => setFormData({ ...formData, publishedYear: parseInt(e.target.value) || new Date().getFullYear() })}
                  data-testid="input-year"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="shelfLocation">Shelf Location</Label>
                <Input
                  id="shelfLocation"
                  placeholder="e.g., A-12-3"
                  value={formData.shelfLocation}
                  onChange={(e) => setFormData({ ...formData, shelfLocation: e.target.value })}
                  data-testid="input-shelf"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="acquisitionDate">Acquisition Date</Label>
                <Input
                  id="acquisitionDate"
                  type="date"
                  value={formData.acquisitionDate}
                  onChange={(e) => setFormData({ ...formData, acquisitionDate: e.target.value })}
                  data-testid="input-acquisition-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="acquisitionSource">Acquisition Source</Label>
                <Input
                  id="acquisitionSource"
                  placeholder="e.g., Publisher, Vendor, Donation"
                  value={formData.acquisitionSource}
                  onChange={(e) => setFormData({ ...formData, acquisitionSource: e.target.value })}
                  data-testid="input-acquisition-source"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price ({currency.symbol})</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price per unit"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                  data-testid="input-unit-price"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity (Copies) *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="1000"
                  placeholder="Number of copies to add"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  data-testid="input-quantity"
                />
                <p className="text-xs text-muted-foreground">
                  Copies will be created as unallocated and can be assigned to libraries later.
                </p>
              </div>

              {formData.unitPrice && parseFloat(formData.unitPrice) > 0 && (
                <div className="space-y-2">
                  <Label>Total Acquisition Cost</Label>
                  <div className="p-3 bg-muted rounded-md border">
                    <p className="text-lg font-semibold">
                      {currency.symbol}{(parseFloat(formData.unitPrice) * formData.quantity).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {currency.symbol}{parseFloat(formData.unitPrice).toFixed(2)} × {formData.quantity} {formData.quantity === 1 ? 'copy' : 'copies'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setLocation("/catalog")}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending}
            className="gap-2"
            data-testid="button-save"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Resource
              </>
            )}
          </Button>
        </div>
      </form>
    </MainLayout>
  );
}
