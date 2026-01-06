import { ReactNode, useState } from "react";
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

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "success" | "warning" | "info";
  timestamp: string;
  read: boolean;
}

interface SidebarProps {
  className?: string;
}

const Sidebar = ({ className }: SidebarProps) => {
  const [location] = useLocation();
  const { isModuleVisible } = useAuth();

  const moduleConfig: { [key: string]: { name: string; icon: any; path: string; subItems?: { name: string; path: string }[] } } = {
    "Dashboard": { name: "Dashboard", icon: LayoutDashboard, path: "/" },
    "Chat": { name: "Chat", icon: MessageSquare, path: "/chat" },
    "HRMS": { 
      name: "HRMS & Payroll", 
      icon: Users, 
      path: "/hrms",
      subItems: [
        { name: "Dashboard", path: "/hrms" },
        { name: "Mgmt & Attendance", path: "/hrms/management" },
        { name: "User Roles (RBAC)", path: "/hrms/roles" },
        { name: "Payroll Management", path: "/hrms/payroll" },
        { name: "Dept & Designations", path: "/hrms/departments" },
        { name: "Recruitment (ATS)", path: "/hrms/recruitment" },
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
  };

  const coreModules = ["Dashboard", "Chat", "HRMS", "Products", "Inventory", "Production", "Sales", "Purchases", "Customers"];
  const optionalModules = ["Accounting", "Logistics"];
  const systemModules = ["System"];

  const filterVisibleModules = (modules: string[]) => {
    return modules.filter(mod => isModuleVisible(mod)).map(mod => moduleConfig[mod]).filter(Boolean);
  };

  const visibleCoreModules = filterVisibleModules(coreModules);
  const visibleOptionalModules = filterVisibleModules(optionalModules);
  const visibleSystemModules = filterVisibleModules(systemModules);

  const menuItems = [
    ...(visibleCoreModules.length > 0 ? [{ title: "Core Modules", items: visibleCoreModules }] : []),
    ...(visibleOptionalModules.length > 0 ? [{ title: "Optional Modules", items: visibleOptionalModules }] : []),
    ...(visibleSystemModules.length > 0 ? [{ title: "System", items: [
      ...visibleSystemModules,
      { name: "My Account", icon: Users, path: "/my-account" }
    ]}] : [{ title: "System", items: [{ name: "My Account", icon: Users, path: "/my-account" }] }]),
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
                            className={`w-full justify-between gap-3 rounded-lg transition-all ${
                              (isActive || isSubItemActive)
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
                                  className={`w-full justify-start h-9 text-sm font-normal pl-8 ${
                                    isSubActive 
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
                        className={`w-full justify-start gap-3 rounded-lg transition-all ${
                          isActive
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

export default function MainLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: "1", title: "Order Confirmed", message: "Order #ORD-2024-891 has been confirmed", type: "success", timestamp: "2 mins ago", read: false },
    { id: "2", title: "Low Stock Alert", message: "White Sugar S-30 stock is below reorder level", type: "warning", timestamp: "15 mins ago", read: false },
    { id: "3", title: "Payment Received", message: "Payment of $45,000 from Global Exports received", type: "success", timestamp: "1 hour ago", read: true },
    { id: "4", title: "System Maintenance", message: "Scheduled maintenance on Dec 2, 2024 at 2:00 AM", type: "info", timestamp: "3 hours ago", read: true },
  ]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

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

  const handleLogout = async () => {
    logout();
    setLocation("/login");
  };

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

  const filteredModules = searchQuery
    ? modules.filter((m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="erp-layout flex h-screen w-full overflow-hidden bg-background">
      {/* FIXED LEFT SIDEBAR - Dark Blue #003C7A */}
      <div className="hidden lg:flex w-64 flex-shrink-0 bg-sidebar border-none">
        <Sidebar />
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="main-layout flex flex-col flex-1 h-screen overflow-hidden">
        {/* FIXED TOP NAVBAR - Blue #0056B8 */}
        <header className="topbar sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-primary px-6 shadow-md flex-shrink-0">
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

          <div className="flex items-center gap-4">
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

        {/* PAGE CONTENT - SCROLLS */}
        <main className="page-content flex-1 overflow-hidden bg-muted/30 p-6 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-auto">
            {children}
          </div>
        </main>

        {/* FOOTER - APPEARS AT END OF CONTENT */}
        <div className="flex-shrink-0">
          <Footer />
        </div>
      </div>
    </div>
  );
}
