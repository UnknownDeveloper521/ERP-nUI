/**
 * ============================================================================
 * RUN PAYROLL TAB - PAYROLL PROCESSING
 * ============================================================================
 * 
 * This component is rendered inside the "Run Payroll" tab of Payroll Management.
 * It handles the employee list and employee payroll form.
 * 
 * ROUTES (nested under /hrms/payroll-management/run-payroll):
 * - /hrms/payroll-management/run-payroll → Employee List
 * - /hrms/payroll-management/run-payroll/:employeeId → Employee Form
 * 
 * ============================================================================
 */

import React, { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandInputBorderless } from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ArrowLeft, AlertCircle, Calculator, ChevronLeft, ChevronRight, ChevronsUpDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { differenceInDays, parse, format, isValid } from "date-fns";
import { PayPeriod, mockPayPeriods, PayrollRun, MOCK_PAYROLL_RUNS, PayrollStatus, MOCK_EMPLOYEES, Employee } from "@/lib/payrollSharedData";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { getPayrollSalaryAssignment, type PayrollSalaryAssignment } from "@/lib/salaryAssignmentSharedData";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Shared types are imported from @/lib/payrollSharedData

// Shared types are imported from @/lib/payrollSharedData

/**
 * Salary Component structure (for structure preview)
 */
interface SalaryComponent {
  code: string;
  name: string;
  ruleType: string; // "Fixed" or "% of CTC" or "% of Basic"
  monthlyAmount: number;
}

/**
 * Salary Assignment with structure details (using shared data)
 */
interface SalaryAssignment {
  employeeId: string;
  structureName: string;
  monthlyCTC: number;
  earnings: SalaryComponent[]; // Earnings components from structure
  deductions: SalaryComponent[]; // Deduction components from structure
}

// Shared types are imported from @/lib/payrollSharedData

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * OT (Overtime) Rate per hour - Fixed constant for MVP
 */
const OT_RATE_PER_HOUR = 100;

// ============================================================================
// MOCK DATA
// ============================================================================
// ⚠️ SAFE GUARD: Added mock data to prevent runtime crashes
// This ensures Run Payroll page never crashes when empty
// ============================================================================

// Shared mock data is imported from @/lib/payrollSharedData

// Shared mock data is imported from @/lib/payrollSharedData

/**
 * Mock Salary Assignments - Now using shared data store
 * @deprecated Use getSalaryAssignmentByEmployeeId from salaryAssignmentSharedData instead
 */
// const MOCK_SALARY_ASSIGNMENTS: SalaryAssignment[] = [
//   ... (moved to shared data store)
// ];

// Shared mock data is imported from @/lib/payrollSharedData

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get payroll run for specific employee and pay period
 */
const getPayrollRun = (employeeId: string, payPeriodId: string): PayrollRun | undefined => {
  // ⚠️ SAFE GUARD: Return mock data instead of undefined
  return MOCK_PAYROLL_RUNS.find(
    run => run.employeeId === employeeId && run.payPeriodId === payPeriodId
  );
};

/**
 * Calculate number of days in a pay period (inclusive)
 * Accepts DD-MM-YYYY format
 */
const calculatePeriodDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (!isValid(start) || !isValid(end)) return 0;
  return differenceInDays(end, start) + 1;
};

/**
 * Get salary assignment for an employee
 */
const getSalaryAssignment = (employeeId: string): SalaryAssignment | undefined => {
  // Get assignment from shared data store
  const payrollAssignment = getPayrollSalaryAssignment(employeeId);
  
  if (!payrollAssignment) {
    return undefined;
  }
  
  // Already in the correct format for RunPayroll
  return payrollAssignment;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Main Run Payroll Component
 * Handles routing between Employee List and Employee Form
 */


export default function RunPayroll() {
  const [, setLocation] = useLocation();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [matchList] = useRoute("/hrms/payroll-management/run-payroll");
  const [matchForm, params] = useRoute("/hrms/payroll-management/run-payroll/:employeeId");

  // Determine which screen to show based on route
  if (matchForm && params?.employeeId) {
    return <EmployeePayrollForm employeeId={params.employeeId} refreshTrigger={refreshTrigger} setRefreshTrigger={setRefreshTrigger} />;
  }

  return <EmployeeListScreen refreshTrigger={refreshTrigger} />;
}

// ============================================================================
// SCREEN A: EMPLOYEE LIST
// ============================================================================

/**
 * Employee List Screen
 * Shows all employees for a selected pay period
 */
function EmployeeListScreen({ refreshTrigger }: { refreshTrigger: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // ============================================================================
  // PERSISTENT PAY PERIOD SELECTION
  // ============================================================================
  // PURPOSE: Remembers selected pay period across page navigations
  // WHY NEEDED: When user goes to employee form and comes back, period stays selected
  // HOW IT WORKS: Loads from localStorage on mount, saves on change
  // KEEP: Essential for good UX - prevents re-selecting period every time
  // ============================================================================
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  // ============================================================================
  // AUTO-SELECT PAY PERIOD WHEN ONLY ONE OPTION AVAILABLE
  // ============================================================================
  // PURPOSE: Auto-select the pay period when there's only one option
  // WHY NEEDED: Better UX when only one period is available (like Mar-2026 only)
  // HOW IT WORKS: Checks if mockPayPeriods has only one item and auto-selects it
  // ============================================================================
  useEffect(() => {
    if (mockPayPeriods.length === 1 && !selectedPeriodId) {
      setSelectedPeriodId(mockPayPeriods[0].id);
    }
  }, [selectedPeriodId]);

  // ============================================================================
  // FILTER AND SEARCH STATE
  // ============================================================================
  // PURPOSE: Allows HR to filter/search employees in the list
  // WHY NEEDED: Large companies have many employees - need filtering
  // KEEP: Essential for usability with large employee lists
  // ============================================================================
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");

  // ============================================================================
  // PAGINATION STATE
  // ============================================================================
  // PURPOSE: Shows employees in pages (10 per page) instead of all at once
  // WHY NEEDED: Performance - prevents rendering 100+ employees at once
  // KEEP: Essential for performance with large employee lists
  // ============================================================================
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const departments = useMemo(() => {
    // Only include departments from employees with salary assignments
    const employeesWithAssignments = MOCK_EMPLOYEES.filter(emp => {
      const assignment = getSalaryAssignment(emp.id);
      return !!assignment;
    });
    const uniqueDepts = new Set(employeesWithAssignments.map(emp => emp.department));
    return ["All", ...Array.from(uniqueDepts)];
  }, [refreshTrigger]);

  // Get selected pay period
  // ⚠️ SAFE GUARD: Using mock data to find selected period
  const selectedPeriod = useMemo(() => {
    return mockPayPeriods.find(p => p.id === selectedPeriodId);
  }, [selectedPeriodId]);

  // Calculate period days
  const periodDays = useMemo(() => {
    if (!selectedPeriod) return 0;
    return calculatePeriodDays(selectedPeriod.startDate, selectedPeriod.endDate);
  }, [selectedPeriod]);

  // Get employee data with payroll status
  // Only include employees with active salary assignments
  const employeeData = useMemo(() => {
    if (!selectedPeriodId) return [];

    return MOCK_EMPLOYEES
      .map(emp => {
        const assignment = getSalaryAssignment(emp.id);
        const payrollRun = getPayrollRun(emp.id, selectedPeriodId);

        // Only include employees with valid salary assignments
        if (!assignment) {
          return null;
        }

        let status: PayrollStatus = "Pending";
        if (payrollRun) {
          status = payrollRun.status;
        }

        return {
          ...emp,
          hasAssignment: true,
          structureName: assignment.structureName,
          status
        };
      })
      .filter(emp => emp !== null); // Remove employees without assignments
  }, [selectedPeriodId, refreshTrigger]);

  // Filter and sort employees
  const filteredEmployees = useMemo(() => {
    let filtered = employeeData;

    if (deptFilter !== "All") {
      filtered = filtered.filter(e => e.department === deptFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.code.toLowerCase().includes(query) ||
        e.name.toLowerCase().includes(query)
      );
    }

    // ✅ UPDATED: Sort by status priority: Warning → Pending → Draft → Locked
    const statusPriority: Record<PayrollStatus, number> = {
      Warning: 1,
      Pending: 2,
      Draft: 3,
      Calculated: 4,
      Locked: 5,
    };

    filtered.sort((a, b) => {
      const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [employeeData, deptFilter, searchQuery]);

  // Paginate
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredEmployees.slice(start, end);
  }, [filteredEmployees, currentPage]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  // Handlers
  const handleOpenEmployee = (employeeId: string) => {
    if (!selectedPeriodId) {
      toast({
        title: "Error",
        description: "Please select a pay period first",
        variant: "destructive",
      });
      return;
    }
    // Fixed: Ensure the route navigation correctly routes inside the run-payroll tab space
    setLocation(`/hrms/payroll-management/run-payroll/${employeeId}?periodId=${selectedPeriodId}`);
  };

  const getStatusBadge = (status: PayrollStatus) => {
    // ✅ UPDATED: Added Draft status styling
    const styles: Record<PayrollStatus, string> = {
      Warning: "bg-red-100 text-red-700 border-red-200",
      Pending: "bg-gray-100 text-gray-700 border-gray-200",
      Draft: "bg-blue-100 text-blue-700 border-blue-200",
      Calculated: "bg-indigo-100 text-indigo-700 border-indigo-200",
      Locked: "bg-green-100 text-green-700 border-green-200",
    };

    return (
      <Badge variant="outline" className={styles[status]}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
      </div>

      {/* Top Bar Controls */}
      <AppListToolbar
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search by code or name..."
        }}
        filters={[
          {
            type: 'select',
            label: 'Pay Period',
            value: selectedPeriod?.periodName ?? "",
            options: mockPayPeriods.map(p => p.periodName),
            onChange: (periodName) => {
              const period = mockPayPeriods.find(p => p.periodName === periodName);
              if (period) {
                setSelectedPeriodId(period.id);
              }
            },
            searchable: true
          },
          {
            type: 'select',
            label: 'Department',
            value: deptFilter,
            options: departments,
            onChange: setDeptFilter,
            searchable: true
          }
        ]}
      />

      {/* Employee Table or Empty State Box */}
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
                    <TableHead>Department / Plant</TableHead>
                    <TableHead>Salary Structure</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No employees found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedEmployees.map(emp => (
                      <TableRow key={emp.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">{emp.code}</TableCell>
                        <TableCell>{emp.name}</TableCell>
                        <TableCell>{emp.department}</TableCell>
                        <TableCell>
                          {emp.hasAssignment ? emp.structureName : (
                            <span className="text-red-500 text-sm">Not Assigned</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(emp.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEmployee(emp.id)}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination inside CardContent */}
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredEmployees.length}
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
// SCREEN B: EMPLOYEE PAYROLL FORM (UPDATED VERSION)
// ============================================================================

/**
 * Employee Payroll Form Component
 * 
 * PAGE STRUCTURE (Top to Bottom):
 * 1) Employee & Period Summary (Read-only)
 * 2) Salary Structure Preview (Read-only) - NEW
 * 3) Manual Entry Section (Simplified - only Paid Days, LWP Days, OT Hours)
 * 4) Action Buttons
 * 5) Calculation Preview (Modern cards)
 * 6) Lock Behavior
 */
function EmployeePayrollForm({
  employeeId,
  refreshTrigger,
  setRefreshTrigger
}: {
  employeeId: string;
  refreshTrigger: number;
  setRefreshTrigger: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Get pay period ID from URL query params
  const searchParams = new URLSearchParams(window.location.search);
  const payPeriodId = searchParams.get("periodId") || "";

  // ============================================================================
  // MANUAL ENTRY FIELDS STATE
  // ============================================================================
  // PURPOSE: Stores user input for payroll calculation
  // WHY STRING TYPE: Input fields return strings, converted to numbers during calculation
  // KEEP: Essential for payroll data entry
  // ============================================================================
  const [paidDays, setPaidDays] = useState<string>("");
  const [lwpDays, setLwpDays] = useState<string>("");
  const [otHours, setOtHours] = useState<string>("0");

  // ============================================================================
  // PAYROLL STATUS STATE
  // ============================================================================
  // PURPOSE: Tracks payroll status (Pending → Draft → Locked)
  // WHY NEEDED: Controls workflow - Locked payslips become available to employees
  // KEEP: Essential for payroll workflow and payslip visibility
  // ============================================================================
  const [currentStatus, setCurrentStatus] = useState<PayrollStatus>("Pending");

  // ============================================================================
  // FORM VALIDATION AND CHANGE TRACKING
  // ============================================================================
  // PURPOSE: 
  // - formErrors: Shows validation errors to user
  // - inputsChanged: Warns user to recalculate after editing
  // - refreshTrigger: Forces re-fetch of payroll data after save
  // KEEP: Essential for data integrity and user feedback
  // ============================================================================
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [inputsChanged, setInputsChanged] = useState(false);

  // ============================================================================
  // DERIVED DATA - COMPUTED FROM PROPS/STATE
  // ============================================================================
  // PURPOSE: These are NOT stored in state - they're calculated on every render
  // WHY USEMEMO: Prevents expensive recalculations unless dependencies change
  // KEEP: Essential for performance optimization
  // ============================================================================

  // Find employee data
  // ⚠️ SAFE GUARD: Using mock data to find employee
  const employee = useMemo(() => {
    return MOCK_EMPLOYEES.find(emp => emp.id === employeeId);
  }, [employeeId]);

  // Find pay period data
  // ⚠️ SAFE GUARD: Using mock data to find pay period
  const payPeriod = useMemo(() => {
    return mockPayPeriods.find(period => period.id === payPeriodId);
  }, [payPeriodId]);

  // Find employee's salary assignment (structure + amounts)
  const salaryAssignment = useMemo(() => {
    return getSalaryAssignment(employeeId);
  }, [employeeId]);

  // Calculate number of days in the pay period
  const periodDays = useMemo(() => {
    if (!payPeriod) return 0;
    return calculatePeriodDays(payPeriod.startDate, payPeriod.endDate);
  }, [payPeriod]);

  // ============================================================================
  // LOAD EXISTING PAYROLL RUN
  // ============================================================================
  // PURPOSE: Fetches previously saved payroll data for this employee+period
  // WHY REFRESHTRIGGER: Dependency forces reload after Calculate/Save operations
  // KEEP: Essential for loading and displaying saved payroll data
  // ============================================================================
  const existingRun = useMemo(() => {
    return getPayrollRun(employeeId, payPeriodId);
  }, [employeeId, payPeriodId, refreshTrigger]);

  // ============================================================================
  // EDIT LOCK STATUS
  // ============================================================================
  // PURPOSE: Determines if form fields should be disabled
  // CURRENT: Always false (always editable) - HR can edit even locked payroll
  // WHY: Business requirement - HR needs ability to fix errors even after locking
  // KEEP: Essential for business workflow flexibility
  // ============================================================================
  const isLocked = false; // Always allow editing

  // Check if employee has no salary assignment (warning state)
  const hasMissingAssignment = !salaryAssignment;

  // ============================================================================
  // LOAD EXISTING PAYROLL DATA INTO FORM
  // ============================================================================
  // PURPOSE: When opening an employee's payroll, populate form with saved data
  // WHY NEEDED: Allows editing previously calculated payroll
  // KEEP: Essential for edit functionality
  // ============================================================================
  useEffect(() => {
    if (existingRun) {
      setPaidDays(existingRun.paidDays.toString());
      setLwpDays(existingRun.lwpDays.toString());
      setOtHours(existingRun.otHours.toString());
      setCurrentStatus(existingRun.status);
    } else {
      // No existing data - default to Pending status
      setCurrentStatus("Pending");
    }
  }, [existingRun]);

  // ========== VALIDATION ==========

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const paid = parseFloat(paidDays);
    const lwp = parseFloat(lwpDays);
    const ot = parseFloat(otHours);

    // Required fields
    if (!paidDays || isNaN(paid)) {
      errors.paidDays = "Paid Days is required";
    } else if (paid < 0) {
      errors.paidDays = "Paid Days must be ≥ 0";
    }

    if (!lwpDays || isNaN(lwp)) {
      errors.lwpDays = "LWP Days is required";
    } else if (lwp < 0) {
      errors.lwpDays = "LWP Days must be ≥ 0";
    }

    if (isNaN(ot) || ot < 0) {
      errors.otHours = "OT Hours must be ≥ 0";
    }

    // Paid Days + LWP Days <= Period Days
    if (!isNaN(paid) && !isNaN(lwp) && (paid + lwp) > periodDays) {
      errors.paidDays = `Paid Days + LWP Days cannot exceed ${periodDays}`;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ========== CALCULATION LOGIC (PAID DAYS PRORATION - SINGLE SOURCE OF TRUTH) ==========

  /**
   * ✅ CALCULATION FORMULA (SINGLE SOURCE OF TRUTH):
   * 
   * METHOD: Use Paid Days proration ONLY. DO NOT deduct LWP separately as money.
   * LWP Days is for validation & information only.
   * 
   * Inputs:
   * - monthlyGross = Total Monthly Gross (from structure)
   * - periodDays = Days in pay period
   * - paidDays = Manual Entry (used for proration)
   * - lwpDays = Manual Entry (validation only - NOT deducted as money)
   * - otHours = Overtime hours
   * - OT_RATE = USh100/hour
   * - structureDeductionTotal = Sum of PF + ESI + PT (monthly)
   * 
   * Formulas:
   * 1. factor = paidDays / periodDays (salary proration)
   * 2. proratedSalary = monthlyGross × factor
   * 3. otAmount = otHours × OT_RATE
   * 4. grossPay = proratedSalary + otAmount
   * 5. netPay = grossPay - structureDeductionTotal
   * 
   * Rounding: Round to nearest rupee using Math.round
   */
  const handleCalculate = () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before calculating",
        variant: "destructive",
      });
      return;
    }

    if (!salaryAssignment) {
      toast({
        title: "Error",
        description: "Salary assignment missing",
        variant: "destructive",
      });
      return;
    }

    // ============================================================================
    // PARSE INPUT VALUES
    // ============================================================================
    const paid = parseFloat(paidDays);
    const lwp = parseFloat(lwpDays);
    const ot = parseFloat(otHours);

    // ============================================================================
    // CALCULATE STRUCTURE DEDUCTION TOTAL
    // Sum of all monthly deduction amounts from salary structure
    // ⚠️ SAFE GUARD: Using optional chaining and nullish coalescing to prevent crashes
    // ============================================================================
    const structureDeductionTotal = (salaryAssignment?.deductions ?? []).reduce(
      (sum, deduction) => sum + (deduction?.monthlyAmount ?? 0),
      0
    );

    // ============================================================================
    // STEP 1: Monthly Gross (from structure)
    // ============================================================================
    const monthlyGross = salaryAssignment.monthlyCTC;
    console.log('💰 Monthly Gross:', monthlyGross);

    // ============================================================================
    // STEP 2: Proration Factor
    // Formula: paidDays / periodDays
    // ============================================================================
    const factor = paid / periodDays;
    console.log('📊 Proration Factor:', factor, `(${paid} / ${periodDays})`);

    // ============================================================================
    // STEP 3: Prorated Salary
    // Formula: monthlyGross × factor
    // ============================================================================
    const proratedSalary = Math.round(monthlyGross * factor);
    console.log('💵 Prorated Salary:', proratedSalary);
    console.log('   Formula: monthlyGross × factor =', monthlyGross, '×', factor);

    // ============================================================================
    // STEP 4: OT Amount
    // Formula: otHours × OT_RATE
    // ============================================================================
    const otAmount = Math.round(ot * OT_RATE_PER_HOUR);
    console.log('⏰ OT Amount:', otAmount);

    // ============================================================================
    // STEP 5: Gross Pay
    // Formula: proratedSalary + otAmount
    // ============================================================================
    const grossPay = proratedSalary + otAmount;
    console.log('💰 Gross Pay:', grossPay);

    // ============================================================================
    // STEP 6: Net Pay
    // Formula: grossPay - structureDeductionTotal
    // ⚠️ IMPORTANT: LWP is NOT deducted here - already in proration!
    // ============================================================================
    const netPay = grossPay - structureDeductionTotal;
    console.log('✅ Net Pay:', netPay);
    console.log('   Structure Deductions:', structureDeductionTotal);
    console.log('   ⚠️ LWP Days:', lwp, '(info only - already in proration)');

    console.log('📊 Final Summary:');
    console.log('   Monthly Gross: USh', monthlyGross.toLocaleString());
    console.log('   Prorated Salary: USh', proratedSalary.toLocaleString());
    console.log('   OT Amount: USh', otAmount.toLocaleString());
    console.log('   Gross Pay: USh', grossPay.toLocaleString());
    console.log('   Structure Deductions: -USh', structureDeductionTotal.toLocaleString());
    console.log('   Net Pay: USh', netPay.toLocaleString());

    // ============================================================================
    // CREATE/UPDATE PAYROLL RUN RECORD
    // ⚠️ SAFE GUARD: Using mock data array instead of localStorage functions
    // ============================================================================
    const existingIndex = MOCK_PAYROLL_RUNS.findIndex(r => r.employeeId === employeeId && r.payPeriodId === payPeriodId);

    // ✅ CHANGED: Store proration-based calculation values and components
    const payrollRun: PayrollRun = {
      id: existingIndex >= 0 ? MOCK_PAYROLL_RUNS[existingIndex].id : `PR-${Date.now()}`,
      employeeId,
      payPeriodId,
      paidDays: paid,
      lwpDays: lwp, // Stored for info only
      otHours: ot,
      perDaySalary: Math.round(monthlyGross / periodDays), // For reference
      proratedSalary, // ✅ CHANGED: Now stores prorated salary
      otAmount,
      lwpDeduction: 0, // ✅ CHANGED: Set to 0 (not deducted separately)
      grossPay,
      totalDeductions: structureDeductionTotal,
      netPay,
      status: currentStatus, // ✅ CHANGED: Use current status from dropdown
      warningMessages: [],
      calculatedAt: format(new Date(), 'yyyy-MM-dd'),
      // ✅ ADDED: Capture individual components for Payslip
      earnings: [
        ...(salaryAssignment?.earnings ?? []).map(e => ({
          name: e.name,
          amount: Math.round(e.monthlyAmount * factor)
        })),
        ...(otAmount > 0 ? [{ name: "Overtime", amount: otAmount }] : [])
      ],
      deductions: (salaryAssignment?.deductions ?? []).map(d => ({
        name: d.name,
        amount: d.monthlyAmount
      }))
    };

    if (existingIndex >= 0) {
      MOCK_PAYROLL_RUNS[existingIndex] = payrollRun;
    } else {
      MOCK_PAYROLL_RUNS.push(payrollRun);
    }

    setInputsChanged(false);
    setRefreshTrigger(prev => prev + 1);

    toast({
      title: "Success",
      description: "Payroll calculated successfully",
      className: "bg-green-50 border-green-200 text-green-900",
    });
  };

  // ========== STATUS CHANGE HANDLER ==========

  /**
   * ✅ UPDATED: Handle status dropdown changes with validation
   * Status meanings:
   * - Draft: editable, not finalized
   * - Calculated: editable, calculated but not finalized
   * - Locked: EDITABLE (finalized logically, but HR can still edit if needed)
   */
  const handleStatusChange = (newStatus: PayrollStatus) => {
    // ✅ FIXED: Check if payroll has been calculated (existingRun exists)
    if (newStatus === "Locked" && !existingRun) {
      toast({
        title: "Error",
        description: "Please calculate payroll before locking.",
        variant: "destructive",
      });
      return;
    }

    // Update status in state
    setCurrentStatus(newStatus);

    // ⚠️ SAFE GUARD: Update mock data array instead of localStorage
    const existingIndex = MOCK_PAYROLL_RUNS.findIndex(r => r.employeeId === employeeId && r.payPeriodId === payPeriodId);

    if (existingIndex >= 0) {
      // Update existing run with new status
      MOCK_PAYROLL_RUNS[existingIndex].status = newStatus;
      if (newStatus === "Locked") {
        MOCK_PAYROLL_RUNS[existingIndex].lockedAt = format(new Date(), 'yyyy-MM-dd');
      }
      setRefreshTrigger(prev => prev + 1);

      toast({
        title: "Success",
        description: newStatus === "Draft"
          ? "Status changed to Draft"
          : newStatus === "Locked"
            ? "Payroll locked successfully. Payslip is now available to employee."
            : "Status updated",
        className: "bg-green-50 border-green-200 text-green-900",
      });
    } else {
      // No calculation exists yet
      if (newStatus === "Draft" || newStatus === "Locked") {
        toast({
          title: "Info",
          description: "Please calculate payroll first",
        });
        // Reset status back to Pending
        setCurrentStatus("Pending");
      }
    }
  };

  // ========== SAVE BUTTON HANDLER (NEW) ==========

  /**
   * ✅ NEW: Save button logic
   * - Validates required fields
   * - Persists data to localStorage
   * - Navigates back to listing page
   * - Works in ALL statuses including Locked
   */
  const handleSave = () => {
    // Step 1: Validate required fields
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
        variant: "destructive",
      });
      return;
    }

    if (!salaryAssignment) {
      toast({
        title: "Error",
        description: "Salary assignment missing. Cannot save payroll.",
        variant: "destructive",
      });
      return;
    }

    // Step 2: Check if calculation exists
    if (!existingRun) {
      toast({
        title: "Error",
        description: "Please calculate payroll before saving.",
        variant: "destructive",
      });
      return;
    }

    // Step 3: Persist data
    // ⚠️ SAFE GUARD: Update mock data array instead of localStorage
    const existingIndex = MOCK_PAYROLL_RUNS.findIndex(r => r.employeeId === employeeId && r.payPeriodId === payPeriodId);

    if (existingIndex >= 0) {
      // Update existing run with current values
      MOCK_PAYROLL_RUNS[existingIndex] = {
        ...MOCK_PAYROLL_RUNS[existingIndex],
        paidDays: parseFloat(paidDays),
        lwpDays: parseFloat(lwpDays),
        otHours: parseFloat(otHours),
        status: currentStatus,
      };

      // Step 4: Show success toast
      toast({
        title: "Payroll Saved",
        description: "Payroll saved successfully",
        className: "bg-green-50 border-green-200 text-green-900",
      });

      // Step 5: Navigate back to listing page
      setTimeout(() => {
        setLocation("/hrms/payroll-management/run-payroll");
      }, 500);
    } else {
      toast({
        title: "Error",
        description: "Payroll run not found. Please calculate first.",
        variant: "destructive",
      });
    }
  };

  const handleBackToList = () => {
    // ✅ Pay period will be auto-restored from localStorage
    setLocation("/hrms/payroll-management/run-payroll");
  };

  // ========== RENDER ==========

  if (!employee || !payPeriod) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Invalid Employee or Pay Period</h3>
            <Button onClick={handleBackToList} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Run Payroll</h1>
          <p className="text-muted-foreground">
            {employee.name} - {payPeriod.periodName}
          </p>
        </div>
        <Button variant="outline" onClick={handleBackToList}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
        </Button>
      </div>

      {/* SECTION 1: Employee & Period Summary (Read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employee & Period Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Employee Name</Label>
              <p className="font-semibold">{employee.name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Employee Code</Label>
              <p className="font-semibold">{employee.code}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Pay Period</Label>
              <p className="font-semibold">{payPeriod.periodName}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Department / Plant</Label>
              <p className="font-semibold">{employee.department}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Salary Structure Name</Label>
              <p className="font-semibold">
                {salaryAssignment ? salaryAssignment.structureName : (
                  <span className="text-red-500">Not Assigned</span>
                )}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Monthly Gross / CTC</Label>
              <p className="font-semibold">
                {salaryAssignment ? `USh${salaryAssignment.monthlyCTC.toLocaleString()}` : "-"}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Period Days</Label>
              <p className="font-semibold">{periodDays} days</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="mt-1">
                {existingRun ? (
                  <Badge variant="outline" className={cn(
                    existingRun.status === "Warning" && "bg-red-100 text-red-700 border-red-200",
                    existingRun.status === "Pending" && "bg-gray-100 text-gray-700 border-gray-200",
                    existingRun.status === "Draft" && "bg-blue-100 text-blue-700 border-blue-200",
                    existingRun.status === "Locked" && "bg-green-100 text-green-700 border-green-200"
                  )}>
                    {existingRun.status}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                    Pending
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: Salary Structure Preview (Read-only) - NEW */}
      {salaryAssignment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Salary Structure</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Earnings Table */}
            {salaryAssignment.earnings.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-sm">Earnings</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component Name</TableHead>
                      <TableHead>Rule Type</TableHead>
                      <TableHead className="text-right">Monthly Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* ⚠️ SAFE GUARD: Using optional chaining and nullish coalescing to prevent crashes */}
                    {(salaryAssignment?.earnings ?? []).map((comp) => (
                      <TableRow key={comp?.code ?? Math.random()}>
                        <TableCell className="font-medium">{comp?.name ?? '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {comp?.ruleType ?? '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          USh{(comp?.monthlyAmount ?? 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-blue-50 font-semibold">
                      <TableCell colSpan={2}>Total Monthly Gross</TableCell>
                      <TableCell className="text-right">
                        USh{salaryAssignment.monthlyCTC.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Deductions Table */}
            {salaryAssignment.deductions.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 text-sm">Deductions</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component Name</TableHead>
                      <TableHead>Rule Type</TableHead>
                      <TableHead className="text-right">Monthly Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* ⚠️ SAFE GUARD: Using optional chaining and nullish coalescing to prevent crashes */}
                    {(salaryAssignment?.deductions ?? []).map((comp) => (
                      <TableRow key={comp?.code ?? Math.random()}>
                        <TableCell className="font-medium">{comp?.name ?? '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            {comp?.ruleType ?? '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          USh{(comp?.monthlyAmount ?? 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* ✅ ADDED: Total Monthly Deductions Row */}
                    <TableRow className="bg-red-50 font-semibold border-t-2 border-red-200">
                      <TableCell colSpan={2}>Total Monthly Deductions</TableCell>
                      <TableCell className="text-right">
                        USh{salaryAssignment.deductions.reduce((sum, d) => sum + d.monthlyAmount, 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {salaryAssignment.deductions.length === 0 && (
              <p className="text-sm text-muted-foreground">No deductions in structure</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Validation Banner (if salary assignment missing) */}
      {hasMissingAssignment && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-900">Salary assignment missing</h4>
            <p className="text-sm text-red-700 mt-1">
              Please assign salary before running payroll.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 3: Manual Entry Section (SIMPLIFIED) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance & OT</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Paid Days */}
            <div className="space-y-2">
              <Label>
                Paid Days <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={paidDays}
                onChange={(e) => {
                  setPaidDays(e.target.value);
                  if (existingRun && existingRun.status === "Draft") setInputsChanged(true);
                }}
                disabled={isLocked}
                className={formErrors.paidDays ? "border-red-500" : ""}
              />
              {formErrors.paidDays && (
                <p className="text-xs text-red-500">{formErrors.paidDays}</p>
              )}
            </div>

            {/* LWP Days */}
            <div className="space-y-2">
              <Label>
                LWP Days <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={lwpDays}
                onChange={(e) => {
                  setLwpDays(e.target.value);
                  if (existingRun && existingRun.status === "Draft") setInputsChanged(true);
                }}
                disabled={isLocked}
                className={formErrors.lwpDays ? "border-red-500" : ""}
              />
              {formErrors.lwpDays && (
                <p className="text-xs text-red-500">{formErrors.lwpDays}</p>
              )}
              {!formErrors.lwpDays && (
                <p className="text-xs text-muted-foreground">For validation only (not deducted separately)</p>
              )}
            </div>

            {/* OT Hours */}
            <div className="space-y-2">
              <Label>OT Hours</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={otHours}
                onChange={(e) => {
                  setOtHours(e.target.value);
                  if (existingRun && existingRun.status === "Draft") setInputsChanged(true);
                }}
                disabled={isLocked}
                className={formErrors.otHours ? "border-red-500" : ""}
              />
              {formErrors.otHours && (
                <p className="text-xs text-red-500">{formErrors.otHours}</p>
              )}
              <p className="text-xs text-muted-foreground">Rate: USh{OT_RATE_PER_HOUR}/hour</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ UPDATED: CALCULATION SUMMARY TABLE (Shows after Calculate is clicked) */}
      {/* SECTION 5: Calculation Summary (Clean Table Format) */}
      {existingRun && (
        <div className="space-y-4">
          {/* Inputs Changed Warning */}
          {inputsChanged && (
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800">
                Inputs changed. Click Calculate to refresh summary.
              </span>
            </div>
          )}

          {/* Calculation Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Calculation Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {/* Prorated Salary */}
                  <TableRow>
                    <TableCell>
                      <div>
                        <p className="font-medium">Prorated Salary</p>
                        <p className="text-xs text-muted-foreground">
                          Monthly Salary × ({existingRun.paidDays} Paid Days / {periodDays} Period Days)
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      USh{(existingRun.proratedSalary || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>


                  {/* Gross Pay */}
                  <TableRow>
                    <TableCell>
                      <div>
                        <p className="font-medium">Gross Pay</p>
                        <p className="text-xs text-muted-foreground">Prorated Salary + OT</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      USh{(existingRun.grossPay || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>

                  {/* Salary Structure Deductions (Total) */}
                  {existingRun.totalDeductions > 0 && (
                    <TableRow>
                      <TableCell>
                        <div>
                          <p className="font-medium">Salary Structure Deductions (Total)</p>
                          <p className="text-xs text-muted-foreground">
                            PF + ESI + PT
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        -USh{(existingRun.totalDeductions || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}



                  {/* Net Pay (Highlighted) */}
                  <TableRow className="bg-green-50 border-t-2 border-green-200">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-green-900">Net Pay</p>
                        <p className="text-xs text-green-700">
                          Gross Pay − Structure Deductions
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-900 text-lg">
                      USh{(existingRun.netPay || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ✅ UPDATED: Sticky Action Bar at Bottom */}
      <div className="sticky bottom-0 bg-white border-t shadow-lg p-4 -mx-6 -mb-6 mt-8">
        <div className="flex justify-end items-center gap-3">
          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Status:</Label>
            <Select
              value={currentStatus}
              onValueChange={(value) => handleStatusChange(value as PayrollStatus)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Locked">Locked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Calculate Button */}
          <Button
            onClick={handleCalculate}
            disabled={hasMissingAssignment}
            variant="outline"
            className="gap-2"
          >
            <Calculator className="h-4 w-4" />
            Calculate
          </Button>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={hasMissingAssignment || !existingRun || inputsChanged}
            className="gap-2"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

