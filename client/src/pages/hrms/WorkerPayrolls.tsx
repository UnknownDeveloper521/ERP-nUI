import React, { useEffect, useState, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect, type SelectOption } from "@/components/shared/SearchableSelect";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { format } from "date-fns";
import {
    Plus, Search, Edit, Trash2, ArrowLeft,
    Save, Send, ChevronLeft, ChevronRight, ChevronDown, ChevronsUpDown, Check,
    Calendar as CalendarIcon, X, Loader2
} from "lucide-react";
import { DatePicker } from "@/components/shared/DatePicker";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInputBorderless,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { CURRENCY_SYMBOL } from "@/config/appConfig";
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
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
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
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
    WorkerWage,
    WorkerWageStatus,
    mockWorkerWages,
    mockWagePeriods
} from "@/lib/workerPayrollSharedData";
import { mockLocations, mockWorkCenters, mockOperations } from "@/lib/masterMockData";
import { commonApi, workerPayrollApi, operationsApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { isWorkCategoryEntityName } from "@/services/loadCommonData";

/** Green styling for successful create / update / delete; use `variant: "destructive"` for validation & errors. */
const crudSuccessToast = {
    className:
        "border-green-600 bg-green-50 text-green-950 shadow-md dark:border-green-700 dark:bg-green-950 dark:text-green-50",
};

/** Gray disabled primary/outline actions when the wage form is invalid. */
const saveActionDisabledClass =
    "disabled:bg-muted disabled:text-muted-foreground disabled:border-border disabled:opacity-100 disabled:shadow-none disabled:hover:bg-muted";



import { useAuth } from "@/lib/store";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "../Unauthorized";
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";

export default function WorkerPayrollsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { isMenuVisible, canCreate, canEdit, canDelete: canDeletePermission } = useHasPermission();

    const hasAccess = isMenuVisible("HRMS:Worker Payrolls");

    // Early return if no access at all
    if (!hasAccess) {
        return <Unauthorized />;
    }

    type DropdownOption = { id: number; name: string; code?: string };
    const POST_API_FALLBACK_COMPANY_ID = 10;

    // State
    const [wages, setWages] = useState<WorkerWage[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [viewOnly, setViewOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [statusFilter, setStatusFilter] = useState<string>("All");
    const [departmentFilter, setDepartmentFilter] = useState<string>("All");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [isListLoading, setIsListLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

    /**
     * When the list API returns a stale/wrong status label, we remember the last saved status per row.
     * Merged on every fetch so multiple "Submit" actions in a row all stay visible (refetch no longer wipes earlier rows).
     */
    const listStatusDisplayOverridesRef = useRef<Partial<Record<string, WorkerWageStatus>>>({});

    /** After create, match the new list row by form fingerprint so we can show Submitted before the list label catches up. */
    const pendingCreateStatusFingerprintRef = useRef<{
        status: WorkerWageStatus;
        wagePeriod: string;
        department: string;
        workerCategory: string;
        noOfWorkers: string;
        netWageAmount: string;
    } | null>(null);

    const [wagePeriodOptions, setWagePeriodOptions] = useState<DropdownOption[]>(() => {
        try {
            const cached = JSON.parse(localStorage.getItem("worker_payroll_wage_period_options") || "[]");
            return Array.isArray(cached) ? cached.filter((x: any) => Number(x?.id) > 0 && !!x?.name) : [];
        } catch {
            return [];
        }
    });
    const [locationOptions, setLocationOptions] = useState<DropdownOption[]>([]);
    const [departmentOptions, setDepartmentOptions] = useState<DropdownOption[]>([]);
    const [workcenterOptions, setWorkcenterOptions] = useState<DropdownOption[]>([]);
    const [operationOptions, setOperationOptions] = useState<DropdownOption[]>([]);
    const [workerCategoryOptions, setWorkerCategoryOptions] = useState<DropdownOption[]>([]);
    const [editingDetailIds, setEditingDetailIds] = useState<{
        worker_wage_period_id?: number;
        work_location_id?: number | null;
        department_id?: number | null;
        work_center_id?: number | null;
        operation_id?: number | null;
        worker_category_id?: number;
        status_id?: number;
    } | null>(null);

    // Form State
    const [formState, setFormState] = useState<{
        wagePeriod: string;
        location: string;
        department: string;
        workcenter: string;
        operation: string;
        workerCategory: string;
        noOfWorkers: string;
        netWageAmount: string;
    }>({
        wagePeriod: "",
        location: "",
        department: "",
        workcenter: "",
        operation: "",
        workerCategory: "",
        noOfWorkers: "",
        netWageAmount: ""
    });

    // Auto-calculation
    const totalWageAmount = useMemo(() => {
        const count = parseFloat(formState.noOfWorkers) || 0;
        const amount = parseFloat(formState.netWageAmount) || 0;
        return count * amount;
    }, [formState.noOfWorkers, formState.netWageAmount]);

    /** Matches handleSubmit checks: required wage period & category; workers > 0; net wage >= 0. */
    const isWorkerWageFormValid = useMemo(() => {
        if (!String(formState.wagePeriod || "").trim() || !String(formState.workerCategory || "").trim()) {
            return false;
        }
        const workersCount = Number(formState.noOfWorkers);
        const netWage = Number(formState.netWageAmount);
        if (!Number.isFinite(workersCount) || workersCount <= 0) return false;
        if (!Number.isFinite(netWage) || netWage < 0) return false;
        return true;
    }, [formState.wagePeriod, formState.workerCategory, formState.noOfWorkers, formState.netWageAmount]);

    const departmentsFromStore = useCommonStore((s) => s.departments);
    const locationsFromStore = useCommonStore((s) => s.locations);
    const workCategoriesFromStore = useCommonStore((s) => s.workCategories);
    const entityValuesFromStore = useCommonStore((s) => s.entityValues);
    const workerPayrollStatusesFromStore = useCommonStore((s) => s.workerPayrollStatuses);

    /** 
     * Dynamic mapping of status names to IDs from DB entity_values.
     * Aligned with user request to fetch from getentityvalues api.
     */
    const payrollStatusToId = useMemo(() => {
        const map: Record<string, number> = {};
        workerPayrollStatusesFromStore.forEach((s) => {
            const id = Number(s.id);
            const name = String(s.name || s.value_name || "").trim();
            if (!name) return;
            
            map[name] = id;
            
            // Map normalized labels to IDs for consistent filtering
            const lower = name.toLowerCase();
            if (lower.includes("paid")) map["Paid"] = id;
            else if (lower.includes("submit")) map["Submitted"] = id;
            else if (lower.includes("draft")) map["Draft"] = id;
        });

        // Fallbacks for safety aligned with Worker Payments
        if (!map["Draft"]) map["Draft"] = 1;
        if (!map["Submitted"]) map["Submitted"] = 300;
        if (!map["Paid"]) map["Paid"] = 301;
        return map;
    }, [workerPayrollStatusesFromStore]);

    const statusIdToPayrollStatus = (statusId?: number): WorkerWageStatus => {
        const sid = Number(statusId);
        const match = workerPayrollStatusesFromStore.find(s => Number(s.id) === sid);
        if (match) {
            const name = String(match.name || match.value_name || "").trim();
            const lower = name.toLowerCase();
            if (lower.includes("paid")) return "Paid Wages";
            if (lower.includes("submit")) return "Submitted Wages";
            if (lower.includes("draft")) return "Draft Wages";
            return "Draft Wages"; // Default for unknown names
        }

        // Hardcoded fallbacks aligned with Worker Payments
        if (sid === 301 || sid === 3) return "Paid Wages";
        if (sid === 300 || sid === 2) return "Submitted Wages";
        return "Draft Wages";
    };

    /**
     * Prefer numeric status_id when present (authoritative in DB). Some list payloads include a
     * stale or generic label; using label-first made submitted rows look like Draft.
     */
    const resolveListRowStatus = (r: any): WorkerWageStatus => {
        const sid = r.status_id;
        if (sid !== undefined && sid !== null && String(sid).trim() !== "") {
            return statusIdToPayrollStatus(Number(sid));
        }
        
        const label = String(r.status ?? r.Status ?? r.status_name ?? "").trim();
        if (label) {
            const value = label.toLowerCase();
            if (value.includes("paid")) return "Paid Wages";
            if (value.includes("submit")) return "Submitted Wages";
            if (value.includes("draft")) return "Draft Wages";
        }
        return "Draft Wages";
    };


    /** Same shape as toDropdownRecords for rows from login entity master (getentityvalues). */
    const entityRowsToDropdownOptions = (rows: any[]): DropdownOption[] =>
        (rows || [])
            .map((r: any) => ({
                id: Number(r.id),
                name: String(r.name || r.value_name || r.label || ""),
            }))
            .filter((r: DropdownOption) => Number.isFinite(r.id) && r.id > 0 && !!r.name);

    const statusOptions = useMemo(() => {
        const unique = new Set<string>();
        workerPayrollStatusesFromStore.forEach(s => {
            const name = String(s.name || s.value_name || "").toLowerCase();
            if (name.includes("paid")) unique.add("Paid");
            else if (name.includes("submit")) unique.add("Submitted");
            else if (name.includes("draft")) unique.add("Draft");
        });
        const result = Array.from(unique).sort();
        if (result.length > 0) return ["All", ...result];
        return ["All", "Draft", "Submitted", "Paid"];
    }, [workerPayrollStatusesFromStore]);

    const toDropdownRecords = (res: any): DropdownOption[] => {
        const records = Array.isArray(res?.data?.records) ? res.data.records : [];
        return records.map((r: any) => ({
            id: Number(r.id),
            name: String(r.name || r.value_name || r.label || ""),
        })).filter((r: DropdownOption) => Number.isFinite(r.id) && r.id > 0 && !!r.name);
    };

    const WORK_CATEGORY_ENTITY_TYPE_ID = 46;

    useEffect(() => {
        setDepartmentOptions(entityRowsToDropdownOptions(departmentsFromStore));
    }, [departmentsFromStore]);

    useEffect(() => {
        setLocationOptions(entityRowsToDropdownOptions(locationsFromStore));
    }, [locationsFromStore]);

    useEffect(() => {
        let rows = workCategoriesFromStore || [];
        if (rows.length === 0 && (entityValuesFromStore || []).length > 0) {
            rows = entityValuesFromStore.filter(
                (r: any) =>
                    isWorkCategoryEntityName(r.entity_type_name) ||
                    Number(r.entity_type_id) === WORK_CATEGORY_ENTITY_TYPE_ID
            );
        }
        setWorkerCategoryOptions(entityRowsToDropdownOptions(rows));
    }, [workCategoriesFromStore, entityValuesFromStore]);

    const assignedLocationIds = getAssignedIds("location");
    const assignedWorkcenterIds = getAssignedIds("workcenter");
    const assignedOperationIds = getAssignedIds("operation");

    const orderedLocationOptions = useMemo(
        () => prioritizeByAssigned(locationOptions, assignedLocationIds, (loc) => loc.id),
        [locationOptions, assignedLocationIds]
    );

    const orderedWorkcenterOptions = useMemo(
        () => prioritizeByAssigned(workcenterOptions, assignedWorkcenterIds, (wc) => wc.id),
        [workcenterOptions, assignedWorkcenterIds]
    );

    const orderedOperationOptions = useMemo(
        () => prioritizeByAssigned(operationOptions, assignedOperationIds, (op) => op.id),
        [operationOptions, assignedOperationIds]
    );

    const operationSelectOptions = useMemo((): SelectOption[] => {
        return orderedOperationOptions.map((op) => {
            const name = String(op.name || "").trim();
            const code =
                String(op.code || "").trim() || `OP${String(op.id).padStart(3, "0")}`;
            return {
                value: name,
                label: `${name} — ${code}`,
                primaryText: name,
                secondaryText: code,
            };
        });
    }, [orderedOperationOptions]);

    const nameForFirstAssigned = (
        options: DropdownOption[],
        assignedIds: string[]
    ): string => {
        if (!assignedIds.length || !options.length) return "";
        const ordered = prioritizeByAssigned(options, assignedIds, (o) => o.id);
        const firstId = getFirstAssignedMatch(
            assignedIds,
            ordered.map((o) => o.id)
        );
        if (!firstId) return "";
        return ordered.find((o) => String(o.id) === firstId)?.name ?? "";
    };

    const resolveOptionId = (options: DropdownOption[], selectedValue: string): number | undefined => {
        const raw = String(selectedValue || "").trim();
        if (!raw) return undefined;
        const normalized = raw.toLowerCase().replace(/\s+/g, " ").trim();
        const strict = options.find((o) => String(o.name).trim() === raw);
        if (strict) return strict.id;
        const normalizedMatch = options.find(
            (o) => String(o.name || "").toLowerCase().replace(/\s+/g, " ").trim() === normalized
        );
        if (normalizedMatch) return normalizedMatch.id;
        const fuzzy = options.find(
            (o) =>
                String(o.name || "").toLowerCase().replace(/\s+/g, "") ===
                normalized.replace(/\s+/g, "")
        );
        return fuzzy?.id;
    };

    const resolveIdWithApiFallback = async (
        selectedValue: string,
        currentOptions: DropdownOption[],
        fetcher: () => Promise<any>
    ): Promise<number | undefined> => {
        const localId = resolveOptionId(currentOptions, selectedValue);
        if (localId) return localId;
        if (!String(selectedValue || "").trim()) return undefined;
        try {
            const res = await fetcher();
            const fetchedOptions = toDropdownRecords(res);
            return resolveOptionId(fetchedOptions, selectedValue);
        } catch {
            return undefined;
        }
    };

    /** Listing toolbar: departments only (shared with form when it opens). */
    const fetchDepartmentsForListing = async () => {
        /*
        try {
            const res = await commonApi.getDepartments();
            setDepartmentOptions(toDropdownRecords(res));
        } catch {
            setDepartmentOptions([]);
        }
        */
    };

    /** Create/Edit dialog: locations, work centers, categories, operations, wage periods (not departments). */
    const fetchFormDropdowns = async () => {
        const load = async (fn: () => Promise<any>, setter: (data: DropdownOption[]) => void) => {
            try {
                const res = await fn();
                setter(toDropdownRecords(res));
            } catch {
                setter([]);
            }
        };

        void load(() => commonApi.getLocations(), (data) => {
            if (data.length > 0) setLocationOptions(data);
        });
        void load(() => commonApi.getWorkCenters(), setWorkcenterOptions);

        void (async () => {
            try {
                const masterRes = await operationsApi.getAll({ page: 1, limit: 1000, status: 1 });
                const records = Array.isArray(masterRes?.data?.records) ? masterRes.data.records : [];
                const mapped = records
                    .map((r: any) => ({
                        id: Number(r.id),
                        name: String(r.name || r.operation_name || "").trim(),
                        code: String(r.code || r.operation_code || "").trim(),
                    }))
                    .filter((r: DropdownOption) => Number.isFinite(r.id) && r.id > 0 && !!r.name);
                setOperationOptions(mapped);
            } catch {
                setOperationOptions([]);
            }
        })();

        try {
            const wageRes = await commonApi.getWagePeriods(47);
            const wagePeriods = toDropdownRecords(wageRes);
            if (wagePeriods.length > 0) {
                setWagePeriodOptions(wagePeriods);
                localStorage.setItem("worker_payroll_wage_period_options", JSON.stringify(wagePeriods));
            } else {
                const cached = JSON.parse(localStorage.getItem("worker_payroll_wage_period_options") || "[]");
                if (Array.isArray(cached) && cached.length > 0) setWagePeriodOptions(cached);
            }
        } catch {
            try {
                const cached = JSON.parse(localStorage.getItem("worker_payroll_wage_period_options") || "[]");
                if (Array.isArray(cached) && cached.length > 0) setWagePeriodOptions(cached);
            } catch {
                // ignore cache parse issues
            }
        }
    };

    const fetchWorkerPayrolls = async () => {
        setIsListLoading(true);
        try {
            const selectedDepartmentId = departmentFilter === "All"
                ? undefined
                : departmentOptions.find((d) => d.name === departmentFilter)?.id;
            const selectedStatusId = statusFilter === "All"
                ? undefined
                : payrollStatusToId[statusFilter === "Submitted" ? "Submitted" : statusFilter];

            const res = await workerPayrollApi.getList({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearchQuery || undefined,
                department_id: selectedDepartmentId,
                status_id: selectedStatusId,
                date: dateFilter ? format(dateFilter, "yyyy-MM-dd") : undefined,
            });

            if (res?.isSuccessful) {
                const records = Array.isArray(res?.data?.records) ? res.data.records : [];

                const baseRows: WorkerWage[] = records.map((r: any) => ({
                    id: String(r.id),
                    wagePeriod: String(r.worker_wage_period || r.period || "-"),
                    registerDate: String(
                        r.entry_date || r.register_date || new Date().toISOString().slice(0, 10)
                    ),
                    location: String(r.work_location_name || "-"),
                    department: String(r.department_name || "-"),
                    workcenter: String(r.work_center_name || "-"),
                    operation: String(r.operation_name || "-"),
                    workerCategory: String(r.worker_category_name || "-"),
                    noOfWorkers: Number(r.no_of_workers ?? 0),
                    netWageAmount: Number(r.net_wage_amount ?? 0),
                    totalWageAmount: Number(r.total_wage_amount ?? 0),
                    status: resolveListRowStatus(r),
                }));

                const pending = pendingCreateStatusFingerprintRef.current;
                if (pending) {
                    const hit = baseRows.find(
                        (w) =>
                            w.wagePeriod === pending.wagePeriod &&
                            w.department === pending.department &&
                            w.workerCategory === pending.workerCategory &&
                            w.noOfWorkers === Number(pending.noOfWorkers) &&
                            w.netWageAmount === Number(pending.netWageAmount)
                    );
                    if (hit) {
                        listStatusDisplayOverridesRef.current[hit.id] = pending.status;
                    }
                    pendingCreateStatusFingerprintRef.current = null;
                }

                const mapped: WorkerWage[] = baseRows.map((w) => {
                    const raw = records.find((x: any) => String(x.id) === w.id);
                    const apiStatus = raw ? resolveListRowStatus(raw) : w.status;
                    const o = listStatusDisplayOverridesRef.current[w.id];
                    if (o !== undefined) {
                        if (o === apiStatus) {
                            delete listStatusDisplayOverridesRef.current[w.id];
                            return { ...w, status: apiStatus };
                        }
                        return { ...w, status: o };
                    }
                    return { ...w, status: apiStatus };
                });

                setWages(mapped);
                setTotalItems(Number(res?.data?.pagination?.totalCount || mapped.length));
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to fetch worker payrolls.",
            });
        } finally {
            setIsListLoading(false);
        }
    };

    /*
    useEffect(() => {
        void fetchDepartmentsForListing();
    }, []);
    */

    useEffect(() => {
        if (isFormOpen) {
            void fetchFormDropdowns();
        }
    }, [isFormOpen]);

    // Auto-select assigned location, workcenter, and operation on create (same as My Request)
    useEffect(() => {
        if (!isFormOpen || editingId || viewOnly) return;

        setFormState((prev) => {
            let location = prev.location;
            let workcenter = prev.workcenter;
            let operation = prev.operation;

            if (!location) {
                const defaultLocation = nameForFirstAssigned(
                    orderedLocationOptions,
                    assignedLocationIds
                );
                if (defaultLocation) location = defaultLocation;
            }

            if (!workcenter) {
                const defaultWorkcenter = nameForFirstAssigned(
                    orderedWorkcenterOptions,
                    assignedWorkcenterIds
                );
                if (defaultWorkcenter) workcenter = defaultWorkcenter;
            }

            if (!operation) {
                const defaultOperation = nameForFirstAssigned(
                    orderedOperationOptions,
                    assignedOperationIds
                );
                if (defaultOperation) operation = defaultOperation;
            }

            if (
                location === prev.location &&
                workcenter === prev.workcenter &&
                operation === prev.operation
            ) {
                return prev;
            }

            return { ...prev, location, workcenter, operation };
        });
    }, [
        isFormOpen,
        editingId,
        viewOnly,
        assignedLocationIds,
        assignedWorkcenterIds,
        assignedOperationIds,
        orderedLocationOptions,
        orderedWorkcenterOptions,
        orderedOperationOptions,
    ]);

    useEffect(() => {
        void fetchWorkerPayrolls();
    }, [currentPage, itemsPerPage, debouncedSearchQuery, statusFilter, departmentFilter, dateFilter, departmentOptions.length]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery, statusFilter, departmentFilter, dateFilter]);

    // Handlers
    const resetForm = () => {
        setFormState({
            wagePeriod: "",
            location: "",
            department: "",
            workcenter: "",
            operation: "",
            workerCategory: "",
            noOfWorkers: "",
            netWageAmount: ""
        });
        setEditingId(null);
        setViewOnly(false);
        setEditingDetailIds(null);
    };

    const handleEdit = async (wage: WorkerWage, mode: "edit" | "view" = "edit") => {
        setEditingId(wage.id);
        setFormState({
            wagePeriod: wage.wagePeriod,
            location: wage.location,
            department: wage.department,
            workcenter: wage.workcenter,
            operation: wage.operation,
            workerCategory: wage.workerCategory,
            noOfWorkers: wage.noOfWorkers.toString(),
            netWageAmount: wage.netWageAmount.toString()
        });
        setViewOnly(mode === "view");
        setIsFormOpen(true);

        try {
            const detailRes = await workerPayrollApi.getById(Number(wage.id));
            if (!detailRes?.isSuccessful || !detailRes?.data) return;

            const detail = detailRes.data;
            const getNameById = (options: DropdownOption[], id?: number | null, fallback?: string) => {
                const option = options.find((o) => o.id === Number(id));
                return option?.name || String(fallback || "");
            };

            setFormState({
                wagePeriod: getNameById(wagePeriodOptions, detail.worker_wage_period_id, detail.worker_wage_period),
                location: getNameById(locationOptions, detail.work_location_id, detail.work_location_name),
                department: getNameById(departmentOptions, detail.department_id, detail.department_name),
                workcenter: getNameById(workcenterOptions, detail.work_center_id, detail.work_center_name),
                operation: getNameById(operationOptions, detail.operation_id, detail.operation_name),
                workerCategory: getNameById(workerCategoryOptions, detail.worker_category_id, detail.worker_category_name),
                noOfWorkers: String(detail.no_of_workers ?? wage.noOfWorkers ?? ""),
                netWageAmount: String(detail.net_wage_amount ?? wage.netWageAmount ?? ""),
            });
            setEditingDetailIds({
                worker_wage_period_id: Number(detail.worker_wage_period_id) || undefined,
                work_location_id: detail.work_location_id ?? null,
                department_id: detail.department_id ?? null,
                work_center_id: detail.work_center_id ?? null,
                operation_id: detail.operation_id ?? null,
                worker_category_id: Number(detail.worker_category_id) || undefined,
                status_id: Number(detail.status_id) || undefined,
            });
        } catch (error) {
            console.error("Failed to fetch worker payroll detail:", error);
        }
    };

    const handleSubmit = async (status: WorkerWageStatus) => {
        try {
            if (isSubmitting) return;
            setIsSubmitting(status);
            if (!formState.wagePeriod || !formState.workerCategory || !formState.noOfWorkers || !formState.netWageAmount) {
                toast({
                    title: "Validation Error",
                    description: "Please fill all required fields.",
                    variant: "destructive"
                });
                return;
            }

            const workersCount = Number(formState.noOfWorkers);
            const netWage = Number(formState.netWageAmount);
            if (!Number.isFinite(workersCount) || workersCount <= 0 || !Number.isFinite(netWage) || netWage < 0) {
                toast({
                    title: "Validation Error",
                    description: "Enter valid numeric values for workers and net wage.",
                    variant: "destructive",
                });
                return;
            }

            const recordIdForStatusPatch = editingId;

            if (editingId) {
            let wagePeriodId =
                resolveOptionId(wagePeriodOptions, formState.wagePeriod) ??
                editingDetailIds?.worker_wage_period_id;
            let companyId = user?.companyId || POST_API_FALLBACK_COMPANY_ID;
            const locationId = resolveOptionId(locationOptions, formState.location) ?? editingDetailIds?.work_location_id ?? undefined;
            const departmentId = resolveOptionId(departmentOptions, formState.department) ?? editingDetailIds?.department_id ?? undefined;
            const workCenterId = resolveOptionId(workcenterOptions, formState.workcenter) ?? editingDetailIds?.work_center_id ?? undefined;
            const operationId = resolveOptionId(operationOptions, formState.operation) ?? editingDetailIds?.operation_id ?? undefined;
            let workerCategoryId = resolveOptionId(workerCategoryOptions, formState.workerCategory) ?? editingDetailIds?.worker_category_id;
            const statusId = payrollStatusToId[status === "Submitted Wages" ? "Submitted" : status.replace(" Wages", "")];

            // Final safety: if text is selected but id match fails, use dropdown first option/default.
            if (!wagePeriodId) wagePeriodId = Number(wagePeriodOptions[0]?.id || 4);
            if (!workerCategoryId) workerCategoryId = Number(workerCategoryOptions[0]?.id || 127);
            if (formState.department && !departmentId) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please select a valid Department from dropdown." });
                return;
            }
            if (formState.workcenter && !workCenterId) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please select a valid Workcenter from dropdown." });
                return;
            }
            if (formState.operation && !operationId) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please select a valid Operation from dropdown." });
                return;
            }

            try {
                const res = await workerPayrollApi.update(Number(editingId), {
                    company_id: companyId,
                    worker_wage_period_id: wagePeriodId,
                    entry_date: format(new Date(), "yyyy-MM-dd"),
                    work_location_id: locationId ?? undefined,
                    department_id: departmentId ?? undefined,
                    work_center_id: workCenterId ?? undefined,
                    operation_id: operationId ?? undefined,
                    worker_category_id: workerCategoryId,
                    no_of_workers: workersCount,
                    net_wage_amount: netWage,
                    total_wage_amount: totalWageAmount,
                    status_id: statusId,
                });

                if (!res?.isSuccessful) {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: res?.message || "Failed to update worker payroll.",
                    });
                    return;
                }

                toast({
                    ...crudSuccessToast,
                    title: "Success",
                    description: res?.message || "Worker Wage updated successfully.",
                });
                if (recordIdForStatusPatch) {
                    listStatusDisplayOverridesRef.current[recordIdForStatusPatch] = status;
                }
                setIsFormOpen(false);
                resetForm();
                await fetchWorkerPayrolls();
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to update worker payroll.",
                });
                return;
            }
            } else {
                let wagePeriodId = resolveOptionId(wagePeriodOptions, formState.wagePeriod);
                let companyId = user?.companyId || POST_API_FALLBACK_COMPANY_ID;
                const locationId = resolveOptionId(locationOptions, formState.location);
                const departmentId = resolveOptionId(departmentOptions, formState.department);
                const workCenterId = resolveOptionId(workcenterOptions, formState.workcenter);
                const operationId = resolveOptionId(operationOptions, formState.operation);
                let workerCategoryId = resolveOptionId(workerCategoryOptions, formState.workerCategory);
                const statusId = payrollStatusToId[status === "Submitted Wages" ? "Submitted" : status.replace(" Wages", "")];

                // Final safety: if text is selected but id match fails, use dropdown first option/default.
                if (!wagePeriodId) wagePeriodId = Number(wagePeriodOptions[0]?.id || 4);
                if (!workerCategoryId) workerCategoryId = Number(workerCategoryOptions[0]?.id || 127);
                if (formState.department && !departmentId) {
                    toast({ variant: "destructive", title: "Validation Error", description: "Please select a valid Department from dropdown." });
                    return;
                }
                if (formState.workcenter && !workCenterId) {
                    toast({ variant: "destructive", title: "Validation Error", description: "Please select a valid Workcenter from dropdown." });
                    return;
                }
                if (formState.operation && !operationId) {
                    toast({ variant: "destructive", title: "Validation Error", description: "Please select a valid Operation from dropdown." });
                    return;
                }

            try {
                const res = await workerPayrollApi.create({
                    company_id: companyId,
                    worker_wage_period_id: wagePeriodId,
                    entry_date: format(new Date(), "yyyy-MM-dd"),
                    work_location_id: locationId || null,
                    department_id: departmentId || null,
                    work_center_id: workCenterId || null,
                    operation_id: operationId || null,
                    worker_category_id: workerCategoryId,
                    no_of_workers: workersCount,
                    net_wage_amount: netWage,
                    total_wage_amount: totalWageAmount,
                    status_id: statusId,
                });

                if (!res?.isSuccessful) {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: res?.message || "Failed to create worker payroll.",
                    });
                    return;
                }

                toast({
                    ...crudSuccessToast,
                    title: "Success",
                    description: res?.message || "Worker Wage created successfully.",
                });
                pendingCreateStatusFingerprintRef.current = {
                    status,
                    wagePeriod: formState.wagePeriod,
                    department: formState.department,
                    workerCategory: formState.workerCategory,
                    noOfWorkers: formState.noOfWorkers,
                    netWageAmount: formState.netWageAmount,
                };
                setIsFormOpen(false);
                resetForm();
                await fetchWorkerPayrolls();
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to create worker payroll.",
                });
                return;
            }
            }
        } catch (error: any) {
            console.error("Worker payroll submit runtime error:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error?.message || "Unexpected error while saving worker payroll.",
            });
        } finally {
            setIsSubmitting(null);
        }
    };

    const handleDelete = () => {
        if (!editingId) return;
        const deleteAction = async () => {
            try {
                setIsSubmitting("Deleting");
                const res = await workerPayrollApi.delete(Number(editingId));
                if (!res?.isSuccessful) {
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: res?.message || "Failed to delete worker payroll.",
                    });
                    return;
                }
                toast({
                    ...crudSuccessToast,
                    title: "Deleted",
                    description: res?.message || "Worker Wage record removed.",
                });
                delete listStatusDisplayOverridesRef.current[String(editingId)];
                await fetchWorkerPayrolls();
                setIsFormOpen(false);
                resetForm();
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to delete worker payroll.",
                });
            } finally {
                setIsSubmitting(null);
            }
        };
        deleteAction();
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedWages = wages;

    const currentWage = editingId ? wages.find(w => w.id === editingId) : null;
    const s = String(currentWage?.status || "").toLowerCase();
    const isDeletable = editingId && (s.includes("draft") || s.includes("submit")) && canDeletePermission("HRMS:Worker Payrolls");
    const showSaveDraft = (!editingId && canCreate("HRMS:Worker Payrolls")) || (editingId && canEdit("HRMS:Worker Payrolls") && s.includes("draft"));

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* Page Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Worker Payrolls</h1>
                <p className="text-muted-foreground">
                    Manage and track factory worker wages
                </p>
            </div>

            <AppListToolbar
                search={{
                    value: searchQuery,
                    onChange: setSearchQuery,
                    placeholder: "Search employees..."
                }}
                filters={[
                    {
                        type: 'select',
                        label: 'Department',
                        value: departmentFilter,
                        options: ["All", ...departmentOptions.map((d) => d.name)],
                        onChange: setDepartmentFilter,
                        searchable: true
                    },
                    {
                        type: 'date',
                        label: 'Date',
                        value: dateFilter ? format(dateFilter, 'yyyy-MM-dd') : "",
                        onChange: (val) => setDateFilter(val ? new Date(val) : undefined)
                    },
                    {
                        type: 'select',
                        label: 'Status',
                        value: statusFilter,
                        options: statusOptions,
                        onChange: setStatusFilter,
                        searchable: true
                    }
                ]}
                actions={canCreate("HRMS:Worker Payrolls") ? [
                    {
                        label: 'Create Wage',
                        icon: <Plus className="mr-2 h-4 w-4" />,
                        onClick: () => {
                            resetForm();
                            setIsFormOpen(true);
                        },
                        variant: 'default'
                    }
                ] : []}
            />

            {/* Workers Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Wage Period</TableHead>
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Register Date</TableHead>
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Location</TableHead>
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Department</TableHead>
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">No of workers</TableHead>
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Total Net Wage</TableHead>
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-center w-[100px] text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isListLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm text-muted-foreground">Loading...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedWages.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                            No worker payroll records found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedWages.map((wage) => {
                                        const s = String(wage.status || "").toLowerCase();
                                        const isDraft = s.includes("draft");
                                        const isSubmitted = s.includes("submit") || s.includes("post");
                                        const isPaid = s.includes("paid") || s.includes("pay");

                                        return (
                                            <TableRow key={wage.id} className="hover:bg-muted/50 transition-colors border-b">
                                                <TableCell className="font-mono text-xs font-semibold py-3">{wage.wagePeriod}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{format(new Date(wage.registerDate), "dd MMM yyyy")}</TableCell>
                                                <TableCell className="text-xs">{wage.location || "-"}</TableCell>
                                                <TableCell className="text-xs">{wage.department || "-"}</TableCell>
                                                <TableCell className="text-center font-medium text-xs font-mono">{wage.noOfWorkers}</TableCell>
                                                <TableCell className="text-right font-bold text-xs font-mono">{CURRENCY_SYMBOL}{wage.totalWageAmount.toLocaleString()}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border-2",
                                                            isDraft ? "bg-muted/80 text-muted-foreground border-muted-foreground/30" :
                                                                isSubmitted ? "bg-blue-50 text-blue-600 border-blue-200" :
                                                                    isPaid ? "bg-emerald-50 text-emerald-600 border-emerald-200" : 
                                                                    "bg-amber-50 text-amber-600 border-amber-200"
                                                        )}
                                                    >
                                                        {wage.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <TableActionButtons
                                                        onView={() => handleEdit(wage, "view")}
                                                        onEdit={!isPaid && canEdit("HRMS:Worker Payrolls") ? () => handleEdit(wage) : undefined}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {!isListLoading && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            showRowsPerPage={true}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Dialog Form */}
            <Dialog open={isFormOpen} onOpenChange={(open) => {
                setIsFormOpen(open);
                if (!open) resetForm();
            }}>
                <DialogContent className="w-[95%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl md:min-h-[70vh] max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="border-b pb-4 mb-6 space-y-2">
                        <DialogTitle className="text-xl">
                            {viewOnly ? "View Worker Wage Details" : editingId ? "Edit Worker Wage Entry" : "Create New Worker Wage"}
                        </DialogTitle>
                        <DialogDescription>
                            Configure worker wage parameters and calculate totals.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-6 py-4">
                        <SearchableSelect
                            label="Wage Period"
                            required
                            value={formState.wagePeriod}
                            options={wagePeriodOptions.map((p) => p.name)}
                            onChange={(val) => setFormState(prev => ({ ...prev, wagePeriod: val }))}
                            disabled={viewOnly}
                            placeholder={wagePeriodOptions.length === 0 ? "Loading wage periods..." : "Select Wage Period"}
                        />

                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">Entry Date</Label>
                            <Input value={format(new Date(), "dd-MM-yyyy")} readOnly className="bg-muted h-10 border-muted-foreground/20 pointer-events-none" />
                        </div>

                        <SearchableSelect
                            label="Location"
                            value={formState.location}
                            options={
                                orderedLocationOptions.length > 0
                                    ? orderedLocationOptions.map((l) => l.name)
                                    : mockLocations.map((l) => l.name)
                            }
                            onChange={(val) => setFormState(prev => ({ ...prev, location: val }))}
                            disabled={viewOnly}
                            placeholder={
                                orderedLocationOptions.length === 0
                                    ? "Loading locations..."
                                    : "Select Location"
                            }
                        />

                        <SearchableSelect
                            label="Department"
                            value={formState.department}
                            options={departmentOptions.map((d) => d.name)}
                            onChange={(val) => setFormState(prev => ({ ...prev, department: val }))}
                            disabled={viewOnly}
                            placeholder={departmentOptions.length === 0 ? "Loading departments..." : "Select Department"}
                        />

                        <SearchableSelect
                            label="Workcenter"
                            value={formState.workcenter}
                            options={orderedWorkcenterOptions.map((wc) => wc.name)}
                            onChange={(val) => setFormState(prev => ({ ...prev, workcenter: val }))}
                            disabled={viewOnly}
                            placeholder={orderedWorkcenterOptions.length === 0 ? "Loading workcenters..." : "Select Workcenter"}
                        />

                        <div className="md:col-span-2">
                            <SearchableSelect
                                label="Operation"
                                value={formState.operation}
                                options={operationSelectOptions}
                                onChange={(val) => setFormState(prev => ({ ...prev, operation: val }))}
                                disabled={viewOnly}
                                placeholder={operationSelectOptions.length === 0 ? "Loading operations..." : "Select Operation"}
                                showSelectedTitle
                                selectedPrimaryLineClamp={2}
                                listClassName="max-h-[220px]"
                            />
                        </div>

                        <SearchableSelect
                            label="Worker Category"
                            required
                            value={formState.workerCategory}
                            options={workerCategoryOptions.length > 0 ? workerCategoryOptions.map((c) => c.name) : ["Helper", "Packaging", "Assembler", "Solderer"]}
                            onChange={(val) => setFormState(prev => ({ ...prev, workerCategory: val }))}
                            disabled={viewOnly}
                        />

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">No of Workers <span className="text-destructive">*</span></Label>
                            <Input
                                type="number"
                                value={formState.noOfWorkers}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val.length > 4) return;
                                    setFormState(prev => ({ ...prev, noOfWorkers: val }));
                                }}
                                disabled={viewOnly}
                                placeholder="Enter count"
                                className="h-10 border-muted-foreground/20"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Net Wage Amount <span className="text-destructive">*</span></Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{CURRENCY_SYMBOL}</span>
                                <Input
                                    type="number"
                                    value={formState.netWageAmount}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        // Restrict integer part to 8 digits
                                        const integerPart = val.split('.')[0];
                                        if (integerPart.length > 8) return;
                                        setFormState(prev => ({ ...prev, netWageAmount: val }));
                                    }}
                                    disabled={viewOnly}
                                    placeholder="Enter amount"
                                    className="pl-12 h-10 border-muted-foreground/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 md:col-span-2 border-t pt-5 mt-2">
                            <Label className="text-sm font-semibold text-primary">Total Wage Amount</Label>
                            <div className="text-2xl font-bold text-primary px-3 py-2 bg-primary/5 rounded-md border border-primary/20">
                                {CURRENCY_SYMBOL}{totalWageAmount.toLocaleString()}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-6 mt-6 flex justify-between items-center w-full gap-4">
                        <div className="flex-1">
                            {isDeletable && !viewOnly && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="h-10">
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently remove this wage record.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDelete} loading={isSubmitting === "Deleting"} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>

                        {!viewOnly ? (
                            <div className="flex gap-3">
                                {showSaveDraft && (
                                    <Button
                                        variant="outline"
                                        loading={isSubmitting === "Draft Wages"}
                                        disabled={!!isSubmitting || !isWorkerWageFormValid}
                                        onClick={() => handleSubmit("Draft Wages")}
                                        className={cn(
                                            "h-10 border-amber-300 text-amber-700 hover:bg-amber-50",
                                            saveActionDisabledClass
                                        )}
                                    >
                                        <Save className="mr-2 h-4 w-4" /> Save as Draft
                                    </Button>
                                )}
                                {showSaveDraft && (
                                    <Button
                                        loading={isSubmitting === "Submitted Wages"}
                                        disabled={!!isSubmitting || !isWorkerWageFormValid}
                                        onClick={() => handleSubmit("Submitted Wages")}
                                        className={cn(
                                            "h-10 bg-blue-600 text-primary-foreground hover:bg-blue-700",
                                            saveActionDisabledClass
                                        )}  
                                    >
                                        <Send className="mr-2 h-4 w-4" /> Submit Wages
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Close</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
