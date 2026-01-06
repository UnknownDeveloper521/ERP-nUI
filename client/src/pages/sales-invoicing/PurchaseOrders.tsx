import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { salesTabs } from "./SalesDashboard";
import { Plus } from "lucide-react";

export default function PurchaseOrders() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Sales and Invoicing</h1>
      <ModuleTabs tabs={salesTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Purchase Orders</h2>
        <Button data-testid="button-new-po">
          <Plus className="h-4 w-4 mr-2" />
          New PO
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">PO No</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Vendor</th>
                  <th className="text-right py-2 px-2">Items</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { no: "PO-2026-001", date: "2026-01-06", vendor: "Steel Corp", items: "3", total: "$24,500", status: "Approved" },
                  { no: "PO-2026-002", date: "2026-01-05", vendor: "Alu World", items: "5", total: "$18,750", status: "Pending" },
                  { no: "PO-2026-003", date: "2026-01-04", vendor: "Wire Masters", items: "2", total: "$8,200", status: "Received" },
                  { no: "PO-2025-998", date: "2025-12-28", vendor: "Parts Plus", items: "8", total: "$12,340", status: "Received" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-mono">{row.no}</td>
                    <td className="py-2 px-2">{row.date}</td>
                    <td className="py-2 px-2">{row.vendor}</td>
                    <td className="py-2 px-2 text-right">{row.items}</td>
                    <td className="py-2 px-2 text-right font-medium">{row.total}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        row.status === 'Received' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                        row.status === 'Approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
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
