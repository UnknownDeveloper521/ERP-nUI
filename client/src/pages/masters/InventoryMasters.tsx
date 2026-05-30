import { useState, useEffect, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocation, useParams } from "wouter";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, ChevronsUpDown, Check, X, Loader2, Package, Trash2, Edit } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/usePermissions";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandInputBorderless,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { warehouseApi, binsApi, commonApi } from "@/lib/api"; // Integrated APIs for CRUD and dropdowns
import { useCommonStore } from "@/store/commonStore";
import { isBinTypeEntityName } from "@/services/loadCommonData";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";

/**
 * Entity master data (GET /api/common/getentityvalues)
 * -----------------------------------------------------
 * Department, Location, and Bin Type dropdowns use `useCommonStore`, which is filled once after
 * the user is authenticated — see `App.tsx` (Router) → `loadCommonData()` in
 * `client/src/services/loadCommonData.ts` (not inside `Login.tsx`).
 * Separate calls in this file (e.g. `getWarehouses` for bin warehouse picklist, warehouse/bins CRUD)
 * are for non–entity-value resources and are not duplicate entity fetches.
 * Legacy per-tab `getDepartments` / `getLocations` / `getBinTypes` flows are commented below where applicable.
 */

// --- Types & Interfaces ---

type MasterType = "Warehouses" | "Bins";

const MASTER_SLUGS: Record<MasterType, string> = {
    "Warehouses": "warehouses",
    "Bins": "bins",
};

/**
 * MasterTypes define the available inventory masters managed in this page.
 * These drive the tabs and the API context (warehouse vs bin).
 */
const MASTER_TYPES: MasterType[] = ["Warehouses", "Bins"];

const CODE_MAX_LENGTH = 50;
const NAME_MAX_LENGTH = 150;

// Interfaces for Warehouses and Bins

interface Warehouse {
    id: number;
    code: string;
    name: string;
    location: string;
    department: string;
    status: "Active" | "Inactive";
    address_notes?: string;
    created_at?: string;
    updated_at?: string;
}

interface Bin {
    id: number;
    warehouse_id: number; // Linked Warehouse
    code: string;
    name: string;
    type?: "Normal" | "QC Hold" | "Scrap";
    status: "Active" | "Inactive";
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

// No mock data needed for integrated masters

// UI-only: local mock items for Warehouse mapping modal
const MOCK_WAREHOUSE_ITEMS = [
    { id: 1, item_name: "Plastic Pallets", item_code: "RM-PALLETS", uom: "Nos" },
    { id: 2, item_name: "Scrap Batteries", item_code: "RM-SCRAP", uom: "Kg" },
    { id: 3, item_name: "Cardboard Boxes", item_code: "PK-BOX", uom: "Nos" },
    { id: 4, item_name: "Bubble Wrap", item_code: "PK-BWRAP", uom: "Mtr" },
] as const;

type WarehouseItemMappingStatus = "Active" | "Inactive";

interface WarehouseItemMappingRow {
    item_id: number;
    item_name: string;
    item_code: string;
    uom: string;
    capacity: string;
    status: WarehouseItemMappingStatus;
}

// --- Sub-components for Form Sections ---

const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 pb-2 mb-4 border-b">
        <h3 className="font-semibold text-sm text-primary">{title}</h3>
    </div>
);

const StatusBadge = ({ status }: { status: string }) => {
    return (
        <Badge variant={status === "Active" ? "outline" : "secondary"} className={status === "Active" ? "border-green-500 text-green-600 bg-green-50" : ""}>
            {status}
        </Badge>
    );
};

export default function InventoryMasters() {
    const { toast } = useToast();
    const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
    const universalKey = "MASTERS/INVENTORY";
    const [location, setLocation] = useLocation();
    const params = useParams();

    const getValidMaster = (type: string | undefined): MasterType => {
        if (type) {
            const entry = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === type);
            if (entry) return entry[0] as MasterType;
        }
        return "Warehouses";
    };

    const selectedMaster = getValidMaster(params.type);
    const [activeTab, setActiveTab] = useState(MASTER_SLUGS[selectedMaster]);


    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [open, setOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const updateRoute = (type: MasterType) => {
        const slug = MASTER_SLUGS[type] || type.toLowerCase();
        setLocation(`/masters/inventory/${slug}`);
    };

    const handleMasterChange = (newMaster: MasterType) => {
        const slug = MASTER_SLUGS[newMaster];
        setActiveTab(slug);
        setLocation(`/masters/inventory/${slug}`);
        setSearchTerm("");
        setOpen(false);
        setFilterStatus("All");
        setFilterWarehouse("All");
        setCurrentPage(1);
    };

    useEffect(() => {
        const newMaster = getValidMaster(params.type);
        const newSlug = MASTER_SLUGS[newMaster];
        
        // Sync the active tab state if the URL parameter changes
        if (newSlug !== activeTab) {
            setActiveTab(newSlug);
        }

        // Redirect if on base inventory master route
        if (location === '/masters/inventory') {
            setLocation('/masters/inventory/warehouses');
        }
    }, [params.type, location]);

    // State for integrated data
    // warehouses and bins are replaced by warehousesData and binsData from API

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [itemToDeleteID, setItemToDeleteID] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<any>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({
        code: "",
        name: "",
    });

    // --- API Driven State ---
    // Department & location: login entity master (getentityvalues → loadCommonData → useCommonStore)
    const locationsData = useCommonStore(state => state.locations);
    const departmentsData = useCommonStore(state => state.departments);
    const binTypesFromStore = useCommonStore((state) => state.binTypes);
    const entityValuesRaw = useCommonStore((state) => state.entityValues);
    /**
     * Bin types: grouped `binTypes` from loadCommonData, or same rows filtered from raw `entityValues`
     * when slice is empty (e.g. older cache). Matches backend BIN_TYPE via isBinTypeEntityName(entity_type_name).
     */
    const binTypesData = useMemo(() => {
        const source =
            Array.isArray(binTypesFromStore) && binTypesFromStore.length > 0
                ? binTypesFromStore
                : (entityValuesRaw || []).filter((r: any) => isBinTypeEntityName(r?.entity_type_name));
        return source.map((item: any) => ({
            ...item,
            id: Number(item.id),
            name: item.bin_type_name || item.name || item.value_name || "Unknown Type",
        }));
    }, [binTypesFromStore, entityValuesRaw]);
    const [warehousesListData, setWarehousesListData] = useState<any[]>([]);

    // Warehouse List & Pagination Data
    const [warehousesData, setWarehousesData] = useState<any[]>([]);
    const [totalWarehouses, setTotalWarehouses] = useState(0);

    // Bins List & Pagination Data
    const [binsData, setBinsData] = useState<any[]>([]);
    const [totalBins, setTotalBins] = useState(0);

    const [isListLoading, setIsListLoading] = useState(false);
    const [isFormDetailLoading, setIsFormDetailLoading] = useState(false);
    const [isFormDropdownsLoading, setIsFormDropdownsLoading] = useState(false);
    const [areBinFiltersReady, setAreBinFiltersReady] = useState(selectedMaster !== "Bins");
    const openingEditIdRef = useRef<number | null>(null);
    const appliedBinWarehouseFilterDefault = useRef(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // ─────────────────────────────────────────────────────────────────────────────
    // UI ONLY: Warehouse Item Mapping Modal (local mock state)
    // ─────────────────────────────────────────────────────────────────────────────
    const [isWarehouseItemDialogOpen, setIsWarehouseItemDialogOpen] = useState(false);
    const [activeWarehouseForMapping, setActiveWarehouseForMapping] = useState<any | null>(null);
    const [warehouseItemMappings, setWarehouseItemMappings] = useState<Record<number, WarehouseItemMappingRow[]>>({});
    const [warehouseItemDraft, setWarehouseItemDraft] = useState<WarehouseItemMappingRow[]>([]);
    const [selectedWarehouseItemId, setSelectedWarehouseItemId] = useState<number | null>(null);
    const [warehouseItemInlineError, setWarehouseItemInlineError] = useState<string>("");

    const assignedLocationKey = getAssignedIds("location").join(",");
    const assignedWarehouseKey = getAssignedIds("warehouse").join(",");

    const orderedLocations = useMemo(() => {
        const records = (locationsData || [])
            .map((loc: { id: number; name?: string; value_name?: string }) => ({
                id: Number(loc.id),
                name: String(loc.name ?? loc.value_name ?? "").trim(),
            }))
            .filter((loc) => Number.isFinite(loc.id) && loc.name);
        return prioritizeByAssigned(records, getAssignedIds("location"), (loc) => loc.id);
    }, [locationsData, assignedLocationKey]);

    const orderedWarehousesForBin = useMemo(() => {
        const records = (warehousesListData || [])
            .map((wh: any) => ({
                ...wh,
                id: Number(wh.id ?? wh.warehouse_id),
                name: String(wh.name ?? wh.warehouse_name ?? "Unknown Warehouse").trim(),
            }))
            .filter((wh) => Number.isFinite(wh.id) && wh.name);
        return prioritizeByAssigned(records, getAssignedIds("warehouse"), (wh) => wh.id);
    }, [warehousesListData, assignedWarehouseKey]);

    // Filters
    const [filterStatus, setFilterStatus] = useState<string>("All");
    const [filterWarehouse, setFilterWarehouse] = useState<string>("All"); // SearchableSelect components manage their own internal search state.

    /**
     * Fetches paginated warehouse list from the backend.
     * Integrates with: GET /api/masters/warehouse/warehouses
     * Sends: page, limit, search term, and status filter (1 for Active, 0 for Inactive)
     */
    const fetchWarehouses = async () => {
        if (selectedMaster !== "Warehouses") return;
        setIsListLoading(true);
        try {
            const status = filterStatus === "All" ? undefined : (filterStatus === "Active" ? 1 : 0);
            const res = await warehouseApi.getAll(currentPage, itemsPerPage, debouncedSearchTerm, status);
            if (res.isSuccessful) {
                // Backend returns results in res.data.records
                setWarehousesData(res.data.records);
                // Total count for pagination
                setTotalWarehouses(res.data.pagination.totalCount);
            }
        } catch (error) {
            console.error("Error fetching warehouses:", error);
        } finally {
            setIsListLoading(false);
        }
    };

    /**
     * Fetches paginated bins list from the backend.
     */
    const fetchBins = async () => {
        if (selectedMaster !== "Bins") return;
        if (!areBinFiltersReady) return;
        setIsListLoading(true);
        try {
            const warehouseId = filterWarehouse === "All" ? undefined : parseInt(filterWarehouse);
            const status = filterStatus === "All" ? undefined : (filterStatus === "Active" ? 1 : 0);
            const res = await binsApi.getAll(currentPage, itemsPerPage, debouncedSearchTerm, warehouseId, status);
            if (res.isSuccessful) {
                setBinsData(res.data.records);
                setTotalBins(res.data.pagination.totalCount);
            }
        } catch (error) {
            console.error("Error fetching bins:", error);
        } finally {
            setIsListLoading(false);
        }
    };

    const loadBinWarehousesData = async () => {
        const assignedWarehouseIds = getAssignedIds("warehouse");
        const whRes = await commonApi.getWarehouses();
        const items = extractItems(whRes);
        const warehouseRecords = items
            .map((item: any) => ({
                ...item,
                id: Number(item.id ?? item.warehouse_id),
                name: String(item.name ?? item.warehouse_name ?? "Unknown Warehouse").trim(),
            }))
            .filter((wh: { id: number; name: string }) => Number.isFinite(wh.id) && wh.name);
        setWarehousesListData(warehouseRecords);

        if (
            !appliedBinWarehouseFilterDefault.current &&
            assignedWarehouseIds.length > 0 &&
            warehouseRecords.length > 0
        ) {
            const ordered = prioritizeByAssigned(
                warehouseRecords,
                assignedWarehouseIds,
                (wh) => wh.id
            );
            const firstAssigned = getFirstAssignedMatch(
                assignedWarehouseIds,
                ordered.map((wh) => wh.id)
            );
            if (firstAssigned) {
                setFilterWarehouse(String(firstAssigned));
                appliedBinWarehouseFilterDefault.current = true;
            }
        }
    };

    useEffect(() => {
        if (selectedMaster !== "Bins") {
            setAreBinFiltersReady(true);
            return;
        }
        let cancelled = false;
        setAreBinFiltersReady(false);
        (async () => {
            try {
                await loadBinWarehousesData();
            } catch (error) {
                console.error("Error loading bin warehouse filters:", error);
            } finally {
                if (!cancelled) setAreBinFiltersReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedMaster, assignedWarehouseKey]);

    /**
     * Re-fetch list whenever filtering or pagination changes.
     */
    useEffect(() => {
        if (selectedMaster === "Warehouses") {
            fetchWarehouses();
        } else if (areBinFiltersReady) {
            fetchBins();
        }
    }, [currentPage, itemsPerPage, debouncedSearchTerm, selectedMaster, filterWarehouse, filterStatus, areBinFiltersReady]);

    /**
     * Reset pagination when search or filters change
     */
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, filterWarehouse, filterStatus]);

    /**
     * Warehouse form: department & location dropdowns use entity master in useCommonStore (no duplicate fetch here).
     */
    /*
    const fetchWarehouseDropdowns = async () => {
        setIsLoading(true);
        try {
            const [locRes, deptRes] = await Promise.allSettled([
                commonApi.getLocations(),
                commonApi.getDepartments()
            ]);
            if (locRes.status === 'fulfilled') {
                const items = extractItems(locRes.value);
                setCommonData({ locations: items });
            }
            if (deptRes.status === 'fulfilled') {
                const items = extractItems(deptRes.value);
                setCommonData({ departments: items });
            }
        } finally {
            setIsLoading(false);
        }
    };
    */

    const extractItems = (res: any): any[] => {
        if (!res) return [];
        if (res.isSuccessful && res.data) {
            if (Array.isArray(res.data)) return res.data;
            return res.data.records || res.data.items || [];
        }
        return [];
    };

    // Removed mount effect to avoid initial double-fetching, 
    // tab-specific dependencies are now handled in the route sync effect.


    const currentData = selectedMaster === "Warehouses" ? warehousesData : binsData;

    const totalPages = selectedMaster === "Warehouses" 
        ? Math.ceil(totalWarehouses / itemsPerPage)
        : Math.ceil(totalBins / itemsPerPage);

    const paginatedData = selectedMaster === "Warehouses"
        ? warehousesData
        : binsData;

    const getDefaultAssignedLocationId = () => {
        const assignedLocationIds = getAssignedIds("location");
        if (!assignedLocationIds.length || !orderedLocations.length) return undefined;
        return getFirstAssignedMatch(
            assignedLocationIds,
            orderedLocations.map((loc) => loc.id)
        );
    };

    const getDefaultAssignedWarehouseId = () => {
        const assignedWarehouseIds = getAssignedIds("warehouse");
        if (!assignedWarehouseIds.length || !orderedWarehousesForBin.length) return undefined;
        return getFirstAssignedMatch(
            assignedWarehouseIds,
            orderedWarehousesForBin.map((wh) => wh.id)
        );
    };

    const handleDialogOpenChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setIsFormDetailLoading(false);
            setIsFormDropdownsLoading(false);
            openingEditIdRef.current = null;
            setEditingId(null);
        }
    };

    const handleAddClick = async () => {
        if (openingEditIdRef.current !== null) return;
        setEditingId(null);
        setFormErrors({ code: "", name: "" });

        if (selectedMaster === "Warehouses") {
            const defaultLocationId = getDefaultAssignedLocationId();
            setFormData({
                status: "Active",
                name: "",
                code: "",
                work_location_id: defaultLocationId,
                department_id: undefined,
                address_notes: "",
            });
            setIsDialogOpen(true);
            return;
        }

        setIsDialogOpen(true);
        setIsFormDropdownsLoading(true);
        try {
            await loadBinWarehousesData();
            const defaultWarehouseId = getDefaultAssignedWarehouseId();
            setFormData({
                status: "Active",
                warehouse_id: defaultWarehouseId,
                bin_type_id: undefined,
                code: "",
                name: "",
                notes: "",
            });
        } catch (error) {
            console.error("Error preparing bin form:", error);
        } finally {
            setIsFormDropdownsLoading(false);
        }
    };

    /**
     * Handles clicking "Edit" for a record.
     * Fetches fresh full details (including IDs, and auxiliary fields) from the API.
     * Integrates with: 
     *  - GET /api/masters/warehouse/warehouses/{id} for Warehouses
     *  - GET /api/masters/inventory/bins/{id} for Bins
     */
    const handleEditClick = async (item: any) => {
        if (openingEditIdRef.current !== null) return;
        openingEditIdRef.current = item.id;
        setEditingId(item.id);
        setIsFormDetailLoading(true);
        setIsDialogOpen(true);
        setFormErrors({ code: "", name: "" });

        try {
            if (selectedMaster === "Bins") {
                await loadBinWarehousesData();
            }

            const apiCall =
                selectedMaster === "Warehouses"
                    ? warehouseApi.getOne(item.id)
                    : binsApi.getOne(item.id);

            const res = await apiCall;
            if (res.isSuccessful) {
                const fullItem = res.data;

                if (selectedMaster === "Warehouses") {
                    setFormData({
                        ...fullItem,
                        code: String(fullItem.code ?? "").slice(0, CODE_MAX_LENGTH),
                        name: String(fullItem.name ?? "").slice(0, NAME_MAX_LENGTH),
                        work_location_id: fullItem.work_location_id?.toString(),
                        department_id: fullItem.department_id?.toString(),
                        status: fullItem.status === 1 ? "Active" : "Inactive",
                    });
                } else {
                    setFormData({
                        ...fullItem,
                        code: String(fullItem.code ?? "").slice(0, CODE_MAX_LENGTH),
                        name: String(fullItem.name ?? "").slice(0, NAME_MAX_LENGTH),
                        warehouse_id: fullItem.warehouse_id?.toString(),
                        bin_type_id: fullItem.bin_type_id?.toString(),
                        status: fullItem.status === 1 ? "Active" : "Inactive",
                    });
                }
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: res.message || "Failed to fetch details",
                });
                handleDialogOpenChange(false);
            }
        } catch (error: any) {
            console.error("Error fetching details:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "An error occurred",
            });
            handleDialogOpenChange(false);
        } finally {
            setIsFormDetailLoading(false);
            openingEditIdRef.current = null;
        }
    };

    const handleDeleteClick = (id: number) => {
        setItemToDeleteID(id);
        setIsDeleteAlertOpen(true);
    };

    const handleWarehouseItemsClick = (warehouse: any) => {
        setActiveWarehouseForMapping(warehouse);
        const wid = Number(warehouse?.id);
        const existing = Number.isFinite(wid) ? (warehouseItemMappings[wid] || []) : [];
        setWarehouseItemDraft(existing);
        setSelectedWarehouseItemId(null);
        setWarehouseItemInlineError("");
        setIsWarehouseItemDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (itemToDeleteID === null) return;
        setIsDeleting(true);
        try {
            const apiCall = selectedMaster === "Warehouses"
                ? warehouseApi.delete(itemToDeleteID)
                : binsApi.delete(itemToDeleteID);

            const res = await apiCall;
            if (res.isSuccessful) {
                toast({ 
                    title: "Deleted", 
                    description: `${selectedMaster === "Warehouses" ? "Warehouse" : "Bin"} deleted successfully.`,
                    variant: "success"
                });
                if (selectedMaster === "Warehouses") fetchWarehouses();
                else fetchBins();
            } else {
                toast({ variant: "destructive", title: "Error", description: res.message || `Failed to delete ${selectedMaster === "Warehouses" ? "warehouse" : "bin"}.` });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "An error occurred." });
        } finally {
            setIsDeleting(false);
            setIsDeleteAlertOpen(false);
            setItemToDeleteID(null);
        }
    };

    /**
     * Handles saving new or edited records.
     * Maps the UI state (FormData) back to the numeric/typed API payload formats.
     */
    const handleSave = async () => {
        if (selectedMaster === "Warehouses") {
            if (!formData.code || !formData.name || !formData.status || !formData.work_location_id || !formData.department_id) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }

            if (formData.code.length > CODE_MAX_LENGTH) {
                toast({ variant: "destructive", title: "Validation Error", description: `Code cannot exceed ${CODE_MAX_LENGTH} characters` });
                return;
            }

            if (formData.name.length > NAME_MAX_LENGTH) {
                toast({ variant: "destructive", title: "Validation Error", description: `Name cannot exceed ${NAME_MAX_LENGTH} characters` });
                return;
            }

            setIsSubmitting(true);
            try {
                const apiPayload = {
                    code: formData.code,
                    name: formData.name,
                    work_location_id: parseInt(formData.work_location_id),
                    department_id: parseInt(formData.department_id),
                    status: formData.status === "Active" ? 1 : 0,
                    address_notes: formData.address_notes || "",
                };

                const res = editingId
                    ? await warehouseApi.update({ ...apiPayload, id: editingId })
                    : await warehouseApi.create(apiPayload);

                if (res.isSuccessful) {
                    toast({ 
                        title: editingId ? "Updated" : "Created", 
                        description: `Warehouse ${editingId ? "updated" : "created"} successfully`,
                        variant: "success"
                    });
                    setIsDialogOpen(false);
                    fetchWarehouses();
                } else {
                    toast({ variant: "destructive", title: "Error", description: res.message || `Failed to ${editingId ? "update" : "create"} warehouse` });
                }
            } catch (error: any) {
                toast({ variant: "destructive", title: "Error", description: error.message || "An error occurred" });
            } finally {
                setIsSubmitting(false);
            }
        } else {
            // Bins
            if (!formData.warehouse_id || !formData.code || !formData.name || !formData.status || !formData.bin_type_id) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }

            if (formData.code.length > CODE_MAX_LENGTH) {
                toast({ variant: "destructive", title: "Validation Error", description: `Code cannot exceed ${CODE_MAX_LENGTH} characters` });
                return;
            }

            if (formData.name.length > NAME_MAX_LENGTH) {
                toast({ variant: "destructive", title: "Validation Error", description: `Name cannot exceed ${NAME_MAX_LENGTH} characters` });
                return;
            }

            setIsSubmitting(true);
            try {
                const apiPayload = {
                    warehouse_id: parseInt(formData.warehouse_id),
                    code: formData.code,
                    name: formData.name,
                    bin_type_id: formData.bin_type_id ? parseInt(formData.bin_type_id) : null,
                    status: formData.status === "Active" ? 1 : 0,
                    notes: formData.notes || "",
                };

                const res = editingId
                    ? await binsApi.update(editingId, apiPayload)
                    : await binsApi.create(apiPayload);

                if (res.isSuccessful) {
                    toast({ 
                        title: editingId ? "Updated" : "Created", 
                        description: `Bin ${editingId ? "updated" : "created"} successfully`,
                        variant: "success"
                    });
                    setIsDialogOpen(false);
                    fetchBins();
                } else {
                    toast({ variant: "destructive", title: "Error", description: res.message || `Failed to ${editingId ? "update" : "create"} bin` });
                }
            } catch (error: any) {
                toast({ variant: "destructive", title: "Error", description: error.message || "An error occurred" });
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    // --- Renderers ---

    const renderListLoadingRow = (colSpan: number) => (
        <TableRow>
            <TableCell colSpan={colSpan} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </TableCell>
        </TableRow>
    );

    const renderTable = () => {
        if (selectedMaster === "Warehouses") {
            return (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Code</TableHead>
                            <TableHead>Warehouse Name</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead className="text-center">Bins</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isListLoading ? (
                            renderListLoadingRow(7)
                        ) : paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No warehouses found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => {
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{item.work_location_name || item.location}</TableCell>
                                        <TableCell>{item.department_name || item.department}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                                {item.bin_count || 0}
                                            </Badge>
                                        </TableCell>
                                        <TableCell><StatusBadge status={item.status === 1 || item.status === "Active" ? "Active" : "Inactive"} /></TableCell>
                                        <TableCell className="text-center">
                                            <TableActionButtons
                                                customActions={
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                            title="Manage Warehouse Items"
                                                            onClick={() => handleWarehouseItemsClick(item)}
                                                        >
                                                            <Package className="h-4 w-4" />
                                                        </Button>
                                                        {canEdit(universalKey) && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                onClick={() => { void handleEditClick(item); }}
                                                                title="Edit"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {canDelete(universalKey) && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                                onClick={() => handleDeleteClick(item.id)}
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </>
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            );
        } else {
            return (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Bin Code</TableHead>
                            <TableHead>Bin Name</TableHead>
                            <TableHead>Warehouse</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isListLoading ? (
                            renderListLoadingRow(6)
                        ) : paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No bins found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => {
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>
                                            <span 
                                                className="block" 
                                                style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                title={item.warehouse_name || "Unknown"}
                                            >
                                                {item.warehouse_name || "Unknown"}
                                            </span>
                                        </TableCell>
                                        <TableCell>{item.bin_type_name || "-"}</TableCell>
                                        <TableCell><StatusBadge status={item.status === 1 || item.status === "Active" ? "Active" : "Inactive"} /></TableCell>
                                        <TableCell className="text-center">
                                            <TableActionButtons
                                                onEdit={canEdit(universalKey) ? () => { void handleEditClick(item); } : undefined}
                                                onDelete={canDelete(universalKey) ? () => handleDeleteClick(item.id) : undefined}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            );
        }
    };

    const renderForm = () => {
        if (selectedMaster === "Warehouses") {
            return (
                <div className="grid gap-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="code" className="text-xs font-semibold">Warehouse Code *</Label>
                            <Input
                                id="code"
                                maxLength={CODE_MAX_LENGTH}
                                value={formData.code || ""}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, code: val });
                                    if (val.length > 0 && val.length < 2) {
                                        setFormErrors(prev => ({ ...prev, code: "Minimum 2 characters required" }));
                                    } else {
                                        setFormErrors(prev => ({ ...prev, code: "" }));
                                    }
                                }}
                                placeholder="Ex: WH01"
                                className={cn("h-9 focus-visible:ring-primary", formErrors.code && "border-destructive focus-visible:ring-destructive")}
                            />
                            {formErrors.code && <p className="text-[10px] text-destructive italic font-medium">{formErrors.code}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-xs font-semibold">Warehouse Name *</Label>
                            <Input
                                id="name"
                                maxLength={NAME_MAX_LENGTH}
                                value={formData.name || ""}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, name: val });
                                    if (val.length > 0 && val.length < 2) {
                                        setFormErrors(prev => ({ ...prev, name: "Minimum 2 characters required" }));
                                    } else {
                                        setFormErrors(prev => ({ ...prev, name: "" }));
                                    }
                                }}
                                placeholder="Main Warehouse"
                                className={cn("h-9 focus-visible:ring-primary", formErrors.name && "border-destructive focus-visible:ring-destructive")}
                            />
                            {formErrors.name && <p className="text-[10px] text-destructive italic font-medium">{formErrors.name}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label>Location *</Label>
                            <SearchableSelect
                                placeholder="Select Location"
                                value={formData.work_location_id?.toString()}
                                options={orderedLocations.map((loc) => ({
                                    label: loc.name,
                                    value: loc.id.toString(),
                                }))}
                                onChange={(val) => setFormData({ ...formData, work_location_id: val })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Department *</Label>
                            <SearchableSelect
                                placeholder="Select Department"
                                value={formData.department_id?.toString()}
                                options={departmentsData.map(dept => ({ label: dept.name, value: dept.id.toString() }))}
                                onChange={(val) => setFormData({ ...formData, department_id: val })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Status *</Label>
                            <SearchableSelect
                                placeholder="Select Status"
                                value={formData.status}
                                options={["Active", "Inactive"]}
                                onChange={(val) => setFormData({ ...formData, status: val as "Active" | "Inactive" })}
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="address">Address / Notes</Label>
                            <Textarea id="address" value={formData.address_notes || ""} onChange={e => setFormData({ ...formData, address_notes: e.target.value })} placeholder="Warehouse Address..." />
                        </div>
                    </div>
                </div>
            );
        } else if (selectedMaster === "Bins") {
            return (
                <div className="grid gap-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Warehouse *</Label>
                            <SearchableSelect
                                placeholder="Select Warehouse"
                                value={formData.warehouse_id?.toString()}
                                options={orderedWarehousesForBin.map((wh) => ({
                                    label: wh.name,
                                    value: wh.id.toString(),
                                }))}
                                onChange={(val) => setFormData({ ...formData, warehouse_id: val })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Status *</Label>
                            <SearchableSelect
                                placeholder="Select Status"
                                value={formData.status}
                                options={["Active", "Inactive"]}
                                onChange={(val) => setFormData({ ...formData, status: val as "Active" | "Inactive" })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bin_code" className="text-xs font-semibold">Bin Code *</Label>
                            <Input
                                id="bin_code"
                                maxLength={CODE_MAX_LENGTH}
                                value={formData.code || ""}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, code: val });
                                    if (val.length > 0 && val.length < 2) {
                                        setFormErrors(prev => ({ ...prev, code: "Minimum 2 characters required" }));
                                    } else {
                                        setFormErrors(prev => ({ ...prev, code: "" }));
                                    }
                                }}
                                placeholder="Ex: A-01"
                                className={cn("h-9 focus-visible:ring-primary", formErrors.code && "border-destructive focus-visible:ring-destructive")}
                            />
                            {formErrors.code && <p className="text-[10px] text-destructive italic font-medium">{formErrors.code}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bin_name" className="text-xs font-semibold">Bin Name *</Label>
                            <Input
                                id="bin_name"
                                maxLength={NAME_MAX_LENGTH}
                                value={formData.name || ""}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, name: val });
                                    if (val.length > 0 && val.length < 2) {
                                        setFormErrors(prev => ({ ...prev, name: "Minimum 2 characters required" }));
                                    } else {
                                        setFormErrors(prev => ({ ...prev, name: "" }));
                                    }
                                }}
                                placeholder="Rack 1, Shelf 1"
                                className={cn("h-9 focus-visible:ring-primary", formErrors.name && "border-destructive focus-visible:ring-destructive")}
                            />
                            {formErrors.name && <p className="text-[10px] text-destructive italic font-medium">{formErrors.name}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Bin Type *</Label>
                            <SearchableSelect
                                placeholder="Select Type"
                                value={formData.bin_type_id?.toString()}
                                options={binTypesData.map(type => ({ label: type.name || "Unknown", value: type.id?.toString() || "" }))}
                                onChange={(val) => setFormData({ ...formData, bin_type_id: val })}
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea id="notes" value={formData.notes || ""} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                        </div>
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full overflow-hidden">
            <div className="flex flex-col gap-2 shrink-0">
                <h1 className="text-3xl font-bold tracking-tight">Inventory Masters</h1>
                <p className="text-muted-foreground">
                    Manage warehouses, bins, and other inventory configurations.
                </p>
            </div>

            {!isMenuVisible(universalKey) ? (
                <Card className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-center p-6 border-dashed">
                    <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                        <X className="h-8 w-8 text-destructive" />
                    </div>
                    <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
                    <CardDescription className="max-w-xs">
                        You do not have permission to view Inventory Masters. Please contact your administrator for access.
                    </CardDescription>
                </Card>
            ) : (
                <Tabs value={activeTab} onValueChange={(value) => {
                    const masterType = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === value)?.[0] as MasterType;
                    if (masterType) handleMasterChange(masterType);
                }} className="w-full flex-1 flex flex-col min-h-0">
                    <div className="border-b border-border shrink-0">
                        <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                            {MASTER_TYPES.map((type) => (
                                <TabsTrigger
                                    key={type}
                                    value={MASTER_SLUGS[type]}
                                    onClick={() => handleMasterChange(type)}
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                                >
                                    {type}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="flex-1 flex flex-col gap-6 mt-6 overflow-y-auto pr-2 pb-6 custom-scrollbar">
                        <AppListToolbar
                            search={{
                                placeholder: `Search ${selectedMaster.toLowerCase()}...`,
                                value: searchTerm,
                                onChange: (val: string) => {
                                    setSearchTerm(val);
                                    setCurrentPage(1);
                                }
                            }}
                            filters={[
                                ...(selectedMaster === "Bins" ? [{
                                    type: "select" as const,
                                    label: "Warehouse",
                                    value: filterWarehouse,
                                    onChange: (val: string) => {
                                        setFilterWarehouse(val);
                                        setCurrentPage(1);
                                    },
                                                               options: [
                                        { label: "All Warehouses", value: "All" },
                                        ...orderedWarehousesForBin.map((w) => ({
                                            label: w.name || "Unknown",
                                            value: w.id?.toString() || "",
                                        }))
                                    ],
                                    searchable: true
                                }] : []),
                                {
                                    type: "select" as const,
                                    label: "Status",
                                    value: filterStatus,
                                    onChange: (val: string) => {
                                        setFilterStatus(val);
                                        setCurrentPage(1);
                                    },
                                    options: [
                                        { label: "All Status", value: "All" },
                                        { label: "Active", value: "Active" },
                                        { label: "Inactive", value: "Inactive" }
                                    ],
                                    searchable: true
                                }
                            ]}
                            actions={canCreate(universalKey) ? [
                                {
                                    label: `Create ${selectedMaster === "Warehouses" ? "Warehouse" : "Bin"}`,
                                    icon: <Plus className="mr-2 h-4 w-4" />,
                                    onClick: handleAddClick
                                }
                            ] : []}
                        />

                        {/* Main Table Content */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle>{selectedMaster} List</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    {renderTable()}
                                </div>

                                {!isListLoading && (
                                    <DataTablePagination
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        totalItems={selectedMaster === "Warehouses" ? totalWarehouses : totalBins}
                                        itemsPerPage={itemsPerPage}
                                        onPageChange={setCurrentPage}
                                        onItemsPerPageChange={setItemsPerPage}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </Tabs>
            )}

            {/* Universal Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent 
                    className="w-[95%] max-w-4xl xl:max-w-5xl max-h-[82vh] overflow-hidden p-0 flex flex-col gap-0 bg-white"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <div className="shrink-0 border-b bg-white px-6 py-5">
                        <DialogHeader className="p-0">
                            <DialogTitle>{editingId ? "Edit" : "Create"} {selectedMaster === "Warehouses" ? "Warehouse" : "Bin"}</DialogTitle>
                            <DialogDescription>
                                Configure the details for this {selectedMaster === "Warehouses" ? "warehouse" : "bin"}.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="relative flex-1 overflow-y-auto px-6 py-5">
                        {(isFormDetailLoading || isFormDropdownsLoading) && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            </div>
                        )}
                        {renderForm()}
                    </div>

                    <div className="shrink-0 border-t bg-white px-6 py-4 mt-auto flex justify-end gap-3">
                        <Button 
                            variant="outline" 
                            onClick={() => handleDialogOpenChange(false)} 
                            disabled={isSubmitting || isFormDetailLoading || isFormDropdownsLoading}
                            className="h-9 px-6 transition-all font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button 
                            loading={isSubmitting}
                            className={cn(
                                "min-w-[120px] h-9 transition-all font-semibold",
                                (() => {
                                    const isDisabled = (selectedMaster === "Warehouses" && (!formData.code || !formData.name || !formData.status || !formData.work_location_id || !formData.department_id)) ||
                                                     (selectedMaster === "Bins" && (!formData.warehouse_id || !formData.code || !formData.name || !formData.status || !formData.bin_type_id)) ||
                                                     !!formErrors.code || !!formErrors.name ||
                                                     isSubmitting ||
                                                     isFormDetailLoading ||
                                                     isFormDropdownsLoading;
                                    return isDisabled 
                                        ? "bg-slate-300 text-slate-600 cursor-not-allowed hover:bg-slate-300 border-none shadow-none" 
                                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95";
                                })()
                            )}
                            disabled={
                                (selectedMaster === "Warehouses" && (!formData.code || !formData.name || !formData.status || !formData.work_location_id || !formData.department_id)) ||
                                (selectedMaster === "Bins" && (!formData.warehouse_id || !formData.code || !formData.name || !formData.status || !formData.bin_type_id)) ||
                                !!formErrors.code || !!formErrors.name ||
                                isSubmitting ||
                                isFormDetailLoading ||
                                isFormDropdownsLoading
                            }
                            onClick={handleSave}
                        >
                            Save
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Warehouse Item Mapping Dialog (UI ONLY) */}
            <Dialog
                open={isWarehouseItemDialogOpen}
                onOpenChange={(open) => {
                    setIsWarehouseItemDialogOpen(open);
                    if (!open) {
                        setActiveWarehouseForMapping(null);
                        setSelectedWarehouseItemId(null);
                        setWarehouseItemInlineError("");
                        setWarehouseItemDraft([]);
                    }
                }}
            >
                <DialogContent className="flex w-[95%] max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-5xl">
                    <DialogHeader className="space-y-2 p-6 pb-5 shrink-0 border-b bg-white">
                        <DialogTitle>Manage Warehouse Items</DialogTitle>
                        <DialogDescription>
                            Map items available in this warehouse along with capacity and status.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
                            <div className="min-w-0 flex-1">
                                <SearchableSelect
                                    label="Search & select item..."
                                    value={selectedWarehouseItemId ?? undefined}
                                    options={MOCK_WAREHOUSE_ITEMS.map((it) => ({
                                        value: it.id,
                                        label: `${it.item_code} - ${it.item_name}`,
                                        primaryText: it.item_name,
                                        secondaryText: it.item_code,
                                        disabled: warehouseItemDraft.some((r) => r.item_id === it.id),
                                    }))}
                                    onChange={(val) => {
                                        setSelectedWarehouseItemId(val ? Number(val) : null);
                                        setWarehouseItemInlineError("");
                                    }}
                                    placeholder="Search & select item..."
                                    selectedTruncate="end"
                                    listClassName="max-h-[min(50vh,320px)]"
                                />
                                {warehouseItemInlineError && (
                                    <div className="mt-2 text-xs text-destructive">
                                        {warehouseItemInlineError}
                                    </div>
                                )}
                            </div>
                            <Button
                                type="button"
                                onClick={() => {
                                    if (!selectedWarehouseItemId) return;
                                    const selected = MOCK_WAREHOUSE_ITEMS.find((x) => x.id === selectedWarehouseItemId);
                                    if (!selected) return;
                                    const exists = warehouseItemDraft.some((r) => r.item_id === selectedWarehouseItemId);
                                    if (exists) {
                                        setWarehouseItemInlineError("Item already added");
                                        return;
                                    }
                                    setWarehouseItemDraft((prev) => ([
                                        ...prev,
                                        {
                                            item_id: selected.id,
                                            item_name: selected.item_name,
                                            item_code: selected.item_code,
                                            uom: selected.uom,
                                            capacity: "",
                                            status: "Active",
                                        }
                                    ]));
                                    setSelectedWarehouseItemId(null);
                                    setWarehouseItemInlineError("");
                                }}
                                disabled={!selectedWarehouseItemId}
                                className={cn(
                                    "h-10 px-6 font-semibold",
                                    selectedWarehouseItemId
                                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                                        : "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:opacity-100!"
                                )}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add
                            </Button>
                        </div>

                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Item Name</TableHead>
                                        <TableHead>Item Code</TableHead>
                                        <TableHead className="w-[120px]">UOM</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {warehouseItemDraft.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                                No items mapped for this warehouse.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        warehouseItemDraft.map((row, idx) => (
                                            <TableRow key={`${row.item_id}-${idx}`} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-medium">{row.item_name}</TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">{row.item_code}</TableCell>
                                                <TableCell className="text-sm">{row.uom || "-"}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="shrink-0 border-t bg-white px-6 py-4">
                        <DialogFooter className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsWarehouseItemDialogOpen(false)}
                                className="h-9 px-6 font-semibold"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    const wid = Number(activeWarehouseForMapping?.id);
                                    if (Number.isFinite(wid)) {
                                        setWarehouseItemMappings((prev) => ({ ...prev, [wid]: warehouseItemDraft }));
                                    }
                                    setIsWarehouseItemDialogOpen(false);
                                }}
                                className="bg-primary hover:bg-primary/90 h-9 px-6 font-semibold"
                            >
                                Save Mapping
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Record</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this record? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={confirmDelete} 
                            loading={isDeleting}
                            disabled={isDeleting}
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
