import * as React from "react";
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
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
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
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { mockStates, mockCities } from "@/lib/masterMockData";

// --- Types & Interfaces ---

interface Address {
  id: number;
  address_line: string;
  country: string;
  state: string;
  city: string;
  pincode?: string;
}

interface CustomerDocument {
  id: number;
  name: string;
  file_name?: string;
  file?: File | null;
}

interface Customer {
  id: number;
  code: string;
  name: string;
  status: "Active" | "Inactive";
  contact_person: string;
  mobile: string;
  email?: string;
  phone?: string;
  billing_address: Address;
  shipping_addresses: Address[];
  documents: CustomerDocument[];
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

const initialCustomers: Customer[] = Array.from({ length: 5 }).map((_, index) => ({
  id: index + 1,
  code: `C${(index + 1).toString().padStart(3, '0')}`,
  name: index % 2 === 0 ? `Customer ${index + 1} Ltd` : `Enterprise ${index + 1} Corp`,
  status: index % 10 === 0 ? "Inactive" : "Active",
  contact_person: index % 2 === 0 ? `Alice ${index + 1}` : `Bob ${index + 1}`,
  mobile: `98765${(index + 10000).toString().slice(-5)}`,
  email: `customer${index + 1}@example.com`,
  billing_address: {
    id: index + 1,
    address_line: `${100 + index} Industrial Area`,
    country: "India",
    state: "Gujarat",
    city: "Ahmedabad",
    pincode: "380001"
  },
  shipping_addresses: [
    {
      id: index + 100,
      address_line: `${500 + index} Warehouse St`,
      country: "India",
      state: "Maharashtra",
      city: "Mumbai",
      pincode: "400001"
    }
  ],
  documents: [],
  tax_reg_no: `GSTIN${index + 10000}`,
  payment_terms: index % 3 === 0 ? "Net 30" : "Net 15",
  currency: "ush",
  created_at: "2024-01-01",
  created_by: "Admin"
}));

const PAYMENT_TERMS_OPTIONS = ["Net 30", "Net 15", "Advance", "COD", "Due on Receipt"];

const StatusBadge = ({ status }: { status: "Active" | "Inactive" }) => {
  return (
    <Badge variant={status === "Active" ? "default" : "secondary"}>
      {status}
    </Badge>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <div className="flex items-center gap-2 pb-2 mb-4 border-b">
    <h3 className="font-semibold text-sm text-primary">{title}</h3>
  </div>
);

export default function Customers() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filterStatus, setFilterStatus] = useState<string>("All");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({});

  const filteredCustomers = customers.filter((c) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      c.name?.toLowerCase().includes(searchLower) ||
      c.code?.toLowerCase().includes(searchLower) ||
      c.contact_person?.toLowerCase().includes(searchLower) ||
      c.billing_address?.city?.toLowerCase().includes(searchLower);

    const matchesStatus = filterStatus === "All" || c.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAddClick = () => {
    setEditingId(null);
    setFormData({
      status: "Active",
      payment_terms: "Net 30",
      currency: "ush",
      billing_address: { id: Date.now(), address_line: "", country: "India", state: "", city: "" },
      shipping_addresses: [{ id: Date.now() + 1, address_line: "", country: "India", state: "", city: "" }],
      documents: []
    });
    setIsDialogOpen(true);
  };

  const handleEditClick = (customer: Customer) => {
    setEditingId(customer.id);
    const data = { ...customer };
    if (!data.shipping_addresses || data.shipping_addresses.length === 0) {
      data.shipping_addresses = [{ id: Date.now(), address_line: "", country: "India", state: "", city: "" }];
    }
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
      setCustomers(prev => prev.filter(c => c.id !== id));
      toast({ title: "Deleted", description: "Customer deleted successfully." });
    }
  };

  const handleSave = () => {
    const now = new Date().toISOString().split('T')[0];
    const user = "Admin User";

    if (!formData.code || !formData.name || !formData.status || !formData.contact_person || !formData.mobile) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
      return;
    }

    if (!formData.billing_address?.address_line || !formData.billing_address?.country || !formData.billing_address?.state || !formData.billing_address?.city) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please complete the Billing Address." });
      return;
    }

    if (formData.shipping_addresses?.some(a => !a.address_line || !a.country || !a.state || !a.city)) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please complete all fields in shipping address blocks." });
      return;
    }

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
    setIsDialogOpen(false);
  };

  const handleBillingAddressChange = (field: keyof Address, value: string) => {
    setFormData(prev => ({
      ...prev,
      billing_address: { ...prev.billing_address!, [field]: value }
    }));
  };

  const handleShippingAddressChange = (id: number, field: keyof Address, value: string) => {
    setFormData(prev => ({
      ...prev,
      shipping_addresses: prev.shipping_addresses!.map(a => a.id === id ? { ...a, [field]: value } : a)
    }));
  };

  const handleAddShippingAddress = () => {
    setFormData(prev => ({
      ...prev,
      shipping_addresses: [...(prev.shipping_addresses || []), { id: Date.now(), address_line: "", country: "India", state: "", city: "" }]
    }));
  };

  const handleRemoveShippingAddress = (id: number) => {
    setFormData(prev => ({
      ...prev,
      shipping_addresses: prev.shipping_addresses!.filter(a => a.id !== id)
    }));
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Customers Master</h1>
        <p className="text-muted-foreground text-sm">Manage your customers, their locations, and billing details.</p>
      </div>

      <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="w-full sm:flex-1">
          <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, name, contact or city..."
              className="pl-9 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full sm:w-48">
          <Label className="mb-1.5 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Status
          </Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAddClick} className="h-10">
          <Plus className="h-4 w-4 mr-2" /> Add New Customer
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[120px]">Code</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                      No customers found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCustomers.map((customer) => (
                    <TableRow key={customer.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-sm font-medium">{customer.code}</TableCell>
                      <TableCell className="font-medium text-sm">{customer.name}</TableCell>
                      <TableCell className="text-sm">{customer.contact_person}</TableCell>
                      <TableCell className="text-sm">{customer.mobile}</TableCell>
                      <TableCell className="text-sm">{customer.billing_address.city}</TableCell>
                      <TableCell>
                        <StatusBadge status={customer.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" title="Edit" onClick={() => handleEditClick(customer)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Delete" onClick={() => handleDeleteClick(customer.id)}>
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

          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredCustomers.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            options={[10, 15, 30, 50]}
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Customer" : "Create New Customer"}</DialogTitle>
            <DialogDescription>
              Enter customer details, contact information and locations.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <SectionHeader title="Basic Info" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Customer Code *</Label>
                <Input
                  value={formData.code || ""}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Customer Name *</Label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Status *</Label>
                <Select value={formData.status || ""} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Tax Reg No</Label>
                <Input
                  value={formData.tax_reg_no || ""}
                  onChange={(e) => setFormData({ ...formData, tax_reg_no: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Payment Terms</Label>
                <Select
                  value={formData.payment_terms || ""}
                  onValueChange={(val) => setFormData({ ...formData, payment_terms: val })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select Payment Terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Currency</Label>
                <Select value={formData.currency || ""} onValueChange={(val) => setFormData({ ...formData, currency: val })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select Currency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ush">ush</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <SectionHeader title="Primary Contact" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Contact Person *</Label>
                <Input
                  value={formData.contact_person || ""}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Mobile *</Label>
                <Input
                  value={formData.mobile || ""}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Email</Label>
                <Input
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>

            <SectionHeader title="Billing Address" />
            <div className="p-4 rounded-md border bg-muted/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Address Line *</Label>
                  <Input
                    value={formData.billing_address?.address_line || ""}
                    onChange={(e) => handleBillingAddressChange("address_line", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">State *</Label>
                  <Select
                    value={formData.billing_address?.state || ""}
                    onValueChange={(val) => {
                      handleBillingAddressChange("state", val);
                      handleBillingAddressChange("city", ""); // Reset city when state changes
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockStates.filter(s => s.status === "Active").map((state) => (
                        <SelectItem key={state.id} value={state.name}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">City *</Label>
                  <Select
                    value={formData.billing_address?.city || ""}
                    onValueChange={(val) => handleBillingAddressChange("city", val)}
                    disabled={!formData.billing_address?.state}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={formData.billing_address?.state ? "Select City" : "Select State First"} />
                    </SelectTrigger>
                    <SelectContent>
                      {mockCities
                        .filter((c) => c.state === formData.billing_address?.state && c.status === "Active")
                        .map((city) => (
                          <SelectItem key={city.id} value={city.name}>
                            {city.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <SectionHeader title="Shipping Locations" />
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="h-8 text-xs mb-4"
                onClick={handleAddShippingAddress}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Shipping Location
              </Button>
            </div>

            <div className="space-y-4">
              {formData.shipping_addresses?.map((addr, idx) => (
                <div key={addr.id} className="p-4 rounded-md border bg-muted/20 relative">
                  {formData.shipping_addresses!.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 absolute top-2 right-2 text-destructive"
                      onClick={() => handleRemoveShippingAddress(addr.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Address Line {idx + 1} *</Label>
                      <Input
                        value={addr.address_line}
                        onChange={(e) => handleShippingAddressChange(addr.id, "address_line", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">State *</Label>
                      <Select
                        value={addr.state || ""}
                        onValueChange={(val) => {
                          handleShippingAddressChange(addr.id, "state", val);
                          handleShippingAddressChange(addr.id, "city", ""); // Reset city when state changes
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select State" />
                        </SelectTrigger>
                        <SelectContent>
                          {mockStates.filter(s => s.status === "Active").map((state) => (
                            <SelectItem key={state.id} value={state.name}>
                              {state.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">City *</Label>
                      <Select
                        value={addr.city || ""}
                        onValueChange={(val) => handleShippingAddressChange(addr.id, "city", val)}
                        disabled={!addr.state}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={addr.state ? "Select City" : "Select State First"} />
                        </SelectTrigger>
                        <SelectContent>
                          {mockCities
                            .filter((c) => c.state === addr.state && c.status === "Active")
                            .map((city) => (
                              <SelectItem key={city.id} value={city.name}>
                                {city.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <SectionHeader title="Additional Notes" />
            <div className="space-y-2">
              <Textarea
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any internal notes..."
                className="min-h-[100px] resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
              {editingId ? "Update Customer" : "Create Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
