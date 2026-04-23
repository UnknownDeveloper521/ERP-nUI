import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, Role, ACTIONS_LIST, MODULE_HIERARCHY, constructPermissionId } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Search, Copy, Plus, Settings, Trash, Pencil } from "lucide-react";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { Separator } from "@/components/ui/separator";

interface MatrixItem {
  label: string;
  module: string;
  submodule?: string;
  tab?: string;
  visibilityKey: string;
  isHeader?: boolean;
}

const MATRIX_CONFIG: MatrixItem[] = [
  { label: "General", module: "", visibilityKey: "", isHeader: true },
  { label: "Dashboard", module: "Dashboard", visibilityKey: "Dashboard" },
  { label: "Vendors", module: "Vendors", visibilityKey: "Vendors" },
  { label: "Customers", module: "Customers", visibilityKey: "Customers" },
  
  { label: "Human Resource Management (HRMS)", module: "", visibilityKey: "", isHeader: true },
  { label: "HRMS/Dashboard", module: "HRMS", submodule: "Dashboard", visibilityKey: "HRMS:Dashboard" },
  { label: "HRMS/Core HR", module: "HRMS", submodule: "CoreHR", visibilityKey: "HRMS:CoreHR" },
  { label: "HRMS/Attendance/HR View", module: "HRMS", submodule: "Attendance", tab: "HR View", visibilityKey: "HRMS:Attendance:HR View" },
  { label: "HRMS/Attendance/Bulk Attendance", module: "HRMS", submodule: "Attendance", tab: "Bulk Attendance", visibilityKey: "HRMS:Attendance:Bulk Attendance" },
  { label: "HRMS/Leave Management/Dashboard", module: "HRMS", submodule: "Leave Management", tab: "Dashboard", visibilityKey: "HRMS:Leave Management:Dashboard" },
  { label: "HRMS/Leave Management/Leave Entry", module: "HRMS", submodule: "Leave Management", tab: "Leave Entry", visibilityKey: "HRMS:Leave Management:Leave Entry" },
  { label: "HRMS/Leave Management/Calendar", module: "HRMS", submodule: "Leave Management", tab: "Calendar", visibilityKey: "HRMS:Leave Management:Calendar" },
  { label: "HRMS/Payroll Management", module: "HRMS", submodule: "Payroll Management", visibilityKey: "HRMS:Payroll Management" },
  { label: "HRMS/Worker Payrolls", module: "HRMS", submodule: "Worker Payrolls", visibilityKey: "HRMS:Worker Payrolls" },
  { label: "HRMS/Holiday", module: "HRMS", submodule: "Holiday", visibilityKey: "HRMS:Holiday" },

  { label: "Inventory Management", module: "", visibilityKey: "", isHeader: true },
  { label: "Inventory/Dashboard", module: "Inventory", submodule: "Dashboard", visibilityKey: "Inventory:Dashboard" },
  { label: "Inventory/Materials/Material Requests", module: "Inventory", submodule: "Materials", tab: "Material Requests", visibilityKey: "Inventory:Materials:Material Requests" },
  { label: "Inventory/Materials/WH Receive", module: "Inventory", submodule: "Materials", tab: "WH Receive", visibilityKey: "Inventory:Materials:WH Receive" },
  { label: "Inventory/GRN", module: "Inventory", submodule: "GRN", visibilityKey: "Inventory:GRN" },
  { label: "Inventory/Dispatch", module: "Inventory", submodule: "Dispatch", visibilityKey: "Inventory:Dispatch" },
  { label: "Inventory/Material Ledger", module: "Inventory", submodule: "Material Ledger", visibilityKey: "Inventory:Material Ledger" },
  { label: "Inventory/Material Requisitions", module: "Inventory", submodule: "Material Requisitions", visibilityKey: "Inventory:Material Requisitions" },

  { label: "Production & Manufacturing", module: "", visibilityKey: "", isHeader: true },
  { label: "Production/BOM", module: "Production", submodule: "BOM", visibilityKey: "Production:BOM" },
  { label: "Production/Production Plan", module: "Production", submodule: "Production Plan", visibilityKey: "Production:Production Plan" },
  { label: "Production/My Request", module: "Production", submodule: "My Request", visibilityKey: "Production:My Request" },
  { label: "Production/Batch Tracking", module: "Production", submodule: "Batch Tracking", visibilityKey: "Production:Batch Tracking" },
  { label: "Production/Material Release", module: "Production", submodule: "Material Release", visibilityKey: "Production:Material Release" },

  { label: "Quality Control", module: "", visibilityKey: "", isHeader: true },
  { label: "Quality Check/Dashboard", module: "QualityCheck", submodule: "Dashboard", visibilityKey: "QualityCheck:Dashboard" },
  { label: "Quality Check/Batch QC", module: "QualityCheck", submodule: "Batch QC", visibilityKey: "QualityCheck:Batch QC" },

  { label: "Sales & CRM", module: "", visibilityKey: "", isHeader: true },
  { label: "Sales/Dashboard", module: "Sales", submodule: "Dashboard", visibilityKey: "Sales:Dashboard" },
  { label: "Sales/Quotations", module: "Sales", submodule: "Quotations", visibilityKey: "Sales:Quotations" },
  { label: "Sales/Sales Order", module: "Sales", submodule: "Sales Order", visibilityKey: "Sales:Sales Order" },
  { label: "Sales/Follow Up", module: "Sales", submodule: "Follow Up", visibilityKey: "Sales:Follow Up" },

  { label: "Purchases & Procurement", module: "", visibilityKey: "", isHeader: true },
  { label: "Procurement/My MR", module: "Purchases", submodule: "My MR", visibilityKey: "Purchases:My MR" },
  { label: "Procurement/MR Execution", module: "Purchases", submodule: "MR Execution", visibilityKey: "Purchases:MR Execution" },
  { label: "Procurement/PO", module: "Purchases", submodule: "PO", visibilityKey: "Purchases:PO" },

  { label: "Service Center", module: "", visibilityKey: "", isHeader: true },
  { label: "Service Center/Warranty Service", module: "ServiceCenter", submodule: "Warranty Service", visibilityKey: "ServiceCenter:Warranty Service" },
  { label: "Service Center/Material Requisition", module: "ServiceCenter", submodule: "Material Requisition", visibilityKey: "ServiceCenter:Material Requisition" },

  { label: "Accounting & Finance", module: "", visibilityKey: "", isHeader: true },
  { label: "Accounting/Invoicing", module: "Accounting", submodule: "Invoicing", visibilityKey: "Accounting:Invoicing" },
  { label: "Accounting/Worker Payments", module: "Accounting", submodule: "Worker Payments", visibilityKey: "Accounting:Worker Payments" },
  { label: "Accounting/Pending Payment", module: "Accounting", submodule: "Pending Payment", visibilityKey: "Accounting:Pending Payment" },

  { label: "System Administration", module: "", visibilityKey: "", isHeader: true },
  { label: "User Management", module: "UserManagement", visibilityKey: "UserManagement" },
  { label: "Roles & Permissions", module: "RolesPermissions", visibilityKey: "RolesPermissions" },
  
  { label: "HR Setup & Masters", module: "", visibilityKey: "", isHeader: true },
  { label: "HR Setup/Assign Employee Salary", module: "HRSetup", submodule: "Assign Employee Salary", visibilityKey: "HRSetup:Assign Employee Salary" },
  { label: "HR Setup/Salary Component", module: "HRSetup", submodule: "Salary Component", visibilityKey: "HRSetup:Salary Component" },
  { label: "HR Setup/Salary Structure", module: "HRSetup", submodule: "Salary Structure", visibilityKey: "HRSetup:Salary Structure" },
  { label: "HR Setup/Pay Period", module: "HRSetup", submodule: "Pay Period", visibilityKey: "HRSetup:Pay Period" },
  { label: "HR Setup/Workers wage Period", module: "HRSetup", submodule: "Workers wage Period", visibilityKey: "HRSetup:Workers wage Period" },

  { label: "Masters", module: "", visibilityKey: "", isHeader: true },
  { label: "Masters/Core", module: "Masters", submodule: "Core", visibilityKey: "Masters:Core" },
  { label: "Masters/Procurement", module: "Masters", submodule: "Procurement", visibilityKey: "Masters:Procurement" },
  { label: "Masters/Inventory", module: "Masters", submodule: "Inventory", visibilityKey: "Masters:Inventory" },
  { label: "Masters/Production", module: "Masters", submodule: "Production", visibilityKey: "Masters:Production" },
];

export default function RolesPermissions() {
  const {
    roles,
    rolePermissions,
    updateRolePermissions,
    moduleVisibility,
    updateModuleVisibility,
    addRole,
    deleteRole,
    renameRole,
  } = useAuth();
  const { toast } = useToast();

  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<Role>("Admin");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [isManageRolesOpen, setIsManageRolesOpen] = useState(false);
  const [tempRoles, setTempRoles] = useState<{ id: string; name: string; isEditing?: boolean }[]>([]);
  const [newRoleInput, setNewRoleInput] = useState("");

  const openManageRoles = () => {
    setTempRoles(roles.map(r => ({ id: r, name: r, isEditing: false })));
    setNewRoleInput("");
    setIsManageRolesOpen(true);
  };

  const handleTempAddRole = () => {
    if (!newRoleInput.trim()) return;
    if (tempRoles.some(r => r.name.toLowerCase() === newRoleInput.trim().toLowerCase())) {
      toast({ title: "Error", description: "Role already exists in the list.", variant: "destructive" });
      return;
    }
    setTempRoles([...tempRoles, { id: `new-${Date.now()}`, name: newRoleInput.trim(), isEditing: false }]);
    setNewRoleInput("");
  };

  const handleSaveRoles = () => {
    // 1. Identify Deletions
    const newNames = tempRoles.map(r => r.name);
    roles.forEach(oldRole => {
      if (!newNames.includes(oldRole) && oldRole !== "Admin") {
        deleteRole(oldRole);
      }
    });

    // 2. Identify Renames and Additions
    tempRoles.forEach(tr => {
      if (!roles.includes(tr.name)) {
        if (roles.includes(tr.id)) {
          renameRole(tr.id, tr.name);
        } else {
          addRole(tr.name);
        }
      }
    });

    setIsManageRolesOpen(false);
    toast({ title: "Roles Updated", description: "All role changes have been saved successfully." });
  };


  const filteredMatrix = MATRIX_CONFIG.filter(item => {
    if (item.isHeader) return true; // Always show headers if there are matches in their group
    return item.label.toLowerCase().includes(searchQuery.toLowerCase());
  }).filter((item, index, array) => {
    // Second pass to remove empty headers
    if (item.isHeader) {
      const nextItem = array[index + 1];
      if (!nextItem || nextItem.isHeader) return false;
    }
    return true;
  });

  // Helper to construct Permission ID for all levels
  const getFullPermissionId = (item: MatrixItem, action: string) => {
    let id = item.module.toLowerCase();
    if (item.submodule) {
      id += `_${item.submodule.toLowerCase().replace(/\s+/g, '')}`;
    }
    if (item.tab) {
      id += `_${item.tab.toLowerCase().replace(/\s+/g, '')}`;
    }
    id += `_${action.toLowerCase()}`;
    return id;
  };

  const getPermissionState = (role: Role, item: MatrixItem, action: string) => {
    const permissionId = getFullPermissionId(item, action);
    const permissions = rolePermissions[role] || [];
    return permissions.includes(permissionId);
  };

  const isItemVisible = (role: Role, item: MatrixItem) => {
    return (moduleVisibility[role] || {})[item.visibilityKey] ?? false;
  };

  const handleToggleModuleVisibility = (role: Role, item: MatrixItem, isVisible: boolean) => {
    const currentVisibility = moduleVisibility[role] || {};
    updateModuleVisibility(role, {
      ...currentVisibility,
      [item.visibilityKey]: isVisible
    });
  };

  const handleTogglePermission = (role: Role, item: MatrixItem, action: string) => {
    const permissionId = getFullPermissionId(item, action);
    const currentPermissions = rolePermissions[role] || [];

    const newPermissions = currentPermissions.includes(permissionId)
      ? currentPermissions.filter(id => id !== permissionId)
      : [...currentPermissions, permissionId];

    updateRolePermissions(role, newPermissions);
  };

  const handleSelectAllPermissions = () => {
    const allIds: string[] = [];

    MATRIX_CONFIG.forEach(item => {
      if (!isItemVisible(selectedRoleForPermissions, item)) return;
      ACTIONS_LIST.forEach(action => {
        allIds.push(getFullPermissionId(item, action));
      });
    });

    const currentPermissions = rolePermissions[selectedRoleForPermissions] || [];
    const isAllSelected = allIds.every(id => currentPermissions.includes(id));

    if (isAllSelected) {
      const newPermissions = currentPermissions.filter(id => !allIds.includes(id));
      updateRolePermissions(selectedRoleForPermissions, newPermissions);
    } else {
      const newPermissions = Array.from(new Set([...currentPermissions, ...allIds]));
      updateRolePermissions(selectedRoleForPermissions, newPermissions);
    }
  };

  const isColumnSelected = (action: string) => {
    let totalVisible = 0;
    let totalSelected = 0;

    MATRIX_CONFIG.forEach(item => {
      if (isItemVisible(selectedRoleForPermissions, item)) {
        totalVisible++;
        if ((rolePermissions[selectedRoleForPermissions] || []).includes(getFullPermissionId(item, action))) {
          totalSelected++;
        }
      }
    });

    return totalVisible > 0 && totalVisible === totalSelected;
  };

  const handleToggleColumnPermission = (action: string) => {
    const targetIds: string[] = [];
    MATRIX_CONFIG.forEach(item => {
      if (isItemVisible(selectedRoleForPermissions, item)) {
        targetIds.push(getFullPermissionId(item, action));
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

  const renderRow = (item: MatrixItem) => {
    if (item.isHeader) {
      return (
        <TableRow key={item.label} className="bg-muted/40 hover:bg-muted/40">
          <TableCell colSpan={6} className="font-bold py-3 text-primary uppercase tracking-wider text-xs">
            {item.label}
          </TableCell>
        </TableRow>
      );
    }

    const isVisible = isItemVisible(selectedRoleForPermissions, item);

    return (
      <TableRow key={item.label} className={!isVisible ? "opacity-60 bg-muted/50" : ""}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <span>{item.label}</span>
          </div>
        </TableCell>
        {ACTIONS_LIST.filter(a => ["Create", "Edit", "Delete", "Print"].includes(a)).map(action => (
          <TableCell key={action} className="text-center align-middle">
            <div className="flex items-center justify-center w-full">
              <Checkbox
                checked={getPermissionState(selectedRoleForPermissions, item, action)}
                onCheckedChange={() => handleTogglePermission(selectedRoleForPermissions, item, action)}
                disabled={!isVisible}
              />
            </div>
          </TableCell>
        ))}
        <TableCell className="text-center align-middle">
          <div className="flex items-center justify-center w-full">
            <Switch
              checked={isVisible}
              onCheckedChange={(val) => handleToggleModuleVisibility(selectedRoleForPermissions, item, val)}
            />
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
        <p className="text-muted-foreground text-sm">Configure access levels and module visibility for each system role.</p>
      </div>

      <div className="flex flex-col md:flex-row items-end justify-between gap-4 bg-card p-4 rounded-lg border shadow-sm mb-6">
        <div className="flex items-end gap-6 flex-1 w-full md:w-auto">
          <div className="flex-1 min-w-[200px] max-w-sm space-y-1.5">
            <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
              Search
            </Label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              <Input 
                placeholder="Search modules..." 
                className="pl-9 h-10 border-input bg-background focus-visible:ring-primary/20 focus-visible:border-primary transition-all rounded-md shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="min-w-[200px] space-y-1.5">
            <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
              Role
            </Label>
            <div className="flex items-center gap-2">
              <SearchableSelect
                options={roles.map(r => ({ label: r, value: r }))}
                value={selectedRoleForPermissions}
                onChange={(val) => setSelectedRoleForPermissions(val as Role)}
                className="h-10 w-[200px]"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-0.5 pt-4 md:pt-0">
          <Dialog open={isManageRolesOpen} onOpenChange={setIsManageRolesOpen}>
            <Button 
              variant="default" 
              onClick={openManageRoles}
              className="flex-1 md:flex-none gap-2 shadow-sm"
            >
              <Settings className="h-4 w-4" />
              Manage Roles
            </Button>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Manage System Roles
                </DialogTitle>
                <DialogDescription>
                  Create, rename, or delete roles. Changes will be applied when you click Save.
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4 space-y-6">
                {/* Add Section */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">New Role Name</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g. Sales Executive" 
                      value={newRoleInput}
                      onChange={(e) => setNewRoleInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleTempAddRole()}
                    />
                    <Button onClick={handleTempAddRole} className="shrink-0">
                      Add Role
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* List Section */}
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Existing Roles</Label>
                  {tempRoles.map((role, index) => (
                    <div key={role.id} className="flex items-center justify-between gap-3 p-2 rounded-md border bg-muted/30 group">
                      <div className="flex-1">
                        {role.isEditing && role.id !== "Admin" ? (
                          <Input 
                            value={role.name}
                            onChange={(e) => {
                              const newList = [...tempRoles];
                              newList[index].name = e.target.value;
                              setTempRoles(newList);
                            }}
                            autoFocus
                            className="h-8 py-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const newList = [...tempRoles];
                                newList[index].isEditing = false;
                                setTempRoles(newList);
                              }
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{role.name}</span>
                            {role.id === "Admin" && (
                              <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-tighter">System</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {role.id !== "Admin" && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => {
                                const newList = [...tempRoles];
                                newList[index].isEditing = !newList[index].isEditing;
                                setTempRoles(newList);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setTempRoles(tempRoles.filter((_, i) => i !== index))}
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsManageRolesOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveRoles}>Save All Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            onClick={handleSelectAllPermissions} 
            className="flex-1 md:flex-none hover:bg-muted"
          >
            Toggle All
          </Button>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Permissions Matrix: {selectedRoleForPermissions}</CardTitle>
          <CardDescription>
            Changes are saved automatically as you toggle permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[350px]">Module / Action</TableHead>
                  {ACTIONS_LIST.filter(a => ["Create", "Edit", "Delete", "Print"].includes(a)).map(action => (
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
                {filteredMatrix.length > 0 ? (
                  filteredMatrix.map((item) => renderRow(item))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No modules found matching your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
            <div className="flex justify-end mt-6">
              <Button 
                onClick={() => toast({ title: "Success", description: `Permissions for ${selectedRoleForPermissions} saved successfully.` })}
                className="px-6"
              >
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

    </div>
  );
}
