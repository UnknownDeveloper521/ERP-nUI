import React, { useState } from "react";
import { format, addMonths, subMonths, isSameMonth, isValid, parse, getYear, getMonth, setMonth, setYear, startOfMonth, endOfMonth, isBefore, isAfter } from "date-fns";
import { Calendar as CalendarIcon, Plus, Search, Edit, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, ChevronsUpDown, Check } from "lucide-react";
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
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { Eye, Pencil } from "lucide-react";
import { WorkersWagePeriod, mockWagePeriods } from "@/lib/workerPayrollSharedData";


export default function WorkersWagePeriodPage() {
    const { toast } = useToast();

    // State
    const [periods, setPeriods] = useState<WorkersWagePeriod[]>(mockWagePeriods);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isMonthOpen, setIsMonthOpen] = useState(false);
    const [isYearOpen, setIsYearOpen] = useState(false);
    const [yearNavStart, setYearNavStart] = useState(new Date().getFullYear() - 1);
    const [currentPage, setCurrentPage] = useState(1);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Form State
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [selectedYear, setSelectedYear] = useState<string>("");
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [selectedStatus, setSelectedStatus] = useState<WorkersWagePeriod["status"]>("Open");
    const [notes, setNotes] = useState("");
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

    const [originalPeriod, setOriginalPeriod] = useState<WorkersWagePeriod | null>(null);

    // Derived Values
    const getPeriodName = (month: number, year: number, start: Date, end: Date) => {
        const monthYear = format(new Date(year, month, 1), "MMM-yyyy");
        return `${monthYear} (${format(start, "dd")}-${format(end, "dd")})`;
    };

    // --- Handlers ---

    const handlePeriodChange = (monthStr: string, yearStr: string) => {
        const month = parseInt(monthStr);
        const year = parseInt(yearStr);

        if (!isNaN(month) && !isNaN(year)) {
            // Default to first week if none selected
            if (!startDate) {
                setStartDate(startOfMonth(new Date(year, month)));
            }
            if (!endDate) {
                // Default 7 days or end of month
                const start = startDate || startOfMonth(new Date(year, month));
                const sevenDaysLater = new Date(start);
                sevenDaysLater.setDate(start.getDate() + 6);
                const monthEnd = endOfMonth(new Date(year, month));
                setEndDate(sevenDaysLater > monthEnd ? monthEnd : sevenDaysLater);
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
        setSelectedStatus("Open");
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

        if (startDate && (getMonth(startDate) !== month || getYear(startDate) !== year)) {
            errors.startDate = "Start Date must be within the selected month and year.";
        }
        if (endDate && (getMonth(endDate) !== month || getYear(endDate) !== year)) {
            errors.endDate = "End Date must be within the selected month and year.";
        }
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

    const handleCreateSubmit = () => {
        if (validateForm()) {
            const month = parseInt(selectedMonth);
            const year = parseInt(selectedYear);
            const periodName = getPeriodName(month, year, startDate!, endDate!);

            if (editingId) {
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
                    description: "Workers Wage Period updated successfully.",
                    className: "bg-green-50 border-green-200 text-green-900",
                });
            } else {
                const newPeriod: WorkersWagePeriod = {
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
                    description: "Workers Wage Period created successfully.",
                    className: "bg-green-50 border-green-200 text-green-900",
                });
            }

            setIsCreateOpen(false);
            resetForm();
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
        setPeriods(prev => prev.filter(p => p.id !== editingId));
        toast({
            title: "Period Deleted",
            description: "Workers Wage Period has been successfully deleted.",
        });
        setIsDeleteOpen(false);
        setIsCreateOpen(false);
        resetForm();
    };

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
                            { label: "Open", value: "Open" },
                            { label: "Locked", value: "Locked" },
                            { label: "Processed", value: "Processed" },
                            { label: "Paid", value: "Paid" }
                        ],
                        searchable: true
                    }
                ]}
                actions={[
                    {
                        label: "Create Wage Period",
                        icon: <Plus className="mr-2 h-4 w-4" />,
                        onClick: () => {
                            resetForm();
                            setIsCreateOpen(true);
                        }
                    }
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
                                {paginatedPeriods.length === 0 ? (
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
                                                    period.status === 'Open' ? 'outline' :
                                                        period.status === 'Locked' ? 'secondary' :
                                                            period.status === 'Processed' ? 'default' : 'secondary'
                                                } className={cn(
                                                    "text-xs",
                                                    period.status === 'Open' && "bg-blue-50 text-blue-700 border-blue-200",
                                                    period.status === 'Locked' && "bg-amber-50 text-amber-700 border-amber-200",
                                                    period.status === 'Processed' && "bg-purple-50 text-purple-700 border-purple-200",
                                                    period.status === 'Paid' && "bg-green-50 text-green-700 border-green-200"
                                                )}>
                                                    {period.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <TableActionButtons
                                                    onEdit={() => handleEdit(period)}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <DataTablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredPeriods.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                </CardContent>
            </Card>

            <Dialog open={isCreateOpen} onOpenChange={(open) => {
                if (!open) resetForm();
                setIsCreateOpen(open);
            }}>
                <DialogContent className="sm:max-w-[600px] p-6">
                    <DialogHeader className="mb-4">
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

                    <div className="grid gap-6 py-2">
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
                                {formErrors.endDate && <p className="text-[11px] font-medium text-destructive mt-1">{formErrors.endDate}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Status</Label>
                                <Select
                                    value={selectedStatus}
                                    onValueChange={(val: WorkersWagePeriod["status"]) => setSelectedStatus(val)}
                                >
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select Status" />
                                    </SelectTrigger>
                                    <SelectContent>
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
                                            This action cannot be undone. This will permanently delete the workers wage period record.
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
