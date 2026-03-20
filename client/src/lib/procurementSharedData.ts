import { format } from "date-fns";

// ============================================================================
// SHARED TYPES
// ============================================================================

export type MRStatus = "Requested MR" | "MR in Fullfillment" | "FullFilled MR" | "MR Closed";
export type POStatus = "Draft PO" | "Submitted PO" | "Partially Completed PO" | "Completed PO";

export interface Quotation {
    id: number;
    vendorName: string;
    note?: string;
    attachmentName?: string;
}

export interface ReceptionEntry {
    id: number;
    itemCode: string;
    itemName: string;
    receivedQty: number;
    deliveryDate: string;
    note: string;
    attachmentName?: string;
}

export interface MRItem {
    id: number;
    itemCode: string;
    itemName: string;
    uom: string;
    type: "RM" | "Consumable";
    requiredQty: number | string;
    availableQty: number;
    quotations: Quotation[];
    poNumber?: string;
    price?: number | string;
    deliveryDate?: string;
    qtyReceived: number;
}

export interface MRRequestData {
    id: number;
    mrCode: string;
    mrDate: string;
    location: string;
    workCenter: string;
    department: string;
    status: MRStatus;
    requestedBy: string;
    items: MRItem[];
    quotations?: Quotation[];
}

export interface POData {
    id: number;
    poNumber: string;
    poDate: string;
    mrCode: string;
    location: string;
    department: string;
    workCenter: string;
    createdBy: string;
    vendorName: string;
    warehouseName: string;
    paymentTerms: string;
    items: MRItem[];
    status: POStatus;
    receptions: ReceptionEntry[];
    notes?: string;
}

// ============================================================================
// INITIAL MOCK DATA
// ============================================================================

export const INITIAL_MR_REQUESTS: MRRequestData[] = [
    {
        id: 1,
        mrCode: "MR-2024-001",
        mrDate: "15-02-2024",
        location: "Jinja",
        workCenter: "Lead Furnace Center",
        department: "Production",
        status: "Requested MR",
        requestedBy: "Admin User",
        items: [
            { id: 101, itemCode: "RM001", itemName: "Scrap Battery", uom: "Kg", type: "RM", requiredQty: 100, availableQty: 500, quotations: [], qtyReceived: 0 },
            { id: 102, itemCode: "RM003", itemName: "Acid Type A", uom: "Ltr", type: "RM", requiredQty: 50, availableQty: 150, quotations: [], qtyReceived: 0 },
        ]
    },
    {
        id: 2,
        mrCode: "MR-2024-002",
        mrDate: "20-02-2024",
        location: "Kampala",
        workCenter: "Grid Generation Center",
        department: "Production",
        status: "MR in Fullfillment",
        requestedBy: "Admin User",
        items: [
            { id: 103, itemCode: "RM002", itemName: "Plastic Pallets", uom: "Pcs", type: "RM", requiredQty: 30, availableQty: 200, quotations: [{ id: 1, vendorName: "Plastic Suppliers Ltd", attachmentName: "quote.pdf" }], poNumber: "PO-2024-001", qtyReceived: 0 },
        ]
    },
    {
        id: 3,
        mrCode: "MR-2024-003",
        mrDate: "22-02-2024",
        location: "Jinja",
        workCenter: "Assembly Line",
        department: "Production",
        status: "Requested MR",
        requestedBy: "Admin User",
        items: [
            { id: 104, itemCode: "CON001", itemName: "Safety Gloves", uom: "Pair", type: "Consumable", requiredQty: 50, availableQty: 300, quotations: [], qtyReceived: 0 },
            { id: 105, itemCode: "CON002", itemName: "Welding Wire", uom: "Kg", type: "Consumable", requiredQty: 20, availableQty: 80, quotations: [], qtyReceived: 0 },
        ]
    },
    {
        id: 4,
        mrCode: "MR-2024-004",
        mrDate: "25-02-2024",
        location: "Jinja",
        workCenter: "Lead Furnace Center",
        department: "Production",
        status: "FullFilled MR",
        requestedBy: "Admin User",
        items: [
            { id: 106, itemCode: "RM001", itemName: "Scrap Battery", uom: "Kg", type: "RM", requiredQty: 200, availableQty: 500, quotations: [], poNumber: "PO-2024-006", qtyReceived: 200 },
        ]
    },
    {
        id: 5,
        mrCode: "MR-2024-005",
        mrDate: "26-02-2024",
        location: "Kampala",
        workCenter: "Grid Generation Center",
        department: "Production",
        status: "MR Closed",
        requestedBy: "Admin User",
        items: [
            { id: 107, itemCode: "RM002", itemName: "Plastic Pallets", uom: "Pcs", type: "RM", requiredQty: 10, availableQty: 200, quotations: [], qtyReceived: 0 },
        ]
    }
];

export const INITIAL_POS: POData[] = [
    {
        id: 1,
        poNumber: "PO-2024-001",
        poDate: "16-02-2024",
        mrCode: "MR-2024-002",
        location: "Kampala",
        department: "Production",
        workCenter: "Grid Generation Center",
        createdBy: "Admin User",
        vendorName: "Plastic Suppliers Ltd",
        warehouseName: "Jinja WH",
        paymentTerms: "Net 30",
        status: "Submitted PO",
        receptions: [],
        items: [
            { id: 103, itemCode: "RM002", itemName: "Plastic Pallets", uom: "Pcs", type: "RM", requiredQty: 30, availableQty: 200, quotations: [], qtyReceived: 0, price: 5, deliveryDate: "01-03-2024" },
        ]
    },
    {
        id: 2,
        poNumber: "PO-2024-002",
        poDate: "17-02-2024",
        mrCode: "MR-2024-001",
        location: "Jinja",
        department: "Production",
        workCenter: "Lead Furnace Center",
        createdBy: "Admin User",
        vendorName: "Battery Recyclers Inc",
        warehouseName: "Jinja WH",
        paymentTerms: "Advance",
        status: "Draft PO",
        receptions: [],
        items: [
            { id: 101, itemCode: "RM001", itemName: "Scrap Battery", uom: "Kg", type: "RM", requiredQty: 100, availableQty: 500, quotations: [], qtyReceived: 0 },
        ]
    },
    {
        id: 3,
        poNumber: "PO-2024-003",
        poDate: "18-02-2024",
        mrCode: "MR-2024-001",
        location: "Jinja",
        department: "Production",
        workCenter: "Lead Furnace Center",
        createdBy: "Admin User",
        vendorName: "Chemical Suppliers Co",
        warehouseName: "Jinja WH",
        paymentTerms: "Net 15",
        status: "Submitted PO",
        receptions: [],
        items: [
            { id: 102, itemCode: "RM003", itemName: "Acid Type A", uom: "Ltr", type: "RM", requiredQty: 50, availableQty: 150, quotations: [], price: 25.5, deliveryDate: "01-03-2024", qtyReceived: 0 },
        ]
    },
    {
        id: 5,
        poNumber: "PO-2024-005",
        poDate: "20-02-2024",
        mrCode: "MR-2024-003",
        location: "Jinja",
        department: "Production",
        workCenter: "Assembly Line",
        createdBy: "Admin User",
        vendorName: "Welding Supplies Inc",
        warehouseName: "Jinja WH",
        paymentTerms: "Net 30",
        status: "Partially Completed PO",
        items: [
            { id: 105, itemCode: "CON002", itemName: "Welding Wire", uom: "Kg", type: "Consumable", requiredQty: 20, availableQty: 80, quotations: [], price: 15.0, deliveryDate: "28-02-2024", qtyReceived: 10 },
        ],
        receptions: [
            { id: 1, itemCode: "CON002", itemName: "Welding Wire", receivedQty: 10, deliveryDate: "27-02-2024", note: "Partial delivery", attachmentName: "wire_note.pdf" }
        ]
    },
    {
        id: 6,
        poNumber: "PO-2024-006",
        poDate: "10-02-2024",
        mrCode: "MR-2023-099",
        location: "Kampala",
        department: "Production",
        workCenter: "Plastic Casing Center",
        createdBy: "Admin User",
        vendorName: "Plastic Suppliers Ltd",
        warehouseName: "Jinja WH",
        paymentTerms: "Net 45",
        status: "Completed PO",
        receptions: [
            { id: 2, itemCode: "RM002", itemName: "Plastic Pallets", receivedQty: 100, deliveryDate: "15-02-2024", note: "Full reception" }
        ],
        items: [
            { id: 106, itemCode: "RM002", itemName: "Plastic Pallets", uom: "Pcs", type: "RM", requiredQty: 100, availableQty: 200, quotations: [], price: 8.5, deliveryDate: "15-02-2024", qtyReceived: 100 },
        ]
    },
    {
        id: 7,
        poNumber: "PO-2024-007",
        poDate: "21-02-2024",
        mrCode: "MR-2024-001",
        location: "Jinja",
        department: "Production",
        workCenter: "Lead Furnace Center",
        createdBy: "Admin User",
        vendorName: "Battery Recyclers Inc",
        warehouseName: "Jinja WH",
        paymentTerms: "Net 30",
        status: "Partially Completed PO",
        receptions: [
            { id: 3, itemCode: "RM001", itemName: "Scrap Battery", receivedQty: 30, deliveryDate: "02-03-2024", note: "Initial load" }
        ],
        items: [
            { id: 101, itemCode: "RM001", itemName: "Scrap Battery", uom: "Kg", type: "RM", requiredQty: 50, availableQty: 500, quotations: [], price: 12.0, deliveryDate: "05-03-2024", qtyReceived: 30 },
        ]
    },
    {
        id: 8,
        poNumber: "PO-2023-095",
        poDate: "05-02-2024",
        mrCode: "MR-2023-095",
        location: "Jinja",
        department: "Production",
        workCenter: "Lead Furnace Center",
        createdBy: "Admin User",
        vendorName: "Battery Recyclers Inc",
        warehouseName: "Jinja WH",
        paymentTerms: "Net 30",
        status: "Completed PO",
        receptions: [
            { id: 4, itemCode: "RM001", itemName: "Scrap Battery", receivedQty: 200, deliveryDate: "12-02-2024", note: "Received fully" }
        ],
        items: [
            { id: 107, itemCode: "RM001", itemName: "Scrap Battery", uom: "Kg", type: "RM", requiredQty: 200, availableQty: 500, quotations: [], price: 12.0, deliveryDate: "12-02-2024", qtyReceived: 200 },
        ]
    }
];

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

const MR_STORAGE_KEY = "erp_mock_mrs";
const PO_STORAGE_KEY = "erp_mock_pos";

export const getStoredMRs = (): MRRequestData[] => {
    if (typeof window === "undefined") return INITIAL_MR_REQUESTS;
    const stored = localStorage.getItem(MR_STORAGE_KEY);
    return stored ? JSON.parse(stored) : INITIAL_MR_REQUESTS;
};

export const saveMRs = (mrs: MRRequestData[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(MR_STORAGE_KEY, JSON.stringify(mrs));
};

export const getStoredPOs = (): POData[] => {
    if (typeof window === "undefined") return INITIAL_POS;
    const stored = localStorage.getItem(PO_STORAGE_KEY);
    return stored ? JSON.parse(stored) : INITIAL_POS;
};

export const savePOs = (pos: POData[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(PO_STORAGE_KEY, JSON.stringify(pos));
};

export const clearMockData = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(MR_STORAGE_KEY);
    localStorage.removeItem(PO_STORAGE_KEY);
};
