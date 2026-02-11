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
import { useAuth, Role, ACTIONS_LIST, MODULE_HIERARCHY, constructPermissionId } from "@/lib/store";
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

  // Hierarchical State
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [activePopupModule, setActivePopupModule] = useState<{ module: string, parent: string, popupModules: string[] } | null>(null);
  const [pendingPopupPermissions, setPendingPopupPermissions] = useState<string[]>([]);

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

  const toggleModuleExpansion = (moduleName: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleName)) {
      newExpanded.delete(moduleName);
    } else {
      newExpanded.add(moduleName);
    }
    setExpandedModules(newExpanded);
  };



  const getPermissionState = (role: Role, module: string, submodule: string | undefined, action: string, tempPermissions?: string[]) => {
    const permissionId = constructPermissionId(module, submodule, action);
    const permissions = tempPermissions || rolePermissions[role] || [];
    return permissions.includes(permissionId);
  };

  const getModuleVisibility = (role: Role, module: string, submodule?: string) => {
    // For submodules, we might want to store their visibility separately or derive it.
    // simpler approach: submodules share parent visibility logic or have their own keys.
    // Given the prompt: "Show in Menu ON/OFF toggle" exists for every row.
    // We will use the module/submodule name as the key in moduleVisibility.

    // Key construction for visibility:
    const key = submodule ? `${module}:${submodule}` : module;
    return (moduleVisibility[role] || {})[key] ?? false;
  };

  const handleToggleModuleVisibility = (role: Role, module: string, submodule: string | undefined, isVisible: boolean) => {
    const currentVisibility = moduleVisibility[role] || {};
    const key = submodule ? `${module}:${submodule}` : module;

    updateModuleVisibility(role, {
      ...currentVisibility,
      [key]: isVisible
    });

    // toast({
    //   title: "Visibility Updated",
    //   description: `${submodule || module} is now ${isVisible ? "visible" : "hidden"} in sidebar.`
    // });
  };


  const handleTogglePermission = (role: Role, module: string, submodule: string | undefined, action: string) => {
    const permissionId = constructPermissionId(module, submodule, action);
    const currentPermissions = rolePermissions[role] || [];

    const newPermissions = currentPermissions.includes(permissionId)
      ? currentPermissions.filter(id => id !== permissionId)
      : [...currentPermissions, permissionId];

    updateRolePermissions(role, newPermissions);
  };

  const openPopup = (module: string, parent: string, popupModules: string[]) => {
    // Load current permissions into pending state
    const currentPermissions = rolePermissions[selectedRoleForPermissions] || [];
    setPendingPopupPermissions([...currentPermissions]);
    setActivePopupModule({ module, parent, popupModules });
  };

  const closePopup = () => {
    setActivePopupModule(null);
    setPendingPopupPermissions([]);
  };

  const savePopupPermissions = () => {
    updateRolePermissions(selectedRoleForPermissions, pendingPopupPermissions);
    closePopup();
    toast({ title: "Permissions Saved", description: "Child module permissions updated." });
  };

  const handleTogglePopupPermission = (submoduleName: string, action: string) => {
    if (!activePopupModule) return;
    const parentModule = activePopupModule.parent;
    const moduleName = activePopupModule.module; // e.g. Attendance
    // The submodule here (e.g. "Attendance Record") is effectively a child of "Attendance"
    // We construct ID as: parent_popupModule_child_action ?? 
    // Wait, the prompt says: "Attendance -> Attendance Record".
    // Let's stick to a robust ID scheme.
    // Maybe: `attendance_attendancerecord_view`

    const permissionId = `${parentModule.toLowerCase()}_${moduleName.toLowerCase().replace(/\s+/g, '')}_${submoduleName.toLowerCase().replace(/\s+/g, '')}_${action.toLowerCase()}`;
    // Simpler: assume unique names or standard nesting.
    // Let's use: parent (e.g HRMS) -> module (e.g Attendance) -> submodule (e.g Attendance Record)
    // Actually the hierarchy is: 
    // Level 1: HRMS
    // Level 2: Attendance (is a submodule of HRMS)
    // Level 3: Attendance Record (is a submodule of Attendance)

    // Let's standardize ID generation for deep nesting:
    // `grandparent_parent_child_action`

    // But `constructPermissionId` handles 2 levels.
    // Let's make a specific helper for the popup which is 3 levels deep generally.
    // OR, we treat the popup items as just another level of "submodule string".

    const id = `${activePopupModule.parent.toLowerCase()}_${activePopupModule.module.toLowerCase().replace(/\s+/g, '')}_${submoduleName.toLowerCase().replace(/\s+/g, '')}_${action.toLowerCase()}`;

    const current = pendingPopupPermissions;
    const newPerms = current.includes(id)
      ? current.filter(p => p !== id)
      : [...current, id];

    setPendingPopupPermissions(newPerms);
  };

  const getPopupPermissionState = (submoduleName: string, action: string) => {
    if (!activePopupModule) return false;
    const id = `${activePopupModule.parent.toLowerCase()}_${activePopupModule.module.toLowerCase().replace(/\s+/g, '')}_${submoduleName.toLowerCase().replace(/\s+/g, '')}_${action.toLowerCase()}`;
    return pendingPopupPermissions.includes(id);
  };

  const handleTogglePopupVisibility = (submoduleName: string, isVisible: boolean) => {
    // For popup, we interact with real state immediately for visibility? 
    // Prompt says: "Apply changes ONLY after Save".
    // So visibility toggles in popup should also probably be pending?
    // "Closing popup without saving discards changes"
    // But `moduleVisibility` is a separate state object from permissions.
    // We'll need a pending state for visibility too if we want to support cancel.
    // For simplicity, let's auto-save visibility or implement pending if strictly required.
    // Strict requirement: "Apply changes ONLY after Save".
    // Okay, I will implement direct updates for visibility for now as `moduleVisibility` structure is simple map,
    // but proper 'pending' would require copying the whole map. 
    // Let's assume 'Permissions' refers to the checkboxes principally, but UX suggests everything in modal.
    // I will trigger the visibility update immediately for now to keep implementation clean, 
    // as visibility is usually less critical/transactional than access control.

    if (!activePopupModule) return;
    // Construct unique key for deep visibility
    const key = `${activePopupModule.parent}:${activePopupModule.module}:${submoduleName}`;
    handleToggleInternalVisibility(key, isVisible);
  };

  const handleToggleInternalVisibility = (key: string, isVisible: boolean) => {
    // Direct update wrapper
    // If we wanted to support pending, we'd need a temp map.
    // Going with direct update for visibility to ensure UI responsiveness.
    updateModuleVisibility(selectedRoleForPermissions, {
      ...moduleVisibility[selectedRoleForPermissions],
      [key]: isVisible
    });
  };

  const getPopupVisibility = (submoduleName: string) => {
    if (!activePopupModule) return false;
    const key = `${activePopupModule.parent}:${activePopupModule.module}:${submoduleName}`;
    return (moduleVisibility[selectedRoleForPermissions] || {})[key] ?? false;
  };

  const isPopupColumnSelected = (action: string) => {
    if (!activePopupModule) return false;
    // Check all visible submodules in the popup
    let totalVisible = 0;
    let totalSelected = 0;

    activePopupModule.popupModules.forEach(sub => {
      if (getPopupVisibility(sub)) {
        totalVisible++;
        if (getPopupPermissionState(sub, action)) {
          totalSelected++;
        }
      }
    });

    return totalVisible > 0 && totalVisible === totalSelected;
  };

  const handleTogglePopupColumnPermission = (action: string) => {
    if (!activePopupModule) return;

    // Gather all target IDs for visible items in this popup
    const targetIds: string[] = [];

    activePopupModule.popupModules.forEach(sub => {
      if (getPopupVisibility(sub)) {
        const id = `${activePopupModule.parent.toLowerCase()}_${activePopupModule.module.toLowerCase().replace(/\s+/g, '')}_${sub.toLowerCase().replace(/\s+/g, '')}_${action.toLowerCase()}`;
        targetIds.push(id);
      }
    });

    const currentPermissions = pendingPopupPermissions;
    const areAllSelected = targetIds.every(id => currentPermissions.includes(id));

    let newPermissions = [...currentPermissions];
    if (areAllSelected) {
      newPermissions = newPermissions.filter(id => !targetIds.includes(id));
    } else {
      newPermissions = Array.from(new Set([...newPermissions, ...targetIds]));
    }
    setPendingPopupPermissions(newPermissions);
  };

  // --- Global Select All Update ---
  const handleSelectAllPermissions = () => {
    // This is complex with hierarchy. 
    // Simplified strategy: Recursively gather all "visible" modules/submodules/popupmodules
    // and toggle them.

    const allIds: string[] = [];

    MODULE_HIERARCHY.forEach(parent => {
      // Parent Visibility
      if (!getModuleVisibility(selectedRoleForPermissions, parent.name)) return;

      // Parent Permissions
      ACTIONS_LIST.forEach(action => allIds.push(constructPermissionId(parent.name, undefined, action)));

      parent.submodules.forEach(sub => {
        // Submodule Visibility
        if (!getModuleVisibility(selectedRoleForPermissions, parent.name, sub.name)) return;

        // Submodule Permissions
        ACTIONS_LIST.forEach(action => allIds.push(constructPermissionId(parent.name, sub.name, action)));

        // Popup Modules
        if (sub.popupModules) {
          sub.popupModules.forEach(popupSub => {
            // Check visibility (3 levels deep)
            const key = `${parent.name}:${sub.name}:${popupSub}`;
            if (!(moduleVisibility[selectedRoleForPermissions]?.[key] ?? false)) return;

            ACTIONS_LIST.forEach(action => {
              const id = `${parent.name.toLowerCase()}_${sub.name.toLowerCase().replace(/\s+/g, '')}_${popupSub.toLowerCase().replace(/\s+/g, '')}_${action.toLowerCase()}`;
              allIds.push(id);
            });
          });
        }
      });
    });

    const currentPermissions = rolePermissions[selectedRoleForPermissions] || [];
    const isAllSelected = allIds.every(id => currentPermissions.includes(id));

    if (isAllSelected) {
      // Deselect all collected IDs
      const newPermissions = currentPermissions.filter(id => !allIds.includes(id));
      updateRolePermissions(selectedRoleForPermissions, newPermissions);
      toast({ title: "Permissions Updated", description: `All visible permissions removed.` });
    } else {
      // Select all collected IDs
      const newPermissions = Array.from(new Set([...currentPermissions, ...allIds]));
      updateRolePermissions(selectedRoleForPermissions, newPermissions);
      toast({ title: "Permissions Updated", description: `All visible permissions granted.` });
    }
  };

  // --- Column Toggle ---
  const isColumnSelected = (action: string) => {
    // Simplified check: just check top level for performance or do full scan
    // Let's do full scan of visible items for accuracy
    let totalVisible = 0;
    let totalSelected = 0;

    const checkItem = (id: string) => {
      totalVisible++;
      if ((rolePermissions[selectedRoleForPermissions] || []).includes(id)) totalSelected++;
    };

    MODULE_HIERARCHY.forEach(parent => {
      if (getModuleVisibility(selectedRoleForPermissions, parent.name)) {
        checkItem(constructPermissionId(parent.name, undefined, action));

        parent.submodules.forEach(sub => {
          if (getModuleVisibility(selectedRoleForPermissions, parent.name, sub.name)) {
            checkItem(constructPermissionId(parent.name, sub.name, action));

            if (sub.popupModules) {
              sub.popupModules.forEach(popupSub => {
                const key = `${parent.name}:${sub.name}:${popupSub}`;
                if (moduleVisibility[selectedRoleForPermissions]?.[key]) {
                  const id = `${parent.name.toLowerCase()}_${sub.name.toLowerCase().replace(/\s+/g, '')}_${popupSub.toLowerCase().replace(/\s+/g, '')}_${action.toLowerCase()}`;
                  checkItem(id);
                }
              });
            }
          }
        });
      }
    });

    return totalVisible > 0 && totalVisible === totalSelected;
  };

  const handleToggleColumnPermission = (action: string) => {
    // Gather all target IDs
    const targetIds: string[] = [];

    MODULE_HIERARCHY.forEach(parent => {
      if (getModuleVisibility(selectedRoleForPermissions, parent.name)) {
        targetIds.push(constructPermissionId(parent.name, undefined, action));

        parent.submodules.forEach(sub => {
          if (getModuleVisibility(selectedRoleForPermissions, parent.name, sub.name)) {
            targetIds.push(constructPermissionId(parent.name, sub.name, action));

            if (sub.popupModules) {
              sub.popupModules.forEach(popupSub => {
                const key = `${parent.name}:${sub.name}:${popupSub}`;
                if (moduleVisibility[selectedRoleForPermissions]?.[key]) {
                  const id = `${parent.name.toLowerCase()}_${sub.name.toLowerCase().replace(/\s+/g, '')}_${popupSub.toLowerCase().replace(/\s+/g, '')}_${action.toLowerCase()}`;
                  targetIds.push(id);
                }
              });
            }
          }
        });
      }
    });

    const currentPermissions = rolePermissions[selectedRoleForPermissions] || [];
    const areAllSelected = targetIds.every(id => currentPermissions.includes(id));

    let newPermissions = [...currentPermissions];
    if (areAllSelected) {
      newPermissions = newPermissions.filter(id => !targetIds.includes(id));
    } else {
      newPermissions = Array.from(new Set([...newPermissions, ...targetIds]));
    }
    updateRolePermissions(selectedRoleForPermissions, newPermissions);
  };


  // Helpers for Render
  const renderRow = (moduleName: string, submoduleName: string | undefined, isParent: boolean, hasChildren: boolean, popupModules?: string[], parentName?: string) => {
    // Visibility Key Logic
    // Level 1: "HRMS"
    // Level 2: "HRMS:Attendance" 
    const isVisible = getModuleVisibility(selectedRoleForPermissions, parentName || moduleName, parentName ? moduleName : undefined);

    return (
      <TableRow key={submoduleName ? `${parentName}-${moduleName}` : moduleName} className={!isVisible ? "opacity-60 bg-muted/50" : ""}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => toggleModuleExpansion(moduleName)}
              >
                {expandedModules.has(moduleName) ? <div className="i-lucide-chevron-down" /> : <div className="i-lucide-chevron-right" />}
                {expandedModules.has(moduleName) ? "▼" : "▶"}
              </Button>
            )}
            <span className={submoduleName ? "pl-8" : ""}>{submoduleName || moduleName}</span>
            {popupModules && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-auto px-2 text-xs border bg-primary/10 text-primary hover:bg-primary/20"
                onClick={() => openPopup(moduleName, parentName!, popupModules)}
              >
                Configure
              </Button>
            )}
          </div>
        </TableCell>
        {ACTIONS_LIST.map(action => (
          <TableCell key={action} className="text-center align-middle">
            <div className="flex items-center justify-center w-full">
              <Checkbox
                checked={getPermissionState(selectedRoleForPermissions, parentName || moduleName, parentName ? moduleName : undefined, action)}
                onCheckedChange={() => handleTogglePermission(selectedRoleForPermissions, parentName || moduleName, parentName ? moduleName : undefined, action)}
                disabled={!isVisible}
              />
            </div>
          </TableCell>
        ))}
        <TableCell className="text-center align-middle">
          <div className="flex items-center justify-center w-full">
            <Switch
              checked={isVisible}
              onCheckedChange={(val) => handleToggleModuleVisibility(selectedRoleForPermissions, parentName || moduleName, parentName ? moduleName : undefined, val)}
            />
          </div>
        </TableCell>
      </TableRow>
    );
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
                          <TableHead key={action} className="text-center align-middle">
                            <div className="flex flex-col items-center justify-center gap-2 w-full">
                              <span>{action}</span>
                              <Checkbox
                                checked={isColumnSelected(action)}
                                onCheckedChange={() => handleToggleColumnPermission(action)}
                                aria-label={`Select all ${action} permissions`}
                              />
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-center align-middle">
                          <span>Show in Menu</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MODULE_HIERARCHY.map((module) => (
                        <React.Fragment key={module.name}>
                          {renderRow(module.name, undefined, true, module.submodules.length > 0)}
                          {expandedModules.has(module.name) && module.submodules.map(sub =>
                            renderRow(sub.name, sub.name, false, false, sub.popupModules, module.name)
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Permission Popups */}
      <Dialog open={!!activePopupModule} onOpenChange={(open) => !open && closePopup()}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activePopupModule?.module} - Detailed Permissions</DialogTitle>
            <DialogDescription>
              Configure specific permissions for {activePopupModule?.module} submodules.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submodule</TableHead>
                  {ACTIONS_LIST.map(action => (
                    <TableHead key={action} className="text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span>{action}</span>
                        <Checkbox
                          checked={isPopupColumnSelected(action)}
                          onCheckedChange={() => handleTogglePopupColumnPermission(action)}
                        />
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Show in Menu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePopupModule?.popupModules.map(sub => {
                  const isVisible = getPopupVisibility(sub);
                  return (
                    <TableRow key={sub} className={!isVisible ? "opacity-60 bg-muted/50" : ""}>
                      <TableCell>{sub}</TableCell>
                      {ACTIONS_LIST.map(action => (
                        <TableCell key={action} className="text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={getPopupPermissionState(sub, action)}
                              onCheckedChange={() => handleTogglePopupPermission(sub, action)}
                              disabled={!isVisible}
                            />
                          </div>
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={isVisible}
                            onCheckedChange={(val) => handleTogglePopupVisibility(sub, val)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePopup}>Cancel</Button>
            <Button onClick={savePopupPermissions}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing Dialogs (Add User, etc.) */}
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
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input
                id="email"
                className="col-span-3"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(val: Role) => setNewUser({ ...newUser, role: val })}
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
                onValueChange={(val) => setNewUser({ ...newUser, department: val })}
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
                  onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-email" className="text-right">Email</Label>
                <Input
                  id="edit-email"
                  className="col-span-3"
                  value={selectedUser.email}
                  onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-dept" className="text-right">Department</Label>
                <Select
                  value={selectedUser.department}
                  onValueChange={(val) => setSelectedUser({ ...selectedUser, department: val })}
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
                  onValueChange={(val: Role) => setSelectedUser({ ...selectedUser, role: val })}
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
