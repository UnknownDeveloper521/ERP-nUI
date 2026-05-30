import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  getCurrentUser,
  onAuthStateChange,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  formatAuthError,
} from './supabase';
import { rolesPermissionsApi, RoleRecord, PermissionItem } from './api';
import { usePermissionStore } from '../stores/permissionStore';

// --- Types ---

export type Role = string;

export interface RoleWithId {
  id: number;
  name: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  module: string;
}

export interface RolePermissions {
  [role: string]: string[]; // Array of permission IDs
}

export interface ModuleVisibility {
  [role: string]: {
    [module: string]: boolean; // true = visible in sidebar, false = hidden
  };
}

export interface User {
  id: number;
  supabaseId?: string;
  name: string;
  email: string;
  roles: Role[];
  department: string;
  status: "Active" | "Inactive";
  password?: string;
  avatar?: string;
  companyId?: number;
  tenantId?: number;
  roleId?: number;
  employeeId?: number;
}

export interface AttendanceRecord {
  id: number;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  hours: number;
  method: string;
  location: string;
}

interface AuthContextType {
  user: User | null;
  isAuthLoading: boolean;
  users: User[];
  roles: Role[];
  rolesWithIds: RoleWithId[];
  rolePermissions: RolePermissions;
  moduleVisibility: ModuleVisibility;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  addUser: (user: Omit<User, "id" | "status">) => void;
  updateUser: (id: number, data: Partial<User>) => void;
  deleteUser: (id: number) => void;
  toggleUserStatus: (id: number) => void;
  updateRolePermissions: (role: Role, permissionIds: string[]) => void;
  updateModuleVisibility: (role: Role, moduleVisibilities: { [module: string]: boolean }) => void;
  availablePermissions: Permission[];
  hasPermission: (module: string, action: string) => boolean;
  isModuleVisible: (module: string) => boolean;
  attendance: AttendanceRecord[];
  checkIn: () => void;
  checkOut: () => void;
  updateAttendance: (records: AttendanceRecord[]) => void;
  addRole: (name: string) => void;
  deleteRole: (name: string) => void;
  renameRole: (oldName: string, newName: string) => void;
  isPermissionsLoading: boolean;
  fetchPermissionsForRole: (roleName: string) => Promise<void>;
  saveRolePermissions: (roleName: string) => Promise<void>;
  fetchRoles: () => Promise<RoleWithId[]>;
  updateRolesBulk: (delta: any) => Promise<void>;
}

// --- Default Data ---

// --- Default Data ---

/* 
  Replaced flat MODULES_LIST with hierarchy to support nested permissions.
  The hierarchy is now the source of truth for permission generation.
*/

export interface SubModule {
  name: string;
  popupModules?: string[];
}

export interface ModuleHierarchyItem {
  name: string;
  submodules: SubModule[];
}

export const MODULE_HIERARCHY: ModuleHierarchyItem[] = [
  {
    name: "Dashboard",
    submodules: []
  },
  {
    name: "HRMS",
    submodules: [
      { name: "Dashboard" },
      { name: "CoreHR" },
      {
        name: "Attendance",
        popupModules: ["Attendance Record", "Overtime", "HR View", "Bulk Attendance"]
      },
      {
        name: "Leave Management",
        popupModules: ["Dashboard", "Leave Entry", "Calendar"]
      }
    ]
  },
  {
    name: "Products",
    submodules: []
  },
  {
    name: "Inventory",
    submodules: []
  },
  {
    name: "Sales",
    submodules: []
  },
  {
    name: "Purchases",
    submodules: []
  },
  {
    name: "Customers",
    submodules: []
  },
  {
    name: "Accounting",
    submodules: [
      { name: "Invoicing" }
    ]
  },
  {
    name: "System",
    submodules: [
      { name: "User & Roles" },
      { name: "Master" },
      {
        name: "HRsetup",
        popupModules: ["Assign Employee Salary", "Salary Component", "Salary Structure"]
      }
    ]
  }
];

export const ACTIONS_LIST = ["View", "Create", "Edit", "Delete", "Print", "Approve"] as const;

// Helper to construct ID consistent with UI
export const constructPermissionId = (module: string, submodule: string | undefined, action: string) => {
  if (submodule) {
    return `${module.toLowerCase().replace(/\s+/g, '_')}_${submodule.toLowerCase().replace(/\s+/g, '_')}_${action.toLowerCase()}`;
  }
  return `${module.toLowerCase().replace(/\s+/g, '_')}_${action.toLowerCase()}`;
};

// --- API Mapping Helpers ---

const mapPermissionIdToBackend = (id: string): PermissionItem => {
  const parts = id.split('||');
  if (parts.length === 2) {
    return { module_name: parts[0], action: parts[1] };
  }
  // Fallback for old/default data
  const oldParts = id.split('_');
  const action = oldParts.pop()!;
  const modulePath = oldParts.join('/').toUpperCase();
  return { module_name: modulePath, action: action.toLowerCase() };
};

const mapBackendToPermissionId = (item: PermissionItem): string => {
  return `${item.module_name}||${item.action.toLowerCase()}`;
};

// Generate permissions traversing the hierarchy
const generatePermissionsFromHierarchy = () => {
  const permissions: Permission[] = [];

  MODULE_HIERARCHY.forEach(parent => {
    // Parent permissions
    ACTIONS_LIST.forEach(action => {
      permissions.push({
        id: constructPermissionId(parent.name, undefined, action),
        name: `${action} ${parent.name}`,
        description: `Allow ${action.toLowerCase()} access to ${parent.name}`,
        module: parent.name
      });
    });

    // Submodule permissions
    parent.submodules.forEach(sub => {
      ACTIONS_LIST.forEach(action => {
        permissions.push({
          id: constructPermissionId(parent.name, sub.name, action),
          name: `${action} ${parent.name}: ${sub.name}`,
          description: `Allow ${action.toLowerCase()} access to ${sub.name}`,
          module: parent.name // Group by parent
        });
      });

      // Popup module permissions (Level 3)
      if (sub.popupModules) {
        sub.popupModules.forEach(popupSub => {
          ACTIONS_LIST.forEach(action => {
            // ID scheme: parent_sub_popupsub_action
            // Note: constructPermissionId handles 2 levels. 
            // We need consistent logic for 3 levels if we want them in default permissions.
            // In UsersRoles.tsx we used specific logic for popup.
            // Ideally we standardize. For now, let's replicate the UsersRoles popup logic here if possible, 
            // OR mostly focus on Level 1/2 which are the main "Disabled" complaint.
            // The user complaint was "System:User & Roles" and "System:Master".
            // These are covered by submodule iteration above.
          });
        });
      }
    });
  });
  return permissions;
};

const DEFAULT_PERMISSIONS: Permission[] = generatePermissionsFromHierarchy();

const DEFAULT_ROLES: Role[] = ["Administrator", "Manager", "Operator", "Accountant", "Supervisor", "Quality Control"];

// Helper to get all permissions for a module
const getModulePermissions = (module: string, actions: string[]) =>
  actions.map(action => `${module.toLowerCase()}_${action.toLowerCase()}`);

// Updated default Admin to have everything including new nested IDs
const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  "Admin": DEFAULT_PERMISSIONS.map(p => p.id), // Admin has everything matches the new hierarchy IDs
  "Manager": [
    ...getModulePermissions("Dashboard", ["View"]),
    ...getModulePermissions("HRMS", ["View", "Create", "Edit", "Approve"]),
    ...getModulePermissions("Sales", ["View", "Create", "Edit", "Approve"]),
    ...getModulePermissions("Inventory", ["View", "Create", "Edit", "Approve"]),
    ...getModulePermissions("Customers", ["View", "Create", "Edit"]),
  ],
  "Operator": [
    ...getModulePermissions("Dashboard", ["View"]),
    ...getModulePermissions("Inventory", ["View", "Create"]),
  ],
  "Accountant": [
    ...getModulePermissions("Dashboard", ["View"]),
    ...getModulePermissions("Sales", ["View"]),
    ...getModulePermissions("Accounting", ["View", "Create", "Edit"]),
    ...getModulePermissions("Purchases", ["View", "Create", "Edit"]),
  ],
  "Supervisor": [
    ...getModulePermissions("Dashboard", ["View"]),
    ...getModulePermissions("Inventory", ["View", "Edit", "Approve"]),
    ...getModulePermissions("HRMS", ["View"]),
  ],
  "Quality Control": [
    ...getModulePermissions("Dashboard", ["View"]),
    ...getModulePermissions("Products", ["View", "Edit"]),
    ...getModulePermissions("Inventory", ["View"]),
  ],
};

const DEFAULT_MODULE_VISIBILITY: ModuleVisibility = {
  "Admin": { "Dashboard": true, "HRMS": true, "Products": true, "Inventory": true, "Sales": true, "Purchases": true, "Customers": true, "Accounting": true, "System": true },
  "Manager": { "Dashboard": true, "HRMS": true, "Inventory": true, "Sales": true, "Customers": true, "Products": true, "Purchases": false, "Accounting": false, "System": false },
  "Operator": { "Dashboard": true, "Inventory": true, "HRMS": false, "Products": false, "Sales": false, "Purchases": false, "Customers": false, "Accounting": false, "System": false },
  "Accountant": { "Dashboard": true, "Accounting": true, "Sales": true, "Purchases": true, "HRMS": false, "Inventory": false, "Products": false, "Customers": false, "System": false },
  "Supervisor": { "Dashboard": true, "Inventory": true, "HRMS": true, "Accounting": false, "Sales": false, "Purchases": false, "Customers": false, "Products": false, "System": false },
  "Quality Control": { "Dashboard": true, "Products": true, "Inventory": true, "HRMS": false, "Sales": false, "Purchases": false, "Customers": false, "Accounting": false, "System": false },
};

const DEFAULT_USERS: User[] = [
  { id: 1, name: "Super Admin", email: "admin@tassos.com", password: "123456", roles: ["Admin"], department: "IT", status: "Active", avatar: "https://github.com/shadcn.png" },
  { id: 2, name: "Daxpanara Tassos", email: "daxpanara.tassos@gmail.com", password: "123456", roles: ["Admin"], department: "IT", status: "Active" },
  { id: 3, name: "Sarah Johnson", email: "sarah@tassos.com", password: "123456", roles: ["Manager"], department: "Engineering", status: "Active" },
  { id: 4, name: "Michael Chen", email: "michael@tassos.com", password: "123456", roles: ["Operator"], department: "Product", status: "Active" },
  { id: 5, name: "Jessica Williams", email: "jessica@tassos.com", password: "123456", roles: ["Operator"], department: "Human Resources", status: "Active" },
  { id: 6, name: "David Miller", email: "david@tassos.com", password: "123456", roles: ["Accountant"], department: "Sales", status: "Active" },
  { id: 7, name: "Emily Davis", email: "emily@tassos.com", password: "123456", roles: ["Supervisor"], department: "Marketing", status: "Active" },
];

// --- Context ---

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage or defaults
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('users');
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  });

  const [rolesWithIds, setRolesWithIds] = useState<RoleWithId[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(false);
  const [savedPermissions, setSavedPermissions] = useState<RolePermissions>({});
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(() => {
    const saved = localStorage.getItem('rolePermissions');
    return saved ? JSON.parse(saved) : DEFAULT_ROLE_PERMISSIONS;
  });

  const fetchRoles = async () => {
    try {
      const response = await rolesPermissionsApi.getRoleList();
      if (response.isSuccessful && response.data && response.data.records) {
        const mappedRoles = response.data.records.map(r => ({ id: r.id, name: r.role_name }));
        setRolesWithIds(mappedRoles);
        const roleNames = mappedRoles.map(r => r.name);
        setRoles(roleNames);
        return mappedRoles;
      }
    } catch (err) {
      console.error("Failed to fetch roles:", err);
    }
    return [];
  };


  const hasPermission = (module: string, action: string) => {
    if (!user) return false;
    
    // Admin override
    if (user.roles.includes("Administrator")) return true;

    const permissions = usePermissionStore.getState().permissions;
    const perm = permissions[module] || permissions[module.toUpperCase()];
    if (!perm) return false;

    switch (action.toLowerCase()) {
      case 'create': return perm.can_create;
      case 'edit': return perm.can_edit;
      case 'delete': return perm.can_delete;
      case 'print': return perm.can_print;
      case 'view': return perm.can_view;
      default: return false;
    }
  };

  const [moduleVisibility, setModuleVisibility] = useState<ModuleVisibility>(() => {
    const saved = localStorage.getItem('moduleVisibility');
    return saved ? JSON.parse(saved) : DEFAULT_MODULE_VISIBILITY;
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('attendance');
    return saved ? JSON.parse(saved) : [
      { id: 1, employeeId: "EMP001", date: "2025-11-26", checkIn: "08:45", checkOut: "17:30", hours: 8.75, method: "Biometric", location: "New York Office - Main Entrance" },
      { id: 2, employeeId: "EMP002", date: "2025-11-26", checkIn: "09:00", checkOut: "17:45", hours: 8.75, method: "Web Check-in", location: "San Francisco Office - Remote" },
      { id: 3, employeeId: "EMP003", date: "2025-11-26", checkIn: "08:30", checkOut: "17:00", hours: 8.5, method: "Mobile App", location: "Boston Office - Conference Room" },
      { id: 4, employeeId: "EMP004", date: "2025-11-26", checkIn: "08:55", checkOut: "17:20", hours: 8.42, method: "Biometric", location: "Chicago Office - Main Gate" },
      { id: 5, employeeId: "EMP005", date: "2025-11-26", checkIn: "09:10", checkOut: "18:00", hours: 8.83, method: "Mobile App", location: "Los Angeles Office - Parking Lot" },
    ];
  });

  // Persist state changes
  useEffect(() => {
    if (user) localStorage.setItem('currentUser', JSON.stringify(user));
    else localStorage.removeItem('currentUser');
  }, [user]);

  useEffect(() => {
    localStorage.setItem('users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('roles', JSON.stringify(roles));
  }, [roles]);

  useEffect(() => {
    localStorage.setItem('rolePermissions', JSON.stringify(rolePermissions));
  }, [rolePermissions]);

  useEffect(() => {
    localStorage.setItem('moduleVisibility', JSON.stringify(moduleVisibility));
  }, [moduleVisibility]);

  useEffect(() => {
    localStorage.setItem('attendance', JSON.stringify(attendance));
  }, [attendance]);

  const mapSupabaseAuthUser = (supabaseUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }) => {
    const meta = supabaseUser.user_metadata ?? {};
    return {
      email: supabaseUser.email,
      id: supabaseUser.id,
      role: (meta.role ?? meta.role_code) as string | undefined,
      companyId: (meta.company_id ?? meta.companyId) as string | number | undefined,
      tenantId: (meta.tenant_id ?? meta.tenantId) as string | number | undefined,
      roleId: (meta.role_id ?? meta.roleId) as string | number | undefined,
      employeeId: (meta.employee_id ?? meta.employeeId) as string | number | undefined,
    };
  };

  const upsertLocalUserFromEmail = (authUser: any) => {
    const { email, id: supabaseId, companyId, tenantId, roleId, employeeId, role } = authUser;
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    // Roles should be based on the current login, not accumulated from the past
    let userRoles: string[] = [];
    if (role) {
      const mappedRole = role === "Admin" ? "Administrator" : role;
      userRoles = [mappedRole];
    }
    
    // Fallback to Administrator ONLY if absolutely no role is provided
    if (userRoles.length === 0) {
      userRoles = ["Administrator"];
    }

    if (existing) {
      const updated = { 
        ...existing, 
        roles: userRoles, 
        supabaseId,
        companyId: companyId ? Number(companyId) : existing.companyId,
        tenantId: tenantId ? Number(tenantId) : existing.tenantId,
        roleId: roleId ? Number(roleId) : existing.roleId,
        employeeId: employeeId ? Number(employeeId) : existing.employeeId
      };
      setUsers(prev => prev.map(u => u.id === existing.id ? updated : u));
      return updated;
    }

    const newUser: User = {
      id: Math.max(...users.map(u => u.id), 0) + 1,
      supabaseId,
      name: email.split("@")[0] || "User",
      email,
      roles: userRoles,
      department: "General",
      status: "Active",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
      companyId: companyId ? Number(companyId) : undefined,
      tenantId: tenantId ? Number(tenantId) : undefined,
      roleId: roleId ? Number(roleId) : undefined,
      employeeId: employeeId ? Number(employeeId) : undefined
    };
    setUsers(prev => [...prev, newUser]);
    return newUser;
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await signInWithEmail(email, password);
    if (error) {
      throw new Error(formatAuthError(error.message));
    }
    if (!data?.user?.email) {
      throw new Error("Authentication succeeded but no user profile was returned.");
    }

    const localUser = upsertLocalUserFromEmail(mapSupabaseAuthUser(data.user));
    if (localUser.status === "Inactive") {
      throw new Error("Your account is inactive. Contact an administrator.");
    }

    setUser(localUser);
    return true;
  };

  const register = async (email: string, password: string, username?: string) => {
    const { error } = await signUpWithEmail(email, password, username);
    if (error) throw error;
  };

  const logout = async () => {
    await signOut();
    setUser(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('erp_common_data');
  };

  useEffect(() => {
    let unsub: { data: { subscription: { unsubscribe: () => void } } } | null = null;

    const init = async () => {
      try {
        const authUser = await getCurrentUser();

        if (authUser?.email) {
          const localUser = upsertLocalUserFromEmail(mapSupabaseAuthUser(authUser));
          if (localUser.status !== "Inactive") {
            setUser(localUser);
          }
        } else {
          setUser(null);
          localStorage.removeItem('currentUser');
        }

        unsub = onAuthStateChange((nextUser) => {
          if (nextUser?.email) {
            const localUser = upsertLocalUserFromEmail(mapSupabaseAuthUser(nextUser));
            if (localUser.status !== "Inactive") {
              setUser(localUser);
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        });
      } catch (err) {
        console.error("Auth error:", err);
      } finally {
        setIsAuthLoading(false);
      }
    };

    init();

    return () => {
      unsub?.data.subscription.unsubscribe();
    };
  }, []);

  const addUser = (userData: Omit<User, "id" | "status">) => {
    const newUser: User = {
      ...userData,
      id: Math.max(...users.map(u => u.id), 0) + 1,
      status: "Active",
      password: "123456",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`
    };
    setUsers([...users, newUser]);
  };

  const updateUser = (id: number, data: Partial<User>) => {
    setUsers(users.map(u => u.id === id ? { ...u, ...data } : u));
    // If updating current user, update session too
    if (user && user.id === id) {
      setUser({ ...user, ...data });
    }
  };

  const toggleUserStatus = (id: number) => {
    setUsers(users.map(u => {
      if (u.id === id) {
        return { ...u, status: u.status === "Active" ? "Inactive" : "Active" };
      }
      return u;
    }));
  };

  const deleteUser = (id: number) => {
    // For this mockup, we'll just remove it from the array
    setUsers(users.filter(u => u.id !== id));
  };

  const updateRolePermissions = (roleName: Role, newPermissionIds: string[]) => {
    setRolePermissions(prev => ({
      ...prev,
      [roleName]: newPermissionIds
    }));
  };

  const saveRolePermissions = async (roleName: string) => {
    const roleObj = rolesWithIds.find(r => r.name === roleName);
    if (!roleObj) return;

    const current = rolePermissions[roleName] || [];
    const saved = savedPermissions[roleName] || [];

    const add = current
      .filter(id => !saved.includes(id))
      .map(mapPermissionIdToBackend);

    const del = saved
      .filter(id => !current.includes(id))
      .map(mapPermissionIdToBackend);

    if (add.length === 0 && del.length === 0) return;

    const payload = {
      role_id: roleObj.id,
      add: add.length > 0 ? add : undefined,
      delete: del.length > 0 ? del : undefined
    };

    console.log("PAYLOAD BEING SENT TO givepermission:", JSON.stringify(payload, null, 2));

    setIsPermissionsLoading(true);
    try {
      await rolesPermissionsApi.givePermission(payload);
      
      setSavedPermissions(prev => ({
        ...prev,
        [roleName]: current
      }));
    } catch (err) {
      console.error("Failed to save permissions:", err);
      throw err;
    } finally {
      setIsPermissionsLoading(false);
    }
  };

  const isModuleVisible = (module: string) => {
    if (!user) return true;
    
    // Administrator override
    if (user.roles.includes("Administrator")) return true;

    const permissions = usePermissionStore.getState().permissions;
    // Check if the module is visible in menu
    const perm = permissions[module] || permissions[module.toUpperCase()];
    return perm?.show_in_menu ?? false;
  };

  const addRole = async (name: string) => {
    if (roles.includes(name)) return;
    try {
      await rolesPermissionsApi.updateRole({ add: [{ role_name: name }] });
      await fetchRoles(); // Refresh the list to get the new ID
    } catch (err) {
      console.error("Failed to add role:", err);
    }
  };

  const updateRolesBulk = async (delta: any) => {
    try {
      await rolesPermissionsApi.updateRole(delta);
      await fetchRoles();
    } catch (err) {
      console.error("Failed to update roles bulk:", err);
      throw err;
    }
  };

  const deleteRole = async (name: string) => {
    if (name === "Admin") return;
    const roleObj = rolesWithIds.find(r => r.name === name);
    if (!roleObj) return;

    try {
      await rolesPermissionsApi.updateRole({ delete: [roleObj.id] });
      
      // Local cleanup
      setRoles(prev => prev.filter(r => r !== name));
      setRolesWithIds(prev => prev.filter(r => r.id !== roleObj.id));
      setRolePermissions(prev => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    } catch (err) {
      console.error("Failed to delete role:", err);
    }
  };

  const renameRole = async (oldName: string, newName: string) => {
    if (oldName === "Admin") return;
    if (roles.includes(newName)) return;
    const roleObj = rolesWithIds.find(r => r.name === oldName);
    if (!roleObj) return;

    try {
      await rolesPermissionsApi.updateRole({ 
        edit: [{ id: roleObj.id, role_name: newName }] 
      });
      
      // Local updates
      setRoles(prev => prev.map(r => r === oldName ? newName : r));
      setRolesWithIds(prev => prev.map(r => r.id === roleObj.id ? { ...r, name: newName } : r));
      setRolePermissions(prev => {
        const updated = { ...prev };
        if (updated[oldName]) {
          updated[newName] = updated[oldName];
          delete updated[oldName];
        }
        return updated;
      });
      setModuleVisibility(prev => {
        const updated = { ...prev };
        if (updated[oldName]) {
          updated[newName] = updated[oldName];
          delete updated[oldName];
        }
        return updated;
      });
      setUsers(prev => prev.map(u => u.roles.includes(oldName) ? { ...u, roles: u.roles.map(r => r === oldName ? newName : r) } : u));
      if (user?.roles.includes(oldName)) setUser({ ...user, roles: user.roles.map(r => r === oldName ? newName : r) });

    } catch (err) {
      console.error("Failed to rename role:", err);
    }
  };

  const updateModuleVisibility = (role: Role, moduleVisibilities: { [module: string]: boolean }) => {
    setModuleVisibility(prev => ({
      ...prev,
      [role]: moduleVisibilities
    }));
  };

  const fetchPermissionsForRole = async (roleName: string, rolesList?: RoleWithId[]) => {
    const listToUse = rolesList || rolesWithIds;
    const roleObj = listToUse.find(r => r.name === roleName);
    if (!roleObj) return;

    setIsPermissionsLoading(true);
    try {
      const response = await rolesPermissionsApi.getPermissions(roleObj.id);
      if (response.isSuccessful && response.data && response.data.permissions) {
        const permissionsArray = response.data.permissions as any[];
        const permissionIds: string[] = [];
          const visibilities: { [key: string]: boolean } = {};

        permissionsArray.forEach(group => {
          if (group.modules && Array.isArray(group.modules)) {
            group.modules.forEach((mod: any) => {
              const moduleName = mod.module_name;
              if (mod.can_create) permissionIds.push(`${moduleName}||create`);
              if (mod.can_edit) permissionIds.push(`${moduleName}||edit`);
              if (mod.can_delete) permissionIds.push(`${moduleName}||delete`);
              if (mod.can_print) permissionIds.push(`${moduleName}||print`);
              
              if (mod.show_in_menu) permissionIds.push(`${moduleName}||show_in_menu`);

              // Update moduleVisibility mapping
              const parts = mod.module_name.split('/');
              if (parts.length > 1) {
                const key = parts.slice(1).join(':'); 
                visibilities[key] = Boolean(mod.show_in_menu);
                const groupKey = parts.join(':');
                visibilities[groupKey] = Boolean(mod.show_in_menu);
              } else {
                visibilities[parts[0]] = Boolean(mod.show_in_menu);
              }
            });
          }
        });

        setRolePermissions(prev => ({
          ...prev,
          [roleName]: permissionIds
        }));
        setSavedPermissions(prev => ({
          ...prev,
          [roleName]: permissionIds
        }));
        setModuleVisibility(prev => ({
          ...prev,
          [roleName]: { ...prev[roleName], ...visibilities }
        }));
      }
    } catch (err) {
      console.error("Failed to fetch permissions:", err);
    } finally {
      setIsPermissionsLoading(false);
    }
  };


  const checkIn = () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const empId = `EMP${String(user.id).padStart(3, "0")}`;
    const existingRecord = attendance.find(a => a.employeeId === empId && a.date === today);

    const now = new Date();
    const checkInTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    if (existingRecord) {
      setAttendance(attendance.map(a =>
        a.id === existingRecord.id
          ? { ...a, checkIn: checkInTime }
          : a
      ));
    } else {
      const newRecord: AttendanceRecord = {
        id: Math.max(...attendance.map(a => a.id), 0) + 1,
        employeeId: empId,
        date: today,
        checkIn: checkInTime,
        checkOut: null,
        hours: 0,
        method: "Web Check-in",
        location: user.department || "Office"
      };
      setAttendance([...attendance, newRecord]);
    }
  };

  const checkOut = () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const empId = `EMP${String(user.id).padStart(3, "0")}`;
    const record = attendance.find(a => a.employeeId === empId && a.date === today);

    if (!record) return;

    const now = new Date();
    const checkOutTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const [checkInHour, checkInMin] = record.checkIn.split(":").map(Number);
    const [checkOutHour, checkOutMin] = checkOutTime.split(":").map(Number);
    const totalMinutes = (checkOutHour * 60 + checkOutMin) - (checkInHour * 60 + checkInMin);
    const hours = parseFloat((totalMinutes / 60).toFixed(2));

    setAttendance(attendance.map(a =>
      a.id === record.id
        ? { ...a, checkOut: checkOutTime, hours }
        : a
    ));
  };

  const updateAttendance = (records: AttendanceRecord[]) => {
    setAttendance(records);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthLoading,
      users,
      roles,
      rolesWithIds,
      rolePermissions,
      moduleVisibility,
      login,
      register,
      logout,
      addUser,
      updateUser,
      deleteUser,
      toggleUserStatus,
      updateRolePermissions,
      updateModuleVisibility,
      availablePermissions: DEFAULT_PERMISSIONS,
      hasPermission,
      isModuleVisible,
      attendance,
      checkIn,
      checkOut,
      updateAttendance,
      addRole,
      deleteRole,
      renameRole,
      isPermissionsLoading,
      fetchPermissionsForRole,
      saveRolePermissions,
      fetchRoles,
      updateRolesBulk
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
