import React, { useState, useEffect, useRef } from "react";
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
import { Search, Copy, Plus, Settings, Trash, Pencil, Loader2 } from "lucide-react";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { Separator } from "@/components/ui/separator";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";

interface MatrixItem {
  label: string;
  module: string;
  action?: string;
  submodule?: string;
  tab?: string;
  visibilityKey: string;
  isHeader?: boolean;
}

const crudSuccessToast = {
  variant: "success" as const,
};

const crudErrorToast = {
  variant: "destructive" as const,
};

const MATRIX_CONFIG: MatrixItem[] = [
  { label: "General", module: "", visibilityKey: "", isHeader: true },
  { label: "Dashboard", module: "General", submodule: "Dashboard", visibilityKey: "Dashboard" },
  { label: "Vendors", module: "General", submodule: "Vendors", visibilityKey: "Vendors" },
  { label: "Customers", module: "General", submodule: "Customers", visibilityKey: "Customers" },
  
  { label: "Human Resource Management (HRMS)", module: "", visibilityKey: "", isHeader: true },
  { label: "HRMS/Dashboard", module: "HRMS", submodule: "Dashboard", visibilityKey: "HRMS:Dashboard" },
  { label: "HRMS/Core HR", module: "HRMS", submodule: "Core HR", visibilityKey: "HRMS:Core HR" },
  { label: "HRMS/Attendance/HR View", module: "HRMS", submodule: "Attendance", tab: "HR View", visibilityKey: "HRMS:Attendance:HR View" },
  { label: "HRMS/Attendance/Bulk Attendance", module: "HRMS", submodule: "Attendance", tab: "Bulk Attendance", visibilityKey: "HRMS:Attendance:Bulk Attendance" },
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
  { label: "Quality Check/Dashboard", module: "Quality_Check", submodule: "Dashboard", visibilityKey: "QualityCheck:Dashboard" },
  { label: "Quality Check/Batch QC", module: "Quality_Check", submodule: "Batch QC", visibilityKey: "QualityCheck:Batch QC" },

  { label: "Sales & CRM", module: "", visibilityKey: "", isHeader: true },
  { label: "Sales/Dashboard", module: "Sales", submodule: "Dashboard", visibilityKey: "Sales:Dashboard" },
  { label: "Sales/Quotations", module: "Sales", submodule: "Quotations", visibilityKey: "Sales:Quotations" },
  { label: "Sales/Sales Order", module: "Sales", submodule: "Sales Order", visibilityKey: "Sales:Sales Order" },
  { label: "Sales/Follow Up", module: "Sales", submodule: "Follow Up", visibilityKey: "Sales:Follow Up" },

  { label: "Purchases & Procurement", module: "", visibilityKey: "", isHeader: true },
  { label: "Procurement/My MR", module: "Procurement", submodule: "My MR", visibilityKey: "Purchases:My MR" },
  { label: "Procurement/MR Execution", module: "Procurement", submodule: "MR Execution", visibilityKey: "Purchases:MR Execution" },
  { label: "Procurement/PO", module: "Procurement", submodule: "PO", visibilityKey: "Purchases:PO" },

  { label: "Service Center", module: "", visibilityKey: "", isHeader: true },
  { label: "Service Center/Warranty Service", module: "Service_Center", submodule: "Warranty Service", visibilityKey: "ServiceCenter:Warranty Service" },
  { label: "Service Center/Material Requisition", module: "Service_Center", submodule: "Material Requisition", visibilityKey: "ServiceCenter:Material Requisition" },

  { label: "Accounting & Finance", module: "", visibilityKey: "", isHeader: true },
  { label: "Accounting/Invoicing", module: "Accounting", submodule: "Invoicing", visibilityKey: "Accounting:Invoicing" },
  { label: "Accounting/Worker Payments", module: "Accounting", submodule: "Worker Payments", visibilityKey: "Accounting:Worker Payments" },
  { label: "Accounting/Pending Payment", module: "Accounting", submodule: "Pending Payment", visibilityKey: "Accounting:Pending Payment" },

  { label: "System Administration", module: "", visibilityKey: "", isHeader: true },
  { label: "Roles & Permissions", module: "System", submodule: "Roles Permissions", visibilityKey: "RolesPermissions" },
  
  { label: "HR Setup & Masters", module: "", visibilityKey: "", isHeader: true },
  { label: "HR Setup/Assign Employee Salary", module: "HR_Setup", submodule: "Assign Employee Salary", visibilityKey: "HRSetup:Assign Employee Salary" },
  { label: "HR Setup/Salary Component", module: "HR_Setup", submodule: "Salary Component", visibilityKey: "HRSetup:Salary Component" },
  { label: "HR_Setup/Salary Structure", module: "HR_Setup", submodule: "Salary Structure", visibilityKey: "HRSetup:Salary Structure" },
  { label: "HR_Setup/Pay Period", module: "HR_Setup", submodule: "Pay Period", visibilityKey: "HRSetup:Pay Period" },
  { label: "HR Setup/Workers wage Period", module: "HR_Setup", submodule: "Workers wage Period", visibilityKey: "HRSetup:Workers wage Period" },

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
    isPermissionsLoading,
    fetchPermissionsForRole,
    saveRolePermissions,
    rolesWithIds,
    fetchRoles,
    updateRolesBulk
  } = useAuth();
  const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
  const permissionModule = "SYSTEM/ROLES_PERMISSIONS";

  if (!isMenuVisible(permissionModule)) {
    return <Unauthorized />;
  }

  const { toast } = useToast();

  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<Role>("Admin");
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    const init = async () => {
      const fetchedRoles = await fetchRoles();
      const roleNames = fetchedRoles.map(r => r.name);
      let roleToFetch = selectedRoleForPermissions;
      
      if (roleNames.length > 0 && !roleNames.includes(selectedRoleForPermissions)) {
        roleToFetch = roleNames[0];
        setSelectedRoleForPermissions(roleToFetch);
      }
      
      if (roleToFetch) {
        await fetchPermissionsForRole(roleToFetch);
      }
      hasInitialized.current = true;
    };
    init();
  }, []);

  useEffect(() => {
    if (hasInitialized.current && selectedRoleForPermissions) {
      fetchPermissionsForRole(selectedRoleForPermissions);
    }
  }, [selectedRoleForPermissions]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [isManageRolesOpen, setIsManageRolesOpen] = useState(false);
  const [tempRoles, setTempRoles] = useState<{ id: string; name: string; isEditing?: boolean }[]>([]);
  const [newRoleInput, setNewRoleInput] = useState("");

  const openManageRoles = async () => {
    const freshRoles = await fetchRoles();
    setTempRoles(freshRoles.map(r => ({ id: r.id.toString(), name: r.name, isEditing: false })));
    setNewRoleInput("");
    setIsManageRolesOpen(true);
  };

  const handleTempAddRole = () => {
    if (!newRoleInput.trim()) return;
    if (tempRoles.some(r => r.name.toLowerCase() === newRoleInput.trim().toLowerCase())) {
      toast({ 
        ...crudErrorToast,
        title: "Error", 
        description: "Role already exists in the list." 
      });
      return;
    }
    setTempRoles([...tempRoles, { id: `new-${Date.now()}`, name: newRoleInput.trim(), isEditing: false }]);
    setNewRoleInput("");
  };

  const handleSaveRoles = async () => {
    const delta: { add: any[]; delete: number[]; edit: any[] } = { add: [], delete: [], edit: [] };
    
    // 1. Identify Deletions (Roles that were in DB but are not in tempRoles)
    const currentTempIds = tempRoles.map(r => r.id.toString());
    rolesWithIds.forEach(role => {
      if (!currentTempIds.includes(role.id.toString()) && role.name !== "Admin") {
        delta.delete.push(role.id);
      }
    });

    // 2. Identify Additions and Edits
    tempRoles.forEach(tr => {
      if (tr.id.toString().startsWith('new-')) {
        delta.add.push({ role_name: tr.name });
      } else {
        const original = rolesWithIds.find(r => r.id.toString() === tr.id.toString());
        if (original && original.name !== tr.name) {
          delta.edit.push({ id: original.id, role_name: tr.name });
        }
      }
    });

    if (delta.add.length === 0 && delta.delete.length === 0 && delta.edit.length === 0) {
      setIsManageRolesOpen(false);
      return;
    }

    try {
      await updateRolesBulk({
        add: delta.add.length > 0 ? delta.add : undefined,
        delete: delta.delete.length > 0 ? delta.delete : undefined,
        edit: delta.edit.length > 0 ? delta.edit : undefined
      });

      // Refresh roles and ensure selected role is still valid
      const freshRoles = await fetchRoles();
      const roleNames = freshRoles.map(r => r.name);
      
      // Determine what the new selected role should be
      let nextRole = selectedRoleForPermissions;
      
      // If it was renamed, find its new name
      const renameEntry = delta.edit.find(e => {
        const original = rolesWithIds.find(r => r.id === e.id);
        return original && original.name === selectedRoleForPermissions;
      });
      if (renameEntry) {
        nextRole = renameEntry.role_name;
      }
      
      // If the role (original or renamed) doesn't exist anymore (deleted), fallback
      if (roleNames.length > 0) {
        if (!roleNames.includes(nextRole)) {
          setSelectedRoleForPermissions(roleNames[0]);
        } else if (nextRole !== selectedRoleForPermissions) {
          setSelectedRoleForPermissions(nextRole);
        }
      } else {
        setSelectedRoleForPermissions("");
      }

      setIsManageRolesOpen(false);
      toast({ 
        ...crudSuccessToast,
        title: "Roles Updated", 
        description: "All role changes have been saved successfully." 
      });
    } catch (err) {
      toast({ 
        ...crudErrorToast,
        title: "Error", 
        description: "Failed to update roles. Please try again."
      });
    }
  };
  
  const handleFinalSave = async () => {
    try {
      await saveRolePermissions(selectedRoleForPermissions);
      toast({ 
        ...crudSuccessToast,
        title: "Success", 
        description: `Permissions for ${selectedRoleForPermissions} saved successfully.` 
      });
    } catch (err) {
      toast({ 
        ...crudErrorToast,
        title: "Error", 
        description: `Failed to save permissions for ${selectedRoleForPermissions}.` 
      });
    }
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

  const getFullPermissionId = (item: MatrixItem, action: string) => {
    let moduleName = item.module.toUpperCase();
    if (item.submodule) {
      moduleName += `/${item.submodule.toUpperCase().replace(/\s+/g, '_')}`;
    }
    if (item.tab) {
      moduleName += `/${item.tab.toUpperCase().replace(/\s+/g, '_')}`;
    }
    return `${moduleName}||${action.toLowerCase()}`;
  };

  const getPermissionState = (role: Role, item: MatrixItem, action: string) => {
    const permissionId = getFullPermissionId(item, action);
    const permissions = rolePermissions[role] || [];
    return permissions.includes(permissionId);
  };

  const isItemVisible = (role: Role, item: MatrixItem) => {
    const permissionId = getFullPermissionId(item, "show_in_menu");
    const permissions = rolePermissions[role] || [];
    return permissions.includes(permissionId);
  };

  const handleToggleModuleVisibility = (role: Role, item: MatrixItem, isVisible: boolean) => {
    const currentVisibility = moduleVisibility[role] || {};
    updateModuleVisibility(role, {
      ...currentVisibility,
      [item.visibilityKey]: isVisible
    });

    let currentPermissions = rolePermissions[role] || [];
    const showMenuId = getFullPermissionId(item, "show_in_menu");

    if (!isVisible) {
      const rowActionIds = ["Create", "Edit", "Delete", "Print", "show_in_menu"]
        .map(action => getFullPermissionId(item, action));
      currentPermissions = currentPermissions.filter(id => !rowActionIds.includes(id));
    } else {
      if (!currentPermissions.includes(showMenuId)) {
        currentPermissions = [...currentPermissions, showMenuId];
      }
    }
    updateRolePermissions(role, currentPermissions);
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

  const isRowAllSelected = (role: Role, item: MatrixItem) => {
    const rowActionIds = ["Create", "Edit", "Delete", "Print"]
      .map(action => getFullPermissionId(item, action));
      
    const currentPermissions = rolePermissions[role] || [];
    return rowActionIds.every(id => currentPermissions.includes(id));
  };

  const handleToggleRowPermissions = (role: Role, item: MatrixItem) => {
    const rowActionIds = ["Create", "Edit", "Delete", "Print"]
      .map(action => getFullPermissionId(item, action));
      
    const currentPermissions = rolePermissions[role] || [];
    const areAllRowSelected = rowActionIds.every(id => currentPermissions.includes(id));
    
    let newPermissions;
    if (areAllRowSelected) {
      newPermissions = currentPermissions.filter(id => !rowActionIds.includes(id));
    } else {
      newPermissions = Array.from(new Set([...currentPermissions, ...rowActionIds]));
    }
    updateRolePermissions(role, newPermissions);
  };

  const getItemsInGroup = (headerItem: MatrixItem) => {
    const headerIndex = MATRIX_CONFIG.indexOf(headerItem);
    if (headerIndex === -1) return [];
    
    const items: MatrixItem[] = [];
    for (let i = headerIndex + 1; i < MATRIX_CONFIG.length; i++) {
      const item = MATRIX_CONFIG[i];
      if (item.isHeader) break;
      items.push(item);
    }
    return items;
  };

  const isGroupAllSelected = (role: Role, headerItem: MatrixItem) => {
    const items = getItemsInGroup(headerItem);
    if (items.length === 0) return false;
    return items.every(item => isRowAllSelected(role, item));
  };

  const handleToggleGroupPermissions = (role: Role, headerItem: MatrixItem) => {
    const items = getItemsInGroup(headerItem);
    const areAllSelected = isGroupAllSelected(role, headerItem);
    
    let currentPermissions = rolePermissions[role] || [];
    let newPermissions = [...currentPermissions];
    
    items.forEach(item => {
      const rowActionIds = ["Create", "Edit", "Delete", "Print"]
        .map(action => getFullPermissionId(item, action));
        
      if (areAllSelected) {
        newPermissions = newPermissions.filter(id => !rowActionIds.includes(id));
      } else {
        newPermissions = Array.from(new Set([...newPermissions, ...rowActionIds]));
      }
    });
    
    updateRolePermissions(role, newPermissions);
  };

  const isGroupActionSelected = (role: Role, headerItem: MatrixItem, action: string) => {
    const items = getItemsInGroup(headerItem);
    if (items.length === 0) return false;
    
    return items.every(item => {
      const permissionId = getFullPermissionId(item, action);
      return (rolePermissions[role] || []).includes(permissionId);
    });
  };

  const handleToggleGroupAction = (role: Role, headerItem: MatrixItem, action: string) => {
    const items = getItemsInGroup(headerItem);
    const areAllSelected = isGroupActionSelected(role, headerItem, action);
    
    let currentPermissions = rolePermissions[role] || [];
    let newPermissions = [...currentPermissions];
    
    items.forEach(item => {
      const permissionId = getFullPermissionId(item, action);
      if (areAllSelected) {
        newPermissions = newPermissions.filter(id => id !== permissionId);
      } else {
        newPermissions = Array.from(new Set([...newPermissions, permissionId]));
      }
    });
    
    updateRolePermissions(role, newPermissions);
  };

  const isGroupVisible = (role: Role, headerItem: MatrixItem) => {
    const items = getItemsInGroup(headerItem);
    if (items.length === 0) return false;
    return items.every(item => isItemVisible(role, item));
  };

  const handleToggleGroupVisibility = (role: Role, headerItem: MatrixItem, isVisible: boolean) => {
    const items = getItemsInGroup(headerItem);
    const currentVisibility = moduleVisibility[role] || {};
    const newVisibility = { ...currentVisibility };
    
    items.forEach(item => {
      newVisibility[item.visibilityKey] = isVisible;
    });
    
    updateModuleVisibility(role, newVisibility);

    let currentPermissions = rolePermissions[role] || [];
    const allRowActionIds: string[] = [];
    items.forEach(item => {
      ["Create", "Edit", "Delete", "Print", "show_in_menu"].forEach(action => {
        allRowActionIds.push(getFullPermissionId(item, action));
      });
    });

    if (!isVisible) {
      currentPermissions = currentPermissions.filter(id => !allRowActionIds.includes(id));
    } else {
      const showMenuIds = items.map(item => getFullPermissionId(item, "show_in_menu"));
      currentPermissions = Array.from(new Set([...currentPermissions, ...showMenuIds]));
    }
    updateRolePermissions(role, currentPermissions);
  };

  const renderRow = (item: MatrixItem) => {
    if (item.isHeader) {
      return (
        <TableRow key={item.label} className="bg-slate-100 hover:bg-slate-100 border-y border-slate-200">
          <TableCell className="font-bold py-3 text-primary uppercase tracking-wider text-xs">
            {item.label}
          </TableCell>
          {ACTIONS_LIST.filter(a => ["Create", "Edit", "Delete", "Print"].includes(a)).map(action => (
            <TableCell key={action} className="text-center align-middle">
              <div className="flex items-center justify-center w-full">
                <Checkbox
                  checked={isGroupActionSelected(selectedRoleForPermissions, item, action)}
                  onCheckedChange={() => handleToggleGroupAction(selectedRoleForPermissions, item, action)}
                  aria-label={`Select all ${action} permissions for ${item.label}`}
                />
              </div>
            </TableCell>
          ))}
          <TableCell className="text-center align-middle">
            <div className="flex items-center justify-center w-full">
              <Checkbox
                checked={isGroupAllSelected(selectedRoleForPermissions, item)}
                onCheckedChange={() => handleToggleGroupPermissions(selectedRoleForPermissions, item)}
                aria-label={`Select all permissions for ${item.label}`}
              />
            </div>
          </TableCell>
          <TableCell className="text-center align-middle">
            <div className="flex items-center justify-center w-full">
              <Switch
                checked={isGroupVisible(selectedRoleForPermissions, item)}
                onCheckedChange={(val) => handleToggleGroupVisibility(selectedRoleForPermissions, item, val)}
                aria-label={`Toggle visibility for all ${item.label} modules`}
              />
            </div>
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
            <Checkbox
              checked={isRowAllSelected(selectedRoleForPermissions, item)}
              onCheckedChange={() => handleToggleRowPermissions(selectedRoleForPermissions, item)}
              disabled={!isVisible}
            />
          </div>
        </TableCell>
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
          {canEdit(permissionModule) && (
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
                  {canCreate(permissionModule) && (
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
                  )}

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
                              {canDelete(permissionModule) && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => setTempRoles(tempRoles.filter((_, i) => i !== index))}
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </Button>
                              )}
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
          )}

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
        <CardContent className="relative">
          {isPermissionsLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground text-center">Loading permissions...</p>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[350px]">Module / Action</TableHead>
                  {ACTIONS_LIST.filter(a => ["Create", "Edit", "Delete", "Print"].includes(a)).map(action => (
                    <TableHead key={action} className="text-center align-middle">
                      <div className="flex flex-col items-center justify-center gap-2 w-full">
                        <span>{action}</span>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center align-middle">
                    <span>All Permissions</span>
                  </TableHead>
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
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No modules found matching your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
            <div className="flex justify-end mt-6">
              {canEdit(permissionModule) && (
                <Button 
                  onClick={handleFinalSave}
                  className="px-6"
                  disabled={isPermissionsLoading}
                >
                  Save
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

    </div>
  );
}
