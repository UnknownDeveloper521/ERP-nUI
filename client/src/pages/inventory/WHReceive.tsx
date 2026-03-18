import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { 
  mockReleaseRecords, 
  updateReleaseRecord, 
  OperationRelease, 
  ProducedItem 
} from "@/lib/releaseSharedData";

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

// WHReceive interfaces are replaced by OperationRelease and ProducedItem from shared data


// ============================================================================
// MOCK DATA
// ============================================================================

// MOCK_WH_RECEIVE is replaced by mockReleaseRecords from shared data


const WAREHOUSES = ["Jinja WH"];
const WORK_CENTERS = ["Lead Furnace Center", "Plastic Casing Center", "Grid Generation Center", "Assembly Line"];

// Local SearchableSelect removed in favor of shared component

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WHReceive() {
    const { toast } = useToast();

    const [whReceives, setWhReceives] = useState<OperationRelease[]>(mockReleaseRecords);
    const [searchTerm, setSearchTerm] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState("all");
    const [workCenterFilter, setWorkCenterFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("Issued to Warehouse"); // Default to Issued to Warehouse
    const [currentPage, setCurrentPage] = useState(1);
    // Pagination state - using DataTablePagination component
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Modal State
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedWHReceive, setSelectedWHReceive] = useState<OperationRelease | null>(null);

    // Filter Logic
    const filteredWHReceives = whReceives.filter(whr => {
        const matchesSearch = whr.releaseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            whr.operation.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesWarehouse = warehouseFilter === "all" || whr.warehouse === warehouseFilter;
        const matchesWorkCenter = workCenterFilter === "all" || whr.workCenter === workCenterFilter;
        const matchesStatus = statusFilter === "all" || whr.status === statusFilter;

        return matchesSearch && matchesWarehouse && matchesWorkCenter && matchesStatus;
    });

    const totalPages = Math.ceil(filteredWHReceives.length / itemsPerPage);
    const paginatedWHReceives = filteredWHReceives.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Auto-adjust page when data changes
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredWHReceives.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter]);

    // Handlers
    const handleView = (whr: OperationRelease) => {
        setSelectedWHReceive({ ...whr });
        setIsViewModalOpen(true);
    };

    const handleItemCheckChange = (itemId: number, checked: boolean) => {
        // Not implemented in the new item-wise grouping logic but kept for type compatibility
    };

    const handleItemQtyChange = (itemId: number, qty: number) => {
        // Not implemented in the new item-wise grouping logic but kept for type compatibility
    };

    /**
     * Mark as Received Handler
     * - Updates stock in warehouse
     * - Creates material ledger entry
     * - Updates status to Received
     */
    const handleMarkAsReceived = () => {
        if (!selectedWHReceive) return;

        // Update status in shared storage
        setWhReceives(updateReleaseRecord(selectedWHReceive.id, { status: "Received By Warehouse" }));

        // TODO: In real implementation:
        // 1. Increase stock in warehouse for each item by receivedQty
        // 2. Create Material Ledger entries:
        //    - Ref Type = "WH Receive"
        //    - Ref No = releaseNo
        //    - In Qty = receivedQty for each item
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
            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: setSearchTerm,
                    placeholder: "Search Release No, Operation, Work Center..."
                }}
                filters={[
                    {
                        type: 'select',
                        label: 'Work Center',
                        value: workCenterFilter,
                        options: [{ label: "All Work Centers", value: "all" }, ...WORK_CENTERS],
                        onChange: setWorkCenterFilter,
                        searchable: true
                    },
                    {
                        type: 'select',
                        label: 'Warehouse',
                        value: warehouseFilter,
                        options: [{ label: "All Warehouses", value: "all" }, ...WAREHOUSES],
                        onChange: setWarehouseFilter,
                        searchable: true
                    },
                    {
                        type: 'select',
                        label: 'Status',
                        value: statusFilter,
                        options: [{ label: "All Status", value: "all" }, "Issued to Warehouse", "Received By Warehouse"],
                        onChange: setStatusFilter,
                        searchable: true
                    }
                ]}
            />

            {/* Listing Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">RELEASE NO</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">RELEASE DATE</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">OPERATION</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">WORK CENTER</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">WAREHOUSE</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">STATUS</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedWHReceives.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No warehouse receipts found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedWHReceives.map((whr) => (
                                        <TableRow key={whr.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="py-4 font-medium text-primary">{whr.releaseNo}</TableCell>
                                            <TableCell>{formatDate(whr.releaseDate)}</TableCell>
                                            <TableCell>{whr.operation}</TableCell>
                                            <TableCell>{whr.workCenter}</TableCell>
                                            <TableCell>{whr.warehouse}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "font-medium whitespace-nowrap w-fit px-2.5 py-0.5",
                                                        whr.status === "Issued to Warehouse" && "border-amber-500 text-amber-600 bg-amber-50",
                                                        whr.status === "Received By Warehouse" && "border-green-500 text-green-600 bg-green-50"
                                                    )}
                                                >
                                                    {whr.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <TableActionButtons
                                                    onView={() => handleView(whr)}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {/* Pagination - using standardized DataTablePagination component */}
                    {filteredWHReceives.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredWHReceives.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
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
                                            <Input value={selectedWHReceive.qcVerifiedBy || 'N/A'} readOnly className="bg-muted" />
                                        </div>
                                        <div>
                                            <Label>QC Verified On</Label>
                                            <Input value={selectedWHReceive.qcVerifiedOn ? formatDate(selectedWHReceive.qcVerifiedOn) : 'N/A'} readOnly className="bg-muted" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Items Table - Item-wise View */}
                            {/* ✅ CHANGED: WH Receive - replaced batch-wise table with item-wise (Item + Qty) table only */}
                            {/* ✅ NOTE: Frontend-only grouping; header/footer unchanged; no backend changes */}
                            {/* ✅ CHANGED: Removed Check and Qty columns, Received Qty auto-filled and read-only */}
                            <Card>
                                <CardContent className="pt-6">

                                    {(() => {
                                        // ✅ ADDED: Group items by itemName (frontend-only grouping)
                                        try {
                                            const itemsMap = new Map<string, {
                                                itemCode: string;
                                                itemName: string;
                                                uom: string;
                                                qtyProduced: number;
                                            }>();

                                            selectedWHReceive.items.forEach(item => {
                                                const key = `${item.itemCode}-${item.itemName}-${item.uom}`;
                                                if (itemsMap.has(key)) {
                                                    const existing = itemsMap.get(key)!;
                                                    existing.qtyProduced += item.qtyProduced;
                                                } else {
                                                    itemsMap.set(key, {
                                                        itemCode: item.itemCode,
                                                        itemName: item.itemName,
                                                        uom: item.uom,
                                                        qtyProduced: item.qtyProduced,
                                                    });
                                                }
                                            });

                                            const groupedItems = Array.from(itemsMap.values());


                                            if (groupedItems.length === 0) {
                                                // ✅ FALLBACK: If item-wise data missing, show existing batch table to avoid blank UI
                                                return (
                                                    <div className="text-center py-8 text-muted-foreground border rounded-md">
                                                        No items available
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="rounded-md border">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                                <TableHead className="text-[10px] uppercase font-bold pl-4">Item</TableHead>
                                                                <TableHead className="text-[10px] uppercase font-bold">UOM</TableHead>
                                                                <TableHead className="text-[10px] uppercase font-bold text-right pr-4">Received Qty</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {groupedItems.map((groupedItem, index) => (
                                                                <TableRow key={index}>
                                                                    <TableCell className="py-3 pl-4">
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold text-xs text-primary">{groupedItem.itemCode}</span>
                                                                            <span className="text-[10px] text-slate-500 font-medium">{groupedItem.itemName}</span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-xs">{groupedItem.uom}</TableCell>
                                                                    <TableCell className="text-right font-bold text-xs text-primary pr-4">{groupedItem.qtyProduced}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            );
                                        } catch (error) {
                                            console.error("Error grouping items:", error);
                                            return (
                                                <div className="rounded-md border p-4">
                                                    <p className="text-sm text-amber-600 mb-4">⚠️ Item-wise view not available</p>
                                                </div>
                                            );
                                        }
                                    })()}

                                    {/* Summary */}
                                    {/* ✅ CHANGED: Removed "Total Op Qty" from summary */}
                                    <div className="mt-4 flex justify-end">
                                        <div className="bg-muted/20 p-4 rounded-lg border space-y-2 min-w-[250px]">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Total Items:</span>
                                                <span className="font-semibold">{selectedWHReceive.items.length}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Total Received Qty:</span>
                                                <span className="font-semibold text-primary">{selectedWHReceive.items.reduce((sum, item) => sum + item.qtyProduced, 0)}</span>
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
                                {selectedWHReceive.status === "Issued to Warehouse" && (
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
