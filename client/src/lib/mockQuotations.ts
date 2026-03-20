import { mockCustomers, mockFinishedGoods } from "./masterMockData";

export type QuotationStatus = "Draft Quote" | "Submitted Quote" | "Expired Quotations" | "Converted to SO";

export interface QuotationItem {
    id: number;
    itemCode: string;
    item: string;
    qty: number | string;
    rate: number | string;
    amount: number;
}

// Payment Term interface - valueType removed, only value field remains
export interface PaymentTerm {
    id: number;
    value: number; // The actual value (can be percentage 0-100 or fixed amount >= 0)
    percentage: number; // Deprecated: kept for backward compatibility, use value instead
    terms: "Advance" | "Delivery" | "Days";
    date: string;
    days?: number; // Number of days for "Days" term type
}

export interface QuotationData {
    id: number;
    quotationNo: string; // Changed: Made required to fix runtime error
    quotationDate: string;
    customerName: string;
    contactPersonName: string;
    contactNumber: string;
    billingAddress: string;
    shippingAddress: string;
    currency: string;
    paymentTerms: PaymentTerm[];
    deliveryTime: string;
    quotationValidity: string;
    remarks: string;
    items: QuotationItem[];
    status: QuotationStatus;
    discountValue?: number; // Discount value (percentage 0-100 or fixed amount)
    discountType?: "%" | "Amount"; // Discount type - percentage or fixed amount
    taxType?: "%" | "Amount"; // Tax type - percentage or fixed amount
    taxValue?: number; // Tax value based on taxType
    taxPercentage: number; // Deprecated: kept for backward compatibility
    subtotal: number;
    discountAmount?: number; // Calculated discount amount
    taxAmount: number;
    total: number;
}

// ============================================================================
// IN-MEMORY DATA STORE
// Session-only data - resets on page refresh
// No localStorage persistence - all changes are runtime only
// ============================================================================

// Ensure all quotation items have proper string values for itemCode and item
let mockQuotations: QuotationData[] = [
    // Draft Quote - Sample 1
    {
        id: 1,
        quotationNo: "QT-2026-001",
        quotationDate: "2026-03-01",
        customerName: mockCustomers[0]?.name || "Acme Corp",
        contactPersonName: mockCustomers[0]?.contactPerson || "John Doe",
        contactNumber: mockCustomers[0]?.mobileNo || "1234567890",
        billingAddress: mockCustomers[0]?.billingAddress || "123 Main St",
        shippingAddress: mockCustomers[0]?.shippingAddress || "123 Main St",
        currency: "UGX",
        paymentTerms: [
            { id: 1, value: 30, percentage: 30, terms: "Advance", date: "2026-03-01" },
            { id: 2, value: 70, percentage: 70, terms: "Delivery", date: "" }
        ],
        deliveryTime: "2026-03-15",
        quotationValidity: "2026-03-31",
        remarks: "Standard terms apply. All products come with 1-year warranty.",
        items: [
            { 
                id: 1, 
                itemCode: "FG-001", 
                item: "GSV 7", 
                qty: 10, 
                rate: 1200, 
                amount: 12000 
            },
            { 
                id: 2, 
                itemCode: "FG-002", 
                item: "GSV 8", 
                qty: 20, 
                rate: 450, 
                amount: 9000 
            }
        ],
        status: "Draft Quote",
        discountValue: 5,
        discountType: "%",
        taxType: "%",
        taxValue: 18,
        taxPercentage: 18,
        subtotal: 21000,
        discountAmount: 1050,
        taxAmount: 3591,
        total: 23541
    },
    
    // Submitted Quote - Sample 2
    {
        id: 2,
        quotationNo: "QT-2026-002",
        quotationDate: "2026-02-25",
        customerName: mockCustomers[1]?.name || "TechStart Inc",
        contactPersonName: mockCustomers[1]?.contactPerson || "Jane Smith",
        contactNumber: mockCustomers[1]?.mobileNo || "9876543210",
        billingAddress: mockCustomers[1]?.billingAddress || "456 Tech Ave",
        shippingAddress: mockCustomers[1]?.shippingAddress || "456 Tech Ave",
        currency: "UGX",
        paymentTerms: [
            { id: 1, value: 40, percentage: 40, terms: "Advance", date: "2026-02-25" },
            { id: 2, value: 30, percentage: 30, terms: "Days", date: "", days: 30 },
            { id: 3, value: 30, percentage: 30, terms: "Delivery", date: "" }
        ],
        deliveryTime: "2026-03-17",
        quotationValidity: "2026-04-25",
        remarks: "Include installation and commissioning services.",
        items: [
            { 
                id: 1, 
                itemCode: "FG-003", 
                item: "GSMX 2.5", 
                qty: 15, 
                rate: 850, 
                amount: 12750 
            },
            { 
                id: 2, 
                itemCode: "FG-004", 
                item: "GSMx 6.5", 
                qty: 30, 
                rate: 125, 
                amount: 3750 
            }
        ],
        status: "Submitted Quote",
        discountValue: 500,
        discountType: "Amount",
        taxType: "%",
        taxValue: 18,
        taxPercentage: 18,
        subtotal: 16500,
        discountAmount: 500,
        taxAmount: 2805,
        total: 18305
    },

    // Submitted Quote - Sample 3
    {
        id: 3,
        quotationNo: "QT-2026-003",
        quotationDate: "2026-03-05",
        customerName: mockCustomers[3]?.name || "Innovate Ltd",
        contactPersonName: mockCustomers[3]?.contactPerson || "Alice Brown",
        contactNumber: mockCustomers[3]?.mobileNo || "9876543213",
        billingAddress: mockCustomers[3]?.billingAddress || "321 Innovation Dr, Austin, TX 78701",
        shippingAddress: mockCustomers[3]?.shippingAddress || "321 Innovation Dr, Austin, TX 78701",
        currency: "UGX",
        paymentTerms: [
            { id: 1, value: 50, percentage: 50, terms: "Advance", date: "2026-03-05" },
            { id: 2, value: 50, percentage: 50, terms: "Delivery", date: "" }
        ],
        deliveryTime: "2026-03-20",
        quotationValidity: "2026-04-05",
        remarks: "Priority order - expedited delivery required",
        items: [
            { 
                id: 1, 
                itemCode: "FG-001", 
                item: "GSV 7", 
                qty: 100, 
                rate: 1200, 
                amount: 120000 
            },
            { 
                id: 2, 
                itemCode: "FG-002", 
                item: "GSV 8", 
                qty: 50, 
                rate: 450, 
                amount: 22500 
            },
            { 
                id: 3, 
                itemCode: "FG-003", 
                item: "GSMX 2.5", 
                qty: 75, 
                rate: 850, 
                amount: 63750 
            }
        ],
        status: "Submitted Quote",
        discountValue: 10,
        discountType: "%",
        taxType: "%",
        taxValue: 18,
        taxPercentage: 18,
        subtotal: 206250,
        discountAmount: 20625,
        taxAmount: 33345,
        total: 218970
    },

    // Submitted Quote - Sample 4
    {
        id: 4,
        quotationNo: "QT-2026-004",
        quotationDate: "2026-03-07",
        customerName: mockCustomers[4]?.name || "Prime Solutions",
        contactPersonName: mockCustomers[4]?.contactPerson || "Charlie Wilson",
        contactNumber: mockCustomers[4]?.mobileNo || "9876543214",
        billingAddress: mockCustomers[4]?.billingAddress || "654 Prime St, Seattle, WA 98101",
        shippingAddress: mockCustomers[4]?.shippingAddress || "654 Prime St, Seattle, WA 98101",
        currency: "UGX",
        paymentTerms: [
            { id: 1, value: 40, percentage: 40, terms: "Advance", date: "2026-03-07" },
            { id: 2, value: 30, percentage: 30, terms: "Days", date: "", days: 30 },
            { id: 3, value: 30, percentage: 30, terms: "Delivery", date: "" }
        ],
        deliveryTime: "2026-03-25",
        quotationValidity: "2026-04-07",
        remarks: "Bulk order - special pricing applied",
        items: [
            { 
                id: 1, 
                itemCode: "FG-004", 
                item: "GSMx 6.5", 
                qty: 200, 
                rate: 125, 
                amount: 25000 
            },
            { 
                id: 2, 
                itemCode: "FG-005", 
                item: "SMF 20", 
                qty: 150, 
                rate: 95, 
                amount: 14250 
            }
        ],
        status: "Submitted Quote",
        discountValue: 1500,
        discountType: "Amount",
        taxType: "%",
        taxValue: 18,
        taxPercentage: 18,
        subtotal: 39250,
        discountAmount: 1500,
        taxAmount: 6795,
        total: 44545
    },

    // Draft Quote - Sample 5
    {
        id: 5,
        quotationNo: "QT-2026-005",
        quotationDate: "2026-03-09",
        customerName: mockCustomers[2]?.name || "Global Industries",
        contactPersonName: mockCustomers[2]?.contactPerson || "Bob Johnson",
        contactNumber: mockCustomers[2]?.mobileNo || "9876543212",
        billingAddress: mockCustomers[2]?.billingAddress || "789 Industry Blvd, Chicago, IL 60601",
        shippingAddress: mockCustomers[2]?.shippingAddress || "789 Industry Blvd, Chicago, IL 60601",
        currency: "UGX",
        paymentTerms: [
            { id: 1, value: 25, percentage: 25, terms: "Advance", date: "2026-03-09" },
            { id: 2, value: 75, percentage: 75, terms: "Delivery", date: "" }
        ],
        deliveryTime: "2026-03-30",
        quotationValidity: "2026-04-09",
        remarks: "Standard delivery terms - FOB destination",
        items: [
            { 
                id: 1, 
                itemCode: "FG-001", 
                item: "GSV 7", 
                qty: 50, 
                rate: 1200, 
                amount: 60000 
            }
        ],
        status: "Draft Quote",
        discountValue: 5,
        discountType: "%",
        taxType: "%",
        taxValue: 18,
        taxPercentage: 18,
        subtotal: 60000,
        discountAmount: 3000,
        taxAmount: 10260,
        total: 67260
    }
];

// ============================================================================
// SERVICE FUNCTIONS
// All operations are in-memory only - no persistence
// ============================================================================

export const getQuotations = (): QuotationData[] => {
    return [...mockQuotations];
};

export const getQuotationById = (id: number): QuotationData | undefined => {
    return mockQuotations.find(q => q.id === id);
};

export const createQuotation = (payload: Omit<QuotationData, 'id'>): QuotationData => {
    const newQuotation: QuotationData = {
        ...payload,
        id: Math.max(...mockQuotations.map(q => q.id), 0) + 1
    };
    mockQuotations.push(newQuotation);
    
    // Dispatch event to notify other components (only in browser context)
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent("erp:quotations-updated"));
    }
    
    return newQuotation;
};

export const updateQuotation = (id: number, payload: Partial<QuotationData>): QuotationData | null => {
    const index = mockQuotations.findIndex(q => q.id === id);
    if (index === -1) return null;

    mockQuotations[index] = { ...mockQuotations[index], ...payload };
    
    // Dispatch event to notify other components (only in browser context)
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent("erp:quotations-updated"));
    }
    
    return mockQuotations[index];
};

export const deleteQuotation = (id: number): boolean => {
    const index = mockQuotations.findIndex(q => q.id === id);
    if (index === -1) return false;

    mockQuotations.splice(index, 1);
    
    // Dispatch event to notify other components (only in browser context)
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent("erp:quotations-updated"));
    }
    
    return true;
};

export const changeQuotationStatus = (id: number, status: QuotationStatus): QuotationData | null => {
    return updateQuotation(id, { status });
};
