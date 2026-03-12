// ============================================================================
// SALES ORDER COMPONENT
// Cloned from Purchase Order implementation (OrderExecution.tsx)
// ============================================================================

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { generateQuotationPDFHTML } from "@/lib/quotationPDFTemplate";
import { generateInvoicePDFHTML, type InvoicePDFData } from "@/lib/invoicePDFTemplate";
import {
    Search,
    Eye,
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Trash2,
    Plus,
    Edit,
    X,
    Download,
    Check,
    ChevronsUpDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandInputBorderless,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { mockWarehouses, mockLocations } from "@/lib/masterMockData";
// Updated: Import mock sales order service
import {
    getSalesOrders,
    createSalesOrder,
    updateSalesOrder,
    changeSOStatus,
    closeSalesOrder,
    type SOData as MockSOData,
    type SOItem as MockSOItem,
    type PaymentTerm as MockPaymentTerm,
    type SOStatus as MockSOStatus
} from "@/lib/mockSalesOrders";
import { getQuotations, updateQuotation, type QuotationData } from "@/lib/mockQuotations";
import { createInvoiceFromSO, getInvoices, type InvoiceData } from "@/lib/mockInvoices";
import { mockCustomers, allMockMaterials, mockFinishedGoods } from "@/lib/masterMockData";
import { getPaymentDataBySONumber } from "@/lib/followUpStore";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Use types from mock service
type SOStatus = MockSOStatus;
type SOItem = MockSOItem;
type PaymentTerm = MockPaymentTerm;
type SOData = MockSOData;

interface Quotation {
    id: number;
    quotationNo: string;
    customerName: string;
    contactPerson: string;
    mobileNo?: string; // Mobile number field for auto-fill
    shippingAddress: string;
    billingAddress: string;
    currency: string; // Currency field for auto-fill
    paymentTerms: string;
    deliveryDate: string;
    items: Array<{
        id: number;
        itemName: string;
        uom: string;
        orderedQty: number;
        rate: number;
        price: number;
        dispatchedQty: number;
    }>;
}

interface Customer {
    id: number;
    name: string;
    // Changed: Added customer contact details for auto-fill
    contactPerson?: string;
    mobileNo?: string;
    shippingAddress?: string;
    billingAddress?: string;
}

// ============================================================================
// MOCK DATA & STORAGE
// ============================================================================

// Removed local mockCustomers - using centralized source from masterMockData.ts

// Removed local mockQuotations - using centralized source from mockQuotations.ts

// Mock items for dropdown
// Use global finished goods for item selection
const mockItems = mockFinishedGoods.map(fg => ({
    id: parseInt(fg.id.split('-')[1]) || Math.random(),
    itemCode: fg.id,
    name: fg.name,
    uom: "PCS",
    rate: 100 // Default rate, will be adjusted in form
}));

// Removed local mock data and storage helpers - now using centralized mock services

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getCurrencySymbol = (currency: string): string => {
    const symbols: Record<string, string> = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'INR': '₹',
        'JPY': '¥',
        'CNY': '¥',
        'AUD': 'A$',
        'CAD': 'C$',
        'CHF': 'CHF',
        'SEK': 'kr',
        'NZD': 'NZ$',
        'UGX': 'USh'
    };
    return symbols[currency] || currency;
};

// ============================================================================
// REUSABLE COMPONENTS - Cloned from PO implementation
// ============================================================================

function DatePicker({ date, setDate, disabled = false }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [visibleDate, setVisibleDate] = useState(() => date || new Date());

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const formatDisplayDate = (date: Date | undefined) => {
        if (!date) return "Pick a date";
        try {
            return format(date, "dd/MM/yyyy");
        } catch (error) {
            return "Pick a date";
        }
    };

    const handleDateSelect = (selectedDate: Date) => {
        setDate(selectedDate);
        setIsOpen(false);
    };

    const navigateMonth = (direction: number) => {
        const newDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + direction, 1);
        setVisibleDate(newDate);
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];
        const prevMonth = new Date(year, month - 1, 0);
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            days.push({ date: new Date(year, month - 1, prevMonth.getDate() - i), isCurrentMonth: false });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday: today.toDateString() === currentDate.toDateString(),
                isSelected: date && currentDate.toDateString() === date.toDateString(),
                isDisabled: currentDate < today
            });
        }

        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day++) {
            const currentDate = new Date(year, month + 1, day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            days.push({
                date: currentDate,
                isCurrentMonth: false,
                isDisabled: currentDate < today
            });
        }
        return days;
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start text-left font-normal flex h-10 rounded-md border border-input px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 hover:bg-white",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDisplayDate(date) : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 shadow-lg border rounded-lg z-[9999]" align="start" side="bottom" sideOffset={4}>
                <div className="w-80">
                    <div className="flex items-center justify-between mb-4">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{monthNames[visibleDate.getMonth()]} {visibleDate.getFullYear()}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                            <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {getDaysInMonth(visibleDate).map((day, index) => (
                            <Button
                                key={index}
                                variant="ghost"
                                size="icon"
                                disabled={(day as any).isDisabled}
                                className={cn(
                                    "h-8 w-8 text-sm font-normal",
                                    !day.isCurrentMonth && "text-muted-foreground opacity-30",
                                    (day as any).isToday && "bg-accent text-accent-foreground font-semibold",
                                    (day as any).isSelected && "bg-primary text-primary-foreground font-semibold",
                                    day.isCurrentMonth && !(day as any).isDisabled && "hover:bg-accent hover:text-accent-foreground",
                                    (day as any).isDisabled && "cursor-not-allowed opacity-20"
                                )}
                                onClick={() => !(day as any).isDisabled && handleDateSelect(day.date)}
                            >
                                {day.date.getDate()}
                            </Button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// Status badge helper - enforces SO status logic
const getSOStatusBadge = (status: SOStatus) => {
    switch (status) {
        case "Draft": return <Badge className="bg-slate-500 hover:bg-slate-600">Draft</Badge>;
        case "Invoice Pending": return <Badge className="bg-blue-500 hover:bg-blue-600">Invoice Pending</Badge>;
        case "Dispatch Pending": return <Badge className="bg-orange-500 hover:bg-orange-600">Dispatch Pending</Badge>;
        case "Dispatched": return <Badge className="bg-green-500 hover:bg-green-600">Dispatched</Badge>;
        case "Closed SO": return <Badge className="bg-gray-700 hover:bg-gray-800">Closed SO</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
};

// ============================================================================
// MAIN SALES ORDER COMPONENT
// ============================================================================

const SalesOrder = () => {
    const { toast } = useToast();

    // State management - removed localStorage - using mock store
    const [salesOrders, setSalesOrders] = useState<SOData[]>([]);
    const [mockQuotations, setMockQuotations] = useState<QuotationData[]>([]);

    useEffect(() => {
        setSalesOrders(getSalesOrders());
        setMockQuotations(getQuotations());

        const handleStorageChange = (e: any) => {
            if (e.key === "erp_mock_sales_orders_v2" || e.type === "erp:sales-orders-updated") {
                setSalesOrders(getSalesOrders());
            }
            if (e.key === "erp_mock_quotations_v2" || e.type === "erp:quotations-updated") {
                setMockQuotations(getQuotations());
            }
        };

        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("erp:sales-orders-updated", handleStorageChange);
        window.addEventListener("erp:quotations-updated", handleStorageChange);
        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("erp:sales-orders-updated", handleStorageChange);
            window.removeEventListener("erp:quotations-updated", handleStorageChange);
        };
    }, []);

    const refreshSalesOrders = () => {
        setSalesOrders(getSalesOrders());
    };

    // Filters - cloned from PO implementation
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [filterStatus, setFilterStatus] = useState<string>("Draft");

    // Pagination - using DataTablePagination with options [10, 15, 30, 50]
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Dialog states
    const [isSODialogOpen, setIsSODialogOpen] = useState(false);
    const [activeSO, setActiveSO] = useState<SOData | null>(null);
    const [isSOEdit, setIsSOEdit] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [soToDelete, setSoToDelete] = useState<SOData | null>(null);
    
    // PDF Preview state for Invoice Pending status
    const [isPDFPreviewOpen, setIsPDFPreviewOpen] = useState(false);
    const [previewSO, setPreviewSO] = useState<SOData | null>(null);
    
    // PDF Preview state for Dispatch Pending status
    const [isDispatchPDFPreviewOpen, setIsDispatchPDFPreviewOpen] = useState(false);
    const [dispatchPreviewSO, setDispatchPreviewSO] = useState<SOData | null>(null);
    
    // PDF Preview state for Dispatched status
    const [isDispatchedPDFPreviewOpen, setIsDispatchedPDFPreviewOpen] = useState(false);
    const [dispatchedPreviewSO, setDispatchedPreviewSO] = useState<SOData | null>(null);
    
    // Edit Detail Dialog state for Dispatched status (Close SO action)
    const [isDispatchedEditOpen, setIsDispatchedEditOpen] = useState(false);
    const [dispatchedEditSO, setDispatchedEditSO] = useState<SOData | null>(null);
    
    // PDF Preview state for Closed SO status
    const [isClosedSOPDFPreviewOpen, setIsClosedSOPDFPreviewOpen] = useState(false);
    const [closedSOPreviewSO, setClosedSOPreviewSO] = useState<SOData | null>(null);
    
    // PDF Preview state for Draft status
    const [isDraftPDFPreviewOpen, setIsDraftPDFPreviewOpen] = useState(false);
    const [draftPreviewSO, setDraftPreviewSO] = useState<SOData | null>(null);

    // Form states for SO modal
    const [selectedQuotation, setSelectedQuotation] = useState<string>("");
    const [selectedCustomer, setSelectedCustomer] = useState<string>("");
    const [isManualEntry, setIsManualEntry] = useState(false);

    // Filtering logic - cloned from PO table structure
    const filteredSOs = salesOrders.filter(so => {
        const matchesSearch = so.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            so.customerName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDate = filterDate ? so.soDate === format(filterDate, "yyyy-MM-dd") : true;
        const matchesStatus = filterStatus === "all" ? true : so.status === filterStatus;

        return matchesSearch && matchesDate && matchesStatus;
    });

    // Pagination calculations - cloned from PO implementation
    const totalPages = Math.ceil(filteredSOs.length / itemsPerPage);
    const paginatedData = filteredSOs.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Auto-adjust page when data changes
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredSOs.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterDate, filterStatus]);

    // Handler to open SO dialog (view or edit)
    // Updated to show PDF preview for Invoice Pending, Dispatch Pending, Dispatched, Closed SO, and Draft statuses when viewing
    const handleOpenSO = (so: SOData | null, isEdit: boolean) => {
        // If viewing a Draft SO, show PDF preview instead
        if (so && !isEdit && so.status === "Draft") {
            setDraftPreviewSO(so);
            setIsDraftPDFPreviewOpen(true);
            return;
        }
        
        // If viewing an Invoice Pending SO, show PDF preview instead
        if (so && !isEdit && so.status === "Invoice Pending") {
            setPreviewSO(so);
            setIsPDFPreviewOpen(true);
            return;
        }
        
        // If viewing a Dispatch Pending SO, show Dispatch PDF preview instead
        if (so && !isEdit && so.status === "Dispatch Pending") {
            setDispatchPreviewSO(so);
            setIsDispatchPDFPreviewOpen(true);
            return;
        }
        
        // If viewing a Dispatched SO, show Dispatched PDF preview instead
        if (so && !isEdit && so.status === "Dispatched") {
            setDispatchedPreviewSO(so);
            setIsDispatchedPDFPreviewOpen(true);
            return;
        }
        
        // If viewing a Closed SO, show Closed SO PDF preview instead
        if (so && !isEdit && so.status === "Closed SO") {
            setClosedSOPreviewSO(so);
            setIsClosedSOPDFPreviewOpen(true);
            return;
        }

            if (so) {
                const soCopy = JSON.parse(JSON.stringify(so)) as SOData;
                setActiveSO(soCopy);
                setSelectedQuotation(soCopy.quotationRef || "");
                setSelectedCustomer(soCopy.customerName);
                setIsManualEntry(false);
            } else {
                // Create new SO - Changed: Added new fields, removed paymentTerms
                const newSO: SOData = {
                    id: Date.now(),
                    soNumber: `SO-${new Date().getFullYear()}-${String(salesOrders.length + 1).padStart(3, '0')}`,
                    soDate: format(new Date(), "yyyy-MM-dd"),
                    quotationRef: "",
                    customerName: "",
                    contactPerson: "",
                    mobileNo: "", // New field
                    shippingAddress: "",
                    billingAddress: "",
                    deliveryDate: "",
                    location: "",
                    warehouse: "",
                    currency: "UGX", // New field: Currency
                    remarks: "",
                    terms: [], // New field: Payment terms list
                    items: [],
                    dispatches: [], // Required field
                    discountValue: 0,
                    discountType: "%",
                    taxValue: 0,
                    taxType: "%",
                    taxPercentage: 0, // New field: Overall tax percentage
                    status: "Draft"
                };
                setActiveSO(newSO);
                setSelectedQuotation("");
                setSelectedCustomer("");
                setIsManualEntry(false);
            }
            setIsSOEdit(isEdit);
            setIsSODialogOpen(true);
        };

    // Quotation auto-fill handler
    const handleQuotationSelect = (quotationNo: string) => {
        setSelectedQuotation(quotationNo);
        if (!activeSO) return;

        // Handle "none" selection - clear quotation reference
        // Keep customer values only if Customer Select is chosen
        if (quotationNo === "none") {
            const customerData = mockCustomers.find(c => c.name === selectedCustomer);

            if (customerData && selectedCustomer) {
                // Keep customer data if customer is selected
                setActiveSO({
                    ...activeSO,
                    quotationRef: "",
                    customerName: selectedCustomer,
                    contactPerson: customerData.contactPerson || "",
                    mobileNo: customerData.mobileNo || "",
                    shippingAddress: customerData.shippingAddress || "",
                    billingAddress: customerData.billingAddress || "",
                    deliveryDate: "",
                    terms: [],
                    items: [],
                    discountValue: 0,
                    discountType: "%",
                    taxValue: 0,
                    taxType: "%",
                    taxPercentage: 0
                });
            } else {
                // Clear all fields if no customer selected
                setActiveSO({
                    ...activeSO,
                    quotationRef: "",
                    customerName: "",
                    contactPerson: "",
                    mobileNo: "",
                    shippingAddress: "",
                    billingAddress: "",
                    deliveryDate: "",
                    terms: [],
                    items: [],
                    discountValue: 0,
                    discountType: "%",
                    taxValue: 0,
                    taxType: "%",
                    taxPercentage: 0
                });
                setSelectedCustomer("");
            }
            setIsManualEntry(false);
            return;
        }

        const quotation = mockQuotations.find(q => q.quotationNo === quotationNo);
        if (quotation) {
            // Auto-fill customer, contact, mobile number, addresses, delivery date, and items from quotation
            // Map quotation items to SO items with dispatchedQty = 0 (read-only)
            const itemsSource = quotation.items || [];
            const soItems: SOItem[] = itemsSource.map((qItem, index) => {
                return {
                    id: Date.now() + index,
                    itemCode: qItem.itemCode || "",
                    itemName: qItem.item || "Unknown Item",
                    uom: "PCS",
                    orderedQty: Number(qItem.qty) || 0,
                    rate: Number(qItem.rate) || 0,
                    price: Number(qItem.amount) || (Number(qItem.qty) * Number(qItem.rate)) || 0,
                    dispatchedQty: 0
                };
            });

            // Auto-set Customer Select dropdown to quotation's customer
            setSelectedCustomer(quotation.customerName || "");
            setIsManualEntry(false);

            const termsSource = quotation.paymentTerms || [];

            setActiveSO({
                ...activeSO,
                quotationRef: quotationNo,
                customerName: quotation.customerName || "",
                contactPerson: quotation.contactPersonName || "",
                mobileNo: quotation.contactNumber || "",
                shippingAddress: quotation.shippingAddress || "",
                billingAddress: quotation.billingAddress || "",
                currency: quotation.currency || "UGX",
                deliveryDate: quotation.deliveryTime || "",
                items: soItems,
                // Properly map all financial fields from quotation
                discountValue: Number(quotation.discountValue) || 0,
                discountType: (quotation.discountType as any) || "%",
                taxValue: Number(quotation.taxValue) || 0,
                taxType: (quotation.taxType as any) || "%",
                taxPercentage: Number(quotation.taxPercentage) || 0,
                remarks: quotation.remarks || "",
                // Map payment terms from quotation, ensuring valid termType for Sales Order
                terms: termsSource.map(t => {
                    // Force termType to be one of the valid values: "Advance", "Delivery", "Days"
                    let termType: "Advance" | "Delivery" | "Days" = "Advance";
                    const tTerms = String(t.terms || "").toLowerCase();
                    if (tTerms.includes("advance") || tTerms.includes("cash") || tTerms.includes("receipt")) termType = "Advance";
                    else if (tTerms.includes("delivery")) termType = "Delivery";
                    else if (tTerms.includes("day")) termType = "Days";

                    return {
                        id: t.id || Date.now() + Math.random(),
                        value: Number(t.value || t.percentage || 0),
                        percentage: Number(t.percentage || 0),
                        termType: termType,
                        date: t.date || "",
                        days: Number(t.days) || 0,
                        note: ""
                    };
                })
            });
        }
    };

    // Handle customer selection
    const handleCustomerSelect = (customerName: string) => {
        if (customerName === "Manual Entry / New Customer") {
            setIsManualEntry(true);
            setSelectedCustomer("");
            if (activeSO) {
                setActiveSO({
                    ...activeSO,
                    customerName: "",
                    contactPerson: "",
                    mobileNo: "",
                    shippingAddress: "",
                    billingAddress: ""
                });
            }
            return;
        }

        const customer = mockCustomers.find(c => c.name === customerName);
        if (customer && activeSO) {
            setIsManualEntry(false);
            setSelectedCustomer(customer.name);
            setActiveSO({
                ...activeSO,
                customerName: customer.name,
                contactPerson: customer.contactPerson || "",
                mobileNo: customer.mobileNo || "",
                shippingAddress: customer.shippingAddress || "",
                billingAddress: customer.billingAddress || ""
            });
        }
    };

    // Create new customer
    const handleCreateCustomer = () => {
        if (!activeSO) return;

        // Validation
        if (!activeSO.customerName?.trim()) {
            toast({
                title: "Validation Error",
                description: "Customer Name is required",
                variant: "destructive"
            });
            return;
        }

        if (!activeSO.mobileNo?.trim()) {
            toast({
                title: "Validation Error",
                description: "Contact Number is required",
                variant: "destructive"
            });
            return;
        }

        if (!/^\d{10}$/.test(activeSO.mobileNo)) {
            toast({
                title: "Validation Error",
                description: "Contact number must be 10 digits",
                variant: "destructive"
            });
            return;
        }

        if (!activeSO.billingAddress?.trim()) {
            toast({
                title: "Validation Error",
                description: "Billing Address is required",
                variant: "destructive"
            });
            return;
        }

        // Check if customer already exists
        const existingCustomer = mockCustomers.find(
            c => c.name.toLowerCase() === activeSO.customerName.trim().toLowerCase()
        );

        if (existingCustomer) {
            toast({
                title: "Customer Exists",
                description: "A customer with this name already exists",
                variant: "destructive"
            });
            return;
        }

        // Create new customer
        const newCustomer = {
            id: `cust-${Date.now()}`,
            name: activeSO.customerName.trim(),
            contactPerson: activeSO.contactPerson?.trim() || "",
            mobileNo: activeSO.mobileNo.trim(),
            billingAddress: activeSO.billingAddress.trim(),
            shippingAddress: activeSO.shippingAddress?.trim() || activeSO.billingAddress.trim()
        };

        // Add to mockCustomers array
        mockCustomers.push(newCustomer);

        // Switch to non-manual mode and keep the customer selected
        setIsManualEntry(false);
        setSelectedCustomer(newCustomer.name);

        toast({
            title: "Success",
            description: `Customer "${newCustomer.name}" created successfully`
        });
    };

    // Add new item to SO
    const handleAddItem = () => {
        if (!activeSO) return;
        const newItem: SOItem = {
            id: Date.now(),
            itemCode: "",
            itemName: "",
            uom: "PCS",
            orderedQty: 0,
            rate: 0, // Changed: Use rate
            price: 0, // Auto-calculated
            dispatchedQty: 0
        };
        setActiveSO({ ...activeSO, items: [...activeSO.items, newItem] });
    };

    // Remove item from SO
    const handleRemoveItem = (itemId: number) => {
        if (!activeSO) return;
        setActiveSO({ ...activeSO, items: activeSO.items.filter(i => i.id !== itemId) });
    };

    // New: Add payment term
    // Add payment term with support for both Percentage and Fixed Amount
    const handleAddTerm = () => {
        if (!activeSO) return;

        // Get all term types that are already used
        const usedTermTypes = activeSO.terms.map(t => t.termType);

        // Find the first available term type
        let defaultTermType: "Advance" | "Delivery" | "Days" = "Advance";
        if (usedTermTypes.includes("Advance")) {
            defaultTermType = "Delivery";
        }
        if (usedTermTypes.includes("Delivery")) {
            defaultTermType = "Days";
        }

        // Create new term with default value
        const newTerm: PaymentTerm = {
            id: Date.now(),
            value: 0, // Default value
            percentage: 0, // Kept for backward compatibility
            termType: defaultTermType,
            date: ""
        };
        setActiveSO({ ...activeSO, terms: [...activeSO.terms, newTerm] });
    };

    // New: Remove payment term
    const handleRemoveTerm = (termId: number) => {
        if (!activeSO) return;
        setActiveSO({ ...activeSO, terms: activeSO.terms.filter(t => t.id !== termId) });
    };

    // Calculate totals - Support for both discount and tax as % or Amount
    const calculateTotals = (items: SOItem[] = [], discountValue: number = 0, discountType: "%" | "Amount" = "%", taxValue: number = 0, taxType: "%" | "Amount" = "%") => {
        const subtotal = (items || []).reduce((sum, item) => sum + (Number(item.price) || 0), 0);
        
        // Calculate discount with safety checks
        let discountAmount = 0;
        const safeDiscountValue = Number(discountValue) || 0;

        if (discountType === "%") {
            discountAmount = (subtotal * safeDiscountValue) / 100;
        } else {
            discountAmount = safeDiscountValue;
        }
        
        const afterDiscount = Math.max(0, subtotal - discountAmount);
        
        // Calculate tax - can be % or fixed amount
        let totalTax = 0;
        const safeTaxValue = Number(taxValue) || 0;

        if (taxType === "%") {
            totalTax = (afterDiscount * safeTaxValue) / 100;
        } else {
            totalTax = safeTaxValue;
        }
        
        const grandTotal = afterDiscount + totalTax;
        
        return { subtotal, discountAmount, afterDiscount, totalTax, grandTotal };
    };

    // Save SO (Draft or Submit) - removed localStorage - using mock store
    const handleSaveSO = (submit: boolean = false) => {
        if (!activeSO) return;

        // Validation - Cannot save/submit if in manual entry mode
        if (isManualEntry) {
            toast({
                title: "Validation Error",
                description: submit ? "Please create the customer first before submitting" : "Please create the customer first before saving",
                variant: "destructive"
            });
            return;
        }

        // Validation - Customer is required
        if (!activeSO.customerName?.trim()) {
            toast({
                title: "Validation Error",
                description: "Customer is required",
                variant: "destructive"
            });
            return;
        }

        // Validation - Billing Address is required
        if (!activeSO.billingAddress?.trim()) {
            toast({
                title: "Validation Error",
                description: "Billing Address is required",
                variant: "destructive"
            });
            return;
        }

        // Changed: Validation - At least one item required
        if (activeSO.items.length === 0) {
            toast({
                title: "Validation Error",
                description: "Please add at least one item.",
                variant: "destructive"
            });
            return;
        }

        // Changed: Validation - All items must have orderedQty > 0
        const invalidItems = activeSO.items.filter(item => item.orderedQty <= 0);
        if (invalidItems.length > 0) {
            toast({
                title: "Validation Error",
                description: "All items must have Ordered Qty greater than 0.",
                variant: "destructive"
            });
            return;
        }

        // Validation: Check if terms exist and validate
        if (activeSO.terms && activeSO.terms.length > 0) {
            // Validation: Total percentage must equal 100%
            const totalPercentage = activeSO.terms.reduce((sum, term) => sum + term.percentage, 0);
            if (totalPercentage !== 100) {
                toast({
                    title: "Validation Error",
                    description: "Total payment percentage must equal 100%.",
                    variant: "destructive"
                });
                return;
            }

            // Validation: Check for zero percentage terms
            const hasZeroPercentage = activeSO.terms.some(term => term.percentage === 0);
            if (hasZeroPercentage) {
                toast({
                    title: "Validation Error",
                    description: "Payment percentage cannot be 0%.",
                    variant: "destructive"
                });
                return;
            }
        }

        // Status transition logic enforced here
        let newStatus: SOStatus = activeSO.status;
        if (submit && activeSO.status === "Draft") {
            newStatus = "Invoice Pending"; // Draft → Submit → Invoice Pending
        }

        const updatedSO = { ...activeSO, status: newStatus, currency: activeSO.currency || "UGX" };

        if (salesOrders.find(so => so.id === updatedSO.id)) {
            updateSalesOrder(updatedSO.id, updatedSO);
        } else {
            createSalesOrder(updatedSO);
        }

        // Auto-create invoice if submitted
        if (submit && newStatus === "Invoice Pending") {
            createInvoiceFromSO(updatedSO as any); // Cast because of slight type diffs in mock lib
        }

        setSalesOrders(getSalesOrders()); // Refresh list
        setIsSODialogOpen(false);
        toast({
            title: submit ? "SO Submitted" : "SO Saved",
            description: submit ? `Sales Order ${updatedSO.soNumber} submitted successfully.` : `Sales Order ${updatedSO.soNumber} saved as draft.`
        });
    };

    // Process to Invoice (Invoice Pending → Dispatch Pending) - removed localStorage - using mock store
    const handleProcessToInvoice = () => {
        if (!activeSO || activeSO.status !== "Invoice Pending") return;
        changeSOStatus(activeSO.id, "Dispatch Pending");
        setSalesOrders(getSalesOrders()); // Refresh list
        setIsSODialogOpen(false);
        toast({
            title: "Processed to Invoice",
            description: `Sales Order ${activeSO.soNumber} is now in Dispatch Pending status.`
        });
    };

    // Close SO (only allowed when status = Dispatched and payment completed)
    const handleCloseSO = (so?: SOData) => {
        const soToClose = so || activeSO || dispatchedEditSO;
        if (!soToClose) return;
        
        const result = closeSalesOrder(soToClose.id);
        
        if (result.success) {
            refreshSalesOrders();
            if (activeSO) {
                setActiveSO(result.so || null);
            }
            if (dispatchedEditSO) {
                setIsDispatchedEditOpen(false);
            }
            toast({
                title: "Success",
                description: result.message
            });
        } else {
            toast({
                title: "Cannot Close SO",
                description: result.message,
                variant: "destructive"
            });
        }
    };

    // Delete SO (only allowed when status = Draft) - removed localStorage - using mock store
    const handleDeleteSO = (soId: number) => {
        // Filter out the SO to delete
        setSalesOrders(salesOrders.filter(so => so.id !== soId));
        setIsDeleteAlertOpen(false);
        toast({
            title: "SO Deleted",
            description: "Sales Order has been deleted successfully."
        });
    };

    // Download Quotation PDF - Opens print dialog
    const handleDownloadQuotation = () => {
        if (!activeSO || !activeSO.quotationRef) {
            toast({
                title: "No Quotation",
                description: "This Sales Order does not have a linked quotation.",
                variant: "destructive"
            });
            return;
        }

        // Find the quotation data
        const quotations = getQuotations();
        const quotation = quotations.find(q => q.quotationNo === activeSO.quotationRef);

        if (!quotation) {
            toast({
                title: "Quotation Not Found",
                description: `Could not find quotation ${activeSO.quotationRef}`,
                variant: "destructive"
            });
            return;
        }

        // Use a hidden iframe to print without opening a new tab
        let iframe = document.getElementById("print-iframe-quotation") as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement("iframe");
            iframe.id = "print-iframe-quotation";
            iframe.style.position = "absolute";
            iframe.style.width = "0px";
            iframe.style.height = "0px";
            iframe.style.border = "none";
            document.body.appendChild(iframe);
        }

        const formattedQuotationDate = format(new Date(quotation.quotationDate), "dd-MM-yyyy");

        const htmlContent = `
            <html>
                <head>
                    <title>Quotation - ${quotation.quotationNo}</title>
                    <style>
                        @page { size: A4; margin: 10mm; }
                        body { font-family: 'Inter', system-ui, sans-serif; padding: 0; color: #111; line-height: 1.4; font-size: 11px; }
                        .container { width: 100%; max-width: 100%; margin: 0 auto; }
                        
                        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 15px; }
                        .company-info h1 { margin: 0; color: #1e40af; font-size: 22px; font-weight: 800; text-transform: uppercase; }
                        .company-info p { margin: 2px 0; color: #64748b; font-size: 10px; }
                        
                        .document-title { text-align: right; }
                        .document-title h2 { margin: 0; font-size: 18px; color: #1e293b; }
                        .document-title p { margin: 2px 0; font-weight: 700; color: #1e40af; font-size: 12px; }

                        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                        .info-box { border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; }
                        .info-box h3 { margin: 0 0 6px 0; font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
                        .info-item { margin-bottom: 4px; display: flex; }
                        .info-item strong { width: 110px; color: #475569; font-size: 10px; flex-shrink: 0; }
                        .info-item span { color: #1e293b; font-weight: 500; }

                        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                        th { background-color: #f8fafc; color: #475569; font-size: 9px; text-transform: uppercase; padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; }
                        td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 10px; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: 700; }

                        .totals-section { margin-top: 15px; display: flex; justify-content: flex-end; }
                        .totals-box { width: 300px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
                        .totals-row { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
                        .totals-row:last-child { border-bottom: none; background-color: #f8fafc; font-weight: 700; }
                        .totals-label { color: #475569; font-size: 10px; }
                        .totals-value { color: #1e293b; font-weight: 600; }

                        .payment-terms { margin-top: 15px; }
                        .payment-terms h3 { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
                        .payment-terms table { margin-top: 0; }

                        .remarks-section { margin-top: 15px; }
                        .remarks-section h3 { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
                        .remarks-box { border: 1px solid #e2e8f0; padding: 8px; border-radius: 4px; min-height: 40px; background: #f8fafc; }

                        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; max-width: 500px; }
                        .sig-line { border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: left; font-weight: 600; font-size: 10px; color: #475569; }
                        
                        .footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 9px; color: #94a3b8; }
                        
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="company-info">
                                <h1>MASTER-ERP</h1>
                                <p>Industrial Solutions & Services</p>
                                <p>Ahmedabad, Gujarat, India</p>
                            </div>
                            <div class="document-title">
                                <h2>QUOTATION</h2>
                                <p>${quotation.quotationNo}</p>
                            </div>
                        </div>

                        <div class="details-grid">
                            <div class="info-box">
                                <h3>Customer Details</h3>
                                <div class="info-item"><strong>Customer</strong><span>${quotation.customerName}</span></div>
                                <div class="info-item"><strong>Contact Person</strong><span>${quotation.contactPersonName}</span></div>
                                <div class="info-item"><strong>Contact Number</strong><span>${quotation.contactNumber}</span></div>
                                <div class="info-item"><strong>Billing Address</strong><span>${quotation.billingAddress}</span></div>
                                <div class="info-item"><strong>Shipping Address</strong><span>${quotation.shippingAddress}</span></div>
                            </div>
                            <div class="info-box">
                                <h3>Quotation Details</h3>
                                <div class="info-item"><strong>Quotation Date</strong><span>${formattedQuotationDate}</span></div>
                                <div class="info-item"><strong>Currency</strong><span>${quotation.currency}</span></div>
                                <div class="info-item"><strong>Delivery Time</strong><span>${quotation.deliveryTime ? format(new Date(quotation.deliveryTime), "dd-MM-yyyy") : "N/A"}</span></div>
                                <div class="info-item"><strong>Validity</strong><span>${quotation.quotationValidity ? format(new Date(quotation.quotationValidity), "dd-MM-yyyy") : "N/A"}</span></div>
                                <div class="info-item"><strong>Status</strong><span>${quotation.status}</span></div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th width="50">#</th>
                                    <th>Item</th>
                                    <th width="80" class="text-right">Quantity</th>
                                    <th width="100" class="text-right">Rate</th>
                                    <th width="120" class="text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${quotation.items.map((item, index) => `
                                    <tr>
                                        <td class="text-right">${index + 1}</td>
                                        <td class="font-bold">${item.item}</td>
                                        <td class="text-right">${item.qty}</td>
                                        <td class="text-right">${getCurrencySymbol(quotation.currency)} ${item.rate.toFixed(2)}</td>
                                        <td class="text-right font-bold">${getCurrencySymbol(quotation.currency)} ${item.amount.toFixed(2)}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>

                        <div class="totals-section">
                            <div class="totals-box">
                                <div class="totals-row">
                                    <span class="totals-label">Subtotal</span>
                                    <span class="totals-value">${getCurrencySymbol(quotation.currency)} ${quotation.subtotal.toFixed(2)}</span>
                                </div>
                                <div class="totals-row">
                                    <span class="totals-label">Tax (${quotation.taxPercentage}%)</span>
                                    <span class="totals-value">${getCurrencySymbol(quotation.currency)} ${quotation.taxAmount.toFixed(2)}</span>
                                </div>
                                <div class="totals-row">
                                    <span class="totals-label">Total</span>
                                    <span class="totals-value">${getCurrencySymbol(quotation.currency)} ${quotation.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        ${quotation.paymentTerms.length > 0 ? `
                            <div class="payment-terms">
                                <h3>Payment Terms</h3>
                                 <table>
                                    <thead>
                                        <tr>
                                            <th width="40">#</th>
                                            <th width="90">Percentage</th>
                                            <th width="100">Terms</th>
                                            <th width="80">Days</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${quotation.paymentTerms.map((term, index) => `
                                            <tr>
                                                <td class="text-right">${index + 1}</td>
                                                <td>${term.value || term.percentage || 0}</td>
                                                <td>${term.terms}</td>
                                                <td>${term.terms === "Days" ? (term.days || "-") : "-"}</td>
                                                <td>${term.date ? format(new Date(term.date), "dd-MM-yyyy") : "-"}</td>
                                            </tr>
                                        `).join("")}
                                    </tbody>
                                </table>
                            </div>
                        ` : ""}

                        ${quotation.remarks ? `
                            <div class="remarks-section">
                                <h3>Remarks</h3>
                                <div class="remarks-box">${quotation.remarks}</div>
                            </div>
                        ` : ""}

                        <div class="signatures">
                            <div class="sig-line">Prepared By</div>
                            <div class="sig-line">Authorized Signatory</div>
                        </div>

                        <div class="footer">
                            <p>This is a computer generated document. Generated on ${format(new Date(), "dd-MM-yyyy, HH:mm")}</p>
                            <p>Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
                        </div>
                    </div>
                </body>
            </html>
        `;

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
            doc.open();
            doc.write(htmlContent);
            doc.close();

            // Wait for styles and fonts to load
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            }, 500);
        }
    };

    // Download Invoice PDF (reused from Invoicing.tsx)
    const handleDownloadInvoice = () => {
        if (!activeSO) return;

        // Use a hidden iframe to print/download
        let iframe = document.getElementById("so-invoice-print-iframe") as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement("iframe");
            iframe.id = "so-invoice-print-iframe";
            iframe.style.position = "absolute";
            iframe.style.width = "0px";
            iframe.style.height = "0px";
            iframe.style.border = "none";
            document.body.appendChild(iframe);
        }

        const { subtotal, discountAmount, totalTax, grandTotal } = calculateTotals(activeSO.items, activeSO.discountValue || 0, activeSO.discountType || "%", activeSO.taxValue || 0, activeSO.taxType || "%");
        const formattedSODate = format(new Date(activeSO.soDate), "dd-MM-yyyy");
        const formattedDeliveryDate = activeSO.deliveryDate ? format(new Date(activeSO.deliveryDate), "dd-MM-yyyy") : "N/A";

        const htmlContent = `
            <html>
                <head>
                    <title>Invoice - ${activeSO.soNumber}</title>
                    <style>
                        @page { size: A4; margin: 10mm; }
                        body { font-family: 'Inter', system-ui, sans-serif; padding: 0; color: #111; line-height: 1.4; font-size: 11px; }
                        .container { width: 100%; max-width: 100%; margin: 0 auto; }
                        
                        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 15px; }
                        .company-info h1 { margin: 0; color: #1e40af; font-size: 22px; font-weight: 800; text-transform: uppercase; }
                        .company-info p { margin: 2px 0; color: #64748b; font-size: 10px; }
                        
                        .document-title { text-align: right; }
                        .document-title h2 { margin: 0; font-size: 18px; color: #1e293b; }
                        .document-title p { margin: 2px 0; font-weight: 700; color: #1e40af; font-size: 12px; }

                        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                        .info-box { border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; }
                        .info-box h3 { margin: 0 0 6px 0; font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
                        .info-item { margin-bottom: 4px; display: flex; }
                        .info-item strong { width: 110px; color: #475569; font-size: 10px; flex-shrink: 0; }
                        .info-item span { color: #1e293b; font-weight: 500; }

                        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                        th { background-color: #f8fafc; color: #475569; font-size: 9px; text-transform: uppercase; padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; }
                        td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 10px; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: 700; }

                        .terms-section { margin-top: 15px; }
                        .terms-section h3 { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }

                        .remarks-section { margin-top: 15px; }
                        .remarks-section h3 { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
                        .remarks-box { border: 1px solid #e2e8f0; padding: 8px; border-radius: 4px; min-height: 40px; background: #f8fafc; }

                        .totals-section { margin-top: 20px; display: flex; justify-content: flex-end; }
                        .totals-box { width: 300px; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; background: #f8fafc; }
                        .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
                        .total-row.grand { border-top: 2px solid #1e40af; padding-top: 8px; margin-top: 8px; font-size: 14px; font-weight: 800; color: #1e40af; }

                        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; max-width: 500px; }
                        .sig-line { border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: left; font-weight: 600; font-size: 10px; color: #475569; }
                        
                        .footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 9px; color: #94a3b8; }
                        
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="company-info">
                                <h1>MASTER-ERP</h1>
                                <p>Industrial Solutions & Services</p>
                                <p>Ahmedabad, Gujarat, India</p>
                            </div>
                            <div class="document-title">
                                <h2>TAX INVOICE</h2>
                                <p>${activeSO.soNumber}</p>
                            </div>
                        </div>

                        <div class="details-grid">
                            <div class="info-box">
                                <h3>Bill To</h3>
                                <div class="info-item"><strong>Customer</strong><span>${activeSO.customerName}</span></div>
                                <div class="info-item"><strong>Contact Person</strong><span>${activeSO.contactPerson}</span></div>
                                <div class="info-item"><strong>Mobile</strong><span>${activeSO.mobileNo || "N/A"}</span></div>
                                <div class="info-item"><strong>Billing Address</strong><span>${activeSO.billingAddress}</span></div>
                            </div>
                            <div class="info-box">
                                <h3>Invoice Details</h3>
                                <div class="info-item"><strong>SO Number</strong><span>${activeSO.soNumber}</span></div>
                                <div class="info-item"><strong>SO Date</strong><span>${formattedSODate}</span></div>
                                <div class="info-item"><strong>Delivery Date</strong><span>${formattedDeliveryDate}</span></div>
                                <div class="info-item"><strong>Currency</strong><span style="font-weight: 700; color: #1e40af;">${activeSO.currency || "USD"}</span></div>
                                <div class="info-item"><strong>Shipping Address</strong><span>${activeSO.shippingAddress}</span></div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th width="50">#</th>
                                    <th>Item Name</th>
                                    <th width="80" class="text-right">Qty</th>
                                    <th width="80" class="text-right">Rate</th>
                                    <th width="100" class="text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${activeSO.items.map((item, index) => `
                                    <tr>
                                        <td class="text-center">${index + 1}</td>
                                        <td class="font-bold">${item.itemName}</td>
                                        <td class="text-right">${item.orderedQty}</td>
                                        <td class="text-right">USh ${item.rate.toFixed(2)}</td>
                                        <td class="text-right font-bold" style="color: #1e40af;">USh ${item.price.toFixed(2)}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>

                        ${activeSO.terms.length > 0 ? `
                            <div class="terms-section">
                                <h3>Payment Terms</h3>
                                 <table>
                                    <thead>
                                        <tr>
                                            <th width="100">Payment %</th>
                                            <th width="150">Term Type</th>
                                            <th width="80">Days</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${activeSO.terms.map(term => `
                                            <tr>
                                                <td class="font-bold">${term.value || term.percentage || 0}</td>
                                                <td>${term.termType}</td>
                                                <td>${term.termType === "Days" ? (term.days || "-") : "-"}</td>
                                                <td>${term.date ? format(new Date(term.date), "dd-MM-yyyy") : "-"}</td>
                                            </tr>
                                        `).join("")}
                                    </tbody>
                                </table>
                            </div>
                        ` : ""}

                        ${activeSO.remarks ? `
                            <div class="remarks-section">
                                <h3>Remarks / Special Instructions</h3>
                                <div class="remarks-box">${activeSO.remarks}</div>
                            </div>
                        ` : ""}

                        <div class="totals-section">
                            <div class="totals-box">
                                <div class="total-row">
                                    <span>Subtotal:</span>
                                    <span class="font-bold">USh ${subtotal.toFixed(2)}</span>
                                </div>
                                <div class="total-row">
                                    <span>Discount (${activeSO.discountValue || 0}${activeSO.discountType === "%" ? "%" : ""}):</span>
                                    <span class="font-bold" style="color: #dc2626;">-USh ${discountAmount.toFixed(2)}</span>
                                </div>
                                <div class="total-row">
                                    <span>Tax (${activeSO.taxPercentage}%):</span>
                                    <span class="font-bold" style="color: #16a34a;">+USh ${totalTax.toFixed(2)}</span>
                                </div>
                                <div class="total-row grand">
                                    <span>Grand Total:</span>
                                    <span>USh ${grandTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div class="signatures">
                            <div class="sig-line">Prepared By</div>
                            <div class="sig-line">Authorized Signatory</div>
                        </div>

                        <div class="footer">
                            <p>This is a computer generated document. Generated on ${format(new Date(), "PPpp")}</p>
                            <p>Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
                        </div>
                    </div>
                </body>
            </html>
        `;

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
            doc.open();
            doc.write(htmlContent);
            doc.close();

            // Wait for styles and fonts to load
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            }, 500);
        }
    };

    // Download Dispatch Note PDF (reused from Dispatch.tsx)
    const handleDownloadDispatchNote = () => {
        if (!activeSO) return;

        // Use a hidden iframe to print/download
        let iframe = document.getElementById("so-dispatch-print-iframe") as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement("iframe");
            iframe.id = "so-dispatch-print-iframe";
            iframe.style.position = "absolute";
            iframe.style.width = "0px";
            iframe.style.height = "0px";
            iframe.style.border = "none";
            document.body.appendChild(iframe);
        }

        const formattedSODate = format(new Date(activeSO.soDate), "dd/MM/yyyy");

        const htmlContent = `
            <html>
                <head>
                    <title>Dispatch Note - ${activeSO.soNumber}</title>
                    <style>
                        @page { size: A4; margin: 10mm; }
                        body { font-family: 'Inter', system-ui, sans-serif; padding: 0; color: #111; line-height: 1.4; font-size: 11px; }
                        .container { width: 100%; max-width: 100%; margin: 0 auto; }
                        
                        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 15px; }
                        .company-info h1 { margin: 0; color: #1e40af; font-size: 22px; font-weight: 800; text-transform: uppercase; }
                        .company-info p { margin: 2px 0; color: #64748b; font-size: 10px; }
                        
                        .document-title { text-align: right; }
                        .document-title h2 { margin: 0; font-size: 18px; color: #1e293b; }
                        .document-title p { margin: 2px 0; font-weight: 700; color: #1e40af; font-size: 12px; }

                        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                        .info-box { border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; }
                        .info-box h3 { margin: 0 0 6px 0; font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
                        .info-item { margin-bottom: 4px; display: flex; }
                        .info-item strong { width: 90px; color: #475569; font-size: 10px; flex-shrink: 0; }
                        .info-item span { color: #1e293b; font-weight: 500; }

                        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                        th { background-color: #f8fafc; color: #475569; font-size: 9px; text-transform: uppercase; padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; }
                        td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 10px; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: 700; }

                        .remarks-section { margin-top: 15px; }
                        .remarks-section h3 { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
                        .remarks-box { border: 1px solid #e2e8f0; padding: 8px; border-radius: 4px; min-height: 40px; background: #f8fafc; }

                        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; max-width: 500px; }
                        .sig-line { border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: left; font-weight: 600; font-size: 10px; color: #475569; }
                        
                        .footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 9px; color: #94a3b8; }
                        
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="company-info">
                                <h1>MASTER-ERP</h1>
                                <p>Industrial Solutions & Services</p>
                                <p>Ahmedabad, Gujarat, India</p>
                            </div>
                            <div class="document-title">
                                <h2>DISPATCH NOTE</h2>
                                <p># DSP-${activeSO.id}</p>
                            </div>
                        </div>

                        <div class="details-grid">
                            <div class="info-box">
                                <h3>Customer Details</h3>
                                <div class="info-item"><strong>Customer</strong><span>${activeSO.customerName}</span></div>
                                <div class="info-item"><strong>Address</strong><span>${activeSO.shippingAddress || "N/A"}</span></div>
                            </div>
                            <div class="info-box">
                                <h3>Order Details</h3>
                                <div class="info-item"><strong>SO Number</strong><span>${activeSO.soNumber}</span></div>
                                <div class="info-item"><strong>Warehouse</strong><span>${activeSO.warehouse || "Main Warehouse"}</span></div>
                                <div class="info-item"><strong>Dispatch Date</strong><span>${formattedSODate}</span></div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th width="50">#</th>
                                    <th>Item Name</th>
                                    <th width="60">UOM</th>
                                    <th width="80" class="text-right">Ordered</th>
                                    <th width="80" class="text-right">Dispatched</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${activeSO.items.map((item, index) => `
                                    <tr>
                                        <td class="text-right">${index + 1}</td>
                                        <td class="font-bold">${item.itemName}</td>
                                        <td>${item.uom}</td>
                                        <td class="text-right">${item.orderedQty}</td>
                                        <td class="text-right font-bold" style="color: #1e40af;">${item.dispatchedQty}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>

                        ${activeSO.remarks ? `
                            <div class="remarks-section">
                                <h3>Remarks / Special Instructions</h3>
                                <div class="remarks-box">${activeSO.remarks}</div>
                            </div>
                        ` : ""}

                        <div class="signatures">
                            <div class="sig-line">Prepared By</div>
                            <div class="sig-line">Authorized Signatory</div>
                        </div>

                        <div class="footer">
                            <p>This is a computer generated document. Generated on ${format(new Date(), "PPpp")}</p>
                            <p>Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
                        </div>
                    </div>
                </body>
            </html>
        `;

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
            doc.open();
            doc.write(htmlContent);
            doc.close();

            // Wait for styles and fonts to load
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            }, 500);
        }
    };

    // Download Dispatch Note from preview - accepts SO parameter
    const handleDownloadDispatchNoteFromPreview = (so: SOData) => {
        if (!so) return;

        // Use a hidden iframe to print/download
        let iframe = document.getElementById("so-dispatch-print-iframe-preview") as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement("iframe");
            iframe.id = "so-dispatch-print-iframe-preview";
            iframe.style.position = "absolute";
            iframe.style.width = "0px";
            iframe.style.height = "0px";
            iframe.style.border = "none";
            document.body.appendChild(iframe);
        }

        const formattedSODate = format(new Date(so.soDate), "dd/MM/yyyy");

        const htmlContent = `
            <html>
                <head>
                    <title>Dispatch Note - ${so.soNumber}</title>
                    <style>
                        @page { size: A4; margin: 10mm; }
                        body { font-family: 'Inter', system-ui, sans-serif; padding: 0; color: #111; line-height: 1.4; font-size: 11px; }
                        .container { width: 100%; max-width: 100%; margin: 0 auto; }
                        
                        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 15px; }
                        .company-info h1 { margin: 0; color: #1e40af; font-size: 22px; font-weight: 800; text-transform: uppercase; }
                        .company-info p { margin: 2px 0; color: #64748b; font-size: 10px; }
                        
                        .document-title { text-align: right; }
                        .document-title h2 { margin: 0; font-size: 18px; color: #1e293b; }
                        .document-title p { margin: 2px 0; font-weight: 700; color: #1e40af; font-size: 12px; }

                        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                        .info-box { border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; }
                        .info-box h3 { margin: 0 0 6px 0; font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
                        .info-item { margin-bottom: 4px; display: flex; }
                        .info-item strong { width: 90px; color: #475569; font-size: 10px; flex-shrink: 0; }
                        .info-item span { color: #1e293b; font-weight: 500; }

                        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                        th { background-color: #f8fafc; color: #475569; font-size: 9px; text-transform: uppercase; padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; }
                        td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 10px; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: 700; }

                        .remarks-section { margin-top: 15px; }
                        .remarks-section h3 { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
                        .remarks-box { border: 1px solid #e2e8f0; padding: 8px; border-radius: 4px; min-height: 40px; background: #f8fafc; }

                        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; max-width: 500px; }
                        .sig-line { border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: left; font-weight: 600; font-size: 10px; color: #475569; }
                        
                        .footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 9px; color: #94a3b8; }
                        
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="company-info">
                                <h1>MASTER-ERP</h1>
                                <p>Industrial Solutions & Services</p>
                                <p>Ahmedabad, Gujarat, India</p>
                            </div>
                            <div class="document-title">
                                <h2>DISPATCH NOTE</h2>
                                <p># DSP-${so.id}</p>
                            </div>
                        </div>

                        <div class="details-grid">
                            <div class="info-box">
                                <h3>Customer Details</h3>
                                <div class="info-item"><strong>Customer</strong><span>${so.customerName}</span></div>
                                <div class="info-item"><strong>Address</strong><span>${so.shippingAddress || "N/A"}</span></div>
                            </div>
                            <div class="info-box">
                                <h3>Order Details</h3>
                                <div class="info-item"><strong>SO Number</strong><span>${so.soNumber}</span></div>
                                <div class="info-item"><strong>Warehouse</strong><span>${so.warehouse || "Main Warehouse"}</span></div>
                                <div class="info-item"><strong>Dispatch Date</strong><span>${formattedSODate}</span></div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th width="50">#</th>
                                    <th>Item Name</th>
                                    <th width="60">UOM</th>
                                    <th width="80" class="text-right">Ordered</th>
                                    <th width="80" class="text-right">Dispatched</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${so.items.map((item, index) => `
                                    <tr>
                                        <td class="text-right">${index + 1}</td>
                                        <td class="font-bold">${item.itemName}</td>
                                        <td>${item.uom}</td>
                                        <td class="text-right">${item.orderedQty}</td>
                                        <td class="text-right font-bold" style="color: #1e40af;">${item.dispatchedQty}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>

                        ${so.remarks ? `
                            <div class="remarks-section">
                                <h3>Remarks / Special Instructions</h3>
                                <div class="remarks-box">${so.remarks}</div>
                            </div>
                        ` : ""}

                        <div class="signatures">
                            <div class="sig-line">Prepared By</div>
                            <div class="sig-line">Authorized Signatory</div>
                        </div>

                        <div class="footer">
                            <p>This is a computer generated document. Generated on ${format(new Date(), "PPpp")}</p>
                            <p>Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
                        </div>
                    </div>
                </body>
            </html>
        `;

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (doc) {
            doc.open();
            doc.write(htmlContent);
            doc.close();

            // Wait for styles and fonts to load
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            }, 500);
        }
    };

    // Download Quotation from preview - Using unified template
        const handleDownloadQuotationFromPreview = (quotationRef?: string) => {
            const refToUse = quotationRef || previewSO?.quotationRef;

            if (!refToUse) {
                toast({
                    title: "No Quotation",
                    description: "This Sales Order does not have a linked quotation.",
                    variant: "destructive"
                });
                return;
            }

            // Find the quotation data
            const quotations = getQuotations();
            const quotation = quotations.find(q => q.quotationNo === refToUse);

            if (!quotation) {
                toast({
                    title: "Quotation Not Found",
                    description: `Could not find quotation ${refToUse}`,
                    variant: "destructive"
                });
                return;
            }

            // Use unified quotation PDF template
            const pdfContent = generateQuotationPDFHTML(quotation);

            // Create a hidden iframe for printing
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
            if (iframeDoc) {
                iframeDoc.open();
                iframeDoc.write(pdfContent);
                iframeDoc.close();

                // Wait for images and resources to load
                const printIframe = () => {
                    const win = iframe.contentWindow;
                    if (win) {
                        win.focus();
                        win.print();
                        // Clean up after printing
                        setTimeout(() => {
                            document.body.removeChild(iframe);
                        }, 1000);
                    }
                };

                if (iframe.contentWindow) {
                    // Some browsers need a small delay
                    setTimeout(printIframe, 500);
                }
            } else {
                toast({
                    title: "Error",
                    description: "Could not initialize printing",
                    variant: "destructive"
                });
                document.body.removeChild(iframe);
            }

            toast({
                title: "Printing",
                description: "Preparing quotation for print..."
            });
        }

    // Download Sales Order PDF from preview
    // Download Sales Order PDF from preview
        const handleDownloadSOPDF = (so: SOData) => {
            if (!so) return;

            // Use a hidden iframe to print/download
            let iframe = document.getElementById("so-pdf-preview-print-iframe") as HTMLIFrameElement;
            if (!iframe) {
                iframe = document.createElement("iframe");
                iframe.id = "so-pdf-preview-print-iframe";
                iframe.style.position = "absolute";
                iframe.style.width = "0px";
                iframe.style.height = "0px";
                iframe.style.border = "none";
                document.body.appendChild(iframe);
            }

            const { subtotal, discountAmount, totalTax, grandTotal } = calculateTotals(so.items, so.discountValue || 0, so.discountType || "%", so.taxValue || 0, so.taxType || "%");
            const formattedSODate = format(new Date(so.soDate), "dd-MM-yyyy");
            const formattedDeliveryDate = so.deliveryDate ? format(new Date(so.deliveryDate), "dd-MM-yyyy") : "N/A";

            const htmlContent = `
                <html>
                    <head>
                        <title>Sales Order - ${so.soNumber}</title>
                        <style>
                            @page { size: A4; margin: 15mm; }
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; line-height: 1.4; background: white; font-size: 11px; }
                            .container { width: 100%; max-width: 100%; margin: 0 auto; }

                            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; page-break-after: avoid; }
                            .company-info h1 { margin: 0; color: #2563eb; font-size: 22px; font-weight: bold; margin-bottom: 3px; }
                            .company-info p { margin: 2px 0; color: #666; font-size: 10px; line-height: 1.3; }

                            .document-title { text-align: right; }
                            .document-title h2 { margin: 0; font-size: 20px; color: #1e293b; margin-bottom: 3px; }
                            .document-title p { margin: 2px 0; color: #666; font-size: 11px; }

                            .section { margin-bottom: 16px; page-break-inside: avoid; }
                            .section-title { font-weight: 600; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; page-break-after: avoid; }

                            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; }
                            .info-item { margin-bottom: 0; }
                            .info-label { font-size: 9px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
                            .info-value { font-size: 11px; color: #1e293b; font-weight: 500; }

                            .remarks-text { color: #475569; font-size: 10px; line-height: 1.5; }

                            .bullet-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; line-height: 1.5; }
                            .bullet-point { color: #2563eb; font-weight: bold; font-size: 14px; flex-shrink: 0; margin-top: 1px; }
                            .bullet-text { color: #475569; font-size: 10px; }

                            table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; page-break-inside: avoid; }
                            thead { background-color: #f8fafc; page-break-after: avoid; }
                            th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
                            th.text-right { text-align: right; }
                            td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; font-size: 10px; }
                            td.text-right { text-align: right; }

                            .totals-section { margin-top: 12px; display: flex; justify-content: flex-end; }
                            .totals-box { width: 280px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
                            .totals-row { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
                            .totals-row:last-child { border-bottom: none; }
                            .totals-row.subtotal { background-color: #f8fafc; }
                            .totals-row.total { background-color: #2563eb; color: white; font-weight: bold; font-size: 12px; }
                            .totals-label { color: #64748b; }
                            .totals-row.total .totals-label { color: white; }
                            .totals-value { font-weight: 600; color: #1e293b; }
                            .totals-row.total .totals-value { color: white; }

                            .footer { margin-top: 15px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; color: #94a3b8; line-height: 1.4; page-break-inside: avoid; }

                            @media print {
                                body { padding: 0; }
                                @page { margin: 15mm; size: A4 portrait; }
                                * { page-break-inside: avoid; }
                            }
                        </style>
                    </head>
                    <body>
                        <!-- Header -->
                        <div class="header">
                            <div class="company-info">
                                <h1>MASTER-ERP</h1>
                                <p>Industrial Solutions & Services<br>Ahmedabad, Gujarat, India</p>
                            </div>
                            <div class="document-title">
                                <h2>SALES ORDER</h2>
                                <p># ${so.soNumber}</p>
                            </div>
                        </div>

                        <!-- Sales Order Details -->
                        <div class="section">
                            <div class="section-title">Sales Order Details</div>
                            <div class="info-grid">
                                <div class="info-item">
                                    <div class="info-label">SO Number</div>
                                    <div class="info-value">${so.soNumber}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">SO Date</div>
                                    <div class="info-value">${formattedSODate}</div>
                                </div>
                                ${so.quotationRef ? `
                                <div class="info-item">
                                    <div class="info-label">Quotation Reference</div>
                                    <div class="info-value">${so.quotationRef}</div>
                                </div>
                                ` : ''}
                                <div class="info-item">
                                    <div class="info-label">Delivery Date</div>
                                    <div class="info-value">${formattedDeliveryDate}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Currency</div>
                                    <div class="info-value">${so.currency}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Customer Information -->
                        <div class="section">
                            <div class="section-title">Customer Information</div>
                            <div class="info-grid">
                                <div class="info-item">
                                    <div class="info-label">Customer Name</div>
                                    <div class="info-value">${so.customerName}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Contact Person</div>
                                    <div class="info-value">${so.contactPerson || '—'}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Mobile Number</div>
                                    <div class="info-value">${so.mobileNo || '—'}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Billing Address</div>
                                    <div class="info-value">${so.billingAddress || '—'}</div>
                                </div>
                                <div class="info-item" style="grid-column: span 2;">
                                    <div class="info-label">Shipping Address</div>
                                    <div class="info-value">${so.shippingAddress || '—'}</div>
                                </div>
                            </div>
                        </div>

                        ${so.remarks ? `
                        <!-- Remarks -->
                        <div class="section">
                            <div class="section-title">Remarks</div>
                            <p class="remarks-text">${so.remarks}</p>
                        </div>
                        ` : ''}

                        ${so.terms && so.terms.length > 0 ? `
                        <!-- Payment Terms -->
                        <div class="section">
                            <div class="section-title">Payment Terms</div>
                            <div>
                                ${so.terms.map(term => {
                                    const value = term.value || term.percentage || 0;
                                    const displayValue = `${value}%`;

                                    let termText = "";
                                    if (term.termType === "Advance") {
                                        termText = `${displayValue} payment required at order confirmation.`;
                                    } else if (term.termType === "Delivery") {
                                        termText = `${displayValue} payment due at the time of delivery.`;
                                    } else if (term.termType === "Days") {
                                        termText = `${displayValue} payment due within ${term.days || 0} days.`;
                                    }

                                    return `
                                        <div class="bullet-item">
                                            <span class="bullet-point">•</span>
                                            <span class="bullet-text">${termText}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        ` : ''}

                        <!-- Items -->
                        <div class="section">
                            <div class="section-title">Items</div>
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 8%;">#</th>
                                        <th style="width: ${so.status === 'Dispatched' ? '32%' : '42%'};">Item</th>
                                        <th class="text-right" style="width: 12%;">Qty</th>
                                        <th class="text-right" style="width: ${so.status === 'Dispatched' ? '14%' : '18%'};">Rate</th>
                                        <th class="text-right" style="width: ${so.status === 'Dispatched' ? '16%' : '20%'};">Price</th>
                                        ${so.status === 'Dispatched' ? '<th class="text-right" style="width: 18%;">Dispatched Qty</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${so.items.map((item, index) => `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td><strong>${item.itemName}</strong></td>
                                            <td class="text-right">${item.orderedQty}</td>
                                            <td class="text-right">${getCurrencySymbol(so.currency)} ${item.rate.toFixed(2)}</td>
                                            <td class="text-right"><strong>${getCurrencySymbol(so.currency)} ${item.price.toFixed(2)}</strong></td>
                                            ${so.status === 'Dispatched' ? `<td class="text-right" style="color: #2563eb; font-weight: 600;"><strong>${item.dispatchedQty}</strong></td>` : ''}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>

                            <!-- Totals -->
                            <div class="totals-section">
                                <div class="totals-box">
                                    <div class="totals-row subtotal">
                                        <span class="totals-label">Sub Total</span>
                                        <span class="totals-value">${getCurrencySymbol(so.currency)} ${subtotal.toFixed(2)}</span>
                                    </div>
                                    ${so.discountValue && so.discountValue > 0 ? `
                                    <div class="totals-row">
                                        <span class="totals-label">Discount (${so.discountValue}${so.discountType === "%" ? "%" : ""})</span>
                                        <span class="totals-value">-${getCurrencySymbol(so.currency)} ${discountAmount.toFixed(2)}</span>
                                    </div>
                                    ` : ''}
                                    <div class="totals-row">
                                        <span class="totals-label">Tax (${so.taxValue || 0}${so.taxType === "%" ? "%" : ""})</span>
                                        <span class="totals-value">${getCurrencySymbol(so.currency)} ${totalTax.toFixed(2)}</span>
                                    </div>
                                    <div class="totals-row total">
                                        <span class="totals-label">Grand Total</span>
                                        <span class="totals-value">${getCurrencySymbol(so.currency)} ${grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div class="footer">
                            <p>This is a computer-generated sales order document. Generated on ${format(new Date(), "dd-MM-yyyy, HH:mm")}.</p>
                            <p>Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
                        </div>
                    </body>
                </html>
            `;

            const doc = iframe.contentWindow?.document || iframe.contentDocument;
            if (doc) {
                doc.open();
                doc.write(htmlContent);
                doc.close();

                // Wait for styles and fonts to load
                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                }, 500);
            }
        }

    // Download Invoice PDF from Dispatch Pending Preview
    // This handler is specifically for the Invoice button in Dispatch Pending PDF preview modal
    // Uses the unified Accounting Invoice template for consistency
    const handleDownloadInvoiceFromDispatchPreview = (so: SOData) => {
            if (!so) return;

            // Find the linked invoice for this SO
            const allInvoices = getInvoices();
            const linkedInvoice = allInvoices.find(inv => inv.soNumber === so.soNumber);

            if (!linkedInvoice) {
                toast({
                    title: "Invoice Not Found",
                    description: `No invoice found for Sales Order ${so.soNumber}`,
                    variant: "destructive"
                });
                return;
            }

            // Map invoice data to InvoicePDFData format
            const invoicePDFData: InvoicePDFData = {
                invoiceNumber: linkedInvoice.invoiceNumber,
                invoiceDate: linkedInvoice.invoiceDate,
                status: linkedInvoice.status,
                customerName: linkedInvoice.customerName,
                contactPerson: linkedInvoice.contactPerson,
                mobileNo: linkedInvoice.mobileNo,
                billingAddress: linkedInvoice.billingAddress,
                shippingAddress: linkedInvoice.shippingAddress,
                soNumber: linkedInvoice.soNumber,
                soDate: linkedInvoice.soDate,
                deliveryDate: linkedInvoice.deliveryDate,
                currency: linkedInvoice.currency,
                remarks: linkedInvoice.remarks,
                terms: linkedInvoice.terms,
                items: linkedInvoice.items,
                taxPercentage: linkedInvoice.taxPercentage
            };

            // Generate HTML using the unified invoice template
            const htmlContent = generateInvoicePDFHTML(invoicePDFData);

            // Use a hidden iframe to print/download
            let iframe = document.getElementById("dispatch-invoice-print-iframe") as HTMLIFrameElement;
            if (!iframe) {
                iframe = document.createElement("iframe");
                iframe.id = "dispatch-invoice-print-iframe";
                iframe.style.position = "absolute";
                iframe.style.width = "0px";
                iframe.style.height = "0px";
                iframe.style.border = "none";
                document.body.appendChild(iframe);
            }

            const doc = iframe.contentWindow?.document || iframe.contentDocument;
            if (doc) {
                doc.open();
                doc.write(htmlContent);
                doc.close();

                // Wait for styles and fonts to load
                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                }, 500);
            }
        }

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sales Orders</h1>
                <p className="text-muted-foreground">Manage sales orders and customer deliveries.</p>
            </div>

            {/* Filter Section - Cloned from PO table structure */}
            <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-xl border shadow-sm">
                <div className="w-full sm:flex-1">
                    <Label className="mb-2 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Search Sales Order</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by SO No, Customer..."
                            className="pl-10 h-10 rounded-md border-input bg-background"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                </div>
                <div className="w-full sm:w-56">
                    <Label className="mb-2 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Filter By Date</Label>
                    <div className="flex gap-2">
                        <DatePicker date={filterDate} setDate={(date) => {
                            setFilterDate(date);
                            setCurrentPage(1);
                        }} />
                        {filterDate && (
                            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => {
                                setFilterDate(undefined);
                                setCurrentPage(1);
                            }}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        )}
                    </div>
                </div>
                <div className="w-full sm:w-48">
                    <Label className="mb-2 block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Filter By Status</Label>
                    <Select value={filterStatus} onValueChange={(val) => {
                        setFilterStatus(val);
                        setCurrentPage(1);
                    }}>
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="Draft">Draft</SelectItem>
                            <SelectItem value="Invoice Pending">Invoice Pending</SelectItem>
                            <SelectItem value="Dispatch Pending">Dispatch Pending</SelectItem>
                            <SelectItem value="Dispatched">Dispatched</SelectItem>
                            <SelectItem value="Closed SO">Closed SO</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-full sm:w-auto">
                    <Button
                        onClick={() => handleOpenSO(null, true)}
                        className="w-full sm:w-auto h-10 font-bold shadow-md"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Sales Order
                    </Button>
                </div>
            </div>
            {/* SO Table - Cloned from PO table structure, matching Materials styling */}
            <Card className="border shadow-sm overflow-hidden bg-white/50">
                <CardContent className="p-0">
                    <div className="rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4 pl-6">SO No</TableHead>
                                    <TableHead className="font-bold uppercase text-[11px] tracking-wider">SO Date</TableHead>
                                    <TableHead className="font-bold uppercase text-[11px] tracking-wider">Customer</TableHead>
                                    <TableHead className="font-bold uppercase text-[11px] tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-right font-bold uppercase text-[11px] tracking-wider pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                                            No Sales Orders found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((so) => (
                                        <TableRow key={so.id} className="hover:bg-muted/20 group transition-colors border-b last:border-none">
                                            <TableCell className="py-4 pl-6 font-medium text-xs text-primary">{so.soNumber}</TableCell>
                                            <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                {so.soDate.includes('-') ? format(new Date(so.soDate), "dd-MM-yyyy") : so.soDate}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm font-bold text-primary">{so.customerName}</TableCell>
                                            <TableCell className="py-4 text-center">
                                                {getSOStatusBadge(so.status)}
                                            </TableCell>
                                            <TableCell className="py-4 text-right pr-6">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        onClick={() => handleOpenSO(so, false)}
                                                        title="View (PDF Preview)"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {/* Edit button for Dispatched status - opens Close SO dialog */}
                                                    {so.status === "Dispatched" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                                            onClick={() => {
                                                                setDispatchedEditSO(so);
                                                                setIsDispatchedEditOpen(true);
                                                            }}
                                                            title="Edit (Close SO)"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {/* Edit/Delete allowed only when status = Draft */}
                                                    {so.status === "Draft" && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
                                                                onClick={() => handleOpenSO(so, true)}
                                                                title="Edit"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-slate-700"
                                                                onClick={() => {
                                                                    setSoToDelete(so);
                                                                    setIsDeleteAlertOpen(true);
                                                                }}
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* DataTablePagination - matching Materials pagination position */}
                    <div className="p-4 border-t">
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredSOs.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* SO DIALOG - Modal with all required fields */}
            <Dialog open={isSODialogOpen} onOpenChange={setIsSODialogOpen}>
                <DialogContent className="sm:max-w-[1200px] max-h-[95vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-2xl font-bold">
                            {activeSO?.id && salesOrders.find(so => so.id === activeSO.id) ?
                                (isSOEdit ? "Edit Sales Order" : "View Sales Order") :
                                "Create Sales Order"}
                        </DialogTitle>
                        <DialogDescription>
                            {activeSO?.status === "Draft" ? "Fill in the details to create or update a sales order." : "Review sales order details."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        {/* Header Info - Changed: Only show in Edit/View mode, not in Create mode */}
                        {activeSO?.id && salesOrders.find(so => so.id === activeSO.id) && (
                            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">SO Number</Label>
                                    <p className="text-sm font-bold text-primary">{activeSO?.soNumber}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">SO Date</Label>
                                    <p className="text-sm font-medium">{activeSO?.soDate}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                                    {activeSO && getSOStatusBadge(activeSO.status)}
                                </div>
                                {/* Payment Information - Show for Dispatched and Closed SO */}
                                {activeSO && (activeSO.status === "Dispatched" || activeSO.status === "Closed SO") && (
                                    <>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Payment Status</Label>
                                            <p className="text-sm font-medium">
                                                {(() => {
                                                    const dueAmount = activeSO.invoiceDueAmount ?? 0;
                                                    const { grandTotal } = calculateTotals(activeSO.items, activeSO.discountValue || 0, activeSO.discountType || "%", activeSO.taxValue || 0, activeSO.taxType || "%");
                                                    
                                                    if (dueAmount === 0) {
                                                        return <span className="text-green-600 font-bold">Completed</span>;
                                                    } else if (dueAmount < grandTotal) {
                                                        return <span className="text-orange-600 font-bold">Partial</span>;
                                                    } else {
                                                        return <span className="text-slate-700 font-bold">Pending</span>;
                                                    }
                                                })()}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Due Amount</Label>
                                            <p className="text-sm font-bold text-primary">
                                                {getCurrencySymbol(activeSO.currency)} {(activeSO.invoiceDueAmount ?? 0).toFixed(2)}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Modal Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Customer Select - Searchable Select (Required) - MOVED TO TOP */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Customer <span className="text-red-500">*</span></Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            disabled={activeSO?.status !== "Draft"}
                                            className={cn(
                                                "w-full h-10 justify-between font-normal",
                                                !selectedCustomer && !isManualEntry && "text-muted-foreground"
                                            )}
                                        >
                                            {isManualEntry ? "Manual Entry / New Customer" : (selectedCustomer || "Select Customer")}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" side="bottom" sideOffset={4}>
                                        <Command>
                                            <CommandInputBorderless placeholder="Search customer..." />
                                            <CommandList className="max-h-[200px] overflow-y-auto">
                                                <CommandEmpty>No customer found.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        value="Manual Entry / New Customer"
                                                        onSelect={() => handleCustomerSelect("Manual Entry / New Customer")}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                isManualEntry ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        Manual Entry / New Customer
                                                    </CommandItem>
                                                    {mockCustomers.map((c) => (
                                                        <CommandItem
                                                            key={c.id}
                                                            value={c.name}
                                                            onSelect={(val) => handleCustomerSelect(val)}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedCustomer === c.name ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {c.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Quotation Reference - Searchable Select (Optional) - MOVED BELOW CUSTOMER */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Quotation Reference (Optional)</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            disabled={activeSO?.status !== "Draft" || !selectedCustomer}
                                            className={cn(
                                                "w-full h-10 justify-between font-normal",
                                                !selectedQuotation && "text-muted-foreground"
                                            )}
                                        >
                                            {(() => {
                                                if (!selectedQuotation || selectedQuotation === "none") {
                                                    return selectedCustomer ? "Select Quotation (Optional)" : "Select Customer First";
                                                }
                                                const q = mockQuotations.find(item => item.quotationNo === selectedQuotation);
                                                return q ? `${q.quotationNo} - ${q.customerName}` : selectedQuotation;
                                            })()}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" side="bottom" sideOffset={4}>
                                        <Command>
                                            <CommandInputBorderless placeholder="Search quotation..." />
                                            <CommandList className="max-h-[200px] overflow-y-auto">
                                                <CommandEmpty>No quotation found.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        value="none"
                                                        onSelect={() => {
                                                            handleQuotationSelect("none");
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedQuotation === "none" ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        None
                                                    </CommandItem>
                                                    {mockQuotations
                                                        .filter(q => q.status === "Submitted Quote")
                                                        .filter(q => !salesOrders.some(so => so.quotationRef === q.quotationNo))
                                                        .filter(q => selectedCustomer && q.customerName === selectedCustomer)
                                                        .map((q) => (
                                                            <CommandItem
                                                                key={q.id}
                                                                value={`${q.quotationNo} ${q.customerName}`}
                                                                onSelect={() => {
                                                                    handleQuotationSelect(q.quotationNo!);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        (selectedQuotation && selectedQuotation === q.quotationNo) ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {q.quotationNo} - {q.customerName}
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Customer Name - Editable when manual entry */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Customer Name <span className="text-red-500">*</span>
                                    {!isManualEntry && <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>}
                                </Label>
                                <Input
                                    value={activeSO?.customerName || ""}
                                    onChange={(e) => activeSO && setActiveSO({ ...activeSO, customerName: e.target.value })}
                                    disabled={!isManualEntry || activeSO?.status !== "Draft"}
                                    className={cn("h-10", !isManualEntry && "bg-muted/50")}
                                    placeholder="Auto-filled from Quotation or Customer"
                                />
                            </div>

                            {/* Contact Person */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Contact Person
                                    {!isManualEntry && <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>}
                                </Label>
                                <Input
                                    value={activeSO?.contactPerson || ""}
                                    onChange={(e) => activeSO && setActiveSO({ ...activeSO, contactPerson: e.target.value })}
                                    disabled={!isManualEntry || activeSO?.status !== "Draft"}
                                    className={cn("h-10", !isManualEntry && "bg-muted/50")}
                                />
                            </div>

                            {/* Mobile No - Required when manual entry */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Mobile No <span className="text-red-500">*</span>
                                    {!isManualEntry && <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>}
                                </Label>
                                <Input
                                    value={activeSO?.mobileNo || ""}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                        if (activeSO) setActiveSO({ ...activeSO, mobileNo: value });
                                    }}
                                    disabled={!isManualEntry || activeSO?.status !== "Draft"}
                                    className={cn("h-10", !isManualEntry && "bg-muted/50")}
                                    maxLength={10}
                                />
                                {isManualEntry && activeSO?.mobileNo && !/^\d{10}$/.test(activeSO.mobileNo) && (
                                    <p className="text-xs text-red-500">Must be 10 digits</p>
                                )}
                            </div>

                            {/* Shipping Address */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Shipping Address
                                    {!isManualEntry && <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>}
                                </Label>
                                <Input
                                    value={activeSO?.shippingAddress || ""}
                                    onChange={(e) => activeSO && setActiveSO({ ...activeSO, shippingAddress: e.target.value })}
                                    disabled={!isManualEntry || activeSO?.status !== "Draft"}
                                    className={cn("h-10", !isManualEntry && "bg-muted/50")}
                                />
                            </div>

                            {/* Billing Address - Required */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Billing Address <span className="text-red-500">*</span>
                                    {!isManualEntry && <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>}
                                </Label>
                                <Input
                                    value={activeSO?.billingAddress || ""}
                                    onChange={(e) => activeSO && setActiveSO({ ...activeSO, billingAddress: e.target.value })}
                                    disabled={!isManualEntry || activeSO?.status !== "Draft"}
                                    className={cn("h-10", !isManualEntry && "bg-muted/50")}
                                />
                            </div>

                            {/* Currency */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Currency</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            disabled={activeSO?.status !== "Draft" || !!(selectedQuotation && selectedQuotation !== "none")}
                                            className={cn(
                                                "w-full h-10 justify-between font-normal",
                                                !activeSO?.currency && "text-muted-foreground"
                                            )}
                                        >
                                            {activeSO?.currency || "Select Currency"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" side="bottom" sideOffset={4}>
                                        <Command>
                                            <CommandInputBorderless placeholder="Search currency..." />
                                            <CommandList className="max-h-[200px] overflow-y-auto">
                                                <CommandEmpty>No currency found.</CommandEmpty>
                                                <CommandGroup>
                                                    {["USD", "EUR", "GBP", "INR", "JPY", "CNY", "AUD", "CAD"].map((curr) => (
                                                        <CommandItem
                                                            key={curr}
                                                            value={curr}
                                                            onSelect={(val) => {
                                                                if (activeSO) {
                                                                    setActiveSO({ ...activeSO, currency: val.toUpperCase() });
                                                                }
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    activeSO?.currency === curr ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {curr}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Delivery Date */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Delivery Date</Label>
                                <DatePicker
                                    date={activeSO?.deliveryDate ? new Date(activeSO.deliveryDate) : undefined}
                                    setDate={(d) => activeSO && setActiveSO({ ...activeSO, deliveryDate: d ? format(d, "yyyy-MM-dd") : "" })}
                                    disabled={activeSO?.status !== "Draft"}
                                />
                            </div>

                            {/* Remarks */}
                            <div className="space-y-2 col-span-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Remarks</Label>
                                <Textarea
                                    value={activeSO?.remarks || ""}
                                    onChange={(e) => {
                                        // Changed: Validation - Max 500 characters
                                        const value = e.target.value.slice(0, 500);
                                        if (activeSO) setActiveSO({ ...activeSO, remarks: value });
                                    }}
                                    disabled={activeSO?.status !== "Draft"}
                                    className="min-h-[60px]"
                                    maxLength={500}
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    {activeSO?.remarks?.length || 0}/500 characters
                                </p>
                            </div>
                        </div>

                        {/* Terms Section - New: Payment terms list */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold">Terms</Label>
                                {activeSO?.status === "Draft" && (
                                    <Button onClick={handleAddTerm} size="sm" variant="outline">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Term
                                    </Button>
                                )}
                            </div>
                            {activeSO && (
                                <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50 text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">
                                                <TableCell className="py-2 pl-6">Value</TableCell>
                                                <TableCell className="py-2">Term Type</TableCell>
                                                <TableCell className="py-2 text-center">Days</TableCell>
                                                <TableCell className="py-2 text-center">Date</TableCell>
                                                {activeSO?.status === "Draft" && (
                                                    <TableCell className="py-2 text-right pr-6">Actions</TableCell>
                                                )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activeSO.terms.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={activeSO.status === "Draft" ? 5 : 4} className="text-center py-8 text-muted-foreground italic">
                                                        No terms added yet
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                activeSO.terms.map((term) => {
                                                    // Get all term types that are already used (excluding current term)
                                                    const usedTermTypes = activeSO.terms
                                                        .filter(t => t.id !== term.id)
                                                        .map(t => t.termType);

                                                    return (
                                                        <TableRow key={term.id} className="hover:bg-muted/20">
                                                            {/* Value Type Column - Dropdown for % or Fixed Amount */}
                                                            {/* Value Column - Input for term value */}
                                                            <TableCell className="py-4">
                                                                {activeSO.status === "Draft" ? (
                                                                    <Input
                                                                        type="number"
                                                                        value={term.value || term.percentage || 0}
                                                                        onChange={(e) => {
                                                                            let val = parseFloat(e.target.value) || 0;
                                                                            if (val < 0) val = 0;

                                                                            if (val < 0) val = 0;

                                                                            const updated = activeSO.terms.map(t => 
                                                                                t.id === term.id 
                                                                                    ? { ...t, value: val, percentage: val } 
                                                                                    : t
                                                                            );
                                                                            setActiveSO({ ...activeSO, terms: updated });
                                                                        }}
                                                                        className="h-8 w-28 text-center"
                                                                        min="0"
                                                                        step="0.01"
                                                                    />
                                                                ) : (
                                                                    <span className="font-medium">
                                                                        {term.value || term.percentage || 0
                                                                        }
                                                                    </span>
                                                                )}
                                                            </TableCell>

                                                            {/* Term Type Column */}
                                                            <TableCell className="py-4">
                                                                {activeSO.status === "Draft" ? (
                                                                    <Select
                                                                        value={term.termType}
                                                                        onValueChange={(val: "Advance" | "Delivery" | "Days") => {
                                                                            // Check if this term type is already used
                                                                            if (usedTermTypes.includes(val)) {
                                                                                toast({
                                                                                    title: "Duplicate Term Type",
                                                                                    description: "This term type is already added.",
                                                                                    variant: "destructive"
                                                                                });
                                                                                return;
                                                                            }
                                                                            const updated = activeSO.terms.map(t => t.id === term.id ? { ...t, termType: val } : t);
                                                                            setActiveSO({ ...activeSO, terms: updated });
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-8 w-32">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="Advance" disabled={usedTermTypes.includes("Advance")}>
                                                                                Advance
                                                                            </SelectItem>
                                                                            <SelectItem value="Delivery" disabled={usedTermTypes.includes("Delivery")}>
                                                                                Delivery
                                                                            </SelectItem>
                                                                            <SelectItem value="Days" disabled={usedTermTypes.includes("Days")}>
                                                                                Days
                                                                            </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                ) : (
                                                                    <span className="font-medium">{term.termType}</span>
                                                                )}
                                                            </TableCell>

                                                            {/* Days Column */}
                                                            <TableCell className="py-4 text-center">
                                                                {activeSO.status === "Draft" && term.termType === "Days" ? (
                                                                    <Input
                                                                        type="number"
                                                                        value={term.days || ""}
                                                                        onChange={(e) => {
                                                                            const val = parseInt(e.target.value) || 0;
                                                                            const updated = activeSO.terms.map(t => t.id === term.id ? { ...t, days: val } : t);
                                                                            setActiveSO({ ...activeSO, terms: updated });
                                                                        }}
                                                                        className="h-8 w-16 text-center mx-auto"
                                                                        placeholder="-"
                                                                        min="1"
                                                                    />
                                                                ) : (
                                                                    <span className="font-medium text-muted-foreground">{term.termType === "Days" ? (term.days || "-") : "-"}</span>
                                                                )}
                                                            </TableCell>

                                                            {/* Date Column - Auto-filled after dispatch */}
                                                            <TableCell className="py-4 text-center">
                                                                <span className="font-medium text-muted-foreground">
                                                                    {activeSO.status === "Dispatched" && activeSO.dispatches && activeSO.dispatches.length > 0
                                                                        ? format(new Date(activeSO.dispatches[activeSO.dispatches.length - 1].dispatchDate), "dd-MM-yyyy")
                                                                        : "-"}
                                                                </span>
                                                            </TableCell>

                                                            {/* Actions Column */}
                                                            {activeSO.status === "Draft" && (
                                                                <TableCell className="py-4 text-right pr-6">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-slate-700"
                                                                        onClick={() => handleRemoveTerm(term.id)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            )}
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>

                        {/* SO Items Table */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold">Sales Order Items</Label>
                                {activeSO?.status === "Draft" && (
                                    <Button onClick={handleAddItem} size="sm" variant="outline">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Item
                                    </Button>
                                )}
                            </div>
                            <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-[10px] font-bold uppercase py-3 pl-6">Item Name</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Ordered Qty</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Rate</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Price</TableHead>
                                            {/* Dispatched Qty column only shown when status = Dispatched */}
                                            {activeSO?.status === "Dispatched" && (
                                                <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Dispatched Qty</TableHead>
                                            )}
                                            {activeSO?.status === "Draft" && (
                                                <TableHead className="text-[10px] font-bold uppercase py-3 text-right pr-6">Actions</TableHead>
                                            )}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeSO?.items.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={activeSO?.status === "Dispatched" ? 6 : (activeSO?.status === "Draft" ? 6 : 5)}
                                                    className="text-center py-8 text-muted-foreground italic"
                                                >
                                                    No items added yet
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            activeSO?.items.map((item) => (
                                                <TableRow key={item.id} className="hover:bg-muted/20">
                                                    <TableCell className="py-4 pl-6 min-w-[200px]">
                                                        {activeSO.status === "Draft" ? (
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        role="combobox"
                                                                        className={cn(
                                                                            "w-full h-9 justify-between font-normal",
                                                                            !item.itemName && "text-muted-foreground"
                                                                        )}
                                                                    >
                                                                        {item.itemName || "Select Item"}
                                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" side="bottom" sideOffset={4}>
                                                                    <Command>
                                                                        <CommandInputBorderless placeholder="Search item..." />
                                                                        <CommandList className="max-h-[200px] overflow-y-auto">
                                                                            <CommandEmpty>No item found.</CommandEmpty>
                                                                            <CommandGroup>
                                                                                {mockItems.map((mi) => (
                                                                                    <CommandItem
                                                                                        key={mi.id}
                                                                                        value={mi.name}
                                                                                        onSelect={(val) => {
                                                                                            const selectedItem = mockItems.find(mockItem => mockItem.name.toLowerCase() === val.toLowerCase());
                                                                                            if (selectedItem) {
                                                                                                const updated = activeSO.items.map(i =>
                                                                                                    i.id === item.id ? {
                                                                                                        ...i,
                                                                                                        itemCode: selectedItem.itemCode,
                                                                                                        itemName: selectedItem.name,
                                                                                                        uom: selectedItem.uom,
                                                                                                        rate: selectedItem.rate,
                                                                                                        price: 0
                                                                                                    } : i
                                                                                                );
                                                                                                setActiveSO({ ...activeSO, items: updated });
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <Check
                                                                                            className={cn(
                                                                                                "mr-2 h-4 w-4",
                                                                                                item.itemName === mi.name ? "opacity-100" : "opacity-0"
                                                                                            )}
                                                                                        />
                                                                                        {mi.name}
                                                                                    </CommandItem>
                                                                                ))}
                                                                            </CommandGroup>
                                                                        </CommandList>
                                                                    </Command>
                                                                </PopoverContent>
                                                            </Popover>
                                                        ) : (
                                                            <div className="font-bold text-sm text-primary">{item.itemName}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {/* Ordered Qty editable in Draft only - Changed: Auto-calculate price */}
                                                        {activeSO.status === "Draft" ? (
                                                            <Input
                                                                type="number"
                                                                value={item.orderedQty}
                                                                onChange={(e) => {
                                                                    // Changed: Validation - Max 6 digits, must be > 0
                                                                    let val = parseFloat(e.target.value) || 0;
                                                                    if (val < 0) val = 0;
                                                                    if (val > 999999) val = 999999;
                                                                    const updated = activeSO.items.map(i =>
                                                                        i.id === item.id ? {
                                                                            ...i,
                                                                            orderedQty: val,
                                                                            price: val * i.rate // Auto-calculate price
                                                                        } : i
                                                                    );
                                                                    setActiveSO({ ...activeSO, items: updated });
                                                                }}
                                                                className="h-8 w-20 text-center"
                                                                min="1"
                                                                max="999999"
                                                            />
                                                        ) : (
                                                            <span className="font-bold text-primary">{item.orderedQty}</span>
                                                        )}
                                                    </TableCell>
                                                    {/* Changed: Rate column instead of Price */}
                                                    <TableCell className="text-center">
                                                        {activeSO.status === "Draft" ? (
                                                            <Input
                                                                type="number"
                                                                value={item.rate}
                                                                onChange={(e) => {
                                                                    // Changed: Validation - Max 8 digits with decimal, no negative values
                                                                    let val = parseFloat(e.target.value) || 0;
                                                                    if (val < 0) val = 0;
                                                                    if (val > 99999999) val = 99999999;
                                                                    const updated = activeSO.items.map(i =>
                                                                        i.id === item.id ? {
                                                                            ...i,
                                                                            rate: val,
                                                                            price: i.orderedQty * val // Auto-calculate price
                                                                        } : i
                                                                    );
                                                                    setActiveSO({ ...activeSO, items: updated });
                                                                }}
                                                                className="h-8 w-24 text-center"
                                                                min="0"
                                                                max="99999999"
                                                                step="0.01"
                                                            />
                                                        ) : (
                                                            <span className="font-medium">${item.rate}</span>
                                                        )}
                                                    </TableCell>
                                                    {/* Changed: Price column (auto-calculated, read-only) */}
                                                    <TableCell className="text-center">
                                                        <span className="font-bold text-primary">USh {(Number(item.price) || 0).toFixed(2)}</span>
                                                    </TableCell>
                                                    {/* Dispatched Qty column only shown when status = Dispatched */}
                                                    {activeSO.status === "Dispatched" && (
                                                        <TableCell className="text-center">
                                                            <span className="font-medium text-slate-600">{item.dispatchedQty}</span>
                                                        </TableCell>
                                                    )}
                                                    {activeSO.status === "Draft" && (
                                                        <TableCell className="text-right pr-6">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-slate-700"
                                                                onClick={() => handleRemoveItem(item.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Totals Summary - Discount and Tax with % or Amount support */}
                        {activeSO && activeSO.items.length > 0 && (
                            <div className="flex justify-end">
                                <div className="w-80 space-y-2 p-4 bg-muted/30 rounded-lg border">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-muted-foreground">Subtotal:</span>
                                        <span className="font-bold">USh {(calculateTotals(activeSO.items, activeSO.discountValue || 0, activeSO.discountType || "%", activeSO.taxValue || 0, activeSO.taxType || "%").subtotal || 0).toFixed(2)}</span>
                                    </div>
                                    
                                    {/* Discount Row - Improved Layout */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-muted-foreground">Discount:</span>
                                            {activeSO.status === "Draft" ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        value={activeSO.discountValue || 0}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const subtotal = calculateTotals(activeSO.items, 0, "%", 0, "%").subtotal;
                                                            
                                                            // Validation
                                                            if (activeSO.discountType === "%") {
                                                                if (val < 0 || val > 100) {
                                                                    toast({
                                                                        title: "Invalid Discount",
                                                                        description: "Percentage must be between 0 and 100",
                                                                        variant: "destructive"
                                                                    });
                                                                    return;
                                                                }
                                                            } else {
                                                                if (val > subtotal) {
                                                                    toast({
                                                                        title: "Invalid Discount",
                                                                        description: "Discount amount cannot exceed subtotal",
                                                                        variant: "destructive"
                                                                    });
                                                                    return;
                                                                }
                                                            }
                                                            
                                                            setActiveSO({ ...activeSO, discountValue: val });
                                                        }}
                                                        className="h-8 w-20 text-center"
                                                        min="0"
                                                    />
                                                    <Select
                                                        value={activeSO.discountType || "%"}
                                                        onValueChange={(val: "%" | "Amount") => {
                                                            setActiveSO({ ...activeSO, discountType: val, discountValue: 0 });
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-8 w-24">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="%">%</SelectItem>
                                                            <SelectItem value="Amount">Amount</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : (
                                                <span className="font-medium">{activeSO.discountValue || 0} {activeSO.discountType === "%" ? "%" : activeSO.currency || "USD"}</span>
                                            )}
                                        </div>
                                        <div className="flex justify-end">
                                            <span className="font-bold text-slate-700 text-sm">-USh {(calculateTotals(activeSO.items, activeSO.discountValue || 0, activeSO.discountType || "%", 0, "%").discountAmount || 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Tax Row - Similar to Discount with % or Amount support */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-muted-foreground">Tax:</span>
                                            {activeSO.status === "Draft" ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        value={activeSO.taxValue || 0}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const afterDiscount = calculateTotals(activeSO.items, activeSO.discountValue || 0, activeSO.discountType || "%", 0, "%").afterDiscount;
                                                            
                                                            // Validation
                                                            if (activeSO.taxType === "%") {
                                                                if (val < 0 || val > 100) {
                                                                    toast({
                                                                        title: "Invalid Tax",
                                                                        description: "Percentage must be between 0 and 100",
                                                                        variant: "destructive"
                                                                    });
                                                                    return;
                                                                }
                                                            } else {
                                                                if (val < 0) {
                                                                    toast({
                                                                        title: "Invalid Tax",
                                                                        description: "Tax amount cannot be negative",
                                                                        variant: "destructive"
                                                                    });
                                                                    return;
                                                                }
                                                            }
                                                            
                                                            setActiveSO({ ...activeSO, taxValue: val });
                                                        }}
                                                        className="h-8 w-20 text-center"
                                                        min="0"
                                                    />
                                                    <Select
                                                        value={activeSO.taxType || "%"}
                                                        onValueChange={(val: "%" | "Amount") => {
                                                            setActiveSO({ ...activeSO, taxType: val, taxValue: 0 });
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-8 w-24">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="%">%</SelectItem>
                                                            <SelectItem value="Amount">Amount</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : (
                                                <span className="font-medium">{activeSO.taxValue || 0} {activeSO.taxType === "%" ? "%" : activeSO.currency || "USD"}</span>
                                            )}
                                        </div>
                                        <div className="flex justify-end">
                                            <span className="font-bold text-green-600 text-sm">+USh {(calculateTotals(activeSO.items, activeSO.discountValue || 0, activeSO.discountType || "%", activeSO.taxValue || 0, activeSO.taxType || "%").totalTax || 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between text-lg border-t pt-2">
                                        <span className="font-bold">Grand Total:</span>
                                        <span className="font-bold text-primary">USh {(calculateTotals(activeSO.items, activeSO.discountValue || 0, activeSO.discountType || "%", activeSO.taxValue || 0, activeSO.taxType || "%").grandTotal || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Dialog Footer - Buttons based on status */}
                    <DialogFooter className="p-6 border-t mt-auto gap-2">
                        {/* Status-based button logic enforced here */}
                        {activeSO?.status === "Draft" && (
                            <>
                                <Button variant="outline" onClick={() => setIsSODialogOpen(false)}>Close</Button>
                                {isManualEntry && (
                                    <Button
                                        variant="secondary"
                                        onClick={handleCreateCustomer}
                                    >
                                        Create Customer
                                    </Button>
                                )}
                                <Button variant="secondary" onClick={() => handleSaveSO(false)}>Save</Button>
                                <Button onClick={() => handleSaveSO(true)} className="bg-emerald-600 hover:bg-emerald-700">Submit</Button>
                            </>
                        )}
                        {activeSO?.status === "Invoice Pending" && (
                            <>
                                {/* Changed: Download button with icon and document name only */}
                                <div className="flex gap-2 mr-auto">
                                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadQuotation}>
                                        <Download className="h-4 w-4" />
                                        Quotation
                                    </Button>
                                </div>
                                <Button variant="outline" onClick={() => setIsSODialogOpen(false)}>Close</Button>
                            </>
                        )}
                        {activeSO?.status === "Dispatch Pending" && (
                            <>
                                {/* Download buttons with icon and document name only */}
                                <div className="flex gap-2 mr-auto">
                                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadQuotation}>
                                        <Download className="h-4 w-4" />
                                        Quotation
                                    </Button>
                                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadInvoice}>
                                        <Download className="h-4 w-4" />
                                        Invoice
                                    </Button>
                                    <Button variant="outline" size="sm" className="gap-2" onClick={() => activeSO && handleDownloadSOPDF(activeSO)}>
                                        <Download className="h-4 w-4" />
                                        SO PDF
                                    </Button>
                                </div>
                                <Button variant="outline" onClick={() => setIsSODialogOpen(false)}>Close</Button>
                            </>
                        )}
                        {activeSO?.status === "Dispatched" && (
                            <>
                                {/* Changed: Download buttons with icon and document name only */}
                                <div className="flex gap-2 mr-auto">
                                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadQuotation}>
                                        <Download className="h-4 w-4" />
                                        Quotation
                                    </Button>
                                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadInvoice}>
                                        <Download className="h-4 w-4" />
                                        Invoice
                                    </Button>
                                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadDispatchNote}>
                                        <Download className="h-4 w-4" />
                                        Dispatch Note
                                    </Button>
                                </div>
                                {/* Close SO button - only show if payment is completed and due amount is 0 */}
                                {activeSO.paymentStatus === "Completed" && (activeSO.invoiceDueAmount === 0 || !activeSO.invoiceDueAmount) && (
                                    <Button 
                                        onClick={() => handleCloseSO()}
                                        className="bg-gray-700 hover:bg-gray-800"
                                    >
                                        Close SO
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setIsSODialogOpen(false)}>Close</Button>
                            </>
                        )}
                        {activeSO?.status === "Closed SO" && (
                            <>
                                {/* Closed SO - Read-only, only download buttons */}
                                <div className="flex gap-2 mr-auto">
                                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadQuotation}>
                                        <Download className="h-4 w-4" />
                                        Quotation
                                    </Button>
                                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadInvoice}>
                                        <Download className="h-4 w-4" />
                                        Invoice
                                    </Button>
                                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadDispatchNote}>
                                        <Download className="h-4 w-4" />
                                        Dispatch Note
                                    </Button>
                                </div>
                                <Button variant="outline" onClick={() => setIsSODialogOpen(false)}>Close</Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sales Order PDF Preview Modal - For Invoice Pending Status */}
            <Dialog open={isPDFPreviewOpen} onOpenChange={setIsPDFPreviewOpen}>
                <DialogContent className="max-w-[900px] max-h-[95vh] flex flex-col p-0">
                    <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
                        {/* A4 Page Container */}
                        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl" style={{ minHeight: '297mm' }}>
                            {/* PDF Document Content */}
                            {previewSO && (
                                <div className="p-12">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-800">
                                        <div>
                                            <h1 className="text-3xl font-bold text-slate-900 mb-2">MASTER-ERP</h1>
                                            <p className="text-sm text-slate-600">Industrial Solutions & Services</p>
                                            <p className="text-sm text-slate-600">Ahmedabad, Gujarat, India</p>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="text-2xl font-bold text-slate-800 mb-1">SALES ORDER</h2>
                                            <p className="text-sm text-slate-600">#{previewSO.soNumber}</p>
                                            <div className="mt-2">
                                                {getSOStatusBadge(previewSO.status)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Information Section - Moved to position 2 */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Customer Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Customer Name</p>
                                                <p className="text-sm font-semibold text-slate-800">{previewSO.customerName}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Contact Person</p>
                                                <p className="text-sm font-semibold text-slate-800">{previewSO.contactPerson || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Mobile Number</p>
                                                <p className="text-sm font-semibold text-slate-800">{previewSO.mobileNo || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Billing Address</p>
                                                <p className="text-sm font-semibold text-slate-800">{previewSO.billingAddress || '—'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Shipping Address</p>
                                                <p className="text-sm font-semibold text-slate-800">{previewSO.shippingAddress || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sales Order Details Section - Moved to position 3 */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Sales Order Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Number</p>
                                                <p className="text-sm font-semibold text-slate-800">{previewSO.soNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Date</p>
                                                <p className="text-sm font-semibold text-slate-800">{format(new Date(previewSO.soDate), "dd-MM-yyyy")}</p>
                                            </div>
                                            {previewSO.quotationRef && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Quotation Reference</p>
                                                    <p className="text-sm font-semibold text-slate-800">{previewSO.quotationRef}</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Delivery Date</p>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {previewSO.deliveryDate ? format(new Date(previewSO.deliveryDate), "dd-MM-yyyy") : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Currency</p>
                                                <p className="text-sm font-semibold text-slate-800">{previewSO.currency}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Remarks Section */}
                                    {previewSO.remarks && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                                Remarks
                                            </h3>
                                            <p className="text-sm text-slate-700 leading-relaxed">{previewSO.remarks}</p>
                                        </div>
                                    )}

                                    {/* Terms & Conditions Section */}
                                    {previewSO.terms && previewSO.terms.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                                Payment Terms
                                            </h3>
                                            <div className="space-y-2">
                                                {previewSO.terms.map((term, index) => {
                                                    const value = term.value || term.percentage || 0;
                                                    const displayValue = `${value}%`;
                                                    
                                                    let termText = "";
                                                    if (term.termType === "Advance") {
                                                        termText = `${displayValue} payment required at order confirmation.`;
                                                    } else if (term.termType === "Delivery") {
                                                        termText = `${displayValue} payment due at the time of delivery.`;
                                                    } else if (term.termType === "Days") {
                                                        termText = `${displayValue} payment due within ${term.days || 0} days.`;
                                                    }
                                                    
                                                    return (
                                                        <div key={term.id} className="flex items-start gap-2">
                                                            <span className="text-slate-700 font-bold mt-0.5">•</span>
                                                            <p className="text-sm text-slate-700">{termText}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Items Table */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Items
                                        </h3>
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50">
                                                    <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Item
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Quantity
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Rate
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Amount
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewSO.items.map((item, index) => (
                                                    <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                        <td className="text-sm text-slate-800 py-3 px-4 border-b border-slate-100">
                                                            {item.itemName}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {item.orderedQty}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(previewSO.currency)} {item.rate.toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(previewSO.currency)} {item.price.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Summary Section */}
                                    <div className="flex justify-end mb-8">
                                        <div className="w-80">
                                            <div className="space-y-2 mb-3">
                                                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                    <span className="text-sm text-slate-600">Subtotal</span>
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {getCurrencySymbol(previewSO.currency)} {calculateTotals(previewSO.items, previewSO.discountValue || 0, previewSO.discountType || "%", previewSO.taxValue || 0, previewSO.taxType || "%").subtotal.toFixed(2)}
                                                    </span>
                                                </div>
                                                {previewSO.discountValue && previewSO.discountValue > 0 && (
                                                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                        <span className="text-sm text-slate-600">
                                                            Discount ({previewSO.discountValue}{previewSO.discountType === "%" ? "%" : ""})
                                                        </span>
                                                        <span className="text-sm font-semibold text-slate-700">
                                                            -{getCurrencySymbol(previewSO.currency)} {calculateTotals(previewSO.items, previewSO.discountValue || 0, previewSO.discountType || "%", 0, "%").discountAmount.toFixed(2)}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                    <span className="text-sm text-slate-600">
                                                        Tax ({previewSO.taxValue}{previewSO.taxType === "%" ? "%" : ""})
                                                    </span>
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {getCurrencySymbol(previewSO.currency)} {calculateTotals(previewSO.items, previewSO.discountValue || 0, previewSO.discountType || "%", previewSO.taxValue || 0, previewSO.taxType || "%").totalTax.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-3 bg-slate-800 text-white px-4 rounded">
                                                <span className="text-base font-bold">Grand Total</span>
                                                <span className="text-lg font-bold">
                                                    {getCurrencySymbol(previewSO.currency)} {calculateTotals(previewSO.items, previewSO.discountValue || 0, previewSO.discountType || "%", previewSO.taxValue || 0, previewSO.taxType || "%").grandTotal.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="text-center pt-6 border-t border-slate-200">
                                        <p className="text-xs text-slate-500 mb-1">
                                            This is a computer-generated sales order document.
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Generated on {format(new Date(), "dd-MM-yyyy, HH:mm")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons - Outside Document */}
                    <div className="flex justify-end gap-2 p-4 border-t bg-white">
                        {previewSO?.quotationRef && (
                            <Button 
                                variant="outline"
                                onClick={() => handleDownloadQuotationFromPreview(previewSO.quotationRef)} 
                                className="gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Download Quotation
                            </Button>
                        )}
                        <Button 
                            onClick={() => previewSO && handleDownloadSOPDF(previewSO)} 
                            className="gap-2 "
                        >
                            <Download className="h-4 w-4" />
                            Download SO PDF
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Sales Order PDF Preview Modal - For Dispatch Pending Status */}
            {/* Shows Sales Order details with Quotation and Invoice buttons */}
            <Dialog open={isDispatchPDFPreviewOpen} onOpenChange={setIsDispatchPDFPreviewOpen}>
                <DialogContent className="max-w-[900px] max-h-[95vh] flex flex-col p-0">
                    <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
                        {/* A4 Page Container */}
                        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl" style={{ minHeight: '297mm' }}>
                            {/* PDF Document Content */}
                            {dispatchPreviewSO && (
                                <div className="p-12">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-800">
                                        <div>
                                            <h1 className="text-3xl font-bold text-slate-900 mb-2">MASTER-ERP</h1>
                                            <p className="text-sm text-slate-600">Industrial Solutions & Services</p>
                                            <p className="text-sm text-slate-600">Ahmedabad, Gujarat, India</p>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="text-2xl font-bold text-slate-800 mb-1">SALES ORDER</h2>
                                            <p className="text-sm text-slate-600">#{dispatchPreviewSO.soNumber}</p>
                                            <div className="mt-2">
                                                {getSOStatusBadge(dispatchPreviewSO.status)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Information Section - Moved to position 2 */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Customer Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Customer Name</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchPreviewSO.customerName}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Contact Person</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchPreviewSO.contactPerson || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Mobile Number</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchPreviewSO.mobileNo || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Billing Address</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchPreviewSO.billingAddress || '—'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Shipping Address</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchPreviewSO.shippingAddress || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sales Order Details Section - Moved to position 3 */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Sales Order Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Number</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchPreviewSO.soNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Date</p>
                                                <p className="text-sm font-semibold text-slate-800">{format(new Date(dispatchPreviewSO.soDate), "dd-MM-yyyy")}</p>
                                            </div>
                                            {dispatchPreviewSO.quotationRef && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Quotation Reference</p>
                                                    <p className="text-sm font-semibold text-slate-800">{dispatchPreviewSO.quotationRef}</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Delivery Date</p>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {dispatchPreviewSO.deliveryDate ? format(new Date(dispatchPreviewSO.deliveryDate), "dd-MM-yyyy") : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Currency</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchPreviewSO.currency}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Remarks Section */}
                                    {dispatchPreviewSO.remarks && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                                Remarks
                                            </h3>
                                            <p className="text-sm text-slate-700 leading-relaxed">{dispatchPreviewSO.remarks}</p>
                                        </div>
                                    )}

                                    {/* Terms & Conditions Section */}
                                    {dispatchPreviewSO.terms && dispatchPreviewSO.terms.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                                Payment Terms
                                            </h3>
                                            <div className="space-y-2">
                                                {dispatchPreviewSO.terms.map((term, index) => {
                                                    const value = term.value || term.percentage || 0;
                                                    const displayValue = `${value}%`;
                                                    
                                                    let termText = "";
                                                    if (term.termType === "Advance") {
                                                        termText = `${displayValue} payment required at order confirmation.`;
                                                    } else if (term.termType === "Delivery") {
                                                        termText = `${displayValue} payment due at the time of delivery.`;
                                                    } else if (term.termType === "Days") {
                                                        termText = `${displayValue} payment due within ${term.days || 0} days.`;
                                                    }
                                                    
                                                    return (
                                                        <div key={term.id} className="flex items-start gap-2">
                                                            <span className="text-slate-700 font-bold mt-0.5">•</span>
                                                            <p className="text-sm text-slate-700">{termText}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Items Table */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Items
                                        </h3>
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50">
                                                    <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Item
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Quantity
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Rate
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Amount
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dispatchPreviewSO.items.map((item, index) => (
                                                    <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                        <td className="text-sm text-slate-800 py-3 px-4 border-b border-slate-100">
                                                            {item.itemName}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {item.orderedQty}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(dispatchPreviewSO.currency)} {item.rate.toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(dispatchPreviewSO.currency)} {item.price.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Summary Section */}
                                    <div className="flex justify-end mb-8">
                                        <div className="w-80">
                                            <div className="space-y-2 mb-3">
                                                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                    <span className="text-sm text-slate-600">Subtotal</span>
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {getCurrencySymbol(dispatchPreviewSO.currency)} {calculateTotals(dispatchPreviewSO.items, dispatchPreviewSO.discountValue || 0, dispatchPreviewSO.discountType || "%", dispatchPreviewSO.taxValue || 0, dispatchPreviewSO.taxType || "%").subtotal.toFixed(2)}
                                                    </span>
                                                </div>
                                                {dispatchPreviewSO.discountValue && dispatchPreviewSO.discountValue > 0 && (
                                                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                        <span className="text-sm text-slate-600">
                                                            Discount ({dispatchPreviewSO.discountValue}{dispatchPreviewSO.discountType === "%" ? "%" : ""})
                                                        </span>
                                                        <span className="text-sm font-semibold text-slate-700">
                                                            -{getCurrencySymbol(dispatchPreviewSO.currency)} {calculateTotals(dispatchPreviewSO.items, dispatchPreviewSO.discountValue || 0, dispatchPreviewSO.discountType || "%", 0, "%").discountAmount.toFixed(2)}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                    <span className="text-sm text-slate-600">
                                                        Tax ({dispatchPreviewSO.taxValue}{dispatchPreviewSO.taxType === "%" ? "%" : ""})
                                                    </span>
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {getCurrencySymbol(dispatchPreviewSO.currency)} {calculateTotals(dispatchPreviewSO.items, dispatchPreviewSO.discountValue || 0, dispatchPreviewSO.discountType || "%", dispatchPreviewSO.taxValue || 0, dispatchPreviewSO.taxType || "%").totalTax.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-3 bg-slate-800 text-white px-4 rounded">
                                                <span className="text-base font-bold">Grand Total</span>
                                                <span className="text-lg font-bold">
                                                    {getCurrencySymbol(dispatchPreviewSO.currency)} {calculateTotals(dispatchPreviewSO.items, dispatchPreviewSO.discountValue || 0, dispatchPreviewSO.discountType || "%", dispatchPreviewSO.taxValue || 0, dispatchPreviewSO.taxType || "%").grandTotal.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="text-center pt-6 border-t border-slate-200">
                                        <p className="text-xs text-slate-500 mb-1">
                                            This is a computer-generated sales order document.
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Generated on {format(new Date(), "dd-MM-yyyy, HH:mm")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons - Outside Document */}
                    {/* For Dispatch Pending: Show Quotation, Invoice, Download SO PDF buttons */}
                    <div className="flex justify-end gap-2 p-4 border-t bg-white">
                        {/* Quotation Button - Opens/downloads linked quotation PDF */}
                        <Button 
                            variant="outline"
                            onClick={() => dispatchPreviewSO?.quotationRef && handleDownloadQuotationFromPreview(dispatchPreviewSO.quotationRef)} 
                            className="gap-2"
                            disabled={!dispatchPreviewSO?.quotationRef}
                        >
                            <Download className="h-4 w-4" />
                            Quotation
                        </Button>
                        {/* Invoice Button - Opens/downloads linked invoice PDF */}
                        <Button 
                            variant="outline"
                            onClick={() => dispatchPreviewSO && handleDownloadInvoiceFromDispatchPreview(dispatchPreviewSO)} 
                            className="gap-2"
                        >
                            <Download className="h-4 w-4" />
                            Invoice
                        </Button>
                        {/* Download SO PDF Button - Downloads the Sales Order PDF preview */}
                        <Button 
                            onClick={() => dispatchPreviewSO && handleDownloadSOPDF(dispatchPreviewSO)} 
                            className="gap-2 "
                        >
                            <Download className="h-4 w-4" />
                            Download SO PDF
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Sales Order PDF Preview Modal - For Dispatched Status */}
            {/* Shows Sales Order details with Quotation, Invoice, and Dispatch Note buttons */}
            <Dialog open={isDispatchedPDFPreviewOpen} onOpenChange={setIsDispatchedPDFPreviewOpen}>
                <DialogContent className="max-w-[900px] max-h-[95vh] flex flex-col p-0">
                    <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
                        {/* A4 Page Container */}
                        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl" style={{ minHeight: '297mm' }}>
                            {/* PDF Document Content */}
                            {dispatchedPreviewSO && (
                                <div className="p-12">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-800">
                                        <div>
                                            <h1 className="text-3xl font-bold text-slate-900 mb-2">MASTER-ERP</h1>
                                            <p className="text-sm text-slate-600">Industrial Solutions & Services</p>
                                            <p className="text-sm text-slate-600">Ahmedabad, Gujarat, India</p>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="text-2xl font-bold text-slate-800 mb-1">SALES ORDER</h2>
                                            <p className="text-sm text-slate-600">#{dispatchedPreviewSO.soNumber}</p>
                                            <div className="mt-2">
                                                {getSOStatusBadge(dispatchedPreviewSO.status)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Information Section */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Customer Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Customer Name</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchedPreviewSO.customerName}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Contact Person</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchedPreviewSO.contactPerson || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Mobile Number</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchedPreviewSO.mobileNo || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Billing Address</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchedPreviewSO.billingAddress || '—'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Shipping Address</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchedPreviewSO.shippingAddress || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sales Order Details Section */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Sales Order Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Number</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchedPreviewSO.soNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Date</p>
                                                <p className="text-sm font-semibold text-slate-800">{format(new Date(dispatchedPreviewSO.soDate), "dd-MM-yyyy")}</p>
                                            </div>
                                            {dispatchedPreviewSO.quotationRef && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Quotation Reference</p>
                                                    <p className="text-sm font-semibold text-slate-800">{dispatchedPreviewSO.quotationRef}</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Delivery Date</p>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {dispatchedPreviewSO.deliveryDate ? format(new Date(dispatchedPreviewSO.deliveryDate), "dd-MM-yyyy") : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Currency</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchedPreviewSO.currency}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Remarks Section */}
                                    {dispatchedPreviewSO.remarks && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                                Remarks
                                            </h3>
                                            <p className="text-sm text-slate-700 leading-relaxed">{dispatchedPreviewSO.remarks}</p>
                                        </div>
                                    )}

                                    {/* Terms & Conditions Section */}
                                    {dispatchedPreviewSO.terms && dispatchedPreviewSO.terms.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                                Payment Terms
                                            </h3>
                                            <div className="space-y-2">
                                                {dispatchedPreviewSO.terms.map((term, index) => {
                                                    const value = term.value || term.percentage || 0;
                                                    const displayValue = `${value}%`;
                                                    
                                                    let termText = "";
                                                    if (term.termType === "Advance") {
                                                        termText = `${displayValue} payment required at order confirmation.`;
                                                    } else if (term.termType === "Delivery") {
                                                        termText = `${displayValue} payment due at the time of delivery.`;
                                                    } else if (term.termType === "Days") {
                                                        termText = `${displayValue} payment due within ${term.days || 0} days.`;
                                                    }
                                                    
                                                    return (
                                                        <div key={term.id} className="flex items-start gap-2">
                                                            <span className="text-slate-700 font-bold mt-0.5">•</span>
                                                            <p className="text-sm text-slate-700">{termText}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Items Table */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Items
                                        </h3>
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50">
                                                    <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Item
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Quantity
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Rate
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Amount
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Dispatched Qty
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dispatchedPreviewSO.items.map((item, index) => (
                                                    <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                        <td className="text-sm text-slate-800 py-3 px-4 border-b border-slate-100">
                                                            {item.itemName}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {item.orderedQty}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(dispatchedPreviewSO.currency)} {item.rate.toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(dispatchedPreviewSO.currency)} {item.price.toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-blue-600 text-right py-3 px-4 border-b border-slate-100">
                                                            {item.dispatchedQty}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Summary Section */}
                                    <div className="flex justify-end mb-8">
                                        <div className="w-80">
                                            <div className="space-y-2 mb-3">
                                                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                    <span className="text-sm text-slate-600">Subtotal</span>
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {getCurrencySymbol(dispatchedPreviewSO.currency)} {calculateTotals(dispatchedPreviewSO.items, dispatchedPreviewSO.discountValue || 0, dispatchedPreviewSO.discountType || "%", dispatchedPreviewSO.taxValue || 0, dispatchedPreviewSO.taxType || "%").subtotal.toFixed(2)}
                                                    </span>
                                                </div>
                                                {dispatchedPreviewSO.discountValue && dispatchedPreviewSO.discountValue > 0 && (
                                                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                        <span className="text-sm text-slate-600">
                                                            Discount ({dispatchedPreviewSO.discountValue}{dispatchedPreviewSO.discountType === "%" ? "%" : ""})
                                                        </span>
                                                        <span className="text-sm font-semibold text-slate-700">
                                                            -{getCurrencySymbol(dispatchedPreviewSO.currency)} {calculateTotals(dispatchedPreviewSO.items, dispatchedPreviewSO.discountValue || 0, dispatchedPreviewSO.discountType || "%", 0, "%").discountAmount.toFixed(2)}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                    <span className="text-sm text-slate-600">
                                                        Tax ({dispatchedPreviewSO.taxValue}{dispatchedPreviewSO.taxType === "%" ? "%" : ""})
                                                    </span>
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {getCurrencySymbol(dispatchedPreviewSO.currency)} {calculateTotals(dispatchedPreviewSO.items, dispatchedPreviewSO.discountValue || 0, dispatchedPreviewSO.discountType || "%", dispatchedPreviewSO.taxValue || 0, dispatchedPreviewSO.taxType || "%").totalTax.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-3 bg-slate-800 text-white px-4 rounded">
                                                <span className="text-base font-bold">Grand Total</span>
                                                <span className="text-lg font-bold">
                                                    {getCurrencySymbol(dispatchedPreviewSO.currency)} {calculateTotals(dispatchedPreviewSO.items, dispatchedPreviewSO.discountValue || 0, dispatchedPreviewSO.discountType || "%", dispatchedPreviewSO.taxValue || 0, dispatchedPreviewSO.taxType || "%").grandTotal.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="text-center pt-6 border-t border-slate-200">
                                        <p className="text-xs text-slate-500 mb-1">
                                            This is a computer-generated sales order document.
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Generated on {format(new Date(), "dd-MM-yyyy, HH:mm")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons - Outside Document */}
                    {/* For Dispatched: Show Quotation, Invoice, Dispatch Note, Download SO PDF buttons */}
                    <div className="flex justify-end gap-2 p-4 border-t bg-white">
                        {/* Quotation Button - Opens/downloads linked quotation PDF */}
                        <Button 
                            variant="outline"
                            onClick={() => dispatchedPreviewSO?.quotationRef && handleDownloadQuotationFromPreview(dispatchedPreviewSO.quotationRef)} 
                            className="gap-2"
                            disabled={!dispatchedPreviewSO?.quotationRef}
                        >
                            <Download className="h-4 w-4" />
                            Quotation
                        </Button>
                        {/* Invoice Button - Opens/downloads linked invoice PDF */}
                        <Button 
                            variant="outline"
                            onClick={() => dispatchedPreviewSO && handleDownloadInvoiceFromDispatchPreview(dispatchedPreviewSO)} 
                            className="gap-2"
                        >
                            <Download className="h-4 w-4" />
                            Invoice
                        </Button>
                        {/* Dispatch Note Button - Downloads dispatch note */}
                        <Button 
                            variant="outline"
                            onClick={() => dispatchedPreviewSO && handleDownloadDispatchNoteFromPreview(dispatchedPreviewSO)} 
                            className="gap-2"
                        >
                            <Download className="h-4 w-4" />
                            Dispatch Note
                        </Button>
                        {/* Download SO PDF Button - Downloads the Sales Order PDF preview */}
                        <Button 
                            onClick={() => dispatchedPreviewSO && handleDownloadSOPDF(dispatchedPreviewSO)} 
                            className="gap-2 "
                        >
                            <Download className="h-4 w-4" />
                            Download SO PDF
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Sales Order PDF Preview Modal - For Closed SO Status */}
            {/* Read-only preview with document download buttons only */}
            <Dialog open={isClosedSOPDFPreviewOpen} onOpenChange={setIsClosedSOPDFPreviewOpen}>
                <DialogContent className="max-w-[900px] max-h-[95vh] flex flex-col p-0">
                    <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
                        {/* A4 Page Container */}
                        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl" style={{ minHeight: '297mm' }}>
                            {/* PDF Document Content */}
                            {closedSOPreviewSO && (
                                <div className="p-12">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-800">
                                        <div>
                                            <h1 className="text-3xl font-bold text-slate-900 mb-2">MASTER-ERP</h1>
                                            <p className="text-sm text-slate-600">Industrial Solutions & Services</p>
                                            <p className="text-sm text-slate-600">Ahmedabad, Gujarat, India</p>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="text-2xl font-bold text-slate-800 mb-1">SALES ORDER</h2>
                                            <p className="text-sm text-slate-600">#{closedSOPreviewSO.soNumber}</p>
                                            <div className="mt-2">
                                                {getSOStatusBadge(closedSOPreviewSO.status)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Information Section */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Customer Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Customer Name</p>
                                                <p className="text-sm font-semibold text-slate-800">{closedSOPreviewSO.customerName}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Contact Person</p>
                                                <p className="text-sm font-semibold text-slate-800">{closedSOPreviewSO.contactPerson || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Mobile Number</p>
                                                <p className="text-sm font-semibold text-slate-800">{closedSOPreviewSO.mobileNo || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Billing Address</p>
                                                <p className="text-sm font-semibold text-slate-800">{closedSOPreviewSO.billingAddress || '—'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Shipping Address</p>
                                                <p className="text-sm font-semibold text-slate-800">{closedSOPreviewSO.shippingAddress || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sales Order Details Section */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Sales Order Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Number</p>
                                                <p className="text-sm font-semibold text-slate-800">{closedSOPreviewSO.soNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Date</p>
                                                <p className="text-sm font-semibold text-slate-800">{format(new Date(closedSOPreviewSO.soDate), "dd-MM-yyyy")}</p>
                                            </div>
                                            {closedSOPreviewSO.quotationRef && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Quotation Reference</p>
                                                    <p className="text-sm font-semibold text-slate-800">{closedSOPreviewSO.quotationRef}</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Delivery Date</p>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {closedSOPreviewSO.deliveryDate ? format(new Date(closedSOPreviewSO.deliveryDate), "dd-MM-yyyy") : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Currency</p>
                                                <p className="text-sm font-semibold text-slate-800">{closedSOPreviewSO.currency}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Remarks Section */}
                                    {closedSOPreviewSO.remarks && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                                Remarks
                                            </h3>
                                            <p className="text-sm text-slate-700 leading-relaxed">{closedSOPreviewSO.remarks}</p>
                                        </div>
                                    )}

                                    {/* Terms & Conditions Section */}
                                    {closedSOPreviewSO.terms && closedSOPreviewSO.terms.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                                Payment Terms
                                            </h3>
                                            <div className="space-y-2">
                                                {closedSOPreviewSO.terms.map((term, index) => {
                                                    const value = term.value || term.percentage || 0;
                                                    const displayValue = `${value}%`;
                                                    
                                                    let termText = "";
                                                    if (term.termType === "Advance") {
                                                        termText = `${displayValue} payment required at order confirmation.`;
                                                    } else if (term.termType === "Delivery") {
                                                        termText = `${displayValue} payment due at the time of delivery.`;
                                                    } else if (term.termType === "Days") {
                                                        termText = `${displayValue} payment due within ${term.days || 0} days.`;
                                                    }
                                                    
                                                    return (
                                                        <div key={term.id} className="flex items-start gap-2">
                                                            <span className="text-slate-700 font-bold mt-0.5">•</span>
                                                            <p className="text-sm text-slate-700">{termText}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Items Table - Closed SO shows Dispatched Qty column */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Items
                                        </h3>
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50">
                                                    <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Item
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Quantity
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Rate
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Amount
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Dispatched Qty
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {closedSOPreviewSO.items.map((item, index) => (
                                                    <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                        <td className="text-sm text-slate-800 py-3 px-4 border-b border-slate-100">
                                                            {item.itemName}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {item.orderedQty}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(closedSOPreviewSO.currency)} {item.rate.toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(closedSOPreviewSO.currency)} {item.price.toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-blue-600 text-right py-3 px-4 border-b border-slate-100">
                                                            {item.dispatchedQty}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Summary Section */}
                                    <div className="flex justify-end mb-8">
                                        <div className="w-80">
                                            <div className="space-y-2 mb-3">
                                                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                    <span className="text-sm text-slate-600">Subtotal</span>
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {getCurrencySymbol(closedSOPreviewSO.currency)} {calculateTotals(closedSOPreviewSO.items, closedSOPreviewSO.discountValue || 0, closedSOPreviewSO.discountType || "%", closedSOPreviewSO.taxValue || 0, closedSOPreviewSO.taxType || "%").subtotal.toFixed(2)}
                                                    </span>
                                                </div>
                                                {closedSOPreviewSO.discountValue && closedSOPreviewSO.discountValue > 0 && (
                                                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                        <span className="text-sm text-slate-600">
                                                            Discount ({closedSOPreviewSO.discountValue}{closedSOPreviewSO.discountType === "%" ? "%" : ""})
                                                        </span>
                                                        <span className="text-sm font-semibold text-slate-700">
                                                            -{getCurrencySymbol(closedSOPreviewSO.currency)} {calculateTotals(closedSOPreviewSO.items, closedSOPreviewSO.discountValue || 0, closedSOPreviewSO.discountType || "%", 0, "%").discountAmount.toFixed(2)}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                    <span className="text-sm text-slate-600">
                                                        Tax ({closedSOPreviewSO.taxValue}{closedSOPreviewSO.taxType === "%" ? "%" : ""})
                                                    </span>
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {getCurrencySymbol(closedSOPreviewSO.currency)} {calculateTotals(closedSOPreviewSO.items, closedSOPreviewSO.discountValue || 0, closedSOPreviewSO.discountType || "%", closedSOPreviewSO.taxValue || 0, closedSOPreviewSO.taxType || "%").totalTax.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-3 bg-slate-800 text-white px-4 rounded">
                                                <span className="text-base font-bold">Grand Total</span>
                                                <span className="text-lg font-bold">
                                                    {getCurrencySymbol(closedSOPreviewSO.currency)} {calculateTotals(closedSOPreviewSO.items, closedSOPreviewSO.discountValue || 0, closedSOPreviewSO.discountType || "%", closedSOPreviewSO.taxValue || 0, closedSOPreviewSO.taxType || "%").grandTotal.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="text-center pt-6 border-t border-slate-200">
                                        <p className="text-xs text-slate-500 mb-1">
                                            This is a computer-generated sales order document.
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Generated on {format(new Date(), "dd-MM-yyyy, HH:mm")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons - Outside Document */}
                    {/* For Closed SO: Show only document download buttons - fully read-only */}
                    <div className="flex justify-end items-center p-4 border-t bg-white">
                        <div className="flex gap-2">
                            {/* Quotation Button - Opens/downloads linked quotation PDF */}
                            <Button 
                                variant="outline"
                                onClick={() => closedSOPreviewSO?.quotationRef && handleDownloadQuotationFromPreview(closedSOPreviewSO.quotationRef)} 
                                className="gap-2"
                                disabled={!closedSOPreviewSO?.quotationRef}
                            >
                                <Download className="h-4 w-4" />
                                Quotation
                            </Button>
                            {/* Invoice Button - Opens/downloads linked invoice PDF */}
                            <Button 
                                variant="outline"
                                onClick={() => closedSOPreviewSO && handleDownloadInvoiceFromDispatchPreview(closedSOPreviewSO)} 
                                className="gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Invoice
                            </Button>
                            {/* Dispatch Note Button - Downloads dispatch note */}
                            <Button 
                                variant="outline"
                                onClick={() => closedSOPreviewSO && handleDownloadDispatchNoteFromPreview(closedSOPreviewSO)} 
                                className="gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Dispatch Note
                            </Button>
                            {/* Download SO PDF Button - Downloads the Sales Order PDF preview */}
                            <Button 
                                onClick={() => closedSOPreviewSO && handleDownloadSOPDF(closedSOPreviewSO)} 
                                className="gap-2 "
                            >
                                <Download className="h-4 w-4" />
                                Download SO PDF
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Sales Order PDF Preview Modal - For Draft Status */}
            {/* Read-only preview for Draft SOs - shows document with download button */}
            <Dialog open={isDraftPDFPreviewOpen} onOpenChange={setIsDraftPDFPreviewOpen}>
                <DialogContent className="max-w-[900px] max-h-[95vh] flex flex-col p-0">
                    <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
                        {/* A4 Page Container */}
                        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl" style={{ minHeight: '297mm' }}>
                            {/* PDF Document Content */}
                            {draftPreviewSO && (
                                <div className="p-12">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-800">
                                        <div>
                                            <h1 className="text-3xl font-bold text-slate-900 mb-2">MASTER-ERP</h1>
                                            <p className="text-sm text-slate-600">Industrial Solutions & Services</p>
                                            <p className="text-sm text-slate-600">Ahmedabad, Gujarat, India</p>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="text-2xl font-bold text-slate-800 mb-1">SALES ORDER</h2>
                                            <p className="text-sm text-slate-600">#{draftPreviewSO.soNumber}</p>
                                            <div className="mt-2">
                                                {getSOStatusBadge(draftPreviewSO.status)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Information Section */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Customer Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Customer Name</p>
                                                <p className="text-sm font-semibold text-slate-800">{draftPreviewSO.customerName}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Contact Person</p>
                                                <p className="text-sm font-semibold text-slate-800">{draftPreviewSO.contactPerson || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Mobile Number</p>
                                                <p className="text-sm font-semibold text-slate-800">{draftPreviewSO.mobileNo || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Billing Address</p>
                                                <p className="text-sm font-semibold text-slate-800">{draftPreviewSO.billingAddress || '—'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Shipping Address</p>
                                                <p className="text-sm font-semibold text-slate-800">{draftPreviewSO.shippingAddress || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sales Order Details Section */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Sales Order Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Number</p>
                                                <p className="text-sm font-semibold text-slate-800">{draftPreviewSO.soNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Date</p>
                                                <p className="text-sm font-semibold text-slate-800">{format(new Date(draftPreviewSO.soDate), "dd-MM-yyyy")}</p>
                                            </div>
                                            {draftPreviewSO.quotationRef && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Quotation Reference</p>
                                                    <p className="text-sm font-semibold text-slate-800">{draftPreviewSO.quotationRef}</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Delivery Date</p>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {draftPreviewSO.deliveryDate ? format(new Date(draftPreviewSO.deliveryDate), "dd-MM-yyyy") : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Currency</p>
                                                <p className="text-sm font-semibold text-slate-800">{draftPreviewSO.currency}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Remarks Section */}
                                    {draftPreviewSO.remarks && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                                Remarks
                                            </h3>
                                            <p className="text-sm text-slate-700 leading-relaxed">{draftPreviewSO.remarks}</p>
                                        </div>
                                    )}

                                    {/* Terms & Conditions Section */}
                                    {draftPreviewSO.terms && draftPreviewSO.terms.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                                Payment Terms
                                            </h3>
                                            <div className="space-y-2">
                                                {draftPreviewSO.terms.map((term, index) => {
                                                    const value = term.value || term.percentage || 0;
                                                    const displayValue = `${value}%`;
                                                    
                                                    let termText = "";
                                                    if (term.termType === "Advance") {
                                                        termText = `${displayValue} payment required at order confirmation.`;
                                                    } else if (term.termType === "Delivery") {
                                                        termText = `${displayValue} payment due at the time of delivery.`;
                                                    } else if (term.termType === "Days") {
                                                        termText = `${displayValue} payment due within ${term.days || 0} days.`;
                                                    }
                                                    
                                                    return (
                                                        <div key={term.id} className="flex items-start gap-2">
                                                            <span className="text-slate-700 font-bold mt-0.5">•</span>
                                                            <p className="text-sm text-slate-700">{termText}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Items Table - Draft shows standard columns without Dispatched Qty */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                                            Items
                                        </h3>
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50">
                                                    <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Item
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Quantity
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Rate
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Amount
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {draftPreviewSO.items.map((item, index) => (
                                                    <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                        <td className="text-sm text-slate-800 py-3 px-4 border-b border-slate-100">
                                                            {item.itemName}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {item.orderedQty}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(draftPreviewSO.currency)} {item.rate.toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(draftPreviewSO.currency)} {item.price.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Summary Section */}
                                    <div className="flex justify-end mb-8">
                                        <div className="w-80">
                                            <div className="space-y-2 mb-3">
                                                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                    <span className="text-sm text-slate-600">Subtotal</span>
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {getCurrencySymbol(draftPreviewSO.currency)} {calculateTotals(draftPreviewSO.items, draftPreviewSO.discountValue || 0, draftPreviewSO.discountType || "%", draftPreviewSO.taxValue || 0, draftPreviewSO.taxType || "%").subtotal.toFixed(2)}
                                                    </span>
                                                </div>
                                                {draftPreviewSO.discountValue && draftPreviewSO.discountValue > 0 && (
                                                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                        <span className="text-sm text-slate-600">
                                                            Discount ({draftPreviewSO.discountValue}{draftPreviewSO.discountType === "%" ? "%" : ""})
                                                        </span>
                                                        <span className="text-sm font-semibold text-slate-700">
                                                            -{getCurrencySymbol(draftPreviewSO.currency)} {calculateTotals(draftPreviewSO.items, draftPreviewSO.discountValue || 0, draftPreviewSO.discountType || "%", 0, "%").discountAmount.toFixed(2)}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                                    <span className="text-sm text-slate-600">
                                                        Tax ({draftPreviewSO.taxValue}{draftPreviewSO.taxType === "%" ? "%" : ""})
                                                    </span>
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {getCurrencySymbol(draftPreviewSO.currency)} {calculateTotals(draftPreviewSO.items, draftPreviewSO.discountValue || 0, draftPreviewSO.discountType || "%", draftPreviewSO.taxValue || 0, draftPreviewSO.taxType || "%").totalTax.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-3 bg-slate-800 text-white px-4 rounded">
                                                <span className="text-base font-bold">Grand Total</span>
                                                <span className="text-lg font-bold">
                                                    {getCurrencySymbol(draftPreviewSO.currency)} {calculateTotals(draftPreviewSO.items, draftPreviewSO.discountValue || 0, draftPreviewSO.discountType || "%", draftPreviewSO.taxValue || 0, draftPreviewSO.taxType || "%").grandTotal.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="text-center pt-6 border-t border-slate-200">
                                        <p className="text-xs text-slate-500 mb-1">
                                            This is a computer-generated sales order document.
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Generated on {format(new Date(), "dd-MM-yyyy, HH:mm")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons - Outside Document */}
                    {/* For Draft: Show only download button and close */}
                    <div className="flex justify-end items-center p-4 border-t bg-white">
                        <div className="flex gap-2">
                            {/* Quotation Button - Opens/downloads linked quotation PDF if available */}
                            <Button 
                                variant="outline"
                                onClick={() => draftPreviewSO?.quotationRef && handleDownloadQuotationFromPreview(draftPreviewSO.quotationRef)} 
                                className="gap-2"
                                disabled={!draftPreviewSO?.quotationRef}
                            >
                                <Download className="h-4 w-4" />
                                Quotation
                            </Button>
                            {/* Download SO PDF Button - Downloads the Sales Order PDF preview */}
                            <Button 
                                onClick={() => draftPreviewSO && handleDownloadSOPDF(draftPreviewSO)} 
                                className="gap-2 "
                            >
                                <Download className="h-4 w-4" />
                                Download SO PDF
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dispatched Edit Dialog - Read-only detail with Close SO action */}
            <Dialog open={isDispatchedEditOpen} onOpenChange={setIsDispatchedEditOpen}>
                <DialogContent className="sm:max-w-[1000px] max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle className="text-2xl font-bold">Dispatched Sales Order Details</DialogTitle>
                        <DialogDescription>
                            View dispatched sales order details and close the order when payment is complete.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        {/* 1. Top Summary - SO Number, Date, Status */}
                        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">SO Number</Label>
                                <p className="text-sm font-bold text-primary">{dispatchedEditSO?.soNumber}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">SO Date</Label>
                                <p className="text-sm font-medium">
                                    {dispatchedEditSO?.soDate ? format(new Date(dispatchedEditSO.soDate), "dd-MM-yyyy") : "-"}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                                {dispatchedEditSO && getSOStatusBadge(dispatchedEditSO.status)}
                            </div>
                        </div>

                        {/* 2. Customer Information */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b pb-2">Customer Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Customer Name</Label>
                                    <p className="text-sm font-bold text-primary">{dispatchedEditSO?.customerName}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Contact Person</Label>
                                    <p className="text-sm font-medium">{dispatchedEditSO?.contactPerson}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Mobile No</Label>
                                    <p className="text-sm font-medium">{dispatchedEditSO?.mobileNo || "-"}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Delivery Date</Label>
                                    <p className="text-sm font-medium">
                                        {dispatchedEditSO?.deliveryDate ? format(new Date(dispatchedEditSO.deliveryDate), "dd-MM-yyyy") : "-"}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Billing Address</Label>
                                    <p className="text-sm font-medium">{dispatchedEditSO?.billingAddress}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Shipping Address</Label>
                                    <p className="text-sm font-medium">{dispatchedEditSO?.shippingAddress}</p>
                                </div>
                            </div>
                        </div>

                        {/* 3. Payment Terms - BEFORE Order Items */}
                        {dispatchedEditSO && dispatchedEditSO.terms.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b pb-2">Payment Terms</h3>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead className="font-bold text-[10px] uppercase py-3">Payment %</TableHead>
                                                <TableHead className="font-bold text-[10px] uppercase py-3">Term Type</TableHead>
                                                <TableHead className="font-bold text-[10px] uppercase py-3 text-center">Days</TableHead>
                                                <TableHead className="font-bold text-[10px] uppercase py-3">Payment Date / Due Condition</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dispatchedEditSO.terms.map((term) => (
                                                <TableRow key={term.id}>
                                                    <TableCell className="font-bold py-3">{term.percentage}%</TableCell>
                                                    <TableCell className="py-3">{term.termType}</TableCell>
                                                    <TableCell className="text-center py-3">{term.termType === "Days" ? (term.days || "-") : "-"}</TableCell>
                                                    <TableCell className="py-3">
                                                        {term.date ? format(new Date(term.date), "dd-MM-yyyy") : 
                                                         term.termType === "Days" && term.days ? `${term.days} days from SO date` : 
                                                         term.termType === "Delivery" ? "On delivery" : 
                                                         term.termType === "Advance" ? "Advance payment" : "-"}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* 4. Order Items - AFTER Payment Terms */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b pb-2">Order Items</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead className="font-bold text-[10px] uppercase py-3">Item Name</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase py-3 text-center">UOM</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase py-3 text-center">Ordered Qty</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase py-3 text-center">Dispatched Qty</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase py-3 text-right">Rate</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase py-3 text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dispatchedEditSO?.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium py-3">{item.itemName}</TableCell>
                                                <TableCell className="text-center text-xs uppercase py-3">{item.uom}</TableCell>
                                                <TableCell className="text-center font-medium py-3">{item.orderedQty}</TableCell>
                                                <TableCell className="text-center font-bold text-green-600 py-3">{item.dispatchedQty}</TableCell>
                                                <TableCell className="text-right py-3">${item.rate.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-bold text-primary py-3">${item.price.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* 5. Financial Summary - AFTER Order Items */}
                        {dispatchedEditSO && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b pb-2">Financial Summary</h3>
                                <div className="flex justify-end">
                                    <div className="w-96 border rounded-lg p-4 bg-slate-50 space-y-2">
                                        {(() => {
                                            const { subtotal, discountAmount, totalTax, grandTotal } = calculateTotals(
                                                dispatchedEditSO.items,
                                                dispatchedEditSO.discountValue || 0,
                                                dispatchedEditSO.discountType || "%",
                                                dispatchedEditSO.taxValue || 0,
                                                dispatchedEditSO.taxType || "%"
                                            );
                                            // Resolve real-time payment data from store
                                            const storePayment = getPaymentDataBySONumber(dispatchedEditSO.soNumber);
                                            const dueAmount = storePayment ? storePayment.dueAmount : (dispatchedEditSO.invoiceDueAmount ?? 0);
                                            const paidAmount = storePayment ? storePayment.amountReceived : (grandTotal - dueAmount);
                                            const status = storePayment ? storePayment.status : (dispatchedEditSO.paymentStatus ?? "Pending");

                                            return (
                                                <>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-600">Subtotal:</span>
                                                        <span className="font-medium">USh {subtotal.toFixed(2)}</span>
                                                    </div>
                                                    {discountAmount > 0 && (
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-600">Discount:</span>
                                                            <span className="font-medium text-slate-700">-USh {discountAmount.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-600">Tax:</span>
                                                        <span className="font-medium text-green-600">+USh {totalTax.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-base border-t pt-2 mt-2">
                                                        <span className="font-bold">Grand Total:</span>
                                                        <span className="font-bold text-primary">USh {grandTotal.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm border-t pt-2 mt-2">
                                                        <span className="text-slate-500">Payment Status:</span>
                                                        <Badge className={cn(
                                                            status === "Completed" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                                        )}>
                                                            {status}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-500">Paid Amount:</span>
                                                        <span className="font-medium text-green-600">USh {paidAmount.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-base">
                                                        <span className="font-bold">Due Amount:</span>
                                                        <span className={cn(
                                                            "font-bold",
                                                            dueAmount === 0 ? "text-green-600" : "text-orange-600"
                                                        )}>
                                                            USh {dueAmount.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    {dueAmount === 0 && (
                                                        <div className="flex items-center gap-2 text-green-600 text-sm pt-2">
                                                            <Check className="h-4 w-4" />
                                                            <span className="font-medium">Payment Completed</span>
                                                        </div>
                                                    )}
                                                    {dueAmount > 0 && (
                                                        <div className="flex items-start gap-2 text-orange-600 text-xs pt-2 bg-orange-50 p-2 rounded">
                                                            <span className="font-medium">⚠ Sales Order can be closed only when due payment is 0.</span>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 6. Remarks - At bottom before footer */}
                        {dispatchedEditSO?.remarks && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b pb-2">Remarks</h3>
                                <div className="p-3 bg-slate-50 rounded-lg border">
                                    <p className="text-sm text-slate-700">{dispatchedEditSO.remarks}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Dialog Footer with Close SO button */}
                    <DialogFooter className="p-6 border-t gap-2">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsDispatchedEditOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={() => handleCloseSO()}
                            className="bg-green-600 hover:bg-green-700"
                            disabled={(() => {
                                if (!dispatchedEditSO) return true;
                                // Resolve real-time payment data from store
                                const storePayment = getPaymentDataBySONumber(dispatchedEditSO.soNumber);
                                const dueAmount = storePayment ? storePayment.dueAmount : (dispatchedEditSO.invoiceDueAmount ?? 0);
                                return dueAmount > 0;
                            })()}
                            title={(() => {
                                if (!dispatchedEditSO) return "Close Sales Order";
                                // Resolve real-time payment data from store
                                const storePayment = getPaymentDataBySONumber(dispatchedEditSO.soNumber);
                                const dueAmount = storePayment ? storePayment.dueAmount : (dispatchedEditSO.invoiceDueAmount ?? 0);
                                return dueAmount > 0 
                                    ? "Sales Order can be closed only when due payment is 0." 
                                    : "Close Sales Order";
                            })()}
                        >
                            <Check className="mr-2 h-4 w-4" />
                            Close SO
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-700">
                            <Trash2 className="h-5 w-5" />
                            Delete Sales Order?
                        </DialogTitle>
                        <DialogDescription className="py-2">
                            Are you sure you want to delete <span className="font-bold">{soToDelete?.soNumber}</span>?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteAlertOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (soToDelete) {
                                    handleDeleteSO(soToDelete.id);
                                }
                            }}
                        >
                            Delete SO
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SalesOrder;


