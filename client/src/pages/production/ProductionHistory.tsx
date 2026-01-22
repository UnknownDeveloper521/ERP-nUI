import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { productionTabs } from "./ProductionDashboard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

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

type BatchRecord = {
  id: string;
  batch_id: string;
  batch_no: string | null;
  batch_date: string | null;
  shift: string | null;
  machine_id: string | null;
  operator_id: string | null;
  fg_product_id: string | null;
  roll_material_id: string | null;
  packaging_material_id: string | null;
  rm_roll_qty: number | null;
  rm_packaging_qty: number | null;
  status: string | null;
  planned_qty?: number | null;
  actual_qty?: number | null;
  started_at: string | null;
  completed_at: string | null;
  operation: string;
  recorded_at: string;
};

type EntryRow = {
  id: string;
  batch_id: string | null;
  entry_time: string;
  operator_name: string | null;
  produced_qty: number | null;
  status: string | null;
};

export default function ProductionHistory() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatchNo, setSelectedBatchNo] = useState<string | null>(null);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [products, setProducts] = useState<Product[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [rollMaterials, setRollMaterials] = useState<RollMaterial[]>([]);
  const [packagingMaterials, setPackagingMaterials] = useState<PackagingMaterial[]>([]);

  useEffect(() => {
    fetchLookups();
    fetchBatches();
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
        .from("production_batch_records")
        .select(
          "id, batch_id, batch_no, batch_date, shift, machine_id, operator_id, fg_product_id, roll_material_id, packaging_material_id, rm_roll_qty, rm_packaging_qty, status, started_at, completed_at, operation, recorded_at"
        )
        .order("recorded_at", { ascending: false });

      if (error) throw error;

      const rows = ((data as any) || []) as BatchRecord[];
      const latestByBatchId = new Map<string, BatchRecord>();
      for (const r of rows) {
        if (!latestByBatchId.has(r.batch_id)) {
          latestByBatchId.set(r.batch_id, r);
        }
      }

      const latestRows = Array.from(latestByBatchId.values()).filter(
        (r) => String(r.operation || "").toUpperCase() !== "DELETE"
      );

      const batchIds = latestRows.map((r) => r.batch_id).filter(Boolean);
      if (batchIds.length > 0) {
        const { data: live, error: liveErr } = await supabase
          .from("production_batches")
          .select("id, planned_qty, actual_qty")
          .in("id", batchIds);

        if (!liveErr) {
          const byId = new Map<string, { planned_qty: number | null; actual_qty: number | null }>();
          for (const r of (live as any) || []) {
            byId.set(r.id, { planned_qty: r.planned_qty ?? null, actual_qty: r.actual_qty ?? null });
          }
          for (const r of latestRows) {
            const x = byId.get(r.batch_id);
            if (x) {
              r.planned_qty = x.planned_qty;
              r.actual_qty = x.actual_qty;
            }
          }
        }
      }

      setBatches(latestRows);
    } catch (e: any) {
      toast({ title: "Error loading production history", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredBatches = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const rows = batches.filter((b) => {
      if (!q) return true;
      const productName = products.find((p) => p.id === b.fg_product_id)?.name || "";
      const productCode = products.find((p) => p.id === b.fg_product_id)?.product_code || "";
      const machineName = machines.find((m) => m.id === b.machine_id)?.name || "";
      const rollName = rollMaterials.find((m) => m.id === b.roll_material_id)?.name || "";
      const packName = packagingMaterials.find((m) => m.id === b.packaging_material_id)?.name || "";
      const fields = [
        b.batch_no ?? "",
        b.status ?? "",
        b.shift ?? "",
        productName,
        productCode,
        machineName,
        rollName,
        packName,
      ];
      return fields.some((f) => f.toLowerCase().includes(q));
    });

    rows.sort((a, b) => {
      const da = (a.started_at ?? a.recorded_at ?? "") as string;
      const db = (b.started_at ?? b.recorded_at ?? "") as string;
      return sortOrder === "asc" ? da.localeCompare(db) : db.localeCompare(da);
    });

    return rows;
  }, [batches, machines, packagingMaterials, products, rollMaterials, searchTerm, sortOrder]);

  const fetchEntriesForBatch = async (batchId: string, batchNo: string) => {
    setSelectedBatchId(batchId);
    setSelectedBatchNo(batchNo);
    setEntries([]);
    setEntriesLoading(true);
    try {
      const fromRecords = await supabase
        .from("production_entry_records")
        .select("id, batch_id, entry_time, operator_name, produced_qty, status")
        .eq("batch_id", batchId)
        .order("entry_time", { ascending: false });

      if (!fromRecords.error) {
        setEntries((fromRecords.data as any) || []);
        return;
      }

      const { data, error } = await supabase
        .from("production_entries")
        .select("id, batch_id, entry_time, operator_name, produced_qty, status")
        .eq("batch_id", batchId)
        .order("entry_time", { ascending: false });

      if (error) throw error;
      setEntries((data as any) || []);
    } catch (e: any) {
      toast({ title: "Error loading batch entries", description: e.message, variant: "destructive" });
    } finally {
      setEntriesLoading(false);
    }
  };

  const formatDateTime = (s: string | null) => {
    if (!s) return "-";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString();
  };

  const formatQty = (n: number | null) => {
    if (n === null || n === undefined) return "-";
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 });
  };

  const varianceLabel = (planned: number | null, actual: number | null) => {
    if (!planned || planned === 0 || actual === null || actual === undefined) return "-";
    const pct = ((actual - planned) / planned) * 100;
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  };

  const productNameById = (id: string | null) => {
    if (!id) return "-";
    return products.find((p) => p.id === id)?.name ?? "-";
  };

  const machineNameById = (id: string | null) => {
    if (!id) return "-";
    return machines.find((m) => m.id === id)?.name ?? "-";
  };

  const rollNameById = (id: string | null) => {
    if (!id) return "-";
    return rollMaterials.find((m) => m.id === id)?.name ?? "-";
  };

  const packagingNameById = (id: string | null) => {
    if (!id) return "-";
    return packagingMaterials.find((m) => m.id === id)?.name ?? "-";
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Production</h1>
      <ModuleTabs tabs={productionTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Production History</h2>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search history..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-history"
          />
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Production Records</CardTitle>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
            >
              Sort: {sortOrder === "asc" ? "Oldest" : "Newest"}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Start</th>
                  <th className="text-left py-2 px-2">Batch</th>
                  <th className="text-left py-2 px-2">Product</th>
                  <th className="text-left py-2 px-2">Machine</th>
                  <th className="text-left py-2 px-2">Shift</th>
                  <th className="text-left py-2 px-2">Roll RM</th>
                  <th className="text-right py-2 px-2">Roll Qty</th>
                  <th className="text-left py-2 px-2">Packaging RM</th>
                  <th className="text-right py-2 px-2">Pack Qty</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Planned</th>
                  <th className="text-right py-2 px-2">Actual</th>
                  <th className="text-right py-2 px-2">Variance</th>
                  <th className="text-left py-2 px-2">Completed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="py-6 px-2 text-muted-foreground" colSpan={14}>
                      Loading...
                    </td>
                  </tr>
                ) : filteredBatches.length === 0 ? (
                  <tr>
                    <td className="py-6 px-2 text-muted-foreground" colSpan={14}>
                      No production records found.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => {
                    const variance = varianceLabel(b.planned_qty, b.actual_qty);
                    const varianceIsPositive = typeof variance === "string" && variance.startsWith("+");
                    const varianceIsNegative = typeof variance === "string" && variance.startsWith("-");
                    return (
                      <tr
                        key={b.batch_id}
                        className={`border-b hover:bg-muted/50 cursor-pointer ${
                          selectedBatchId === b.batch_id ? "bg-muted/50" : ""
                        }`}
                        onClick={() => fetchEntriesForBatch(b.batch_id, b.batch_no ?? "-")}
                        title="Click to view entries"
                      >
                        <td className="py-2 px-2 whitespace-nowrap">{formatDateTime(b.started_at ?? b.recorded_at)}</td>
                        <td className="py-2 px-2 font-mono whitespace-nowrap">{b.batch_no ?? "-"}</td>
                        <td className="py-2 px-2">{productNameById(b.fg_product_id)}</td>
                        <td className="py-2 px-2">{machineNameById(b.machine_id)}</td>
                        <td className="py-2 px-2">{b.shift ?? "-"}</td>
                        <td className="py-2 px-2">{rollNameById(b.roll_material_id)}</td>
                        <td className="py-2 px-2 text-right">{formatQty(b.rm_roll_qty)}</td>
                        <td className="py-2 px-2">{packagingNameById(b.packaging_material_id)}</td>
                        <td className="py-2 px-2 text-right">{formatQty(b.rm_packaging_qty)}</td>
                        <td className="py-2 px-2">{b.status ?? "-"}</td>
                        <td className="py-2 px-2 text-right">{formatQty(b.planned_qty)}</td>
                        <td className="py-2 px-2 text-right">{formatQty(b.actual_qty)}</td>
                        <td
                          className={`py-2 px-2 text-right font-medium ${
                            varianceIsPositive ? "text-green-600" : varianceIsNegative ? "text-red-600" : ""
                          }`}
                        >
                          {variance}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">{formatDateTime(b.completed_at)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Batch Entries</CardTitle>
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground">
                {selectedBatchNo ? `Batch: ${selectedBatchNo}` : "Select a batch above"}
              </div>
              {selectedBatchId && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSelectedBatchId(null);
                    setSelectedBatchNo(null);
                    setEntries([]);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Time</th>
                  <th className="text-left py-2 px-2">Operator</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Produced Qty</th>
                </tr>
              </thead>
              <tbody>
                {!selectedBatchId ? (
                  <tr>
                    <td className="py-6 px-2 text-muted-foreground" colSpan={4}>
                      Click a batch row to see its entries.
                    </td>
                  </tr>
                ) : entriesLoading ? (
                  <tr>
                    <td className="py-6 px-2 text-muted-foreground" colSpan={4}>
                      Loading entries...
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td className="py-6 px-2 text-muted-foreground" colSpan={4}>
                      No entries for this batch.
                    </td>
                  </tr>
                ) : (
                  entries.map((e) => (
                    <tr key={e.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 whitespace-nowrap">{formatDateTime(e.entry_time)}</td>
                      <td className="py-2 px-2">{e.operator_name ?? "-"}</td>
                      <td className="py-2 px-2">{e.status ?? "-"}</td>
                      <td className="py-2 px-2 text-right">{formatQty(e.produced_qty)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
