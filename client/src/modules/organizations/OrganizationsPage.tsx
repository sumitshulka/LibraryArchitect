import { useState } from "react";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, Plus, Pencil, Trash2, 
  ChevronRight, ChevronDown, Building, School, GraduationCap, Library, LayoutDashboard
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orgUnitsApi, librariesApi } from "@/lib/api";
import { toast } from "sonner";
import type { OrgUnit, Library as LibraryType } from "@shared/schema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const ORG_TYPE_ICONS: Record<string, typeof Building> = {
  UNIVERSITY: Building,
  CAMPUS: Building2,
  COLLEGE: School,
  DEPARTMENT: GraduationCap,
};

const ORG_TYPE_LABELS: Record<string, string> = {
  UNIVERSITY: "University",
  CAMPUS: "Campus",
  COLLEGE: "College/School",
  DEPARTMENT: "Department",
};

function OrgUnitDialog({ 
  orgUnit, 
  parentId,
  onClose 
}: { 
  orgUnit?: OrgUnit;
  parentId?: number | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(orgUnit?.code || "");
  const [name, setName] = useState(orgUnit?.name || "");
  const [type, setType] = useState<string>(orgUnit?.type || "UNIVERSITY");
  const [description, setDescription] = useState(orgUnit?.description || "");
  const [isActive, setIsActive] = useState(orgUnit?.isActive ?? true);

  const createMutation = useMutation({
    mutationFn: (data: any) => orgUnitsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-units"] });
      toast.success("Organizational unit created");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => orgUnitsApi.update(orgUnit!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-units"] });
      toast.success("Organizational unit updated");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error("Code and Name are required");
      return;
    }

    const data = { 
      code, 
      name, 
      type, 
      description: description || null, 
      parentId: parentId ?? orgUnit?.parentId ?? null,
      isActive,
      sortOrder: 0
    };
    
    if (orgUnit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{orgUnit ? "Edit" : "Add"} Organizational Unit</DialogTitle>
        <DialogDescription>
          Organizational units form the hierarchy structure (University → Campus → College → Department).
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="org-code">Code *</Label>
          <Input
            id="org-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g., UNIV-001"
            data-testid="input-org-code"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="org-name">Name *</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Central University"
            data-testid="input-org-name"
          />
        </div>
        <div className="grid gap-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger data-testid="select-org-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNIVERSITY">University</SelectItem>
              <SelectItem value="CAMPUS">Campus</SelectItem>
              <SelectItem value="COLLEGE">College/School</SelectItem>
              <SelectItem value="DEPARTMENT">Department</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="org-description">Description</Label>
          <Input
            id="org-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            data-testid="input-org-description"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Active</Label>
            <p className="text-xs text-muted-foreground">
              Inactive units are hidden from selection
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-org-active" />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-org">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function LibraryDialog({ 
  library, 
  orgUnits,
  onClose 
}: { 
  library?: LibraryType;
  orgUnits: OrgUnit[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(library?.code || "");
  const [name, setName] = useState(library?.name || "");
  const [orgUnitId, setOrgUnitId] = useState<number | undefined>(library?.orgUnitId ?? undefined);
  const [address, setAddress] = useState(library?.address || "");
  const [contactEmail, setContactEmail] = useState(library?.contactEmail || "");
  const [contactPhone, setContactPhone] = useState(library?.contactPhone || "");
  const [isActive, setIsActive] = useState(library?.isActive ?? true);

  const createMutation = useMutation({
    mutationFn: (data: any) => librariesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
      toast.success("Library created");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => librariesApi.update(library!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
      toast.success("Library updated");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !orgUnitId) {
      toast.error("Code, Name, and Organizational Unit are required");
      return;
    }

    const data = { 
      code, 
      name, 
      orgUnitId,
      address: address || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      isActive,
    };
    
    if (library) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{library ? "Edit" : "Add"} Library</DialogTitle>
        <DialogDescription>
          Libraries belong to organizational units and can have their own book collections and policies.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="grid gap-2">
          <Label htmlFor="lib-code">Code *</Label>
          <Input
            id="lib-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g., LIB-MAIN"
            data-testid="input-lib-code"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lib-name">Name *</Label>
          <Input
            id="lib-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Main University Library"
            data-testid="input-lib-name"
          />
        </div>
        <div className="grid gap-2">
          <Label>Organizational Unit *</Label>
          <Select value={orgUnitId?.toString()} onValueChange={(v) => setOrgUnitId(parseInt(v))}>
            <SelectTrigger data-testid="select-lib-org">
              <SelectValue placeholder="Select organizational unit" />
            </SelectTrigger>
            <SelectContent>
              {orgUnits.map((unit) => (
                <SelectItem key={unit.id} value={unit.id.toString()}>
                  {unit.name} ({ORG_TYPE_LABELS[unit.type]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lib-address">Address</Label>
          <Input
            id="lib-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Physical location"
            data-testid="input-lib-address"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="lib-email">Contact Email</Label>
            <Input
              id="lib-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="library@example.edu"
              data-testid="input-lib-email"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lib-phone">Contact Phone</Label>
            <Input
              id="lib-phone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              data-testid="input-lib-phone"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Active</Label>
            <p className="text-xs text-muted-foreground">
              Inactive libraries are hidden from users
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-lib-active" />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-lib">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function OrgTreeNode({ 
  unit, 
  allUnits, 
  libraries,
  onEditUnit,
  onDeleteUnit,
  onAddChild,
  onEditLibrary,
  onDeleteLibrary,
  onAddLibrary,
  level = 0 
}: { 
  unit: OrgUnit;
  allUnits: OrgUnit[];
  libraries: LibraryType[];
  onEditUnit: (unit: OrgUnit) => void;
  onDeleteUnit: (id: number) => void;
  onAddChild: (parentId: number) => void;
  onEditLibrary: (lib: LibraryType) => void;
  onDeleteLibrary: (id: number) => void;
  onAddLibrary: (orgUnitId: number) => void;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(level < 2);
  
  const children = allUnits.filter(u => u.parentId === unit.id);
  const unitLibraries = libraries.filter(l => l.orgUnitId === unit.id);
  const hasChildren = children.length > 0 || unitLibraries.length > 0;
  
  const Icon = ORG_TYPE_ICONS[unit.type] || Building;

  return (
    <div className="border-l-2 border-muted pl-4 ml-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2 py-2 group">
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-6" />
          )}
          
          <Icon className="h-4 w-4 text-muted-foreground" />
          
          <div className="flex-1">
            <span className="font-medium">{unit.name}</span>
            <span className="text-xs text-muted-foreground ml-2">({unit.code})</span>
            {!unit.isActive && (
              <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>
            )}
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => onAddChild(unit.id)}
              title="Add child unit"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => onAddLibrary(unit.id)}
              title="Add library"
            >
              <Library className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => onEditUnit(unit)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => onDeleteUnit(unit.id)}
            >
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          </div>
        </div>
        
        <CollapsibleContent>
          {unitLibraries.map(lib => (
            <div 
              key={lib.id} 
              className="flex items-center gap-2 py-2 pl-6 group border-l-2 border-blue-200 ml-2 bg-blue-50/30"
            >
              <Library className="h-4 w-4 text-blue-500" />
              <div className="flex-1">
                <span className="text-sm">{lib.name}</span>
                <span className="text-xs text-muted-foreground ml-2">({lib.code})</span>
                {!lib.isActive && (
                  <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>
                )}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Link href={`/organizations/libraries/${lib.id}`}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    title="View Dashboard"
                    data-testid={`button-dashboard-lib-${lib.id}`}
                  >
                    <LayoutDashboard className="h-3 w-3 text-blue-500" />
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => onEditLibrary(lib)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => onDeleteLibrary(lib.id)}
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          
          {children.map(child => (
            <OrgTreeNode
              key={child.id}
              unit={child}
              allUnits={allUnits}
              libraries={libraries}
              onEditUnit={onEditUnit}
              onDeleteUnit={onDeleteUnit}
              onAddChild={onAddChild}
              onEditLibrary={onEditLibrary}
              onDeleteLibrary={onDeleteLibrary}
              onAddLibrary={onAddLibrary}
              level={level + 1}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [libDialogOpen, setLibDialogOpen] = useState(false);
  const [editingOrgUnit, setEditingOrgUnit] = useState<OrgUnit | undefined>();
  const [editingLibrary, setEditingLibrary] = useState<LibraryType | undefined>();
  const [parentIdForNew, setParentIdForNew] = useState<number | null>(null);
  const [orgUnitIdForLib, setOrgUnitIdForLib] = useState<number | undefined>();

  const { data: orgUnits = [], isLoading: loadingUnits } = useQuery({
    queryKey: ["org-units"],
    queryFn: orgUnitsApi.getAll,
  });

  const { data: libraries = [], isLoading: loadingLibs } = useQuery({
    queryKey: ["libraries"],
    queryFn: librariesApi.getAll,
  });

  const deleteOrgMutation = useMutation({
    mutationFn: orgUnitsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-units"] });
      toast.success("Organizational unit deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteLibMutation = useMutation({
    mutationFn: librariesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["libraries"] });
      toast.success("Library deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rootUnits = orgUnits.filter(u => u.parentId === null);

  const handleAddRootUnit = () => {
    setEditingOrgUnit(undefined);
    setParentIdForNew(null);
    setOrgDialogOpen(true);
  };

  const handleAddChildUnit = (parentId: number) => {
    setEditingOrgUnit(undefined);
    setParentIdForNew(parentId);
    setOrgDialogOpen(true);
  };

  const handleEditUnit = (unit: OrgUnit) => {
    setEditingOrgUnit(unit);
    setParentIdForNew(null);
    setOrgDialogOpen(true);
  };

  const handleDeleteUnit = (id: number) => {
    if (confirm("Are you sure you want to delete this organizational unit? This cannot be undone.")) {
      deleteOrgMutation.mutate(id);
    }
  };

  const handleAddLibrary = (orgUnitId?: number) => {
    setEditingLibrary(undefined);
    setOrgUnitIdForLib(orgUnitId);
    setLibDialogOpen(true);
  };

  const handleEditLibrary = (lib: LibraryType) => {
    setEditingLibrary(lib);
    setLibDialogOpen(true);
  };

  const handleDeleteLibrary = (id: number) => {
    if (confirm("Are you sure you want to delete this library? This cannot be undone.")) {
      deleteLibMutation.mutate(id);
    }
  };

  const isLoading = loadingUnits || loadingLibs;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Organizations & Libraries
          </h1>
          <p className="text-muted-foreground">
            Manage your organizational hierarchy and library branches.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Organizational Hierarchy
                </CardTitle>
                <CardDescription>
                  Define your organization structure: University → Campus → College → Department.
                  Each unit can have libraries and child units.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Dialog open={libDialogOpen} onOpenChange={setLibDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => handleAddLibrary()}
                      data-testid="button-add-library"
                    >
                      <Library className="h-4 w-4" />
                      Add Library
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <LibraryDialog 
                      library={editingLibrary}
                      orgUnits={orgUnits}
                      onClose={() => {
                        setLibDialogOpen(false);
                        setEditingLibrary(undefined);
                      }}
                    />
                  </DialogContent>
                </Dialog>
                
                <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      className="gap-2"
                      onClick={handleAddRootUnit}
                      data-testid="button-add-org-unit"
                    >
                      <Plus className="h-4 w-4" />
                      Add Unit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <OrgUnitDialog 
                      orgUnit={editingOrgUnit}
                      parentId={parentIdForNew}
                      onClose={() => {
                        setOrgDialogOpen(false);
                        setEditingOrgUnit(undefined);
                        setParentIdForNew(null);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : rootUnits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No organizational units configured yet.</p>
                <p className="text-sm">Start by adding your university or top-level organization.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {rootUnits.map(unit => (
                  <OrgTreeNode
                    key={unit.id}
                    unit={unit}
                    allUnits={orgUnits}
                    libraries={libraries}
                    onEditUnit={handleEditUnit}
                    onDeleteUnit={handleDeleteUnit}
                    onAddChild={handleAddChildUnit}
                    onEditLibrary={handleEditLibrary}
                    onDeleteLibrary={handleDeleteLibrary}
                    onAddLibrary={handleAddLibrary}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Library className="h-5 w-5" />
              Libraries Summary
            </CardTitle>
            <CardDescription>
              Overview of all libraries across your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : libraries.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No libraries configured. Add libraries to organizational units above.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {libraries.map((lib) => {
                    const orgUnit = orgUnits.find(u => u.id === lib.orgUnitId);
                    return (
                      <TableRow key={lib.id} data-testid={`row-lib-${lib.id}`}>
                        <TableCell className="font-mono text-sm">{lib.code}</TableCell>
                        <TableCell className="font-medium">{lib.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {orgUnit?.name || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={lib.isActive ? "default" : "secondary"}
                            className={lib.isActive ? "bg-green-100 text-green-800" : ""}
                          >
                            {lib.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/organizations/libraries/${lib.id}`}>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              title="View Dashboard"
                              data-testid={`button-table-dashboard-lib-${lib.id}`}
                            >
                              <LayoutDashboard className="h-4 w-4 text-blue-500" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEditLibrary(lib)}
                            data-testid={`button-edit-lib-${lib.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteLibrary(lib.id)}
                            data-testid={`button-delete-lib-${lib.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
