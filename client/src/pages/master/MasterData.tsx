import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Search, Pencil, Trash2 } from "lucide-react";

type Vendor = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
};

type Warehouse = {
  id: string;
  name: string | null;
  location: string | null;
  is_main: boolean;
};

type Machine = {
  id: string;
  name: string;
  machine_type: string | null;
  classification: string | null;
  created_at: string;
};

type RawMaterial = {
  id: string;
  material_code: string;
  name: string;
  material_type: string | null;
  gsm: number | null;
  ply: number | null;
  width_mm: number | null;
  grade: string | null;
  uom: string;
  created_at: string;
};

type Product = {
  id: string;
  product_code: string;
  name: string;
  category: string | null;
  type: string | null;
  grade: string | null;
  gsm: number | null;
  ply: number | null;
  avg_weight: number | null;
  packaging_sizes: any;
  created_at: string;
};

export default function MasterData() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<
    "vendors" | "warehouses" | "machines" | "raw-materials" | "products"
  >("vendors");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [vendorList, setVendorList] = useState<Vendor[]>([]);
  const [warehouseList, setWarehouseList] = useState<Warehouse[]>([]);
  const [machineList, setMachineList] = useState<Machine[]>([]);
  const [rawMaterialList, setRawMaterialList] = useState<RawMaterial[]>([]);
  const [productList, setProductList] = useState<Product[]>([]);

  const [search, setSearch] = useState("");

  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorForm, setVendorForm] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
  });

  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [warehouseForm, setWarehouseForm] = useState({
    name: "",
    location: "",
    is_main: false,
  });

  const [machineDialogOpen, setMachineDialogOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [machineForm, setMachineForm] = useState({
    name: "",
    machine_type: "",
    classification: "",
  });

  const [rmDialogOpen, setRmDialogOpen] = useState(false);
  const [editingRm, setEditingRm] = useState<RawMaterial | null>(null);
  const [rmForm, setRmForm] = useState({
    material_code: "",
    name: "",
    material_type: "",
    gsm: "",
    ply: "",
    width_mm: "",
    grade: "",
    uom: "KG",
  });

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    product_code: "",
    name: "",
    category: "",
    type: "",
    grade: "",
    gsm: "",
    ply: "",
    avg_weight: "",
    packaging_sizes: "",
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchVendors(),
          fetchWarehouses(),
          fetchMachines(),
          fetchRawMaterials(),
          fetchProducts(),
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchVendors = async () => {
    const { data, error } = await supabase
      .from("vendors_master")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    setVendorList((data as any) || []);
  };

  const fetchWarehouses = async () => {
    const { data, error } = await supabase
      .from("warehouses_master")
      .select("*")
      .order("is_main", { ascending: false });

    if (error) throw error;
    setWarehouseList((data as any) || []);
  };

  const fetchMachines = async () => {
    const { data, error } = await supabase
      .from("machine_master")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    setMachineList((data as any) || []);
  };

  const fetchRawMaterials = async () => {
    const { data, error } = await supabase
      .from("raw_material_master")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    setRawMaterialList((data as any) || []);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products_master")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    setProductList((data as any) || []);
  };

  const openNewVendor = () => {
    setEditingVendor(null);
    setVendorForm({ name: "", contact_person: "", phone: "", email: "", address: "" });
    setVendorDialogOpen(true);
  };

  const openEditVendor = (v: Vendor) => {
    setEditingVendor(v);
    setVendorForm({
      name: v.name || "",
      contact_person: v.contact_person || "",
      phone: v.phone || "",
      email: v.email || "",
      address: v.address || "",
    });
    setVendorDialogOpen(true);
  };

  const saveVendor = async () => {
    if (!vendorForm.name.trim()) {
      toast({ title: "Vendor name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: vendorForm.name.trim(),
        contact_person: vendorForm.contact_person.trim() || null,
        phone: vendorForm.phone.trim() || null,
        email: vendorForm.email.trim() || null,
        address: vendorForm.address.trim() || null,
      };

      if (editingVendor) {
        const { error } = await supabase
          .from("vendors_master")
          .update(payload)
          .eq("id", editingVendor.id);
        if (error) throw error;
        toast({ title: "Vendor updated" });
      } else {
        const { error } = await supabase.from("vendors_master").insert([payload]);
        if (error) throw error;
        toast({ title: "Vendor created" });
      }

      setVendorDialogOpen(false);
      await fetchVendors();
    } catch (e: any) {
      toast({ title: "Error saving vendor", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteVendor = async (v: Vendor) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("vendors_master").delete().eq("id", v.id);
      if (error) throw error;
      toast({ title: "Vendor deleted" });
      await fetchVendors();
    } catch (e: any) {
      toast({ title: "Error deleting vendor", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openNewWarehouse = () => {
    setEditingWarehouse(null);
    setWarehouseForm({ name: "", location: "", is_main: false });
    setWarehouseDialogOpen(true);
  };

  const openEditWarehouse = (w: Warehouse) => {
    setEditingWarehouse(w);
    setWarehouseForm({ name: w.name || "", location: w.location || "", is_main: !!w.is_main });
    setWarehouseDialogOpen(true);
  };

  const saveWarehouse = async () => {
    setSaving(true);
    try {
      const payload = {
        name: warehouseForm.name.trim() || null,
        location: warehouseForm.location.trim() || null,
        is_main: !!warehouseForm.is_main,
      };

      if (editingWarehouse) {
        const { error } = await supabase
          .from("warehouses_master")
          .update(payload)
          .eq("id", editingWarehouse.id);
        if (error) throw error;
        toast({ title: "Warehouse updated" });
      } else {
        const { error } = await supabase.from("warehouses_master").insert([payload]);
        if (error) throw error;
        toast({ title: "Warehouse created" });
      }

      setWarehouseDialogOpen(false);
      await fetchWarehouses();
    } catch (e: any) {
      toast({ title: "Error saving warehouse", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteWarehouse = async (w: Warehouse) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("warehouses_master")
        .delete()
        .eq("id", w.id);
      if (error) throw error;
      toast({ title: "Warehouse deleted" });
      await fetchWarehouses();
    } catch (e: any) {
      toast({ title: "Error deleting warehouse", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openNewMachine = () => {
    setEditingMachine(null);
    setMachineForm({ name: "", machine_type: "", classification: "" });
    setMachineDialogOpen(true);
  };

  const openEditMachine = (m: Machine) => {
    setEditingMachine(m);
    setMachineForm({
      name: m.name || "",
      machine_type: m.machine_type || "",
      classification: m.classification || "",
    });
    setMachineDialogOpen(true);
  };

  const saveMachine = async () => {
    if (!machineForm.name.trim()) {
      toast({ title: "Machine name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: machineForm.name.trim(),
        machine_type: machineForm.machine_type.trim() || null,
        classification: machineForm.classification.trim() || null,
      };

      if (editingMachine) {
        const { error } = await supabase
          .from("machine_master")
          .update(payload)
          .eq("id", editingMachine.id);
        if (error) throw error;
        toast({ title: "Machine updated" });
      } else {
        const { error } = await supabase.from("machine_master").insert([payload]);
        if (error) throw error;
        toast({ title: "Machine created" });
      }

      setMachineDialogOpen(false);
      await fetchMachines();
    } catch (e: any) {
      toast({ title: "Error saving machine", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteMachine = async (m: Machine) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("machine_master").delete().eq("id", m.id);
      if (error) throw error;
      toast({ title: "Machine deleted" });
      await fetchMachines();
    } catch (e: any) {
      toast({ title: "Error deleting machine", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openNewRm = () => {
    setEditingRm(null);
    setRmForm({
      material_code: "",
      name: "",
      material_type: "",
      gsm: "",
      ply: "",
      width_mm: "",
      grade: "",
      uom: "KG",
    });
    setRmDialogOpen(true);
  };

  const openEditRm = (rm: RawMaterial) => {
    setEditingRm(rm);
    setRmForm({
      material_code: rm.material_code || "",
      name: rm.name || "",
      material_type: rm.material_type || "",
      gsm: rm.gsm === null || rm.gsm === undefined ? "" : String(rm.gsm),
      ply: rm.ply === null || rm.ply === undefined ? "" : String(rm.ply),
      width_mm: rm.width_mm === null || rm.width_mm === undefined ? "" : String(rm.width_mm),
      grade: rm.grade || "",
      uom: rm.uom || "KG",
    });
    setRmDialogOpen(true);
  };

  const saveRm = async () => {
    if (!rmForm.material_code.trim() || !rmForm.name.trim()) {
      toast({ title: "Material code and name are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        material_code: rmForm.material_code.trim(),
        name: rmForm.name.trim(),
        material_type: rmForm.material_type.trim() || null,
        gsm: rmForm.gsm.trim() ? Number(rmForm.gsm) : null,
        ply: rmForm.ply.trim() ? Number(rmForm.ply) : null,
        width_mm: rmForm.width_mm.trim() ? Number(rmForm.width_mm) : null,
        grade: rmForm.grade.trim() || null,
        uom: rmForm.uom.trim() || "KG",
      };

      if (editingRm) {
        const { error } = await supabase
          .from("raw_material_master")
          .update(payload)
          .eq("id", editingRm.id);
        if (error) throw error;
        toast({ title: "Raw material updated" });
      } else {
        const { error } = await supabase.from("raw_material_master").insert([payload]);
        if (error) throw error;
        toast({ title: "Raw material created" });
      }

      setRmDialogOpen(false);
      await fetchRawMaterials();
    } catch (e: any) {
      toast({ title: "Error saving raw material", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteRm = async (rm: RawMaterial) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("raw_material_master")
        .delete()
        .eq("id", rm.id);
      if (error) throw error;
      toast({ title: "Raw material deleted" });
      await fetchRawMaterials();
    } catch (e: any) {
      toast({ title: "Error deleting raw material", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    setProductForm({
      product_code: "",
      name: "",
      category: "",
      type: "",
      grade: "",
      gsm: "",
      ply: "",
      avg_weight: "",
      packaging_sizes: "",
    });
    setProductDialogOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      product_code: p.product_code || "",
      name: p.name || "",
      category: p.category || "",
      type: p.type || "",
      grade: p.grade || "",
      gsm: p.gsm === null || p.gsm === undefined ? "" : String(p.gsm),
      ply: p.ply === null || p.ply === undefined ? "" : String(p.ply),
      avg_weight: p.avg_weight === null || p.avg_weight === undefined ? "" : String(p.avg_weight),
      packaging_sizes: p.packaging_sizes ? JSON.stringify(p.packaging_sizes) : "",
    });
    setProductDialogOpen(true);
  };

  const saveProduct = async () => {
    if (!productForm.product_code.trim() || !productForm.name.trim()) {
      toast({ title: "Product code and name are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        product_code: productForm.product_code.trim(),
        name: productForm.name.trim(),
        category: productForm.category.trim() || null,
        type: productForm.type.trim() || null,
        grade: productForm.grade.trim() || null,
        gsm: productForm.gsm.trim() ? Number(productForm.gsm) : null,
        ply: productForm.ply.trim() ? Number(productForm.ply) : null,
        avg_weight: productForm.avg_weight.trim() ? Number(productForm.avg_weight) : null,
        packaging_sizes: productForm.packaging_sizes.trim()
          ? JSON.parse(productForm.packaging_sizes)
          : null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products_master")
          .update(payload)
          .eq("id", editingProduct.id);
        if (error) throw error;
        toast({ title: "Product updated" });
      } else {
        const { error } = await supabase.from("products_master").insert([payload]);
        if (error) throw error;
        toast({ title: "Product created" });
      }

      setProductDialogOpen(false);
      await fetchProducts();
    } catch (e: any) {
      toast({ title: "Error saving product", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (p: Product) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("products_master").delete().eq("id", p.id);
      if (error) throw error;
      toast({ title: "Product deleted" });
      await fetchProducts();
    } catch (e: any) {
      toast({ title: "Error deleting product", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredVendors = useMemo(() => {
    if (!search.trim()) return vendorList;
    const s = search.toLowerCase();
    return vendorList.filter((v) => (v.name || "").toLowerCase().includes(s));
  }, [vendorList, search]);

  const filteredWarehouses = useMemo(() => {
    if (!search.trim()) return warehouseList;
    const s = search.toLowerCase();
    return warehouseList.filter((w) =>
      `${w.name || ""} ${w.location || ""}`.toLowerCase().includes(s)
    );
  }, [warehouseList, search]);

  const filteredMachines = useMemo(() => {
    if (!search.trim()) return machineList;
    const s = search.toLowerCase();
    return machineList.filter((m) => (m.name || "").toLowerCase().includes(s));
  }, [machineList, search]);

  const filteredRawMaterials = useMemo(() => {
    if (!search.trim()) return rawMaterialList;
    const s = search.toLowerCase();
    return rawMaterialList.filter((m) =>
      `${m.name || ""} ${m.material_code || ""}`.toLowerCase().includes(s)
    );
  }, [rawMaterialList, search]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return productList;
    const s = search.toLowerCase();
    return productList.filter((p) =>
      `${p.name || ""} ${p.product_code || ""}`.toLowerCase().includes(s)
    );
  }, [productList, search]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Master Data</h1>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search master data..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            data-testid="input-search-master"
          />
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "vendors" && (
            <Button onClick={openNewVendor} data-testid="button-add-vendor">
              <Plus className="h-4 w-4 mr-2" />
              New Vendor
            </Button>
          )}
          {activeTab === "warehouses" && (
            <Button onClick={openNewWarehouse} data-testid="button-add-warehouse">
              <Plus className="h-4 w-4 mr-2" />
              New Warehouse
            </Button>
          )}
          {activeTab === "machines" && (
            <Button onClick={openNewMachine} data-testid="button-add-machine">
              <Plus className="h-4 w-4 mr-2" />
              New Machine
            </Button>
          )}
          {activeTab === "raw-materials" && (
            <Button onClick={openNewRm} data-testid="button-add-raw-material">
              <Plus className="h-4 w-4 mr-2" />
              New Raw Material
            </Button>
          )}
          {activeTab === "products" && (
            <Button onClick={openNewProduct} data-testid="button-add-product">
              <Plus className="h-4 w-4 mr-2" />
              New Product
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Masters</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList>
                <TabsTrigger value="vendors">Vendors</TabsTrigger>
                <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
                <TabsTrigger value="machines">Machines</TabsTrigger>
                <TabsTrigger value="raw-materials">Raw Materials</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
              </TabsList>

              <TabsContent value="vendors" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Name</th>
                        <th className="text-left py-2 px-2">Contact</th>
                        <th className="text-left py-2 px-2">Phone</th>
                        <th className="text-left py-2 px-2">Email</th>
                        <th className="text-center py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVendors.map((v) => (
                        <tr key={v.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-medium">{v.name}</td>
                          <td className="py-2 px-2">{v.contact_person || "-"}</td>
                          <td className="py-2 px-2">{v.phone || "-"}</td>
                          <td className="py-2 px-2">{v.email || "-"}</td>
                          <td className="py-2 px-2">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditVendor(v)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteVendor(v)}
                                disabled={saving}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="warehouses" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Name</th>
                        <th className="text-left py-2 px-2">Location</th>
                        <th className="text-left py-2 px-2">Main</th>
                        <th className="text-center py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWarehouses.map((w) => (
                        <tr key={w.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-medium">{w.name || "-"}</td>
                          <td className="py-2 px-2">{w.location || "-"}</td>
                          <td className="py-2 px-2">{w.is_main ? "Yes" : "No"}</td>
                          <td className="py-2 px-2">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditWarehouse(w)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteWarehouse(w)}
                                disabled={saving}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="machines" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Name</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-left py-2 px-2">Classification</th>
                        <th className="text-center py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMachines.map((m) => (
                        <tr key={m.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-medium">{m.name}</td>
                          <td className="py-2 px-2">{m.machine_type || "-"}</td>
                          <td className="py-2 px-2">{m.classification || "-"}</td>
                          <td className="py-2 px-2">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditMachine(m)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMachine(m)}
                                disabled={saving}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="raw-materials" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Code</th>
                        <th className="text-left py-2 px-2">Name</th>
                        <th className="text-left py-2 px-2">UOM</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-center py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRawMaterials.map((rm) => (
                        <tr key={rm.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-mono">{rm.material_code}</td>
                          <td className="py-2 px-2 font-medium">{rm.name}</td>
                          <td className="py-2 px-2">{rm.uom}</td>
                          <td className="py-2 px-2">{rm.material_type || "-"}</td>
                          <td className="py-2 px-2">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditRm(rm)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteRm(rm)}
                                disabled={saving}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="products" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Code</th>
                        <th className="text-left py-2 px-2">Name</th>
                        <th className="text-left py-2 px-2">Category</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-center py-2 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-mono">{p.product_code}</td>
                          <td className="py-2 px-2 font-medium">{p.name}</td>
                          <td className="py-2 px-2">{p.category || "-"}</td>
                          <td className="py-2 px-2">{p.type || "-"}</td>
                          <td className="py-2 px-2">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditProduct(p)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteProduct(p)}
                                disabled={saving}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "Edit Vendor" : "New Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="vendor_name">Name *</Label>
              <Input
                id="vendor_name"
                value={vendorForm.name}
                onChange={(e) => setVendorForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor_contact">Contact Person</Label>
                <Input
                  id="vendor_contact"
                  value={vendorForm.contact_person}
                  onChange={(e) => setVendorForm((p) => ({ ...p, contact_person: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor_phone">Phone</Label>
                <Input
                  id="vendor_phone"
                  value={vendorForm.phone}
                  onChange={(e) => setVendorForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor_email">Email</Label>
                <Input
                  id="vendor_email"
                  value={vendorForm.email}
                  onChange={(e) => setVendorForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor_address">Address</Label>
                <Input
                  id="vendor_address"
                  value={vendorForm.address}
                  onChange={(e) => setVendorForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVendorDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveVendor} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={warehouseDialogOpen} onOpenChange={setWarehouseDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingWarehouse ? "Edit Warehouse" : "New Warehouse"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wh_name">Name</Label>
                <Input
                  id="wh_name"
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wh_location">Location</Label>
                <Input
                  id="wh_location"
                  value={warehouseForm.location}
                  onChange={(e) => setWarehouseForm((p) => ({ ...p, location: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">Set as Main Warehouse</div>
                <div className="text-sm text-muted-foreground">Used by FG stock auto insert</div>
              </div>
              <Switch
                checked={warehouseForm.is_main}
                onCheckedChange={(checked) => setWarehouseForm((p) => ({ ...p, is_main: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarehouseDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveWarehouse} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={machineDialogOpen} onOpenChange={setMachineDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingMachine ? "Edit Machine" : "New Machine"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="machine_name">Name *</Label>
              <Input
                id="machine_name"
                value={machineForm.name}
                onChange={(e) => setMachineForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="machine_type">Type</Label>
                <Input
                  id="machine_type"
                  value={machineForm.machine_type}
                  onChange={(e) => setMachineForm((p) => ({ ...p, machine_type: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="machine_class">Classification</Label>
                <Input
                  id="machine_class"
                  value={machineForm.classification}
                  onChange={(e) => setMachineForm((p) => ({ ...p, classification: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMachineDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveMachine} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rmDialogOpen} onOpenChange={setRmDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRm ? "Edit Raw Material" : "New Raw Material"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rm_code">Material Code *</Label>
                <Input
                  id="rm_code"
                  value={rmForm.material_code}
                  onChange={(e) => setRmForm((p) => ({ ...p, material_code: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rm_name">Name *</Label>
                <Input
                  id="rm_name"
                  value={rmForm.name}
                  onChange={(e) => setRmForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rm_uom">UOM</Label>
                <Input
                  id="rm_uom"
                  value={rmForm.uom}
                  onChange={(e) => setRmForm((p) => ({ ...p, uom: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rm_type">Material Type</Label>
                <Input
                  id="rm_type"
                  value={rmForm.material_type}
                  onChange={(e) => setRmForm((p) => ({ ...p, material_type: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rm_gsm">GSM</Label>
                <Input
                  id="rm_gsm"
                  type="number"
                  value={rmForm.gsm}
                  onChange={(e) => setRmForm((p) => ({ ...p, gsm: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rm_ply">Ply</Label>
                <Input
                  id="rm_ply"
                  type="number"
                  value={rmForm.ply}
                  onChange={(e) => setRmForm((p) => ({ ...p, ply: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rm_width">Width (mm)</Label>
                <Input
                  id="rm_width"
                  type="number"
                  value={rmForm.width_mm}
                  onChange={(e) => setRmForm((p) => ({ ...p, width_mm: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rm_grade">Grade</Label>
                <Input
                  id="rm_grade"
                  value={rmForm.grade}
                  onChange={(e) => setRmForm((p) => ({ ...p, grade: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRmDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveRm} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "New Product"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p_code">Product Code *</Label>
                <Input
                  id="p_code"
                  value={productForm.product_code}
                  onChange={(e) => setProductForm((p) => ({ ...p, product_code: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_name">Name *</Label>
                <Input
                  id="p_name"
                  value={productForm.name}
                  onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p_category">Category</Label>
                <Input
                  id="p_category"
                  value={productForm.category}
                  onChange={(e) => setProductForm((p) => ({ ...p, category: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_type">Type</Label>
                <Input
                  id="p_type"
                  value={productForm.type}
                  onChange={(e) => setProductForm((p) => ({ ...p, type: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p_gsm">GSM</Label>
                <Input
                  id="p_gsm"
                  type="number"
                  value={productForm.gsm}
                  onChange={(e) => setProductForm((p) => ({ ...p, gsm: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_ply">Ply</Label>
                <Input
                  id="p_ply"
                  type="number"
                  value={productForm.ply}
                  onChange={(e) => setProductForm((p) => ({ ...p, ply: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_avg_weight">Avg Weight</Label>
                <Input
                  id="p_avg_weight"
                  type="number"
                  value={productForm.avg_weight}
                  onChange={(e) => setProductForm((p) => ({ ...p, avg_weight: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p_grade">Grade</Label>
              <Input
                id="p_grade"
                value={productForm.grade}
                onChange={(e) => setProductForm((p) => ({ ...p, grade: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p_pack">Packaging Sizes (JSON)</Label>
              <Input
                id="p_pack"
                value={productForm.packaging_sizes}
                onChange={(e) => setProductForm((p) => ({ ...p, packaging_sizes: e.target.value }))}
                placeholder='e.g. ["10kg","25kg"]'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveProduct} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
