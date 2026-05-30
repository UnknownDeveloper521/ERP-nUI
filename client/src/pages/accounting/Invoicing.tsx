// ============================================================================
// INVOICING COMPONENT
// Created from Sales Orders with status "Invoice Pending"
// Updated: Removed localStorage - using mock store
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { generateInvoicePDFHTML } from "@/lib/invoicePDFTemplate";
import { Search, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Trash2, Plus, Download, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import { DatePicker } from "@/components/shared/DatePicker";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getSalesOrders, updateSalesOrder, changeSOStatus, checkAndMoveToDispatchPending } from "@/lib/mockSalesOrders";
import { invoicingApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Currency symbol helper
const getCurrencySymbol = (currency: string): string => {
    if (!currency) return "USD";
    const clean = currency.trim().toUpperCase();
    
    // Check for codes or full names
    const symbols: Record<string, string> = {
        'USD': '$',
        'US DOLLAR': '$',
        'EUR': '€',
        'EURO': '€',
        'GBP': '£',
        'BRITISH POUND': '£',
        'INR': '₹',
        'INDIAN RUPEE': '₹',
        'JPY': '¥',
        'JAPANESE YEN': '¥',
        'CNY': '¥',
        'CHINESE YUAN': '¥',
        'AUD': 'A$',
        'AUSTRALIAN DOLLAR': 'A$',
        'CAD': 'C$',
        'CANADIAN DOLLAR': 'C$',
        'CHF': 'CHF',
        'SWISS FRANC': 'CHF',
        'SEK': 'kr',
        'SWEDISH KRONA': 'kr',
        'NZD': 'NZ$',
        'NEW ZEALAND DOLLAR': 'NZ$',
        'UGX': 'USh',
        'UGANDA SHILLING': 'USh'
    };
    
    return symbols[clean] || currency;
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

// Invoice Status: Draft → Open → Partially Paid → Closed | Overdue | Cancelled
type InvoiceStatus = "Draft" | "Open" | "Partially Paid" | "Closed" | "Overdue" | "Cancelled";

// Use types from mock service
type InvoiceItem = MockInvoiceItem;
type InvoiceTerm = MockInvoiceTerm;
type InvoiceData = MockInvoiceData;

// ============================================================================
// MOCK DATA & STORAGE
// ============================================================================

// CRITICAL: For Invoice Pending status, derive from Sales Orders directly
// This ensures Sales and Accounting always show the same Invoice Pending records
// NEW LOGIC: Create one entry per payment term
const getInvoicePendingFromSalesOrders = (): InvoiceData[] => {
    const salesOrders = getSalesOrders().filter(so => so.status === "Invoice Pending");
    
    const invoiceEntries: InvoiceData[] = [];

    salesOrders.forEach(so => {
        const subtotal = so.items.reduce((sum, item) => sum + item.price, 0);
        
        // Calculate discount amount for the WHOLE SO to determine taxable amount
        const discountValue = so.discountValue || 0;
        const discountType = so.discountType || "%";
        const totalDiscountAmount = discountType === "%" 
            ? (subtotal * discountValue) / 100 
            : discountValue;
        
        const taxableAmount = subtotal - totalDiscountAmount;
        
        // FIX: Map tax from both old (taxPercentage) and new (taxValue/taxType) fields
        // Priority: taxValue/taxType (new) > taxPercentage (old/deprecated)
        let taxPercentage = 0;
        let totalTax = 0;
        
        if (so.taxType && so.taxValue !== undefined) {
            // New tax fields exist - use them
            if (so.taxType === "%") {
                taxPercentage = so.taxValue;
                totalTax = (taxableAmount * so.taxValue) / 100;
            } else {
                // Fixed amount tax
                totalTax = so.taxValue;
                taxPercentage = taxableAmount > 0 ? (so.taxValue / taxableAmount) * 100 : 0;
            }
        } else if (so.taxPercentage !== undefined) {
            // Fallback to old taxPercentage field
            taxPercentage = so.taxPercentage;
            totalTax = (taxableAmount * so.taxPercentage) / 100;
        }
        
        // Grand Total = Subtotal - Discount + Tax
        const grandTotal = subtotal - totalDiscountAmount + totalTax;

        // Iterate through each term and create a separate entry if it's not generated
        so.terms.forEach(term => {
            if (!term.isGenerated) {
                // Calculate prorated amounts based on term value/percentage
                const termValue = term.value || term.percentage || 0;
                
                // Assuming term value is a percentage of the total for prorating
                // Calculate based on the percentage of the grand total
                const termPercentage = term.percentage || term.value; // For backward compatibility
                const proratedSubtotal = (subtotal * termPercentage) / 100;
                const proratedDiscount = (totalDiscountAmount * termPercentage) / 100;
                const proratedTax = (totalTax * termPercentage) / 100;
                const proratedGrandTotal = (grandTotal * termPercentage) / 100;

                invoiceEntries.push({
                    id: parseInt(`${so.id}${term.id}`), // Unique ID for table rendering
                    invoiceNumber: "-", // Explicitly "-" before generation
                    invoiceDate: "-",   // Explicitly "-" before generation
                    dueDate: term.date || "",
                    soNumber: so.soNumber,
                    soDate: so.soDate,
                    termId: term.id, // KEEPING TRACK OF WHICH TERM THIS IS
                    customerName: so.customerName,
                    contactPerson: so.contactPerson,
                    mobileNo: so.mobileNo,
                    shippingAddress: so.shippingAddress,
                    billingAddress: so.billingAddress,
                    deliveryDate: so.deliveryDate,
                    currency: so.currency,
                    currencySymbol: getCurrencySymbol(so.currency || "UGX"),
                    remarks: so.remarks,
                    // Map ALL fields, but amounts are prorated
                    discountValue: discountValue,
                    discountType: discountType,
                    discountAmount: proratedDiscount,
                    taxPercentage: taxPercentage,
                    tax: proratedTax,
                    subtotal: proratedSubtotal,
                    grandTotal: proratedGrandTotal,
                    status: "Draft" as InvoiceStatus,
                    // THIS IS THE CRITICAL PART: Only show THIS specific term!
                    terms: [{
                        id: term.id,
                        percentage: term.percentage,
                        termType: term.termType,
                        date: term.date,
                        days: term.days as number | undefined,
                        note: term.note
                    }],
                    items: so.items.map(i => ({
                        id: i.id,
                        itemCode: i.itemCode,
                        itemName: i.itemName,
                        uom: i.uom,
                        orderedQty: i.orderedQty,
                        rate: i.rate,
                        price: (i.price * termPercentage) / 100 // Prorate item price too for display
                    }))
                });
            }
        });
    });

    return invoiceEntries;
};

// Get all invoices: Invoice Pending from SOs + Invoiced/Paid from invoice store
const getStoredInvoices = (): InvoiceData[] => {
    const invoicePending = getInvoicePendingFromSalesOrders();
    const actualInvoices = getInvoices(); // Include ALL records from the store, including manual drafts
    return [...invoicePending, ...actualInvoices];
};

// removed localStorage - using mock store
// saveInvoices function removed - using mock service functions instead

// removed local DatePicker component - using shared one

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getInvoiceStatusBadge = (status: string) => {
    const s = status?.toUpperCase() || "";
    if (s.includes("DRAFT") || s.includes("PENDING")) return <Badge className="bg-slate-500 hover:bg-slate-600">Draft</Badge>;
    if (s.includes("OPEN")) return <Badge className="bg-blue-500 hover:bg-blue-600">Open</Badge>;
    if (s.includes("PARTIALLY") || s.includes("PARTIAL")) return <Badge className="bg-cyan-500 hover:bg-cyan-600">Partially Paid</Badge>;
    if (s.includes("CLOSED") || s.includes("PAID")) return <Badge className="bg-green-500 hover:bg-green-600">Closed</Badge>;
    if (s.includes("OVERDUE")) return <Badge className="bg-red-500 hover:bg-red-600">Overdue</Badge>;
    if (s.includes("CANCELLED") || s.includes("CANCEL")) return <Badge className="bg-slate-500 hover:bg-slate-600">Cancelled</Badge>;
    return <Badge variant="outline">{status}</Badge>;
};

// ============================================================================
// API RESPONSE MAPPING
// ============================================================================

const mapApiResponseToInvoice = (apiData: any): any => {
    if (!apiData) return null;
    const d = apiData;
    const summary = d.summary || {};

    return {
        id: d.invoice_id,
        companyName: d.company_name,
        companyAddress: d.company_address,
        invoiceNumber: d.invoice_code,
        invoiceDate: d.invoice_date,
        status: d.status_name || "Draft",
        soNumber: d.so_code,
        soDate: d.order_date,
        deliveryDate: d.delivery_date,
        customerName: d.customer_name,
        contactPerson: d.contact_person,
        mobileNo: d.mobile_no,
        billingAddress: d.billing_address,
        shippingAddress: d.shipping_address,
        currency: d.currency_name || "UGX",
        currencySymbol: getCurrencySymbol(d.currency_name || "UGX"),
        items: (d.items || []).map((item: any, idx: number) => ({
            id: idx + 1,
            itemName: item.item_name,
            uom: item.uom,
            orderedQty: item.ordered_qty || 0,
            rate: item.unit_price || 0,
            price: item.price_per_item || 0
        })),
        terms: (d.terms || []).map((term: any) => ({
            id: term.term_id,
            termType: term.term_type_name,
            percentage: term.percentage || 0,
            days: term.days || 0
        })),
        subtotal: summary.subtotal || 0,
        discountValue: summary.discount_percent || 0,
        discountAmount: summary.discount_amount || 0,
        discountType: "%" as const,
        taxPercentage: summary.tax_percent || 0,
        tax: summary.tax_amount || 0,
        taxValue: summary.tax_percent || 0, // In template, taxValue is used as the rate when taxType is '%'
        taxType: "%" as const,
        grandTotal: summary.grand_total || 0
    };
};

// ============================================================================
// MAIN INVOICING COMPONENT
// ============================================================================

const Invoicing = () => {
    const { canView, canEdit, canPrint, canDelete } = useHasPermission();
    const MODULE_KEY = "ACCOUNTING/INVOICING";
    const canViewInvoicing = canView(MODULE_KEY);
    const canEditInvoicing = canEdit(MODULE_KEY);
    const canPrintInvoicing = canPrint(MODULE_KEY);
    const canDeleteInvoicing = canDelete(MODULE_KEY);

    const { toast } = useToast();
    const [location, setLocation] = useLocation();
    
    // Parse query params
    const searchParams = new URLSearchParams(window.location.search);
    const fromSource = searchParams.get('from');
    const pendingPaymentIdParam = searchParams.get('pending_payment_id');
    const invoiceIdParam = searchParams.get('invoiceId');

    const [invoices, setInvoices] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [hasSetDefaultStatus, setHasSetDefaultStatus] = useState(false);
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [navigationSource, setNavigationSource] = useState<string | null>(null);
    const [isListLoading, setIsListLoading] = useState(true);
    const [isViewDetailLoading, setIsViewDetailLoading] = useState(false);
    const [isFormOpening, setIsFormOpening] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isMarkingInvoiced, setIsMarkingInvoiced] = useState(false);
    const [openingInvoiceId, setOpeningInvoiceId] = useState<number | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);

    // Dialog states
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
    const [isPDFDialogOpen, setIsPDFDialogOpen] = useState(false);
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [invoiceToCancel, setInvoiceToCancel] = useState<any | null>(null);
    const [activeInvoice, setActiveInvoice] = useState<any | null>(null);
    const [selectedTerms, setSelectedTerms] = useState<number[]>([]);

    const invoicingStatuses = useCommonStore(state => state.invoicingStatuses);

    // API fetching logic
    const fetchInvoices = async () => {
        setIsListLoading(true);
        try {
            const params = {
                search: debouncedSearchTerm,
                date: filterDate ? format(filterDate, "yyyy-MM-dd") : undefined,
                status_id: filterStatus !== "all" ? filterStatus : undefined,
                page: currentPage,
                limit: itemsPerPage
            };
            const res = await invoicingApi.getInvoicesList(params);
            if (res.isSuccessful && res.data) {
                setInvoices(res.data.records || []);
                setTotalRecords(res.data.pagination?.totalRecords || 0);
            } else {
                setInvoices([]);
                setTotalRecords(0);
            }
        } catch (error) {
            console.error("Failed to fetch invoices:", error);
            setInvoices([]);
            setTotalRecords(0);
        } finally {
            setIsListLoading(false);
        }
    };

    // Row actions stay enabled during list refresh; only block during open/view/save flows.
    const isRowActionBusy =
        openingInvoiceId !== null ||
        isViewDetailLoading ||
        isFormOpening ||
        isCancelling ||
        isMarkingInvoiced;

    // Set default status filter to "Draft" once statuses are loaded
    useEffect(() => {
        if (!hasSetDefaultStatus && invoicingStatuses.length > 0) {
            const draftStatus = invoicingStatuses.find(s => 
                (s.value_code || "").toUpperCase() === "DRAFT" || 
                (s.name || "").toUpperCase() === "DRAFT"
            );
            if (draftStatus) {
                setFilterStatus(String(draftStatus.id));
            }
            setHasSetDefaultStatus(true);
        }
    }, [invoicingStatuses, hasSetDefaultStatus]);

    // Load invoices on mount and when filters change
    useEffect(() => {
        // Skip first fetch until we've attempted to set the default status if statuses are available
        if (!hasSetDefaultStatus && invoicingStatuses.length > 0) return;

        fetchInvoices();
    }, [debouncedSearchTerm, filterDate, filterStatus, currentPage, itemsPerPage, hasSetDefaultStatus]);

    // Listen for changes
    useEffect(() => {
        const handleRefresh = (e: any) => {
            if (e.type === "erp:invoices-updated") {
                fetchInvoices();
            }
        };

        window.addEventListener("erp:invoices-updated", handleRefresh);
        return () => {
            window.removeEventListener("erp:invoices-updated", handleRefresh);
        };
    }, []);

    // Handle navigation from Payment Follow Up
    const hasProcessedNavigation = useRef(false);
    
    useEffect(() => {
        const processNavigation = async () => {
            if ((fromSource === 'pending-payment' || fromSource === 'sales-follow-up') && (pendingPaymentIdParam || invoiceIdParam) && !hasProcessedNavigation.current) {
                hasProcessedNavigation.current = true;
                
                // Store the navigation source before clearing query params
                setNavigationSource(fromSource);
                
                let targetInvoiceId = invoiceIdParam ? parseInt(invoiceIdParam) : null;

                // If we only have pending_payment_id, we need to resolve it to an invoice_id
                if (fromSource === 'pending-payment' && pendingPaymentIdParam && !targetInvoiceId) {
                    setIsViewDetailLoading(true);
                    try {
                        const res = await invoicingApi.getPendingPaymentById(parseInt(pendingPaymentIdParam));
                        if (res.isSuccessful && res.data && res.data.invoice_id) {
                            targetInvoiceId = res.data.invoice_id;
                        }
                    } catch (error) {
                        console.error("Failed to resolve pending payment to invoice:", error);
                    } finally {
                        setIsViewDetailLoading(false);
                    }
                }

                if (targetInvoiceId) {
                    setOpeningInvoiceId(targetInvoiceId);
                    setIsViewDetailLoading(true);
                    setIsPDFDialogOpen(true);
                    setActiveInvoice(null);
                    // Try to get from mock data first (for backward compatibility with old mock flow)
                    const invoice = getInvoiceById(targetInvoiceId);
                    if (invoice) {
                        setActiveInvoice(invoice);
                    } else {
                        // If not in mock, try to fetch via API
                        try {
                            const res = await invoicingApi.getInvoiceById(targetInvoiceId);
                            if (res.isSuccessful && res.data) {
                                const mappedInvoice = mapApiResponseToInvoice(res.data);
                                setActiveInvoice(mappedInvoice);
                            }
                        } catch (error) {
                            console.error("Failed to fetch invoice for navigation:", error);
                        }
                    }
                    setIsViewDetailLoading(false);
                    setOpeningInvoiceId(null);
                }
                
                // Clear the query params
                setLocation('/accounting/invoicing');
            }
        };

        processNavigation();
    }, [fromSource, invoiceIdParam, pendingPaymentIdParam, setLocation]);

    // Refresh helper
    const refreshInvoices = () => {
        fetchInvoices();
    };

    const handleOpenCancelDialog = (invoice: any) => {
        setInvoiceToCancel(invoice);
        setIsCancelDialogOpen(true);
    };

    const handleConfirmCancel = async () => {
        if (!invoiceToCancel || isRowActionBusy) return;
        
        try {
            setIsCancelling(true);
            
            const res = await invoicingApi.cancelInvoice(invoiceToCancel.invoice_id);
            
            if (res.isSuccessful) {
                toast({
                    title: "Invoice Cancelled",
                    description: res.message || `Invoice ${invoiceToCancel.invoice_code} has been cancelled successfully.`,
                    variant: "success"
                });
                refreshInvoices();
            } else {
                toast({
                    title: "Error",
                    description: res.message || "Failed to cancel invoice.",
                    variant: "destructive"
                });
            }
        } catch (error: any) {
            console.error("Error cancelling invoice:", error);
            toast({
                title: "Error",
                description: error.message || "An unexpected error occurred while cancelling the invoice.",
                variant: "destructive"
            });
        } finally {
            setIsCancelling(false);
            setIsCancelDialogOpen(false);
            setInvoiceToCancel(null);
        }
    };

    // Pagination calculations
    const totalPages = Math.ceil(totalRecords / itemsPerPage);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, filterDate, filterStatus]);

    // Open PDF Preview dialog
    const handleViewInvoice = async (invoice: any) => {
        if (isRowActionBusy) return;
        setOpeningInvoiceId(invoice.invoice_id);
        setIsViewDetailLoading(true);
        setActiveInvoice(null);
        setIsPDFDialogOpen(true);
        try {
            const res = await invoicingApi.getInvoiceById(invoice.invoice_id);
            if (res.isSuccessful && res.data) {
                const mappedInvoice = mapApiResponseToInvoice(res.data);
                setActiveInvoice(mappedInvoice);
            } else {
                toast({
                    title: "Error",
                    description: res.message || "Failed to fetch invoice details",
                    variant: "destructive"
                });
                setIsPDFDialogOpen(false);
            }
        } catch (error) {
            console.error("Failed to view invoice:", error);
            setIsPDFDialogOpen(false);
        } finally {
            setIsViewDetailLoading(false);
            setOpeningInvoiceId(null);
        }
    };

    // Open Invoice Form dialog (Sales Order structure)
    const handleEditInvoice = async (invoice: any) => {
        if (isRowActionBusy) return;
        setOpeningInvoiceId(invoice.invoice_id);
        setIsFormOpening(true);
        setIsInvoiceDialogOpen(true);
        setActiveInvoice(null);
        try {
            const res = await invoicingApi.getInvoiceById(invoice.invoice_id);
            if (res.isSuccessful && res.data) {
                const mappedInvoice = mapApiResponseToInvoice(res.data);
                setActiveInvoice(mappedInvoice);
                setSelectedTerms([]); // Reset selections
            } else {
                toast({
                    title: "Error",
                    description: res.message || "Failed to fetch invoice details",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Failed to edit invoice:", error);
            setIsInvoiceDialogOpen(false);
        } finally {
            setIsFormOpening(false);
            setOpeningInvoiceId(null);
        }
    };

    // Close PDF dialog
    const handleClosePDF = () => {
        setIsPDFDialogOpen(false);
        handleNavigationCleanup();
    };

    // Close Form dialog
    const handleCloseInvoice = () => {
        setIsInvoiceDialogOpen(false);
        handleNavigationCleanup();
    };

    // Helper for navigation cleanup
    const handleNavigationCleanup = () => {
        if (navigationSource === 'pending-payment') {
            setNavigationSource(null);
            setLocation('/accounting/pending-payment');
        } else if (navigationSource === 'sales-follow-up') {
            setNavigationSource(null);
            setLocation('/sales/follow-up');
        }
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
        const hasAdvanceTerm = activeInvoice.terms.some((t: any) => t.termType === "Advance");
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
        setActiveInvoice({ ...activeInvoice, terms: activeInvoice.terms.filter((t: any) => t.id !== termId) });
    };

    // Calculate totals function removed, using pre-calculated values from invoice data instead

    const handleSaveInvoice = () => {
        if (!activeInvoice || activeInvoice.status !== "Draft") return;

        // Validation: Check if terms exist
        if (activeInvoice.terms.length === 0) {
            toast({
                title: "Please Check",
                description: "Please add at least one payment term.",
                variant: "destructive"
            });
            return;
        }



        // Validation: Check for zero percentage terms
        const hasZeroPercentage = activeInvoice.terms.some((term: any) => term.percentage === 0);
        if (hasZeroPercentage) {
            toast({
                title: "Please Check",
                description: "Payment percentage cannot be 0%.",
                variant: "destructive"
            });
            return;
        }

        // For Invoice Pending, save changes back to the Sales Order
        const so = getSalesOrders().find(s => s.soNumber === activeInvoice.soNumber);
        if (so && activeInvoice.terms.length > 0 && activeInvoice.termId) {
            
            // Find the specific term to update
            const updatedTerms = so.terms.map(t => {
                 if (t.id === activeInvoice.termId) {
                     return {
                        ...t,
                        percentage: activeInvoice.terms[0].percentage,
                        value: activeInvoice.terms[0].percentage, // Sync value with percentage
                        termType: activeInvoice.terms[0].termType as any,
                        date: activeInvoice.terms[0].date || "",
                        days: activeInvoice.terms[0].days,
                        note: activeInvoice.terms[0].note
                     };
                 }
                 return t;
            });

            updateSalesOrder(so.id, {
                remarks: activeInvoice.remarks,
                taxValue: activeInvoice.taxPercentage, // Update taxValue (new field)
                taxPercentage: activeInvoice.taxPercentage, // Keep for backward compatibility
                terms: updatedTerms
            });
        }

        refreshInvoices();

        toast({
            title: "Invoice Saved",
            description: `Invoice ${activeInvoice.invoiceNumber} has been saved.`,
            variant: "success"
        });

        handleCloseInvoice();
    }

    // Mark as Invoiced (only for Draft status)
    const handleMarkAsInvoiced = async () => {
        if (!activeInvoice || activeInvoice.status !== "Draft" || isRowActionBusy) return;

        setIsMarkingInvoiced(true);
        try {
            const res = await invoicingApi.updateInvoice(activeInvoice.id, { status_code: "OPEN" });
            
            if (res.isSuccessful) {
                toast({
                    title: "Invoice Opened",
                    description: res.message || "Invoice status updated to Open successfully.",
                    variant: "success"
                });
                setIsInvoiceDialogOpen(false);
                fetchInvoices(); // Refresh the list
            } else {
                toast({
                    title: "Update Failed",
                    description: res.message || "Failed to update invoice status.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Error updating invoice status:", error);
            toast({
                title: "Error",
                description: "An unexpected error occurred while updating the invoice.",
                variant: "destructive"
            });
        } finally {
            setIsMarkingInvoiced(false);
        }
    };

    if (!canViewInvoicing) {
        return <Unauthorized />;
    }

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <h1 className="text-3xl font-bold tracking-tight">Invoicing</h1>

            {/* Toolbar */}
            <AppListToolbar
                search={{
                    placeholder: "Search by Invoice Code, SO Code, Customer...",
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
                            ...invoicingStatuses.map(s => ({
                                value: String(s.id),
                                label: s.name
                            }))
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
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Invoice Code</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Invoice Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">SO Code</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider w-[250px]">Customer</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-right w-[180px]">Invoice Amount</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isListLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm text-muted-foreground">Loading...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : invoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                                            No invoices found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    invoices.map((invoice) => {
                                        const isDraft = (invoice.status_name || "").toUpperCase().includes("DRAFT");
                                        return (
                                            <TableRow key={invoice.invoice_id} className="hover:bg-muted/30 transition-colors border-b last:border-none">
                                                <TableCell className="py-4 font-mono font-medium">
                                                    <div className="flex flex-col">
                                                        <span>{isDraft ? "-" : invoice.invoice_code}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                    {isDraft ? "-" : safeFormatDate(invoice.invoice_date)}
                                                </TableCell>
                                                <TableCell className="py-4 font-mono font-medium">{invoice.so_code}</TableCell>
                                                <TableCell className="py-4 text-sm font-bold">{invoice.customer_name}</TableCell>
                                                <TableCell className="py-4 text-right text-sm font-bold text-green-600">
                                                    {getCurrencySymbol(invoice.currency_name || "UGX")} {(invoice.invoice_amount || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="py-4 text-center">
                                                    {getInvoiceStatusBadge(invoice.status_name)}
                                                </TableCell>
                                                <TableCell className="py-4 text-center">
                                                    <TableActionButtons
                                                        onView={canViewInvoicing ? () => handleViewInvoice(invoice) : undefined}
                                                        onEdit={canEditInvoicing && isDraft ? () => handleEditInvoice(invoice) : undefined}
                                                        customActions={
                                                            canDeleteInvoicing && !isRowActionBusy && (invoice.status_name?.toUpperCase().includes("OPEN") || 
                                                             invoice.status_name?.toUpperCase().includes("PARTIAL")) && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" 
                                                                    onClick={() => handleOpenCancelDialog(invoice)}
                                                                    disabled={isRowActionBusy}
                                                                    title="Cancel Invoice"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            )
                                                        }
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalRecords > 0 && !isListLoading && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalRecords}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>

            {/* PDF Preview Dialog - A4 Layout */}
            <Dialog open={isPDFDialogOpen} onOpenChange={(open) => !open && handleClosePDF()}>
                <DialogContent 
                    className="max-w-[900px] max-h-[95vh] flex flex-col p-0"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-100 relative">
                        {isViewDetailLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/80">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
                        {/* A4 Page Container */}
                        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl" style={{ minHeight: '297mm' }}>
                            {/* PDF Document Content */}
                            <div className="p-12">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-300">
                                    <div>
                                        <h1 className="text-2xl font-bold text-slate-800 mb-1">{activeInvoice?.companyName || ""}</h1>
                                        <p className="text-xs text-slate-600 whitespace-pre-line">{activeInvoice?.companyAddress || ""}</p>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <h2 className="text-2xl font-bold text-slate-900 leading-none">TAX INVOICE</h2>
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                activeInvoice?.status === "Draft" ? "bg-slate-100 text-slate-600 border border-slate-200" : 
                                                activeInvoice?.status === "Open" ? "bg-blue-50 text-blue-700 border border-blue-100" : 
                                                "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                            }`}>
                                                {activeInvoice?.status.toUpperCase()}
                                            </div>
                                            <p className="text-sm text-slate-900 font-bold">
                                                {activeInvoice?.status === "Draft" ? "-" : activeInvoice?.invoiceNumber}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Customer & Invoice Information - Stacked vertically */}
                                <div className="space-y-4 mb-6">
                                    <div className="border border-slate-200 rounded-lg p-4">
                                        <h3 className="text-[9px] uppercase font-bold text-slate-500 mb-3 tracking-wide border-b pb-1">Bill To</h3>
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-[120px_1fr] text-xs">
                                                <span className="text-slate-600">Customer:</span>
                                                <span className="font-bold text-slate-900">{activeInvoice?.customerName}</span>
                                            </div>
                                            <div className="grid grid-cols-[120px_1fr] text-xs">
                                                <span className="text-slate-600">Contact Person:</span>
                                                <span className="text-slate-900 font-medium">{activeInvoice?.contactPerson}</span>
                                            </div>
                                            <div className="grid grid-cols-[120px_1fr] text-xs">
                                                <span className="text-slate-600">Mobile:</span>
                                                <span className="text-slate-900 font-medium">{activeInvoice?.mobileNo || "N/A"}</span>
                                            </div>
                                            <div className="grid grid-cols-[120px_1fr] text-xs">
                                                <span className="text-slate-600">Billing Address:</span>
                                                <span className="text-slate-900 font-medium">{activeInvoice?.billingAddress}</span>
                                            </div>
                                            <div className="grid grid-cols-[120px_1fr] text-xs">
                                                <span className="text-slate-600">Shipping Address:</span>
                                                <span className="text-slate-900 font-medium">{activeInvoice?.shippingAddress}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border border-slate-200 rounded-lg p-4">
                                        <h3 className="text-[9px] uppercase font-bold text-slate-500 mb-3 tracking-wide border-b pb-1">Invoice Details</h3>
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-[120px_1fr] text-xs">
                                                <span className="text-slate-600">Invoice Date:</span>
                                                <span className="text-slate-900 font-medium">
                                                    {activeInvoice?.status === "Draft" ? "-" : safeFormatDate(activeInvoice?.invoiceDate)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[120px_1fr] text-xs">
                                                <span className="text-slate-600">SO Code:</span>
                                                <span className="font-bold text-slate-900">{activeInvoice?.soNumber}</span>
                                            </div>
                                            <div className="grid grid-cols-[120px_1fr] text-xs">
                                                <span className="text-slate-600">SO Date:</span>
                                                <span className="text-slate-900 font-medium">{safeFormatDate(activeInvoice?.soDate)}</span>
                                            </div>
                                            <div className="grid grid-cols-[120px_1fr] text-xs">
                                                <span className="text-slate-600">Delivery Date:</span>
                                                <span className="text-slate-900 font-medium">{safeFormatDate(activeInvoice?.deliveryDate)}</span>
                                            </div>
                                            <div className="grid grid-cols-[120px_1fr] text-xs">
                                                <span className="text-slate-600">Currency:</span>
                                                <span className="font-bold text-slate-900">{activeInvoice?.currency || "USh"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                {/* Payment Terms Section - Updated to Table Format */}
                                {activeInvoice && activeInvoice.terms.length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="text-[9px] uppercase font-bold text-slate-500 mb-2 tracking-wide">Payment Terms</h3>
                                        <table className="w-full border border-slate-200 text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="px-3 py-1.5 text-left text-[9px] font-bold text-slate-600 border-r border-slate-200">TERM TYPE</th>
                                                    <th className="px-3 py-1.5 text-center text-[9px] font-bold text-slate-600 border-r border-slate-200">PERCENTAGE</th>
                                                    <th className="px-3 py-1.5 text-center text-[9px] font-bold text-slate-600 border-r border-slate-200">DAYS</th>
                                                    <th className="px-3 py-1.5 text-right text-[9px] font-bold text-slate-600">AMOUNT</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeInvoice.terms.map((term: any, index: number) => (
                                                    <tr key={index} className="border-b border-slate-200 last:border-b-0">
                                                        <td className="px-3 py-2 text-left text-slate-700 border-r border-slate-200 font-medium">{term.termType}</td>
                                                        <td className="px-3 py-2 text-center text-slate-700 border-r border-slate-200">{term.percentage}%</td>
                                                        <td className="px-3 py-2 text-center text-slate-700 border-r border-slate-200">{term.days || "-"}</td>
                                                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                                                            {activeInvoice.currencySymbol} {((activeInvoice.grandTotal * term.percentage) / 100).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Items Table */}
                                <div className="mb-6">
                                    <h3 className="text-[9px] uppercase font-bold text-slate-500 mb-2 tracking-wide">Invoice Items</h3>
                                    <table className="w-full border border-slate-200">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="px-3 py-2 text-center text-[9px] font-bold text-slate-600 border-r border-slate-200" style={{ width: '40px' }}>#</th>
                                                <th className="px-3 py-2 text-left text-[9px] font-bold text-slate-600 border-r border-slate-200">ITEM NAME</th>
                                                <th className="px-3 py-2 text-center text-[9px] font-bold text-slate-600 border-r border-slate-200" style={{ width: '60px' }}>UOM</th>
                                                <th className="px-3 py-2 text-center text-[9px] font-bold text-slate-600 border-r border-slate-200" style={{ width: '60px' }}>QTY</th>
                                                <th className="px-3 py-2 text-right text-[9px] font-bold text-slate-600 border-r border-slate-200" style={{ width: '100px' }}>UNIT PRICE</th>
                                                <th className="px-3 py-2 text-right text-[9px] font-bold text-slate-600" style={{ width: '120px' }}>AMOUNT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeInvoice?.items.map((item: any, index: number) => (
                                                <tr key={item.id} className="border-b border-slate-200 last:border-b-0">
                                                    <td className="px-3 py-3 text-center text-xs text-slate-600 border-r border-slate-200">{index + 1}</td>
                                                    <td className="px-3 py-3 text-left text-xs font-bold text-slate-900 border-r border-slate-200">{item.itemName}</td>
                                                    <td className="px-3 py-3 text-center text-xs text-slate-600 border-r border-slate-200">{item.uom}</td>
                                                    <td className="px-3 py-3 text-center text-xs font-medium text-slate-900 border-r border-slate-200">{item.orderedQty}</td>
                                                    <td className="px-3 py-3 text-right text-xs text-slate-900 border-r border-slate-200">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span className="text-slate-500">{activeInvoice.currencySymbol}</span>
                                                            <span className="font-medium">{item.rate.toFixed(2)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-xs text-slate-900">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span className="text-slate-500">{activeInvoice.currencySymbol}</span>
                                                            <span className="font-bold">{item.price.toFixed(2)}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Totals */}
                                <div className="flex justify-end">
                                    <div className="w-72 border border-slate-200 rounded-lg p-4 bg-slate-50/30">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-600">Subtotal:</span>
                                                <span className="font-bold text-slate-900">{activeInvoice?.currencySymbol} {(activeInvoice?.subtotal || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-600">Discount ({activeInvoice?.discountValue}%):</span>
                                                <span className="font-bold text-red-600">-{activeInvoice?.currencySymbol} {(activeInvoice?.discountAmount || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-600">Tax ({activeInvoice?.taxPercentage}%):</span>
                                                <span className="font-bold text-slate-900">+{activeInvoice?.currencySymbol} {(activeInvoice?.tax || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm border-t border-slate-200 pt-2 mt-2">
                                                <span className="font-bold text-slate-900 uppercase tracking-wide">Grand Total</span>
                                                <span className="font-bold text-slate-900 text-lg">{activeInvoice?.currencySymbol} {(activeInvoice?.grandTotal || 0).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 p-4 border-t bg-white">
                        <Button variant="outline" onClick={handleClosePDF}>Close</Button>
                        {canPrint(MODULE_KEY) && activeInvoice?.status !== "Draft" && (
                            <Button onClick={() => handleDownloadInvoice()} className="bg-blue-600 hover:bg-blue-700">
                                <Download className="mr-2 h-4 w-4" /> Download PDF
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Unified Invoice Form Dialog - Sales Order Structure */}
            <Dialog open={isInvoiceDialogOpen} onOpenChange={(open) => !open && handleCloseInvoice()}>
                <DialogContent 
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader className="border-b bg-white p-4 sm:p-6">
                        <DialogTitle className="text-2xl font-bold">Invoice</DialogTitle>
                        <DialogDescription>
                            Review invoice details and information.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 space-y-6 relative">
                        {isFormOpening && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
                        {/* Header Info - From Sales Order structure */}
                        <div className="rounded-lg border bg-muted/20 p-4 sm:p-5">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
                                <div className="min-w-0 space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice Code</Label>
                                    <p className="truncate text-sm font-bold text-primary">
                                        {activeInvoice?.status === "Draft" ? "-" : (activeInvoice?.invoiceNumber || "-")}
                                    </p>
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Invoice Date</Label>
                                    <p className="text-sm font-medium">
                                        {activeInvoice?.status === "Draft" ? "-" : safeFormatDate(activeInvoice?.invoiceDate)}
                                    </p>
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                                    <div className="pt-0.5">
                                        {activeInvoice && getInvoiceStatusBadge(activeInvoice.status)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Customer & Details - Read-only inputs format */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Customer</Label>
                                <Input value={activeInvoice?.customerName || ""} disabled className="h-9 bg-muted/50" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">SO Code Reference</Label>
                                <Input value={activeInvoice?.soNumber || ""} disabled className="h-9 bg-muted/50" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Contact Person</Label>
                                <Input value={activeInvoice?.contactPerson || ""} disabled className="h-9 bg-muted/50" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Mobile No</Label>
                                <Input value={activeInvoice?.mobileNo || ""} disabled className="h-9 bg-muted/50" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Shipping Address</Label>
                                <Input value={activeInvoice?.shippingAddress || ""} disabled className="h-9 bg-muted/50" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Billing Address</Label>
                                <Input value={activeInvoice?.billingAddress || ""} disabled className="h-9 bg-muted/50" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Currency</Label>
                                <Input value={activeInvoice?.currency || ""} disabled className="h-9 bg-muted/50" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Delivery Date</Label>
                                <Input value={safeFormatDate(activeInvoice?.deliveryDate)} disabled className="h-9 bg-muted/50" />
                            </div>
                        </div>

                        {/* Payment Terms Breakdown - From Pending Payment form */}
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Payment Terms Breakdown</Label>
                            <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                <Table className="table-fixed">
                                    <colgroup>
                                        <col className="w-[42%]" />
                                        <col className="w-[16%]" />
                                        <col className="w-[16%]" />
                                        <col className="w-[26%]" />
                                        {activeInvoice?.status === "Open" && <col className="w-16" />}
                                    </colgroup>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">
                                            <TableHead className="py-2 pl-6">Term Type</TableHead>
                                            <TableHead className="py-2 text-center">Percentage</TableHead>
                                            <TableHead className="py-2 text-center">Days</TableHead>
                                            <TableHead className="py-2 text-right pr-6">Term Amount</TableHead>
                                            {activeInvoice?.status === "Open" && <TableHead className="w-16"></TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeInvoice?.terms.map((term: any, index: number) => (
                                            <TableRow key={index} className="hover:bg-muted/20 border-b last:border-none align-top">
                                                <TableCell className="py-3 pl-6 font-medium whitespace-normal wrap-break-word">{term.termType}</TableCell>
                                                <TableCell className="py-3 text-center tabular-nums">{term.percentage}%</TableCell>
                                                <TableCell className="py-3 text-center tabular-nums">{term.days || "-"}</TableCell>
                                                <TableCell className="py-3 text-right pr-6 font-bold text-primary tabular-nums">
                                                    {activeInvoice.currencySymbol} {((activeInvoice.grandTotal * term.percentage) / 100).toFixed(2)}
                                                </TableCell>
                                                {activeInvoice?.status === "Open" && (
                                                    <TableCell className="w-16 py-3 text-center">
                                                        {term.termType === "Advance" && (
                                                            <Checkbox 
                                                                checked={selectedTerms.includes(term.id)}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) setSelectedTerms([...selectedTerms, term.id]);
                                                                    else setSelectedTerms(selectedTerms.filter(id => id !== term.id));
                                                                }}
                                                            />
                                                        )}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Invoice Items Table - Read-only */}
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Invoice Items</Label>
                            <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                <Table className="table-fixed">
                                    <colgroup>
                                        <col className="w-[52%]" />
                                        <col className="w-[14%]" />
                                        <col className="w-[16%]" />
                                        <col className="w-[18%]" />
                                    </colgroup>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">
                                            <TableHead className="py-2 pl-6">Item Name</TableHead>
                                            <TableHead className="py-2 text-center">Ordered Qty</TableHead>
                                            <TableHead className="py-2 text-center">Unit Price</TableHead>
                                            <TableHead className="py-2 text-right pr-6">Price</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeInvoice?.items.map((item: any) => (
                                            <TableRow key={item.id} className="hover:bg-muted/20 border-b last:border-none align-top">
                                                <TableCell className="py-3 pl-6">
                                                    <div className="font-bold text-sm text-primary whitespace-normal wrap-break-word">
                                                        {item.itemName}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3 text-center font-medium tabular-nums">{item.orderedQty}</TableCell>
                                                <TableCell className="py-3 text-center tabular-nums">{activeInvoice.currencySymbol} {item.rate.toFixed(2)}</TableCell>
                                                <TableCell className="py-3 text-right pr-6 font-bold text-slate-900 tabular-nums">
                                                    {activeInvoice.currencySymbol} {item.price.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Totals Summary */}
                        <div className="flex justify-end">
                            <div className="w-full sm:w-80 space-y-2 p-4 bg-muted/20 rounded-lg border shadow-sm">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-muted-foreground">Subtotal:</span>
                                    <span className="font-bold">{activeInvoice?.currencySymbol || "USh"} {(activeInvoice?.subtotal || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Discount ({activeInvoice?.discountValue}%):</span>
                                    <span className="font-bold text-red-600">-{activeInvoice?.currencySymbol || "USh"} {(activeInvoice?.discountAmount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Tax ({activeInvoice?.taxPercentage}%):</span>
                                    <span className="font-bold text-green-600">+{activeInvoice?.currencySymbol || "USh"} {(activeInvoice?.tax || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm pt-2 border-t mt-1">
                                    <span className="font-bold text-slate-800">GRAND TOTAL</span>
                                    <span className="font-bold text-primary">{activeInvoice?.currencySymbol || "USh"} {(activeInvoice?.grandTotal || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer - Status-wise Behavior */}
                    <DialogFooter className="border-t bg-white p-4 sm:p-6 mt-auto gap-2 sm:flex-row sm:items-center sm:justify-end">
                        {/* Draft Status Buttons */}
                        {activeInvoice?.status === "Draft" && (
                            <>
                                <Button variant="outline" onClick={handleCloseInvoice}>Close</Button>
                                <Button 
                                    onClick={handleMarkAsInvoiced} 
                                    loading={isMarkingInvoiced}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    disabled={!canEdit(MODULE_KEY) || isFormOpening || isMarkingInvoiced}
                                >
                                    Open Invoice
                                </Button>
                            </>
                        )}

                        {/* Open Status Buttons */}
                        {activeInvoice?.status === "Open" && (
                            <>
                                <Button variant="outline" onClick={handleCloseInvoice}>Close</Button>
                                <Button 
                                    onClick={() => {
                                        toast({
                                            title: "Action Not Implemented",
                                            description: "Marking as partially paid is coming soon.",
                                        });
                                    }} 
                                    className="bg-blue-600 hover:bg-blue-700"
                                    disabled={!canEdit(MODULE_KEY)}
                                >
                                    Mark as Partially Paid
                                </Button>
                            </>
                        )}

                        {/* Other Statuses - Only Close */}
                        {activeInvoice?.status !== "Draft" && activeInvoice?.status !== "Open" && (
                            <Button variant="outline" onClick={handleCloseInvoice}>Close</Button>
                        )}
                        
                        {/* Download button for non-pending (Hidden for Open status in edit mode) */}
                        {canPrint(MODULE_KEY) && activeInvoice?.status !== "Invoice Pending" && activeInvoice?.status !== "Draft" && activeInvoice?.status !== "Open" && (
                            <Button
                                onClick={() => handleDownloadInvoice(activeInvoice || undefined)}
                                variant="outline"
                                className="sm:mr-auto sm:order-first"
                            >
                                <Download className="mr-2 h-4 w-4" /> Download PDF
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Cancel Confirmation Dialog */}
            <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">
                            Cancel
                        </DialogTitle>
                        <DialogDescription className="py-3">
                            Are you sure you want to cancel this invoice?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsCancelDialogOpen(false)}
                            disabled={isCancelling}
                        >
                            No
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleConfirmCancel}
                            loading={isCancelling}
                            disabled={isCancelling}
                        >
                            Yes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Invoicing;
