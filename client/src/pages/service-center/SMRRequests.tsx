// ============================================================================
// MATERIAL REQUISITION COMPONENT - SERVICE CENTER MODULE
// Material Requisition listing and management
// Connected to Inventory Requisitions module via shared data store
// ============================================================================

import React, { useState } from "react";
import { useCommonStore } from "@/store/commonStore";
import { format, parse } from "date-fns";
import { serviceCenterApi, commonApi, inventoryApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    Plus,
    Calendar as CalendarIcon,
    Trash2,
    Check,
    ChevronsUpDown,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    X,
    CheckCircle2,
    Calendar,
    Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { DatePicker } from "@/components/shared/DatePicker";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "../Unauthorized";
import { cn } from "@/lib/utils";
import { mockLocations } from "@/lib/masterMockData";
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";
// Import shared SMR data and types
import {
    type SMRStatus,
    type SMRItem,
    type SMRRequest,
    type MasterItem,
    mockWorkCenters,
    mockDepartments,
    MOCK_SMR_ITEMS,
    mockSMRRequests,
    getNextSMRNumber,
    addSMRRequest,
    updateSMRRequest,
    deleteSMRRequest
} from "@/lib/smrSharedData";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const TOAST_DURATION = 15000;

/** Green styling for successful actions; keep errors as destructive. */
const crudSuccessToast = {
    className:
        "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
    duration: TOAST_DURATION,
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message?.trim()) return error.message.trim();
    if (typeof error === "string" && error.trim()) return error.trim();
    if (error && typeof error === "object") {
        const record = error as Record<string, unknown>;
        if (typeof record.message === "string" && record.message.trim()) return record.message.trim();
    }
    return fallback;
};

const getApiResponseMessage = (
    response: { message?: string } | null | undefined,
    fallback: string
): string => {
    const msg = response?.message?.trim();
    return msg || fallback;
};

/** Normalize API / master item type to display code (FG, SFG, etc.). */
const normalizeItemTypeCode = (raw: string): string => {
    const u = raw.trim().toUpperCase();
    if (!u) return "";
    if (u === "FG" || u === "SFG" || u === "RM") return u;
    if (u.includes("SEMI")) return "SFG";
    if (u.includes("FINISHED")) return "FG";
    if (u.length <= 12 && !u.includes(" ")) return u;
    return raw.trim();
};

const resolveSmrItemType = (
    it: Record<string, unknown>,
    itemTypes: { id?: number; value_id?: number; code?: string; value_code?: string; name?: string; value_name?: string }[],
    itemsById?: Map<number, Record<string, unknown>>
): string => {
    const fromApi = normalizeItemTypeCode(
        String(it.item_type_code || it.item_type || it.item_type_name || it.type || "")
    );
    if (fromApi) return fromApi;

    const typeId = Number(it.item_type_id);
    if (Number.isFinite(typeId) && typeId > 0) {
        const match = itemTypes.find(
            (t) => Number(t.id) === typeId || Number(t.value_id) === typeId
        );
        if (match) {
            return normalizeItemTypeCode(
                String(match.value_code || match.code || match.name || match.value_name || "")
            );
        }
    }

    const itemId = Number(it.item_id);
    if (itemsById && Number.isFinite(itemId)) {
        const master = itemsById.get(itemId);
        if (master) return resolveSmrItemType(master, itemTypes);
    }
    return "";
};

const asSmrItemType = (raw: string): "SFG" | "FG" => {
    const code = normalizeItemTypeCode(raw);
    return code === "FG" ? "FG" : "SFG";
};

const mapSmrDetailItem = (
    it: Record<string, unknown>,
    itemTypes: { id?: number; value_id?: number; code?: string; value_code?: string; name?: string; value_name?: string }[],
    itemsById: Map<number, Record<string, unknown>>
): SMRItem => ({
    id: Number(it.item_id),
    line_id: Number(it.id),
    itemName: String(it.item_name || ""),
    itemCode: String(it.item_code || ""),
    uom: String(it.uom_name || ""),
    type: asSmrItemType(resolveSmrItemType(it, itemTypes, itemsById)),
    availableStock: Number(it.available_stock) || 0,
    qtyNeeded: Number(it.qty_needed) || 0,
    requestedQty: Number(it.qty_needed) || 0,
    issueQty: Number(it.issued_qty) || 0,
});

// Get status badge with appropriate styling
const getStatusBadge = (status: SMRStatus) => {
    switch (status) {
        case "DRAFT_REQ":
        case "Draft Req.":
            return <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50/50">Draft Req.</Badge>;
        case "REQUESTED_REQ":
        case "Requested Req.":
            return <Badge className="bg-blue-500 hover:bg-blue-600 shadow-sm border-0">Requested Req.</Badge>;
        case "ISSUED_REQ_WH":
        case "Issued Req. by WH":
            return <Badge className="bg-orange-500 hover:bg-orange-600 shadow-sm border-0">Issued Req.</Badge>;
        case "RECEIVED_REQ_SC":
        case "Received Req. by SC":
            return <Badge className="bg-green-500 hover:bg-green-600 shadow-sm border-0">Received Req.</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
};

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

// Section header component for form sections
const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 pb-2 mb-4 border-b">
        <h3 className="font-semibold text-sm text-primary">{title}</h3>
    </div>
);

// Custom date picker component
// Local DatePicker removed in favor of shared component

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SMR_MODULE = "Service_Center:Material Requisition";

export default function SMRRequests() {
    const { 
        smrStatuses, 
        departments: storeDepartments, 
        locations: storeLocations,
        itemTypes,
    } = useCommonStore(state => ({
        smrStatuses: state.smrStatuses || [],
        departments: state.departments || [],
        locations: state.locations || [],
        itemTypes: state.itemTypes || [],
    }));
    const { toast } = useToast();
    const { isMenuVisible, canCreate, canEdit, canDelete, canView } = useHasPermission();
    const hasModuleAccess = isMenuVisible(SMR_MODULE);

    // State management for listing - sync with shared data on mount
    const [smrRequests, setSmrRequests] = useState<SMRRequest[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    // Default filter status: "all"
    const [filterStatus, setFilterStatus] = useState<string | number | "all">("all");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [isListLoading, setIsListLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Modal states
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [viewingRequest, setViewingRequest] = useState<SMRRequest | null>(null);
    const [smrToDelete, setSmrToDelete] = useState<SMRRequest | null>(null);

    const [smrRequestDate, setSmrRequestDate] = useState<Date>(new Date());
    // Keep SearchableSelect values as string IDs (consistent equality checks)
    const [formLocation, setFormLocation] = useState<string>("");
    const [formWorkCenter, setFormWorkCenter] = useState<string>("");
    const [formDepartment, setFormDepartment] = useState<string>("");
    const [selectedItemId, setSelectedItemId] = useState<string | number>("");
    const [addedItems, setAddedItems] = useState<SMRItem[]>([]);
    const [originalItems, setOriginalItems] = useState<SMRItem[]>([]);

    // Live master data states (Work Center and Items remain separate API calls)
    const [workCenters, setWorkCenters] = useState<any[]>([]);
    const [itemsList, setItemsList] = useState<any[]>([]);

    // Assigned defaults from login (location/workcenter)
    const assignedLocationIds = getAssignedIds("location");
    const assignedWorkcenterIds = getAssignedIds("workcenter");

    const orderedLocations = React.useMemo(
        () => prioritizeByAssigned(storeLocations, assignedLocationIds, (loc) => loc.id || loc.location_id),
        [storeLocations, assignedLocationIds]
    );

    const orderedWorkCenters = React.useMemo(
        () => prioritizeByAssigned(workCenters, assignedWorkcenterIds, (wc) => wc.id || wc.work_center_id),
        [workCenters, assignedWorkcenterIds]
    );

    // Fetch Work Centers and Items from APIs
    const fetchMasterData = async () => {
        try {
            const [wcRes, itemRes] = await Promise.all([
                commonApi.getWorkCenters(),
                inventoryApi.getItemConfig()
            ]);
            
            if (wcRes.isSuccessful) setWorkCenters(wcRes.data.records || []);
            if (itemRes.isSuccessful) setItemsList(itemRes.data.records || []);
        } catch (error) {
            console.error("Error fetching master data:", error);
        }
    };

    // Fetch data from API
    const fetchSMRRequests = async (page = 1) => {
        try {
            setIsListLoading(true);
            const response = await serviceCenterApi.getSMRList({
                page,
                limit: itemsPerPage,
                text_search: searchTerm || undefined,
                date: dateFilter ? format(dateFilter, "yyyy-MM-dd") : undefined,
                status: filterStatus === "all" ? undefined : String(filterStatus),
            });

            if (response.isSuccessful && response.data) {
                const mappedRecords: SMRRequest[] = response.data.records.map(record => ({
                    id: record.id,
                    smrNo: record.requisition_code,
                    smrRequestDate: record.request_date ? format(new Date(record.request_date), "dd-MM-yyyy") : "",
                    location: record.location_name,
                    workCenter: record.workcenter_name,
                    department: "Service Center", // Default if not in list API
                    status: record.status_name as SMRStatus,
                    statusCode: record.status_code,
                    items: [] // Detail API would be needed for items
                }));

                setSmrRequests(mappedRecords);
                setTotalRecords(response.data.pagination.total_records || 0);
                setTotalPages(response.data.pagination.total_pages || 0);
            } else {
                setSmrRequests([]);
                setTotalRecords(0);
                setTotalPages(0);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: getApiResponseMessage(response, "Failed to fetch material requisitions."),
                    duration: TOAST_DURATION,
                });
            }
        } catch (error) {
            console.error("Error fetching SMR requests:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: getApiErrorMessage(error, "Failed to fetch material requisitions."),
                duration: TOAST_DURATION,
            });
        } finally {
            setIsListLoading(false);
        }
    };

    // Consolidated fetch effect with debounce for search and filters
    React.useEffect(() => {
        const timer = setTimeout(() => {
            fetchSMRRequests(currentPage);
        }, 500);
        return () => clearTimeout(timer);
    }, [currentPage, itemsPerPage, filterStatus, dateFilter, searchTerm]);

    const [hasSetDefault, setHasSetDefault] = useState(false);

    // Set default filter status to "Draft" when statuses are loaded from store (only once)
    React.useEffect(() => {
        if (!hasSetDefault && smrStatuses.length > 0) {
            const draftStatus = smrStatuses.find(s => 
                (s.name || "").toLowerCase().includes("draft") || 
                s.code === "DRAFT_REQ" || 
                s.value_code === "DRAFT_REQ"
            );
            if (draftStatus) {
                setFilterStatus(draftStatus.id);
            }
            setHasSetDefault(true);
        }
    }, [smrStatuses, hasSetDefault]);

    // Fetch master data only when the form opens
    React.useEffect(() => {
        if (isFormModalOpen) {
            fetchMasterData();
        }
    }, [isFormModalOpen]);

    // When form opens and master data + assigned ids are available, auto-select assigned defaults
    React.useEffect(() => {
        if (!isFormModalOpen) return;
        if (!orderedLocations.length && !orderedWorkCenters.length) return;

        setFormLocation((prev) => {
            if (prev) return prev;
            const firstAssignedLocation = assignedLocationIds.length && orderedLocations.length
                ? getFirstAssignedMatch(
                    assignedLocationIds,
                    orderedLocations.map((loc) => loc.id || loc.location_id)
                )
                : undefined;
            const fallbackLocation = !firstAssignedLocation && orderedLocations.length
                ? (orderedLocations[0].id || orderedLocations[0].location_id)
                : undefined;
            return String(firstAssignedLocation ?? fallbackLocation ?? prev);
        });

        setFormWorkCenter((prev) => {
            if (prev) return prev;
            const firstAssignedWc = assignedWorkcenterIds.length && orderedWorkCenters.length
                ? getFirstAssignedMatch(
                    assignedWorkcenterIds,
                    orderedWorkCenters.map((wc) => wc.id || wc.work_center_id)
                )
                : undefined;
            const fallbackWc = !firstAssignedWc && orderedWorkCenters.length
                ? (orderedWorkCenters[0].id || orderedWorkCenters[0].work_center_id)
                : undefined;
            return String(firstAssignedWc ?? fallbackWc ?? prev);
        });
    }, [isFormModalOpen, orderedLocations, orderedWorkCenters, assignedLocationIds, assignedWorkcenterIds]);

    // Handler for adding item to the request
    const handleAddItem = () => {
        // Validate item selection
        if (!selectedItemId) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Please select an item.",
                duration: TOAST_DURATION,
            });
            return;
        }

        // Find the master item in live list
        const masterItem = itemsList.find(i => (i.id || i.item_id) === selectedItemId);
        if (!masterItem) return;

        // Check if item already added (prevent duplicates)
        const isDuplicate = addedItems.some(item => item.id === (masterItem.id || masterItem.item_id));
        if (isDuplicate) {
            toast({
                variant: "destructive",
                title: "Duplicate Item",
                description: "This item has already been added.",
                duration: TOAST_DURATION,
            });
            return;
        }

        // Create new SMR item with default quantity of 1
        const newItem: SMRItem = {
            id: masterItem.id || masterItem.item_id,
            itemName: masterItem.name || masterItem.item_name,
            itemCode: masterItem.item_code || "",
            uom: masterItem.uom || masterItem.item_uom || "UNIT",
            type: asSmrItemType(
                resolveSmrItemType(masterItem, itemTypes) ||
                    String(masterItem.type || masterItem.item_type_name || masterItem.item_type || "")
            ),
            availableStock: masterItem.current_QTY || masterItem.available_stock || 0,
            qtyNeeded: 1
        };

        setAddedItems(prev => [...prev, newItem]);
        setSelectedItemId("");
        toast({
            ...crudSuccessToast,
            title: "Item Added",
            description: `${newItem.itemName} added to the request.`,
        });
    };

    // Handler for removing item from the request
    const handleRemoveItem = (id: number | string) => {
        setAddedItems(addedItems.filter(i => i.id !== id));
    };

    // Handler for updating item quantity
    const handleUpdateItemQuantity = (id: number | string, newQty: string) => {
        // Remove non-numeric characters
        const numericValue = newQty.replace(/[^0-9]/g, '');

        // Check max length (6 digits)
        if (numericValue.length > 6) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Qty Needed cannot exceed 6 digits.",
                duration: TOAST_DURATION,
            });
            return;
        }

        // Parse the value
        const qty = numericValue === '' ? 0 : parseInt(numericValue, 10);

        // Update the item
        setAddedItems(prev => prev.map(item =>
            item.id === id ? { ...item, qtyNeeded: qty } : item
        ));
    };

    // Handler for saving SMR as draft
    const handleSaveDraft = () => {
        // Validate required fields (Workcenter is optional)
        if (!formLocation || !formDepartment) {
            toast({ variant: "destructive", title: "Validation Error", duration: TOAST_DURATION, description: "Please fill all required fields." });
            return;
        }

        if (addedItems.length === 0) {
            toast({ variant: "destructive", title: "Validation Error", duration: TOAST_DURATION, description: "Add at least one item." });
            return;
        }

        // Validate all items have valid quantities (must be greater than 0)
        const hasInvalidQty = addedItems.some(item => !item.qtyNeeded || item.qtyNeeded <= 0);
        if (hasInvalidQty) {
            toast({ variant: "destructive", title: "Validation Error", duration: TOAST_DURATION, description: "All items must have Qty Needed greater than 0." });
            return;
        }


        // Find IDs and Codes dynamically for the API payload
        const selectedLoc = storeLocations.find(l =>
            String(l.id ?? l.location_id ?? "") === String(formLocation) ||
            (l.name || l.value_name) === formLocation
        );
        const selectedWc = workCenters.find(w =>
            String(w.id ?? w.work_center_id ?? "") === String(formWorkCenter) ||
            (w.work_center_name || w.name) === formWorkCenter
        );
        const selectedDept = storeDepartments.find(d =>
            String(d.id ?? d.department_id ?? "") === String(formDepartment) ||
            (d.name || d.value_name) === formDepartment
        );

        const locationId = selectedLoc?.id || selectedLoc?.location_id || 1;
        const workcenterId = selectedWc?.id || selectedWc?.work_center_id || 1;
        const departmentId = selectedDept?.id || selectedDept?.department_id || 1;

        // Find status code for Draft from store
        const draftStatus = smrStatuses.find(s => 
            s.name.toLowerCase().includes("draft") || s.code.includes("DRAFT")
        );

        // Prepare items diff for update
        const buildItemsPayload = () => {
            const add = addedItems
                .filter(item => !originalItems.some(orig => (orig.line_id && orig.line_id === (item as any).line_id) || orig.id === item.id))
                .map(item => ({ item_id: item.id, qty_needed: item.qtyNeeded }));

            const update = addedItems
                .filter(item => originalItems.some(orig => (orig.line_id && orig.line_id === (item as any).line_id) || orig.id === item.id))
                .map(item => {
                    const orig = originalItems.find(o => (o.line_id && o.line_id === (item as any).line_id) || o.id === item.id);
                    return { 
                        service_material_requisition_items_id: orig?.line_id || orig?.id, 
                        qty_needed: item.qtyNeeded 
                    };
                });

            const deleteItems = originalItems
                .filter(orig => !addedItems.some(item => (orig.line_id && orig.line_id === (item as any).line_id) || orig.id === item.id))
                .map(orig => ({ service_material_requisition_items_id: orig.line_id || orig.id }));

            return { add, update, delete: deleteItems };
        };

        const payload = {
            request_date: format(smrRequestDate, "yyyy-MM-dd"),
            location_id: locationId,
            workcenter_id: workcenterId,
            department_id: departmentId,
            status_code: draftStatus ? draftStatus.code : "DRAFT_REQ",
            items: viewingRequest ? buildItemsPayload() : addedItems.map(item => ({
                item_id: item.id,
                qty_needed: item.qtyNeeded
            }))
        };

        // Call API
        (async () => {
            try {
                setActionLoading("save-draft");
                const response = viewingRequest 
                    ? await serviceCenterApi.updateSMR(viewingRequest.id, payload)
                    : await serviceCenterApi.createSMR(payload);
                if (response.isSuccessful) {
                    toast({
                        ...crudSuccessToast,
                        title: "Success",
                        description: getApiResponseMessage(
                            response,
                            viewingRequest
                                ? "Material Requisition updated."
                                : "Material Requisition saved as draft."
                        ),
                    });
                    resetForm();
                    setIsFormModalOpen(false);
                    fetchSMRRequests(1);
                } else {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: getApiResponseMessage(response, "Failed to save requisition."),
                        duration: TOAST_DURATION,
                    });
                }
            } catch (error) {
                console.error("Error saving requisition:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: getApiErrorMessage(error, "Failed to save requisition."),
                    duration: TOAST_DURATION,
                });
            } finally {
                setActionLoading(null);
            }
        })();
    };

    // Handler for submitting SMR request
    const handleSubmit = () => {
        // Validate required fields (Workcenter is optional)
        if (!formLocation || !formDepartment) {
            toast({ variant: "destructive", title: "Validation Error", duration: TOAST_DURATION, description: "Please fill all required fields." });
            return;
        }

        if (addedItems.length === 0) {
            toast({ variant: "destructive", title: "Validation Error", duration: TOAST_DURATION, description: "Add at least one item." });
            return;
        }

        // Validate all items have valid quantities (must be greater than 0)
        const hasInvalidQty = addedItems.some(item => !item.qtyNeeded || item.qtyNeeded <= 0);
        if (hasInvalidQty) {
            toast({ variant: "destructive", title: "Validation Error", duration: TOAST_DURATION, description: "All items must have Qty Needed greater than 0." });
            return;
        }


        // Find IDs and Codes dynamically for the API payload
        const selectedLoc = storeLocations.find(l =>
            String(l.id ?? l.location_id ?? "") === String(formLocation) ||
            (l.name || l.value_name) === formLocation
        );
        const selectedWc = workCenters.find(w =>
            String(w.id ?? w.work_center_id ?? "") === String(formWorkCenter) ||
            (w.work_center_name || w.name) === formWorkCenter
        );
        const selectedDept = storeDepartments.find(d =>
            String(d.id ?? d.department_id ?? "") === String(formDepartment) ||
            (d.name || d.value_name) === formDepartment
        );

        const locationId = selectedLoc?.id || selectedLoc?.location_id || 1;
        const workcenterId = selectedWc?.id || selectedWc?.work_center_id || 1;
        const departmentId = selectedDept?.id || selectedDept?.department_id || 1;

        // Find status code for Requested from store
        const requestedStatus = smrStatuses.find(s => 
            s.name.toLowerCase().includes("requested") || s.code.includes("REQUESTED")
        );

        // Prepare items diff for update
        const buildItemsPayload = () => {
            const add = addedItems
                .filter(item => !originalItems.some(orig => (orig.line_id && orig.line_id === (item as any).line_id) || orig.id === item.id))
                .map(item => ({ item_id: item.id, qty_needed: item.qtyNeeded }));

            const update = addedItems
                .filter(item => originalItems.some(orig => (orig.line_id && orig.line_id === (item as any).line_id) || orig.id === item.id))
                .map(item => {
                    const orig = originalItems.find(o => (o.line_id && o.line_id === (item as any).line_id) || o.id === item.id);
                    return { 
                        service_material_requisition_items_id: orig?.line_id || orig?.id, 
                        qty_needed: item.qtyNeeded 
                    };
                });

            const deleteItems = originalItems
                .filter(orig => !addedItems.some(item => (orig.line_id && orig.line_id === (item as any).line_id) || orig.id === item.id))
                .map(orig => ({ service_material_requisition_items_id: orig.line_id || orig.id }));

            return { add, update, delete: deleteItems };
        };

        const payload = {
            request_date: format(smrRequestDate, "yyyy-MM-dd"),
            location_id: locationId,
            workcenter_id: workcenterId,
            department_id: departmentId,
            status_code: requestedStatus ? requestedStatus.code : "REQUESTED_REQ",
            items: viewingRequest ? buildItemsPayload() : addedItems.map(item => ({
                item_id: item.id,
                qty_needed: item.qtyNeeded
            }))
        };

        // Call API
        (async () => {
            try {
                setActionLoading("submit");
                const response = viewingRequest 
                    ? await serviceCenterApi.updateSMR(viewingRequest.id, payload)
                    : await serviceCenterApi.createSMR(payload);
                if (response.isSuccessful) {
                    toast({
                        ...crudSuccessToast,
                        title: "Success",
                        description: getApiResponseMessage(
                            response,
                            viewingRequest
                                ? "Material Requisition updated."
                                : "Material Requisition submitted successfully."
                        ),
                    });
                    resetForm();
                    setIsFormModalOpen(false);
                    fetchSMRRequests(1);
                } else {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: getApiResponseMessage(response, "Failed to submit requisition."),
                        duration: TOAST_DURATION,
                    });
                }
            } catch (error) {
                console.error("Error submitting requisition:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: getApiErrorMessage(error, "Failed to submit requisition."),
                    duration: TOAST_DURATION,
                });
            } finally {
                setActionLoading(null);
            }
        })();
    };

    // Reset form to initial state
    const resetForm = () => {
        setSmrRequestDate(new Date());
        setFormLocation("");
        setFormWorkCenter("");
        setFormDepartment("");
        setAddedItems([]);
        setOriginalItems([]);
        setSelectedItemId("");
        setViewingRequest(null); // Clear editing state
    };

    // Handler for deleting SMR request
    const handleDeleteSMR = async (id: number) => {
        try {
            setActionLoading("delete");
            const response = await serviceCenterApi.deleteSMR(id);
            if (response.isSuccessful) {
                toast({
                    ...crudSuccessToast,
                    title: "Success",
                    description: getApiResponseMessage(
                        response,
                        "Material Requisition deleted successfully."
                    ),
                });
                setIsDeleteAlertOpen(false);
                setIsFormModalOpen(false);
                resetForm();
                fetchSMRRequests(1);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: getApiResponseMessage(response, "Failed to delete requisition."),
                    duration: TOAST_DURATION,
                });
            }
        } catch (error) {
            console.error("Error deleting requisition:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: getApiErrorMessage(error, "Failed to delete requisition."),
                duration: TOAST_DURATION,
            });
        } finally {
            setActionLoading(null);
        }
    };

    // Handler for opening create modal
    const handleAddSMR = () => {
        resetForm();
        // Apply assigned defaults for new request (location + workcenter)
        const defaultLocationId = assignedLocationIds.length && orderedLocations.length
            ? getFirstAssignedMatch(
                assignedLocationIds,
                orderedLocations.map((loc) => loc.id || loc.location_id)
            )
            : undefined;
        const defaultWorkCenterId = assignedWorkcenterIds.length && orderedWorkCenters.length
            ? getFirstAssignedMatch(
                assignedWorkcenterIds,
                orderedWorkCenters.map((wc) => wc.id || wc.work_center_id)
            )
            : undefined;

        if (defaultLocationId) setFormLocation(String(defaultLocationId));
        if (defaultWorkCenterId) setFormWorkCenter(String(defaultWorkCenterId));

        setIsFormModalOpen(true);
    };

    // Handler for viewing SMR request
    const handleView = async (request: any) => {
        try {
            setActionLoading("view-load");
            const [response, itemConfigRes] = await Promise.all([
                serviceCenterApi.getSMRById(request.id),
                inventoryApi.getItemConfig(),
            ]);
            if (response.isSuccessful && response.data) {
                const data = response.data;
                const itemsById = new Map<number, Record<string, unknown>>();
                if (itemConfigRes.isSuccessful && itemConfigRes.data?.records) {
                    itemConfigRes.data.records.forEach((r: Record<string, unknown>) => {
                        const id = Number(r.id ?? r.item_id);
                        if (Number.isFinite(id)) itemsById.set(id, r);
                    });
                }
                const detailedItems: SMRItem[] = (data.items || []).map((it: Record<string, unknown>) =>
                    mapSmrDetailItem(it, itemTypes, itemsById)
                );

                const detailedRequest: SMRRequest = {
                    id: data.id,
                    smrNo: data.requisition_code,
                    smrRequestDate: data.request_date ? format(parse(data.request_date, 'yyyy-MM-dd', new Date()), 'dd-MM-yyyy') : "",
                    location: data.location_name,
                    workCenter: data.workcenter_name,
                    department: data.department_name,
                    status: request.status,
                    statusCode: data.status_code || request.statusCode,
                    issuedDate: data.issued_date ? format(parse(data.issued_date, 'yyyy-MM-dd', new Date()), 'dd-MM-yyyy') : (data.issued_date || ""),
                    issuedBy: data.issued_by || "",
                    receivedDate: data.received_date ? format(parse(data.received_date, 'yyyy-MM-dd', new Date()), 'dd-MM-yyyy') : (data.received_date || ""),
                    receivedBy: data.received_by || "",
                    items: detailedItems
                };
                setViewingRequest(detailedRequest);
                setIsViewModalOpen(true);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: getApiResponseMessage(response, "Failed to fetch requisition details."),
                    duration: TOAST_DURATION,
                });
            }
        } catch (error) {
            console.error("Error fetching SMR details:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: getApiErrorMessage(error, "Failed to fetch requisition details."),
                duration: TOAST_DURATION,
            });
        } finally {
            setActionLoading(null);
        }
    };

    // Handler for editing SMR request (only for Draft status)
    const handleEditSMR = async (request: any) => {
        try {
            setActionLoading("edit-load");
            const [response, itemConfigRes] = await Promise.all([
                serviceCenterApi.getSMRById(request.id),
                inventoryApi.getItemConfig(),
            ]);
            if (response.isSuccessful && response.data) {
                const data = response.data;
                const itemsById = new Map<number, Record<string, unknown>>();
                if (itemConfigRes.isSuccessful && itemConfigRes.data?.records) {
                    itemConfigRes.data.records.forEach((r: Record<string, unknown>) => {
                        const id = Number(r.id ?? r.item_id);
                        if (Number.isFinite(id)) itemsById.set(id, r);
                    });
                }
                // Populate form with detailed data
                setSmrRequestDate(parse(data.request_date, 'yyyy-MM-dd', new Date()));
                setFormLocation(data.location_id || data.location_name);
                setFormWorkCenter(data.workcenter_id || data.workcenter_name);
                setFormDepartment(data.department_id || data.department_name);
                
                const mappedItems: SMRItem[] = (data.items || []).map((it: Record<string, unknown>) =>
                    mapSmrDetailItem(it, itemTypes, itemsById)
                );
                
                setAddedItems(mappedItems);
                setOriginalItems(mappedItems);
                setIsFormModalOpen(true);
                
                // Store a compatible request object for the view modal parts
                setViewingRequest({
                    id: data.id,
                    smrNo: data.requisition_code,
                    smrRequestDate: format(parse(data.request_date, 'yyyy-MM-dd', new Date()), 'dd-MM-yyyy'),
                    location: data.location_name,
                    workCenter: data.workcenter_name,
                    department: data.department_name,
                    status: request.status,
                    items: mappedItems
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: getApiResponseMessage(response, "Failed to fetch requisition details."),
                    duration: TOAST_DURATION,
                });
            }
        } catch (error) {
            console.error("Error fetching SMR details for editing:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: getApiErrorMessage(error, "Failed to fetch requisition details."),
                duration: TOAST_DURATION,
            });
        } finally {
            setActionLoading(null);
        }
    };

    /**
     * Handler for receiving SMR items
     * Changes status from "ISSUED_REQ_WH" to "RECEIVED_REQ_SC"
     */
    const handleReceive = async () => {
        if (!viewingRequest) return;

        try {
            setActionLoading("receive");
            const response = await serviceCenterApi.receiveItemBySC({
                service_material_requisition_id: viewingRequest.id
            });
            
            if (response.isSuccessful) {
                toast({
                    ...crudSuccessToast,
                    title: "Success",
                    description: getApiResponseMessage(
                        response,
                        `SMR ${viewingRequest.smrNo} has been received successfully.`
                    ),
                });
                setIsViewModalOpen(false);
                setViewingRequest(null);
                fetchSMRRequests(1);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: getApiResponseMessage(response, "Failed to receive materials."),
                    duration: TOAST_DURATION,
                });
            }
        } catch (error) {
            console.error("Error receiving materials:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: getApiErrorMessage(error, "Failed to receive materials."),
                duration: TOAST_DURATION,
            });
        } finally {
            setActionLoading(null);
        }
    };

    const isFormActionBusy =
        actionLoading === "save-draft" ||
        actionLoading === "submit" ||
        actionLoading === "delete";
    const canSaveRequest = viewingRequest ? canEdit(SMR_MODULE) : canCreate(SMR_MODULE);

    const isDraftSmr = (item: SMRRequest) =>
        item.status === "DRAFT_REQ" ||
        item.status === "Draft Req." ||
        item.statusCode === "DRAFT_REQ";

    // Pagination calculations are now handled by API

    if (!hasModuleAccess) {
        return <Unauthorized />;
    }

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <h1 className="text-3xl font-bold tracking-tight">Material Requisitions</h1>

            {/* Filter Section */}
            {/* Standardized Toolbar */}
            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: (val) => {
                        setSearchTerm(val);
                        setCurrentPage(1);
                    },
                    placeholder: "Search by Req No, Location, Workcenter..."
                }}
                filters={[
                    {
                        type: 'date',
                        label: 'Date',
                        value: dateFilter,
                        onChange: (d) => {
                            setDateFilter(d);
                            setCurrentPage(1);
                        },
                        placeholder: "Pick a date"
                    },
                    {
                        type: 'select',
                        label: 'Status',
                        value: filterStatus,
                        options: [
                            { value: "all", label: "All Status" },
                            ...(smrStatuses || []).map(s => ({ value: s.id, label: s.name }))
                        ],
                        onChange: (val) => {
                            setFilterStatus(val as any);
                            setCurrentPage(1);
                        },
                        searchable: true
                    }
                ]}
                actions={canCreate(SMR_MODULE) ? [
                    {
                        label: "Add Requisition",
                        icon: <Plus className="h-4 w-4 mr-2" />,
                        onClick: handleAddSMR
                    }
                ] : []}
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
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Location</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Work Center</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-center font-semibold text-xs uppercase tracking-wider w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isListLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-40 text-center">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                Loading requisitions...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : smrRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                                            No requisitions found matching your criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    smrRequests.map((item) => (
                                        <TableRow
                                            key={item.id}
                                            className="hover:bg-muted/20 group transition-colors border-b last:border-none"
                                        >
                                            <TableCell className="py-4 font-medium font-mono">
                                                {item.smrNo}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                {item.smrRequestDate}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm font-medium">
                                                {item.location}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm font-medium">
                                                {item.workCenter}
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                {getStatusBadge(item.status)}
                                            </TableCell>
                                            <TableCell className="text-center py-4">
                                                <TableActionButtons
                                                    onView={canView(SMR_MODULE) ? () => handleView(item) : undefined}
                                                    onEdit={
                                                        canEdit(SMR_MODULE) && isDraftSmr(item)
                                                            ? () => handleEditSMR(item)
                                                            : undefined
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <DataTablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalRecords}
                        onPageChange={setCurrentPage}
                        itemsPerPage={itemsPerPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                </CardContent>
            </Card>

            {/* CREATE SMR REQUEST DIALOG */}
            <Dialog open={isFormModalOpen} onOpenChange={(open) => {
                setIsFormModalOpen(open);
                if (!open) fetchSMRRequests(currentPage);
            }}>
                <DialogContent 
                    className="w-[95%] sm:max-w-3xl md:max-w-5xl xl:max-w-6xl max-h-[82vh] overflow-hidden p-0 flex flex-col gap-0 bg-white"
                    onInteractOutside={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    <div className="shrink-0 border-b bg-white px-6 py-5">
                    <DialogHeader className="p-0">
                        <DialogTitle className="text-xl font-bold">
                            {viewingRequest ? "Edit MR Request" : "Add New MR Request"}
                        </DialogTitle>
                        <DialogDescription>
                            Configure the details and items for this service material request.
                        </DialogDescription>
                    </DialogHeader>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-6">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {/* SMR Request Date */}
                            <div className="space-y-2">
                                <Label>SMR Request Date *</Label>
                                <DatePicker
                                    date={smrRequestDate}
                                    setDate={(d) => d && setSmrRequestDate(d)}
                                    disabled={true}
                                />
                            </div>

                            <SearchableSelect
                                label="Location"
                                placeholder="Select Location"
                                value={formLocation}
                                options={orderedLocations.length > 0
                                    ? orderedLocations.map(l => ({ label: l.name || l.value_name, value: String(l.id || l.location_id) }))
                                    : mockLocations.map(l => ({ label: l.name, value: String(l.id) }))}
                                onChange={(v) => setFormLocation(String(v))}
                                required={true}
                            />

                            <SearchableSelect
                                label="Workcenter"
                                placeholder="Select Workcenter"
                                value={formWorkCenter}
                                options={orderedWorkCenters.length > 0
                                    ? orderedWorkCenters.map(w => ({ label: w.work_center_name || w.name, value: String(w.id || w.work_center_id) }))
                                    : mockWorkCenters.map(name => ({ label: name, value: name }))}
                                onChange={(v) => setFormWorkCenter(String(v))}
                            />

                            <SearchableSelect
                                label="Department"
                                placeholder="Select Department"
                                value={formDepartment}
                                options={storeDepartments.length > 0 ? storeDepartments.map(d => ({ label: d.name || d.value_name, value: String(d.id || d.department_id) })) : mockDepartments.map(name => ({ label: name, value: name }))}
                                onChange={(v) => setFormDepartment(String(v))}
                                required={true}
                            />
                        </div>

                        <div>
                            <div className="flex gap-4 items-end mb-6">
                                <SearchableSelect
                                    label="Select Item (SFG / FG)"
                                    placeholder="Choose Item..."
                                    value={selectedItemId}
                                    options={itemsList.length > 0 
                                        ? itemsList.map(item => ({
                                            label: `${String(item.name || item.item_name || "").trim()} ${String(item.item_code || item.code || "").trim()}`.trim(),
                                            value: item.id || item.item_id,
                                            primaryText: String(item.name || item.item_name || "").trim(),
                                            secondaryText: String(item.item_code || item.code || "").trim(),
                                            disabled: addedItems.some(ai => ai.id === (item.id || item.item_id))
                                          }))
                                        : MOCK_SMR_ITEMS.map(item => ({
                                            label: `${String(item.name || "").trim()} ${String((item as any).itemCode || (item as any).item_code || "").trim()}`.trim(),
                                            value: item.id,
                                            primaryText: String(item.name || "").trim(),
                                            secondaryText: String((item as any).itemCode || (item as any).item_code || "").trim(),
                                            disabled: addedItems.some(ai => ai.id === item.id)
                                          }))
                                    }
                                    onChange={setSelectedItemId}
                                    className="flex-1 h-auto min-h-10 items-start! py-1"
                                    selectedPrimaryLineClamp={2}
                                    compactStackedSelected
                                    showSelectedTitle
                                    selectedTruncate="end"
                                />
                                <Button
                                    onClick={handleAddItem}
                                    className="h-10 px-6"
                                    disabled={!selectedItemId}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add
                                </Button>
                            </div>

                            {/* Item Table */}
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Item Name</TableHead>
                                            <TableHead className="text-center">UOM</TableHead>
                                            <TableHead className="text-center">Type (SFG / FG)</TableHead>
                                            <TableHead className="w-[100px] text-center">Stock(Service center)</TableHead>
                                            <TableHead className="w-[120px] text-right">Qty Needed</TableHead>
                                            <TableHead className="w-[50px]">Remove</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {addedItems.length > 0 ? addedItems.map((item) => (
                                            <TableRow key={item.id}>
                                                {/* Item Name */}
                                                <TableCell className="py-3 align-top">
                                                    <div className="flex min-w-0 flex-col gap-0.5">
                                                        <div className="font-medium text-sm whitespace-normal wrap-break-word [word-break:break-word]">
                                                            {item.itemName}
                                                        </div>
                                                        {item.itemCode ? (
                                                            <div className="font-mono text-[10px] text-muted-foreground whitespace-normal wrap-break-word [word-break:break-word]">
                                                                {item.itemCode}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </TableCell>

                                                {/* UOM */}
                                                <TableCell className="text-center text-xs">{item.uom}</TableCell>

                                                {/* Type Badge */}
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className="text-[9px] uppercase px-1.5">{item.type}</Badge>
                                                </TableCell>

                                                {/* Available Stock */}
                                                <TableCell className="text-center font-medium">{item.availableStock}</TableCell>

                                                {/* Qty Needed Input */}
                                                <TableCell className="text-right">
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        className={cn(
                                                            "h-8 w-20 ml-auto text-right",
                                                            (!item.qtyNeeded || item.qtyNeeded <= 0) && "border-destructive"
                                                        )}
                                                        value={item.qtyNeeded || ""}
                                                        onChange={(e) => handleUpdateItemQuantity(item.id, e.target.value)}
                                                        onKeyPress={(e) => {
                                                            // Allow only numbers
                                                            if (!/[0-9]/.test(e.key)) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                        maxLength={6}
                                                    />
                                                </TableCell>

                                                {/* Remove Button */}
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground h-20 text-sm italic">
                                                    No items added.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>

                    {/* Form Footer with action buttons */}
                    <div className="shrink-0 border-t bg-white px-6 py-4 mt-auto flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex justify-start">
                            {viewingRequest && isDraftSmr(viewingRequest) && canDelete(SMR_MODULE) && (
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        setSmrToDelete(viewingRequest);
                                        setIsDeleteAlertOpen(true);
                                    }}
                                    disabled={isFormActionBusy}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </Button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsFormModalOpen(false)}
                                disabled={isFormActionBusy}
                            >
                                Cancel
                            </Button>
                            {canSaveRequest && (
                                <>
                                    <Button
                                        variant="secondary"
                                        onClick={handleSaveDraft}
                                        loading={actionLoading === "save-draft"}
                                        disabled={
                                            !!actionLoading ||
                                            !formLocation ||
                                            !formDepartment ||
                                            addedItems.length === 0 ||
                                            addedItems.some(item => !item.qtyNeeded || item.qtyNeeded <= 0)
                                        }
                                    >
                                        Save
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        loading={actionLoading === "submit"}
                                        disabled={
                                            !!actionLoading ||
                                            !formLocation ||
                                            !formDepartment ||
                                            addedItems.length === 0 ||
                                            addedItems.some(item => !item.qtyNeeded || item.qtyNeeded <= 0)
                                        }
                                    >
                                        Submit
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* VIEW SMR REQUEST DIALOG */}
            <Dialog open={isViewModalOpen} onOpenChange={(open) => {
                setIsViewModalOpen(open);
                if (!open) fetchSMRRequests(currentPage);
            }}>
                <DialogContent 
                    className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 bg-white"
                    onInteractOutside={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    {viewingRequest && (
                        <>
                            {/* Form header without status badge - clean UI with only title and close button */}
                            <DialogHeader className="p-6 pb-2">
                                <DialogTitle className="text-xl font-bold">
                                    SMR Request Details
                                </DialogTitle>
                                <DialogDescription>
                                    {(viewingRequest.statusCode === "ISSUED_REQ_WH" || (viewingRequest.status || "").toLowerCase().includes("issued"))
                                        ? "Review and receive issued materials"
                                        : "View service material request details"}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                                {/* Header Info Grid */}
                                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">SMR No</Label>
                                        <p className="font-medium">{viewingRequest.smrNo}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">SMR Request Date</Label>
                                        <p className="font-medium">{viewingRequest.smrRequestDate}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Location</Label>
                                        <p className="font-medium">{viewingRequest.location}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Workcenter</Label>
                                        <p className="font-medium">{viewingRequest.workCenter || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Department</Label>
                                        <p className="font-medium">{viewingRequest.department}</p>
                                    </div>
                                    {/* Status badge removed from form - status only shown in listing table */}

                                    {/* Show issued/received info for Issued and Received statuses */}
                                    {(viewingRequest.statusCode === "ISSUED_REQ_WH" || viewingRequest.statusCode === "RECEIVED_REQ_SC" || 
                                      (viewingRequest.status || "").toLowerCase().includes("issued") || (viewingRequest.status || "").toLowerCase().includes("received")) && (
                                        <>
                                            {viewingRequest.issuedDate && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Issued Date</Label>
                                                    <p className="font-medium">{viewingRequest.issuedDate}</p>
                                                </div>
                                            )}
                                            {viewingRequest.issuedBy && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Issued By</Label>
                                                    <p className="font-medium">{viewingRequest.issuedBy}</p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Show received info only for Received status */}
                                    {(viewingRequest.status === "Received Req. by SC" || viewingRequest.status === "RECEIVED_REQ_SC" || viewingRequest.statusCode === "RECEIVED_REQ_SC") && (
                                        <>
                                            {viewingRequest.receivedDate && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Received Date</Label>
                                                    <p className="font-medium">{viewingRequest.receivedDate}</p>
                                                </div>
                                            )}
                                            {viewingRequest.receivedBy && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Received By</Label>
                                                    <p className="font-medium">{viewingRequest.receivedBy}</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Items Section */}
                                <div className="pt-4 border-t">
                                    <Label className="text-sm font-semibold mb-3 block">
                                        {(viewingRequest.statusCode === "ISSUED_REQ_WH" || viewingRequest.statusCode === "RECEIVED_REQ_SC" ||
                                          (viewingRequest.status || "").toLowerCase().includes("issued") || (viewingRequest.status || "").toLowerCase().includes("received"))
                                            ? "Issued Items"
                                            : "Requested Items"}
                                    </Label>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="py-2.5">Item Name</TableHead>
                                                    <TableHead className="py-2.5 text-center">UOM</TableHead>
                                                    <TableHead className="py-2.5 text-center">Type</TableHead>
                                                    {(viewingRequest.statusCode === "DRAFT_REQ" || viewingRequest.statusCode === "REQUESTED_REQ" ||
                                                      (viewingRequest.status || "").toLowerCase().includes("draft") || (viewingRequest.status || "").toLowerCase().includes("requested")) ? (
                                                        <>
                                                            <TableHead className="w-[100px] text-center">Stock(Service center)</TableHead>
                                                            <TableHead className="py-2.5 text-right pr-6">Qty Needed</TableHead>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <TableHead className="py-2.5 text-right">Requested Qty</TableHead>
                                                            <TableHead className="py-2.5 text-right pr-6 text-blue-600">Issued Qty</TableHead>
                                                        </>
                                                    )}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {viewingRequest.items && viewingRequest.items.length > 0 ? (
                                                    viewingRequest.items.map((item) => (
                                                        <TableRow key={item.id} className="border-b last:border-none">
                                                            <TableCell className="py-3 align-top">
                                                                <div className="flex min-w-0 flex-col gap-0.5">
                                                                    <div className="font-medium text-sm whitespace-normal wrap-break-word [word-break:break-word]">
                                                                        {item.itemName}
                                                                    </div>
                                                                    {item.itemCode ? (
                                                                        <div className="font-mono text-[10px] text-muted-foreground whitespace-normal wrap-break-word [word-break:break-word]">
                                                                            {item.itemCode}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center text-xs">{item.uom}</TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant="outline" className="text-[9px] uppercase px-1.5">{item.type}</Badge>
                                                            </TableCell>
                                                            {(viewingRequest.statusCode === "DRAFT_REQ" || viewingRequest.statusCode === "REQUESTED_REQ" ||
                                                              (viewingRequest.status || "").toLowerCase().includes("draft") || (viewingRequest.status || "").toLowerCase().includes("requested")) ? (
                                                                <>
                                                                    <TableCell className="text-center font-medium">{item.availableStock}</TableCell>
                                                                    <TableCell className="text-right font-bold text-primary pr-6">
                                                                        {item.qtyNeeded}
                                                                    </TableCell>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <TableCell className="text-right font-medium">{item.requestedQty || item.qtyNeeded}</TableCell>
                                                                    <TableCell className="text-right font-bold text-blue-600 pr-6">
                                                                        {item.issueQty || item.qtyNeeded}
                                                                    </TableCell>
                                                                </>
                                                            )}
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center text-muted-foreground h-20 text-sm italic">
                                                            No items in this request.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="p-6 border-t mt-auto flex gap-2">
                                {/* Show Mark as Received button for any Issued status */}
                                {(viewingRequest.statusCode === "ISSUED_REQ_WH" || 
                                  (viewingRequest.status || "").toLowerCase().includes("issued") || 
                                  (viewingRequest.status || "").toLowerCase().includes("issue")) &&
                                  canEdit(SMR_MODULE) && (
                                    <Button
                                        onClick={handleReceive}
                                        loading={actionLoading === "receive"}
                                        disabled={!!actionLoading}
                                        className="bg-primary text-primary-foreground font-semibold"
                                    >
                                        Mark as Received
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    onClick={() => setIsViewModalOpen(false)}
                                    className="w-full sm:w-auto"
                                    disabled={actionLoading === "receive"}
                                >
                                    Close
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* DELETE CONFIRMATION ALERT */}
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent className="sm:max-w-[425px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this SMR request? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            loading={actionLoading === "delete"}
                            disabled={!!actionLoading}
                            onClick={() => smrToDelete && handleDeleteSMR(smrToDelete.id)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
