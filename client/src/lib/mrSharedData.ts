// ============================================================================
// SHARED MR REQUEST DATA
// ============================================================================
// This file contains shared data and types for MR Requests used by both:
// - Service Center MR Request module (for creating and receiving requests)
// - Inventory MR Request module (for issuing materials)
// - Production My Request module (for linking MRs to Production Plans)
// ============================================================================

import { mockSemiFinishedGoods, mockFinishedGoods } from "./masterMockData";

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
export const MOCK_MR_ITEMS: MasterItem[] = [
    ...mockSemiFinishedGoods.map(item => ({
        id: item.id,
        name: item.name,
        type: "SFG" as const,
        uom: "PCS",
        availableStock: Math.floor(Math.random() * 500) + 50
    })),
    ...mockFinishedGoods.map(item => ({
        id: item.id,
        name: item.name,
        type: "FG" as const,
        uom: "PCS",
        availableStock: Math.floor(Math.random() * 300) + 20
    }))
];

// ============================================================================
// SHARED MR REQUESTS DATA
// ============================================================================
// This data is shared between Service Center and Inventory modules
// In a real application, this would be stored in a database and accessed via API
// ============================================================================

export let mockMRRequests: MRRequest[] = [
    {
        id: 1,
        mrNo: "MR-2024-001",
        date: "2024-02-15",
        requiredByDate: "2024-02-20",
        operation: "Lead Generation & Purification",
        workCenter: "Lead Furnace Center",
        warehouse: "Jinja WH",
        shift: "Morning",
        requestedBy: "John Doe",
        status: "Requested to Warehouse",
        items: [
            { id: 1, itemCode: "RM-001", itemName: "Scrap Battery", uom: "KG", availableQty: 500, requiredQty: 100, issuedQty: 0 },
            { id: 2, itemCode: "RM-002", itemName: "Plastic Pallets", uom: "PCS", availableQty: 200, requiredQty: 50, issuedQty: 0 },
        ]
    },
    {
        id: 2,
        mrNo: "MR-2024-002",
        date: "2024-02-16",
        requiredByDate: "2024-02-21",
        operation: "Grid Creation & Oxidization",
        workCenter: "Grid Generation Center",
        warehouse: "Jinja WH",
        shift: "Night",
        requestedBy: "Jane Smith",
        status: "Requested to Warehouse",
        items: [
            { id: 3, itemCode: "RM-003", itemName: "Acid Type A", uom: "LTR", availableQty: 150, requiredQty: 30, issuedQty: 0 },
        ]
    },
    {
        id: 3,
        mrNo: "MR-2024-003",
        date: "2024-02-14",
        requiredByDate: "2024-02-19",
        operation: "Assembly line & Packaging",
        workCenter: "Assembly Line",
        warehouse: "Jinja WH",
        shift: "Morning",
        requestedBy: "Mike Ross",
        status: "Issued by Warehouse",
        issuedDate: "2024-02-15",
        issuedBy: "Warehouse Manager",
        items: [
            { id: 4, itemCode: "SFG-005", itemName: "Terminals", uom: "NOS", availableQty: 1000, requiredQty: 500, issuedQty: 500 },
        ]
    }
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
