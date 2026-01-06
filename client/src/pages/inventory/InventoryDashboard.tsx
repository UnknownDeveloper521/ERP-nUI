import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { Package, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

const inventoryTabs = [
  { name: "Dashboard", path: "/inventory" },
  { name: "Raw Material Receipt", path: "/inventory/rm-receipt" },
  { name: "RM Issue", path: "/inventory/rm-issue" },
  { name: "RM Ledger", path: "/inventory/rm-ledger" },
  { name: "FG Stock", path: "/inventory/fg-stock" },
  { name: "Stock Adjustment", path: "/inventory/stock-adjustment" },
  { name: "Alert and Thresholds", path: "/inventory/alerts" },
];

export { inventoryTabs };

export default function InventoryDashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Inventory</h1>
      <ModuleTabs tabs={inventoryTabs} />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Raw Materials</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-rm">1,245</div>
            <p className="text-xs text-muted-foreground">+12 from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">FG Stock Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-fg-value">$2.4M</div>
            <p className="text-xs text-muted-foreground">+8.2% from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-low-stock">23</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Turnover</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-turnover">4.2x</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Material Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { item: "Steel Plates", qty: "500 kg", date: "Today" },
                { item: "Aluminum Rods", qty: "250 units", date: "Yesterday" },
                { item: "Copper Wire", qty: "1000 m", date: "2 days ago" },
              ].map((receipt, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="font-medium">{receipt.item}</span>
                  <span className="text-muted-foreground">{receipt.qty}</span>
                  <span className="text-sm text-muted-foreground">{receipt.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { item: "Bearings SKF-6205", status: "Critical", level: "5%" },
                { item: "Lubricant Oil 10W40", status: "Low", level: "15%" },
                { item: "Packing Material", status: "Low", level: "20%" },
              ].map((alert, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="font-medium">{alert.item}</span>
                  <span className={`text-sm ${alert.status === 'Critical' ? 'text-red-500' : 'text-amber-500'}`}>
                    {alert.status}
                  </span>
                  <span className="text-muted-foreground">{alert.level}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
