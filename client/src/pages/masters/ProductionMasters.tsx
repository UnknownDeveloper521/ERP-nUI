import { useState, useEffect, useRef, useMemo } from "react";
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
import { Plus, Search, Trash2, ChevronsUpDown, Check, Loader2, Package } from "lucide-react";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { commonApi, machinesApi, operationsApi, workCentersApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";
import { ProductionSkuOperationTab } from "@/pages/masters/ProductionSkuOperationTab";
import {
    isGsv7DemoOperationId,
    isGsv7DemoVisible,
    mergeGsv7MockWithApiOperations,
    seedGsv7DemoFlowMapping,
    setGsv7DemoVisible,
} from "@/lib/gsv7OperationsMockData";

/**
 * Department, location, and item-type dropdowns use entity master data via `useCommonStore`
 * (post-login `loadCommonData` → GET /common/getentityvalues). This page does not call
 * `commonApi.getDepartments` or `commonApi.getLocations`. Other calls (`getWorkCenters`, `getItemsDropdown`,
 * `getOperations`, `operationsApi`, `workCentersApi`, `machinesApi`) are unchanged.
 */

// --- Types & Interfaces ---


type MasterType = "Work Centers" | "Machines" | "Operations" | "SKU Operation";


const MASTER_SLUGS: Record<MasterType, string> = {
    "Work Centers": "work-centers",
    "Machines": "machines",
    "Operations": "operations",
    "SKU Operation": "sku-operation",
};

const MASTER_TYPES: MasterType[] = ["Work Centers", "Machines", "Operations", "SKU Operation"];

const MASTER_TYPE_LABELS: Record<MasterType, string> = {
    "Work Centers": "Work Centers",
    "Machines": "Machines",
    "Operations": "General Operation",
    "SKU Operation": "SKU Operation",
};

function getMasterListTitle(master: MasterType): string {
    if (master === "Operations") return "General Operation";
    return `${master} List`;
}

interface WorkCenter {
    id: number;
    code: string;
    name: string;
    description?: string;
    location: string;
    department: string;
    status: "Active" | "Inactive";
    linked_operations?: number[]; // IDs of linked operations
    created_at?: string;
    updated_at?: string;
}



interface Machine {
    id: number;
    code: string;
    name: string;
    description?: string;
    work_center_id: number;
    work_center_name?: string;
    status: "Active" | "Inactive";
    created_at?: string;
    updated_at?: string;
}


interface Item {
    id: number;
    code: string;
    name: string;
    type: "RM" | "SFG" | "FG" | "Waste" | "Consumables";
    uom: string;
}

interface OperationItem {
    id: number;
    item_id: number;
    type: "RM" | "SFG" | "FG" | "Waste" | "Consumables";
    quantity: number;
    item_name?: string;
    item_code?: string;
    item_uom?: string;
}

interface QCParameter {
    id: number;
    name: string;
    description: string;
}

interface Operation {
    id: number;
    code: string;
    name: string;
    description?: string;
    department_id: number;
    department_name?: string;
    inputs: OperationItem[];
    outputs: OperationItem[];
    is_qc_required: boolean;
    is_qc_required_batch_wise: boolean;
    cycle_time: number;
    status: "Active" | "Inactive";
    created_at?: string;
    updated_at?: string;
    qc_parameters: QCParameter[];
}


const hoursToHHMM = (hours: number) => {
    if (!isFinite(hours) || hours < 0) return "";
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const hoursToHHMMParts = (hours: number) => {
    if (!isFinite(hours) || hours < 0) return { hh: "00", mm: "00" };
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return { hh: String(h).padStart(2, "0"), mm: String(m).padStart(2, "0") };
};

const parseCycleTimeToHours = (raw: unknown): number => {
    if (typeof raw === "number") return isFinite(raw) && raw >= 0 ? raw : 0;

    const text = String(raw ?? "").trim();
    if (!text) return 0;

    // Accept "HH:MM" or "HH:MM:SS" payloads from backend.
    if (text.includes(":")) {
        const [hStr = "0", mStr = "0", sStr = "0"] = text.split(":");
        const h = Number(hStr);
        const m = Number(mStr);
        const s = Number(sStr);
        if (isFinite(h) && isFinite(m) && isFinite(s) && h >= 0 && m >= 0 && s >= 0) {
            return h + m / 60 + s / 3600;
        }
        return 0;
    }

    const n = Number(text);
    return isFinite(n) && n >= 0 ? n : 0;
};

const toBoolean = (raw: unknown): boolean => {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw === 1;
    const text = String(raw ?? "").trim().toLowerCase();
    if (!text) return false;
    return text === "1" || text === "true" || text === "yes" || text === "y";
};

const DURATION_HOURS = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, "0"));
const DURATION_MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

const normalizeTypeLabel = (rawCode?: string, fallback: "RM" | "SFG" | "FG" | "Waste" | "Consumables" = "RM") => {
    const code = String(rawCode || "").toUpperCase();
    if (code === "RM") return "RM";
    if (code === "SFG") return "SFG";
    if (code === "FG") return "FG";
    if (code === "CONS" || code === "CONSUMABLES") return "Consumables";
    if (code === "WASTE") return "Waste";
    return fallback;
};

const getTypeKey = (type: string) => String(type || "").trim().toUpperCase();

/** Code and Name must each be at least two characters (trimmed) on create — Production masters. */
const hasMinTwoChars = (value: string) => String(value ?? "").trim().length >= 2;

const CODE_NAME_INLINE_ERROR = "Minimum two characters required";

/** Inline validation: show error once the field is non-empty but still invalid. */
const getCodeNameInlineError = (value: string): string | null => {
    const t = String(value ?? "").trim();
    if (!t) return null;
    return hasMinTwoChars(t) ? null : CODE_NAME_INLINE_ERROR;
};

/** Production master forms: Code / Name limits (client-only; matches DB expectations). */
const MAX_MASTER_CODE_LEN = 50;
const MAX_MASTER_NAME_LEN = 150;

const clampMasterCode = (raw: string) => String(raw ?? "").slice(0, MAX_MASTER_CODE_LEN);
const clampMasterName = (raw: string) => String(raw ?? "").slice(0, MAX_MASTER_NAME_LEN);

/** Operation item pickers: cap visible length; show start + ... + end when over limit (full text on title). */
const MAX_OPERATION_ITEM_TRIGGER_CHARS = 150;
const formatLongItemLabelForTrigger = (text: string, maxTotal = MAX_OPERATION_ITEM_TRIGGER_CHARS): string => {
    const t = String(text ?? "");
    if (t.length <= maxTotal) return t;
    const ellipsis = "...";
    const inner = maxTotal - ellipsis.length;
    const headChars = Math.floor(inner * 0.45);
    const tailChars = inner - headChars;
    return `${t.slice(0, headChars)}${ellipsis}${t.slice(-tailChars)}`;
};

const normalizeMasterCodeForSave = (raw: unknown) => clampMasterCode(String(raw ?? "").trim());
const normalizeMasterNameForSave = (raw: unknown) => clampMasterName(String(raw ?? "").trim());

const matchesTypeCode = (record: any, selectedType: string) => {
    const selected = getTypeKey(selectedType);
    const code = getTypeKey(record?.code);
    const name = getTypeKey(record?.name);

    if (selected === "CONSUMABLES") return code === "CONS" || name.includes("CONSUM");
    if (selected === "WASTE") return code === "WASTE" || name.includes("WASTE");
    
    // SFG contains "FG", so we need exact match for code or careful include for name
    if (selected === "FG") return code === "FG" || (name.includes("FINISHED") && !name.includes("SEMI"));
    if (selected === "SFG") return code === "SFG" || name.includes("SEMI");

    return code === selected || name.includes(selected);
};

type OperationTypeRecord = { id: number; value_name: string; value_code: string };

const mapOperationTypeApiResponse = (res: {
    isSuccessful?: boolean;
    data?: OperationTypeRecord[] | null;
}): OperationTypeRecord[] => {
    if (!res?.isSuccessful || !Array.isArray(res.data)) return [];
    return res.data
        .map((r) => ({
            id: Number(r.id),
            value_name: String(r.value_name ?? "").trim(),
            value_code: String(r.value_code ?? "").trim(),
        }))
        .filter((r) => Number.isFinite(r.id) && r.id > 0 && (r.value_code || r.value_name));
};

const operationTypePickerValue = (t: OperationTypeRecord) =>
    String(t.value_code || "").trim() || String(t.id);

const operationTypeOptionLabel = (t: OperationTypeRecord) => {
    const name = String(t.value_name || "").trim();
    const code = String(t.value_code || "").trim();
    if (name && code) return `${name} (${code})`;
    return name || code || String(t.id);
};

const resolveOperationTypeId = (
    apiTypes: OperationTypeRecord[],
    selectedType: string,
    itemTypes: any[] = []
): number | undefined => {
    const selected = getTypeKey(selectedType);
    const fromApi = apiTypes.find((t) => {
        const code = getTypeKey(t.value_code);
        const name = getTypeKey(t.value_name);
        if (code && code === selected) return true;
        if (name && name === selected) return true;
        return matchesTypeCode({ code: t.value_code, name: t.value_name }, selectedType);
    });
    if (fromApi?.id != null && Number.isFinite(Number(fromApi.id))) return Number(fromApi.id);
    return resolveItemTypeId(itemTypes, selectedType);
};

const typeLabelForOperationTypeId = (
    apiTypes: OperationTypeRecord[],
    typeId: number | string | undefined,
    itemTypes: any[],
    fallback: "RM" | "SFG" | "FG" | "Waste" | "Consumables" = "RM"
) => {
    const id = Number(typeId);
    const fromApi = apiTypes.find((t) => Number(t.id) === id);
    if (fromApi?.value_code) return normalizeTypeLabel(fromApi.value_code, fallback);
    const fromStore = itemTypes.find((t) => Number(t.id) === id);
    return normalizeTypeLabel(fromStore?.code || fromStore?.value_code, fallback);
};

const resolveItemTypeId = (itemTypes: any[], selectedType: string) => {
    const selected = getTypeKey(selectedType);
    const match = itemTypes.find((t: any) => {
        const code = getTypeKey(t?.code || t?.value_code || t?.type_code);
        const name = getTypeKey(t?.name || t?.value_name || t?.item_type_name || t?.label);

        if (selected === "RM") return code === "RM" || name.includes("RAW");
        if (selected === "SFG") return code === "SFG" || name.includes("SEMI");
        if (selected === "FG") return code === "FG" || (name.includes("FINISHED") && !name.includes("SEMI"));
        if (selected === "CONSUMABLES") return code === "CONS" || code === "CONSUMABLES" || name.includes("CONSUM");
        if (selected === "WASTE") return code === "WASTE" || name.includes("WASTE");

        return matchesTypeCode(t, selectedType);
    });

    return match?.id !== undefined && match?.id !== null ? Number(match.id) : undefined;
};

/**
 * Filter items for operation input/output pickers: match resolved item_type_id and/or API item_type_name
 * (e.g. "Raw material", "Semi Finished Goods", "Finished Goods" from getitems).
 */
const itemMatchesSelectedTypeForPicker = (item: any, itemTypes: any[], selectedType: string) => {
    const typeId = resolveItemTypeId(itemTypes, selectedType);
    const itemTypeId = Number(item.item_type_id ?? item.type_id ?? item.itemTypeId ?? 0);
    const byId = typeId !== undefined && Number(typeId) === itemTypeId;

    const tn = String(item.item_type_name ?? "").trim().toLowerCase();
    const sel = getTypeKey(selectedType);
    let byName = false;
    if (sel === "RM") byName = tn.includes("raw");
    else if (sel === "SFG") byName = tn.includes("semi");
    else if (sel === "FG") byName = tn.includes("finished") && !tn.includes("semi");
    else if (sel === "WASTE") byName = tn.includes("waste");
    else if (sel === "CONSUMABLES") byName = tn.includes("consum");

    return byId || byName;
};

const extractOperationItems = (payload: any, kind: "inputs" | "outputs") => {
    const keys =
        kind === "inputs"
            ? ["inputs", "inputs_data", "input_items", "input_materials", "operation_inputs"]
            : ["outputs", "outputs_data", "output_items", "output_materials", "operation_outputs"];

    for (const key of keys) {
        const val = payload?.[key];
        if (Array.isArray(val)) return val;
    }

    // Some APIs return merged rows with direction flag.
    const merged = payload?.operation_items ?? payload?.items ?? payload?.materials;
    if (Array.isArray(merged)) {
        return merged.filter((row: any) => {
            const direction = String(
                row?.direction ??
                row?.item_direction ??
                row?.kind ??
                row?.type ??
                row?.entry_type ??
                ""
            ).toLowerCase();
            const ioFlag = row?.is_input;
            if (kind === "inputs") return direction.includes("input") || ioFlag === true || ioFlag === 1;
            return direction.includes("output") || ioFlag === false || ioFlag === 0;
        });
    }
    return [];
};

const extractOperationPayload = (res: any) => {
    const data = res?.data;
    if (Array.isArray(data?.records)) return data.records[0] || {};
    if (data?.record) return data.record;
    if (data?.data) return data.data;
    if (data?.operation) return data.operation;
    if (data?.result) return data.result;
    return data || {};
};

/** Green styling for successful create / update / delete toasts (destructive variant = red for errors & validation). */
const crudSuccessToast = {
    className:
        "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
};






// --- Sub-components for Form Sections ---

const SectionHeader = ({ title, required }: { title: string; required?: boolean }) => (
    <div className="flex items-center gap-2 pb-2 mb-4 border-b">
        <h3 className="font-semibold text-sm text-primary">
            {title}
            {required ? <span className="text-black"> *</span> : null}
        </h3>
    </div>
);

const StatusBadge = ({ status }: { status: string }) => {
    return (
        <Badge variant={status === "Active" ? "outline" : "secondary"} className={status === "Active" ? "border-green-500 text-green-600 bg-green-50" : ""}>
            {status}
        </Badge>
    );
};

export default function ProductionMasters() {
    const { toast } = useToast();
    const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
    const universalKey = "MASTERS/PRODUCTION";
    const [location, setLocation] = useLocation();
    const params = useParams();

    const getValidMaster = (type: string | undefined): MasterType => {
        if (type) {
            const entry = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === type);
            if (entry) return entry[0] as MasterType;
        }
        return "Work Centers";
    };

    const selectedMaster = getValidMaster((params as any).type);
    const [activeTab, setActiveTab] = useState(MASTER_SLUGS[selectedMaster]);

    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [filterStatus, setFilterStatus] = useState<string>("All");
    const [open, setOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const updateRoute = (type: MasterType) => {
        const slug = MASTER_SLUGS[type] || type.toLowerCase();
        setLocation(`/masters/production/${slug}`);
    };

    const handleMasterChange = (newMaster: MasterType) => {
        const slug = MASTER_SLUGS[newMaster];
        setActiveTab(slug);
        setLocation(`/masters/production/${slug}`);
        setSearchTerm("");
        setOpen(false);
        setFilterStatus("All");
        setCurrentPage(1);
    };

    useEffect(() => {
        const newMaster = getValidMaster(params.type);
        const newSlug = MASTER_SLUGS[newMaster];
        if (newSlug !== activeTab) {
            setActiveTab(newSlug);
        }
        if (location === '/masters/production') {
            setLocation('/masters/production/work-centers');
        }
    }, [params.type, location]);

    // State for master data
    const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
    const [totalWorkCenters, setTotalWorkCenters] = useState(0);
    const [workCenterOptions, setWorkCenterOptions] = useState<any[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [totalMachines, setTotalMachines] = useState(0);
    const [operations, setOperations] = useState<Operation[]>([]);
    const [totalOperations, setTotalOperations] = useState(0);
    const [isListLoading, setIsListLoading] = useState(false);
    const [isFormDetailLoading, setIsFormDetailLoading] = useState(false);
    const [isWcDialogPrepLoading, setIsWcDialogPrepLoading] = useState(false);
    const [isMachineDialogPrepLoading, setIsMachineDialogPrepLoading] = useState(false);
    const openingEditIdRef = useRef<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showGsv7Demo, setShowGsv7Demo] = useState(() => isGsv7DemoVisible());
    const [isGsv7SetupRunning, setIsGsv7SetupRunning] = useState(false);

    const [allOperations, setAllOperations] = useState<Operation[]>([]);
    const [inputItemList, setInputItemList] = useState<any[]>([]);
    const [outputItemList, setOutputItemList] = useState<any[]>([]);
    /** Merged master rows by item_id so input/output tables keep name/UOM when the type dropdown refetches a filtered list. */
    const [operationInputItemById, setOperationInputItemById] = useState<Map<number, any>>(() => new Map());
    const [operationOutputItemById, setOperationOutputItemById] = useState<Map<number, any>>(() => new Map());
    /** Dedupe getitems: same input/output + item_type_id should not refetch (incl. re-selecting same type). */
    const operationItemsCacheRef = useRef<Map<string, any[]>>(new Map());
    const operationItemsInflightRef = useRef<Map<string, Promise<any[] | null>>>(new Map());
    /** Cache id → label from `/common/getuoms` so `getitems` rows that only send `uom_id` still show UOM in the table. */
    const uomIdToNameRef = useRef<Map<number, string> | null>(null);
    // const [locations, setLocations] = useState<any[]>([]); // Using commonStore now

    const departments = useCommonStore(state => state.departments);
    const locations = useCommonStore(state => state.locations);
    const itemTypes = useCommonStore(state => state.itemTypes);

    const fetchWorkCenterOptions = async (): Promise<{ id: number; name: string; code: string }[]> => {
        try {
            const res = await commonApi.getWorkCenters();
            if (res.isSuccessful) {
                const mapped = res.data.records.map((wc: any) => ({
                    id: wc.id,
                    name: wc.name,
                    code: wc.code
                }));
                setWorkCenterOptions(mapped);
                return mapped;
            }
        } catch (error: any) {
            console.error("Error fetching work center options:", error);
        }
        return [];
    };

    /** Normalize API-shaped `{ data: { records } }` or store slices (same row shape as entity master). */
    const mapDeptLocDropdownRecords = (res: any): any[] => {
        const raw = Array.isArray(res?.data?.records)
            ? res.data.records
            : Array.isArray(res?.data)
                ? res.data
                : [];
        return raw
            .map((r: any) => ({
                ...r,
                id: Number(r.id),
                name: String(
                    r.name ??
                    r.value_name ??
                    r.department_name ??
                    r.location_name ??
                    r.work_location_name ??
                    ""
                ),
            }))
            .filter((r: any) => r.id != null && !Number.isNaN(r.id) && String(r.name || "").trim() !== "");
    };

    /** Coerce API / form ids so dropdown matching (number vs string) and validation stay consistent. */
    const normalizeMasterId = (v: unknown): number | null => {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    const findDeptLocIdByName = (rows: { id: number; name: string }[], name: string | undefined | null): number | undefined => {
        const target = String(name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
        if (!target) return undefined;
        const byExact = rows.find((r) => String(r.name ?? "").replace(/\s+/g, " ").trim().toLowerCase() === target);
        if (byExact) return Number(byExact.id);
        return undefined;
    };

    /** Dept + location dropdown rows from entity master (`useCommonStore` ← `loadCommonData` / getEntityValues). No separate common API. */
    const getDeptAndLocationsForWorkCenterForm = () => {
        const depts = mapDeptLocDropdownRecords({ data: { records: departments } });
        const locs = mapDeptLocDropdownRecords({ data: { records: locations } });
        return { departments: depts, locations: locs };
    };

    const assignedLocationKey = getAssignedIds("location").join(",");

    const orderedLocationsForWc = useMemo(() => {
        const locs = mapDeptLocDropdownRecords({ data: { records: locations } });
        return prioritizeByAssigned(locs, getAssignedIds("location"), (loc) => loc.id);
    }, [locations, assignedLocationKey]);

    const getDefaultAssignedLocationId = (): number | null => {
        const assignedLocationIds = getAssignedIds("location");
        if (!assignedLocationIds.length || !orderedLocationsForWc.length) return null;
        const match = getFirstAssignedMatch(
            assignedLocationIds,
            orderedLocationsForWc.map((loc) => loc.id)
        );
        return match != null ? Number(match) : null;
    };

    const assignedWorkcenterKey = getAssignedIds("workcenter").join(",");

    const orderedWorkCentersForMachine = useMemo(() => {
        const records = (workCenterOptions || [])
            .map((wc: { id: number; name: string; code: string }) => ({
                id: Number(wc.id),
                name: String(wc.name ?? "").trim(),
                code: String(wc.code ?? "").trim(),
            }))
            .filter((wc) => Number.isFinite(wc.id) && wc.name);
        return prioritizeByAssigned(records, getAssignedIds("workcenter"), (wc) => wc.id);
    }, [workCenterOptions, assignedWorkcenterKey]);

    /** Operation form: department dropdown only from entity store. */
    const getDepartmentsForOperationForm = () =>
        mapDeptLocDropdownRecords({ data: { records: departments } });

    /*
    const fetchDeptAndLocationsForWorkCenterForm = async () => {
        const [deptRes, locRes] = await Promise.all([
            commonApi.getDepartments(),
            commonApi.getLocations(),
        ]);
        let depts: any[] = [];
        let locs: any[] = [];
        if (deptRes.isSuccessful) {
            depts = mapDeptLocDropdownRecords(deptRes);
        }
        if (locRes.isSuccessful) {
            locs = mapDeptLocDropdownRecords(locRes);
        }
        const patch: Record<string, any> = {};
        if (depts.length > 0) patch.departments = depts;
        if (locs.length > 0) patch.locations = locs;
        if (Object.keys(patch).length > 0) {
            setCommonData(patch);
        }
        return { departments: depts, locations: locs };
    };

    const fetchDepartmentsForOperationForm = async () => {
        try {
            const deptRes = await commonApi.getDepartments();
            let depts: any[] = [];
            if (deptRes.isSuccessful) {
                depts = mapDeptLocDropdownRecords(deptRes);
            }
            if (depts.length > 0) {
                setCommonData({ departments: depts });
            }
            return depts;
        } catch (e) {
            console.error("Error fetching departments for operation form:", e);
            return [];
        }
    };
    */

    // fetchItemTypes is now handled globally via commonStore

    const loadUomIdToNameMap = async (): Promise<Map<number, string>> => {
        if (uomIdToNameRef.current && uomIdToNameRef.current.size > 0) {
            return uomIdToNameRef.current;
        }
        const map = new Map<number, string>();
        try {
            const res = await commonApi.getUOMs(1);
            if (res.isSuccessful) {
                const raw = res?.data?.records ?? res?.data;
                const rows = Array.isArray(raw) ? raw : [];
                for (const u of rows) {
                    const id = Number(u.id ?? u.uom_id);
                    const label = String(u.name ?? u.uom_name ?? u.value_name ?? u.code ?? "").trim();
                    if (Number.isFinite(id) && label) map.set(id, label);
                }
            }
        } catch (e) {
            console.error("loadUomIdToNameMap", e);
        }
        uomIdToNameRef.current = map;
        return map;
    };

    const mapItemDropdownRecords = (records: any[], uomById: Map<number, string>) =>
        records.map((item: any) => {
            const uomId = Number(item.uom_id);
            const fromApi = String(item.uom || item.uom_name || "").trim();
            const fromId =
                !fromApi && Number.isFinite(uomId) ? (uomById.get(uomId) ?? "").trim() : "";
            return {
                id: Number(item.id),
                name: String(item.name || item.item_name || item.value_name || ""),
                code: String(item.code || item.item_code || ""),
                uom: fromApi || fromId,
                item_type_id: Number(item.item_type_id ?? item.type_id ?? item.itemTypeId ?? 0),
                item_type_name: String(item.item_type_name ?? ""),
            };
        });

    const fetchOperationTypeOptions = async (opts?: { applyDefaultSelection?: boolean }) => {
        const applyDefaultSelection = opts?.applyDefaultSelection !== false;
        setIsOperationTypesLoading(true);
        try {
            const [inputRes, outputRes] = await Promise.all([
                operationsApi.getInputTypes(),
                operationsApi.getOutputTypes(),
            ]);
            const inputTypes = mapOperationTypeApiResponse(inputRes);
            const outputTypes = mapOperationTypeApiResponse(outputRes);
            setOperationInputTypes(inputTypes);
            setOperationOutputTypes(outputTypes);

            if (applyDefaultSelection) {
                setSelectedInputType((prev) => {
                    if (prev && inputTypes.some((t) => getTypeKey(operationTypePickerValue(t)) === getTypeKey(prev))) {
                        return prev;
                    }
                    return inputTypes[0] ? operationTypePickerValue(inputTypes[0]) : "";
                });
                setSelectedOutputType((prev) => {
                    if (prev && outputTypes.some((t) => getTypeKey(operationTypePickerValue(t)) === getTypeKey(prev))) {
                        return prev;
                    }
                    return outputTypes[0] ? operationTypePickerValue(outputTypes[0]) : "";
                });
            }

            return { inputTypes, outputTypes };
        } catch (error: any) {
            console.error("Error fetching operation input/output types:", error);
            setOperationInputTypes([]);
            setOperationOutputTypes([]);
            return { inputTypes: [] as OperationTypeRecord[], outputTypes: [] as OperationTypeRecord[] };
        } finally {
            setIsOperationTypesLoading(false);
        }
    };

    /** Refetch getitems when Operation form input/output type changes (server filter via item_type_id when resolved). Cached per type to avoid duplicate calls (dialog + re-select same type, Strict Mode, etc.). */
    const fetchOperationItems = async (
        which: "input" | "output",
        selectedType: string,
        apiTypes: OperationTypeRecord[] = []
    ) => {
        try {
            const itemTypeId = resolveOperationTypeId(apiTypes, selectedType, itemTypes);
            const idKey =
                itemTypeId !== undefined && Number.isFinite(Number(itemTypeId))
                    ? String(Number(itemTypeId))
                    : "all";
            const cacheKey = `${which}:${idKey}`;

            const cached = operationItemsCacheRef.current.get(cacheKey);
            if (cached) {
                if (which === "input") setInputItemList(cached);
                else setOutputItemList(cached);
                return;
            }

            if (!operationItemsInflightRef.current.has(cacheKey)) {
                const params: { status: number; item_type_id?: number } = { status: 1 };
                if (itemTypeId !== undefined && Number.isFinite(Number(itemTypeId))) {
                    params.item_type_id = Number(itemTypeId);
                }
                const p = (async (): Promise<any[] | null> => {
                    const uomById = await loadUomIdToNameMap();
                    const res = await commonApi.getItemsDropdown(params);
                    if (!res.isSuccessful) return null;
                    const records = Array.isArray(res?.data?.records)
                        ? res.data.records
                        : Array.isArray(res?.data)
                            ? res.data
                            : [];
                    return mapItemDropdownRecords(records, uomById);
                })();
                operationItemsInflightRef.current.set(cacheKey, p);
            }
            const pending = operationItemsInflightRef.current.get(cacheKey)!;

            let mapped: any[] | null = null;
            try {
                mapped = await pending;
            } finally {
                operationItemsInflightRef.current.delete(cacheKey);
            }
            if (mapped === null) return;

            operationItemsCacheRef.current.set(cacheKey, mapped);
            if (which === "input") setInputItemList(mapped);
            else setOutputItemList(mapped);
        } catch (error: any) {
            console.error("Error fetching items:", error);
        }
    };

    const fetchAllOperations = async () => {
        try {
            const res = await commonApi.getOperations();
            if (res.isSuccessful) {
                setAllOperations(res.data.records.map((op: any) => ({
                    ...op,
                    status: op.status ? "Active" : "Inactive"
                })));
            }
        } catch (error: any) {
            console.error("Error fetching operations dropdown:", error);
        }
    };

    const fetchOperations = async () => {
        setIsListLoading(true);
        try {
            const res = await operationsApi.getAll({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearchTerm,
                status: filterStatus === "All" ? undefined : (filterStatus === "Active" ? "1" : "0")
            });
            if (res.isSuccessful) {
                const records = Array.isArray(res?.data?.records) ? res.data.records : [];
                const mappedRows = records.map((op: any) => {
                    const row = op?.operation ?? op;
                    const qcRequiredRaw = row?.is_qc_required ?? row?.qc_required ?? row?.qcRequired;
                    const batchwiseRaw =
                        row?.is_qc_required_batch_wise ??
                        row?.batchwise_tracking ??
                        row?.batch_wise_tracking ??
                        row?.batchwiseTracking;
                    const cycleTimeRaw = row?.cycle_time ?? row?.cycleTime ?? row?.cycle_time_hhmm;

                    return {
                        ...row,
                        department_name: departments.find(d => d.id === row.department_id)?.name || row.department_name || "-",
                        status: toBoolean(row.status) ? "Active" : "Inactive",
                        // Backend might not return these in list, but we need them for interface
                        inputs: row.inputs || [],
                        outputs: row.outputs || [],
                        qc_parameters: row.qc_parameters || [],
                        is_qc_required: toBoolean(qcRequiredRaw),
                        is_qc_required_batch_wise: toBoolean(batchwiseRaw),
                        cycle_time: parseCycleTimeToHours(cycleTimeRaw),
                    };
                });

                setOperations(mappedRows);
                setTotalOperations(Number(res?.data?.pagination?.totalCount || mappedRows.length));
            }
        } catch (error: any) {
            console.error("Error fetching operations:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to fetch operations" });
        } finally {
            setIsListLoading(false);
        }
    };

    const fetchWorkCenters = async () => {
        setIsListLoading(true);
        try {
            const res = await workCentersApi.getAll({ 
                page: currentPage, 
                limit: itemsPerPage, 
                search: debouncedSearchTerm, 
                status: filterStatus === "All" ? undefined : (filterStatus === "Active" ? "1" : "0")
            });
            if (res.isSuccessful) {
                setWorkCenters(res.data.records.map((wc: any) => ({
                    ...wc,
                    location: wc.work_location_name || "-",
                    department: wc.department_name || "-",
                    status: wc.status === 1 ? "Active" : "Inactive"
                })));
                setTotalWorkCenters(res.data.pagination.totalCount);
            }
        } catch (error: any) {
            console.error("Error fetching work centers:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to fetch work centers" });
        } finally {
            setIsListLoading(false);
        }
    };

    const fetchMachines = async () => {
        setIsListLoading(true);
        try {
            const res = await machinesApi.getAll({ page: currentPage, limit: itemsPerPage, search: debouncedSearchTerm, status: filterStatus === "All" ? undefined : (filterStatus === "Active" ? "1" : "0") });
            if (res.isSuccessful) {
                setMachines(res.data.records.map((m: any) => ({
                    ...m,
                    status: m.status === 1 ? "Active" : "Inactive"
                })));
                setTotalMachines(res.data.pagination.totalCount);
            }
        } catch (error: any) {
            console.error("Error fetching machines:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to fetch machines" });
        } finally {
            setIsListLoading(false);
        }
    };

    const handleToggleGsv7Demo = async () => {
        const next = !showGsv7Demo;
        setIsGsv7SetupRunning(true);
        try {
            if (next) {
                await fetchAllOperations();
                const flow = seedGsv7DemoFlowMapping();
                setShowGsv7Demo(true);
                setGsv7DemoVisible(true);
                setCurrentPage(1);
                toast({
                    title: "GSV7 demo enabled",
                    description: `${flow.message} Demo rows are merged with your API operations (by code).`,
                });
            } else {
                setShowGsv7Demo(false);
                setGsv7DemoVisible(false);
                setCurrentPage(1);
                await fetchOperations();
                toast({
                    title: "GSV7 demo hidden",
                    description: "Showing API operations only.",
                });
            }
        } catch (error: unknown) {
            toast({
                variant: "destructive",
                title: "GSV7 demo",
                description:
                    error instanceof Error ? error.message : "Could not update GSV7 demo view.",
            });
        } finally {
            setIsGsv7SetupRunning(false);
        }
    };

    const operationsWithGsv7Demo = useMemo(() => {
        if (!showGsv7Demo) return operations;
        const base = allOperations.length > 0 ? allOperations : operations;
        const deptId = Number(departments[0]?.id ?? 0);
        return mergeGsv7MockWithApiOperations(base, deptId) as Operation[];
    }, [showGsv7Demo, operations, allOperations, departments]);

    // List APIs: load only for the active tab. Dropdown/helper APIs for Work Centers & Machines
    // run when the create/edit dialog opens (see handleAddClick / handleEditClick), not on module load.
    // Operations: list here; getitems runs when create/edit dialog opens and when input/output item type changes.

    useEffect(() => {
        if (selectedMaster === "Work Centers") {
            fetchWorkCenters();
        } else if (selectedMaster === "Machines") {
            fetchMachines();
        } else if (selectedMaster === "Operations") {
            if (showGsv7Demo) {
                fetchAllOperations();
            } else {
                fetchOperations();
            }
        }
        // SKU Operation tab loads its own data in ProductionSkuOperationTab
    }, [selectedMaster, currentPage, itemsPerPage, debouncedSearchTerm, filterStatus, showGsv7Demo]);

    // Reset pagination when search or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, filterStatus]);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    /** Snapshot from last operation edit getOne — avoids a second getOne on save for delta payload. */
    const operationEditBaselineRef = useRef<{ editingId: number; payload: any } | null>(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [itemToDeleteID, setItemToDeleteID] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<any>({});

    const handleDialogOpenChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setIsFormDetailLoading(false);
            setIsWcDialogPrepLoading(false);
            setIsMachineDialogPrepLoading(false);
            openingEditIdRef.current = null;
            setEditingId(null);
        }
    };

    useEffect(() => {
        if (!isDialogOpen) {
            operationEditBaselineRef.current = null;
            operationItemsCacheRef.current.clear();
            operationItemsInflightRef.current.clear();
            setOperationInputItemById(new Map());
            setOperationOutputItemById(new Map());
        }
    }, [isDialogOpen]);

    // Operations State
    const [selectedInputId, setSelectedInputId] = useState<string>("");

    const [operationInputTypes, setOperationInputTypes] = useState<OperationTypeRecord[]>([]);
    const [operationOutputTypes, setOperationOutputTypes] = useState<OperationTypeRecord[]>([]);
    const [isOperationTypesLoading, setIsOperationTypesLoading] = useState(false);

    const [selectedInputType, setSelectedInputType] = useState<string>("");

    const [selectedOutputId, setSelectedOutputId] = useState<string>("");

    const [selectedOutputType, setSelectedOutputType] = useState<string>("");

    const inputTypeSelectOptions = useMemo(
        () =>
            operationInputTypes.map((t) => ({
                label: operationTypeOptionLabel(t),
                value: operationTypePickerValue(t),
            })),
        [operationInputTypes]
    );

    const outputTypeSelectOptions = useMemo(
        () =>
            operationOutputTypes.map((t) => ({
                label: operationTypeOptionLabel(t),
                value: operationTypePickerValue(t),
            })),
        [operationOutputTypes]
    );

    const [cycleTimeHH, setCycleTimeHH] = useState<string>("00");
    const [cycleTimeMM, setCycleTimeMM] = useState<string>("00");

    // Work Center Operations State
    const [selectedWCOpId, setSelectedWCOpId] = useState<string>("");


    useEffect(() => {
        if (!isDialogOpen || selectedMaster !== "Operations") return;
        void fetchOperationTypeOptions({ applyDefaultSelection: editingId == null });
    }, [isDialogOpen, selectedMaster, editingId]);

    useEffect(() => {
        if (!isDialogOpen || selectedMaster !== "Operations" || !selectedInputType) return;
        void fetchOperationItems("input", selectedInputType, operationInputTypes);
    }, [isDialogOpen, selectedMaster, selectedInputType, operationInputTypes, itemTypes]);

    useEffect(() => {
        if (!isDialogOpen || selectedMaster !== "Operations" || !selectedOutputType) return;
        void fetchOperationItems("output", selectedOutputType, operationOutputTypes);
    }, [isDialogOpen, selectedMaster, selectedOutputType, operationOutputTypes, itemTypes]);

    /** Merge each dropdown fetch into the accumulated map (do not drop rows for other types already added). */
    useEffect(() => {
        if (!isDialogOpen || selectedMaster !== "Operations") return;
        setOperationInputItemById((prev) => {
            const next = new Map(prev);
            for (const i of inputItemList) {
                const id = Number(i.id);
                if (Number.isFinite(id)) next.set(id, i);
            }
            return next;
        });
    }, [inputItemList, isDialogOpen, selectedMaster]);

    useEffect(() => {
        if (!isDialogOpen || selectedMaster !== "Operations") return;
        setOperationOutputItemById((prev) => {
            const next = new Map(prev);
            for (const i of outputItemList) {
                const id = Number(i.id);
                if (Number.isFinite(id)) next.set(id, i);
            }
            return next;
        });
    }, [outputItemList, isDialogOpen, selectedMaster]);

    // --- Helpers ---

    const getData = () => {
        if (selectedMaster === "Work Centers") return workCenters;
        if (selectedMaster === "Machines") return machines;
        if (selectedMaster === "Operations") return showGsv7Demo ? operationsWithGsv7Demo : operations;
        return [];
    };

    const addOperationItem = (type: "inputs" | "outputs") => {
        const itemId = type === "inputs" ? selectedInputId : selectedOutputId;
        const itemType = type === "inputs" ? selectedInputType : selectedOutputType;

        if (!itemId) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please select an item." });
            return;
        }

        const list = type === "inputs" ? inputItemList : outputItemList;
        const picked = list.find((i) => Number(i.id) === Number(itemId));

        const parsedItemId = parseInt(itemId, 10);
        const exists = (formData[type] || []).some(
            (existing: OperationItem) => Number(existing.item_id) === parsedItemId,
        );
        if (exists) {
            toast({ variant: "destructive", title: "Duplicate", description: "This item is already added." });
            return;
        }

        const newItem: OperationItem = {
            id: Math.random(), // Temp ID
            item_id: parsedItemId,
            type: normalizeTypeLabel(
                itemType,
                type === "inputs" ? "RM" : "SFG"
            ) as OperationItem["type"],
            quantity: 0,
            item_name: picked ? String(picked.name ?? "") : "",
            item_code: picked ? String(picked.code ?? "") : "",
            item_uom: picked ? String(picked.uom ?? "") : "",
        };

        setFormData((prev: any) => ({
            ...prev,
            [type]: [...(prev[type] || []), newItem]
        }));

        if (picked) {
            const pid = Number(picked.id);
            if (Number.isFinite(pid)) {
                if (type === "inputs") {
                    setOperationInputItemById((prev) => {
                        const next = new Map(prev);
                        next.set(pid, picked);
                        return next;
                    });
                } else {
                    setOperationOutputItemById((prev) => {
                        const next = new Map(prev);
                        next.set(pid, picked);
                        return next;
                    });
                }
            }
        }

        if (type === "inputs") {
            setSelectedInputId("");
        } else {
            setSelectedOutputId("");
        }
    };

    const removeOperationItem = (type: "inputs" | "outputs", id: number) => {
        setFormData((prev: any) => ({
            ...prev,
            [type]: prev[type].filter((item: OperationItem) => item.id !== id)
        }));
    };

    const updateOperationItem = (type: "inputs" | "outputs", id: number, field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            [type]: prev[type].map((item: OperationItem) =>
                item.id === id ? { ...item, [field]: value } : item
            )
        }));
    };

    const addQCParam = () => {
        const newParam: QCParameter = {
            id: Math.random(),
            name: "",
            description: ""
        };
        setFormData((prev: any) => ({
            ...prev,
            qc_parameters: [...(prev.qc_parameters || []), newParam]
        }));
    };

    const removeQCParam = (id: number) => {
        setFormData((prev: any) => ({
            ...prev,
            qc_parameters: prev.qc_parameters.filter((p: QCParameter) => p.id !== id)
        }));
    };

    const updateQCParam = (id: number, field: string, value: string) => {
        setFormData((prev: any) => ({
            ...prev,
            qc_parameters: prev.qc_parameters.map((p: QCParameter) =>
                p.id === id ? { ...p, [field]: value } : p
            )
        }));
    };

    const addWCOperation = () => {
        if (!selectedWCOpId) return;
        const opId = parseInt(selectedWCOpId);

        // Prevent duplicates
        if (formData.linked_operations?.includes(opId)) {
            toast({ variant: "destructive", title: "Duplicate", description: "Operation already added." });
            return;
        }

        setFormData((prev: any) => ({
            ...prev,
            linked_operations: [...(prev.linked_operations || []), opId]
        }));
        setSelectedWCOpId("");
    };

    const removeWCOperation = (opId: number) => {
        setFormData((prev: any) => ({
            ...prev,
            linked_operations: prev.linked_operations.filter((id: number) => id !== opId)
        }));
    };

    const currentData = getData().filter((item: any) => {
        const searchLower = searchTerm.toLowerCase();
        let matchesSearch = false;

        if (selectedMaster === "Work Centers") {
            matchesSearch =
                item.name.toLowerCase().includes(searchLower) ||
                item.code.toLowerCase().includes(searchLower) ||
                item.location.toLowerCase().includes(searchLower);
        } else if (selectedMaster === "Machines") {
            matchesSearch =
                item.name.toLowerCase().includes(searchLower) ||
                item.code.toLowerCase().includes(searchLower);
        } else if (selectedMaster === "Operations") {
            matchesSearch =
                item.name.toLowerCase().includes(searchLower) ||
                item.code.toLowerCase().includes(searchLower);
        }

        const matchesStatus = filterStatus === "All" || item.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    const totalItems =
        selectedMaster === "Work Centers"
            ? totalWorkCenters
            : selectedMaster === "Machines"
              ? totalMachines
              : selectedMaster === "Operations" && showGsv7Demo
                ? currentData.length
                : selectedMaster === "Operations"
                  ? totalOperations
                  : currentData.length;

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const paginatedData =
        selectedMaster === "Work Centers"
            ? workCenters
            : selectedMaster === "Machines"
              ? machines
              : selectedMaster === "Operations" && showGsv7Demo
                ? currentData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                : selectedMaster === "Operations"
                  ? operations
                  : currentData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleAddClick = async () => {
        setEditingId(null);

        if (selectedMaster === "Work Centers") {
            setIsDialogOpen(true);
            setIsWcDialogPrepLoading(true);
            try {
                await fetchAllOperations();
                const { departments: deptsFresh } = getDeptAndLocationsForWorkCenterForm();
                const defaultLocationId = getDefaultAssignedLocationId();
                setFormData({
                    status: "Active",
                    work_location_id:
                        defaultLocationId ??
                        (orderedLocationsForWc.length > 0 ? orderedLocationsForWc[0].id : null),
                    department_id: deptsFresh.length > 0 ? deptsFresh[0].id : null,
                    linked_operations: [],
                });
            } finally {
                setIsWcDialogPrepLoading(false);
            }
            return;
        } else if (selectedMaster === "Machines") {
            setIsDialogOpen(true);
            setIsMachineDialogPrepLoading(true);
            try {
                const wcOptions = await fetchWorkCenterOptions();
                const ordered = prioritizeByAssigned(
                    wcOptions
                        .map((wc) => ({
                            id: Number(wc.id),
                            name: String(wc.name ?? "").trim(),
                            code: String(wc.code ?? "").trim(),
                        }))
                        .filter((wc) => Number.isFinite(wc.id) && wc.name),
                    getAssignedIds("workcenter"),
                    (wc) => wc.id
                );
                const assignedDefault = getFirstAssignedMatch(
                    getAssignedIds("workcenter"),
                    ordered.map((wc) => wc.id)
                );
                setFormData({
                    status: "Active",
                    work_center_id:
                        assignedDefault != null
                            ? String(assignedDefault)
                            : ordered[0]
                                ? String(ordered[0].id)
                                : "",
                });
            } finally {
                setIsMachineDialogPrepLoading(false);
            }
            return;
        } else if (selectedMaster === "Operations") {
            const deptsFresh = getDepartmentsForOperationForm();
            setOperationInputItemById(new Map());
            setOperationOutputItemById(new Map());
            setFormData({
                status: "Active",
                is_qc_required: true,
                is_qc_required_batch_wise: true,
                cycle_time: 0,
                department_id: deptsFresh.length > 0 ? deptsFresh[0].id : null,
                inputs: [],
                outputs: [],
                qc_parameters: [],
            });
            setCycleTimeHH("00");
            setCycleTimeMM("00");
            setSelectedInputId("");
            setSelectedOutputId("");
            setIsDialogOpen(true);
            return;
        }
        setIsDialogOpen(true);
    };

    const handleEditClick = async (item: any) => {
        if (selectedMaster === "Work Centers") {
            if (openingEditIdRef.current !== null) return;
            openingEditIdRef.current = item.id;
            setEditingId(item.id);
            operationEditBaselineRef.current = null;
            setIsDialogOpen(true);
            setIsFormDetailLoading(true);
            setIsWcDialogPrepLoading(true);
            try {
                const { departments: deptsFresh, locations: locsFresh } =
                    getDeptAndLocationsForWorkCenterForm();
                await fetchAllOperations();
                const res = await workCentersApi.getOne(item.id);
                if (res.isSuccessful) {
                    const fullData = res.data;
                    const locIdFromName = findDeptLocIdByName(locsFresh, fullData.work_location_name);
                    const deptIdFromName = findDeptLocIdByName(deptsFresh, fullData.department_name);
                    const wl = normalizeMasterId(fullData.work_location_id) ?? locIdFromName ?? null;
                    const dp = normalizeMasterId(fullData.department_id) ?? deptIdFromName ?? null;

                    setFormData({
                        ...fullData,
                        code: clampMasterCode(String(fullData.code ?? "")),
                        name: clampMasterName(String(fullData.name ?? "")),
                        work_location_id: wl,
                        department_id: dp,
                        status: fullData.status === 1 ? "Active" : "Inactive",
                        linked_operations: (fullData.operations || []).map((op: any) => op.operation_id),
                        operations_data: fullData.operations || [],
                    });
                } else {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: res.message || "Failed to fetch work center details",
                    });
                    handleDialogOpenChange(false);
                }
            } catch (error: any) {
                console.error("Error fetching work center details:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to fetch work center details",
                });
                handleDialogOpenChange(false);
            } finally {
                setIsFormDetailLoading(false);
                setIsWcDialogPrepLoading(false);
                openingEditIdRef.current = null;
            }
            return;
        }

        if (selectedMaster === "Machines") {
            if (openingEditIdRef.current !== null) return;
            openingEditIdRef.current = item.id;
            setEditingId(item.id);
            operationEditBaselineRef.current = null;
            setIsDialogOpen(true);
            setIsFormDetailLoading(true);
            setIsMachineDialogPrepLoading(true);
            try {
                const wcOptsForMachine = await fetchWorkCenterOptions();
                const data = { ...item };

                if (!item.work_center_id && item.work_center_name) {
                    const wc = wcOptsForMachine.find((w) => w.name === item.work_center_name);
                    if (wc) {
                        data.work_center_id = String(wc.id);
                    }
                } else if (item.work_center_id !== undefined && item.work_center_id !== null) {
                    data.work_center_id = String(item.work_center_id);
                }

                setFormData({
                    ...data,
                    code: clampMasterCode(String(data.code ?? "")),
                    name: clampMasterName(String(data.name ?? "")),
                });
            } catch (error: any) {
                console.error("Error loading machine details:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to load machine details",
                });
                handleDialogOpenChange(false);
            } finally {
                setIsFormDetailLoading(false);
                setIsMachineDialogPrepLoading(false);
                openingEditIdRef.current = null;
            }
            return;
        }

        if (selectedMaster === "Operations") {
            if (openingEditIdRef.current !== null) return;
            openingEditIdRef.current = item.id;
            setEditingId(item.id);
            setIsDialogOpen(true);
            setIsFormDetailLoading(true);
            try {
                const deptsFresh = getDepartmentsForOperationForm();
                const [{ inputTypes, outputTypes }, res] = await Promise.all([
                    fetchOperationTypeOptions({ applyDefaultSelection: false }),
                    operationsApi.getOne(item.id),
                ]);
                if (res.isSuccessful) {
                    const fullData = extractOperationPayload(res);
                    operationEditBaselineRef.current = { editingId: item.id, payload: fullData };
                    const inputRows = extractOperationItems(fullData, "inputs");
                    const outputRows = extractOperationItems(fullData, "outputs");
                    const qcRows = Array.isArray(fullData?.qc_parameters)
                        ? fullData.qc_parameters
                        : Array.isArray(fullData?.qcParameters)
                            ? fullData.qcParameters
                            : [];
                    const deptIdFromName =
                        findDeptLocIdByName(deptsFresh, fullData.department_name) ??
                        findDeptLocIdByName(departments as { id: number; name: string }[], fullData.department_name);
                    const mappedDepartmentId =
                        normalizeMasterId(fullData.department_id) ?? deptIdFromName ?? null;
                    const cycleTimeHours = parseCycleTimeToHours(fullData.cycle_time);
                    const parts = hoursToHHMMParts(cycleTimeHours);
                    setCycleTimeHH(parts.hh);
                    setCycleTimeMM(parts.mm);

                    const mappedInputs = inputRows.map((input: any) => {
                        const inputTypeId = input.input_type_id ?? input.type_id ?? input.item_type_id;
                        const typeLabel = typeLabelForOperationTypeId(
                            inputTypes,
                            inputTypeId,
                            itemTypes,
                            "RM"
                        );
                        return {
                            id: Number(input.id) || Math.random(),
                            item_id: Number(input.item_id ?? input.item?.id ?? 0),
                            type: typeLabel,
                            quantity: Number(input.quantity || 0),
                            item_name: String(input.item_name ?? input.item?.name ?? input.material_name ?? ""),
                            item_code: String(input.item_code ?? input.item?.code ?? input.material_code ?? ""),
                            item_uom: String(input.uom ?? input.uom_name ?? input.item?.uom ?? input.item?.uom_name ?? ""),
                        };
                    });
                    const mappedOutputs = outputRows.map((output: any) => {
                        const outputTypeId = output.output_type_id ?? output.type_id ?? output.item_type_id;
                        const typeLabel = typeLabelForOperationTypeId(
                            outputTypes,
                            outputTypeId,
                            itemTypes,
                            "SFG"
                        );
                        return {
                            id: Number(output.id) || Math.random(),
                            item_id: Number(output.item_id ?? output.item?.id ?? 0),
                            type: typeLabel,
                            quantity: Number(output.quantity || 0),
                            item_name: String(output.item_name ?? output.item?.name ?? output.material_name ?? ""),
                            item_code: String(output.item_code ?? output.item?.code ?? output.material_code ?? ""),
                            item_uom: String(output.uom ?? output.uom_name ?? output.item?.uom ?? output.item?.uom_name ?? ""),
                        };
                    });

                    setFormData({
                        ...fullData,
                        code: clampMasterCode(String(fullData.code ?? "")),
                        name: clampMasterName(String(fullData.name ?? "")),
                        status: fullData.status ? "Active" : "Inactive",
                        department_id: mappedDepartmentId,
                        cycle_time: cycleTimeHours,
                        description: fullData.description || "",
                        is_qc_required: toBoolean(fullData.is_qc_required ?? fullData.qc_required),
                        is_qc_required_batch_wise: toBoolean(
                            fullData.is_qc_required_batch_wise ?? fullData.batchwise_tracking ?? fullData.batchwiseTracking
                        ),
                        inputs: mappedInputs,
                        outputs: mappedOutputs,
                        qc_parameters: qcRows.sort((a: any, b: any) => (a.sequence_no || 0) - (b.sequence_no || 0)).map((qc: any) => ({
                            id: qc.id,
                            name: qc.parameter_name ?? qc.name ?? "",
                            description: qc.check_description ?? qc.description ?? ""
                        }))
                    });

                    setOperationInputItemById((prev) => {
                        const next = new Map(prev);
                        for (const row of mappedInputs) {
                            const id = Number(row.item_id);
                            if (Number.isFinite(id) && id > 0) {
                                next.set(id, {
                                    id,
                                    name: row.item_name ?? "",
                                    code: row.item_code ?? "",
                                    uom: row.item_uom ?? "",
                                    item_type_name: "",
                                });
                            }
                        }
                        return next;
                    });
                    setOperationOutputItemById((prev) => {
                        const next = new Map(prev);
                        for (const row of mappedOutputs) {
                            const id = Number(row.item_id);
                            if (Number.isFinite(id) && id > 0) {
                                next.set(id, {
                                    id,
                                    name: row.item_name ?? "",
                                    code: row.item_code ?? "",
                                    uom: row.item_uom ?? "",
                                    item_type_name: "",
                                });
                            }
                        }
                        return next;
                    });
                } else {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: res.message || "Failed to fetch operation details",
                    });
                    handleDialogOpenChange(false);
                }
            } catch (error: any) {
                console.error("Error fetching operation details:", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to fetch operation details",
                });
                handleDialogOpenChange(false);
            } finally {
                setIsFormDetailLoading(false);
                openingEditIdRef.current = null;
            }
            return;
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
            if (selectedMaster === "Work Centers") {
                const res = await workCentersApi.delete(itemToDeleteID);
                if (res.isSuccessful) {
                    toast({ ...crudSuccessToast, title: "Deleted", description: res.message || "Work Center deleted successfully" });
                    fetchWorkCenters();
                    void fetchWorkCenterOptions();
                } else {
                    toast({ variant: "destructive", title: "Error", description: res.message || "Failed to delete work center" });
                }
            } else if (selectedMaster === "Machines") {
                const res = await machinesApi.delete(itemToDeleteID);
                if (res.isSuccessful) {
                    toast({ ...crudSuccessToast, title: "Deleted", description: res.message || "Machine deleted successfully" });
                    fetchMachines();
                } else {
                    toast({ variant: "destructive", title: "Error", description: res.message || "Failed to delete machine" });
                }
            } else if (selectedMaster === "Operations") {
                const res = await operationsApi.delete(itemToDeleteID);
                if (res.isSuccessful) {
                    toast({ ...crudSuccessToast, title: "Deleted", description: res.message || "Operation deleted successfully" });
                    fetchOperations();
                } else {
                    toast({ variant: "destructive", title: "Error", description: res.message || "Failed to delete operation" });
                }
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete record" });
        } finally {
            setIsDeleting(false);
            setIsDeleteAlertOpen(false);
            setItemToDeleteID(null);
        }
    };

    const handleSave = async () => {
        const now = new Date().toISOString();

        if (selectedMaster === "Work Centers") {
            const codeT = normalizeMasterCodeForSave(formData.code);
            const nameT = normalizeMasterNameForSave(formData.name);
            if (
                String(formData.code ?? "").trim().length > MAX_MASTER_CODE_LEN ||
                String(formData.name ?? "").trim().length > MAX_MASTER_NAME_LEN
            ) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: `Code must be at most ${MAX_MASTER_CODE_LEN} characters and Name at most ${MAX_MASTER_NAME_LEN} characters.`,
                });
                return;
            }
            if (
                !codeT ||
                !nameT ||
                !formData.status ||
                normalizeMasterId(formData.work_location_id) == null ||
                normalizeMasterId(formData.department_id) == null
            ) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }
            if (!editingId && (!hasMinTwoChars(codeT) || !hasMinTwoChars(nameT))) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: "Code and Name must each be at least two characters.",
                });
                return;
            }

            const wcData = {
                code: codeT,
                name: nameT,
                description: formData.description,
                work_location_id: normalizeMasterId(formData.work_location_id)!,
                department_id: normalizeMasterId(formData.department_id)!,
                status: formData.status === "Active" ? 1 : 0
            };

            const saveAction = async () => {
                setIsSubmitting(true);
                try {
                    let res;
                    if (editingId) {
                        // Calculate added/deleted operations
                        const originalRes = await workCentersApi.getOne(editingId);
                        const originalOpIds = (originalRes.data.operations || []).map((op: any) => op.operation_id);
                        const currentOpIds = formData.linked_operations || [];

                        const added = currentOpIds.filter((id: number) => !originalOpIds.includes(id)).map((id: number) => ({ operation_id: id }));
                        const deleted = originalOpIds.filter((id: number) => !currentOpIds.includes(id)).map((id: number) => ({ operation_id: id }));

                        res = await workCentersApi.update(editingId, {
                            ...wcData,
                            addedoperations: added,
                            deletedoperations: deleted
                        });
                    } else {
                        res = await workCentersApi.create({
                            ...wcData,
                            operations: (formData.linked_operations || []).map((id: number) => ({ operation_id: id }))
                        });
                    }

                    if (res.isSuccessful) {
                        toast({ ...crudSuccessToast, title: editingId ? "Updated" : "Created", description: res.message || `Work Center ${editingId ? "updated" : "created"} successfully` });
                        setIsDialogOpen(false);
                        fetchWorkCenters();
                        void fetchWorkCenterOptions();
                    } else {
                        console.error("Save Work Center Error Response:", res);
                        toast({ variant: "destructive", title: "Error", description: res.message || "Failed to save work center" });
                    }
                } catch (error: any) {
                    console.error("Save Work Center Exception:", error);
                    toast({ variant: "destructive", title: "Error", description: error.message || "Failed to save work center" });
                } finally {
                    setIsSubmitting(false);
                }
            };

            await saveAction();
            return;
        } else if (selectedMaster === "Machines") {
            const codeT = normalizeMasterCodeForSave(formData.code);
            const nameT = normalizeMasterNameForSave(formData.name);
            if (
                String(formData.code ?? "").trim().length > MAX_MASTER_CODE_LEN ||
                String(formData.name ?? "").trim().length > MAX_MASTER_NAME_LEN
            ) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: `Code must be at most ${MAX_MASTER_CODE_LEN} characters and Name at most ${MAX_MASTER_NAME_LEN} characters.`,
                });
                return;
            }
            if (
                !codeT ||
                !nameT ||
                !formData.status ||
                normalizeMasterId(formData.work_center_id) == null
            ) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }
            if (!editingId && (!hasMinTwoChars(codeT) || !hasMinTwoChars(nameT))) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: "Code and Name must each be at least two characters.",
                });
                return;
            }

            const machineData = {
                code: codeT,
                name: nameT,
                description: formData.description,
                work_center_id: parseInt(formData.work_center_id),
                status: formData.status === "Active" ? 1 : 0
            };

            const saveAction = async () => {
                setIsSubmitting(true);
                try {
                    let res;
                    if (editingId) {
                        res = await machinesApi.update(editingId, machineData);
                    } else {
                        res = await machinesApi.create(machineData);
                    }

                    if (res.isSuccessful) {
                        toast({ ...crudSuccessToast, title: editingId ? "Updated" : "Created", description: res.message || `Machine ${editingId ? "updated" : "created"} successfully` });
                        setIsDialogOpen(false);
                        fetchMachines();
                    } else {
                        toast({ variant: "destructive", title: "Error", description: res.message || "Failed to save machine" });
                    }
                } catch (error: any) {
                    toast({ variant: "destructive", title: "Error", description: error.message || "Failed to save machine" });
                } finally {
                    setIsSubmitting(false);
                }
            };

            await saveAction();
            return; // Exit handleSave early as the API call handles the rest
        } else if (selectedMaster === "Operations") {
            const codeT = normalizeMasterCodeForSave(formData.code);
            const nameT = normalizeMasterNameForSave(formData.name);
            if (
                String(formData.code ?? "").trim().length > MAX_MASTER_CODE_LEN ||
                String(formData.name ?? "").trim().length > MAX_MASTER_NAME_LEN
            ) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: `Code must be at most ${MAX_MASTER_CODE_LEN} characters and Name at most ${MAX_MASTER_NAME_LEN} characters.`,
                });
                return;
            }
            if (
                !codeT ||
                !nameT ||
                !formData.status ||
                normalizeMasterId(formData.department_id) == null ||
                formData.cycle_time === undefined ||
                formData.cycle_time === null ||
                isNaN(Number(formData.cycle_time))
            ) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields including a valid Cycle Time." });
                return;
            }
            if (!editingId && (!hasMinTwoChars(codeT) || !hasMinTwoChars(nameT))) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: "Code and Name must each be at least two characters.",
                });
                return;
            }
            if (formData.cycle_time < 0) {
                toast({ variant: "destructive", title: "Validation Error", description: "Cycle Time cannot be negative." });
                return;
            }
            if (formData.is_qc_required) {
                const qcParams = formData.qc_parameters || [];
                if (qcParams.length === 0) {
                    toast({
                        variant: "destructive",
                        title: "Validation Error",
                        description: "When QC is required, add at least one QC parameter with Parameter Name and Check Description.",
                    });
                    return;
                }
                const hasIncomplete = qcParams.some(
                    (p: QCParameter) => !String(p.name ?? "").trim() || !String(p.description ?? "").trim()
                );
                if (hasIncomplete) {
                    toast({
                        variant: "destructive",
                        title: "Validation Error",
                        description: "When QC is required, every parameter must have Parameter Name and Check Description filled.",
                    });
                    return;
                }
            }

            const operationData = {
                code: codeT,
                name: nameT,
                description: formData.description || "",
                department_id: Number(formData.department_id),
                cycle_time: `${cycleTimeHH || "00"}:${cycleTimeMM || "00"}:00`,
                batchwise_tracking: !!formData.is_qc_required_batch_wise,
                is_qc_required: !!formData.is_qc_required,
                status: formData.status === "Active" ? 1 : 0,
                inputs: (formData.inputs || []).map((input: any) => {
                    const typeLabel = String(input.type || "RM");
                    const inputTypeId =
                        resolveOperationTypeId(operationInputTypes, typeLabel, itemTypes) ??
                        input.input_type_id;
                    if (!inputTypeId) {
                        console.error(
                            "Missing input_type_id for input:",
                            input,
                            "typeLabel:",
                            typeLabel,
                            "operationInputTypes:",
                            operationInputTypes
                        );
                    }
                    
                    return {
                        item_id: Number(input.item_id),
                        input_type_id: Number(inputTypeId)
                    };
                }),
                outputs: (formData.outputs || []).map((output: any) => {
                    const typeLabel = String(output.type || "SFG");
                    const outputTypeId =
                        resolveOperationTypeId(operationOutputTypes, typeLabel, itemTypes) ??
                        output.output_type_id;
                    if (!outputTypeId) {
                        console.error(
                            "Missing output_type_id for output:",
                            output,
                            "typeLabel:",
                            typeLabel,
                            "operationOutputTypes:",
                            operationOutputTypes
                        );
                    }
                    
                    return {
                        item_id: Number(output.item_id),
                        output_type_id: Number(outputTypeId)
                    };
                }),
                qc_parameters: (formData.qc_parameters || []).map((qc: any, index: number) => ({
                    parameter_name: qc.name,
                    check_description: qc.description || "",
                    sequence_no: index + 1
                }))
            };

            const saveAction = async () => {
                setIsSubmitting(true);
                try {
                    // Validate that all inputs have valid input_type_id
                    const invalidInputs = operationData.inputs.filter((i: { input_type_id?: number }) => !i.input_type_id || isNaN(i.input_type_id));
                    if (invalidInputs.length > 0) {
                        toast({ 
                            variant: "destructive", 
                            title: "Validation Error", 
                            description: "Some input items are missing type information. Please ensure all item types are properly configured." 
                        });
                        console.error('Invalid inputs:', invalidInputs);
                        setIsSubmitting(false);
                        return;
                    }
                    
                    // Validate that all outputs have valid output_type_id
                    const invalidOutputs = operationData.outputs.filter((o: { output_type_id?: number }) => !o.output_type_id || isNaN(o.output_type_id));
                    if (invalidOutputs.length > 0) {
                        toast({ 
                            variant: "destructive", 
                            title: "Validation Error", 
                            description: "Some output items are missing type information. Please ensure all item types are properly configured." 
                        });
                        console.error('Invalid outputs:', invalidOutputs);
                        setIsSubmitting(false);
                        return;
                    }

                    let res;
                    if (editingId) {
                        // For UPDATE: delta vs. server baseline (reuse edit getOne when possible)
                        let originalData: any;
                        const baseline = operationEditBaselineRef.current;
                        if (baseline && baseline.editingId === editingId) {
                            originalData = baseline.payload;
                        } else {
                            const originalRes = await operationsApi.getOne(editingId);
                            if (!originalRes.isSuccessful) {
                                toast({ variant: "destructive", title: "Error", description: "Failed to fetch original operation data" });
                                setIsSubmitting(false);
                                return;
                            }
                            originalData = extractOperationPayload(originalRes);
                        }

                        const originalInputs = extractOperationItems(originalData, "inputs");
                        const originalOutputs = extractOperationItems(originalData, "outputs");
                        const originalQC = Array.isArray(originalData?.qc_parameters) 
                            ? originalData.qc_parameters 
                            : Array.isArray(originalData?.qcParameters) 
                            ? originalData.qcParameters 
                            : [];
                        
                        // Calculate input deltas
                        const originalInputIds = originalInputs.map((i: any) => Number(i.id));
                        const currentInputIds = (formData.inputs || [])
                            .filter((i: any) => i.id && !isNaN(i.id) && i.id > 1) // Only existing items with real IDs
                            .map((i: any) => Number(i.id));
                        
                        const deletedInputIds = originalInputIds.filter((id: number) => !currentInputIds.includes(id));
                        const addedInputs = (formData.inputs || [])
                            .filter((i: any) => !i.id || i.id < 1 || isNaN(i.id)) // New items (temp IDs or no ID)
                            .map((input: any) => {
                                const typeLabel = String(input.type || "RM").toUpperCase();
                                const typeRecord = itemTypes.find(t => {
                                    const code = String(t.code || t.value_code || "").toUpperCase();
                                    const name = String(t.name || t.value_name || "").toUpperCase();
                                    
                                    if (typeLabel === "RM") return code === "RM" || name.includes("RAW");
                                    if (typeLabel === "SFG") return code === "SFG" || name.includes("SEMI");
                                    if (typeLabel === "FG") return code === "FG" || name.includes("FINISHED");
                                    if (typeLabel === "CONSUMABLES") return code === "CONS" || code === "CONSUMABLES" || name.includes("CONSUM");
                                    if (typeLabel === "WASTE") return code === "WASTE" || name.includes("WASTE");
                                    
                                    return code === typeLabel;
                                });
                                
                                return {
                                    item_id: Number(input.item_id),
                                    input_type_id: Number(typeRecord?.id || input.input_type_id)
                                };
                            });
                        
                        // Calculate output deltas
                        const originalOutputIds = originalOutputs.map((o: any) => Number(o.id));
                        const currentOutputIds = (formData.outputs || [])
                            .filter((o: any) => o.id && !isNaN(o.id) && o.id > 1)
                            .map((o: any) => Number(o.id));
                        
                        const deletedOutputIds = originalOutputIds.filter((id: number) => !currentOutputIds.includes(id));
                        const addedOutputs = (formData.outputs || [])
                            .filter((o: any) => !o.id || o.id < 1 || isNaN(o.id))
                            .map((output: any) => {
                                const typeLabel = String(output.type || "SFG").toUpperCase();
                                const typeRecord = itemTypes.find(t => {
                                    const code = String(t.code || t.value_code || "").toUpperCase();
                                    const name = String(t.name || t.value_name || "").toUpperCase();
                                    
                                    if (typeLabel === "RM") return code === "RM" || name.includes("RAW");
                                    if (typeLabel === "SFG") return code === "SFG" || name.includes("SEMI");
                                    if (typeLabel === "FG") return code === "FG" || name.includes("FINISHED");
                                    if (typeLabel === "CONSUMABLES") return code === "CONS" || code === "CONSUMABLES" || name.includes("CONSUM");
                                    if (typeLabel === "WASTE") return code === "WASTE" || name.includes("WASTE");
                                    
                                    return code === typeLabel;
                                });
                                
                                return {
                                    item_id: Number(output.item_id),
                                    output_type_id: Number(typeRecord?.id || output.output_type_id)
                                };
                            });
                        
                        // Calculate QC parameter deltas
                        const originalQCIds = originalQC.map((q: any) => Number(q.id));
                        const currentQCIds = (formData.qc_parameters || [])
                            .filter((q: any) => q.id && !isNaN(q.id) && q.id > 1)
                            .map((q: any) => Number(q.id));
                        
                        const deletedQCIds = originalQCIds.filter((id: number) => !currentQCIds.includes(id));
                        const addedQC = (formData.qc_parameters || [])
                            .filter((q: any) => !q.id || q.id < 1 || isNaN(q.id))
                            .map((qc: any, index: number) => ({
                                parameter_name: qc.name,
                                check_description: qc.description || "",
                                sequence_no: index + 1
                            }));
                        
                        // Build delta-based update payload
                        const updatePayload: any = {
                            code: operationData.code,
                            name: operationData.name,
                            description: operationData.description,
                            department_id: operationData.department_id,
                            cycle_time: operationData.cycle_time,
                            batchwise_tracking: operationData.batchwise_tracking,
                            is_qc_required: operationData.is_qc_required,
                            status: operationData.status
                        };
                        
                        // Add delta arrays only if there are changes
                        if (addedInputs.length > 0) {
                            updatePayload.add_inputs = addedInputs;
                        }
                        if (deletedInputIds.length > 0) {
                            updatePayload.delete_inputs = deletedInputIds.map((id: number) => ({ id }));
                        }
                        if (addedOutputs.length > 0) {
                            updatePayload.add_outputs = addedOutputs;
                        }
                        if (deletedOutputIds.length > 0) {
                            updatePayload.delete_outputs = deletedOutputIds.map((id: number) => ({ id }));
                        }
                        if (addedQC.length > 0) {
                            updatePayload.add_qc_parameters = addedQC;
                        }
                        if (deletedQCIds.length > 0) {
                            updatePayload.delete_qc_parameters = deletedQCIds.map((id: number) => ({ id }));
                        }
                        
                        console.log('Update payload with deltas:', updatePayload);
                        res = await operationsApi.update({ ...updatePayload, id: editingId });
                    } else {
                        // For CREATE: Use full payload with arrays
                        const createPayload = { ...operationData } as any;
                        delete createPayload.id;
                        console.log('Create payload:', createPayload);
                        res = await operationsApi.create(createPayload);
                    }

                    if (res.isSuccessful) {
                        toast({ ...crudSuccessToast, title: editingId ? "Updated" : "Created", description: res.message || `Operation ${editingId ? "updated" : "created"} successfully` });
                        setIsDialogOpen(false);
                        fetchOperations();
                    } else {
                        toast({ variant: "destructive", title: "Error", description: res.message || "Failed to save operation" });
                    }
                } catch (error: any) {
                    console.error('Save operation error:', error);
                    toast({ variant: "destructive", title: "Error", description: error.message || "Failed to save operation" });
                } finally {
                    setIsSubmitting(false);
                }
            };

            await saveAction();
            return;
        }
        setIsDialogOpen(false);
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
        if (selectedMaster === "SKU Operation") {
            return null;
        }
        if (selectedMaster === "Work Centers") {
            return (
                <Table className="w-full table-fixed">
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[10%] min-w-0">Code</TableHead>
                            <TableHead className="min-w-0">Work Center Name</TableHead>
                            <TableHead className="min-w-0">Description</TableHead>
                            <TableHead className="w-[12%] min-w-0">Location</TableHead>
                            <TableHead className="w-[12%] min-w-0">Department</TableHead>
                            <TableHead className="w-[90px]">Status</TableHead>
                            <TableHead className="w-[100px] text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isListLoading ? (
                            renderListLoadingRow(7)
                        ) : paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No work centers found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell className="max-w-0 min-w-0 font-medium">
                                        <div className="truncate" title={item.code ? String(item.code) : undefined}>
                                            {item.code}
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-0 min-w-0">
                                        <div className="truncate" title={item.name ? String(item.name) : undefined}>
                                            {item.name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-0 min-w-0">
                                        <div className="truncate" title={item.description ? String(item.description) : undefined}>
                                            {item.description || "-"}
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-0 min-w-0">
                                        <div className="truncate" title={item.location ? String(item.location) : undefined}>
                                            {item.location}
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-0 min-w-0">
                                        <div className="truncate" title={item.department ? String(item.department) : undefined}>
                                            {item.department}
                                        </div>
                                    </TableCell>
                                    <TableCell><StatusBadge status={item.status} /></TableCell>
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
        } else if (selectedMaster === "Machines") {
            return (
                <Table className="w-full table-fixed">
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[10%] min-w-0">Code</TableHead>
                            <TableHead className="min-w-0">Machine Name</TableHead>
                            <TableHead className="min-w-0">Description</TableHead>
                            <TableHead className="w-[18%] min-w-0">Work Center</TableHead>
                            <TableHead className="w-[90px]">Status</TableHead>
                            <TableHead className="w-[100px] text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isListLoading ? (
                            renderListLoadingRow(6)
                        ) : paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No machines found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => {
                                const wc = workCenters.find(w => w.id === item.work_center_id);
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="max-w-0 min-w-0 font-medium">
                                            <div className="truncate" title={item.code ? String(item.code) : undefined}>
                                                {item.code}
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-0 min-w-0">
                                            <div className="truncate" title={item.name ? String(item.name) : undefined}>
                                                {item.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-0 min-w-0">
                                            <div className="truncate" title={item.description ? String(item.description) : undefined}>
                                                {item.description || "-"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-0 min-w-0">
                                            <div
                                                className="truncate"
                                                title={String(item.work_center_name || (wc ? wc.name : "Unknown"))}
                                            >
                                                {item.work_center_name || (wc ? wc.name : "Unknown")}
                                            </div>
                                        </TableCell>
                                        <TableCell><StatusBadge status={item.status} /></TableCell>
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
        } else if (selectedMaster === "Operations") {
            /** Fixed/pinned widths so Operation Name cannot stretch across the row (avoids huge gap before Cycle Time). */
            const opColCode = "w-[112px] max-w-[112px]";
            /** Cap width so the name column does not leave a wide empty gap before Cycle Time. */
            const opColName = "w-[200px] max-w-[200px]";
            return (
                <Table className="w-full table-fixed">
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className={`${opColCode} min-w-0`}>Code</TableHead>
                            <TableHead className={`${opColName} min-w-0`}>Operation Name</TableHead>
                            <TableHead className="w-[118px] min-w-[118px] text-center">Cycle Time (HH:MM)</TableHead>
                            <TableHead className="w-[100px] min-w-[100px] text-center">QC Required</TableHead>
                            <TableHead className="w-[128px] min-w-[128px] text-center">Batchwise Tracking</TableHead>
                            <TableHead className="w-[88px] min-w-[88px]">Status</TableHead>
                            <TableHead className="w-[104px] min-w-[104px] text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isListLoading ? (
                            renderListLoadingRow(7)
                        ) : paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No operations found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => {
                                const isDemoRow =
                                    item.is_gsv7_demo === true || isGsv7DemoOperationId(Number(item.id));
                                return (
                                    <TableRow key={item.id} className={isDemoRow ? "bg-slate-50/80" : undefined}>
                                        <TableCell className={`${opColCode} max-w-0 min-w-0 font-medium`}>
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <div className="truncate" title={item.code ? String(item.code) : undefined}>
                                                    {item.code}
                                                </div>
                                                {isDemoRow && (
                                                    <Badge
                                                        variant="outline"
                                                        className="shrink-0 text-[10px] px-1 py-0 h-4 border-amber-300 text-amber-800 bg-amber-50"
                                                    >
                                                        Demo
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className={`${opColName} max-w-0 min-w-0 overflow-hidden`}>
                                            <div
                                                className="truncate text-left"
                                                title={item.name ? String(item.name) : undefined}
                                            >
                                                {item.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[118px] text-center font-medium">
                                            {hoursToHHMM(Number(item.cycle_time || 0))}
                                        </TableCell>
                                        <TableCell className="w-[100px] text-center">
                                            {item.is_qc_required ? (
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">Yes</Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">No</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="w-[128px] text-center">
                                            {item.is_qc_required_batch_wise ? (
                                                <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">Yes</Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">No</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="w-[88px]"><StatusBadge status={item.status} /></TableCell>
                                        <TableCell className="w-[120px] text-center">
                                            <TableActionButtons
                                                onEdit={
                                                    canEdit(universalKey) && !isDemoRow
                                                        ? () => {
                                                              void handleEditClick(item);
                                                          }
                                                        : undefined
                                                }
                                                onDelete={
                                                    canDelete(universalKey) && !isDemoRow
                                                        ? () => handleDeleteClick(item.id)
                                                        : undefined
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
        }
    };

    const renderForm = () => {
        const codeFieldError = editingId ? null : getCodeNameInlineError(String(formData.code ?? ""));
        const nameFieldError = editingId ? null : getCodeNameInlineError(String(formData.name ?? ""));

        if (selectedMaster === "Work Centers") {
            // ... (Work Centers form code)
            return (
                <div className="grid min-w-0 max-w-full gap-6 py-4 px-1">
                    <div className="grid min-w-0 grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="wc-code">Code *</Label>
                            <Input
                                id="wc-code"
                                maxLength={MAX_MASTER_CODE_LEN}
                                value={formData.code || ""}
                                onChange={(e) =>
                                    setFormData((prev: any) => ({ ...prev, code: clampMasterCode(e.target.value) }))
                                }
                                onBlur={() =>
                                    setFormData((prev: any) => ({
                                        ...prev,
                                        code: normalizeMasterCodeForSave(prev.code),
                                    }))
                                }
                                placeholder="Ex: WC001"
                                className={cn(codeFieldError && "border-destructive focus-visible:ring-destructive")}
                                aria-invalid={!!codeFieldError}
                            />
                            {codeFieldError ? (
                                <p className="text-sm text-destructive">{codeFieldError}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="wc-name">Name *</Label>
                            <Input
                                id="wc-name"
                                maxLength={MAX_MASTER_NAME_LEN}
                                value={formData.name || ""}
                                onChange={(e) =>
                                    setFormData((prev: any) => ({ ...prev, name: clampMasterName(e.target.value) }))
                                }
                                onBlur={() =>
                                    setFormData((prev: any) => ({
                                        ...prev,
                                        name: normalizeMasterNameForSave(prev.name),
                                    }))
                                }
                                placeholder="Assembly Line 1"
                                className={cn(nameFieldError && "border-destructive focus-visible:ring-destructive")}
                                aria-invalid={!!nameFieldError}
                            />
                            {nameFieldError ? (
                                <p className="text-sm text-destructive">{nameFieldError}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label>Location *</Label>
                            <SearchableSelect
                                placeholder="Select Location"
                                value={normalizeMasterId(formData.work_location_id) != null ? String(formData.work_location_id) : undefined}
                                options={orderedLocationsForWc.map((loc) => ({
                                    label: loc.name,
                                    value: String(loc.id),
                                }))}
                                onChange={(val) => setFormData({ ...formData, work_location_id: parseInt(val) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Department *</Label>
                            <SearchableSelect
                                placeholder="Select Department"
                                value={normalizeMasterId(formData.department_id) != null ? String(formData.department_id) : undefined}
                                options={departments.map(dept => ({ label: dept.name, value: String(dept.id) }))}
                                onChange={(val) => setFormData({ ...formData, department_id: parseInt(val) })}
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
                        <div className="col-span-2 space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" value={formData.description || ""} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Work center description..." />
                        </div>
                    </div>

                    <div className="min-w-0 max-w-full space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-blue-600">Operations</h4>
                        </div>

                        <div className="flex min-w-0 max-w-full gap-2">
                            <div className="min-w-0 flex-1">
                                <SearchableSelect
                                    placeholder="Choose Operation..."
                                    value={selectedWCOpId || undefined}
                                    className="h-auto min-h-10 items-start! py-1"
                                    options={allOperations.map(op => ({
                                        label: `${op.code} ${op.name}`.trim(),
                                        value: String(op.id),
                                        primaryText: String(op.code ?? ""),
                                        secondaryText: String(op.name ?? ""),
                                        disabled: formData.linked_operations?.includes(op.id)
                                    }))}
                                    onChange={(val) => setSelectedWCOpId(val)}
                                    selectedTruncate="end"
                                    selectedPrimaryLineClamp={2}
                                    compactStackedSelected
                                    showSelectedTitle
                                />
                            </div>
                            <Button type="button" className="shrink-0" onClick={addWCOperation}><Plus className="h-4 w-4 mr-2" /> Add</Button>
                        </div>

                        <div className="max-w-full min-w-0 overflow-x-hidden rounded-md border bg-muted/20 p-2 min-h-[100px]">
                            <Label className="mb-2 block text-xs text-muted-foreground ml-1">Operation Details</Label>
                            {!formData.linked_operations?.length ? (
                                <div className="text-sm text-muted-foreground text-center py-8">No operations linked</div>
                            ) : (
                                <div className="min-w-0 max-w-full space-y-2">
                                    {formData.linked_operations.map((opId: number) => {
                                        // Try to find in allOperations first, then fallback to operations_data from API
                                        let op = allOperations.find(o => o.id === opId);
                                        if (!op && formData.operations_data) {
                                            const opData = formData.operations_data.find((o: any) => o.operation_id === opId);
                                            if (opData) {
                                                op = {
                                                    id: opData.operation_id,
                                                    code: opData.code,
                                                    name: opData.name,
                                                    status: "Active"
                                                } as any;
                                            }
                                        }
                                        if (!op) return null;
                                        return (
                                            <div
                                                key={opId}
                                                className="flex min-w-0 max-w-full items-start justify-between gap-2 rounded border bg-white p-2 transition-colors hover:bg-slate-50"
                                            >
                                                <div className="min-w-0 max-w-full flex-1">
                                                    <div
                                                        className="max-w-full font-medium text-sm whitespace-normal break-all wrap-anywhere"
                                                        title={op.name ? String(op.name) : undefined}
                                                    >
                                                        {op.name}
                                                    </div>
                                                    <div
                                                        className="max-w-full text-xs text-muted-foreground whitespace-normal break-all wrap-anywhere"
                                                        title={op.code ? String(op.code) : undefined}
                                                    >
                                                        {op.code}
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 shrink-0 text-destructive hover:bg-destructive/10"
                                                    onClick={() => removeWCOperation(opId)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>


                </div>
            );
        } else if (selectedMaster === "Machines") {
            // ... (Machines form code)
            return (
                <div className="grid min-w-0 max-w-full gap-6 py-4 px-1">
                    <div className="grid min-w-0 grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="m-code">Code *</Label>
                            <Input
                                id="m-code"
                                maxLength={MAX_MASTER_CODE_LEN}
                                value={formData.code || ""}
                                onChange={(e) =>
                                    setFormData((prev: any) => ({ ...prev, code: clampMasterCode(e.target.value) }))
                                }
                                onBlur={() =>
                                    setFormData((prev: any) => ({
                                        ...prev,
                                        code: normalizeMasterCodeForSave(prev.code),
                                    }))
                                }
                                placeholder="Ex: M001"
                                className={cn(codeFieldError && "border-destructive focus-visible:ring-destructive")}
                                aria-invalid={!!codeFieldError}
                            />
                            {codeFieldError ? (
                                <p className="text-sm text-destructive">{codeFieldError}</p>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="m-name">Name *</Label>
                            <Input
                                id="m-name"
                                maxLength={MAX_MASTER_NAME_LEN}
                                value={formData.name || ""}
                                onChange={(e) =>
                                    setFormData((prev: any) => ({ ...prev, name: clampMasterName(e.target.value) }))
                                }
                                onBlur={() =>
                                    setFormData((prev: any) => ({
                                        ...prev,
                                        name: normalizeMasterNameForSave(prev.name),
                                    }))
                                }
                                placeholder="Machine Name"
                                className={cn(nameFieldError && "border-destructive focus-visible:ring-destructive")}
                                aria-invalid={!!nameFieldError}
                            />
                            {nameFieldError ? (
                                <p className="text-sm text-destructive">{nameFieldError}</p>
                            ) : null}
                        </div>
                        <div className="min-w-0 space-y-2">
                            <Label>Work Center *</Label>
                            <SearchableSelect
                                placeholder="Select Work Center"
                                value={formData.work_center_id || undefined}
                                options={orderedWorkCentersForMachine.map((wc) => ({
                                    label: `${wc.code} - ${wc.name}`,
                                    value: String(wc.id),
                                }))}
                                onChange={(val) => setFormData({ ...formData, work_center_id: val })}
                            />
                        </div>
                        <div className="min-w-0 space-y-2">
                            <Label>Status *</Label>
                            <SearchableSelect
                                placeholder="Select Status"
                                value={formData.status}
                                options={["Active", "Inactive"]}
                                onChange={(val) => setFormData({ ...formData, status: val as "Active" | "Inactive" })}
                            />
                        </div>
                        <div className="col-span-2 min-w-0 space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" value={formData.description || ""} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Machine description..." />
                        </div>
                    </div>
                </div>
            );

        } else if (selectedMaster === "Operations") {
            return (
                <div className="grid gap-6 py-4 px-1">
                    <div>
                        <SectionHeader title="Basic Info" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="op-code">Code *</Label>
                                <Input
                                    id="op-code"
                                    maxLength={MAX_MASTER_CODE_LEN}
                                    value={formData.code || ""}
                                    onChange={(e) =>
                                        setFormData((prev: any) => ({ ...prev, code: clampMasterCode(e.target.value) }))
                                    }
                                    onBlur={() =>
                                        setFormData((prev: any) => ({
                                            ...prev,
                                            code: normalizeMasterCodeForSave(prev.code),
                                        }))
                                    }
                                    placeholder="Ex: OP001"
                                    className={cn(codeFieldError && "border-destructive focus-visible:ring-destructive")}
                                    aria-invalid={!!codeFieldError}
                                />
                                {codeFieldError ? (
                                    <p className="text-sm text-destructive">{codeFieldError}</p>
                                ) : null}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="op-name">Name *</Label>
                                <Input
                                    id="op-name"
                                    maxLength={MAX_MASTER_NAME_LEN}
                                    value={formData.name || ""}
                                    onChange={(e) =>
                                        setFormData((prev: any) => ({ ...prev, name: clampMasterName(e.target.value) }))
                                    }
                                    onBlur={() =>
                                        setFormData((prev: any) => ({
                                            ...prev,
                                            name: normalizeMasterNameForSave(prev.name),
                                        }))
                                    }
                                    placeholder="Operation Name"
                                    className={cn(nameFieldError && "border-destructive focus-visible:ring-destructive")}
                                    aria-invalid={!!nameFieldError}
                                />
                                {nameFieldError ? (
                                    <p className="text-sm text-destructive">{nameFieldError}</p>
                                ) : null}
                            </div>
                            <div className="space-y-2">
                                <Label>Department *</Label>
                                <SearchableSelect
                                    placeholder="Select Department"
                                    value={normalizeMasterId(formData.department_id) != null ? String(formData.department_id) : undefined}
                                    options={departments.map((dept: any) => ({ label: dept.name, value: String(dept.id) }))}
                                    onChange={(val) => setFormData({ ...formData, department_id: parseInt(val) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Status *</Label>
                                <SearchableSelect
                                    placeholder="Select Status"
                                    value={formData.status || ""}
                                    options={["Active", "Inactive"]}
                                    onChange={(val) => setFormData({ ...formData, status: val as "Active" | "Inactive" })}
                                />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="cycle_time">Cycle Time (HH:MM) *</Label>
                                <div className="flex items-center gap-2">
                                    <SearchableSelect
                                        value={cycleTimeHH}
                                        onChange={(val: string) => {
                                            setCycleTimeHH(val);
                                            const h = Number(val);
                                            const m = Number(cycleTimeMM);
                                            setFormData({ ...formData, cycle_time: h + m / 60 });
                                        }}
                                        options={DURATION_HOURS}
                                        placeholder="HH"
                                    />
                                    <span className="text-muted-foreground font-medium">:</span>
                                    <SearchableSelect
                                        value={cycleTimeMM}
                                        onChange={(val: string) => {
                                            setCycleTimeMM(val);
                                            const h = Number(cycleTimeHH);
                                            const m = Number(val);
                                            setFormData({ ...formData, cycle_time: h + m / 60 });
                                        }}
                                        options={DURATION_MINUTES}
                                        placeholder="MM"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" value={formData.description || ""} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Operation description..." />
                        </div>
                    </div>

                    <div>
                        <SectionHeader title="Inputs (RM / SFG / Waste)" required />
                        <div className="mb-4 overflow-x-auto">
                            <div className="grid min-w-[560px] grid-cols-[minmax(160px,200px)_minmax(200px,1fr)_auto] gap-3 items-end">
                            <div className="min-w-0 space-y-2">
                                <Label>Input Type</Label>
                                <SearchableSelect 
                                    value={selectedInputType || undefined} 
                                    onChange={(val: any) => {
                                        if (val === selectedInputType) return;
                                        setSelectedInputType(val);
                                        setSelectedInputId("");
                                    }}
                                    options={inputTypeSelectOptions}
                                    placeholder={isOperationTypesLoading ? "Loading..." : "Select type"}
                                    disabled={isOperationTypesLoading || inputTypeSelectOptions.length === 0}
                                />
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                <Label>Select Input Item</Label>
                                <SearchableSelect
                                    placeholder="Choose Item..."
                                    value={selectedInputId || undefined}
                                    options={inputItemList
                                        .filter((i) => itemMatchesSelectedTypeForPicker(i, itemTypes, selectedInputType))
                                        .map(item => ({
                                            label: `${item.code} ${item.name}`.trim(),
                                            value: String(item.id),
                                            primaryText: String(item.code ?? ""),
                                            secondaryText: String(item.name ?? ""),
                                        }))}
                                    onChange={(val) => {
                                        setSelectedInputId(val);
                                    }}
                                    className="h-auto min-h-10 items-start! py-1"
                                    selectedTruncate="end"
                                    selectedPrimaryLineClamp={2}
                                    compactStackedSelected
                                    showSelectedTitle
                                />
                            </div>
                            <Button
                                type="button"
                                className="shrink-0"
                                disabled={!selectedInputId}
                                onClick={() => addOperationItem("inputs")}
                            >
                                <Plus className="h-4 w-4 mr-2" /> Add
                            </Button>
                            </div>
                        </div>
                        <div className="rounded-md border min-w-0 overflow-x-auto">
                            <Table className="w-full table-fixed">
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="min-w-0 w-[55%]">Item Details</TableHead>
                                        <TableHead className="w-[20%]">UOM</TableHead>
                                        <TableHead className="w-[15%]">Type</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {formData.inputs?.map((item: OperationItem) => {
                                        const originalItem =
                                            operationInputItemById.get(Number(item.item_id)) ||
                                            inputItemList.find((i) => Number(i.id) === Number(item.item_id)) ||
                                            outputItemList.find((i) => Number(i.id) === Number(item.item_id));
                                        const nameText = originalItem?.name || item.item_name || "-";
                                        const codeText = originalItem?.code || item.item_code || "-";
                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell className="min-w-0 align-top">
                                                    <div
                                                        className="font-medium wrap-anywhere whitespace-normal"
                                                        title={nameText !== "-" ? String(nameText) : undefined}
                                                    >
                                                        {nameText}
                                                    </div>
                                                    <div
                                                        className="text-xs text-muted-foreground wrap-anywhere whitespace-normal"
                                                        title={codeText !== "-" ? String(codeText) : undefined}
                                                    >
                                                        {codeText}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="min-w-0 align-top wrap-anywhere">
                                                    {originalItem?.uom || item.item_uom || "-"}
                                                </TableCell>
                                                <TableCell className="align-top"><Badge variant="outline">{item.type}</Badge></TableCell>
                                                <TableCell className="align-top">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeOperationItem("inputs", item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {(!formData.inputs?.length) && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground h-24">No inputs added.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div>
                        <SectionHeader title="Outputs (SFG / FG / Waste)" required />
                        <div className="mb-4 overflow-x-auto">
                            <div className="grid min-w-[560px] grid-cols-[minmax(160px,200px)_minmax(200px,1fr)_auto] gap-3 items-end">
                            <div className="min-w-0 space-y-2">
                                <Label>Output Type</Label>
                                <SearchableSelect 
                                    value={selectedOutputType || undefined} 
                                    onChange={(val: any) => {
                                        if (val === selectedOutputType) return;
                                        setSelectedOutputType(val);
                                        setSelectedOutputId("");
                                    }}
                                    options={outputTypeSelectOptions}
                                    placeholder={isOperationTypesLoading ? "Loading..." : "Select type"}
                                    disabled={isOperationTypesLoading || outputTypeSelectOptions.length === 0}
                                />
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                <Label>Select Output Item</Label>
                                <SearchableSelect
                                    placeholder="Choose Item..."
                                    value={selectedOutputId || undefined}
                                    options={outputItemList
                                        .filter((i) => itemMatchesSelectedTypeForPicker(i, itemTypes, selectedOutputType))
                                        .map(item => ({
                                            label: `${item.code} ${item.name}`.trim(),
                                            value: String(item.id),
                                            primaryText: String(item.code ?? ""),
                                            secondaryText: String(item.name ?? ""),
                                        }))}
                                    onChange={(val) => {
                                        setSelectedOutputId(val);
                                    }}
                                    className="h-auto min-h-10 items-start! py-1"
                                    selectedTruncate="end"
                                    selectedPrimaryLineClamp={2}
                                    compactStackedSelected
                                    showSelectedTitle
                                />
                            </div>
                            <Button
                                type="button"
                                className="shrink-0"
                                disabled={!selectedOutputId}
                                onClick={() => addOperationItem("outputs")}
                            >
                                <Plus className="h-4 w-4 mr-2" /> Add
                            </Button>
                            </div>
                        </div>
                        <div className="rounded-md border min-w-0 overflow-x-auto">
                            <Table className="w-full table-fixed">
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="min-w-0 w-[55%]">Item Details</TableHead>
                                        <TableHead className="w-[20%]">UOM</TableHead>
                                        <TableHead className="w-[15%]">Type</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {formData.outputs?.map((item: OperationItem) => {
                                        const originalItem =
                                            operationOutputItemById.get(Number(item.item_id)) ||
                                            outputItemList.find((i) => Number(i.id) === Number(item.item_id)) ||
                                            inputItemList.find((i) => Number(i.id) === Number(item.item_id));
                                        const nameText = originalItem?.name || item.item_name || "-";
                                        const codeText = originalItem?.code || item.item_code || "-";
                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell className="min-w-0 align-top">
                                                    <div
                                                        className="font-medium wrap-anywhere whitespace-normal"
                                                        title={nameText !== "-" ? String(nameText) : undefined}
                                                    >
                                                        {nameText}
                                                    </div>
                                                    <div
                                                        className="text-xs text-muted-foreground wrap-anywhere whitespace-normal"
                                                        title={codeText !== "-" ? String(codeText) : undefined}
                                                    >
                                                        {codeText}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="min-w-0 align-top wrap-anywhere">
                                                    {originalItem?.uom || item.item_uom || "-"}
                                                </TableCell>
                                                <TableCell className="align-top"><Badge variant="outline">{item.type}</Badge></TableCell>
                                                <TableCell className="align-top">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeOperationItem("outputs", item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {(!formData.outputs?.length) && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground h-24">No outputs added.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="is_qc_required_batch_wise"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={formData.is_qc_required_batch_wise || false}
                                    onChange={(e) => setFormData({ ...formData, is_qc_required_batch_wise: e.target.checked })}
                                />
                                <Label htmlFor="is_qc_required_batch_wise" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Batchwise tracking
                                </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="is_qc_required"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={formData.is_qc_required || false}
                                    onChange={(e) => setFormData({ ...formData, is_qc_required: e.target.checked })}
                                />
                                <Label htmlFor="is_qc_required" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Is QC Required?
                                </Label>
                            </div>
                        </div>

                        {formData.is_qc_required && (
                            <div className="rounded-lg border p-4 bg-muted/20">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-semibold text-sm">QC Parameters</h4>
                                    <Button variant="outline" size="sm" onClick={addQCParam}>
                                        <Plus className="h-3.5 w-3.5 mr-2" />
                                        Add Parameter
                                    </Button>
                                </div>
                                <div className="space-y-3">
                                    {(formData.qc_parameters || []).map((param: QCParameter) => (
                                        <div key={param.id} className="flex gap-3 items-start">
                                            <div className="flex-1">
                                                <Input
                                                    placeholder="Parameter Name"
                                                    value={param.name}
                                                    onChange={(e) => updateQCParam(param.id, "name", e.target.value)}
                                                    className="h-9"
                                                />
                                            </div>
                                            <div className="flex-2">
                                                <Input
                                                    placeholder="Check Description"
                                                    value={param.description}
                                                    onChange={(e) => updateQCParam(param.id, "description", e.target.value)}
                                                    className="h-9"
                                                />
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeQCParam(param.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {(!formData.qc_parameters?.length) && <div className="text-center text-muted-foreground text-sm py-2">No QC parameters defined.</div>}
                                </div>
                            </div>

                        )}
                    </div>
                </div >
            );
        }
    };

    // ... (rest of the code)


    return (
        <div className="flex flex-col gap-6 h-full overflow-hidden">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Production Masters</h1>
                <p className="text-muted-foreground">
                    Manage work centers, machines, and production configurations.
                </p>
            </div>

            {!isMenuVisible(universalKey) ? (
                <Card className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-center p-6 border-dashed">
                    <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                        <Plus className="h-8 w-8 text-destructive rotate-45" />
                    </div>
                    <CardTitle className="text-xl mb-2">Access Denied</CardTitle>
                    <CardDescription className="max-w-xs">
                        You do not have permission to view Production Masters. Please contact your administrator for access.
                    </CardDescription>
                </Card>
            ) : (
                <Tabs value={activeTab} onValueChange={(value) => {
                    const masterType = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === value)?.[0] as MasterType;
                    if (masterType) handleMasterChange(masterType);
                }} className="w-full flex-1 flex flex-col min-h-0">
                    <div className="border-b border-border">
                        <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                            {MASTER_TYPES.map((type) => (
                                <TabsTrigger
                                    key={type}
                                    value={MASTER_SLUGS[type]}
                                    onClick={() => handleMasterChange(type)}
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                                >
                                    {MASTER_TYPE_LABELS[type]}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="flex-1 flex flex-col gap-6 mt-6 overflow-y-auto pr-2 pb-6 custom-scrollbar">
                        {selectedMaster === "SKU Operation" ? (
                            <ProductionSkuOperationTab
                                canEdit={canEdit(universalKey)}
                                canDelete={canDelete(universalKey)}
                            />
                        ) : (
                            <>
                                <AppListToolbar
                                    search={{
                                        placeholder: "Search by code, name...",
                                        value: searchTerm,
                                        onChange: setSearchTerm,
                                    }}
                                    filters={[
                                        {
                                            type: "select" as const,
                                            label: "Status",
                                            value: filterStatus,
                                            onChange: setFilterStatus,
                                            options: [
                                                { label: "All Status", value: "All" },
                                                { label: "Active", value: "Active" },
                                                { label: "Inactive", value: "Inactive" },
                                            ],
                                            searchable: true,
                                        },
                                    ]}
                                    actions={[
                                        ...(canCreate(universalKey)
                                            ? [
                                                  {
                                                      label:
                                                          selectedMaster === "Work Centers"
                                                              ? "Create Work Center"
                                                              : selectedMaster === "Machines"
                                                                ? "Create Machine"
                                                                : "Create Operation",
                                                      icon: <Plus className="mr-2 h-4 w-4" />,
                                                      onClick: handleAddClick,
                                                  },
                                                  ...(selectedMaster === "Operations"
                                                      ? [
                                                            {
                                                                label: isGsv7SetupRunning
                                                                    ? "Updating GSV7…"
                                                                    : showGsv7Demo
                                                                      ? "Hide GSV7 demo"
                                                                      : "Show GSV7 demo",
                                                                icon: isGsv7SetupRunning ? (
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Package className="mr-2 h-4 w-4" />
                                                                ),
                                                                onClick: handleToggleGsv7Demo,
                                                                disabled: isGsv7SetupRunning,
                                                                variant: showGsv7Demo
                                                                    ? "secondary"
                                                                    : "default",
                                                            },
                                                        ]
                                                      : []),
                                              ]
                                            : []),
                                    ]}
                                />

                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle>{getMasterListTitle(selectedMaster)}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="relative">
                                        {isListLoading &&
                                            selectedMaster !== "Work Centers" &&
                                            selectedMaster !== "Machines" &&
                                            selectedMaster !== "Operations" && (
                                                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                </div>
                                            )}
                                        <div className="min-w-0 max-w-full overflow-x-auto rounded-md border">
                                            {renderTable()}
                                        </div>

                                        {!isListLoading && (
                                            <DataTablePagination
                                                currentPage={currentPage}
                                                totalPages={totalPages}
                                                totalItems={totalItems}
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
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent
                    className="w-[95%] max-w-4xl xl:max-w-5xl max-h-[85vh] overflow-hidden p-0 flex flex-col gap-0"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <div className="shrink-0 border-b bg-white px-6 py-5">
                        <DialogHeader className="p-0">
                            <DialogTitle>
                                {editingId ? "Edit" : "Create"}{" "}
                                {selectedMaster === "Work Centers"
                                    ? "Work Center"
                                    : selectedMaster === "Machines"
                                        ? "Machine"
                                        : "Operation"}
                            </DialogTitle>
                            <DialogDescription>
                                Configure the details for this{" "}
                                {selectedMaster === "Work Centers"
                                    ? "work center"
                                    : selectedMaster === "Machines"
                                        ? "machine"
                                        : "operation"}
                                .
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="relative flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-6 py-5">
                        {selectedMaster === "Work Centers" && (isFormDetailLoading || isWcDialogPrepLoading) && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            </div>
                        )}
                        {renderForm()}
                    </div>

                    <div className="shrink-0 border-t bg-white px-6 py-4 mt-auto flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleDialogOpenChange(false)}
                            disabled={
                                isSubmitting ||
                                (selectedMaster === "Work Centers" &&
                                    (isFormDetailLoading || isWcDialogPrepLoading)) ||
                                (selectedMaster === "Machines" &&
                                    (isFormDetailLoading || isMachineDialogPrepLoading)) ||
                                (selectedMaster === "Operations" && isFormDetailLoading)
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSave}
                            loading={isSubmitting}
                            className="disabled:bg-muted disabled:text-muted-foreground disabled:border-border disabled:opacity-100 disabled:shadow-none"
                            disabled={
                                isSubmitting ||
                                (selectedMaster === "Work Centers" &&
                                    (isFormDetailLoading || isWcDialogPrepLoading)) ||
                                (selectedMaster === "Machines" &&
                                    (isFormDetailLoading || isMachineDialogPrepLoading)) ||
                                (selectedMaster === "Operations" && isFormDetailLoading) ||
                                (() => {
                            const codeOk = editingId
                                ? !!String(formData.code ?? "").trim()
                                : !!String(formData.code ?? "").trim() && hasMinTwoChars(String(formData.code ?? ""));
                            const nameOk = editingId
                                ? !!String(formData.name ?? "").trim()
                                : !!String(formData.name ?? "").trim() && hasMinTwoChars(String(formData.name ?? ""));
                            if (selectedMaster === "Work Centers") {
                                const locOk = normalizeMasterId(formData.work_location_id) != null;
                                const deptOk = normalizeMasterId(formData.department_id) != null;
                                return !codeOk || !nameOk || !locOk || !deptOk;
                            } else if (selectedMaster === "Machines") {
                                return !codeOk || !nameOk || normalizeMasterId(formData.work_center_id) == null;
                            } else if (selectedMaster === "Operations") {
                                const deptOk = normalizeMasterId(formData.department_id) != null;
                                const cycleOk =
                                    formData.cycle_time !== undefined &&
                                    formData.cycle_time !== null &&
                                    !isNaN(Number(formData.cycle_time));
                                return (
                                    !codeOk ||
                                    !nameOk ||
                                    !deptOk ||
                                    !cycleOk ||
                                    (!formData.inputs || formData.inputs.length === 0) ||
                                    (!formData.outputs || formData.outputs.length === 0)
                                );
                            }
                            return false;
                        })()}
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
        </div >
    );
}
