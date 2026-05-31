import React, { useState, useEffect, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { format, parseISO, parse, isValid } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package, Trash2, Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { mockLocations, mockWorkCenters } from "@/lib/masterMockData";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { commonApi, ProcurementStatusRecord, procurementApi, MRListRecord, ItemWithStockRecord } from "@/lib/api";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

import {
    MRStatus,
    MRItem,
    MRRequestData,
    getStoredMRs,
    saveMRs
} from "@/lib/procurementSharedData";
import { useCommonStore } from "@/store/commonStore";
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";
import { loadProcurementSkuRecords, type SkuRecord } from "@/pages/masters/ProcurementSkuTab";


// INITIAL MOCK DATA IS NOW IN lib/procurementSharedData.ts

// ============================================================================
// HELPERS
// ============================================================================

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

const formatDate = (date: Date | string): string => {
    if (!date) return "";
    const d = typeof date === 'string' ? parseDateString(date) : date;
    if (!isValid(d)) return typeof date === 'string' ? date : "";
    return format(d, "dd-MM-yyyy");
};

const MAX_QTY_NEEDED_INTEGER_DIGITS = 10;

const qtyNeededIntegerWithinLimit = (qty: number | string): boolean => {
    const clean = String(qty).replace(/[^0-9.]/g, "");
    const [intPart = ""] = clean.split(".");
    return intPart.length > 0 && intPart.length <= MAX_QTY_NEEDED_INTEGER_DIGITS;
};

const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 border-b pb-1.5 mb-3">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
    </div>
);

/** Form-only line row: MRItem plus item/SKU ids for create dialog (not stored in shared MRItem type). */
type MRLineItem = MRItem & {
    itemId: number;
    skuId: number;
    skuCode: string;
    skuName: string;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MRRequest() {
    const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
    const permissionModule = "PROCUREMENT/MY_MR";

    if (!isMenuVisible(permissionModule)) {
        return <Unauthorized />;
    }

    const { toast } = useToast();

    // Access dynamic master data from the global store
    const departments = useCommonStore((state) => state.departments);
    const locations = useCommonStore((state) => state.locations);
    const [workCenters, setWorkCenters] = useState<any[]>([]);

    // Fetch Workcenters from API (reusable function)
    const fetchWorkCenters = React.useCallback(async () => {
        try {
            const res = await commonApi.getWorkCenters();
            if (res.isSuccessful && res.data?.records) {
                setWorkCenters(res.data.records.map((wc: any) => ({
                    id: wc.id,
                    name: wc.work_center_name || wc.name || wc.value_name,
                    code: wc.work_center_code || wc.code || wc.value_code
                })));
            }
        } catch (error) {
            console.error("Failed to fetch work centers:", error);
        }
    }, []);

    // Listing/Filtering state
    const [requests, setRequests] = useState<MRRequestData[]>([]);
    const [procurementStatuses, setProcurementStatuses] = useState<ProcurementStatusRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isViewLoading, setIsViewLoading] = useState(false);
    const [totalItems, setTotalItems] = useState(0);
    const [inventoryItems, setInventoryItems] = useState<ItemWithStockRecord[]>([]);
    const [isInventoryLoading, setIsInventoryLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [filterStatus, setFilterStatus] = useState<string | number>("all");
    const [filterWorkCenter, setFilterWorkCenter] = useState<string>("all");
    const appliedWorkCenterFilterDefault = useRef(false);

    const assignedWorkcenterIds = getAssignedIds("workcenter");
    const assignedLocationIds = getAssignedIds("location");

    const orderedWorkCenters = useMemo(
        () => prioritizeByAssigned(workCenters, assignedWorkcenterIds, (wc) => wc.id),
        [workCenters, assignedWorkcenterIds]
    );

    const orderedLocations = useMemo(
        () => prioritizeByAssigned(locations, assignedLocationIds, (loc) => loc.id),
        [locations, assignedLocationIds]
    );

    // Pagination state - controls page number and rows per page
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Fetch procurement statuses from API
    const fetchStatuses = React.useCallback(async () => {
        try {
            const res = await commonApi.getProcurementStatus();
            if (res.isSuccessful && res.data?.records) {
                setProcurementStatuses(res.data.records);
                
                // Statuses are fetched for the dropdown, but we keep "all" as default
            }
        } catch (error) {
            console.error("Failed to fetch procurement statuses:", error);
        }
    }, []); // Removed filterStatus dependency to avoid circular calls

    const fetchInventoryItems = React.useCallback(async () => {
        setIsInventoryLoading(true);
        try {
            const res = await commonApi.getItemsWithStock("rm,consumables");
            if (res.data && res.data.records) {
                setInventoryItems(res.data.records);
            }
        } catch (error) {
            console.error("Failed to fetch inventory items:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to load items with stock levels.",
                    duration: 15000
                });
        } finally {
            setIsInventoryLoading(false);
        }
    }, [toast]);

    const fetchMRs = React.useCallback(async () => {
        setIsLoading(true);
        try {
            // Map status name to ID if needed (for initial "Requested MR" default)
            let status_id_to_send: any = filterStatus;
            
            // If it's a string name, try to find the ID
            if (filterStatus !== 'all' && isNaN(Number(filterStatus))) {
                // If we don't have statuses yet, we MUST wait to avoid sending a string ID to backend
                if (procurementStatuses.length === 0) {
                    console.log("Waiting for statuses to load before fetching MRs...");
                    return;
                }
                
                const found = procurementStatuses.find(s => s.status_name === filterStatus);
                if (found) {
                    status_id_to_send = found.status_id;
                } else {
                    // If not found in dynamic list, backend won't know it anyway
                    // Better to send undefined than a string name that causes 500
                    status_id_to_send = undefined;
                }
            }

            const res = await procurementApi.getMRList({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearchTerm,
                workcenter_id: filterWorkCenter === 'all' ? undefined : filterWorkCenter,
                status_id: (status_id_to_send === 'all' || status_id_to_send === 'Requested MR') ? undefined : Number(status_id_to_send),
                date: filterDate ? format(filterDate, "yyyy-MM-dd") : undefined
            });

            if (res.isSuccessful && res.data) {
                setRequests(res.data.records.map((r: MRListRecord) => ({
                    id: r.id,
                    mrCode: r.mr_code,
                    mrDate: r.mr_date,
                    location: r.location_name,
                    workCenter: r.workcenter_name,
                    department: r.department_name,
                    status: (r.status_name || "Requested MR") as MRStatus,
                    requestedBy: r.request_by,
                    items: [] // Items will be fetched via separate detail API later
                })));
                setTotalItems(res.data.pagination.totalCount);
            }
        } catch (error) {
            console.error("Failed to fetch MRs:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch material requests.",
                duration: 15000
            });
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, itemsPerPage, debouncedSearchTerm, filterDate, filterStatus, filterWorkCenter, procurementStatuses, toast]);

    const fetchMRDetail = React.useCallback(async (mr_id: number) => {
        if (isLoading || isViewLoading) return;
        setIsViewLoading(true);
        setIsViewModalOpen(true);
        try {
            const res = await procurementApi.getMRDetail(mr_id);
            if (res.isSuccessful && res.data) {
                const detailed = res.data;
                setViewingRequest({
                    id: detailed.id,
                    mrCode: detailed.mr_code,
                    mrDate: detailed.mr_date,
                    location: detailed.location_name,
                    workCenter: detailed.work_center_name,
                    department: detailed.department_name,
                    status: detailed.status as MRStatus,
                    requestedBy: detailed.requested_by,
                    items: detailed.items.map((item) => ({
                        id: item.item_id,
                        itemCode: item.item_code,
                        itemName: item.item_name,
                        uom: item.uom,
                        type: item.item_type as "RM" | "Consumable",
                        availableQty: 0, // Not provided by detail API, used for read-only view
                        requiredQty: Number(item.requested_qty) || 0,
                        quotations: [],
                        qtyReceived: 0
                    }))
                });
            } else {
                const errorTitle = (res as any).errorType === 'validation' ? "Validation Error" :
                                   (res as any).errorType === 'business' ? "Business Error" : "Error";
                toast({
                    variant: "destructive",
                    title: errorTitle,
                    description: res.message,
                    duration: 15000
                });
                setIsViewModalOpen(false);
            }
        } catch (error: any) {
            console.error("Failed to fetch MR detail:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
                duration: 15000
            });
            setIsViewModalOpen(false);
        } finally {
            setIsViewLoading(false);
        }
    }, [toast, isLoading, isViewLoading]);

    // Effect for initial mounting
    useEffect(() => {
        fetchWorkCenters();
        fetchStatuses();
    }, [fetchWorkCenters, fetchStatuses]);

    // Auto-select first assigned workcenter in listing filter (once, when assigned exist)
    useEffect(() => {
        if (appliedWorkCenterFilterDefault.current) return;
        if (!assignedWorkcenterIds.length || orderedWorkCenters.length === 0) return;

        const firstAssigned = getFirstAssignedMatch(
            assignedWorkcenterIds,
            orderedWorkCenters.map((wc) => wc.id)
        );
        if (firstAssigned) {
            setFilterWorkCenter(String(firstAssigned));
            appliedWorkCenterFilterDefault.current = true;
        }
    }, [assignedWorkcenterIds, orderedWorkCenters]);

    // Effect for fetching MR list when filters change
    useEffect(() => {
        fetchMRs();
    }, [fetchMRs]);

    const updateRequests = (newRequests: MRRequestData[]) => {
        setRequests(newRequests);
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Modal states
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingRequest, setViewingRequest] = useState<MRRequestData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form states
    const [mrDate, setMrDate] = useState<Date>(new Date());
    const [selectedItemId, setSelectedItemId] = useState<string>("");
    const [selectedSkuId, setSelectedSkuId] = useState<string>("");
    const [skuRecords, setSkuRecords] = useState<SkuRecord[]>([]);
    const [itemQuantity, setItemQuantity] = useState<string>("");
    const [addedItems, setAddedItems] = useState<MRLineItem[]>([]);

    const skuDropdownOptions = useMemo(() => {
        if (!selectedItemId) return [];
        const itemId = Number(selectedItemId);
        let list = skuRecords;
        const forItem = skuRecords.filter((s) => Number(s.item_id) === itemId);
        if (forItem.length > 0) list = forItem;
        return list.map((s) => ({
            value: String(s.id),
            label: `${s.code} — ${s.name}`,
            primaryText: s.name,
            secondaryText: s.code,
            disabled: addedItems.some(
                (row) => row.itemId === itemId && row.skuId === Number(s.id),
            ),
        }));
    }, [skuRecords, selectedItemId, addedItems]);

    // Update available quantity when item is selected
    useEffect(() => {
        if (selectedItemId) {
            const item = inventoryItems.find(i => i.item_id.toString() === selectedItemId);
            if (item) {
                setItemQuantity(item.stock_qty.toString());
            }
        } else {
            setItemQuantity("");
        }
    }, [selectedItemId, inventoryItems]);

    // Auto-selected fields (simulated)
    const [headerInfo, setHeaderInfo] = useState({
        location_id: 0,
        work_center_id: 0,
        department_id: 0,
        requestedBy: "Admin User"
    });

    // Apply assigned defaults when create modal opens and master data finishes loading
    useEffect(() => {
        if (!isFormModalOpen) return;

        setHeaderInfo((prev) => {
            let location_id = prev.location_id;
            let work_center_id = prev.work_center_id;

            if (location_id === 0 && assignedLocationIds.length && orderedLocations.length) {
                const firstLocation = getFirstAssignedMatch(
                    assignedLocationIds,
                    orderedLocations.map((loc) => loc.id)
                );
                if (firstLocation) location_id = Number(firstLocation);
            }

            if (work_center_id === 0 && assignedWorkcenterIds.length && orderedWorkCenters.length) {
                const firstWorkCenter = getFirstAssignedMatch(
                    assignedWorkcenterIds,
                    orderedWorkCenters.map((wc) => wc.id)
                );
                if (firstWorkCenter) work_center_id = Number(firstWorkCenter);
            }

            if (location_id === prev.location_id && work_center_id === prev.work_center_id) {
                return prev;
            }

            return { ...prev, location_id, work_center_id };
        });
    }, [
        isFormModalOpen,
        assignedLocationIds,
        assignedWorkcenterIds,
        orderedLocations,
        orderedWorkCenters,
    ]);

    // Handlers
    const handleAddItem = () => {
        if (!selectedItemId) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please select an item.", duration: 15000 });
            return;
        }
        if (!selectedSkuId) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please select a SKU.", duration: 15000 });
            return;
        }

        const masterItem = inventoryItems.find(i => i.item_id.toString() === selectedItemId);
        if (!masterItem) return;

        const selectedSku = skuRecords.find((s) => String(s.id) === selectedSkuId);
        if (!selectedSku) return;

        const itemIdNum = Number(masterItem.item_id);
        const skuIdNum = Number(selectedSkuId);
        const exists = addedItems.some(
            (row) => row.itemId === itemIdNum && row.skuId === skuIdNum,
        );
        if (exists) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "This item and SKU combination is already added.",
                duration: 15000,
            });
            return;
        }

        const newItem: MRLineItem = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            itemId: itemIdNum,
            skuId: skuIdNum,
            skuCode: selectedSku.code,
            skuName: selectedSku.name,
            itemCode: masterItem.item_code,
            itemName: masterItem.item_name,
            uom: masterItem.uom,
            type: masterItem.item_type as "RM" | "Consumable",
            availableQty: masterItem.stock_qty,
            requiredQty: 1,
            quotations: [],
            qtyReceived: 0
        };

        setAddedItems(prev => [...prev, newItem]);
        setSelectedItemId("");
        setSelectedSkuId("");
        setItemQuantity("");
    };

    const handleRemoveItem = (id: number | string) => {
        setAddedItems(addedItems.filter(i => i.id !== id));
    };

    const canSaveMR =
        headerInfo.location_id !== 0 &&
        headerInfo.department_id !== 0 &&
        headerInfo.work_center_id !== 0 &&
        isValid(mrDate) &&
        addedItems.length > 0 &&
        !addedItems.some(
            (item) =>
                Number(item.requiredQty) <= 0 || !qtyNeededIntegerWithinLimit(item.requiredQty)
        );

    const handleUpdateItemQuantity = (id: number | string, newQty: string) => {
        const cleanValue = newQty.replace(/[^0-9.]/g, '');
        const parts = cleanValue.split('.');
        const integerPart = parts[0];
        const decimalPart = parts[1];

        if (integerPart.length > MAX_QTY_NEEDED_INTEGER_DIGITS) return;
        if (decimalPart !== undefined && decimalPart.length > 2) return;

        setAddedItems(prev => prev.map(item =>
            item.id === id ? { ...item, requiredQty: parseFloat(cleanValue) || 0 } : item
        ));
    };

    const handleSaveMR = async () => {
        if (isSubmitting) return;
        if (addedItems.length === 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Add at least one item.", duration: 15000 });
            return;
        }

        const invalidQty = addedItems.some(
            (item) => Number(item.requiredQty) <= 0 || !qtyNeededIntegerWithinLimit(item.requiredQty)
        );
        if (invalidQty) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: `Quantity must be greater than 0 with at most ${MAX_QTY_NEEDED_INTEGER_DIGITS} digits before the decimal.`,
                duration: 15000
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await procurementApi.createMR({
                mr_date: format(mrDate, "yyyy-MM-dd"),
                location_id: Number(headerInfo.location_id),
                work_center_id: Number(headerInfo.work_center_id),
                department_id: Number(headerInfo.department_id),
                items: addedItems.map(item => ({
                    item_id: Number(item.itemId),
                    requested_qty: Number(item.requiredQty)
                }))
            });

            if (res.isSuccessful) {
                toast({
                    variant: "success",
                    title: "Success",
                    description: res.message || "MR Request created successfully.",
                    duration: 15000
                });
                setIsFormModalOpen(false);
                setAddedItems([]);
                setMrDate(new Date());
                setHeaderInfo({
                    location_id: 0,
                    work_center_id: 0,
                    department_id: 0,
                    requestedBy: "Admin User"
                });
                // Refresh the listing
                fetchMRs();
            } else {
                const errorTitle = (res as any).errorType === 'validation' ? "Validation Error" :
                                   (res as any).errorType === 'business' ? "Business Error" : "Error";
                toast({
                    variant: "destructive",
                    title: errorTitle,
                    description: res.message,
                    duration: 15000
                });
            }
        } catch (error: any) {
            console.error("Failed to save MR:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
                duration: 15000
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenCreateModal = () => {
        // Refresh workcenters and inventory items from API when opening the form
        fetchWorkCenters();
        fetchInventoryItems();

        const defaultWorkCenterId = assignedWorkcenterIds.length
            ? getFirstAssignedMatch(
                  assignedWorkcenterIds,
                  orderedWorkCenters.map((wc) => wc.id)
              )
            : undefined;
        const defaultLocationId = assignedLocationIds.length
            ? getFirstAssignedMatch(
                  assignedLocationIds,
                  orderedLocations.map((loc) => loc.id)
              )
            : undefined;

        setAddedItems([]);
        setMrDate(new Date());
        setSelectedItemId("");
        setSelectedSkuId("");
        try {
            setSkuRecords(loadProcurementSkuRecords());
        } catch {
            setSkuRecords([]);
        }
        setItemQuantity("");
        setHeaderInfo({
            location_id: defaultLocationId ? Number(defaultLocationId) : 0,
            work_center_id: defaultWorkCenterId ? Number(defaultWorkCenterId) : 0,
            department_id: 0,
            requestedBy: "Admin User"
        });
        setIsFormModalOpen(true);
    };

    const getStatusBadge = (status: MRStatus) => {
        switch (status) {
            case "Requested MR": return <Badge className="bg-blue-500 hover:bg-blue-600">Requested MR</Badge>;
            case "MR in Fullfillment": return <Badge className="bg-orange-500 hover:bg-orange-600">MR in Fullfillment</Badge>;
            case "FullFilled MR": return <Badge className="bg-green-500 hover:bg-green-600">FullFilled MR</Badge>;
            case "MR Closed": return <Badge variant="secondary">MR Closed</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, filterDate, filterStatus, filterWorkCenter]);

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">My MR</h1>
            </div>

            {/* Filter Section */}
            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: setSearchTerm,
                    placeholder: "Search by Code, Location or WorkCenter..."
                }}
                filters={[
                    {
                        type: 'select',
                        label: 'WorkCenter',
                        value: filterWorkCenter,
                        options: [
                            { label: "All Work Centers", value: "all" }, 
                            ...orderedWorkCenters.map(wc => ({ 
                                label: wc.name, 
                                value: String(wc.id)
                            }))
                        ],
                        onChange: (val) => setFilterWorkCenter(val === "all" ? "all" : String(val)),
                        searchable: true
                    },
                    {
                        type: 'date',
                        label: 'Date',
                        value: filterDate,
                        onChange: setFilterDate,
                        showClear: !!filterDate
                    },
                    {
                        type: 'select',
                        label: 'Status',
                        value: filterStatus,
                        options: [
                            { label: "All Status", value: "all" },
                            ...procurementStatuses.map(s => ({ 
                                label: s.status_name, 
                                value: String(s.status_id) 
                            }))
                        ],
                        onChange: setFilterStatus,
                        searchable: true
                    }
                ]}
                actions={canCreate(permissionModule) ? [
                    {
                        label: "Create MR",
                        icon: <Plus className="h-4 w-4" />,
                        onClick: handleOpenCreateModal
                    }
                ] : []}
            />

            {/* Listing Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">MR Code</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">MR Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Location</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Workcenter</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm text-muted-foreground">Loading...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : requests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                            No MR requests found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    requests.map((req) => (
                                    <TableRow key={req.id} className="hover:bg-muted/30 transition-colors border-b">
                                        <TableCell className="py-4 font-medium font-mono">{req.mrCode}</TableCell>
                                        <TableCell>{formatDate(req.mrDate)}</TableCell>
                                        <TableCell>{req.location}</TableCell>
                                        <TableCell>{req.workCenter}</TableCell>
                                        <TableCell className="text-center">{getStatusBadge(req.status)}</TableCell>
                                        <TableCell className="text-center">
                                            <div className={cn((isLoading || isViewLoading) && "pointer-events-none opacity-50")}>
                                                <TableActionButtons
                                                    onView={() => fetchMRDetail(Number(req.id))}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {requests.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>

            {/* CREATE MR DIALOG */}
            <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
                <DialogContent
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 space-y-1 p-4 pb-2 sm:p-5 sm:pb-3">
                        <DialogTitle className="text-lg font-bold sm:text-xl">Add New MR Request</DialogTitle>
                        <DialogDescription className="text-xs leading-snug sm:text-sm">
                            Configure the details and items for this material request.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                        <div className="space-y-5">
                            <div>
                                <SectionHeader title="General Information" />
                                <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label id="mr-date-label" className="text-xs font-semibold">MR Date <span className="text-destructive">*</span></Label>
                                        <div
                                            id="mr-date-display"
                                            role="textbox"
                                            aria-readonly="true"
                                            aria-labelledby="mr-date-label"
                                            className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-foreground tabular-nums"
                                        >
                                            {format(mrDate, "dd-MM-yyyy")}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Location <span className="text-destructive">*</span></Label>
                                        <SearchableSelect
                                            value={String(headerInfo.location_id)}
                                            options={orderedLocations.map((loc) => ({ label: loc.location_name || loc.name, value: String(loc.id) }))}
                                            onChange={(val) => setHeaderInfo((prev) => ({ ...prev, location_id: Number(val) }))}
                                            placeholder="Select location..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Workcenter <span className="text-destructive">*</span></Label>
                                        <SearchableSelect
                                            value={String(headerInfo.work_center_id)}
                                            options={orderedWorkCenters.map((wc) => ({ label: wc.name, value: String(wc.id) }))}
                                            onChange={(val) => setHeaderInfo((prev) => ({ ...prev, work_center_id: Number(val) }))}
                                            placeholder="Select workcenter..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Department <span className="text-destructive">*</span></Label>
                                        <SearchableSelect
                                            value={String(headerInfo.department_id)}
                                            options={departments.map((dept) => ({ label: dept.department_name || dept.name, value: String(dept.id) }))}
                                            onChange={(val) => setHeaderInfo((prev) => ({ ...prev, department_id: Number(val) }))}
                                            placeholder="Select department..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <SectionHeader title="Material Requirements" />
                                <div className="mb-3 overflow-x-auto">
                                    <div className="grid min-w-[640px] grid-cols-[minmax(200px,1fr)_minmax(180px,1fr)_auto] gap-3 items-end">
                                    <div className="min-w-0 space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Select Item (RM / Consumables) *
                                        </Label>
                                        <SearchableSelect
                                            value={selectedItemId}
                                            options={inventoryItems.map((item) => ({
                                                label: `${item.item_code} - ${item.item_name}`,
                                                primaryText: item.item_name,
                                                secondaryText: item.item_code,
                                                value: item.item_id.toString(),
                                            }))}
                                            onChange={(val) => {
                                                setSelectedItemId(String(val));
                                                setSelectedSkuId("");
                                            }}
                                            placeholder={isInventoryLoading ? "Loading items..." : "Search item code or name..."}
                                            disabled={isInventoryLoading}
                                            className="h-9 sm:h-10"
                                        />
                                    </div>
                                    <div className="min-w-0 space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            SKU *
                                        </Label>
                                        <SearchableSelect
                                            value={selectedSkuId}
                                            options={skuDropdownOptions}
                                            onChange={(val) => setSelectedSkuId(String(val))}
                                            placeholder={
                                                !selectedItemId
                                                    ? "Select item first"
                                                    : skuDropdownOptions.length === 0
                                                      ? "No SKUs for this item"
                                                      : "Select SKU"
                                            }
                                            disabled={!selectedItemId || skuDropdownOptions.length === 0}
                                            className="h-9 sm:h-10"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleAddItem}
                                        disabled={!selectedItemId || !selectedSkuId}
                                        className={cn(
                                            "h-9 w-full shrink-0 px-6 sm:h-10 sm:w-auto",
                                            selectedItemId && selectedSkuId
                                                ? "bg-blue-600 hover:bg-blue-600/90 text-white border-blue-600"
                                                : "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:opacity-100!"
                                        )}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add
                                    </Button>
                                    </div>
                                </div>

                                <div
                                    className={cn(
                                        "overflow-hidden rounded-md border bg-white",
                                        addedItems.length > 4 && "max-h-[min(42vh,380px)] overflow-y-auto custom-scrollbar"
                                    )}
                                >
                                    <div className="overflow-x-auto">
                                        <Table className="w-full min-w-[720px]">
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="min-w-[160px]">Item Details</TableHead>
                                                    <TableHead className="min-w-[120px]">SKU</TableHead>
                                                    <TableHead className="text-center whitespace-nowrap">UOM</TableHead>
                                                    <TableHead className="text-center whitespace-nowrap">Type</TableHead>
                                                    <TableHead className="text-center whitespace-nowrap">Stock</TableHead>
                                                    <TableHead className="w-[120px] text-right whitespace-nowrap">Qty Needed</TableHead>
                                                    <TableHead className="w-[72px] text-center">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {addedItems.length > 0 ? addedItems.map((item) => (
                                                    <TableRow key={item.id}>
                                                        <TableCell className="align-top py-2.5">
                                                            <div className="text-sm font-medium leading-snug wrap-break-word" title={item.itemName}>
                                                                {item.itemName}
                                                            </div>
                                                            <div className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground break-all">
                                                                {item.itemCode}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="align-top py-2.5">
                                                            <div className="text-sm font-medium leading-snug wrap-break-word">
                                                                {item.skuName || "-"}
                                                            </div>
                                                            <div className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground break-all">
                                                                {item.skuCode || "-"}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs whitespace-nowrap">{item.uom}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="outline" className="text-[9px] uppercase px-1.5">{item.type}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center font-medium whitespace-nowrap">{item.availableQty}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Input
                                                                type="text"
                                                                inputMode="decimal"
                                                                className={cn(
                                                                    "ml-auto h-8 w-full min-w-20 max-w-32 text-right",
                                                                    (Number(item.requiredQty) <= 0 ||
                                                                        !qtyNeededIntegerWithinLimit(item.requiredQty)) &&
                                                                        "border-destructive"
                                                                )}
                                                                value={item.requiredQty || ""}
                                                                onChange={(e) => handleUpdateItemQuantity(item.id, e.target.value)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleRemoveItem(item.id)}
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )) : (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="h-20 text-center text-sm italic text-muted-foreground">
                                                            No items added.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 gap-2 border-t bg-background px-4 pb-4 pt-3 sm:px-5 sm:justify-end">
                        <Button variant="outline" onClick={() => setIsFormModalOpen(false)} className="w-full sm:w-auto">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveMR}
                            disabled={!canSaveMR || isSubmitting}
                            loading={isSubmitting}
                            className={cn(
                                "w-full sm:w-auto",
                                canSaveMR
                                    ? "bg-blue-600 hover:bg-blue-600/90 text-white border-blue-600"
                                    : "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:opacity-100!"
                            )}
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* VIEW MR DIALOG */}
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent
                    className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 bg-white"
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    {viewingRequest && (
                        <>
                            <DialogHeader className="p-6 pb-2">
                                <DialogTitle className="text-xl font-bold">
                                    {isViewLoading ? "Loading MR Details..." : "MR Details"}
                                </DialogTitle>
                                <DialogDescription>
                                    {isViewLoading ? "Please wait while we fetch the information." : "View material request details"}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 py-4 space-y-6">
                                {isViewLoading ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">Loading...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Header Info Grid */}
                                        <div className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">MR Code</Label>
                                        <p className="font-medium">{viewingRequest.mrCode}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">MR Date</Label>
                                        <p className="font-medium">{formatDate(viewingRequest.mrDate)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Status</Label>
                                        <div className="pt-0.5">{getStatusBadge(viewingRequest.status)}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Requested By</Label>
                                        <p className="font-medium">{viewingRequest.requestedBy}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Location</Label>
                                        <p className="font-medium">{viewingRequest.location}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Workcenter</Label>
                                        <p className="font-medium">{viewingRequest.workCenter}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Department</Label>
                                        <p className="font-medium">{viewingRequest.department}</p>
                                    </div>
                                </div>

                                <div className="shrink-0 border-t pt-4">
                                    <Label className="mb-3 block text-sm font-semibold">Requested Items</Label>
                                    <div className="overflow-hidden rounded-md border bg-white">
                                        <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead className="py-2.5">Item</TableHead>
                                                        <TableHead className="py-2.5 text-center">Type</TableHead>
                                                        <TableHead className="py-2.5 text-right pr-6">Quantity</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {viewingRequest.items.map((item) => (
                                                        <TableRow key={item.id} className="border-b last:border-none">
                                                            <TableCell className="py-3">
                                                                <div>
                                                                    <div className="font-medium text-sm">{item.itemCode}</div>
                                                                    <div className="text-xs text-muted-foreground mt-0.5">{item.itemName}</div>
                                                                    <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{item.uom}</div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant="outline" className="text-[9px] uppercase px-1.5">{item.type}</Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-primary pr-6">
                                                                {typeof item.requiredQty === 'number' ? item.requiredQty : Number(item.requiredQty).toLocaleString()}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter className="p-6 border-t mt-auto">
                        <Button variant="outline" onClick={() => setIsViewModalOpen(false)} className="w-full sm:w-auto">Close</Button>
                    </DialogFooter>
                </>
            )}
        </DialogContent>
            </Dialog>
        </div>
    );
}
