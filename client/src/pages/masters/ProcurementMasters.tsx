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
import { Plus, Search, Pencil, Trash2, ChevronsUpDown, Check, Package, Sliders, X } from "lucide-react";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { allMockMaterials } from "@/lib/masterMockData";

// --- Types & Interfaces ---

type MasterType = "Items" | "Material Threshold";

const MASTER_SLUGS: Record<MasterType, string> = {
    "Items": "items",
    "Material Threshold": "material-master",
};

const MASTER_TYPES: MasterType[] = ["Items", "Material Threshold"];



interface Item {
    id: number;
    // Basic Info
    code: string;
    name: string;
    type: "RM" | "SFG" | "FG" | "Consumables";
    uom: string;

    // Inventory Controls
    is_expiry_tracked: boolean;
    shelf_life_days?: number;


    // Specification / Notes
    notes?: string; // Specification

    // RM Threshold
    daily_required_qty?: number;

    // Audit
    created_at?: string;
    created_by?: string;
    updated_at?: string;
    updated_by?: string;
}

interface MaterialMaster {
    id: number;
    code: string;
    name: string;
    type: "RM" | "SFG" | "FG" | "Consumables";
    uom: string;
    threshold_configured: boolean;
    upper_limit?: number;
    upper_users?: SelectedUser[];
    lower_limit?: number;
    lower_users?: SelectedUser[];
    remarks?: string;
    created_at?: string;
}

interface SelectedUser {
    id: string;
    fullName: string;
    username: string;
    email: string;
    phone: string;
}

interface ThresholdData {
    materialId: number | null;
    type: "RM" | "SFG" | "FG" | "Consumables";
    upperLimit: number;
    upperSelectedUsers: SelectedUser[];
    lowerLimit: number;
    lowerSelectedUsers: SelectedUser[];
    remarks?: string;
}

// --- Mock Data ---




// Helper function to determine UOM based on item name
const getUOMForItem = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('acid') || lowerName.includes('oil') || lowerName.includes('solvent')) {
        return 'ltr';
    } else if (lowerName.includes('gloves') || lowerName.includes('mask') || lowerName.includes('tape')) {
        return 'nos';
    } else if (lowerName.includes('battery') || lowerName.includes('lead') || lowerName.includes('pallet')) {
        return 'kg';
    } else if (lowerName.includes('case') || lowerName.includes('lid') || lowerName.includes('separator') || lowerName.includes('terminal') || lowerName.includes('connector')) {
        return 'nos';
    } else if (lowerName.includes('gsv') || lowerName.includes('gsmx') || lowerName.includes('smf') || lowerName.includes('mf')) {
        return 'nos';
    }
    return 'kg'; // default
};

const initialItems: Item[] = [
    ...allMockMaterials,
    ...allMockMaterials.slice(0, 5 - allMockMaterials.length)
].slice(0, 5).map((material, index) => ({
    id: index + 1,
    code: `${material.id.toUpperCase().replace('-', '')}${index > 23 ? `_${index}` : ''}`,
    name: `${material.name}${index > 23 ? ` (Batch ${Math.floor(index / 10)})` : ''}`,
    type: material.type as "RM" | "SFG" | "FG" | "Consumables",
    uom: getUOMForItem(material.name),
    is_expiry_tracked: false,
    created_at: "2024-01-01",
    created_by: "Admin"
}));

const initialMaterialMasters: MaterialMaster[] = [
    ...allMockMaterials,
    ...allMockMaterials.slice(0, 5 - allMockMaterials.length)
].slice(0, 5).map((material, index) => ({
    id: index + 1,
    code: `${material.id.toUpperCase().replace('-', '')}${index > 23 ? `_${index}` : ''}`,
    name: `${material.name}${index > 23 ? ` (Batch ${Math.floor(index / 10)})` : ''}`,
    type: material.type as "RM" | "SFG" | "FG" | "Consumables",
    uom: getUOMForItem(material.name),
    threshold_configured: index % 3 === 0,
    upper_limit: index % 3 === 0 ? 100 + index : undefined,
    lower_limit: index % 3 === 0 ? 20 + index : undefined,
    created_at: "2024-01-15"
}));

const MOCK_COREHR_USERS: SelectedUser[] = [
    { id: "user-1", username: "john.doe", fullName: "John Doe", email: "john.doe@example.com", phone: "+91 98765 43210" },
    { id: "user-2", username: "jane.smith", fullName: "Jane Smith", email: "jane.smith@example.com", phone: "+91 98765 43211" },
    { id: "user-3", username: "mike.jones", fullName: "Mike Jones", email: "mike.jones@example.com", phone: "+91 98765 43212" },
    { id: "user-4", username: "sarah.wilson", fullName: "Sarah Wilson", email: "sarah.wilson@example.com", phone: "+91 98765 43213" },
    { id: "user-5", username: "robert.brown", fullName: "Robert Brown", email: "robert.brown@example.com", phone: "+91 98765 43214" },
    { id: "user-6", username: "emily.davis", fullName: "Emily Davis", email: "emily.davis@example.com", phone: "+91 98765 43215" },
];

// --- Sub-components for Form Sections ---

const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 pb-2 mb-4 border-b">
        <h3 className="font-semibold text-sm text-primary">{title}</h3>
    </div>
);

export default function ProcurementMasters() {
    const { toast } = useToast();
    const [location, setLocation] = useLocation();
    const params = useParams();

    const getValidMaster = (type: string | undefined): MasterType => {
        if (type) {
            const entry = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === type);
            if (entry) return entry[0] as MasterType;
        }
        return "Items";
    };

    const selectedMaster = getValidMaster(params.type);
    const [activeTab, setActiveTab] = useState(MASTER_SLUGS[selectedMaster]);

    const [searchTerm, setSearchTerm] = useState("");
    const [open, setOpen] = useState(false); // Master type selector open state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const updateRoute = (type: MasterType) => {
        const slug = MASTER_SLUGS[type] || type.toLowerCase();
        setLocation(`/masters/procurement/${slug}`);
    };

    const handleMasterChange = (newMaster: MasterType) => {
        const slug = MASTER_SLUGS[newMaster];
        setActiveTab(slug);
        setLocation(`/masters/procurement/${slug}`);
        setSearchTerm("");
        setOpen(false);
        setFilterType("All");
        setCurrentPage(1);
    };

    useEffect(() => {
        const newMaster = getValidMaster(params.type);
        const newSlug = MASTER_SLUGS[newMaster];
        if (newSlug !== activeTab) {
            setActiveTab(newSlug);
        }
        if (location === '/masters/procurement') {
            setLocation('/masters/procurement/items');
        }
    }, [params.type, location]);

    // State for mock data

    const [items, setItems] = useState<Item[]>(initialItems);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<any>({}); // Using any for hybrid form data

    // Filters
    const [filterType, setFilterType] = useState<string>("All");
    const [filterConfigured, setFilterConfigured] = useState<string>("All"); // "All" | "Configured" | "Not Configured"

    // Vendor Items Dialog State


    // Material Master State
    const [materialMasters, setMaterialMasters] = useState<MaterialMaster[]>(initialMaterialMasters);
    const [isThresholdDialogOpen, setIsThresholdDialogOpen] = useState(false);
    const [thresholdFormData, setThresholdFormData] = useState<ThresholdData>({
        materialId: null,
        type: "RM",
        upperLimit: 0,
        upperSelectedUsers: [],
        lowerLimit: 0,
        lowerSelectedUsers: [],
        remarks: "",
    });
    const [tempUpperUserId, setTempUpperUserId] = useState<string>("");
    const [tempLowerUserId, setTempLowerUserId] = useState<string>("");
    const [isUpperUserComboboxOpen, setIsUpperUserComboboxOpen] = useState(false);
    const [isLowerUserComboboxOpen, setIsLowerUserComboboxOpen] = useState(false);
    const [isMaterialComboboxOpen, setIsMaterialComboboxOpen] = useState(false);


    const handleAddUserToThreshold = (limitType: 'upper' | 'lower') => {
        const userId = limitType === 'upper' ? tempUpperUserId : tempLowerUserId;
        if (!userId) return;

        const user = MOCK_COREHR_USERS.find(u => u.id === userId);
        if (!user) return;

        const currentUsers = limitType === 'upper' ? thresholdFormData.upperSelectedUsers : thresholdFormData.lowerSelectedUsers;

        if (currentUsers.some(u => u.id === userId)) {
            toast({ variant: "destructive", title: "Duplicate User", description: "This user is already added to this limit." });
            return;
        }

        setThresholdFormData(prev => ({
            ...prev,
            [limitType === 'upper' ? 'upperSelectedUsers' : 'lowerSelectedUsers']: [
                ...currentUsers,
                { id: user.id, fullName: user.fullName, username: user.username, email: user.email, phone: user.phone }
            ]
        }));

        if (limitType === 'upper') setTempUpperUserId("");
        else setTempLowerUserId("");
    };

    const handleRemoveUserFromThreshold = (userId: string, limitType: 'upper' | 'lower') => {
        setThresholdFormData(prev => ({
            ...prev,
            [limitType === 'upper' ? 'upperSelectedUsers' : 'lowerSelectedUsers']:
                prev[limitType === 'upper' ? 'upperSelectedUsers' : 'lowerSelectedUsers'].filter(u => u.id !== userId)
        }));
    };



    // --- Helpers ---

    const getData = () => {
        if (selectedMaster === "Items") return items;
        if (selectedMaster === "Material Threshold") return materialMasters;
        return [];
    };

    const currentData = getData().filter((item: any) => {
        const searchLower = searchTerm.toLowerCase();
        let matchesSearch = false;

        if (selectedMaster === "Material Threshold") {
            matchesSearch =
                item.name?.toLowerCase().includes(searchLower) ||
                item.code?.toLowerCase().includes(searchLower);
        } else {
            matchesSearch =
                item.name?.toLowerCase().includes(searchLower) ||
                item.code?.toLowerCase().includes(searchLower);
        }

        let matchesType = filterType === "All" || item.type === filterType;
        return matchesSearch && matchesType;
    });


    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    const paginatedData = currentData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleAddClick = () => {
        setEditingId(null);
        if (selectedMaster === "Items") {
            setFormData({
                type: "RM",
                uom: "PC", // Default
                is_expiry_tracked: false,
            });
        }
        setIsDialogOpen(true);
    };

    const handleEditClick = (item: any) => {
        setEditingId(item.id);
        const data = { ...item };

        if (selectedMaster === "Material Threshold") {
            setThresholdFormData({
                materialId: item.id,
                type: item.type || "RM",
                upperLimit: item.upper_limit || 0,
                upperSelectedUsers: item.upper_users || [],
                lowerLimit: item.lower_limit || 0,
                lowerSelectedUsers: item.lower_users || [],
                remarks: item.remarks || "",
            });
            setIsThresholdDialogOpen(true);
            return;
        }


        if (!data.documents) {
            data.documents = [];
        }
        setFormData(data);
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (id: number) => {
        if (confirm("Are you sure? This action cannot be undone.")) {
            if (selectedMaster === "Material Threshold") {
                setMaterialMasters(prev => prev.map(item =>
                    item.id === id ? { ...item, threshold_configured: false, upper_limit: 0, lower_limit: 0, upper_users: [], lower_users: [], remarks: "" } : item
                ));
            } else {
                setItems(prev => prev.filter(item => item.id !== id));
            }
            toast({ title: "Deleted", description: "Record deleted successfully." });
        }
    };

    const handleSave = () => {
        const now = new Date().toISOString().split('T')[0];
        const user = "Admin User";

        if (selectedMaster === "Items") {
            // Item Validation
            if (!formData.code || !formData.name || !formData.type || !formData.uom) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }

            if (formData.is_expiry_tracked && (formData.shelf_life_days < 0)) {
                toast({ variant: "destructive", title: "Validation Error", description: "Shelf life cannot be negative." });
                return;
            }

            // Duplicate Check (Code)
            if (items.some(i => i.id !== editingId && i.code.toLowerCase() === formData.code?.toLowerCase())) {
                toast({ variant: "destructive", title: "Validation Error", description: "Item Code must be unique." });
                return;
            }

            if (editingId) {
                setItems(prev => prev.map(item => item.id === editingId ? { ...item, ...formData, updated_at: now, updated_by: user } as Item : item));
                toast({ title: "Updated", description: "Item updated successfully" });
            } else {
                const newId = Math.max(...items.map(v => v.id), 0) + 1;
                const newItem = { ...formData, id: newId, created_at: now, created_by: user } as Item;
                setItems(prev => [...prev, newItem]);
                toast({ title: "Created", description: "Item created successfully" });
            }

        } else if (selectedMaster === "Material Threshold") {
            // Material Master Validation
            if (!formData.code || !formData.name || !formData.type || !formData.uom) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }

            if (editingId) {
                setMaterialMasters(prev => prev.map(item => item.id === editingId ? { ...item, ...formData, updated_at: now, updated_by: user } as MaterialMaster : item));
                toast({ title: "Updated", description: "Material updated successfully" });
            } else {
                const newId = Math.max(...materialMasters.map(v => v.id), 0) + 1;
                const newItem = { ...formData, id: newId, threshold_configured: false, created_at: now, created_by: user } as MaterialMaster;
                setMaterialMasters(prev => [...prev, newItem]);
                toast({ title: "Created", description: "Material created successfully" });
            }
        }
        setIsDialogOpen(false);
    };




    // --- Renderers ---

    const renderTable = () => {
        if (selectedMaster === "Material Threshold") {
            return (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Item Name</TableHead>
                            <TableHead className="w-[100px]">Type</TableHead>
                            <TableHead className="w-[150px] text-center">Upper Limit</TableHead>
                            <TableHead className="w-[150px] text-center">Lower Limit</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No material masters found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{item.name}</span>
                                            <span className="text-xs text-muted-foreground">{item.code}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">{item.type}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {item.threshold_configured ? (
                                            <span className="text-sm font-semibold text-blue-600">{item.upper_limit}</span>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {item.threshold_configured ? (
                                            <span className="text-sm font-semibold text-orange-600">{item.lower_limit}</span>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted" onClick={() => handleEditClick(item)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteClick(item.id)}>
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
        } else {
            // Items Table
            return (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Item Code</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>UOM</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No items found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.code}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.type}</TableCell>
                                    <TableCell>{item.uom}</TableCell>
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
        }
    };

    const renderForm = () => {

        // Items Form
        return (
            <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-1">
                {/* A) Basic Info */}
                <div>
                    <SectionHeader title="Basic Info" />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="item_code">Item Code *</Label>
                            <Input id="item_code" value={formData.code || ""} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ex: RM003" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="item_name">Item Name *</Label>
                            <Input id="item_name" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Item Name" />
                        </div>
                        <div className="space-y-2">
                            <Label>Item Type *</Label>
                            <Select value={formData.type} onValueChange={(val: any) => setFormData({ ...formData, type: val })}>
                                <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="RM">RM</SelectItem>
                                    <SelectItem value="SFG">SFG</SelectItem>
                                    <SelectItem value="FG">FG</SelectItem>
                                    <SelectItem value="Consumables">Consumables</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>UOM *</Label>
                            <Select value={formData.uom} onValueChange={(val: any) => setFormData({ ...formData, uom: val })}>
                                <SelectTrigger><SelectValue placeholder="Select UOM" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="ltr">ltr</SelectItem>
                                    <SelectItem value="nos">nos</SelectItem>
                                    <SelectItem value="mtr">mtr</SelectItem>
                                    <SelectItem value="box">box</SelectItem>
                                    <SelectItem value="PC">PC</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>



                {/* C) Inventory Controls */}
                <div>
                    <SectionHeader title="Inventory Controls" />
                    <div className="grid grid-cols-2 gap-4 items-end">
                        <div className="flex items-center space-x-2 h-10">
                            <input
                                type="checkbox"
                                id="expiry"
                                checked={formData.is_expiry_tracked || false}
                                onChange={(e) => setFormData({ ...formData, is_expiry_tracked: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="expiry" className="mb-0 cursor-pointer">Is Expiry Tracked?</Label>
                        </div>
                        {formData.is_expiry_tracked && (
                            <div className="space-y-2">
                                <Label htmlFor="shelf_life">Shelf Life (Days)</Label>
                                <Input
                                    type="number"
                                    id="shelf_life"
                                    min={0}
                                    value={formData.shelf_life_days || ""}
                                    onChange={e => setFormData({ ...formData, shelf_life_days: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Specification */}
                <div>
                    <div className="space-y-2">
                        <Label htmlFor="item_notes">Specification / Notes</Label>
                        <Textarea id="item_notes" value={formData.notes || ""} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Technical specs or notes..." />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 h-full overflow-hidden">
            <div className="flex flex-col gap-2 shrink-0">
                <h1 className="text-3xl font-bold tracking-tight">Procurement Master</h1>
                <p className="text-muted-foreground">
                    Manage items and procurement configurations.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => {
                const masterType = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === value)?.[0] as MasterType;
                if (masterType) handleMasterChange(masterType);
            }} className="w-full flex-1 flex flex-col min-h-0">
                <div className="border-b border-border shrink-0">
                    <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                        {MASTER_TYPES.map((type) => (
                            <TabsTrigger
                                key={type}
                                value={MASTER_SLUGS[type]}
                                onClick={() => handleMasterChange(type)}
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                            >
                                {type}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <div className="flex-1 flex flex-col gap-6 mt-6 overflow-y-auto pr-2 pb-6 custom-scrollbar">
                    {/* Top Control Bar */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">


                        {/* Filters */}
                        <div className="w-full sm:w-1/6">
                            {selectedMaster === "Material Threshold" ? (
                                <>
                                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</Label>
                                    <Select value={filterType} onValueChange={setFilterType}>
                                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="All">All Types</SelectItem>
                                            <SelectItem value="RM">RM</SelectItem>
                                            <SelectItem value="SFG">SFG</SelectItem>
                                            <SelectItem value="FG">FG</SelectItem>
                                            <SelectItem value="Consumables">Consumables</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </>
                            ) : (
                                <>
                                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</Label>
                                    <Select value={filterType} onValueChange={setFilterType}>
                                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="All">All Types</SelectItem>
                                            <SelectItem value="RM">RM</SelectItem>
                                            <SelectItem value="SFG">SFG</SelectItem>
                                            <SelectItem value="FG">FG</SelectItem>
                                            <SelectItem value="Consumables">Consumables</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </>
                            )}
                        </div>
                        <div className="w-full sm:w-1/4">
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={`Search ${selectedMaster.toLowerCase()}...`}
                                    className="pl-9 h-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="w-full sm:w-auto ml-auto mt-auto pt-5 flex gap-2">
                            {selectedMaster === "Material Threshold" && (
                                <Button
                                    onClick={() => {
                                        setEditingId(null);
                                        setThresholdFormData({ materialId: null, type: "RM", upperLimit: 0, upperSelectedUsers: [], lowerLimit: 0, lowerSelectedUsers: [], remarks: "" });
                                        setIsThresholdDialogOpen(true);
                                    }}
                                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Threshold
                                </Button>
                            )}
                            {selectedMaster !== "Material Threshold" && (
                                <Button onClick={handleAddClick} className="w-full sm:w-auto">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Item
                                </Button>
                            )}
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

                            <DataTablePagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={currentData.length}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                            />
                        </CardContent>
                    </Card>
                </div>
            </Tabs>

            {/* Universal Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle>{editingId ? "Edit" : "Add New"} Item</DialogTitle>
                        <DialogDescription>
                            Configure the details for this item entry.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6">
                        {renderForm()}
                    </div>

                    <DialogFooter className="p-6 pt-2 border-t mt-auto text-right">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="mr-2">Cancel</Button>
                        <Button
                            onClick={handleSave}
                            disabled={(() => {
                                if (selectedMaster === "Items") {
                                    // Basic Fields
                                    if (!formData.code || !formData.name || !formData.type || !formData.uom) return true;
                                    return false;
                                }
                                return false;
                            })()}
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Threshold Creation Dialog */}
            <Dialog open={isThresholdDialogOpen} onOpenChange={setIsThresholdDialogOpen}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Threshold Range" : "Create Threshold Range"}</DialogTitle>
                        <DialogDescription>
                            Configure upper and lower notification limits with assigned users.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-8 py-4 max-h-[75vh] overflow-y-auto px-1">
                        {/* Basic Information */}
                        <div>
                            <SectionHeader title="Basic Info" />
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">Select Item Type *</Label>
                                    <Select
                                        value={thresholdFormData.type}
                                        onValueChange={(val: ThresholdData["type"]) => setThresholdFormData({ ...thresholdFormData, type: val, materialId: null })}
                                    >
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Select type" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="RM">RM</SelectItem>
                                            <SelectItem value="SFG">SFG</SelectItem>
                                            <SelectItem value="FG">FG</SelectItem>
                                            <SelectItem value="Consumables">Consumables</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">Select Item *</Label>
                                    <Popover open={isMaterialComboboxOpen} onOpenChange={setIsMaterialComboboxOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={isMaterialComboboxOpen}
                                                className="w-full justify-between h-9 font-normal"
                                                disabled={!!editingId} // Cannot change material while editing
                                            >
                                                {thresholdFormData.materialId
                                                    ? materialMasters.find(m => m.id === thresholdFormData.materialId)?.name
                                                    : "Choose item..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0 pointer-events-auto shadow-md" style={{ width: "var(--radix-popover-trigger-width)" }} align="start">
                                            <Command>
                                                <CommandInputBorderless placeholder="Search item..." />
                                                <CommandList className="max-h-[130px] overflow-y-auto">
                                                    <CommandEmpty>No item found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {materialMasters
                                                            .filter(m => m.type === thresholdFormData.type)
                                                            .map((m) => {
                                                                const isConfigured = m.threshold_configured;
                                                                const isSelected = thresholdFormData.materialId === m.id;
                                                                return (
                                                                    <CommandItem
                                                                        key={m.id}
                                                                        value={m.name}
                                                                        onSelect={() => {
                                                                            if (!isConfigured || editingId) {
                                                                                setThresholdFormData({ ...thresholdFormData, materialId: m.id });
                                                                                setIsMaterialComboboxOpen(false);
                                                                            }
                                                                        }}
                                                                        disabled={isConfigured && !editingId}
                                                                        className={cn(isConfigured && !editingId && "opacity-50 cursor-not-allowed")}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                isSelected ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium text-sm">{m.name} {isConfigured && !editingId && "(Configured)"}</span>
                                                                            <span className="text-[10px] text-muted-foreground">{m.code}</span>
                                                                        </div>
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
                        </div>

                        {/* Upper Limit Section */}
                        <div>
                            <SectionHeader title="Upper Limit Configuration" />
                            <div className="flex gap-4 items-end mb-4">
                                <div className="w-[150px] space-y-2">
                                    <Label htmlFor="upper_limit" className="text-xs font-semibold">Upper Limit *</Label>
                                    <Input
                                        id="upper_limit"
                                        type="number"
                                        min={0}
                                        value={thresholdFormData.upperLimit || ""}
                                        onChange={(e) => setThresholdFormData({ ...thresholdFormData, upperLimit: parseFloat(e.target.value) || 0 })}
                                        placeholder="e.g. 500"
                                        className="h-9 focus-visible:ring-primary"
                                    />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs font-semibold">Assign users to notify for Upper limit *</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Popover open={isUpperUserComboboxOpen} onOpenChange={setIsUpperUserComboboxOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={isUpperUserComboboxOpen}
                                                        className="w-full justify-between h-9 font-normal"
                                                    >
                                                        {tempUpperUserId
                                                            ? MOCK_COREHR_USERS.find(u => u.id === tempUpperUserId)?.fullName
                                                            : "Choose user..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0 pointer-events-auto shadow-md" style={{ width: "var(--radix-popover-trigger-width)" }} align="start">
                                                    <Command>
                                                        <CommandInputBorderless placeholder="Search system user..." />
                                                        <CommandList className="max-h-[150px]">
                                                            <CommandEmpty>No user found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {MOCK_COREHR_USERS.map((u) => {
                                                                    const isAdded = thresholdFormData.upperSelectedUsers.some(su => su.id === u.id);
                                                                    return (
                                                                        <CommandItem
                                                                            key={u.id}
                                                                            value={u.fullName}
                                                                            onSelect={() => {
                                                                                setTempUpperUserId(u.id);
                                                                                setIsUpperUserComboboxOpen(false);
                                                                            }}
                                                                            disabled={isAdded}
                                                                            className={cn(isAdded && "opacity-50")}
                                                                        >
                                                                            <Check
                                                                                className={cn(
                                                                                    "mr-2 h-4 w-4",
                                                                                    tempUpperUserId === u.id ? "opacity-100" : "opacity-0"
                                                                                )}
                                                                            />
                                                                            <div>
                                                                                <div className="font-medium text-sm">{u.fullName}</div>
                                                                                <div className="text-[10px] text-muted-foreground">{u.username}</div>
                                                                            </div>
                                                                            {isAdded && <span className="ml-auto text-[10px] italic">Added</span>}
                                                                        </CommandItem>
                                                                    );
                                                                })}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={() => handleAddUserToThreshold('upper')}
                                            disabled={!tempUpperUserId}
                                            className="bg-blue-600 hover:bg-blue-700 h-9"
                                        >
                                            <Plus className="h-4 w-4 mr-2" /> Add
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-xs font-bold uppercase tracking-wider h-9">Name</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider h-9">Email</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider h-9">Contact Number</TableHead>
                                            <TableHead className="w-[50px] h-9"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {thresholdFormData.upperSelectedUsers.length > 0 ? (
                                            thresholdFormData.upperSelectedUsers.map(user => (
                                                <TableRow key={user.id}>
                                                    <TableCell className="py-2 text-sm font-medium">{user.fullName}</TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground">{user.email}</TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground">{user.phone}</TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleRemoveUserFromThreshold(user.id, 'upper')}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground h-16 text-xs italic">
                                                    No users assigned for upper limit.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Lower Limit Section */}
                        <div>
                            <SectionHeader title="Lower Limit Configuration" />
                            <div className="flex gap-4 items-end mb-4">
                                <div className="w-[150px] space-y-2">
                                    <Label htmlFor="lower_limit" className="text-xs font-semibold">Lower Limit *</Label>
                                    <Input
                                        id="lower_limit"
                                        type="number"
                                        min={0}
                                        value={thresholdFormData.lowerLimit || ""}
                                        onChange={(e) => setThresholdFormData({ ...thresholdFormData, lowerLimit: parseFloat(e.target.value) || 0 })}
                                        placeholder="e.g. 50"
                                        className="h-9 focus-visible:ring-primary"
                                    />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs font-semibold">Assign users to notify for Lower limit *</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Popover open={isLowerUserComboboxOpen} onOpenChange={setIsLowerUserComboboxOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={isLowerUserComboboxOpen}
                                                        className="w-full justify-between h-9 font-normal"
                                                    >
                                                        {tempLowerUserId
                                                            ? MOCK_COREHR_USERS.find(u => u.id === tempLowerUserId)?.fullName
                                                            : "Choose user..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0 pointer-events-auto shadow-md" style={{ width: "var(--radix-popover-trigger-width)" }} align="start">
                                                    <Command>
                                                        <CommandInputBorderless placeholder="Search system user..." />
                                                        <CommandList className="max-h-[150px]">
                                                            <CommandEmpty>No user found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {MOCK_COREHR_USERS.map((u) => {
                                                                    const isAdded = thresholdFormData.lowerSelectedUsers.some(su => su.id === u.id);
                                                                    return (
                                                                        <CommandItem
                                                                            key={u.id}
                                                                            value={u.fullName}
                                                                            onSelect={() => {
                                                                                setTempLowerUserId(u.id);
                                                                                setIsLowerUserComboboxOpen(false);
                                                                            }}
                                                                            disabled={isAdded}
                                                                            className={cn(isAdded && "opacity-50")}
                                                                        >
                                                                            <Check
                                                                                className={cn(
                                                                                    "mr-2 h-4 w-4",
                                                                                    tempLowerUserId === u.id ? "opacity-100" : "opacity-0"
                                                                                )}
                                                                            />
                                                                            <div>
                                                                                <div className="font-medium text-sm">{u.fullName}</div>
                                                                                <div className="text-[10px] text-muted-foreground">{u.username}</div>
                                                                            </div>
                                                                            {isAdded && <span className="ml-auto text-[10px] italic">Added</span>}
                                                                        </CommandItem>
                                                                    );
                                                                })}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={() => handleAddUserToThreshold('lower')}
                                            disabled={!tempLowerUserId}
                                            className="bg-blue-600 hover:bg-blue-700 h-9"
                                        >
                                            <Plus className="h-4 w-4 mr-2" /> Add
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-xs font-bold uppercase tracking-wider h-9">Name</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider h-9">Email</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-wider h-9">Contact Number</TableHead>
                                            <TableHead className="w-[50px] h-9"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {thresholdFormData.lowerSelectedUsers.length > 0 ? (
                                            thresholdFormData.lowerSelectedUsers.map(user => (
                                                <TableRow key={user.id}>
                                                    <TableCell className="py-2 text-sm font-medium">{user.fullName}</TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground">{user.email}</TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground">{user.phone}</TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleRemoveUserFromThreshold(user.id, 'lower')}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground h-16 text-xs italic">
                                                    No users assigned for lower limit.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Remarks Section */}
                        <div className="space-y-2">
                            <Label htmlFor="remarks" className="text-xs font-semibold">Remarks</Label>
                            <Textarea
                                id="remarks"
                                value={thresholdFormData.remarks || ""}
                                onChange={(e) => setThresholdFormData({ ...thresholdFormData, remarks: e.target.value })}
                                placeholder="Enter any additional notes or remarks..."
                                className="min-h-[80px] resize-none focus-visible:ring-primary"
                            />
                        </div>


                    </div>

                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setIsThresholdDialogOpen(false)} className="h-9 px-6">Cancel</Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px] h-9"
                            onClick={() => {
                                if (!thresholdFormData.materialId || thresholdFormData.upperSelectedUsers.length === 0 || thresholdFormData.upperLimit <= 0) {
                                    toast({ variant: "destructive", title: "Missing Fields", description: "Please complete basic info and upper limit configuration." });
                                    return;
                                }

                                const mat = materialMasters.find(m => m.id === thresholdFormData.materialId);

                                // PERSIST LOGIC: Update materialMasters state
                                setMaterialMasters(prev => {
                                    return prev.map(m => {
                                        if (m.id === thresholdFormData.materialId) {
                                            return {
                                                ...m,
                                                threshold_configured: true,
                                                upper_limit: thresholdFormData.upperLimit,
                                                upper_users: thresholdFormData.upperSelectedUsers,
                                                lower_limit: thresholdFormData.lowerLimit,
                                                lower_users: thresholdFormData.lowerSelectedUsers,
                                                remarks: thresholdFormData.remarks,
                                            };
                                        }
                                        return m;
                                    });
                                });

                                toast({ title: editingId ? "Threshold Updated" : "Threshold Created", description: `Configuration for "${mat?.name}" saved successfully.` });
                                setIsThresholdDialogOpen(false);
                                setThresholdFormData({ materialId: null, type: "RM", upperLimit: 0, upperSelectedUsers: [], lowerLimit: 0, lowerSelectedUsers: [], remarks: "" });
                            }}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
