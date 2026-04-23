import { useState, useEffect } from "react";
import { format, parse, isValid } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check, Trash2, Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandInputBorderless,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
} from "@/components/ui/alert-dialog";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect as SharedSearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker as SharedDatePicker } from "@/components/shared/DatePicker";

// ============================================================================
// HELPERS & MOCK DATA
// ============================================================================

const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};
// Mock items from masterMockData.ts
const MOCK_ITEMS = [
    { id: "rm-1", code: "RM001", name: "Scrap Battery", type: "RM", uom: "kg" },
    { id: "rm-2", code: "RM002", name: "Plastic Pallets", type: "RM", uom: "kg" },
    { id: "rm-3", code: "RM003", name: "Acid Type A", type: "RM", uom: "L" },
    { id: "sfg-1", code: "SFG001", name: "Purified Lead", type: "SFG", uom: "kg" },
    { id: "sfg-2", code: "SFG002", name: "Battery Cases", type: "SFG", uom: "nos" },
    { id: "sfg-3", code: "SFG003", name: "Battery Lids", type: "SFG", uom: "nos" },
    { id: "sfg-4", code: "SFG004", name: "Separators", type: "SFG", uom: "nos" },
    { id: "sfg-5", code: "SFG005", name: "Terminals", type: "SFG", uom: "nos" },
    { id: "sfg-6", code: "SFG006", name: "Connectors", type: "SFG", uom: "nos" },
    { id: "fg-1", code: "FG001", name: "GSV 7", type: "FG", uom: "nos" },
    { id: "fg-2", code: "FG002", name: "GSV 8", type: "FG", uom: "nos" },
    { id: "fg-3", code: "FG003", name: "GSMX 2.5", type: "FG", uom: "nos" },
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

const BOM_NAME_MIN_LEN = 2;
const BOM_NAME_MAX_LEN = 150;

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================


// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface BOM2Record {
    id: number;
    bomCode: string;
    bomName: string;
    itemType: "FG" | "SFG";
    itemName: string;
    description?: string;
    status: "Active" | "Inactive";
    createdAt: string;
    components: any[];
}

interface BOMComponent {
    item_id: string;
    type: string;
    quantity: number | string;
    item?: {
        id: string;
        code: string;
        name: string;
        type: string;
        uom: string;
    };
}

interface BOMFormData {
    id?: number;
    bomCode?: string;
    bomName: string;
    bomDescription: string;
    selectedItemId: string;
    components: BOMComponent[];
}

export default function BOM() {
    const { toast } = useToast();

    // Listing State
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("All");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    // Pagination state - using DataTablePagination component
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [bomRecords, setBomRecords] = useState<BOM2Record[]>([
        {
            id: 1,
            bomCode: "BOM-2024-001",
            bomName: "GSV 7 Battery BOM",
            itemType: "FG",
            itemName: "GSV 7",
            description: "Standard Bill of Materials for GSV 7 Battery",
            status: "Active",
            createdAt: "2024-01-15",
            components: MOCK_OPERATIONS[2].inputs.map(input => ({
                ...input,
                item: MOCK_ITEMS.find(i => i.id === input.item_id)
            }))
        },
        {
            id: 2,
            bomCode: "BOM-2024-002",
            bomName: "Purified Lead BOM",
            itemType: "SFG",
            itemName: "Purified Lead",
            description: "BOM for Lead Purification process",
            status: "Active",
            createdAt: "2024-01-20",
            components: MOCK_OPERATIONS[0].inputs.map(input => ({
                ...input,
                item: MOCK_ITEMS.find(i => i.id === input.item_id)
            }))
        },
    ]);

    // Dialog State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<"create" | "view" | "edit">("view");
    const [formData, setFormData] = useState<BOMFormData>({
        bomName: "",
        bomDescription: "",
        selectedItemId: "",
        components: []
    });

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [bomNameError, setBomNameError] = useState("");

    const handleCreateClick = () => {
        setDialogMode("create");
        setBomNameError("");
        setFormData({
            bomName: "",
            bomDescription: "",
            selectedItemId: "",
            components: []
        });
        setDialogOpen(true);
    };

    const handleEditClick = (record: BOM2Record) => {
        setDialogMode("edit");
        setBomNameError("");
        setFormData({
            id: record.id,
            bomName: record.bomName,
            bomDescription: record.description || "",
            selectedItemId: MOCK_ITEMS.find(i => i.name === record.itemName)?.id || "",
            components: record.components.map(comp => ({ ...comp }))
        });
        setDialogOpen(true);
    };

    const handleViewClick = (record: BOM2Record) => {
        setDialogMode("view");
        setBomNameError("");
        setFormData({
            bomCode: record.bomCode,
            bomName: record.bomName,
            bomDescription: record.description || "",
            selectedItemId: MOCK_ITEMS.find(i => i.name === record.itemName)?.id || "",
            components: record.components.map(comp => ({ ...comp }))
        });
        setDialogOpen(true);
    };

    // Auto-population logic
    useEffect(() => {
        if (dialogMode === "create" && formData.selectedItemId) {
            const itemId = formData.selectedItemId;
            // Find an operation that produces this item as an output
            const matchedOp = MOCK_OPERATIONS.find(op =>
                op.outputs.some(out => out.item_id === itemId)
            );

            if (matchedOp) {
                const components = matchedOp.inputs.map(input => ({
                    ...input,
                    item: MOCK_ITEMS.find(i => i.id === input.item_id)
                }));
                setFormData((prev: BOMFormData) => ({ ...prev, components }));
            } else {
                setFormData((prev: BOMFormData) => ({ ...prev, components: [] }));
            }
        }
    }, [formData.selectedItemId, dialogMode]);

    const handleSave = () => {
        const nameTrimmed = formData.bomName.trim();
        if (
            nameTrimmed.length < BOM_NAME_MIN_LEN ||
            nameTrimmed.length > BOM_NAME_MAX_LEN
        ) {
            if (nameTrimmed.length > 0 && nameTrimmed.length < BOM_NAME_MIN_LEN) {
                setBomNameError("Minimum 2 characters required");
            } else {
                setBomNameError("");
            }
            toast({
                title: "Validation Error",
                description: `BOM name must be between ${BOM_NAME_MIN_LEN} and ${BOM_NAME_MAX_LEN} characters.`,
                variant: "destructive",
            });
            return;
        }
        if (!formData.selectedItemId) {
            toast({ title: "Validation Error", description: "Please fill all required fields", variant: "destructive" });
            return;
        }

        if (dialogMode === "create") {
            const newRecord: BOM2Record = {
                id: Date.now(),
                bomCode: `BOM-${new Date().getFullYear()}-${String(bomRecords.length + 1).padStart(3, '0')}`,
                bomName: nameTrimmed,
                itemType: MOCK_ITEMS.find(i => i.id === formData.selectedItemId)?.type as "FG" | "SFG",
                itemName: MOCK_ITEMS.find(i => i.id === formData.selectedItemId)?.name || "",
                description: formData.bomDescription,
                status: "Active",
                createdAt: new Date().toISOString(),
                components: formData.components
            };
            setBomRecords((prev: BOM2Record[]) => [newRecord, ...prev]);
            toast({
                variant: "success",
                title: "Success",
                description: "BOM created successfully",
            });
        } else {
            setBomRecords((prev: BOM2Record[]) => prev.map(r => r.id === formData.id ? {
                ...r,
                bomName: nameTrimmed,
                description: formData.bomDescription,
                components: formData.components
            } : r));
            toast({
                variant: "success",
                title: "Updated",
                description: "BOM updated successfully",
            });
        }
        setDialogOpen(false);
    };

    const handleDelete = () => {
        setBomRecords((prev: BOM2Record[]) => prev.filter(r => r.id !== formData.id));
        toast({
            variant: "success",
            title: "Deleted",
            description: "BOM record removed",
        });
        setDialogOpen(false);
        setIsDeleteDialogOpen(false);
    };

    const filteredData = bomRecords.filter((item) => {
        const matchesSearch =
            item.bomCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.bomName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === "All" || item.itemType === typeFilter;

        let matchesDate = true;
        if (dateFilter) {
            const recordDate = new Date(item.createdAt);
            recordDate.setHours(0, 0, 0, 0);
            const filterDate = new Date(dateFilter);
            filterDate.setHours(0, 0, 0, 0);
            matchesDate = recordDate.getTime() === filterDate.getTime();
        }

        return matchesSearch && matchesType && matchesDate;
    });

    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    // Auto-adjust page when data changes
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredData.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, typeFilter, dateFilter]);

    const bomNameTrimLen = formData.bomName.trim().length;
    const canSaveBom =
        bomNameTrimLen >= BOM_NAME_MIN_LEN &&
        bomNameTrimLen <= BOM_NAME_MAX_LEN &&
        Boolean(formData.selectedItemId) &&
        formData.components.length > 0 &&
        !formData.components.some((c: any) => c.quantity < 0 || c.quantity > 1000000);

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold tracking-tight">BOM Management</h1>

            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: setSearchTerm,
                    placeholder: "Search by Code, Name or Item..."
                }}
                filters={[
                    {
                        type: 'select',
                        label: 'Type',
                        value: typeFilter,
                        options: [
                            { label: "All Items", value: "All" },
                            { label: "Finished Goods", value: "FG" },
                            { label: "Semi-Finished Goods", value: "SFG" }
                        ],
                        onChange: setTypeFilter,
                        searchable: true
                    },
                    {
                        type: 'date',
                        label: 'Date',
                        value: dateFilter,
                        onChange: setDateFilter,
                        showClear: !!dateFilter
                    }
                ]}
                actions={[
                    {
                        label: "Create BOM",
                        icon: <Plus className="h-4 w-4" />,
                        onClick: handleCreateClick
                    }
                ]}
            />

            {/* Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>BOM Code</TableHead>
                                    <TableHead>BOM Name</TableHead>
                                    <TableHead>FG / SFG</TableHead>
                                    <TableHead>Created On</TableHead>
                                    <TableHead className="text-center font-bold text-[11px] tracking-wider py-4">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-muted/30">
                                        <TableCell className="font-mono text-xs font-medium">{item.bomCode}</TableCell>
                                        <TableCell className="text-sm font-semibold">{item.bomName}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={item.itemType === 'FG' ? "default" : "secondary"}>
                                                    {item.itemType}
                                                </Badge>
                                                <span className="text-xs">{item.itemName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
                                        <TableCell className="py-4 text-center">
                                            <TableActionButtons
                                                onView={() => handleViewClick(item)}
                                                onEdit={() => handleEditClick(item)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination - using standardized DataTablePagination component */}
                    <DataTablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredData.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        options={[10, 15, 30, 50]}
                    />
                </CardContent>
            </Card>

            {/* Dialog Form */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent
                    className="max-w-3xl max-h-[90vh] overflow-y-auto"
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle className="uppercase tracking-tight text-xl font-bold">
                            {dialogMode === "create" ? "Create New BOM" : dialogMode === "edit" ? "Edit BOM" : "BOM Details"}
                        </DialogTitle>
                        <DialogDescription className="italic text-xs">
                            Manage Bill of Materials configuration and component requirements.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        {/* Section: Basic Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">BOM Name *</Label>
                                <Input
                                    placeholder="Enter BOM Name"
                                    value={formData.bomName}
                                    maxLength={BOM_NAME_MAX_LEN}
                                    onChange={(e) => {
                                        const v = e.target.value.slice(0, BOM_NAME_MAX_LEN);
                                        setFormData((prev: BOMFormData) => ({
                                            ...prev,
                                            bomName: v,
                                        }));
                                        const t = v.trim();
                                        if (t.length > 0 && t.length < BOM_NAME_MIN_LEN) {
                                            setBomNameError("Minimum 2 characters required");
                                        } else {
                                            setBomNameError("");
                                        }
                                    }}
                                    className={cn(
                                        "h-9",
                                        bomNameError && "border-red-500 focus-visible:ring-red-500"
                                    )}
                                    disabled={dialogMode === "view"}
                                />
                                {bomNameError && dialogMode !== "view" && (
                                    <p className="mt-1 text-xs text-red-500">{bomNameError}</p>
                                )}
                            </div>
                            <SharedSearchableSelect
                                label="SFG / FG *"
                                value={formData.selectedItemId}
                                options={MOCK_ITEMS.filter(i => i.type === "FG" || i.type === "SFG").map(i => {
                                    const isAlreadyCreated = bomRecords.some(bom => bom.itemName === i.name);
                                    return {
                                        value: i.id,
                                        label: i.name,
                                        code: i.code,
                                        disabled: isAlreadyCreated && dialogMode === "create"
                                    };
                                })}
                                onChange={(val) => setFormData((prev: BOMFormData) => ({ ...prev, selectedItemId: val }))}
                                disabled={dialogMode !== "create"}
                            />

                            <div className="col-span-full space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</Label>
                                <Input
                                    placeholder="Enter Description"
                                    value={formData.bomDescription}
                                    onChange={(e) => setFormData((prev: BOMFormData) => ({ ...prev, bomDescription: e.target.value }))}
                                    disabled={dialogMode === "view"}
                                />
                            </div>
                        </div>

                        {/* Section: Component List (Auto-populated) */}
                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-primary uppercase border-b pb-1 block">Input Components (RM / SFG)</Label>
                            {formData.components.length > 0 ? (
                                <div className="rounded-md border overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Item Details</TableHead>
                                                <TableHead>UOM</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead className="text-right">Quantity</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {formData.components.map((comp: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{comp.item?.name}</span>
                                                            <span className="text-[10px] text-muted-foreground font-mono">{comp.item?.code}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs uppercase font-medium">{comp.item?.uom}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-[10px]">{comp.type}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={comp.quantity}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    // Allow only numbers and one decimal point, max 6 digits total
                                                                    if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 6)) {
                                                                        const newComponents = [...formData.components];
                                                                        newComponents[idx] = { ...comp, quantity: val };
                                                                        setFormData((prev: BOMFormData) => ({ ...prev, components: newComponents }));
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "h-8 w-24 text-right font-mono font-bold focus-visible:ring-primary/20",
                                                                    (parseFloat(comp.quantity) < 0 || parseFloat(comp.quantity) > 1000000) && "border-red-500 focus-visible:ring-red-500/20 text-red-600"
                                                                )}
                                                                disabled={dialogMode === "view"}
                                                            />
                                                            {comp.quantity < 0 && <span className="text-[9px] text-red-500 font-bold">MIN 0</span>}
                                                            {comp.quantity > 1000000 && <span className="text-[9px] text-red-500 font-bold">MAX 1M</span>}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/5">
                                    <p className="text-sm text-muted-foreground">Select an SFG/FG to view required inputs</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex justify-between items-center sm:justify-between border-t pt-4">
                        <div>
                            {dialogMode === "edit" && (
                                <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)} className="gap-2">
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                {dialogMode === "view" ? "Close" : "Cancel"}
                            </Button>
                            {dialogMode !== "view" && (
                                <Button
                                    onClick={handleSave}
                                    disabled={!canSaveBom}
                                    className={
                                        canSaveBom
                                            ? "bg-blue-600 hover:bg-blue-600/90 text-white border-blue-600"
                                            : "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:!opacity-100"
                                    }
                                >
                                    {dialogMode === "create" ? "Save BOM" : "Update Changes"}
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete BOM</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this BOM? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
