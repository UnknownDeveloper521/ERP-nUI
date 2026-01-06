import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { productionTabs } from "./ProductionDashboard";

export default function ShiftSummary() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Production</h1>
      <ModuleTabs tabs={productionTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Shift Summary</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { shift: "Morning Shift", time: "06:00 - 14:00", supervisor: "John Smith", workers: 24, output: "1,245", efficiency: "94%" },
          { shift: "Afternoon Shift", time: "14:00 - 22:00", supervisor: "Jane Doe", workers: 22, output: "1,180", efficiency: "91%" },
          { shift: "Night Shift", time: "22:00 - 06:00", supervisor: "Mike Wilson", workers: 18, output: "856", efficiency: "88%" },
        ].map((shift, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-base">{shift.shift}</CardTitle>
              <p className="text-sm text-muted-foreground">{shift.time}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supervisor</span>
                  <span className="font-medium">{shift.supervisor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Workers</span>
                  <span className="font-medium">{shift.workers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Output</span>
                  <span className="font-medium">{shift.output} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Efficiency</span>
                  <span className={`font-medium ${
                    parseInt(shift.efficiency) >= 90 ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    {shift.efficiency}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today's Shift Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Shift</th>
                  <th className="text-left py-2 px-2">Line</th>
                  <th className="text-right py-2 px-2">Planned</th>
                  <th className="text-right py-2 px-2">Actual</th>
                  <th className="text-right py-2 px-2">Downtime</th>
                  <th className="text-left py-2 px-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { shift: "Morning", line: "Line A", planned: "500", actual: "485", downtime: "15 min", notes: "Brief power fluctuation" },
                  { shift: "Morning", line: "Line B", planned: "300", actual: "312", downtime: "0", notes: "-" },
                  { shift: "Afternoon", line: "Line A", planned: "500", actual: "510", downtime: "0", notes: "-" },
                  { shift: "Afternoon", line: "Line C", planned: "100", actual: "95", downtime: "30 min", notes: "Material shortage" },
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2">{row.shift}</td>
                    <td className="py-2 px-2">{row.line}</td>
                    <td className="py-2 px-2 text-right">{row.planned}</td>
                    <td className="py-2 px-2 text-right">{row.actual}</td>
                    <td className="py-2 px-2 text-right">{row.downtime}</td>
                    <td className="py-2 px-2 text-muted-foreground">{row.notes}</td>
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
