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
import { Plus, Search, Pencil, Trash2, ChevronsUpDown, Check, Package } from "lucide-react";
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

type MasterType = "Customers";

const MASTER_SLUGS: Record<MasterType, string> = {
    "Customers": "customers",
};

const MASTER_TYPES: MasterType[] = ["Customers"];

interface Address {
    id: number; // local temp id
    address_line: string;
    country: string;
    state: string;
    city: string;
    pincode?: string;
}

interface CustomerDocument {
    id: number;
    name: string;
    file_name?: string; // For display
    file?: File | null;
}

interface Customer {
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
    billing_address: Address;
    shipping_addresses: Address[];

    // Documents
    documents: CustomerDocument[];

    // Tax / Registration
    tax_reg_no?: string;

    // Sales Settings
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

// --- Mock Data ---

const initialCustomers: Customer[] = [
    {
        id: 1,
        code: "C001",
        name: "Acme Corp",
        status: "Active",
        contact_person: "Alice Johnson",
        mobile: "9876543210",
        email: "alice@acme.com",
        billing_address: {
            id: 1,
            address_line: "123 Business Park",
            country: "India",
            state: "Maharashtra",
            city: "Mumbai",
            pincode: "400001"
        },
        shipping_addresses: [
            {
                id: 1,
                address_line: "123 Business Park",
                country: "India",
                state: "Maharashtra",
                city: "Mumbai",
                pincode: "400001"
            },
            {
                id: 2,
                address_line: "456 Warehouse Blvd",
                country: "India",
                state: "Gujarat",
                city: "Ahmedabad",
                pincode: "380001"
            }
        ],
        documents: [],
        tax_reg_no: "GSTIN98765",
        payment_terms: "Net 30",
        created_at: "2024-01-01",
        created_by: "Admin"
    },
    {
        id: 2,
        code: "C002",
        name: "Global Tech Solutions",
        status: "Active",
        contact_person: "Bob Smith",
        mobile: "9876543211",
        email: "bob@globaltech.com",
        billing_address: {
            id: 1,
            address_line: "789 Tech Hub",
            country: "USA",
            state: "California",
            city: "San Francisco",
            pincode: "94103"
        },
        shipping_addresses: [
            {
                id: 1,
                address_line: "789 Tech Hub",
                country: "USA",
                state: "California",
                city: "San Francisco",
                pincode: "94103"
            }
        ],
        documents: [],
        payment_terms: "Net 15",
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

export default function SalesMasters() {
    const { toast } = useToast();
    const [location, setLocation] = useLocation();
    const params = useParams();

    const activeTab = params.tab || "sales";

    const getValidMaster = (type: string | undefined): MasterType => {
        if (type) {
            const entry = Object.entries(MASTER_SLUGS).find(([_, slug]) => slug === type);
            if (entry) return entry[0] as MasterType;
        }
        return "Customers";
    };

    const selectedMaster = getValidMaster(params.type);

    const [searchTerm, setSearchTerm] = useState("");
    const [open, setOpen] = useState(false); // Master type selector open state

    const updateRoute = (tab: string, type: MasterType) => {
        const slug = MASTER_SLUGS[type] || type.toLowerCase();
        setLocation(`/masters/sales/${tab}/${slug}`);
    };

    const handleMasterChange = (newMaster: MasterType) => {
        updateRoute(activeTab, newMaster);
        setSearchTerm("");
        setOpen(false);
        setFilterType("All");
        setFilterStatus("All");
    };

    // State for mock data
    const [customers, setCustomers] = useState<Customer[]>(initialCustomers);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<any>({}); // Using any for hybrid form data

    // Filters
    const [filterType, setFilterType] = useState<string>("All");
    const [filterStatus, setFilterStatus] = useState<string>("All");


    // --- Helpers ---

    const getData = () => {
        if (selectedMaster === "Customers") return customers;
        return [];
    };

    const currentData = getData().filter((item: any) => {
        const searchLower = searchTerm.toLowerCase();
        let matchesSearch = false;

        if (selectedMaster === "Customers") {
            const c = item as Customer;
            matchesSearch =
                c.name.toLowerCase().includes(searchLower) ||
                c.code.toLowerCase().includes(searchLower) ||
                c.contact_person.toLowerCase().includes(searchLower) ||
                c.billing_address.city.toLowerCase().includes(searchLower);
        }

        const matchesStatus = filterStatus === "All" || item.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    const handleAddClick = () => {
        setEditingId(null);
        if (selectedMaster === "Customers") {
            setFormData({
                status: "Active",
                payment_terms: "Net 30",
                billing_address: { id: Date.now(), address_line: "", country: "India", state: "", city: "" },
                shipping_addresses: [{ id: Date.now() + 1, address_line: "", country: "India", state: "", city: "" }],
                documents: []
            });
        }
        setIsDialogOpen(true);
    };

    const handleEditClick = (item: any) => {
        setEditingId(item.id);
        const data = { ...item };
        // Ensure shipping_addresses array exists for legacy data or is populated
        if (!data.shipping_addresses || data.shipping_addresses.length === 0) {
            data.shipping_addresses = [{ id: Date.now(), address_line: "", country: "India", state: "", city: "" }];
        }
        // Ensure billing_address exists
        if (!data.billing_address) {
            data.billing_address = { id: Date.now() + 1, address_line: "", country: "India", state: "", city: "" };
        }
        if (!data.documents) {
            data.documents = [];
        }
        setFormData(data);
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (id: number) => {
        if (confirm("Are you sure? This action cannot be undone.")) {
            if (selectedMaster === "Customers") {
                setCustomers(prev => prev.filter(item => item.id !== id));
            }
            toast({ title: "Deleted", description: "Record deleted successfully." });
        }
    };

    const handleSave = () => {
        const now = new Date().toISOString().split('T')[0];
        const user = "Admin User";

        if (selectedMaster === "Customers") {
            // Customer Validation
            const cData = formData as Customer;
            if (!cData.code || !cData.name || !cData.status ||
                !cData.contact_person || !cData.mobile || !cData.payment_terms) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
                return;
            }

            // Billing Address Validation
            if (!cData.billing_address || !cData.billing_address.address_line || !cData.billing_address.country || !cData.billing_address.state || !cData.billing_address.city) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please complete the Billing Address." });
                return;
            }

            // Shipping Address Validation
            if (!cData.shipping_addresses || cData.shipping_addresses.length === 0) {
                toast({ variant: "destructive", title: "Validation Error", description: "At least one shipping address is required." });
                return;
            }
            const invalidAddr = cData.shipping_addresses.find(a => !a.address_line || !a.country || !a.state || !a.city);
            if (invalidAddr) {
                toast({ variant: "destructive", title: "Validation Error", description: "Please complete all fields in shipping address blocks." });
                return;
            }
            // Duplicate Check (Code)
            if (customers.some(c => c.id !== editingId && c.code.toLowerCase() === formData.code?.toLowerCase())) {
                toast({ variant: "destructive", title: "Validation Error", description: "Customer Code must be unique." });
                return;
            }

            if (editingId) {
                setCustomers(prev => prev.map(item => item.id === editingId ? { ...item, ...formData, updated_at: now, updated_by: user } as Customer : item));
                toast({ title: "Updated", description: "Customer updated successfully" });
            } else {
                const newId = Math.max(...customers.map(c => c.id), 0) + 1;
                const newItem = { ...formData, id: newId, created_at: now, created_by: user } as Customer;
                setCustomers(prev => [...prev, newItem]);
                toast({ title: "Created", description: "Customer created successfully" });
            }
        }
        setIsDialogOpen(false);
    };

    // --- Billing Address Helper ---
    const handleBillingAddressChange = (field: keyof Address, value: string) => {
        setFormData((prev: Customer) => ({
            ...prev,
            billing_address: { ...prev.billing_address, [field]: value }
        }));
    };


    // --- Shipping Address Helpers ---
    const handleAddShippingAddress = () => {
        setFormData((prev: Customer) => ({
            ...prev,
            shipping_addresses: [
                ...prev.shipping_addresses,
                { id: Date.now(), address_line: "", country: "India", state: "", city: "" }
            ]
        }));
    };

    const handleRemoveShippingAddress = (id: number) => {
        setFormData((prev: Customer) => ({
            ...prev,
            shipping_addresses: prev.shipping_addresses.filter(a => a.id !== id)
        }));
    };

    const handleShippingAddressChange = (id: number, field: keyof Address, value: string) => {
        setFormData((prev: Customer) => ({
            ...prev,
            shipping_addresses: prev.shipping_addresses.map(a => a.id === id ? { ...a, [field]: value } : a)
        }));
    };

    // --- Document Helpers ---
    const handleAddDocument = () => {
        setFormData((prev: Customer) => ({
            ...prev,
            documents: [
                ...prev.documents,
                { id: Date.now(), name: "", file: null }
            ]
        }));
    };

    const handleRemoveDocument = (id: number) => {
        setFormData((prev: Customer) => ({
            ...prev,
            documents: prev.documents.filter(d => d.id !== id)
        }));
    };

    const handleDocumentChange = (id: number, field: keyof CustomerDocument, value: any) => {
        setFormData((prev: Customer) => ({
            ...prev,
            documents: prev.documents.map(d => d.id === id ? { ...d, [field]: value } : d)
        }));
    };

    // --- Renderers ---

    const renderTable = () => {
        if (selectedMaster === "Customers") {
            return (
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Code</TableHead>
                            <TableHead>Customer Name</TableHead>
                            <TableHead>Contact Person</TableHead>
                            <TableHead>Mobile</TableHead>
                            <TableHead>Payment Terms</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No customers found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            currentData.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.code}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.contact_person}</TableCell>
                                    <TableCell>{item.mobile}</TableCell>
                                    <TableCell>{item.payment_terms}</TableCell>
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
        return null;
    };

    const renderForm = () => {
        if (selectedMaster === "Customers") {
            return (
                <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-1">
                    {/* A) Basic Info */}
                    <div>
                        <SectionHeader title="Basic Info" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Customer Code *</Label>
                                <Input id="code" value={formData.code || ""} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ex: C003" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Customer Name *</Label>
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
                            <div className="space-y-2">
                                <Label htmlFor="tax_reg_no">Tax Reg No</Label>
                                <Input id="tax_reg_no" value={formData.tax_reg_no || ""} onChange={e => setFormData({ ...formData, tax_reg_no: e.target.value })} placeholder="GSTIN/VAT" />
                            </div>
                            <div className="space-y-2">
                                <Label>Payment Terms *</Label>
                                <Select value={formData.payment_terms} onValueChange={(val: any) => setFormData({ ...formData, payment_terms: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select Terms" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Net 15">Net 15</SelectItem>
                                        <SelectItem value="Net 30">Net 30</SelectItem>
                                        <SelectItem value="Net 45">Net 45</SelectItem>
                                        <SelectItem value="Net 60">Net 60</SelectItem>
                                        <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Currency</Label>
                                <Select value={formData.currency} onValueChange={(val: any) => setFormData({ ...formData, currency: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select Currency" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                        <SelectItem value="USD">USD ($)</SelectItem>
                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                        <SelectItem value="GBP">GBP (£)</SelectItem>
                                        <SelectItem value="AUD">AUD (A$)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label htmlFor="notes">Remarks</Label>
                                <Textarea
                                    id="notes"
                                    value={formData.notes || ""}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Any additional notes..."
                                />
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

                    {/* C) Billing Address (Single) */}
                    <div>
                        <SectionHeader title="Billing Address" />
                        <div className="p-4 border rounded-lg bg-muted/10">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <Label>Address Line *</Label>
                                    <Input
                                        value={formData.billing_address?.address_line || ""}
                                        onChange={(e) => handleBillingAddressChange("address_line", e.target.value)}
                                        placeholder="Billing Address"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Country *</Label>
                                    <Select value={formData.billing_address?.country} onValueChange={(val) => handleBillingAddressChange("country", val)}>
                                        <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="India">India</SelectItem>
                                            <SelectItem value="USA">USA</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>State *</Label>
                                    <Select value={formData.billing_address?.state} onValueChange={(val) => handleBillingAddressChange("state", val)}>
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
                                    <Select value={formData.billing_address?.city} onValueChange={(val) => handleBillingAddressChange("city", val)}>
                                        <SelectTrigger><SelectValue placeholder="Select City" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Mumbai">Mumbai</SelectItem>
                                            <SelectItem value="Pune">Pune</SelectItem>
                                            <SelectItem value="Ahmedabad">Ahmedabad</SelectItem>
                                            <SelectItem value="Bangalore">Bangalore</SelectItem>
                                            <SelectItem value="New Delhi">New Delhi</SelectItem>
                                            <SelectItem value="San Francisco">San Francisco</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Pincode</Label>
                                    <Input
                                        value={formData.billing_address?.pincode || ""}
                                        onChange={(e) => handleBillingAddressChange("pincode", e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* D) Shipping Addresses (Multiple) */}
                    <div>
                        <div className="flex items-center justify-between pb-2 mb-4 border-b">
                            <h3 className="font-semibold text-sm text-primary">Shipping Addresses</h3>
                            <Button variant="outline" size="sm" onClick={handleAddShippingAddress} type="button">
                                <Plus className="h-4 w-4 mr-2" /> Add Location
                            </Button>
                        </div>

                        <div className="space-y-6">
                            {(formData.shipping_addresses || []).map((addr: Address, index: number) => (
                                <div key={addr.id} className="relative p-4 border rounded-lg bg-muted/10 group">
                                    {/* Delete Button */}
                                    {(formData.shipping_addresses?.length > 1) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-2 right-2 text-muted-foreground hover:text-destructive h-6 w-6"
                                            onClick={() => handleRemoveShippingAddress(addr.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 space-y-2">
                                            <Label>Address Line *</Label>
                                            <Input
                                                value={addr.address_line}
                                                onChange={(e) => handleShippingAddressChange(addr.id, "address_line", e.target.value)}
                                                placeholder={`Shipping Location ${index + 1}`}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Country *</Label>
                                            <Select value={addr.country} onValueChange={(val) => handleShippingAddressChange(addr.id, "country", val)}>
                                                <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="India">India</SelectItem>
                                                    <SelectItem value="USA">USA</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>State *</Label>
                                            <Select value={addr.state} onValueChange={(val) => handleShippingAddressChange(addr.id, "state", val)}>
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
                                            <Select value={addr.city} onValueChange={(val) => handleShippingAddressChange(addr.id, "city", val)}>
                                                <SelectTrigger><SelectValue placeholder="Select City" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Mumbai">Mumbai</SelectItem>
                                                    <SelectItem value="Pune">Pune</SelectItem>
                                                    <SelectItem value="Ahmedabad">Ahmedabad</SelectItem>
                                                    <SelectItem value="Bangalore">Bangalore</SelectItem>
                                                    <SelectItem value="New Delhi">New Delhi</SelectItem>
                                                    <SelectItem value="San Francisco">San Francisco</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Pincode</Label>
                                            <Input
                                                value={addr.pincode || ""}
                                                onChange={(e) => handleShippingAddressChange(addr.id, "pincode", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* E) Documents */}
                    <div>
                        <div className="flex items-center justify-between pb-2 mb-4 border-b">
                            <h3 className="font-semibold text-sm text-primary">Documents</h3>
                            <Button variant="outline" size="sm" onClick={handleAddDocument} type="button">
                                <Plus className="h-4 w-4 mr-2" /> Add Document
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {(formData.documents || []).map((doc: CustomerDocument, index: number) => (
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
                            {(formData.documents?.length === 0) && (
                                <div className="text-center py-4 text-muted-foreground text-sm border-dashed border-2 rounded-lg">
                                    No documents attached.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
    };


    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Sales Masters</h1>
                <p className="text-muted-foreground">
                    Manage customers and sales configurations.
                </p>
            </div>

            <Tabs defaultValue="sales" value={activeTab} className="w-full flex-1 flex flex-col">
                <div className="border-b border-border">
                    <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0 overflow-x-auto">
                        <TabsTrigger
                            value="sales"
                            onClick={() => updateRoute("sales", "Customers")}
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 whitespace-nowrap"
                        >
                            Sales
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="sales" className="m-0 h-full flex flex-col gap-6 mt-6">
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
                                Add {selectedMaster === "Customers" ? "Customer" : "Record"}
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
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Universal Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle>{editingId ? "Edit" : "Add New"} {selectedMaster === "Customers" ? "Customer" : "Record"}</DialogTitle>
                        <DialogDescription>
                            Configure the details for this {selectedMaster === "Customers" ? "customer" : "record"} entry.
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
                                if (selectedMaster === "Customers") {
                                    const c = formData as Customer;
                                    // Basic Fields
                                    if (!c.code || !c.name || !c.status || !c.payment_terms) return true;
                                    // Contact
                                    if (!c.contact_person || !c.mobile) return true;
                                    // Billing Address
                                    if (!c.billing_address || !c.billing_address.address_line || !c.billing_address.country || !c.billing_address.state || !c.billing_address.city) return true;
                                    // Shipping Addresses
                                    if (!c.shipping_addresses || c.shipping_addresses.length === 0) return true;
                                    if (c.shipping_addresses.some(a => !a.address_line || !a.country || !a.state || !a.city)) return true;

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
