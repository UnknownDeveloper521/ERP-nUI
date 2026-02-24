import { useState } from "react";
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
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandInputBorderless,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date from YYYY-MM-DD to DD-MM-YYYY
 */
const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * WH Receive Item interface
 * Represents individual items in a warehouse receipt from production
 */
interface WHReceiveItem {
    id: number;
    itemCode: string;
    itemName: string;
    uom: string;
    releaseQty: number; // Verified Qty from production
    receivedQty?: number; // Optional, same as releaseQty
    remarks?: string;
}

/**
 * WH Receive interface
 * Represents a warehouse receipt record from production release
 */
interface WHReceive {
    id: number;
    releaseNo: string;
    releaseDate: string;
    mrNo: string;
    operation: string;
    workCenter: string;
    warehouse: string;
    releasedBy: string;
    qcVerifiedBy: string;
    qcVerifiedOn: string;
    status: "Pending Receipt" | "Received";
    totalItems: number;
    items: WHReceiveItem[];
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_WH_RECEIVES: WHReceive[] = [
    {
        id: 1,
        releaseNo: "REL-2024-001",
        releaseDate: "2024-02-15",
        mrNo: "MR-2024-001",
        operation: "Cutting",
        workCenter: "WC-001 Cutting Bay",
        warehouse: "Production Store",
        releasedBy: "John Doe",
        qcVerifiedBy: "QC Inspector 1",
        qcVerifiedOn: "2024-02-15",
        status: "Pending Receipt",
        totalItems: 2,
        items: [
            { id: 1, itemCode: "CUT001", itemName: "Cut Steel Plate", uom: "PCS", releaseQty: 50, receivedQty: 50, remarks: "" },
            { id: 2, itemCode: "CUT002", itemName: "Cut Aluminum Sheet", uom: "PCS", releaseQty: 30, receivedQty: 30, remarks: "" },
        ]
    },
    {
        id: 2,
        releaseNo: "REL-2024-002",
        releaseDate: "2024-02-16",
        mrNo: "MR-2024-002",
        operation: "Welding",
        workCenter: "WC-002 Welding Station",
        warehouse: "Production Store",
        releasedBy: "Jane Smith",
        qcVerifiedBy: "QC Inspector 2",
        qcVerifiedOn: "2024-02-16",
        status: "Received",
        totalItems: 1,
        items: [
            { id: 1, itemCode: "WLD001", itemName: "Welded Frame", uom: "PCS", releaseQty: 25, receivedQty: 25, remarks: "" },
        ]
    },
];

const WAREHOUSES = ["Production Store", "Raw Material Store", "Finished Goods Store"];

// ============================================================================
// SEARCHABLE SELECT COMPONENT
// ============================================================================

interface SearchableSelectProps {
    label?: string;
    value?: string;
    options: string[];
    onChange: (val: string) => void;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
}

function SearchableSelect({ label, value, options, onChange, placeholder, required = false, disabled = false }: SearchableSelectProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="space-y-2">
            {label && <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}{required && <span className="text-red-500 ml-1">*</span>}</Label>}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className="w-full justify-between h-10 font-normal border-input"
                    >
                        <span className={cn(!value && "text-muted-foreground")}>
                            {value || placeholder || `Select ${label}`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                        <CommandInputBorderless placeholder={`Search...`} className="h-9" />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                {!required && (
                                    <CommandItem
                                        value=""
                                        onSelect={() => {
                                            onChange("");
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                                        All
                                    </CommandItem>
                                )}
                                {options.map((item) => (
                                    <CommandItem
                                        key={item}
                                        value={item}
                                        onSelect={() => {
                                            onChange(item);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", value === item ? "opacity-100" : "opacity-0")} />
                                        {item}
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WHReceive() {
    const { toast } = useToast();

    // Listing State
    const [whReceives, setWhReceives] = useState<WHReceive[]>(MOCK_WH_RECEIVES);
    const [searchTerm, setSearchTerm] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("Pending Receipt"); // Default to Pending
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal State
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedWHReceive, setSelectedWHReceive] = useState<WHReceive | null>(null);

    // Filter Logic
    const filteredWHReceives = whReceives.filter(whr => {
        const matchesSearch = whr.releaseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            whr.mrNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            whr.operation.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesWarehouse = !warehouseFilter || whr.warehouse === warehouseFilter;
        const matchesStatus = !statusFilter || whr.status === statusFilter;

        return matchesSearch && matchesWarehouse && matchesStatus;
    });

    const totalPages = Math.ceil(filteredWHReceives.length / itemsPerPage);
    const paginatedWHReceives = filteredWHReceives.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Handlers
    const handleView = (whr: WHReceive) => {
        setSelectedWHReceive(whr);
        setIsViewModalOpen(true);
    };

    /**
     * Mark as Received Handler
     * - Updates stock in warehouse
     * - Creates material ledger entry
     * - Updates status to Received
     */
    const handleMarkAsReceived = () => {
        if (!selectedWHReceive) return;

        // Update status
        setWhReceives(whReceives.map(whr =>
            whr.id === selectedWHReceive.id
                ? { ...whr, status: "Received" as const }
                : whr
        ));

        // TODO: In real implementation:
        // 1. Increase stock in warehouse for each item by releaseQty
        // 2. Create Material Ledger entries:
        //    - Ref Type = "WH Receive"
        //    - Ref No = releaseNo
        //    - In Qty = releaseQty for each item
        // 3. Update Production release status: "Released for WH" → "Delivered to WH"

        toast({
            title: "Success",
            description: "Material received in warehouse successfully.",
        });

        setIsViewModalOpen(false);
        setSelectedWHReceive(null);
    };

    // ============================================================================
    // RENDER: LISTING VIEW
    // ============================================================================

    return (
        <div className="flex flex-col gap-6">
            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="w-full sm:w-1/4">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Search</Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search Release No, MR No, Operation..."
                            className="pl-9 h-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="w-full sm:w-1/5">
                    <SearchableSelect
                        label="Warehouse"
                        options={WAREHOUSES}
                        value={warehouseFilter}
                        onChange={setWarehouseFilter}
                    />
                </div>

                <div className="w-full sm:w-1/5">
                    <SearchableSelect
                        label="Status"
                        options={["Pending Receipt", "Received"]}
                        value={statusFilter}
                        onChange={setStatusFilter}
                        placeholder="Select Status"
                    />
                </div>


            </div>

            {/* Listing Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Release No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Release Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">MR No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Operation</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Work Center</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Warehouse</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedWHReceives.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            No warehouse receipts found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedWHReceives.map((whr) => (
                                        <TableRow key={whr.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="py-4 font-medium text-primary">{whr.releaseNo}</TableCell>
                                            <TableCell>{formatDate(whr.releaseDate)}</TableCell>
                                            <TableCell className="font-medium">{whr.mrNo}</TableCell>
                                            <TableCell>{whr.operation}</TableCell>
                                            <TableCell>{whr.workCenter}</TableCell>
                                            <TableCell>{whr.warehouse}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "font-medium",
                                                        whr.status === "Pending Receipt" && "border-amber-500 text-amber-600 bg-amber-50",
                                                        whr.status === "Received" && "border-green-500 text-green-600 bg-green-50"
                                                    )}
                                                >
                                                    {whr.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleView(whr)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {filteredWHReceives.length > 0 && (
                        <div className="flex justify-between items-center px-1 mt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredWHReceives.length)} of {filteredWHReceives.length} entries
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
                                    disabled={currentPage >= totalPages || totalPages === 0}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* View Modal */}
            {selectedWHReceive && (
                <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader className="border-b pb-4">
                            <div className="flex items-center justify-between pr-8">
                                <DialogTitle className="text-xl font-bold">
                                    WH Receive: {selectedWHReceive.releaseNo}
                                </DialogTitle>
                            </div>
                        </DialogHeader>

                        <div className="space-y-6 py-4">
                            {/* Header Details */}
                            <Card>
                                <CardContent className="pt-6">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Receipt Information</h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <Label>Release No</Label>
                                            <Input value={selectedWHReceive.releaseNo} readOnly className="bg-muted" />
                                        </div>
                                        <div>
                                            <Label>Release Date</Label>
                                            <Input value={formatDate(selectedWHReceive.releaseDate)} readOnly className="bg-muted" />
                                        </div>
                                        <div>
                                            <Label>MR No</Label>
                                            <Input value={selectedWHReceive.mrNo} readOnly className="bg-muted" />
                                        </div>
                                        <div>
                                            <Label>Operation</Label>
                                            <Input value={selectedWHReceive.operation} readOnly className="bg-muted" />
                                        </div>
                                        <div>
                                            <Label>Work Center</Label>
                                            <Input value={selectedWHReceive.workCenter} readOnly className="bg-muted" />
                                        </div>
                                        <div>
                                            <Label>Warehouse</Label>
                                            <Input value={selectedWHReceive.warehouse} readOnly className="bg-muted" />
                                        </div>
                                        <div>
                                            <Label>Released By</Label>
                                            <Input value={selectedWHReceive.releasedBy} readOnly className="bg-muted" />
                                        </div>
                                        <div>
                                            <Label>QC Verified By</Label>
                                            <Input value={selectedWHReceive.qcVerifiedBy} readOnly className="bg-muted" />
                                        </div>
                                        <div>
                                            <Label>QC Verified On</Label>
                                            <Input value={formatDate(selectedWHReceive.qcVerifiedOn)} readOnly className="bg-muted" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Items Table */}
                            <Card>
                                <CardContent className="pt-6">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Items</h3>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                    <TableHead className="text-[10px] uppercase font-bold">Item Name</TableHead>
                                                    <TableHead className="text-[10px] uppercase font-bold">UOM</TableHead>
                                                    <TableHead className="text-[10px] uppercase font-bold text-right">Release Qty</TableHead>
                                                    <TableHead className="text-[10px] uppercase font-bold">Remarks</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedWHReceive.items.map((item) => (
                                                    <TableRow key={item.id}>
                                                        <TableCell className="font-medium">{item.itemName}</TableCell>
                                                        <TableCell>{item.uom}</TableCell>
                                                        <TableCell className="text-right font-medium">{item.releaseQty}</TableCell>
                                                        <TableCell className="text-muted-foreground">{item.remarks || "-"}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Summary */}
                                    <div className="mt-4 flex justify-end">
                                        <div className="bg-muted/20 p-4 rounded-lg border space-y-2 min-w-[250px]">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Total Items:</span>
                                                <span className="font-semibold">{selectedWHReceive.items.length}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Total Qty:</span>
                                                <span className="font-semibold">{selectedWHReceive.items.reduce((sum, item) => sum + item.releaseQty, 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Footer Actions */}
                        <DialogFooter className="border-t pt-4">
                            <div className="flex justify-end gap-2 w-full">
                                <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                                    Close
                                </Button>
                                {selectedWHReceive.status === "Pending Receipt" && (
                                    <Button onClick={handleMarkAsReceived}>
                                        Mark as Received
                                    </Button>
                                )}
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
