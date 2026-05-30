import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Permission {
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_print: boolean;
  show_in_menu: boolean;
  can_view: boolean;
}

export type PermissionMap = Record<string, Permission>;

interface PermissionState {
  permissions: PermissionMap;
  setPermissions: (permissions: PermissionMap) => void;
  clearPermissions: () => void;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set) => ({
      permissions: {},
      setPermissions: (permissions) => set({ permissions }),
      clearPermissions: () => set({ permissions: {} }),
    }),
    {
      name: 'permission-storage',
    }
  )
);
