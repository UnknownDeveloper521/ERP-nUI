import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { productionTabs } from "./ProductionDashboard";
import { Plus } from "lucide-react";

export default function WasteTracking() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Production</h1>
      <ModuleTabs tabs={productionTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Waste Tracking</h2>
        <Button data-testid="button-log-waste">
          <Plus className="h-4 w-4 mr-2" />
          Log Waste
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waste Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Line</th>
                  <th className="text-left py-2 px-2">Material</th>
                  <th className="text-left py-2 px-2">Reason</th>
                  <th className="text-right py-2 px-2">Quantity</th>
                  <th className="text-right py-2 px-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { date: "2026-01-06", line: "Line A", material: "Steel Plates", reason: "Machine error", qty: "15 kg", cost: "$45" },
                  { date: "2026-01-06", line: "Line B", material: "Copper Wire", reason: "Defective batch", qty: "25 m", cost: "$120" },
                  { date: "2026-01-05", line: "Line C", material: "PCB Board", reason: "Soldering defect", qty: "8 units", cost: "$240" },
                  { date: "2026-01-05", line: "Line A", material: "Aluminum Rods", reason: "Cutting error", qty: "10 units", cost: "$85" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2">{row.date}</td>
                    <td className="py-2 px-2">{row.line}</td>
                    <td className="py-2 px-2">{row.material}</td>
                    <td className="py-2 px-2">{row.reason}</td>
                    <td className="py-2 px-2 text-right">{row.qty}</td>
                    <td className="py-2 px-2 text-right text-red-600">{row.cost}</td>
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
