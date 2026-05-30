import { Permission, PermissionMap, usePermissionStore } from '../stores/permissionStore';

/**
 * Transforms the API permission structure into a flat map.
 * API Structure: groups -> modules[]
 */
export const transformPermissions = (data: any[]): PermissionMap => {
  const map: PermissionMap = {};

  if (!data || !Array.isArray(data)) return map;

  // The backend might return an array of roles, each containing a `permissions` array of groups.
  // Or it might return an array of groups directly.
  // We need to extract all groups.
  let allGroups: any[] = [];
  
  data.forEach(item => {
    if (item.role_id && Array.isArray(item.permissions)) {
      // It's a role object, extract its groups
      allGroups = allGroups.concat(item.permissions);
    } else {
      // It's likely a group object itself
      allGroups.push(item);
    }
  });

  allGroups.forEach((group) => {
    if (group.modules && Array.isArray(group.modules)) {
      group.modules.forEach((mod: any) => {
        // Normalize key to uppercase for consistent lookup
        const moduleName = mod.module_name.toUpperCase().replace(/:/g, '/').replace(/\s+/g, '_');
        
        const can_create = Boolean(mod.can_create);
        const can_edit = Boolean(mod.can_edit);
        const can_delete = Boolean(mod.can_delete);
        const can_print = Boolean(mod.can_print);
        const show_in_menu = Boolean(mod.show_in_menu);
        
        // Derive view permission
        const can_view = can_create || can_edit || can_delete || can_print || show_in_menu;

        map[moduleName] = {
          can_create,
          can_edit,
          can_delete,
          can_print,
          show_in_menu,
          can_view,
        };
      });
    }
  });

  return map;
};

/**
 * Static helper for non-component usage (if needed)
 */
export const checkPermissionStatic = (moduleName: string, action: 'create' | 'edit' | 'delete' | 'print' | 'view', userRoles: string[] = []) => {
  // Administrator override
  if (userRoles.includes('Administrator')) return true;

  const permissions = usePermissionStore.getState().permissions;
  const perm = permissions[moduleName] || permissions[moduleName.toUpperCase()];
  if (!perm) return false;

  switch (action) {
    case 'create': return perm.can_create;
    case 'edit': return perm.can_edit;
    case 'delete': return perm.can_delete;
    case 'print': return perm.can_print;
    case 'view': return perm.can_view;
    default: return false;
  }
};
