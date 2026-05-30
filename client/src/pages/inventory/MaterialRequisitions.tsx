// ============================================================================
// INVENTORY SMR REQUESTS MODULE
// Service Material Request listing and management for Inventory
// Connected to Service Center SMR module via shared data store
// ============================================================================

import React, { useState } from "react";
import { useCommonStore } from "@/store/commonStore";
import { format, parse } from "date-fns";
import { inventoryApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    X,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Calendar as CalendarIcon,
    Pencil,
    Edit,
    Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "../Unauthorized";
import { cn } from "@/lib/utils";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker } from "@/components/shared/DatePicker";

// Import shared SMR data and types
import {
    type SMRStatus,
    type SMRItem,
    type SMRRequest,
    mockSMRRequests,
    updateSMRRequest
} from "@/lib/smrSharedData";
import { mockWarehouses } from "@/lib/masterMockData";
const mockDepartments = ["Production", "Maintenance", "Quality", "Operations"];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get status badge with appropriate styling based on SMR status
 * @param status - The SMR status
 * @returns Badge component with appropriate styling
 */
const getStatusBadge = (statusStr: string) => {
    const status = (statusStr || "").toLowerCase();
    
    if (status.includes("requested")) {
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-none px-3 font-bold">Requested Req.</Badge>;
    }
    if (status.includes("issued")) {
        return <Badge className="bg-orange-600 hover:bg-orange-700 text-white border-none px-3 font-bold">Issued Req. by WH</Badge>;
    }
    if (status.includes("received")) {
        return <Badge className="bg-green-600 hover:bg-green-700 text-white border-none px-3 font-bold">Received Req. by SC</Badge>;
    }
    return <Badge variant="outline" className="font-bold">{statusStr}</Badge>;
};



// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Inventory SMR Requests Component
 * Displays and manages Service Material Requests in the Inventory module
 */

const INVENTORY_SMR_MODULE = "Inventory:Material Requisitions";

export default function InventorySMRRequests() {
    const { toast } = useToast();
    const { isMenuVisible, canView, canEdit } = useHasPermission();
    const hasModuleAccess = isMenuVisible(INVENTORY_SMR_MODULE);

    // ========================================================================
    // STATE MANAGEMENT
    // ========================================================================

    const smrStatuses = useCommonStore(state => state.smrStatuses);
    const [smrRequests, setSmrRequests] = useState<SMRRequest[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Default filter status: "Requested Req." or similar from store
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isListLoading, setIsListLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<"view" | "edit" | "issue" | null>(null);

    // QR Scanning state: Map of ItemID -> Array of SerialNumbers
    const [scannedSerialsPerItem, setScannedSerialsPerItem] = useState<Record<string | number, string[]>>({});
    const [activeScanItem, setActiveScanItem] = useState<string | number | "">("");
    const [scanInputValue, setScanInputValue] = useState("");

    // Modal states
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingRequest, setViewingRequest] = useState<SMRRequest | null>(null);
    const [isReadOnly, setIsReadOnly] = useState(true);
    const [scanError, setScanError] = useState<string | null>(null);
    const [hasSetDefault, setHasSetDefault] = useState(false);

    // Fetch SMR requests from API
    const fetchSMRRequests = async (page: number) => {
        try {
            setIsListLoading(true);
            const params = {
                page,
                limit: itemsPerPage,
                text_search: searchTerm,
                date: dateFilter ? format(dateFilter, "yyyy-MM-dd") : undefined,
                status: filterStatus === "all" ? undefined : filterStatus
            };

            const response = await inventoryApi.getInventorySMRList(params);
            if (response.isSuccessful && response.data) {
                // Map API records to SMRRequest interface
                const mappedData: SMRRequest[] = response.data.records
                    .filter((rec: any) => !(rec.status_name || "").toLowerCase().includes("draft"))
                    .map((rec: any) => ({
                        id: rec.id,
                        smrNo: rec.requisition_code,
                        smrRequestDate: format(parse(rec.request_date, "yyyy-MM-dd", new Date()), "dd-MM-yyyy"),
                        location: rec.location_name || "",
                        workCenter: rec.workcenter_name || "",
                        department: rec.department_name || "",
                        status: rec.status_name,
                        items: [] // Items will be fetched by ID when editing/viewing
                    }));

                setSmrRequests(mappedData);
                setTotalRecords(response.data.pagination["total records"] || response.data.pagination.total_records || 0);
            }
        } catch (error) {
            console.error("Error fetching inventory SMR list:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load requisitions." });
        } finally {
            setIsListLoading(false);
        }
    };

    // Consolidated fetch effect with debounce
    React.useEffect(() => {
        const timer = setTimeout(() => {
            fetchSMRRequests(currentPage);
        }, 500);
        return () => clearTimeout(timer);
    }, [currentPage, itemsPerPage, filterStatus, dateFilter, searchTerm]);

    // Set default filter status to "Requested Req." when statuses are loaded from store (only once)
    React.useEffect(() => {
        if (!hasSetDefault && smrStatuses && smrStatuses.length > 0) {
            const requestedStatus = smrStatuses.find(s => 
                (s.name || "").toLowerCase().includes("requested") || 
                s.code === "REQUESTED_REQ" ||
                s.value_code === "REQUESTED_REQ"
            );
            if (requestedStatus) {
                setFilterStatus(String(requestedStatus.id));
            }
            setHasSetDefault(true);
        }
    }, [smrStatuses, hasSetDefault]);

    // Pagination calculations
    const totalPages = Math.ceil(totalRecords / itemsPerPage);
    const paginatedData = smrRequests;

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, dateFilter]);

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Handler for viewing SMR request details (Read-only)
     */
    const handleView = async (request: SMRRequest) => {
        setIsReadOnly(true);
        try {
            setActionLoading("view");
            const [reqRes, itemsRes] = await Promise.all([
                inventoryApi.getMaterialRequisitionById(request.id),
                inventoryApi.getItemsForSMR(request.id)
            ]);

            if (reqRes.isSuccessful && reqRes.data) {
                const data = reqRes.data;
                const itemsData = itemsRes.isSuccessful && itemsRes.data ? itemsRes.data.records : (data.items || []);
                
                const mappedRequest: SMRRequest = {
                    ...request,
                    smrNo: data.requisition_code || data.smr_no || request.smrNo,
                    workCenter: data.workcenter_name || data.work_center_name || request.workCenter,
                    department: data.department_name || data.dept_name || request.department,
                    requestedBy: data.requested_by || data.requested_by_name,
                    status: data.status_name || data.status || request.status,
                    items: (itemsData || []).map((item: any) => ({
                        id: item.service_material_requisition_item_id || item.item_id || item.id,
                        service_material_requisition_item_id: item.service_material_requisition_item_id || item.item_id || item.id,
                        item_id: item.item_id,
                        itemCode: item.item_code || item.item_no,
                        itemName: item.item_name || item.name,
                        uom: item.uom || "NOS",
                        availableStock: item.avail_qty || item.available_qty || item.stock || 0,
                        qtyNeeded: item.req_qty || item.requested_qty || item.quantity || item.required_qty || 0,
                        requestedQty: item.req_qty || item.requested_qty || item.quantity || item.required_qty || 0,
                        issueQty: item.issue_qty || item.issued_qty || 0,
                        type: "SFG",
                        serialNumbers: item.serials ? item.serials.map((s: any) => s.serial_number || s) : []
                    }))
                };
                
                setViewingRequest(mappedRequest);
                
                const initialSerials: Record<string | number, string[]> = {};
                mappedRequest.items.forEach(item => {
                    if (item.serialNumbers && item.serialNumbers.length > 0) {
                        initialSerials[item.id] = item.serialNumbers;
                    }
                });
                setScannedSerialsPerItem(initialSerials);
                setIsViewModalOpen(true);
            }
        } catch (error) {
            console.error("Error fetching requisition details:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load requisition details." });
        } finally {
            setActionLoading(null);
        }
    };

    /**
     * Handler for editing SMR request details (Processing/Issuing)
     */
    const handleEdit = async (request: SMRRequest) => {
        setIsReadOnly(false);
        try {
            setActionLoading("edit");
            const [reqRes, itemsRes] = await Promise.all([
                inventoryApi.getMaterialRequisitionById(request.id),
                inventoryApi.getItemsForSMR(request.id)
            ]);

            if (reqRes.isSuccessful && reqRes.data) {
                const data = reqRes.data;
                const itemsData = itemsRes.isSuccessful && itemsRes.data ? itemsRes.data.records : (data.items || []);

                const mappedRequest: SMRRequest = {
                    ...request,
                    smrNo: data.requisition_code || data.smr_no || request.smrNo,
                    workCenter: data.workcenter_name || data.work_center_name || request.workCenter,
                    department: data.department_name || data.dept_name || request.department,
                    requestedBy: data.requested_by || data.requested_by_name,
                    status: data.status_name || data.status || request.status,
                    items: (itemsData || []).map((item: any) => ({
                        id: item.service_material_requisition_item_id || item.item_id || item.id,
                        service_material_requisition_item_id: item.service_material_requisition_item_id || item.item_id || item.id,
                        item_id: item.item_id,
                        itemCode: item.item_code || item.item_no,
                        itemName: item.item_name || item.name,
                        uom: item.uom || "NOS",
                        availableStock: item.avail_qty || item.available_qty || item.stock || 0,
                        qtyNeeded: item.req_qty || item.requested_qty || item.quantity || item.required_qty || 0,
                        requestedQty: item.req_qty || item.requested_qty || item.quantity || item.required_qty || 0,
                        issueQty: item.issue_qty || item.issued_qty || item.req_qty || item.requested_qty || item.quantity || item.required_qty || 0,
                        type: "SFG",
                        serialNumbers: []
                    }))
                };

                setViewingRequest(mappedRequest);
                setScannedSerialsPerItem({});
                setIsViewModalOpen(true);
            }
        } catch (error) {
            console.error("Error fetching requisition details for edit:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load requisition details." });
        } finally {
            setActionLoading(null);
        }
    };

    /**
     * Handler for changing issue quantity for an item
     * Validates that issue qty doesn't exceed available or requested qty
     * @param itemId - The item ID
     * @param value - The new issue quantity value
     */
    const handleIssueQtyChange = (itemId: number | string, value: string) => {
        if (!viewingRequest) return;

        // Remove non-numeric characters except decimal point
        const numericValue = value.replace(/[^0-9.]/g, '');

        // Check if value exceeds 5 digits (before decimal point)
        const integerPart = numericValue.split('.')[0];
        if (integerPart.length > 5) {
            return; // Prevent update if exceeds max length
        }

        const qty = parseFloat(numericValue) || 0;
        setViewingRequest({
            ...viewingRequest,
            items: viewingRequest.items.map(item =>
                item.id === itemId ? { ...item, issueQty: qty } : item
            )
        });
    };

    /**
     * Handler for issuing items
     * Validates issue quantities and updates status to "Issued SMR by WH"
     */
    const handleIssueItems = async () => {
        if (!viewingRequest) return;

        // Validation: Ensure scanned serials match issue quantity for FG items
        const scanErrors: string[] = [];
        viewingRequest.items.forEach(item => {
            const issueQty = item.issueQty || 0;
            const serialsCount = scannedSerialsPerItem[item.id]?.length || 0;

            // If scanning is done, it should match the issue quantity
            if (serialsCount > issueQty) {
                scanErrors.push(`${item.itemName}: Scanned serials (${serialsCount}) exceed issue quantity (${issueQty})`);
            }
        });

        if (scanErrors.length > 0) {
            toast({
                title: "Scanning Error",
                description: scanErrors.join(", "),
                variant: "destructive"
            });
            return;
        }

        // Validation: Check if at least one item has issue qty > 0
        const hasItemsToIssue = viewingRequest.items.some(item => (item.issueQty || 0) > 0);
        if (!hasItemsToIssue) {
            toast({
                title: "Validation Error",
                description: "At least one item must be issued.",
                variant: "destructive"
            });
            return;
        }

        // Validation: Check if any issue qty exceeds available or requested qty
        const invalidItems = viewingRequest.items.filter(item => {
            const issueQty = item.issueQty || 0;
            const availableQty = item.availableStock || 0;
            const requestedQty = item.requestedQty || item.qtyNeeded || 0;
            return issueQty > availableQty || issueQty > requestedQty;
        });

        if (invalidItems.length > 0) {
            toast({
                title: "Validation Error",
                description: "Issue quantity cannot exceed available or requested quantity.",
                variant: "destructive"
            });
            return;
        }

        try {
            setActionLoading("issue");
            
            // Prepare payload according to backend requirement
            const payload = {
                service_material_requisition_id: viewingRequest.id,
                status_code: "ISSUE REQ",
                items: viewingRequest.items.map(item => ({
                    service_material_requisition_item_id: item.service_material_requisition_item_id,
                    item_id: item.item_id,
                    issued_qty: item.issueQty || 0,
                    serial_numbers: (scannedSerialsPerItem[item.id] || []).map(s => ({
                        serial_number: s
                    }))
                }))
            };

            const response = await inventoryApi.updateMaterialRequisition(payload);

            if (response.isSuccessful) {
                toast({
                    variant: "success",
                    title: "Success",
                    description: response.message || `Items for ${viewingRequest.smrNo} have been issued successfully.`,
                });
                setIsViewModalOpen(false);
                setViewingRequest(null);
                fetchSMRRequests(currentPage);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: response.message || "Failed to issue items."
                });
            }
        } catch (error: any) {
            console.error("Error issuing items:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "An unexpected error occurred."
            });
        } finally {
            setActionLoading(null);
        }
    };

    // ========================================================================
    // RENDER: DETAIL POPUP
    // ========================================================================

    /**
     * Renders the detail popup based on SMR status
     * - Requested SMR: Shows issue form with editable issue quantities
     * - Issued SMR by WH: Shows read-only issued quantities
     * - Received SMR by SC: Shows read-only issued quantities
     */
    const renderDetailPopup = () => {
        if (!viewingRequest) return null;

        const isRequestedStatus = ((viewingRequest.status || "").toLowerCase().includes("requested")) && !isReadOnly;
        const isIssuedStatus = (viewingRequest.status || "").toLowerCase().includes("issued");

        const handleScanKeyDown = (itemId: string | number, e: React.KeyboardEvent) => {
            if (e.key === "Enter" && scanInputValue.trim()) {
                e.preventDefault();
                const serial = scanInputValue.trim();
                const currentSerials = scannedSerialsPerItem[itemId] || [];

                const targetItem = viewingRequest.items.find(i => i.id.toString() === itemId.toString());
                const targetQty = targetItem?.issueQty || 0;

                setScanError(null);

                if (currentSerials.includes(serial)) {
                    setScanError("This serial number has already been scanned.");
                } else if (currentSerials.length >= targetQty) {
                    setScanError(`Limit reached: You have already scanned ${targetQty} items.`);
                } else {
                    setScannedSerialsPerItem(prev => ({
                        ...prev,
                        [itemId]: [...currentSerials, serial]
                    }));
                    setScanInputValue("");
                }
            }
        };

        return (
            <Dialog open={isViewModalOpen} onOpenChange={(open) => {
                setIsViewModalOpen(open);
                if (!open) fetchSMRRequests(currentPage);
            }}>
                <DialogContent 
                    className="w-[95%] sm:max-w-3xl md:max-w-5xl xl:max-w-6xl max-h-[82vh] flex flex-col p-0 overflow-hidden"
                    onInteractOutside={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 border-b bg-white px-6 py-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-2xl font-bold">
                                    Material Requisition: {viewingRequest.smrNo}
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    {isRequestedStatus ? "Issue materials for this requisition" : "View material requisition details"}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* SMR INFORMATION - Horizontal Layout */}
                    <div className="shrink-0 border-b bg-slate-50/50 px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">SMR No</Label>
                                <p className="text-sm font-semibold">{viewingRequest.smrNo}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Request Date</Label>
                                <p className="text-sm font-semibold">{format(parse(viewingRequest.smrRequestDate, 'dd-MM-yyyy', new Date()), "dd/MM/yyyy")}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Work Center</Label>
                                <p className="text-sm font-semibold truncate" title={viewingRequest.workCenter}>{viewingRequest.workCenter}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Department</Label>
                                <p className="text-sm font-semibold truncate" title={viewingRequest.department}>{viewingRequest.department}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Requested By</Label>
                                <p className="text-sm font-semibold">{viewingRequest.requestedBy}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">Status</Label>
                                <div className="block">{getStatusBadge(viewingRequest.status)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-6">
                        {/* Global Scanning Section - only for Requested Req. status */}
                        {isRequestedStatus && (
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 shadow-sm transition-all animate-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-12 gap-6">
                                    <div className="col-span-12 md:col-span-4">
                                        <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Select Item to Scan</Label>
                                        <SearchableSelect
                                            placeholder="Choose an item..."
                                            value={activeScanItem ? String(activeScanItem) : ""}
                                            options={viewingRequest.items.map((item) => ({
                                                label: `${item.itemName} ${item.itemCode}`.trim(),
                                                value: String(item.id),
                                                primaryText: String(item.itemName || "").trim(),
                                                secondaryText: String(item.itemCode || "").trim(),
                                            }))}
                                            onChange={(v) => {
                                                setActiveScanItem(v);
                                                setScanInputValue("");
                                                setScanError(null);
                                            }}
                                            className="h-auto min-h-11 items-start! py-2 bg-white border-blue-200 shadow-sm focus-visible:ring-blue-500"
                                            selectedPrimaryLineClamp={2}
                                            compactStackedSelected
                                            showSelectedTitle
                                            selectedTruncate="end"
                                        />
                                    </div>

                                    <div className="col-span-12 md:col-span-5">
                                        <Label className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide flex items-center justify-between">
                                            <span>Scan or Type QR Code</span>
                                            {activeScanItem && (
                                                <span className="text-[10px] font-medium text-blue-600">
                                                    Target: {viewingRequest.items.find(i => i.id.toString() === activeScanItem.toString())?.issueQty || 0} NOS
                                                </span>
                                            )}
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                placeholder={activeScanItem ? "Scan serial number..." : "Select item first"}
                                                className="h-11 pr-20 bg-white border-blue-200 focus:ring-blue-500 shadow-sm"
                                                value={scanInputValue}
                                                onChange={(e) => {
                                                    setScanInputValue(e.target.value);
                                                    if (!e.target.value.trim()) {
                                                        setScanError(null);
                                                    }
                                                }}
                                                disabled={!activeScanItem}
                                                onKeyDown={(e) => activeScanItem && handleScanKeyDown(activeScanItem, e)}
                                            />
                                            {scanError && (
                                                <p className="text-[10px] font-bold text-destructive mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    {scanError}
                                                </p>
                                            )}
                                            <div className="absolute right-2 top-2 h-7 px-2 flex items-center justify-center bg-blue-50 rounded text-[10px] font-bold text-blue-500 border border-blue-100 uppercase tracking-tighter">
                                                Enter ↵
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-12 md:col-span-3">
                                        <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Scanned Counter</Label>
                                        <div className={cn(
                                            "h-11 flex items-center gap-3 px-4 rounded-xl border font-bold text-xs shadow-inner transition-all",
                                            activeScanItem && (scannedSerialsPerItem[activeScanItem]?.length || 0) > 0
                                                ? "bg-blue-100 text-blue-700 border-blue-200"
                                                : "bg-white text-slate-400 border-slate-200"
                                        )}>
                                            <div className="min-w-10 px-2 py-1 bg-blue-600 text-white rounded-lg flex items-center justify-center text-[10px]">
                                                {activeScanItem ? `${scannedSerialsPerItem[activeScanItem]?.length || 0} CODES` : "-"}
                                            </div>
                                            {activeScanItem && scannedSerialsPerItem[activeScanItem]?.length > 0 && (
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-[10px] text-blue-600 truncate italic">
                                                        Last: {scannedSerialsPerItem[activeScanItem][scannedSerialsPerItem[activeScanItem].length - 1]}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                                        <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Item</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-3 text-right">Req Qty</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-3 text-right text-primary">Avail Qty</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-3 text-right w-32 pr-4 text-blue-600">
                                            {isRequestedStatus ? "Issue Qty" : "Issued Qty"}
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {viewingRequest.items.map((item) => {
                                        const serialsCount = scannedSerialsPerItem[item.id]?.length || 0;
                                        return (
                                            <TableRow key={item.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                                <TableCell className="py-4 pl-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs text-primary">{item.itemCode}</span>
                                                        <span className="text-[10px] text-slate-500 font-medium">{item.itemName}</span>
                                                    </div>
                                                    {serialsCount > 0 && (
                                                        <Badge variant="outline" className="mt-1 h-4 px-1.5 text-[9px] border-blue-200 text-blue-600 bg-blue-50 w-fit">
                                                            {serialsCount} SCANNED
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-medium">{item.requestedQty || item.qtyNeeded} {item.uom}</TableCell>
                                                <TableCell className="text-right text-xs font-bold text-primary">{item.availableStock} {item.uom}</TableCell>
                                                <TableCell className="text-right py-2 pr-4">
                                                    {isRequestedStatus ? (
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            className="h-9 text-right text-xs font-bold px-2 w-24 ml-auto border-blue-100 focus:border-blue-300 focus:ring-blue-100"
                                                            value={item.issueQty || ""}
                                                            onChange={(e) => handleIssueQtyChange(item.id, e.target.value)}
                                                            placeholder="0"
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-bold text-blue-600">{item.issueQty || 0} {item.uom}</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t bg-slate-50/50 flex flex-row items-center justify-between gap-4">
                        <div className="flex-1">
                            {(isIssuedStatus || viewingRequest.status === "Received Req. by SC") && (
                                <p className="text-[11px] text-muted-foreground italic">
                                    Issued by {viewingRequest.issuedBy} on {viewingRequest.issuedDate ? format(parse(viewingRequest.issuedDate, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy") : "-"}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsViewModalOpen(false)}
                                className="px-6 h-11 font-bold"
                                disabled={actionLoading === "issue"}
                            >
                                Close
                            </Button>
                            {isRequestedStatus && canEdit(INVENTORY_SMR_MODULE) && (
                                <Button
                                    className="px-8 h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200"
                                    onClick={handleIssueItems}
                                    loading={actionLoading === "issue"}
                                    disabled={actionLoading === "issue"}
                                >
                                    Issue Items
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    // ========================================================================
    // RENDER: MAIN COMPONENT
    // ========================================================================

    if (!hasModuleAccess) {
        return <Unauthorized />;
    }

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500 overflow-visible">
            {/* Header */}
            <h1 className="text-3xl font-bold tracking-tight">Material Requisitions</h1>

            {/* Filter Section */}
            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: setSearchTerm,
                    placeholder: "Search by Req No, Work Center..."
                }}
                filters={[
                    {
                        type: 'date',
                        label: 'Date',
                        value: dateFilter,
                        onChange: setDateFilter
                    },
                    {
                        type: 'select',
                        label: 'Status',
                        value: filterStatus,
                        options: [
                            { label: "All Status", value: "all" },
                            ...(smrStatuses || [])
                                .filter(s => s?.name && !s.name.toLowerCase().includes("draft"))
                                .map(s => ({ label: s.name, value: String(s.id) }))
                        ],
                        onChange: setFilterStatus,
                        searchable: true
                    }
                ]}
            />

            {/* SMR Requests Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Req No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Request Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Work Center</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Department</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isListLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                Loading requisitions...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                            No Requisitions found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((request) => (
                                        <TableRow
                                            key={request.id}
                                            className="hover:bg-muted/30 transition-colors border-b last:border-none"
                                        >
                                            {/* SMR No */}
                                            <TableCell className="py-4 font-medium font-mono">
                                                {request.smrNo}
                                            </TableCell>

                                            {/* Request Date */}
                                            <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                {request.smrRequestDate}
                                            </TableCell>

                                            {/* Work Center */}
                                            <TableCell className="py-4 text-sm font-medium">
                                                {request.workCenter}
                                            </TableCell>

                                            {/* Department */}
                                            <TableCell className="py-4 text-sm font-medium">
                                                {request.department}
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell className="py-4 text-center">
                                                {getStatusBadge(request.status)}
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell className="py-4">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-slate-100"
                                                        onClick={() => handleView(request)}
                                                        title="View Details"
                                                        disabled={!canView(INVENTORY_SMR_MODULE) || actionLoading === "view" || actionLoading === "edit"}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {(request.status || "").toLowerCase().includes("requested") && canEdit(INVENTORY_SMR_MODULE) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-slate-100"
                                                            onClick={() => handleEdit(request)}
                                                            title="Process / Issue Items"
                                                            disabled={actionLoading === "view" || actionLoading === "edit"}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalRecords > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalRecords}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Detail Popup */}
            {renderDetailPopup()}
        </div>
    );
}
