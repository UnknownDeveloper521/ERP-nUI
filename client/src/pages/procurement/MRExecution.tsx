/**
 * MR Execution (Material Request Execution) Component
 * 
 * Features:
 * - View and filter Material Requests (MR)
 * - Add and manage Quotations for MRs
 * - Create Purchase Orders (PO) from MR entries
 * - Character limit validation for notes (150 chars)
 */
import React, { useState, useEffect, useRef } from "react";
import { format, parse, isValid } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    FileText,
    Calendar as CalendarIcon,
    ChevronDown,
    Trash2,
    Settings2,
    Paperclip,
    Plus,
    AlertCircle,
    Package,
    Printer,
    LayoutGrid,
    Download,
    ChevronsUpDown,
    Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { commonApi, ProcurementStatusRecord, procurementApi, MRListRecord, MRExecutionDetail, MRExecutionItem } from "@/lib/api";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Command,
    CommandInputBorderless,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, resolveFileUrl, getFileName, truncateFileName } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { mockWarehouses, mockLocations, mockTransporters, mockWorkCenters } from "@/lib/masterMockData";
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";

import {
    MRStatus,
    POStatus,
    Quotation,
    MRItem,
    MRRequestData,
    POData,
    getStoredMRs,
    saveMRs,
    getStoredPOs,
    savePOs
} from "@/lib/procurementSharedData";

/** MR execution line with optional SKU display (not on shared MRItem type). */
type ExecutionMRItem = MRItem & {
    skuCode?: string;
    skuName?: string;
};

const mapExecutionItem = (item: MRExecutionItem & Record<string, unknown>): ExecutionMRItem => ({
    id: item.mr_item_id,
    itemCode: item.item_code,
    itemName: item.item_name,
    uom: item.uom,
    type: "RM",
    requiredQty: Number(item.requested_qty) || 0,
    availableQty: item.stock_qty,
    quotations: [],
    poNumber: item.po_code || undefined,
    qtyReceived: 0,
    skuCode: String(item.sku_code ?? item.skuCode ?? "").trim() || undefined,
    skuName: String(item.sku_name ?? item.skuName ?? "").trim() || undefined,
});

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

const getStatusBadge = (status: MRStatus) => {
    switch (status) {
        case "Requested MR": return <Badge className="bg-blue-500 hover:bg-blue-600">Requested MR</Badge>;
        case "MR in Fullfillment": return <Badge className="bg-orange-500 hover:bg-orange-600">MR in Fullfillment</Badge>;
        case "FullFilled MR": return <Badge className="bg-green-500 hover:bg-green-600">FullFilled MR</Badge>;
        case "MR Closed": return <Badge variant="secondary">MR Closed</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
};

const MRExecution = () => {
    const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
    const permissionModule = "PROCUREMENT/MR_EXECUTION";

    if (!isMenuVisible(permissionModule)) {
        return <Unauthorized />;
    }

    const { toast } = useToast();

    const [requests, setRequests] = useState<MRRequestData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [totalItems, setTotalItems] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [filterStatus, setFilterStatus] = useState<string | number>("Requested MR");
    const [filterWorkCenter, setFilterWorkCenter] = useState<string>("all");
    const appliedWorkCenterFilterDefault = useRef(false);
    const appliedWarehouseDefault = useRef(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    
    const [workCenters, setWorkCenters] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<{ id: number; name: string; code: string }[]>([]);

    const assignedWorkcenterIds = getAssignedIds("workcenter");
    const assignedWarehouseIds = getAssignedIds("warehouse");

    const orderedWorkCenters = React.useMemo(
        () => prioritizeByAssigned(workCenters, assignedWorkcenterIds, (wc) => wc.id),
        [workCenters, assignedWorkcenterIds]
    );

    const orderedWarehouses = React.useMemo(
        () => prioritizeByAssigned(warehouses, assignedWarehouseIds, (wh) => wh.id),
        [warehouses, assignedWarehouseIds]
    );
    const [vendors, setVendors] = useState<{ id: number; name: string }[]>([]);
    const [procurementStatuses, setProcurementStatuses] = useState<ProcurementStatusRecord[]>([]);

    // Fetch Workcenters (needed for filters on page load)
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

    // Fetch Warehouses (needed only when form opens)
    const fetchWarehouses = React.useCallback(async () => {
        try {
            const res = await commonApi.getWarehouses();
            if (res.isSuccessful && res.data?.records) {
                setWarehouses(res.data.records.map((wh: any) => ({
                    id: Number(wh.warehouse_id || wh.id),
                    name: wh.warehouse_name || wh.name || wh.value_name,
                    code: wh.warehouse_code || wh.code || wh.value_code
                })));
            }
        } catch (error) {
            console.error("Failed to fetch warehouses:", error);
        }
    }, []);
    
    // Fetch Vendors
    const fetchVendors = React.useCallback(async () => {
        try {
            const res = await commonApi.getVendors();
            if (res.isSuccessful && res.data?.records) {
                setVendors(res.data.records.map((v: any) => ({
                    id: v.id,
                    name: v.name
                })));
            }
        } catch (error) {
            console.error("Failed to fetch vendors:", error);
        }
    }, []);

    // Fetch Procurement Statuses
    const fetchStatuses = React.useCallback(async () => {
        try {
            const res = await commonApi.getProcurementStatus();
            if (res.isSuccessful && res.data?.records) {
                setProcurementStatuses(res.data.records);
                
                // If the current filter is still the default string "Requested MR",
                // try to update it to the numeric ID immediately
                setFilterStatus(prev => {
                    const defaultStatus = res.data!.records.find(s => s.status_name === "Requested MR");
                    if (defaultStatus && (prev === "Requested MR" || prev === "all")) {
                        return String(defaultStatus.status_id);
                    }
                    return prev;
                });
            }
        } catch (error) {
            console.error("Failed to fetch procurement statuses:", error);
        }
    }, []); // Stable function to avoid circular calls

    const fetchMRs = React.useCallback(async () => {
        setIsLoading(true);
        try {
            // Map status name to ID if needed (for initial "Requested MR" default)
            let status_id_to_send: any = filterStatus;
            
            // If it's a string name, try to find the ID
            if (filterStatus !== 'all' && isNaN(Number(filterStatus))) {
                // If we don't have statuses yet, we MUST wait to avoid sending a string ID to backend
                if (procurementStatuses.length === 0) return;
                
                const found = procurementStatuses.find(s => s.status_name === filterStatus);
                if (found) {
                    status_id_to_send = found.status_id;
                } else {
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
                    items: [] // Detailed items fetched later
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

    useEffect(() => {
        // Only fetch Workcenters/Statuses on mount for listing filters
        fetchWorkCenters();
        fetchStatuses();
        fetchVendors(); // Pre-fetch vendors for PO select
        fetchWarehouses(); // Pre-fetch warehouses for PO select
    }, [fetchWorkCenters, fetchStatuses, fetchVendors, fetchWarehouses]);

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

    // Refetch MRs when filters or page change
    useEffect(() => {
        fetchMRs();
    }, [fetchMRs]);

    const updateRequests = (newRequests: MRRequestData[]) => {
        setRequests(newRequests);
        // saveMRs(newRequests);
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Auto-adjust page when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, filterDate, filterStatus, filterWorkCenter]);

    // PO State
    const [pos, setPos] = useState<POData[]>([]);

    useEffect(() => {
        setPos(getStoredPOs());

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "erp_mock_pos") {
                setPos(getStoredPOs());
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const updatePos = (newPos: POData[]) => {
        setPos(newPos);
        savePOs(newPos);
    };

    // Dialog states
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [activeRequest, setActiveRequest] = useState<MRRequestData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCreatingPO, setIsCreatingPO] = useState(false);

    // Selection state for PO
    const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

    const [activeItemId, setActiveItemId] = useState<number | null>(null);
    const [vendorName, setVendorName] = useState("");
    const [quoteVendor, setQuoteVendor] = useState<string>("");
    const [quoteNote, setQuoteNote] = useState<string>("");
    const [attachmentName, setAttachmentName] = useState("");
    const [quoteFile, setQuoteFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Configuration Tab States
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
    const [selectedVendorForPO, setSelectedVendorForPO] = useState<string>("");

    // Auto-select first assigned warehouse in configure modal (once per open)
    useEffect(() => {
        if (!isConfigModalOpen) {
            appliedWarehouseDefault.current = false;
            return;
        }
        if (appliedWarehouseDefault.current) return;
        if (!assignedWarehouseIds.length || orderedWarehouses.length === 0) return;

        const firstAssignedId = getFirstAssignedMatch(
            assignedWarehouseIds,
            orderedWarehouses.map((wh) => wh.id)
        );
        if (!firstAssignedId) return;

        const warehouse = orderedWarehouses.find((wh) => String(wh.id) === firstAssignedId);
        if (warehouse) {
            setSelectedWarehouse(warehouse.name);
            appliedWarehouseDefault.current = true;
        }
    }, [isConfigModalOpen, assignedWarehouseIds, orderedWarehouses]);

    const resolveDefaultWarehouseName = React.useCallback(() => {
        if (!assignedWarehouseIds.length || !orderedWarehouses.length) return "";
        const firstAssignedId = getFirstAssignedMatch(
            assignedWarehouseIds,
            orderedWarehouses.map((wh) => wh.id)
        );
        if (!firstAssignedId) return "";
        const warehouse = orderedWarehouses.find((wh) => String(wh.id) === firstAssignedId);
        return warehouse?.name ?? "";
    }, [assignedWarehouseIds, orderedWarehouses]);

    const handleOpenConfig = async (req: MRRequestData) => {
        if (isLoading || isDetailLoading || isCreatingPO) return;
        appliedWarehouseDefault.current = false;
        setSelectedWarehouse("");
        setIsConfigModalOpen(true);
        setIsDetailLoading(true);
        
        try {
            // Only refresh Warehouse data when opening the form
            await fetchWarehouses();
            
            // Set basic info first from the list row
            setActiveRequest({ ...req, items: [], quotations: [] });
            
            // Fetch detailed MR Execution data
            const res = await procurementApi.getMRExecutionById(req.id);
            
            if (res.isSuccessful && res.data) {
                const detail = res.data;
                // Map API fields (snake_case) to Frontend fields (camelCase) to keep PO logic working
                // as requested, while ensuring no mock data is used.
                const mappedRequest: MRRequestData = {
                    id: detail.id,
                    mrCode: req.mrCode, // Use code from list as it's consistent
                    mrDate: detail.mr_date,
                    location: detail.location_name,
                    workCenter: detail.workcenter_name,
                    department: detail.department_name,
                    status: detail.status_name as MRStatus,
                    requestedBy: detail.requested_by,
                    items: detail.items.map((item) => mapExecutionItem(item)),
                    quotations: detail.quotations.map(q => ({
                        id: q.quotation_id,
                        vendorName: q.vendor_name,
                        note: q.notes,
                        attachmentName: q.file_url ? getFileName(q.file_url) : undefined,
                        fileUrl: q.file_url || undefined
                    }))
                };
                setActiveRequest(mappedRequest);
            }
        } catch (error) {
            console.error("Failed to fetch MR execution details:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load material request details.",
                duration: 15000
            });
            setIsConfigModalOpen(false);
        } finally {
            setIsDetailLoading(false);
            setSelectedItemIds([]);
            const defaultWarehouse = resolveDefaultWarehouseName();
            if (defaultWarehouse) {
                setSelectedWarehouse(defaultWarehouse);
                appliedWarehouseDefault.current = true;
            }
            setSelectedVendorForPO("");
            setQuoteVendor("");
            setQuoteNote("");
            setAttachmentName("");
        }
    };

    const handleCreatePO = async () => {
        if (isCreatingPO) return;
        if (!activeRequest || selectedItemIds.length === 0 || !selectedVendorForPO || !selectedWarehouse) {
            toast({
                title: "Validation Error",
                description: "Please select items, a vendor, and a warehouse to create a PO.",
                variant: "destructive",
                duration: 15000
            });
            return;
        }

        // Map names to IDs for the API
        const vendor = vendors.find(v => v.name === selectedVendorForPO);
        const warehouse = warehouses.find(w => w.name === selectedWarehouse);

        if (!vendor || !warehouse) {
            toast({
                title: "Internal Error",
                description: "Could not resolve vendor or warehouse selection. Please try again.",
                variant: "destructive",
                duration: 15000
            });
            return;
        }

        const selectedItemsPayload = activeRequest.items
            .filter(item => selectedItemIds.includes(item.id))
            .map(item => ({
                mr_item_id: item.id,
                requested_qty: Number(item.requiredQty)
            }));

        setIsCreatingPO(true);
        try {
            const res = await procurementApi.createPO({
                mr_id: activeRequest.id,
                selected_items: selectedItemsPayload,
                vendor_id: vendor.id,
                warehouse_id: warehouse.id
            });

            if (res.isSuccessful) {
                toast({ variant: "success", title: "PO Created", description: res.message || "Purchase Order successfully generated.", duration: 15000 });
                
                // Reset selections
                setSelectedItemIds([]);
                setSelectedVendorForPO("");
                setSelectedWarehouse("");
                
                // Refresh the MR list and detail to reflect updated PO status
                fetchMRs();
                fetchMRExecutionDetail(activeRequest.id, true); // True to keep modal open or just refresh data
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
            console.error("Failed to create PO:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
                duration: 15000
            });
        } finally {
            setIsCreatingPO(false);
        }
    };

    // Helper to refresh detail without re-triggering loading overlay if needed
    const fetchMRExecutionDetail = async (id: number, silent = false) => {
        if (!silent) setIsDetailLoading(true);
        try {
            const res = await procurementApi.getMRExecutionById(id);
            if (res.isSuccessful && res.data) {
                const detail = res.data;
                // We need the original request from list to re-map some fields if missing in detail
                const req = requests.find(r => r.id === id);
                if (!req) return;

                const mappedRequest: MRRequestData = {
                    id: detail.id,
                    mrCode: req.mrCode,
                    mrDate: detail.mr_date,
                    location: detail.location_name,
                    workCenter: detail.workcenter_name,
                    department: detail.department_name,
                    status: detail.status_name as MRStatus,
                    requestedBy: detail.requested_by,
                    items: detail.items.map((item: MRExecutionItem) => mapExecutionItem(item)),
                    quotations: detail.quotations.map((q: any) => ({
                        id: q.quotation_id,
                        vendorName: q.vendor_name,
                        note: q.notes,
                        attachmentName: q.file_url ? getFileName(q.file_url) : undefined,
                        fileUrl: q.file_url
                    }))
                };
                setActiveRequest(mappedRequest);
            }
        } catch (error) {
            console.error("Failed to refresh MR details:", error);
        } finally {
            if (!silent) setIsDetailLoading(false);
        }
    };

    const handleAddQuotationRow = async () => {
        if (!quoteVendor || !activeRequest) return;

        const vendor = vendors.find(v => v.name === quoteVendor);
        if (!vendor) {
            toast({ variant: "destructive", title: "Error", description: "Invalid vendor selected.", duration: 15000 });
            return;
        }

        try {
            const formData = new FormData();
            formData.append('mr_id', String(activeRequest.id));
            formData.append('vendor_id', String(vendor.id));
            formData.append('notes', quoteNote);
            if (quoteFile) {
                formData.append('file', quoteFile);
            }

            const res = await procurementApi.createQuotation(formData);
            
            if (res.isSuccessful) {
                toast({ variant: "success", title: "Quotation Added", description: res.message, duration: 15000 });
                setQuoteVendor("");
                setQuoteNote("");
                setAttachmentName("");
                setQuoteFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                
                // Refresh data from server to reflect the new state
                await fetchMRExecutionDetail(activeRequest.id, true);
            } else {
                const errorTitle = (res as any).errorType === 'validation' ? "Validation Error" :
                                   (res as any).errorType === 'business' ? "Business Error" : "Failed";
                toast({ variant: "destructive", title: errorTitle, description: res.message, duration: 15000 });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message, duration: 15000 });
        }
    };

    const handleDeleteQuotationRow = async (quoteId: number) => {
        if (!activeRequest) return;
        
        try {
            const res = await procurementApi.deleteQuotation(quoteId);
            if (res.isSuccessful) {
                toast({ variant: "success", title: "Quotation Deleted", description: res.message, duration: 15000 });
                // Refresh data from server
                await fetchMRExecutionDetail(activeRequest.id, true);
            } else {
                const errorTitle = (res as any).errorType === 'validation' ? "Validation Error" :
                                   (res as any).errorType === 'business' ? "Business Error" : "Failed";
                toast({ variant: "destructive", title: errorTitle, description: res.message, duration: 15000 });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message, duration: 15000 });
        }
    };

    const handleDownloadQuotation = (fileUrl: string) => {
        if (!fileUrl) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No file available.",
                duration: 15000
            });
            return;
        }

        window.open(resolveFileUrl(fileUrl), '_blank');
    };

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">MR Execution</h1>
            </div>

            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: (val) => {
                        setSearchTerm(val);
                        setCurrentPage(1);
                    },
                    placeholder: "Search by Code, Location, WorkCenter or Dept..."
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
                        onChange: (date) => {
                            setFilterDate(date);
                            setCurrentPage(1);
                        },
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
                        onChange: (val) => {
                            setFilterStatus(val);
                            setCurrentPage(1);
                        },
                        searchable: true
                    }
                ]}
            />

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
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Department</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Requested By</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm text-muted-foreground">Loading...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : requests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            No MR requests found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    requests.map((request) => (
                                        <TableRow key={request.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="py-4 font-medium font-mono">{request.mrCode}</TableCell>
                                            <TableCell>{formatDate(request.mrDate)}</TableCell>
                                            <TableCell>{request.location}</TableCell>
                                            <TableCell>{request.workCenter}</TableCell>
                                            <TableCell>{request.department}</TableCell>
                                            <TableCell>{request.requestedBy}</TableCell>
                                            <TableCell className="text-center">{getStatusBadge(request.status)}</TableCell>
                                            <TableCell className="text-center">
                                                <TableActionButtons
                                                    customActions={
                                                        canEdit(permissionModule) && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={isLoading || isDetailLoading || isCreatingPO}
                                                                className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                                                                onClick={() => handleOpenConfig(request)}
                                                            >
                                                                <Settings2 className="h-4 w-4 mr-1" />
                                                                Configure
                                                            </Button>
                                                        )
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

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

            {/* CONFIGURE MR DIALOG */}
            <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
                <DialogContent
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 space-y-1 p-4 pb-2 sm:p-5 sm:pb-3">
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold sm:text-xl">
                            <Settings2 className="h-5 w-5 shrink-0 text-primary" />
                            <span className="truncate">Configure Material Request: {activeRequest?.mrCode}</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs leading-snug sm:text-sm">
                            Review MR details, manage quotations, and create purchase orders.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                        <div className="space-y-5">
                        {isDetailLoading ? (
                            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 sm:min-h-[320px]">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">MR Date</Label>
                                        <p className="text-sm font-medium">{activeRequest?.mrDate ? formatDate(activeRequest.mrDate) : "N/A"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Location</Label>
                                        <p className="text-sm font-medium">{activeRequest?.location}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Workcenter</Label>
                                        <p className="text-sm font-medium">{activeRequest?.workCenter}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Department</Label>
                                        <p className="text-sm font-medium">{activeRequest?.department}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Requested By</Label>
                                        <p className="text-sm font-medium">{activeRequest?.requestedBy}</p>
                                    </div>
                                    <div className="space-y-1 sm:col-span-2 lg:col-span-1 xl:col-span-3">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                                        <div className="pt-0.5">{activeRequest && getStatusBadge(activeRequest.status)}</div>
                                    </div>
                                </div>

                                <Tabs defaultValue="items" className="w-full">
                                    <TabsList className="mb-4 grid w-full grid-cols-2 sm:mb-5">
                                        <TabsTrigger value="items" className="font-bold">Material Items</TabsTrigger>
                                        <TabsTrigger value="quotes" className="font-bold">Quotations</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="items" className="space-y-4 outline-none sm:space-y-5">
                                        <div className="overflow-hidden rounded-md border bg-white shadow-sm">
                                            <div
                                                className={cn(
                                                    "overflow-x-auto",
                                                    (activeRequest?.items.length ?? 0) > 4 &&
                                                        "max-h-[min(42vh,380px)] overflow-y-auto custom-scrollbar"
                                                )}
                                            >
                                                <Table className="w-full min-w-[720px]">
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/50">
                                                            <TableHead className="w-12 text-center py-3">
                                                                <Checkbox
                                                                    checked={selectedItemIds.length === activeRequest?.items.filter(i => !i.poNumber).length && (activeRequest?.items.filter(i => !i.poNumber).length || 0) > 0}
                                                                    onCheckedChange={(checked) => {
                                                                        if (checked) {
                                                                            setSelectedItemIds(activeRequest?.items.filter(i => !i.poNumber).map(i => i.id) || []);
                                                                        } else {
                                                                            setSelectedItemIds([]);
                                                                        }
                                                                    }}
                                                                />
                                                            </TableHead>
                                                            <TableHead className="text-[10px] font-bold uppercase py-3">Items</TableHead>
                                                            <TableHead className="text-[10px] font-bold uppercase py-3">SKU</TableHead>
                                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Requested Qty</TableHead>
                                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Stock</TableHead>
                                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-right pr-6">Po No.</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {activeRequest?.items.map((item) => {
                                                            const line = item as ExecutionMRItem;
                                                            return (
                                                            <TableRow key={item.id} className={cn("hover:bg-muted/20 transition-colors", item.poNumber && "opacity-60")}>
                                                                <TableCell className="text-center">
                                                                    <Checkbox
                                                                        disabled={!!item.poNumber}
                                                                        checked={selectedItemIds.includes(item.id)}
                                                                        onCheckedChange={(checked) => {
                                                                            if (checked) setSelectedItemIds(prev => [...prev, item.id]);
                                                                            else setSelectedItemIds(prev => prev.filter(id => id !== item.id));
                                                                        }}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="py-4">
                                                                    <div className="font-bold text-xs text-primary">{item.itemCode}</div>
                                                                    <div className="text-xs text-slate-600 font-medium">{item.itemName}</div>
                                                                    <div className="text-[9px] text-muted-foreground uppercase">{item.uom}</div>
                                                                </TableCell>
                                                                <TableCell className="py-4">
                                                                    <div className="font-bold text-xs text-primary">{line.skuCode || "-"}</div>
                                                                    <div className="text-xs text-slate-600 font-medium">{line.skuName || "-"}</div>
                                                                </TableCell>
                                                                <TableCell className="text-center font-bold text-primary">{item.requiredQty}</TableCell>
                                                                <TableCell className="text-center font-medium text-slate-600">{item.availableQty}</TableCell>
                                                                <TableCell className="text-right pr-6">
                                                                    {item.poNumber ? (
                                                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-mono">
                                                                            {item.poNumber}
                                                                        </Badge>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground italic">Pending</span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                            );
                                                        })}
                                                        {activeRequest?.items.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">
                                                                    No items found in this request.
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>

                                {canCreate(permissionModule) && (
                                    <div className="grid grid-cols-1 items-end gap-3 rounded-lg border border-dashed border-primary/20 bg-muted/20 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 lg:grid-cols-[1fr_1fr_auto]">
                                        <div className="min-w-0">
                                            <SearchableSelect
                                                label="Select Warehouse"
                                                disabled={selectedItemIds.length === 0}
                                                value={selectedWarehouse}
                                                options={orderedWarehouses.map(wh => ({ label: wh.name, value: wh.name }))}
                                                onChange={setSelectedWarehouse}
                                                placeholder="Choose primary warehouse..."
                                                className="bg-white h-9 sm:h-10"
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <SearchableSelect
                                                label="Select Vendor"
                                                disabled={selectedItemIds.length === 0}
                                                value={selectedVendorForPO}
                                                options={vendors.map(v => ({ label: v.name, value: v.name }))}
                                                onChange={setSelectedVendorForPO}
                                                placeholder="Choose Vendor..."
                                                className="bg-white h-9 sm:h-10"
                                            />
                                        </div>
                                        <Button
                                            disabled={selectedItemIds.length === 0 || !selectedWarehouse || !selectedVendorForPO || isCreatingPO}
                                            loading={isCreatingPO}
                                            onClick={handleCreatePO}
                                            className={cn(
                                                "h-9 w-full font-bold transition-all active:scale-95 sm:h-10 lg:w-auto",
                                                (selectedItemIds.length === 0 || !selectedWarehouse || !selectedVendorForPO)
                                                    ? "bg-muted text-muted-foreground border-muted shadow-none hover:bg-muted disabled:opacity-100!"
                                                    : "bg-primary text-white shadow-md shadow-primary/20 hover:bg-primary/90"
                                            )}
                                        >
                                            <Plus className="h-4 w-4 mr-1.5" />
                                            Create PO
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="quotes" className="space-y-4 outline-none sm:space-y-5">
                                {!(activeRequest?.status === "FullFilled MR" || activeRequest?.status === "MR Closed") && canCreate(permissionModule) && (
                                    <div className="space-y-4 rounded-lg border bg-muted/30 p-3 shadow-sm sm:p-4">
                                        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
                                            <div className="min-w-0 flex-1 space-y-1.5">
                                                <SearchableSelect
                                                    label="Vendor Selection"
                                                    value={quoteVendor}
                                                    options={vendors.map(v => ({
                                                        label: v.name,
                                                        value: v.name,
                                                        disabled: false
                                                    }))}
                                                    onChange={setQuoteVendor}
                                                    placeholder="Select Vendor..."
                                                    className="bg-white"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-[1.5] space-y-1.5 sm:space-y-2">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Notes</Label>
                                                <Input
                                                    placeholder="Add terms or notes..."
                                                    value={quoteNote}
                                                    maxLength={150} // Restrict length to 150 characters
                                                    onChange={(e) => {
                                                        // Immediate validation to sync with maxLength behavior
                                                        if (e.target.value.length <= 150) {
                                                                setQuoteNote(e.target.value);
                                                            }
                                                    }}
                                                    className="h-9 bg-white border-slate-200 text-sm shadow-none transition-all focus:border-primary focus:ring-0 sm:h-10"
                                                />
                                            </div>
                                            <div className="flex shrink-0 flex-col gap-2 sm:w-auto">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground opacity-0">File</Label>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    ref={fileInputRef}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
                                                            const maxSizeBytes = 10 * 1024 * 1024; // 10MB
                                                            
                                                            const extension = file.name.split('.').pop()?.toLowerCase();
                                                            if (!extension || !allowedExtensions.includes(extension)) {
                                                                toast({
                                                                    title: "Invalid File Type",
                                                                    description: "Only JPG, JPEG, PNG, and PDF files are allowed.",
                                                                    variant: "destructive"
                                                                });
                                                                e.target.value = "";
                                                                return;
                                                            }

                                                            if (file.size > maxSizeBytes) {
                                                                toast({
                                                                    title: "File Too Large",
                                                                    description: "File size must be less than 10MB.",
                                                                    variant: "destructive"
                                                                });
                                                                e.target.value = "";
                                                                return;
                                                            }

                                                            setAttachmentName(file.name);
                                                            setQuoteFile(file);
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    variant={attachmentName ? "default" : "outline"}
                                                    size="icon"
                                                    className={cn(
                                                        "h-10 w-10 shrink-0 bg-white border-slate-200",
                                                        attachmentName && "bg-emerald-500 hover:bg-emerald-600 border-none text-white shadow-lg shadow-emerald-100"
                                                    )}
                                                    onClick={() => fileInputRef.current?.click()}
                                                    title={attachmentName ? "Change attachment" : "Attach file"}
                                                >
                                                    <Paperclip className="h-5 w-5" />
                                                </Button>
                                            </div>
                                            <Button
                                                className={cn(
                                                    "h-10 px-6 font-bold shadow-md",
                                                    (!quoteVendor)
                                                        ? "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:!opacity-100 shadow-none"
                                                        : "bg-primary text-white hover:bg-primary/90"
                                                )}
                                                disabled={!quoteVendor}
                                                onClick={handleAddQuotationRow}
                                            >
                                                Add
                                            </Button>
                                        </div>

                                        {attachmentName && (
                                            <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded-md animate-in slide-in-from-top-1">
                                                <FileText className="h-4 w-4 text-emerald-600" />
                                                <span className="text-xs font-medium text-emerald-700 truncate max-w-[300px]">{attachmentName}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 ml-auto text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                                                    onClick={() => {
                                                        setAttachmentName("");
                                                        setQuoteFile(null);
                                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="overflow-hidden rounded-md border bg-white shadow-sm">
                                    <div
                                        className={cn(
                                            "overflow-x-auto",
                                            (activeRequest?.quotations?.length ?? 0) > 4 &&
                                                "max-h-[min(42vh,380px)] overflow-y-auto custom-scrollbar"
                                        )}
                                    >
                                        <Table className="w-full min-w-[560px]">
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="text-[10px] font-bold uppercase py-3 pl-6">Vendor</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase py-3">Note</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Document</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase py-3 text-right pr-6">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {activeRequest?.quotations?.map((q) => (
                                                    <TableRow key={q.id} className="group hover:bg-muted/20 transition-colors border-b">
                                                        <TableCell className="py-4 pl-6">
                                                            <span className="font-bold text-xs uppercase text-primary">{q.vendorName}</span>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <span className="text-xs text-slate-600 italic">{q.note || "No notes"}</span>
                                                        </TableCell>
                                                        <TableCell className="text-center py-4">
                                                            {q.attachmentName ? (
                                                                <div className="flex justify-center">
                                                                    <Badge 
                                                                        variant="secondary" 
                                                                        className="bg-blue-50 text-blue-600 border-none font-medium flex items-center gap-1 w-fit cursor-pointer hover:bg-blue-100 transition-colors"
                                                                        onClick={() => handleDownloadQuotation(q.fileUrl!)}
                                                                    >
                                                                        <Paperclip className="h-3 w-3" />
                                                                        {truncateFileName(q.attachmentName!)}
                                                                    </Badge>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground opacity-50">No doc</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6">
                                                            <div className="flex justify-end gap-1">
                                                                {!(activeRequest?.status === "FullFilled MR" || activeRequest?.status === "MR Closed") && canDelete(permissionModule) && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                                                        onClick={() => handleDeleteQuotationRow(q.id)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                            </>
                        )}
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 gap-2 border-t bg-background px-4 pb-4 pt-3 sm:px-5 sm:justify-end">
                        <Button variant="outline" onClick={() => setIsConfigModalOpen(false)} className="w-full sm:w-auto">
                            Close
                        </Button>
                        {!(activeRequest?.status === "FullFilled MR" || activeRequest?.status === "MR Closed") && canEdit(permissionModule) && (
                            <Button
                                className="w-full px-8 font-bold sm:w-auto"
                                loading={isSubmitting}
                                disabled={isSubmitting}
                                onClick={async () => {
                                    setIsSubmitting(true);
                                    await new Promise((resolve) => setTimeout(resolve, 800));
                                    setIsSubmitting(false);
                                    setIsConfigModalOpen(false);
                                    toast({ variant: "success", title: "Changes Saved", description: "MR configuration has been updated successfully.", duration: 15000 });
                                }}
                            >
                                Save
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MRExecution;
