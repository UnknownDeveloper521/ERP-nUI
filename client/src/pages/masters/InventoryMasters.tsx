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

type MasterType = "Warehouses" | "Bins";

const MASTER_SLUGS: Record<MasterType, string> = {
    "Warehouses": "warehouses",
    "Bins": "bins",
};

const MASTER_TYPES: MasterType[] = ["Warehouses", "Bins"];

const LOCATIONS = ["Plant A", "Plant B", "Plant C", "Plant D"];

interface Warehouse {
    id: number;
    code: string;
    name: string;
    location: string;
    status: "Active" | "Inactive";
    address_notes?: string;
    created_at?: string;
    updated_at?: string;
}

interface Bin {
    id: number;
    warehouse_id: number; // Linked Warehouse
    code: string;
    name: string;
    type?: "Normal" | "QC Hold" | "Scrap";
    status: "Active" | "Inactive";
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

// --- Mock Data ---

const initialWarehouses: Warehouse[] = [
    { id: 1, code: "WH01", name: "Main Warehouse", location: "Plant A", status: "Active", address_notes: "Building A, Industrial Estate" },
    { id: 2, code: "WH02", name: "Cold Storage", location: "Plant B", status: "Active", address_notes: "Zone B, Temperature Controlled" },
];

const initialBins: Bin[] = [
    { id: 1, warehouse_id: 1, code: "A-01-01", name: "Row A, Rack 1, Shelf 1", type: "Normal", status: "Active" },
    { id: 2, warehouse_id: 1, code: "A-01-02", name: "Row A, Rack 1, Shelf 2", type: "Normal", status: "Active" },
    { id: 3, warehouse_id: 2, code: "CS-01", name: "Cold Zone 1", type: "Normal", status: "Active" },
    { id: 4, warehouse_id: 1, code: "QC-AREA", name: "QC Holding Area", type: "QC Hold", status: "Active" },
];

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

export default function InventoryMasters() {
    const { toast } = useToast();
    const [location, setLocation] = useLocation();
    const params = useParams();

    const activeTab = params.tab || "basic";

    const getValidMaster = (type: string | undefined): MasterType => {
        if (type) {
            const entry = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === type);
            if (entry) return entry[0] as MasterType;
        }
        return "Warehouses";
    };

    const selectedMaster = getValidMaster(params.type);

    const [searchTerm, setSearchTerm] = useState("");
    const [open, setOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const updateRoute = (tab: string, type: MasterType) => {
        const slug = MASTER_SLUGS[type] || type.toLowerCase();
        setLocation(`/masters/inventory/${tab}/${slug}`);
    };

    const handleMasterChange = (newMaster: MasterType) => {
        updateRoute(activeTab, newMaster);
        setSearchTerm("");
        setOpen(false);
        setFilterStatus("All");
        setFilterWarehouse("All");
        setCurrentPage(1);
    };

    // State for mock data
    const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
    const [bins, setBins] = useState<Bin[]>(initialBins);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<any>({});

    // Filters
    const [filterStatus, setFilterStatus] = useState<string>("All");
    const [filterWarehouse, setFilterWarehouse] = useState<string>("All"); // For Bins

    // --- Helpers ---

    const getData = () => {
        if (selectedMaster === "Warehouses") return warehouses;
        if (selectedMaster === "Bins") return bins;
        return [];
    };

    const currentData = getData().filter((item: any) => {
        const searchLower = searchTerm.toLowerCase();
        let matchesSearch = false;

        if (selectedMaster === "Warehouses") {
            matchesSearch =
                item.name.toLowerCase().includes(searchLower) ||
                item.code.toLowerCase().includes(searchLower);
        } else {
            matchesSearch =
                item.name.toLowerCase().includes(searchLower) ||
                item.code.toLowerCase().includes(searchLower);
        }

        const matchesStatus = filterStatus === "All" || item.status === filterStatus;

        let matchesWarehouse = true;
        if (selectedMaster === "Bins" && filterWarehouse !== "All") {
            matchesWarehouse = item.warehouse_id === parseInt(filterWarehouse);
        }

        return matchesSearch && matchesStatus && matchesWarehouse;
    });

    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    const paginatedData = currentData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleAddClick = () => {
        setEditingId(null);
        if (selectedMaster === "Warehouses") {
            setFormData({
                status: "Active",
            });
        } else {
            // Default to first warehouse if available
            setFormData({
                status: "Active",
                type: "Normal",
                warehouse_id: warehouses.length > 0 ? warehouses[0].id.toString() : "",
            });
        }
        setIsDialogOpen(true);
    };

    const handleEditClick = (item: any) => {
        setEditingId(item.id);
        setFormData({ ...item, warehouse_id: item.warehouse_id?.toString() }); // Ensure string for Select
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (id: number) => {
        if (confirm("Are you sure? This action cannot be undone.")) {
            if (selectedMaster === "Warehouses") {
                // Check if used in bins
                if (bins.some(b => b.warehouse_id === id)) {
                    toast({ variant: "destructive", title: "Cannot Delete", description: "Warehouse is used in Bins." });
                    return;
                }
                setWarehouses(prev => prev.filter(item => item.id !== id));
            } else {
                setBins(prev => prev.filter(item => item.id !== id));
            }
            toast({ title: "Deleted", description: "Record deleted successfully." });
        }
    };

    const handleSave = () => {
        const now = new Date().toISOString();

        if (selectedMaster === "Warehouses") {
            if (!formData.code || !formData.name || !formData.status || !formData.location) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }
            // Unique Code Check
            if (warehouses.some(w => w.id !== editingId && w.code.toLowerCase() === formData.code.toLowerCase())) {
                toast({ variant: "destructive", title: "Validation Error", description: "Warehouse Code must be unique." });
                return;
            }

            if (editingId) {
                setWarehouses(prev => prev.map(item => item.id === editingId ? { ...item, ...formData, updated_at: now } as Warehouse : item));
                toast({ title: "Updated", description: "Warehouse updated successfully" });
            } else {
                const newId = Math.max(...warehouses.map(v => v.id), 0) + 1;
                const newItem = { ...formData, id: newId, created_at: now } as Warehouse;
                setWarehouses(prev => [...prev, newItem]);
                toast({ title: "Created", description: "Warehouse created successfully" });
            }
        } else {
            // Bins
            if (!formData.warehouse_id || !formData.code || !formData.name || !formData.status) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }
            // Unique Code Check WITHIN Warehouse
            if (bins.some(b => b.id !== editingId && b.warehouse_id === parseInt(formData.warehouse_id) && b.code.toLowerCase() === formData.code.toLowerCase())) {
                toast({ variant: "destructive", title: "Validation Error", description: "Bin Code must be unique within the selected Warehouse." });
                return;
            }

            const binData = { ...formData, warehouse_id: parseInt(formData.warehouse_id) };

            if (editingId) {
                setBins(prev => prev.map(item => item.id === editingId ? { ...item, ...binData, updated_at: now } as Bin : item));
                toast({ title: "Updated", description: "Bin updated successfully" });
            } else {
                const newId = Math.max(...bins.map(v => v.id), 0) + 1;
                const newItem = { ...binData, id: newId, created_at: now } as Bin;
                setBins(prev => [...prev, newItem]);
                toast({ title: "Created", description: "Bin created successfully" });
            }
        }
        setIsDialogOpen(false);
    };

    // --- Renderers ---

    const renderTable = () => {
        if (selectedMaster === "Warehouses") {
            return (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Code</TableHead>
                            <TableHead>Warehouse Name</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No warehouses found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.code}</TableCell>
                                    <TableCell>{item.name}</TableCell>
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
        } else {
            return (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Bin Code</TableHead>
                            <TableHead>Bin Name</TableHead>
                            <TableHead>Warehouse</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No bins found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => {
                                const whName = warehouses.find(w => w.id === item.warehouse_id)?.name || "Unknown";
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{whName}</TableCell>
                                        <TableCell>{item.type || "-"}</TableCell>
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
        if (selectedMaster === "Warehouses") {
            return (
                <div className="grid gap-6 py-4 px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Warehouse Code *</Label>
                            <Input id="code" value={formData.code || ""} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ex: WH01" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Warehouse Name *</Label>
                            <Input id="name" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Main Warehouse" />
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
                            <Label htmlFor="address">Address / Notes</Label>
                            <Textarea id="address" value={formData.address_notes || ""} onChange={e => setFormData({ ...formData, address_notes: e.target.value })} placeholder="Warehouse Address..." />
                        </div>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="grid gap-6 py-4 px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Warehouse *</Label>
                            <Select value={formData.warehouse_id} onValueChange={(val: string) => setFormData({ ...formData, warehouse_id: val })}>
                                <SelectTrigger><SelectValue placeholder="Select Warehouse" /></SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
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
                        <div className="space-y-2">
                            <Label htmlFor="bin_code">Bin Code *</Label>
                            <Input id="bin_code" value={formData.code || ""} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ex: A-01" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bin_name">Bin Name *</Label>
                            <Input id="bin_name" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Rack 1, Shelf 1" />
                        </div>
                        <div className="space-y-2">
                            <Label>Bin Type</Label>
                            <Select value={formData.type} onValueChange={(val: any) => setFormData({ ...formData, type: val })}>
                                <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Normal">Normal</SelectItem>
                                    <SelectItem value="QC Hold">QC Hold</SelectItem>
                                    <SelectItem value="Scrap">Scrap</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea id="notes" value={formData.notes || ""} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                        </div>
                    </div>
                </div>
            );
        }
    };


    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Inventory Masters</h1>
                <p className="text-muted-foreground">
                    Manage warehouses, bins, and other inventory configurations.
                </p>
            </div>

            <Tabs value={activeTab} className="w-full flex-1 flex flex-col">
                <div className="border-b border-border">
                    <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                        <TabsTrigger
                            value="basic"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                            onClick={() => updateRoute("basic", "Warehouses")}
                        >
                            Basic
                        </TabsTrigger>
                        {/* Add more tabs later */}
                    </TabsList>
                </div>

                <TabsContent value="basic" className="m-0 h-full flex flex-col gap-6 mt-6">
                    {/* Top Control Bar */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                        <div className="w-full sm:w-1/4">
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Select Master Type</Label>
                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={open}
                                        className="w-full justify-between h-10 font-medium"
                                    >
                                        {selectedMaster ? selectedMaster : "Select Master..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent style={{ width: "var(--radix-popover-trigger-width)" }} className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandInputBorderless placeholder="Search master..." />
                                        <CommandList className="max-h-[200px] overflow-y-auto">
                                            <CommandEmpty>No master found.</CommandEmpty>
                                            <CommandGroup>
                                                {MASTER_TYPES.map((type) => (
                                                    <CommandItem
                                                        key={type}
                                                        value={type}
                                                        onSelect={(currentValue) => {
                                                            const original = MASTER_TYPES.find(t => t.toLowerCase() === currentValue.toLowerCase()) || type;
                                                            handleMasterChange(original as MasterType);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn("mr-2 h-4 w-4", selectedMaster === type ? "opacity-100" : "opacity-0")}
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

                        {/* Filters */}
                        {selectedMaster === "Bins" && (
                            <div className="w-full sm:w-1/6">
                                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Warehouse</Label>
                                <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Warehouses</SelectItem>
                                        {warehouses.map(w => (
                                            <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="w-full sm:w-1/6">
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All">All Status</SelectItem>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
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

                        <div className="w-full sm:w-auto ml-auto mt-auto pt-5">
                            <Button onClick={handleAddClick} className="w-full sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" />
                                Add {selectedMaster === "Warehouses" ? "Warehouse" : "Bin"}
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
                        <DialogTitle>{editingId ? "Edit" : "Add New"} {selectedMaster === "Warehouses" ? "Warehouse" : "Bin"}</DialogTitle>
                        <DialogDescription>
                            Configure the details for this {selectedMaster === "Warehouses" ? "warehouse" : "bin"}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6">
                        {renderForm()}
                    </div>

                    <DialogFooter className="p-6 pt-2 border-t mt-auto text-right">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="mr-2">Cancel</Button>
                        <Button onClick={handleSave}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
