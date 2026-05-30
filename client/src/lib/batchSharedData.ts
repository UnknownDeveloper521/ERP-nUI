// ============================================================================
// SHARED BATCH TRACKING DATA
// ============================================================================
// This file contains shared data and types for Batch Tracking used by both:
// - Production module (Batch Tracking)
// - Quality Check module (Batch QC)
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type BatchStatus = "Batch Created" | "Sent for QC" | "Verified QC" | "Batch Closed";

export interface BatchItem {
    id: number | string;
    item_id?: number | string;
    item: string;
    itemCode?: string;
    itemName?: string;
    uom: string;
    qtySupplied: number | string; // Required for tracking consumption
    qtyProduced: number | string; // Required for tracking output
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
    date: string; // Used as batchDate in QC
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
    "Lead Generation & Purification": true,
    "Case Creation": false,
    "Grid Creation & Oxidization": true,
    "Assembly line & Packaging": true
};

// ============================================================================
// MOCK DATA
// ============================================================================

export let mockBatchRecords: BatchRecord[] = [
    {
        id: 1,
        batchNo: "BATCH-2024-001",
        date: "2024-01-15",
        mrNo: "MR-2024-001",
        operation: "Lead Generation & Purification",
        workCenter: "Lead Furnace Center",
        warehouse: "Jinja WH",
        shift: "Morning",
        totalInputItems: 1,
        totalOutputItems: 1,
        status: "Batch Closed",
        createdType: "SINGLE",
        startTime: "2024-01-15T08:00:00",
        endTime: "2024-01-15T16:00:00",
        inputItems: [
            { id: 1, item: "Scrap Battery", uom: "KG", qtySupplied: 1000, qtyProduced: 0, availableQty: 2000 },
        ],
        outputItems: [
            { id: 1, item: "Purified Lead", itemCode: "sfg-1", itemName: "Purified Lead", uom: "KG", qtyProduced: 950, qtySupplied: 0, verifiedQty: 950 },
        ],
        qcStatus: "Verified",
        qcVerifiedBy: "QC Inspector - John Smith",
        qcVerifiedOn: "2024-01-16T10:30:00",
    },
    {
        id: 2,
        batchNo: "BATCH-2024-002",
        date: "2024-01-16",
        mrNo: "MR-2024-002",
        operation: "Assembly line & Packaging",
        workCenter: "Assembly Line",
        warehouse: "Jinja WH",
        shift: "Night",
        totalInputItems: 3,
        totalOutputItems: 1,
        status: "Verified QC",
        createdType: "SINGLE",
        startTime: "2024-01-16T20:00:00",
        endTime: "2024-01-17T04:00:00",
        qcStatus: "Verified",
        qcVerifiedBy: "QC Inspector - John Smith",
        qcVerifiedOn: "2024-01-17T10:30:00",
        inputItems: [
            { id: 1, item: "Battery Cases", uom: "NOS", qtySupplied: 50, qtyProduced: 0, availableQty: 150 },
            { id: 2, item: "Battery Lids", uom: "NOS", qtySupplied: 50, qtyProduced: 0, availableQty: 150 },
            { id: 3, item: "Acid Type A", uom: "LTR", qtySupplied: 50, qtyProduced: 0, availableQty: 150 },
        ],
        outputItems: [
            { id: 1, item: "GSV 7", itemCode: "fg-1", itemName: "GSV 7", uom: "NOS", qtyProduced: 50, qtySupplied: 0, verifiedQty: 49 },
        ],
        qcRequired: true
    },
    {
        id: 3,
        batchNo: "BATCH-2024-003",
        date: "2024-01-17",
        mrNo: "MR-2024-004",
        operation: "Case Creation",
        workCenter: "Plastic Casing Center",
        warehouse: "Jinja WH",
        shift: "Morning",
        totalInputItems: 1,
        totalOutputItems: 2,
        status: "Batch Closed",
        createdType: "SINGLE",
        startTime: "2024-01-17T09:00:00",
        endTime: "2024-01-17T17:00:00",
        inputItems: [
            { id: 1, item: "Plastic Pallets", uom: "KG", qtySupplied: 100, qtyProduced: 0, availableQty: 500 },
        ],
        outputItems: [
            { id: 1, item: "Battery Cases", itemCode: "sfg-2", itemName: "Battery Cases", uom: "NOS", qtyProduced: 50, qtySupplied: 0 },
            { id: 2, item: "Battery Lids", itemCode: "sfg-3", itemName: "Battery Lids", uom: "NOS", qtyProduced: 50, qtySupplied: 0 },
        ],
        qcRequired: false
    }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const addBatchRecord = (record: BatchRecord): BatchRecord[] => {
    mockBatchRecords.unshift(record);
    return [...mockBatchRecords];
};

export const updateBatchRecord = (id: number, updates: Partial<BatchRecord>): BatchRecord[] => {
    const index = mockBatchRecords.findIndex(req => req.id === id);
    if (index !== -1) {
        mockBatchRecords[index] = { ...mockBatchRecords[index], ...updates };
    }
    return [...mockBatchRecords];
};

export const getBatchRecordById = (id: number): BatchRecord | undefined => {
    return mockBatchRecords.find(req => req.id === id);
};
