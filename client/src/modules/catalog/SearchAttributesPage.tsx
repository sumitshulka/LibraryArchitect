import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tags, Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, Search, Check,
  ArrowLeft, BookOpen, FileText,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  booksApi,
  digitalResourcesApi,
  searchAttributesApi,
  type SearchAttributeType,
} from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

function AddValueInput({ typeId, onAdded }: { typeId: number; onAdded: () => void }) {
  const [value, setValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [bulkValueText, setBulkValueText] = useState("");
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (val: string) => searchAttributesApi.createValue(typeId, { value: val }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-attribute-types"] });
      setValue("");
      setIsAdding(false);
      onAdded();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (values: string[]) => searchAttributesApi.createValues(typeId, values),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["search-attribute-types"] });
      setBulkValueText("");
      setShowBulkDialog(false);
      onAdded();
      toast.success(
        result.skippedCount > 0
          ? `${result.createdCount} values added; ${result.skippedCount} duplicates skipped`
          : `${result.createdCount} values added`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const parsedBulkValues = Array.from(new Set(
    bulkValueText
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  ));

  if (!isAdding) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => setIsAdding(true)}
          data-testid={`button-add-value-${typeId}`}
        >
          <Plus className="h-3 w-3" /> Add Value
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => setShowBulkDialog(true)}
          data-testid={`button-add-multiple-values-${typeId}`}
        >
          <Plus className="h-3 w-3" /> Add multiple values
        </Button>
        <Dialog open={showBulkDialog} onOpenChange={(open) => {
          if (!open) setBulkValueText("");
          setShowBulkDialog(open);
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add multiple values</DialogTitle>
              <DialogDescription>
                Enter one value per line. Blank lines and duplicate entries in this list will be ignored.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`bulk-values-${typeId}`}>Values</Label>
              <Textarea
                id={`bulk-values-${typeId}`}
                value={bulkValueText}
                onChange={(event) => setBulkValueText(event.target.value)}
                placeholder={"CS101\nCS102\nCS103"}
                rows={12}
                autoFocus
                data-testid={`textarea-bulk-values-${typeId}`}
              />
              <p className="text-xs text-muted-foreground">
                {parsedBulkValues.length} unique value{parsedBulkValues.length === 1 ? "" : "s"} ready to add.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
              <Button
                onClick={() => bulkCreateMutation.mutate(parsedBulkValues)}
                disabled={parsedBulkValues.length === 0 || bulkCreateMutation.isPending}
                data-testid={`button-save-bulk-values-${typeId}`}
              >
                {bulkCreateMutation.isPending ? "Adding..." : "Add values"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter value..."
        className="h-8 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) createMutation.mutate(value.trim());
          if (e.key === "Escape") { setIsAdding(false); setValue(""); }
        }}
        autoFocus
        data-testid={`input-new-value-${typeId}`}
      />
      <Button
        size="sm"
        className="h-8"
        onClick={() => value.trim() && createMutation.mutate(value.trim())}
        disabled={!value.trim() || createMutation.isPending}
        data-testid={`button-save-value-${typeId}`}
      >
        Add
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8"
        onClick={() => { setIsAdding(false); setValue(""); }}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

function AttributeTypeCard({ type }: { type: SearchAttributeType }) {
  const [expanded, setExpanded] = useState(true);
  const [valueSearch, setValueSearch] = useState("");
  const queryClient = useQueryClient();
  const filteredValues = useMemo(() => {
    const query = valueSearch.trim().toLowerCase();
    if (!query) return type.values;
    return type.values.filter((value) => value.value.toLowerCase().includes(query));
  }, [type.values, valueSearch]);

  const toggleMutation = useMutation({
    mutationFn: () => searchAttributesApi.updateType(type.id, { isActive: !type.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["search-attribute-types"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteValueMutation = useMutation({
    mutationFn: (id: number) => searchAttributesApi.deleteValue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-attribute-types"] });
      toast.success("Value removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteTypeMutation = useMutation({
    mutationFn: () => searchAttributesApi.deleteType(type.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-attribute-types"] });
      toast.success("Attribute type deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card data-testid={`card-attr-type-${type.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setExpanded(!expanded)} className="p-0.5 hover:bg-muted rounded" data-testid={`button-toggle-${type.id}`}>
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <CardTitle className="text-base">{type.name}</CardTitle>
            {!type.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
            <Badge variant="outline" className="text-xs">{type.values.length} values</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Active</Label>
              <Switch
                checked={type.isActive}
                onCheckedChange={() => toggleMutation.mutate()}
                data-testid={`switch-active-${type.id}`}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm(`Delete "${type.name}" and all its values? This will also remove all assignments from resources.`)) {
                  deleteTypeMutation.mutate();
                }
              }}
              data-testid={`button-delete-type-${type.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {type.description && (
          <p className="text-sm text-muted-foreground ml-6">{type.description}</p>
        )}
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="ml-6">
            {type.values.length > 0 ? (
              <div className="mb-3 space-y-3">
                <div className="relative max-w-md">
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={valueSearch}
                    onChange={(event) => setValueSearch(event.target.value)}
                    placeholder={`Search ${type.name.toLowerCase()} values...`}
                    className="pl-8"
                    aria-label={`Search ${type.name} values`}
                    data-testid={`input-search-values-${type.id}`}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Showing {filteredValues.length} of {type.values.length} values
                </p>
                {filteredValues.length > 0 ? (
                  <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto pr-2">
                    {filteredValues.map((val) => (
                      <Badge
                        key={val.id}
                        variant={val.isActive ? "default" : "secondary"}
                        className="gap-1 pr-1"
                        data-testid={`badge-value-${val.id}`}
                      >
                        {val.value}
                        <button
                          onClick={() => deleteValueMutation.mutate(val.id)}
                          className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                          data-testid={`button-remove-value-${val.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No values match your search.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">No values defined yet.</p>
            )}
            <AddValueInput typeId={type.id} onAdded={() => {}} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function BulkAssignAttributesPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<Set<number>>(new Set());
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set());
  const [selectedDigitalResourceIds, setSelectedDigitalResourceIds] = useState<Set<number>>(new Set());
  const [bookSearch, setBookSearch] = useState("");
  const [digitalSearch, setDigitalSearch] = useState("");
  const [attributeSearches, setAttributeSearches] = useState<Record<number, string>>({});

  const { data: types = [], isLoading: typesLoading } = useQuery({
    queryKey: ["search-attribute-types"],
    queryFn: searchAttributesApi.getTypes,
  });
  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ["bulk-search-attribute-books"],
    queryFn: () => booksApi.getAll(),
  });
  const { data: digitalResources = [], isLoading: digitalResourcesLoading } = useQuery({
    queryKey: ["bulk-search-attribute-digital-resources"],
    queryFn: () => digitalResourcesApi.getAll(),
  });

  const availableTypes = types.filter((type) => type.isActive && type.values.some((value) => value.isActive));
  const filteredBooks = useMemo(() => {
    const query = bookSearch.trim().toLowerCase();
    if (!query) return books;
    return books.filter((book) => [book.title, book.author, book.isbn].some((value) => value?.toLowerCase().includes(query)));
  }, [books, bookSearch]);
  const filteredDigitalResources = useMemo(() => {
    const query = digitalSearch.trim().toLowerCase();
    if (!query) return digitalResources;
    return digitalResources.filter((resource) =>
      [resource.title, resource.author, resource.subject].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [digitalResources, digitalSearch]);

  const toggleId = (setter: React.Dispatch<React.SetStateAction<Set<number>>>, id: number) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleVisible = (
    setter: React.Dispatch<React.SetStateAction<Set<number>>>,
    visibleIds: number[],
  ) => {
    setter((current) => {
      const next = new Set(current);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));
      visibleIds.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const bulkAssignMutation = useMutation({
    mutationFn: () => searchAttributesApi.bulkAssign({
      attributeValueIds: Array.from(selectedAttributeIds),
      bookIds: Array.from(selectedBookIds),
      digitalResourceIds: Array.from(selectedDigitalResourceIds),
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-summary-books"] });
      queryClient.invalidateQueries({ queryKey: ["digital-resources"] });
      queryClient.invalidateQueries({ queryKey: ["search-attribute-types"] });
      toast.success(`Assigned attributes to ${result.booksUpdated} books and ${result.digitalResourcesUpdated} digital resources`);
      setLocation("/catalog/search-attributes");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canSubmit = selectedAttributeIds.size > 0 && (selectedBookIds.size > 0 || selectedDigitalResourceIds.size > 0);
  const visibleBookIds = filteredBooks.map((book) => book.id);
  const visibleDigitalResourceIds = filteredDigitalResources.map((resource) => resource.id);
  const selectedBooks = books.filter((book) => selectedBookIds.has(book.id));
  const selectedDigitalResources = digitalResources.filter((resource) => selectedDigitalResourceIds.has(resource.id));

  return (
    <MainLayout>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2 gap-2"
              onClick={() => setLocation("/catalog/search-attributes")}
              data-testid="button-back-search-attributes"
            >
              <ArrowLeft className="h-4 w-4" />
              Search Attributes
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Check className="h-7 w-7" />
              Bulk Assign Attributes
            </h1>
            <p className="text-muted-foreground mt-1">
              Choose attribute values, then select the books and digital resources that should inherit them.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{selectedBookIds.size} books</Badge>
            <Badge variant="outline">{selectedDigitalResourceIds.size} digital resources</Badge>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            <section className="space-y-2">
              <Label>Attribute values</Label>
              <Card>
                <CardContent className="space-y-4 p-4">
                  {typesLoading ? (
                    <p className="text-sm text-muted-foreground">Loading attribute values...</p>
                  ) : availableTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Create an active attribute type with values before assigning attributes.</p>
                  ) : availableTypes.map((type) => (
                    <div key={type.id} className="space-y-2">
                      <p className="text-sm font-medium">{type.name}</p>
                      {(() => {
                        const activeValues = type.values.filter((value) => value.isActive);
                        const search = attributeSearches[type.id] ?? "";
                        const query = search.trim().toLowerCase();
                        const filteredValues = query
                          ? activeValues.filter((value) => value.value.toLowerCase().includes(query))
                          : activeValues;

                        return (
                          <>
                            <div className="relative max-w-md">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                value={search}
                                onChange={(event) => setAttributeSearches((current) => ({
                                  ...current,
                                  [type.id]: event.target.value,
                                }))}
                                placeholder={`Search ${type.name.toLowerCase()} values...`}
                                className="pl-8"
                                aria-label={`Search ${type.name} values for bulk assignment`}
                                data-testid={`input-search-bulk-attribute-${type.id}`}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Showing {filteredValues.length} of {activeValues.length} active values
                            </p>
                            {filteredValues.length > 0 ? (
                              <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto pr-2">
                                {filteredValues.map((value) => (
                                  <label key={value.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer hover:bg-muted/50">
                                    <Checkbox
                                      checked={selectedAttributeIds.has(value.id)}
                                      onCheckedChange={() => toggleId(setSelectedAttributeIds, value.id)}
                                      data-testid={`checkbox-bulk-attribute-${value.id}`}
                                    />
                                    {value.value}
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No values match your search.</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <BulkTargetList
                title="Books"
                search={bookSearch}
                onSearchChange={setBookSearch}
                items={filteredBooks}
                loading={booksLoading}
                selectedIds={selectedBookIds}
                visibleIds={visibleBookIds}
                onToggle={(id) => toggleId(setSelectedBookIds, id)}
                onToggleVisible={() => toggleVisible(setSelectedBookIds, visibleBookIds)}
                getLabel={(book) => `${book.title} — ${book.author || book.isbn}`}
                getSecondary={(book) => book.isbn}
                testIdPrefix="book"
              />
              <BulkTargetList
                title="Digital resources"
                search={digitalSearch}
                onSearchChange={setDigitalSearch}
                items={filteredDigitalResources}
                loading={digitalResourcesLoading}
                selectedIds={selectedDigitalResourceIds}
                visibleIds={visibleDigitalResourceIds}
                onToggle={(id) => toggleId(setSelectedDigitalResourceIds, id)}
                onToggleVisible={() => toggleVisible(setSelectedDigitalResourceIds, visibleDigitalResourceIds)}
                getLabel={(resource) => resource.title}
                getSecondary={(resource) => resource.author || resource.subject || resource.resourceType || "Digital resource"}
                testIdPrefix="digital-resource"
              />
            </div>
          </div>

          <Card className="h-fit xl:sticky xl:top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Selected resources</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review and remove targets before assigning the selected attributes.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedBooks.length === 0 && selectedDigitalResources.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center">
                  <Check className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">No resources selected</p>
                  <p className="mt-1 text-xs text-muted-foreground">Select books or digital resources from the left.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[calc(100vh-22rem)] pr-3">
                  <div className="space-y-4">
                    {selectedBooks.length > 0 && (
                      <SelectedTargetSection
                        title="Books"
                        icon={<BookOpen className="h-4 w-4" />}
                        items={selectedBooks}
                        getLabel={(book) => book.title}
                        getSecondary={(book) => book.isbn}
                        onRemove={(id) => toggleId(setSelectedBookIds, id)}
                        testIdPrefix="selected-book"
                      />
                    )}
                    {selectedDigitalResources.length > 0 && (
                      <SelectedTargetSection
                        title="Digital resources"
                        icon={<FileText className="h-4 w-4" />}
                        items={selectedDigitalResources}
                        getLabel={(resource) => resource.title}
                        getSecondary={(resource) => resource.author || resource.subject || "Digital resource"}
                        onRemove={(id) => toggleId(setSelectedDigitalResourceIds, id)}
                        testIdPrefix="selected-digital-resource"
                      />
                    )}
                  </div>
                </ScrollArea>
              )}
              <div className="border-t pt-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  {selectedAttributeIds.size} attribute values · {selectedBookIds.size + selectedDigitalResourceIds.size} resources selected
                </p>
                <Button
                  className="w-full"
                  onClick={() => bulkAssignMutation.mutate()}
                  disabled={!canSubmit || bulkAssignMutation.isPending}
                  data-testid="button-confirm-bulk-assign"
                >
                  {bulkAssignMutation.isPending ? "Assigning..." : "Assign Attributes"}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  This replaces existing search attributes on each selected resource.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

function BulkTargetList<T extends { id: number }>({
  title,
  search,
  onSearchChange,
  items,
  loading,
  selectedIds,
  visibleIds,
  onToggle,
  onToggleVisible,
  getLabel,
  getSecondary,
  testIdPrefix,
}: {
  title: string;
  search: string;
  onSearchChange: (value: string) => void;
  items: T[];
  loading: boolean;
  selectedIds: Set<number>;
  visibleIds: number[];
  onToggle: (id: number) => void;
  onToggleVisible: () => void;
  getLabel: (item: T) => string;
  getSecondary: (item: T) => string | null | undefined;
  testIdPrefix: string;
}) {
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  return (
    <section className="rounded-md border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{title} <span className="text-muted-foreground font-normal">({selectedIds.size} selected)</span></Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onToggleVisible}
          disabled={visibleIds.length === 0}
          data-testid={`button-select-all-${testIdPrefix}`}
        >
          <Check className="h-3 w-3 mr-1" />
          {allVisibleSelected ? "Clear visible" : "Select visible"}
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={`Search ${title.toLowerCase()}...`}
          className="pl-8"
          data-testid={`input-search-${testIdPrefix}`}
        />
      </div>
      <ScrollArea className="h-52 rounded-md border">
        <div className="p-2">
          {loading ? (
            <p className="p-3 text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No matching {title.toLowerCase()}.</p>
          ) : items.map((item) => (
            <label key={item.id} className="flex items-start gap-2 rounded-md px-2 py-2 cursor-pointer hover:bg-muted/50">
              <Checkbox
                checked={selectedIds.has(item.id)}
                onCheckedChange={() => onToggle(item.id)}
                data-testid={`checkbox-${testIdPrefix}-${item.id}`}
              />
              <span className="min-w-0 text-sm">
                <span className="block truncate">{getLabel(item)}</span>
                {getSecondary(item) && <span className="block truncate text-xs text-muted-foreground">{getSecondary(item)}</span>}
              </span>
            </label>
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}

function SelectedTargetSection<T extends { id: number }>({
  title,
  icon,
  items,
  getLabel,
  getSecondary,
  onRemove,
  testIdPrefix,
}: {
  title: string;
  icon: React.ReactNode;
  items: T[];
  getLabel: (item: T) => string;
  getSecondary: (item: T) => string | null | undefined;
  onRemove: (id: number) => void;
  testIdPrefix: string;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
        <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-md border px-2 py-2"
            data-testid={`${testIdPrefix}-${item.id}`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{getLabel(item)}</p>
              {getSecondary(item) && <p className="truncate text-xs text-muted-foreground">{getSecondary(item)}</p>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${getLabel(item)}`}
              data-testid={`${testIdPrefix}-remove-${item.id}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function SearchAttributesPage() {
  const [, setLocation] = useLocation();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDescription, setNewTypeDescription] = useState("");
  const queryClient = useQueryClient();

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["search-attribute-types"],
    queryFn: searchAttributesApi.getTypes,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      searchAttributesApi.createType({
        name: newTypeName.trim(),
        description: newTypeDescription.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-attribute-types"] });
      setShowAddDialog(false);
      setNewTypeName("");
      setNewTypeDescription("");
      toast.success("Search attribute type created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2" data-testid="text-search-attributes-title">
            <Tags className="h-7 w-7" />
            Search Attributes
          </h1>
          <p className="text-muted-foreground mt-1">
            Define filter categories and values that can be assigned to resources for refined search.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setLocation("/catalog/search-attributes/bulk-assign")}
            data-testid="button-bulk-assign-attributes"
          >
            <Check className="h-4 w-4" />
            Bulk Assign Attributes
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setShowAddDialog(true)}
            data-testid="button-add-attribute-type"
          >
            <Plus className="h-4 w-4" />
            Add Attribute Type
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : types.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Tags className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold text-lg mb-2">No Search Attributes Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create attribute types like Tags, Programs, Courses, Semesters, or Subject Types
                to enable refined search filtering for students.
              </p>
              <Button onClick={() => setShowAddDialog(true)} className="gap-2" data-testid="button-add-first-type">
                <Plus className="h-4 w-4" />
                Create First Attribute Type
              </Button>
            </CardContent>
          </Card>
        ) : (
          types.map((type) => <AttributeTypeCard key={type.id} type={type} />)
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Search Attribute Type</DialogTitle>
            <DialogDescription>
              Create a new category of search attributes (e.g., Tags, Program, Course, Semester, Subject Type).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="attr-name">Name</Label>
              <Input
                id="attr-name"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="e.g., Program, Course, Semester"
                data-testid="input-attr-type-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attr-description">Description (optional)</Label>
              <Textarea
                id="attr-description"
                value={newTypeDescription}
                onChange={(e) => setNewTypeDescription(e.target.value)}
                placeholder="Brief description of this attribute type..."
                rows={2}
                data-testid="input-attr-type-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newTypeName.trim() || createMutation.isPending}
              data-testid="button-confirm-create-type"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
