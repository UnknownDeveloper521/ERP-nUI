import { mockCustomers, mockFinishedGoods } from "./masterMockData";
import { SOData } from "./mockSalesOrders";

// Invoice Status: Invoice Pending → Invoiced → Paid
export type InvoiceStatus = "Draft" | "Open" | "Partially Paid" | "Closed" | "Overdue" | "Cancelled";

export interface InvoiceItem {
    id: number;
    itemCode: string;
    itemName: string;
    uom: string;
    orderedQty: number;
    rate: number;
    price: number;
}

export interface InvoiceTerm {
    id: number;
    value?: number;
    percentage: number; // Deprecated: kept for backward compatibility
    termType: string;
    date: string;
    days?: number;
    note?: string;
    isGenerated?: boolean;
    invoiceNo?: string;
    invoiceDate?: string;
}

export interface InvoiceData {
    id: number;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate?: string;
    soNumber: string;
    soDate: string;
    termId?: number; // Added to link the invoice entry to a specific payment term
    customerId?: string; // Changed to string to match mockCustomers[i].id
    customerName: string;
    contactPerson: string;
    mobileNo?: string;
    shippingAddress: string;
    billingAddress: string;
    deliveryDate: string;
    currency: string;
    currencySymbol: string;
    remarks: string;
    terms: InvoiceTerm[];
    items: InvoiceItem[];
    // Discount fields
    discountValue?: number; // Discount value (percentage 0-100 or fixed amount)
    discountType?: "%" | "Amount"; // Discount type
    discountAmount?: number; // Calculated discount amount
    // Tax and totals
    subtotal: number;
    tax: number;
    taxType?: "%" | "Amount"; // Tax type - percentage or fixed amount
    taxValue?: number; // Tax value based on taxType
    taxPercentage: number; // Deprecated: kept for backward compatibility
    grandTotal: number;
    status: InvoiceStatus;
}

// ============================================================================
// IN-MEMORY DATA STORE - SESSION ONLY (RESETS ON REFRESH)
// Clean dataset with maximum 2 records per status for testing/demo
// All changes (create, edit, delete, status) work only in current session
// Page refresh reloads these default records
// ============================================================================

const DEFAULT_INVOICES: InvoiceData[] = [
    // ========== DRAFT STATUS (2 records) ==========
    {
        id: 1,
        invoiceNumber: "INV-2026-001",
        invoiceDate: "2026-02-28",
        dueDate: "2026-03-15",
        soNumber: "SO-2026-001",
        soDate: "2026-03-05",
        customerId: mockCustomers[0].id,
        customerName: mockCustomers[0].name, // "Acme Corp"
        contactPerson: mockCustomers[0].contactPerson,
        mobileNo: mockCustomers[0].mobileNo,
        shippingAddress: mockCustomers[0].shippingAddress,
        billingAddress: mockCustomers[0].billingAddress,
        deliveryDate: "2026-03-15",
        currency: "USh",
        currencySymbol: "USh",
        remarks: "Invoice generated - ready for dispatch",
        terms: [
            { id: 1, percentage: 30, termType: "Advance", date: "2026-02-28", note: "30% advance" },
            { id: 2, percentage: 70, termType: "Delivery", date: "", note: "70% on delivery" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[0].id, itemName: mockFinishedGoods[0].name, uom: "PCS", orderedQty: 10, rate: 1200.00, price: 12000.00 },
            { id: 2, itemCode: mockFinishedGoods[1].id, itemName: mockFinishedGoods[1].name, uom: "PCS", orderedQty: 20, rate: 450.00, price: 9000.00 }
        ],
        subtotal: 21000.00,
        discountValue: 5,
        discountType: "%",
        discountAmount: 1050.00,
        tax: 3591.00,
        taxPercentage: 18,
        grandTotal: 23541.00,
        status: "Draft"
    },

    {
        id: 7,
        invoiceNumber: "INV-2026-007",
        invoiceDate: "2026-03-02",
        dueDate: "2026-03-17",
        soNumber: "SO-2026-007",
        soDate: "2026-03-01",
        customerId: mockCustomers[2]?.id || "cust-3",
        customerName: mockCustomers[2]?.name || "Global Trade",
        contactPerson: mockCustomers[2]?.contactPerson || "Sarah Johnson",
        mobileNo: mockCustomers[2]?.mobileNo || "555-0123",
        shippingAddress: mockCustomers[2]?.shippingAddress || "789 Commerce Ave",
        billingAddress: mockCustomers[2]?.billingAddress || "789 Commerce Ave",
        deliveryDate: "2026-03-17",
        currency: "USh",
        currencySymbol: "USh",
        remarks: "Draft invoice - pending review",
        terms: [
            { id: 1, percentage: 50, termType: "Advance", date: "2026-03-02", note: "50% advance payment" },
            { id: 2, percentage: 50, termType: "Delivery", date: "", note: "50% on delivery" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[3]?.id || "FG004", itemName: mockFinishedGoods[3]?.name || "Product D", uom: "PCS", orderedQty: 8, rate: 750.00, price: 6000.00 }
        ],
        subtotal: 6000.00,
        discountValue: 2,
        discountType: "%",
        discountAmount: 120.00,
        tax: 1058.40,
        taxPercentage: 18,
        grandTotal: 6938.40,
        status: "Draft"
    },

    // ========== INVOICED STATUS (1 record) ==========
    {
        id: 2,
        invoiceNumber: "INV-2026-002",
        invoiceDate: "2026-02-27",
        dueDate: "2026-04-27",
        soNumber: "SO-2026-002",
        soDate: "2026-03-06",
        customerId: mockCustomers[1].id,
        customerName: mockCustomers[1].name, // "TechStart Inc"
        contactPerson: mockCustomers[1].contactPerson,
        mobileNo: mockCustomers[1].mobileNo,
        shippingAddress: mockCustomers[1].shippingAddress,
        billingAddress: mockCustomers[1].billingAddress,
        deliveryDate: "2026-03-12",
        currency: "USh",
        currencySymbol: "USh",
        remarks: "Invoiced - awaiting dispatch confirmation",
        terms: [
            { id: 1, percentage: 40, termType: "Advance", date: "2026-03-06", note: "40% advance payment" },
            { id: 2, percentage: 30, termType: "Days", date: "", days: 30, note: "30% within 30 days from invoice" },
            { id: 3, percentage: 30, termType: "Delivery", date: "", note: "30% on delivery" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[2].id, itemName: mockFinishedGoods[2].name, uom: "PCS", orderedQty: 15, rate: 850.00, price: 12750.00 },
            { id: 2, itemCode: mockFinishedGoods[3].id, itemName: mockFinishedGoods[3].name, uom: "PCS", orderedQty: 30, rate: 125.00, price: 3750.00 }
        ],
        subtotal: 16500.00,
        discountValue: 500,
        discountType: "Amount",
        discountAmount: 500.00,
        tax: 2880.00,
        taxPercentage: 18,
        grandTotal: 18880.00,
        status: "Open"
    },
    // ========== PARTIALLY PAID STATUS ==========
    {
        id: 3,
        invoiceNumber: "INV-2026-003",
        invoiceDate: "2026-03-01",
        dueDate: "2026-03-31",
        soNumber: "SO-2026-003",
        soDate: "2026-02-28",
        customerId: mockCustomers[2]?.id || "cust-1",
        customerName: mockCustomers[2]?.name || "Global Trade",
        contactPerson: mockCustomers[2]?.contactPerson || "Test User",
        mobileNo: mockCustomers[2]?.mobileNo || "1234567890",
        shippingAddress: mockCustomers[2]?.shippingAddress || "123 Test St",
        billingAddress: mockCustomers[2]?.billingAddress || "123 Test St",
        deliveryDate: "2026-03-05",
        currency: "USh",
        currencySymbol: "USh",
        remarks: "Payment partially received.",
        terms: [
            { id: 1, percentage: 50, termType: "Advance", date: "2026-03-01", note: "50% advance" },
            { id: 2, percentage: 50, termType: "Delivery", date: "", note: "50% on delivery" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[0]?.id || "FG001", itemName: mockFinishedGoods[0]?.name || "Product A", uom: "PCS", orderedQty: 5, rate: 1000.00, price: 5000.00 }
        ],
        subtotal: 5000.00,
        discountValue: 0,
        discountType: "%",
        discountAmount: 0.00,
        tax: 900.00,
        taxPercentage: 18,
        grandTotal: 5900.00,
        status: "Partially Paid"
    },
    // ========== CLOSED STATUS ==========
    {
        id: 4,
        invoiceNumber: "INV-2026-004",
        invoiceDate: "2026-01-15",
        dueDate: "2026-02-15",
        soNumber: "SO-2026-004",
        soDate: "2026-01-10",
        customerId: mockCustomers[0]?.id || "cust-1",
        customerName: mockCustomers[0]?.name || "Acme Corp",
        contactPerson: mockCustomers[0]?.contactPerson || "Test User",
        mobileNo: mockCustomers[0]?.mobileNo || "1234567890",
        shippingAddress: mockCustomers[0]?.shippingAddress || "123 Test St",
        billingAddress: mockCustomers[0]?.billingAddress || "123 Test St",
        deliveryDate: "2026-01-20",
        currency: "USh",
        currencySymbol: "USh",
        remarks: "Fully paid.",
        terms: [
            { id: 1, percentage: 100, termType: "Advance", date: "2026-01-15", note: "100% advance" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[1]?.id || "FG002", itemName: mockFinishedGoods[1]?.name || "Product B", uom: "PCS", orderedQty: 2, rate: 2000.00, price: 4000.00 }
        ],
        subtotal: 4000.00,
        discountValue: 0,
        discountType: "%",
        discountAmount: 0.00,
        tax: 720.00,
        taxPercentage: 18,
        grandTotal: 4720.00,
        status: "Closed"
    },
    // ========== OVERDUE STATUS ==========
    {
        id: 5,
        invoiceNumber: "INV-2026-005",
        invoiceDate: "2026-01-01",
        dueDate: "2026-01-31",
        soNumber: "SO-2026-005",
        soDate: "2025-12-25",
        customerId: mockCustomers[1]?.id || "cust-1",
        customerName: mockCustomers[1]?.name || "TechStart Inc",
        contactPerson: mockCustomers[1]?.contactPerson || "Test User",
        mobileNo: mockCustomers[1]?.mobileNo || "1234567890",
        shippingAddress: mockCustomers[1]?.shippingAddress || "123 Test St",
        billingAddress: mockCustomers[1]?.billingAddress || "123 Test St",
        deliveryDate: "2026-01-05",
        currency: "USh",
        currencySymbol: "USh",
        remarks: "Payment overdue.",
        terms: [
            { id: 1, percentage: 100, termType: "Days", date: "", days: 30, note: "30 days" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[2]?.id || "FG003", itemName: mockFinishedGoods[2]?.name || "Product C", uom: "PCS", orderedQty: 10, rate: 500.00, price: 5000.00 }
        ],
        subtotal: 5000.00,
        discountValue: 0,
        discountType: "%",
        discountAmount: 0.00,
        tax: 900.00,
        taxPercentage: 18,
        grandTotal: 5900.00,
        status: "Overdue"
    },
    // ========== CANCELLED STATUS ==========
    {
        id: 6,
        invoiceNumber: "INV-2026-006",
        invoiceDate: "2026-03-01",
        dueDate: "2026-03-31",
        soNumber: "SO-2026-006",
        soDate: "2026-02-28",
        customerId: mockCustomers[0]?.id || "cust-1",
        customerName: mockCustomers[0]?.name || "Acme Corp",
        contactPerson: mockCustomers[0]?.contactPerson || "Test User",
        mobileNo: mockCustomers[0]?.mobileNo || "1234567890",
        shippingAddress: mockCustomers[0]?.shippingAddress || "123 Test St",
        billingAddress: mockCustomers[0]?.billingAddress || "123 Test St",
        deliveryDate: "2026-03-10",
        currency: "USh",
        currencySymbol: "USh",
        remarks: "Order cancelled by customer.",
        terms: [
            { id: 1, percentage: 100, termType: "Delivery", date: "", note: "100% on delivery" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[0]?.id || "FG001", itemName: mockFinishedGoods[0]?.name || "Product A", uom: "PCS", orderedQty: 1, rate: 100.00, price: 100.00 }
        ],
        subtotal: 100.00,
        discountValue: 0,
        discountType: "%",
        discountAmount: 0.00,
        tax: 18.00,
        taxPercentage: 18,
        grandTotal: 118.00,
        status: "Cancelled"
    },
    // ========== ADDITIONAL RECORDS FOR DEMO ==========
    {
        id: 8,
        invoiceNumber: "INV-2026-008",
        invoiceDate: "2026-03-05",
        dueDate: "2026-04-05",
        soNumber: "SO-2026-008",
        soDate: "2026-03-01",
        customerId: mockCustomers[1].id,
        customerName: mockCustomers[1].name,
        contactPerson: mockCustomers[1].contactPerson,
        mobileNo: mockCustomers[1].mobileNo,
        shippingAddress: mockCustomers[1].shippingAddress,
        billingAddress: mockCustomers[1].billingAddress,
        deliveryDate: "2026-03-20",
        currency: "USh",
        currencySymbol: "USh",
        remarks: "Urgent delivery requested.",
        terms: [
            { id: 1, percentage: 100, termType: "Advance", date: "2026-03-05", note: "Full advance" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[4]?.id || "FG005", itemName: mockFinishedGoods[4]?.name || "Product E", uom: "PCS", orderedQty: 50, rate: 200.00, price: 10000.00 }
        ],
        subtotal: 10000.00,
        discountValue: 10,
        discountType: "%",
        discountAmount: 1000.00,
        tax: 1620.00,
        taxPercentage: 18,
        grandTotal: 10620.00,
        status: "Open"
    },
    {
        id: 9,
        invoiceNumber: "INV-2026-009",
        invoiceDate: "2026-02-15",
        dueDate: "2026-03-15",
        soNumber: "SO-2026-009",
        soDate: "2026-02-10",
        customerId: mockCustomers[0].id,
        customerName: mockCustomers[0].name,
        contactPerson: mockCustomers[0].contactPerson,
        mobileNo: mockCustomers[0].mobileNo,
        shippingAddress: mockCustomers[0].shippingAddress,
        billingAddress: mockCustomers[0].billingAddress,
        deliveryDate: "2026-02-25",
        currency: "USh",
        currencySymbol: "USh",
        remarks: "Payment plan agreed.",
        terms: [
            { id: 1, percentage: 50, termType: "Advance", date: "2026-02-15", note: "First half" },
            { id: 2, percentage: 50, termType: "Days", date: "2026-03-15", days: 30, note: "Second half" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[0].id, itemName: mockFinishedGoods[0].name, uom: "PCS", orderedQty: 5, rate: 1500.00, price: 7500.00 }
        ],
        subtotal: 7500.00,
        discountValue: 0,
        discountType: "%",
        discountAmount: 0.00,
        tax: 1350.00,
        taxPercentage: 18,
        grandTotal: 8850.00,
        status: "Partially Paid"
    },
    {
        id: 10,
        invoiceNumber: "INV-2026-010",
        invoiceDate: "2025-12-01",
        dueDate: "2025-12-31",
        soNumber: "SO-2026-010",
        soDate: "2025-11-20",
        customerId: mockCustomers[1].id,
        customerName: mockCustomers[1].name,
        contactPerson: mockCustomers[1].contactPerson,
        mobileNo: mockCustomers[1].mobileNo,
        shippingAddress: mockCustomers[1].shippingAddress,
        billingAddress: mockCustomers[1].billingAddress,
        deliveryDate: "2025-12-10",
        currency: "USh",
        currencySymbol: "USh",
        remarks: "Legacy system migration.",
        terms: [
            { id: 1, percentage: 100, termType: "Delivery", date: "2025-12-31", note: "100% on delivery" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[1].id, itemName: mockFinishedGoods[1].name, uom: "PCS", orderedQty: 100, rate: 50.00, price: 5000.00 }
        ],
        subtotal: 5000.00,
        discountValue: 0,
        discountType: "%",
        discountAmount: 0.00,
        tax: 900.00,
        taxPercentage: 18,
        grandTotal: 5900.00,
        status: "Overdue"
    },
    {
        id: 11,
        invoiceNumber: "-",
        invoiceDate: "-",
        dueDate: "2026-04-10",
        soNumber: "SO-2026-011",
        soDate: "2026-03-10",
        customerId: mockCustomers[2]?.id || "cust-3",
        customerName: mockCustomers[2]?.name || "Global Trade",
        contactPerson: mockCustomers[2]?.contactPerson || "Sarah Johnson",
        mobileNo: mockCustomers[2]?.mobileNo || "555-0123",
        shippingAddress: mockCustomers[2]?.shippingAddress || "789 Commerce Ave",
        billingAddress: mockCustomers[2]?.billingAddress || "789 Commerce Ave",
        deliveryDate: "2026-04-10",
        currency: "USh",
        currencySymbol: "USh",
        remarks: "New draft for upcoming shipment.",
        terms: [
            { id: 1, percentage: 100, termType: "Advance", date: "", note: "Pay in full" }
        ],
        items: [
            { id: 1, itemCode: mockFinishedGoods[0].id, itemName: mockFinishedGoods[0].name, uom: "PCS", orderedQty: 25, rate: 1000.00, price: 25000.00 }
        ],
        subtotal: 25000.00,
        discountValue: 0,
        discountType: "%",
        discountAmount: 0.00,
        tax: 4500.00,
        taxPercentage: 18,
        grandTotal: 29500.00,
        status: "Draft"
    }
];

// In-memory state - resets on page refresh
let mockInvoices: InvoiceData[] = [...DEFAULT_INVOICES];

// ============================================================================
// SERVICE FUNCTIONS - SESSION ONLY (NO PERSISTENCE)
// ============================================================================

export const getInvoices = (): InvoiceData[] => {
    return [...mockInvoices];
};

export const getInvoiceById = (id: number): InvoiceData | undefined => {
    return mockInvoices.find(inv => inv.id === id);
};

export const createInvoice = (payload: Omit<InvoiceData, 'id'>): InvoiceData => {
    const newInvoice: InvoiceData = {
        ...payload,
        id: Math.max(...mockInvoices.map(i => i.id), 0) + 1
    };
    mockInvoices.push(newInvoice);
    return newInvoice;
};

export const updateInvoice = (id: number, payload: Partial<InvoiceData>): InvoiceData | null => {
    const index = mockInvoices.findIndex(inv => inv.id === id);
    if (index === -1) return null;

    mockInvoices[index] = { ...mockInvoices[index], ...payload };
    return mockInvoices[index];
};

export const markInvoiceStatus = (id: number, status: InvoiceStatus): InvoiceData | null => {
    return updateInvoice(id, { status });
};

export const createInvoiceFromSO = (so: SOData): InvoiceData => {
    // Check if already exists
    const existing = mockInvoices.find(inv => inv.soNumber === so.soNumber);
    if (existing) return existing;

    // CRITICAL: Calculate financial values using SO discount and tax
    const subtotal = so.items.reduce((sum, item) => sum + item.price, 0);
    
    // Calculate discount amount
    let discountAmount = 0;
    if (so.discountValue) {
        if (so.discountType === "Amount") {
            discountAmount = so.discountValue;
        } else {
            // Percentage discount
            discountAmount = (subtotal * so.discountValue) / 100;
        }
    }
    
    const afterDiscount = subtotal - discountAmount;
    
    // Calculate tax amount
    let taxAmount = 0;
    if (so.taxValue) {
        if (so.taxType === "Amount") {
            taxAmount = so.taxValue;
        } else {
            // Percentage tax
            taxAmount = (afterDiscount * so.taxValue) / 100;
        }
    } else if (so.taxPercentage) {
        // Backward compatibility
        taxAmount = (afterDiscount * so.taxPercentage) / 100;
    }
    
    const grandTotal = afterDiscount + taxAmount;

    const newInvoice: InvoiceData = {
        id: Math.max(...mockInvoices.map(i => i.id), 0) + 1,
        invoiceNumber: `INV-${so.soNumber.split('-').slice(1).join('-')}`, // Re-use SO sequence
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: "",
        soNumber: so.soNumber,
        soDate: so.soDate,
        customerName: so.customerName,
        contactPerson: so.contactPerson,
        mobileNo: so.mobileNo,
        shippingAddress: so.shippingAddress,
        billingAddress: so.billingAddress,
        deliveryDate: so.deliveryDate,
        currency: so.currency,
        currencySymbol: so.currency === "Indian Rupee" ? "₹" : (so.currency === "US Dollar" ? "$" : "USh"),
        remarks: so.remarks,
        // Map discount and tax from SO
        discountValue: so.discountValue || 0,
        discountType: so.discountType || "%",
        discountAmount: discountAmount,
        taxType: so.taxType || "%",
        taxValue: so.taxValue || so.taxPercentage || 0,
        taxPercentage: so.taxPercentage || so.taxValue || 0, // Backward compatibility
        subtotal,
        tax: taxAmount,
        grandTotal,
        status: "Draft",
        terms: so.terms.map(t => ({
            id: t.id,
            percentage: t.percentage,
            termType: t.termType,
            date: t.date,
            days: typeof t.days === 'string' ? parseInt(t.days) : t.days,
            note: t.note
        })),
        items: so.items.map(i => ({
            id: i.id,
            itemCode: i.itemCode,
            itemName: i.itemName,
            uom: i.uom,
            orderedQty: i.orderedQty,
            rate: i.rate,
            price: i.price
        }))
    };

    mockInvoices.push(newInvoice);
    
    console.log('[INVOICE] Created invoice from SO:', {
        invoiceNumber: newInvoice.invoiceNumber,
        soNumber: so.soNumber,
        subtotal,
        discountAmount,
        taxAmount,
        grandTotal,
        termsCount: newInvoice.terms.length
    });
    
    return newInvoice;
};

// Helper to reset data (useful for testing)
export const resetInvoices = () => {
    console.log('Mock invoices reset - data persists in memory only');
};
