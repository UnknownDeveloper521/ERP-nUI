import React, { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { format, getYear, getMonth, startOfMonth, endOfMonth } from "date-fns";
import { Calendar as CalendarIcon, Plus, Search, Edit, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { Eye, Pencil } from "lucide-react";
import { PayPeriod } from "@/lib/payrollSharedData";
import { commonApi, payPeriodApi } from "@/lib/api";

// Shared types and mock data are imported from @/lib/payrollSharedData

/** Green styling for successful create / update / delete; use `variant: "destructive"` for validation & errors. */
const crudSuccessToast = {
    className:
        "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
};

const savePrimaryDisabledClass =
    "disabled:bg-muted disabled:text-muted-foreground disabled:border-border disabled:opacity-100 disabled:shadow-none disabled:hover:bg-muted";

export default function PayPeriodPage() {
    const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
    const permissionModule = "HR_Setup:Pay Period";

    if (!isMenuVisible(permissionModule)) {
        return <Unauthorized />;
    }

    const { toast } = useToast();
    type PayPeriodStatusOption = { id: number; name: string };

    // State
    const [periods, setPeriods] = useState<PayPeriod[]>([]);
    const [payPeriodStatuses, setPayPeriodStatuses] = useState<PayPeriodStatusOption[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [statusFilter, setStatusFilter] = useState("All");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isMonthOpen, setIsMonthOpen] = useState(false);
    const [isYearOpen, setIsYearOpen] = useState(false);
    const [yearNavStart, setYearNavStart] = useState(new Date().getFullYear() - 1); // Start view around current year
    const [currentPage, setCurrentPage] = useState(1);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [isListLoading, setIsListLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New Period Form State
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [selectedYear, setSelectedYear] = useState<string>("");
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [selectedStatus, setSelectedStatus] = useState<PayPeriod["status"]>("Draft");
    const [notes, setNotes] = useState("");
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

    // ⚠️ NEW: Track original period when editing (to detect status-only changes)
    const [originalPeriod, setOriginalPeriod] = useState<PayPeriod | null>(null);

    const normalizeStatusName = (raw: string): PayPeriod["status"] => {
        // Return status exactly as received from API
        return (raw || "Open") as PayPeriod["status"];
    };

    const isReadOnlyStatus = (status?: PayPeriod["status"]) =>
        status === "Paid";
    const fetchPayPeriodStatuses = async () => {
        try {
            const res = await commonApi.getPayPeriodStatuses(1);
            if (res?.isSuccessful) {
                const records = Array.isArray(res?.data?.records) ? res.data.records : [];
                setPayPeriodStatuses(records.map((s: any) => ({
                    id: Number(s.id),
                    name: String(s.name || ""),
                })));
            }
        } catch (error: any) {
            console.error("Error fetching pay period statuses:", error);
        }
    };

    const fetchPayPeriods = async () => {
        setIsListLoading(true);
        try {
            const selectedStatusId =
                statusFilter === "All"
                    ? undefined
                    : payPeriodStatuses.find((s) => s.name === statusFilter)?.id;

            const res = await payPeriodApi.getList({
                page: currentPage,
                limit: itemsPerPage,
                search_text: debouncedSearchQuery || undefined,
                status_id: selectedStatusId,
            });

            if (res?.isSuccessful) {
                const records = Array.isArray(res?.data?.records) ? res.data.records : [];
                const mapped: PayPeriod[] = records.map((row: any) => {
                    const monthIndex = Math.max(0, Number(row.period_month) - 1);
                    const year = Number(row.period_year);
                    return {
                        id: String(row.id),
                        periodName: row.period || format(new Date(year, monthIndex, 1), "MMM-yyyy"),
                        month: monthIndex,
                        year,
                        startDate: String(row.start_date),
                        endDate: String(row.end_date),
                        status: normalizeStatusName(String(row.status_name || "")),
                        notes: row.additional_notes || "",
                    };
                });
                setPeriods(mapped);
                setTotalItems(Number(res?.data?.pagination?.totalCount || 0));
            }
        } catch (error: any) {
            console.error("Error fetching pay periods:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to fetch pay periods",
            });
        } finally {
            setIsListLoading(false);
        }
    };

    useEffect(() => {
        fetchPayPeriodStatuses();
    }, []);

    useEffect(() => {
        fetchPayPeriods();
    }, [currentPage, itemsPerPage, debouncedSearchQuery, statusFilter, payPeriodStatuses.length]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery, statusFilter]);

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
        setSelectedStatus("Draft");
        setNotes("");
        setFormErrors({});
        setEditingId(null);
        setOriginalPeriod(null); 
    };

    const validateForm = (): boolean => {
        const errors: { [key: string]: string } = {};

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

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateSubmit = async () => {
        if (validateForm()) {
            const month = parseInt(selectedMonth);
            const year = parseInt(selectedYear);
            const periodName = format(new Date(year, month, 1), "MMM-yyyy");
            const statusId = payPeriodStatuses.find((s) => s.name === selectedStatus)?.id;
            if (!statusId) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: "Please select a valid status.",
                });
                return;
            }

            setIsSubmitting(true);
            if (editingId) {
                if (isReadOnlyStatus(originalPeriod?.status)) {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: `${originalPeriod?.status} pay period cannot be updated.`,
                    });
                    setIsSubmitting(false);
                    return;
                }
                try {
                    const res = await payPeriodApi.update(Number(editingId), {
                        period_month: month + 1,
                        period_year: year,
                        start_date: format(startDate!, "yyyy-MM-dd"),
                        end_date: format(endDate!, "yyyy-MM-dd"),
                        status_id: statusId,
                        additional_notes: notes || "",
                    });

                    if (!res?.isSuccessful) {
                        toast({
                            variant: "destructive",
                            title: "Error",
                            description: res?.message || "Failed to update pay period.",
                        });
                        return;
                    }

                    toast({
                        ...crudSuccessToast,
                        title: "Success",
                        description: res?.message || "Pay Period updated successfully.",
                    });

                    await fetchPayPeriods();
                } catch (error: any) {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: error.message || "Failed to update pay period.",
                    });
                    return;
                }
            } else {
                try {
                    const res = await payPeriodApi.create({
                        period_month: month + 1,
                        period_year: year,
                        start_date: format(startDate!, "yyyy-MM-dd"),
                        end_date: format(endDate!, "yyyy-MM-dd"),
                        status_id: statusId,
                        additional_notes: notes || "",
                    });

                    if (!res?.isSuccessful) {
                        toast({
                            variant: "destructive",
                            title: "Error",
                            description: res?.message || "Failed to create pay period.",
                        });
                        return;
                    }

                    toast({
                        ...crudSuccessToast,
                        title: "Success",
                        description: res?.message || "Pay Period created successfully.",
                    });

                    await fetchPayPeriods();
                } catch (error: any) {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: error.message || "Failed to create pay period.",
                    });
                    return;
                }
            }

            setIsCreateOpen(false);
            resetForm();
            setIsSubmitting(false);
        }
    };

    const handleEdit = (period: PayPeriod) => {
        setEditingId(period.id);
        setSelectedMonth(period.month.toString());
        setSelectedYear(period.year.toString());
        setStartDate(new Date(period.startDate));
        setEndDate(new Date(period.endDate));
        setSelectedStatus(period.status);
        setNotes(period.notes || "");
        setOriginalPeriod(period); // ⚠️ Store original period for status-only change detection
        setIsCreateOpen(true);
    };

    const handleLock = (period: PayPeriod) => {
        // Lock rule: Allow locking if Open
        updatePeriodStatus(period.id, "Locked");
        toast({
            ...crudSuccessToast,
            title: "Period Locked",
            description: `${period.periodName} has been locked.`,
        });
    };

    const handleReopen = (period: PayPeriod) => {
        // H) Re-open rule (admin only) - Assuming current user is admin for now as per "HR Manager/Admin only" access context
        if (period.status !== "Locked") return;

        updatePeriodStatus(period.id, "Open");
        toast({
            ...crudSuccessToast,
            title: "Period Re-opened",
            description: `${period.periodName} is now Open.`,
        });
    };

    const handleDelete = () => {
        if (!editingId) return;
        if (isReadOnlyStatus(originalPeriod?.status)) {
            toast({
                variant: "destructive",
                title: "Error",
                description: `${originalPeriod?.status} pay period cannot be deleted.`,
            });
            return;
        }
        const deleteAction = async () => {
            setIsSubmitting(true);
            try {
                const res = await payPeriodApi.delete(Number(editingId));
                if (!res?.isSuccessful) {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: res?.message || "Failed to delete pay period.",
                    });
                    return;
                }

                toast({
                    ...crudSuccessToast,
                    title: "Period Deleted",
                    description: res?.message || "Pay period has been successfully deleted.",
                });

                await fetchPayPeriods();
                setIsDeleteOpen(false);
                setIsCreateOpen(false);
                resetForm();
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to delete pay period.",
                });
            } finally {
                setIsSubmitting(false);
            }
        };
        deleteAction();
    };

    const updatePeriodStatus = (id: string, status: PayPeriod["status"]) => {
        setPeriods(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    };

    // --- Render Helpers ---

    // Pagination Logic
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedPeriods = periods;

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
        <div className="h-full flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Pay Periods</h1>
                <p className="text-muted-foreground text-sm">Manage monthly pay periods and payroll processing status.</p>
            </div>

            <AppListToolbar
                search={{
                    placeholder: "Search period (e.g. Feb-2026)",
                    value: searchQuery,
                    onChange: setSearchQuery
                }}
                filters={[
                    {
                        type: "select",
                        label: "Status",
                        value: statusFilter,
                        onChange: setStatusFilter,
                        options: [
                            { label: "All Status", value: "All" },
                            ...payPeriodStatuses.map((s) => ({ label: s.name, value: s.name }))
                        ],
                        searchable: true
                    }
                ]}
                actions={[
                    ...(canCreate(permissionModule) ? [{
                        label: "Create Pay Period",
                        icon: <Plus className="h-4 w-4 mr-2" />,
                        onClick: () => {
                            resetForm();
                            setIsCreateOpen(true);
                        }
                    }] : [])
                ]}
            />

            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Period</TableHead>
                                    <TableHead>Start Date</TableHead>
                                    <TableHead>End Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isListLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm text-muted-foreground">Loading...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedPeriods.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                                            No pay periods found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedPeriods.map((period) => (
                                        <TableRow key={period.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium text-sm">{period.periodName}</TableCell>
                                            <TableCell className="text-sm">{format(new Date(period.startDate), 'dd-MM-yyyy')}</TableCell>
                                            <TableCell className="text-sm">{format(new Date(period.endDate), 'dd-MM-yyyy')}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    (period.status as any) === 'Active' ? 'outline' :
                                                        (period.status as any) === 'Draft' ? 'outline' :
                                                        (period.status as any) === 'Open' ? 'outline' :
                                                        (period.status as any) === 'Locked' ? 'secondary' :
                                                            (period.status as any) === 'Processed' ? 'default' : 'secondary'
                                                } className={cn(
                                                    "text-xs",
                                                    (period.status as any) === 'Active' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                                    (period.status as any) === 'Draft' && "bg-slate-100 text-slate-700 border-slate-200",
                                                    (period.status as any) === 'Open' && "bg-blue-50 text-blue-700 border-blue-200",
                                                    (period.status as any) === 'Locked' && "bg-amber-50 text-amber-700 border-amber-200",
                                                    (period.status as any) === 'Processed' && "bg-purple-50 text-purple-700 border-purple-200",
                                                    (period.status as any) === 'Paid' && "bg-green-50 text-green-700 border-green-200"
                                                )}>
                                                    {period.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <TableActionButtons
                                                    onEdit={canEdit(permissionModule) ? () => handleEdit(period) : undefined}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {!isListLoading && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                        />
                    )}
                </CardContent>
            </Card>


            {/* Create Modal */}
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
                if (!open) resetForm();
                setIsCreateOpen(open);
            }}>
                <DialogContent className="w-[92%] sm:max-w-2xl md:max-w-3xl max-h-[80vh] overflow-hidden p-0 flex flex-col gap-0">
                    <div className="shrink-0 border-b bg-white p-5 sm:p-6">
                    <DialogHeader className="p-0">
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
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
                        {editingId && isReadOnlyStatus(originalPeriod?.status) && (
                            <div className="p-3 rounded-md bg-amber-50 text-amber-800 text-sm">
                                {originalPeriod?.status} pay period is finalized and cannot be edited.
                            </div>
                        )}
                        {/* Global Error Message */}
                        {formErrors.period && (
                            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-destructive" />
                                {formErrors.period}
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                                            disabled={!!editingId && isReadOnlyStatus(originalPeriod?.status)}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedMonth ? months.find(m => m.value === selectedMonth)?.label : "Select Month"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-4" align="start">
                                        <div className="grid grid-cols-4 gap-3">
                                            {months.map((m) => {
                                                return (
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
                                                );
                                            })}
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
                                            disabled={!!editingId && isReadOnlyStatus(originalPeriod?.status)}
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
                                            {Array.from({ length: 12 }, (_, i) => yearNavStart + i).map((y) => {
                                                const yearStr = y.toString();
                                                const currentYear = new Date().getFullYear();

                                                return (
                                                    <Button
                                                        key={y}
                                                        variant="ghost"
                                                        className={cn(
                                                            "h-9 w-full text-sm hover:bg-primary/10 hover:text-primary",
                                                            selectedYear === yearStr
                                                                ? "bg-primary/15 text-primary font-semibold"
                                                                : "text-muted-foreground",
                                                            y === currentYear && !selectedYear && "text-primary font-medium"
                                                        )}
                                                        onClick={() => {
                                                            setSelectedYear(yearStr);
                                                            handlePeriodChange(selectedMonth, yearStr);
                                                            setIsYearOpen(false);
                                                        }}
                                                    >
                                                        {y}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                {formErrors.year && <p className="text-[11px] font-medium text-destructive mt-1">{formErrors.year}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Status</Label>
                                <Select
                                    value={selectedStatus}
                                    onValueChange={(val: PayPeriod["status"]) => setSelectedStatus(val)}
                                    disabled={!!editingId && isReadOnlyStatus(originalPeriod?.status)}
                                >
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {payPeriodStatuses.map((status) => (
                                            <SelectItem key={status.id} value={status.name}>
                                                {status.name}
                                            </SelectItem>
                                        ))}
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
                                    disabled={!!editingId && isReadOnlyStatus(originalPeriod?.status)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 border-t bg-white p-5 sm:p-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="mr-auto">
                            {editingId && canDelete(permissionModule) && (
                                <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive">
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
                                            <AlertDialogAction onClick={handleDelete} loading={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>

                        <div className="flex gap-2 sm:ml-auto">
                            <Button variant="outline" className="h-10 px-6" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            {((editingId && canEdit(permissionModule)) || (!editingId && canCreate(permissionModule))) && (
                                <Button
                                    className={cn("h-10 px-6", savePrimaryDisabledClass)}
                                    onClick={handleCreateSubmit}
                                    loading={isSubmitting}
                                    disabled={
                                        !selectedMonth ||
                                        !selectedYear ||
                                        !startDate ||
                                        !endDate ||
                                        isSubmitting
                                    }
                                >
                                    {editingId ? "Update Period" : "Create Period"}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
