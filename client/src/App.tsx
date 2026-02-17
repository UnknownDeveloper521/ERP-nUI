import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import MainLayout from "@/components/layout/MainLayout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { shouldBlockRoute } from "@/lib/moduleConfig";
import Dashboard from "@/pages/Dashboard";
import HRMS from "@/pages/HRMS";
import Customers from "@/pages/Customers";
import Accounting from "@/pages/Accounting";
import LogisticsDashboard from "@/pages/logistics/LogisticsDashboard";
import NewTrip from "@/pages/logistics/NewTrip";
import Weighment from "@/pages/logistics/Weighment";
import TripHistory from "@/pages/logistics/TripHistory";

import SuperAdminLogin from "@/pages/super-admin/Login";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import SuperAdminDashboard from "@/pages/super-admin/Dashboard";
import TenantManagement from "@/pages/super-admin/TenantManagement";
import CompanyManagement from "@/pages/super-admin/CompanyManagement";

import Inventory from "@/pages/Inventory";
import Products from "@/pages/Products";
import Sales from "@/pages/Sales";
import Purchases from "@/pages/Purchases";
import UsersRoles from "@/pages/UsersRoles";
import MyAccount from "@/pages/MyAccount";

import CRM from "@/pages/CRM";
import PerformanceDashboard from "@/pages/PerformanceDashboard";

import InternalChat from "@/pages/InternalChat";

import ESS from "@/pages/hrms/ESS";
import HRDashboard from "@/pages/hrms/HRDashboard";
import CoreHR from "@/pages/hrms/CoreHR";
import AttendancePage from "@/pages/hrms/Attendance";
import LeaveManagement from "@/pages/hrms/LeaveManagement";
import PayrollManagement from "@/pages/hrms/PayrollManagement";

import InventoryDashboard from "@/pages/inventory/InventoryDashboard";
import RawMaterialReceipt from "@/pages/inventory/RawMaterialReceipt";
import RMIssue from "@/pages/inventory/RMIssue";
import RMLedger from "@/pages/inventory/RMLedger";
import FGStock from "@/pages/inventory/FGStock";
import StockAdjustment from "@/pages/inventory/StockAdjustment";
import AlertsThresholds from "@/pages/inventory/AlertsThresholds";

import ProductionDashboard from "@/pages/production/ProductionDashboard";
import ProductionEntry from "@/pages/production/ProductionEntry";
import ProductionHistory from "@/pages/production/ProductionHistory";
import QualityCheck from "@/pages/production/QualityCheck";
import WasteTracking from "@/pages/production/WasteTracking";
import MachinePerformance from "@/pages/production/MachinePerformance";
import ShiftSummary from "@/pages/production/ShiftSummary";

import SalesDashboard from "@/pages/sales-invoicing/SalesDashboard";
import SalesOrder from "@/pages/sales-invoicing/SalesOrder";
import DispatchNote from "@/pages/sales-invoicing/DispatchNote";
import Invoice from "@/pages/sales-invoicing/Invoice";
import PurchaseOrders from "@/pages/sales-invoicing/PurchaseOrders";
import SalesReports from "@/pages/sales-invoicing/SalesReports";
import HRMSMasters from "@/pages/masters/HRMSMasters";
import ProcurementMasters from "@/pages/masters/ProcurementMasters";
import InventoryMasters from "@/pages/masters/InventoryMasters";
import SalesMasters from "@/pages/masters/SalesMasters";
import ProductionMasters from "@/pages/masters/ProductionMasters";

import HRSetupDashboard from "@/pages/hr-setup/HRSetupDashboard";
import EmployeeSalaryDetails from "@/pages/hr-setup/EmployeeSalaryDetails";
import SalaryComponent from "@/pages/hr-setup/SalaryComponent";
import SalaryStructure from "@/pages/hr-setup/SalaryStructure";
import PayPeriod from "@/pages/hr-setup/PayPeriod";

// Placeholder pages for other modules
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-center">
    <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
      <span className="text-3xl">🚧</span>
    </div>
    <h2 className="text-2xl font-bold text-foreground">{title}</h2>
    <p className="text-muted-foreground mt-2 max-w-md">
      This module is currently under development. Check back later for updates.
    </p>
  </div>
);

/**
 * ============================================================================
 * ROUTE GUARD COMPONENT
 * ============================================================================
 * 
 * PURPOSE:
 * Protects routes for hidden modules by redirecting to dashboard.
 * Prevents users from accessing hidden modules via direct URL entry.
 * 
 * WHY NEEDED:
 * Even if modules are hidden from sidebar and search, users could still
 * type the URL directly (e.g., /hrms/leave-management). This component
 * blocks that access and redirects to dashboard.
 * 
 * HOW IT WORKS:
 * 1. Checks if current route path matches any hidden module
 * 2. If hidden: Redirects to dashboard (/)
 * 3. If visible: Renders the protected content normally
 * 
 * USAGE:
 * Wrap any route that might be hidden with this component:
 * <RouteGuard path="/hrms/leave-management">
 *   <LeaveManagement />
 * </RouteGuard>
 * 
 * CONFIGURATION:
 * Hidden modules are defined in client/src/lib/moduleConfig.ts
 * To re-enable a module, change its value from false to true in HIDDEN_MODULES
 * 
 * ============================================================================
 */
const RouteGuard = ({ path, children }: { path: string; children: React.ReactNode }) => {
  // Check if this route should be blocked (module is hidden)
  if (shouldBlockRoute(path)) {
    // Redirect to dashboard - user cannot access this hidden module
    window.location.href = '/';
    return null;
  }
  
  // Route is allowed - render the content
  return <>{children}</>;
};

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Super Admin Routes */}
      <Route path="/super-admin/login" component={SuperAdminLogin} />
      <Route path="/super-admin">
        {() => (
          <SuperAdminLayout>
            <SuperAdminDashboard />
          </SuperAdminLayout>
        )}
      </Route>
      <Route path="/super-admin/tenants">
        {() => (
          <SuperAdminLayout>
            <TenantManagement />
          </SuperAdminLayout>
        )}
      </Route>
      <Route path="/super-admin/companies">
        {() => (
          <SuperAdminLayout>
            <CompanyManagement />
          </SuperAdminLayout>
        )}
      </Route>

      {/* HRMS Routes */}
      <Route path="/hrms">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <HRDashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/hrms/core-hr/employees/new">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <CoreHR />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/hrms/core-hr/employees/:id">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <CoreHR />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/hrms/core-hr">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <CoreHR />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* ====================================================================
           LEAVE MANAGEMENT ROUTES - PROTECTED BY ROUTE GUARD
           ====================================================================
           PURPOSE: All Leave Management module routes
           ROUTE GUARD: Redirects to dashboard if module is hidden
           CONFIGURATION: Controlled by HIDDEN_MODULES in moduleConfig.ts
           TO RE-ENABLE: Set 'leave-management': true in moduleConfig.ts
           ==================================================================== */}
      <Route path="/hrms/leave-management">
        {() => (
          <RouteGuard path="/hrms/leave-management">
            <ProtectedRoute>
              <MainLayout>
                <LeaveManagement />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>

      <Route path="/hrms/leave-management/dashboard">
        {() => (
          <RouteGuard path="/hrms/leave-management/dashboard">
            <ProtectedRoute>
              <MainLayout>
                <LeaveManagement />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>

      <Route path="/hrms/leave-management/apply">
        {() => (
          <RouteGuard path="/hrms/leave-management/apply">
            <ProtectedRoute>
              <MainLayout>
                <LeaveManagement />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>

      <Route path="/hrms/leave-management/management">
        {() => (
          <RouteGuard path="/hrms/leave-management/management">
            <ProtectedRoute>
              <MainLayout>
                <LeaveManagement />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>

      <Route path="/hrms/leave-management/calendar">
        {() => (
          <RouteGuard path="/hrms/leave-management/calendar">
            <ProtectedRoute>
              <MainLayout>
                <LeaveManagement />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>

      <Route path="/leave-management/apply">
        {() => (
          <RouteGuard path="/leave-management/apply">
            <ProtectedRoute>
              <MainLayout>
                <LeaveManagement />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>

      {/* ====================================================================
           PAYROLL MANAGEMENT ROUTES - PROTECTED BY ROUTE GUARD
           ====================================================================
           PURPOSE: All Payroll Management module routes
           ROUTE GUARD: Redirects to dashboard if module is hidden
           CONFIGURATION: Controlled by HIDDEN_MODULES in moduleConfig.ts
           TO RE-ENABLE: Set 'payroll-management': true in moduleConfig.ts
           ==================================================================== */}
      {/* Payroll Management - Main page (Run Payroll tab) */}
      <Route path="/hrms/payroll-management">
        {() => (
          <RouteGuard path="/hrms/payroll-management">
            <ProtectedRoute>
              <MainLayout>
                <PayrollManagement />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>

      {/* Payroll Management - Payslips Tab */}
      <Route path="/hrms/payroll-management/payslips">
        {() => (
          <RouteGuard path="/hrms/payroll-management/payslips">
            <ProtectedRoute>
              <MainLayout>
                <PayrollManagement />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>

      {/* Payroll Management - Employee Form */}
      <Route path="/hrms/payroll-management/:employeeId">
        {() => (
          <RouteGuard path="/hrms/payroll-management/:employeeId">
            <ProtectedRoute>
              <MainLayout>
                <PayrollManagement />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>

      {/* HRMS Sub-modules */}
      <Route path="/hrms/employees">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <HRMS />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/hrms/attendance">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <AttendancePage />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      {/* ====================================================================
           EMPLOYEE SELF SERVICE (ESS) ROUTE - PROTECTED BY ROUTE GUARD
           ====================================================================
           PURPOSE: Employee Self Service module route
           ROUTE GUARD: Redirects to dashboard if module is hidden
           CONFIGURATION: Controlled by HIDDEN_MODULES in moduleConfig.ts
           TO RE-ENABLE: Set 'ess': true in moduleConfig.ts
           ==================================================================== */}
      <Route path="/hrms/ess">
        {() => (
          <RouteGuard path="/hrms/ess">
            <ProtectedRoute>
              <MainLayout>
                <ESS />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>

      <Route path="/products">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Products />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/inventory">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <InventoryDashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/inventory/rm-receipt">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <RawMaterialReceipt />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/inventory/rm-issue">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <RMIssue />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/inventory/rm-ledger">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <RMLedger />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/inventory/fg-stock">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <FGStock />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/inventory/stock-adjustment">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <StockAdjustment />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/inventory/alerts">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <AlertsThresholds />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/production">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <ProductionDashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/production/entry">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <ProductionEntry />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/production/history">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <ProductionHistory />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/production/quality">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <QualityCheck />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/production/waste">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <WasteTracking />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/production/machines">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <MachinePerformance />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/production/shifts">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <ShiftSummary />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/sales-invoicing">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalesDashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales-invoicing/orders">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalesOrder />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales-invoicing/dispatch">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <DispatchNote />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales-invoicing/invoices">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Invoice />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales-invoicing/purchases">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <PurchaseOrders />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales-invoicing/reports">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalesReports />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/sales">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Sales />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/purchases">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Purchases />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/customers">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <CRM />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/crm">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <CRM />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/accounting">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Accounting />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Logistics Module Routes */}
      <Route path="/logistics">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <LogisticsDashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/logistics/new-trip">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <NewTrip />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/logistics/weighment/:id">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Weighment />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/logistics/history">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <TripHistory />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/settings">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <UsersRoles />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* ====================================================================
           HR SETUP ROUTES - PROTECTED BY ROUTE GUARD
           ====================================================================
           PURPOSE: All HR Setup module routes for salary configuration
           
           ROUTE GUARD: Redirects to dashboard if module is hidden
           
           CONFIGURATION: Controlled by HIDDEN_MODULES in moduleConfig.ts
           
           TO RE-ENABLE: Set 'hr-setup': true in moduleConfig.ts
           
           MODULE OVERVIEW:
           HR Setup is a configuration module used during initial system setup
           and when salary structures need updates. It contains sensitive
           salary configuration that should be protected from accidental changes.
           
           SUB-MODULES:
           1. Employee Salary Details - Assign salary structures to employees
           2. Salary Component - Define earning/deduction/reimbursement components
           3. Salary Structure - Create and manage salary structure templates
           4. Pay Period - Configure pay period settings and schedules
           
           ROUTES PROTECTED (11 total):
           
           Employee Salary Details:
           - /hr-setup/employee-salary (list view)
           - /hr-setup/employee-salary/new (create new assignment)
           - /hr-setup/employee-salary/:id (edit existing assignment)
           
           Salary Component:
           - /hr-setup/salary-component (default view)
           - /hr-setup/salary-component/:tab (tab view: earning/deduction/reimbursement)
           - /hr-setup/salary-component/:tab/new (create new component in tab)
           - /hr-setup/salary-component/:tab/:id (edit existing component)
           
           Salary Structure:
           - /hr-setup/salary-structure (list view)
           - /hr-setup/salary-structure/new (create new structure)
           - /hr-setup/salary-structure/:id (edit existing structure)
           
           Pay Period:
           - /hr-setup/pay-period (pay period management)
           
           REDIRECT BEHAVIOR:
           When module is hidden ('hr-setup': false):
           - User types any HR Setup URL in browser
           - RouteGuard component checks shouldBlockRoute('/hr-setup/...')
           - Function returns true (module is hidden)
           - User is redirected to dashboard (/)
           - No error message shown (silent redirect)
           - URL changes to '/'
           
           WHY HIDE HR SETUP:
           - Setup phase completed: Initial configuration is done
           - Configuration locked: Prevent accidental changes to salary structures
           - Security: Limit access to sensitive salary configuration
           - Simplify UI: Regular users don't need setup access
           - Workflow control: Salary changes should be planned and controlled
           
           BUSINESS LOGIC:
           HR Setup is typically used during:
           - Initial system implementation
           - Annual salary structure reviews
           - New salary component additions
           - Pay period configuration changes
           - Bulk salary assignment updates
           
           Once configured and tested, the module can be hidden to:
           - Prevent accidental modifications
           - Reduce UI complexity
           - Protect sensitive salary data
           - Enforce change control processes
           
           RE-ENABLING PROCESS:
           When salary structures need updates:
           1. Open client/src/lib/moduleConfig.ts
           2. Find 'hr-setup': false in HIDDEN_MODULES
           3. Change to 'hr-setup': true
           4. Save file and refresh browser
           5. HR Setup appears in sidebar (System section)
           6. HR Setup appears in search results
           7. All routes become accessible
           8. Make necessary changes
           9. Test thoroughly
           10. Hide module again if desired
           
           SECURITY CONSIDERATIONS:
           - Salary configuration is sensitive data
           - Changes affect employee compensation
           - Should be restricted to authorized personnel
           - Consider using role-based access when re-enabled
           - Audit trail recommended for salary changes
           
           ==================================================================== */}
      
      {/* ==================================================================
           EMPLOYEE SALARY DETAILS ROUTES
           ==================================================================
           PURPOSE: Assign salary structures to employees
           PAGES: List view, Create new, Edit existing
           ================================================================== */}
      <Route path="/hr-setup/employee-salary">
        {() => (
          <RouteGuard path="/hr-setup/employee-salary">
            <ProtectedRoute>
              <MainLayout>
                <EmployeeSalaryDetails />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>
      
      {/* Route for creating a new Employee Salary Assignment */}
      <Route path="/hr-setup/employee-salary/new">
        {() => (
          <RouteGuard path="/hr-setup/employee-salary/new">
            <ProtectedRoute>
              <MainLayout>
                <EmployeeSalaryDetails />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>
      
      {/* Route for editing an existing Employee Salary Assignment */}
      <Route path="/hr-setup/employee-salary/:id">
        {() => (
          <RouteGuard path="/hr-setup/employee-salary/:id">
            <ProtectedRoute>
              <MainLayout>
                <EmployeeSalaryDetails />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>
      
      {/* ==================================================================
           SALARY COMPONENT ROUTES
           ==================================================================
           PURPOSE: Define earning/deduction/reimbursement components
           PAGES: Default view, Tab view, Create new, Edit existing
           TABS: earning, deduction, reimbursement
           ================================================================== */}
      <Route path="/hr-setup/salary-component">
        {() => (
          <RouteGuard path="/hr-setup/salary-component">
            <ProtectedRoute>
              <MainLayout>
                <SalaryComponent />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>
      
      {/* Route for Salary Component Tabs (earning, deduction, reimbursement) */}
      <Route path="/hr-setup/salary-component/:tab">
        {() => (
          <RouteGuard path="/hr-setup/salary-component/:tab">
            <ProtectedRoute>
              <MainLayout>
                <SalaryComponent />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>
      
      {/* Route for adding a new Salary Component within a specific tab */}
      <Route path="/hr-setup/salary-component/:tab/new">
        {() => (
          <RouteGuard path="/hr-setup/salary-component/:tab/new">
            <ProtectedRoute>
              <MainLayout>
                <SalaryComponent />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>
      
      {/* Route for editing a Salary Component */}
      <Route path="/hr-setup/salary-component/:tab/:id">
        {() => (
          <RouteGuard path="/hr-setup/salary-component/:tab/:id">
            <ProtectedRoute>
              <MainLayout>
                <SalaryComponent />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>
      
      {/* ==================================================================
           SALARY STRUCTURE ROUTES
           ==================================================================
           PURPOSE: Create and manage salary structure templates
           PAGES: List view, Create new, Edit existing
           ================================================================== */}
      <Route path="/hr-setup/salary-structure">
        {() => (
          <RouteGuard path="/hr-setup/salary-structure">
            <ProtectedRoute>
              <MainLayout>
                <SalaryStructure />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>
      
      {/* Route for creating a new Salary Structure */}
      <Route path="/hr-setup/salary-structure/new">
        {() => (
          <RouteGuard path="/hr-setup/salary-structure/new">
            <ProtectedRoute>
              <MainLayout>
                <SalaryStructure />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>
      
      {/* Route for editing an existing Salary Structure */}
      <Route path="/hr-setup/salary-structure/:id">
        {() => (
          <RouteGuard path="/hr-setup/salary-structure/:id">
            <ProtectedRoute>
              <MainLayout>
                <SalaryStructure />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>

      {/* ==================================================================
           PAY PERIOD ROUTE
           ==================================================================
           PURPOSE: Configure pay period settings and schedules
           PAGES: Pay period management
           ================================================================== */}
      <Route path="/hr-setup/pay-period">
        {() => (
          <RouteGuard path="/hr-setup/pay-period">
            <ProtectedRoute>
              <MainLayout>
                <PayPeriod />
              </MainLayout>
            </ProtectedRoute>
          </RouteGuard>
        )}
      </Route>
      <Route path="/masters/hrms/:tab?/:type?">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <HRMSMasters />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/masters/procurement/:tab?/:type?">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <ProcurementMasters />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Inventory Masters */}
      <Route path="/masters/inventory/:tab?/:type?">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <InventoryMasters />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/masters/sales/:tab?/:type?">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalesMasters />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/masters/production/:tab?/:type?">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <ProductionMasters />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/my-account">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <MyAccount />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/performance">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <PerformanceDashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/chat">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <InternalChat />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Home route - exact match for / */}
      <Route path="/">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Catch-all route for unknown paths - show 404 */}
      <Route path="/:rest*">
        {() => <NotFound />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
