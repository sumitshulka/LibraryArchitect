import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { searchAttributesApi, type SearchAttributeType, type SearchAttributeValue } from "@/lib/api";

type TypeWithValues = SearchAttributeType & { values: SearchAttributeValue[] };

interface Props {
  selectedValueIds: number[];
  onChange: (ids: number[]) => void;
  align?: "start" | "center" | "end";
}

export function SearchAttributesFilter({ selectedValueIds, onChange, align = "end" }: Props) {
  const { data: types = [] } = useQuery<TypeWithValues[]>({
    queryKey: ["search-attribute-types"],
    queryFn: searchAttributesApi.getTypes,
  });

  // Only types that are active AND have at least one active value.
  const filterableTypes = useMemo(() => {
    return types
      .filter(t => t.isActive)
      .map(t => ({ ...t, values: (t.values || []).filter(v => v.isActive) }))
      .filter(t => t.values.length > 0);
  }, [types]);

  const selectedSet = useMemo(() => new Set(selectedValueIds), [selectedValueIds]);
  const selectedValueLabels = useMemo(() => {
    const labels: { id: number; label: string }[] = [];
    for (const t of filterableTypes) {
      for (const v of t.values) {
        if (selectedSet.has(v.id)) labels.push({ id: v.id, label: `${t.name}: ${v.value}` });
      }
    }
    return labels;
  }, [filterableTypes, selectedSet]);

  const toggle = (valueId: number) => {
    const next = new Set(selectedValueIds);
    if (next.has(valueId)) next.delete(valueId);
    else next.add(valueId);
    onChange(Array.from(next));
  };

  if (filterableTypes.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-search-attributes-filter">
            <Filter className="h-4 w-4" />
            Search Attributes
            {selectedValueIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">{selectedValueIds.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align={align} className="w-72 p-0">
          <div className="flex items-center justify-between p-3">
            <span className="text-sm font-medium">Filter by attributes</span>
            {selectedValueIds.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange([])} data-testid="button-clear-attributes">
                Clear
              </Button>
            )}
          </div>
          <Separator />
          <div className="max-h-80 overflow-y-auto">
            <div className="p-3 space-y-4">
              {filterableTypes.map(type => (
                <div key={type.id} className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {type.name}
                  </div>
                  <div className="space-y-1.5">
                    {type.values.map(v => {
                      const id = `attr-${v.id}`;
                      return (
                        <label
                          key={v.id}
                          htmlFor={id}
                          className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5"
                          data-testid={`checkbox-attr-${v.id}`}
                        >
                          <Checkbox
                            id={id}
                            checked={selectedSet.has(v.id)}
                            onCheckedChange={() => toggle(v.id)}
                          />
                          <span>{v.value}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {selectedValueLabels.map(({ id, label }) => (
        <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1" data-testid={`chip-attr-${id}`}>
          {label}
          <button
            type="button"
            onClick={() => toggle(id)}
            className="hover:bg-muted-foreground/20 rounded-sm p-0.5"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
