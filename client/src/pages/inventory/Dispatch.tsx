import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    FileText,
    Check,
    X,
    CalendarIcon,
    ChevronDown,
    ChevronsUpDown,
    Paperclip,
    Plus,
    Settings2,
    AlertCircle,
    Download,
    LayoutGrid,
    Trash2
} from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker } from "@/components/shared/DatePicker";

import {
    getSalesOrders,
    updateSalesOrder,
    type SOData as SalesOrderData,
    type DispatchEntry,
    type SOStatus as DispatchStatus
} from "@/lib/mockSalesOrders";

import {
    getInvoices,
    type InvoiceData
} from "@/lib/mockInvoices";

import {
    getSalesFollowUpByInvoice,
    getPaymentFollowUpByInvoice,
    createFollowUpFromInvoice,
    getSalesFollowUpRecords,
    getPaymentFollowUpRecords
} from "@/lib/followUpStore";

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

// Local DatePicker removed in favor of shared component




function getDispatchStatusBadge(status: DispatchStatus) {
    switch (status) {
        case "Dispatch Pending": return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none px-3 py-1 text-[10px] font-bold">Dispatch Pending</Badge>;
        case "Dispatched": return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none px-3 py-1 text-[10px] font-bold">Dispatched</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
}

// ============================================================================
// MAIN DISPATCH COMPONENT
// ============================================================================

export default function Dispatch() {
    const { toast } = useToast();

    const [salesOrders, setSalesOrders] = useState<SalesOrderData[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("Dispatch Pending");
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Track if save is in progress to prevent duplicate submissions
    const [isSaving, setIsSaving] = useState(false);
    const followUpCreationRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const loadOrders = () => {
            const allOrders = getSalesOrders();
            console.log('[DISPATCH] Loading all sales orders:', {
                totalOrders: allOrders.length,
                orders: allOrders.map(o => ({
                    soNumber: o.soNumber,
                    status: o.status,
                    itemsCount: o.items?.length || 0,
                    itemCodes: o.items?.map(i => i.itemCode) || []
                }))
            });

            // Filter for Dispatch Pending and Dispatched orders
            const relevantStatuses: DispatchStatus[] = ["Dispatch Pending", "Dispatched"];
            const filtered = allOrders.filter(order => relevantStatuses.includes(order.status));

            console.log('[DISPATCH] Filtered orders for dispatch:', {
                filteredCount: filtered.length,
                orders: filtered.map(o => ({
                    soNumber: o.soNumber,
                    status: o.status,
                    itemsCount: o.items?.length || 0
                }))
            });

            setSalesOrders(filtered);
        };

        loadOrders();

        const handleStorageChange = (e: any) => {
            if (e.key === "erp_mock_sales_orders_v2" || e.type === "erp:sales-orders-updated") {
                loadOrders();
            }
        };
        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("erp:sales-orders-updated", handleStorageChange);
        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("erp:sales-orders-updated", handleStorageChange);
        };
    }, []);


    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<SalesOrderData | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Dispatch Form State
    const [dispatchForm, setDispatchForm] = useState({
        itemCode: "",
        dispatchQty: "",
        dispatchDate: new Date(),
        note: ""
    });
    const [tempDispatches, setTempDispatches] = useState<DispatchEntry[]>([]);
    const [remarks, setRemarks] = useState("");
    const [selectedWarehouse, setSelectedWarehouse] = useState("");
    const [scannedSerials, setScannedSerials] = useState<string[]>([]);
    const [scanValue, setScanValue] = useState("");

    // Filtering
    const filteredOrders = salesOrders.filter(order => {
        const matchesSearch = order.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customerName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === "all" || order.status === statusFilter;

        let matchesDate = true;
        if (dateFilter) {
            const orderDateObj = new Date(order.soDate);
            orderDateObj.setHours(0, 0, 0, 0);
            const filterDate = new Date(dateFilter);
            filterDate.setHours(0, 0, 0, 0);
            matchesDate = orderDateObj.getTime() === filterDate.getTime();
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, dateFilter]);

    // Debug: Log when selectedOrder changes
    useEffect(() => {
        if (selectedOrder) {
            console.log('[DISPATCH DEBUG] selectedOrder state updated:', {
                soNumber: selectedOrder.soNumber,
                itemsCount: selectedOrder.items?.length || 0,
                itemCodes: selectedOrder.items?.map(i => i.itemCode) || []
            });
        }
    }, [selectedOrder]);

    // Handlers
    const handleOpenOrder = (order: SalesOrderData, edit: boolean) => {
        console.log('[DISPATCH DEBUG] Opening order:', {
            soNumber: order.soNumber,
            itemsCount: order.items?.length || 0,
            items: order.items,
            itemCodes: order.items?.map(i => i.itemCode),
            status: order.status
        });

        setSelectedOrder(order);
        setIsEditMode(edit);
        setTempDispatches([...order.dispatches]);
        setRemarks(order.remarks || "");
        setSelectedWarehouse(order.warehouse || "");
        setDispatchForm({
            itemCode: "",
            dispatchQty: "",
            dispatchDate: new Date(),
            note: ""
        });
        setScannedSerials([]);
        setScanValue("");
        setIsSaving(false); // Reset saving state when opening dialog
        setIsDialogOpen(true);
    };

    const handleAddDispatch = () => {
        if (!dispatchForm.itemCode || !dispatchForm.dispatchQty) {
            toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive" });
            return;
        }

        const qty = parseFloat(dispatchForm.dispatchQty);
        if (isNaN(qty) || qty <= 0) {
            toast({ title: "Validation Error", description: "Invalid quantity.", variant: "destructive" });
            return;
        }

        // FIXED: Find item by itemCode OR itemName (since some items might not have itemCode)
        const item = selectedOrder?.items.find(i => {
            const itemIdentifier = (i.itemCode && i.itemCode.trim() !== "") ? i.itemCode : i.itemName;
            return itemIdentifier === dispatchForm.itemCode;
        });

        if (!item) {
            console.error('[DISPATCH] Item not found:', dispatchForm.itemCode);
            return;
        }

        // Use itemCode if available, otherwise use itemName as identifier
        const itemIdentifier = (item.itemCode && item.itemCode.trim() !== "") ? item.itemCode : item.itemName;

        // Check against ordered quantity
        const currentDispatched = tempDispatches
            .filter(d => {
                // Match by itemCode if available, otherwise by itemName
                const dispatchIdentifier = (d.itemCode && d.itemCode.trim() !== "") ? d.itemCode : d.itemName;
                return dispatchIdentifier === itemIdentifier;
            })
            .reduce((sum, d) => sum + d.dispatchQty, 0);

        if (currentDispatched + qty > item.orderedQty) {
            toast({ title: "Validation Error", description: "Total dispatch quantity cannot exceed ordered quantity.", variant: "destructive" });
            return;
        }

        const newEntry: DispatchEntry = {
            id: Date.now(),
            itemCode: itemIdentifier, // Store the identifier (itemCode or itemName)
            itemName: item.itemName,
            dispatchQty: qty,
            dispatchDate: format(dispatchForm.dispatchDate, "yyyy-MM-dd"),
            note: dispatchForm.note,
            serialNumbers: [...scannedSerials]
        };

        setTempDispatches(prev => [...prev, newEntry]);

        // Reset entry form
        setDispatchForm({
            itemCode: "",
            dispatchQty: "",
            dispatchDate: new Date(),
            note: ""
        });
        setScannedSerials([]);
        setScanValue("");
    };

    const handleRemoveDispatch = (id: number) => {
        setTempDispatches(prev => prev.filter(d => d.id !== id));
    };

    const handleSaveDispatch = () => {
        if (!selectedOrder) return;

        // Prevent double-click/double-save
        if (isSaving) {
            console.log('[DISPATCH] ⚠️ Save already in progress, ignoring duplicate call');
            return;
        }

        setIsSaving(true);
        console.log('[DISPATCH] Save dispatch started for SO:', selectedOrder.soNumber);

        // CRITICAL: Prevent duplicate submissions
        if (isSaving) {
            console.log('[DISPATCH] ⚠️ Save already in progress, ignoring duplicate call');
            return;
        }

        setIsSaving(true);

        try {
            // Calculate updated quantities
            const updatedItems = selectedOrder.items.map(item => {
                // FIXED: Match dispatches by itemCode OR itemName
                const itemIdentifier = (item.itemCode && item.itemCode.trim() !== "") ? item.itemCode : item.itemName;

                const totalDispatched = tempDispatches
                    .filter(d => {
                        const dispatchIdentifier = (d.itemCode && d.itemCode.trim() !== "") ? d.itemCode : d.itemName;
                        return dispatchIdentifier === itemIdentifier;
                    })
                    .reduce((sum, d) => sum + d.dispatchQty, 0);
                return { ...item, dispatchedQty: totalDispatched };
            });

            // Determine new status
            const allDispatched = updatedItems.every(i => i.dispatchedQty >= i.orderedQty);
            const newDispatchStatus: DispatchStatus = allDispatched ? "Dispatched" : "Dispatch Pending";
            // Update SO status to "Dispatched" if all is done
            const newSOStatus: any = allDispatched ? "Dispatched" : "Dispatch Pending";

            const updatedOrder: any = {
                ...selectedOrder,
                items: updatedItems,
                dispatches: tempDispatches,
                status: newSOStatus,
                remarks: remarks, // Sync with SO field name if needed
                warehouse: selectedWarehouse // Sync with SO field name
            };

            // Save to centralized mock store
            updateSalesOrder(updatedOrder.id, updatedOrder);

            // CRITICAL: If dispatch is completed, create follow-up records ONCE
            if (allDispatched) {
                console.log('[DISPATCH] ========================================');
                console.log('[DISPATCH] DISPATCH COMPLETED - FOLLOW-UP CREATION START');
                console.log('[DISPATCH] SO Number:', selectedOrder.soNumber);

                // Find the invoice for this SO
                const allInvoices = getInvoices();
                console.log('[DISPATCH] Looking for invoice with SO Number:', selectedOrder.soNumber);
                console.log('[DISPATCH] Available invoices:', allInvoices.map(inv => ({
                    invoiceNo: inv.invoiceNumber,
                    soNumber: inv.soNumber
                })));

                const invoice = allInvoices.find(inv => inv.soNumber === selectedOrder.soNumber);

                if (!invoice) {
                    console.error('[DISPATCH] ❌ No invoice found for SO:', selectedOrder.soNumber);
                    toast({
                        title: "Warning",
                        description: "Dispatch completed but no invoice found. Follow-up records not created.",
                        variant: "destructive"
                    });
                    setIsSaving(false);
                    setIsDialogOpen(false);
                    return;
                }

                console.log('[DISPATCH] ✓ Found invoice:', invoice.invoiceNumber);
                console.log('[DISPATCH] Invoice Grand Total:', invoice.grandTotal);
                console.log('[DISPATCH] Invoice Terms:', invoice.terms?.length || 0);

                // STRICT DUPLICATE PREVENTION: Check both in-memory ref and store
                const invoiceKey = invoice.invoiceNumber;

                // Check if we've already processed this invoice in this session
                if (followUpCreationRef.current.has(invoiceKey)) {
                    console.log('[DISPATCH] ⚠️⚠️⚠️ DUPLICATE DETECTED IN REF - Invoice already processed in this session');
                    toast({
                        title: "Dispatch Completed",
                        description: "Dispatch saved. Follow-up records already exist."
                    });
                    setIsSaving(false);
                    setIsDialogOpen(false);
                    return;
                }

                // Check for existing records in store
                console.log('[DISPATCH] CHECKING FOR EXISTING RECORDS IN STORE');
                const existingSalesFollowUp = getSalesFollowUpByInvoice(invoice.invoiceNumber);
                const existingPaymentFollowUp = getPaymentFollowUpByInvoice(invoice.invoiceNumber);

                console.log('[DISPATCH] Existing Sales Follow Up for', invoice.invoiceNumber + ':', existingSalesFollowUp ? 'FOUND' : 'NOT FOUND');
                console.log('[DISPATCH] Existing Payment Follow Up for', invoice.invoiceNumber + ':', existingPaymentFollowUp ? 'FOUND' : 'NOT FOUND');

                // If EITHER record exists, skip creation (defensive check)
                if (existingSalesFollowUp || existingPaymentFollowUp) {
                    console.log('[DISPATCH] ⚠️⚠️⚠️ Follow-up records ALREADY EXIST in store - skipping creation');
                    toast({
                        title: "Dispatch Completed",
                        description: "Dispatch saved. Follow-up records already exist."
                    });
                    // Mark as processed to prevent future attempts
                    followUpCreationRef.current.add(invoiceKey);
                    setIsSaving(false);
                    setIsDialogOpen(false);
                    return;
                }

                // Mark as being processed BEFORE creation to prevent race conditions
                followUpCreationRef.current.add(invoiceKey);

                // Create both Sales and Payment Follow Up records atomically
                console.log('[DISPATCH] ✅ CREATING FOLLOW-UP RECORDS (first time for this invoice)');
                try {
                    // Calculate delivery date from latest dispatch
                    const latestDispatchDate = tempDispatches.length > 0
                        ? tempDispatches.reduce((latest, dispatch) => {
                            return dispatch.dispatchDate > latest ? dispatch.dispatchDate : latest;
                        }, tempDispatches[0].dispatchDate)
                        : format(new Date(), "yyyy-MM-dd");

                    // Create both follow-up records atomically
                    // This function creates EXACTLY ONE Sales Follow Up and ONE Payment Follow Up
                    createFollowUpFromInvoice(invoice.invoiceNumber, invoice.soNumber, latestDispatchDate);

                    console.log('[DISPATCH] ✓✓✓ Follow-up records created successfully');

                    // Verify creation
                    const verifyS = getSalesFollowUpByInvoice(invoice.invoiceNumber);
                    const verifyP = getPaymentFollowUpByInvoice(invoice.invoiceNumber);
                    console.log('[DISPATCH] VERIFICATION:', {
                        salesCreated: !!verifyS,
                        paymentCreated: !!verifyP
                    });

                } catch (error) {
                    console.error('[DISPATCH] ❌❌❌ ERROR creating follow-up records:', error);
                    // Remove from ref on error so it can be retried
                    followUpCreationRef.current.delete(invoiceKey);
                    toast({
                        title: "Error",
                        description: "Failed to create follow-up records. Please try again.",
                        variant: "destructive"
                    });
                    setIsSaving(false);
                    return;
                }

                console.log('[DISPATCH] FOLLOW-UP CREATION COMPLETE');
                console.log('[DISPATCH] Sales Follow Up total records:', getSalesFollowUpRecords().length);
                console.log('[DISPATCH] Payment Follow Up total records:', getPaymentFollowUpRecords().length);
                console.log('[DISPATCH] ========================================');

                // Show success message
                toast({
                    title: "Dispatch Completed",
                    description: "Dispatch saved and follow-up records created successfully."
                });
            } else {
                toast({ title: "Success", description: "Dispatch record updated successfully." });
            }

            // Refresh local state
            const allOrders = getSalesOrders();
            const relevantStatuses: DispatchStatus[] = ["Dispatch Pending", "Dispatched"];
            setSalesOrders(allOrders.filter(o => relevantStatuses.includes(o.status)));

            setIsDialogOpen(false);
        } finally {
            // Always reset saving state
            setIsSaving(false);
        }
    };

    const handlePrintDispatch = () => {
        if (!selectedOrder) return;

        // Use a hidden iframe to print without opening a new tab
        let iframe = document.getElementById("print-iframe") as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement("iframe");
            iframe.id = "print-iframe";
            iframe.style.position = "absolute";
            iframe.style.width = "0px";
            iframe.style.height = "0px";
            iframe.style.border = "none";
            document.body.appendChild(iframe);
        }

        const dispatchDate = selectedOrder.dispatches.length > 0
            ? selectedOrder.dispatches[selectedOrder.dispatches.length - 1].dispatchDate
            : format(new Date(), "dd-MM-yyyy");

        const formattedDispatchDate = format(new Date(dispatchDate), "dd-MM-yyyy");

        const htmlContent = `
            <html>
                <head>
                    <title>Dispatch Note - ${selectedOrder.soNumber}</title>
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

                        .details-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
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
                                <p># DSP-${selectedOrder.id}</p>
                            </div>
                        </div>

                        <div class="details-grid">
                            <div class="info-box">
                                <h3>Customer Details</h3>
                                <div class="info-item"><strong>Customer</strong><span>${selectedOrder.customerName}</span></div>
                                <div class="info-item"><strong>Address</strong><span>${selectedOrder.shippingAddress || "N/A"}</span></div>
                            </div>
                            <div class="info-box">
                                <h3>Order Details</h3>
                                <div class="info-item"><strong>SO Number</strong><span>${selectedOrder.soNumber}</span></div>
                                <div class="info-item"><strong>Warehouse</strong><span>${selectedOrder.warehouse || "Main Warehouse"}</span></div>
                                <div class="info-item"><strong>Dispatch Date</strong><span>${formattedDispatchDate}</span></div>
                                <div class="info-item"><strong>Delivery Date</strong><span>${selectedOrder.deliveryDate ? format(new Date(selectedOrder.deliveryDate), "dd-MM-yyyy") : "N/A"}</span></div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th width="50">#</th>
                                    <th>Item Details</th>
                                    <th width="60">UOM</th>
                                    <th width="80" class="text-right">Ordered</th>
                                    <th width="80" class="text-right">Dispatched</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${selectedOrder.items.map((item, index) => `
                                    <tr>
                                        <td class="text-right">${index + 1}</td>
                                        <td>
                                            <div class="font-bold">${item.itemCode}</div>
                                            <div style="font-size: 9px; color: #64748b;">${item.itemName}</div>
                                        </td>
                                        <td>${item.uom}</td>
                                        <td class="text-right">${item.orderedQty}</td>
                                        <td class="text-right font-bold" style="color: #1e40af;">${item.dispatchedQty}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>

                        ${selectedOrder.remarks ? `
                            <div class="remarks-section">
                                <h3>Remarks / Special Instructions</h3>
                                <div class="remarks-box">${selectedOrder.remarks}</div>
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

    return (
        <div className="flex flex-col gap-6 h-full min-h-0">
            <div className="flex flex-row justify-between items-center gap-2">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Dispatch</h1>
                    <p className="text-muted-foreground">Manage and track sales order dispatches to customers.</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                        localStorage.removeItem("erp_mock_sales_orders");
                        window.location.reload();
                    }}
                >
                    <Trash2 className="h-4 w-4" /> Reset Data
                </Button>
            </div>

            <div className="flex flex-col gap-6">
                <AppListToolbar
                    search={{
                        value: searchTerm,
                        onChange: setSearchTerm,
                        placeholder: "Search by SO Number or Customer..."
                    }}
                    filters={[
                        {
                            type: 'select',
                            label: 'Status',
                            value: statusFilter,
                            options: [{ label: "All Status", value: "all" }, "Dispatch Pending", "Dispatched"],
                            onChange: (val) => setStatusFilter(val),
                            searchable: true
                        },
                        {
                            type: 'date',
                            label: 'Date',
                            value: dateFilter,
                            onChange: setDateFilter
                        }
                    ]}
                />

                <Card>
                    <CardContent className="pt-6">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4 pl-6">Dispatch No</TableHead>
                                        <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4">Dispatch Date</TableHead>
                                        <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4">SO NO</TableHead>
                                        <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4">Customer Name</TableHead>
                                        <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4">Delivery Date</TableHead>
                                        <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4 text-center">Status</TableHead>
                                        <TableHead className="text-center w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedOrders.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                                No Sales Orders found matching your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedOrders.map((order) => (
                                            <TableRow key={order.id} className="hover:bg-muted/30 transition-colors border-b">
                                                <TableCell className="py-4 pl-6 font-medium text-xs text-primary">
                                                    {(order.dispatches?.length || 0) > 0 ? `DSP-${order.id}` : "N/A"}
                                                </TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                    {(order.dispatches?.length || 0) > 0 ? (
                                                        order.dispatches[order.dispatches.length - 1].dispatchDate.includes('-') ?
                                                            format(new Date(order.dispatches[order.dispatches.length - 1].dispatchDate), "dd-MM-yyyy") :
                                                            order.dispatches[order.dispatches.length - 1].dispatchDate
                                                    ) : "-"}
                                                </TableCell>
                                                <TableCell className="py-4 text-sm font-bold text-primary">{order.soNumber}</TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">{order.customerName}</TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                    {order.deliveryDate ? (order.deliveryDate.includes('-') ? format(new Date(order.deliveryDate), "dd-MM-yyyy") : order.deliveryDate) : "-"}
                                                </TableCell>
                                                <TableCell className="py-4 text-center">{getDispatchStatusBadge(order.status as any)}</TableCell>
                                                <TableCell className="py-4 text-center">
                                                    <TableActionButtons
                                                        onView={() => handleOpenOrder(order, false)}
                                                        onEdit={order.status !== "Dispatched" ? () => handleOpenOrder(order, true) : undefined}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {filteredOrders.length > 0 && (
                            <DataTablePagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={filteredOrders.length}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                                options={[10, 15, 30, 50]}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Config Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[1000px] max-h-[95vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-2">
                        <div className="flex items-center gap-3 mb-1">
                            <Settings2 className="h-5 w-5 text-primary" />
                            <DialogTitle className="text-2xl font-bold">
                                {isEditMode ? "Configure Dispatch:" : "View Dispatch:"} {selectedOrder?.soNumber}
                            </DialogTitle>
                        </div>
                        <DialogDescription>
                            Review Sales Order details and record dispatched item quantities.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        {/* Form Fields */}
                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide">Dispatch Date</Label>
                                <Input value={format(dispatchForm.dispatchDate, "dd-MM-yyyy")} readOnly className="bg-muted" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide">SO NO</Label>
                                <Input value={selectedOrder?.soNumber || ""} readOnly className="bg-muted" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide">Customer Name</Label>
                                <Input value={selectedOrder?.customerName || ""} readOnly className="bg-muted" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide">Delivery Date</Label>
                                <Input value={selectedOrder?.deliveryDate ? (selectedOrder.deliveryDate.includes('-') ? format(new Date(selectedOrder.deliveryDate), "dd-MM-yyyy") : selectedOrder.deliveryDate) : "N/A"} readOnly className="bg-muted" />
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <Label className="text-xs font-bold uppercase tracking-wide">Shipping Address</Label>
                                <Input value={selectedOrder?.shippingAddress || ""} readOnly className="bg-muted" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide">Warehouse</Label>
                                <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse} disabled={!isEditMode}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Warehouse" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Jinja WH">Jinja WH</SelectItem>
                                        <SelectItem value="Kampala WH">Kampala WH</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 col-span-3">
                                <Label className="text-xs font-bold uppercase tracking-wide">Remarks</Label>
                                <Textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    disabled={!isEditMode}
                                    placeholder="Enter any notes or remarks..."
                                />
                            </div>
                        </div>

                        {/* Tabs */}
                        <Tabs defaultValue="dispatch-items" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="dispatch-items" className="font-bold">Dispatch Request</TabsTrigger>
                                <TabsTrigger value="make-dispatch" className="font-bold">Dispatch Order</TabsTrigger>
                            </TabsList>

                            <TabsContent value="dispatch-items" className="space-y-6 outline-none">
                                <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider pl-4">Item</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider">UOM</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider">Rate/UOM</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider text-right">Ordered Qty</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider text-right pr-4">Dispatched Qty</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedOrder?.items.map((item) => {
                                                // FIXED: Match dispatches by itemCode OR itemName
                                                const itemIdentifier = (item.itemCode && item.itemCode.trim() !== "") ? item.itemCode : item.itemName;

                                                const totalDispatched = tempDispatches
                                                    .filter(d => {
                                                        const dispatchIdentifier = (d.itemCode && d.itemCode.trim() !== "") ? d.itemCode : d.itemName;
                                                        return dispatchIdentifier === itemIdentifier;
                                                    })
                                                    .reduce((sum, d) => sum + d.dispatchQty, 0);

                                                return (
                                                    <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                                                        <TableCell className="py-4 pl-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-xs text-primary">{item.itemCode}</span>
                                                                <span className="text-[10px] text-slate-500 font-medium">{item.itemName}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-[9px] text-muted-foreground uppercase font-bold">{item.uom}</TableCell>
                                                        <TableCell className="text-slate-900 font-medium">${item.rate || 0}/{item.uom}</TableCell>
                                                        <TableCell className="text-right text-primary font-bold">{item.orderedQty}</TableCell>
                                                        <TableCell className="text-right text-blue-600 font-bold pr-4">
                                                            {totalDispatched}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            <TabsContent value="make-dispatch" className="mt-0 outline-none">
                                <div className="space-y-8">
                                    {isEditMode && (
                                        <div className="grid grid-cols-12 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
                                            <div className="col-span-4">
                                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Item Selection <span className="text-red-500">*</span></Label>
                                                <Select value={dispatchForm.itemCode} onValueChange={(v) => setDispatchForm(prev => ({ ...prev, itemCode: v }))}>
                                                    <SelectTrigger className="h-10 bg-white border-slate-200">
                                                        <SelectValue placeholder="Select Item" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(() => {
                                                            console.log('[DISPATCH DEBUG] SelectContent rendering - selectedOrder:', {
                                                                exists: !!selectedOrder,
                                                                soNumber: selectedOrder?.soNumber,
                                                                itemsExists: !!selectedOrder?.items,
                                                                itemsIsArray: Array.isArray(selectedOrder?.items),
                                                                itemsLength: selectedOrder?.items?.length || 0,
                                                                fullItems: selectedOrder?.items
                                                            });

                                                            const allItems = selectedOrder?.items || [];

                                                            // Log each item's structure
                                                            allItems.forEach((item, idx) => {
                                                                console.log(`[DISPATCH DEBUG] Item ${idx}:`, {
                                                                    id: item.id,
                                                                    itemCode: item.itemCode,
                                                                    itemCodeType: typeof item.itemCode,
                                                                    itemCodeEmpty: !item.itemCode,
                                                                    itemCodeTrimmed: item.itemCode?.trim(),
                                                                    itemName: item.itemName,
                                                                    fullItem: item
                                                                });
                                                            });

                                                            // FIXED: Accept items with itemName even if itemCode is missing
                                                            // Use itemName as fallback identifier if itemCode is empty
                                                            const filteredItems = allItems.filter(item => {
                                                                const hasItemCode = item.itemCode && item.itemCode.trim() !== "";
                                                                const hasItemName = item.itemName && item.itemName.trim() !== "";
                                                                return hasItemCode || hasItemName;
                                                            });

                                                            console.log('[DISPATCH DEBUG] Item dropdown rendering:', {
                                                                totalItems: allItems.length,
                                                                filteredItems: filteredItems.length,
                                                                allItemCodes: allItems.map(i => i.itemCode),
                                                                allItemNames: allItems.map(i => i.itemName),
                                                                filteredItemCodes: filteredItems.map(i => i.itemCode),
                                                                items: filteredItems.map(i => ({ code: i.itemCode, name: i.itemName }))
                                                            });

                                                            if (filteredItems.length === 0) {
                                                                return <SelectItem value="no-items" disabled>No items available</SelectItem>;
                                                            }

                                                            return filteredItems.map(item => {
                                                                // Use itemCode if available, otherwise use itemName as the value
                                                                const itemValue = (item.itemCode && item.itemCode.trim() !== "")
                                                                    ? item.itemCode
                                                                    : item.itemName;

                                                                // Display format: show itemCode if available, otherwise just itemName
                                                                const displayText = (item.itemCode && item.itemCode.trim() !== "")
                                                                    ? `${item.itemCode} - ${item.itemName}`
                                                                    : item.itemName;

                                                                return (
                                                                    <SelectItem key={item.id} value={itemValue}>
                                                                        {displayText}
                                                                    </SelectItem>
                                                                );
                                                            });
                                                        })()}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="col-span-3">
                                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Dispatch Qty <span className="text-red-500">*</span></Label>
                                                <Input
                                                    type="number"
                                                    className="h-10 bg-white border-slate-200"
                                                    value={dispatchForm.dispatchQty}
                                                    onChange={(e) => setDispatchForm(prev => ({ ...prev, dispatchQty: e.target.value }))}
                                                />
                                            </div>

                                            <div className="col-span-4">
                                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Note</Label>
                                                <Input
                                                    className="h-10 bg-white border-slate-200"
                                                    value={dispatchForm.note}
                                                    onChange={(e) => setDispatchForm(prev => ({ ...prev, note: e.target.value }))}
                                                    placeholder="Reason for dispatch..."
                                                />
                                            </div>

                                            {/* QR Scanning Section */}
                                            <div className="col-span-12 grid grid-cols-12 gap-6 pt-2 border-t border-slate-200 mt-2">
                                                <div className="col-span-5">
                                                    <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide flex items-center gap-2">
                                                        Scan QR Code <span className="text-[10px] lowercase font-normal text-muted-foreground">(Optional)</span>
                                                    </Label>
                                                    <div className="relative">
                                                        <Input
                                                            placeholder="Scan or type serial number..."
                                                            className="h-10 pr-20 bg-white border-slate-300 focus:border-primary shadow-sm"
                                                            value={scanValue}
                                                            onChange={(e) => setScanValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter" && scanValue.trim()) {
                                                                    e.preventDefault();
                                                                    if (scannedSerials.includes(scanValue.trim())) {
                                                                        toast({ title: "Duplicate Serial", description: "This serial number has already been scanned.", variant: "destructive" });
                                                                    } else {
                                                                        setScannedSerials(prev => [...prev, scanValue.trim()]);
                                                                        setScanValue("");
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <div className="absolute right-2 top-1.5 h-7 px-2 flex items-center justify-center bg-slate-100 rounded text-[10px] font-bold text-slate-500 border border-slate-200">
                                                            ENTER ↵
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="col-span-6">
                                                    <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Scanned Serials</Label>
                                                    <div className="h-10 flex items-center gap-2 px-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                                                        <div className={cn(
                                                            "h-6 min-w-10 px-2 rounded-full flex items-center justify-center text-[11px] font-bold",
                                                            scannedSerials.length > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
                                                        )}>
                                                            {scannedSerials.length} CODES
                                                        </div>
                                                        {scannedSerials.length > 0 && (
                                                            <div className="flex-1 overflow-hidden">
                                                                <p className="text-[10px] text-slate-500 truncate italic">
                                                                    Last scanned: {scannedSerials[scannedSerials.length - 1]}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {scannedSerials.length > 0 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => setScannedSerials([])}
                                                            >
                                                                Clear All
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="col-span-1 flex items-end pb-0.5">
                                                    <Button
                                                        onClick={handleAddDispatch}
                                                        className="h-10 w-10 p-0 rounded-xl shadow-lg shadow-primary/20"
                                                        title="Add to Dispatch List"
                                                    >
                                                        <Plus className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider pl-4">Item</TableHead>
                                                    <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider text-center">Dispatch Qty</TableHead>
                                                    <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider">Note</TableHead>
                                                    {isEditMode && <TableHead className="text-center font-bold text-[10px] py-3 tracking-wider">Actions</TableHead>}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {tempDispatches.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={isEditMode ? 4 : 3} className="h-20 text-center text-muted-foreground text-xs italic">
                                                            No dispatch entries recorded yet.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    tempDispatches.map((entry) => (
                                                        <TableRow key={entry.id} className="hover:bg-muted/10 transition-colors border-slate-50">
                                                            <TableCell className="py-3 pl-4">
                                                                <span className="font-bold text-xs text-primary">{entry.itemCode}</span>
                                                            </TableCell>
                                                            <TableCell className="py-3 text-center">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="text-blue-600 font-bold">{entry.dispatchQty}</span>
                                                                    {entry.serialNumbers && entry.serialNumbers.length > 0 && (
                                                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal border-blue-200 text-blue-600 bg-blue-50/50">
                                                                            {entry.serialNumbers.length} CODES
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-3 text-sm text-slate-500">{entry.note || "-"}</TableCell>
                                                            {isEditMode && (
                                                                <TableCell className="py-3 text-right pr-4">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                        onClick={() => handleRemoveDispatch(entry.id)}
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
                            </TabsContent>
                        </Tabs>
                    </div>

                    <DialogFooter className="p-6 border-t bg-slate-50/50 rounded-b-xl">
                        {!isEditMode && selectedOrder?.status === "Dispatched" && (
                            <Button onClick={handlePrintDispatch} className="mr-auto px-6 h-11 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200">
                                <Download className="mr-2 h-4 w-4" /> Download Dispatch Note
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={() => setIsDialogOpen(false)}
                            className="px-6 h-11 font-bold"
                            disabled={isSaving}
                        >
                            Close
                        </Button>
                        {isEditMode && (
                            <Button
                                onClick={handleSaveDispatch}
                                className="px-8 h-11 font-bold shadow-lg shadow-primary/20"
                                disabled={isSaving}
                            >
                                <Check className="mr-2 h-4 w-4" />
                                {isSaving ? "Saving..." : "Save Dispatch"}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
