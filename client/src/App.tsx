import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import MainLayout from "@/components/layout/MainLayout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
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

      <Route path="/hrms/leave-management">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <LeaveManagement />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/hrms/leave-management/dashboard">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <LeaveManagement />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/hrms/leave-management/apply">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <LeaveManagement />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/hrms/leave-management/management">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <LeaveManagement />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/hrms/leave-management/calendar">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <LeaveManagement />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/leave-management/apply">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <LeaveManagement />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Payroll Management - Main page (Run Payroll tab) */}
      <Route path="/hrms/payroll-management">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <PayrollManagement />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Payroll Management - Payslips Tab */}
      <Route path="/hrms/payroll-management/payslips">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <PayrollManagement />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Payroll Management - Employee Form */}
      <Route path="/hrms/payroll-management/:employeeId">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <PayrollManagement />
            </MainLayout>
          </ProtectedRoute>
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
      <Route path="/hrms/ess">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <ESS />
            </MainLayout>
          </ProtectedRoute>
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

      {/* HR Setup Routes */}
      <Route path="/hr-setup/employee-salary">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <EmployeeSalaryDetails />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      {/* Route for creating a new Employee Salary Assignment */}
      <Route path="/hr-setup/employee-salary/new">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <EmployeeSalaryDetails />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      {/* Route for editing an existing Employee Salary Assignment */}
      <Route path="/hr-setup/employee-salary/:id">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <EmployeeSalaryDetails />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/hr-setup/salary-component">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalaryComponent />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      {/* Route for Salary Component Tabs (earning, deduction, reimbursement) */}
      <Route path="/hr-setup/salary-component/:tab">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalaryComponent />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      {/* Route for adding a new Salary Component within a specific tab */}
      <Route path="/hr-setup/salary-component/:tab/new">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalaryComponent />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      {/* Route for editing a Salary Component */}
      <Route path="/hr-setup/salary-component/:tab/:id">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalaryComponent />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/hr-setup/salary-structure">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalaryStructure />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      {/* Route for creating a new Salary Structure */}
      <Route path="/hr-setup/salary-structure/new">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalaryStructure />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      {/* Route for editing an existing Salary Structure */}
      <Route path="/hr-setup/salary-structure/:id">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalaryStructure />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/hr-setup/pay-period">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <PayPeriod />
            </MainLayout>
          </ProtectedRoute>
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
