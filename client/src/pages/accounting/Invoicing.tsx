// ============================================================================
// INVOICING COMPONENT
// Created from Sales Orders with status "Invoice Pending"
// Updated: Removed localStorage - using mock store
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { generateInvoicePDFHTML } from "@/lib/invoicePDFTemplate";
import { Search, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Trash2, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker } from "@/components/shared/DatePicker";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
// Updated: Import mock invoice service instead of using localStorage
import {
    getInvoices,
    getInvoiceById,
    createInvoice,
    updateInvoice,
    markInvoiceStatus,
    type InvoiceData as MockInvoiceData,
    type InvoiceItem as MockInvoiceItem,
    type InvoiceTerm as MockInvoiceTerm
} from "@/lib/mockInvoices";
import { getSalesOrders, updateSalesOrder, changeSOStatus } from "@/lib/mockSalesOrders";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Currency symbol helper
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

// Safe date formatting helper - validates date before formatting
const safeFormatDate = (dateValue: any, formatStr: string = "dd-MM-yyyy"): string => {
    if (!dateValue) return "-";
    if (dateValue === "-") return "-";
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return "-";
    try {
        return format(date, formatStr);
    } catch (error) {
        return "-";
    }
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Invoice Status: Invoice Pending → Invoiced → Paid
type InvoiceStatus = "Invoice Pending" | "Invoiced" | "Paid";

// Use types from mock service
type InvoiceItem = MockInvoiceItem;
type InvoiceTerm = MockInvoiceTerm;
type InvoiceData = MockInvoiceData;

// ============================================================================
// MOCK DATA & STORAGE
// ============================================================================

// CRITICAL: For Invoice Pending status, derive from Sales Orders directly
// This ensures Sales and Accounting always show the same Invoice Pending records
const getInvoicePendingFromSalesOrders = (): InvoiceData[] => {
    const salesOrders = getSalesOrders().filter(so => so.status === "Invoice Pending");
    
    return salesOrders.map(so => {
        const subtotal = so.items.reduce((sum, item) => sum + item.price, 0);
        
        // Calculate discount amount
        const discountValue = so.discountValue || 0;
        const discountType = so.discountType || "%";
        const discountAmount = discountType === "%" 
            ? (subtotal * discountValue) / 100 
            : discountValue;
        
        // Calculate tax on (subtotal - discount)
        const taxableAmount = subtotal - discountAmount;
        
        // FIX: Map tax from both old (taxPercentage) and new (taxValue/taxType) fields
        // Priority: taxValue/taxType (new) > taxPercentage (old/deprecated)
        let taxPercentage = 0;
        let tax = 0;
        
        if (so.taxType && so.taxValue !== undefined) {
            // New tax fields exist - use them
            if (so.taxType === "%") {
                taxPercentage = so.taxValue;
                tax = (taxableAmount * so.taxValue) / 100;
            } else {
                // Fixed amount tax
                tax = so.taxValue;
                taxPercentage = taxableAmount > 0 ? (so.taxValue / taxableAmount) * 100 : 0;
            }
        } else if (so.taxPercentage !== undefined) {
            // Fallback to old taxPercentage field
            taxPercentage = so.taxPercentage;
            tax = (taxableAmount * so.taxPercentage) / 100;
        }
        
        // Grand Total = Subtotal - Discount + Tax
        const grandTotal = subtotal - discountAmount + tax;
        
        return {
            id: so.id, // Use SO id for Invoice Pending stage
            invoiceNumber: `INV-${so.soNumber.split('-').slice(1).join('-')}`,
            invoiceDate: new Date().toISOString().split('T')[0],
            dueDate: "",
            soNumber: so.soNumber,
            soDate: so.soDate,
            customerName: so.customerName,
            contactPerson: so.contactPerson,
            mobileNo: so.mobileNo,
            shippingAddress: so.shippingAddress,
            billingAddress: so.billingAddress,
            deliveryDate: so.deliveryDate,
            currency: so.currency,
            remarks: so.remarks,
            // Map discount fields from SO
            discountValue: discountValue,
            discountType: discountType,
            discountAmount: discountAmount,
            // Tax fields
            taxPercentage: taxPercentage,
            tax: tax,
            // Totals
            subtotal: subtotal,
            grandTotal: grandTotal,
            status: "Invoice Pending" as InvoiceStatus,
            terms: so.terms.map(t => ({
                id: t.id,
                percentage: t.percentage,
                termType: t.termType,
                date: t.date,
                days: t.days,
                note: t.note
            })),
            items: so.items.map(i => ({
                id: i.id,
                itemCode: i.itemCode,
                itemName: i.itemName,
                uom: i.uom,
                orderedQty: i.orderedQty,
                rate: i.rate,
                price: i.price
            }))
        };
    });
};

// Get all invoices: Invoice Pending from SOs + Invoiced/Paid from invoice store
const getStoredInvoices = (): InvoiceData[] => {
    const invoicePending = getInvoicePendingFromSalesOrders();
    const actualInvoices = getInvoices().filter(inv => inv.status !== "Invoice Pending");
    return [...invoicePending, ...actualInvoices];
};

// removed localStorage - using mock store
// saveInvoices function removed - using mock service functions instead

// removed local DatePicker component - using shared one

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getInvoiceStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
        case "Invoice Pending": return <Badge className="bg-orange-500 hover:bg-orange-600">Invoice Pending</Badge>;
        case "Invoiced": return <Badge className="bg-blue-500 hover:bg-blue-600">Invoiced</Badge>;
        case "Paid": return <Badge className="bg-green-500 hover:bg-green-600">Paid</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
};

// ============================================================================
// MAIN INVOICING COMPONENT
// ============================================================================

const Invoicing = () => {
    const { toast } = useToast();
    const [location, setLocation] = useLocation();
    
    // Parse query params
    const searchParams = new URLSearchParams(window.location.search);
    const fromSource = searchParams.get('from');
    const invoiceIdParam = searchParams.get('invoiceId');

    // State management
    const [invoices, setInvoices] = useState<InvoiceData[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("Invoice Pending"); // Default to Invoice Pending
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [navigationSource, setNavigationSource] = useState<string | null>(null); // Store navigation source

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Dialog states
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [activeInvoice, setActiveInvoice] = useState<InvoiceData | null>(null);

    // Load invoices on mount and listen for changes
    useEffect(() => {
        setInvoices(getStoredInvoices());

        const handleStorageChange = (e: any) => {
            // Refresh when either invoices OR sales orders change
            if (e.key === "erp_mock_invoices_v2" || 
                e.key === "erp_mock_sales_orders_v2" ||
                e.type === "erp:invoices-updated" ||
                e.type === "erp:sales-orders-updated") {
                setInvoices(getStoredInvoices());
            }
        };

        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("erp:invoices-updated", handleStorageChange);
        window.addEventListener("erp:sales-orders-updated", handleStorageChange);
        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("erp:invoices-updated", handleStorageChange);
            window.removeEventListener("erp:sales-orders-updated", handleStorageChange);
        };
    }, []);

    // Handle navigation from Payment Follow Up
    const hasProcessedNavigation = useRef(false);
    
    useEffect(() => {
        if ((fromSource === 'pending-payment' || fromSource === 'sales-follow-up') && invoiceIdParam && !hasProcessedNavigation.current) {
            hasProcessedNavigation.current = true;
            
            // Store the navigation source before clearing query params
            setNavigationSource(fromSource);
            
            const invoice = getInvoiceById(parseInt(invoiceIdParam));
            if (invoice) {
                setActiveInvoice(invoice);
                setIsViewDialogOpen(true); // Open View dialog (PDF preview)
            }
            // Clear the query params
            setLocation('/accounting/invoicing');
        }
    }, [fromSource, invoiceIdParam, setLocation]);

    // Helper to refresh from service (includes Invoice Pending from SOs)
    const refreshInvoices = () => {
        setInvoices(getStoredInvoices());
    };

    // Filtering logic
    const filteredInvoices = invoices.filter(invoice => {
        const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDate = filterDate ? invoice.invoiceDate === format(filterDate, "yyyy-MM-dd") : true;
        const matchesStatus = filterStatus === "all" ? true : invoice.status === filterStatus;

        return matchesSearch && matchesDate && matchesStatus;
    });

    // Pagination calculations
    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
    const paginatedData = filteredInvoices.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Auto-adjust page when data changes
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [filteredInvoices.length, currentPage, totalPages]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterDate, filterStatus]);

    // Open invoice View dialog (PDF preview - read-only)
    const handleViewInvoice = (invoice: InvoiceData) => {
        setActiveInvoice({ ...invoice });
        setIsViewDialogOpen(true);
    };

    // Open invoice Edit dialog (form with all actions)
    const handleEditInvoice = (invoice: InvoiceData) => {
        setActiveInvoice({ ...invoice });
        setIsEditDialogOpen(true);
    };

    // Close View dialog with navigation handling
    const handleCloseView = () => {
        setIsViewDialogOpen(false);
        // Navigate back to the source page
        if (navigationSource === 'pending-payment') {
            setNavigationSource(null);
            setLocation('/accounting/pending-payment');
        } else if (navigationSource === 'sales-follow-up') {
            setNavigationSource(null);
            setLocation('/sales/follow-up');
        }
    };

    // Close Edit dialog
    const handleCloseEdit = () => {
        setIsEditDialogOpen(false);
    };

    // Download Invoice as PDF-like format (used in both View and Edit)
    const handleDownloadInvoice = (invoice?: InvoiceData) => {
            const invoiceToDownload = invoice || activeInvoice;
            if (!invoiceToDownload) return;

            // Use unified invoice PDF template
            const htmlContent = generateInvoicePDFHTML(invoiceToDownload);

            // Use a hidden iframe to print/download
            let iframe = document.getElementById("invoice-print-iframe") as HTMLIFrameElement;
            if (!iframe) {
                iframe = document.createElement("iframe");
                iframe.id = "invoice-print-iframe";
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

    // Add new term
    const handleAddTerm = () => {
        if (!activeInvoice) return;
        const hasAdvanceTerm = activeInvoice.terms.some(t => t.termType === "Advance");
        const newTerm: InvoiceTerm = {
            id: Date.now(),
            percentage: 0,
            termType: hasAdvanceTerm ? "Delivery" : "Advance",
            date: ""
        };
        setActiveInvoice({ ...activeInvoice, terms: [...activeInvoice.terms, newTerm] });
    };

    // Remove term
    const handleRemoveTerm = (termId: number) => {
        if (!activeInvoice) return;
        setActiveInvoice({ ...activeInvoice, terms: activeInvoice.terms.filter(t => t.id !== termId) });
    };

    // Calculate totals with discount
    const calculateTotals = (items: InvoiceItem[], taxPercentage: number = 0, discountValue: number = 0, discountType: "%" | "Amount" = "%") => {
        const subtotal = items.reduce((sum, item) => sum + item.price, 0);
        const discountAmount = discountType === "%" ? (subtotal * discountValue) / 100 : discountValue;
        const taxableAmount = subtotal - discountAmount;
        const totalTax = (taxableAmount * taxPercentage) / 100;
        const grandTotal = subtotal - discountAmount + totalTax;
        return { subtotal, discountAmount, totalTax, grandTotal };
    };

    // Save invoice (only for Invoice Pending status)
    const handleSaveInvoice = () => {
        if (!activeInvoice || activeInvoice.status !== "Invoice Pending") return;

        // Validation: Check if terms exist
        if (activeInvoice.terms.length === 0) {
            toast({
                title: "Validation Error",
                description: "Please add at least one payment term.",
                variant: "destructive"
            });
            return;
        }

        // Validation: Total percentage must equal 100%
        const totalPercentage = activeInvoice.terms.reduce((sum, term) => sum + term.percentage, 0);
        if (totalPercentage !== 100) {
            toast({
                title: "Validation Error",
                description: "Total payment percentage must equal 100%.",
                variant: "destructive"
            });
            return;
        }

        // Validation: Check for zero percentage terms
        const hasZeroPercentage = activeInvoice.terms.some(term => term.percentage === 0);
        if (hasZeroPercentage) {
            toast({
                title: "Validation Error",
                description: "Payment percentage cannot be 0%.",
                variant: "destructive"
            });
            return;
        }

        // For Invoice Pending, save changes back to the Sales Order
        const so = getSalesOrders().find(s => s.soNumber === activeInvoice.soNumber);
        if (so) {
            updateSalesOrder(so.id, {
                remarks: activeInvoice.remarks,
                taxValue: activeInvoice.taxPercentage, // Update taxValue (new field)
                taxPercentage: activeInvoice.taxPercentage, // Keep for backward compatibility
                terms: activeInvoice.terms.map(t => ({
                    id: t.id,
                    valueType: "%" as const,
                    value: t.percentage,
                    percentage: t.percentage,
                    termType: t.termType as any,
                    date: t.date || "",
                    days: t.days,
                    note: t.note
                }))
            });
        }

        refreshInvoices();

        toast({
            title: "Invoice Saved",
            description: `Invoice ${activeInvoice.invoiceNumber} has been saved.`
        });

        handleCloseEdit();
    }

    // Mark as Invoiced (only for Invoice Pending status)
    const handleMarkAsInvoiced = () => {
        if (!activeInvoice || activeInvoice.status !== "Invoice Pending") return;

        // Validation: Check if terms exist
        if (activeInvoice.terms.length === 0) {
            toast({
                title: "Validation Error",
                description: "Please add at least one payment term before generating invoice.",
                variant: "destructive"
            });
            return;
        }

        // Validation: Total percentage must equal 100%
        const totalPercentage = activeInvoice.terms.reduce((sum, term) => sum + term.percentage, 0);
        if (totalPercentage !== 100) {
            toast({
                title: "Validation Error",
                description: "Total payment percentage must equal 100% before generating invoice.",
                variant: "destructive"
            });
            return;
        }

        // Validation: Check for zero percentage terms
        const hasZeroPercentage = activeInvoice.terms.some(term => term.percentage === 0);
        if (hasZeroPercentage) {
            toast({
                title: "Validation Error",
                description: "Payment percentage cannot be 0% before generating invoice.",
                variant: "destructive"
            });
            return;
        }

        // Validation: Tax percentage
        if (activeInvoice.taxPercentage < 0 || activeInvoice.taxPercentage > 100) {
            toast({
                title: "Validation Error",
                description: "Tax percentage must be between 0% and 100% before generating invoice.",
                variant: "destructive"
            });
            return;
        }

        // Find the SO and move it to Dispatch Pending
        const so = getSalesOrders().find(s => s.soNumber === activeInvoice.soNumber);
        if (so) {
            // Update SO status to Dispatch Pending
            updateSalesOrder(so.id, {
                status: "Dispatch Pending",
                taxValue: activeInvoice.taxPercentage, // Update taxValue (new field)
                taxPercentage: activeInvoice.taxPercentage, // Keep for backward compatibility
                terms: activeInvoice.terms.map(t => ({
                    id: t.id,
                    valueType: "%" as const,
                    value: t.percentage,
                    percentage: t.percentage,
                    termType: t.termType as any,
                    date: t.date || "",
                    days: t.days,
                    note: t.note
                }))
            });
            
            console.log('[INVOICING] SO moved to Dispatch Pending:', {
                soNumber: so.soNumber,
                newStatus: "Dispatch Pending"
            });
        }

        // Calculate due dates for payment terms before creating invoice
        const termsWithDueDates = activeInvoice.terms.map(term => {
            let calculatedDate = term.date || "";
            
            if (term.termType === "Days" && term.days && !term.date) {
                // Calculate due date: Invoice Date + days
                const invoiceDate = new Date(activeInvoice.invoiceDate);
                const dueDate = new Date(invoiceDate);
                dueDate.setDate(dueDate.getDate() + term.days);
                calculatedDate = dueDate.toISOString().split('T')[0];
            } else if (term.termType === "Advance" && !term.date) {
                // Advance terms due on invoice date
                calculatedDate = activeInvoice.invoiceDate;
            } else if ((term.termType === "Delivery" || term.termType === "On Delivery") && !term.date && activeInvoice.deliveryDate) {
                // Delivery terms due on delivery date
                calculatedDate = activeInvoice.deliveryDate;
            }
            
            return {
                ...term,
                date: calculatedDate
            };
        });

        // Create actual invoice record with status "Invoiced"
        const newInvoice = createInvoice({
            invoiceNumber: activeInvoice.invoiceNumber,
            invoiceDate: activeInvoice.invoiceDate,
            dueDate: activeInvoice.dueDate || "",
            soNumber: activeInvoice.soNumber,
            soDate: activeInvoice.soDate,
            customerName: activeInvoice.customerName,
            contactPerson: activeInvoice.contactPerson,
            mobileNo: activeInvoice.mobileNo,
            shippingAddress: activeInvoice.shippingAddress,
            billingAddress: activeInvoice.billingAddress,
            deliveryDate: activeInvoice.deliveryDate,
            currency: activeInvoice.currency,
            remarks: activeInvoice.remarks,
            // Discount fields
            discountValue: activeInvoice.discountValue || 0,
            discountType: activeInvoice.discountType || "%",
            discountAmount: activeInvoice.discountAmount || 0,
            // Tax and totals
            taxPercentage: activeInvoice.taxPercentage,
            subtotal: activeInvoice.subtotal,
            tax: activeInvoice.tax,
            grandTotal: activeInvoice.grandTotal,
            status: "Invoiced",
            terms: termsWithDueDates,
            items: activeInvoice.items
        });

        refreshInvoices();

        toast({
            title: "Invoice Generated",
            description: `Invoice ${activeInvoice.invoiceNumber} has been generated successfully. Sales Order moved to Dispatch Pending. Downloading PDF...`
        });

        // Trigger PDF download with the new invoice data
        handleDownloadInvoice(newInvoice);

        handleCloseEdit();
    };

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <h1 className="text-3xl font-bold tracking-tight">Invoicing</h1>

            {/* Toolbar */}
            <AppListToolbar
                search={{
                    placeholder: "Search by Invoice No, SO No, Customer...",
                    value: searchTerm,
                    onChange: (val) => setSearchTerm(val)
                }}
                filters={[
                    {
                        type: 'date',
                        label: "Date",
                        value: filterDate,
                        onChange: setFilterDate,
                        placeholder: "Pick a date"
                    },
                    {
                        type: 'select',
                        label: "Status",
                        value: filterStatus,
                        onChange: setFilterStatus,
                        options: [
                            { value: "all", label: "All Status" },
                            { value: "Invoice Pending", label: "Invoice Pending" },
                            { value: "Invoiced", label: "Invoiced" }
                        ],
                        searchable: true
                    }
                ]}
            />

            {/* Invoice Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Invoice No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Invoice Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">SO No</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Customer</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">Invoice Amount</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                                            No invoices found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((invoice) => {
                                        const { grandTotal } = calculateTotals(invoice.items, invoice.taxPercentage, invoice.discountValue || 0, invoice.discountType || "%");
                                        return (
                                            <TableRow key={invoice.id} className="hover:bg-muted/30 transition-colors border-b last:border-none">
                                                <TableCell className="py-4 font-mono font-medium">{invoice.invoiceNumber}</TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                    {safeFormatDate(invoice.invoiceDate)}
                                                </TableCell>
                                                <TableCell className="py-4 font-mono font-medium">{invoice.soNumber}</TableCell>
                                                <TableCell className="py-4 text-sm font-bold">{invoice.customerName}</TableCell>
                                                <TableCell className="py-4 text-right text-sm font-bold text-green-600">USh {grandTotal.toFixed(2)}</TableCell>
                                                <TableCell className="py-4 text-center">
                                                    {getInvoiceStatusBadge(invoice.status)}
                                                </TableCell>
                                                <TableCell className="py-4 text-center">
                                                    <TableActionButtons
                                                        onView={() => handleViewInvoice(invoice)}
                                                        onEdit={invoice.status === "Invoice Pending" ? () => handleEditInvoice(invoice) : undefined}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {filteredInvoices.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredInvoices.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>

            {/* View Invoice Dialog - PDF Preview (Read-Only) */}
            <Dialog open={isViewDialogOpen} onOpenChange={(open) => !open && handleCloseView()}>
                <DialogContent className="max-w-[900px] max-h-[95vh] flex flex-col p-0">
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
                        {/* A4 Page Container */}
                        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl" style={{ minHeight: '297mm' }}>
                            {/* PDF Document Content */}
                            <div className="p-12">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-300">
                                    <div>
                                        <h1 className="text-2xl font-bold text-slate-800 mb-1">MASTER-ERP</h1>
                                        <p className="text-xs text-slate-600">Industrial Solutions & Services</p>
                                        <p className="text-xs text-slate-600">Ahmedabad, Gujarat, India</p>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="text-xl font-bold text-slate-800">TAX INVOICE</h2>
                                        <p className="text-xs text-slate-900 mt-1 font-semibold">{activeInvoice?.invoiceNumber}</p>
                                        <div className="inline-block px-3 py-1 rounded text-[10px] font-bold mt-2 bg-slate-100 text-slate-700">
                                            {activeInvoice?.status.toUpperCase()}
                                        </div>
                                    </div>
                                </div>

                                {/* Customer & Invoice Information - Stacked vertically: Bill To first, then Invoice Details */}
                                <div className="mb-6">
                                    <div className="border border-slate-200 rounded-lg p-4 mb-4">
                                        <h3 className="text-[9px] uppercase font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200 tracking-wide">Bill To</h3>
                                        <div className="space-y-1.5">
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Customer:</span>
                                                <span className="font-bold text-slate-900">{activeInvoice?.customerName}</span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Contact Person:</span>
                                                <span className="font-medium text-slate-900">{activeInvoice?.contactPerson}</span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Mobile:</span>
                                                <span className="font-medium text-slate-900">{activeInvoice?.mobileNo || "N/A"}</span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Billing Address:</span>
                                                <span className="font-medium text-slate-900">{activeInvoice?.billingAddress}</span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Shipping Address:</span>
                                                <span className="font-medium text-slate-900">{activeInvoice?.shippingAddress}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border border-slate-200 rounded-lg p-4">
                                        <h3 className="text-[9px] uppercase font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200 tracking-wide">Invoice Details</h3>
                                        <div className="space-y-1.5">
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Invoice Date:</span>
                                                <span className="font-medium text-slate-900">
                                                    {safeFormatDate(activeInvoice?.invoiceDate)}
                                                </span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">SO Number:</span>
                                                <span className="font-bold text-slate-900">{activeInvoice?.soNumber}</span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">SO Date:</span>
                                                <span className="font-medium text-slate-900">
                                                    {activeInvoice?.soDate ? format(new Date(activeInvoice.soDate), "dd-MM-yyyy") : "-"}
                                                </span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Delivery Date:</span>
                                                <span className="font-medium text-slate-900">
                                                    {activeInvoice?.deliveryDate ? format(new Date(activeInvoice.deliveryDate), "dd-MM-yyyy") : "-"}
                                                </span>
                                            </div>
                                            <div className="flex text-xs">
                                                <span className="w-32 text-slate-600 font-medium">Currency:</span>
                                                <span className="font-bold text-slate-900">{activeInvoice?.currency || "USD"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Remarks - Moved before Payment Terms */}
                                {activeInvoice?.remarks && (
                                    <div className="mb-6">
                                        <h3 className="text-[9px] font-bold text-slate-600 mb-2 uppercase tracking-wide">Remarks / Special Instructions</h3>
                                        <div className="border border-slate-300 rounded p-3 bg-slate-50 text-xs text-slate-700 min-h-[40px]">
                                            {activeInvoice.remarks}
                                        </div>
                                    </div>
                                )}

                                {/* Payment Terms - Now displayed as bullet points with proper due information */}
                                {activeInvoice && activeInvoice.terms.length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="text-[9px] font-bold text-slate-600 mb-2 uppercase tracking-wide">Payment Terms</h3>
                                        <ul className="space-y-1">
                                            {activeInvoice.terms.map((term) => {
                                                let termDescription = `${term.percentage}% ${term.termType}`;
                                                
                                                // FIX 2: Show proper due information based on term type
                                                if (term.termType === "Delivery" || term.termType === "On Delivery") {
                                                    if (term.date) {
                                                        termDescription += ` – Due on ${format(new Date(term.date), "dd-MM-yyyy")}`;
                                                    } else if (activeInvoice.deliveryDate) {
                                                        termDescription += ` – Due on delivery (${format(new Date(activeInvoice.deliveryDate), "dd-MM-yyyy")})`;
                                                    } else {
                                                        termDescription += ` – Due on delivery`;
                                                    }
                                                } else if (term.termType === "Days" && term.days) {
                                                    // Calculate due date: Invoice Date + days
                                                    const invoiceDate = new Date(activeInvoice.invoiceDate);
                                                    const dueDate = new Date(invoiceDate);
                                                    dueDate.setDate(dueDate.getDate() + term.days);
                                                    termDescription += ` within ${term.days} days – Due on ${format(dueDate, "dd-MM-yyyy")}`;
                                                } else if (term.termType === "Advance") {
                                                    if (term.date) {
                                                        termDescription += ` – Due on ${format(new Date(term.date), "dd-MM-yyyy")}`;
                                                    } else {
                                                        termDescription += ` – Due on ${format(new Date(activeInvoice.invoiceDate), "dd-MM-yyyy")} (Invoice Date)`;
                                                    }
                                                } else if (term.date) {
                                                    termDescription += ` – Due on ${format(new Date(term.date), "dd-MM-yyyy")}`;
                                                }
                                                
                                                return (
                                                    <li key={term.id} className="text-xs text-slate-700">
                                                        • {termDescription}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}

                                {/* Items Table */}
                                <div className="mb-6">
                                    <h3 className="text-[9px] font-bold text-slate-600 mb-2 uppercase tracking-wide">Invoice Items</h3>
                                    <table className="w-full border-collapse border border-slate-300">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="border border-slate-300 px-3 py-2 text-center text-[9px] uppercase font-bold text-slate-600" style={{ width: '50px' }}>#</th>
                                                <th className="border border-slate-300 px-3 py-2 text-left text-[9px] uppercase font-bold text-slate-600">Item Name</th>
                                                <th className="border border-slate-300 px-3 py-2 text-center text-[9px] uppercase font-bold text-slate-600" style={{ width: '60px' }}>UOM</th>
                                                <th className="border border-slate-300 px-3 py-2 text-right text-[9px] uppercase font-bold text-slate-600" style={{ width: '80px' }}>Qty</th>
                                                <th className="border border-slate-300 px-3 py-2 text-right text-[9px] uppercase font-bold text-slate-600" style={{ width: '80px' }}>Rate</th>
                                                <th className="border border-slate-300 px-3 py-2 text-right text-[9px] uppercase font-bold text-slate-600" style={{ width: '100px' }}>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeInvoice?.items.map((item, index) => (
                                                <tr key={item.id}>
                                                    <td className="border border-slate-300 px-3 py-2 text-center text-xs font-medium text-slate-700">{index + 1}</td>
                                                    <td className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900">{item.itemName}</td>
                                                    <td className="border border-slate-300 px-3 py-2 text-center text-xs text-slate-600">{item.uom}</td>
                                                    <td className="border border-slate-300 px-3 py-2 text-right text-xs font-medium text-slate-700">{item.orderedQty}</td>
                                                    <td className="border border-slate-300 px-3 py-2 text-right text-xs font-medium text-slate-700">USh {item.rate.toFixed(2)}</td>
                                                    <td className="border border-slate-300 px-3 py-2 text-right text-xs font-bold text-slate-900">USh {item.price.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Totals */}
                                {activeInvoice && (
                                    <div className="flex justify-end mb-6">
                                        <div className="w-80 border border-slate-300 rounded-lg p-4 bg-slate-50">
                                            <div className="flex justify-between text-xs mb-2">
                                                <span className="text-slate-600 font-medium">Subtotal:</span>
                                                <span className="font-bold text-slate-900">USh {calculateTotals(activeInvoice.items, activeInvoice.taxPercentage, activeInvoice.discountValue || 0, activeInvoice.discountType || "%").subtotal.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs mb-2">
                                                <span className="text-slate-600 font-medium">Discount ({activeInvoice.discountType === "%" ? `${activeInvoice.discountValue || 0}%` : "Amount"}):</span>
                                                <span className="font-bold text-red-600">-USh {calculateTotals(activeInvoice.items, activeInvoice.taxPercentage, activeInvoice.discountValue || 0, activeInvoice.discountType || "%").discountAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs mb-2">
                                                <span className="text-slate-600 font-medium">Tax ({activeInvoice.taxPercentage}%):</span>
                                                <span className="font-bold text-slate-900">USh {calculateTotals(activeInvoice.items, activeInvoice.taxPercentage, activeInvoice.discountValue || 0, activeInvoice.discountType || "%").totalTax.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm border-t-2 border-slate-300 pt-2 mt-2">
                                                <span className="font-bold text-slate-900">Grand Total:</span>
                                                <span className="font-bold text-slate-900 text-lg">USh {calculateTotals(activeInvoice.items, activeInvoice.taxPercentage, activeInvoice.discountValue || 0, activeInvoice.discountType || "%").grandTotal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="mt-8 pt-4 border-t border-slate-200 text-center">
                                    <p className="text-[9px] text-slate-500">This is a computer generated document. Generated on {format(new Date(), "dd-MM-yyyy, HH:mm")}</p>
                                    <p className="text-[9px] text-slate-600 font-semibold">Tassos Consultancy Services | Govt IT Solutions | Ahmedabad</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons Outside Document */}
                    <div className="flex justify-end gap-3 p-4 border-t bg-white">
                        <Button variant="outline" onClick={handleCloseView}>
                            Close
                        </Button>
                        <Button 
                            onClick={() => handleDownloadInvoice(activeInvoice || undefined)} 
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Invoice Dialog - Full Form with Actions */}
            <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && handleCloseEdit()}>
                <DialogContent className="sm:max-w-[1200px] max-h-[95vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-2xl font-bold">Edit Invoice</DialogTitle>
                        <DialogDescription>
                            {activeInvoice?.status === "Invoice Pending" ? "Edit invoice terms and tax, then generate invoice." : "View and manage invoice details."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        {/* Header Info */}
                        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice Number</Label>
                                <p className="text-sm font-bold text-primary">{activeInvoice?.invoiceNumber}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice Date</Label>
                                <p className="text-sm font-medium">{activeInvoice?.invoiceDate}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                                {activeInvoice && getInvoiceStatusBadge(activeInvoice.status)}
                            </div>
                        </div>

                        {/* Customer + SO Info (Read-only) */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold border-b pb-2">Customer & Sales Order Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">SO Number</Label>
                                    <p className="text-sm font-bold text-primary">{activeInvoice?.soNumber}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">SO Date</Label>
                                    <p className="text-sm font-medium">{activeInvoice?.soDate}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Customer Name</Label>
                                    <p className="text-sm font-bold text-primary">{activeInvoice?.customerName}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Contact Person</Label>
                                    <p className="text-sm font-medium">{activeInvoice?.contactPerson}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Mobile No</Label>
                                    <p className="text-sm font-medium">{activeInvoice?.mobileNo || "-"}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Delivery Date</Label>
                                    <p className="text-sm font-medium">{activeInvoice?.deliveryDate}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Currency</Label>
                                    <p className="text-sm font-medium font-bold text-primary">{activeInvoice?.currency || "USD"}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Billing Address</Label>
                                    <p className="text-sm font-medium">{activeInvoice?.billingAddress}</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Shipping Address</Label>
                                    <p className="text-sm font-medium">{activeInvoice?.shippingAddress}</p>
                                </div>
                            </div>
                        </div>

                        {/* Terms Section - Read-only */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold">Terms</Label>
                            </div>
                            {activeInvoice && activeInvoice.terms.length > 0 && (
                                <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50 text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">
                                                <TableCell className="py-2 pl-6">Payment %</TableCell>
                                                <TableCell className="py-2">Term Type</TableCell>
                                                <TableCell className="py-2">Due Condition</TableCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activeInvoice.terms.map((term) => {
                                                // FIX: Calculate and show actual due dates
                                                let dueCondition = "";
                                                if (term.termType === "Advance") {
                                                    dueCondition = `On Invoice Date (${format(new Date(activeInvoice.invoiceDate), "dd-MM-yyyy")})`;
                                                } else if (term.termType === "Days" && term.days) {
                                                    // Calculate due date: Invoice Date + days
                                                    const invoiceDate = new Date(activeInvoice.invoiceDate);
                                                    const dueDate = new Date(invoiceDate);
                                                    dueDate.setDate(dueDate.getDate() + term.days);
                                                    dueCondition = `${term.days} days – Due on ${format(dueDate, "dd-MM-yyyy")}`;
                                                } else if (term.termType === "Delivery" || term.termType === "On Delivery") {
                                                    if (activeInvoice.deliveryDate) {
                                                        dueCondition = `On Delivery (${format(new Date(activeInvoice.deliveryDate), "dd-MM-yyyy")})`;
                                                    } else {
                                                        dueCondition = "On Delivery";
                                                    }
                                                } else {
                                                    dueCondition = term.termType;
                                                }
                                                
                                                return (
                                                    <TableRow key={term.id} className="hover:bg-muted/20">
                                                        <TableCell className="py-4 pl-6">
                                                            <span className="font-medium">{term.percentage}%</span>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <span className="font-medium">{term.termType}</span>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <span className="font-medium text-slate-600">{dueCondition}</span>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>

                        {/* Items Table - Always Read-only */}
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Invoice Items</Label>
                            <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-[10px] font-bold uppercase py-3 pl-6">Item</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">UOM</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Ordered Qty</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Rate</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Price</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeInvoice?.items.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                                    No items
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            activeInvoice?.items.map((item) => (
                                                <TableRow key={item.id} className="hover:bg-muted/20">
                                                    <TableCell className="py-4 pl-6">
                                                        <div className="font-bold text-sm text-primary">{item.itemName}</div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <span className="text-xs uppercase">{item.uom}</span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <span className="font-bold text-primary">{item.orderedQty}</span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <span className="font-medium">USh {item.rate}</span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <span className="font-bold text-primary">USh {item.price.toFixed(2)}</span>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Totals Summary */}
                        {activeInvoice && activeInvoice.items.length > 0 && (
                            <div className="flex justify-end">
                                <div className="w-80 space-y-2 p-4 bg-muted/30 rounded-lg border">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-muted-foreground">Subtotal:</span>
                                        <span className="font-bold">USh {calculateTotals(activeInvoice.items, activeInvoice.taxPercentage || 0, activeInvoice.discountValue || 0, activeInvoice.discountType || "%").subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-muted-foreground">Discount ({activeInvoice.discountType === "%" ? `${activeInvoice.discountValue || 0}%` : "Amount"}):</span>
                                        <span className="font-bold text-red-600">-USh {calculateTotals(activeInvoice.items, activeInvoice.taxPercentage || 0, activeInvoice.discountValue || 0, activeInvoice.discountType || "%").discountAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-medium text-muted-foreground">Tax:</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{activeInvoice.taxPercentage || 0}%</span>
                                            <span className="font-bold text-green-600">+USh {calculateTotals(activeInvoice.items, activeInvoice.taxPercentage || 0, activeInvoice.discountValue || 0, activeInvoice.discountType || "%").totalTax.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-lg border-t pt-2">
                                        <span className="font-bold">Grand Total:</span>
                                        <span className="font-bold text-primary">USh {calculateTotals(activeInvoice.items, activeInvoice.taxPercentage || 0, activeInvoice.discountValue || 0, activeInvoice.discountType || "%").grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Remarks Section - Editable only when Invoice Pending */}
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Remarks</Label>
                            {activeInvoice?.status === "Invoice Pending" ? (
                                <Textarea
                                    value={activeInvoice.remarks}
                                    onChange={(e) => setActiveInvoice({ ...activeInvoice, remarks: e.target.value })}
                                    placeholder="Enter any special instructions or remarks..."
                                    className="min-h-[80px] resize-none"
                                />
                            ) : (
                                <div className="p-3 bg-muted/30 rounded-lg border">
                                    <p className="text-sm text-muted-foreground">{activeInvoice?.remarks || "No remarks"}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dialog Footer - Buttons based on status */}
                    <DialogFooter className="p-6 border-t mt-auto gap-2">
                        <Button
                            onClick={() => handleDownloadInvoice(activeInvoice || undefined)}
                            variant="outline"
                            className="mr-auto"
                        >
                            <Download className="mr-2 h-4 w-4" /> Invoice
                        </Button>
                        <Button variant="outline" onClick={handleCloseEdit}>Close</Button>
                        {activeInvoice?.status === "Invoice Pending" && (
                            <>
                                <Button onClick={handleSaveInvoice} className="bg-blue-600 hover:bg-blue-700">Save</Button>
                                <Button onClick={handleMarkAsInvoiced} className="bg-emerald-600 hover:bg-emerald-700">Generate Invoice</Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Invoicing;
