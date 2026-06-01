// ============================================================================
// SALES ORDER COMPONENT
// Cloned from Purchase Order implementation (OrderExecution.tsx)
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { generateQuotationPDFHTML } from "@/lib/quotationPDFTemplate";
import { generateInvoicePDFHTML, type InvoicePDFData } from "@/lib/invoicePDFTemplate";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Trash2,
    Plus,
    X,
    Download,
    Check,
    Printer,
    ChevronsUpDown,
    Loader2
} from "lucide-react";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
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
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { mockWarehouses, mockLocations } from "@/lib/masterMockData";
import { commonApi, salesOrdersApi, salesApi, invoicingApi, inventoryApi, parseSkuDropdownRecords, type SkuDropdownRecord } from "@/lib/api";
import { getBomMockSkusForItem, mergeSkuDropdownWithMock } from "@/lib/bomSkuMockData";
import { useCommonStore } from "@/store/commonStore";
// Updated: Import mock sales order service
import {
    changeSOStatus,
    closeSalesOrder,
    type SOData as MockSOData,
    type SOItem as MockSOItem,
    type PaymentTerm as MockPaymentTerm,
    type SOStatus as MockSOStatus
} from "@/lib/mockSalesOrders";
import type { QuotationData } from "@/lib/mockQuotations";
import { createInvoiceFromSO, getInvoices, type InvoiceData } from "@/lib/mockInvoices";
import { allMockMaterials, mockFinishedGoods } from "@/lib/masterMockData";
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

type FormCustomer = {
    customer_id: number;
    customer_name: string;
    contact_person_name?: string;
    mobile_no?: string;
    shipping_address?: string;
    billing_address?: string;
};

type QuotationReference = {
    id: number;
    quotationNo: string;
    customerName: string;
    statusName?: string;
    rawData?: any;
};

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

const formatSoItemSkuLabel = (item: {
    skuCode?: string;
    skuName?: string;
    itemCode?: string;
}): string => {
    if (item.skuCode) {
        return item.skuName ? `${item.skuCode} — ${item.skuName}` : item.skuCode;
    }
    if (item.skuName) return item.skuName;
    const mock = getBomMockSkusForItem(item.itemCode)[0];
    if (mock) return mock.name ? `${mock.code} — ${mock.name}` : mock.code;
    return "—";
};

const mapApiSOItemToForm = (apiItem: Record<string, unknown>, index: number): SOItem => ({
    id: Number(apiItem.id ?? Date.now() + index),
    itemCode: String(
        apiItem.item_id ?? apiItem.itemCode ?? (apiItem.item as any)?.id ?? ""
    ),
    itemName: String(
        apiItem.item_name ??
            (apiItem.item as any)?.name ??
            apiItem.itemName ??
            ""
    ),
    uom: String(apiItem.uom_name ?? apiItem.uom ?? (apiItem.item as any)?.uom ?? "PCS"),
    orderedQty: Number(apiItem.quantity ?? apiItem.quantity_ordered ?? 0),
    dispatchedQty: Number(
        apiItem.dispatch_qty ?? apiItem.dispatched_qty ?? apiItem.dispatchedQty ?? 0
    ),
    rate: Number(
        apiItem.unit_price ?? apiItem.price_per_item ?? apiItem.rate ?? apiItem.price ?? 0
    ),
    price:
        Number(apiItem.price ?? apiItem.amount ?? apiItem.price_per_item ?? 0) ||
        Number(apiItem.quantity ?? apiItem.quantity_ordered ?? 0) *
            Number(apiItem.unit_price ?? apiItem.rate ?? 0),
    skuId:
        apiItem.sku_id != null
            ? Number(apiItem.sku_id)
            : apiItem.skuId != null
              ? Number(apiItem.skuId)
              : undefined,
    skuCode: String(apiItem.sku_code ?? apiItem.skuCode ?? ""),
    skuName: String(apiItem.sku_name ?? apiItem.skuName ?? ""),
});

const buildSOApiItemPayload = (
    item: SOItem,
    formItems: { id: number; itemCode: string; name: string }[]
) => {
    const item_id =
        Number(item.itemCode) ||
        formItems.find((f) => f.name === item.itemName)?.id ||
        0;
    const payload: Record<string, number> = {
        item_id,
        quantity: Number(item.orderedQty || 0),
        unit_price: Number(item.rate || 0),
    };
    if (item.skuId != null && item.skuId !== "" && Number.isFinite(Number(item.skuId))) {
        payload.sku_id = Number(item.skuId);
    }
    return payload;
};

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

const normalizeText = (value: any): string => String(value ?? "").trim().toUpperCase().replace(/[\s_-]/g, "");

const normalizeSOStatus = (value: any): SOStatus => {
    const status = normalizeText(value);
    if (status === "DRAFT") return "Draft";
    if (status === "INVOICED") return "Invoiced" as any;
    if (status.includes("INVOICE") && status.includes("PENDING")) return "Invoice Pending";
    if (status.includes("DISPATCH") && status.includes("PENDING")) return "Dispatch Pending";
    if (status === "DISPATCHED") return "Dispatched";
    if (status.includes("CLOSED") || status.includes("CLOSE")) return "Close";
    return "Draft";
};

const extractCustomerRawRecords = (response: any): any[] => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.records)) return response.records;
    if (Array.isArray(response.customers)) return response.customers;
    if (response.data) {
        if (Array.isArray(response.data)) return response.data;
        if (Array.isArray(response.data.records)) return response.data.records;
        if (Array.isArray(response.data.customers)) return response.data.customers;
    }
    return [];
};

const normalizeCustomerRecord = (raw: any): FormCustomer | null => {
    if (!raw) return null;
    const base = raw.customer && typeof raw.customer === "object" ? raw.customer : raw;
    const customer_id = Number(base.customer_id ?? raw.customer_id);
    const customer_name = String(base.customer_name ?? raw.customer_name ?? "").trim();
    if (!customer_id || !customer_name) return null;
    return {
        customer_id,
        customer_name,
        contact_person_name: raw.contact_person_name ?? base.contact_person_name ?? "",
        mobile_no: raw.mobile_no ?? base.mobile_no ?? "",
        shipping_address: raw.shipping_address ?? base.shipping_address ?? "",
        billing_address: raw.billing_address ?? base.billing_address ?? "",
    };
};

const getEntityId = (item: any): number | undefined => {
    const id = item?.id ?? item?.value_id ?? item?.status_id;
    return id != null ? Number(id) : undefined;
};

const findByCodePriority = (records: any[], candidateCodes: string[], fallbackLabel?: string): any | undefined => {
    const normalizedCandidates = candidateCodes.map(normalizeText).filter(Boolean);
    const normalizedFallback = normalizeText(fallbackLabel);

    const byCode = records.find((record: any) => {
        const code = normalizeText(record?.code || record?.entity_value || record?.value_code);
        return code && normalizedCandidates.includes(code);
    });
    if (byCode) return byCode;

    return records.find((record: any) => normalizeText(record?.name || record?.value_name) === normalizedFallback);
};

const getPercentOrAmountCodes = (value: string): string[] => {
    return value === "%"
        ? ["%", "PERCENT", "PERCENTAGE", "PERCENTAGEVALUE"]
        : ["AMOUNT", "FIXED", "VALUE"];
};

const getPaymentTermCodes = (term: string): string[] => {
    if (term === "Advance") return ["ADVANCE"];
    if (term === "Delivery") return ["DELIVERY"];
    return ["DAY", "DAYS"];
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
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const currentDate = new Date(year, month - 1, prevMonthLastDay - i);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            days.push({
                date: currentDate,
                isCurrentMonth: false,
                isDisabled: currentDate < today
            });
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
            <PopoverContent className="w-auto p-4 shadow-lg border rounded-lg z-9999" align="start" side="bottom" sideOffset={4}>
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
const getSOStatusBadge = (status: string) => {
    switch (status) {
        case "Draft":
            return <Badge variant="outline">Draft</Badge>;
        case "Invoiced":
            return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">Invoiced</Badge>;
        case "Invoice Pending":
            return <Badge variant="default">Invoice Pending</Badge>;
        case "Dispatch Pending":
            return <Badge variant="secondary">Dispatch Pending</Badge>;
        case "Dispatched":
            return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Dispatched</Badge>;
        case "Close":
            return <Badge variant="outline" className="bg-slate-100">Close</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
};

// ============================================================================
// MAIN SALES ORDER COMPONENT
// ============================================================================

const SalesOrder = () => {
    const { canCreate, canEdit, canDelete, canView, canPrint } = useHasPermission();
    const MODULE_KEY = "SALES/SALES_ORDER";

    if (!canView(MODULE_KEY)) {
        return <Unauthorized />;
    }

    const { toast } = useToast();
    const salesOrderStatuses = useCommonStore((state) => state.salesOrderStatuses);
    const currencies = useCommonStore((state) => state.currencies);
    const paymentTermTypes = useCommonStore((state) => state.paymentTermTypes);
    const paymentTaxTypes = useCommonStore((state) => state.paymentTaxTypes);
    const paymentDiscountTypes = useCommonStore((state) => state.paymentDiscountTypes);
    const itemTypes = useCommonStore((state) => state.itemTypes) || [];

    // State management - removed localStorage - using mock store
    const [salesOrders, setSalesOrders] = useState<SOData[]>([]);
    const [quotationRefs, setQuotationRefs] = useState<QuotationReference[]>([]);
    const [formCustomers, setFormCustomers] = useState<FormCustomer[]>([]);
    const [formItems, setFormItems] = useState<any[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);

    // Filters - cloned from PO implementation
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [hasDefaultedDraft, setHasDefaultedDraft] = useState(false);

    useEffect(() => {
        if (!hasDefaultedDraft && salesOrderStatuses?.length > 0) {
            const draftStatus = salesOrderStatuses.find((s: any) =>
                normalizeText(s?.name || s?.value_name) === "DRAFT"
            );
            if (draftStatus) {
                const draftId = String(draftStatus.id || draftStatus.value_id || draftStatus.status_id);
                setFilterStatus(draftId);
                setHasDefaultedDraft(true);
            } else {
                setHasDefaultedDraft(true);
            }
        }
    }, [salesOrderStatuses, hasDefaultedDraft]);

    // Pagination - using DataTablePagination with options [10, 15, 30, 50]

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Dialog states
    const [isSODialogOpen, setIsSODialogOpen] = useState(false);
    const [activeSO, setActiveSO] = useState<SOData | null>(null);
    const [originalSO, setOriginalSO] = useState<SOData | null>(null);
    const [skuOptionsByRow, setSkuOptionsByRow] = useState<Record<number, SkuDropdownRecord[]>>({});
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

    // Global loading state for async operations (e.g., fetching invoices for PDF)
    const [isLoading, setIsLoading] = useState(false);
    const [isListLoading, setIsListLoading] = useState(true);
    const [isFormOpening, setIsFormOpening] = useState(false);
    const [isSavingSO, setIsSavingSO] = useState(false);
    const [isSubmittingSO, setIsSubmittingSO] = useState(false);
    const [openingSOId, setOpeningSOId] = useState<number | null>(null);

    // Form states for SO modal
    const [selectedQuotation, setSelectedQuotation] = useState<string>("");
    const [selectedCustomer, setSelectedCustomer] = useState<string>("");
    const [isManualEntry, setIsManualEntry] = useState(false);
    const lastQuotationCustomerIdRef = React.useRef<number | null>(null);

    // Reset lastLoadedCustomerId when dialog closes
    useEffect(() => {
        if (!isSODialogOpen) {
            lastQuotationCustomerIdRef.current = null;
            setSkuOptionsByRow({});
        }
    }, [isSODialogOpen]);

    const loadSkuOptionsForRow = useCallback(
        async (rowId: number, itemId: number, itemCode?: string) => {
            try {
                const res = await commonApi.getSkuDropdown({ item_id: itemId });
                const records =
                    res.isSuccessful && res.data != null
                        ? parseSkuDropdownRecords(res.data)
                        : [];
                const options = mergeSkuDropdownWithMock(records, itemCode);
                setSkuOptionsByRow((prev) => ({ ...prev, [rowId]: options }));
                return options;
            } catch {
                const options = mergeSkuDropdownWithMock([], itemCode);
                setSkuOptionsByRow((prev) => ({ ...prev, [rowId]: options }));
                return options;
            }
        },
        []
    );

    // Helper to check if form is valid for submission/saving
    const isFormValid = () => {
        if (!activeSO) return false;

        const hasBasicFields = !!(
            activeSO.customerName?.trim() &&
            activeSO.billingAddress?.trim() &&
            activeSO.mobileNo?.trim() &&
            activeSO.deliveryDate &&
            (activeSO.items || []).length > 0 &&
            (activeSO.terms || []).length > 0
        );

        if (!hasBasicFields) return false;

        // Validation for Payment Terms
        const hasInvalidTerms = (activeSO.terms || []).some(term => {
            if (term.termType === "Days") {
                const days = parseInt(String(term.days || "0"));
                return isNaN(days) || days <= 0;
            }
            return false;
        });

        if (hasInvalidTerms) return false;

        // Validation for Items
        const itemNames = (activeSO.items || []).map(i => i.itemName).filter(Boolean);
        const hasDuplicates = new Set(itemNames).size !== itemNames.length;
        if (hasDuplicates) return false;

        const hasInvalidItems = (activeSO.items || []).some(item => {
            const qty = parseFloat(item.orderedQty?.toString() || "0");
            const rate = parseFloat(item.rate?.toString() || "0");
            const hasSku =
                item.skuId != null &&
                item.skuId !== "" &&
                Number.isFinite(Number(item.skuId));
            return (
                !item.itemName ||
                !hasSku ||
                isNaN(qty) ||
                qty <= 0 ||
                isNaN(rate) ||
                rate <= 0
            );
        });

        return !hasInvalidItems;
    };

    const fetchSalesOrdersList = async () => {
        setIsListLoading(true);
        try {
            const res = await salesOrdersApi.getSOList({
                search: debouncedSearchTerm?.trim() || undefined,
                date: filterDate ? format(filterDate, "yyyy-MM-dd") : undefined,
                status_id: filterStatus !== "all" ? Number(filterStatus) : undefined,
                page: currentPage,
                limit: itemsPerPage,
            });

            if (!res?.isSuccessful) {
                setSalesOrders([]);
                setTotalRecords(0);
                return;
            }

            const records = res?.data?.records || [];
            const mapped: SOData[] = records.map((record: any) => ({
                id: Number(record.id),
                soNumber: record.sales_order_code || `SO-${record.id}`,
                soDate: record.order_date || "",
                quotationRef: "",
                customerName: record.customer_name || "",
                contactPerson: "",
                mobileNo: "",
                shippingAddress: "",
                billingAddress: "",
                deliveryDate: "",
                location: "",
                warehouse: "",
                currency: "UGX",
                remarks: "",
                terms: [],
                items: [],
                dispatches: [],
                discountValue: 0,
                discountType: "%",
                taxValue: 0,
                taxType: "%",
                taxPercentage: 0,
                status: normalizeSOStatus(record.status_name),
            }));

            const pagination = res?.data?.pagination || {};
            const total = Number(pagination.totalRecords ?? pagination.totalCount ?? mapped.length ?? 0);
            setSalesOrders(mapped);
            setTotalRecords(total);
        } catch (error) {
            console.error("Error fetching sales order list:", error);
            setSalesOrders([]);
            setTotalRecords(0);
        } finally {
            setIsListLoading(false);
        }
    };

    const loadFormCustomers = async () => {
        try {
            const res = await commonApi.getCustomerWithDetails();
            if (!res?.isSuccessful) return;
            const rawRecords = extractCustomerRawRecords(res?.data);
            const normalized = rawRecords
                .map(normalizeCustomerRecord)
                .filter((customer): customer is FormCustomer => Boolean(customer));
            const deduped = Array.from(new Map(normalized.map((c) => [c.customer_id, c])).values());
            setFormCustomers(deduped);
        } catch (error) {
            console.error("Error loading customers:", error);
        }
    };

    const loadFormItems = async () => {
        try {
            const finishedGoodsItemType = (itemTypes || []).find((type: any) => {
                const code = normalizeText(type?.code || type?.value_code || "");
                const name = normalizeText(type?.name || type?.value_name || "");
                return code === "FG" || name === "FINISHEDGOODS";
            });
            const finishedGoodsItemTypeId = finishedGoodsItemType ? (finishedGoodsItemType.id || finishedGoodsItemType.value_id || finishedGoodsItemType.status_id) : undefined;
            if (!finishedGoodsItemTypeId) return;

            const res = await commonApi.getItemsDropdown({ item_type_id: finishedGoodsItemTypeId, status: 1 });
            if (!res?.isSuccessful) return;

            const extractItems = (response: any): any[] => {
                if (!response) return [];
                if (Array.isArray(response)) return response;
                if (Array.isArray(response?.records)) return response.records;
                if (Array.isArray(response?.items)) return response.items;
                if (Array.isArray(response?.data)) return response.data;
                if (Array.isArray(response?.data?.records)) return response.data.records;
                if (Array.isArray(response?.data?.items)) return response.data.items;
                return [];
            };

            const rawRecords = extractItems(res?.data);
            const mappedItems = rawRecords.map((raw: any) => {
                const base = raw.item && typeof raw.item === "object" ? raw.item : raw;
                const item_id = Number(base.item_id ?? raw.item_id ?? base.id ?? raw.id);
                const item_name = String(base.item_name ?? raw.item_name ?? base.name ?? raw.name ?? base.item_code ?? raw.item_code ?? "").trim();
                const item_code = String(base.item_code ?? raw.item_code ?? base.code ?? raw.code ?? "").trim();
                return {
                    id: item_id,
                    itemCode: item_code || String(item_id),
                    name: item_name,
                    uom: String(
                        base.uom_name ?? raw.uom_name ?? base.uom ?? raw.uom ?? "PCS"
                    ).trim() || "PCS",
                    rate: Number(base.rate || base.price || 100)
                };
            }).filter(i => i.id && i.name);

            // Deduplicate
            const deduped = Array.from(new Map(mappedItems.map(i => [i.id, i])).values());
            setFormItems(deduped);
        } catch (error) {
            console.error("Error loading finished goods items:", error);
        }
    };

    const loadQuotationReferences = async (customerId?: number, customerName?: string) => {
        try {
            if (!customerId) {
                setQuotationRefs([]);
                lastQuotationCustomerIdRef.current = null;
                return;
            }

            // Prevent duplicate calls for the same customer while the dialog is open
            if (customerId === lastQuotationCustomerIdRef.current) {
                console.log("Quotation references already loaded or loading for customerId:", customerId);
                return;
            }
            
            lastQuotationCustomerIdRef.current = customerId;
            console.log("Loading quotation references for customerId:", customerId, "Type:", typeof customerId);
            const res = await commonApi.getQuotationWithDetails({ customer_id: Number(customerId) });
            console.log("Quotation references response:", res);
            if (!res) return;

            const extractRecords = (response: any): any[] => {
                if (!response) return [];
                
                // If it's directly an array
                if (Array.isArray(response)) return response;
                
                // Check records in response or response.data
                if (Array.isArray(response?.records)) return response.records;
                if (Array.isArray(response?.data?.records)) return response.data.records;
                
                // Check data as an array
                if (Array.isArray(response?.data)) return response.data;
                
                // Check for common single object patterns
                const data = response.data || response;
                
                // If data has a quotation object
                if (data?.quotation && typeof data.quotation === 'object') {
                    return [{ 
                        ...data.quotation, 
                        _items: data.items || data.quotation.items, 
                        _terms: data.terms || data.payment_terms || data.quotation.terms 
                    }];
                }
                
                // If the response object itself looks like a quotation record
                if (data?.quotation_id || data?.id || data?.quotation_code) {
                    return [{
                        ...data,
                        _items: data.items || data.quotation?.items,
                        _terms: data.terms || data.payment_terms || data.quotation?.terms
                    }];
                }

                return [];
            };

            const records = extractRecords(res);
            const mapped: QuotationReference[] = records.map((record: any) => {
                // Handle nested quotation object if present in the record
                const q = record.quotation || record;
                return {
                    id: Number(q.id || q.quotation_id || record.id || record.quotation_id),
                    quotationNo: String(q.quotation_code || q.code || record.quotation_code || record.code || "").trim(),
                    customerName: String(q.customer_name || q.customer?.name || record.customer_name || record.customer?.name || customerName || selectedCustomer || "").trim(),
                    statusName: q.status_name || q.status || record.status_name || record.status || "",
                    rawData: { ...record, ...q }
                };
            }).filter((q: QuotationReference) => q.id && q.quotationNo);

            setQuotationRefs(mapped);
        } catch (error) {
            console.error("Error loading quotation references:", error);
        }
    };

    const mapSOFromApi = (data: any, fallback?: Partial<SOData>): SOData => {
        const items: SOItem[] = (data?.items || data?.order_items || []).map(
            (apiItem: any, index: number) => mapApiSOItemToForm(apiItem, index)
        );

        const terms: PaymentTerm[] = (data?.payment_terms || data?.terms || []).map((term: any, index: number) => {
            const rawType = normalizeText(term?.term_type_name || term?.term_type_code || term?.terms || "");
            let termType: "Advance" | "Delivery" | "Days" = "Advance";
            if (rawType.includes("DELIVERY")) termType = "Delivery";
            else if (rawType.includes("DAY")) termType = "Days";
            return {
                id: Number(term?.id || Date.now() + index),
                value: Number(term?.percentage || term?.value || 0),
                percentage: Number(term?.percentage || term?.value || 0),
                termType,
                date: term?.date || "",
                days: Number(term?.days || 0),
                note: term?.note || "",
            };
        });

        const discountObj = data?.discount || {};
        const rawDiscountType = normalizeText(discountObj?.type_name || discountObj?.type_code || data?.discount_type_name || data?.discount_type_code || data?.discount_type || "");
        const discountType: "%" | "Amount" = rawDiscountType.includes("PERCENT") || rawDiscountType === "%" || (rawDiscountType === "" && (discountObj?.discount_percent != null || discountObj?.discount_rate != null || data?.discount_percent != null)) ? "%" : "Amount";
        const discountValue = discountType === "%"
            ? Number(discountObj?.discount_rate ?? discountObj?.discount_percent ?? data?.discount_percent ?? 0)
            : Number(discountObj?.amount ?? discountObj?.discount_amount ?? data?.discount_amount ?? 0);

        const taxObj = data?.tax || {};
        const rawTaxType = normalizeText(taxObj?.type_name || taxObj?.type_code || data?.tax_type_name || data?.tax_type_code || data?.tax_type || "");
        const taxType: "%" | "Amount" = rawTaxType.includes("PERCENT") || rawTaxType === "%" || (rawTaxType === "" && (taxObj?.tax_rate != null || data?.tax_rate != null)) ? "%" : "Amount";
        const taxValue = taxType === "%"
            ? Number(taxObj?.tax_rate ?? taxObj?.tax_percent ?? data?.tax_rate ?? data?.tax_percent ?? 0)
            : Number(taxObj?.amount ?? taxObj?.tax_amount ?? data?.tax_amount ?? 0);

        const customerDetails = data?.customer_details || data?.customer || {};

        const curMatch = currencies.find((c: any) =>
            Number(c.id || c.value_id) === Number(data?.currency_id) ||
            normalizeText(c.name || c.value_name) === normalizeText(data?.currency_name) ||
            normalizeText(c.code || c.value_code) === normalizeText(data?.currency_name) ||
            normalizeText(c.code || c.value_code) === normalizeText(data?.currency)
        );
        const mappedCurrency = curMatch
            ? (curMatch.code || curMatch.value_code || curMatch.name || curMatch.value_name)
            : (data?.currency_code || data?.currency_name || data?.currency || fallback?.currency || "UGX");

        return {
            id: Number(data?.id || fallback?.id || Date.now()),
            soNumber: data?.sales_order_code || fallback?.soNumber || "",
            soDate: data?.order_date || fallback?.soDate || format(new Date(), "yyyy-MM-dd"),
            quotationRef: data?.quotation_code || fallback?.quotationRef || "",
            customerName: customerDetails?.name || customerDetails?.customer_name || data?.customer_name || fallback?.customerName || "",
            contactPerson: customerDetails?.contact_person_name || customerDetails?.contact_person || data?.contact_person_name || data?.contact_person || fallback?.contactPerson || "",
            mobileNo: customerDetails?.contact_number || customerDetails?.mobile_no || data?.mobile_no || fallback?.mobileNo || "",
            shippingAddress: customerDetails?.shipping_address || data?.shipping_address || fallback?.shippingAddress || "",
            billingAddress: customerDetails?.billing_address || data?.billing_address || fallback?.billingAddress || "",
            deliveryDate: data?.expected_delivery_date || data?.delivery_date || fallback?.deliveryDate || "",
            location: fallback?.location || "",
            warehouse: fallback?.warehouse || "",
            currency: mappedCurrency,
            remarks: data?.remarks || fallback?.remarks || "",
            terms,
            items,
            dispatches: fallback?.dispatches || [],
            discountValue,
            discountType,
            taxType,
            taxValue,
            taxPercentage: taxType === "%" ? taxValue : Number(data?.tax_rate || 0),
            status: normalizeSOStatus(data?.status_name || fallback?.status || "Draft"),
            invoiceDueAmount: fallback?.invoiceDueAmount,
            paymentStatus: fallback?.paymentStatus,
        };
    };

    const fetchQuotationByReference = async (quotationRef?: string): Promise<QuotationData | null> => {
        if (!quotationRef) return null;
        
        // 1. Try to find in local refs first (fastest)
        let ref = quotationRefs.find((q) => q.quotationNo === quotationRef);
        let quotationId = ref?.id;

        // 2. If not found in local state (common when viewing existing SO), search via API
        if (!quotationId) {
            try {
                const searchRes = await salesApi.getQuotationList({ search: quotationRef, limit: 1 });
                if (searchRes?.isSuccessful && searchRes.data?.records?.length > 0) {
                    // Find the exact match in records
                    const exactMatch = searchRes.data.records.find((r: any) => r.quotation_code === quotationRef);
                    if (exactMatch) {
                        quotationId = exactMatch.id;
                    }
                }
            } catch (error) {
                console.error("Error searching for quotation by ref:", error);
            }
        }

        if (!quotationId) return null;

        // 3. Fetch full details using the ID
        const res = await salesApi.getQuotationById(quotationId);
        if (!res?.isSuccessful || !res?.data) return null;
        const d = res.data;
        return {
            id: d.id,
            quotationNo: d.quotation_code || quotationRef,
            quotationDate: d.quotation_date || "",
            customerName: d.customer_details?.name || d.customer_name || "",
            contactPersonName: d.customer_details?.contact_person_name || "",
            contactNumber: d.customer_details?.contact_number || d.customer_details?.mobile_no || "",
            billingAddress: d.customer_details?.billing_address || "",
            shippingAddress: d.customer_details?.shipping_address || "",
            currency: d.currency_name || d.currency_code || "USD",
            currencySymbol: getCurrencySymbol(d.currency_name || d.currency_code || "USD"),
            quotationValidity: d.quotation_validity || "",
            deliveryTime: d.expected_delivery_date || "",
            remarks: d.remarks || "",
            status: normalizeSOStatus(d.status_name || "Draft") as any,
            items: (d.items || []).map((item: any) => {
                const mapped = mapApiSOItemToForm(item, 0);
                return {
                    id: mapped.id,
                    itemCode: mapped.itemCode,
                    item: mapped.itemName,
                    skuCode: mapped.skuCode,
                    skuName: mapped.skuName,
                    uom: mapped.uom,
                    qty: mapped.orderedQty,
                    rate: mapped.rate,
                    amount: mapped.price,
                };
            }),
            paymentTerms: (d.payment_terms || []).map((term: any) => ({
                id: term.id,
                terms: normalizeText(term.term_type_name || "").includes("DELIVERY") ? "Delivery" : normalizeText(term.term_type_name || "").includes("DAY") ? "Days" : "Advance",
                percentage: Number(term.percentage || 0),
                value: Number(term.percentage || 0),
                days: Number(term.days || 0),
                date: "",
            })),
            discountType: normalizeText(d.discount?.type_name || d.discount?.type_code || d.discount_type_name || "").includes("PERCENT") || d.discount?.type_code === "%" ? "%" : "Amount",
            discountValue: (normalizeText(d.discount?.type_name || d.discount?.type_code || d.discount_type_name || "").includes("PERCENT") || d.discount?.type_code === "%")
                ? Number(d.discount?.discount_rate ?? d.discount?.discount_percent ?? d.discount_percent ?? 0)
                : Number(d.discount?.amount ?? d.discount_amount ?? 0),
            taxType: normalizeText(d.tax?.type_name || d.tax?.type_code || d.tax_type_name || "").includes("PERCENT") || d.tax?.type_code === "%" ? "%" : "Amount",
            taxValue: (normalizeText(d.tax?.type_name || d.tax?.type_code || d.tax_type_name || "").includes("PERCENT") || d.tax?.type_code === "%")
                ? Number(d.tax?.tax_rate ?? d.tax?.tax_percent ?? d.tax_rate ?? 0)
                : Number(d.tax?.amount ?? d.tax_amount ?? 0),
            taxPercentage: Number(d.tax?.tax_rate ?? d.tax_rate ?? 0),
            subtotal: Number(d.subtotal || 0),
            discountAmount: Number(d.discount_amount || 0),
            taxAmount: Number(d.tax_amount || 0),
            total: Number(d.total_amount || 0),
        } as any;
    };

    useEffect(() => {
        if (hasDefaultedDraft) {
            fetchSalesOrdersList();
        }
    }, [debouncedSearchTerm, filterDate, filterStatus, currentPage, itemsPerPage, hasDefaultedDraft]);

    useEffect(() => {
        if (isSODialogOpen) {
            loadFormCustomers();
            loadFormItems();
        }
    }, [isSODialogOpen]);

    useEffect(() => {
        if (isSODialogOpen && activeSO?.customerName) {
            const customer = formCustomers.find(c => c.customer_name === activeSO.customerName);
            if (customer?.customer_id) {
                loadQuotationReferences(customer.customer_id);
            }
        }
    }, [isSODialogOpen, activeSO?.customerName, formCustomers]);

    useEffect(() => {
        if (!isSODialogOpen || !activeSO || formItems.length === 0) return;
        activeSO.items.forEach((item) => {
            const item_id = Number(item.itemCode);
            if (!item_id || skuOptionsByRow[item.id]?.length) return;
            const master = formItems.find((m) => m.id === item_id);
            void loadSkuOptionsForRow(item.id, item_id, master?.itemCode);
        });
    }, [isSODialogOpen, activeSO?.items, formItems, loadSkuOptionsForRow, skuOptionsByRow]);

    // Pagination calculations - server-side
    const totalPages = Math.ceil((totalRecords || 0) / itemsPerPage) || 1;
    const paginatedData = salesOrders;

    const isActionBusy =
        isListLoading ||
        openingSOId !== null ||
        isFormOpening ||
        isSavingSO ||
        isSubmittingSO ||
        isLoading;

    // Auto-adjust page when data changes
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalRecords, currentPage, totalPages]);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, filterDate, filterStatus]);

    // Handler to open SO dialog (view or edit)
    // Updated to show PDF preview for Invoice Pending, Dispatch Pending, Dispatched, Closed SO, and Draft statuses when viewing
    const handleOpenSO = async (so: SOData | null, isEdit: boolean) => {
        if (isActionBusy) return;

        let effectiveSO = so;
        if (so?.id) {
            setOpeningSOId(so.id);
            setIsFormOpening(true);
            try {
                const detailRes = await salesOrdersApi.getSOById(so.id);
                if (detailRes?.isSuccessful && detailRes?.data) {
                    effectiveSO = mapSOFromApi(detailRes.data, so);
                }
            } catch (error) {
                console.error("Error fetching sales order by id:", error);
            } finally {
                setIsFormOpening(false);
                setOpeningSOId(null);
            }
        }

        // If viewing a Draft SO, show PDF preview instead
        if (effectiveSO && !isEdit && effectiveSO.status === "Draft") {
            setDraftPreviewSO(effectiveSO);
            setIsDraftPDFPreviewOpen(true);
            return;
        }

        // If viewing an Invoice Pending or Invoiced SO, show PDF preview instead
        if (effectiveSO && !isEdit && (effectiveSO.status === "Invoice Pending" || effectiveSO.status === "Invoiced")) {
            setPreviewSO(effectiveSO);
            setIsPDFPreviewOpen(true);
            return;
        }

        // If viewing a Dispatch Pending SO, show Dispatch PDF preview instead
        if (effectiveSO && !isEdit && effectiveSO.status === "Dispatch Pending") {
            setDispatchPreviewSO(effectiveSO);
            setIsDispatchPDFPreviewOpen(true);
            return;
        }

        // If viewing a Dispatched SO, show Dispatched PDF preview instead
        if (effectiveSO && !isEdit && effectiveSO.status === "Dispatched") {
            setDispatchedPreviewSO(effectiveSO);
            setIsDispatchedPDFPreviewOpen(true);
            return;
        }

        // If viewing a Close SO, show Close SO PDF preview instead
        if (effectiveSO && !isEdit && effectiveSO.status === "Close") {
            setClosedSOPreviewSO(effectiveSO);
            setIsClosedSOPDFPreviewOpen(true);
            return;
        }

        if (effectiveSO) {
            const soCopy = JSON.parse(JSON.stringify(effectiveSO)) as SOData;
            setActiveSO(soCopy);
            setOriginalSO(JSON.parse(JSON.stringify(effectiveSO)) as SOData);
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
            setOriginalSO(null);
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
            const customerData = formCustomers.find(c => c.customer_name === selectedCustomer);

            if (customerData && selectedCustomer) {
                // Keep customer data if customer is selected
                setActiveSO({
                    ...activeSO,
                    quotationRef: "",
                    customerName: selectedCustomer,
                    contactPerson: customerData.contact_person_name || "",
                    mobileNo: customerData.mobile_no || "",
                    shippingAddress: customerData.shipping_address || "",
                    billingAddress: customerData.billing_address || "",
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

        const quotationRef = quotationRefs.find(q => q.quotationNo === quotationNo);
        if (quotationRef && quotationRef.rawData && activeSO) {
            // rawData now contains the individual quotation record
            const quotation = quotationRef.rawData;
            
            console.log("Selected quotation for auto-fill:", quotation);
            
            // Find customer details from current form list for fallback if quotation response is missing them
            const customerFallback = formCustomers.find(c => 
                normalizeText(c.customer_name) === normalizeText(quotation.customer_name) || 
                normalizeText(c.customer_name) === normalizeText(quotationRef.customerName)
            );
            
            // Auto-fill customer, contact, mobile number, addresses, delivery date, and items from quotation
            // Map quotation items to SO items with dispatchedQty = 0 (read-only)
            const itemsSource = quotation._items || quotation.items || [];
            const soItems: SOItem[] = itemsSource.map((qItem: any, index: number) => ({
                ...mapApiSOItemToForm(qItem, index),
                id: Date.now() + index,
                dispatchedQty: 0,
            }));

            // Auto-set Customer Select dropdown to quotation's customer
            const finalCustomerName = quotation.customer_details?.name || quotation.customer_name || quotationRef.customerName || "";
            setSelectedCustomer(finalCustomerName);
            setIsManualEntry(false);

            const termsSource = quotation._terms || quotation.payment_terms || quotation.terms || [];

            const curMatch = currencies.find((c: any) =>
                Number(c.id || c.value_id) === Number(quotation?.currency_id) ||
                normalizeText(c.name || c.value_name) === normalizeText(quotation?.currency_name) ||
                normalizeText(c.code || c.value_code) === normalizeText(quotation?.currency_code) ||
                normalizeText(c.code || c.value_code) === normalizeText(quotation?.currency)
            );
            const mappedCurrency = curMatch 
                ? (curMatch.code || curMatch.value_code || curMatch.name || curMatch.value_name) 
                : (quotation.currency_code || quotation.currency || "UGX");

            setActiveSO({
                ...activeSO,
                quotationRef: quotation.quotation_code || quotationNo,
                customerName: finalCustomerName,
                contactPerson: quotation.customer_details?.contact_person_name || customerFallback?.contact_person_name || "",
                mobileNo: quotation.customer_details?.contact_number || quotation.customer_details?.mobile_no || customerFallback?.mobile_no || "",
                shippingAddress: quotation.customer_details?.shipping_address || customerFallback?.shipping_address || "",
                billingAddress: quotation.customer_details?.billing_address || customerFallback?.billing_address || "",
                currency: mappedCurrency,
                deliveryDate: quotation.expected_delivery_date || quotation.delivery_date || "",
                items: soItems,
                // Properly map all financial fields from quotation
                discountValue: (normalizeText(quotation.discount?.type_name || quotation.discount?.type_code || quotation.discount_type_name || "").includes("PERCENT") || quotation.discount?.type_code === "%")
                    ? Number(quotation.discount?.discount_rate ?? quotation.discount?.discount_percent ?? quotation.discount_percent ?? 0)
                    : Number(quotation.discount?.amount ?? quotation.discount_amount ?? 0),
                discountType: (normalizeText(quotation.discount?.type_name || quotation.discount?.type_code || quotation.discount_type_name || "").includes("PERCENT") || quotation.discount?.type_code === "%") ? "%" : "Amount",
                taxValue: (normalizeText(quotation.tax?.type_name || quotation.tax?.type_code || quotation.tax_type_name || "").includes("PERCENT") || quotation.tax?.type_code === "%")
                    ? Number(quotation.tax?.tax_rate ?? quotation.tax?.tax_percent ?? quotation.tax_rate ?? 0)
                    : Number(quotation.tax?.amount ?? quotation.tax_amount ?? 0),
                taxType: (normalizeText(quotation.tax?.type_name || quotation.tax?.type_code || quotation.tax_type_name || "").includes("PERCENT") || quotation.tax?.type_code === "%") ? "%" : "Amount",
                taxPercentage: Number(quotation.tax?.tax_rate ?? quotation.tax_rate ?? 0),
                remarks: quotation.remarks || "",
                // Map payment terms from quotation, ensuring valid termType for Sales Order
                terms: termsSource.map((t: any) => {
                    // Force termType to be one of the valid values: "Advance", "Delivery", "Days"
                    let termType: "Advance" | "Delivery" | "Days" = "Advance";
                    const tTerms = String(t.term_type_name || t.term_type_code || t.terms || "").toLowerCase();
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
        const customer = formCustomers.find(c => c.customer_name === customerName);
        if (customer && activeSO) {
            setIsManualEntry(false);
            setSelectedCustomer(customer.customer_name);
            setActiveSO({
                ...activeSO,
                customerName: customer.customer_name,
                contactPerson: customer.contact_person_name || "",
                mobileNo: customer.mobile_no || "",
                shippingAddress: customer.shipping_address || "",
                billingAddress: customer.billing_address || ""
            });
            if (customer.customer_id) {
                loadQuotationReferences(customer.customer_id, customer.customer_name);
            } else {
                setQuotationRefs([]);
            }
        }
    };

    // Add new item to SO
    const handleAddItem = () => {
        if (!activeSO) return;
        const newItem: SOItem = {
            id: Date.now(),
            itemCode: "",
            itemName: "",
            skuId: undefined,
            skuCode: "",
            skuName: "",
            uom: "",
            orderedQty: 0,
            rate: 0, // Changed: Use rate
            price: 0, // Auto-calculated
            dispatchedQty: 0
        };
        setActiveSO({ ...activeSO, items: [...activeSO.items, newItem] });
    };

    const handleSkuChange = (rowId: number, skuIdStr: string) => {
        if (!activeSO) return;
        const options = skuOptionsByRow[rowId] || [];
        const sku = options.find((s) => String(s.id) === skuIdStr);
        setActiveSO({
            ...activeSO,
            items: activeSO.items.map((item) =>
                item.id !== rowId
                    ? item
                    : {
                          ...item,
                          skuId: sku?.id,
                          skuCode: sku?.code ?? "",
                          skuName: sku?.name ?? "",
                      }
            ),
        });
    };

    // Remove item from SO
    const handleRemoveItem = (itemId: number) => {
        if (!activeSO) return;
        setActiveSO({ ...activeSO, items: activeSO.items.filter(i => i.id !== itemId) });
        setSkuOptionsByRow((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
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

    // Save SO (Draft or Submit) - API integrated
    const handleSaveSO = async (submit: boolean = false) => {
        if (!activeSO || isActionBusy) return;

        // Validation - Cannot save/submit if in manual entry mode
        if (isManualEntry) {
            toast({
                title: "Please Check",
                description: submit ? "Please create the customer first before submitting" : "Please create the customer first before saving",
                variant: "destructive"
            });
            return;
        }

        // Validation - Customer is required
        if (!activeSO.customerName?.trim()) {
            toast({
                title: "Please Check",
                description: "Customer is required",
                variant: "destructive"
            });
            return;
        }

        // Validation - Billing Address is required
        if (!activeSO.billingAddress?.trim()) {
            toast({
                title: "Please Check",
                description: "Billing Address is required",
                variant: "destructive"
            });
            return;
        }

        // Changed: Validation - At least one item required
        if (activeSO.items.length === 0) {
            toast({
                title: "Please Check",
                description: "Please add at least one item.",
                variant: "destructive"
            });
            return;
        }

        // Changed: Validation - All items must have orderedQty > 0
        const invalidItems = activeSO.items.filter(item => Number(item.orderedQty) <= 0);
        if (invalidItems.length > 0) {
            toast({
                title: "Please Check",
                description: "All items must have Ordered Qty greater than 0.",
                variant: "destructive"
            });
            return;
        }

        const missingSku = activeSO.items.filter(
            (item) =>
                item.skuId == null ||
                item.skuId === "" ||
                !Number.isFinite(Number(item.skuId))
        );
        if (missingSku.length > 0) {
            toast({
                title: "Please Check",
                description: "Please select an SKU for each line item.",
                variant: "destructive",
            });
            return;
        }

        // Validation: Check if terms exist and validate
        if (activeSO.terms && activeSO.terms.length > 0) {
            // Validation: Total percentage must equal 100%
            const totalPercentage = activeSO.terms.reduce((sum, term) => sum + term.percentage, 0);
            if (totalPercentage !== 100) {
                toast({
                    title: "Please Check",
                    description: "Total payment percentage must equal 100%.",
                    variant: "destructive"
                });
                return;
            }

            // Validation: Check for zero percentage terms
            const hasZeroPercentage = activeSO.terms.some(term => term.percentage === 0);
            if (hasZeroPercentage) {
                toast({
                    title: "Please Check",
                    description: "Payment percentage cannot be 0%.",
                    variant: "destructive"
                });
                return;
            }
        }

        const customerMatch = formCustomers.find(c => c.customer_name === activeSO.customerName);
        const customer_id = customerMatch?.customer_id;
        const currencyMatch = currencies.find((c: any) =>
            normalizeText(c?.code || c?.value_code || c?.name || c?.value_name) === normalizeText(activeSO.currency || "UGX")
        );
        const currency_id = getEntityId(currencyMatch);
        const quotationMatch = quotationRefs.find(q => q.quotationNo === activeSO.quotationRef);

        const discountTypeMatch = findByCodePriority(
            paymentDiscountTypes,
            getPercentOrAmountCodes(activeSO.discountType || "%"),
            activeSO.discountType || "%"
        );
        const discount_type_id = getEntityId(discountTypeMatch) || 2;

        const taxTypeMatch = findByCodePriority(
            paymentTaxTypes,
            getPercentOrAmountCodes(activeSO.taxType || "%"),
            activeSO.taxType || "%"
        );
        const tax_type_id = getEntityId(taxTypeMatch) || 1;

        if (!customer_id || !currency_id || !discount_type_id || !tax_type_id) {
            toast({
                title: "Please Check",
                description: "Customer, currency, discount type, or tax type mapping failed.",
                variant: "destructive"
            });
            return;
        }

        const apiItemPayloads = (activeSO.items || []).map((item) =>
            buildSOApiItemPayload(item, formItems)
        );
        if (apiItemPayloads.some((item) => !item.item_id)) {
            toast({
                title: "Please Check",
                description: "One or more item IDs could not be resolved.",
                variant: "destructive",
            });
            return;
        }
        if (apiItemPayloads.some((item) => !item.sku_id)) {
            toast({
                title: "Please Check",
                description: "Please select an SKU for each line item.",
                variant: "destructive",
            });
            return;
        }

         const totals = calculateTotals(activeSO.items, activeSO.discountValue || 0, activeSO.discountType || "%", activeSO.taxValue || 0, activeSO.taxType || "%");

        const isExisting = salesOrders.some(so => so.id === activeSO.id);

        const originalItems = originalSO ? (originalSO.items || []) : [];
        const currentItems = activeSO.items || [];

        const deletedItemIds = originalItems
            .filter(orig => typeof orig.id === "number" && orig.id < 10000000000 && !currentItems.some(curr => curr.id === orig.id))
            .map(orig => orig.id);

        const updatedItems = currentItems
            .filter(curr => typeof curr.id === "number" && curr.id < 10000000000 && originalItems.some(orig => orig.id === curr.id))
            .map((item: SOItem) => ({
                id: item.id,
                ...buildSOApiItemPayload(item, formItems),
            }));

        const addedItems = currentItems
            .filter(curr => !curr.id || typeof curr.id !== "number" || curr.id >= 10000000000 || !originalItems.some(orig => orig.id === curr.id))
            .map((item: SOItem) => buildSOApiItemPayload(item, formItems));

        const originalTerms = originalSO ? (originalSO.terms || []) : [];
        const currentTerms = activeSO.terms || [];

        const deletedTermIds = originalTerms
            .filter(orig => typeof orig.id === "number" && orig.id < 10000000000 && !currentTerms.some(curr => curr.id === orig.id))
            .map(orig => orig.id);

        const updatedTerms = currentTerms
            .filter(curr => typeof curr.id === "number" && curr.id < 10000000000 && originalTerms.some(orig => orig.id === curr.id))
            .map((term: any) => {
                const termTypeLower = normalizeText(term?.termType || "");
                let typeMatch = paymentTermTypes.find((t: any) => {
                    const name = normalizeText(t?.name || t?.value_name || t?.code || t?.value_code || "");
                    return name.includes(termTypeLower) || termTypeLower.includes(name);
                });
                if (!typeMatch && paymentTermTypes.length > 0) {
                    typeMatch = paymentTermTypes[0];
                }
                return {
                    id: term.id,
                    term_type_id: getEntityId(typeMatch),
                    percentage: Number(term?.value || term?.percentage || 0),
                    days: term?.termType === "Days" ? Number(term?.days || 0) : null,
                };
            });

        const addedTerms = currentTerms
            .filter(curr => !curr.id || typeof curr.id !== "number" || curr.id >= 10000000000 || !originalTerms.some(orig => orig.id === curr.id))
            .map((term: any) => {
                const termTypeLower = normalizeText(term?.termType || "");
                let typeMatch = paymentTermTypes.find((t: any) => {
                    const name = normalizeText(t?.name || t?.value_name || t?.code || t?.value_code || "");
                    return name.includes(termTypeLower) || termTypeLower.includes(name);
                });
                if (!typeMatch && paymentTermTypes.length > 0) {
                    typeMatch = paymentTermTypes[0];
                }
                return {
                    term_type_id: getEntityId(typeMatch),
                    percentage: Number(term?.value || term?.percentage || 0),
                    days: term?.termType === "Days" ? Number(term?.days || 0) : null,
                };
            });

        const apiPayload: any = {
            sales_order_code: activeSO.soNumber,
            order_date: activeSO.soDate,
            quotation_id: quotationMatch?.id || undefined,
            customer_id,
            currency_id,
            expected_delivery_date: activeSO.deliveryDate || null,
            delivery_date: activeSO.deliveryDate || null,
            remarks: activeSO.remarks || null,
            discount_type_id: discount_type_id,
            discount_percent: activeSO.discountType === "%" ? Number(activeSO.discountValue || 0) : 0,
            discount_amount: activeSO.discountType === "Amount" ? Number(activeSO.discountValue || 0) : Number(totals.discountAmount || 0),
            tax_type_id: tax_type_id,
            tax_rate: activeSO.taxType === "%" ? Number(activeSO.taxValue || 0) : 0,
            tax_amount: Number(totals.totalTax || 0),
            subtotal: Number(totals.subtotal || 0),
            total_amount: Number(totals.grandTotal || 0),
            items: isExisting ? {
                add: addedItems,
                update: updatedItems,
                delete: deletedItemIds
            } : (activeSO.items || []).map((item: SOItem) => ({
                ...buildSOApiItemPayload(item, formItems),
                price_per_item: Number(item?.price || 0),
            })),
            payment_terms: isExisting ? {
                add: addedTerms,
                update: updatedTerms,
                delete: deletedTermIds
            } : (activeSO.terms || []).map((term: any) => {
                const termTypeLower = normalizeText(term?.termType || "");
                let typeMatch = paymentTermTypes.find((t: any) => {
                    const name = normalizeText(t?.name || t?.value_name || t?.code || t?.value_code || "");
                    return name.includes(termTypeLower) || termTypeLower.includes(name);
                });
                if (!typeMatch && paymentTermTypes.length > 0) {
                    typeMatch = paymentTermTypes[0];
                }
                return {
                    term_type_id: getEntityId(typeMatch),
                    percentage: Number(term?.value || term?.percentage || 0),
                    days: term?.termType === "Days" ? Number(term?.days || 0) : null,
                };
            })
        };

        if (isExisting && typeof activeSO.id === "number" && activeSO.id < 10000000000) {
            apiPayload.id = activeSO.id;
        }

        if (submit) {
            setIsSubmittingSO(true);
        } else {
            setIsSavingSO(true);
        }
        try {
            const response = isExisting
                ? (submit ? await salesOrdersApi.updateSO({ ...apiPayload, status_code: "INVOICE_PENDING" }) : await salesOrdersApi.updateSO(apiPayload))
                : (submit ? await salesOrdersApi.submitSO(apiPayload) : await salesOrdersApi.saveAsDraftSO(apiPayload));

            if (!response?.isSuccessful) {
                toast({
                    title: submit ? "Submit Failed" : "Save Failed",
                    description: response?.message || "Unable to save sales order.",
                    variant: "destructive",
                });
                return;
            }

            if (submit && !isExisting) {
                createInvoiceFromSO({ ...activeSO, status: "Invoice Pending" } as any);
            }

            fetchSalesOrdersList();
            setIsSODialogOpen(false);
            toast({
                title: submit ? "SO Submitted" : "SO Saved",
                description: response?.message || (submit ? "Sales order submitted successfully." : "Sales order saved as draft."),
                variant: "success"
            });
        } catch (error: any) {
            toast({
                title: submit ? "Submit Failed" : "Save Failed",
                description: error?.message || "Unable to save sales order.",
                variant: "destructive",
            });
        } finally {
            if (submit) {
                setIsSubmittingSO(false);
            } else {
                setIsSavingSO(false);
            }
        }
    };

    // Process to Invoice (Invoice Pending → Dispatch Pending) - removed localStorage - using mock store
    const handleProcessToInvoice = () => {
        if (!activeSO || activeSO.status !== "Invoice Pending") return;
        changeSOStatus(activeSO.id, "Dispatch Pending");
        fetchSalesOrdersList();
        setIsSODialogOpen(false);
        toast({
            title: "Processed to Invoice",
            description: `Sales Order ${activeSO.soNumber} is now in Dispatch Pending status.`,
            variant: "success"
        });
    };

    // Close SO (only allowed when status = Dispatched and payment completed)
    const handleCloseSO = (so?: SOData) => {
        const soToClose = so || activeSO || dispatchedEditSO;
        if (!soToClose) return;

        const result = closeSalesOrder(soToClose.id);

        if (result.success) {
            fetchSalesOrdersList();
            if (activeSO) {
                setActiveSO(result.so || null);
            }
            if (dispatchedEditSO) {
                setIsDispatchedEditOpen(false);
            }
            toast({
                title: "Success",
                description: result.message,
                variant: "success"
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
    const handleDeleteClick = (so: SOData) => {
        setSoToDelete(so);
        setIsDeleteAlertOpen(true);
    };

    const handleDeleteSO = async (soId: number) => {
        try {
            const response = await salesOrdersApi.deleteSO(soId);
            if (response.isSuccessful) {
                toast({
                    title: "SO Deleted",
                    description: response.message || "Sales Order has been deleted successfully.",
                    variant: "success"
                });
                fetchSalesOrdersList();
            } else {
                toast({
                    title: "Delete Failed",
                    description: response.message || "Unable to delete sales order.",
                    variant: "destructive"
                });
            }
        } catch (error: any) {
            toast({
                title: "Delete Failed",
                description: error.message || "An error occurred while deleting the sales order.",
                variant: "destructive"
            });
        } finally {
            setIsDeleteAlertOpen(false);
            setIsSODialogOpen(false);
            setSoToDelete(null);
        }
    };

    // Download Quotation PDF - Opens print dialog
    const handleDownloadQuotation = async () => {
        if (!activeSO || !activeSO.quotationRef) {
            toast({
                title: "No Quotation",
                description: "This Sales Order does not have a linked quotation.",
                variant: "destructive"
            });
            return;
        }

        const quotation = await fetchQuotationByReference(activeSO.quotationRef);

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
        // Use unified quotation PDF template
        const pdfContent = generateQuotationPDFHTML(quotation as any);

        const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
        if (iframeDoc) {
            iframeDoc.open();
            iframeDoc.write(pdfContent);
            iframeDoc.close();

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
                                <div class="info-item"><strong>SO Code</strong><span>${activeSO.soNumber}</span></div>
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
                                    <th>SKU</th>
                                    <th width="60">UOM</th>
                                    <th width="80" class="text-right">Qty</th>
                                    <th width="80" class="text-right">Unit Price</th>
                                    <th width="100" class="text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${activeSO.items.map((item, index) => `
                                    <tr>
                                        <td class="text-center">${index + 1}</td>
                                        <td class="font-bold">${item.itemName}</td>
                                        <td>${formatSoItemSkuLabel(item)}</td>
                                        <td>${item.uom || "—"}</td>
                                        <td class="text-right">${item.orderedQty}</td>
                                        <td class="text-right">${getCurrencySymbol(activeSO.currency || "USD")} ${Number(item.rate).toFixed(2)}</td>
                                        <td class="text-right font-bold" style="color: #1e40af;">${getCurrencySymbol(activeSO.currency || "USD")} ${Number(item.price).toFixed(2)}</td>
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
                                    <span class="font-bold">${getCurrencySymbol(activeSO.currency || "USD")} ${subtotal.toFixed(2)}</span>
                                </div>
                                <div class="total-row">
                                    <span>Discount (${activeSO.discountValue || 0}${activeSO.discountType === "%" ? "%" : ""}):</span>
                                    <span class="font-bold" style="color: #dc2626;">-${getCurrencySymbol(activeSO.currency || "USD")} ${discountAmount.toFixed(2)}</span>
                                </div>
                                <div class="total-row">
                                    <span>Tax (${activeSO.taxPercentage}%):</span>
                                    <span class="font-bold" style="color: #16a34a;">+${getCurrencySymbol(activeSO.currency || "USD")} ${totalTax.toFixed(2)}</span>
                                </div>
                                <div class="total-row grand">
                                    <span>Grand Total:</span>
                                    <span>${getCurrencySymbol(activeSO.currency || "USD")} ${grandTotal.toFixed(2)}</span>
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
                                <div class="info-item"><strong>SO Code</strong><span>${activeSO.soNumber}</span></div>
                                <div class="info-item"><strong>Warehouse</strong><span>${activeSO.warehouse || "Main Warehouse"}</span></div>
                                <div class="info-item"><strong>Dispatch Date</strong><span>${formattedSODate}</span></div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th width="50">#</th>
                                    <th>Item Name</th>
                                    <th>SKU</th>
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
                                        <td>${formatSoItemSkuLabel(item)}</td>
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
    const handleDownloadDispatchNoteFromPreview = async (so: SOData) => {
        if (!so) return;

        try {
            setIsLoading(true);

            // 1. Find the linked dispatch for this SO
            const searchRes = await inventoryApi.getDispatchList({ search: so.soNumber, page: 1, limit: 1 });
            const linkedDispatch = searchRes?.data?.records?.find(d => d.so_code === so.soNumber);

            if (!linkedDispatch) {
                toast({
                    title: "Dispatch Not Found",
                    description: `No dispatch record found for Sales Order ${so.soNumber}`,
                    variant: "destructive"
                });
                return;
            }

            // 2. Fetch full dispatch details
            const detailRes = await inventoryApi.getDispatchById(linkedDispatch.dispatch_id);
            if (!detailRes?.isSuccessful || !detailRes?.data) {
                toast({
                    title: "Error",
                    description: "Failed to load dispatch details.",
                    variant: "destructive"
                });
                return;
            }

            const dispatch = detailRes.data;

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

            const formattedDispatchDate = format(new Date(dispatch.dispatch_date), "dd/MM/yyyy");

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

                        .details-section { margin-bottom: 20px; }
                        .info-box { border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; }
                        .info-box h3 { margin: 0 0 6px 0; font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
                        .info-item { margin-bottom: 4px; display: flex; }
                        .info-item strong { width: 90px; color: #475569; font-size: 10px; flex-shrink: 0; }
                        .info-item span { color: #1e293b; font-weight: 500; }

                        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                        th { background-color: #f8fafc; color: #475569; font-size: 9px; text-transform: uppercase; padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; }
                        td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 10px; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: 700; }
                        .text-primary { color: #1e40af; }

                        .remarks-section { margin-top: 15px; }
                        .remarks-section h3 { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
                        .remarks-box { border: 1px solid #e2e8f0; padding: 8px; border-radius: 4px; min-height: 40px; background: #f8fafc; }
                        
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
                                <p># DSP-${dispatch.dispatch_id}</p>
                            </div>
                        </div>

                        <div class="details-section">
                            <div class="info-box" style="margin-bottom: 15px;">
                                <h3>Customer Details</h3>
                                <div class="info-item"><strong>Customer</strong><span>${dispatch.customer_name}</span></div>
                                <div class="info-item"><strong>Address</strong><span>${dispatch.shipping_address || "N/A"}</span></div>
                            </div>
                            <div class="info-box">
                                <h3>Order Details</h3>
                                <div class="info-item"><strong>SO Code</strong><span>${dispatch.so_code}</span></div>
                                <div class="info-item"><strong>Warehouse</strong><span>${dispatch.warehouse_name || "Main Warehouse"}</span></div>
                                <div class="info-item"><strong>Dispatch Date</strong><span>${formattedDispatchDate}</span></div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th width="50">#</th>
                                    <th>ITEM NAME</th>
                                    <th width="80" class="text-center">UOM</th>
                                    <th width="80" class="text-right">ORDERED</th>
                                    <th width="80" class="text-right">DISPATCHED</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${dispatch.dispatch_items.map((item, index) => `
                                    <tr>
                                        <td class="text-center">${index + 1}</td>
                                        <td>${item.item_name}</td>
                                        <td class="text-center">${item.uom || 'PCS'}</td>
                                        <td class="text-right">${item.ordered_qty}</td>
                                        <td class="text-right font-bold text-primary">${item.dispatched_qty}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        ${dispatch.remarks ? `
                            <div class="remarks-section">
                                <h3>Remarks</h3>
                                <div class="remarks-box">${dispatch.remarks}</div>
                            </div>
                        ` : ''}

                        <div class="footer">
                            <p>This is a computer generated document. Generated on ${format(new Date(), "MMMM dd, yyyy, h:mm a")}</p>
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

                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                }, 500);
            }
        } catch (error: any) {
            console.error("Error downloading dispatch note:", error);
            toast({
                title: "Error",
                description: `Failed to generate Dispatch Note: ${error.message || "Unexpected error"}`,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Download Quotation from preview - Using unified template
    const handleDownloadQuotationFromPreview = async (quotationRef?: string) => {
        const refToUse = quotationRef || previewSO?.quotationRef;

        if (!refToUse) {
            toast({
                title: "No Quotation",
                description: "This Sales Order does not have a linked quotation.",
                variant: "destructive"
            });
            return;
        }

        const quotation = await fetchQuotationByReference(refToUse);

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
                                    <div class="info-label">SO Code</div>
                                    <div class="info-value">${so.soNumber}</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">SO Date</div>
                                    <div class="info-value">${formattedSODate}</div>
                                </div>
                                ${so.quotationRef ? `
                                <div class="info-item">
                                    <div class="info-label">Quotation Code Reference</div>
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
                                        <th style="width: 6%;">#</th>
                                        <th style="width: ${so.status === 'Dispatched' ? '22%' : '26%'};">Item</th>
                                        <th style="width: 18%;">SKU</th>
                                        <th style="width: 8%;">UOM</th>
                                        <th class="text-right" style="width: 10%;">Qty</th>
                                        <th class="text-right" style="width: ${so.status === 'Dispatched' ? '12%' : '14%'};">Unit Price</th>
                                        <th class="text-right" style="width: ${so.status === 'Dispatched' ? '12%' : '14%'};">Price</th>
                                        ${so.status === 'Dispatched' ? '<th class="text-right" style="width: 10%;">Dispatched Qty</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${so.items.map((item, index) => `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td><strong>${item.itemName}</strong></td>
                                            <td>${formatSoItemSkuLabel(item)}</td>
                                            <td>${item.uom || "—"}</td>
                                            <td class="text-right">${item.orderedQty}</td>
                                            <td class="text-right">${getCurrencySymbol(so.currency)} ${Number(item.rate).toFixed(2)}</td>
                                            <td class="text-right"><strong>${getCurrencySymbol(so.currency)} ${Number(item.price).toFixed(2)}</strong></td>
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
    const handleDownloadInvoiceFromDispatchPreview = async (so: SOData) => {
        if (!so) return;

        try {
            setIsLoading(true);
            // 1. Find the linked invoice for this SO using search
            const searchRes = await invoicingApi.getInvoicesList({ search: so.soNumber, limit: 1 });
            
            // Check if search results exist and find exact match for SO code
            const linkedRecord = searchRes?.data?.records?.find(inv => inv.so_code === so.soNumber);

            if (!linkedRecord) {
                toast({
                    title: "Invoice Not Found",
                    description: `No invoice found for Sales Order ${so.soNumber}`,
                    variant: "destructive"
                });
                return;
            }

            // 2. Fetch full invoice details to get items, terms, etc.
            const detailRes = await invoicingApi.getInvoiceById(linkedRecord.invoice_id);
            if (!detailRes?.isSuccessful || !detailRes?.data) {
                toast({
                    title: "Error",
                    description: "Failed to load invoice details.",
                    variant: "destructive"
                });
                return;
            }

            const inv = detailRes.data;

            // Date helper to prevent format() crashes
            const safeDate = (dateStr: any) => {
                if (!dateStr) return new Date().toISOString();
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? new Date().toISOString() : dateStr;
            };

            // 3. Map backend invoice data to InvoicePDFData format
            // IMPORTANT: Fields must match the provided JSON structure
            const invoicePDFData: InvoicePDFData = {
                companyName: inv.company_name || "MASTER-ERP",
                companyAddress: inv.company_address || "Industrial Solutions & Services\nAhmedabad, Gujarat, India",
                invoiceNumber: inv.invoice_code || linkedRecord.invoice_code || "",
                invoiceDate: safeDate(inv.invoice_date || linkedRecord.invoice_date),
                status: inv.status_name || linkedRecord.status_name || "Open",
                customerName: inv.customer_name || linkedRecord.customer_name || "",
                contactPerson: inv.contact_person || "",
                mobileNo: inv.mobile_no || "",
                billingAddress: inv.billing_address || "",
                shippingAddress: inv.shipping_address || "",
                currency: inv.currency_name || linkedRecord.currency_name || "USD",
                currencySymbol: getCurrencySymbol(inv.currency_name || linkedRecord.currency_name || "USD"),
                soNumber: inv.so_code || so.soNumber,
                soDate: inv.order_date || so.soDate || "",
                deliveryDate: inv.delivery_date || so.deliveryDate || "",
                taxPercentage: Number(inv.summary?.tax_percent || 0),
                taxValue: Number(inv.summary?.tax_percent || 0),
                taxType: "%",
                discountValue: Number(inv.summary?.discount_percent || 0),
                discountType: "%",
                items: (inv.items || []).map((item: any) => ({
                    id: Number(item.item_id || Math.random()),
                    itemName: item.item_name || "",
                    skuCode: item.sku_code || "",
                    skuName: item.sku_name || "",
                    uom: item.uom_name || item.uom || "PCS",
                    orderedQty: Number(item.ordered_qty || 0),
                    rate: Number(item.unit_price || 0),
                    price: Number(item.price_per_item || 0)
                })),
                terms: (inv.terms || []).map((term: any) => ({
                    id: Number(term.term_id || Math.random()),
                    termType: term.term_type_name || "",
                    percentage: Number(term.percentage || 0),
                    days: Number(term.days || 0),
                    date: ""
                }))
            };

            // 4. Generate and print PDF
            const pdfContent = generateInvoicePDFHTML(invoicePDFData);
            
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
                doc.write(pdfContent);
                doc.close();

                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                }, 500);
            }
        } catch (error: any) {
            console.error("Error downloading invoice:", error);
            toast({
                title: "Download Error",
                description: `Failed to generate PDF: ${error.message || "Unexpected error"}`,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold tracking-tight">Sales Orders</h1>

            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: (val) => {
                        setSearchTerm(val);
                        setCurrentPage(1);
                    },
                    placeholder: "Search by SO Code, Customer..."
                }}
                filters={[
                    {
                        type: "date",
                        label: "Filter By Date",
                        value: filterDate,
                        onChange: (date) => {
                            setFilterDate(date);
                            setCurrentPage(1);
                        },
                        showClear: true
                    },
                    {
                        type: "select",
                        label: "Filter By Status",
                        value: filterStatus,
                        onChange: (val) => {
                            setFilterStatus(val);
                            setCurrentPage(1);
                        },
                        searchable: true,
                        options: [
                            { label: "All Status", value: "all" },
                            ...salesOrderStatuses.map((status: any) => ({
                                label: status?.name || status?.value_name || "Unknown",
                                value: String(status?.id || status?.value_id || status?.status_id),
                            }))
                        ]
                    }
                ]}
                actions={canCreate(MODULE_KEY) ? [
                    {
                        label: "New Sales Order",
                        onClick: () => {
                            if (isActionBusy) return;
                            handleOpenSO(null, true);
                        },
                        icon: <Plus className="h-4 w-4" />
                    }
                ] : []}
            />
            {/* SO Table - Matching WarrantyService layout */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 pl-6">SO Code</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">SO Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Customer</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="font-semibold text-xs tracking-wider text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isListLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm text-muted-foreground">Loading...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                                            No Sales Orders found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((so) => (
                                        <TableRow key={so.id} className="hover:bg-muted/30 transition-colors border-b last:border-none">
                                            <TableCell className="py-4 pl-6 font-medium text-xs font-mono text-primary">{so.soNumber}</TableCell>
                                            <TableCell className="py-4 text-sm font-medium text-slate-600">
                                                {so.soDate.includes('-') ? format(new Date(so.soDate), "dd-MM-yyyy") : so.soDate}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm font-bold text-primary">{so.customerName}</TableCell>
                                            <TableCell className="py-4 text-center">
                                                {getSOStatusBadge(so.status)}
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <TableActionButtons
                                                    onView={canView(MODULE_KEY) && !isActionBusy ? () => handleOpenSO(so, false) : undefined}
                                                    onEdit={
                                                        canEdit(MODULE_KEY) && !isActionBusy && so.status === "Draft"
                                                            ? () => handleOpenSO(so, true)
                                                            : undefined
                                                    }
                                                    onDelete={undefined}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalRecords > 0 && !isListLoading && (
                        <div className="px-4 py-2 border-t">
                            <DataTablePagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={totalRecords}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                                options={[10, 15, 30, 50]}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* SO DIALOG - Modal with all required fields */}
            <Dialog open={isSODialogOpen} onOpenChange={setIsSODialogOpen}>
                <DialogContent
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 space-y-1 p-4 pb-2 sm:p-5 sm:pb-3">
                        <DialogTitle className="text-lg font-bold sm:text-xl">
                            {activeSO?.id && salesOrders.find(so => so.id === activeSO.id) ?
                                (isSOEdit ? "Edit Sales Order" : "View Sales Order") :
                                "Create Sales Order"}
                        </DialogTitle>
                        <DialogDescription className="text-xs leading-snug text-muted-foreground sm:text-sm">
                            {activeSO?.status === "Draft" ? "Fill in the details to create or update a sales order." : "Review sales order details."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 space-y-6 relative">
                        {isFormOpening && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
                        {/* Header Info - Changed: Only show in Edit/View mode, not in Create mode */}
                        {activeSO?.id && salesOrders.find(so => so.id === activeSO.id) && (
                            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">SO Code</Label>
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
                                {/* Payment Information - Show for Dispatched and Close SO */}
                                {activeSO && (activeSO.status === "Dispatched" || activeSO.status === "Close") && (
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
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
                            {/* Customer Select - Searchable Select (Required) - MOVED TO TOP */}
                            <div className="min-w-0 space-y-1.5">
                                <SearchableSelect
                                    label="Customer"
                                    required
                                    disabled={activeSO?.status !== "Draft"}
                                    value={selectedCustomer}
                                    options={[
                                        ...formCustomers.map((c) => ({ label: c.customer_name, value: c.customer_name }))
                                    ]}
                                    onChange={handleCustomerSelect}
                                    className="h-9"
                                />
                            </div>

                            {/* Quotation Code Reference - Searchable Select (Optional) - MOVED BELOW CUSTOMER */}
                            <div className="min-w-0 space-y-1.5">
                                <SearchableSelect
                                    label="Quotation Code Reference (Optional)"
                                    disabled={activeSO?.status !== "Draft" || !selectedCustomer}
                                    value={selectedQuotation || "none"}
                                    placeholder={selectedCustomer ? "Select Quotation (Optional)" : "Select Customer First"}
                                    options={[
                                        { label: "None", value: "none" },
                                        ...quotationRefs
                                            .filter(q => {
                                                if (!q.statusName) return true;
                                                const status = normalizeText(q.statusName);
                                                return status.includes("SUBMITTED") || 
                                                       status.includes("OPEN") || 
                                                       status.includes("APPROVED") || 
                                                       status.includes("SENT") ||
                                                       status === "1"; // Handle numeric status if applicable
                                            })
                                            .filter(q => !salesOrders.some(so => so.quotationRef === q.quotationNo))
                                            .filter(q => !selectedCustomer || normalizeText(q.customerName) === normalizeText(selectedCustomer))
                                            .map(q => ({ label: q.quotationNo, value: q.quotationNo }))
                                    ]}
                                    onChange={handleQuotationSelect}
                                    className="h-9"
                                />
                            </div>

                            {/* Customer Name - Editable when manual entry */}
                            <div className="min-w-0 space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Customer Name
                                    {!isManualEntry && <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>}
                                </Label>
                                <Input
                                    value={activeSO?.customerName || ""}
                                    onChange={(e) => activeSO && setActiveSO({ ...activeSO, customerName: e.target.value })}
                                    disabled={!isManualEntry || activeSO?.status !== "Draft"}
                                    className={cn("h-9", !isManualEntry && "bg-muted/50")}
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
                                    Mobile No
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
                                    Billing Address
                                    {!isManualEntry && <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>}
                                </Label>
                                <Input
                                    value={activeSO?.billingAddress || ""}
                                    onChange={(e) => activeSO && setActiveSO({ ...activeSO, billingAddress: e.target.value })}
                                    disabled={!isManualEntry || activeSO?.status !== "Draft"}
                                    className={cn("h-10", !isManualEntry && "bg-muted/50")}
                                />
                            </div>

                            <div className="space-y-2">
                                <SearchableSelect
                                    label="Currency"
                                    required
                                    disabled={activeSO?.status !== "Draft" || !!(selectedQuotation && selectedQuotation !== "none")}
                                    value={activeSO?.currency}
                                    options={currencies && currencies.length > 0 ? currencies.map((c: any) => c.code || c.value_code || c.name || c.value_name || "").filter(Boolean) : ["USD", "EUR", "GBP", "INR", "JPY", "CNY", "AUD", "CAD", "UGX"]}
                                    onChange={(val) => {
                                        if (activeSO) {
                                            setActiveSO({ ...activeSO, currency: val });
                                        }
                                    }}
                                />
                            </div>

                            {/* Delivery Date */}
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Delivery Date <span className="text-destructive font-bold">*</span>
                                </Label>
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
                                        const value = e.target.value.slice(0, 200);
                                        if (activeSO) setActiveSO({ ...activeSO, remarks: value });
                                    }}
                                    disabled={activeSO?.status !== "Draft"}
                                    className="min-h-[60px]"
                                    maxLength={200}
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    {activeSO?.remarks?.length || 0}/200 characters
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
                                                <TableCell className="py-2 pl-6">Percentage</TableCell>
                                                <TableCell className="py-2">Term Type</TableCell>
                                                <TableCell className="py-2 text-center">Days</TableCell>
                                                {activeSO?.status === "Draft" && (
                                                    <TableCell className="py-2 text-right pr-6">Actions</TableCell>
                                                )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activeSO.terms.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={activeSO.status === "Draft" ? 4 : 3} className="text-center py-8 text-muted-foreground italic">
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
                                                                            if (val > 100) val = 100;

                                                                            const updated = activeSO.terms.map(t =>
                                                                                t.id === term.id
                                                                                    ? { ...t, value: val, percentage: val }
                                                                                    : t
                                                                            );
                                                                            setActiveSO({ ...activeSO, terms: updated });
                                                                        }}
                                                                        className="h-8 w-28 text-center"
                                                                        min="0"
                                                                        max="100"
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
                                                                            {((paymentTermTypes && paymentTermTypes.length > 0)
                                                                                ? paymentTermTypes.map((t: any) => {
                                                                                    const name = String(t.name || t.value_name || t.code || t.value_code || "").toUpperCase().trim();
                                                                                    if (name.includes("DELIVERY")) return "Delivery";
                                                                                    if (name.includes("DAY")) return "Days";
                                                                                    return "Advance";
                                                                                }).filter((v, i, arr) => arr.indexOf(v) === i)
                                                                                : ["Advance", "Delivery", "Days"]
                                                                            ).map((opt) => (
                                                                                <SelectItem key={opt} value={opt} disabled={usedTermTypes.includes(opt as any)}>
                                                                                    {opt}
                                                                                </SelectItem>
                                                                            ))}
                                                                            {/*
                                                                                Advance
                                                                            </SelectItem>
                                                                            <SelectItem value="Delivery" disabled={usedTermTypes.includes("Delivery")}>
                                                                                Delivery
                                                                            </SelectItem>
                                                                            <SelectItem value="Days" disabled={usedTermTypes.includes("Days")}>
                                                                                Days
                                                                            </SelectItem>
                                                                        */}</SelectContent>
                                                                    </Select>
                                                                ) : (
                                                                    <span className="font-medium">{term.termType}</span>
                                                                )}
                                                            </TableCell>

                                                            {/* Days Column */}
                                                            <TableCell className="py-4 text-center">
                                                                {activeSO.status === "Draft" && term.termType === "Days" ? (
                                                                    <div className="space-y-1">
                                                                        <Input
                                                                            type="number"
                                                                            value={term.days || ""}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value === "" ? "" : parseInt(e.target.value);
                                                                                const updated = activeSO.terms.map(t => t.id === term.id ? { ...t, days: val } : t);
                                                                                setActiveSO({ ...activeSO, terms: updated });
                                                                            }}
                                                                            className={cn("h-8 w-24 text-center mx-auto", (!term.days || Number(term.days) <= 0) && "border-red-500 focus-visible:ring-red-500")}
                                                                            placeholder="Enter days"
                                                                        />
                                                                        {(!term.days || Number(term.days) <= 0) && (
                                                                            <p className="text-[10px] text-red-500 font-medium text-center">Days must be greater than 0</p>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="font-medium text-muted-foreground">{term.termType === "Days" ? (term.days || "-") : "-"}</span>
                                                                )}
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
                                <div className="overflow-x-auto">
                                <Table className={cn("w-full table-fixed", activeSO?.status === "Dispatched" ? "min-w-[1100px]" : "min-w-[1000px]")}>
                                    <colgroup>
                                        <col className="w-[24%]" />
                                        <col className="w-[18%]" />
                                        <col className="w-[8%]" />
                                        <col className="w-[10%]" />
                                        <col className="w-[14%]" />
                                        <col className="w-[12%]" />
                                        {activeSO?.status === "Dispatched" && <col className="w-[10%]" />}
                                        {activeSO?.status === "Draft" && <col className="w-[4%]" />}
                                    </colgroup>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-[10px] font-bold uppercase py-3 pl-6">Item</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3">
                                                SKU <span className="text-red-500">*</span>
                                            </TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">UOM</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Ordered Qty</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Unit Price</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Price</TableHead>
                                            {/* Dispatched Qty column only shown when status = Dispatched */}
                                            {activeSO?.status === "Dispatched" && (
                                                <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Dispatched Qty</TableHead>
                                            )}
                                            {activeSO?.status === "Draft" && (
                                                <TableHead className="text-[10px] font-bold py-3 text-center">Actions</TableHead>
                                            )}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeSO?.items.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={
                                                        activeSO?.status === "Dispatched"
                                                            ? 8
                                                            : activeSO?.status === "Draft"
                                                              ? 8
                                                              : 7
                                                    }
                                                    className="text-center py-8 text-muted-foreground italic"
                                                >
                                                    No items added yet
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            activeSO?.items.map((item) => {
                                                const usedItems = activeSO.items.filter(it => it.id !== item.id).map(it => it.itemName) || [];
                                                const qty = parseFloat(item.orderedQty?.toString() || "0");
                                                const rate = parseFloat(item.rate?.toString() || "0");
                                                const isQtyInvalid = (item.orderedQty as any) !== "" && (isNaN(qty) || qty <= 0);
                                                const isRateInvalid = (item.rate as any) !== "" && (isNaN(rate) || rate <= 0);
                                                const hasSku =
                                                    item.skuId != null &&
                                                    item.skuId !== "" &&
                                                    Number.isFinite(Number(item.skuId));
                                                const isSkuInvalid = Boolean(item.itemName) && !hasSku;

                                                return (
                                                    <TableRow key={item.id} className="hover:bg-muted/20 align-top">
                                                        <TableCell className="max-w-0 py-4 pl-6 align-top">
                                                            {activeSO.status === "Draft" ? (
                                                                <SearchableSelect
                                                                    value={item.itemName}
                                                                    options={((formItems && formItems.length > 0 ? formItems : mockItems) || []).map(mi => ({
                                                                        label: `${mi.name}${mi.itemCode ? ` — ${mi.itemCode}` : ""}`,
                                                                        value: mi.name,
                                                                        primaryText: mi.name,
                                                                        secondaryText: mi.itemCode,
                                                                        disabled: usedItems.includes(mi.name)
                                                                    }))}
                                                                    onChange={(val) => {
                                                                        const allItems = formItems && formItems.length > 0 ? formItems : mockItems;
                                                                        const selectedItem = allItems.find(mi => mi.name === val);
                                                                        if (selectedItem) {
                                                                            const updated = activeSO.items.map(i =>
                                                                                i.id === item.id ? {
                                                                                    ...i,
                                                                                    itemCode: String(selectedItem.id),
                                                                                    itemName: selectedItem.name,
                                                                                    uom: selectedItem.uom || "PCS",
                                                                                    skuId: undefined,
                                                                                    skuCode: "",
                                                                                    skuName: "",
                                                                                    rate: selectedItem.rate,
                                                                                    price: (Number(i.orderedQty) || 0) * (Number(selectedItem.rate) || 0)
                                                                                } : i
                                                                            );
                                                                            setActiveSO({ ...activeSO, items: updated });
                                                                            void loadSkuOptionsForRow(
                                                                                item.id,
                                                                                selectedItem.id,
                                                                                selectedItem.itemCode
                                                                            );
                                                                        }
                                                                    }}
                                                                    placeholder="Select Item"
                                                                    showSelectedTitle
                                                                    compactStackedSelected
                                                                    listClassName="max-h-[220px]"
                                                                />
                                                            ) : (
                                                                <div className="font-bold text-sm text-primary">{item.itemName}</div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="max-w-0 py-4 align-top">
                                                            {activeSO.status === "Draft" ? (
                                                                <div className="space-y-1">
                                                                    <SearchableSelect
                                                                        required
                                                                        value={
                                                                            item.skuId != null && item.skuId !== ""
                                                                                ? String(item.skuId)
                                                                                : ""
                                                                        }
                                                                        options={(skuOptionsByRow[item.id] || []).map((sku) => ({
                                                                            label: sku.name
                                                                                ? `${sku.code} — ${sku.name}`
                                                                                : sku.code,
                                                                            value: String(sku.id),
                                                                            primaryText: sku.code,
                                                                            secondaryText: sku.name,
                                                                        }))}
                                                                        onChange={(val) => handleSkuChange(item.id, String(val))}
                                                                        placeholder={
                                                                            !item.itemName
                                                                                ? "Select item first"
                                                                                : (skuOptionsByRow[item.id]?.length ?? 0) === 0
                                                                                  ? "Loading SKU..."
                                                                                  : "Select SKU *"
                                                                        }
                                                                        disabled={!item.itemName}
                                                                        showSelectedTitle
                                                                        compactStackedSelected
                                                                        listClassName="max-h-[220px]"
                                                                        className={cn(
                                                                            isSkuInvalid && "border-red-500 focus-visible:ring-red-500"
                                                                        )}
                                                                        error={isSkuInvalid ? "SKU is required" : undefined}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span
                                                                    className="text-xs text-muted-foreground line-clamp-2"
                                                                    title={formatSoItemSkuLabel(item)}
                                                                >
                                                                    {formatSoItemSkuLabel(item)}
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center align-top pt-4">
                                                            {activeSO.status === "Draft" ? (
                                                                <Input
                                                                    type="text"
                                                                    readOnly
                                                                    className="h-9 w-full max-w-[88px] mx-auto bg-muted/40 text-center text-xs"
                                                                    value={item.uom || "—"}
                                                                    tabIndex={-1}
                                                                />
                                                            ) : (
                                                                <span className="text-xs">{item.uom || "—"}</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center align-top pt-4">
                                                            <div className="space-y-1">
                                                                {activeSO.status === "Draft" ? (
                                                                    <Input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        value={item.orderedQty}
                                                                        onChange={(e) => {
                                                                            const value = e.target.value.replace(/[^0-9.]/g, '');
                                                                            const parts = value.split('.');
                                                                            const cleanValue = parts[0].slice(0, 12) + (parts.length > 1 ? '.' + parts[1].slice(0, 2) : '');

                                                                            const updated = activeSO.items.map(i =>
                                                                                i.id === item.id ? {
                                                                                    ...i,
                                                                                    orderedQty: parseFloat(cleanValue) || 0,
                                                                                    price: (parseFloat(cleanValue) || 0) * (Number(i.rate) || 0)
                                                                                } : i
                                                                            );
                                                                            setActiveSO({ ...activeSO, items: updated });
                                                                        }}
                                                                        className={cn("h-9 w-24 text-center mx-auto", isQtyInvalid && "border-red-500 focus-visible:ring-red-500")}
                                                                    />
                                                                ) : (
                                                                    <span className="font-bold text-primary">{item.orderedQty}</span>
                                                                )}
                                                                {activeSO.status === "Draft" && isQtyInvalid && (
                                                                    <p className="text-[10px] text-red-500 font-medium">Qty must be greater than 0</p>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center align-top pt-4">
                                                            <div className="space-y-1">
                                                                {activeSO.status === "Draft" ? (
                                                                    <Input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        value={item.rate}
                                                                        onChange={(e) => {
                                                                            const value = e.target.value.replace(/[^0-9.]/g, '');
                                                                            const parts = value.split('.');
                                                                            const cleanValue = parts[0].slice(0, 12) + (parts.length > 1 ? '.' + parts[1].slice(0, 2) : '');

                                                                            const updated = activeSO.items.map(i =>
                                                                                i.id === item.id ? {
                                                                                    ...i,
                                                                                    rate: parseFloat(cleanValue) || 0,
                                                                                    price: (Number(i.orderedQty) || 0) * (parseFloat(cleanValue) || 0)
                                                                                } : i
                                                                            );
                                                                            setActiveSO({ ...activeSO, items: updated });
                                                                        }}
                                                                        className={cn("h-9 w-28 text-center mx-auto", isRateInvalid && "border-red-500 focus-visible:ring-red-500")}
                                                                    />
                                                                ) : (
                                                                    <span className="font-medium">{getCurrencySymbol(activeSO.currency)} {Number(item.rate).toFixed(2)}</span>
                                                                )}
                                                                {activeSO.status === "Draft" && isRateInvalid && (
                                                                    <p className="text-[10px] text-red-500 font-medium">Unit price must be greater than 0</p>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center align-middle">
                                                            <div className="flex h-full items-center justify-center">
                                                                <span className="font-bold text-primary">
                                                                    {getCurrencySymbol(activeSO.currency)} {(Number(item.price) || 0).toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        {/* Dispatched Qty column only shown when status = Dispatched */}
                                                        {activeSO.status === "Dispatched" && (
                                                            <TableCell className="text-center align-middle">
                                                                <div className="flex h-full items-center justify-center">
                                                                    <span className="font-medium text-slate-600">{item.dispatchedQty}</span>
                                                                </div>
                                                            </TableCell>
                                                        )}
                                                        {activeSO.status === "Draft" && (
                                                            <TableCell className="text-center align-middle">
                                                                <div className="flex h-full items-center justify-center">
                                                                    <TableActionButtons
                                                                        onDelete={() => handleRemoveItem(item.id)}
                                                                    />
                                                                </div>
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                                </div>
                            </div>
                        </div>

                        {/* Totals Summary - Discount and Tax with % or Amount support */}
                        {activeSO && activeSO.items.length > 0 && (
                            <div className="flex justify-end">
                                <div className="w-80 space-y-2 p-4 bg-muted/30 rounded-lg border">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-muted-foreground">Subtotal:</span>
                                        <span className="font-bold">{getCurrencySymbol(activeSO.currency)} {(calculateTotals(activeSO.items, activeSO.discountValue || 0, activeSO.discountType || "%", activeSO.taxValue || 0, activeSO.taxType || "%").subtotal || 0).toFixed(2)}</span>
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
                                                            {((paymentDiscountTypes && paymentDiscountTypes.length > 0)
                                                                ? paymentDiscountTypes.map((t: any) => {
                                                                    const name = String(t.name || t.value_name || t.code || t.value_code || "").toUpperCase().trim();
                                                                    return name.includes("PERCENT") || name === "%" ? "%" : "Amount";
                                                                }).filter((v, i, arr) => arr.indexOf(v) === i)
                                                                : ["%", "Amount"]
                                                            ).map((opt) => (
                                                                <SelectItem key={opt} value={opt}>
                                                                    {opt}
                                                                </SelectItem>
                                                            ))}


                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : (
                                                <span className="font-medium">{activeSO.discountValue || 0} {activeSO.discountType === "%" ? "%" : activeSO.currency || "USD"}</span>
                                            )}
                                        </div>
                                        <div className="flex justify-end">
                                            <span className="font-bold text-slate-700 text-sm">-{getCurrencySymbol(activeSO.currency)} {(calculateTotals(activeSO.items, activeSO.discountValue || 0, activeSO.discountType || "%", 0, "%").discountAmount || 0).toFixed(2)}</span>
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
                                                            {((paymentTaxTypes && paymentTaxTypes.length > 0)
                                                                ? paymentTaxTypes.map((t: any) => {
                                                                    const name = String(t.name || t.value_name || t.code || t.value_code || "").toUpperCase().trim();
                                                                    return name.includes("PERCENT") || name === "%" ? "%" : "Amount";
                                                                }).filter((v, i, arr) => arr.indexOf(v) === i)
                                                                : ["%", "Amount"]
                                                            ).map((opt) => (
                                                                <SelectItem key={opt} value={opt}>
                                                                    {opt}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : (
                                                <span className="font-medium">{activeSO.taxValue || 0} {activeSO.taxType === "%" ? "%" : activeSO.currency || "USD"}</span>
                                            )}
                                        </div>
                                        <div className="flex justify-end">
                                            <span className="font-bold text-green-600 text-sm">+{getCurrencySymbol(activeSO.currency)} {(calculateTotals(activeSO.items, activeSO.discountValue || 0, activeSO.discountType || "%", activeSO.taxValue || 0, activeSO.taxType || "%").totalTax || 0).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between text-lg border-t pt-2">
                                        <span className="font-bold">Grand Total:</span>
                                        <span className="font-bold text-primary">{getCurrencySymbol(activeSO.currency)} {(calculateTotals(activeSO.items, activeSO.discountValue || 0, activeSO.discountType || "%", activeSO.taxValue || 0, activeSO.taxType || "%").grandTotal || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Dialog Footer - Buttons based on status */}
                    <DialogFooter className="shrink-0 gap-2 border-t bg-muted/20 p-4 sm:p-5">
                        {/* Status-based button logic enforced here */}
                        {activeSO?.status === "Draft" && (
                            <>
                                <div className="mr-auto">
                                    {canDelete(MODULE_KEY) && activeSO.id && salesOrders.some(so => so.id === activeSO.id) && (
                                        <Button
                                            variant="destructive"
                                            onClick={() => {
                                                setSoToDelete(activeSO);
                                                setIsDeleteAlertOpen(true);
                                            }}
                                            className="gap-2"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                        </Button>
                                    )}
                                </div>
                                <Button variant="outline" onClick={() => setIsSODialogOpen(false)}>Close</Button>
                                <Button
                                    variant="default"
                                    onClick={() => handleSaveSO(false)}
                                    loading={isSavingSO}
                                    className={cn(
                                        "disabled:bg-muted disabled:text-muted-foreground disabled:border-muted disabled:opacity-100",
                                        isFormValid() ? "bg-[#0056B8] text-white hover:bg-[#0056B8]/90" : ""
                                    )}
                                    disabled={!isFormValid() || isFormOpening || isSavingSO || isSubmittingSO}
                                >
                                    Save as Draft
                                </Button>
                                <Button
                                    variant="default"
                                    onClick={() => handleSaveSO(true)}
                                    loading={isSubmittingSO}
                                    className={cn(
                                        "disabled:bg-muted disabled:text-muted-foreground disabled:border-muted disabled:opacity-100",
                                        isFormValid() ? "bg-[#0056B8] text-white hover:bg-[#0056B8]/90" : "bg-emerald-600 hover:bg-emerald-700"
                                    )}
                                    disabled={!isFormValid() || isFormOpening || isSavingSO || isSubmittingSO}
                                >
                                    Submit
                                </Button>
                            </>
                        )}
                        {activeSO?.status === "Invoice Pending" && (
                            <>
                                {canPrint(MODULE_KEY) && (
                                    <div className="flex gap-2 mr-auto">
                                        <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadQuotation}>
                                            <Download className="h-4 w-4" />
                                            Quotation
                                        </Button>
                                    </div>
                                )}
                                <Button variant="outline" onClick={() => setIsSODialogOpen(false)}>Close</Button>
                            </>
                        )}
                        {activeSO?.status === "Dispatch Pending" && (
                            <>
                                {canPrint(MODULE_KEY) && (
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
                                )}
                                <Button variant="outline" onClick={() => setIsSODialogOpen(false)}>Close</Button>
                            </>
                        )}
                        {activeSO?.status === "Dispatched" && (
                            <>
                                {canPrint(MODULE_KEY) && (
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
                                )}
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
                        {activeSO?.status === "Close" && (
                            <>
                                {canPrint(MODULE_KEY) && (
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
                                )}
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
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Code</p>
                                                <p className="text-sm font-semibold text-slate-800">{previewSO.soNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Date</p>
                                                <p className="text-sm font-semibold text-slate-800">{format(new Date(previewSO.soDate), "dd-MM-yyyy")}</p>
                                            </div>
                                            {previewSO.quotationRef && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Quotation Code Reference</p>
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
                                                    <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        SKU
                                                    </th>
                                                    <th className="text-center text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        UOM
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Quantity
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Unit Price
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
                                                        <td className="text-sm text-slate-600 py-3 px-4 border-b border-slate-100">
                                                            {formatSoItemSkuLabel(item)}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-center py-3 px-4 border-b border-slate-100">
                                                            {item.uom || "—"}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {item.orderedQty}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(previewSO.currency)} {Number(item.rate || 0).toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(previewSO.currency)} {Number(item.price || 0).toFixed(2)}
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
                        {canPrint(MODULE_KEY) && (
                            <>
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
                            </>
                        )}
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
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Code</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchPreviewSO.soNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Date</p>
                                                <p className="text-sm font-semibold text-slate-800">{format(new Date(dispatchPreviewSO.soDate), "dd-MM-yyyy")}</p>
                                            </div>
                                            {dispatchPreviewSO.quotationRef && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Quotation Code Reference</p>
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
                                                    <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        SKU
                                                    </th>
                                                    <th className="text-center text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        UOM
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Quantity
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Unit Price
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
                                                        <td className="text-sm text-slate-600 py-3 px-4 border-b border-slate-100">
                                                            {formatSoItemSkuLabel(item)}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-center py-3 px-4 border-b border-slate-100">
                                                            {item.uom || "—"}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {item.orderedQty}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(dispatchPreviewSO.currency)} {Number(item.rate || 0).toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(dispatchPreviewSO.currency)} {Number(item.price || 0).toFixed(2)}
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
                        {canPrint(MODULE_KEY) && (
                            <>
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
                                    disabled={isLoading}
                                >
                                    <Download className="h-4 w-4" />
                                    {isLoading ? "Loading..." : "Invoice"}
                                </Button>
                                {/* Download SO PDF Button - Downloads the Sales Order PDF preview */}
                                <Button
                                    onClick={() => dispatchPreviewSO && handleDownloadSOPDF(dispatchPreviewSO)}
                                    className="gap-2 "
                                >
                                    <Download className="h-4 w-4" />
                                    Download SO PDF
                                </Button>
                            </>
                        )}
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
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Code</p>
                                                <p className="text-sm font-semibold text-slate-800">{dispatchedPreviewSO.soNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Date</p>
                                                <p className="text-sm font-semibold text-slate-800">{format(new Date(dispatchedPreviewSO.soDate), "dd-MM-yyyy")}</p>
                                            </div>
                                            {dispatchedPreviewSO.quotationRef && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Quotation Code Reference</p>
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
                                                    <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        SKU
                                                    </th>
                                                    <th className="text-center text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        UOM
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Quantity
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Unit Price
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
                                                        <td className="text-sm text-slate-600 py-3 px-4 border-b border-slate-100">
                                                            {formatSoItemSkuLabel(item)}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-center py-3 px-4 border-b border-slate-100">
                                                            {item.uom || "—"}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {item.orderedQty}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(dispatchedPreviewSO.currency)} {Number(item.rate || 0).toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(dispatchedPreviewSO.currency)} {Number(item.price || 0).toFixed(2)}
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
                        {canPrint(MODULE_KEY) && (
                            <>
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
                                    disabled={isLoading}
                                >
                                    <Download className="h-4 w-4" />
                                    {isLoading ? "Loading..." : "Invoice"}
                                </Button>
                                {/* Dispatch Note Button - Downloads dispatch note */}
                                <Button
                                    variant="outline"
                                    onClick={() => dispatchedPreviewSO && handleDownloadDispatchNoteFromPreview(dispatchedPreviewSO)}
                                    className="gap-2"
                                    disabled={isLoading}
                                >
                                    <Download className="h-4 w-4" />
                                    {isLoading ? "Loading..." : "Dispatch Note"}
                                </Button>
                                {/* Download SO PDF Button - Downloads the Sales Order PDF preview */}
                                <Button
                                    onClick={() => dispatchedPreviewSO && handleDownloadSOPDF(dispatchedPreviewSO)}
                                    className="gap-2 "
                                >
                                    <Download className="h-4 w-4" />
                                    Download SO PDF
                                </Button>
                            </>
                        )}
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
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Code</p>
                                                <p className="text-sm font-semibold text-slate-800">{closedSOPreviewSO.soNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Date</p>
                                                <p className="text-sm font-semibold text-slate-800">{format(new Date(closedSOPreviewSO.soDate), "dd-MM-yyyy")}</p>
                                            </div>
                                            {closedSOPreviewSO.quotationRef && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Quotation Code Reference</p>
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
                                                    <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        SKU
                                                    </th>
                                                    <th className="text-center text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        UOM
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Quantity
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Unit Price
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
                                                        <td className="text-sm text-slate-600 py-3 px-4 border-b border-slate-100">
                                                            {formatSoItemSkuLabel(item)}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-center py-3 px-4 border-b border-slate-100">
                                                            {item.uom || "—"}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {item.orderedQty}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(closedSOPreviewSO.currency)} {Number(item.rate || 0).toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(closedSOPreviewSO.currency)} {Number(item.price || 0).toFixed(2)}
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
                        {canPrint(MODULE_KEY) && (
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
                                    disabled={isLoading}
                                >
                                    <Download className="h-4 w-4" />
                                    {isLoading ? "Loading..." : "Invoice"}
                                </Button>
                                {/* Dispatch Note Button - Downloads dispatch note */}
                                <Button
                                    variant="outline"
                                    onClick={() => closedSOPreviewSO && handleDownloadDispatchNoteFromPreview(closedSOPreviewSO)}
                                    className="gap-2"
                                    disabled={isLoading}
                                >
                                    <Download className="h-4 w-4" />
                                    {isLoading ? "Loading..." : "Dispatch Note"}
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
                        )}
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
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Code</p>
                                                <p className="text-sm font-semibold text-slate-800">{draftPreviewSO.soNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SO Date</p>
                                                <p className="text-sm font-semibold text-slate-800">{format(new Date(draftPreviewSO.soDate), "dd-MM-yyyy")}</p>
                                            </div>
                                            {draftPreviewSO.quotationRef && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Quotation Code Reference</p>
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
                                                    <th className="text-left text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        SKU
                                                    </th>
                                                    <th className="text-center text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        UOM
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Quantity
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-slate-600 uppercase tracking-wide py-3 px-4 border-b-2 border-slate-200">
                                                        Unit Price
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
                                                        <td className="text-sm text-slate-600 py-3 px-4 border-b border-slate-100">
                                                            {formatSoItemSkuLabel(item)}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-center py-3 px-4 border-b border-slate-100">
                                                            {item.uom || "—"}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {item.orderedQty}
                                                        </td>
                                                        <td className="text-sm text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(draftPreviewSO.currency)} {Number(item.rate || 0).toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-slate-800 text-right py-3 px-4 border-b border-slate-100">
                                                            {getCurrencySymbol(draftPreviewSO.currency)} {Number(item.price || 0).toFixed(2)}
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
                        {canPrint(MODULE_KEY) && (
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
                        )}
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
                        {/* 1. Top Summary - SO Code, Date, Status */}
                        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">SO Code</Label>
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
                                            <TableHead className="font-bold text-[10px] uppercase py-3">SKU</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase py-3 text-center">UOM</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase py-3 text-center">Ordered Qty</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase py-3 text-center">Dispatched Qty</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase py-3 text-right">Unit Price</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase py-3 text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dispatchedEditSO?.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium py-3">{item.itemName}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground py-3">{formatSoItemSkuLabel(item)}</TableCell>
                                                <TableCell className="text-center text-xs uppercase py-3">{item.uom}</TableCell>
                                                <TableCell className="text-center font-medium py-3">{item.orderedQty}</TableCell>
                                                <TableCell className="text-center font-bold text-green-600 py-3">{item.dispatchedQty}</TableCell>
                                                <TableCell className="text-right py-3">${Number(item.rate || 0).toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-bold text-primary py-3">${Number(item.price || 0).toFixed(2)}</TableCell>
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
                                                        <span className="font-medium">{getCurrencySymbol(dispatchedEditSO.currency || "USD")} {subtotal.toFixed(2)}</span>
                                                    </div>
                                                    {discountAmount > 0 && (
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-600">Discount:</span>
                                                            <span className="font-medium text-slate-700">-{getCurrencySymbol(dispatchedEditSO.currency || "USD")} {discountAmount.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-600">Tax:</span>
                                                        <span className="font-medium text-green-600">+{getCurrencySymbol(dispatchedEditSO.currency || "USD")} {totalTax.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-base border-t pt-2 mt-2">
                                                        <span className="font-bold">Grand Total:</span>
                                                        <span className="font-bold text-primary">{getCurrencySymbol(dispatchedEditSO.currency || "USD")} {grandTotal.toFixed(2)}</span>
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
                                                        <span className="font-medium text-green-600">{getCurrencySymbol(dispatchedEditSO.currency || "USD")} {paidAmount.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-base">
                                                        <span className="font-bold">Due Amount:</span>
                                                        <span className={cn(
                                                            "font-bold",
                                                            dueAmount === 0 ? "text-green-600" : "text-orange-600"
                                                        )}>
                                                            {getCurrencySymbol(dispatchedEditSO.currency || "USD")} {dueAmount.toFixed(2)}
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
                            disabled={!canDelete(MODULE_KEY)}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SalesOrder;


