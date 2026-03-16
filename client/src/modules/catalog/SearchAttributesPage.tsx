import { useState } from "react";
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
  Tags, Plus, Pencil, Trash2, ChevronDown, ChevronRight, X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { searchAttributesApi, type SearchAttributeType } from "@/lib/api";
import { toast } from "sonner";

function AddValueInput({ typeId, onAdded }: { typeId: number; onAdded: () => void }) {
  const [value, setValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
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

  if (!isAdding) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 text-xs"
        onClick={() => setIsAdding(true)}
        data-testid={`button-add-value-${typeId}`}
      >
        <Plus className="h-3 w-3" /> Add Value
      </Button>
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
  const queryClient = useQueryClient();

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
              <div className="flex flex-wrap gap-2 mb-3">
                {type.values.map((val) => (
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
              <p className="text-sm text-muted-foreground mb-3">No values defined yet.</p>
            )}
            <AddValueInput typeId={type.id} onAdded={() => {}} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function SearchAttributesPage() {
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
