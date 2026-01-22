import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { Package, AlertTriangle, TrendingUp, TrendingDown, Layers, ShoppingBag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const inventoryTabs = [
  { name: "Dashboard", path: "/inventory" },
  { name: "Raw Material Receipt", path: "/inventory/rm-receipt" },
  { name: "RM Issue", path: "/inventory/rm-issue" },
  { name: "RM Ledger", path: "/inventory/rm-ledger" },
  { name: "FG Stock", path: "/inventory/fg-stock" },
  { name: "Stock Adjustment", path: "/inventory/stock-adjustment" },
  { name: "Alert and Thresholds", path: "/inventory/alerts" },
];

interface DashboardStats {
  roll_rm_stock: number;
  pkg_rm_stock: number;
  fg_stock_value: number;
  rm_issued_week: number;
  low_stock_items: { item: string; status: string; level: string }[];
  recent_receipts: { item: string; qty: string; date: string }[];
  recent_ledger: { material_name: string; txn_type: string; qty: string; date: string }[];
}

export { inventoryTabs };

export default function InventoryDashboard() {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const { data, error } = await supabase.rpc("fn_get_dashboard_stats");
      if (error) throw error;
      setStats(data);
    } catch (error: any) {
      console.error("Error fetching dashboard stats:", error);
      toast({
        title: "Error loading dashboard",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US").format(value);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Inventory Dashboard</h1>
      <ModuleTabs tabs={inventoryTabs} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Roll RM Available</CardTitle>
            <Layers className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold" data-testid="text-roll-stock">
                {formatNumber(stats?.roll_rm_stock || 0)} <span className="text-sm font-normal text-muted-foreground">kg</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total Roll Stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Package RM Available</CardTitle>
            <ShoppingBag className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold" data-testid="text-pkg-stock">
                {formatNumber(stats?.pkg_rm_stock || 0)} <span className="text-sm font-normal text-muted-foreground">units</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total Packaging Stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">FG Stock Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold" data-testid="text-fg-value">
                {formatCurrency(stats?.fg_stock_value || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total Finished Goods</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RM Issued (Last 7 Days)</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold" data-testid="text-rm-issued">
                {formatNumber(stats?.rm_issued_week || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total Quantity Issued</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Recent Material Receipts (Last 5)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
              ) : stats?.recent_receipts?.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">No recent receipts</div>
              ) : (
                stats?.recent_receipts.map((receipt, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="font-medium truncate max-w-[150px]" title={receipt.item}>{receipt.item}</span>
                    <span className="text-muted-foreground">{receipt.qty}</span>
                    <span className="text-sm text-muted-foreground">{receipt.date}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Stock Alerts</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
              ) : stats?.low_stock_items?.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">No stock alerts</div>
              ) : (
                stats?.low_stock_items.map((alert, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                    <span className="font-medium truncate max-w-[180px]" title={alert.item}>{alert.item}</span>
                    <span className="text-sm text-amber-600 font-medium">
                      {alert.status}
                    </span>
                    <span className="text-muted-foreground text-sm">{alert.level}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Recent RM Ledger Entries (Last 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium py-2">Date</th>
                  <th className="text-left font-medium py-2">Material</th>
                  <th className="text-left font-medium py-2">Transaction</th>
                  <th className="text-right font-medium py-2">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="py-4 text-center">Loading...</td></tr>
                ) : stats?.recent_ledger?.length === 0 ? (
                  <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No ledger entries found</td></tr>
                ) : (
                  stats?.recent_ledger.map((entry, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2">{entry.date}</td>
                      <td className="py-2 font-medium">{entry.material_name || "Unknown"}</td>
                      <td className="py-2 capitalize">{entry.txn_type}</td>
                      <td className={`py-2 text-right ${entry.qty.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.qty}
                      </td>
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
