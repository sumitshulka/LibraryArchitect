import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { librariesApi, type LibraryResourceStats } from "@/lib/api";

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

function ResourceCard({ resource }: { resource: LibraryResourceStats }) {
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
          />
          <CopyStat
            label="Available"
            value={resource.available}
            icon={CheckCircle2}
            variant={resource.available > 0 ? "success" : "muted"}
            testId={`stat-available-${resource.bookId}`}
          />
          <CopyStat
            label="Issued"
            value={resource.checkedOut}
            icon={XCircle}
            variant={resource.checkedOut > 0 ? "info" : "muted"}
            testId={`stat-issued-${resource.bookId}`}
          />
          <CopyStat
            label="Reserved"
            value={resource.reserved}
            icon={Clock}
            variant={resource.reserved > 0 ? "warning" : "muted"}
            testId={`stat-reserved-${resource.bookId}`}
          />
          <CopyStat
            label="Damaged"
            value={resource.damaged}
            icon={AlertTriangle}
            variant={resource.damaged > 0 ? "danger" : "muted"}
            testId={`stat-damaged-${resource.bookId}`}
          />
          <CopyStat
            label="Lost"
            value={resource.lost}
            icon={AlertTriangle}
            variant={resource.lost > 0 ? "danger" : "muted"}
            testId={`stat-lost-${resource.bookId}`}
          />
          <CopyStat
            label="In Transit"
            value={resource.inTransit}
            icon={Truck}
            variant={resource.inTransit > 0 ? "info" : "muted"}
            testId={`stat-transit-${resource.bookId}`}
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
}: { 
  label: string; 
  value: number; 
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "success" | "warning" | "danger" | "info" | "muted";
  testId: string;
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
    <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50" data-testid={testId}>
      <Icon className={`h-4 w-4 ${variantStyles[variant]}`} />
      <span className={`text-lg font-bold ${variantStyles[variant]}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
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
                  <ResourceCard key={resource.bookId} resource={resource} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

export default LibraryResourcesPage;
