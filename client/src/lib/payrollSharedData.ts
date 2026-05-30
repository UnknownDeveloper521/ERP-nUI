import { format } from "date-fns";

export interface PayPeriod {
    id: string;
    periodName: string; // e.g. "Feb-2026"
    month: number; // 0-11
    year: number;
    startDate: string; // ISO format YYYY-MM-DD
    endDate: string; // ISO format YYYY-MM-DD
    status: "Active" | "Open" | "Locked" | "Processed" | "Paid" | "Draft";
    notes?: string;
}

export type PayrollStatus = "Pending" | "Draft" | "Calculated" | "Locked" | "Warning";

/**
 * Employee structure
 */
export interface Employee {
    id: string;
    code: string;
    name: string;
    department: string;
    designation: string;
}

/**
 * Payroll Run Record
 */
export interface PayrollRun {
    id: string;
    employeeId: string;
    payPeriodId: string;

    // Manual Entry Fields
    paidDays: number;
    lwpDays: number;
    otHours: number;

    // Calculated Fields
    perDaySalary: number;
    proratedSalary: number;
    otAmount: number;
    lwpDeduction: number;
    grossPay: number;
    totalDeductions: number;
    netPay: number;

    // Status & Metadata
    status: PayrollStatus;
    warningMessages: string[];
    calculatedAt?: string;
    lockedAt?: string;

    // Earnings/Deductions details for payslip
    earnings?: { name: string; amount: number }[];
    deductions?: { name: string; amount: number }[];
}

export const mockPayPeriods: PayPeriod[] = [
    {
        id: "pp-003",
        periodName: "Mar-2026",
        month: 2,
        year: 2026,
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        status: "Open",
        notes: "Current pay period"
    }
];

export const MOCK_EMPLOYEES: Employee[] = [
    {
        id: "emp-001",
        code: "EMP001",
        name: "John Doe",
        department: "Engineering",
        designation: "Software Engineer"
    },
    {
        id: "emp-002",
        code: "EMP002",
        name: "Sarah Johnson",
        department: "Finance",
        designation: "Manager"
    },
    {
        id: "emp-003",
        code: "EMP003",
        name: "Mike Johnson",
        department: "Finance",
        designation: "Accountant"
    }
];

/**
 * Shared Payroll RUNS - The single source of truth for flow
 */
export const MOCK_PAYROLL_RUNS: PayrollRun[] = [
    {
        id: "pr-001",
        employeeId: "emp-001",
        payPeriodId: "pp-003", // Mar 2026
        paidDays: 25,
        lwpDays: 1,
        otHours: 5,
        perDaySalary: 1200,
        proratedSalary: 30000,
        otAmount: 500,
        lwpDeduction: 0,
        grossPay: 30500,
        totalDeductions: 3000,
        netPay: 27500,
        status: "Locked",
        warningMessages: [],
        calculatedAt: "2026-03-25",
        lockedAt: "2026-03-26",
        earnings: [
            { name: "Basic Salary", amount: 20000 },
            { name: "HRA", amount: 10000 },
            { name: "Overtime", amount: 500 }
        ],
        deductions: [
            { name: "PF", amount: 2000 },
            { name: "Tax", amount: 1000 }
        ]
    }
];

export const getPeriodName = (month: number, year: number) => {
    return format(new Date(year, month, 1), "MMM-yyyy");
};
