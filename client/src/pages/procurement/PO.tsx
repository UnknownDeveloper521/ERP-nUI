import React, { useState, useEffect, useRef, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { format, parse, isValid, startOfDay, isBefore } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    FileText,
    Calendar as CalendarIcon,
    ChevronDown,
    Trash2,
    Settings2,
    Paperclip,
    Plus,
    Check,
    Package,
    Printer,
    Download,
    ChevronsUpDown,
    Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { commonApi, procurementApi, POListRecord, POSubmitRequest } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommonStore } from "@/store/commonStore";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Command,
    CommandInputBorderless,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, resolveFileUrl, getFileName, truncateFileName } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { mockWarehouses, mockLocations, mockTransporters } from "@/lib/masterMockData";
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";

import {
    MRStatus,
    POStatus,
    Quotation,
    MRItem,
    MRRequestData,
    POData,
    getStoredMRs,
    saveMRs,
    getStoredPOs,
    savePOs
} from "@/lib/procurementSharedData";
import { CURRENCY_SYMBOL } from "@/config/appConfig";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { isCurrencyEntityName } from "@/services/loadCommonData";

// ============================================================================
// HELPERS
// ============================================================================

const parseDateString = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    // Try DD-MM-YYYY first
    let parsed = parse(dateStr, "dd-MM-yyyy", new Date());
    if (isValid(parsed)) return parsed;
    // Fallback to YYYY-MM-DD
    parsed = parse(dateStr, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) return parsed;
    return new Date(dateStr);
};

const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
        case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200';
        case 'pending approval': return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'ordered': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'partially received': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        case 'received': return 'bg-teal-50 text-teal-700 border-teal-200';
        case 'closed': return 'bg-gray-50 text-gray-700 border-gray-200';
        case 'cancelled': return 'bg-rose-50 text-rose-700 border-rose-200';
        default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
};

const formatDate = (date: Date | string): string => {
    if (!date) return "";
    const d = typeof date === 'string' ? parseDateString(date) : date;
    if (!isValid(d)) return typeof date === 'string' ? date : "";
    return format(d, "dd-MM-yyyy");
};

type CurrencyEntity = {
    id?: number;
    value_id?: number;
    code?: string;
    value_code?: string;
    entity_value?: string;
};

/** PO API currency_id maps to entity value_id when present (not entity_values row id). */
const getCurrencyEntityId = (c: CurrencyEntity) => c.value_id ?? c.id;

const findCurrencyByEntityId = (
    list: CurrencyEntity[],
    entityId?: number | string | null
): CurrencyEntity | undefined => {
    if (entityId == null || entityId === "") return undefined;
    const n = Number(entityId);
    return list.find((c) => Number(c.value_id) === n || Number(c.id) === n);
};

const getCurrencyCode = (c?: CurrencyEntity) =>
    c?.code || c?.value_code || c?.entity_value || "";

const getCurrencySymbol = (currency: string): string => {
    if (!currency) return "";
    const clean = currency.trim().toUpperCase();
    const symbols: Record<string, string> = {
        USD: "$",
        "US DOLLAR": "$",
        EUR: "€",
        EURO: "€",
        GBP: "£",
        "BRITISH POUND": "£",
        INR: "₹",
        "INDIAN RUPEE": "₹",
        JPY: "¥",
        "JAPANESE YEN": "¥",
        CNY: "¥",
        "CHINESE YUAN": "¥",
        AUD: "A$",
        "AUSTRALIAN DOLLAR": "A$",
        CAD: "C$",
        "CANADIAN DOLLAR": "C$",
        CHF: "CHF",
        "SWISS FRANC": "CHF",
        SEK: "kr",
        "SWEDISH KRONA": "kr",
        NZD: "NZ$",
        "NEW ZEALAND DOLLAR": "NZ$",
        UGX: "USh",
        "UGANDA SHILLING": "USh",
    };
    return symbols[clean] || currency;
};

const getPOStatusBadge = (status: POStatus) => {
    switch (status) {
        case "Draft PO": return <Badge className="bg-slate-500 hover:bg-slate-600">Draft PO</Badge>;
        case "Submitted PO": return <Badge className="bg-blue-500 hover:bg-blue-600">Submitted PO</Badge>;
        case "Partially Completed PO": return <Badge className="bg-orange-500 hover:bg-orange-600">Partially Completed PO</Badge>;
        case "Completed PO": return <Badge className="bg-green-500 hover:bg-green-600">Completed PO</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
};

function DatePicker({ date, setDate, disabled = false, disablePastDates = false }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean,
    /** When true, only today and future calendar days can be selected. */
    disablePastDates?: boolean,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [visibleDate, setVisibleDate] = useState(() => date || new Date());

    const isDayBeforeToday = (d: Date) =>
        isBefore(startOfDay(d), startOfDay(new Date()));

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const formatDisplayDate = (date: Date | undefined) => {
        if (!date) return "Pick a date";
        try {
            return format(date, "dd-MM-yyyy");
        } catch (error) {
            return "Pick a date";
        }
    };

    const handleDateSelect = (selectedDate: Date) => {
        if (disablePastDates && isDayBeforeToday(selectedDate)) {
            return;
        }
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const d = new Date(year, month - 1, prevMonthLastDay - i);
            days.push({
                date: d,
                isCurrentMonth: false,
                isDisabled: disablePastDates && isDayBeforeToday(d),
            });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday: today.toDateString() === currentDate.toDateString(),
                isSelected: date && currentDate.toDateString() === date.toDateString(),
                isDisabled: disablePastDates && isDayBeforeToday(currentDate),
            });
        }

        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day++) {
            const currentDate = new Date(year, month + 1, day);
            days.push({
                date: currentDate,
                isCurrentMonth: false,
                isDisabled: disablePastDates && isDayBeforeToday(currentDate),
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

const PO = () => {
    const { isMenuVisible, canCreate, canEdit, canDelete, canPrint } = useHasPermission();
    const permissionModule = "PROCUREMENT/PO";

    if (!isMenuVisible(permissionModule)) {
        return <Unauthorized />;
    }

    // Local interface extension to avoid modifying shared procurementSharedData.ts
    interface ExtendedPOData extends POData {
        payment_term_id?: string | number;
        currency_id?: string | number;
        currencyName?: string;
    }

    const { toast } = useToast();
    const queryClient = useQueryClient();
    const poStatuses = useCommonStore(state => state.poStatuses);
    const paymentTerms = useCommonStore(state => state.paymentTerms);
    const currenciesFromStore = useCommonStore(state => state.currencies);
    const entityValues = useCommonStore(state => state.entityValues);
    const currencies = useMemo(() => {
        if (currenciesFromStore.length > 0) return currenciesFromStore;
        return entityValues.filter((r: { entity_type_name?: string; entity_type_code?: string }) =>
            isCurrencyEntityName(r?.entity_type_name, r?.entity_type_code)
        );
    }, [currenciesFromStore, entityValues]);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isSubmittingPO, setIsSubmittingPO] = useState(false);

    // Filter states - moved to top to avoid use-before-define errors
    const [poSearchTerm, setPoSearchTerm] = useState("");
    const debouncedPoSearchTerm = useDebounce(poSearchTerm, 500);
    const [poFilterDate, setPoFilterDate] = useState<Date | undefined>(undefined);
    const [poFilterWarehouse, setPoFilterWarehouse] = useState<number | string>("all");
    const appliedWarehouseFilterDefault = useRef(false);
    const [poFilterStatus, setPoFilterStatus] = useState<number | string>("");
    const [openingPOId, setOpeningPOId] = useState<number | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);

    const [requests, setRequests] = useState<MRRequestData[]>([]);
    const [pos, setPos] = useState<POData[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);

    const assignedWarehouseIds = getAssignedIds("warehouse");
    const orderedWarehouses = useMemo(
        () => prioritizeByAssigned(warehouses, assignedWarehouseIds, (wh) => wh.id),
        [warehouses, assignedWarehouseIds]
    );

    useEffect(() => {
        setRequests(getStoredMRs());

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "erp_mock_mrs") {
                setRequests(getStoredMRs());
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);
    
    const updateRequests = (newRequests: MRRequestData[]) => {
        setRequests(newRequests);
        saveMRs(newRequests);
    };

    useEffect(() => {
        // Fetch Warehouses from API
        const fetchWarehouses = async () => {
            try {
                const res = await commonApi.getWarehouses();
                if (res.isSuccessful && res.data?.records) {
                    setWarehouses(res.data.records.map((wh: any) => ({
                        id: Number(wh.warehouse_id || wh.id),
                        name: wh.warehouse_name || wh.name || wh.value_name || "Unknown Warehouse",
                        code: wh.warehouse_code || wh.code || wh.value_code
                    })));
                }
            } catch (error) {
                console.error("Failed to fetch warehouses:", error);
            }
        };

        fetchWarehouses();
    }, []);

    // Auto-select first assigned warehouse in listing filter (once, when assigned exist)
    useEffect(() => {
        if (appliedWarehouseFilterDefault.current) return;
        if (!assignedWarehouseIds.length || orderedWarehouses.length === 0) return;

        const firstAssigned = getFirstAssignedMatch(
            assignedWarehouseIds,
            orderedWarehouses.map((wh) => wh.id)
        );
        if (firstAssigned) {
            setPoFilterWarehouse(String(firstAssigned));
            appliedWarehouseFilterDefault.current = true;
        }
    }, [assignedWarehouseIds, orderedWarehouses]);

    // Set default status to 'Draft PO' reactively when statuses load
    useEffect(() => {
        if (poFilterStatus === "" && poStatuses.length > 0) {
            const draft = poStatuses.find(s => s.name === "Draft PO");
            if (draft) {
                setPoFilterStatus(draft.id);
            }
        }
    }, [poStatuses, poFilterStatus]);

    useEffect(() => {
        // Only load if needed or rely on useQuery

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "erp_mock_pos") {
                setPos(getStoredPOs());
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedPoSearchTerm, poFilterDate, poFilterWarehouse, poFilterStatus]);

    const updatePos = (newPos: POData[]) => {
        setPos(newPos);
        savePOs(newPos);
    };

    const { data: poResponse, isLoading: isPoLoading, isFetching: isPoFetching, refetch } = useQuery({
        queryKey: ['po-list', debouncedPoSearchTerm, poFilterDate, poFilterWarehouse, poFilterStatus, currentPage, itemsPerPage],
        queryFn: async () => {
            const res = await procurementApi.getPOList({
                page: currentPage,
                limit: itemsPerPage,
                text_search: debouncedPoSearchTerm,
                warehouse: String(poFilterWarehouse),
                date: poFilterDate ? format(poFilterDate, "yyyy-MM-dd") : undefined,
                status: String(poFilterStatus)
            });
            if (res.isSuccessful && res.data) {
                // Map API names to local names to avoid UI changes
                const mappedPos = res.data.records.map((r: any) => ({
                    id: r.id,
                    poNumber: r.po_code,
                    poDate: r.po_date,
                    vendorName: r.vendor_name,
                    location: r.location_name,
                    warehouseName: r.warehouse_name,
                    status: r.status_name as POStatus,
                    // Fallback fields for simplified listing (full details fetched on View/Edit)
                    mrCode: "",
                    department: "",
                    workCenter: "",
                    createdBy: "",
                    paymentTerms: "",
                    items: [],
                    receptions: []
                }));
                // We keep the internal state as POData for the list, 
                // but activePO will use the extended interface
                setPos(mappedPos);
                setTotalItems(res.data.pagination.totalCount);
                return res.data;
            }
            return null;
        },
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        enabled: poStatuses.length > 0 && poFilterStatus !== "",
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => procurementApi.deletePO(id),
        onSuccess: (res) => {
            if (res.isSuccessful) {
                toast({
                    variant: "success",
                    title: "PO Deleted",
                    description: res.message || "Purchase Order deleted successfully.",
                    duration: 15000
                });
                queryClient.invalidateQueries({ queryKey: ['po-list'] });
                setIsDeletePOAlertOpen(false);
                setIsPODialogOpen(false);
            } else {
                const errorTitle = (res as any).errorType === 'validation' ? "Validation Error" :
                                   (res as any).errorType === 'business' ? "Business Error" : "Delete Failed";
                toast({
                    variant: "destructive",
                    title: errorTitle,
                    description: res.message,
                    duration: 15000
                });
            }
        },
        onError: (error: any) => {
            console.error("Error deleting PO:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
                duration: 15000
            });
        }
    });

    const [isPODialogOpen, setIsPODialogOpen] = useState(false);
    const [activePO, setActivePO] = useState<ExtendedPOData | null>(null);
    const [isPOEdit, setIsPOEdit] = useState(false);
    const isPOFormValid = activePO ? (
        activePO.items.every(item => (item.price && Number(item.price) > 0) && !!item.deliveryDate) &&
        (!!activePO.payment_term_id && String(activePO.payment_term_id) !== "0") &&
        (!!activePO.currency_id && String(activePO.currency_id) !== "0")
    ) : false;

    const poCurrencyDisplay = useMemo(() => {
        const code =
            activePO?.currencyName ||
            getCurrencyCode(findCurrencyByEntityId(currencies, activePO?.currency_id));
        return code ? getCurrencySymbol(code) : CURRENCY_SYMBOL;
    }, [activePO?.currencyName, activePO?.currency_id, currencies]);

    const [isDeletePOAlertOpen, setIsDeletePOAlertOpen] = useState(false);
    const [poToDeleteRecord, setPoToDeleteRecord] = useState<POData | null>(null);
    const [isCreatePOOpen, setIsCreatePOOpen] = useState(false);

    // Re-resolve currency when master data loads after PO detail fetch
    useEffect(() => {
        if (!isPODialogOpen || !activePO?.currency_id || currencies.length === 0) return;
        const match = findCurrencyByEntityId(currencies, activePO.currency_id);
        if (!match) return;
        const resolvedId = String(getCurrencyEntityId(match));
        const resolvedCode = getCurrencyCode(match);
        if (
            String(activePO.currency_id) !== resolvedId ||
            (resolvedCode && activePO.currencyName !== resolvedCode)
        ) {
            setActivePO((prev) =>
                prev
                    ? { ...prev, currency_id: resolvedId, currencyName: resolvedCode || prev.currencyName }
                    : null
            );
        }
    }, [isPODialogOpen, currencies, activePO?.id, activePO?.currency_id, activePO?.currencyName]);

    const handleOpenPO = async (po: POData, isEdit: boolean) => {
        if (isPoLoading || isPoFetching || openingPOId !== null) return;

        setOpeningPOId(po.id);
        // Show dialog immediately with list data while fetching details
        setActivePO(po as ExtendedPOData);
        setIsPOEdit(isEdit);
        setIsPODialogOpen(true);

        try {
            // Fetch both Detail and Receipts in parallel
            const [detailRes, receiptsRes] = await Promise.all([
                procurementApi.getPODetail(po.id),
                procurementApi.getPOReceiptItems(po.id)
            ]);

            if (detailRes.isSuccessful && detailRes.data) {
                const det = detailRes.data;
                // Robust mapping to handle potential double-nesting from different backend versions
                const receiptsData = receiptsRes.isSuccessful && receiptsRes.data ? (receiptsRes.data as any).data : null;
                const receipts = receiptsData?.receipts || (receiptsRes.data as any)?.receipts || [];
                
                const currencyMatch = findCurrencyByEntityId(currencies, det.currency_id);
                const detailedPO: ExtendedPOData = {
                    ...po, // Retain existing summary fields
                    id: det.id,
                    poNumber: det.po_code,
                    poDate: det.po_date,
                    location: det.location_name,
                    vendorName: det.vendor_name,
                    warehouseName: det.warehouse_name,
                    status: det.status_name as POStatus,
                    payment_term_id: det.payment_term_id || "",
                    paymentTerms: det.payment_term_name || "",
                    currency_id: currencyMatch
                        ? String(getCurrencyEntityId(currencyMatch))
                        : (det.currency_id != null ? String(det.currency_id) : ""),
                    currencyName: currencyMatch
                        ? getCurrencyCode(currencyMatch)
                        : (det.currency_name || ""),
                    notes: String(det.remarks ?? "").trim(),
                    items: det.items.map(item => ({
                        id: item.id,
                        itemCode: item.item_code,
                        itemName: item.item_name,
                        uom: item.uom,
                        type: "RM", 
                        requiredQty: item.requested_qty,
                        availableQty: 0,
                        quotations: [],
                        qtyReceived: item.received_qty,
                        price: Number(item.price_per_uom) || 0,
                        deliveryDate: item.delivery_date || ""
                    })),
                    receptions: receipts.map((r: any) => ({
                        id: r.grn_item_id,
                        itemCode: r.item.code,
                        itemName: r.item.name,
                        receivedQty: r.received_qty,
                        deliveryDate: r.receive_date,
                        note: r.remarks || "",
                        attachmentName: r.document_name ? getFileName(r.document_name) : undefined,
                        fileUrl: r.document_name || undefined
                    }))
                };
                setActivePO(detailedPO);
            }
        } catch (error) {
            console.error("Failed to fetch PO details/receipts:", error);
            toast({
                variant: "destructive",
                title: "Error fetching details",
                description: "Could not load full purchase order details. Please try again.",
                duration: 15000
            });
        } finally {
            setOpeningPOId(null);
        }
    };
    
    // API Submit Logic
    const handleSaveOrSubmitPO = async (submitType: 'draft' | 'submit') => {
        if (!activePO) return;
        
        // Validation for Submit
        if (submitType === 'submit') {
            const incomplete = activePO.items.some(i => !i.price || !i.deliveryDate);
            if (incomplete) {
                toast({ 
                    title: "Incomplete PO", 
                    description: "Please fill price and delivery date for all items before submitting.", 
                    variant: "destructive",
                    duration: 15000 
                });
                return;
            }
        }
        
        if (submitType === 'draft') {
            setIsSavingDraft(true);
        } else {
            setIsSubmittingPO(true);
        }
        setIsSaving(true);
        try {
            const payload: POSubmitRequest = {
                payment_term_id: Number(activePO.payment_term_id) || 0,
                currency_id: Number(activePO.currency_id) || 0,
                remarks: activePO.notes || "",
                items: activePO.items.map(item => ({
                    id: item.id,
                    price_per_uom: Number(item.price) || 0,
                    delivery_date: item.deliveryDate ? (() => {
                        const d = parseDateString(item.deliveryDate);
                        return isValid(d) ? format(d, "yyyy-MM-dd") : "";
                    })() : ""
                }))
            };
            
            const res = submitType === 'draft' 
                ? await procurementApi.savePODraft(activePO.id, payload)
                : await procurementApi.submitPO(activePO.id, payload);
                
            if (res.isSuccessful) {
                toast({ 
                    variant: "success", 
                    title: submitType === 'draft' ? "PO Draft Saved" : "PO Submitted Successfully",
                    description: res.message,
                    duration: 15000 
                });
                setIsPODialogOpen(false);
                refetch(); // Reload the list to show updated status
            } else {
                const errorTitle = (res as any).errorType === 'validation' ? "Validation Error" :
                                   (res as any).errorType === 'business' ? "Business Error" : "Error";
                toast({ variant: "destructive", title: errorTitle, description: res.message, duration: 15000 });
            }
        } catch (error: any) {
            console.error(`Failed to ${submitType} PO:`, error);
            toast({ variant: "destructive", title: "Operation Failed", description: error.message, duration: 15000 });
        } finally {
            setIsSavingDraft(false);
            setIsSubmittingPO(false);
            setIsSaving(false);
        }
    };

    const handleUpdateItemPrice = (itemId: number, value: string) => {
        if (!activePO) return;

        // Allow only numbers and one decimal point
        let cleanedValue = value.replace(/[^0-9.]/g, '');
        
        // Ensure only one decimal point
        const parts = cleanedValue.split('.');
        if (parts.length > 2) {
            cleanedValue = parts[0] + '.' + parts.slice(1).join('');
        }

        // 6-digit limit for integer part
        if (parts[0].length > 6) {
            cleanedValue = parts[0].slice(0, 6) + (parts.length > 1 ? '.' + parts[1] : '');
        }

        // Optional: 2-digit limit for decimal part
        if (parts.length > 1 && parts[1].length > 2) {
            cleanedValue = parts[0] + '.' + parts[1].slice(0, 2);
        }

        setActivePO({
            ...activePO,
            items: activePO.items.map(item => 
                item.id === itemId ? { ...item, price: parseFloat(cleanedValue) || 0 } : item
            )
        });
    };

    const handleDeletePO = (poId: number) => {
        deleteMutation.mutate(poId);
    };

    const savePO = () => {
        if (!activePO) return;
        // Destructure to remove local-only field before saving to POData-typed state
        const { payment_term_id, ...poBase } = activePO;
        const updatedPO: POData = { ...poBase, status: "PO Confirmed" as POStatus };
        updatePos(pos.map((p: POData) => p.id === updatedPO.id ? updatedPO : p));
        setIsPODialogOpen(false);
        toast({
            variant: "success",
            title: "PO Saved",
            description: `Purchase Order ${updatedPO.poNumber} confirmed.`,
            duration: 15000
        });
    };

    const handlePrintPO = () => {
        const printContent = document.getElementById('printable-po-content');
        if (printContent) {
            let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'print-iframe';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }

            const doc = iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write('<html><head><title>Purchase Order</title>');
                doc.write('<style>');
                doc.write('body { font-family: sans-serif; padding: 20px; }');
                doc.write('.header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px; }');
                doc.write('.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }');
                doc.write('.label { font-size: 10px; font-weight: bold; color: #666; text-transform: uppercase; }');
                doc.write('.value { font-size: 14px; margin-top: 4px; font-weight: 500; }');
                doc.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
                doc.write('th, td { border: 1px solid #eee; padding: 12px; text-align: left; }');
                doc.write('th { background: #f9f9f9; font-size: 11px; text-transform: uppercase; }');
                doc.write('td { font-size: 12px; }');
                doc.write('.footer { margin-top: 50px; text-align: right; font-size: 10px; color: #999; }');
                doc.write('.hidden { display: none; }');
                doc.write('</style></head><body>');
                doc.write(printContent.innerHTML);
                doc.write('</body></html>');
                doc.close();

                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                }, 500);
            }
        }
    };

    const handleDownloadQuotation = (fileUrl: string) => {
        if (!fileUrl) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No file available.",
                duration: 15000
            });
            return;
        }

        window.open(resolveFileUrl(fileUrl), '_blank');
    };

    const isTableLoading = isPoLoading || isPoFetching;
    const isActionBusy = isTableLoading || openingPOId !== null;

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Purchase Orders</h1>
            </div>

            <AppListToolbar
                search={{
                    value: poSearchTerm,
                    onChange: setPoSearchTerm,
                    placeholder: "Search by PO Code, Vendor or Warehouse..."
                }}
                filters={[
                    {
                        type: 'select',
                        label: 'Warehouse',
                        value: poFilterWarehouse,
                        options: [
                            { label: "All Warehouse", value: "all" },
                            ...orderedWarehouses.map((wh) => ({ label: wh.name, value: String(wh.id) })),
                        ],
                        onChange: (val) => setPoFilterWarehouse(val === "all" ? "all" : String(val)),
                        searchable: true
                    },
                    {
                        type: 'date',
                        label: 'Date',
                        value: poFilterDate,
                        onChange: setPoFilterDate,
                        showClear: !!poFilterDate
                    },
                    {
                        type: 'select',
                        label: 'Status',
                        value: poFilterStatus,
                        options: [
                            { label: "All Status", value: "all" },
                            ...poStatuses.map(s => ({ label: s.name, value: s.id }))
                        ],
                        onChange: setPoFilterStatus,
                        searchable: true
                    }
                ]}
            />

            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">PO Code</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">PO Date</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Vendor</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Location</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Warehouse</TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-center w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isTableLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm text-muted-foreground">Loading...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : pos.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No Purchase Orders found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    pos.map((po) => (
                                        <TableRow key={po.id} className="hover:bg-muted/30 transition-colors border-b">
                                            <TableCell className="py-4 font-medium font-mono">{po.poNumber}</TableCell>
                                            <TableCell>{formatDate(po.poDate)}</TableCell>
                                            <TableCell className="font-bold text-primary">{po.vendorName || "N/A"}</TableCell>
                                            <TableCell>{po.location}</TableCell>
                                            <TableCell>{po.warehouseName || "N/A"}</TableCell>
                                            <TableCell className="text-center">
                                                {getPOStatusBadge(po.status)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className={cn(isActionBusy && "pointer-events-none opacity-50")}>
                                                    <TableActionButtons
                                                        onView={() => handleOpenPO(po, false)}
                                                        onEdit={(po.status === "Draft PO" || po.status === "Partially Completed PO") && canEdit(permissionModule) ? () => handleOpenPO(po, true) : undefined}
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {pos.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(totalItems / itemsPerPage)}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={(page) => setCurrentPage(page)}
                            onItemsPerPageChange={(limit) => setItemsPerPage(limit)}
                            options={[10, 15, 30, 50]}
                        />
                    )}
                </CardContent>
            </Card>

            {/* PO VIEW/EDIT DIALOG */}
            <Dialog open={isPODialogOpen} onOpenChange={setIsPODialogOpen}>
                <DialogContent
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 space-y-1 p-4 pb-2 sm:p-5 sm:pb-3">
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold sm:text-xl">
                            <FileText className="h-5 w-5 shrink-0 text-primary" />
                            <span className="truncate">
                                {(activePO?.status === "Draft PO" || activePO?.status === "Partially Completed PO") && isPOEdit
                                    ? "Edit Purchase Order"
                                    : "View Purchase Order"}
                                : {activePO?.poNumber}
                            </span>
                        </DialogTitle>
                        <DialogDescription className="text-xs leading-snug sm:text-sm">
                            {(activePO?.status === "Draft PO" || activePO?.status === "Partially Completed PO") && isPOEdit
                                ? "Update PO details, pricing and delivery dates."
                                : "Review PO details and item reception status."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                        <div className="space-y-5">
                        {/* Printable Content */}
                        <div id="printable-po-content" className="hidden">
                            <div className="header" style={{ textAlign: "center", marginBottom: "30px", borderBottom: "2px solid #eee", paddingBottom: "10px" }}>
                                <h1 style={{ margin: 0 }}>PURCHASE ORDER</h1>
                                <p style={{ color: "#666" }}>{activePO?.poNumber}</p>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", marginBottom: "30px" }}>
                                <div>
                                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>Vendor Name</div>
                                    <div style={{ fontSize: "14px", marginTop: "4px", fontWeight: "500", border: "1px solid #eee", padding: "8px", borderRadius: "4px", backgroundColor: "#fcfcfc" }}>
                                        {activePO?.vendorName || "Not Selected"}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>PO Date</div>
                                    <div style={{ fontSize: "14px", marginTop: "4px", fontWeight: "500" }}>{activePO?.poDate ? formatDate(activePO.poDate) : "N/A"}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>Location</div>
                                    <div style={{ fontSize: "14px", marginTop: "4px", fontWeight: "500" }}>{activePO?.location}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>Warehouse</div>
                                    <div style={{ fontSize: "14px", marginTop: "4px", fontWeight: "500" }}>{activePO?.warehouseName || "N/A"}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>Payment Terms</div>
                                    <div style={{ fontSize: "14px", marginTop: "4px", fontWeight: "500" }}>{activePO?.paymentTerms || "N/A"}</div>
                                </div>
                            </div>

                            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
                                <thead>
                                    <tr>
                                        <th style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", background: "#f9f9f9", fontSize: "11px", textTransform: "uppercase" }}>Item Code</th>
                                        <th style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", background: "#f9f9f9", fontSize: "11px", textTransform: "uppercase" }}>Item Name</th>
                                        <th style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", background: "#f9f9f9", fontSize: "11px", textTransform: "uppercase" }}>UOM</th>
                                        <th style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", background: "#f9f9f9", fontSize: "11px", textTransform: "uppercase" }}>Quantity</th>
                                        <th style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", background: "#f9f9f9", fontSize: "11px", textTransform: "uppercase" }}>Price</th>
                                        <th style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", background: "#f9f9f9", fontSize: "11px", textTransform: "uppercase" }}>Delivery Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activePO?.items.map((item) => (
                                        <tr key={item.id}>
                                            <td style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", fontSize: "12px" }}>{item.itemCode}</td>
                                            <td style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", fontSize: "12px" }}>{item.itemName}</td>
                                            <td style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", fontSize: "12px" }}>{item.uom}</td>
                                            <td style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", fontSize: "12px" }}>{item.requiredQty}</td>
                                            <td style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", fontSize: "12px" }}>{poCurrencyDisplay} {typeof item.price === 'number' ? item.price.toLocaleString() : (Number(item.price) || 0).toLocaleString()}</td>
                                            <td style={{ border: "1px solid #eee", padding: "12px", textAlign: "left", fontSize: "12px" }}>{item.deliveryDate ? formatDate(item.deliveryDate) : "N/A"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="footer" style={{ marginTop: "50px", textAlign: "right", fontSize: "10px", color: "#999" }}>
                                <p>Generated on {new Date().toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Visual UI */}
                        <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">PO Code</Label>
                                <p className="text-sm font-bold text-primary">{activePO?.poNumber}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">PO Date</Label>
                                <p className="text-sm font-medium">{activePO?.poDate ? formatDate(activePO.poDate) : "N/A"}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Location</Label>
                                <p className="text-sm font-medium">{activePO?.location}</p>
                            </div>
                            <div className="space-y-1 text-center">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground block">PO Status</Label>
                                {activePO && getPOStatusBadge(activePO.status)}
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Vendor</Label>
                                <p className="text-sm font-bold text-primary">{activePO?.vendorName || "N/A"}</p>
                            </div>
                            <div className="space-y-1 flex flex-col">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Warehouse</Label>
                                <p className="text-sm font-medium">{activePO?.warehouseName || "N/A"}</p>
                            </div>
                            <div className="space-y-1 flex flex-col">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Payment Terms<span className="text-destructive font-bold ml-0.5">*</span></Label>
                                {activePO?.status === "Draft PO" && isPOEdit ? (
                                    <SearchableSelect
                                        value={String(activePO?.payment_term_id || "")}
                                        options={paymentTerms.map(term => ({ value: String(term.id), label: term.name }))}
                                        onChange={(val) => {
                                            const selectedTerm = paymentTerms.find(t => String(t.id) === val);
                                            setActivePO((prev) => (prev ? { 
                                                ...prev, 
                                                payment_term_id: val,
                                                paymentTerms: selectedTerm ? selectedTerm.name : "" 
                                            } : null));
                                        }}
                                        placeholder="Select terms..."
                                        className="h-8 min-h-8 py-0"
                                    />
                                ) : (
                                    <p className="text-sm font-medium">{activePO?.paymentTerms}</p>
                                )}
                            </div>
                            <div className="space-y-1 flex flex-col">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Currency<span className="text-destructive font-bold ml-0.5">*</span></Label>
                                {activePO?.status === "Draft PO" && isPOEdit ? (
                                    <SearchableSelect
                                        value={String(activePO?.currency_id || "")}
                                        options={currencies.map((c) => ({
                                            value: String(getCurrencyEntityId(c) ?? ""),
                                            label: getCurrencyCode(c) || "—",
                                        }))}
                                        onChange={(val) => {
                                            const selected = findCurrencyByEntityId(currencies, val);
                                            setActivePO((prev) => (prev ? {
                                                ...prev,
                                                currency_id: val,
                                                currencyName: selected ? getCurrencyCode(selected) : "",
                                            } : null));
                                        }}
                                        placeholder="Select currency..."
                                        className="h-8 min-h-8 py-0"
                                    />
                                ) : (
                                    <p className="text-sm font-medium">
                                        {activePO?.currencyName ||
                                            getCurrencyCode(findCurrencyByEntityId(currencies, activePO?.currency_id)) ||
                                            "—"}
                                    </p>
                                )}
                            </div>
                        </div>

                        <Tabs defaultValue="po-items" className="w-full">
                            <TabsList className="mb-4 grid w-full grid-cols-2 sm:mb-5">
                                <TabsTrigger value="po-items" className="font-bold">PO Items</TabsTrigger>
                                <TabsTrigger value="receive-items" className="font-bold">Receive Items</TabsTrigger>
                            </TabsList>

                            <TabsContent value="po-items" className="space-y-4 outline-none sm:space-y-5">
                                <div className="overflow-hidden rounded-md border bg-white shadow-sm">
                                    <div
                                        className={cn(
                                            "overflow-x-auto",
                                            (activePO?.items.length ?? 0) > 4 &&
                                                "max-h-[min(42vh,380px)] overflow-y-auto custom-scrollbar"
                                        )}
                                    >
                                    <Table className="w-full min-w-[720px]">
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="text-[10px] font-bold uppercase py-3 pl-6">Items</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase py-3 text-center">Qty Ordered</TableHead>
                                                <TableHead className="text-[10px] font-bold uppercase py-3 text-center">UOM</TableHead>
                                                {activePO?.status === "Draft PO" && isPOEdit ? (
                                                    <>
                                                        <TableHead className="text-[10px] font-bold uppercase py-3 text-center w-28">Price/UOM</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase py-3 text-right pr-6 w-40">Delivery Date</TableHead>
                                                    </>
                                                ) : (
                                                    <>
                                                        <TableHead className="text-[10px] font-bold uppercase py-3 text-center w-28">Price/UOM</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase py-3 text-center w-40">Delivery Date</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase py-3 text-right pr-6">Qty Received</TableHead>
                                                    </>
                                                )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activePO?.items.map((item) => (
                                                <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                                                    <TableCell className="py-4 pl-6">
                                                        <div className="font-bold text-xs text-primary">{item.itemCode}</div>
                                                        <div className="text-xs text-slate-600 font-medium">{item.itemName}</div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-slate-700">{item.requiredQty}</TableCell>
                                                    <TableCell className="text-center text-xs font-medium text-slate-600 uppercase">{item.uom}</TableCell>

                                                    {activePO?.status === "Draft PO" && isPOEdit ? (
                                                        <>
                                                            <TableCell className="text-center min-w-[120px]">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <span className="text-xs font-bold text-slate-500">{poCurrencyDisplay}</span>
                                                                    <Input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        className="h-8 text-center font-bold px-1 flex-none"
                                                                        style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                                                                        value={item.price || ""}
                                                                        onChange={(e) => handleUpdateItemPrice(item.id, e.target.value)}
                                                                    />
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">/{item.uom}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right pr-6">
                                                                <DatePicker
                                                                    disablePastDates
                                                                    date={item.deliveryDate ? parseDateString(item.deliveryDate) : undefined}
                                                                    setDate={(d) => {
                                                                        if (d && isBefore(startOfDay(d), startOfDay(new Date()))) {
                                                                            toast({ title: "Invalid Date", description: "Delivery date cannot be in the past.", variant: "destructive", duration: 15000 });
                                                                            return;
                                                                        }
                                                                        setActivePO(prev => {
                                                                            if (!prev) return null;
                                                                            return {
                                                                                ...prev,
                                                                                items: prev.items.map(i => i.id === item.id ? { ...i, deliveryDate: d ? format(d, "dd-MM-yyyy") : undefined } : i)
                                                                            };
                                                                        });
                                                                    }}
                                                                />
                                                            </TableCell>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <TableCell className="text-center font-bold text-xs text-slate-700">
                                                                {poCurrencyDisplay} {typeof item.price === 'number' ? item.price.toLocaleString() : (Number(item.price) || 0).toLocaleString()}/{item.uom}
                                                            </TableCell>
                                                            <TableCell className="text-center text-xs font-medium text-slate-600">
                                                                {item.deliveryDate ? formatDate(item.deliveryDate) : "N/A"}
                                                            </TableCell>
                                                            <TableCell className="text-right pr-6">
                                                                <span className="font-bold text-primary">{item.qtyReceived || 0}</span>
                                                            </TableCell>
                                                        </>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="receive-items" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                                <div className="overflow-hidden rounded-md border bg-white shadow-sm">
                                    <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
                                        <FileText className="h-4 w-4 text-slate-400" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Reception Entries</span>
                                    </div>
                                    <div
                                        className={cn(
                                            "overflow-x-auto",
                                            (activePO?.receptions?.length ?? 0) > 4 &&
                                                "max-h-[min(42vh,380px)] overflow-y-auto custom-scrollbar"
                                        )}
                                    >
                                    <Table className="w-full min-w-[640px]">
                                        <TableHeader className="bg-slate-50/50">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider pl-6">Item</TableHead>
                                                <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider text-right">Qty</TableHead>
                                                <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider">Date</TableHead>
                                                <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider">Document</TableHead>
                                                <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider">Note</TableHead>
                                                <TableHead className="font-bold text-slate-500 py-3 uppercase text-[10px] tracking-wider text-right pr-6">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activePO?.receptions && activePO.receptions.length > 0 ? (
                                                activePO.receptions.map((r) => (
                                                    <TableRow key={r.id} className="hover:bg-slate-50/10 border-slate-50">
                                                        <TableCell className="pl-6">
                                                            <div className="font-medium text-slate-900">{r.itemCode}</div>
                                                            <div className="text-[10px] text-slate-400">{r.itemName}</div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-slate-900">{r.receivedQty}</TableCell>
                                                        <TableCell className="text-slate-600 text-xs">{r.deliveryDate ? formatDate(r.deliveryDate) : "N/A"}</TableCell>
                                                        <TableCell>
                                                            {r.attachmentName ? (
                                                                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-medium flex items-center gap-1 w-fit cursor-pointer hover:bg-blue-100" onClick={() => handleDownloadQuotation(r.fileUrl!)}>
                                                                        <Paperclip className="h-3 w-3" />
                                                                        {truncateFileName(r.attachmentName!)}
                                                                    </Badge>
                                                            ) : "-"}
                                                        </TableCell>
                                                        <TableCell className="text-slate-600 text-xs">{r.note || "-"}</TableCell>
                                                        <TableCell className="text-right pr-6">
                                                            {r.attachmentName && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                                                                    title="Download Document"
                                                                    onClick={() => handleDownloadQuotation(r.fileUrl!)}
                                                                >
                                                                    <Download className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                                                        No items received yet. Items will appear here once received.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="shrink-0 space-y-2">
                            <Label className="text-sm font-bold text-slate-700">Notes / Remarks</Label>
                            {activePO?.status === "Draft PO" && isPOEdit ? (
                                <Textarea
                                    placeholder="Add any notes or remarks about this purchase order..."
                                    className="min-h-[80px] max-h-[80px] overflow-y-auto bg-white border-slate-200 resize-none custom-scrollbar"
                                    value={activePO?.notes || ""}
                                    onChange={(e) =>
                                        setActivePO((prev) => (prev ? { ...prev, notes: e.target.value } : null))
                                    }
                                />
                            ) : (
                                <div className="min-h-[80px] max-h-[80px] overflow-y-auto custom-scrollbar w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                                    {activePO?.notes?.trim() ? (
                                        <p className="whitespace-pre-wrap text-slate-900">{activePO.notes}</p>
                                    ) : (
                                        <p className="text-muted-foreground">—</p>
                                    )}
                                </div>
                            )}
                        </div>
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t bg-background px-4 pb-4 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div className="flex w-full justify-start sm:w-auto">
                            {activePO?.status === "Draft PO" && isPOEdit && canDelete(permissionModule) && (
                                <Button
                                    variant="destructive"
                                    disabled={isSaving}
                                    className="w-full sm:w-auto"
                                    onClick={() => {
                                        setPoToDeleteRecord(activePO as POData);
                                        setIsDeletePOAlertOpen(true);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </Button>
                            )}
                        </div>

                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                            <Button variant="outline" onClick={() => setIsPODialogOpen(false)} className="w-full sm:w-auto">
                                Close
                            </Button>

                            {activePO?.status === "Draft PO" && isPOEdit && canEdit(permissionModule) && (
                                <>
                                    <Button
                                        variant="secondary"
                                        className="w-full font-bold text-sm sm:w-auto"
                                        disabled={isSaving || !isPOFormValid}
                                        loading={isSavingDraft}
                                        onClick={() => handleSaveOrSubmitPO('draft')}
                                    >
                                        Save Draft
                                    </Button>
                                    <Button
                                        className="w-full bg-emerald-600 font-bold hover:bg-emerald-700 sm:w-auto"
                                        disabled={isSaving || !isPOFormValid}
                                        loading={isSubmittingPO}
                                        onClick={() => handleSaveOrSubmitPO('submit')}
                                    >
                                        Submit PO
                                    </Button>
                                </>
                            )}

                            {activePO?.status === "Partially Completed PO" && isPOEdit && canEdit(permissionModule) && (
                                <Button
                                    className="w-full bg-primary font-bold hover:bg-primary/90 sm:w-auto"
                                    onClick={() => {
                                        const completedPO = { ...activePO, status: "Completed PO" as POStatus };
                                        updatePos(pos.map(p => p.id === activePO.id ? completedPO : p));
                                        setIsPODialogOpen(false);
                                        toast({
                                            variant: "success",
                                            title: "PO Completed",
                                            description: "Purchase Order has been marked as Completed.",
                                            duration: 15000
                                        });
                                    }}
                                >
                                    <Check className="h-4 w-4 mr-2" />
                                    Complete PO
                                </Button>
                            )}

                            {activePO?.status === "Submitted PO" && !isPOEdit && canPrint(permissionModule) && (
                                <Button
                                    onClick={handlePrintPO}
                                    className="w-full bg-blue-600 font-bold text-white hover:bg-blue-600/90 sm:w-auto"
                                >
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print PO
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DeletePOAlert
                isOpen={isDeletePOAlertOpen}
                setOpen={setIsDeletePOAlertOpen}
                po={poToDeleteRecord}
                onDelete={handleDeletePO}
                isDeleting={deleteMutation.isPending}
            />
            
            <CreatePODialog
                isOpen={isCreatePOOpen}
                setOpen={setIsCreatePOOpen}
                requests={requests}
                pos={pos}
                updatePos={updatePos}
                updateRequests={updateRequests}
                warehouses={warehouses}
            />
        </div>
    );
};

const DeletePOAlert = ({ isOpen, setOpen, po, onDelete, isDeleting }: {
    isOpen: boolean,
    setOpen: (o: boolean) => void,
    po: POData | null,
    onDelete: (id: number) => void,
    isDeleting: boolean
}) => {
    return (
        <AlertDialog open={isOpen} onOpenChange={setOpen}>
            <AlertDialogContent className="sm:max-w-[425px]">
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete this purchase order? This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button
                        variant="destructive"
                        disabled={isDeleting}
                        loading={isDeleting}
                        onClick={(e) => {
                            e.preventDefault(); // Prevent closing immediately to show loading
                            if (po) {
                                onDelete(po.id);
                            }
                        }}
                    >
                        Delete
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

const CreatePODialog = ({ isOpen, setOpen, requests, pos, updatePos, updateRequests, warehouses }: {
    isOpen: boolean,
    setOpen: (o: boolean) => void,
    requests: MRRequestData[],
    pos: POData[],
    updatePos: (newPos: POData[]) => void,
    updateRequests: (newRequests: MRRequestData[]) => void,
    warehouses: any[]
}) => {
    const { toast } = useToast();
    const [selectedMRId, setSelectedMRId] = useState<number | null>(null);
    const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState("");
    const [selectedVendor, setSelectedVendor] = useState("");

    const activeMR = requests.find(r => r.id === selectedMRId);
    const pendingMRs = requests.filter(r => r.status === "Requested MR" || r.status === "MR in Fullfillment");

    const handleCreatePO = () => {
        if (!activeMR || selectedItemIds.length === 0 || !selectedVendor || !selectedWarehouse) {
            toast({
                title: "Validation Error",
                description: "Please select an MR, items, vendor, and warehouse.",
                variant: "destructive"
            });
            return;
        }

        const poNum = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const selectedItems = activeMR.items.filter(item => selectedItemIds.includes(item.id));

        const updatedRequest = JSON.parse(JSON.stringify(activeMR)) as MRRequestData;
        updatedRequest.items.forEach(item => {
            if (selectedItemIds.includes(item.id)) {
                item.poNumber = poNum;
            }
        });

        const allDone = updatedRequest.items.every(i => !!i.poNumber);
        if (allDone) {
            updatedRequest.status = "MR in Fullfillment";
        }

        const newPO: POData = {
            id: Date.now(),
            poNumber: poNum,
            poDate: format(new Date(), "dd-MM-yyyy"),
            mrCode: updatedRequest.mrCode,
            location: updatedRequest.location,
            department: updatedRequest.department,
            workCenter: updatedRequest.workCenter,
            createdBy: "Admin User",
            vendorName: selectedVendor,
            warehouseName: selectedWarehouse,
            paymentTerms: "Net 30",
            items: JSON.parse(JSON.stringify(selectedItems)),
            status: "Draft PO",
            receptions: []
        };

        updatePos([...pos, newPO]);
        updateRequests(requests.map(r => r.id === updatedRequest.id ? updatedRequest : r));
        
        setOpen(false);
        setSelectedMRId(null);
        setSelectedItemIds([]);
        setSelectedWarehouse("");
        setSelectedVendor("");
        
        toast({
            variant: "success",
            title: "PO Created",
            description: `Purchase Order ${poNum} successfully generated.`,
            duration: 15000
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(val) => {
            setOpen(val);
            if (!val) {
                setSelectedMRId(null);
                setSelectedItemIds([]);
            }
        }}>
            <DialogContent
                className="sm:max-w-[700px]"
                onPointerDownOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 text-primary" />
                        Create Purchase Order
                    </DialogTitle>
                    <DialogDescription>
                        Create a PO from a Material Request.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Select Material Request</Label>
                        <Select
                            value={selectedMRId?.toString() || ""}
                            onValueChange={(val) => {
                                setSelectedMRId(parseInt(val));
                                setSelectedItemIds([]);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select MR..." />
                            </SelectTrigger>
                            <SelectContent>
                                {pendingMRs.map(mr => (
                                    <SelectItem key={mr.id} value={mr.id.toString()}>
                                        {mr.mrCode} - {mr.workCenter} ({formatDate(mr.mrDate)})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {activeMR && (
                        <>
                            <div className="space-y-2">
                                <Label>Select Items from {activeMR.mrCode}</Label>
                                <div className="border rounded-md max-h-[200px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="w-12 text-center">
                                                    <Checkbox
                                                        checked={selectedItemIds.length === activeMR.items.filter(i => !i.poNumber).length && activeMR.items.filter(i => !i.poNumber).length > 0}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedItemIds(activeMR.items.filter(i => !i.poNumber).map(i => i.id));
                                                            } else {
                                                                setSelectedItemIds([]);
                                                            }
                                                        }}
                                                    />
                                                </TableHead>
                                                <TableHead>Item</TableHead>
                                                <TableHead className="text-center">Qty</TableHead>
                                                <TableHead className="text-right pr-4">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activeMR.items.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="text-center">
                                                        <Checkbox
                                                            disabled={!!item.poNumber}
                                                            checked={selectedItemIds.includes(item.id)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) setSelectedItemIds(prev => [...prev, item.id]);
                                                                else setSelectedItemIds(prev => prev.filter(id => id !== item.id));
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-xs font-bold">{item.itemCode}</div>
                                                        <div className="text-[10px] text-muted-foreground">{item.itemName}</div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold">{item.requiredQty}</TableCell>
                                                    <TableCell className="text-right pr-4">
                                                        {item.poNumber ? (
                                                            <Badge variant="outline" className="text-[9px] h-4 uppercase">Linked</Badge>
                                                        ) : (
                                                            <span className="text-[9px] text-muted-foreground uppercase">Pending</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Vendor</Label>
                                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose Vendor..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {mockTransporters.map(v => (
                                                <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Warehouse</Label>
                                    <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose Warehouse..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {warehouses.map(wh => (
                                                <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button
                        disabled={!activeMR || selectedItemIds.length === 0 || !selectedVendor || !selectedWarehouse}
                        onClick={handleCreatePO}
                    >
                        Create PO
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PO;
