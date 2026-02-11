import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { inventoryTabs } from "./InventoryDashboard";
import { Settings, AlertTriangle } from "lucide-react";

export default function AlertsThresholds() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Inventory</h1>
      <ModuleTabs tabs={inventoryTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Alert and Thresholds</h2>
        <Button variant="outline" data-testid="button-configure-alerts">
          <Settings className="h-4 w-4 mr-2" />
          Configure Alerts
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { item: "Bearings SKF-6205", current: "12", threshold: "50", percent: "24%" },
                { item: "Lubricant Oil 10W40", current: "8", threshold: "30", percent: "27%" },
                { item: "Packing Material Type A", current: "45", threshold: "100", percent: "45%" },
              ].map((alert, i) => (
                <div key={i} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{alert.item}</span>
                    <span className="text-red-600 font-bold">{alert.percent}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Current: {alert.current} / Threshold: {alert.threshold}
                  </div>
                  <div className="w-full bg-red-200 dark:bg-red-800 rounded-full h-2 mt-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full" 
                      style={{ width: alert.percent }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Threshold Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Item Category</th>
                    <th className="text-right py-2 px-2">Min Level</th>
                    <th className="text-right py-2 px-2">Reorder Level</th>
                    <th className="text-right py-2 px-2">Max Level</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { category: "Raw Materials", min: "50", reorder: "100", max: "500" },
                    { category: "Consumables", min: "20", reorder: "50", max: "200" },
                    { category: "Spare Parts", min: "10", reorder: "30", max: "100" },
                    { category: "Finished Goods", min: "25", reorder: "75", max: "300" },
                  ].map((row, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2">{row.category}</td>
                      <td className="py-2 px-2 text-right text-red-600">{row.min}</td>
                      <td className="py-2 px-2 text-right text-amber-600">{row.reorder}</td>
                      <td className="py-2 px-2 text-right text-green-600">{row.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
