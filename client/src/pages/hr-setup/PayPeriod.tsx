import React, { useState } from "react";
import { format, addMonths, subMonths, isSameMonth, isValid, parse, getYear, getMonth, setMonth, setYear, startOfMonth, endOfMonth, isBefore, isAfter } from "date-fns";
import { Calendar as CalendarIcon, Plus, Search, Edit, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInputBorderless,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Types
interface PayPeriod {
    id: string;
    periodName: string; // e.g. "Feb-2026"
    month: number; // 0-11
    year: number;
    startDate: string;
    endDate: string;
    status: "Open" | "Locked" | "Processed" | "Paid";
    notes?: string;
}

// Mock Data
// ⚠️ SAFE GUARD: Added ONE mock pay period to prevent runtime crashes
// This ensures pay period page never crashes when empty
// ============================================================================
const MOCK_PERIODS: PayPeriod[] = [
  {
    id: "pp-001",
    periodName: "Jan-2026",
    month: 0, // January (0-indexed)
    year: 2026,
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    status: "Open",
    notes: "First pay period of 2026"
  }
];

export default function PayPeriodPage() {
    const { toast } = useToast();

    // State
    const [periods, setPeriods] = useState<PayPeriod[]>(MOCK_PERIODS);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isMonthOpen, setIsMonthOpen] = useState(false);
    const [isYearOpen, setIsYearOpen] = useState(false);
    const [yearNavStart, setYearNavStart] = useState(new Date().getFullYear() - 1); // Start view around current year
    const [currentPage, setCurrentPage] = useState(1);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const itemsPerPage = 10;

    // New Period Form State
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [selectedYear, setSelectedYear] = useState<string>("");
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [selectedStatus, setSelectedStatus] = useState<PayPeriod["status"]>("Open");
    const [notes, setNotes] = useState("");
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    
    // ⚠️ NEW: Track original period when editing (to detect status-only changes)
    const [originalPeriod, setOriginalPeriod] = useState<PayPeriod | null>(null);

    // Derived Values
    const getPeriodName = (month: number, year: number) => {
        return format(new Date(year, month, 1), "MMM-yyyy");
    };

    // --- Handlers ---

    // Auto-calculate start/end based on selected month/year
    const handlePeriodChange = (monthStr: string, yearStr: string) => {
        const month = parseInt(monthStr);
        const year = parseInt(yearStr);

        if (!isNaN(month) && !isNaN(year)) {
            const start = startOfMonth(new Date(year, month));
            const end = endOfMonth(new Date(year, month));

            setStartDate(start);
            setEndDate(end); // Auto-set End Date = last day of month (handle leap year)

            // Clear Date errors
            setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.startDate;
                delete newErrors.endDate;
                delete newErrors.period;
                return newErrors;
            });
        }
    };

    const resetForm = () => {
        setSelectedMonth("");
        setSelectedYear("");
        setStartDate(undefined);
        setEndDate(undefined);
        setSelectedStatus("Open");
        setNotes("");
        setFormErrors({});
        setEditingId(null);
        setOriginalPeriod(null); // ⚠️ Clear original period
    };

    const validateForm = (): boolean => {
        const errors: { [key: string]: string } = {};
        const today = new Date();

        // ============================================================================
        // ⚠️ SPECIAL CASE: Status-Only Change (Skip Date Validations)
        // ============================================================================
        // If editing and ONLY status changed (dates unchanged), skip all date validations
        // This allows changing Locked → Processed without overlap/date errors
        // ============================================================================
        const isStatusOnlyChange = editingId && originalPeriod && 
            selectedMonth === originalPeriod.month.toString() &&
            selectedYear === originalPeriod.year.toString() &&
            startDate && format(startDate, 'yyyy-MM-dd') === originalPeriod.startDate &&
            endDate && format(endDate, 'yyyy-MM-dd') === originalPeriod.endDate;

        if (isStatusOnlyChange) {
            // Only validate that status is selected
            if (!selectedStatus) {
                errors.status = "Status is required";
                setFormErrors(errors);
                return false;
            }
            // Skip all other validations
            setFormErrors({});
            return true;
        }

        // ============================================================================
        // NORMAL VALIDATION (when dates are being changed)
        // ============================================================================

        // A) Required
        if (!selectedMonth) errors.month = "Month is required";
        if (!selectedYear) errors.year = "Year is required";
        if (!startDate) errors.startDate = "Start Date is required";
        if (!endDate) errors.endDate = "End Date is required";

        if (errors.month || errors.year || errors.startDate || errors.endDate) {
            setFormErrors(errors);
            return false;
        }

        const month = parseInt(selectedMonth);
        const year = parseInt(selectedYear);
        const newPeriodDate = new Date(year, month, 1);

        // B) Month-Year uniqueness
        // ⚠️ SAFE GUARD: Exclude current period when editing (check only other periods)
        const exists = periods.some(p => 
            p.month === month && 
            p.year === year && 
            p.id !== editingId  // Exclude the period being edited
        );
        if (exists) {
            errors.period = `${format(newPeriodDate, "MMM-yyyy")} already exists.`;
        }

        // C) Date must match month-year
        if (startDate && (getMonth(startDate) !== month || getYear(startDate) !== year || startDate.getDate() !== 1)) {
            errors.startDate = "Start Date must be the first day of the selected period.";
        }
        if (endDate && (getMonth(endDate) !== month || getYear(endDate) !== year)) {
            errors.endDate = "End Date must be within the selected period.";
        }
        if (endDate && startDate && endDate < startDate) {
            errors.endDate = "End Date cannot be before Start Date.";
        }

        // D) No overlap (Simplified check since we enforce full months usually, but sticking to logic)
        // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
        const hasOverlap = periods.some(p => {
            const pStart = new Date(p.startDate);
            const pEnd = new Date(p.endDate);
            return startDate! <= pEnd && endDate! >= pStart && p.id !== editingId;
        });

        // If exact match caught by B, this handles partial overlaps if manual dates allowed modification (though here they are auto-calculated mainly)
        if (hasOverlap && !exists) {
            errors.period = "The selected date range overlaps with an existing pay period.";
        }

        // E) Sequential rule
        // Check if the previous month exists. 
        // Find previous month of the new period
        const prevMonthDate = subMonths(newPeriodDate, 1);
        const prevMonthExists = periods.some(p => p.month === prevMonthDate.getMonth() && p.year === prevMonthDate.getFullYear());

        // Exception: If no periods exist at all, allow any start (or maybe enforce starting current/next?) 
        // Usually systems allow starting fresh. Let's assume if there are periods, we check sequence.
        if (periods.length > 0 && !prevMonthExists) {
            // Double check if we are creating a past period that fills a gap? 
            // User requirement: "If user creates a future month, ensure previous month exists"
            // This implies no gaps forward.

            // Find the latest period in the list
            const sortedPeriods = [...periods].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
            const latestPeriod = sortedPeriods[0];
            const latestPeriodDate = new Date(latestPeriod.year, latestPeriod.month, 1);

            if (isAfter(newPeriodDate, addMonths(latestPeriodDate, 1))) {
                errors.period = `Cannot create ${format(newPeriodDate, "MMM-yyyy")} because ${format(addMonths(latestPeriodDate, 1), "MMM-yyyy")} is missing.`;
            }
        }

        // F) Future restriction (simple rule): Can create only up to next month
        const nextMonth = addMonths(today, 1);
        const maxAllowedDate = endOfMonth(nextMonth);

        // Allow current month and next month. Block anything after next month.
        // Actually "Can create only up to next month" often means "Current + 1". 
        // Example: Today Feb. Allow Feb & Mar. Block Apr.
        if (isAfter(newPeriodDate, maxAllowedDate)) {
            errors.period = "Cannot create pay periods further than next month.";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateSubmit = () => {
        if (validateForm()) {
            const month = parseInt(selectedMonth);
            const year = parseInt(selectedYear);
            const periodName = format(new Date(year, month, 1), "MMM-yyyy");

            if (editingId) {
                // Update existing
                setPeriods(prev => prev.map(p => p.id === editingId ? {
                    ...p,
                    periodName,
                    month,
                    year,
                    startDate: format(startDate!, "yyyy-MM-dd"),
                    endDate: format(endDate!, "yyyy-MM-dd"),
                    status: selectedStatus,
                    notes: notes
                } : p));

                toast({
                    title: "Success",
                    description: "Pay Period updated successfully.",
                    className: "bg-green-50 border-green-200 text-green-900",
                });
            } else {
                // Create new
                const newPeriod: PayPeriod = {
                    id: Math.random().toString(36).substr(2, 9),
                    periodName,
                    month,
                    year,
                    startDate: format(startDate!, "yyyy-MM-dd"),
                    endDate: format(endDate!, "yyyy-MM-dd"),
                    status: selectedStatus,
                    notes: notes
                };

                setPeriods(prev => [newPeriod, ...prev].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));

                toast({
                    title: "Success",
                    description: "Pay Period created successfully.",
                    className: "bg-green-50 border-green-200 text-green-900",
                });
            }

            setIsCreateOpen(false);
            resetForm();
        }
    };

    // ============================================================================
    // ⚠️ BUSINESS RULE: Edit is ALWAYS allowed regardless of status
    // ============================================================================
    // HR can edit any pay period (Open, Locked, Processed, or Paid)
    // This provides flexibility to correct mistakes even after locking
    // ============================================================================
    const handleEdit = (period: PayPeriod) => {
        setEditingId(period.id);
        setSelectedMonth(period.month.toString());
        setSelectedYear(period.year.toString());
        setStartDate(parse(period.startDate, 'yyyy-MM-dd', new Date()));
        setEndDate(parse(period.endDate, 'yyyy-MM-dd', new Date()));
        setSelectedStatus(period.status);
        setNotes(period.notes || "");
        setOriginalPeriod(period); // ⚠️ Store original period for status-only change detection
        setIsCreateOpen(true);
    };

    const handleLock = (period: PayPeriod) => {
        // Lock rule: Allow locking if Open
        updatePeriodStatus(period.id, "Locked");
        toast({
            title: "Period Locked",
            description: `${period.periodName} has been locked.`,
        });
    };

    const handleReopen = (period: PayPeriod) => {
        // H) Re-open rule (admin only) - Assuming current user is admin for now as per "HR Manager/Admin only" access context
        if (period.status !== "Locked") return;

        updatePeriodStatus(period.id, "Open");
        toast({
            title: "Period Re-opened",
            description: `${period.periodName} is now Open.`,
        });
    };

    const handleDelete = () => {
        if (!editingId) return;

        const periodToDelete = periods.find(p => p.id === editingId);
        
        // ============================================================================
        // ⚠️ BUSINESS RULE CHANGE: Allow deletion for ALL statuses
        // ============================================================================
        // PREVIOUS RULE: Could not delete Locked/Processed/Paid periods
        // NEW RULE: Can delete any period regardless of status
        // REASON: HR needs flexibility to correct mistakes even after locking
        // ============================================================================
        
        // Delete the period (no status check)
        setPeriods(prev => prev.filter(p => p.id !== editingId));
        
        toast({
            title: "Period Deleted",
            description: "Pay period has been successfully deleted.",
        });

        // Close dialogs and reset form
        setIsDeleteOpen(false);
        setIsCreateOpen(false);
        resetForm();
    };

    const updatePeriodStatus = (id: string, status: PayPeriod["status"]) => {
        setPeriods(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    };

    // --- Render Helpers ---

    // Pagination Logic
    const filteredPeriods = periods.filter(p => {
        const matchStatus = statusFilter === "All" || p.status === statusFilter;
        const matchSearch = p.periodName.toLowerCase().includes(searchQuery.toLowerCase());
        return matchStatus && matchSearch;
    });

    const totalPages = Math.ceil(filteredPeriods.length / itemsPerPage);
    const paginatedPeriods = filteredPeriods.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const months = [
        { value: "0", label: "January" },
        { value: "1", label: "February" },
        { value: "2", label: "March" },
        { value: "3", label: "April" },
        { value: "4", label: "May" },
        { value: "5", label: "June" },
        { value: "6", label: "July" },
        { value: "7", label: "August" },
        { value: "8", label: "September" },
        { value: "9", label: "October" },
        { value: "10", label: "November" },
        { value: "11", label: "December" },
    ];

    return (
        <div className="space-y-6">
            {/* Top Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Pay Periods</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage monthly pay periods and payroll processing status.</p>
            </div>

            {/* Actions Row */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 w-full sm:w-auto ml-0 sm:ml-4">
                    <div className="relative w-full sm:w-72 flex items-center h-10 border border-zinc-400 rounded-md bg-background focus-within:ring-1 focus-within:ring-ring focus-within:ring-inset">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search period (e.g. Feb-2026)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 border-none shadow-none focus-visible:ring-0 bg-transparent h-full w-full"
                        />
                    </div>
                    <Popover open={openStatusDropdown} onOpenChange={setOpenStatusDropdown}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openStatusDropdown}
                                className="w-[200px] justify-between h-10 font-normal border-input"
                            >
                                <span className={cn(statusFilter === "All" && "text-muted-foreground")}>
                                    {statusFilter === "All" ? "All Status" : statusFilter}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0" align="start">
                            <Command>
                                <CommandInputBorderless placeholder="Search status..." className="h-9" />
                                <CommandList className="max-h-[250px] overflow-y-auto">
                                    <CommandEmpty>No status found.</CommandEmpty>
                                    <CommandGroup>
                                        {["All", "Open", "Locked", "Processed", "Paid"].map((status) => (
                                            <CommandItem
                                                key={status}
                                                value={status}
                                                onSelect={(currentValue) => {
                                                    setStatusFilter(currentValue === "all" ? "All" : currentValue.charAt(0).toUpperCase() + currentValue.slice(1));
                                                    setOpenStatusDropdown(false);
                                                }}
                                                className="cursor-pointer"
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        statusFilter === status ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {status === "All" ? "All Status" : status}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
                <Button onClick={() => {
                    resetForm(); // ⚠️ Reset form before opening in create mode
                    setIsCreateOpen(true);
                }}>
                    <Plus className="mr-2 h-4 w-4" /> Create Pay Period
                </Button>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Period</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>End Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedPeriods.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                    No pay periods found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedPeriods.map((period) => (
                                <TableRow key={period.id}>
                                    <TableCell className="font-medium">{period.periodName}</TableCell>
                                    <TableCell>{format(parse(period.startDate, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy')}</TableCell>
                                    <TableCell>{format(parse(period.endDate, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy')}</TableCell>
                                    <TableCell>
                                        <Badge variant={
                                            period.status === 'Open' ? 'outline' :
                                                period.status === 'Locked' ? 'secondary' :
                                                    period.status === 'Processed' ? 'default' : 'secondary'
                                        } className={cn(
                                            period.status === 'Open' && "bg-blue-50 text-blue-700 border-blue-200",
                                            period.status === 'Locked' && "bg-amber-50 text-amber-700 border-amber-200",
                                            period.status === 'Processed' && "bg-purple-50 text-purple-700 border-purple-200",
                                            period.status === 'Paid' && "bg-green-50 text-green-700 border-green-200"
                                        )}>
                                            {period.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(period)}
                                                title="Edit Period"
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
            <div className="flex justify-between items-center px-1 py-4">
                <div className="text-sm text-muted-foreground">
                    Showing {filteredPeriods.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPeriods.length)} of {filteredPeriods.length} entries
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>


            {/* Create Modal */}
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
                if (!open) resetForm();
                setIsCreateOpen(open);
            }}>
                <DialogContent className="sm:max-w-[600px] p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-xl">
                            {editingId ? "Edit Pay Period" : "Create Pay Period"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingId 
                                ? "Update the pay period information. Dates are automatically generated based on selection."
                                : "Define a new monthly pay period. Dates are automatically generated based on selection."
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-2">
                        {/* Global Error Message */}
                        {formErrors.period && (
                            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-destructive" />
                                {formErrors.period}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Period Month <span className="text-destructive">*</span></Label>
                                <Popover open={isMonthOpen} onOpenChange={setIsMonthOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal h-10",
                                                !selectedMonth && "text-muted-foreground",
                                                formErrors.month && "border-destructive hover:bg-destructive/5"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedMonth ? months.find(m => m.value === selectedMonth)?.label : "Select Month"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-4" align="start">
                                        <div className="grid grid-cols-4 gap-3">
                                            {months.map((m) => (
                                                <Button
                                                    key={m.value}
                                                    variant="ghost"
                                                    className={cn(
                                                        "h-9 w-full text-sm hover:bg-primary/10 hover:text-primary",
                                                        selectedMonth === m.value
                                                            ? "bg-primary/15 text-primary font-semibold"
                                                            : "text-muted-foreground"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedMonth(m.value);
                                                        handlePeriodChange(m.value, selectedYear);
                                                        setIsMonthOpen(false);
                                                    }}
                                                >
                                                    {m.label.substring(0, 3)}
                                                </Button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                {formErrors.month && <p className="text-[11px] font-medium text-destructive mt-1">{formErrors.month}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Period Year <span className="text-destructive">*</span></Label>
                                <Popover open={isYearOpen} onOpenChange={setIsYearOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal h-10",
                                                !selectedYear && "text-muted-foreground",
                                                formErrors.year && "border-destructive hover:bg-destructive/5"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedYear ? selectedYear : "Select Year"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[280px] p-4" align="start">
                                        <div className="flex items-center justify-between mb-4 px-1">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => setYearNavStart(prev => prev - 12)}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <div className="font-semibold text-sm">
                                                {yearNavStart} - {yearNavStart + 11}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => setYearNavStart(prev => prev + 12)}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-4 gap-3">
                                            {Array.from({ length: 12 }, (_, i) => yearNavStart + i).map((y) => (
                                                <Button
                                                    key={y}
                                                    variant="ghost"
                                                    className={cn(
                                                        "h-9 w-full text-sm hover:bg-primary/10 hover:text-primary",
                                                        selectedYear === y.toString()
                                                            ? "bg-primary/15 text-primary font-semibold"
                                                            : "text-muted-foreground",
                                                        y === new Date().getFullYear() && !selectedYear && "text-primary font-medium"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedYear(y.toString());
                                                        handlePeriodChange(selectedMonth, y.toString());
                                                        setIsYearOpen(false);
                                                    }}
                                                >
                                                    {y}
                                                </Button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                {formErrors.year && <p className="text-[11px] font-medium text-destructive mt-1">{formErrors.year}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Start Date <span className="text-destructive">*</span></Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal h-10",
                                                !startDate && "text-muted-foreground",
                                                formErrors.startDate && "border-destructive hover:bg-destructive/5"
                                            )}
                                            disabled // Keep distinct style even if disabled
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={startDate}
                                            onSelect={setStartDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
                                    <span className="inline-block w-1 h-1 rounded-full bg-blue-500"></span>
                                    Auto-calculated from Month Start
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium">End Date <span className="text-destructive">*</span></Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal h-10",
                                                !endDate && "text-muted-foreground",
                                                formErrors.endDate && "border-destructive hover:bg-destructive/5"
                                            )}
                                            disabled
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={endDate}
                                            onSelect={setEndDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
                                    <span className="inline-block w-1 h-1 rounded-full bg-blue-500"></span>
                                    Auto-calculated from Month End
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Status</Label>
                                <Select
                                    value={selectedStatus}
                                    onValueChange={(val: PayPeriod["status"]) => setSelectedStatus(val)}
                                >
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* ⚠️ BUSINESS RULE: All statuses always available */}
                                        {/* HR can change to any status regardless of current status */}
                                        <SelectItem value="Open">Open</SelectItem>
                                        <SelectItem value="Locked">Locked</SelectItem>
                                        <SelectItem value="Processed">Processed</SelectItem>
                                        <SelectItem value="Paid">Paid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Additional Notes</Label>
                                <Input
                                    className="h-10"
                                    placeholder="Optional remarks"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-4 flex justify-between">
                        {editingId && (
                            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="mr-auto">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the pay period record.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        
                        <div className="flex gap-2 ml-auto">
                            <Button variant="outline" className="h-10 px-6" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button
                                className="h-10 px-6"
                                onClick={handleCreateSubmit}
                                disabled={!selectedMonth || !selectedYear || !startDate || !endDate}
                            >
                                {editingId ? "Update Period" : "Create Period"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
