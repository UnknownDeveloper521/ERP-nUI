import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { productionTabs } from "./ProductionDashboard";
import { Plus } from "lucide-react";

export default function ProductionEntry() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Production</h1>
      <ModuleTabs tabs={productionTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Production Entry</h2>
        <Button data-testid="button-new-entry">
          <Plus className="h-4 w-4 mr-2" />
          New Entry
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today's Production Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Entry ID</th>
                  <th className="text-left py-2 px-2">Time</th>
                  <th className="text-left py-2 px-2">Line</th>
                  <th className="text-left py-2 px-2">Product</th>
                  <th className="text-right py-2 px-2">Quantity</th>
                  <th className="text-left py-2 px-2">Operator</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: "PE-001", time: "08:30", line: "Line A", product: "Motor Assembly A", qty: "125", operator: "John", status: "Completed" },
                  { id: "PE-002", time: "10:15", line: "Line B", product: "Pump Unit B", qty: "80", operator: "Jane", status: "In Progress" },
                  { id: "PE-003", time: "11:00", line: "Line A", product: "Motor Assembly A", qty: "130", operator: "John", status: "Completed" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-mono">{row.id}</td>
                    <td className="py-2 px-2">{row.time}</td>
                    <td className="py-2 px-2">{row.line}</td>
                    <td className="py-2 px-2">{row.product}</td>
                    <td className="py-2 px-2 text-right">{row.qty}</td>
                    <td className="py-2 px-2">{row.operator}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        row.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
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
