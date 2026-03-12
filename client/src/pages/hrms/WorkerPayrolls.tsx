import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import {
    Plus, Search, Edit, Eye, Trash2, ArrowLeft,
    Save, Send, ChevronLeft, ChevronRight, ChevronDown, ChevronsUpDown, Check,
    Calendar as CalendarIcon, X
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
    WorkerWage,
    WorkerWageStatus,
    mockWorkerWages,
    addWorkerWage,
    updateWorkerWage,
    deleteWorkerWage,
    mockWagePeriods
} from "@/lib/workerPayrollSharedData";
import { mockLocations, mockWorkCenters, mockOperations } from "@/lib/masterMockData";



// Helper Component: Searchable Select (Robust version)
interface SearchableOption {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    label?: string;
    value?: string;
    options: (string | SearchableOption)[];
    onChange?: (val: string) => void;
    onValueChange?: (val: string) => void;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    searchPlaceholder?: string;
}

function SearchableSelect({
    label,
    value,
    options,
    onChange,
    onValueChange,
    required = false,
    disabled = false,
    placeholder,
    searchPlaceholder
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);

    // Normalize options to SearchableOption[]
    const normalizedOptions = useMemo(() => {
        return options.map(opt =>
            typeof opt === 'string' ? { value: opt, label: opt } : opt
        );
    }, [options]);

    const displayValue = useMemo(() => {
        if (!value) return "";
        return normalizedOptions.find(opt => opt.value === value)?.label || value;
    }, [value, normalizedOptions]);

    const handleSelect = (val: string) => {
        if (onValueChange) onValueChange(val);
        if (onChange) onChange(val);
        setOpen(false);
    };

    const inputPlaceholder = searchPlaceholder || `Search ${label?.toLowerCase() || "options"}...`;

    return (
        <div className="space-y-2">
            {label && (
                <Label className="text-sm font-medium">
                    {label} {required && <span className="text-destructive">*</span>}
                </Label>
            )}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-10 font-normal border-input"
                        disabled={disabled}
                    >
                        <span className={cn(!value && "text-muted-foreground", "truncate max-w-[90%]")}>
                            {displayValue || placeholder || (label ? `Select ${label}` : "Select option")}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                        <CommandInputBorderless placeholder={inputPlaceholder} className="h-9" />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                {normalizedOptions.map((item) => (
                                    <CommandItem
                                        key={item.value}
                                        value={item.value}
                                        onSelect={() => handleSelect(item.value)}
                                        className="cursor-pointer"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === item.value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {item.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}

export default function WorkerPayrollsPage() {
    const { toast } = useToast();

    // State
    const [wages, setWages] = useState<WorkerWage[]>(mockWorkerWages);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [viewOnly, setViewOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("Draft Wages");
    const [departmentFilter, setDepartmentFilter] = useState<string>("All");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Form State
    const [formState, setFormState] = useState<{
        wagePeriod: string;
        location: string;
        department: string;
        workcenter: string;
        operation: string;
        workerCategory: string;
        noOfWorkers: string;
        netWageAmount: string;
    }>({
        wagePeriod: "",
        location: "",
        department: "",
        workcenter: "",
        operation: "",
        workerCategory: "",
        noOfWorkers: "",
        netWageAmount: ""
    });

    // Auto-calculation
    const totalWageAmount = useMemo(() => {
        const count = parseFloat(formState.noOfWorkers) || 0;
        const amount = parseFloat(formState.netWageAmount) || 0;
        return count * amount;
    }, [formState.noOfWorkers, formState.netWageAmount]);

    // Handlers
    const resetForm = () => {
        setFormState({
            wagePeriod: "",
            location: "",
            department: "",
            workcenter: "",
            operation: "",
            workerCategory: "",
            noOfWorkers: "",
            netWageAmount: ""
        });
        setEditingId(null);
        setViewOnly(false);
    };

    const handleEdit = (wage: WorkerWage, mode: "edit" | "view" = "edit") => {
        setEditingId(wage.id);
        setFormState({
            wagePeriod: wage.wagePeriod,
            location: wage.location,
            department: wage.department,
            workcenter: wage.workcenter,
            operation: wage.operation,
            workerCategory: wage.workerCategory,
            noOfWorkers: wage.noOfWorkers.toString(),
            netWageAmount: wage.netWageAmount.toString()
        });
        setViewOnly(mode === "view");
        setIsFormOpen(true);
    };

    const handleSubmit = (status: WorkerWageStatus) => {
        if (!formState.wagePeriod || !formState.workerCategory || !formState.noOfWorkers || !formState.netWageAmount) {
            toast({
                title: "Validation Error",
                description: "Please fill all required fields.",
                variant: "destructive"
            });
            return;
        }

        const newWage: WorkerWage = {
            id: editingId || `ww-${Math.random().toString(36).substr(2, 9)}`,
            wagePeriod: formState.wagePeriod,
            registerDate: editingId ? (wages.find(w => w.id === editingId)?.registerDate || format(new Date(), "yyyy-MM-dd")) : format(new Date(), "yyyy-MM-dd"),
            location: formState.location,
            department: formState.department,
            workcenter: formState.workcenter,
            operation: formState.operation,
            workerCategory: formState.workerCategory,
            noOfWorkers: parseInt(formState.noOfWorkers),
            netWageAmount: parseFloat(formState.netWageAmount),
            totalWageAmount: totalWageAmount,
            status: status
        };

        if (editingId) {
            const updatedWages = updateWorkerWage(editingId, newWage);
            setWages(updatedWages);
            toast({ title: "Success", description: "Worker Wage updated successfully." });
        } else {
            const updatedWages = addWorkerWage(newWage);
            setWages(updatedWages);
            toast({ title: "Success", description: "Worker Wage created successfully." });
        }

        setIsFormOpen(false);
        resetForm();
    };

    const handleDelete = () => {
        if (!editingId) return;
        const updatedWages = deleteWorkerWage(editingId);
        setWages(updatedWages);
        toast({ title: "Deleted", description: "Worker Wage record removed." });
        setIsFormOpen(false);
        resetForm();
    };

    // Filtered Data
    const filteredWages = wages.filter(w => {
        const matchesSearch =
            w.wagePeriod.toLowerCase().includes(searchQuery.toLowerCase()) ||
            w.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
            w.workerCategory.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === "All" || w.status === statusFilter;

        const matchesDepartment = departmentFilter === "All" || w.department === departmentFilter;

        const matchesDate = !dateFilter || format(new Date(w.registerDate), "yyyy-MM-dd") === format(dateFilter, "yyyy-MM-dd");

        return matchesSearch && matchesStatus && matchesDepartment && matchesDate;
    });

    const paginatedWages = filteredWages.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredWages.length / itemsPerPage);

    const currentWage = editingId ? wages.find(w => w.id === editingId) : null;
    const canDelete = editingId && (currentWage?.status === "Draft Wages" || currentWage?.status === "Submitted Wages");
    const showSaveDraft = !editingId || currentWage?.status === "Draft Wages";

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* Page Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Worker Payrolls</h1>
                <p className="text-muted-foreground">
                    Manage and track factory worker wages
                </p>
            </div>

            {/* Search and Filter Section - Styled like MaterialRelease */}
            <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="w-full sm:flex-1">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Search
                    </Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by Period / Dept / Category..."
                            className="pl-9 h-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="w-full sm:w-48">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Department
                    </Label>
                    <SearchableSelect
                        value={departmentFilter}
                        onValueChange={setDepartmentFilter}
                        options={[
                            { value: "All", label: "All" },
                            { value: "Production", label: "Production" },
                            { value: "Logistics", label: "Logistics" },
                            { value: "Packaging", label: "Packaging" },
                            { value: "Maintenance", label: "Maintenance" },
                        ]}
                        placeholder="Select Dept"
                        searchPlaceholder="Search dept..."
                    />
                </div>

                <div className="w-full sm:w-48">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Date
                    </Label>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <DatePicker
                                date={dateFilter}
                                setDate={setDateFilter}
                            />
                        </div>
                        {dateFilter && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setDateFilter(undefined);
                                }}
                                className="h-10 w-10 shrink-0 border border-input hover:bg-muted"
                                title="Reset date filter"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="w-full sm:w-48">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                    </Label>
                    <SearchableSelect
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                        options={[
                            { value: "All", label: "All" },
                            { value: "Draft Wages", label: "Draft Wages" },
                            { value: "Submitted Wages", label: "Submitted Wages" },
                            { value: "Paid Wages", label: "Paid Wages" },
                        ]}
                        placeholder="Select Status"
                        searchPlaceholder="Search status..."
                    />
                </div>

                <div className="w-full sm:w-auto">
                    <Button onClick={() => { resetForm(); setIsFormOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Wage
                    </Button>
                </div>
            </div>

            {/* Workers Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Wage Period</TableHead>
                                    <TableHead>Register Date</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>No of workers</TableHead>
                                    <TableHead>Total Net Wage</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedWages.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                            No worker payroll records found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedWages.map((wage) => {
                                        const isDraft = wage.status === "Draft Wages";
                                        const isSubmitted = wage.status === "Submitted Wages";
                                        const isPaid = wage.status === "Paid Wages";
                                        return (
                                            <TableRow key={wage.id} className="hover:bg-muted/50 transition-colors border-b">
                                                <TableCell className="font-mono text-xs font-semibold py-3">{wage.wagePeriod}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{format(new Date(wage.registerDate), "dd MMM yyyy")}</TableCell>
                                                <TableCell className="text-xs">{wage.location || "-"}</TableCell>
                                                <TableCell className="text-xs">{wage.department || "-"}</TableCell>
                                                <TableCell className="text-center font-medium text-xs font-mono">{wage.noOfWorkers}</TableCell>
                                                <TableCell className="text-right font-bold text-xs font-mono">USh{wage.totalWageAmount.toLocaleString()}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border-2",
                                                            isDraft ? "bg-amber-50 text-amber-600 border-amber-200" :
                                                                isSubmitted ? "bg-blue-50 text-blue-600 border-blue-200" :
                                                                    "bg-emerald-50 text-emerald-600 border-emerald-200"
                                                        )}
                                                    >
                                                        {wage.status === "Draft Wages" ? "Draft" : wage.status === "Submitted Wages" ? "Submitted" : "Paid"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(wage, "view")} title="View">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {!isPaid && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(wage)} title="Edit">
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table >
                    </div >
                </CardContent >
            </Card >

            {/* Pagination Integration (Simplified for now to match style, but can use DataTablePagination if needed) */}
            < div className="flex justify-between items-center px-1 py-2" >
                <div className="text-sm text-muted-foreground flex gap-4">
                    <span>Showing {filteredWages.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredWages.length)} of {filteredWages.length} entries</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs">Rows per page:</span>
                        <Select value={itemsPerPage.toString()} onValueChange={() => { }}>
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder="10" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90">
                        {currentPage}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div >

            {/* Dialog Form */}
            < Dialog open={isFormOpen} onOpenChange={(open) => {
                setIsFormOpen(open);
                if (!open) resetForm();
            }
            }>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="border-b pb-4 mb-4">
                        <DialogTitle className="text-xl">
                            {viewOnly ? "View Worker Wage Details" : editingId ? "Edit Worker Wage Entry" : "Create New Worker Wage"}
                        </DialogTitle>
                        <DialogDescription>
                            Configure worker wage parameters and calculate totals.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-2">
                        <SearchableSelect
                            label="Wage Period"
                            required
                            value={formState.wagePeriod}
                            options={mockWagePeriods.map(p => ({ value: p.periodName, label: p.periodName }))}
                            onChange={(val) => setFormState(prev => ({ ...prev, wagePeriod: val }))}
                            disabled={viewOnly}
                            placeholder="Select period"
                        />

                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Entry Date</Label>
                            <Input value={format(new Date(), "dd-MM-yyyy")} readOnly className="bg-muted h-10 border-muted-foreground/20 pointer-events-none" />
                        </div>

                        <SearchableSelect
                            label="Location"
                            value={formState.location}
                            options={mockLocations.map(l => ({ value: l.name, label: l.name }))}
                            onChange={(val) => setFormState(prev => ({ ...prev, location: val }))}
                            disabled={viewOnly}
                            placeholder="Select location (Optional)"
                        />

                        <SearchableSelect
                            label="Department"
                            value={formState.department}
                            options={["Production", "Logistics", "Packaging", "Maintenance"]}
                            onChange={(val) => setFormState(prev => ({ ...prev, department: val }))}
                            disabled={viewOnly}
                            placeholder="Select dept (Optional)"
                        />

                        <SearchableSelect
                            label="Workcenter"
                            value={formState.workcenter}
                            options={mockWorkCenters.map(wc => ({ value: wc.name, label: wc.name }))}
                            onChange={(val) => setFormState(prev => ({ ...prev, workcenter: val }))}
                            disabled={viewOnly}
                            placeholder="Select workcenter (Optional)"
                        />

                        <SearchableSelect
                            label="Operation"
                            value={formState.operation}
                            options={mockOperations.map(op => ({ value: op.name, label: op.name }))}
                            onChange={(val) => setFormState(prev => ({ ...prev, operation: val }))}
                            disabled={viewOnly}
                            placeholder="Select operation (Optional)"
                        />

                        <SearchableSelect
                            label="Worker Category"
                            required
                            value={formState.workerCategory}
                            options={["Helper", "Packaging", "Assembler", "Solderer"]}
                            onChange={(val) => setFormState(prev => ({ ...prev, workerCategory: val }))}
                            disabled={viewOnly}
                            placeholder="Select category"
                        />

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">No of Workers <span className="text-destructive">*</span></Label>
                            <Input
                                type="number"
                                value={formState.noOfWorkers}
                                onChange={(e) => setFormState(prev => ({ ...prev, noOfWorkers: e.target.value }))}
                                disabled={viewOnly}
                                placeholder="Enter count"
                                className="h-10 border-muted-foreground/20"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Net Wage Amount <span className="text-destructive">*</span></Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">USh</span>
                                <Input
                                    type="number"
                                    value={formState.netWageAmount}
                                    onChange={(e) => setFormState(prev => ({ ...prev, netWageAmount: e.target.value }))}
                                    disabled={viewOnly}
                                    placeholder="Enter amount"
                                    className="pl-12 h-10 border-muted-foreground/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 lg:col-span-1 border-t pt-4 mt-2">
                            <Label className="text-sm font-semibold text-primary">Total Wage Amount</Label>
                            <div className="text-2xl font-bold text-primary px-3 py-2 bg-primary/5 rounded-md border border-primary/20">
                                USh{totalWageAmount.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t pt-4 mt-4 flex justify-between items-center w-full gap-4">
                        <div className="flex-1">
                            {canDelete && !viewOnly && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete record
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently remove this wage record.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>

                        {!viewOnly ? (
                            <div className="flex gap-3">
                                {showSaveDraft && (
                                    <Button variant="outline" onClick={() => handleSubmit("Draft Wages")} className="h-10 border-amber-300 text-amber-700 hover:bg-amber-50">
                                        <Save className="mr-2 h-4 w-4" /> Save as Draft
                                    </Button>
                                )}
                                {showSaveDraft && (
                                    <Button onClick={() => handleSubmit("Submitted Wages")} className="h-10 bg-blue-600 hover:bg-blue-700">
                                        <Send className="mr-2 h-4 w-4" /> Submit Wages
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Close View</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </div >
    );
}

// --- Reusable Premium DatePicker Component (Replicated from ProductionPlan.tsx) ---

function DatePicker({ date, setDate, disabled = false, minDate }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean,
    minDate?: Date
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
        const selected = new Date(selectedDate);
        selected.setHours(0, 0, 0, 0);

        let isBeforeMinDate = false;
        if (minDate) {
            const minimumDate = new Date(minDate);
            minimumDate.setHours(0, 0, 0, 0);
            isBeforeMinDate = selected < minimumDate;
        }

        if (!isBeforeMinDate) {
            setDate(selectedDate);
            setIsOpen(false);
            setViewMode("day");
        }
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
        let minimumDate: Date | null = null;
        if (minDate) {
            minimumDate = new Date(minDate);
            minimumDate.setHours(0, 0, 0, 0);
        }

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
                isPast: minimumDate ? dayDate < minimumDate : false
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            currentDate.setHours(0, 0, 0, 0);
            const isToday = new Date().toDateString() === currentDate.toDateString();
            const isSelected = date && currentDate.toDateString() === date.toDateString();
            const isPast = minimumDate ? currentDate < minimumDate : false;

            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday,
                isSelected,
                isPast: isPast
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
                isPast: minimumDate ? dayDate < minimumDate : false
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
                        "w-full justify-start text-left font-normal flex h-10 rounded-md border border-input px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
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

