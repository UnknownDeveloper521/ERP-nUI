import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';

// ==================== HRMS HOOKS ====================

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: api.employeesApi.getAll,
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: () => api.employeesApi.getOne(id),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.employeesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.employeesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.employeesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: api.departmentsApi.getAll,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.departmentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.departmentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.departmentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

export function useAttendance() {
  return useQuery({
    queryKey: ['attendance'],
    queryFn: api.attendanceApi.getAll,
  });
}

export function useEmployeeAttendance(employeeId: string) {
  return useQuery({
    queryKey: ['attendance', 'employee', employeeId],
    queryFn: () => api.attendanceApi.getByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.attendanceApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

export function useLeaves() {
  return useQuery({
    queryKey: ['leaves'],
    queryFn: api.leavesApi.getAll,
  });
}

export function useEmployeeLeaves(employeeId: string) {
  return useQuery({
    queryKey: ['leaves', 'employee', employeeId],
    queryFn: () => api.leavesApi.getByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

export function useCreateLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.leavesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
  });
}

export function useUpdateLeaveStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, approvedBy }: { id: string; status: string; approvedBy?: string }) => 
      api.leavesApi.updateStatus(id, status, approvedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
  });
}

export function usePayroll() {
  return useQuery({
    queryKey: ['payroll'],
    queryFn: api.payrollApi.getAll,
  });
}

export function useEmployeePayroll(employeeId: string) {
  return useQuery({
    queryKey: ['payroll', 'employee', employeeId],
    queryFn: () => api.payrollApi.getByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

export function useCreatePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.payrollApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}

export function useUpdatePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.payrollApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}

export function useJobPostings() {
  return useQuery({
    queryKey: ['job-postings'],
    queryFn: api.jobPostingsApi.getAll,
  });
}

export function useJobPosting(id: string) {
  return useQuery({
    queryKey: ['job-postings', id],
    queryFn: () => api.jobPostingsApi.getOne(id),
    enabled: !!id,
  });
}

export function useCreateJobPosting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.jobPostingsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
    },
  });
}

export function useUpdateJobPosting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.jobPostingsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
    },
  });
}

export function useApplications() {
  return useQuery({
    queryKey: ['applications'],
    queryFn: api.applicationsApi.getAll,
  });
}

export function useJobApplications(jobPostingId: string) {
  return useQuery({
    queryKey: ['applications', 'job', jobPostingId],
    queryFn: () => api.applicationsApi.getByJob(jobPostingId),
    enabled: !!jobPostingId,
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.applicationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

// ==================== INVENTORY HOOKS ====================

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: api.productsApi.getAll,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => api.productsApi.getOne(id),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.productsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.productsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ==================== CUSTOMERS & SUPPLIERS HOOKS ====================

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: api.customersApi.getAll,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.customersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.customersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.customersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: api.suppliersApi.getAll,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.suppliersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

// ==================== SALES & PURCHASES HOOKS ====================

export function useSalesOrders() {
  return useQuery({
    queryKey: ['sales-orders'],
    queryFn: api.salesOrdersApi.getAll,
  });
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ['purchase-orders'],
    queryFn: api.purchaseOrdersApi.getAll,
  });
}

// ==================== CRM HOOKS ====================

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: api.leadsApi.getAll,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.leadsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.leadsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useOpportunities() {
  return useQuery({
    queryKey: ['opportunities'],
    queryFn: api.opportunitiesApi.getAll,
  });
}

// ==================== ACCOUNTING HOOKS ====================

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: api.accountsApi.getAll,
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: api.transactionsApi.getAll,
  });
}

// ==================== LOGISTICS HOOKS ====================

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: api.vehiclesApi.getAll,
  });
}

export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: api.tripsApi.getAll,
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.tripsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
