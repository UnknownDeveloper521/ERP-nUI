import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { salesTabs } from "./SalesDashboard";
import { Plus } from "lucide-react";

export default function SalesOrder() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Sales and Invoicing</h1>
      <ModuleTabs tabs={salesTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Sales Order</h2>
        <Button data-testid="button-new-order">
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Order No</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Customer</th>
                  <th className="text-right py-2 px-2">Items</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { no: "SO-2026-001", date: "2026-01-06", customer: "Acme Corp", items: "5", total: "$12,450", status: "Confirmed" },
                  { no: "SO-2026-002", date: "2026-01-06", customer: "Global Industries", items: "3", total: "$8,920", status: "Pending" },
                  { no: "SO-2026-003", date: "2026-01-05", customer: "TechPro Ltd", items: "8", total: "$15,680", status: "Shipped" },
                  { no: "SO-2026-004", date: "2026-01-05", customer: "BuildRight Inc", items: "2", total: "$4,250", status: "Delivered" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-mono">{row.no}</td>
                    <td className="py-2 px-2">{row.date}</td>
                    <td className="py-2 px-2">{row.customer}</td>
                    <td className="py-2 px-2 text-right">{row.items}</td>
                    <td className="py-2 px-2 text-right font-medium">{row.total}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        row.status === 'Confirmed' ? 'bg-green-100 text-green-700' : 
                        row.status === 'Shipped' ? 'bg-blue-100 text-blue-700' : 
                        row.status === 'Delivered' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
