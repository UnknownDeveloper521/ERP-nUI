import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import ModuleTabs from "@/components/shared/ModuleTabs";
import { inventoryTabs } from "./InventoryDashboard";
import { Plus, Search, Pencil, Trash2, ArrowUpDown, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type MaterialType = "ROLL" | "PACKAGING";

interface RollMaterial {
  id: string;
  name: string;
  gsm: number | null;
  ply: number | null;
  width_mm: number | null;
  grade: string | null;
  product_id: string | null;
  weight_kg: number;
  vendor_id: string | null;
  purchase_order_no: string | null;
  lot_no: string | null;
  container_no: string | null;
  created_at: string;
}

interface PackagingMaterial {
  id: string;
  name: string;
  packaging_type: string | null;
  material: string | null;
  product_id: string | null;
  weight_per_unit: number | null;
  batch_weight: number | null;
  vendor_id: string | null;
  purchase_order_no: string | null;
  created_at: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface Warehouse {
  id: string;
  name: string | null;
  is_main: boolean;
}

interface Receipt {
  id: string;
  receipt_no: string;
  material_type: MaterialType | null;
  roll_material_id: string | null;
  packaging_material_id: string | null;
  vendor_id?: string;
  purchase_order_no?: string;
  supplier_invoice_no?: string;
  lot_no?: string;
  container_no?: string;
  received_date: string;
  gross_qty: number;
  qc_passed_qty: number;
  rejected_qty: number;
  unit_cost: number;
  total_cost?: number;
  warehouse_location: string;
  qc_status: string;
  remarks?: string;
  created_at: string;
  warehouse_id?: string;
  raw_material_roll_master?: Pick<RollMaterial, "id" | "name" | "weight_kg">;
  packaging_material_master?: Pick<PackagingMaterial, "id" | "name" | "weight_per_unit">;
  warehouses_master?: Pick<Warehouse, "name">;
}

interface ReceiptFormData {
  material_type: MaterialType;
  roll_material_id: string;
  packaging_material_id: string;
  vendor_id: string;
  receipt_no: string;
  purchase_order_no: string;
  supplier_invoice_no: string;
  lot_no: string;
  container_no: string;
  received_date: string;
  gross_qty: string;
  qc_passed_qty: string;
  rejected_qty: string;
  unit_cost: string;
  unit_cost: string;
  warehouse_location: string;
  warehouse_id: string;
  qc_status: string;
  remarks: string;
}

const NONE_VENDOR_VALUE = "__none__";
const NONE_MATERIAL_VALUE = "__none__";

const initialFormData: ReceiptFormData = {
  material_type: "ROLL",
  roll_material_id: "",
  packaging_material_id: "",
  vendor_id: NONE_VENDOR_VALUE,
  receipt_no: "",
  purchase_order_no: "",
  supplier_invoice_no: "",
  lot_no: "",
  container_no: "",
  received_date: new Date().toISOString().split("T")[0],
  gross_qty: "",
  qc_passed_qty: "",
  rejected_qty: "0",
  unit_cost: "",
  warehouse_location: "",
  warehouse_id: "",
  qc_status: "Pending",
  remarks: "",
};

export default function RawMaterialReceipt() {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [rollMaterials, setRollMaterials] = useState<RollMaterial[]>([]);
  const [packagingMaterials, setPackagingMaterials] = useState<PackagingMaterial[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [deletingReceipt, setDeletingReceipt] = useState<Receipt | null>(null);
  const [formData, setFormData] = useState<ReceiptFormData>(initialFormData);
  const [searchTerm, setSearchTerm] = useState("");
  const [materialFilter, setMaterialFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedMaterialUom, setSelectedMaterialUom] = useState("");

  useEffect(() => {
    fetchReceipts();
    fetchRollMaterials();
    fetchPackagingMaterials();
    fetchVendors();
    fetchWarehouses();
  }, []);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("raw_material_receipts")
        .select(`
          *,
          raw_material_roll_master ( id, name, weight_kg ),
          packaging_material_master ( id, name, weight_per_unit ),
          warehouses_master ( name )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading receipts",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from("vendors_master")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setVendors((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading vendors",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from("warehouses_master")
        .select("id, name, is_main")
        .order("is_main", { ascending: false });

      if (error) throw error;
      setWarehouses((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading warehouses",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchRollMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("raw_material_roll_master")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRollMaterials((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading roll materials",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchPackagingMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("packaging_material_master")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPackagingMaterials((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading packaging materials",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generateReceiptNo = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `RMR-${year}${month}${day}-${random}`;
  };

  const openNewReceiptDialog = () => {
    setEditingReceipt(null);
    setFormData({
      ...initialFormData,
      receipt_no: generateReceiptNo(),
      received_date: new Date().toISOString().split("T")[0],
    });
    setSelectedMaterialUom("KG");
    setDialogOpen(true);
  };

  const openEditDialog = (receipt: Receipt) => {
    setEditingReceipt(receipt);
    setFormData({
      material_type: receipt.material_type || "ROLL",
      roll_material_id: receipt.roll_material_id || "",
      packaging_material_id: receipt.packaging_material_id || "",
      vendor_id: receipt.vendor_id || NONE_VENDOR_VALUE,
      receipt_no: receipt.receipt_no,
      purchase_order_no: receipt.purchase_order_no || "",
      supplier_invoice_no: receipt.supplier_invoice_no || "",
      lot_no: receipt.lot_no || "",
      container_no: receipt.container_no || "",
      received_date: receipt.received_date,
      gross_qty: String(receipt.gross_qty),
      qc_passed_qty: String(receipt.qc_passed_qty),
      rejected_qty: String(receipt.rejected_qty || 0),
      unit_cost: String(receipt.unit_cost),
      warehouse_location: receipt.warehouse_location || "MAIN",
      warehouse_id: receipt.warehouse_id || "",
      qc_status: receipt.qc_status || "Pending",
      remarks: receipt.remarks || "",
    });

    if (receipt.material_type === "PACKAGING") {
      setSelectedMaterialUom("UNITS");
    } else {
      setSelectedMaterialUom("KG");
    }
    setDialogOpen(true);
  };

  const handleMaterialTypeChange = (t: MaterialType) => {
    setFormData((prev) => ({
      ...prev,
      material_type: t,
      roll_material_id: "",
      packaging_material_id: "",
    }));
    setSelectedMaterialUom(t === "PACKAGING" ? "UNITS" : "KG");
  };

  const handleMaterialChange = (id: string) => {
    if (id === NONE_MATERIAL_VALUE) {
      setFormData((prev) => ({ ...prev, roll_material_id: "", packaging_material_id: "" }));
      return;
    }

    if (formData.material_type === "PACKAGING") {
      setFormData((prev) => ({ ...prev, packaging_material_id: id, roll_material_id: "" }));
      setSelectedMaterialUom("UNITS");
    } else {
      setFormData((prev) => ({ ...prev, roll_material_id: id, packaging_material_id: "" }));
      setSelectedMaterialUom("KG");
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Auto-calculate Rejected Qty when Gross or QC Passed changes
  useEffect(() => {
    const gross = parseFloat(formData.gross_qty);
    const passed = parseFloat(formData.qc_passed_qty);

    if (!isNaN(gross) && !isNaN(passed)) {
      const rejected = gross - passed;
      const newRejected = rejected >= 0 ? rejected : 0;

      // Update if different to avoid infinite loops
      // We check fuzzy equality or just direct comparison since they are strings in state but calc as numbers
      if (parseFloat(formData.rejected_qty) !== newRejected) {
        setFormData(prev => ({ ...prev, rejected_qty: String(newRejected.toFixed(2)) }));
      }
    }
  }, [formData.gross_qty, formData.qc_passed_qty]);

  const validateForm = (): boolean => {
    if (formData.material_type === "ROLL" && !formData.roll_material_id) {
      toast({ title: "Please select a roll material", variant: "destructive" });
      return false;
    }
    if (formData.material_type === "PACKAGING" && !formData.packaging_material_id) {
      toast({ title: "Please select a packaging material", variant: "destructive" });
      return false;
    }
    if (!formData.warehouse_id) {
      toast({ title: "Warehouse is required", variant: "destructive" });
      return false;
    }
    if (!formData.receipt_no) {
      toast({ title: "Receipt number is required", variant: "destructive" });
      return false;
    }
    if (!formData.received_date) {
      toast({ title: "Received date is required", variant: "destructive" });
      return false;
    }
    const grossQty = parseFloat(formData.gross_qty);
    if (isNaN(grossQty) || grossQty <= 0) {
      toast({ title: "Gross quantity must be greater than zero", variant: "destructive" });
      return false;
    }
    const qcPassedQty = parseFloat(formData.qc_passed_qty);
    if (isNaN(qcPassedQty) || qcPassedQty < 0) {
      toast({ title: "QC passed quantity must be zero or greater", variant: "destructive" });
      return false;
    }
    if (qcPassedQty > grossQty) {
      toast({ title: "QC Passed Quantity cannot be greater than Gross Quantity.", variant: "destructive" });
      return false;
    }
    const unitCost = parseFloat(formData.unit_cost);
    if (isNaN(unitCost) || unitCost < 0) {
      toast({ title: "Unit cost must be zero or greater", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const receiptData = {
        material_type: formData.material_type,
        roll_material_id: formData.material_type === "ROLL" ? formData.roll_material_id : null,
        packaging_material_id:
          formData.material_type === "PACKAGING" ? formData.packaging_material_id : null,
        vendor_id:
          !formData.vendor_id || formData.vendor_id === NONE_VENDOR_VALUE
            ? null
            : formData.vendor_id,
        receipt_no: formData.receipt_no,
        purchase_order_no: formData.purchase_order_no || null,
        supplier_invoice_no: formData.supplier_invoice_no || null,
        lot_no: formData.lot_no || null,
        container_no: formData.container_no || null,
        received_date: formData.received_date,
        gross_qty: parseFloat(formData.gross_qty),
        qc_passed_qty: parseFloat(formData.qc_passed_qty),
        rejected_qty: parseFloat(formData.rejected_qty) || 0,
        unit_cost: parseFloat(formData.unit_cost),
        // warehouse_location: formData.warehouse_location, // Deprecated in favor of ID, handled by trigger/backend or sent for legacy
        warehouse_id: formData.warehouse_id,
        qc_status: formData.qc_status,
        remarks: formData.remarks || null,
      };

      if (editingReceipt) {
        const { error } = await supabase
          .from("raw_material_receipts")
          .update(receiptData)
          .eq("id", editingReceipt.id);

        if (error) throw error;
        toast({ title: "Receipt updated successfully" });
      } else {
        const { error } = await supabase
          .from("raw_material_receipts")
          .insert([receiptData]);

        if (error) throw error;
        toast({ title: "Receipt created successfully" });
      }

      setDialogOpen(false);
      fetchReceipts();
    } catch (error: any) {
      const msg = String(error?.message || "");
      const details = String(error?.details || "");
      const code = String(error?.code || "");
      const combined = `${code} ${msg} ${details}`.toLowerCase();

      if (
        editingReceipt &&
        (combined.includes("already been issued") ||
          combined.includes("cannot edit receipt") ||
          combined.includes("rm has already been issued") ||
          combined.includes("issued"))
      ) {
        toast({
          title: "Cannot update receipt",
          description: "RM already been issued.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: editingReceipt ? "Error updating receipt" : "Error creating receipt",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingReceipt) return;

    setSaving(true);
    try {
      const issueCheck = await supabase
        .from("raw_material_issues")
        .select("id", { count: "exact", head: true })
        .eq("receipt_id", deletingReceipt.id);

      if (issueCheck.error) throw issueCheck.error;
      const issueCount = Number(issueCheck.count ?? 0);
      if (issueCount > 0) {
        toast({
          title: "Cannot delete receipt",
          description: "RM already been issued.",
          variant: "destructive",
        });
        setDeleteDialogOpen(false);
        setDeletingReceipt(null);
        return;
      }

      const { error } = await supabase
        .from("raw_material_receipts")
        .delete()
        .eq("id", deletingReceipt.id);

      if (error) throw error;
      toast({ title: "Receipt deleted successfully" });
      setDeleteDialogOpen(false);
      setDeletingReceipt(null);
      fetchReceipts();
    } catch (error: any) {
      const msg = String(error?.message || "");
      const details = String(error?.details || "");
      const code = String(error?.code || "");
      const combined = `${code} ${msg} ${details}`.toLowerCase();

      if (combined.includes("foreign key") || combined.includes("violates foreign key") || code === "23503") {
        toast({
          title: "Cannot delete receipt",
          description: "RM already been issued.",
          variant: "destructive",
        });
        setDeleteDialogOpen(false);
        setDeletingReceipt(null);
        return;
      }

      toast({
        title: "Error deleting receipt",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredReceipts = receipts
    .filter((receipt) => {
      const searchLower = searchTerm.toLowerCase();
      const materialName =
        receipt.material_type === "PACKAGING"
          ? receipt.packaging_material_master?.name || ""
          : receipt.raw_material_roll_master?.name || "";

      const matchesSearch =
        (receipt.receipt_no || "").toLowerCase().includes(searchLower) ||
        materialName.toLowerCase().includes(searchLower) ||
        (receipt.supplier_invoice_no || "").toLowerCase().includes(searchLower);

      const receiptFilterKey =
        receipt.material_type === "PACKAGING"
          ? `PACKAGING:${receipt.packaging_material_id || ""}`
          : `ROLL:${receipt.roll_material_id || ""}`;

      const matchesMaterial = materialFilter === "all" || receiptFilterKey === materialFilter;
      return matchesSearch && matchesMaterial;
    })
    .sort((a, b) => {
      const dateA = new Date(a.received_date).getTime();
      const dateB = new Date(b.received_date).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

  const getQcStatusStyle = (status: string) => {
    switch (status) {
      case "Passed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "Failed":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    }
  };

  const vendorNameById = (id?: string) => {
    if (!id || id === NONE_VENDOR_VALUE) return "-";
    const v = vendors.find((x) => x.id === id);
    return v?.name || "-";
  };

  const materialDisplayName = (r: Receipt) => {
    if (r.material_type === "PACKAGING") return r.packaging_material_master?.name || "Unknown";
    return r.raw_material_roll_master?.name || "Unknown";
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Inventory</h1>
      <ModuleTabs tabs={inventoryTabs} />

      <div className="flex flex-wrap justify-between items-center gap-4 mt-4">
        <h2 className="text-lg font-medium">Raw Material Receipt</h2>
        <Button onClick={openNewReceiptDialog} data-testid="button-add-receipt">
          <Plus className="h-4 w-4 mr-2" />
          New Receipt
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-base">Receipts</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search receipts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[200px]"
                  data-testid="input-search"
                />
              </div>
              <Select value={materialFilter} onValueChange={setMaterialFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-material-filter">
                  <SelectValue placeholder="Filter by material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Materials</SelectItem>
                  <SelectItem value="ROLL:__all__" disabled>
                    Rolls
                  </SelectItem>
                  {rollMaterials.map((m) => (
                    <SelectItem key={m.id} value={`ROLL:${m.id}`}>
                      {m.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="PACKAGING:__all__" disabled>
                    Packaging
                  </SelectItem>
                  {packagingMaterials.map((m) => (
                    <SelectItem key={m.id} value={`PACKAGING:${m.id}`}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                data-testid="button-sort"
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || materialFilter !== "all"
                ? "No receipts match your filters"
                : "No receipts found. Click 'New Receipt' to add one."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Receipt No</th>
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Material</th>
                    <th className="text-left py-2 px-2">Vendor</th>
                    <th className="text-left py-2 px-2">Warehouse</th>
                    <th className="text-right py-2 px-2">Gross Qty</th>
                    <th className="text-right py-2 px-2">QC Passed</th>
                    <th className="text-right py-2 px-2">Unit Cost</th>
                    <th className="text-right py-2 px-2">Total Cost</th>
                    <th className="text-left py-2 px-2">QC Status</th>
                    <th className="text-center py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((receipt) => (
                    <tr
                      key={receipt.id}
                      className="border-b hover:bg-muted/50"
                      data-testid={`row-receipt-${receipt.id}`}
                    >
                      <td className="py-2 px-2 font-mono text-primary">
                        {receipt.receipt_no}
                      </td>
                      <td className="py-2 px-2">{receipt.received_date}</td>
                      <td className="py-2 px-2">
                        {materialDisplayName(receipt)}
                      </td>
                      <td className="py-2 px-2">{vendorNameById(receipt.vendor_id)}</td>
                      <td className="py-2 px-2">
                        {receipt.warehouses_master?.name || receipt.warehouse_location || "-"}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {receipt.gross_qty} {receipt.material_type === "PACKAGING" ? "UNITS" : "KG"}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {receipt.qc_passed_qty} {receipt.material_type === "PACKAGING" ? "UNITS" : "KG"}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {Number(receipt.unit_cost).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-right font-medium">
                        {Number(receipt.total_cost || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${getQcStatusStyle(
                            receipt.qc_status
                          )}`}
                        >
                          {receipt.qc_status}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(receipt)}
                            data-testid={`button-edit-${receipt.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingReceipt(receipt);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`button-delete-${receipt.id}`}
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
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReceipt ? "Edit Receipt" : "New Raw Material Receipt"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="receipt_no">Receipt No</Label>
                <Input
                  id="receipt_no"
                  name="receipt_no"
                  value={formData.receipt_no}
                  onChange={handleInputChange}
                  placeholder="RMR-YYYYMMDD-XXX"
                  data-testid="input-receipt-no"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="received_date">Received Date *</Label>
                <Input
                  id="received_date"
                  name="received_date"
                  type="date"
                  value={formData.received_date}
                  onChange={handleInputChange}
                  data-testid="input-received-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="material_type">Material Type *</Label>
                <Select
                  value={formData.material_type}
                  onValueChange={(v) => handleMaterialTypeChange(v as MaterialType)}
                >
                  <SelectTrigger data-testid="select-material-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ROLL">ROLL</SelectItem>
                    <SelectItem value="PACKAGING">PACKAGING</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>UOM (Auto-filled)</Label>
                <Input
                  value={selectedMaterialUom}
                  disabled
                  className="bg-muted"
                  data-testid="input-uom"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="material_select">
                  {formData.material_type === "PACKAGING" ? "Packaging Material *" : "Roll Material *"}
                </Label>
                <Select
                  value={
                    formData.material_type === "PACKAGING"
                      ? formData.packaging_material_id || ""
                      : formData.roll_material_id || ""
                  }
                  onValueChange={handleMaterialChange}
                >
                  <SelectTrigger data-testid="select-material">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.material_type === "PACKAGING" ? (
                      packagingMaterials.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))
                    ) : (
                      rollMaterials.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor_id">Vendor</Label>
                <Select
                  value={formData.vendor_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, vendor_id: v }))}
                >
                  <SelectTrigger data-testid="select-vendor">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VENDOR_VALUE}>None</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="warehouse_id">Warehouse *</Label>
                <Select
                  value={formData.warehouse_id}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, warehouse_id: v }))
                  }
                >
                  <SelectTrigger data-testid="select-warehouse">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                        {w.is_main ? " (Main)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_order_no">Purchase Order No</Label>
                <Input
                  id="purchase_order_no"
                  name="purchase_order_no"
                  value={formData.purchase_order_no}
                  onChange={handleInputChange}
                  placeholder="PO-XXXX"
                  data-testid="input-po-no"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier_invoice_no">Supplier Invoice No</Label>
                <Input
                  id="supplier_invoice_no"
                  name="supplier_invoice_no"
                  value={formData.supplier_invoice_no}
                  onChange={handleInputChange}
                  placeholder="INV-XXXX"
                  data-testid="input-invoice-no"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lot_no">Lot / Batch No</Label>
                <Input
                  id="lot_no"
                  name="lot_no"
                  value={formData.lot_no}
                  onChange={handleInputChange}
                  placeholder="LOT-XXXX"
                  data-testid="input-lot-no"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="container_no">Container No</Label>
                <Input
                  id="container_no"
                  name="container_no"
                  value={formData.container_no}
                  onChange={handleInputChange}
                  placeholder="CONT-XXXX"
                  data-testid="input-container-no"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gross_qty">Gross Quantity *</Label>
                <Input
                  id="gross_qty"
                  name="gross_qty"
                  type="number"
                  step="0.01"
                  value={formData.gross_qty}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  data-testid="input-gross-qty"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qc_passed_qty">QC Passed Qty *</Label>
                <Input
                  id="qc_passed_qty"
                  name="qc_passed_qty"
                  type="number"
                  step="0.01"
                  value={formData.qc_passed_qty}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  data-testid="input-qc-passed-qty"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rejected_qty">Rejected Qty</Label>
                <Input
                  id="rejected_qty"
                  name="rejected_qty"
                  type="number"
                  step="0.01"
                  value={formData.rejected_qty}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  data-testid="input-rejected-qty"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit_cost">Unit Cost *</Label>
                <Input
                  id="unit_cost"
                  name="unit_cost"
                  type="number"
                  step="0.01"
                  value={formData.unit_cost}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  data-testid="input-unit-cost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qc_status">QC Status</Label>
                <Select
                  value={formData.qc_status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, qc_status: value }))
                  }
                >
                  <SelectTrigger data-testid="select-qc-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Passed">Passed</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                name="remarks"
                value={formData.remarks}
                onChange={handleInputChange}
                placeholder="Additional notes..."
                rows={3}
                data-testid="textarea-remarks"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving} data-testid="button-save">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingReceipt ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete receipt {deletingReceipt?.receipt_no}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
