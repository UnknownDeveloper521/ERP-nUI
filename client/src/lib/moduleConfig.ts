/**
 * ============================================================================
 * MODULE VISIBILITY CONFIGURATION
 * ============================================================================
 * 
 * PURPOSE:
 * This file provides a centralized configuration for controlling which modules
 * are visible/hidden in the application UI. It allows temporarily disabling
 * modules without removing any code, routes, or logic.
 * 
 * WHY THIS APPROACH:
 * - Single source of truth for module visibility
 * - Easy to re-enable modules (just flip a boolean)
 * - No code deletion required
 * - No backend changes needed
 * - No complex role/permission logic
 * - Works across all UI touchpoints (sidebar, search, dashboard, routes)
 * 
 * HOW TO USE:
 * 1. To hide a module: Set its value to `false` in HIDDEN_MODULES
 * 2. To show a module: Set its value to `true` in HIDDEN_MODULES
 * 3. Changes take effect immediately after page refresh
 * 
 * AFFECTED AREAS:
 * - Sidebar navigation (modules won't appear in menu)
 * - Search results (hidden modules excluded from search)
 * - Dashboard widgets (cards for hidden modules won't show)
 * - Direct URL access (redirects to dashboard if module is hidden)
 * 
 * ============================================================================
 */

/**
 * HIDDEN MODULES CONFIGURATION
 * 
 * Define which modules should be hidden from the UI.
 * 
 * KEY FORMAT: Use the route path segment as the key
 * VALUE: true = visible, false = hidden
 * 
 * CURRENTLY HIDDEN MODULES:
 * - Leave Management (/hrms/leave-management)
 * - Payroll Management (/hrms/payroll-management)
 * - Self Service/ESS (/hrms/ess)
 * - HR Setup (/hr-setup/*)
 * 
 * TO RE-ENABLE: Change the value from false to true
 */
export const HIDDEN_MODULES = {
  // HRMS Sub-modules
  'leave-management': false,  // Leave Management module - HIDDEN
  'payroll-management': false, // Payroll Management module - HIDDEN
  'ess': false,                // Employee Self Service (ESS) module - HIDDEN
  
  // ============================================================================
  // HR SETUP MODULE - SALARY CONFIGURATION & SETUP
  // ============================================================================
  // 
  // PURPOSE:
  // HR Setup module contains salary configuration and setup pages used during
  // initial system configuration and when salary structures need updates.
  // 
  // SUB-MODULES INCLUDED:
  // 1. Employee Salary Details - Assign salary structures to employees
  // 2. Salary Component - Define earning/deduction/reimbursement components
  // 3. Salary Structure - Create and manage salary structure templates
  // 4. Pay Period - Configure pay period settings and schedules
  // 
  // WHY HIDE HR SETUP:
  // - Setup phase completed: Initial salary configuration is done
  // - Configuration locked: Prevent accidental changes to production salary structures
  // - Reduce complexity: Simplify UI for regular users who don't need setup access
  // - Security: Limit access to sensitive salary configuration
  // - Workflow control: Changes to salary structures should be controlled and planned
  // 
  // WHEN TO RE-ENABLE:
  // - Annual salary structure updates needed
  // - New salary components need to be added
  // - Pay period configuration changes required
  // - New salary structures need to be created
  // - Bulk salary assignment updates needed
  // 
  // TO RE-ENABLE:
  // Change 'hr-setup': true in this configuration
  // Save file and refresh browser
  // HR Setup will appear in sidebar, search, and all routes will be accessible
  // 
  // ROUTES AFFECTED:
  // All routes starting with /hr-setup/ will be blocked when hidden:
  // - /hr-setup/employee-salary (and /new, /:id)
  // - /hr-setup/salary-component (and /:tab, /:tab/new, /:tab/:id)
  // - /hr-setup/salary-structure (and /new, /:id)
  // - /hr-setup/pay-period
  // 
  // BUSINESS IMPACT:
  // When hidden:
  // - Users cannot modify salary structures
  // - Salary component changes are prevented
  // - Employee salary assignments cannot be changed
  // - Pay period settings are locked
  // 
  // When visible:
  // - Full access to salary configuration
  // - Can create/edit salary structures
  // - Can assign salaries to employees
  // - Can modify pay period settings
  // 
  // ============================================================================
  'hr-setup': false,           // HR Setup module - HIDDEN
  
  // Add more modules here as needed in the future
  // Example: 'accounting': false,
} as const;

/**
 * ============================================================================
 * DASHBOARD WIDGETS VISIBILITY CONFIGURATION
 * ============================================================================
 * 
 * PURPOSE:
 * Controls which dashboard widgets/cards should be visible or hidden.
 * This is separate from module visibility and allows fine-grained control
 * over individual dashboard components.
 * 
 * WHY SEPARATE FROM MODULES:
 * - Widgets can be hidden independently of modules
 * - A module can be visible but its dashboard widgets hidden
 * - Provides flexibility for customizing dashboard layout
 * - Allows hiding specific features without hiding entire modules
 * 
 * USAGE:
 * Use these flags in dashboard components to conditionally render widgets.
 * 
 * CURRENTLY HIDDEN WIDGETS (HR Dashboard):
 * - Open Positions card
 * - Recruitment Pipeline chart
 * - Pending Approvals section
 * 
 * TO RE-ENABLE: Change the value from false to true
 * 
 * ============================================================================
 */
export const HIDDEN_DASHBOARD_WIDGETS = {
  // HR Dashboard Widgets
  'hr-open-positions': false,      // Open Positions card - HIDDEN
  'hr-recruitment-pipeline': false, // Recruitment Pipeline chart - HIDDEN
  'hr-pending-approvals': false,   // Pending Approvals section - HIDDEN
  
  // Add more dashboard widgets here as needed
  // Example: 'inventory-low-stock': false,
} as const;

/**
 * CHECK IF A DASHBOARD WIDGET IS VISIBLE
 * 
 * PURPOSE:
 * Helper function to check if a dashboard widget should be visible.
 * 
 * PARAMETERS:
 * @param widgetKey - The widget identifier to check (from HIDDEN_DASHBOARD_WIDGETS)
 * 
 * RETURNS:
 * - true if widget should be visible
 * - false if widget should be hidden
 * 
 * USAGE EXAMPLES:
 * - isWidgetVisible('hr-open-positions') // returns false (hidden)
 * - isWidgetVisible('hr-attendance-trend') // returns true (not in config, defaults to visible)
 * 
 * HOW IT WORKS:
 * 1. Checks if widget key exists in HIDDEN_DASHBOARD_WIDGETS
 * 2. Returns the visibility status (true = visible, false = hidden)
 * 3. Defaults to visible (true) if widget not in config
 * 
 * WHY DEFAULT TO VISIBLE:
 * - New widgets are visible by default
 * - Only explicitly hidden widgets are affected
 * - Prevents accidentally hiding widgets not yet configured
 */
export function isWidgetVisible(widgetKey: string): boolean {
  // Check if this widget is in the hidden list
  if (widgetKey in HIDDEN_DASHBOARD_WIDGETS) {
    return HIDDEN_DASHBOARD_WIDGETS[widgetKey as keyof typeof HIDDEN_DASHBOARD_WIDGETS];
  }
  
  // Default: widget is visible
  return true;
}

/**
 * CHECK IF A MODULE IS VISIBLE
 * 
 * PURPOSE:
 * Helper function to check if a module should be visible in the UI.
 * 
 * PARAMETERS:
 * @param modulePath - The route path or module identifier to check
 * 
 * RETURNS:
 * - true if module should be visible
 * - false if module should be hidden
 * 
 * USAGE EXAMPLES:
 * - isModuleVisible('leave-management') // returns false (hidden)
 * - isModuleVisible('core-hr') // returns true (visible)
 * - isModuleVisible('/hrms/leave-management') // returns false (handles full paths)
 * - isModuleVisible('HRSetup') // returns false (handles camelCase module names)
 * 
 * HOW IT WORKS:
 * 1. Extracts the module key from the path
 * 2. Checks if it exists in HIDDEN_MODULES
 * 3. Returns the opposite of the hidden status (hidden=false means visible=true)
 * 4. Defaults to visible (true) if module not in config
 * 
 * SPECIAL HANDLING:
 * - Converts camelCase module names to kebab-case for matching
 * - Example: "HRSetup" -> "hr-setup" for matching against HIDDEN_MODULES
 * - This ensures sidebar module names match route-based keys
 */
export function isModuleVisible(modulePath: string): boolean {
  // Extract the last segment of the path for matching
  // Example: '/hrms/leave-management' -> 'leave-management'
  const pathSegments = modulePath.split('/').filter(Boolean);
  let moduleKey = pathSegments[pathSegments.length - 1];
  
  // ============================================================================
  // SPECIAL CASE: HANDLE CAMELCASE MODULE NAMES
  // ============================================================================
  // The sidebar uses camelCase module names (e.g., "HRSetup")
  // but HIDDEN_MODULES uses kebab-case route paths (e.g., "hr-setup")
  // We need to convert camelCase to kebab-case for matching
  // 
  // Examples:
  // - "HRSetup" -> "hr-setup"
  // - "LeaveManagement" -> "leave-management"
  // - "PayrollManagement" -> "payroll-management"
  // ============================================================================
  if (moduleKey === 'HRSetup') {
    moduleKey = 'hr-setup';
  }
  
  // Check if this module is in the hidden list
  // If not in the list, default to visible (true)
  if (moduleKey in HIDDEN_MODULES) {
    return HIDDEN_MODULES[moduleKey as keyof typeof HIDDEN_MODULES];
  }
  
  // Default: module is visible
  return true;
}

/**
 * CHECK IF A ROUTE PATH SHOULD BE BLOCKED
 * 
 * PURPOSE:
 * Determines if a route should be blocked and redirected to dashboard.
 * Used in route guards to prevent direct URL access to hidden modules.
 * 
 * PARAMETERS:
 * @param path - The full route path to check (e.g., '/hrms/leave-management')
 * 
 * RETURNS:
 * - true if the route should be blocked (module is hidden)
 * - false if the route is allowed (module is visible)
 * 
 * USAGE EXAMPLE:
 * if (shouldBlockRoute('/hrms/leave-management')) {
 *   // Redirect to dashboard
 * }
 * 
 * HOW IT WORKS:
 * 1. Checks each hidden module key against the path
 * 2. Returns true if path contains any hidden module identifier
 * 3. Returns false if path doesn't match any hidden modules
 */
export function shouldBlockRoute(path: string): boolean {
  // Check if the path contains any hidden module identifier
  return Object.entries(HIDDEN_MODULES).some(([key, isVisible]) => {
    // If module is hidden (false) and path contains the key
    return !isVisible && path.includes(key);
  });
}

/**
 * GET LIST OF HIDDEN MODULE PATHS
 * 
 * PURPOSE:
 * Returns an array of all hidden module identifiers.
 * Useful for filtering operations in sidebar, search, etc.
 * 
 * RETURNS:
 * Array of module keys that are currently hidden
 * Example: ['leave-management', 'payroll-management', 'ess']
 * 
 * USAGE EXAMPLE:
 * const hiddenModules = getHiddenModules();
 * const visibleItems = allItems.filter(item => 
 *   !hiddenModules.some(hidden => item.path.includes(hidden))
 * );
 */
export function getHiddenModules(): string[] {
  return Object.entries(HIDDEN_MODULES)
    .filter(([_, isVisible]) => !isVisible)
    .map(([key, _]) => key);
}

/**
 * FILTER VISIBLE SUB-ITEMS
 * 
 * PURPOSE:
 * Filters an array of sub-items to remove hidden modules.
 * Used in sidebar to filter out hidden sub-menu items.
 * 
 * PARAMETERS:
 * @param subItems - Array of sub-items with path property
 * 
 * RETURNS:
 * Filtered array containing only visible sub-items
 * 
 * USAGE EXAMPLE:
 * const visibleSubItems = filterVisibleSubItems([
 *   { name: "Core HR", path: "/hrms/core-hr" },
 *   { name: "Leave Management", path: "/hrms/leave-management" }, // filtered out
 * ]);
 */
export function filterVisibleSubItems<T extends { path: string }>(subItems: T[]): T[] {
  return subItems.filter(item => isModuleVisible(item.path));
}
