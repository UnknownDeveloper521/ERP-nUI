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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { 
    mockCountries, 
    mockStates, 
    mockCities, 
    BaseMasterItem as SharedBaseMasterItem 
} from "@/lib/masterMockData";

// --- Types & Interfaces ---

type MasterType =
    | "Country"
    | "State"
    | "City"
    | "UserRoles"
    | "LeavePolicy";

const MASTER_SLUGS: Record<MasterType, string> = {
    "Country": "country",
    "State": "state",
    "City": "city",
    "UserRoles": "user-roles",
    "LeavePolicy": "leave-policy"
};

const MASTER_TYPES: MasterType[] = [
    "Country",
    "State",
    "City",
    "UserRoles",
    "LeavePolicy"
];

const MASTER_LABELS: Record<MasterType, string> = {
    "Country": "Country",
    "State": "State",
    "City": "City",
    "UserRoles": "User Roles",
    "LeavePolicy": "Leave Policy"
};

interface LeaveTypeDistribution {
    id: number;
    leave_type: string;
    allocated_days: number;
    carry_forward: boolean;
    negative_balance: boolean;
    max_per_request?: number;
}

interface LeavePolicy {
    id: number;
    policy_name: string;
    status: "Active" | "Inactive";
    annual_quota: number;
    monthly_quota?: number;
    allow_half_day: boolean;
    allow_carry_forward: boolean;
    max_carry_forward?: number;
    allow_negative_balance: boolean;
    max_negative_balance?: number;
    attachment_required: boolean;
    encashment_allowed: boolean;
    brought_forward_future?: number;
    fixed_holiday_count?: number;
    optional_holiday_count?: number;
    period_start_month?: number;
    period_end_month?: number;
    min_days_per_request: number;
    max_days_per_request?: number;
    distribution: LeaveTypeDistribution[];
    updated_at?: string;
    updated_by?: string;
}

type BaseMasterItem = SharedBaseMasterItem;

const ErrorMessage = ({ field, errors }: { field: string; errors: Record<string, string> }) => {
    if (!errors[field]) return null;
    return <span className="text-xs text-red-500 font-medium mb-1 block">{errors[field]}</span>;
};

// --- Initial Data ---

// --- Default Data ---
const initialCountries: BaseMasterItem[] = mockCountries;
const initialStates: BaseMasterItem[] = mockStates;
const initialCities: BaseMasterItem[] = mockCities;

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
    period_start_month: 4,
    period_end_month: 3,
    min_days_per_request: 0.5,
    distribution: [
        { id: 1, leave_type: "Casual Leave", allocated_days: 10, carry_forward: false, negative_balance: false },
        { id: 2, leave_type: "Sick Leave", allocated_days: 10, carry_forward: true, negative_balance: false },
    ],
    updated_at: "2024-01-01",
    updated_by: "Admin"
};

// --- Main Component ---

export default function CoreMasters() {
    const { toast } = useToast();
    const [location, setLocation] = useLocation();
    const params = useParams();

    const getValidMaster = (type: string | undefined): MasterType => {
        if (type) {
            const entry = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === type);
            if (entry) return entry[0] as MasterType;
        }
        return "Country";
    };

    const selectedMaster = getValidMaster(params.type);
    const [activeTab, setActiveTab] = useState(MASTER_SLUGS[selectedMaster]);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [masterData, setMasterData] = useState<{ [key in MasterType]?: BaseMasterItem[] }>({
        "Country": initialCountries,
        "State": initialStates,
        "City": initialCities,
        "UserRoles": initialUserRoles
    });

    const [leavePolicy, setLeavePolicy] = useState<LeavePolicy>(initialLeavePolicy);
    const [policyErrors, setPolicyErrors] = useState<Record<string, string>>({});

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<Partial<BaseMasterItem>>({});

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        setLocation(`/masters/core/${value}`);
        setSearchTerm("");
        setCurrentPage(1);
    };

    useEffect(() => {
        const newMaster = getValidMaster(params.type);
        const newSlug = MASTER_SLUGS[newMaster];
        if (newSlug !== activeTab) {
            setActiveTab(newSlug);
        }
        if (location === '/masters/core') {
            setLocation('/masters/core/country');
        }
    }, [params.type, location]);

    const currentMasterList = (selectedMaster === "LeavePolicy") ? [] : (masterData[selectedMaster] || []);
    const filteredData = currentMasterList.filter(item =>
        Object.values(item).some(value =>
            String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedMaster]);

    const handleAddClick = () => {
        setEditingId(null);
        setFormData({ status: "Active" });
        setIsDialogOpen(true);
    };

    const handleEditClick = (item: BaseMasterItem) => {
        setEditingId(item.id);
        setFormData({ ...item });
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (id: number) => {
        const itemToDelete = currentData.find(i => i.id === id);
        if (!itemToDelete) return;

        if (confirm("Are you sure? This action cannot be undone.")) {
            setMasterData(prev => ({
                ...prev,
                [selectedMaster]: prev[selectedMaster]?.filter(item => item.id !== id)
            }));
            toast({ title: "Deleted", description: "Record deleted successfully." });
        }
    };

    const validateField = (field: keyof LeavePolicy, value: any): string => {
        if (field === "policy_name") {
            if (!value) return "Policy Name is required.";
            if (value.length > 50) return "Policy Name must be 50 characters or less.";
        }
        if (["annual_quota", "monthly_quota", "max_carry_forward", "max_negative_balance", "brought_forward_future", "fixed_holiday_count", "optional_holiday_count", "min_days_per_request", "max_days_per_request"].includes(field)) {
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
        setLeavePolicy(prev => ({
            ...prev,
            distribution: prev.distribution.map(d => d.id === id ? { ...d, [field]: value } : d)
        }));
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
        if (!leavePolicy.policy_name) {
            toast({ variant: "destructive", title: "Validation Error", description: "Policy Name is required." });
            return;
        }
        const totalAllocated = leavePolicy.distribution.reduce((sum, item) => sum + (item.allocated_days || 0), 0);
        if (totalAllocated !== leavePolicy.annual_quota) {
            toast({ variant: "destructive", title: "Validation Error", description: `Total allocated days (${totalAllocated}) must match Annual Quota (${leavePolicy.annual_quota}).` });
            return;
        }
        const now = new Date().toISOString();
        setLeavePolicy(prev => ({ ...prev, updated_at: now, updated_by: "Admin" }));
        toast({ title: "Success", description: "Leave Policy saved successfully." });
    };

    const handleSave = () => {
        if (!formData.status) {
            toast({ variant: "destructive", title: "Validation Error", description: "Status is required." });
            return;
        }
        if (!formData.name && selectedMaster !== "LeavePolicy") {
            toast({ variant: "destructive", title: "Validation Error", description: `Name is required.` });
            return;
        }
        const now = new Date().toISOString();
        const user = "Admin User";
        setMasterData(prev => {
            const list = prev[selectedMaster] || [];
            if (editingId) {
                return {
                    ...prev,
                    [selectedMaster]: list.map(item => item.id === editingId ? { ...item, ...formData, updated_at: now, updated_by: user } : item)
                };
            } else {
                const newId = Math.max(...list.map(d => d.id), 0) + 1;
                const newItem: BaseMasterItem = {
                    id: newId,
                    name: formData.name || "",
                    status: formData.status || "Active",
                    ...formData,
                    created_at: now,
                    created_by: user
                };
                return { ...prev, [selectedMaster]: [...list, newItem] };
            }
        });
        setIsDialogOpen(false);
        toast({ title: "Success", description: editingId ? "Record updated successfully" : "Record added successfully" });
    };

    const renderTableHeaders = () => {
        switch (selectedMaster) {
            case "Country": return <><TableHead>Country Name</TableHead><TableHead>Status</TableHead></>;
            case "State": return <><TableHead>State Name</TableHead><TableHead>Country</TableHead><TableHead>Status</TableHead></>;
            case "City": return <><TableHead>City Name</TableHead><TableHead>State</TableHead><TableHead>Country</TableHead><TableHead>Status</TableHead></>;
            case "LeavePolicy": return <><TableHead>Policy Name</TableHead><TableHead>Annual Quota</TableHead><TableHead>Status</TableHead></>;
            case "UserRoles": return <><TableHead>Code</TableHead><TableHead>Role Name</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead></>;
            default: return <><TableHead>Name</TableHead><TableHead>Status</TableHead></>;
        }
    };

    const renderTableRow = (item: BaseMasterItem) => {
        switch (selectedMaster) {
            case "Country": return <><TableCell className="font-medium">{item.name}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></>;
            case "State": return <><TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.country}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></>;
            case "City": return <><TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.state}</TableCell><TableCell>{item.country}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></>;
            case "LeavePolicy":
                const policy = item as unknown as LeavePolicy;
                return <><TableCell className="font-medium">{policy.policy_name}</TableCell><TableCell>{policy.annual_quota} Days</TableCell><TableCell><StatusBadge status={policy.status} /></TableCell></>;
            case "UserRoles": return <><TableCell className="font-medium">{item.code}</TableCell><TableCell>{item.name}</TableCell><TableCell>{item.description}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></>;
            default: return <><TableCell className="font-medium">{item.name}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></>;
        }
    };

    const renderLeavePolicyForm = () => {
        const totalAllocated = leavePolicy.distribution.reduce((sum, item) => sum + (item.allocated_days || 0), 0);
        const isQuotaMatched = totalAllocated === leavePolicy.annual_quota;
        return (
            <div className="flex flex-col gap-6 h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle>Policy Information</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="policy-name">Policy Name <span className="text-red-500">*</span></Label>
                                <ErrorMessage field="policy_name" errors={policyErrors} />
                                <Input id="policy-name" value={leavePolicy.policy_name} maxLength={50} onChange={(e) => handlePolicyUpdate("policy_name", e.target.value)} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="policy-status">Status</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">{leavePolicy.status}</span>
                                    <Switch id="policy-status" checked={leavePolicy.status === "Active"} onCheckedChange={(checked) => handlePolicyUpdate("status", checked ? "Active" : "Inactive")} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="annual-quota">Annual Leave Quota <span className="text-red-500">*</span></Label>
                                    <ErrorMessage field="annual_quota" errors={policyErrors} />
                                    <Input id="annual-quota" type="number" min={0} max={50} step={leavePolicy.allow_half_day ? "0.5" : "1"} value={leavePolicy.annual_quota} onChange={(e) => handlePolicyUpdate("annual_quota", parseFloat(e.target.value) || 0)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="monthly-quota">Monthly Quota</Label>
                                    <ErrorMessage field="monthly_quota" errors={policyErrors} />
                                    <Input id="monthly-quota" type="number" min={0} max={50} step="0.1" value={leavePolicy.monthly_quota || ""} onChange={(e) => handlePolicyUpdate("monthly_quota", parseFloat(e.target.value))} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Common Rules</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5"><Label>Allow Half Day</Label><p className="text-sm text-muted-foreground">Enable 0.5 day leave requests</p></div>
                                <Switch checked={leavePolicy.allow_half_day} onCheckedChange={(checked) => handlePolicyUpdate("allow_half_day", checked)} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5"><Label>Attachment Required</Label><p className="text-sm text-muted-foreground">Force document upload</p></div>
                                <Switch checked={leavePolicy.attachment_required} onCheckedChange={(checked) => handlePolicyUpdate("attachment_required", checked)} />
                            </div>
                            <div className="space-y-2 border-t pt-2">
                                <div className="flex items-center justify-between"><Label>Allow Carry Forward</Label><Switch checked={leavePolicy.allow_carry_forward} onCheckedChange={(checked) => handlePolicyUpdate("allow_carry_forward", checked)} /></div>
                                {leavePolicy.allow_carry_forward && (
                                    <div className="grid grid-cols-2 gap-2 items-center pl-4 border-l-2"><Label className="text-xs">Max Days</Label><Input type="number" min={0} max={50} className="h-8" value={leavePolicy.max_carry_forward || ""} onChange={(e) => handlePolicyUpdate("max_carry_forward", parseFloat(e.target.value))} /></div>
                                )}
                            </div>
                            <div className="space-y-2 border-t pt-2">
                                <div className="flex items-center justify-between"><Label>Allow Negative Balance</Label><Switch checked={leavePolicy.allow_negative_balance} onCheckedChange={(checked) => handlePolicyUpdate("allow_negative_balance", checked)} /></div>
                                {leavePolicy.allow_negative_balance && (
                                    <div className="grid grid-cols-2 gap-2 items-center pl-4 border-l-2"><Label className="text-xs">Max Days</Label><Input type="number" min={0} max={50} className="h-8" value={leavePolicy.max_negative_balance || ""} onChange={(e) => handlePolicyUpdate("max_negative_balance", parseFloat(e.target.value))} /></div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Leave Type Distribution</CardTitle><Button size="sm" onClick={handleAddDistributionRow}><Plus className="h-4 w-4 mr-1" /> Add Type</Button></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Leave Type</TableHead><TableHead>Allocated Days</TableHead><TableHead>Carry Fwd</TableHead><TableHead>Neg Bal</TableHead><TableHead>Max/Req</TableHead><TableHead></TableHead></TableRow></TableHeader>
                            <TableBody>
                                {leavePolicy.distribution.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                            <Select value={row.leave_type} onValueChange={(val) => handleDistributionUpdate(row.id, "leave_type", val)}>
                                                <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Casual Leave">Casual Leave</SelectItem><SelectItem value="Sick Leave">Sick Leave</SelectItem>
                                                    <SelectItem value="Earned Leave">Earned Leave</SelectItem><SelectItem value="Maternity Leave">Maternity Leave</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell><Input type="number" min={0} max={50} value={row.allocated_days} onChange={(e) => handleDistributionUpdate(row.id, "allocated_days", parseFloat(e.target.value) || 0)} /></TableCell>
                                        <TableCell><Switch checked={row.carry_forward} onCheckedChange={(checked) => handleDistributionUpdate(row.id, "carry_forward", checked)} /></TableCell>
                                        <TableCell><Switch checked={row.negative_balance} onCheckedChange={(checked) => handleDistributionUpdate(row.id, "negative_balance", checked)} /></TableCell>
                                        <TableCell><Input type="number" min={0} max={50} value={row.max_per_request || ""} onChange={(e) => handleDistributionUpdate(row.id, "max_per_request", parseFloat(e.target.value))} /></TableCell>
                                        <TableCell><Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleRemoveDistributionRow(row.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="mt-4 flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                            <span className="font-medium">Total Allocated:</span>
                            <div className="flex items-center gap-2"><span className={cn("text-lg font-bold", isQuotaMatched ? "text-green-600" : "text-red-600")}>{totalAllocated}</span><span className="text-muted-foreground">/ {leavePolicy.annual_quota}</span></div>
                        </div>
                    </CardContent>
                </Card>
            </div >
        );
    };

    const renderFormFields = () => {
        return (
            <div className="grid gap-4 py-4">
                {(selectedMaster !== "LeavePolicy") && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="master-name" className="text-right">Name <span className="text-red-500">*</span></Label>
                        <Input id="master-name" value={formData.name || ""} maxLength={50} onChange={e => setFormData({ ...formData, name: e.target.value })} className="col-span-3" />
                    </div>
                )}
                {selectedMaster === "State" && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="country-select" className="text-right">Country <span className="text-red-500">*</span></Label>
                        <Select value={formData.country} onValueChange={(val) => setFormData({ ...formData, country: val })}>
                            <SelectTrigger className="col-span-3"><SelectValue placeholder="Select Country" /></SelectTrigger>
                            <SelectContent>{masterData["Country"]?.filter(c => c.status === "Active").map(country => (<SelectItem key={country.id} value={country.name}>{country.name}</SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                )}
                {selectedMaster === "City" && (
                    <><div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="country-select" className="text-right">Country <span className="text-red-500">*</span></Label>
                        <Select value={formData.country} onValueChange={(val) => setFormData({ ...formData, country: val, state: undefined })}>
                            <SelectTrigger className="col-span-3"><SelectValue placeholder="Select Country" /></SelectTrigger>
                            <SelectContent>{masterData["Country"]?.filter(c => c.status === "Active").map(country => (<SelectItem key={country.id} value={country.name}>{country.name}</SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="state-select" className="text-right">State <span className="text-red-500">*</span></Label>
                            <Select value={formData.state} onValueChange={(val) => setFormData({ ...formData, state: val })} disabled={!formData.country}>
                                <SelectTrigger className="col-span-3"><SelectValue placeholder={formData.country ? "Select State" : "Select Country first"} /></SelectTrigger>
                                <SelectContent>{masterData["State"]?.filter(s => s.status === "Active" && s.country === formData.country).map(state => (<SelectItem key={state.id} value={state.name}>{state.name}</SelectItem>))}</SelectContent>
                            </Select>
                        </div></>
                )}

                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="status" className="text-right">Status <span className="text-red-500">*</span></Label><Select value={formData.status} onValueChange={(val: "Active" | "Inactive") => setFormData({ ...formData, status: val })}><SelectTrigger className="col-span-3"><SelectValue placeholder="Select Status" /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select></div>
            </div>
        );
    };

    const renderUserRolesForm = () => {
        return (
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role-code" className="text-right">Code <span className="text-red-500">*</span></Label>
                    <Input id="role-code" value={formData.code || ""} maxLength={20} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role-name" className="text-right">Name <span className="text-red-500">*</span></Label>
                    <Input id="role-name" value={formData.name || ""} maxLength={50} onChange={e => setFormData({ ...formData, name: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role-desc" className="text-right">Description</Label>
                    <Textarea id="role-desc" value={formData.description || ""} maxLength={200} onChange={e => setFormData({ ...formData, description: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="status" className="text-right">Status <span className="text-red-500">*</span></Label><Select value={formData.status} onValueChange={(val: "Active" | "Inactive") => setFormData({ ...formData, status: val })}><SelectTrigger className="col-span-3"><SelectValue placeholder="Select Status" /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select></div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 h-full overflow-hidden">
            <div className="flex flex-col gap-2 shrink-0">
                <h1 className="text-3xl font-bold tracking-tight">Core Master</h1>
                <p className="text-muted-foreground">Manage and configure all system master data tables and reference lists.</p>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col min-h-0">
                <div className="border-b border-border shrink-0">
                    <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                        {MASTER_TYPES.filter(type => type !== "LeavePolicy").map(type => (
                            <TabsTrigger key={type} value={MASTER_SLUGS[type]} className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap">
                                {MASTER_LABELS[type]}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <div className="m-0 h-full flex flex-col gap-6 mt-6 overflow-y-auto pr-2 pb-6 custom-scrollbar">
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                        <div className="w-full sm:w-1/3">
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
                            <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder={`Search ${selectedMaster}...`} className="pl-9 h-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                        </div>
                        <div className="w-full sm:w-auto ml-auto">
                            {selectedMaster !== "LeavePolicy" && (<Button onClick={handleAddClick} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Add {selectedMaster}</Button>)}
                        </div>
                    </div>

                    <Card>
                        <CardHeader className="pb-3"><CardTitle>{selectedMaster === "LeavePolicy" ? "Leave Policy Configuration" : `${selectedMaster} List`}</CardTitle></CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader><TableRow className="bg-muted/50">{renderTableHeaders()}<TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {selectedMaster === "LeavePolicy" ? (
                                            <TableRow key={leavePolicy.id}>{renderTableRow(leavePolicy as any)}<TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => setIsDialogOpen(true)}><Pencil className="h-4 w-4" /></Button></div></TableCell></TableRow>
                                        ) : (
                                            currentData.length === 0 ? (<TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No records found for {selectedMaster}.</TableCell></TableRow>) : (
                                                currentData.map((item) => (<TableRow key={item.id}>{renderTableRow(item)}<TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleEditClick(item)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClick(item.id)}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>))
                                            )
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {selectedMaster !== "LeavePolicy" && filteredData.length > 0 && (
                                <DataTablePagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    totalItems={filteredData.length}
                                    itemsPerPage={itemsPerPage}
                                    onPageChange={setCurrentPage}
                                    onItemsPerPageChange={setItemsPerPage}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </Tabs>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className={selectedMaster === "LeavePolicy" ? "sm:max-w-[900px] h-[80vh] flex flex-col p-6" : "sm:max-w-[500px]"}>
                    <DialogHeader>
                        <DialogTitle>{editingId || selectedMaster === "LeavePolicy" ? "Edit" : "Add New"} {selectedMaster === "LeavePolicy" ? "Policy" : selectedMaster}</DialogTitle>
                        <DialogDescription>Configure the details for this {selectedMaster === "LeavePolicy" ? "policy" : "entry"}.</DialogDescription>
                    </DialogHeader>
                    {selectedMaster === "LeavePolicy" ? (<div className="flex-1 overflow-y-auto pr-2 -mr-2">{renderLeavePolicyForm()}</div>) : selectedMaster === "UserRoles" ? renderUserRolesForm() : renderFormFields()}
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={selectedMaster === "LeavePolicy" ? () => { handleSavePolicy(); setIsDialogOpen(false); } : handleSave} disabled={selectedMaster === "LeavePolicy" && (Object.keys(policyErrors).length > 0 || leavePolicy.distribution.reduce((sum, item) => sum + (item.allocated_days || 0), 0) !== leavePolicy.annual_quota)}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function StatusBadge({ status }: { status: "Active" | "Inactive" }) {
    return (<Badge variant={status === "Active" ? "default" : "secondary"} className={status === "Active" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>{status}</Badge>);
}
