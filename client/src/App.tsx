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

import Inventory from "@/pages/Inventory";
import Products from "@/pages/Products";
import Sales from "@/pages/Sales";
import Purchases from "@/pages/Purchases";
import UsersRoles from "@/pages/UsersRoles";
import MyAccount from "@/pages/MyAccount";

import CRM from "@/pages/CRM";
import PerformanceDashboard from "@/pages/PerformanceDashboard";

import InternalChat from "@/pages/InternalChat";

import Departments from "@/pages/hrms/Departments";
import Recruitment from "@/pages/hrms/Recruitment";
import Shifts from "@/pages/hrms/Shifts";
import ESS from "@/pages/hrms/ESS";
import HRDashboard from "@/pages/hrms/HRDashboard";
import Payroll from "@/pages/hrms/Payroll";

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
      
      {/* Protected Routes wrapped in MainLayout */}
      <Route path="/">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/hrms">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <HRDashboard />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      
      {/* HRMS Sub-modules */}
      <Route path="/hrms/management">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <HRMS />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/hrms/employees">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <HRMS />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/hrms/roles">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <UsersRoles />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/hrms/attendance">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <HRMS />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/hrms/payroll">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Payroll />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/hrms/departments">
        {() => (
          <ProtectedRoute>
            <MainLayout>
              <Departments />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/hrms/recruitment">
        {() => (
          <ProtectedRoute>
            <MainLayout>
               <Recruitment />
            </MainLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/hrms/shifts">
        {() => (
          <ProtectedRoute>
            <MainLayout>
               <Shifts />
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
              <Inventory />
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

      {/* Fallback to 404 */}
      <Route component={NotFound} />
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
