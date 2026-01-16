import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { inventoryTabs } from "./InventoryDashboard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Loader2, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type MaterialType = "ROLL" | "PACKAGING";

type RollMaterial = {
  id: string;
  name: string;
};

type PackagingMaterial = {
  id: string;
  name: string;
};

type LedgerRow = {
  id: string;
  material_type: MaterialType | null;
  roll_material_id: string | null;
  packaging_material_id: string | null;
  txn_type: string | null;
  reference_id: string | null;
  qty_in: number | null;
  qty_out: number | null;
  balance_after: number | null;
  txn_date: string;
};

export default function RMLedger() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [rollMaterials, setRollMaterials] = useState<RollMaterial[]>([]);
  const [packagingMaterials, setPackagingMaterials] = useState<PackagingMaterial[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [materialFilter, setMaterialFilter] = useState<string>(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const mt = (qs.get("material_type") || "").toUpperCase();
      const mid = qs.get("material_id") || "";
      if ((mt === "ROLL" || mt === "PACKAGING") && mid) return `${mt}:${mid}`;
    } catch {
      // ignore
    }
    return "all";
  });
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchRollMaterials();
    fetchPackagingMaterials();
    fetchLedger();
  }, []);

  const fetchRollMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("raw_material_roll_master")
        .select("id, name")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRollMaterials((data as any) || []);
    } catch (error: any) {
      toast({ title: "Error loading roll materials", description: error.message, variant: "destructive" });
    }
  };

  const fetchPackagingMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("packaging_material_master")
        .select("id, name")
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

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("raw_material_ledger")
        .select(`*`)
        .order("txn_date", { ascending: false });

      if (error) throw error;
      setRows((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading ledger",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    const s = searchTerm.toLowerCase();

    const rollNameById = new Map(rollMaterials.map((m) => [m.id, m.name] as const));
    const packNameById = new Map(packagingMaterials.map((m) => [m.id, m.name] as const));

    return rows
      .filter((r) => {
        const materialName =
          r.material_type === "PACKAGING"
            ? packNameById.get(r.packaging_material_id || "") || ""
            : rollNameById.get(r.roll_material_id || "") || "";

        const matchesSearch =
          (r.txn_type || "").toLowerCase().includes(s) ||
          (r.reference_id || "").toLowerCase().includes(s) ||
          materialName.toLowerCase().includes(s);

        const filterKey =
          r.material_type === "PACKAGING"
            ? `PACKAGING:${r.packaging_material_id || ""}`
            : `ROLL:${r.roll_material_id || ""}`;

        const matchesMaterial = materialFilter === "all" || filterKey === materialFilter;

        return matchesSearch && matchesMaterial;
      })
      .sort((a, b) => {
        const da = new Date(a.txn_date).getTime();
        const db = new Date(b.txn_date).getTime();
        return sortOrder === "desc" ? db - da : da - db;
      });
  }, [rows, searchTerm, materialFilter, sortOrder, rollMaterials, packagingMaterials]);

  const materialNameForRow = (r: LedgerRow) => {
    if (r.material_type === "PACKAGING") {
      const m = packagingMaterials.find((x) => x.id === r.packaging_material_id);
      return m?.name || "Unknown";
    }
    const m = rollMaterials.find((x) => x.id === r.roll_material_id);
    return m?.name || "Unknown";
  };

  const typeBadgeClass = (t: string | null | undefined) => {
    const type = (t || "").toUpperCase();
    if (type === "RECEIPT") {
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    }
    if (type === "ISSUE") {
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    }
    if (type === "ADJUSTMENT") {
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    }
    return "bg-muted text-foreground";
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">
        Inventory
      </h1>
      <ModuleTabs tabs={inventoryTabs} />

      <div className="flex flex-wrap justify-between items-center gap-4 mt-4">
        <h2 className="text-lg font-medium">RM Ledger</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ledger..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-[220px]"
              data-testid="input-search-ledger"
            />
          </div>
          <Select value={materialFilter} onValueChange={setMaterialFilter}>
            <SelectTrigger className="w-[220px]" data-testid="select-material-filter">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Material Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || materialFilter !== "all"
                ? "No ledger entries match your filters"
                : "No ledger entries found yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Reference</th>
                    <th className="text-left py-2 px-2">Material</th>
                    <th className="text-left py-2 px-2">Material Type</th>
                    <th className="text-left py-2 px-2">Txn Type</th>
                    <th className="text-right py-2 px-2">In</th>
                    <th className="text-right py-2 px-2">Out</th>
                    <th className="text-right py-2 px-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b hover:bg-muted/50"
                      data-testid={`row-ledger-${r.id}`}
                    >
                      <td className="py-2 px-2">{new Date(r.txn_date).toLocaleString()}</td>
                      <td className="py-2 px-2 font-mono text-primary">
                        {(r.reference_id || "-").slice(0, 8)}
                      </td>
                      <td className="py-2 px-2">
                        {materialNameForRow(r)}
                      </td>
                      <td className="py-2 px-2">
                        {r.material_type || "-"}
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${typeBadgeClass(
                            r.txn_type
                          )}`}
                        >
                          {(r.txn_type || "-").toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-green-600">
                        {r.qty_in ?? 0}
                      </td>
                      <td className="py-2 px-2 text-right text-red-600">
                        {r.qty_out ?? 0}
                      </td>
                      <td className="py-2 px-2 text-right font-medium">
                        {r.balance_after ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
