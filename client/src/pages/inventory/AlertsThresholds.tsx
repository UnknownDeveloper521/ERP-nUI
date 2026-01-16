import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { inventoryTabs } from "./InventoryDashboard";
import { Settings, AlertTriangle, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/store";
import { inventoryThresholdsApi, stockAlertsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type MaterialType = "ROLL" | "PACKAGING";

type ThresholdRow = {
  id: string;
  material_type: MaterialType;
  material_id: string;
  warehouse_location: string;
  min_qty: number | null;
  reorder_level: number | null;
  max_qty: number | null;
  created_at?: string;
};

type AlertRow = {
  threshold_id: string | null;
  material_type: MaterialType;
  material_id: string;
  material_name: string;
  warehouse_location: string;
  available_qty: number;
  min_qty: number;
  reorder_level: number;
  max_qty: number;
  status: "OK" | "REORDER" | "CRITICAL";
};

type MasterRow = { id: string; name: string };
type WarehouseRow = { id: string; name: string | null; is_main?: boolean };

export default function AlertsThresholds() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [thresholds, setThresholds] = useState<ThresholdRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);

  const [rollMasters, setRollMasters] = useState<MasterRow[]>([]);
  const [packMasters, setPackMasters] = useState<MasterRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ThresholdRow | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<ThresholdRow | null>(null);

  const [form, setForm] = useState({
    material_type: "ROLL" as MaterialType,
    material_id: "",
    warehouse_location: "MAIN",
    min_qty: "0",
    reorder_level: "0",
    max_qty: "0",
  });

  const warehousesForSelect = useMemo(() => {
    const names = (warehouses || []).map((w) => (w.name || "").trim()).filter(Boolean);
    const fallback = ["MAIN", "WH1", "WH2"];
    const merged = Array.from(new Set([...names, ...fallback]));
    return merged;
  }, [warehouses]);

  const currentMaterialOptions = useMemo(() => {
    return form.material_type === "PACKAGING" ? packMasters : rollMasters;
  }, [form.material_type, packMasters, rollMasters]);

  const alertCounts = useMemo(() => {
    const critical = alerts.filter((a) => a.status === "CRITICAL").length;
    const reorder = alerts.filter((a) => a.status === "REORDER").length;
    return { critical, reorder, total: critical + reorder };
  }, [alerts]);

  const badgeClass = (status: AlertRow["status"]) => {
    if (status === "CRITICAL") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    if (status === "REORDER") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  };

  const fetchMasters = async () => {
    try {
      const [rollRes, packRes, whRes] = await Promise.all([
        supabase.from("raw_material_roll_master").select("id, name").order("name"),
        supabase.from("packaging_material_master").select("id, name").order("name"),
        supabase.from("warehouses_master").select("id, name, is_main").order("is_main", { ascending: false }),
      ]);

      if (rollRes.error) throw rollRes.error;
      if (packRes.error) throw packRes.error;
      if (whRes.error) throw whRes.error;

      setRollMasters((rollRes.data as any) || []);
      setPackMasters((packRes.data as any) || []);
      setWarehouses((whRes.data as any) || []);
    } catch (e: any) {
      toast({ title: "Error loading master data", description: e.message, variant: "destructive" });
    }
  };

  const fetchThresholds = async () => {
    const data = (await inventoryThresholdsApi.getAll()) as ThresholdRow[];
    setThresholds(data || []);
  };

  const fetchAlerts = async () => {
    const data = (await stockAlertsApi.getAll()) as AlertRow[];
    setAlerts(data || []);
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchMasters(), fetchThresholds(), fetchAlerts()]);
    } catch (e: any) {
      toast({ title: "Error loading alerts", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel("inventory-alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "raw_material_stock" },
        () => {
          fetchAlerts().catch(() => void 0);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_thresholds" },
        () => {
          Promise.all([fetchThresholds(), fetchAlerts()]).catch(() => void 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({
      material_type: "ROLL",
      material_id: "",
      warehouse_location: "MAIN",
      min_qty: "0",
      reorder_level: "0",
      max_qty: "0",
    });
    setDialogOpen(true);
  };

  const openEdit = (t: ThresholdRow) => {
    setEditing(t);
    setForm({
      material_type: t.material_type,
      material_id: t.material_id,
      warehouse_location: t.warehouse_location,
      min_qty: String(t.min_qty ?? 0),
      reorder_level: String(t.reorder_level ?? 0),
      max_qty: String(t.max_qty ?? 0),
    });
    setDialogOpen(true);
  };

  const saveThreshold = async () => {
    if (!form.material_id) {
      toast({ title: "Material is required", variant: "destructive" });
      return;
    }
    if (!form.warehouse_location) {
      toast({ title: "Warehouse is required", variant: "destructive" });
      return;
    }
    const minQty = Number(form.min_qty ?? 0);
    const reorder = Number(form.reorder_level ?? 0);
    const maxQty = Number(form.max_qty ?? 0);
    if ([minQty, reorder, maxQty].some((n) => Number.isNaN(n) || n < 0)) {
      toast({ title: "Qty fields must be 0 or greater", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await inventoryThresholdsApi.upsert({
        material_type: form.material_type,
        material_id: form.material_id,
        warehouse_location: form.warehouse_location,
        min_qty: minQty,
        reorder_level: reorder,
        max_qty: maxQty,
      });
      toast({ title: editing ? "Threshold updated" : "Threshold saved" });
      setDialogOpen(false);
      setEditing(null);
      await Promise.all([fetchThresholds(), fetchAlerts()]);
    } catch (e: any) {
      toast({ title: "Error saving threshold", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (t: ThresholdRow) => {
    setDeleting(t);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await inventoryThresholdsApi.delete(deleting.id);
      toast({ title: "Threshold deleted" });
      setDeleteDialogOpen(false);
      setDeleting(null);
      await Promise.all([fetchThresholds(), fetchAlerts()]);
    } catch (e: any) {
      toast({ title: "Error deleting threshold", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Inventory</h1>
      <ModuleTabs tabs={inventoryTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium">Alert and Thresholds</h2>
          {alertCounts.total > 0 ? (
            <span className="text-sm px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {alertCounts.total}
            </span>
          ) : null}
        </div>
        {isAdmin ? (
          <Button variant="outline" onClick={openNew} data-testid="button-configure-alerts">
            <Settings className="h-4 w-4 mr-2" />
            Configure Alerts
          </Button>
        ) : null}
      </div>
      
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground">No stock alerts.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Material Type</th>
                      <th className="text-left py-2 px-2">Material</th>
                      <th className="text-left py-2 px-2">Warehouse</th>
                      <th className="text-right py-2 px-2">Available</th>
                      <th className="text-right py-2 px-2">Min</th>
                      <th className="text-right py-2 px-2">Reorder</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts
                      .filter((a) => a.status !== "OK")
                      .sort((a, b) => {
                        const order = { CRITICAL: 0, REORDER: 1, OK: 2 } as any;
                        return order[a.status] - order[b.status];
                      })
                      .map((a) => (
                        <tr key={`${a.material_type}-${a.material_id}-${a.warehouse_location}`} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-mono">{a.material_type}</td>
                          <td className="py-2 px-2">{a.material_name}</td>
                          <td className="py-2 px-2">{a.warehouse_location}</td>
                          <td className="py-2 px-2 text-right">{a.available_qty}</td>
                          <td className="py-2 px-2 text-right">{a.min_qty}</td>
                          <td className="py-2 px-2 text-right">{a.reorder_level}</td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${badgeClass(a.status)}`}>{a.status}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Threshold Settings</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : thresholds.length === 0 ? (
              <div className="text-sm text-muted-foreground">No thresholds configured.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Material Type</th>
                      <th className="text-left py-2 px-2">Material</th>
                      <th className="text-left py-2 px-2">Warehouse</th>
                      <th className="text-right py-2 px-2">Min</th>
                      <th className="text-right py-2 px-2">Reorder</th>
                      <th className="text-right py-2 px-2">Max</th>
                      {isAdmin ? <th className="text-center py-2 px-2">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {thresholds.map((t) => {
                      const name =
                        t.material_type === "PACKAGING"
                          ? packMasters.find((m) => m.id === t.material_id)?.name
                          : rollMasters.find((m) => m.id === t.material_id)?.name;
                      return (
                        <tr key={t.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-mono">{t.material_type}</td>
                          <td className="py-2 px-2">{name || t.material_id}</td>
                          <td className="py-2 px-2">{t.warehouse_location}</td>
                          <td className="py-2 px-2 text-right text-red-600">{Number(t.min_qty ?? 0)}</td>
                          <td className="py-2 px-2 text-right text-amber-600">{Number(t.reorder_level ?? 0)}</td>
                          <td className="py-2 px-2 text-right text-green-600">{Number(t.max_qty ?? 0)}</td>
                          {isAdmin ? (
                            <td className="py-2 px-2">
                              <div className="flex items-center justify-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => openEdit(t)} disabled={saving}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => requestDelete(t)}
                                  disabled={saving}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Configure Stock Alert</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Material Type *</Label>
                <Select
                  value={form.material_type}
                  onValueChange={(v) => {
                    const mt = v as MaterialType;
                    setForm((p) => ({ ...p, material_type: mt, material_id: "" }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select material type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ROLL">ROLL</SelectItem>
                    <SelectItem value="PACKAGING">PACKAGING</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Material *</Label>
                <Select value={form.material_id} onValueChange={(v) => setForm((p) => ({ ...p, material_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentMaterialOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Warehouse *</Label>
                <Select
                  value={form.warehouse_location}
                  onValueChange={(v) => setForm((p) => ({ ...p, warehouse_location: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehousesForSelect.map((w) => (
                      <SelectItem key={w} value={w}>
                        {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Min Qty</Label>
                <Input value={form.min_qty} onChange={(e) => setForm((p) => ({ ...p, min_qty: e.target.value }))} type="number" />
              </div>
              <div className="space-y-2">
                <Label>Reorder Level</Label>
                <Input
                  value={form.reorder_level}
                  onChange={(e) => setForm((p) => ({ ...p, reorder_level: e.target.value }))}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Qty</Label>
                <Input value={form.max_qty} onChange={(e) => setForm((p) => ({ ...p, max_qty: e.target.value }))} type="number" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveThreshold} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editing ? (
                "Update"
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete threshold?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the stock alert threshold.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={saving}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
