import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { inventoryTabs } from "./InventoryDashboard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function RMLedger() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Inventory</h1>
      <ModuleTabs tabs={inventoryTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">RM Ledger</h2>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search materials..." className="pl-8" data-testid="input-search-ledger" />
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Material Ledger</CardTitle>
        </CardHeader>
        <CardContent>
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
                {[
                  { date: "2026-01-06", ref: "RMR-001", material: "Steel Plates", type: "Receipt", inQty: "500", out: "-", balance: "1500" },
                  { date: "2026-01-06", ref: "ISS-001", material: "Steel Plates", type: "Issue", inQty: "-", out: "100", balance: "1400" },
                  { date: "2026-01-05", ref: "RMR-002", material: "Aluminum Rods", type: "Receipt", inQty: "250", out: "-", balance: "750" },
                  { date: "2026-01-05", ref: "ISS-002", material: "Aluminum Rods", type: "Issue", inQty: "-", out: "50", balance: "700" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2">{row.date}</td>
                    <td className="py-2 px-2 text-primary">{row.ref}</td>
                    <td className="py-2 px-2">{row.material}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        row.type === 'Receipt' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-green-600">{row.inQty}</td>
                    <td className="py-2 px-2 text-right text-red-600">{row.out}</td>
                    <td className="py-2 px-2 text-right font-medium">{row.balance}</td>
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
