import { useState, useEffect, useMemo } from "react";
import * as React from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Plus,
    Trash2,
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Download,
    ChevronsUpDown,
    Check,
    X,
} from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandInputBorderless,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { DatePicker } from "@/components/shared/DatePicker";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { serviceCenterApi, type MaterialRequisitionItemRecord } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import {
    isClaimEntityName,
    isCurrencyEntityName,
    isSelectActionEntityName,
    isWarrantyServiceRequestStatusEntityName,
    isWarrantyStatusEntityName,
} from "@/services/loadCommonData";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "../Unauthorized";

import {
    ServiceRequestStatus,
    ServiceAction,
    WarrantyStatus,
    ClaimStatus,
    RepairItem,
    ServiceRequestData,
    MOCK_SERIAL_NUMBERS,
    getNextServiceRequestCode,
    getDefaultMockData
} from "@/lib/warrantyServiceSharedData";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const TOAST_DURATION = 15000;

type EntityMasterRow = {
    id?: number | string;
    value_id?: number | string;
    code?: string;
    value_code?: string;
    name?: string;
    value_name?: string;
};

/** Green styling for successful actions; keep errors as destructive. */
const crudSuccessToast = {
    className:
        "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
    duration: TOAST_DURATION,
};

/** Prevents focus ring / border clipping inside the modal scroll area */
const formSelectTriggerClass =
    "h-10 ring-offset-0 focus:ring-2 focus:ring-ring focus:ring-offset-0";

const getCurrencySymbol = (currencyCode: string): string => {
    if (!currencyCode?.trim()) return "$";
    const clean = currencyCode.trim().toUpperCase();
    const symbols: Record<string, string> = {
        USD: "$",
        "US DOLLAR": "$",
        EUR: "€",
        EURO: "€",
        GBP: "£",
        "BRITISH POUND": "£",
        INR: "₹",
        "INDIAN RUPEE": "₹",
        JPY: "¥",
        "JAPANESE YEN": "¥",
        CNY: "¥",
        "CHINESE YUAN": "¥",
        AUD: "A$",
        "AUSTRALIAN DOLLAR": "A$",
        CAD: "C$",
        "CANADIAN DOLLAR": "C$",
        CHF: "CHF",
        "SWISS FRANC": "CHF",
        UGX: "USh",
        "UGANDA SHILLING": "USh",
    };
    return symbols[clean] || clean;
};

/** Resolve display symbol from warranty detail / action `currency_id` and entity master currencies. */
const resolveCurrencySymbolFromId = (
    currencyId: string | number | undefined | null,
    currencyList: EntityMasterRow[]
): string => {
    if (currencyId == null || currencyId === "") return "$";
    const idStr = String(currencyId);
    const match = currencyList.find((c) => {
        const valueId = c.value_id != null ? String(c.value_id) : "";
        const rowId = c.id != null ? String(c.id) : "";
        return valueId === idStr || rowId === idStr;
    });
    const code =
        match?.code ||
        match?.value_code ||
        match?.name ||
        match?.value_name ||
        "";
    return getCurrencySymbol(String(code));
};

export type ServiceRequestDataWithCurrency = ServiceRequestData & {
    currencyId?: string | number;
};

// Using shared AppListToolbar and DatePicker components

// Reusable components (using shared versions)

const isExpiredWarrantyStatus = (status: string | undefined): boolean => {
    const s = (status || "").trim().toLowerCase();
    return s === "expired" || s === "overdue";
};

const mapPaidServicesFromApi = (paid: boolean | null | undefined): "Yes" | "No" | "" => {
    if (paid === true) return "Yes";
    if (paid === false) return "No";
    return "";
};

const getPaidServiceDisplay = (isPaidService: string | undefined): string => {
    if (isPaidService === "Yes" || isPaidService === "No") return isPaidService;
    return "—";
};

const getMrItemStockQty = (record: MaterialRequisitionItemRecord): number =>
    Number(record.current_QTY ?? record.current_qty ?? 0) || 0;

const getClaimStatusIdForPayload = (
    warrantyStatus: string | undefined,
    claim: string | undefined,
    claims: Array<{ id?: number | string; value_id?: number | string; code?: string; value_code?: string; name?: string; value_name?: string }>
): number | null => {
    // Expired/overdue: no claim on form — backend accepts null claim_status_id
    if (isExpiredWarrantyStatus(warrantyStatus)) {
        return null;
    }
    return getClaimStatusId(claim || "", claims);
};

const getPaidServicesForPayload = (
    warrantyStatus: string | undefined,
    claim: string | undefined,
    isPaidService: string | undefined,
    claims: Array<{ code?: string; value_code?: string; name?: string; value_name?: string }>
): boolean => {
    if (isExpiredWarrantyStatus(warrantyStatus)) {
        return isPaidService === "Yes";
    }
    if (claimMatchesCode(claim, "REJECTED", claims) && warrantyStatus === "Under Warranty") {
        return isPaidService === "Yes";
    }
    return isPaidService === "Yes";
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

const EMPTY_DISPLAY = "—";

const displayText = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return EMPTY_DISPLAY;
    const text = String(value).trim();
    return text ? text : EMPTY_DISPLAY;
};

const formatDate = (dateStr: string) => {
    try {
        if (!dateStr) return "";
        return format(new Date(dateStr), "dd MMM yyyy");
    } catch {
        return dateStr || "";
    }
};

const displayDate = (dateStr: string | undefined | null): string => {
    if (!dateStr || !String(dateStr).trim()) return EMPTY_DISPLAY;
    const formatted = formatDate(dateStr);
    return formatted.trim() ? formatted : EMPTY_DISPLAY;
};

const safeParseDate = (dateStr: string | undefined | null): Date | undefined => {
    if (!dateStr || dateStr === "" || dateStr === null) return undefined;
    try {
        // Handle ISO date strings (YYYY-MM-DD)
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return undefined;
        return date;
    } catch {
        return undefined;
    }
};

const safeDateString = (date: any): string => {
    try {
        if (!date) return "";
        if (typeof date === 'string') {
            const parsed = new Date(date);
            if (isNaN(parsed.getTime())) return "";
            return date;
        }
        if (date instanceof Date) {
            if (isNaN(date.getTime())) return "";
            return date.toISOString().split('T')[0];
        }
        return "";
    } catch {
        return "";
    }
};

const calculateWarrantyStatus = (warrantyEndDate: string): WarrantyStatus => {
    try {
        if (!warrantyEndDate) return "Under Warranty";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(warrantyEndDate);
        if (isNaN(endDate.getTime())) return "Under Warranty";
        endDate.setHours(0, 0, 0, 0);
        return today <= endDate ? "Under Warranty" : "Expired";
    } catch {
        return "Under Warranty";
    }
};

const normalizeWarrantyStatusKey = (code: string): string =>
    code.trim().toUpperCase().replace(/[\s-]+/g, "_");

const getWarrantyStatusEntityCode = (status: { code?: string; value_code?: string } | undefined): string =>
    normalizeWarrantyStatusKey(String(status?.code || status?.value_code || ""));

const findWarrantyStatusEntity = (
    statuses: EntityMasterRow[],
    ...codes: string[]
) => {
    const keys = codes.map(normalizeWarrantyStatusKey);
    return statuses.find((s) => keys.includes(getWarrantyStatusEntityCode(s)));
};

const resolveWarrantyStatusLabelToEntityCodes = (label: string | undefined): string[] => {
    const l = (label || "").trim().toLowerCase();
    if (!l) return ["UNDER_WARRANTY", "UNDER WARRANTY"];
    if (l.includes("under") && l.includes("warranty")) return ["UNDER_WARRANTY", "UNDER WARRANTY"];
    if (l === "expired" || l === "overdue" || l === "expire") return ["EXPIRE", "EXPIRED", "OVERDUE"];
    return [normalizeWarrantyStatusKey(label ?? "")];
};

const getWarrantyStatusIdFromEntities = (
    warrantyStatus: string | undefined,
    statuses: Array<{ id?: number | string; value_id?: number | string; code?: string; value_code?: string; name?: string; value_name?: string }>,
    explicitId?: number | null
): number | null => {
    if (statuses.length === 0) return null;

    if (explicitId != null && !Number.isNaN(Number(explicitId))) {
        const id = Number(explicitId);
        const inList = statuses.some((s) => Number(s.id ?? s.value_id) === id);
        if (inList) return id;
    }
    for (const code of resolveWarrantyStatusLabelToEntityCodes(warrantyStatus)) {
        const found = findWarrantyStatusEntity(statuses, code);
        if (found) {
            const id = found.id ?? found.value_id;
            return id != null && id !== "" ? Number(id) : null;
        }
    }
    const byName = statuses.find(
        (s) => String(s.name || s.value_name || "").trim().toLowerCase() === (warrantyStatus || "").trim().toLowerCase()
    );
    if (byName) {
        const id = byName.id ?? byName.value_id;
        return id != null && id !== "" ? Number(id) : null;
    }
    return null;
};

const getClaimCode = (claim: { code?: string; value_code?: string } | undefined): string =>
    String(claim?.code || claim?.value_code || "").trim().toUpperCase();

const findClaimByCode = (
    claims: EntityMasterRow[],
    code: string
) => claims.find((c) => getClaimCode(c) === code.toUpperCase());

const resolveClaimToCode = (claim: string | undefined, claims: EntityMasterRow[]): string => {
    if (!claim) return "";
    const upper = claim.trim().toUpperCase();
    if (findClaimByCode(claims, upper)) return upper;
    if (upper === "ACCEPT" || claim === "Accept") return "ACCEPT";
    if (upper === "REJECTED" || upper === "REJECT" || claim === "Reject") return "REJECTED";
    if (upper === "NA" || upper === "N/A") return getClaimCode(findClaimByCode(claims, "NA")) || "NA";
    const byName = claims.find(
        (c) => String(c.name || c.value_name || "").trim().toLowerCase() === claim.trim().toLowerCase()
    );
    return byName ? getClaimCode(byName) : upper;
};

const claimMatchesCode = (
    claim: string | undefined,
    code: string,
    claims: EntityMasterRow[]
): boolean => {
    if (!claim) return false;
    const resolved = resolveClaimToCode(claim, claims);
    return resolved === code.toUpperCase();
};

const getClaimStatusId = (
    claim: string,
    claims: EntityMasterRow[]
): number | null => {
    const code = resolveClaimToCode(claim, claims);
    const found = findClaimByCode(claims, code);
    if (!found) return null;
    const id = found.id ?? found.value_id;
    return id != null && id !== "" ? Number(id) : null;
};

const getClaimDisplayName = (
    claim: string | undefined,
    claims: EntityMasterRow[]
): string => {
    if (!claim) return "";
    const code = resolveClaimToCode(claim, claims);
    const found = findClaimByCode(claims, code);
    return found?.name || found?.value_name || claim;
};

const getServiceActionCode = (action: { code?: string; value_code?: string } | undefined): string =>
    String(action?.code || action?.value_code || "").trim().toUpperCase();

const findServiceActionByCode = (
    actions: EntityMasterRow[],
    code: string
) => actions.find((a) => getServiceActionCode(a) === code.toUpperCase());

const resolveServiceActionToCode = (
    action: string | undefined,
    actions: EntityMasterRow[]
): string => {
    if (!action) return "";
    const upper = action.trim().toUpperCase();
    const byCode = findServiceActionByCode(actions, upper);
    if (byCode) return getServiceActionCode(byCode);
    const byName = actions.find(
        (a) => String(a.name || a.value_name || "").trim().toLowerCase() === action.trim().toLowerCase()
    );
    return byName ? getServiceActionCode(byName) : "";
};

const findServiceActionCodeFromEntities = (
    actions: EntityMasterRow[],
    ...lookupCodes: string[]
): string => {
    for (const code of lookupCodes) {
        const found = findServiceActionByCode(actions, code);
        if (found) return getServiceActionCode(found);
    }
    return "";
};

/** Replace only when Under Warranty + Accept claim; otherwise Repair only. */
const allowsReplaceServiceAction = (
    warrantyStatus: string | undefined,
    claim: string | undefined,
    claims: Array<{ code?: string; value_code?: string; name?: string; value_name?: string }>
): boolean =>
    warrantyStatus === "Under Warranty" && claimMatchesCode(claim, "ACCEPT", claims);

const serviceActionMatchesCode = (
    action: string | undefined,
    code: string,
    actions: EntityMasterRow[]
): boolean => {
    if (!action) return false;
    return resolveServiceActionToCode(action, actions) === code.toUpperCase();
};

const getServiceActionId = (
    action: string,
    actions: EntityMasterRow[]
): number | null => {
    const code = resolveServiceActionToCode(action, actions);
    const found = findServiceActionByCode(actions, code);
    if (!found) return null;
    const id = found.id ?? found.value_id;
    return id != null && id !== "" ? Number(id) : null;
};

const getServiceActionDisplayName = (
    action: string | undefined,
    actions: EntityMasterRow[]
): string => {
    if (!action) return "";
    const code = resolveServiceActionToCode(action, actions);
    const found = findServiceActionByCode(actions, code);
    return found?.name || found?.value_name || action;
};

const getStatusCode = (status: { code?: string; value_code?: string } | undefined): string =>
    String(status?.code || status?.value_code || "").trim().toUpperCase();

const getStatusId = (status: EntityMasterRow | undefined): string =>
    String(status?.id ?? status?.value_id ?? "").trim();

/** Listing API uses short codes (SUBMITTED); entity master may use SUBMITTED REQUEST. */
const toWarrantyListStatusApiCode = (rawCode: string): string => {
    const c = String(rawCode || "").trim().toUpperCase().replace(/\s+/g, " ");
    if (!c) return "";
    const base = c.replace(/\s+REQUEST$/i, "").trim();
    if (base === "SUBMIT" || base === "SUBMITTED") return "SUBMITTED";
    if (base === "COMPLETE" || base === "COMPLETED") return "COMPLETED";
    if (base === "REJECT" || base === "REJECTED") return "REJECTED";
    if (base === "DRAFT") return "DRAFT";
    return base;
};

const warrantyListStatusCodesMatch = (recordCode: string, filterCode: string): boolean => {
    const a = toWarrantyListStatusApiCode(recordCode);
    const b = toWarrantyListStatusApiCode(filterCode);
    return Boolean(a && b && a === b);
};

const findWarrantyRequestStatus = (
    statuses: EntityMasterRow[],
    code: string
) =>
    statuses.find(
        (s) => toWarrantyListStatusApiCode(getStatusCode(s)) === toWarrantyListStatusApiCode(code)
    );

/** List row status label from API (prefer status_name; resolve code via entity master). */
const resolveListStatusDisplay = (
    record: { status_name?: string; status_code?: string },
    statuses: EntityMasterRow[]
): string => {
    const fromApi = String(record.status_name || "").trim();
    if (fromApi) return fromApi;
    const code = String(record.status_code || "").trim();
    if (!code) return "Draft";
    const match = statuses.find(
        (s) =>
            getStatusCode(s) === code.toUpperCase() ||
            warrantyListStatusCodesMatch(getStatusCode(s), code)
    );
    return match ? String(match.name || match.value_name || code) : code;
};

const findDraftWarrantyRequestStatus = (
    statuses: EntityMasterRow[]
) => {
    const byCode = findWarrantyRequestStatus(statuses, "DRAFT");
    if (byCode) return byCode;
    return statuses.find((s) => {
        const name = String(s.name || s.value_name || "").trim().toLowerCase();
        return name === "draft request" || name === "draft";
    });
};

const statusMatchesCode = (
    statusLabel: string | undefined,
    code: string,
    statuses: EntityMasterRow[]
): boolean => {
    if (!statusLabel) return false;
    const normalized = statusLabel.trim().toLowerCase();
    const match = findWarrantyRequestStatus(statuses, code);
    const names = [
        match?.name,
        match?.value_name,
        code === "DRAFT" ? "draft" : undefined,
        code === "SUBMITTED" ? "submitted request" : undefined,
        code === "SUBMITTED" ? "submitted" : undefined,
        code === "COMPLETED" ? "completed request" : undefined,
        code === "COMPLETED" ? "completed" : undefined,
        code === "REJECTED" ? "rejected request" : undefined,
        code === "REJECTED" ? "rejected" : undefined,
    ]
        .filter(Boolean)
        .map((n) => String(n).trim().toLowerCase());
    return names.includes(normalized) || normalized === code.toLowerCase();
};

const getStatusBadgeVariant = (
    status: ServiceRequestStatus,
    statuses: Array<{ code?: string; value_code?: string; name?: string; value_name?: string }> = []
) => {
    if (statusMatchesCode(status, "DRAFT", statuses)) return "secondary";
    if (statusMatchesCode(status, "SUBMITTED", statuses)) return "default";
    if (statusMatchesCode(status, "COMPLETED", statuses)) return "default";
    if (statusMatchesCode(status, "REJECTED", statuses)) return "destructive";
    switch (status) {
        case "Draft":
            return "secondary";
        case "Submitted Request":
            return "default";
        case "Completed Request":
            return "default";
        case "Rejected Request":
            return "destructive";
        default:
            return "outline";
    }
};

// Helper function to get display status based on warranty status and service action
const getDisplayStatus = (request: ServiceRequestData): string => {
    const requestStatus = String(request.status);
    const requestClaim = String(request.claim || "");
    if (requestStatus === "Completed Request" || requestStatus === "Completed") {
        // Under Warranty with Accept claim
        const action = String(request.serviceAction || "").toUpperCase();
        if (request.warrantyStatus === "Under Warranty" && (requestClaim === "Accept" || requestClaim === "ACCEPT")) {
            if (action === "REPAIR" || request.serviceAction === "Repair") {
                return "Complete Repair";
            } else if (action === "REPLACE" || request.serviceAction === "Replace") {
                return "Complete Replace";
            }
        }
        // Under Warranty with Reject claim (only Repair allowed, not Replace)
        else if (request.warrantyStatus === "Under Warranty" && (requestClaim === "Reject" || requestClaim === "REJECTED")) {
            if (action === "REPAIR" || request.serviceAction === "Repair") {
                return "Complete Repair";
            }
        }
        // Expired Warranty with NA claim
        else if (request.warrantyStatus === "Expired" && request.claim === "NA") {
            if (action === "REPAIR" || request.serviceAction === "Repair") {
                return "Complete Repair";
            } else if (action === "REPLACE" || request.serviceAction === "Replace") {
                return "Complete Replace";
            } else if (!request.serviceAction || request.serviceAction === "") {
                return "Complete NA";
            }
        }
    }
    return request.status;
};


// ============================================================================
// MAIN COMPONENT
// ============================================================================

const WARRANTY_SERVICE_MODULE = "Service_Center:Warranty Service";

function WarrantyService() {
    const { toast } = useToast();
    const { isMenuVisible, canCreate, canEdit, canView, canPrint } = useHasPermission();
    const hasModuleAccess = isMenuVisible(WARRANTY_SERVICE_MODULE);

    const warrantyServiceRequestStatusesFromStore = useCommonStore(
        (state) => state.warrantyServiceRequestStatuses || []
    );
    const claimStatusesFromStore = useCommonStore((state) => state.claimStatuses || []);
    const serviceActionsFromStore = useCommonStore((state) => state.serviceActions || []);
    const currenciesFromStore = useCommonStore((state) => state.currencies || []);
    const entityValues = useCommonStore((state) => state.entityValues || []);

    const currencies = useMemo(() => {
        if (currenciesFromStore.length > 0) return currenciesFromStore;
        return (entityValues || []).filter((r: any) =>
            isCurrencyEntityName(r?.entity_type_name, r?.entity_type_code)
        );
    }, [currenciesFromStore, entityValues]);

    const repairCurrencyOptions = useMemo(
        () =>
            currencies
                .filter((c: EntityMasterRow) => c.id != null || c.value_id != null)
                .map((c: EntityMasterRow) => {
                    const id = c.value_id ?? c.id;
                    const label =
                        c.code ||
                        c.value_code ||
                        c.name ||
                        c.value_name ||
                        String(id);
                    return { value: String(id), label: String(label) };
                }),
        [currencies]
    );

    const warrantyServiceRequestStatuses = useMemo(() => {
        if (warrantyServiceRequestStatusesFromStore.length > 0) {
            return warrantyServiceRequestStatusesFromStore;
        }
        return (entityValues || []).filter((r: any) =>
            isWarrantyServiceRequestStatusEntityName(r?.entity_type_name, r?.entity_type_code, r?.entity_type_id)
        );
    }, [warrantyServiceRequestStatusesFromStore, entityValues]);

    const claimStatuses = useMemo(() => {
        if (claimStatusesFromStore.length > 0) return claimStatusesFromStore;
        return (entityValues || []).filter((r: any) =>
            isClaimEntityName(r?.entity_type_name, r?.entity_type_code, r?.entity_type_id)
        );
    }, [claimStatusesFromStore, entityValues]);

    const isCommonLoaded = useCommonStore((state) => state.isLoaded);
    const warrantyStatusesFromStore = useCommonStore((state) => state.warrantyStatuses || []);
    const warrantyStatuses = useMemo(() => {
        if (warrantyStatusesFromStore.length > 0) return warrantyStatusesFromStore;
        return (entityValues || []).filter((r: any) =>
            isWarrantyStatusEntityName(r?.entity_type_name, r?.entity_type_code, r?.entity_type_id)
        );
    }, [warrantyStatusesFromStore, entityValues]);

    const serviceActions = useMemo(() => {
        if (serviceActionsFromStore.length > 0) return serviceActionsFromStore;
        return (entityValues || []).filter((r: any) =>
            isSelectActionEntityName(r?.entity_type_name, r?.entity_type_code, r?.entity_type_id)
        );
    }, [serviceActionsFromStore, entityValues]);

    const serviceActionOptions = useMemo(() => serviceActions, [serviceActions]);

    const repairActionCode = useMemo(
        () => findServiceActionCodeFromEntities(serviceActionOptions, "REPAIR"),
        [serviceActionOptions]
    );
    const replaceActionCode = useMemo(
        () => findServiceActionCodeFromEntities(serviceActionOptions, "REPLACE"),
        [serviceActionOptions]
    );

    const isRequestStatus = (statusLabel: string | undefined, code: string) =>
        statusMatchesCode(statusLabel, code, warrantyServiceRequestStatuses);

    const isClaimCode = (claim: string | undefined, code: string) =>
        claimMatchesCode(claim, code, claimStatuses);

    /** List API status filter uses dropdown label (e.g. Draft Request), same as status_name on records. */
    const resolveListStatusFilter = (value: string): string | undefined => {
        if (value === "All" || !value) return undefined;
        const selected = warrantyServiceRequestStatuses.find(
            (s) => getStatusId(s) === String(value).trim()
        );
        if (selected) {
            const filterName = String(selected.name || selected.value_name || "").trim();
            if (filterName) return filterName;
            const code = getStatusCode(selected);
            return code || undefined;
        }
        return String(value).trim() || undefined;
    };

    // State with mock data initialization
    const [serviceRequests, setServiceRequests] = useState<ServiceRequestData[]>([]);
    const [isListLoading, setIsListLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [filterStatus, setFilterStatus] = useState<string>("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [viewingRequest, setViewingRequest] = useState<ServiceRequestData | null>(null);
    const [serialDetailsLoaded, setSerialDetailsLoaded] = useState(false);
    const [repairItemOptions, setRepairItemOptions] = useState<MaterialRequisitionItemRecord[]>([]);
    const [isRepairItemsLoading, setIsRepairItemsLoading] = useState(false);

    useEffect(() => {
        if (!isFormModalOpen) return;
        let cancelled = false;
        (async () => {
            setIsRepairItemsLoading(true);
            try {
                const res = await serviceCenterApi.getItemsFromMaterialRequisitions();
                if (!cancelled && res.isSuccessful && res.data?.records) {
                    setRepairItemOptions(res.data.records);
                } else if (!cancelled) {
                    setRepairItemOptions([]);
                }
            } catch (error) {
                console.error("Failed to fetch repair items:", error);
                if (!cancelled) setRepairItemOptions([]);
            } finally {
                if (!cancelled) setIsRepairItemsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isFormModalOpen]);

    const repairItemSelectOptions = useMemo(
        () =>
            repairItemOptions.map((opt) => ({
                value: String(opt.item_id),
                label: `${opt.item_name || ""} ${opt.item_code || ""}`.trim(),
                primaryText: String(opt.item_name || "").trim(),
                secondaryText: String(opt.item_code || "").trim(),
            })),
        [repairItemOptions]
    );

    // Fetch data from API
    const fetchWarrantyServices = async (page = 1) => {
        try {
            setIsListLoading(true);
            const listStatus = resolveListStatusFilter(filterStatus);
            const response = await serviceCenterApi.getWarrantyServiceList({
                page,
                limit: itemsPerPage,
                text_search: searchTerm || undefined,
                date: filterDate ? format(filterDate, "yyyy-MM-dd") : undefined,
                status: listStatus,
            });

            if (response.isSuccessful && response.data) {
                const records = response.data.records || [];

                const mappedRecords: ServiceRequestData[] = records.map(record => ({
                    id: record.warranty_claim_id,
                    serviceRequestCode: record.service_code,
                    clientName: record.consumer_name,
                    serialNumber: record.serial_number,
                    itemName: "", // not in list api
                    batch: "", // not in list api
                    productionDate: "", // not in list api
                    invoiceDate: "", // not in list api
                    warrantyEndDate: "", // not in list api
                    warrantyStatus: (record.warranty_status_name || "Under Warranty") as WarrantyStatus,
                    complaintDescription: "", // not in list api
                    claim: resolveClaimToCode(
                        record.claim_status_code || record.claim_status_name || "",
                        claimStatuses
                    ) as ClaimStatus,
                    reason: "", // not in list api
                    status: resolveListStatusDisplay(record, warrantyServiceRequestStatuses) as ServiceRequestStatus,
                    serviceAction: "", // not in list api
                    repairItems: [], // not in list api
                    replaceItems: [], // not in list api
                    newSerialNumber: "", // not in list api
                    labourCost: 0, // not in list api
                    labourBillable: false, // not in list api
                    serviceDate: record.service_date,
                    isPaidService: "" // not in list api
                }));

                setServiceRequests(mappedRecords);
                const paginationMeta = response.data.pagination as {
                    totalRecords?: number;
                    totalCount?: number;
                    totalPages?: number;
                };
                setTotalRecords(
                    paginationMeta.totalRecords ??
                        paginationMeta.totalCount ??
                        mappedRecords.length
                );
                setTotalPages(response.data.pagination.totalPages || 1);
            }
        } catch (error) {
            console.error("Error fetching warranty services:", error);
            toast({
                title: "Error",
                description: "Failed to fetch warranty service requests",
                variant: "destructive", duration: TOAST_DURATION
            });
        } finally {
            setIsListLoading(false);
        }
    };

    // Default list filter to "Draft Request" from entity values (same pattern as WH Receive)
    useEffect(() => {
        if (filterStatus !== "") return;

        if (warrantyServiceRequestStatuses.length > 0) {
            const draftStatus = findDraftWarrantyRequestStatus(warrantyServiceRequestStatuses);
            setFilterStatus(draftStatus ? getStatusId(draftStatus) : "All");
            return;
        }

        if (isCommonLoaded) {
            setFilterStatus("All");
        }
    }, [warrantyServiceRequestStatuses, isCommonLoaded, filterStatus]);

    // Consolidated fetch effect with debounce for search and filters
    useEffect(() => {
        if (filterStatus === "") return;
        const timer = setTimeout(() => {
            fetchWarrantyServices(currentPage);
        }, 300);
        return () => clearTimeout(timer);
    }, [currentPage, itemsPerPage, searchTerm, filterDate, filterStatus]);

    const [formData, setFormData] = useState<Partial<ServiceRequestData>>({
        clientName: "",
        serialNumber: "",
        batch: "",
        productionDate: "",
        invoiceDate: "",
        warrantyEndDate: "",
        warrantyStatus: "Under Warranty",
        complaintDescription: "",
        claim: "",
        reason: "",
        status: "Draft",
        serviceAction: "",
        repairItems: [],
        replaceItems: [],
        labourCost: 0,
        labourBillable: false,
        serviceDate: format(new Date(), "yyyy-MM-dd"), // Auto-generate today's date
        isPaidService: ""
    });

    /** Repair section currency (local UI state; sent as currency_id on Complete when Repair). */
    const [repairCurrencyId, setRepairCurrencyId] = useState("");

    const repairCurrencySymbol = useMemo(() => {
        const match = currencies.find(
            (c: EntityMasterRow) => String(c.value_id ?? c.id) === String(repairCurrencyId)
        );
        const code =
            match?.code ||
            match?.value_code ||
            match?.name ||
            match?.value_name ||
            "";
        return getCurrencySymbol(String(code));
    }, [currencies, repairCurrencyId]);

    const claimOptionsForForm = useMemo(() => claimStatuses, [claimStatuses]);

    const usableServiceActions = useMemo(() => {
        if (allowsReplaceServiceAction(formData.warrantyStatus, formData.claim, claimStatuses)) {
            return serviceActionOptions;
        }
        if (!replaceActionCode) return serviceActionOptions;
        return serviceActionOptions.filter((a) => getServiceActionCode(a) !== replaceActionCode);
    }, [serviceActionOptions, formData.warrantyStatus, formData.claim, claimStatuses, replaceActionCode]);

    // Default to Repair when Replace is not allowed (Expired, Rejected, etc.)
    useEffect(() => {
        if (!repairActionCode) return;
        if (allowsReplaceServiceAction(formData.warrantyStatus, formData.claim, claimStatuses)) return;

        const currentCode = resolveServiceActionToCode(formData.serviceAction, serviceActionOptions);
        if (currentCode === repairActionCode) return;

        setFormData((prev) => ({
            ...prev,
            serviceAction: repairActionCode as ServiceAction,
            labourBillable: isExpiredWarrantyStatus(prev.warrantyStatus) ? true : prev.labourBillable,
            newSerialNumber:
                replaceActionCode && currentCode === replaceActionCode ? "" : prev.newSerialNumber,
            replaceItems: [],
        }));
    }, [
        formData.warrantyStatus,
        formData.claim,
        formData.serviceAction,
        repairActionCode,
        replaceActionCode,
        serviceActionOptions,
        claimStatuses,
    ]);

    // Reset form
    const resetForm = () => {
        setFormData({
            clientName: "",
            serialNumber: "",
            itemCode: "",
            customerId: undefined,
            batchId: null,
            warrantyStatusId: undefined,
            batch: "",
            productionDate: "",
            invoiceDate: "",
            warrantyEndDate: "",
            warrantyStatus: "Under Warranty",
            complaintDescription: "",
            claim: "",
            reason: "",
            status: "Draft",
            serviceAction: "",
            itemName: "",
            newSerialNumber: "",
            repairItems: [],
            replaceItems: [],
            labourCost: 0,
            labourBillable: false,
            serviceDate: format(new Date(), "yyyy-MM-dd"), // Auto-generate today's date
            isPaidService: ""
        });
        setRepairCurrencyId("");
        setEditingId(null);
        setSerialDetailsLoaded(false);
    };

    /** Read serial lookup API fields (backend may use snake_case or title keys). */
    const pickSerialField = (data: Record<string, unknown>, ...keys: string[]): string => {
        for (const key of keys) {
            const value = data[key];
            if (value != null && String(value).trim() !== "") {
                return String(value).trim();
            }
        }
        return "";
    };

    const mapWarrantyStatusFromApi = (
        statusName: string,
        statusCode: string,
        warrantyEndDate: string
    ): WarrantyStatus => {
        const code = normalizeWarrantyStatusKey(statusCode);
        const name = statusName.trim().toLowerCase();
        if (code === "UNDER_WARRANTY" || name === "under warranty") return "Under Warranty";
        if (code === "EXPIRE" || code === "EXPIRED" || code === "OVERDUE" || name === "expire" || name === "expired" || name === "overdue") {
            return "Expired";
        }
        if (statusName) return statusName as WarrantyStatus;
        return calculateWarrantyStatus(warrantyEndDate);
    };

    const mapSerialNumberApiToForm = (raw: Record<string, unknown>) => {
        const warrantyEndDate = parseDmyDate(
            pickSerialField(raw, "warranty_end_date", "Warranty End Date", "warrantyEndDate")
        );
        const warrantyStatusName = pickSerialField(raw, "warranty_status_name");
        const warrantyStatusCode = pickSerialField(raw, "warranty_status_code");
        const warrantyStatusId =
            raw.warranty_status_id != null && raw.warranty_status_id !== ""
                ? Number(raw.warranty_status_id)
                : undefined;

        return {
            itemCode: pickSerialField(raw, "item_code"),
            itemName: pickSerialField(raw, "item_name", "itemName", "Item Name"),
            customerId:
                raw.customer_id != null && raw.customer_id !== ""
                    ? Number(raw.customer_id)
                    : undefined,
            clientName: pickSerialField(
                raw,
                "customer_name",
                "consumer_name",
                "customerName",
                "Consumer Name",
                "Customer Name"
            ),
            batchId:
                raw.batch_id != null && raw.batch_id !== ""
                    ? Number(raw.batch_id)
                    : null,
            batch: pickSerialField(raw, "batch", "Batch", "batch_no", "batch_code"),
            productionDate: parseDmyDate(
                pickSerialField(raw, "production_date", "production_plan", "Production Date", "productionDate")
            ),
            invoiceDate: parseDmyDate(
                pickSerialField(raw, "invoice_date", "Invoice Date", "invoiceDate")
            ),
            warrantyEndDate,
            warrantyStatusId: Number.isFinite(warrantyStatusId) ? warrantyStatusId : undefined,
            warrantyStatus: mapWarrantyStatusFromApi(
                warrantyStatusName,
                warrantyStatusCode,
                warrantyEndDate
            ),
        };
    };

    const resolveWarrantyStatusId = (data: Partial<ServiceRequestData>): number | null =>
        getWarrantyStatusIdFromEntities(data.warrantyStatus, warrantyStatuses, data.warrantyStatusId);

    // Parse regional DMY date strings to ISO YYYY-MM-DD
    const parseDmyDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        
        const parts = dateStr.split(/[/\-]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) {
                const p0 = parts[0].padStart(2, '0');
                const p1 = parts[1].padStart(2, '0');
                const p2 = parts[2];
                if (parseInt(p1, 10) > 12) {
                    // MM/DD/YYYY
                    return `${p2}-${p0}-${p1}`;
                } else {
                    // DD/MM/YYYY
                    return `${p2}-${p1}-${p0}`;
                }
            } else if (parts[0].length === 4) {
                // YYYY/MM/DD
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
        }
        
        try {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
            }
        } catch {}
        
        return dateStr;
    };

    // Handle serial number input with comprehensive error handling
    const handleSerialNumberChange = async (serialNumber: string) => {
        try {
            if (!serialNumber) {
                setSerialDetailsLoaded(false);
                setFormData({
                    ...formData,
                    serialNumber: "",
                    batch: "",
                    productionDate: "",
                    invoiceDate: "",
                    warrantyEndDate: "",
                    warrantyStatus: "Under Warranty",
                    claim: "",
                    reason: "",
                    itemName: "",
                    clientName: "",
                    repairItems: formData.repairItems || [],
                    replaceItems: formData.replaceItems || [],
                    labourCost: formData.labourCost || 0,
                    labourBillable: formData.labourBillable || false
                });
                return;
            }

            setActionLoading("serial");
            const response = await serviceCenterApi.getDetailFromSerialNumber(serialNumber);
            
            if (response.isSuccessful && response.data) {
                const serialData = response.data as Record<string, unknown>;
                const mapped = mapSerialNumberApiToForm(serialData);

                setSerialDetailsLoaded(true);
                setFormData({
                    ...formData,
                    serialNumber,
                    itemCode: mapped.itemCode,
                    itemName: mapped.itemName,
                    customerId: mapped.customerId,
                    clientName: mapped.clientName,
                    batchId: mapped.batchId,
                    batch: mapped.batch,
                    productionDate: mapped.productionDate,
                    invoiceDate: mapped.invoiceDate,
                    warrantyEndDate: mapped.warrantyEndDate,
                    warrantyStatusId: mapped.warrantyStatusId,
                    warrantyStatus: mapped.warrantyStatus,
                    claim: "",
                    reason: "",
                    isPaidService: mapped.warrantyStatus === "Expired" ? formData.isPaidService || "" : "",
                    repairItems: formData.repairItems || [],
                    replaceItems: formData.replaceItems || [],
                    labourCost: formData.labourCost || 0,
                    labourBillable: formData.labourBillable || false
                });
            } else {
                setSerialDetailsLoaded(false);
                setFormData({
                    ...formData,
                    serialNumber: serialNumber,
                    batch: "",
                    productionDate: "",
                    invoiceDate: "",
                    warrantyEndDate: "",
                    warrantyStatus: "Under Warranty",
                    claim: "",
                    reason: "",
                    itemName: "",
                    clientName: "",
                    repairItems: formData.repairItems || [],
                    replaceItems: formData.replaceItems || [],
                    labourCost: formData.labourCost || 0,
                    labourBillable: formData.labourBillable || false
                });
                toast({
                    title: "Not found",
                    description: response.message || "No details found for this serial number",
                    variant: "destructive", duration: TOAST_DURATION
                });
            }
        } catch (e) {
            console.error('Error handling serial number change:', e);
            toast({
                title: "Error",
                description: "Failed to load serial number data from server",
                variant: "destructive", duration: TOAST_DURATION
            });
        } finally {
            setActionLoading(null);
        }
    };

    // Handle claim change
    const handleClaimChange = (claim: string) => {
        const claimCode = resolveClaimToCode(claim, claimStatuses);
        const shouldClearAction = isClaimCode(claimCode, "REJECTED") && formData.warrantyStatus !== "Under Warranty";
        const allowReplace = allowsReplaceServiceAction(formData.warrantyStatus, claimCode, claimStatuses);
        const nextServiceAction = shouldClearAction
            ? ""
            : !allowReplace && repairActionCode
              ? repairActionCode
              : formData.serviceAction;

        setFormData({
            ...formData,
            claim: claimCode as ClaimStatus,
            reason: isClaimCode(claimCode, "REJECTED") ? formData.reason : "",
            serviceAction: nextServiceAction as ServiceAction,
            repairItems: shouldClearAction ? [] : formData.repairItems,
            newSerialNumber: shouldClearAction || !allowReplace ? "" : formData.newSerialNumber,
            replaceItems: !allowReplace ? [] : formData.replaceItems,
            isPaidService: isClaimCode(claimCode, "REJECTED") ? formData.isPaidService : "",
            labourBillable:
                isExpiredWarrantyStatus(formData.warrantyStatus) && repairActionCode
                    ? true
                    : formData.labourBillable,
        });
    };

    // Repair item handlers
    const handleAddRepairItem = () => {
        // Auto-check billable if warranty is expired
        const isBillable = formData.warrantyStatus === "Expired";
        
        const newItem: RepairItem = {
            id: Date.now(),
            itemName: "",
            stock: 0,
            qty: 1,
            price: 0,
            billable: isBillable
        };
        setFormData({ ...formData, repairItems: [...(formData.repairItems || []), newItem] });
    };

    const handleRemoveRepairItem = (id: number) => {
        setFormData({ ...formData, repairItems: formData.repairItems?.filter(item => item.id !== id) });
    };

    const handleRepairItemSelect = (rowId: number, itemIdStr: string) => {
        const opt = repairItemOptions.find((o) => String(o.item_id) === itemIdStr);
        const updatedItems = formData.repairItems?.map((item) => {
            if (item.id !== rowId) return item;
            return {
                ...item,
                item_id: opt ? Number(opt.item_id) : undefined,
                itemCode: opt?.item_code,
                itemName: opt?.item_name || "",
                stock: opt ? getMrItemStockQty(opt) : 0,
            };
        });
        setFormData({ ...formData, repairItems: updatedItems });
    };

    const handleRepairItemChange = (id: number, field: keyof RepairItem, value: any) => {
        const updatedItems = formData.repairItems?.map(item => {
            if (item.id === id) {
                let updatedValue = value;
                if (field === "qty" || field === "price") {
                    // Allow only numbers and one decimal point
                    let cleanedValue = value.toString().replace(/[^0-9.]/g, '');
                    const parts = cleanedValue.split('.');
                    if (parts.length > 2) cleanedValue = parts[0] + '.' + parts.slice(1).join('');
                    
                    if (field === "qty") {
                        // 6-digit limit for integer part of qty
                        if (parts[0].length > 6) cleanedValue = parts[0].slice(0, 6) + (parts.length > 1 ? '.' + parts[1] : '');
                    }
                    updatedValue = cleanedValue;
                }

                return { ...item, [field]: updatedValue };
            }
            return item;
        });
        setFormData({ ...formData, repairItems: updatedItems });
    };



    // No local generateServiceRequestCode needed, using getNextServiceRequestCode from shared lib


    // Save as Draft
    const handleSaveDraft = async () => {
        if (!formData.clientName?.trim()) {
            toast({
                title: "Validation Error",
                description: "Consumer name is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (!formData.serialNumber) {
            toast({
                title: "Validation Error",
                description: "Serial number is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (!formData.complaintDescription) {
            toast({
                title: "Validation Error",
                description: "Complaint description is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (!isExpiredWarrantyStatus(formData.warrantyStatus) && !formData.claim) {
            toast({
                title: "Validation Error",
                description: "Claim status is required",
                variant: "destructive", duration: TOAST_DURATION,
            });
            return;
        }

        if (isExpiredWarrantyStatus(formData.warrantyStatus) && !formData.isPaidService) {
            toast({
                title: "Validation Error",
                description: "Paid service selection is required",
                variant: "destructive", duration: TOAST_DURATION,
            });
            return;
        }

        const warrantyStatusId = resolveWarrantyStatusId(formData);
        if (warrantyStatusId == null) {
            toast({
                title: "Validation Error",
                description: "Warranty status could not be resolved. Please reload the page or contact support.",
                variant: "destructive", duration: TOAST_DURATION,
            });
            return;
        }

        const claimStatusId = getClaimStatusIdForPayload(formData.warrantyStatus, formData.claim, claimStatuses);
        if (!isExpiredWarrantyStatus(formData.warrantyStatus) && claimStatusId == null) {
            toast({
                title: "Validation Error",
                description: "Claim status could not be resolved from master data.",
                variant: "destructive", duration: TOAST_DURATION,
            });
            return;
        }

        const draftPayload = {
            service_date: formData.serviceDate || format(new Date(), "yyyy-MM-dd"),
            serial_number: formData.serialNumber || "",
            invoice_date: formData.invoiceDate || null,
            warranty_end_date: formData.warrantyEndDate || null,
            complaint_description: formData.complaintDescription || "",
            warranty_status_id: warrantyStatusId,
            claim_status_id: claimStatusId,
            paid_services: getPaidServicesForPayload(
                formData.warrantyStatus,
                formData.claim,
                formData.isPaidService,
                claimStatuses
            ),
            rejection_remarks:
                !isExpiredWarrantyStatus(formData.warrantyStatus) && isClaimCode(formData.claim, "REJECTED")
                    ? formData.reason || null
                    : null,
            status_code: getStatusCode(findWarrantyRequestStatus(warrantyServiceRequestStatuses, "DRAFT")) || "DRAFT",
        };

        try {
            setActionLoading("save-draft");
            if (editingId) {
                const response = await serviceCenterApi.updateWarrantyService(editingId, draftPayload);
                if (response.isSuccessful) {
                    toast({
                        ...crudSuccessToast,
                        title: "Success",
                        description: response.message || "Service request saved as draft",
                    });
                    fetchWarrantyServices(1);
                    setIsFormModalOpen(false);
                    resetForm();
                } else {
                    toast({
                        title: "Error",
                        description: response.message || "Failed to save draft",
                        variant: "destructive", duration: TOAST_DURATION,
                    });
                    return;
                }
            } else {
                const response = await serviceCenterApi.createWarrantyService(draftPayload);
                if (response.isSuccessful) {
                    toast({ ...crudSuccessToast, title: "Success", description: response.message || "Service request saved as draft" });
                    fetchWarrantyServices(1);
                    setIsFormModalOpen(false);
                    resetForm();
                } else {
                    toast({
                        title: "Error",
                        description: response.message || "Failed to save draft",
                        variant: "destructive", duration: TOAST_DURATION,
                    });
                    return;
                }
            }
        } catch (e) {
            console.error('Error saving draft:', e);
            toast({
                title: "Error",
                description: getApiErrorMessage(e, "Failed to save service request draft"),
                variant: "destructive", duration: TOAST_DURATION
            });
        } finally {
            setActionLoading(null);
        }
    };

    // Save changes (for editing Submitted requests)
    const handleSaveChanges = async () => {
        if (!formData.clientName?.trim()) {
            toast({
                title: "Validation Error",
                description: "Consumer name is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (!formData.serialNumber) {
            toast({
                title: "Validation Error",
                description: "Serial number is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (!formData.complaintDescription?.trim()) {
            toast({
                title: "Validation Error",
                description: "Complaint description is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        const requestData: ServiceRequestData = {
            id: editingId!,
            serviceRequestCode: formData.serviceRequestCode,
            clientName: formData.clientName!,
            serialNumber: formData.serialNumber!,
            batch: formData.batch!,
            productionDate: formData.productionDate!,
            invoiceDate: formData.invoiceDate!,
            warrantyEndDate: formData.warrantyEndDate!,
            warrantyStatus: formData.warrantyStatus!,
            complaintDescription: formData.complaintDescription!,
            claim: formData.claim!,
            reason: formData.reason || "",
            status: formData.status!,
            serviceAction: formData.serviceAction || "",
            itemName: formData.itemName || "",
            newSerialNumber: formData.newSerialNumber || "",
            repairItems: formData.repairItems || [],
            replaceItems: formData.replaceItems || [],
            labourCost: formData.labourCost || 0,
            labourBillable: formData.labourBillable || false,
            serviceDate: formData.serviceDate || "",
            isPaidService: formData.isPaidService || ""
        };

        try {
            setActionLoading("save-changes");
            const statusCode =
                statusMatchesCode(formData.status, "DRAFT", warrantyServiceRequestStatuses)
                    ? getStatusCode(findWarrantyRequestStatus(warrantyServiceRequestStatuses, "DRAFT")) || "DRAFT"
                    : getStatusCode(findWarrantyRequestStatus(warrantyServiceRequestStatuses, "SUBMITTED")) || "SUBMITTED";

            const payload = {
                complaint_description: formData.complaintDescription || "",
                claim_status_id: getClaimStatusId(formData.claim || "", claimStatuses),
                rejection_remarks: isClaimCode(formData.claim, "REJECTED") ? (formData.reason || null) : null,
                status_code: statusCode
            };

            const response = await serviceCenterApi.updateWarrantyService(editingId!, payload);
            if (response.isSuccessful) {
                toast({ ...crudSuccessToast, title: "Success", description: response.message || "Changes saved successfully" });
                fetchWarrantyServices(1);
            } else {
                toast({ title: "Error", description: response.message || "Failed to update request", variant: "destructive", duration: TOAST_DURATION });
            }

            setIsFormModalOpen(false);
            resetForm();
        } catch (e) {
            console.error('Error saving changes:', e);
            toast({
                title: "Error",
                description: getApiErrorMessage(e, "Failed to update request on server"),
                variant: "destructive", duration: TOAST_DURATION
            });
        } finally {
            setActionLoading(null);
        }
    };

    // Submit service request
    const handleSubmit = async () => {
        if (!formData.clientName?.trim()) {
            toast({
                title: "Validation Error",
                description: "Consumer name is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (!formData.serialNumber) {
            toast({
                title: "Validation Error",
                description: "Serial number is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        // Batch is only required for new requests (proves serial was searched). Edit already has a saved serial.
        if (!editingId && !formData.batch && !(serialDetailsLoaded && formData.itemName)) {
            toast({
                title: "Validation Error",
                description: "Please select a valid serial number from the list",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (!formData.complaintDescription?.trim()) {
            toast({
                title: "Validation Error",
                description: "Complaint description is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (!isExpiredWarrantyStatus(formData.warrantyStatus) && !formData.claim) {
            toast({
                title: "Validation Error",
                description: "Claim status is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (isExpiredWarrantyStatus(formData.warrantyStatus) && !formData.isPaidService) {
            toast({
                title: "Validation Error",
                description: "Paid service selection is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        const claimStatusId = getClaimStatusIdForPayload(formData.warrantyStatus, formData.claim, claimStatuses);
        if (!isExpiredWarrantyStatus(formData.warrantyStatus) && claimStatusId == null) {
            toast({
                title: "Validation Error",
                description: "Claim status is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        const rejectionRemarks =
            !isExpiredWarrantyStatus(formData.warrantyStatus) && isClaimCode(formData.claim, "REJECTED")
                ? formData.reason?.trim() || null
                : null;

        try {
            setActionLoading("submit");
            if (editingId) {
                const response = await serviceCenterApi.updateWarrantyService(editingId, {
                    complaint_description: formData.complaintDescription || "",
                    claim_status_id: claimStatusId,
                    rejection_remarks: rejectionRemarks,
                    status_code: "SUBMITTED REQUEST",
                });
                if (response.isSuccessful) {
                    toast({
                        ...crudSuccessToast,
                        title: "Success",
                        description: response.message || "Service request submitted successfully",
                    });
                    fetchWarrantyServices(1);
                } else {
                    toast({
                        title: "Error",
                        description: response.message || "Failed to submit request",
                        variant: "destructive", duration: TOAST_DURATION,
                    });
                    return;
                }
            } else {
                const warrantyStatusId = resolveWarrantyStatusId(formData);
                if (warrantyStatusId == null) {
                    toast({
                        title: "Validation Error",
                        description: "Warranty status is required",
                        variant: "destructive", duration: TOAST_DURATION,
                    });
                    return;
                }
                const response = await serviceCenterApi.createWarrantyService({
                    service_date: formData.serviceDate || format(new Date(), "yyyy-MM-dd"),
                    serial_number: formData.serialNumber || "",
                    invoice_date: formData.invoiceDate || null,
                    warranty_end_date: formData.warrantyEndDate || null,
                    complaint_description: formData.complaintDescription || "",
                    warranty_status_id: warrantyStatusId,
                    claim_status_id: claimStatusId,
                    paid_services: getPaidServicesForPayload(
                        formData.warrantyStatus,
                        formData.claim,
                        formData.isPaidService,
                        claimStatuses
                    ),
                    rejection_remarks: rejectionRemarks,
                    status_code: "SUBMITTED REQUEST",
                });
                if (response.isSuccessful) {
                    toast({
                        ...crudSuccessToast,
                        title: "Success",
                        description: response.message || "Service request submitted successfully",
                    });
                    fetchWarrantyServices(1);
                } else {
                    toast({
                        title: "Error",
                        description: response.message || "Failed to submit request",
                        variant: "destructive", duration: TOAST_DURATION,
                    });
                    return;
                }
            }
            setIsFormModalOpen(false);
            resetForm();
        } catch (e) {
            console.error('Error submitting service request:', e);
            toast({
                title: "Error",
                description: getApiErrorMessage(e, "Failed to submit service request"),
                variant: "destructive", duration: TOAST_DURATION
            });
        } finally {
            setActionLoading(null);
        }
    };


    // Map backend detail to ServiceRequestData interface
    const mapDetailToServiceRequest = (detail: any): ServiceRequestDataWithCurrency => {
        const action = detail.actions?.[0];
        const currencyId =
            action?.currency_id ??
            detail?.currency_id ??
            undefined;
        const serviceAction = resolveServiceActionToCode(
            action?.service_action_code || action?.service_action_name || "",
            serviceActionOptions
        ) as ServiceAction;
        const newSerialNumber = action?.new_serial_number || "";
        const labourCost = action?.labour_cost || 0;
        const labourBillable = action?.is_labour_cost || false;

        const repairItems = serviceActionMatchesCode(serviceAction, "REPAIR", serviceActionOptions) && action?.items
            ? action.items.map((item: any, index: number) => {
                const itemId = item.item_id != null ? Number(item.item_id) : undefined;
                const fromOptions = itemId
                    ? repairItemOptions.find((o) => Number(o.item_id) === itemId)
                    : undefined;
                return {
                    id: item.id ?? Date.now() + index,
                    item_id: itemId,
                    itemCode: item.item_code ?? fromOptions?.item_code,
                    itemName: item.item_name || fromOptions?.item_name || "",
                    stock: Number(
                        item.current_QTY ?? item.current_qty ?? (fromOptions ? getMrItemStockQty(fromOptions) : 0)
                    ) || 0,
                    qty: item.qty,
                    price: item.price,
                    billable: item.is_billable,
                };
            })
            : [];

        const replaceItems = serviceActionMatchesCode(serviceAction, "REPLACE", serviceActionOptions) && action?.items
            ? action.items.map((item: any) => ({
                id: item.id,
                itemName: item.item_name,
                newSerialNumber: action.new_serial_number || ""
            }))
            : [];

        return {
            id: detail.id,
            serviceRequestCode: detail.service_code,
            clientName: detail.consumer_name,
            serialNumber: detail.serial_number,
            itemName: detail.item_name,
            batch: detail.batch || (detail as any).batch_no || (detail as any).batch_code || "",
            productionDate: detail.production_date || (detail as any).production_plan || "",
            invoiceDate: detail.invoice_date || "",
            warrantyEndDate: detail.warranty_end_date || "",
            warrantyStatus: (detail.warranty_status_name || detail.warranty_status_code || "Under Warranty") as WarrantyStatus,
            complaintDescription: detail.complaint_description,
            claim: resolveClaimToCode(
                (detail as any).claim_status_code || detail.claim_status_name || "",
                claimStatuses
            ) as ClaimStatus,
            reason: (detail as any).rejection_remarks || "",
            status: (detail.status_name || "Draft") as ServiceRequestStatus,
            serviceAction,
            repairItems,
            replaceItems,
            newSerialNumber,
            labourCost,
            labourBillable,
            serviceDate: detail.service_date,
            isPaidService: mapPaidServicesFromApi((detail as any).paid_services),
            currencyId: currencyId != null ? currencyId : undefined,
        };
    };

    // Handle edit with API loading
    const handleEdit = async (request: ServiceRequestData) => {
        try {
            if (!request) {
                toast({
                    title: "Error",
                    description: "Invalid service request data",
                    variant: "destructive", duration: TOAST_DURATION
                });
                return;
            }

            setActionLoading("edit-load");
            const response = await serviceCenterApi.getWarrantyServiceById(request.id);
            if (response.isSuccessful && response.data) {
                const detailedRequest = mapDetailToServiceRequest(response.data);
                setFormData({
                    serviceRequestCode: detailedRequest.serviceRequestCode || "",
                    clientName: detailedRequest.clientName || "",
                    serialNumber: detailedRequest.serialNumber || "",
                    batch: detailedRequest.batch || "",
                    productionDate: safeDateString(detailedRequest.productionDate),
                    invoiceDate: safeDateString(detailedRequest.invoiceDate),
                    warrantyEndDate: safeDateString(detailedRequest.warrantyEndDate),
                    warrantyStatus: detailedRequest.warrantyStatus || "Under Warranty",
                    complaintDescription: detailedRequest.complaintDescription || "",
                    claim: detailedRequest.claim || "",
                    reason: detailedRequest.reason || "",
                    status: detailedRequest.status || "Draft",
                    serviceAction: detailedRequest.serviceAction || "",
                    itemName: detailedRequest.itemName || "",
                    newSerialNumber: detailedRequest.newSerialNumber || "",
                    repairItems: detailedRequest.repairItems,
                    replaceItems: detailedRequest.replaceItems,
                    labourCost: typeof detailedRequest.labourCost === 'number' ? detailedRequest.labourCost : 0,
                    labourBillable: typeof detailedRequest.labourBillable === 'boolean' ? detailedRequest.labourBillable : false,
                    serviceDate: safeDateString(detailedRequest.serviceDate) || format(new Date(), "yyyy-MM-dd"),
                    isPaidService: detailedRequest.isPaidService || ""
                });
                setRepairCurrencyId(
                    detailedRequest.currencyId != null ? String(detailedRequest.currencyId) : ""
                );
                setEditingId(detailedRequest.id);
                setSerialDetailsLoaded(!!detailedRequest.serialNumber);

                // Fill batch/dates from serial lookup when detail API omits them (common for older records)
                if (detailedRequest.serialNumber && !detailedRequest.batch) {
                    try {
                        const serialRes = await serviceCenterApi.getDetailFromSerialNumber(
                            detailedRequest.serialNumber
                        );
                        if (serialRes.isSuccessful && serialRes.data) {
                            const mapped = mapSerialNumberApiToForm(
                                serialRes.data as Record<string, unknown>
                            );
                            setFormData((prev) => ({
                                ...prev,
                                itemCode: mapped.itemCode || prev.itemCode,
                                itemName: mapped.itemName || prev.itemName,
                                customerId: mapped.customerId ?? prev.customerId,
                                clientName: mapped.clientName || prev.clientName,
                                batchId: mapped.batchId ?? prev.batchId,
                                batch: mapped.batch || prev.batch,
                                productionDate: mapped.productionDate || prev.productionDate,
                                invoiceDate: mapped.invoiceDate || prev.invoiceDate,
                                warrantyEndDate: mapped.warrantyEndDate || prev.warrantyEndDate,
                                warrantyStatusId: mapped.warrantyStatusId ?? prev.warrantyStatusId,
                                warrantyStatus: mapped.warrantyStatus || prev.warrantyStatus,
                            }));
                        }
                    } catch {
                        /* keep detail form data if serial lookup fails */
                    }
                }

                setIsFormModalOpen(true);
            }
        } catch (e) {
            console.error('Error loading service request for edit:', e);
            toast({
                title: "Error",
                description: "Failed to load service request data from server",
                variant: "destructive", duration: TOAST_DURATION
            });
        } finally {
            setActionLoading(null);
        }
    };

    // Handle view with API loading
    const handleView = async (request: ServiceRequestData) => {
        try {
            if (!request) {
                toast({
                    title: "Error",
                    description: "Invalid service request data",
                    variant: "destructive", duration: TOAST_DURATION
                });
                return;
            }

            setActionLoading("view-load");
            const response = await serviceCenterApi.getWarrantyServiceById(request.id);
            if (response.isSuccessful && response.data) {
                const detailedRequest = mapDetailToServiceRequest(response.data);
                setViewingRequest(detailedRequest);
                setIsViewModalOpen(true);
            }
        } catch (e) {
            console.error('Error loading service request for view:', e);
            toast({
                title: "Error",
                description: "Failed to load service request data from server",
                variant: "destructive", duration: TOAST_DURATION
            });
        } finally {
            setActionLoading(null);
        }
    };

    // Handle accept quotation (for Submitted Request status)
    const handleAcceptQuotation = () => {
        if (viewingRequest && isRequestStatus(viewingRequest.status, "SUBMITTED")) {
            setServiceRequests(serviceRequests.map(req =>
                req.id === viewingRequest.id ? { ...req, status: "Completed Request" } : req
            ));
            toast({ ...crudSuccessToast, title: "Success", description: "Service request accepted and moved to completed" });
            
            // Auto-switch to Completed filter (value_code from entity values)
            setFilterStatus(getStatusId(findWarrantyRequestStatus(warrantyServiceRequestStatuses, "COMPLETED")));
            
            setIsViewModalOpen(false);
            setViewingRequest(null);
        }
    };

    const formatMoneyForRequest = (
        request: ServiceRequestDataWithCurrency,
        amount: number
    ) => {
        const symbol = resolveCurrencySymbolFromId(request.currencyId, currencies);
        return `${symbol}${amount.toFixed(2)}`;
    };

    // Export as PDF
    const handleExportPDF = (request: ServiceRequestDataWithCurrency) => {
        // Validation before export (matching Quotations validation)
        if (!request.serviceRequestCode) {
            toast({
                title: "Validation Error",
                description: "Service request code is missing",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (!request.clientName) {
            toast({
                title: "Validation Error",
                description: "Consumer name is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (!request.serialNumber) {
            toast({
                title: "Validation Error",
                description: "Serial number is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (!request.complaintDescription) {
            toast({
                title: "Validation Error",
                description: "Complaint description is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        // Validate service action is selected for Completed Request
        if (isRequestStatus(request.status, "COMPLETED") && !request.serviceAction) {
            toast({
                title: "Validation Error",
                description: "Service action is required",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        // Validate repair items if service action is Repair
        if (serviceActionMatchesCode(request.serviceAction, "REPAIR", serviceActionOptions) && (!request.repairItems || request.repairItems.length === 0)) {
            toast({
                title: "Validation Error",
                description: "At least one repair item is required for repair action",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        // Validate new serial number if service action is Replace
        if (serviceActionMatchesCode(request.serviceAction, "REPLACE", serviceActionOptions) && !request.newSerialNumber) {
            toast({
                title: "Validation Error",
                description: "New serial number is required for replacement action",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        // Create a properly formatted PDF-ready HTML document
        const pdfContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Service Request ${request.serviceRequestCode}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    @page {
                        size: A4;
                        margin: 15mm;
                    }
                    
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        padding: 20px;
                        color: #333;
                        line-height: 1.4;
                        background: white;
                        font-size: 11px;
                    }
                    
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 20px;
                        padding-bottom: 12px;
                        border-bottom: 3px solid #2563eb;
                        page-break-after: avoid;
                    }
                    
                    .company-info h1 {
                        color: #2563eb;
                        font-size: 22px;
                        font-weight: bold;
                        margin-bottom: 3px;
                    }
                    
                    .company-info p {
                        color: #666;
                        font-size: 10px;
                        line-height: 1.3;
                    }
                    
                    .document-title {
                        text-align: right;
                    }
                    
                    .document-title h2 {
                        font-size: 20px;
                        color: #1e293b;
                        margin-bottom: 3px;
                    }
                    
                    .document-title p {
                        color: #666;
                        font-size: 11px;
                    }
                    
                    .section {
                        margin-bottom: 16px;
                        page-break-inside: avoid;
                    }
                    
                    .section-title {
                        font-weight: 600;
                        font-size: 10px;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 8px;
                        padding-bottom: 4px;
                        border-bottom: 1px solid #e2e8f0;
                        page-break-after: avoid;
                    }
                    
                    .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px 20px;
                    }
                    
                    .info-item {
                        margin-bottom: 0;
                    }
                    
                    .info-label {
                        font-size: 9px;
                        color: #64748b;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0.3px;
                        margin-bottom: 2px;
                    }
                    
                    .info-value {
                        font-size: 11px;
                        color: #1e293b;
                        font-weight: 500;
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 10px 0;
                        font-size: 10px;
                        page-break-inside: avoid;
                    }
                    
                    thead {
                        background-color: #f8fafc;
                        page-break-after: avoid;
                    }
                    
                    th {
                        padding: 8px 10px;
                        text-align: left;
                        font-weight: 600;
                        font-size: 9px;
                        color: #475569;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        border-bottom: 2px solid #e2e8f0;
                    }
                    
                    th.text-right {
                        text-align: right;
                    }
                    
                    td {
                        padding: 7px 10px;
                        border-bottom: 1px solid #f1f5f9;
                        color: #334155;
                        font-size: 10px;
                    }
                    
                    td.text-right {
                        text-align: right;
                    }
                    
                    td.text-center {
                        text-align: center;
                    }
                    
                    .totals-section {
                        margin-top: 12px;
                        display: flex;
                        justify-content: flex-end;
                    }
                    
                    .totals-box {
                        width: 280px;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        overflow: hidden;
                    }
                    
                    .totals-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 12px;
                        border-bottom: 1px solid #f1f5f9;
                        font-size: 10px;
                    }
                    
                    .totals-row:last-child {
                        border-bottom: none;
                    }
                    
                    .totals-row.total {
                        background-color: #2563eb;
                        color: white;
                        font-weight: bold;
                        font-size: 12px;
                    }
                    
                    .totals-label {
                        color: #64748b;
                    }
                    
                    .totals-row.total .totals-label {
                        color: white;
                    }
                    
                    .totals-value {
                        font-weight: 600;
                        color: #1e293b;
                    }
                    
                    .totals-row.total .totals-value {
                        color: white;
                    }
                    
                    .signatures {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 30px;
                        margin-top: 20px;
                        padding-top: 15px;
                        page-break-inside: avoid;
                    }
                    
                    .signature-box {
                        text-align: center;
                    }
                    
                    .signature-line {
                        border-top: 2px solid #cbd5e1;
                        margin-top: 30px;
                        padding-top: 8px;
                        font-size: 10px;
                        color: #64748b;
                        font-weight: 500;
                    }
                    
                    .footer {
                        margin-top: 15px;
                        padding-top: 10px;
                        border-top: 1px solid #e2e8f0;
                        text-align: center;
                        font-size: 9px;
                        color: #94a3b8;
                        line-height: 1.4;
                        page-break-inside: avoid;
                    }
                    
                    .status-badge {
                        display: inline-block;
                        padding: 3px 10px;
                        border-radius: 10px;
                        font-size: 9px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.3px;
                    }
                    
                    .status-under-warranty {
                        background-color: #dcfce7;
                        color: #166534;
                    }
                    
                    .status-expired {
                        background-color: #fee2e2;
                        color: #991b1b;
                    }
                    
                    .claim-accept {
                        background-color: #dbeafe;
                        color: #1e40af;
                    }
                    
                    .claim-reject {
                        background-color: #fee2e2;
                        color: #991b1b;
                    }
                    
                    @media print {
                        body {
                            padding: 0;
                        }
                        
                        .no-print {
                            display: none;
                        }
                        
                        @page {
                            margin: 15mm;
                            size: A4 portrait;
                        }
                        
                        * {
                            page-break-inside: avoid;
                        }
                        
                        .section {
                            page-break-inside: avoid;
                        }
                        
                        table {
                            page-break-inside: avoid;
                        }
                        
                        .signatures {
                            page-break-before: avoid;
                        }
                        
                        .footer {
                            page-break-before: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <!-- Header -->
                <div class="header">
                    <div class="company-info">
                        <h1>MASTER-ERP</h1>
                        <p>Industrial Solutions & Services<br>
                        Ahmedabad, Gujarat, India</p>
                    </div>
                    <div class="document-title">
                        <h2>WARRANTY SERVICE REQUEST</h2>
                        <p># ${request.serviceRequestCode || 'DRAFT'}</p>
                    </div>
                </div>

                <!-- Service Request Details -->
                <div class="section">
                    <div class="section-title">Service Request Details</div>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Service Request Code</div>
                            <div class="info-value">${request.serviceRequestCode || '—'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Consumer Name</div>
                            <div class="info-value">${request.clientName || '—'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Serial Number</div>
                            <div class="info-value">${request.serialNumber || '—'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Item Name</div>
                            <div class="info-value">${request.itemName || '—'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Batch</div>
                            <div class="info-value">${request.batch || '—'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Production Date</div>
                            <div class="info-value">${formatDate(request.productionDate)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Invoice Date</div>
                            <div class="info-value">${formatDate(request.invoiceDate)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Warranty End Date</div>
                            <div class="info-value">${formatDate(request.warrantyEndDate)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Warranty Status</div>
                            <div class="info-value">
                                <span class="status-badge status-${request.warrantyStatus === "Under Warranty" ? "under-warranty" : "expired"}">${request.warrantyStatus}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Claim Status</div>
                            <div class="info-value">
                                <span class="status-badge claim-${request.claim?.toLowerCase() || 'accept'}">${request.claim || '—'}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Status</div>
                            <div class="info-value">${request.status}</div>
                        </div>
                    </div>
                </div>

                <!-- Complaint Description -->
                <div class="section">
                    <div class="section-title">Complaint Description</div>
                    <p style="color: #475569; font-size: 10px; line-height: 1.5;">${request.complaintDescription || '—'}</p>
                </div>

                ${request.reason ? `
                <!-- Rejection Reason -->
                <div class="section">
                    <div class="section-title">Rejection Reason</div>
                    <p style="color: #475569; font-size: 10px; line-height: 1.5;">${request.reason}</p>
                </div>
                ` : ''}

                ${request.serviceAction ? `
                <!-- Service Action -->
                <div class="section">
                    <div class="section-title">Service Action</div>
                    <div class="info-item">
                        <div class="info-label">Action Type</div>
                        <div class="info-value">${getServiceActionDisplayName(request.serviceAction, serviceActionOptions)}</div>
                    </div>
                </div>
                ` : ''}

                ${serviceActionMatchesCode(request.serviceAction, "REPAIR", serviceActionOptions) && request.repairItems && request.repairItems.length > 0 ? `
                <!-- Repair Items -->
                <div class="section">
                    <div class="section-title">Repair Items</div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 10%;">#</th>
                                <th style="width: 10%;" class="text-center">Billable</th>
                                <th style="width: 35%;">Item Name</th>
                                <th style="width: 15%;" class="text-center">Stock</th>
                                <th style="width: 10%;" class="text-center">Qty</th>
                                <th style="width: 20%;" class="text-right">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${request.repairItems.map((item, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td class="text-center">${item.billable ? '✓' : '—'}</td>
                                    <td><strong>${item.itemName}</strong></td>
                                    <td class="text-center">${item.stock}</td>
                                    <td class="text-center">${item.qty}</td>
                                    <td class="text-right">${formatMoneyForRequest(request, Number(item.price || 0))}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <!-- Labour Cost and Total -->
                    <div class="totals-section">
                        <div class="totals-box">
                            <div class="totals-row">
                                <span class="totals-label">Labour Cost ${request.labourBillable ? '(Billable)' : ''}</span>
                                <span class="totals-value">${formatMoneyForRequest(request, Number(request.labourCost || 0))}</span>
                            </div>
                            <div class="totals-row total">
                                <span class="totals-label">Total Price</span>
                                <span class="totals-value">${formatMoneyForRequest(
                                    request,
                                    (request.repairItems || []).reduce(
                                        (sum, item) =>
                                            sum +
                                            (item.billable
                                                ? Number(item.price || 0) * Number(item.qty || 0)
                                                : 0),
                                        0
                                    ) + (request.labourBillable ? Number(request.labourCost || 0) : 0)
                                )}</span>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${serviceActionMatchesCode(request.serviceAction, "REPLACE", serviceActionOptions) && request.newSerialNumber ? `
                <!-- Replacement Details -->
                <div class="section">
                    <div class="section-title">Replacement Details</div>
                    <div class="info-item">
                        <div class="info-label">New Serial Number</div>
                        <div class="info-value">${request.newSerialNumber}</div>
                    </div>
                </div>
                ` : ''}

                <!-- Signatures -->
                <div class="signatures">
                    <div class="signature-box">
                        <div class="signature-line">Service Technician</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line">Authorized Signatory</div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="footer">
                    <p>This is a computer-generated service request. Generated on ${format(new Date(), "dd-MM-yyyy, HH:mm")}.</p>
                    <p>Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
                </div>
            </body>
            </html>
        `;

        // Create a hidden iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
        if (iframeDoc) {
            iframeDoc.open();
            iframeDoc.write(pdfContent);
            iframeDoc.close();

            // Wait for images and resources to load
            const printIframe = () => {
                const win = iframe.contentWindow;
                if (win) {
                    win.focus();
                    win.print();
                    // Clean up after printing
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                    }, 1000);
                }
            };

            if (iframe.contentWindow) {
                // Some browsers need a small delay
                setTimeout(printIframe, 500);
            }
        } else {
            toast({
                title: "Error",
                description: "Could not initialize printing",
                variant: "destructive", duration: TOAST_DURATION
            });
            document.body.removeChild(iframe);
        }

        toast({
            title: "Printing",
            description: "Preparing service request for print...",
            duration: TOAST_DURATION,
        });
    };

    // Handle fulfill
    const handleFulfill = async () => {
        const id = editingId || viewingRequest?.id;
        if (!id) {
            toast({
                title: "Error",
                description: "No request is currently active",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        const activeServiceAction = editingId ? formData.serviceAction : viewingRequest?.serviceAction;
        const activeClaim = editingId ? formData.claim : viewingRequest?.claim;
        const activeRepairItems = editingId ? formData.repairItems : viewingRequest?.repairItems;
        const activeNewSerialNumber = editingId ? formData.newSerialNumber : viewingRequest?.newSerialNumber;
        const activeLabourCost = editingId ? formData.labourCost : viewingRequest?.labourCost;
        const activeLabourBillable = editingId ? formData.labourBillable : viewingRequest?.labourBillable;
        const activeComplaintDescription = editingId ? formData.complaintDescription : viewingRequest?.complaintDescription;

        // Validate from active state
        // Service action is optional for NA claim (expired warranty)
        if (!activeServiceAction && !isClaimCode(activeClaim, "NA")) {
            toast({
                title: "Validation Error",
                description: "Service action is required to fulfill the request",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (serviceActionMatchesCode(activeServiceAction, "REPAIR", serviceActionOptions) && (!activeRepairItems || activeRepairItems.length === 0)) {
            toast({
                title: "Validation Error",
                description: "At least one repair item is required for repair action",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        if (serviceActionMatchesCode(activeServiceAction, "REPLACE", serviceActionOptions) && !activeNewSerialNumber) {
            toast({
                title: "Validation Error",
                description: "New Serial Number is required for replacement action",
                variant: "destructive", duration: TOAST_DURATION
            });
            return;
        }

        try {
            setActionLoading("complete");

            // Calculate total amount
            const itemsTotal = (serviceActionMatchesCode(activeServiceAction, "REPAIR", serviceActionOptions) && activeRepairItems)
                ? activeRepairItems.reduce((sum: number, item: any) => sum + (item.billable ? Number(item.price || 0) * Number(item.qty || 0) : 0), 0)
                : 0;
            const labourAmount = activeLabourBillable ? Number(activeLabourCost || 0) : 0;
            const totalAmount = itemsTotal + labourAmount;

            // Map action items
            const serviceActionId = getServiceActionId(activeServiceAction || "", serviceActionOptions);
            if (serviceActionId == null) {
                toast({
                    title: "Validation Error",
                    description: "Service action could not be resolved from master data.",
                    variant: "destructive", duration: TOAST_DURATION,
                });
                return;
            }

            const actionItems = serviceActionMatchesCode(activeServiceAction, "REPAIR", serviceActionOptions) && activeRepairItems
                ? activeRepairItems.map((item: any) => ({
                    item_id: item.item_id,
                    qty: Number(item.qty || 1),
                    price: Number(item.price || 0),
                    is_billable: item.billable || false
                  }))
                : [];

            if (
                serviceActionMatchesCode(activeServiceAction, "REPAIR", serviceActionOptions) &&
                actionItems.some((item) => item.item_id == null || !Number.isFinite(Number(item.item_id)))
            ) {
                toast({
                    title: "Validation Error",
                    description: "Each repair item must be selected from inventory master data.",
                    variant: "destructive", duration: TOAST_DURATION,
                });
                return;
            }

            const isRepairAction = serviceActionMatchesCode(
                activeServiceAction,
                "REPAIR",
                serviceActionOptions
            );
            const resolvedCurrencyId =
                isRepairAction &&
                repairCurrencyId &&
                Number.isFinite(Number(repairCurrencyId))
                    ? Number(repairCurrencyId)
                    : undefined;

            const payload = {
                complaint_description: activeComplaintDescription || "",
                status_code: "COMPLETED REQUEST",
                ...(resolvedCurrencyId != null ? { currency_id: resolvedCurrencyId } : {}),
                actions: [
                    {
                        service_action_id: serviceActionId,
                        new_serial_number: serviceActionMatchesCode(activeServiceAction, "REPLACE", serviceActionOptions)
                            ? (activeNewSerialNumber || null)
                            : null,
                        labour_cost: Number(activeLabourCost || 0),
                        is_labour_cost: activeLabourBillable || false,
                        total_amount: totalAmount,
                        items: actionItems,
                        ...(resolvedCurrencyId != null ? { currency_id: resolvedCurrencyId } : {}),
                    },
                ],
            };

            const response = await serviceCenterApi.updateWarrantyService(id, payload);

            if (response.isSuccessful) {
                toast({ ...crudSuccessToast, title: "Success", description: response.message || "Service request completed successfully" });
                
                // Auto-switch to Completed filter (value_code from entity values)
                setFilterStatus(getStatusId(findWarrantyRequestStatus(warrantyServiceRequestStatuses, "COMPLETED")));
                fetchWarrantyServices(1);
            } else {
                toast({ title: "Error", description: response.message || "Failed to complete request", variant: "destructive", duration: TOAST_DURATION });
            }

            if (editingId) {
                setIsFormModalOpen(false);
                resetForm();
            } else {
                setIsViewModalOpen(false);
                setViewingRequest(null);
            }
        } catch (e) {
            console.error('Error completing service request:', e);
            toast({
                title: "Error",
                description: getApiErrorMessage(e, "Failed to fulfill request on server"),
                variant: "destructive", duration: TOAST_DURATION
            });
        } finally {
            setActionLoading(null);
        }
    };

    const isFormActionBusy = actionLoading === "save-draft" || actionLoading === "submit" || actionLoading === "complete";
    const canSaveRequest = editingId ? canEdit(WARRANTY_SERVICE_MODULE) : canCreate(WARRANTY_SERVICE_MODULE);

    // Backend API handles filtering and pagination. Set filteredData and paginatedData directly.
    const filteredData = serviceRequests;
    const paginatedData = serviceRequests;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, filterDate]);

    if (!hasModuleAccess) {
        return <Unauthorized />;
    }

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold tracking-tight">Warranty Service Request</h1>

            {/* Filters */}
            {/* Standardized Toolbar */}
            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: setSearchTerm,
                    placeholder: "Search by Code, Serial No..."
                }}
                filters={[
                    {
                        type: 'date',
                        label: 'Date',
                        value: filterDate,
                        onChange: setFilterDate,
                        placeholder: "All Dates"
                    },
                    {
                        type: 'select',
                        label: 'Status',
                        value: filterStatus,
                        options: [
                            { value: "All", label: "All Status" },
                            ...(warrantyServiceRequestStatuses || []).map((s) => ({
                                value: getStatusId(s),
                                label: s.name || s.value_name || getStatusCode(s),
                            })),
                        ],
                        onChange: setFilterStatus,
                        searchable: true
                    }
                ]}
                actions={canCreate(WARRANTY_SERVICE_MODULE) ? [
                    {
                        label: "New Service Request",
                        icon: <Plus className="mr-2 h-4 w-4" />,
                        onClick: () => { resetForm(); setIsFormModalOpen(true); }
                    }
                ] : []}
            />

            {/* Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Service Code</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Consumer Name</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Serial Number</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Service Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Warranty Status</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Claim</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="text-center font-semibold text-xs uppercase tracking-wider w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isListLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                Loading warranty services...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                            No service requests found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((item) => {
                                        try {
                                            if (!item || typeof item !== 'object') {
                                                console.warn('Invalid item in paginatedData:', item);
                                                return null;
                                            }
                                            
                                            return (
                                                <TableRow key={item?.id || Math.random()} className="hover:bg-muted/30 transition-colors border-b">
                                                    <TableCell className="py-4 font-medium font-mono">
                                                        {item?.serviceRequestCode || "—"}
                                                    </TableCell>
                                                    <TableCell>{item?.clientName || "—"}</TableCell>
                                                    <TableCell className="font-mono">{item?.serialNumber || "—"}</TableCell>
                                                    <TableCell>{item?.serviceDate ? formatDate(item.serviceDate) : "—"}</TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={item?.warrantyStatus === "Under Warranty" ? "default" : "outline"}
                                                            className={cn(
                                                                item?.warrantyStatus === "Under Warranty" && "bg-green-500 hover:bg-green-600 border-green-500"
                                                            )}
                                                        >
                                                            {item?.warrantyStatus || "Under Warranty"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {item?.claim ? (
                                                            <Badge variant={isClaimCode(item.claim, "ACCEPT") ? "default" : "destructive"}>
                                                                {getClaimDisplayName(item.claim, claimStatuses)}
                                                            </Badge>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={getStatusBadgeVariant(item?.status || "Draft", warrantyServiceRequestStatuses)}>
                                                            {getDisplayStatus(item)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center py-4">
                                                        <TableActionButtons
                                                            onView={canView(WARRANTY_SERVICE_MODULE) ? () => handleView(item) : undefined}
                                                            onEdit={
                                                                canEdit(WARRANTY_SERVICE_MODULE) &&
                                                                (isRequestStatus(item?.status, "DRAFT") || isRequestStatus(item?.status, "SUBMITTED"))
                                                                    ? () => handleEdit(item)
                                                                    : undefined
                                                            }
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        } catch (e) {
                                            console.error('Error rendering table row:', e, item);
                                            return null;
                                        }
                                    })
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
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>


            {/* Create/Edit Form Modal */}
            <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
                <DialogContent
                    className="flex! min-h-0 w-[95%] max-h-[78vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl xl:max-w-5xl"
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 border-b bg-white p-4 sm:p-6">
                        <DialogTitle className="text-2xl font-bold">
                            {editingId ? "Edit Service Request" : "New Service Request"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-6 space-y-6">
                        {/* Service Date - At the top */}
                        <div className="space-y-2">
                            <Label>Service Date</Label>
                            <Input
                                value={formData.serviceDate ? formatDate(formData.serviceDate) : ""}
                                disabled
                                className="h-9 bg-muted/50"
                            />
                        </div>

                        {/* Serial Number */}
                        <div className="space-y-2">
                            <Label>
                                Serial Number <span className="text-red-500">*</span>
                            </Label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <Input
                                    placeholder="Enter serial number"
                                    value={formData.serialNumber}
                                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                                    className="h-9 flex-1"
                                    disabled={!!editingId && !isRequestStatus(formData.status, "DRAFT")}
                                />
                                {(!editingId || isRequestStatus(formData.status, "DRAFT")) && (
                                    <Button
                                        className="h-9 shrink-0 bg-blue-600 hover:bg-blue-700 sm:px-4"
                                        onClick={() => {
                                            if (formData.serialNumber) {
                                                handleSerialNumberChange(formData.serialNumber);
                                            }
                                        }}
                                    >
                                        <Search className="h-4 w-4 sm:mr-2" />
                                        <span className="hidden sm:inline">Search</span>
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Item details box - Always show */}
                        <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/20 p-4 sm:p-5 md:grid-cols-2 lg:grid-cols-3">
                            <div className="min-w-0 space-y-1">
                                <Label className="text-xs text-muted-foreground">Item Name</Label>
                                <p className="font-semibold whitespace-normal wrap-break-word">{formData.itemName || "—"}</p>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <Label className="text-xs text-muted-foreground">Consumer Name</Label>
                                <Input 
                                    value={formData.clientName || ""} 
                                    disabled 
                                    className="h-9 bg-white/80 font-semibold" 
                                    placeholder="—"
                                />
                            </div>
                            {serialDetailsLoaded && (
                                <>
                                    <div className="min-w-0 space-y-1">
                                        <Label className="text-xs text-muted-foreground">Batch</Label>
                                        <p className="font-semibold">{formData.batch || "—"}</p>
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                        <Label className="text-xs text-muted-foreground">Production Date</Label>
                                        <p className="font-semibold">{formatDate(formData.productionDate || "") || "—"}</p>
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                        <Label className="text-xs text-muted-foreground">Invoice Date</Label>
                                        <p className="font-semibold">{formatDate(formData.invoiceDate || "") || "—"}</p>
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                        <Label className="text-xs text-muted-foreground">Warranty End Date</Label>
                                        <p className="font-semibold">{formatDate(formData.warrantyEndDate || "") || "—"}</p>
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                        <Label className="text-xs text-muted-foreground">Warranty Status</Label>
                                        <div className="flex items-center h-9">
                                            <Badge
                                                variant={formData.warrantyStatus === "Under Warranty" ? "default" : "outline"}
                                                className={cn(
                                                    "text-sm",
                                                    formData.warrantyStatus === "Under Warranty" && "bg-green-500 hover:bg-green-600 border-green-500"
                                                )}
                                            >
                                                {formData.warrantyStatus || "Under Warranty"}
                                            </Badge>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Complaint Description */}
                        <div className="space-y-2">
                            <Label>
                                Complaint Description <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                placeholder="Describe the complaint in detail..."
                                value={formData.complaintDescription}
                                onChange={(e) => setFormData({ ...formData, complaintDescription: e.target.value })}
                                rows={3}
                            />
                        </div>

                        {/* Claim + Paid Service: aligned row */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {/* Claim (hidden when warranty expired) */}
                            {!isExpiredWarrantyStatus(formData.warrantyStatus) && (
                                <div className="space-y-2 pb-0.5">
                                    <Label>
                                        Claim <span className="text-red-500">*</span>
                                    </Label>
                                    <Select
                                        value={resolveClaimToCode(formData.claim, claimStatuses)}
                                        onValueChange={handleClaimChange}
                                        disabled={editingId !== null && !isRequestStatus(formData.status, "DRAFT")}
                                    >
                                        <SelectTrigger className={formSelectTriggerClass}>
                                            <SelectValue placeholder="Select claim status" />
                                        </SelectTrigger>
                                        <SelectContent
                                            position="popper"
                                            sideOffset={4}
                                            collisionPadding={24}
                                            className="z-200 max-h-60"
                                        >
                                            {claimOptionsForForm.map((c) => {
                                                const code = getClaimCode(c);
                                                return (
                                                    <SelectItem key={code} value={code}>
                                                        {c.name || c.value_name || code}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Paid Service? (expired warranty, or rejected + under warranty) */}
                            {(!editingId || isRequestStatus(formData.status, "DRAFT")) &&
                                (isExpiredWarrantyStatus(formData.warrantyStatus) ||
                                    (formData.warrantyStatus === "Under Warranty" && isClaimCode(formData.claim, "REJECTED"))) && (
                                <div className="space-y-2 pb-0.5">
                                    <Label>Paid Service? <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={formData.isPaidService || ""}
                                        onValueChange={(value) => setFormData({ ...formData, isPaidService: value as "Yes" | "No" })}
                                    >
                                        <SelectTrigger className={formSelectTriggerClass}>
                                            <SelectValue placeholder="Select Yes/No" />
                                        </SelectTrigger>
                                        <SelectContent
                                            position="popper"
                                            sideOffset={4}
                                            collisionPadding={24}
                                            className="z-200 max-h-60"
                                        >
                                            <SelectItem value="Yes">Yes</SelectItem>
                                            <SelectItem value="No">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* Rejection Remarks (optional if Reject, not for expired warranty) */}
                        {!isExpiredWarrantyStatus(formData.warrantyStatus) && isClaimCode(formData.claim, "REJECTED") && (
                            <div className="space-y-2">
                                <Label>
                                    Rejection Remarks
                                </Label>
                                <Textarea
                                    placeholder="Enter reason for rejection..."
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    rows={2}
                                />
                            </div>
                        )}

                        {/* Service Action Section - For Submitted status when editing (both Accept and Reject) */}
                        {editingId && isRequestStatus(formData.status, "SUBMITTED") && (
                                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
                                        Service Action
                                    </h3>

                                    {isClaimCode(formData.claim, "REJECTED") &&
                                    (formData.warrantyStatus === "Under Warranty" || formData.warrantyStatus === "Expired") ? (
                                        <div className="space-y-2">
                                            <Label>Paid Service</Label>
                                            <div className="h-10 px-3 py-2 bg-white border rounded-md font-semibold text-slate-700 flex items-center">
                                                {formData.isPaidService || "—"}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label>Select Action</Label>
                                            <Select
                                                value={resolveServiceActionToCode(formData.serviceAction, serviceActionOptions)}
                                                onValueChange={(value) => {
                                                    const actionCode = resolveServiceActionToCode(value, serviceActionOptions);
                                                    const labourBillable =
                                                        serviceActionMatchesCode(actionCode, "REPAIR", serviceActionOptions) &&
                                                        formData.warrantyStatus === "Expired";
                                                    setFormData({ ...formData, serviceAction: actionCode as ServiceAction, labourBillable });
                                                }}
                                            >
                                                <SelectTrigger className={cn(formSelectTriggerClass, "bg-white")}>
                                                    <SelectValue placeholder="Select service action" />
                                                </SelectTrigger>
                                                <SelectContent
                                                    position="popper"
                                                    sideOffset={4}
                                                    collisionPadding={24}
                                                    className="z-200 max-h-60"
                                                >
                                                    {usableServiceActions.map((action) => {
                                                        const code = getServiceActionCode(action);
                                                        return (
                                                            <SelectItem key={String(action.id ?? code)} value={code}>
                                                                {action.name || action.value_name || code}
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Repair Section - Show if action is Repair OR if it's a Paid Service (Under Warranty Reject) */}
                                    {((serviceActionMatchesCode(formData.serviceAction, "REPAIR", serviceActionOptions)) ||
                                        (isClaimCode(formData.claim, "REJECTED") &&
                                            (formData.warrantyStatus === "Under Warranty" || formData.warrantyStatus === "Expired") &&
                                            formData.isPaidService === "Yes")) && (
                                    <div className="space-y-3 mt-4">
                                        <div className="space-y-2">
                                            <SearchableSelect
                                                label="Currency"
                                                value={repairCurrencyId}
                                                options={repairCurrencyOptions}
                                                onChange={setRepairCurrencyId}
                                                placeholder="Select currency"
                                                className={cn(formSelectTriggerClass, "bg-white")}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-semibold">Repair Item Parts</Label>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleAddRepairItem}
                                                className="h-8"
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                Add Item
                                            </Button>
                                        </div>

                                        <div className="max-h-[300px] overflow-y-auto border rounded-lg bg-white">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-50">
                                                        <TableHead className="w-[80px]">Billable</TableHead>
                                                        <TableHead className="w-[50px]">#</TableHead>
                                                        <TableHead className="min-w-[300px]">Item Name</TableHead>
                                                        <TableHead className="w-[100px]">Stock</TableHead>
                                                        <TableHead className="w-[100px]">Qty</TableHead>
                                                        <TableHead className="w-[120px]">Price</TableHead>
                                                        <TableHead className="w-[60px]"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(!formData.repairItems || formData.repairItems.length === 0) ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                                                                No repair items added
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        formData.repairItems.map((item, index) => (
                                                            <TableRow key={item.id}>
                                                                <TableCell className="text-center">
                                                                    <Checkbox
                                                                        checked={item.billable}
                                                                        onCheckedChange={(checked) => handleRepairItemChange(item.id, "billable", checked)}
                                                                        className="h-5 w-5"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>{index + 1}</TableCell>
                                                                <TableCell className="min-w-[300px]">
                                                                    <div
                                                                        className="w-full min-w-[280px]"
                                                                        title={
                                                                            item.item_id != null
                                                                                ? repairItemSelectOptions.find(
                                                                                      (opt) =>
                                                                                          opt.value ===
                                                                                          String(item.item_id)
                                                                                  )?.label
                                                                                : undefined
                                                                        }
                                                                    >
                                                                        <SearchableSelect
                                                                            value={
                                                                                item.item_id != null
                                                                                    ? String(item.item_id)
                                                                                    : ""
                                                                            }
                                                                            options={repairItemSelectOptions}
                                                                            onChange={(value) =>
                                                                                handleRepairItemSelect(item.id, value)
                                                                            }
                                                                            disabled={isRepairItemsLoading}
                                                                            placeholder={
                                                                                isRepairItemsLoading
                                                                                    ? "Loading items..."
                                                                                    : "Select item"
                                                                            }
                                                                            className="h-auto min-h-10 w-full min-w-[280px] items-start! py-2 bg-white"
                                                                            selectedPrimaryLineClamp={2}
                                                                            showSelectedTitle
                                                                            selectedTruncate="end"
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        value={item.stock}
                                                                        disabled
                                                                        className="h-9 bg-slate-50"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="text"
                                                                        inputMode="numeric"
                                                                        value={item.qty}
                                                                        onChange={(e) => handleRepairItemChange(item.id, "qty", e.target.value)}
                                                                        className="h-9 text-center"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        placeholder="Price"
                                                                        value={item.price}
                                                                        onChange={(e) => handleRepairItemChange(item.id, "price", e.target.value)}
                                                                        className="h-9 text-right font-semibold"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleRemoveRepairItem(item.id)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                            
                                            {/* Labour Cost Row */}
                                            <div className="border-t p-4 space-y-3 bg-slate-50">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Checkbox
                                                            checked={formData.labourBillable || false}
                                                            onCheckedChange={(checked) => setFormData({ ...formData, labourBillable: !!checked })}
                                                            className="h-5 w-5"
                                                        />
                                                        <Label className="font-semibold">Labour Cost</Label>
                                                    </div>
                                                    <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="Amount"
                                                        value={formData.labourCost || ""}
                                                        onChange={(e) => {
                                                            let val = e.target.value.replace(/[^0-9.]/g, '');
                                                            const parts = val.split('.');
                                                            if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                                                            setFormData({ ...formData, labourCost: val });
                                                        }}
                                                        className="h-9 w-32 text-right font-semibold"
                                                    />
                                                </div>
                                                
                                                {/* Total Price */}
                                                <div className="flex items-center justify-between pt-2 border-t">
                                                    <Label className="font-bold text-lg">Total Price</Label>
                                                    <span className="font-bold text-lg text-primary">
                                                        {repairCurrencySymbol}
                                                        {(
                                                            (formData.repairItems || []).reduce(
                                                                (sum, item) =>
                                                                    sum +
                                                                    (item.billable
                                                                        ? Number(item.price || 0) * Number(item.qty || 0)
                                                                        : 0),
                                                                0
                                                            ) +
                                                            (formData.labourBillable
                                                                ? Number(formData.labourCost || 0)
                                                                : 0)
                                                        ).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Replace Section */}
                                {serviceActionMatchesCode(formData.serviceAction, "REPLACE", serviceActionOptions) && (
                                    <div className="space-y-3 mt-4">
                                        <Label className="text-sm font-semibold">New Serial Number</Label>
                                        <Input
                                            placeholder="Enter new serial number (FG remains same)"
                                            value={formData.newSerialNumber || ""}
                                            onChange={(e) => setFormData({ ...formData, newSerialNumber: e.target.value })}
                                            className="h-10 border-blue-200 focus:border-blue-400"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="shrink-0 gap-2 border-t bg-white p-4 sm:p-6 mt-auto sm:flex-row sm:items-center sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => { setIsFormModalOpen(false); resetForm(); }}
                            disabled={isFormActionBusy}
                        >
                            Close
                        </Button>
                        {editingId && isRequestStatus(formData.status, "SUBMITTED") ? (
                            canEdit(WARRANTY_SERVICE_MODULE) && (
                                <Button
                                    onClick={handleFulfill}
                                    loading={actionLoading === "complete"}
                                    disabled={!!actionLoading}
                                >
                                    Complete
                                </Button>
                            )
                        ) : (
                            canSaveRequest && (
                                <>
                                    <Button
                                        variant="secondary"
                                        onClick={handleSaveDraft}
                                        loading={actionLoading === "save-draft"}
                                        disabled={!!actionLoading}
                                    >
                                        Save
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        loading={actionLoading === "submit"}
                                        disabled={!!actionLoading}
                                    >
                                        Submit
                                    </Button>
                                </>
                            )
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            {/* View Modal */}
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent
                    className="max-w-4xl max-h-[90vh] overflow-y-auto"
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">
                            Service Request Details
                        </DialogTitle>
                    </DialogHeader>

                    {viewingRequest && (
                        <div className="space-y-6">
                            {/* Request Information */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Service Code</Label>
                                    <p className="font-mono font-semibold">{displayText(viewingRequest.serviceRequestCode)}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Consumer Name</Label>
                                    <p className="font-semibold">{displayText(viewingRequest.clientName)}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Service Date</Label>
                                    <p className="font-medium">{displayDate(viewingRequest.serviceDate)}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Status</Label>
                                    <div className="mt-1">
                                        <Badge variant={getStatusBadgeVariant(viewingRequest.status)}>
                                            {getDisplayStatus(viewingRequest)}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border">
                                {!isExpiredWarrantyStatus(viewingRequest.warrantyStatus) && (
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Claim</Label>
                                        <div className="mt-1">
                                            {viewingRequest.claim ? (
                                                <Badge variant={isClaimCode(viewingRequest.claim, "ACCEPT") ? "default" : "destructive"}>
                                                    {getClaimDisplayName(viewingRequest.claim, claimStatuses)}
                                                </Badge>
                                            ) : (
                                                "—"
                                            )}
                                        </div>
                                    </div>
                                )}
                                {isExpiredWarrantyStatus(viewingRequest.warrantyStatus) && (
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Paid Service?</Label>
                                        <div className="mt-1">
                                            <Badge variant="outline" className="font-semibold">
                                                {getPaidServiceDisplay(viewingRequest.isPaidService)}
                                            </Badge>
                                        </div>
                                    </div>
                                )}
                                {!isExpiredWarrantyStatus(viewingRequest.warrantyStatus) && viewingRequest.isPaidService && (
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Paid Service?</Label>
                                        <div className="mt-1">
                                            <Badge variant="outline" className="font-semibold">
                                                {getPaidServiceDisplay(viewingRequest.isPaidService)}
                                            </Badge>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Serial Number & Warranty Details */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide border-b pb-2">
                                    Warranty Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Serial Number</Label>
                                        <p className="font-mono font-medium">{displayText(viewingRequest.serialNumber)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Batch</Label>
                                        <p className="font-medium">{displayText(viewingRequest.batch)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Production Date</Label>
                                        <p className="font-medium">{displayDate(viewingRequest.productionDate)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Invoice Date</Label>
                                        <p className="font-medium">{displayDate(viewingRequest.invoiceDate)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Warranty End Date</Label>
                                        <p className="font-medium">{displayDate(viewingRequest.warrantyEndDate)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Warranty Status</Label>
                                        <div className="mt-1">
                                            {viewingRequest.warrantyStatus ? (
                                                <Badge
                                                    variant={viewingRequest.warrantyStatus === "Under Warranty" ? "default" : "outline"}
                                                    className={cn(
                                                        viewingRequest.warrantyStatus === "Under Warranty" && "bg-green-500 hover:bg-green-600 border-green-500"
                                                    )}
                                                >
                                                    {viewingRequest.warrantyStatus}
                                                </Badge>
                                            ) : (
                                                <span className="font-medium">{EMPTY_DISPLAY}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Complaint Description */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Complaint Description</Label>
                                <p className="text-sm p-3 bg-slate-50 rounded border">{displayText(viewingRequest.complaintDescription)}</p>
                            </div>

                            {/* Rejection Remarks (if rejected) */}
                            {viewingRequest.reason && (
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Rejection Remarks</Label>
                                    <p className="text-sm p-3 bg-slate-50 rounded border">{viewingRequest.reason}</p>
                                </div>
                            )}

                            {/* Display Service Action for completed and other non-submitted statuses */}
                            {!isRequestStatus(viewingRequest.status, "SUBMITTED") && viewingRequest.serviceAction && (
                                <div className="space-y-4 p-4 bg-slate-50 rounded-lg border">
                                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                                        Service Action Taken
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Service Date</Label>
                                            <p className="font-medium">{displayDate(viewingRequest.serviceDate)}</p>
                                        </div>
                                        <div>
                                            <Label className="text-xs text-muted-foreground">Action Type</Label>
                                            <p className="font-medium">
                                                {displayText(getServiceActionDisplayName(viewingRequest.serviceAction, serviceActionOptions))}
                                            </p>
                                        </div>
                                    </div>

                                    {serviceActionMatchesCode(viewingRequest.serviceAction, "REPAIR", serviceActionOptions) && viewingRequest.repairItems && viewingRequest.repairItems.length > 0 && (
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Repair Items Used</Label>
                                            <div className="border rounded-lg bg-white">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-slate-50">
                                                            <TableHead className="w-[80px]">Billable</TableHead>
                                                            <TableHead className="w-[50px]">#</TableHead>
                                                            <TableHead>Item Name</TableHead>
                                                            <TableHead className="w-[100px]">Stock</TableHead>
                                                            <TableHead className="w-[100px]">Qty</TableHead>
                                                            <TableHead className="w-[120px]">Price</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {viewingRequest.repairItems.map((item, index) => (
                                                            <TableRow key={item.id}>
                                                                <TableCell className="text-center">
                                                                    <Checkbox checked={item.billable} disabled className="h-5 w-5" />
                                                                </TableCell>
                                                                <TableCell>{index + 1}</TableCell>
                                                                <TableCell>{displayText(item.itemName)}</TableCell>
                                                                <TableCell>{displayText(item.stock)}</TableCell>
                                                                <TableCell>{displayText(item.qty)}</TableCell>
                                                                <TableCell>
                                                                    {formatMoneyForRequest(
                                                                        viewingRequest as ServiceRequestDataWithCurrency,
                                                                        Number(item.price || 0)
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                                
                                                {/* Labour Cost and Total Price Display */}
                                                <div className="border-t p-4 space-y-3 bg-slate-50">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <Checkbox checked={viewingRequest.labourBillable || false} disabled className="h-5 w-5" />
                                                            <Label className="font-semibold">Labour Cost</Label>
                                                        </div>
                                                        <span className="font-medium">
                                                            {formatMoneyForRequest(
                                                                viewingRequest as ServiceRequestDataWithCurrency,
                                                                Number(viewingRequest.labourCost || 0)
                                                            )}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Total Price */}
                                                    <div className="flex items-center justify-between pt-2 border-t">
                                                        <Label className="font-bold text-lg">Total Price</Label>
                                                        <span className="font-bold text-lg text-primary">
                                                            {formatMoneyForRequest(
                                                                viewingRequest as ServiceRequestDataWithCurrency,
                                                                (viewingRequest.repairItems || []).reduce(
                                                                    (sum, item) =>
                                                                        sum +
                                                                        (item.billable
                                                                            ? Number(item.price || 0) *
                                                                              Number(item.qty || 0)
                                                                            : 0),
                                                                    0
                                                                ) +
                                                                    (viewingRequest.labourBillable
                                                                        ? Number(viewingRequest.labourCost || 0)
                                                                        : 0)
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {serviceActionMatchesCode(viewingRequest.serviceAction, "REPLACE", serviceActionOptions) && viewingRequest.newSerialNumber && (
                                        <div>
                                            <Label className="text-xs text-muted-foreground">New Serial Number</Label>
                                            <p className="font-mono text-blue-600 font-semibold">{displayText(viewingRequest.newSerialNumber)}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setIsViewModalOpen(false); setViewingRequest(null); }}>
                            Close
                        </Button>
                        {isRequestStatus(viewingRequest?.status, "COMPLETED") && canPrint(WARRANTY_SERVICE_MODULE) && (
                            <Button
                                onClick={() => viewingRequest && handleExportPDF(viewingRequest)}
                                className="gap-2"
                                disabled={!!actionLoading}
                            >
                                <Download className="h-4 w-4" />
                                Export
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default WarrantyService;
