import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { DollarSign, ShoppingCart, TrendingUp, FileText } from "lucide-react";

const salesTabs = [
  { name: "Dashboard", path: "/sales-invoicing" },
  { name: "Sales Order", path: "/sales-invoicing/orders" },
  { name: "Dispatch Note", path: "/sales-invoicing/dispatch" },
  { name: "Invoice", path: "/sales-invoicing/invoices" },
  { name: "Purchase Orders", path: "/sales-invoicing/purchases" },
  { name: "Reports", path: "/sales-invoicing/reports" },
];

export { salesTabs };

export default function SalesDashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Sales and Invoicing</h1>
      <ModuleTabs tabs={salesTabs} />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-revenue">$245,890</div>
            <p className="text-xs text-muted-foreground">+12.5% from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders This Month</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-orders">156</div>
            <p className="text-xs text-muted-foreground">+8 from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-aov">$1,576</div>
            <p className="text-xs text-muted-foreground">+5.2% from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
            <FileText className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending">23</div>
            <p className="text-xs text-muted-foreground">$45,670 outstanding</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { id: "SO-2026-001", customer: "Acme Corp", amount: "$12,450", status: "Confirmed" },
                { id: "SO-2026-002", customer: "Global Industries", amount: "$8,920", status: "Pending" },
                { id: "SO-2026-003", customer: "TechPro Ltd", amount: "$15,680", status: "Shipped" },
              ].map((order, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <span className="font-mono text-sm">{order.id}</span>
                    <p className="text-sm text-muted-foreground">{order.customer}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{order.amount}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      order.status === 'Confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                      order.status === 'Shipped' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overdue Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { id: "INV-2025-892", customer: "BuildRight Inc", amount: "$5,420", days: "15 days" },
                { id: "INV-2025-876", customer: "MegaSteel Co", amount: "$12,890", days: "22 days" },
              ].map((invoice, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <span className="font-mono text-sm">{invoice.id}</span>
                    <p className="text-sm text-muted-foreground">{invoice.customer}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-red-600">{invoice.amount}</span>
                    <p className="text-xs text-red-500">Overdue {invoice.days}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
