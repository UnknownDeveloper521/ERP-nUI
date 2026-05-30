/**
 * ============================================================================
 * RUN PAYROLL TAB - PAYROLL PROCESSING
 * ============================================================================
 */

import React, { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, AlertCircle, ChevronLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useHasPermission } from "@/hooks/usePermissions";
import { differenceInDays, isValid } from "date-fns";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import {
  useRunPayrollList,
  usePayrollDetail,
  useUpdatePayrollDetail,
  usePayPeriods,
  // useDepartmentsDropdown,
  useCommonEmployees
} from "@/hooks/useApi";
import { useCommonStore } from "@/store/commonStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_SYMBOL } from "@/config/appConfig";

// ============================================================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================================================

const OT_RATE_PER_HOUR = 100;

const calculatePeriodDays = (startDate: string | Date, endDate: string | Date): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (!isValid(start) || !isValid(end)) return 0;
  return differenceInDays(end, start) + 1;
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, string> = {
    Locked: "bg-green-100 text-green-700 border-green-200",
    Available: "bg-green-100 text-green-700 border-green-200",
    Draft: "bg-gray-100 text-gray-700 border-gray-200",
    Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };

  return (
    <Badge variant="outline" className={cn("font-semibold px-2 py-0.5 text-[10px]", variants[status] || "bg-gray-50 text-gray-500")}>
      {status}
    </Badge>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RunPayroll() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [matchForm, params] = useRoute("/hrms/payroll-management/run-payroll/:employeeId");

  if (matchForm && params?.employeeId) {
    return <EmployeePayrollForm employeeId={params.employeeId} setRefreshTrigger={setRefreshTrigger} />;
  }

  return <EmployeeListScreen refreshTrigger={refreshTrigger} />;
}

// ============================================================================
// SCREEN A: EMPLOYEE LIST
// ============================================================================

function EmployeeListScreen({ refreshTrigger }: { refreshTrigger: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { canCreate, canEdit } = useHasPermission();
  const canOpen = canCreate("HRMS:Payroll Management") || canEdit("HRMS:Payroll Management");

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [deptFilterId, setDeptFilterId] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [location] = useLocation();

  const { data: payPeriodsData, refetch: refetchPeriods } = usePayPeriods();
  /*
  const { data: departmentsData, refetch: refetchDepts } = useDepartmentsDropdown();
  const departments = (Array.isArray(departmentsData) ? departmentsData : departmentsData?.data?.records || departmentsData?.data || []) || [];
  */
  const departmentsFromStore = useCommonStore((state) => state.departments);
  const departments = useMemo(
    () =>
      (departmentsFromStore || []).map((d: any) => ({
        ...d,
        name: d.name ?? d.value_name,
        department_name: d.department_name ?? d.value_name ?? d.name,
      })),
    [departmentsFromStore]
  );
  const { data: commonEmployeesData } = useCommonEmployees();


  // Mapping for employee code to ID
  const employeeCodeToIdMap = useMemo(() => {
    const map = new Map<string, number>();
    const records = (commonEmployeesData?.data?.records || []) as any[];
    records.forEach(emp => {
      if (emp.code && emp.id) {
        map.set(emp.code, emp.id);
      }
    });
    return map;
  }, [commonEmployeesData]);
  const payPeriods = (Array.isArray(payPeriodsData) ? payPeriodsData : payPeriodsData?.data?.records || payPeriodsData?.data || []) || [];

  // Mapping for Pay Period Name to ID (MOVED BELOW payPeriods)
  const payPeriodNameToIdMap = useMemo(() => {
    const map = new Map<string, number>();
    payPeriods.forEach((p: any) => {
      const name = p.pay_period || p.period_name || p.name || p.period || p.pay_period_name;
      if (name && p.id) {
        map.set(name, p.id);
      }
    });
    return map;
  }, [payPeriods]);

  useEffect(() => {
    if (Array.isArray(payPeriods) && payPeriods.length > 0 && !selectedPeriodId) {
      setSelectedPeriodId(payPeriods[0].id.toString());
    }
  }, [payPeriods, selectedPeriodId]);

  const { data: payrollListData, isLoading: isListLoading, isFetching: isListFetching, refetch } = useRunPayrollList({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearchQuery,
    payroll_period_id: selectedPeriodId && selectedPeriodId !== "All" ? parseInt(selectedPeriodId) : undefined,
    department_id: deptFilterId && deptFilterId !== "All" ? parseInt(deptFilterId) : undefined,
    refreshKey: location + refreshTrigger,
  });

  // Fresh data guarantee: 
  // Relying on useQuery with refetchOnMount: 'always' and queryKey change (location + refreshTrigger) 
  // to ensure data is never stale without manual duplicate calls on mount.
  useEffect(() => {
    // If we need manual force-refetch for dropdowns on trigger change:
    if (refreshTrigger > 0) {
      refetchPeriods();
      // refetchDepts();
    }
  }, [refreshTrigger, refetchPeriods]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedPeriodId, deptFilterId]);

  const rawRecords = (payrollListData?.data?.records || payrollListData?.records || []) as any[];
  const pagination = (payrollListData?.data?.pagination || payrollListData?.pagination) || { totalCount: 0, totalPages: 1 };

  // Map records to ensure IDs are present for navigation
  const mappedRecords = useMemo(() => {
    return rawRecords.map(r => {
      // Priority for employee_id:
      // 1. Explicit employee_id from record
      // 2. Lookup from employee_code
      const resolvedId = r.employee_id || (r.employee_code ? employeeCodeToIdMap.get(r.employee_code) : r.id);
      
      // Robust pay_period_id resolution:
      const currentFilterId = selectedPeriodId && selectedPeriodId !== "All" ? parseInt(selectedPeriodId) : null;
      const resolvedPeriodId = r.pay_period_id || r.payroll_period_id || r.period_id || 
                               currentFilterId || 
                               (r.pay_period || r.pay_period_name ? payPeriodNameToIdMap.get(r.pay_period || r.pay_period_name) : null);

      return {
        ...r,
        employee_id: resolvedId,
        pay_period_id: resolvedPeriodId,
        // Combination key as requested: employee_code + period
        unique_key: `${r.employee_code}-${r.pay_period || r.pay_period_name || resolvedPeriodId}-${r.id || r.payroll_run_id || Math.random()}`
      };
    });
  }, [rawRecords, selectedPeriodId, employeeCodeToIdMap, payPeriodNameToIdMap]);

  const handleOpenEmployee = (id: number, periodId?: number) => {
    if (isTableLoading) return;
    const finalPeriodId = periodId || (selectedPeriodId !== "All" ? parseInt(selectedPeriodId) : null);
    setLocation(`/hrms/payroll-management/run-payroll/${id}?periodId=${finalPeriodId}`);
  };

  const isTableLoading = isListLoading || isListFetching;

  return (
    <div className="space-y-6">
      <AppListToolbar
        search={{
          value: searchQuery,
          onChange: (val) => {
            setSearchQuery(val);
            setCurrentPage(1);
          },
          placeholder: "Search employees..."
        }}
        filters={[
          {
            type: 'select',
            label: 'Pay Period',
            value: Array.isArray(payPeriods) ? (payPeriods.find((p: any) => p.id.toString() === selectedPeriodId)?.name || payPeriods.find((p: any) => p.id.toString() === selectedPeriodId)?.period || "All Pay Period") : "All Pay Period",
            options: ["All Pay Period", ...(Array.isArray(payPeriods) ? payPeriods.map((p: any) => p?.name || p?.period).filter(Boolean) : [])],
            onChange: (periodLabel) => {
              setCurrentPage(1);
              if (periodLabel === "All Pay Period") {
                setSelectedPeriodId("All");
              } else if (Array.isArray(payPeriods)) {
                const period = payPeriods.find((p: any) => (p.name || p.period) === periodLabel);
                if (period) setSelectedPeriodId(period.id.toString());
              }
            },
            searchable: true
          },
          {
            type: 'select',
            label: 'Department',
            value: Array.isArray(departments) ? (departments.find((d: any) => d.id.toString() === deptFilterId)?.name || departments.find((d: any) => d.id.toString() === deptFilterId)?.department_name || "All Department") : "All Department",
            options: ["All Department", ...(Array.isArray(departments) ? departments.map((d: any) => d?.name || d?.department_name).filter(Boolean) : [])],
            onChange: (deptName) => {
              setCurrentPage(1);
              if (deptName === "All Department") {
                setDeptFilterId("All");
              } else if (Array.isArray(departments)) {
                const dept = departments.find((d: any) => (d.name || d.department_name) === deptName);
                if (dept) setDeptFilterId(dept.id.toString());
              }
            },
            searchable: true
          }
        ]}
      />

      {!selectedPeriodId ? (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Please select Pay Period to load employees</h3>
            <p className="text-sm text-muted-foreground">
              Choose a pay period from the dropdown above to view employees
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="rounded-md border mb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Employee Code</TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Pay Period</TableHead>
                    <TableHead>Department / Plant</TableHead>
                    <TableHead>Salary Structure</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isTableLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">Loading...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : mappedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        No data found
                      </TableCell>
                    </TableRow>
                  ) : (
                    mappedRecords.map((emp: any) => (
                      <TableRow key={emp.unique_key || emp.payroll_run_id || `${emp.employee_id}-${emp.pay_period_id}`} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">{emp.employee_code}</TableCell>
                        <TableCell>{emp.employee_name}</TableCell>
                        <TableCell>{emp.pay_period || emp.pay_period_name || "N/A"}</TableCell>
                        <TableCell>{emp.department_name}</TableCell>
                        <TableCell>
                          {emp.salary_structure_name || <span className="text-red-500 text-sm">Not Assigned</span>}
                        </TableCell>
                        <TableCell>{getStatusBadge(emp.payroll_status)}</TableCell>
                        <TableCell className="text-right">
                          {canOpen && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isTableLoading}
                              onClick={() => handleOpenEmployee(emp.employee_id || emp.id, emp.pay_period_id)}
                            >
                              Open
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <DataTablePagination
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalCount}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// SCREEN B: EMPLOYEE PAYROLL FORM
// ============================================================================

function EmployeePayrollForm({
  employeeId,
  setRefreshTrigger
}: {
  employeeId: string;
  setRefreshTrigger: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const searchParams = new URLSearchParams(window.location.search);
  const payPeriodId = searchParams.get("periodId") || "";

  // State
  const [paidDays, setPaidDays] = useState<string>("");
  const [lwpDays, setLwpDays] = useState<string>("");
  const [otHours, setOtHours] = useState<string>("0");
  const [currentStatus, setCurrentStatus] = useState<string>("Pending");
  // API Hooks
  const { data: detailData, isLoading: isDetailLoading } = usePayrollDetail(parseInt(employeeId), parseInt(payPeriodId));
  const { data: payPeriodsData } = usePayPeriods();
  const updateMutation = useUpdatePayrollDetail();
  const entityValues = useCommonStore(state => state.entityValues);

  const payrollData = detailData?.data || detailData;
  // FIX: corrected typo from allPayPeriodsData to payPeriodsData to ensure correctly resolved names.
  const allPayPeriods = (Array.isArray(payPeriodsData) ? payPeriodsData : payPeriodsData?.data?.records || payPeriodsData?.data || []) || [];

  /**
   * Resolves a numeric pay_period_id to its human-readable month-year name.
   * Checks multiple field variants (period_name, period, name) across the periods list.
   */
  const resolvePeriodName = (id: any, periods: any[]) => {
    if (!id || !periods) return "N/A";
    const found = periods.find(p => 
      String(p.id) === String(id) || 
      String(p.period_id) === String(id) ||
      String(p.pay_period_id) === String(id)
    );
    return found?.period_name || found?.period || found?.name || id;
  };
  const currentPayPeriodName = resolvePeriodName(payPeriodId, allPayPeriods);

  // Map flat backend response to expected UI structures
  const employee = useMemo(() => payrollData ? {
    name: payrollData.employee_name,
    employee_code: payrollData.employee_code,
    department: payrollData.department_name
  } : null, [payrollData]);

  const payPeriod = useMemo(() => ({
    period: currentPayPeriodName,
    period_days: payrollData?.period_days || 0
  }), [currentPayPeriodName, payrollData]);

  const salaryAssignment = useMemo(() => payrollData ? {
    structure_name: payrollData.salary_structure_name,
    earnings: payrollData.earnings,
    deductions: (payrollData.deductions || []).filter((d: any) => !d.component_name.toUpperCase().includes("LWP"))
  } : null, [payrollData]);

  const existingRun = payrollData; // The flat object contains the run fields

  useEffect(() => {
    if (existingRun) {
      setPaidDays(existingRun.paid_days?.toString() || "0");
      setLwpDays(existingRun.lwp_days?.toString() || "0");
      setOtHours(existingRun.ot_hours?.toString() || "0");
      setCurrentStatus(existingRun.payroll_status || "Pending");
    }
  }, [payrollData, existingRun]);

  const periodDays = payPeriod?.period_days || 0;

  // Derived Values
  // Base Calculations for Payroll
  const totalMonthlyGross = useMemo(() => {
    return (salaryAssignment?.earnings || []).reduce((sum: number, c: any) => sum + (c.monthly_amount || 0), 0);
  }, [salaryAssignment]);

  const perDaySalary = periodDays > 0 ? totalMonthlyGross / periodDays : 0;

  const proratedSalary = useMemo(() => {
    const pDays = parseFloat(paidDays || "0");
    return perDaySalary * pDays;
  }, [perDaySalary, paidDays]);

  const lwpAmount = useMemo(() => {
    const lDays = parseFloat(lwpDays || "0");
    return perDaySalary * lDays;
  }, [perDaySalary, lwpDays]);

  const otAmount = parseFloat(otHours || "0") * OT_RATE_PER_HOUR;

  const grossPay = useMemo(() => {
    return proratedSalary + otAmount;
  }, [proratedSalary, otAmount]);

  // Validation Logic
  const isAttendanceInvalid = useMemo(() => {
    const pDays = parseFloat(paidDays || "0");
    const lDays = parseFloat(lwpDays || "0");
    return (pDays + lDays) !== periodDays;
  }, [paidDays, lwpDays, periodDays]);

  const handlePaidDaysChange = (val: string) => {
    if (val === "") {
      setPaidDays("");
      setLwpDays(periodDays.toString());
      return;
    }
    
    let numPaid = parseFloat(val);
    if (isNaN(numPaid) || numPaid < 0) return;

    // Boundary check: Paid Days cannot exceed Period Days
    if (numPaid > periodDays) {
      numPaid = periodDays;
    }

    const calculatedLwp = periodDays - numPaid;
    
    setPaidDays(numPaid.toString());
    setLwpDays(calculatedLwp.toString());
  };

  const handleLwpDaysChange = (val: string) => {
      // Logic removed as field is now read-only and auto-calculated
  };

  const handleOtHoursChange = (val: string) => {
    if (val === "") { setOtHours(""); return; }
    if (parseFloat(val) < 0) return;
    if (val.replace(".", "").length > 3) return;
    setOtHours(val);
  };

  const fixedDeductions = useMemo(() => {
    return (salaryAssignment?.deductions || []).reduce((sum: number, c: any) => sum + (c.monthly_amount || 0), 0);
  }, [salaryAssignment]);

  const totalDeductions = useMemo(() => {
    return lwpAmount + fixedDeductions;
  }, [lwpAmount, fixedDeductions]);

  const netSalary = useMemo(() => {
    // Net Pay = Monthly CTC + Overtime - Total Deductions (Fixed + LWP)
    return (payrollData?.monthly_ctc || 0) + otAmount - totalDeductions;
  }, [payrollData?.monthly_ctc, otAmount, totalDeductions]);

  const deductionsBreakdown = useMemo(() => {
    const otherDeductions = (salaryAssignment?.deductions || []).map((c: any) => (c.monthly_amount || 0).toFixed(2));
    if (otherDeductions.length > 0) {
      return `(${lwpAmount.toFixed(2)} + ${otherDeductions.join(" + ")})`;
    }
    return `(${lwpAmount.toFixed(2)})`;
  }, [lwpAmount, salaryAssignment]);

  const handleSave = async (status: string) => {
    if (updateMutation.isPending) return;
    try {
      // Dynamically resolve status ID from entity_values using value_code as requested.
      // DRAFT UI maps to DRAFT value_code, LOCKED UI maps to LOCKED value_code.
      const targetCode = status === "Locked" ? "LOCKED" : "DRAFT";
      const statusRecord = entityValues.find((v: any) => 
        (v.value_code || v.code || "").toUpperCase() === targetCode
      );

      if (!statusRecord) {
        console.warn(`Payroll status code '${targetCode}' not found in entity_values. Using safety fallback.`);
      }

      const statusId = statusRecord?.id || (status === "Locked" ? 154 : 153);

      const pDays = parseFloat(paidDays || "0") || 0;
      const lDays = parseFloat(lwpDays || "0") || 0;
      const oHours = parseFloat(otHours || "0") || 0;

      await updateMutation.mutateAsync({
        employeeId: parseInt(employeeId),
        payrollPeriodId: parseInt(payPeriodId),
        data: {
          paid_days: pDays,
          lwp_days: lDays,
          ot_hours: oHours,
          prorated_salary: proratedSalary,
          gross_pay: grossPay,
          total_deductions: totalDeductions,
          net_pay: netSalary,
          payroll_status_id: statusId
        }
      });

      toast({
        title: "Success",
        description: `Payroll ${status === "Locked" ? "finalized" : "saved as draft"} successfully`,
        variant: "success",
      });

      setRefreshTrigger(prev => prev + 1);
      setLocation("/hrms/payroll-management/run-payroll");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save payroll detail",
        variant: "destructive",
      });
    }
  };

  if (isDetailLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading payroll details...</p>
      </div>
    );
  }

  if (!payrollData) {
    return <div className="py-20 text-center text-red-500 font-medium">Payroll data not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between border-b border-gray-100 pb-3 -mx-6 px-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111827]">Run Payroll</h1>
          <p className="text-[11px] font-semibold text-[#6b7280] mt-0.5 tracking-normal">
            {employee?.name} - {payPeriod?.period}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={updateMutation.isPending}
          onClick={() => setLocation("/hrms/payroll-management/run-payroll")}
          className="h-7 text-[10px] font-bold border-gray-200 text-[#111827] hover:bg-gray-50 bg-white shadow-sm flex items-center gap-1.5 px-2.5 rounded-md mr-10"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />
          Back to List
        </Button>
      </div>

      {/* Employee & Period Summary Section */}
      <Card className="shadow-none border border-gray-100 overflow-hidden">
        <CardHeader className="py-2.5 bg-white border-b border-gray-50">
          <CardTitle className="text-[14px] font-semibold text-[#111827]">Employee & Period Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-4 px-6">
          <div className="grid grid-cols-4 gap-y-5 gap-x-10">
            <div>
              <Label className="text-[11px] text-[#6b7280] font-medium tracking-tight mb-1 block">Employee Name</Label>
              <div className="text-[13px] font-bold text-[#111827]">{employee?.name}</div>
            </div>
            <div>
              <Label className="text-[11px] text-[#6b7280] font-medium tracking-tight mb-1 block">Employee Code</Label>
              <div className="text-[13px] font-bold text-[#111827]">{employee?.employee_code}</div>
            </div>
            <div>
              <Label className="text-[11px] text-[#6b7280] font-medium tracking-tight mb-1 block">Pay Period</Label>
              <div className="text-[13px] font-bold text-[#111827]">{payPeriod?.period}</div>
            </div>
            <div>
              <Label className="text-[11px] text-[#6b7280] font-medium tracking-tight mb-1 block">Department / Plant</Label>
              <div className="text-[13px] font-bold text-[#111827]">{employee?.department}</div>
            </div>
            <div>
              <Label className="text-[11px] text-[#6b7280] font-medium tracking-tight mb-1 block">Salary Structure Name</Label>
              <div className="text-[13px] font-bold text-[#111827]">{salaryAssignment?.structure_name}</div>
            </div>
            <div>
              <Label className="text-[11px] text-[#6b7280] font-medium tracking-tight mb-1 block">Monthly Gross / CTC</Label>
              <div className="text-[13px] font-bold text-[#111827]">{CURRENCY_SYMBOL}{payrollData?.monthly_ctc?.toFixed(2)}</div>
            </div>
            <div>
              <Label className="text-[11px] text-[#6b7280] font-medium tracking-tight mb-1 block">Period Days</Label>
              <div className="text-[13px] font-bold text-[#111827]">{periodDays} days</div>
            </div>
            <div>
              <Label className="text-[11px] text-[#6b7280] font-medium tracking-tight mb-1 block">Status</Label>
              <div>{getStatusBadge(currentStatus)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Salary Structure Section */}
      <Card className="shadow-none border border-gray-100">
        <CardHeader className="py-2.5 bg-white border-b border-gray-50">
          <CardTitle className="text-[14px] font-semibold text-[#111827]">Monthly Salary Structure</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {/* Earnings Table */}
            <div className="px-6 py-2.5 text-[13px] font-bold text-[#111827] tracking-tight bg-gray-50/10">Earnings</div>
            <Table className="border-collapse">
              <TableHeader className="bg-white border-b border-gray-100">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="h-8 px-6 text-[11px] font-medium text-[#6b7280] w-[45%]">Component Name</TableHead>
                  <TableHead className="h-8 text-[11px] font-medium text-center text-[#6b7280] w-[25%]">Rule Type</TableHead>
                  <TableHead className="h-8 px-6 text-[11px] font-medium text-right text-[#6b7280] w-[30%]">Monthly Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryAssignment?.earnings?.map((comp: any, idx: number) => (
                  <TableRow
                    key={`${comp.component_name}-${idx}`}
                    className="h-8 hover:bg-gray-50/30 border-b border-[#e5e7eb]"
                  >
                    <TableCell className="py-1 px-6 text-[12px] font-semibold text-[#111827] w-[45%]">{comp.component_name}</TableCell>
                    <TableCell className="py-1 text-center w-[25%]">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold text-[#2563eb] bg-[#e6f0ff] rounded-md hover:bg-[#e6f0ff] border-none">
                        {comp.rule_type || "Fixed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1 px-6 text-right text-[12px] font-bold text-[#111827] w-[30%]">{CURRENCY_SYMBOL}{comp.monthly_amount?.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-[#e6edf5] font-bold border-t border-gray-200 h-9">
                  <TableCell className="py-1.5 px-6 text-[12px] text-[#111827] w-[45%]">Total Monthly Gross</TableCell>
                  <TableCell className="w-[25%]" />
                  <TableCell className="py-1.5 px-6 text-right text-[13px] text-[#111827] font-bold w-[30%]">{CURRENCY_SYMBOL}{payrollData?.total_monthly_gross?.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {/* Deductions Table */}
            <div className="px-6 py-2.5 text-[13px] font-bold text-[#111827] tracking-tight border-t border-gray-100 bg-gray-50/10">Deductions</div>
            <Table className="border-collapse">
              <TableHeader className="bg-white border-b border-gray-100">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="h-8 px-6 text-[11px] font-medium text-[#6b7280] w-[45%]">Component Name</TableHead>
                  <TableHead className="h-8 text-[11px] font-medium text-center text-[#6b7280] w-[25%]">Rule Type</TableHead>
                  <TableHead className="h-8 px-6 text-[11px] font-medium text-right text-[#6b7280] w-[30%]">Monthly Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryAssignment?.deductions?.map((comp: any, idx: number) => (
                  <TableRow
                    key={`${comp.component_name}-${idx}`}
                    className="h-8 hover:bg-gray-50/30 border-b border-[#e5e7eb]"
                  >
                    <TableCell className="py-1 px-6 text-[12px] font-semibold text-[#111827] w-[45%]">{comp.component_name}</TableCell>
                    <TableCell className="py-1 text-center w-[25%]">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold text-[#dc2626] bg-[#fde8e8] rounded-md hover:bg-[#fde8e8] border-none">
                        {comp.rule_type || "Fixed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1 px-6 text-right text-[12px] font-bold text-[#111827] w-[30%]">{CURRENCY_SYMBOL}{comp.monthly_amount?.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-[#f6e6e6] font-bold border-t border-gray-200 h-9">
                  <TableCell className="py-1.5 px-6 text-[12px] text-[#111827] w-[45%]">Total Monthly Deductions</TableCell>
                  <TableCell className="w-[25%]" />
                  <TableCell className="py-1.5 px-6 text-right text-[13px] text-[#111827] font-bold w-[30%]">{CURRENCY_SYMBOL}{payrollData?.total_monthly_deductions?.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Attendance & OT Section */}
      <Card className="shadow-none border border-gray-100">
        <CardHeader className="py-2.5 bg-white border-b border-gray-50">
          <CardTitle className="text-[14px] font-semibold text-[#111827]">Attendance & OT</CardTitle>
        </CardHeader>
        <CardContent className="p-4 px-6 pt-6">
          <div className="grid grid-cols-3 gap-10">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-[#6b7280] font-medium tracking-tight">
                Paid Days <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                type="number"
                value={paidDays}
                onChange={(e) => handlePaidDaysChange(e.target.value)}
                className={cn(
                  "h-9 text-[13px] font-semibold border-[#e5e7eb] bg-gray-50/10 focus:bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all rounded-md px-3 text-gray-700",
                  isAttendanceInvalid && "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                )}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-[#6b7280] font-medium tracking-tight">
                LWP Days <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                type="number"
                value={lwpDays}
                readOnly
                className={cn(
                  "h-9 text-[13px] font-semibold border-[#e5e7eb] bg-muted/30 transition-all rounded-md px-3 text-gray-500 cursor-not-allowed",
                  isAttendanceInvalid && "border-red-500"
                )}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-[#6b7280] font-medium tracking-tight">OT Hours</Label>
              <Input
                type="number"
                value={otHours}
                onChange={(e) => handleOtHoursChange(e.target.value)}
                className="h-9 text-[13px] font-semibold border-[#e5e7eb] bg-gray-50/10 focus:bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all rounded-md px-3 text-gray-700"
                placeholder="0"
              />
              <p className="text-[10px] text-[#6b7280] mt-1 opacity-70">Rate: {CURRENCY_SYMBOL}{OT_RATE_PER_HOUR}/hour</p>
            </div>
          </div>
          {isAttendanceInvalid && (
            <p className={cn(
              "text-[11px] mt-4 font-semibold px-1 flex items-center gap-1.5",
              (parseFloat(paidDays || "0") + parseFloat(lwpDays || "0")) > periodDays ? "text-red-500" : "text-amber-600"
            )}>
              <AlertCircle className="w-3.5 h-3.5" />
              {(parseFloat(paidDays || "0") + parseFloat(lwpDays || "0")) > periodDays 
                ? `Total of Paid Days and LWP Days cannot exceed Period Days (${periodDays} Days)`
                : `Total accounted days (${parseFloat(paidDays || "0") + parseFloat(lwpDays || "0")}) are less than period days (${periodDays}). Please account for all days.`
              }
            </p>
          )}
        </CardContent>
      </Card>

      {/* Calculation Summary Section */}
      <Card className="shadow-none border border-gray-100">
        <CardHeader className="py-2.5 bg-white border-b border-gray-50">
          <CardTitle className="text-[14px] font-semibold text-[#111827]">Calculation Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            <div className="flex justify-between items-center px-6 py-2.5">
              <div>
                <Label className="text-[13px] font-semibold text-[#111827]">Prorated Salary</Label>
                <p className="text-[10px] text-[#6b7280]">Monthly Salary x ({paidDays} Paid Days / {periodDays} Period Days)</p>
              </div>
              <div className="text-[14px] font-bold text-[#111827] text-right">
                <div>{CURRENCY_SYMBOL}{proratedSalary?.toFixed(2)}</div>
                <p className="text-[11px] text-[#6b7280] font-normal">({proratedSalary.toFixed(2)})</p>
              </div>
            </div>
            <div className="flex justify-between items-center px-6 py-2.5">
              <div>
                <Label className="text-[13px] font-semibold text-[#111827]">Gross Pay</Label>
                <p className="text-[10px] text-[#6b7280]">Prorated Salary + OT</p>
              </div>
              <div className="text-[14px] font-bold text-[#111827] text-right">
                <div>{CURRENCY_SYMBOL}{grossPay?.toFixed(2)}</div>
                <p className="text-[11px] text-[#6b7280] font-normal">({proratedSalary.toFixed(2)} + {otAmount.toFixed(2)})</p>
              </div>
            </div>
            <div className="flex justify-between items-center px-6 py-2.5">
              <div>
                <Label className="text-[13px] font-semibold text-[#111827]">Salary Structure Deductions (Total)</Label>
                <p className="text-[10px] text-[#6b7280]">Total Monthly Deductions + LWP</p>
              </div>
              <div className="text-[14px] font-bold text-red-600 text-right">
                <div>-{CURRENCY_SYMBOL}{totalDeductions?.toFixed(2)}</div>
                <p className="text-[11px] text-[#6b7280] font-normal">{deductionsBreakdown}</p>
              </div>
            </div>
            <div className={cn(
              "flex justify-between items-center px-6 py-3 rounded-b-[6px]",
              netSalary < 0 ? "bg-red-50" : "bg-[#eaf7ef]"
            )}>
              <div>
                <Label className={cn(
                  "text-[14px] font-bold",
                  netSalary < 0 ? "text-red-700" : "text-green-700"
                )}>Net Pay</Label>
                <p className={cn(
                  "text-[10px] font-medium",
                  netSalary < 0 ? "text-red-600/70" : "text-green-600/70"
                )}>(Monthly Gross / CTC + OT) - Total Deductions</p>
              </div>
              <div className={cn(
                "text-[18px] font-black",
                netSalary < 0 ? "text-red-700" : "text-green-700"
              )}>
                {CURRENCY_SYMBOL}{netSalary?.toFixed(2)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer Controls */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100 mt-6 pb-2">
        <div className="flex items-center gap-2 mr-2">
          <span className="text-[11px] font-medium text-gray-500">Status:</span>
          <Select value={currentStatus} onValueChange={setCurrentStatus} disabled={updateMutation.isPending}>
            <SelectTrigger className="h-8 w-[100px] text-[11px] font-semibold border-gray-200 bg-white ring-offset-0 focus:ring-1 focus:ring-blue-500 shadow-none">
              <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent className="border-gray-100 shadow-xl min-w-[120px]">
              {/* Dynamic styling: Using enterprise theme accent color (#FFB800) for check background 
                  to maintain consistency with the main list's filter dropdowns. */}
              <SelectItem value="Draft" className="text-[11px] font-bold py-1.5 data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground focus:bg-accent focus:text-accent-foreground">Draft</SelectItem>
              <SelectItem value="Locked" className="text-[11px] font-bold py-1.5 data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground focus:bg-accent focus:text-accent-foreground">Locked</SelectItem>
            </SelectContent>
          </Select>
        </div>



        <Button
          onClick={() => handleSave(currentStatus)}
          loading={updateMutation.isPending}
          className="h-8 px-8 bg-[#2266dd] hover:bg-[#1155cc] disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold text-[12px] rounded-md shadow-sm transition-all active:scale-95"
          disabled={updateMutation.isPending || !employee || isAttendanceInvalid || netSalary < 0}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
