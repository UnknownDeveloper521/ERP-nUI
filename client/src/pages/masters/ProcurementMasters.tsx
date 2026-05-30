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
import { Plus, Search, Trash2, Package, Sliders, X, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { itemsApi, commonApi, materialThresholdApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { ProcurementSkuTab } from "@/pages/masters/ProcurementSkuTab";

/**
 * Entity master data (GET /api/common/getentityvalues)
 * -----------------------------------------------------
 * Item Type and UOM dropdowns use `useCommonStore` (`itemTypes`, `uoms`), loaded once when the user
 * is authenticated — `App.tsx` → `loadCommonData()` in `client/src/services/loadCommonData.ts`
 * (not inside `Login.tsx`). `fetchItemFormDeps` does not re-call getitemtypes/getuoms; legacy code
 * that did so is kept commented below. Items dropdown / employees for thresholds still call
 * `getItemsDropdown` / `getEmployeesWithDetail` separately (not entity batch).
 */

// --- Types & Interfaces ---

type MasterType = "SKU" | "Items" | "Material Threshold";

const MASTER_SLUGS: Record<MasterType, string> = {
    "SKU": "sku",
    "Items": "items",
    "Material Threshold": "material-master",
};

const MASTER_TYPES: MasterType[] = ["SKU", "Items", "Material Threshold"];

/** Matches DB `varchar(50)` on items.code */
const ITEM_CODE_MAX_LENGTH = 50;
/** Matches DB `varchar(200)` on items.name (Postgres 22001 if exceeded) */
const ITEM_NAME_MAX_LENGTH = 150;

/** Material threshold modal: upper/lower limits accept at most this many integer digits. */
const MAX_THRESHOLD_LIMIT_DIGITS = 10;
const THRESHOLD_LIMIT_MAX_VALUE = 10 ** MAX_THRESHOLD_LIMIT_DIGITS - 1;

const parseThresholdLimitInput = (raw: string): number | null => {
    if (!String(raw ?? "").trim()) return null;
    const intPart = String(raw).split(".")[0] ?? "";
    const digits = intPart.replace(/\D/g, "").slice(0, MAX_THRESHOLD_LIMIT_DIGITS);
    if (!digits) return null;
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : null;
};

/** Clamp values loaded from API into the same range as the form. */
const clampThresholdLimitFromApi = (n: number | null | undefined): number | null => {
    if (n === null || n === undefined) return null;
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    const floored = Math.floor(v);
    return Math.min(Math.max(floored, 0), THRESHOLD_LIMIT_MAX_VALUE);
};

interface Item {
    id: number;
    // Basic Info
    code: string;
    name: string;
    item_type_id: number;
    item_type_name?: string;
    uom_id: number;
    uom_name?: string;

    // Inventory Controls
    is_expiry_tracked: boolean;
    shelf_life_days?: number;
    warranty_period?: number; // Added warranty_period


    // Specification / Notes
    notes?: string; // Specification

    // RM Threshold
    daily_required_qty?: number;

    // Audit
    created_at?: string;
    created_by?: string;
    updated_at?: string;
    updated_by?: string;
}

interface MaterialMaster {
    id: number;
    code: string;
    name: string;
    item_type_id?: number;
    item_type_name?: string;
    uom_id?: number;
    uom_name?: string;
    threshold_configured: boolean;
    upper_limit?: number;
    upper_users?: SelectedUser[];
    lower_limit?: number;
    lower_users?: SelectedUser[];
    remarks?: string;
    created_at?: string;
}

interface SelectedUser {
    id: string;
    fullName: string;
    username: string;
    email: string;
    phone: string;
}

interface ThresholdData {
    id?: number;
    materialId: number | null;
    itemTypeId: number | null; // Added for reactive filtering
    upperLimit: number | null;
    upperSelectedUsers: SelectedUser[];
    lowerLimit: number | null;
    lowerSelectedUsers: SelectedUser[];
    remarks?: string;
}

// --- Mock Data ---




// Helper function to determine UOM based on item name
const getUOMForItem = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('acid') || lowerName.includes('oil') || lowerName.includes('solvent')) {
        return 'ltr';
    } else if (lowerName.includes('gloves') || lowerName.includes('mask') || lowerName.includes('tape')) {
        return 'nos';
    } else if (lowerName.includes('battery') || lowerName.includes('lead') || lowerName.includes('pallet')) {
        return 'kg';
    } else if (lowerName.includes('case') || lowerName.includes('lid') || lowerName.includes('separator') || lowerName.includes('terminal') || lowerName.includes('connector')) {
        return 'nos';
    } else if (lowerName.includes('gsv') || lowerName.includes('gsmx') || lowerName.includes('smf') || lowerName.includes('mf')) {
        return 'nos';
    }
    return 'kg'; // default
};

const initialItems: Item[] = [];
const initialMaterialMasters: MaterialMaster[] = [];

// --- Sub-components for Form Sections ---

const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 pb-2 mb-4 border-b">
        <h3 className="font-semibold text-sm text-primary">{title}</h3>
    </div>
);

export default function ProcurementMasters() {
    const { toast } = useToast();
    const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
    const universalKey = "MASTERS/PROCUREMENT";
    const [location, setLocation] = useLocation();
    const params = useParams();

    const getValidMaster = (type: string | undefined): MasterType => {
        if (type) {
            const entry = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === type);
            if (entry) return entry[0] as MasterType;
        }
        return "Items";
    };

    const selectedMaster = getValidMaster(params.type);
    const [activeTab, setActiveTab] = useState(MASTER_SLUGS[selectedMaster]);

    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [open, setOpen] = useState(false); // Master type selector open state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const updateRoute = (type: MasterType) => {
        const slug = MASTER_SLUGS[type] || type.toLowerCase();
        setLocation(`/masters/procurement/${slug}`);
    };

    const handleMasterChange = (newMaster: MasterType) => {
        const slug = MASTER_SLUGS[newMaster];
        setActiveTab(slug);
        setLocation(`/masters/procurement/${slug}`);
        setOpen(false);
        setFilterType("all");
        setCurrentPage(1);
    };

    useEffect(() => {
        const newMaster = getValidMaster(params.type);
        const newSlug = MASTER_SLUGS[newMaster];
        
        // Sync the active tab state if the URL parameter changes
        if (newSlug !== activeTab) {
            setActiveTab(newSlug);
        }

        // Item types / UOMs: login entity master (getEntityValues → loadCommonData → useCommonStore)

        if (location === '/masters/procurement') {
            setLocation('/masters/procurement/items');
        }
    }, [params.type, location]);

    // State for mock data

    const [items, setItems] = useState<Item[]>(initialItems);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [itemToDeleteID, setItemToDeleteID] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [itemFormData, setItemFormData] = useState<{
        code: string;
        name: string;
        item_type_id: any;
        uom_id: any;
        is_expiry_tracked: number;
        shelf_life_days: number;
        warranty_period: string | number;
        specifications: string;
    }>({
        code: "",
        name: "",
        item_type_id: "",
        uom_id: "",
        is_expiry_tracked: 0,
        shelf_life_days: 0,
        warranty_period: "",
        specifications: "",
    });

    const [itemFormErrors, setItemFormErrors] = useState({
        code: "",
        name: "",
        /** shelf_life: Tracks validation error for the conditional 'Shelf Life' field when 'Is Expiry Tracked' is active. */
        shelf_life: "",
        warranty_period: "",
    });

    const itemTypes = useCommonStore(state => state.itemTypes);
    const uoms = useCommonStore(state => state.uoms);

    const isFinishedGood = useMemo(() => {
        if (!Array.isArray(itemTypes)) return false;
        const selectedType = itemTypes.find((t: any) => t.id.toString() === itemFormData.item_type_id?.toString());
        const typeName = selectedType?.name ?? selectedType?.value_name ?? "";
        const typeLower = typeName.toLowerCase();
        return typeLower.includes("finished good") && !typeLower.includes("semi");
    }, [itemFormData.item_type_id, itemTypes]);

    // Filters
    const [filterType, setFilterType] = useState<string>("all");
    const [filterConfigured, setFilterConfigured] = useState<string>("all"); // "all" | "Configured" | "Not Configured"

    // Vendor Items Dialog State


    // Material Master State
    const [materialMasters, setMaterialMasters] = useState<MaterialMaster[]>(initialMaterialMasters);
    const [isThresholdDialogOpen, setIsThresholdDialogOpen] = useState(false);
    const [thresholdFormData, setThresholdFormData] = useState<ThresholdData>({
        materialId: null,
        itemTypeId: null,
        upperLimit: null,
        upperSelectedUsers: [],
        lowerLimit: null,
        lowerSelectedUsers: [],
        remarks: "",
    });
    const [tempUpperUserId, setTempUpperUserId] = useState<string>("");
    const [tempLowerUserId, setTempLowerUserId] = useState<string>("");
    const [originalUpperSelectedUsers, setOriginalUpperSelectedUsers] = useState<SelectedUser[]>([]);
    const [originalLowerSelectedUsers, setOriginalLowerSelectedUsers] = useState<SelectedUser[]>([]);


    // API Data Additional State — item types & UOMs from entity master (same rows as getitemtypes / getuoms)
    const itemTypeFilterOptions = useMemo(
        () =>
            (itemTypes || []).map((t: any) => ({
                label: String(t.name ?? t.value_name ?? ""),
                value: String(t.id),
            })),
        [itemTypes]
    );
    const [employees, setEmployees] = useState<any[]>([]);
    const [itemsDropdown, setItemsDropdown] = useState<any[]>([]);
    const [isListLoading, setIsListLoading] = useState(false);
    const [isFormDetailLoading, setIsFormDetailLoading] = useState(false);
    const [isThresholdFormDepsLoading, setIsThresholdFormDepsLoading] = useState(false);
    const [isThresholdItemsLoading, setIsThresholdItemsLoading] = useState(false);
    const openingEditIdRef = useRef<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Additional Pagination Metadata
    const [totalItemsCount, setTotalItemsCount] = useState(0);
    const [totalMaterialCount, setTotalMaterialCount] = useState(0);


    const handleAddUserToThreshold = (limitType: 'upper' | 'lower') => {
        const userId = limitType === 'upper' ? tempUpperUserId : tempLowerUserId;
        if (!userId) return;

        const user = employees.find(u => String(u.id) === String(userId));
        if (!user) return;

        const currentUsers = limitType === 'upper' ? thresholdFormData.upperSelectedUsers : thresholdFormData.lowerSelectedUsers;

        if (currentUsers.some(u => String(u.id) === String(userId))) {
            toast({ variant: "destructive", title: "Duplicate User", description: "This user is already added to this limit." });
            return;
        }

        setThresholdFormData(prev => ({
            ...prev,
            [limitType === 'upper' ? 'upperSelectedUsers' : 'lowerSelectedUsers']: [
                ...currentUsers,
                { id: user.id, fullName: user.employee_name, username: user.id.toString(), email: user.personal_email, phone: user.mobile_number }
            ]
        }));

        if (limitType === 'upper') setTempUpperUserId("");
        else setTempLowerUserId("");
    };

    const handleRemoveUserFromThreshold = (userId: string, limitType: 'upper' | 'lower') => {
        setThresholdFormData(prev => ({
            ...prev,
            [limitType === 'upper' ? 'upperSelectedUsers' : 'lowerSelectedUsers']:
                prev[limitType === 'upper' ? 'upperSelectedUsers' : 'lowerSelectedUsers'].filter(u => String(u.id) !== String(userId))
        }));
    };

    /**
     * FETCH ITEMS BY TYPE:
     * Specific fetch for Material Threshold modal to ensure latest items
     * are loaded when selection changes.
     */
    const fetchItemsByTypeId = async (typeId: number) => {
        setIsThresholdItemsLoading(true);
        try {
            const res = await commonApi.getItemsDropdown({ item_type_id: typeId, status: 1 });
            if (res.isSuccessful) {
                setItemsDropdown(res.data.records);
            }
        } catch (error) {
            console.error("Error fetching items by type:", error);
        } finally {
            setIsThresholdItemsLoading(false);
        }
    };


    // --- Data Fetching Functions ---

    /*
    const fetchTabDeps = async () => {
        try {
            const itemTypesRes = await commonApi.getItemTypes();
            const items = extractItems(itemTypesRes);
            setItemTypesListData(items);
            setCommonData({ itemTypes: items });
        } catch (error) {
            console.error("Error fetching tab deps:", error);
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

    /** Items form: item type & UOM come from `useCommonStore` (post-login entity batch). No per-open fetch. */
    const fetchItemFormDeps = async () => {
        // Intentionally empty — itemTypes / uoms are set by loadCommonData() after auth (see App.tsx).
        /*
        setIsLoading(true);
        try {
            const [itemTypesRes, uomsRes] = await Promise.all([
                commonApi.getItemTypes(),
                commonApi.getUOMs(1),
            ]);
            if (itemTypesRes.isSuccessful) {
                setCommonData({ itemTypes: itemTypesRes.data.records });
            }
            if (uomsRes.isSuccessful) {
                setCommonData({ uoms: uomsRes.data.records || uomsRes.data });
            }
        } catch (error) {
            console.error("Error fetching item form deps:", error);
        } finally {
            setIsLoading(false);
        }
        */
    };

    /** Material threshold form: items + employees from API; item types from entity master store. */
    const loadThresholdFormDepsData = async () => {
        const [itemsRes, employeesRes] = await Promise.all([
            commonApi.getItemsDropdown(),
            commonApi.getEmployeesWithDetail(),
        ]);

        if (itemsRes.isSuccessful) {
            setItemsDropdown(itemsRes.data.records);
        }
        if (employeesRes.isSuccessful) {
            setEmployees(employeesRes.data.records);
        }
    };

    const fetchThresholdFormDeps = async () => {
        setIsThresholdFormDepsLoading(true);
        try {
            await loadThresholdFormDepsData();
        } catch (error) {
            console.error("Error fetching threshold form deps:", error);
        } finally {
            setIsThresholdFormDepsLoading(false);
        }
    };

    const fetchDropdowns = async () => {
        // Targeted fetching based on selected master during form open
        if (selectedMaster === "Items") {
            await fetchItemFormDeps();
        } else {
            await fetchThresholdFormDeps();
        }
    };

    const fetchEmployees = async () => {
        // Now handled inside fetchThresholdFormDeps
        try {
            const res = await commonApi.getEmployeesWithDetail();
            if (res.isSuccessful) {
                setEmployees(res.data.records);
            }
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    /**
     * Exact total row count when the API omits totalCount. Uses the same limit (itemsPerPage+1)
     * and page stepping as the backend offset so "Showing 1 to 10 of 12" matches reality.
     * Only invoked when the current response indicates another page exists (extra requests).
     */
    const countItemsTotalExact = async (item_type_id: number | undefined): Promise<number> => {
        let total = 0;
        let page = 1;
        const limit = itemsPerPage;
        while (true) {
            const res = await itemsApi.getAll(page, limit, debouncedSearchTerm, item_type_id);
            if (!res.isSuccessful) break;
            const pagination = res.data.pagination;
            if (pagination && pagination.totalCount !== undefined) return pagination.totalCount;
            const rawFetchedRecords = res.data.records || [];
            const fetchedRecords =
                filterType === "all"
                    ? rawFetchedRecords
                    : rawFetchedRecords.filter((r: any) => String(r.item_type_id) === filterType);
            const n = fetchedRecords.length;
            if (n === 0) break;
            total += n;
            if (n <= itemsPerPage) break;
            page++;
        }
        return total;
    };

    const countMaterialThresholdTotalExact = async (type_id: number | undefined): Promise<number> => {
        let total = 0;
        let page = 1;
        const limit = itemsPerPage;
        while (true) {
            const res = await materialThresholdApi.getAll(page, limit, debouncedSearchTerm, type_id);
            if (!res.isSuccessful) break;
            const pagination = res.data.pagination;
            if (pagination && pagination.totalCount !== undefined) return pagination.totalCount;
            const rawFetchedRecords = res.data.records || [];
            const filtered =
                filterType === "all"
                    ? rawFetchedRecords
                    : rawFetchedRecords.filter((r: any) => String(r.item_type_id) === filterType);
            const n = filtered.length;
            if (n === 0) break;
            total += n;
            if (n <= itemsPerPage) break;
            page++;
        }
        return total;
    };

    /**
     * FETCH MATERIAL THRESHOLDS:
     * Integrates GET /api/masters/materialthreshold
     * Uses Blind Pagination workaround.
     */
    const fetchMaterialThresholds = async () => {
        if (selectedMaster !== "Material Threshold") return;
        setIsListLoading(true);
        try {
            /**
             * --- FRONTEND PAGINATION WORKAROUND ---
             * The backend 'materialThresholdService.getMaterialThresholds' currently has a bug where 
             * 'totalCount' is returning 'rawData.length' (only items on the current page).
             * 
             * To fix this without backend changes, we request 'itemsPerPage + 1':
             * 1. If we get 11 instead of 10, we know a 'Next' page exists.
             * 2. We then slice back to 10 and fake the 'totalMaterialCount' to enable the 'Next' button.
             */
            const type_id = filterType === "all" ? undefined : parseInt(filterType);
            const res = await materialThresholdApi.getAll(currentPage, itemsPerPage, debouncedSearchTerm, type_id);
            if (res.isSuccessful) {
                const rawFetchedRecords = res.data.records || [];
                
                // --- DATA ENRICHMENT & NORMALIZATION ---
                // If backend returns incomplete records (missing name/type), we 'join' them locally
                const rawEnrichedRecords = rawFetchedRecords.map((record: any) => {
                    const enriched = { ...record };
                    
                    // 1. Key Normalization (Handle item_name vs name)
                    if (!enriched.name && enriched.item_name) enriched.name = enriched.item_name;
                    if (!enriched.code && enriched.item_code) enriched.code = enriched.item_code;
                    
                    // 2. Data Enrichment (Lookup in itemsDropdown if still missing)
                    if (!enriched.name && enriched.item_id) {
                        const itemMatch = itemsDropdown.find(i => i.id === enriched.item_id);
                        if (itemMatch) {
                            enriched.name = itemMatch.name;
                            enriched.code = itemMatch.code;
                            if (!enriched.item_type_id) enriched.item_type_id = itemMatch.item_type_id;
                            if (!enriched.item_type_name) enriched.item_type_name = itemMatch.item_type_name;
                        }
                    }
                    
                    // 3. Item Type Resolution (Lookup in itemTypes store if still missing)
                    if (!enriched.item_type_name && enriched.item_type_id) {
                        const typeMatch = itemTypes.find(t => t.id === enriched.item_type_id);
                        if (typeMatch) enriched.item_type_name = (typeMatch as any).name ?? (typeMatch as any).value_name;
                    }

                    return enriched;
                });

                const filteredEnrichedRecords = filterType === "all" 
                    ? rawEnrichedRecords 
                    : rawEnrichedRecords.filter((r: any) => String(r.item_type_id) === filterType);

                const pagination = res.data.pagination;
                const hasNextPage = pagination?.totalCount ? (currentPage * itemsPerPage < pagination.totalCount) : (rawFetchedRecords.length >= itemsPerPage);
                const pageRecords = filteredEnrichedRecords;
                
                setMaterialMasters(pageRecords);

                let totalRows: number;
                if (pagination && pagination.totalCount !== undefined) {
                    totalRows = pagination.totalCount;
                } else if (!hasNextPage) {
                    totalRows = (currentPage - 1) * itemsPerPage + filteredEnrichedRecords.length;
                } else {
                    totalRows = await countMaterialThresholdTotalExact(type_id);
                }
                setTotalMaterialCount(totalRows);
            }
        } catch (error) {
            console.error("Error fetching material thresholds:", error);
        } finally {
            setIsListLoading(false);
        }
    };

    /**
     * FETCH ITEMS:
     * Integrates GET /api/masters/items
     * Uses Blind Pagination workaround.
     */
    const fetchItems = async () => {
        if (selectedMaster !== "Items") return;
        setIsListLoading(true);
        try {
            const item_type_id = filterType === "all" ? undefined : parseInt(filterType);
            
            /**
             * --- FRONTEND PAGINATION WORKAROUND ---
             * Similarly, the backend 'itemsService.getItems' also skips the true total count.
             * We fetch 'limit + 1' here to provide functional 'Prev' and 'Next' navigation.
             */
            const res = await itemsApi.getAll(currentPage, itemsPerPage, debouncedSearchTerm, item_type_id);
            if (res.isSuccessful) {
                const rawFetchedRecords = res.data.records || [];

                const fetchedRecords = filterType === "all" 
                    ? rawFetchedRecords 
                    : rawFetchedRecords.filter((r: any) => String(r.item_type_id) === filterType);

                const pagination = res.data.pagination;
                const hasNextPage = pagination?.totalCount ? (currentPage * itemsPerPage < pagination.totalCount) : (rawFetchedRecords.length >= itemsPerPage);
                const pageRecords = fetchedRecords;
                
                setItems(pageRecords);

                let totalRows: number;
                if (pagination && pagination.totalCount !== undefined) {
                    totalRows = pagination.totalCount;
                } else if (!hasNextPage) {
                    totalRows = (currentPage - 1) * itemsPerPage + fetchedRecords.length;
                } else {
                    totalRows = await countItemsTotalExact(item_type_id);
                }
                setTotalItemsCount(totalRows);
            }
        } catch (error) {
            console.error("Error fetching items:", error);
        } finally {
            setIsListLoading(false);
        }
    };

    const fetchThresholdDetails = async (id: number) => {
        setIsFormDetailLoading(true);
        setIsThresholdDialogOpen(true);
        try {
            await loadThresholdFormDepsData();

            const res = await materialThresholdApi.getOne(id);
            if (res.isSuccessful) {
                const data = res.data;
                setEditingId(data.id);
                

                
                const mappedUpperUsers = (data.upper_limit_users || []).map((u: any) => ({
                    id: u.id.toString(),
                    fullName: u.employee_name,
                    username: u.id.toString(),
                    email: u.personal_email,
                    phone: u.mobile_number
                }));
                
                const mappedLowerUsers = (data.lower_limit_users || []).map((u: any) => ({
                    id: u.id.toString(),
                    fullName: u.employee_name,
                    username: u.id.toString(),
                    email: u.personal_email,
                    phone: u.mobile_number
                }));

                setThresholdFormData({
                    id: data.id,
                    materialId: data.item_id,
                    itemTypeId: data.item_type_id || null,
                    upperLimit:
                        data.upper_limit !== undefined && data.upper_limit !== null
                            ? clampThresholdLimitFromApi(data.upper_limit)
                            : null,
                    upperSelectedUsers: mappedUpperUsers,
                    lowerLimit:
                        data.lower_limit !== undefined && data.lower_limit !== null
                            ? clampThresholdLimitFromApi(data.lower_limit)
                            : null,
                    lowerSelectedUsers: mappedLowerUsers,
                    remarks: data.remarks || "",
                });
                
                setOriginalUpperSelectedUsers(mappedUpperUsers);
                setOriginalLowerSelectedUsers(mappedLowerUsers);
            }
        } catch (error: any) {
            console.error("Error fetching threshold details:", error);
        } finally {
            setIsFormDetailLoading(false);
            openingEditIdRef.current = null;
        }
    };

    const fetchItemDetails = async (id: number) => {
        setIsFormDetailLoading(true);
        setIsDialogOpen(true);
        try {
            await fetchItemFormDeps(); // Fresh types and UOMs
            const res = await itemsApi.getOne(id);
            if (res.isSuccessful) {
                const item = res.data;
                setEditingId(item.id);
                setItemFormData({
                    code: String(item.code ?? "").slice(0, ITEM_CODE_MAX_LENGTH),
                    name: String(item.name ?? "").slice(0, ITEM_NAME_MAX_LENGTH),
                    item_type_id: item.item_type_id,
                    uom_id: item.uom_id,
                    is_expiry_tracked: (item.is_expiry_tracked === 1 || item.is_expiry_tracked === true) ? 1 : 0,
                    shelf_life_days: item.shelf_life || 0,
                    warranty_period: item.warranty_period || "",
                    specifications: item.specification || "",
                });
            }
        } catch (error: any) {
            console.error("Error fetching item details:", error);
        } finally {
            setIsFormDetailLoading(false);
            openingEditIdRef.current = null;
        }
    };

    const handleItemDialogOpenChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setIsFormDetailLoading(false);
            openingEditIdRef.current = null;
            setEditingId(null);
        }
    };

    const handleThresholdDialogOpenChange = (open: boolean) => {
        if (!open) {
            setTempUpperUserId("");
            setTempLowerUserId("");
            setIsFormDetailLoading(false);
            openingEditIdRef.current = null;
            setEditingId(null);
        }
        setIsThresholdDialogOpen(open);
    };

    // --- Effects ---

    // Removed mount effect to avoid initial double-fetching, 
    // tab-specific dependencies are now handled in the route sync effect.

    useEffect(() => {
        if (selectedMaster === "Items") {
            fetchItems();
        } else if (selectedMaster === "Material Threshold") {
            fetchMaterialThresholds();
        }
    }, [selectedMaster, currentPage, itemsPerPage, debouncedSearchTerm, filterType]);

    // Reset pagination when search or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, filterType]);

    // useEffect(() => {
    //     if (isDialogOpen || isThresholdDialogOpen) {
    //         fetchDropdowns();
    //     }
    // }, [isDialogOpen, isThresholdDialogOpen]);

    // --- Helpers ---

    // --- Pagination & Filtering Meta ---
    const totalPages = Math.ceil(
        (selectedMaster === "Items" ? totalItemsCount : totalMaterialCount) / itemsPerPage
    );

    const paginatedData = (selectedMaster === "Items" ? items : materialMasters).slice(0, itemsPerPage);

    const handleAddClick = async () => {
        setEditingId(null);
        await fetchDropdowns(); // Ensure fresh UOMs and Types
        if (selectedMaster === "Items") {
            setItemFormData({
                code: "",
                name: "",
                item_type_id: "",
                uom_id: "",
                is_expiry_tracked: 0,
                shelf_life_days: 0,
                warranty_period: "",
                specifications: "",
            });
            setItemFormErrors({ code: "", name: "", shelf_life: "", warranty_period: "" });
        }
        setIsDialogOpen(true);
    };

    const handleEditClick = async (item: any) => {
        if (openingEditIdRef.current !== null) return;
        openingEditIdRef.current = item.id;
        setEditingId(item.id);
        try {
            if (selectedMaster === "Items") {
                await fetchItemDetails(item.id);
            } else if (selectedMaster === "Material Threshold") {
                await fetchThresholdDetails(item.id);
            }
        } catch {
            openingEditIdRef.current = null;
        }
    };

    const handleDeleteClick = (id: number) => {
        setItemToDeleteID(id);
        setIsDeleteAlertOpen(true);
    };

    const confirmDelete = async () => {
        if (itemToDeleteID === null) return;
        setIsDeleting(true);
        try {
            const api = selectedMaster === "Items" ? itemsApi : materialThresholdApi;
            const res = await api.delete(itemToDeleteID);
            if (res.isSuccessful) {
                toast({ 
                    title: "Deleted", 
                    description: res.message || "Record deleted successfully.",
                    variant: "success"
                });
                if (selectedMaster === "Items") fetchItems();
                else fetchMaterialThresholds();
            } else {
                toast({ variant: "destructive", title: "Error", description: res.message || "Delete failed" });
            }
        } catch (error: any) {
            console.error("Delete error:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "An error occurred" });
        } finally {
            setIsDeleting(false);
            setIsDeleteAlertOpen(false);
            setItemToDeleteID(null);
        }
    };

    const handleThresholdSave = async () => {
        const { materialId, itemTypeId, upperLimit, lowerLimit, upperSelectedUsers, lowerSelectedUsers } = thresholdFormData;

        if (!materialId) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please select an item." });
            return;
        }

        // 1. Activity checks — a limit is 'active' if it's explicitly set (>0 for Upper, >=0 for Lower) OR users are assigned.
        // We use Number.isFinite to check for non-null values.
        const isUpperActive = (upperLimit !== null && upperLimit > 0) || upperSelectedUsers.length > 0;
        const isLowerActive = (lowerLimit !== null && lowerLimit >= 0) || (lowerLimit === 0 && lowerSelectedUsers.length > 0) || (lowerLimit !== null && lowerSelectedUsers.length > 0);
        
        // Simplified Lower check: if it's set as a number OR users assigned
        const isLowerSet = lowerLimit !== null || lowerSelectedUsers.length > 0;
        
        // Let's refine based on the specific business rules:
        // Upper must be > 0. Lower can be >= 0.
        const isUpperValid = upperLimit !== null && upperLimit > 0;
        const isLowerValid = lowerLimit !== null && lowerLimit >= 0;

        if (!isUpperActive && !isLowerActive) {
            toast({ variant: "destructive", title: "Validation Error", description: "Either Upper Limit or Lower Limit is required" });
            return;
        }

        // 2. Upper Limit Validation
        if (isUpperActive) {
            if (upperLimit === null || upperLimit <= 0) {
                toast({ variant: "destructive", title: "Validation Error", description: "Upper Limit must be greater than 0" });
                return;
            }
            if (upperSelectedUsers.length === 0) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please assign at least one user for the Upper Limit" });
                return;
            }
        }

        // 3. Lower Limit Validation
        if (isLowerActive) {
            if (lowerLimit === null || lowerLimit < 0) {
                toast({ variant: "destructive", title: "Validation Error", description: "Lower Limit cannot be less than 0" });
                return;
            }
            if (lowerSelectedUsers.length === 0) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please assign at least one user for the Lower Limit" });
                return;
            }
        }

        // 4. Combined Validation
        if (isUpperActive && isLowerActive && upperLimit !== null && lowerLimit !== null) {
            if (upperLimit <= lowerLimit) {
                toast({ variant: "destructive", title: "Validation Error", description: "Upper Limit must be greater than Lower Limit" });
                return;
            }
        }

        setIsSubmitting(true);
        try {
            let apiData: any = {
                item_id: materialId,
                upper_limit: isUpperActive ? upperLimit : null,
                lower_limit: isLowerActive ? lowerLimit : null,
                remarks: thresholdFormData.remarks,
                item_type_id: itemTypeId,
            };

            if (editingId) {
                // Calculate deltas for updates
                const upperAdd = upperSelectedUsers.filter(u => !originalUpperSelectedUsers.some(ou => ou.id === u.id));
                const upperDelete = originalUpperSelectedUsers.filter(ou => !upperSelectedUsers.some(u => u.id === ou.id));
                
                const lowerAdd = lowerSelectedUsers.filter(u => !originalLowerSelectedUsers.some(ou => ou.id === u.id));
                const lowerDelete = originalLowerSelectedUsers.filter(ou => !lowerSelectedUsers.some(u => u.id === ou.id));

                apiData.upper_limit_users_add = upperAdd.map(u => ({ employee_id: parseInt(u.id) }));
                apiData.upper_limit_users_delete = upperDelete.map(u => ({ employee_id: parseInt(u.id) }));
                apiData.lower_limit_users_add = lowerAdd.map(u => ({ employee_id: parseInt(u.id) }));
                apiData.lower_limit_users_delete = lowerDelete.map(u => ({ employee_id: parseInt(u.id) }));
            } else {
                // For creation, send the full list with employee_id
                apiData.upper_limit_users = upperSelectedUsers.map(u => ({ employee_id: parseInt(u.id) }));
                apiData.lower_limit_users = lowerSelectedUsers.map(u => ({ employee_id: parseInt(u.id) }));
            }

            const res = editingId 
                ? await materialThresholdApi.update(editingId, apiData)
                : await materialThresholdApi.create(apiData);

            if (res.isSuccessful) {
                toast({ 
                    title: editingId ? "Threshold Updated" : "Threshold Created", 
                    description: res.message || "Operation successful",
                    variant: "success"
                });
                setIsThresholdDialogOpen(false);
                fetchMaterialThresholds();
            } else {
                toast({ variant: "destructive", title: "Error", description: res.message || "Save failed" });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "An error occurred" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveItem = async () => {
        // Item Validation
        if (!itemFormData.code || !itemFormData.name || !itemFormData.item_type_id || !itemFormData.uom_id) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
            return;
        }

        // Shelf Life Validation (Conditional)
        /**
         * REQUIREMENT: When 'Is Expiry Tracked' is checked, 'Shelf Life (Days)' must be a positive integer.
         * If tracking is enabled but shelf life is 0/empty, we set a form error and prevent the API call.
         */
        if (itemFormData.is_expiry_tracked && (!itemFormData.shelf_life_days || itemFormData.shelf_life_days <= 0)) {
            setItemFormErrors(prev => ({ ...prev, shelf_life: "Shelf Life is required when Expiry is tracked" }));
            toast({ variant: "destructive", title: "Validation Error", description: "Shelf Life is required when Expiry is tracked" });
            return;
        }
        if (itemFormData.code.length > ITEM_CODE_MAX_LENGTH) {
            toast({ variant: "destructive", title: "Validation Error", description: `Item Code cannot exceed ${ITEM_CODE_MAX_LENGTH} characters` });
            return;
        }
        if (itemFormData.name.length > ITEM_NAME_MAX_LENGTH) {
            toast({ variant: "destructive", title: "Validation Error", description: `Item Name cannot exceed ${ITEM_NAME_MAX_LENGTH} characters` });
            return;
        }

        // Warranty Period Validation (>= 0)
        if (isFinishedGood && itemFormData.warranty_period !== "" && Number(itemFormData.warranty_period) < 0) {
            setItemFormErrors(prev => ({ ...prev, warranty_period: "Warranty Period cannot be negative" }));
            toast({ variant: "destructive", title: "Validation Error", description: "Warranty Period cannot be negative" });
            return;
        }

        /** Select components pass string values; server requires typeof === 'number' (itemsService.createItem). */
        const itemTypeId = parseInt(String(itemFormData.item_type_id), 10);
        const uomId = parseInt(String(itemFormData.uom_id), 10);
        if (
            !Number.isFinite(itemTypeId) ||
            itemTypeId <= 0 ||
            !Number.isFinite(uomId) ||
            uomId <= 0
        ) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Invalid item type or UOM selection.",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const apiData = {
                code: itemFormData.code,
                name: itemFormData.name,
                item_type_id: itemTypeId,
                uom_id: uomId,
                is_expiry_tracked: itemFormData.is_expiry_tracked,
                shelf_life: itemFormData.is_expiry_tracked ? itemFormData.shelf_life_days : null,
                warranty_period: isFinishedGood ? (itemFormData.warranty_period === "" ? null : Number(itemFormData.warranty_period)) : null,
                specification: itemFormData.specifications,
            };

            const res = editingId 
                ? await itemsApi.update(editingId, apiData)
                : await itemsApi.create(apiData);
            
            if (res.isSuccessful) {
                toast({ 
                    title: editingId ? "Item Updated" : "Item Created", 
                    description: res.message || "Operation successful",
                    variant: "success"
                });
                setIsDialogOpen(false);
                fetchItems();
            } else {
                toast({ variant: "destructive", title: "Error", description: res.message || "Save failed" });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "An error occurred" });
        } finally {
            setIsSubmitting(false);
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
        if (selectedMaster === "Material Threshold") {
            return (
                <Table className="table-fixed w-full min-w-[940px]">
                    <colgroup>
                        <col className="w-[500px] min-w-[360px]" />
                        <col className="w-[180px]" />
                        <col className="w-[150px]" />
                        <col className="w-[150px]" />
                        <col className="w-[100px]" />
                    </colgroup>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Item Name</TableHead>
                            <TableHead className="align-middle">Type</TableHead>
                            <TableHead className="align-middle text-center">Upper Limit</TableHead>
                            <TableHead className="align-middle text-center">Lower Limit</TableHead>
                            <TableHead className="align-middle text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isListLoading ? (
                            renderListLoadingRow(5)
                        ) : paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No material masters found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="flex flex-col min-w-0">
                                            <span 
                                                className="font-medium whitespace-normal wrap-break-word [word-break:break-word]"
                                                title={item.name}
                                            >
                                                {item.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{item.code}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">{item.item_type_name}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className={cn(
                                            "text-sm font-semibold", 
                                            (item.upper_limit === null || item.upper_limit === undefined) ? "text-muted-foreground italic font-normal" : "text-blue-600"
                                        )}>
                                            {(item.upper_limit !== null && item.upper_limit !== undefined) ? item.upper_limit : "Not assigned"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className={cn(
                                            "text-sm font-semibold", 
                                            (item.lower_limit === null || item.lower_limit === undefined) ? "text-muted-foreground italic font-normal" : "text-orange-600"
                                        )}>
                                            {(item.lower_limit !== null && item.lower_limit !== undefined) ? item.lower_limit : "Not assigned"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <TableActionButtons
                                            onEdit={canEdit(universalKey) ? () => { void handleEditClick(item); } : undefined}
                                            onDelete={canDelete(universalKey) ? () => handleDeleteClick(item.id) : undefined}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            );
        } else {
            // Items Table — fixed layout + wrapping name; sticky actions when horizontal scroll
            return (
                <Table className="table-fixed w-full min-w-[940px]">
                    <colgroup>
                        <col className="w-[140px]" />
                        <col className="w-[360px] min-w-[300px]" />
                        <col className="w-[220px]" />
                        <col className="w-[120px]" />
                        <col className="w-[100px]" />
                    </colgroup>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="align-middle">Item Code</TableHead>
                            <TableHead className="min-w-0 align-middle">Item Name</TableHead>
                            <TableHead className="align-middle">Type</TableHead>
                            <TableHead className="align-middle">UOM</TableHead>
                            <TableHead className="sticky right-0 z-20 w-[100px] min-w-[100px] bg-muted/50 text-center align-middle">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isListLoading ? (
                            renderListLoadingRow(5)
                        ) : paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No items found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => (
                                <TableRow key={item.id} className="group">
                                    <TableCell className="max-w-[140px] align-top font-medium wrap-break-word whitespace-normal [word-break:break-word]">
                                        {item.code}
                                    </TableCell>
                                    <TableCell className="min-w-[300px] max-w-[360px] align-top whitespace-normal wrap-break-word [word-break:break-word]">
                                        {item.name}
                                    </TableCell>
                                    <TableCell className="align-top wrap-break-word whitespace-normal [word-break:break-word]">
                                        {item.item_type_name}
                                    </TableCell>
                                    <TableCell className="align-top whitespace-normal wrap-break-word">
                                        {item.uom_name}
                                    </TableCell>
                                    <TableCell
                                        className={cn(
                                            "sticky right-0 z-10 w-[100px] min-w-[100px] bg-background text-center align-top",
                                            "group-hover:bg-muted/50",
                                        )}
                                    >
                                        <TableActionButtons
                                            onEdit={canEdit(universalKey) ? () => { void handleEditClick(item); } : undefined}
                                            onDelete={canDelete(universalKey) ? () => handleDeleteClick(item.id) : undefined}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            );
        }
    };

    const renderForm = () => {
        // Items Form
        return (
            <div className="grid gap-6">
                {/* A) Basic Info */}
                <div>
                    <SectionHeader title="Basic Info" />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="item_code" className="text-xs font-semibold">Item Code *</Label>
                            <Input
                                id="item_code"
                                value={itemFormData.code}
                                maxLength={ITEM_CODE_MAX_LENGTH}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setItemFormData((prev) => ({ ...prev, code: val }));
                                    let codeErr = "";
                                    if (val.length > 0 && val.length < 2) {
                                        codeErr = "Minimum 2 characters required";
                                    }
                                    setItemFormErrors((prev) => ({ ...prev, code: codeErr }));
                                }}
                                placeholder="Ex: RM003"
                                className={cn("h-9 focus-visible:ring-primary", itemFormErrors.code && "border-destructive focus-visible:ring-destructive")}
                            />
                            {itemFormErrors.code && <p className="text-[10px] text-destructive italic font-medium">{itemFormErrors.code}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="item_name" className="text-xs font-semibold">Item Name *</Label>
                            <Input
                                id="item_name"
                                value={itemFormData.name}
                                maxLength={ITEM_NAME_MAX_LENGTH}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setItemFormData((prev) => ({ ...prev, name: val }));
                                    let nameErr = "";
                                    if (val.length > 0 && val.length < 2) {
                                        nameErr = "Minimum 2 characters required";
                                    }
                                    setItemFormErrors((prev) => ({ ...prev, name: nameErr }));
                                }}
                                placeholder="Item Name"
                                className={cn("h-9 focus-visible:ring-primary", itemFormErrors.name && "border-destructive focus-visible:ring-destructive")}
                            />
                            {itemFormErrors.name && <p className="text-[10px] text-destructive italic font-medium">{itemFormErrors.name}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">Item Type *</Label>
                            <SearchableSelect
                                placeholder="Select Type"
                                value={itemFormData.item_type_id?.toString()}
                                options={itemTypes.map((t: any) => ({ label: t.name ?? t.value_name, value: t.id.toString() }))}
                                onChange={(val) => setItemFormData({ ...itemFormData, item_type_id: val })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">UOM *</Label>
                            <SearchableSelect
                                placeholder="Select UOM"
                                value={itemFormData.uom_id?.toString()}
                                options={uoms.map((u: any) => ({ label: u.name ?? u.value_name, value: u.id.toString() }))}
                                onChange={(val) => setItemFormData({ ...itemFormData, uom_id: val })}
                            />
                        </div>
                    </div>
                </div>

                {/* C) Inventory Controls */}
                <div>
                    <SectionHeader title="Inventory Controls" />
                    <div className="grid grid-cols-1 gap-4 items-start md:grid-cols-2">
                        <div className="flex items-center space-x-2 h-9">
                            <input
                                type="checkbox"
                                id="expiry"
                                checked={!!itemFormData.is_expiry_tracked}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    /**
                                     * UX: Toggling the checkbox shows/hides the Shelf Life input.
                                     * If disabling, we reset the shelf_life value and clear any existing errors.
                                     */
                                    setItemFormData({ 
                                        ...itemFormData, 
                                        is_expiry_tracked: checked ? 1 : 0,
                                        ...(!checked ? { shelf_life_days: 0 } : {})
                                    });
                                    if (!checked) setItemFormErrors(prev => ({ ...prev, shelf_life: "" }));
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="expiry" className="mb-0 cursor-pointer">Is Expiry Tracked?</Label>
                        </div>
                        {!!itemFormData.is_expiry_tracked && (
                            <div className="space-y-2">
                                {/** UI: Visual indicator (*) is only shown when tracking is enabled. */}
                                <Label htmlFor="shelf_life" className="text-xs font-semibold">
                                    Shelf Life (Days) *
                                </Label>
                                <Input
                                    id="shelf_life"
                                    type="number"
                                    min={0}
                                    value={itemFormData.shelf_life_days || ""}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setItemFormData((prev) => ({ ...prev, shelf_life_days: val }));
                                        
                                        /** Real-time error feedback: Error message triggers immediately if shelf life remains <= 0 while box is checked. */
                                        let shelfErr = "";
                                        if (itemFormData.is_expiry_tracked && val <= 0) {
                                            shelfErr = "Shelf Life is required when Expiry is tracked";
                                        }
                                        setItemFormErrors((prev) => ({ ...prev, shelf_life: shelfErr }));
                                    }}
                                    className={cn(
                                        "h-9 focus-visible:ring-primary", 
                                        itemFormErrors.shelf_life && "border-destructive focus-visible:ring-destructive"
                                    )}
                                    placeholder="Enter days"
                                />
                                {itemFormErrors.shelf_life && (
                                    <p className="text-[10px] text-destructive italic font-medium">{itemFormErrors.shelf_life}</p>
                                )}
                            </div>
                        )}

                        {isFinishedGood && (
                            <div className="space-y-2">
                                <Label htmlFor="warranty_period" className="text-xs font-semibold">
                                    Warranty Period (In months)
                                </Label>
                                <Input
                                    id="warranty_period"
                                    type="number"
                                    min={0}
                                    value={itemFormData.warranty_period ?? ""}
                                    onChange={(e) => {
                                        const val = e.target.value === "" ? "" : (parseInt(e.target.value) || 0);
                                        setItemFormData((prev) => ({ ...prev, warranty_period: val }));
                                        
                                        let warrantyErr = "";
                                        if (val !== "" && val < 0) {
                                            warrantyErr = "Cannot be negative";
                                        }
                                        setItemFormErrors((prev) => ({ ...prev, warranty_period: warrantyErr }));
                                    }}
                                    className={cn(
                                        "h-9 focus-visible:ring-primary",
                                        itemFormErrors.warranty_period && "border-destructive focus-visible:ring-destructive"
                                    )}
                                    placeholder="Enter months"
                                />
                                {itemFormErrors.warranty_period && (
                                    <p className="text-[10px] text-destructive italic font-medium">{itemFormErrors.warranty_period}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Specification */}
                <div>
                    <div className="space-y-2">
                        <Label htmlFor="item_notes">Specification / Notes</Label>
                        <Textarea id="item_notes" value={itemFormData.specifications || ""} onChange={e => setItemFormData({ ...itemFormData, specifications: e.target.value })} placeholder="Technical specs or notes..." />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 h-full overflow-hidden">
            <div className="flex flex-col gap-2 shrink-0">
                <h1 className="text-3xl font-bold tracking-tight">Procurement Master</h1>
                <p className="text-muted-foreground">Manage items and procurement configurations.</p>
            </div>

            {!isMenuVisible(universalKey) ? (
                <Card className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-center p-6 border-dashed">
                    <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                        <X className="h-8 w-8 text-destructive" />
                    </div>
                    <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
                    <CardDescription className="max-w-xs">
                        You do not have permission to view Procurement Masters. Please contact your administrator for access.
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
                        {selectedMaster === "SKU" ? (
                            <ProcurementSkuTab permissionKey={universalKey} />
                        ) : (
                            <>
                                <AppListToolbar
                                    search={{
                                        placeholder: `Search ${selectedMaster.toLowerCase()}...`,
                                        value: searchTerm,
                                        onChange: (val: string) => {
                                            setSearchTerm(val);
                                            setCurrentPage(1);
                                        }
                                    }}
                                    filters={selectedMaster === "Items" ? [
                                        {
                                            type: "select" as const,
                                            label: "Type",
                                            value: filterType,
                                            onChange: (val: string) => {
                                                setFilterType(val);
                                                setCurrentPage(1);
                                            },
                                            options: [
                                                { label: "All Types", value: "all" },
                                                ...itemTypeFilterOptions
                                            ],
                                            searchable: true
                                        }
                                    ] : []}
                                    actions={canCreate(universalKey) ? [
                                    ...(selectedMaster === "Material Threshold" ? [{
                                        label: "Create Threshold",
                                        icon: <Plus className="mr-2 h-4 w-4" />,
                                        onClick: async () => {
                                            setEditingId(null);

                                            await fetchThresholdFormDeps();

                                            setThresholdFormData({ 
                                                materialId: null, 
                                                itemTypeId: null, 
                                                upperLimit: null, 
                                                upperSelectedUsers: [], 
                                                lowerLimit: null, 
                                                lowerSelectedUsers: [], 
                                                remarks: "" 
                                            });
                                            setOriginalUpperSelectedUsers([]);
                                            setOriginalLowerSelectedUsers([]);
                                            setTempUpperUserId("");
                                            setTempLowerUserId("");
                                            setItemsDropdown([]);
                                            setIsThresholdDialogOpen(true);
                                        }
                                    }] : [{
                                        label: "Create Item",
                                        icon: <Plus className="mr-2 h-4 w-4" />,
                                        onClick: handleAddClick
                                    }])
                                ] : []}
                                />

                                {/* Main Table Content */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle>{selectedMaster} List</CardTitle>
                                    </CardHeader>
                                    <CardContent className="min-w-0">
                                        <div className="max-w-full overflow-x-auto rounded-md border">
                                            {renderTable()}
                                        </div>

                                        {!isListLoading && (
                                            <DataTablePagination
                                                currentPage={currentPage}
                                                totalPages={totalPages}
                                                totalItems={selectedMaster === "Items" ? totalItemsCount : totalMaterialCount}
                                                itemsPerPage={itemsPerPage}
                                                onPageChange={setCurrentPage}
                                                onItemsPerPageChange={setItemsPerPage}
                                            />
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        )}
                </div>
            </Tabs>
            )}

            {/* Universal Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={handleItemDialogOpenChange}>
                <DialogContent 
                    className="w-[95%] max-w-4xl xl:max-w-5xl max-h-[82vh] overflow-hidden p-0 flex flex-col gap-0 bg-white"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <div className="shrink-0 border-b bg-white px-6 py-5">
                        <DialogHeader className="p-0">
                            <DialogTitle>{editingId ? "Edit" : "Create"} Item</DialogTitle>
                            <DialogDescription>
                                Configure the details for this item entry.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="relative flex-1 overflow-y-auto px-6 py-5">
                        {isFormDetailLoading && (
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
                            onClick={() => handleItemDialogOpenChange(false)} 
                            disabled={isSubmitting || isFormDetailLoading}
                            className="h-9 px-6 transition-all font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveItem}
                            loading={isSubmitting}
                            disabled={
                                !itemFormData.code || 
                                !itemFormData.name || 
                                !itemFormData.item_type_id || 
                                !itemFormData.uom_id || 
                                !!itemFormErrors.code || 
                                !!itemFormErrors.name ||
                                (!!itemFormData.is_expiry_tracked && (!itemFormData.shelf_life_days || itemFormData.shelf_life_days <= 0)) ||
                                isSubmitting ||
                                isFormDetailLoading
                            }
                            className={cn(
                                "h-9 min-w-[120px] transition-all font-semibold",
                                (!itemFormData.code || !itemFormData.name || !itemFormData.item_type_id || !itemFormData.uom_id || !!itemFormErrors.code || !!itemFormErrors.name || (!!itemFormData.is_expiry_tracked && (!itemFormData.shelf_life_days || itemFormData.shelf_life_days <= 0)) || isSubmitting || isFormDetailLoading)
                                    ? "bg-slate-300 text-slate-600 cursor-not-allowed hover:bg-slate-300 border-none shadow-none" 
                                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95"
                            )}
                        >
                            Save Changes
                        </Button>
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

            {/* Threshold Creation Dialog */}
            <Dialog open={isThresholdDialogOpen} onOpenChange={handleThresholdDialogOpenChange}>
                <DialogContent 
                    className="w-[95%] max-w-4xl xl:max-w-5xl max-h-[82vh] overflow-hidden p-0 flex flex-col gap-0 bg-white"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <div className="shrink-0 border-b bg-white px-6 py-5">
                        <DialogHeader className="p-0">
                            <DialogTitle>{editingId ? "Edit Threshold" : "Create Threshold"}</DialogTitle>
                            <DialogDescription>
                                Configure upper and lower notification limits with assigned users.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="relative flex-1 overflow-y-auto px-6 py-5">
                        {(isFormDetailLoading || isThresholdFormDepsLoading) && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60 rounded-md">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            </div>
                        )}
                        <div className="grid gap-8">
                        {/* Basic Information */}
                        <div>
                            <SectionHeader title="Basic Info" />
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs font-semibold">Select Item Type *</Label>
                                    <SearchableSelect
                                        placeholder="Select type"
                                        value={thresholdFormData.itemTypeId?.toString()}
                                        options={itemTypes.map((type: any) => ({ label: type.name ?? type.value_name, value: type.id.toString() }))}
                                        onChange={(val) => {
                                            const id = parseInt(val);
                                            setThresholdFormData({ ...thresholdFormData, itemTypeId: id, materialId: null });
                                            fetchItemsByTypeId(id);
                                        }}
                                        disabled={!!editingId}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">Select Item *</Label>
                                    <SearchableSelect
                                        placeholder="Choose item..."
                                        value={thresholdFormData.materialId?.toString()}
                                        className="h-auto min-h-10 items-start! py-1"
                                        options={itemsDropdown
                                            .filter(m => m.item_type_id === thresholdFormData.itemTypeId)
                                            .map(m => ({
                                                label: `${m.name} ${m.code ?? ""} ${m.threshold_configured && !editingId ? "(Configured)" : ""}`.trim(),
                                                value: m.id.toString(),
                                                primaryText: `${m.name} ${m.threshold_configured && !editingId ? "(Configured)" : ""}`.trim(),
                                                secondaryText: String(m.code ?? ""),
                                                disabled: m.threshold_configured && !editingId
                                            }))}
                                        onChange={(val) => setThresholdFormData({ ...thresholdFormData, materialId: parseInt(val) })}
                                        selectedPrimaryLineClamp={2}
                                        compactStackedSelected
                                        showSelectedTitle
                                        selectedTruncate="end"
                                        disabled={!!editingId}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Upper Limit Section */}
                        <div>
                            <SectionHeader title="Upper Limit Configuration" />
                            <div className="flex gap-4 items-end mb-4">
                                <div className="w-[150px] space-y-2">
                                    <Label htmlFor="upper_limit" className="text-xs font-semibold">Upper Limit</Label>
                                    <Input
                                        id="upper_limit"
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        maxLength={MAX_THRESHOLD_LIMIT_DIGITS}
                                        value={
                                            thresholdFormData.upperLimit === null
                                                ? ""
                                                : String(thresholdFormData.upperLimit)
                                        }
                                        onChange={(e) => {
                                            const val = parseThresholdLimitInput(e.target.value);
                                            setThresholdFormData({ ...thresholdFormData, upperLimit: val });
                                        }}
                                        placeholder="e.g. 500"
                                        className={cn("h-9 focus-visible:ring-primary", thresholdFormData.upperLimit !== null && thresholdFormData.upperLimit < 0 && "border-destructive focus-visible:ring-destructive")}
                                    />
                                    {thresholdFormData.upperLimit !== null && thresholdFormData.upperLimit < 0 && <p className="text-[10px] text-destructive italic font-medium">Value cannot be less than 0</p>}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs font-semibold">Assign users to notify for Upper limit</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <SearchableSelect
                                                placeholder="Choose user..."
                                                value={tempUpperUserId}
                                                options={employees.map(u => ({
                                                    label: u.employee_name,
                                                    value: u.id.toString(),
                                                    disabled: thresholdFormData.upperSelectedUsers.some(su => String(su.id) === String(u.id))
                                                }))}
                                                onChange={(val) => setTempUpperUserId(val)}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={() => handleAddUserToThreshold('upper')}
                                            disabled={!tempUpperUserId}
                                            className={cn(
                                                "h-9 transition-all font-semibold",
                                                (!tempUpperUserId)
                                                    ? "bg-slate-300 text-slate-600 cursor-not-allowed border-none shadow-none" 
                                                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95"
                                            )}
                                        >
                                            <Plus className="h-4 w-4 mr-2" /> Add
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-xs font-bold uppercase tracking-wider h-9">Name</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider h-9">Email</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider h-9">Contact Number</TableHead>
                                            <TableHead className="w-[50px] h-9"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {thresholdFormData.upperSelectedUsers.length > 0 ? (
                                            thresholdFormData.upperSelectedUsers.map(user => (
                                                <TableRow key={user.id}>
                                                    <TableCell className="py-2 text-sm font-medium">{user.fullName}</TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground">{user.email}</TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground">{user.phone}</TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleRemoveUserFromThreshold(user.id, 'upper')}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground h-16 text-xs italic">
                                                    No users assigned for upper limit.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Lower Limit Section */}
                        <div>
                            <SectionHeader title="Lower Limit Configuration" />
                            <div className="flex gap-4 items-end mb-4">
                                <div className="w-[150px] space-y-2">
                                    <Label htmlFor="lower_limit" className="text-xs font-semibold">Lower Limit</Label>
                                    <Input
                                        id="lower_limit"
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        maxLength={MAX_THRESHOLD_LIMIT_DIGITS}
                                        value={
                                            thresholdFormData.lowerLimit === null
                                                ? ""
                                                : String(thresholdFormData.lowerLimit)
                                        }
                                        onChange={(e) => {
                                            const val = parseThresholdLimitInput(e.target.value);
                                            setThresholdFormData({ ...thresholdFormData, lowerLimit: val });
                                        }}
                                        placeholder="e.g. 50"
                                        className={cn("h-9 focus-visible:ring-primary", thresholdFormData.lowerLimit !== null && thresholdFormData.lowerLimit < 0 && "border-destructive focus-visible:ring-destructive")}
                                    />
                                    {thresholdFormData.lowerLimit !== null && thresholdFormData.lowerLimit < 0 && <p className="text-[10px] text-destructive italic font-medium">Value cannot be less than 0</p>}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs font-semibold">Assign users to notify for Lower limit</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <SearchableSelect
                                                placeholder="Choose user..."
                                                value={tempLowerUserId}
                                                options={employees.map(u => ({
                                                    label: u.employee_name,
                                                    value: u.id.toString(),
                                                    disabled: thresholdFormData.lowerSelectedUsers.some(su => String(su.id) === String(u.id))
                                                }))}
                                                onChange={(val) => setTempLowerUserId(val)}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={() => handleAddUserToThreshold('lower')}
                                            disabled={!tempLowerUserId}
                                            className={cn(
                                                "h-9 transition-all font-semibold",
                                                (!tempLowerUserId)
                                                    ? "bg-slate-300 text-slate-600 cursor-not-allowed border-none shadow-none" 
                                                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95"
                                            )}
                                        >
                                            <Plus className="h-4 w-4 mr-2" /> Add
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-xs font-bold uppercase tracking-wider h-9">Name</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider h-9">Email</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider h-9">Contact Number</TableHead>
                                            <TableHead className="w-[50px] h-9"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {thresholdFormData.lowerSelectedUsers.length > 0 ? (
                                            thresholdFormData.lowerSelectedUsers.map(user => (
                                                <TableRow key={user.id}>
                                                    <TableCell className="py-2 text-sm font-medium">{user.fullName}</TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground">{user.email}</TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground">{user.phone}</TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleRemoveUserFromThreshold(user.id, 'lower')}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground h-16 text-xs italic">
                                                    No users assigned for lower limit.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Remarks Section */}
                        <div className="space-y-2">
                            <Label htmlFor="remarks" className="text-xs font-semibold">Remarks</Label>
                            <Textarea
                                id="remarks"
                                value={thresholdFormData.remarks || ""}
                                onChange={(e) => setThresholdFormData({ ...thresholdFormData, remarks: e.target.value })}
                                placeholder="Enter any additional notes or remarks..."
                                className="min-h-[80px] resize-none focus-visible:ring-primary"
                            />
                        </div>

                        </div>
                    </div>

                    <div className="shrink-0 border-t bg-white px-6 py-4 mt-auto flex justify-end gap-3">
                        <Button 
                            variant="outline" 
                            onClick={() => handleThresholdDialogOpenChange(false)} 
                            disabled={isSubmitting || isFormDetailLoading || isThresholdFormDepsLoading}
                            className="h-9 px-6 transition-all font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                             disabled={!thresholdFormData.itemTypeId || !thresholdFormData.materialId || isSubmitting || isFormDetailLoading || isThresholdFormDepsLoading}
                             onClick={handleThresholdSave}
                             loading={isSubmitting}
                             className={cn(
                                 "h-9 min-w-[100px] transition-all font-semibold",
                                 (!thresholdFormData.itemTypeId || !thresholdFormData.materialId || isSubmitting || isFormDetailLoading || isThresholdFormDepsLoading)
                                     ? "bg-slate-300 text-slate-600 cursor-not-allowed hover:bg-slate-300 border-none shadow-none" 
                                     : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95"
                             )}
                        >
                            Save
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
