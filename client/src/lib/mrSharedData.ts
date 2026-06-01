// ============================================================================
// SHARED MR REQUEST DATA
// ============================================================================
// This file contains shared data and types for MR Requests used by both:
// - Service Center MR Request module (for creating and receiving requests)
// - Inventory MR Request module (for issuing materials)
// - Production My Request module (for linking MRs to Production Plans)
// ============================================================================

import { GSV7_ITEMS } from "@/lib/gsv7OperationsMockData";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type MRStatus = "Requested to Warehouse" | "Issued by Warehouse" | "Received by Production";

// MR Item in the request
export interface MRItem {
    id: number | string;
    itemCode: string;
    itemName: string;
    uom: string;
    skuCode?: string;
    skuName?: string;
    availableQty: number;
    requiredQty: number;
    issuedQty?: number;
    receivedQty?: number;
}

// MR Request data structure
export interface MRRequest {
    id: number;
    mrNo: string;
    date: string;
    requiredByDate: string;
    operation: string;
    workCenter: string;
    warehouse: string;
    shift: string;
    requestedBy: string;
    status: MRStatus;
    issuedDate?: string;
    issuedBy?: string;
    receivedDate?: string;
    receivedBy?: string;
    /**
     * Integration: Reference to linked Production Plan ID
     * Links this Material Request to a specific DailyFGPlan
     */
    productionPlanId?: number; 
    items: MRItem[];
}

// Master item from inventory
export interface MasterItem {
    id: string;
    name: string;
    type: "SFG" | "FG";
    uom: string;
    availableStock: number;
}

// ============================================================================
// MOCK DATA
// ============================================================================

// Mock work centers
export const mockWorkCenters = [
    "Lead Furnace Center", 
    "Plastic Casing Center", 
    "Grid Generation Center", 
    "Assembly Line"
];

// Mock departments
export const mockDepartments = [
    "Service Center",
    "Warranty Service",
    "Technical Support",
    "Customer Service"
];

// Combine SFG and FG items with additional properties for MR
const GSV7_MR_CATALOG: Array<{ code: string; name: string; type: "SFG" | "FG"; uom: string; stock: number }> = [
    { code: GSV7_ITEMS.SFG_LEAD_INGOT.code, name: GSV7_ITEMS.SFG_LEAD_INGOT.name, type: "SFG", uom: "KG", stock: 2200 },
    { code: GSV7_ITEMS.SFG_GRID_CAST.code, name: GSV7_ITEMS.SFG_GRID_CAST.name, type: "SFG", uom: "NOS", stock: 800 },
    { code: GSV7_ITEMS.SFG_GRID_POS_DRY.code, name: GSV7_ITEMS.SFG_GRID_POS_DRY.name, type: "SFG", uom: "NOS", stock: 450 },
    { code: GSV7_ITEMS.SFG_GRID_NEG_DRY.code, name: GSV7_ITEMS.SFG_GRID_NEG_DRY.name, type: "SFG", uom: "NOS", stock: 450 },
    { code: GSV7_ITEMS.SFG_PLASTIC_CASE.code, name: GSV7_ITEMS.SFG_PLASTIC_CASE.name, type: "SFG", uom: "NOS", stock: 120 },
    { code: GSV7_ITEMS.FG_GSV7.code, name: GSV7_ITEMS.FG_GSV7.name, type: "FG", uom: "NOS", stock: 98 },
];

export const MOCK_MR_ITEMS: MasterItem[] = GSV7_MR_CATALOG.map((row, index) => ({
    id: row.code,
    name: row.name,
    type: row.type,
    uom: row.uom,
    availableStock: row.stock,
}));

// ============================================================================
// SHARED MR REQUESTS DATA
// ============================================================================
// This data is shared between Service Center and Inventory modules
// In a real application, this would be stored in a database and accessed via API
// ============================================================================

export let mockMRRequests: MRRequest[] = [
    {
        id: 1,
        mrNo: "MR-GSV7-001",
        date: "2026-05-30",
        requiredByDate: "2026-05-30",
        operation: "Lead Purification",
        workCenter: "Lead Furnace Center",
        warehouse: "Jinja Main WH",
        shift: "Morning",
        requestedBy: "James Okello",
        status: "Received by Production",
        productionPlanId: 3,
        receivedDate: "2026-05-30",
        receivedBy: "James Okello",
        items: [
            {
                id: 1,
                itemCode: GSV7_ITEMS.RM_SCRAP_LEAD.code,
                itemName: GSV7_ITEMS.RM_SCRAP_LEAD.name,
                uom: "KG",
                availableQty: 3000,
                requiredQty: 2500,
                issuedQty: 2500,
                receivedQty: 2500,
            },
        ],
    },
    {
        id: 2,
        mrNo: "MR-GSV7-002",
        date: "2026-05-30",
        requiredByDate: "2026-05-30",
        operation: "GSV7 Assembly",
        workCenter: "Assembly Line",
        warehouse: "Jinja Main WH",
        shift: "Morning",
        requestedBy: "Sarah Nambi",
        status: "Received by Production",
        productionPlanId: 1,
        receivedDate: "2026-05-30",
        receivedBy: "Sarah Nambi",
        items: [
            {
                id: 1,
                itemCode: GSV7_ITEMS.SFG_GRID_POS_DRY.code,
                itemName: GSV7_ITEMS.SFG_GRID_POS_DRY.name,
                uom: "NOS",
                availableQty: 500,
                requiredQty: 100,
                issuedQty: 100,
                receivedQty: 100,
            },
            {
                id: 2,
                itemCode: GSV7_ITEMS.RM_ACID.code,
                itemName: GSV7_ITEMS.RM_ACID.name,
                uom: "LTR",
                availableQty: 200,
                requiredQty: 120,
                issuedQty: 120,
                receivedQty: 120,
            },
        ],
    },
    {
        id: 3,
        mrNo: "MR-GSV7-003",
        date: "2026-05-30",
        requiredByDate: "2026-05-31",
        operation: "Grid Drying",
        workCenter: "Grid Formation Center",
        warehouse: "Jinja Main WH",
        shift: "Night",
        requestedBy: "Peter Musoke",
        status: "Issued by Warehouse",
        productionPlanId: 2,
        issuedDate: "2026-05-30",
        issuedBy: "Warehouse — Jinja",
        items: [
            {
                id: 1,
                itemCode: GSV7_ITEMS.SFG_GRID_POS.code,
                itemName: GSV7_ITEMS.SFG_GRID_POS.name,
                uom: "NOS",
                availableQty: 600,
                requiredQty: 500,
                issuedQty: 500,
                receivedQty: 0,
            },
        ],
    },
    {
        id: 4,
        mrNo: "MR-GSV7-004",
        date: "2026-05-30",
        requiredByDate: "2026-06-02",
        operation: "Grid Casting",
        workCenter: "Grid Casting Center",
        warehouse: "Jinja Main WH",
        shift: "Morning",
        requestedBy: "Grace Achieng",
        status: "Requested to Warehouse",
        productionPlanId: 4,
        items: [
            {
                id: 1,
                itemCode: GSV7_ITEMS.SFG_LEAD_INGOT.code,
                itemName: GSV7_ITEMS.SFG_LEAD_INGOT.name,
                uom: "KG",
                availableQty: 2200,
                requiredQty: 900,
                issuedQty: 0,
                receivedQty: 0,
            },
        ],
    },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the next MR number
 * In a real application, this would be generated by the backend
 */
export const getNextMRNumber = (existingRequests: MRRequest[]): string => {
    const year = new Date().getFullYear();
    const count = existingRequests.length + 1;
    return `MR-${year}-${String(count).padStart(3, '0')}`;
};

/**
 * Add a new MR request to the shared data
 * In a real application, this would be an API call
 */
export const addMRRequest = (request: MRRequest): MRRequest[] => {
    mockMRRequests.unshift(request);
    return [...mockMRRequests];
};

/**
 * Update an existing MR request
 * In a real application, this would be an API call
 */
export const updateMRRequest = (id: number, updates: Partial<MRRequest>): MRRequest[] => {
    const index = mockMRRequests.findIndex(req => req.id === id);
    if (index !== -1) {
        mockMRRequests[index] = { ...mockMRRequests[index], ...updates };
    }
    return [...mockMRRequests];
};

/**
 * Get MR request by ID
 */
export const getMRRequestById = (id: number): MRRequest | undefined => {
    return mockMRRequests.find(req => req.id === id);
};
