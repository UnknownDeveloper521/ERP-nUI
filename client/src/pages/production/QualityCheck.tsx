import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { productionTabs } from "./ProductionDashboard";
import { Plus, CheckCircle, XCircle } from "lucide-react";

export default function QualityCheck() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Production</h1>
      <ModuleTabs tabs={productionTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Quality Check</h2>
        <Button data-testid="button-new-qc">
          <Plus className="h-4 w-4 mr-2" />
          New QC Entry
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quality Check Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">QC ID</th>
                  <th className="text-left py-2 px-2">Batch</th>
                  <th className="text-left py-2 px-2">Product</th>
                  <th className="text-right py-2 px-2">Sample Size</th>
                  <th className="text-right py-2 px-2">Passed</th>
                  <th className="text-right py-2 px-2">Failed</th>
                  <th className="text-left py-2 px-2">Result</th>
                  <th className="text-left py-2 px-2">Inspector</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: "QC-001", batch: "B-0106-A", product: "Motor Assembly A", sample: "50", passed: "49", failed: "1", result: "Pass", inspector: "Mike" },
                  { id: "QC-002", batch: "B-0106-B", product: "Pump Unit B", sample: "30", passed: "30", failed: "0", result: "Pass", inspector: "Sarah" },
                  { id: "QC-003", batch: "B-0105-C", product: "Control Panel C", sample: "20", passed: "16", failed: "4", result: "Fail", inspector: "Mike" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-mono">{row.id}</td>
                    <td className="py-2 px-2">{row.batch}</td>
                    <td className="py-2 px-2">{row.product}</td>
                    <td className="py-2 px-2 text-right">{row.sample}</td>
                    <td className="py-2 px-2 text-right text-green-600">{row.passed}</td>
                    <td className="py-2 px-2 text-right text-red-600">{row.failed}</td>
                    <td className="py-2 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                        row.result === 'Pass' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {row.result === 'Pass' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {row.result}
                      </span>
                    </td>
                    <td className="py-2 px-2">{row.inspector}</td>
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
