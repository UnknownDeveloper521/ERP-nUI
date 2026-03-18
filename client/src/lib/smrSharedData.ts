// ============================================================================
// SHARED SMR REQUEST DATA
// ============================================================================
// This file contains shared data and types for SMR Requests used by both:
// - Service Center SMR Request module (for creating and receiving requests)
// - Inventory SMR Request module (for issuing materials)
// ============================================================================

import { mockSemiFinishedGoods, mockFinishedGoods, mockWorkCenters as masterWorkCenters, mockDepartments as masterDepartments } from "./masterMockData";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type SMRStatus = "Draft Req." | "Requested Req." | "Issued Req. by WH" | "Received Req. by SC";

// SMR Item in the request
export interface SMRItem {
    id: number | string;
    itemCode: string;
    itemName: string;
    uom: string;
    type: "SFG" | "FG";
    availableStock: number;
    qtyNeeded: number;
    requestedQty?: number; // For issued/received views
    issueQty?: number; // For issued/received views
    serialNumbers?: string[];
}

// SMR Request data structure
export interface SMRRequest {
    id: number;
    smrNo: string;
    smrRequestDate: string;
    location: string;
    workCenter: string;
    department: string;
    requestedBy?: string;
    status: SMRStatus;
    issuedDate?: string;
    issuedBy?: string;
    receivedDate?: string;
    receivedBy?: string;
    items: SMRItem[];
}

// Master item from inventory
export interface MasterItem {
    id: string;
    itemCode: string;
    name: string;
    type: "SFG" | "FG";
    uom: string;
    availableStock: number;
}

// ============================================================================
// MOCK DATA
// ============================================================================

// Derived from master mock data to maintain compatibility with string-based fields
export const mockWorkCenters = masterWorkCenters.map(wc => wc.name);
export const mockDepartments = masterDepartments.map(dept => dept.name);

// Combine SFG and FG items with additional properties for SMR
export const MOCK_SMR_ITEMS: MasterItem[] = [
    ...mockSemiFinishedGoods.map((item, idx) => ({
        id: item.id,
        itemCode: `SFG-${String(idx + 1).padStart(3, '0')}`,
        name: item.name,
        type: "SFG" as const,
        uom: "PCS",
        availableStock: Math.floor(Math.random() * 500) + 50
    })),
    ...mockFinishedGoods.map((item, idx) => ({
        id: item.id,
        itemCode: `FG-${String(idx + 1).padStart(3, '0')}`,
        name: item.name,
        type: "FG" as const,
        uom: "PCS",
        availableStock: Math.floor(Math.random() * 300) + 20
    }))
];

// ============================================================================
// SHARED SMR REQUESTS DATA
// ============================================================================
// This data is shared between Service Center and Inventory modules
// In a real application, this would be stored in a database and accessed via API
// ============================================================================

export const mockSMRRequests: SMRRequest[] = [
    {
        id: 1,
        smrNo: "SMR-2026-001",
        smrRequestDate: "01-03-2026",
        location: "Jinja",
        workCenter: "Assembly Line",
        department: "Service Center",
        requestedBy: "John Doe",
        status: "Draft Req.",
        items: [
            { id: 1, itemCode: "SFG-001", itemName: "Purified Lead", uom: "KG", type: "SFG", availableStock: 500, qtyNeeded: 100 },
            { id: 2, itemCode: "SFG-002", itemName: "Battery Cases", uom: "PCS", type: "SFG", availableStock: 200, qtyNeeded: 50 },
        ]
    },
    {
        id: 2,
        smrNo: "SMR-2026-002",
        smrRequestDate: "02-03-2026",
        location: "Kampala",
        workCenter: "Service Center",
        department: "Warranty Service",
        requestedBy: "Jane Smith",
        status: "Requested Req.",
        items: [
            { id: 3, itemCode: "SFG-005", itemName: "Terminals", uom: "NOS", type: "SFG", availableStock: 1000, qtyNeeded: 200 },
        ]
    },
    {
        id: 3,
        smrNo: "SMR-2026-003",
        smrRequestDate: "03-03-2026",
        location: "Jinja",
        workCenter: "Grid Generation Center",
        department: "Technical Support",
        requestedBy: "Mike Johnson",
        status: "Issued Req. by WH",
        issuedDate: "2026-03-04",
        issuedBy: "Warehouse Manager",
        items: [
            { id: 4, itemCode: "FG-001", itemName: "GSV 7", uom: "PCS", type: "FG", availableStock: 50, qtyNeeded: 10, requestedQty: 10, issueQty: 10 },
            { id: 5, itemCode: "SFG-004", itemName: "Separators", uom: "PCS", type: "SFG", availableStock: 300, qtyNeeded: 150, requestedQty: 150, issueQty: 150 },
        ]
    },
    {
        id: 4,
        smrNo: "SMR-2026-004",
        smrRequestDate: "28-02-2026",
        location: "Kampala",
        workCenter: "Plastic Casing Center",
        department: "Service Center",
        requestedBy: "Sarah Williams",
        status: "Received Req. by SC",
        issuedDate: "2026-03-01",
        issuedBy: "Warehouse Manager",
        receivedDate: "02-03-2026",
        receivedBy: "Service Center Manager",
        items: [
            { id: 6, itemCode: "FG-002", itemName: "GSV 8", uom: "PCS", type: "FG", availableStock: 40, qtyNeeded: 5, requestedQty: 5, issueQty: 5 },
        ]
    },
    {
        id: 5,
        smrNo: "SMR-2026-005",
        smrRequestDate: "07-03-2026",
        location: "Kampala",
        workCenter: "",
        department: "Service Center",
        requestedBy: "Current User",
        status: "Requested Req.",
        items: [
            { id: 7, itemCode: "SFG-002", itemName: "Battery Cases", uom: "PCS", type: "SFG", availableStock: 99, qtyNeeded: 100 },
        ]
    }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the next SMR number
 * In a real application, this would be generated by the backend
 */
export const getNextSMRNumber = (existingRequests: SMRRequest[]): string => {
    const year = new Date().getFullYear();
    const count = existingRequests.length + 1;
    return `SMR-${year}-${String(count).padStart(3, '0')}`;
};

/**
 * Add a new SMR request to the shared data
 * In a real application, this would be an API call
 */
export const addSMRRequest = (request: SMRRequest): SMRRequest[] => {
    mockSMRRequests.unshift(request);
    return [...mockSMRRequests];
};

/**
 * Update an existing SMR request
 * In a real application, this would be an API call
 */
export const updateSMRRequest = (id: number, updates: Partial<SMRRequest>): SMRRequest[] => {
    const index = mockSMRRequests.findIndex(req => req.id === id);
    if (index !== -1) {
        mockSMRRequests[index] = { ...mockSMRRequests[index], ...updates };
    }
    return [...mockSMRRequests];
};

/**
 * Delete an SMR request from shared data
 */
export const deleteSMRRequest = (id: number): SMRRequest[] => {
    const index = mockSMRRequests.findIndex(req => req.id === id);
    if (index !== -1) {
        mockSMRRequests.splice(index, 1);
    }
    return [...mockSMRRequests];
};
