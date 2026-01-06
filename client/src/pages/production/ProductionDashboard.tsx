import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { Factory, CheckCircle, AlertTriangle, Clock } from "lucide-react";

const productionTabs = [
  { name: "Dashboard", path: "/production" },
  { name: "Production Entry", path: "/production/entry" },
  { name: "Production History", path: "/production/history" },
  { name: "Quality Check", path: "/production/quality" },
  { name: "Waste Tracking", path: "/production/waste" },
  { name: "Machine Performance", path: "/production/machines" },
  { name: "Shift Summary", path: "/production/shifts" },
];

export { productionTabs };

export default function ProductionDashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Production</h1>
      <ModuleTabs tabs={productionTabs} />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Production</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-production">1,845</div>
            <p className="text-xs text-muted-foreground">Units produced</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">QC Pass Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-qc-rate">98.5%</div>
            <p className="text-xs text-muted-foreground">Last 7 days avg</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Waste Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-waste-rate">1.2%</div>
            <p className="text-xs text-muted-foreground">Below target of 2%</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OEE</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-oee">87.3%</div>
            <p className="text-xs text-muted-foreground">Overall Equipment Effectiveness</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Production Lines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { line: "Line A - Motor Assembly", status: "Running", output: "423 units", efficiency: "94%" },
                { line: "Line B - Pump Production", status: "Running", output: "312 units", efficiency: "89%" },
                { line: "Line C - Electronics", status: "Maintenance", output: "-", efficiency: "-" },
              ].map((line, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <span className="font-medium">{line.line}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      line.status === 'Running' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {line.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">{line.output}</span>
                    <span className="ml-4 font-medium">{line.efficiency}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quality Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { batch: "BATCH-2026-0106-A", issue: "Dimension variance", severity: "Minor" },
                { batch: "BATCH-2026-0105-C", issue: "Surface finish", severity: "Major" },
              ].map((alert, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <span className="font-mono text-sm">{alert.batch}</span>
                    <p className="text-sm text-muted-foreground">{alert.issue}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    alert.severity === 'Minor' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
