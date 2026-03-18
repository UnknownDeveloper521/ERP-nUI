import { useState, useEffect } from "react";
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
import { Plus, Search, Trash2, Package, X, ChevronLeft, ChevronRight, Edit } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInputBorderless,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { allMockMaterials, mockStates, mockCities } from "@/lib/masterMockData";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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

const PAYMENT_TERMS_OPTIONS = [
    "Net 30",
    "Net 15",
    "Advance",
    "COD",
    "Due on Receipt"
];

// --- Types & Interfaces ---

interface VendorAddress {
    id: number;
    address_line: string;
    country: string;
    state: string;
    city: string;
    pincode?: string;
}

interface VendorDocument {
    id: number;
    name: string;
    file_name?: string;
    file?: File | null;
}

interface VendorItemLink {
    item_id: string;
    cost_per_unit: number;
    delivery_time_days: number;
}

interface Vendor {
    id: number;
    code: string;
    name: string;
    contact_person: string;
    mobile: string;
    email?: string;
    phone?: string;
    addresses: VendorAddress[];
    documents: VendorDocument[];
    supplied_items: VendorItemLink[];
    tax_reg_no?: string;
    payment_terms: string;
    currency?: string;
    notes?: string;
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

const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 pb-2 mb-4 border-b">
        <h3 className="font-semibold text-sm text-primary">{title}</h3>
    </div>
);

export default function Vendors() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
    const [currentPage, setCurrentPage] = useState(1);
    // Pagination state - using DataTablePagination component
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<Partial<Vendor>>({});

    const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
    const [activeVendorId, setActiveVendorId] = useState<number | null>(null);
    const [vendorItems, setVendorItems] = useState<VendorItemLink[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string>("");
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [vendorItemErrors, setVendorItemErrors] = useState<Record<string, string>>({});
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [vendorToDelete, setVendorToDelete] = useState<number | null>(null);

    const filteredVendors = vendors.filter((v) => {
        const searchLower = searchTerm.toLowerCase();
        return (
            v.name?.toLowerCase().includes(searchLower) ||
            v.code?.toLowerCase().includes(searchLower) ||
            v.contact_person?.toLowerCase().includes(searchLower) ||
            v.addresses?.some(a => a.city?.toLowerCase().includes(searchLower))
        );
    });

    const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);
    const paginatedVendors = filteredVendors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Auto-adjust page when data changes
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredVendors.length, currentPage, totalPages]);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const handleAddClick = () => {
        setEditingId(null);
        setFormData({
            payment_terms: "Net 30",
            addresses: [{ id: Date.now(), address_line: "", country: "India", state: "", city: "" }],
            documents: []
        });
        setIsDialogOpen(true);
    };

    const handleEditClick = (vendor: Vendor) => {
        setEditingId(vendor.id);
        const data = { ...vendor };
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
        setVendorToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (vendorToDelete !== null) {
            setVendors(prev => prev.filter(v => v.id !== vendorToDelete));
            toast({ title: "Deleted", description: "Vendor deleted successfully." });
            setVendorToDelete(null);
            setIsDeleteDialogOpen(false);
            setIsDialogOpen(false);
        }
    };

    const handleSave = () => {
        const now = new Date().toISOString().split('T')[0];
        const user = "Admin User";

        if (!formData.code || !formData.name || !formData.contact_person || !formData.mobile) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
            return;
        }

        if (!formData.addresses || formData.addresses.length === 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "At least one address is required." });
            return;
        }

        const invalidAddr = formData.addresses.find(a => !a.address_line || !a.country || !a.state || !a.city);
        if (invalidAddr) {
            toast({ variant: "destructive", title: "Validation Error", description: "Please complete all fields in address blocks." });
            return;
        }

        if (vendors.some(v => v.id !== editingId && v.code.toLowerCase() === formData.code?.toLowerCase())) {
            toast({ variant: "destructive", title: "Validation Error", description: "Vendor Code must be unique." });
            return;
        }

        if (editingId) {
            setVendors(prev => prev.map(item => item.id === editingId ? { ...item, ...formData, updated_at: now, updated_by: user } as Vendor : item));
            toast({ title: "Updated", description: "Vendor updated successfully" });
        } else {
            const newId = Math.max(...vendors.map(v => v.id), 0) + 1;
            const newItem = { ...formData, id: newId, created_at: now, created_by: user, supplied_items: [] } as Vendor;
            setVendors(prev => [...prev, newItem]);
            toast({ title: "Created", description: "Vendor created successfully" });
        }
        setIsDialogOpen(false);
    };

    const handleVendorItemsClick = (vendor: Vendor) => {
        setActiveVendorId(vendor.id);
        setVendorItems(vendor.supplied_items || []);
        setVendorItemErrors({});
        setIsItemDialogOpen(true);
    };

    const handleSaveVendorItems = () => {
        if (activeVendorId === null) return;
        setVendors(prev => prev.map(v => v.id === activeVendorId ? { ...v, supplied_items: vendorItems } : v));
        toast({ title: "Updated", description: "Vendor items updated successfully." });
        setIsItemDialogOpen(false);
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Vendors Master</h1>
                <p className="text-muted-foreground text-sm">Manage your suppliers, their locations, and supplied items.</p>
            </div>

            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: setSearchTerm,
                    placeholder: "Search by vendor name, code or city..."
                }}
                actions={[
                    {
                        label: 'Add New Vendor',
                        icon: <Plus className="h-4 w-4 mr-2" />,
                        onClick: handleAddClick,
                        variant: 'default'
                    }
                ]}
            />

            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[120px]">Code</TableHead>
                                    <TableHead>Vendor Name</TableHead>
                                    <TableHead>Contact Person</TableHead>
                                    <TableHead>Mobile</TableHead>
                                    <TableHead>Payment Terms</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedVendors.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                            No vendors found matching your search.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedVendors.map((vendor) => (
                                        <TableRow key={vendor.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-mono text-sm font-medium">{vendor.code}</TableCell>
                                            <TableCell className="font-medium text-sm">{vendor.name}</TableCell>
                                            <TableCell className="text-sm">{vendor.contact_person}</TableCell>
                                            <TableCell className="text-sm">{vendor.mobile}</TableCell>
                                            <TableCell className="text-sm">{vendor.payment_terms}</TableCell>
                                             <TableCell className="text-center">
                                                <TableActionButtons
                                                    customActions={
                                                        <>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                                                                title="Supplied Items" 
                                                                onClick={() => handleVendorItemsClick(vendor)}
                                                            >
                                                                <Package className="h-4 w-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-muted-foreground hover:text-primary" 
                                                                onClick={() => handleEditClick(vendor)}
                                                                title="Edit"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination - using standardized DataTablePagination component */}
                    <DataTablePagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredVendors.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        options={[10, 15, 30, 50]}
                    />
                </CardContent>
            </Card>

            {/* Vendor Form Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Vendor" : "Create New Vendor"}</DialogTitle>
                        <DialogDescription>
                            Enter vendor details, contact information and office locations.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="code" className="text-xs font-semibold">Vendor Code *</Label>
                                <Input
                                    id="code"
                                    value={formData.code || ""}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="e.g. V-SUP001"
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-xs font-semibold">Vendor Name *</Label>
                                <Input
                                    id="name"
                                    value={formData.name || ""}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. ABC Supplies Ltd"
                                    className="h-9"
                                />
                            </div>
                        </div>

                        <SectionHeader title="Primary Contact" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contact_person" className="text-xs font-semibold">Contact Person Name *</Label>
                                <Input
                                    id="contact_person"
                                    value={formData.contact_person || ""}
                                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                    placeholder="John Doe"
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mobile" className="text-xs font-semibold">Mobile Number *</Label>
                                <Input
                                    id="mobile"
                                    value={formData.mobile || ""}
                                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                    placeholder="+91 98765 43210"
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs font-semibold">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email || ""}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="vendor@example.com"
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="payment_terms" className="text-xs font-semibold">Payment Terms</Label>
                                <Select
                                    value={formData.payment_terms || ""}
                                    onValueChange={(val) => setFormData({ ...formData, payment_terms: val })}
                                >
                                    <SelectTrigger id="payment_terms" className="h-9">
                                        <SelectValue placeholder="Select Payment Terms" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAYMENT_TERMS_OPTIONS.map((opt) => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <SectionHeader title="Office Locations" />
                        <div className="space-y-4">
                            {formData.addresses?.map((addr, idx) => (
                                <div key={addr.id} className="p-4 rounded-md border bg-muted/20 relative">
                                    {formData.addresses!.length > 1 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 absolute top-2 right-2 text-destructive"
                                            onClick={() => setFormData({ ...formData, addresses: formData.addresses!.filter(a => a.id !== addr.id) })}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 space-y-2">
                                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Address Line {idx + 1} *</Label>
                                            <Input
                                                value={addr.address_line}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    addresses: formData.addresses!.map(a => a.id === addr.id ? { ...a, address_line: e.target.value } : a)
                                                })}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">State *</Label>
                                            <Select
                                                value={addr.state}
                                                onValueChange={(val) => setFormData({
                                                    ...formData,
                                                    addresses: formData.addresses!.map(a => a.id === addr.id ? { ...a, state: val, city: "" } : a)
                                                })}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="Select State" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {mockStates.filter(s => s.status === "Active" && s.country === addr.country).map(state => (
                                                        <SelectItem key={state.id} value={state.name}>{state.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">City *</Label>
                                            <Select
                                                value={addr.city}
                                                onValueChange={(val) => setFormData({
                                                    ...formData,
                                                    addresses: formData.addresses!.map(a => a.id === addr.id ? { ...a, city: val } : a)
                                                })}
                                                disabled={!addr.state}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder={addr.state ? "Select City" : "Select state first"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {mockCities.filter(c => c.status === "Active" && c.state === addr.state).map(city => (
                                                        <SelectItem key={city.id} value={city.name}>{city.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                className="h-8 text-xs border-dashed w-full"
                                onClick={() => setFormData({
                                    ...formData,
                                    addresses: [...(formData.addresses || []), { id: Date.now(), address_line: "", country: "India", state: "", city: "" }]
                                })}
                            >
                                <Plus className="h-3 w-3 mr-1" /> Add Another Location
                            </Button>
                        </div>

                        <SectionHeader title="Additional Notes" />
                        <div className="space-y-2">
                            <Textarea
                                value={formData.notes || ""}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Any internal notes or special instructions for this vendor..."
                                className="min-h-[100px] resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter className={cn(editingId ? "sm:justify-between" : "sm:justify-end")}>
                        {editingId && (
                            <Button
                                variant="destructive"
                                onClick={() => handleDeleteClick(editingId)}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </Button>
                        )}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
                                {editingId ? "Update Vendor" : "Create Vendor"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Vendor Items Dialog */}
            <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>Manage Supplied Items</DialogTitle>
                        <DialogDescription>
                            Map items that this vendor supplies along with cost and lead time.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isComboboxOpen}
                                            className="w-full justify-between h-9 font-normal"
                                        >
                                            {selectedItemId
                                                ? allMockMaterials.find(m => m.id === selectedItemId)?.name
                                                : "Search & select item..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 pointer-events-auto shadow-md" style={{ width: "var(--radix-popover-trigger-width)" }} align="start">
                                        <Command>
                                            <CommandInputBorderless placeholder="Search item..." />
                                            <CommandList className="max-h-[200px] overflow-y-auto">
                                                <CommandEmpty>No item found.</CommandEmpty>
                                                <CommandGroup>
                                                    {allMockMaterials.map((m) => {
                                                        const isAdded = vendorItems.some(vi => vi.item_id === m.id);
                                                        return (
                                                            <CommandItem
                                                                key={m.id}
                                                                value={m.name}
                                                                onSelect={() => {
                                                                    setSelectedItemId(m.id.toString());
                                                                    setIsComboboxOpen(false);
                                                                }}
                                                                disabled={isAdded}
                                                                className={cn(isAdded && "opacity-50")}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        selectedItemId === m.id.toString() ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium text-sm">{m.name}</span>
                                                                    <span className="text-[10px] text-muted-foreground">{m.id}</span>
                                                                </div>
                                                                {isAdded && <span className="ml-auto text-[10px] italic">Already mapped</span>}
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
                                onClick={() => {
                                    if (!selectedItemId) return;
                                    const id = selectedItemId;
                                    if (vendorItems.some(vi => vi.item_id === id)) return;
                                    setVendorItems([...vendorItems, { item_id: id, cost_per_unit: 0, delivery_time_days: 1 }]);
                                    setSelectedItemId("");
                                }}
                                disabled={!selectedItemId}
                                className="h-9 px-6"
                            >
                                <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                        </div>

                        <div className="rounded-md border max-h-[400px] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="text-xs h-9">Item Name</TableHead>
                                        <TableHead className="w-[120px] text-xs h-9">Cost/Unit</TableHead>
                                        <TableHead className="w-[120px] text-xs h-9">Lead Time (Days)</TableHead>
                                        <TableHead className="w-[40px] h-9"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vendorItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-20 text-center text-muted-foreground text-xs italic">
                                                No items mapped to this vendor.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        vendorItems.map((vi) => {
                                            const item = allMockMaterials.find(m => m.id === vi.item_id);
                                            return (
                                                <TableRow key={vi.item_id}>
                                                    <TableCell className="py-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium">{item?.name || "Unknown Item"}</span>
                                                            <span className="text-[10px] text-muted-foreground font-mono">{item?.id}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Input
                                                            type="number"
                                                            value={vi.cost_per_unit}
                                                            onChange={(e) => setVendorItems(prev => prev.map(v => v.item_id === vi.item_id ? { ...v, cost_per_unit: parseFloat(e.target.value) || 0 } : v))}
                                                            className="h-8 text-sm"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Input
                                                            type="number"
                                                            value={vi.delivery_time_days}
                                                            onChange={(e) => setVendorItems(prev => prev.map(v => v.item_id === vi.item_id ? { ...v, delivery_time_days: parseInt(e.target.value) || 0 } : v))}
                                                            className="h-8 text-sm"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-2 pr-4">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                            onClick={() => setVendorItems(prev => prev.filter(v => v.item_id !== vi.item_id))}
                                                        >
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

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveVendorItems} disabled={vendorItems.length === 0}>Save Mapping</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this vendor? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setVendorToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
