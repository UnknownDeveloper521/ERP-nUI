// Custom authentication client to replace Supabase
import { API_BASE_URL } from './config';

export interface User {
  id: string;
  user_id?: string;
  username: string;
  email: string;
  role: string;
  role_code?: string;
  type?: string;
  userType?: string;
  tenantId?: string | number;
  tenant_id?: string | number;
  companyId?: string | number;
  company_id?: string | number;
  roleId?: string | number;
  role_id?: string | number;
  employeeId?: string | number;
  employee_id?: string | number;
  company?: any;
  permissions?: any[];
  assignedWorkcenterIds?: string[];
  assignedWarehouseIds?: string[];
  assignedOperationIds?: string[];
  assignedLocationIds?: string[];
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
  permissions?: any[]; // permissions -> groups -> modules[]
  dashboard?: any;
}

export interface RegisterData {
  email: string;
  password: string;
  username: string;
  role?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// Storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

const toIdString = (value: unknown): string | null => {
  if (value == null || value === '') return null;
  return String(value);
};

const mapRecordIds = (items: unknown, idKey: string): string[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => (item && typeof item === 'object' ? toIdString((item as Record<string, unknown>)[idKey]) : null))
    .filter((id): id is string => id != null);
};

/** Map login/verify root-level assignment payloads into auth_user ID arrays. */
const mapAssignedIdsFromAuthResult = (result: Record<string, unknown> = {}): {
  assignedWorkcenterIds: string[];
  assignedWarehouseIds: string[];
  assignedOperationIds: string[];
  assignedLocationIds: string[];
} => {
  const workcenter = result.workcenter ?? result.work_centers;
  const warehouse = result.warehouse ?? result.warehouses;
  const operation = result.operation ?? result.operations;
  const location = result.location ?? result.locations;

  let assignedLocationIds: string[] = [];
  if (Array.isArray(location)) {
    assignedLocationIds = mapRecordIds(location, 'location_id');
  } else if (location && typeof location === 'object') {
    const locationId = toIdString((location as Record<string, unknown>).location_id);
    if (locationId) assignedLocationIds = [locationId];
  }

  return {
    assignedWorkcenterIds: mapRecordIds(workcenter, 'work_center_id'),
    assignedWarehouseIds: mapRecordIds(warehouse, 'warehouse_id'),
    assignedOperationIds: mapRecordIds(operation, 'operation_id'),
    assignedLocationIds,
  };
};

// API client
class CustomAuthClient {
  private token: string | null = null;
  private user: User | null = null;
  private authStateListeners: ((user: User | null) => void)[] = [];

  constructor() {
    // Initialize from localStorage
    this.token = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        this.user = this.mapBackendUser(parsed, parsed);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        this.clearAuth();
      }
    }
  }

  // Register new user
  async signUp(data: RegisterData): Promise<{ data: { user: User } | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return { data: null, error: new Error(result.message || 'Registration failed') };
      }

      // Registration successful, but user needs to verify email
      // Don't set auth data yet - wait for email verification
      return {
        data: {
          user: {
            id: 'pending',
            username: data.username,
            email: data.email,
            role: data.role || 'user'
          }
        },
        error: null
      };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  // Verify email
  async verifyEmail(token: string): Promise<{ data: { user: User } | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { data: null, error: new Error(result.message || 'Email verification failed') };
      }

      // Set auth data after successful verification
      if (result.token && result.user) {
        const user = this.mapBackendUser(result.user, result);
        this.setAuth(result.token, user);
        return { data: { user }, error: null };
      }

      return { data: { user: result.user }, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  // Resend verification email
  async resendVerificationEmail(email: string): Promise<{ error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { error: new Error(result.message || 'Failed to resend verification email') };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  // Sign in user (unified login)
  async signInWithPassword(data: LoginData): Promise<{ data: { user: User; permissions?: any[] } | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return { data: null, error: new Error(result.message || 'Login failed') };
      }

      // Set auth data
      const user = this.mapBackendUser(result.user, result);
      this.setAuth(result.token, user);

      // Return both user and permissions
      return {
        data: {
          user,
          permissions: result.permissions || result.data?.permissions
        },
        error: null
      };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  // Company login (DEPRECATED - redirects to unified login)
  async signInCompany(data: LoginData): Promise<{ data: { user: User; permissions?: any[] } | null; error: Error | null }> {
    console.warn('DEPRECATED: signInCompany is deprecated. Use signInWithPassword instead.');

    try {
      // Use unified login endpoint
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return { data: null, error: new Error(result.message || 'Login failed') };
      }

      // Ensure this is a company user
      if (result.user.userType !== 'company_user') {
        return { data: null, error: new Error('This login method is for company users only') };
      }

      // Set auth data
      const user = this.mapBackendUser(result.user, result);
      this.setAuth(result.token, user);

      // Return both user and permissions
      return {
        data: {
          user,
          permissions: result.permissions || result.data?.permissions
        },
        error: null
      };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  // Sign out (unified logout)
  async signOut(): Promise<{ error: Error | null }> {
    try {
      // Call server logout endpoint to blacklist token
      if (this.token) {
        try {
          await fetch(`${API_BASE_URL}/api/logout`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.token}`,
            },
          });
        } catch (error) {
          console.warn('Server logout failed, clearing local auth anyway:', error);
        }
      }

      this.clearAuth();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  // Get current user
  async getUser(): Promise<{ data: { user: User | null; permissions?: any[] }; error: Error | null }> {
    if (!this.token) {
      this.clearAuth();
      return { data: { user: null }, error: null };
    }

    try {
      // Verify token with server - Updated endpoint to /api/auth/verify
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        // Only clear auth on 401 Unauthorized or 403 Forbidden
        if (response.status === 401 || response.status === 403) {
          console.warn('Session expired or unauthorized, clearing local auth.');
          this.clearAuth();
        }
        return { data: { user: null }, error: new Error('Invalid session') };
      }

      const result = await response.json();
      // Backend returns unified response with user
      // Resilient check for user data in various common response structures
      const rawUser = result.user || result.records || (result.data && result.data.user) || result.data || result;
      const user = this.preserveAssignedIdsFromStored(this.mapBackendUser(rawUser, result));
      this.user = user;
      localStorage.setItem(USER_KEY, JSON.stringify(this.user));

      return {
        data: {
          user: this.user,
          permissions: result.permissions || result.data?.permissions
        },
        error: null
      };
    } catch (error) {
      // Don't clear auth here to stay logged in on transient network issues
      console.error('Network or server error during getUser:', error);
      return { data: { user: this.user }, error: error as Error };
    }
  }

  // Get current session
  async getSession(): Promise<{ data: { session: { access_token: string; user: User } | null }; error: Error | null }> {
    if (!this.token || !this.user) {
      return { data: { session: null }, error: null };
    }

    return {
      data: {
        session: {
          access_token: this.token,
          user: this.user,
        },
      },
      error: null,
    };
  }

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: { user: User } | null) => void) {
    const listener = (user: User | null) => {
      callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user } : null);
    };

    this.authStateListeners.push(listener);

    // Return unsubscribe function
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const index = this.authStateListeners.indexOf(listener);
            if (index > -1) {
              this.authStateListeners.splice(index, 1);
            }
          },
        },
      },
    };
  }

  // Get access token
  getAccessToken(): string | null {
    return this.token;
  }

  // Private methods
  private setAuth(token: string, user: User) {
    this.token = token;
    this.user = user;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.notifyAuthStateChange();
  }

  private mapBackendUser(backendUser: any, result: any = {}): User {
    if (!backendUser) return backendUser;

    const assignedFromResult = mapAssignedIdsFromAuthResult(
      result && typeof result === 'object' ? result : {}
    );

    const pickAssignedIds = (
      mapped: string[],
      existing: unknown
    ): string[] | undefined => {
      if (mapped.length > 0) return mapped;
      if (Array.isArray(existing) && existing.length > 0) {
        return existing.map((id) => String(id));
      }
      return undefined;
    };

    const assignedWorkcenterIds = pickAssignedIds(
      assignedFromResult.assignedWorkcenterIds,
      backendUser.assignedWorkcenterIds
    );
    const assignedWarehouseIds = pickAssignedIds(
      assignedFromResult.assignedWarehouseIds,
      backendUser.assignedWarehouseIds
    );
    const assignedOperationIds = pickAssignedIds(
      assignedFromResult.assignedOperationIds,
      backendUser.assignedOperationIds
    );
    const assignedLocationIds = pickAssignedIds(
      assignedFromResult.assignedLocationIds,
      backendUser.assignedLocationIds
    );

    return {
      ...backendUser,
      id: backendUser.id || backendUser.user_id,
      email: backendUser.email || (result.data && result.data.email) || (result.user && result.user.email),
      username: backendUser.username || (result.data && result.data.username) || (result.user && result.user.username),
      role: backendUser.role || backendUser.role_code || (result.data && result.data.role_code),
      companyId: backendUser.companyId || backendUser.company_id || (result.company && result.company.id) || (result.data && result.data.company_id),
      roleId: backendUser.roleId || backendUser.role_id || (result.role_details && result.role_details.id) || (result.data && result.data.role_id),
      tenantId: backendUser.tenantId || backendUser.tenant_id || (result.company && result.company.tenant_id) || (result.data && result.data.tenant_id),
      employeeId: backendUser.employeeId || backendUser.employee_id || (result.data && result.data.employee_id),
      ...(assignedWorkcenterIds ? { assignedWorkcenterIds } : {}),
      ...(assignedWarehouseIds ? { assignedWarehouseIds } : {}),
      ...(assignedOperationIds ? { assignedOperationIds } : {}),
      ...(assignedLocationIds ? { assignedLocationIds } : {}),
    };
  }

  /** Keep assigned IDs from localStorage when verify/login response omits them. */
  private preserveAssignedIdsFromStored(user: User): User {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return user;
      const stored = JSON.parse(raw) as User;
      const next = { ...user };
      const keys: (keyof Pick<User, 'assignedWorkcenterIds' | 'assignedWarehouseIds' | 'assignedOperationIds' | 'assignedLocationIds'>)[] = [
        'assignedWorkcenterIds',
        'assignedWarehouseIds',
        'assignedOperationIds',
        'assignedLocationIds',
      ];
      for (const key of keys) {
        const current = next[key];
        const previous = stored[key];
        if ((!current || current.length === 0) && previous?.length) {
          next[key] = previous.map((id) => String(id));
        }
      }
      return next;
    } catch {
      return user;
    }
  }

  private clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.notifyAuthStateChange();
  }

  private notifyAuthStateChange() {
    this.authStateListeners.forEach(listener => listener(this.user));
  }
}

// Create singleton instance
export const customAuth = new CustomAuthClient();

// Helper functions to match Supabase API
export const signUpWithEmail = async (email: string, password: string, username?: string) => {
  return customAuth.signUp({
    email,
    password,
    username: username || email.split('@')[0],
  });
};

export const verifyEmailWithToken = async (token: string) => {
  return customAuth.verifyEmail(token);
};

export const resendVerification = async (email: string) => {
  return customAuth.resendVerificationEmail(email);
};

export const signInWithEmail = async (email: string, password: string) => {
  return customAuth.signInWithPassword({ email, password });
};

export const signInCompanyWithEmail = async (email: string, password: string) => {
  return customAuth.signInCompany({ email, password });
};

export const signOut = async () => {
  return customAuth.signOut();
};

export const getCurrentUser = async () => {
  const { data } = await customAuth.getUser();
  return { user: data?.user, permissions: data?.permissions };
};

export const getAccessToken = async () => {
  return customAuth.getAccessToken();
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return customAuth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
};
