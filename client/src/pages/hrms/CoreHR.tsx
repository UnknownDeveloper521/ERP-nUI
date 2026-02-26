import React, { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query"; // Fixed import
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee, useDepartments } from "@/hooks/useApi";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea"; // Assuming this exists or using Input as fallback
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar"; // Check if used or using HTML date input
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandInputBorderless } from "@/components/ui/command";
import { format } from "date-fns";
import { CalendarIcon, Plus, Edit, Upload, Trash2, Search, User, Briefcase, FileText, ShieldCheck, FileSpreadsheet, ChevronLeft, ChevronRight, Eye, EyeOff, ChevronDown, ExternalLink, Download, ChevronsUpDown, Check, Copy, Key, Info, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

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

// --- Reusable Searchable Combobox Component ---

interface SearchableSelectProps {
    label: string;
    value?: string;
    options: string[];
    onChange: (val: string) => void;
    required?: boolean;
    disabled?: boolean;
}

function SearchableSelect({
    label,
    value,
    options,
    onChange,
    required = false,
    disabled = false,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="space-y-2">
            <Label>
                {label} {required && <span className="text-red-500">*</span>}
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-10 font-normal border-input"
                        disabled={disabled}
                    >
                        <span className={cn(!value && "text-muted-foreground")}>
                            {value || `Select ${label}`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                        <CommandInputBorderless placeholder={`Search ${label.toLowerCase()}...`} className="h-9" />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                {options.map((item) => (
                                    <CommandItem
                                        key={item}
                                        value={item}
                                        onSelect={() => {
                                            onChange(item);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === item ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {item}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}

// --- Master Data Options ---
// ⚠️ SAFE GUARD: Added ONE mock record to each master data array to prevent runtime crashes
// This ensures dropdowns never crash when trying to map over empty arrays
// ============================================================================

const cityOptions: string[] = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai"];
const stateOptions: string[] = ["Maharashtra", "Delhi", "Karnataka", "Telangana", "Tamil Nadu"];
const countryOptions: string[] = ["India", "USA", "UK", "Canada", "Australia"];
const designationOptions: string[] = ["Software Engineer", "Manager", "Team Lead", "Senior Engineer", "HR Manager"];
const gradeOptions: string[] = ["A", "B", "C", "D", "E"];
const workLocationOptions: string[] = ["Head Office", "Branch Office", "Remote", "Factory"];
const shiftOptions: string[] = ["General Shift (9 AM - 6 PM)", "Night Shift (10 PM - 7 AM)", "Flexible"];
const employmentTypeOptions: string[] = ["Full-time", "Part-time", "Full-time on Probation", "Part-time on Probation", "Contractual"];
const employmentStatusOptions: string[] = ["Active", "Inactive", "Terminated"];
const probationPeriodOptions: Array<{ value: string; label: string }> = [
    { value: "3", label: "3 Months" },
    { value: "6", label: "6 Months" },
    { value: "12", label: "12 Months" }
];
const genderOptions: string[] = ["Male", "Female", "Other"];

// --- Mock Data for System Access ---
// Copied from respective master files to support dropdowns
const initialWorkCenters = [
    { id: 1, name: "Assembly Line 1" },
    { id: 2, name: "Packaging Unit" },
];

const initialWarehouses = [
    { id: 1, name: "Main Warehouse" },
    { id: 2, name: "Cold Storage" },
];

const initialOperations = [
    { id: 1, name: "Molding" },
    { id: 2, name: "Cutting" },
    { id: 3, name: "Welding" },
    { id: 4, name: "Painting" },
];


// --- Components ---

export default function CoreHR() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    // const { data: employees = [], isLoading } = useEmployees();
    const isLoading = false;
    // ⚠️ SAFE GUARD: Added ONE mock employee to prevent runtime crashes
    // This ensures the employee list never crashes when empty
    // ============================================================================
    const [employees, setEmployees] = useState<any[]>([
        {
            id: "emp-001",
            employeeId: "EMP001",
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@company.com",
            phone: "+91 9876543210",
            departmentId: "dept-001",
            designation: "Software Engineer",
            status: "active",
            dateOfJoining: "2025-01-15",
            type: "Full Time",
            address: "123 Main Street, Mumbai",
            postalCode: "400001",
            dateOfBirth: "1995-05-15",
            gender: "Male",
            employmentType: "Full Time",
            reportingTo: "Manager"
        }
    ]);

    // ============================================================================
    // ⚠️ UNNECESSARY CODE - REMOVE BEFORE PRODUCTION
    // ============================================================================
    // Function: removeDuplicateEmployees()
    // 
    // WHY IT WAS USED:
    // - This was a workaround to fix a bug where employees were being added multiple times
    // - It filters out duplicate employees based on employeeId on component mount
    // 
    // WHY IT'S NOT NEEDED:
    // - This is a band-aid solution for a deeper problem
    // - With proper API integration, the backend should prevent duplicates
    // - The database should have unique constraints on employeeId
    // - This adds unnecessary processing on every page load
    // - If duplicates exist, they should be fixed at the source (API/Database)
    // 
    // RECOMMENDATION: Remove this function and fix the root cause
    // ============================================================================
    const removeDuplicateEmployees = () => {
        setEmployees(prev => {
            const uniqueEmployees = prev.filter((employee, index, self) =>
                index === self.findIndex(e => e.employeeId === employee.employeeId)
            );
            // ⚠️ UNNECESSARY: Console log for debugging - remove in production
            console.log('🧹 Removed duplicates:', prev.length, '→', uniqueEmployees.length);
            return uniqueEmployees;
        });
    };

    // ⚠️ UNNECESSARY: This useEffect only runs the duplicate removal function
    // Remove this along with removeDuplicateEmployees()
    useEffect(() => {
        removeDuplicateEmployees();
    }, []);
    // const { data: departments = [] } = useDepartments();
    // ⚠️ SAFE GUARD: Added ONE mock department to prevent runtime crashes
    // This ensures department dropdowns never crash when empty
    // ============================================================================
    const departments: Array<{ id: string; name: string; code: string }> = [
        { id: "dept-001", name: "Engineering", code: "ENG" },
        { id: "dept-002", name: "Human Resources", code: "HR" },
        { id: "dept-003", name: "Finance", code: "FIN" }
    ];

    const createEmployeeMutation = {
        mutateAsync: async (payload: any) => {
            // ⚠️ UNNECESSARY: Console log for debugging - remove in production
            // WHY USED: To debug what data is being sent to create employee
            // WHY NOT NEEDED: Use browser DevTools Network tab instead
            console.log('🚀 Creating employee with payload:', payload);

            // ============================================================================
            // ⚠️ UNNECESSARY CODE - SIMULATED API DELAY
            // ============================================================================
            // WHY IT WAS USED:
            // - To simulate real API call latency during development with mock data
            // - Makes the UI feel more realistic by showing loading states
            // 
            // WHY IT'S NOT NEEDED:
            // - Real API calls will have natural network latency
            // - This artificially slows down the application by 1 second
            // - Wastes user time and makes the app feel sluggish
            // - No benefit in production environment
            // 
            // RECOMMENDATION: Remove this line completely
            // ============================================================================
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Create new employee with explicit field mapping to ensure consistency
            const newEmployee = {
                id: `emp_${Date.now()}`, // Use unique ID with timestamp
                employeeId: payload.employeeId || `EMP-${Math.floor(Math.random() * 10000)}`,
                firstName: payload.firstName || "",
                lastName: payload.lastName || "",
                email: payload.email || "",
                phone: payload.phone || "",
                departmentId: payload.departmentId || "",
                designation: payload.designation || "",
                status: payload.status || "active",
                dateOfJoining: payload.dateOfJoining || "",
                type: payload.employmentType || "Full Time",
                address: payload.address || "",
                postalCode: payload.postalCode || "",
                dateOfBirth: payload.dateOfBirth || "",
                gender: payload.gender || "Male",
                employmentType: payload.employmentType || "Full Time",
                reportingTo: payload.reportingTo || ""
            };

            console.log('✅ New employee created:', newEmployee);

            // Update state synchronously and return promise that resolves after state update
            return new Promise((resolve) => {
                setEmployees(prev => {
                    // Check if employee with same employeeId already exists
                    const existingEmployee = prev.find(emp => emp.employeeId === newEmployee.employeeId);
                    if (existingEmployee) {
                        console.log('⚠️ Employee with ID', newEmployee.employeeId, 'already exists. Skipping duplicate.');
                        resolve(existingEmployee);
                        return prev; // Return unchanged array
                    }

                    console.log('📝 Previous employees count:', prev.length);
                    const updated = [...prev, newEmployee];
                    console.log('📝 Updated employees count:', updated.length);
                    console.log('📝 New employee added:', newEmployee.firstName, newEmployee.lastName);

                    // Resolve promise after state update to ensure synchronization
                    setTimeout(() => resolve(newEmployee), 50);
                    return updated;
                });
            });
        }
    };

    const updateEmployeeMutation = {
        mutateAsync: async ({ id, data }: { id: string, data: any }) => {
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update employee in list
            setEmployees(prev => prev.map(emp =>
                emp.id === id ? { ...emp, ...data } : emp
            ));

            return { id, ...data };
        }
    };

    const deleteEmployeeMutation = {
        mutateAsync: async (id: string) => {
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 500));

            // Remove employee from list
            setEmployees(prev => prev.filter(emp => emp.id !== id));

            return { id };
        }
    };
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const handleDelete = async () => {
        if (!editingId) return;

        try {
            await deleteEmployeeMutation.mutateAsync(editingId);
            toast({ title: "Success", description: "Employee deleted successfully." });
            setIsDeleteOpen(false);
            handleBackToList();
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to delete employee.", variant: "destructive" });
        }
    };

    const [location, setLocation] = useLocation();
    const [matchNew] = useRoute("/hrms/core-hr/employees/new");
    const [matchEdit, params] = useRoute("/hrms/core-hr/employees/:id");

    // Validation function to check if current tab's required fields are filled
    const isCurrentTabValid = (): boolean => {
        switch (activeTab) {
            case 'personal':
                return !!(
                    formData.firstName &&
                    formData.lastName &&
                    formData.mobileNumber &&
                    formData.gender &&
                    formData.dateOfBirth
                );
            case 'job':
                const hasRequiredJobFields = !!(
                    formData.dateOfJoining &&
                    formData.departmentId &&
                    formData.designation &&
                    formData.employmentType &&
                    formData.employmentStatus &&
                    formData.reportingManager &&
                    formData.workLocation
                );
                // Also check for employment validation errors
                return hasRequiredJobFields && !formData.hasEmploymentValidationErrors;
            case 'docs':
                // Documents tab requires at least one document to be uploaded
                const hasUploadedDocuments = formData.documents &&
                    formData.documents.length > 0 &&
                    formData.documents.some((doc: any) => doc.fileName && doc.fileUrl);
                return hasUploadedDocuments && !formData.documentsHasValidationErrors;
            default:
                return true;
        }
    };

    // Validation function to check if ALL tabs' required fields are filled (for Save Employee button)
    const areAllTabsValid = (): boolean => {
        // Personal Details validation
        const isPersonalValid = !!(
            formData.firstName &&
            formData.lastName &&
            formData.mobileNumber &&
            formData.gender &&
            formData.dateOfBirth
        );

        // Employment & Job Details validation
        const isJobValid = !!(
            formData.dateOfJoining &&
            formData.departmentId &&
            formData.designation &&
            formData.employmentType &&
            formData.employmentStatus &&
            formData.reportingManager &&
            formData.workLocation
        ) && !formData.hasEmploymentValidationErrors;

        // Documents validation - OPTIONAL (employee can be saved without documents)
        // Only check for validation errors if documents exist
        const isDocsValid = !formData.documentsHasValidationErrors;

        // System Access validation - ONLY if login access is enabled
        let isSystemValid = true;
        if (formData.enableLoginAccess) {
            isSystemValid = !!(
                formData.username &&
                formData.password &&
                formData.selectedRoles &&
                formData.selectedRoles.length > 0
            );
        }
        // If login access is disabled, system tab is always valid (employee can be saved without login)

        // Debug logging to help identify which tab is blocking Save Employee button
        console.log('📋 Save Employee Button Validation:', {
            isPersonalValid,
            isJobValid,
            isDocsValid,
            isSystemValid,
            enableLoginAccess: formData.enableLoginAccess,
            allValid: isPersonalValid && isJobValid && isDocsValid && isSystemValid
        });

        return isPersonalValid && isJobValid && isDocsValid && isSystemValid;
    };

    const handleClear = () => {
        setFormData((prev: any) => {
            const newData = { ...prev };

            if (activeTab === 'personal') {
                const fields = [
                    'employeeCode', 'firstName', 'lastName', 'gender',
                    'dateOfBirth', 'maritalStatus', 'nationality', 'bloodGroup',
                    'mobileNumber', 'alternateMobile', 'personalEmail', 'officialEmail',
                    'currentAddress', 'permanentAddress', 'city', 'state', 'pincode', 'country', 'photo'
                ];
                fields.forEach(f => newData[f] = "");
            } else if (activeTab === 'job') {
                const fields = [
                    'dateOfJoining', 'employmentType', 'employmentStatus',
                    'confirmationDate', 'exitDate', 'departmentId', 'designation',
                    'grade', 'reportingManager', 'workLocation', 'shift'
                ];
                fields.forEach(f => newData[f] = "");
            } else if (activeTab === 'docs') {
                newData.documents = [];
            } else if (activeTab === 'system') {
                // System tab - only clear if adding new (not editing existing)
                if (viewMode === 'add') {
                    newData.enableLoginAccess = false;
                    newData.username = "";
                    newData.password = "";
                    newData.selectedRoles = [];
                    newData.assignedWorkCenters = [];
                    newData.assignedWarehouses = [];
                    newData.assignedOperations = [];
                }
            }

            return newData;
        });
    };

    // Derived Logic
    const viewMode = matchNew ? 'add' : (matchEdit ? 'edit' : 'list');
    const editingId = matchEdit && params ? params.id : null;

    // List View State
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Row Selection State
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

    // Import Modal State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importValidationErrors, setImportValidationErrors] = useState<string[]>([]);
    const [isImportValid, setIsImportValid] = useState(false);
    const [isValidated, setIsValidated] = useState(false);
    const [validationMessage, setValidationMessage] = useState<string>('');

    // Required columns for validation with flexible matching
    const REQUIRED_COLUMNS = [
        'first name',
        'last name',
        'gender',
        'date of birth',
        'mobile number',
        'current address',
        'employment status',
        'employment type',
        'joining date',
        'department',
        'designation',
        'grade / level',
        'reporting manager',
        'location'
    ];

    // Column variations mapping for flexible header matching
    const COLUMN_VARIATIONS: { [key: string]: string[] } = {
        'employee id': ['employee id', 'employeeid', 'emp id', 'emp_id'],
        'first name': ['first name', 'firstname', 'first_name'],
        'last name': ['last name', 'lastname', 'last_name'],
        'gender': ['gender'],
        'date of birth': ['date of birth', 'dateofbirth', 'date_of_birth', 'dob', 'birth date', 'birthdate', 'birth_date'],
        'mobile number': ['mobile number', 'mobilenumber', 'mobile_number', 'phone number', 'phonenumber', 'phone_number', 'phone', 'mobile'],
        'current address': ['current address', 'currentaddress', 'current_address', 'address'],
        'employment status': ['employment status', 'employmentstatus', 'employment_status', 'status'],
        'employment type': ['employment type', 'employmenttype', 'employment_type', 'type'],
        'joining date': ['joining date', 'joiningdate', 'joining_date', 'date of joining', 'dateofjoining', 'doj'],
        'department': ['department', 'departmentid', 'dept'],
        'designation': ['designation'],
        'grade / level': ['grade / level', 'grade/level', 'grade', 'level'],
        'reporting manager': ['reporting manager', 'reportingmanager', 'reporting_manager', 'reporting to', 'reportingto', 'reporting'],
        'location': ['location', 'work location', 'worklocation', 'work_location']
    };

    // User-friendly display names for required columns
    const REQUIRED_COLUMNS_DISPLAY = [
        'First Name',
        'Last Name',
        'Gender',
        'Date of Birth',
        'Mobile Number',
        'Current Address',
        'Employment Status',
        'Employment Type',
        'Joining Date',
        'Department',
        'Designation',
        'Grade / Level',
        'Reporting Manager',
        'Location'
    ];
    const requiredImportColumns = [
        'Employee ID',
        'First Name',
        'Last Name',
        'Gender',
        'Date of Birth',
        'Mobile Number',
        'Current Address',
        'Employment Status',
        'Employment Type',
        'Joining Date',
        'Department',
        'Designation',
        'Grade / Level',
        'Reporting Manager',
        'Location'
    ];

    // All supported import columns (required + optional)
    const allImportColumns = [
        ...requiredImportColumns,
        'Nationality',
        'Blood Group',
        'Marital Status',
        'Anniversary Date',
        // Contact Information
        'Mobile Number',
        'Alternate Mobile',
        'Personal Email',
        'Official Email',
        // Address Information
        'Current Address',
        'Permanent Address',
        'City',
        'State',
        'Pincode',
        'Country',
        // Employment Information
        'Date of Joining',
        'Employment Type',
        'Employment Status',
        'Exit Date',
        // Organization Details
        'Department',
        'Designation',
        'Grade / Level',
        'Reporting Manager',
        'Work Location',
        'Shift',
        // System Access
        'Login Access Status',
        'Username',
        'Role(s)'
    ];

    // Import file validation
    const validateImportFile = (file: File): string[] => {
        const errors: string[] = [];

        // Check file type
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'text/csv', // .csv
            'application/vnd.ms-excel' // .xls (legacy)
        ];

        const fileExtension = file.name.toLowerCase().split('.').pop();
        const isValidExtension = fileExtension === 'xlsx' || fileExtension === 'csv';

        if (!allowedTypes.includes(file.type) && !isValidExtension) {
            errors.push('Invalid file format. Only .xlsx and .csv files are allowed.');
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

        if (!file) return;

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

    // Read actual file content
    const readFileContent = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                resolve(content);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    };

    // Validate file columns and row data
    const validateFileColumns = async () => {
        if (!importFile) return;

        try {
            setValidationMessage('Validating file...');

            const fileExtension = importFile.name.toLowerCase().split('.').pop();

            if (fileExtension !== 'csv' && fileExtension !== 'xlsx') {
                setValidationMessage('❌ Invalid file format');
                setIsImportValid(false);
                setImportValidationErrors(['Invalid file format. Only .xlsx and .csv files are supported.']);
                setIsValidated(true);
                return;
            }

            // Read actual file content
            let fileContent: string;
            try {
                fileContent = await readFileContent(importFile);
            } catch (error) {
                setValidationMessage('❌ Could not read file content');
                setIsImportValid(false);
                setImportValidationErrors(['Could not read file. Please try again.']);
                setIsValidated(true);
                return;
            }

            // Parse the actual CSV content
            const { headers, rows } = parseCSVContent(fileContent);

            if (headers.length === 0) {
                setValidationMessage('❌ File appears to be empty or invalid');
                setIsImportValid(false);
                setImportValidationErrors(['File appears to be empty or has no headers.']);
                setIsValidated(true);
                return;
            }

            // Step 1: Check for forbidden columns (Employee ID should not be in import file)
            const normalizedHeaders = headers.map(normalizeHeader);
            const forbiddenColumns = ['employee id', 'employeeid', 'emp id', 'emp_id', 'employee code', 'employeecode', 'emp code', 'emp_code'];
            const foundForbiddenColumn = normalizedHeaders.find(header =>
                forbiddenColumns.some(forbidden => header === normalizeHeader(forbidden))
            );

            if (foundForbiddenColumn) {
                const message = `❌ Validation Failed: Employee ID column is not allowed in import file. Employee ID is auto-generated by the system.`;
                setValidationMessage(message);
                setIsImportValid(false);
                setImportValidationErrors(['Employee ID column found in file. Please remove it as Employee ID is auto-generated by the system.']);
                setIsValidated(true);
                return;
            }

            // Step 2: Header/Column Validation with flexible matching
            const missingColumns: string[] = [];

            REQUIRED_COLUMNS.forEach(requiredCol => {
                const variations = COLUMN_VARIATIONS[requiredCol] || [requiredCol];
                const found = normalizedHeaders.some(header =>
                    variations.some(variation => header === normalizeHeader(variation))
                );
                if (!found) {
                    missingColumns.push(requiredCol);
                }
            });

            if (missingColumns.length > 0) {
                const message = `❌ Validation Failed: Missing required columns: ${missingColumns.join(', ')}`;
                setValidationMessage(message);
                setIsImportValid(false);
                setImportValidationErrors([`Missing required columns: ${missingColumns.join(', ')}`]);
                setIsValidated(true);
                return;
            }

            // Step 3: Row-Level Validation
            const rowErrors: { row: number, missing: string[] }[] = [];

            // Create column index mapping with flexible matching
            const columnIndexMap: { [key: string]: number } = {};
            REQUIRED_COLUMNS.forEach(requiredCol => {
                const variations = COLUMN_VARIATIONS[requiredCol] || [requiredCol];
                const headerIndex = normalizedHeaders.findIndex(header =>
                    variations.some(variation => header === normalizeHeader(variation))
                );
                if (headerIndex !== -1) {
                    columnIndexMap[requiredCol] = headerIndex;
                }
            });

            // Validate each row (only if there are data rows)
            if (rows.length > 0) {
                rows.forEach((row, rowIndex) => {
                    const missingValues: string[] = [];

                    REQUIRED_COLUMNS.forEach(requiredCol => {
                        const colIndex = columnIndexMap[requiredCol];
                        if (colIndex !== undefined) {
                            const cellValue = row[colIndex] || '';
                            if (!cellValue.trim()) {
                                missingValues.push(requiredCol);
                            }
                        }
                    });

                    if (missingValues.length > 0) {
                        rowErrors.push({
                            row: rowIndex + 2, // +2 because row 1 is header and array is 0-indexed
                            missing: missingValues
                        });
                    }
                });
            }

            if (rowErrors.length > 0) {
                const errorDetails = rowErrors.map(error =>
                    `Row ${error.row}: ${error.missing.join(', ')}`
                ).join(' | ');

                const message = `❌ Validation Failed: Missing required values found: ${errorDetails}`;
                setValidationMessage(message);
                setIsImportValid(false);
                setImportValidationErrors([`Missing required values in rows: ${errorDetails}`]);
                setIsValidated(true);
                return;
            }

            // Step 4: Success - All validations passed
            setValidationMessage('✅ Validation Successful: All required columns and required row values are present');
            setIsImportValid(true);
            setImportValidationErrors([]);
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

            // Read and parse the actual CSV file
            const fileContent = await readFileContent(importFile);
            const { headers, rows } = parseCSVContent(fileContent);

            if (rows.length === 0) {
                toast({
                    title: "Import Failed",
                    description: "No data rows found in the file.",
                    variant: "destructive"
                });
                return;
            }

            // Create column mapping for flexible header matching
            const normalizedHeaders = headers.map(normalizeHeader);
            const columnMapping: { [key: string]: number } = {};

            // Map all possible columns including optional ones
            const ALL_POSSIBLE_COLUMNS = [
                ...REQUIRED_COLUMNS,
                'nationality', 'blood group', 'marital status', 'anniversary date',
                'alternate mobile', 'official email', 'permanent address', 'city', 'state', 'pincode', 'country',
                'exit date', 'shift', 'login access status', 'username', 'roles'
            ];

            const DYNAMIC_VARIATIONS: { [key: string]: string[] } = {
                ...COLUMN_VARIATIONS,
                'nationality': ['nationality'],
                'blood group': ['blood group', 'bloodgroup', 'blood_group'],
                'marital status': ['marital status', 'maritalstatus', 'marital_status'],
                'anniversary date': ['anniversary date', 'anniversarydate', 'anniversary_date'],
                'alternate mobile': ['alternate mobile', 'alternatemobile', 'alternate_mobile', 'alt mobile'],
                'official email': ['official email', 'officialemail', 'official_email', 'work email'],
                'permanent address': ['permanent address', 'permanentaddress', 'permanent_address'],
                'city': ['city'],
                'state': ['state'],
                'pincode': ['pincode', 'postal code', 'postalcode', 'zip code', 'zipcode'],
                'country': ['country'],
                'exit date': ['exit date', 'exitdate'],
                'shift': ['shift'],
                'login access status': ['login access status', 'loginstatus', 'login_status', 'access status'],
                'username': ['username', 'user name'],
                'roles': ['roles', 'role', 'role(s)']
            };

            ALL_POSSIBLE_COLUMNS.forEach(col => {
                const variations = DYNAMIC_VARIATIONS[col] || [col];
                const headerIndex = normalizedHeaders.findIndex(header =>
                    variations.some(variation => header === normalizeHeader(variation))
                );
                if (headerIndex !== -1) {
                    columnMapping[col] = headerIndex;
                }
            });

            // Process each row and create employee objects
            const importedEmployees: any[] = [];

            rows.forEach((row, rowIndex) => {
                try {
                    // Extract data using column mapping helper
                    const getValue = (col: string) => {
                        const idx = columnMapping[col];
                        return idx !== undefined ? row[idx] : undefined;
                    };

                    const employeeData = {
                        id: `imp_${Date.now()}_${rowIndex}`, // Unique ID for imported employee
                        // Employee ID will be auto-generated by backend - do not read from file
                        firstName: getValue('first name') || '',
                        lastName: getValue('last name') || '',
                        gender: getValue('gender') || 'Male',
                        dateOfBirth: getValue('date of birth') || '',
                        nationality: getValue('nationality') || '',
                        bloodGroup: getValue('blood group') || '',
                        maritalStatus: getValue('marital status') || '',
                        anniversaryDate: getValue('anniversary date') || '',

                        phone: getValue('mobile number') || '',
                        alternateMobile: getValue('alternate mobile') || '',
                        email: getValue('official email') || '',
                        personalEmail: '',
                        officialEmail: getValue('official email') || '',

                        address: getValue('current address') || '',
                        permanentAddress: getValue('permanent address') || '',
                        city: getValue('city') || '',
                        state: getValue('state') || '',
                        postalCode: getValue('pincode') || '',
                        country: getValue('country') || '',

                        dateOfJoining: getValue('joining date') || new Date().toISOString().split('T')[0],
                        employmentType: getValue('employment type') || 'Full Time',
                        status: getValue('employment status') || 'active',
                        employmentStatus: getValue('employment status') || 'active',
                        exitDate: getValue('exit date') || '',

                        departmentId: getValue('department') || '',
                        designation: getValue('designation') || 'Employee',
                        grade: getValue('grade / level') || '',
                        reportingTo: getValue('reporting manager') || '',
                        workLocation: getValue('location') || 'Office',
                        shift: getValue('shift') || ''
                    };

                    // Only add if basic required fields are present
                    if (employeeData.firstName && employeeData.lastName) {
                        importedEmployees.push(employeeData);
                    }
                } catch (error) {
                    console.warn(`Error processing row ${rowIndex + 2}:`, error);
                }
            });

            if (importedEmployees.length === 0) {
                toast({
                    title: "Import Failed",
                    description: "No valid employee records found in the file.",
                    variant: "destructive"
                });
                return;
            }

            // Add imported employees to the existing list
            setEmployees(prev => {
                console.log(`📥 Importing ${importedEmployees.length} new employees`);
                return [...prev, ...importedEmployees];
            });

            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 1000));

            toast({
                title: "Import Completed",
                description: `Successfully imported ${importedEmployees.length} employee(s).`,
                className: "bg-green-50 border-green-200 text-green-900"
            });

            // Reset and close modal
            setIsImportModalOpen(false);
            setImportFile(null);
            setImportValidationErrors([]);
            setIsImportValid(false);
            setIsValidated(false);
            setValidationMessage('');

            // Reset to first page to show imported employees
            setCurrentPage(1);
            setSearchTerm('');

        } catch (error) {
            console.error('Import error:', error);
            toast({
                title: "Import Failed",
                description: "An error occurred while importing employee data.",
                variant: "destructive"
            });
        }
    };

    // Derived Logic
    const filteredEmployees = employees.filter((emp: any) =>
        emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    console.log('Current state:', {
        totalEmployees: employees.length,
        searchTerm,
        filteredEmployees: filteredEmployees.length,
        currentPage
    });

    const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
    const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    console.log('Pagination:', {
        totalPages,
        paginatedEmployees: paginatedEmployees.length,
        itemsPerPage
    });

    // Selection handlers
    const handleSelectEmployee = (employeeId: string, checked: boolean) => {
        if (checked) {
            setSelectedEmployeeIds(prev => [...prev, employeeId]);
        } else {
            setSelectedEmployeeIds(prev => prev.filter(id => id !== employeeId));
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const currentPageEmployeeIds = paginatedEmployees.map((emp: any) => emp.id);
            setSelectedEmployeeIds(currentPageEmployeeIds);
        } else {
            setSelectedEmployeeIds([]);
        }
    };

    const handleBulkExport = () => {
        // Filter selected employees for export
        const selectedEmployees = employees.filter((emp: any) => selectedEmployeeIds.includes(emp.id));

        // Mandatory headers only (Red Dots in UI)
        const headers = [
            "Employee ID",
            "First Name",
            "Last Name",
            "Gender",
            "Date of Birth",
            "Mobile Number",
            "Current Address",
            "Employment Status",
            "Employment Type",
            "Joining Date",
            "Department",
            "Designation",
            "Grade / Level",
            "Reporting Manager",
            "Location"
        ];

        // Helper function to calculate age
        const calculateAge = (dateOfBirth: string | Date): string => {
            if (!dateOfBirth) return '';
            const birthDate = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
            const today = new Date();
            if (isNaN(birthDate.getTime())) return '';
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            return age >= 0 ? `${age}` : '';
        };

        // Helper function to format dates
        const formatDate = (date: string | Date): string => {
            if (!date) return '';
            try {
                const dateObj = typeof date === 'string' ? new Date(date) : date;
                return isNaN(dateObj.getTime()) ? '' : format(dateObj, 'dd/MM/yyyy');
            } catch {
                return '';
            }
        };

        // Helper function to get department name
        const getDepartmentName = (deptId: string): string => {
            const dept = departments.find((d: any) => d.id === deptId);
            return dept ? dept.name : deptId || '';
        };

        // Helper function to get department code
        const getDepartmentCode = (deptId: string): string => {
            const dept = departments.find((d: any) => d.id === deptId);
            return dept ? dept.code : '';
        };

        // Helper function to get reporting manager name
        const getReportingManagerName = (managerId: string): string => {
            const manager = employees.find((e: any) => e.id === managerId);
            return manager ? `${manager.firstName} ${manager.lastName}` : managerId || '';
        };

        // Helper to get system access info
        const getSystemAccessInfo = (employeeId: string) => {
            const savedUsers = localStorage.getItem("system_users");
            const users = savedUsers ? JSON.parse(savedUsers) : [];
            const user = users.find((u: any) => u.employeeId === employeeId);
            return user ? {
                status: 'Enabled',
                username: user.username,
                roles: user.roles?.join(', ') || ''
            } : {
                status: 'Disabled',
                username: '',
                roles: ''
            };
        };

        const csvRows = [
            headers.join(","),
            ...selectedEmployees.map((emp: any) => {
                return [
                    emp.employeeId || '',
                    emp.firstName || '',
                    emp.lastName || '',
                    emp.gender || '',
                    formatDate(emp.dateOfBirth),
                    `'${emp.phone || emp.mobileNumber || ''}`,
                    emp.address || emp.currentAddress || '',
                    emp.status || emp.employmentStatus || '',
                    emp.employmentType || emp.type || '',
                    formatDate(emp.dateOfJoining),
                    getDepartmentName(emp.departmentId),
                    emp.designation || '',
                    emp.grade || '',
                    getReportingManagerName(emp.reportingTo || emp.reportingManager),
                    emp.workLocation || emp.location || 'Office'
                ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(",")
            })
        ];

        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `employee_detailed_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        toast({
            title: "Export Completed",
            description: `${selectedEmployees.length} employee(s) exported with complete details.`,
            className: "bg-green-50 border-green-200 text-green-900"
        });
    };

    const handleDownloadTemplate = () => {
        const headers = [
            "First Name",
            "Last Name",
            "Gender",
            "Date of Birth",
            "Mobile Number",
            "Current Address",
            "Employment Status",
            "Employment Type",
            "Joining Date",
            "Department",
            "Designation",
            "Grade / Level",
            "Reporting Manager",
            "Location"
        ];

        // Only headers, no sample data row
        const csvContent = headers.join(",");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "employee_import_template.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        toast({
            title: "Template Downloaded",
            description: "Employee import template has been downloaded.",
            className: "bg-blue-50 border-blue-200 text-blue-900"
        });
    };

    // Clear selection when search term or page changes
    useEffect(() => {
        setSelectedEmployeeIds([]);
    }, [searchTerm, currentPage]);

    // Reset to first page when adding new employee
    useEffect(() => {
        if (employees.length > 0) {
            setCurrentPage(1);
        }
    }, [employees.length]);

    // Debug: Log employees array whenever it changes and force re-render
    useEffect(() => {
        console.log('🔍 Employees state updated:', {
            count: employees.length,
            employees: employees.map(emp => ({
                id: emp.id,
                name: `${emp.firstName} ${emp.lastName}`,
                email: emp.email
            }))
        });
    }, [employees]);

    // Calculate selection state for header checkbox
    const isAllSelected = paginatedEmployees.length > 0 && selectedEmployeeIds.length === paginatedEmployees.length;
    const isIndeterminate = selectedEmployeeIds.length > 0 && selectedEmployeeIds.length < paginatedEmployees.length;

    // Form State
    // const [editingId, setEditingId] = useState<string | null>(null); // Derived form URL
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState("personal");
    const [formData, setFormData] = useState<any>({});

    // Initialize form with defaults
    const resetForm = () => {
        const newEmployeeId = `EMP-${Math.floor(Math.random() * 10000)}`;
        setFormData({
            employeeId: newEmployeeId,
            employeeCode: newEmployeeId,
            firstName: "",
            lastName: "",
            gender: "",
            dateOfBirth: undefined,
            maritalStatus: "",
            nationality: "",
            bloodGroup: "",
            mobileNumber: "",
            alternateMobile: "",
            personalEmail: "",
            officialEmail: "",
            currentAddress: "",
            permanentAddress: "",
            city: "",
            state: "",
            pincode: "",
            country: "",

            dateOfJoining: undefined,
            employmentType: "",
            employmentStatus: "",
            confirmationDate: undefined,
            exitDate: undefined,
            departmentId: "",
            designation: "",
            grade: "",
            reportingManager: "",
            workLocation: "Office",
            shift: "",

            documents: [],

            // System Access fields
            enableLoginAccess: false,
            username: "",
            password: "",
            selectedRoles: [],
        });
        setActiveTab("personal");
    };

    // Effect to handle URL changes and load data
    useEffect(() => {
        if (viewMode === 'add') {
            resetForm();
        } else if (viewMode === 'edit' && editingId) {
            const employee = employees.find((e: any) => e.id === editingId || e.employeeId === editingId);

            if (employee) {
                setFormData({
                    ...employee,
                    // Keep existing mappings for compatibility
                    employeeCode: employee.employeeCode || employee.employeeId,
                    mobileNumber: employee.mobileNumber || employee.phone,
                    personalEmail: employee.personalEmail || employee.email,
                    currentAddress: employee.currentAddress || employee.address || "",
                    pincode: employee.pincode || employee.postalCode,
                    // Ensure all other fields are present
                    nationality: employee.nationality || "",
                    bloodGroup: employee.bloodGroup || "",
                    maritalStatus: employee.maritalStatus || "",
                    officialEmail: employee.officialEmail || "",
                    alternateMobile: employee.alternateMobile || "",
                    permanentAddress: employee.permanentAddress || "",
                    city: employee.city || "",
                    state: employee.state || "",
                    country: employee.country || "",
                    designation: employee.designation || "",
                    departmentId: employee.departmentId || "",
                    grade: employee.grade || "",
                    reportingManager: employee.reportingTo || employee.reportingManager || "",
                    workLocation: employee.workLocation || "Office",
                    shift: employee.shift || "",
                    // Date conversions
                    dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth) : undefined,
                    dateOfJoining: employee.dateOfJoining ? new Date(employee.dateOfJoining) : undefined,
                    anniversaryDate: employee.anniversaryDate ? new Date(employee.anniversaryDate) : undefined,
                    exitDate: employee.exitDate ? new Date(employee.exitDate) : undefined,
                    employmentStatus: employee.status || employee.employmentStatus || "Active",
                    gender: employee.gender || "Male",
                    employmentType: employee.employmentType || employee.type || "Full Time",
                });
            }
        }
    }, [viewMode, editingId, employees]);

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

    const handleAddNew = () => {
        setLocation("/hrms/core-hr/employees/new");
    };

    const handleEdit = (employee: any) => {
        setLocation(`/hrms/core-hr/employees/${employee.id}`);
    };

    const handleBackToList = () => {
        // Clear any form state and ensure we're on the first page to see new employees
        setSearchTerm("");
        setCurrentPage(1);
        setSelectedEmployeeIds([]);
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

    const handleSave = async (shouldExit: boolean = false) => {
        console.log('💾 HandleSave called:', {
            viewMode,
            editingId,
            shouldExit,
            isEditing,
            currentURL: window.location.pathname
        });

        // For Save & Next (shouldExit = false), just move to next tab without saving to database
        if (!shouldExit) {
            handleNextTab();
            return;
        }

        // Basic validation before save
        if (!formData.firstName || !formData.lastName) {
            toast({
                title: "Validation Error",
                description: "Please fill all required fields (First Name, Last Name).",
                variant: "destructive"
            });
            return;
        }

        // Validate System Access if enabled
        if (formData.enableLoginAccess) {
            if (!formData.username) {
                toast({
                    title: "Validation Error",
                    description: "Username is required when login access is enabled.",
                    variant: "destructive"
                });
                return;
            }
            if (!formData.password) {
                toast({
                    title: "Validation Error",
                    description: "Password is required when login access is enabled.",
                    variant: "destructive"
                });
                return;
            }
            if (!formData.selectedRoles || formData.selectedRoles.length === 0) {
                toast({
                    title: "Validation Error",
                    description: "At least one role must be selected when login access is enabled.",
                    variant: "destructive"
                });
                return;
            }
        }

        try {
            const payload = {
                employeeId: formData.employeeCode || formData.employeeId,
                firstName: formData.firstName,
                lastName: formData.lastName,
                gender: formData.gender,
                dateOfBirth: formData.dateOfBirth ? format(formData.dateOfBirth, "yyyy-MM-dd") : null,
                nationality: formData.nationality,
                bloodGroup: formData.bloodGroup,
                maritalStatus: formData.maritalStatus,
                anniversaryDate: formData.anniversaryDate ? format(formData.anniversaryDate, "yyyy-MM-dd") : null,

                email: formData.personalEmail,
                officialEmail: formData.officialEmail,
                phone: formData.mobileNumber,
                alternateMobile: formData.alternateMobile,

                address: formData.currentAddress,
                permanentAddress: formData.permanentAddress,
                city: formData.city,
                state: formData.state,
                postalCode: formData.pincode,
                country: formData.country,

                dateOfJoining: formData.dateOfJoining ? format(formData.dateOfJoining, "yyyy-MM-dd") : null,
                employmentType: formData.employmentType,
                type: formData.employmentType,
                status: formData.employmentStatus,
                exitDate: formData.exitDate ? format(formData.exitDate, "yyyy-MM-dd") : null,

                departmentId: formData.departmentId,
                designation: formData.designation,
                grade: formData.grade,
                reportingTo: formData.reportingManager,
                workLocation: formData.workLocation,
                shift: formData.shift
            };

            if (viewMode === 'edit' && editingId) {
                console.log('🔄 Updating existing employee with ID:', editingId);
                await updateEmployeeMutation.mutateAsync({ id: editingId, data: payload });
                toast({
                    title: "Employee Updated",
                    description: "Employee information updated successfully.",
                    className: "bg-green-50 border-green-200 text-green-900"
                });
            } else if (viewMode === 'add') {
                console.log('➕ Creating new employee (viewMode:', viewMode, ', editingId:', editingId, ')');
                const newEmployee: any = await createEmployeeMutation.mutateAsync(payload);

                // Create user account if login access is enabled
                if (formData.enableLoginAccess && formData.username && formData.password && formData.selectedRoles && formData.selectedRoles.length > 0) {
                    const savedUsers = localStorage.getItem("system_users");
                    const users = savedUsers ? JSON.parse(savedUsers) : [];

                    const newUser = {
                        id: `user_${Date.now()}`,
                        employeeId: newEmployee.id,
                        username: formData.username,
                        password: formData.password,
                        roles: formData.selectedRoles, // Store as array
                        createdAt: new Date().toISOString(),
                        isActive: true
                    };

                    users.push(newUser);
                    localStorage.setItem("system_users", JSON.stringify(users));

                    toast({
                        title: "User Account Created",
                        description: `Login credentials created for ${formData.username}`,
                        className: "bg-blue-50 border-blue-200 text-blue-900"
                    });
                }

                toast({
                    title: "Employee Created",
                    description: "New employee added successfully.",
                    className: "bg-green-50 border-green-200 text-green-900"
                });

                // Clear search and reset pagination to show new employee
                setSearchTerm("");
                setCurrentPage(1);

                // Wait for state to update before navigation
                await new Promise(resolve => setTimeout(resolve, 100));
                console.log('🔍 After employee creation - Total employees:', employees.length);
            } else if (viewMode === 'edit' && editingId) {
                console.log('🔄 Updating existing employee with ID:', editingId);
                await updateEmployeeMutation.mutateAsync({ id: editingId, data: payload });

                // Update user account if it exists and roles changed
                if (formData.enableLoginAccess && formData.selectedRoles && formData.selectedRoles.length > 0) {
                    const savedUsers = localStorage.getItem("system_users");
                    const users = savedUsers ? JSON.parse(savedUsers) : [];
                    const userIndex = users.findIndex((u: any) => u.employeeId === editingId);

                    if (userIndex !== -1) {
                        // Update existing user roles and password if provided
                        users[userIndex].roles = formData.selectedRoles;
                        if (formData.password) {
                            users[userIndex].password = formData.password;
                        }
                        localStorage.setItem("system_users", JSON.stringify(users));
                    } else if (formData.username && formData.password) {
                        // Create new user account for existing employee
                        const newUser = {
                            id: `user_${Date.now()}`,
                            employeeId: editingId,
                            username: formData.username,
                            password: formData.password,
                            roles: formData.selectedRoles, // Store as array
                            createdAt: new Date().toISOString(),
                            isActive: true
                        };

                        users.push(newUser);
                        localStorage.setItem("system_users", JSON.stringify(users));

                        toast({
                            title: "User Account Created",
                            description: `Login credentials created for ${formData.username}`,
                            className: "bg-blue-50 border-blue-200 text-blue-900"
                        });
                    }
                }

                toast({
                    title: "Employee Updated",
                    description: "Employee information updated successfully.",
                    className: "bg-green-50 border-green-200 text-green-900"
                });
            } else {
                console.log('⚠️ Unexpected state - viewMode:', viewMode, ', editingId:', editingId);
                toast({
                    title: "Error",
                    description: "Unable to determine save operation type.",
                    variant: "destructive"
                });
                return;
            }

            // Wait a bit more before navigation to ensure state is fully updated
            await new Promise(resolve => setTimeout(resolve, 200));
            handleBackToList();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to save employee.",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {viewMode === 'list' ? "Core HR" : (viewMode === 'add' ? "Add New Employee" : "Edit Employee")}
                    </h1>
                    <p className="text-muted-foreground">
                        {viewMode === 'list' ? "Manage employee directory and details." : "Fill in the details below."}
                    </p>
                </div>
                {viewMode !== 'list' && (
                    <div className="flex gap-2">
                        {/* Logic: 
                            If ADD mode: Show Cancel (to list) and Save.
                            If EDIT mode (View state): Show Back (to list), Delete, Edit Info.
                            If EDIT mode (Edit state): Show Cancel (to view), Delete, Update Info.
                        */}

                        {(viewMode === 'add') && (
                            <Button variant="outline" onClick={handleBackToList}>Cancel</Button>
                        )}

                        {(viewMode === 'edit' && !isEditing) && (
                            <Button variant="outline" onClick={handleBackToList}>Back</Button>
                        )}

                        {(viewMode === 'edit' && isEditing) && (
                            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                        )}

                        {viewMode === 'edit' && editingId && (
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
                                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}

                        {/* Action Buttons */}
                        {viewMode === 'edit' && !isEditing && (
                            <Button onClick={() => setIsEditing(true)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Info
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* List View */}
            {viewMode === 'list' && (
                <div className="space-y-4">
                    {/* Controls Bar */}
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="relative w-full sm:w-72 p-0.5">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search employees..."
                                    className="pl-9 search-input-caret-fix"
                                    value={searchTerm} // Need to add state
                                    onChange={(e) => setSearchTerm ? setSearchTerm(e.target.value) : null} // Placeholder until state added check
                                    ref={(el) => {
                                        if (el) {
                                            // Force styles using setProperty with important flag
                                            el.style.setProperty('caret-color', '#000000', 'important');
                                            el.style.setProperty('color', '#333333', 'important');
                                            el.style.setProperty('-webkit-text-fill-color', '#333333', 'important');
                                            el.style.setProperty('-webkit-caret-color', '#000000', 'important');
                                            el.style.setProperty('-moz-caret-color', '#000000', 'important');
                                        }
                                    }}
                                    onFocus={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        target.style.setProperty('caret-color', '#000000', 'important');
                                        target.style.setProperty('color', '#333333', 'important');
                                        target.style.setProperty('-webkit-text-fill-color', '#333333', 'important');
                                        target.style.setProperty('-webkit-caret-color', '#000000', 'important');
                                        target.style.setProperty('-moz-caret-color', '#000000', 'important');
                                    }}
                                    onInput={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        target.style.setProperty('caret-color', '#000000', 'important');
                                        target.style.setProperty('color', '#333333', 'important');
                                        target.style.setProperty('-webkit-text-fill-color', '#333333', 'important');
                                        target.style.setProperty('-webkit-caret-color', '#000000', 'important');
                                        target.style.setProperty('-moz-caret-color', '#000000', 'important');
                                    }}
                                    onClick={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        target.style.setProperty('caret-color', '#000000', 'important');
                                        target.style.setProperty('color', '#333333', 'important');
                                        target.style.setProperty('-webkit-text-fill-color', '#333333', 'important');
                                        target.style.setProperty('-webkit-caret-color', '#000000', 'important');
                                        target.style.setProperty('-moz-caret-color', '#000000', 'important');
                                    }}
                                />
                            </div>
                            {/* Selected Count Indicator */}
                            {selectedEmployeeIds.length > 0 && (
                                <div className="text-sm text-muted-foreground">
                                    {selectedEmployeeIds.length} selected
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {/* Export Button - Only enabled when employees are selected */}
                            <Button variant="outline" disabled={selectedEmployeeIds.length === 0} onClick={handleBulkExport}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> Export
                            </Button>
                            {/* Import Button */}
                            <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                                <Upload className="mr-2 h-4 w-4" /> Import
                            </Button>
                            {/* Add New Employee Button - Disabled when employees are selected */}
                            <Button onClick={handleAddNew} disabled={selectedEmployeeIds.length > 0}>
                                <Plus className="mr-2 h-4 w-4" /> Add New Employee
                            </Button>
                        </div>
                    </div>

                    {/* Table-like Card Layout */}
                    <div className="bg-card border rounded-lg overflow-hidden shadow-sm" key={`employee-list-${employees.length}`}>
                        {/* Header Row */}
                        <div className="grid grid-cols-13 gap-4 p-4 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                            <div className="col-span-1 flex items-center">
                                <Checkbox
                                    checked={isIndeterminate ? "indeterminate" : isAllSelected}
                                    onCheckedChange={handleSelectAll}
                                />
                            </div>
                            <div className="col-span-3">Name</div>
                            <div className="col-span-2">Email</div>
                            <div className="col-span-2">Phone No.</div>
                            <div className="col-span-1">Gender</div>
                            <div className="col-span-1">Dept</div>
                            <div className="col-span-1">Designation</div>
                            <div className="col-span-1">Status</div>
                            <div className="col-span-1 text-right">Action</div>
                        </div>

                        {/* Loading State */}
                        {isLoading ? (
                            <div className="p-8 text-center text-muted-foreground">Loading employees...</div>
                        ) : (
                            <div className="divide-y">
                                {paginatedEmployees.map((emp: any) => (
                                    <div
                                        key={emp.id}
                                        className="grid grid-cols-13 gap-4 p-4 items-center hover:bg-muted/30 transition-colors group"
                                    >
                                        {/* Checkbox */}
                                        <div className="col-span-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedEmployeeIds.includes(emp.id)}
                                                onCheckedChange={(checked) => handleSelectEmployee(emp.id, checked as boolean)}
                                            />
                                        </div>

                                        {/* Name with Avatar */}
                                        <div className="col-span-3 flex items-center gap-3 cursor-pointer" onClick={() => handleEdit(emp)}>
                                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                                                {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm text-foreground">{emp.firstName} {emp.lastName}</span>
                                                <span className="text-xs text-muted-foreground">{emp.employeeId}</span>
                                            </div>
                                        </div>

                                        {/* Email */}
                                        <div className="col-span-2 text-sm text-muted-foreground truncate cursor-pointer" title={emp.email} onClick={() => handleEdit(emp)}>
                                            {emp.email}
                                        </div>

                                        {/* Phone */}
                                        <div className="col-span-2 text-sm text-muted-foreground cursor-pointer" onClick={() => handleEdit(emp)}>
                                            {emp.phone}
                                        </div>

                                        {/* Gender */}
                                        <div className="col-span-1 text-sm text-muted-foreground cursor-pointer" onClick={() => handleEdit(emp)}>
                                            {emp.gender || "Male"}
                                        </div>

                                        {/* Department */}
                                        <div className="col-span-1 text-sm text-muted-foreground cursor-pointer" onClick={() => handleEdit(emp)}>
                                            {departments.find((d: any) => d.id === emp.departmentId)?.code || emp.departmentId}
                                        </div>

                                        {/* Designation */}
                                        <div className="col-span-1 text-sm text-muted-foreground truncate cursor-pointer" onClick={() => handleEdit(emp)}>
                                            {emp.designation}
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-1 cursor-pointer" onClick={() => handleEdit(emp)}>
                                            <Badge variant={emp.status?.toLowerCase() === 'active' ? 'default' : 'secondary'} className={cn("text-xs font-normal lowercase", emp.status?.toLowerCase() === 'active' ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-700")}>
                                                {emp.status?.toLowerCase()}
                                            </Badge>
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-1 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEdit(emp)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {paginatedEmployees.length === 0 && (
                                    <div className="p-8 text-center text-muted-foreground">No employees found.</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center px-1">
                        <div className="text-sm text-muted-foreground">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length} entries
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages || totalPages === 0}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
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
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                            >
                                Employment & Job Details
                            </TabsTrigger>
                            <TabsTrigger
                                value="docs"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                            >
                                Documents
                            </TabsTrigger>
                            <TabsTrigger
                                value="system"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                            >
                                System Access
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 mt-4 bg-card border rounded-xl shadow-sm overflow-hidden">
                        <ScrollArea className="flex-1">
                            <div className="p-6">
                                <TabsContent value="personal" className="m-0 focus-visible:ring-0">
                                    <PersonalDetailsForm data={formData} updateData={setFormData} readOnly={viewMode === 'edit' && !isEditing} />
                                </TabsContent>
                                <TabsContent value="job" className="m-0 focus-visible:ring-0">
                                    <EmploymentDetailsForm data={formData} updateData={setFormData} departments={departments} employees={employees} readOnly={viewMode === 'edit' && !isEditing} />
                                </TabsContent>
                                <TabsContent value="docs" className="m-0 focus-visible:ring-0">
                                    <DocumentsForm data={formData} updateData={setFormData} readOnly={viewMode === 'edit' && !isEditing} />
                                </TabsContent>
                                <TabsContent value="system" className="m-0 focus-visible:ring-0">
                                    <SystemAccessForm data={formData} updateData={setFormData} readOnly={viewMode === 'edit' && !isEditing} />
                                </TabsContent>
                            </div>
                        </ScrollArea>

                        <div className="p-4 border-t bg-muted/20 flex justify-end gap-3 shrink-0">
                            {(isEditing || viewMode === 'add') && (
                                <Button
                                    variant="outline"
                                    onClick={handleClear}
                                    disabled={activeTab === 'docs'}
                                >
                                    Clear
                                </Button>
                            )}

                            {/* Save & Next button - show for Personal and Employment tabs only */}
                            {(isEditing || viewMode === 'add') && (activeTab === 'personal' || activeTab === 'job') && (
                                <Button
                                    onClick={() => handleSave(false)}
                                    disabled={!isCurrentTabValid()}
                                    className={`${isCurrentTabValid()
                                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                        }`}
                                >
                                    Save & Next
                                </Button>
                            )}

                            {/* Save & Next button for Documents tab - navigates to System Access */}
                            {(isEditing || viewMode === 'add') && activeTab === 'docs' && (
                                <Button
                                    onClick={() => {
                                        // Save document data and navigate to System Access tab
                                        setActiveTab('system');
                                    }}
                                    disabled={!isCurrentTabValid()}
                                    className={`${isCurrentTabValid()
                                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                        }`}
                                >
                                    Save & Next
                                </Button>
                            )}

                            {/* Save Employee button - only on System Access tab */}
                            {(isEditing || viewMode === 'add') && activeTab === 'system' && (
                                <Button
                                    onClick={() => handleSave(true)}
                                    disabled={!areAllTabsValid()}
                                    className={`${areAllTabsValid()
                                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                        }`}
                                >
                                    {viewMode === 'edit' ? 'Update Info' : 'Save Employee'}
                                </Button>
                            )}
                        </div>
                    </div>
                </Tabs>
            )}

            {/* Import Employee Modal */}
            <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Import Employee Details</DialogTitle>
                        <DialogDescription>
                            Upload a .xlsx or .csv file containing employee master data.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Download Template Button */}
                        <div className="flex justify-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownloadTemplate}
                                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download Template
                            </Button>
                        </div>

                        {/* File Upload Section */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">
                                Select File <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="file"
                                accept=".xlsx,.csv"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    handleImportFileChange(file);
                                }}
                                className="cursor-pointer"
                            />
                            {importFile && (
                                <div className="text-sm text-muted-foreground">
                                    Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
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

                        {/* Validation Message Area */}
                        {validationMessage && (
                            <div className={`p-3 rounded-md text-sm ${validationMessage.includes('✅')
                                ? 'bg-green-50 border border-green-200 text-green-800'
                                : 'bg-red-50 border border-red-200 text-red-800'
                                }`}>
                                {validationMessage}
                            </div>
                        )}

                        {/* Required Columns Info - Show after validation or initially */}
                        {isValidated && !isImportValid && (
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
                        )}

                        {/* File Format Notes */}
                        <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-3">
                            <div className="font-medium text-blue-900 mb-1">File Format Requirements:</div>
                            <ul className="space-y-1 text-blue-800">
                                <li>• Supported formats: .xlsx, .csv</li>
                                <li>• First row must contain column headers</li>
                                <li>• Employee Photo is NOT supported</li>
                            </ul>
                        </div>

                        {/* Validation Errors */}
                        {importValidationErrors.length > 0 && (
                            <div className="space-y-2">
                                {importValidationErrors.map((error, index) => (
                                    <div key={index} className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
                                        {error}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => {
                            setIsImportModalOpen(false);
                            setImportFile(null);
                            setImportValidationErrors([]);
                            setIsImportValid(false);
                            setIsValidated(false);
                            setValidationMessage('');
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

function PersonalDetailsForm({ data, updateData, readOnly }: any) {
    const handleChange = (field: string, value: any) => {
        if (readOnly) return;
        updateData((prev: any) => {
            const next = { ...prev, [field]: value };
            if (field === "currentAddress" && prev.sameAsCurrentAddress) {
                next.permanentAddress = value;
            }
            return next;
        });
    };

    return (
        <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-card border rounded-lg p-6">
                <h4 className="font-semibold mb-6 text-primary border-b pb-2">Basic Information</h4>

                <div className="grid grid-cols-12 gap-8">
                    {/* Left Column: Photo */}
                    <div className="col-span-12 md:col-span-3 flex flex-col items-center pt-2">
                        <div className="w-40 h-40 rounded-full bg-muted border-4 border-muted-foreground/10 flex items-center justify-center overflow-hidden relative group shadow-inner">
                            {data.photo ? (
                                <img
                                    src={typeof data.photo === 'string' ? data.photo : URL.createObjectURL(data.photo)}
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
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleChange("photo", file);
                                        }}
                                    />
                                </label>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-3 text-center px-4">
                            {readOnly ? "Employee Photo" : "Allowed *.jpeg, *.jpg, *.png, *.gif (Max 2MB)"}
                        </p>
                    </div>

                    {/* Right Column: Fields */}
                    <div className="col-span-12 md:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-5 content-start">
                        <div className="space-y-2">
                            <Label>Employee ID <span className="text-red-500">*</span></Label>
                            <Input value={data.employeeId} readOnly className="bg-muted cursor-text" />
                        </div>
                        {data.id && (
                            <div className="space-y-2">
                                <Label>Employee Code <span className="text-red-500">*</span></Label>
                                <Input value={data.employeeCode} readOnly className="bg-muted cursor-text" />
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
                            <Input value={data.firstName} onChange={(e) => handleChange("firstName", e.target.value)} readOnly={readOnly} className="cursor-text" />
                        </div>
                        <div className="space-y-2">
                            <Label>Last Name <span className="text-red-500">*</span></Label>
                            <Input value={data.lastName} onChange={(e) => handleChange("lastName", e.target.value)} readOnly={readOnly} className="cursor-text" />
                        </div>
                        <div className="space-y-2">
                            <Label>Gender <span className="text-red-500">*</span></Label>
                            <Select value={data.gender || undefined} onValueChange={(v) => handleChange("gender", v)} disabled={readOnly}>
                                <SelectTrigger><SelectValue placeholder="Select Gender" /></SelectTrigger>
                                <SelectContent>
                                    {genderOptions.map(gender => (
                                        <SelectItem key={gender} value={gender}>{gender}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Date of Birth <span className="text-red-500">*</span></Label>
                            {/* DatePicker likely needs disabled prop too, wrapping in div for pointer events if not supported */}
                            <div className={readOnly ? "pointer-events-none opacity-80" : ""}>
                                <DatePicker date={data.dateOfBirth} setDate={(d) => handleChange("dateOfBirth", d)} />
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
                            <Label>Nationality</Label>
                            <Select value={data.nationality || undefined} onValueChange={(v) => handleChange("nationality", v)} disabled={readOnly}>
                                <SelectTrigger><SelectValue placeholder="Select Nationality" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="American">American</SelectItem>
                                    <SelectItem value="Indian">Indian</SelectItem>
                                    <SelectItem value="Canadian">Canadian</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Blood Group</Label>
                            <Select value={data.bloodGroup || undefined} onValueChange={(v) => handleChange("bloodGroup", v)} disabled={readOnly}>
                                <SelectTrigger><SelectValue placeholder="Select Blood Group" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="A+">A+</SelectItem>
                                    <SelectItem value="A-">A-</SelectItem>
                                    <SelectItem value="B+">B+</SelectItem>
                                    <SelectItem value="B-">B-</SelectItem>
                                    <SelectItem value="O+">O+</SelectItem>
                                    <SelectItem value="O-">O-</SelectItem>
                                    <SelectItem value="AB+">AB+</SelectItem>
                                    <SelectItem value="AB-">AB-</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Marital Status</Label>
                            <Select value={data.maritalStatus || undefined} onValueChange={(v) => handleChange("maritalStatus", v)} disabled={readOnly}>
                                <SelectTrigger><SelectValue placeholder="Select Marital Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Single">Single</SelectItem>
                                    <SelectItem value="Married">Married</SelectItem>
                                    <SelectItem value="Divorced">Divorced</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {data.maritalStatus === "Married" && (
                            <div className="space-y-2">
                                <Label>Anniversary Date</Label>
                                <div className={readOnly ? "pointer-events-none opacity-80" : ""}>
                                    <DatePicker date={data.anniversaryDate} setDate={(d) => handleChange("anniversaryDate", d)} />
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
                        <Input type="tel" value={data.mobileNumber} onChange={(e) => handleChange("mobileNumber", e.target.value)} readOnly={readOnly} className="cursor-text" />
                    </div>
                    <div className="space-y-2">
                        <Label>Alternate Mobile</Label>
                        <Input type="tel" value={data.alternateMobile} onChange={(e) => handleChange("alternateMobile", e.target.value)} readOnly={readOnly} className="cursor-text" />
                    </div>
                    <div className="space-y-2">
                        <Label>Personal Email</Label>
                        <Input type="email" value={data.personalEmail} onChange={(e) => handleChange("personalEmail", e.target.value)} readOnly={readOnly} className="cursor-text" />
                    </div>
                    <div className="space-y-2">
                        <Label>Official Email</Label>
                        <Input type="email" value={data.officialEmail} onChange={(e) => handleChange("officialEmail", e.target.value)} readOnly={readOnly} className="cursor-text" />
                    </div>
                </div>
            </div>

            {/* Address Info */}
            <div className="bg-card border rounded-lg p-6">
                <h4 className="font-semibold mb-6 text-primary border-b pb-2">Address Information</h4>
                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                        <Label>Current Address <span className="text-red-500">*</span></Label>
                        <Textarea value={data.currentAddress} onChange={(e) => handleChange("currentAddress", e.target.value)} readOnly={readOnly} className="cursor-text" />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mt-6">
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
                            value={data.sameAsCurrentAddress ? data.currentAddress : data.permanentAddress}
                            onChange={(e) => !data.sameAsCurrentAddress && handleChange("permanentAddress", e.target.value)}
                            readOnly={readOnly || data.sameAsCurrentAddress}
                            className={cn("cursor-text", data.sameAsCurrentAddress && "bg-muted")}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <SearchableSelect
                        label="Country"
                        value={data.country}
                        options={countryOptions}
                        onChange={(val) => handleChange("country", val)}
                        disabled={readOnly}
                    />
                    <SearchableSelect
                        label="State"
                        value={data.state}
                        options={stateOptions}
                        onChange={(val) => handleChange("state", val)}
                        disabled={readOnly}
                    />
                    <SearchableSelect
                        label="City"
                        value={data.city}
                        options={cityOptions}
                        onChange={(val) => handleChange("city", val)}
                        disabled={readOnly}
                    />
                    <div className="space-y-2">
                        <Label>Pincode</Label>
                        <Input value={data.pincode} onChange={(e) => handleChange("pincode", e.target.value)} readOnly={readOnly} className="cursor-text" />
                    </div>
                </div>
            </div>
        </div >
    );
}

function EmploymentDetailsForm({ data, updateData, departments, employees, readOnly }: any) {
    const { toast } = useToast();
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

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



    const validateExitDate = (exitDate: Date | undefined, doj: Date | undefined, employmentStatus: string): string => {
        // Exit Date not required for Active employees or when status is empty
        if (!employmentStatus || employmentStatus === "Active") {
            return "";
        }

        // Exit Date required for Inactive/Terminated status
        if (!exitDate && (employmentStatus === "Inactive" || employmentStatus === "Terminated")) {
            return "Exit Date is required for Inactive/Terminated status";
        }

        if (exitDate) {
            // Exit Date cannot be before DOJ
            if (doj) {
                const exitDateOnly = new Date(exitDate.getFullYear(), exitDate.getMonth(), exitDate.getDate());
                const dojDateOnly = new Date(doj.getFullYear(), doj.getMonth(), doj.getDate());

                if (exitDateOnly <= dojDateOnly) {
                    return "Exit Date cannot be earlier than Date of Joining";
                }
            }
        }

        return "";
    };

    const validateEmploymentStatus = (exitDate: Date | undefined, employmentStatus: string): string => {
        // If Exit Date is filled, status must not be Active
        if (exitDate && employmentStatus === "Active") {
            return "Please set Employment Status to Inactive/Terminated when Exit Date is entered";
        }
        return "";
    };



    // Enhanced handleChange with validation and auto-clear
    const handleChange = (field: string, value: any) => {
        if (readOnly) return;

        updateData((prev: any) => {
            const newData = { ...prev, [field]: value };

            // Clear/Auto-fix behavior when DOJ changes
            if (field === "dateOfJoining" && value) {
                const dojDate = new Date(value.getFullYear(), value.getMonth(), value.getDate());

                // Clear Exit Date if it becomes invalid
                if (newData.exitDate) {
                    const exitDate = new Date(newData.exitDate.getFullYear(), newData.exitDate.getMonth(), newData.exitDate.getDate());
                    if (exitDate <= dojDate) {
                        newData.exitDate = undefined;
                        toast({
                            title: "Exit Date Cleared",
                            description: "Exit Date cleared because it is before Date of Joining",
                            variant: "default"
                        });
                    }
                }
            }

            // Clear exit date when employment status becomes Active
            if (field === "employmentStatus" && value === "Active") {
                newData.exitDate = undefined;
            }

            return newData;
        });

        // Validate after state update
        setTimeout(() => validateAllFields(), 100);
    };

    // Validate all employment fields
    const validateAllFields = () => {
        const errors: { [key: string]: string } = {};

        // Validate DOJ
        const dojError = validateDateOfJoining(data.dateOfJoining);
        if (dojError) errors.dateOfJoining = dojError;

        // Validate Exit Date
        const exitError = validateExitDate(data.exitDate, data.dateOfJoining, data.employmentStatus);
        if (exitError) errors.exitDate = exitError;

        // Validate Employment Status (when Exit Date is filled)
        const statusError = validateEmploymentStatus(data.exitDate, data.employmentStatus);
        if (statusError) errors.employmentStatus = statusError;

        setValidationErrors(errors);

        // Update parent component with validation state
        updateData((prev: any) => ({
            ...prev,
            employmentValidationErrors: errors,
            hasEmploymentValidationErrors: Object.keys(errors).length > 0
        }));
    };

    // Validate on component mount and data changes
    React.useEffect(() => {
        // Only validate if we have employment status selected
        if (data.employmentStatus && data.employmentStatus !== '') {
            validateAllFields();
        }
    }, [data.dateOfJoining, data.exitDate, data.employmentStatus]);

    return (
        <div className="space-y-6">
            {/* Employment Info */}
            <div className="bg-card border rounded-lg p-4">
                <h4 className="font-semibold mb-4 text-primary">Employment Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Employment Status <span className="text-red-500">*</span></Label>
                        <Select value={data.employmentStatus || undefined} onValueChange={(v) => handleChange("employmentStatus", v)} disabled={readOnly}>
                            <SelectTrigger><SelectValue placeholder="Select Employment Status" /></SelectTrigger>
                            <SelectContent>
                                {employmentStatusOptions.map(status => (
                                    <SelectItem key={status} value={status}>{status}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {validationErrors.employmentStatus && (
                            <p className="text-sm text-red-500 mt-1">{validationErrors.employmentStatus}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Employment Type <span className="text-red-500">*</span></Label>
                        <Select value={data.employmentType || undefined} onValueChange={(v) => handleChange("employmentType", v)} disabled={readOnly}>
                            <SelectTrigger><SelectValue placeholder="Select Employment Type" /></SelectTrigger>
                            <SelectContent>
                                {employmentTypeOptions.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>
                            {data.employmentType === "Contractual" ? "Start from" : "Joining date"} <span className="text-red-500">*</span>
                        </Label>
                        <DatePicker date={data.dateOfJoining} setDate={(d) => handleChange("dateOfJoining", d)} disabled={readOnly} />
                        {validationErrors.dateOfJoining && (
                            <p className="text-sm text-red-500 mt-1">{validationErrors.dateOfJoining}</p>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2">
                        <Label>
                            {data.employmentType === "Contractual" ? "Up to" : "Exit Date"}
                            {(data.employmentStatus !== 'Active' && data.employmentStatus !== '' && data.employmentType !== "Contractual") && <span className="text-red-500">*</span>}
                        </Label>
                        <div className={cn(
                            (readOnly || (data.employmentType !== "Contractual" && (!data.employmentStatus || data.employmentStatus === 'Active'))) && "bg-muted rounded-md"
                        )}>
                            <DatePicker
                                date={data.exitDate}
                                setDate={(d) => handleChange("exitDate", d)}
                                disabled={readOnly || (data.employmentType !== "Contractual" && (!data.employmentStatus || data.employmentStatus === 'Active'))}
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
                    <SearchableSelect
                        label="Department"
                        required
                        value={departments?.find((d: any) => d.id === data.departmentId)?.name || ""}
                        options={departments?.map((d: any) => d.name) || []}
                        onChange={(val) => {
                            const dept = departments?.find((d: any) => d.name === val);
                            if (dept) handleChange("departmentId", dept.id);
                        }}
                        disabled={readOnly}
                    />
                    <SearchableSelect
                        label="Designation"
                        required
                        value={data.designation}
                        options={designationOptions}
                        onChange={(val) => handleChange("designation", val)}
                        disabled={readOnly}
                    />
                    <SearchableSelect
                        label="Grade / Level"
                        value={data.grade}
                        options={gradeOptions}
                        onChange={(val) => handleChange("grade", val)}
                        disabled={readOnly}
                    />
                    <SearchableSelect
                        label="Reporting Manager"
                        required
                        value={data.reportingManager ?
                            employees?.find((e: any) => e.id === data.reportingManager) ?
                                `${employees.find((e: any) => e.id === data.reportingManager).firstName} ${employees.find((e: any) => e.id === data.reportingManager).lastName}`
                                : data.reportingManager
                            : ""}
                        options={employees?.map((e: any) => `${e.firstName} ${e.lastName}`) || []}
                        onChange={(val) => {
                            const manager = employees?.find((e: any) => `${e.firstName} ${e.lastName}` === val);
                            if (manager) handleChange("reportingManager", manager.id);
                        }}
                        disabled={readOnly}
                    />
                    <SearchableSelect
                        label="Location"
                        required
                        value={data.workLocation}
                        options={workLocationOptions}
                        onChange={(val) => handleChange("workLocation", val)}
                        disabled={readOnly}
                    />
                    <SearchableSelect
                        label="Shift"
                        value={data.shift}
                        options={shiftOptions}
                        onChange={(val) => handleChange("shift", val)}
                        disabled={readOnly}
                    />
                </div>
            </div>
        </div>
    )
}

function DocumentsForm({ data, updateData, readOnly }: any) {
    const { toast } = useToast();
    const [docs, setDocs] = useState<any[]>(data.documents || []);
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
    const [showAddForm, setShowAddForm] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<any>(null);
    const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
    const [newDoc, setNewDoc] = useState<{
        type: string;
        name: string;
        file: File | null;
        fileName: string;
        fileUrl: string;
    }>({ type: "", name: "", file: null, fileName: "", fileUrl: "" });

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

    // File validation function - STRICT validation for Employee Documents only
    const validateFile = (file: File): string | null => {
        // Check file type - STRICT validation
        const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

        if (!allowedExtensions.includes(fileExtension)) {
            return 'Invalid file format. Only PDF, JPG, JPEG, PNG, DOC, and DOCX files are allowed.';
        }

        // Check file size (5MB = 5 * 1024 * 1024 bytes)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return 'File size exceeds 5MB limit. Please choose a smaller file.';
        }

        return null;
    };

    const handleFileChange = (file: File | null) => {
        if (!file || readOnly) return;

        const validationError = validateFile(file);

        if (validationError) {
            setValidationErrors(prev => ({ ...prev, newDoc: validationError }));
            toast({
                title: "File Validation Error",
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

    const handleSaveDocument = () => {
        if (!newDoc.type || !newDoc.name || !newDoc.file) {
            toast({
                title: "Validation Error",
                description: "Please fill all required fields and select a file.",
                variant: "destructive"
            });
            return;
        }

        // Add document to list
        const docToAdd = {
            id: Date.now(),
            type: newDoc.type,
            name: newDoc.name,
            file: newDoc.file,
            fileName: newDoc.fileName,
            fileUrl: newDoc.fileUrl
        };

        setDocs(prev => [...prev, docToAdd]);

        // Reset form
        setNewDoc({ type: "", name: "", file: null, fileName: "", fileUrl: "" });
        setShowAddForm(false);
    };

    const handleAddDocument = () => {
        if (readOnly) return;
        setShowAddForm(true);
    };

    const handleCancelAdd = () => {
        setNewDoc({ type: "", name: "", file: null, fileName: "", fileUrl: "" });
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

    const handleConfirmDelete = () => {
        if (docToDelete) {
            setDocs(docs.filter(d => d.id !== docToDelete.id));
            // Clear selection if deleted document was selected
            setSelectedDocumentIds(prev => prev.filter(id => id !== docToDelete.id));
            toast({
                title: "Document Deleted",
                description: `${docToDelete.fileName || 'Document'} has been removed successfully.`,
                variant: "destructive" // Red color for delete
            });
        }
        setIsDeleteOpen(false);
        setDocToDelete(null);
    };

    // Document selection handlers
    const handleSelectDocument = (documentId: number, checked: boolean) => {
        if (checked) {
            setSelectedDocumentIds(prev => [...prev, documentId]);
        } else {
            setSelectedDocumentIds(prev => prev.filter(id => id !== documentId));
        }
    };

    const handleSelectAllDocuments = (checked: boolean) => {
        if (checked) {
            const uploadedDocIds = docs.filter(doc => doc.fileName && doc.fileUrl).map(doc => doc.id);
            setSelectedDocumentIds(uploadedDocIds);
        } else {
            setSelectedDocumentIds([]);
        }
    };

    // Calculate selection state for header checkbox
    const uploadedDocs = docs.filter(doc => doc.fileName && doc.fileUrl);
    const isAllDocumentsSelected = uploadedDocs.length > 0 && selectedDocumentIds.length === uploadedDocs.length;
    const isIndeterminateDocuments = selectedDocumentIds.length > 0 && selectedDocumentIds.length < uploadedDocs.length;

    // Clear selection when documents change or component unmounts
    useEffect(() => {
        // Clear selection when switching states or when docs change
        setSelectedDocumentIds([]);
    }, [currentUIState]);

    // Clear selection when a document is added
    useEffect(() => {
        if (!showAddForm && docs.length > 0) {
            // Keep existing selections, just filter out any invalid IDs
            setSelectedDocumentIds(prev => prev.filter(id => docs.some(doc => doc.id === id)));
        }
    }, [docs.length, showAddForm]);

    // Auto download function - ONLY way to download
    const handleFileDownload = (doc: any) => {
        if (!doc.fileUrl || !doc.fileName) return;

        const link = document.createElement('a');
        link.href = doc.fileUrl;
        link.download = doc.fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Export all documents individually with better download handling
    const handleExportDocuments = async () => {
        const uploadedDocs = docs.filter(doc => doc.fileName && doc.fileUrl);

        if (uploadedDocs.length === 0) {
            toast({
                title: "No Documents",
                description: "No documents available to export.",
                variant: "destructive"
            });
            return;
        }

        try {
            toast({
                title: "Download Started",
                description: `Starting download of ${uploadedDocs.length} document(s). Check your Downloads folder.`,
                duration: 5000,
                className: "bg-blue-50 border-blue-200 text-blue-900" // Blue for info
            });

            // Download files using direct method with user gesture
            let downloadCount = 0;

            for (let i = 0; i < uploadedDocs.length; i++) {
                const doc = uploadedDocs[i];

                try {
                    // Create download link
                    const link = document.createElement('a');
                    link.href = doc.fileUrl;
                    link.download = doc.fileName;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';

                    // Style the link to be invisible
                    link.style.display = 'none';
                    link.style.visibility = 'hidden';
                    link.style.position = 'absolute';
                    link.style.left = '-9999px';

                    // Add to document
                    document.body.appendChild(link);

                    // Trigger download
                    link.click();

                    // Clean up
                    setTimeout(() => {
                        if (link.parentNode) {
                            link.parentNode.removeChild(link);
                        }
                    }, 1000);

                    downloadCount++;

                    // Show progress for each file
                    toast({
                        title: `Downloading ${i + 1}/${uploadedDocs.length}`,
                        description: `${doc.fileName}`,
                        duration: 2000,
                        className: "bg-blue-50 border-blue-200 text-blue-900" // Blue for progress
                    });

                    // Small delay between downloads to prevent browser blocking
                    if (i < uploadedDocs.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                } catch (error) {
                    console.warn(`Failed to download ${doc.fileName}:`, error);
                    toast({
                        title: "Download Warning",
                        description: `Could not download ${doc.fileName}. Please try again.`,
                        variant: "destructive",
                        duration: 3000
                    });
                }
            }

            // Final completion message
            setTimeout(() => {
                toast({
                    title: "Downloads Complete",
                    description: `${downloadCount} document(s) have been downloaded to your Downloads folder.`,
                    duration: 5000,
                    className: "bg-green-50 border-green-200 text-green-900" // Green for success
                });
            }, 1500);

        } catch (error) {
            console.error('Export failed:', error);
            toast({
                title: "Download Failed",
                description: "An error occurred while downloading documents. Please try again.",
                variant: "destructive",
                duration: 5000
            });
        }
    };

    // View in new tab function
    const handleFileView = (doc: any) => {
        if (!doc.fileUrl) return;
        window.open(doc.fileUrl, '_blank');
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
                    {!readOnly && hasUploadedDocs && (
                        <Button size="sm" variant="outline" onClick={handleExportDocuments}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" /> Export
                        </Button>
                    )}
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
                                    <Label className="text-sm font-medium">Type <span className="text-red-500">*</span></Label>
                                    <Select value={newDoc.type} onValueChange={(v) => setNewDoc(prev => ({ ...prev, type: v }))}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select Document Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ID Proof">ID Proof</SelectItem>
                                            <SelectItem value="Address Proof">Address Proof</SelectItem>
                                            <SelectItem value="Education">Education</SelectItem>
                                            <SelectItem value="Experience">Experience</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
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
                                        <span className="text-sm text-foreground">{newDoc.fileName}</span>
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
                    <div className="grid grid-cols-13 gap-4 p-3 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                        <div className="col-span-1 flex items-center">
                            <Checkbox
                                checked={isIndeterminateDocuments ? "indeterminate" : isAllDocumentsSelected}
                                onCheckedChange={handleSelectAllDocuments}
                            />
                        </div>
                        <div className="col-span-3">Document Type</div>
                        <div className="col-span-3">Document Name</div>
                        <div className="col-span-4">File Name</div>
                        <div className="col-span-2">Actions</div>
                    </div>

                    {/* Document Entries */}
                    {docs.map((doc) => (
                        doc.fileName && doc.fileUrl && (
                            <div key={doc.id} className={`grid grid-cols-13 gap-4 p-3 border rounded-md bg-card hover:bg-muted/20 transition-colors ${selectedDocumentIds.includes(doc.id) ? 'bg-muted/30 border-primary/20' : ''}`}>
                                <div className="col-span-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={selectedDocumentIds.includes(doc.id)}
                                        onCheckedChange={(checked) => handleSelectDocument(doc.id, checked as boolean)}
                                    />
                                </div>
                                <div className="col-span-3 text-sm font-medium text-foreground">
                                    {doc.type}
                                </div>
                                <div className="col-span-3 text-sm text-muted-foreground">
                                    {doc.name}
                                </div>
                                <div className="col-span-4">
                                    <button
                                        className="text-sm text-primary hover:underline cursor-pointer font-medium text-left"
                                        onClick={() => handleFileDownload(doc)}
                                        title="Click to download"
                                    >
                                        {doc.fileName}
                                    </button>
                                </div>
                                <div className="col-span-2 flex gap-1">
                                    {!readOnly && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeDoc(doc.id)}
                                            title="Delete document"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
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
                                <Label className="text-sm font-medium">Type <span className="text-red-500">*</span></Label>
                                <Select value={newDoc.type} onValueChange={(v) => setNewDoc(prev => ({ ...prev, type: v }))}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ID Proof">ID Proof</SelectItem>
                                        <SelectItem value="Address Proof">Address Proof</SelectItem>
                                        <SelectItem value="Education">Education</SelectItem>
                                        <SelectItem value="Experience">Experience</SelectItem>
                                    </SelectContent>
                                </Select>
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
                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
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
                                    <span className="text-sm text-foreground">{newDoc.fileName}</span>
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
                        <div className="grid grid-cols-13 gap-4 p-3 bg-muted/40 font-medium text-sm text-muted-foreground border-b">
                            <div className="col-span-1 flex items-center">
                                <Checkbox
                                    checked={isIndeterminateDocuments ? "indeterminate" : isAllDocumentsSelected}
                                    onCheckedChange={handleSelectAllDocuments}
                                />
                            </div>
                            <div className="col-span-3">Document Type</div>
                            <div className="col-span-3">Document Name</div>
                            <div className="col-span-4">File Name</div>
                            <div className="col-span-2">Actions</div>
                        </div>

                        {/* Document Entries - History */}
                        {docs.map((doc) => (
                            doc.fileName && doc.fileUrl && (
                                <div key={doc.id} className={`grid grid-cols-13 gap-4 p-3 border rounded-md bg-card hover:bg-muted/20 transition-colors ${selectedDocumentIds.includes(doc.id) ? 'bg-muted/30 border-primary/20' : ''}`}>
                                    <div className="col-span-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            checked={selectedDocumentIds.includes(doc.id)}
                                            onCheckedChange={(checked) => handleSelectDocument(doc.id, checked as boolean)}
                                        />
                                    </div>
                                    <div className="col-span-3 text-sm font-medium text-foreground">
                                        {doc.type}
                                    </div>
                                    <div className="col-span-3 text-sm text-muted-foreground">
                                        {doc.name}
                                    </div>
                                    <div className="col-span-4">
                                        <button
                                            className="text-sm text-primary hover:underline cursor-pointer font-medium text-left"
                                            onClick={() => handleFileDownload(doc)}
                                            title="Click to download"
                                        >
                                            {doc.fileName}
                                        </button>
                                    </div>
                                    <div className="col-span-2 flex gap-1">
                                        {!readOnly && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => removeDoc(doc.id)}
                                                title="Delete document"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                </div>
            )}

            {/* Global validation message */}
            {hasValidationErrors && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-3">
                    Please fix the file validation errors above before proceeding.
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the document "{docToDelete?.fileName || 'this document'}".
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

function SystemAccessForm({ data, updateData, readOnly }: any) {
    const { toast } = useToast();
    const [enableLoginAccess, setEnableLoginAccess] = useState(data.enableLoginAccess || false);
    const [username, setUsername] = useState(data.username || "");
    const [password, setPassword] = useState(data.password || "");
    const [showPassword, setShowPassword] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState<string[]>(data.selectedRoles || []);
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
    const [userExists, setUserExists] = useState(false);

    // System Access Association State
    const [selectedWorkCenterId, setSelectedWorkCenterId] = useState("");
    const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
    const [selectedOperationId, setSelectedOperationId] = useState("");

    const [isWorkCenterOpen, setIsWorkCenterOpen] = useState(false);
    const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
    const [isOperationOpen, setIsOperationOpen] = useState(false);

    // Mock roles - in production, fetch from Users & Roles module
    const availableRoles = [
        { id: "admin", name: "Administrator" },
        { id: "manager", name: "Manager" },
        { id: "employee", name: "Employee" },
        { id: "hr", name: "HR Staff" },
        { id: "accountant", name: "Accountant" }
    ];

    // Check if user account already exists (for edit mode)
    useEffect(() => {
        if (data.id) {
            // Check if user account exists for this employee
            const savedUsers = localStorage.getItem("system_users");
            const users = savedUsers ? JSON.parse(savedUsers) : [];
            const existingUser = users.find((u: any) => u.employeeId === data.id);

            if (existingUser) {
                setUserExists(true);
                setEnableLoginAccess(true);
                setUsername(existingUser.username);
                // Load existing roles
                if (existingUser.roles && Array.isArray(existingUser.roles)) {
                    setSelectedRoles(existingUser.roles);
                }
            }
        }
    }, [data.id]);

    // Generate username from employee name
    useEffect(() => {
        if (enableLoginAccess && !userExists && data.firstName && data.lastName) {
            const generatedUsername = `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}`;
            setUsername(generatedUsername);
        }
    }, [enableLoginAccess, data.firstName, data.lastName, userExists]);

    // Update parent form data
    useEffect(() => {
        updateData((prev: any) => ({
            ...prev,
            enableLoginAccess,
            username,
            password,
            selectedRoles
        }));
    }, [enableLoginAccess, username, password, selectedRoles]);

    const handleToggleAccess = (checked: boolean) => {
        setEnableLoginAccess(checked);
        if (!checked) {
            // Clear fields when disabled
            if (!userExists) {
                setUsername("");
                setPassword("");
            }
            // Always clear roles when toggle is OFF
            setSelectedRoles([]);
        }
    };

    const handleAddRole = (roleId: string) => {
        if (!roleId) return;

        // Add role to list (duplicate check handled by UI)
        setSelectedRoles(prev => [...prev, roleId]);
    };

    const handleDeleteRole = (roleId: string) => {
        setSelectedRoles(prev => prev.filter(r => r !== roleId));
    };

    const getRoleName = (roleId: string) => {
        const role = availableRoles.find(r => r.id === roleId);
        return role ? role.name : roleId;
    };

    const handleResetPassword = () => {
        setPassword("");

        toast({
            title: "Password Reset",
            description: "Please enter a new password for this user.",
            className: "bg-blue-50 border-blue-200 text-blue-900"
        });
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-primary text-sm">System Access Configuration</h4>
            </div>

            {/* Enable Login Access Toggle */}
            <div className="flex items-center justify-between p-2.5 border rounded-md bg-muted/20">
                <div className="space-y-0">
                    <label className="text-xs font-medium">Enable Login Access</label>
                    <p className="text-[11px] text-muted-foreground">
                        Allow this employee to access the system
                    </p>
                </div>
                <Switch
                    checked={enableLoginAccess}
                    onCheckedChange={handleToggleAccess}
                    disabled={readOnly || userExists}
                />
            </div>

            {/* Show fields only when toggle is ON */}
            {enableLoginAccess && (
                <div className="space-y-2 p-2.5 border rounded-md bg-card">
                    {/* Username */}
                    <div className="space-y-0.5">
                        <Label htmlFor="username" className="text-[11px] font-medium">
                            Username {!userExists && <span className="text-destructive">*</span>}
                        </Label>
                        <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="username"
                            disabled={readOnly || userExists || !enableLoginAccess}
                            className={cn("h-8 text-xs w-40 max-w-[160px]", userExists ? "bg-muted" : "")}
                        />
                        {userExists && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 w-40 max-w-[160px]">
                                Username cannot be changed for existing users
                            </p>
                        )}
                    </div>

                    {/* Password - Manual Entry with View Toggle */}
                    <div className="space-y-0.5">
                        <Label htmlFor="password" className="text-[11px] font-medium">
                            Password <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative w-40 max-w-[160px]">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                disabled={readOnly || !enableLoginAccess}
                                className="h-8 text-xs pr-8"
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
                    </div>

                    {/* Reset Password button - only show for existing users */}
                    {userExists && !readOnly && (
                        <div className="pt-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleResetPassword}
                                className="h-7 text-xs"
                            >
                                <Key className="mr-1.5 h-3 w-3" />
                                Reset Password
                            </Button>
                        </div>
                    )}

                    {/* Role Selection Dropdown */}
                    <div className="space-y-0.5">
                        <Label className="text-[11px] font-medium block">
                            Add Role <span className="text-destructive">*</span>
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
                                                            value={role.name}
                                                            onSelect={() => {
                                                                if (!isSelected) {
                                                                    handleAddRole(role.id);
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
                                                            {role.name}
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
                                    {!enableLoginAccess || selectedRoles.length === 0 ? (
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
                                                        disabled={readOnly || !enableLoginAccess}
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
            )}

            {/* System Access Associations */}
            <Label className="text-sm font-semibold mb-4 block text-primary">Employee Allocation Details</Label>
            <div className="rounded-md border p-4 bg-muted/20 mb-8">
                {/* Location Dropdown - Synced with Employment & Job Details */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3">
                    <SearchableSelect
                        label="Location"
                        value={data.workLocation}
                        options={workLocationOptions}
                        onChange={(val) => updateData((prev: any) => ({ ...prev, workLocation: val }))}
                        disabled={readOnly}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Work Centers */}
                    <div className="space-y-3">
                        <Label>Assigned Work Centers</Label>
                        <div className="flex gap-2">
                            <Popover open={isWorkCenterOpen} onOpenChange={setIsWorkCenterOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isWorkCenterOpen}
                                        className="w-full justify-between"
                                        disabled={readOnly}
                                    >
                                        {selectedWorkCenterId
                                            ? initialWorkCenters.find((wc) => wc.id.toString() === selectedWorkCenterId)?.name
                                            : "Select Work Center..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                    <Command>
                                        <CommandInputBorderless placeholder="Search work center..." />
                                        <CommandList className="max-h-[200px] overflow-y-auto">
                                            <CommandEmpty>No work center found.</CommandEmpty>
                                            <CommandGroup>
                                                {initialWorkCenters.map((wc) => {
                                                    const isAdded = data.assignedWorkCenters?.includes(wc.id.toString());
                                                    return (
                                                        <CommandItem
                                                            key={wc.id}
                                                            value={wc.name}
                                                            onSelect={() => {
                                                                if (!isAdded) {
                                                                    setSelectedWorkCenterId(wc.id.toString());
                                                                    setIsWorkCenterOpen(false);
                                                                }
                                                            }}
                                                            disabled={isAdded}
                                                            className={isAdded ? "opacity-50 cursor-not-allowed" : ""}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedWorkCenterId === wc.id.toString() ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {wc.name}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <Button
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

                        {/* Work Centers List */}
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableBody>
                                    {(!data.assignedWorkCenters || data.assignedWorkCenters.length === 0) ? (
                                        <TableRow>
                                            <TableCell className="text-center py-3 text-xs text-muted-foreground">
                                                No work centers assigned
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data.assignedWorkCenters.map((id: string) => (
                                            <TableRow key={id}>
                                                <TableCell className="py-2 text-sm">
                                                    {initialWorkCenters.find(w => w.id.toString() === id)?.name}
                                                </TableCell>
                                                <TableCell className="py-2 w-[40px]">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-destructive"
                                                        onClick={() => {
                                                            const current = data.assignedWorkCenters || [];
                                                            updateData((prev: any) => ({ ...prev, assignedWorkCenters: current.filter((c: string) => c !== id) }));
                                                        }}
                                                        disabled={readOnly}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Warehouses */}
                    <div className="space-y-3">
                        <Label>Assigned Warehouses</Label>
                        <div className="flex gap-2">
                            <Popover open={isWarehouseOpen} onOpenChange={setIsWarehouseOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isWarehouseOpen}
                                        className="w-full justify-between"
                                        disabled={readOnly}
                                    >
                                        {selectedWarehouseId
                                            ? initialWarehouses.find((w) => w.id.toString() === selectedWarehouseId)?.name
                                            : "Select Warehouse..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                    <Command>
                                        <CommandInputBorderless placeholder="Search warehouse..." />
                                        <CommandList className="max-h-[200px] overflow-y-auto">
                                            <CommandEmpty>No warehouse found.</CommandEmpty>
                                            <CommandGroup>
                                                {initialWarehouses.map((w) => {
                                                    const isAdded = data.assignedWarehouses?.includes(w.id.toString());
                                                    return (
                                                        <CommandItem
                                                            key={w.id}
                                                            value={w.name}
                                                            onSelect={() => {
                                                                if (!isAdded) {
                                                                    setSelectedWarehouseId(w.id.toString());
                                                                    setIsWarehouseOpen(false);
                                                                }
                                                            }}
                                                            disabled={isAdded}
                                                            className={isAdded ? "opacity-50 cursor-not-allowed" : ""}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedWarehouseId === w.id.toString() ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {w.name}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <Button
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

                        {/* Warehouses List */}
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableBody>
                                    {(!data.assignedWarehouses || data.assignedWarehouses.length === 0) ? (
                                        <TableRow>
                                            <TableCell className="text-center py-3 text-xs text-muted-foreground">
                                                No warehouses assigned
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data.assignedWarehouses.map((id: string) => (
                                            <TableRow key={id}>
                                                <TableCell className="py-2 text-sm">
                                                    {initialWarehouses.find(w => w.id.toString() === id)?.name}
                                                </TableCell>
                                                <TableCell className="py-2 w-[40px]">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-destructive"
                                                        onClick={() => {
                                                            const current = data.assignedWarehouses || [];
                                                            updateData((prev: any) => ({ ...prev, assignedWarehouses: current.filter((c: string) => c !== id) }));
                                                        }}
                                                        disabled={readOnly}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Operations */}
                    <div className="space-y-3">
                        <Label>Assigned Operations</Label>
                        <div className="flex gap-2">
                            <Popover open={isOperationOpen} onOpenChange={setIsOperationOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isOperationOpen}
                                        className="w-full justify-between"
                                        disabled={readOnly}
                                    >
                                        {selectedOperationId
                                            ? initialOperations.find((op) => op.id.toString() === selectedOperationId)?.name
                                            : "Select Operation..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                    <Command>
                                        <CommandInputBorderless placeholder="Search operation..." />
                                        <CommandList className="max-h-[200px] overflow-y-auto">
                                            <CommandEmpty>No operation found.</CommandEmpty>
                                            <CommandGroup>
                                                {initialOperations.map((op) => {
                                                    const isAdded = data.assignedOperations?.includes(op.id.toString());
                                                    return (
                                                        <CommandItem
                                                            key={op.id}
                                                            value={op.name}
                                                            onSelect={() => {
                                                                if (!isAdded) {
                                                                    setSelectedOperationId(op.id.toString());
                                                                    setIsOperationOpen(false);
                                                                }
                                                            }}
                                                            disabled={isAdded}
                                                            className={isAdded ? "opacity-50 cursor-not-allowed" : ""}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedOperationId === op.id.toString() ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {op.name}
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <Button
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

                        {/* Operations List */}
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableBody>
                                    {(!data.assignedOperations || data.assignedOperations.length === 0) ? (
                                        <TableRow>
                                            <TableCell className="text-center py-3 text-xs text-muted-foreground">
                                                No operations assigned
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data.assignedOperations.map((id: string) => (
                                            <TableRow key={id}>
                                                <TableCell className="py-2 text-sm">
                                                    {initialOperations.find(op => op.id.toString() === id)?.name}
                                                </TableCell>
                                                <TableCell className="py-2 w-[40px]">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-destructive"
                                                        onClick={() => {
                                                            const current = data.assignedOperations || [];
                                                            updateData((prev: any) => ({ ...prev, assignedOperations: current.filter((c: string) => c !== id) }));
                                                        }}
                                                        disabled={readOnly}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
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

function DatePicker({ date, setDate, disabled = false }: { date?: Date, setDate: (d?: Date) => void, disabled?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
    const [visibleDate, setVisibleDate] = useState(() => date || new Date());

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
            return format(date, "dd/MM/yyyy");
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
        const prevMonth = new Date(year, month - 1, 0);
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            days.push({
                date: new Date(year, month - 1, prevMonth.getDate() - i),
                isCurrentMonth: false,
                isToday: false,
                isSelected: false
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const today = new Date();
            const isToday = currentDate.toDateString() === today.toDateString();
            const isSelected = date && currentDate.toDateString() === date.toDateString();

            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday,
                isSelected
            });
        }

        // Next month's leading days
        const remainingDays = 42 - days.length; // 6 rows × 7 days
        for (let day = 1; day <= remainingDays; day++) {
            days.push({
                date: new Date(year, month + 1, day),
                isCurrentMonth: false,
                isToday: false,
                isSelected: false
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
                            className={cn(
                                "h-8 w-8 text-sm font-normal",
                                !day.isCurrentMonth && "text-muted-foreground opacity-50",
                                day.isToday && "bg-accent text-accent-foreground font-semibold",
                                day.isSelected && "bg-primary text-primary-foreground font-semibold",
                                day.isCurrentMonth && "hover:bg-accent hover:text-accent-foreground"
                            )}
                            onClick={() => handleDateSelect(day.date)}
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
            <PopoverContent className="w-auto p-4 shadow-lg border rounded-lg z-[9999]" align="start" side="bottom" sideOffset={4}>
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
