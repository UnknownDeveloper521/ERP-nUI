import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/store";
import { useHasPermission } from "@/hooks/usePermissions";
import { 
  Users, 
  Package, 
  Briefcase, 
  ShoppingCart, 
  CreditCard, 
  FileText, 
  Database, 
  Settings,
  LayoutDashboard,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ModuleSelection = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { isMenuVisible } = useHasPermission();

  const modules = [
    { 
      id: "Dashboard", 
      name: "Executive Dashboard", 
      description: "Overview of key metrics and system-wide operations.",
      icon: LayoutDashboard, 
      path: "/executive-dashboard",
      apiName: "DASHBOARD",
      color: "bg-indigo-500/10 text-indigo-500"
    },
    { 
      id: "HRMS", 
      name: "HRMS & Payroll", 
      description: "Manage employees, attendance, leave and payroll.",
      icon: Users, 
      path: "/hrms/dashboard",
      apiName: "HRMS",
      color: "bg-blue-500/10 text-blue-500"
    },
    { 
      id: "Inventory", 
      name: "Inventory", 
      description: "Track stock, GRN, dispatch and material movements.",
      icon: Package, 
      path: "/inventory/dashboard",
      apiName: "INVENTORY",
      color: "bg-orange-500/10 text-orange-500"
    },
    { 
      id: "Production", 
      name: "Production", 
      description: "BOM management, production planning and tracking.",
      icon: Briefcase, 
      path: "/production/bom",
      apiName: "PRODUCTION",
      color: "bg-purple-500/10 text-purple-500"
    },
    { 
      id: "Sales", 
      name: "Sales", 
      description: "Quotations, sales orders and customer tracking.",
      icon: ShoppingCart, 
      path: "/sales/dashboard",
      apiName: "SALES",
      color: "bg-green-500/10 text-green-500"
    },
    { 
      id: "Purchases", 
      name: "Procurement", 
      description: "Purchase orders, requisitions and vendor management.",
      icon: CreditCard, 
      path: "/procurement/po",
      apiName: "PROCUREMENT",
      color: "bg-red-500/10 text-red-500"
    },
    { 
      id: "Accounting", 
      name: "Accounting", 
      description: "Invoicing, payments and financial tracking.",
      icon: FileText, 
      path: "/accounting/invoicing",
      apiName: "ACCOUNTING",
      color: "bg-cyan-500/10 text-cyan-500"
    },
    { 
      id: "Masters", 
      name: "Masters", 
      description: "System-wide master data configuration.",
      icon: Database, 
      path: "/masters/core/country",
      apiName: "MASTERS",
      color: "bg-amber-500/10 text-amber-500"
    },
    { 
      id: "RolesPermissions", 
      name: "Roles & Permissions", 
      description: "Manage user roles and granular access control.",
      icon: Settings, 
      path: "/system/roles-permissions",
      apiName: "SYSTEM/ROLES_PERMISSIONS",
      color: "bg-slate-500/10 text-slate-500"
    }
  ];

  const visibleModules = modules.filter(mod => {
    // Check if the main module or any child submodule is visible
    return isMenuVisible(mod.apiName) || isMenuVisible(`GENERAL/${mod.apiName}`);
  });

  return (
    <div className="flex flex-col gap-8 py-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name || user?.email?.split('@')[0]}</h1>
        <p className="text-muted-foreground text-lg">Please select a module to begin your workday.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {visibleModules.map((mod) => (
          <Card 
            key={mod.id} 
            className="group cursor-pointer hover:border-primary/50 transition-all duration-300 hover:shadow-lg relative overflow-hidden"
            onClick={() => setLocation(mod.path)}
          >
            <div className={`absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity`}>
              <ArrowRight className="h-5 w-5 text-primary" />
            </div>
            <CardHeader className="pb-3">
              <div className={`h-12 w-12 rounded-xl ${mod.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300`}>
                <mod.icon className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">{mod.name}</CardTitle>
              <CardDescription className="line-clamp-2 min-h-[40px]">
                {mod.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="w-full justify-start p-0 h-auto font-semibold text-primary hover:bg-transparent group-hover:translate-x-1 transition-transform">
                Enter Module <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {visibleModules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-xl bg-muted/20">
          <Settings className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h2 className="text-xl font-semibold">No Modules Available</h2>
          <p className="text-muted-foreground max-w-md mt-2">
            It looks like you don't have access to any modules yet. 
            Please contact your system administrator to assign permissions to your role.
          </p>
        </div>
      )}
    </div>
  );
};

export default ModuleSelection;
