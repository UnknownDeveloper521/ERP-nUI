import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { productionTabs } from "./ProductionDashboard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function ProductionHistory() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Production</h1>
      <ModuleTabs tabs={productionTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Production History</h2>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search history..." className="pl-8" data-testid="input-search-history" />
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Production Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Batch ID</th>
                  <th className="text-left py-2 px-2">Product</th>
                  <th className="text-left py-2 px-2">Line</th>
                  <th className="text-right py-2 px-2">Planned</th>
                  <th className="text-right py-2 px-2">Actual</th>
                  <th className="text-right py-2 px-2">Variance</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { date: "2026-01-06", batch: "B-0106-A", product: "Motor Assembly A", line: "Line A", planned: "500", actual: "485", variance: "-3%" },
                  { date: "2026-01-06", batch: "B-0106-B", product: "Pump Unit B", line: "Line B", planned: "300", actual: "312", variance: "+4%" },
                  { date: "2026-01-05", batch: "B-0105-A", product: "Motor Assembly A", line: "Line A", planned: "500", actual: "510", variance: "+2%" },
                  { date: "2026-01-05", batch: "B-0105-B", product: "Control Panel C", line: "Line C", planned: "100", actual: "95", variance: "-5%" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2">{row.date}</td>
                    <td className="py-2 px-2 font-mono">{row.batch}</td>
                    <td className="py-2 px-2">{row.product}</td>
                    <td className="py-2 px-2">{row.line}</td>
                    <td className="py-2 px-2 text-right">{row.planned}</td>
                    <td className="py-2 px-2 text-right">{row.actual}</td>
                    <td className={`py-2 px-2 text-right font-medium ${
                      row.variance.startsWith('+') ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {row.variance}
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
