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
import { Plus, Search, Pencil, Trash2, ChevronsUpDown, Check, Package, Sliders, ChevronLeft, ChevronRight } from "lucide-react";
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

type MasterType = "Vendors" | "Items" | "RM Threshold";

const MASTER_SLUGS: Record<MasterType, string> = {
    "Vendors": "vendors",
    "Items": "items",
    "RM Threshold": "rm-threshold",
};

const MASTER_TYPES: MasterType[] = ["Vendors", "Items", "RM Threshold"];

interface VendorAddress {
    id: number; // local temp id
    address_line: string;
    country: string;
    state: string;
    city: string;
    pincode?: string;
}

interface VendorDocument {
    id: number;
    name: string;
    file_name?: string; // For display
    file?: File | null;
}

interface VendorItemLink {
    item_id: number;
    cost_per_unit: number;
    delivery_time_days: number;
}

interface Vendor {
    id: number;
    // Basic Info
    code: string;
    name: string;
    status: "Active" | "Inactive";

    // Primary Contact
    contact_person: string;
    mobile: string;
    email?: string;
    phone?: string;

    // Locations
    addresses: VendorAddress[];

    // Documents
    documents: VendorDocument[];

    // Supplied Items
    supplied_items: VendorItemLink[];

    // Tax / Registration
    tax_reg_no?: string;

    // Purchase Settings
    payment_terms: string;
    currency?: string;

    // Notes
    notes?: string;

    // Audit
    created_at?: string;
    created_by?: string;
    updated_at?: string;
    updated_by?: string;
}

interface Item {
    id: number;
    // Basic Info
    code: string;
    name: string;
    type: "RM" | "SFG" | "FG" | "Consumable" | "Service";
    uom: string;

    // Classification
    category?: string;

    // Inventory Controls
    is_expiry_tracked: boolean;
    shelf_life_days?: number;

    // Status
    status: "Active" | "Inactive";

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

// --- Mock Data ---

const initialVendors: Vendor[] = [
    {
        id: 1,
        code: "V001",
        name: "ABC Supplies Ltd",
        status: "Active",
        contact_person: "John Doe",
        mobile: "9876543210",
        email: "john@abc.com",
        addresses: [
            {
                id: 1,
                address_line: "123 Ind Area",
                country: "India",
                state: "Maharashtra",
                city: "Mumbai",
                pincode: "400001"
            }
        ],
        documents: [],
        supplied_items: [],
        tax_reg_no: "GSTIN12345",
        payment_terms: "Net 30",
        created_at: "2024-01-01",
        created_by: "Admin"
    },
    {
        id: 2,
        code: "V002",
        name: "XYZ Services",
        status: "Active",
        contact_person: "Jane Smith",
        mobile: "9876543211",
        email: "jane@xyz.com",
        addresses: [
            {
                id: 1,
                address_line: "456 Tech Park",
                country: "India",
                state: "Karnataka",
                city: "Bangalore",
                pincode: "560001"
            }
        ],
        documents: [],
        supplied_items: [],
        payment_terms: "Net 15",
        created_at: "2024-01-02",
        created_by: "Admin"
    }
];


const initialItems: Item[] = [
    {
        id: 1,
        code: "RM001",
        name: "Steel Sheet 2mm",
        type: "RM",
        uom: "kg",
        category: "Metals",
        is_expiry_tracked: false,
        status: "Active",
        created_at: "2024-01-01",
        created_by: "Admin"
    },
    {
        id: 2,
        code: "CHEM001",
        name: "Industrial Solvent",
        type: "Consumable",
        uom: "ltr",
        category: "Chemicals",
        is_expiry_tracked: true,
        shelf_life_days: 365,
        status: "Active",
        created_at: "2024-01-02",
        created_by: "Admin"
    }
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

    const activeTab = params.tab || "purchase";

    const getValidMaster = (type: string | undefined): MasterType => {
        if (type) {
            const entry = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === type);
            if (entry) return entry[0] as MasterType;
        }
        return "Vendors";
    };

    const selectedMaster = getValidMaster(params.type);

    const [searchTerm, setSearchTerm] = useState("");
    const [open, setOpen] = useState(false); // Master type selector open state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const updateRoute = (tab: string, type: MasterType) => {
        const slug = MASTER_SLUGS[type] || type.toLowerCase();
        setLocation(`/masters/procurement/${tab}/${slug}`);
    };

    const handleMasterChange = (newMaster: MasterType) => {
        updateRoute(activeTab, newMaster);
        setSearchTerm("");
        setOpen(false);
        setFilterType("All");
        setFilterStatus("All");
        setCurrentPage(1);
    };

    // State for mock data
    const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
    const [items, setItems] = useState<Item[]>(initialItems);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<any>({}); // Using any for hybrid form data

    // Filters
    const [filterType, setFilterType] = useState<string>("All");
    const [filterStatus, setFilterStatus] = useState<string>("All");
    const [filterConfigured, setFilterConfigured] = useState<string>("All"); // "All" | "Configured" | "Not Configured"

    // Vendor Items Dialog State
    const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
    const [activeVendorId, setActiveVendorId] = useState<number | null>(null);
    const [vendorItems, setVendorItems] = useState<VendorItemLink[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string>("");
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [vendorItemErrors, setVendorItemErrors] = useState<Record<string, string>>({}); // valid: "id-field" -> error msg


    // --- Helpers ---

    const getData = () => {
        if (selectedMaster === "Vendors") return vendors;
        if (selectedMaster === "Items") return items;
        if (selectedMaster === "RM Threshold") return items.filter(i => i.type === "RM");
        return [];
    };

    const currentData = getData().filter((item: any) => {
        const searchLower = searchTerm.toLowerCase();
        let matchesSearch = false;

        if (selectedMaster === "Vendors") {
            const v = item as Vendor;
            matchesSearch =
                v.name.toLowerCase().includes(searchLower) ||
                v.code.toLowerCase().includes(searchLower) ||
                v.contact_person.toLowerCase().includes(searchLower) ||
                v.addresses.some(a => a.city.toLowerCase().includes(searchLower));
        } else if (selectedMaster === "RM Threshold") {
            matchesSearch =
                item.name.toLowerCase().includes(searchLower) ||
                item.code.toLowerCase().includes(searchLower);

            if (filterConfigured === "Configured") {
                matchesSearch = matchesSearch && (item.daily_required_qty !== undefined && item.daily_required_qty > 0);
            } else if (filterConfigured === "Not Configured") {
                matchesSearch = matchesSearch && (item.daily_required_qty === undefined || item.daily_required_qty === 0);
            }
        } else {
            matchesSearch =
                item.name.toLowerCase().includes(searchLower) ||
                item.code.toLowerCase().includes(searchLower);
        }

        const matchesType = filterType === "All" || item.type === filterType;
        const matchesStatus = filterStatus === "All" || item.status === filterStatus;

        return matchesSearch && matchesType && matchesStatus;
    });

    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    const paginatedData = currentData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleAddClick = () => {
        setEditingId(null);
        if (selectedMaster === "Vendors") {
            setFormData({
                status: "Active",
                payment_terms: "Net 30",
                addresses: [{ id: Date.now(), address_line: "", country: "India", state: "", city: "" }],
                documents: []
            });
        } else if (selectedMaster === "Items") {
            setFormData({
                status: "Active",
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
        // Ensure addresses array exists for legacy data or is populated
        if (!data.addresses || data.addresses.length === 0) {
            data.addresses = [{ id: Date.now(), address_line: "", country: "India", state: "", city: "" }];
        }
        if (!data.documents) {
            data.documents = [];
        }
        setFormData(data);
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (id: number) => {
        if (confirm("Are you sure? This action cannot be undone.")) {
            if (selectedMaster === "Vendors") {
                setVendors(prev => prev.filter(item => item.id !== id));
            } else {
                setItems(prev => prev.filter(item => item.id !== id));
            }
            toast({ title: "Deleted", description: "Record deleted successfully." });
        }
    };

    const handleSave = () => {
        const now = new Date().toISOString().split('T')[0];
        const user = "Admin User";

        if (selectedMaster === "Vendors") {
            // Vendor Validation
            const vData = formData as Vendor;
            if (!vData.code || !vData.name || !vData.status ||
                !vData.contact_person || !vData.mobile || !vData.payment_terms) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }

            // Address Validation
            if (!vData.addresses || vData.addresses.length === 0) {
                toast({ variant: "destructive", title: "Validation Error", description: "At least one address is required." });
                return;
            }
            const invalidAddr = vData.addresses.find(a => !a.address_line || !a.country || !a.state || !a.city);
            if (invalidAddr) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please complete all fields in address blocks." });
                return;
            }
            // Duplicate Check (Code)
            if (vendors.some(v => v.id !== editingId && v.code.toLowerCase() === formData.code?.toLowerCase())) {
                toast({ variant: "destructive", title: "Validation Error", description: "Vendor Code must be unique." });
                return;
            }

            if (editingId) {
                setVendors(prev => prev.map(item => item.id === editingId ? { ...item, ...formData, updated_at: now, updated_by: user } as Vendor : item));
                toast({ title: "Updated", description: "Vendor updated successfully" });
            } else {
                const newId = Math.max(...vendors.map(v => v.id), 0) + 1;
                const newItem = { ...formData, id: newId, created_at: now, created_by: user } as Vendor;
                setVendors(prev => [...prev, newItem]);
                toast({ title: "Created", description: "Vendor created successfully" });
            }
        } else if (selectedMaster === "Items") {
            // Item Validation
            if (!formData.code || !formData.name || !formData.type || !formData.uom || !formData.status) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
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
        } else if (selectedMaster === "RM Threshold") {
            const qty = parseFloat(formData.daily_required_qty);
            if (isNaN(qty) || qty < 0) {
                toast({ variant: "destructive", title: "Validation Error", description: "Daily Required Quantity cannot be negative." });
                return;
            }

            if (editingId) {
                setItems(prev => prev.map(item => item.id === editingId ? { ...item, daily_required_qty: qty, updated_at: now, updated_by: user } : item));
                toast({ title: "Updated", description: "RM Threshold updated" });
            }
        }
        setIsDialogOpen(false);
    };


    const handleAddAddress = () => {
        setFormData((prev: Vendor) => ({
            ...prev,
            addresses: [
                ...prev.addresses,
                { id: Date.now(), address_line: "", country: "India", state: "", city: "" }
            ]
        }));
    };

    const handleRemoveAddress = (id: number) => {
        setFormData((prev: Vendor) => ({
            ...prev,
            addresses: prev.addresses.filter(a => a.id !== id)
        }));
    };

    const handleAddressChange = (id: number, field: keyof VendorAddress, value: string) => {
        setFormData((prev: Vendor) => ({
            ...prev,
            addresses: prev.addresses.map(a => a.id === id ? { ...a, [field]: value } : a)
        }));
    };

    const handleAddDocument = () => {
        setFormData((prev: Vendor) => ({
            ...prev,
            documents: [
                ...prev.documents,
                { id: Date.now(), name: "", file: null }
            ]
        }));
    };

    const handleRemoveDocument = (id: number) => {
        setFormData((prev: Vendor) => ({
            ...prev,
            documents: prev.documents.filter(d => d.id !== id)
        }));
    };

    const handleDocumentChange = (id: number, field: keyof VendorDocument, value: any) => {
        setFormData((prev: Vendor) => ({
            ...prev,
            documents: prev.documents.map(d => d.id === id ? { ...d, [field]: value } : d)
        }));
    };

    const handleVendorItemsClick = (vendor: Vendor) => {
        setActiveVendorId(vendor.id);
        setVendorItems(vendor.supplied_items || []);
        setVendorItemErrors({}); // Reset errors
        setIsItemDialogOpen(true);
    };

    const handleSaveVendorItems = () => {
        if (activeVendorId === null) return;
        setVendors(prev => prev.map(v => v.id === activeVendorId ? { ...v, supplied_items: vendorItems } : v));
        toast({ title: "Updated", description: "Vendor items updated successfully." });
        setIsItemDialogOpen(false);
    };

    const handleAddVendorItemLink = () => {
        if (!selectedItemId) return;
        const itemId = parseInt(selectedItemId);
        if (vendorItems.some(vi => vi.item_id === itemId)) {
            toast({ variant: "destructive", title: "Error", description: "Item already added." });
            return;
        }
        setVendorItems(prev => [...prev, { item_id: itemId, cost_per_unit: 0, delivery_time_days: 0 }]);
        setSelectedItemId("");
    };

    const handleUpdateVendorItem = (itemId: number, field: keyof VendorItemLink, value: number) => {
        setVendorItems(prev => prev.map(vi => vi.item_id === itemId ? { ...vi, [field]: value } : vi));
    };

    const handleRemoveVendorItem = (itemId: number) => {
        setVendorItems(prev => prev.filter(vi => vi.item_id !== itemId));
        setVendorItemErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[`${itemId}-cost_per_unit`];
            delete newErrors[`${itemId}-delivery_time_days`];
            return newErrors;
        });
    };

    // --- Renderers ---

    const renderTable = () => {
        if (selectedMaster === "Vendors") {
            return (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Code</TableHead>
                            <TableHead>Vendor Name</TableHead>
                            <TableHead>Contact Person</TableHead>
                            <TableHead>Mobile</TableHead>
                            <TableHead>Locations</TableHead>
                            <TableHead>Payment Terms</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                    No vendors found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.code}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.contact_person}</TableCell>
                                    <TableCell>{item.mobile}</TableCell>
                                    <TableCell>
                                        {(item as Vendor).addresses?.length > 0
                                            ? `${(item as Vendor).addresses[0].city} ${((item as Vendor).addresses.length > 1 ? `(+${(item as Vendor).addresses.length - 1})` : "")}`
                                            : "-"}
                                    </TableCell>
                                    <TableCell>{item.payment_terms}</TableCell>
                                    <TableCell><StatusBadge status={item.status} /></TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleVendorItemsClick(item)}>
                                                <Package className="h-4 w-4" />
                                            </Button>
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
        } else if (selectedMaster === "RM Threshold") {
            // RM Threshold Table
            return (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Item Code</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>UOM</TableHead>
                            <TableHead>Daily Required Qty</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No RM items found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            currentData.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.code}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.uom}</TableCell>
                                    <TableCell>
                                        {item.daily_required_qty !== undefined ? (
                                            <Badge variant="outline">{item.daily_required_qty}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell><StatusBadge status={item.status} /></TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => handleEditClick(item)}>
                                            <Sliders className="h-4 w-4 mr-2" /> Configure
                                        </Button>
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
                            <TableHead>Status</TableHead>
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
        }
    };

    const renderForm = () => {
        if (selectedMaster === "Vendors") {
            return (
                <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-1">
                    {/* A) Basic Info */}
                    <div>
                        <SectionHeader title="Basic Info" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Vendor Code *</Label>
                                <Input id="code" value={formData.code || ""} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ex: V003" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Vendor Name *</Label>
                                <Input id="name" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Company Name" />
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
                        </div>
                    </div>

                    {/* B) Primary Contact */}
                    <div>
                        <SectionHeader title="Primary Contact" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contact_person">Contact Person Name *</Label>
                                <Input id="contact_person" value={formData.contact_person || ""} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mobile">Mobile Number *</Label>
                                <Input id="mobile" value={formData.mobile || ""} onChange={e => setFormData({ ...formData, mobile: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" value={formData.email || ""} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" value={formData.phone || ""} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    {/* C) Multiple Locations */}
                    <div>
                        <div className="flex items-center justify-between pb-2 mb-4 border-b">
                            <h3 className="font-semibold text-sm text-primary">Locations</h3>
                            <Button variant="outline" size="sm" onClick={handleAddAddress} type="button">
                                <Plus className="h-4 w-4 mr-2" /> Add Location
                            </Button>
                        </div>

                        <div className="space-y-6">
                            {(formData.addresses || []).map((addr: VendorAddress, index: number) => (
                                <div key={addr.id} className="relative p-4 border rounded-lg bg-muted/10 group">
                                    {/* Delete Button */}
                                    {(formData.addresses?.length > 1) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-2 right-2 text-muted-foreground hover:text-destructive h-6 w-6"
                                            onClick={() => handleRemoveAddress(addr.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 space-y-2">
                                            <Label>Address Line *</Label>
                                            <Input
                                                value={addr.address_line}
                                                onChange={(e) => handleAddressChange(addr.id, "address_line", e.target.value)}
                                                placeholder={`Location ${index + 1} Address`}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Country *</Label>
                                            <Select value={addr.country} onValueChange={(val) => handleAddressChange(addr.id, "country", val)}>
                                                <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="India">India</SelectItem>
                                                    <SelectItem value="USA">USA</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>State *</Label>
                                            <Select value={addr.state} onValueChange={(val) => handleAddressChange(addr.id, "state", val)}>
                                                <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                                                    <SelectItem value="Gujarat">Gujarat</SelectItem>
                                                    <SelectItem value="Karnataka">Karnataka</SelectItem>
                                                    <SelectItem value="Delhi">Delhi</SelectItem>
                                                    <SelectItem value="California">California</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>City *</Label>
                                            <Select value={addr.city} onValueChange={(val) => handleAddressChange(addr.id, "city", val)}>
                                                <SelectTrigger><SelectValue placeholder="Select City" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Mumbai">Mumbai</SelectItem>
                                                    <SelectItem value="Pune">Pune</SelectItem>
                                                    <SelectItem value="Ahmedabad">Ahmedabad</SelectItem>
                                                    <SelectItem value="Bangalore">Bangalore</SelectItem>
                                                    <SelectItem value="New Delhi">New Delhi</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Pincode</Label>
                                            <Input
                                                value={addr.pincode || ""}
                                                onChange={(e) => handleAddressChange(addr.id, "pincode", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* D) Documents */}
                    <div>
                        <div className="flex items-center justify-between pb-2 mb-4 border-b">
                            <h3 className="font-semibold text-sm text-primary">Documents</h3>
                            <Button variant="outline" size="sm" onClick={handleAddDocument} type="button">
                                <Plus className="h-4 w-4 mr-2" /> Add Document
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {(formData.documents || []).map((doc: VendorDocument, index: number) => (
                                <div key={doc.id} className="flex items-end gap-4 p-3 border rounded-lg bg-muted/10">
                                    <div className="flex-1 space-y-2">
                                        <Label>Document Name</Label>
                                        <Input
                                            value={doc.name}
                                            onChange={(e) => handleDocumentChange(doc.id, "name", e.target.value)}
                                            placeholder="e.g. GST Certificate"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <Label>Attachment</Label>
                                        <Input
                                            type="file"
                                            className="cursor-pointer"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0] || null;
                                                handleDocumentChange(doc.id, "file", file);
                                            }}
                                        />
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="mb-0.5 text-muted-foreground hover:text-destructive shrink-0"
                                        onClick={() => handleRemoveDocument(doc.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            {(!formData.documents || formData.documents.length === 0) && (
                                <div className="text-center py-4 text-sm text-muted-foreground border border-dashed rounded-lg">
                                    No documents attached. Click "Add Document" to attach files.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* E) Tax / Registration */}
                    <div>
                        <SectionHeader title="Tax / Registration" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="tax_reg">Tax Registration No.</Label>
                                <Input id="tax_reg" value={formData.tax_reg_no || ""} onChange={e => setFormData({ ...formData, tax_reg_no: e.target.value })} placeholder="GST/VAT/TIN" />
                            </div>

                        </div>
                    </div>

                    {/* E) Purchase Settings */}
                    <div>
                        <SectionHeader title="Purchase Settings" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Payment Terms *</Label>
                                <Select value={formData.payment_terms} onValueChange={(val: string) => setFormData({ ...formData, payment_terms: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select Terms" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Net 15">Net 15</SelectItem>
                                        <SelectItem value="Net 30">Net 30</SelectItem>
                                        <SelectItem value="Net 45">Net 45</SelectItem>
                                        <SelectItem value="Net 60">Net 60</SelectItem>
                                        <SelectItem value="Immediate">Immediate</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Default Currency</Label>
                                <Select value={formData.currency} onValueChange={(val: string) => setFormData({ ...formData, currency: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select Currency" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INR">INR</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="EUR">EUR</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* F) Notes */}
                    <div>
                        <SectionHeader title="Notes" />
                        <div className="space-y-2">
                            <Label htmlFor="notes">Remarks</Label>
                            <Textarea id="notes" value={formData.notes || ""} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any specific notes..." />
                        </div>
                    </div>
                </div>
            );
        } else if (selectedMaster === "RM Threshold") {
            return (
                <div className="grid gap-6 py-4 px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Item Code</Label>
                            <Input value={formData.code} disabled className="bg-muted" />
                        </div>
                        <div className="space-y-2">
                            <Label>Item Name</Label>
                            <Input value={formData.name} disabled className="bg-muted" />
                        </div>
                        <div className="space-y-2">
                            <Label>UOM</Label>
                            <Input value={formData.uom} disabled className="bg-muted" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="daily_required_qty">Daily Required Quantity *</Label>
                            <Input
                                id="daily_required_qty"
                                type="number"
                                min={0}
                                value={formData.daily_required_qty || ""}
                                onChange={e => setFormData({ ...formData, daily_required_qty: e.target.value })}
                                placeholder="Enter daily quantity"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                                <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            );
        } else {
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
                                        <SelectItem value="RM">RM (Raw Material)</SelectItem>
                                        <SelectItem value="SFG">SFG (Semi-Finished)</SelectItem>
                                        <SelectItem value="FG">FG (Finished Good)</SelectItem>
                                        <SelectItem value="Consumable">Consumable</SelectItem>
                                        <SelectItem value="Service">Service</SelectItem>
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

                    {/* B) Classification */}
                    <div>
                        <SectionHeader title="Classification" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={formData.category} onValueChange={(val: any) => setFormData({ ...formData, category: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Metals">Metals</SelectItem>
                                        <SelectItem value="Plastics">Plastics</SelectItem>
                                        <SelectItem value="Chemicals">Chemicals</SelectItem>
                                        <SelectItem value="Packaging">Packaging</SelectItem>
                                        <SelectItem value="Spares">Spares</SelectItem>
                                        <SelectItem value="Services">Services</SelectItem>
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
                                        value={formData.shelf_life_days || ""}
                                        onChange={e => setFormData({ ...formData, shelf_life_days: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* D) Status */}
                    <div>
                        <SectionHeader title="Status & Other" />
                        <div className="grid grid-cols-2 gap-4">
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
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Procurement Master</h1>
                <p className="text-muted-foreground">
                    Manage vendors, items, and procurement configurations.
                </p>
            </div>

            <Tabs value={activeTab} className="w-full flex-1 flex flex-col">
                <div className="border-b border-border">
                    <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                        <TabsTrigger
                            value="purchase"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                            onClick={() => updateRoute("purchase", "Vendors")}
                        >
                            Purchase
                        </TabsTrigger>
                        {/* More tabs can be added here */}
                    </TabsList>
                </div>

                <TabsContent value="purchase" className="m-0 h-full flex flex-col gap-6 mt-6">
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
                        <div className="w-full sm:w-1/6">
                            {selectedMaster === "RM Threshold" ? (
                                <>
                                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Configuration</Label>
                                    <Select value={filterConfigured} onValueChange={setFilterConfigured}>
                                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="All">All Items</SelectItem>
                                            <SelectItem value="Configured">Configured</SelectItem>
                                            <SelectItem value="Not Configured">Not Configured</SelectItem>
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
                                            {selectedMaster === "Vendors" ? (
                                                <>
                                                    <SelectItem value="Supplier">Supplier</SelectItem>
                                                    <SelectItem value="Service">Service</SelectItem>
                                                    <SelectItem value="Both">Both</SelectItem>
                                                </>
                                            ) : (
                                                <>
                                                    <SelectItem value="RM">RM</SelectItem>
                                                    <SelectItem value="SFG">SFG</SelectItem>
                                                    <SelectItem value="FG">FG</SelectItem>
                                                    <SelectItem value="Consumable">Consumable</SelectItem>
                                                    <SelectItem value="Service">Service</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </>
                            )}
                        </div>
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
                            {selectedMaster !== "RM Threshold" && (
                                <Button onClick={handleAddClick} className="w-full sm:w-auto">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add {selectedMaster === "Vendors" ? "Vendor" : "Item"}
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
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle>{editingId ? "Edit" : "Add New"} {selectedMaster === "Vendors" ? "Vendor" : "Item"}</DialogTitle>
                        <DialogDescription>
                            Configure the details for this {selectedMaster === "Vendors" ? "vendor" : "item"} entry.
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
                                if (selectedMaster === "Vendors") {
                                    const v = formData as Vendor;
                                    // Basic Fields
                                    if (!v.code || !v.name || !v.status || !v.contact_person || !v.mobile || !v.payment_terms) return true;

                                    // Address Validation (Min 1, and all fields)
                                    if (!v.addresses || v.addresses.length === 0) return true;
                                    if (v.addresses.some(a => !a.address_line || !a.country || !a.state || !a.city)) return true;

                                    return false;
                                } else if (selectedMaster === "Items") {
                                    // Basic Fields
                                    if (!formData.code || !formData.name || !formData.type || !formData.uom || !formData.status) return true;
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
            {/* Vendor Items Modal */}
            <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>Manage Supplied Items</DialogTitle>
                        <DialogDescription>
                            Assign items supplied by this vendor with cost and delivery details.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Get Currency */}
                    {(() => {
                        const activeVendor = vendors.find(v => v.id === activeVendorId);
                        const currency = activeVendor?.currency || "INR";

                        return (
                            <>
                                <div className="flex gap-4 items-end mb-4">
                                    <div className="flex-1 space-y-2">
                                        <Label>Select Item</Label>
                                        <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={isComboboxOpen}
                                                    className="w-full justify-between font-normal"
                                                >
                                                    {selectedItemId
                                                        ? items.find((item) => item.id.toString() === selectedItemId)?.name
                                                        : "Choose Item..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                                                <Command>
                                                    <CommandInput placeholder="Search item..." />
                                                    <CommandList>
                                                        <CommandEmpty>No item found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {items.filter(i => i.status === "Active").map((item) => {
                                                                const isAdded = vendorItems.some(vi => vi.item_id === item.id);
                                                                return (
                                                                    <CommandItem
                                                                        key={item.id}
                                                                        value={item.name}
                                                                        onSelect={() => {
                                                                            if (!isAdded) {
                                                                                setSelectedItemId(item.id.toString());
                                                                                setIsComboboxOpen(false);
                                                                            }
                                                                        }}
                                                                        disabled={isAdded}
                                                                        className={isAdded ? "opacity-50 cursor-not-allowed" : ""}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                selectedItemId === item.id.toString()
                                                                                    ? "opacity-100"
                                                                                    : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {item.code} - {item.name} {isAdded ? "(Added)" : ""}
                                                                    </CommandItem>
                                                                );
                                                            })}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <Button onClick={handleAddVendorItemLink} disabled={!selectedItemId}>
                                        <Plus className="h-4 w-4 mr-2" /> Add Item
                                    </Button>
                                </div>

                                <div className="rounded-md border max-h-[50vh] overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Item Name</TableHead>
                                                <TableHead className="w-[100px]">UOM</TableHead>
                                                <TableHead className="w-[150px]">Cost / Unit ({currency})</TableHead>
                                                <TableHead className="w-[120px]">Del. Time (Days)</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vendorItems.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                                        No items assigned yet.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                vendorItems.map(vi => {
                                                    const originalItem = items.find(i => i.id === vi.item_id);
                                                    return (
                                                        <TableRow key={vi.item_id}>
                                                            <TableCell className="font-medium">
                                                                <div>{originalItem?.name}</div>
                                                                <div className="text-xs text-muted-foreground">{originalItem?.code}</div>
                                                            </TableCell>
                                                            <TableCell>{originalItem?.uom}</TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        className={`h-8 w-24 ${vendorItemErrors[`${vi.item_id}-cost_per_unit`] ? "border-red-500" : ""}`}
                                                                        value={vi.cost_per_unit}
                                                                        onChange={(e) => handleUpdateVendorItem(vi.item_id, "cost_per_unit", parseFloat(e.target.value) || 0)}
                                                                    />
                                                                    <span className="text-xs text-muted-foreground">{currency}</span>
                                                                </div>
                                                                {vendorItemErrors[`${vi.item_id}-cost_per_unit`] && (
                                                                    <span className="text-[10px] text-red-500 block">{vendorItemErrors[`${vi.item_id}-cost_per_unit`]}</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    className={`h-8 ${vendorItemErrors[`${vi.item_id}-delivery_time_days`] ? "border-red-500" : ""}`}
                                                                    value={vi.delivery_time_days}
                                                                    onChange={(e) => handleUpdateVendorItem(vi.item_id, "delivery_time_days", parseInt(e.target.value) || 0)}
                                                                />
                                                                {vendorItemErrors[`${vi.item_id}-delivery_time_days`] && (
                                                                    <span className="text-[10px] text-red-500">{vendorItemErrors[`${vi.item_id}-delivery_time_days`]}</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveVendorItem(vi.item_id)}>
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

                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancel</Button>
                                    <Button
                                        onClick={handleSaveVendorItems}
                                        disabled={Object.keys(vendorItemErrors).length > 0 || vendorItems.length === 0}
                                    >
                                        Save Changes
                                    </Button>
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div >
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
