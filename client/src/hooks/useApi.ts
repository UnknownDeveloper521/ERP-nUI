import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  countriesApi,
  statesApi,
  holidayApi,
  attendanceApi,
  warehouseApi,
  binsApi,
  commonApi,
  itemsApi,
  materialThresholdApi,
  payrollApi,
  employeesApi,
  departmentsApi,
  leaveManagementApi,
  jobPostingsApi,
  applicationsApi,
  productsApi,
  customersApi,
  suppliersApi,
  salesOrdersApi,
  purchaseOrdersApi,
  leadsApi,
  opportunitiesApi,
  accountsApi,
  transactionsApi,
  hrEmployeeApi,
  hrCommonApi,
  salaryEarningsApi,
  salaryDeductionsApi,
  salaryStructureApi,
} from '@/lib/api';

// ==================== HRMS HOOKS ====================

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.getAll(),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: () => employeesApi.getOne(id),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      employeesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll(),
  });
}

export function useAttendance(params: { page?: number, limit?: number, search_text?: string, department_id?: number, location_id?: number, date?: string } = {}) {
  return useQuery({
    queryKey: ['attendance', params],
    queryFn: () => attendanceApi.getList(params),
  });
}

export function useLeaves() {
  return useQuery({
    queryKey: ['leaves'],
    queryFn: () => leaveManagementApi.getList(),
  });
}

export function useEmployeeLeaves(employeeId: string) {
  return useQuery({
    queryKey: ['leaves', 'employee', employeeId],
    queryFn: () => leaveManagementApi.getList({ search: employeeId }),
    enabled: !!employeeId,
  });
}

export function useRunPayrollList(params: { page?: number; limit?: number; search?: string; payroll_period_id?: number; department_id?: number; refreshKey?: any } = {}) {
  const { refreshKey, ...apiParams } = params;
  return useQuery({
    queryKey: ['payroll', 'run-list', params],
    queryFn: () => payrollApi.getRunPayrollList(apiParams),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function usePayrollDetail(employeeId: number, payrollPeriodId: number) {
  return useQuery({
    queryKey: ['payroll', 'detail', employeeId, payrollPeriodId],
    queryFn: () => payrollApi.getPayrollDetail(employeeId, payrollPeriodId),
    enabled: !!employeeId && !!payrollPeriodId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useUpdatePayrollDetail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, payrollPeriodId, data }: { employeeId: number, payrollPeriodId: number, data: any }) => 
      payrollApi.updatePayrollDetail(employeeId, payrollPeriodId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}

export function usePayslipsList(params: { page?: number; limit?: number; search?: string; pay_period_id?: number; department_id?: number; refreshKey?: any } = {}) {
  const { refreshKey, ...apiParams } = params;
  return useQuery({
    queryKey: ['payroll', 'payslips-list', params],
    queryFn: () => payrollApi.getPayslipsList(apiParams),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function usePayslipDetail(employeeId: number, payPeriodId: number) {
  return useQuery({
    queryKey: ['payroll', 'payslip-detail', employeeId, payPeriodId],
    queryFn: () => payrollApi.getPayslipDetail(employeeId, payPeriodId),
    enabled: !!employeeId && !!payPeriodId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function usePayPeriods() {
  return useQuery({
    queryKey: ['common', 'pay-periods'],
    queryFn: () => commonApi.getPayPeriods(),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useCommonEmployees() {
  return useQuery({
    queryKey: ['common', 'employees'],
    queryFn: () => commonApi.getEmployees(),
  });
}

// ==================== INVENTORY HOOKS ====================

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.getAll(),
  });
}

// ==================== COMMON DROPDOWNS ====================

export function useDepartmentsDropdown() {
  return useQuery({
    queryKey: ['common', 'departments'],
    queryFn: () => commonApi.getDepartments(),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: productsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ==================== CUSTOMERS & SUPPLIERS HOOKS ====================

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getList(),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      customersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.getAll,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: suppliersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

// ==================== SALES & PURCHASES HOOKS ====================

export function useSalesOrders() {
  return useQuery({
    queryKey: ['sales-orders'],
    queryFn: salesOrdersApi.getAll,
  });
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ['purchase-orders'],
    queryFn: purchaseOrdersApi.getAll,
  });
}

// ==================== CRM HOOKS ====================

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: leadsApi.getAll,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      leadsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useOpportunities() {
  return useQuery({
    queryKey: ['opportunities'],
    queryFn: opportunitiesApi.getAll,
  });
}

// ==================== HR EMPLOYEE HOOKS ====================

export function useHrEmployeeList(params: { page?: number; limit?: number; search?: string; department_id?: number }) {
  return useQuery({
    queryKey: ['hr-employees', params],
    queryFn: () => hrEmployeeApi.getEmployeeList(params),
    staleTime: 30000,
  });
}

export function useHrEmployee(employeeId: number | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['hr-employee', employeeId],
    queryFn: () => hrEmployeeApi.getEmployee(employeeId!),
    enabled: !!employeeId && (options?.enabled ?? true),
    staleTime: 300000,
  });
}

export function useHrEmployeeJobDetails(employeeId: number | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['hr-employee-job', employeeId],
    queryFn: () => hrEmployeeApi.getEmployeeJobDetails(employeeId!),
    enabled: !!employeeId && (options?.enabled ?? true),
    staleTime: 300000,
  });
}

export function useHrEmployeeDocuments(employeeId: number | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['hr-employee-docs', employeeId],
    queryFn: () => hrEmployeeApi.getEmployeeDocuments(employeeId!),
    enabled: !!employeeId && (options?.enabled ?? true),
    staleTime: 300000,
  });
}

export function useHrEmployeeSystemAccess(employeeId: number | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['hr-employee-system', employeeId],
    queryFn: () => hrEmployeeApi.getEmployeeSystemAccess(employeeId!),
    enabled: !!employeeId && (options?.enabled ?? true),
    staleTime: 300000,
  });
}

export function useCreateHrEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hrEmployeeApi.createEmployee,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-employees'] }); },
  });
}

export function useUpdateHrEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => hrEmployeeApi.updateEmployee(id, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr-employee', vars.id] });
    },
  });
}

export function useDeleteHrEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => hrEmployeeApi.deleteEmployee(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-employees'] }); },
  });
}

export function useAddHrEmployeeJobDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hrEmployeeApi.addEmployeeJobDetails,
    onSuccess: (_data, vars) => { queryClient.invalidateQueries({ queryKey: ['hr-employee-job', vars.employee_id] }); },
  });
}

export function useUpdateHrEmployeeJobDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => hrEmployeeApi.updateEmployeeJobDetails(id, data),
    onSuccess: (_data, vars) => { queryClient.invalidateQueries({ queryKey: ['hr-employee-job', vars.id] }); },
  });
}

export function useAddHrEmployeeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hrEmployeeApi.addEmployeeDocument,
    onSuccess: (_data, formData) => {
      const employeeId = formData.get('employee_id');
      queryClient.invalidateQueries({ queryKey: ['hr-employee-docs', employeeId ? Number(employeeId) : undefined] });
    },
  });
}

export function useDeleteHrEmployeeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docId: number) => hrEmployeeApi.deleteEmployeeDocument(docId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-employee-docs'] }); },
  });
}

export function useAddHrEmployeeSystemAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hrEmployeeApi.addEmployeeSystemAccess,
    onSuccess: (_data, vars) => { queryClient.invalidateQueries({ queryKey: ['hr-employee-system', vars.employee_id] }); },
  });
}

export function useUpdateHrEmployeeSystemAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => hrEmployeeApi.updateEmployeeSystemAccess(id, data),
    onSuccess: (_data, vars) => { queryClient.invalidateQueries({ queryKey: ['hr-employee-system', vars.id] }); },
  });
}

// ==================== HR COMMON DROPDOWN HOOKS ====================

export function useHrGenders(enabled = true) {
  return useQuery({ queryKey: ['hr-genders'], queryFn: () => hrCommonApi.getGenders(true), enabled, staleTime: 300000 });
}
export function useHrNationalities(enabled = true) {
  return useQuery({ queryKey: ['hr-nationalities'], queryFn: () => hrCommonApi.getNationalities(true), enabled, staleTime: 300000 });
}
export function useHrBloodGroups(enabled = true) {
  return useQuery({ queryKey: ['hr-blood-groups'], queryFn: () => hrCommonApi.getBloodGroups(true), enabled, staleTime: 300000 });
}
export function useHrMaritalStatuses(enabled = true) {
  return useQuery({ queryKey: ['hr-marital-statuses'], queryFn: () => hrCommonApi.getMaritalStatuses(true), enabled, staleTime: 300000 });
}
export function useHrEmploymentTypes(enabled = true) {
  return useQuery({ queryKey: ['hr-employment-types'], queryFn: () => hrCommonApi.getEmploymentTypes(true), enabled, staleTime: 300000 });
}
export function useHrDepartments(enabled = true) {
  return useQuery({ queryKey: ['hr-departments'], queryFn: () => hrCommonApi.getDepartments(true), enabled, staleTime: 300000 });
}
export function useHrGrades(enabled = true) {
  return useQuery({ queryKey: ['hr-grades'], queryFn: () => hrCommonApi.getGrades(true), enabled, staleTime: 300000 });
}
export function useHrDesignations(enabled = true) {
  return useQuery({
    queryKey: ['hr-designations'],
    queryFn: () => hrCommonApi.getDesignations(),
    enabled,
    staleTime: 300000,
  });
}
export function useHrLocations(enabled = true) {
  return useQuery({ queryKey: ['hr-locations'], queryFn: () => hrCommonApi.getLocations(true), enabled, staleTime: 300000 });
}
export function useHrShifts(enabled = true) {
  return useQuery({ queryKey: ['hr-shifts'], queryFn: () => hrCommonApi.getShifts(true), enabled, staleTime: 300000 });
}
export function useHrRoles(enabled = true) {
  return useQuery({ queryKey: ['hr-roles'], queryFn: () => hrCommonApi.getRoles(true), enabled, staleTime: 300000 });
}
export function useHrReportingManagers(enabled = true) {
  return useQuery({ queryKey: ['hr-reporting-managers'], queryFn: () => hrCommonApi.getReportingManagers(), enabled, staleTime: 60000 });
}
export function useHrCountries(enabled = true) {
  return useQuery({ queryKey: ['hr-countries'], queryFn: () => hrCommonApi.getCountries(), enabled, staleTime: 300000 });
}
export function useHrStates(countryId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['hr-states', countryId],
    queryFn: () => hrCommonApi.getStates(countryId),
    enabled: enabled && !!countryId,
    staleTime: 300000,
  });
}
export function useHrCities(stateId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['hr-cities', stateId],
    queryFn: () => hrCommonApi.getCities(stateId),
    enabled: enabled && !!stateId,
    staleTime: 300000,
  });
}

export function useHrWarehouses(status?: number, enabled = true) {
  return useQuery({ 
    queryKey: ['hr-warehouses', status], 
    queryFn: () => hrCommonApi.getWarehouses(status), 
    enabled, 
    staleTime: 300000 
  });
}

export function useHrWorkCenters(enabled = true) {
  return useQuery({ 
    queryKey: ['hr-workCenters'], 
    queryFn: () => hrCommonApi.getWorkCenters(), 
    enabled, 
    staleTime: 300000 
  });
}

export function useHrOperations(enabled = true) {
  return useQuery({ 
    queryKey: ['hr-operations'], 
    queryFn: () => hrCommonApi.getOperations(), 
    enabled, 
    staleTime: 300000 
  });
}

export function useHrOperationsByWorkCenter(workCenterId: string | number, enabled = true) {
  return useQuery({ 
    queryKey: ['hr-operations', workCenterId], 
    queryFn: () => hrCommonApi.getOperationsByWorkCenter(workCenterId), 
    enabled: enabled && !!workCenterId, 
    staleTime: 300000 
  });
}

export function useHrDocumentTypes(enabled = true) {
  return useQuery({ 
    queryKey: ['hr-document-types'], 
    queryFn: () => hrCommonApi.getDocumentTypes(true), 
    enabled, 
    staleTime: 300000 
  });
}

export function useHrEmploymentStatus(status?: number, enabled = true) {
  return useQuery({
    queryKey: ['hr-employment-status', status],
    queryFn: () => hrCommonApi.getEmploymentStatus(status),
    enabled,
    staleTime: 300000
  });
}

// ==================== ACCOUNTING HOOKS ====================

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: transactionsApi.getAll,
  });
}



// ==================== SALARY COMPONENT HOOKS ====================

// Salary Earnings Hooks
export function useSalaryEarnings(page: number = 1, limit: number = 10, search?: string, status?: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['salary-earnings', page, limit, search, status],
    queryFn: () => salaryEarningsApi.getAll(page, limit, search, status),
    refetchOnMount: 'always',
    staleTime: 0,
    ...options,
  });
}

export function useSalaryEarning(id: number) {
  return useQuery({
    queryKey: ['salary-earnings', id],
    queryFn: () => salaryEarningsApi.getOne(id),
    enabled: !!id,
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useCreateSalaryEarning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salaryEarningsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-earnings'] });
    },
  });
}

export function useUpdateSalaryEarning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      salaryEarningsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-earnings'] });
    },
  });
}

export function useDeleteSalaryEarning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salaryEarningsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-earnings'] });
    },
  });
}

// Salary Deductions Hooks
export function useSalaryDeductions(page: number = 1, limit: number = 10, search_text?: string, status?: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['salary-deductions', page, limit, search_text, status],
    queryFn: () => salaryDeductionsApi.getAll(page, limit, search_text, status),
    refetchOnMount: 'always',
    staleTime: 0,
    ...options,
  });
}

export function useSalaryDeduction(id: number) {
  return useQuery({
    queryKey: ['salary-deductions', id],
    queryFn: () => salaryDeductionsApi.getOne(id),
    enabled: !!id,
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useCreateSalaryDeduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salaryDeductionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-deductions'] });
    },
  });
}

export function useUpdateSalaryDeduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      salaryDeductionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-deductions'] });
    },
  });
}

export function useDeleteSalaryDeduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salaryDeductionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-deductions'] });
    },
  });
}

// Common Dropdowns for Salary Components
export function useEarningTypes(status?: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['earning-types', status],
    queryFn: () => commonApi.getEarningTypes(status),
    refetchOnMount: 'always',
    staleTime: 0,
    ...options,
  });
}

export function useDeductionTypes(status?: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['deduction-types', status],
    queryFn: () => commonApi.getDeductionTypes(status),
    refetchOnMount: 'always',
    staleTime: 0,
    ...options,
  });
}



// ==================== SALARY STRUCTURE HOOKS ====================

// Salary Structure Hooks
export function useSalaryStructures(page: number = 1, limit: number = 10, search?: string, status?: boolean) {
  return useQuery({
    queryKey: ['salary-structures', page, limit, search, status],
    queryFn: () => salaryStructureApi.getAll(page, limit, search, status),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useSalaryStructure(id: number) {
  return useQuery({
    queryKey: ['salary-structures', id],
    queryFn: () => salaryStructureApi.getOne(id),
    enabled: !!id,
  });
}

export function useCreateSalaryStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salaryStructureApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-structures'] });
    },
  });
}

export function useUpdateSalaryStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      salaryStructureApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-structures'] });
    },
  });
}

export function useDeleteSalaryStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salaryStructureApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-structures'] });
    },
  });
}

// Common Dropdown for Earning Components (used in Salary Structure)
export function useEarningComponents(params?: { search?: string; status?: number }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['earning-components', params?.search, params?.status],
    queryFn: () => commonApi.getEarningComponents(params),
    ...options,
  });
}

/** Deduction catalog for Salary Structure; `/common/getdeductions`. */
export function useDeductionComponents(params?: { search?: string; status?: number }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['deduction-components', params?.search, params?.status],
    queryFn: () => commonApi.getDeductions(params?.status, params?.search),
    ...options,
  });
}

// Common Dropdown for Calculation Types (used in Salary Structure)
export function useCalculationTypes(status?: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['calculation-types', status],
    queryFn: () => commonApi.getCalculationTypes(status),
    ...options,
  });
}

