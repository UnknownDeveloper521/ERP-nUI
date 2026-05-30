import { useState, useEffect, useCallback, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateQuotationPDFHTML } from "@/lib/quotationPDFTemplate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandInputBorderless,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Plus,
    ChevronLeft,
    ChevronRight,
    Trash2,
    Calendar as CalendarIcon,
    ChevronDown,
    ChevronsUpDown,
    Check,
    X,
    Download,
    Loader2,
} from "lucide-react";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker as SharedDatePicker } from "@/components/shared/DatePicker";
import { useCommonStore } from "@/store/commonStore";
import { commonApi, salesApi } from "@/lib/api";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import React from "react";
// Updated: Import mock quotation service instead of using localStorage
import {
    getQuotations,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    changeQuotationStatus,
    type QuotationData,
    type QuotationItem,
    type PaymentTerm,
    type QuotationStatus
} from "@/lib/mockQuotations";

// Removed local SearchableSelect - now using SharedSearchableSelect

// Removed local mock dropdown sources; using API-backed customer/item masters.

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "CNY", "AUD", "CAD", "UGX"];
const PAYMENT_TERM_OPTIONS: Array<"Advance" | "Delivery" | "Days"> = ["Advance", "Delivery", "Days"];

const normalizeText = (value: any): string => String(value ?? "").trim().toUpperCase().replace(/[\s_-]/g, "");

const getEntityId = (item: any): number | undefined => {
    const id = item?.id ?? item?.value_id ?? item?.status_id;
    return id != null ? Number(id) : undefined;
};

const parseNumericId = (value: any): number | undefined => {
    if (value == null) return undefined;
    const match = String(value).match(/\d+/);
    if (!match) return undefined;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : undefined;
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

const extractCustomerDetailsForForm = (data: any) => {
    const details = data?.customer_details ?? data?.customer ?? {};
    return {
        name: details?.name ?? details?.customer_name ?? data?.customer_name ?? "",
        contactPerson:
            details?.contact_person_name ??
            details?.contact_person ??
            data?.contact_person_name ??
            "",
        contactNumber:
            details?.contact_number ??
            details?.mobile_no ??
            data?.contact_number ??
            data?.mobile_no ??
            "",
        billingAddress: details?.billing_address ?? data?.billing_address ?? "",
        shippingAddress: details?.shipping_address ?? data?.shipping_address ?? "",
    };
};

const mapTaxTypeAndValue = (data: any): { taxType: "%" | "Amount"; taxValue: number } => {
    const rawType = normalizeText(data?.tax_type_name || data?.tax_type_code || "");
    const hasTaxRate = data?.tax_rate !== null && data?.tax_rate !== undefined;
    const isPercentType = rawType === "%" || rawType.includes("PERCENT");
    const taxType: "%" | "Amount" = (isPercentType || hasTaxRate) ? "%" : "Amount";
    const taxValue = taxType === "%" ? Number(data?.tax_rate || 0) : Number(data?.tax_amount || 0);
    return { taxType, taxValue };
};

type QuotationCustomer = {
    customer_id: number;
    customer_name: string;
    contact_person_name?: string;
    mobile_no?: string;
    email?: string;
    billing_address?: string;
    shipping_address?: string;
};

type QuotationItemMaster = {
    item_id: number;
    item_name: string;
    item_code?: string;
};

const normalizeCustomerRecord = (raw: any): QuotationCustomer | null => {
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
        email: raw.email ?? base.email ?? "",
        billing_address: raw.billing_address ?? base.billing_address ?? "",
        shipping_address: raw.shipping_address ?? base.shipping_address ?? "",
    };
};

const extractCustomerRawRecords = (response: any): any[] => {
    if (!response) return [];

    // Possible API shapes:
    // 1) { data: [ ... ] }
    // 2) { data: { records: [...] } }
    // 3) { data: { customers: [...] } }
    // 4) { data: { customer: {...} } } or { data: { customer: [...] } }
    // 5) [ ... ]
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.records)) return response.records;
    if (Array.isArray(response?.customers)) return response.customers;
    if (Array.isArray(response?.customer)) return response.customer;
    if (response?.customer) return [response.customer];

    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.records)) return response.data.records;
    if (Array.isArray(response?.data?.customers)) return response.data.customers;
    if (Array.isArray(response?.data?.customer)) return response.data.customer;
    if (response?.data?.customer) return [response.data.customer];

    return [];
};

const normalizeItemRecord = (raw: any): QuotationItemMaster | null => {
    if (!raw) return null;
    const base = raw.item && typeof raw.item === "object" ? raw.item : raw;
    const item_id = Number(base.item_id ?? raw.item_id ?? base.id ?? raw.id);
    const item_name = String(
        base.item_name ?? raw.item_name ?? base.name ?? raw.name ?? base.item_code ?? raw.item_code ?? ""
    ).trim();
    const item_code = String(
        base.item_code ?? raw.item_code ?? base.code ?? raw.code ?? ""
    ).trim();
    const item_type_name = String(
        base.item_type_name ?? raw.item_type_name ?? base.item_type?.name ?? raw.item_type?.name ?? ""
    ).trim();
    if (!item_id || !item_name) return null;
    if (normalizeText(item_type_name) !== normalizeText("Finished Goods")) return null;
    return { item_id, item_name, item_code: item_code || undefined };
};

const extractItemRawRecords = (response: any): any[] => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.records)) return response.records;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.item)) return response.item;
    if (response?.item) return [response.item];
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.records)) return response.data.records;
    if (Array.isArray(response?.data?.items)) return response.data.items;
    if (Array.isArray(response?.data?.item)) return response.data.item;
    if (response?.data?.item) return [response.data.item];
    return [];
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getCurrentDateForInput = () => {
    return format(new Date(), "yyyy-MM-dd");
};

const formatDate = (dateStr: string) => {
    try {
        return format(new Date(dateStr), "dd-MM-yyyy");
    } catch {
        return dateStr;
    }
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

const calculateItemAmount = (item: QuotationItem): number => {
    try {
        const qty = parseFloat((item.qty || 0).toString());
        const rate = parseFloat((item.rate || 0).toString());
        return (isNaN(qty) ? 0 : qty) * (isNaN(rate) ? 0 : rate);
    } catch (error) {
        console.error("Error calculating item amount:", error);
        return 0;
    }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Quotations() {
    const { canView, canEdit, canCreate, canDelete, canPrint, isMenuVisible } = useHasPermission();
    const permissionModule = "SALES/QUOTATIONS";

    if (!isMenuVisible(permissionModule)) {
        return <Unauthorized />;
    }

    const { toast } = useToast();
    const quotationStatuses = useCommonStore((state) => state.quotationStatuses) || [];
    const currencies = useCommonStore((state) => state.currencies) || [];
    const paymentTermTypes = useCommonStore((state) => state.paymentTermTypes) || [];
    const paymentTaxTypes = useCommonStore((state) => state.paymentTaxTypes) || [];
    const paymentDiscountTypes = useCommonStore((state) => state.paymentDiscountTypes) || [];
    const itemTypes = useCommonStore((state) => state.itemTypes) || [];
    const entityValues = useCommonStore((state) => state.entityValues) || [];
    const currencyOptions = currencies.length > 0
        ? currencies.map((c: any) => c.code || c.value_code || c.name || c.value_name).filter(Boolean)
        : CURRENCIES;
    const finishedGoodsItemType = itemTypes.find((type: any) => {
        const code = normalizeText(type?.code || type?.value_code || "");
        const name = normalizeText(type?.name || type?.value_name || "");
        return code === "FG" || name === "FINISHEDGOODS";
    });
    const finishedGoodsItemTypeId = getEntityId(finishedGoodsItemType);

    // State - removed localStorage - using mock store
    const [quotations, setQuotations] = useState<QuotationData[]>([]);

    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [hasDefaultedDraft, setHasDefaultedDraft] = useState(false);
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isListLoading, setIsListLoading] = useState(true);
    const [isViewDetailLoading, setIsViewDetailLoading] = useState(false);
    const [isFormOpening, setIsFormOpening] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [openingQuotationId, setOpeningQuotationId] = useState<number | null>(null);

    const filterDateStr = filterDate ? format(filterDate, "yyyy-MM-dd") : "";
    const quotationStatusesCount = quotationStatuses.length;

    const normalizeStatusString = (statusName: string): string => {
        if (!statusName) return "Draft Quote";
        const s = statusName.trim().toUpperCase().replace(/[\s_-]/g, "");
        if (s.includes("SUBMIT")) return "Submitted Quote";
        if (s.includes("DRAFT") || s.includes("DRFT")) return "Draft Quote";
        if (s.includes("EXPIRE")) return "Expired Quotations";
        if (s.includes("CONVERT") || s.includes("SO")) return "Converted to SO";
        return statusName;
    };

    const fetchQuotations = async () => {
        // If we have statuses but haven't set the default Draft yet, skip this fetch
        // to avoid showing "All" records for a split second on page load.
        if (quotationStatuses.length > 0 && !hasDefaultedDraft && filterStatus === "all") {
            return;
        }

        setIsListLoading(true);
        try {
            let statusId = undefined;
            if (filterStatus && filterStatus !== "all") {
                statusId = !isNaN(Number(filterStatus)) ? Number(filterStatus) : filterStatus;
            }
            const dateStr = filterDateStr || undefined;

            let res = await salesApi.getQuotationList({
                search: debouncedSearchTerm,
                date: dateStr,
                status_id: statusId,
                page: currentPage,
                limit: itemsPerPage
            });

            const getRecords = (apiRes: any) => {
                if (apiRes && apiRes.data) {
                    if (Array.isArray(apiRes.data.records)) return apiRes.data.records;
                    if (Array.isArray(apiRes.data)) return apiRes.data;
                }
                return [];
            };

            const finalRecords = getRecords(res);
            const total = res?.data?.pagination?.totalCount ?? res?.data?.pagination?.totalRecords ?? finalRecords.length;

            if (finalRecords.length > 0) {
                const mapped = finalRecords.map((rec: any) => {
                    const mockQ = getQuotations().find(mq => mq.id === rec.id || mq.quotationNo === rec.quotation_code);
                    return {
                        ...(mockQ || {}),
                        id: rec.id,
                        quotationNo: rec.quotation_code,
                        quotationDate: rec.quotation_date,
                        customerName: rec.customer_name,
                        status: (rec.status_name || mockQ?.status || "") as QuotationStatus,
                        statusId: rec.status_id || mockQ?.statusId || undefined,
                        discountAmount: rec.discount_amount || 0,
                        total: rec.total_amount || 0
                    };
                });

                setQuotations(mapped);
                setTotalRecords(total);
            } else {
                setQuotations([]);
                setTotalRecords(0);
            }
        } catch (error) {
            console.error("Error fetching quotations list:", error);
            setQuotations([]);
            setTotalRecords(0);
        } finally {
            setIsListLoading(false);
        }
    };

    useEffect(() => {
        fetchQuotations();
    }, [debouncedSearchTerm, filterDateStr, filterStatus, quotationStatusesCount, currentPage, itemsPerPage]);

    // Handle default status from master data
    useEffect(() => {
        if (!hasDefaultedDraft && quotationStatuses.length > 0) {
            const draftStatus = quotationStatuses.find((s: any) => {
                const name = (s.name || s.value_name || "").toLowerCase();
                return name.includes("draft");
            });

            if (draftStatus) {
                const draftId = String(draftStatus.id || draftStatus.value_id || draftStatus.status_id);
                setFilterStatus(draftId);
                setHasDefaultedDraft(true);
            } else {
                setHasDefaultedDraft(true);
            }
        }
    }, [quotationStatuses, hasDefaultedDraft]);

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [viewingQuotation, setViewingQuotation] = useState<QuotationData | null>(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [quotationToDelete, setQuotationToDelete] = useState<QuotationData | null>(null);
    const [customers, setCustomers] = useState<QuotationCustomer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [quotationItemsMaster, setQuotationItemsMaster] = useState<QuotationItemMaster[]>([]);

    // Track original items & payment terms when editing (for computing delta payloads)
    const [originalItems, setOriginalItems] = useState<QuotationItem[]>([]);
    const [originalPaymentTerms, setOriginalPaymentTerms] = useState<PaymentTerm[]>([]);
    const [originalStatusCode, setOriginalStatusCode] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<QuotationData>>({
        quotationDate: getCurrentDateForInput(),
        customerName: "",
        contactPersonName: "",
        contactNumber: "",
        billingAddress: "",
        shippingAddress: "",
        currency: "",
        paymentTerms: [],
        deliveryTime: getCurrentDateForInput(),
        quotationValidity: getCurrentDateForInput(),
        remarks: "",
        items: [],
        status: "Draft Quote",
        discountValue: 0,
        discountType: "%",
        taxValue: 0,
        taxType: "%",
        taxPercentage: 0,
        subtotal: 0,
        taxAmount: 0,
        total: 0
    });

    // Reset form
    const resetForm = () => {
        setFormData({
            quotationDate: getCurrentDateForInput(),
            customerName: "",
            contactPersonName: "",
            contactNumber: "",
            billingAddress: "",
            shippingAddress: "",
            currency: "",
            paymentTerms: [],
            deliveryTime: getCurrentDateForInput(),
            quotationValidity: getCurrentDateForInput(),
            remarks: "",
            items: [],
            status: "Draft Quote",
            discountValue: 0,
            discountType: "%",
            taxValue: 0,
            taxType: "%",
            taxPercentage: 0,
            subtotal: 0,
            taxAmount: 0,
            total: 0
        });
        setEditingId(null);
        setSelectedCustomerId(null);
        setOriginalItems([]);
        setOriginalPaymentTerms([]);
        setOriginalStatusCode(null);
    };

    const loadFormCustomers = async () => {
        try {
            const res = await commonApi.getCustomerWithDetails();
            if (!res?.isSuccessful) {
                toast({
                    title: "Customer Load Failed",
                    description: res?.message || "Unable to load customer details.",
                    variant: "destructive",
                });
                return;
            }

            const rawRecords = extractCustomerRawRecords(res?.data);

            const normalizedRecords = rawRecords
                .map(normalizeCustomerRecord)
                .filter((customer): customer is QuotationCustomer => Boolean(customer));

            // Remove duplicates by customer_id
            const deduped = Array.from(new Map(normalizedRecords.map((c) => [c.customer_id, c])).values());
            setCustomers(deduped);
        } catch (error) {
            console.error("Error loading customers with details:", error);
            toast({
                title: "Customer Load Failed",
                description: "Unable to load customer details.",
                variant: "destructive",
            });
        }
    };

    const loadFormItems = async (itemTypeId: number) => {
        try {
            const res = await commonApi.getItemsDropdown({ item_type_id: itemTypeId, status: 1 });
            if (!res?.isSuccessful) {
                toast({
                    title: "Item Load Failed",
                    description: res?.message || "Unable to load items.",
                    variant: "destructive",
                });
                return;
            }
            const rawRecords = extractItemRawRecords(res?.data);
            const normalizedRecords = rawRecords
                .map(normalizeItemRecord)
                .filter((item): item is QuotationItemMaster => Boolean(item));
            const deduped = Array.from(new Map(normalizedRecords.map((i) => [i.item_id, i])).values());
            setQuotationItemsMaster(deduped);
        } catch (error) {
            console.error("Error loading items:", error);
            toast({
                title: "Item Load Failed",
                description: "Unable to load items.",
                variant: "destructive",
            });
        }
    };

    useEffect(() => {
        if (isFormModalOpen) {
            loadFormCustomers();
            if (finishedGoodsItemTypeId) {
                loadFormItems(finishedGoodsItemTypeId);
            }
        }
    }, [isFormModalOpen, finishedGoodsItemTypeId]);

    // Helper to check if form is valid for submission/saving
    const isFormValid = () => {
        const hasBasicFields = !!(
            formData.customerName && 
            formData.billingAddress && 
            formData.contactNumber &&
            formData.quotationValidity &&
            formData.deliveryTime &&
            formData.currency &&
            (formData.paymentTerms || []).length > 0 &&
            (formData.items || []).length > 0
        );

        if (!hasBasicFields) return false;

        const hasInvalidTerms = (formData.paymentTerms || []).some(term => {
            if (term.terms === "Days") {
                const days = parseInt(String(term.days || "0"));
                return isNaN(days) || days <= 0;
            }
            return false;
        });

        if (hasInvalidTerms) return false;

        // Validation for Items
        const itemNames = (formData.items || []).map(i => i.item).filter(Boolean);
        const hasDuplicates = new Set(itemNames).size !== itemNames.length;
        if (hasDuplicates) return false;

        const hasInvalidItems = (formData.items || []).some(item => {
            const qty = parseFloat(item.qty.toString());
            const rate = parseFloat(item.rate.toString());
            return !item.item || isNaN(qty) || qty <= 0 || isNaN(rate) || rate <= 0;
        });

        return !hasInvalidItems;
    };

    // Handle customer selection
    const handleCustomerSelect = (customerName: string) => {
        try {
            const customer = customers.find(c => c.customer_name === customerName);
            if (customer) {
                setSelectedCustomerId(customer.customer_id);
                setFormData({
                    ...formData,
                    customerName: customer.customer_name || "",
                    contactPersonName: customer.contact_person_name || "",
                    contactNumber: customer.mobile_no || "",
                    billingAddress: customer.billing_address || "",
                    shippingAddress: customer.shipping_address || ""
                });
            } else {
                // Customer not found - show error
                toast({
                    title: "Error",
                    description: "An error occurred while selecting the customer. Please try again.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Error selecting customer:", error);
            toast({
                title: "Error",
                description: "An error occurred while selecting the customer. Please try again.",
                variant: "destructive"
            });
        }
    };

    // Item handlers
    const handleAddItem = () => {
        const newItem: QuotationItem = {
            id: Date.now(),
            itemCode: "",
            item: "",
            qty: 1,
            rate: 0,
            amount: 0
        };
        setFormData({ ...formData, items: [...(formData.items || []), newItem] });
    };

    const handleRemoveItem = (id: number) => {
        setFormData({ ...formData, items: formData.items?.filter(item => item.id !== id) });
    };

    const handleItemChange = (id: number, field: keyof QuotationItem, value: any) => {
        const updatedItems = formData.items?.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                
                // If item name is changed, also update itemCode
                if (field === 'item') {
                    const selectedItem = quotationItemsMaster.find((i) => i.item_name === value);
                    if (selectedItem) {
                        updated.itemCode = String(selectedItem.item_id);
                    }
                }
                
                updated.amount = calculateItemAmount(updated);
                return updated;
            }
            return item;
        });
        setFormData({ ...formData, items: updatedItems });
    };

    // Payment term handlers
    // Add payment term with support for both Percentage and Fixed Amount
    const handleAddPaymentTerm = () => {
        // Get all term types that are already used
        const usedTermTypes = formData.paymentTerms?.map(t => t.terms) || [];

        // Find the first available term type
        let defaultTermType: "Advance" | "Delivery" | "Days" = "Advance";
        if (usedTermTypes.includes("Advance")) {
            defaultTermType = "Delivery";
        }
        if (usedTermTypes.includes("Delivery")) {
            defaultTermType = "Days";
        }

        // Create new term with default value as percentage
        const newTerm: PaymentTerm = {
            id: Date.now(),
            value: 0, // Default value (percentage 0-100)
            percentage: 0, // Kept for backward compatibility
            terms: defaultTermType,
            date: ""
        };
        setFormData({ ...formData, paymentTerms: [...(formData.paymentTerms || []), newTerm] });
    };

    const handleRemovePaymentTerm = (id: number) => {
        setFormData({ ...formData, paymentTerms: formData.paymentTerms?.filter(term => term.id !== id) });
    };

    const handlePaymentTermChange = (id: number, field: keyof PaymentTerm, value: any) => {
        const updatedTerms = formData.paymentTerms?.map(term => {
            if (term.id === id) {
                return { ...term, [field]: value };
            }
            return term;
        });
        setFormData({ ...formData, paymentTerms: updatedTerms });
    };

    const calculatePaymentTermsTotal = () => {
        return (formData.paymentTerms || []).reduce((sum, term) => sum + term.percentage, 0);
    };

    // Calculate totals - Support for both discount and tax as % or Amount (matching Sales Order)
    const calculateTotals = () => {
        try {
            const items = formData.items || [];
            const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
            
            // Calculate discount
            let discountAmount = 0;
            if (formData.discountType === "%") {
                discountAmount = (subtotal * (formData.discountValue || 0)) / 100;
            } else {
                discountAmount = formData.discountValue || 0;
            }
            
            const afterDiscount = subtotal - discountAmount;
            
            // Calculate tax - can be % or fixed amount
            let taxAmount = 0;
            if (formData.taxType === "%") {
                taxAmount = (afterDiscount * (formData.taxValue || 0)) / 100;
            } else {
                taxAmount = formData.taxValue || 0;
            }
            
            const total = afterDiscount + taxAmount;
            return { subtotal, discountAmount, afterDiscount, taxAmount, total };
        } catch (error) {
            console.error("Error calculating totals:", error);
            return { subtotal: 0, discountAmount: 0, afterDiscount: 0, taxAmount: 0, total: 0 };
        }
    };

    // Generate quotation number
    const generateQuotationNo = () => {
        const year = new Date().getFullYear();
        const count = quotations.length + 1;
        return `QT-${year}-${String(count).padStart(3, '0')}`;
    };

    // Save quotation (Draft) - removed localStorage - using mock store
    const handleSave = async () => {
        if (isRowActionBusy) return;

        if (!formData.customerName) {
            toast({
                title: "Please Check",
                description: "Customer name is required",
                variant: "destructive"
            });
            return;
        }

        if (!formData.billingAddress) {
            toast({
                title: "Please Check",
                description: "Billing Address is required",
                variant: "destructive"
            });
            return;
        }

        // Validation: Check if terms exist
        if (formData.paymentTerms && formData.paymentTerms.length > 0) {
            // Validation: Total percentage must equal 100%
            const totalPercentage = formData.paymentTerms.reduce((sum, term) => sum + term.percentage, 0);
            if (totalPercentage !== 100) {
                toast({
                    title: "Please Check",
                    description: "Total payment percentage must equal 100%.",
                    variant: "destructive"
                });
                return;
            }

            // Validation: Check for zero percentage terms
            const hasZeroPercentage = formData.paymentTerms.some(term => term.percentage === 0);
            if (hasZeroPercentage) {
                toast({
                    title: "Please Check",
                    description: "Payment percentage cannot be 0%.",
                    variant: "destructive"
                });
                return;
            }
        }

        if (formData.contactNumber && !/^\d{10,11}$/.test(formData.contactNumber)) {
            toast({
                title: "Please Check",
                description: "Contact number must be 10 or 11 digits",
                variant: "destructive"
            });
            return;
        }

        const totals = calculateTotals();
        
        // Determine status: if editing a Submitted Quote, keep it as Submitted Quote
        const status = (editingId && formData.status === "Submitted Quote") ? "Submitted Quote" : "Draft Quote";
        
        const quotationData: QuotationData = {
            id: editingId || Date.now(),
            quotationNo: editingId ? (formData.quotationNo || "") : "",
            quotationDate: formData.quotationDate!,
            customerName: formData.customerName!,
            contactPersonName: formData.contactPersonName || "",
            contactNumber: formData.contactNumber || "",
            billingAddress: formData.billingAddress || "",
            shippingAddress: formData.shippingAddress || "",
            currency: formData.currency || "UGX",
            paymentTerms: formData.paymentTerms || [],
            deliveryTime: formData.deliveryTime || "",
            quotationValidity: formData.quotationValidity || "30 days",
            remarks: formData.remarks || "",
            items: formData.items || [],
            status: status,
            discountValue: formData.discountValue || 0,
            discountType: formData.discountType || "%",
            taxType: formData.taxType || "%",
            taxValue: formData.taxValue || 0,
            taxPercentage: formData.taxValue || 0, // Kept for backward compatibility
            ...totals
        };

        // Construct exact API Payload for saving draft
        const customer_id = selectedCustomerId ?? customers.find(c => c.customer_name === formData.customerName)?.customer_id;

        const currencyMatch = findByCodePriority(currencies, [formData.currency || "UGX"], formData.currency || "UGX");
        const currency_id = getEntityId(currencyMatch);

        const discountTypeRecords = paymentDiscountTypes.length > 0
            ? paymentDiscountTypes
            : entityValues.filter(v => (v.entity_type_code || "").toUpperCase() === "PAYMENT_DISCOUNT_TYPE");
        const discTypeMatch = findByCodePriority(
            discountTypeRecords,
            getPercentOrAmountCodes(formData.discountType || "%"),
            formData.discountType || "%"
        );
        const discount_type_id = getEntityId(discTypeMatch) || 2;
        const discount_percent = formData.discountType === "%" ? formData.discountValue || 0 : 0;
        const discount_amount = formData.discountType === "Amount" ? formData.discountValue || 0 : totals.discountAmount || 0;

        const taxTypeRecords = paymentTaxTypes.length > 0
            ? paymentTaxTypes
            : entityValues.filter(v => (v.entity_type_code || "").toUpperCase() === "PAYMENT_TAX_TYPE");
        const taxTypeMatch = findByCodePriority(
            taxTypeRecords,
            getPercentOrAmountCodes(formData.taxType || "%"),
            formData.taxType || "%"
        );
        const tax_type_id = getEntityId(taxTypeMatch) || 1;
        const tax_rate = formData.taxType === "%" ? formData.taxValue || 0 : 0;
        const tax_amount = totals.taxAmount || 0;

        const apiItems = (formData.items || []).map(item => {
            const item_id = parseNumericId(item.itemCode) ?? quotationItemsMaster.find((i) => i.item_name === item.item)?.item_id;
            return {
                item_id,
                quantity: typeof item.qty === 'string' ? parseFloat(item.qty) || 1 : item.qty || 1,
                unit_price: typeof item.rate === 'string' ? parseFloat(item.rate) || 0 : item.rate || 0
            };
        });

        const apiPaymentTerms = (formData.paymentTerms || []).map(term => {
            const paymentTermRecords = paymentTermTypes.length > 0
                ? paymentTermTypes
                : entityValues.filter(v => (v.entity_type_code || "").toUpperCase() === "PAYMENT_TERM_TYPE");
            const ptMatch = findByCodePriority(paymentTermRecords, getPaymentTermCodes(term.terms), term.terms);
            const term_type_id = getEntityId(ptMatch);
            return {
                term_type_id,
                percentage: typeof term.percentage === 'string' ? parseFloat(term.percentage) || 0 : term.percentage || 0,
                days: term.days || (term.terms === "Days" ? 30 : null)
            };
        });

        if (!customer_id || !currency_id || !discount_type_id || !tax_type_id) {
            toast({
                title: "Master Mapping Missing",
                description: "Customer, currency, discount type, or tax type ID could not be resolved from master data.",
                variant: "destructive"
            });
            return;
        }
        if (apiItems.some((item) => !item.item_id)) {
            toast({
                title: "Item Mapping Missing",
                description: "One or more item IDs could not be resolved.",
                variant: "destructive"
            });
            return;
        }
        if (apiPaymentTerms.some((term) => !term.term_type_id)) {
            toast({
                title: "Payment Term Mapping Missing",
                description: "One or more payment term type IDs could not be resolved from master data.",
                variant: "destructive"
            });
            return;
        }

        const apiPayload = {
            quotation_date: formData.quotationDate ? `${formData.quotationDate}T00:00:00Z` : new Date().toISOString(),
            customer_id,
            currency_id,
            quotation_validity: formData.quotationValidity ? `${formData.quotationValidity}T00:00:00Z` : new Date().toISOString(),
            expected_delivery_date: formData.deliveryTime || format(new Date(), "yyyy-MM-dd"),
            remarks: formData.remarks || "",
            discount_type_id,
            discount_percent,
            discount_amount,
            tax_type_id,
            tax_rate,
            tax_amount,
            items: apiItems,
            payment_terms: apiPaymentTerms
        };

        setIsSaving(true);
        try {
            if (editingId) {
                // --- PATCH: Update existing quotation with delta payload ---
                const itemsToAdd: any[] = [];
                const itemsToUpdate: any[] = [];
                const itemsToDelete: any[] = [];

                (formData.items || []).forEach(item => {
                    const apiItem = {
                        item_id: parseNumericId(item.itemCode) ?? quotationItemsMaster.find((i) => i.item_name === item.item)?.item_id,
                        quantity: typeof item.qty === 'string' ? parseFloat(item.qty) || 1 : item.qty || 1,
                        unit_price: typeof item.rate === 'string' ? parseFloat(item.rate) || 0 : item.rate || 0
                    };
                    const isOriginal = originalItems.find(oi => oi.id === item.id);
                    if (isOriginal) {
                        itemsToUpdate.push({ id: isOriginal.id, ...apiItem });
                    } else {
                        itemsToAdd.push(apiItem);
                    }
                });

                originalItems.forEach(oi => {
                    const isStillPresent = (formData.items || []).some(fi => fi.id === oi.id);
                    if (!isStillPresent) {
                        itemsToDelete.push(oi.id);
                    }
                });

                const ptToAdd: any[] = [];
                const ptToEdit: any[] = [];
                const ptToDelete: any[] = [];

                (formData.paymentTerms || []).forEach(term => {
                    const paymentTermRecords = paymentTermTypes.length > 0
                        ? paymentTermTypes
                        : entityValues.filter(v => (v.entity_type_code || "").toUpperCase() === "PAYMENT_TERM_TYPE");
                    const ptMatch = findByCodePriority(paymentTermRecords, getPaymentTermCodes(term.terms), term.terms);
                    const term_type_id = getEntityId(ptMatch);

                    const apiPT = {
                        term_type_id,
                        percentage: typeof term.percentage === 'string' ? parseFloat(term.percentage) || 0 : term.percentage || 0,
                        days: term.days || (term.terms === "Days" ? 30 : null)
                    };

                    const isOriginal = originalPaymentTerms.find(opt => opt.id === term.id);
                    if (isOriginal) {
                        ptToEdit.push({ id: isOriginal.id, ...apiPT });
                    } else {
                        ptToAdd.push(apiPT);
                    }
                });

                originalPaymentTerms.forEach(opt => {
                    const isStillPresent = (formData.paymentTerms || []).some(ft => ft.id === opt.id);
                    if (!isStillPresent) {
                        ptToDelete.push(opt.id);
                    }
                });

                const statusMatch = quotationStatuses.find((s: any) => s.name === formData.status || s.value_name === formData.status);
                const status_code = statusMatch?.code || statusMatch?.value_code || originalStatusCode || quotationStatuses.find((s: any) => (s.code || s.value_code || "").toUpperCase().includes("DRFT"))?.code;

                const updatePayload: any = {
                    status_code,
                    quotation_date: apiPayload.quotation_date,
                    customer_id: apiPayload.customer_id,
                    currency_id: apiPayload.currency_id,
                    quotation_validity: apiPayload.quotation_validity,
                    expected_delivery_date: apiPayload.expected_delivery_date,
                    remarks: apiPayload.remarks,
                    discount_type_id: apiPayload.discount_type_id,
                    discount_percent: apiPayload.discount_percent,
                    discount_amount: apiPayload.discount_amount,
                    tax_type_id: apiPayload.tax_type_id,
                    tax_rate: apiPayload.tax_rate,
                    tax_amount: apiPayload.tax_amount,
                    payment_terms: {
                        add: ptToAdd,
                        edit: ptToEdit,
                        update: ptToEdit,
                        delete: ptToDelete
                    },
                    items: {
                        add: itemsToAdd,
                        edit: itemsToUpdate,
                        update: itemsToUpdate,
                        delete: itemsToDelete
                    },
                };

                const res = await salesApi.updateQuotation(editingId, updatePayload);
                if (res.isSuccessful) {
                    toast({
                        title: "Success",
                        description: res.message || "Quotation updated as draft",
                        variant: "success"
                    });
                } else {
                    toast({
                        title: "Update Failed",
                        description: res.message || "Failed to update quotation.",
                        variant: "destructive"
                    });
                }
            } else {
                // --- POST: Create new quotation ---
                const res = await salesApi.saveDraft(apiPayload);
                if (res.isSuccessful) {
                    if (res.data?.id) {
                        quotationData.id = res.data.id;
                    }
                    toast({
                        title: "Success",
                        description: res.message || "Quotation saved as draft",
                        variant: "success"
                    });
                } else {
                    toast({
                        title: "Save Failed",
                        description: res.message || "Failed to save quotation as draft.",
                        variant: "destructive"
                    });
                }
            }
        } catch (error) {
            console.error("Error saving quotation to API:", error);
            toast({
                title: "Save Failed",
                description: "An error occurred while saving the quotation.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }

        if (editingId) {
            updateQuotation(editingId, quotationData);
        } else {
            createQuotation(quotationData);
        }

        setQuotations(getQuotations()); // Refresh list
        fetchQuotations();
        setIsFormModalOpen(false);
        resetForm();
    };

    // Submit quotation - removed localStorage - using mock store
    const handleSubmit = async () => {
        if (isRowActionBusy) return;

        if (!formData.customerName) {
            toast({
                title: "Please Check",
                description: "Customer name is required",
                variant: "destructive"
            });
            return;
        }

        if (!formData.billingAddress) {
            toast({
                title: "Please Check",
                description: "Billing Address is required",
                variant: "destructive"
            });
            return;
        }

        // Validation: Check if terms exist
        if (formData.paymentTerms && formData.paymentTerms.length > 0) {
            // Validation: Total percentage must equal 100%
            const totalPercentage = formData.paymentTerms.reduce((sum, term) => sum + term.percentage, 0);
            if (totalPercentage !== 100) {
                toast({
                    title: "Please Check",
                    description: "Total payment percentage must equal 100%.",
                    variant: "destructive"
                });
                return;
            }

            // Validation: Check for zero percentage terms
            const hasZeroPercentage = formData.paymentTerms.some(term => term.percentage === 0);
            if (hasZeroPercentage) {
                toast({
                    title: "Please Check",
                    description: "Payment percentage cannot be 0%.",
                    variant: "destructive"
                });
                return;
            }
        }

        if (formData.contactNumber && !/^\d{10,11}$/.test(formData.contactNumber)) {
            toast({
                title: "Please Check",
                description: "Contact number must be 10 or 11 digits",
                variant: "destructive"
            });
            return;
        }

        if (!formData.items || formData.items.length === 0) {
            toast({
                title: "Please Check",
                description: "At least one item is required",
                variant: "destructive"
            });
            return;
        }

        const totals = calculateTotals();
        const quotationData: QuotationData = {
            id: editingId || Date.now(),
            quotationNo: editingId ? (formData.quotationNo || generateQuotationNo()) : generateQuotationNo(),
            quotationDate: formData.quotationDate!,
            customerName: formData.customerName!,
            contactPersonName: formData.contactPersonName || "",
            contactNumber: formData.contactNumber || "",
            billingAddress: formData.billingAddress || "",
            shippingAddress: formData.shippingAddress || "",
            currency: formData.currency || "UGX",
            paymentTerms: formData.paymentTerms || [],
            deliveryTime: formData.deliveryTime || "",
            quotationValidity: formData.quotationValidity || "30 days",
            remarks: formData.remarks || "",
            items: formData.items || [],
            status: "Submitted Quote",
            discountValue: formData.discountValue || 0,
            discountType: formData.discountType || "%",
            taxType: formData.taxType || "%",
            taxValue: formData.taxValue || 0,
            taxPercentage: formData.taxValue || 0, // Kept for backward compatibility
            ...totals
        };

        // Construct exact API Payload for submission
        const customer_id = selectedCustomerId ?? customers.find(c => c.customer_name === formData.customerName)?.customer_id;

        const currencyMatch = findByCodePriority(currencies, [formData.currency || "UGX"], formData.currency || "UGX");
        const currency_id = getEntityId(currencyMatch);

        const discountTypeRecords = paymentDiscountTypes.length > 0
            ? paymentDiscountTypes
            : entityValues.filter(v => (v.entity_type_code || "").toUpperCase() === "PAYMENT_DISCOUNT_TYPE");
        const discTypeMatch = findByCodePriority(
            discountTypeRecords,
            getPercentOrAmountCodes(formData.discountType || "%"),
            formData.discountType || "%"
        );
        const discount_type_id = getEntityId(discTypeMatch);
        const discount_percent = formData.discountType === "%" ? formData.discountValue || 0 : 0;
        const discount_amount = formData.discountType === "Amount" ? formData.discountValue || 0 : totals.discountAmount || 0;

        const taxTypeRecords = paymentTaxTypes.length > 0
            ? paymentTaxTypes
            : entityValues.filter(v => (v.entity_type_code || "").toUpperCase() === "PAYMENT_TAX_TYPE");
        const taxTypeMatch = findByCodePriority(
            taxTypeRecords,
            getPercentOrAmountCodes(formData.taxType || "%"),
            formData.taxType || "%"
        );
        const tax_type_id = getEntityId(taxTypeMatch);
        const tax_rate = formData.taxType === "%" ? formData.taxValue || 0 : 0;
        const tax_amount = totals.taxAmount || 0;

        const apiItems = (formData.items || []).map(item => {
            const item_id = parseNumericId(item.itemCode) ?? quotationItemsMaster.find((i) => i.item_name === item.item)?.item_id;
            return {
                item_id,
                quantity: typeof item.qty === 'string' ? parseFloat(item.qty) || 1 : item.qty || 1,
                unit_price: typeof item.rate === 'string' ? parseFloat(item.rate) || 0 : item.rate || 0
            };
        });

        const apiPaymentTerms = (formData.paymentTerms || []).map(term => {
            const paymentTermRecords = paymentTermTypes.length > 0
                ? paymentTermTypes
                : entityValues.filter(v => (v.entity_type_code || "").toUpperCase() === "PAYMENT_TERM_TYPE");
            const ptMatch = findByCodePriority(paymentTermRecords, getPaymentTermCodes(term.terms), term.terms);
            const term_type_id = getEntityId(ptMatch);
            return {
                term_type_id,
                percentage: typeof term.percentage === 'string' ? parseFloat(term.percentage) || 0 : term.percentage || 0,
                days: term.days || (term.terms === "Days" ? 30 : null)
            };
        });


        if (apiItems.some((item) => !item.item_id)) {
            toast({
                title: "Item Mapping Missing",
                description: "One or more item IDs could not be resolved.",
                variant: "destructive"
            });
            return;
        }
        if (apiPaymentTerms.some((term) => !term.term_type_id)) {
            toast({
                title: "Payment Term Mapping Missing",
                description: "One or more payment term type IDs could not be resolved from master data.",
                variant: "destructive"
            });
            return;
        }

        const apiPayload = {
            quotation_date: formData.quotationDate ? `${formData.quotationDate}T00:00:00Z` : new Date().toISOString(),
            customer_id,
            currency_id,
            quotation_validity: formData.quotationValidity ? `${formData.quotationValidity}T00:00:00Z` : new Date().toISOString(),
            expected_delivery_date: formData.deliveryTime || format(new Date(), "yyyy-MM-dd"),
            remarks: formData.remarks || "",
            discount_type_id,
            discount_percent,
            discount_amount,
            tax_type_id,
            tax_rate,
            tax_amount,
            items: apiItems,
            payment_terms: apiPaymentTerms
        };

        setIsSubmitting(true);
        try {
            if (editingId) {
                // --- PATCH: Update/Submit existing quotation with delta payload ---
                const itemsToAdd: any[] = [];
                const itemsToUpdate: any[] = [];
                const itemsToDelete: any[] = [];

                (formData.items || []).forEach(item => {
                    const apiItem = {
                        item_id: parseNumericId(item.itemCode) ?? quotationItemsMaster.find((i) => i.item_name === item.item)?.item_id,
                        quantity: typeof item.qty === 'string' ? parseFloat(item.qty) || 1 : item.qty || 1,
                        unit_price: typeof item.rate === 'string' ? parseFloat(item.rate) || 0 : item.rate || 0
                    };
                    const isOriginal = originalItems.find(oi => oi.id === item.id);
                    if (isOriginal) {
                        itemsToUpdate.push({ id: isOriginal.id, ...apiItem });
                    } else {
                        itemsToAdd.push(apiItem);
                    }
                });

                originalItems.forEach(oi => {
                    const isStillPresent = (formData.items || []).some(fi => fi.id === oi.id);
                    if (!isStillPresent) {
                        itemsToDelete.push(oi.id);
                    }
                });

                const ptToAdd: any[] = [];
                const ptToEdit: any[] = [];
                const ptToDelete: any[] = [];

                (formData.paymentTerms || []).forEach(term => {
                    const paymentTermRecords = paymentTermTypes.length > 0
                        ? paymentTermTypes
                        : entityValues.filter(v => (v.entity_type_code || "").toUpperCase() === "PAYMENT_TERM_TYPE");
                    const ptMatch = findByCodePriority(paymentTermRecords, getPaymentTermCodes(term.terms), term.terms);
                    const term_type_id = getEntityId(ptMatch);

                    const apiPT = {
                        term_type_id,
                        percentage: typeof term.percentage === 'string' ? parseFloat(term.percentage) || 0 : term.percentage || 0,
                        days: term.days || (term.terms === "Days" ? 30 : null)
                    };

                    const isOriginal = originalPaymentTerms.find(opt => opt.id === term.id);
                    if (isOriginal) {
                        ptToEdit.push({ id: isOriginal.id, ...apiPT });
                    } else {
                        ptToAdd.push(apiPT);
                    }
                });

                originalPaymentTerms.forEach(opt => {
                    const isStillPresent = (formData.paymentTerms || []).some(ft => ft.id === opt.id);
                    if (!isStillPresent) {
                        ptToDelete.push(opt.id);
                    }
                });

                const updatePayload: any = {
                    status_code: "SUBMITTED_QUOTE",
                    quotation_date: apiPayload.quotation_date,
                    customer_id: apiPayload.customer_id,
                    currency_id: apiPayload.currency_id,
                    quotation_validity: apiPayload.quotation_validity,
                    expected_delivery_date: apiPayload.expected_delivery_date,
                    remarks: apiPayload.remarks,
                    discount_type_id: apiPayload.discount_type_id,
                    discount_percent: apiPayload.discount_percent,
                    discount_amount: apiPayload.discount_amount,
                    tax_type_id: apiPayload.tax_type_id,
                    tax_rate: apiPayload.tax_rate,
                    tax_amount: apiPayload.tax_amount,
                    payment_terms: {
                        add: ptToAdd,
                        edit: ptToEdit,
                        update: ptToEdit,
                        delete: ptToDelete
                    },
                    items: {
                        add: itemsToAdd,
                        edit: itemsToUpdate,
                        update: itemsToUpdate,
                        delete: itemsToDelete
                    },
                };

                const res = await salesApi.updateQuotation(editingId, updatePayload);
                if (res.isSuccessful) {
                    if (res.data?.id) {
                        quotationData.id = res.data.id;
                    }
                    toast({
                        title: "Success",
                        description: res.message || "Quotation submitted successfully",
                        variant: "success"
                    });
                } else {
                    toast({
                        title: "Submit Failed",
                        description: res.message || "Failed to submit quotation.",
                        variant: "destructive"
                    });
                }
            } else {
                // --- POST: Create new quotation ---
                const res = await salesApi.submitQuotation(apiPayload);
                if (res.isSuccessful) {
                    if (res.data?.id) {
                        quotationData.id = res.data.id;
                    }
                    toast({
                        title: "Success",
                        description: res.message || "Quotation submitted successfully",
                        variant: "success"
                    });
                } else {
                    toast({
                        title: "Submit Failed",
                        description: res.message || "Failed to submit quotation.",
                        variant: "destructive"
                    });
                }
            }
        } catch (error) {
            console.error("Error submitting quotation to API:", error);
            toast({
                title: "Submit Failed",
                description: "An error occurred while submitting the quotation.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }

        if (editingId) {
            updateQuotation(editingId, { ...quotationData, status: "Submitted Quote" });
        } else {
            createQuotation({ ...quotationData, status: "Submitted Quote" });
        }


        setQuotations(getQuotations()); // Refresh list
        fetchQuotations();
        setIsFormModalOpen(false);
        resetForm();
    };

    // Handle view - fetches full details from API for PDF document
    const handleView = async (quotation: QuotationData) => {
        if (isRowActionBusy) return;
        setOpeningQuotationId(quotation.id);
        setIsViewDetailLoading(true);
        setViewingQuotation(null);
        setIsViewModalOpen(true);
        try {
            const res = await salesApi.getQuotationById(quotation.id);
            if (res.isSuccessful && res.data) {
                const d = res.data;

                const mappedItems: QuotationItem[] = (d.items || []).map((apiItem: any) => ({
                    id: apiItem.id,
                    itemCode: String(apiItem.item_id),
                    item: apiItem.item_name || "",
                    qty: apiItem.quantity || 0,
                    rate: apiItem.unit_price || 0,
                    amount: apiItem.price_per_item || ((apiItem.quantity || 0) * (apiItem.unit_price || 0)),
                }));

                const mappedPaymentTerms: PaymentTerm[] = (d.payment_terms || []).map((apiTerm: any) => {
                    let termName: "Advance" | "Delivery" | "Days" = "Advance";
                    const rawName = normalizeText(apiTerm.term_type_name || apiTerm.term_type_code || "");
                    if (rawName === "ADVANCE") termName = "Advance";
                    else if (rawName === "DELIVERY") termName = "Delivery";
                    else if (rawName === "DAY" || rawName === "DAYS") termName = "Days";
                    return {
                        id: apiTerm.id,
                        value: apiTerm.percentage || 0,
                        percentage: apiTerm.percentage || 0,
                        terms: termName,
                        date: "",
                        days: apiTerm.days || undefined,
                    };
                });

                const discType: "%" | "Amount" = (d.discount_type_name === "%" ? "%" : "Amount");
                const discValue = discType === "%" ? (d.discount_percent || 0) : (d.discount_amount || 0);

                const { taxType: txType, taxValue: txValue } = mapTaxTypeAndValue(d);
                const customerDetails = extractCustomerDetailsForForm(d);

                const statusMatch = quotationStatuses.find((s: any) =>
                    (s.id || s.value_id || s.status_id) === d.status_id
                );
                const statusName = (statusMatch?.name || statusMatch?.value_name || quotation.status || "Draft Quote") as QuotationStatus;

                const completeQuotation: QuotationData = {
                    id: d.id || quotation.id,
                    quotationNo: d.quotation_code || quotation.quotationNo,
                    quotationDate: d.quotation_date || quotation.quotationDate,
                    customerName: customerDetails.name || quotation.customerName,
                    contactPersonName: customerDetails.contactPerson,
                    contactNumber: customerDetails.contactNumber,
                    billingAddress: customerDetails.billingAddress,
                    shippingAddress: customerDetails.shippingAddress,
                    currency: (() => {
                        const currMatch = currencies.find((c: any) => (c.id || c.value_id) === d.currency_id);
                        return currMatch?.code || currMatch?.value_code || currMatch?.name || currMatch?.value_name || quotation.currency || "UGX";
                    })(),
                    paymentTerms: mappedPaymentTerms,
                    deliveryTime: d.expected_delivery_date || "",
                    quotationValidity: d.quotation_validity || "",
                    remarks: d.remarks || "",
                    items: mappedItems,
                    status: statusName,
                    discountValue: discValue,
                    discountType: discType,
                    discountAmount: d.discount_amount || 0,
                    taxType: txType,
                    taxValue: txValue,
                    taxPercentage: txType === "%" ? txValue : 0,
                    subtotal: d.subtotal || 0,
                    taxAmount: d.tax_amount || 0,
                    total: d.total_amount || 0,
                };

                setViewingQuotation(completeQuotation);
                return;
            }
        } catch (error) {
            console.error("Error fetching full quotation details for viewing:", error);
            setViewingQuotation(quotation);
        } finally {
            setIsViewDetailLoading(false);
            setOpeningQuotationId(null);
        }
    };

    // Handle edit - fetches full details from API for correct server-side IDs
    const handleEdit = async (quotation: QuotationData) => {
        if (isRowActionBusy) return;
        setOpeningQuotationId(quotation.id);
        setIsFormOpening(true);
        setEditingId(quotation.id);
        setIsFormModalOpen(true);

        try {
            const res = await salesApi.getQuotationById(quotation.id);
            if (res.isSuccessful && res.data) {
                const d = res.data;

                // Set customer id directly from API
                setSelectedCustomerId(d.customer_id || null);

                // Map items from API response to form format (with server-side IDs)
                const mappedItems: QuotationItem[] = (d.items || []).map((apiItem: any) => ({
                    id: apiItem.id,
                    itemCode: String(apiItem.item_id),
                    item: apiItem.item_name || "",
                    qty: apiItem.quantity || 0,
                    rate: apiItem.unit_price || 0,
                    amount: apiItem.price_per_item || ((apiItem.quantity || 0) * (apiItem.unit_price || 0)),
                }));

                // Map payment terms from API response to form format (with server-side IDs)
                const mappedPaymentTerms: PaymentTerm[] = (d.payment_terms || []).map((apiTerm: any) => {
                    // Normalize term_type_name: API may return "Day" but form expects "Days"
                    let termName: "Advance" | "Delivery" | "Days" = "Advance";
                    const rawName = normalizeText(apiTerm.term_type_name || apiTerm.term_type_code || "");
                    if (rawName === "ADVANCE") termName = "Advance";
                    else if (rawName === "DELIVERY") termName = "Delivery";
                    else if (rawName === "DAY" || rawName === "DAYS") termName = "Days";
                    return {
                        id: apiTerm.id,
                        value: apiTerm.percentage || 0,
                        percentage: apiTerm.percentage || 0,
                        terms: termName,
                        date: "",
                        days: apiTerm.days || undefined,
                    };
                });

                // Determine discount value based on type from API
                const discType: "%" | "Amount" = (d.discount_type_name === "%" ? "%" : "Amount");
                const discValue = discType === "%" ? (d.discount_percent || 0) : (d.discount_amount || 0);

                // Determine tax value based on type from API
                const { taxType: txType, taxValue: txValue } = mapTaxTypeAndValue(d);
                const customerDetails = extractCustomerDetailsForForm(d);

                // Look up status name from status_id using master data
                const statusMatch = quotationStatuses.find((s: any) =>
                    (s.id || s.value_id || s.status_id) === d.status_id
                );
                const statusName = (statusMatch?.name || statusMatch?.value_name || quotation.status || "Draft Quote") as QuotationStatus;

                // Snapshot originals for delta computation (with server-side IDs)
                setOriginalItems(mappedItems.map(i => ({ ...i })));
                setOriginalPaymentTerms(mappedPaymentTerms.map(t => ({ ...t })));
                setOriginalStatusCode(statusMatch?.code || statusMatch?.value_code || d.status_code || null);

                setFormData({
                    quotationNo: d.quotation_code || quotation.quotationNo,
                    quotationDate: d.quotation_date || quotation.quotationDate,
                    customerName: customerDetails.name || quotation.customerName,
                    contactPersonName: customerDetails.contactPerson,
                    contactNumber: customerDetails.contactNumber,
                    billingAddress: customerDetails.billingAddress,
                    shippingAddress: customerDetails.shippingAddress,
                    currency: (() => {
                        // Look up currency code from store by currency_id
                        const currMatch = currencies.find((c: any) => (c.id || c.value_id) === d.currency_id);
                        return currMatch?.code || currMatch?.value_code || currMatch?.name || currMatch?.value_name || quotation.currency || "UGX";
                    })(),
                    paymentTerms: mappedPaymentTerms,
                    deliveryTime: d.expected_delivery_date || "",
                    quotationValidity: d.quotation_validity || "",
                    remarks: d.remarks || "",
                    items: mappedItems,
                    status: statusName,
                    discountValue: discValue,
                    discountType: discType,
                    taxType: txType,
                    taxValue: txValue,
                    taxPercentage: txType === "%" ? txValue : 0,
                    subtotal: d.subtotal || 0,
                    taxAmount: d.tax_amount || 0,
                    total: d.total_amount || 0,
                });
                return;
            }
        } catch (error) {
            console.error("Error fetching quotation by ID:", error);
            const matchedCustomer = customers.find((c) => c.customer_name === quotation.customerName);
            setSelectedCustomerId(matchedCustomer?.customer_id || null);
            setOriginalItems(quotation.items ? quotation.items.map(i => ({ ...i })) : []);
            setOriginalPaymentTerms(quotation.paymentTerms ? quotation.paymentTerms.map(t => ({ ...t })) : []);
            setFormData({
                quotationNo: quotation.quotationNo,
                quotationDate: quotation.quotationDate,
                customerName: quotation.customerName,
                contactPersonName: quotation.contactPersonName,
                contactNumber: quotation.contactNumber,
                billingAddress: quotation.billingAddress,
                shippingAddress: quotation.shippingAddress,
                currency: quotation.currency,
                paymentTerms: quotation.paymentTerms,
                deliveryTime: quotation.deliveryTime,
                quotationValidity: quotation.quotationValidity,
                remarks: quotation.remarks,
                items: quotation.items,
                status: quotation.status,
                discountValue: quotation.discountValue || 0,
                discountType: quotation.discountType || "%",
                taxType: quotation.taxType || "%",
                taxValue: quotation.taxValue || 0,
                taxPercentage: quotation.taxPercentage || 0
            });
        } finally {
            setIsFormOpening(false);
            setOpeningQuotationId(null);
        }
    };

    // Handle deletion via API
    const handleDeleteQuotation = async (id: number) => {
        if (isRowActionBusy) return;
        setIsDeleting(true);
        try {
            const res = await salesApi.deleteQuotation(id);
            if (res.isSuccessful) {
                toast({
                    title: "Quotation Deleted",
                    description: res.message || "The quotation has been deleted successfully.",
                    variant: "success"
                });
            } else {
                toast({
                    title: "Delete Failed",
                    description: res.message || "Failed to delete quotation.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Error deleting quotation:", error);
            toast({
                title: "Delete Failed",
                description: "An error occurred while deleting the quotation.",
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
        }
        fetchQuotations();
        setIsDeleteAlertOpen(false);
        setIsFormModalOpen(false);
    };

    // Export as PDF - Using unified template
    const handleExportPDF = (quotation: QuotationData) => {
        const pdfContent = generateQuotationPDFHTML({
            ...quotation,
            currencySymbol: getCurrencySymbol(quotation.currency)
        } as any);

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
    };

    // Check for expired quotations - removed localStorage - using mock store
    useEffect(() => {
        const checkExpiredQuotations = () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const allQuotations = getQuotations();
            let hasChanges = false;

            allQuotations.forEach(quote => {
                // Only check Submitted Quote quotations
                if (quote.status === "Submitted Quote" && quote.quotationValidity) {
                    const expiryDate = new Date(quote.quotationValidity);
                    expiryDate.setHours(23, 59, 59, 999); // Expire at end of day

                    // If expired, update status
                    if (today > expiryDate) {
                        changeQuotationStatus(quote.id, "Expired Quotations");
                        hasChanges = true;
                    }
                }
            });

            if (hasChanges) {
                setQuotations(getQuotations()); // Refresh list
            }
        };

        // Check on mount
        checkExpiredQuotations();

        // Check every minute
        const interval = setInterval(checkExpiredQuotations, 60000);

        return () => clearInterval(interval);
    }, []);

    // Data comes pre-paginated and pre-filtered from API
    const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
    const paginatedQuotations = quotations;

    const isRowActionBusy =
        openingQuotationId !== null ||
        isViewDetailLoading ||
        isFormOpening ||
        isSaving ||
        isSubmitting ||
        isDeleting;

    // Auto-adjust page when data changes
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalRecords, currentPage, totalPages]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterDate, filterStatus]);

    const getStatusBadge = (status: QuotationStatus) => {
        const raw = String(status || "").trim().toUpperCase();
        if (raw.includes("DRAFT")) {
            return <Badge variant="outline">Draft Quote</Badge>;
        }
        if (raw.includes("SUBMIT")) {
            return <Badge variant="default">Submitted Quote</Badge>;
        }
        if (raw.includes("EXPIRE")) {
            return <Badge variant="destructive">Expired Quotations</Badge>;
        }
        if (raw.includes("CONVERT") || raw.includes("SO")) {
            return <Badge variant="secondary">Converted to SO</Badge>;
        }
        return <Badge variant="outline">{status}</Badge>;
    };

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>

            <AppListToolbar
                search={{
                    value: searchTerm,
                    onChange: (val) => {
                        setSearchTerm(val);
                        setCurrentPage(1);
                    },
                    placeholder: "Search by Quotation Code, Customer..."
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
                        options: quotationStatuses.length > 0
                            ? [
                                { label: "All Status", value: "all" },
                                ...quotationStatuses.map((s: any) => ({
                                    label: s.name || s.value_name,
                                    value: String(s.id)
                                }))
                            ]
                            : [
                                { label: "All Status", value: "all" },
                                { label: "Draft Quote", value: "Draft Quote" },
                                { label: "Submitted Quote", value: "Submitted Quote" },
                                { label: "Expired Quotations", value: "Expired Quotations" },
                                { label: "Converted to SO", value: "Converted to SO" }
                            ]
                    }
                ]}
                actions={[
                    ...(canCreate(permissionModule) ? [{
                        label: "New Quotation",
                        onClick: () => {
                            if (isRowActionBusy) return;
                            resetForm();
                            setIsFormModalOpen(true);
                        },
                        icon: <Plus className="h-4 w-4" />
                    }] : [])
                ]}
            />

            {/* Quotation Table - Matching WarrantyService layout */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 pl-6">Quotation Code</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Quotation Date</TableHead>
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
                                ) : paginatedQuotations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                            No quotations found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedQuotations.map((quote) => (
                                        <TableRow key={quote.id} className="hover:bg-muted/30 transition-colors border-b last:border-none">
                                            <TableCell className="py-4 pl-6 font-medium text-xs font-mono text-primary">{quote.quotationNo || `QT-${quote.id}`}</TableCell>
                                            <TableCell className="py-4 text-sm font-medium text-slate-600">{formatDate(quote.quotationDate)}</TableCell>
                                            <TableCell className="py-4 text-sm font-bold text-primary">{quote.customerName}</TableCell>
                                            <TableCell className="py-4 text-center">
                                                {getStatusBadge(quote.status)}
                                            </TableCell>
                                             <TableCell className="py-4 text-center">
                                                <TableActionButtons
                                                    onView={canView(permissionModule) ? () => handleView(quote) : undefined}
                                                    onEdit={(canEdit(permissionModule) && (quote.status === "Draft Quote" || quote.status === "Submitted Quote")) ? () => handleEdit(quote) : undefined}
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

            {/* New/Edit Quotation Form Modal - layout only - match SO */}
            <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
                <DialogContent
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 space-y-1 p-4 pb-2 sm:p-5 sm:pb-3">
                        <DialogTitle className="text-lg font-bold sm:text-xl">
                            {editingId ? "Edit Quotation" : "Create Quotation"}
                        </DialogTitle>
                        <DialogDescription className="text-xs leading-snug text-muted-foreground sm:text-sm">
                            Fill in the details to create or update a quotation.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 space-y-6 relative">
                        {isFormOpening && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
                        {/* layout only - match SO: 2-column grid with proper field placement */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
                            {/* Row 1: Quotation Date | Customer */}
                            <div className="min-w-0 space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Quotation Date</Label>
                                <Input
                                    value={formData.quotationDate}
                                    readOnly
                                    disabled
                                    className="h-9 bg-muted/50"
                                />
                            </div>
                            <div className="min-w-0 space-y-1.5">
                                <SearchableSelect
                                    label="Customer"
                                    required
                                    value={formData.customerName}
                                    options={customers.map(c => c.customer_name)}
                                    onChange={handleCustomerSelect}
                                    className="h-9"
                                />
                            </div>

                            {/* Row 2: Customer Name | Contact Person Name */}
                            <div className="min-w-0 space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Customer Name
                                    <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>
                                </Label>
                                <Input
                                    value={formData.customerName}
                                    placeholder="Auto-filled from selection"
                                    disabled
                                    className="h-9 bg-muted/50"
                                />
                            </div>
                            <div className="min-w-0 space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Contact Person Name
                                    <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>
                                </Label>
                                <Input
                                    value={formData.contactPersonName}
                                    placeholder="Auto-filled"
                                    disabled
                                    className="h-9 bg-muted/50"
                                />
                            </div>

                            {/* Row 3: Contact Number | Currency */}
                            <div className="min-w-0 space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Contact Number
                                    <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>
                                </Label>
                                <Input
                                    value={formData.contactNumber}
                                    placeholder="Auto-filled"
                                    disabled
                                    className="h-9 bg-muted/50"
                                />
                                {formData.contactNumber && !/^\d{10,11}$/.test(formData.contactNumber) && (
                                    <p className="text-xs text-red-500">Must be 10 or 11 digits</p>
                                )}
                            </div>
                            <div className="min-w-0 space-y-1.5">
                                <SearchableSelect
                                    label="Currency"
                                    required
                                    value={formData.currency}
                                    options={currencyOptions}
                                    onChange={(val) => setFormData({ ...formData, currency: val })}
                                    className="h-9"
                                />
                            </div>

                            {/* Row 4: Billing Address | Shipping Address */}
                            <div className="min-w-0 space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Billing Address
                                    <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>
                                </Label>
                                <Input
                                    value={formData.billingAddress}
                                    placeholder="Auto-filled"
                                    disabled
                                    className="h-9 bg-muted/50"
                                />
                            </div>
                            <div className="min-w-0 space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Shipping Address
                                    <span className="text-xs text-muted-foreground ml-1">(Auto-filled)</span>
                                </Label>
                                <Input
                                    value={formData.shippingAddress}
                                    placeholder="Auto-filled"
                                    disabled
                                    className="h-9 bg-muted/50"
                                />
                            </div>

                            {/* Row 5: Quotation Validity | Expected Delivery Date */}
                            <div className="min-w-0 space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Quotation Validity</Label>
                                <DatePicker
                                    date={formData.quotationValidity ? new Date(formData.quotationValidity) : undefined}
                                    setDate={(d) => setFormData({ ...formData, quotationValidity: d ? format(d, "yyyy-MM-dd") : "" })}
                                    disablePastDates={true}
                                />
                            </div>
                            <div className="min-w-0 space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Expected Delivery Date</Label>
                                <DatePicker
                                    date={formData.deliveryTime ? new Date(formData.deliveryTime) : undefined}
                                    setDate={(d) => setFormData({ ...formData, deliveryTime: d ? format(d, "yyyy-MM-dd") : "" })}
                                    disablePastDates={true}
                                />
                            </div>

                            {/* Row 6: Remarks (full width) */}
                            <div className="min-w-0 space-y-1.5 md:col-span-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Remarks</Label>
                                <Textarea
                                    value={formData.remarks}
                                    onChange={(e) => {
                                        if (e.target.value.length <= 200) {
                                            setFormData({ ...formData, remarks: e.target.value });
                                        }
                                    }}
                                    maxLength={200}
                                    placeholder="Additional notes"
                                    className="min-h-[60px]"
                                />
                            </div>
                        </div>

                        {/* layout only - match SO: Terms section with title on left, Add Term button on right */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold">Terms</Label>
                                <Button onClick={handleAddPaymentTerm} size="sm" variant="outline">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Term
                                </Button>
                            </div>
                            <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-[10px] font-bold uppercase py-3 pl-6 w-[130px]">Percentage</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 w-[150px]">Term Type</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center w-[120px]">Days</TableHead>
                                            <TableHead className="text-[10px] font-bold py-3 text-center w-[80px]">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {!formData.paymentTerms || formData.paymentTerms.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">
                                                    No terms added yet
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            formData.paymentTerms.map((term) => {
                                                // Get all term types that are already used (excluding current term)
                                                const usedTermTypes: Array<"Advance" | "Delivery" | "Days"> = formData.paymentTerms
                                                    ?.filter(t => t.id !== term.id)
                                                    .map(t => t.terms) || [];

                                                return (
                                                    <TableRow key={term.id} className="hover:bg-muted/20">
                                                        {/* Value Column - Simple input without type selector */}
                                                        <TableCell className="py-4 pl-6">
                                                            <Input
                                                                type="number"
                                                                className="h-8 w-32 text-center"
                                                                value={term.value}
                                                                onChange={(e) => {
                                                                    const rawValue = e.target.value;
                                                                    const val = rawValue === "" ? 0 : parseFloat(rawValue);
                                                                    
                                                                    if (!isNaN(val)) {
                                                                        let finalVal = val;
                                                                        if (finalVal < 0) finalVal = 0;
                                                                        if (finalVal > 100) finalVal = 100;

                                                                        const updatedTerms = formData.paymentTerms?.map(t => 
                                                                            t.id === term.id 
                                                                                ? { ...t, value: finalVal, percentage: finalVal } 
                                                                                : t
                                                                        );
                                                                        setFormData({ ...formData, paymentTerms: updatedTerms });
                                                                    }
                                                                }}


                                                                placeholder="0"
                                                                min="0"
                                                                step="0.01"
                                                            />
                                                        </TableCell>

                                                        {/* Term Type Column */}
                                                        <TableCell className="py-4">
                                                            <Select
                                                                value={term.terms}
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
                                                                    handlePaymentTermChange(term.id, 'terms', val);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-8 w-32">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {PAYMENT_TERM_OPTIONS.map(opt => (
                                                                        <SelectItem
                                                                            key={opt}
                                                                            value={opt}
                                                                            disabled={usedTermTypes.includes(opt)}
                                                                        >
                                                                            {opt}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>

                                                        {/* Days Column */}
                                                        <TableCell className="py-4">
                                                            {term.terms === "Days" ? (
                                                                <div className="space-y-1">
                                                                    <Input
                                                                        type="number"
                                                                        className={cn("h-8 w-24 text-center mx-auto", (!term.days || Number(term.days) <= 0) && "border-red-500 focus-visible:ring-red-500")}
                                                                        value={term.days || ""}
                                                                        onChange={(e) => handlePaymentTermChange(term.id, 'days', e.target.value === "" ? "" : parseInt(e.target.value))}
                                                                        placeholder="Enter days"
                                                                    />
                                                                    {(!term.days || Number(term.days) <= 0) && (
                                                                        <p className="text-[10px] text-red-500 font-medium text-center">Days must be greater than 0</p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="font-medium text-muted-foreground text-center block">-</span>
                                                            )}
                                                        </TableCell>



                                                        {/* Actions Column */}
                                                        <TableCell className="py-4 text-center">
                                                            <TableActionButtons
                                                                onDelete={() => handleRemovePaymentTerm(term.id)}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* layout only - match SO: Items section with title on left, Add Item button on right */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold">Items</Label>
                                <Button onClick={handleAddItem} size="sm" variant="outline">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Item
                                </Button>
                            </div>
                            <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                                <div className="overflow-x-auto">
                                <Table className="w-full min-w-[860px] table-fixed">
                                    <colgroup>
                                        <col className="w-[52%]" />
                                        <col className="w-[12%]" />
                                        <col className="w-[16%]" />
                                        <col className="w-[14%]" />
                                        <col className="w-[6%]" />
                                    </colgroup>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-[10px] font-bold uppercase py-3 pl-6">Item</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Qty</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Unit Price</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Price</TableHead>
                                            <TableHead className="text-[10px] font-bold py-3 text-center">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {formData.items?.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                                    No items added yet
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            formData.items?.map((item) => {
                                                const usedItems = formData.items?.filter(it => it.id !== item.id).map(it => it.item) || [];
                                                const qty = parseFloat(item.qty.toString());
                                                const rate = parseFloat(item.rate.toString());
                                                const isQtyInvalid = item.qty !== "" && (isNaN(qty) || qty <= 0);
                                                const isRateInvalid = item.rate !== "" && (isNaN(rate) || rate <= 0);

                                                return (
                                                    <TableRow key={item.id} className="hover:bg-muted/20 align-top">
                                                        <TableCell className="max-w-0 py-4 pl-6 align-top">
                                                            <SearchableSelect
                                                                value={item.item}
                                                                options={quotationItemsMaster.map((i) => ({
                                                                    label: `${i.item_name}${i.item_code ? ` — ${i.item_code}` : ""}`,
                                                                    value: i.item_name,
                                                                    primaryText: i.item_name,
                                                                    secondaryText: i.item_code || String(i.item_id),
                                                                    disabled: usedItems.includes(i.item_name)
                                                                }))}
                                                                onChange={(val) => handleItemChange(item.id, 'item', val)}
                                                                placeholder="Select Item"
                                                                showSelectedTitle
                                                                compactStackedSelected
                                                                listClassName="max-h-[220px]"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-center align-top pt-4">
                                                            <div className="space-y-1">
                                                                <Input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    className={cn("h-9 w-24 text-center mx-auto", isQtyInvalid && "border-red-500 focus-visible:ring-red-500")}
                                                                    value={item.qty}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        if (val.length <= 12 && (val === "" || /^\d*\.?\d*$/.test(val))) {
                                                                            handleItemChange(item.id, 'qty', val);
                                                                        }
                                                                    }}
                                                                />
                                                                {isQtyInvalid && (
                                                                    <p className="text-[10px] text-red-500 font-medium">Qty must be greater than 0</p>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center align-top pt-4">
                                                            <div className="space-y-1">
                                                                <Input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    className={cn("h-9 w-28 text-center mx-auto", isRateInvalid && "border-red-500 focus-visible:ring-red-500")}
                                                                    value={item.rate}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        if (val.length <= 12 && (val === "" || /^\d*\.?\d*$/.test(val))) {
                                                                            handleItemChange(item.id, 'rate', val);
                                                                        }
                                                                    }}
                                                                />
                                                                    {isRateInvalid && (
                                                                        <p className="text-[10px] text-red-500 font-medium">Unit price must be greater than 0</p>
                                                                    )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center align-middle">
                                                            <div className="flex h-full items-center justify-center">
                                                                <span className="font-bold text-primary">
                                                                    {getCurrencySymbol(formData.currency || 'UGX')} {item.amount.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center align-middle">
                                                            <div className="flex h-full items-center justify-center">
                                                                <TableActionButtons
                                                                    onDelete={() => handleRemoveItem(item.id)}
                                                                />
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                                </div>
                            </div>
                        </div>

                        {/* Totals Summary - Added Discount and Tax with type selector */}
                        {formData.items && formData.items.length > 0 && (
                            <div className="flex justify-end">
                                <div className="w-80 space-y-2 p-4 bg-muted/30 rounded-lg border">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-muted-foreground">Subtotal:</span>
                                        <span className="font-bold">{getCurrencySymbol(formData.currency || 'UGX')} {calculateTotals().subtotal.toFixed(2)}</span>
                                    </div>
                                    
                                    {/* Discount Row */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-muted-foreground">Discount:</span>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    className="h-8 w-20 text-center"
                                                    value={formData.discountValue || 0}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        const subtotal = calculateTotals().subtotal;
                                                        
                                                        // Validation
                                                        if (formData.discountType === "%") {
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
                                                        
                                                        setFormData({ ...formData, discountValue: val });
                                                    }}
                                                    min="0"
                                                    max={formData.discountType === "%" ? "100" : undefined}
                                                />
                                                <Select
                                                    value={formData.discountType || "%"}
                                                    onValueChange={(val: "%" | "Amount") => {
                                                        setFormData({ ...formData, discountType: val, discountValue: 0 });
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
                                        </div>
                                        <div className="flex justify-end">
                                            <span className="font-bold text-red-600 text-sm">-{getCurrencySymbol(formData.currency || 'UGX')} {calculateTotals().discountAmount.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Tax Row - Similar to Discount with % or Amount support */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-muted-foreground">Tax:</span>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    className="h-8 w-20 text-center"
                                                    value={formData.taxValue || 0}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        const afterDiscount = calculateTotals().afterDiscount;
                                                        
                                                        // Validation
                                                        if (formData.taxType === "%") {
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
                                                        
                                                        setFormData({ ...formData, taxValue: val });
                                                    }}
                                                    min="0"
                                                />
                                                <Select
                                                    value={formData.taxType || "%"}
                                                    onValueChange={(val: "%" | "Amount") => {
                                                        setFormData({ ...formData, taxType: val, taxValue: 0 });
                                                    }}
                                                >
                                                    <SelectTrigger className="h-8 w-16">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="%">%</SelectItem>
                                                        <SelectItem value="Amount">Amount</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <span className="font-bold text-green-600 text-sm">+{getCurrencySymbol(formData.currency || 'UGX')} {calculateTotals().taxAmount.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between text-lg border-t pt-2">
                                        <span className="font-bold">Grand Total:</span>
                                        <span className="font-bold text-primary">{getCurrencySymbol(formData.currency || 'UGX')} {calculateTotals().total.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* layout only - match SO: Footer action bar aligned right like SO */}
                    <DialogFooter className="shrink-0 gap-2 border-t bg-muted/20 p-4 sm:p-5">
                        {formData.status === "Draft Quote" && (
                            <div className="mr-auto">
                                {editingId && canDelete(permissionModule) && (
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            const quote = quotations.find(q => q.id === editingId);
                                            if (quote) {
                                                setQuotationToDelete(quote);
                                                setIsDeleteAlertOpen(true);
                                            }
                                        }}
                                        className="gap-2"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </Button>
                                )}
                            </div>
                        )}
                        <Button 
                            variant="default"
                            onClick={handleSave}
                            loading={isSaving}
                            className={cn(
                                "disabled:bg-muted disabled:text-muted-foreground disabled:border-muted disabled:opacity-100",
                                isFormValid() ? "bg-[#0056B8] text-white hover:bg-[#0056B8]/90" : ""
                            )}
                            disabled={!isFormValid() || isFormOpening || isSaving || isSubmitting}
                        >
                            {formData.status === "Submitted Quote" ? "Save" : "Save as Draft"}
                        </Button>
                        {/* Hide Submit button when editing a Submitted Quote */}
                        {!(editingId && formData.status === "Submitted Quote") && (
                            <Button 
                                variant="default"
                                onClick={handleSubmit}
                                loading={isSubmitting}
                                className={cn(
                                    "disabled:bg-muted disabled:text-muted-foreground disabled:border-muted disabled:opacity-100",
                                    isFormValid() ? "bg-[#0056B8] text-white hover:bg-[#0056B8]/90" : ""
                                )}
                                disabled={!isFormValid() || isFormOpening || isSaving || isSubmitting}
                            >
                                Submit
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Quotation Modal - PDF Style Document Preview - Professional Non-Colorful Layout */}
            <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                <DialogContent className="max-w-[900px] max-h-[95vh] flex flex-col p-0">
                    <div className="flex-1 overflow-y-auto bg-slate-100 p-6 relative">
                        {isViewDetailLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/80">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
                        {/* A4 Page Container */}
                        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl" style={{ minHeight: '297mm' }}>
                            {/* PDF Document Content */}
                            {viewingQuotation && (
                                <div className="p-12">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-800">
                                        <div>
                                            <h1 className="text-3xl font-bold text-gray-900 mb-2">MASTER-ERP</h1>
                                            <p className="text-sm text-gray-600">Industrial Solutions & Services</p>
                                            <p className="text-sm text-gray-600">Ahmedabad, Gujarat, India</p>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="text-2xl font-bold text-gray-900 mb-1">QUOTATION</h2>
                                            <p className="text-sm text-gray-600">#{viewingQuotation.quotationNo || 'DRAFT'}</p>
                                        </div>
                                    </div>

                                    {/* Quotation Details Section */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-300">
                                            Quotation Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Quotation Code</p>
                                                <p className="text-sm font-semibold text-gray-900">{viewingQuotation.quotationNo || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Quotation Date</p>
                                                <p className="text-sm font-semibold text-gray-900">{formatDate(viewingQuotation.quotationDate)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Quotation Validity Date</p>
                                                <p className="text-sm font-semibold text-gray-900">{formatDate(viewingQuotation.quotationValidity)}</p>
                                            </div>
                                            {viewingQuotation.deliveryTime && (
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Expected Delivery Date</p>
                                                    <p className="text-sm font-semibold text-gray-900">{formatDate(viewingQuotation.deliveryTime)}</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Currency</p>
                                                <p className="text-sm font-semibold text-gray-900">{viewingQuotation.currency}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Information Section */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-300">
                                            Customer Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Customer Name</p>
                                                <p className="text-sm font-semibold text-gray-900">{viewingQuotation.customerName}</p>
                                            </div>
                                            {viewingQuotation.contactPersonName && (
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Contact Person Name</p>
                                                    <p className="text-sm font-semibold text-gray-900">{viewingQuotation.contactPersonName}</p>
                                                </div>
                                            )}
                                            {viewingQuotation.contactNumber && (
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Contact Number</p>
                                                    <p className="text-sm font-semibold text-gray-900">{viewingQuotation.contactNumber}</p>
                                                </div>
                                            )}
                                            {viewingQuotation.billingAddress && (
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Billing Address</p>
                                                    <p className="text-sm font-semibold text-gray-900">{viewingQuotation.billingAddress}</p>
                                                </div>
                                            )}
                                            {viewingQuotation.shippingAddress && (
                                                <div className="col-span-2">
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Shipping Address</p>
                                                    <p className="text-sm font-semibold text-gray-900">{viewingQuotation.shippingAddress}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Remarks Section */}
                                    {viewingQuotation.remarks && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-300">
                                                Remarks
                                            </h3>
                                            <p className="text-sm text-gray-800 leading-relaxed">{viewingQuotation.remarks}</p>
                                        </div>
                                    )}

                                    {/* Payment Terms Section - Only Payment Terms */}
                                    {viewingQuotation.paymentTerms && viewingQuotation.paymentTerms.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-300">
                                                Payment Terms
                                            </h3>
                                            <div className="space-y-2">
                                                {viewingQuotation.paymentTerms.map((term, index) => {
                                                    const value = term.value || term.percentage || 0;
                                                    const displayValue = `${value}%`;
                                                    
                                                    let termText = "";
                                                    
                                                    if (term.terms === "Advance") {
                                                        termText = `${displayValue} Advance`;
                                                    } else if (term.terms === "Delivery") {
                                                        termText = `${displayValue} Delivery`;
                                                    } else if (term.terms === "Days") {
                                                        termText = `${displayValue} within ${term.days || 0} days`;
                                                    }
                                                    
                                                    return (
                                                        <div key={term.id} className="flex items-start gap-2">
                                                            <span className="text-gray-900 font-bold mt-0.5">•</span>
                                                            <p className="text-sm text-gray-800">{termText}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Items Table */}
                                    <div className="mb-6">
                                        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 pb-2 border-b border-gray-300">
                                            Items
                                        </h3>
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="text-left text-xs font-bold text-gray-700 uppercase tracking-wide py-3 px-4 border-b-2 border-gray-300">
                                                        Item
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-gray-700 uppercase tracking-wide py-3 px-4 border-b-2 border-gray-300">
                                                        Quantity
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-gray-700 uppercase tracking-wide py-3 px-4 border-b-2 border-gray-300">
                                                         Unit Price
                                                    </th>
                                                    <th className="text-right text-xs font-bold text-gray-700 uppercase tracking-wide py-3 px-4 border-b-2 border-gray-300">
                                                        Amount
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewingQuotation.items.map((item, index) => (
                                                    <tr key={item.id} className="border-b border-gray-200">
                                                        <td className="text-sm text-gray-900 py-3 px-4">
                                                            {item.item}
                                                        </td>
                                                        <td className="text-sm text-gray-900 text-right py-3 px-4">
                                                            {item.qty}
                                                        </td>
                                                        <td className="text-sm text-gray-900 text-right py-3 px-4">
                                                            {getCurrencySymbol(viewingQuotation.currency)} {Number(item.rate).toFixed(2)}
                                                        </td>
                                                        <td className="text-sm font-semibold text-gray-900 text-right py-3 px-4">
                                                            {getCurrencySymbol(viewingQuotation.currency)} {item.amount.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Financial Summary Section - Non-Colorful */}
                                    <div className="flex justify-end mb-8">
                                        <div className="w-80 border border-gray-300">
                                            <div className="flex justify-between items-center py-2 px-4 bg-gray-100 border-b border-gray-200">
                                                <span className="text-sm text-gray-600">Subtotal</span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {getCurrencySymbol(viewingQuotation.currency)} {viewingQuotation.subtotal.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 px-4 border-b border-gray-200">
                                                <span className="text-sm text-gray-600">
                                                    Discount ({viewingQuotation.discountType === "%" ? `${viewingQuotation.discountValue || 0}%` : "Amount"})
                                                </span>
                                                <span className="text-sm font-semibold text-red-600">
                                                    -{getCurrencySymbol(viewingQuotation.currency)} {(viewingQuotation.discountAmount || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 px-4 border-b border-gray-200">
                                                <span className="text-sm text-gray-600">
                                                    Tax ({viewingQuotation.taxType === "%" ? `${viewingQuotation.taxValue || viewingQuotation.taxPercentage}%` : "Amount"})
                                                </span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {getCurrencySymbol(viewingQuotation.currency)} {viewingQuotation.taxAmount.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-3 px-4 bg-gray-800 text-white">
                                                <span className="text-base font-bold">Grand Total</span>
                                                <span className="text-lg font-bold">
                                                    {getCurrencySymbol(viewingQuotation.currency)} {viewingQuotation.total.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="text-center pt-6 border-t border-gray-300">
                                        <p className="text-xs text-gray-500 mb-1">
                                            This is a computer-generated quotation document.
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Generated on {format(new Date(), "dd-MM-yyyy, HH:mm")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons - Outside Document */}
                    <div className="flex justify-between items-center p-4 border-t bg-white">
                        <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                            <X className="mr-2 h-4 w-4" />
                            Close
                        </Button>
                        <div className="flex gap-2">
                            {viewingQuotation && canPrint(permissionModule) && (
                                <Button onClick={() => handleExportPDF(viewingQuotation)} className="gap-2">
                                    <Download className="h-4 w-4" />
                                    Download PDF
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Alert */}
            <Dialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Are you sure?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete the quotation {quotationToDelete?.quotationNo || 'Draft'}. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteAlertOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => quotationToDelete && handleDeleteQuotation(quotationToDelete.id)}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// DatePicker Component (from Attendance.tsx)
function DatePicker({ date, setDate, disabled = false, disablePastDates = false }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean,
    disablePastDates?: boolean
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
    const [visibleDate, setVisibleDate] = useState(() => date || new Date());

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const monthNamesShort = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
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
        setViewMode("day");
    };

    const handleMonthSelect = (monthIndex: number) => {
        const newDate = new Date(visibleDate.getFullYear(), monthIndex, 1);
        setVisibleDate(newDate);
        setViewMode("day");
    };

    const handleYearSelect = (year: number) => {
        const newDate = new Date(year, visibleDate.getMonth(), 1);
        setVisibleDate(newDate);
        setViewMode("month");
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

        // Previous month's trailing days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const dayDate = new Date(year, month - 1, prevMonthLastDay - i);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isDisabled = disablePastDates && dayDate < today;

            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false,
                isDisabled
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const isToday = new Date().toDateString() === currentDate.toDateString();
            const isSelected = date && currentDate.toDateString() === date.toDateString();

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isDisabled = disablePastDates && currentDate < today;

            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday,
                isSelected,
                isDisabled
            });
        }

        // Next month's leading days
        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day++) {
            const dayDate = new Date(year, month + 1, day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isDisabled = disablePastDates && dayDate < today;

            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false,
                isDisabled
            });
        }

        return days;
    };

    const renderDayView = () => {
        const days = getDaysInMonth(visibleDate);
        const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigateMonth(-1)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            className="font-semibold text-sm"
                            onClick={() => setViewMode("month")}
                        >
                            {monthNames[visibleDate.getMonth()]}
                            <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            className="font-semibold text-sm"
                            onClick={() => setViewMode("year")}
                        >
                            {visibleDate.getFullYear()}
                            <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigateMonth(1)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day) => (
                        <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, index) => (
                        <Button
                            key={index}
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-8 text-sm font-normal",
                                !day.isCurrentMonth && "text-muted-foreground opacity-30",
                                day.isToday && "bg-accent text-accent-foreground font-semibold",
                                day.isSelected && "bg-primary text-primary-foreground font-semibold",
                                day.isCurrentMonth && !day.isDisabled && "hover:bg-accent hover:text-accent-foreground",
                                day.isDisabled && "cursor-not-allowed opacity-20"
                            )}
                            disabled={day.isDisabled}
                            onClick={() => !day.isDisabled && handleDateSelect(day.date)}
                        >
                            {day.date.getDate()}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    const renderMonthView = () => {
        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewMode("day")}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{visibleDate.getFullYear()}</h3>
                    <Button
                        variant="ghost"
                        className="font-semibold text-sm"
                        onClick={() => setViewMode("year")}
                    >
                        {visibleDate.getFullYear()}
                        <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {monthNamesShort.map((month, index) => (
                        <Button
                            key={month}
                            variant="ghost"
                            className={cn(
                                "h-10 text-sm font-normal",
                                index === visibleDate.getMonth() && "bg-primary text-primary-foreground font-semibold"
                            )}
                            onClick={() => handleMonthSelect(index)}
                        >
                            {month}
                        </Button>
                    ))}
                </div>
            </div>
        );
    };

    const renderYearView = () => {
        const currentYear = visibleDate.getFullYear();
        const startYear = Math.floor(currentYear / 12) * 12;
        const years = Array.from({ length: 12 }, (_, i) => startYear + i);

        return (
            <div className="w-80">
                <div className="flex items-center justify-between mb-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            const newStartYear = startYear - 12;
                            setVisibleDate(new Date(newStartYear, visibleDate.getMonth(), 1));
                        }}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">{startYear} - {startYear + 11}</h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            const newStartYear = startYear + 12;
                            setVisibleDate(new Date(newStartYear, visibleDate.getMonth(), 1));
                        }}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {years.map((year) => (
                        <Button
                            key={year}
                            variant="ghost"
                            className={cn(
                                "h-10 text-sm font-normal",
                                year === currentYear && "bg-primary text-primary-foreground font-semibold"
                            )}
                            onClick={() => handleYearSelect(year)}
                        >
                            {year}
                        </Button>
                    ))}
                </div>
            </div>
        );
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
                {viewMode === "day" && renderDayView()}
                {viewMode === "month" && renderMonthView()}
                {viewMode === "year" && renderYearView()}
            </PopoverContent>
        </Popover>
    );
}
