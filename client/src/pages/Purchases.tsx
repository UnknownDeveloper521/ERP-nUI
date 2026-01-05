import React, { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Truck,
  DollarSign,
  Package,
  Calendar,
  Building2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

// Types
interface Vendor {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  paymentTerms: string;
  status: "Active" | "Inactive";
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorId: number;
  date: string;
  dueDate: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  status: "Pending" | "Confirmed" | "Delivered" | "Paid";
  notes: string;
}

// Initial Data
const initialVendors: Vendor[] = [
  { id: 1, name: "Global Supplies Ltd", email: "sales@globalsupplies.com", phone: "+91-22-1234-5678", city: "Mumbai", paymentTerms: "Net 30", status: "Active" },
  { id: 2, name: "Premium Chemicals Inc", email: "orders@premiumchem.com", phone: "+91-80-2222-3333", city: "Bangalore", paymentTerms: "Net 45", status: "Active" },
  { id: 3, name: "Industrial Equipment Co", email: "sales@indequip.com", phone: "+91-33-4444-5555", city: "Kolkata", paymentTerms: "Net 15", status: "Active" },
  { id: 4, name: "Regional Traders", email: "contact@regionaltraders.com", phone: "+91-40-6666-7777", city: "Hyderabad", paymentTerms: "Net 30", status: "Inactive" },
];

const initialPOs: PurchaseOrder[] = [
  { id: 1, poNumber: "PO-2025-001", vendorId: 1, date: "2025-11-15", dueDate: "2025-12-15", itemName: "Packaging Materials", quantity: 500, unit: "Boxes", unitPrice: 150, totalAmount: 75000, status: "Confirmed", notes: "Standard packaging" },
  { id: 2, poNumber: "PO-2025-002", vendorId: 2, date: "2025-11-18", dueDate: "2025-12-03", itemName: "Lime Powder", quantity: 100, unit: "MT", unitPrice: 5000, totalAmount: 500000, status: "Pending", notes: "High purity required" },
  { id: 3, poNumber: "PO-2025-003", vendorId: 1, date: "2025-11-20", dueDate: "2025-12-05", itemName: "Bags", quantity: 10000, unit: "Bags", unitPrice: 12, totalAmount: 120000, status: "Delivered", notes: "Express delivery" },
  { id: 4, poNumber: "PO-2025-004", vendorId: 3, date: "2025-11-22", dueDate: "2025-12-22", itemName: "Processing Equipment", quantity: 2, unit: "Units", unitPrice: 850000, totalAmount: 1700000, status: "Paid", notes: "Installation included" },
];

export default function Purchases() {
  const { toast } = useToast();

  // State Management with Persistence
  const [vendors, setVendors] = useState<Vendor[]>(() => {
    const saved = localStorage.getItem("purchases_vendors");
    return saved ? JSON.parse(saved) : initialVendors;
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    const saved = localStorage.getItem("purchases_orders");
    return saved ? JSON.parse(saved) : initialPOs;
  });

  // Persist Data
  useEffect(() => {
    localStorage.setItem("purchases_vendors", JSON.stringify(vendors));
  }, [vendors]);

  useEffect(() => {
    localStorage.setItem("purchases_orders", JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  const [activeTab, setActiveTab] = useState("orders");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Dialog States
  const [isAddPODialogOpen, setIsAddPODialogOpen] = useState(false);
  const [isEditPODialogOpen, setIsEditPODialogOpen] = useState(false);
  const [isAddVendorDialogOpen, setIsAddVendorDialogOpen] = useState(false);
  const [isEditVendorDialogOpen, setIsEditVendorDialogOpen] = useState(false);
  const [isDeletePODialogOpen, setIsDeletePODialogOpen] = useState(false);
  const [isDeleteVendorDialogOpen, setIsDeleteVendorDialogOpen] = useState(false);

  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  // Form States
  const [poForm, setPoForm] = useState<Partial<PurchaseOrder>>({
    status: "Pending",
  });

  const [vendorForm, setVendorForm] = useState<Partial<Vendor>>({
    status: "Active",
  });

  // Filtered Data
  const filteredPOs = purchaseOrders.filter((po) => {
    const vendor = vendors.find((v) => v.id === po.vendorId);
    const matchesSearch =
      po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vendor?.name.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    return matchesSearch;
  });

  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const stats = {
    totalVendors: vendors.length,
    activeVendors: vendors.filter((v) => v.status === "Active").length,
    totalPOs: purchaseOrders.length,
    pendingPOs: purchaseOrders.filter((po) => po.status === "Pending").length,
    totalAmount: purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0),
    deliveredAmount: purchaseOrders
      .filter((po) => po.status === "Delivered" || po.status === "Paid")
      .reduce((sum, po) => sum + po.totalAmount, 0),
  };

  // Handlers
  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast({ title: "Refreshed", description: "Data updated successfully." });
    }, 800);
  };

  // Purchase Order Handlers
  const handleSavePO = () => {
    if (
      !poForm.poNumber ||
      !poForm.vendorId ||
      !poForm.itemName ||
      !poForm.quantity ||
      !poForm.unitPrice
    ) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill all required fields",
      });
      return;
    }

    const totalAmount = (poForm.quantity || 0) * (poForm.unitPrice || 0);
    const newPO: PurchaseOrder = {
      id: selectedPO ? selectedPO.id : Math.max(0, ...purchaseOrders.map(p => p.id)) + 1,
      poNumber: poForm.poNumber || "",
      vendorId: poForm.vendorId || 0,
      date: poForm.date || new Date().toISOString().split("T")[0],
      dueDate: poForm.dueDate || "",
      itemName: poForm.itemName || "",
      quantity: poForm.quantity || 0,
      unit: poForm.unit || "Units",
      unitPrice: poForm.unitPrice || 0,
      totalAmount,
      status: (poForm.status as any) || "Pending",
      notes: poForm.notes || "",
    };

    if (selectedPO) {
      setPurchaseOrders(
        purchaseOrders.map((p) => (p.id === selectedPO.id ? newPO : p))
      );
      toast({ title: "Updated", description: "Purchase order updated successfully." });
      setIsEditPODialogOpen(false);
    } else {
      setPurchaseOrders([...purchaseOrders, newPO]);
      toast({ title: "Created", description: "New purchase order created successfully." });
      setIsAddPODialogOpen(false);
    }
    setPoForm({ status: "Pending" });
    setSelectedPO(null);
  };

  const handleDeletePO = () => {
    if (selectedPO) {
      setPurchaseOrders(purchaseOrders.filter((p) => p.id !== selectedPO.id));
      setIsDeletePODialogOpen(false);
      toast({ title: "Deleted", description: "Purchase order deleted successfully." });
    }
  };

  const openEditPO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setPoForm(po);
    setIsEditPODialogOpen(true);
  };

  const openDeletePO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setIsDeletePODialogOpen(true);
  };

  // Vendor Handlers
  const handleSaveVendor = () => {
    if (!vendorForm.name || !vendorForm.email || !vendorForm.phone) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill all required fields",
      });
      return;
    }

    const newVendor: Vendor = {
      id: selectedVendor ? selectedVendor.id : Math.max(0, ...vendors.map(v => v.id)) + 1,
      name: vendorForm.name || "",
      email: vendorForm.email || "",
      phone: vendorForm.phone || "",
      city: vendorForm.city || "",
      paymentTerms: vendorForm.paymentTerms || "Net 30",
      status: (vendorForm.status as any) || "Active",
    };

    if (selectedVendor) {
      setVendors(vendors.map((v) => (v.id === selectedVendor.id ? newVendor : v)));
      toast({ title: "Updated", description: "Vendor updated successfully." });
      setIsEditVendorDialogOpen(false);
    } else {
      setVendors([...vendors, newVendor]);
      toast({ title: "Created", description: "New vendor added successfully." });
      setIsAddVendorDialogOpen(false);
    }
    setVendorForm({ status: "Active" });
    setSelectedVendor(null);
  };

  const handleDeleteVendor = () => {
    if (selectedVendor) {
      setVendors(vendors.filter((v) => v.id !== selectedVendor.id));
      setIsDeleteVendorDialogOpen(false);
      toast({ title: "Deleted", description: "Vendor deleted successfully." });
    }
  };

  const openEditVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setVendorForm(vendor);
    setIsEditVendorDialogOpen(true);
  };

  const openDeleteVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsDeleteVendorDialogOpen(true);
  };

  const getVendorName = (vendorId: number) => {
    return vendors.find((v) => v.id === vendorId)?.name || "Unknown";
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Purchases & Vendors Management
          </h1>
          <p className="text-muted-foreground">
            Manage purchase orders, vendors, and procurement operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-blue-700">
              Total Vendors
            </CardTitle>
            <Building2 className="h-4 w-4 text-blue-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">
              {stats.totalVendors}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-green-700">
              Active Vendors
            </CardTitle>
            <Building2 className="h-4 w-4 text-green-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">
              {stats.activeVendors}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-purple-700">
              Total POs
            </CardTitle>
            <Package className="h-4 w-4 text-purple-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">
              {stats.totalPOs}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-amber-700">
              Pending POs
            </CardTitle>
            <Calendar className="h-4 w-4 text-amber-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">
              {stats.pendingPOs}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-cyan-50 border-cyan-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-cyan-700">
              Total Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-cyan-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-900">
              ${(stats.totalAmount / 100000).toFixed(1)}L
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-emerald-700">
              Delivered
            </CardTitle>
            <Truck className="h-4 w-4 text-emerald-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">
              ${(stats.deliveredAmount / 100000).toFixed(1)}L
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="orders" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-2">
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
        </TabsList>

        {/* Purchase Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO number, vendor, or item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              onClick={() => {
                setPoForm({ status: "Pending" });
                setIsAddPODialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Purchase Order
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPOs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        No purchase orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPOs.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-mono text-sm font-semibold">
                          {po.poNumber}
                        </TableCell>
                        <TableCell className="font-medium">
                          {getVendorName(po.vendorId)}
                        </TableCell>
                        <TableCell>{po.itemName}</TableCell>
                        <TableCell className="text-right">
                          {po.quantity} {po.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          ${po.unitPrice.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${po.totalAmount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              po.status === "Paid"
                                ? "bg-emerald-500 hover:bg-emerald-600"
                                : po.status === "Delivered"
                                ? "bg-blue-500 hover:bg-blue-600"
                                : po.status === "Confirmed"
                                ? "bg-amber-500 hover:bg-amber-600"
                                : "bg-yellow-500 hover:bg-yellow-600"
                            }
                          >
                            {po.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditPO(po)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => openDeletePO(po)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              onClick={() => {
                setVendorForm({ status: "Active" });
                setIsAddVendorDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Vendor
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No vendors found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVendors.map((vendor) => (
                      <TableRow key={vendor.id}>
                        <TableCell className="font-medium">{vendor.name}</TableCell>
                        <TableCell className="text-sm">{vendor.email}</TableCell>
                        <TableCell className="text-sm">{vendor.phone}</TableCell>
                        <TableCell>{vendor.city}</TableCell>
                        <TableCell>{vendor.paymentTerms}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              vendor.status === "Active"
                                ? "bg-emerald-500 hover:bg-emerald-600"
                                : "bg-red-500 hover:bg-red-600"
                            }
                          >
                            {vendor.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditVendor(vendor)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => openDeleteVendor(vendor)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit PO Dialog */}
      <Dialog
        open={isAddPODialogOpen || isEditPODialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddPODialogOpen(false);
            setIsEditPODialogOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {isEditPODialogOpen ? "Edit Purchase Order" : "Create Purchase Order"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PO Number *</Label>
                <Input
                  value={poForm.poNumber || ""}
                  onChange={(e) => setPoForm({ ...poForm, poNumber: e.target.value })}
                  placeholder="e.g., PO-2025-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor *</Label>
                <Select
                  value={String(poForm.vendorId || "")}
                  onValueChange={(val) =>
                    setPoForm({ ...poForm, vendorId: parseInt(val) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={poForm.date || ""}
                  onChange={(e) => setPoForm({ ...poForm, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={poForm.dueDate || ""}
                  onChange={(e) => setPoForm({ ...poForm, dueDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                value={poForm.itemName || ""}
                onChange={(e) => setPoForm({ ...poForm, itemName: e.target.value })}
                placeholder="e.g., Packaging Materials"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  value={poForm.quantity || ""}
                  onChange={(e) =>
                    setPoForm({ ...poForm, quantity: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={poForm.unit || ""}
                  onChange={(e) => setPoForm({ ...poForm, unit: e.target.value })}
                  placeholder="Units"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Price *</Label>
                <Input
                  type="number"
                  value={poForm.unitPrice || ""}
                  onChange={(e) =>
                    setPoForm({ ...poForm, unitPrice: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={poForm.status || "Pending"}
                onValueChange={(val) => setPoForm({ ...poForm, status: val as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={poForm.notes || ""}
                onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddPODialogOpen(false);
                setIsEditPODialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePO}>
              {isEditPODialogOpen ? "Update PO" : "Create PO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete PO Dialog */}
      <Dialog open={isDeletePODialogOpen} onOpenChange={setIsDeletePODialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete {selectedPO?.poNumber}? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeletePODialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePO}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Vendor Dialog */}
      <Dialog
        open={isAddVendorDialogOpen || isEditVendorDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddVendorDialogOpen(false);
            setIsEditVendorDialogOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {isEditVendorDialogOpen ? "Edit Vendor" : "Add New Vendor"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Vendor Name *</Label>
              <Input
                value={vendorForm.name || ""}
                onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                placeholder="Company name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={vendorForm.email || ""}
                  onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                  placeholder="email@vendor.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  value={vendorForm.phone || ""}
                  onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                  placeholder="+91-22-1234-5678"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={vendorForm.city || ""}
                  onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input
                  value={vendorForm.paymentTerms || ""}
                  onChange={(e) =>
                    setVendorForm({ ...vendorForm, paymentTerms: e.target.value })
                  }
                  placeholder="e.g., Net 30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={vendorForm.status || "Active"}
                onValueChange={(val) => setVendorForm({ ...vendorForm, status: val as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddVendorDialogOpen(false);
                setIsEditVendorDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveVendor}>
              {isEditVendorDialogOpen ? "Update Vendor" : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Vendor Dialog */}
      <Dialog
        open={isDeleteVendorDialogOpen}
        onOpenChange={setIsDeleteVendorDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete {selectedVendor?.name}? This action
            cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteVendorDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteVendor}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
