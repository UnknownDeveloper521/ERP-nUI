// ============================================================================
// FOLLOW UP STORE - SHARED IN-MEMORY STATE
// Manages follow-up data shared between Sales and Payment Follow Up modules
// Data persists across route changes but resets on browser refresh
// ============================================================================

import { mockSalesFollowUpData, mockPaymentFollowUpData, type SalesFollowUpRecord, type PaymentFollowUpRecord, type FollowUpHistoryEntry, type PaymentTermBreakdown } from "./mockFollowUpData";
import { getInvoices } from "./mockInvoices";
import { getSalesOrders, updateSalesOrder } from "./mockSalesOrders";
import { format } from "date-fns";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Re-export FollowUpHistoryEntry for use in components
export type { FollowUpHistoryEntry } from "./mockFollowUpData";

type FollowUpStoreListener = () => void;

// ============================================================================
// IN-MEMORY STATE
// Initialized once when module loads, persists until browser refresh
// ============================================================================

let salesFollowUpState: SalesFollowUpRecord[] = [];
let paymentFollowUpState: PaymentFollowUpRecord[] = [];
let listeners: FollowUpStoreListener[] = [];

// ============================================================================
// STORE INITIALIZATION
// Create records for ALL invoices, not just those in mock data
// ============================================================================

const initializeStore = () => {
    const invoices = getInvoices();
    
    // Initialize sales follow-up state
    salesFollowUpState = invoices.map(invoice => {
        // Check if mock data exists for this invoice
        const mockData = mockSalesFollowUpData.find(m => m.invoiceNo === invoice.invoiceNumber);
        
        if (mockData) {
            // Use mock data if available
            return {
                ...mockData,
                history: [...mockData.history]
            };
        } else {
            // DO NOT create default records - they will be created by createFollowUpFromInvoice when dispatch completes
            // Return null and filter out later
            return null;
        }
    }).filter(Boolean) as SalesFollowUpRecord[];
    
    // Initialize payment follow-up state
    paymentFollowUpState = invoices.map(invoice => {
        // Check if mock data exists for this invoice
        const mockData = mockPaymentFollowUpData.find(m => m.invoiceNo === invoice.invoiceNumber);
        
        if (mockData) {
            // Use mock data if available
            return {
                ...mockData,
                history: [...mockData.history]
            };
        } else {
            // DO NOT create default records - they will be created by createFollowUpFromInvoice when dispatch completes
            // Return null and filter out later
            return null;
        }
    }).filter(Boolean) as PaymentFollowUpRecord[];
};

// Initialize on module load
initializeStore();

// ============================================================================
// LISTENER MANAGEMENT
// Notify components when data changes
// ============================================================================

/**
 * Subscribe to follow-up data changes
 * Returns unsubscribe function
 */
export const subscribeToFollowUpStore = (listener: FollowUpStoreListener): (() => void) => {
    listeners.push(listener);
    return () => {
        listeners = listeners.filter(l => l !== listener);
    };
};

/**
 * Notify all listeners of data change
 */
const notifyListeners = () => {
    listeners.forEach(listener => listener());
};

// ============================================================================
// SALES FOLLOW UP GETTERS
// ============================================================================

/**
 * Get all sales follow-up records
 * UPDATED: Now includes completed records (dueAmount = 0)
 * CRITICAL FIX: Remove duplicates to ensure only ONE record per invoice
 */
export const getSalesFollowUpRecords = (): SalesFollowUpRecord[] => {
    // Remove duplicates by invoice number
    const uniqueRecords = salesFollowUpState.filter((record, index, array) => 
        array.findIndex(r => r.invoiceNo === record.invoiceNo) === index
    );
    
    // If duplicates were found, update the state array to remove them permanently
    if (uniqueRecords.length !== salesFollowUpState.length) {
        console.warn('[STORE] Removing duplicate sales follow-up records:', salesFollowUpState.length - uniqueRecords.length);
        salesFollowUpState.length = 0;
        salesFollowUpState.push(...uniqueRecords);
    }
    
    return salesFollowUpState;
};

/**
 * Get sales follow-up data for a specific invoice
 * UPDATED: Now returns completed records as well
 */
export const getSalesFollowUpByInvoice = (invoiceNo: string): SalesFollowUpRecord | undefined => {
    return salesFollowUpState.find(record => record.invoiceNo === invoiceNo);
};

// ============================================================================
// PAYMENT FOLLOW UP GETTERS
// ============================================================================

/**
 * Get all payment follow-up records
 * UPDATED: Now includes completed records (dueAmount = 0)
 * CRITICAL FIX: Remove duplicates to ensure only ONE record per invoice
 */
export const getPaymentFollowUpRecords = (): PaymentFollowUpRecord[] => {
    // Remove duplicates by invoice number
    const uniqueRecords = paymentFollowUpState.filter((record, index, array) => 
        array.findIndex(r => r.invoiceNo === record.invoiceNo) === index
    );
    
    // If duplicates were found, update the state array to remove them permanently
    if (uniqueRecords.length !== paymentFollowUpState.length) {
        console.warn('[STORE] Removing duplicate payment follow-up records:', paymentFollowUpState.length - uniqueRecords.length);
        paymentFollowUpState.length = 0;
        paymentFollowUpState.push(...uniqueRecords);
    }
    
    return paymentFollowUpState;
};

/**
 * Get payment follow-up data for a specific invoice
 * UPDATED: Now returns completed records as well
 */
export const getPaymentFollowUpByInvoice = (invoiceNo: string): PaymentFollowUpRecord | undefined => {
    return paymentFollowUpState.find(record => record.invoiceNo === invoiceNo);
};

// ============================================================================
// SALES FOLLOW UP MUTATIONS
// ============================================================================

/**
 * Update sales follow-up record for an invoice
 * Adds new history entries and updates follow-up dates
 * All invoices are guaranteed to exist in store after initialization
 */
export const updateSalesFollowUp = (
    invoiceNo: string,
    updates: {
        newHistory?: FollowUpHistoryEntry[];
        lastFollowUpDate?: string;
        nextFollowUpDate?: string;
    }
): void => {
    console.log('[STORE] updateSalesFollowUp called', { invoiceNo, updates });
    
    const recordIndex = salesFollowUpState.findIndex(r => r.invoiceNo === invoiceNo);
    
    console.log('[STORE] Record index:', recordIndex);
    
    if (recordIndex !== -1) {
        const record = salesFollowUpState[recordIndex];
        
        console.log('[STORE] Before update:', {
            lastFollowUpDate: record.lastFollowUpDate,
            nextFollowUpDate: record.nextFollowUpDate,
            historyCount: record.history.length
        });
        
        // Update history if provided
        if (updates.newHistory && updates.newHistory.length > 0) {
            record.history = [...record.history, ...updates.newHistory];
        }
        
        // Update last follow-up date if provided
        if (updates.lastFollowUpDate) {
            record.lastFollowUpDate = updates.lastFollowUpDate;
        }
        
        // Update next follow-up date if provided
        if (updates.nextFollowUpDate !== undefined) {
            record.nextFollowUpDate = updates.nextFollowUpDate;
        }
        
        console.log('[STORE] After update:', {
            lastFollowUpDate: record.lastFollowUpDate,
            nextFollowUpDate: record.nextFollowUpDate,
            historyCount: record.history.length
        });
        
        // Notify listeners of change
        console.log('[STORE] Notifying listeners, count:', listeners.length);
        notifyListeners();
    } else {
        console.error(`[STORE] Sales follow-up record not found for invoice: ${invoiceNo}`);
        console.log('[STORE] Available invoices:', salesFollowUpState.map(r => r.invoiceNo));
    }
};

// ============================================================================
// PAYMENT FOLLOW UP MUTATIONS
// ============================================================================

/**
 * Update payment follow-up record for an invoice
 * Adds new history entries, updates due amount, and handles completion
 * UPDATED: Automatically sets status to "Completed" when dueAmount becomes 0
 * CRITICAL: Ensures term breakdown is synchronized with overall amounts
 */
export const updatePaymentFollowUp = (
    invoiceNo: string,
    updates: {
        newHistory?: FollowUpHistoryEntry[];
        lastFollowUpDate?: string;
        amountReceived?: number;
    }
): void => {
    const recordIndex = paymentFollowUpState.findIndex(r => r.invoiceNo === invoiceNo);
    
    if (recordIndex !== -1) {
        const record = paymentFollowUpState[recordIndex];
        
        // Update history if provided
        if (updates.newHistory && updates.newHistory.length > 0) {
            record.history = [...record.history, ...updates.newHistory];
        }
        
        // Update last follow-up date if provided
        if (updates.lastFollowUpDate) {
            record.lastFollowUpDate = updates.lastFollowUpDate;
        }
        
        // Update amount received and due amount if provided
        if (updates.amountReceived !== undefined && updates.amountReceived > 0) {
            record.amountReceived += updates.amountReceived;
            record.dueAmount = Math.max(0, record.invoiceAmount - record.amountReceived);
            
            // COMPLETED STATUS: Automatically set status to "Completed" when dueAmount becomes 0
            if (record.dueAmount === 0) {
                record.status = "Completed";
                
                // CRITICAL FIX: When marking as completed, ensure ALL terms are marked as fully paid
                record.terms = record.terms.map(term => ({
                    ...term,
                    paidAmount: term.termAmount,
                    dueAmount: 0,
                    status: "Paid" as "Pending" | "Partial" | "Paid"
                }));
            }
        }
        
        // SYNC: Update due amount, status, and terms in sales follow-up state as well
        const salesRecordIndex = salesFollowUpState.findIndex(r => r.invoiceNo === invoiceNo);
        if (salesRecordIndex !== -1) {
            salesFollowUpState[salesRecordIndex].dueAmount = record.dueAmount;
            salesFollowUpState[salesRecordIndex].paidAmount = record.amountReceived;
            
            // Sync status to sales follow-up
            if (record.dueAmount === 0) {
                salesFollowUpState[salesRecordIndex].status = "Completed";
            }
            
            // CRITICAL FIX: Sync term breakdown to sales follow-up
            salesFollowUpState[salesRecordIndex].terms = record.terms.map(term => ({ ...term }));
        }
        
        // Notify listeners of change
        notifyListeners();
    }
};

/**
 * Mark invoice as completed (due amount = 0)
 * Sets status to "Completed" in both sales and payment follow-up
 * CRITICAL: Also updates ALL term breakdowns to mark them as fully paid
 * This ensures the overall summary and term breakdown are always synchronized
 */
export const markInvoiceAsCompleted = (invoiceNo: string): void => {
    console.log('[STORE] markInvoiceAsCompleted called', { invoiceNo });
    
    // Update payment follow-up record
    const paymentRecordIndex = paymentFollowUpState.findIndex(r => r.invoiceNo === invoiceNo);
    if (paymentRecordIndex !== -1) {
        const paymentRecord = paymentFollowUpState[paymentRecordIndex];
        
        // Update overall amounts
        paymentRecord.dueAmount = 0;
        paymentRecord.amountReceived = paymentRecord.invoiceAmount;
        paymentRecord.status = "Completed";
        paymentRecord.dueDate = "-"; // Show "-" when completed
        
        // CRITICAL FIX: Update ALL term breakdowns to mark them as fully paid
        // Each term: paidAmount = termAmount, dueAmount = 0, status = "Paid"
        paymentRecord.terms = paymentRecord.terms.map(term => ({
            ...term,
            paidAmount: term.termAmount, // Fully paid
            dueAmount: 0, // No amount due
            status: "Paid" as "Pending" | "Partial" | "Paid" // Mark as Paid
        }));
        
        console.log('[STORE] Payment record updated:', {
            invoiceNo,
            dueAmount: paymentRecord.dueAmount,
            amountReceived: paymentRecord.amountReceived,
            status: paymentRecord.status,
            dueDate: paymentRecord.dueDate,
            termsUpdated: paymentRecord.terms.length
        });
    }
    
    // Update sales follow-up record
    const salesRecordIndex = salesFollowUpState.findIndex(r => r.invoiceNo === invoiceNo);
    if (salesRecordIndex !== -1) {
        const salesRecord = salesFollowUpState[salesRecordIndex];
        
        // Update overall amounts
        salesRecord.dueAmount = 0;
        salesRecord.paidAmount = salesRecord.invoiceAmount;
        salesRecord.status = "Completed";
        salesRecord.dueDate = "-"; // Show "-" when completed
        
        // CRITICAL FIX: Update ALL term breakdowns to mark them as fully paid
        // Sync with payment follow-up terms
        if (paymentRecordIndex !== -1) {
            salesRecord.terms = paymentFollowUpState[paymentRecordIndex].terms.map(term => ({ ...term }));
        }
        
        console.log('[STORE] Sales record updated:', {
            invoiceNo,
            dueAmount: salesRecord.dueAmount,
            paidAmount: salesRecord.paidAmount,
            status: salesRecord.status,
            dueDate: salesRecord.dueDate,
            termsUpdated: salesRecord.terms.length
        });
    }
    
    // IMPORTANT: Sync payment data to Sales Order for Close SO button logic
    // This enables the Close SO button when due amount becomes 0
    if (paymentRecordIndex !== -1) {
        const paymentRecord = paymentFollowUpState[paymentRecordIndex];
        const soNumber = paymentRecord.soNumber;
        if (soNumber) {
            const salesOrders = getSalesOrders();
            const so = salesOrders.find(s => s.soNumber === soNumber);
            
            if (so) {
                updateSalesOrder(so.id, {
                    invoiceDueAmount: 0,
                    paymentStatus: "Completed"
                });
                
                console.log('[STORE] Payment completion synced to SO:', {
                    soNumber,
                    invoiceDueAmount: 0,
                    paymentStatus: "Completed"
                });
            }
        }
    }
    
    // Notify listeners of change
    notifyListeners();
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get current state snapshot (for debugging)
 */
export const getStoreSnapshot = () => ({
    salesFollowUp: salesFollowUpState,
    paymentFollowUp: paymentFollowUpState,
    listenerCount: listeners.length
});

/**
 * Get specific sales follow-up record (for debugging)
 */
export const debugGetSalesRecord = (invoiceNo: string) => {
    const record = salesFollowUpState.find(r => r.invoiceNo === invoiceNo);
    console.log(`[DEBUG] Sales Follow-Up Record for ${invoiceNo}:`, record);
    return record;
};

/**
 * Reset store to initial mock data (for testing purposes)
 * Note: This is automatically called on browser refresh
 */
export const resetStore = () => {
    initializeStore();
    notifyListeners();
};

// ============================================================================
// COMPLETE FLOW IMPLEMENTATION - NEW FUNCTIONS
// ============================================================================

/**
 * Calculate due date for a payment term based on term type
 * Rules:
 * - Advance: Due date = Invoice Date
 * - Days: Due date = Invoice Date + number of days
 * - Delivery: Due date = Delivery Date (if available), otherwise empty
 */
const calculateTermDueDate = (
    termType: string,
    invoiceDate: string,
    days?: number,
    deliveryDate?: string
): string => {
    const termTypeLower = termType.toLowerCase();
    
    if (termTypeLower === "advance") {
        // Advance payment due on invoice date
        return invoiceDate;
    } else if (termTypeLower === "days" && days) {
        // Payment due after specified number of days from invoice date
        const invoiceDateObj = new Date(invoiceDate);
        invoiceDateObj.setDate(invoiceDateObj.getDate() + days);
        return format(invoiceDateObj, "yyyy-MM-dd");
    } else if (termTypeLower === "delivery" || termTypeLower === "on delivery") {
        // Payment due on delivery date (if available)
        return deliveryDate || "";
    }
    
    // Default: use invoice date
    return invoiceDate;
};

/**
 * Calculate the next unpaid due date from payment terms
 * Returns the earliest due date among unpaid terms
 * Returns undefined if all terms are paid
 */
const calculateNextUnpaidDueDate = (terms: PaymentTermBreakdown[]): string | undefined => {
    // Filter unpaid terms (terms with dueAmount > 0)
    const unpaidTerms = terms.filter(term => term.dueAmount > 0 && term.dueDate);
    
    if (unpaidTerms.length === 0) {
        return undefined;
    }
    
    // Sort by due date and return the earliest
    const sortedTerms = unpaidTerms.sort((a, b) => {
        const dateA = new Date(a.dueDate).getTime();
        const dateB = new Date(b.dueDate).getTime();
        return dateA - dateB;
    });
    
    return sortedTerms[0].dueDate;
};

/**
 * Calculate follow-up status based on due amount and next unpaid term due date
 * Status Logic:
 * - Completed: Total due amount is 0 (all payments received)
 * - Upcoming: Total due amount > 0 AND today is before or equal to earliest unpaid term due date
 * - Overdue: Total due amount > 0 AND today is after the earliest unpaid term due date
 */
const calculateFollowUpStatus = (totalDueAmount: number, nextUnpaidDueDate: string | undefined): "Upcoming" | "Overdue" | "Completed" => {
    // If no due amount, status is Completed
    if (totalDueAmount === 0) {
        return "Completed";
    }
    
    // If there's due amount but no due date, default to Upcoming
    if (!nextUnpaidDueDate) {
        return "Upcoming";
    }
    
    // Compare today with the earliest unpaid term due date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(nextUnpaidDueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    // If today is after the due date, status is Overdue
    if (today.getTime() > dueDate.getTime()) {
        return "Overdue";
    }
    
    // Otherwise, status is Upcoming (today is before or equal to due date)
    return "Upcoming";
};

/**
 * Create follow-up record from dispatched invoice
 * Called automatically when dispatch is completed in Inventory module
 * Creates ONE record per invoice with payment terms as breakdown rows
 * CRITICAL: Always uses invoice.grandTotal for all calculations
 * UPDATED: Properly calculates due dates based on term types
 */
export const createFollowUpFromInvoice = (invoiceNo: string, soNumber: string, deliveryDate?: string): void => {
    console.log('[STORE] ========================================');
    console.log('[STORE] createFollowUpFromInvoice called', { invoiceNo, soNumber, deliveryDate });
    
    // CRITICAL: Check if follow-up already exists for this invoice
    // Must check BOTH independently to prevent partial duplicates
    const existingSales = salesFollowUpState.find(r => r.invoiceNo === invoiceNo);
    const existingPayment = paymentFollowUpState.find(r => r.invoiceNo === invoiceNo);
    
    console.log('[STORE] Duplicate check:', {
        invoiceNo,
        salesExists: !!existingSales,
        paymentExists: !!existingPayment
    });
    
    // If BOTH already exist, skip entirely
    if (existingSales && existingPayment) {
        console.log('[STORE] ⚠️ DUPLICATE SKIPPED - Both follow-up records already exist for invoice:', invoiceNo);
        return;
    }
    
    // If only one exists, log warning but continue to create the missing one
    if (existingSales) {
        console.log('[STORE] ⚠️ Sales Follow Up already exists, will only create Payment Follow Up');
    }
    if (existingPayment) {
        console.log('[STORE] ⚠️ Payment Follow Up already exists, will only create Sales Follow Up');
    }
    
    // Get invoice data
    const invoices = getInvoices();
    const invoice = invoices.find(inv => inv.invoiceNumber === invoiceNo);
    
    if (!invoice) {
        console.error('[STORE] ❌ Invoice not found:', invoiceNo);
        return;
    }
    
    // CRITICAL: Use invoice.grandTotal for ALL calculations
    // Grand Total = Subtotal - Discount + Tax
    const invoiceGrandTotal = invoice.grandTotal;
    
    console.log('[STORE] Invoice financial data:', {
        invoiceNo,
        subtotal: invoice.subtotal,
        discountAmount: invoice.discountAmount || 0,
        taxAmount: invoice.tax,
        grandTotal: invoiceGrandTotal,
        invoiceDate: invoice.invoiceDate,
        deliveryDate
    });
    
    // Calculate term breakdown from invoice terms
    // Each term amount = grandTotal × term percentage
    // Initialize ALL terms with paidAmount = 0, dueAmount = termAmount, status = Pending
    // UPDATED: Calculate proper due dates based on term types
    const terms = invoice.terms.map(term => {
        const termAmount = (invoiceGrandTotal * term.percentage) / 100;
        const dueDate = calculateTermDueDate(
            term.termType,
            invoice.invoiceDate,
            term.days,
            deliveryDate
        );
        
        return {
            id: term.id,
            termType: term.termType,
            percentage: term.percentage,
            termAmount: termAmount,
            dueDate: dueDate,
            paidAmount: 0, // Initialize to 0 - no payment yet
            dueAmount: termAmount, // Full amount is due
            status: "Pending" as "Pending" | "Partial" | "Paid", // All terms start as Pending
            paymentDate: undefined, // No payment yet
            days: term.days // Store days for "Days" term type
        };
    });
    
    // Calculate next unpaid due date (earliest unpaid term)
    const nextUnpaidDueDate = calculateNextUnpaidDueDate(terms);
    
    // Calculate follow-up status based on due amount and next unpaid due date
    const followUpStatus = calculateFollowUpStatus(invoiceGrandTotal, nextUnpaidDueDate);
    
    console.log('[STORE] Follow-up status calculated:', {
        totalDueAmount: invoiceGrandTotal,
        nextUnpaidDueDate,
        status: followUpStatus
    });
    
    // Verify term breakdown sums to grand total
    const termsTotal = terms.reduce((sum, term) => sum + term.termAmount, 0);
    console.log('[STORE] Term breakdown verification:', {
        grandTotal: invoiceGrandTotal,
        termsTotal: termsTotal,
        difference: Math.abs(invoiceGrandTotal - termsTotal),
        terms: terms.map(t => ({ 
            type: t.termType, 
            percentage: t.percentage, 
            amount: t.termAmount,
            dueDate: t.dueDate 
        }))
    });
    
    // CRITICAL: Create records independently to prevent partial duplicates
    // Only create Sales Follow Up if it doesn't exist
    if (!existingSales) {
        console.log('[STORE] Creating Sales Follow Up record...');
        
        const salesRecord: SalesFollowUpRecord = {
            invoiceNo: invoice.invoiceNumber,
            soNumber: soNumber,
            customerName: invoice.customerName,
            invoiceDate: invoice.invoiceDate,
            dueDate: nextUnpaidDueDate || "", // Use next unpaid due date
            invoiceAmount: invoiceGrandTotal, // ALWAYS use grand total
            paidAmount: 0, // Initialize to 0 - no payment yet
            dueAmount: invoiceGrandTotal, // Full grand total is due
            status: followUpStatus, // Use calculated status
            terms: [...terms],
            lastFollowUpDate: undefined,
            nextFollowUpDate: undefined,
            history: []
        };
        
        salesFollowUpState.push(salesRecord);
        console.log('[STORE] ✓ Sales Follow Up created for invoice:', invoice.invoiceNumber);
    } else {
        console.log('[STORE] ⊘ Sales Follow Up creation skipped - already exists');
    }
    
    // Only create Payment Follow Up if it doesn't exist
    if (!existingPayment) {
        console.log('[STORE] Creating Payment Follow Up record...');
        
        const paymentRecord: PaymentFollowUpRecord = {
            invoiceNo: invoice.invoiceNumber,
            soNumber: soNumber,
            customerName: invoice.customerName,
            invoiceDate: invoice.invoiceDate,
            dueDate: nextUnpaidDueDate || "", // Use next unpaid due date
            invoiceAmount: invoiceGrandTotal, // ALWAYS use grand total
            amountReceived: 0, // Initialize to 0 - no payment yet
            dueAmount: invoiceGrandTotal, // Full grand total is due
            status: followUpStatus, // Use calculated status
            terms: [...terms],
            lastFollowUpDate: undefined,
            history: []
        };
        
        paymentFollowUpState.push(paymentRecord);
        console.log('[STORE] ✓ Payment Follow Up created for invoice:', invoice.invoiceNumber);
    } else {
        console.log('[STORE] ⊘ Payment Follow Up creation skipped - already exists');
    }
    
    // IMPORTANT: Initialize SO payment tracking fields
    // This ensures the Dispatched SO detail view shows correct due amount
    const salesOrders = getSalesOrders();
    const so = salesOrders.find(s => s.soNumber === soNumber);
    
    if (so) {
        updateSalesOrder(so.id, {
            invoiceDueAmount: invoiceGrandTotal, // Full grand total is due (no payment yet)
            paymentStatus: "Pending"
        });
        
        console.log('[STORE] SO payment fields initialized:', {
            soNumber,
            invoiceDueAmount: invoiceGrandTotal,
            paymentStatus: "Pending"
        });
    }
    
    console.log('[STORE] Follow-up creation summary:', { 
        invoiceNo, 
        soNumber,
        invoiceAmount: invoiceGrandTotal,
        paidAmount: 0,
        dueAmount: invoiceGrandTotal,
        termsCount: terms.length,
        nextUnpaidDueDate,
        salesCreated: !existingSales,
        paymentCreated: !existingPayment
    });
    console.log('[STORE] Total Sales Follow Up records:', salesFollowUpState.length);
    console.log('[STORE] Total Payment Follow Up records:', paymentFollowUpState.length);
    console.log('[STORE] ========================================');
    
    // Notify listeners
    notifyListeners();
};

/**
 * Allocate payment to terms using FIFO (First In, First Out) logic
 * Payment is applied to the earliest unpaid term first
 * Returns updated terms array with new paid/due amounts
 * UPDATED: Sets paymentDate when term is paid
 */
export const allocatePaymentToTerms = (
    terms: PaymentTermBreakdown[],
    paymentAmount: number,
    paymentDate: string
): PaymentTermBreakdown[] => {
    console.log('[STORE] allocatePaymentToTerms called', { paymentAmount, paymentDate, termsCount: terms.length });
    
    let remainingPayment = paymentAmount;
    const updatedTerms = [...terms];
    
    // Sort terms by due date (FIFO - earliest first)
    updatedTerms.sort((a, b) => {
        const dateA = new Date(a.dueDate).getTime();
        const dateB = new Date(b.dueDate).getTime();
        return dateA - dateB;
    });
    
    // Allocate payment to terms in order
    for (let i = 0; i < updatedTerms.length && remainingPayment > 0; i++) {
        const term = updatedTerms[i];
        
        // Skip if term is already fully paid
        if (term.dueAmount <= 0) continue;
        
        // Calculate how much to allocate to this term
        const amountToAllocate = Math.min(remainingPayment, term.dueAmount);
        
        // Update term amounts
        term.paidAmount += amountToAllocate;
        term.dueAmount -= amountToAllocate;
        
        // Update term status and payment date
        if (term.dueAmount <= 0) {
            term.status = "Paid";
            term.paymentDate = paymentDate; // Record when payment was completed
        } else if (term.paidAmount > 0) {
            term.status = "Partial";
            term.paymentDate = paymentDate; // Record when partial payment was made
        }
        
        // Reduce remaining payment
        remainingPayment -= amountToAllocate;
        
        console.log('[STORE] Allocated to term', {
            termId: term.id,
            termType: term.termType,
            allocated: amountToAllocate,
            newPaidAmount: term.paidAmount,
            newDueAmount: term.dueAmount,
            newStatus: term.status,
            paymentDate: term.paymentDate
        });
    }
    
    return updatedTerms;
};

/**
 * Record payment against invoice with FIFO allocation
 * Updates both payment and sales follow-up records
 * Automatically sets status to "Completed" when dueAmount becomes 0
 */
export const recordPayment = (
    invoiceNo: string,
    paymentAmount: number,
    paymentDate: string,
    paymentMode: string,
    referenceNo?: string
): void => {
    console.log('[STORE] recordPayment called', { invoiceNo, paymentAmount, paymentDate, paymentMode });
    
    // Find payment follow-up record
    const paymentRecordIndex = paymentFollowUpState.findIndex(r => r.invoiceNo === invoiceNo);
    if (paymentRecordIndex === -1) {
        console.error('[STORE] Payment follow-up record not found:', invoiceNo);
        return;
    }
    
    const paymentRecord = paymentFollowUpState[paymentRecordIndex];
    
    // Allocate payment to terms using FIFO (includes paymentDate update)
    const updatedTerms = allocatePaymentToTerms(paymentRecord.terms, paymentAmount, paymentDate);
    
    // Update payment record
    paymentRecord.terms = updatedTerms;
    paymentRecord.amountReceived += paymentAmount;
    paymentRecord.dueAmount = Math.max(0, paymentRecord.invoiceAmount - paymentRecord.amountReceived);
    
    // Recalculate next unpaid due date
    const nextUnpaidDueDate = calculateNextUnpaidDueDate(updatedTerms);
    paymentRecord.dueDate = nextUnpaidDueDate || "-"; // Show "-" if all paid
    
    // Update status
    if (paymentRecord.dueAmount === 0) {
        paymentRecord.status = "Completed";
    }
    
    // Create payment history entry
    let historyNote = `Payment Received: USh${paymentAmount.toFixed(2)} | Mode: ${paymentMode}`;
    if (referenceNo) {
        if (paymentMode === "Cheque") {
            historyNote += ` | Cheque No: ${referenceNo}`;
        } else if (paymentMode === "Online") {
            historyNote += ` | Transaction ID: ${referenceNo}`;
        }
    }
    
    paymentRecord.history.push({
        followUpDate: paymentDate,
        note: historyNote
    });
    
    paymentRecord.lastFollowUpDate = paymentDate;
    
    // Sync to sales follow-up record
    const salesRecordIndex = salesFollowUpState.findIndex(r => r.invoiceNo === invoiceNo);
    if (salesRecordIndex !== -1) {
        salesFollowUpState[salesRecordIndex].terms = [...updatedTerms];
        salesFollowUpState[salesRecordIndex].paidAmount = paymentRecord.amountReceived;
        salesFollowUpState[salesRecordIndex].dueAmount = paymentRecord.dueAmount;
        salesFollowUpState[salesRecordIndex].dueDate = nextUnpaidDueDate || "-"; // Show "-" if all paid
        
        if (paymentRecord.dueAmount === 0) {
            salesFollowUpState[salesRecordIndex].status = "Completed";
        }
    }
    
    // IMPORTANT: Sync payment data to Sales Order for Close SO button logic
    // This enables the Close SO button when due amount becomes 0
    const soNumber = paymentRecord.soNumber;
    if (soNumber) {
        const salesOrders = getSalesOrders();
        const so = salesOrders.find(s => s.soNumber === soNumber);
        
        if (so) {
            updateSalesOrder(so.id, {
                invoiceDueAmount: paymentRecord.dueAmount,
                paymentStatus: paymentRecord.dueAmount === 0 
                    ? "Completed" 
                    : (paymentRecord.amountReceived > 0 ? "Partial" : "Pending")
            });
            
            console.log('[STORE] Payment data synced to SO:', {
                soNumber,
                invoiceDueAmount: paymentRecord.dueAmount,
                paymentStatus: paymentRecord.dueAmount === 0 
                    ? "Completed" 
                    : (paymentRecord.amountReceived > 0 ? "Partial" : "Pending")
            });
        }
    }
    
    console.log('[STORE] Payment recorded successfully', {
        invoiceNo,
        newAmountReceived: paymentRecord.amountReceived,
        newDueAmount: paymentRecord.dueAmount,
        newStatus: paymentRecord.status,
        nextUnpaidDueDate: nextUnpaidDueDate || "-"
    });
    
    // Notify listeners
    notifyListeners();
};

/**
 * Get payment data for a specific SO Number (for Dispatched SO detail view)
 * Primary method for resolving Close SO eligibility
 */
export const getPaymentDataBySONumber = (soNumber: string) => {
    const paymentRecord = paymentFollowUpState.find(r => r.soNumber === soNumber);
    const salesRecord = salesFollowUpState.find(r => r.soNumber === soNumber);
    
    if (!paymentRecord) {
        return null;
    }
    
    return {
        invoiceNo: paymentRecord.invoiceNo,
        invoiceAmount: paymentRecord.invoiceAmount,
        amountReceived: paymentRecord.amountReceived,
        dueAmount: paymentRecord.dueAmount,
        status: paymentRecord.status,
        terms: paymentRecord.terms,
        lastFollowUpDate: salesRecord?.lastFollowUpDate,
        nextFollowUpDate: salesRecord?.nextFollowUpDate
    };
};

