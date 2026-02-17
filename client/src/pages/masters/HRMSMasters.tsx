import { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Pencil, Trash2, CalendarIcon, Check, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
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

// --- Types & Interfaces ---

type MasterType =
    | "Country"
    | "State"
    | "City"
    | "UserRoles"
    | "LeavePolicy"
    | "Holidays";

const MASTER_SLUGS: Record<MasterType, string> = {
    "Country": "country",
    "State": "state",
    "City": "city",
    "UserRoles": "user-roles",
    "LeavePolicy": "leave-policy",
    "Holidays": "holidays"
};

const MASTER_TYPES: MasterType[] = [
    "Country",
    "State",
    "City",
    "UserRoles",
    "LeavePolicy",
    "Holidays"
];

const EMPLOYEE_MASTER_TYPES: MasterType[] = [
    "Country",
    "State",
    "City",
    "UserRoles"
];

const LEAVE_MASTER_TYPES: MasterType[] = [
    "LeavePolicy",
    "Holidays"
];

interface LeaveTypeDistribution {
    id: number;
    leave_type: string;
    allocated_days: number;
    carry_forward: boolean; // Override
    negative_balance: boolean; // Override
    max_per_request?: number; // Override
}

interface LeavePolicy {
    id: number;
    policy_name: string;
    status: "Active" | "Inactive";

    // Annual Quota
    annual_quota: number;
    monthly_quota?: number; // [NEW]

    // Common Rules
    allow_half_day: boolean;
    allow_carry_forward: boolean;
    max_carry_forward?: number;
    allow_negative_balance: boolean;
    max_negative_balance?: number;
    attachment_required: boolean;
    encashment_allowed: boolean; // [NEW]
    brought_forward_future?: number; // [NEW]

    // Holiday Counts [NEW]
    fixed_holiday_count?: number;
    optional_holiday_count?: number;

    // Applicable Period [NEW]
    period_start_month?: number;
    period_end_month?: number;

    // Limits
    min_days_per_request: number;
    max_days_per_request?: number;

    // Distribution
    distribution: LeaveTypeDistribution[];

    // Audit
    updated_at?: string;
    updated_by?: string;
}

interface BaseMasterItem {
    id: number;
    name: string; // Most masters have a name/title
    code?: string; // Many have code/ID
    description?: string;
    status: "Active" | "Inactive";

    // Audit Fields
    created_at?: string;
    created_by?: string;
    updated_at?: string;
    updated_by?: string;

    // Location specific fields
    country?: string;
    state?: string;
    city_name?: string;

    // Holiday Master Specific
    holiday_name?: string;
    holiday_date?: string;
}

// Helper for error display
const ErrorMessage = ({ field, errors }: { field: string; errors: Record<string, string> }) => {
    if (!errors[field]) return null;
    return <span className="text-xs text-red-500 font-medium mb-1 block">{errors[field]}</span>;
};

// --- Initial Data ---

const initialCountries: BaseMasterItem[] = [
    { id: 1, name: "India", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 2, name: "USA", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
];

const initialStates: BaseMasterItem[] = [
    { id: 1, name: "Maharashtra", country: "India", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 2, name: "Gujarat", country: "India", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 3, name: "California", country: "USA", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
];

const initialCities: BaseMasterItem[] = [
    { id: 1, name: "Mumbai", state: "Maharashtra", country: "India", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 2, name: "Pune", state: "Maharashtra", country: "India", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 3, name: "Ahmedabad", state: "Gujarat", country: "India", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
];

const initialUserRoles: BaseMasterItem[] = [
    { id: 1, code: "ADMIN", name: "Administrator", description: "Full system access", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "System" },
    { id: 2, code: "HR_MGR", name: "HR Manager", description: "Manage employees and leave", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "System" },
    { id: 3, code: "EMP", name: "Employee", description: "Standard employee access", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "System" },
];

const initialLeavePolicy: LeavePolicy = {
    id: 1,
    policy_name: "Standard Leave Policy",
    status: "Active",
    annual_quota: 20,
    monthly_quota: 1.5,
    allow_half_day: true,
    allow_carry_forward: true,
    max_carry_forward: 5,
    allow_negative_balance: false,
    attachment_required: true,
    encashment_allowed: false,
    brought_forward_future: 0,
    fixed_holiday_count: 10,
    optional_holiday_count: 2,
    period_start_month: 4, // April
    period_end_month: 3, // March
    min_days_per_request: 0.5,
    distribution: [
        { id: 1, leave_type: "Casual Leave", allocated_days: 10, carry_forward: false, negative_balance: false },
        { id: 2, leave_type: "Sick Leave", allocated_days: 10, carry_forward: true, negative_balance: false },
    ],
    updated_at: "2024-01-01",
    updated_by: "Admin"
};

const initialHolidays: BaseMasterItem[] = [
    { id: 1, name: "", holiday_name: "New Year's Day", holiday_date: "2024-01-01", status: "Active", created_at: "2024-01-01", created_by: "system" },
    { id: 2, name: "", holiday_name: "Independence Day", holiday_date: "2024-08-15", status: "Active", created_at: "2024-01-01", created_by: "system" },
];


// --- Main Component ---

export default function HRMSMasters() {
    const { toast } = useToast();
    const [location, setLocation] = useLocation();
    const params = useParams();

    const activeTab = params.tab || "employee-master";

    const getValidMaster = (type: string | undefined): MasterType => {
        if (type) {
            const entry = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === type);
            if (entry) return entry[0] as MasterType;
        }
        return activeTab === "leave-master" ? "LeavePolicy" : "Country";
    };

    const selectedMaster = getValidMaster(params.type);

    const [searchTerm, setSearchTerm] = useState("");
    const [open, setOpen] = useState(false);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const updateRoute = (tab: string, type: MasterType) => {
        const slug = MASTER_SLUGS[type] || type;
        setLocation(`/masters/hrms/${tab}/${slug}`);
    };

    const handleMasterChange = (newMaster: MasterType) => {
        updateRoute(activeTab, newMaster);
        setSearchTerm("");
        setOpen(false);
        setCurrentPage(1);
    };

    // State for list-based masters
    const [masterData, setMasterData] = useState<{ [key in MasterType]?: BaseMasterItem[] }>({
        "Country": initialCountries,
        "State": initialStates,
        "City": initialCities,
        "UserRoles": initialUserRoles,
        "Holidays": initialHolidays
    });

    // State for Singleton Leave Policy
    const [leavePolicy, setLeavePolicy] = useState<LeavePolicy>(initialLeavePolicy);
    const [policyErrors, setPolicyErrors] = useState<Record<string, string>>({}); // [NEW] Error State

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<Partial<BaseMasterItem>>({});

    // Tab Change
    const handleTabChange = (value: string) => {
        let defaultMaster: MasterType = "Country";
        if (value === "leave-master") defaultMaster = "LeavePolicy";
        // else if (value === "attendance-master") defaultMaster = "Shift" as any; 

        updateRoute(value, defaultMaster);
        setSearchTerm("");
        setCurrentPage(1);
    };

    // --- Helpers ---

    const currentMasterList = masterData[selectedMaster] || [];
    // Filter by search for all fields
    const filteredData = currentMasterList.filter(item =>
        Object.values(item).some(value =>
            String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );
    
    // Pagination calculations
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    
    // Reset to first page when search term or master type changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedMaster]);

    const handleAddClick = () => {
        setEditingId(null);
        // Default values
        let defaults: Partial<BaseMasterItem> = { status: "Active" };
        setFormData(defaults);
        setIsDialogOpen(true);
    };

    const handleEditClick = (item: BaseMasterItem) => {
        setEditingId(item.id);
        setFormData({ ...item });
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (id: number) => {
        // Validation: Prevent delete if record is used
        const itemToDelete = currentData.find(i => i.id === id);
        if (!itemToDelete) return;

        if (confirm("Are you sure? This action cannot be undone.")) {
            setMasterData(prev => ({
                ...prev,
                [selectedMaster]: prev[selectedMaster].filter(item => item.id !== id)
            }));
            toast({ title: "Deleted", description: "Record deleted successfully." });
        }
    };

    // --- Leave Policy Handlers ---

    const validateField = (field: keyof LeavePolicy, value: any): string => {
        if (field === "policy_name") {
            if (!value) return "Policy Name is required.";
            if (value.length > 50) return "Policy Name must be 50 characters or less.";
        }
        if (field === "annual_quota" && value < 0) return "Cannot be negative.";
        if (field === "annual_quota" && value > 50) return "Max limit is 50.";

        if (field === "monthly_quota") {
            if (value < 0) return "Cannot be negative.";
            if (value > 50) return "Max limit is 50.";
        }
        if (field === "max_carry_forward") {
            if (value < 0) return "Cannot be negative.";
            if (value > 50) return "Max limit is 50.";
        }
        if (field === "max_negative_balance") {
            if (value < 0) return "Cannot be negative.";
            if (value > 50) return "Max limit is 50.";
        }
        if (field === "brought_forward_future") {
            if (value < 0) return "Cannot be negative.";
            if (value > 50) return "Max limit is 50.";
        }
        if (field === "fixed_holiday_count") {
            if (value < 0) return "Cannot be negative.";
            if (value > 50) return "Max limit is 50.";
        }
        if (field === "optional_holiday_count") {
            if (value < 0) return "Cannot be negative.";
            if (value > 50) return "Max limit is 50.";
        }
        if (field === "min_days_per_request" || field === "max_days_per_request") {
            if (value < 0) return "Cannot be negative.";
            if (value > 50) return "Max limit is 50.";
        }

        if (field === "period_start_month" || field === "period_end_month") {
            if (value < 1 || value > 12) return "Must be between 1 and 12.";
        }
        return "";
    };

    const handlePolicyUpdate = (field: keyof LeavePolicy, value: any) => {
        setLeavePolicy(prev => ({ ...prev, [field]: value }));

        const error = validateField(field, value);
        setPolicyErrors(prev => {
            const newErrors = { ...prev };
            if (error) newErrors[field] = error;
            else delete newErrors[field];
            return newErrors;
        });
    };

    const handleDistributionUpdate = (id: number, field: string, value: any) => {
        // Update data
        setLeavePolicy(prev => ({
            ...prev,
            distribution: prev.distribution.map(d => d.id === id ? { ...d, [field]: value } : d)
        }));

        // Validate
        let error = "";
        if (field === "allocated_days" || field === "max_per_request") {
            if (value < 0) error = "Cannot be negative.";
            else if (value > 50) error = "Max limit is 50.";
        }

        setPolicyErrors(prev => {
            const newErrors = { ...prev };
            const errorKey = `dist_${id}_${field}`;
            if (error) newErrors[errorKey] = error;
            else delete newErrors[errorKey];
            return newErrors;
        });
    };

    const handleAddDistributionRow = () => {
        const newId = Math.max(...leavePolicy.distribution.map(d => d.id), 0) + 1;
        setLeavePolicy(prev => ({
            ...prev,
            distribution: [
                ...prev.distribution,
                { id: newId, leave_type: "", allocated_days: 0, carry_forward: prev.allow_carry_forward, negative_balance: prev.allow_negative_balance }
            ]
        }));
    };

    const handleRemoveDistributionRow = (id: number) => {
        setLeavePolicy(prev => ({
            ...prev,
            distribution: prev.distribution.filter(item => item.id !== id)
        }));
    };

    const handleSavePolicy = () => {
        // Validation
        if (!leavePolicy.policy_name) {
            toast({ variant: "destructive", title: "Validation Error", description: "Policy Name is required." });
            return;
        }
        if (leavePolicy.policy_name.length > 50) {
            toast({ variant: "destructive", title: "Validation Error", description: "Policy Name must be 50 characters or less." });
            return;
        }

        // Numeric Validations
        if (leavePolicy.annual_quota < 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Annual Quota cannot be negative." });
            return;
        }
        if (leavePolicy.monthly_quota !== undefined && leavePolicy.monthly_quota < 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Monthly Quota cannot be negative." });
            return;
        }
        if (leavePolicy.max_carry_forward !== undefined && leavePolicy.max_carry_forward < 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Max Carry Forward cannot be negative." });
            return;
        }
        if (leavePolicy.max_negative_balance !== undefined && leavePolicy.max_negative_balance < 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Max Negative Balance cannot be negative." });
            return;
        }
        if (leavePolicy.brought_forward_future !== undefined && leavePolicy.brought_forward_future < 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Brought Forward days cannot be negative." });
            return;
        }
        if (leavePolicy.fixed_holiday_count !== undefined && leavePolicy.fixed_holiday_count < 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Fixed Holiday Count cannot be negative." });
            return;
        }
        if (leavePolicy.optional_holiday_count !== undefined && leavePolicy.optional_holiday_count < 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Optional Holiday Count cannot be negative." });
            return;
        }

        // Month Validation
        if (leavePolicy.period_start_month !== undefined && (leavePolicy.period_start_month < 1 || leavePolicy.period_start_month > 12)) {
            toast({ variant: "destructive", title: "Validation Error", description: "Start Month must be between 1 and 12." });
            return;
        }
        if (leavePolicy.period_end_month !== undefined && (leavePolicy.period_end_month < 1 || leavePolicy.period_end_month > 12)) {
            toast({ variant: "destructive", title: "Validation Error", description: "End Month must be between 1 and 12." });
            return;
        }


        // Check quotas
        const totalAllocated = leavePolicy.distribution.reduce((sum, item) => sum + (item.allocated_days || 0), 0);
        if (totalAllocated !== leavePolicy.annual_quota) {
            toast({ variant: "destructive", title: "Validation Error", description: `Total allocated days (${totalAllocated}) must match Annual Quota (${leavePolicy.annual_quota}).` });
            return;
        }

        // Distribution Negative Checks
        const hasNegativeAllocation = leavePolicy.distribution.some(d => d.allocated_days < 0 || (d.max_per_request !== undefined && d.max_per_request < 0));
        if (hasNegativeAllocation) {
            toast({ variant: "destructive", title: "Validation Error", description: "Distribution allocated days and limits cannot be negative." });
            return;
        }

        const now = new Date().toISOString();
        setLeavePolicy(prev => ({ ...prev, updated_at: now, updated_by: "Admin" }));
        toast({ title: "Success", description: "Leave Policy saved successfully." });
    };

    const handleSave = () => {
        // --- Validation ---
        if (!formData.status) {
            toast({ variant: "destructive", title: "Validation Error", description: "Status is required." });
            return;
        }

        // Common Name Check
        if (!formData.name && selectedMaster !== "Leave" && selectedMaster !== "Holidays") {
            const label = selectedMaster === "City" ? "City Name" :
                selectedMaster === "State" ? "State Name" :
                    selectedMaster === "Country" ? "Country Name" : "Name";
            toast({ variant: "destructive", title: "Validation Error", description: `${label} is required.` });
            return;
        }

        // State Validation
        if (selectedMaster === "State") {
            if (!formData.country) {
                toast({ variant: "destructive", title: "Validation Error", description: "Country is required." });
                return;
            }
        }

        // City Validation
        if (selectedMaster === "City") {
            if (!formData.country) {
                toast({ variant: "destructive", title: "Validation Error", description: "Country is required." });
                return;
            }
            if (!formData.state) {
                toast({ variant: "destructive", title: "Validation Error", description: "State is required." });
                return;
            }
        }



        if (selectedMaster === "Holidays") {
            if (!formData.holiday_name) {
                toast({ variant: "destructive", title: "Validation Error", description: "Holiday Name is required." });
                return;
            }
            if (formData.holiday_name.length > 50) {
                toast({ variant: "destructive", title: "Validation Error", description: "Holiday Name must be 50 characters or less." });
                return;
            }
            if (!formData.holiday_date) {
                toast({ variant: "destructive", title: "Validation Error", description: "Holiday Date is required." });
                return;
            }
        } else if (formData.name && formData.name.length > 50) {
            toast({ variant: "destructive", title: "Validation Error", description: "Name must be 50 characters or less." });
            return;
        }

        // Check for duplicates (Name or Code/ID)
        const isDuplicate = currentData.some(item =>
            item.id !== editingId && (
                (item.code && formData.code && item.code.toLowerCase() === formData.code.toLowerCase()) ||
                (item.name && formData.name && item.name.toLowerCase() === formData.name.toLowerCase())
            )
        );

        if (isDuplicate) {
            toast({ variant: "destructive", title: "Validation Error", description: "A record with this Name or ID already exists." });
            return;
        }

        const now = new Date().toISOString();
        const user = "Admin User"; // Mock logged-in user

        setMasterData(prev => {
            const list = prev[selectedMaster];
            if (editingId) {
                // Update
                return {
                    ...prev,
                    [selectedMaster]: list.map(item => item.id === editingId ? {
                        ...item,
                        ...formData,
                        updated_at: now,
                        updated_by: user
                    } as BaseMasterItem : item)
                };
            } else {
                // Create
                const newId = Math.max(...list.map(d => d.id), 0) + 1;
                const newItem: BaseMasterItem = {
                    id: newId,
                    name: formData.name || (selectedMaster === "Holidays" ? formData.holiday_name || "" : ""), // Fallback name
                    status: formData.status || "Active",
                    ...formData,
                    created_at: now,
                    created_by: user
                };
                return {
                    ...prev,
                    [selectedMaster]: [...list, newItem]
                };
            }
        });

        setIsDialogOpen(false);
        toast({ title: "Success", description: editingId ? "Record updated successfully" : "Record added successfully" });
    };

    // --- Renderers ---

    const renderTableHeaders = () => {
        switch (selectedMaster) {
            case "Country":
                return (
                    <>
                        <TableHead>Country Name</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            case "State":
                return (
                    <>
                        <TableHead>State Name</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            case "City":
                return (
                    <>
                        <TableHead>City Name</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );

            case "Holidays":
                return (
                    <>
                        <TableHead>Holiday Name</TableHead>
                        <TableHead>Holiday Date</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            case "LeavePolicy":
                return (
                    <>
                        <TableHead>Policy Name</TableHead>
                        <TableHead>Annual Quota</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            case "UserRoles":
                return (
                    <>
                        <TableHead>Code</TableHead>
                        <TableHead>Role Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            default: // Generic
                return (
                    <>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
        }
    };

    const renderTableRow = (item: BaseMasterItem) => {
        switch (selectedMaster) {
            case "Country":
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "State":
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.country}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "City":
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.state}</TableCell>
                        <TableCell>{item.country}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );

            case "Holidays":
                return (
                    <>
                        <TableCell className="font-medium">{item.holiday_name}</TableCell>
                        <TableCell>{item.holiday_date}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "LeavePolicy":
                // item here acts as LeavePolicy
                const policy = item as unknown as LeavePolicy;
                return (
                    <>
                        <TableCell className="font-medium">{policy.policy_name}</TableCell>
                        <TableCell>{policy.annual_quota} Days</TableCell>
                        <TableCell><StatusBadge status={policy.status} /></TableCell>
                    </>
                );
            case "UserRoles":
                return (
                    <>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            default: // Generic
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
        }
    };

    const renderLeavePolicyForm = () => {
        const totalAllocated = leavePolicy.distribution.reduce((sum, item) => sum + (item.allocated_days || 0), 0);
        const isQuotaMatched = totalAllocated === leavePolicy.annual_quota;

        return (
            <div className="flex flex-col gap-6 h-full">
                {/* Header Actions - Removed (Moved to DialogFooter) */}


                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Policy Info & Annual Quota */}
                    <Card>
                        <CardHeader><CardTitle>Policy Information</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="policy-name">Policy Name <span className="text-red-500">*</span></Label>
                                {policyErrors.policy_name && <span className="text-xs text-red-500 font-medium">{policyErrors.policy_name}</span>}
                                <Input
                                    id="policy-name"
                                    value={leavePolicy.policy_name}
                                    maxLength={50}
                                    onChange={(e) => handlePolicyUpdate("policy_name", e.target.value)}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="policy-status">Status</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">{leavePolicy.status}</span>
                                    <Switch
                                        id="policy-status"
                                        checked={leavePolicy.status === "Active"}
                                        onCheckedChange={(checked) => handlePolicyUpdate("status", checked ? "Active" : "Inactive")}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="annual-quota">Annual Leave Quota <span className="text-red-500">*</span></Label>
                                    {policyErrors.annual_quota && <span className="text-xs text-red-500 font-medium">{policyErrors.annual_quota}</span>}
                                    <Input
                                        id="annual-quota"
                                        type="number"
                                        min={0}
                                        max={50}
                                        step={leavePolicy.allow_half_day ? "0.5" : "1"}
                                        value={leavePolicy.annual_quota}
                                        onChange={(e) => handlePolicyUpdate("annual_quota", parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="monthly-quota">Monthly Quota</Label>
                                    {policyErrors.monthly_quota && <span className="text-xs text-red-500 font-medium">{policyErrors.monthly_quota}</span>}
                                    <Input
                                        id="monthly-quota"
                                        type="number"
                                        min={0}
                                        max={50}
                                        step="0.1"
                                        value={leavePolicy.monthly_quota || ""}
                                        onChange={(e) => handlePolicyUpdate("monthly_quota", parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Common Rules */}
                    <Card>
                        <CardHeader><CardTitle>Common Rules</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Allow Half Day</Label>
                                    <p className="text-sm text-muted-foreground">Enable 0.5 day leave requests</p>
                                </div>
                                <Switch
                                    checked={leavePolicy.allow_half_day}
                                    onCheckedChange={(checked) => handlePolicyUpdate("allow_half_day", checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Attachment Required</Label>
                                    <p className="text-sm text-muted-foreground">Force document upload</p>
                                </div>
                                <Switch
                                    checked={leavePolicy.attachment_required}
                                    onCheckedChange={(checked) => handlePolicyUpdate("attachment_required", checked)}
                                />
                            </div>

                            <div className="space-y-2 border-t pt-2">
                                <div className="flex items-center justify-between">
                                    <Label>Allow Carry Forward</Label>
                                    <Switch
                                        checked={leavePolicy.allow_carry_forward}
                                        onCheckedChange={(checked) => handlePolicyUpdate("allow_carry_forward", checked)}
                                    />
                                </div>
                                {leavePolicy.allow_carry_forward && (
                                    <div className="grid grid-cols-2 gap-2 items-center pl-4 border-l-2">
                                        <Label className="text-xs">Max Days</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={50}
                                            className="h-8"
                                            value={leavePolicy.max_carry_forward || ""}
                                            onChange={(e) => handlePolicyUpdate("max_carry_forward", parseFloat(e.target.value))}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 border-t pt-2">
                                <div className="flex items-center justify-between">
                                    <Label>Allow Negative Balance</Label>
                                    <Switch
                                        checked={leavePolicy.allow_negative_balance}
                                        onCheckedChange={(checked) => handlePolicyUpdate("allow_negative_balance", checked)}
                                    />
                                </div>
                                {leavePolicy.allow_negative_balance && (
                                    <div className="grid grid-cols-2 gap-2 items-center pl-4 border-l-2">
                                        <Label className="text-xs">Max Days</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={50}
                                            className="h-8"
                                            value={leavePolicy.max_negative_balance || ""}
                                            onChange={(e) => handlePolicyUpdate("max_negative_balance", parseFloat(e.target.value))}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between border-t pt-2">
                                <div className="space-y-0.5">
                                    <Label>Encashment Allowed</Label>
                                    <p className="text-sm text-muted-foreground">Allow balance payment</p>
                                </div>
                                <Switch
                                    checked={leavePolicy.encashment_allowed}
                                    onCheckedChange={(checked) => handlePolicyUpdate("encashment_allowed", checked)}
                                />
                            </div>

                            <div className="grid gap-2 border-t pt-2">
                                <Label>Brought Forward From Next Year</Label>
                                {policyErrors.brought_forward_future && <span className="text-xs text-red-500 font-medium">{policyErrors.brought_forward_future}</span>}
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={0}
                                        max={50}
                                        value={leavePolicy.brought_forward_future || ""}
                                        onChange={(e) => handlePolicyUpdate("brought_forward_future", parseInt(e.target.value) || 0)}
                                    />
                                    <span className="text-sm text-muted-foreground whitespace-nowrap">Days</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Holiday Counts */}
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">Holiday Counts</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 pb-4">
                            <div className="grid gap-2">
                                <Label>Fixed Holidays</Label>
                                {policyErrors.fixed_holiday_count && <span className="text-xs text-red-500 font-medium">{policyErrors.fixed_holiday_count}</span>}
                                <Input
                                    type="number"
                                    min={0}
                                    max={50}
                                    value={leavePolicy.fixed_holiday_count || ""}
                                    onChange={(e) => handlePolicyUpdate("fixed_holiday_count", parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Optional Holidays</Label>
                                {policyErrors.optional_holiday_count && <span className="text-xs text-red-500 font-medium">{policyErrors.optional_holiday_count}</span>}
                                <Input
                                    type="number"
                                    min={0}
                                    max={50}
                                    value={leavePolicy.optional_holiday_count || ""}
                                    onChange={(e) => handlePolicyUpdate("optional_holiday_count", parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Applicable Period */}
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">Applicable Period (Fiscal Year)</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 pb-4">
                            <div className="grid gap-2">
                                <Label>Start Month (1-12)</Label>
                                {policyErrors.period_start_month && <span className="text-xs text-red-500 font-medium">{policyErrors.period_start_month}</span>}
                                <Input
                                    type="number"
                                    min="1"
                                    max="12"
                                    placeholder="4 (April)"
                                    value={leavePolicy.period_start_month || ""}
                                    onChange={(e) => handlePolicyUpdate("period_start_month", parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>End Month (1-12)</Label>
                                {policyErrors.period_end_month && <span className="text-xs text-red-500 font-medium">{policyErrors.period_end_month}</span>}
                                <Input
                                    type="number"
                                    min="1"
                                    max="12"
                                    placeholder="3 (March)"
                                    value={leavePolicy.period_end_month || ""}
                                    onChange={(e) => handlePolicyUpdate("period_end_month", parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Limits */}
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Global Limits</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 pb-4">
                        <div className="grid gap-2">
                            <Label>Min Days Per Request</Label>
                            <ErrorMessage field="min_days_per_request" errors={policyErrors} />
                            <Input
                                type="number"
                                min={0}
                                max={50}
                                step={leavePolicy.allow_half_day ? "0.5" : "1"}
                                value={leavePolicy.min_days_per_request}
                                onChange={(e) => handlePolicyUpdate("min_days_per_request", parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Max Days Per Request (Optional)</Label>
                            <ErrorMessage field="max_days_per_request" errors={policyErrors} />
                            <Input
                                type="number"
                                min={0}
                                max={50}
                                value={leavePolicy.max_days_per_request || ""}
                                onChange={(e) => handlePolicyUpdate("max_days_per_request", parseFloat(e.target.value))}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Distribution Table */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Leave Type Distribution</CardTitle>
                        <Button size="sm" onClick={handleAddDistributionRow}><Plus className="h-4 w-4 mr-1" /> Add Type</Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Leave Type</TableHead>
                                    <TableHead>Allocated Days</TableHead>
                                    <TableHead>Carry Fwd</TableHead>
                                    <TableHead>Neg Bal</TableHead>
                                    <TableHead>Max/Req</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leavePolicy.distribution.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                            <Select
                                                value={row.leave_type}
                                                onValueChange={(val) => handleDistributionUpdate(row.id, "leave_type", val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                                                    <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                                                    <SelectItem value="Earned Leave">Earned Leave</SelectItem>
                                                    <SelectItem value="Maternity Leave">Maternity Leave</SelectItem>
                                                    <SelectItem value="Paternity Leave">Paternity Leave</SelectItem>
                                                    <SelectItem value="Vipassana Leave">Vipassana Leave</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            {policyErrors[`dist_${row.id}_allocated_days`] && <span className="block text-xs text-red-500 font-medium mb-1">{policyErrors[`dist_${row.id}_allocated_days`]}</span>}
                                            <Input
                                                type="number"
                                                min={0}
                                                max={50}
                                                step={leavePolicy.allow_half_day ? "0.5" : "1"}
                                                value={row.allocated_days}
                                                onChange={(e) => handleDistributionUpdate(row.id, "allocated_days", parseFloat(e.target.value) || 0)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={row.carry_forward}
                                                onCheckedChange={(checked) => handleDistributionUpdate(row.id, "carry_forward", checked)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={row.negative_balance}
                                                onCheckedChange={(checked) => handleDistributionUpdate(row.id, "negative_balance", checked)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {policyErrors[`dist_${row.id}_max_per_request`] && <span className="block text-xs text-red-500 font-medium mb-1">{policyErrors[`dist_${row.id}_max_per_request`]}</span>}
                                            <Input
                                                type="number"
                                                min={0}
                                                max={50}
                                                className="w-20"
                                                value={row.max_per_request || ""}
                                                onChange={(e) => handleDistributionUpdate(row.id, "max_per_request", parseFloat(e.target.value))}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleRemoveDistributionRow(row.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="mt-4 flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                            <span className="font-medium">Total Allocated:</span>
                            <div className="flex items-center gap-2">
                                <span className={cn("text-lg font-bold", isQuotaMatched ? "text-green-600" : "text-red-600")}>
                                    {totalAllocated}
                                </span>
                                <span className="text-muted-foreground">/ {leavePolicy.annual_quota}</span>
                                {!isQuotaMatched && <span className="text-xs text-red-500 ml-2">(Must match annual quota)</span>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div >
        );
    };

    const renderFormFields = () => {
        return (
            <div className="grid gap-4 py-4">
                {/* Name - Common for Country, State, City */}
                {(selectedMaster !== "Leave" && selectedMaster !== "Holidays") && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="master-name" className="text-right">
                            {selectedMaster === "City" ? "City Name" :
                                selectedMaster === "State" ? "State Name" :
                                    selectedMaster === "Country" ? "Country Name" : "Name"} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="master-name"
                            value={formData.name || ""}
                            maxLength={50}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                )}

                {/* State Specific - Country Dropdown */}
                {selectedMaster === "State" && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="country-select" className="text-right">Country <span className="text-red-500">*</span></Label>
                        <Select
                            value={formData.country}
                            onValueChange={(val) => setFormData({ ...formData, country: val })}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select Country" />
                            </SelectTrigger>
                            <SelectContent>
                                {masterData["Country"].filter(c => c.status === "Active").map(country => (
                                    <SelectItem key={country.id} value={country.name}>{country.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* City Specific - Country & State Dropdown */}
                {selectedMaster === "City" && (
                    <>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="country-select" className="text-right">Country <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.country}
                                onValueChange={(val) => {
                                    setFormData({ ...formData, country: val, state: undefined }); // Reset state when country changes
                                }}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select Country" />
                                </SelectTrigger>
                                <SelectContent>
                                    {masterData["Country"].filter(c => c.status === "Active").map(country => (
                                        <SelectItem key={country.id} value={country.name}>{country.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="state-select" className="text-right">State <span className="text-red-500">*</span></Label>
                            <Select
                                value={formData.state}
                                onValueChange={(val) => setFormData({ ...formData, state: val })}
                                disabled={!formData.country}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder={formData.country ? "Select State" : "Select Country first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {masterData["State"]
                                        .filter(s => s.status === "Active" && s.country === formData.country)
                                        .map(state => (
                                            <SelectItem key={state.id} value={state.name}>{state.name}</SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </>
                )}





                {/* Specific - Holidays */}
                {selectedMaster === "Holidays" && (
                    <>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="holiday-name" className="text-right">Holiday Name <span className="text-red-500">*</span></Label>
                            <Input
                                id="holiday-name"
                                value={formData.holiday_name || ""}
                                maxLength={50}
                                onChange={e => setFormData({ ...formData, holiday_name: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="holiday-date" className="text-right">Holiday Date <span className="text-red-500">*</span></Label>
                            <Input
                                id="holiday-date"
                                type="date"
                                value={formData.holiday_date || ""}
                                onChange={e => setFormData({ ...formData, holiday_date: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                    </>
                )}

                {/* Status - All */}
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">Status <span className="text-red-500">*</span></Label>
                    <Select
                        value={formData.status}
                        onValueChange={(val: "Active" | "Inactive") => setFormData({ ...formData, status: val })}
                    >
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        );
    };

    const renderUserRolesForm = () => {
        return (
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role-code" className="text-right">Code <span className="text-red-500">*</span></Label>
                    <Input
                        id="role-code"
                        value={formData.code || ""}
                        maxLength={20}
                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="col-span-3"
                        placeholder="e.g. ADMIN"
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role-name" className="text-right">Name <span className="text-red-500">*</span></Label>
                    <Input
                        id="role-name"
                        value={formData.name || ""}
                        maxLength={50}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="col-span-3"
                        placeholder="e.g. Administrator"
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role-desc" className="text-right">Description</Label>
                    <Textarea
                        id="role-desc"
                        value={formData.description || ""}
                        maxLength={200}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        className="col-span-3"
                        placeholder="Role description..."
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">Status <span className="text-red-500">*</span></Label>
                    <Select
                        value={formData.status}
                        onValueChange={(val: "Active" | "Inactive") => setFormData({ ...formData, status: val })}
                    >
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Master</h1>
                <p className="text-muted-foreground">
                    Manage and configure all system master data tables and reference lists.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col">
                <div className="border-b border-border">
                    <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                        <TabsTrigger
                            value="employee-master"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                        >
                            Employee Master
                        </TabsTrigger>
                        <TabsTrigger
                            value="leave-master"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                        >
                            Leave Master
                        </TabsTrigger>
                        <TabsTrigger
                            value="attendance-master"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                        >
                            Attendance Master
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="employee-master" className="m-0 h-full flex flex-col gap-6 mt-6">
                    {/* Top Control Bar - REUSED */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                        <div className="w-full sm:w-1/3">
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Select Master Type</Label>
                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={open}
                                        className="w-full justify-between h-10 font-medium"
                                    >
                                        {selectedMaster
                                            ? MASTER_TYPES.find((type) => type === selectedMaster)
                                            : "Select Master..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent style={{ width: "var(--radix-popover-trigger-width)" }} className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandInputBorderless placeholder="Search master..." />
                                        <CommandList className="max-h-[200px] overflow-y-auto">
                                            <CommandEmpty>No master found.</CommandEmpty>
                                            <CommandGroup>
                                                {EMPLOYEE_MASTER_TYPES.map((type) => (
                                                    <CommandItem
                                                        key={type}
                                                        value={type}
                                                        onSelect={(currentValue) => {
                                                            const original = MASTER_TYPES.find(t => t.toLowerCase() === currentValue.toLowerCase()) || type;
                                                            handleMasterChange(original as MasterType);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedMaster === type ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {type}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="w-full sm:w-1/3">
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={`Search ${selectedMaster}...`}
                                    className="pl-9 h-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="w-full sm:w-auto ml-auto mt-auto pt-5">
                            <Button onClick={handleAddClick} className="w-full sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" />
                                Add {selectedMaster}
                            </Button>
                        </div>
                    </div>

                    {/* Main Table Content */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle>{selectedMaster} List</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            {renderTableHeaders()}
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentData.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                    No records found for {selectedMaster}.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            currentData
                                                .map((item) => (
                                                    <TableRow key={item.id}>
                                                        {renderTableRow(item)}
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleEditClick(item)}>
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClick(item.id)}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            
                            {/* Pagination */}
                            {filteredData.length > 0 && (
                                <div className="flex justify-between items-center px-1 mt-4">
                                    <div className="text-sm text-muted-foreground">
                                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
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
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="leave-master" className="m-0 h-full flex flex-col gap-6 mt-6">
                    {/* Top Control Bar */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                        <div className="w-full sm:w-1/3">
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Select Master Type</Label>
                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={open}
                                        className="w-full justify-between h-10 font-medium"
                                    >
                                        {selectedMaster
                                            ? MASTER_TYPES.find((type) => type === selectedMaster)
                                            : "Select Master..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent style={{ width: "var(--radix-popover-trigger-width)" }} className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandInputBorderless placeholder="Search master..." />
                                        <CommandList className="max-h-[200px] overflow-y-auto">
                                            <CommandEmpty>No master found.</CommandEmpty>
                                            <CommandGroup>
                                                {LEAVE_MASTER_TYPES.map((type) => (
                                                    <CommandItem
                                                        key={type}
                                                        value={type}
                                                        onSelect={(currentValue) => {
                                                            const original = MASTER_TYPES.find(t => t.toLowerCase() === currentValue.toLowerCase()) || type;
                                                            handleMasterChange(original as MasterType);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedMaster === type ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {type}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Search & Add - Hide for LeavePolicy (Singleton) */}
                        {selectedMaster !== "LeavePolicy" && (
                            <>
                                <div className="w-full sm:w-1/3">
                                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder={`Search ${selectedMaster}...`}
                                            className="pl-9 h-10"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="w-full sm:w-auto ml-auto mt-auto pt-5">
                                    <Button onClick={handleAddClick} className="w-full sm:w-auto">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add {selectedMaster}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Content Area - TABLE VIEW FOR ALL */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle>{selectedMaster === "LeavePolicy" ? "Leave Policy Configuration" : `${selectedMaster} List`}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            {renderTableHeaders()}
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedMaster === "LeavePolicy" ? (
                                            /* Render Singleton Leave Policy Row */
                                            <TableRow key={leavePolicy.id}>
                                                {renderTableRow(leavePolicy as any)}
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => {
                                                            setIsDialogOpen(true);
                                                        }}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            /* Render Standard List Helpers */
                                            filteredData.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                        No records found for {selectedMaster}.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                currentData
                                                    .map((item) => (
                                                        <TableRow key={item.id}>
                                                            {renderTableRow(item)}
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleEditClick(item)}>
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClick(item.id)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                            )
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            
                            {/* Pagination */}
                            {selectedMaster !== "LeavePolicy" && filteredData.length > 0 && (
                                <div className="flex justify-between items-center px-1 mt-4">
                                    <div className="text-sm text-muted-foreground">
                                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
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
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="attendance-master" className="m-0 h-full flex flex-col gap-6 mt-6">
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-lg">
                        <p>Attendance Master Content Coming Soon</p>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Universal Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className={selectedMaster === "LeavePolicy" ? "sm:max-w-[900px] h-[80vh] flex flex-col p-6" : "sm:max-w-[500px]"}>
                    <DialogHeader>
                        <DialogTitle>{editingId || selectedMaster === "LeavePolicy" ? "Edit" : "Add New"} {selectedMaster === "LeavePolicy" ? "Policy" : selectedMaster}</DialogTitle>
                        <DialogDescription>
                            Configure the details for this {selectedMaster === "LeavePolicy" ? "policy" : "entry"}.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedMaster === "LeavePolicy" ? (
                        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                            {renderLeavePolicyForm()}
                        </div>
                    ) : selectedMaster === "UserRoles" ? (
                        renderUserRolesForm()
                    ) : (
                        renderFormFields()
                    )}

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={selectedMaster === "LeavePolicy" ? () => { handleSavePolicy(); setIsDialogOpen(false); } : handleSave}
                            disabled={selectedMaster === "LeavePolicy" && (
                                Object.keys(policyErrors).length > 0 ||
                                leavePolicy.distribution.reduce((sum, item) => sum + (item.allocated_days || 0), 0) !== leavePolicy.annual_quota
                            )}
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function StatusBadge({ status }: { status: "Active" | "Inactive" }) {
    return (
        <Badge
            variant={status === "Active" ? "default" : "secondary"}
            className={status === "Active" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
        >
            {status}
        </Badge>
    );
}
