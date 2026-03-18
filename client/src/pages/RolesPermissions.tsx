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

export default function RolesPermissions() {
  const {
    roles,
    rolePermissions,
    updateRolePermissions,
    moduleVisibility,
    updateModuleVisibility,
  } = useAuth();
  const { toast } = useToast();

  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<Role>("Admin");
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [activePopupModule, setActivePopupModule] = useState<{ module: string, parent: string, popupModules: string[] } | null>(null);
  const [pendingPopupPermissions, setPendingPopupPermissions] = useState<string[]>([]);

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
    if (!activePopupModule) return;
    const key = `${activePopupModule.parent}:${activePopupModule.module}:${submoduleName}`;
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

  const handleSelectAllPermissions = () => {
    const allIds: string[] = [];

    MODULE_HIERARCHY.forEach(parent => {
      if (!getModuleVisibility(selectedRoleForPermissions, parent.name)) return;
      ACTIONS_LIST.forEach(action => allIds.push(constructPermissionId(parent.name, undefined, action)));

      parent.submodules.forEach(sub => {
        if (!getModuleVisibility(selectedRoleForPermissions, parent.name, sub.name)) return;
        ACTIONS_LIST.forEach(action => allIds.push(constructPermissionId(parent.name, sub.name, action)));

        if (sub.popupModules) {
          sub.popupModules.forEach(popupSub => {
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
      const newPermissions = currentPermissions.filter(id => !allIds.includes(id));
      updateRolePermissions(selectedRoleForPermissions, newPermissions);
      toast({ title: "Permissions Updated", description: "All visible permissions removed." });
    } else {
      const newPermissions = Array.from(new Set([...currentPermissions, ...allIds]));
      updateRolePermissions(selectedRoleForPermissions, newPermissions);
      toast({ title: "Permissions Updated", description: "All visible permissions granted." });
    }
  };

  const isColumnSelected = (action: string) => {
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

  const renderRow = (moduleName: string, submoduleName: string | undefined, isParent: boolean, hasChildren: boolean, popupModules?: string[], parentName?: string) => {
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
        {ACTIONS_LIST.filter(a => ["Create", "Edit"].includes(a)).map(action => (
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
        <p className="text-muted-foreground text-sm">Configure access levels and module visibility for each system role.</p>
      </div>

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
                  <TableHead className="w-[250px]">Module / Action</TableHead>
                  {ACTIONS_LIST.filter(a => ["Create", "Edit"].includes(a)).map(action => (
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
                  {ACTIONS_LIST.filter(a => ["Create", "Edit"].includes(a)).map(action => (
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
                  <TableHead className="text-center">Visible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePopupModule?.popupModules.map(sub => (
                  <TableRow key={sub}>
                    <TableCell>{sub}</TableCell>
                    {ACTIONS_LIST.filter(a => ["Create", "Edit"].includes(a)).map(action => (
                      <TableCell key={action} className="text-center">
                        <Checkbox
                          checked={getPopupPermissionState(sub, action)}
                          onCheckedChange={() => handleTogglePopupPermission(sub, action)}
                          disabled={!getPopupVisibility(sub)}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <Switch
                        checked={getPopupVisibility(sub)}
                        onCheckedChange={(val) => handleTogglePopupVisibility(sub, val)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePopup}>Cancel</Button>
            <Button onClick={savePopupPermissions}>Save Permissions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
