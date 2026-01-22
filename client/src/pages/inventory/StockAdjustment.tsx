import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { inventoryTabs } from "./InventoryDashboard";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/store";
import { rawMaterialsApi, rawMaterialStockApi, stockAdjustmentsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";

type MaterialType = "ROLL" | "PACKAGING";
type AdjustmentType = "IN" | "OUT";

type RawMaterial = {
  id: string;
  name: string;
  material_type?: string | null;
};

type AdjustmentRow = {
  id: string;
  material_id: string | null;
  adj_type: string | null;
  qty_change: number | null;
  reason: string | null;
  approved_by: string | null;
  created_at: string;
  material_name?: string;
  material_type?: string | null;
};

type WarehouseRow = { id: string; name: string | null; is_main?: boolean };

export default function StockAdjustment() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [history, setHistory] = useState<AdjustmentRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);

  const [form, setForm] = useState({
    material_type: "ROLL" as MaterialType,
    material_id: "",
    warehouse_id: "",
    // We'll keep warehouse_location for backward compatibility in display if needed, 
    // but logic should rely on ID
    warehouse_location: "MAIN",
    adj_type: "IN" as AdjustmentType,
    quantity: "",
    reason: "",
  });

  const [currentStock, setCurrentStock] = useState<number>(0);

  // default to Main warehouse ID if available
  const defaultWarehouseId = useMemo(() => {
    const main = (warehouses || []).find((w) => w.is_main);
    return main?.id || (warehouses?.[0]?.id) || "";
  }, [warehouses]);

  const approvedByLabel = useMemo(() => {
    const anyUser: any = user as any;
    return String(anyUser?.email || anyUser?.name || anyUser?.supabaseId || "-");
  }, [user]);

  const typeBadgeClass = (t: AdjustmentType) => {
    if (t === "IN") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  };

  const loadMaterials = async (materialType: MaterialType) => {
    const rows = await rawMaterialsApi.getAll(materialType);
    setMaterials((rows as any) || []);
  };

  const loadWarehouses = async () => {
    const { data, error } = await supabase
      .from("warehouses_master")
      .select("id, name, is_main")
      .order("is_main", { ascending: false });
    if (error) throw error;
    setWarehouses((data as any) || []);
  };

  const loadHistory = async () => {
    const rows = await stockAdjustmentsApi.getAll(50);
    setHistory((rows as any) || []);
  };

  const loadCurrentStock = async (materialId: string, warehouseId: string) => {
    if (!materialId || !warehouseId) {
      setCurrentStock(0);
      return;
    }

    // Resolve warehouse name for the API which might still expect name for reading stock table
    const wh = warehouses.find(w => w.id === warehouseId);
    const whName = wh?.name || "MAIN";

    try {
      const res = await rawMaterialStockApi.getOne(form.material_type, materialId, whName, warehouseId);
      setCurrentStock(Number(res?.available_qty ?? 0));
    } catch (e) {
      // ignore 404
      setCurrentStock(0);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadMaterials(form.material_type), loadHistory(), loadWarehouses()]);
        if (!cancelled) {
          if (form.material_id && form.warehouse_id) {
            await loadCurrentStock(form.material_id, form.warehouse_id);
          }
        }
      } catch (error: any) {
        toast({ title: "Error loading stock adjustment", description: error.message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setForm((prev) => ({ ...prev, material_id: "" }));
        setCurrentStock(0);
        await loadMaterials(form.material_type);
      } catch (error: any) {
        toast({ title: "Error loading materials", description: error.message, variant: "destructive" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.material_type]);

  useEffect(() => {
    if (form.material_id && form.warehouse_id) {
      loadCurrentStock(form.material_id, form.warehouse_id);
    }
  }, [form.material_id, form.warehouse_id, warehouses]);

  const validate = () => {
    const qty = Number(form.quantity);
    if (!form.material_id) return "Material must be selected.";
    if (!form.warehouse_id) return "Warehouse must be selected.";
    if (!Number.isFinite(qty) || qty <= 0) return "Quantity must be > 0.";
    if (!String(form.reason || "").trim()) return "Reason must not be empty.";
    if (form.adj_type === "OUT" && qty > currentStock) return "Cannot remove more stock than available.";
    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Validation error", description: err, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const wh = warehouses.find(w => w.id === form.warehouse_id);

      await stockAdjustmentsApi.create({
        material_id: form.material_id,
        material_type: form.material_type,
        warehouse_id: form.warehouse_id,
        // Send location name for legacy reference/fallback if needed by API wrapper
        warehouse_location: wh?.name || "MAIN",
        adj_type: form.adj_type,
        quantity: Number(form.quantity),
        reason: String(form.reason || "").trim(),
      });

      toast({
        title: "Saved",
        description: form.adj_type === "IN" ? "Stock Added" : "Stock Removed",
      });

      setForm((prev) => ({ ...prev, quantity: "", reason: "" }));

      await Promise.all([
        loadCurrentStock(form.material_id, form.warehouse_id),
        loadHistory(),
      ]);

      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error saving adjustment", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openNewAdjustment = () => {
    setForm((prev) => ({
      ...prev,
      material_id: "",
      warehouse_id: defaultWarehouseId,
      warehouse_location: "",
      adj_type: "IN",
      quantity: "",
      reason: "",
    }));
    setCurrentStock(0);
    setDialogOpen(true);
  };

  const selectedMaterial = useMemo(() => {
    return materials.find((m) => m.id === form.material_id) || null;
  }, [materials, form.material_id]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Inventory</h1>
      <ModuleTabs tabs={inventoryTabs} />

      <div className="flex flex-wrap justify-between items-center gap-4 mt-4">
        <h2 className="text-lg font-medium">Stock Adjustment</h2>
        <Button
          variant="outline"
          onClick={openNewAdjustment}
          data-testid="button-new-adjustment"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Adjustment
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Add Adjustment</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Material Type</Label>
                <Select
                  value={form.material_type}
                  onValueChange={(v) => setForm((p) => ({ ...p, material_type: v as MaterialType }))}
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
                <Label>Select Material</Label>
                <Select
                  value={form.material_id}
                  onValueChange={(v) => setForm((p) => ({ ...p, material_id: v }))}
                >
                  <SelectTrigger data-testid="select-material">
                    <SelectValue placeholder="Choose material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Warehouse Location</Label>
                <Select
                  value={form.warehouse_id}
                  onValueChange={(v) => setForm((p) => ({ ...p, warehouse_id: v }))}
                >
                  <SelectTrigger data-testid="select-warehouse">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Current Stock</Label>
                <Input value={String(currentStock)} readOnly data-testid="input-current-stock" />
              </div>

              <div className="space-y-2">
                <Label>Adjustment Type</Label>
                <Select
                  value={form.adj_type}
                  onValueChange={(v) => setForm((p) => ({ ...p, adj_type: v as AdjustmentType }))}
                >
                  <SelectTrigger data-testid="select-adjustment-type">
                    <SelectValue placeholder="Choose type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">IN</SelectItem>
                    <SelectItem value="OUT">OUT</SelectItem>
                  </SelectContent>
                </Select>
                <div
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${typeBadgeClass(form.adj_type)}`}
                >
                  {form.adj_type === "IN" ? "Stock Added" : "Stock Removed"}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                  placeholder="Enter quantity"
                  data-testid="input-quantity"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Reason</Label>
                <Textarea
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Enter reason"
                  data-testid="input-reason"
                />
              </div>

              <div className="space-y-2">
                <Label>Approved By</Label>
                <Input value={approvedByLabel} readOnly data-testid="input-approved-by" />
              </div>

              <div className="flex items-end justify-end gap-2">
                {selectedMaterial?.id ? (
                  <Link
                    href={`/inventory/rm-ledger?material_type=${encodeURIComponent(form.material_type)}&material_id=${encodeURIComponent(
                      selectedMaterial.id
                    )}`}
                  >
                    <Button variant="outline" type="button" data-testid="button-view-ledger">
                      View Ledger
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} type="button" data-testid="button-cancel-adjustment">
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving} data-testid="button-save-adjustment">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adjustment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Material Name</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-right py-2 px-2">Quantity</th>
                  <th className="text-left py-2 px-2">Reason</th>
                  <th className="text-left py-2 px-2">Approved By</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={6}>
                      No adjustments found.
                    </td>
                  </tr>
                ) : (
                  history.map((row) => {
                    const rawT = String(row.adj_type || "").toUpperCase();
                    const t = (
                      rawT === "ADD"
                        ? "IN"
                        : rawT === "REDUCE"
                          ? "OUT"
                          : String(Number(row.qty_change ?? 0) >= 0 ? "IN" : "OUT").toUpperCase()
                    ) as AdjustmentType;
                    const qty = Math.abs(Number(row.qty_change ?? 0));
                    return (
                      <tr key={row.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2">{String(row.created_at || "").slice(0, 10)}</td>
                        <td className="py-2 px-2">{row.material_name || "-"}</td>
                        <td className="py-2 px-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${typeBadgeClass(t)}`}>
                            {t}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-medium">
                          {t === "IN" ? `+${qty}` : `-${qty}`}
                        </td>
                        <td className="py-2 px-2">{row.reason || ""}</td>
                        <td className="py-2 px-2">{row.approved_by || "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
