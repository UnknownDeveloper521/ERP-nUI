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
import { Plus, Search, ChevronsUpDown, Check } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { mockWarehouses, mockLocations } from "@/lib/masterMockData";

// --- Types & Interfaces ---

type MasterType = "Warehouses" | "Bins";

const MASTER_SLUGS: Record<MasterType, string> = {
    "Warehouses": "warehouses",
    "Bins": "bins",
};

const MASTER_TYPES: MasterType[] = ["Warehouses", "Bins"];

const LOCATIONS = mockLocations.map(loc => loc.name);

const DEPARTMENTS = [
    { id: 1, name: "Production" },
    { id: 2, name: "Quality Control" },
    { id: 3, name: "Warehouse & Logistics" },
    { id: 4, name: "Maintenance" },
    { id: 5, name: "Research & Development" },
];

interface Warehouse {
    id: number;
    code: string;
    name: string;
    location: string;
    department: string;
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

const initialWarehouses: Warehouse[] = Array.from({ length: 5 }).map((_, index) => {
    const mockWh = mockWarehouses[index % mockWarehouses.length];
    return {
        id: index + 1,
        code: `${mockWh.id.toUpperCase().replace('-', '')}${index > 0 ? `_${index + 1}` : ''}`,
        name: `${mockWh.name}${index > 0 ? ` (Branch ${index + 1})` : ''}`,
        location: LOCATIONS[index % LOCATIONS.length] || "Unknown",
        department: DEPARTMENTS[index % DEPARTMENTS.length].name,
        status: "Active",
        address_notes: "Auto-generated mock data"
    };
});

const initialBins: Bin[] = Array.from({ length: 5 }).map((_, index) => {
    const whIndex = index % initialWarehouses.length;
    return {
        id: index + 1,
        warehouse_id: initialWarehouses[whIndex].id,
        code: `BIN-${index + 1}`.toUpperCase(),
        name: `Rack ${Math.floor(index / 5) + 1}, Bin ${index % 5 + 1}`,
        type: "Normal",
        status: "Active",
        notes: "Auto-generated mock bin"
    };
});

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

    const getValidMaster = (type: string | undefined): MasterType => {
        if (type) {
            const entry = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === type);
            if (entry) return entry[0] as MasterType;
        }
        return "Warehouses";
    };

    const selectedMaster = getValidMaster(params.type);
    const [activeTab, setActiveTab] = useState(MASTER_SLUGS[selectedMaster]);

    const [searchTerm, setSearchTerm] = useState("");
    const [open, setOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const updateRoute = (type: MasterType) => {
        const slug = MASTER_SLUGS[type] || type.toLowerCase();
        setLocation(`/masters/inventory/${slug}`);
    };

    const handleMasterChange = (newMaster: MasterType) => {
        const slug = MASTER_SLUGS[newMaster];
        setActiveTab(slug);
        setLocation(`/masters/inventory/${slug}`);
        setSearchTerm("");
        setOpen(false);
        setFilterStatus("All");
        setFilterWarehouse("All");
        setCurrentPage(1);
    };

    useEffect(() => {
        const newMaster = getValidMaster(params.type);
        const newSlug = MASTER_SLUGS[newMaster];
        if (newSlug !== activeTab) {
            setActiveTab(newSlug);
        }
        if (location === '/masters/inventory') {
            setLocation('/masters/inventory/warehouses');
        }
    }, [params.type, location]);

    // State for mock data
    const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
    const [bins, setBins] = useState<Bin[]>(initialBins);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [itemToDeleteID, setItemToDeleteID] = useState<number | null>(null);
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
        setItemToDeleteID(id);
        setIsDeleteAlertOpen(true);
    };

    const confirmDelete = () => {
        if (itemToDeleteID === null) return;

        if (selectedMaster === "Warehouses") {
            // Check if used in bins
            if (bins.some(b => b.warehouse_id === itemToDeleteID)) {
                toast({ variant: "destructive", title: "Cannot Delete", description: "Warehouse is used in Bins." });
                setIsDeleteAlertOpen(false);
                setItemToDeleteID(null);
                return;
            }
            setWarehouses(prev => prev.filter(item => item.id !== itemToDeleteID));
        } else {
            setBins(prev => prev.filter(item => item.id !== itemToDeleteID));
        }
        toast({ title: "Deleted", description: "Record deleted successfully." });
        setIsDeleteAlertOpen(false);
        setItemToDeleteID(null);
    };

    const handleSave = () => {
        const now = new Date().toISOString();

        if (selectedMaster === "Warehouses") {
            if (!formData.code || !formData.name || !formData.status || !formData.location || !formData.department) {
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
                            <TableHead>Department</TableHead>
                            <TableHead className="text-center">Bins</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No warehouses found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => {
                                const binCount = bins.filter(b => b.warehouse_id === item.id).length;
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{item.location}</TableCell>
                                        <TableCell>{item.department}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                                {binCount}
                                            </Badge>
                                        </TableCell>
                                        <TableCell><StatusBadge status={item.status} /></TableCell>
                                        <TableCell className="text-center">
                                            <TableActionButtons
                                                onEdit={() => handleEditClick(item)}
                                                onDelete={() => handleDeleteClick(item.id)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })
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
                            <TableHead className="text-center w-[100px]">Actions</TableHead>
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
                                        <TableCell className="text-center">
                                            <TableActionButtons
                                                onEdit={() => handleEditClick(item)}
                                                onDelete={() => handleDeleteClick(item.id)}
                                            />
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
                            <Label>Department *</Label>
                            <Select value={formData.department} onValueChange={(val: any) => setFormData({ ...formData, department: val })}>
                                <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                                <SelectContent>
                                    {DEPARTMENTS.map(dept => (
                                        <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
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
        } else if (selectedMaster === "Bins") {
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
        <div className="flex flex-col gap-6 h-full overflow-hidden">
            <div className="flex flex-col gap-2 shrink-0">
                <h1 className="text-3xl font-bold tracking-tight">Inventory Masters</h1>
                <p className="text-muted-foreground">
                    Manage warehouses, bins, and other inventory configurations.
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
                    <AppListToolbar
                        search={{
                            placeholder: `Search ${selectedMaster.toLowerCase()}...`,
                            value: searchTerm,
                            onChange: setSearchTerm
                        }}
                        filters={[
                            ...(selectedMaster === "Bins" ? [{
                                type: "select" as const,
                                label: "Warehouse",
                                value: filterWarehouse,
                                onChange: setFilterWarehouse,
                                options: [
                                    { label: "All Warehouses", value: "All" },
                                    ...warehouses.map(w => ({ label: w.name, value: w.id.toString() }))
                                ],
                                searchable: true
                            }] : []),
                            {
                                type: "select" as const,
                                label: "Status",
                                value: filterStatus,
                                onChange: setFilterStatus,
                                options: [
                                    { label: "All Status", value: "All" },
                                    { label: "Active", value: "Active" },
                                    { label: "Inactive", value: "Inactive" }
                                ],
                                searchable: true
                            }
                        ]}
                        actions={[
                            {
                                label: `Create ${selectedMaster === "Warehouses" ? "Warehouse" : "Bin"}`,
                                icon: <Plus className="mr-2 h-4 w-4" />,
                                onClick: handleAddClick
                            }
                        ]}
                    />

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
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle>{editingId ? "Edit" : "Create"} {selectedMaster === "Warehouses" ? "Warehouse" : "Bin"}</DialogTitle>
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

            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Record</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this record? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
