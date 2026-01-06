import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { inventoryTabs } from "./InventoryDashboard";
import { Plus } from "lucide-react";

export default function RawMaterialReceipt() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Inventory</h1>
      <ModuleTabs tabs={inventoryTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Raw Material Receipt</h2>
        <Button data-testid="button-add-receipt">
          <Plus className="h-4 w-4 mr-2" />
          New Receipt
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Receipts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Receipt No</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Supplier</th>
                  <th className="text-left py-2 px-2">Material</th>
                  <th className="text-left py-2 px-2">Quantity</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { no: "RMR-001", date: "2026-01-06", supplier: "Steel Corp", material: "Steel Plates", qty: "500 kg", status: "Received" },
                  { no: "RMR-002", date: "2026-01-05", supplier: "Alu World", material: "Aluminum Rods", qty: "250 units", status: "QC Pending" },
                  { no: "RMR-003", date: "2026-01-04", supplier: "Wire Masters", material: "Copper Wire", qty: "1000 m", status: "Received" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2">{row.no}</td>
                    <td className="py-2 px-2">{row.date}</td>
                    <td className="py-2 px-2">{row.supplier}</td>
                    <td className="py-2 px-2">{row.material}</td>
                    <td className="py-2 px-2">{row.qty}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        row.status === 'Received' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
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
