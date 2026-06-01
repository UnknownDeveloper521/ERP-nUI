// ============================================================================
// SHARED BATCH TRACKING DATA (GSV7 battery manufacturing demo)
// ============================================================================

import { GSV7_ITEMS } from "@/lib/gsv7OperationsMockData";

export type BatchStatus = "Batch Created" | "Sent for QC" | "Verified QC" | "Batch Closed";

export interface BatchItem {
    id: number | string;
    item_id?: number | string;
    item: string;
    itemCode?: string;
    itemName?: string;
    skuCode?: string;
    skuName?: string;
    uom: string;
    qtySupplied: number | string;
    qtyProduced: number | string;
    verifiedQty?: number | string;
    availableQty?: number;
    qcRequired?: boolean;
}

export interface QCParameter {
    id: number;
    parameterName: string;
    description: string;
}

export interface BatchRecord {
    id: number;
    batchNo: string;
    date: string;
    mrNo: string;
    operation: string;
    workCenter: string;
    warehouse: string;
    shift: string;
    totalInputItems?: number;
    totalOutputItems?: number;
    status: BatchStatus;
    createdType?: "SINGLE" | "BULK";
    bulkBatchGroupId?: string;
    startTime?: string;
    endTime?: string;
    inputItems?: BatchItem[];
    outputItems?: BatchItem[];
    qcStatus?: "Sent for QC" | "Verified";
    qcVerifiedBy?: string;
    qcVerifiedOn?: string;
    qcParameters?: QCParameter[];
    remarks?: string;
    qcRequired?: boolean;
}

export const OPERATION_QC_REQUIRED: Record<string, boolean> = {
    "Scrap Sorting": false,
    "Lead Purification": true,
    "Grid Casting": false,
    "Grid Positive / Negative Formation": false,
    "Grid Drying": false,
    "Connector Creation": false,
    "Terminal Creation": true,
    "Plastic Case Moulding": false,
    "GSV7 Assembly": true,
};

export let mockBatchRecords: BatchRecord[] = [
    {
        id: 1,
        batchNo: "BATCH-GSV7-001",
        date: "2026-05-28",
        mrNo: "MR-GSV7-001",
        operation: "Lead Purification",
        workCenter: "Lead Furnace Center",
        warehouse: "Jinja Main WH",
        shift: "Morning",
        totalInputItems: 1,
        totalOutputItems: 1,
        status: "Batch Closed",
        createdType: "SINGLE",
        inputItems: [
            {
                id: 1,
                item: GSV7_ITEMS.RM_SCRAP_LEAD.name,
                itemCode: GSV7_ITEMS.RM_SCRAP_LEAD.code,
                itemName: GSV7_ITEMS.RM_SCRAP_LEAD.name,
                uom: "KG",
                qtySupplied: 2500,
                qtyProduced: 0,
                availableQty: 3000,
            },
        ],
        outputItems: [
            {
                id: 1,
                item: GSV7_ITEMS.SFG_LEAD_INGOT.name,
                itemCode: GSV7_ITEMS.SFG_LEAD_INGOT.code,
                itemName: GSV7_ITEMS.SFG_LEAD_INGOT.name,
                uom: "KG",
                qtyProduced: 2280,
                qtySupplied: 0,
                verifiedQty: 2275,
            },
        ],
        qcStatus: "Verified",
        qcVerifiedBy: "QC — Daniel Kato",
        qcVerifiedOn: "2026-05-29T10:30:00",
        qcRequired: true,
    },
    {
        id: 2,
        batchNo: "BATCH-GSV7-002",
        date: "2026-05-30",
        mrNo: "MR-GSV7-002",
        operation: "GSV7 Assembly",
        workCenter: "Assembly Line",
        warehouse: "Jinja Main WH",
        shift: "Morning",
        totalInputItems: 3,
        totalOutputItems: 1,
        status: "Sent for QC",
        createdType: "SINGLE",
        inputItems: [
            {
                id: 1,
                item: GSV7_ITEMS.SFG_GRID_POS_DRY.name,
                itemCode: GSV7_ITEMS.SFG_GRID_POS_DRY.code,
                uom: "NOS",
                qtySupplied: 100,
                qtyProduced: 0,
            },
            {
                id: 2,
                item: GSV7_ITEMS.SFG_GRID_NEG_DRY.name,
                itemCode: GSV7_ITEMS.SFG_GRID_NEG_DRY.code,
                uom: "NOS",
                qtySupplied: 100,
                qtyProduced: 0,
            },
            {
                id: 3,
                item: GSV7_ITEMS.RM_ACID.name,
                itemCode: GSV7_ITEMS.RM_ACID.code,
                uom: "LTR",
                qtySupplied: 120,
                qtyProduced: 0,
            },
        ],
        outputItems: [
            {
                id: 1,
                item: GSV7_ITEMS.FG_GSV7.name,
                itemCode: GSV7_ITEMS.FG_GSV7.code,
                itemName: GSV7_ITEMS.FG_GSV7.name,
                skuCode: "SKU-GSV7-12V",
                skuName: "GSV7 Battery 12V Standard",
                uom: "NOS",
                qtyProduced: 98,
                qtySupplied: 0,
            },
        ],
        qcRequired: true,
    },
    {
        id: 3,
        batchNo: "BATCH-GSV7-003",
        date: "2026-05-30",
        mrNo: "MR-GSV7-001",
        operation: "Grid Casting",
        workCenter: "Grid Casting Center",
        warehouse: "Jinja Main WH",
        shift: "Night",
        totalInputItems: 1,
        totalOutputItems: 1,
        status: "Verified QC",
        createdType: "SINGLE",
        inputItems: [
            {
                id: 1,
                item: GSV7_ITEMS.SFG_LEAD_INGOT.name,
                itemCode: GSV7_ITEMS.SFG_LEAD_INGOT.code,
                uom: "KG",
                qtySupplied: 720,
                qtyProduced: 0,
            },
        ],
        outputItems: [
            {
                id: 1,
                item: GSV7_ITEMS.SFG_GRID_CAST.name,
                itemCode: GSV7_ITEMS.SFG_GRID_CAST.code,
                uom: "NOS",
                qtyProduced: 778,
                qtySupplied: 0,
                verifiedQty: 778,
            },
        ],
        qcStatus: "Verified",
        qcVerifiedBy: "QC — Daniel Kato",
        qcVerifiedOn: "2026-05-30T09:15:00",
    },
    {
        id: 4,
        batchNo: "BATCH-GSV7-004",
        date: "2026-05-30",
        mrNo: "MR-GSV7-003",
        operation: "Grid Drying",
        workCenter: "Grid Formation Center",
        warehouse: "Jinja Main WH",
        shift: "Night",
        totalInputItems: 2,
        totalOutputItems: 2,
        status: "Batch Created",
        createdType: "SINGLE",
        inputItems: [
            {
                id: 1,
                item: GSV7_ITEMS.SFG_GRID_POS.name,
                itemCode: GSV7_ITEMS.SFG_GRID_POS.code,
                uom: "NOS",
                qtySupplied: 500,
                qtyProduced: 0,
            },
            {
                id: 2,
                item: GSV7_ITEMS.SFG_GRID_NEG.name,
                itemCode: GSV7_ITEMS.SFG_GRID_NEG.code,
                uom: "NOS",
                qtySupplied: 500,
                qtyProduced: 0,
            },
        ],
        outputItems: [
            {
                id: 1,
                item: GSV7_ITEMS.SFG_GRID_POS_DRY.name,
                itemCode: GSV7_ITEMS.SFG_GRID_POS_DRY.code,
                uom: "NOS",
                qtyProduced: 0,
                qtySupplied: 0,
            },
            {
                id: 2,
                item: GSV7_ITEMS.SFG_GRID_NEG_DRY.name,
                itemCode: GSV7_ITEMS.SFG_GRID_NEG_DRY.code,
                uom: "NOS",
                qtyProduced: 0,
                qtySupplied: 0,
            },
        ],
        qcRequired: false,
    },
];
