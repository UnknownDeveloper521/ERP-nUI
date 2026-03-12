// ============================================================================
// SALES FOLLOW UP COMPONENT
// Track follow-ups for invoices with due amounts
// 
// INTEGRATION WITH PAYMENT FOLLOW UP:
// - Both modules work with the same Invoice data source (mockInvoices.ts)
// - Linked using Invoice No or Invoice ID
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

import React, { useState, useEffect } from "react";
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
    updateSalesFollowUp,
    subscribeToFollowUpStore,
    getSalesFollowUpRecords
} from "@/lib/followUpStore";
import { type PaymentTermBreakdown } from "@/lib/mockFollowUpData";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Currency symbol helper
const getCurrencySymbol = (currency: string): string => {
    const symbols: Record<string, string> = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'INR': '₹',
        'JPY': '¥',
        'CNY': '¥',
        'AUD': 'A$',
        'CAD': 'C$',
        'CHF': 'CHF',
        'SEK': 'kr',
        'NZD': 'NZ$',
        'UGX': 'USh'
    };
    return symbols[currency] || currency;
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
                isSelected: false
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
                isSelected
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
                            className={cn(
                                "h-8 w-8 text-sm font-normal",
                                !day.isCurrentMonth && "text-muted-foreground opacity-50",
                                day.isToday && "bg-accent text-accent-foreground font-semibold",
                                day.isSelected && "bg-primary text-primary-foreground font-semibold",
                                day.isCurrentMonth && "hover:bg-accent hover:text-accent-foreground"
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

const SalesFollowUp = () => {
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
    
    // Edit form states
    const [editFollowUpDate, setEditFollowUpDate] = useState<Date | undefined>(undefined);
    const [editFollowUpNote, setEditFollowUpNote] = useState("");
    const [editNextFollowUpDate, setEditNextFollowUpDate] = useState<Date | undefined>(undefined);
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
    const loadFollowUpRecords = React.useCallback(() => {
        console.log('[DEBUG] Load Follow-Up Records - Start');
        
        // Get follow-up records from store (primary source)
        const salesFollowUpRecords = getSalesFollowUpRecords();
        const invoices = getInvoices();
        
        console.log('[DEBUG] Data sources:', {
            salesFollowUpCount: salesFollowUpRecords.length,
            invoiceCount: invoices.length,
            salesInvoices: salesFollowUpRecords.map(r => r.invoiceNo),
            availableInvoices: invoices.map(i => i.invoiceNumber)
        });
        
        // DEBUG: Check for duplicates in the store data
        const invoiceNumbers = salesFollowUpRecords.map(r => r.invoiceNo);
        const duplicates = invoiceNumbers.filter((item, index) => invoiceNumbers.indexOf(item) !== index);
        if (duplicates.length > 0) {
            console.warn('[DEBUG] ⚠️ DUPLICATE INVOICE NUMBERS FOUND IN STORE:', duplicates);
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // CRITICAL FIX: Only process follow-up records that have corresponding invoices
        // This prevents orphaned records and duplicate display issues
        const records: FollowUpDisplay[] = salesFollowUpRecords
            .map(salesFollowUp => {
                // CRITICAL: Must have corresponding invoice data
                const invoice = invoices.find(inv => inv.invoiceNumber === salesFollowUp.invoiceNo);
                
                if (!invoice) {
                    console.warn(`[SKIP] No invoice found for follow-up record: ${salesFollowUp.invoiceNo}`);
                    return null;
                }
                
                // Get corresponding payment follow-up data
                const paymentFollowUp = getPaymentFollowUpByInvoice(salesFollowUp.invoiceNo);
                
                console.log(`[DEBUG] Processing follow-up ${salesFollowUp.invoiceNo}:`, {
                    invoiceFound: true,
                    lastFollowUpDate: salesFollowUp.lastFollowUpDate,
                    nextFollowUpDate: salesFollowUp.nextFollowUpDate,
                    historyCount: salesFollowUp.history.length,
                    dueAmount: salesFollowUp.dueAmount
                });
                
                // Use follow-up data for amounts (more accurate than invoice data)
                const invoiceAmount = salesFollowUp.invoiceAmount;
                const dueAmount = salesFollowUp.dueAmount;
                
                // Get the next unpaid due date from sales follow-up
                const nextUnpaidDueDate = salesFollowUp.dueDate;
                
                // ============================================================================
                // STATUS DETERMINATION LOGIC (synchronized with Payment Follow Up)
                // Priority 1: Check if payment is completed (Due Amount = 0)
                // Priority 2: Check if overdue (today > next unpaid due date)
                // Priority 3: Default to Upcoming
                // ============================================================================
                let status: FollowUpStatus = "Upcoming";
                
                // Priority 1: Check if payment is completed (Due Amount = 0)
                if (dueAmount <= 0) {
                    status = "Completed";
                } 
                // Priority 2: Check if overdue (only if not completed and has next unpaid due date)
                else if (nextUnpaidDueDate && nextUnpaidDueDate !== "-") {
                    const dueDate = new Date(nextUnpaidDueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    if (dueDate < today) {
                        status = "Overdue";
                    }
                }
                
                // Convert sales follow-up history to display format
                const notes: FollowUpNote[] = salesFollowUp.history.map((entry, index) => ({
                    id: index + 1,
                    date: entry.followUpDate,
                    note: entry.note
                }));
                
                return {
                    ...invoice,
                    grandTotal: invoiceAmount, // Use follow-up invoice amount
                    dueDate: nextUnpaidDueDate || "", // Use next unpaid due date (empty if all paid)
                    dueAmount,
                    status,
                    lastFollowUpDate: salesFollowUp.lastFollowUpDate,
                    nextFollowUpDate: salesFollowUp.nextFollowUpDate,
                    notes,
                    terms: salesFollowUp.terms || [] // Include terms for breakdown display
                } as FollowUpDisplay;
            })
            .filter((record): record is FollowUpDisplay => record !== null);

        // ADDITIONAL DUPLICATE PREVENTION: Remove any duplicates by invoice number
        const uniqueRecords = records.filter((record, index, array) => {
            const firstIndex = array.findIndex(r => r.invoiceNumber === record.invoiceNumber);
            if (firstIndex !== index) {
                console.warn(`[DUPLICATE REMOVED] Duplicate follow-up record for invoice: ${record.invoiceNumber}`);
                return false;
            }
            return true;
        });

        console.log('[DEBUG] Load Follow-Up Records - Complete', {
            totalRecords: uniqueRecords.length,
            recordsWithLastFollowUp: uniqueRecords.filter(r => r.lastFollowUpDate).length,
            recordsWithNextFollowUp: uniqueRecords.filter(r => r.nextFollowUpDate).length,
            finalInvoices: uniqueRecords.map(r => r.invoiceNumber)
        });

        setFollowUpRecords(uniqueRecords);
    }, []);

    // Initial load
    useEffect(() => {
        loadFollowUpRecords();
    }, [loadFollowUpRecords]);

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
        
        const matchesStatus = filterStatus === "all" ? true : record.status === filterStatus;

        return matchesSearch && matchesStatus;
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

    // Open edit dialog
    const handleEditRecord = (record: FollowUpDisplay) => {
        setActiveRecord({ ...record });
        setEditFollowUpDate(undefined);
        setEditFollowUpNote("");
        setEditNextFollowUpDate(record.nextFollowUpDate ? new Date(record.nextFollowUpDate) : undefined);
        setTempHistoryEntries([]);
        setIsEditDialogOpen(true);
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
                title: "Validation Error",
                description: "Please select a follow-up date.",
                variant: "destructive"
            });
            return;
        }

        if (!editFollowUpNote.trim()) {
            toast({
                title: "Validation Error",
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
            description: "Follow-up entry added. Click Save to persist changes."
        });
    };

    // ============================================================================
    // SAVE SALES FOLLOW UP
    // Records customer communication and updates next follow-up date
    // Updates shared store so changes are visible in Payment Follow Up
    // Store update triggers notifyListeners() which reloads the listing
    // ============================================================================
    const handleSaveFollowUp = () => {
        if (!activeRecord) return;

        console.log('[DEBUG] Save Follow-Up - Start', {
            invoiceNumber: activeRecord.invoiceNumber,
            tempHistoryEntries: tempHistoryEntries.length
        });

        // Determine last follow-up date from latest entry
        let lastFollowUpDate = activeRecord.lastFollowUpDate;
        if (tempHistoryEntries.length > 0) {
            const latestEntry = tempHistoryEntries[tempHistoryEntries.length - 1];
            lastFollowUpDate = latestEntry.date;
        }

        // Convert temporary entries to history format
        const newHistory = tempHistoryEntries.map(entry => ({
            followUpDate: entry.date,
            note: entry.note
        }));

        const nextFollowUpDate = editNextFollowUpDate ? format(editNextFollowUpDate, "yyyy-MM-dd") : undefined;

        console.log('[DEBUG] Save Follow-Up - Updates', {
            invoiceNumber: activeRecord.invoiceNumber,
            newHistory,
            lastFollowUpDate,
            nextFollowUpDate
        });

        // Update shared store (persists across route changes)
        // This triggers notifyListeners() which calls loadFollowUpRecords() via subscription
        updateSalesFollowUp(activeRecord.invoiceNumber, {
            newHistory,
            lastFollowUpDate,
            nextFollowUpDate
        });

        console.log('[DEBUG] Save Follow-Up - Store Updated');

        toast({
            title: "Follow-Up Saved",
            description: "Follow-up record has been saved successfully."
        });

        // Close dialog and reset form
        setIsEditDialogOpen(false);
        setEditFollowUpDate(undefined);
        setEditFollowUpNote("");
        setEditNextFollowUpDate(undefined);
        setTempHistoryEntries([]);
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
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sales Follow Up</h1>
                <p className="text-muted-foreground">Track and manage follow-ups for invoices with pending payments.</p>
            </div>

            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-xl border shadow-sm">
                <div className="w-full sm:flex-1">
                    <Label className="mb-2 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Search</Label>
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
                    <Label className="mb-2 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Filter By Status</Label>
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
            <Card className="border shadow-sm overflow-hidden bg-white/50">
                <CardContent className="p-0">
                    <div className="rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4 pl-6">Customer Name</TableHead>
                                    <TableHead className="font-bold uppercase text-[11px] tracking-wider">Invoice No</TableHead>
                                    <TableHead className="font-bold uppercase text-[11px] tracking-wider text-right">Invoice Amount</TableHead>
                                    <TableHead className="font-bold uppercase text-[11px] tracking-wider text-right">Due Amount</TableHead>
                                    <TableHead className="font-bold uppercase text-[11px] tracking-wider">Due Date</TableHead>
                                    <TableHead className="font-bold uppercase text-[11px] tracking-wider">Last Follow Up</TableHead>
                                    <TableHead className="font-bold uppercase text-[11px] tracking-wider">Next Follow Up</TableHead>
                                    <TableHead className="font-bold uppercase text-[11px] tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-right font-bold uppercase text-[11px] tracking-wider pr-6">Actions</TableHead>
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
                                        <TableRow key={record.id} className="hover:bg-muted/20 group transition-colors border-b last:border-none">
                                            <TableCell className="py-4 pl-6 font-bold text-sm text-primary">{record.customerName}</TableCell>
                                            <TableCell className="py-4 text-sm font-medium">
                                                <button
                                                    onClick={() => handleInvoiceClick(record)}
                                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors cursor-pointer"
                                                >
                                                    {record.invoiceNumber}
                                                </button>
                                            </TableCell>
                                            <TableCell className="py-4 text-right text-sm font-bold text-green-600">USh {record.grandTotal.toFixed(2)}</TableCell>
                                            <TableCell className="py-4 text-right text-sm font-bold text-orange-600">USh {record.dueAmount.toFixed(2)}</TableCell>
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
                                            <TableCell className="py-4 text-right pr-6">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        onClick={() => handleOpenRecord(record)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                                        onClick={() => handleEditRecord(record)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t">
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredRecords.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    </div>
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
                                            <span className="w-36 text-slate-600 font-medium">SO Number:</span>
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
                                            <span className="font-bold text-slate-900">USh {activeRecord?.grandTotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex text-xs">
                                            <span className="w-36 text-slate-600 font-medium">Due Amount:</span>
                                            <span className="font-bold text-slate-900">USh {activeRecord?.dueAmount.toFixed(2)}</span>
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

                                {/* Payment Terms Breakdown Section */}
                                {(() => {
                                    const salesFollowUp = activeRecord ? getSalesFollowUpByInvoice(activeRecord.invoiceNumber) : null;
                                    const terms = salesFollowUp?.terms || [];
                                    
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
                                                        {terms.map((term, index) => (
                                                            <tr key={term.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                                <td className="border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">{term.termType}</td>
                                                                <td className="border border-slate-300 px-3 py-2 text-xs text-center text-slate-600">{term.percentage}%</td>
                                                                <td className="border border-slate-300 px-3 py-2 text-xs text-center text-slate-600">
                                                                    {safeFormatDate(term.dueDate)}
                                                                </td>
                                                                <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-slate-700">USh {term.termAmount.toFixed(2)}</td>
                                                                <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-green-600">USh {term.paidAmount.toFixed(2)}</td>
                                                                <td className="border border-slate-300 px-3 py-2 text-xs text-right font-bold text-orange-600">USh {term.dueAmount.toFixed(2)}</td>
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
                                                            <td className="border border-slate-300 px-3 py-2 text-xs text-right text-slate-900">USh {terms.reduce((sum, t) => sum + t.termAmount, 0).toFixed(2)}</td>
                                                            <td className="border border-slate-300 px-3 py-2 text-xs text-right text-green-700">USh {terms.reduce((sum, t) => sum + t.paidAmount, 0).toFixed(2)}</td>
                                                            <td className="border border-slate-300 px-3 py-2 text-xs text-right text-orange-700">USh {terms.reduce((sum, t) => sum + t.dueAmount, 0).toFixed(2)}</td>
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
                        <Button 
                            onClick={handleDownloadPDF} 
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Follow Up Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-[900px] max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle className="text-2xl font-bold">Edit Follow Up</DialogTitle>
                        <DialogDescription>
                            Add follow-up note and update next follow-up date
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
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice No</Label>
                                <p className="text-sm font-bold text-blue-600">{activeRecord?.invoiceNumber}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                                {activeRecord && getFollowUpStatusBadge(activeRecord.status)}
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice Amount</Label>
                                <p className="text-sm font-bold text-green-600">USh {activeRecord?.grandTotal.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Due Amount</Label>
                                <p className="text-sm font-bold text-orange-600">USh {activeRecord?.dueAmount.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
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
                                                                {safeFormatDate(term.dueDate)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-slate-900 py-3 px-4">
                                                                USh {term.termAmount.toFixed(2)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-green-600 py-3 px-4">
                                                                USh {term.paidAmount.toFixed(2)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-orange-600 py-3 px-4">
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
                                                    <TableRow className="bg-slate-200 border-t-2 border-slate-400">
                                                        <TableCell colSpan={3} className="text-right font-bold text-slate-900 py-4 px-4 text-base">
                                                            Total:
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-slate-900 py-4 px-4 text-base">
                                                            USh {terms.reduce((sum, t) => sum + t.termAmount, 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-green-700 py-4 px-4 text-base">
                                                            USh {terms.reduce((sum, t) => sum + t.paidAmount, 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-orange-700 py-4 px-4 text-base">
                                                            USh {terms.reduce((sum, t) => sum + t.dueAmount, 0).toFixed(2)}
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
                            NEXT FOLLOW UP DATE
                            Sales team sets the next scheduled follow-up date
                            ============================================================================ */}
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Next Follow Up Date</Label>
                            <DatePicker 
                                date={editNextFollowUpDate} 
                                setDate={setEditNextFollowUpDate}
                            />
                        </div>

                        {/* ============================================================================
                            SALES FOLLOW UP ENTRY SECTION
                            Fields: Follow Up Date, Follow Up Note
                            Each entry saved in Sales Follow Up History
                            ============================================================================ */}
                        <div className="grid grid-cols-12 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
                            <div className="col-span-4">
                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Follow Up Date <span className="text-red-500">*</span></Label>
                                <DatePicker 
                                    date={editFollowUpDate} 
                                    setDate={setEditFollowUpDate}
                                />
                            </div>

                            <div className="col-span-7">
                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Follow Up Note <span className="text-red-500">*</span></Label>
                                <Input
                                    value={editFollowUpNote}
                                    onChange={(e) => setEditFollowUpNote(e.target.value)}
                                    placeholder="Enter follow-up note..."
                                    className="h-10 bg-white border-slate-200"
                                />
                            </div>

                            <div className="col-span-1 flex items-end pb-0.5">
                                <Button 
                                    onClick={handleAddFollowUpEntry}
                                    className="h-10 w-10 p-0 rounded-xl shadow-lg shadow-primary/20"
                                >
                                    <Plus className="h-5 w-5" />
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
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="font-bold w-[150px]">Follow Up Date</TableHead>
                                                <TableHead className="font-bold">Note</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activeRecord.notes.map((note) => (
                                                <TableRow key={note.id}>
                                                    <TableCell className="font-medium">
                                                        {safeFormatDate(note.date)}
                                                    </TableCell>
                                                    <TableCell>{note.note}</TableCell>
                                                </TableRow>
                                            ))}
                                            {tempHistoryEntries.map((entry) => (
                                                <TableRow key={entry.id} className="bg-blue-50">
                                                    <TableCell className="font-medium">
                                                        {safeFormatDate(entry.date)}
                                                    </TableCell>
                                                    <TableCell>{entry.note}</TableCell>
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
                    <DialogFooter className="p-6 border-t">
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveFollowUp} className="bg-blue-600 hover:bg-blue-700">Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SalesFollowUp;
