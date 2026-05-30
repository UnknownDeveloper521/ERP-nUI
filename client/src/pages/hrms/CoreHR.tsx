import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import * as XLSX from 'xlsx';
import {
  useHrEmployeeList, useHrEmployee, useHrEmployeeJobDetails, useHrEmployeeDocuments, useHrEmployeeSystemAccess,
  useCreateHrEmployee, useUpdateHrEmployee, useDeleteHrEmployee,
  useAddHrEmployeeJobDetails, useUpdateHrEmployeeJobDetails,
  useAddHrEmployeeDocument, useDeleteHrEmployeeDocument,
  useAddHrEmployeeSystemAccess, useUpdateHrEmployeeSystemAccess,
  useHrDepartments, useHrGenders, useHrNationalities, useHrBloodGroups, useHrMaritalStatuses,
  useHrEmploymentTypes, useHrGrades, useHrDesignations, useHrLocations, useHrShifts, useHrRoles, useHrReportingManagers,
  useHrCountries, useHrStates, useHrCities,
  useHrWarehouses, useHrWorkCenters, useHrOperations, useHrDocumentTypes, useHrEmploymentStatus
} from "@/hooks/useApi";
import { useHasPermission } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea"; // Assuming this exists or using Input as fallback
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar"; // Check if used or using HTML date input
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandInputBorderless } from "@/components/ui/command";
import { format, parse } from "date-fns";
import { CalendarIcon, Plus, Edit, Upload, Trash2, User, Briefcase, FileText, ShieldCheck, FileSpreadsheet, ChevronLeft, ChevronRight, Eye, EyeOff, ChevronDown, ExternalLink, ChevronsUpDown, Check, Copy, Key, Info, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { cn, truncateMiddle, resolveFileUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mockWorkCenters, mockWarehouses, mockOperations, mockLocations } from "@/lib/masterMockData";
import { useCommonStore } from "@/store/commonStore";
import { hrCommonApi, hrEmployeeApi } from "@/lib/api";


// --- Validation Regular Expressions ---
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^\d{10}$/;
const PINCODE_REGEX = /^\d{6}$/;
const NAME_REGEX = /^[a-zA-Z\s'-]{2,}$/; 
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
// --- Types ---

// Expanding default Employee type for UI-only fields
interface ExtendedEmployee {
    id?: string;
    employeeId: string;
    firstName: string;
    middleName?: string; // UI Only
    lastName: string;
    fullName?: string; // Derived
    gender: string; // UI Only
    dateOfBirth?: string | Date;
    age?: number; // Derived
    maritalStatus?: string; // UI Only
    nationality?: string; // UI Only
    bloodGroup?: string; // UI Only
    photo?: File | string; // UI Only

    mobileNumber: string; // mapped to phone
    alternateMobile?: string; // UI Only
    personalEmail: string; // mapped to email
    officialEmail?: string; // UI Only

    currentAddress: string; // mapped to address
    permanentAddress?: string; // UI Only
    city?: string;
    state?: string;
    pincode?: string; // mapped to postalCode
    country?: string;

    dateOfJoining?: string | Date;
    employmentType?: string;
    employmentStatus: string; // mapped to status
    probationPeriod?: string; // UI Only
    confirmationDate?: string | Date; // UI Only
    exitDate?: string | Date; // UI Only

    departmentId: string;
    designation: string;
    grade?: string; // UI Only
    reportingManager?: string; // mapped to reportingTo
    workLocation?: string; // UI Only
    shift?: string; // UI Only

    documents?: any[]; // UI Only

    // System Access Associations
    assignedWorkCenters?: string[]; // IDs
    assignedWarehouses?: string[]; // IDs
    assignedOperations?: string[]; // IDs
}

// --- Master Data Options ---
// ⚠️ SAFE GUARD: Added ONE mock record to each master data array to prevent runtime crashes
// This ensures dropdowns never crash when trying to map over empty arrays
// ============================================================================

const globalSafeParseDate = (dateStr: any) => {
    if (!dateStr) return undefined;
    if (typeof dateStr === 'number' || (!isNaN(Number(dateStr)) && Number(dateStr) > 25000 && Number(dateStr) < 70000)) {
        return new Date((Number(dateStr) - 25569) * 86400 * 1000);
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    try {
        const formats = ['ddMMyyyy', 'dd-MM-yyyy', 'dd/MM/yyyy', 'd-M-yyyy', 'd/M/yyyy', 'MM/dd/yyyy', 'M/d/yyyy', 'yyyy/MM/dd'];
        const str = dateStr.toString().trim();
        for (const fmt of formats) {
            const parsedDate = parse(str, fmt, new Date());
            if (!isNaN(parsedDate.getTime())) return parsedDate;
        }
    } catch (e) {}
    return undefined;
};

// Work centers/warehouses/operations are now managed via API hooks in the CoreHR component
import Unauthorized from "../Unauthorized";

// --- Components ---

export default function CoreHR() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();

    const hasAccess = isMenuVisible("HRMS:Core HR");

    // Early return if no access at all
    if (!hasAccess) {
        return <Unauthorized />;
    }

    // ── Navigation & Views ──────────────────────────────────────────────────
    const moduleName = "HRMS/CORE_HR";

    // ── List pagination & filter state ──────────────────────────────────────
    const [listPage, setListPage] = useState(1);
    const [listLimit, setListLimit] = useState(10);
    const [listDeptFilter, setListDeptFilter] = useState<number | undefined>(undefined);
    const [listSearch, setListSearch] = useState('');
    // Debounce search so we don't fire on every keystroke
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const searchDebounceRef = useRef<any>(null);
    useEffect(() => {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => setDebouncedSearch(listSearch), 400);
        return () => clearTimeout(searchDebounceRef.current);
    }, [listSearch]);

    // ── Master Data from Common Store ───────────────────────────────────────
    const { 
        departments, 
        genders, 
        nationalities, 
        bloodGroups, 
        maritalStatuses,
        shifts,
        locations,
        grades,
        employmentTypes,
        employmentStatuses,
        designations,
        documentTypes
    } = useCommonStore(state => ({
        departments: state.departments,
        genders: state.genders,
        nationalities: state.nationalities,
        bloodGroups: state.bloodGroups,
        maritalStatuses: state.maritalStatuses,
        shifts: state.shifts,
        locations: state.locations,
        grades: state.grades,
        employmentTypes: state.employmentTypes,
        employmentStatuses: state.employmentStatuses,
        designations: state.designations,
        documentTypes: state.documentTypes
    }));
    // const { data: departmentsResponse } = useHrDepartments();
    /*
    const departments: Array<{ id: number; name: string; code: string }> = (
        departmentsResponse?.data?.records || []
    ).map((d: any) => ({
        id: d.id,
        name: d.name || d.value_name || '',
        code: d.code || d.value_code || (d.name || d.value_name)?.substring(0, 3).toUpperCase() || '',
    }));
    */

    // ── Employee list from API ───────────────────────────────────────────────
    const { data: employeeListResponse, isLoading: isListLoading } = useHrEmployeeList({
        page: listPage,
        limit: listLimit,
        search: debouncedSearch || undefined,
        department_id: listDeptFilter,
    });

    const employees: any[] = (employeeListResponse?.data?.records || []).map((emp: any) => {
        const names = (emp.full_name || emp.first_name || '').split(' ');
        const firstName = emp.first_name || names[0] || '';
        const lastName = emp.last_name || names.slice(1).join(' ') || '';

        const deptId = emp.department_id || departments.find((d: any) => d.name === (emp.department || emp.department_name))?.id;
        
        return {
            id: emp.id,
            employeeId: emp.code || `EMP${emp.id}`,
            firstName: firstName,
            lastName: lastName,
            email: emp.email || emp.personal_email || emp.official_email || '',
            phone: emp.phone || emp.mobile_number || '',
            gender: emp.gender || emp.gender_name || '',
            departmentId: deptId,
            departmentName: emp.department || emp.department_name || '',
            departmentCode: emp.department_code || departments.find((d: any) => d.id === deptId)?.code || '',
            designation: emp.designation || '',
            status: emp.status,
        };
    });
    const listTotalItems: number = employeeListResponse?.data?.pagination?.totalCount || employeeListResponse?.data?.total || 0;


    // ── Real mutations ───────────────────────────────────────────────────────
    const createEmployeeMutation = useCreateHrEmployee();

    const updateEmployeeMutation = useUpdateHrEmployee();
    const updateJobDetailsMutation = useUpdateHrEmployeeJobDetails();
    const addJobDetailsMutation = useAddHrEmployeeJobDetails();
    const deleteEmployeeMutation = useDeleteHrEmployee();
    const addDocumentMutation = useAddHrEmployeeDocument();
    const deleteDocumentMutation = useDeleteHrEmployeeDocument();
    const addSystemAccessMutation = useAddHrEmployeeSystemAccess();
    const updateSystemAccessMutation = useUpdateHrEmployeeSystemAccess();
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const handleDelete = async () => {
        if (!editingId) return;
        try {
            await deleteEmployeeMutation.mutateAsync(parseInt(editingId));
            toast({ title: "Success", description: "Employee deleted successfully.", className: "bg-green-50 border-green-200 text-green-900 shadow-md" });
            setIsDeleteOpen(false);
            handleBackToList();
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to delete employee.", variant: "destructive" });
        }
    };

    const [location, setLocation] = useLocation();
    const [matchNew] = useRoute("/hrms/core-hr/employees/new");
    const [matchEditMode, paramsEdit] = useRoute("/hrms/core-hr/employees/:id/edit");
    const [matchView, paramsView] = useRoute("/hrms/core-hr/employees/:id");

    // Derived Logic (declare early so hooks below can use these)
    const viewModeEarly = matchNew ? 'add' : (matchEditMode || matchView ? 'edit' : 'list');
    const editingIdEarly = (matchEditMode && paramsEdit ? paramsEdit.id : (matchView && paramsView ? paramsView.id : null));
    const editingIdNum = editingIdEarly ? parseInt(editingIdEarly) : null;
    const isInFormView = viewModeEarly !== 'list';

    const [activeTab, setActiveTab] = useState("personal");
    const [formData, setFormData] = useState<any>({});

    // Import Modal State (declared early so hooks can depend on it)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importValidationErrors, setImportValidationErrors] = useState<string[]>([]);
    const [isImportValid, setIsImportValid] = useState(false);
    const [isValidated, setIsValidated] = useState(false);
    const [validationMessage, setValidationMessage] = useState<string>('');
    const importFileInputRef = useRef<HTMLInputElement | null>(null);
    const [isDragActive, setIsDragActive] = useState(false);
    const [importPreview, setImportPreview] = useState<{
        totalRows: number;
        validRows: number;
        invalidRows: number;
        rowResults: { rowNumber: number; values: Record<string, string>; errors: string[] }[];
    } | null>(null);

    const parseDDMMYYYY = (value: string): Date | null => {
        const v = String(value || '').trim();
        if (!v) return null;
        const parsed = parse(v, 'dd-MM-yyyy', new Date());
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const fmtDDMMYYYYToISO = (value: string): string | null => {
        const d = parseDDMMYYYY(value);
        return d ? format(d, 'yyyy-MM-dd') : null;
    };

    // Synchronously reset tab and form data when navigating between different employee records
    // This derived state pattern prevents unwanted API calls from the previous tab state.
    const [lastEditingId, setLastEditingId] = useState(editingIdEarly);
    if (editingIdEarly !== lastEditingId) {
        setLastEditingId(editingIdEarly);
        setActiveTab("personal");
        setFormData({});
    }

    // Reset tab to 'personal' whenever we enter ADD mode (extra safety)
    useEffect(() => {
        if (viewModeEarly === 'add') {
            setActiveTab("personal");
            setFormData({});
        }
    }, [viewModeEarly]);
    // ── Per-employee data (loaded ONLY when the relevant tab is active) ──────
    const { data: employeeDetailResponse } = useHrEmployee(
        viewModeEarly === 'edit' ? editingIdNum : null,
        { enabled: viewModeEarly === 'edit' && activeTab === 'personal' }
    );
    const { data: jobDetailsResponse } = useHrEmployeeJobDetails(
        viewModeEarly === 'edit' ? editingIdNum : null,
        { enabled: viewModeEarly === 'edit' && activeTab === 'job' }
    );
    const { data: employeeDocsResponse } = useHrEmployeeDocuments(
        viewModeEarly === 'edit' ? editingIdNum : null,
        { enabled: viewModeEarly === 'edit' && activeTab === 'docs' }
    );
    const { data: systemAccessResponse } = useHrEmployeeSystemAccess(
        viewModeEarly === 'edit' ? editingIdNum : null,
        { enabled: viewModeEarly === 'edit' && activeTab === 'system' }
    );
    const { data: workCentersResp } = useHrWorkCenters(isInFormView && activeTab === 'system');
    const { data: warehousesResp } = useHrWarehouses(undefined, isInFormView && activeTab === 'system');
    const { data: operationsResp } = useHrOperations(isInFormView && activeTab === 'system');
    const { data: documentTypesResp } = useHrDocumentTypes(isInFormView && activeTab === 'docs');

    const workCentersMap = new Map();
    const wcList = Array.isArray(workCentersResp?.data?.records) ? workCentersResp.data.records : 
                   Array.isArray(workCentersResp?.data) ? workCentersResp.data : [];
    wcList.forEach((wc: any) => {
        if (wc && wc.id && !workCentersMap.has(wc.id)) {
            workCentersMap.set(wc.id, { id: wc.id, name: wc.name || wc.value_name || wc.work_center_name || '' });
        }
    });
    const workCenters = Array.from(workCentersMap.values());

    const warehousesMap = new Map();
    const whList = Array.isArray(warehousesResp?.data?.records) ? warehousesResp.data.records : 
                   Array.isArray(warehousesResp?.data?.items) ? warehousesResp.data.items :
                   Array.isArray(warehousesResp?.data) ? warehousesResp.data : [];
    whList.forEach((wh: any) => {
        if (wh && wh.id && !warehousesMap.has(wh.id)) {
            warehousesMap.set(wh.id, { id: wh.id, name: wh.name || wh.value_name || '' });
        }
    });
    const warehouses = Array.from(warehousesMap.values());

    const operationsMap = new Map();
    const opList = Array.isArray(operationsResp?.data?.records) ? operationsResp.data.records : 
                   Array.isArray(operationsResp?.data) ? operationsResp.data : [];
    opList.forEach((op: any) => {
        if (op && op.id && !operationsMap.has(op.id)) {
            operationsMap.set(op.id, { 
                id: op.id, 
                name: op.name || op.value_name || op.operation_name || '',
                work_center_id: op.work_center_id || op.workcenter_id 
            });
        }
    });
    const operations = Array.from(operationsMap.values());

    // ── Form dropdowns (loaded when in form view) ────────────────────────────
    // const { data: gendersResp } = useHrGenders(isInFormView && activeTab === 'personal');
    // const { data: nationalitiesResp } = useHrNationalities(isInFormView && activeTab === 'personal');
    // const { data: bloodGroupsResp } = useHrBloodGroups(isInFormView && activeTab === 'personal');
    // const { data: maritalStatusesResp } = useHrMaritalStatuses(isInFormView && activeTab === 'personal');
    // const { data: employmentTypesResp } = useHrEmploymentTypes(isInFormView && activeTab === 'job');
    // const { data: gradesResp } = useHrGrades(isInFormView && activeTab === 'job');
    // const { data: locationsResp } = useHrLocations(isInFormView && (activeTab === 'job' || activeTab === 'system'));
    // const { data: shiftsResp } = useHrShifts(isInFormView && activeTab === 'job');
    // const { data: employmentStatusResp } = useHrEmploymentStatus(1, isInFormView && activeTab === 'job');
    const { data: rolesResp } = useHrRoles(isInFormView && activeTab === 'system');
    const { data: reportingManagersResp } = useHrReportingManagers(isInFormView && activeTab === 'job');
    const { data: countriesResp } = useHrCountries((isInFormView && activeTab === 'personal') || isImportModalOpen);
    // const { data: documentTypesResp } = useHrDocumentTypes(isInFormView && activeTab === 'docs');

    // Normalize dropdown data to { id, value_name } arrays
    const normalizeOptions = (records: any[], nameFields: string[] = ['value_name', 'name', 'country_name', 'state_name', 'city_name', 'role_name', 'employee_name', 'full_name']) => {
        const unique = new Map();
        (records || []).forEach((r: any) => {
            if (!r.id || unique.has(r.id)) return;
            let label = '';
            for (const field of nameFields) {
                if (r[field]) {
                    label = r[field];
                    break;
                }
            }
            unique.set(r.id, {
                id: r.id,
                value_name: label,
                employee_name: label, // for reporting managers
                code: r.code || r.country_code || r.state_code || r.value_code || ''
            });
        });
        return Array.from(unique.values());
    };

    // const genderOptions = normalizeOptions(gendersResp?.data?.records);
    // const nationalityOptions = normalizeOptions(nationalitiesResp?.data?.records);
    // const bloodGroupOptions = normalizeOptions(bloodGroupsResp?.data?.records);
    // const maritalStatusOptions = normalizeOptions(maritalStatusesResp?.data?.records);
    // const employmentTypeOptions = normalizeOptions(employmentTypesResp?.data?.records);
    // const gradeOptions = normalizeOptions(gradesResp?.data?.records);
    // const locationOptions = normalizeOptions(locationsResp?.data?.records);
    // const shiftOptions = normalizeOptions(shiftsResp?.data?.records);
    // const designationOptions = normalizeOptions(designationsResp?.data?.records);
    // const employmentStatusOptions = normalizeOptions(employmentStatusResp?.data?.records);
    const roleOptions = normalizeOptions(rolesResp?.data?.records);
    const reportingManagerOptions = normalizeOptions(reportingManagersResp?.data?.records);
    const countryOptions = normalizeOptions(countriesResp?.data?.records);
    // const documentTypeOptions = normalizeOptions(documentTypesResp?.data?.records);

    // Validation function to check if current tab's required fields are filled
    const isCurrentTabValid = (): boolean => {
        switch (activeTab) {
            case 'personal':
                return !!(
                    formData.firstName && 
                    NAME_REGEX.test(formData.firstName) &&
                    formData.lastName && 
                    NAME_REGEX.test(formData.lastName) &&
                    formData.mobileNumber && 
                    PHONE_REGEX.test(formData.mobileNumber) &&
                    (!formData.alternateMobile || (PHONE_REGEX.test(formData.alternateMobile) && formData.alternateMobile !== formData.mobileNumber)) &&
                    formData.gender_id && 
                    formData.dateOfBirth &&
                    formData.personalEmail &&
                    EMAIL_REGEX.test(formData.personalEmail) &&
                    (!formData.officialEmail || (EMAIL_REGEX.test(formData.officialEmail) && formData.officialEmail !== formData.personalEmail)) &&
                    formData.currentAddress &&
                    formData.country_id &&
                    formData.state_id &&
                    formData.city_id &&
                    formData.pincode && 
                    PINCODE_REGEX.test(formData.pincode) &&
                    (!formData.perm_pincode || PINCODE_REGEX.test(formData.perm_pincode))
                );
            case 'job': {
                const hasRequiredJobFields = !!(
                    formData.dateOfJoining &&
                    formData.department_id &&
                    formData.designation &&
                    formData.employment_type_id &&
                    formData.employment_status_id &&
                    formData.reporting_manager_employee_id &&
                    formData.work_location_id
                );
                return hasRequiredJobFields && !formData.hasEmploymentValidationErrors;
            }
            case 'docs': {
                const hasUploadedDocuments = formData.documents &&
                    formData.documents.length > 0 &&
                    formData.documents.some((doc: any) => doc.fileName && doc.fileUrl);
                return hasUploadedDocuments && !formData.documentsHasValidationErrors;
            }
            case 'system':
                return !formData.systemAccessHasValidationErrors;
            default:
                return true;
        }
    };



    const handleClear = () => {
        setFormData({});
        setActiveTab("personal");
        toast({ title: "Form Cleared", description: "All fields have been reset." });
    };

    // Derived Logic
    const viewMode = matchNew ? 'add' : (matchEditMode || matchView ? 'edit' : 'list');
    const editingId = (matchEditMode && paramsEdit ? paramsEdit.id : (matchView && paramsView ? paramsView.id : null));

    // List View State - wired to API params
    const searchTerm = listSearch;
    const setSearchTerm = setListSearch;
    const currentPage = listPage;
    const setCurrentPage = setListPage;
    const itemsPerPage = listLimit;
    const setItemsPerPage = setListLimit;

    // Import Modal State moved above (for hooks)

    // ─────────────────────────────────────────────────────────────────────────────
    // Import Template (STRICT)
    // - Employee Code MUST NOT be included (backend-generated)
    // - Headers and column sequence must match exactly
    // ─────────────────────────────────────────────────────────────────────────────
    const IMPORT_TEMPLATE_HEADERS = [
        "first_name",
        "last_name",
        "gender",
        "date_of_birth",
        "mobile_number",
        "personal_email",
        "current_address",
        "country",
        "state",
        "city",
        "pincode",
        "employment_status",
        "employment_type",
        "joining_date",
        "exit_date",
        "department",
        "designation",
        "reporting_manager",
        "location"
    ] as const;

    const IMPORT_REQUIRED_HEADERS = [
        "first_name",
        "last_name",
        "gender",
        "date_of_birth",
        "mobile_number",
        "personal_email",
        "current_address",
        "country",
        "state",
        "city",
        "pincode",
        "employment_status",
        "employment_type",
        "joining_date",
        "department",
        "designation",
        "reporting_manager",
        "location"
    ] as const;

    // Column variations mapping for flexible header matching
    const COLUMN_VARIATIONS: { [key: string]: string[] } = {
        'first_name': ['first_name', 'first name', 'firstname'],
        'last_name': ['last_name', 'last name', 'lastname'],
        'gender': ['gender'],
        'date_of_birth': ['date_of_birth', 'date of birth', 'dob'],
        'mobile_number': ['mobile_number', 'mobile number', 'phone', 'mobile'],
        'personal_email': ['personal_email', 'personal email', 'email'],
        'current_address': ['current_address', 'current address', 'address'],
        'country': ['country'],
        'state': ['state'],
        'city': ['city'],
        'pincode': ['pincode', 'postal code', 'zipcode'],
        'employment_status': ['employment_status', 'employment status', 'status'],
        'employment_type': ['employment_type', 'employment type', 'type'],
        'joining_date': ['joining_date', 'joining date', 'date of joining', 'doj'],
        'exit_date': ['exit_date', 'exit date'],
        'department': ['department', 'dept'],
        'designation': ['designation'],
        'reporting_manager': ['reporting_manager', 'reporting manager', 'reporting to'],
        'location': ['location', 'work location', 'work_location']
    };

    const normalizeImportHeaderKey = (h: unknown): string =>
        String(h ?? '')
            .trim()
            .toLowerCase()
            .replace(/[\s]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/[^a-z0-9_]/g, '');

    const IMPORT_HEADER_VARIATION_TO_CANONICAL: Record<string, string> = {
        firstname: 'first_name',
        first_name: 'first_name',
        first: 'first_name',
        lastname: 'last_name',
        last_name: 'last_name',
        last: 'last_name',
        dob: 'date_of_birth',
        dateofbirth: 'date_of_birth',
        date_of_birth: 'date_of_birth',
        mobilenumber: 'mobile_number',
        mobile_number: 'mobile_number',
        phone: 'mobile_number',
        mobile: 'mobile_number',
        email: 'personal_email',
        personalemail: 'personal_email',
        personal_email: 'personal_email',
        address: 'current_address',
        currentaddress: 'current_address',
        current_address: 'current_address',
        postalcode: 'pincode',
        zipcode: 'pincode',
        pincode: 'pincode',
        employmentstatus: 'employment_status',
        employment_status: 'employment_status',
        status: 'employment_status',
        employmenttype: 'employment_type',
        employment_type: 'employment_type',
        type: 'employment_type',
        joiningdate: 'joining_date',
        joining_date: 'joining_date',
        doj: 'joining_date',
        exitdate: 'exit_date',
        exit_date: 'exit_date',
        dept: 'department',
        department: 'department',
        designation: 'designation',
        reportingmanager: 'reporting_manager',
        reporting_manager: 'reporting_manager',
        reportingto: 'reporting_manager',
        worklocation: 'location',
        work_location: 'location',
        location: 'location',
        country: 'country',
        state: 'state',
        city: 'city',
    };

    const countMatchedImportHeaders = (row: unknown[]): number => {
        const matched = new Set<string>();
        row.forEach((cell) => {
            const key = normalizeImportHeaderKey(cell);
            if (!key) return;
            const canonical = IMPORT_HEADER_VARIATION_TO_CANONICAL[key] || key;
            matched.add(canonical);
        });
        return (IMPORT_REQUIRED_HEADERS as readonly string[]).filter((col) => matched.has(col)).length;
    };

    const REQUIRED_COLUMNS_DISPLAY = [...IMPORT_REQUIRED_HEADERS];
    const requiredImportColumns = [...IMPORT_TEMPLATE_HEADERS];

    // All supported import columns (required + optional)
    const allImportColumns = [...IMPORT_TEMPLATE_HEADERS];

    // Import file validation
    const validateImportFile = (file: File): string[] => {
        const errors: string[] = [];

        if (!file || file.size === 0) {
            errors.push('Please upload a valid Excel file (.xlsx or .xls)');
            return errors;
        }

        // Excel-only validation (IMPORTANT)
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel' // .xls
        ];

        const fileExtension = file.name.toLowerCase().split('.').pop();
        const isValidExtension = fileExtension === 'xlsx' || fileExtension === 'xls';

        if (!allowedTypes.includes(file.type) && !isValidExtension) {
            errors.push('Please upload a valid Excel file (.xlsx or .xls)');
        }

        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            errors.push('File size exceeds 10MB limit.');
        }

        return errors;
    };

    // Handle import file selection
    const handleImportFileChange = (file: File | null) => {
        setImportFile(file);
        setImportValidationErrors([]);
        setIsImportValid(false);
        setIsValidated(false);
        setValidationMessage('');
        setImportPreview(null);

        // Important: allow re-selecting the same file again
        if (!file) {
            if (importFileInputRef.current) importFileInputRef.current.value = '';
            return;
        }

        const errors = validateImportFile(file);
        setImportValidationErrors(errors);
    };

    // Normalize header names for comparison
    const normalizeHeader = (header: string): string => {
        return header.trim().toLowerCase().replace(/[_\s]+/g, ' ');
    };

    // Parse CSV content (actual file reader)
    const parseCSVContent = (content: string): { headers: string[], rows: string[][] } => {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length === 0) return { headers: [], rows: [] };

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const rows = lines.slice(1).map(line =>
            line.split(',').map(cell => cell.replace(/"/g, '').trim())
        );

        return { headers, rows };
    };

    // Read actual file content as ArrayBuffer
    const readFileContent = (file: File): Promise<ArrayBuffer> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as ArrayBuffer;
                resolve(content);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    };

    // Parse Excel: scan all sheets + first rows to find the real header row (not only row 1 of sheet 1)
    const parseFileWithXLSX = (
        data: ArrayBuffer
    ): {
        headers: string[];
        rows: any[][];
        sheetName: string;
        headerRowIndex: number;
        matchedRequiredCount: number;
    } => {
        const workbook = XLSX.read(data, { type: 'array' });
        let best = {
            headers: [] as string[],
            rows: [] as any[][],
            sheetName: workbook.SheetNames[0] || '',
            headerRowIndex: 0,
            matchedRequiredCount: 0,
        };

        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) continue;

            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                raw: true,
                defval: '',
            }) as unknown[][];

            const scanLimit = Math.min(30, jsonData.length);
            for (let r = 0; r < scanLimit; r++) {
                const row = (jsonData[r] || []) as unknown[];
                const matchedRequiredCount = countMatchedImportHeaders(row);
                if (matchedRequiredCount > best.matchedRequiredCount) {
                    best = {
                        sheetName,
                        headerRowIndex: r,
                        matchedRequiredCount,
                        headers: row.map((h) => String(h ?? '').trim()),
                        rows: jsonData.slice(r + 1) as any[][],
                    };
                }
            }
        }

        if (best.matchedRequiredCount === 0 && workbook.SheetNames.length > 0) {
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                raw: true,
                defval: '',
            }) as unknown[][];
            if (jsonData.length > 0) {
                const headerRow = (jsonData[0] || []) as unknown[];
                best = {
                    sheetName,
                    headerRowIndex: 0,
                    matchedRequiredCount: countMatchedImportHeaders(headerRow),
                    headers: headerRow.map((h) => String(h ?? '').trim()),
                    rows: jsonData.slice(1) as any[][],
                };
            }
        }

        return best;
    };

    // Validate file columns and row data
    const validateFileColumns = async () => {
        if (!importFile) return;

        try {
            setValidationMessage('Validating file...');

            const fileExtension = importFile.name.toLowerCase().split('.').pop();

            if (fileExtension !== 'xlsx' && fileExtension !== 'xls') {
                setValidationMessage('❌ Invalid file format');
                setIsImportValid(false);
                setImportValidationErrors(['Please upload a valid Excel file (.xlsx or .xls)']);
                setIsValidated(true);
                return;
            }

            // Read actual file content
            let fileArrayBuffer: ArrayBuffer;
            try {
                fileArrayBuffer = await readFileContent(importFile);
            } catch (error) {
                setValidationMessage('❌ Could not read file content');
                setIsImportValid(false);
                setImportValidationErrors(['Could not read file. Please try again.']);
                setIsValidated(true);
                return;
            }

            // Parse the content using XLSX library (handles XLSX/XLS)
            const {
                headers,
                rows,
                sheetName,
                headerRowIndex,
                matchedRequiredCount,
            } = parseFileWithXLSX(fileArrayBuffer);

            if (headers.length === 0 || matchedRequiredCount < 3) {
                setValidationMessage('❌ Could not find employee import headers');
                setIsImportValid(false);
                setImportValidationErrors([
                    'Could not find employee column headers in this workbook.',
                    'Ensure the first row of your data sheet has columns like first_name, last_name, gender, etc.',
                    sheetName
                        ? `Checked sheet "${sheetName}" (row ${headerRowIndex + 1}) first — use the employee data sheet if this file has multiple tabs.`
                        : 'No sheets found in the file.',
                ]);
                setIsValidated(true);
                return;
            }

            const normalizedHeaders = headers.map((h) => String(h || '').trim());
            const normalizedHeaderKeys = headers.map((h) => normalizeImportHeaderKey(h));

            const hasEmployeeCodeColumn = normalizedHeaderKeys.some((n) =>
                n === 'employee_code' || n === 'employeeid' || n === 'employee_id' || n === 'emp_code' || n === 'empid' || n === 'emp_id'
            );

            const expected = [...IMPORT_TEMPLATE_HEADERS];
            const required = [...IMPORT_REQUIRED_HEADERS] as const;

            const requiredSet = new Set(required as unknown as string[]);

            // Variations mapping (e.g. "First Name" -> first_name)
            const headerIndexByCanonical: Record<string, number> = {};
            normalizedHeaderKeys.forEach((k, idx) => {
                const canonical = IMPORT_HEADER_VARIATION_TO_CANONICAL[k] || k;
                if (headerIndexByCanonical[canonical] === undefined) {
                    headerIndexByCanonical[canonical] = idx;
                }
            });

            // Fallback matching using normalized display headers + COLUMN_VARIATIONS
            // (handles odd whitespace / punctuation that may survive normalizeKey)
            required.forEach((canonical) => {
                if (headerIndexByCanonical[canonical] !== undefined) return;
                const variations = (COLUMN_VARIATIONS as any)[canonical] as string[] | undefined;
                if (!variations || variations.length === 0) return;
                const foundIdx = normalizedHeaders.findIndex((h) => {
                    const nh = normalizeHeader(h);
                    return variations.some((v) => normalizeHeader(v) === nh);
                });
                if (foundIdx >= 0) headerIndexByCanonical[canonical] = foundIdx;
            });

            const missingRequired = required.filter((col) => headerIndexByCanonical[col] === undefined);
            if (missingRequired.length > 0) {
                const detected = normalizedHeaders.filter((h) => h).join(', ');
                setValidationMessage('❌ Missing Required Columns');
                setIsImportValid(false);
                setImportValidationErrors([
                    `Missing Required Columns:\n- ${missingRequired.join('\n- ')}`,
                    `Using sheet "${sheetName}", header row ${headerRowIndex + 1}.`,
                    detected ? `Columns detected on that row: ${detected}` : 'No column names were read on the header row.',
                ]);
                setIsValidated(true);
                setImportPreview(null);
                return;
            }

            const getCell = (row: any[], canonical: string) => {
                const idx = headerIndexByCanonical[canonical];
                const rawVal = idx !== undefined ? row?.[idx] : '';
                return rawVal;
            };

            const asTrimmedString = (v: any) => String(v ?? '').trim();

            // date helpers declared at component level

            const rowResults: { rowNumber: number; values: Record<string, string>; errors: string[] }[] = [];
            let validRows = 0;
            let invalidRows = 0;

            const ROW_REQUIRED_FIELDS = [
                "first_name",
                "mobile_number",
                "personal_email",
                "department",
                "designation",
                "joining_date",
                "location",
            ] as const;

            rows.forEach((row, rIdx) => {
                const rowNumber = headerRowIndex + rIdx + 2;
                const values: Record<string, string> = {};
                // Store canonical values for required keys (and known optional ones)
                const keysToStore = Array.from(new Set<string>([...expected, ...required]));
                keysToStore.forEach((key) => {
                    values[key] = asTrimmedString(getCell(row, key));
                });

                // Ignore completely empty rows
                const isEmpty = Object.keys(values).every((k) => !values[k]);
                if (isEmpty) return;

                const errors: string[] = [];

                // Required fields (row-level)
                ROW_REQUIRED_FIELDS.forEach((h) => {
                    if (!values[h]) errors.push(`${h} is required`);
                });

                // Date validation intentionally skipped (frontend does not validate date formats)

                if (errors.length === 0) validRows++;
                else invalidRows++;

                rowResults.push({ rowNumber, values, errors });
            });

            const totalRows = validRows + invalidRows;
            if (totalRows === 0) {
                setValidationMessage('❌ File appears to be empty or invalid');
                setIsImportValid(false);
                setImportValidationErrors(['File appears to be empty or has no data rows.']);
                setIsValidated(true);
                setImportPreview(null);
                return;
            }

            setImportPreview({ totalRows, validRows, invalidRows, rowResults });
            setIsImportValid(invalidRows === 0);

            if (invalidRows === 0) {
                setValidationMessage('✅ Validation Successful: Required columns and row validations passed');
                setImportValidationErrors(
                    hasEmployeeCodeColumn ? ["Employee Code is auto-generated and should not be included."] : []
                );
            } else {
                setValidationMessage('❌ Validation Failed: Some rows have missing required fields.');
                // Frontend validation errors are shown in the "Invalid Rows" section above
                setImportValidationErrors([]);
            }
            setIsValidated(true);

        } catch (error) {
            console.error('Validation error:', error);
            setValidationMessage('❌ Validation Error: Could not process file');
            setIsImportValid(false);
            setImportValidationErrors(['Could not validate file. Please try again.']);
            setIsValidated(true);
        }
    };

    // Handle import execution
    const handleImportEmployees = async () => {
        if (!importFile || !isImportValid) return;

        try {
            toast({
                title: "Import Started",
                description: "Processing employee data import...",
                className: "bg-blue-50 border-blue-200 text-blue-900"
            });

            const formData = new FormData();
            formData.append('file', importFile);
            const result: any = await hrEmployeeApi.importEmployees(formData);

            const successCount =
                result?.data?.successCount ??
                result?.data?.success_count ??
                result?.data?.success ??
                result?.data?.inserted ??
                result?.inserted ??
                0;
            const failCount =
                result?.data?.failCount ??
                result?.data?.fail_count ??
                result?.data?.failed ??
                result?.failed ??
                0;

            // Map backend row/field errors into UI error list (if provided)
            const apiErrors: any[] =
                result?.data?.errors ||
                result?.errors ||
                [];

            const formatImportApiError = (e: any): string => {
                const row = e?.row ?? e?.rowNumber ?? e?.row_number;
                const rowPrefix = (row !== undefined && row !== null && String(row).trim() !== '') ? `Row ${row} → ` : '';
                const field = String(e?.field ?? e?.column ?? e?.key ?? '').trim();
                const firstName = String(e?.first_name ?? e?.firstName ?? '').trim();
                const lastName = String(e?.last_name ?? e?.lastName ?? '').trim();
                const who = [firstName, lastName].filter(Boolean).join(' ');
                const rawReason = String(e?.reason ?? e?.message ?? e?.error ?? '').trim();

                // Keep message short & readable
                let reason = rawReason
                    .replace(/Employee created but sub-inserts failed\s*\(rolled back\)\s*:\s*/i, '')
                    .replace(/\(check\s*value_name\s*in\s*entity_values\)/ig, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (!reason) reason = 'Invalid data';

                const head = field ? `${field}: ` : (who ? `${who}: ` : '');
                return `${rowPrefix}${head}${reason}`.trim();
            };

            if (failCount > 0 && Array.isArray(apiErrors) && apiErrors.length > 0) {
                setImportValidationErrors(apiErrors.slice(0, 200).map(formatImportApiError));
                toast({
                    title: successCount > 0 ? "Import Completed" : "Import Failed",
                    description: result?.message || `Imported ${successCount} employee(s). Failed: ${failCount}.`,
                    variant: "destructive"
                });
                return;
            }

            toast({
                title: "Import Completed",
                description: `Imported ${successCount} employee(s). Failed: ${failCount}.`,
                className: "bg-green-50 border-green-200 text-green-900"
            });

            // Refresh employee listing after import
            queryClient.invalidateQueries({ queryKey: ["hr-employees"] });

            // Reset and close modal
            setIsImportModalOpen(false);
            setImportFile(null);
            setImportValidationErrors([]);
            setIsImportValid(false);
            setIsValidated(false);
            setValidationMessage('');
            setImportPreview(null);

            // Reset to first page to show imported employees
            setCurrentPage(1);
            setSearchTerm('');

        } catch (error) {
            console.error('Import error:', error);
            const errData: any = (error as any)?.data;
            const apiErrors: any[] =
                errData?.data?.errors ||
                errData?.errors ||
                [];

            if (Array.isArray(apiErrors) && apiErrors.length > 0) {
                const formatImportApiError = (e: any): string => {
                    const row = e?.row ?? e?.rowNumber ?? e?.row_number;
                    const rowPrefix = (row !== undefined && row !== null && String(row).trim() !== '') ? `Row ${row} → ` : '';
                    const field = String(e?.field ?? e?.column ?? e?.key ?? '').trim();
                    const firstName = String(e?.first_name ?? e?.firstName ?? '').trim();
                    const lastName = String(e?.last_name ?? e?.lastName ?? '').trim();
                    const who = [firstName, lastName].filter(Boolean).join(' ');
                    const rawReason = String(e?.reason ?? e?.message ?? e?.error ?? '').trim();

                    let reason = rawReason
                        .replace(/Employee created but sub-inserts failed\s*\(rolled back\)\s*:\s*/i, '')
                        .replace(/\(check\s*value_name\s*in\s*entity_values\)/ig, '')
                        .replace(/\s+/g, ' ')
                        .trim();

                    if (!reason) reason = 'Invalid data';
                    const head = field ? `${field}: ` : (who ? `${who}: ` : '');
                    return `${rowPrefix}${head}${reason}`.trim();
                };
                setImportValidationErrors(apiErrors.slice(0, 200).map(formatImportApiError));
            }
            toast({
                title: "Import Failed",
                description: errData?.message || (error as any)?.message || "An error occurred while importing employee data.",
                variant: "destructive"
            });
        }
    };

    // Department filter - maps to API param
    const [departmentFilter, setDepartmentFilter] = useState<string>("all");
    useEffect(() => {
        if (departmentFilter === "all") {
            setListDeptFilter(undefined);
        } else {
            const dept = departments.find(d => d.name === departmentFilter);
            setListDeptFilter(dept ? dept.id : undefined);
        }
        setListPage(1);
    }, [departmentFilter]);

    // Reset page on search change
    useEffect(() => { setListPage(1); }, [debouncedSearch]);

    // Server-side filtered/paginated — use the API results directly
    const filteredEmployees = employees;
    const totalPages = employeeListResponse?.data?.pagination?.totalPages || Math.ceil(listTotalItems / (itemsPerPage || 10));
    const paginatedEmployees = employees; // API already paginates

    // Row selection (pagination-compatible)
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
    const getEmployeeRowKey = (e: any, idx?: number) => {
        // Prefer backend id, fallback to employee code, then stable-ish composite
        if (e?.id !== undefined && e?.id !== null && String(e.id).trim() !== '') return String(e.id);
        if (e?.employeeId) return String(e.employeeId);
        if (e?.code) return String(e.code);
        if (idx !== undefined) return `row_${idx}`;
        return `row_${String(e?.email || e?.phone || '')}_${String(e?.firstName || '')}_${String(e?.lastName || '')}`.toLowerCase();
    };

    const currentPageEmployeeIds = useMemo(
        () => (paginatedEmployees || []).map((e: any, idx: number) => getEmployeeRowKey(e, idx)),
        [paginatedEmployees]
    );
    const isAllCurrentPageSelected = useMemo(() => {
        if (currentPageEmployeeIds.length === 0) return false;
        return currentPageEmployeeIds.every((id) => selectedEmployeeIds.has(id));
    }, [currentPageEmployeeIds, selectedEmployeeIds]);
    const isSomeCurrentPageSelected = useMemo(() => {
        return currentPageEmployeeIds.some((id) => selectedEmployeeIds.has(id));
    }, [currentPageEmployeeIds, selectedEmployeeIds]);

    const toggleEmployeeSelection = (employeeId: string, checked: boolean) => {
        setSelectedEmployeeIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(employeeId);
            else next.delete(employeeId);
            return next;
        });
    };

    const toggleSelectAllCurrentPage = (checked: boolean) => {
        setSelectedEmployeeIds((prev) => {
            const next = new Set(prev);
            if (checked) {
                currentPageEmployeeIds.forEach((id) => next.add(id));
            } else {
                currentPageEmployeeIds.forEach((id) => next.delete(id));
            }
            return next;
        });
    };

    const handleExportEmployees = async () => {
        try {
            const selectedIds = (paginatedEmployees || [])
                .filter((emp: any, idx: number) => selectedEmployeeIds.has(getEmployeeRowKey(emp, idx)))
                .map((emp: any) => emp?.id)
                .filter((id: any) => id !== undefined && id !== null && String(id).trim() !== '')
                .map((id: any) => Number(id))
                .filter((id: number) => Number.isFinite(id));

            if (selectedIds.length === 0) {
                toast({
                    title: "Nothing to Export",
                    description: "Please select at least one employee.",
                    variant: "destructive"
                });
                return;
            }

            const response: any = await hrEmployeeApi.exportEmployees(selectedIds);
            const records = response?.data || response?.data?.records || response?.records || [];

            const headers = [...IMPORT_TEMPLATE_HEADERS];
            const rows = (records || []).map((emp: any) => {
                const personal = emp?.personal || {};
                const employment = emp?.employment || {};
                const addresses = Array.isArray(emp?.addresses) ? emp.addresses : [];
                const currentAddr =
                    addresses.find((a: any) => String(a?.address_type || '').toLowerCase() === 'current') ||
                    addresses[0] ||
                    {};

                const valuesByKey: Record<string, any> = {
                    first_name: personal?.first_name ?? '',
                    last_name: personal?.last_name ?? '',
                    gender: personal?.gender ?? '',
                    date_of_birth: personal?.date_of_birth ?? '',
                    mobile_number: personal?.mobile_number ?? '',
                    personal_email: personal?.personal_email ?? '',
                    current_address: currentAddr?.address_line ?? '',
                    country: currentAddr?.country ?? '',
                    state: currentAddr?.state ?? '',
                    city: currentAddr?.city ?? '',
                    pincode: currentAddr?.pincode ?? '',
                    employment_status: employment?.employment_status ?? '',
                    employment_type: employment?.employment_type ?? '',
                    joining_date: employment?.date_of_joining ?? '',
                    exit_date: employment?.exit_date ?? '',
                    department: employment?.department ?? '',
                    designation: employment?.designation ?? '',
                    reporting_manager: employment?.reporting_manager ?? '',
                    location: employment?.work_location ?? '',
                };

                return headers.map((h) => valuesByKey[h] ?? '');
            });

            if (rows.length === 0) {
                toast({
                    title: "Nothing to Export",
                    description: "No data returned from export.",
                    variant: "destructive"
                });
                return;
            }

            const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
            XLSX.writeFile(workbook, `employees_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (e) {
            toast({
                title: "Export Failed",
                description: "Could not export employee list. Please try again.",
                variant: "destructive"
            });
        }
    };


    // Logic: Form State


    // Logic: Page State

    // Form State
    // const [editingId, setEditingId] = useState<string | null>(null); // Derived form URL
    const [isEditing, setIsEditing] = useState(!!matchEditMode || !!matchNew);

    // Sync isEditing with URL state for persistence across refreshes
    useEffect(() => {
        if (matchEditMode || matchNew) {
            setIsEditing(true);
        } else if (matchView) {
            setIsEditing(false);
        }
    }, [matchEditMode, matchNew, matchView]);
    // [MOVED UP] const [activeTab, setActiveTab] = useState("personal");
    // [MOVED UP] const [formData, setFormData] = useState<any>({});

    // Pre-fetch states/cities at parent level so they're cached when PersonalDetailsForm renders
    const { data: parentStatesResp } = useHrStates(formData.country_id, isInFormView && activeTab === 'personal' && !!formData.country_id);
    const { data: parentCitiesResp } = useHrCities(formData.state_id, isInFormView && activeTab === 'personal' && !!formData.state_id);
    const parentStateOptions = (parentStatesResp?.data?.records || []).map((r: any) => ({
        id: r.id,
        value_name: r.state_name || r.name || r.value_name || '',
        code: r.state_code || r.code || r.value_code || ''
    }));
    const parentCityOptions = (parentCitiesResp?.data?.records || []).map((r: any) => ({
        id: r.id,
        value_name: r.city_name || r.name || r.value_name || '',
        code: r.city_code || r.code || r.value_code || ''
    }));

    // Pre-fetch perm address states/cities (warms the React Query cache for PersonalDetailsForm's local hooks)
    useHrStates(formData.perm_country_id, isInFormView && activeTab === 'personal' && !!formData.perm_country_id);
    useHrCities(formData.perm_state_id, isInFormView && activeTab === 'personal' && !!formData.perm_state_id);

    // Designations are independent of department — fetch all on form open
    // const { data: designationsResp } = useHrDesignations(isInFormView && activeTab === 'job');
    // const designationOptions = (designationsResp?.data?.records || []).map((r: any) => ({
    //     id: r.id,
    //     value_name: r.name || r.value_name || '',
    //     code: r.code || '',
    // }));

    // Initialize form with defaults
    const resetForm = () => {
        setFormData({
            firstName: "",
            lastName: "",
            photo: null,
            // Personal IDs
            gender_id: null,
            nationality_id: null,
            blood_group_id: null,
            marital_status_id: null,
            dateOfBirth: undefined,
            anniversaryDate: undefined,
            // Contact
            mobileNumber: "",
            alternateMobile: "",
            personalEmail: "",
            officialEmail: "",
            // Address
            currentAddress: "",
            permanentAddress: "",
            sameAsCurrentAddress: false,
            country_id: null,
            state_id: null,
            city_id: null,
            pincode: "",
            perm_country_id: null,
            perm_state_id: null,
            perm_city_id: null,
            perm_pincode: "",
            // Job details IDs
            employment_status_id: null,
            employment_type_id: null,
            dateOfJoining: undefined,
            exitDate: undefined,
            department_id: null,
            designation: "",
            designation_id: null,
            grade_id: null,
            reporting_manager_employee_id: null,
            work_location_id: null,
            shift_id: null,
            // Documents
            documents: [],
            // System Access
            enableLoginAccess: false,
            username: "",
            password: "",
            selected_role_ids: [],
            assignedWorkCenters: [],
            assignedWarehouses: [],
            assignedOperations: [],
        });
        setActiveTab("personal");
    };

    // Effect: reset form when creating a new employee
    useEffect(() => {
        if (viewMode === 'add') resetForm();
    }, [viewMode]);

    // Effect: populate formData from API when editing an existing employee
    useEffect(() => {
        if (viewMode !== 'edit' || !editingId) return;
        const emp = employeeDetailResponse?.data;
        if (!emp) return;

        const safeParseDate = globalSafeParseDate;

        // Helper to map legacy/mismatched IDs via string labels
        const findOptionId = (options: any[], id: any, name?: string) => {
            if (id && options.some(o => o.id === id)) return id;
            if (!name) return id || null;
            const match = options.find(o =>
                String(o.value_name || '').toLowerCase() === String(name || '').toLowerCase() ||
                String(o.code || '').toLowerCase() === String(name || '').toLowerCase()
            );
            return match ? match.id : (id || null);
        };

        const currentAddr = (emp.addresses || []).find((a: any) => 
            a.address_type_id === 1 || 
            String(a.address_type || '').toLowerCase() === 'current'
        ) || {};
        const permanentAddr = (emp.addresses || []).find((a: any) => 
            a.address_type_id === 2 || 
            String(a.address_type || '').toLowerCase() === 'permanent'
        ) || {};

        setFormData((prev: any) => ({
            ...prev,
            // Identity
            employee_id: emp.id,
            employeeId: emp.code || `EMP${emp.id}`,
            employeeCode: emp.code || `EMP${emp.id}`,
            firstName: emp.first_name || '',
            lastName: emp.last_name || '',
            photo: emp.photo_url || '',
            // Personal
            gender_id: findOptionId(genders, emp.gender_id, emp.gender),
            nationality_id: findOptionId(nationalities, emp.nationality_id, emp.nationality),
            blood_group_id: findOptionId(bloodGroups, emp.blood_group_id, emp.blood_group),
            marital_status_id: findOptionId(maritalStatuses, emp.marital_status_id, emp.marital_status),
            dateOfBirth: safeParseDate(emp.date_of_birth),
            anniversaryDate: safeParseDate(emp.anniversary_date),
            // Contact
            mobileNumber: emp.mobile_number || '',
            alternateMobile: emp.alternate_mobile || '',
            personalEmail: emp.personal_email || '',
            officialEmail: emp.official_email || '',
            // Address
            currentAddress: currentAddr.address_line || '',
            permanentAddress: permanentAddr.address_line || '',
            country_id: findOptionId(countryOptions, currentAddr.country_id, currentAddr.country_name || emp.country),
            country_name: currentAddr.country_name || emp.country || '',
            state_id: currentAddr.state_id || null, 
            state_name: currentAddr.state_name || emp.state || '',
            city_id: currentAddr.city_id || null,
            city_name: currentAddr.city_name || emp.city || '',
            pincode: currentAddr.pincode || '',
            perm_country_id: findOptionId(countryOptions, permanentAddr.country_id, permanentAddr.country_name || emp.perm_country),
            perm_country_name: permanentAddr.country_name || emp.perm_country || '',
            perm_state_id: permanentAddr.state_id || null,
            perm_state_name: permanentAddr.state_name || emp.perm_state || '',
            perm_city_id: permanentAddr.city_id || null,
            perm_city_name: permanentAddr.city_name || emp.city || '',
            perm_pincode: permanentAddr.pincode || '',
        }));
    }, [employeeDetailResponse, viewMode, editingId]);

    // Effect: populate job details tab from API
    useEffect(() => {
        if (viewMode !== 'edit' || !editingId) return;
        const job = jobDetailsResponse?.data;
        if (!job) return;
        const safeParseDate = globalSafeParseDate;

        // API has a typo: "employement_status_id" — read both spellings as fallback
        const rawStatusId = (job as any).employement_status_id ?? job.employment_status_id ?? null;
        const rawStatusName = (job as any).employement_status ?? (job as any).employment_status ?? null;
        // Match by name against static options so mismatched IDs still resolve
        const matchedStatus = employmentStatuses.find(
            (s: any) => String(s.value_name).toLowerCase() === String(rawStatusName || '').toLowerCase()
        );
        const resolvedStatusId = matchedStatus?.id ?? rawStatusId;

        setFormData((prev: any) => ({
            ...prev,
            employment_status_id: resolvedStatusId,
            employment_type_id: job.employment_type_id || null,
            dateOfJoining: safeParseDate(job.date_of_joining),
            exitDate: safeParseDate(job.exit_date),
            department_id: job.department_id || null,
            designation: job.designation || '',
            designation_id: job.designation_id || null,
            grade_id: job.grade_id || null,
            reporting_manager_employee_id: job.reporting_manager_employee_id || null,
            work_location_id: job.work_location_id || null,
            shift_id: job.shift_id || null,
        }));
    }, [jobDetailsResponse, viewMode, editingId]);

    // Effect: populate documents tab from API
    useEffect(() => {
        if (viewMode !== 'edit' || !editingId) return;
        const docs = employeeDocsResponse?.data?.records;
        if (!docs) return;
        setFormData((prev: any) => ({
            ...prev,
            documents: docs.map((d: any) => ({
                id: d.id,
                type: d.document_type || `Type ${d.document_type_id}`,
                document_type_id: d.document_type_id,
                name: d.document_name,
                fileName: d.file_name || d.document_name,
                fileUrl: d.file_url || '',
                fromApi: true,
            })),
        }));
    }, [employeeDocsResponse, viewMode, editingId]);

    // Effect: populate system access tab from API
    useEffect(() => {
        if (viewMode !== 'edit' || !editingId) return;
        const access = systemAccessResponse?.data;
        if (!access) return;

        // Robust role extraction
        const apiRoles = Array.isArray(access.roles) ? access.roles.map((r: any) => Number(r.id || r.role_id)) : [];
        const primaryRole = access.role_id ? [Number(access.role_id)] : [];
        const combinedRoles = Array.from(new Set([...apiRoles, ...primaryRole])).filter(id => !isNaN(id) && id > 0);

        const hasSystemData = !!(access.username || access.email || combinedRoles.length > 0);
        
        setFormData((prev: any) => ({
            ...prev,
            enable_login: !!access.enable_login,
            enableLoginAccess: !!access.enable_login,
            username: access.email || access.username || '',
            selected_role_ids: combinedRoles,
            work_location_id: access.location_id || prev.work_location_id,
            assignedWorkCenters: (access.assigned_work_centers || access.assigned_work_center_ids || []).map((wc: any) => typeof wc === 'object' ? String(wc.id) : String(wc)),
            assignedWarehouses: (access.assigned_warehouses || access.assigned_warehouse_ids || []).map((wh: any) => typeof wh === 'object' ? String(wh.id) : String(wh)),
            assignedOperations: (access.assigned_operations || access.assigned_operation_ids || []).map((op: any) => typeof op === 'object' ? String(op.id) : String(op)),
        }));
    }, [systemAccessResponse, viewMode, editingId]);

    // Effect to fix all input field caret visibility in CoreHR module
    useEffect(() => {
        const fixAllInputCarets = () => {
            // Target all input and textarea fields in the CoreHR module
            const allInputs = document.querySelectorAll('input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea');
            allInputs.forEach((input: any) => {
                if (input) {
                    // Force styles immediately
                    input.style.setProperty('caret-color', '#000000', 'important');
                    input.style.setProperty('color', '#333333', 'important');
                    input.style.setProperty('-webkit-text-fill-color', '#333333', 'important');
                    input.style.setProperty('-webkit-caret-color', '#000000', 'important');
                    input.style.setProperty('-moz-caret-color', '#000000', 'important');

                    // Create a MutationObserver to watch for style changes
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                                // Re-apply our styles if they get overridden
                                input.style.setProperty('caret-color', '#000000', 'important');
                                input.style.setProperty('color', '#333333', 'important');
                                input.style.setProperty('-webkit-text-fill-color', '#333333', 'important');
                                input.style.setProperty('-webkit-caret-color', '#000000', 'important');
                                input.style.setProperty('-moz-caret-color', '#000000', 'important');
                            }
                        });
                    });

                    // Start observing
                    observer.observe(input, {
                        attributes: true,
                        attributeFilter: ['style']
                    });

                    // Add event listeners with forced styles
                    const handleEvent = () => {
                        setTimeout(() => {
                            input.style.setProperty('caret-color', '#000000', 'important');
                            input.style.setProperty('color', '#333333', 'important');
                            input.style.setProperty('-webkit-text-fill-color', '#333333', 'important');
                            input.style.setProperty('-webkit-caret-color', '#000000', 'important');
                            input.style.setProperty('-moz-caret-color', '#000000', 'important');
                        }, 0);
                    };

                    input.addEventListener('focus', handleEvent);
                    input.addEventListener('input', handleEvent);
                    input.addEventListener('click', handleEvent);
                    input.addEventListener('keydown', handleEvent);
                    input.addEventListener('keyup', handleEvent);

                    // Cleanup function
                    return () => {
                        observer.disconnect();
                        input.removeEventListener('focus', handleEvent);
                        input.removeEventListener('input', handleEvent);
                        input.removeEventListener('click', handleEvent);
                        input.removeEventListener('keydown', handleEvent);
                        input.removeEventListener('keyup', handleEvent);
                    };
                }
            });
        };

        // Fix immediately and repeatedly
        fixAllInputCarets();
        const interval = setInterval(fixAllInputCarets, 500); // Check every 500ms

        return () => clearInterval(interval);
    }, [viewMode]); // Re-run when view mode changes

    const refreshQueryData = (id?: number) => {
        // Invalidate common metadata used in the form
        const commonKeys = [
            'hr-departments', 'hr-genders', 'hr-nationalities', 'hr-blood-groups',
            'hr-marital-statuses', 'hr-employment-types', 'hr-grades', 'hr-designations',
            'hr-locations', 'hr-shifts', 'hr-roles', 'hr-reporting-managers', 'hr-countries'
        ];
        commonKeys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));

        // Invalidate employee-specific data if an ID is provided
        if (id) {
            const employeeKeys = ['hr-employee', 'hr-employee-job', 'hr-employee-docs', 'hr-employee-system'];
            employeeKeys.forEach(key => queryClient.invalidateQueries({ queryKey: [key, id] }));
        }
    };

    const handleAddNew = () => {
        setIsEditing(true);
        refreshQueryData();
        setLocation("/hrms/core-hr/employees/new");
    };

    const handleView = (employee: any) => {
        setIsEditing(false);
        refreshQueryData(employee.id);
        setLocation(`/hrms/core-hr/employees/${employee.id}`);
    };

    const handleEdit = (employee: any) => {
        setIsEditing(true);
        refreshQueryData(employee.id);
        setLocation(`/hrms/core-hr/employees/${employee.id}/edit`);
    };

    const handleBackToList = () => {
        // Clear any form state and ensure we're on the first page to see new employees
        setSearchTerm("");
        setCurrentPage(1);
        // Force an invalidation of the employee list to ensure fresh data is fetched when returning to the listing
        queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
        setLocation("/hrms/core-hr");
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
    };

    const handleNextTab = () => {
        if (activeTab === "personal") setActiveTab("job");
        else if (activeTab === "job") setActiveTab("docs");
        else if (activeTab === "docs") setActiveTab("system");
        // No more tabs after system
    };

    // Helper: safe date format
    const fmtDate = (d: any) =>
        d && !isNaN(new Date(d).getTime()) ? format(new Date(d), 'yyyy-MM-dd') : null;

    const handleSave = async (shouldExit: boolean = false) => {
        if (!shouldExit) { handleNextTab(); return; }

        try {
            // ── Personal tab ────────────────────────────────────────────────
            if (activeTab === 'personal') {
                if (!formData.firstName || !formData.lastName || !formData.personalEmail) {
                    toast({ title: "Validation Error", description: "First Name, Last Name, and Personal Email are required.", variant: "destructive" });
                    return;
                }

                // Photo size validation (deferred to Save button)
                if (formData.photo instanceof File) {
                    const maxPhotoSize = 2 * 1024 * 1024; // 2MB
                    if (formData.photo.size > maxPhotoSize) {
                        toast({
                            description: "Profile photo must be less than 2MB.",
                            variant: "destructive"
                        });
                        return;
                    }
                }
                const addresses: any[] = [];
                if (formData.currentAddress || formData.country_id) {
                    addresses.push({
                        address_type_id: 1,
                        address_line: formData.currentAddress || '',
                        city_id: formData.city_id || null,
                        state_id: formData.state_id || null,
                        country_id: formData.country_id || null,
                        pincode: formData.pincode || '',
                    });
                }
                if (formData.permanentAddress || formData.perm_country_id) {
                    addresses.push({
                        address_type_id: 2,
                        address_line: formData.sameAsCurrentAddress ? formData.currentAddress : formData.permanentAddress || '',
                        city_id: formData.sameAsCurrentAddress ? formData.city_id : formData.perm_city_id || null,
                        state_id: formData.sameAsCurrentAddress ? formData.state_id : formData.perm_state_id || null,
                        country_id: formData.sameAsCurrentAddress ? formData.country_id : formData.perm_country_id || null,
                        pincode: formData.sameAsCurrentAddress ? formData.pincode : formData.perm_pincode || '',
                    });
                }
                const personalPayload: any = {
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    date_of_birth: fmtDate(formData.dateOfBirth),
                    gender_id: formData.gender_id || null,
                    nationality_id: formData.nationality_id || null,
                    blood_group_id: formData.blood_group_id || null,
                    marital_status_id: formData.marital_status_id || null,
                    anniversary_date: fmtDate(formData.anniversaryDate),
                    mobile_number: formData.mobileNumber || '',
                    alternate_mobile: formData.alternateMobile || '',
                    personal_email: formData.personalEmail || '',
                    official_email: formData.officialEmail || '',
                    photo_url: typeof formData.photo === 'string' ? formData.photo : null,
                    addresses,
                };

                let finalPayload: any = personalPayload;
                if (formData.photo instanceof File) {
                    const fd = new FormData();
                    Object.keys(personalPayload).forEach(key => {
                        if (key === 'addresses') {
                            fd.append(key, JSON.stringify(personalPayload[key]));
                        } else if (key !== 'photo_url' && personalPayload[key] !== null && personalPayload[key] !== undefined) {
                            fd.append(key, personalPayload[key]);
                        }
                    });
                    fd.append('photo', formData.photo);
                    finalPayload = fd;
                }

                if (viewMode === 'add') {
                    const result = await createEmployeeMutation.mutateAsync(finalPayload);
                    const newId = result?.data?.id;
                    toast({ title: "Employee Created", description: "Employee record created successfully. Moving to Job Details.", className: "bg-green-50 border-green-200 text-green-900 shadow-md" });
                    setSearchTerm('');
                    setCurrentPage(1);
                    // Stay in the form but switch to edit mode by updating location and move to next tab
                    setLocation(`/hrms/core-hr/employees/${newId}/edit`);
                    setActiveTab("job");
                    setLastEditingId(newId.toString());
                } else if (editingId) {
                    await updateEmployeeMutation.mutateAsync({ id: parseInt(editingId), data: finalPayload });
                    toast({ title: "Personal Details Saved", className: "bg-green-50 border-green-200 text-green-900 shadow-md" });
                    handleNextTab(); // Redirect to next tab (job)
                }
                return;
            }

            // ── Job details tab ──────────────────────────────────────────────
            if (activeTab === 'job') {
                if (!editingId) return;
                const jobPayload: any = {
                    employee_id: parseInt(editingId),
                    employment_status_id: formData.employment_status_id || null,
                    employment_type_id: formData.employment_type_id || null,
                    date_of_joining: fmtDate(formData.dateOfJoining),
                    exit_date: fmtDate(formData.exitDate),
                    department_id: formData.department_id || null,
                    designation: formData.designation || '',
                    designation_id: formData.designation_id || null,
                    grade_id: formData.grade_id || null,
                    reporting_manager_employee_id: formData.reporting_manager_employee_id || null,
                    work_location_id: formData.work_location_id || null,
                    shift_id: formData.shift_id || null,
                };
                const hasJobDetails = !!(jobDetailsResponse?.data);
                if (hasJobDetails) {
                    await updateJobDetailsMutation.mutateAsync({ id: parseInt(editingId), data: jobPayload });
                } else {
                    await addJobDetailsMutation.mutateAsync(jobPayload);
                }
                toast({ title: "Job Details Saved", className: "bg-green-50 border-green-200 text-green-900 shadow-md" });
                handleNextTab(); // Redirect to next tab (docs)
                return;
            }

            // ── System access tab ────────────────────────────────────────────
            if (activeTab === 'system') {
                if (!editingId) return;

                // Robustly check if a system access record already exists for this employee
                // Even stricter check: Look for actual credentials or roles to determine if PATCH or POST should be used
                const access = systemAccessResponse?.data;
                const hasExistingAccess = !!(systemAccessResponse?.isSuccessful && 
                                          access && 
                                          (access.email || access.username || (Array.isArray(access.roles) && access.roles.length > 0)));
                
                if (hasExistingAccess && access) {
                    // Update mode: Construct delta payload (add/delete)
                    const original = access;
                    
                    // Robust role extraction for delta
                    const apiRoles = Array.isArray(original.roles) ? original.roles.map((r: any) => Number(r.id || r.role_id)) : [];
                    const primaryRole = original.role_id ? [Number(original.role_id)] : [];
                    const originalRoleIds = Array.from(new Set([...apiRoles, ...primaryRole])).filter(id => !isNaN(id) && id > 0);

                    const originalWCIds = (original.assigned_work_centers || []).map((r: any) => Number(r.id));
                    const originalWHIds = (original.assigned_warehouses || []).map((r: any) => Number(r.id));
                    const originalOpIds = (original.assigned_operations || []).map((r: any) => Number(r.id));

                    const currentRoleIds = (formData.selected_role_ids || []).map(Number);
                    const currentWCIds = (formData.assignedWorkCenters || []).map(Number);
                    const currentWHIds = (formData.assignedWarehouses || []).map(Number);
                    const currentOpIds = (formData.assignedOperations || []).map(Number);

                    const deltaPayload: any = {
                        employee_id: parseInt(editingId),
                        data: {
                            login_enable: !!formData.enableLoginAccess,
                            email: formData.username || null,
                            password: formData.password || null,
                            location_id: formData.work_location_id || null,
                            add: {
                                role_id: currentRoleIds.filter((id: any) => !originalRoleIds.includes(id)),
                                assigned_work_center_ids: currentWCIds.filter((id: any) => !originalWCIds.includes(id)),
                                assigned_warehouse_ids: currentWHIds.filter((id: any) => !originalWHIds.includes(id)),
                                assigned_operation_ids: currentOpIds.filter((id: any) => !originalOpIds.includes(id)),
                            },
                            delete: {
                                role_id: originalRoleIds.filter((id: any) => !currentRoleIds.includes(id)),
                                assigned_work_center_ids: originalWCIds.filter((id: any) => !currentWCIds.includes(id)),
                                assigned_warehouse_ids: originalWHIds.filter((id: any) => !currentWHIds.includes(id)),
                                assigned_operation_ids: originalOpIds.filter((id: any) => !currentOpIds.includes(id)),
                            }
                        }
                    };

                    await updateSystemAccessMutation.mutateAsync({ id: parseInt(editingId), data: deltaPayload });
                } else {
                    // Create mode: Construct flat payload
                    if (formData.enableLoginAccess) {
                        if (!formData.username || !formData.password) {
                            toast({
                                title: "Invalid System Access Info",
                                description: "Both Login Email and Password are required to enable system access for the first time.",
                                variant: "destructive"
                            });
                            return;
                        }

                        if (!formData.selected_role_ids || formData.selected_role_ids.length === 0) {
                            toast({
                                title: "Invalid System Access Info",
                                description: "At least one Role must be assigned to enable system access for the first time.",
                                variant: "destructive"
                            });
                            return;
                        }
                    }

                    const accessPayload: any = {
                        employee_id: parseInt(editingId),
                        login_enable: !!formData.enableLoginAccess,
                        email: formData.username || null,
                        password: formData.password || null,
                        roles: (formData.selected_role_ids || []).map(Number),
                        location_id: formData.work_location_id || null,
                        assigned_work_centers: (formData.assignedWorkCenters || []).map(Number),
                        assigned_warehouses: (formData.assignedWarehouses || []).map(Number),
                        assigned_operations: (formData.assignedOperations || []).map(Number),
                    };
                    await addSystemAccessMutation.mutateAsync(accessPayload);
                }
                
                toast({ title: "System Access Saved", className: "bg-green-50 border-green-200 text-green-900 shadow-md" });
                handleBackToList(); // User finished the form, return to listing
                return;
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to save.", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start shrink-0">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight">Core HR</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage employee directory and details.
                    </p>
                </div>
                {viewMode !== 'list' && (
                    <div className="flex gap-2 pr-6">
                        {/* Logic: 
                            If ADD mode: Show Cancel (to list) and Save.
                            If EDIT mode (View state): Show Back (to list), Delete, Edit Info.
                            If EDIT mode (Edit state): Show Cancel (to view), Delete, Update Info.
                        */}

                        {(viewMode === 'add') && (
                            <Button variant="outline" onClick={handleBackToList}>Close</Button>
                        )}

                        {(viewMode === 'edit' && !isEditing) && (
                            <div className="flex gap-2 pr-6">
                                <Button variant="outline" onClick={handleBackToList}>Close</Button>
                                {canEdit(moduleName) && (
                                    <Button onClick={() => setLocation(`/hrms/core-hr/employees/${editingId}/edit`)} className="bg-blue-600 hover:bg-blue-700 text-white">
                                        <Edit className="mr-2 h-4 w-4" /> Edit Info
                                    </Button>
                                )}
                            </div>
                        )}

                        {viewMode === 'edit' && editingId && isEditing && (
                            <div className="flex gap-2 pr-6">
                                <Button variant="outline" onClick={handleBackToList}>Close</Button>
                                {canDelete(moduleName) && (
                                    <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive">
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete the employee record.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDelete} loading={deleteEmployeeMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {viewMode === 'list' && (
                <div className="space-y-4">
                    {/* Controls Bar */}
                    <AppListToolbar
                        search={{
                            value: searchTerm,
                            onChange: setSearchTerm,
                            placeholder: "Search employees..."
                        }}
                        filters={[
                            {
                                type: 'select',
                                label: 'Department',
                                value: departmentFilter,
                                options: [{ label: "All Departments", value: "all" }, ...departments.map(d => d.name)],
                                onChange: (val: string) => { setDepartmentFilter(val); },
                                searchable: true
                            }
                        ]}
                        actions={[
                            ...(canCreate(moduleName) ? [{
                                label: 'Import',
                                icon: <Upload className="h-4 w-4" />,
                                onClick: () => setIsImportModalOpen(true),
                                variant: 'outline' as const,
                            }] : []),
                            {
                                label: 'Export',
                                icon: <FileSpreadsheet className="h-4 w-4" />,
                                onClick: handleExportEmployees,
                                variant: 'outline' as const,
                                disabled: isListLoading || (filteredEmployees || []).length === 0 || selectedEmployeeIds.size === 0
                            },
                            ...(canCreate(moduleName) ? [{
                                label: 'Add New Employee',
                                icon: <Plus className="h-4 w-4" />,
                                onClick: handleAddNew,
                            }] : [])
                        ]}
                    />

                    {/* Table-like Card Layout */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="rounded-md border overflow-x-auto">
                                <Table className="min-w-[1000px]">
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-10 text-center">
                                                <Checkbox
                                                    aria-label="Select all employees on this page"
                                                    checked={isAllCurrentPageSelected}
                                                    onCheckedChange={(v) => toggleSelectAllCurrentPage(v === true)}
                                                    disabled={isListLoading || paginatedEmployees.length === 0}
                                                />
                                            </TableHead>
                                            <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-w-[150px]">NAME</TableHead>
                                            <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">EMAIL</TableHead>
                                            <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider hidden 2xl:table-cell">PHONE NO.</TableHead>
                                            <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider hidden 2xl:table-cell">GENDER</TableHead>
                                            <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">DEPT</TableHead>
                                            <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">DESIGNATION</TableHead>
                                            <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">STATUS</TableHead>
                                            <TableHead className="text-center w-[100px] text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ACTION</TableHead>
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
                                        ) : paginatedEmployees.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground italic">
                                                    No employees found.
                                                </TableCell>
                                            </TableRow>
                                        ) : 
                                            paginatedEmployees.map((emp: any, idx: number) => {
                                                const rowKey = getEmployeeRowKey(emp, idx);
                                                return (
                                                    <TableRow key={rowKey} className="hover:bg-muted/30 transition-colors group">
                                                    <TableCell className="text-center">
                                                        <Checkbox
                                                            aria-label={`Select employee ${emp.firstName || ""} ${emp.lastName || ""}`}
                                                            checked={selectedEmployeeIds.has(rowKey)}
                                                            onCheckedChange={(v) => toggleEmployeeSelection(rowKey, v === true)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                                                                {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-medium text-sm text-foreground truncate">{emp.firstName} {emp.lastName}</span>
                                                                <span className="text-[10px] text-muted-foreground">{emp.employeeId}</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden xl:table-cell">
                                                        <span className="text-xs text-muted-foreground block max-w-[150px] truncate" title={emp.email}>{emp.email}</span>
                                                    </TableCell>
                                                    <TableCell className="hidden 2xl:table-cell">
                                                        <span className="text-xs text-muted-foreground">{emp.phone}</span>
                                                    </TableCell>
                                                    <TableCell className="text-sm hidden 2xl:table-cell">{emp.gender || "Male"}</TableCell>
                                                    <TableCell>
                                                        <span className="text-sm font-medium">
                                                            {emp.departmentName || emp.departmentCode || ''}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-muted-foreground block max-w-[120px] truncate" title={emp.designation}>{emp.designation}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge 
                                                            variant="secondary"
                                                            className={cn(
                                                                "text-[10px] h-5 px-1.5 font-bold uppercase border-none", 
                                                                String(emp.status).toLowerCase() === 'active' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                                                String(emp.status).toLowerCase() === 'terminated' ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                                                "bg-gray-100 text-gray-700 hover:bg-gray-100"
                                                            )}
                                                        >
                                                            {emp.status || 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <TableActionButtons
                                                            onView={() => handleView(emp)}
                                                            onEdit={canEdit(moduleName) ? () => handleEdit(emp) : undefined}
                                                        />
                                                    </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        
                                    </TableBody>
                                </Table>
                            </div>
                        {!isListLoading && (
                            <DataTablePagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={listTotalItems}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                                options={[10, 15, 30, 50]}
                            />
                        )}
                    </CardContent>
                </Card>
                </div>
            )}

            {/* Form View (Full Page Tabs) */}
            {viewMode !== 'list' && (
                <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
                    <div className="border-b border-border">
                        <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0">
                            <TabsTrigger
                                value="personal"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                            >
                                Personal Details
                            </TabsTrigger>
                            <TabsTrigger
                                value="job"
                                disabled={viewMode === 'add'}
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                            >
                                Employment & Job Details
                            </TabsTrigger>
                            <TabsTrigger
                                value="docs"
                                disabled={viewMode === 'add'}
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                            >
                                Documents
                            </TabsTrigger>
                            <TabsTrigger
                                value="system"
                                disabled={viewMode === 'add'}
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                            >
                                System Access
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 mt-4 bg-card border rounded-xl shadow-sm overflow-hidden">
                        <ScrollArea className="flex-1">
                            <div className="p-6 pr-10">
                                <TabsContent value="personal" className="m-0 focus-visible:ring-0">
                                    <PersonalDetailsForm
                                        key={`personal-${viewMode}-${editingId || 'new'}`}
                                        data={formData}
                                        updateData={setFormData}
                                        readOnly={viewMode === 'edit' && !isEditing}
                                        genders={genders}
                                        nationalities={nationalities}
                                        bloodGroups={bloodGroups}
                                        maritalStatuses={maritalStatuses}
                                        countries={countryOptions}
                                        states={parentStateOptions}
                                        cities={parentCityOptions}
                                    />
                                </TabsContent>
                                <TabsContent value="job" className="m-0 focus-visible:ring-0">
                                    <EmploymentDetailsForm
                                        key={`job-${viewMode}-${editingId || 'new'}`}
                                        data={formData}
                                        updateData={setFormData}
                                        readOnly={viewMode === 'edit' && !isEditing}
                                        employmentTypes={employmentTypes}
                                        grades={grades}
                                        locations={locations}
                                        shifts={shifts}
                                        designations={designations}
                                        employmentStatuses={employmentStatuses}
                                        reportingManagers={reportingManagerOptions}
                                        departments={departments}
                                    />
                                </TabsContent>
                                <TabsContent value="docs" className="m-0 focus-visible:ring-0">
                                    <DocumentsForm
                                        data={formData}
                                        updateData={setFormData}
                                        readOnly={viewMode === 'edit' && !isEditing}
                                        employeeId={editingId ? parseInt(editingId) : null}
                                        documentTypeOptions={documentTypes}
                                        onAddDocument={async (formData: FormData) => {
                                            if (!editingId) return;
                                            await addDocumentMutation.mutateAsync(formData);
                                            toast({ title: "Document Saved", className: "bg-green-50 border-green-200 text-green-900 shadow-md", duration: 2500 });
                                        }}
                                        onDeleteDocument={async (docId: number) => {
                                            await deleteDocumentMutation.mutateAsync(docId);
                                            toast({ title: "Document Deleted", className: "bg-green-50 border-green-200 text-green-900 shadow-md", duration: 2500 });
                                        }}
                                    />
                                </TabsContent>
                                <TabsContent value="system" className="m-0 focus-visible:ring-0">
                                    <SystemAccessForm
                                        key={`system-${viewMode}-${editingId || 'new'}`}
                                        data={formData}
                                        updateData={setFormData}
                                        readOnly={viewMode === 'edit' && !isEditing}
                                        roles={roleOptions}
                                        locations={locations}
                                        workCenters={workCenters}
                                        warehouses={warehouses}
                                        operations={operations}
                                    />
                                </TabsContent>
                            </div>
                        </ScrollArea>

                        {(isEditing || viewMode === 'add') && (
                            <div className="p-4 border-t bg-muted/20 flex justify-end gap-3 shrink-0">


                                {viewMode === 'add' && (
                                    <Button
                                        variant="outline"
                                        onClick={handleClear}
                                        disabled={createEmployeeMutation.isPending}
                                        className="border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Clear
                                    </Button>
                                )}

                                {/* Save button - show for Personal and Employment tabs only */}
                                {(activeTab === 'personal' || activeTab === 'job') && (
                                    <Button
                                        onClick={() => handleSave(true)}
                                        loading={
                                            createEmployeeMutation.isPending || 
                                            updateEmployeeMutation.isPending || 
                                            updateJobDetailsMutation.isPending || 
                                            addJobDetailsMutation.isPending || 
                                            updateSystemAccessMutation.isPending || 
                                            addSystemAccessMutation.isPending
                                        }
                                        disabled={!isCurrentTabValid()}
                                        className={`${isCurrentTabValid()
                                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                            }`}
                                    >
                                        Save
                                    </Button>
                                )}

                                {/* Save Employee button - only on System Access tab */}
                                {activeTab === 'system' && (
                                    <Button
                                        onClick={() => handleSave(true)}
                                        loading={
                                            createEmployeeMutation.isPending || 
                                            updateEmployeeMutation.isPending || 
                                            updateJobDetailsMutation.isPending || 
                                            addJobDetailsMutation.isPending || 
                                            updateSystemAccessMutation.isPending || 
                                            addSystemAccessMutation.isPending
                                        }
                                        disabled={!isCurrentTabValid()}
                                        className={`${isCurrentTabValid()
                                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                            }`}
                                    >
                                        Save
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </Tabs>
            )}

            {/* Import Employee Modal */}
            <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                <DialogContent
                    className="w-[95%] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[85vh] p-0 flex flex-col overflow-hidden"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <div className="p-6 pb-0 shrink-0">
                            <DialogTitle>Import Employee Details</DialogTitle>
                            <DialogDescription>
                                Upload an Excel file (.xlsx or .xls) containing employee master data.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {/* Drag/Drop Upload Area */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">
                                Upload File <span className="text-red-500">*</span>
                            </Label>

                            <input
                                ref={importFileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    handleImportFileChange(file);
                                }}
                            />

                            <div
                                className={cn(
                                    "rounded-lg border border-dashed p-6 transition-colors bg-muted/10",
                                    isDragActive ? "border-primary bg-primary/5" : "border-border"
                                )}
                                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); }}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); }}
                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragActive(false);
                                    const file = e.dataTransfer.files?.[0] || null;
                                    handleImportFileChange(file);
                                }}
                            >
                                <div className="flex flex-col items-center text-center gap-2">
                                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                                    <div className="text-sm">
                                        <span className="font-medium">Drag and drop</span> your Excel file here, or
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => importFileInputRef.current?.click()}
                                    >
                                        Browse File
                                    </Button>
                                    <div className="text-xs text-muted-foreground">
                                        Allowed: .xlsx, .xls (Max 10MB)
                                    </div>
                                </div>
                            </div>

                            {importFile && (
                                <div className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium truncate" title={importFile.name}>{importFile.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {(importFile.size / 1024).toFixed(1)} KB
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleImportFileChange(null)}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Validate Button - Only show when file is selected but not validated */}
                        {importFile && !isValidated && (
                            <div className="flex justify-center">
                                <Button
                                    onClick={validateFileColumns}
                                    className="bg-blue-600 hover:bg-blue-700"
                                    disabled={importValidationErrors.length > 0}
                                >
                                    Validate
                                </Button>
                            </div>
                        )}

                        {/* Invalid Rows / Backend Errors (single section) */}
                        {(
                            (!!importPreview && importPreview.invalidRows > 0) ||
                            (importValidationErrors.length > 0)
                        ) && (
                            <div className="rounded-lg border bg-background">
                                <div className="px-4 py-3 border-b">
                                    <div className="text-sm font-medium">
                                        {!!importPreview && importPreview.invalidRows > 0 ? "Invalid Rows" : "Errors"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {!!importPreview && importPreview.invalidRows > 0
                                            ? "Fix these rows in Excel and re-upload."
                                            : "Fix these issues and re-upload."}
                                    </div>
                                </div>
                                <div className="max-h-24 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                    {!!importPreview && importPreview.invalidRows > 0 ? (
                                        <>
                                            {importPreview?.rowResults
                                                .filter(r => r.errors.length > 0)
                                                .slice(0, 50)
                                                .map((r) => (
                                                    <div key={r.rowNumber} className="text-sm">
                                                        <span className="font-medium">Row {r.rowNumber}</span>
                                                        <span className="text-muted-foreground"> → </span>
                                                        <span className="text-destructive">{r.errors.join(", ")}</span>
                                                    </div>
                                                ))}
                                            {importPreview && importPreview.invalidRows > 50 && (
                                                <div className="text-xs text-muted-foreground">
                                                    Showing first 50 invalid rows.
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {importValidationErrors.slice(0, 200).map((error, index) => (
                                                <div key={index} className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
                                                    {error}
                                                </div>
                                            ))}
                                            {importValidationErrors.length > 200 && (
                                                <div className="text-xs text-muted-foreground">
                                                    Showing first 200 errors.
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Validation Message Area */}
                        {validationMessage && (
                            <div className={`p-3 rounded-md text-sm ${validationMessage.includes('✅')
                                ? 'bg-green-50 border border-green-200 text-green-800'
                                : 'bg-red-50 border border-red-200 text-red-800'
                                }`}>
                                {validationMessage}
                            </div>
                        )}

                        {/* Instructions */}
                        <details className="rounded-lg border border-slate-200 bg-white shadow-sm">
                            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-slate-900">
                                Instructions
                            </summary>
                            <div className="px-4 pb-4 pt-2 space-y-3">
                                <div className="bg-muted/30 rounded-lg p-4">
                                    <h4 className="text-sm font-medium mb-2">Required Columns <span className="text-red-500">*</span></h4>
                                    <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                                        {REQUIRED_COLUMNS_DISPLAY.map((column, index) => (
                                            <div key={index} className="flex items-center gap-1">
                                                <span className="text-red-500">•</span>
                                                {column}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-3">
                                    <div className="font-medium text-blue-900 mb-1">File Format Requirements:</div>
                                    <ul className="space-y-1 text-blue-800">
                                        <li>• Supported formats: .xlsx, .xls</li>
                                        <li>• Headers and column order must match the sample template exactly</li>
                                        <li>• Employee Photo is NOT supported</li>
                                    </ul>
                                </div>
                            </div>
                        </details>

                        {/* Validation Errors section removed (errors shown above) */}
                    </div>

                    <div className="border-t bg-white px-6 py-4 shrink-0">
                        <DialogFooter className="flex gap-2">
                            <Button variant="outline" onClick={() => {
                                setIsImportModalOpen(false);
                                setImportFile(null);
                                setImportValidationErrors([]);
                                setIsImportValid(false);
                                setIsValidated(false);
                                setValidationMessage('');
                                setImportPreview(null);
                            }}>
                                Cancel
                            </Button>
                            {/* Import button only visible after successful validation */}
                            {importFile && isValidated && isImportValid && (
                                <Button
                                    onClick={handleImportEmployees}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import
                                </Button>
                            )}
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// --- Sub-components --

function EmployeeCard({ employee, onEdit }: { employee: any, onEdit: () => void }) {
    return (
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-2 bg-primary/80" />
            <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4 overflow-hidden border-2 border-background shadow-sm">
                        {/* Fallback Avatar */}
                        <span className="text-2xl font-bold text-muted-foreground">
                            {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                        </span>
                    </div>

                    <div className="space-y-1 mb-4">
                        <h3 className="font-semibold text-lg leading-none">{employee.firstName} {employee.lastName}</h3>
                        <p className="text-sm text-muted-foreground">{employee.designation || 'No Designation'}</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <Badge variant="outline" className="font-normal">{employee.employeeId}</Badge>
                            <Badge variant={employee.status?.toLowerCase() === 'active' ? 'default' : 'destructive'} className={cn("lowercase", employee.status?.toLowerCase() === 'active' ? "bg-green-600 hover:bg-green-700" : "")}>
                                {employee.status?.toLowerCase()}
                            </Badge>
                        </div>
                    </div>

                    <div className="w-full text-sm text-muted-foreground border-t pt-4 mt-2">
                        <div className="flex justify-between py-1">
                            <span>Department</span>
                            <span className="font-medium text-foreground">{employee.department?.name || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span>Type</span>
                            <span className="font-medium text-foreground">{employee.employmentType || 'Full Time'}</span>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="bg-muted/30 p-3 flex justify-center border-t">
                <Button size="sm" variant="outline" className="w-full" onClick={onEdit}>
                    <Edit className="w-3 h-3 mr-2" /> Edit Profile
                </Button>
            </CardFooter>
        </Card>
    );
}

// Helper function to calculate age from date of birth
function calculateAge(dateOfBirth: Date | string): string {
    if (!dateOfBirth) return '';

    const birthDate = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    const today = new Date();

    if (isNaN(birthDate.getTime())) return '';

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age >= 0 ? `${age} years` : '';
}

function PersonalDetailsForm({ data, updateData, readOnly, genders = [], nationalities = [], bloodGroups = [], maritalStatuses = [], countries = [], states: stateOptions = [], cities: cityOptions = [] }: any) {
    const { toast } = useToast();
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Optimized photo preview logic to prevent continuous blob generation on every render
    useEffect(() => {
        if (data.photo instanceof File) {
            const url = URL.createObjectURL(data.photo);
            setPreviewUrl(url);
            // Cleanup previous blob URL to prevent memory leaks and redundant network requests
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewUrl(null);
            return undefined;
        }
    }, [data.photo]);

    // Memoize maxDate to prevent recreation on every render (and subsequent infinite loop in child useEffect)
    const dobMaxDate = useMemo(() => new Date(new Date().setFullYear(new Date().getFullYear() - 10)), []);

    useEffect(() => {
        const newErrors: Record<string, string> = {};
        
        // Names
        if (touched.firstName || data.firstName) {
            if (!data.firstName) newErrors.firstName = "First name is required";
            else if (!NAME_REGEX.test(data.firstName)) newErrors.firstName = "Must be at least 2 characters and contain no numbers";
        }
        if (touched.lastName || data.lastName) {
            if (!data.lastName) newErrors.lastName = "Last name is required";
            else if (!NAME_REGEX.test(data.lastName)) newErrors.lastName = "Must be at least 2 characters and contain no numbers";
        }

        // Mobile Numbers
        if (touched.mobileNumber || data.mobileNumber) {
            if (!data.mobileNumber) newErrors.mobileNumber = "Mobile number is required";
            else if (!PHONE_REGEX.test(data.mobileNumber)) newErrors.mobileNumber = "Must be exactly 10 digits";
            else if (data.mobileNumber === data.alternateMobile && data.alternateMobile) {
                newErrors.mobileNumber = "Primary number cannot be same as alternate";
            }
        }
        if (touched.alternateMobile || data.alternateMobile) {
            if (data.alternateMobile && !PHONE_REGEX.test(data.alternateMobile)) {
                newErrors.alternateMobile = "Must be exactly 10 digits";
            } else if (data.alternateMobile && data.alternateMobile === data.mobileNumber) {
                newErrors.alternateMobile = "Alternate number cannot be same as primary";
            }
        }

        // Email Addresses
        if (touched.personalEmail || data.personalEmail) {
            if (!data.personalEmail) newErrors.personalEmail = "Personal email is required";
            else if (!EMAIL_REGEX.test(data.personalEmail)) newErrors.personalEmail = "Invalid email format";
            else if (data.personalEmail === data.officialEmail && data.officialEmail) {
                newErrors.personalEmail = "Personal email cannot be same as official";
            }
        }
        if (touched.officialEmail || data.officialEmail) {
            if (data.officialEmail && !EMAIL_REGEX.test(data.officialEmail)) {
                newErrors.officialEmail = "Invalid email format";
            } else if (data.officialEmail && data.officialEmail === data.personalEmail) {
                newErrors.officialEmail = "Official email cannot be same as personal";
            }
        }

        // Address & Location
        if (touched.currentAddress || data.currentAddress) {
            if (!data.currentAddress) newErrors.currentAddress = "Current address is required";
        }
        if (touched.country_id || data.country_id) {
            if (!data.country_id) newErrors.country_id = "Country is required";
        }
        if (touched.state_id || data.state_id) {
            if (!data.state_id) newErrors.state_id = "State is required";
        }
        if (touched.city_id || data.city_id) {
            if (!data.city_id) newErrors.city_id = "City is required";
        }
        if (touched.pincode || data.pincode) {
            if (!data.pincode) newErrors.pincode = "Pincode is required";
            else if (!PINCODE_REGEX.test(data.pincode)) newErrors.pincode = "Must be exactly 6 digits";
        }
        if (touched.perm_pincode || data.perm_pincode) {
            if (data.perm_pincode && !PINCODE_REGEX.test(data.perm_pincode)) {
                newErrors.perm_pincode = "Must be exactly 6 digits";
            }
        }
        // Date of Birth
        if (touched.dateOfBirth || data.dateOfBirth) {
            if (!data.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
            else {
                const birthDate = new Date(data.dateOfBirth);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                if (age < 10) newErrors.dateOfBirth = "Minimum age must be 10 years";
            }
        }

        // Anniversary Date
        if (touched.anniversaryDate || data.anniversaryDate) {
            if (data.anniversaryDate && new Date(data.anniversaryDate) > new Date()) {
                newErrors.anniversaryDate = "Anniversary date cannot be in the future";
            }
        }

        setErrors(newErrors);
    }, [data.firstName, data.lastName, data.mobileNumber, data.alternateMobile, data.personalEmail, data.officialEmail, data.currentAddress, data.country_id, data.state_id, data.city_id, data.pincode, data.perm_pincode, data.dateOfBirth, data.anniversaryDate, touched]);
    // For permanent address cascading (always enable to ensure labels show even if synced/disabled)
    const { data: permStatesResp } = useHrStates(data.perm_country_id, !!data.perm_country_id);
    const { data: permCitiesResp } = useHrCities(data.perm_state_id, !!data.perm_state_id);
    const permStateOptions = (permStatesResp?.data?.records || []).map((r: any) => ({
        id: r.id,
        value_name: r.state_name || r.name || r.value_name || '',
        code: r.state_code || r.code || r.value_code || ''
    }));
    const permCityOptions = (permCitiesResp?.data?.records || []).map((r: any) => ({
        id: r.id,
        value_name: r.city_name || r.name || r.value_name || '',
        code: r.city_code || r.code || r.value_code || ''
    }));

    // Auto-map names to IDs for cascading dropdowns (handles mismatched IDs from legacy DB)
    useEffect(() => {
        if (data.country_name && countries.length > 0) {
            const currentIdValid = data.country_id && countries.some((c: any) => c.id === data.country_id);
            if (!currentIdValid) {
                const match = countries.find((c: any) => String(c.value_name || '').toLowerCase() === String(data.country_name).toLowerCase());
                if (match) updateData((prev: any) => ({ ...prev, country_id: match.id }));
            }
        }
    }, [data.country_name, countries]);

    useEffect(() => {
        if (data.state_name && stateOptions.length > 0) {
            const currentIdValid = data.state_id && stateOptions.some((s: any) => s.id === data.state_id);
            if (!currentIdValid) {
                const match = stateOptions.find((s: any) => String(s.value_name || '').toLowerCase() === String(data.state_name).toLowerCase());
                if (match) updateData((prev: any) => ({ ...prev, state_id: match.id }));
            }
        }
    }, [data.state_name, stateOptions]);

    useEffect(() => {
        if (data.city_name && cityOptions.length > 0) {
            const currentIdValid = data.city_id && cityOptions.some((c: any) => c.id === data.city_id);
            if (!currentIdValid) {
                const match = cityOptions.find((c: any) => String(c.value_name || '').toLowerCase() === String(data.city_name).toLowerCase());
                if (match) updateData((prev: any) => ({ ...prev, city_id: match.id }));
            }
        }
    }, [data.city_name, cityOptions]);

    // Same for permanent address...
    useEffect(() => {
        if (data.perm_country_name && countries.length > 0) {
            const currentIdValid = data.perm_country_id && countries.some((c: any) => c.id === data.perm_country_id);
            if (!currentIdValid) {
                const match = countries.find((c: any) => String(c.value_name || '').toLowerCase() === String(data.perm_country_name).toLowerCase());
                if (match) updateData((prev: any) => ({ ...prev, perm_country_id: match.id }));
            }
        }
    }, [data.perm_country_name, countries]);

    useEffect(() => {
        if (data.perm_state_name && permStateOptions.length > 0) {
            const currentIdValid = data.perm_state_id && permStateOptions.some((s: any) => s.id === data.perm_state_id);
            if (!currentIdValid) {
                const match = permStateOptions.find((s: any) => String(s.value_name || '').toLowerCase() === String(data.perm_state_name).toLowerCase());
                if (match) updateData((prev: any) => ({ ...prev, perm_state_id: match.id }));
            }
        }
    }, [data.perm_state_name, permStateOptions]);

    useEffect(() => {
        if (data.perm_city_name && permCityOptions.length > 0) {
            const currentIdValid = data.perm_city_id && permCityOptions.some((c: any) => c.id === data.perm_city_id);
            if (!currentIdValid) {
                const match = permCityOptions.find((c: any) => String(c.value_name || '').toLowerCase() === String(data.perm_city_name).toLowerCase());
                if (match) updateData((prev: any) => ({ ...prev, perm_city_id: match.id }));
            }
        }
    }, [data.perm_city_name, permCityOptions]);

    const handleChange = (field: string, value: any) => {
        if (readOnly) return;
        updateData((prev: any) => {
            const next = { ...prev, [field]: value };
            
            // Sync permanent address fields if sameAsCurrentAddress is true
            if (prev.sameAsCurrentAddress) {
                if (field === "currentAddress") next.permanentAddress = value;
                if (field === "country_id") next.perm_country_id = value;
                if (field === "state_id") next.perm_state_id = value;
                if (field === "city_id") next.perm_city_id = value;
                if (field === "pincode") next.perm_pincode = value;
            }

            // Reset dependent location fields when parent changes
            if (field === "country_id") { next.state_id = null; next.city_id = null; }
            if (field === "state_id") { next.city_id = null; }
            if (field === "perm_country_id") { next.perm_state_id = null; next.perm_city_id = null; }
            if (field === "perm_state_id") { next.perm_city_id = null; }
            return next;
        });

        // Mark as touched to enable live feedback
        setTouched(prev => ({ ...prev, [field]: true }));
    };

    return (
        <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-card border rounded-lg p-6">
                <h4 className="font-semibold mb-6 text-primary border-b pb-2">Basic Information</h4>

                <div className="grid grid-cols-12 gap-8">
                    {/* Left Column: Photo */}
                    <div className="col-span-12 md:col-span-3 flex flex-col items-center pt-2">
                        <Label className="mb-4 text-sm font-semibold text-muted-foreground">Profile Picture</Label>
                        <div className="w-40 h-40 rounded-full bg-muted border-4 border-muted-foreground/10 flex items-center justify-center overflow-hidden relative group shadow-inner">
                            {data.photo ? (
                                <img
                                    src={previewUrl || (typeof data.photo === 'string' ? resolveFileUrl(data.photo) : "")}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <User className="h-16 w-16 text-muted-foreground/50" />
                            )}

                            {!readOnly && (
                                <label className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <Upload className="h-6 w-6 text-white mb-1" />
                                    <span className="text-xs text-white font-medium">Upload Photo</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".jpg,.jpeg,.png"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
                                                const maxSize = 2 * 1024 * 1024; // 2MB
                                                
                                                let error = "";
                                                if (!allowedTypes.includes(file.type)) {
                                                    error = "Invalid format. Only JPG, JPEG, PNG are allowed.";
                                                } else if (file.size > maxSize) {
                                                    error = "File size exceeds 2MB limit.";
                                                }

                                                if (error) {
                                                    setErrors(prev => ({ ...prev, photo: error }));
                                                    // DO NOT update data to prevent previewing invalid file
                                                } else {
                                                    setErrors(prev => {
                                                        const newErrs = { ...prev };
                                                        delete newErrs.photo;
                                                        return newErrs;
                                                    });
                                                    handleChange("photo", file);
                                                }
                                            }
                                        }}
                                    />
                                </label>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-3 text-center px-4">
                            {readOnly ? "Employee Photo" : "Allowed *.jpeg, *.jpg, *.png (Max 2MB)"}
                        </p>
                        {errors.photo && (
                            <p className="text-[10px] text-red-500 font-medium text-center mt-2 px-4 leading-tight">
                                {errors.photo}
                            </p>
                        )}
                    </div>

                    {/* Right Column: Fields */}
                    <div className="col-span-12 md:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-5 content-start">
                        {data.id && (
                            <div className="space-y-2">
                                <Label>Employee ID <span className="text-red-500">*</span></Label>
                                <Input value={data.employeeId || ''} readOnly className="bg-muted cursor-text" />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input
                                value={`${data.firstName || ''} ${data.lastName || ''}`.trim()}
                                readOnly
                                className="bg-muted cursor-text"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>First Name <span className="text-red-500">*</span></Label>
                            <Input value={data.firstName || ''} onChange={(e) => handleChange("firstName", e.target.value)} readOnly={readOnly} maxLength={25} className={cn("cursor-text", errors.firstName && "border-red-500")} />
                            {errors.firstName && <p className="text-[10px] text-red-500 font-medium">{errors.firstName}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Last Name <span className="text-red-500">*</span></Label>
                            <Input value={data.lastName || ''} onChange={(e) => handleChange("lastName", e.target.value)} readOnly={readOnly} maxLength={25} className={cn("cursor-text", errors.lastName && "border-red-500")} />
                            {errors.lastName && <p className="text-[10px] text-red-500 font-medium">{errors.lastName}</p>}
                        </div>
                        <div className="space-y-2">
                            <SearchableSelect
                                label="Gender"
                                required
                                value={data.gender_id?.toString()}
                                options={genders.map((g: any) => ({ label: g.value_name, value: g.id.toString() }))}
                                onChange={(v) => handleChange("gender_id", parseInt(v))}
                                disabled={readOnly}
                                placeholder="Select Gender"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Date of Birth <span className="text-red-500">*</span></Label>
                            {/* DatePicker likely needs disabled prop too, wrapping in div for pointer events if not supported */}
                            <div className={readOnly ? "pointer-events-none opacity-80" : ""}>
                                <DatePicker 
                                    date={data.dateOfBirth} 
                                    setDate={(d) => handleChange("dateOfBirth", d)} 
                                    maxDate={dobMaxDate} 
                                />
                                {errors.dateOfBirth && <p className="text-[10px] text-red-500 font-medium mt-1">{errors.dateOfBirth}</p>}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Age</Label>
                            <Input
                                value={data.dateOfBirth ? calculateAge(data.dateOfBirth) : ''}
                                readOnly
                                className="bg-muted cursor-text"
                            />
                        </div>

                        <div className="space-y-2">
                            <SearchableSelect
                                label="Nationality"
                                value={data.nationality_id?.toString()}
                                options={nationalities.map((n: any) => ({ label: n.value_name, value: n.id.toString() }))}
                                onChange={(v) => handleChange("nationality_id", parseInt(v))}
                                disabled={readOnly}
                                placeholder="Select Nationality"
                            />
                        </div>
                        <div className="space-y-2">
                            <SearchableSelect
                                label="Blood Group"
                                value={data.blood_group_id?.toString()}
                                options={bloodGroups.map((b: any) => ({ label: b.value_name, value: b.id.toString() }))}
                                onChange={(v) => handleChange("blood_group_id", parseInt(v))}
                                disabled={readOnly}
                                placeholder="Select Blood Group"
                            />
                        </div>

                        <div className="space-y-2">
                            <SearchableSelect
                                label="Marital Status"
                                value={data.marital_status_id?.toString()}
                                options={maritalStatuses.map((m: any) => ({ label: m.value_name, value: m.id.toString() }))}
                                onChange={(v) => handleChange("marital_status_id", parseInt(v))}
                                disabled={readOnly}
                                placeholder="Select Marital Status"
                            />
                        </div>
                        {maritalStatuses.find((m: any) => m.id === data.marital_status_id)?.value_name === "Married" && (
                            <div className="space-y-2">
                                <Label>Anniversary Date</Label>
                                <div className={readOnly ? "pointer-events-none opacity-80" : ""}>
                                    <DatePicker date={data.anniversaryDate} setDate={(d) => handleChange("anniversaryDate", d)} maxDate={new Date()} />
                                    {errors.anniversaryDate && <p className="text-[10px] text-red-500 font-medium mt-1">{errors.anniversaryDate}</p>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Contact Info */}
            <div className="bg-card border rounded-lg p-6">
                <h4 className="font-semibold mb-6 text-primary border-b pb-2">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Mobile Number <span className="text-red-500">*</span></Label>
                        <Input type="tel" value={data.mobileNumber || ''} onChange={(e) => {
                            const numericVal = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                            handleChange("mobileNumber", numericVal);
                        }} readOnly={readOnly} className={cn("cursor-text", errors.mobileNumber && "border-red-500")} placeholder="10-digit mobile number" />
                        {errors.mobileNumber && <p className="text-[10px] text-red-500 font-medium">{errors.mobileNumber}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>Alternate Mobile</Label>
                        <Input type="tel" value={data.alternateMobile || ''} onChange={(e) => {
                            const numericVal = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                            handleChange("alternateMobile", numericVal);
                        }} readOnly={readOnly} className={cn("cursor-text", errors.alternateMobile && "border-red-500")} placeholder="10-digit mobile number" />
                        {errors.alternateMobile && <p className="text-[10px] text-red-500 font-medium">{errors.alternateMobile}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>Personal Email <span className="text-red-500">*</span></Label>
                        <Input type="email" value={data.personalEmail || ''} onChange={(e) => {
                            const val = e.target.value;
                            handleChange("personalEmail", val);
                        }} readOnly={readOnly} className={cn("cursor-text", errors.personalEmail && "border-red-500")} placeholder="example@domain.com" />
                        {errors.personalEmail && <p className="text-[10px] text-red-500 font-medium">{errors.personalEmail}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label>Official Email</Label>
                        <Input type="email" value={data.officialEmail || ''} onChange={(e) => {
                            const val = e.target.value;
                            handleChange("officialEmail", val);
                        }} readOnly={readOnly} className={cn("cursor-text", errors.officialEmail && "border-red-500")} placeholder="official@company.com" />
                        {errors.officialEmail && <p className="text-[10px] text-red-500 font-medium">{errors.officialEmail}</p>}
                    </div>
                </div>
            </div>

            {/* Address Info */}
            <div className="bg-card border rounded-lg p-6">
                <h4 className="font-semibold mb-6 text-primary border-b pb-2">Address Information</h4>
                
                {/* Current Address Section */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <Label>Current Address <span className="text-red-500">*</span></Label>
                            <Textarea 
                                value={data.currentAddress || ''} 
                                onChange={(e) => handleChange("currentAddress", e.target.value)} 
                                readOnly={readOnly} 
                                className={cn("cursor-text", errors.currentAddress && "border-red-500")} 
                            />
                            {errors.currentAddress && <p className="text-[10px] text-red-500 font-medium">{errors.currentAddress}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <SearchableSelect
                                label="Country"
                                required
                                value={data.country_id?.toString()}
                                options={countries.map((c: any) => ({ label: c.value_name, value: c.id.toString() }))}
                                onChange={(v) => handleChange("country_id", parseInt(v))}
                                disabled={readOnly}
                                placeholder="Select Country"
                                error={errors.country_id}
                            />
                        </div>
                        <div className="space-y-2">
                            <SearchableSelect
                                label="State"
                                required
                                value={data.state_id?.toString()}
                                options={stateOptions.map((s: any) => ({ label: s.value_name, value: s.id.toString() }))}
                                onChange={(v) => handleChange("state_id", parseInt(v))}
                                disabled={readOnly || !data.country_id}
                                placeholder={data.country_id ? "Select State" : "Select Country first"}
                                error={errors.state_id}
                            />
                        </div>
                        <div className="space-y-2">
                            <SearchableSelect
                                label="City"
                                required
                                value={data.city_id?.toString()}
                                options={cityOptions.map((c: any) => ({ label: c.value_name, value: c.id.toString() }))}
                                onChange={(v) => handleChange("city_id", parseInt(v))}
                                disabled={readOnly || !data.state_id}
                                placeholder={data.state_id ? "Select City" : "Select State first"}
                                error={errors.city_id}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Pincode <span className="text-red-500">*</span></Label>
                            <Input value={data.pincode || ''} onChange={(e) => {
                                const numericVal = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                                handleChange("pincode", numericVal);
                            }} readOnly={readOnly} className={cn("cursor-text", errors.pincode && "border-red-500")} placeholder="6-digit pincode" />
                            {errors.pincode && <p className="text-[10px] text-red-500 font-medium">{errors.pincode}</p>}
                        </div>
                    </div>
                </div>

                {/* Permanent Address Section */}
                <div className="space-y-4 mt-8 pt-6 border-t border-dashed">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center mb-1">
                                <Label>Permanent Address</Label>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="sameAsCurrent"
                                        checked={data.sameAsCurrentAddress}
                                        onCheckedChange={(checked) => {
                                            handleChange("sameAsCurrentAddress", checked);
                                            if (checked) {
                                                handleChange("permanentAddress", data.currentAddress);
                                                handleChange("perm_country_id", data.country_id);
                                                handleChange("perm_state_id", data.state_id);
                                                handleChange("perm_city_id", data.city_id);
                                                handleChange("perm_pincode", data.pincode);
                                            } else {
                                                // Clear permanent address fields when unchecked
                                                handleChange("permanentAddress", "");
                                                handleChange("perm_country_id", null);
                                                handleChange("perm_state_id", null);
                                                handleChange("perm_city_id", null);
                                                handleChange("perm_pincode", "");
                                            }
                                        }}
                                        disabled={readOnly}
                                    />
                                    <Label htmlFor="sameAsCurrent" className="text-xs font-normal cursor-pointer text-muted-foreground">
                                        Same as current address
                                    </Label>
                                </div>
                            </div>
                                <Textarea
                                    value={data.sameAsCurrentAddress ? (data.currentAddress || '') : (data.permanentAddress || '')}
                                    onChange={(e) => !data.sameAsCurrentAddress && handleChange("permanentAddress", e.target.value)}
                                    readOnly={readOnly || data.sameAsCurrentAddress}
                                    className={cn("cursor-text", data.sameAsCurrentAddress && "bg-muted")}
                                />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <SearchableSelect
                                label="Country"
                                value={data.perm_country_id?.toString()}
                                options={countries.map((c: any) => ({ label: c.value_name, value: c.id.toString() }))}
                                onChange={(v) => handleChange("perm_country_id", parseInt(v))}
                                disabled={readOnly || data.sameAsCurrentAddress}
                                placeholder="Select Country"
                                className={data.sameAsCurrentAddress ? "bg-muted" : ""}
                            />
                        </div>
                        <div className="space-y-2">
                            <SearchableSelect
                                label="State"
                                value={data.perm_state_id?.toString()}
                                options={permStateOptions.map((s: any) => ({ label: s.value_name, value: s.id.toString() }))}
                                onChange={(v) => handleChange("perm_state_id", parseInt(v))}
                                disabled={readOnly || data.sameAsCurrentAddress || !data.perm_country_id}
                                placeholder={data.perm_country_id ? "Select State" : "Select Country first"}
                                className={data.sameAsCurrentAddress ? "bg-muted" : ""}
                            />
                        </div>
                        <div className="space-y-2">
                            <SearchableSelect
                                label="City"
                                value={data.perm_city_id?.toString()}
                                options={permCityOptions.map((c: any) => ({ label: c.value_name, value: c.id.toString() }))}
                                onChange={(v) => handleChange("perm_city_id", parseInt(v))}
                                disabled={readOnly || data.sameAsCurrentAddress || !data.perm_state_id}
                                placeholder={data.perm_state_id ? "Select City" : "Select State first"}
                                className={data.sameAsCurrentAddress ? "bg-muted" : ""}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Pincode</Label>
                            <Input
                                value={data.sameAsCurrentAddress ? data.pincode : data.perm_pincode || ''}
                                onChange={(e) => {
                                    if (!data.sameAsCurrentAddress) {
                                        const numericVal = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                                        handleChange("perm_pincode", numericVal);
                                    }
                                }}
                                readOnly={readOnly || data.sameAsCurrentAddress}
                                className={cn("cursor-text", (errors.perm_pincode || (data.sameAsCurrentAddress && errors.pincode)) && "border-red-500")}
                                placeholder="6-digit pincode"
                            />
                            {(errors.perm_pincode || (data.sameAsCurrentAddress && errors.pincode)) && (
                                <p className="text-[10px] text-red-500 font-medium">{data.sameAsCurrentAddress ? errors.pincode : errors.perm_pincode}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}

function EmploymentDetailsForm({ data, updateData, departments, reportingManagers, employmentTypes, employmentStatuses, grades, locations, shifts, designations = [], readOnly }: any) {
    const { toast } = useToast();
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

    // Helpers to resolve names from IDs
    const getStatusName = (id: number | null) => (employmentStatuses as Array<{ id: number; value_name: string }>)?.find(s => s.id === id)?.value_name || '';
    const getTypeName = (id: number | null) => (employmentTypes as Array<{ id: number; value_name: string }>)?.find(t => t.id === id)?.value_name || '';

    // Date validation functions
    const validateDateOfJoining = (doj: Date | undefined): string => {
        if (!doj) return "";
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (doj > today) {
            return "Date of Joining cannot be in the future";
        }
        return "";
    };

    const validateExitDate = (exitDate: Date | undefined, doj: Date | undefined, statusId: number | null): string => {
        const statusName = getStatusName(statusId);
        if (!statusName || statusName === "Active") return "";

        if (!exitDate && (statusName === "Inactive" || statusName === "Terminated")) {
            return "Exit Date is required for Inactive/Terminated status";
        }

        if (exitDate && doj) {
            const exitDateOnly = new Date(exitDate.getFullYear(), exitDate.getMonth(), exitDate.getDate());
            const dojDateOnly = new Date(doj.getFullYear(), doj.getMonth(), doj.getDate());
            if (exitDateOnly <= dojDateOnly) {
                return "Exit Date cannot be earlier than Date of Joining";
            }
        }

        return "";
    };

    const validateEmploymentStatus = (exitDate: Date | undefined, statusId: number | null): string => {
        if (exitDate && getStatusName(statusId) === "Active") {
            return "Please set Employment Status to Inactive/Terminated when Exit Date is entered";
        }
        return "";
    };

    // Enhanced handleChange with validation and auto-clear
    const handleChange = (field: string, value: any) => {
        if (readOnly) return;

        updateData((prev: any) => {
            const newData = { ...prev, [field]: value };

            // Clear designation when department changes (designations are department-scoped)
            if (field === "department_id") {
                newData.designation_id = null;
                newData.designation = '';
            }

            // Clear Exit Date if DOJ moves past it
            if (field === "dateOfJoining" && value && newData.exitDate) {
                const dojDate = new Date(value.getFullYear(), value.getMonth(), value.getDate());
                const exitDate = new Date(newData.exitDate.getFullYear(), newData.exitDate.getMonth(), newData.exitDate.getDate());
                if (exitDate < dojDate) {
                    newData.exitDate = undefined;
                    toast({ 
                        title: "Exit Date Cleared", 
                        description: "Exit Date cleared because it is now before the joining date.", 
                        variant: "destructive" 
                    });
                }
            }

            // --- NEW: Handle exitDate change directly ---
            if (field === "exitDate" && value && newData.dateOfJoining) {
                const exitDate = new Date(value.getFullYear(), value.getMonth(), value.getDate());
                const dojDate = new Date(newData.dateOfJoining.getFullYear(), newData.dateOfJoining.getMonth(), newData.dateOfJoining.getDate());
                
                if (exitDate < dojDate) {
                    newData.exitDate = undefined;
                    toast({ 
                        title: "Invalid Exit Date", 
                        description: "Exit Date cannot be earlier than the joining date.", 
                        variant: "destructive" 
                    });
                }
            }
            // --------------------------------------------

            // Clear exit date when status changes to Active
            if (field === "employment_status_id") {
                const newStatusName = (employmentStatuses as Array<{ id: number; value_name: string }>)?.find(s => s.id === value)?.value_name || '';
                if (newStatusName === "Active") newData.exitDate = undefined;
            }

            return newData;
        });
    };

    const validateAllFields = () => {
        const errors: { [key: string]: string } = {};

        const dojError = validateDateOfJoining(data.dateOfJoining);
        if (dojError) errors.dateOfJoining = dojError;

        const exitError = validateExitDate(data.exitDate, data.dateOfJoining, data.employment_status_id);
        if (exitError) errors.exitDate = exitError;

        const statusError = validateEmploymentStatus(data.exitDate, data.employment_status_id);
        if (statusError) errors.employmentStatus = statusError;

        setValidationErrors(errors);

        updateData((prev: any) => ({
            ...prev,
            employmentValidationErrors: errors,
            hasEmploymentValidationErrors: Object.keys(errors).length > 0
        }));
    };

    React.useEffect(() => {
        validateAllFields();
    }, [data.dateOfJoining, data.exitDate, data.employment_status_id]);

    const currentStatusName = getStatusName(data.employment_status_id);
    const currentTypeName = getTypeName(data.employment_type_id);
    const isStatusActive = currentStatusName === "Active" || !currentStatusName;
    const isContractual = currentTypeName === "Contractual";

    return (
        <div className="space-y-6">
            {/* Employment Info */}
            <div className="bg-card border rounded-lg p-4">
                <h4 className="font-semibold mb-4 text-primary">Employment Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <SearchableSelect
                            label="Employment Status"
                            required
                            value={data.employment_status_id?.toString()}
                            options={(employmentStatuses as Array<{ id: number; value_name: string }>)?.map(s => ({ label: s.value_name, value: s.id.toString() }))}
                            onChange={(v) => handleChange("employment_status_id", parseInt(v))}
                            disabled={readOnly}
                            placeholder="Select Employment Status"
                        />
                        {validationErrors.employmentStatus && (
                            <p className="text-sm text-red-500 mt-1">{validationErrors.employmentStatus}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <SearchableSelect
                            label="Employment Type"
                            required
                            value={data.employment_type_id?.toString()}
                            options={(employmentTypes as Array<{ id: number; value_name: string }>)?.map(t => ({ label: t.value_name, value: t.id.toString() }))}
                            onChange={(v) => handleChange("employment_type_id", parseInt(v))}
                            disabled={readOnly}
                            placeholder="Select Employment Type"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>
                            {isContractual ? "Start from" : "Joining date"} <span className="text-red-500">*</span>
                        </Label>
                        <DatePicker date={data.dateOfJoining} setDate={(d) => handleChange("dateOfJoining", d)} disabled={readOnly} maxDate={new Date()} />
                        {validationErrors.dateOfJoining && (
                            <p className="text-sm text-red-500 mt-1">{validationErrors.dateOfJoining}</p>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2">
                        <Label>
                            {isContractual ? "Up to" : "Exit Date"}
                            {(!isStatusActive && !isContractual) && <span className="text-red-500">*</span>}
                        </Label>
                        <div className={cn((!isContractual && isStatusActive) && "bg-muted rounded-md")}>
                            <DatePicker
                                date={data.exitDate}
                                setDate={(d) => handleChange("exitDate", d)}
                                disabled={readOnly || (!isContractual && isStatusActive)}
                                minDate={data.dateOfJoining}
                            />
                        </div>
                        {validationErrors.exitDate && (
                            <p className="text-sm text-red-500 mt-1">{validationErrors.exitDate}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Org Details */}
            <div className="bg-card border rounded-lg p-4">
                <h4 className="font-semibold mb-4 text-primary">Organization Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <SearchableSelect
                            label="Department"
                            required
                            value={data.department_id?.toString()}
                            options={departments?.map((d: any) => ({ label: d.name, value: d.id.toString() }))}
                            onChange={(v) => handleChange("department_id", parseInt(v))}
                            disabled={readOnly}
                            placeholder="Select Department"
                        />
                    </div>
                    <div className="space-y-2">
                        {(() => {
                            const allDesignationOptions = [...designations];
                            if (data.designation_id && data.designation &&
                                !allDesignationOptions.some((d: any) => d.id === data.designation_id)) {
                                allDesignationOptions.push({ id: data.designation_id, value_name: data.designation });
                            }
                            return (
                                <SearchableSelect
                                    label="Designation"
                                    required
                                    value={data.designation_id?.toString()}
                                    options={allDesignationOptions.map((d: any) => ({ label: d.value_name, value: d.id.toString() }))}
                                    onChange={(v) => {
                                        const opt = allDesignationOptions.find((d: any) => d.id.toString() === v);
                                        handleChange("designation_id", parseInt(v));
                                        handleChange("designation", opt?.value_name || '');
                                    }}
                                    disabled={readOnly}
                                    placeholder="Select Designation"
                                />
                            );
                        })()}
                    </div>
                    <div className="space-y-2">
                        <SearchableSelect
                            label="Grade / Level"
                            value={data.grade_id?.toString()}
                            options={(grades as Array<{ id: number; value_name: string }>)?.map(g => ({ label: g.value_name, value: g.id.toString() }))}
                            onChange={(v) => handleChange("grade_id", parseInt(v))}
                            disabled={readOnly}
                            placeholder="Select Grade"
                        />
                    </div>
                    <div className="space-y-2">
                        <SearchableSelect
                            label="Reporting Manager"
                            required
                            value={data.reporting_manager_employee_id?.toString()}
                            options={(reportingManagers as Array<{ id: number; employee_name: string; code?: string }>)?.map(m => ({ label: `${m.employee_name}${m.code ? ` (${m.code})` : ''}`, value: m.id.toString() }))}
                            onChange={(v) => handleChange("reporting_manager_employee_id", parseInt(v))}
                            disabled={readOnly}
                            placeholder="Select Reporting Manager"
                        />
                    </div>
                    <div className="space-y-2">
                        <SearchableSelect
                            label="Location"
                            required
                            value={data.work_location_id?.toString()}
                            options={(locations as Array<{ id: number; value_name: string }>)?.map(l => ({ label: l.value_name, value: l.id.toString() }))}
                            onChange={(v) => handleChange("work_location_id", parseInt(v))}
                            disabled={readOnly}
                            placeholder="Select Location"
                        />
                    </div>
                    <div className="space-y-2">
                        <SearchableSelect
                            label="Shift"
                            value={data.shift_id?.toString()}
                            options={(shifts as Array<{ id: number; value_name: string }>)?.map(s => ({ label: s.value_name, value: s.id.toString() }))}
                            onChange={(v) => handleChange("shift_id", parseInt(v))}
                            disabled={readOnly}
                            placeholder="Select Shift"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}


function DocumentsForm({ data, updateData, readOnly, onAutoSave, onAddDocument, onDeleteDocument, employeeId, documentTypeOptions }: any) {
    const { toast } = useToast();
    const [docs, setDocs] = useState<any[]>(data.documents || []);

    // Sync docs when parent updates (e.g. after API load or refetch)
    useEffect(() => {
        if (data.documents) {
            setDocs(data.documents);
        }
    }, [data.documents]);
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
    const [showAddForm, setShowAddForm] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<any>(null);
    const [newDoc, setNewDoc] = useState<{
        type: string;
        document_type_id: number | null;
        name: string;
        file: File | null;
        fileName: string;
        fileUrl: string;
    }>({ type: "", document_type_id: null, name: "", file: null, fileName: "", fileUrl: "" });

    // Determine UI state based on uploaded documents and form visibility
    const hasUploadedDocs = docs.length > 0 && docs.some(doc => doc.fileName && doc.fileUrl);

    let currentUIState: 'NO_DOCUMENTS' | 'DOCUMENT_LIST' | 'ADD_WITH_HISTORY';

    if (!hasUploadedDocs) {
        currentUIState = 'NO_DOCUMENTS'; // STATE 1
    } else if (hasUploadedDocs && !showAddForm) {
        currentUIState = 'DOCUMENT_LIST'; // STATE 2
    } else {
        currentUIState = 'ADD_WITH_HISTORY'; // STATE 3
    }

    // Helper to truncate long filenames: "first10chars...extension" if length > 15
    // Helper to truncate long filenames/names: "start...extension" or "start..."
    const truncateFileName = (name: string, maxLength: number = 20) => {
        if (!name || name.length <= maxLength) return name;
        const lastDotIndex = name.lastIndexOf('.');
        if (lastDotIndex === -1 || lastDotIndex < name.length - 6) { // If no dot or it's not a short extension
            if (lastDotIndex !== -1 && name.length - lastDotIndex <= 6) {
                // Handle as file with extension
                const extension = name.substring(lastDotIndex);
                const namePart = name.substring(0, lastDotIndex);
                return namePart.substring(0, maxLength - extension.length - 3) + '...' + extension;
            }
            // Handle as plain text
            return name.substring(0, maxLength - 3) + '...';
        }
        const extension = name.substring(lastDotIndex);
        const namePart = name.substring(0, lastDotIndex);
        return namePart.substring(0, maxLength - extension.length - 3) + '...' + extension;
    };

    // File validation function - STRICT validation for Employee Documents only
    const validateFile = (file: File): string | null => {
        // Check file type - STRICT validation
        const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

        if (!allowedExtensions.includes(fileExtension)) {
            return 'Invalid file format. Only PDF, JPG, JPEG, and PNG files are allowed.';
        }

        // Check file size (10MB = 10 * 1024 * 1024 bytes)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return 'File size exceeds 10MB limit. Please choose a smaller file.';
        }

        return null;
    };

    const handleFileChange = (file: File | null) => {
        if (!file || readOnly) return;

        const validationError = validateFile(file);

        if (validationError) {
            setValidationErrors(prev => ({ ...prev, newDoc: validationError }));
            toast({
                description: validationError,
                variant: "destructive"
            });
            // Clear the file input
            const fileInput = document.querySelector(`input[type="file"]`) as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            return;
        }

        // Clear validation error if file is valid
        setValidationErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.newDoc;
            return newErrors;
        });

        // Create file URL for preview/download (simulate uploaded file)
        const fileUrl = URL.createObjectURL(file);

        setNewDoc(prev => ({
            ...prev,
            file,
            fileName: file.name,
            fileUrl
        }));
    };

    const handleSaveDocument = async () => {
        const trimmedName = (newDoc.name || "").trim();

        if (!newDoc.type) {
            toast({ title: "Invalid Document Info", description: "Please select a document type.", variant: "destructive" });
            return;
        }

        if (!trimmedName) {
            toast({
                title: "Invalid Document Info",
                description: "Document Name is required and cannot consist only of whitespace.",
                variant: "destructive"
            });
            return;
        }

        if (trimmedName.length < 2) {
            toast({
                title: "Invalid Document Info",
                description: "Document Name must be at least 2 characters long.",
                variant: "destructive"
            });
            return;
        }

        if (!newDoc.file) {
            toast({ title: "Invalid Document Info", description: "Please select a file to upload.", variant: "destructive" });
            return;
        }

        // --- NEW DUPLICATE NAME CHECK ---
        const lowerCaseTrimmedName = trimmedName.toLowerCase();
        const isDuplicate = docs.some(doc => 
            (doc.name || "").trim().toLowerCase() === lowerCaseTrimmedName
        );

        if (isDuplicate) {
            toast({
                title: "Duplicate Document Name",
                description: `A document with the name "${trimmedName}" already exists. Please use a unique name.`,
                variant: "destructive"
            });
            return;
        }
        // -------------------------------

        // Alphanumeric validation: must start with letter/number and contain only alphanumeric/spaces/hyphens
        const alphanumericRegex = /^[a-zA-Z0-9][a-zA-Z0-9\s-]*$/;
        if (!alphanumericRegex.test(trimmedName)) {
            toast({
                title: "Invalid Document Info",
                description: "Document Name must start with a letter or number and contain only alphanumeric characters, spaces, or hyphens.",
                variant: "destructive"
            });
            return;
        }

        // If API callback is provided (employee exists), upload via FormData
        if (onAddDocument && employeeId) {
            try {
                const formData = new FormData();
                formData.append('employee_id', String(employeeId));
                if (newDoc.document_type_id) {
                    formData.append('document_type_id', String(newDoc.document_type_id));
                }
                formData.append('document_name', newDoc.name);
                formData.append('file', newDoc.file, newDoc.file.name);
                await onAddDocument(formData);
                // Parent's onAddDocument shows its own toast and triggers refetch
            } catch {
                // Error toast shown by caller
            }
        } else {
            // Offline/new employee: add to local state only
            const docToAdd = {
                id: Date.now(),
                type: newDoc.type,
                document_type_id: newDoc.document_type_id,
                name: newDoc.name,
                file: newDoc.file,
                fileName: newDoc.fileName,
                fileUrl: newDoc.fileUrl,
            };
            setDocs(prev => {
                const next = [...prev, docToAdd];
                if (onAutoSave) onAutoSave(next);
                return next;
            });
        }

        setNewDoc({ type: "", document_type_id: null, name: "", file: null, fileName: "", fileUrl: "" });
        setShowAddForm(false);
    };

    const handleAddDocument = () => {
        if (readOnly) return;
        setShowAddForm(true);
    };

    const handleCancelAdd = () => {
        setNewDoc({ type: "", document_type_id: null, name: "", file: null, fileName: "", fileUrl: "" });
        setValidationErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.newDoc;
            return newErrors;
        });
        setShowAddForm(false);
    };

    const removeDoc = (id: number) => {
        if (readOnly) return;

        const docToDeleteData = docs.find(d => d.id === id);
        setDocToDelete(docToDeleteData);
        setIsDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (docToDelete) {
            if (onDeleteDocument && docToDelete.fromApi && docToDelete.id) {
                try {
                    await onDeleteDocument(docToDelete.id);
                    // Parent triggers refetch; local state updated via useEffect on data.documents
                } catch {
                    // Error toast shown by caller
                }
            } else {
                setDocs(prev => {
                    const next = prev.filter(d => d.id !== docToDelete.id);
                    if (onAutoSave) onAutoSave(next);
                    return next;
                });
                toast({
                    title: "Document Deleted",
                    description: `${docToDelete.fileName || 'Document'} has been removed successfully.`,
                    className: "bg-green-50 border-green-200 text-green-900 shadow-md"
                });
            }
        }
        setIsDeleteOpen(false);
        setDocToDelete(null);
    };

    // Logic: Current UI State is used for rendering logic

    // Auto download function - ONLY way to download
    const handleFileDownload = (doc: any) => {
        if (!doc.fileUrl || !doc.fileName) return;

        const link = document.createElement('a');
        link.href = resolveFileUrl(doc.fileUrl);
        link.download = doc.fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // View in new tab function

    // View in new tab function
    const handleFileView = (doc: any) => {
        if (!doc.fileUrl) return;
        window.open(resolveFileUrl(doc.fileUrl), '_blank');
    };

    // Effect to update parent state
    useEffect(() => {
        const hasValidationErrors = Object.keys(validationErrors).length > 0;
        updateData((prev: any) => ({
            ...prev,
            documents: docs,
            documentsHasValidationErrors: hasValidationErrors
        }));
    }, [docs, validationErrors]);

    // Check if there are validation errors
    const hasValidationErrors = Object.keys(validationErrors).length > 0;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-primary">Employee Documents</h4>
                <div className="flex gap-2">
                    {!readOnly && currentUIState === 'DOCUMENT_LIST' && (
                        <Button size="sm" onClick={handleAddDocument}>
                            <Plus className="h-4 w-4 mr-2" /> Add Document
                        </Button>
                    )}
                </div>
            </div>

            {/* STATE 1: NO DOCUMENTS (Initial State) */}
            {currentUIState === 'NO_DOCUMENTS' && (
                <div className="space-y-4">
                    {/* Add Document Form - STATE 1 Layout */}
                    {!readOnly && (
                        <div className="border rounded-md bg-card p-4">
                            <div className="grid grid-cols-12 gap-4 items-end">
                                <div className="col-span-3 space-y-2">
                                    <SearchableSelect
                                        label="Type"
                                        required
                                        value={newDoc.document_type_id ? String(newDoc.document_type_id) : ""}
                                        options={(documentTypeOptions || []).map((opt: any) => ({ label: opt.value_name || opt.label, value: String(opt.id) }))}
                                        onChange={(v) => {
                                            const opt = (documentTypeOptions || []).find((o: any) => String(o.id) === v);
                                            setNewDoc(prev => ({ ...prev, type: opt?.value_name || opt?.label || v, document_type_id: opt ? opt.id : null }));
                                        }}
                                        disabled={readOnly}
                                        placeholder="Select Document Type"
                                    />
                                </div>
                                <div className="col-span-4 space-y-2">
                                    <Label className="text-sm font-medium">Document Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        className="h-9 cursor-text"
                                        value={newDoc.name}
                                        onChange={(e) => setNewDoc(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Enter document name"
                                    />
                                </div>
                                <div className="col-span-4 space-y-2">
                                    <Label className="text-sm font-medium">File <span className="text-red-500">*</span></Label>
                                    <Input
                                        className="h-9 cursor-text"
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0] || null;
                                            handleFileChange(file);
                                        }}
                                    />
                                </div>
                                <div className="col-span-1 flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={handleSaveDocument}
                                        disabled={!newDoc.type || !newDoc.name || !newDoc.file || hasValidationErrors}
                                        className={cn(
                                            (!newDoc.type || !newDoc.name || !newDoc.file || hasValidationErrors) && "bg-muted text-muted-foreground border-muted shadow-none"
                                        )}
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>

                            {/* File preview */}
                            {newDoc.fileName && (
                                <div className="mt-3 p-2 bg-muted/30 rounded border">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-foreground" title={newDoc.fileName}>
                                            {truncateFileName(newDoc.fileName)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Validation error display */}
                            {validationErrors.newDoc && (
                                <div className="mt-3">
                                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
                                        {validationErrors.newDoc}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Empty state for read-only */}
                    {readOnly && (
                        <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
                            <div className="space-y-3">
                                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                                <p>No documents attached.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* STATE 2: DOCUMENT LIST (After First Upload) */}
            {currentUIState === 'DOCUMENT_LIST' && (
                <div className="space-y-3">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 p-3 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                        <div className="col-span-3">Document Type</div>
                        <div className="col-span-3">Document Name</div>
                        <div className={`col-span-${readOnly ? '6' : '4'}`}>File Name</div>
                        {!readOnly && <div className="col-span-2">Actions</div>}
                    </div>

                    {/* Document Entries */}
                    {docs.map((doc) => (
                        doc.fileName && doc.fileUrl && (
                            <div key={doc.id} className="grid grid-cols-12 gap-4 p-3 border rounded-md bg-card hover:bg-muted/20 transition-colors">
                                <div className="col-span-3 text-sm font-medium text-foreground">
                                    {doc.type}
                                </div>
                                <div className="col-span-3 text-sm text-muted-foreground" title={doc.name}>
                                    {truncateFileName(doc.name, 18)}
                                </div>
                                <div className={`col-span-${readOnly ? '6' : '4'}`}>
                                    <a
                                        href={resolveFileUrl(doc.fileUrl)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline font-medium"
                                        title={doc.fileName}
                                    >
                                        {truncateFileName(doc.fileName)}
                                    </a>
                                </div>
                                {!readOnly && (
                                    <div className="col-span-2 flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeDoc(doc.id)}
                                            title="Delete document"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )
                    ))}
                </div>
            )}

            {/* STATE 3: ADD DOCUMENT WITH HISTORY (Second Time Onwards) */}
            {currentUIState === 'ADD_WITH_HISTORY' && (
                <div className="space-y-6">
                    {/* 1️⃣ Top Section — Add Document Form */}
                    <div className="border rounded-md bg-card p-4">
                        <div className="grid grid-cols-12 gap-4 items-end">
                            <div className="col-span-3 space-y-2">
                                <SearchableSelect
                                    label="Type"
                                    required
                                    value={newDoc.document_type_id ? String(newDoc.document_type_id) : ""}
                                    options={(documentTypeOptions || []).map((opt: any) => ({ label: opt.value_name || opt.label, value: String(opt.id) }))}
                                    onChange={(v) => {
                                        const opt = (documentTypeOptions || []).find((o: any) => String(o.id) === v);
                                        setNewDoc(prev => ({ ...prev, type: opt?.value_name || opt?.label || v, document_type_id: opt ? opt.id : null }));
                                    }}
                                    disabled={readOnly}
                                    placeholder="Select Type"
                                />
                            </div>
                            <div className="col-span-4 space-y-2">
                                <Label className="text-sm font-medium">Document Name <span className="text-red-500">*</span></Label>
                                <Input
                                    className="h-9 cursor-text"
                                    value={newDoc.name}
                                    onChange={(e) => setNewDoc(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Enter document name"
                                />
                            </div>
                            <div className="col-span-3 space-y-2">
                                <Label className="text-sm font-medium">File <span className="text-red-500">*</span></Label>
                                <Input
                                    className="h-9 cursor-text"
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        handleFileChange(file);
                                    }}
                                />
                            </div>
                            <div className="col-span-2 flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleSaveDocument}
                                    disabled={!newDoc.type || !newDoc.name || !newDoc.file || hasValidationErrors}
                                    className={cn(
                                        (!newDoc.type || !newDoc.name || !newDoc.file || hasValidationErrors) && "bg-muted text-muted-foreground border-muted shadow-none"
                                    )}
                                >
                                    Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleCancelAdd}>
                                    Cancel
                                </Button>
                            </div>
                        </div>

                        {/* File preview */}
                        {newDoc.fileName && (
                            <div className="mt-3 p-2 bg-muted/30 rounded border">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-foreground" title={newDoc.fileName}>
                                        {truncateFileName(newDoc.fileName)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Validation error display */}
                        {validationErrors.newDoc && (
                            <div className="mt-3">
                                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
                                    {validationErrors.newDoc}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2️⃣ Bottom Section — Previously Added Documents (History) */}
                    <div className="space-y-3">
                        <h5 className="text-sm font-medium text-muted-foreground">Previously Added Documents</h5>

                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 p-3 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                            <div className="col-span-3">Document Type</div>
                            <div className="col-span-3">Document Name</div>
                            <div className={`col-span-${readOnly ? '6' : '4'}`}>File Name</div>
                            {!readOnly && <div className="col-span-2">Actions</div>}
                        </div>

                        {/* Document Entries - History */}
                        {docs.map((doc) => (
                            doc.fileName && doc.fileUrl && (
                                <div key={doc.id} className="grid grid-cols-12 gap-4 p-3 border rounded-md bg-card hover:bg-muted/20 transition-colors">
                                    <div className="col-span-3 text-sm font-medium text-foreground">
                                        {doc.type}
                                    </div>
                                    <div className="col-span-3 text-sm text-muted-foreground" title={doc.name}>
                                        {truncateFileName(doc.name, 18)}
                                    </div>
                                    <div className={`col-span-${readOnly ? '6' : '4'}`}>
                                        <a
                                            href={resolveFileUrl(doc.fileUrl)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-primary hover:underline font-medium"
                                            title={doc.fileName}
                                        >
                                            {truncateFileName(doc.fileName)}
                                        </a>
                                    </div>
                                    {!readOnly && (
                                        <div className="col-span-2 flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => removeDoc(doc.id)}
                                                title="Delete document"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )
                        ))}
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the document record.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

function SystemAccessForm({ data, updateData, readOnly, roles, locations, workCenters, warehouses, operations }: any) {
    const { toast } = useToast();
    const [enableLoginAccess, setEnableLoginAccess] = useState(!!data.enable_login || !!data.enableLoginAccess);
    const [username, setUsername] = useState(data.username || "");
    const [password, setPassword] = useState(data.password || "");
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [locationId, setLocationId] = useState(data.work_location_id || "");
    const [selectedRoles, setSelectedRoles] = useState<number[]>(data.selected_role_ids || []);
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
    // userExists is true when the employee already has a system access record (username loaded from API)
    const [userExists, setUserExists] = useState(!!(data.username));

    // System Access Association State
    const [selectedWorkCenterId, setSelectedWorkCenterId] = useState("");
    const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
    const [selectedOperationId, setSelectedOperationId] = useState("");

    const [isWorkCenterOpen, setIsWorkCenterOpen] = useState(false);
    const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
    const [isOperationOpen, setIsOperationOpen] = useState(false);

    // Color shades for visual linking
    const blueShades = [
        { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
        { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-800 border-sky-200' },
        { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
        { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
        { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-800 border-slate-200' },
    ];

    // Fetch operations for all assigned work centers using the new API
    const assignedWCIds = data.assignedWorkCenters || [];
    const operationQueries = useQueries({
        queries: assignedWCIds.map((id: string) => ({
            queryKey: ['hr-operations-by-wc', id],
            queryFn: () => hrCommonApi.getOperationsByWorkCenter(id),
            staleTime: 300000,
            enabled: !!id
        }))
    });

    // Combine and deduplicate results from all queries
    const dependentOperations = useMemo(() => {
        const opMap = new Map();
        
        assignedWCIds.forEach((wcId: string, index: number) => {
            const query = operationQueries[index] as any;
            if (query && query.data?.data) {
                const list = Array.isArray(query.data.data) ? query.data.data : 
                             (Array.isArray(query.data.data.records) ? query.data.data.records : []);
                
                list.forEach((op: any) => {
                    if (op && op.id) {
                        const existing = opMap.get(op.id);
                        if (existing) {
                            // Add to existing WC list if not already there
                            if (!existing.work_center_ids.includes(String(wcId))) {
                                existing.work_center_ids.push(String(wcId));
                            }
                        } else {
                            opMap.set(op.id, {
                                id: op.id,
                                name: op.name || op.value_name || op.operation_name || '',
                                work_center_ids: [String(wcId)]
                            });
                        }
                    }
                });
            }
        });
        
        return Array.from(opMap.values());
    }, [operationQueries, assignedWCIds]);

    // Handle work center removal with automatic operation cleanup
    const handleRemoveWorkCenter = (id: string) => {
        const currentWC = data.assignedWorkCenters || [];
        const newWC = currentWC.filter((c: string) => c !== id);
        
        // Find which operations are still valid for the REMAINING work centers
        const stillValidOpIds = new Set();
        dependentOperations.forEach((op: any) => {
            if (op.work_center_ids.some((wcId: string) => newWC.includes(wcId))) {
                stillValidOpIds.add(String(op.id));
            }
        });

        const currentOps = data.assignedOperations || [];
        const newOps = currentOps.filter((opId: string) => stillValidOpIds.has(String(opId)));
        
        updateData((prev: any) => ({ 
            ...prev, 
            assignedWorkCenters: newWC, 
            assignedOperations: newOps 
        }));
    };

    // Auto-select if only one option is available in master lists AND not already assigned
    useEffect(() => {
        if (workCenters.length === 1 && !selectedWorkCenterId && !data.assignedWorkCenters?.some((id: any) => String(id) === String(workCenters[0].id))) {
            setSelectedWorkCenterId(workCenters[0].id.toString());
        }
    }, [selectedWorkCenterId, workCenters, data.assignedWorkCenters]);

    useEffect(() => {
        if (warehouses.length === 1 && !selectedWarehouseId && !data.assignedWarehouses?.some((id: any) => String(id) === String(warehouses[0].id))) {
            setSelectedWarehouseId(warehouses[0].id.toString());
        }
    }, [selectedWarehouseId, warehouses, data.assignedWarehouses]);

    useEffect(() => {
        if (operations.length === 1 && !selectedOperationId && !data.assignedOperations?.some((id: any) => String(id) === String(operations[0].id))) {
            setSelectedOperationId(operations[0].id.toString());
        }
    }, [selectedOperationId, operations, data.assignedOperations]);

    // Validation for password
    useEffect(() => {
        if (password && !PASSWORD_REGEX.test(password)) {
            setPasswordError("Password must be at least 8 characters and include uppercase, lowercase, number, and special character.");
        } else {
            setPasswordError(null);
        }
    }, [password]);

    // Roles from API prop
    const availableRoles = (roles as Array<{ id: number; value_name: string }>) || [];

    // Sync from parent formData when API data loads (e.g. when editing an existing record)
    useEffect(() => {
        if (data.username || data.email) {
            setUserExists(true);
            setUsername(data.email || data.username);
        }
        if (data.enable_login !== undefined) {
            setEnableLoginAccess(!!data.enable_login);
        } else if (data.enableLoginAccess !== undefined) {
            setEnableLoginAccess(!!data.enableLoginAccess);
        }
        if (data.selected_role_ids?.length) {
            setSelectedRoles(data.selected_role_ids);
        }
        if (data.work_location_id) {
            setLocationId(data.work_location_id);
        }
    }, [data.username, data.email, data.selected_role_ids, data.enableLoginAccess, data.enable_login, data.work_location_id]);

    // Generate email from employee data
    useEffect(() => {
        if (enableLoginAccess && !userExists) {
            if (data.officialEmail) {
                setUsername(data.officialEmail);
            } else if (data.personalEmail) {
                setUsername(data.personalEmail);
            } else if (data.firstName && data.lastName) {
                const generatedUsername = `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}`;
                setUsername(generatedUsername);
            }
        }
    }, [enableLoginAccess, data.firstName, data.lastName, data.officialEmail, data.personalEmail, userExists]);

    // Sync to parent formData
    useEffect(() => {
        // Validation: Required if login access is enabled
        // Fields are non-mandatory as requested
        const hasMissingFields = false;
        const hasValidationErrors = !!passwordError || hasMissingFields;

        updateData((prev: any) => ({
            ...prev,
            enableLoginAccess,
            enable_login: enableLoginAccess,
            username,
            password,
            work_location_id: locationId,
            selected_role_ids: selectedRoles,
            systemAccessHasValidationErrors: hasValidationErrors
        }));
    }, [enableLoginAccess, username, password, locationId, selectedRoles, passwordError]);


    const handleAddRole = (roleId: number) => {
        if (!roleId) return;
        setSelectedRoles(prev => [...prev, roleId]);
    };

    const handleDeleteRole = (roleId: number) => {
        setSelectedRoles(prev => prev.filter(r => r !== roleId));
    };

    const getRoleName = (roleId: number) => {
        const role = availableRoles.find(r => r.id === roleId);
        return role ? role.value_name : String(roleId);
    };



    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-primary text-sm">System Access Configuration</h4>
                <div className="flex items-center space-x-2">
                    <Label htmlFor="login-access" className="text-xs font-medium cursor-pointer">
                        Enable Login Access
                    </Label>
                    <Switch
                        id="login-access"
                        checked={enableLoginAccess}
                        onCheckedChange={setEnableLoginAccess}
                        disabled={readOnly}
                    />
                </div>
            </div>


            <div className="space-y-2 p-2.5 border rounded-md bg-card">
                    {/* Email (formerly Username) */}
                    <div className="space-y-0.5">
                        <Label htmlFor="username" className="text-[11px] font-medium">
                            Login Email
                        </Label>
                        <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Email"
                            disabled={readOnly || !enableLoginAccess}
                            className="h-8 text-xs w-48 max-w-[200px]"
                        />
                    </div>

                    {/* Password - Manual Entry with View Toggle */}
                    <div className="space-y-0.5">
                        <Label htmlFor="password" className="text-[11px] font-medium">
                            Update Password
                        </Label>
                        <div className="relative w-48 max-w-[200px]">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter new password"
                                disabled={readOnly || !enableLoginAccess}
                                className={cn(
                                    "h-8 text-xs pr-8",
                                    passwordError && "border-destructive focus-visible:ring-destructive"
                                )}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowPassword(!showPassword)}
                                disabled={readOnly || !enableLoginAccess}
                                className="absolute right-0 top-0 h-8 w-8 hover:bg-transparent"
                                title={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                            </Button>
                        </div>
                        {passwordError && enableLoginAccess && (
                            <p className="text-[10px] text-destructive font-medium mt-0.5 leading-tight max-w-[200px]">
                                {passwordError}
                            </p>
                        )}
                    </div>


                    {/* Role Selection Dropdown */}
                    <div className="space-y-0.5">
                        <Label className="text-[11px] font-medium block">
                            Add Role
                        </Label>
                        <div>
                            <Popover open={roleDropdownOpen} onOpenChange={setRoleDropdownOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={roleDropdownOpen}
                                        className="w-40 max-w-[160px] justify-between h-8 font-normal border-input text-xs px-3"
                                        disabled={readOnly || !enableLoginAccess}
                                    >
                                        <span className="text-muted-foreground text-left">
                                            Select role
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[160px] p-0" align="start">
                                    <Command>
                                        <CommandInputBorderless placeholder="Search role..." className="h-8 text-xs" />
                                        <CommandList className="max-h-[200px] overflow-y-auto">
                                            <CommandEmpty className="text-xs py-2">No roles found.</CommandEmpty>
                                            <CommandGroup>
                                                {availableRoles.map((role) => {
                                                    const isSelected = selectedRoles.includes(role.id);
                                                    return (
                                                        <CommandItem
                                                            key={role.id}
                                                            value={role.value_name}
                                                            onSelect={() => {
                                                                if (!isSelected) {
                                                                    handleAddRole(role.id);
                                                                    setRoleDropdownOpen(false);
                                                                }
                                                            }}
                                                            disabled={isSelected}
                                                            className={cn(
                                                                "cursor-pointer text-xs",
                                                                isSelected && "opacity-50 cursor-not-allowed"
                                                            )}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-3.5 w-3.5",
                                                                    isSelected ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {role.value_name}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Selected Roles Table - ALWAYS VISIBLE but empty when toggle OFF */}
                    <div className="space-y-0.5">
                        <Label className="text-[11px] font-medium">Selected Roles</Label>
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-12 h-8 text-xs py-1.5">Sr No</TableHead>
                                        <TableHead className="h-8 text-xs py-1.5">Role Name</TableHead>
                                        <TableHead className="w-16 text-right h-8 text-xs py-1.5">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedRoles.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-3 text-xs text-muted-foreground">
                                                No roles added yet
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        selectedRoles.map((roleId, index) => (
                                            <TableRow key={roleId} className="h-9">
                                                <TableCell className="font-medium py-1.5 text-xs">{index + 1}</TableCell>
                                                <TableCell className="py-1.5 text-xs">{getRoleName(roleId)}</TableCell>
                                                <TableCell className="text-right py-1.5">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteRole(roleId)}
                                                        disabled={readOnly}
                                                        className="h-6 w-6"
                                                    >
                                                        <Trash2 className="h-3 w-3 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

            {/* System Access Associations */}
            <Label className="text-sm font-semibold mb-4 block text-primary">Employee Allocation Details</Label>
            <div className="rounded-md border p-4 bg-muted/20 mb-8">
                {/* Location Dropdown - Synced with Employment & Job Details */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3">
                    <div className="space-y-2">
                        <SearchableSelect
                            label="Location"
                            value={data.work_location_id?.toString()}
                            options={(locations as Array<{ id: number; value_name: string }>)?.map(l => ({ label: l.value_name, value: l.id.toString() }))}
                            onChange={(v) => updateData((prev: any) => ({ ...prev, work_location_id: parseInt(v) }))}
                            disabled={readOnly}
                            placeholder="Select Location"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Warehouses */}
                    <div className="space-y-3">
                        <Label className="text-xs font-semibold">Assigned Warehouses</Label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <SearchableSelect
                                    value={selectedWarehouseId}
                                    options={warehouses.filter((w: any) => w?.id).map((w: any) => ({
                                        label: w.name,
                                        value: String(w.id),
                                        disabled: data.assignedWarehouses?.includes(String(w.id))
                                    }))}
                                    onChange={(v) => setSelectedWarehouseId(v)}
                                    disabled={readOnly}
                                    placeholder="Select Warehouse..."
                                />
                            </div>
                            <Button
                                size="sm"
                                onClick={() => {
                                    if (selectedWarehouseId) {
                                        const current = data.assignedWarehouses || [];
                                        updateData((prev: any) => ({ ...prev, assignedWarehouses: [...current, selectedWarehouseId] }));
                                        setSelectedWarehouseId("");
                                    }
                                }}
                                disabled={!selectedWarehouseId || readOnly}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Warehouses Tags Area */}
                        <div className={cn(
                            "min-h-[100px] p-3 border border-dashed rounded-md bg-background/50 flex flex-wrap gap-2 content-start",
                            (!data.assignedWarehouses || data.assignedWarehouses.length === 0) && "items-center justify-center"
                        )}>
                            {(!data.assignedWarehouses || data.assignedWarehouses.length === 0) ? (
                                <span className="text-xs text-muted-foreground italic">No warehouses assigned</span>
                            ) : (
                                data.assignedWarehouses.map((id: string) => (
                                    <Badge 
                                        key={id} 
                                        variant="secondary" 
                                        className="py-1.5 px-3 flex items-center gap-2 bg-muted/50 hover:bg-muted text-xs font-medium border-transparent"
                                    >
                                        {truncateMiddle(warehouses.find((w: any) => String(w.id) === id)?.name || id, 20, 10)}
                                        {!readOnly && (
                                            <X 
                                                className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" 
                                                onClick={() => {
                                                    const current = data.assignedWarehouses || [];
                                                    updateData((prev: any) => ({ ...prev, assignedWarehouses: current.filter((c: string) => c !== id) }));
                                                }}
                                            />
                                        )}
                                    </Badge>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Work Centers */}
                    <div className="space-y-3">
                        <Label className="text-xs font-semibold">Assigned Work Centers</Label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <SearchableSelect
                                    value={selectedWorkCenterId}
                                    options={workCenters.map((wc: any) => ({
                                        label: wc.name,
                                        value: wc.id.toString(),
                                        disabled: data.assignedWorkCenters?.includes(wc.id.toString())
                                    }))}
                                    onChange={(v) => setSelectedWorkCenterId(v)}
                                    disabled={readOnly}
                                    placeholder="Search work center..."
                                />
                            </div>
                            <Button
                                size="sm"
                                onClick={() => {
                                    if (selectedWorkCenterId) {
                                        const current = data.assignedWorkCenters || [];
                                        updateData((prev: any) => ({ ...prev, assignedWorkCenters: [...current, selectedWorkCenterId] }));
                                        setSelectedWorkCenterId("");
                                    }
                                }}
                                disabled={!selectedWorkCenterId || readOnly}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Work Centers Tags Area */}
                        <div className={cn(
                            "min-h-[100px] p-3 border border-dashed rounded-md bg-background/50 flex flex-wrap gap-2 content-start",
                            (!data.assignedWorkCenters || data.assignedWorkCenters.length === 0) && "items-center justify-center"
                        )}>
                            {(!data.assignedWorkCenters || data.assignedWorkCenters.length === 0) ? (
                                <span className="text-xs text-muted-foreground italic">No work centers assigned</span>
                            ) : (
                                data.assignedWorkCenters.map((id: string, index: number) => {
                                    const shade = blueShades[index % blueShades.length];
                                    return (
                                        <Badge 
                                            key={id} 
                                            className={cn("py-1.5 px-3 flex items-center gap-2 text-xs font-medium border shadow-sm transition-all", shade.badge)}
                                        >
                                            {truncateMiddle(workCenters.find((w: any) => w.id.toString() === id)?.name || id, 20, 10)}
                                            {!readOnly && (
                                                <X 
                                                    className="h-3 w-3 cursor-pointer opacity-70 hover:opacity-100 transition-opacity" 
                                                    onClick={() => handleRemoveWorkCenter(id)}
                                                />
                                            )}
                                        </Badge>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Operations */}
                    <div className="space-y-3">
                        <Label className="text-xs font-semibold">Assigned Operations</Label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <SearchableSelect
                                    value={selectedOperationId}
                                    options={dependentOperations.map((op: any) => ({
                                        label: op.name,
                                        value: String(op.id),
                                        disabled: data.assignedOperations?.includes(String(op.id))
                                    }))}
                                    onChange={(v) => setSelectedOperationId(v)}
                                    disabled={readOnly || (data.assignedWorkCenters?.length === 0)}
                                    placeholder={data.assignedWorkCenters?.length > 0 ? "Search operation..." : "Select work center first"}
                                />
                            </div>
                            <Button
                                size="sm"
                                onClick={() => {
                                    if (selectedOperationId) {
                                        const current = data.assignedOperations || [];
                                        updateData((prev: any) => ({ ...prev, assignedOperations: [...current, selectedOperationId] }));
                                        setSelectedOperationId("");
                                    }
                                }}
                                disabled={!selectedOperationId || readOnly}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Operations Tags Area */}
                        <div className={cn(
                            "min-h-[100px] p-3 border border-dashed rounded-md bg-background/50 flex flex-wrap gap-2 content-start",
                            (!data.assignedOperations || data.assignedOperations.length === 0) && "items-center justify-center"
                        )}>
                            {(!data.assignedOperations || data.assignedOperations.length === 0) ? (
                                <span className="text-xs text-muted-foreground italic">
                                    {data.assignedWorkCenters?.length > 0 ? "No operations assigned" : "Select work center to see operations"}
                                </span>
                            ) : (
                                data.assignedOperations.map((id: string) => {
                                    // Try to find in dependentOperations first, then fallback to operations prop
                                    const op = dependentOperations.find((o: any) => String(o.id) === id) || 
                                               operations.find((o: any) => String(o.id) === id);
                                    
                                    // For color coding, find the first matching work center that is still assigned
                                    const matchingWCId = op?.work_center_ids?.find((wcId: string) => data.assignedWorkCenters?.includes(wcId)) || 
                                                       (op?.work_center_id || op?.workcenter_id);
                                    
                                    const wcIndex = data.assignedWorkCenters?.indexOf(String(matchingWCId));
                                    const shade = wcIndex !== -1 && wcIndex !== undefined ? blueShades[wcIndex % blueShades.length] : { badge: 'bg-muted text-muted-foreground' };
                                    
                                    return (
                                        <Badge 
                                            key={id} 
                                            className={cn("py-1.5 px-3 flex items-center gap-2 text-xs font-medium border shadow-sm transition-all", shade.badge)}
                                        >
                                            {truncateMiddle(op?.name || id, 20, 10)}
                                            {!readOnly && (
                                                <X 
                                                    className="h-3 w-3 cursor-pointer opacity-70 hover:opacity-100 transition-opacity" 
                                                    onClick={() => {
                                                        const current = data.assignedOperations || [];
                                                        updateData((prev: any) => ({ ...prev, assignedOperations: current.filter((c: string) => c !== id) }));
                                                    }}
                                                />
                                            )}
                                        </Badge>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {!enableLoginAccess && (
                <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm">Login access is disabled for this employee.</p>
                    <p className="text-xs mt-1">Enable the toggle above to configure system access.</p>
                </div>
            )}
        </div>
    );
}

function DatePicker({ date, setDate, disabled = false, maxDate, minDate }: { date?: Date, setDate: (d?: Date) => void, disabled?: boolean, maxDate?: Date, minDate?: Date }) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
    const [visibleDate, setVisibleDate] = useState(() => date || maxDate || new Date());

    useEffect(() => {
        const targetDate = date || maxDate;
        if (targetDate) {
            setVisibleDate(prev => {
                if (prev && prev.getTime() === targetDate.getTime()) {
                    return prev;
                }
                return targetDate;
            });
        }
    }, [date, maxDate]);

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const monthNamesShort = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const formatDisplayDate = (date: Date | undefined) => {
        if (!date) return "Pick a date";
        try {
            return format(date, "dd-MM-yyyy");
        } catch (error) {
            return "Pick a date";
        }
    };

    const handleDateSelect = (selectedDate: Date) => {
        setDate(selectedDate);
        setIsOpen(false);
        setViewMode("day");
    };

    const handleMonthSelect = (monthIndex: number) => {
        const newDate = new Date(visibleDate.getFullYear(), monthIndex, 1);
        setVisibleDate(newDate);
        setViewMode("day");
    };

    const handleYearSelect = (year: number) => {
        const newDate = new Date(year, visibleDate.getMonth(), 1);
        setVisibleDate(newDate);
        setViewMode("month"); // Go to month picker after year selection for better UX
    };

    const navigateMonth = (direction: number) => {
        const newDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + direction, 1);
        setVisibleDate(newDate);
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];

        // Previous month's trailing days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const currentDate = new Date(year, month - 1, prevMonthLastDay - i);
            const isPast = minDate ? currentDate < minDate : false;
            const isFuture = maxDate ? currentDate > maxDate : false;
            const isDisabled = isPast || isFuture;
            days.push({
                date: currentDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false,
                isDisabled
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const today = new Date();
            const isToday = currentDate.toDateString() === today.toDateString();
            const isSelected = date && currentDate.toDateString() === date.toDateString();
            const isPast = minDate ? currentDate < minDate : false;
            const isFuture = maxDate ? currentDate > maxDate : false;
            const isDisabled = isPast || isFuture;

            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday,
                isSelected,
                isDisabled
            });
        }

        // Next month's leading days
        const remainingDays = 42 - days.length; // 6 rows × 7 days
        for (let day = 1; day <= remainingDays; day++) {
            const currentDate = new Date(year, month + 1, day);
            const isPast = minDate ? currentDate < minDate : false;
            const isFuture = maxDate ? currentDate > maxDate : false;
            const isDisabled = isPast || isFuture;
            days.push({
                date: currentDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false,
                isDisabled
            });
        }

        return days;
    };

    const renderDayView = () => {
        const days = getDaysInMonth(visibleDate);
        const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

        return (
            <div className="w-80">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigateMonth(-1)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            className="font-semibold text-sm"
                            onClick={() => setViewMode("month")}
                        >
                            {monthNames[visibleDate.getMonth()]}
                            <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            className="font-semibold text-sm"
                            onClick={() => setViewMode("year")}
                        >
                            {visibleDate.getFullYear()}
                            <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigateMonth(1)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* Week days header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day) => (
                        <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, index) => (
                        <Button
                            key={index}
                            variant="ghost"
                            size="icon"
                            disabled={day.isDisabled}
                            className={cn(
                                "h-8 w-8 text-sm font-normal",
                                !day.isCurrentMonth && "text-muted-foreground opacity-50",
                                day.isToday && "bg-accent text-accent-foreground font-semibold",
                                day.isSelected && "bg-primary text-primary-foreground font-semibold",
                                day.isCurrentMonth && !day.isDisabled && "hover:bg-accent hover:text-accent-foreground",
                                day.isDisabled && "opacity-20 cursor-not-allowed"
                            )}
                            onClick={() => !day.isDisabled && handleDateSelect(day.date)}
                        >
                            {day.date.getDate()}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    const renderMonthView = () => {
        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewMode("day")}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{visibleDate.getFullYear()}</h3>
                    <Button
                        variant="ghost"
                        className="font-semibold text-sm"
                        onClick={() => setViewMode("year")}
                    >
                        {visibleDate.getFullYear()}
                        <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {monthNamesShort.map((month, index) => (
                        <Button
                            key={month}
                            variant="ghost"
                            className={cn(
                                "h-10 text-sm font-normal",
                                index === visibleDate.getMonth() && "bg-primary text-primary-foreground font-semibold"
                            )}
                            onClick={() => handleMonthSelect(index)}
                        >
                            {month}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    const renderYearView = () => {
        const currentYear = visibleDate.getFullYear();
        const startYear = Math.floor(currentYear / 12) * 12;
        const years = Array.from({ length: 12 }, (_, i) => startYear + i);

        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            const newStartYear = startYear - 12;
                            setVisibleDate(new Date(newStartYear, visibleDate.getMonth(), 1));
                        }}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{startYear} - {startYear + 11}</h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            const newStartYear = startYear + 12;
                            setVisibleDate(new Date(newStartYear, visibleDate.getMonth(), 1));
                        }}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {years.map((year) => (
                        <Button
                            key={year}
                            variant="ghost"
                            className={cn(
                                "h-10 text-sm font-normal",
                                year === currentYear && "bg-primary text-primary-foreground font-semibold"
                            )}
                            onClick={() => handleYearSelect(year)}
                        >
                            {year}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 hover:bg-transparent",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDisplayDate(date) : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 shadow-lg border rounded-lg z-9999" align="start" side="bottom" sideOffset={4}>
                {viewMode === "day" && renderDayView()}
                {viewMode === "month" && renderMonthView()}
                {viewMode === "year" && renderYearView()}
            </PopoverContent>
        </Popover>
    );
}

function dataSourceFiller() {
    return null;
}
