import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandInputBorderless,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
    Plus,
    Search,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Check,
    ChevronsUpDown,
    Calendar as CalendarIcon,
    ChevronDown,
    X,
    Play, Clock, CheckCircle2, AlertCircle
} from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { parse, isValid, differenceInDays, isAfter, isBefore, startOfDay } from "date-fns";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect as SharedSearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker as SharedDatePicker } from "@/components/shared/DatePicker";

import { 
    DailyFGPlan, 
    INITIAL_PLANS, 
    PlanStatus 
} from "@/lib/productionPlanSharedData";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SHIFT_OPTIONS = ["Morning", "Night"];

// ============================================================================
// PRODUCTION PLAN MANAGEMENT MODULE
// ============================================================================
// This module handles the creation and tracking of production plans.
// Key Features:
// - Date range planning (Start & End dates) with 30-day strict validation.
// - Status lifecycle: To Do -> In Progress -> Completed -> Overdue.
// - Real-time output tracking (Fulfilled vs Targeted quantity).
// - Integration: Plans created here are linkable in Material Requests.
// ============================================================================

// ============================================================================
// HELPERS
// ============================================================================

const formatDate = (date: Date | string): string => {
    if (!date) return "";
    const d = typeof date === 'string' ? parseDateString(date) : date;
    if (!isValid(d)) return typeof date === 'string' ? date : "";
    return format(d, "dd-MM-yyyy");
};

const parseDateString = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    // Try DD-MM-YYYY first
    let parsed = parse(dateStr, "dd-MM-yyyy", new Date());
    if (isValid(parsed)) return parsed;
    // Fallback to YYYY-MM-DD
    parsed = parse(dateStr, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) return parsed;
    return new Date(dateStr);
};

// Mock items from masterMockData.ts
const MOCK_ITEMS = [
    { id: "rm-1", code: "RM001", name: "Scrap Battery", type: "RM", uom: "kg" },
    { id: "rm-2", code: "RM002", name: "Plastic Pallets", type: "RM", uom: "kg" },
    { id: "rm-3", code: "RM003", name: "Acid Type A", type: "RM", uom: "L" },
    { id: "sfg-1", code: "SFG001", name: "Purified Lead", type: "SFG", uom: "kg" },
    { id: "sfg-2", code: "SFG002", name: "Battery Cases", type: "SFG", uom: "nos" },
    { id: "sfg-3", code: "SFG003", name: "Battery Lids", type: "SFG", uom: "nos" },
    { id: "fg-1", code: "FG001", name: "GSV 7", type: "FG", uom: "nos" },
    { id: "fg-2", code: "FG002", name: "GSV 8", type: "FG", uom: "nos" },
];

const MOCK_OPERATIONS = [
    {
        id: "op-1",
        code: "OP001",
        name: "Lead Generation & Purification",
        inputs: [{ item_id: "rm-1", type: "RM", quantity: 10 }],
        outputs: [{ item_id: "sfg-1", type: "SFG", quantity: 1 }],
    },
    {
        id: "op-2",
        code: "OP002",
        name: "Case Creation",
        inputs: [{ item_id: "rm-2", type: "RM", quantity: 5 }],
        outputs: [{ item_id: "sfg-2", type: "SFG", quantity: 1 }],
    },
    {
        id: "op-3",
        code: "OP003",
        name: "Assembly line & Packaging",
        inputs: [
            { item_id: "sfg-1", type: "SFG", quantity: 2 },
            { item_id: "sfg-2", type: "SFG", quantity: 1 },
            { item_id: "rm-3", type: "RM", quantity: 5 }
        ],
        outputs: [{ item_id: "fg-1", type: "FG", quantity: 1 }],
    }
];

// Mock plans migrated to shared data

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProductionPlan() {
    const { toast } = useToast();

    // Table State
    const [searchTerm, setSearchTerm] = useState("");
    const [opFilter, setOpFilter] = useState("All");
    const [shiftFilter, setShiftFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [filterDate, setFilterDate] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Data State
    const [plans, setPlans] = useState<DailyFGPlan[]>(INITIAL_PLANS);

    // Dialog State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<"view" | "edit" | "create">("create");
    const [currentPlan, setCurrentPlan] = useState<DailyFGPlan | null>(null);

    // Form State
    const [formStartDate, setFormStartDate] = useState(format(new Date(), "dd-MM-yyyy"));
    const [formEndDate, setFormEndDate] = useState(format(new Date(), "dd-MM-yyyy"));
    const [formShift, setFormShift] = useState<"Morning" | "Night" | "">("");
    const [selectedOpId, setSelectedOpId] = useState("");
    const [formOutputs, setFormOutputs] = useState<any[]>([]);
    const [formStatus, setFormStatus] = useState<PlanStatus>("To Do");

    // Filtering
    const filteredPlans = plans.filter(p => {
        const matchesSearch = p.planCode.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesOp = opFilter === "All" || p.operationName === opFilter;
        const matchesShift = shiftFilter === "All" || p.shift === shiftFilter;
        const matchesStatus = statusFilter === "All" || p.status === statusFilter;
        const matchesDate = !filterDate || p.startDate === filterDate || p.endDate === filterDate;
        return matchesSearch && matchesOp && matchesShift && matchesStatus && matchesDate;
    });

    const totalPages = Math.ceil(filteredPlans.length / itemsPerPage);
    const paginatedPlans = filteredPlans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Auto-adjust page when data changes
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredPlans.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, opFilter, shiftFilter, statusFilter, filterDate]);

    /**
     * Date Range Validation Logic:
     * 1. End Date must be greater than or equal to Start Date.
     * 2. The total duration cannot exceed 30 days per user requirement.
     */
    const getDateRangeError = () => {
        if (!formStartDate || !formEndDate) return null;
        const start = parseDateString(formStartDate);
        const end = parseDateString(formEndDate);
        
        if (isBefore(end, start)) {
            return "End Date must be greater than or equal to Start Date";
        }
        
        const days = differenceInDays(end, start);
        if (days > 30) {
            return "Maximum range between start and end date is 30 days";
        }
        
        return null;
    };

    // Validation
    const isFormValid = () => {
        return (
            selectedOpId !== "" &&
            formShift !== "" &&
            formOutputs.length > 0 &&
            formOutputs.every(o => o.quantity > 0 && o.quantity <= 1000000) &&
            !getDateRangeError()
        );
    };


    // Auto-population logic for outputs
    useEffect(() => {
        if (dialogMode === "create" && selectedOpId) {
            const opId = selectedOpId;
            const matchedOp = MOCK_OPERATIONS.find(op => op.id === opId);
            if (matchedOp) {
                const outputs = matchedOp.outputs.map(out => ({
                    ...out,
                    item: MOCK_ITEMS.find(i => i.id === out.item_id)
                }));
                setFormOutputs(outputs);
            }
        }
    }, [selectedOpId, dialogMode]);

    // Handlers
    const handleCreatePlan = () => {
        setDialogMode("create");
        setCurrentPlan(null);
        setFormStartDate(format(new Date(), "dd-MM-yyyy"));
        setFormEndDate(format(new Date(), "dd-MM-yyyy"));
        setFormShift("");
        setSelectedOpId("");
        setFormOutputs([]);
        setFormStatus("To Do");
        setDialogOpen(true);
    };


    const handleEditPlan = (id: number) => {
        const plan = plans.find(p => p.id === id);
        if (plan) {
            setCurrentPlan(plan);
            setDialogMode("edit");
            setFormStartDate(plan.startDate);
            setFormEndDate(plan.endDate);
            setFormShift(plan.shift);
            setFormStatus(plan.status);

            // Reconstruct the mock operation and outputs for editing
            const op = MOCK_OPERATIONS.find(o => o.outputs.some(out => out.item_id === plan.itemId));
            setSelectedOpId(op?.id || "");
            setFormOutputs([{
                item_id: plan.itemId,
                quantity: parseFloat(plan.plannedQty),
                item: MOCK_ITEMS.find(i => i.id === plan.itemId)
            }]);
            setDialogOpen(true);
        }
    };

    const handleViewPlan = (id: number) => {
        const plan = plans.find(p => p.id === id);
        if (plan) {
            setCurrentPlan(plan);
            setDialogMode("view");
            setFormStartDate(plan.startDate);
            setFormEndDate(plan.endDate);
            setFormShift(plan.shift);
            setFormStatus(plan.status);

            const op = MOCK_OPERATIONS.find(o => o.outputs.some(out => out.item_id === plan.itemId));
            setSelectedOpId(op?.id || "");
            setFormOutputs([{
                item_id: plan.itemId,
                quantity: parseFloat(plan.plannedQty),
                item: MOCK_ITEMS.find(i => i.id === plan.itemId)
            }]);
            setDialogOpen(true);
        }
    };

    const handleDeletePlan = () => {
        if (currentPlan) {
            setPlans(plans.filter(p => p.id !== currentPlan.id));
            toast({
                variant: "success",
                title: "Deleted",
                description: "Production Plan removed successfully",
                duration: 15000
            });
            setDialogOpen(false);
        }
    };

    const handleSave = () => {
        if (!isFormValid()) return;

        if (dialogMode === "create") {
            const opName = MOCK_OPERATIONS.find(o => o.id === selectedOpId)?.name || "";
            const newPlans: DailyFGPlan[] = formOutputs.map((out, idx) => ({
                id: Date.now() + idx,
                planCode: `PLN-${new Date().getFullYear().toString().slice(-2)}-${String(plans.length + 1 + idx).padStart(3, '0')}`,
                startDate: formStartDate,
                endDate: formEndDate,
                operationName: opName,
                itemId: out.item_id,
                itemCode: out.item?.code || "",
                itemName: out.item?.name || "",
                shift: formShift as "Morning" | "Night",
                plannedQty: out.quantity.toString(),
                fulfilledQty: "0",
                uom: out.item?.uom || "",
                status: formStatus
            }));
            setPlans([...newPlans, ...plans]);
            toast({
                variant: "success",
                title: "Success",
                description: `${newPlans.length} production plans created`,
                duration: 15000
            });
        } else if (dialogMode === "edit" && currentPlan) {
            const out = formOutputs[0];
            const opName = MOCK_OPERATIONS.find(o => o.id === selectedOpId)?.name || "";
            setPlans(plans.map(p => p.id === currentPlan.id ? {
                ...p,
                startDate: formStartDate,
                endDate: formEndDate,
                operationName: opName,
                itemId: out.item_id,
                itemCode: out.item?.code || p.itemCode,
                itemName: out.item?.name || "",
                shift: formShift as "Morning" | "Night",
                plannedQty: out.quantity.toString(),
                uom: out.item?.uom || "",
                status: formStatus
            } : p));

            toast({
                variant: "success",
                title: "Updated",
                description: "Production Plan updated successfully",
                duration: 15000
            });
        }
        setDialogOpen(false);
    };

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold tracking-tight">Production Plan Management</h1>

            {/* DAILY FG PLAN CONTENT */}
            <div className="flex-1 flex flex-col gap-6">
                {/* Search Section with Filters and Create Button - MATCHING MATERIAL OPERATION STYLE */}
                <AppListToolbar
                    search={{
                        value: searchTerm,
                        onChange: setSearchTerm,
                        placeholder: "Search code..."
                    }}
                    filters={[
                        {
                            type: 'select',
                            label: 'Operation',
                            value: opFilter,
                            options: [
                                { label: "All Operations", value: "All" },
                                ...MOCK_OPERATIONS.map(o => ({ label: o.name, value: o.name }))
                            ],
                            onChange: setOpFilter,
                            searchable: true
                        },
                        {
                            type: 'select',
                            label: 'Shift',
                            value: shiftFilter,
                            options: [
                                { label: "All Shifts", value: "All" },
                                { label: "Morning", value: "Morning" },
                                { label: "Night", value: "Night" }
                            ],
                            onChange: setShiftFilter,
                            searchable: true
                        },
                        {
                            type: 'select',
                            label: 'Status',
                            value: statusFilter,
                            options: [
                                { label: "All Status", value: "All" },
                                { label: "To Do", value: "To Do" },
                                { label: "In Progress", value: "In Progress" },
                                { label: "Completed", value: "Completed" },
                                { label: "Overdue", value: "Overdue" }
                            ],
                            onChange: setStatusFilter,
                            searchable: true
                        },
                        {
                            type: 'date',
                            label: 'Date',
                            value: filterDate ? parseDateString(filterDate) : undefined,
                            onChange: (date) => setFilterDate(date ? format(date, "dd-MM-yyyy") : ""),
                            showClear: !!filterDate
                        }
                    ]}
                    actions={[
                        {
                            label: "Create Plan",
                            icon: <Plus className="h-4 w-4" />,
                            onClick: handleCreatePlan
                        }
                    ]}
                />

                <Card>
                    <CardContent className="pt-6">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Plan Code</TableHead>
                                        <TableHead>Start Date</TableHead>
                                        <TableHead>End Date</TableHead>
                                        <TableHead>Operation</TableHead>
                                        <TableHead>Output (Fulfilled / Targeted)</TableHead>
                                        <TableHead>Shift</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-center font-bold text-[11px] tracking-wider py-4">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedPlans.length > 0 ? (
                                        paginatedPlans.map((plan) => (
                                            <TableRow key={plan.id}>
                                                <TableCell className="font-mono text-xs font-medium">{plan.planCode}</TableCell>
                                                <TableCell className="text-xs font-semibold text-muted-foreground">{plan.startDate}</TableCell>
                                                <TableCell className="text-xs font-semibold text-muted-foreground">{plan.endDate}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 text-[10px] font-bold uppercase tracking-tight">
                                                        {plan.operationName}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs font-extrabold text-slate-950">
                                                            {plan.itemCode} ({plan.fulfilledQty} / {plan.plannedQty})
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn(
                                                        "font-semibold text-[10px] uppercase",
                                                        plan.shift === "Morning" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                    )}>
                                                        {plan.shift}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn(
                                                        "font-bold text-[10px] px-2 py-0.5 uppercase tracking-wide border-none",
                                                        plan.status === "To Do" ? "bg-slate-100 text-slate-700 hover:bg-slate-100" :
                                                        plan.status === "In Progress" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                                                        plan.status === "Completed" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                                                        plan.status === "Overdue" ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                                        "bg-slate-100 text-slate-700 hover:bg-slate-100"
                                                    )}>
                                                        {plan.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center py-4">
                                                    <TableActionButtons
                                                        onView={() => handleViewPlan(plan.id)}
                                                        onEdit={() => handleEditPlan(plan.id)}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                                No production plans found
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination - using standardized DataTablePagination component */}
                        {filteredPlans.length > 0 && (
                            <DataTablePagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={filteredPlans.length}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                                options={[10, 15, 30, 50]}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* CREATE/EDIT/VIEW DIALOG - REPLICATING MATERIAL RELEASE STYLE */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent
                    className="max-w-2xl overflow-hidden p-0"
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-bold uppercase tracking-tight text-foreground">
                            {dialogMode === "create" ? "Create Production Plan" : dialogMode === "edit" ? "Modify Production Plan" : "Production Plan Details"}
                        </DialogTitle>
                        <DialogDescription className="text-xs italic text-muted-foreground">
                            {dialogMode === "create" ? "Configure a new production schedule" : dialogMode === "edit" ? "Adjust parameters for existing production schedules" : "Check configuration and target metrics"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 pt-2 space-y-6 max-h-[70vh] overflow-y-auto">
                        {/* PLAN CONFIGURATION SECTION */}
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {dialogMode !== "create" && (
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Plan Code</Label>
                                        <Input
                                            value={currentPlan?.planCode}
                                            readOnly
                                            className="h-9 bg-muted border-none font-mono text-sm font-semibold pointer-events-none"
                                        />
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Start Date <span className="text-red-500">*</span></Label>
                                    <SharedDatePicker
                                        date={formStartDate ? parseDateString(formStartDate) : undefined}
                                        setDate={(date) => setFormStartDate(date ? format(date, "dd-MM-yyyy") : "")}
                                        disabled={dialogMode === "view"}
                                        showClear={false}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">End Date <span className="text-red-500">*</span></Label>
                                    <SharedDatePicker
                                        date={formEndDate ? parseDateString(formEndDate) : undefined}
                                        setDate={(date) => setFormEndDate(date ? format(date, "dd-MM-yyyy") : "")}
                                        disabled={dialogMode === "view"}
                                        showClear={false}
                                    />
                                    {getDateRangeError() && <p className="text-[10px] text-red-500 font-bold mt-1">{getDateRangeError()}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Shift <span className="text-red-500">*</span></Label>
                                    <SharedSearchableSelect
                                        value={formShift}
                                        options={SHIFT_OPTIONS}
                                        onChange={(val) => setFormShift(val as "Morning" | "Night")}
                                        placeholder="Select shift..."
                                        disabled={dialogMode === "view"}
                                        className="h-9 min-h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <SharedSearchableSelect
                                        label="Operation *"
                                        value={selectedOpId}
                                        options={MOCK_OPERATIONS.map(op => ({
                                            value: op.id,
                                            label: op.name,
                                            code: op.code
                                        }))}
                                        onChange={(val) => setSelectedOpId(val)}
                                        disabled={dialogMode !== "create"}
                                    />
                                </div>
                            </div>
                        </div>


                        {/* Section: Output Components (Auto-populated) */}
                        <div className="space-y-3 pt-2">
                            <Label className="text-xs font-bold text-primary uppercase border-b border-primary/20 pb-1 block tracking-wider">Target Outputs (SFG / FG)</Label>
                            {formOutputs.length > 0 ? (
                                <div className="rounded-md border border-border/60 overflow-hidden shadow-sm">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30">
                                                <TableHead className="text-[10px] uppercase font-bold">Item Details</TableHead>
                                                <TableHead className="text-[10px] uppercase font-bold text-center">UOM</TableHead>
                                                <TableHead className="text-[10px] uppercase font-bold text-right pr-6">Target Qty</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="bg-background">
                                            {formOutputs.map((out: any, idx: number) => (
                                                <TableRow key={idx} className="hover:bg-muted/5">
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold">{out.item?.name}</span>
                                                            <span className="text-[10px] text-muted-foreground font-mono">{out.item?.code}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="secondary" className="text-[10px] uppercase">{out.item?.uom}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={out.quantity}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    // Allow only numbers and one decimal point, max 6 digits total
                                                                    if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 6)) {
                                                                        const newOutputs = [...formOutputs];
                                                                        newOutputs[idx] = { ...out, quantity: val };
                                                                        setFormOutputs(newOutputs);
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "h-8 w-24 text-right font-mono font-bold focus-visible:ring-primary/20",
                                                                    (parseFloat(out.quantity) <= 0 || parseFloat(out.quantity) > 1000000) && "border-red-500 focus-visible:ring-red-500/20 text-red-600"
                                                                )}
                                                                placeholder="0.00"
                                                                disabled={dialogMode === "view"}
                                                            />
                                                            {out.quantity <= 0 && <span className="text-[9px] text-red-500 font-bold">MIN &gt; 0</span>}
                                                            {out.quantity > 1000000 && <span className="text-[9px] text-red-500 font-bold">MAX 1M</span>}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/5">
                                    <p className="text-sm text-muted-foreground">Select an Operation to view target production outputs</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t gap-2 bg-muted/5">
                        {dialogMode === "edit" && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleDeletePlan}
                                className="h-9 px-4 mr-auto font-bold uppercase tracking-wider text-[10px]"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Plan
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                            className="h-9 px-6 font-bold uppercase tracking-wider text-[10px]"
                        >
                            {dialogMode === "view" ? "Close" : "Cancel"}
                        </Button>
                        {dialogMode !== "view" && (
                            <Button
                                onClick={handleSave}
                                disabled={!isFormValid()}
                                className={cn(
                                    "h-9 px-8 font-bold uppercase tracking-wider text-[10px]",
                                    isFormValid()
                                        ? "bg-blue-600 text-white hover:bg-blue-600/90 border-blue-600"
                                        : "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:!opacity-100"
                                )}
                            >
                                {dialogMode === "create" ? "Save Plan" : "Update Changes"}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
