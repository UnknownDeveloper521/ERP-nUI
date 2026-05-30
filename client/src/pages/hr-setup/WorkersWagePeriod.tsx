import React, { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { format, addMonths, subMonths, isSameMonth, isValid, parse, getYear, getMonth, setMonth, setYear, startOfMonth, endOfMonth, isBefore, isAfter } from "date-fns";
import { Calendar as CalendarIcon, Plus, Search, Edit, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
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
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { Eye, Pencil } from "lucide-react";
import { WorkersWagePeriod, mockWagePeriods } from "@/lib/workerPayrollSharedData";
import { commonApi, workersWagePeriodApi } from "@/lib/api";

/** Green styling for successful create / update / delete; use `variant: "destructive"` for validation & errors. */
const crudSuccessToast = {
    className:
        "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
};

const savePrimaryDisabledClass =
    "disabled:bg-muted disabled:text-muted-foreground disabled:border-border disabled:opacity-100 disabled:shadow-none disabled:hover:bg-muted";

export default function WorkersWagePeriodPage() {
    const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
    const permissionModule = "HR_Setup:Workers wage Period";

    if (!isMenuVisible(permissionModule)) {
        return <Unauthorized />;
    }

    const { toast } = useToast();
    type WagePeriodStatusOption = { id: number; name: string };

    // State
    const [periods, setPeriods] = useState<WorkersWagePeriod[]>([]);
    const [wagePeriodStatuses, setWagePeriodStatuses] = useState<WagePeriodStatusOption[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [statusFilter, setStatusFilter] = useState("All");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isMonthOpen, setIsMonthOpen] = useState(false);
    const [isYearOpen, setIsYearOpen] = useState(false);
    const [yearNavStart, setYearNavStart] = useState(new Date().getFullYear() - 1);
    const [currentPage, setCurrentPage] = useState(1);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [isListLoading, setIsListLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [selectedYear, setSelectedYear] = useState<string>("");
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [selectedStatus, setSelectedStatus] = useState<WorkersWagePeriod["status"]>("Draft");
    const [notes, setNotes] = useState("");
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

    const [originalPeriod, setOriginalPeriod] = useState<WorkersWagePeriod | null>(null);

    const normalizeText = (value: unknown) =>
        String(value ?? "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");

    const normalizeStatusName = (raw: string): any => {
        const value = normalizeText(raw);
        if (value === "draft") return "Draft";
        if (value === "draft") return "Draft";
        if (value === "active") return "Active";
        if (value === "open") return "Open";
        if (value === "locked") return "Locked";
        if (value === "processed") return "Processed";
        if (value === "paid") return "Paid";
        return "Open";
    };

    const resolveStatusId = (statusName: WorkersWagePeriod["status"]) =>
        wagePeriodStatuses.find((s) => normalizeText(s.name) === normalizeText(statusName))?.id;
    const isReadOnlyStatus = (status?: WorkersWagePeriod["status"]) =>
        status === "Paid";

    const fetchWagePeriodStatuses = async () => {
        try {
            const res = await commonApi.getPayPeriodStatuses(1);
            if (res?.isSuccessful) {
                const records = Array.isArray(res?.data?.records) ? res.data.records : [];
                setWagePeriodStatuses(records.map((s: any) => ({
                    id: Number(s.id),
                    name: String(s.name || "").trim(),
                })));
            }
        } catch (error: any) {
            console.error("Error fetching wage period statuses:", error);
        }
    };

    const fetchWagePeriods = async () => {
        setIsListLoading(true);
        try {
            const selectedStatusId =
                statusFilter === "All"
                    ? undefined
                    : resolveStatusId(statusFilter as WorkersWagePeriod["status"]);

            const res = await workersWagePeriodApi.getList({
                page: currentPage,
                limit: itemsPerPage,
                search_text: debouncedSearchQuery || undefined,
                status_id: selectedStatusId,
            });

            if (res?.isSuccessful) {
                const records = Array.isArray(res?.data?.records) ? res.data.records : [];
                const mapped: WorkersWagePeriod[] = records.map((row: any) => {
                    const monthIndex = Math.max(0, Number(row.period_month) - 1);
                    const year = Number(row.period_year);
                    const start = parse(String(row.start_date), "yyyy-MM-dd", new Date());
                    const end = parse(String(row.end_date), "yyyy-MM-dd", new Date());
                    return {
                        id: String(row.id),
                        periodName: `${row.period || format(new Date(year, monthIndex, 1), "MMM-yyyy")} (${format(start, "dd")}-${format(end, "dd")})`,
                        month: monthIndex,
                        year,
                        startDate: String(row.start_date),
                        endDate: String(row.end_date),
                        status: normalizeStatusName(String(row.status_name || "")),
                        notes: row.additional_notes || "",
                    };
                });
                setPeriods(mapped);
                setTotalItems(Number(res?.data?.pagination?.totalCount || mapped.length));
            }
        } catch (error: any) {
            console.error("Error fetching workers wage periods:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to fetch workers wage periods",
            });
        } finally {
            setIsListLoading(false);
        }
    };

    useEffect(() => {
        fetchWagePeriodStatuses();
    }, []);

    useEffect(() => {
        fetchWagePeriods();
    }, [currentPage, itemsPerPage, debouncedSearchQuery, statusFilter, wagePeriodStatuses.length]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery, statusFilter]);

    // Derived Values
    const getPeriodName = (month: number, year: number, start: Date, end: Date) => {
        const monthYear = format(new Date(year, month, 1), "MMM-yyyy");
        return `${monthYear} (${format(start, "dd")}-${format(end, "dd")})`;
    };

    // --- Handlers ---

    /** Move a date to the given calendar month/year, keeping the day when valid (e.g. 31 → last day of Feb). */
    const alignDateToPeriodMonthYear = (d: Date, month0: number, y: number): Date => {
        const cap = endOfMonth(new Date(y, month0, 1)).getDate();
        const day = Math.min(d.getDate(), cap);
        return new Date(y, month0, day);
    };

    const handlePeriodChange = (monthStr: string, yearStr: string) => {
        const month = parseInt(monthStr, 10);
        const year = parseInt(yearStr, 10);

        if (!isNaN(month) && !isNaN(year)) {
            if (startDate && endDate) {
                let nextStart = alignDateToPeriodMonthYear(startDate, month, year);
                let nextEnd = alignDateToPeriodMonthYear(endDate, month, year);
                if (nextEnd < nextStart) {
                    const sevenDaysLater = new Date(nextStart);
                    sevenDaysLater.setDate(nextStart.getDate() + 6);
                    const monthEnd = endOfMonth(new Date(year, month, 1));
                    nextEnd = sevenDaysLater > monthEnd ? monthEnd : sevenDaysLater;
                }
                setStartDate(nextStart);
                setEndDate(nextEnd);
            } else {
                if (!startDate) {
                    setStartDate(startOfMonth(new Date(year, month)));
                }
                if (!endDate) {
                    const start = startDate || startOfMonth(new Date(year, month));
                    const sevenDaysLater = new Date(start);
                    sevenDaysLater.setDate(start.getDate() + 6);
                    const monthEnd = endOfMonth(new Date(year, month));
                    setEndDate(sevenDaysLater > monthEnd ? monthEnd : sevenDaysLater);
                }
            }

            setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.month;
                delete newErrors.year;
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

        const isStatusOnlyChange = editingId && originalPeriod &&
            selectedMonth === originalPeriod.month.toString() &&
            selectedYear === originalPeriod.year.toString() &&
            startDate && format(startDate, 'yyyy-MM-dd') === originalPeriod.startDate &&
            endDate && format(endDate, 'yyyy-MM-dd') === originalPeriod.endDate;

        if (isStatusOnlyChange) {
            if (!selectedStatus) {
                errors.status = "Status is required";
                setFormErrors(errors);
                return false;
            }
            setFormErrors({});
            return true;
        }

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

        if (endDate && startDate && endDate < startDate) {
            errors.endDate = "End Date cannot be before Start Date.";
        }

        // Overlap logic
        const hasOverlap = periods.some(p => {
            const pStart = new Date(p.startDate);
            const pEnd = new Date(p.endDate);
            return startDate! <= pEnd && endDate! >= pStart && p.id !== editingId;
        });

        if (hasOverlap) {
            errors.period = "The selected date range overlaps with an existing wage period.";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateSubmit = async () => {
        if (validateForm()) {
            const month = parseInt(selectedMonth);
            const year = parseInt(selectedYear);
            const periodName = getPeriodName(month, year, startDate!, endDate!);
            const statusId = resolveStatusId(selectedStatus);
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
                        description: `${originalPeriod?.status} workers wage period cannot be updated.`,
                    });
                    setIsSubmitting(false);
                    return;
                }
                try {
                    const res = await workersWagePeriodApi.update(Number(editingId), {
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
                            description: res?.message || "Failed to update workers wage period.",
                        });
                        return;
                    }

                    toast({
                        ...crudSuccessToast,
                        title: "Success",
                        description: res?.message || "Workers Wage Period updated successfully.",
                    });

                    await fetchWagePeriods();
                } catch (error: any) {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: error.message || "Failed to update workers wage period.",
                    });
                    return;
                }
            } else {
                try {
                    const res = await workersWagePeriodApi.create({
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
                            description: res?.message || "Failed to create workers wage period.",
                        });
                        return;
                    }

                    toast({
                        ...crudSuccessToast,
                        title: "Success",
                        description: res?.message || "Workers Wage Period created successfully.",
                    });

                    await fetchWagePeriods();
                } catch (error: any) {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: error.message || "Failed to create workers wage period.",
                    });
                    return;
                }
            }

            setIsCreateOpen(false);
            resetForm();
            setIsSubmitting(false);
        }
    };

    const handleEdit = (period: WorkersWagePeriod) => {
        setEditingId(period.id);
        setSelectedMonth(period.month.toString());
        setSelectedYear(period.year.toString());
        setStartDate(parse(period.startDate, 'yyyy-MM-dd', new Date()));
        setEndDate(parse(period.endDate, 'yyyy-MM-dd', new Date()));
        setSelectedStatus(period.status);
        setNotes(period.notes || "");
        setOriginalPeriod(period);
        setIsCreateOpen(true);
    };

    const handleDelete = () => {
        if (!editingId) return;
        if (isReadOnlyStatus(originalPeriod?.status)) {
            toast({
                variant: "destructive",
                title: "Error",
                description: `${originalPeriod?.status} workers wage period cannot be deleted.`,
            });
            return;
        }
        const deleteAction = async () => {
            setIsSubmitting(true);
            try {
                const res = await workersWagePeriodApi.delete(Number(editingId));
                if (!res?.isSuccessful) {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: res?.message || "Failed to delete workers wage period.",
                    });
                    return;
                }

                toast({
                    ...crudSuccessToast,
                    title: "Period Deleted",
                    description: res?.message || "Workers Wage Period has been successfully deleted.",
                });

                await fetchWagePeriods();
                setIsDeleteOpen(false);
                setIsCreateOpen(false);
                resetForm();
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to delete workers wage period.",
                });
            } finally {
                setIsSubmitting(false);
            }
        };
        deleteAction();
    };

    // Pagination Logic
    const filteredPeriods = periods.filter(p => {
        const matchStatus = statusFilter === "All" || p.status === statusFilter;
        const matchSearch = p.periodName.toLowerCase().includes(searchQuery.toLowerCase());
        return matchStatus && matchSearch;
    });

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

    // Period year: years before (current year − 4) are disabled; current, past 4 years, and future years are allowed.
    // When editing, the existing record's year stays selectable even if older than that cutoff.
    const calendarYearNow = new Date().getFullYear();
    const wageSelectableYearMin = calendarYearNow - 4;
    const isWagePeriodYearSelectable = (y: number) => {
        if (editingId && selectedYear && y === parseInt(selectedYear, 10)) {
            return true;
        }
        return y >= wageSelectableYearMin;
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Workers Wage Periods</h1>
                <p className="text-muted-foreground text-sm">Manage weekly wage periods for factory workers.</p>
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
                        label: "Status Filter",
                        value: statusFilter,
                        onChange: setStatusFilter,
                        options: [
                            { label: "All Status", value: "All" },
                            ...wagePeriodStatuses.map((s) => ({ label: s.name, value: s.name }))
                        ],
                        searchable: true
                    }
                ]}
                actions={[
                    ...(canCreate(permissionModule) ? [{
                        label: "Create Wage Period",
                        icon: <Plus className="mr-2 h-4 w-4" />,
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
                                            No wage periods found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedPeriods.map((period) => (
                                        <TableRow key={period.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium text-sm">{period.periodName}</TableCell>
                                            <TableCell className="text-sm">{format(parse(period.startDate, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="text-sm">{format(parse(period.endDate, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy')}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    (period.status as string) === 'Active' ? 'outline' :
                                                        (period.status as string) === 'Draft' ? 'outline' :
                                                        (period.status as string) === 'Open' ? 'outline' :
                                                        (period.status as string) === 'Locked' ? 'secondary' :
                                                            (period.status as string) === 'Processed' ? 'default' : 'secondary'
                                                } className={cn(
                                                    "text-xs",
                                                    (period.status as string) === 'Active' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                                    (period.status as string) === 'Draft' && "bg-slate-100 text-slate-700 border-slate-200",
                                                    (period.status as string) === 'Open' && "bg-blue-50 text-blue-700 border-blue-200",
                                                    period.status === 'Locked' && "bg-amber-50 text-amber-700 border-amber-200",
                                                    period.status === 'Processed' && "bg-purple-50 text-purple-700 border-purple-200",
                                                    period.status === 'Paid' && "bg-green-50 text-green-700 border-green-200"
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

            <Dialog open={isCreateOpen} onOpenChange={(open) => {
                if (!open) resetForm();
                setIsCreateOpen(open);
            }}>
                <DialogContent className="w-[92%] sm:max-w-2xl md:max-w-3xl max-h-[80vh] overflow-hidden p-0 flex flex-col gap-0">
                    <div className="shrink-0 border-b bg-white p-5 sm:p-6">
                    <DialogHeader className="p-0">
                        <DialogTitle className="text-xl">
                            {editingId ? "Edit Wage Period" : "Create Workers Wage Period"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingId
                                ? "Update the weekly wage period information."
                                : "Define a new weekly wage period for factory workers."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5">
                        {editingId && isReadOnlyStatus(originalPeriod?.status) && (
                            <div className="p-3 rounded-md bg-amber-50 text-amber-800 text-sm">
                                {originalPeriod?.status} workers wage period is finalized and cannot be edited.
                            </div>
                        )}
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
                                                const selectable = isWagePeriodYearSelectable(y);
                                                return (
                                                <Button
                                                    key={y}
                                                    variant="ghost"
                                                    disabled={!selectable}
                                                    className={cn(
                                                        "h-9 w-full text-sm",
                                                        selectable && "hover:bg-primary/10 hover:text-primary",
                                                        selectedYear === y.toString()
                                                            ? "bg-primary/15 text-primary font-semibold"
                                                            : "text-muted-foreground",
                                                        selectable &&
                                                            y === new Date().getFullYear() &&
                                                            !selectedYear &&
                                                            "text-primary font-medium",
                                                        !selectable && "opacity-40 cursor-not-allowed"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedYear(y.toString());
                                                        handlePeriodChange(selectedMonth, y.toString());
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
                                            disabled={!!editingId && isReadOnlyStatus(originalPeriod?.status)}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={startDate}
                                            month={startDate}
                                            defaultMonth={startDate}
                                            onSelect={(date) => {
                                                if (date) {
                                                    setStartDate(date);
                                                }
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                {formErrors.startDate && <p className="text-[11px] font-medium text-destructive mt-1">{formErrors.startDate}</p>}
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
                                            disabled={!!editingId && isReadOnlyStatus(originalPeriod?.status)}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={endDate}
                                            month={endDate}
                                            defaultMonth={endDate}
                                            onSelect={(date) => {
                                                if (date) {
                                                    setEndDate(date);
                                                }
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                {formErrors.endDate && <p className="text-[11px] font-medium text-destructive mt-1">{formErrors.endDate}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Status</Label>
                                <Select
                                    value={selectedStatus}
                                    onValueChange={(val: WorkersWagePeriod["status"]) => setSelectedStatus(val)}
                                    disabled={!!editingId && isReadOnlyStatus(originalPeriod?.status)}
                                >
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {wagePeriodStatuses.map((status) => (
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
                                                This action cannot be undone. This will permanently delete the workers wage period record.
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
                                        isSubmitting ||
                                        (!!editingId && isReadOnlyStatus(originalPeriod?.status))
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
