// ============================================================================
// PRODUCTION PLAN SHARED DATA
// ============================================================================
// This file contains shared types and initial mock data for production plans.
// It is used across ProductionPlan.tsx and MyRequest.tsx.
// ============================================================================

export type PlanStatus = "To Do" | "In Progress" | "Completed" | "Overdue";

export interface DailyFGPlan {
    id: number;
    planCode: string;
    startDate: string;
    endDate: string;
    operationName: string;
    itemId: string | number;
    itemCode: string;
    itemName: string;
    shift: "Morning" | "Night";
    plannedQty: string;
    fulfilledQty: string;
    uom: string;
    status: PlanStatus;
}

export const INITIAL_PLANS: DailyFGPlan[] = [
    {
        id: 1,
        planCode: "PLN-24-001",
        startDate: "23-04-2024",
        endDate: "23-04-2024",
        operationName: "Lead Generation & Purification",
        itemId: "sfg-1",
        itemCode: "SFG001",
        itemName: "Purified Lead",
        shift: "Morning",
        plannedQty: "1000",
        fulfilledQty: "450",
        uom: "kg",
        status: "In Progress"
    },
    {
        id: 2,
        planCode: "PLN-24-002",
        startDate: "24-04-2024",
        endDate: "24-04-2024",
        operationName: "Case Creation",
        itemId: "sfg-2",
        itemCode: "SFG002",
        itemName: "Battery Cases",
        shift: "Night",
        plannedQty: "500",
        fulfilledQty: "0",
        uom: "nos",
        status: "To Do"
    },
    {
        id: 3,
        planCode: "PLN-24-003",
        startDate: "22-04-2024",
        endDate: "22-04-2024",
        operationName: "Assembly line & Packaging",
        itemId: "fg-1",
        itemCode: "FG001",
        itemName: "GSV 7",
        shift: "Morning",
        plannedQty: "200",
        fulfilledQty: "200",
        uom: "nos",
        status: "Completed"
    }
];
