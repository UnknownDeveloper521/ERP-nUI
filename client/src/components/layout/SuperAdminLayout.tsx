import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
    LayoutDashboard,
    Building,
    Briefcase,
    LogOut,
    Menu,
    ChevronDown,
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import Footer from "./Footer";

interface SidebarProps {
    className?: string;
}

const Sidebar = ({ className }: SidebarProps) => {
    const [location] = useLocation();

    const menuItems = [
        { name: "Dashboard", icon: LayoutDashboard, path: "/super-admin" },
        { name: "Tenants", icon: Building, path: "/super-admin/tenants" },
        { name: "Companies", icon: Briefcase, path: "/super-admin/companies" },
    ];

    return (
        <div className={`flex h-full flex-col bg-slate-900 text-slate-50 ${className}`}>
            <div className="flex h-16 items-center border-b border-slate-800 px-6 bg-slate-900">
                <img
                    src="https://tassosconsultancy.com/wp-content/uploads/2025/11/TCS-LOGO-TRACED-PNG.webp"
                    alt="Tassos Super Admin"
                    className="h-8 w-auto object-contain brightness-0 invert"
                />
                <span className="ml-3 font-semibold text-lg hidden lg:block text-slate-100">Super Admin</span>
            </div>
            <ScrollArea className="flex-1 px-4 py-4">
                <nav className="flex flex-col gap-2">
                    {menuItems.map((item) => {
                        const isActive = location === item.path;
                        return (
                            <Link key={item.path} href={item.path}>
                                <Button
                                    variant={isActive ? "default" : "ghost"}
                                    className={`w-full justify-start gap-3 rounded-lg transition-all ${isActive
                                            ? "bg-blue-600 text-white hover:bg-blue-700"
                                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                        }`}
                                >
                                    <item.icon className="h-4 w-4" />
                                    <span className="truncate">{item.name}</span>
                                </Button>
                            </Link>
                        );
                    })}
                </nav>
            </ScrollArea>
            <div className="border-t border-slate-800 p-4">
                <div className="flex items-center gap-3 rounded-lg bg-slate-800 p-3">
                    <Avatar className="h-9 w-9 rounded-md">
                        <AvatarImage src="" /> {/* Placeholder */}
                        <AvatarFallback className="bg-blue-600 text-white">SA</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-medium text-slate-100">Super Admin</span>
                        <span className="truncate text-xs text-slate-400">admin@super.com</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
    const [, setLocation] = useLocation();

    const handleLogout = () => {
        // Mock logout
        setLocation("/super-admin/login");
    };

    return (
        <div className="erp-layout flex h-screen w-full overflow-hidden bg-slate-50">
            {/* FIXED LEFT SIDEBAR */}
            <div className="hidden lg:flex w-64 flex-shrink-0 border-r bg-slate-900">
                <Sidebar />
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="main-layout flex flex-col flex-1 h-screen overflow-hidden">
                {/* FIXED TOP NAVBAR */}
                <header className="topbar sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm flex-shrink-0">
                    <div className="flex items-center gap-4 lg:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="-ml-2">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-64 bg-slate-900 border-r-slate-800">
                                <Sidebar />
                            </SheetContent>
                        </Sheet>
                        <span className="font-semibold">Super Admin Portal</span>
                    </div>

                    <div className="flex-1"></div> {/* Spacer */}

                    <div className="flex items-center gap-4">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="gap-2 pl-0">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-blue-600 text-white">SA</AvatarFallback>
                                    </Avatar>
                                    <div className="hidden flex-col items-start text-sm md:flex">
                                        <span className="font-medium">Super Admin</span>
                                    </div>
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>My Account</DropdownMenuLabel>
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

                {/* PAGE CONTENT */}
                <main className="page-content flex-1 overflow-hidden bg-slate-50 p-6 flex flex-col min-h-0">
                    <div className="flex-1 min-h-0 overflow-auto">
                        {children}
                    </div>
                </main>

                <div className="flex-shrink-0 bg-white border-t">
                    <Footer />
                </div>
            </div>
        </div>
    );
}
