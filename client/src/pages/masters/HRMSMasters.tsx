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
import { Plus, Search, Pencil, Trash2, CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
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
    | "Department"
    | "Designation"
    | "Grade / Level"
    | "Work Location"
    | "Shift"
    | "Employee Types"
    | "Employee Status"
    | "Employee Document Types"
    | "Gender"
    | "Leave"
    | "Holidays";

const MASTER_SLUGS: Record<MasterType, string> = {
    "Department": "department",
    "Designation": "designation",
    "Grade / Level": "grade-level",
    "Work Location": "work-location",
    "Shift": "shift",
    "Employee Types": "employee-types",
    "Employee Status": "employee-status",
    "Employee Document Types": "document-types",
    "Gender": "gender",
    "Leave": "leave",
    "Holidays": "holidays"
};

const MASTER_TYPES: MasterType[] = [
    "Department",
    "Designation",
    "Grade / Level",
    "Work Location",
    "Shift",
    "Employee Types",
    "Employee Status",
    "Employee Document Types",
    "Gender",
    "Leave",
    "Holidays"
];

const EMPLOYEE_MASTER_TYPES: MasterType[] = [
    "Department",
    "Designation",
    "Grade / Level",
    "Work Location",
    "Shift",
    "Employee Types",
    "Employee Status",
    "Employee Document Types",
    "Gender"
];

const LEAVE_MASTER_TYPES: MasterType[] = [
    "Leave",
    "Holidays"
];

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

    // Specific Fields - Department & Designation
    head?: string;
    department?: string;
    level?: string;

    // Employee Types Specific
    employee_category?: string;
    contract_type?: string;

    // Employee Status Specific
    system_access?: boolean;

    // Leave Master Specific
    leave_type?: string;
    document?: string; // For Leave

    // Holiday Master Specific
    holiday_name?: string;
    holiday_date?: string;

    // Work Location Specific
    location_name?: string; // Mapped to name
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;

    // Shift Specific
    shift_name?: string; // Mapped to name
    start_time?: string;
    end_time?: string;
    half_day_hours?: number;
    full_day_hours?: number;

    // Document Type Specific
    document_name?: string; // Mapped to name
    mandatory?: boolean;
    expiry_required?: boolean;

    // Gender Specific
    gender_name?: string; // Mapped to name

    // Grade Specific
    min_salary_range?: number;
    max_salary_range?: number;
}

// --- Mock Data ---

const initialDepartments: BaseMasterItem[] = [
    { id: 1, name: "Human Resources", code: "HR", head: "Alice Johnson", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 2, name: "Engineering", code: "ENG", head: "Bob Smith", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
];

const initialDesignations: BaseMasterItem[] = [
    { id: 1, name: "Software Engineer", code: "SE", department: "Engineering", level: "L1", status: "Active" },
    { id: 2, name: "Senior Software Engineer", code: "SSE", department: "Engineering", level: "L2", status: "Active" },
];


const initialGrades: BaseMasterItem[] = [
    { id: 1, name: "A1", min_salary_range: 30000, max_salary_range: 50000, status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 2, name: "A2", min_salary_range: 50001, max_salary_range: 80000, status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
];

const initialEmployeeTypes: BaseMasterItem[] = [
    { id: 1, name: "Permanent", code: "PERM", employee_category: "Full Time", contract_type: "Open Ended", status: "Active", created_at: "2024-01-15T09:00:00", created_by: "Admin User" },
    { id: 2, name: "Contractor", code: "CONT", employee_category: "Contract", contract_type: "Fixed Term", status: "Active", created_at: "2024-01-16T09:00:00", created_by: "Admin User" },
];

const initialEmployeeStatus: BaseMasterItem[] = [
    { id: 1, name: "Active", code: "ACT", description: "Currently employed", system_access: true, status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin User" },
    { id: 2, name: "On Leave", code: "OL", description: "On extended leave", system_access: false, status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin User" },
    { id: 3, name: "Terminated", code: "TERM", description: "No longer employed", system_access: false, status: "Inactive", created_at: "2024-01-01T10:00:00", created_by: "Admin User" },
];

const initialLocations: BaseMasterItem[] = [
    { id: 1, name: "Head Office", address: "123 Main St", city: "New York", state: "NY", country: "USA", pincode: "10001", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
];

const initialShifts: BaseMasterItem[] = [
    { id: 1, name: "General Shift", start_time: "09:00", end_time: "18:00", half_day_hours: 4, full_day_hours: 9, status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
];

const initialDocTypes: BaseMasterItem[] = [
    { id: 1, name: "Passport", mandatory: true, expiry_required: true, description: "Official Passport", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
];

const initialGenders: BaseMasterItem[] = [
    { id: 1, name: "Male", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
    { id: 2, name: "Female", status: "Active", created_at: "2024-01-01T10:00:00", created_by: "Admin" },
];

const initialLeaves: BaseMasterItem[] = [
    { id: 1, name: "", leave_type: "Annual Leave", document: "Not Required", status: "Active", created_at: "2024-01-01", created_by: "system" },
    { id: 2, name: "", leave_type: "Sick Leave", document: "Medical Certificate", status: "Active", created_at: "2024-01-01", created_by: "system" },
];

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
        return activeTab === "leave-master" ? "Leave" : "Department";
    };

    const selectedMaster = getValidMaster(params.type);

    const [searchTerm, setSearchTerm] = useState("");
    const [open, setOpen] = useState(false);

    const updateRoute = (tab: string, type: MasterType) => {
        const slug = MASTER_SLUGS[type] || type;
        setLocation(`/masters/hrms/${tab}/${slug}`);
    };

    const handleMasterChange = (newMaster: MasterType) => {
        updateRoute(activeTab, newMaster);
        setSearchTerm("");
        setOpen(false);
    };

    // State for all masters
    const [masterData, setMasterData] = useState<{ [key in MasterType]: BaseMasterItem[] }>({
        "Department": initialDepartments,
        "Designation": initialDesignations,
        "Grade / Level": initialGrades,
        "Work Location": initialLocations,
        "Shift": initialShifts,
        "Employee Types": initialEmployeeTypes,
        "Employee Status": initialEmployeeStatus,
        "Employee Document Types": initialDocTypes,
        "Gender": initialGenders,
        "Leave": initialLeaves,
        "Holidays": initialHolidays
    });

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<Partial<BaseMasterItem>>({});

    // Tab Change
    const handleTabChange = (value: string) => {
        let defaultMaster: MasterType = "Department";
        if (value === "leave-master") defaultMaster = "Leave";
        else if (value === "attendance-master") defaultMaster = "Shift";

        updateRoute(value, defaultMaster);
        setSearchTerm("");
    };

    // --- Helpers ---

    const currentMasterList = masterData[selectedMaster] || [];
    // Filter by search for all fields
    const currentData = currentMasterList.filter(item =>
        Object.values(item).some(value =>
            String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const handleAddClick = () => {
        setEditingId(null);
        // Default values
        let defaults: Partial<BaseMasterItem> = { status: "Active" };
        if (selectedMaster === "Employee Status") defaults.system_access = false;

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

    const handleSave = () => {
        // --- Validation ---
        if (!formData.status) {
            toast({ variant: "destructive", title: "Validation Error", description: "Status is required." });
            return;
        }

        // Mandatory Name/ID check
        // Check Name for all except Employee Status (calls it description? no, it has name/desc, but code is mandatory)
        // Employee Status uses ID (Code)

        const isEmployeeStatus = selectedMaster === "Employee Status";

        if (!formData.name && selectedMaster !== "Employee Status" && selectedMaster !== "Leave" && selectedMaster !== "Holidays") {
            const label = selectedMaster === "Designation" ? "Title" :
                selectedMaster === "Work Location" ? "Location Name" :
                    selectedMaster === "Shift" ? "Shift Name" :
                        selectedMaster === "Employee Document Types" ? "Document Name" :
                            selectedMaster === "Gender" ? "Gender Name" : "Name";
            toast({ variant: "destructive", title: "Validation Error", description: `${label} is required.` });
            return;
        }

        if (isEmployeeStatus) {
            // Code validation removed as per request
        }

        // Leave Master Validation
        if (selectedMaster === "Leave") {
            if (!formData.leave_type) {
                toast({ variant: "destructive", title: "Validation Error", description: "Leave Type is required." });
                return;
            }
            if (!formData.document) {
                toast({ variant: "destructive", title: "Validation Error", description: "Document is required." });
                return;
            }
        }

        if (selectedMaster === "Holidays") {
            if (!formData.holiday_name) {
                toast({ variant: "destructive", title: "Validation Error", description: "Holiday Name is required." });
                return;
            }
            if (!formData.holiday_date) {
                toast({ variant: "destructive", title: "Validation Error", description: "Holiday Date is required." });
                return;
            }
        }

        // Safety: If Employee Status name is empty but code exists, use code as name (for display)
        if (selectedMaster === "Employee Status" && !formData.name && formData.code) {
            formData.name = formData.code;
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
                    name: formData.name || (selectedMaster === "Leave" ? formData.leave_type || "" : selectedMaster === "Holidays" ? formData.holiday_name || "" : ""), // Fallback name
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
            case "Department":
                return (
                    <>
                        <TableHead>Department Name</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            case "Designation":
                return (
                    <>
                        <TableHead>Designation Name</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            case "Grade / Level":
                return (
                    <>
                        <TableHead>ID</TableHead>
                        <TableHead>Grade / Level Name</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );

            case "Employee Types":
                return (
                    <>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );

            case "Employee Status":
                return (
                    <>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            case "Work Location":
                return (
                    <>
                        <TableHead>Location Name</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            case "Shift":
                return (
                    <>
                        <TableHead>Shift Name</TableHead>
                        <TableHead>Start Time</TableHead>
                        <TableHead>End Time</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            case "Employee Document Types":
                return (
                    <>
                        <TableHead>Employee Document Name</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            case "Gender":
                return (
                    <>
                        <TableHead>Gender Name</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            case "Leave":
                return (
                    <>
                        <TableHead>ID</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Status</TableHead>
                    </>
                );
            case "Holidays":
                return (
                    <>
                        <TableHead>ID</TableHead>
                        <TableHead>Holiday Name</TableHead>
                        <TableHead>Holiday Date</TableHead>
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
            case "Department":
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "Designation":
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "Grade / Level":
                return (
                    <>
                        <TableCell className="font-medium">{item.id}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "Employee Types":
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "Employee Status":
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "Work Location":
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.address || "-"}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "Shift":
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.start_time || "-"}</TableCell>
                        <TableCell>{item.end_time || "-"}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "Employee Document Types":
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "Gender":
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "Leave":
                return (
                    <>
                        <TableCell className="font-medium">{item.id}</TableCell>
                        <TableCell>{item.leave_type}</TableCell>
                        <TableCell>{item.document}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            case "Holidays":
                return (
                    <>
                        <TableCell className="font-medium">{item.id}</TableCell>
                        <TableCell>{item.holiday_name}</TableCell>
                        <TableCell>{item.holiday_date}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
            default: // Generic
                return (
                    <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.description || "-"}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                    </>
                );
        }
    };

    const renderFormFields = () => {
        return (
            <div className="grid gap-4 py-4">
                {/* Name & Code - Common/Conditional */}

                {/* Name & Code - Common/Conditional */}

                {/* Generic Name Input - renamed to include Gender */}
                {(selectedMaster !== "Leave" && selectedMaster !== "Holidays") && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="master-name" className="text-right">
                            {selectedMaster === "Designation" ? "Designation Name" :
                                selectedMaster === "Department" ? "Department Name" :
                                    selectedMaster === "Grade / Level" ? "Grade / Level Name" :
                                        selectedMaster === "Work Location" ? "Location Name" :
                                            selectedMaster === "Shift" ? "Shift Name" :
                                                selectedMaster === "Employee Document Types" ? "Employee Document Name" :
                                                    selectedMaster === "Gender" ? "Gender Name" : "Name"} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="master-name"
                            value={formData.name || ""}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                )}



                {(selectedMaster === "Grade / Level" || selectedMaster === "Leave" || selectedMaster === "Holidays") && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="master-id" className="text-right">ID</Label>
                        <Input
                            id="master-id"
                            value={formData.id || "Auto-generated"}
                            disabled
                            className="col-span-3 bg-muted"
                        />
                    </div>
                )}

                {/* Code field removed for Employee Status */}

                {/* Legacy Code Input for others if needed - None currently */}

                {/* Specific - Department */}
                {/* Department Head field removed */}

                {/* Specific - Designation - Department Field Removed */}

                {/* Specific - Grade - Fields Removed */}

                {/* Specific - Employee Types - Fields Removed */}

                {/* Specific - Employee Status - Fields Removed */}

                {/* Specific - Work Location */}
                {selectedMaster === "Work Location" && (
                    <>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label htmlFor="loc-address" className="text-right pt-2">Address</Label>
                            <Textarea
                                id="loc-address"
                                value={formData.address || ""}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                className="col-span-3 min-h-[100px]"
                                placeholder="Enter full address here..."
                            />
                        </div>
                    </>
                )}

                {/* Specific - Shift */}
                {selectedMaster === "Shift" && (
                    <>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="shift-start" className="text-right">Start Time</Label>
                            <Input type="time" id="shift-start" value={formData.start_time || ""} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="shift-end" className="text-right">End Time</Label>
                            <Input type="time" id="shift-end" value={formData.end_time || ""} onChange={e => setFormData({ ...formData, end_time: e.target.value })} className="col-span-3" />
                        </div>
                    </>
                )}

                {/* Specific - Document Types - Fields Removed */}

                {/* Specific - Leave */}
                {selectedMaster === "Leave" && (
                    <>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="leave-type" className="text-right">Leave Type <span className="text-red-500">*</span></Label>
                            <Input
                                id="leave-type"
                                value={formData.leave_type || ""}
                                onChange={e => setFormData({ ...formData, leave_type: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="leave-doc" className="text-right">Document <span className="text-red-500">*</span></Label>
                            <Input
                                id="leave-doc"
                                value={formData.document || ""}
                                onChange={e => setFormData({ ...formData, document: e.target.value })}
                                className="col-span-3"
                            />
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
                                                .filter(item => {
                                                    const searchLower = searchTerm.toLowerCase();
                                                    return (
                                                        (item.name && item.name.toLowerCase().includes(searchLower)) ||
                                                        (item.code && item.code.toLowerCase().includes(searchLower)) ||
                                                        (item.leave_type && item.leave_type.toLowerCase().includes(searchLower)) ||
                                                        (item.holiday_name && item.holiday_name.toLowerCase().includes(searchLower))
                                                    );
                                                })
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
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="leave-master" className="m-0 h-full flex flex-col gap-6 mt-6">
                    {/* Top Control Bar - REPLICATED for Leave Master */}
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

                    {/* Main Table Content - REUSED Logic */}
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
                                                .filter(item => {
                                                    const searchLower = searchTerm.toLowerCase();
                                                    return (
                                                        (item.name && item.name.toLowerCase().includes(searchLower)) ||
                                                        (item.code && item.code.toLowerCase().includes(searchLower)) ||
                                                        (item.leave_type && item.leave_type.toLowerCase().includes(searchLower)) ||
                                                        (item.holiday_name && item.holiday_name.toLowerCase().includes(searchLower))
                                                    );
                                                })
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
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit" : "Add New"} {selectedMaster}</DialogTitle>
                        <DialogDescription>
                            Configure the details for this {selectedMaster} entry.
                        </DialogDescription>
                    </DialogHeader>

                    {renderFormFields()}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Changes</Button>
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
