import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { inventoryTabs } from "./InventoryDashboard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function FGStock() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Inventory</h1>
      <ModuleTabs tabs={inventoryTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">FG Stock (Finished Goods)</h2>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search FG items..." className="pl-8" data-testid="input-search-fg" />
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finished Goods Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">SKU</th>
                  <th className="text-left py-2 px-2">Product Name</th>
                  <th className="text-left py-2 px-2">Category</th>
                  <th className="text-right py-2 px-2">Quantity</th>
                  <th className="text-right py-2 px-2">Unit Price</th>
                  <th className="text-right py-2 px-2">Total Value</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { sku: "FG-001", name: "Motor Assembly A", category: "Motors", qty: "150", price: "$450", value: "$67,500", status: "In Stock" },
                  { sku: "FG-002", name: "Pump Unit B", category: "Pumps", qty: "80", price: "$320", value: "$25,600", status: "In Stock" },
                  { sku: "FG-003", name: "Control Panel C", category: "Electronics", qty: "25", price: "$890", value: "$22,250", status: "Low Stock" },
                  { sku: "FG-004", name: "Valve Assembly D", category: "Valves", qty: "200", price: "$175", value: "$35,000", status: "In Stock" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-mono text-sm">{row.sku}</td>
                    <td className="py-2 px-2">{row.name}</td>
                    <td className="py-2 px-2">{row.category}</td>
                    <td className="py-2 px-2 text-right">{row.qty}</td>
                    <td className="py-2 px-2 text-right">{row.price}</td>
                    <td className="py-2 px-2 text-right font-medium">{row.value}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        row.status === 'In Stock' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
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
