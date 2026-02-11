import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleTabs from "@/components/shared/ModuleTabs";
import { Users, DollarSign, Settings } from "lucide-react";

const hrSetupTabs = [
  { name: "Employee Salary Details", path: "/hr-setup/employee-salary" },
  { name: "Salary Component", path: "/hr-setup/salary-component" },
  { name: "Salary Structure", path: "/hr-setup/salary-structure" },
];

export { hrSetupTabs };

export default function HRSetupDashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">HR Setup</h1>
      <ModuleTabs tabs={hrSetupTabs} />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-employees">245</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salary Components</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-salary-components">12</div>
            <p className="text-xs text-muted-foreground">Configured components</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salary Structures</CardTitle>
            <Settings className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-salary-structures">8</div>
            <p className="text-xs text-muted-foreground">Active structures</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Salary Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { employee: "John Smith", action: "Salary Updated", date: "Today" },
                { employee: "Sarah Johnson", action: "Component Added", date: "Yesterday" },
                { employee: "Mike Wilson", action: "Structure Changed", date: "2 days ago" },
              ].map((update, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="font-medium">{update.employee}</span>
                  <span className="text-muted-foreground">{update.action}</span>
                  <span className="text-sm text-muted-foreground">{update.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { item: "New Salary Structure", type: "Structure", status: "Pending" },
                { item: "Bonus Component", type: "Component", status: "Review" },
                { item: "Annual Increment", type: "Salary", status: "Pending" },
              ].map((approval, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span className="font-medium">{approval.item}</span>
                  <span className="text-sm text-muted-foreground">{approval.type}</span>
                  <span className={`text-sm ${approval.status === 'Pending' ? 'text-amber-500' : 'text-blue-500'}`}>
                    {approval.status}
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