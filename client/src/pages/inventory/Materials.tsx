import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
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
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandInputBorderless,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check, CalendarIcon, X, ChevronDown, Loader2 } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker } from "@/components/shared/DatePicker";
import { 
    type MRRequest, 
    type MRItem, 
    type MRStatus, 
} from "@/lib/mrSharedData";
import { format } from "date-fns";
import { commonApi, inventoryApi, productionApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { AlertCircle } from "lucide-react";
import WHReceive from "./WHReceive";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";

/** Green styling for successful actions; keep errors as destructive. */
const crudSuccessToast = {
    className:
        "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

/** Resolve PRODUCTION_MR_STATUS row for "Requested to Warehouse" (by label or code, not by hardcoded id). */
function getRequestedToWarehouseStatusId(mrStatuses: any[]): string | null {
    for (const s of mrStatuses) {
        const label = (s.value_name || s.name || "")?.toString().trim();
        const code = (s.value_code || s.code || "")?.toString().toUpperCase().replace(/\s+/g, "_");
        if (label === "Requested to Warehouse") return String(s.id);
        if (code === "REQUESTED_TO_WAREHOUSE") return String(s.id);
    }
    return null;
}

// ============================================================================
// DATE PICKER COMPONENT (Standardized)
// ============================================================================

// Local DatePicker and SearchableSelect removed in favor of shared components

/** Local view model for issue modal — extends MRRequest without shared type changes */
type MRDetailView = MRRequest & { operationCode?: string };

export default function Materials() {
    const { toast } = useToast();
    const [location, setLocation] = useLocation();
    const mrStatuses = useCommonStore((s) => s.mrStatuses);
    const defaultStatusAppliedRef = useRef(false);

    // Route matching for tabs
    const [matchMaterialRequests] = useRoute("/inventory/materials/material-requests");
    const [matchWHReceive] = useRoute("/inventory/materials/wh-receive");

    // Determine active tab based on route
    const [activeTab, setActiveTab] = useState("material-requests");
    const { isMenuVisible, canEdit } = useHasPermission();
    const permissionMR = "INVENTORY/MATERIALS/MATERIAL_REQUESTS";
    const permissionWH = "INVENTORY/MATERIALS/WH_RECEIVE";

    const canViewMaterialRequests = isMenuVisible(permissionMR);
    const canViewWHReceive = isMenuVisible(permissionWH);

    if (!canViewMaterialRequests && !canViewWHReceive) {
        return <Unauthorized />;
    }

    const defaultTab = canViewMaterialRequests ? "material-requests" : (canViewWHReceive ? "wh-receive" : null);

    // Redirect and handle route permissions
    useEffect(() => {
        // 1. If on base path, redirect to default authorized tab
        if (location === "/inventory/materials") {
            if (defaultTab) {
                setLocation(`/inventory/materials/${defaultTab}`);
            }
            return;
        }

        // 2. If on Material Requests route but no permission, redirect
        if (matchMaterialRequests && !canViewMaterialRequests) {
            if (defaultTab) {
                setLocation(`/inventory/materials/${defaultTab}`);
            }
            return;
        }

        // 3. If on WH Receive route but no permission, redirect
        if (matchWHReceive && !canViewWHReceive) {
            if (defaultTab) {
                setLocation(`/inventory/materials/${defaultTab}`);
            }
            return;
        }

        // 4. Update active tab based on authorized route
        if (matchMaterialRequests && canViewMaterialRequests) {
            setActiveTab("material-requests");
        } else if (matchWHReceive && canViewWHReceive) {
            setActiveTab("wh-receive");
        }
    }, [location, matchMaterialRequests, matchWHReceive, setLocation, defaultTab, canViewMaterialRequests, canViewWHReceive]);

    // Listing state (server-side list + filter IDs from common APIs)
    const [workCenters, setWorkCenters] = useState<{ id: number; name: string }[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [materialRequests, setMaterialRequests] = useState<MRRequest[]>([]);
    const [totalListRecords, setTotalListRecords] = useState(0);
    const [isListLoading, setIsListLoading] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [openingMRId, setOpeningMRId] = useState<number | null>(null);
    const [isIssueSubmitting, setIsIssueSubmitting] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [statusFilter, setStatusFilter] = useState("all");
    const [workCenterFilter, setWorkCenterFilter] = useState("all");
    const appliedWorkCenterFilterDefault = useRef(false);
    const appliedWarehouseFilterDefault = useRef(false);
    const [areListFiltersReady, setAreListFiltersReady] = useState(() => {
        const wc = getAssignedIds("workcenter");
        const wh = getAssignedIds("warehouse");
        return wc.length === 0 && wh.length === 0;
    });
    const [shiftFilter, setShiftFilter] = useState("all");
    const [warehouseFilter, setWarehouseFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);

    const assignedWorkcenterKey = getAssignedIds("workcenter").join(",");
    const assignedWarehouseKey = getAssignedIds("warehouse").join(",");

    const orderedWorkCenters = useMemo(
        () => prioritizeByAssigned(workCenters, getAssignedIds("workcenter"), (wc) => wc.id),
        [workCenters, assignedWorkcenterKey]
    );

    const orderedWarehouses = useMemo(
        () => prioritizeByAssigned(warehouses, getAssignedIds("warehouse"), (wh) => wh.id),
        [warehouses, assignedWarehouseKey]
    );

    // Modal state
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedMR, setSelectedMR] = useState<MRDetailView | null>(null);

    // Default status: Requested to Warehouse (once mrStatuses are loaded from common data)
    useEffect(() => {
        if (defaultStatusAppliedRef.current || !mrStatuses.length) return;
        const id = getRequestedToWarehouseStatusId(mrStatuses);
        if (id) setStatusFilter(id);
        defaultStatusAppliedRef.current = true;
    }, [mrStatuses]);

    const fetchMaterialRequests = useCallback(async () => {
        if (!matchMaterialRequests || !canViewMaterialRequests) return;
        if (!areListFiltersReady) return;
        setIsListLoading(true);
        try {
            const res = await inventoryApi.getMaterialRequestsList({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearchTerm.trim() || undefined,
                request_date: dateFilter ? format(dateFilter, "yyyy-MM-dd") : undefined,
                status_id: statusFilter !== "all" ? statusFilter : undefined,
                workcenter_id: workCenterFilter !== "all" ? workCenterFilter : undefined,
                shift_id: shiftFilter !== "all" ? shiftFilter : undefined,
                warehouse_id: warehouseFilter !== "all" ? warehouseFilter : undefined,
            });
            if (res.isSuccessful && res.data) {
                const list = (res.data.records || []).map((r): MRRequest => {
                    const mrKey = r.mr_id ?? (r as { id?: number }).id;
                    return {
                        id: Number(mrKey),
                        mrNo: r.mr_code,
                        date: r.request_date,
                        requiredByDate: r.request_date,
                        operation: r.operation_name,
                        workCenter: r.work_center_name,
                        warehouse: r.warehouse_name || "",
                        shift: r.shift_name,
                        requestedBy: r.requested_by_name?.trim() || r.requested_by,
                        status: r.status_name as MRStatus,
                        items: [],
                    };
                });
                setMaterialRequests(list);
                setTotalListRecords(res.data.pagination?.totalRecords ?? list.length);
            } else {
                setMaterialRequests([]);
                setTotalListRecords(0);
            }
        } catch (e) {
            console.error("getMaterialRequestsList", e);
            toast({ variant: "destructive", title: "Error", description: "Failed to load material requests" });
            setMaterialRequests([]);
            setTotalListRecords(0);
        } finally {
            setIsListLoading(false);
        }
    }, [
        matchMaterialRequests,
        currentPage,
        itemsPerPage,
        debouncedSearchTerm,
        dateFilter,
        statusFilter,
        workCenterFilter,
        shiftFilter,
        warehouseFilter,
        areListFiltersReady,
        toast,
    ]);

    // Work centers: common API + assigned dropdown (inventory Materials listing filter)
    useEffect(() => {
        (async () => {
            const assignedWorkcenterIds = getAssignedIds("workcenter");
            const assignedWarehouseIds = getAssignedIds("warehouse");
            try {
                const [wcRes, shRes, whRes] = await Promise.all([
                    commonApi.getWorkCenters(),
                    productionApi.getShiftForProduction(),
                    commonApi.getWarehouses(),
                ]);
                let workCenterRecords: { id: number; name: string }[] = [];
                if (wcRes.isSuccessful && wcRes.data?.records) {
                    workCenterRecords = wcRes.data.records.map((r: any) => ({
                        id: r.id ?? r.work_center_id,
                        name: r.work_center_name || r.name || r.value_name,
                    }));
                    setWorkCenters(workCenterRecords);

                    if (
                        !appliedWorkCenterFilterDefault.current &&
                        assignedWorkcenterIds.length > 0 &&
                        workCenterRecords.length > 0
                    ) {
                        const ordered = prioritizeByAssigned(
                            workCenterRecords,
                            assignedWorkcenterIds,
                            (wc) => wc.id
                        );
                        const firstAssigned = getFirstAssignedMatch(
                            assignedWorkcenterIds,
                            ordered.map((wc) => wc.id)
                        );
                        if (firstAssigned) {
                            setWorkCenterFilter(String(firstAssigned));
                            appliedWorkCenterFilterDefault.current = true;
                        }
                    }
                }
                if ((shRes as any).data?.records) {
                    setShifts((shRes as any).data.records);
                }
                if (whRes.isSuccessful && whRes.data?.records) {
                    const warehouseRecords = whRes.data.records.map((r: any) => ({
                        id: r.warehouse_id ?? r.id,
                        name: r.warehouse_name || r.name || r.value_name,
                    }));
                    setWarehouses(warehouseRecords);

                    if (
                        !appliedWarehouseFilterDefault.current &&
                        assignedWarehouseIds.length > 0 &&
                        warehouseRecords.length > 0
                    ) {
                        const ordered = prioritizeByAssigned<{ id: number; name: string }>(
                            warehouseRecords,
                            assignedWarehouseIds,
                            (wh) => wh.id
                        );
                        const firstAssigned = getFirstAssignedMatch(
                            assignedWarehouseIds,
                            ordered.map((wh) => wh.id)
                        );
                        if (firstAssigned) {
                            setWarehouseFilter(String(firstAssigned));
                            appliedWarehouseFilterDefault.current = true;
                        }
                    }
                }
            } catch (e) {
                console.error("Materials dropdown load", e);
            } finally {
                setAreListFiltersReady(true);
            }
        })();
    }, []);

    useEffect(() => {
        void fetchMaterialRequests();
    }, [fetchMaterialRequests]);

    const totalPages = totalListRecords > 0 ? Math.ceil(totalListRecords / itemsPerPage) : 0;
    const paginatedRequests = materialRequests;

    // Auto-adjust page when data changes
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalListRecords, currentPage, totalPages]);

    // Reset to page 1 when filters or page size change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, statusFilter, workCenterFilter, shiftFilter, warehouseFilter, dateFilter, itemsPerPage]);

    const handleOpenDetail = async (mr: MRRequest) => {
        const id = Number(mr?.id);
        if (!Number.isFinite(id) || id <= 0) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Invalid material request id. Refresh the list and try again.",
            });
            return;
        }
        if (isListLoading || openingMRId !== null || isIssueSubmitting) return;

        setOpeningMRId(id);
        setIsDetailLoading(true);
        setIsViewModalOpen(true);
        setSelectedMR(null);
        try {
            const res = await inventoryApi.getMaterialRequestById(id);
            if (!res.isSuccessful || !res.data) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: res.message || "Failed to load material request",
                });
                setIsViewModalOpen(false);
                return;
            }
            const d = res.data;
            const detail = d as typeof d & { operation_code?: string };
            setSelectedMR({
                id: d.id,
                mrNo: d.mr_code,
                date: d.request_date,
                requiredByDate: d.request_date,
                operation: d.operation_name,
                operationCode: detail.operation_code?.trim() || undefined,
                workCenter: d.work_center_name,
                warehouse: d.warehouse_name,
                shift: d.shift_name,
                requestedBy: d.requested_by_name?.trim() || d.requested_by,
                status: d.status_name as MRStatus,
                items: (d.items || []).map(
                    (it) =>
                        ({
                            id: it.id ?? it.item_id,
                            itemCode: it.item_code,
                            itemName: it.item_name,
                            uom: it.uom,
                            availableQty: it.available_qty,
                            requiredQty: it.required_qty,
                            issuedQty: it.issued_qty,
                        }) as MRItem,
                ),
            });
        } catch (e) {
            console.error("getMaterialRequestById", e);
            toast({ variant: "destructive", title: "Error", description: "Failed to load material request" });
            setIsViewModalOpen(false);
        } finally {
            setIsDetailLoading(false);
            setOpeningMRId(null);
        }
    };

    const handleIssueQtyChange = (itemId: any, value: string) => {
        if (!selectedMR) return;

        // Remove non-numeric characters except decimal point
        const numericValue = value.replace(/[^0-9.]/g, '');

        // Check if value exceeds 5 digits (before decimal point)
        const integerPart = numericValue.split('.')[0];
        if (integerPart.length > 5) {
            return; // Prevent update if exceeds max length
        }

        const qty = parseFloat(numericValue) || 0;
        setSelectedMR({
            ...selectedMR,
            items: selectedMR.items.map(item =>
                item.id === itemId ? { ...item, issuedQty: qty } : item
            )
        });
    };

    const handleIssueItems = async () => {
        if (!selectedMR || isIssueSubmitting) return;
        const mrId = Number(selectedMR.id);
        if (!Number.isFinite(mrId) || mrId <= 0) {
            toast({ variant: "destructive", title: "Error", description: "Invalid material request." });
            return;
        }
        if (!selectedMR.items.length) {
            toast({ variant: "destructive", title: "Error", description: "No line items to issue." });
            return;
        }
        const items = selectedMR.items
            .map((item) => {
                const lineId = Number(item.id);
                const issue_qty = parseFloat(String(item.issuedQty ?? 0)) || 0;
                return { id: lineId, issue_qty };
            })
            .filter((row) => Number.isFinite(row.id) && row.id > 0);
        if (items.length === 0) {
            toast({ variant: "destructive", title: "Error", description: "Missing line ids for items." });
            return;
        }
        if (!items.some((row) => row.issue_qty > 0)) {
            toast({ variant: "destructive", title: "Error", description: "Enter an issue quantity greater than 0 for at least one line." });
            return;
        }

        setIsIssueSubmitting(true);
        try {
            const res = await inventoryApi.issueItems(mrId, { items });
            if (res.isSuccessful) {
                toast({
                    ...crudSuccessToast,
                    title: "Success",
                    description: res.message || `Items for ${selectedMR.mrNo} issued successfully.`,
                    duration: 15000,
                });
                setIsViewModalOpen(false);
                setSelectedMR(null);
                void fetchMaterialRequests();
            } else {
                toast({ variant: "destructive", title: "Error", description: res.message || "Failed to issue items" });
            }
        } catch (e: any) {
            console.error("issueItems", e);
            toast({ variant: "destructive", title: "Error", description: e?.message || "Failed to issue items" });
        } finally {
            setIsIssueSubmitting(false);
        }
    };

    // --------------------------------------------------------------------------
    // RENDER: LISTING VIEW
    // --------------------------------------------------------------------------

    const renderListing = () => {
        const isActionBusy = isListLoading || openingMRId !== null || isIssueSubmitting;

        return (
        <div className="flex flex-col gap-6">
            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: setSearchTerm,
                    placeholder: "Search MR No, Requested By..."
                }}
                filters={[
                    {
                        type: 'select',
                        label: 'Status',
                        value: statusFilter,
                        options: [
                            { label: "All Status", value: "all" },
                            ...mrStatuses.map((s) => ({
                                label: s.value_name || s.name,
                                value: String(s.id),
                            })),
                        ],
                        onChange: setStatusFilter,
                        searchable: true
                    },
                    {
                        type: 'select',
                        label: 'Work Center',
                        value: workCenterFilter,
                        options: [
                            { label: "All Work Centers", value: "all" },
                            ...orderedWorkCenters.map((wc) => ({ label: wc.name, value: String(wc.id) })),
                        ],
                        onChange: setWorkCenterFilter,
                        searchable: true
                    },
                    {
                        type: 'select',
                        label: 'Shift',
                        value: shiftFilter,
                        options: [
                            { label: "All Shifts", value: "all" },
                            ...shifts.map((s) => ({
                                label: s.shift_name || s.name || s.value_name,
                                value: String(s.id ?? s.shift_id),
                            })),
                        ],
                        onChange: setShiftFilter,
                        searchable: true
                    },
                    {
                        type: 'select',
                        label: 'Warehouse',
                        value: warehouseFilter,
                        options: [
                            { label: "All Warehouses", value: "all" },
                            ...orderedWarehouses.map((wh) => ({ label: wh.name, value: String(wh.id) })),
                        ],
                        onChange: setWarehouseFilter,
                        searchable: true
                    },
                    {
                        type: 'date',
                        label: 'Date',
                        value: dateFilter,
                        onChange: setDateFilter
                    }
                ]}
            />

            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">MR DATE</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Requested By</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">MR CODE</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Shift</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Warehouse</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Work Center</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Operation</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isListLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm text-muted-foreground">Loading...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                                            No material requests found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedRequests.map((mr) => (
                                        <TableRow key={mr.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="py-4">{formatDate(mr.date)}</TableCell>
                                            <TableCell>{mr.requestedBy}</TableCell>
                                            <TableCell className="font-medium text-primary">{mr.mrNo}</TableCell>
                                            <TableCell>{mr.shift}</TableCell>
                                            <TableCell>{mr.warehouse}</TableCell>
                                            <TableCell>{mr.workCenter}</TableCell>
                                            <TableCell>{mr.operation}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "font-medium",
                                                        mr.status === "Requested to Warehouse" && "border-amber-500 text-amber-600 bg-amber-50",
                                                        mr.status === "Issued by Warehouse" && "border-blue-500 text-blue-600 bg-blue-50",
                                                        mr.status === "Received by Production" && "border-green-500 text-green-600 bg-green-50"
                                                    )}
                                                >
                                                    {mr.status}
                                                </Badge>
                                            </TableCell>
                                             <TableCell className="text-center">
                                                {canEdit(permissionMR) && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 px-3 text-xs font-medium"
                                                        onClick={() => handleOpenDetail(mr)}
                                                        disabled={isActionBusy}
                                                    >
                                                        Open
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination - using standardized DataTablePagination component */}
                    {totalListRecords > 0 && !isListLoading && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalListRecords}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
        );
    };

    // --------------------------------------------------------------------------
    // RENDER: DIALOG (POPUP)
    // --------------------------------------------------------------------------

    const renderDetailPopup = () => {
        if (!isViewModalOpen) return null;
        const canIssue = selectedMR?.status === "Requested to Warehouse";

        return (
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent
                    className="flex h-auto max-h-[85vh] w-[95%] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 space-y-1 border-b p-4 pb-3 sm:px-5 sm:pb-4">
                        <div className="flex flex-wrap items-center gap-2 pr-6 sm:gap-3">
                            <DialogTitle className="text-lg font-bold sm:text-xl">
                                Material Request: {selectedMR?.mrNo ?? "..."}
                            </DialogTitle>
                            {selectedMR && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "shrink-0 font-medium",
                                        selectedMR.status === "Requested to Warehouse" && "border-amber-500 text-amber-600 bg-amber-50",
                                        selectedMR.status === "Issued by Warehouse" && "border-blue-500 text-blue-600 bg-blue-50",
                                        selectedMR.status === "Received by Production" && "border-green-500 text-green-600 bg-green-50",
                                    )}
                                >
                                    {selectedMR.status}
                                </Badge>
                            )}
                        </div>
                        <DialogDescription className="text-xs leading-snug text-muted-foreground sm:text-sm">
                            View and process material requisition items.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                        {isDetailLoading ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            </div>
                        ) : selectedMR ? (
                            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
                                <div className="min-w-0 lg:flex-[7] lg:basis-0">
                                    <h3 className="border-b border-primary/20 pb-1 text-xs font-bold uppercase tracking-wider text-primary">
                                        Requested Items
                                    </h3>
                                    <div className="mt-3 w-full overflow-hidden rounded-md border">
                                        <div
                                            className={cn(
                                                "overflow-x-auto",
                                                selectedMR.items.length > 6 &&
                                                    "max-h-[min(45vh,360px)] overflow-y-auto custom-scrollbar",
                                            )}
                                        >
                                            <Table className="w-full min-w-[560px]">
                                                <TableHeader>
                                                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                        <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider">
                                                            Item Name
                                                        </TableHead>
                                                        <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider">
                                                            Code
                                                        </TableHead>
                                                        <TableHead className="py-2 text-right text-[10px] font-bold uppercase tracking-wider">
                                                            Req Qty
                                                        </TableHead>
                                                        <TableHead className="py-2 text-right text-[10px] font-bold uppercase tracking-wider text-primary">
                                                            Avail Qty
                                                        </TableHead>
                                                        <TableHead className="w-24 py-2 text-right text-[10px] font-bold uppercase tracking-wider">
                                                            Issue Qty
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedMR.items.map((item) => (
                                                        <TableRow
                                                            key={item.id}
                                                            className="border-b transition-colors last:border-0 hover:bg-muted/10"
                                                        >
                                                            <TableCell className="py-2 text-xs font-medium">{item.itemName}</TableCell>
                                                            <TableCell className="py-2 font-mono text-[10px] text-muted-foreground">
                                                                {item.itemCode}
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap py-2 text-right text-xs">
                                                                {item.requiredQty} {item.uom}
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap py-2 text-right text-xs font-medium text-primary">
                                                                {item.availableQty} {item.uom}
                                                            </TableCell>
                                                            <TableCell className="py-1.5 text-right">
                                                                <Input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    className="ml-auto h-8 w-full max-w-24 px-2 text-right text-xs font-medium"
                                                                    value={item.issuedQty}
                                                                    onChange={(e) => handleIssueQtyChange(item.id as any, e.target.value)}
                                                                    onKeyPress={(e) => {
                                                                        if (!/[0-9.]/.test(e.key)) {
                                                                            e.preventDefault();
                                                                        }
                                                                    }}
                                                                    onPaste={(e) => {
                                                                        const pastedText = e.clipboardData.getData("text");
                                                                        const numericValue = pastedText.replace(/[^0-9.]/g, "");
                                                                        const integerPart = numericValue.split(".")[0];
                                                                        if (integerPart.length > 5) {
                                                                            e.preventDefault();
                                                                        }
                                                                    }}
                                                                    maxLength={7}
                                                                    readOnly={!canIssue}
                                                                    disabled={!canIssue}
                                                                />
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>

                                <div className="min-w-0 lg:flex-[3] lg:basis-0">
                                    <h3 className="border-b border-primary/20 pb-1 text-xs font-bold uppercase tracking-wider text-primary">
                                        MR Information
                                    </h3>
                                    <div className="mt-3 space-y-4 rounded-lg border bg-muted/20 p-4 sm:space-y-5 sm:p-5">
                                        <div className="min-w-0 space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Requested Date
                                            </Label>
                                            <p className="text-sm font-medium leading-snug">{formatDate(selectedMR.date)}</p>
                                        </div>
                                        <div className="min-w-0 space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Requested By
                                            </Label>
                                            <p className="wrap-break-word text-sm font-medium leading-snug">{selectedMR.requestedBy}</p>
                                        </div>
                                        <div className="min-w-0 space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Work Center
                                            </Label>
                                            <p className="wrap-break-word text-sm font-medium leading-snug">{selectedMR.workCenter}</p>
                                        </div>
                                        <div className="min-w-0 space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Operation
                                            </Label>
                                            <div className="min-h-10 rounded-md border border-input bg-background px-3 py-1.5">
                                                <p className="text-xs leading-snug wrap-break-word whitespace-normal text-foreground/90">
                                                    {selectedMR.operation}
                                                </p>
                                                {selectedMR.operationCode ? (
                                                    <p className="mt-0.5 font-mono text-[10px] leading-snug wrap-break-word whitespace-normal text-muted-foreground/60">
                                                        {selectedMR.operationCode}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="min-w-0 space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Shift
                                            </Label>
                                            <p className="wrap-break-word text-sm font-medium leading-snug">{selectedMR.shift}</p>
                                        </div>
                                        <div className="min-w-0 space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Warehouse
                                            </Label>
                                            <p className="wrap-break-word text-sm font-medium leading-snug">{selectedMR.warehouse}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <DialogFooter className="shrink-0 gap-2 border-t bg-muted/20 p-4 sm:flex-row sm:justify-end sm:p-5">
                        <Button
                            variant="outline"
                            onClick={() => setIsViewModalOpen(false)}
                            disabled={isIssueSubmitting}
                        >
                            Close
                        </Button>
                        {canIssue && (
                            <Button
                                className="font-semibold"
                                onClick={() => void handleIssueItems()}
                                loading={isIssueSubmitting}
                                disabled={isIssueSubmitting}
                            >
                                Issue Items
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };


    return (
        <div className="flex flex-col gap-6 h-full min-h-0">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Materials</h1>
                <p className="text-muted-foreground">Manage material requests and store operations.</p>
            </div>

            <Tabs value={activeTab || ""} onValueChange={(value) => {
                setActiveTab(value);
                if (value === "material-requests") {
                    setLocation("/inventory/materials/material-requests");
                } else if (value === "wh-receive") {
                    setLocation("/inventory/materials/wh-receive");
                }
            }} className="w-full flex-1 flex flex-col min-h-0">
                <div className="border-b border-border">
                    <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                        {canViewMaterialRequests && (
                            <TabsTrigger
                                value="material-requests"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                            >
                                Material Requests
                            </TabsTrigger>
                        )}
                        {canViewWHReceive && (
                            <TabsTrigger
                                value="wh-receive"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                            >
                                WH Receive
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>

                {!activeTab ? (
                    <Unauthorized />
                ) : (
                    <>
                        <TabsContent value="material-requests" className="m-0 pt-6 h-full min-h-0 overflow-auto">
                            {canViewMaterialRequests ? renderListing() : <Unauthorized />}
                        </TabsContent>

                        <TabsContent value="wh-receive" className="m-0 pt-6 h-full min-h-0 overflow-auto">
                            {canViewWHReceive ? <WHReceive /> : <Unauthorized />}
                        </TabsContent>
                    </>
                )}
            </Tabs>

            {renderDetailPopup()}
        </div>
    );
}
