import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { salesTabs } from "./SalesDashboard";
import { Plus } from "lucide-react";

export default function Invoice() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Sales and Invoicing</h1>
      <ModuleTabs tabs={salesTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Invoice</h2>
        <Button data-testid="button-new-invoice">
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Invoice No</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Customer</th>
                  <th className="text-right py-2 px-2">Amount</th>
                  <th className="text-left py-2 px-2">Due Date</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { no: "INV-2026-001", date: "2026-01-06", customer: "Acme Corp", amount: "$12,450", due: "2026-02-06", status: "Pending" },
                  { no: "INV-2026-002", date: "2026-01-05", customer: "TechPro Ltd", amount: "$15,680", due: "2026-02-05", status: "Sent" },
                  { no: "INV-2025-998", date: "2025-12-15", customer: "BuildRight Inc", amount: "$5,420", due: "2026-01-15", status: "Overdue" },
                  { no: "INV-2025-992", date: "2025-12-01", customer: "Global Industries", amount: "$8,920", due: "2026-01-01", status: "Paid" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-mono">{row.no}</td>
                    <td className="py-2 px-2">{row.date}</td>
                    <td className="py-2 px-2">{row.customer}</td>
                    <td className="py-2 px-2 text-right font-medium">{row.amount}</td>
                    <td className="py-2 px-2">{row.due}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        row.status === 'Paid' ? 'bg-green-100 text-green-700' : 
                        row.status === 'Overdue' ? 'bg-red-100 text-red-700' : 
                        row.status === 'Sent' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
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
