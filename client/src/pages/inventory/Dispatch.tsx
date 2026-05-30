import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
    Trash2,
    Loader2
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
import { SearchableSelect as SharedSearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker as SharedDatePicker } from "@/components/shared/DatePicker";

import {
    type SOData as SalesOrderData,
    type DispatchEntry
} from "@/lib/mockSalesOrders";

import { inventoryApi, commonApi, type DispatchRecord } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Get currency symbol from name or code
const getCurrencySymbol = (currencyName: string = "") => {
    const symbols: { [key: string]: string } = {
        'INDIAN RUPEE': '₹',
        'INR': '₹',
        'US DOLLAR': '$',
        'USD': '$',
        'EURO': '€',
        'EUR': '€',
        'BRITISH POUND': '£',
        'GBP': '£',
        'JAPANESE YEN': '¥',
        'JPY': '¥',
        'CHINESE YUAN': '¥',
        'CNY': '¥',
        'AUSTRALIAN DOLLAR': 'A$',
        'AUD': 'A$',
        'CANADIAN DOLLAR': 'C$',
        'CAD': 'C$',
        'SWISS FRANC': 'Fr',
        'CHF': 'Fr',
        'SWEDISH KRONA': 'kr',
        'SEK': 'kr',
        'NEW ZEALAND DOLLAR': 'NZ$',
        'NZD': 'NZ$',
        'UGANDAN SHILLING': 'USh',
        'UGX': 'USh',
        'USH': 'USh'
    };

    const upperName = (currencyName || "").toUpperCase().trim();
    return symbols[upperName] || upperName || '$';
};

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================




function getDispatchStatusBadge(status: string) {
    const s = status.toLowerCase();
    if (s.includes("pending")) {
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none px-3 py-1 text-[10px] font-bold">{status}</Badge>;
    } else if (s.includes("dispatched") || s.includes("completed")) {
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none px-3 py-1 text-[10px] font-bold">{status}</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
}

// ============================================================================
// MAIN DISPATCH COMPONENT
// ============================================================================

export default function Dispatch() {
    const { canView, canEdit, isMenuVisible } = useHasPermission();
    const permissionModule = "INVENTORY/DISPATCH";

    if (!isMenuVisible(permissionModule)) {
        return <Unauthorized />;
    }

    const { toast } = useToast();

    const [records, setRecords] = useState<DispatchRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [hasDefaultedPending, setHasDefaultedPending] = useState(false);
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isListLoading, setIsListLoading] = useState(true);
    const openingDispatchIdRef = useRef<number | null>(null);

    // Debounce searchTerm
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const { dispatchStatuses, isLoaded: isMasterDataLoaded } = useCommonStore(s => ({
        dispatchStatuses: s.dispatchStatuses,
        isLoaded: s.isLoaded
    }));

    const [isSaving, setIsSaving] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);

    const loadDispatches = useCallback(async () => {
        try {
            setIsListLoading(true);
            const res = await inventoryApi.getDispatchList({
                page: currentPage,
                limit: itemsPerPage,
                search: debouncedSearchTerm?.trim() || undefined,
                dispatch_date: dateFilter ? format(dateFilter, "yyyy-MM-dd") : undefined,
                status_id: statusFilter !== "all" ? statusFilter : undefined
            });

            if (res.isSuccessful) {
                setRecords(res.data.records || []);
                setTotalRecords(res.data.pagination.totalRecords || 0);
            } else {
                setRecords([]);
                setTotalRecords(0);
            }
        } catch (error) {
            console.error("Failed to load dispatches:", error);
            setRecords([]);
            setTotalRecords(0);
        } finally {
            setIsListLoading(false);
        }
    }, [currentPage, itemsPerPage, debouncedSearchTerm, dateFilter, statusFilter]);

    useEffect(() => {
        // Wait for master data to be loaded and default status to be set
        // before making the initial API call. This prevents double calls
        // and ensures the initial filter is respected.
        if (isMasterDataLoaded && hasDefaultedPending) {
            loadDispatches();
        }
    }, [loadDispatches, isMasterDataLoaded, hasDefaultedPending]);

    // Handle default status from master data (Dispatch Pending)
    useEffect(() => {
        if (!hasDefaultedPending && dispatchStatuses.length > 0) {
            const pendingStatus = dispatchStatuses.find(s => {
                const name = (s.name || s.value_name || "").toLowerCase();
                return name.includes("pending");
            });

            if (pendingStatus) {
                const pendingId = String(pendingStatus.id || pendingStatus.value_id || pendingStatus.status_id);
                setStatusFilter(pendingId);
                setHasDefaultedPending(true);
            } else {
                setHasDefaultedPending(true);
            }
        }
    }, [dispatchStatuses, hasDefaultedPending]);


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
    const [serialError, setSerialError] = useState("");
    const [scanValue, setScanValue] = useState("");
    const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
    const [dropdownItems, setDropdownItems] = useState<any[]>([]);

    const assignedWarehouseKey = getAssignedIds("warehouse").join(",");
    const orderedWarehouses = useMemo(
        () => prioritizeByAssigned(warehouses, getAssignedIds("warehouse"), (wh) => wh.id),
        [warehouses, assignedWarehouseKey]
    );

    const mapWarehouseRecords = (rawRecords: any[]) =>
        rawRecords
            .map((wh: any) => ({
                id: Number(wh.id || wh.warehouse_id || wh.value_id),
                name: wh.warehouse_name || wh.name || wh.value_name || "Unknown Warehouse",
            }))
            .filter((wh) => wh.name && Number.isFinite(wh.id));

    const applyWarehouseSelection = (
        apiWarehouseId: number | string | null | undefined,
        warehouseRecords: { id: number; name: string }[],
        edit: boolean
    ) => {
        const ordered = prioritizeByAssigned(
            warehouseRecords,
            getAssignedIds("warehouse"),
            (wh) => wh.id
        );
        setWarehouses(ordered);

        if (apiWarehouseId != null && apiWarehouseId !== "" && Number(apiWarehouseId) > 0) {
            setSelectedWarehouse(String(apiWarehouseId));
            return;
        }
        if (edit && ordered.length > 0) {
            const firstAssigned = getFirstAssignedMatch(
                getAssignedIds("warehouse"),
                ordered.map((wh) => wh.id)
            );
            if (firstAssigned) {
                setSelectedWarehouse(firstAssigned);
            }
        }
    };

    const totalPages = Math.ceil(totalRecords / itemsPerPage);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, statusFilter, dateFilter]);

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
    const handleOpenOrder = async (record: DispatchRecord, edit: boolean) => {
        if (openingDispatchIdRef.current !== null) return;
        openingDispatchIdRef.current = record.dispatch_id;
        try {
            setIsDetailLoading(true);
            setIsDialogOpen(true); // Open early to show loading state

            // 1. Fetch warehouses for the dropdown (assigned-first ordering)
            let warehouseRecords = warehouses;
            if (warehouseRecords.length === 0) {
                const whRes = await commonApi.getWarehouses();
                if (whRes.isSuccessful && whRes.data) {
                    const rawRecords = Array.isArray(whRes.data)
                        ? whRes.data
                        : whRes.data.records || [];
                    warehouseRecords = mapWarehouseRecords(rawRecords);
                }
            }

            // 2. Show the dialog immediately with basic list data to provide visual feedback
            const initialPartial: SalesOrderData = {
                id: record.dispatch_id,
                soNumber: record.so_code || "Loading...",
                soDate: record.dispatch_date || "",
                customerName: record.customer_name || "Loading...",
                contactPerson: "",
                shippingAddress: "Loading...",
                billingAddress: "",
                deliveryDate: record.delivery_date || "",
                currency: "UGX",
                remarks: "",
                terms: [],
                items: [],
                dispatches: [],
                status: "Dispatch Pending"
            };
            setSelectedOrder(initialPartial);
            setIsEditMode(edit);
            setTempDispatches([]);
            setRemarks("");
            setSelectedWarehouse("");
            setDispatchForm({
                itemCode: "",
                dispatchQty: "",
                dispatchDate: new Date(),
                note: ""
            });
            setScannedSerials([]);
            setScanValue("");
            setSerialError("");
            setIsSaving(false);

            // 2. Fetch full details from API
            const response = await inventoryApi.getDispatchById(record.dispatch_id);
            
            if (response.isSuccessful && response.data) {
                const data = response.data;
                
                // Map items
                const mappedItems = (data.dispatch_items || []).map(item => ({
                    id: item.sales_order_item_id,
                    itemCode: item.item_code || item.item_name || "N/A",
                    itemName: item.item_name,
                    uom: item.uom_name || item.uom || "-",
                    orderedQty: item.ordered_qty,
                    dispatchedQty: item.dispatched_qty,
                    rate: item.unit_price,
                    price: Number(item.unit_price) * item.ordered_qty
                }));

                // Update selectedOrder with full details from API
                setSelectedOrder(prev => prev ? ({
                    ...prev,
                    soDate: data.dispatch_date || prev.soDate,
                    deliveryDate: data.delivery_date || prev.deliveryDate,
                    shippingAddress: data.shipping_address || prev.shippingAddress,
                    remarks: data.remarks || prev.remarks,
                    items: mappedItems,
                    quotationRef: data.dispatch_code, // Hijack this for dispatch code in title
                    currencySymbol: getCurrencySymbol(data.currency_name || "USD")
                } as any) : null);

                // Initialize tempDispatches with existing items to show in the UI
                const existingTemp = (data.dispatch_items || [])
                    .filter(item => (Number(item.dispatched_qty) || 0) > 0)
                    .map(item => ({
                        id: item.dispatch_order_item_id || Math.random(),
                        itemCode: item.item_code || item.item_name || "N/A",
                        itemName: item.item_name,
                        dispatchQty: item.dispatched_qty,
                        dispatchDate: data.dispatch_date || format(new Date(), "yyyy-MM-dd"),
                        note: item.note || "",
                        serialNumbers: item.serial_numbers || []
                    }));
                setTempDispatches(existingTemp);

                // Update separate states
                setRemarks(data.remarks || "");
                applyWarehouseSelection(data.warehouse_id, warehouseRecords, edit);
                
                // 3. Fetch specific sales order items for the dropdown (only in EDIT mode)
                if (edit && data.sales_order_id) {
                    try {
                        const itemsRes = await commonApi.getSalesOrderItems(data.sales_order_id);
                        if (itemsRes.isSuccessful && itemsRes.data?.records) {
                            setDropdownItems(itemsRes.data.records);
                        }
                    } catch (error) {
                        console.error('[DISPATCH ERROR] Failed to fetch SO items:', error);
                    }
                }
                
                // Also update the dispatchForm date to match the record's date
                if (data.dispatch_date) {
                    setDispatchForm(prev => ({
                        ...prev,
                        dispatchDate: new Date(data.dispatch_date)
                    }));
                }
            } else {
                toast({
                    title: "Fetch Failed",
                    description: response.message || "Could not load dispatch details.",
                    variant: "destructive",
                    duration: 15000
                });
            }
        } catch (error) {
            console.error('[DISPATCH ERROR] Failed to fetch dispatch by ID:', error);
            toast({
                title: "Error",
                description: "An unexpected error occurred while loading details.",
                variant: "destructive",
                duration: 15000
            });
        } finally {
            setIsDetailLoading(false);
            openingDispatchIdRef.current = null;
        }
    };

    const handleDialogOpenChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setIsDetailLoading(false);
            openingDispatchIdRef.current = null;
        }
    };

    const handleAddDispatch = () => {
        if (!dispatchForm.itemCode || !dispatchForm.dispatchQty) {
            toast({ 
                title: "Please Check", 
                description: "Please fill all required fields.", 
                variant: "destructive",
                duration: 15000
            });
            return;
        }

        const qty = parseFloat(dispatchForm.dispatchQty);
        if (isNaN(qty) || qty <= 0) {
            toast({ 
                title: "Please Check", 
                description: "Invalid quantity.", 
                variant: "destructive",
                duration: 15000
            });
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
            toast({ 
                title: "Please Check", 
                description: "Total dispatch quantity cannot exceed ordered quantity.", 
                variant: "destructive",
                duration: 15000
            });
            return;
        }
        
        // NEW: Validation for serial number count vs dispatch quantity
        if (scannedSerials.length > qty) {
            setSerialError("Serial number count cannot exceed dispatch quantity");
            toast({
                title: "Validation Error",
                description: `You have scanned ${scannedSerials.length} serial numbers, but dispatch quantity is only ${qty}.`,
                variant: "destructive",
                duration: 5000
            });
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
        setSerialError("");
    };

    const handleRemoveDispatch = (id: number) => {
        setTempDispatches(prev => prev.filter(d => d.id !== id));
    };

    const handleSaveDispatch = async () => {
        if (!selectedOrder) return;
        if (!selectedWarehouse) {
            toast({ 
                title: "Required", 
                description: "Please select a warehouse.", 
                variant: "destructive",
                duration: 15000
            });
            return;
        }

        setIsSaving(true);
        try {
            // Map items to add
            const itemsToAdd = tempDispatches.map(entry => {
                // Find the original item to get sales_order_item_id
                const originalItem = selectedOrder.items.find(i => {
                    const itemIdentifier = (i.itemCode && i.itemCode.trim() !== "") ? i.itemCode : i.itemName;
                    return itemIdentifier === entry.itemCode;
                });

                return {
                    sales_order_item_id: originalItem?.id || 0,
                    dispatch_qty: entry.dispatchQty,
                    note: entry.note || "",
                    serial_numbers: entry.serialNumbers || []
                };
            });

            const payload = {
                warehouse_id: Number(selectedWarehouse),
                remarks: remarks || "",
                items: itemsToAdd
            };

            const res = await inventoryApi.updateDispatch(selectedOrder.id, payload);

            if (res.isSuccessful) {
                toast({ 
                    title: "Success", 
                    description: res.message || "Dispatch updated successfully.",
                    variant: "success",
                    duration: 15000
                });
                setIsDialogOpen(false);
                loadDispatches(); // Refresh the list
            } else {
                toast({ 
                    title: "Validation Error", 
                    description: res.message || "Failed to update dispatch.", 
                    variant: "destructive",
                    duration: 15000
                });
            }
        } catch (error: any) {
            console.error('[DISPATCH ERROR] Save failed:', error);
            toast({ 
                title: "Error", 
                description: error.message || "An unexpected error occurred while saving.", 
                variant: "destructive",
                duration: 15000
            });
        } finally {
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
                                <h2>DISPATCH CODE NOTE</h2>
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
                                <div class="info-item"><strong>SO Code</strong><span>${selectedOrder.soNumber}</span></div>
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
            </div>

            <div className="flex flex-col gap-6">
                <AppListToolbar
                    search={{
                        value: searchTerm,
                        onChange: setSearchTerm,
                        placeholder: "Search by SO Code or Customer..."
                    }}
                    filters={[
                        {
                            type: 'select',
                            label: 'Status',
                            value: statusFilter,
                            options: [
                                { label: "All Statuses", value: "all" },
                                ...dispatchStatuses.map(s => ({
                                    label: s.name,
                                    value: String(s.id)
                                }))
                            ],
                            onChange: (val) => {
                                setStatusFilter(val);
                                setCurrentPage(1);
                            },
                            searchable: true
                        },
                        {
                            type: 'date',
                            label: 'Date',
                            value: dateFilter,
                            onChange: setDateFilter,
                            showClear: !!dateFilter
                        }
                    ]}
                />

                <Card>
                    <CardContent className="pt-6">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4 pl-6">Dispatch Code</TableHead>
                                        <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4">Dispatch Date</TableHead>
                                        <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4">SO Code</TableHead>
                                        <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4">Customer Name</TableHead>
                                        <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4">Delivery Date</TableHead>
                                        <TableHead className="font-bold uppercase text-[11px] tracking-wider py-4 text-center">Status</TableHead>
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
                                    ) : records.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                                No Dispatch records found matching your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        records.map((record) => (
                                            <TableRow key={record.dispatch_id} className="hover:bg-muted/30 transition-colors border-b text-[13px]">
                                                <TableCell className="py-4 pl-6 font-medium text-xs text-primary">
                                                    {record.dispatch_code || "N/A"}
                                                </TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                    {record.dispatch_date ? format(new Date(record.dispatch_date), "dd-MM-yyyy") : "-"}
                                                </TableCell>
                                                <TableCell className="py-4 text-sm font-bold text-primary">{record.so_code}</TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">{record.customer_name}</TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                    {record.delivery_date ? format(new Date(record.delivery_date), "dd-MM-yyyy") : "-"}
                                                </TableCell>
                                                <TableCell className="py-4 text-center">
                                                    {getDispatchStatusBadge(record.status_name)}
                                                </TableCell>
                                                <TableCell className="py-4 text-center">
                                                     <TableActionButtons
                                                        onView={canView(permissionModule) ? () => { void handleOpenOrder(record, false); } : undefined}
                                                        onEdit={(canEdit(permissionModule) && record.status_name !== "Dispatched") ? () => { void handleOpenOrder(record, true); } : undefined}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
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
            </div>

            {/* Config Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent 
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader className="border-b bg-white p-4 sm:p-6">
                        <div className="flex items-center gap-3 mb-1">
                            <Settings2 className="h-5 w-5 text-primary" />
                            <DialogTitle className="text-2xl font-bold">
                                {isEditMode ? "Configure Dispatch:" : "View Dispatch:"} {selectedOrder?.quotationRef || selectedOrder?.soNumber}
                            </DialogTitle>
                        </div>
                        <DialogDescription>
                            Review Sales Order details and record dispatched item quantities.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 relative flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 space-y-6">
                        {isDetailLoading && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading dispatch details...</p>
                            </div>
                        )}
                        {/* Form Fields */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide">Dispatch Date</Label>
                                <Input 
                                    value={selectedOrder?.soDate ? (selectedOrder.soDate.includes('-') ? format(new Date(selectedOrder.soDate), "dd-MM-yyyy") : selectedOrder.soDate) : "N/A"} 
                                    readOnly 
                                    className="h-9 bg-muted/50" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide">SO Code</Label>
                                <Input value={selectedOrder?.soNumber || ""} readOnly className="h-9 bg-muted/50" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide">Customer Name</Label>
                                <Input value={selectedOrder?.customerName || ""} readOnly className="h-9 bg-muted/50" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wide">Delivery Date</Label>
                                <Input value={selectedOrder?.deliveryDate ? (selectedOrder.deliveryDate.includes('-') ? format(new Date(selectedOrder.deliveryDate), "dd-MM-yyyy") : selectedOrder.deliveryDate) : "N/A"} readOnly className="h-9 bg-muted/50" />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <Label className="text-xs font-bold uppercase tracking-wide">Shipping Address</Label>
                                <Input value={selectedOrder?.shippingAddress || ""} readOnly className="h-9 bg-muted/50" />
                            </div>
                            <div className="space-y-1.5">
                                <SharedSearchableSelect
                                    label="Warehouse"
                                    value={selectedWarehouse}
                                    onChange={setSelectedWarehouse}
                                    options={orderedWarehouses.map(wh => ({
                                        label: wh.name,
                                        value: String(wh.id)
                                    }))}
                                    placeholder="Select Warehouse"
                                    disabled={!isEditMode}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                                <Label className="text-xs font-bold uppercase tracking-wide">Remarks</Label>
                                <Textarea
                                    value={remarks}
                                    onChange={(e) => {
                                        if (e.target.value.length <= 200) {
                                            setRemarks(e.target.value);
                                        }
                                    }}
                                    maxLength={200}
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
                                    <Table className="table-fixed">
                                        <colgroup>
                                            <col className="w-[52%]" />
                                            <col className="w-[10%]" />
                                            <col className="w-[16%]" />
                                            <col className="w-[11%]" />
                                            <col className="w-[11%]" />
                                        </colgroup>
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
                                            {isDetailLoading ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-40 text-center">
                                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                                                            <span className="text-xs font-medium">Loading dispatch details...</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : selectedOrder?.items.map((item) => {
                                                // FIXED: Match dispatches by itemCode OR itemName
                                                const itemIdentifier = (item.itemCode && item.itemCode.trim() !== "") ? item.itemCode : item.itemName;

                                                const totalDispatched = tempDispatches
                                                    .filter(d => {
                                                        const dispatchIdentifier = (d.itemCode && d.itemCode.trim() !== "") ? d.itemCode : d.itemName;
                                                        return dispatchIdentifier === itemIdentifier;
                                                    })
                                                    .reduce((sum, d) => sum + d.dispatchQty, 0);

                                                return (
                                                    <TableRow key={item.id} className="hover:bg-muted/20 transition-colors align-top">
                                                        <TableCell className="py-3 pl-4">
                                                            <div className="space-y-0.5">
                                                                <div className="font-medium text-sm text-slate-900 whitespace-normal wrap-break-word">
                                                                    {item.itemName}
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground/70 font-mono whitespace-normal wrap-break-word">
                                                                    {item.itemCode}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-3 text-[10px] text-muted-foreground uppercase font-bold align-top">{item.uom}</TableCell>
                                                        <TableCell className="py-3 text-slate-900 font-medium tabular-nums align-top">
                                                            {(selectedOrder as any)?.currencySymbol || "$"}{item.rate || 0}/{item.uom}
                                                        </TableCell>
                                                        <TableCell className="py-3 text-right text-primary font-bold tabular-nums align-top">{item.orderedQty}</TableCell>
                                                        <TableCell className="py-3 text-right text-blue-600 font-bold pr-4 tabular-nums align-top">
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
                                        <div className="grid grid-cols-1 gap-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-inner md:grid-cols-12 md:gap-6">
                                            <div className="md:col-span-6">
                                                <SharedSearchableSelect
                                                    label="Item Selection"
                                                    value={dispatchForm.itemCode}
                                                    onChange={(v) => setDispatchForm(prev => ({ ...prev, itemCode: v }))}
                                                    options={dropdownItems.map(item => {
                                                        const itemValue = item.item_code || item.item_name;
                                                        
                                                        // Calculate total quantity already added in tempDispatches (unsaved entries)
                                                        const tempDispatchedQty = tempDispatches
                                                            .filter(d => d.itemCode === itemValue)
                                                            .reduce((sum, d) => sum + Number(d.dispatchQty || 0), 0);
                                                        
                                                        // Frontend pending = Original remaining - frontend additions
                                                        const currentPending = Math.max(0, Number(item.remaining_qty || 0) - tempDispatchedQty);
                                                        
                                                        const itemName = String(item.item_name || "").trim() || String(itemValue || "").trim();
                                                        const itemCode = String(item.item_code || "").trim();
                                                        const secondary = `${itemCode ? `${itemCode} • ` : ""}Pending: ${currentPending}`;
                                                        
                                                        return { 
                                                            label: `${itemCode ? `${itemCode} - ` : ""}${itemName} (Pending: ${currentPending})`,
                                                            primaryText: itemName,
                                                            secondaryText: secondary,
                                                            value: itemValue,
                                                            disabled: currentPending <= 0 
                                                        };
                                                    })}
                                                    placeholder="Select Item"
                                                    className="h-auto min-h-[52px] items-start! py-0.5 bg-white border-slate-200"
                                                    listClassName="max-h-[min(320px,calc(var(--radix-popover-content-available-height)-2.5rem))]"
                                                    selectedPrimaryLineClamp={2}
                                                    compactStackedSelected
                                                />
                                            </div>

                                            <div className="md:col-span-2">
                                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Dispatch Qty <span className="text-red-500">*</span></Label>
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    className="h-10 bg-white border-slate-200"
                                                    value={dispatchForm.dispatchQty}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        // Allow only numbers and one decimal point, max 6 digits total
                                                        if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 6)) {
                                                            setDispatchForm(prev => ({ ...prev, dispatchQty: val }));
                                                        }
                                                    }}
                                                />
                                            </div>

                                            <div className="md:col-span-4">
                                                <Label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wide">Note</Label>
                                                <Input
                                                    className="h-10 bg-white border-slate-200"
                                                    value={dispatchForm.note}
                                                    onChange={(e) => {
                                                        if (e.target.value.length <= 200) {
                                                            setDispatchForm(prev => ({ ...prev, note: e.target.value }));
                                                        }
                                                    }}
                                                    maxLength={200}
                                                    placeholder="Reason for dispatch..."
                                                />
                                            </div>

                                            {/* QR Scanning Section */}
                                            <div className="col-span-12 grid grid-cols-12 gap-6 pt-2 border-t border-slate-200 mt-2">
                                                <div className="col-span-5">
                                                    <Label className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide flex items-center gap-2">
                                                        Scan QR Code <span className="text-[10px] lowercase font-normal text-muted-foreground">(Optional)</span>
                                                    </Label>
                                                    <div className="relative">
                                                        <Input
                                                            placeholder="Scan or type serial number..."
                                                            className="h-10 pr-20 bg-white border-slate-300 focus:border-primary shadow-sm"
                                                            value={scanValue}
                                                            onChange={(e) => {
                                                                setScanValue(e.target.value);
                                                                if (serialError) setSerialError("");
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter" && scanValue.trim()) {
                                                                    e.preventDefault();
                                                                    
                                                                    const maxAllowed = Number(dispatchForm.dispatchQty) || 0;
                                                                    
                                                                    if (maxAllowed <= 0) {
                                                                        setSerialError("Please enter dispatch quantity first");
                                                                        return;
                                                                    }
                                                                    if (scannedSerials.includes(scanValue.trim())) {
                                                                        toast({ 
                                                                            title: "Duplicate Serial", 
                                                                            description: "This serial number has already been scanned.", 
                                                                            variant: "destructive",
                                                                            duration: 3000
                                                                        });
                                                                        return;
                                                                    }

                                                                    if (scannedSerials.length >= maxAllowed) {
                                                                        setSerialError("Serial number count cannot exceed dispatch quantity");
                                                                        toast({
                                                                            title: "Limit Reached",
                                                                            description: `You have already scanned ${maxAllowed} serial numbers for this item.`,
                                                                            variant: "destructive",
                                                                            duration: 3000
                                                                        });
                                                                        return;
                                                                    }

                                                                    setScannedSerials(prev => [...prev, scanValue.trim()]);
                                                                    setScanValue("");
                                                                    setSerialError("");
                                                                }
                                                            }}
                                                        />
                                                        {serialError && (
                                                            <p className="text-[10px] text-red-500 mt-1 font-medium animate-in fade-in slide-in-from-top-1">
                                                                {serialError}
                                                            </p>
                                                        )}
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
                                                                onClick={() => {
                                                                    setScannedSerials([]);
                                                                    setSerialError("");
                                                                }}
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
                                        <Table className="table-fixed">
                                            <colgroup>
                                                <col className="w-[44%]" />
                                                <col className="w-[14%]" />
                                                <col className="w-[32%]" />
                                                {isEditMode && <col className="w-[10%]" />}
                                            </colgroup>
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
                                                        <TableRow key={entry.id} className="hover:bg-muted/10 transition-colors border-slate-50 align-top">
                                                            <TableCell className="py-3 pl-4">
                                                                <div className="space-y-0.5">
                                                                    <div className="font-medium text-sm text-slate-900 whitespace-normal wrap-break-word">
                                                                        {entry.itemName}
                                                                    </div>
                                                                    <div className="text-[10px] text-muted-foreground/70 font-mono whitespace-normal wrap-break-word">
                                                                        {entry.itemCode}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-3 text-center align-top">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="text-blue-600 font-bold">{entry.dispatchQty}</span>
                                                                    {entry.serialNumbers && entry.serialNumbers.length > 0 && (
                                                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal border-blue-200 text-blue-600 bg-blue-50/50">
                                                                            {entry.serialNumbers.length} CODES
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-3 text-sm text-slate-500 whitespace-normal wrap-break-word align-top">{entry.note || "-"}</TableCell>
                                                            {isEditMode && (
                                                                <TableCell className="py-3 text-center align-top">
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

                    <DialogFooter className="border-t bg-white p-4 sm:p-6 mt-auto gap-2 sm:flex-row sm:items-center sm:justify-end rounded-b-xl">
                        {!isEditMode && selectedOrder?.status === "Dispatched" && (
                            <Button onClick={handlePrintDispatch} className="sm:mr-auto px-6 h-11 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200">
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
                                loading={isSaving}
                                disabled={isSaving || isDetailLoading}
                            >
                                <Check className="mr-2 h-4 w-4" />
                                Save Dispatch
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
