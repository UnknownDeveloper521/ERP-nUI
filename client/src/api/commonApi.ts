import { apiRequest } from "@/lib/api";

/**
 * Common API service for fetching master data used across the application.
 * Designed to be easily extensible for new master data types.
 */
export const commonApi = {
  /**
   * Fetches the list of active departments.
   */
  getDepartments: () => apiRequest<any>('/common/getdepartment?status=1'),

  /**
   * Fetches all common master data in a single batch call.
   * This is the preferred method for initial data loading to reduce network overhead.
   * Returns a list of records each with an 'entity_type_name' to identify its category.
   * @param options.status - Pass 1 for active-only (same idea as getdepartment?status=1 / getleavetype?status=1).
   */
  getEntityValues: (options?: { status?: number }) => {
    const qs = options?.status !== undefined ? `?status=${options.status}` : '';
    return apiRequest<any>(`/common/getentityvalues${qs}`);
  },

  /**
   * Future Master APIs (Placeholders for scalability)
   * These can be uncommented and implemented as needed.
   */
  /*
  getWorkCenters: () => apiRequest<any>('/common/getworkcenter?status=1'),
  getWarehouses: () => apiRequest<any>('/common/getwarehouse?status=1'),
  getLocations: () => apiRequest<any>('/common/getlocation?status=1'),
  */
  /**
   * Fetches detailed information for a specific company.
   * @param companyId - The ID of the company to fetch details for.
   */
  getCompanyDetails: (companyId: string | number) => 
    apiRequest<any>(`/common/getcompanydetails?company_id=${companyId}`),
};
