import React, { useState, useMemo } from "react";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { format } from "date-fns";
import {
    Plus, Search, Edit, Trash2, ArrowLeft,
    Save, Send, ChevronLeft, ChevronRight, ChevronDown, ChevronsUpDown, Check,
    Calendar as CalendarIcon, X
} from "lucide-react";
import { DatePicker } from "@/components/shared/DatePicker";
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

            {/* Search and Filter Section using AppListToolbar */}
            <AppListToolbar
                search={{
                    value: searchQuery,
                    onChange: setSearchQuery,
                    placeholder: "Search by Period / Dept / Category..."
                }}
                filters={[
                    {
                        type: 'select',
                        label: 'Department',
                        value: departmentFilter,
                        options: ["All", "Production", "Logistics", "Packaging", "Maintenance"],
                        onChange: setDepartmentFilter,
                        searchable: true
                    },
                    {
                        type: 'date',
                        label: 'Date',
                        value: dateFilter ? format(dateFilter, 'yyyy-MM-dd') : "",
                        onChange: (val) => setDateFilter(val ? new Date(val) : undefined)
                    },
                    {
                        type: 'select',
                        label: 'Status',
                        value: statusFilter,
                        options: ["All", "Draft Wages", "Submitted Wages", "Paid Wages"],
                        onChange: setStatusFilter,
                        searchable: true
                    }
                ]}
                actions={[
                    {
                        label: 'Create Wage',
                        icon: <Plus className="mr-2 h-4 w-4" />,
                        onClick: () => { resetForm(); setIsFormOpen(true); },
                        variant: 'default'
                    }
                ]}
            />

            {/* Workers Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Wage Period</TableHead>
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Register Date</TableHead>
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Location</TableHead>
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Department</TableHead>
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">No of workers</TableHead>
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Total Net Wage</TableHead>
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-center w-[100px] text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Actions</TableHead>
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
                                                <TableCell className="text-center">
                                                    <TableActionButtons
                                                        onView={() => handleEdit(wage, "view")}
                                                        onEdit={!isPaid ? () => handleEdit(wage) : undefined}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Integration */}
                    <DataTablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredWages.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={() => {}}
                        showRowsPerPage={true}
                    />
                </CardContent>
            </Card>

            {/* Dialog Form */}
            <Dialog open={isFormOpen} onOpenChange={(open) => {
                setIsFormOpen(open);
                if (!open) resetForm();
            }}>
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
                            options={mockWagePeriods.map(p => p.periodName)}
                            onChange={(val) => setFormState(prev => ({ ...prev, wagePeriod: val }))}
                            disabled={viewOnly}
                        />

                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Entry Date</Label>
                            <Input value={format(new Date(), "dd-MM-yyyy")} readOnly className="bg-muted h-10 border-muted-foreground/20 pointer-events-none" />
                        </div>

                        <SearchableSelect
                            label="Location"
                            value={formState.location}
                            options={mockLocations.map(l => l.name)}
                            onChange={(val) => setFormState(prev => ({ ...prev, location: val }))}
                            disabled={viewOnly}
                        />

                        <SearchableSelect
                            label="Department"
                            value={formState.department}
                            options={["Production", "Logistics", "Packaging", "Maintenance"]}
                            onChange={(val) => setFormState(prev => ({ ...prev, department: val }))}
                            disabled={viewOnly}
                        />

                        <SearchableSelect
                            label="Workcenter"
                            value={formState.workcenter}
                            options={mockWorkCenters.map(wc => wc.name)}
                            onChange={(val) => setFormState(prev => ({ ...prev, workcenter: val }))}
                            disabled={viewOnly}
                        />

                        <SearchableSelect
                            label="Operation"
                            value={formState.operation}
                            options={mockOperations.map(op => op.name)}
                            onChange={(val) => setFormState(prev => ({ ...prev, operation: val }))}
                            disabled={viewOnly}
                        />

                        <SearchableSelect
                            label="Worker Category"
                            required
                            value={formState.workerCategory}
                            options={["Helper", "Packaging", "Assembler", "Solderer"]}
                            onChange={(val) => setFormState(prev => ({ ...prev, workerCategory: val }))}
                            disabled={viewOnly}
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
            </Dialog>
        </div>
    );
}
