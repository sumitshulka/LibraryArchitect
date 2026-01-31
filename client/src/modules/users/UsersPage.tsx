import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import type { User } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, MoreHorizontal, Mail, Shield, Users, UserCog, Pencil, Trash2, Building2 } from "lucide-react";

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<'STAFF' | 'PATRON'>('STAFF');
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const queryClient = useQueryClient();

  const { data: staffUsers = [], isLoading: loadingStaff } = useQuery({
    queryKey: ["users", "STAFF"],
    queryFn: () => usersApi.getByCategory('STAFF'),
  });

  const { data: patronUsers = [], isLoading: loadingPatrons } = useQuery({
    queryKey: ["users", "PATRON"],
    queryFn: () => usersApi.getByCategory('PATRON'),
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const users = activeTab === 'STAFF' ? staffUsers : patronUsers;
  const isLoading = activeTab === 'STAFF' ? loadingStaff : loadingPatrons;

  const filteredUsers = users.filter((user) => {
    return (
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getRoleBadge = (role: User['role']) => {
    switch (role) {
      case 'ADMIN': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-none">Admin</Badge>;
      case 'LIBRARIAN': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none">Librarian</Badge>;
      case 'STUDENT': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Student</Badge>;
      case 'FACULTY': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-none">Faculty</Badge>;
      default: return null;
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setAddDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setAddDialogOpen(true);
  };

  const handleDeleteUser = (id: number) => {
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage library staff and patrons separately.</p>
        </div>
        <Button size="sm" className="gap-2" onClick={handleAddUser} data-testid="button-add-user">
          <Plus className="h-4 w-4" />
          Add {activeTab === 'STAFF' ? 'Staff Member' : 'Library User'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'STAFF' | 'PATRON')} className="mt-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="STAFF" className="gap-2" data-testid="tab-staff">
            <UserCog className="h-4 w-4" />
            Library Staff ({staffUsers.length})
          </TabsTrigger>
          <TabsTrigger value="PATRON" className="gap-2" data-testid="tab-patrons">
            <Users className="h-4 w-4" />
            Library Users ({patronUsers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="bg-card rounded-lg border shadow-sm">
            <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={`Search ${activeTab === 'STAFF' ? 'staff' : 'patrons'}...`}
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-users"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredUsers.length} {activeTab === 'STAFF' ? 'staff members' : 'patrons'}
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {activeTab === 'STAFF' ? 'Employee ID' : 'Student/Faculty ID'}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No {activeTab === 'STAFF' ? 'staff members' : 'patrons'} found.
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatarUrl || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.name}</span>
                          {user.erpIntegrationId ? (
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              ERP
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Local</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getRoleBadge(user.role)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {activeTab === 'STAFF' ? (user.employeeId || '-') : (user.studentId || '-')}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        user.status === 'ACTIVE' ? 'text-green-700 bg-green-50' : 
                        user.status === 'SUSPENDED' ? 'text-red-700 bg-red-50' :
                        'text-gray-600 bg-gray-50'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          user.status === 'ACTIVE' ? 'bg-green-500' : 
                          user.status === 'SUSPENDED' ? 'bg-red-500' :
                          'bg-gray-400'
                        }`}></span>
                        {user.status}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {new Date(user.joinedDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${user.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEditUser(user)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" /> Email
                          </DropdownMenuItem>
                          {activeTab === 'STAFF' && (
                            <DropdownMenuItem>
                              <Shield className="mr-2 h-4 w-4" /> Permissions
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <UserDialog 
            category={activeTab}
            user={editingUser}
            onClose={() => {
              setAddDialogOpen(false);
              setEditingUser(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function UserDialog({ 
  category, 
  user, 
  onClose 
}: { 
  category: 'STAFF' | 'PATRON';
  user: User | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [username, setUsername] = useState(user?.username || "");
  const [role, setRole] = useState(user?.role || (category === 'STAFF' ? 'LIBRARIAN' : 'STUDENT'));
  const [status, setStatus] = useState<User['status']>(user?.status || 'ACTIVE');
  const [phone, setPhone] = useState(user?.phone || "");
  const [department, setDepartment] = useState(user?.department || "");
  const [employeeId, setEmployeeId] = useState(user?.employeeId || "");
  const [studentId, setStudentId] = useState(user?.studentId || "");

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created successfully");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated successfully");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !username.trim()) {
      toast.error("Name, email, and username are required");
      return;
    }

    const data = {
      name,
      email,
      username,
      category,
      role: role as User['role'],
      status,
      phone: phone || null,
      department: department || null,
      employeeId: employeeId || null,
      studentId: studentId || null,
    };

    if (user) {
      updateMutation.mutate({ id: user.id, data });
    } else {
      createMutation.mutate(data as any);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {user ? "Edit" : "Add"} {category === 'STAFF' ? 'Staff Member' : 'Library User'}
          {user && (
            user.erpIntegrationId ? (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                ERP User
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Local User</Badge>
            )
          )}
        </DialogTitle>
        <DialogDescription>
          {user ? (
            user.erpIntegrationId 
              ? "This user is managed by ERP. Some fields may not be editable."
              : "Edit local user account details."
          ) : (
            <>
              {category === 'STAFF' 
                ? "Add a new local staff member. ERP staff users should be provisioned via the ERP system."
                : "Add a new local library user. ERP users are provisioned automatically via SSO."}
              <span className="block mt-1 text-xs">
                <Badge variant="outline" className="text-xs mr-1">Local</Badge>
                This will create a local user account.
              </span>
            </>
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="user-name">Full Name *</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              data-testid="input-user-name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="johndoe"
              data-testid="input-username"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="user-email">Email *</Label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            data-testid="input-user-email"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as User['role'])}>
              <SelectTrigger data-testid="select-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {category === 'STAFF' ? (
                  <>
                    <SelectItem value="ADMIN">Administrator</SelectItem>
                    <SelectItem value="LIBRARIAN">Librarian</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="FACULTY">Faculty</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as User['status'])}>
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              data-testid="input-phone"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Computer Science"
              data-testid="input-department"
            />
          </div>
        </div>
        {category === 'STAFF' ? (
          <div className="grid gap-2">
            <Label htmlFor="employee-id">Employee ID</Label>
            <Input
              id="employee-id"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="EMP001"
              data-testid="input-employee-id"
            />
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="student-id">Student/Faculty ID</Label>
            <Input
              id="student-id"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="STU001 or FAC001"
              data-testid="input-student-id"
            />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} data-testid="button-save-user">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
