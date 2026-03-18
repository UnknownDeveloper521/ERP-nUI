/**
 * ============================================================================
 * SHARED SALARY ASSIGNMENT DATA STORE
 * ============================================================================
 * 
 * This file provides a centralized data store for salary assignments that
 * syncs between HR Setup → Assign Employee Salary and HRMS → Run Payroll.
 * 
 * When assignments are created/updated in Assign Employee Salary, they
 * automatically become available in Run Payroll.
 * 
 * ============================================================================
 */

// Types for Assign Employee Salary (HR Setup)
export type CalcMode = "FLAT" | "PCT_CTC" | "PCT_BASIC" | "REMAINING";
export type Category = "earning" | "deduction";
export type StructureMode = "structure" | "custom";

export interface SalaryComponent {
    code: string;
    name: string;
    category: Category;
}

export interface SalaryRule {
    componentCode: string;
    name: string;
    category: Category;
    calcMode: CalcMode;
    value: number;
    isBase: boolean;
}

export interface ComputedRow extends SalaryRule {
    monthlyAmount: number;
    annualAmount: number;
}

export interface Assignment {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    department: string;
    designation: string;
    structureMode: StructureMode;
    structureId?: string;
    structureName?: string;
    annualCTC: number;
    monthlyCTC: number;
    effectiveFrom: string;
    status: "active" | "inactive";
    earnings: ComputedRow[];
    deductions: ComputedRow[];
}

// Types for Run Payroll compatibility
export interface PayrollSalaryComponent {
    code: string;
    name: string;
    ruleType: string;
    monthlyAmount: number;
}

export interface PayrollSalaryAssignment {
    employeeId: string;
    structureName: string;
    monthlyCTC: number;
    earnings: PayrollSalaryComponent[];
    deductions: PayrollSalaryComponent[];
}

/**
 * Centralized salary assignments store
 * This is the single source of truth for all salary assignments
 * 
 * IMPORTANT: This data is TEMPORARY and resets on page refresh.
 * - During session: Changes persist in memory
 * - After refresh: Resets to default mock data below
 * - No localStorage/sessionStorage persistence
 */
let salaryAssignments: Assignment[] = [
    // Default mock assignment - always loads on page refresh
    {
        id: "ASG-001",
        employeeId: "emp-001",
        employeeName: "John Doe",
        employeeCode: "EMP001",
        department: "Engineering",
        designation: "Software Engineer",
        structureMode: "structure",
        structureId: "struct-exec",
        structureName: "Executive Standard",
        annualCTC: 600000,
        monthlyCTC: 50000,
        effectiveFrom: "2026-03-01",
        status: "active",
        earnings: [
            {
                componentCode: "BASIC",
                name: "Basic Salary",
                category: "earning",
                calcMode: "PCT_CTC",
                value: 50,
                isBase: true,
                monthlyAmount: 25000,
                annualAmount: 300000
            },
            {
                componentCode: "HRA",
                name: "House Rent Allowance",
                category: "earning",
                calcMode: "PCT_BASIC",
                value: 40,
                isBase: true,
                monthlyAmount: 10000,
                annualAmount: 120000
            },
            {
                componentCode: "SPECIAL",
                name: "Special Allowance",
                category: "earning",
                calcMode: "REMAINING",
                value: 0,
                isBase: true,
                monthlyAmount: 15000,
                annualAmount: 180000
            }
        ],
        deductions: [
            {
                componentCode: "PF",
                name: "Provident Fund",
                category: "deduction",
                calcMode: "PCT_BASIC",
                value: 12,
                isBase: false,
                monthlyAmount: 3000,
                annualAmount: 36000
            },
            {
                componentCode: "PT",
                name: "Professional Tax",
                category: "deduction",
                calcMode: "FLAT",
                value: 200,
                isBase: false,
                monthlyAmount: 200,
                annualAmount: 2400
            }
        ]
    }
];

/**
 * Get all salary assignments
 */
export const getSalaryAssignments = (): Assignment[] => {
    return [...salaryAssignments];
};

/**
 * Set salary assignments (used by Assign Employee Salary)
 */
export const setSalaryAssignments = (assignments: Assignment[]): void => {
    salaryAssignments = [...assignments];
};

/**
 * Add or update a salary assignment
 */
export const upsertSalaryAssignment = (assignment: Assignment): void => {
    const existingIndex = salaryAssignments.findIndex(a => a.id === assignment.id);
    if (existingIndex >= 0) {
        salaryAssignments[existingIndex] = assignment;
    } else {
        salaryAssignments.push(assignment);
    }
};

/**
 * Remove a salary assignment
 */
export const removeSalaryAssignment = (assignmentId: string): void => {
    salaryAssignments = salaryAssignments.filter(a => a.id !== assignmentId);
};

/**
 * Get active salary assignments for Run Payroll
 * Converts Assignment format to PayrollSalaryAssignment format
 */
export const getActivePayrollAssignments = (): PayrollSalaryAssignment[] => {
    return salaryAssignments
        .filter(assignment => assignment.status === "active")
        .map(assignment => ({
            employeeId: assignment.employeeId,
            structureName: assignment.structureName || 
                (assignment.structureMode === "custom" 
                    ? "Custom Structure" 
                    : assignment.structureId || "Unknown Structure"),
            monthlyCTC: assignment.monthlyCTC,
            earnings: assignment.earnings.map(earning => ({
                code: earning.componentCode,
                name: earning.name,
                ruleType: earning.calcMode === "FLAT" 
                    ? "Fixed" 
                    : earning.calcMode === "PCT_CTC" 
                        ? "% of CTC"
                        : earning.calcMode === "PCT_BASIC"
                            ? "% of Basic"
                            : "Remaining",
                monthlyAmount: earning.monthlyAmount
            })),
            deductions: assignment.deductions.map(deduction => ({
                code: deduction.componentCode,
                name: deduction.name,
                ruleType: deduction.calcMode === "FLAT" 
                    ? "Fixed" 
                    : deduction.calcMode === "PCT_CTC" 
                        ? "% of CTC"
                        : deduction.calcMode === "PCT_BASIC"
                            ? "% of Basic"
                            : "Remaining",
                monthlyAmount: deduction.monthlyAmount
            }))
        }));
};

/**
 * Get salary assignment for a specific employee (Run Payroll compatibility)
 */
export const getPayrollSalaryAssignment = (employeeId: string): PayrollSalaryAssignment | undefined => {
    const activeAssignments = getActivePayrollAssignments();
    return activeAssignments.find(assignment => assignment.employeeId === employeeId);
};

/**
 * Alias for backward compatibility (in case of cached imports)
 * @deprecated Use getSalaryAssignments instead
 */
export const getAssignmentsFromSetup = getSalaryAssignments;