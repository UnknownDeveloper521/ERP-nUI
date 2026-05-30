import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
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
    CommandInput,
    CommandInputBorderless,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
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
import { Switch } from "@/components/ui/switch";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Plus, Edit, ArrowLeft, Trash2, Check, ChevronsUpDown, Info, ChevronLeft, ChevronRight, Eye, Pencil, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useCommonStore } from "@/store/commonStore";
import { DatePicker } from "@/components/shared/DatePicker";
import { format, parseISO, isValid as isValidDate } from "date-fns";
import { commonApi, employeeSalaryApi, salaryStructureApi } from "@/lib/api";
import { CURRENCY_SYMBOL } from "@/config/appConfig";
import {
    upsertSalaryAssignment,
    removeSalaryAssignment,
    type Assignment,
    type SalaryComponent,
    type SalaryRule,
    type ComputedRow,
    type CalcMode,
    type Category
} from "@/lib/salaryAssignmentSharedData";

import { useDebounce } from "@/hooks/useDebounce";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "../Unauthorized";

// --- Types & Constants ---
// Types are now imported from shared data store

interface SalaryStructure {
    id: string;
    name: string;
    rules: SalaryRule[];
}

interface Employee {
    id: string;
    code: string;
    name: string;
    department: string;
    designation: string;
    joiningDate: string;
}

const normalizeText = (value?: string) => String(value || "").trim().toLowerCase();

const roundToTwo = (num: number) => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

const mapNameToMode = (name?: string): CalcMode | null => {
    const n = normalizeText(name);
    if (!n) return null;
    if (n.includes("ctc")) return "PCT_CTC";
    if (n.includes("basic")) return "PCT_BASIC";
    if (n.includes("remain")) return "REMAINING";
    if (n.includes("fixed") || n.includes("flat")) return "FLAT";
    return null;
};

/** Salary structure / assignment APIs may use snake_case, camelCase, or PascalCase for the type label. */
const getLineCalculationTypeLabel = (line: any): string | undefined => {
    if (!line || typeof line !== "object") return undefined;
    const v =
        line.calculation_type ??
        line.calculation_type_name ??
        line.calculationType ??
        line.CalculationType;
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

const isBasicComponent = (row: { name?: string; componentCode?: string }) => {
    const n = normalizeText(row.name);
    const c = normalizeText(row.componentCode);
    return n.includes("basic") || c === "basic" || c === "basic_salary";
};

const isSpecialComponent = (row: { name?: string; componentCode?: string; calcMode?: string }, specialPoolId?: string) => {
    const n = normalizeText(row.name);
    const c = normalizeText(row.componentCode);
    const isModeMatch = row.calcMode === "REMAINING";
    const isIdMatch = specialPoolId && (c === specialPoolId || String(c) === String(specialPoolId));
    return n.includes("special") || c.includes("special") || isModeMatch || isIdMatch;
};

/** Backend stores NULL for custom assignments; 0 or invalid ids are treated as custom in the UI. */
const hasSalaryStructureId = (raw: unknown): boolean => {
    if (raw === null || raw === undefined || raw === "") return false;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0;
};

/** Custom assignment: explicit mode or no valid FK (covers new form default before a structure is picked). */
const isCustomStructureAssignment = (
    mode: Assignment["structureMode"] | undefined,
    structureId: string | undefined
): boolean => mode === "custom" || !hasSalaryStructureId(structureId);

/** Custom structure starter: Special Allowance only — Basic is added via "+ Add Earning" like other components. */
const getCustomStarterEarnings = (earningsPool: SalaryComponent[]): ComputedRow[] => {
    const specialComponent = earningsPool.find((c) => normalizeText(c.name).includes("special"));
    return [
        {
            componentCode: specialComponent?.code || "FIXED",
            name: specialComponent?.name || "Special Allowance",
            category: "earning",
            calcMode: "REMAINING",
            value: 0,
            isBase: false,
            monthlyAmount: 0,
            annualAmount: 0,
        },
    ];
};

/** Hides native browser up/down spinners on number inputs (styling only). */
const noNumberSpinnerClass =
    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/** Visible default border for salary amount fields (matches Annual CTC; avoids invisible `border-input` on white). */
const salaryAmountInputBorderClass =
    "border border-gray-300 bg-background shadow-sm focus-visible:border-gray-400";

type SanitizedDecimalInput = { value: number; display: string };

/** Stable display when not actively editing a draft (avoid 10.300000004 from floats). */
const formatTwoDecimalForInput = (n: number): string => {
    if (!Number.isFinite(n) || n === 0) return "";
    return (Math.round(n * 100) / 100).toString();
};

/**
 * % of CTC / % of Basic: digits + one `.`, up to 2 decimal places. Max 100.
 * `display` keeps a trailing `.` while typing (e.g. "10.") so controlled inputs don't strip it.
 */
const sanitizePercentTwoDecimalsInput = (raw: string): SanitizedDecimalInput => {
    const cleaned = raw.replace(/[^\d.]/g, "");
    if (!cleaned) return { value: 0, display: "" };
    const firstDot = cleaned.indexOf(".");
    const intRaw = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot);
    const decRaw = firstDot === -1 ? "" : cleaned.slice(firstDot + 1).replace(/\./g, "");
    const intPart = intRaw.replace(/\D/g, "").slice(0, 3);
    const decPart = decRaw.replace(/\D/g, "").slice(0, 2);
    const trailingDot = firstDot !== -1 && decPart.length === 0 && decRaw.length === 0;
    const s = decPart.length > 0 ? `${intPart || "0"}.${decPart}` : intPart;
    const n = parseFloat(s || "0");
    const value = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
    let display: string;
    if (trailingDot) display = `${intPart || "0"}.`;
    else if (decPart.length > 0) display = `${intPart || "0"}.${decPart}`;
    else display = intPart;
    return { value, display };
};

/** Max integer digits for fixed monthly amounts (earnings/deductions). */
const MAX_FIXED_AMOUNT_INTEGER_DIGITS = 11;

/**
 * Fixed monthly amount: up to 11 integer digits + up to 2 decimal places.
 * `display` preserves "10." while typing.
 */
const sanitizeFixedAmountTwoDecimalsInput = (raw: string): SanitizedDecimalInput => {
    const cleaned = raw.replace(/[^\d.]/g, "");
    if (!cleaned) return { value: 0, display: "" };
    const firstDot = cleaned.indexOf(".");
    const intRaw = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot);
    const decRaw = firstDot === -1 ? "" : cleaned.slice(firstDot + 1).replace(/\./g, "");
    const intPart = intRaw.replace(/\D/g, "").slice(0, MAX_FIXED_AMOUNT_INTEGER_DIGITS);
    const decPart = decRaw.replace(/\D/g, "").slice(0, 2);
    const trailingDot = firstDot !== -1 && decPart.length === 0 && decRaw.length === 0;
    const s = decPart.length > 0 ? `${intPart || "0"}.${decPart}` : intPart;
    const n = parseFloat(s || "0");
    const value = Number.isFinite(n) ? Math.max(0, n) : 0;
    let display: string;
    if (trailingDot) display = `${intPart || "0"}.`;
    else if (decPart.length > 0) display = `${intPart || "0"}.${decPart}`;
    else display = intPart;
    return { value, display };
};

/** Annual CTC: whole amount only; max 11 integer digits. */
const MAX_ANNUAL_CTC_DIGITS = 11;

const sanitizeAnnualCtcInput = (raw: string): number => {
    const intPart = raw.split(".")[0] ?? raw;
    const digits = intPart.replace(/\D/g, "").slice(0, MAX_ANNUAL_CTC_DIGITS);
    if (!digits) return 0;
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : 0;
};

/** Unique Command value when multiple options share the same display label. */
const toCommandItemValue = (label: string, uniqueId: string | number) => `${label}|${uniqueId}`;

const commandLabelFilter = (value: string, search: string) => {
    const label = value.split("|")[0] ?? value;
    return label.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
};

export default function AssignEmployeeSalary() {
    const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
    const permissionModule = "HR_Setup:Assign Employee Salary";

    if (!isMenuVisible(permissionModule)) {
        return <Unauthorized />;
    }

    // --- Main State ---

    const [availableStructures, setAvailableStructures] = useState<SalaryStructure[]>([]);
    const [availableComponents, setAvailableComponents] = useState<{ earnings: SalaryComponent[]; deductions: SalaryComponent[] }>({
        earnings: [],
        deductions: [],
    });

    const [viewMode, setViewMode] = useState<"list" | "form">("list");
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
    const [designations, setDesignations] = useState<{ id: number; name: string }[]>([]);
    const [calculationTypes, setCalculationTypes] = useState<{ id: number; name: string }[]>([]);
    const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<Set<string>>(new Set());

    // Store-based master data
    const storeDepartments = useCommonStore((state) => state.departments);
    const storeDesignations = useCommonStore((state) => state.designations);
    const storeCalculationTypes = useCommonStore((state) => state.calculationTypes);
    const isStoreLoaded = useCommonStore((state) => state.isLoaded);

    // Sync store data to local state for initial lists
    useEffect(() => {
        if (isStoreLoaded) {
            setDepartments(storeDepartments.map(d => ({ id: Number(d.id), name: String(d.name || d.department_name || "") })));
            setDesignations(storeDesignations.map(d => ({ id: Number(d.id), name: String(d.name || "") })));
            setCalculationTypes(storeCalculationTypes.map(c => ({ id: Number(c.id), name: String(c.name || "") })));
        }
    }, [isStoreLoaded, storeDepartments, storeDesignations, storeCalculationTypes]);
    const { toast } = useToast();

    // --- Routing Hooks ---
    const [, setLocation] = useLocation();
    const [matchNew] = useRoute("/hr-setup/assign-employee-salary/new");
    const [matchEdit, params] = useRoute("/hr-setup/assign-employee-salary/:id");
    const searchString = useSearch();

    const loadAssignments = async () => {
        setIsListLoading(true);
        try {
            const response = await employeeSalaryApi.getList({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearchTerm || undefined,
            });
            const records = response?.data?.records || [];
            const mapped: Assignment[] = records.map((r: any) => {
                const nameStr = String(r.salary_structure_name || "").trim();
                const idOk = hasSalaryStructureId(r.salary_structure_id);
                const isCustomName =
                    !nameStr || /^custom(\s+structure)?$/i.test(nameStr) || nameStr.toLowerCase() === "custom";
                /** Treat as template structure if we have a valid FK *or* a non-custom name from API (some responses omit/null the id). */
                const useStructureRow = idOk || (!!nameStr && !isCustomName);
                return {
                    id: String(r.id),
                    employeeId: String(r.employee_id),
                    employeeName: String(r.employee_name || ""),
                    employeeCode: String(r.employee_code || ""),
                    department: String(r.department_name || ""),
                    designation: String(r.designation_name || ""),
                    structureMode: useStructureRow ? "structure" : "custom",
                    structureId: idOk ? String(r.salary_structure_id) : undefined,
                    structureName: useStructureRow
                        ? nameStr || undefined
                        : nameStr || "Custom Structure",
                    annualCTC: Number(r.annual_ctc || 0),
                    monthlyCTC: Math.round(Number(r.annual_ctc || 0) / 12),
                    effectiveFrom: String(r.effective_from || ""),
                    status: Number(r.status) === 1 ? "active" : "inactive",
                    earnings: [],
                    deductions: [],
                };
            });
            setAssignments(mapped);
            setTotalItems(response?.data?.pagination?.totalCount || mapped.length);
            setServerTotalPages(response?.data?.pagination?.totalPages || Math.ceil((response?.data?.pagination?.totalCount || mapped.length) / itemsPerPage));
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load employee salaries" });
        } finally {
            setIsListLoading(false);
        }
    };

    const loadCommonDropdowns = async () => {
        try {
            /*
            const [deptRes, desigRes, employeesRes, structuresRes, earningsRes, deductionsRes, calcTypesRes] = await Promise.all([
                commonApi.getDepartments(),
                commonApi.getDesignations(1),
                commonApi.getEmployees(),
                commonApi.getSalaryStructures(1),
                commonApi.getEarningComponents({ status: 1 }),
                commonApi.getDeductions(1),
                commonApi.getCalculationTypes(1),
            ]);
            */
            const [employeesRes, structuresRes, earningsRes, deductionsRes] = await Promise.all([
                commonApi.getEmployeesWithoutSalary(),
                commonApi.getSalaryStructures(1),
                commonApi.getEarningComponents({ status: 1 }),
                commonApi.getDeductions(1),
            ]);

            /*
            setDepartments((deptRes?.data?.records || []).map((d: any) => ({ id: Number(d.id), name: String(d.name || d.department_name || "") })).filter((d: any) => d.id && d.name));
            setDesignations((desigRes?.data?.records || []).map((d: any) => ({ id: Number(d.id), name: String(d.name || "") })).filter((d: any) => d.id && d.name));
            */
            setEmployees((employeesRes?.data?.records || []).map((e: any) => ({
                id: String(e.id),
                code: String(e.code || ""),
                name: String(e.employee_name || ""),
                department: String(e.department_name || ""),
                designation: String(e.designation_name || ""),
                joiningDate: "",
            })));
            setAvailableStructures((structuresRes?.data?.records || []).map((s: any) => ({
                id: String(s.id),
                name: String(s.name || ""),
                rules: [],
            })));
            setAvailableComponents({
                earnings: (earningsRes?.data?.records || []).map((c: any) => ({ code: String(c.id), name: String(c.name || ""), category: "earning" as Category })),
                deductions: (deductionsRes?.data?.records || []).map((c: any) => ({ code: String(c.id), name: String(c.name || ""), category: "deduction" as Category })),
            });
            /*
            setCalculationTypes((calcTypesRes?.data?.records || []).map((c: any) => ({ id: Number(c.id), name: String(c.name || "") })).filter((c: any) => d.id && d.name));
            */

            // Fetch a larger sample of assignments to track which employees are already assigned
            const assignmentsRes = await employeeSalaryApi.getList({ limit: 1000 });
            const assignedIds = new Set<string>((assignmentsRes?.data?.records || []).map((r: any) => String(r.employee_id)));
            setAssignedEmployeeIds(assignedIds);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load dropdowns" });
        }
    };

    // --- List View State ---
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [deptFilter, setDeptFilter] = useState("All Departments");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [serverTotalPages, setServerTotalPages] = useState(0);

    // --- Form View State ---
    const [formState, setFormState] = useState<Partial<Assignment>>({});
    const [isEditMode, setIsEditMode] = useState(false); // Are we editing an existing assignment?
    const [earningsRows, setEarningsRows] = useState<ComputedRow[]>([]);
    const [deductionsRows, setDeductionsRows] = useState<ComputedRow[]>([]);
    /** Preserves partial typing (e.g. "10.") in controlled salary inputs until blur. */
    const [salaryNumericDrafts, setSalaryNumericDrafts] = useState<Record<string, string>>({});

    // Dropdown States
    const [openEmpCombo, setOpenEmpCombo] = useState(false);
    const [openDeptCombo, setOpenDeptCombo] = useState(false);
    const [openDesigCombo, setOpenDesigCombo] = useState(false);
    const [openStructureDropdown, setOpenStructureDropdown] = useState(false);
    const [openAddEarning, setOpenAddEarning] = useState(false);
    const [openAddDeduction, setOpenAddDeduction] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isListLoading, setIsListLoading] = useState(false);
    // Ref to track detailed fetch to avoid duplicate API calls
    const lastFetchedIdRef = useRef<string | null>(null);

    useEffect(() => {
        setSalaryNumericDrafts({});
    }, [viewMode, formState.id]);

    useEffect(() => {
        const loadFilteredEmployeesAndDesignations = async () => {
            try {
                const selectedDepartment = departments.find((d) => d.name === formState.department);
                const selectedDesignation = designations.find((d) => d.name === formState.designation);

                const [desigRes, employeeRes] = await Promise.all([
                    commonApi.getDesignations(1, selectedDepartment?.id),
                    commonApi.getEmployeesWithoutSalary({
                        designation_id: selectedDesignation?.id,
                        department_id: selectedDepartment?.id,
                        search: searchTerm
                    }),
                ]);

                setDesignations((desigRes?.data?.records || []).map((d: any) => ({ id: Number(d.id), name: String(d.name || "") })));
                setEmployees((employeeRes?.data?.records || []).map((e: any) => ({
                    id: String(e.id),
                    code: String(e.code || ""),
                    name: String(e.employee_name || ""),
                    department: String(e.department_name || formState.department || ""),
                    designation: String(e.designation_name || formState.designation || ""),
                    joiningDate: "",
                })));
            } catch {
                // Keep existing dropdown data if filter-specific call fails.
            }
        };

        if (formState.department || formState.designation) {
            void loadFilteredEmployeesAndDesignations();
        }
    }, [formState.department, formState.designation, departments]);

    // --- Sync Route to View State ---
    useEffect(() => {
        const routeId = params?.id;

        if (matchNew) {
            // New Assignment Mode
            if (viewMode !== "form" || isEditMode) {
                // Check for pre-fill query param
                const queryParams = new URLSearchParams(searchString);
                const prefillEmpId = queryParams.get("empId");
                let prefillData = {};

                if (prefillEmpId) {
                    const emp = employees.find(e => e.id === prefillEmpId);
                    if (emp) {
                        prefillData = {
                            employeeId: emp.id,
                            employeeName: emp.name,
                            employeeCode: emp.code, // Ensure code is passed if needed
                            department: emp.department,
                            designation: emp.designation
                        };
                    }
                }

                setFormState({
                    structureMode: "custom",
                    status: "active",
                    effectiveFrom: format(new Date(), "yyyy-MM-dd"),
                    annualCTC: 0,
                    monthlyCTC: 0,
                    ...prefillData
                });
                setEarningsRows(getCustomStarterEarnings(availableComponents.earnings));
                setDeductionsRows([]);
                setIsEditMode(false);
                setViewMode("form");
            }
        } else if (matchEdit && routeId) {
            // Edit Assignment Mode: Only initialize if not already for this ID
            if (viewMode !== "form" || formState.id !== routeId) {
                const assignment = assignments.find(a => a.id === routeId);
                if (assignment) {
                    const emp = employees.find(e => e.id === assignment.employeeId);
                    setFormState(prev => ({
                        ...prev,
                        ...assignment,
                        id: routeId,
                        employeeId: assignment.employeeId,
                        // Fallback to employee master data if list API didn't provide these
                        department: assignment.department || emp?.department || "",
                        designation: assignment.designation || emp?.designation || ""
                    }));

                    if (lastFetchedIdRef.current !== routeId && availableComponents.earnings.length > 0 && calculationTypes.length > 0) {
                        void fetchAssignmentDetails(routeId, assignment.employeeName, assignment.employeeCode, assignment.department, assignment.designation);
                    }

                    setIsEditMode(true);
                    setViewMode("form");
                } else if (lastFetchedIdRef.current !== routeId && availableComponents.earnings.length > 0 && calculationTypes.length > 0) {
                    // Deep-link case: set a loading state or just fetch
                    void fetchAssignmentDetails(routeId);
                }
            }
        } else {
            // Reset fetch ref when leaving edit mode
            lastFetchedIdRef.current = null;
            // List Mode
            if (viewMode !== "list") {
                setViewMode("list");
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchNew, matchEdit, params?.id, assignments, viewMode, isEditMode, formState.id, availableComponents.earnings.length, calculationTypes.length]);

    useEffect(() => {
        void loadCommonDropdowns();
    }, []);

    useEffect(() => {
        if (viewMode === "list") {
            void loadAssignments();
        }
    }, [viewMode, currentPage, itemsPerPage, debouncedSearchTerm]);

    // Reset pagination to first page when search or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, deptFilter]);

    const salaryNumberInputsRootRef = useRef<HTMLDivElement>(null);

    /** Block mouse wheel from stepping `<input type="number">` values (requires non-passive listener). */
    useEffect(() => {
        if (viewMode !== "form") return;
        const root = salaryNumberInputsRootRef.current;
        if (!root) return;
        const onWheel = (e: WheelEvent) => {
            const t = e.target;
            if (t instanceof HTMLInputElement && t.type === "number") {
                e.preventDefault();
            }
        };
        root.addEventListener("wheel", onWheel, { passive: false, capture: true });
        return () => root.removeEventListener("wheel", onWheel, { capture: true });
    }, [viewMode]);

    // --- Actions: List View ---

    // --- Actions: List View ---

    // Show ONLY employees who have salary assignments
    // Do not show employees without assignments in the listing
    const allEmployeeAssignments = React.useMemo(() => {
        // Return only assignments that exist, not all employees
        return assignments;
    }, [assignments]);

    const filteredAssignments = allEmployeeAssignments
        .filter(a => {
            const matchesSearch = a.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                a.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesDept = deptFilter === "All Departments" || a.department === deptFilter;
            return matchesSearch && matchesDept;
        })
        .sort((a, b) => {
            // Sort by status: inactive first, then active
            if (a.status !== 'active' && b.status === 'active') return -1;
            if (a.status === 'active' && b.status !== 'active') return 1;
            // If same status, sort by employee name
            return a.employeeName.localeCompare(b.employeeName);
        });

    const paginatedAssignments = filteredAssignments;
    const totalPages = serverTotalPages;

    const handleCreateNew = (employeeId?: string) => {
        // Refresh employees list when opening the creation form
        void loadCommonDropdowns();
        
        if (employeeId) {
            setLocation(`/hr-setup/assign-employee-salary/new?empId=${employeeId}`);
        } else {
            setLocation("/hr-setup/assign-employee-salary/new");
        }
    };

    /**
     * Fetches the detailed components (earnings/deductions) for a specific assignment ID.
     * Prevents duplicate calls via lastFetchedIdRef.
     */
    const fetchAssignmentDetails = async (id: string, name?: string, code?: string, dept?: string, desig?: string) => {
        if (lastFetchedIdRef.current === id) return;

        try {
            // Clear existing state before fetching to prevent ghost data
            setEarningsRows([]);
            setDeductionsRows([]);

            const response = await employeeSalaryApi.getById(Number(id));
            const data = response?.data;
            if (!data) {
                toast({ variant: "destructive", title: "Error", description: "Salary assignment not found" });
                return;
            }

            // Cross-reference with Salary Structure if present to recover component IDs/names
            let structureLines: any[] = [];
            if (hasSalaryStructureId(data.salary_structure_id)) {
                try {
                    const structureRes = await salaryStructureApi.getOne(Number(data.salary_structure_id));
                    const lines = structureRes?.data?.lines;
                    structureLines = Array.isArray(lines) && lines.length > 0 ? lines : [];
                    if (structureLines.length === 0 && Array.isArray(structureRes?.data?.earnings)) {
                        structureLines = structureRes.data.earnings;
                    }
                } catch {
                    // Non-blocking: will fall back to basic ID/name mapping
                }
            }

            lastFetchedIdRef.current = id;

            const earningNameById = new Map(availableComponents.earnings.map((c) => [Number(c.code), c.name]));
            const deductionNameById = new Map(availableComponents.deductions.map((c) => [Number(c.code), c.name]));
            const calcModeById = new Map<number, CalcMode>();
            for (const ct of calculationTypes) {
                const mode = mapNameToMode(ct.name);
                if (mode) calcModeById.set(ct.id, mode);
            }

            const specialComponent = availableComponents.earnings.find((c) => normalizeText(c.name).includes("special"));
            const specialPoolId = specialComponent?.code;

            const mappedEarnings: ComputedRow[] = (data.earnings || []).map((e: any, index: number) => {
                // Resolution Strategy: 
                // 1. Check for salary_component_id from API (best)
                // 2. Try to match with structure rules (robust fallback for structure-based assignments)
                // 3. Fall back to e.id and generic "Earning"

                let salaryComponentId = Number(e.salary_component_id || 0);
                let matchedByStructure = false;

                // If ID is missing, try to find it in the structure rules by calculation id and value
                if (structureLines.length > 0) {
                    const matchedLine = structureLines.find(line =>
                        (salaryComponentId > 0 && String(line.salary_component_id) === String(salaryComponentId)) ||
                        (Number(line.calculation_type_id) === Number(e.calculation_type_id) &&
                            Math.abs(Number(line.value_amount) - Number(e.value_amount)) < 1.0)
                    );
                    if (matchedLine) {
                        salaryComponentId = Number(matchedLine.salary_component_id);
                        matchedByStructure = true;
                    } else if (structureLines[index] && !salaryComponentId) {
                        // Position-based fallback if calculation/value match is ambiguous
                        salaryComponentId = Number(structureLines[index].salary_component_id);
                        matchedByStructure = true;
                    }
                }

                const componentId = salaryComponentId || Number(e.id || 0);

                // Prioritize calculation_type_id for mode resolution
                const calcMode = calcModeById.get(Number(e.calculation_type_id)) || mapNameToMode(e.calculation_type) || "FLAT";

                let compName = earningNameById.get(componentId) || e.component_name || "Earning";

                // Final specialized check: if it acts like a special component, name it correctly
                if (isSpecialComponent({ name: compName, componentCode: String(componentId), calcMode }, specialPoolId)) {
                    compName = specialComponent?.name || "Special Allowance";
                }

                return {
                    componentCode: String(componentId),
                    name: compName,
                    category: "earning",
                    calcMode: isSpecialComponent({ name: compName, componentCode: String(componentId), calcMode }, specialPoolId) ? "REMAINING" : calcMode,
                    value: Number(e.value_amount || 0),
                    isBase: true,
                    monthlyAmount: (calcMode === "FLAT") ? Number(e.value_amount || 0) : Number(e.monthly_amount || 0),
                    annualAmount: (calcMode === "FLAT") ? Number(e.value_amount || 0) * 12 : Number(e.annual_amount || 0),
                    // Hidden flag used for structural filtering
                    isWhitelisted: !!(matchedByStructure || isSpecialComponent({ name: compName, componentCode: String(componentId), calcMode }, specialPoolId))
                } as any; // Cast for custom prop
            });

            // Structural Filtering: 
            // We now keep all records returned by the backend. 
            // This ensures custom-added components remain visible.
            const filteredEarnings = mappedEarnings;

            // Ensure Exactly One Special Allowance (Remaining) exists and deduplicate
            const firstSpecialIdx = filteredEarnings.findIndex(r => r.calcMode === 'REMAINING');
            let finalEarnings = filteredEarnings;

            if (firstSpecialIdx === -1) {
                finalEarnings.push({
                    componentCode: specialPoolId || "FIXED",
                    name: specialComponent?.name || "Special Allowance",
                    category: "earning",
                    calcMode: "REMAINING",
                    value: 0,
                    isBase: false,
                    monthlyAmount: 0,
                    annualAmount: 0,
                });
            } else {
                // Remove any duplicate Special/Remaining rows if they exist
                finalEarnings = filteredEarnings.filter((r, idx) => r.calcMode !== 'REMAINING' || idx === firstSpecialIdx);
            }

            const mappedDeductions: ComputedRow[] = (data.deductions || []).map((d: any) => ({
                componentCode: String(d.salary_component_id || d.id || ""),
                name:
                    deductionNameById.get(Number(d.salary_component_id || d.id)) ||
                    d.component_name ||
                    "Deduction",
                category: "deduction",
                calcMode:
                    mapNameToMode(getLineCalculationTypeLabel(d)) ||
                    calcModeById.get(Number(d.calculation_type_id)) ||
                    "FLAT",
                value: Number(d.value_amount || 0),
                isBase: false,
                monthlyAmount: Number(d.monthly_amount || (Number(d.annual_amount || 0) / 12)),
                annualAmount: Number(d.annual_amount || 0),
            }));

            const emp = employees.find(e => e.id === String(data.employee_id));
            const annualCTC = Number(data.annual_ctc || 0);
            const calculatedEarnings = calculateSalary(annualCTC, mappedEarnings);

            setFormState({
                id: String(data.id),
                employeeId: String(data.employee_id),
                employeeName: name || data.employee_name || "",
                employeeCode: code || data.employee_code || "",
                department: data.department_name || dept || emp?.department || "",
                designation: data.designation_name || desig || emp?.designation || "",
                structureMode: hasSalaryStructureId(data.salary_structure_id) ? "structure" : "custom",
                structureId: hasSalaryStructureId(data.salary_structure_id) ? String(data.salary_structure_id) : undefined,
                annualCTC: annualCTC,
                monthlyCTC: annualCTC / 12,
                effectiveFrom: String(data.effective_from || ""),
                status: Number(data.status) === 0 ? "inactive" : "active",
            });

            // Set state fresh, no appending
            setEarningsRows(calculateSalary(annualCTC, finalEarnings));
            setDeductionsRows(mappedDeductions);
            setIsEditMode(true);
            setViewMode("form");
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load assignment details" });
        }
    };

    const handleEdit = (assignment: Assignment) => {
        // Only navigate; URL change kicks off data fetching via useEffect
        setLocation(`/hr-setup/assign-employee-salary/${assignment.id}`);
    };

    const handleBackToList = () => {
        setLocation("/hr-setup/assign-employee-salary");
    };

    // --- Derived State & Logic ---

    // Filter employees for the FORM dropdown based on selected Dept/Designation in the form
    const formFilteredEmployees = useMemo(() => {
        return employees.map(emp => {
            const matchDept = !formState.department || emp.department === formState.department;
            const matchDesig = !formState.designation || emp.designation === formState.designation;

            // Mark employees who already have an assignment
            // In Edit Mode, we ignore the current employee being edited
            const isAlreadyAssigned = assignedEmployeeIds.has(emp.id) && emp.id !== formState.employeeId;

            return {
                ...emp,
                matchFilter: matchDept && matchDesig,
                isAssigned: isAlreadyAssigned
            };
        });
    }, [formState.department, formState.designation, assignedEmployeeIds, formState.employeeId, employees]);


    // Validation for Dates
    const isEffectiveDateValid = useMemo(() => {
        if (!formState.effectiveFrom || !formState.employeeId) return true; // Can't validate yet

        const emp = employees.find(e => e.id === formState.employeeId);
        if (!emp || !emp.joiningDate) return true; // Should have joining date

        return new Date(formState.effectiveFrom) >= new Date(emp.joiningDate);
    }, [formState.effectiveFrom, formState.employeeId]);

    const effectiveFromParsed = useMemo(() => {
        if (!formState.effectiveFrom) return undefined;
        const d = parseISO(formState.effectiveFrom);
        return isValidDate(d) ? d : undefined;
    }, [formState.effectiveFrom]);

    /** Aligns with HR Attendance date picker: optional min date from employee joining date. */
    const effectiveDateMinDate = useMemo(() => {
        const emp = employees.find((e) => e.id === formState.employeeId);
        if (!emp?.joiningDate) return undefined;
        const d = parseISO(emp.joiningDate);
        return isValidDate(d) ? d : undefined;
    }, [formState.employeeId, employees]);

    // --- Calculation Engine ---

    const calculateSalary = (ctc: number, currentEarnings: ComputedRow[]): ComputedRow[] => {
        let calculated = [...currentEarnings];

        // If CTC is cleared, everything should be 0
        if (ctc <= 0) {
            return calculated.map(row => ({
                ...row,
                monthlyAmount: 0,
                annualAmount: 0
                // We keep 'value' so it reappears if they type CTC back, 
                // but the calculated amounts are 0.
            }));
        }

        const hasBasicEarning = calculated.some((r: any) => isBasicComponent(r));
        if (!hasBasicEarning) {
            calculated = calculated.map((row) => {
                if (!isBasicComponent(row) && row.calcMode === "PCT_BASIC") {
                    return { ...row, calcMode: "PCT_CTC" };
                }
                return row;
            });
        }

        // 1. Calculate Basis (Basic) first as others depend on it
        const basicRow = calculated.find((r: any) => isBasicComponent(r));
        let basicAnnual = 0;

        if (basicRow) {
            let rawAnnual = 0;
            if (basicRow.calcMode === "PCT_CTC") {
                rawAnnual = (ctc * basicRow.value) / 100;
            } else if (basicRow.calcMode === "FLAT") {
                rawAnnual = basicRow.value * 12;
            }
            
            const monthly = roundToTwo(rawAnnual / 12);
            basicRow.monthlyAmount = monthly;
            basicRow.annualAmount = monthly * 12;
            basicAnnual = basicRow.annualAmount;
        }

        // 2. Calculate others based on Annual CTC or Basic Annual
        calculated = calculated.map(row => {
            if (isBasicComponent(row)) return row; // Already handled
            if (row.calcMode === "REMAINING") return row; // Handle last

            let rawAnnual = 0;
            if (row.calcMode === "FLAT") {
                rawAnnual = row.value * 12;
            } else if (row.calcMode === "PCT_CTC") {
                rawAnnual = (ctc * row.value) / 100;
            } else if (row.calcMode === "PCT_BASIC") {
                rawAnnual = (basicAnnual * row.value) / 100;
            }

            const monthly = roundToTwo(rawAnnual / 12);
            return { 
                ...row, 
                monthlyAmount: monthly,
                annualAmount: monthly * 12
            };
        });

        // 3. Resolve REMAINING (Special Allowance) at Annual level
        const remainingRowIndex = calculated.findIndex(r => r.calcMode === "REMAINING");
        if (remainingRowIndex !== -1) {
            const sumOthersAnnual = calculated.reduce((sum, r, idx) => {
                return idx === remainingRowIndex ? sum : sum + r.annualAmount;
            }, 0);

            const remainingAnnual = ctc - sumOthersAnnual;
            let remainingMonthly = roundToTwo(remainingAnnual / 12);
            
            // "By default save 0.00 as previous was": 
            // If the remainder is tiny (less than 1 unit annual difference), suppress it to zero.
            if (Math.abs(remainingAnnual) < 1.0) {
                remainingMonthly = 0;
            }

            calculated[remainingRowIndex].monthlyAmount = remainingMonthly;
            calculated[remainingRowIndex].annualAmount = remainingMonthly * 12;
        }

        return calculated;
    };


    // Recalculate when CTC changes
    useEffect(() => {
        const ctc = formState.annualCTC || 0;
        const monthly = ctc / 12;
        setFormState(prev => prev.monthlyCTC === monthly ? prev : ({ ...prev, monthlyCTC: monthly }));

        const updated = calculateSalary(ctc, earningsRows);
        // Only update if numbers changed (deeper precision check)
        const hasChanged = updated.some((row, idx) => {
            const prev = earningsRows[idx];
            return !prev ||
                Math.abs(row.monthlyAmount - prev.monthlyAmount) > 0.001 ||
                Math.abs(row.annualAmount - prev.annualAmount) > 0.001;
        });

        if (hasChanged && formState.structureMode !== undefined) {
            setEarningsRows(updated);
        }
    }, [formState.annualCTC]); // Only depend on CTC to avoid structural switch loops

    /** %-based deduction rows follow CTC and computed Basic (earnings). */
    useEffect(() => {
        const ctc = formState.annualCTC || 0;
        const earningsResolved = calculateSalary(ctc, earningsRows);
        const basicAnnual = earningsResolved.find((r: any) => isBasicComponent(r))?.annualAmount ?? 0;

        setDeductionsRows((prev: ComputedRow[]) => {
            if (!prev.some((d) => d.calcMode === "PCT_CTC" || d.calcMode === "PCT_BASIC")) return prev;
            return prev.map((row) => {
                if (row.calcMode === "PCT_CTC") {
                    const rawAnnual = (ctc * row.value) / 100;
                    const monthly = roundToTwo(rawAnnual / 12);
                    return { ...row, monthlyAmount: monthly, annualAmount: monthly * 12 };
                }
                if (row.calcMode === "PCT_BASIC") {
                    const rawAnnual = (basicAnnual * row.value) / 100;
                    const monthly = roundToTwo(rawAnnual / 12);
                    return { ...row, monthlyAmount: monthly, annualAmount: monthly * 12 };
                }
                return row;
            });
        });
    }, [formState.annualCTC, earningsRows]);


    /**
     * Handles switching Structure selection.
     * Loads structure rules into earnings rows.
     */
    const handleStructureChange = async (structureId: string) => {
        if (structureId === "custom") {
            setFormState(prev => ({ ...prev, structureMode: "custom", structureId: undefined }));
            setEarningsRows(getCustomStarterEarnings(availableComponents.earnings));
            setDeductionsRows([]);
            return;
        }

        const structure = availableStructures.find(s => s.id === structureId);
        if (structure) {
            // Reset state first to prevent structural mixing
            setEarningsRows([]);
            setDeductionsRows([]);
            setFormState(prev => ({ ...prev, structureMode: "structure", structureId: structure.id }));

            try {
                const response = await salaryStructureApi.getOne(Number(structureId));
                const data = response?.data;
                const rawLines = Array.isArray(data?.lines) ? data.lines : [];
                const rawEarnings = Array.isArray(data?.earnings) ? data.earnings : [];
                const earningLines = rawLines.length > 0 ? rawLines : rawEarnings;

                const calcModeById = new Map<number, CalcMode>();
                for (const ct of calculationTypes) {
                    const mode = mapNameToMode(ct.name);
                    if (mode) calcModeById.set(ct.id, mode);
                }

                const specialComponent = availableComponents.earnings.find((c) => normalizeText(c.name).includes("special"));
                const specialPoolId = specialComponent?.code;

                // Map structure rules (unified lines or split earnings[]) to computed rows
                const newRows: ComputedRow[] = earningLines.map((line: any) => {
                    const poolComponent = availableComponents.earnings.find(c => String(c.code) === String(line.salary_component_id));
                    const name = line.component_name || poolComponent?.name || "Earning";
                    // Prefer the line's calculation_type label from the structure API — it matches what was saved on the structure.
                    const modeFromLabel = mapNameToMode(getLineCalculationTypeLabel(line));
                    const mode =
                        modeFromLabel ||
                        calcModeById.get(Number(line.calculation_type_id)) ||
                        "FLAT";
                    const isSpecial = isSpecialComponent({ name, componentCode: String(line.salary_component_id), calcMode: mode }, specialPoolId);
                    const finalName = isSpecial ? (specialComponent?.name || "Special Allowance") : name;

                    return {
                        componentCode: String(line.salary_component_id),
                        name: finalName,
                        category: "earning" as const,
                        calcMode: isSpecial ? "REMAINING" : mode,
                        value: Number(line.value_amount || 0),
                        isBase: true,
                        monthlyAmount: (isSpecial || mode !== "FLAT") ? 0 : Number(line.value_amount || 0),
                        annualAmount: (isSpecial || mode !== "FLAT") ? 0 : Number(line.value_amount || 0) * 12,
                    };
                });

                // Add special allowance if not defined in structure
                const firstSpecialIdx = newRows.findIndex(r => r.calcMode === "REMAINING");
                let finalEarningRows = newRows;

                if (firstSpecialIdx === -1) {
                    finalEarningRows.push({
                        componentCode: specialPoolId || "FIXED",
                        name: specialComponent?.name || "Special Allowance",
                        category: "earning",
                        calcMode: "REMAINING",
                        value: 0,
                        isBase: false,
                        monthlyAmount: 0,
                        annualAmount: 0,
                    });
                } else {
                    finalEarningRows = newRows.filter((r, idx) => r.calcMode !== "REMAINING" || idx === firstSpecialIdx);
                }

                const annualCTC = formState.annualCTC || 0;
                const earningsResolved = annualCTC ? calculateSalary(annualCTC, finalEarningRows) : finalEarningRows;
                const basicAnnual = earningsResolved.find((r) => isBasicComponent(r))?.annualAmount ?? 0;

                const rawDeductions = Array.isArray(data?.deductions) ? data.deductions : [];
                const deductionNameById = new Map(availableComponents.deductions.map((c) => [Number(c.code), c.name]));
                const mappedDeductions: ComputedRow[] = rawDeductions.map((d: any) => {
                    const sid = Number(d.salary_component_id || d.id || 0);
                    const poolComponent = availableComponents.deductions.find((c) => String(c.code) === String(sid));
                    const name =
                        d.component_name ||
                        poolComponent?.name ||
                        deductionNameById.get(sid) ||
                        "Deduction";
                    const calcModeFromLabel = mapNameToMode(getLineCalculationTypeLabel(d));
                    const calcMode =
                        calcModeFromLabel ||
                        calcModeById.get(Number(d.calculation_type_id)) ||
                        "FLAT";
                    const val = Number(d.value_amount || 0);
                    let annual = 0;
                    let monthly = 0;
                    if (calcMode === "FLAT") {
                        monthly = val;
                        annual = val * 12;
                    } else if (calcMode === "PCT_CTC") {
                        annual = (annualCTC * val) / 100;
                        monthly = annual / 12;
                    } else if (calcMode === "PCT_BASIC") {
                        annual = (basicAnnual * val) / 100;
                        monthly = annual / 12;
                    }
                    return {
                        componentCode: String(sid || d.id || ""),
                        name,
                        category: "deduction" as const,
                        calcMode,
                        value: val,
                        isBase: true,
                        monthlyAmount: monthly,
                        annualAmount: annual,
                    };
                });

                setEarningsRows(earningsResolved);
                setDeductionsRows(mappedDeductions);
            } catch (error: any) {
                toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load salary structure rules" });
            }
        }
    };

    /**
     * Handle Manual Row Edits (Custom Mode or Extra Rows)
     */
    const updateEarningRow = (index: number, field: keyof ComputedRow, val: any) => {
        if (field === "calcMode") {
            setSalaryNumericDrafts((prev) => {
                const next = { ...prev };
                delete next[`pct-${index}`];
                delete next[`earn-${index}`];
                return next;
            });
        }
        const newRows = [...earningsRows];
        const prevMode = earningsRows[index]?.calcMode;
        let nextFieldVal = val;
        if (field === "calcMode" && val === "PCT_BASIC") {
            const cur = earningsRows[index];
            if (
                isBasicComponent(cur) ||
                !earningsRows.some((r) => isBasicComponent(r))
            ) {
                nextFieldVal = "PCT_CTC";
            }
        }
        let row: ComputedRow = { ...newRows[index], [field]: nextFieldVal };
        // Fixed amount uses `value` as monthly; % modes use `value` as percent — clear amounts when switching so fixed figures don't carry into the % box or monthly column.
        if (field === "calcMode") {
            const newMode = nextFieldVal as CalcMode;
            const wasFlat = prevMode === "FLAT";
            const nowPct = newMode === "PCT_CTC" || newMode === "PCT_BASIC";
            const wasPct = prevMode === "PCT_CTC" || prevMode === "PCT_BASIC";
            const nowFlat = newMode === "FLAT";
            if (wasFlat && nowPct) {
                row = { ...row, value: 0, monthlyAmount: 0, annualAmount: 0 };
            } else if (wasPct && nowFlat) {
                row = { ...row, value: 0, monthlyAmount: 0, annualAmount: 0 };
            }
        }
        // `calculateSalary` derives FLAT rows from `value` (monthly); keep in sync when editing monthly amount.
        if (field === "monthlyAmount" && row.calcMode === "FLAT") {
            const m = roundToTwo(Number(val) || 0);
            row = { ...row, monthlyAmount: m, value: m };
        }
        newRows[index] = row;

        // Trigger recalc cycle
        // If we changed value (pct/flat amount) or calc mode, we need full recalc
        if (formState.annualCTC) {
            setEarningsRows(calculateSalary(formState.annualCTC, newRows));
        } else {
            setEarningsRows(newRows);
        }
    };

    const recalcDeductionRow = (row: ComputedRow, ctc: number, basicAnnual: number): ComputedRow => {
        let rawAnnual = 0;
        if (row.calcMode === "FLAT") {
            rawAnnual = row.value * 12;
        } else if (row.calcMode === "PCT_CTC") {
            rawAnnual = (ctc * row.value) / 100;
        } else if (row.calcMode === "PCT_BASIC") {
            rawAnnual = (basicAnnual * row.value) / 100;
        }
        const monthly = roundToTwo(rawAnnual / 12);
        return { ...row, monthlyAmount: monthly, annualAmount: monthly * 12 };
    };

    const updateDeductionRow = (index: number, field: keyof ComputedRow, val: any) => {
        if (field === "calcMode") {
            setSalaryNumericDrafts((prev) => {
                const next = { ...prev };
                delete next[`ded-pct-${index}`];
                delete next[`ded-${index}`];
                return next;
            });
        }
        const newRows = [...deductionsRows];
        const prevMode = deductionsRows[index]?.calcMode;
        let nextVal = val;
        if (field === "calcMode" && val === "PCT_BASIC" && !earningsRows.some((r) => isBasicComponent(r))) {
            nextVal = "PCT_CTC";
        }
        let row: ComputedRow = { ...newRows[index], [field]: nextVal };

        if (field === "calcMode") {
            const newMode = nextVal as CalcMode;
            const wasFlat = prevMode === "FLAT";
            const nowPct = newMode === "PCT_CTC" || newMode === "PCT_BASIC";
            const wasPct = prevMode === "PCT_CTC" || prevMode === "PCT_BASIC";
            const nowFlat = newMode === "FLAT";
            if (wasFlat && nowPct) {
                row = { ...row, value: 0, monthlyAmount: 0, annualAmount: 0 };
            } else if (wasPct && nowFlat) {
                row = { ...row, value: 0, monthlyAmount: 0, annualAmount: 0 };
            }
        }
        if (field === "monthlyAmount" && row.calcMode === "FLAT") {
            const m = roundToTwo(Number(val) || 0);
            row = { ...row, monthlyAmount: m, value: m };
        }
        if (field === "value" && (row.calcMode === "PCT_CTC" || row.calcMode === "PCT_BASIC")) {
            row = { ...row, value: Number(val) || 0 };
        }
        const ctc = formState.annualCTC || 0;
        const basicAnnual = ctc
            ? calculateSalary(ctc, earningsRows).find((r) => isBasicComponent(r))?.annualAmount ?? 0
            : 0;
        newRows[index] = recalcDeductionRow(row, ctc, basicAnnual);
        setDeductionsRows(newRows);
    };

    const addEarning = (component: SalaryComponent) => {
        // Prevent duplicate (check both code and name to be safe)
        if (earningsRows.some(r => r.componentCode === component.code || r.name === component.name)) return;

        const newRow: ComputedRow = {
            componentCode: component.code,
            name: component.name,
            category: "earning",
            calcMode: "FLAT", // Default to flat manual
            value: 0,
            isBase: false,
            monthlyAmount: 0,
            annualAmount: 0
        };

        const updated = [...earningsRows, newRow];
        setSalaryNumericDrafts({});
        if (formState.annualCTC) {
            setEarningsRows(calculateSalary(formState.annualCTC, updated));
        } else {
            setEarningsRows(updated);
        }
        setOpenAddEarning(false);
    };

    const addDeduction = (component: SalaryComponent) => {
        if (deductionsRows.some(r => r.componentCode === component.code)) return;

        const newRow: ComputedRow = {
            componentCode: component.code,
            name: component.name,
            category: "deduction",
            calcMode: "FLAT",
            value: 0,
            isBase: false,
            monthlyAmount: 0,
            annualAmount: 0
        };
        setSalaryNumericDrafts({});
        setDeductionsRows([...deductionsRows, newRow]);
        setOpenAddDeduction(false);
    };

    const removeRow = (index: number, type: 'earning' | 'deduction') => {
        setSalaryNumericDrafts({});
        if (type === 'earning') {
            const updated = earningsRows.filter((_, i) => i !== index);
            if (formState.annualCTC) {
                setEarningsRows(calculateSalary(formState.annualCTC, updated));
            } else {
                setEarningsRows(updated);
            }
        } else {
            setDeductionsRows(deductionsRows.filter((_, i) => i !== index));
        }
    };

    /** "% of Basic" is only valid if a Basic earning row exists (same list user adds/removes via + Add Earning). */
    const hasBasicEarningInList = useMemo(
        () => earningsRows.some((r) => isBasicComponent(r)),
        [earningsRows]
    );

    useEffect(() => {
        if (hasBasicEarningInList) return;
        setDeductionsRows((prev) => {
            if (!prev.some((d) => d.calcMode === "PCT_BASIC")) return prev;
            const ctc = formState.annualCTC || 0;
            return prev.map((row) => {
                if (row.calcMode !== "PCT_BASIC") return row;
                const coerced: ComputedRow = { ...row, calcMode: "PCT_CTC" };
                return recalcDeductionRow(coerced, ctc, 0);
            });
        });
    }, [hasBasicEarningInList, formState.annualCTC]);

    // --- Validation & Save ---

    const totalEarningsMonthly = earningsRows.reduce((sum, r) => sum + (r.calcMode !== 'REMAINING' ? r.monthlyAmount : 0), 0);
    // Find remaining row
    const remainingRow = earningsRows.find(r => r.calcMode === 'REMAINING');
    const hasNegativeRemaining = remainingRow && remainingRow.monthlyAmount < 0;

    const totalDeductionsMonthly = deductionsRows.reduce((sum, r) => sum + r.monthlyAmount, 0);

    // Net Pay = Monthly CTC (Gross) - Deductions
    // Note: User says "add special allowance in monthly salary at last". 
    // Special Allowance is ALREADY in earningsRows, so it's part of the Gross CTC if calculated correctly.
    // Monthly CTC = Sum of all Earnings (including Special).
    // So Net Pay = MonthlyCTC - Deductions.
    const netPayMonthly = (formState.monthlyCTC || 0) - totalDeductionsMonthly;
    const netPayAnnual = (formState.annualCTC || 0) - (totalDeductionsMonthly * 12);

    const monthlyCTC = formState.monthlyCTC || 0;

    // Mismatch check (very small tolerance for floating point math)
    // If no remaining row, check total earnings vs CTC.
    const totalEarnings = earningsRows.reduce((sum, r) => sum + r.monthlyAmount, 0);
    const ctcMismatch = !remainingRow && Math.abs(totalEarnings - monthlyCTC) > 0.01;

    const isValid = useMemo(() => {
        if (!formState.employeeId || !formState.annualCTC || !formState.effectiveFrom) return false;

        if (hasNegativeRemaining) return false;
        if (ctcMismatch) return false;
        if (!isEffectiveDateValid) return false;
        if (netPayMonthly < 0) return false;

        return true;
    }, [formState, ctcMismatch, hasNegativeRemaining, isEffectiveDateValid, netPayMonthly]);

    const handleSave = async () => {
        if (!isValid) return;
        // Check for remaining calculation before save to ensure it's correct format

        const useCustom = isCustomStructureAssignment(formState.structureMode, formState.structureId);

        let structureName: string | undefined;
        if (useCustom) {
            structureName = "Custom Structure";
        } else {
            const structure = availableStructures.find(s => s.id === formState.structureId);
            structureName = structure?.name;
        }

        const assignment: Assignment = {
            id: formState.id || `ASG-${Date.now()}`,
            employeeId: formState.employeeId!,
            employeeName: formState.employeeName!,
            employeeCode: formState.employeeCode!,
            department: formState.department!,
            designation: formState.designation!,
            structureMode: useCustom ? "custom" : "structure",
            structureId: useCustom ? undefined : formState.structureId,
            structureName: structureName,
            annualCTC: formState.annualCTC!,
            monthlyCTC: monthlyCTC,
            effectiveFrom: formState.effectiveFrom!,
            status: formState.status || "active",
            earnings: earningsRows,
            deductions: deductionsRows
        };

        const calcTypeIdByMode = new Map<CalcMode, number>();
        for (const ct of calculationTypes) {
            const mode = mapNameToMode(ct.name);
            if (mode && !calcTypeIdByMode.has(mode)) calcTypeIdByMode.set(mode, ct.id);
        }
        const fixedCalcTypeId = calcTypeIdByMode.get("FLAT");

        const resolveComponentId = (row: ComputedRow, category: "earning" | "deduction") => {
            const direct = Number(row.componentCode);
            if (Number.isFinite(direct) && direct > 0) return direct;
            const pool = category === "earning" ? availableComponents.earnings : availableComponents.deductions;

            // 1. Precise Match (Name or Code)
            const byName = pool.find((c) => normalizeText(c.name) === normalizeText(row.name));
            const byCode = pool.find((c) => normalizeText(c.code) === normalizeText(row.componentCode));

            // 2. Semantic Match for 'Basic' (Robust fallback for "BASIC" strings)
            const byBasic = category === "earning" && isBasicComponent(row)
                ? pool.find((c) => isBasicComponent(c))
                : undefined;

            // 3. Specialized Match for 'Special Allowance'
            const bySpecial = normalizeText(row.name).includes("special")
                ? pool.find((c) => normalizeText(c.name).includes("special"))
                : undefined;

            const fallbackForRemaining = category === "earning" && row.calcMode === "REMAINING"
                ? pool[0]
                : undefined;

            const resolved = Number((byName || byCode || byBasic || bySpecial || fallbackForRemaining)?.code || 0);
            return Number.isFinite(resolved) && resolved > 0 ? resolved : undefined;
        };

        const invalidFields: string[] = [];
        // Resolve the Basic component ID once for base_component_id mapping
        const basicRow = assignment.earnings.find(r => isBasicComponent(r));
        const basicComponentId = basicRow ? resolveComponentId(basicRow, "earning") : null;

        const earningsPayload = assignment.earnings.map((row) => {
            const salary_component_id = resolveComponentId(row, "earning");
            const calculation_type_id = row.calcMode === "REMAINING"
                ? (calcTypeIdByMode.get("REMAINING") || fixedCalcTypeId)
                : calcTypeIdByMode.get(row.calcMode);

            if (!salary_component_id && row.calcMode !== "REMAINING") invalidFields.push(`earning component "${row.name}"`);
            if (!calculation_type_id) invalidFields.push(`calculation type "${row.calcMode}"`);

            return {
                salary_component_id,
                calculation_type_id,
                value_amount: Number(row.value || 0),
                base_component_id: row.calcMode === "PCT_BASIC" ? basicComponentId : null,
                annual_amount: Number(row.annualAmount || 0),
            };
        });
        const deductionsPayload = assignment.deductions.map((row) => {
            const salary_component_id = resolveComponentId(row, "deduction");
            const calculation_type_id = calcTypeIdByMode.get(row.calcMode) || fixedCalcTypeId;
            if (!salary_component_id) invalidFields.push(`deduction component "${row.name}"`);
            if (!calculation_type_id) invalidFields.push(`calculation type "${row.calcMode}"`);
            return {
                salary_component_id,
                calculation_type_id,
                value_amount: Number(row.value || 0),
                base_component_id: null,
                annual_amount: Number(row.annualAmount || 0),
            };
        });

        if (invalidFields.length > 0) {
            toast({
                variant: "destructive",
                title: "Invalid salary payload",
                description: `Please review: ${Array.from(new Set(invalidFields)).join(", ")}`,
            });
            return;
        }

        let salary_structure_id: number | null;
        if (useCustom) {
            salary_structure_id = null;
        } else {
            salary_structure_id = Number(formState.structureId);
        }

        const payload = {
            employee_id: Number(assignment.employeeId),
            salary_structure_id,
            effective_from: assignment.effectiveFrom,
            status: assignment.status === "active" ? 1 : 0,
            annual_ctc: Number(assignment.annualCTC || 0),
            earnings: earningsPayload,
            deductions: deductionsPayload,
        };

        setIsSubmitting(true);
        try {
            if (isEditMode && formState.id) {
                await employeeSalaryApi.update(Number(formState.id), payload);
                toast({ variant: "success", title: "Success", description: "Assignment updated successfully" });
            } else {
                await employeeSalaryApi.create(payload);
                toast({ variant: "success", title: "Success", description: "Assignment created successfully" });
                // Update local assigned IDs set
                setAssignedEmployeeIds(prev => new Set([...Array.from(prev), String(payload.employee_id)]));
            }

            upsertSalaryAssignment(assignment);
            setCurrentPage(1);
            await loadAssignments();
            setLocation("/hr-setup/assign-employee-salary");
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to save assignment" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!formState.id) return;
        setIsSubmitting(true);
        try {
            await employeeSalaryApi.delete(Number(formState.id));
            const empIdToDelete = formState.employeeId;
            removeSalaryAssignment(formState.id);
            setAssignments(prev => prev.filter(a => a.id !== formState.id));
            // Update local assigned IDs set
            if (empIdToDelete) {
                setAssignedEmployeeIds(prev => {
                    const next = new Set(prev);
                    next.delete(String(empIdToDelete));
                    return next;
                });
            }
            toast({ variant: "success", title: "Success", description: "Assignment deleted successfully" });
            setOpenDeleteDialog(false);
            setLocation("/hr-setup/assign-employee-salary");
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete assignment" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Main Render ---

    if (viewMode === "list") {
        return (
            <div className="space-y-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight">Assign Employee Salary</h1>
                    <p className="text-muted-foreground text-sm">Manage salary structures and CTC assignments for employees.</p>
                </div>

                <AppListToolbar
                    search={{
                        placeholder: "Search by name or employee code...",
                        value: searchTerm,
                        onChange: setSearchTerm
                    }}
                    filters={[
                        {
                            type: "select",
                            label: "Department",
                            value: deptFilter,
                            onChange: setDeptFilter,
                            options: [{ label: "All Departments", value: "All Departments" }, ...departments.map((d) => ({ label: d.name, value: d.name }))],
                            searchable: true
                        }
                    ]}
                    actions={[
                        ...(canCreate(permissionModule) ? [{
                            label: "Assign Salary",
                            icon: <Plus className="mr-2 h-4 w-4" />,
                            onClick: () => handleCreateNew()
                        }] : [])
                    ]}
                />

                <Card>
                    <CardContent className="pt-6">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Employee</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Structure</TableHead>
                                        <TableHead className="text-right">Monthly Gross</TableHead>
                                        <TableHead className="text-right">Annual CTC</TableHead>
                                        <TableHead>Effective From</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-center w-[100px]">Actions</TableHead>
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
                                    ) : paginatedAssignments.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic">No assignments found.</TableCell>
                                        </TableRow>
                                    ) : paginatedAssignments.map(a => (
                                        <TableRow key={a.id} className="hover:bg-muted/30 transition-colors text-sm">
                                            <TableCell>
                                                <div className="font-medium">{a.employeeName}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{a.employeeCode}</div>
                                            </TableCell>
                                            <TableCell>{a.department}</TableCell>
                                            <TableCell>
                                                {a.structureMode === 'custom' ?
                                                    <Badge variant="outline" className="text-[10px]">Custom</Badge> :
                                                    <Badge variant="secondary" className="text-[10px]">{a.structureName || availableStructures.find(s => s.id === a.structureId)?.name || 'Unknown'}</Badge>
                                                }
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{CURRENCY_SYMBOL}{a.monthlyCTC.toFixed(2)}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">{CURRENCY_SYMBOL}{a.annualCTC.toFixed(2)}</TableCell>
                                            <TableCell>
                                                {a.effectiveFrom ? (
                                                    isValidDate(parseISO(a.effectiveFrom)) 
                                                        ? format(parseISO(a.effectiveFrom), "dd-MM-yyyy") 
                                                        : a.effectiveFrom
                                                ) : "-"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={cn(
                                                        "text-[10px]",
                                                        a.status === "active"
                                                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                                                            : "bg-muted text-muted-foreground hover:bg-muted border border-border"
                                                    )}
                                                >
                                                    {a.status === "active" ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <TableActionButtons
                                                    onEdit={canEdit(permissionModule) ? () => handleEdit(a) : undefined}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
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
                            />
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    // --- View: Form ---

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleBackToList}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Assign Salary</h1>
                    <p className="text-muted-foreground">Assign salary structure and CTC components</p>
                </div>
            </div>

            {/* Assignment Details Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Assignment Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* 1. Department */}
                    <div className="space-y-2">
                        <Label>Department</Label>
                        <Popover open={openDeptCombo} onOpenChange={setOpenDeptCombo}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openDeptCombo}
                                    className="w-full justify-between h-10 font-normal border-input"
                                    disabled={isEditMode}
                                >
                                    <span className={cn(!formState.department && "text-muted-foreground")}>
                                        {formState.department || "Select department..."}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                <Command>
                                    <CommandInputBorderless placeholder="Search department..." className="h-9" />
                                    <CommandList className="max-h-[200px] overflow-y-auto">
                                        <CommandEmpty>No department found.</CommandEmpty>
                                        <CommandGroup>
                                            {departments.map((dept) => (
                                                <CommandItem
                                                    key={dept.id}
                                                    value={dept.name}
                                                    onSelect={(currentValue) => {
                                                        setFormState(prev => ({
                                                            ...prev,
                                                            department: currentValue === formState.department ? "" : currentValue,
                                                            employeeId: "",
                                                            employeeName: "",
                                                            employeeCode: ""
                                                        }));
                                                        setOpenDeptCombo(false);
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", formState.department === dept.name ? "opacity-100" : "opacity-0")} />
                                                    {dept.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* 2. Designation */}
                    <div className="space-y-2">
                        <Label>Designation</Label>
                        <Popover open={openDesigCombo} onOpenChange={setOpenDesigCombo}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openDesigCombo}
                                    className="w-full justify-between h-10 font-normal border-input"
                                    disabled={isEditMode}
                                >
                                    <span className={cn(!formState.designation && "text-muted-foreground")}>
                                        {formState.designation || "Select designation..."}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                <Command>
                                    <CommandInputBorderless placeholder="Search designation..." className="h-9" />
                                    <CommandList className="max-h-[200px] overflow-y-auto">
                                        <CommandEmpty>No designation found.</CommandEmpty>
                                        <CommandGroup>
                                            {designations.map((desig) => (
                                                <CommandItem
                                                    key={desig.id}
                                                    value={desig.name}
                                                    onSelect={(currentValue) => {
                                                        setFormState(prev => ({
                                                            ...prev,
                                                            designation: currentValue === formState.designation ? "" : currentValue,
                                                            employeeId: "",
                                                            employeeName: "",
                                                            employeeCode: ""
                                                        }));
                                                        setOpenDesigCombo(false);
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", formState.designation === desig.name ? "opacity-100" : "opacity-0")} />
                                                    {desig.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* 3. Employee (Filtered) */}
                    <div className="space-y-2">
                        <Label>Employee <span className="text-red-500">*</span></Label>
                        <Popover open={openEmpCombo} onOpenChange={setOpenEmpCombo}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openEmpCombo}
                                    className="w-full justify-between h-10 font-normal border-input"
                                    disabled={isEditMode}
                                >
                                    <span className={cn(!formState.employeeName && "text-muted-foreground")}>
                                        {formState.employeeName || "Select employee..."}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                <Command filter={commandLabelFilter}>
                                    <CommandInputBorderless placeholder="Search employee..." className="h-9" />
                                    <CommandList className="max-h-[200px] overflow-y-auto">
                                        <CommandEmpty>No employee found.</CommandEmpty>
                                        <CommandGroup>
                                            {formFilteredEmployees
                                                .filter(emp => emp.matchFilter)
                                                .map((emp) => (
                                                    <CommandItem
                                                        key={emp.code}
                                                        value={toCommandItemValue(emp.name, emp.id)}
                                                        disabled={emp.isAssigned}
                                                        onSelect={() => {
                                                            if (emp.isAssigned) return;
                                                            setFormState(prev => ({
                                                                ...prev,
                                                                employeeId: emp.id,
                                                                employeeCode: emp.code,
                                                                employeeName: emp.name,
                                                                department: emp.department,
                                                                designation: emp.designation
                                                            }));
                                                            setOpenEmpCombo(false);
                                                        }}
                                                        className={cn("cursor-pointer", emp.isAssigned && "opacity-50 pointer-events-none grayscale")}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", formState.employeeId === emp.id ? "opacity-100" : "opacity-0")} />
                                                        <div className="flex flex-col">
                                                            <span>{emp.name}</span>
                                                            <span className="text-xs text-muted-foreground">{emp.code} • {emp.department}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label>Salary Structure <span className="text-red-500">*</span></Label>
                        <Popover open={openStructureDropdown} onOpenChange={setOpenStructureDropdown}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openStructureDropdown}
                                    className="w-full justify-between h-10 font-normal border-input"
                                >
                                    <span className={cn(!formState.structureId && formState.structureMode !== 'custom' && "text-muted-foreground")}>
                                        {formState.structureMode === 'custom'
                                            ? '➕ Use Custom Structure'
                                            : formState.structureId
                                                ? availableStructures.find(s => s.id === formState.structureId)?.name
                                                : 'Select structure'}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                <Command>
                                    <CommandInputBorderless placeholder="Search salary structure..." className="h-9" />
                                    <CommandList className="max-h-[200px] overflow-y-auto">
                                        <CommandEmpty>No structure found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                key="custom"
                                                value="custom"
                                                onSelect={() => {
                                                    handleStructureChange('custom');
                                                    setOpenStructureDropdown(false);
                                                }}
                                                className="cursor-pointer font-medium text-blue-600"
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        formState.structureMode === 'custom' ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                ➕ Use Custom Structure
                                            </CommandItem>
                                            {availableStructures.map((structure) => (
                                                <CommandItem
                                                    key={structure.id}
                                                    value={structure.name}
                                                    onSelect={() => {
                                                        handleStructureChange(structure.id);
                                                        setOpenStructureDropdown(false);
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            formState.structureId === structure.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {structure.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-1.5 min-w-0">
                        <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            Effective From <span className="text-red-500">*</span>
                        </Label>
                        <DatePicker
                            date={effectiveFromParsed}
                            setDate={(d) => {
                                if (d) {
                                    setFormState((prev) => ({
                                        ...prev,
                                        effectiveFrom: format(d, "yyyy-MM-dd"),
                                    }));
                                }
                            }}
                            placeholder="Select date"
                            showClear={false}
                            minDate={effectiveDateMinDate}
                            className={cn(!isEffectiveDateValid && "border-red-500")}
                        />
                        {!isEffectiveDateValid && (
                            <p className="text-xs text-red-500">Must be on or after joining date</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={formState.status} onValueChange={(v: any) => setFormState({ ...formState, status: v })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent side="bottom">
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Salary Calculation Section */}
            <div ref={salaryNumberInputsRootRef} className="space-y-4">
                {/* CTC INPUT */}
                <div className="bg-card border rounded-lg p-6 flex flex-col items-center justify-center space-y-2">
                    <Label className="text-lg font-medium">Annual CTC <span className="text-red-500">*</span></Label>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground font-medium">{CURRENCY_SYMBOL}</span>
                            <Input
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={MAX_ANNUAL_CTC_DIGITS}
                                aria-label="Annual CTC amount"
                                className={cn(
                                    "pl-14 text-lg font-bold min-w-[12rem] max-w-[22rem] w-full",
                                    salaryAmountInputBorderClass,
                                    noNumberSpinnerClass
                                )}
                                value={formState.annualCTC ? String(formState.annualCTC) : ""}
                                onChange={(e) =>
                                    setFormState({
                                        ...formState,
                                        annualCTC: sanitizeAnnualCtcInput(e.target.value),
                                    })
                                }
                            />
                        </div>
                        <span className="text-sm text-muted-foreground">per year</span>
                    </div>
                    {formState.monthlyCTC ? (
                        <p className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                            Monthly CTC: {CURRENCY_SYMBOL}{formState.monthlyCTC.toFixed(2)}
                        </p>
                    ) : null}
                </div>

                {/* Calculation Table */}
                <Card>
                    <CardContent className="p-0">
                        {/* Header Row */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b bg-muted/30 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                            <div className="col-span-4">Salary Components</div>
                            <div className="col-span-3">Calculation Type</div>
                            <div className="col-span-2 text-right">Monthly Amount</div>
                            <div className="col-span-2 text-right">Annual Amount</div>
                            <div className="col-span-1"></div>
                        </div>

                        {/* EARNINGS */}
                        <div className="px-6 py-4">
                            <h4 className="font-semibold mb-4 text-sm">Earnings</h4>
                            <div className="space-y-4">
                                {earningsRows.map((row, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-4 items-center group">
                                        {/* Component Name */}
                                        <div className="col-span-4">
                                            <div className="flex items-center gap-1 font-medium">
                                                {row.name}
                                                {row.calcMode === 'REMAINING' && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>This component covers the remaining balance of the monthly CTC.</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                            {row.calcMode === 'REMAINING' && (
                                                <div className="text-xs text-muted-foreground">
                                                    Monthly CTC - Sum of all other components
                                                </div>
                                            )}
                                        </div>

                                        {/* Calculation Type */}
                                        <div className="col-span-3 flex gap-2">
                                            {row.calcMode === 'REMAINING' ? (
                                                <div className="text-sm text-muted-foreground py-2 font-medium">Fixed amount</div>
                                            ) : (formState.structureMode === 'structure' && row.isBase) ? (
                                                <div className="text-sm text-muted-foreground py-2">
                                                    {row.calcMode === 'FLAT' ? 'Fixed amount' :
                                                        `${row.value}% of ${row.calcMode === 'PCT_BASIC' ? 'Basic' : 'CTC'}`}
                                                </div>
                                            ) : (
                                                <div className="flex w-full gap-2">
                                                    {row.calcMode !== 'FLAT' && (
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            autoComplete="off"
                                                            className={cn("w-[88px] h-9", noNumberSpinnerClass)}
                                                            value={
                                                                salaryNumericDrafts[`pct-${index}`] !== undefined
                                                                    ? salaryNumericDrafts[`pct-${index}`]
                                                                    : row.value === 0
                                                                        ? ""
                                                                        : formatTwoDecimalForInput(row.value)
                                                            }
                                                            onChange={(e) => {
                                                                const r = sanitizePercentTwoDecimalsInput(e.target.value);
                                                                setSalaryNumericDrafts((prev) => ({
                                                                    ...prev,
                                                                    [`pct-${index}`]: r.display,
                                                                }));
                                                                updateEarningRow(index, "value", r.value);
                                                            }}
                                                            onBlur={() => {
                                                                setSalaryNumericDrafts((prev) => {
                                                                    const next = { ...prev };
                                                                    delete next[`pct-${index}`];
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                    )}
                                                    <Select
                                                        value={
                                                            ["FLAT", "PCT_CTC", "PCT_BASIC"].includes(row.calcMode)
                                                                ? row.calcMode
                                                                : "FLAT"
                                                        }
                                                        onValueChange={(v) => updateEarningRow(index, "calcMode", v)}
                                                    >
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent side="bottom">
                                                            <SelectItem value="FLAT">Fixed Amount</SelectItem>
                                                            <SelectItem value="PCT_CTC">% of CTC</SelectItem>
                                                            {!isBasicComponent(row) && hasBasicEarningInList ? (
                                                                <SelectItem value="PCT_BASIC">% of Basic</SelectItem>
                                                            ) : null}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>

                                        {/* Monthly Amount */}
                                        <div className="col-span-2 text-right">
                                            {row.calcMode === 'REMAINING' ? (
                                                <div className={cn("bg-muted px-3 py-2 rounded text-sm font-medium", row.monthlyAmount < 0 && "text-red-600")}>
                                                    {row.monthlyAmount.toFixed(2)}
                                                </div>
                                            ) : (row.calcMode === 'FLAT' && (formState.structureMode === 'custom' || !row.isBase)) ? (
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    autoComplete="off"
                                                    className={cn("h-9 w-full min-w-[6rem] text-right", salaryAmountInputBorderClass, noNumberSpinnerClass)}
                                                    value={
                                                        salaryNumericDrafts[`earn-${index}`] !== undefined
                                                            ? salaryNumericDrafts[`earn-${index}`]
                                                            : formatTwoDecimalForInput(row.monthlyAmount)
                                                    }
                                                    onChange={(e) => {
                                                        const r = sanitizeFixedAmountTwoDecimalsInput(e.target.value);
                                                        setSalaryNumericDrafts((prev) => ({
                                                            ...prev,
                                                            [`earn-${index}`]: r.display,
                                                        }));
                                                        updateEarningRow(index, "monthlyAmount", r.value);
                                                    }}
                                                    onBlur={() => {
                                                        setSalaryNumericDrafts((prev) => {
                                                            const next = { ...prev };
                                                            delete next[`earn-${index}`];
                                                            return next;
                                                        });
                                                    }}
                                                />
                                            ) : (
                                                <div className="bg-muted px-3 py-2 rounded text-sm font-medium">
                                                    {row.monthlyAmount.toFixed(2)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Annual Amount */}
                                        <div className="col-span-2 text-right">
                                            {row.calcMode === 'REMAINING' ? (
                                                <div className={cn("text-sm text-muted-foreground font-medium", row.annualAmount < 0 && "text-red-600")}>
                                                    {row.annualAmount.toFixed(2)}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    {row.annualAmount.toFixed(2)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Remove Button — API-loaded rows use isBase:true, which hid delete in edit; match deductions in edit mode. */}
                                        <div className="col-span-1 flex justify-center">
                                            {(isEditMode
                                                ? row.calcMode !== "REMAINING"
                                                : !row.isBase &&
                                                row.componentCode !== "BASIC" &&
                                                row.componentCode !== "FIXED" &&
                                                row.calcMode !== "REMAINING") && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-red-500"
                                                        onClick={() => removeRow(index, "earning")}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                )}
                                        </div>
                                    </div>
                                ))}

                                {/* Add Earning - Searchable (Command) */}
                                <Popover open={openAddEarning} onOpenChange={setOpenAddEarning}>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" className="text-blue-600 hover:text-blue-700 p-0 h-auto font-medium">
                                            + Add Earning
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[350px] p-0" align="start">
                                        <Command filter={commandLabelFilter}>
                                            <CommandInputBorderless placeholder="Search earning component..." className="h-9" />
                                            <CommandList className="max-h-[250px] overflow-y-auto">
                                                <CommandEmpty>No earning component found.</CommandEmpty>
                                                <CommandGroup>
                                                    {availableComponents.earnings
                                                        .filter(c =>
                                                            c.code !== "FIXED" && // Exclude Special Allowance (always present and locked)
                                                            !earningsRows.some(row => row.componentCode === c.code || row.name === c.name)
                                                        )
                                                        .map(c => (
                                                            <CommandItem
                                                                key={c.code}
                                                                value={toCommandItemValue(c.name, c.code)}
                                                                onSelect={() => {
                                                                    addEarning(c);
                                                                    setOpenAddEarning(false);
                                                                }}
                                                                className="cursor-pointer"
                                                            >
                                                                <Plus className="mr-2 h-4 w-4 text-green-600" />
                                                                {c.name}
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* DEDUCTIONS */}
                        <div className="px-6 py-4 border-t">
                            <h4 className="font-semibold mb-4 text-sm">Deductions</h4>
                            <div className="space-y-4">
                                {deductionsRows.map((row, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-4 items-center group">
                                        <div className="col-span-4 font-medium">{row.name}</div>
                                        <div className="col-span-3 flex gap-2">
                                            {formState.structureMode === "structure" && row.isBase ? (
                                                <div className="text-sm text-muted-foreground py-2">
                                                    {row.calcMode === "FLAT"
                                                        ? "Fixed amount"
                                                        : `${row.value}% of ${row.calcMode === "PCT_BASIC" ? "Basic" : "CTC"}`}
                                                </div>
                                            ) : (
                                                <div className="flex w-full gap-2">
                                                    {row.calcMode !== "FLAT" && (
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            autoComplete="off"
                                                            className={cn("w-[88px] h-9", noNumberSpinnerClass)}
                                                            value={
                                                                salaryNumericDrafts[`ded-pct-${index}`] !== undefined
                                                                    ? salaryNumericDrafts[`ded-pct-${index}`]
                                                                    : row.value === 0
                                                                        ? ""
                                                                        : formatTwoDecimalForInput(row.value)
                                                            }
                                                            onChange={(e) => {
                                                                const r = sanitizePercentTwoDecimalsInput(e.target.value);
                                                                setSalaryNumericDrafts((prev) => ({
                                                                    ...prev,
                                                                    [`ded-pct-${index}`]: r.display,
                                                                }));
                                                                updateDeductionRow(index, "value", r.value);
                                                            }}
                                                            onBlur={() => {
                                                                setSalaryNumericDrafts((prev) => {
                                                                    const next = { ...prev };
                                                                    delete next[`ded-pct-${index}`];
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                    )}
                                                    <Select
                                                        value={["FLAT", "PCT_CTC", "PCT_BASIC"].includes(row.calcMode) ? row.calcMode : "FLAT"}
                                                        onValueChange={(v) => updateDeductionRow(index, "calcMode", v)}
                                                    >
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent side="bottom">
                                                            <SelectItem value="FLAT">Fixed Amount</SelectItem>
                                                            <SelectItem value="PCT_CTC">% of CTC</SelectItem>
                                                            {hasBasicEarningInList ? (
                                                                <SelectItem value="PCT_BASIC">% of Basic</SelectItem>
                                                            ) : null}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-2 text-right">
                                            {row.calcMode === "FLAT" && (formState.structureMode === "custom" || !row.isBase) ? (
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    autoComplete="off"
                                                    className={cn("h-9 w-full min-w-[6rem] text-right", salaryAmountInputBorderClass, noNumberSpinnerClass)}
                                                    value={
                                                        salaryNumericDrafts[`ded-${index}`] !== undefined
                                                            ? salaryNumericDrafts[`ded-${index}`]
                                                            : formatTwoDecimalForInput(row.monthlyAmount)
                                                    }
                                                    onChange={(e) => {
                                                        const r = sanitizeFixedAmountTwoDecimalsInput(e.target.value);
                                                        setSalaryNumericDrafts((prev) => ({
                                                            ...prev,
                                                            [`ded-${index}`]: r.display,
                                                        }));
                                                        updateDeductionRow(index, "monthlyAmount", r.value);
                                                    }}
                                                    onBlur={() => {
                                                        setSalaryNumericDrafts((prev) => {
                                                            const next = { ...prev };
                                                            delete next[`ded-${index}`];
                                                            return next;
                                                        });
                                                    }}
                                                />
                                            ) : (
                                                <div className="bg-muted px-3 py-2 rounded text-sm font-medium">
                                                    {row.monthlyAmount.toFixed(2)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <div className="text-sm text-muted-foreground">{row.annualAmount.toFixed(2)}</div>
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            {!row.isBase && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-red-500"
                                                    onClick={() => removeRow(index, "deduction")}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Add Deduction - Searchable */}
                                <Popover open={openAddDeduction} onOpenChange={setOpenAddDeduction}>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" className="text-blue-600 hover:text-blue-700 p-0 h-auto font-medium">
                                            + Add Deduction
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[350px] p-0" align="start">
                                        <Command filter={commandLabelFilter}>
                                            <CommandInputBorderless placeholder="Search deduction component..." className="h-9" />
                                            <CommandList className="max-h-[250px] overflow-y-auto">
                                                <CommandEmpty>No deduction component found.</CommandEmpty>
                                                <CommandGroup>
                                                    {availableComponents.deductions
                                                        .filter(c => !deductionsRows.some(row => row.componentCode === c.code))
                                                        .map(c => (
                                                            <CommandItem
                                                                key={c.code}
                                                                value={toCommandItemValue(c.name, c.code)}
                                                                onSelect={() => {
                                                                    addDeduction(c);
                                                                    setOpenAddDeduction(false);
                                                                }}
                                                                className="cursor-pointer"
                                                            >
                                                                <Plus className="mr-2 h-4 w-4 text-red-600" />
                                                                {c.name}
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* SUMMARY & ACTION */}
                        {hasNegativeRemaining ? (
                            <div className="bg-red-50 border-t border-red-200 p-6 rounded-b-lg">
                                <div className="flex gap-4">
                                    <div className="mt-1">
                                        <div className="rounded-full bg-red-600 text-white p-0.5">
                                            <Info className="h-4 w-4" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-red-800">System Calculated Components' Total</h4>
                                        <p className="text-sm text-red-700">
                                            Amount must be greater than zero. Adjust the CTC or any of the component's amount.
                                        </p>
                                    </div>
                                    <div className="ml-auto flex gap-8 text-right self-center">
                                        <div className="text-red-500 font-medium">
                                            {(remainingRow?.monthlyAmount || 0).toFixed(2)}
                                        </div>
                                        <div className="text-red-500 font-medium">
                                            {(remainingRow?.annualAmount || 0).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-blue-50/50 border-t p-6 rounded-b-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-muted-foreground font-medium">Gross Monthly Salary</span>
                                    <span className="font-bold">{CURRENCY_SYMBOL}{monthlyCTC.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-muted-foreground font-medium">Total Deductions</span>
                                    <span className="font-bold text-red-600">- {CURRENCY_SYMBOL}{totalDeductionsMonthly.toFixed(2)}</span>
                                </div>
                                <div className="h-px bg-border mb-4"></div>
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-lg font-bold">Net Monthly Pay</span>
                                        <span className="text-xs text-muted-foreground">In-hand salary after deductions</span>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn("text-2xl font-bold", netPayMonthly < 0 ? "text-red-600" : "text-green-700")}>
                                            {CURRENCY_SYMBOL}{netPayMonthly.toFixed(2)}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Annual: {CURRENCY_SYMBOL}{netPayAnnual.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-between items-center pb-10">
                    <div>
                        {isEditMode && canDelete(permissionModule) && (
                            <Button variant="destructive" onClick={() => setOpenDeleteDialog(true)}>
                                Delete Assignment
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <Button type="button" variant="outline" onClick={handleBackToList}>Cancel</Button>
                        {((isEditMode && canEdit(permissionModule)) || (!isEditMode && canCreate(permissionModule))) && (
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={!isValid || isSubmitting}
                                loading={isSubmitting}
                                className="disabled:bg-muted disabled:text-muted-foreground disabled:border-border disabled:opacity-100 disabled:shadow-none"
                            >
                                {isEditMode ? "Update Assignment" : "Save Assignment"}
                            </Button>
                        )}
                    </div>
                </div>

                <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the assignment for
                                <span className="font-medium text-foreground"> {formState.employeeName}</span>.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} loading={isSubmitting} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
