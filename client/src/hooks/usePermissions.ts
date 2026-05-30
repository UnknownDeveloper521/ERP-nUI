import { useCallback } from "react";
import { useAuth } from "@/lib/store";
import { usePermissionStore } from "@/stores/permissionStore";

export type PermissionAction = 'create' | 'edit' | 'delete' | 'print' | 'view';

export const useHasPermission = () => {
  const permissions = usePermissionStore((state) => state.permissions);
  const { user } = useAuth();

  const hasPermission = useCallback((moduleName: string, action: PermissionAction): boolean => {
    if (!user) return false;

    // Administrator override (Check both Administrator and Admin)
    if (user.roles.includes('Administrator') || user.roles.includes('Admin') || (user as any).role === 'Admin') return true;

    // Normalize: "Masters:Core" -> "MASTERS/CORE"
    const normalizedKey = moduleName.toUpperCase().replace(/:/g, '/').replace(/\s+/g, '_');

    const perm = permissions[normalizedKey];
    if (!perm) return false;

    switch (action) {
      case 'create': return perm.can_create;
      case 'edit': return perm.can_edit;
      case 'delete': return perm.can_delete;
      case 'print': return perm.can_print;
      case 'view': return perm.can_view;
      default: return false;
    }
  }, [permissions, user]);

  const isMenuVisible = useCallback((moduleName: string): boolean => {
    if (!user) return false;

    // Administrator override (Check both Administrator and Admin)
    if (user.roles.includes('Administrator') || user.roles.includes('Admin') || (user as any).role === 'Admin') return true;

    // Normalize: "Masters:Core" -> "MASTERS/CORE"
    const normalizedQuery = moduleName.toUpperCase().replace(/:/g, '/').replace(/\s+/g, '_');

    // Exact match
    const perm = permissions[normalizedQuery];
    if (perm?.show_in_menu || perm?.can_view) return true;

    // Prefix match (e.g., if checking "HRMS/ATTENDANCE", match "HRMS/ATTENDANCE/HR_VIEW")
    const prefix = `${normalizedQuery}/`;
    const hasVisibleChild = Object.entries(permissions).some(([key, value]) => {
      return key.startsWith(prefix) && (value.show_in_menu || value.can_view);
    });

    return hasVisibleChild;
  }, [permissions, user]);

  const canCreate = useCallback((module: string) => hasPermission(module, 'create'), [hasPermission]);
  const canEdit = useCallback((module: string) => hasPermission(module, 'edit'), [hasPermission]);
  const canDelete = useCallback((module: string) => hasPermission(module, 'delete'), [hasPermission]);
  const canPrint = useCallback((module: string) => hasPermission(module, 'print'), [hasPermission]);
  const canView = useCallback((module: string) => hasPermission(module, 'view'), [hasPermission]);

  return {
    hasPermission,
    isMenuVisible,
    canCreate,
    canEdit,
    canDelete,
    canPrint,
    canView,
  };
};
