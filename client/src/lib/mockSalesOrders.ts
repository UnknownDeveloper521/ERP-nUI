import { mockCustomers, mockFinishedGoods, mockLocations, mockWarehouses } from "./masterMockData";

export type SOStatus = "Draft" | "Invoice Pending" | "Dispatch Pending" | "Dispatched" | "Closed SO";

export interface SOItem {
    id: number;
    itemCode: string;
    itemName: string;
    uom: string;
    orderedQty: number | string;
    dispatchedQty: number;
    rate: number | string;
    price: number;
}

// Payment Term interface - valueType removed, only value field remains
export interface PaymentTerm {
    id: number;
    value: number; // The actual value (can be percentage 0-100 or fixed amount >= 0)
    percentage: number; // Deprecated: kept for backward compatibility, use value instead
    termType: "Advance" | "Delivery" | "Days";
    date: string;
    days?: number;
    note?: string;
    isGenerated?: boolean; // Track if an invoice has been generated for this term
    invoiceNo?: string;    // Store the generated invoice number
    invoiceDate?: string;  // Store the generated invoice date
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

export interface SOData {
    id: number;
    soNumber: string;
    soDate: string;
    quotationRef?: string;
    invoiceRef?: string; // Reference to the generated invoice
    customerName: string;
    contactPerson: string;
    mobileNo?: string;
    shippingAddress: string;
    billingAddress: string;
    deliveryDate: string;
    location?: string;
    warehouse?: string;
    currency: string;
    remarks: string;
    terms: PaymentTerm[];
    items: SOItem[];
    dispatches: DispatchEntry[];
    discountValue?: number;
    discountType?: "%" | "Amount";
    taxType?: "%" | "Amount"; // Tax type - percentage or fixed amount
    taxValue?: number; // Tax value based on taxType
    taxPercentage?: number; // Deprecated: kept for backward compatibility
    status: SOStatus;
    // Payment tracking fields
    invoiceDueAmount?: number; // Remaining amount to be paid
    paymentStatus?: "Pending" | "Partial" | "Completed"; // Payment status
}

// ============================================================================
// IN-MEMORY DATA STORE - SESSION ONLY (RESETS ON REFRESH)
// Clean dataset with maximum 2 records per status for testing/demo
// All changes (create, edit, delete, status, dispatch) work only in current session
// Page refresh reloads these default records
// ============================================================================

const DEFAULT_SALES_ORDERS: SOData[] = [
    // ========== DRAFT STATUS (1 record) ==========
    {
        id: 1,
        soNumber: "SO-2026-001",
        soDate: "2026-03-05",
        quotationRef: "QT-2026-001",
        customerName: mockCustomers[0].name, // "Acme Corp"
        contactPerson: mockCustomers[0].contactPerson,
        mobileNo: mockCustomers[0].mobileNo,
        shippingAddress: mockCustomers[0].shippingAddress,
        billingAddress: mockCustomers[0].billingAddress,
        deliveryDate: "2026-03-20",
        location: mockLocations[0].name,
        warehouse: mockWarehouses[0].name,
        currency: "UGX",
        remarks: "Initial order - standard delivery terms",
        terms: [
            { id: 1, value: 30, percentage: 30, termType: "Advance", date: "2026-03-05", note: "30% advance on order confirmation" },
            { id: 2, value: 70, percentage: 70, termType: "Delivery", date: "", note: "70% balance on delivery" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[0].id, itemName: mockFinishedGoods[0].name, uom: "PCS", orderedQty: 10, dispatchedQty: 0, rate: 1200.00, price: 12000.00 },
            { id: 2, itemCode: mockFinishedGoods[1].id, itemName: mockFinishedGoods[1].name, uom: "PCS", orderedQty: 20, dispatchedQty: 0, rate: 450.00, price: 9000.00 }
        ],
        dispatches: [],
        discountValue: 5,
        discountType: "%",
        taxType: "%",
        taxValue: 18,
        taxPercentage: 18,
        status: "Draft",
        invoiceDueAmount: 0,
        paymentStatus: "Pending"
    },

    // ========== SUBMITTED STATUS (1 record) ==========
    {
        id: 2,
        soNumber: "SO-2026-002",
        soDate: "2026-03-06",
        quotationRef: "QT-2026-002",
        customerName: mockCustomers[1].name, // "TechStart Inc"
        contactPerson: mockCustomers[1].contactPerson,
        mobileNo: mockCustomers[1].mobileNo,
        shippingAddress: mockCustomers[1].shippingAddress,
        billingAddress: mockCustomers[1].billingAddress,
        deliveryDate: "2026-03-25",
        location: mockLocations[0].name,
        warehouse: mockWarehouses[0].name,
        currency: "UGX",
        remarks: "Urgent order - expedited shipping required",
        terms: [
            { id: 1, value: 40, percentage: 40, termType: "Advance", date: "2026-03-06", note: "40% advance payment" },
            { id: 2, value: 30, percentage: 30, termType: "Days", date: "", days: 30, note: "30% within 30 days from invoice" },
            { id: 3, value: 30, percentage: 30, termType: "Delivery", date: "", note: "30% on delivery" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[2].id, itemName: mockFinishedGoods[2].name, uom: "PCS", orderedQty: 15, dispatchedQty: 0, rate: 850.00, price: 12750.00 },
            { id: 2, itemCode: mockFinishedGoods[3].id, itemName: mockFinishedGoods[3].name, uom: "PCS", orderedQty: 30, dispatchedQty: 0, rate: 125.00, price: 3750.00 }
        ],
        dispatches: [],
        discountValue: 500,
        discountType: "Amount",
        taxType: "%",
        taxValue: 18,
        taxPercentage: 18,
        status: "Draft",
        invoiceDueAmount: 0,
        paymentStatus: "Pending"
    },

    // ========== DISPATCH PENDING STATUS (1 record) ==========
    {
        id: 3,
        soNumber: "SO-2026-003",
        soDate: "2026-03-08",
        quotationRef: "QT-2026-003",
        customerName: mockCustomers[3].name, // "Innovate Ltd"
        contactPerson: mockCustomers[3].contactPerson,
        mobileNo: mockCustomers[3].mobileNo,
        shippingAddress: mockCustomers[3].shippingAddress,
        billingAddress: mockCustomers[3].billingAddress,
        deliveryDate: "2026-03-10",
        location: mockLocations[0].name,
        warehouse: mockWarehouses[0].name,
        currency: "UGX",
        remarks: "Ready for dispatch - priority order",
        terms: [
            { id: 1, value: 50, percentage: 50, termType: "Advance", date: "2026-03-08", note: "50% advance payment received" },
            { id: 2, value: 50, percentage: 50, termType: "Delivery", date: "", note: "50% on delivery" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[0].id, itemName: mockFinishedGoods[0].name, uom: "PCS", orderedQty: 100, dispatchedQty: 0, rate: 1200.00, price: 120000.00 },
            { id: 2, itemCode: mockFinishedGoods[1].id, itemName: mockFinishedGoods[1].name, uom: "PCS", orderedQty: 50, dispatchedQty: 0, rate: 450.00, price: 22500.00 },
            { id: 3, itemCode: mockFinishedGoods[2].id, itemName: mockFinishedGoods[2].name, uom: "PCS", orderedQty: 75, dispatchedQty: 0, rate: 850.00, price: 63750.00 }
        ],
        dispatches: [],
        discountValue: 10,
        discountType: "%",
        taxType: "%",
        taxValue: 18,
        taxPercentage: 18,
        status: "Dispatch Pending",
        invoiceDueAmount: 0,
        paymentStatus: "Pending"
    }
];

// In-memory state - resets on page refresh
let mockSalesOrders: SOData[] = [...DEFAULT_SALES_ORDERS];

// ============================================================================
// SERVICE FUNCTIONS - SESSION ONLY (NO PERSISTENCE)
// ============================================================================

export const getSalesOrders = (): SOData[] => {
    return [...mockSalesOrders];
};

export const getSalesOrderById = (id: number): SOData | undefined => {
    return mockSalesOrders.find(so => so.id === id);
};

export const createSalesOrder = (payload: Omit<SOData, 'id'>): SOData => {
    const newSO: SOData = {
        ...payload,
        id: Math.max(...mockSalesOrders.map(so => so.id), 0) + 1,
        dispatches: payload.dispatches || []
    };
    mockSalesOrders.push(newSO);
    return newSO;
};

export const updateSalesOrder = (id: number, payload: Partial<SOData>): SOData | null => {
    const index = mockSalesOrders.findIndex(so => so.id === id);
    if (index === -1) return null;

    mockSalesOrders[index] = { ...mockSalesOrders[index], ...payload };
    return mockSalesOrders[index];
};

export const deleteSalesOrder = (id: number): boolean => {
    const index = mockSalesOrders.findIndex(so => so.id === id);
    if (index === -1) return false;

    mockSalesOrders.splice(index, 1);
    return true;
};

export const changeSOStatus = (id: number, status: SOStatus): SOData | null => {
    return updateSalesOrder(id, { status });
};

// Close Sales Order - Only allowed when status is Dispatched and payment is completed
export const closeSalesOrder = (id: number): { success: boolean; message: string; so?: SOData } => {
    const so = mockSalesOrders.find(s => s.id === id);
    
    if (!so) {
        return { success: false, message: "Sales Order not found" };
    }
    
    // Validation: Must be Dispatched
    if (so.status !== "Dispatched") {
        return { success: false, message: "Sales Order must be in Dispatched status to close" };
    }
    
    // Validation: Payment must be completed (due amount = 0)
    const dueAmount = so.invoiceDueAmount ?? 0;
    if (dueAmount > 0) {
        return { success: false, message: `Cannot close SO. Pending payment: ${so.currency} ${dueAmount.toFixed(2)}` };
    }
    
    // Close the SO
    const updatedSO = updateSalesOrder(id, { status: "Closed SO" });
    
    if (updatedSO) {
        return { success: true, message: "Sales Order closed successfully", so: updatedSO };
    }
    
    return { success: false, message: "Failed to close Sales Order" };
};

// Check if all terms are generated and move to Dispatch Pending status
export const checkAndMoveToDispatchPending = (id: number): SOData | null => {
    const so = mockSalesOrders.find(s => s.id === id);
    if (!so) return null;

    // Check if all terms are generated
    const allGenerated = so.terms.every(term => term.isGenerated);

    if (allGenerated && (so.status === "Draft" || so.status === "Invoice Pending")) {
        return updateSalesOrder(id, { status: "Dispatch Pending" });
    }

    return so;
};
