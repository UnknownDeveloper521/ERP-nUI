// ============================================================================
// SALES FOLLOW UP COMPONENT
// Track follow-ups for invoices with due amounts
// 
// INTEGRATION WITH PAYMENT FOLLOW UP:
// - Both modules work with the same Invoice data source (mockInvoices.ts)
// - Linked using Invoice Code or Invoice ID
// - Records appear in both modules only when Due Amount > 0
// - Sales team records customer communication (calls, emails, meetings)
// - Accounting team records payment activity (in Payment Follow Up module)
// - When payment is complete (Due Amount = 0), invoice is removed from both modules
// - Invoice status becomes "Paid" when fully paid
// 
// SALES FOLLOW UP RESPONSIBILITIES:
// - Record customer communication notes
// - Track follow-up dates (Last Follow Up Date, Next Follow Up Date)
// - Each entry saved in Sales Follow Up History
// - Does NOT modify due amount (only Payment Follow Up can update due amount)
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Download, Plus, CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Trash2, X, Loader2 } from "lucide-react";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
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
    updateSalesFollowUp,
    subscribeToFollowUpStore,
    getSalesFollowUpRecords
} from "@/lib/followUpStore";
import { type PaymentTermBreakdown } from "@/lib/mockFollowUpData";
import { salesFollowUpApi, type SalesFollowUpRecord } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Currency symbol helper
const getCurrencySymbol = (currency: string): string => {
    const symbols: Record<string, string> = {
        'USD': '$',
        'US DOLLAR': '$',
        'EUR': '€',
        'EURO': '€',
        'GBP': '£',
        'BRITISH POUND': '£',
        'INR': '₹',
        'INDIAN RUPEE': '₹',
        'JPY': '¥',
        'CHINESE YUAN': '¥',
        'CNY': '¥',
        'AUD': 'A$',
        'AUSTRALIAN DOLLAR': 'A$',
        'CAD': 'C$',
        'CANADIAN DOLLAR': 'C$',
        'CHF': 'CHF',
        'SWISS FRANC': 'Fr',
        'SEK': 'kr',
        'NZD': 'NZ$',
        'UGX': 'USh',
        'UGANDAN SHILLING': 'USh',
        'USH': 'USh'
    };
    const upper = (currency || "").toUpperCase().trim();
    return symbols[upper] || symbols[upper.replace(/\s/g, "")] || upper;
};

// Safe date formatting helper - validates date before formatting
const safeFormatDate = (dateValue: any, formatStr: string = "dd-MM-yyyy"): string => {
    if (!dateValue) return "-";
    if (dateValue === "-") return "-";
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return "-";
    try {
        return format(date, formatStr);
    } catch (error) {
        return "-";
    }
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface FollowUpNote {
    id: number;
    date: string;
    note: string;
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
// - Synchronized with Payment Follow Up module
// - Existing statuses: Upcoming, Overdue
// - Completed records remain visible in listing (under "Completed" filter)
// ============================================================================
type FollowUpStatus = "Upcoming" | "Overdue" | "Closed" | "Partially Paid" | "Completed";

interface FollowUpDisplay extends Partial<Omit<InvoiceData, 'status' | 'terms'>> {
    id: number;
    invoiceId: number;
    customerName: string;
    invoiceNumber: string;
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

// ============================================================================
// STATUS BADGE HELPER
// - Upcoming: Blue badge (payment due in future)
// - Overdue: Red badge (payment past due date)
// - Completed: Green badge (all payments received, Due Amount = 0)
// ============================================================================
const getFollowUpStatusBadge = (status: FollowUpStatus) => {
    switch (status) {
        case "Upcoming":
            return <Badge variant="secondary">Upcoming</Badge>;
        case "Overdue":
            return <Badge variant="destructive">Overdue</Badge>;
        case "Completed":
        case "Closed":
            return <Badge variant="default" className="bg-green-600 hover:bg-green-700">{status}</Badge>;
        case "Partially Paid":
            return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">Partially Paid</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
};

// ============================================================================
// DATE PICKER COMPONENT
// ============================================================================

// Local DatePicker for forms/modals to avoid conflict with shared DatePicker
function LocalFollowUpDatePicker({ date, setDate, disabled = false, minDate, maxDate }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean,
    minDate?: Date,
    maxDate?: Date
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Previous month's trailing days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const dayDate = new Date(year, month - 1, prevMonthLastDay - i);
            dayDate.setHours(0, 0, 0, 0);
            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            currentDate.setHours(0, 0, 0, 0);

            const isSelected = date &&
                currentDate.getDate() === date.getDate() &&
                currentDate.getMonth() === date.getMonth() &&
                currentDate.getFullYear() === date.getFullYear();

            const isToday = today.getDate() === day &&
                today.getMonth() === month &&
                today.getFullYear() === year;

            // Check if date is within min/max bounds
            let isDateDisabled = false;
            if (minDate) {
                const min = new Date(minDate);
                min.setHours(0, 0, 0, 0);
                if (currentDate < min) isDateDisabled = true;
            }
            if (maxDate) {
                const max = new Date(maxDate);
                max.setHours(23, 59, 59, 999);
                if (currentDate > max) isDateDisabled = true;
            }

            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday,
                isSelected: !!isSelected,
                isDisabled: isDateDisabled
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
                isSelected: false
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
                            disabled={day.isDisabled || !day.isCurrentMonth}
                            className={cn(
                                "h-8 w-8 text-sm font-normal",
                                !day.isCurrentMonth && "text-muted-foreground opacity-50",
                                day.isToday && "bg-accent text-accent-foreground font-semibold",
                                day.isSelected && "bg-primary text-primary-foreground font-semibold",
                                day.isCurrentMonth && "hover:bg-accent hover:text-accent-foreground",
                                day.isDisabled && "opacity-20 cursor-not-allowed pointer-events-none"
                            )}
                            onClick={() => handleDateSelect(day.date)}
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
            <PopoverContent className="w-auto p-4 shadow-lg border rounded-lg z-9999" align="start" side="bottom" sideOffset={4}>
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

const SalesFollowUp = () => {
    const { canView, canEdit, canPrint } = useHasPermission();
    const MODULE_KEY = "SALES/FOLLOW_UP";

    if (!canView(MODULE_KEY)) {
        return <Unauthorized />;
    }

    const { toast } = useToast();
    const [, setLocation] = useLocation();

    // State management
    const [followUpRecords, setFollowUpRecords] = useState<FollowUpDisplay[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterDueDate, setFilterDueDate] = useState<Date | undefined>(undefined);
    const [isListLoading, setIsListLoading] = useState(true);
    const [isViewDetailLoading, setIsViewDetailLoading] = useState(false);
    const [isEditDetailLoading, setIsEditDetailLoading] = useState(false);
    const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
    const [openingRecordId, setOpeningRecordId] = useState<number | null>(null);
    const [totalRecords, setTotalRecords] = useState(0);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Common Store for Statuses
    const followUpStatuses = useCommonStore(state => state.followUpStatuses);

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [activeRecord, setActiveRecord] = useState<FollowUpDisplay | null>(null);
    
    // Edit form states
    const [editFollowUpDate, setEditFollowUpDate] = useState<Date | undefined>(undefined);
    const [editFollowUpNote, setEditFollowUpNote] = useState("");
    const [editNextFollowUpDate, setEditNextFollowUpDate] = useState<Date | undefined>(undefined);
    const [editStatusId, setEditStatusId] = useState<string>("");
    const [tempHistoryEntries, setTempHistoryEntries] = useState<FollowUpNote[]>([]);

    // ============================================================================
    // LOAD AND PROCESS INVOICES
    // Uses shared store that persists across route changes
    // CRITICAL FIX: Only show invoices that have follow-up records (created through dispatch)
    // ============================================================================
    // LOAD AND PROCESS FOLLOW-UP RECORDS
    // CRITICAL FIX: Only show records that exist in both invoice data AND follow-up store
    // This prevents orphaned follow-up records and duplicate display issues
    // ============================================================================
    const loadFollowUpRecords = React.useCallback(async () => {
        setIsListLoading(true);
        try {
            const res = await salesFollowUpApi.getFollowUpList({
                search: debouncedSearchTerm,
                due_date: filterDueDate ? format(filterDueDate, "yyyy-MM-dd") : undefined,
                status_id: filterStatus === "all" ? undefined : filterStatus,
                page: currentPage,
                limit: itemsPerPage
            });

            if (res.isSuccessful && res.data) {
                const mappedRecords: FollowUpDisplay[] = res.data.records.map(record => ({
                    id: record.follow_up_id,
                    invoiceId: record.invoice_id,
                    customerName: record.customer_name,
                    invoiceNumber: record.invoice_code,
                    grandTotal: record.invoice_amount,
                    dueAmount: record.due_amount,
                    currency: record.currency_name,
                    dueDate: record.due_date,
                    lastFollowUpDate: record.follow_up_date,
                    nextFollowUpDate: record.upcoming_follow_up_date,
                    status: record.status_name as FollowUpStatus,
                    notes: [], // Notes will be loaded when record is opened if needed
                    contactPerson: "-", // Placeholder
                    mobileNo: "-", // Placeholder
                    invoiceDate: record.due_date, // Placeholder
                    soNumber: "-", // Placeholder
                    soDate: "-", // Placeholder
                    deliveryDate: "-", // Placeholder
                }));
                setFollowUpRecords(mappedRecords);
                setTotalRecords(res.data.pagination.total_records);
            }
        } catch (error) {
            console.error("Failed to load follow-up records:", error);
            toast({
                title: "Error",
                description: "Failed to load follow-up records.",
                variant: "destructive"
            });
        } finally {
            setIsListLoading(false);
        }
    }, [debouncedSearchTerm, filterDueDate, filterStatus, currentPage, itemsPerPage, toast]);

    const isRowActionBusy =
        openingRecordId !== null ||
        isViewDetailLoading ||
        isEditDetailLoading ||
        isSavingFollowUp;

    // Track if we've set the default status to avoid resetting user selection
    const [isDefaultStatusSet, setIsDefaultStatusSet] = useState(false);
    const isMasterDataLoaded = useCommonStore(state => state.isLoaded);

    // Set default status to 'Upcoming' only once on initial load
    useEffect(() => {
        if (isMasterDataLoaded && !isDefaultStatusSet) {
            if (followUpStatuses.length > 0) {
                const upcomingStatus = followUpStatuses.find(s => 
                    (s.name && s.name.toLowerCase() === 'upcoming') || 
                    (s.value_name && s.value_name.toLowerCase() === 'upcoming')
                );
                if (upcomingStatus) {
                    setFilterStatus(String(upcomingStatus.id || upcomingStatus.value_id || upcomingStatus.status_id));
                }
            }
            setIsDefaultStatusSet(true);
        }
    }, [isMasterDataLoaded, followUpStatuses, isDefaultStatusSet]);

    // Initial load
    useEffect(() => {
        // Only load if we've determined the default status and master data is ready
        // This ensures the first API call correctly uses the 'Upcoming' filter if available
        if (isMasterDataLoaded && isDefaultStatusSet) {
            loadFollowUpRecords();
        }
    }, [loadFollowUpRecords, isMasterDataLoaded, isDefaultStatusSet]);

    // Subscribe to store changes (updates from Payment Follow Up module)
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
        
        // Since the API already filters by status_id, we only apply client-side status filtering
        // as a safety check or if the status name matches (mapping back from filterStatus ID)
        let matchesStatus = true;
        if (filterStatus !== "all") {
            const selectedStatus = followUpStatuses.find(s => 
                String(s.id || s.value_id || s.status_id) === filterStatus
            );
            const statusName = selectedStatus?.name || selectedStatus?.value_name;
            matchesStatus = !statusName || record.status === statusName;
        }
        
        const matchesDueDate = filterDueDate ? record.dueDate === format(filterDueDate, "yyyy-MM-dd") : true;

        return matchesSearch && matchesStatus && matchesDueDate;
    });

    // Pagination calculations
    const totalPages = Math.ceil(totalRecords / itemsPerPage);
    const paginatedData = followUpRecords; // API already returns paginated data

    // Auto-adjust page when data changes
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalRecords, currentPage, totalPages]);

    // Removed redundant useEffect that was causing double API calls on filter changes
    // Current page reset is now handled directly in the onChange handlers of the filters

    // Open follow-up preview
    const handleOpenRecord = async (record: FollowUpDisplay) => {
        if (isRowActionBusy) return;
        setOpeningRecordId(record.id);
        setIsViewDetailLoading(true);
        setActiveRecord(null);
        setIsDialogOpen(true);
        try {
            const res = await salesFollowUpApi.getFollowUpById(record.id);
            if (res.isSuccessful && res.data) {
                const detail = res.data;
                const mappedRecord: FollowUpDisplay = {
                    ...record,
                    customerName: detail.customer_name,
                    contactPerson: detail.contact_person,
                    mobileNo: detail.mobile_no,
                    status: detail.status_name as FollowUpStatus,
                    invoiceNumber: detail.invoice?.invoice_code ?? record.invoiceNumber,
                    invoiceDate: detail.invoice?.invoice_date ?? record.invoiceDate,
                    soNumber: detail.so_code || detail.invoice?.so_code || "-",
                    soDate: detail.so_date || detail.invoice?.order_date || "-",
                    deliveryDate: detail.invoice?.delivery_date || detail.invoice?.due_date || record.deliveryDate,
                    grandTotal: detail.invoice?.invoice_amount ?? record.grandTotal,
                    dueAmount: detail.invoice?.due_amount ?? record.dueAmount,
                    currency: detail.invoice?.currency_name || record.currency || "USh",
                    nextFollowUpDate: detail.upcoming_follow_up_date,
                    notes: (detail.follow_up_history || []).map((h, i) => ({
                        id: i + 1,
                        date: h.follow_up_date,
                        note: h.note
                    })),
                    terms: (detail.payment_terms || []).map(t => ({
                        id: Math.random(),
                        termType: t.term_type,
                        percentage: t.percentage,
                        dueDate: t.due_date,
                        termAmount: t.term_amount,
                        paidAmount: t.paid_amount,
                        dueAmount: t.remaining_amount,
                        status: (t.status.charAt(0).toUpperCase() + t.status.slice(1).toLowerCase()) as any
                    }))
                };
                setActiveRecord(mappedRecord);
            } else {
                toast({
                    title: "Error",
                    description: res.message || "Failed to fetch follow-up details.",
                    variant: "destructive"
                });
                setIsDialogOpen(false);
            }
        } catch (error) {
            console.error("Failed to fetch follow-up details:", error);
            toast({
                title: "Error",
                description: "Failed to fetch follow-up details.",
                variant: "destructive"
            });
            setIsDialogOpen(false);
        } finally {
            setIsViewDetailLoading(false);
            setOpeningRecordId(null);
        }
    };

    // Open edit dialog
    const handleEditRecord = async (record: FollowUpDisplay) => {
        if (isRowActionBusy) return;
        setOpeningRecordId(record.id);
        setIsEditDetailLoading(true);
        try {
            const res = await salesFollowUpApi.getFollowUpById(record.id);
            if (res.isSuccessful && res.data) {
                const detail = res.data;
                const mappedRecord: FollowUpDisplay = {
                    ...record,
                    customerName: detail.customer_name || "",
                    contactPerson: detail.contact_person || "",
                    mobileNo: detail.mobile_no || "",
                    status: detail.status_name as FollowUpStatus,
                    invoiceNumber: detail.invoice.invoice_code || "",
                    invoiceDate: detail.invoice.invoice_date || "",
                    soNumber: detail.so_code || detail.invoice?.so_code || "-",
                    soDate: detail.so_date || detail.invoice?.order_date || "-",
                    deliveryDate: detail.invoice.delivery_date || detail.invoice.due_date || "",
                    grandTotal: detail.invoice.invoice_amount || 0,
                    dueAmount: detail.invoice.due_amount || 0,
                    currency: detail.invoice.currency_name || "USh",
                    nextFollowUpDate: detail.upcoming_follow_up_date || "",
                    notes: (detail.follow_up_history || []).map((h, i) => ({
                        id: i + 1,
                        date: h.follow_up_date,
                        note: h.note
                    })),
                    terms: (detail.payment_terms || []).map(t => ({
                        id: Math.random(),
                        termType: t.term_type,
                        percentage: t.percentage,
                        dueDate: t.due_date,
                        termAmount: t.term_amount,
                        paidAmount: t.paid_amount,
                        dueAmount: t.remaining_amount,
                        status: (t.status.charAt(0).toUpperCase() + t.status.slice(1).toLowerCase()) as any
                    }))
                };
                setActiveRecord(mappedRecord);
                setEditStatusId(String(detail.status_id));
                setEditFollowUpDate(undefined);
                setEditFollowUpNote("");
                setEditNextFollowUpDate(detail.upcoming_follow_up_date ? new Date(detail.upcoming_follow_up_date) : undefined);
                setTempHistoryEntries([]);
                setIsEditDialogOpen(true);
            }
        } catch (error) {
            console.error("Failed to fetch follow-up details for editing:", error);
            toast({
                title: "Error",
                description: "Failed to fetch follow-up details for editing.",
                variant: "destructive"
            });
        } finally {
            setIsEditDetailLoading(false);
            setOpeningRecordId(null);
        }
    };

    // Navigate to invoice detail page
    const handleInvoiceClick = (record: FollowUpDisplay) => {
        setLocation(`/accounting/invoicing?from=sales-follow-up&invoiceId=${record.id}&invoiceNumber=${record.invoiceNumber}`);
    };

    // ============================================================================
    // ADD SALES FOLLOW UP ENTRY
    // Records customer communication notes (calls, emails, meetings)
    // ============================================================================
    const handleAddFollowUpEntry = () => {
        // Validate required fields
        if (!editFollowUpDate) {
            toast({
                title: "Please Check",
                description: "Please select a follow-up date.",
                variant: "destructive"
            });
            return;
        }

        if (!editFollowUpNote.trim()) {
            toast({
                title: "Please Check",
                description: "Please enter a follow-up note.",
                variant: "destructive"
            });
            return;
        }

        // Create new follow-up entry
        const newEntry: FollowUpNote = {
            id: Date.now(),
            date: format(editFollowUpDate, "yyyy-MM-dd"),
            note: editFollowUpNote.trim()
        };

        setTempHistoryEntries(prev => [...prev, newEntry]);
        
        // Reset form fields
        setEditFollowUpDate(undefined);
        setEditFollowUpNote("");

        toast({
            title: "Entry Added",
            description: "Follow-up entry added. Click Save to persist changes.",
            variant: "success"
        });
    };

    // ============================================================================
    // SAVE SALES FOLLOW UP
    // Records customer communication and updates next follow-up date
    // Updates shared store so changes are visible in Payment Follow Up
    // Store update triggers notifyListeners() which reloads the listing
    // ============================================================================
    const handleSaveFollowUp = async () => {
        if (!activeRecord || isRowActionBusy) return;

        const payload = {
            status_id: parseInt(editStatusId),
            upcoming_follow_up_date: editNextFollowUpDate ? format(editNextFollowUpDate, "yyyy-MM-dd") : undefined,
            follow_up_history: tempHistoryEntries.map(entry => ({
                follow_up_date: entry.date,
                note: entry.note
            }))
        };

        setIsSavingFollowUp(true);
        try {
            const res = await salesFollowUpApi.updateFollowUp(activeRecord.id, payload);
            if (res.isSuccessful) {
                toast({
                    title: "Success",
                    description: res.message,
                    variant: "success"
                });
                setIsEditDialogOpen(false);
                setEditFollowUpDate(undefined);
                setEditFollowUpNote("");
                setEditNextFollowUpDate(undefined);
                setTempHistoryEntries([]);
                loadFollowUpRecords();
            } else {
                toast({
                    title: "Update Failed",
                    description: res.message || "Failed to update follow-up record.",
                    variant: "destructive"
                });
            }
        } catch (error: any) {
            console.error("Failed to update follow-up:", error);
            toast({
                title: "Error",
                description: error.message || "An unexpected error occurred while updating the follow-up.",
                variant: "destructive"
            });
        } finally {
            setIsSavingFollowUp(false);
        }
    };

    // Download Follow Up Report as PDF
    const handleDownloadPDF = () => {
        if (!activeRecord) return;

        // Get the preview content element
        const previewContent = document.querySelector('.max-w-\\[210mm\\]');
        if (!previewContent) return;

        // Create iframe for printing
        let iframe = document.querySelector('iframe[name="print-frame"]') as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.name = 'print-frame';
            iframe.style.position = 'absolute';
            iframe.style.top = '-9999px';
            document.body.appendChild(iframe);
        }

        // Clone the preview content HTML
        const clonedContent = previewContent.cloneNode(true) as HTMLElement;

        // Build the complete HTML document with Tailwind CSS classes
        const htmlContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Sales Follow Up Reminder - ${activeRecord.invoiceNumber}</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @page { 
                            size: A4; 
                            margin: 0; 
                        }
                        body { 
                            font-family: 'Inter', system-ui, -apple-system, sans-serif;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                            margin: 0;
                            padding: 0;
                        }
                        @media print {
                            body {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            @page {
                                margin: 0;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${clonedContent.outerHTML}
                </body>
            </html>
        `;

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
            doc.open();
            doc.write(htmlContent);
            doc.close();

            // Wait for Tailwind to load before printing
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            }, 1000);
        }
    }

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sales Follow Up</h1>
            </div>

            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: (val) => {
                        setSearchTerm(val);
                        setCurrentPage(1);
                    },
                    placeholder: "Search by Invoice Code. or Customer Name"
                }}
                filters={[
                    {
                        label: "Due Date",
                        type: "date",
                        value: filterDueDate,
                        onChange: (date: Date | undefined) => {
                            setFilterDueDate(date);
                            setCurrentPage(1);
                        },
                        showClear: true
                    },
                    {
                        label: "Filter By Status",
                        type: "select",
                        value: filterStatus,
                        onChange: (val: string) => {
                            setFilterStatus(val);
                            setCurrentPage(1);
                        },
                        options: [
                            { label: "All Status", value: "all" },
                            ...followUpStatuses.map(s => ({ 
                                label: s.name || s.value_name, 
                                value: String(s.id || s.value_id || s.status_id) 
                            }))
                        ],
                        searchable: true
                    }
                ]}
            />

            {/* Follow Up Table - Matching WarrantyService layout */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 pl-6">Customer Name</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Invoice Code</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">Invoice Amount</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">Due Amount</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Due Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Last Follow Up</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Next Follow Up</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="font-semibold text-xs tracking-wider text-center">Actions</TableHead>
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
                                            <TableCell className="py-4 pl-6 font-bold text-sm text-primary">{record.customerName}</TableCell>
                                            <TableCell className="py-4 text-sm font-medium">
                                                <button
                                                    onClick={() => handleInvoiceClick(record)}
                                                    className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs transition-colors cursor-pointer"
                                                >
                                                    {record.invoiceNumber}
                                                </button>
                                            </TableCell>
                                            <TableCell className="py-4 text-right text-sm font-bold text-green-600">{getCurrencySymbol(record.currency || 'UGX')} {(record.grandTotal || 0).toFixed(2)}</TableCell>
                                            <TableCell className="py-4 text-right text-sm font-bold text-orange-600">{getCurrencySymbol(record.currency || 'UGX')} {(record.dueAmount || 0).toFixed(2)}</TableCell>
                                            <TableCell className="py-4 text-sm font-medium">
                                                {safeFormatDate(record.dueDate)}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                {safeFormatDate(record.lastFollowUpDate)}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                {safeFormatDate(record.nextFollowUpDate)}
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                {getFollowUpStatusBadge(record.status)}
                                            </TableCell>
                                             <TableCell className="py-4 text-center">
                                                <TableActionButtons
                                                    onView={canView(MODULE_KEY) ? () => handleOpenRecord(record) : undefined}
                                                    onEdit={canEdit(MODULE_KEY) && record.status !== "Closed" ? () => handleEditRecord(record) : undefined}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalRecords > 0 && !isListLoading && (
                        <div className="px-4 py-2 border-t">
                            <DataTablePagination
                                currentPage={currentPage}
                                totalPages={Math.ceil(totalRecords / itemsPerPage)}
                                totalItems={totalRecords}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                                options={[10, 15, 30, 50]}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Follow Up Preview Dialog - PDF Style Document */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-[900px] max-h-[95vh] flex flex-col p-0">
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
                                        <h2 className="text-xl font-bold text-slate-800">SALES FOLLOW UP REMINDER</h2>
                                        <p className="text-xs text-slate-700 mt-1 font-semibold">Reference: FU-{activeRecord?.id}</p>
                                        <p className="text-[9px] text-slate-500 mt-1">Generated: {format(new Date(), "dd/MM/yyyy, HH:mm")}</p>
                                    </div>
                                </div>

                                {/* Customer Information Section */}
                                <div className="border-2 border-slate-300 rounded bg-slate-50 p-4 mb-4">
                                    <h3 className="text-[10px] uppercase font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200 tracking-wide">Customer Information</h3>
                                    <div className="space-y-1.5">
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Customer Name:</span>
                                            <span className="font-bold text-slate-900">{activeRecord?.customerName}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Contact Person:</span>
                                            <span className="font-medium text-slate-900">{activeRecord?.contactPerson || "-"}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Mobile No:</span>
                                            <span className="font-medium text-slate-900">{activeRecord?.mobileNo || "-"}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Follow Up Status:</span>
                                            <span className="font-medium text-slate-900">{activeRecord?.status}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Invoice Details Section */}
                                <div className="border-2 border-slate-300 rounded bg-slate-50 p-4 mb-4">
                                    <h3 className="text-[10px] uppercase font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200 tracking-wide">Invoice Details</h3>
                                    <div className="space-y-1.5">
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
                                            <span className="w-36 text-slate-600 font-medium">SO Code:</span>
                                            <span className="font-medium text-slate-900">{activeRecord?.soNumber || "-"}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">SO Date:</span>
                                            <span className="font-medium text-slate-900">
                                                {safeFormatDate(activeRecord?.soDate)}
                                            </span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Delivery Date:</span>
                                            <span className="font-medium text-slate-900">
                                                {safeFormatDate(activeRecord?.deliveryDate)}
                                            </span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Currency:</span>
                                            <span className="font-medium text-slate-900">{activeRecord?.currency || "-"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Amount Summary Section */}
                                <div className="border-2 border-slate-300 rounded bg-slate-50 p-4 mb-4">
                                    <h3 className="text-[10px] uppercase font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200 tracking-wide">Amount Summary</h3>
                                    <div className="space-y-1.5">
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Invoice Amount:</span>
                                            <span className="font-bold text-slate-900">USh {(activeRecord?.grandTotal || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Due Amount:</span>
                                            <span className="font-bold text-slate-900">USh {(activeRecord?.dueAmount || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Last Follow Up:</span>
                                            <span className="font-medium text-slate-900">
                                                {activeRecord?.lastFollowUpDate ? safeFormatDate(activeRecord.lastFollowUpDate) : "Not Yet"}
                                            </span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Next Follow Up:</span>
                                            <span className="font-medium text-slate-900">
                                                {activeRecord?.nextFollowUpDate ? safeFormatDate(activeRecord.nextFollowUpDate) : "Not Set"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {(() => {
                                    const terms = activeRecord?.terms || [];
                                    
                                    if (terms.length > 0) {
                                        return (
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
                                                        {terms.map((term: any, index: number) => (
                                                            <tr key={term.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                                <td className="border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">{term.termType}</td>
                                                                <td className="border border-slate-300 px-3 py-2 text-xs text-center text-slate-600">{term.percentage}%</td>
                                                                <td className="border border-slate-300 px-3 py-2 text-xs text-center text-slate-600">
                                                                    {safeFormatDate(term.dueDate)}
                                                                </td>
                                                                <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-slate-700">{getCurrencySymbol(activeRecord?.currency || 'UGX')} {term.termAmount.toFixed(2)}</td>
                                                                <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-green-600">{getCurrencySymbol(activeRecord?.currency || 'UGX')} {term.paidAmount.toFixed(2)}</td>
                                                                <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-orange-600">{getCurrencySymbol(activeRecord?.currency || 'UGX')} {term.dueAmount.toFixed(2)}</td>
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
                                                            <td colSpan={3} className="border border-slate-300 px-3 py-2 text-xs text-right text-slate-700">Total:</td>
                                                            <td className="border border-slate-300 px-3 py-2 text-xs text-right text-slate-900">{getCurrencySymbol(activeRecord?.currency || 'UGX')} {terms.reduce((sum: number, t: any) => sum + t.termAmount, 0).toFixed(2)}</td>
                                                            <td className="border border-slate-300 px-3 py-2 text-xs text-right text-green-700">{getCurrencySymbol(activeRecord?.currency || 'UGX')} {terms.reduce((sum: number, t: any) => sum + t.paidAmount, 0).toFixed(2)}</td>
                                                            <td className="border border-slate-300 px-3 py-2 text-xs text-right text-orange-700">{getCurrencySymbol(activeRecord?.currency || 'UGX')} {terms.reduce((sum: number, t: any) => sum + t.dueAmount, 0).toFixed(2)}</td>
                                                            <td className="border border-slate-300 px-3 py-2"></td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* Follow Up History Table */}
                                <div className="mb-6">
                                    <h3 className="text-[9px] font-bold text-slate-600 mb-2 uppercase tracking-wide">Communication Follow-Up History</h3>
                                    <table className="w-full border-collapse border border-slate-300">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="border border-slate-300 px-3 py-2 text-left text-[9px] uppercase font-bold text-slate-600" style={{ width: '120px' }}>Follow Up Date</th>
                                                <th className="border border-slate-300 px-3 py-2 text-left text-[9px] uppercase font-bold text-slate-600">Communication Note</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeRecord && activeRecord.notes.length > 0 ? (
                                                activeRecord.notes.map((note) => (
                                                    <tr key={note.id}>
                                                        <td className="border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700" style={{ width: '120px' }}>
                                                            {safeFormatDate(note.date)}
                                                        </td>
                                                        <td className="border border-slate-300 px-3 py-2 text-xs text-slate-600">{note.note}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={2} className="border border-slate-300 px-3 py-4 text-center text-xs text-slate-500 italic">
                                                        No follow-up communication recorded yet
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer */}
                                <div className="mt-8 pt-4 border-t border-slate-200 text-center">
                                    <p className="text-[9px] text-slate-500">This is a computer-generated sales follow-up reminder document</p>
                                    <p className="text-[9px] text-slate-600 font-semibold">Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons Outside Document */}
                    <div className="flex justify-end gap-3 p-4 border-t bg-white">
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

            {/* Edit Follow Up Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent 
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader className="border-b bg-white p-4 sm:p-6">
                        <DialogTitle className="text-2xl font-bold">Edit Follow Up</DialogTitle>
                        <DialogDescription>
                            Add follow-up note and update next follow-up date
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 space-y-6 relative">
                        {(isEditDetailLoading || isSavingFollowUp) && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
                        {/* Readonly Header Section */}
                        <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/20 p-4 sm:p-5 md:grid-cols-2 lg:grid-cols-3">
                            <div className="min-w-0 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Customer Name</Label>
                                <p className="text-sm font-bold text-slate-900 whitespace-normal wrap-break-word">{activeRecord?.customerName}</p>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice Code</Label>
                                <p className="text-sm font-bold text-blue-600">{activeRecord?.invoiceNumber}</p>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                                <div className="pt-0.5">
                                    {activeRecord && getFollowUpStatusBadge(activeRecord.status)}
                                </div>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice Amount</Label>
                                <p className="text-sm font-bold text-green-600 tabular-nums">USh {(activeRecord?.grandTotal || 0).toFixed(2)}</p>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Due Amount</Label>
                                <p className="text-sm font-bold text-orange-600 tabular-nums">USh {(activeRecord?.dueAmount || 0).toFixed(2)}</p>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Due Date</Label>
                                <p className="text-sm font-medium text-slate-700">
                                    {safeFormatDate(activeRecord?.dueDate)}
                                </p>
                            </div>
                        </div>

                        {/* ============================================================================
                            PAYMENT TERMS BREAKDOWN
                            Shows how the invoice amount is divided into payment terms
                            ============================================================================ */}
                        {(() => {
                            const salesFollowUp = activeRecord ? getSalesFollowUpByInvoice(activeRecord.invoiceNumber) : null;
                            const terms = salesFollowUp?.terms || [];
                            
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
                                                    {terms.map((term: any, index: number) => (
                                                        <TableRow 
                                                            key={term.id} 
                                                            className={index % 2 === 0 ? 'border-b border-slate-200 transition-colors bg-white hover:bg-slate-50 align-top' : 'border-b border-slate-200 transition-colors bg-slate-50 hover:bg-slate-100 align-top'}
                                                        >
                                                            <TableCell className="font-medium text-slate-900 py-3 px-4 whitespace-normal wrap-break-word">{term.termType}</TableCell>
                                                            <TableCell className="text-center text-slate-700 py-3 px-4 tabular-nums">{term.percentage}%</TableCell>
                                                            <TableCell className="text-center text-slate-700 py-3 px-4 tabular-nums">
                                                                {safeFormatDate(term.dueDate)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-slate-900 py-3 px-4 tabular-nums">
                                                                USh {term.termAmount.toFixed(2)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-green-600 py-3 px-4 tabular-nums">
                                                                USh {term.paidAmount.toFixed(2)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-orange-600 py-3 px-4 tabular-nums">
                                                                USh {term.dueAmount.toFixed(2)}
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
                                                            USh {terms.reduce((sum: number, t: any) => sum + t.termAmount, 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-green-700 py-3 px-4 tabular-nums">
                                                            USh {terms.reduce((sum: number, t: any) => sum + t.paidAmount, 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-orange-700 py-3 px-4 tabular-nums">
                                                            USh {terms.reduce((sum: number, t: any) => sum + t.dueAmount, 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="py-3 px-4"></TableCell>
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
                            UPCOMING FOLLOW UP DATE
                            Sales team sets the next scheduled follow-up date
                            ============================================================================ */}
                        <div className="space-y-2 max-w-md">
                            <Label className="text-sm font-bold">Upcoming Follow Up Date</Label>
                            <LocalFollowUpDatePicker 
                                date={editNextFollowUpDate} 
                                setDate={setEditNextFollowUpDate}
                                minDate={new Date()} // Allow only today and future dates
                            />
                        </div>

                        {/* ============================================================================
                            SALES FOLLOW UP ENTRY SECTION
                            Fields: Follow Up Date, Follow Up Note
                            Each entry saved in Sales Follow Up History
                            ============================================================================ */}
                        <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/20 p-4 sm:p-5 md:grid-cols-12 md:items-end">
                            <div className="md:col-span-3">
                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Follow Up Date <span className="text-red-500">*</span></Label>
                                <LocalFollowUpDatePicker 
                                    date={editFollowUpDate} 
                                    setDate={setEditFollowUpDate}
                                    maxDate={new Date()} // Allow only today and past dates
                                />
                            </div>

                            <div className="md:col-span-8">
                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Follow Up Note <span className="text-red-500">*</span></Label>
                                <Input
                                    value={editFollowUpNote}
                                    onChange={(e) => {
                                        if (e.target.value.length <= 200) {
                                            setEditFollowUpNote(e.target.value);
                                        }
                                    }}
                                    placeholder="Enter follow-up note..."
                                    className="h-9 bg-white border-slate-200"
                                    maxLength={200}
                                />
                            </div>

                            <div className="flex md:col-span-1 md:justify-end">
                                <Button 
                                    onClick={handleAddFollowUpEntry}
                                    className="h-9 w-9 p-0 rounded-lg shadow-sm"
                                    title="Add follow-up entry"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* ============================================================================
                            SALES FOLLOW UP HISTORY
                            Shows all communication entries recorded by sales team
                            ============================================================================ */}
                        <div className="space-y-3">
                            <Label className="text-sm font-bold">Follow-Up History</Label>
                            {(activeRecord && (activeRecord.notes.length > 0 || tempHistoryEntries.length > 0)) ? (
                                <div className="border rounded-lg overflow-hidden bg-muted/10">
                                    <Table className="table-fixed">
                                        <colgroup>
                                            <col className="w-[140px]" />
                                            <col />
                                        </colgroup>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30">
                                                <TableHead className="font-bold py-2 pl-4">Follow Up Date</TableHead>
                                                <TableHead className="font-bold py-2 pr-4">Note</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activeRecord.notes.map((note) => (
                                                <TableRow key={note.id} className="align-top">
                                                    <TableCell className="py-3 pl-4 font-medium tabular-nums">
                                                        {safeFormatDate(note.date)}
                                                    </TableCell>
                                                    <TableCell className="py-3 pr-4 whitespace-normal wrap-break-word text-slate-600">
                                                        {note.note}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {tempHistoryEntries.map((entry) => (
                                                <TableRow key={entry.id} className="bg-blue-50/60 align-top">
                                                    <TableCell className="py-3 pl-4 font-medium tabular-nums">
                                                        {safeFormatDate(entry.date)}
                                                    </TableCell>
                                                    <TableCell className="py-3 pr-4 whitespace-normal wrap-break-word text-slate-600">
                                                        {entry.note}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="p-4 bg-muted/30 rounded-lg border text-center">
                                    <p className="text-sm text-muted-foreground italic">No follow-up history yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dialog Footer */}
                    <DialogFooter className="border-t bg-white p-4 sm:p-6 mt-auto gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={handleSaveFollowUp} 
                            loading={isSavingFollowUp}
                            className="bg-blue-600 hover:bg-blue-700"
                            disabled={!canEdit(MODULE_KEY) || isEditDetailLoading || isSavingFollowUp}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SalesFollowUp;
