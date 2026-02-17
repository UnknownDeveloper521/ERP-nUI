import { useState } from "react";
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
import { Plus, Search, Pencil, Trash2, ChevronsUpDown, Check, ChevronLeft, ChevronRight } from "lucide-react";
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


type MasterType = "Work Centers" | "Machines" | "Operations";

const MASTER_SLUGS: Record<MasterType, string> = {
    "Work Centers": "work-centers",
    "Machines": "machines",
    "Operations": "operations",
};

const MASTER_TYPES: MasterType[] = ["Work Centers", "Machines", "Operations"];

interface WorkCenter {
    id: number;
    code: string;
    name: string;
    description?: string;
    location: string;
    status: "Active" | "Inactive";
    created_at?: string;
    updated_at?: string;
}

interface Machine {
    id: number;
    code: string;
    name: string;
    description?: string;
    work_center_id: number;
    status: "Active" | "Inactive";
    created_at?: string;
    updated_at?: string;
}

interface QCParameter {
    id: number; // temp id
    name: string;
    description: string;
}

interface OperationItem {
    id: number; // temp id
    item_id: number; // mocked item id
    type: "RM" | "SFG" | "FG" | "Waste";
    quantity: number;
}

interface OperationMachine {
    id: number; // temp id
    machine_id: number;
}

interface Operation {
    id: number;
    code: string;
    name: string;
    work_center_id?: number;
    description?: string;
    inputs: OperationItem[]; // RM / SFG
    outputs: OperationItem[]; // SFG / FG / Waste
    machines: OperationMachine[];
    is_qc_required: boolean;
    qc_parameters: QCParameter[];
    status: "Active" | "Inactive";
    created_at?: string;
    updated_at?: string;
}

// Mock Items for Dropdowns
const MOCK_ITEMS = [
    { id: 101, code: "RM001", name: "Steel Sheet", type: "RM", uom: "kg" },
    { id: 102, code: "RM002", name: "Plastic Granules", type: "RM", uom: "kg" },
    { id: 201, code: "SFG001", name: "Molded Part", type: "SFG", uom: "nos" },
    { id: 202, code: "SFG002", name: "Painted Housing", type: "SFG", uom: "nos" },
    { id: 301, code: "FG001", name: "Finished Widget", type: "FG", uom: "nos" },
    { id: 401, code: "WST001", name: "Scrap Metal", type: "Waste", uom: "kg" },
];

// --- Mock Data ---

const initialWorkCenters: WorkCenter[] = [
    { id: 1, code: "WC001", name: "Assembly Line 1", description: "Main assembly line for electronics", location: "Plant A", status: "Active" },
    { id: 2, code: "WC002", name: "Packaging Unit", description: "Final packaging area", location: "Plant B", status: "Active" },
];

const initialMachines: Machine[] = [
    { id: 1, code: "M001", name: "Conveyor Belt A", description: "Main conveyor", work_center_id: 1, status: "Active" },
    { id: 2, code: "M002", name: "Soldering Station 1", description: "Robotic soldering", work_center_id: 1, status: "Active" },
];

const initialOperations: Operation[] = [
    {
        id: 1,
        code: "OP001",
        name: "Molding",
        work_center_id: 1,
        description: "Initial molding process",
        inputs: [{ id: 1, item_id: 102, type: "RM", quantity: 10 }],
        outputs: [{ id: 1, item_id: 201, type: "SFG", quantity: 1 }],
        machines: [{ id: 1, machine_id: 1 }],
        is_qc_required: true,
        qc_parameters: [{ id: 1, name: "Dimensions", description: "Check length and width" }],
        status: "Active"
    }
];

const LOCATIONS = ["Plant A", "Plant B", "Plant C", "Plant D"];

// --- Sub-components for Form Sections ---

const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 pb-2 mb-4 border-b">
        <h3 className="font-semibold text-sm text-primary">{title}</h3>
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
    const [location, setLocation] = useLocation();
    const params = useParams();

    const activeTab = params.tab || "basic";

    const getValidMaster = (type: string | undefined): MasterType => {
        if (type) {
            const entry = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === type);
            if (entry) return entry[0] as MasterType;
        }
        return "Work Centers";
    };

    const selectedMaster = getValidMaster(params.type);

    const [searchTerm, setSearchTerm] = useState("");
    const [open, setOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const updateRoute = (tab: string, type: MasterType) => {
        const slug = MASTER_SLUGS[type] || type.toLowerCase();
        setLocation(`/masters/production/${tab}/${slug}`);
    };

    const handleMasterChange = (newMaster: MasterType) => {
        updateRoute(activeTab, newMaster);
        setSearchTerm("");
        setOpen(false);
        setFilterStatus("All");
        setCurrentPage(1);
    };

    // State for mock data
    const [workCenters, setWorkCenters] = useState<WorkCenter[]>(initialWorkCenters);
    const [machines, setMachines] = useState<Machine[]>(initialMachines);
    const [operations, setOperations] = useState<Operation[]>(initialOperations);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<any>({});

    // Filters
    const [filterStatus, setFilterStatus] = useState<string>("All");

    // Operations UI State
    const [selectedInputId, setSelectedInputId] = useState<string>("");
    const [isInputComboboxOpen, setIsInputComboboxOpen] = useState(false);
    const [selectedInputType, setSelectedInputType] = useState<"RM" | "SFG" | "Waste">("RM");

    const [selectedOutputId, setSelectedOutputId] = useState<string>("");
    const [isOutputComboboxOpen, setIsOutputComboboxOpen] = useState(false);
    const [selectedOutputType, setSelectedOutputType] = useState<"SFG" | "FG" | "Waste">("SFG");

    const [selectedMachineId, setSelectedMachineId] = useState<string>("");
    const [isMachineComboboxOpen, setIsMachineComboboxOpen] = useState(false);

    // --- Helpers ---

    const getData = () => {
        if (selectedMaster === "Work Centers") return workCenters;
        if (selectedMaster === "Machines") return machines;
        if (selectedMaster === "Operations") return operations;
        return [];
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

    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    const paginatedData = currentData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleAddClick = () => {
        setEditingId(null);
        // Reset Operations State
        setSelectedInputId("");
        setSelectedOutputId("");

        if (selectedMaster === "Work Centers") {
            setFormData({
                status: "Active",
                location: "Plant A",
            });
        } else if (selectedMaster === "Machines") {
            setFormData({
                status: "Active",
                work_center_id: workCenters.length > 0 ? workCenters[0].id.toString() : "",
            });
        } else if (selectedMaster === "Operations") {
            setFormData({
                status: "Active",
                is_qc_required: false,
                inputs: [],
                outputs: [],
                machines: [],
                qc_parameters: [],
            });
        }
        setIsDialogOpen(true);
    };

    const handleEditClick = (item: any) => {
        setEditingId(item.id);
        // Reset Operations State
        setSelectedInputId("");
        setSelectedOutputId("");
        setSelectedMachineId("");

        const data = { ...item };
        if (selectedMaster === "Machines") {
            data.work_center_id = item.work_center_id?.toString();
        } else if (selectedMaster === "Operations") {
            data.work_center_id = item.work_center_id?.toString();
            // machine_id is no longer a single field on Operation
        }
        setFormData(data);
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (id: number) => {
        if (confirm("Are you sure? This action cannot be undone.")) {
            if (selectedMaster === "Work Centers") {
                // Check if used in machines
                if (machines.some(m => m.work_center_id === id)) {
                    toast({ variant: "destructive", title: "Cannot Delete", description: "Work Center is used in Machines." });
                    return;
                }
                setWorkCenters(prev => prev.filter(item => item.id !== id));
            } else if (selectedMaster === "Machines") {
                // Check if used in operations
                if (operations.some(o => o.machines?.some(m => m.machine_id === id))) {
                    toast({ variant: "destructive", title: "Cannot Delete", description: "Machine is used in Operations." });
                    return;
                }
                setMachines(prev => prev.filter(item => item.id !== id));
            } else if (selectedMaster === "Operations") {
                setOperations(prev => prev.filter(item => item.id !== id));
            }
            toast({ title: "Deleted", description: "Record deleted successfully." });
        }
    };

    const handleSave = () => {
        const now = new Date().toISOString();

        if (selectedMaster === "Work Centers") {
            if (!formData.code || !formData.name || !formData.status || !formData.location) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }
            // Unique Code Check
            if (workCenters.some(w => w.id !== editingId && w.code.toLowerCase() === formData.code.toLowerCase())) {
                toast({ variant: "destructive", title: "Validation Error", description: "Work Center Code must be unique." });
                return;
            }

            if (editingId) {
                setWorkCenters(prev => prev.map(item => item.id === editingId ? { ...item, ...formData, updated_at: now } as WorkCenter : item));
                toast({ title: "Updated", description: "Work Center updated successfully" });
            } else {
                const newId = Math.max(...workCenters.map(v => v.id), 0) + 1;
                const newItem = { ...formData, id: newId, created_at: now } as WorkCenter;
                setWorkCenters(prev => [...prev, newItem]);
                toast({ title: "Created", description: "Work Center created successfully" });
            }
        } else if (selectedMaster === "Machines") {
            if (!formData.code || !formData.name || !formData.status || !formData.work_center_id) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }
            // Unique Code Check
            if (machines.some(m => m.id !== editingId && m.code.toLowerCase() === formData.code.toLowerCase())) {
                toast({ variant: "destructive", title: "Validation Error", description: "Machine Code must be unique." });
                return;
            }

            const machineData = { ...formData, work_center_id: parseInt(formData.work_center_id) };

            if (editingId) {
                setMachines(prev => prev.map(item => item.id === editingId ? { ...item, ...machineData, updated_at: now } as Machine : item));
                toast({ title: "Updated", description: "Machine updated successfully" });
            } else {
                const newId = Math.max(...machines.map(v => v.id), 0) + 1;
                const newItem = { ...machineData, id: newId, created_at: now } as Machine;
                setMachines(prev => [...prev, newItem]);
                toast({ title: "Created", description: "Machine created successfully" });
            }
        } else if (selectedMaster === "Operations") {
            if (!formData.code || !formData.name || !formData.status) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }
            // Unique Code Check
            if (operations.some(o => o.id !== editingId && o.code.toLowerCase() === formData.code.toLowerCase())) {
                toast({ variant: "destructive", title: "Validation Error", description: "Operation Code must be unique." });
                return;
            }

            const opData = {
                ...formData,
                work_center_id: formData.work_center_id ? parseInt(formData.work_center_id) : undefined,
                // machine_id removed
            };

            if (editingId) {
                setOperations(prev => prev.map(item => item.id === editingId ? { ...item, ...opData, updated_at: now } as Operation : item));
                toast({ title: "Updated", description: "Operation updated successfully" });
            } else {
                const newId = Math.max(...operations.map(v => v.id), 0) + 1;
                const newItem = { ...opData, id: newId, created_at: now } as Operation;
                setOperations(prev => [...prev, newItem]);
                toast({ title: "Created", description: "Operation created successfully" });
            }
        }
        setIsDialogOpen(false);
    };

    // --- Dynamic Form Handlers (Operations) ---
    const addOperationItem = (type: "inputs" | "outputs") => {
        const itemId = type === "inputs" ? selectedInputId : selectedOutputId;
        if (!itemId) return;

        const newItem: OperationItem = {
            id: Date.now(),
            item_id: parseInt(itemId),
            type: type === "inputs" ? selectedInputType : selectedOutputType,
            quantity: 0
        };

        setFormData({ ...formData, [type]: [...(formData[type] || []), newItem] });

        // Reset selection
        if (type === "inputs") {
            setSelectedInputId("");
            setIsInputComboboxOpen(false);
        } else {
            setSelectedOutputId("");
            setIsOutputComboboxOpen(false);
        }
    };

    const removeOperationItem = (type: "inputs" | "outputs", id: number) => {
        setFormData({ ...formData, [type]: formData[type].filter((i: any) => i.id !== id) });
    };

    const updateOperationItem = (type: "inputs" | "outputs", id: number, field: string, value: any) => {
        setFormData({
            ...formData,
            [type]: formData[type].map((i: any) => i.id === id ? { ...i, [field]: value } : i)
        });
    };

    const addOperationMachine = () => {
        if (!selectedMachineId) return;

        const newMachine: OperationMachine = {
            id: Date.now(),
            machine_id: parseInt(selectedMachineId)
        };

        setFormData({ ...formData, machines: [...(formData.machines || []), newMachine] });
        setSelectedMachineId("");
        setIsMachineComboboxOpen(false);
    };

    const removeOperationMachine = (id: number) => {
        setFormData({ ...formData, machines: formData.machines.filter((m: any) => m.id !== id) });
    };

    const addQCParam = () => {
        const newParam: QCParameter = { id: Date.now(), name: "", description: "" };
        setFormData({ ...formData, qc_parameters: [...(formData.qc_parameters || []), newParam] });
    };

    const removeQCParam = (id: number) => {
        setFormData({ ...formData, qc_parameters: formData.qc_parameters.filter((p: any) => p.id !== id) });
    };

    const updateQCParam = (id: number, field: string, value: string) => {
        setFormData({
            ...formData,
            qc_parameters: formData.qc_parameters.map((p: any) => p.id === id ? { ...p, [field]: value } : p)
        });
    };


    // --- Renderers ---

    const renderTable = () => {
        if (selectedMaster === "Work Centers") {
            // ... (Work Centers table code from previous step)
            return (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Code</TableHead>
                            <TableHead>Work Center Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No work centers found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.code}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">{item.description || "-"}</TableCell>
                                    <TableCell>{item.location}</TableCell>
                                    <TableCell><StatusBadge status={item.status} /></TableCell>
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
            );
        } else if (selectedMaster === "Machines") {
            // ... (Machines table code from previous step)
            return (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Code</TableHead>
                            <TableHead>Machine Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Work Center</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length === 0 ? (
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
                                        <TableCell className="font-medium">{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="max-w-[200px] truncate">{item.description || "-"}</TableCell>
                                        <TableCell>{wc ? wc.name : "Unknown"}</TableCell>
                                        <TableCell><StatusBadge status={item.status} /></TableCell>
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
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            );
        } else if (selectedMaster === "Operations") {
            return (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Code</TableHead>
                            <TableHead>Operation Name</TableHead>
                            <TableHead>Work Center</TableHead>
                            <TableHead>QC Req</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No operations found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => {
                                const wc = workCenters.find(w => w.id === item.work_center_id);
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{wc ? wc.name : "-"}</TableCell>
                                        <TableCell>{item.is_qc_required ? <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">Yes</Badge> : "No"}</TableCell>
                                        <TableCell><StatusBadge status={item.status} /></TableCell>
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
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            );
        }
    };

    const renderForm = () => {
        if (selectedMaster === "Work Centers") {
            // ... (Work Centers form code)
            return (
                <div className="grid gap-6 py-4 px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Code *</Label>
                            <Input id="code" value={formData.code || ""} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ex: WC001" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input id="name" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Assembly Line 1" />
                        </div>
                        <div className="space-y-2">
                            <Label>Location *</Label>
                            <Select value={formData.location} onValueChange={(val: any) => setFormData({ ...formData, location: val })}>
                                <SelectTrigger><SelectValue placeholder="Select Location" /></SelectTrigger>
                                <SelectContent>
                                    {LOCATIONS.map(loc => (
                                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status *</Label>
                            <Select value={formData.status} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                                <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" value={formData.description || ""} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Work center description..." />
                        </div>
                    </div>
                </div>
            );
        } else if (selectedMaster === "Machines") {
            // ... (Machines form code)
            return (
                <div className="grid gap-6 py-4 px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Code *</Label>
                            <Input id="code" value={formData.code || ""} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ex: M001" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input id="name" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Machine Name" />
                        </div>
                        <div className="space-y-2">
                            <Label>Work Center *</Label>
                            <Select value={formData.work_center_id} onValueChange={(val: any) => setFormData({ ...formData, work_center_id: val })}>
                                <SelectTrigger><SelectValue placeholder="Select Work Center" /></SelectTrigger>
                                <SelectContent>
                                    {workCenters.map(wc => (
                                        <SelectItem key={wc.id} value={wc.id.toString()}>{wc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status *</Label>
                            <Select value={formData.status} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                                <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" value={formData.description || ""} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Machine description..." />
                        </div>
                    </div>
                </div>
            );
        } else if (selectedMaster === "Operations") {
            return (
                <div className="grid gap-6 py-4 px-1">
                    {/* Basic Info */}
                    <SectionHeader title="Basic Info" />
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="code">Code *</Label>
                            <Input id="code" value={formData.code || ""} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ex: OP001" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input id="name" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Operation Name" />
                        </div>
                        <div className="space-y-2">
                            <Label>Work Center</Label>
                            <Select value={formData.work_center_id} onValueChange={(val: any) => setFormData({ ...formData, work_center_id: val })}>
                                <SelectTrigger><SelectValue placeholder="Select Work Center" /></SelectTrigger>
                                <SelectContent>
                                    {workCenters.map(wc => (
                                        <SelectItem key={wc.id} value={wc.id.toString()}>{wc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Status *</Label>
                            <Select value={formData.status} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                                <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" value={formData.description || ""} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Operation description..." />
                        </div>
                    </div>

                    {/* Inputs Section */}
                    <div className="mt-8">
                        <SectionHeader title="Inputs (RM / SFG / Waste)" />

                        {/* Add Input Control */}
                        <div className="flex gap-4 items-end mb-4">
                            <div className="w-[120px] space-y-2">
                                <Label>Input Type</Label>
                                <Select value={selectedInputType} onValueChange={(val: any) => {
                                    setSelectedInputType(val);
                                    setSelectedInputId(""); // Reset item selection when type changes
                                }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="RM">RM</SelectItem>
                                        <SelectItem value="SFG">SFG</SelectItem>
                                        <SelectItem value="Waste">Waste</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex-1 space-y-2">
                                <Label>Select Input Item</Label>
                                <Popover open={isInputComboboxOpen} onOpenChange={setIsInputComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isInputComboboxOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            {selectedInputId
                                                ? MOCK_ITEMS.find((item) => item.id.toString() === selectedInputId)?.name
                                                : "Choose Item..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                        <Command>
                                            <CommandInputBorderless placeholder="Search item..." />
                                            <CommandList>
                                                <CommandEmpty>No item found.</CommandEmpty>
                                                <CommandGroup>
                                                    {MOCK_ITEMS.filter(i => i.type === selectedInputType).map((item) => {
                                                        const isAdded = formData.inputs?.some((vi: any) => vi.item_id === item.id);
                                                        return (
                                                            <CommandItem
                                                                key={item.id}
                                                                value={item.name}
                                                                onSelect={() => {
                                                                    if (!isAdded) {
                                                                        setSelectedInputId(item.id.toString());
                                                                        setIsInputComboboxOpen(false);
                                                                    }
                                                                }}
                                                                disabled={isAdded}
                                                                className={isAdded ? "opacity-50 cursor-not-allowed" : ""}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        selectedInputId === item.id.toString() ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {item.code} - {item.name} ({item.type})
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <Button onClick={() => addOperationItem("inputs")} disabled={!selectedInputId}>
                                <Plus className="h-4 w-4 mr-2" /> Add
                            </Button>
                        </div>

                        {/* Inputs Table */}
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Item Details</TableHead>
                                        <TableHead className="w-[100px]">UOM</TableHead>
                                        <TableHead className="w-[100px]">Type</TableHead>
                                        <TableHead className="w-[120px]">Quantity</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(!formData.inputs || formData.inputs.length === 0) ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                No inputs configured.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        formData.inputs.map((item: any) => {
                                            const originalItem = MOCK_ITEMS.find(i => i.id === item.item_id);
                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{originalItem?.name}</div>
                                                        <div className="text-xs text-muted-foreground">{originalItem?.code}</div>
                                                    </TableCell>
                                                    <TableCell>{originalItem?.uom}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="text-[10px]">{item.type}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            className="h-8 w-20"
                                                            value={item.quantity || 0}
                                                            onChange={(e) => updateOperationItem("inputs", item.id, "quantity", Math.max(0, parseFloat(e.target.value) || 0))}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeOperationItem("inputs", item.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Outputs Section */}
                    <div className="mt-10">
                        <SectionHeader title="Outputs (SFG / FG / Waste)" />

                        {/* Add Output Control */}
                        <div className="flex gap-4 items-end mb-4">
                            <div className="w-[120px] space-y-2">
                                <Label>Output Type</Label>
                                <Select value={selectedOutputType} onValueChange={(val: any) => {
                                    setSelectedOutputType(val);
                                    setSelectedOutputId(""); // Reset item on type change
                                }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SFG">SFG</SelectItem>
                                        <SelectItem value="FG">FG</SelectItem>
                                        <SelectItem value="Waste">Waste</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex-1 space-y-2">
                                <Label>Select Output Item</Label>
                                <Popover open={isOutputComboboxOpen} onOpenChange={setIsOutputComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isOutputComboboxOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            {selectedOutputId
                                                ? MOCK_ITEMS.find((item) => item.id.toString() === selectedOutputId)?.name
                                                : "Choose Item..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                        <Command>
                                            <CommandInputBorderless placeholder="Search item..." />
                                            <CommandList>
                                                <CommandEmpty>No item found.</CommandEmpty>
                                                <CommandGroup>
                                                    {MOCK_ITEMS.filter(i => i.type === selectedOutputType).map((item) => {
                                                        const isAdded = formData.outputs?.some((vi: any) => vi.item_id === item.id);
                                                        return (
                                                            <CommandItem
                                                                key={item.id}
                                                                value={item.name}
                                                                onSelect={() => {
                                                                    if (!isAdded) {
                                                                        setSelectedOutputId(item.id.toString());
                                                                        setIsOutputComboboxOpen(false);
                                                                    }
                                                                }}
                                                                disabled={isAdded}
                                                                className={isAdded ? "opacity-50 cursor-not-allowed" : ""}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        selectedOutputId === item.id.toString() ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {item.code} - {item.name} ({item.type})
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <Button onClick={() => addOperationItem("outputs")} disabled={!selectedOutputId}>
                                <Plus className="h-4 w-4 mr-2" /> Add
                            </Button>
                        </div>

                        {/* Outputs Table */}
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Item Details</TableHead>
                                        <TableHead className="w-[100px]">UOM</TableHead>
                                        <TableHead className="w-[100px]">Type</TableHead>
                                        <TableHead className="w-[120px]">Quantity</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(!formData.outputs || formData.outputs.length === 0) ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                No outputs configured.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        formData.outputs.map((item: any) => {
                                            const originalItem = MOCK_ITEMS.find(i => i.id === item.item_id);
                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{originalItem?.name}</div>
                                                        <div className="text-xs text-muted-foreground">{originalItem?.code}</div>
                                                    </TableCell>
                                                    <TableCell>{originalItem?.uom}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="text-[10px]">{item.type}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            className="h-8 w-20"
                                                            value={item.quantity || 0}
                                                            onChange={(e) => updateOperationItem("outputs", item.id, "quantity", Math.max(0, parseFloat(e.target.value) || 0))}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeOperationItem("outputs", item.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Machines Section */}
                    <div className="mt-10">
                        <SectionHeader title="Machines" />

                        {/* Add Machine Control */}
                        <div className="flex gap-4 items-end mb-4">
                            <div className="flex-1 space-y-2">
                                <Label>Select Machine</Label>
                                <Popover open={isMachineComboboxOpen} onOpenChange={setIsMachineComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isMachineComboboxOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            {selectedMachineId
                                                ? machines.find((item) => item.id.toString() === selectedMachineId)?.name
                                                : "Choose Machine..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                        <Command>
                                            <CommandInputBorderless placeholder="Search machine..." />
                                            <CommandList>
                                                <CommandEmpty>No machine found.</CommandEmpty>
                                                <CommandGroup>
                                                    {machines
                                                        .filter(m => !formData.work_center_id || m.work_center_id.toString() === formData.work_center_id)
                                                        .map((item) => {
                                                            const isAdded = formData.machines?.some((m: any) => m.machine_id === item.id);
                                                            return (
                                                                <CommandItem
                                                                    key={item.id}
                                                                    value={item.name}
                                                                    onSelect={() => {
                                                                        if (!isAdded) {
                                                                            setSelectedMachineId(item.id.toString());
                                                                            setIsMachineComboboxOpen(false);
                                                                        }
                                                                    }}
                                                                    disabled={isAdded}
                                                                    className={isAdded ? "opacity-50 cursor-not-allowed" : ""}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            selectedMachineId === item.id.toString() ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {item.code} - {item.name}
                                                                </CommandItem>
                                                            );
                                                        })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <Button onClick={addOperationMachine} disabled={!selectedMachineId}>
                                <Plus className="h-4 w-4 mr-2" /> Add
                            </Button>
                        </div>

                        {/* Machines Table */}
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Machine Details</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(!formData.machines || formData.machines.length === 0) ? (
                                        <TableRow>
                                            <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                                                No machines configured.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        formData.machines.map((item: any) => {
                                            const originalItem = machines.find(m => m.id === item.machine_id);
                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{originalItem?.name}</div>
                                                        <div className="text-xs text-muted-foreground">{originalItem?.code}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeOperationMachine(item.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* QC Section */}
                    <div className="flex items-center gap-2 mt-6 mb-2">
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="is_qc_required"
                                checked={formData.is_qc_required || false}
                                onChange={(e) => setFormData({ ...formData, is_qc_required: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="is_qc_required" className="font-semibold text-sm text-primary">Is QC Required?</Label>
                        </div>
                    </div>

                    {formData.is_qc_required && (
                        <div className="bg-muted/30 p-4 rounded-md border">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-medium">QC Parameters</h4>
                                <Button variant="secondary" size="sm" onClick={addQCParam}><Plus className="h-4 w-4 mr-1" /> Add Parameter</Button>
                            </div>
                            <div className="space-y-4">
                                {formData.qc_parameters?.map((param: any, index: number) => (
                                    <div key={param.id} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-start">
                                        <Input
                                            placeholder="Parameter Name"
                                            value={param.name}
                                            onChange={(e) => updateQCParam(param.id, "name", e.target.value)}
                                        />
                                        <Input
                                            placeholder="Check Description"
                                            value={param.description}
                                            onChange={(e) => updateQCParam(param.id, "description", e.target.value)}
                                        />
                                        <Button variant="ghost" size="icon" className="text-destructive h-9 w-9" onClick={() => removeQCParam(param.id)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                                {(!formData.qc_parameters || formData.qc_parameters.length === 0) && <p className="text-sm text-muted-foreground italic">No parameters defined.</p>}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
    };

    // ... (rest of the code)


    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Production Masters</h1>
                <p className="text-muted-foreground">
                    Manage work centers, machines, and production configurations.
                </p>
            </div>

            <Tabs defaultValue="basic" value={activeTab} className="w-full flex-1 flex flex-col">
                <div className="border-b border-border">
                    <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                        <TabsTrigger
                            value="basic"
                            onClick={() => updateRoute("basic", "Work Centers")}
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                        >
                            Basic
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="basic" className="m-0 h-full flex flex-col gap-6 mt-6">
                    {/* Top Control Bar */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">

                        {/* Master Type Selection */}
                        <div className="w-full sm:w-1/4">
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Select Master Type
                            </Label>
                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={open}
                                        className="w-full justify-between h-10 font-medium"
                                    >
                                        {selectedMaster}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="p-0"
                                    style={{ width: "var(--radix-popover-trigger-width)" }}
                                    align="start"
                                >
                                    <Command>
                                        <CommandInputBorderless placeholder="Search master type..." />
                                        <CommandList>
                                            <CommandEmpty>No master type found.</CommandEmpty>
                                            <CommandGroup>
                                                {MASTER_TYPES.map((type) => (
                                                    <CommandItem
                                                        key={type}
                                                        value={type}
                                                        onSelect={(currentValue) => {
                                                            const selected = MASTER_TYPES.find(t => t.toLowerCase() === currentValue.toLowerCase());
                                                            if (selected) handleMasterChange(selected);
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

                        {/* Status Filter */}
                        <div className="w-full sm:w-1/6">
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Status
                            </Label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="h-10"><SelectValue placeholder="All Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All">All Status</SelectItem>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>


                        <div className="w-full sm:w-1/4">
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Search
                            </Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by code, name..."
                                    className="pl-9 h-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="w-full sm:w-auto ml-auto mt-auto pt-5">
                            <Button onClick={handleAddClick} className="w-full sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" />
                                Add {selectedMaster === "Work Centers" ? "Work Center" : "Record"}
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
                                {renderTable()}
                            </div>
                            
                            {/* Pagination */}
                            <div className="flex justify-between items-center px-1 mt-4">
                                <div className="text-sm text-muted-foreground">
                                    Showing {currentData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, currentData.length)} of {currentData.length} entries
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
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Universal Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle>{editingId ? "Edit" : "Add New"} {selectedMaster === "Work Centers" ? "Work Center" : "Record"}</DialogTitle>
                        <DialogDescription>
                            Configure the details for this {selectedMaster === "Work Centers" ? "work center" : "record"}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6">
                        {renderForm()}
                    </div>

                    <DialogFooter className="p-6 pt-2 border-t mt-auto text-right">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="mr-2">Cancel</Button>
                        <Button onClick={handleSave} disabled={(() => {
                            if (selectedMaster === "Work Centers") {
                                return !formData.code || !formData.name;
                            } else if (selectedMaster === "Machines") {
                                return !formData.code || !formData.name || !formData.work_center_id;
                            } else if (selectedMaster === "Operations") {
                                return !formData.code || !formData.name ||
                                    (!formData.inputs || formData.inputs.length === 0) ||
                                    (!formData.outputs || formData.outputs.length === 0) ||
                                    (!formData.machines || formData.machines.length === 0);
                            }
                            return false;
                        })()}>
                            Save Changes
                        </Button>
                    </DialogFooter>

                </DialogContent>
            </Dialog>
        </div >
    );
}
