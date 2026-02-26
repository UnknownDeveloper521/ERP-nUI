import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import {
    Plus,
    Search,
    Eye,
    Pencil,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Check,
    ChevronsUpDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface DailyFGPlan {
    id: number;
    planCode: string;
    planName: string;
    itemId: number;
    itemName: string;
    shift: "Morning" | "Night";
    plannedQty: string;
    uom: string;
    status: string;
}

interface FGItem {
    id: number;
    code: string;
    name: string;
    uom: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const FG_ITEMS: FGItem[] = [
    { id: 101, code: "FG001", name: "Premium Solar Panel 400W", uom: "NOS" },
    { id: 102, code: "FG002", name: "Standard Solar Panel 350W", uom: "NOS" },
    { id: 103, code: "FG003", name: "Portable Solar Charger 50W", uom: "NOS" },
];

const INITIAL_PLANS: DailyFGPlan[] = [
    {
        id: 1,
        planCode: "PLN-2024-001",
        planName: "Morning Shift A Production",
        itemId: 101,
        itemName: "Premium Solar Panel 400W",
        shift: "Morning",
        plannedQty: "25.0",
        uom: "NOS",
        status: "Planned"
    },
    {
        id: 2,
        planCode: "PLN-2024-002",
        planName: "Night Shift B Production",
        itemId: 102,
        itemName: "Standard Solar Panel 350W",
        shift: "Night",
        plannedQty: "15.0",
        uom: "NOS",
        status: "Planned"
    },
    {
        id: 3,
        planCode: "PLN-2024-003",
        planName: "Morning Shift C Production",
        itemId: 103,
        itemName: "Portable Solar Charger 50W",
        shift: "Morning",
        plannedQty: "50.0",
        uom: "NOS",
        status: "Planned"
    }
];

// ============================================================================
// SEARCHABLE SELECT COMPONENT
// ============================================================================

interface SearchableSelectProps {
    label: string;
    value?: string;
    options: (FGItem | string)[];
    onChange: (val: any) => void;
    required?: boolean;
    disabled?: boolean;
}

function SearchableSelect({
    label,
    value,
    options,
    onChange,
    required = false,
    disabled = false,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="space-y-1">
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-10 font-normal border-input overflow-hidden bg-background"
                        disabled={disabled}
                    >
                        <span className={cn("truncate mr-2", !value && "text-muted-foreground")}>
                            {value || `Select ${label}`}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                        <CommandInputBorderless placeholder={`Search ${label.toLowerCase()}...`} className="h-9" />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                {options.map((item, idx) => {
                                    const name = typeof item === 'string' ? item : item.name;
                                    const code = typeof item === 'string' ? null : item.code;
                                    return (
                                        <CommandItem
                                            key={idx}
                                            value={name}
                                            onSelect={() => {
                                                onChange(item);
                                                setOpen(false);
                                            }}
                                            className="cursor-pointer"
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    value === name ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">{name}</span>
                                                {code && <span className="text-[10px] text-muted-foreground">{code}</span>}
                                            </div>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProductionPlan() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const [, tabParams] = useRoute("/production/production-plan/:tab");

    const currentTab = tabParams?.tab || "daily-fg-plan";

    // Table State
    const [searchTerm, setSearchTerm] = useState("");
    const [fgFilter, setFgFilter] = useState("All");
    const [shiftFilter, setShiftFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Data State
    const [plans, setPlans] = useState<DailyFGPlan[]>(INITIAL_PLANS);

    // Dialog State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<"view" | "edit" | "create">("create");
    const [currentPlan, setCurrentPlan] = useState<DailyFGPlan | null>(null);

    // Form State
    const [formName, setFormName] = useState("");
    const [formFG, setFormFG] = useState<FGItem | null>(null);
    const [formShift, setFormShift] = useState<"Morning" | "Night" | "">("");
    const [formQty, setFormQty] = useState("");

    // Filtering
    const filteredPlans = plans.filter(p => {
        const matchesSearch = p.planName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.planCode.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFG = fgFilter === "All" || p.itemName === fgFilter;
        const matchesShift = shiftFilter === "All" || p.shift === shiftFilter;
        return matchesSearch && matchesFG && matchesShift;
    });

    const totalPages = Math.ceil(filteredPlans.length / itemsPerPage);
    const paginatedPlans = filteredPlans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Validation
    const isFormValid = () => {
        const qtyNum = parseFloat(formQty);
        return (
            formName.trim() !== "" &&
            formFG !== null &&
            formShift !== "" &&
            !isNaN(qtyNum) &&
            qtyNum > 0
        );
    };

    // Handlers
    const handleCreatePlan = () => {
        setDialogMode("create");
        setCurrentPlan(null);
        setFormName("");
        setFormFG(null);
        setFormShift("");
        setFormQty("");
        setDialogOpen(true);
    };

    const handleEditPlan = (id: number) => {
        const plan = plans.find(p => p.id === id);
        if (plan) {
            setCurrentPlan(plan);
            setDialogMode("edit");
            setFormName(plan.planName);
            setFormFG(FG_ITEMS.find(i => i.id === plan.itemId) || null);
            setFormShift(plan.shift);
            setFormQty(plan.plannedQty);
            setDialogOpen(true);
        }
    };

    const handleViewPlan = (id: number) => {
        const plan = plans.find(p => p.id === id);
        if (plan) {
            setCurrentPlan(plan);
            setDialogMode("view");
            setFormName(plan.planName);
            setFormFG(FG_ITEMS.find(i => i.id === plan.itemId) || null);
            setFormShift(plan.shift);
            setFormQty(plan.plannedQty);
            setDialogOpen(true);
        }
    };

    const handleDeletePlan = () => {
        if (currentPlan) {
            setPlans(plans.filter(p => p.id !== currentPlan.id));
            toast({ title: "Deleted", description: "Production Plan removed successfully" });
            setDialogOpen(false);
        }
    };

    const handleSave = () => {
        if (!isFormValid()) return;

        if (dialogMode === "create") {
            const newPlan: DailyFGPlan = {
                id: Date.now(),
                planCode: `PLN-${new Date().getFullYear()}-${String(plans.length + 1).padStart(3, '0')}`,
                planName: formName,
                itemId: formFG!.id,
                itemName: formFG!.name,
                shift: formShift as "Morning" | "Night",
                plannedQty: parseFloat(formQty).toFixed(1),
                uom: formFG!.uom,
                status: "Planned"
            };
            setPlans([newPlan, ...plans]);
            toast({ title: "Success", description: "Production Plan created successfully" });
        } else if (dialogMode === "edit" && currentPlan) {
            setPlans(plans.map(p => p.id === currentPlan.id ? {
                ...p,
                planName: formName,
                itemId: formFG!.id,
                itemName: formFG!.name,
                shift: formShift as "Morning" | "Night",
                plannedQty: parseFloat(formQty).toFixed(1),
                uom: formFG!.uom
            } : p));
            toast({ title: "Updated", description: "Production Plan updated successfully" });
        }
        setDialogOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Production Plan</h1>
                <p className="text-muted-foreground italic">Manage daily finished goods production schedules and operational targets.</p>
            </div>

            <Tabs value={currentTab} onValueChange={(val) => setLocation(`/production/production-plan/${val}`)} className="w-full flex-1 flex flex-col">
                <div className="border-b border-border">
                    <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0">
                        <TabsTrigger
                            value="daily-fg-plan"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                        >
                            Daily FG Plan
                        </TabsTrigger>
                        <TabsTrigger
                            value="operation-target"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                        >
                            Operation Target
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* DAILY FG PLAN CONTENT */}
                <TabsContent value="daily-fg-plan" className="m-0 h-full flex flex-col gap-6 mt-6">
                    {/* Search Section with Filters and Create Button - MATCHING MATERIAL OPERATION STYLE */}
                    <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
                        <div className="w-full sm:flex-1">
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search code or name..."
                                    className="pl-9 h-10"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                        </div>
                        <div className="w-full sm:w-48">
                            <SearchableSelect
                                label="FG Item"
                                options={["All", ...FG_ITEMS.map(i => i.name)]}
                                value={fgFilter}
                                onChange={(val) => {
                                    setFgFilter(val);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <div className="w-full sm:w-48">
                            <SearchableSelect
                                label="Shift"
                                options={["All", "Morning", "Night"]}
                                value={shiftFilter}
                                onChange={(val) => {
                                    setShiftFilter(val);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <div className="w-full sm:w-auto">
                            <Button onClick={handleCreatePlan} className="w-full sm:w-auto h-10">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Plan
                            </Button>
                        </div>
                    </div>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Plan Code</TableHead>
                                            <TableHead>Plan Name</TableHead>
                                            <TableHead>Item (FG)</TableHead>
                                            <TableHead>Shift</TableHead>
                                            <TableHead>Planned Quantity</TableHead>
                                            <TableHead className="text-right pr-6">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedPlans.length > 0 ? (
                                            paginatedPlans.map((plan) => (
                                                <TableRow key={plan.id}>
                                                    <TableCell className="font-mono text-xs font-medium">{plan.planCode}</TableCell>
                                                    <TableCell className="text-sm font-medium">{plan.planName}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm">{plan.itemName}</span>
                                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                                {FG_ITEMS.find(i => i.id === plan.itemId)?.code}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={cn(
                                                            "font-semibold",
                                                            plan.shift === "Morning" ? "bg-amber-100/50 text-amber-700 border-amber-200" : "bg-indigo-100/50 text-indigo-700 border-indigo-200"
                                                        )}>
                                                            {plan.shift}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-mono font-semibold">
                                                            {plan.plannedQty} {plan.uom}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 text-muted-foreground" onClick={() => handleViewPlan(plan.id)}>
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 text-muted-foreground" onClick={() => handleEditPlan(plan.id)}>
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                    No production plans found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Controls */}
                            {filteredPlans.length > 0 && (
                                <div className="flex justify-between items-center px-1 mt-4">
                                    <div className="text-sm text-muted-foreground">
                                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPlans.length)} of {filteredPlans.length} entries
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage >= totalPages || totalPages === 0}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* OPERATION TARGET CONTENT */}
                <TabsContent value="operation-target" className="m-0 h-full flex flex-col gap-6 mt-6">
                    <Card className="border-none shadow-sm h-[400px] flex items-center justify-center bg-muted/20 border-dashed border-2">
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-foreground mb-2">Operation Target Module</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto">This submodule is currently being refined. Stay tuned for updates on performance tracking and operational targets.</p>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* CREATE/EDIT/VIEW DIALOG - REPLICATING MATERIAL RELEASE STYLE */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl overflow-hidden p-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-bold uppercase tracking-tight text-foreground">
                            {dialogMode === "create" ? "Create Daily FG Plan" : dialogMode === "edit" ? "Modify Production Plan" : "Production Plan Details"}
                        </DialogTitle>
                        <DialogDescription className="text-xs italic text-muted-foreground">
                            {dialogMode === "create" ? "Configure a new plan for finished goods production" : dialogMode === "edit" ? "Adjust parameters for existing production schedules" : "Check configuration and target metrics"}
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
                                <div className={cn("space-y-1", dialogMode === "create" && "md:col-span-2")}>
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Plan Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. Standard Shift A"
                                        disabled={dialogMode === "view"}
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <SearchableSelect
                                    label="FG Item"
                                    required
                                    options={FG_ITEMS}
                                    value={formFG?.name}
                                    onChange={(val) => setFormFG(val)}
                                    disabled={dialogMode === "view"}
                                />
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Shift <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={formShift}
                                        onValueChange={(val: any) => setFormShift(val)}
                                        disabled={dialogMode === "view"}
                                    >
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Select Shift" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Morning">Morning</SelectItem>
                                            <SelectItem value="Night">Night</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Planned Qty <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            value={formQty}
                                            onChange={(e) => setFormQty(e.target.value)}
                                            placeholder="0.00"
                                            disabled={dialogMode === "view"}
                                            className="h-9 pr-12 font-mono font-bold text-sm"
                                        />
                                        <span className="absolute right-3 top-2 text-[10px] font-bold text-muted-foreground uppercase">{formFG?.uom || ""}</span>
                                    </div>
                                </div>
                            </div>
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
                                className="h-9 px-8 font-bold uppercase tracking-wider text-[10px]"
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
