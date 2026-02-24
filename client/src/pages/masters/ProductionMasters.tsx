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
    linked_operations?: number[]; // IDs of linked operations
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


interface Item {
    id: number;
    code: string;
    name: string;
    type: "RM" | "SFG" | "FG" | "Waste" | "Consumable";
    uom: string;
}

interface OperationItem {
    id: number;
    item_id: number;
    type: "RM" | "SFG" | "FG" | "Waste" | "Consumable";
    quantity: number;
}

interface QCParameter {
    id: number;
    name: string;
    description: string;
}

interface Operation {
    id: number;
    code: string;
    name: string;
    description?: string;
    inputs: OperationItem[];
    outputs: OperationItem[];
    is_qc_required: boolean;
    is_qc_required_batch_wise: boolean;
    qc_parameters: QCParameter[];
    status: "Active" | "Inactive";
    created_at?: string;
    updated_at?: string;
}

// --- Mock Data ---

const MOCK_ITEMS: Item[] = [
    { id: 101, code: "RM001", name: "Steel Sheet", type: "RM", uom: "Sheet" },
    { id: 102, code: "RM002", name: "Plastic Granules", type: "RM", uom: "Kg" },
    { id: 103, code: "RM003", name: "Paint", type: "Consumable", uom: "Ltr" },
    { id: 201, code: "SFG001", name: "Molded Body", type: "SFG", uom: "Nos" },
    { id: 202, code: "SFG002", name: "Metal Frame", type: "SFG", uom: "Nos" },
    { id: 301, code: "FG001", name: "Finished Chair", type: "FG", uom: "Nos" },
    { id: 401, code: "W001", name: "Scrap Metal", type: "Waste", uom: "Kg" },
    { id: 402, code: "W002", name: "Plastic Waste", type: "Waste", uom: "Kg" },
];

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
        description: "Initial molding process",
        inputs: [{ id: 1, item_id: 102, type: "RM", quantity: 10 }],
        outputs: [{ id: 1, item_id: 201, type: "SFG", quantity: 1 }],
        is_qc_required: true,
        is_qc_required_batch_wise: false,
        qc_parameters: [{ id: 1, name: "Dimensions", description: "Check length and width" }],
        status: "Active"
    },
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

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<any>({});

    // Filters
    const [filterStatus, setFilterStatus] = useState<string>("All");

    const [isLocationComboboxOpen, setIsLocationComboboxOpen] = useState(false);
    const [isMachineWCComboboxOpen, setIsMachineWCComboboxOpen] = useState(false);

    // Operations State
    const [operations, setOperations] = useState<Operation[]>(initialOperations);
    const [selectedInputId, setSelectedInputId] = useState<string>("");
    const [isInputComboboxOpen, setIsInputComboboxOpen] = useState(false);
    const [selectedInputType, setSelectedInputType] = useState<"RM" | "SFG" | "FG" | "Waste" | "Consumable">("RM");

    const [selectedOutputId, setSelectedOutputId] = useState<string>("");
    const [isOutputComboboxOpen, setIsOutputComboboxOpen] = useState(false);
    const [selectedOutputType, setSelectedOutputType] = useState<"RM" | "SFG" | "FG" | "Waste" | "Consumable">("SFG");

    const [isOpWCComboboxOpen, setIsOpWCComboboxOpen] = useState(false);

    // Work Center Operations State
    const [selectedWCOpId, setSelectedWCOpId] = useState<string>("");
    const [isWCOpComboboxOpen, setIsWCOpComboboxOpen] = useState(false);



    // --- Helpers ---

    const getData = () => {
        if (selectedMaster === "Work Centers") return workCenters;
        if (selectedMaster === "Machines") return machines;
        if (selectedMaster === "Operations") return operations;
        return [];
    };

    const addOperationItem = (type: "inputs" | "outputs") => {
        const itemId = type === "inputs" ? selectedInputId : selectedOutputId;
        const itemType = type === "inputs" ? selectedInputType : selectedOutputType;

        if (!itemId) return;

        const newItem: OperationItem = {
            id: Math.random(), // Temp ID
            item_id: parseInt(itemId),
            type: itemType,
            quantity: 0
        };

        setFormData((prev: any) => ({
            ...prev,
            [type]: [...(prev[type] || []), newItem]
        }));

        if (type === "inputs") {
            setSelectedInputId("");
            setIsInputComboboxOpen(false);
        } else {
            setSelectedOutputId("");
            setIsOutputComboboxOpen(false);
        }
    };

    const removeOperationItem = (type: "inputs" | "outputs", id: number) => {
        setFormData((prev: any) => ({
            ...prev,
            [type]: prev[type].filter((item: OperationItem) => item.id !== id)
        }));
    };

    const updateOperationItem = (type: "inputs" | "outputs", id: number, field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            [type]: prev[type].map((item: OperationItem) =>
                item.id === id ? { ...item, [field]: value } : item
            )
        }));
    };

    const addQCParam = () => {
        const newParam: QCParameter = {
            id: Math.random(),
            name: "",
            description: ""
        };
        setFormData((prev: any) => ({
            ...prev,
            qc_parameters: [...(prev.qc_parameters || []), newParam]
        }));
    };

    const removeQCParam = (id: number) => {
        setFormData((prev: any) => ({
            ...prev,
            qc_parameters: prev.qc_parameters.filter((p: QCParameter) => p.id !== id)
        }));
    };

    const updateQCParam = (id: number, field: string, value: string) => {
        setFormData((prev: any) => ({
            ...prev,
            qc_parameters: prev.qc_parameters.map((p: QCParameter) =>
                p.id === id ? { ...p, [field]: value } : p
            )
        }));
    };

    const addWCOperation = () => {
        if (!selectedWCOpId) return;
        const opId = parseInt(selectedWCOpId);

        // Prevent duplicates
        if (formData.linked_operations?.includes(opId)) {
            toast({ variant: "destructive", title: "Duplicate", description: "Operation already added." });
            return;
        }

        setFormData((prev: any) => ({
            ...prev,
            linked_operations: [...(prev.linked_operations || []), opId]
        }));
        setSelectedWCOpId("");
        setIsWCOpComboboxOpen(false);
    };

    const removeWCOperation = (opId: number) => {
        setFormData((prev: any) => ({
            ...prev,
            linked_operations: prev.linked_operations.filter((id: number) => id !== opId)
        }));
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
                is_qc_required_batch_wise: false,
                inputs: [],
                outputs: [],
                qc_parameters: [],
            });
        }
        setIsDialogOpen(true);
    };

    const handleEditClick = (item: any) => {
        setEditingId(item.id);

        const data = { ...item };
        if (item.work_center_id !== undefined && item.work_center_id !== null) {
            data.work_center_id = String(item.work_center_id);
        }
        if (selectedMaster === "Work Centers") {
            data.linked_operations = item.linked_operations || [];
        }
        if (selectedMaster === "Operations") {
            data.inputs = item.inputs || [];
            data.outputs = item.outputs || [];
            data.qc_parameters = item.qc_parameters || [];
            data.is_qc_required = item.is_qc_required || false;
            data.is_qc_required_batch_wise = item.is_qc_required_batch_wise || false;
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
            if (operations.some(o => o.id !== editingId && o.code.toLowerCase() === formData.code.toLowerCase())) {
                toast({ variant: "destructive", title: "Validation Error", description: "Operation Code must be unique." });
                return;
            }
            // Validate Inputs/Outputs
            if (!formData.inputs?.length && !formData.outputs?.length) {
                toast({ variant: "destructive", title: "Validation Error", description: "At least one Input or Output is required." });
                return;
            }

            const operationData = { ...formData };

            if (editingId) {
                setOperations(prev => prev.map(item => item.id === editingId ? { ...item, ...operationData, updated_at: now } as Operation : item));
                toast({ title: "Updated", description: "Operation updated successfully" });
            } else {
                const newId = Math.max(...operations.map(v => v.id), 0) + 1;
                const newItem = { ...operationData, id: newId, created_at: now } as Operation;
                setOperations(prev => [...prev, newItem]);
                toast({ title: "Created", description: "Operation created successfully" });
            }
        }
        setIsDialogOpen(false);
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
                            <TableHead className="text-center">QC Required</TableHead>
                            <TableHead className="text-center">Batchwise Tracking</TableHead>
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
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-center">
                                            {item.is_qc_required ? (
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">Yes</Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">No</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {item.is_qc_required_batch_wise ? (
                                                <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">Yes</Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">No</span>
                                            )}
                                        </TableCell>
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
                            <Popover open={isLocationComboboxOpen} onOpenChange={setIsLocationComboboxOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isLocationComboboxOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        {formData.location
                                            ? formData.location
                                            : "Select Location..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                    <Command className="h-auto overflow-visible">
                                        <CommandInputBorderless placeholder="Search location..." />
                                        <CommandList className="max-h-[130px] overflow-y-auto">
                                            <CommandEmpty>No location found.</CommandEmpty>
                                            <CommandGroup>
                                                {LOCATIONS.map((loc) => (
                                                    <CommandItem
                                                        key={loc}
                                                        value={loc}
                                                        onSelect={(currentValue) => {
                                                            setFormData({ ...formData, location: currentValue });
                                                            setIsLocationComboboxOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                formData.location === loc ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {loc}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
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

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-blue-600">Operations</h4>
                        </div>

                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Popover open={isWCOpComboboxOpen} onOpenChange={setIsWCOpComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" aria-expanded={isWCOpComboboxOpen} className="w-full justify-between font-normal">
                                            {selectedWCOpId
                                                ? operations.find((op) => op.id.toString() === selectedWCOpId)?.name
                                                : "Choose Operation..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                        <Command>
                                            <CommandInputBorderless placeholder="Search operation..." />
                                            <CommandList className="max-h-[150px] overflow-y-auto">
                                                <CommandEmpty>No operation found.</CommandEmpty>
                                                <CommandGroup>
                                                    {operations.map((op) => {
                                                        const isSelected = formData.linked_operations?.includes(op.id);
                                                        return (
                                                            <CommandItem
                                                                key={op.id}
                                                                value={op.name}
                                                                disabled={isSelected}
                                                                onSelect={() => {
                                                                    if (!isSelected) {
                                                                        setSelectedWCOpId(op.id.toString());
                                                                        setIsWCOpComboboxOpen(false);
                                                                    }
                                                                }}
                                                                className={cn(isSelected && "opacity-50 cursor-not-allowed")}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", selectedWCOpId === op.id.toString() ? "opacity-100" : "opacity-0")} />
                                                                {op.code} - {op.name}
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <Button onClick={addWCOperation}><Plus className="h-4 w-4 mr-2" /> Add</Button>
                        </div>

                        <div className="rounded-md border p-2 bg-muted/20 min-h-[100px]">
                            <Label className="mb-2 block text-xs text-muted-foreground ml-1">Operation Details</Label>
                            {!formData.linked_operations?.length ? (
                                <div className="text-sm text-muted-foreground text-center py-8">No operations linked</div>
                            ) : (
                                <div className="space-y-2">
                                    {formData.linked_operations.map((opId: number) => {
                                        const op = operations.find(o => o.id === opId);
                                        if (!op) return null;
                                        return (
                                            <div key={opId} className="flex items-center justify-between p-2 bg-white rounded border hover:bg-slate-50 transition-colors">
                                                <div>
                                                    <div className="font-medium text-sm">{op.name}</div>
                                                    <div className="text-xs text-muted-foreground">{op.code}</div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => removeWCOperation(opId)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
                            <Popover open={isMachineWCComboboxOpen} onOpenChange={setIsMachineWCComboboxOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isMachineWCComboboxOpen}
                                        className="w-full justify-between font-normal"
                                    >
                                        {formData.work_center_id
                                            ? workCenters.find((wc) => wc.id.toString() === formData.work_center_id)?.name
                                            : "Select Work Center..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                    <Command className="h-auto overflow-visible">
                                        <CommandInputBorderless placeholder="Search work center..." />
                                        <CommandList className="max-h-[130px] overflow-y-auto">
                                            <CommandEmpty>No work center found.</CommandEmpty>
                                            <CommandGroup>
                                                {workCenters.map((wc) => (
                                                    <CommandItem
                                                        key={wc.id}
                                                        value={wc.name}
                                                        onSelect={() => {
                                                            setFormData({ ...formData, work_center_id: wc.id.toString() });
                                                            setIsMachineWCComboboxOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                formData.work_center_id === wc.id.toString() ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {wc.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
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
                    <div>
                        <SectionHeader title="Basic Info" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Code *</Label>
                                <Input id="code" value={formData.code || ""} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ex: OP001" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Name *</Label>
                                <Input id="name" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Operation Name" />
                            </div>
                            <div className="space-y-2">
                                <Label>Status *</Label>
                                <Select value={formData.status || ""} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active">Active</SelectItem>
                                        <SelectItem value="Inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" value={formData.description || ""} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Operation description..." />
                        </div>
                    </div>

                    <div>
                        <SectionHeader title="Inputs (RM / SFG / Waste)" />
                        <div className="flex gap-2 items-end mb-4">
                            <div className="w-[120px] space-y-2">
                                <Label>Input Type</Label>
                                <Select value={selectedInputType} onValueChange={(val: any) => setSelectedInputType(val)}>
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
                                        <Button variant="outline" role="combobox" aria-expanded={isInputComboboxOpen} className="w-full justify-between font-normal">
                                            {selectedInputId ? MOCK_ITEMS.find((i) => i.id.toString() === selectedInputId)?.name : "Choose Item..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                        <Command>
                                            <CommandInputBorderless placeholder="Search item..." />
                                            <CommandList className="max-h-[120px] overflow-y-auto">
                                                <CommandEmpty>No item found.</CommandEmpty>
                                                <CommandGroup>
                                                    {MOCK_ITEMS.filter(i => i.type === selectedInputType).map((item) => {
                                                        const isSelected = formData.inputs?.some((existing: OperationItem) => existing.item_id === item.id);
                                                        return (
                                                            <CommandItem
                                                                key={item.id}
                                                                value={item.name}
                                                                disabled={isSelected}
                                                                onSelect={() => {
                                                                    if (!isSelected) {
                                                                        setSelectedInputId(item.id.toString());
                                                                        setIsInputComboboxOpen(false);
                                                                    }
                                                                }}
                                                                className={cn(isSelected && "opacity-50 cursor-not-allowed")}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", selectedInputId === item.id.toString() ? "opacity-100" : "opacity-0")} />
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
                            <Button onClick={() => addOperationItem("inputs")}><Plus className="h-4 w-4 mr-2" /> Add</Button>
                        </div>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Item Details</TableHead>
                                        <TableHead>UOM</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="w-[100px]">Quantity</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {formData.inputs?.map((item: OperationItem) => {
                                        const originalItem = MOCK_ITEMS.find(i => i.id === item.item_id);
                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div className="font-medium">{originalItem?.name}</div>
                                                    <div className="text-xs text-muted-foreground">{originalItem?.code}</div>
                                                </TableCell>
                                                <TableCell>{originalItem?.uom}</TableCell>
                                                <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                                                <TableCell>
                                                    <Input type="number" min="0" value={item.quantity} onChange={(e) => updateOperationItem("inputs", item.id, "quantity", parseFloat(e.target.value) || 0)} className="h-8" />
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeOperationItem("inputs", item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {(!formData.inputs?.length) && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground h-24">No inputs added.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div>
                        <SectionHeader title="Outputs (SFG / FG / Waste)" />
                        <div className="flex gap-2 items-end mb-4">
                            <div className="w-[120px] space-y-2">
                                <Label>Output Type</Label>
                                <Select value={selectedOutputType} onValueChange={(val: any) => setSelectedOutputType(val)}>
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
                                        <Button variant="outline" role="combobox" aria-expanded={isOutputComboboxOpen} className="w-full justify-between font-normal">
                                            {selectedOutputId ? MOCK_ITEMS.find((i) => i.id.toString() === selectedOutputId)?.name : "Choose Item..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                        <Command>
                                            <CommandInputBorderless placeholder="Search item..." />
                                            <CommandList className="max-h-[120px] overflow-y-auto">
                                                <CommandEmpty>No item found.</CommandEmpty>
                                                <CommandGroup>
                                                    {MOCK_ITEMS.filter(i => i.type === selectedOutputType).map((item) => {
                                                        const isSelected = formData.outputs?.some((existing: OperationItem) => existing.item_id === item.id);
                                                        return (
                                                            <CommandItem
                                                                key={item.id}
                                                                value={item.name}
                                                                disabled={isSelected}
                                                                onSelect={() => {
                                                                    if (!isSelected) {
                                                                        setSelectedOutputId(item.id.toString());
                                                                        setIsOutputComboboxOpen(false);
                                                                    }
                                                                }}
                                                                className={cn(isSelected && "opacity-50 cursor-not-allowed")}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", selectedOutputId === item.id.toString() ? "opacity-100" : "opacity-0")} />
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
                            <Button onClick={() => addOperationItem("outputs")}><Plus className="h-4 w-4 mr-2" /> Add</Button>
                        </div>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Item Details</TableHead>
                                        <TableHead>UOM</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="w-[100px]">Quantity</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {formData.outputs?.map((item: OperationItem) => {
                                        const originalItem = MOCK_ITEMS.find(i => i.id === item.item_id);
                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div className="font-medium">{originalItem?.name}</div>
                                                    <div className="text-xs text-muted-foreground">{originalItem?.code}</div>
                                                </TableCell>
                                                <TableCell>{originalItem?.uom}</TableCell>
                                                <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                                                <TableCell>
                                                    <Input type="number" min="0" value={item.quantity} onChange={(e) => updateOperationItem("outputs", item.id, "quantity", parseFloat(e.target.value) || 0)} className="h-8" />
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeOperationItem("outputs", item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {(!formData.outputs?.length) && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground h-24">No outputs added.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="is_qc_required"
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={formData.is_qc_required || false}
                                onChange={(e) => setFormData({ ...formData, is_qc_required: e.target.checked })}
                            />
                            <Label htmlFor="is_qc_required" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Is QC Required?
                            </Label>
                        </div>

                        {formData.is_qc_required && (
                            <>
                                <div className="flex items-center space-x-2 mb-4 ml-1">
                                    <input
                                        type="checkbox"
                                        id="is_qc_required_batch_wise"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={formData.is_qc_required_batch_wise || false}
                                        onChange={(e) => setFormData({ ...formData, is_qc_required_batch_wise: e.target.checked })}
                                    />
                                    <Label htmlFor="is_qc_required_batch_wise" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        Batchwise tracking
                                    </Label>
                                </div>

                                <div className="rounded-lg border p-4 bg-muted/20">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-semibold text-sm">QC Parameters</h4>
                                        <Button variant="outline" size="sm" onClick={addQCParam}>
                                            <Plus className="h-3.5 w-3.5 mr-2" />
                                            Add Parameter
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        {(formData.qc_parameters || []).map((param: QCParameter) => (
                                            <div key={param.id} className="flex gap-3 items-start">
                                                <div className="flex-1">
                                                    <Input
                                                        placeholder="Parameter Name"
                                                        value={param.name}
                                                        onChange={(e) => updateQCParam(param.id, "name", e.target.value)}
                                                        className="h-9"
                                                    />
                                                </div>
                                                <div className="flex-[2]">
                                                    <Input
                                                        placeholder="Check Description"
                                                        value={param.description}
                                                        onChange={(e) => updateQCParam(param.id, "description", e.target.value)}
                                                        className="h-9"
                                                    />
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeQCParam(param.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        {(!formData.qc_parameters?.length) && <div className="text-center text-muted-foreground text-sm py-2">No QC parameters defined.</div>}
                                    </div>
                                </div>

                            </>
                        )}
                    </div>
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
                                    (!formData.outputs || formData.outputs.length === 0);
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
