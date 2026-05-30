import { format } from "date-fns";

export type PlanStatus = "To Do" | "In Progress" | "Completed" | "Overdue";

/**
 * DailyFGPlan Interface
 * Tracks production schedules with required date ranges and output targets.
 * Linked by: My Request (Material Request)
 */
export interface DailyFGPlanOutput {
    itemId: string;
    itemName: string;
    itemCode: string;
    plannedQty: string;
    fulfilledQty: string;
    uom: string;
}

export interface DailyFGPlan {
    id: number;
    planCode: string;
    startDate: string; // Required: Production Start Date (DD-MM-YYYY)
    endDate: string;   // Required: Production End Date (DD-MM-YYYY)
    operationName: string;
    itemId: string;
    itemName: string;
    itemCode: string; // First output — kept for backward compatibility
    shift: string;
    plannedQty: string;
    fulfilledQty: string; // First output — kept for backward compatibility
    uom: string;
    status: PlanStatus;
    /** All output rows from API (fulfilled / targeted per item) */
    outputs?: DailyFGPlanOutput[];
}

/**
 * Mock data for production plans.
 * Standardized status: To Do, In Progress, Completed, Overdue.
 */
export const INITIAL_PLANS: DailyFGPlan[] = [
    {
        id: 1,
        planCode: "PLN-24-001",
        startDate: format(new Date(), "dd-MM-yyyy"),
        endDate: format(new Date(), "dd-MM-yyyy"),
        operationName: "Lead Generation & Purification",
        itemId: "sfg-1",
        itemCode: "SFG001",
        itemName: "Purified Lead",
        shift: "Morning",
        plannedQty: "1000",
        fulfilledQty: "500",
        uom: "kg",
        status: "In Progress"
    },
    {
        id: 2,
        planCode: "PLN-24-002",
        startDate: format(new Date(), "dd-MM-yyyy"),
        endDate: format(new Date(), "dd-MM-yyyy"),
        operationName: "Assembly line & Packaging",
        itemId: "fg-1",
        itemCode: "FG001",
        itemName: "GSV 7",
        shift: "Night",
        plannedQty: "100",
        fulfilledQty: "0",
        uom: "nos",
        status: "To Do"
    },
    {
        id: 3,
        planCode: "PLN-24-003",
        startDate: "01-01-2024",
        endDate: "15-01-2024",
        operationName: "Case Creation",
        itemId: "sfg-2",
        itemCode: "SFG002",
        itemName: "Battery Cases",
        shift: "Morning",
        plannedQty: "2000",
        fulfilledQty: "1200",
        uom: "nos",
        status: "Overdue"
    },
    {
        id: 4,
        planCode: "PLN-24-004",
        startDate: "10-02-2024",
        endDate: "20-02-2024",
        operationName: "Grid Creation & Oxidization",
        itemId: "sfg-4",
        itemCode: "SFG004",
        itemName: "Separators",
        shift: "Night",
        plannedQty: "5000",
        fulfilledQty: "5000",
        uom: "pcs",
        status: "Completed"
    },
];
