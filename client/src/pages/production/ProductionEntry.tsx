import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { productionTabs } from "./ProductionDashboard";
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
import { ArrowUpDown, Loader2, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/store";

type Product = {
  id: string;
  product_code: string;
  name: string;
};

type Machine = {
  id: string;
  name: string;
};

type RollMaterial = {
  id: string;
  name: string;
};

type PackagingMaterial = {
  id: string;
  name: string;
};

type Batch = {
  id: string;
  batch_no: string;
  product_id: string | null;
  machine_id: string | null;
  batch_date?: string | null;
  shift: string | null;
  planned_qty: number | null;
  actual_qty: number | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  operator_id?: string | null;
  roll_material_id?: string | null;
  packaging_material_id?: string | null;
  rm_roll_qty?: number | null;
  rm_packaging_qty?: number | null;
  products_master?: Product;
  machine_master?: Machine;
  raw_material_roll_master?: RollMaterial;
  packaging_material_master?: PackagingMaterial;
};

type Entry = {
  id: string;
  batch_id: string | null;
  entry_time: string;
  operator_name: string | null;
  produced_qty: number | null;
  status: string | null;
  production_batches?: Batch;
};

const NONE_SELECT = "__none__";

const isUuid = (v: unknown) => {
  if (!v || typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
};

export default function ProductionEntry() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [rollMaterials, setRollMaterials] = useState<RollMaterial[]>([]);
  const [packagingMaterials, setPackagingMaterials] = useState<PackagingMaterial[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);

  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  const [deleteBatchDialogOpen, setDeleteBatchDialogOpen] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);
  const [deleteEntryDialogOpen, setDeleteEntryDialogOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null);

  const [batchForm, setBatchForm] = useState({
    batch_no: "",
    product_id: "",
    machine_id: "",
    batch_date: new Date().toISOString().slice(0, 10),
    shift: "",
    planned_qty: "",
    roll_material_id: "",
    packaging_material_id: "",
    rm_roll_qty: "",
    rm_packaging_qty: "",
  });

  const [entryForm, setEntryForm] = useState({
    batch_id: "",
    operator_name: "",
    produced_qty: "",
    status: "In Progress",
  });

  useEffect(() => {
    fetchLookups();
    fetchBatches();
    fetchEntries();
  }, []);

  const fetchLookups = async () => {
    try {
      const [p, m, r, pk] = await Promise.all([
        supabase.from("products_master").select("id, product_code, name").order("name"),
        supabase.from("machine_master").select("id, name").order("name"),
        supabase.from("raw_material_roll_master").select("id, name").order("name"),
        supabase.from("packaging_material_master").select("id, name").order("name"),
      ]);
      if (p.error) throw p.error;
      if (m.error) throw m.error;
      if (r.error) throw r.error;
      if (pk.error) throw pk.error;
      setProducts((p.data as any) || []);
      setMachines((m.data as any) || []);
      setRollMaterials((r.data as any) || []);
      setPackagingMaterials((pk.data as any) || []);
    } catch (e: any) {
      toast({ title: "Error loading master data", description: e.message, variant: "destructive" });
    }
  };

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("production_batches")
        .select(
          `
          *,
          products_master ( id, product_code, name ),
          machine_master ( id, name ),
          raw_material_roll_master ( id, name ),
          packaging_material_master ( id, name )
        `
        )
        .order("started_at", { ascending: false, nullsFirst: false })
        .order("batch_no", { ascending: false });

      if (error) throw error;
      setBatches((data as any) || []);
    } catch (e: any) {
      toast({ title: "Error loading batches", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("production_entries")
        .select(
          `
          *,
          production_batches (
            id,
            batch_no,
            product_id,
            machine_id,
            status,
            products_master ( id, product_code, name ),
            machine_master ( id, name )
          )
        `
        )
        .order("entry_time", { ascending: false });

      if (error) throw error;
      setEntries((data as any) || []);
    } catch (e: any) {
      toast({ title: "Error loading entries", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateBatchNo = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `BATCH-${year}${month}${day}-${random}`;
  };

  const openNewBatch = () => {
    setEditingBatch(null);
    setBatchForm({
      batch_no: generateBatchNo(),
      product_id: "",
      machine_id: "",
      batch_date: new Date().toISOString().slice(0, 10),
      shift: "",
      planned_qty: "",
      roll_material_id: "",
      packaging_material_id: "",
      rm_roll_qty: "",
      rm_packaging_qty: "",
    });
    setBatchDialogOpen(true);
  };

  const openEditBatch = (b: Batch) => {
    setEditingBatch(b);
    setBatchForm({
      batch_no: b.batch_no || "",
      product_id: b.product_id || "",
      machine_id: b.machine_id || "",
      batch_date: (b.batch_date ? String(b.batch_date).slice(0, 10) : new Date().toISOString().slice(0, 10)) as any,
      shift: b.shift || "",
      planned_qty: b.planned_qty === null || b.planned_qty === undefined ? "" : String(b.planned_qty),
      roll_material_id: b.roll_material_id || "",
      packaging_material_id: b.packaging_material_id || "",
      rm_roll_qty: b.rm_roll_qty === null || b.rm_roll_qty === undefined ? "" : String(b.rm_roll_qty),
      rm_packaging_qty:
        b.rm_packaging_qty === null || b.rm_packaging_qty === undefined ? "" : String(b.rm_packaging_qty),
    });
    setBatchDialogOpen(true);
  };

  const openNewEntry = () => {
    setEditingEntry(null);
    setEntryForm({ batch_id: "", operator_name: "", produced_qty: "", status: "In Progress" });
    setEntryDialogOpen(true);
  };

  const openEditEntry = (e: Entry) => {
    setEditingEntry(e);
    setEntryForm({
      batch_id: e.batch_id || "",
      operator_name: e.operator_name || "",
      produced_qty: e.produced_qty === null || e.produced_qty === undefined ? "" : String(e.produced_qty),
      status: e.status || "In Progress",
    });
    setEntryDialogOpen(true);
  };

  const saveBatch = async () => {
    if (!batchForm.batch_no.trim()) {
      toast({ title: "Batch number is required", variant: "destructive" });
      return;
    }
    if (!batchForm.product_id) {
      toast({ title: "Product is required", variant: "destructive" });
      return;
    }
    if (!batchForm.machine_id) {
      toast({ title: "Machine is required", variant: "destructive" });
      return;
    }

    if (!isUuid(batchForm.product_id)) {
      toast({
        title: "Invalid Product ID",
        description:
          "products_master.id must be a UUID. Your selected product id looks like a non-UUID value (e.g. '1').",
        variant: "destructive",
      });
      return;
    }
    if (!isUuid(batchForm.machine_id)) {
      toast({
        title: "Invalid Machine ID",
        description:
          "machine_master.id must be a UUID. Your selected machine id looks like a non-UUID value (e.g. '1').",
        variant: "destructive",
      });
      return;
    }

    const operatorId = (editingBatch?.operator_id || user?.supabaseId || null) as any;
    if (operatorId && !isUuid(String(operatorId))) {
      toast({
        title: "Invalid Operator ID",
        description:
          "operator_id must be a Supabase user UUID. Your current session user has a non-UUID id; make sure you are logged in via Supabase auth.",
        variant: "destructive",
      });
      return;
    }

    const rmRollQty = batchForm.rm_roll_qty.trim() ? Number(batchForm.rm_roll_qty) : 0;
    const rmPackQty = batchForm.rm_packaging_qty.trim() ? Number(batchForm.rm_packaging_qty) : 0;
    if (Number.isNaN(rmRollQty) || rmRollQty < 0) {
      toast({ title: "RM Roll qty must be 0 or greater", variant: "destructive" });
      return;
    }
    if (Number.isNaN(rmPackQty) || rmPackQty < 0) {
      toast({ title: "RM Packaging qty must be 0 or greater", variant: "destructive" });
      return;
    }
    if (!batchForm.roll_material_id && !batchForm.packaging_material_id) {
      toast({ title: "Select at least one raw material (Roll or Packaging)", variant: "destructive" });
      return;
    }

    if (batchForm.roll_material_id && !isUuid(batchForm.roll_material_id)) {
      toast({
        title: "Invalid Roll Material ID",
        description:
          "raw_material_roll_master.id must be a UUID. Your selected roll material id looks like a non-UUID value (e.g. '1').",
        variant: "destructive",
      });
      return;
    }

    if (batchForm.packaging_material_id && !isUuid(batchForm.packaging_material_id)) {
      toast({
        title: "Invalid Packaging Material ID",
        description:
          "packaging_material_master.id must be a UUID. Your selected packaging material id looks like a non-UUID value (e.g. '1').",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        batch_no: batchForm.batch_no.trim(),
        product_id: batchForm.product_id,
        machine_id: batchForm.machine_id,
        batch_date: batchForm.batch_date || null,
        shift: batchForm.shift.trim() || null,
        planned_qty: batchForm.planned_qty.trim() ? Number(batchForm.planned_qty) : null,
        operator_id: operatorId,
        roll_material_id: batchForm.roll_material_id || null,
        packaging_material_id: batchForm.packaging_material_id || null,
        rm_roll_qty: rmRollQty,
        rm_packaging_qty: rmPackQty,
        updated_at: new Date().toISOString(),
      };

      if (editingBatch) {
        if ((editingBatch.status || "").toLowerCase() === "completed") {
          toast({ title: "Completed batch cannot be edited", variant: "destructive" });
          return;
        }
        const { error } = await supabase.from("production_batches").update(payload).eq("id", editingBatch.id);
        if (error) throw error;
        toast({ title: "Batch updated" });
      } else {
        const createPayload = {
          ...payload,
          status: "Running",
          started_at: new Date().toISOString(),
        };
        const { error } = await supabase.from("production_batches").insert([createPayload]);
        if (error) throw error;
        toast({ title: "Batch created" });
      }

      setBatchDialogOpen(false);
      setEditingBatch(null);
      await fetchBatches();
    } catch (e: any) {
      toast({ title: "Error saving batch", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveEntry = async () => {
    if (!entryForm.batch_id) {
      toast({ title: "Batch is required", variant: "destructive" });
      return;
    }
    const qty = Number(entryForm.produced_qty);
    if (!entryForm.produced_qty.trim() || Number.isNaN(qty) || qty < 0) {
      toast({ title: "Produced qty must be 0 or greater", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        batch_id: entryForm.batch_id,
        operator_name: entryForm.operator_name.trim() || null,
        produced_qty: qty,
        status: entryForm.status || null,
      };

      if (editingEntry) {
        if ((editingEntry.status || "").toLowerCase().includes("complete")) {
          toast({ title: "Completed entry cannot be edited", variant: "destructive" });
          return;
        }
        const { error } = await supabase.from("production_entries").update(payload).eq("id", editingEntry.id);
        if (error) throw error;
        toast({ title: "Entry updated" });
      } else {
        const { error } = await supabase.from("production_entries").insert([payload]);
        if (error) throw error;
        toast({ title: "Entry created" });
      }

      setEntryDialogOpen(false);
      setEditingEntry(null);
      await fetchEntries();
    } catch (e: any) {
      toast({ title: "Error saving entry", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteBatch = async () => {
    if (!deletingBatch) return;
    if ((deletingBatch.status || "").toLowerCase() === "completed") {
      toast({ title: "Completed batch cannot be deleted", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error: delEntriesErr } = await supabase
        .from("production_entries")
        .delete()
        .eq("batch_id", deletingBatch.id);
      if (delEntriesErr) throw delEntriesErr;

      const { error } = await supabase.from("production_batches").delete().eq("id", deletingBatch.id);
      if (error) throw error;

      toast({ title: "Batch deleted" });
      setDeleteBatchDialogOpen(false);
      setDeletingBatch(null);
      await Promise.all([fetchBatches(), fetchEntries()]);
    } catch (e: any) {
      toast({ title: "Error deleting batch", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteEntry = async () => {
    if (!deletingEntry) return;
    if ((deletingEntry.status || "").toLowerCase().includes("complete")) {
      toast({ title: "Completed entry cannot be deleted", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("production_entries").delete().eq("id", deletingEntry.id);
      if (error) throw error;

      toast({ title: "Entry deleted" });
      setDeleteEntryDialogOpen(false);
      setDeletingEntry(null);
      await fetchEntries();
    } catch (e: any) {
      toast({ title: "Error deleting entry", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const completeBatch = async (batch: Batch) => {
    setSaving(true);
    try {
      const actualQty = batch.actual_qty ?? batch.planned_qty ?? 0;
      const { error } = await supabase
        .from("production_batches")
        .update({ status: "Completed", actual_qty: actualQty, completed_at: new Date().toISOString() })
        .eq("id", batch.id);
      if (error) throw error;
      toast({ title: "Batch completed", description: "FG stock should be created automatically by trigger." });
      await fetchBatches();
    } catch (e: any) {
      toast({ title: "Error completing batch", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const visibleEntries = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return entries
      .filter((e) => {
        const b = e.production_batches;
        return (
          (b?.batch_no || "").toLowerCase().includes(s) ||
          (b?.products_master?.name || "").toLowerCase().includes(s) ||
          (b?.machine_master?.name || "").toLowerCase().includes(s) ||
          (e.operator_name || "").toLowerCase().includes(s)
        );
      })
      .sort((a, b) => {
        const da = new Date(a.entry_time).getTime();
        const db = new Date(b.entry_time).getTime();
        return sortOrder === "desc" ? db - da : da - db;
      });
  }, [entries, searchTerm, sortOrder]);

  const statusBadge = (status: string | null | undefined) => {
    const s = (status || "").toLowerCase();
    if (s.includes("complete")) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (s.includes("running")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    return "bg-muted text-foreground";
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Production</h1>
      <ModuleTabs tabs={productionTabs} />

      <div className="flex flex-wrap justify-between items-center gap-4 mt-4">
        <h2 className="text-lg font-medium">Production Entry</h2>
        <div className="flex items-center gap-2">
          <Button onClick={openNewBatch} variant="outline" data-testid="button-new-batch">
            <Plus className="h-4 w-4 mr-2" />
            New Batch
          </Button>
          <Button onClick={openNewEntry} data-testid="button-new-entry">
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-base">Recent Production Entries</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[220px]"
                  data-testid="input-search"
                />
              </div>
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
          ) : visibleEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No entries match your search" : "No production entries found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Entry Time</th>
                    <th className="text-left py-2 px-2">Batch</th>
                    <th className="text-left py-2 px-2">Product</th>
                    <th className="text-left py-2 px-2">Machine</th>
                    <th className="text-right py-2 px-2">Produced Qty</th>
                    <th className="text-left py-2 px-2">Operator</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-center py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((e) => (
                    <tr key={e.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2">{new Date(e.entry_time).toLocaleString()}</td>
                      <td className="py-2 px-2 font-mono text-primary">
                        {e.production_batches?.batch_no || "-"}
                      </td>
                      <td className="py-2 px-2">{e.production_batches?.products_master?.name || "-"}</td>
                      <td className="py-2 px-2">{e.production_batches?.machine_master?.name || "-"}</td>
                      <td className="py-2 px-2 text-right">{e.produced_qty ?? 0}</td>
                      <td className="py-2 px-2">{e.operator_name || "-"}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusBadge(e.status)}`}>
                          {e.status || "-"}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditEntry(e)}
                            disabled={saving || (e.status || "").toLowerCase().includes("complete")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingEntry(e);
                              setDeleteEntryDialogOpen(true);
                            }}
                            disabled={saving || (e.status || "").toLowerCase().includes("complete")}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">No batches found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Batch No</th>
                    <th className="text-left py-2 px-2">Product</th>
                    <th className="text-left py-2 px-2">Machine</th>
                    <th className="text-left py-2 px-2">Shift</th>
                    <th className="text-left py-2 px-2">Roll RM</th>
                    <th className="text-right py-2 px-2">Roll Qty</th>
                    <th className="text-left py-2 px-2">Packaging RM</th>
                    <th className="text-right py-2 px-2">Pack Qty</th>
                    <th className="text-right py-2 px-2">Planned</th>
                    <th className="text-right py-2 px-2">Actual</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-center py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 whitespace-nowrap">
                        {b.batch_date ? String(b.batch_date).slice(0, 10) : "-"}
                      </td>
                      <td className="py-2 px-2 font-mono text-primary">{b.batch_no}</td>
                      <td className="py-2 px-2">{b.products_master?.name || "-"}</td>
                      <td className="py-2 px-2">{b.machine_master?.name || "-"}</td>
                      <td className="py-2 px-2">{b.shift || "-"}</td>
                      <td className="py-2 px-2">{b.raw_material_roll_master?.name || "-"}</td>
                      <td className="py-2 px-2 text-right">{b.rm_roll_qty ?? 0}</td>
                      <td className="py-2 px-2">{b.packaging_material_master?.name || "-"}</td>
                      <td className="py-2 px-2 text-right">{b.rm_packaging_qty ?? 0}</td>
                      <td className="py-2 px-2 text-right">{b.planned_qty ?? 0}</td>
                      <td className="py-2 px-2 text-right">{b.actual_qty ?? 0}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusBadge(b.status)}`}>
                          {b.status || "-"}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditBatch(b)}
                            disabled={saving || (b.status || "").toLowerCase() === "completed"}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingBatch(b);
                              setDeleteBatchDialogOpen(true);
                            }}
                            disabled={saving || (b.status || "").toLowerCase() === "completed"}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={saving || (b.status || "").toLowerCase() === "completed"}
                            onClick={() => completeBatch(b)}
                            data-testid={`button-complete-${b.id}`}
                          >
                            Complete
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

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingBatch ? "Edit Production Batch" : "New Production Batch"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch_no">Batch No *</Label>
              <Input
                id="batch_no"
                value={batchForm.batch_no}
                onChange={(e) => setBatchForm((p) => ({ ...p, batch_no: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="batch_date">Batch Date</Label>
                <Input
                  id="batch_date"
                  type="date"
                  value={batchForm.batch_date}
                  onChange={(e) => setBatchForm((p) => ({ ...p, batch_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Operator (Auto)</Label>
                <Input
                  value={
                    ((user?.email || "") + (user?.supabaseId ? ` (${user.supabaseId})` : "") || "-") as any
                  }
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product *</Label>
                <Select
                  value={batchForm.product_id}
                  onValueChange={(v) => setBatchForm((p) => ({ ...p, product_id: v }))}
                >
                  <SelectTrigger data-testid="select-product">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.product_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Machine *</Label>
                <Select
                  value={batchForm.machine_id}
                  onValueChange={(v) => setBatchForm((p) => ({ ...p, machine_id: v }))}
                >
                  <SelectTrigger data-testid="select-machine">
                    <SelectValue placeholder="Select machine" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shift">Shift</Label>
                <Input
                  id="shift"
                  value={batchForm.shift}
                  onChange={(e) => setBatchForm((p) => ({ ...p, shift: e.target.value }))}
                  placeholder="A / B / C"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planned_qty">Planned Qty</Label>
                <Input
                  id="planned_qty"
                  type="number"
                  value={batchForm.planned_qty}
                  onChange={(e) => setBatchForm((p) => ({ ...p, planned_qty: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Roll Material</Label>
                <Select
                  value={batchForm.roll_material_id || NONE_SELECT}
                  onValueChange={(v) =>
                    setBatchForm((p) => ({ ...p, roll_material_id: v === NONE_SELECT ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select roll material" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_SELECT}>None</SelectItem>
                    {rollMaterials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rm_roll_qty">RM Roll Qty</Label>
                <Input
                  id="rm_roll_qty"
                  type="number"
                  value={batchForm.rm_roll_qty}
                  onChange={(e) => setBatchForm((p) => ({ ...p, rm_roll_qty: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Packaging Material</Label>
                <Select
                  value={batchForm.packaging_material_id || NONE_SELECT}
                  onValueChange={(v) =>
                    setBatchForm((p) => ({ ...p, packaging_material_id: v === NONE_SELECT ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select packaging material" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_SELECT}>None</SelectItem>
                    {packagingMaterials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rm_packaging_qty">RM Packaging Qty</Label>
                <Input
                  id="rm_packaging_qty"
                  type="number"
                  value={batchForm.rm_packaging_qty}
                  onChange={(e) => setBatchForm((p) => ({ ...p, rm_packaging_qty: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveBatch} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingBatch ? "Update Batch" : "Create Batch"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Production Entry" : "New Production Entry"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Batch *</Label>
              <Select
                value={entryForm.batch_id}
                onValueChange={(v) => setEntryForm((p) => ({ ...p, batch_id: v }))}
              >
                <SelectTrigger data-testid="select-batch">
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_SELECT} disabled>
                    Select...
                  </SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batch_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="operator_name">Operator Name</Label>
                <Input
                  id="operator_name"
                  value={entryForm.operator_name}
                  onChange={(e) => setEntryForm((p) => ({ ...p, operator_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="produced_qty">Produced Qty</Label>
                <Input
                  id="produced_qty"
                  type="number"
                  value={entryForm.produced_qty}
                  onChange={(e) => setEntryForm((p) => ({ ...p, produced_qty: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={entryForm.status}
                onValueChange={(v) => setEntryForm((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger data-testid="select-entry-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveEntry} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingEntry ? "Update Entry" : "Create Entry"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteBatchDialogOpen} onOpenChange={setDeleteBatchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the production batch and its entries (only allowed if not completed).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBatch} disabled={saving}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteEntryDialogOpen} onOpenChange={setDeleteEntryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the production entry (only allowed if not completed).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEntry} disabled={saving}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
