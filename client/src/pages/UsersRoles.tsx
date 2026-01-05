import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Shield, User, MoreVertical, Lock, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, Role, MODULES_LIST, ACTIONS_LIST, ModuleVisibility } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

const mockDepartments = ["IT", "Sales", "Weighbridge", "Finance", "Inventory", "Production", "Logistics"];

export default function UsersRoles() {
  const { 
    users, 
    roles, 
    addUser, 
    updateUser, 
    deleteUser, 
    toggleUserStatus, 
    rolePermissions, 
    updateRolePermissions,
    moduleVisibility,
    updateModuleVisibility,
    availablePermissions
  } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false);
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<Role>("Admin");
  
  // Form States
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Operator" as Role, department: "IT" });

  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredUsers = users.filter(
    (user) =>
      (user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (roleFilter === "all" || user.role === roleFilter) &&
      (deptFilter === "all" || user.department === deptFilter) &&
      (statusFilter === "all" || user.status === statusFilter)
  );

  const handleSelectAllPermissions = () => {
    const allPermissionIds = MODULES_LIST.flatMap(module => 
      ACTIONS_LIST.map(action => `${module.toLowerCase()}_${action.toLowerCase()}`)
    );
    
    const currentPermissions = rolePermissions[selectedRoleForPermissions] || [];
    
    // If all permissions are already selected (or more), deselect all. Otherwise select all.
    // Note: checking length is a simple heuristic. 
    const isAllSelected = allPermissionIds.every(id => currentPermissions.includes(id));

    if (isAllSelected) {
       updateRolePermissions(selectedRoleForPermissions, []);
       toast({ title: "Permissions Updated", description: `All permissions removed for ${selectedRoleForPermissions}.` });
    } else {
       updateRolePermissions(selectedRoleForPermissions, allPermissionIds);
       toast({ title: "Permissions Updated", description: `All permissions granted to ${selectedRoleForPermissions}.` });
    }
  };

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email) {
      toast({ variant: "destructive", title: "Error", description: "Name and Email are required" });
      return;
    }
    addUser(newUser);
    setIsAddUserOpen(false);
    setNewUser({ name: "", email: "", role: "Operator", department: "IT" });
    toast({ title: "Success", description: "User added successfully" });
  };

  const handleUpdateUser = () => {
    if (selectedUser) {
      updateUser(selectedUser.id, { name: selectedUser.name, email: selectedUser.email, department: selectedUser.department });
      setIsEditUserOpen(false);
      toast({ title: "Success", description: "User details updated" });
    }
  };

  const handleChangeRole = () => {
    if (selectedUser) {
      updateUser(selectedUser.id, { role: selectedUser.role });
      setIsChangeRoleOpen(false);
      toast({ title: "Success", description: "User role updated" });
    }
  };

  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // ... (existing state declarations)

  const handleResetPassword = () => {
    if (selectedUser && newPassword) {
      updateUser(selectedUser.id, { password: newPassword });
      toast({ 
        title: "Password Reset", 
        description: `Password for ${selectedUser.name} has been updated.`,
      });
      setIsResetPasswordOpen(false);
      setNewPassword("");
    }
  };

  const handleTogglePermission = (role: Role, permissionId: string) => {
    const currentPermissions = rolePermissions[role] || [];
    const newPermissions = currentPermissions.includes(permissionId)
      ? currentPermissions.filter(id => id !== permissionId)
      : [...currentPermissions, permissionId];
    
    updateRolePermissions(role, newPermissions);
    // toast({ title: "Permissions Updated", description: `Permissions for ${role} have been updated.` });
  };

  const handleToggleModuleAction = (role: Role, module: string, action: string) => {
    const permissionId = `${module.toLowerCase()}_${action.toLowerCase()}`;
    handleTogglePermission(role, permissionId);
  };

  const getPermissionState = (role: Role, module: string, action: string) => {
    const permissionId = `${module.toLowerCase()}_${action.toLowerCase()}`;
    return (rolePermissions[role] || []).includes(permissionId);
  };

  const handleToggleModuleVisibility = (role: Role, module: string, isVisible: boolean) => {
    const currentVisibility = moduleVisibility[role] || {};
    updateModuleVisibility(role, {
      ...currentVisibility,
      [module]: isVisible
    });
    toast({
      title: "Module Visibility Updated",
      description: `${module} is now ${isVisible ? "visible" : "hidden"} in sidebar for ${role}.`
    });
  };

  const getModuleVisibility = (role: Role, module: string): boolean => {
    return (moduleVisibility[role] || {})[module] ?? false;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users & Roles</h1>
          <p className="text-muted-foreground">
            Manage system access, user accounts, and permissions.
          </p>
        </div>
        <Button onClick={() => setIsAddUserOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6 mt-4">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
                <p className="text-xs text-muted-foreground">
                  Active accounts
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Roles</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{roles.length}</div>
                <p className="text-xs text-muted-foreground">
                  System roles defined
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inactive Users</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.filter(u => u.status === "Inactive").length}</div>
                <p className="text-xs text-muted-foreground">
                  Deactivated accounts
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Users List</CardTitle>
              <div className="flex flex-col md:flex-row items-center gap-4 py-4">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Dept" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {mockDepartments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-primary/5">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.department}</TableCell>
                      <TableCell>
                        <Badge
                          variant={user.status === "Active" ? "default" : "secondary"}
                          className={user.status === "Active" ? "bg-green-500 hover:bg-green-600" : ""}
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedUser(user);
                              setIsEditUserOpen(true);
                            }}>
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedUser(user);
                              setIsChangeRoleOpen(true);
                            }}>
                              Change Role
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedUser(user);
                              setIsResetPasswordOpen(true);
                            }}>
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className={user.status === "Active" ? "text-red-600" : "text-green-600"}
                              onClick={() => {
                                toggleUserStatus(user.id);
                                toast({ title: "Status Changed", description: `User marked as ${user.status === "Active" ? "Inactive" : "Active"}` });
                              }}
                            >
                              {user.status === "Active" ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="role-select" className="whitespace-nowrap">Select Role to Edit:</Label>
                <Select 
                  value={selectedRoleForPermissions} 
                  onValueChange={(val: Role) => setSelectedRoleForPermissions(val)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={handleSelectAllPermissions}>
                Toggle All Permissions
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Permissions Matrix: {selectedRoleForPermissions}</CardTitle>
                <CardDescription>
                  Configure access levels and module visibility for {selectedRoleForPermissions}. Changes are saved automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Module / Action</TableHead>
                        {ACTIONS_LIST.map(action => (
                          <TableHead key={action} className="text-center">{action}</TableHead>
                        ))}
                        <TableHead className="text-center">Show in Menu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MODULES_LIST.map((module) => (
                        <TableRow key={module}>
                          <TableCell className="font-medium">{module}</TableCell>
                          {ACTIONS_LIST.map(action => (
                            <TableCell key={`${module}-${action}`} className="text-center">
                              <Checkbox 
                                checked={getPermissionState(selectedRoleForPermissions, module, action)}
                                onCheckedChange={() => handleToggleModuleAction(selectedRoleForPermissions, module, action)}
                                data-testid={`checkbox-${module.toLowerCase()}-${action.toLowerCase()}`}
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            <Switch
                              checked={getModuleVisibility(selectedRoleForPermissions, module)}
                              onCheckedChange={(isVisible) => handleToggleModuleVisibility(selectedRoleForPermissions, module, isVisible)}
                              data-testid={`toggle-menu-${module.toLowerCase()}`}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input 
                id="name" 
                className="col-span-3" 
                value={newUser.name}
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input 
                id="email" 
                className="col-span-3" 
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">Role</Label>
              <Select 
                value={newUser.role} 
                onValueChange={(val: Role) => setNewUser({...newUser, role: val})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dept" className="text-right">Department</Label>
              <Select 
                value={newUser.department}
                onValueChange={(val) => setNewUser({...newUser, department: val})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {mockDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddUser}>Create User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">Name</Label>
                <Input 
                  id="edit-name" 
                  className="col-span-3" 
                  value={selectedUser.name}
                  onChange={(e) => setSelectedUser({...selectedUser, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-email" className="text-right">Email</Label>
                <Input 
                  id="edit-email" 
                  className="col-span-3" 
                  value={selectedUser.email}
                  onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-dept" className="text-right">Department</Label>
                <Select 
                  value={selectedUser.department}
                  onValueChange={(val) => setSelectedUser({...selectedUser, department: val})}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockDepartments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleUpdateUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={isChangeRoleOpen} onOpenChange={setIsChangeRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Select a new role for {selectedUser?.name}. This will update their permissions.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="change-role" className="text-right">Role</Label>
                <Select 
                  value={selectedUser.role} 
                  onValueChange={(val: Role) => setSelectedUser({...selectedUser, role: val})}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleChangeRole}>Update Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-password" className="text-right">New Password</Label>
              <Input 
                id="new-password" 
                type="password"
                className="col-span-3" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleResetPassword}>Set Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
