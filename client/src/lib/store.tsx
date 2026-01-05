import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentUser, onAuthStateChange, signInWithEmail, signOut, signUpWithEmail } from './supabase';

// --- Types ---

export type Role = "Admin" | "Manager" | "Operator" | "Accountant" | "Supervisor" | "Quality Control";

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
  role: Role;
  department: string;
  status: "Active" | "Inactive";
  password?: string; // In a real app, this would be hashed. Here for mockup auth.
  avatar?: string;
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
  hasPermission: (permissionId: string) => boolean;
  isModuleVisible: (module: string) => boolean;
  attendance: AttendanceRecord[];
  checkIn: () => void;
  checkOut: () => void;
  updateAttendance: (records: AttendanceRecord[]) => void;
}

// --- Default Data ---

export const MODULES_LIST = [
  "Dashboard",
  "HRMS",
  "Products",
  "Inventory",
  "Sales",
  "Purchases",
  "Customers",
  "Accounting",
  "Logistics",
  "System",
] as const;

export const ACTIONS_LIST = ["View", "Create", "Edit", "Delete", "Approve"] as const;

// Generate permissions
const DEFAULT_PERMISSIONS: Permission[] = MODULES_LIST.flatMap(module => 
  ACTIONS_LIST.map(action => ({
    id: `${module.toLowerCase()}_${action.toLowerCase()}`,
    name: `${action} ${module}`,
    description: `Allow ${action.toLowerCase()} access to ${module}`,
    module: module
  }))
);

const DEFAULT_ROLES: Role[] = ["Admin", "Manager", "Operator", "Accountant", "Supervisor", "Quality Control"];

// Helper to get all permissions for a module
const getModulePermissions = (module: string, actions: string[]) => 
  actions.map(action => `${module.toLowerCase()}_${action.toLowerCase()}`);

const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  "Admin": DEFAULT_PERMISSIONS.map(p => p.id), // Admin has everything
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
    ...getModulePermissions("Logistics", ["View", "Create"]),
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
  "Admin": { "Dashboard": true, "HRMS": true, "Products": true, "Inventory": true, "Sales": true, "Purchases": true, "Customers": true, "Accounting": true, "Logistics": true, "System": true },
  "Manager": { "Dashboard": true, "HRMS": true, "Inventory": true, "Sales": true, "Customers": true, "Products": true, "Purchases": false, "Accounting": false, "Logistics": false, "System": false },
  "Operator": { "Dashboard": true, "Inventory": true, "Logistics": true, "HRMS": false, "Products": false, "Sales": false, "Purchases": false, "Customers": false, "Accounting": false, "System": false },
  "Accountant": { "Dashboard": true, "Accounting": true, "Sales": true, "Purchases": true, "HRMS": false, "Inventory": false, "Products": false, "Customers": false, "Logistics": false, "System": false },
  "Supervisor": { "Dashboard": true, "Inventory": true, "HRMS": true, "Accounting": false, "Sales": false, "Purchases": false, "Customers": false, "Products": false, "Logistics": false, "System": false },
  "Quality Control": { "Dashboard": true, "Products": true, "Inventory": true, "HRMS": false, "Sales": false, "Purchases": false, "Customers": false, "Accounting": false, "Logistics": false, "System": false },
};

const DEFAULT_USERS: User[] = [
  { id: 1, name: "Super Admin", email: "admin@tassos.com", password: "123456", role: "Admin", department: "IT", status: "Active", avatar: "https://github.com/shadcn.png" },
  { id: 2, name: "Daxpanara Tassos", email: "daxpanara.tassos@gmail.com", password: "123456", role: "Admin", department: "IT", status: "Active" },
  { id: 3, name: "Sarah Johnson", email: "sarah@tassos.com", password: "123456", role: "Manager", department: "Engineering", status: "Active" },
  { id: 4, name: "Michael Chen", email: "michael@tassos.com", password: "123456", role: "Operator", department: "Product", status: "Active" },
  { id: 5, name: "Jessica Williams", email: "jessica@tassos.com", password: "123456", role: "Operator", department: "Human Resources", status: "Active" },
  { id: 6, name: "David Miller", email: "david@tassos.com", password: "123456", role: "Accountant", department: "Sales", status: "Active" },
  { id: 7, name: "Emily Davis", email: "emily@tassos.com", password: "123456", role: "Supervisor", department: "Marketing", status: "Active" },
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

  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(() => {
    const saved = localStorage.getItem('rolePermissions');
    return saved ? JSON.parse(saved) : DEFAULT_ROLE_PERMISSIONS;
  });

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
    localStorage.setItem('rolePermissions', JSON.stringify(rolePermissions));
  }, [rolePermissions]);

  useEffect(() => {
    localStorage.setItem('moduleVisibility', JSON.stringify(moduleVisibility));
  }, [moduleVisibility]);

  useEffect(() => {
    localStorage.setItem('attendance', JSON.stringify(attendance));
  }, [attendance]);

  const upsertLocalUserFromEmail = (email: string, supabaseId?: string) => {
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      const updated = { ...existing, supabaseId };
      setUsers(prev => prev.map(u => u.id === existing.id ? updated : u));
      return updated;
    }

    const newUser: User = {
      id: Math.max(...users.map(u => u.id), 0) + 1,
      supabaseId,
      name: email.split("@")[0] || "User",
      email,
      role: "Admin",
      department: "General",
      status: "Active",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
    };
    setUsers(prev => [...prev, newUser]);
    return newUser;
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await signInWithEmail(email, password);
    if (error) {
      console.error("Supabase login error:", error.message, error);
      return false;
    }

    const supaUser = data.user;
    if (!supaUser?.email) {
      console.error("Supabase login: no user email returned");
      return false;
    }

    const localUser = upsertLocalUserFromEmail(supaUser.email, supaUser.id);
    if (localUser.status === "Inactive") {
      console.error("Local user is inactive");
      return false;
    }
    setUser(localUser);
    return true;
  };

  const register = async (email: string, password: string) => {
    const { error } = await signUpWithEmail(email, password);
    if (error) throw error;
  };

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  useEffect(() => {
    let unsub: { data: { subscription: { unsubscribe: () => void } } } | null = null;

    (async () => {
      try {
        const supaUser = await getCurrentUser();
        if (supaUser?.email) {
          const localUser = upsertLocalUserFromEmail(supaUser.email, supaUser.id);
          setUser(localUser.status === "Inactive" ? null : localUser);
        } else {
          setUser(null);
        }

        unsub = onAuthStateChange((nextUser) => {
          if (nextUser?.email) {
            const localUser = upsertLocalUserFromEmail(nextUser.email, nextUser.id);
            setUser(localUser.status === "Inactive" ? null : localUser);
          } else {
            setUser(null);
          }
        });
      } finally {
        setIsAuthLoading(false);
      }
    })();

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

  const updateRolePermissions = (role: Role, permissionIds: string[]) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: permissionIds
    }));
  };

  const hasPermission = (permissionId: string): boolean => {
    if (!user) return false;
    const permissions = rolePermissions[user.role] || [];
    return permissions.includes(permissionId);
  };

  const isModuleVisible = (module: string): boolean => {
    if (!user) return false;
    const roleVisibility = moduleVisibility[user.role] || {};
    return roleVisibility[module] ?? true;
  };

  const updateModuleVisibility = (role: Role, moduleVisibilities: { [module: string]: boolean }) => {
    setModuleVisibility(prev => ({
      ...prev,
      [role]: moduleVisibilities
    }));
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
      roles: DEFAULT_ROLES,
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
      updateAttendance
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
