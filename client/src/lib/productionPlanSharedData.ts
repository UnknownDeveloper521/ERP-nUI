import { format } from "date-fns";
import { GSV7_ITEMS } from "@/lib/gsv7OperationsMockData";
import { getGsv7ItemIdByCode } from "@/lib/gsv7BomTreeBuilder";

export type PlanStatus = "To Do" | "In Progress" | "Completed" | "Overdue";

export interface DailyFGPlanOutput {
    itemId: string;
    itemName: string;
    itemCode: string;
    plannedQty: string;
    fulfilledQty: string;
    uom: string;
    skuId?: string;
    skuCode?: string;
    skuName?: string;
}

export interface DailyFGPlan {
    id: number;
    planCode: string;
    startDate: string;
    endDate: string;
    operationName: string;
    itemId: string;
    itemName: string;
    itemCode: string;
    shift: string;
    plannedQty: string;
    fulfilledQty: string;
    uom: string;
    status: PlanStatus;
    outputs?: DailyFGPlanOutput[];
}

/** Fallback list when API mock is unavailable (aligned with GSV7 seed). */
export const INITIAL_PLANS: DailyFGPlan[] = [
    {
        id: 1,
        planCode: "PLN-GSV7-001",
        startDate: format(new Date(), "dd-MM-yyyy"),
        endDate: format(new Date(), "dd-MM-yyyy"),
        operationName: "GSV7 Assembly",
        itemId: String(getGsv7ItemIdByCode(GSV7_ITEMS.FG_GSV7.code)),
        itemCode: GSV7_ITEMS.FG_GSV7.code,
        itemName: GSV7_ITEMS.FG_GSV7.name,
        shift: "Morning",
        plannedQty: "100",
        fulfilledQty: "45",
        uom: "Nos",
        status: "In Progress",
        outputs: [
            {
                itemId: String(getGsv7ItemIdByCode(GSV7_ITEMS.FG_GSV7.code)),
                itemCode: GSV7_ITEMS.FG_GSV7.code,
                itemName: GSV7_ITEMS.FG_GSV7.name,
                plannedQty: "100",
                fulfilledQty: "45",
                uom: "Nos",
                skuCode: "SKU-GSV7-12V",
                skuName: "GSV7 Battery 12V Standard",
            },
        ],
    },
    {
        id: 2,
        planCode: "PLN-GSV7-002",
        startDate: format(new Date(), "dd-MM-yyyy"),
        endDate: format(new Date(), "dd-MM-yyyy"),
        operationName: "Grid Drying",
        itemId: String(getGsv7ItemIdByCode(GSV7_ITEMS.SFG_GRID_POS_DRY.code)),
        itemCode: GSV7_ITEMS.SFG_GRID_POS_DRY.code,
        itemName: GSV7_ITEMS.SFG_GRID_POS_DRY.name,
        shift: "Night",
        plannedQty: "500",
        fulfilledQty: "0",
        uom: "Nos",
        status: "To Do",
    },
];
