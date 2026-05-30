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
import { useHasPermission } from "@/hooks/usePermissions";

// Import tab components
import RunPayroll from "./RunPayroll";
import Payslips from "./Payslips";

import Unauthorized from "../Unauthorized";

/**
 * Main Payroll Management Page with Tabs
 */
export default function PayrollManagement() {
  const [location, setLocation] = useLocation();
  const { isMenuVisible, canCreate, canEdit, canView } = useHasPermission();

  // Permission Checks
  const hasModuleAccess = isMenuVisible("HRMS:Payroll Management");
  const canAccessRunPayroll = canCreate("HRMS:Payroll Management") || canEdit("HRMS:Payroll Management");
  const canAccessPayslips = canView("HRMS:Payroll Management");

  // State for tabs
  const getActiveTabFromPath = () => {
    if (location.includes("/payslips")) return "payslips";
    if (location.includes("/run-payroll")) return "run-payroll";
    return canAccessRunPayroll ? "run-payroll" : "payslips";
  };

  const [activeTab, setActiveTab] = useState<"run-payroll" | "payslips">(getActiveTabFromPath());

  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [location]);

  // Automatic redirection if landing on unauthorized tab
  useEffect(() => {
    if (activeTab === "run-payroll" && !canAccessRunPayroll && canAccessPayslips) {
      setActiveTab("payslips");
      setLocation("/hrms/payroll-management/payslips");
    } else if (activeTab === "payslips" && !canAccessPayslips && canAccessRunPayroll) {
      setActiveTab("run-payroll");
      setLocation("/hrms/payroll-management/run-payroll");
    }
  }, [canAccessRunPayroll, canAccessPayslips, activeTab, setLocation]);

  // Early return if no module access at all
  if (!hasModuleAccess) {
    return <Unauthorized />;
  }

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
              onClick={() => setLocation("/hrms/payroll-management/run-payroll")}
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
          {canAccessPayslips && (
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
          )}
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
        {activeTab === "payslips" && <Payslips />}
      </div>
    </div>
  );
}
