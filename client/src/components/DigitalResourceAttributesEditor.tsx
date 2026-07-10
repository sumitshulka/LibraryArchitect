import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tags } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { searchAttributesApi, type SearchAttributeType, type SearchAttributeValue } from "@/lib/api";

type TypeWithValues = SearchAttributeType & { values: SearchAttributeValue[] };

interface Props {
  selectedValueIds: number[];
  onChange: (ids: number[]) => void;
}

export function DigitalResourceAttributesEditor({ selectedValueIds, onChange }: Props) {
  const { data: types = [] } = useQuery<TypeWithValues[]>({
    queryKey: ["search-attribute-types"],
    queryFn: searchAttributesApi.getTypes,
  });

  const activeTypes = useMemo(() => {
    return types
      .filter((t) => t.isActive)
      .map((t) => ({ ...t, values: (t.values || []).filter((v) => v.isActive) }))
      .filter((t) => t.values.length > 0);
  }, [types]);

  const selectedSet = useMemo(() => new Set(selectedValueIds), [selectedValueIds]);

  const toggleValue = (valueId: number) => {
    const next = new Set(selectedValueIds);
    if (next.has(valueId)) next.delete(valueId);
    else next.add(valueId);
    onChange(Array.from(next));
  };

  if (activeTypes.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground border rounded-lg border-dashed">
        <Tags className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No search attributes have been configured yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 border rounded-lg p-3">
      {activeTypes.map((type) => (
        <div key={type.id}>
          <div className="text-sm font-medium text-muted-foreground mb-1.5">{type.name}</div>
          <div className="flex flex-wrap gap-2">
            {type.values.map((val) => {
              const checked = selectedSet.has(val.id);
              return (
                <label
                  key={val.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm cursor-pointer transition-colors ${
                    checked ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted"
                  }`}
                  data-testid={`attr-checkbox-${val.id}`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleValue(val.id)}
                    className="h-3.5 w-3.5"
                  />
                  {val.value}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function useSelectedAttributeIds(initial: number[] = []) {
  const [ids, setIds] = useState<number[]>(initial);
  useEffect(() => {
    setIds(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initial)]);
  return [ids, setIds] as const;
}
