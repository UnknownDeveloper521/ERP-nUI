// API client for ERP system
import { getAccessToken } from './supabase';

import { API_BASE, HAS_BACKEND_API } from './config';
import {
  fetchSkuDropdown,
  parseSkuDropdownRecords,
  skuApi,
  skuOperationApi,
  type SkuDropdownRecord,
  type SkuDetailRecord,
  type CreateSkuRequest,
  type SkuOperationListRecord,
  type SkuOperationDetailRecord,
  type SkuOperationDetailOperation,
} from './skuApi';

export {
  fetchSkuDropdown,
  parseSkuDropdownRecords,
  skuApi,
  skuOperationApi,
  type SkuDropdownRecord,
  type SkuDetailRecord,
  type CreateSkuRequest,
  type SkuOperationListRecord,
  type SkuOperationDetailRecord,
  type SkuOperationDetailOperation,
};

// Generic fetch wrapper
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  if (!HAS_BACKEND_API) {
    throw new Error("Backend API is not configured. This UI preview uses local mock data.");
  }

  const token = await getAccessToken();
  const headers: Record<string, string> = {
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options?.headers as Record<string, string>,
  };

  // Only set Content-Type if it's not FormData
  if (!(options?.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && HAS_BACKEND_API) {
      console.warn('Unauthorized request detected (401). Clearing session...');
      localStorage.removeItem('currentUser');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Multipart/form-data request wrapper (for file uploads — no Content-Type header so browser sets boundary)
async function apiFormDataRequest<T>(endpoint: string, formData: FormData): Promise<T> {
  if (!HAS_BACKEND_API) {
    throw new Error("Backend API is not configured. This UI preview uses local mock data.");
  }

  const token = await getAccessToken();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'An error occurred' }));
    const err = new Error((errorData as any)?.message || `HTTP ${response.status}`);
    (err as any).data = errorData;
    throw err;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ==================== CORE MASTERS API ====================

export interface CountryRecord {
  id: number;
  country_code: string;
  country_name: string;
  status: boolean; // true = Active, false = Inactive
  created_at?: string;
  updated_at?: string;
  created_by?: number;
  updated_by?: number;
}

export interface CountryListResponse {
  data: {
    records: CountryRecord[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  };
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface CountryCreateResponse {
  data: CountryRecord | null;
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export const countriesApi = {
  getList: (params: { page?: number; limit?: number; search?: string; status?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status !== undefined) query.set('status', String(params.status));
    const qs = query.toString();
    return apiRequest<CountryListResponse>(`/masters/countries/getcountrieslist${qs ? `?${qs}` : ''}`);
  },
  getById: (id: number) =>
    apiRequest<CountryCreateResponse>(`/masters/countries/getcountries?id=${id}`),
  create: (data: { country_code: string; country_name: string; status: boolean }) =>
    apiRequest<CountryCreateResponse>('/masters/countries/createcountries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: { country_name: string; status: boolean }) =>
    apiRequest<CountryCreateResponse>(`/masters/countries/updatecountries?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiRequest<CountryCreateResponse>(`/masters/countries/deletecountries?id=${id}`, {
      method: 'DELETE',
    }),
};

// ==================== STATES API ====================

export interface StateRecord {
  id: number;
  state_code: string;
  state_name: string;
  country_id: number;
  country_name?: string;
  status: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StateListResponse {
  data: {
    records: StateRecord[];
    pagination: { page: number; limit: number; totalCount: number; totalPages: number };
  };
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface StateResponse {
  data: StateRecord | null;
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface CountryDropdownRecord {
  id: number;
  country_code: string;
  country_name: string;
}

export interface CountryDropdownResponse {
  data: { records: CountryDropdownRecord[] } | null;
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface StateDropdownRecord {
  id: number;
  state_code: string;
  state_name: string;
  country_id: number;
}

export interface StateDropdownResponse {
  data: { records: StateDropdownRecord[] } | null;
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface VendorRecord {
  id: number;
  name: string;
}

export interface VendorListResponse {
  data: {
    records: VendorRecord[];
  } | null;
  message: string;
  showMessage: boolean | string;
  isSuccessful: boolean;
}

export interface ProcurementStatusRecord {
  status_id: number;
  status_name: string;
}

export interface ProcurementStatusResponse {
  data: { records: ProcurementStatusRecord[] } | null;
  message: string;
  showMessage: boolean | string;
  isSuccessful: boolean;
}

export interface ItemWithStockRecord {
  item_id: number;
  item_code: string;
  item_name: string;
  uom: string;
  uom_id: number;
  item_type: string;
  item_type_id: number;
  stock_qty: number;
}

export interface ItemWithStockResponse {
  data: {
    records: ItemWithStockRecord[];
  };
}

export interface MRListRecord {
  id: number;
  mr_code: string;
  mr_date: string;
  location_id: number;
  location_name: string;
  workcenter_id: number | null;
  workcenter_name: string;
  status_id: number;
  status_name: string;
  department_id: number;
  department_name: string;
  request_by: string;
}

export interface MRListResponse {
  data: {
    records: MRListRecord[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  } | null;
  message: string;
  showMessage: string | boolean;
  isSuccessful: boolean;
}

export interface POSubmitRequest {
  payment_term_id: number;
  currency_id?: number;
  remarks: string;
  items: Array<{
    id: number;
    price_per_uom: number;
    delivery_date: string;
  }>;
}

export interface POItemWithMR {
  items_id: number;
  item_code: string;
  item_name: string;
  quantity: number;
}

export interface POItemWithMRResponse {
  data: {
    records: POItemWithMR[];
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface POListRecord {
  id: number;
  po_code: string;
  po_date: string;
  vendor_name: string;
  location_name: string;
  warehouse_name: string;
  status_name: string;
}

export interface POListResponse {
  data: {
    records: POListRecord[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface PODetailItem {
  id: number;
  po_id: number;
  item_id: number;
  item_code: string;
  item_name: string;
  item_type_id: number;
  item_type_name: string;
  requested_qty: number;
  received_qty: number;
  uom: string;
  price_per_uom: number | null;
  delivery_date: string | null;
}

export interface PODetailRecord {
  id: number;
  po_code: string;
  po_date: string;
  vendor_id: number;
  vendor_name: string;
  location_id: number;
  location_name: string;
  warehouse_id: number;
  warehouse_name: string;
  status_id: number;
  status_name: string;
  payment_term_id: number | null;
  payment_term_name: string | null;
  currency_id?: number | null;
  currency_name?: string | null;
  remarks: string | null;
  items: PODetailItem[];
}

export interface PODetailResponse {
  data: PODetailRecord;
  message: string;
  showMessage: string | boolean;
  isSuccessful: boolean;
}

export interface POReceiptItem {
  grn_item_id: number;
  item: {
    id: number;
    code: string;
    name: string;
  };
  received_qty: number;
  receive_date: string;
  document_url: string | null;
  document_name: string | null;
  remarks: string | null;
}

export interface POReceiptsResponse {
  data: {
    receipts: POReceiptItem[];
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface GRNListRecord {
  id: number;
  po_code: string;
  po_date: string;
  vendor_name: string;
  location_name: string;
  warehouse_name: string;
  status: string;
}

export interface GRNListResponse {
  data: {
    records: GRNListRecord[];
    pagination: {
      page: number;
      limit: number;
      totalRecords: number;
      totalCount?: number;
      totalPages: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface GRNReceiveItem {
  po_item_id: number;
  received_qty: number;
  receive_date: string;
  remarks: string;
  attachment: string;
}

export interface GRNReceiveRequest {
  po_id: number;
  items: GRNReceiveItem[];
}

export interface GRNReceptionEntriesResponse {
  data: {
    records: POReceiptItem[];
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface MRDetailItem {
  item_id: number;
  item_code: string;
  item_name: string;
  item_type: string;
  uom: string;
  requested_qty: number;
}

export interface CreatePORequest {
  mr_id: number;
  selected_items: {
    mr_item_id: number;
    requested_qty: number;
  }[];
  vendor_id: number;
  warehouse_id: number;
}

export interface CreateQuotationRequest {
  mr_id: number;
  vendor_id: number;
  notes: string;
  file?: File;
}

export interface CreatePOResponse {
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface MRDetailResponse {
  data: {
    id: number;
    mr_code: string;
    mr_date: string;
    status: string;
    requested_by: string;
    location_name: string;
    work_center_name: string;
    department_name: string;
    items: MRDetailItem[];
  } | null;
  message: string;
  showMessage: string | boolean;
  isSuccessful: boolean;
}

export interface MRExecutionItem {
  mr_item_id: number;
  item_id: number;
  item_code: string;
  item_name: string;
  uom: string;
  requested_qty: number;
  stock_qty: number;
  po_id: number | null;
  po_code: string | null;
}

export interface MRExecutionQuotation {
  quotation_id: number;
  vendor_id: number;
  vendor_name: string;
  notes: string;
  file_url: string | null;
}

export interface MRExecutionDetail {
  id: number;
  mr_date: string;
  status_name: string;
  requested_by: string;
  location_name: string;
  workcenter_name: string;
  department_name: string;
  items: MRExecutionItem[];
  quotations: MRExecutionQuotation[];
}

export interface MRExecutionByIdResponse {
  data: MRExecutionDetail;
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface MRCreateRequest {
  mr_date: string;
  location_id: number;
  work_center_id: number;
  department_id: number;
  items: Array<{
    item_id: number;
    requested_qty: number;
  }>;
}

export const statesApi = {
  getList: (params: { page?: number; limit?: number; search?: string; country_id?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.country_id !== undefined) query.set('country_id', String(params.country_id));
    const qs = query.toString();
    return apiRequest<StateListResponse>(`/masters/states/getstatelist${qs ? `?${qs}` : ''}`);
  },
  getById: (id: number) =>
    apiRequest<StateResponse>(`/masters/states/getstate?id=${id}`),
  create: (data: { country_id: number; state_code: string; state_name: string; status: boolean }) =>
    apiRequest<StateResponse>('/masters/states/createstate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: { state_name: string; country_id?: number; status: boolean }) =>
    apiRequest<StateResponse>(`/masters/states/updatestate?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        state_name: data.state_name,
        ...(data.country_id !== undefined && { country_id: data.country_id }),
        status: data.status ? 1 : 0,
      }),
    }),
  delete: (id: number) =>
    apiRequest<StateResponse>(`/masters/states/deletestate?id=${id}`, {
      method: 'DELETE',
    }),
};

// commonApi moved to common dropdowns section (line 493)


// ==================== CITIES API ====================

export interface CityRecord {
  id: number;
  city_code: string;
  city_name: string;
  state_id: number;
  state_name?: string;
  country_id?: number;
  country_name?: string;
  status: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CityListResponse {
  data: {
    records: CityRecord[];
    pagination: { page: number; limit: number; totalCount: number; totalPages: number };
  };
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface CityResponse {
  data: CityRecord | null;
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}
export const citiesApi = {
  getList: (params: { page?: number; limit?: number; search?: string; state_id?: number; country_id?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.state_id !== undefined) query.set('state_id', String(params.state_id));
    if (params.country_id !== undefined) query.set('country_id', String(params.country_id));
    const qs = query.toString();
    return apiRequest<CityListResponse>(`/masters/cities/getcitieslist${qs ? `?${qs}` : ''}`);
  },
  getById: (id: number) =>
    apiRequest<CityResponse>(`/masters/cities/getcities?id=${id}`),
  create: (data: { state_id: number; city_code: string; city_name: string; status: boolean }) =>
    apiRequest<CityResponse>('/masters/cities/createcities', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        status: data.status ? 1 : 0,
      }),
    }),
  update: (id: number, data: { city_name: string; state_id?: number; status: boolean }) =>
    apiRequest<CityResponse>(`/masters/cities/updatecities?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        city_name: data.city_name,
        ...(data.state_id !== undefined && { state_id: data.state_id }),
        status: data.status ? 1 : 0,
      }),
    }),
  delete: (id: number) =>
    apiRequest<CityResponse>(`/masters/cities/deletecities?id=${id}`, {
      method: 'DELETE',
    }),
};
// commonApi moved to common dropdowns section

// ==================== HOLIDAY API ====================

export interface HolidayRecord {
  id: number;
  company_id: number;
  holiday_name: string;
  holiday_date: string;
  status: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HolidayListResponse {
  data: {
    records: HolidayRecord[];
    pagination: { page: number; limit: number; totalCount: number; totalPages: number };
  };
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface HolidayResponse {
  data: HolidayRecord | null;
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export const holidayApi = {
  getList: (params: { page?: number; limit?: number; search?: string; status?: boolean; year?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.year !== undefined) query.set('year', String(params.year));
    if (params.status !== undefined) query.set('status', String(params.status));
    const qs = query.toString();
    return apiRequest<HolidayListResponse>(`/hr/holiday/getholidaylist${qs ? `?${qs}` : ''}`);
  },
  getById: (id: number) =>
    apiRequest<HolidayResponse>(`/hr/holiday/getholidaydetail/${id}`),
  create: (data: { company_id: number; holiday_name: string; holiday_date: string; status: boolean }) =>
    apiRequest<HolidayResponse>('/hr/holiday/createholiday', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (data: { id: number; company_id: number; holiday_name: string; holiday_date: string; status: boolean }) =>
    apiRequest<HolidayResponse>(`/hr/holiday/updateholiday/${data.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiRequest<HolidayResponse>(`/hr/holiday/deleteholiday/${id}`, {
      method: 'DELETE',
    }),
};

// ==================== HRMS API ====================

export interface HRMSDashboardResponse {
  data: {
    overview: {
      total_employees: number;
      total_departments: number;
      total_job_roles: number;
      total_work_locations: number;
    };
    role_based_distribution: Array<{ role_name: string; employee_count: number }>;
    department_distribution: Array<{ department_name: string; employee_count: number }>;
    work_location_snapshot: Array<{ location_name: string; employee_count: number }>;
    shift_distribution: Array<{ shift_name: string; employee_count: number }>;
    erp_distribution: Array<{ work_center_name: string; employee_count: number }>;
    upcoming_holidays: Array<{ holiday_name: string; holiday_date: string }>;
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export const hrmsDashboardApi = {
  getDetails: () => apiRequest<HRMSDashboardResponse>('/hrms/dashboard/getdashboarddetails'),
};

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
  // Get paginated list of attendance
  getList: (params: { page?: number; limit?: number; search_text?: string; department_id?: number; location_id?: number; date?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.search_text) query.set('search_text', params.search_text);
    if (params.department_id !== undefined) query.set('department_id', String(params.department_id));
    if (params.location_id !== undefined) query.set('location_id', String(params.location_id));
    if (params.date) query.set('date', params.date);
    const qs = query.toString();
    return apiRequest<any>(`/hr/attendance/getattendancelist${qs ? `?${qs}` : ''}`);
  },
  // Save single attendance
  save: (data: any) => apiRequest<any>('/hr/attendance/saveattendance', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  // Save bulk attendance
  saveBulk: (data: any) => apiRequest<any>('/hr/attendance/savebulkattendance', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getEmployeeListForAttendance: (params: { attendance_date: string; department_id?: number }) => {
    const query = new URLSearchParams();
    query.set('attendance_date', params.attendance_date);
    if (params.department_id !== undefined) {
      query.set('department_id', String(params.department_id));
    }
    return apiRequest<any>(`/hr/attendance/bulkattendance/getemployeelistforattendance?${query.toString()}`);
  },
};

// ==================== HRMS LEAVE MANAGEMENT API ====================

export interface LeaveRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  code: string;
  leave_type_id: number;
  leave_type_name: string;
  from_date: string;
  to_date: string;
  duration: number;
  is_paid_leave: boolean;
  remarks: string;
  attachments: { id: number; file_name: string; file_url: string }[];
}

export interface LeaveListResponse {
  data: {
    records: LeaveRecord[];
    pagination: {
      total: number;
      page: number;
      limit: number;
    };
  };
  message: string;
  isSuccessful: boolean;
}

export interface LeaveDetailResponse {
  data: LeaveRecord | null;
  message: string;
  isSuccessful: boolean;
}

export interface LeaveCalendarResponse {
  data: {
    year: number;
    month: number;
    employees: {
      employee_code: string;
      employee_name: string;
      leaves: {
        from_date: string;
        to_date: string;
        is_paid_leave: boolean;
        leave_type_name: string;
        remarks: string;
      }[];
    }[];
  };
  message: string;
  isSuccessful: boolean;
}

export const leaveManagementApi = {
  getList: (params: { page?: number; limit?: number; search?: string; from_date?: string; to_date?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.from_date) query.set('from_date', params.from_date);
    if (params.to_date) query.set('to_date', params.to_date);
    const qs = query.toString();
    return apiRequest<LeaveListResponse>(`/hr/leavemanagement/getleavelist${qs ? `?${qs}` : ''}`);
  },
  getById: (id: number) =>
    apiRequest<LeaveDetailResponse>(`/hr/leavemanagement/getleave/${id}`),
  create: (formData: FormData) =>
    apiRequest<any>('/hr/leavemanagement/createleave', {
      method: 'POST',
      body: formData,
    }),
  update: (id: number, formData: FormData) =>
    apiRequest<any>(`/hr/leavemanagement/updateleave/${id}`, {
      method: 'PATCH',
      body: formData,
    }),
  delete: (id: number) =>
    apiRequest<any>(`/hr/leavemanagement/deleteleave/${id}`, {
      method: 'DELETE',
    }),
  deleteAttachments: (leaveEntryId: number) =>
    apiRequest<any>(`/hr/leavemanagement/deleteleaveattachments?leave_entry_id=${leaveEntryId}`, {
      method: 'DELETE',
    }),
  getCalendar: (month: number, year: number) =>
    apiRequest<LeaveCalendarResponse>(`/hr/leavemanagement/getcalendar?month=${month}&year=${year}`),
};

export const payrollApi = {
  getRunPayrollList: (params: { page?: number; limit?: number; search?: string; payroll_period_id?: number; department_id?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.payroll_period_id !== undefined) query.set('payroll_period_id', String(params.payroll_period_id));
    if (params.department_id !== undefined) query.set('department_id', String(params.department_id));
    const qs = query.toString();
    return apiRequest<any>(`/hr/payroll/getrunpayrolllist${qs ? `?${qs}` : ''}`);
  },
  getPayrollDetail: (employeeId: number, payrollPeriodId: number) =>
    apiRequest<any>(`/hr/payroll/getpayrolldetail?employee_id=${employeeId}&pay_period_id=${payrollPeriodId}`),
  updatePayrollDetail: (employeeId: number, payrollPeriodId: number, data: any) =>
    apiRequest<any>(`/hr/payroll/updatepayrolldetail?employee_id=${employeeId}&pay_period_id=${payrollPeriodId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getPayslipsList: (params: { page?: number; limit?: number; search?: string; pay_period_id?: number; department_id?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.pay_period_id !== undefined) query.set('pay_period_id', String(params.pay_period_id));
    if (params.department_id !== undefined) query.set('department_id', String(params.department_id));
    const qs = query.toString();
    return apiRequest<any>(`/hr/payroll/getpayslipslist${qs ? `?${qs}` : ''}`);
  },
  getPayslipDetail: (employeeId: number, payPeriodId: number) =>
    apiRequest<any>(`/hr/payroll/getpayslipdetail?employee_id=${employeeId}&pay_period_id=${payPeriodId}`),
};

export const payPeriodsApi = {
  getList: () => apiRequest<any>('/hr/pay-period/getpayperiodlist'),
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

// ==================== WAREHOUSE MASTER API ====================
export const warehouseApi = {
  // Get paginated list of warehouses
  getAll: (page: number = 1, limit: number = 10, search?: string, status?: number) => {
    let url = `/masters/warehouse/getwarehouselist?page=${page}&limit=${limit}`;
    if (search) url += `&search=${search}`;
    if (status !== undefined) url += `&status=${status}`;
    return apiRequest<any>(url);
  },
  // Get a single warehouse by ID (for Edit form)
  getOne: (id: number) => apiRequest<any>(`/masters/warehouse/getwarehouse/${id}`),
  // Create a new warehouse
  create: (data: any) => apiRequest<any>('/masters/warehouse/createwarehouse', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  // Update an existing warehouse
  update: (data: any) => apiRequest<any>('/masters/warehouse/updatewarehouse', {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  // Soft delete a warehouse
  delete: (id: number) => apiRequest<any>(`/masters/warehouse/deletewarehouse/${id}`, {
    method: 'DELETE',
  }),
};

// ==================== BINS MASTER API ====================
export const binsApi = {
  // Get paginated list of bins
  getAll: (page: number = 1, limit: number = 10, search?: string, warehouse_id?: number, status?: number) => {
    let url = `/masters/bins/getbinslist?page=${page}&limit=${limit}`;
    if (search) url += `&search=${search}`;
    if (warehouse_id) url += `&warehouse_id=${warehouse_id}`;
    if (status !== undefined) url += `&status=${status}`;
    return apiRequest<any>(url);
  },
  // Get a single bin by ID
  getOne: (id: number) => apiRequest<any>(`/masters/bins/getbin/${id}`),
  // Create a new bin
  create: (data: any) => apiRequest<any>('/masters/bins/createbin', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  // Update an existing bin
  update: (id: number, data: any) => apiRequest<any>(`/masters/bins/updatebin/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  // Soft delete a bin
  delete: (id: number) => apiRequest<any>(`/masters/bins/deletebin/${id}`, {
    method: 'DELETE',
  }),
};

// ==================== COMMON DROPDOWNS API ====================
export const commonApi = {
  // Get countries for dropdowns
  getCountriesDropdown: () => apiRequest<CountryDropdownResponse>('/common/getcountries'),
  // Get states for dropdowns
  getStatesDropdown: (countryId?: number) => {
    const params = new URLSearchParams();
    if (countryId !== undefined) params.set('country_id', String(countryId));
    const qs = params.toString();
    return apiRequest<StateDropdownResponse>(`/common/getstates${qs ? `?${qs}` : ''}`);
  },
  // Get active departments for dropdowns
  getDepartments: () => apiRequest<any>('/common/getdepartment?status=1'),
  // Get active pay periods for dropdowns
  getPayPeriods: (search?: string) => apiRequest<any>(`/common/getpayperiods${search ? `?search=${search}` : ''}`),
  // Get active locations for dropdowns
  getLocations: () => apiRequest<any>('/common/getlocation?status=1'),
  // Get active bin types for dropdowns
  getBinTypes: () => apiRequest<any>('/common/getbintypes?status=1'),
  // Get active warehouses for dropdowns
  getWarehouses: () => apiRequest<any>('/common/getwarehouses?status=1'),
  // Get sales order items for dispatch dropdown
  getSalesOrderItems: (id: number) => apiRequest<any>(`/common/getsalesorderitems?id=${id}`),
  // Get item types for dropdowns
  getItemTypes: () => apiRequest<any>('/common/getitemtypes?status=1'),
  // Get UOMs for dropdowns
  getUOMs: (status?: number) => {
    const qs = status !== undefined ? `?status=${status}` : '';
    return apiRequest<any>(`/common/getuoms${qs}`);
  },
  // Get items for dropdowns (supports filters from common route)
  getItemsDropdown: (params?: { item_type_id?: number; status?: number; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.item_type_id !== undefined) query.append('item_type_id', String(params.item_type_id));
    if (params?.status !== undefined) query.append('status', String(params.status));
    if (params?.search) query.append('search', params.search);
    const qs = query.toString();
    return apiRequest<any>(`/common/getitems${qs ? `?${qs}` : ''}`);
  },
  // Get employees with detail for dropdowns
  getEmployeesWithDetail: () => apiRequest<any>('/common/getemployeeswithdetail'),
  // Get customers with details for quotation form dropdown
  getCustomerWithDetails: (params?: { customer_id?: number; search?: string; status?: number }) => {
    const query = new URLSearchParams();
    if (params?.customer_id !== undefined) query.append('customer_id', String(params.customer_id));
    if (params?.search) query.append('search', params.search);
    if (params?.status !== undefined) query.append('status', String(params.status));
    const qs = query.toString();
    return apiRequest<any>(`/common/getcustomerwithdetails${qs ? `?${qs}` : ''}`);
  },
  // Get quotation details for quotation reference dropdown (supports customer filter)
  getQuotationWithDetails: (params?: { customer_id?: number; quotation_id?: number; search?: string; status?: number }) => {
    const query = new URLSearchParams();
    if (params?.customer_id !== undefined) query.append('customer_id', String(params.customer_id));
    if (params?.quotation_id !== undefined && !isNaN(Number(params.quotation_id))) {
      query.append('quotation_id', String(params.quotation_id));
    }
    if (params?.search) query.append('search', params.search);
    if (params?.status !== undefined) query.append('status', String(params.status));
    const qs = query.toString();
    return apiRequest<any>(`/common/getquotationwithdetails${qs ? `?${qs}` : ''}`);
  },
  // Get active work centers for dropdowns
  getWorkCenters: () => apiRequest<any>('/common/getworkcenters?status=1'),
  // Get operations for dropdowns
  getOperations: () => apiRequest<any>('/common/getoperations'),
  // Get MR for batch creation
  getMRForBatch: (params?: { shift_id?: number | string }) => {
    const query = new URLSearchParams();
    if (params?.shift_id) query.append('shift_id', String(params.shift_id));
    const qs = query.toString();
    return apiRequest<any>(`/common/getmrforbatch${qs ? `?${qs}` : ''}`);
  },
  // Get payment terms for dropdowns
  getPaymentTerms: (status?: number) => {
    let url = '/common/getpaymentterms';
    if (status !== undefined) url += `?status=${status}`;
    return apiRequest<any>(url);
  },
  // Get currencies for dropdowns
  getCurrencies: (status?: number) => {
    let url = '/common/getcurrencies';
    if (status !== undefined) url += `?status=${status}`;
    return apiRequest<any>(url);
  },
  // Get procurement status for dropdowns
  getProcurementStatus: () => apiRequest<ProcurementStatusResponse>('/common/getprocurementstatus'),
  // Get active vendors for dropdowns
  getVendors: () => apiRequest<VendorListResponse>('/common/getvendor'),
  // Get states for dropdowns
  getStates: (countryId?: number, status?: number) => {
    const params = new URLSearchParams();
    if (countryId !== undefined) params.set('country_id', String(countryId));
    if (status !== undefined) params.set('status', String(status));
    const qs = params.toString();
    return apiRequest<any>(`/common/getstates${qs ? `?${qs}` : ''}`);
  },
  // Get cities for dropdowns
  getCities: (stateId?: number, countryId?: number, status?: number) => {
    const params = new URLSearchParams();
    if (stateId !== undefined) params.set('state_id', String(stateId));
    if (countryId !== undefined) params.set('country_id', String(countryId));
    if (status !== undefined) params.set('status', String(status));
    const qs = params.toString();
    return apiRequest<any>(`/common/getcities${qs ? `?${qs}` : ''}`);
  },
  // Get earning types for dropdowns
  getEarningTypes: (status?: number) => {
    let url = '/common/getearning-types';
    if (status !== undefined) url += `?status=${status}`;
    return apiRequest<any>(url);
  },
  // Get deduction types for dropdowns
  getDeductionTypes: (status?: number) => {
    let url = '/common/getdeduction-types';
    if (status !== undefined) url += `?status=${status}`;
    return apiRequest<any>(url);
  },
  // Get employees for dropdowns
  getEmployees: (params?: { designation_id?: number, department_id?: number, status?: number, search?: string, employment_status_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.employment_status_id !== undefined) query.set('employment_status_id', String(params.employment_status_id));
    if (params?.status !== undefined) query.set('status', String(params.status));
    // If neither is provided, default to status=1 to preserve existing behavior for other components
    if (params?.status === undefined && params?.employment_status_id === undefined) {
      query.set('status', '1');
    }
    if (params?.designation_id !== undefined) query.set('designation_id', String(params.designation_id));
    if (params?.department_id !== undefined) query.set('department_id', String(params.department_id));
    if (params?.search) query.set('search', params.search);
    return apiRequest<{ data: { records: { id: number; employee_name: string; code: string; date_of_joining?: string }[] } }>(`/common/getemployees?${query.toString()}`);
  },
  // Get employees without salary for dropdowns
  getEmployeesWithoutSalary: (params?: { department_id?: number; designation_id?: number; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.department_id !== undefined) query.set('department_id', String(params.department_id));
    if (params?.designation_id !== undefined) query.set('designation_id', String(params.designation_id));
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return apiRequest<{ data: { records: { id: number; employee_name: string; code: string; date_of_joining?: string }[] } }>(`/common/getemployeeswithoutsalary${qs ? `?${qs}` : ''}`);
  },
  // Get leave types for dropdowns
  getLeaveTypes: () => apiRequest<{ data: { records: { id: number; leave_type_name: string }[] } }>('/common/getleavetype?status=1'),
  // Get pay period statuses for dropdowns
  getPayPeriodStatuses: (status?: number) =>
    apiRequest<any>(`/common/getpayperiodstatuses${status !== undefined ? `?status=${status}` : ''}`),
  // Get wage periods dropdown for worker payroll
  getWagePeriods: (statusId?: number, search?: string) => {
    const query = new URLSearchParams();
    if (statusId !== undefined) query.append('status_id', String(statusId));
    if (search) query.append('search', search);
    const qs = query.toString();
    return apiRequest<any>(`/common/getwageperiods${qs ? `?${qs}` : ''}`);
  },
  // Get worker category dropdown
  getWorkCategories: (status?: number) =>
    apiRequest<any>(`/common/getworkcategory${status !== undefined ? `?status=${status}` : ''}`),
  // Get designations for dropdowns
  getDesignations: (status?: number, department_id?: number) => {
    const params = new URLSearchParams();
    if (status !== undefined) params.set('status', String(status));
    if (department_id !== undefined) params.set('department_id', String(department_id));
    const qs = params.toString();
    return apiRequest<any>(`/common/getdesignations${qs ? `?${qs}` : ''}`);
  },
  // Get salary structures for dropdowns
  getSalaryStructures: (status?: number) => {
    const qs = status !== undefined ? `?status=${status}` : '';
    return apiRequest<any>(`/common/getsalarystructures${qs}`);
  },
  // Get earning components for salary structure dropdowns (RESTORED flexible signature)
  getEarningComponents: (params?: number | { status?: number, search?: string }) => {
    const status = typeof params === 'number' ? params : params?.status;
    const search = typeof params === 'object' ? params?.search : undefined;
    
    const query = new URLSearchParams();
    if (status !== undefined) query.set('status', String(status));
    if (search) query.set('search', search);
    const qs = query.toString();
    return apiRequest<any>(`/common/getearningcomponents${qs ? `?${qs}` : ''}`);
  },
  // Get deduction components for dropdowns
  getDeductions: (status?: number, search?: string) => {
    const params = new URLSearchParams();
    if (status !== undefined) params.set('status', String(status));
    if (search) params.set('search', search);
    const qs = params.toString();
    return apiRequest<any>(`/common/getdeductions${qs ? `?${qs}` : ''}`);
  },
  // Get calculation types for salary structure
  getCalculationTypes: (status?: number) => {
    let url = '/common/getcalculationtypes';
    if (status !== undefined) url += `?status=${status}`;
    return apiRequest<any>(url);
  },
  // Get items with stock information
  getItemsWithStock: (type: string = "rm, consumables") => {
    return apiRequest<ItemWithStockResponse>(`/common/mymr/getitemswithstock?type=${type}`);
  },
  getItemsWithMR: (purchaseorderid: number) => apiRequest<POItemWithMRResponse>(`/common/getitemswithmr?purchaseorderid=${purchaseorderid}`),
  // Get BOM components for dropdown and auto-population
  getBOMComponents: () => apiRequest<any>('/common/getbomcomponents'),
  getOperationsWithOutput: () => apiRequest<any>('/common/getoperationwithoutput'),
  getAssignedWorkCenters: () => apiRequest<any>('/common/getassignedworkcenter'),
  /** Operations allowed for a work center (create flow, material release, etc.) */
  getOperationWithWorkCenter: (work_center_id: number) =>
    apiRequest<any>(`/common/getoperationwithworkcenter?work_center_id=${work_center_id}`),
  /** Batches with line items for an operation (material release eligible batches) */
  getBatchWithItems: (params: { operation_id: number }) =>
    apiRequest<any>(`/common/getbatchwithitems?operation_id=${params.operation_id}`),
  // Get production plans for dropdowns
  getProductionPlans: (params?: { operation_id?: number | string; shift_id?: number | string; status_id?: number | string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.operation_id) query.append('operation_id', String(params.operation_id));
    if (params?.shift_id) query.append('shift_id', String(params.shift_id));
    if (params?.status_id) query.append('status_id', String(params.status_id));
    if (params?.search) query.append('search', params.search);
    const qs = query.toString();
    return apiRequest<{
      data: {
        records: Array<{
          production_plan_id: number;
          plan_code: string;
          operation_id: number;
          operation_name: string;
          display_name: string;
          status_id: number;
        }>;
      };
      message: string;
      isSuccessful: boolean;
    }>(`/common/getproductionplan${qs ? `?${qs}` : ''}`);
  },
  getSkuDropdown: (params: { item_id: number }) => fetchSkuDropdown(params),
};

// ==================== PAY PERIOD API ====================
export const payPeriodApi = {
  getList: (params?: { page?: number; limit?: number; search_text?: string; status_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.append('page', String(params.page));
    if (params?.limit !== undefined) query.append('limit', String(params.limit));
    if (params?.search_text) query.append('search_text', params.search_text);
    if (params?.status_id !== undefined) query.append('status_id', String(params.status_id));
    return apiRequest<any>(`/hr/pay-period/getpayperiodlist?${query.toString()}`);
  },
  create: (data: {
    period_month: number;
    period_year: number;
    start_date: string;
    end_date: string;
    status_id: number;
    additional_notes?: string;
  }) =>
    apiRequest<any>('/hr/pay-period/createpayperiod', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (
    id: number,
    data: {
      period_month?: number;
      period_year?: number;
      start_date?: string;
      end_date?: string;
      status_id?: number;
      additional_notes?: string;
    }
  ) =>
    apiRequest<any>(`/hr/pay-period/updatepayperiod/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiRequest<any>(`/hr/pay-period/deletepayperiod/${id}`, {
      method: 'DELETE',
    }),
};

// ==================== WORKERS WAGE PERIOD API ====================
export const workersWagePeriodApi = {
  getList: (params?: { page?: number; limit?: number; search_text?: string; status_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.append('page', String(params.page));
    if (params?.limit !== undefined) query.append('limit', String(params.limit));
    if (params?.search_text) query.append('search_text', params.search_text);
    if (params?.status_id !== undefined) query.append('status_id', String(params.status_id));
    return apiRequest<any>(`/hr/workers-wage-period/getworkerwageperiodlist?${query.toString()}`);
  },
  create: (data: {
    period_month: number;
    period_year: number;
    start_date: string;
    end_date: string;
    status_id: number;
    additional_notes?: string;
  }) =>
    apiRequest<any>('/hr/workers-wage-period/createworkerwageperiod', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (
    id: number,
    data: {
      period_month?: number;
      period_year?: number;
      start_date?: string;
      end_date?: string;
      status_id?: number;
      additional_notes?: string;
    }
  ) =>
    apiRequest<any>(`/hr/workers-wage-period/updateworkerwageperiod/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiRequest<any>(`/hr/workers-wage-period/deleteworkerwageperiod/${id}`, {
      method: 'DELETE',
    }),
  getById: (id: number, company_id?: number) =>
    apiRequest<any>(`/hr/workers-wage-period/getworkerwageperiod/${id}${company_id ? `?company_id=${company_id}` : ''}`),
};

// ==================== WORKER PAYROLL API ====================
export const workerPayrollApi = {
  getList: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    department_id?: number;
    status_id?: number;
    date?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.append('page', String(params.page));
    if (params?.limit !== undefined) query.append('limit', String(params.limit));
    if (params?.search) query.append('search', params.search);
    if (params?.department_id !== undefined) query.append('department_id', String(params.department_id));
    if (params?.status_id !== undefined) query.append('status_id', String(params.status_id));
    if (params?.date) query.append('date', params.date);
    // Prevent browser 304 cache reuse issues on list refresh.
    query.append('_ts', String(Date.now()));
    return apiRequest<any>(`/hr/workpayroll/getworkerpayrolllist?${query.toString()}`);
  },
  create: (data: {
    company_id: number;
    worker_wage_period_id: number;
    entry_date: string;
    work_location_id?: number | null;
    department_id?: number | null;
    work_center_id?: number | null;
    operation_id?: number | null;
    worker_category_id: number;
    no_of_workers: number;
    net_wage_amount: number;
    total_wage_amount?: number;
    status_id: number;
  }) =>
    apiRequest<any>('/hr/workpayroll/createworkerpayroll', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getById: (id: number) => {
    const query = new URLSearchParams();
    query.append('_ts', String(Date.now()));
    return apiRequest<any>(`/hr/workpayroll/getworkerpayroll/${id}?${query.toString()}`);
  },
  update: (
    id: number,
    data: {
      company_id?: number;
      worker_wage_period_id?: number;
      entry_date?: string;
      work_location_id?: number | null;
      department_id?: number | null;
      work_center_id?: number | null;
      operation_id?: number | null;
      worker_category_id?: number;
      no_of_workers?: number;
      net_wage_amount?: number;
      total_wage_amount?: number;
      status_id?: number;
    }
  ) =>
    apiRequest<any>(`/hr/workpayroll/updateworkerpayroll/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiRequest<any>(`/hr/workpayroll/deleteworkerpayroll/${id}`, {
      method: 'DELETE',
    }),
};

// ==================== EMPLOYEE SALARY API ====================
export const employeeSalaryApi = {
  getList: (params?: { page?: number; limit?: number; search?: string; status?: number }) => {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.append('page', String(params.page));
    if (params?.limit !== undefined) query.append('limit', String(params.limit));
    if (params?.search) query.append('search', params.search);
    if (params?.status !== undefined) query.append('status', String(params.status));
    return apiRequest<any>(`/hr/employeesalary/getemployeesalarylist?${query.toString()}`);
  },
  getById: (employee_salary_id: number) =>
    apiRequest<any>(`/hr/employeesalary/getemployeesalary?employee_salary_id=${employee_salary_id}`),
  create: (data: any) =>
    apiRequest<any>('/hr/employeesalary/createemployeesalary', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (employee_salary_id: number, data: any) =>
    apiRequest<any>(`/hr/employeesalary/updateemployeesalary?employee_salary_id=${employee_salary_id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (employee_salary_id: number) =>
    apiRequest<any>(`/hr/employeesalary/deleteemployeesalary?employee_salary_id=${employee_salary_id}`, {
      method: 'DELETE',
    }),
};

// ==================== ITEMS MASTER API ====================
export const itemsApi = {
  // Get paginated list of items
  getAll: (page: number = 1, limit: number = 10, search?: string, item_type_id?: number) => {
    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('limit', String(limit));
    if (search) query.set('search', search);
    if (item_type_id) query.set('item_type_id', String(item_type_id));
    return apiRequest<any>(`/masters/items/getitemlist?${query.toString()}`);
  },
  // Get a single item by ID
  getOne: (id: number) => apiRequest<any>(`/masters/items/getitem/${id}`),
  // Create a new item
  create: (data: any) => apiRequest<any>('/masters/items/createitem', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  // Update an existing item
  update: (id: number, data: any) => apiRequest<any>(`/masters/items/updateitem/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  // Delete an item
  delete: (id: number) => apiRequest<any>(`/masters/items/deleteitem/${id}`, {
    method: 'DELETE',
  }),
};

// ==================== MATERIAL THRESHOLD MASTER API ====================
export const materialThresholdApi = {
  // Get paginated list of material thresholds
  getAll: (page: number = 1, limit: number = 10, search?: string, item_type_id?: number) => {
    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('limit', String(limit));
    if (search) query.set('search', search);
    if (item_type_id) query.set('item_type_id', String(item_type_id));
    return apiRequest<any>(`/masters/materialthreshold/getmaterialthresoldlist?${query.toString()}`);
  },
  // Get a single material threshold by ID
  getOne: (id: number) => apiRequest<any>(`/masters/materialthreshold/getmaterialthresold/${id}`),
  // Create a new material threshold
  create: (data: any) => apiRequest<any>('/masters/materialthreshold/creatematerialthresold', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  // Update an existing material threshold
  update: (id: number, data: any) => apiRequest<any>(`/masters/materialthreshold/updatematerialthresold/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  // Soft delete a material threshold
  delete: (id: number) => apiRequest<any>(`/masters/materialthreshold/deletematerialthresold/${id}`, {
    method: 'DELETE',
  }),
};

// ==================== CUSTOMERS & SUPPLIERS API ====================

export const customersApi = {
  getList: (params: { page?: number; limit?: number; search?: string; status?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status !== undefined) query.set('status', String(params.status));
    const qs = query.toString();
    return apiRequest<any>(`/masters/customer/getcustomerlist${qs ? `?${qs}` : ''}`);
  },
  getById: (id: number) =>
    apiRequest<any>(`/masters/customer/getcustomer/${id}`),
  create: (data: any) =>
    apiRequest<any>('/masters/customer/createcustomer', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: any) =>
    apiRequest<any>(`/masters/customer/updatecustomer/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiRequest<any>(`/masters/customer/deletecustomer/${id}`, {
      method: 'DELETE',
    }),
};

export interface VendorLocation {
  vendor_location_id?: number;
  address_line: string;
  country_id?: number;
  state_id?: number;
  city_id?: number;
}

export const vendorsApi = {
  getList: (params: { page?: number; limit?: number; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.append('page', String(params.page));
    if (params.limit !== undefined) query.append('limit', String(params.limit));
    if (params.search) query.append('search', params.search);
    const qs = query.toString();
    return apiRequest<any>(`/masters/vendor/getvendorlist${qs ? `?${qs}` : ''}`);
  },
  getById: (id: number) =>
    apiRequest<any>(`/masters/vendor/getvendor/${id}`),
  create: (data: any) =>
    apiRequest<any>('/masters/vendor/createvendor', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: any) =>
    apiRequest<any>(`/masters/vendor/updatevendor/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiRequest<any>(`/masters/vendor/deletevendor/${id}`, {
      method: 'DELETE',
    }),
  getVendorItems: (id: number) =>
    apiRequest<any>(`/masters/vendor/getvendoritems/${id}`),
  saveVendorItems: (id: number, data: any) =>
    apiRequest<any>(`/masters/vendor/savevendoritems/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
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
  getSOList: (params: { search?: string; date?: string; status_id?: number | string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search && params.search.trim()) {
      query.set('search', params.search.trim());
    }
    if (params.date) {
      query.set('date', params.date);
    }
    if (params.status_id !== undefined && params.status_id !== null && params.status_id !== '') {
      query.set('status_id', String(params.status_id));
    }
    if (params.page !== undefined && params.page !== null) {
      query.set('page', String(params.page));
    }
    if (params.limit !== undefined && params.limit !== null) {
      query.set('limit', String(params.limit));
    }
    const qs = query.toString();
    return apiRequest<{
      data: {
        records: Array<{
          id: number;
          sales_order_code: string;
          order_date: string;
          customer_id?: number;
          customer_name?: string;
          status_id?: number;
          status_name?: string;
        }>;
        pagination?: {
          page?: number;
          limit?: number;
          totalRecords?: number;
          totalCount?: number;
          totalPages?: number;
        };
      } | null;
      message: string;
      showMessage: boolean;
      isSuccessful: boolean;
    }>(`/sales/so/getsoslist${qs ? `?${qs}` : ''}`);
  },
  getSOById: (id: number) => apiRequest<{
    data: any;
    message: string;
    showMessage: boolean;
    isSuccessful: boolean;
  }>(`/sales/so/getsobyid/${id}`),
  saveAsDraftSO: (data: any) => apiRequest<{
    data: any;
    message: string;
    showMessage: boolean;
    isSuccessful: boolean;
  }>('/sales/so/saveasdraftso', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  submitSO: (data: any) => apiRequest<{
    data: { id: number; sales_order_code: string } | null;
    message: string;
    showMessage: boolean;
    isSuccessful: boolean;
  }>('/sales/so/submitso', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateSO: (data: any) => {
    const { id, ...restData } = data;
    return apiRequest<{
      message: string;
      showMessage: boolean;
      isSuccessful: boolean;
    }>(`/sales/so/updateso/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(restData), // or data, if the backend also expects it in the body
    });
  },
  deleteSO: (id: number) => apiRequest<{
    message: string;
    showMessage: boolean;
    isSuccessful: boolean;
  }>(`/sales/so/deleteso/${id}`, {
    method: 'DELETE',
  }),
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

// ==================== INVOICING API ====================

export const invoicingApi = {
  getInvoicesList: (params: { search?: string; date?: string; status_id?: number | string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.date) query.set('date', params.date);
    if (params.status_id !== undefined && params.status_id !== null && params.status_id !== '') {
      query.set('status_id', String(params.status_id));
    }
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<{
      data: {
        records: Array<{
          invoice_id: number;
          invoice_code: string;
          invoice_date: string;
          sales_order_id: number;
          so_code: string;
          customer_name: string;
          invoice_amount: number;
          currency_name: string;
          status_id: number;
          status_name: string;
        }>;
        pagination: {
          page: number;
          limit: number;
          totalRecords: number;
        };
      } | null;
      message: string;
      showMessage: boolean;
      isSuccessful: boolean;
    }>(`/accounting/invoices/getinvoiceslist${qs ? `?${qs}` : ''}`);
  },
  getInvoiceById: (id: number) => apiRequest<{
    data: any;
    message: string;
    showMessage: boolean;
    isSuccessful: boolean;
  }>(`/accounting/invoices/getinvoicebyid?id=${id}`),
  updateInvoice: (id: number, data: { status_code?: string; [key: string]: any }) => apiRequest<{
    message: string;
    showMessage: boolean;
    isSuccessful: boolean;
  }>(`/accounting/invoices/updateinvoice?id=${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  cancelInvoice: (invoice_id: number) => apiRequest<{
    data: any;
    message: string;
    showMessage: boolean;
    isSuccessful: boolean;
  }>(`/accounting/invoices/cancleledSo`, {
    method: 'PATCH',
    body: JSON.stringify({ invoice_id }),
  }),
  getPendingPaymentsList: (params: { search?: string; due_date?: string; status_id?: number; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.due_date) query.append('due_date', params.due_date);
    if (params.status_id) query.append('status_id', String(params.status_id));
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    return apiRequest<{
      data: {
        records: any[];
        pagination: any;
      };
      message: string;
      showMessage: boolean;
      isSuccessful: boolean;
    }>(`/accounting/pending-payments/getpendingpaymentslist?${query.toString()}`);
  },
  getPendingPaymentById: (id: number) => apiRequest<{
    data: any;
    message: string;
    showMessage: boolean;
    isSuccessful: boolean;
  }>(`/accounting/pending-payments/getpendingpaymentbyid?id=${id}&t=${Date.now()}`),
  updatePendingPayment: (id: number, data: any) => apiRequest<{
    message: string;
    showMessage: boolean;
    isSuccessful: boolean;
  }>(`/accounting/pending-payments/updatependingpayment?id=${id}`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// ==================== SALES FOLLOW-UP API ====================

export interface SalesFollowUpRecord {
  follow_up_id: number;
  customer_id: number;
  customer_name: string;
  invoice_id: number;
  invoice_code: string;
  invoice_amount: number;
  due_amount: number;
  currency_name: string;
  due_date: string;
  upcoming_follow_up_date: string;
  follow_up_date: string;
  status_id: number;
  status_name: string;
}

export interface SalesFollowUpListResponse {
  data: {
    records: SalesFollowUpRecord[];
    pagination: {
      page: number;
      limit: number;
      total_records: number;
      total_pages: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface SalesFollowUpDetail {
  follow_up_id: number;
  company_id: number;
  company_name: string;
  company_address: string;
  created_at: string;
  customer_id: number;
  customer_name: string;
  contact_person: string;
  mobile_no: string;
  status_id: number;
  status_name: string;
  so_code?: string;
  so_date?: string;
  invoice: {
    invoice_id: number;
    invoice_code: string;
    invoice_date: string;
    invoice_amount: number;
    due_amount: number;
    due_date: string;
    so_code?: string;
    order_date?: string;
    delivery_date?: string;
    currency_name?: string;
    paid_amount?: number;
  };
  payment_terms: Array<{
    term_type: string;
    percentage: number;
    due_date: string;
    term_amount: number;
    paid_amount: number;
    remaining_amount: number;
    status: string;
  }>;
  upcoming_follow_up_date: string;
  follow_up_history: Array<{
    follow_up_date: string;
    note: string;
  }>;
}

export interface SalesFollowUpDetailResponse {
  data: SalesFollowUpDetail;
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export const salesFollowUpApi = {
  getFollowUpList: (params: { search?: string; due_date?: string; status_id?: number | string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.due_date) query.set('due_date', params.due_date);
    if (params.status_id !== undefined && params.status_id !== null && params.status_id !== '' && params.status_id !== 'all') {
      query.set('status_id', String(params.status_id));
    }
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<SalesFollowUpListResponse>(`/sales/follow-up/getfollowuplist${qs ? `?${qs}` : ''}`);
  },
  getFollowUpById: (id: number) => 
    apiRequest<SalesFollowUpDetailResponse>(`/sales/follow-up/getfollowupbyid?id=${id}`),
  updateFollowUp: (id: number, data: { status_id?: number; upcoming_follow_up_date?: string; follow_up_history: Array<{ follow_up_date: string; note: string }> }) => 
    apiRequest<{ message: string; showMessage: boolean; isSuccessful: boolean }>(`/sales/follow-up/updatefollowup?id=${id}`, {
      method: 'PATCH',
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

// ==================== HR EMPLOYEE API ====================

export const hrEmployeeApi = {
  getEmployeeList: (params: { page?: number; limit?: number; search?: string; department_id?: number }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    if (params.department_id) qs.set('department_id', String(params.department_id));
    return apiRequest<any>(`/hr/employee/getemployeelist?${qs.toString()}`);
  },
  getEmployee: (employeeId: number) =>
    apiRequest<any>(`/hr/employee/getemployee?employee_id=${employeeId}`),
  createEmployee: (data: any) =>
    apiRequest<any>('/hr/employee/createemployee', { 
      method: 'POST', 
      body: data instanceof FormData ? data : JSON.stringify(data) 
    }),
  updateEmployee: (employeeId: number, data: any) =>
    apiRequest<any>(`/hr/employee/updateemployee?employee_id=${employeeId}`, { 
      method: 'PATCH', 
      body: data instanceof FormData ? data : JSON.stringify(data) 
    }),
  deleteEmployee: (employeeId: number) =>
    apiRequest<any>(`/hr/employee/deleteemployee?employee_id=${employeeId}`, { method: 'DELETE' }),

  getEmployeeJobDetails: (employeeId: number) =>
    apiRequest<any>(`/hr/employee/getemployeejobdetails?employee_id=${employeeId}`),
  addEmployeeJobDetails: (data: any) =>
    apiRequest<any>('/hr/employee/addemployeejobdetails', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployeeJobDetails: (employeeId: number, data: any) =>
    apiRequest<any>(`/hr/employee/updateemployeejobdetails?employee_id=${employeeId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getEmployeeDocuments: (employeeId: number) =>
    apiRequest<any>(`/hr/employee/getemployeedocumentlist?employee_id=${employeeId}`),
  addEmployeeDocument: (formData: FormData) =>
    apiFormDataRequest<any>('/hr/employee/addemployeedocument', formData),
  importEmployees: (formData: FormData) =>
    apiFormDataRequest<any>('/hr/employee/importemployees', formData),
  exportEmployees: (employeeIds: Array<number | string>) =>
    apiRequest<any>(`/hr/employee/exportemployees?employee_ids=${employeeIds.join(',')}`),
  deleteEmployeeDocument: (documentId: number) =>
    apiRequest<any>(`/hr/employee/deleteemployeedocument?employeedocument_id=${documentId}`, { method: 'DELETE' }),

  getEmployeeSystemAccess: (employeeId: number) =>
    apiRequest<any>(`/hr/employee/getemployeesystemaccess?employee_id=${employeeId}`),
  addEmployeeSystemAccess: (data: any) =>
    apiRequest<any>('/hr/employee/addemployeesystemaccess', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployeeSystemAccess: (employeeId: number, data: any) =>
    apiRequest<any>(`/hr/employee/updateemployeesystemaccess?employee_id=${employeeId}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ==================== HR COMMON (DROPDOWNS) API ====================

export const hrCommonApi = {
  getNationalities: (status?: boolean) =>
    apiRequest<any>(`/common/getnationalities${status !== undefined ? `?status=${status ? '1' : '0'}` : ''}`),
  getBloodGroups: (status?: boolean) =>
    apiRequest<any>(`/common/getbloodgroups${status !== undefined ? `?status=${status ? '1' : '0'}` : ''}`),
  getMaritalStatuses: (status?: boolean) =>
    apiRequest<any>(`/common/getmaritalstatuses${status !== undefined ? `?status=${status ? '1' : '0'}` : ''}`),
  getGenders: (status?: boolean) =>
    apiRequest<any>(`/common/getgender${status !== undefined ? `?status=${status ? '1' : '0'}` : ''}`),
  getEmploymentTypes: (status?: boolean) =>
    apiRequest<any>(`/common/getemploymenttype${status !== undefined ? `?status=${status ? '1' : '0'}` : ''}`),
  getDepartments: (status?: boolean) =>
    apiRequest<any>(`/common/getdepartment${status !== undefined ? `?status=${status ? '1' : '0'}` : ''}`),
  getGrades: (status?: boolean) =>
    apiRequest<any>(`/common/getgrade${status !== undefined ? `?status=${status ? '1' : '0'}` : ''}`),
  getDesignations: () =>
    apiRequest<any>(`/common/getdesignations`),
  getLocations: (status?: boolean) =>
    apiRequest<any>(`/common/getlocation${status !== undefined ? `?status=${status ? '1' : '0'}` : ''}`),
  getShifts: (status?: boolean) =>
    apiRequest<any>(`/common/getshift${status !== undefined ? `?status=${status ? '1' : '0'}` : ''}`),
  getRoles: (status?: boolean) =>
    apiRequest<any>(`/common/getrole${status !== undefined ? `?status=${status ? '1' : '0'}` : ''}`),
  getReportingManagers: (params?: { status?: boolean; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status !== undefined) qs.set('status', params.status ? '1' : '0');
    if (params?.search) qs.set('search', params.search);
    return apiRequest<any>(`/common/getreportingmanager${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  getCountries: () => apiRequest<any>('/common/getcountries'),
  getStates: (countryId?: number) =>
    apiRequest<any>(`/common/getstates${countryId ? `?country_id=${countryId}` : ''}`),
  getCities: (stateId?: number, countryId?: number) => {
    const qs = new URLSearchParams();
    if (stateId) qs.set('state_id', String(stateId));
    if (countryId) qs.set('country_id', String(countryId));
    return    apiRequest<any>(`/common/getcities${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  getWarehouses: (status?: number) =>
    apiRequest<any>(`/common/getwarehouses${status !== undefined ? `?status=${status}` : ''}`),
  getWorkCenters: () => apiRequest<any>('/common/getworkcenters'),
  getOperations: () => apiRequest<any>('/common/getoperations'),
  getOperationsByWorkCenter: (workCenterId: string | number) => 
    apiRequest<any>(`/common/getoperationwithworkcenter?workcenter_id=${workCenterId}`),
  getDocumentTypes: (status?: boolean) => apiRequest<any>(`/common/getdocumenttype${status !== undefined ? `?status=${status ? 1 : 0}` : ''}`),
  getEmploymentStatus: (status?: number) =>
    apiRequest<any>(`/common/getemploymentstatus${status !== undefined ? `?status=${status}` : ''}`),
  getPOStatus: () => apiRequest<any>('/common/getpostatus'),
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

export interface WorkerPaymentRecord {
  worker_payroll_id: number;
  wage_period: string;
  period_month: number;
  period_year: number;
  entry_date: string;
  department_id: number;
  department_name: string;
  worker_category_id: number;
  worker_category_name: string;
  location_id: number;
  location_name: string;
  no_of_workers: number;
  net_wage_amount: number;
  total_wage_amount: number;
  currency_name: string;
  status_id: number;
  status_name: string;
}

export interface WorkerPaymentsResponse {
  data: {
    records: WorkerPaymentRecord[];
    pagination: {
      page: number;
      limit: number;
      totalRecords: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export const workerPaymentsApi = {
  getPayments: (params: {
    page: number;
    limit: number;
    search?: string;
    department_id?: number | string;
    entry_date?: string;
    status_id?: number | string;
    worker_payroll_id?: number | string;
  }) => {
    const q = new URLSearchParams();
    q.set("page", String(params.page));
    q.set("limit", String(params.limit));
    if (params.search) q.set("search", params.search.trim());
    if (params.department_id != null && String(params.department_id) !== "all" && String(params.department_id) !== "All") {
      q.set("department_id", String(params.department_id));
    }
    if (params.entry_date) q.set("entry_date", params.entry_date);
    if (params.status_id != null && String(params.status_id) !== "all" && String(params.status_id) !== "All" && String(params.status_id) !== "") {
      q.set("status_id", String(params.status_id));
    }
    if (params.worker_payroll_id) q.set("worker_payroll_id", String(params.worker_payroll_id));
    
    return apiRequest<WorkerPaymentsResponse>(`/accounting/worker-payments/getpayments?${q.toString()}`);
  },
  updatePayment: (id: number | string, data: { status_id: number }) => apiRequest<{
    message: string;
    showMessage: boolean;
    isSuccessful: boolean;
  }>(`/accounting/worker-payments/updatepayment/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
};

export const transactionsApi = {
  getAll: () => apiRequest<any[]>('/transactions'),
  getByAccount: (accountId: string) => apiRequest<any[]>(`/transactions/account/${accountId}`),
  create: (data: any) => apiRequest<any>('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// ==================== PRODUCTION MASTERS API ====================

export const machinesApi = {
  getAll: (params?: any) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page);
    if (params?.limit) query.append('limit', params.limit);
    if (params?.search) query.append('search', params.search);
    if (params?.status !== undefined) query.append('status', params.status);
    return apiRequest<any>(`/masters/machines/getmachineslist?${query.toString()}`);
  },
  getOne: (id: number) => apiRequest<any>(`/masters/machines/getmachine/${id}`),
  create: (data: any) => apiRequest<any>('/masters/machines/createmachine', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: number, data: any) => apiRequest<any>(`/masters/machines/updatemachine/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: number) => apiRequest<any>(`/masters/machines/deletemachine/${id}`, {
    method: 'DELETE',
  }),
};

export const workCentersApi = {
  getAll: (params?: any) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page);
    if (params?.limit) query.append('limit', params.limit);
    if (params?.search) query.append('search', params.search);
    if (params?.status !== undefined) query.append('status', params.status);
    return apiRequest<any>(`/masters/workcenter/getworkcenterlist?${query.toString()}`);
  },
  getOne: (id: number) => apiRequest<any>(`/masters/workcenter/getworkcenter/${id}`),
  create: (data: any) => apiRequest<any>('/masters/workcenter/createworkcenter', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: number, data: any) => apiRequest<any>(`/masters/workcenter/updateworkcenter/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: number) => apiRequest<any>(`/masters/workcenter/deleteworkcenter/${id}`, {
    method: 'DELETE',
  }),
};

export interface OperationTypeOption {
  id: number;
  value_name: string;
  value_code: string;
}

export interface OperationTypesApiResponse {
  data: OperationTypeOption[];
  message?: string;
  showMessage?: boolean;
  isSuccessful: boolean;
}

export const operationsApi = {
  getAll: (params?: any) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page);
    if (params?.limit) query.append('limit', params.limit);
    if (params?.search) query.append('search', params.search);
    if (params?.status !== undefined) query.append('status', params.status);
    if (params?.department_id) query.append('department_id', params.department_id);
    return apiRequest<any>(`/masters/operations/getoperationlist?${query.toString()}`);
  },
  getOne: (id: number) => apiRequest<any>(`/masters/operations/getoperation/${id}`),
  getInputTypes: () =>
    apiRequest<OperationTypesApiResponse>('/masters/operations/getinputtypes'),
  getOutputTypes: () =>
    apiRequest<OperationTypesApiResponse>('/masters/operations/getoutputtypes'),
  create: (data: any) => apiRequest<any>('/masters/operations/createoperation', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (data: any) => apiRequest<any>(`/masters/operations/updateoperation/${data.id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (id: number) => apiRequest<any>(`/masters/operations/deleteoperation/${id}`, {
    method: 'DELETE',
  }),
};



// ==================== SALARY COMPONENT API ====================

export interface SalaryEarningRecord {
  id: number;
  component_code: string;
  component_type_id: number;
  name_in_payslip: string;
  show_in_payslip: boolean;
  status: number;
}

export interface SalaryEarningListResponse {
  data: {
    records: SalaryEarningRecord[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  };
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface SalaryEarningResponse {
  data: SalaryEarningRecord | null;
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface EarningTypeRecord {
  id: number;
  earning_type_name: string;
}

export interface EarningTypeResponse {
  data: {
    items: EarningTypeRecord[];
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export const salaryEarningsApi = {
  // Get paginated list of salary earnings
  getAll: (page: number = 1, limit: number = 10, search?: string, status?: number) => {
    let url = `/hr/salarycomponent/earnings/getsalaryearninglist?page=${page}&limit=${limit}`;
    if (search) url += `&search=${search}`;
    if (status !== undefined) url += `&status=${status}`;
    return apiRequest<SalaryEarningListResponse>(url);
  },
  // Get a single salary earning by ID
  getOne: (id: number) => apiRequest<SalaryEarningResponse>(`/hr/salarycomponent/earnings/getsalaryearning/${id}`),
  // Create a new salary earning
  create: (data: {
    component_code: string;
    component_type_id: number;
    name_in_payslip: string;
    show_in_payslip: boolean;
    status: number;
  }) => apiRequest<SalaryEarningResponse>('/hr/salarycomponent/earnings/createsalaryearning', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  // Update an existing salary earning
  update: (id: number, data: {
    component_code?: string;
    component_type_id?: number;
    name_in_payslip?: string;
    show_in_payslip?: boolean;
    status?: number;
  }) => apiRequest<SalaryEarningResponse>(`/hr/salarycomponent/earnings/updatesalaryearning/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  // Soft delete a salary earning
  delete: (id: number) => apiRequest<SalaryEarningResponse>(`/hr/salarycomponent/earnings/deletesalaryearning/${id}`, {
    method: 'DELETE',
  }),
};

export interface SalaryDeductionRecord {
  id: number;
  component_code: string;
  component_type_id: number;
  name_in_payslip: string;
  deduction_frequency: 'ONE_TIME' | 'RECURRING';
  show_in_payslip: boolean;
  status: number;
}

export interface SalaryDeductionListResponse {
  data: {
    records: SalaryDeductionRecord[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  };
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface SalaryDeductionResponse {
  data: SalaryDeductionRecord | null;
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface DeductionTypeRecord {
  id: number;
  deduction_type_name: string;
}

export interface DeductionTypeResponse {
  data: {
    items: DeductionTypeRecord[];
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export const salaryDeductionsApi = {
  // Get paginated list of salary deductions
  getAll: (page: number = 1, limit: number = 10, search_text?: string, status?: number) => {
    let url = `/hr/salarycomponent/deductions/getsalarydeductionlist?page=${page}&limit=${limit}`;
    if (search_text) url += `&search_text=${search_text}`;
    if (status !== undefined) url += `&status=${status}`;
    return apiRequest<SalaryDeductionListResponse>(url);
  },
  // Get a single salary deduction by ID
  getOne: (id: number) => apiRequest<SalaryDeductionResponse>(`/hr/salarycomponent/deductions/getsalarydeductions/${id}`),
  // Create a new salary deduction
  create: (data: {
    component_code: string;
    component_type_id: number;
    name_in_payslip: string;
    deduction_frequency: 'ONE_TIME' | 'RECURRING';
    show_in_payslip: boolean;
    status: number;
  }) => apiRequest<SalaryDeductionResponse>('/hr/salarycomponent/deductions/creatededuction', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  // Update an existing salary deduction
  update: (id: number, data: {
    component_code?: string;
    component_type_id?: number;
    name_in_payslip?: string;
    deduction_frequency?: 'ONE_TIME' | 'RECURRING';
    show_in_payslip?: boolean;
    status?: number;
  }) => apiRequest<SalaryDeductionResponse>(`/hr/salarycomponent/deductions/updatesalarydeductions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  // Soft delete a salary deduction
  delete: (id: number) => apiRequest<SalaryDeductionResponse>(`/hr/salarycomponent/deductions/deletesalarydeductions/${id}`, {
    method: 'DELETE',
  }),
};



// ==================== SALARY STRUCTURE API ====================

export interface SalaryStructureRecord {
  id: number;
  structure_name: string;
  status: boolean | number;
  created_at: string;
}

export interface SalaryStructureLineRecord {
  id: number;
  salary_component_id: number;
  component_name: string;
  calculation_type_id: number;
  calculation_type: string;
  value_amount: number;
  base_component_id: number | null;
  base_component_name: string | null;
}

export interface SalaryStructureDetailRecord {
  id: number;
  structure_name: string;
  status: boolean | number;
  /** Unified line list (legacy / some APIs). */
  lines?: SalaryStructureLineRecord[];
  /** Split earning rules when `lines` is empty or not used. */
  earnings?: SalaryStructureLineRecord[];
  /** Split deduction rules when `lines` is empty or not used. */
  deductions?: SalaryStructureLineRecord[];
}

export interface SalaryStructureListResponse {
  data: {
    records: SalaryStructureRecord[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
  };
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface SalaryStructureDetailResponse {
  data: SalaryStructureDetailRecord | null;
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export interface SalaryStructureResponse {
  message: string;
  showMessage: string;
  isSuccessful: boolean;
}

export const salaryStructureApi = {
  // Get paginated list of salary structures
  getAll: (page: number = 1, limit: number = 10, search?: string, status?: boolean) => {
    let url = `/hr/salarystructure/getsalarystructurelist?page=${page}&limit=${limit}`;
    if (search) url += `&search=${search}`;
    if (status !== undefined) url += `&status=${status}`;
    return apiRequest<SalaryStructureListResponse>(url);
  },
  // Get a single salary structure by ID with lines
  getOne: (id: number) => apiRequest<SalaryStructureDetailResponse>(`/hr/salarystructure/getsalarystructure/${id}`),
  // Create a new salary structure
  create: (data: {
    structure_name: string;
    status: number;
    lines: Array<{
      salary_component_id: number;
      calculation_type_id: number;
      value_amount: number;
      base_component_id: number | null;
    }>;
  }) => apiRequest<SalaryStructureResponse>('/hr/salarystructure/createsalarystructure', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  // Update an existing salary structure
  update: (id: number, data: {
    structure_name: string;
    status: number;
    lines: Array<{
      salary_component_id: number;
      calculation_type_id: number;
      value_amount: number;
      base_component_id: number | null;
    }>;
  }) => apiRequest<SalaryStructureResponse>(`/hr/salarystructure/updatesalarystructure/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  // Soft delete a salary structure
  delete: (id: number) => apiRequest<SalaryStructureResponse>(`/hr/salarystructure/deletesalarystructure/${id}`, {
    method: 'DELETE',
  }),
};

// ==================== PROFILE API ====================

export interface UserProfileRecord {
  employee_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  gender_name: string;
  nationality_name: string;
  marital_status_name: string;
  blood_group_name: string;
  mobile_number: string;
  alternate_mobile: string | null;
  personal_email: string;
  official_email: string;
  current_address: string;
  permanent_address: string;
  city: string;
  state: string;
  country: string;
  department_name: string | null;
  designation_name: string | null;
  date_of_joining: string | null;
  employment_type: string | null;
  photo_url: string | null;
}

export interface UserProfileResponse {
  data: {
    records: UserProfileRecord[];
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export const profileApi = {
  getMyProfile: () => apiRequest<UserProfileResponse>('/information/getMyProfileInformation'),
};

// ==================== PROCUREMENT API ====================

export const procurementApi = {
  // Get paginated list of material requests
  getMRList: (params: { page: number; limit: number; search?: string; workcenter_id?: number | string; status_id?: number | string; date?: string }) => {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.workcenter_id && params.workcenter_id !== 'all') query.set('workcenter_id', String(params.workcenter_id));
    if (params.status_id && params.status_id !== 'all') query.set('status_id', String(params.status_id));
    if (params.date) query.set('date', params.date);
    
    return apiRequest<MRListResponse>(`/procurement/mymr/getmymrexecutionlist?${query.toString()}`);
  },
  // Create a new material request
  createMR: (data: MRCreateRequest) => apiRequest<ProcurementStatusResponse>('/procurement/mymr/createmymr', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getMRDetail: (mr_id: number) => apiRequest<MRDetailResponse>(`/procurement/mymr/getmymrdetail/${mr_id}`),
  getMRExecutionById: (mrexecution_id: number) => 
    apiRequest<MRExecutionByIdResponse>(`/procurement/mrexecution/getmrexecutionbyid/${mrexecution_id}`),
  createPO: (data: CreatePORequest) => apiRequest<CreatePOResponse>('/procurement/mrexecution/createpo', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getPOList: (params: { page: number; limit: number; text_search?: string; warehouse?: string; date?: string; status?: string }) => {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('limit', String(params.limit));
    if (params.text_search) query.set('text_search', params.text_search);
    if (params.warehouse && params.warehouse !== 'all') query.set('warehouse', params.warehouse);
    if (params.date) query.set('date', params.date);
    if (params.status && params.status !== 'all') query.set('status', params.status);
    
    return apiRequest<POListResponse>(`/procurement/purchaseorders/getpurchaseorderlist?${query.toString()}`);
  },
  getPODetail: (po_id: number) => apiRequest<PODetailResponse>(`/procurement/purchaseorders/getpurchaseorderdetail/${po_id}`),
  getPOReceiptItems: (po_id: number) => apiRequest<POReceiptsResponse>(`/procurement/purchaseorders/getpurchaseorderreceiptitems/${po_id}`),
  savePODraft: (id: number, data: POSubmitRequest) => apiRequest<ProcurementStatusResponse>(`/procurement/purchaseorders/${id}/savedraftpurchaseorder`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  submitPO: (id: number, data: POSubmitRequest) => apiRequest<ProcurementStatusResponse>(`/procurement/purchaseorders/${id}/submitpurchaseorder`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deletePO: (id: number) => apiRequest<ProcurementStatusResponse>(`/procurement/purchaseorders/deletepurchaseorder/${id}`, {
    method: 'DELETE',
  }),
  createQuotation: (data: FormData) => apiRequest<ProcurementStatusResponse>('/procurement/mrexecution/createpoquatations', {
    method: 'POST',
    body: data,
  }),
  deleteQuotation: (id: number) => apiRequest<ProcurementStatusResponse>(`/procurement/mrexecution/deletepoquatations/${id}`, {
    method: 'DELETE',
  }),
};

export interface InventoryMaterialRequestListRecord {
  /** Material request id — some list APIs use `id` instead of `mr_id` */
  mr_id?: number;
  id?: number;
  mr_code: string;
  request_date: string;
  requested_by: string;
  requested_by_name?: string;
  shift_name: string;
  work_center_name: string;
  operation_name: string;
  status_id: number;
  status_name: string;
  warehouse_name?: string;
}

export interface InventoryMaterialRequestListResponse {
  data: {
    records: InventoryMaterialRequestListRecord[];
    pagination: {
      page: number;
      limit: number;
      totalRecords: number;
    };
  } | null;
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface InventoryMaterialRequestItemDetail {
  id: number;
  item_id: number;
  item_name: string;
  item_code: string;
  uom: string;
  required_qty: number;
  issued_qty: number;
  available_qty: number;
}

export interface InventoryMaterialRequestDetail {
  id: number;
  mr_code: string;
  request_date: string;
  operation_id: number;
  operation_name: string;
  work_center_id: number;
  work_center_name: string;
  warehouse_id: number;
  warehouse_name: string;
  shift_id: number;
  shift_name: string;
  status_id: number;
  status_code: string;
  status_name: string;
  requested_by: string;
  requested_by_name: string;
  items: InventoryMaterialRequestItemDetail[];
}

export interface InventoryMaterialRequestDetailResponse {
  data: InventoryMaterialRequestDetail | null;
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface InventoryMaterialRequestIssueItemsRequest {
  items: Array<{
    id: number;
    issue_qty: number;
  }>;
}

export interface InventoryMaterialRequestIssueItemsResponse {
  data?: { id: number } | null;
  message: string;
  showMessage: string | boolean;
  isSuccessful: boolean;
}

export interface DispatchRecord {
  dispatch_id: number;
  dispatch_code: string | null;
  dispatch_date: string | null;
  so_code: string;
  customer_name: string;
  delivery_date: string;
  status_id: number;
  status_name: string;
}

export interface DispatchDetailResponse {
  data: {
    dispatch_id: number;
    dispatch_date: string;
    delivery_date: string;
    so_code: string;
    customer_name: string;
    shipping_address: string;
    warehouse_id: number;
    warehouse_name: string;
    remarks: string;
    sales_order_id?: number;
    currency_name?: string;
    dispatch_code?: string;
    dispatch_items: Array<{
      sales_order_item_id: number;
      dispatch_order_item_id?: number;
      item_code: string;
      item_name: string;
      uom: string;
      unit_price: number;
      ordered_qty: number;
      dispatched_qty: number;
      note: string | null;
      uom_name?: string;
      serial_numbers?: string[];
    }>;
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface DispatchListResponse {
  data: {
    records: DispatchRecord[];
    pagination: {
      page: number;
      limit: number;
      totalRecords: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface MaterialLedgerRecord {
  id: number;
  transaction_date: string;
  transaction_type: string;
  reference_id: number;
  reference_code: string | null;
  item_id: number;
  item_name: string;
  item_code: string;
  uom_name: string;
  warehouse_id: number;
  warehouse_name: string;
  qty: number;
  balance_qty: number;
}

export interface MaterialLedgerListResponse {
  data: {
    records: MaterialLedgerRecord[];
    pagination: {
      page: number;
      limit: number;
      totalCount?: number;
      totalRecords?: number;
      totalPages: number;
    };
  };
  message: string;
  showMessage: string | boolean;
  isSuccessful: boolean;
}

export const inventoryApi = {
  getItemConfig: () => apiRequest<any>('/inventory/getitemconfig'),
  getMaterialRequestById: (id: number) =>
    apiRequest<InventoryMaterialRequestDetailResponse>(`/inventory/materialrequests/getmaterialrequestbyid/${id}`),
  issueItems: (materialRequestId: number, data: InventoryMaterialRequestIssueItemsRequest) =>
    apiRequest<InventoryMaterialRequestIssueItemsResponse>(`/inventory/materialrequests/issueItems/${materialRequestId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  getMaterialRequisitionById: (id: number) => 
    apiRequest<any>(`/inventory/materialRequisitionbyid?id=${id}`),
  updateMaterialRequisition: (data: any) => 
    apiRequest<any>('/inventory/updatematerialRequisitionlist', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getItemsForSMR: (smrId: number | string) =>
    apiRequest<any>(`/inventory/getitemsforsmr?service_material_requisition_id=${smrId}`),
  getMaterialRequestsList: (params: {
    page: number;
    limit: number;
    search?: string;
    request_date?: string;
    status_id?: number | string;
    workcenter_id?: number | string;
    shift_id?: number | string;
    warehouse_id?: number | string;
  }) => {
    const q = new URLSearchParams();
    q.set("page", String(params.page));
    q.set("limit", String(params.limit));
    if (params.search) q.set("search", params.search);
    if (params.request_date) q.set("request_date", params.request_date);
    if (
      params.status_id != null &&
      String(params.status_id) !== "all" &&
      String(params.status_id) !== "All"
    ) {
      q.set("status_id", String(params.status_id));
    }
    if (
      params.workcenter_id != null &&
      String(params.workcenter_id) !== "all" &&
      String(params.workcenter_id) !== "All"
    ) {
      q.set("workcenter_id", String(params.workcenter_id));
    }
    if (params.shift_id != null && String(params.shift_id) !== "all" && String(params.shift_id) !== "All") {
      q.set("shift_id", String(params.shift_id));
    }
    if (params.warehouse_id != null && String(params.warehouse_id) !== "all" && String(params.warehouse_id) !== "All") {
      q.set("warehouse_id", String(params.warehouse_id));
    }
    return apiRequest<InventoryMaterialRequestListResponse>(
      `/inventory/materialrequests/getmaterialrequestslist?${q.toString()}`,
    );
  },
  getInventorySMRList: (params: { page: number; limit: number; text_search?: string; date?: string; status?: string }) => {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('limit', String(params.limit));
    if (params.text_search) query.set('text_search', params.text_search);
    if (params.date) query.set('date', params.date);
    if (params.status) query.set('status', params.status);

    const qs = query.toString();
    return apiRequest<any>(`/inventory/materialRequisitionlist${qs ? `?${qs}` : ''}`);
  },
  getGRNList: (params: { page: number; limit: number; text_search?: string; warehouse?: string; date?: string; status?: string }) => {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('limit', String(params.limit));
    if (params.text_search) query.set('text_search', params.text_search);
    if (params.warehouse && params.warehouse !== 'all') query.set('warehouse', params.warehouse);
    if (params.date) query.set('date', params.date);
    if (params.status && params.status !== 'all') query.set('status', params.status);
    
    return apiRequest<GRNListResponse>(`/inventory/grn/getgrnlist?${query.toString()}`);
  },
  getGRNById: (id: number) => apiRequest<PODetailResponse>(`/inventory/grn/getgrnid/${id}`),
  receiveGRNItems: (data: FormData) => apiRequest<ProcurementStatusResponse>('/inventory/grn/receiveditems', {
    method: 'POST',
    body: data,
  }),
  getGRNReceptionEntries: (id: number) => apiRequest<GRNReceptionEntriesResponse>(`/inventory/grn/getreceptionentries/${id}`),
  deleteReceptionEntry: (id: number) => apiRequest<ProcurementStatusResponse>(`/inventory/grn/deletereceptionentry/${id}`, {
    method: 'DELETE',
  }),
  /**
   * GET /inventory/whreceive/list
   * Query: page, limit, search, work_center_id, warehouse_id, status_id
   */
  getWHReceiveList: (params: {
    page: number;
    limit: number;
    search?: string;
    work_center_id?: number | string;
    warehouse_id?: number | string;
    status_id?: number | string;
  }) => {
    const q = new URLSearchParams();
    q.set("page", String(params.page));
    q.set("limit", String(params.limit));
    if (params.search) q.set("search", params.search.trim());
    if (params.work_center_id != null && String(params.work_center_id) !== "all" && String(params.work_center_id) !== "All") {
      q.set("work_center_id", String(params.work_center_id));
    }
    if (params.warehouse_id != null && String(params.warehouse_id) !== "all" && String(params.warehouse_id) !== "All") {
      q.set("warehouse_id", String(params.warehouse_id));
    }
    if (params.status_id != null && String(params.status_id) !== "all" && String(params.status_id) !== "All" && String(params.status_id) !== "") {
      q.set("status_id", String(params.status_id));
    }
    return apiRequest<{
      data: {
        records: Array<Record<string, any>>;
        pagination: {
          page: number;
          limit: number;
          totalRecords: number;
          totalPages?: number;
        };
      };
      message: string;
      showMessage: boolean;
      isSuccessful: boolean;
    }>(`/inventory/whreceive/list?${q.toString()}`);
  },
  getWHReceiveById: (id: number) =>
    apiRequest<{
      data?: Record<string, any>;
      message: string;
      showMessage: boolean;
      isSuccessful: boolean;
    }>(`/inventory/whreceive/${id}`),
  /**
   * PATCH /inventory/whreceive/receiveItems/:id
   * Marks a WH receive as received (id = warehouse receive / material release id per API).
   */
  receiveWHReceiveItems: (id: number, data?: { company_id?: number }) =>
    apiRequest<{
      data?: unknown;
      message: string;
      showMessage: boolean;
      isSuccessful: boolean;
    }>(`/inventory/whreceive/receiveItems/${id}`, {
      method: 'PATCH',
      ...(data && data.company_id ? { body: JSON.stringify(data) } : {}),
    }),
  /**
   * GET /api/inventory/dispatch/getdispatchlist
   * Query: search, dispatch_date, status_id, page, limit
   */
  getDispatchList: (params: {
    page: number;
    limit: number;
    search?: string;
    dispatch_date?: string;
    status_id?: number | string;
  }) => {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search.trim());
    if (params.dispatch_date) query.set('dispatch_date', params.dispatch_date);
    if (params.status_id != null && String(params.status_id) !== 'all') {
      query.set('status_id', String(params.status_id));
    }
    return apiRequest<DispatchListResponse>(`/inventory/dispatch/getdispatchlist?${query.toString()}`);
  },
  getDispatchById: (id: number) =>
    apiRequest<DispatchDetailResponse>(`/inventory/dispatch/getdispatchbyid?id=${id}`),
  updateDispatch: (id: number, data: {
    warehouse_id: number;
    remarks: string;
    items: Array<{
      sales_order_item_id: number;
      dispatch_qty: number;
      note: string;
      serial_number?: string;
    }>;
  }) =>
    apiRequest<{
      message: string;
      showMessage: boolean;
      isSuccessful: boolean;
    }>(`/inventory/dispatch/updatedispatch?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  /**
   * GET /inventory/materialledger/getmaterialledgerlist
   * Query: page, limit, transaction_date, warehouse_id, search
   */
  getMaterialLedgerList: (params: {
    page: number;
    limit: number;
    transaction_date?: string;
    warehouse_id?: number | string;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    q.set('page', String(params.page));
    q.set('limit', String(params.limit));
    if (params.search?.trim()) q.set('search', params.search.trim());
    if (params.transaction_date) q.set('transaction_date', params.transaction_date);
    if (
      params.warehouse_id != null &&
      String(params.warehouse_id) !== 'all' &&
      String(params.warehouse_id) !== 'All'
    ) {
      q.set('warehouse_id', String(params.warehouse_id));
    }
    return apiRequest<MaterialLedgerListResponse>(
      `/inventory/materialledger/getmaterialledgerlist?${q.toString()}`
    );
  },
};

// ==================== PRODUCTION API ====================

export interface BOMListRecord {
  id: number;
  bom_code: string;
  bom_name: string;
  item_id: number;
  item_name: string;
  item_type: string;
  creaed_at: string; // Note: Typo in backend "creaed_at"
}

export interface BOMListResponse {
  data: {
    records: BOMListRecord[];
    pagination: {
      page: number;
      limit: number;
      totalRecords: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface BOMCreateRequest {
  bom_name: string;
  item_id: number;
  item_type_id: number;
  description: string;
  components: Array<{
    input_component_id: number;
    quantity: number;
  }>;
}

export interface BOMCreateResponse {
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface ProductionPlanOutput {
  item_id: number;
  item_code: string;
  item_name: string;
  target_qty: number;
  fulfilled_qty: number;
}

export interface ProductionPlanOutput {
  item_id: number;
  item_code: string;
  item_name: string;
  target_qty: number;
  fulfilled_qty: number;
}

export interface ProductionPlanRecord {
  id: number;
  plan_code: string;
  start_date: string;
  end_date: string;
  operation_id: number;
  operation_name: string;
  shift_id: number;
  shift_name: string;
  status_id: number;
  status_code: string;
  status_name: string;
  output: ProductionPlanOutput[];
}

export interface ProductionPlanListResponse {
  data: {
    records: ProductionPlanRecord[];
    pagination: {
      page: number;
      limit: number;
      total_records: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface BatchRecord {
  batch_id: number;
  batch_code: string;
  batch_date: string;
  mr_id: number;
  mr_code: string;
  operation_id: number;
  operation_name: string;
  work_center_id: number;
  work_center_name: string;
  shift_id: number;
  shift_name: string;
  status_id: number;
  status_name: string;
}

export interface BatchListResponse {
  data: {
    records: BatchRecord[];
    pagination: {
      page: number;
      limit: number;
      totalRecords: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

/** GET /production/batchqc/getbatchlist — batch-centric QC list (filter by operation, work center, status). */
export interface BatchQCListResponse {
  data: {
    records: Array<{
      batch_id: number;
      batch_code: string;
      batch_date: string;
      operation_id: number;
      operation_name: string;
      work_center_id: number;
      work_center_name: string;
      shift_id: number;
      shift_name: string;
      status_id: number;
      status_name: string;
      mr_id?: number;
      mr_code?: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      totalRecords: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

/** GET /production/batchqc/getbatchqcbyid/:id */
export interface BatchQCDetailResponse {
  data: {
    batch_id: number;
    batch_code: string;
    batch_date: string;
    shift_id: number;
    shift_name: string;
    operation_id: number;
    operation_name: string;
    work_center_id: number;
    work_center_name: string;
    status_id: number;
    status_name: string;
    verified_by?: number | null;
    verified_by_name?: string | null;
    verified_on?: string | null;
    remarks?: string | null;
    qc_parameters?: Array<Record<string, any>>;
    items?: Array<{
      item_id: number;
      item_code: string;
      item_name: string;
      uom_name: string;
      produced_qty: number;
      verified_qty?: number | null;
    }> | null;
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

/** PATCH /production/batchqc/verifyqc/:id */
export interface BatchQcVerifyRequest {
  items?: Array<{ item_id: number; verified_qty: number }>;
  remarks?: string | null;
  qc_parameters?: Array<Record<string, unknown>>;
}

export interface BatchQcVerifyResponse {
  data: null;
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

/** GET /production/materialrelease/getmaterialreleaselist */
export interface MaterialReleaseListResponse {
  data: {
    records: Array<Record<string, any>>;
    pagination: {
      page: number;
      limit: number;
      totalRecords: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface CreateMaterialReleaseRequest {
  release_date: string; // YYYY-MM-DD
  released_by: number;
  operation_id: number;
  work_center_id: number;
  warehouse_id: number;
  production_plan_id: number;
  batch_ids: number[];
}

export interface CreateMaterialReleaseResponse {
  data?: unknown;
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface ImportMaterialReleaseSerialsRequest {
  release_id?: number;
  batch_id: number;
  serials: string[];
}

export interface ImportMaterialReleaseSerialsResponse {
  data?: {
    release_id: number;
    batch_id: number;
    batch_code: string;
    imported_count: number;
    serials: Array<{
      serial_number: string;
      qr_code_data: string;
    }>;
  };
  message: string;
  showMessage: string | boolean;
  isSuccessful: boolean;
}

export interface BatchCreateRequest {
  batch_date: string;
  shift_id: number;
  mr_id: number;
  mr_code: string;
  inputs: Array<{
    item_id: number;
    supplied_qty: number;
  }>;
  outputs: Array<{
    item_id: number;
    produced_qty: number;
  }>;
}

export interface BatchCreateResponse {
  data?: { id: number };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface BatchUpdateRequest {
  outputs: Array<{
    item_id: number;
    produced_qty: number;
  }>;
}

export interface BatchUpdateResponse {
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface BatchBulkCreateRequest {
  material_request_id: number;
  shift_id: number;
  batch_date: string;
  no_of_batches: number;
}

export interface BatchBulkCreateResponse {
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface CreateMyRequestResponse {
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export const productionApi = {
  getProductionPlanList: (params: {
    page: number;
    limit: number;
    search?: string;
    operation_id?: number | string;
    shift_id?: number | string;
    status_id?: number | string;
    date?: string;
  }) => {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.operation_id && params.operation_id !== 'all' && params.operation_id !== 'All') {
      query.set('operation_id', String(params.operation_id));
    }
    if (params.shift_id && params.shift_id !== 'all' && params.shift_id !== 'All') {
      query.set('shift_id', String(params.shift_id));
    }
    if (params.status_id && params.status_id !== 'all' && params.status_id !== 'All') {
      query.set('status_id', String(params.status_id));
    }
    if (params.date) query.set('date', params.date);

    return apiRequest<ProductionPlanListResponse>(`/production/plan/getproductionplanlist?${query.toString()}`);
  },
  createProductionPlan: (data: { 
    start_date: string; 
    end_date: string; 
    shift_id: number; 
    operation_id: number; 
    outputs: { item_id: number; target_qty: number }[] 
  }) => apiRequest<any>('/production/plan/createproductionplan', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getProductionPlanById: (id: number) => apiRequest<any>(`/production/plan/getproductionplanbyid/${id}`),
  updateProductionPlan: (id: number, data: any) => apiRequest<any>(`/production/plan/updateproductionplan/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deleteProductionPlan: (id: number) => apiRequest<any>(`/production/plan/deleteproductionplan/${id}`, {
    method: 'DELETE',
  }),
  updateStatusToCompleted: (id: number, data: { status_id: string | number }) => 
    apiRequest<any>(`/production/plan/updatestatustocompleted/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getMyRequestList: (params: {
    page: number;
    limit: number;
    search?: string;
    operation_id?: number | string;
    shift_id?: number | string;
    status_id?: number | string;
    request_date?: string;
  }) => {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.operation_id && params.operation_id !== 'all' && params.operation_id !== 'All') {
      query.set('operation_id', String(params.operation_id));
    }
    if (params.shift_id && params.shift_id !== 'all' && params.shift_id !== 'All') {
      query.set('shift_id', String(params.shift_id));
    }
    if (params.status_id && params.status_id !== 'all' && params.status_id !== 'All') {
      query.set('status_id', String(params.status_id));
    }
    if (params.request_date) query.set('request_date', params.request_date);

    return apiRequest<any>(`/production/myrequest/getmyrequestlist?${query.toString()}`);
  },
  createMyRequest: (data: {
    request_date: string;
    required_by_date: string;
    operation_id: number;
    work_center_id: number;
    warehouse_id: number;
    shift_id: number;
    production_plan_id: number;
    items: { item_id: number; required_qty: number }[];
  }) => apiRequest<CreateMyRequestResponse>('/production/myrequest/createmyrequest', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getMyRequestById: (id: number) => apiRequest<{
    data: {
      mr_code: string;
      request_date: string;
      required_by_date: string;
      operation_id: number;
      operation_name: string;
      work_center_id: number;
      work_center_name: string;
      warehouse_id: number;
      warehouse_name: string;
      shift_id: number;
      shift_name: string;
      production_plan_id: number;
      production_plan_code: string;
      requested_by: string;
      requested_by_name?: string;
      received_date: string | null;
      items: Array<{
        id: number;
        item_id: number;
        item_code: string;
        item_name: string;
        uom: string;
        warehouse_id?: number;
        warehouse_name?: string;
        required_qty: number;
        issued_qty: number;
        received_qty: number;
        available_qty?: number;
      }>;
    };
    message: string;
    isSuccessful: boolean;
  }>(`/production/myrequest/getmyrequestbyid/${id}`),
  updateMyRequest: (id: number, data: {
    request_date: string;
    required_by_date: string;
    operation_id: number;
    work_center_id: number;
    warehouse_id: number;
    shift_id: number;
    production_plan_id: number;
    items: { id?: number; item_id: number; required_qty: number }[];
  }) => apiRequest<CreateMyRequestResponse>(`/production/myrequest/updatemyrequest/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  receiveMaterials: (requestId: number, data: { items: { id: number; received_qty: number }[] }) =>
    apiRequest<CreateMyRequestResponse>(`/production/myrequest/receivematerials/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getBatchList: (params: {
    page: number;
    limit: number;
    search?: string;
    batch_date?: string;
    shift_id?: number | string;
    operation_id?: number | string;
    status_id?: number | string;
  }) => {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.batch_date) query.set('batch_date', params.batch_date);
    if (params.shift_id && params.shift_id !== 'all' && params.shift_id !== 'All') {
      query.set('shift_id', String(params.shift_id));
    }
    if (params.operation_id && params.operation_id !== 'all' && params.operation_id !== 'All') {
      query.set('operation_id', String(params.operation_id));
    }
    if (params.status_id && params.status_id !== 'all' && params.status_id !== 'All') {
      query.set('status_id', String(params.status_id));
    }

    return apiRequest<BatchListResponse>(`/production/batchtracking/getbatchtrackinglist?${query.toString()}`);
  },
  getBatchQCList: (params: {
    page: number;
    limit: number;
    search?: string;
    operation_id?: number | string;
    work_center_id?: number | string;
    status_id?: number | string;
  }) => {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.operation_id != null && params.operation_id !== '' && params.operation_id !== 'all' && params.operation_id !== 'All') {
      query.set('operation_id', String(params.operation_id));
    }
    if (params.work_center_id != null && params.work_center_id !== '' && params.work_center_id !== 'all' && params.work_center_id !== 'All') {
      query.set('work_center_id', String(params.work_center_id));
    }
    if (params.status_id != null && params.status_id !== '' && params.status_id !== 'all' && params.status_id !== 'All') {
      query.set('status_id', String(params.status_id));
    }
    return apiRequest<BatchQCListResponse>(`/production/batchqc/getbatchlist?${query.toString()}`);
  },
  getBatchQCById: (id: number) =>
    apiRequest<BatchQCDetailResponse>(`/production/batchqc/getbatchqcbyid/${id}`),
  verifyBatchQC: (id: number, data?: BatchQcVerifyRequest) =>
    apiRequest<BatchQcVerifyResponse>(`/production/batchqc/verifyqc/${id}`, {
      method: "PATCH",
      body: data != null ? JSON.stringify(data) : JSON.stringify({}),
    }),
  getMaterialReleaseList: (params: {
    page: number;
    limit: number;
    search?: string;
    date?: string;
    operation_id?: number | string;
    status_id?: number | string;
    shift_id?: number | string;
  }) => {
    const q = new URLSearchParams();
    q.set("page", String(params.page));
    q.set("limit", String(params.limit));
    if (params.search) q.set("search", params.search);
    if (params.date) q.set("date", params.date);
    if (params.operation_id != null && params.operation_id !== "" && params.operation_id !== "all" && params.operation_id !== "All") {
      q.set("operation_id", String(params.operation_id));
    }
    if (params.status_id != null && params.status_id !== "" && params.status_id !== "all" && params.status_id !== "All") {
      q.set("status_id", String(params.status_id));
    }
    if (params.shift_id != null && params.shift_id !== "" && params.shift_id !== "all" && params.shift_id !== "All") {
      q.set("shift_id", String(params.shift_id));
    }
    return apiRequest<MaterialReleaseListResponse>(`/production/materialrelease/getmaterialreleaselist?${q.toString()}`);
  },
  createMaterialRelease: (data: CreateMaterialReleaseRequest) =>
    apiRequest<CreateMaterialReleaseResponse>('/production/materialrelease/creatematerialrelease', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  importMaterialReleaseSerials: (formData: FormData) =>
    apiFormDataRequest<ImportMaterialReleaseSerialsResponse>('/production/materialrelease/importserials', formData),
  getMaterialReleaseById: (id: number) =>
    apiRequest<{
      data?: Record<string, any>;
      message: string;
      showMessage: boolean;
      isSuccessful: boolean;
    }>(`/production/materialrelease/getmaterialreleasebyid/${id}`),
  createBatch: (data: BatchCreateRequest) => apiRequest<BatchCreateResponse>('/production/batchtracking/createbatch', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  createBulkBatch: (data: BatchBulkCreateRequest) =>
    apiRequest<BatchBulkCreateResponse>('/production/batchtracking/createbulkbatch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getBatchById: (id: number) => apiRequest<any>(`/production/batchtracking/getbatchbyid/${id}`),
  updateBatch: (id: number, data: BatchUpdateRequest) =>
    apiRequest<BatchUpdateResponse>(`/production/batchtracking/updatebatch/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getBOMList: (params: {
    search?: string;
    item_type_id?: number | string;
    created_at?: string;
    page: number;
    limit: number;
  }) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.item_type_id && params.item_type_id !== 'all' && params.item_type_id !== 'All') {
      query.set('item_type_id', String(params.item_type_id));
    }
    if (params.created_at) query.set('created_at', params.created_at);
    query.set('page', String(params.page));
    query.set('limit', String(params.limit));

    return apiRequest<BOMListResponse>(`/production/bom/getbomlist?${query.toString()}`);
  },
  createBOM: (data: BOMCreateRequest) => apiRequest<BOMCreateResponse>('/production/bom/createbom', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getBOMDetail: (id: number) => apiRequest<any>(`/production/bom/getbombyid/${id}`),
  updateBOM: (id: number, data: any) => apiRequest<any>(`/production/bom/updatebom/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deleteBOM: (id: number) => apiRequest<any>(`/production/bom/deletebom/${id}`, {
    method: 'DELETE',
  }),
  getShiftForProduction: () => apiRequest<any>('/common/getshiftforproduction'),
};

// ==================== ROLES & PERMISSIONS API ====================

export interface RoleRecord {
  id: number;
  role_name: string;
}

export interface RoleListResponse {
  data: {
    records: RoleRecord[];
  };
  message: string;
  isSuccessful: boolean;
}

export interface PermissionItem {
  module_name: string;
  action: string;
}

export interface GetPermissionsResponse {
  data: {
    role_id: number;
    permissions: PermissionItem[];
  };
  message: string;
  isSuccessful: boolean;
}

export interface UpdateRoleDelta {
  add?: { role_name: string }[];
  delete?: number[];
  edit?: { id: number; role_name: string }[];
}

export interface GivePermissionDelta {
  role_id: number;
  add?: PermissionItem[];
  delete?: PermissionItem[];
}

export const rolesPermissionsApi = {
  /**
   * Fetches the list of all available system roles.
   * GET /roles_permissions/getrolelist
   */
  getRoleList: () => 
    apiRequest<RoleListResponse>('/roles_permissions/getrolelist'),

  /**
   * Updates roles using a delta payload (add, delete, rename).
   * PATCH /roles_permissions/updaterole
   */
  updateRole: (delta: UpdateRoleDelta) => 
    apiRequest<any>('/roles_permissions/updaterole', {
      method: 'PATCH',
      body: JSON.stringify(delta),
    }),

  /**
   * Fetches permissions for a specific role ID.
   * GET /roles_permissions/getpermissionwith?role_id=X
   */
  getPermissions: (roleId: number) => 
    apiRequest<GetPermissionsResponse>(`/roles_permissions/getpermissionwith?role_id=${roleId}`),

  /**
   * Updates permissions for a role using a delta payload (add, delete).
   * PATCH /roles_permissions/givepermission
   */
  givePermission: (delta: GivePermissionDelta) => 
    apiRequest<any>('/roles_permissions/givepermission', {
      method: 'PATCH',
      body: JSON.stringify(delta),
    }),
};

export interface SalesQuotationRecord {
  id: number;
  quotation_code: string;
  quotation_date: string;
  customer_id: number;
  customer_name: string;
  status_id: number;
  status_name: string;
}

export interface SalesQuotationListResponse {
  data: {
    records: SalesQuotationRecord[];
    pagination: {
      page: number;
      limit: number;
      totalRecords?: number;
      totalCount?: number;
      totalPages?: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export const salesApi = {
  getQuotationById: (id: number) =>
    apiRequest<any>(`/sales/quotation/getquotationbyid/${id}`),
  getQuotationList: (params: { search?: string; date?: string; status_id?: number | string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.date) query.set('date', params.date);
    if (params.status_id !== undefined && params.status_id !== '') query.set('status_id', String(params.status_id));
    if (params.page !== undefined && params.page !== null) {
      query.set('page', String(params.page));
    }
    if (params.limit !== undefined && params.limit !== null) {
      query.set('limit', String(params.limit));
    }
    const qs = query.toString();
    return apiRequest<SalesQuotationListResponse>(`/sales/quotation/getquotationlist${qs ? `?${qs}` : ''}`);
  },
  saveDraft: (data: any) =>
    apiRequest<any>('/sales/quotation/savedraft', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  submitQuotation: (data: any) =>
    apiRequest<any>('/sales/quotation/submitquotation', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateQuotation: (id: number, data: any) =>
    apiRequest<any>(
      `/sales/quotation/updatequotation/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    ),
  deleteQuotation: (id: number) =>
    apiRequest<any>(
      `/sales/quotation/deletequotation/${id}`,
      { method: 'DELETE' }
    ),
};
// ==================== SERVICE CENTER API ====================

export interface SMRListRecord {
  id: number;
  requisition_code: string;
  request_date: string;
  location_name: string;
  workcenter_name: string;
  status_name: string;
  status_code?: string;
}

export interface SMRListResponse {
  data: {
    records: SMRListRecord[];
    pagination: {
      page: number;
      limit: number;
      total_records: number;
      total_pages: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface WarrantyServiceRecord {
  warranty_claim_id: number;
  service_code: string;
  consumer_name: string;
  serial_number: string;
  service_date: string;
  warranty_status_code: string;
  warranty_status_name: string;
  claim_status_code: string | null;
  claim_status_name: string | null;
  status_code: string;
  status_name: string;
}

export interface WarrantyServiceListResponse {
  data: {
    records: WarrantyServiceRecord[];
    pagination: {
      page: number;
      limit: number;
      totalRecords: number;
      totalPages: number;
    };
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface MaterialRequisitionItemRecord {
  item_id: number;
  item_code: string;
  item_name: string;
  item_type_name?: string;
  item_uom?: string;
  current_QTY?: number;
  current_qty?: number;
}

export interface MaterialRequisitionItemsResponse {
  data: {
    records: MaterialRequisitionItemRecord[];
  };
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export const serviceCenterApi = {
  getSMRList: (params: { text_search?: string; date?: string; status?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.text_search) query.set('text_search', params.text_search);
    if (params.date) query.set('date', params.date);
    if (params.status) query.set('status', params.status);
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<SMRListResponse>(`/service-center/materialRequisitionlist${qs ? `?${qs}` : ''}`);
  },
  getSMRById: (id: number | string) =>
    apiRequest<any>(`/service-center/materialRequisitiongetbyid?id=${id}`),
  updateSMR: (id: number | string, data: any) =>
    apiRequest<any>(`/service-center/updatematerialRequisitions?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteSMR: (id: number | string) =>
    apiRequest<any>(`/service-center/deleteSMR?service_material_requisition_id=${id}`, {
      method: 'DELETE',
    }),
  receiveItemBySC: (data: { service_material_requisition_id: number | string }) =>
    apiRequest<any>('/service-center/receiveitembysc', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  createSMR: (data: any) =>
    apiRequest<any>('/service-center/creatematerialRequisitions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getWarrantyServiceList: (params: { text_search?: string; date?: string; status?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.text_search) query.set('text_search', params.text_search);
    if (params.date) query.set('date', params.date);
    if (params.status) query.set('status', params.status);
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<WarrantyServiceListResponse>(`/service-center/warrantyServiceslisting${qs ? `?${qs}` : ''}`);
  },
  getWarrantyServiceById: (id: number | string) =>
    apiRequest<WarrantyServiceDetailResponse>(`/service-center/warrantyServicesbyid?id=${id}`),
  getDetailFromSerialNumber: (serialNumber: string) =>
    apiRequest<SerialNumberDetailResponse>(`/service-center/getdetailfromserialnumber?serial_number=${encodeURIComponent(serialNumber)}`),
  createWarrantyService: (data: any) =>
    apiRequest<any>('/service-center/createwarrantyServices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateWarrantyService: (id: number | string, data: any) =>
    apiRequest<any>(`/service-center/updatewarrantyServices?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  /** GET /service-center/getitemfrommaterialrequisitions — items for warranty repair dropdown */
  getItemsFromMaterialRequisitions: () =>
    apiRequest<MaterialRequisitionItemsResponse>('/service-center/getitemfrommaterialrequisitions'),
};

export interface SerialNumberDetail {
  item_code?: string;
  item_name?: string;
  customer_id?: number;
  customer_name?: string;
  batch_id?: number | null;
  batch?: string | null;
  production_date?: string | null;
  invoice_date?: string | null;
  delivery_date?: string | null;
  warranty_period?: number;
  warranty_end_date?: string | null;
  warranty_status_id?: number;
  warranty_status_code?: string;
  warranty_status_name?: string;
  currency_id?: number;
  [key: string]: string | number | null | undefined;
}

export interface SerialNumberDetailResponse {
  data: SerialNumberDetail;
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}

export interface WarrantyServiceDetailItem {
  id: number;
  item_id: number;
  item_name: string;
  qty: number;
  price: number;
  is_billable: boolean;
}

export interface WarrantyServiceDetailAction {
  id: number;
  service_action_id: number;
  service_action_name: string;
  new_serial_number: string | null;
  labour_cost: number;
  is_labour_cost: boolean;
  total_amount: number;
  currency_id?: number;
  items: WarrantyServiceDetailItem[];
}

export interface WarrantyServiceDetail {
  id: number;
  service_code: string;
  service_date: string;
  serial_number: string;
  consumer_name: string;
  item_name: string;
  batch: string;
  production_date: string;
  invoice_date: string;
  warranty_end_date: string;
  warranty_status_name: string;
  complaint_description: string;
  claim_status_id: number | null;
  claim_status_code?: string | null;
  claim_status_name: string | null;
  paid_services?: boolean;
  rejection_remarks?: string | null;
  warranty_status_code?: string;
  status_id: number;
  status_name: string;
  currency_id?: number;
  actions: WarrantyServiceDetailAction[];
}

export interface WarrantyServiceDetailResponse {
  data: WarrantyServiceDetail;
  message: string;
  showMessage: boolean;
  isSuccessful: boolean;
}
