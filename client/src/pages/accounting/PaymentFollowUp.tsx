// ============================================================================
// PAYMENT FOLLOW UP COMPONENT (Accounting Module)
// Track payment follow-ups for invoices with due amounts
// 
// INTEGRATION WITH SALES FOLLOW UP:
// - Both modules work with the same Invoice data source (mockInvoices.ts)
// - Linked using Invoice Code or Invoice ID
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
import { useDebounce } from "@/hooks/useDebounce";
import { useLocation } from "wouter";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import { type InvoiceData } from "@/lib/mockInvoices";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Download, Plus, CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, ChevronsUpDown, Check, X, Loader2 } from "lucide-react";
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
import { TableActionButtons } from "@/components/shared/TableActionButtons";
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
import {
    Command,
    CommandInputBorderless,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
// Local DatePicker used only in the Payment Details form inside modal
import { invoicingApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
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
    termType?: string;
    paymentMode: string;
    amountReceived: number;
    referenceNo?: string; // Cheque No or Transaction ID
    remainingDue: number;
    isPersisted?: boolean;
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
    status: string;
    statusId: number;
    lastFollowUpDate?: string;
    nextFollowUpDate?: string;
    notes: FollowUpNote[];
    terms?: PaymentTermBreakdown[]; // Payment term breakdown
    invoice_id: number; // Added to store the actual invoice ID
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Get currency symbol from name or code
const getCurrencySymbol = (currencyName: string = "") => {
    const symbols: { [key: string]: string } = {
        'INDIAN RUPEE': '₹',
        'INR': '₹',
        'US DOLLAR': '$',
        'USD': '$',
        'EURO': '€',
        'EUR': '€',
        'BRITISH POUND': '£',
        'GBP': '£',
        'JAPANESE YEN': '¥',
        'JPY': '¥',
        'CHINESE YUAN': '¥',
        'CNY': '¥',
        'AUSTRALIAN DOLLAR': 'A$',
        'AUD': 'A$',
        'CANADIAN DOLLAR': 'C$',
        'CAD': 'C$',
        'SWISS FRANC': 'Fr',
        'CHF': 'Fr',
        'SWEDISH KRONA': 'kr',
        'SEK': 'kr',
        'NEW ZEALAND DOLLAR': 'NZ$',
        'NZD': 'NZ$',
        'UGANDAN SHILLING': 'USh',
        'UGX': 'USh',
        'USH': 'USh'
    };

    const upperName = (currencyName || "").toUpperCase().trim();
    return symbols[upperName] || upperName || 'USh';
};

// Safe date formatting helper - validates date before formatting
const safeFormatDate = (dateValue: any, formatStr: string = "dd-MM-yyyy"): string => {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return "-";
    return format(date, formatStr);
};

// ============================================================================
// LOCAL DATE PICKER (for Payment Date inside edit modal)
// Mirrors the LocalFollowUpDatePicker in FollowUp.tsx
// ============================================================================
function LocalPaymentDatePicker({ date, setDate, disabled = false }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
    const [visibleDate, setVisibleDate] = useState(() => date || new Date());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const formatDisplayDate = (d: Date | undefined) => {
        if (!d) return "Pick a date";
        try { return format(d, "dd/MM/yyyy"); } catch { return "Pick a date"; }
    };

    const handleDateSelect = (selectedDate: Date) => {
        if (selectedDate > today) return;
        setDate(selectedDate);
        setIsOpen(false);
        setViewMode("day");
    };

    const handleMonthSelect = (monthIndex: number) => {
        setVisibleDate(new Date(visibleDate.getFullYear(), monthIndex, 1));
        setViewMode("day");
    };

    const handleYearSelect = (year: number) => {
        setVisibleDate(new Date(year, visibleDate.getMonth(), 1));
        setViewMode("month");
    };

    const navigateMonth = (direction: number) => {
        setVisibleDate(new Date(visibleDate.getFullYear(), visibleDate.getMonth() + direction, 1));
    };

    const getDaysInMonth = (d: Date) => {
        const year = d.getFullYear();
        const month = d.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        const days = [];
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const dayDate = new Date(year, month - 1, prevMonthLastDay - i);
            dayDate.setHours(0, 0, 0, 0);
            days.push({ date: dayDate, isCurrentMonth: false, isToday: false, isSelected: false });
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            currentDate.setHours(0, 0, 0, 0);
            const isToday = new Date().toDateString() === currentDate.toDateString();
            const isSelected = date && currentDate.toDateString() === date.toDateString();
            days.push({ date: currentDate, isCurrentMonth: true, isToday, isSelected });
        }
        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day++) {
            const dayDate = new Date(year, month + 1, day);
            dayDate.setHours(0, 0, 0, 0);
            days.push({ date: dayDate, isCurrentMonth: false, isToday: false, isSelected: false });
        }
        return days;
    };

    const renderDayView = () => {
        const days = getDaysInMonth(visibleDate);
        const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" className="font-semibold text-sm" onClick={() => setViewMode("month")}>{monthNames[visibleDate.getMonth()]}<ChevronDown className="ml-1 h-3 w-3" /></Button>
                        <Button variant="ghost" className="font-semibold text-sm" onClick={() => setViewMode("year")}>{visibleDate.getFullYear()}<ChevronDown className="ml-1 h-3 w-3" /></Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day) => (<div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">{day}</div>))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, index) => {
                        const isFuture = day.date > today;
                        return (
                            <Button 
                                key={index} 
                                variant="ghost" 
                                size="icon" 
                                className={cn(
                                    "h-8 w-8 text-sm font-normal", 
                                    !day.isCurrentMonth && "text-muted-foreground opacity-50", 
                                    day.isToday && "bg-accent text-accent-foreground font-semibold", 
                                    day.isSelected && "bg-primary text-primary-foreground font-semibold", 
                                    day.isCurrentMonth && !isFuture && "hover:bg-accent hover:text-accent-foreground",
                                    isFuture && "text-muted-foreground/30 cursor-not-allowed"
                                )} 
                                onClick={() => !isFuture && handleDateSelect(day.date)}
                                disabled={isFuture}
                            >
                                {day.date.getDate()}
                            </Button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderMonthView = () => (
        <div className="w-80">
            <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewMode("day")}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" className="font-semibold text-sm" onClick={() => setViewMode("year")}>{visibleDate.getFullYear()}<ChevronDown className="ml-1 h-3 w-3" /></Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {monthNamesShort.map((month, index) => (
                    <Button key={month} variant="ghost" className={cn("h-10 text-sm font-normal", index === visibleDate.getMonth() && "bg-primary text-primary-foreground font-semibold")} onClick={() => handleMonthSelect(index)}>{month}</Button>
                ))}
            </div>
        </div>
    );

    const renderYearView = () => {
        const currentYear = visibleDate.getFullYear();
        const startYear = Math.floor(currentYear / 12) * 12;
        const years = Array.from({ length: 12 }, (_, i) => startYear + i);
        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVisibleDate(new Date(startYear - 12, visibleDate.getMonth(), 1))}><ChevronLeft className="h-4 w-4" /></Button>
                    <h3 className="font-semibold">{startYear} - {startYear + 11}</h3>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVisibleDate(new Date(startYear + 12, visibleDate.getMonth(), 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {years.map((year) => (
                        <Button key={year} variant="ghost" className={cn("h-10 text-sm font-normal", year === currentYear && "bg-primary text-primary-foreground font-semibold")} onClick={() => handleYearSelect(year)}>{year}</Button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" disabled={disabled} className={cn("w-full justify-start text-left font-normal flex h-10 rounded-md border border-input px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 hover:bg-white", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDisplayDate(date) : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 shadow-lg border rounded-lg z-9999" align="start" side="bottom" sideOffset={4}>
                {viewMode === "day" && renderDayView()}
                {viewMode === "month" && renderMonthView()}
                {viewMode === "year" && renderYearView()}
            </PopoverContent>
        </Popover>
    );
}


// ============================================================================
// STATUS BADGE HELPER
// - Upcoming: Blue badge (payment due in future)
// - Overdue: Red badge (payment past due date)
// - Completed: Green badge (all payments received, Due Amount = 0)
// ============================================================================
const getFollowUpStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "PAID" || s === "COMPLETED") 
        return <Badge className="bg-green-500 hover:bg-green-600">Paid</Badge>;
    if (s === "OVERDUE") 
        return <Badge className="bg-red-500 hover:bg-red-600">Overdue</Badge>;
    if (s === "UPCOMING" || s === "PENDING") 
        return <Badge className="bg-blue-500 hover:bg-blue-600">Upcoming</Badge>;
    if (s === "PARTICALLY PAID" || s === "PARTIALLY PAID") 
        return <Badge className="bg-orange-500 hover:bg-orange-600">Partially Paid</Badge>;
    
    return <Badge variant="outline">{status}</Badge>;
};

// ============================================================================
// MAIN SALES FOLLOW UP COMPONENT
// ============================================================================

const PaymentFollowUp = () => {
    const { canView, canEdit, canPrint } = useHasPermission();
    const MODULE_KEY = "ACCOUNTING/PENDING_PAYMENT";

    if (!canView(MODULE_KEY)) {
        return <Unauthorized />;
    }

    const { toast } = useToast();
    const [location, setLocation] = useLocation();
    const followUpStatuses = useCommonStore(state => state.followUpStatuses) || [];
    const paymentTermTypes = useCommonStore(state => state.paymentTermTypes) || [];
    const paymentModes = useCommonStore(state => state.paymentModes) || [];
    const isMasterDataLoaded = useCommonStore(state => state.isLoaded);

    // State management
    const [followUpRecords, setFollowUpRecords] = useState<FollowUpDisplay[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [filterDueDate, setFilterDueDate] = useState<Date | undefined>(undefined);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isListLoading, setIsListLoading] = useState(false);
    const [isViewDetailLoading, setIsViewDetailLoading] = useState(false);
    const [isEditDetailLoading, setIsEditDetailLoading] = useState(false);
    const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
    const [isCompletingPayment, setIsCompletingPayment] = useState(false);
    const [openingRecordId, setOpeningRecordId] = useState<number | null>(null);

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
    const [paymentTermType, setPaymentTermType] = useState<string>("");
    const [paymentMode, setPaymentMode] = useState<string>("");
    const [amountReceived, setAmountReceived] = useState("");
    const [chequeNo, setChequeNo] = useState("");
    const [transactionId, setTransactionId] = useState("");
    const [amountReceivedError, setAmountReceivedError] = useState("");
    const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
    
    // ============================================================================
    // REMOVED: Activity Entry form states - Payment Activity section removed
    // Communication/remarks should be recorded in Sales Follow Up module
    // ============================================================================

    // Track the current request to prevent race conditions
    const lastRequestId = React.useRef(0);

    const loadFollowUpRecords = React.useCallback(async () => {
        if (filterStatus === null) return;
        
        const requestId = ++lastRequestId.current;
        try {
            setIsListLoading(true);
            const res = await invoicingApi.getPendingPaymentsList({
                search: debouncedSearchTerm?.trim() || undefined,
                due_date: filterDueDate ? format(filterDueDate, "yyyy-MM-dd") : undefined,
                status_id: filterStatus !== "all" ? Number(filterStatus) : undefined,
                page: currentPage,
                limit: itemsPerPage,
            });

            if (requestId !== lastRequestId.current) return;

            if (!res?.isSuccessful) {
                setFollowUpRecords([]);
                setTotalRecords(0);
                return;
            }

            const records = res?.data?.records || [];
            const mapped: FollowUpDisplay[] = records.map((record: any) => {
                return {
                    id: record.pending_payment_id || record.id || record.invoice_id,
                    invoice_id: record.invoice_id, // Store actual invoice ID
                    invoiceNumber: record.invoice_code || "",
                    invoiceDate: record.invoice_date || "",
                    customerName: record.customer_name || "",
                    soNumber: record.so_code || "-",
                    soDate: record.so_date || record.order_date || "",
                    deliveryDate: record.delivery_date || "",
                    contactPerson: record.contact_person || "-",
                    mobileNo: record.mobile_no || "-",
                    shippingAddress: record.shipping_address || "-",
                    billingAddress: record.billing_address || "-",
                    remarks: record.remarks || "-",
                    items: [],
                    subtotal: Number(record.sub_total || 0),
                    tax: Number(record.tax_amount || 0),
                    taxPercentage: Number(record.tax_percent || 0),
                    grandTotal: Number(record.invoice_amount) || 0,
                    dueAmount: Number(record.remaining_amount || record.due_amount || 0),
                    dueDate: record.due_date || "",
                    // Normalize status name for consistency
                    status: record.status_name || "Pending",
                    statusId: record.status_id,
                    lastFollowUpDate: record.follow_up_date,
                    nextFollowUpDate: record.upcoming_follow_up_date,
                    notes: [], 
                    terms: [],
                    currency: record.currency_name || "USh",
                    currencySymbol: getCurrencySymbol(record.currency_name || "USh")
                };
            });

            setFollowUpRecords(mapped);
            setTotalRecords(res?.data?.pagination?.total_records || mapped.length);
        } catch (error) {
            console.error("Error fetching pending payments:", error);
            setFollowUpRecords([]);
            setTotalRecords(0);
        } finally {
            setIsListLoading(false);
        }
    }, [debouncedSearchTerm, filterDueDate, filterStatus, currentPage, itemsPerPage]);

    const isRowActionBusy =
        openingRecordId !== null ||
        isViewDetailLoading ||
        isEditDetailLoading ||
        isSavingFollowUp ||
        isCompletingPayment;

    // Initial load
    useEffect(() => {
        // Only load if we've either set the default status OR if the master data isn't going to set it
        // This prevents double loading or loading with 'all' before the default is set
        if (hasSetDefaultStatus.current || !isMasterDataLoaded) {
            loadFollowUpRecords();
        }
    }, [loadFollowUpRecords, isMasterDataLoaded]);

    // Track if we've set the default status to avoid resetting user selection
    const hasSetDefaultStatus = React.useRef(false);

    // Set default status to 'Upcoming' only once on initial load
    useEffect(() => {
        if (isMasterDataLoaded && followUpStatuses.length > 0 && !hasSetDefaultStatus.current) {
            const upcomingStatus = followUpStatuses.find(s => 
                s.name.toLowerCase() === 'upcoming' || 
                (s.code && String(s.code).toLowerCase() === 'upcoming')
            );
            if (upcomingStatus) {
                setFilterStatus(String(upcomingStatus.id));
            } else {
                // If no upcoming status found, default to 'all' to trigger initial load
                setFilterStatus("all");
            }
            hasSetDefaultStatus.current = true;
        }
    }, [isMasterDataLoaded, followUpStatuses]);

    // Subscribe to store changes (updates from Sales Follow Up module)
    useEffect(() => {
        const unsubscribe = subscribeToFollowUpStore(() => {
            loadFollowUpRecords();
        });
        return unsubscribe;
    }, [loadFollowUpRecords]);

    // Pagination calculations
    const totalPages = Math.ceil(totalRecords / itemsPerPage);
    const paginatedData = followUpRecords;

    // Auto-adjust page when data changes
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalRecords, currentPage, totalPages]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, filterStatus]);

    // Amount validation based on selected term
    useEffect(() => {
        if (!amountReceived || !activeRecord) {
            setAmountReceivedError("");
            return;
        }

        const amt = parseFloat(amountReceived);
        if (isNaN(amt) || amt <= 0) {
            setAmountReceivedError("Please enter a valid amount received.");
            return;
        }

        if (paymentTermType) {
            const term = activeRecord.terms?.find(t => t.termType === paymentTermType);
            const due = term ? term.dueAmount : 0;
            // Use a small epsilon for float precision
            if (amt > due + 0.01) {
                setAmountReceivedError("Amount received cannot exceed selected term due amount");
            } else {
                setAmountReceivedError("");
            }
        } else {
            setAmountReceivedError("");
        }
    }, [amountReceived, paymentTermType, activeRecord]);

    // Open follow-up preview
    const handleOpenRecord = async (record: FollowUpDisplay) => {
        if (isRowActionBusy) return;
        setOpeningRecordId(record.id);
        setIsViewDetailLoading(true);
        setActiveRecord(null);
        setIsDialogOpen(true);
        try {
            const res = await invoicingApi.getPendingPaymentById(record.id);
            if (res?.isSuccessful && res.data) {
                const detailData = res.data;
                const currencySymbol = record.currency || detailData.currency_name || "USh";
                
                setActiveRecord({
                    ...record,
                    statusId: Number(detailData.status_id) || record.statusId || 0,
                    dueAmount: Number(detailData.remaining_amount ?? detailData.due_amount) || 0,
                    terms: (detailData.payment_terms || []).map((t: any, idx: number) => {
                        const termAmount = Number(t.term_amount) || 0;
                        const paidAmount = Number(t.paid_amount) || 0;
                        return {
                            id: idx + 1,
                            termType: t.term_type || "Unknown",
                            percentage: Number(t.percentage) || 0,
                            dueDate: t.due_date || "",
                            termAmount: termAmount,
                            paidAmount: paidAmount,
                            dueAmount: Math.max(0, termAmount - paidAmount),
                            status: t.status || "Pending"
                        };
                    }),
                    notes: (detailData.payment_history || []).map((p: any, idx: number) => ({
                        id: idx + 1,
                        date: p.payment_date || "",
                        note: `Payment Received: ${getCurrencySymbol(detailData.currency_name || record.currency || "USh")}${Number(p.amount_received || 0).toFixed(2)} | Mode: ${p.payment_mode || "N/A"}`
                    })),
                    soNumber: detailData.so_code || record.soNumber || "-",
                    soDate:
                        detailData.so_date ||
                        detailData.order_date ||
                        detailData.invoice?.so_date ||
                        detailData.invoice?.order_date ||
                        record.soDate ||
                        "",
                    deliveryDate: detailData.delivery_date || record.deliveryDate || "",
                    contactPerson: detailData.contact_person || record.contactPerson || "-",
                    mobileNo: detailData.mobile_no || record.mobileNo || "-",
                    shippingAddress: detailData.shipping_address || record.shippingAddress || "-",
                    billingAddress: detailData.billing_address || record.billingAddress || "-",
                    remarks: detailData.remarks || record.remarks || "-",
                    items: record.items || [],
                    subtotal: Number(detailData.summary?.subtotal || record.subtotal || 0),
                    tax: Number(detailData.summary?.tax_amount || record.tax || 0),
                    taxPercentage: Number(detailData.summary?.tax_percent || record.taxPercentage || 0),
                    invoiceDate: detailData.invoice_date || record.invoiceDate || "",
                    currency: detailData.currency_name || record.currency || "USh",
                    currencySymbol: getCurrencySymbol(detailData.currency_name || record.currency || "USh")
                });
                
                // Load existing payment entries for the preview table
                const existingPayments: PaymentEntry[] = (detailData.payment_history || []).map((p: any, index: number) => ({
                    id: p.payment_id || (Date.now() + index),
                    paymentDate: p.payment_date || "",
                    termType: p.term_type || "Delivery",
                    paymentMode: p.payment_mode || "Cash",
                    amountReceived: Number(p.amount_received) || 0,
                    referenceNo: p.reference_no || "",
                    remainingDue: Number(p.remaining_amount || 0),
                    isPersisted: true
                }));
                
                setPaymentEntries(existingPayments);
                
                // Use follow-up history from API (normalize notes/note)
                setSalesFollowUpHistory((detailData.follow_up_history || []).map((h: any) => ({
                    ...h,
                    followUpDate: h.follow_up_date,
                    note: h.notes || h.note || ""
                })));
            } else {
                toast({ 
                    title: "Error", 
                    description: res?.message || "Failed to load payment details.", 
                    variant: "destructive" 
                });
            }
        } catch (error) {
            console.error("Error loading payment detail:", error);
            toast({ title: "Error", description: "Failed to load payment details.", variant: "destructive" });
            setIsDialogOpen(false);
        } finally {
            setIsViewDetailLoading(false);
            setOpeningRecordId(null);
        }
    };

    // ============================================================================
    // OPEN EDIT DIALOG
    // Load both payment and sales follow-up history from API
    // ============================================================================
    const handleEditRecord = async (record: FollowUpDisplay) => {
        if (isRowActionBusy) return;
        setOpeningRecordId(record.id);
        setIsEditDetailLoading(true);
        try {
            const res = await invoicingApi.getPendingPaymentById(record.id);
            
            if (res?.isSuccessful && res.data) {
                const detailData = res.data;
                
                const updatedRecord: FollowUpDisplay = {
                    ...record,
                    dueAmount: Number(detailData.remaining_amount ?? detailData.due_amount) || 0,
                    terms: (detailData.payment_terms || []).map((t: any, idx: number) => {
                        const termAmount = Number(t.term_amount) || 0;
                        const paidAmount = Number(t.paid_amount) || 0;
                        return {
                            id: idx + 1,
                            termType: t.term_type || "Unknown",
                            percentage: Number(t.percentage) || 0,
                            dueDate: t.due_date || "",
                            termAmount: termAmount,
                            paidAmount: paidAmount,
                            dueAmount: Math.max(0, termAmount - paidAmount),
                            status: t.status || "Pending"
                        };
                    }),
                    soNumber: detailData.so_code || record.soNumber || "-",
                    soDate:
                        detailData.so_date ||
                        detailData.order_date ||
                        detailData.invoice?.so_date ||
                        detailData.invoice?.order_date ||
                        record.soDate ||
                        "",
                    deliveryDate: detailData.delivery_date || record.deliveryDate || "",
                    contactPerson: detailData.contact_person || record.contactPerson || "-",
                    mobileNo: detailData.mobile_no || record.mobileNo || "-",
                    shippingAddress: detailData.shipping_address || record.shippingAddress || "-",
                    billingAddress: detailData.billing_address || record.billingAddress || "-",
                    remarks: detailData.remarks || record.remarks || "-",
                    items: record.items || [],
                    subtotal: Number(detailData.summary?.subtotal || record.subtotal || 0),
                    tax: Number(detailData.summary?.tax_amount || record.tax || 0),
                    taxPercentage: Number(detailData.summary?.tax_percent || record.taxPercentage || 0),
                    invoiceDate: detailData.invoice_date || record.invoiceDate || "",
                    currency: detailData.currency_name || record.currency || "USh",
                    currencySymbol: getCurrencySymbol(detailData.currency_name || record.currency || "USh")
                };
                
                setActiveRecord(updatedRecord);
                
                // Reset Payment Entry form
                setPaymentDate(undefined);
                setPaymentTermType("");
                setPaymentMode("");
                setAmountReceived("");
                setChequeNo("");
                setTransactionId("");
                
                // Load existing payment entries
                const existingPayments: PaymentEntry[] = (detailData.payment_history || []).map((p: any, index: number) => ({
                    id: p.payment_id || (Date.now() + index),
                    paymentDate: p.payment_date || "",
                    termType: p.term_type || "Delivery",
                    paymentMode: p.payment_mode || "Cash",
                    amountReceived: Math.round((Number(p.amount_received) + Number.EPSILON) * 100) / 100 || 0,
                    referenceNo: p.reference_no || "",
                    remainingDue: Number(p.remaining_amount || 0),
                    isPersisted: true
                }));
                
                setPaymentEntries(existingPayments);
                
                // Use follow-up history from API (normalize notes/note)
                setSalesFollowUpHistory((detailData.follow_up_history || []).map((h: any) => ({
                    ...h,
                    followUpDate: h.follow_up_date,
                    note: h.notes || h.note || ""
                })));
                
                setIsEditDialogOpen(true);
            } else {
                toast({ 
                    title: "Error", 
                    description: res?.message || "Failed to load payment data.", 
                    variant: "destructive" 
                });
            }
        } catch (error) {
            console.error("Error opening edit dialog:", error);
            toast({ title: "Error", description: "Failed to load payment data.", variant: "destructive" });
        } finally {
            setIsEditDetailLoading(false);
            setOpeningRecordId(null);
        }
    };

    const handleAddPaymentEntry = () => {
            // Validate required fields
            if (!paymentDate) {
                toast({ title: "Please Check", description: "Please select a payment date.", variant: "destructive" });
                return;
            }
            if (!paymentMode) {
                toast({ title: "Please Check", description: "Please select a payment mode.", variant: "destructive" });
                return;
            }
            if (!paymentTermType) {
                toast({ title: "Please Check", description: "Please select a term type.", variant: "destructive" });
                return;
            }
            if (!amountReceived || parseFloat(amountReceived) <= 0) {
                setAmountReceivedError("Please enter a valid amount received.");
                return;
            } else {
                setAmountReceivedError("");
            }



            if (!activeRecord) return;

            const amountPaid = Math.round((parseFloat(amountReceived) + Number.EPSILON) * 100) / 100;
            
            // Validate payment amount doesn't exceed selected term's due amount
            const selectedTerm = (activeRecord?.terms || []).find(t => t.termType === paymentTermType);
            const termDueAmount = selectedTerm ? selectedTerm.dueAmount : 0;

            if (amountPaid > termDueAmount + 0.01) {
                setAmountReceivedError("Amount received cannot exceed selected term due amount");
                return;
            }

            // Calculate term-wise remaining due (for the history table)
            const termRemainingDue = Math.max(0, Math.round((termDueAmount - amountPaid + Number.EPSILON) * 100) / 100);

            // Calculate total invoice remaining due (for activeRecord state)
            const totalRemainingDue = Math.max(0, Math.round((activeRecord.dueAmount - amountPaid + Number.EPSILON) * 100) / 100);

            // Create payment entry for local display
            const newPayment: PaymentEntry = {
                id: Date.now(),
                paymentDate: format(paymentDate, "yyyy-MM-dd"),
                termType: paymentTermType,
                paymentMode: paymentMode,
                amountReceived: amountPaid,
                referenceNo: paymentMode === "Cheque" ? chequeNo : paymentMode === "Online" ? transactionId : undefined,
                remainingDue: termRemainingDue
            };

            // Update payment entries
            const updatedPaymentEntries = [...paymentEntries, newPayment];
            setPaymentEntries(updatedPaymentEntries);

            const updatedTerms = (activeRecord.terms || []).map(term => {
                if (term.termType === paymentTermType) {
                    const updatedTerm = { ...term };
                    updatedTerm.paidAmount = Math.round((updatedTerm.paidAmount + amountPaid + Number.EPSILON) * 100) / 100;
                    updatedTerm.dueAmount = Math.max(0, Math.round((updatedTerm.termAmount - updatedTerm.paidAmount + Number.EPSILON) * 100) / 100);

                    // Update term status based on remaining due
                    if (updatedTerm.dueAmount <= 0) {
                        updatedTerm.status = "Paid";
                    } else {
                        updatedTerm.status = "Partial";
                    }
                    return updatedTerm;
                }
                return term;
            });

            // Update activeRecord with new terms and balance
            setActiveRecord({
                ...activeRecord,
                terms: updatedTerms,
                dueAmount: totalRemainingDue
            });

            // Reset payment form fields
            setPaymentDate(undefined);
            setPaymentTermType("");
            setPaymentMode("");
            setAmountReceived("");
            setChequeNo("");
            setTransactionId("");

            toast({
                title: "Success",
                description: `Payment of USh${amountPaid.toFixed(2)} recorded locally. Remember to click Save to persist changes.`,
                variant: "success"
            });
        };

    // Navigate to invoice detail page
    const handleInvoiceClick = (record: FollowUpDisplay) => {
        setLocation(`/accounting/invoicing?from=pending-payment&pending_payment_id=${record.id}&invoiceNumber=${record.invoiceNumber}`);
    };

    // ============================================================================
    // SAVE PAYMENT FOLLOW UP
    // Updates payment transactions and status via API
    // ============================================================================
    const handleSaveFollowUp = async () => {
        if (!activeRecord || isRowActionBusy) return;

        try {
            setIsSavingFollowUp(true);

            // Filter only NEW entries that haven't been saved yet
            const newEntriesToSave = paymentEntries.filter(entry => !entry.isPersisted);

            // If user typed something in the form but didn't click "+" yet, include it
            const currentAmount = parseFloat(amountReceived) || 0;
            if (currentAmount > 0 && paymentDate && paymentMode && paymentTermType) {
                const selectedTerm = (activeRecord?.terms || []).find(t => t.termType === paymentTermType);
                const termDueAmount = selectedTerm ? selectedTerm.dueAmount : 0;
                const termRemainingDue = Math.max(0, Math.round((termDueAmount - currentAmount + Number.EPSILON) * 100) / 100);

                newEntriesToSave.push({
                    id: Date.now(),
                    paymentDate: format(paymentDate, "yyyy-MM-dd"),
                    termType: paymentTermType,
                    paymentMode: paymentMode,
                    amountReceived: currentAmount,
                    referenceNo: paymentMode === "Cheque" ? chequeNo : paymentMode === "Online" ? transactionId : undefined,
                    remainingDue: termRemainingDue
                });
            }

            if (newEntriesToSave.length === 0) {
                toast({ title: "No Changes", description: "No new payment entries to save." });
                return;
            }

            // Map to backend payload format (using "payment" key as requested)
            const payload = {
                payment: newEntriesToSave.map(entry => {
                    const termTypeObj = paymentTermTypes.find(t => t.name === entry.termType);
                    const modeObj = paymentModes.find(m => m.name === entry.paymentMode);
                    return {
                        payment_date: entry.paymentDate,
                        term_type_id: termTypeObj?.id || 0,
                        payment_mode_id: modeObj?.id || 0,
                        amount_received: entry.amountReceived,
                        payment_reference_no: entry.referenceNo || ""
                    };
                })
            };

            const res = await invoicingApi.updatePendingPayment(activeRecord.id, payload);

            if (res.isSuccessful) {
                toast({ 
                    title: "Success", 
                    description: res.message || "Payment entries saved successfully.", 
                    variant: "success" 
                });
                resetEditForm();
                await loadFollowUpRecords();
                // Close the dialog after save to refresh everything
                setIsEditDialogOpen(false);
            } else {
                toast({
                    title: "Update Failed",
                    description: res.message || "Failed to save payment entries.",
                    variant: "destructive"
                });
            }
        } catch (error: any) {
            console.error('[SAVE PAYMENT ERROR]', error);
            toast({ 
                title: "Error", 
                description: error.message || "An unexpected error occurred while saving payments.", 
                variant: "destructive" 
            });
        } finally {
            setIsSavingFollowUp(false);
        }
    };

    const handleMarkAsCompleted = async () => {
        if (!activeRecord || isRowActionBusy) return;

        const currentTypedAmount = parseFloat(amountReceived) || 0;
        const totalDueAfterCurrent = activeRecord.dueAmount - currentTypedAmount;

        if (totalDueAfterCurrent > 0.01) {
            toast({
                title: "Incomplete Payment",
                description: `Invoice still has a balance of USh${totalDueAfterCurrent.toFixed(2)}. Please record all payments before completing.`,
                variant: "destructive"
            });
            return;
        }

        try {
            setIsCompletingPayment(true);
            
            const termTypeObj = paymentTermTypes.find(t => t.name === paymentTermType);
            const modeObj = paymentModes.find(m => m.name === paymentMode);
            
            const paymentArray = [];
            if (currentTypedAmount > 0) {
                paymentArray.push({
                    payment_date: paymentDate ? format(paymentDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
                    term_type_id: termTypeObj?.id || 0,
                    payment_mode_id: modeObj?.id || 0,
                    amount_received: currentTypedAmount,
                    payment_reference_no: paymentMode === "Cheque" ? chequeNo : paymentMode === "Online" ? transactionId : ""
                });
            }

            // Find Completed status ID from followUpStatuses
            const completedStatus = followUpStatuses.find(s => 
                s.name.toLowerCase().includes('completed') || 
                s.name.toLowerCase().includes('closed')
            );
            
            const payload = {
                status_id: completedStatus ? Number(completedStatus.id) : activeRecord.statusId,
                payment: paymentArray
            };

            const res = await invoicingApi.updatePendingPayment(activeRecord.id, payload);

            if (res.isSuccessful) {
                toast({ title: "Invoice Completed", description: "Invoice marked as fully paid and closed.", variant: "success" });
                resetEditForm();
                setIsEditDialogOpen(false);
                loadFollowUpRecords();
            }
        } catch (error) {
            console.error("Error completing invoice:", error);
            toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsCompletingPayment(false);
        }
    };

    // Reset edit form
    const resetEditForm = () => {
        // Reset Payment Entry form
        setPaymentDate(undefined);
        setPaymentTermType("");
        setPaymentMode("");
        setAmountReceived("");
        setChequeNo("");
        setTransactionId("");
        setAmountReceivedError("");
        setPaymentEntries([]);
        
        // ============================================================================
        // REMOVED: Activity Entry form reset - Payment Activity section removed
        // ============================================================================
    }

    // Download Payment Follow Up Report as PDF
    const handleDownloadPDF = () => {
            if (!activeRecord) return;

            // Use structured payment entries from state
            const paymentsWithDue = paymentEntries.map(entry => ({
                date: entry.paymentDate,
                mode: entry.paymentMode,
                amount: entry.amountReceived,
                reference: entry.referenceNo || "-",
                remainingDue: entry.remainingDue
            }));

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
                                <div class="info-item"><strong>SO Code:</strong><span>${activeRecord.soNumber || activeRecord.soNumber || "-"}</span></div>
                                <div class="info-item"><strong>SO Date:</strong><span>${safeFormatDate(activeRecord.soDate)}</span></div>
                                <div class="info-item"><strong>Delivery Date:</strong><span>${safeFormatDate(activeRecord.deliveryDate)}</span></div>
                                <div class="info-item"><strong>Currency:</strong><span>${activeRecord.currency || "Ugandan Shilling"}</span></div>
                            </div>

                            <div class="section">
                                <h3>Amount Summary</h3>
                                <div class="info-item"><strong>Invoice Amount:</strong><span>${activeRecord.currencySymbol || "USh"}${activeRecord.grandTotal.toFixed(2)}</span></div>
                                <div class="info-item"><strong>Due Amount:</strong><span>${activeRecord.currencySymbol || "USh"}${activeRecord.dueAmount.toFixed(2)}</span></div>
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
                                                <td class="text-right font-bold">${activeRecord.currencySymbol || "USh"}${term.termAmount.toFixed(2)}</td>
                                                <td class="text-right font-bold" style="color: #16a34a;">${activeRecord.currencySymbol || "USh"}${term.paidAmount.toFixed(2)}</td>
                                                <td class="text-right font-bold" style="color: #ea580c;">${activeRecord.currencySymbol || "USh"}${term.dueAmount.toFixed(2)}</td>
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
                                            <td class="text-right font-bold">${activeRecord.currencySymbol || "USh"}${activeRecord.terms.reduce((sum, t) => sum + t.termAmount, 0).toFixed(2)}</td>
                                            <td class="text-right font-bold" style="color: #16a34a;">${activeRecord.currencySymbol || "USh"}${activeRecord.terms.reduce((sum, t) => sum + t.paidAmount, 0).toFixed(2)}</td>
                                            <td class="text-right font-bold" style="color: #ea580c;">${activeRecord.currencySymbol || "USh"}${activeRecord.terms.reduce((sum, t) => sum + t.dueAmount, 0).toFixed(2)}</td>
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
                                                <td class="text-right font-bold">${activeRecord.currencySymbol || "USh"}${payment.amount.toFixed(2)}</td>
                                                <td>${payment.reference}</td>
                                                <td class="text-right font-bold">${activeRecord.currencySymbol || "USh"}${payment.remainingDue.toFixed(2)}</td>
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

            {/* Toolbar */}
            <AppListToolbar
                search={{
                    placeholder: "Search by Customer, Invoice Code...",
                    value: searchTerm,
                    onChange: (val) => {
                        setSearchTerm(val);
                        setCurrentPage(1);
                    }
                }}
                filters={[
                    {
                        type: 'date',
                        label: "Due Date",
                        value: filterDueDate,
                        onChange: (date) => {
                            setFilterDueDate(date);
                            setCurrentPage(1);
                        },
                        placeholder: "All Due Dates"
                    },
                    {
                        type: 'select',
                        label: "Status",
                        value: filterStatus || "all",
                        onChange: (val) => {
                            setFilterStatus(val);
                            setCurrentPage(1);
                        },
                        options: [
                            { value: "all", label: "All Status" },
                            ...followUpStatuses.map(s => ({
                                value: String(s.id),
                                label: s.name
                            }))
                        ],
                        searchable: true
                    }
                ]}
            />

            {/* Follow Up Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Customer Name</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Invoice Code</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">Invoice Amount</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">Due Amount</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Due Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Last Follow Up</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Next Follow Up</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isListLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm text-muted-foreground">Loading...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedData.length === 0 ? (
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
                                            <TableCell className="py-4 text-right text-sm font-bold text-green-600">{record.currencySymbol}{record.grandTotal.toFixed(2)}</TableCell>
                                            <TableCell className="py-4 text-right text-sm font-bold text-orange-600">{record.currencySymbol}{record.dueAmount.toFixed(2)}</TableCell>
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
                                            <TableCell className="py-4 text-center">
                                                <TableActionButtons
                                                    onView={canView(MODULE_KEY) ? () => handleOpenRecord(record) : undefined}
                                                    onEdit={(canEdit(MODULE_KEY) && String(record.status).toLowerCase() !== "completed" && String(record.status).toLowerCase() !== "closed") ? () => handleEditRecord(record) : undefined}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalRecords > 0 && !isListLoading && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalRecords}
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
                <DialogContent 
                    className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl rounded-xl z-9999"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-100 relative">
                        {isViewDetailLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/80">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
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

                                {/* Customer Information */}
                                <div className="border border-slate-200 rounded-lg p-4 mb-4">
                                    <h3 className="text-[9px] uppercase font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200 tracking-wide">Customer Information</h3>
                                    <div className="space-y-1.5">
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Customer Name:</span>
                                            <span className="font-bold text-slate-900">{activeRecord?.customerName}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Contact Person:</span>
                                            <span className="font-medium text-slate-900">{activeRecord?.contactPerson || "-"}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Mobile No:</span>
                                            <span className="font-medium text-slate-900">{activeRecord?.mobileNo || "-"}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Follow Up Status:</span>
                                            <span className="font-medium text-slate-900">{activeRecord?.status}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Invoice Details */}
                                <div className="border border-slate-200 rounded-lg p-4 mb-4">
                                    <h3 className="text-[9px] uppercase font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200 tracking-wide">Invoice Details</h3>
                                    <div className="space-y-1.5">
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Invoice Number:</span>
                                            <span className="font-bold text-slate-900">{activeRecord?.invoiceNumber}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Invoice Date:</span>
                                            <span className="font-medium text-slate-900">
                                                {safeFormatDate(activeRecord?.invoiceDate)}
                                            </span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">SO Code:</span>
                                            <span className="font-bold text-slate-900">{activeRecord?.soNumber || "-"}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">SO Date:</span>
                                            <span className="font-medium text-slate-900">
                                                {safeFormatDate(activeRecord?.soDate)}
                                            </span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Delivery Date:</span>
                                            <span className="font-medium text-slate-900">
                                                {safeFormatDate(activeRecord?.deliveryDate)}
                                            </span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Due Date:</span>
                                            <span className="font-medium text-slate-900">
                                                {safeFormatDate(activeRecord?.dueDate)}
                                            </span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Currency:</span>
                                            <span className="font-medium text-slate-900">{activeRecord?.currency || "Indian Rupee"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Amount Summary */}
                                <div className="border border-slate-200 rounded-lg p-4 mb-4">
                                    <h3 className="text-[9px] uppercase font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200 tracking-wide">Amount Summary</h3>
                                    <div className="space-y-1.5">
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Invoice Amount:</span>
                                            <span className="font-bold text-slate-900">{activeRecord?.currencySymbol}{activeRecord?.grandTotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Amount Received:</span>
                                            <span className="font-bold text-slate-900">{activeRecord?.currencySymbol}{(activeRecord ? activeRecord.grandTotal - activeRecord.dueAmount : 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Due Amount:</span>
                                            <span className="font-bold text-slate-900">{activeRecord?.currencySymbol}{activeRecord?.dueAmount.toFixed(2)}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Last Follow Up:</span>
                                            <span className="font-medium text-slate-900">
                                                {activeRecord?.lastFollowUpDate ? safeFormatDate(activeRecord.lastFollowUpDate) : "Not Yet"}
                                            </span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-40 shrink-0 text-slate-600 font-medium">Next Follow Up:</span>
                                            <span className="font-medium text-slate-900">
                                                {activeRecord?.nextFollowUpDate ? safeFormatDate(activeRecord.nextFollowUpDate) : "Not Set"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Terms Breakdown Section */}
                                {activeRecord?.terms && activeRecord.terms.length > 0 && (
                                    <div className="border border-slate-200 rounded-lg p-4 mb-4">
                                        <h3 className="text-[9px] font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200 uppercase tracking-wide">Payment Terms Breakdown</h3>
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
                                                            {activeRecord.currencySymbol}{term.termAmount.toFixed(2)}
                                                        </td>
                                                        <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-green-600">
                                                            {activeRecord.currencySymbol}{term.paidAmount.toFixed(2)}
                                                        </td>
                                                        <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-orange-600">
                                                            {activeRecord.currencySymbol}{term.dueAmount.toFixed(2)}
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
                                                        {activeRecord.currencySymbol}{activeRecord.terms.reduce((sum, t) => sum + t.termAmount, 0).toFixed(2)}
                                                    </td>
                                                    <td className="border border-slate-300 px-3 py-2 text-xs text-right text-green-700">
                                                        {activeRecord.currencySymbol}{activeRecord.terms.reduce((sum, t) => sum + t.paidAmount, 0).toFixed(2)}
                                                    </td>
                                                    <td className="border border-slate-300 px-3 py-2 text-xs text-right text-orange-700">
                                                        {activeRecord.currencySymbol}{activeRecord.terms.reduce((sum, t) => sum + t.dueAmount, 0).toFixed(2)}
                                                    </td>
                                                    <td className="border border-slate-300 px-3 py-2"></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Payment Collection History Table */}
                                <div className="border border-slate-200 rounded-lg p-4 mb-6">
                                    <h3 className="text-[9px] font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200 uppercase tracking-wide">Payment Collection History</h3>
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
                                                const paymentsWithDue = paymentEntries.map(entry => ({
                                                    date: entry.paymentDate,
                                                    mode: entry.paymentMode,
                                                    amount: entry.amountReceived,
                                                    reference: entry.referenceNo || "-",
                                                    remainingDue: entry.remainingDue
                                                }));

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
                                                                {activeRecord?.currencySymbol}{payment.amount.toFixed(2)}
                                                            </td>
                                                            <td className="border border-slate-300 px-3 py-2 text-xs text-slate-600">
                                                                {payment.reference}
                                                            </td>
                                                            <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-slate-700">
                                                                {activeRecord?.currencySymbol}{payment.remainingDue.toFixed(2)}
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
                        {canPrint(MODULE_KEY) && (
                            <Button 
                                onClick={handleDownloadPDF} 
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <Download className="mr-2 h-4 w-4" /> Download PDF
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Pending Payment Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent 
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader className="border-b bg-white p-4 sm:p-6">
                        <DialogTitle className="text-2xl font-bold">
                            {String(activeRecord?.status).toLowerCase() === "completed" ? "View Pending Payment (Read-Only)" : "Edit Pending Payment"}
                        </DialogTitle>
                        <DialogDescription>
                            {activeRecord?.status === "Completed" 
                                ? "This record is completed and cannot be edited. All payments have been received."
                                : "Record payment activity and update payment details"
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 space-y-6 relative">
                        {(isEditDetailLoading || isSavingFollowUp || isCompletingPayment) && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
                        {/* Readonly Header Section */}
                        <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Customer Name</Label>
                                <p className="text-sm font-bold text-slate-900">{activeRecord?.customerName}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">SO Code</Label>
                                <p className="text-sm font-bold text-primary">{activeRecord?.soNumber || "-"}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice Code</Label>
                                <p className="text-sm font-bold text-blue-600">{activeRecord?.invoiceNumber}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice Amount</Label>
                                <p className="text-sm font-bold text-green-600">{activeRecord?.currencySymbol}{activeRecord?.grandTotal.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Due Amount</Label>
                                <p className="text-sm font-bold text-orange-600">
                                    {activeRecord?.currencySymbol}{(() => {
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
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice Date</Label>
                                <p className="text-sm font-medium text-slate-700">
                                    {activeRecord?.invoiceDate ? safeFormatDate(activeRecord.invoiceDate) : "-"}
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
                                <div className="border rounded-lg overflow-hidden bg-muted/10">
                                    <Table className="table-fixed">
                                        <colgroup>
                                            <col className="w-[140px]" />
                                            <col />
                                        </colgroup>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30">
                                                <TableHead className="font-bold w-[140px]">Date</TableHead>
                                                <TableHead className="font-bold">Note</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {salesFollowUpHistory.map((entry, index) => (
                                                <TableRow key={index} className="align-top">
                                                    <TableCell className="py-3 font-medium">
                                                        {safeFormatDate(entry.followUpDate)}
                                                    </TableCell>
                                                    <TableCell className="py-3 text-slate-600 whitespace-normal wrap-break-word">
                                                        {entry.note}
                                                    </TableCell>
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
                                            <Table className="table-fixed">
                                                <colgroup>
                                                    <col className="w-[22%]" />
                                                    <col className="w-[10%]" />
                                                    <col className="w-[14%]" />
                                                    <col className="w-[14%]" />
                                                    <col className="w-[14%]" />
                                                    <col className="w-[14%]" />
                                                    <col className="w-[12%]" />
                                                </colgroup>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/30 border-b">
                                                        <TableHead className="font-bold text-slate-700 py-2 px-4">Term Type</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-center py-2 px-4">%</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-center py-2 px-4">Due Date</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-right py-2 px-4">Term Amt</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-right py-2 px-4">Paid</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-right py-2 px-4">Due</TableHead>
                                                        <TableHead className="font-bold text-slate-700 text-center py-2 px-4">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {terms.map((term, index) => (
                                                        <TableRow 
                                                            key={term.id} 
                                                            className={index % 2 === 0 ? 'border-b border-slate-200 transition-colors bg-white hover:bg-slate-50' : 'border-b border-slate-200 transition-colors bg-slate-50 hover:bg-slate-100'}
                                                        >
                                                            <TableCell className="font-medium text-slate-900 py-3 px-4 whitespace-normal wrap-break-word">{term.termType}</TableCell>
                                                            <TableCell className="text-center text-slate-700 py-3 px-4 tabular-nums">{term.percentage}%</TableCell>
                                                            <TableCell className="text-center text-slate-700 py-3 px-4 tabular-nums">
                                                                {term.dueDate ? format(new Date(term.dueDate), "dd-MM-yyyy") : "-"}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-slate-900 py-3 px-4 tabular-nums">
                                                                {activeRecord?.currencySymbol}{term.termAmount.toFixed(2)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-green-600 py-3 px-4 tabular-nums">
                                                                {activeRecord?.currencySymbol}{term.paidAmount.toFixed(2)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-orange-600 py-3 px-4 tabular-nums">
                                                                {activeRecord?.currencySymbol}{term.dueAmount.toFixed(2)}
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
                                                    <TableRow className="bg-muted/40 border-t">
                                                        <TableCell colSpan={3} className="text-right font-bold text-slate-900 py-3 px-4">
                                                            Total:
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-slate-900 py-3 px-4 tabular-nums">
                                                            {activeRecord?.currencySymbol}{terms.reduce((sum, t) => sum + t.termAmount, 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-green-600 py-3 px-4 tabular-nums">
                                                            {activeRecord?.currencySymbol}{terms.reduce((sum, t) => sum + t.paidAmount, 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-orange-600 py-3 px-4 tabular-nums">
                                                            {activeRecord?.currencySymbol}{terms.reduce((sum, t) => sum + t.dueAmount, 0).toFixed(2)}
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
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
                                        <div className="lg:col-span-1">
                                            <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Payment Date <span className="text-red-500">*</span></Label>
                                            <LocalPaymentDatePicker
                                                date={paymentDate}
                                                setDate={setPaymentDate}
                                            />
                                    </div>

                                    <div className="lg:col-span-1">
                                        <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Term Type <span className="text-red-500">*</span></Label>
                                        <Select value={paymentTermType} onValueChange={setPaymentTermType}>
                                            <SelectTrigger className="h-10 bg-white border-slate-300">
                                                <SelectValue placeholder="Select term" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(() => {
                                                    // Get valid term names from the current invoice's breakdown
                                                    const validTermNames = new Set((activeRecord?.terms || []).map(t => t.termType));
                                                    
                                                    // Filter master data to only show terms present in this invoice
                                                    const filteredTypes = paymentTermTypes.filter(type => validTermNames.has(type.name));

                                                    if (filteredTypes.length > 0) {
                                                        return filteredTypes.map((type) => {
                                                            const termInfo = (activeRecord?.terms || []).find(t => t.termType === type.name);
                                                            const isDisabled = termInfo && termInfo.dueAmount <= 0;
                                                            return (
                                                                <SelectItem key={type.id} value={type.name} disabled={isDisabled}>
                                                                    {type.name}
                                                                </SelectItem>
                                                            );
                                                        });
                                                    }

                                                    // Fallback to breakdown terms directly if master data doesn't match
                                                    if (validTermNames.size > 0) {
                                                        return Array.from(validTermNames).map(name => {
                                                            const termInfo = (activeRecord?.terms || []).find(t => t.termType === name);
                                                            const isDisabled = termInfo && termInfo.dueAmount <= 0;
                                                            return (
                                                                <SelectItem key={name} value={name} disabled={isDisabled}>{name}</SelectItem>
                                                            );
                                                        });
                                                    }

                                                    return (
                                                        <>
                                                            <SelectItem value="Advance">Advance</SelectItem>
                                                            <SelectItem value="Days">Days</SelectItem>
                                                            <SelectItem value="Delivery">Delivery</SelectItem>
                                                        </>
                                                    );
                                                })()}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="lg:col-span-1">
                                        <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Payment Mode <span className="text-red-500">*</span></Label>
                                        <Select value={paymentMode} onValueChange={setPaymentMode}>
                                            <SelectTrigger className="h-10 bg-white border-slate-300">
                                                <SelectValue placeholder="Select mode" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {paymentModes.length > 0 ? (
                                                    paymentModes.map((mode) => (
                                                        <SelectItem key={mode.id} value={mode.name}>
                                                            {mode.name}
                                                        </SelectItem>
                                                    ))
                                                ) : (
                                                    <>
                                                        <SelectItem value="Cash">Cash</SelectItem>
                                                        <SelectItem value="Cheque">Cheque</SelectItem>
                                                        <SelectItem value="Online">Online</SelectItem>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="lg:col-span-1">
                                        <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Amount Received <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="number"
                                            value={amountReceived}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val.length <= 12) {
                                                    setAmountReceived(val);
                                                }
                                            }}
                                            placeholder="0.00"
                                            className={cn(
                                                "h-10 bg-white border-slate-300",
                                                amountReceivedError && "border-red-500 focus-visible:ring-red-500"
                                            )}
                                            step="0.01"
                                        />

                                    </div>

                                    {paymentMode === "Cheque" && (
                                        <div className="lg:col-span-1">
                                            <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Cheque No</Label>
                                            <Input
                                                value={chequeNo}
                                                onChange={(e) => setChequeNo(e.target.value)}
                                                placeholder="Enter cheque no"
                                                className="h-10 bg-white border-slate-300"
                                            />
                                        </div>
                                    )}

                                    {paymentMode === "Online" && (
                                        <div className="lg:col-span-1">
                                            <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Transaction ID</Label>
                                            <Input
                                                value={transactionId}
                                                onChange={(e) => setTransactionId(e.target.value)}
                                                placeholder="Enter txn ID"
                                                className="h-10 bg-white border-slate-300"
                                            />
                                        </div>
                                    )}

                                    <div className="lg:col-span-1 lg:justify-self-end">
                                        <Button 
                                            onClick={handleAddPaymentEntry}
                                            size="icon"
                                            className="h-10 w-10 rounded-lg"
                                        >
                                            <Plus className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>

                             </div>
                        </div>
                        )}

                        {amountReceivedError && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 my-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                    <p className="text-xs font-semibold text-red-600">{amountReceivedError}</p>
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
                                                <TableHead className="font-bold">Term Type</TableHead>
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
                                                        {safeFormatDate(entry.paymentDate)}
                                                    </TableCell>
                                                    <TableCell>{entry.termType || "-"}</TableCell>
                                                    <TableCell>{entry.paymentMode}</TableCell>
                                                    <TableCell className="py-3 text-right font-bold text-slate-900">
                                                        {activeRecord?.currencySymbol}{entry.amountReceived.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell>{entry.referenceNo || "-"}</TableCell>
                                                    <TableCell className="py-3 text-right font-bold text-orange-600 pr-4">
                                                        {activeRecord?.currencySymbol}{entry.remainingDue.toFixed(2)}
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

                    <DialogFooter className="border-t bg-white p-4 sm:p-6 mt-auto gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="min-w-[100px]">
                            Cancel
                        </Button>
                        {canEdit(MODULE_KEY) && activeRecord?.status !== "Completed" && (
                            <Button 
                                onClick={handleSaveFollowUp}
                                loading={isSavingFollowUp}
                                className={cn(
                                    "min-w-[100px] transition-colors",
                                    (isSavingFollowUp || isEditDetailLoading || !!amountReceivedError) 
                                        ? "bg-slate-200 text-slate-500 cursor-not-allowed hover:bg-slate-200" 
                                        : "bg-blue-600 hover:bg-blue-700 text-white"
                                )}
                                disabled={isSavingFollowUp || isEditDetailLoading || !!amountReceivedError}
                            >
                                Save
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PaymentFollowUp;

