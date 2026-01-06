import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { salesTabs } from "./SalesDashboard";
import { Plus } from "lucide-react";

export default function DispatchNote() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Sales and Invoicing</h1>
      <ModuleTabs tabs={salesTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Dispatch Note</h2>
        <Button data-testid="button-new-dispatch">
          <Plus className="h-4 w-4 mr-2" />
          New Dispatch
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dispatch Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">DN No</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Sales Order</th>
                  <th className="text-left py-2 px-2">Customer</th>
                  <th className="text-left py-2 px-2">Carrier</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { no: "DN-001", date: "2026-01-06", so: "SO-2026-003", customer: "TechPro Ltd", carrier: "FastFreight", status: "In Transit" },
                  { no: "DN-002", date: "2026-01-05", so: "SO-2026-004", customer: "BuildRight Inc", carrier: "QuickShip", status: "Delivered" },
                  { no: "DN-003", date: "2026-01-04", so: "SO-2025-998", customer: "MegaSteel Co", carrier: "FastFreight", status: "Delivered" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-mono">{row.no}</td>
                    <td className="py-2 px-2">{row.date}</td>
                    <td className="py-2 px-2 text-primary">{row.so}</td>
                    <td className="py-2 px-2">{row.customer}</td>
                    <td className="py-2 px-2">{row.carrier}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        row.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
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
