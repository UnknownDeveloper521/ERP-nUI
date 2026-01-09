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

type RawMaterial = {
  id: string;
  material_code: string;
  name: string;
  uom: string;
};

type LedgerRow = {
  id: string;
  material_id: string | null;
  txn_type: string | null;
  reference_id: string | null;
  qty_in: number | null;
  qty_out: number | null;
  balance_after: number | null;
  txn_date: string;
  raw_material_master?: RawMaterial;
};

export default function RMLedger() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [materialFilter, setMaterialFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchMaterials();
    fetchLedger();
  }, []);

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("raw_material_master")
        .select("id, material_code, name, uom")
        .order("name");

      if (error) throw error;
      setMaterials((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading materials",
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
        .select(
          `
          *,
          raw_material_master ( id, material_code, name, uom )
        `
        )
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
    return rows
      .filter((r) => {
        const matchesSearch =
          (r.txn_type || "").toLowerCase().includes(s) ||
          (r.reference_id || "").toLowerCase().includes(s) ||
          (r.raw_material_master?.name || "").toLowerCase().includes(s) ||
          (r.raw_material_master?.material_code || "").toLowerCase().includes(s);

        const matchesMaterial =
          materialFilter === "all" || r.material_id === materialFilter;

        return matchesSearch && matchesMaterial;
      })
      .sort((a, b) => {
        const da = new Date(a.txn_date).getTime();
        const db = new Date(b.txn_date).getTime();
        return sortOrder === "desc" ? db - da : da - db;
      });
  }, [rows, searchTerm, materialFilter, sortOrder]);

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
              {materials.map((m) => (
                <SelectItem key={m.id} value={m.id}>
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
                    <th className="text-left py-2 px-2">Type</th>
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
                        {r.raw_material_master?.name || "Unknown"}
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
