// Custom authentication client to replace Supabase
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  tenantId?: string;
  employeeId?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
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
        this.user = JSON.parse(savedUser);
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
        this.setAuth(result.token, result.user);
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

  // Sign in user
  async signInWithPassword(data: LoginData): Promise<{ data: { user: User } | null; error: Error | null }> {
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
      this.setAuth(result.token, result.user);

      return { data: { user: result.user }, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  // Company login
  async signInCompany(data: LoginData): Promise<{ data: { user: User } | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/company/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return { data: null, error: new Error(result.message || 'Company login failed') };
      }

      // Set auth data
      this.setAuth(result.token, result.user);

      return { data: { user: result.user }, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  // Sign out
  async signOut(): Promise<{ error: Error | null }> {
    try {
      this.clearAuth();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  // Get current user
  async getUser(): Promise<{ data: { user: User | null }; error: Error | null }> {
    if (!this.token) {
      return { data: { user: null }, error: null };
    }

    try {
      // Verify token with server
      const response = await fetch(`${API_BASE_URL}/api/me`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        this.clearAuth();
        return { data: { user: null }, error: new Error('Invalid session') };
      }

      const result = await response.json();
      this.user = result.user;
      localStorage.setItem(USER_KEY, JSON.stringify(this.user));

      return { data: { user: this.user }, error: null };
    } catch (error) {
      this.clearAuth();
      return { data: { user: null }, error: error as Error };
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
  return data.user;
};

export const getAccessToken = async () => {
  return customAuth.getAccessToken();
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return customAuth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
};
