// ============================================================================
// PAYMENT FOLLOW UP COMPONENT (Accounting Module)
// Track payment follow-ups for invoices with due amounts
// 
// INTEGRATION WITH SALES FOLLOW UP:
// - Both modules work with the same Invoice data source (mockInvoices.ts)
// - Linked using Invoice No or Invoice ID
// - Records appear in both modules only when Due Amount > 0
// - Accounting team records payment activity (payment mode, amount received)
// - Sales team records customer communication (in Sales Follow Up module)
// - Sales Follow Up History displayed as read-only in Payment Follow Up popup
// - When payment is complete (Due Amount = 0), invoice is removed from both modules
// - Invoice status becomes "Paid" when fully paid
// 
// PAYMENT FOLLOW UP RESPONSIBILITIES:
// - Record payment activity (Payment Mode, Amount Received, Payment Note)
// - Track payment details (Cheque No, Transaction ID)
// - Update Due Amount = Invoice Amount - Total Amount Received
// - Each entry saved in Payment Activity History
// - Display Sales Follow Up History (read-only) for reference
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Eye, Download, Edit, Plus, CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getInvoices, type InvoiceData } from "@/lib/mockInvoices";
import { 
    getSalesFollowUpByInvoice, 
    getPaymentFollowUpByInvoice, 
    updatePaymentFollowUp,
    markInvoiceAsCompleted,
    subscribeToFollowUpStore,
    recordPayment,
    type FollowUpHistoryEntry,
    getPaymentFollowUpRecords,
    getSalesFollowUpRecords
} from "@/lib/followUpStore";
import { type PaymentTermBreakdown } from "@/lib/mockFollowUpData";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Payment Entry - for actual payment transactions
// UPDATED: Now stored persistently with invoice record
interface PaymentEntry {
    id: number;
    paymentDate: string;
    paymentMode: string;
    amountReceived: number;
    referenceNo?: string; // Cheque No or Transaction ID
    remainingDue: number;
}

// ============================================================================
// REMOVED: Activity Entry interface - Payment Activity section removed
// Communication/remarks should be recorded in Sales Follow Up module
// ============================================================================

interface FollowUpNote {
    id: number;
    date: string;
    note: string;
    paymentMode?: string;
    amountReceived?: string;
    chequeNo?: string;
    transactionId?: string;
}

interface FollowUpRecord {
    invoiceId: number;
    lastFollowUpDate?: string;
    nextFollowUpDate?: string;
    notes: FollowUpNote[];
    dueAmount?: number;
}

// ============================================================================
// COMPLETED STATUS FEATURE:
// - "Completed" status added when Due Amount = 0
// - Existing statuses: Upcoming, Overdue
// - Completed records are read-only (no edit allowed)
// ============================================================================
type FollowUpStatus = "Upcoming" | "Overdue" | "Completed";

interface FollowUpDisplay extends Omit<InvoiceData, 'status' | 'terms'> {
    dueAmount: number;
    status: FollowUpStatus;
    lastFollowUpDate?: string;
    nextFollowUpDate?: string;
    notes: FollowUpNote[];
    terms?: PaymentTermBreakdown[]; // Payment term breakdown
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Safe date formatting helper - validates date before formatting
const safeFormatDate = (dateValue: any, formatStr: string = "dd-MM-yyyy"): string => {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return "-";
    return format(date, formatStr);
};

// ============================================================================
// STATUS BADGE HELPER
// - Upcoming: Blue badge (payment due in future)
// - Overdue: Red badge (payment past due date)
// - Completed: Green badge (all payments received, Due Amount = 0)
// ============================================================================
const getFollowUpStatusBadge = (status: FollowUpStatus) => {
    switch (status) {
        case "Upcoming": return <Badge className="bg-blue-500 hover:bg-blue-600">Upcoming</Badge>;
        case "Overdue": return <Badge className="bg-red-500 hover:bg-red-600">Overdue</Badge>;
        case "Completed": return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
};

// ============================================================================
// DATE PICKER COMPONENT
// ============================================================================

function DatePicker({ date, setDate, disabled = false }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
    const [visibleDate, setVisibleDate] = useState(() => date || new Date());

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const monthNamesShort = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const formatDisplayDate = (date: Date | undefined) => {
        if (!date) return "Pick a date";
        try {
            return format(date, "dd/MM/yyyy");
        } catch (error) {
            return "Pick a date";
        }
    };

    const handleDateSelect = (selectedDate: Date) => {
        setDate(selectedDate);
        setIsOpen(false);
        setViewMode("day");
    };

    const handleMonthSelect = (monthIndex: number) => {
        const newDate = new Date(visibleDate.getFullYear(), monthIndex, 1);
        setVisibleDate(newDate);
        setViewMode("day");
    };

    const handleYearSelect = (year: number) => {
        const newDate = new Date(year, visibleDate.getMonth(), 1);
        setVisibleDate(newDate);
        setViewMode("month");
    };

    const navigateMonth = (direction: number) => {
        const newDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + direction, 1);
        setVisibleDate(newDate);
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];

        // Previous month's trailing days
        const prevMonth = new Date(year, month - 1, 0);
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const dayDate = new Date(year, month - 1, prevMonth.getDate() - i);
            dayDate.setHours(0, 0, 0, 0);
            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false,
                isPast: false
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            currentDate.setHours(0, 0, 0, 0);
            const isToday = new Date().toDateString() === currentDate.toDateString();
            const isSelected = date && currentDate.toDateString() === date.toDateString();

            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday,
                isSelected,
                isPast: false
            });
        }

        // Next month's leading days
        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day++) {
            const dayDate = new Date(year, month + 1, day);
            dayDate.setHours(0, 0, 0, 0);
            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false,
                isPast: false
            });
        }

        return days;
    };

    const renderDayView = () => {
        const days = getDaysInMonth(visibleDate);
        const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigateMonth(-1)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            className="font-semibold text-sm"
                            onClick={() => setViewMode("month")}
                        >
                            {monthNames[visibleDate.getMonth()]}
                            <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            className="font-semibold text-sm"
                            onClick={() => setViewMode("year")}
                        >
                            {visibleDate.getFullYear()}
                            <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigateMonth(1)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day) => (
                        <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, index) => (
                        <Button
                            key={index}
                            variant="ghost"
                            size="icon"
                            disabled={day.isPast}
                            className={cn(
                                "h-8 w-8 text-sm font-normal",
                                !day.isCurrentMonth && "text-muted-foreground opacity-50",
                                day.isToday && "bg-accent text-accent-foreground font-semibold",
                                day.isSelected && "bg-primary text-primary-foreground font-semibold",
                                day.isCurrentMonth && !day.isPast && "hover:bg-accent hover:text-accent-foreground",
                                day.isPast && "opacity-30 cursor-not-allowed text-muted-foreground"
                            )}
                            onClick={() => !day.isPast && handleDateSelect(day.date)}
                        >
                            {day.date.getDate()}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    const renderMonthView = () => {
        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewMode("day")}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{visibleDate.getFullYear()}</h3>
                    <Button
                        variant="ghost"
                        className="font-semibold text-sm"
                        onClick={() => setViewMode("year")}
                    >
                        {visibleDate.getFullYear()}
                        <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {monthNamesShort.map((month, index) => (
                        <Button
                            key={month}
                            variant="ghost"
                            className={cn(
                                "h-10 text-sm font-normal",
                                index === visibleDate.getMonth() && "bg-primary text-primary-foreground font-semibold"
                            )}
                            onClick={() => handleMonthSelect(index)}
                        >
                            {month}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    const renderYearView = () => {
        const currentYear = visibleDate.getFullYear();
        const startYear = Math.floor(currentYear / 12) * 12;
        const years = Array.from({ length: 12 }, (_, i) => startYear + i);

        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            const newStartYear = startYear - 12;
                            setVisibleDate(new Date(newStartYear, visibleDate.getMonth(), 1));
                        }}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{startYear} - {startYear + 11}</h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            const newStartYear = startYear + 12;
                            setVisibleDate(new Date(newStartYear, visibleDate.getMonth(), 1));
                        }}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {years.map((year) => (
                        <Button
                            key={year}
                            variant="ghost"
                            className={cn(
                                "h-10 text-sm font-normal",
                                year === currentYear && "bg-primary text-primary-foreground font-semibold"
                            )}
                            onClick={() => handleYearSelect(year)}
                        >
                            {year}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal flex h-10 rounded-md border border-input px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 hover:bg-white",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDisplayDate(date) : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 shadow-lg border rounded-lg z-[9999]" align="start" side="bottom" sideOffset={4}>
                {viewMode === "day" && renderDayView()}
                {viewMode === "month" && renderMonthView()}
                {viewMode === "year" && renderYearView()}
            </PopoverContent>
        </Popover>
    );
}



// ============================================================================
// MAIN SALES FOLLOW UP COMPONENT
// ============================================================================

const PaymentFollowUp = () => {
    const { toast } = useToast();
    const [, setLocation] = useLocation();

    // State management
    const [followUpRecords, setFollowUpRecords] = useState<FollowUpDisplay[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [activeRecord, setActiveRecord] = useState<FollowUpDisplay | null>(null);
    const [salesFollowUpHistory, setSalesFollowUpHistory] = useState<FollowUpHistoryEntry[]>([]);
    
    // Payment Entry form states (for Payment Details section)
    const [paymentDate, setPaymentDate] = useState<Date | undefined>(undefined);
    const [paymentMode, setPaymentMode] = useState<string>("");
    const [amountReceived, setAmountReceived] = useState("");
    const [chequeNo, setChequeNo] = useState("");
    const [transactionId, setTransactionId] = useState("");
    const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
    
    // ============================================================================
    // REMOVED: Activity Entry form states - Payment Activity section removed
    // Communication/remarks should be recorded in Sales Follow Up module
    // ============================================================================

    const loadFollowUpRecords = React.useCallback(() => {
        // CLEANUP: Always use the shared store as the primary source
        const paymentRecords = getPaymentFollowUpRecords();
        const salesRecords = getSalesFollowUpRecords();
        const invoices = getInvoices();
        
        console.log('[PENDING PAYMENT PAGE] Loading records:', {
            paymentRecordsCount: paymentRecords.length,
            salesRecordsCount: salesRecords.length,
            invoicesCount: invoices.length
        });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // CRITICAL: Only show invoices that have payment follow-up records
        // These are created automatically when dispatch is completed
        const records: FollowUpDisplay[] = paymentRecords.map(paymentFollowUp => {
            // Get the invoice data for additional details
            const invoice = invoices.find(inv => inv.invoiceNumber === paymentFollowUp.invoiceNo);
            
            if (!invoice) {
                console.warn('[PENDING PAYMENT PAGE] ❌ Missing invoice for record:', paymentFollowUp.invoiceNo);
                return null;
            }
            
            // Get corresponding sales follow-up data (for last/next follow-up dates)
            const salesFollowUp = getSalesFollowUpByInvoice(paymentFollowUp.invoiceNo);
            
            // Convert status to display type
            const status = paymentFollowUp.status as FollowUpStatus;
            
            // Convert payment follow-up activity to display notes
            const notes: FollowUpNote[] = paymentFollowUp.history.map((entry, index) => ({
                id: index + 1,
                date: entry.followUpDate,
                note: entry.note
            }));
            
            return {
                ...invoice,
                grandTotal: paymentFollowUp.invoiceAmount, // Use amount from store
                dueDate: paymentFollowUp.dueDate,
                dueAmount: paymentFollowUp.dueAmount,
                status,
                lastFollowUpDate: salesFollowUp?.lastFollowUpDate,
                nextFollowUpDate: salesFollowUp?.nextFollowUpDate,
                notes,
                terms: paymentFollowUp.terms
            } as FollowUpDisplay;
        }).filter((record): record is FollowUpDisplay => record !== null);

        console.log('[PENDING PAYMENT PAGE] Total display records:', records.length);
        setFollowUpRecords(records);
    }, []);

    // Initial load
    useEffect(() => {
        loadFollowUpRecords();
    }, [loadFollowUpRecords]);

    // Subscribe to store changes (updates from Sales Follow Up module)
    useEffect(() => {
        const unsubscribe = subscribeToFollowUpStore(() => {
            loadFollowUpRecords();
        });
        return unsubscribe;
    }, [loadFollowUpRecords]);

    // Filtering logic
    const filteredRecords = followUpRecords.filter(record => {
        const matchesSearch = record.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            record.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = filterStatus === "all" ? true : record.status === filterStatus;

        return matchesSearch && matchesStatus;
    }).sort((a, b) => {
        // Sort by due date priority: Overdue (oldest first) → Today → Upcoming (nearest first)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dateA = a.dueDate ? new Date(a.dueDate) : null;
        const dateB = b.dueDate ? new Date(b.dueDate) : null;
        
        if (dateA) dateA.setHours(0, 0, 0, 0);
        if (dateB) dateB.setHours(0, 0, 0, 0);
        
        // Handle null dates (push to end)
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        // Both have dates - sort by date ascending (earliest first)
        return dateA.getTime() - dateB.getTime();
    });

    // Pagination calculations
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedData = filteredRecords.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Auto-adjust page when data changes
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredRecords.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus]);

    // Open follow-up preview
    const handleOpenRecord = (record: FollowUpDisplay) => {
        setActiveRecord({ ...record });
        setIsDialogOpen(true);
    };

    // ============================================================================
    // OPEN EDIT DIALOG
    // Load both payment and sales follow-up history for the invoice
    // CRITICAL FIX: Now properly loads ALL payment entries from payment history
    // Format: "Payment Received: UShX.XX | Mode: Y | Cheque No: Z" or "Payment Received: UShX.XX | Mode: Y | Transaction ID: Z"
    // ============================================================================
    const handleEditRecord = (record: FollowUpDisplay) => {
        console.log('[PAYMENT DEBUG] ========================================');
        console.log('[PAYMENT DEBUG] Opening edit dialog for:', record.invoiceNumber);
        console.log('[PAYMENT DEBUG] Record state:', {
            invoiceNumber: record.invoiceNumber,
            grandTotal: record.grandTotal,
            dueAmount: record.dueAmount,
            termsCount: record.terms?.length || 0
        });
        
        // Get payment follow-up data from store to access full history
        const paymentFollowUp = getPaymentFollowUpByInvoice(record.invoiceNumber);
        console.log('[PAYMENT DEBUG] Payment follow-up data:', paymentFollowUp);
        
        // Update activeRecord with latest terms from store
        const updatedRecord = {
            ...record,
            terms: paymentFollowUp?.terms || record.terms || [],
            dueAmount: paymentFollowUp?.dueAmount ?? record.dueAmount
        };
        
        console.log('[PAYMENT DEBUG] Updated record with store data:', {
            dueAmount: updatedRecord.dueAmount,
            termsCount: updatedRecord.terms.length,
            terms: updatedRecord.terms.map(t => ({
                termType: t.termType,
                termAmount: t.termAmount,
                paidAmount: t.paidAmount,
                dueAmount: t.dueAmount,
                status: t.status
            }))
        });
        
        setActiveRecord(updatedRecord);
        
        // Reset Payment Entry form
        setPaymentDate(undefined);
        setPaymentMode("");
        setAmountReceived("");
        setChequeNo("");
        setTransactionId("");
        
        // CRITICAL FIX: Load ALL existing payment entries from payment history
        // Parse payment entries from history (format: "Payment Received: UShX.XX | Mode: Y | Cheque No: Z")
        const existingPayments: PaymentEntry[] = [];
        
        if (paymentFollowUp?.history) {
            console.log('[PAYMENT DEBUG] Processing payment history:', paymentFollowUp.history);
            
            paymentFollowUp.history.forEach((entry, index) => {
                // Match format: "Payment Received: UShX.XX | Mode: Y | Cheque No: Z" or "Payment Received: UShX.XX | Mode: Y | Transaction ID: Z"
                const match = entry.note.match(/Payment Received:\s*USh?([\d.]+)\s*\|\s*Mode:\s*(\w+)(?:\s*\|\s*(?:Cheque No|Transaction ID):\s*([^\s]+))?/);
                
                if (match) {
                    const amountReceived = parseFloat(match[1]);
                    const paymentMode = match[2];
                    const referenceNo = match[3] || undefined;
                    
                    existingPayments.push({
                        id: Date.now() + index,
                        paymentDate: entry.followUpDate,
                        paymentMode: paymentMode,
                        amountReceived: amountReceived,
                        referenceNo: referenceNo,
                        remainingDue: 0 // Will be calculated below
                    });
                    
                    console.log('[PAYMENT DEBUG] Parsed payment entry:', {
                        date: entry.followUpDate,
                        mode: paymentMode,
                        amount: amountReceived,
                        reference: referenceNo
                    });
                }
            });
        }
        
        console.log('[PAYMENT DEBUG] ========================================');
        console.log('[PAYMENT DEBUG] Payment entry calculation:', {
            recordGrandTotal: updatedRecord.grandTotal,
            recordDueAmount: updatedRecord.dueAmount,
            existingPaymentsCount: existingPayments.length,
            existingPaymentsTotal: existingPayments.reduce((sum, p) => sum + p.amountReceived, 0)
        });
        
        // FIXED: Calculate remaining due for each payment entry using the same logic as validation
        // Use the current due amount as the base (already accounts for existing payments)
        // Then calculate what the remaining due was after each historical payment
        let remainingDue = updatedRecord.grandTotal; // Start with full invoice amount
        existingPayments.forEach((entry, index) => {
            remainingDue -= entry.amountReceived;
            entry.remainingDue = Math.max(0, remainingDue);
            
            console.log('[PAYMENT DEBUG] Payment entry', index + 1, ':', {
                amount: entry.amountReceived,
                remainingAfter: entry.remainingDue
            });
        });
        
        console.log('[PAYMENT DEBUG] Final remaining due after all payments:', remainingDue);
        console.log('[PAYMENT DEBUG] Expected to match record.dueAmount:', updatedRecord.dueAmount);
        console.log('[PAYMENT DEBUG] ========================================');
        setPaymentEntries(existingPayments);
        
        // INTEGRATION: Fetch sales follow-up history for this invoice
        // This allows accounting team to see sales team's communication history
        const salesFollowUp = getSalesFollowUpByInvoice(record.invoiceNumber);
        setSalesFollowUpHistory(salesFollowUp?.history || []);
        
        setIsEditDialogOpen(true);
    };

    // Navigate to invoice detail page
    const handleInvoiceClick = (record: FollowUpDisplay) => {
        setLocation(`/accounting/invoicing?from=pending-payment&invoiceId=${record.id}&invoiceNumber=${record.invoiceNumber}`);
    };

    // ============================================================================
    // ADD PAYMENT ENTRY
    // Records actual payment transaction with date, mode, amount, and reference
    // ============================================================================
    const handleAddPaymentEntry = () => {
            // Validate required fields
            if (!paymentDate) {
                toast({
                    title: "Validation Error",
                    description: "Please select a payment date.",
                    variant: "destructive"
                });
                return;
            }

            if (!paymentMode) {
                toast({
                    title: "Validation Error",
                    description: "Please select a payment mode.",
                    variant: "destructive"
                });
                return;
            }

            if (!amountReceived || parseFloat(amountReceived) <= 0) {
                toast({
                    title: "Validation Error",
                    description: "Please enter a valid amount received.",
                    variant: "destructive"
                });
                return;
            }

            if (paymentMode === "Cheque" && !chequeNo.trim()) {
                toast({
                    title: "Validation Error",
                    description: "Please enter cheque number.",
                    variant: "destructive"
                });
                return;
            }

            if (paymentMode === "Online" && !transactionId.trim()) {
                toast({
                    title: "Validation Error",
                    description: "Please enter transaction ID.",
                    variant: "destructive"
                });
                return;
            }

            if (!activeRecord) return;

            // Get current payment follow-up data with terms
            const paymentFollowUp = getPaymentFollowUpByInvoice(activeRecord.invoiceNumber);
            if (!paymentFollowUp) {
                toast({
                    title: "Error",
                    description: "Payment follow-up data not found.",
                    variant: "destructive"
                });
                return;
            }

            const amountPaid = parseFloat(amountReceived);

            // CRITICAL FIX: Ensure we're using the most up-to-date data from the store
            const latestPaymentFollowUp = getPaymentFollowUpByInvoice(activeRecord.invoiceNumber);
            const latestDueAmount = latestPaymentFollowUp?.dueAmount ?? activeRecord.dueAmount;
            
            console.log('[PAYMENT VALIDATION] ========================================');
            console.log('[PAYMENT VALIDATION] Comprehensive validation check:', {
                invoiceNumber: activeRecord.invoiceNumber,
                enteredAmount: amountPaid,
                
                // Due amount sources
                activeRecordDueAmount: activeRecord.dueAmount,
                latestStoreDueAmount: latestPaymentFollowUp?.dueAmount,
                finalDueAmountUsed: latestDueAmount,
                
                // Invoice totals
                invoiceAmount: latestPaymentFollowUp?.invoiceAmount ?? activeRecord.grandTotal,
                amountReceived: latestPaymentFollowUp?.amountReceived ?? 0,
                
                // Payment entries
                paymentEntriesCount: paymentEntries.length,
                paymentEntriesTotal: paymentEntries.reduce((sum, entry) => sum + entry.amountReceived, 0),
                
                // Terms breakdown
                terms: (latestPaymentFollowUp?.terms ?? activeRecord.terms)?.map(t => ({
                    termType: t.termType,
                    termAmount: t.termAmount,
                    paidAmount: t.paidAmount,
                    dueAmount: t.dueAmount,
                    status: t.status
                })),
                
                // Validation calculation
                validationSource: 'Latest store data',
                isValidPayment: amountPaid <= latestDueAmount
            });
            
            // Use the latest due amount from store for validation
            const currentRemainingDue = latestDueAmount;

            console.log('[PAYMENT VALIDATION] Payment validation details:', {
                invoiceNumber: activeRecord.invoiceNumber,
                enteredAmount: amountPaid,
                currentRemainingDue: currentRemainingDue,
                activeRecordDueAmount: activeRecord.dueAmount,
                activeRecordGrandTotal: activeRecord.grandTotal,
                paymentEntriesCount: paymentEntries.length,
                paymentEntriesTotal: paymentEntries.reduce((sum, entry) => sum + entry.amountReceived, 0),
                validationSource: 'activeRecord.dueAmount (already accounts for existing payments)',
                terms: activeRecord.terms?.map(t => ({
                    termType: t.termType,
                    termAmount: t.termAmount,
                    paidAmount: t.paidAmount,
                    dueAmount: t.dueAmount,
                    status: t.status
                }))
            });

            // Validate payment amount doesn't exceed remaining due
            if (amountPaid > currentRemainingDue) {
                console.log('[PAYMENT VALIDATION] ❌ Validation failed:', {
                    amountPaid,
                    currentRemainingDue,
                    difference: amountPaid - currentRemainingDue
                });
                
                toast({
                    title: "Validation Error",
                    description: `Payment amount (USh${amountPaid.toFixed(2)}) exceeds remaining due (USh${currentRemainingDue.toFixed(2)}).`,
                    variant: "destructive"
                });
                return;
            }

            console.log('[PAYMENT VALIDATION] ✓ Validation passed:', {
                amountPaid,
                currentRemainingDue,
                remainingAfterPayment: currentRemainingDue - amountPaid
            });

            // Calculate remaining due after this payment
            const remainingDue = Math.max(0, currentRemainingDue - amountPaid);

            // Create payment entry
            const newPayment: PaymentEntry = {
                id: Date.now(),
                paymentDate: format(paymentDate, "yyyy-MM-dd"),
                paymentMode: paymentMode,
                amountReceived: amountPaid,
                referenceNo: paymentMode === "Cheque" ? chequeNo : paymentMode === "Online" ? transactionId : undefined,
                remainingDue: remainingDue
            };

            // Update payment entries
            const updatedPaymentEntries = [...paymentEntries, newPayment];
            setPaymentEntries(updatedPaymentEntries);

            // CRITICAL FIX: Immediately update activeRecord with new term breakdown
            // This ensures UI shows updated terms in real-time
            const totalPaidSoFar = updatedPaymentEntries.reduce((sum, entry) => sum + entry.amountReceived, 0);

            // Apply FIFO allocation to terms (sort by due date)
            let remainingPayment = totalPaidSoFar;
            const sortedTerms = [...paymentFollowUp.terms].sort((a, b) => {
                const dateA = new Date(a.dueDate).getTime();
                const dateB = new Date(b.dueDate).getTime();
                return dateA - dateB;
            });

            const updatedTerms = sortedTerms.map(term => {
                const updatedTerm = { ...term };

                // Reset to original amounts first
                updatedTerm.paidAmount = 0;
                updatedTerm.dueAmount = updatedTerm.termAmount;
                updatedTerm.status = "Pending";
                updatedTerm.paymentDate = undefined;

                return updatedTerm;
            });

            // Now apply all payments using FIFO
            remainingPayment = totalPaidSoFar;
            for (let i = 0; i < updatedTerms.length && remainingPayment > 0; i++) {
                const term = updatedTerms[i];

                if (term.dueAmount > 0) {
                    const amountToAllocate = Math.min(remainingPayment, term.dueAmount);
                    term.paidAmount = amountToAllocate;
                    term.dueAmount = term.termAmount - term.paidAmount;
                    remainingPayment -= amountToAllocate;

                    // Update status
                    if (term.dueAmount <= 0) {
                        term.status = "Paid";
                        term.paymentDate = format(paymentDate, "yyyy-MM-dd");
                    } else if (term.paidAmount > 0) {
                        term.status = "Partial";
                        term.paymentDate = format(paymentDate, "yyyy-MM-dd");
                    }
                }
            }

            // Update activeRecord with new terms
            setActiveRecord(prev => prev ? {
                ...prev,
                terms: updatedTerms,
                dueAmount: remainingDue
            } : null);

            // Reset payment form fields
            setPaymentDate(undefined);
            setPaymentMode("");
            setAmountReceived("");
            setChequeNo("");
            setTransactionId("");

            toast({
                title: "Payment Entry Added",
                description: `Payment of USh${amountPaid.toFixed(2)} recorded. Remaining due: USh${remainingDue.toFixed(2)}`
            });
        }

    // ============================================================================
    // REMOVED: handleAddActivityEntry function - Payment Activity section removed
    // Communication/remarks should be recorded in Sales Follow Up module
    // ============================================================================

    // ============================================================================
    // SAVE PAYMENT FOLLOW UP
    // Updates payment transactions and recalculates due amount
    // Updates shared store so changes are visible in Sales Follow Up
    // If due amount becomes 0, invoice is removed from both modules
    // ============================================================================
    const handleSaveFollowUp = () => {
                if (!activeRecord) return;

                // Validate that there are payment entries
                if (paymentEntries.length === 0) {
                    toast({
                        title: "Validation Error",
                        description: "Please add at least one payment entry before saving.",
                        variant: "destructive"
                    });
                    return;
                }

                // CRITICAL FIX: Get existing payment history from store to avoid overwriting
                const existingPaymentFollowUp = getPaymentFollowUpByInvoice(activeRecord.invoiceNumber);
                const existingPaymentCount = existingPaymentFollowUp?.history.filter(h => h.note.startsWith("Payment:")).length || 0;

                console.log('[PAYMENT SAVE] Existing payment history count:', existingPaymentCount);
                console.log('[PAYMENT SAVE] New payment entries to save:', paymentEntries.length);

                // Record each NEW payment using FIFO allocation
                // Only record payments that haven't been saved yet
                const newPayments = paymentEntries.slice(existingPaymentCount);

                console.log('[PAYMENT SAVE] New payments to record:', newPayments.length);

                newPayments.forEach(entry => {
                    console.log('[PAYMENT SAVE] Recording payment:', {
                        amount: entry.amountReceived,
                        date: entry.paymentDate,
                        mode: entry.paymentMode
                    });

                    recordPayment(
                        activeRecord.invoiceNumber,
                        entry.amountReceived,
                        entry.paymentDate,
                        entry.paymentMode,
                        entry.referenceNo
                    );
                });

                // Get updated record to check if completed
                const updatedPaymentFollowUp = getPaymentFollowUpByInvoice(activeRecord.invoiceNumber);
                const newDueAmount = updatedPaymentFollowUp?.dueAmount || 0;

                console.log('[PAYMENT SAVE] After save - Due amount:', newDueAmount);

                // COMPLETION RULE: If Due Amount becomes 0, status automatically changes to "Completed"
                if (newDueAmount === 0) {
                    toast({
                        title: "Payment Completed",
                        description: "All payments have been received. Invoice status changed to 'Completed'.",
                    });
                } else {
                    toast({
                        title: "Payment Follow-Up Saved",
                        description: `Payment recorded with FIFO allocation. Remaining due amount: USh${newDueAmount.toFixed(2)}`,
                    });
                }

                setIsEditDialogOpen(false);
                resetEditForm();

                // Reload data to reflect changes
                loadFollowUpRecords();
            }

    // ============================================================================
    // MARK AS COMPLETED
    // Manually mark invoice as fully paid (due amount = 0)
    // Updates shared store and sets status to "Completed"
    // CRITICAL: Validates that ALL term-wise due amounts are 0 before allowing completion
    // CRITICAL FIX: Now uses activeRecord.terms for real-time validation
    // ============================================================================
    const handleMarkAsCompleted = () => {
                    if (!activeRecord) return;

                    console.log('[MARK COMPLETE] Starting validation');

                    // FIXED: activeRecord.dueAmount already accounts for existing payments
                    // Only subtract currently typed amount (not yet saved)
                    const currentTypedAmount = parseFloat(amountReceived) || 0;

                    // FIXED: Calculate header due amount from activeRecord (source of truth)
                    const headerDueAmount = activeRecord.dueAmount - currentTypedAmount;

                    // CRITICAL: Use activeRecord.terms for real-time validation
                    const terms = activeRecord.terms || [];

                    // Check 1: Terms with due amount > 0
                    const termsWithDue = terms.filter(term => term.dueAmount > 0);

                    // Check 2: Terms not marked as "Paid"
                    const termsNotPaid = terms.filter(term => term.status !== "Paid");

                    // Check 3: Calculate total due from terms breakdown
                    const breakdownTotalDue = terms.reduce((sum, term) => sum + term.dueAmount, 0);

                    // Check 4: Latest payment history remaining due
                    const latestPaymentRemainingDue = paymentEntries.length > 0 
                        ? paymentEntries[paymentEntries.length - 1].remainingDue 
                        : activeRecord.dueAmount;

                    console.log('[MARK COMPLETE] Validation checks:', {
                        headerDueAmount,
                        breakdownTotalDue,
                        termsWithDueCount: termsWithDue.length,
                        termsNotPaidCount: termsNotPaid.length,
                        latestPaymentRemainingDue,
                        currentTypedAmount
                    });

                    // CRITICAL: All checks must pass for completion to be allowed
                    const canComplete = 
                        headerDueAmount <= 0 && 
                        breakdownTotalDue <= 0 && 
                        termsWithDue.length === 0 && 
                        termsNotPaid.length === 0 && 
                        latestPaymentRemainingDue <= 0;

                    if (!canComplete) {
                        const termDetails = termsWithDue.map(t => `${t.termType}: USh${t.dueAmount.toFixed(2)}`).join(', ');
                        const statusDetails = termsNotPaid.map(t => `${t.termType}: ${t.status}`).join(', ');

                        const failureReasons = [];
                        if (headerDueAmount > 0) failureReasons.push(`Header Due: USh${headerDueAmount.toFixed(2)}`);
                        if (breakdownTotalDue > 0) failureReasons.push(`Breakdown Total Due: USh${breakdownTotalDue.toFixed(2)}`);
                        if (termsWithDue.length > 0) failureReasons.push(`Terms with Due: ${termDetails}`);
                        if (termsNotPaid.length > 0) failureReasons.push(`Terms Not Paid: ${statusDetails}`);
                        if (latestPaymentRemainingDue > 0) failureReasons.push(`Latest Payment Remaining: USh${latestPaymentRemainingDue.toFixed(2)}`);

                        console.log('[MARK COMPLETE] Validation failed:', failureReasons);

                        toast({
                            title: "Cannot Complete Payment",
                            description: `All payment terms must be fully paid before completion.\n\n${failureReasons.join('\n')}\n\nPlease record all payments first.`,
                            variant: "destructive"
                        });
                        return;
                    }

                    console.log('[MARK COMPLETE] Validation passed - marking as completed');

                    // If there's a typed amount, auto-add it first
                    if (currentTypedAmount > 0 && paymentMode) {
                        const payDate = paymentDate || new Date();
                        const refNo = paymentMode === "Cheque" ? chequeNo : paymentMode === "Online" ? transactionId : undefined;

                        console.log('[MARK COMPLETE] Auto-adding typed payment:', currentTypedAmount);

                        recordPayment(
                            activeRecord.invoiceNumber,
                            currentTypedAmount,
                            format(payDate, "yyyy-MM-dd"),
                            paymentMode,
                            refNo
                        );
                    }

                    // Mark invoice as completed in store
                    markInvoiceAsCompleted(activeRecord.invoiceNumber);

                    toast({
                        title: "Payment Completed",
                        description: "Payment has been marked as completed. All terms are now fully paid."
                    });

                    setIsEditDialogOpen(false);
                    resetEditForm();
                    loadFollowUpRecords();
                }

    // Reset edit form
    const resetEditForm = () => {
        // Reset Payment Entry form
        setPaymentDate(undefined);
        setPaymentMode("");
        setAmountReceived("");
        setChequeNo("");
        setTransactionId("");
        setPaymentEntries([]);
        
        // ============================================================================
        // REMOVED: Activity Entry form reset - Payment Activity section removed
        // ============================================================================
    }

    // Download Payment Follow Up Report as PDF
    const handleDownloadPDF = () => {
            if (!activeRecord) return;

            // Get payment follow-up data from store to access payment history
            const paymentFollowUp = getPaymentFollowUpByInvoice(activeRecord.invoiceNumber);
            
            // Parse payment entries from payment history
            // Format: "Payment Received: {amount} | Mode: {mode} | Cheque No: {reference}" or "Payment Received: {amount} | Mode: {mode} | Transaction ID: {reference}"
            const paymentEntries = paymentFollowUp?.history
                .filter(entry => entry.note.startsWith("Payment Received:"))
                .map(entry => {
                    const match = entry.note.match(/Payment Received:\s*USh?([\d.]+)\s*\|\s*Mode:\s*(\w+)(?:\s*\|\s*(?:Cheque No|Transaction ID):\s*([^\s]+))?/);
                    if (match) {
                        return {
                            date: entry.followUpDate,
                            mode: match[2],
                            amount: parseFloat(match[1]),
                            reference: match[3] || "-"
                        };
                    }
                    return null;
                })
                .filter(entry => entry !== null) || [];

            // Calculate remaining due for each payment entry
            let remainingDue = activeRecord.grandTotal;
            const paymentsWithDue = paymentEntries.map(entry => {
                if (entry) {
                    remainingDue -= entry.amount;
                    return {
                        ...entry,
                        remainingDue: Math.max(0, remainingDue)
                    };
                }
                return null;
            }).filter(entry => entry !== null);

            let iframe = document.querySelector('iframe[name="print-frame"]') as HTMLIFrameElement;
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.name = 'print-frame';
                iframe.style.position = 'absolute';
                iframe.style.top = '-9999px';
                document.body.appendChild(iframe);
            }

            const htmlContent = `
                <html>
                    <head>
                        <title>Payment Collection Report - ${activeRecord.invoiceNumber}</title>
                        <style>
                            @page { size: A4; margin: 10mm; }
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; color: #1a1a1a; line-height: 1.4; font-size: 11px; background: white; }
                            .container { width: 100%; max-width: 100%; margin: 0 auto; }

                            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
                            .company-info h1 { margin: 0; color: #1a1a1a; font-size: 22px; font-weight: 800; text-transform: uppercase; }
                            .company-info p { margin: 2px 0; color: #4a4a4a; font-size: 10px; }

                            .document-title { text-align: right; }
                            .document-title h2 { margin: 0; font-size: 18px; color: #1a1a1a; }
                            .document-title p { margin: 2px 0; font-weight: 700; color: #1a1a1a; font-size: 12px; }
                            .document-title .generated { margin-top: 2px; font-size: 9px; color: #666; font-weight: 400; }

                            .section { border: 1px solid #d0d0d0; padding: 10px; border-radius: 6px; margin-bottom: 10px; }
                            .section h3 { margin: 0 0 8px 0; font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.05em; border-bottom: 1px solid #e8e8e8; padding-bottom: 4px; font-weight: bold; }
                            .info-item { margin-bottom: 4px; display: flex; }
                            .info-item strong { width: 140px; color: #4a4a4a; font-size: 10px; flex-shrink: 0; }
                            .info-item span { color: #1a1a1a; font-weight: 500; }

                            table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                            th { background-color: #f5f5f5; color: #333; font-size: 9px; text-transform: uppercase; padding: 8px 10px; border: 1px solid #d0d0d0; text-align: left; font-weight: bold; }
                            td { padding: 8px 10px; border: 1px solid #d0d0d0; font-size: 10px; }
                            .text-right { text-align: right; }
                            .font-bold { font-weight: 700; }

                            .table-section { margin-bottom: 15px; }
                            .table-section h3 { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 6px; letter-spacing: 0.05em; }

                            .footer { margin-top: 25px; padding-top: 10px; border-top: 1px solid #d0d0d0; text-align: center; font-size: 9px; color: #888; }

                            @media print {
                                body { -webkit-print-color-adjust: exact; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <div class="company-info">
                                    <h1>MASTER-ERP</h1>
                                    <p>Industrial Solutions & Services</p>
                                    <p>Ahmedabad, Gujarat, India</p>
                                </div>
                                <div class="document-title">
                                    <h2>PAYMENT COLLECTION REPORT</h2>
                                    <p>Reference: PCR-${activeRecord.id}</p>
                                    <p class="generated">Generated: ${format(new Date(), "dd/MM/yyyy, HH:mm")}</p>
                                </div>
                            </div>

                            <div class="section">
                                <h3>Customer Information</h3>
                                <div class="info-item"><strong>Customer Name:</strong><span>${activeRecord.customerName}</span></div>
                                <div class="info-item"><strong>Contact Person:</strong><span>${activeRecord.contactPerson || "-"}</span></div>
                                <div class="info-item"><strong>Mobile No:</strong><span>${activeRecord.mobileNo || "-"}</span></div>
                                <div class="info-item"><strong>Follow Up Status:</strong><span>${activeRecord.status}</span></div>
                            </div>

                            <div class="section">
                                <h3>Invoice Details</h3>
                                <div class="info-item"><strong>Invoice Number:</strong><span>${activeRecord.invoiceNumber}</span></div>
                                <div class="info-item"><strong>Invoice Date:</strong><span>${safeFormatDate(activeRecord.invoiceDate)}</span></div>
                                <div class="info-item"><strong>SO Number:</strong><span>${activeRecord.soNumber}</span></div>
                                <div class="info-item"><strong>SO Date:</strong><span>${safeFormatDate(activeRecord.soDate)}</span></div>
                                <div class="info-item"><strong>Delivery Date:</strong><span>${safeFormatDate(activeRecord.deliveryDate)}</span></div>
                                <div class="info-item"><strong>Currency:</strong><span>USh</span></div>
                            </div>

                            <div class="section">
                                <h3>Amount Summary</h3>
                                <div class="info-item"><strong>Invoice Amount:</strong><span>USh${activeRecord.grandTotal.toFixed(2)}</span></div>
                                <div class="info-item"><strong>Due Amount:</strong><span>USh${activeRecord.dueAmount.toFixed(2)}</span></div>
                                <div class="info-item"><strong>Last Follow Up:</strong><span>${activeRecord.lastFollowUpDate ? safeFormatDate(activeRecord.lastFollowUpDate) : "Not Yet"}</span></div>
                                <div class="info-item"><strong>Next Follow Up:</strong><span>${activeRecord.nextFollowUpDate ? safeFormatDate(activeRecord.nextFollowUpDate) : "Not Set"}</span></div>
                            </div>

                            ${activeRecord.terms && activeRecord.terms.length > 0 ? `
                            <div class="table-section">
                                <h3>Payment Terms Breakdown</h3>
                                <table>
                                    <thead>
                                        <tr>
                                            <th width="100">Term Type</th>
                                            <th width="70" class="text-right">Percentage</th>
                                            <th width="90" class="text-center">Due Date</th>
                                            <th width="90" class="text-right">Term Amount</th>
                                            <th width="90" class="text-right">Paid</th>
                                            <th width="90" class="text-right">Due</th>
                                            <th width="70" class="text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${activeRecord.terms.map(term => {
                                            const formattedDueDate = safeFormatDate(term.dueDate);
                                            return `
                                            <tr>
                                                <td class="font-bold">${term.termType}</td>
                                                <td class="text-right">${term.percentage}%</td>
                                                <td class="text-center">${formattedDueDate}</td>
                                                <td class="text-right font-bold">USh${term.termAmount.toFixed(2)}</td>
                                                <td class="text-right font-bold" style="color: #16a34a;">USh${term.paidAmount.toFixed(2)}</td>
                                                <td class="text-right font-bold" style="color: #ea580c;">USh${term.dueAmount.toFixed(2)}</td>
                                                <td class="text-center">
                                                    <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: bold; ${
                                                        term.status === 'Paid' ? 'background-color: #dcfce7; color: #166534;' :
                                                        term.status === 'Partial' ? 'background-color: #fef3c7; color: #92400e;' :
                                                        'background-color: #fee2e2; color: #991b1b;'
                                                    }">${term.status}</span>
                                                </td>
                                            </tr>
                                            `;
                                        }).join("")}
                                        <tr style="background-color: #e2e8f0; font-weight: bold;">
                                            <td colspan="3" class="font-bold text-right">TOTAL</td>
                                            <td class="text-right font-bold">USh${activeRecord.terms.reduce((sum, t) => sum + t.termAmount, 0).toFixed(2)}</td>
                                            <td class="text-right font-bold" style="color: #16a34a;">USh${activeRecord.terms.reduce((sum, t) => sum + t.paidAmount, 0).toFixed(2)}</td>
                                            <td class="text-right font-bold" style="color: #ea580c;">USh${activeRecord.terms.reduce((sum, t) => sum + t.dueAmount, 0).toFixed(2)}</td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            ` : ""}

                            <div class="table-section">
                                <h3>Payment Collection History</h3>
                                <table>
                                    <thead>
                                        <tr>
                                            <th width="100">Payment Date</th>
                                            <th width="100">Payment Mode</th>
                                            <th width="110" class="text-right">Amount Received</th>
                                            <th width="110">Reference No</th>
                                            <th width="110" class="text-right">Remaining Due</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${paymentsWithDue.length > 0 ? paymentsWithDue.map(payment => `
                                            <tr>
                                                <td class="font-bold">${safeFormatDate(payment.date)}</td>
                                                <td>${payment.mode}</td>
                                                <td class="text-right font-bold">USh${payment.amount.toFixed(2)}</td>
                                                <td>${payment.reference}</td>
                                                <td class="text-right font-bold">USh${payment.remainingDue.toFixed(2)}</td>
                                            </tr>
                                        `).join("") : `
                                            <tr>
                                                <td colspan="5" style="text-align: center; color: #888; font-style: italic;">No payment collection history recorded yet</td>
                                            </tr>
                                        `}
                                    </tbody>
                                </table>
                            </div>

                            <div class="footer">
                                <p>This is a computer-generated payment collection tracking document</p>
                                <p>Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
                            </div>
                        </div>
                    </body>
                </html>
            `;

            const doc = iframe.contentWindow?.document || iframe.contentDocument;
            if (doc) {
                doc.open();
                doc.write(htmlContent);
                doc.close();

                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                }, 500);
            }
        }

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <h1 className="text-3xl font-bold tracking-tight">Pending Payment</h1>

            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="w-full sm:flex-1">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by Customer, Invoice No..."
                            className="pl-10 h-10 rounded-md border-input bg-background"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                </div>
                <div className="w-full sm:w-48">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
                    <Select value={filterStatus} onValueChange={(val) => {
                        setFilterStatus(val);
                        setCurrentPage(1);
                    }}>
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="Upcoming">Upcoming</SelectItem>
                            <SelectItem value="Overdue">Overdue</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Follow Up Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Customer Name</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Invoice No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">Invoice Amount</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">Due Amount</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Due Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Last Follow Up</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Next Follow Up</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-32 text-center text-muted-foreground italic">
                                            No follow-up records found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((record) => (
                                        <TableRow key={record.id} className="hover:bg-muted/30 transition-colors border-b last:border-none">
                                            <TableCell className="py-4 font-bold text-sm">{record.customerName}</TableCell>
                                            <TableCell className="py-4 font-mono font-medium">
                                                <button
                                                    onClick={() => handleInvoiceClick(record)}
                                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors cursor-pointer"
                                                >
                                                    {record.invoiceNumber}
                                                </button>
                                            </TableCell>
                                            <TableCell className="py-4 text-right text-sm font-bold text-green-600">USh{record.grandTotal.toFixed(2)}</TableCell>
                                            <TableCell className="py-4 text-right text-sm font-bold text-orange-600">USh{record.dueAmount.toFixed(2)}</TableCell>
                                            <TableCell className="py-4 text-sm font-medium">
                                                {safeFormatDate(record.dueDate)}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                {safeFormatDate(record.lastFollowUpDate) !== "-" ? safeFormatDate(record.lastFollowUpDate) : "-"}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                {safeFormatDate(record.nextFollowUpDate) !== "-" ? safeFormatDate(record.nextFollowUpDate) : "-"}
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                {getFollowUpStatusBadge(record.status)}
                                            </TableCell>
                                            <TableCell className="py-4 text-right pr-6">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* View button - Always visible for all records */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        onClick={() => handleOpenRecord(record)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {/* Edit button - Hidden for Completed records (status === "Completed") */}
                                                    {/* Completed records are read-only and cannot be edited */}
                                                    {record.status !== "Completed" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                                            onClick={() => handleEditRecord(record)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {filteredRecords.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredRecords.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Follow Up Preview Dialog - PDF Style Document */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-[900px] max-h-[95vh] flex flex-col p-0">
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
                        {/* A4 Page Container */}
                        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl" style={{ minHeight: '297mm' }}>
                            {/* PDF Document Content */}
                            <div className="p-12">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-800">
                                    <div>
                                        <h1 className="text-2xl font-bold text-slate-900 mb-1">MASTER-ERP</h1>
                                        <p className="text-xs text-slate-600">Industrial Solutions & Services</p>
                                        <p className="text-xs text-slate-600">Ahmedabad, Gujarat, India</p>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="text-xl font-bold text-slate-800">PAYMENT COLLECTION REPORT</h2>
                                        <p className="text-xs text-slate-700 mt-1 font-semibold">Reference: PCR-{activeRecord?.id}</p>
                                        <p className="text-[9px] text-slate-500 mt-1">Generated: {format(new Date(), "dd/MM/yyyy, HH:mm")}</p>
                                    </div>
                                </div>

                                {/* Customer & Invoice Information Section */}
                                <div className="border border-slate-200 rounded-lg p-4 mb-4">
                                    <h3 className="text-[9px] uppercase font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200 tracking-wide">Customer & Invoice Information</h3>
                                    <div className="space-y-1.5">
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Customer Name:</span>
                                            <span className="font-bold text-slate-900">{activeRecord?.customerName}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">SO Number:</span>
                                            <span className="font-bold text-slate-900">{activeRecord?.soNumber}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Invoice Number:</span>
                                            <span className="font-bold text-slate-900">{activeRecord?.invoiceNumber}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Invoice Date:</span>
                                            <span className="font-medium text-slate-900">
                                                {safeFormatDate(activeRecord?.invoiceDate)}
                                            </span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Due Date:</span>
                                            <span className="font-medium text-slate-900">
                                                {safeFormatDate(activeRecord?.dueDate)}
                                            </span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Payment Status:</span>
                                            <span className="font-medium text-slate-900">{activeRecord?.status}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Summary Section */}
                                <div className="border border-slate-200 rounded-lg p-4 mb-4">
                                    <h3 className="text-[9px] uppercase font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200 tracking-wide">Payment Summary</h3>
                                    <div className="space-y-1.5">
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Invoice Amount:</span>
                                            <span className="font-bold text-slate-900">USh{activeRecord?.grandTotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Amount Received:</span>
                                            <span className="font-bold text-slate-900">USh{(activeRecord ? activeRecord.grandTotal - activeRecord.dueAmount : 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Due Amount:</span>
                                            <span className="font-bold text-slate-900">USh{activeRecord?.dueAmount.toFixed(2)}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Last Follow Up:</span>
                                            <span className="font-medium text-slate-900">
                                                {activeRecord?.lastFollowUpDate ? safeFormatDate(activeRecord.lastFollowUpDate) : "Not Yet"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Terms Breakdown Section */}
                                {activeRecord?.terms && activeRecord.terms.length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="text-[9px] font-bold text-slate-600 mb-2 uppercase tracking-wide">Payment Terms Breakdown</h3>
                                        <table className="w-full border-collapse border border-slate-300">
                                            <thead>
                                                <tr className="bg-slate-50">
                                                    <th className="border border-slate-300 px-3 py-2 text-left text-[9px] uppercase font-bold text-slate-600">Term Type</th>
                                                    <th className="border border-slate-300 px-3 py-2 text-center text-[9px] uppercase font-bold text-slate-600">Percentage</th>
                                                    <th className="border border-slate-300 px-3 py-2 text-center text-[9px] uppercase font-bold text-slate-600">Due Date</th>
                                                    <th className="border border-slate-300 px-3 py-2 text-right text-[9px] uppercase font-bold text-slate-600">Term Amount</th>
                                                    <th className="border border-slate-300 px-3 py-2 text-right text-[9px] uppercase font-bold text-slate-600">Paid</th>
                                                    <th className="border border-slate-300 px-3 py-2 text-right text-[9px] uppercase font-bold text-slate-600">Due</th>
                                                    <th className="border border-slate-300 px-3 py-2 text-center text-[9px] uppercase font-bold text-slate-600">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeRecord.terms.map((term, index) => (
                                                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                        <td className="border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">
                                                            {term.termType}
                                                        </td>
                                                        <td className="border border-slate-300 px-3 py-2 text-xs text-center text-slate-600">
                                                            {term.percentage}%
                                                        </td>
                                                        <td className="border border-slate-300 px-3 py-2 text-xs text-center text-slate-600">
                                                            {safeFormatDate(term.dueDate)}
                                                        </td>
                                                        <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-slate-700">
                                                            USh{term.termAmount.toFixed(2)}
                                                        </td>
                                                        <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-green-600">
                                                            USh{term.paidAmount.toFixed(2)}
                                                        </td>
                                                        <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-orange-600">
                                                            USh{term.dueAmount.toFixed(2)}
                                                        </td>
                                                        <td className="border border-slate-300 px-3 py-2 text-center">
                                                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                                                                term.status === "Paid" ? "bg-green-100 text-green-700" :
                                                                term.status === "Partial" ? "bg-yellow-100 text-yellow-700" :
                                                                "bg-red-100 text-red-700"
                                                            }`}>
                                                                {term.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-slate-200 font-bold">
                                                    <td colSpan={3} className="border border-slate-300 px-3 py-2 text-xs text-right text-slate-700">
                                                        Total:
                                                    </td>
                                                    <td className="border border-slate-300 px-3 py-2 text-xs text-right text-slate-900">
                                                        USh{activeRecord.terms.reduce((sum, t) => sum + t.termAmount, 0).toFixed(2)}
                                                    </td>
                                                    <td className="border border-slate-300 px-3 py-2 text-xs text-right text-green-700">
                                                        USh{activeRecord.terms.reduce((sum, t) => sum + t.paidAmount, 0).toFixed(2)}
                                                    </td>
                                                    <td className="border border-slate-300 px-3 py-2 text-xs text-right text-orange-700">
                                                        USh{activeRecord.terms.reduce((sum, t) => sum + t.dueAmount, 0).toFixed(2)}
                                                    </td>
                                                    <td className="border border-slate-300 px-3 py-2"></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Dummy div to replace old structure */}
                                <div className="hidden">
                                    <div className="border border-slate-200 p-4 rounded">
                                        <h3 className="text-[9px] uppercase font-bold text-slate-500 mb-3 pb-2 border-b border-slate-200">Invoice Details</h3>
                                        <div className="space-y-2">
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Customer Name</span>
                                                <span className="font-bold text-slate-900">{activeRecord?.customerName}</span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Invoice No</span>
                                                <span className="font-bold text-blue-600">{activeRecord?.invoiceNumber}</span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Invoice Date</span>
                                                <span className="font-medium text-slate-900">
                                                    {safeFormatDate(activeRecord?.invoiceDate)}
                                                </span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Due Date</span>
                                                <span className="font-medium text-slate-900">
                                                    {safeFormatDate(activeRecord?.dueDate)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border border-slate-200 p-4 rounded">
                                        <h3 className="text-[9px] uppercase font-bold text-slate-500 mb-3 pb-2 border-b border-slate-200">Amount Details</h3>
                                        <div className="space-y-2">
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Invoice Amount</span>
                                                <span className="font-bold text-green-600">USh{activeRecord?.grandTotal.toFixed(2)}</span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Due Amount</span>
                                                <span className="font-bold text-orange-600">USh{activeRecord?.dueAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Status</span>
                                                <span className="font-medium">{activeRecord?.status}</span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Last Follow Up</span>
                                                <span className="font-medium text-slate-900">
                                                    {activeRecord?.lastFollowUpDate ? safeFormatDate(activeRecord.lastFollowUpDate) : "-"}
                                                </span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Next Follow Up</span>
                                                <span className="font-bold text-blue-600">
                                                    {activeRecord?.nextFollowUpDate ? safeFormatDate(activeRecord.nextFollowUpDate) : "-"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Collection History Table */}
                                <div className="mb-6">
                                    <h3 className="text-[9px] font-bold text-slate-600 mb-2 uppercase tracking-wide">Payment Collection History</h3>
                                    <table className="w-full border-collapse border border-slate-300">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="border border-slate-300 px-3 py-2 text-left text-[9px] uppercase font-bold text-slate-600">Payment Date</th>
                                                <th className="border border-slate-300 px-3 py-2 text-left text-[9px] uppercase font-bold text-slate-600">Payment Mode</th>
                                                <th className="border border-slate-300 px-3 py-2 text-right text-[9px] uppercase font-bold text-slate-600">Amount Received</th>
                                                <th className="border border-slate-300 px-3 py-2 text-left text-[9px] uppercase font-bold text-slate-600">Reference No</th>
                                                <th className="border border-slate-300 px-3 py-2 text-right text-[9px] uppercase font-bold text-slate-600">Remaining Due</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeRecord && (() => {
                                                // Parse payment entries from notes
                                                const paymentEntries = activeRecord.notes
                                                    .filter(note => note.note.startsWith("Payment:"))
                                                    .map(note => {
                                                        const match = note.note.match(/Payment:\s*(\w+)\s*-\s*USh?([\d.]+)(?:\s*\(([^)]+)\))?/);
                                                        if (match) {
                                                            return {
                                                                date: note.date,
                                                                mode: match[1],
                                                                amount: parseFloat(match[2]),
                                                                reference: match[3] || "-"
                                                            };
                                                        }
                                                        return null;
                                                    })
                                                    .filter(entry => entry !== null);

                                                // Calculate remaining due for each payment
                                                let remainingDue = activeRecord.grandTotal;
                                                const paymentsWithDue = paymentEntries.map(entry => {
                                                    if (entry) {
                                                        remainingDue -= entry.amount;
                                                        return {
                                                            ...entry,
                                                            remainingDue: Math.max(0, remainingDue)
                                                        };
                                                    }
                                                    return null;
                                                }).filter(entry => entry !== null);

                                                return paymentsWithDue.length > 0 ? (
                                                    paymentsWithDue.map((payment, index) => (
                                                        <tr key={index}>
                                                            <td className="border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">
                                                                {safeFormatDate(payment.date)}
                                                            </td>
                                                            <td className="border border-slate-300 px-3 py-2 text-xs text-slate-600">
                                                                {payment.mode}
                                                            </td>
                                                            <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-slate-700">
                                                                USh{payment.amount.toFixed(2)}
                                                            </td>
                                                            <td className="border border-slate-300 px-3 py-2 text-xs text-slate-600">
                                                                {payment.reference}
                                                            </td>
                                                            <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-slate-700">
                                                                USh{payment.remainingDue.toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={5} className="border border-slate-300 px-3 py-4 text-center text-xs text-slate-500 italic">
                                                            No payment collection history recorded yet
                                                        </td>
                                                    </tr>
                                                );
                                            })()}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer */}
                                <div className="mt-8 pt-4 border-t border-slate-200 text-center">
                                    <p className="text-[9px] text-slate-500">This is a computer-generated payment collection tracking document</p>
                                    <p className="text-[9px] text-slate-600 font-semibold">Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons Outside Document */}
                    <div className="flex justify-end gap-3 p-4 border-t bg-white">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Close
                        </Button>
                        <Button 
                            onClick={handleDownloadPDF} 
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Pending Payment Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-[900px] max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle className="text-2xl font-bold">
                            {activeRecord?.status === "Completed" ? "View Pending Payment (Read-Only)" : "Edit Pending Payment"}
                        </DialogTitle>
                        <DialogDescription>
                            {activeRecord?.status === "Completed" 
                                ? "This record is completed and cannot be edited. All payments have been received."
                                : "Record payment activity and update payment details"
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        {/* Readonly Header Section */}
                        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Customer Name</Label>
                                <p className="text-sm font-bold text-slate-900">{activeRecord?.customerName}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">SO Number</Label>
                                <p className="text-sm font-bold text-primary">{activeRecord?.soNumber}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice No</Label>
                                <p className="text-sm font-bold text-blue-600">{activeRecord?.invoiceNumber}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice Amount</Label>
                                <p className="text-sm font-bold text-green-600">USh{activeRecord?.grandTotal.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Due Amount</Label>
                                <p className="text-sm font-bold text-orange-600">
                                    USh{(() => {
                                        // CRITICAL FIX: Calculate due amount from term breakdown totals
                                        // This ensures header due amount matches breakdown total
                                        const terms = activeRecord?.terms || [];
                                        if (terms.length > 0) {
                                            const totalDueFromTerms = terms.reduce((sum, term) => sum + term.dueAmount, 0);
                                            return totalDueFromTerms.toFixed(2);
                                        }
                                        return activeRecord?.dueAmount.toFixed(2) || "0.00";
                                    })()}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                                {activeRecord && getFollowUpStatusBadge(activeRecord.status)}
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Due Date</Label>
                                <p className="text-sm font-medium text-slate-700">
                                    {activeRecord?.dueDate && !isNaN(new Date(activeRecord.dueDate).getTime()) 
                                        ? format(new Date(activeRecord.dueDate), "dd-MM-yyyy") 
                                        : "-"}
                                </p>
                            </div>
                        </div>

                        {/* ============================================================================
                            COMPLETED STATUS: Read-only message for completed records
                            When status is "Completed", show informational message
                            ============================================================================ */}
                        {activeRecord?.status === "Completed" && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm text-green-800 font-medium">
                                    ✓ This invoice has been fully paid. Payment entry is disabled for completed records.
                                </p>
                            </div>
                        )}

                        {/* ============================================================================
                            SALES FOLLOW UP HISTORY (READ-ONLY)
                            Displays sales team's communication history for reference
                            Appears directly after header section in Payment Follow Up popup
                            ============================================================================ */}
                        <div className="space-y-3">
                            <Label className="text-sm font-bold">Sales Follow Up History</Label>
                            {salesFollowUpHistory.length > 0 ? (
                                <div className="border rounded-lg overflow-hidden bg-slate-50">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-100">
                                                <TableHead className="font-bold w-[150px]">Date</TableHead>
                                                <TableHead className="font-bold">Note</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {salesFollowUpHistory.map((entry, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-medium">
                                                        {format(new Date(entry.followUpDate), "dd-MM-yyyy")}
                                                    </TableCell>
                                                    <TableCell className="text-slate-600">{entry.note}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 rounded-lg border text-center">
                                    <p className="text-sm text-muted-foreground italic">No sales follow-up history available</p>
                                </div>
                            )}
                        </div>

                        {/* ============================================================================
                            PAYMENT TERMS BREAKDOWN
                            Shows how the invoice amount is divided into payment terms
                            Displays current paid/due amounts for each term
                            Updates dynamically when payments are recorded
                            CRITICAL FIX: Now reads from activeRecord.terms for real-time updates
                            ============================================================================ */}
                        {(() => {
                            // CRITICAL FIX: Use activeRecord.terms which is updated in real-time
                            // instead of fetching from store which only updates on save
                            const terms = activeRecord?.terms || [];
                            
                            if (terms.length > 0) {
                                return (
                                    <div className="space-y-3">
                                        <Label className="text-sm font-bold">Payment Terms Breakdown</Label>
                                        <div className="border rounded-lg overflow-hidden shadow-sm">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-100 border-b-2 border-slate-300">
                                                        <TableHead className="font-bold text-slate-700 py-3 px-4 w-[140px]">Term Type</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-center py-3 px-4 w-[100px]">Percentage</TableHead>
                                                        <TableHead className="font-bold text-slate-700 py-3 px-4 w-[120px]">Due Date</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-right py-3 px-4 w-[130px]">Term Amount</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-right py-3 px-4 w-[120px]">Paid</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-right py-3 px-4 w-[120px]">Due</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-center py-3 px-4 w-[100px]">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {terms.map((term, index) => (
                                                        <TableRow 
                                                            key={term.id} 
                                                            className={index % 2 === 0 ? 'border-b border-slate-200 transition-colors bg-white hover:bg-slate-50' : 'border-b border-slate-200 transition-colors bg-slate-50 hover:bg-slate-100'}
                                                        >
                                                            <TableCell className="font-medium text-slate-900 py-3 px-4">{term.termType}</TableCell>
                                                            <TableCell className="text-center text-slate-700 py-3 px-4">{term.percentage}%</TableCell>
                                                            <TableCell className="text-center text-slate-700 py-3 px-4">
                                                                {term.dueDate ? format(new Date(term.dueDate), "dd-MM-yyyy") : "-"}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-slate-900 py-3 px-4">
                                                                USh{term.termAmount.toFixed(2)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-green-600 py-3 px-4">
                                                                USh{term.paidAmount.toFixed(2)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-orange-600 py-3 px-4">
                                                                USh{term.dueAmount.toFixed(2)}
                                                            </TableCell>
                                                            <TableCell className="text-center py-3 px-4">
                                                                <Badge 
                                                                    variant={
                                                                        term.status === "Paid" ? "default" :
                                                                        term.status === "Partial" ? "secondary" :
                                                                        "outline"
                                                                    }
                                                                    className="min-w-[70px] justify-center"
                                                                >
                                                                    {term.status}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    <TableRow className="bg-slate-200 border-t-2 border-slate-400">
                                                        <TableCell colSpan={3} className="text-right font-bold text-slate-900 py-4 px-4 text-base">
                                                            Total:
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-slate-900 py-4 px-4 text-base">
                                                            USh{terms.reduce((sum, t) => sum + t.termAmount, 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-green-700 py-4 px-4 text-base">
                                                            USh{terms.reduce((sum, t) => sum + t.paidAmount, 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-orange-700 py-4 px-4 text-base">
                                                            USh{terms.reduce((sum, t) => sum + t.dueAmount, 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="py-4 px-4"></TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {/* ============================================================================
                            PAYMENT DETAILS SECTION
                            Fields: Payment Mode, Amount Received, Remaining Due, Cheque No/Transaction ID
                            DISABLED for completed records
                            ============================================================================ */}
                        {activeRecord?.status !== "Completed" && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Payment Details</h3>
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <div className="flex items-end gap-3">
                                        <div className="flex-none w-36">
                                            <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Payment Date <span className="text-red-500">*</span></Label>
                                            <DatePicker 
                                                date={paymentDate} 
                                                setDate={setPaymentDate}
                                        />
                                    </div>

                                    <div className="flex-none w-40">
                                        <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Payment Mode <span className="text-red-500">*</span></Label>
                                        <Select value={paymentMode} onValueChange={setPaymentMode}>
                                            <SelectTrigger className="h-10 bg-white border-slate-300">
                                                <SelectValue placeholder="Select mode" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Cash">Cash</SelectItem>
                                                <SelectItem value="Cheque">Cheque</SelectItem>
                                                <SelectItem value="Online">Online</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex-none w-36">
                                        <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Amount Received <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="number"
                                            value={amountReceived}
                                            onChange={(e) => setAmountReceived(e.target.value)}
                                            placeholder="0.00"
                                            className="h-10 bg-white border-slate-300"
                                            step="0.01"
                                            min="0"
                                        />
                                    </div>

                                    {paymentMode === "Cheque" && (
                                        <div className="flex-none w-40">
                                            <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Cheque No <span className="text-red-500">*</span></Label>
                                            <Input
                                                value={chequeNo}
                                                onChange={(e) => setChequeNo(e.target.value)}
                                                placeholder="Enter cheque no"
                                                className="h-10 bg-white border-slate-300"
                                            />
                                        </div>
                                    )}

                                    {paymentMode === "Online" && (
                                        <div className="flex-none w-40">
                                            <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Transaction ID <span className="text-red-500">*</span></Label>
                                            <Input
                                                value={transactionId}
                                                onChange={(e) => setTransactionId(e.target.value)}
                                                placeholder="Enter txn ID"
                                                className="h-10 bg-white border-slate-300"
                                            />
                                        </div>
                                    )}

                                    <div className="flex-none">
                                        <Button 
                                            onClick={handleAddPaymentEntry}
                                            size="icon"
                                            className="h-10 w-10 rounded-lg"
                                        >
                                            <Plus className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Remaining Due Preview */}
                                {(() => {
                                    const currentAmount = parseFloat(amountReceived) || 0;
                                    if (currentAmount <= 0) return null;

                                    // activeRecord.dueAmount is already the remaining due after existing payments
                                    // So we only need to subtract the current payment amount
                                    const currentDue = activeRecord?.dueAmount || 0;
                                    const remainingDue = Math.max(0, currentDue - currentAmount);

                                    return (
                                        <div className="mt-3 pt-3 border-t border-blue-200">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-slate-600">Remaining Due After This Entry:</span>
                                                <span className={`text-sm font-bold ${
                                                    remainingDue === 0 ? 'text-green-600' : 'text-orange-600'
                                                }`}>
                                                    USh{remainingDue.toFixed(2)}
                                                </span>
                                                {remainingDue === 0 && (
                                                    <span className="text-green-600 text-xs">✓ Fully Paid</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                        )}

                        {/* Payment History Table */}
                        <div className="space-y-3">
                            <Label className="text-sm font-bold">Payment History</Label>
                            {paymentEntries.length > 0 ? (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="font-bold">Payment Date</TableHead>
                                                <TableHead className="font-bold">Payment Mode</TableHead>
                                                <TableHead className="font-bold text-right">Amount Received</TableHead>
                                                <TableHead className="font-bold">Reference No</TableHead>
                                                <TableHead className="font-bold text-right">Remaining Due</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paymentEntries.map((entry) => (
                                                <TableRow key={entry.id}>
                                                    <TableCell className="font-medium">
                                                        {format(new Date(entry.paymentDate), "dd-MM-yyyy")}
                                                    </TableCell>
                                                    <TableCell>{entry.paymentMode}</TableCell>
                                                    <TableCell className="text-right font-bold text-green-600">
                                                        USh{entry.amountReceived.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell>{entry.referenceNo || "-"}</TableCell>
                                                    <TableCell className="text-right font-bold text-orange-600">
                                                        USh{entry.remainingDue.toFixed(2)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="p-4 bg-muted/30 rounded-lg border text-center">
                                    <p className="text-sm text-muted-foreground italic">No payment entries yet</p>
                                </div>
                            )}
                        </div>

                        {/* ============================================================================
                            REMOVED: PAYMENT ACTIVITY SECTION
                            Communication/remarks should be recorded in Sales Follow Up module
                            ============================================================================ */}

                        {/* ============================================================================
                            REMOVED: Payment Activity History Table
                            Communication/remarks should be recorded in Sales Follow Up module
                            ============================================================================ */}
                    </div>

                    {/* Dialog Footer */}
                    <DialogFooter className="p-6 border-t gap-2">
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                        
                        {/* UPDATED: Save button enabled until due amount = 0, then disabled */}
                        <Button 
                            onClick={handleSaveFollowUp} 
                            className=""
                            disabled={(() => {
                                if (!activeRecord) return true;
                                
                                // FIXED: activeRecord.dueAmount already accounts for existing payments
                                // Disable ONLY when due amount is 0 (payment complete)
                                return activeRecord.dueAmount <= 0;
                            })()}
                            title={(() => {
                                if (!activeRecord) return "Save";
                                
                                // FIXED: activeRecord.dueAmount already accounts for existing payments
                                const currentRemainingDue = activeRecord.dueAmount;
                                
                                if (currentRemainingDue <= 0) {
                                    return "All payments received - Use 'Mark as Completed' button";
                                }
                                
                                return "Save payment entries";
                            })()}
                        >
                            Save
                        </Button>
                        <Button 
                            onClick={handleMarkAsCompleted} 
                            className="bg-green-600 hover:bg-green-700"
                            disabled={(() => {
                                if (!activeRecord) return true;
                                
                                // FIXED: Enable button when ALL payments are complete (due amount = 0)
                                const terms = activeRecord.terms || [];
                                
                                // activeRecord.dueAmount is already the remaining due after existing payments
                                const currentRemainingDue = activeRecord.dueAmount;
                                
                                // Check if any terms still have due amount > 0
                                const termsWithDue = terms.filter(term => term.dueAmount > 0);
                                
                                // Calculate total due from terms
                                const totalDueFromTerms = terms.reduce((sum, term) => sum + term.dueAmount, 0);
                                
                                // FIXED: Disable when there are still amounts due (opposite of previous logic)
                                // Enable (return false) when all amounts are 0
                                const hasOutstandingAmounts = currentRemainingDue > 0 || termsWithDue.length > 0 || totalDueFromTerms > 0;
                                
                                console.log('[MARK AS COMPLETED] Button state check:', {
                                    currentRemainingDue,
                                    termsWithDueCount: termsWithDue.length,
                                    totalDueFromTerms,
                                    hasOutstandingAmounts,
                                    buttonDisabled: hasOutstandingAmounts
                                });
                                
                                return hasOutstandingAmounts;
                            })()}
                            title={(() => {
                                if (!activeRecord) return "Mark as completed";
                                
                                // CRITICAL FIX: Use activeRecord.terms for real-time validation
                                const terms = activeRecord.terms || [];
                                const currentRemainingDue = activeRecord.dueAmount;
                                const termsWithDue = terms.filter(term => term.dueAmount > 0);

                                const totalDueFromTerms = terms.reduce((sum, term) => sum + term.dueAmount, 0);
                                
                                if (currentRemainingDue > 0 || termsWithDue.length > 0 || totalDueFromTerms > 0) {
                                    // Show pending term details in tooltip
                                    const termDetails = termsWithDue
                                        .map(term => `${term.termType}: USh{term.dueAmount.toFixed(2)}`)
                                        .join(", ");
                                    return `Pending terms: ${termDetails}`;
                                }
                                
                                return "Mark as completed - All payments received";
                            })()}
                        >
                            Mark as Completed
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PaymentFollowUp;

