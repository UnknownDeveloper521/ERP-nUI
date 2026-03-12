// ============================================================================
// SALES FOLLOW UP & PAYMENT FOLLOW UP MOCK DATA
// Shared data structure for both Sales and Payment Follow Up modules
// Both modules work with the same invoice records
// ============================================================================

// Common follow-up history entry structure
export interface FollowUpHistoryEntry {
    followUpDate: string;
    note: string;
}

// Payment term breakdown structure
// UPDATED: Added paymentDate field to track when payment was actually received
export interface PaymentTermBreakdown {
    id: number;
    termType: string; // "Advance", "Days", "Delivery"
    percentage: number;
    termAmount: number;
    dueDate: string; // When payment is expected
    paidAmount: number;
    dueAmount: number;
    status: "Pending" | "Partial" | "Paid";
    paymentDate?: string; // When payment was actually recorded (only if paid)
    days?: number; // Number of days for "Days" term type
}

// ============================================================================
// STATUS UPDATE: Added "Completed" status
// - Completed: When Due Amount = 0 (all payments received)
// - Upcoming: Payment due date is in the future
// - Overdue: Payment due date has passed and Due Amount > 0
// ============================================================================
export interface SalesFollowUpRecord {
    invoiceNo: string;
    soNumber: string;
    customerName: string;
    invoiceDate: string;
    dueDate: string;
    invoiceAmount: number;
    paidAmount: number;
    dueAmount: number;
    status: "Upcoming" | "Overdue" | "Completed";
    terms: PaymentTermBreakdown[];
    lastFollowUpDate?: string;
    nextFollowUpDate?: string;
    history: FollowUpHistoryEntry[];
}

export interface PaymentFollowUpRecord {
    invoiceNo: string;
    soNumber: string;
    customerName: string;
    invoiceDate: string;
    dueDate: string;
    invoiceAmount: number;
    amountReceived: number;
    dueAmount: number;
    status: "Upcoming" | "Overdue" | "Completed";
    terms: PaymentTermBreakdown[];
    lastFollowUpDate?: string;
    history: FollowUpHistoryEntry[];
}

// ============================================================================
// SALES FOLLOW UP MOCK DATA
// DEMO: 3 pre-seeded records for demonstration purposes
// In production, records are created ONLY after dispatch completion
// ============================================================================

export const mockSalesFollowUpData: SalesFollowUpRecord[] = [
    // Demo Record 1: TechStart Inc - INV-2026-002 (matches existing invoice)
    {
        invoiceNo: "INV-2026-002",
        soNumber: "SO-2026-002",
        customerName: "TechStart Inc",
        invoiceDate: "2026-02-27",
        dueDate: "2026-04-27",
        invoiceAmount: 18880.00,
        paidAmount: 7552.00,
        dueAmount: 11328.00,
        status: "Upcoming",
        terms: [
            {
                id: 1,
                termType: "Advance",
                percentage: 40,
                termAmount: 7552.00,
                dueDate: "2026-03-06",
                paidAmount: 7552.00,
                dueAmount: 0,
                status: "Paid",
                paymentDate: "2026-03-06"
            },
            {
                id: 2,
                termType: "Days",
                percentage: 30,
                termAmount: 5664.00,
                dueDate: "2026-03-29",
                paidAmount: 0,
                dueAmount: 5664.00,
                status: "Pending",
                days: 30
            },
            {
                id: 3,
                termType: "Delivery",
                percentage: 30,
                termAmount: 5664.00,
                dueDate: "2026-03-12",
                paidAmount: 0,
                dueAmount: 5664.00,
                status: "Pending"
            }
        ],
        lastFollowUpDate: "2026-03-08",
        nextFollowUpDate: "2026-03-14",
        history: [
            {
                followUpDate: "2026-03-08",
                note: "Initial follow-up - customer confirmed receipt of invoice"
            }
        ]
    },

    // Demo Record 2: Acme Corp - INV-2026-001 (new record)
    {
        invoiceNo: "INV-2026-001",
        soNumber: "SO-2026-001",
        customerName: "Acme Corp",
        invoiceDate: "2026-02-28",
        dueDate: "2026-03-15",
        invoiceAmount: 23541.00,
        paidAmount: 7062.30,
        dueAmount: 16478.70,
        status: "Overdue",
        terms: [
            {
                id: 1,
                termType: "Advance",
                percentage: 30,
                termAmount: 7062.30,
                dueDate: "2026-02-28",
                paidAmount: 7062.30,
                dueAmount: 0,
                status: "Paid",
                paymentDate: "2026-02-28"
            },
            {
                id: 2,
                termType: "Delivery",
                percentage: 70,
                termAmount: 16478.70,
                dueDate: "2026-03-15",
                paidAmount: 0,
                dueAmount: 16478.70,
                status: "Pending"
            }
        ],
        lastFollowUpDate: "2026-03-10",
        nextFollowUpDate: "2026-03-12",
        history: [
            {
                followUpDate: "2026-03-10",
                note: "Customer requested extension for delivery payment - agreed to 3 days"
            }
        ]
    }
];

// ============================================================================
// PAYMENT FOLLOW UP MOCK DATA
// DEMO: 3 pre-seeded records for demonstration purposes
// In production, records are created ONLY after dispatch completion
// ============================================================================

export const mockPaymentFollowUpData: PaymentFollowUpRecord[] = [
    // Demo Record 1: TechStart Inc - INV-2026-002
    {
        invoiceNo: "INV-2026-002",
        soNumber: "SO-2026-002",
        customerName: "TechStart Inc",
        invoiceDate: "2026-02-27",
        dueDate: "2026-04-27",
        invoiceAmount: 18880.00,
        amountReceived: 7552.00,
        dueAmount: 11328.00,
        status: "Upcoming",
        terms: [
            {
                id: 1,
                termType: "Advance",
                percentage: 40,
                termAmount: 7552.00,
                dueDate: "2026-03-06",
                paidAmount: 7552.00,
                dueAmount: 0,
                status: "Paid",
                paymentDate: "2026-03-06"
            },
            {
                id: 2,
                termType: "Days",
                percentage: 30,
                termAmount: 5664.00,
                dueDate: "2026-03-29",
                paidAmount: 0,
                dueAmount: 5664.00,
                status: "Pending",
                days: 30
            },
            {
                id: 3,
                termType: "Delivery",
                percentage: 30,
                termAmount: 5664.00,
                dueDate: "2026-03-12",
                paidAmount: 0,
                dueAmount: 5664.00,
                status: "Pending"
            }
        ],
        lastFollowUpDate: "2026-03-08",
        history: [
            {
                followUpDate: "2026-03-06",
                note: "Payment Received: USh7552.00 | Mode: Online | Transaction ID: TXN-2026-002"
            },
            {
                followUpDate: "2026-03-08",
                note: "Payment reminder sent for remaining amount"
            }
        ]
    },

    // Demo Record 2: Acme Corp - INV-2026-001 (new record)
    {
        invoiceNo: "INV-2026-001",
        soNumber: "SO-2026-001",
        customerName: "Acme Corp",
        invoiceDate: "2026-02-28",
        dueDate: "2026-03-15",
        invoiceAmount: 23541.00,
        amountReceived: 7062.30,
        dueAmount: 16478.70,
        status: "Overdue",
        terms: [
            {
                id: 1,
                termType: "Advance",
                percentage: 30,
                termAmount: 7062.30,
                dueDate: "2026-02-28",
                paidAmount: 7062.30,
                dueAmount: 0,
                status: "Paid",
                paymentDate: "2026-02-28"
            },
            {
                id: 2,
                termType: "Delivery",
                percentage: 70,
                termAmount: 16478.70,
                dueDate: "2026-03-15",
                paidAmount: 0,
                dueAmount: 16478.70,
                status: "Pending"
            }
        ],
        lastFollowUpDate: "2026-03-10",
        history: [
            {
                followUpDate: "2026-02-28",
                note: "Payment Received: USh7062.30 | Mode: Cheque | Cheque No: CHQ-001-2026"
            },
            {
                followUpDate: "2026-03-10",
                note: "Follow-up call made - customer requested 3-day extension for delivery payment"
            },
            {
                followUpDate: "2026-03-11",
                note: "Extension approved - new due date communicated to customer"
            }
        ]
    }
];

// ============================================================================
// HELPER FUNCTION: Remove duplicate records by invoice number
// Ensures only ONE record exists per invoice
// ============================================================================
function removeDuplicatesByInvoice<T extends { invoiceNo: string }>(records: T[]): T[] {
    const seen = new Set<string>();
    return records.filter(record => {
        if (seen.has(record.invoiceNo)) {
            console.warn(`[DUPLICATE REMOVED] Invoice ${record.invoiceNo} already exists`);
            return false;
        }
        seen.add(record.invoiceNo);
        return true;
    });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all sales follow-up records
 * UPDATED: Now includes completed records (dueAmount = 0)
 * Records with dueAmount = 0 will have status "Completed"
 * CRITICAL: Removes duplicates to ensure only ONE record per invoice
 */
export const getSalesFollowUpRecords = (): SalesFollowUpRecord[] => {
    // Remove duplicates and return all records including completed ones
    const uniqueRecords = removeDuplicatesByInvoice(mockSalesFollowUpData);
    // Update the array to remove duplicates permanently
    if (uniqueRecords.length !== mockSalesFollowUpData.length) {
        mockSalesFollowUpData.length = 0;
        mockSalesFollowUpData.push(...uniqueRecords);
    }
    return mockSalesFollowUpData;
};

/**
 * Get all payment follow-up records
 * UPDATED: Now includes completed records (dueAmount = 0)
 * Records with dueAmount = 0 will have status "Completed"
 * CRITICAL: Removes duplicates to ensure only ONE record per invoice
 */
export const getPaymentFollowUpRecords = (): PaymentFollowUpRecord[] => {
    // Remove duplicates and return all records including completed ones
    const uniqueRecords = removeDuplicatesByInvoice(mockPaymentFollowUpData);
    // Update the array to remove duplicates permanently
    if (uniqueRecords.length !== mockPaymentFollowUpData.length) {
        mockPaymentFollowUpData.length = 0;
        mockPaymentFollowUpData.push(...uniqueRecords);
    }
    return mockPaymentFollowUpData;
};

/**
 * Get sales follow-up data for a specific invoice
 * UPDATED: Now returns completed records as well
 */
export const getSalesFollowUpByInvoice = (invoiceNo: string): SalesFollowUpRecord | undefined => {
    return mockSalesFollowUpData.find(record => record.invoiceNo === invoiceNo);
};

/**
 * Get payment follow-up data for a specific invoice
 * UPDATED: Now returns completed records as well
 */
export const getPaymentFollowUpByInvoice = (invoiceNo: string): PaymentFollowUpRecord | undefined => {
    return mockPaymentFollowUpData.find(record => record.invoiceNo === invoiceNo);
};

/**
 * Create a new Sales Follow Up record
 * CRITICAL: Checks for duplicates before creating
 * Returns true if created, false if already exists
 */
export const createSalesFollowUpRecord = (record: SalesFollowUpRecord): boolean => {
    console.log('[CREATE SALES FOLLOW UP] Attempting to create record for invoice:', record.invoiceNo);
    console.log('[CREATE SALES FOLLOW UP] Current array length:', mockSalesFollowUpData.length);
    console.log('[CREATE SALES FOLLOW UP] Current invoices in array:', mockSalesFollowUpData.map(r => r.invoiceNo));
    
    // Check if record already exists
    const existing = getSalesFollowUpByInvoice(record.invoiceNo);
    if (existing) {
        console.log('[CREATE SALES FOLLOW UP] ❌ DUPLICATE DETECTED - Record already exists for invoice:', record.invoiceNo);
        return false;
    }
    
    console.log('[CREATE SALES FOLLOW UP] ✓ No duplicate found - creating new record');
    
    // Add new record
    mockSalesFollowUpData.push(record);
    
    console.log('[CREATE SALES FOLLOW UP] ✓✓✓ Record CREATED successfully');
    console.log('[CREATE SALES FOLLOW UP] New array length:', mockSalesFollowUpData.length);
    
    return true;
};

/**
 * Create a new Payment Follow Up record
 * CRITICAL: Checks for duplicates before creating
 * Returns true if created, false if already exists
 */
export const createPaymentFollowUpRecord = (record: PaymentFollowUpRecord): boolean => {
    console.log('[CREATE PAYMENT FOLLOW UP] Attempting to create record for invoice:', record.invoiceNo);
    console.log('[CREATE PAYMENT FOLLOW UP] Current array length:', mockPaymentFollowUpData.length);
    console.log('[CREATE PAYMENT FOLLOW UP] Current invoices in array:', mockPaymentFollowUpData.map(r => r.invoiceNo));
    
    // Check if record already exists
    const existing = getPaymentFollowUpByInvoice(record.invoiceNo);
    if (existing) {
        console.log('[CREATE PAYMENT FOLLOW UP] ❌ DUPLICATE DETECTED - Record already exists for invoice:', record.invoiceNo);
        return false;
    }
    
    console.log('[CREATE PAYMENT FOLLOW UP] ✓ No duplicate found - creating new record');
    
    // Add new record
    mockPaymentFollowUpData.push(record);
    
    console.log('[CREATE PAYMENT FOLLOW UP] ✓✓✓ Record CREATED successfully');
    console.log('[CREATE PAYMENT FOLLOW UP] New array length:', mockPaymentFollowUpData.length);
    
    return true;
};
