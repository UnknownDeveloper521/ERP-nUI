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
import { Search, Plus, Edit, Trash2, RefreshCw, Package, Layers, Sprout, Droplets, Archive } from "lucide-react";
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
type Category = "Products" | "By-products" | "Raw Materials" | "Consumables";

interface Item {
  id: number;
  item_code: string;
  item_name: string;
  category: Category;
  unit: string;
  current_stock: number;
  reorder_level: number;
  status: "OK" | "Low" | "Out of Stock";
  price: number;
  is_active: boolean;
}

// Mock Data
const initialItems: Item[] = [
  { id: 1, item_code: "P-101", item_name: "White Sugar S-30", category: "Products", unit: "Quintal", current_stock: 5000, reorder_level: 1000, status: "OK", price: 3400, is_active: true },
  { id: 2, item_code: "P-102", item_name: "Molasses B-Heavy", category: "By-products", unit: "MT", current_stock: 1200, reorder_level: 200, status: "OK", price: 12000, is_active: true },
  { id: 3, item_code: "R-201", item_name: "Sugarcane", category: "Raw Materials", unit: "MT", current_stock: 150, reorder_level: 500, status: "Low", price: 3050, is_active: true },
  { id: 4, item_code: "C-301", item_name: "Lime", category: "Consumables", unit: "Kg", current_stock: 0, reorder_level: 50, status: "Out of Stock", price: 15, is_active: true },
  { id: 5, item_code: "P-103", item_name: "Ethanol", category: "Products", unit: "Liter", current_stock: 25000, reorder_level: 5000, status: "OK", price: 65, is_active: true },
  { id: 6, item_code: "B-104", item_name: "Bagasse", category: "By-products", unit: "MT", current_stock: 8000, reorder_level: 1000, status: "OK", price: 2500, is_active: true },
  { id: 7, item_code: "C-302", item_name: "Sulphur", category: "Consumables", unit: "Kg", current_stock: 400, reorder_level: 100, status: "OK", price: 45, is_active: true },
  { id: 8, item_code: "R-202", item_name: "Packing Bags", category: "Consumables", unit: "Bags", current_stock: 10000, reorder_level: 2000, status: "OK", price: 12, is_active: true },
  { id: 9, item_code: "P-105", item_name: "Brown Sugar", category: "Products", unit: "Kg", current_stock: 500, reorder_level: 100, status: "OK", price: 150, is_active: false },
];

export default function Products() {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>(() => {
    const saved = localStorage.getItem("products_items");
    return saved ? JSON.parse(saved) : initialItems;
  });

  // Persist Items
  useEffect(() => {
    localStorage.setItem("products_items", JSON.stringify(items));
  }, [items]);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [isLoading, setIsLoading] = useState(false);

  // Dialog States
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Item>>({
    category: "Products",
    unit: "MT",
    status: "OK",
    is_active: true
  });

  // Filtered Data
  const filteredItems = items.filter((item) => {
    const matchesSearch = 
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeTab === "All" || item.category === activeTab;
    return matchesSearch && matchesCategory;
  });

  // Derived Stats
  const stats = {
    totalProducts: items.filter(i => i.category === "Products").length,
    totalByProducts: items.filter(i => i.category === "By-products").length,
    totalRawMaterials: items.filter(i => i.category === "Raw Materials").length,
    totalConsumables: items.filter(i => i.category === "Consumables").length,
    totalActiveItems: items.filter(i => i.is_active).length,
  };

  // Handlers
  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast({ title: "Refreshed", description: "Product list updated successfully." });
    }, 800);
  };

  const handleDelete = () => {
    if (selectedItem) {
      // Soft delete implementation as requested
      const updatedItems = items.map(i => 
        i.id === selectedItem.id ? { ...i, is_active: false } : i
      );
      setItems(updatedItems);
      setIsDeleteDialogOpen(false);
      toast({ title: "Deactivated", description: `${selectedItem.item_name} has been deactivated.` });
    }
  };

  const handleSave = () => {
    if (!formData.item_name || !formData.item_code) {
      toast({ variant: "destructive", title: "Error", description: "Please fill required fields" });
      return;
    }

    const newItem: Item = {
      id: selectedItem ? selectedItem.id : Math.max(0, ...items.map(i => i.id)) + 1,
      item_code: formData.item_code || "",
      item_name: formData.item_name || "",
      category: (formData.category as Category) || "Products",
      unit: formData.unit || "MT",
      current_stock: Number(formData.current_stock) || 0,
      reorder_level: Number(formData.reorder_level) || 0,
      status: (Number(formData.current_stock) || 0) <= 0 ? "Out of Stock" : (Number(formData.current_stock) || 0) <= (Number(formData.reorder_level) || 0) ? "Low" : "OK",
      price: Number(formData.price) || 0,
      is_active: true
    };

    if (selectedItem) {
      setItems(items.map(i => i.id === selectedItem.id ? newItem : i));
      setIsEditDialogOpen(false);
      toast({ title: "Updated", description: "Item updated successfully." });
    } else {
      setItems([...items, newItem]);
      setIsAddDialogOpen(false);
      toast({ title: "Created", description: "New item added successfully." });
    }
    setFormData({ category: "Products", unit: "MT", status: "OK", is_active: true });
    setSelectedItem(null);
  };

  const openEdit = (item: Item) => {
    setSelectedItem(item);
    setFormData(item);
    setIsEditDialogOpen(true);
  };

  const openDelete = (item: Item) => {
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products & Materials Dashboard</h1>
          <p className="text-muted-foreground">Sugar Factory – Inventory & Item Master</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => { setFormData({}); setIsAddDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add New Item
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-blue-50 border-blue-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-blue-700">Total Products</CardTitle>
            <Package className="h-4 w-4 text-blue-700" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-900">{stats.totalProducts}</div></CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-purple-700">Total By-products</CardTitle>
            <Layers className="h-4 w-4 text-purple-700" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-purple-900">{stats.totalByProducts}</div></CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-amber-700">Total Raw Materials</CardTitle>
            <Sprout className="h-4 w-4 text-amber-700" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-900">{stats.totalRawMaterials}</div></CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-emerald-700">Total Consumables</CardTitle>
            <Droplets className="h-4 w-4 text-emerald-700" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-900">{stats.totalConsumables}</div></CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-gray-700">Total Active Items</CardTitle>
            <Archive className="h-4 w-4 text-gray-700" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-gray-900">{stats.totalActiveItems}</div></CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="All">All</TabsTrigger>
            <TabsTrigger value="Products">Products</TabsTrigger>
            <TabsTrigger value="By-products">By-products</TabsTrigger>
            <TabsTrigger value="Raw Materials">Raw Mat.</TabsTrigger>
            <TabsTrigger value="Consumables">Consumables</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Main Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="text-right">Reorder Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No items found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className={!item.is_active ? "opacity-50 bg-muted/50" : ""}>
                    <TableCell>
                      <Badge variant="outline" className={
                        item.category === "Products" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        item.category === "By-products" ? "bg-purple-50 text-purple-700 border-purple-200" :
                        item.category === "Raw Materials" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }>
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
                    <TableCell className="font-medium">
                      {item.item_name}
                      {!item.is_active && <span className="ml-2 text-xs text-destructive">(Inactive)</span>}
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{item.current_stock.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.reorder_level.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={
                        item.status === "OK" ? "bg-green-500 hover:bg-green-600" :
                        item.status === "Low" ? "bg-yellow-500 hover:bg-yellow-600" :
                        "bg-red-500 hover:bg-red-600"
                      }>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDelete(item)}>
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

      {/* Add/Edit Modal */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setIsEditDialogOpen(false);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditDialogOpen ? "Edit Item" : "Add New Item"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Category</Label>
              <Select 
                value={formData.category} 
                onValueChange={(val) => setFormData({...formData, category: val as Category})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Products">Products</SelectItem>
                  <SelectItem value="By-products">By-products</SelectItem>
                  <SelectItem value="Raw Materials">Raw Materials</SelectItem>
                  <SelectItem value="Consumables">Consumables</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Item Code</Label>
              <Input 
                value={formData.item_code || ""} 
                onChange={(e) => setFormData({...formData, item_code: e.target.value})} 
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Item Name</Label>
              <Input 
                value={formData.item_name || ""} 
                onChange={(e) => setFormData({...formData, item_name: e.target.value})} 
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Unit</Label>
              <Select 
                value={formData.unit} 
                onValueChange={(val) => setFormData({...formData, unit: val})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MT">Metric Ton (MT)</SelectItem>
                  <SelectItem value="Quintal">Quintal</SelectItem>
                  <SelectItem value="Kg">Kilogram (Kg)</SelectItem>
                  <SelectItem value="Liter">Liter</SelectItem>
                  <SelectItem value="Bags">Bags</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Stock</Label>
              <Input 
                type="number"
                value={formData.current_stock || ""} 
                onChange={(e) => setFormData({...formData, current_stock: Number(e.target.value)})} 
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Reorder Lvl</Label>
              <Input 
                type="number"
                value={formData.reorder_level || ""} 
                onChange={(e) => setFormData({...formData, reorder_level: Number(e.target.value)})} 
                className="col-span-3" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>Save Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to deactivate {selectedItem?.item_name}? This action will remove it from active lists.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
