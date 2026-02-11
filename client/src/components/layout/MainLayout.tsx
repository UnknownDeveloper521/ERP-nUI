/**
 * ============================================================================
 * MAIN LAYOUT COMPONENT
 * ============================================================================
 * 
 * This is the main application layout wrapper that provides:
 * - Fixed left sidebar with navigation
 * - Top header with search, notifications, and user menu
 * - Main content area with scrolling
 * - Footer at bottom
 * 
 * LAYOUT STRUCTURE:
 * - Desktop: Sidebar (left) + Header (top) + Content (center) + Footer (bottom)
 * - Mobile: Collapsible sidebar (sheet) + Header + Content + Footer
 * 
 * ============================================================================
 */

import { ReactNode, useState } from "react";
import * as React from "react";
import { Link, useLocation } from "wouter";
import { useAuth, MODULES_LIST } from "@/lib/store";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  CreditCard,
  Briefcase,
  MessageSquare,
  Settings,
  Menu,
  Bell,
  Search,
  LogOut,
  ChevronDown,
  Box,
  Truck,
  FileText,
  UserPlus,
  User,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import Footer from "./Footer";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Notification data structure
 * PURPOSE: Represents a single notification item
 * KEEP: Essential for notification feature
 */
interface Notification {
  id: string;
  title: string;
  message: string;
  type: "success" | "warning" | "info";
  timestamp: string;
  read: boolean;
}

/**
 * Sidebar component props
 * PURPOSE: Allows passing custom className for styling
 * KEEP: Essential for component flexibility
 */
interface SidebarProps {
  className?: string;
}

/**
 * ============================================================================
 * SIDEBAR COMPONENT
 * ============================================================================
 * 
 * PURPOSE: Left navigation sidebar with module links
 * 
 * FEATURES:
 * - Hierarchical navigation (Core, Optional, System modules)
 * - Collapsible sub-menus for modules with sub-items
 * - Active state highlighting
 * - Role-based module visibility
 * - User profile display at bottom
 * 
 * KEEP: Essential for application navigation
 * ============================================================================
 */
const Sidebar = ({ className }: SidebarProps) => {
  const [location] = useLocation();
  const { isModuleVisible } = useAuth();

  // ==========================================================================
  // MODULE CONFIGURATION
  // ==========================================================================
  // PURPOSE: Defines all available modules, their icons, paths, and sub-items
  // WHY NEEDED: Central configuration for navigation structure
  // KEEP: Essential for navigation - modify when adding/removing modules
  // ==========================================================================
  const moduleConfig: { [key: string]: { name: string; icon: any; path: string; subItems?: { name: string; path: string }[] } } = {
    "Dashboard": { name: "Dashboard", icon: LayoutDashboard, path: "/" },
    "Chat": { name: "Chat", icon: MessageSquare, path: "/chat" },
    "HRMS": {
      name: "HRMS & Payroll",
      icon: Users,
      path: "/hrms",
      subItems: [
        { name: "Dashboard", path: "/hrms" },
        { name: "Core HR", path: "/hrms/core-hr" },
        { name: "Attendance", path: "/hrms/attendance" },
        { name: "Leave Management", path: "/hrms/leave-management" },
        { name: "Payroll Management", path: "/hrms/payroll-management" },
        { name: "Self Service (ESS)", path: "/hrms/ess" },
      ]
    },
    "Products": { name: "Products & Items", icon: Box, path: "/products" },
    "Inventory": {
      name: "Inventory",
      icon: Package,
      path: "/inventory",
      subItems: [
        { name: "Dashboard", path: "/inventory" },
        { name: "RM Receipt", path: "/inventory/rm-receipt" },
        { name: "RM Issue", path: "/inventory/rm-issue" },
        { name: "RM Ledger", path: "/inventory/rm-ledger" },
        { name: "FG Stock", path: "/inventory/fg-stock" },
        { name: "Stock Adjustment", path: "/inventory/stock-adjustment" },
        { name: "Alerts & Thresholds", path: "/inventory/alerts" },
      ]
    },
    "Production": {
      name: "Production",
      icon: Briefcase,
      path: "/production",
      subItems: [
        { name: "Dashboard", path: "/production" },
        { name: "Production Entry", path: "/production/entry" },
        { name: "History", path: "/production/history" },
        { name: "Quality Check", path: "/production/quality" },
        { name: "Waste Tracking", path: "/production/waste" },
        { name: "Machine Performance", path: "/production/machines" },
        { name: "Shift Summary", path: "/production/shifts" },
      ]
    },
    "Sales": {
      name: "Sales & Invoicing",
      icon: ShoppingCart,
      path: "/sales-invoicing",
      subItems: [
        { name: "Dashboard", path: "/sales-invoicing" },
        { name: "Sales Order", path: "/sales-invoicing/orders" },
        { name: "Dispatch Note", path: "/sales-invoicing/dispatch" },
        { name: "Invoice", path: "/sales-invoicing/invoices" },
        { name: "Purchase Orders", path: "/sales-invoicing/purchases" },
        { name: "Reports", path: "/sales-invoicing/reports" },
      ]
    },
    "Purchases": { name: "Purchases & Vendors", icon: CreditCard, path: "/purchases" },
    "Customers": { name: "Customers (CRM)", icon: UserPlus, path: "/customers" },
    "Accounting": { name: "Accounting", icon: FileText, path: "/accounting" },
    "Logistics": { name: "Logistics", icon: Truck, path: "/logistics" },
    "System": { name: "Users & Roles", icon: Settings, path: "/settings" },
    "HRSetup": {
      name: "HR Setup",
      icon: Settings,
      path: "/hr-setup/employee-salary",
      subItems: [
        { name: "Employee Salary Details", path: "/hr-setup/employee-salary" },
        { name: "Salary Component", path: "/hr-setup/salary-component" },
        { name: "Salary Structure", path: "/hr-setup/salary-structure" },
        { name: "Pay Period", path: "/hr-setup/pay-period" },
      ]
    },
    "Masters": {
      name: "Masters",
      icon: Database, // Make sure to import this from lucide-react in the next step 
      path: "/masters",
      subItems: [
        { name: "HRMS", path: "/masters/hrms" },
      ]
    },
  };

  // ==========================================================================
  // MODULE CATEGORIZATION
  // ==========================================================================
  // PURPOSE: Groups modules into categories for sidebar organization
  // WHY NEEDED: Creates logical grouping in sidebar (Core, Optional, System)
  // KEEP: Essential for sidebar structure
  // ==========================================================================
  const coreModules = ["Dashboard", "Chat", "HRMS", "Products", "Inventory", "Production", "Sales", "Purchases", "Customers"];
  const optionalModules = ["Accounting", "Logistics"];
  const systemModules = ["System", "HRSetup", "Masters"];
  // ==========================================================================
  // ROLE-BASED FILTERING
  // ==========================================================================
  // PURPOSE: Filters modules based on user permissions
  // WHY NEEDED: Users should only see modules they have access to
  // KEEP: Essential for security and role-based access control
  // ==========================================================================
  const filterVisibleModules = (modules: string[]) => {
    return modules.filter(mod => isModuleVisible(mod)).map(mod => moduleConfig[mod]).filter(Boolean);
  };

  const visibleCoreModules = filterVisibleModules(coreModules);
  const visibleOptionalModules = filterVisibleModules(optionalModules);
  const visibleSystemModules = filterVisibleModules(systemModules);

  // ==========================================================================
  // MENU STRUCTURE
  // ==========================================================================
  // PURPOSE: Builds final menu structure with visible modules grouped by category
  // WHY NEEDED: Creates the hierarchical menu structure for rendering
  // KEEP: Essential for sidebar menu rendering
  // ==========================================================================
  const menuItems = [
    ...(visibleCoreModules.length > 0 ? [{ title: "Core Modules", items: visibleCoreModules }] : []),
    ...(visibleOptionalModules.length > 0 ? [{ title: "Optional Modules", items: visibleOptionalModules }] : []),
    ...(visibleSystemModules.length > 0 ? [{
      title: "System", items: [
        ...visibleSystemModules,
        { name: "My Account", icon: Users, path: "/my-account" }
      ]
    }] : [{ title: "System", items: [{ name: "My Account", icon: Users, path: "/my-account" }] }]),
  ];

  return (
    <div className={`flex h-full flex-col bg-sidebar text-sidebar-foreground ${className}`}>
      <div className="flex h-16 items-center border-b border-sidebar-border px-6 bg-sidebar">
        <img
          src="https://tassosconsultancy.com/wp-content/uploads/2025/11/TCS-LOGO-TRACED-PNG.webp"
          alt="Tassos ERP"
          className="h-8 w-auto object-contain brightness-0 invert"
        />
        <span className="ml-3 font-semibold text-lg hidden lg:block text-sidebar-foreground">ERP System</span>
      </div>
      <ScrollArea className="flex-1 px-4 py-4">
        <nav className="flex flex-col gap-4">
          {menuItems.map((group, index) => (
            <div key={index} className="flex flex-col gap-2">
              <h3 className="px-2 text-xs font-medium uppercase text-sidebar-foreground/70 tracking-wider">
                {group.title}
              </h3>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const isActive = location === item.path;
                  const hasSubItems = 'subItems' in item && item.subItems;
                  const isSubItemActive = hasSubItems && item.subItems?.some(sub => location === sub.path);

                  if (hasSubItems) {
                    return (
                      <Collapsible key={item.path} defaultOpen={isActive || isSubItemActive} className="w-full">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant={(isActive || isSubItemActive) ? "secondary" : "ghost"}
                            className={`w-full justify-between gap-3 rounded-lg transition-all ${(isActive || isSubItemActive)
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/20"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <item.icon className="h-4 w-4" />
                              <span className="truncate">{item.name}</span>
                            </div>
                            <ChevronDown className={`h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4 pt-1 space-y-1">
                          {item.subItems?.map((subItem) => {
                            const isSubActive = location === subItem.path;
                            return (
                              <Link key={subItem.path} href={subItem.path}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`w-full justify-start h-9 text-sm font-normal pl-8 ${isSubActive
                                    ? "text-sidebar-primary-foreground font-medium bg-sidebar-primary/10"
                                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/10"
                                    }`}
                                >
                                  {subItem.name}
                                </Button>
                              </Link>
                            )
                          })}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  }

                  return (
                    <Link key={item.path} href={item.path}>
                      <Button
                        variant={isActive ? "default" : "ghost"}
                        className={`w-full justify-start gap-3 rounded-lg transition-all ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground border-b-2 border-b-sidebar-accent"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/20"
                          }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="truncate">{item.name}</span>
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/20 p-3">
          <Avatar className="h-9 w-9 rounded-md">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-medium text-sidebar-foreground">Admin User</span>
            <span className="truncate text-xs text-sidebar-foreground/70">admin@tassos.com</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * MAIN LAYOUT COMPONENT
 * ============================================================================
 * 
 * PURPOSE: Wraps all application pages with consistent layout
 * 
 * FEATURES:
 * - Responsive design (desktop sidebar, mobile sheet)
 * - Global search functionality
 * - Notification system
 * - User profile menu
 * - Logout functionality
 * 
 * KEEP: Essential for application structure
 * ============================================================================
 */
export default function MainLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();

  // ==========================================================================
  // SEARCH STATE
  // ==========================================================================
  // PURPOSE: Stores search query for module/record search
  // WHY NEEDED: Allows users to quickly find and navigate to modules
  // KEEP: Essential for search functionality
  // ==========================================================================
  const [searchQuery, setSearchQuery] = useState("");

  // ==========================================================================
  // NOTIFICATION STATE
  // ==========================================================================
  // PURPOSE: Stores notification data and manages notification panel
  // WHY NEEDED: Displays system notifications to users
  // NOTE: In production, this will be replaced with real-time notifications from backend
  // KEEP: Essential for notification feature (replace with API later)
  // ==========================================================================
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: "1", title: "Order Confirmed", message: "Order #ORD-2024-891 has been confirmed", type: "success", timestamp: "2 mins ago", read: false },
    { id: "2", title: "Low Stock Alert", message: "White Sugar S-30 stock is below reorder level", type: "warning", timestamp: "15 mins ago", read: false },
    { id: "3", title: "Payment Received", message: "Payment of $45,000 from Global Exports received", type: "success", timestamp: "1 hour ago", read: true },
    { id: "4", title: "System Maintenance", message: "Scheduled maintenance on Dec 2, 2024 at 2:00 AM", type: "info", timestamp: "3 hours ago", read: true },
  ]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  // ==========================================================================
  // WHITE CARET FIX FOR SEARCH INPUT
  // ==========================================================================
  // PURPOSE: Forces search input caret to be white (visible on blue background)
  // WHY NEEDED: Default caret color is black, invisible on dark blue header
  // HOW IT WORKS: Uses JavaScript to override CSS and maintain white caret
  // KEEP: Essential for search input usability
  // NOTE: This is a workaround - ideally should be fixed in CSS
  // ==========================================================================
  React.useEffect(() => {
    const forceWhiteCaret = () => {
      const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="Search"]');
      searchInputs.forEach((input: any) => {
        if (input) {
          input.style.caretColor = '#ffffff';
          input.style.setProperty('caret-color', '#ffffff', 'important');
          input.style.setProperty('-webkit-caret-color', '#ffffff', 'important');
          input.style.color = '#ffffff';
          input.style.setProperty('color', '#ffffff', 'important');

          // Add event listeners to maintain white caret
          input.addEventListener('focus', () => {
            input.style.caretColor = '#ffffff';
            input.style.setProperty('caret-color', '#ffffff', 'important');
            input.style.setProperty('-webkit-caret-color', '#ffffff', 'important');
          });

          input.addEventListener('click', () => {
            input.style.caretColor = '#ffffff';
            input.style.setProperty('caret-color', '#ffffff', 'important');
            input.style.setProperty('-webkit-caret-color', '#ffffff', 'important');
          });

          input.addEventListener('input', () => {
            input.style.caretColor = '#ffffff';
            input.style.setProperty('caret-color', '#ffffff', 'important');
            input.style.setProperty('-webkit-caret-color', '#ffffff', 'important');
          });
        }
      });
    };

    // Run immediately and with delays to catch dynamically loaded inputs
    forceWhiteCaret();

    // Run after a delay to catch dynamically loaded inputs
    setTimeout(forceWhiteCaret, 100);
    setTimeout(forceWhiteCaret, 500);
    setTimeout(forceWhiteCaret, 1000);

    // Set up observer for new inputs
    const observer = new MutationObserver(forceWhiteCaret);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  // ==========================================================================
  // NOTIFICATION HANDLERS
  // ==========================================================================
  // PURPOSE: Functions to manage notification state (mark read, clear, etc.)
  // WHY NEEDED: User interactions with notification panel
  // KEEP: Essential for notification feature
  // ==========================================================================
  const handleMarkAsRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const handleClearNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  // ==========================================================================
  // LOGOUT HANDLER
  // ==========================================================================
  // PURPOSE: Logs out user and redirects to login page
  // WHY NEEDED: User needs ability to log out
  // KEEP: Essential for authentication flow
  // ==========================================================================
  const handleLogout = async () => {
    logout();
    setLocation("/login");
  };

  // ==========================================================================
  // MODULE SEARCH DATA
  // ==========================================================================
  // PURPOSE: List of searchable modules for quick navigation
  // WHY NEEDED: Powers the search functionality in header
  // NOTE: Should match moduleConfig in Sidebar
  // KEEP: Essential for search feature
  // ==========================================================================
  const modules = [
    { name: "Dashboard", path: "/" },
    { name: "HRMS", path: "/hrms" },
    { name: "Products", path: "/products" },
    { name: "Inventory", path: "/inventory" },
    { name: "Sales", path: "/sales" },
    { name: "Purchases", path: "/purchases" },
    { name: "Customers", path: "/customers" },
    { name: "CRM", path: "/crm" },
    { name: "Accounting", path: "/accounting" },
    { name: "Logistics", path: "/logistics" },
    { name: "Performance", path: "/performance" },
    { name: "Settings", path: "/settings" },
    { name: "My Account", path: "/my-account" },
  ];

  // ==========================================================================
  // SEARCH FILTERING
  // ==========================================================================
  // PURPOSE: Filters modules based on search query
  // WHY NEEDED: Shows matching modules in dropdown as user types
  // KEEP: Essential for search functionality
  // ==========================================================================
  const filteredModules = searchQuery
    ? modules.filter((m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : [];

  return (
    <div className="erp-layout flex h-screen w-full overflow-hidden bg-background">
      {/* ====================================================================
           FIXED LEFT SIDEBAR - Desktop Only
           ====================================================================
           PURPOSE: Navigation sidebar visible on desktop (lg breakpoint+)
           WHY HIDDEN ON MOBILE: Mobile uses Sheet (slide-out) instead
           KEEP: Essential for desktop navigation
           ==================================================================== */}
      <div className="hidden lg:flex w-64 flex-shrink-0 bg-sidebar border-none">
        <Sidebar />
      </div>

      {/* ====================================================================
           MAIN CONTENT AREA
           ====================================================================
           PURPOSE: Contains header, page content, and footer
           LAYOUT: Flexbox column with header/footer fixed, content scrollable
           KEEP: Essential for page structure
           ==================================================================== */}
      <div className="main-layout flex flex-col flex-1 h-screen overflow-hidden">
        {/* ==================================================================
             FIXED TOP NAVBAR
             ==================================================================
             PURPOSE: Global header with search, notifications, user menu
             FEATURES:
             - Mobile: Hamburger menu to open sidebar sheet
             - Desktop: Search bar, notifications, user profile
             KEEP: Essential for global navigation and actions
             ================================================================== */}
        <header className="topbar sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-primary px-6 shadow-md flex-shrink-0">
          {/* ================================================================
               MOBILE MENU BUTTON & LOGO
               ================================================================
               PURPOSE: Shows hamburger menu and logo on mobile devices
               WHY NEEDED: Mobile doesn't have fixed sidebar
               KEEP: Essential for mobile navigation
               ================================================================ */}
          <div className="flex items-center gap-4 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2 text-primary-foreground hover:bg-primary-foreground/20">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <Sidebar />
              </SheetContent>
            </Sheet>
            <img
              src="https://tassosconsultancy.com/wp-content/uploads/2025/11/TCS-LOGO-TRACED-PNG.webp"
              alt="Tassos ERP"
              className="h-6 w-auto brightness-0 invert"
            />
          </div>

          {/* ================================================================
               SEARCH BAR
               ================================================================
               PURPOSE: Global search for modules and records
               WHY HIDDEN ON MOBILE: Limited space on mobile header
               KEEP: Essential for quick navigation
               ================================================================ */}
          <div className="flex flex-1 items-center gap-4 px-4 md:px-8">
            <div className="relative w-full max-w-sm hidden md:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-primary-foreground/70" />
              <Input
                type="search"
                placeholder="Search modules, records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-primary-foreground/20 pl-9 md:w-[300px] lg:w-[400px] text-primary-foreground placeholder:text-primary-foreground/50 border-primary-foreground/20"
              />
              {/* Search Results Dropdown */}
              {searchQuery && filteredModules.length > 0 && (
                <div className="absolute top-full left-0 mt-2 w-full bg-white border rounded-lg shadow-lg z-50">
                  {filteredModules.map((module) => (
                    <Link key={module.path} href={module.path}>
                      <div
                        className="px-4 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                        onClick={() => setSearchQuery("")}
                      >
                        {module.name}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ================================================================
               HEADER RIGHT SECTION
               ================================================================
               PURPOSE: Notifications bell and user profile menu
               KEEP: Essential for user interactions
               ================================================================ */}
          <div className="flex items-center gap-4">
            {/* ==============================================================
                 NOTIFICATIONS DROPDOWN
                 ==============================================================
                 PURPOSE: Shows notification panel with unread count badge
                 FEATURES:
                 - Unread count badge
                 - Mark as read/clear functionality
                 - Different icons for success/warning/info
                 KEEP: Essential for notification system
                 ============================================================== */}
            <DropdownMenu open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-primary-foreground hover:bg-primary-foreground/20" data-testid="button-notifications">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <>
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-destructive text-xs" data-testid="badge-unread-count">{unreadCount}</Badge>
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-96 max-h-[500px]">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <DropdownMenuLabel className="m-0">Notifications</DropdownMenuLabel>
                  <div className="flex gap-2">
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={handleMarkAllAsRead}
                        data-testid="button-mark-all-read"
                      >
                        Mark all read
                      </Button>
                    )}
                    {notifications.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-destructive"
                        onClick={handleClearAll}
                        data-testid="button-clear-all"
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                </div>

                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Bell className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No notifications</p>
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="space-y-1 p-1">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors ${!notification.read ? "bg-blue-50/50" : ""}`}
                          onClick={() => handleMarkAsRead(notification.id)}
                          data-testid={`notification-item-${notification.id}`}
                        >
                          <div className="pt-1">
                            {notification.type === "success" && <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />}
                            {notification.type === "warning" && <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />}
                            {notification.type === "info" && <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className={`text-sm font-medium truncate ${!notification.read ? "font-semibold" : ""}`}>
                                  {notification.title}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">{notification.timestamp}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0 -mt-1 -mr-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClearNotification(notification.id);
                                }}
                                data-testid={`button-close-notification-${notification.id}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {!notification.read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ==============================================================
                 USER PROFILE DROPDOWN
                 ==============================================================
                 PURPOSE: User menu with profile, settings, logout
                 KEEP: Essential for user account management
                 ============================================================== */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-0 hover:bg-primary-foreground/20 text-primary-foreground">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>AD</AvatarFallback>
                  </Avatar>
                  <div className="hidden flex-col items-start text-sm md:flex">
                    <span className="font-medium">Admin User</span>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/my-account">
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                </Link>
                <Link href="/settings">
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ==================================================================
             PAGE CONTENT - SCROLLABLE AREA
             ==================================================================
             PURPOSE: Main content area where page components render
             LAYOUT: Flexbox with overflow-auto for scrolling
             KEEP: Essential for page content rendering
             ================================================================== */}
        <main className="page-content flex-1 overflow-hidden bg-muted/30 p-6 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-auto">
            {children}
          </div>
        </main>

        {/* ==================================================================
             FOOTER - FIXED AT BOTTOM
             ==================================================================
             PURPOSE: Application footer with copyright, links, etc.
             KEEP: Essential for footer content
             ================================================================== */}
        <div className="flex-shrink-0">
          <Footer />
        </div>
      </div>
    </div>
  );
}
