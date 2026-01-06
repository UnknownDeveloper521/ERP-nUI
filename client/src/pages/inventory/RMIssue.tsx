import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { inventoryTabs } from "./InventoryDashboard";
import { Plus } from "lucide-react";

export default function RMIssue() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Inventory</h1>
      <ModuleTabs tabs={inventoryTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">RM Issue</h2>
        <Button data-testid="button-new-issue">
          <Plus className="h-4 w-4 mr-2" />
          New Issue
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Material Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Issue No</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Department</th>
                  <th className="text-left py-2 px-2">Material</th>
                  <th className="text-left py-2 px-2">Quantity</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { no: "ISS-001", date: "2026-01-06", dept: "Production Line A", material: "Steel Plates", qty: "100 kg", status: "Issued" },
                  { no: "ISS-002", date: "2026-01-05", dept: "Assembly", material: "Aluminum Rods", qty: "50 units", status: "Pending" },
                  { no: "ISS-003", date: "2026-01-04", dept: "Wiring", material: "Copper Wire", qty: "200 m", status: "Issued" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2">{row.no}</td>
                    <td className="py-2 px-2">{row.date}</td>
                    <td className="py-2 px-2">{row.dept}</td>
                    <td className="py-2 px-2">{row.material}</td>
                    <td className="py-2 px-2">{row.qty}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        row.status === 'Issued' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
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
