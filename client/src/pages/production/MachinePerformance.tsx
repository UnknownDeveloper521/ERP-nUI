import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { productionTabs } from "./ProductionDashboard";
import { Activity } from "lucide-react";

export default function MachinePerformance() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">Production</h1>
      <ModuleTabs tabs={productionTabs} />
      
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-medium">Machine Performance</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { name: "CNC Machine 1", status: "Running", uptime: "94%", cycles: "1,245", lastMaint: "5 days ago" },
          { name: "CNC Machine 2", status: "Running", uptime: "91%", cycles: "1,180", lastMaint: "12 days ago" },
          { name: "Press Machine 1", status: "Idle", uptime: "88%", cycles: "856", lastMaint: "3 days ago" },
          { name: "Welding Robot A", status: "Running", uptime: "97%", cycles: "2,340", lastMaint: "8 days ago" },
          { name: "Assembly Line Bot", status: "Maintenance", uptime: "-", cycles: "-", lastMaint: "Now" },
          { name: "Packaging Unit 1", status: "Running", uptime: "99%", cycles: "3,120", lastMaint: "2 days ago" },
        ].map((machine, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{machine.name}</CardTitle>
              <Activity className={`h-4 w-4 ${
                machine.status === 'Running' ? 'text-green-500' : 
                machine.status === 'Maintenance' ? 'text-amber-500' : 'text-muted-foreground'
              }`} />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    machine.status === 'Running' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                    machine.status === 'Maintenance' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {machine.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Uptime</span>
                  <span className="font-medium">{machine.uptime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Cycles Today</span>
                  <span className="font-medium">{machine.cycles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Last Maintenance</span>
                  <span className="text-sm">{machine.lastMaint}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
