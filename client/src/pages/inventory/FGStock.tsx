import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { inventoryTabs } from "./InventoryDashboard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Loader2, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type Product = {
  id: string;
  product_code: string;
  name: string;
  category: string | null;
};

type Machine = {
  id: string;
  name: string;
};

type Warehouse = {
  id: string;
  name: string | null;
  is_main: boolean;
};

type FGRow = {
  id: string;
  product_id: string | null;
  production_batch_no: string | null;
  machine_id: string | null;
  produced_qty: number;
  produced_weight: number | null;
  available_qty: number;
  warehouse_id: string | null;
  unit_cost: number | null;
  total_cost: number | null;
  created_at: string;
  products_master?: Product;
  machine_master?: Machine;
  warehouses_master?: Warehouse;
};

export default function FGStock() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FGRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fg_stock")
        .select(
          `
          *,
          products_master ( id, product_code, name, category ),
          machine_master ( id, name ),
          warehouses_master ( id, name, is_main )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows((data as any) || []);
    } catch (error: any) {
      toast({
        title: "Error loading FG stock",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return rows
      .filter((r) => {
        const p = r.products_master;
        return (
          (p?.name || "").toLowerCase().includes(s) ||
          (p?.product_code || "").toLowerCase().includes(s) ||
          (r.production_batch_no || "").toLowerCase().includes(s) ||
          (r.machine_master?.name || "").toLowerCase().includes(s)
        );
      })
      .sort((a, b) => {
        const da = new Date(a.created_at).getTime();
        const db = new Date(b.created_at).getTime();
        return sortOrder === "desc" ? db - da : da - db;
      });
  }, [rows, searchTerm, sortOrder]);

  const stockStatus = (qty: number) => {
    if (qty <= 0) return "Out";
    if (qty < 10) return "Low";
    return "In Stock";
  };

  const statusClass = (status: string) => {
    if (status === "In Stock") {
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    }
    if (status === "Low") {
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    }
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">
        Inventory
      </h1>
      <ModuleTabs tabs={inventoryTabs} />

      <div className="flex flex-wrap justify-between items-center gap-4 mt-4">
        <h2 className="text-lg font-medium">FG Stock (Finished Goods)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search FG items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              data-testid="input-search-fg"
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finished Goods Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No FG items match your search" : "No FG stock found yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Product Code</th>
                    <th className="text-left py-2 px-2">Product Name</th>
                    <th className="text-left py-2 px-2">Category</th>
                    <th className="text-left py-2 px-2">Batch</th>
                    <th className="text-left py-2 px-2">Machine</th>
                    <th className="text-left py-2 px-2">Warehouse</th>
                    <th className="text-right py-2 px-2">Available Qty</th>
                    <th className="text-right py-2 px-2">Unit Cost</th>
                    <th className="text-right py-2 px-2">Total Cost</th>
                    <th className="text-left py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const status = stockStatus(Number(r.available_qty || 0));
                    return (
                      <tr
                        key={r.id}
                        className="border-b hover:bg-muted/50"
                        data-testid={`row-fg-${r.id}`}
                      >
                        <td className="py-2 px-2 font-mono text-sm">
                          {r.products_master?.product_code || "-"}
                        </td>
                        <td className="py-2 px-2">{r.products_master?.name || "-"}</td>
                        <td className="py-2 px-2">{r.products_master?.category || "-"}</td>
                        <td className="py-2 px-2 font-mono">{r.production_batch_no || "-"}</td>
                        <td className="py-2 px-2">{r.machine_master?.name || "-"}</td>
                        <td className="py-2 px-2">
                          {r.warehouses_master?.name ||
                            (r.warehouse_id
                              ? String(r.warehouse_id).slice(0, 8)
                              : "-")}
                        </td>
                        <td className="py-2 px-2 text-right font-medium">
                          {Number(r.available_qty || 0)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {Number(r.unit_cost || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {Number(r.total_cost || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${statusClass(
                              status
                            )}`}
                          >
                            {status}
                          </span>
                        </td>
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
  );
}
