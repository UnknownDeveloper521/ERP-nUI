/**
 * ============================================================================
 * PAYROLL MANAGEMENT - MAIN PAGE WITH TABS
 * ============================================================================
 * 
 * This is the main Payroll Management page with horizontal tabs at the top.
 * Similar to CoreHR and Inventory pages.
 * 
 * TABS:
 * 1. Run Payroll - Process payroll for employees (Hidden for Employee role)
 * 2. Payslips - View and manage employee payslips
 * 
 * ROLE SIMULATION:
 * - Admin/HR Manager: Can see both tabs, HR view in Payslips
 * - Employee: Only sees Payslips tab, Employee view
 * 
 * ============================================================================
 */

import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";

// Import tab components
import RunPayroll from "./RunPayroll";
import Payslips from "./Payslips";

// Role type
type SimulatedRole = "Admin" | "HR Manager" | "Employee";

/**
 * Main Payroll Management Page with Tabs
 */
export default function PayrollManagement() {
  const [location, setLocation] = useLocation();
  
  // ============================================================================
  // ROLE SIMULATION STATE
  // ============================================================================
  // PURPOSE: Simulates different user roles (Admin/HR Manager/Employee) for testing
  // WHY NEEDED: In production, this will be replaced with actual user role from auth context
  // REMOVE WHEN: Implementing real authentication system
  // ============================================================================
  const [simulatedRole, setSimulatedRole] = useState<SimulatedRole>("Admin");
  
  // ============================================================================
  // TAB ROUTING LOGIC
  // ============================================================================
  // PURPOSE: Determines which tab is active based on current URL path
  // WHY NEEDED: Keeps tab state in sync with browser URL for proper navigation
  // KEEP: This is essential for tab navigation and browser back/forward buttons
  // ============================================================================
  const getActiveTabFromPath = () => {
    if (location.includes("/payslips")) return "payslips";
    return "run-payroll"; // default
  };
  
  const [activeTab, setActiveTab] = useState<"run-payroll" | "payslips">(getActiveTabFromPath());

  // ============================================================================
  // SYNC TAB STATE WITH URL
  // ============================================================================
  // PURPOSE: Updates active tab when user navigates using browser back/forward
  // WHY NEEDED: Ensures UI stays in sync with URL changes
  // KEEP: Essential for proper browser navigation behavior
  // ============================================================================
  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [location]);

  // ============================================================================
  // ROLE-BASED ACCESS CONTROL
  // ============================================================================
  // PURPOSE: Automatically redirects Employees away from Run Payroll tab
  // WHY NEEDED: Employees should only see their own payslips, not process payroll
  // KEEP: This enforces security - prevents unauthorized access to payroll processing
  // ============================================================================
  useEffect(() => {
    if (simulatedRole === "Employee" && activeTab === "run-payroll") {
      setActiveTab("payslips");
      setLocation("/hrms/payroll-management/payslips");
    }
  }, [simulatedRole, activeTab, setLocation]);

  // ============================================================================
  // PERMISSION CHECK
  // ============================================================================
  // PURPOSE: Determines if current user can access Run Payroll tab
  // WHY NEEDED: Used to conditionally hide/show Run Payroll tab in UI
  // KEEP: Essential for role-based UI rendering
  // ============================================================================
  const canAccessRunPayroll = simulatedRole !== "Employee";

  return (
    <div className="space-y-6">
      {/* Page Header with Role Selector */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
          <p className="text-muted-foreground">
            Run payroll and manage payslips
          </p>
        </div>

        {/* ====================================================================
             ROLE SIMULATOR DROPDOWN
             ====================================================================
             PURPOSE: Allows testing different user roles without authentication
             WHY NEEDED: For development/testing - simulates Admin/HR/Employee views
             REMOVE WHEN: Implementing real authentication system
             REPLACE WITH: User profile dropdown showing actual logged-in user role
             ==================================================================== */}
        <div className="flex items-center gap-2 mt-2 mr-8">
          <Label className="text-sm font-medium whitespace-nowrap">SIMULATE ROLE:</Label>
          <Select value={simulatedRole} onValueChange={(value) => setSimulatedRole(value as SimulatedRole)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Admin">
                <div className="flex items-center justify-between w-full">
                  <span>Admin</span>
                  {/* Check icon shows current selected role */}
                  {simulatedRole === "Admin" && <Check className="h-4 w-4 ml-2" />}
                </div>
              </SelectItem>
              <SelectItem value="HR Manager">
                <div className="flex items-center justify-between w-full">
                  <span>HR Manager</span>
                  {simulatedRole === "HR Manager" && <Check className="h-4 w-4 ml-2" />}
                </div>
              </SelectItem>
              <SelectItem value="Employee">
                <div className="flex items-center justify-between w-full">
                  <span>Employee</span>
                  {simulatedRole === "Employee" && <Check className="h-4 w-4 ml-2" />}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ====================================================================
           HORIZONTAL TAB NAVIGATION
           ====================================================================
           PURPOSE: Provides tab-based navigation between Run Payroll and Payslips
           WHY NEEDED: Organizes payroll features into logical sections
           KEEP: Essential for user navigation and feature organization
           ==================================================================== */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {/* ================================================================
               RUN PAYROLL TAB
               ================================================================
               PURPOSE: Tab for HR/Admin to process employee payroll
               WHY CONDITIONAL: Hidden for Employee role (security)
               KEEP: Essential for payroll processing access control
               ================================================================ */}
          {canAccessRunPayroll && (
            <button
              onClick={() => setLocation("/hrms/payroll-management")}
              className={cn(
                "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                activeTab === "run-payroll"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
              )}
            >
              Run Payroll
            </button>
          )}

          {/* ================================================================
               PAYSLIPS TAB
               ================================================================
               PURPOSE: Tab for viewing payslips (HR sees all, Employee sees own)
               WHY ALWAYS VISIBLE: All roles need access to view payslips
               KEEP: Essential for payslip viewing functionality
               ================================================================ */}
          <button
            onClick={() => setLocation("/hrms/payroll-management/payslips")}
            className={cn(
              "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === "payslips"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
            )}
          >
            Payslips
          </button>
        </nav>
      </div>

      {/* ====================================================================
           TAB CONTENT RENDERING
           ====================================================================
           PURPOSE: Renders the appropriate component based on active tab
           WHY CONDITIONAL: Only renders active tab to optimize performance
           KEEP: Essential for tab functionality and performance
           ==================================================================== */}
      <div>
        {activeTab === "run-payroll" && canAccessRunPayroll && <RunPayroll />}
        {activeTab === "payslips" && <Payslips simulatedRole={simulatedRole} />}
      </div>
    </div>
  );
}
