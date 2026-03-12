
// ============================================================================
// SHARED TYPES
// ============================================================================

export type LeadStatus = "New" | "Contacted" | "Qualified" | "Lost" | "Converted";
export type QuotationStatus = "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired";
export type SalesOrderStatus = "Pending" | "Confirmed" | "Shipped" | "Delivered" | "Cancelled";
export type DispatchStatus = "Dispatch Pending" | "Dispatched";

export interface SalesItem {
    id: number;
    itemCode: string;
    itemName: string;
    uom: string;
    quantity: number;
    price: number;
    total: number;
}

export interface LeadData {
    id: number;
    leadCode: string;
    date: string;
    customerName: string;
    contactPerson: string;
    email: string;
    phone: string;
    status: LeadStatus;
    source: string;
    assignedTo: string;
    items: SalesItem[];
    notes?: string;
}

export interface QuotationData {
    id: number;
    quotationCode: string;
    date: string;
    leadCode?: string;
    customerName: string;
    status: QuotationStatus;
    validUntil: string;
    totalAmount: number;
    items: SalesItem[];
    notes?: string;
}

export interface DispatchEntry {
    id: number;
    itemCode: string;
    itemName: string;
    dispatchQty: number;
    dispatchDate: string;
    note: string;
    serialNumbers?: string[];
}

export interface SalesOrderData {
    id: number;
    orderCode: string;
    date: string;
    quotationCode?: string;
    customerName: string;
    shippingAddress: string;
    warehouseName: string;
    status: SalesOrderStatus;
    dispatchStatus: DispatchStatus;
    expectedDelivery: string;
    totalAmount: number;
    items: SOItem[];
    dispatches: DispatchEntry[];
    notes?: string;
}

export interface SOItem extends SalesItem {
    orderedQty: number;
    dispatchedQty: number;
    rate: number; // For Dispatch table columns
}

// ============================================================================
// INITIAL MOCK DATA
// ============================================================================

export const INITIAL_LEADS: LeadData[] = [
    {
        id: 1,
        leadCode: "LD-2026-001",
        date: "2026-02-15",
        customerName: "Acme Corp",
        contactPerson: "John Doe",
        email: "john@acme.com",
        phone: "+1 234 567 890",
        status: "Qualified",
        source: "Website",
        assignedTo: "Sales Rep A",
        items: [
            { id: 101, itemCode: "FG001", itemName: "Finished Battery Pack A", uom: "Pcs", quantity: 100, price: 150, total: 15000 },
        ]
    },
    {
        id: 2,
        leadCode: "LD-2026-002",
        date: "2026-02-20",
        customerName: "Global Industries",
        contactPerson: "Jane Smith",
        email: "jane@global.com",
        phone: "+1 987 654 321",
        status: "New",
        source: "Referral",
        assignedTo: "Sales Rep B",
        items: []
    }
];

export const INITIAL_QUOTATIONS: QuotationData[] = [
    {
        id: 1,
        quotationCode: "QT-2026-001",
        date: "2026-02-16",
        leadCode: "LD-2026-001",
        customerName: "Acme Corp",
        status: "Sent",
        validUntil: "2026-03-16",
        totalAmount: 15000,
        items: [
            { id: 101, itemCode: "FG001", itemName: "Finished Battery Pack A", uom: "Pcs", quantity: 100, price: 150, total: 15000 },
        ]
    }
];

export const INITIAL_SALES_ORDERS: SalesOrderData[] = [
    {
        id: 1,
        orderCode: "SO-2026-001",
        date: "2026-03-01",
        quotationCode: "QT-2026-001",
        customerName: "Acme Corp",
        shippingAddress: "Plot 45, Industrial Area, Kampala",
        warehouseName: "Jinja WH",
        status: "Confirmed",
        dispatchStatus: "Dispatch Pending",
        expectedDelivery: "2026-03-10",
        totalAmount: 12450,
        items: [
            { id: 101, itemCode: "FG001", itemName: "Finished Battery Pack A", uom: "Pcs", quantity: 83, price: 150, total: 12450, orderedQty: 83, dispatchedQty: 0, rate: 150 },
        ],
        dispatches: []
    },
    {
        id: 2,
        orderCode: "SO-2026-002",
        date: "2026-03-02",
        customerName: "Global Industries",
        shippingAddress: "Street 7, Kampala",
        warehouseName: "Jinja WH",
        status: "Confirmed",
        dispatchStatus: "Dispatched",
        expectedDelivery: "2026-03-08",
        totalAmount: 5000,
        items: [
            { id: 102, itemCode: "FG002", itemName: "Finished Battery Pack B", uom: "Pcs", quantity: 50, price: 100, total: 5000, orderedQty: 50, dispatchedQty: 50, rate: 100 },
        ],
        dispatches: [
            { id: 1, itemCode: "FG002", itemName: "Finished Battery Pack B", dispatchQty: 50, dispatchDate: "2026-03-04", note: "Full dispatch" }
        ]
    }
];

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

const LEADS_STORAGE_KEY = "erp_mock_leads";
const QUOTATIONS_STORAGE_KEY = "erp_mock_quotations";
const SALES_ORDERS_STORAGE_KEY = "erp_mock_sales_orders";

export const getStoredLeads = (): LeadData[] => {
    if (typeof window === "undefined") return INITIAL_LEADS;
    const stored = localStorage.getItem(LEADS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : INITIAL_LEADS;
};

export const saveLeads = (leads: LeadData[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
};

export const getStoredQuotations = (): QuotationData[] => {
    if (typeof window === "undefined") return INITIAL_QUOTATIONS;
    const stored = localStorage.getItem(QUOTATIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : INITIAL_QUOTATIONS;
};

export const saveQuotations = (quotations: QuotationData[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(QUOTATIONS_STORAGE_KEY, JSON.stringify(quotations));
};

export const getStoredSalesOrders = (): SalesOrderData[] => {
    if (typeof window === "undefined") return INITIAL_SALES_ORDERS;
    const stored = localStorage.getItem(SALES_ORDERS_STORAGE_KEY);
    if (!stored) return INITIAL_SALES_ORDERS;

    try {
        const orders: SalesOrderData[] = JSON.parse(stored);

        // Data Migration: Ensure status names match the latest requirements
        let needsUpdate = false;
        const migratedOrders = orders.map(order => {
            let updatedStatus = order.dispatchStatus;

            // Migrate "dispatch Pending" or "Pending Dispatch" to "Dispatch Pending"
            if (updatedStatus === ("dispatch Pending" as any) || updatedStatus === ("Pending Dispatch" as any)) {
                updatedStatus = "Dispatch Pending";
                needsUpdate = true;
            }

            // Migrate "Dispatch" to "Dispatched"
            if (updatedStatus === ("Dispatch" as any)) {
                updatedStatus = "Dispatched";
                needsUpdate = true;
            }

            return { ...order, dispatchStatus: updatedStatus };
        });

        if (needsUpdate) {
            saveSalesOrders(migratedOrders);
            return migratedOrders;
        }

        return orders;
    } catch (e) {
        console.error("Error parsing stored sales orders:", e);
        return INITIAL_SALES_ORDERS;
    }
};

export const saveSalesOrders = (orders: SalesOrderData[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SALES_ORDERS_STORAGE_KEY, JSON.stringify(orders));
};
