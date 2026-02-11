import React, { useState, useEffect, useMemo } from "react";
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
import { Search, Plus, Edit, ArrowLeft, Trash2, Check, ChevronsUpDown, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// --- Types ---

type CalcMode = "FLAT" | "PCT_CTC" | "PCT_BASIC" | "REMAINING";
type Category = "earning" | "deduction";
type StructureMode = "structure" | "custom";

interface SalaryComponent {
    code: string;
    name: string;
    category: Category;
}

interface SalaryRule {
    componentCode: string;
    name: string;
    category: Category;
    calcMode: CalcMode;
    value: number; // Amount for FLAT, Percentage for PCT
    isBase: boolean; // True if part of the base structure (read-only in structure mode)
}

interface ComputedRow extends SalaryRule {
    monthlyAmount: number;
    annualAmount: number;
}

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

interface Assignment {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    department: string;
    designation: string;

    structureMode: StructureMode;
    structureId?: string; // If mode is structure

    annualCTC: number;
    monthlyCTC: number;
    effectiveFrom: string;
    status: "active" | "inactive";

    earnings: ComputedRow[];
    deductions: ComputedRow[];
}

// --- Mock Data ---

// ⚠️ SAFE GUARD: Added ONE mock record to each array to prevent runtime crashes
// This ensures salary details page never crashes when empty
// ============================================================================
const mockEmployees: Employee[] = [
  { id: "emp-001", code: "EMP001", name: "John Doe", department: "Engineering", designation: "Software Engineer", joiningDate: "2025-01-15" }
];
const mockDepartments = ["All Departments", "Engineering", "HR", "Finance"];
const mockDesignations = ["Software Engineer", "Manager", "Team Lead", "HR Manager"];

const mockComponents: { earnings: SalaryComponent[], deductions: SalaryComponent[] } = {
    earnings: [
      { code: "BASIC", name: "Basic Salary", category: "earning" },
      { code: "HRA", name: "House Rent Allowance", category: "earning" }
    ],
    deductions: [
      { code: "PF", name: "Provident Fund", category: "deduction" },
      { code: "TAX", name: "Income Tax", category: "deduction" }
    ]
};

const mockStructures: SalaryStructure[] = [
  {
    id: "struct-001",
    name: "Standard Structure",
    rules: []
  }
];

// Initial Assignments Data
const initialAssignments: Assignment[] = [];

export default function EmployeeSalaryDetails() {
    // --- Main State ---

    // Using initial mock data (no persistence)
    const [availableStructures, setAvailableStructures] = useState<SalaryStructure[]>(mockStructures);
    const [availableComponents, setAvailableComponents] = useState(mockComponents);

    const [viewMode, setViewMode] = useState<"list" | "form">("list");
    const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
    const { toast } = useToast();

    // --- Routing Hooks ---
    const [, setLocation] = useLocation();
    const [matchNew] = useRoute("/hr-setup/employee-salary/new");
    const [matchEdit, params] = useRoute("/hr-setup/employee-salary/:id");
    const searchString = useSearch();



    // --- List View State ---
    const [searchTerm, setSearchTerm] = useState("");
    const [deptFilter, setDeptFilter] = useState("All Departments");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // --- Form View State ---
    const [formState, setFormState] = useState<Partial<Assignment>>({});
    const [isEditMode, setIsEditMode] = useState(false); // Are we editing an existing assignment?
    const [earningsRows, setEarningsRows] = useState<ComputedRow[]>([]);
    const [deductionsRows, setDeductionsRows] = useState<ComputedRow[]>([]);

    // Dropdown States
    const [openEmpCombo, setOpenEmpCombo] = useState(false);
    const [openDeptCombo, setOpenDeptCombo] = useState(false);
    const [openDesigCombo, setOpenDesigCombo] = useState(false);
    const [openStructureDropdown, setOpenStructureDropdown] = useState(false);
    const [openDeptFilterDropdown, setOpenDeptFilterDropdown] = useState(false);
    const [openAddEarning, setOpenAddEarning] = useState(false);
    const [openAddDeduction, setOpenAddDeduction] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

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
                    const emp = mockEmployees.find(e => e.id === prefillEmpId);
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
                    structureMode: "structure",
                    status: "active",
                    effectiveFrom: format(new Date(), "yyyy-MM-dd"),
                    annualCTC: 0,
                    monthlyCTC: 0,
                    ...prefillData
                });
                setEarningsRows([]);
                setDeductionsRows([]);
                setIsEditMode(false);
                setViewMode("form");
            }
        } else if (matchEdit && routeId) {
            // Edit Assignment Mode
            if (viewMode !== "form" || formState.id !== routeId) {
                const assignment = assignments.find(a => a.id === routeId);
                if (assignment) {
                    setFormState({ ...assignment });
                    setEarningsRows([...assignment.earnings]);
                    setDeductionsRows([...assignment.deductions]);
                    setIsEditMode(true);
                    setViewMode("form");
                }
            }
        } else {
            // List Mode
            if (viewMode !== "list") {
                setViewMode("list");
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchNew, matchEdit, params?.id, assignments, viewMode, isEditMode, formState.id]);

    // --- Actions: List View ---

    // --- Actions: List View ---

    // Merge mockEmployees with assignments for the main list
    // This allows us to show ALL employees, even those without assignments.
    const allEmployeeAssignments = React.useMemo(() => {
        return mockEmployees.map(emp => {
            const assignment = assignments.find(a => a.employeeId === emp.id);
            if (assignment) return assignment;

            // Return dummy assignment for inactive rows
            return {
                id: "new", // Dummy ID logic handled by UI
                employeeId: emp.id,
                employeeName: emp.name,
                employeeCode: emp.code,
                department: emp.department,
                designation: emp.designation,
                structureMode: "structure", // Default
                annualCTC: 0,
                monthlyCTC: 0,
                effectiveFrom: "-",
                status: "inactive",
                earnings: [],
                deductions: []
            } as Assignment;
        });
    }, [mockEmployees, assignments]);

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

    const paginatedAssignments = filteredAssignments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredAssignments.length / itemsPerPage);

    const handleCreateNew = (employeeId?: string) => {
        if (employeeId) {
            setLocation(`/hr-setup/employee-salary/new?empId=${employeeId}`);
        } else {
            setLocation("/hr-setup/employee-salary/new");
        }
    };

    const handleEdit = (assignment: Assignment) => {
        setLocation(`/hr-setup/employee-salary/${assignment.id}`);
    };

    const handleBackToList = () => {
        setLocation("/hr-setup/employee-salary");
    };

    // --- Derived State & Logic ---

    // Filter employees based on selections
    const filteredEmployees = useMemo(() => {
        return mockEmployees.filter(emp => {
            const matchDept = deptFilter === "All Departments" || emp.department === deptFilter; // For list view filter
            return matchDept;
        });
    }, [deptFilter]);

    // Filter employees for the FORM dropdown based on selected Dept/Designation in the form
    const formFilteredEmployees = useMemo(() => {
        return mockEmployees.filter(emp => {
            const matchDept = !formState.department || emp.department === formState.department;
            const matchDesig = !formState.designation || emp.designation === formState.designation;

            // Filter out employees who already have an active assignment (unless we are editing that specific assignment)
            const isAlreadyAssigned = assignments.some(a => a.employeeId === emp.id && a.id !== formState.id);

            return matchDept && matchDesig && !isAlreadyAssigned;
        });
    }, [formState.department, formState.designation, assignments, formState.id]);


    // Validation for Dates
    const isEffectiveDateValid = useMemo(() => {
        if (!formState.effectiveFrom || !formState.employeeId) return true; // Can't validate yet

        const emp = mockEmployees.find(e => e.id === formState.employeeId);
        if (!emp || !emp.joiningDate) return true; // Should have joining date

        return new Date(formState.effectiveFrom) >= new Date(emp.joiningDate);
    }, [formState.effectiveFrom, formState.employeeId]);


    // --- Calculation Engine ---

    const calculateSalary = (ctc: number, currentEarnings: ComputedRow[]) => {
        const monthlyCTC = Math.round(ctc / 12);

        // 1. Calculate Basis (Basic) first as others depend on it
        let calculated = currentEarnings.map(row => ({ ...row }));

        // Find Basic
        const basicRow = calculated.find(r => r.componentCode === "BASIC");
        let basicAmount = 0;

        if (basicRow) {
            if (basicRow.calcMode === "PCT_CTC") {
                basicAmount = (ctc * basicRow.value) / 100 / 12;
            } else if (basicRow.calcMode === "FLAT") {
                basicAmount = basicRow.monthlyAmount; // User entered or flat value
            }
            // Update Basic Row
            if (basicRow.calcMode !== "FLAT") {
                basicRow.monthlyAmount = basicAmount;
            } else {
                basicAmount = basicRow.monthlyAmount;
            }
        }

        // 2. Calculate others
        calculated = calculated.map(row => {
            if (row.componentCode === "BASIC") return row; // Alrady handled
            if (row.calcMode === "REMAINING") return row; // Handle last

            let amount = 0;
            if (row.calcMode === "FLAT") {
                amount = row.monthlyAmount; // Keep manual input
            } else if (row.calcMode === "PCT_CTC") {
                amount = (ctc * row.value) / 100 / 12;
            } else if (row.calcMode === "PCT_BASIC") {
                amount = (basicAmount * row.value) / 100;
            }

            return { ...row, monthlyAmount: amount };
        });

        // 3. Resolve REMAINING (Special Allowance)
        const remainingRowIndex = calculated.findIndex(r => r.calcMode === "REMAINING");
        if (remainingRowIndex !== -1) {
            const sumOthers = calculated.reduce((sum, r, idx) => {
                return idx === remainingRowIndex ? sum : sum + r.monthlyAmount;
            }, 0);

            // Allow negative for validation display, ensure it's calculated
            const remaining = monthlyCTC - sumOthers;
            calculated[remainingRowIndex].monthlyAmount = remaining;
        }

        // 4. Update Annual Amounts for all
        return calculated.map(row => ({
            ...row,
            annualAmount: row.monthlyAmount * 12
        }));
    };

    // Recalculate when CTC changes
    useEffect(() => {
        if (formState.annualCTC) {
            const monthly = Math.round(formState.annualCTC / 12);
            setFormState(prev => ({ ...prev, monthlyCTC: monthly }));

            const updated = calculateSalary(formState.annualCTC, earningsRows);
            // Only update if numbers changed to avoid loops (deep compare simplified)
            if (JSON.stringify(updated) !== JSON.stringify(earningsRows)) {
                setEarningsRows(updated);
            }
        }
    }, [formState.annualCTC, formState.structureMode]); // Dependency on structureMode to trigger initial calc if needed


    /**
     * Handles switching Structure selection.
     * Loads structure rules into earnings rows.
     */
    const handleStructureChange = (structureId: string) => {
        if (structureId === "custom") {
            setFormState(prev => ({ ...prev, structureMode: "custom", structureId: undefined }));
            // Custom mode starts with Basic and Special Allowance (Remaining)
            setEarningsRows([
                { componentCode: "BASIC", name: "Basic", category: "earning", calcMode: "FLAT", value: 0, isBase: false, monthlyAmount: 0, annualAmount: 0 },
                { componentCode: "FIXED", name: "Special Allowance", category: "earning", calcMode: "REMAINING", value: 0, isBase: false, monthlyAmount: 0, annualAmount: 0 }
            ]);
            return;
        }

        const structure = availableStructures.find(s => s.id === structureId);
        if (structure) {
            setFormState(prev => ({ ...prev, structureMode: "structure", structureId: structure.id }));

            // Map structure rules to computed rows
            const newRows: ComputedRow[] = structure.rules.map(rule => ({
                ...rule,
                monthlyAmount: 0,
                annualAmount: 0
            }));

            // Recalculate immediately if we have CTC
            if (formState.annualCTC) {
                setEarningsRows(calculateSalary(formState.annualCTC, newRows));
            } else {
                setEarningsRows(newRows);
            }
        }
    };

    /**
     * Handle Manual Row Edits (Custom Mode or Extra Rows)
     */
    const updateEarningRow = (index: number, field: keyof ComputedRow, val: any) => {
        const newRows = [...earningsRows];
        const row = { ...newRows[index], [field]: val };
        newRows[index] = row;

        // Trigger recalc cycle
        // If we changed value (pct/flat amount) or calc mode, we need full recalc
        if (formState.annualCTC) {
            setEarningsRows(calculateSalary(formState.annualCTC, newRows));
        } else {
            setEarningsRows(newRows);
        }
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
        setDeductionsRows([...deductionsRows, newRow]);
        setOpenAddDeduction(false);
    };

    const removeRow = (index: number, type: 'earning' | 'deduction') => {
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

    // Mismatch check (tolerance of 5 rupees due to rounding)
    // If no remaining row, check total earnings vs CTC.
    const totalEarnings = earningsRows.reduce((sum, r) => sum + r.monthlyAmount, 0);
    const ctcMismatch = !remainingRow && Math.abs(totalEarnings - monthlyCTC) > 5;

    const isValid = useMemo(() => {
        if (!formState.employeeId || !formState.annualCTC || !formState.effectiveFrom) return false;
        if (formState.structureMode === 'structure' && !formState.structureId) return false;

        if (hasNegativeRemaining) return false;
        if (ctcMismatch) return false;
        if (!isEffectiveDateValid) return false;
        if (netPayMonthly < 0) return false;

        return true;
    }, [formState, ctcMismatch, hasNegativeRemaining, isEffectiveDateValid, netPayMonthly]);

    const handleSave = () => {
        if (!isValid) return;
        // Check for remaining calculation before save to ensure it's correct format

        const assignment: Assignment = {
            id: formState.id || `ASG-${Date.now()}`,
            employeeId: formState.employeeId!,
            employeeName: formState.employeeName!,
            employeeCode: formState.employeeCode!,
            department: formState.department!,
            designation: formState.designation!,
            structureMode: formState.structureMode || "structure",
            structureId: formState.structureId,
            annualCTC: formState.annualCTC!,
            monthlyCTC: monthlyCTC,
            effectiveFrom: formState.effectiveFrom!,
            status: formState.status || "active",
            earnings: earningsRows,
            deductions: deductionsRows
        };

        if (isEditMode) {
            setAssignments(prev => prev.map(a => a.id === assignment.id ? assignment : a));
            toast({ title: "Success", description: "Assignment updated successfully" });
        } else {
            setAssignments(prev => [...prev, assignment]);
            toast({ title: "Success", description: "Assignment created successfully" });
        }
        setLocation("/hr-setup/employee-salary");
    };

    const handleDelete = () => {
        if (!formState.id) return;
        setAssignments(prev => prev.filter(a => a.id !== formState.id));
        toast({ title: "Success", description: "Assignment deleted successfully" });
        setOpenDeleteDialog(false);
        setLocation("/hr-setup/employee-salary");
    };

    // --- Main Render ---

    if (viewMode === "list") {
        return (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Employee Salary Assignments</h1>
                        <p className="text-muted-foreground">Manage salary structures and CTC assignments</p>
                    </div>

                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search employees..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 border-zinc-400"
                            />
                        </div>
                        <Popover open={openDeptFilterDropdown} onOpenChange={setOpenDeptFilterDropdown}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openDeptFilterDropdown}
                                    className="w-[200px] justify-between h-10 font-normal border-input"
                                >
                                    <span className={cn(deptFilter === "All Departments" && "text-muted-foreground")}>
                                        {deptFilter}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0" align="start">
                                <Command>
                                    <CommandInputBorderless placeholder="Search department..." className="h-9" />
                                    <CommandList className="max-h-[250px] overflow-y-auto">
                                        <CommandEmpty>No department found.</CommandEmpty>
                                        <CommandGroup>
                                            {mockDepartments.map((dept) => (
                                                <CommandItem
                                                    key={dept}
                                                    value={dept}
                                                    onSelect={(currentValue) => {
                                                        setDeptFilter(currentValue);
                                                        setOpenDeptFilterDropdown(false);
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            deptFilter === dept ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {dept}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <Button onClick={() => handleCreateNew()}>
                        <Plus className="mr-2 h-4 w-4" /> Assign Salary
                    </Button>
                </div>

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[180px]">Employee</TableHead>
                                    <TableHead className="w-[120px]">Department</TableHead>
                                    <TableHead className="w-[150px]">Structure</TableHead>
                                    <TableHead className="text-right w-[120px]">Monthly Gross</TableHead>
                                    <TableHead className="text-right w-[120px]">Annual CTC</TableHead>
                                    <TableHead className="w-[120px]">Effective From</TableHead>
                                    <TableHead className="w-[100px]">Status</TableHead>
                                    <TableHead className="w-[80px] text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedAssignments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">No assignments found.</TableCell>
                                    </TableRow>
                                ) : paginatedAssignments.map(a => (
                                    <TableRow key={a.id}>
                                        <TableCell className="w-[180px]">
                                            <div className="font-medium">{a.employeeName}</div>
                                            <div className="text-xs text-muted-foreground">{a.employeeCode}</div>
                                        </TableCell>
                                        <TableCell className="w-[120px]">{a.department}</TableCell>
                                        <TableCell className="w-[150px]">
                                            {a.structureMode === 'custom' ?
                                                <Badge variant="outline">Custom</Badge> :
                                                availableStructures.find(s => s.id === a.structureId)?.name || 'Unknown'
                                            }
                                        </TableCell>
                                        <TableCell className="text-right w-[120px]">₹{a.monthlyCTC.toLocaleString()}</TableCell>
                                        <TableCell className="text-right w-[120px]">₹{a.annualCTC.toLocaleString()}</TableCell>
                                        <TableCell className="w-[120px]">{a.effectiveFrom}</TableCell>
                                        <TableCell className="w-[100px]">
                                            <Badge className={a.status === 'active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                                                {a.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="w-[80px] text-center">
                                            {a.status === 'active' ? (
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(a)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            ) : (
                                                <Button variant="ghost" size="sm" onClick={() => {
                                                    handleCreateNew(a.employeeId);
                                                }}>
                                                    <span className="text-xs text-blue-600 font-medium">Assign</span>
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="flex justify-between items-center px-1 py-4">
                    <div className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAssignments.length)} of {filteredAssignments.length} entries
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
                            disabled={currentPage === totalPages || totalPages === 0}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // --- View: Form ---

    return (
        <div className="space-y-6 pb-20">
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
                                            {mockDepartments.filter(d => d !== "All Departments").map((dept) => (
                                                <CommandItem
                                                    key={dept}
                                                    value={dept}
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
                                                    <Check className={cn("mr-2 h-4 w-4", formState.department === dept ? "opacity-100" : "opacity-0")} />
                                                    {dept}
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
                                            {mockDesignations.map((desig) => (
                                                <CommandItem
                                                    key={desig}
                                                    value={desig}
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
                                                    <Check className={cn("mr-2 h-4 w-4", formState.designation === desig ? "opacity-100" : "opacity-0")} />
                                                    {desig}
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
                                <Command>
                                    <CommandInputBorderless placeholder="Search employee..." className="h-9" />
                                    <CommandList className="max-h-[200px] overflow-y-auto">
                                        <CommandEmpty>No employee found.</CommandEmpty>
                                        <CommandGroup>
                                            {formFilteredEmployees.map((emp) => (
                                                <CommandItem
                                                    key={emp.code}
                                                    value={emp.name}
                                                    onSelect={() => {
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
                                                    className="cursor-pointer"
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

                    <div className="space-y-2">
                        <Label>Effective From <span className="text-red-500">*</span></Label>
                        <Input
                            type="date"
                            value={formState.effectiveFrom || ""}
                            onChange={(e) => setFormState({ ...formState, effectiveFrom: e.target.value })}
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
            <div className="space-y-4">
                {/* CTC INPUT */}
                <div className="bg-card border rounded-lg p-6 flex flex-col items-center justify-center space-y-2">
                    <Label className="text-lg font-medium">Annual CTC <span className="text-red-500">*</span></Label>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                            <Input
                                type="number"
                                className="pl-8 text-lg font-bold w-[200px]"
                                value={formState.annualCTC || ""}
                                onChange={(e) => setFormState({ ...formState, annualCTC: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        <span className="text-sm text-muted-foreground">per year</span>
                    </div>
                    {formState.monthlyCTC ? (
                        <p className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                            Monthly CTC: ₹{formState.monthlyCTC.toLocaleString()}
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
                                                            type="number"
                                                            className="w-[80px] h-9"
                                                            value={row.value || ""}
                                                            onChange={(e) => updateEarningRow(index, 'value', parseFloat(e.target.value))}
                                                        />
                                                    )}
                                                    <Select
                                                        value={row.calcMode}
                                                        onValueChange={(v) => updateEarningRow(index, 'calcMode', v)}
                                                    >
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent side="bottom">
                                                            <SelectItem value="FLAT">Fixed Amount</SelectItem>
                                                            <SelectItem value="PCT_CTC">% of CTC</SelectItem>
                                                            <SelectItem value="PCT_BASIC">% of Basic</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>

                                        {/* Monthly Amount */}
                                        <div className="col-span-2 text-right">
                                            {row.calcMode === 'REMAINING' ? (
                                                <div className={cn("bg-muted px-3 py-2 rounded text-sm font-medium", row.monthlyAmount < 0 && "text-red-600")}>
                                                    {Math.round(row.monthlyAmount).toLocaleString()}
                                                </div>
                                            ) : (row.calcMode === 'FLAT' && (formState.structureMode === 'custom' || !row.isBase)) ? (
                                                <Input
                                                    type="number"
                                                    className="h-9 text-right"
                                                    value={row.monthlyAmount || ""}
                                                    onChange={(e) => updateEarningRow(index, 'monthlyAmount', parseFloat(e.target.value))}
                                                />
                                            ) : (
                                                <div className="bg-muted px-3 py-2 rounded text-sm font-medium">
                                                    {Math.round(row.monthlyAmount).toLocaleString()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Annual Amount */}
                                        <div className="col-span-2 text-right">
                                            {row.calcMode === 'REMAINING' ? (
                                                <div className={cn("text-sm text-muted-foreground font-medium", row.annualAmount < 0 && "text-red-600")}>
                                                    {Math.round(row.annualAmount).toLocaleString()}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    {Math.round(row.annualAmount).toLocaleString()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Remove Button */}
                                        <div className="col-span-1 flex justify-center">
                                            {(!row.isBase && row.componentCode !== 'BASIC' && row.componentCode !== 'FIXED') && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-red-500"
                                                    onClick={() => removeRow(index, 'earning')}
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
                                        <Command>
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
                                                                value={c.name}
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
                                        <div className="col-span-3 text-sm text-muted-foreground py-2">Fixed amount</div>
                                        <div className="col-span-2 text-right">
                                            <Input
                                                type="number"
                                                className="h-9 text-right"
                                                value={row.monthlyAmount || ""}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    const newRows = [...deductionsRows];
                                                    newRows[index] = { ...row, monthlyAmount: val, annualAmount: val * 12 };
                                                    setDeductionsRows(newRows);
                                                }}
                                            />
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <div className="text-sm text-muted-foreground">{Math.round(row.annualAmount).toLocaleString()}</div>
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            {!row.isBase && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-red-500"
                                                    onClick={() => removeRow(index, 'deduction')}
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
                                        <Command>
                                            <CommandInputBorderless placeholder="Search deduction component..." className="h-9" />
                                            <CommandList className="max-h-[250px] overflow-y-auto">
                                                <CommandEmpty>No deduction component found.</CommandEmpty>
                                                <CommandGroup>
                                                    {availableComponents.deductions
                                                        .filter(c => !deductionsRows.some(row => row.componentCode === c.code))
                                                        .map(c => (
                                                            <CommandItem
                                                                key={c.code}
                                                                value={c.name}
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
                                            {Math.round(remainingRow?.monthlyAmount || 0).toLocaleString()}
                                        </div>
                                        <div className="text-red-500 font-medium">
                                            {Math.round(remainingRow?.annualAmount || 0).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-blue-50/50 border-t p-6 rounded-b-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-muted-foreground font-medium">Gross Monthly Salary</span>
                                    <span className="font-bold">₹{Math.round(monthlyCTC).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-muted-foreground font-medium">Total Deductions</span>
                                    <span className="font-bold text-red-600">- ₹{Math.round(totalDeductionsMonthly).toLocaleString()}</span>
                                </div>
                                <div className="h-px bg-border mb-4"></div>
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-lg font-bold">Net Monthly Pay</span>
                                        <span className="text-xs text-muted-foreground">In-hand salary after deductions</span>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn("text-2xl font-bold", netPayMonthly < 0 ? "text-red-600" : "text-green-700")}>
                                            ₹{Math.round(netPayMonthly).toLocaleString()}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Annual: ₹{Math.round(netPayAnnual).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-between items-center pb-10">
                    <div>
                        {isEditMode && (
                            <Button variant="destructive" onClick={() => setOpenDeleteDialog(true)}>
                                Delete Assignment
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={handleBackToList}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!isValid}>
                            {isEditMode ? "Update Assignment" : "Save Assignment"}
                        </Button>
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
                            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
