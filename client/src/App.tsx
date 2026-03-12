import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import MainLayout from "@/components/layout/MainLayout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import VerifyEmail from "@/pages/VerifyEmail";
import RegistrationSuccess from "@/pages/RegistrationSuccess";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import HRMS from "@/pages/HRMS";
import Accounting from "@/pages/Accounting";
// Removed: Non-existent accounting/Invoicing import

import SuperAdminLogin from "@/pages/super-admin/Login";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import SuperAdminDashboard from "@/pages/super-admin/Dashboard";
import TenantManagement from "@/pages/super-admin/TenantManagement";
import CompanyManagement from "@/pages/super-admin/CompanyManagement";


import Vendors from "@/pages/Vendors";
import Customers from "@/pages/Customers";
import Sales from "@/pages/Sales";
import UsersRoles from "@/pages/UsersRoles";
import MyAccount from "@/pages/MyAccount";

import PerformanceDashboard from "@/pages/PerformanceDashboard";



import ESS from "@/pages/hrms/ESS";
import HRDashboard from "@/pages/hrms/HRDashboard";
import CoreHR from "@/pages/hrms/CoreHR";
import AttendancePage from "@/pages/hrms/Attendance";
import LeaveManagement from "@/pages/hrms/LeaveManagement";
import PayrollManagement from "@/pages/hrms/PayrollManagement";
import WorkerPayrolls from "@/pages/hrms/WorkerPayrolls";

import InventoryDashboard from "@/pages/inventory/InventoryDashboard";
import Materials from "@/pages/inventory/Materials";
import GRN from "@/pages/inventory/GRN";
import Dispatch from "@/pages/inventory/Dispatch";
import MaterialLedger from "@/pages/inventory/MaterialLedger";
// Inventory Material Requisitions - for issuing materials to service center
import InventorySMRRequests from "@/pages/inventory/SMRRequests";

// Removed old Production QC import (moved to Quality Check > Batch QC)
// import QualityCheck from "@/pages/production/QualityCheck";
import QualityCheckDashboard from "@/pages/quality-check/Dashboard";
import BatchQC from "@/pages/quality-check/BatchQC";

import MyRequest from "@/pages/production/MyRequest";
import BatchTracking from "@/pages/production/BatchTracking";
import MaterialRelease from "@/pages/production/MaterialRelease";
import BOM from "@/pages/production/BOM";
import ProductionPlan from "@/pages/production/ProductionPlan";
import WarrantyService from "@/pages/service-center/WarrantyService";
// Service Center Material Requisitions - for requesting and receiving materials
import SMRRequests from "@/pages/service-center/SMRRequests";

import SalesDashboard from "@/pages/sales-invoicing/SalesDashboard";
import SalesOrder from "@/pages/sales-invoicing/SalesOrder";
import FollowUp from "@/pages/sales-invoicing/FollowUp";
// Removed: Leads import - module removed from Sales
import Quotations from "@/pages/sales-invoicing/Quotations";
import Invoicing from "@/pages/accounting/Invoicing"; // Moved: Invoicing module to Accounting
import WorkerPayments from "@/pages/accounting/WorkerPayments";
import PaymentFollowUp from "@/pages/accounting/PaymentFollowUp"; // Payment Follow Up module in Accounting
import CoreMasters from "@/pages/masters/CoreMasters";
import ProcurementMasters from "@/pages/masters/ProcurementMasters";
import InventoryMasters from "@/pages/masters/InventoryMasters";
import ProductionMasters from "@/pages/masters/ProductionMasters";

import HRSetupDashboard from "@/pages/hr-setup/HRSetupDashboard";
import EmployeeSalaryDetails from "@/pages/hr-setup/EmployeeSalaryDetails";
import SalaryComponent from "@/pages/hr-setup/SalaryComponent";
import SalaryStructure from "@/pages/hr-setup/SalaryStructure";
import PayPeriod from "@/pages/hr-setup/PayPeriod";
import WorkersWagePeriod from "@/pages/hr-setup/WorkersWagePeriod";

import MRRequest from "@/pages/procurement/MRRequest";
import MRExecution from "@/pages/procurement/MRExecution";
import PO from "@/pages/procurement/PO";


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
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/registration-success" component={RegistrationSuccess} />

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



      <Route path="/hrms/leave-management/leave-entry">
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

      <Route path="/hrms/leave-management/holidays">
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
      <Route path="/hrms/attendance/:tab?">
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
      <Route path="/hrms/worker-payrolls">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <WorkerPayrolls />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/vendors">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Vendors />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/customers">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Customers />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Inventory Routes */}
      {/* Inventory default redirect to dashboard */}
      <Route path="/inventory">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <InventoryDashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/inventory/dashboard">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <InventoryDashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/inventory/materials">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Materials />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/inventory/materials/material-requests">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Materials />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/inventory/grn">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <GRN />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/inventory/dispatch">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Dispatch />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/inventory/materials/wh-receive">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Materials />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/inventory/material-ledger">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <MaterialLedger />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Material Requisitions Route */}
      <Route path="/inventory/smr-requests">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <InventorySMRRequests />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>



      {/* ✅ CHANGED: Updated to cleaner routes - My Request now uses modal for new/edit */}
      {/* Removed route-based New MR Request page; now opened as modal from My Request list */}
      <Route path="/production/my-request">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <MyRequest />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* ✅ CHANGED: Batch Tracking now uses separate component */}
      <Route path="/production/batch-tracking">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <BatchTracking />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/production/batch-tracking/new">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <BatchTracking />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/production/batch-tracking/:id/edit">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <BatchTracking />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>



      {/* Production routes */}
      {/* Removed old Production QC route (moved to Quality Check > Batch QC) */}
      {/* <Route path="/production/quality-check"> ... </Route> */}
      <Route path="/production/bom">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <BOM />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/production/production-plan">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <ProductionPlan />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/production/material-release/new">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <MaterialRelease />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/production/material-release">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <MaterialRelease />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Sales Module - Updated: Changed base path from /sales-invoicing to /sales */}
      <Route path="/sales">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalesDashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales/quotations">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Quotations />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales/orders">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SalesOrder />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales/follow-up">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <FollowUp />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Procurement Routes */}
      {/* MR Execution - separate page */}
      <Route path="/procurement/mr-execution">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <MRExecution />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* PO - separate page */}
      <Route path="/procurement/po">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <PO />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* My MR - separate page */}
      <Route path="/procurement/mr-request">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <MRRequest />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Quality Check Routes - New module (moved from Production > QC) */}
      {/* Quality Check default redirect to dashboard */}
      <Route path="/quality-check">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <QualityCheckDashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/quality-check/dashboard">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <QualityCheckDashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/quality-check/batch-qc">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <BatchQC />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Service Center Routes */}
      <Route path="/service-center/warranty-service">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <WarrantyService />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/service-center/smr-request">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <SMRRequests />
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

      <Route path="/accounting/invoicing">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Invoicing />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/accounting/worker-payments">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <WorkerPayments />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/accounting/pending-payment">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <PaymentFollowUp />
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
      <Route path="/hr-setup/workers-wage-period">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <WorkersWagePeriod />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/masters/core/:type?">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <CoreMasters />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/masters/procurement/:type?">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <ProcurementMasters />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* Inventory Masters */}
      <Route path="/masters/inventory/:type?">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <InventoryMasters />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>


      <Route path="/masters/production/:type?">
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
    </Switch >
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

