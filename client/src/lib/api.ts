// API client for ERP system
const API_BASE = '/api';

import { getAccessToken } from "@/lib/supabase";

// Generic fetch wrapper
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ==================== HRMS API ====================

export const employeesApi = {
  getAll: () => apiRequest<any[]>('/employees'),
  getOne: (id: string) => apiRequest<any>(`/employees/${id}`),
  create: (data: any) => apiRequest<any>('/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest<void>(`/employees/${id}`, {
    method: 'DELETE',
  }),
};

export const departmentsApi = {
  getAll: () => apiRequest<any[]>('/departments'),
  getOne: (id: string) => apiRequest<any>(`/departments/${id}`),
  create: (data: any) => apiRequest<any>('/departments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/departments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest<void>(`/departments/${id}`, {
    method: 'DELETE',
  }),
};

export const attendanceApi = {
  getAll: () => apiRequest<any[]>('/attendance'),
  getByEmployee: (employeeId: string) => apiRequest<any[]>(`/attendance/employee/${employeeId}`),
  create: (data: any) => apiRequest<any>('/attendance', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export const leavesApi = {
  getAll: () => apiRequest<any[]>('/leaves'),
  getByEmployee: (employeeId: string) => apiRequest<any[]>(`/leaves/employee/${employeeId}`),
  create: (data: any) => apiRequest<any>('/leaves', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateStatus: (id: string, status: string, approvedBy?: string) => apiRequest<any>(`/leaves/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, approvedBy }),
  }),
};

export const payrollApi = {
  getAll: () => apiRequest<any[]>('/payroll'),
  getByEmployee: (employeeId: string) => apiRequest<any[]>(`/payroll/employee/${employeeId}`),
  create: (data: any) => apiRequest<any>('/payroll', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/payroll/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};

export const jobPostingsApi = {
  getAll: () => apiRequest<any[]>('/job-postings'),
  getOne: (id: string) => apiRequest<any>(`/job-postings/${id}`),
  create: (data: any) => apiRequest<any>('/job-postings', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/job-postings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};

export const applicationsApi = {
  getAll: () => apiRequest<any[]>('/applications'),
  getByJob: (jobPostingId: string) => apiRequest<any[]>(`/applications/job/${jobPostingId}`),
  create: (data: any) => apiRequest<any>('/applications', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateStatus: (id: string, status: string) => apiRequest<any>(`/applications/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
};

// ==================== INVENTORY API ====================

export const productsApi = {
  getAll: () => apiRequest<any[]>('/products'),
  getOne: (id: string) => apiRequest<any>(`/products/${id}`),
  create: (data: any) => apiRequest<any>('/products', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest<void>(`/products/${id}`, {
    method: 'DELETE',
  }),
};

export const stockMovementsApi = {
  getAll: () => apiRequest<any[]>('/stock-movements'),
  getByProduct: (productId: string) => apiRequest<any[]>(`/stock-movements/product/${productId}`),
  create: (data: any) => apiRequest<any>('/stock-movements', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export const inventoryThresholdsApi = {
  getAll: () => apiRequest<any[]>('/thresholds'),
  upsert: (data: any) =>
    apiRequest<any>('/thresholds', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiRequest<void>(`/thresholds/${id}`, {
      method: 'DELETE',
    }),
};

export const stockAlertsApi = {
  getAll: () => apiRequest<any[]>('/stock-alerts'),
};

export const rawMaterialsApi = {
  getAll: (materialType?: string) => {
    const q = materialType ? `?material_type=${encodeURIComponent(materialType)}` : "";
    return apiRequest<any[]>(`/raw-materials${q}`);
  },
};

export const rawMaterialStockApi = {
  getOne: (materialType: string, materialId: string, warehouseLocation: string, warehouseId?: string) => {
    let q = `?material_type=${encodeURIComponent(materialType)}&material_id=${encodeURIComponent(materialId)}&warehouse_location=${encodeURIComponent(warehouseLocation)}`;
    if (warehouseId) {
      q += `&warehouse_id=${encodeURIComponent(warehouseId)}`;
    }
    return apiRequest<{ available_qty: number }>(`/raw-material-stock${q}`);
  },
};

export const stockAdjustmentsApi = {
  getAll: (limit = 50) => apiRequest<any[]>(`/stock-adjustments?limit=${encodeURIComponent(String(limit))}`),
  create: (data: any) =>
    apiRequest<any>("/stock-adjustments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ==================== CUSTOMERS & SUPPLIERS API ====================

export const customersApi = {
  getAll: () => apiRequest<any[]>('/customers'),
  getOne: (id: string) => apiRequest<any>(`/customers/${id}`),
  create: (data: any) => apiRequest<any>('/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest<void>(`/customers/${id}`, {
    method: 'DELETE',
  }),
};

export const suppliersApi = {
  getAll: () => apiRequest<any[]>('/suppliers'),
  getOne: (id: string) => apiRequest<any>(`/suppliers/${id}`),
  create: (data: any) => apiRequest<any>('/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest<void>(`/suppliers/${id}`, {
    method: 'DELETE',
  }),
};

// ==================== SALES & PURCHASE ORDERS API ====================

export const salesOrdersApi = {
  getAll: () => apiRequest<any[]>('/sales-orders'),
  getOne: (id: string) => apiRequest<any>(`/sales-orders/${id}`),
  create: (data: any) => apiRequest<any>('/sales-orders', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/sales-orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  getItems: (id: string) => apiRequest<any[]>(`/sales-orders/${id}/items`),
  createItem: (data: any) => apiRequest<any>('/sales-order-items', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export const purchaseOrdersApi = {
  getAll: () => apiRequest<any[]>('/purchase-orders'),
  getOne: (id: string) => apiRequest<any>(`/purchase-orders/${id}`),
  create: (data: any) => apiRequest<any>('/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/purchase-orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  getItems: (id: string) => apiRequest<any[]>(`/purchase-orders/${id}/items`),
  createItem: (data: any) => apiRequest<any>('/purchase-order-items', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// ==================== CRM API ====================

export const leadsApi = {
  getAll: () => apiRequest<any[]>('/leads'),
  getOne: (id: string) => apiRequest<any>(`/leads/${id}`),
  create: (data: any) => apiRequest<any>('/leads', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};

export const opportunitiesApi = {
  getAll: () => apiRequest<any[]>('/opportunities'),
  getOne: (id: string) => apiRequest<any>(`/opportunities/${id}`),
  create: (data: any) => apiRequest<any>('/opportunities', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/opportunities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};

// ==================== ACCOUNTING API ====================

export const accountsApi = {
  getAll: () => apiRequest<any[]>('/accounts'),
  getOne: (id: string) => apiRequest<any>(`/accounts/${id}`),
  create: (data: any) => apiRequest<any>('/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export const transactionsApi = {
  getAll: () => apiRequest<any[]>('/transactions'),
  getByAccount: (accountId: string) => apiRequest<any[]>(`/transactions/account/${accountId}`),
  create: (data: any) => apiRequest<any>('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// ==================== LOGISTICS API ====================

export const vehiclesApi = {
  getAll: () => apiRequest<any[]>('/vehicles'),
  getOne: (id: string) => apiRequest<any>(`/vehicles/${id}`),
  create: (data: any) => apiRequest<any>('/vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};

export const tripsApi = {
  getAll: () => apiRequest<any[]>('/trips'),
  getOne: (id: string) => apiRequest<any>(`/trips/${id}`),
  create: (data: any) => apiRequest<any>('/trips', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest<any>(`/trips/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};
