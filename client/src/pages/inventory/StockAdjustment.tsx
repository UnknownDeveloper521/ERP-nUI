import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { inventoryTabs } from "./InventoryDashboard";
import { Plus } from "lucide-react";

export default function StockAdjustment() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Inventory</h1>
      <ModuleTabs tabs={inventoryTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Stock Adjustment</h2>
        <Button data-testid="button-new-adjustment">
          <Plus className="h-4 w-4 mr-2" />
          New Adjustment
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adjustment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Adj. No</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Item</th>
                  <th className="text-left py-2 px-2">Reason</th>
                  <th className="text-right py-2 px-2">Qty Change</th>
                  <th className="text-left py-2 px-2">Approved By</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { no: "ADJ-001", date: "2026-01-06", item: "Steel Plates", reason: "Physical Count", change: "+15", approver: "John Smith" },
                  { no: "ADJ-002", date: "2026-01-05", item: "Copper Wire", reason: "Damage", change: "-50", approver: "Jane Doe" },
                  { no: "ADJ-003", date: "2026-01-04", item: "Bearings SKF", reason: "Expired", change: "-20", approver: "Mike Johnson" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2">{row.no}</td>
                    <td className="py-2 px-2">{row.date}</td>
                    <td className="py-2 px-2">{row.item}</td>
                    <td className="py-2 px-2">{row.reason}</td>
                    <td className={`py-2 px-2 text-right font-medium ${
                      row.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {row.change}
                    </td>
                    <td className="py-2 px-2">{row.approver}</td>
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
