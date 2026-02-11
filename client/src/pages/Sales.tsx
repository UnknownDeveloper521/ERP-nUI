import React, { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Search,
    Plus,
    FileText,
    Truck,
    CheckCircle,
    Clock,
    DollarSign,
    BarChart3,
    Users,
    Scale,
    FileCheck,
    AlertCircle,
    Download,
    Filter,
    Eye,
    Printer
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from "recharts";

// --- Mock Data ---

const mockCustomers = [
    { id: "CUST-001", name: "Sweet Treats Ltd", type: "Industrial", creditLimit: 5000000, currentBalance: 1200000, status: "Active" },
    { id: "CUST-002", name: "Global Exports Inc", type: "Export", creditLimit: 20000000, currentBalance: 4500000, status: "Active" },
    { id: "CUST-003", name: "Local Distributor A", type: "Wholesale", creditLimit: 1000000, currentBalance: 80000, status: "Active" },
    { id: "CUST-004", name: "BioFuel Corp", type: "Industrial", creditLimit: 3000000, currentBalance: 2900000, status: "Warning" },
];

const initialOrders = [
    { id: "SO-2024-001", date: "2024-11-26", customer: "Sweet Treats Ltd", item: "White Sugar S-30", quantity: 1000, unit: "Qtl", amount: 3400000, status: "Approved", dispatchStatus: "Pending" },
    { id: "SO-2024-002", date: "2024-11-25", customer: "Global Exports Inc", item: "Raw Sugar", quantity: 500, unit: "MT", amount: 15000000, status: "Processing", dispatchStatus: "Not Started" },
    { id: "SO-2024-003", date: "2024-11-24", customer: "BioFuel Corp", item: "Molasses", quantity: 200, unit: "MT", amount: 2400000, status: "Approved", dispatchStatus: "Partial" },
    { id: "SO-2024-004", date: "2024-11-23", customer: "Local Distributor A", item: "White Sugar M-30", quantity: 50, unit: "Qtl", amount: 180000, status: "Completed", dispatchStatus: "Completed" },
];

const initialDispatches = [
    { id: "DO-1001", date: "2024-11-26", orderId: "SO-2024-001", vehicle: "MH-12-GT-4545", driver: "Ramesh Kumar", item: "White Sugar S-30", grossWeight: 45.5, tareWeight: 15.2, netWeight: 30.3, status: "At Weighbridge" },
    { id: "DO-1002", date: "2024-11-26", orderId: "SO-2024-003", vehicle: "KA-01-AB-9988", driver: "Suresh Singh", item: "Molasses", grossWeight: 38.0, tareWeight: 14.0, netWeight: 24.0, status: "Dispatched" },
];

const salesTrendData = [
    { month: "Jun", sugar: 400, molasses: 240 },
    { month: "Jul", sugar: 300, molasses: 139 },
    { month: "Aug", sugar: 200, molasses: 980 },
    { month: "Sep", sugar: 278, molasses: 390 },
    { month: "Oct", sugar: 189, molasses: 480 },
    { month: "Nov", sugar: 239, molasses: 380 },
];

const productMixData = [
    { name: "White Sugar S-30", value: 45 },
    { name: "White Sugar M-30", value: 25 },
    { name: "Molasses", value: 20 },
    { name: "Bagasse", value: 10 },
];

const vehicles = [
    { id: "v1", reg: "MH-12-GT-4545", type: "Truck (10 Tyres)", emptyWeight: 15.2 },
    { id: "v2", reg: "KA-01-AB-9988", type: "Tanker", emptyWeight: 14.0 },
    { id: "v3", reg: "MH-14-XX-1234", type: "Tractor Trailer", emptyWeight: 6.5 },
    { id: "v4", reg: "GJ-05-ZZ-5678", type: "Truck (12 Tyres)", emptyWeight: 18.5 },
];

const contracts = [
    { id: "CNT-001", customer: "Sweet Treats Ltd", product: "White Sugar S-30", quantity: 5000, unit: "Qtl", rate: 3400, validFrom: "2024-11-01", validTo: "2025-04-30", status: "Active", terms: "30 days net" },
    { id: "CNT-002", customer: "Global Exports Inc", product: "Raw Sugar", quantity: 10000, unit: "MT", rate: 30000, validFrom: "2024-10-15", validTo: "2025-06-30", status: "Active", terms: "45 days net, 2% early payment" },
    { id: "CNT-003", customer: "BioFuel Corp", product: "Molasses", quantity: 1000, unit: "MT", rate: 12000, validFrom: "2024-12-01", validTo: "2025-03-31", status: "Active", terms: "Immediate payment" },
    { id: "CNT-004", customer: "Local Distributor A", product: "White Sugar M-30", quantity: 500, unit: "Qtl", rate: 3500, validFrom: "2025-01-01", validTo: "2025-12-31", status: "Pending", terms: "Net 15 days" },
];

const pricingHistory = [
    { date: "2024-11-26", product: "White Sugar S-30", price: 3400, change: "+2.5%", status: "Current" },
    { date: "2024-11-20", product: "White Sugar S-30", price: 3315, change: "-1.2%", status: "Previous" },
    { date: "2024-11-15", product: "Molasses", price: 12000, change: "+0%", status: "Stable" },
    { date: "2024-11-10", product: "Raw Sugar", price: 30000, change: "-0.5%", status: "Previous" },
];

const COLORS = ['hsl(var(--primary))', '#00C49F', '#FFBB28', '#FF8042'];

export default function Sales() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("dashboard");

    // --- State for Sales Orders ---
    const [orders, setOrders] = useState<typeof initialOrders>(() => {
        const saved = localStorage.getItem("sales_orders");
        return saved ? JSON.parse(saved) : initialOrders;
    });

    // Persist Orders
    useEffect(() => {
        localStorage.setItem("sales_orders", JSON.stringify(orders));
    }, [orders]);

    const [orderSearchTerm, setOrderSearchTerm] = useState("");
    const [orderStatusFilter, setOrderStatusFilter] = useState("All");
    const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<typeof initialOrders[0] | null>(null);
    const [isViewOrderOpen, setIsViewOrderOpen] = useState(false);

    // New Order Form State
    const [newOrderCustomer, setNewOrderCustomer] = useState("");
    const [newOrderProduct, setNewOrderProduct] = useState("");
    const [newOrderQuantity, setNewOrderQuantity] = useState("");
    const [newOrderStatus, setNewOrderStatus] = useState("Approved");
    const [newOrderDispatchStatus, setNewOrderDispatchStatus] = useState("Pending");

    // --- State for Weighbridge ---
    const [dispatches, setDispatches] = useState<typeof initialDispatches>(() => {
        const saved = localStorage.getItem("sales_dispatches");
        return saved ? JSON.parse(saved) : initialDispatches;
    });

    // Persist Dispatches
    useEffect(() => {
        localStorage.setItem("sales_dispatches", JSON.stringify(dispatches));
    }, [dispatches]);

    const [isCreateDOOpen, setIsCreateDOOpen] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState<string>("");
    const [currentWeight, setCurrentWeight] = useState("0.000");

    // Create DO Form State
    const [newDOOrder, setNewDOOrder] = useState("");
    const [newDOVehicle, setNewDOVehicle] = useState("");
    const [newDODriver, setNewDODriver] = useState("");

    // --- State for Invoicing ---
    const [isGenerateInvoiceOpen, setIsGenerateInvoiceOpen] = useState(false);

    // --- State for Reports ---
    const [previewReport, setPreviewReport] = useState<string | null>(null);
    const [isPreviewReportOpen, setIsPreviewReportOpen] = useState(false);

    // --- State for Sales Policy ---
    const [isSalesPolicyOpen, setIsSalesPolicyOpen] = useState(false);

    // --- State for Contracts & Pricing ---
    const [allContracts, setAllContracts] = useState(contracts);
    const [isNewContractOpen, setIsNewContractOpen] = useState(false);
    const [isUpdatePricesOpen, setIsUpdatePricesOpen] = useState(false);
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

    // New Contract Form State
    const [newContractCustomer, setNewContractCustomer] = useState("");
    const [newContractProduct, setNewContractProduct] = useState("");
    const [newContractQuantity, setNewContractQuantity] = useState("");
    const [newContractRate, setNewContractRate] = useState("");
    const [newContractValidFrom, setNewContractValidFrom] = useState("");
    const [newContractValidTo, setNewContractValidTo] = useState("");
    const [newContractTerms, setNewContractTerms] = useState("30 days net");

    // Update Pricing Form State
    const [updatePriceProduct, setUpdatePriceProduct] = useState("White Sugar S-30");
    const [updatePriceValue, setUpdatePriceValue] = useState("3400");
    const [updatePriceReason, setUpdatePriceReason] = useState("");

    // --- Handlers ---

    const handleVehicleChange = (vehicleId: string) => {
        if (vehicleId === "clear_scale") {
            setSelectedVehicle("");
            setCurrentWeight("0.000");
            return;
        }
        if (vehicleId === "manual_input") {
            setSelectedVehicle("manual_input");
            setCurrentWeight("0.000");
            return;
        }
        setSelectedVehicle(vehicleId);
        const vehicle = vehicles.find(v => v.id === vehicleId);
        if (vehicle) {
            // Simulate a loaded weight (Empty + random load)
            const load = Math.floor(Math.random() * 20) + 10;
            setCurrentWeight((vehicle.emptyWeight + load).toFixed(3));
        } else {
            setCurrentWeight("0.000");
        }
    };

    const handleDispatchRowClick = (dispatch: typeof initialDispatches[0]) => {
        // Find vehicle by registration number
        const vehicle = vehicles.find(v => v.reg === dispatch.vehicle);
        if (vehicle) {
            setSelectedVehicle(vehicle.id);
        }
        setCurrentWeight(dispatch.grossWeight.toFixed(3));
    };

    const handleViewOrder = (order: typeof initialOrders[0]) => {
        setSelectedOrder(order);
        setIsViewOrderOpen(true);
    };

    const handleCreateOrder = () => {
        // VALIDATION: Check all required fields
        if (!newOrderCustomer || !newOrderCustomer.trim()) {
            toast({
                title: "Error",
                description: "Please select a customer",
                variant: "destructive"
            });
            return;
        }

        if (!newOrderProduct || !newOrderProduct.trim()) {
            toast({
                title: "Error",
                description: "Please select a product",
                variant: "destructive"
            });
            return;
        }

        const quantity = Number(newOrderQuantity) || 0;
        if (quantity <= 0) {
            toast({
                title: "Error",
                description: "Please enter a valid quantity (greater than 0)",
                variant: "destructive"
            });
            return;
        }

        const amount = quantity * 3400; // Assuming static price for now

        const newOrder = {
            id: `SO-2024-${Math.floor(100 + Math.random() * 900)}`,
            date: new Date().toISOString().split('T')[0],
            customer: mockCustomers.find(c => c.id === newOrderCustomer)?.name || "Unknown Customer",
            item: newOrderProduct === "p1" ? "White Sugar S-30" : newOrderProduct === "p2" ? "White Sugar M-30" : "Molasses",
            quantity: quantity,
            unit: "Qtl",
            amount: amount,
            status: newOrderStatus,
            dispatchStatus: newOrderDispatchStatus
        };
        setOrders([newOrder, ...orders]);
        setIsNewOrderOpen(false);
        // Reset form
        setNewOrderCustomer("");
        setNewOrderProduct("");
        setNewOrderQuantity("");
        setNewOrderStatus("Approved");
        setNewOrderDispatchStatus("Pending");

        // Show success message
        toast({
            title: "Success",
            description: `Sales Order ${newOrder.id} created successfully!`
        });
    };

    const handleCaptureWeight = () => {
        if (!selectedVehicle) return;

        // Find the vehicle registration
        const vehicle = vehicles.find(v => v.id === selectedVehicle);
        if (!vehicle) return;

        // Find an active dispatch for this vehicle
        const dispatchIndex = dispatches.findIndex(d => d.vehicle === vehicle.reg && d.status === "At Weighbridge");

        if (dispatchIndex !== -1) {
            const updatedDispatches = [...dispatches];
            const dispatch = updatedDispatches[dispatchIndex];

            // Update weights - assume gross if tare is set or based on flow. 
            // For simplicity, let's just update grossWeight if it's the first step
            // Or maybe just update the 'grossWeight' to match current simulated weight
            // But wait, currentWeight is string "0.000"

            updatedDispatches[dispatchIndex] = {
                ...dispatch,
                grossWeight: parseFloat(currentWeight),
                status: "Weighment Done" // Move to next status
            };
            setDispatches(updatedDispatches);
            alert(`Weight captured for DO ${dispatch.id}: ${currentWeight} MT`);
        } else {
            alert(`Weight captured: ${currentWeight} MT. No active DO found for vehicle ${vehicle.reg} at weighbridge.`);
        }
    };

    const handleCreateDO = () => {
        // VALIDATION: Check all required fields
        if (!newDOOrder || !newDOOrder.trim()) {
            toast({
                title: "Error",
                description: "Please select a sales order",
                variant: "destructive"
            });
            return;
        }

        if (!newDOVehicle || !newDOVehicle.trim()) {
            toast({
                title: "Error",
                description: "Please enter vehicle number/registration",
                variant: "destructive"
            });
            return;
        }

        if (!newDODriver || !newDODriver.trim()) {
            toast({
                title: "Error",
                description: "Please enter driver name",
                variant: "destructive"
            });
            return;
        }

        const relatedOrder = orders.find(o => o.id === newDOOrder);
        const newDispatch = {
            id: `DO-${Math.floor(2000 + Math.random() * 1000)}`,
            date: new Date().toISOString().split('T')[0],
            orderId: newDOOrder,
            vehicle: newDOVehicle,
            driver: newDODriver,
            item: relatedOrder?.item || "Sugar",
            grossWeight: 0,
            tareWeight: 0,
            netWeight: 0,
            status: "Planned"
        };
        setDispatches([newDispatch, ...dispatches]);
        setIsCreateDOOpen(false);
        // Reset form
        setNewDOOrder("");
        setNewDOVehicle("");
        setNewDODriver("");

        // Show success message with persistence confirmation
        toast({
            title: "Success",
            description: `Delivery Order ${newDispatch.id} created and saved successfully!`
        });
    };

    const handlePreviewReport = (reportName: string) => {
        setPreviewReport(reportName);
        setIsPreviewReportOpen(true);
    };

    // Contracts & Pricing Handlers
    const handleCreateContract = () => {
        if (!newContractCustomer || !newContractProduct || !newContractQuantity || !newContractRate) {
            toast({
                title: "Error",
                description: "Please fill all required fields",
                variant: "destructive"
            });
            return;
        }

        const newContract = {
            id: `CNT-${String(allContracts.length + 1).padStart(3, '0')}`,
            customer: mockCustomers.find(c => c.id === newContractCustomer)?.name || newContractCustomer,
            product: newContractProduct,
            quantity: parseInt(newContractQuantity),
            unit: "Qtl",
            rate: parseInt(newContractRate),
            validFrom: newContractValidFrom,
            validTo: newContractValidTo,
            status: "Active",
            terms: newContractTerms
        };

        setAllContracts([...allContracts, newContract]);
        setIsNewContractOpen(false);
        setNewContractCustomer("");
        setNewContractProduct("");
        setNewContractQuantity("");
        setNewContractRate("");
        setNewContractValidFrom("");
        setNewContractValidTo("");
        setNewContractTerms("30 days net");

        toast({
            title: "Success",
            description: `Contract ${newContract.id} created successfully!`
        });
    };

    const handleUpdatePrices = () => {
        if (!updatePriceValue) {
            toast({
                title: "Error",
                description: "Please enter a price value",
                variant: "destructive"
            });
            return;
        }

        toast({
            title: "Success",
            description: `Price for ${updatePriceProduct} updated to $${updatePriceValue}. Change reason: ${updatePriceReason || 'Market adjustment'}`
        });

        setIsUpdatePricesOpen(false);
        setUpdatePriceValue("");
        setUpdatePriceReason("");
    };

    const handleViewAnalysis = () => {
        setIsAnalysisOpen(true);
    };

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            order.customer.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
            order.id.toLowerCase().includes(orderSearchTerm.toLowerCase());

        const matchesStatus = orderStatusFilter === "All" || order.status === orderStatusFilter;

        return matchesSearch && matchesStatus;
    });


    // --- Components ---

    const StatusBadge = ({ status }: { status: string }) => {
        let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
        let className = "";

        switch (status) {
            case "Approved":
            case "Completed":
            case "Active":
            case "Paid":
            case "Dispatched":
                variant = "outline";
                className = "bg-emerald-50 text-emerald-700 border-emerald-200";
                break;
            case "Pending":
            case "Processing":
            case "At Weighbridge":
                variant = "outline";
                className = "bg-blue-50 text-blue-700 border-blue-200";
                break;
            case "Warning":
            case "Overdue":
            case "Rejected":
                variant = "outline";
                className = "bg-rose-50 text-rose-700 border-rose-200";
                break;
            default:
                className = "bg-gray-50 text-gray-700 border-gray-200";
        }

        return <Badge variant={variant} className={className}>{status}</Badge>;
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Sales ERP</h1>
                    <p className="text-muted-foreground">
                        Integrated sales management for sugar & by-products
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setIsSalesPolicyOpen(true)}>
                        <FileText className="h-4 w-4" /> Sales Policy
                    </Button>
                    <Button onClick={() => setIsNewOrderOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" /> New Order
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="orders">Sales Orders</TabsTrigger>
                    <TabsTrigger value="dispatch">Weighbridge & Dispatch</TabsTrigger>
                    <TabsTrigger value="invoices">Invoicing & GST</TabsTrigger>
                    <TabsTrigger value="contracts">Contracts & Pricing</TabsTrigger>
                    <TabsTrigger value="receivables">Receivables</TabsTrigger>
                    <TabsTrigger value="reports">MIS Reports</TabsTrigger>
                </TabsList>

                {/* --- DASHBOARD TAB --- */}
                <TabsContent value="dashboard" className="space-y-6 mt-6">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Sales (Nov)</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">$2.45M</div>
                                <p className="text-xs text-muted-foreground text-emerald-600 flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" /> +15% vs last month
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Pending Dispatch</CardTitle>
                                <Truck className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">450 MT</div>
                                <p className="text-xs text-muted-foreground">
                                    Across 5 active orders
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Receivables</CardTitle>
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">$852K</div>
                                <p className="text-xs text-muted-foreground text-rose-600">
                                    $120K Overdue (&gt;45 days)
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
                                <FileCheck className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">12</div>
                                <p className="text-xs text-muted-foreground">
                                    Expiring soon: 2
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle>Sales Trend</CardTitle>
                                <CardDescription>Sugar vs Molasses Sales (Last 6 Months)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={salesTrendData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)", padding: "12px 16px" }} labelStyle={{ color: "#1f2937", fontSize: "12px", fontWeight: "500" }} />
                                            <Bar dataKey="sugar" name="Sugar (MT)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="molasses" name="Molasses (MT)" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle>Product Mix</CardTitle>
                                <CardDescription>Revenue share by product type</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full flex justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={productMixData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {productMixData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-wrap justify-center gap-4 text-sm mt-4">
                                    {productMixData.map((entry, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                            <span>{entry.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- SALES ORDERS TAB --- */}
                <TabsContent value="orders" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Sales Order Management</CardTitle>
                                    <CardDescription>Manage orders, approvals, and status tracking</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="search"
                                            placeholder="Search orders..."
                                            className="pl-9 w-[250px]"
                                            value={orderSearchTerm}
                                            onChange={(e) => setOrderSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                                        <SelectTrigger className="w-[150px]">
                                            <SelectValue placeholder="Filter Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="All">All Status</SelectItem>
                                            <SelectItem value="Approved">Approved</SelectItem>
                                            <SelectItem value="Processing">Processing</SelectItem>
                                            <SelectItem value="Completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order ID</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Quantity</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Dispatch</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredOrders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-mono font-medium">{order.id}</TableCell>
                                            <TableCell>{order.date}</TableCell>
                                            <TableCell>{order.customer}</TableCell>
                                            <TableCell>{order.item}</TableCell>
                                            <TableCell>{order.quantity} {order.unit}</TableCell>
                                            <TableCell>${order.amount.toLocaleString()}</TableCell>
                                            <TableCell><StatusBadge status={order.status} /></TableCell>
                                            <TableCell><StatusBadge status={order.dispatchStatus} /></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleViewOrder(order)}>
                                                    <Eye className="h-4 w-4 mr-2" /> View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- WEIGHBRIDGE & DISPATCH TAB --- */}
                <TabsContent value="dispatch" className="space-y-6 mt-6">
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="col-span-2">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Dispatch Operations</CardTitle>
                                    <Button size="sm" onClick={() => setIsCreateDOOpen(true)}>
                                        <Truck className="h-4 w-4 mr-2" /> Create Delivery Order (DO)
                                    </Button>
                                </div>
                                <CardDescription>Live weighbridge integration and vehicle tracking</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>DO Number</TableHead>
                                            <TableHead>Vehicle No</TableHead>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Gross Wt</TableHead>
                                            <TableHead>Tare Wt</TableHead>
                                            <TableHead>Net Wt</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dispatches.map((dispatch) => (
                                            <TableRow
                                                key={dispatch.id}
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={() => handleDispatchRowClick(dispatch)}
                                            >
                                                <TableCell className="font-mono">{dispatch.id}</TableCell>
                                                <TableCell>{dispatch.vehicle}</TableCell>
                                                <TableCell>{dispatch.item}</TableCell>
                                                <TableCell>{dispatch.grossWeight} MT</TableCell>
                                                <TableCell>{dispatch.tareWeight} MT</TableCell>
                                                <TableCell className="font-bold">{dispatch.netWeight} MT</TableCell>
                                                <TableCell><StatusBadge status={dispatch.status} /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Live Weighbridge</CardTitle>
                                <CardDescription>Terminal 01 - Main Gate</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center py-6">
                                <div className="w-48 h-24 bg-black rounded-md border-4 border-gray-700 flex items-center justify-center mb-4 shadow-inner">
                                    <span className="font-mono text-4xl text-red-500 font-bold animate-pulse">{currentWeight}</span>
                                </div>
                                <div className="w-full space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Incoming Vehicle Simulator</Label>
                                        <Select value={selectedVehicle} onValueChange={handleVehicleChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="No Vehicle on Scale" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="clear_scale">Clear Scale</SelectItem>
                                                {vehicles.map(v => (
                                                    <SelectItem key={v.id} value={v.id}>{v.reg} - {v.type}</SelectItem>
                                                ))}
                                                <SelectItem value="manual_input">Manual Input</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {selectedVehicle === "manual_input" && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <Label className="text-xs text-muted-foreground">Enter Manual Weight (MT)</Label>
                                            <Input
                                                type="number"
                                                placeholder="0.000"
                                                value={currentWeight}
                                                onChange={(e) => setCurrentWeight(e.target.value)}
                                                className="font-mono text-lg"
                                            />
                                        </div>
                                    )}
                                    <Separator />
                                    <div className="flex justify-between text-sm border-b pb-2">
                                        <span className="text-muted-foreground">Status</span>
                                        <span className="text-emerald-600 font-medium flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Online</span>
                                    </div>
                                    <div className="flex justify-between text-sm border-b pb-2">
                                        <span className="text-muted-foreground">Last Calibrated</span>
                                        <span>20 Nov 2024</span>
                                    </div>
                                    <div className="flex justify-between text-sm border-b pb-2">
                                        <span className="text-muted-foreground">Vehicle Detected</span>
                                        <span>{selectedVehicle ? "Yes (Sensors)" : "No"}</span>
                                    </div>
                                    <Button
                                        className="w-full"
                                        variant="destructive"
                                        disabled={!selectedVehicle}
                                        onClick={handleCaptureWeight}
                                    >
                                        Capture Weight
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- CONTRACTS & PRICING TAB --- */}
                <TabsContent value="contracts" className="space-y-6 mt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Active Contracts Section */}
                        <Card className="col-span-full md:col-span-2">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Active Sales Contracts</CardTitle>
                                        <CardDescription>Manage long-term customer agreements and terms</CardDescription>
                                    </div>
                                    <Button size="sm" onClick={() => setIsNewContractOpen(true)}>
                                        <Plus className="h-4 w-4 mr-2" /> New Contract
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Contract ID</TableHead>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Quantity/Terms</TableHead>
                                            <TableHead>Rate ($)</TableHead>
                                            <TableHead>Valid Period</TableHead>
                                            <TableHead>Payment Terms</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {allContracts.map((contract) => (
                                            <TableRow key={contract.id}>
                                                <TableCell className="font-mono font-medium">{contract.id}</TableCell>
                                                <TableCell>{contract.customer}</TableCell>
                                                <TableCell>{contract.product}</TableCell>
                                                <TableCell>{contract.quantity} {contract.unit}</TableCell>
                                                <TableCell>${contract.rate.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">{contract.validFrom} to {contract.validTo}</TableCell>
                                                <TableCell className="text-sm">{contract.terms}</TableCell>
                                                <TableCell><Badge variant={contract.status === "Active" ? "default" : "secondary"}>{contract.status}</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Current Pricing Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Current Pricing</CardTitle>
                                <CardDescription>Today's rates by product</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center pb-3 border-b">
                                        <div>
                                            <p className="font-medium text-sm">White Sugar S-30</p>
                                            <p className="text-xs text-muted-foreground">Per Quintal</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg">$3,400</p>
                                            <p className="text-xs text-emerald-600">+2.5%</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b">
                                        <div>
                                            <p className="font-medium text-sm">Raw Sugar</p>
                                            <p className="text-xs text-muted-foreground">Per MT</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg">$30,000</p>
                                            <p className="text-xs text-muted-foreground">-0.5%</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-sm">Molasses</p>
                                            <p className="text-xs text-muted-foreground">Per MT</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg">$12,000</p>
                                            <p className="text-xs text-muted-foreground">Stable</p>
                                        </div>
                                    </div>
                                </div>
                                <Button className="w-full" onClick={() => setIsUpdatePricesOpen(true)}>Update Prices</Button>
                            </CardContent>
                        </Card>

                        {/* Contract Summary Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Contract Summary</CardTitle>
                                <CardDescription>Overview of all agreements</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Active Contracts</span>
                                        <span className="font-bold text-emerald-600">3</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Pending Review</span>
                                        <span className="font-bold text-amber-600">1</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Expiring (30 days)</span>
                                        <span className="font-bold text-rose-600">1</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Total Contract Value</span>
                                        <span className="font-bold text-primary">$950.5M</span>
                                    </div>
                                </div>
                                <Separator />
                                <Button variant="outline" className="w-full" onClick={handleViewAnalysis}>View Analysis</Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Pricing History */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Price Movement History</CardTitle>
                            <CardDescription>Last 30 days price changes</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Price ($)</TableHead>
                                        <TableHead>Change</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pricingHistory.map((entry, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{entry.date}</TableCell>
                                            <TableCell className="font-medium">{entry.product}</TableCell>
                                            <TableCell>${entry.price.toLocaleString()}</TableCell>
                                            <TableCell className={entry.change.includes("+") ? "text-rose-600" : entry.change.includes("-") ? "text-emerald-600" : "text-gray-600"}>{entry.change}</TableCell>
                                            <TableCell><Badge variant="outline" className={entry.status === "Current" ? "bg-blue-50 border-blue-200 text-blue-700" : ""}>{entry.status}</Badge></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- INVOICING TAB --- */}
                <TabsContent value="invoices" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Invoices & GST</CardTitle>
                                    <CardDescription>Generate tax invoices, E-way bills, and export documentation</CardDescription>
                                </div>
                                <Button onClick={() => setIsGenerateInvoiceOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" /> Generate Invoice
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-lg border-2 border-dashed">
                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No pending invoices generated today.</p>
                                <p className="text-sm mt-2">Click "Generate Invoice" to create an invoice from dispatched orders.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- RECEIVABLES TAB --- */}
                <TabsContent value="receivables" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Customer Credit Control</CardTitle>
                            <CardDescription>Monitor credit limits and outstanding balances</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Credit Limit</TableHead>
                                        <TableHead>Current Balance</TableHead>
                                        <TableHead>Utilization</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mockCustomers.map((cust) => {
                                        const utilization = (cust.currentBalance / cust.creditLimit) * 100;
                                        return (
                                            <TableRow key={cust.id}>
                                                <TableCell className="font-medium">{cust.name}</TableCell>
                                                <TableCell>{cust.type}</TableCell>
                                                <TableCell>${cust.creditLimit.toLocaleString()}</TableCell>
                                                <TableCell>${cust.currentBalance.toLocaleString()}</TableCell>
                                                <TableCell className="w-[200px]">
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={utilization} className={`h-2 ${utilization > 90 ? 'bg-red-100' : ''}`} />
                                                        <span className="text-xs w-12">{utilization.toFixed(1)}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell><StatusBadge status={cust.status} /></TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- REPORTS TAB --- */}
                <TabsContent value="reports" className="space-y-6 mt-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {["Daily Sales Register", "Dispatch Summary", "Pending Orders Report", "Customer Ledger", "GST R1 Summary", "Export Realization"].map((report) => (
                            <Card key={report} className="hover:bg-muted/50 cursor-pointer transition-colors">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">{report}</CardTitle>
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-muted-foreground mt-2">Last generated: 2 days ago</p>
                                    <div className="flex gap-2 mt-4">
                                        <Button variant="secondary" size="sm" className="w-full" onClick={() => handlePreviewReport(report)}>
                                            <Eye className="h-3 w-3 mr-2" /> Preview
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

            </Tabs>

            {/* --- NEW ORDER DIALOG --- */}
            <Dialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>Create New Sales Order</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="customer">Customer</Label>
                                <Select value={newOrderCustomer} onValueChange={setNewOrderCustomer}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Customer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {mockCustomers.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date">Order Date</Label>
                                <Input type="date" id="date" defaultValue={new Date().toISOString().split('T')[0]} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Order Items</Label>
                            <div className="border rounded-md p-4 space-y-4 bg-muted/20">
                                <div className="grid grid-cols-12 gap-3">
                                    <div className="col-span-5 space-y-2">
                                        <Label className="text-xs">Product</Label>
                                        <Select value={newOrderProduct} onValueChange={setNewOrderProduct}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Product" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="p1">White Sugar S-30</SelectItem>
                                                <SelectItem value="p2">White Sugar M-30</SelectItem>
                                                <SelectItem value="p3">Molasses</SelectItem>
                                                <SelectItem value="p4">Bagasse</SelectItem>
                                                <SelectItem value="p5">Pressmud</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-3 space-y-2">
                                        <Label className="text-xs">Quantity</Label>
                                        <Input
                                            type="number"
                                            placeholder="0.00"
                                            value={newOrderQuantity}
                                            onChange={(e) => setNewOrderQuantity(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label className="text-xs">Unit</Label>
                                        <Select defaultValue="qtl">
                                            <SelectTrigger>
                                                <SelectValue placeholder="Unit" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="qtl">Quintal</SelectItem>
                                                <SelectItem value="mt">MT</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label className="text-xs">Rate ($)</Label>
                                        <Input type="number" placeholder="0.00" />
                                    </div>
                                </div>
                                <Button variant="secondary" size="sm" className="w-full border-dashed border-2">+ Add Another Item</Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="terms">Payment Terms</Label>
                            <Textarea id="terms" placeholder="Enter payment and delivery terms..." />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Order Status</Label>
                                <Select value={newOrderStatus} onValueChange={setNewOrderStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Approved">Approved</SelectItem>
                                        <SelectItem value="Processing">Processing</SelectItem>
                                        <SelectItem value="Completed">Completed</SelectItem>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Dispatch Status</Label>
                                <Select value={newOrderDispatchStatus} onValueChange={setNewOrderDispatchStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Dispatch Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                        <SelectItem value="Not Started">Not Started</SelectItem>
                                        <SelectItem value="Partial">Partial</SelectItem>
                                        <SelectItem value="Completed">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewOrderOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateOrder}>Create Order</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- VIEW ORDER DIALOG --- */}
            <Dialog open={isViewOrderOpen} onOpenChange={setIsViewOrderOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Sales Order Details</DialogTitle>
                        <DialogDescription>
                            Viewing order details for {selectedOrder?.id}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder && (
                        <div className="space-y-6 py-4" id="printable-order-content">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <Label className="text-muted-foreground">Customer</Label>
                                    <div className="font-medium">{selectedOrder.customer}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Order Date</Label>
                                    <div className="font-medium">{selectedOrder.date}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Status</Label>
                                    <div className="mt-1"><StatusBadge status={selectedOrder.status} /></div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground">Dispatch Status</Label>
                                    <div className="mt-1"><StatusBadge status={selectedOrder.dispatchStatus} /></div>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Product</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>{selectedOrder.item}</TableCell>
                                            <TableCell className="text-right">{selectedOrder.quantity} {selectedOrder.unit}</TableCell>
                                            <TableCell className="text-right">${selectedOrder.amount.toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex justify-end pt-4 border-t">
                                <Button variant="outline" onClick={() => setIsViewOrderOpen(false)}>Close</Button>
                                <Button className="ml-2" onClick={() => {
                                    // Simulate print
                                    const printContent = document.getElementById('printable-order-content');
                                    if (printContent) {
                                        const printWindow = window.open('', '', 'height=600,width=800');
                                        if (printWindow) {
                                            printWindow.document.write('<html><head><title>Print Order</title>');
                                            printWindow.document.write('</head><body >');
                                            printWindow.document.write(printContent.innerHTML);
                                            printWindow.document.write('</body></html>');
                                            printWindow.document.close();
                                            printWindow.print();
                                        }
                                    }
                                    setIsViewOrderOpen(false);
                                }}>
                                    <Printer className="mr-2 h-4 w-4" /> Print Order
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* --- CREATE DO DIALOG --- */}
            <Dialog open={isCreateDOOpen} onOpenChange={setIsCreateDOOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Create Delivery Order (DO)</DialogTitle>
                        <DialogDescription>Issue a DO for an approved Sales Order</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Select Sales Order</Label>
                            <Select onValueChange={setNewDOOrder}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Sales Order" />
                                </SelectTrigger>
                                <SelectContent>
                                    {orders.filter(o => o.status === "Approved").map(o => (
                                        <SelectItem key={o.id} value={o.id}>{o.id} - {o.customer}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Assign Transporter/Vehicle</Label>
                            <Input placeholder="Enter vehicle number" onChange={(e) => setNewDOVehicle(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Quantity to Dispatch</Label>
                                <Input type="number" placeholder="0.00" />
                            </div>
                            <div className="space-y-2">
                                <Label>Driver Name</Label>
                                <Input placeholder="Enter driver name" onChange={(e) => setNewDODriver(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDOOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateDO}>Issue DO</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- GENERATE INVOICE DIALOG --- */}
            <Dialog open={isGenerateInvoiceOpen} onOpenChange={setIsGenerateInvoiceOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Generate Tax Invoice</DialogTitle>
                        <DialogDescription>Select dispatch records to invoice</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">Select</TableHead>
                                    <TableHead>DO Number</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead className="text-right">Net Wt</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dispatches.filter(d => d.status === "Dispatched").map(d => (
                                    <TableRow key={d.id}>
                                        <TableCell><Input type="checkbox" className="h-4 w-4" /></TableCell>
                                        <TableCell>{d.id}</TableCell>
                                        <TableCell>{orders.find(o => o.id === d.orderId)?.customer}</TableCell>
                                        <TableCell className="text-right">{d.netWeight} MT</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsGenerateInvoiceOpen(false)}>Cancel</Button>
                        <Button onClick={() => {
                            setIsGenerateInvoiceOpen(false);
                            // In a real app, this would trigger the API call
                            alert("Invoice generated successfully! Check the invoices tab.");
                        }}>Generate Invoice</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- REPORT PREVIEW DIALOG --- */}
            <Dialog open={isPreviewReportOpen} onOpenChange={setIsPreviewReportOpen}>
                <DialogContent className="sm:max-w-[800px]">
                    <DialogHeader>
                        <DialogTitle>Report Preview: {previewReport}</DialogTitle>
                    </DialogHeader>
                    <div className="border rounded-md p-4 h-[400px] overflow-auto bg-muted/10 font-mono text-sm">
                        <div className="text-center mb-4">
                            <h3 className="font-bold text-lg">SUGAR FACTORY UNIT-1</h3>
                            <p>{previewReport}</p>
                            <p className="text-xs">Date: {new Date().toLocaleDateString()}</p>
                        </div>
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-black">
                                    <th className="py-2">Date</th>
                                    <th className="py-2">Particulars</th>
                                    <th className="py-2 text-right">Qty</th>
                                    <th className="py-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="border-b border-gray-300">
                                        <td className="py-2">2024-11-{20 + i}</td>
                                        <td className="py-2">Sales Record #{100 + i}</td>
                                        <td className="py-2 text-right">{(Math.random() * 100).toFixed(2)}</td>
                                        <td className="py-2 text-right">{(Math.random() * 50000).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-bold border-t-2 border-black">
                                    <td className="py-2">Total</td>
                                    <td className="py-2"></td>
                                    <td className="py-2 text-right">450.00</td>
                                    <td className="py-2 text-right">2,50,000.00</td>
                                </tr>
                            </tfoot>
                        </table>
                        <div className="mt-8 text-center text-xs text-gray-500">
                            *** End of Report ***
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPreviewReportOpen(false)}>Close</Button>
                        <Button onClick={() => {
                            setIsPreviewReportOpen(false);
                            // Simulate download
                            const link = document.createElement("a");
                            link.href = "data:text/plain;charset=utf-8," + encodeURIComponent(`Report: ${previewReport}\nGenerated on: ${new Date().toLocaleDateString()}`);
                            link.download = `${previewReport?.replace(/\s+/g, '_')}_Report.txt`;
                            link.click();
                        }}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- NEW CONTRACT DIALOG --- */}
            <Dialog open={isNewContractOpen} onOpenChange={setIsNewContractOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Create New Sales Contract</DialogTitle>
                        <DialogDescription>Define terms, pricing, and validity period</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Customer</Label>
                                <Select value={newContractCustomer} onValueChange={setNewContractCustomer}>
                                    <SelectTrigger data-testid="select-contract-customer">
                                        <SelectValue placeholder="Select customer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {mockCustomers.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Product</Label>
                                <Select value={newContractProduct} onValueChange={setNewContractProduct}>
                                    <SelectTrigger data-testid="select-contract-product">
                                        <SelectValue placeholder="Select product" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="White Sugar S-30">White Sugar S-30</SelectItem>
                                        <SelectItem value="White Sugar M-30">White Sugar M-30</SelectItem>
                                        <SelectItem value="Raw Sugar">Raw Sugar</SelectItem>
                                        <SelectItem value="Molasses">Molasses</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Quantity</Label>
                                <Input
                                    type="number"
                                    placeholder="e.g., 5000"
                                    value={newContractQuantity}
                                    onChange={(e) => setNewContractQuantity(e.target.value)}
                                    data-testid="input-contract-quantity"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Rate ($)</Label>
                                <Input
                                    type="number"
                                    placeholder="e.g., 3400"
                                    value={newContractRate}
                                    onChange={(e) => setNewContractRate(e.target.value)}
                                    data-testid="input-contract-rate"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Valid From</Label>
                                <Input
                                    type="date"
                                    value={newContractValidFrom}
                                    onChange={(e) => setNewContractValidFrom(e.target.value)}
                                    data-testid="input-contract-from"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Valid To</Label>
                                <Input
                                    type="date"
                                    value={newContractValidTo}
                                    onChange={(e) => setNewContractValidTo(e.target.value)}
                                    data-testid="input-contract-to"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Payment Terms</Label>
                            <Select value={newContractTerms} onValueChange={setNewContractTerms}>
                                <SelectTrigger data-testid="select-contract-terms">
                                    <SelectValue placeholder="Select payment terms" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Immediate payment">Immediate payment</SelectItem>
                                    <SelectItem value="Net 15 days">Net 15 days</SelectItem>
                                    <SelectItem value="30 days net">30 days net</SelectItem>
                                    <SelectItem value="45 days net, 2% early payment">45 days net, 2% early payment</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewContractOpen(false)} data-testid="button-cancel-contract">Cancel</Button>
                        <Button onClick={handleCreateContract} data-testid="button-save-contract"><Plus className="mr-2 h-4 w-4" /> Create Contract</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- UPDATE PRICES DIALOG --- */}
            <Dialog open={isUpdatePricesOpen} onOpenChange={setIsUpdatePricesOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Update Product Pricing</DialogTitle>
                        <DialogDescription>Revise rates for selected product</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Product</Label>
                            <Select value={updatePriceProduct} onValueChange={setUpdatePriceProduct}>
                                <SelectTrigger data-testid="select-price-product">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="White Sugar S-30">White Sugar S-30</SelectItem>
                                    <SelectItem value="White Sugar M-30">White Sugar M-30</SelectItem>
                                    <SelectItem value="Raw Sugar">Raw Sugar</SelectItem>
                                    <SelectItem value="Molasses">Molasses</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>New Price ($)</Label>
                            <Input
                                type="number"
                                placeholder="Enter new price"
                                value={updatePriceValue}
                                onChange={(e) => setUpdatePriceValue(e.target.value)}
                                data-testid="input-new-price"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Reason for Change</Label>
                            <Textarea
                                placeholder="Market adjustment, supply changes, etc."
                                value={updatePriceReason}
                                onChange={(e) => setUpdatePriceReason(e.target.value)}
                                data-testid="input-price-reason"
                                className="h-20"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUpdatePricesOpen(false)} data-testid="button-cancel-price">Cancel</Button>
                        <Button onClick={handleUpdatePrices} data-testid="button-save-price">Update Price</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- CONTRACT ANALYSIS DIALOG --- */}
            <Dialog open={isAnalysisOpen} onOpenChange={setIsAnalysisOpen}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>Contract Analysis & Insights</DialogTitle>
                        <DialogDescription>Revenue trends and contract performance</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Avg Contract Value</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">$237.6M</div>
                                    <p className="text-xs text-emerald-600 mt-1">+8.3% vs last quarter</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Contract Renewal Rate</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">92%</div>
                                    <p className="text-xs text-muted-foreground mt-1">Customer retention</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Avg Deal Cycle</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">28 days</div>
                                    <p className="text-xs text-muted-foreground mt-1">Contract to closure</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Top Customers by Contract Value</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Global Exports Inc</span>
                                        <div className="flex items-center gap-2">
                                            <Progress value={80} className="w-32 h-2" />
                                            <span className="text-sm font-bold">$300M</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Sweet Treats Ltd</span>
                                        <div className="flex items-center gap-2">
                                            <Progress value={60} className="w-32 h-2" />
                                            <span className="text-sm font-bold">$225M</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">BioFuel Corp</span>
                                        <div className="flex items-center gap-2">
                                            <Progress value={45} className="w-32 h-2" />
                                            <span className="text-sm font-bold">$168.5M</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsAnalysisOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- SALES POLICY DIALOG --- */}
            <Dialog open={isSalesPolicyOpen} onOpenChange={setIsSalesPolicyOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Sales Policy & Terms</DialogTitle>
                        <DialogDescription>Standard terms and conditions for sales and dispatch</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                        <section>
                            <h4 className="font-bold mb-2">1. Pricing & Payment</h4>
                            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                                <li>Prices are ex-mill basis unless specified otherwise.</li>
                                <li>Payment must be made in advance or as per approved credit terms.</li>
                                <li>GST and other applicable taxes will be charged extra.</li>
                            </ul>
                        </section>
                        <section>
                            <h4 className="font-bold mb-2">2. Dispatch & Delivery</h4>
                            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                                <li>Delivery is subject to availability of stock.</li>
                                <li>Vehicles must report to weighbridge before 5:00 PM for same-day dispatch.</li>
                                <li>Tare weight and Gross weight recorded at factory weighbridge shall be final.</li>
                            </ul>
                        </section>
                        <section>
                            <h4 className="font-bold mb-2">3. Quality Assurance</h4>
                            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                                <li>Quality checks are performed before dispatch.</li>
                                <li>Any complaints regarding quality must be reported within 24 hours of receipt.</li>
                            </ul>
                        </section>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsSalesPolicyOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
