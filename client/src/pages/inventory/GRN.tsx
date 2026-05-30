/**
 * GRN (Goods Received Note) Component
 * 
 * Features:
 * - Real-time quantity validation (prevents over-receiving)
 * - Document management with "grey-click" for unsaved files
 * - Universal deletion (handles both staged and saved entries)
 * - PO detail fetching and status synchronization
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { inventoryApi, GRNListRecord } from "@/lib/api";
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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandInputBorderless,
} from "@/components/ui/command";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, resolveFileUrl, getFileName, truncateFileName } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { SearchableSelect as SharedSearchableSelect } from "@/components/shared/SearchableSelect";
import { DatePicker as SharedDatePicker } from "@/components/shared/DatePicker";
import { commonApi } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

import {
    POStatus,
    MRItem as POItem,
    ReceptionEntry,
    POData,
    getStoredPOs,
    savePOs
} from "@/lib/procurementSharedData";

/** 
 * Local type extension to handle UI-specific states (isSaved, fileUrl)
 * without modifying shared library interfaces.
 */
interface ExtendedReceptionEntry extends ReceptionEntry {
    fileUrl?: string;     // Backend path to the file
    isSaved?: boolean;    // Flag for persistence status
    attachmentFile?: File; // Local binary file object for upload
}

type GRNPOData = POData & {
    currencyId?: number;
    currencyCode?: string;
};

type GRNPOItem = POItem & {
    priceDisplay?: string;
};

const getCurrencySymbol = (currencyCode: string): string => {
    const clean = String(currencyCode || "").trim().toUpperCase();
    if (!clean) return "";
    const symbols: Record<string, string> = {
        USD: "$",
        EUR: "€",
        GBP: "£",
        INR: "₹",
        JPY: "¥",
        CNY: "¥",
        AUD: "A$",
        CAD: "C$",
        UGX: "USh",
    };
    return symbols[clean] || clean;
};

/** GRN detail API: { po, items } or legacy flat PODetail shape. */
const parseGrnDetailPayload = (data: Record<string, unknown>) => {
    if (data?.po != null) {
        return {
            po: (data.po || {}) as Record<string, unknown>,
            items: (Array.isArray(data.items) ? data.items : []) as Record<string, unknown>[],
        };
    }
    return {
        po: data as Record<string, unknown>,
        items: (Array.isArray(data.items) ? data.items : []) as Record<string, unknown>[],
    };
};

const formatGrnPriceUom = (
    item: GRNPOItem,
    currencyCode?: string
): string => {
    const sym = getCurrencySymbol(currencyCode || "");
    const fromApi = String(item.priceDisplay || "").trim();
    if (fromApi) {
        if (/^[₹$€£]/.test(fromApi) || /^[A-Z]{2,4}\s/.test(fromApi)) return fromApi;
        return sym ? `${sym}${fromApi}` : fromApi;
    }
    return `${sym}${item.price ?? 0}/${item.uom || ""}`;
};
// import { mockWarehouses } from "@/lib/masterMockData"; // Replaced with API fetch
import {
    getAssignedIds,
    getFirstAssignedMatch,
    prioritizeByAssigned,
} from "@/utils/assignedDropdown";

// ============================================================================
// MOCK DATA
// ============================================================================

// MOCK DATA IS NOW IN lib/procurementSharedData.ts

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

function FormDatePicker({ date, setDate, disabled = false, minDate, blockedDates }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean,
    minDate?: Date,
    blockedDates?: Date[]
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
            return format(date, "dd-MM-yyyy");
        } catch (error) {
            return "Pick a date";
        }
    };

    const handleDateSelect = (selectedDate: Date) => {
        const selected = new Date(selectedDate);
        selected.setHours(0, 0, 0, 0);

        let isBeforeMinDate = false;
        if (minDate) {
            const minimumDate = new Date(minDate);
            minimumDate.setHours(0, 0, 0, 0);
            isBeforeMinDate = selected < minimumDate;
        }

        const isBlocked = blockedDates?.some(blockedDate => {
            const blocked = new Date(blockedDate);
            blocked.setHours(0, 0, 0, 0);
            return blocked.getTime() === selected.getTime();
        });

        if (!isBeforeMinDate && !isBlocked) {
            setDate(selectedDate);
            setIsOpen(false);
            setViewMode("day");
        }
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
        let minimumDate: Date | null = null;
        if (minDate) {
            minimumDate = new Date(minDate);
            minimumDate.setHours(0, 0, 0, 0);
        }

        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const dayDate = new Date(year, month - 1, prevMonthLastDay - i);
            dayDate.setHours(0, 0, 0, 0);
            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false,
                isPast: minimumDate ? dayDate < minimumDate : false
            });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            currentDate.setHours(0, 0, 0, 0);
            const isToday = new Date().toDateString() === currentDate.toDateString();
            const isSelected = date && currentDate.toDateString() === date.toDateString();
            const isPast = minimumDate ? currentDate < minimumDate : false;

            const isBlocked = blockedDates?.some(blockedDate => {
                const blocked = new Date(blockedDate);
                blocked.setHours(0, 0, 0, 0);
                return blocked.getTime() === currentDate.getTime();
            });

            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday,
                isSelected,
                isPast: isPast || isBlocked
            });
        }

        return days;
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal h-10 bg-background border-input",
                        !date && "text-muted-foreground"
                    )}
                    disabled={disabled}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDisplayDate(date)}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 bg-popover text-popover-foreground">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => viewMode === "day" ? navigateMonth(-1) : setVisibleDate(new Date(visibleDate.getFullYear() - (viewMode === "year" ? 12 : 1), visibleDate.getMonth(), 1))}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="font-semibold px-2 h-7"
                                onClick={() => setViewMode(viewMode === "month" ? "day" : "month")}
                            >
                                {monthNames[visibleDate.getMonth()]}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="font-semibold px-2 h-7"
                                onClick={() => setViewMode(viewMode === "year" ? "day" : "year")}
                            >
                                {visibleDate.getFullYear()}
                            </Button>
                        </div>

                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => viewMode === "day" ? navigateMonth(1) : setVisibleDate(new Date(visibleDate.getFullYear() + (viewMode === "year" ? 12 : 1), visibleDate.getMonth(), 1))}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {viewMode === "day" && (
                        <>
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                                    <div key={day} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-1">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {getDaysInMonth(visibleDate).map((day, idx) => (
                                    <Button
                                        key={idx}
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                            "h-8 w-8 p-0 font-normal",
                                            !day.isCurrentMonth && "text-muted-foreground opacity-50",
                                            day.isToday && "bg-accent text-accent-foreground",
                                            day.isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                                            day.isPast && "text-muted-foreground opacity-20 pointer-events-none"
                                        )}
                                        onClick={() => handleDateSelect(day.date)}
                                        disabled={day.isPast}
                                    >
                                        {day.date.getDate()}
                                    </Button>
                                ))}
                            </div>
                        </>
                    )}

                    {viewMode === "month" && (
                        <div className="grid grid-cols-3 gap-2 p-2">
                            {monthNamesShort.map((month, idx) => (
                                <Button
                                    key={month}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-9 w-full font-normal",
                                        visibleDate.getMonth() === idx && "bg-accent text-accent-foreground"
                                    )}
                                    onClick={() => handleMonthSelect(idx)}
                                >
                                    {month}
                                </Button>
                            ))}
                        </div>
                    )}

                    {viewMode === "year" && (
                        <div className="grid grid-cols-3 gap-2 p-2">
                            {Array.from({ length: 12 }, (_, i) => visibleDate.getFullYear() - 5 + i).map((year) => (
                                <Button
                                    key={year}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-9 w-full font-normal",
                                        visibleDate.getFullYear() === year && "bg-accent text-accent-foreground"
                                    )}
                                    onClick={() => handleYearSelect(year)}
                                >
                                    {year}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// SearchableSelect removed in favor of shared component


function getPOStatusBadge(status: POStatus) {
    switch (status) {
        case "Draft PO": return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none px-3 py-1 text-[10px] font-bold">Draft PO</Badge>;
        case "Submitted PO": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none px-3 py-1 text-[10px] font-bold">Submitted PO</Badge>;
        case "Partially Completed PO": return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none px-3 py-1 text-[10px] font-bold">Partially Completed PO</Badge>;
        case "Completed PO": return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none px-3 py-1 text-[10px] font-bold">Completed PO</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
}

// ============================================================================
// MAIN GRN COMPONENT
// ============================================================================

export default function GRN() {
    const { isMenuVisible, canCreate, canEdit, canDelete } = useHasPermission();
    const permissionModule = "INVENTORY/GRN";

    if (!isMenuVisible(permissionModule)) {
        return <Unauthorized />;
    }

    const { toast } = useToast();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [pos, setPos] = useState<POData[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [statusFilter, setStatusFilter] = useState<number | string>("all");
    const [warehouseFilter, setWarehouseFilter] = useState<number | string>("all");
    const appliedWarehouseFilterDefault = useRef(false);
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    // Pagination state - using DataTablePagination component
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);

    const assignedWarehouseIds = getAssignedIds("warehouse");
    const orderedWarehouses = useMemo(
        () => prioritizeByAssigned(warehouses, assignedWarehouseIds, (wh) => wh.id),
        [warehouses, assignedWarehouseIds]
    );

    const [poItems, setPoItems] = useState<any[]>([]); // Items fetched for the specific PO
    const poStatuses = useCommonStore(state => state.poStatuses);
    const currencies = useCommonStore(state => state.currencies);

    useEffect(() => {
        // Fetch Warehouses from common API
        const fetchWarehouses = async () => {
            try {
                const res = await commonApi.getWarehouses();
                if (res.isSuccessful && res.data?.records) {
                    setWarehouses(res.data.records.map((wh: any) => ({
                        id: Number(wh.warehouse_id || wh.id),
                        name: wh.warehouse_name || wh.name || wh.value_name || "Unknown Warehouse"
                    })));
                }
            } catch (error) {
                console.error("Failed to fetch warehouses:", error);
            }
        };

        fetchWarehouses();
        setPos(getStoredPOs());

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "erp_mock_pos") {
                setPos(getStoredPOs());
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
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
            setWarehouseFilter(String(firstAssigned));
            appliedWarehouseFilterDefault.current = true;
        }
    }, [assignedWarehouseIds, orderedWarehouses]);

    const [hasSetDefaultGrnStatus, setHasSetDefaultGrnStatus] = useState(false);

    // Default to Submitted PO once when statuses load (do not override user choosing "All")
    useEffect(() => {
        if (hasSetDefaultGrnStatus || poStatuses.length === 0) return;
        const submitted = poStatuses.find((s) => s.name === "Submitted PO");
        if (submitted) {
            setStatusFilter(submitted.id);
        }
        setHasSetDefaultGrnStatus(true);
    }, [poStatuses, hasSetDefaultGrnStatus]);

    const updatePos = (newPos: POData[]) => {
        setPos(newPos);
        savePOs(newPos);
    };

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [isSavingGRN, setIsSavingGRN] = useState(false);
    const [openingPOId, setOpeningPOId] = useState<number | null>(null);
    const [selectedPO, setSelectedPO] = useState<GRNPOData | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Reception Form State
    const [grnDialogEl, setGrnDialogEl] = useState<HTMLDivElement | null>(null);
    const [receptionForm, setReceptionForm] = useState({
        itemCode: "",
        receivedQty: "",
        deliveryDate: undefined as Date | undefined,
        note: "",
        attachmentName: "",
        file: null as File | null
    });
    const [tempReceptions, setTempReceptions] = useState<ExtendedReceptionEntry[]>([]);
    const [qtyError, setQtyError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // React Query for GRN Listing
    const { data: grnResponse, isLoading: isGrnLoading, isFetching: isGrnFetching } = useQuery({
        queryKey: ['grn-list', debouncedSearchTerm, dateFilter, warehouseFilter, statusFilter, currentPage, itemsPerPage],
        queryFn: async () => {
            const res = await inventoryApi.getGRNList({
                page: currentPage,
                limit: itemsPerPage,
                text_search: debouncedSearchTerm,
                warehouse: String(warehouseFilter),
                date: dateFilter ? format(dateFilter, "yyyy-MM-dd") : undefined,
                status: statusFilter === "all" ? undefined : String(statusFilter)
            });
            if (res.isSuccessful && res.data) {
                setTotalItems(res.data.pagination.totalCount || 0);
                return res.data;
            }
            return null;
        },
        staleTime: 0,
        gcTime: 0,
        enabled: poStatuses.length > 0,
    });

    const grnRecords = (grnResponse?.records || []).filter(r => r.status !== "Draft PO");
    const totalPages = grnResponse?.pagination.totalPages || 0;

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, statusFilter, warehouseFilter, dateFilter]);

    // Handlers
    const refreshPOData = async (poId: number) => {
        setIsDetailLoading(true);
        try {
            const [detailRes, historyRes, itemsRes] = await Promise.all([
                inventoryApi.getGRNById(poId),
                inventoryApi.getGRNReceptionEntries(poId),
                commonApi.getItemsWithMR(poId)
            ]);

            if (itemsRes.isSuccessful && itemsRes.data?.records) {
                setPoItems(itemsRes.data.records);
            }

            if (detailRes.isSuccessful && detailRes.data) {
                const { po: poMeta, items: grnItems } = parseGrnDetailPayload(
                    detailRes.data as unknown as Record<string, unknown>
                );

                const mappedItems: GRNPOItem[] = grnItems.map((bItem) => {
                    const row = bItem as Record<string, unknown>;
                    const nestedItem = row.item as { code?: string; name?: string } | undefined;
                    return {
                        id: Number(row.po_item_id ?? row.id ?? 0),
                        itemCode: nestedItem?.code || "",
                        itemName: nestedItem?.name || "",
                        uom: String(row.uom || ""),
                        type: "RM",
                        requiredQty: Number(row.ordered_qty) || 0,
                        availableQty: 0,
                        quotations: [],
                        price: Number(row.price_per_uom) || 0,
                        priceDisplay: String(row.price_display || ""),
                        qtyReceived: Number(row.received_qty) || 0,
                        deliveryDate: String(row.delivery_date || ""),
                    };
                });

                const historyRecords = historyRes.isSuccessful && historyRes.data?.records ? historyRes.data.records : [];
                const mappedReceptions: ReceptionEntry[] = historyRecords.map((bRec: any) => ({
                    id: bRec.grn_item_id || bRec.id,
                    itemCode: bRec.item?.code || "",
                    itemName: bRec.item?.name || "",
                    receivedQty: bRec.received_qty || 0,
                    deliveryDate: bRec.receive_date || "",
                    note: bRec.remarks || "",
                    attachmentName: bRec.document_url || bRec.attachment || undefined,
                    fileUrl: bRec.document_url || bRec.attachment || undefined,
                    isSaved: true
                }));

                const currencyId = Number(poMeta.currency_id) || undefined;
                let currencyCode = String(poMeta.currency_code || "").trim();
                if (!currencyCode && currencyId) {
                    const match = currencies.find(
                        (c) =>
                            Number(c.id ?? c.value_id) === currencyId ||
                            Number(c.value_id) === currencyId
                    );
                    currencyCode = String(
                        match?.code || match?.value_code || match?.entity_value || ""
                    ).trim();
                }

                setSelectedPO((prev) => ({
                    ...(prev || ({} as GRNPOData)),
                    currencyId,
                    currencyCode,
                    poDate: String(poMeta.po_date || prev?.poDate || ""),
                    vendorName: String(poMeta.vendor_name || prev?.vendorName || ""),
                    location: String(poMeta.location_name || prev?.location || ""),
                    status: (String(poMeta.status || prev?.status || "").replace(/\.$/, "") || prev?.status) as POStatus,
                    items: mappedItems,
                    receptions: mappedReceptions as ExtendedReceptionEntry[],
                }));
            } else {
                toast({ 
                    title: "Fetch Error", 
                    description: detailRes.message || "Failed to load PO details.", 
                    variant: "destructive",
                    duration: 15000 
                });
            }
        } catch (error) {
            console.error("Error fetching GRN details:", error);
            toast({ 
                title: "Error", 
                description: "An unexpected error occurred while fetching details.", 
                variant: "destructive",
                duration: 15000 
            });
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleOpenPO = async (po: POData, edit: boolean) => {
        if (isGrnLoading || isGrnFetching || openingPOId !== null || isSavingGRN) return;

        setOpeningPOId(po.id);
        // Show dialog with basic info immediately
        setSelectedPO({ ...po });
        setIsEditMode(edit);
        setTempReceptions([]);
        setReceptionForm({
            itemCode: "",
            receivedQty: "",
            deliveryDate: undefined as Date | undefined,
            note: "",
            attachmentName: "",
            file: null
        });
        setIsDialogOpen(true);

        try {
            await refreshPOData(po.id);
        } finally {
            setOpeningPOId(null);
        }
    };

    const handleDownload = (fileName: string) => {
        if (!fileName) return;
        
        window.open(resolveFileUrl(fileName), '_blank');
        
        toast({ variant: "success", title: "Opening Document", description: `Opening ${getFileName(fileName)}...`, duration: 15000 });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
            const maxSizeBytes = 10 * 1024 * 1024; // 10MB
            
            const extension = file.name.split('.').pop()?.toLowerCase();
            if (!extension || !allowedExtensions.includes(extension)) {
                toast({
                    title: "Invalid File Type",
                    description: "Only JPG, JPEG, PNG, and PDF files are allowed.",
                    variant: "destructive",
                    duration: 15000
                });
                e.target.value = "";
                return;
            }

            if (file.size > maxSizeBytes) {
                toast({
                    title: "File Too Large",
                    description: "File size must be less than 10MB.",
                    variant: "destructive",
                    duration: 15000
                });
                e.target.value = "";
                return;
            }

            setReceptionForm(prev => ({ ...prev, attachmentName: file.name, file: file }));
        }
    };

    /**
     * Real-time validation for receiving quantity.
     * Checks against pending ordered quantity and currently staged temp entries.
     */
    const validateQty = (qtyStr: string, itemCode: string) => {
        if (!qtyStr || !itemCode || !selectedPO) {
            setQtyError(null);
            return;
        }

        const qty = parseFloat(qtyStr);
        if (isNaN(qty) || qty <= 0) {
            setQtyError(null);
            return;
        }

        const item = selectedPO.items.find(i => i.itemCode === itemCode);
        if (!item) return;

        const totalReceivedSoFar = (item.qtyReceived || 0) + tempReceptions
            .filter(r => r.itemCode === itemCode)
            .reduce((sum, r) => sum + r.receivedQty, 0);

        if (totalReceivedSoFar + qty > item.requiredQty) {
            setQtyError("Received quantity cannot be greater than ordered quantity");
        } else {
            setQtyError(null);
        }
    };

    const handleAddReception = () => {
        if (!receptionForm.itemCode || !receptionForm.receivedQty || !receptionForm.deliveryDate) {
            toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive", duration: 15000 });
            return;
        }

        const qty = parseFloat(receptionForm.receivedQty);
        if (isNaN(qty) || qty <= 0) {
            toast({ title: "Validation Error", description: "Invalid quantity.", variant: "destructive", duration: 15000 });
            return;
        }

        if (qtyError) return;
        
        const item = selectedPO?.items.find(i => i.itemCode === receptionForm.itemCode);
        if (!item) return;

        // VALIDATION: Prevent duplicate entries for the same Item + Receive Date before saving
        const formattedDate = format(receptionForm.deliveryDate!, "yyyy-MM-dd");
        const isDuplicate = tempReceptions.some(r => 
            r.itemCode === item.itemCode && 
            r.deliveryDate === formattedDate
        );

        if (isDuplicate) {
            toast({
                title: "Duplicate Entry",
                description: "This item is already added for the selected date. Delete the existing entry or save first before adding again.",
                variant: "destructive",
                duration: 15000
            });
            return;
        }

        const newEntry: ExtendedReceptionEntry = {
            id: Date.now(),
            itemCode: item.itemCode,
            itemName: item.itemName,
            receivedQty: qty,
            deliveryDate: format(receptionForm.deliveryDate!, "yyyy-MM-dd"), // Store in backend-ready format
            note: receptionForm.note,
            attachmentName: receptionForm.attachmentName,
            attachmentFile: receptionForm.file || undefined,
            isSaved: false
        };

        setTempReceptions(prev => [...prev, newEntry]);

        // Reset form
        setReceptionForm({
            itemCode: "",
            receivedQty: "",
            deliveryDate: undefined as Date | undefined,
            note: "",
            attachmentName: "",
            file: null
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    /**
     * handleDeleteReception: Manages the removal of reception entries.
     * 
     * Integration Details:
     * - For Staged Entries (!r.isSaved): Removes from local `tempReceptions` state.
     * - For Saved Entries (r.isSaved): Performs immediate API call to `deleteReceptionEntry`.
     * - After backend deletion, it triggers a full refresh of PO details to ensure
     *   quantities and historical list are perfectly synchronized.
     */
    const handleDeleteReception = async (r: ExtendedReceptionEntry) => {
        if (!r.isSaved) {
            // Temporary entry - just remove from state
            setTempReceptions(prev => prev.filter(x => x.id !== r.id));
            toast({ variant: "success", title: "Removed", description: "Temporary entry removed.", duration: 15000 });
        } else {
            // Saved entry - delete immediately from database
            if (isDeleting) return;

            setIsDeleting(true);
            try {
                const res = await inventoryApi.deleteReceptionEntry(r.id);
                if (res.isSuccessful) {
                    toast({ variant: "success", title: "Deleted", description: "Historical reception entry deleted successfully.", duration: 15000 });
                    // REFRESH INTEGRATION: Sync parent PO state after successful record removal
                    await refreshPOData(selectedPO!.id);
                } else {
                    toast({ variant: "destructive", title: "Error", description: res.message, duration: 15000 });
                }
            } catch (error: any) {
                toast({ variant: "destructive", title: "Error", description: error.message, duration: 15000 });
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const handleDeleteReceptionEntry = async (id: number) => {
        if (!selectedPO) return;
        
        try {
            const res = await inventoryApi.deleteReceptionEntry(id);
            if (res.isSuccessful) {
                toast({ variant: "success", title: "Success", description: res.message || "Reception entry deleted successfully.", duration: 15000 });
                
                // Refresh history from server
                const historyRes = await inventoryApi.getGRNReceptionEntries(selectedPO.id);
                if (historyRes.isSuccessful && historyRes.data?.records) {
                    const mappedReceptions: ReceptionEntry[] = historyRes.data.records.map((bRec: any) => ({
                        id: bRec.grn_item_id || bRec.id,
                        itemCode: bRec.item?.code || "",
                        itemName: bRec.item?.name || "",
                        receivedQty: bRec.received_qty || 0,
                        deliveryDate: bRec.receive_date || "",
                        note: bRec.remarks || "",
                        attachmentName: bRec.document_url || bRec.attachment || undefined,
                        fileUrl: bRec.document_url || bRec.attachment || undefined,
                        isSaved: true
                    }));
                    
                    setSelectedPO(prev => prev ? ({
                        ...prev,
                        receptions: mappedReceptions
                    }) : null);
                }
                
                // Invalidate list query
                queryClient.invalidateQueries({ queryKey: ['grn-list'] });
            } else {
                const errorTitle = (res as any).errorType === 'validation' ? "Validation Error" :
                                   (res as any).errorType === 'business' ? "Business Error" : "Error";
                toast({ title: errorTitle, description: res.message, variant: "destructive", duration: 15000 });
            }
        } catch (error: any) {
            console.error("Error deleting reception entry:", error);
            toast({ title: "Error", description: error.message, variant: "destructive", duration: 15000 });
        }
    };

    const handleSaveGRN = async () => {
        if (isSavingGRN) return;
        if (!selectedPO || tempReceptions.length === 0) {
            toast({ title: "No Items", description: "Please add at least one received item before saving.", variant: "destructive", duration: 15000 });
            return;
        }

        setIsSavingGRN(true);
        try {
            const formData = new FormData();
            formData.append('po_id', String(selectedPO.id));
            
            tempReceptions.forEach((r, index) => {
                const item = selectedPO.items.find(i => i.itemCode === r.itemCode);
                formData.append(`items[${index}][po_item_id]`, String(item?.id || 0));
                formData.append(`items[${index}][received_qty]`, String(r.receivedQty));
                formData.append(`items[${index}][receive_date]`, r.deliveryDate);
                formData.append(`items[${index}][remarks]`, r.note || "");
                
                if (r.attachmentFile) {
                    // Matching Postman's key name 'attachment'
                    formData.append('attachment', r.attachmentFile);
                }
            });

            const res = await inventoryApi.receiveGRNItems(formData);

            if (res.isSuccessful) {
                toast({ variant: "success", title: "Success", description: res.message || "GRN has been saved and quantities updated.", duration: 15000 });
                setTempReceptions([]);
                setIsDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ['grn-list'] });
            } else {
                const errorTitle = (res as any).errorType === 'validation' ? "Validation Error" :
                                   (res as any).errorType === 'business' ? "Business Error" : "Error";
                toast({ title: errorTitle, description: res.message, variant: "destructive", duration: 15000 });
            }
        } catch (error: any) {
            console.error("Error saving GRN:", error);
            toast({ title: "Error", description: error.message, variant: "destructive", duration: 15000 });
        } finally {
            setIsSavingGRN(false);
        }
    };

    const isTableLoading = isGrnLoading || isGrnFetching;
    const isActionBusy = isTableLoading || openingPOId !== null || isSavingGRN;

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold tracking-tight">Goods Received Note</h1>

            <div className="flex flex-col gap-6">
                <AppListToolbar
                    search={{
                        value: searchTerm,
                        onChange: setSearchTerm,
                        placeholder: "Search by PO Code or Vendor..."
                    }}
                    filters={[
                        {
                            type: 'select',
                            label: 'Warehouse',
                            value: warehouseFilter,
                            options: [
                                { label: "All Warehouse", value: "all" },
                                ...orderedWarehouses.map((wh) => ({ label: wh.name, value: String(wh.id) })),
                            ],
                            onChange: (val) => setWarehouseFilter(val === "all" ? "all" : String(val)),
                            searchable: true
                        },
                        {
                            type: 'select',
                            label: 'Status',
                            value: statusFilter,
                            options: [
                                { label: "All Statuses", value: "all" },
                                ...poStatuses
                                    .filter(s => s.name !== "Draft PO")
                                    .map(s => ({ label: s.name, value: s.id }))
                            ],
                            onChange: setStatusFilter,
                            searchable: true
                        },
                        {
                            type: 'date',
                            label: 'Date',
                            value: dateFilter,
                            onChange: setDateFilter,
                            showClear: true
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
                                    ) : grnRecords.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                                No Goods Received Notes found matching your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        grnRecords.map((record: GRNListRecord) => (
                                            <TableRow key={record.id} className="hover:bg-muted/30 transition-colors border-b">
                                                <TableCell className="py-4 font-medium font-mono">{record.po_code}</TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">{record.po_date}</TableCell>
                                                <TableCell className="py-4 text-sm font-bold text-primary">{record.vendor_name}</TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">{record.location_name}</TableCell>
                                                <TableCell className="py-4 text-sm font-medium text-slate-600">{record.warehouse_name}</TableCell>
                                                <TableCell className="py-4 text-center">{getPOStatusBadge(record.status as POStatus)}</TableCell>
                                                <TableCell className="py-4 text-center">
                                                    <div className={cn(isActionBusy && "pointer-events-none opacity-50")}>
                                                        <TableActionButtons
                                                            onView={() => {
                                                                const mappedPO: any = {
                                                                    id: record.id,
                                                                    poNumber: record.po_code,
                                                                    poDate: record.po_date,
                                                                    vendorName: record.vendor_name,
                                                                    location: record.location_name,
                                                                    warehouseName: record.warehouse_name,
                                                                    status: record.status as POStatus,
                                                                    items: [],
                                                                    receptions: []
                                                                };
                                                                handleOpenPO(mappedPO, false);
                                                            }}
                                                            onEdit={record.status !== "Completed PO" && canEdit(permissionModule) ? () => {
                                                                const mappedPO: any = {
                                                                    id: record.id,
                                                                    poNumber: record.po_code,
                                                                    poDate: record.po_date,
                                                                    vendorName: record.vendor_name,
                                                                    location: record.location_name,
                                                                    warehouseName: record.warehouse_name,
                                                                    status: record.status as POStatus,
                                                                    items: [],
                                                                    receptions: []
                                                                };
                                                                handleOpenPO(mappedPO, true);
                                                            } : undefined}
                                                        />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination - using standardized DataTablePagination component */}
                        {grnRecords.length > 0 && (
                            <DataTablePagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={totalItems}
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
                <DialogContent
                    ref={setGrnDialogEl}
                    className="flex! min-h-0 w-[95%] max-h-[82vh] flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="shrink-0 space-y-1 p-4 pb-2 sm:p-5 sm:pb-3">
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold sm:text-xl">
                            <Settings2 className="h-5 w-5 shrink-0 text-primary" />
                            <span className="truncate">
                                {isEditMode ? "Configure Goods Received:" : "View Goods Received:"} {selectedPO?.poNumber}
                            </span>
                        </DialogTitle>
                        <DialogDescription className="text-xs leading-snug sm:text-sm">
                            Review PO details and record incoming item quantities.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                        <div className="space-y-5">
                        {isDetailLoading ? (
                            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 sm:min-h-[320px]">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            </div>
                        ) : (
                        <>
                        {/* Read-only Info Grid */}
                        <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4 sm:gap-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">PO Date</Label>
                                <p className="text-sm font-medium">{selectedPO?.poDate}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Location</Label>
                                <p className="text-sm font-medium">{selectedPO?.location}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Vendor</Label>
                                <p className="text-sm font-medium">{selectedPO?.vendorName}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Status</Label>
                                <div className="pt-0.5">{selectedPO && getPOStatusBadge(selectedPO.status)}</div>
                            </div>
                        </div>

                        {/* Tabs */}
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
                                            (selectedPO?.items.length ?? 0) > 4 &&
                                                "max-h-[min(42vh,380px)] overflow-y-auto custom-scrollbar"
                                        )}
                                    >
                                    <Table className="w-full min-w-[720px]">
                                        <TableHeader>
                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider pl-4">Item</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider">UOM</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider">Price/UOM</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider text-right">Ordered Qty</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider text-right">Received Qty</TableHead>
                                                <TableHead className="font-bold text-[10px] py-3 uppercase tracking-wider text-right pr-4">Delivery Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedPO?.items.map((item) => {
                                                const stagedEntries = tempReceptions.filter(r => r.itemCode === item.itemCode);
                                                const savedEntries = selectedPO?.receptions?.filter(r => r.itemCode === item.itemCode) || [];
                                                const allEntries = [...savedEntries, ...stagedEntries];

                                                const totalReceived = item.qtyReceived + stagedEntries.reduce((s, r) => s + r.receivedQty, 0);
                                                const latestDeliveryDate = allEntries.length > 0
                                                    ? allEntries[allEntries.length - 1].deliveryDate
                                                    : item.deliveryDate || "-";

                                                return (
                                                    <TableRow key={item.id} className="hover:bg-muted/20 transition-colors border-slate-100">
                                                        <TableCell className="py-4 pl-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-xs text-primary">{item.itemCode}</span>
                                                                <span className="text-[10px] text-slate-500 font-medium">{item.itemName}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-[9px] text-muted-foreground uppercase font-bold">{item.uom}</TableCell>
                                                        <TableCell className="text-slate-900 font-medium">
                                                            {formatGrnPriceUom(item as GRNPOItem, selectedPO?.currencyCode)}
                                                        </TableCell>
                                                        <TableCell className="text-right text-primary font-bold">{item.requiredQty}</TableCell>
                                                        <TableCell className="text-right text-blue-600 font-bold">
                                                            {totalReceived}
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-500 font-medium pr-4 text-[10px]">
                                                            {latestDeliveryDate && latestDeliveryDate !== "-" ? (
                                                                (() => {
                                                                    const d = new Date(latestDeliveryDate);
                                                                    return isNaN(d.getTime()) ? "-" : format(d, "dd-MM-yyyy");
                                                                })()
                                                            ) : "-"}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="receive-items" className="mt-0 space-y-6 outline-none focus-visible:outline-none focus-visible:ring-0 sm:space-y-7">
                                    {/* Entry Form */}
                                    {isEditMode && canEdit(permissionModule) && (
                                        <div className="space-y-5 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:space-y-6 sm:p-5">
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end lg:gap-x-4 lg:gap-y-4 xl:gap-x-5">
                                            <div className="flex min-w-0 flex-col sm:col-span-2 lg:col-span-5">
                                                <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Item Selection <span className="text-red-500">*</span></Label>
                                                <SharedSearchableSelect
                                                    value={receptionForm.itemCode}
                                                    options={poItems.map((i) => ({
                                                        label: `${i.item_code} - ${i.item_name} (Pending: ${i.quantity})`,
                                                        value: i.item_code,
                                                        primaryText: i.item_name,
                                                        secondaryText: `${i.item_code} | Pending: ${i.quantity}`,
                                                    }))}
                                                    onChange={(v) => {
                                                        const code = String(v);
                                                        setReceptionForm((prev) => ({ ...prev, itemCode: code }));
                                                        validateQty(receptionForm.receivedQty, code);
                                                    }}
                                                    placeholder="Search item code or name..."
                                                    className="h-9 bg-white sm:h-10"
                                                    popoverCollisionBoundary={grnDialogEl}
                                                    popoverCollisionPadding={{ top: 12, bottom: 80, left: 12, right: 12 }}
                                                />
                                            </div>
                                            <div className="relative flex min-w-30 flex-col sm:col-span-1 lg:col-span-2">
                                                <Label className="mb-2 block whitespace-nowrap text-xs font-bold uppercase tracking-wide text-slate-600">
                                                    Receive Qty <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0.00"
                                                    className="h-9 w-full bg-white border-slate-200 sm:h-10"
                                                    value={receptionForm.receivedQty}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        // Allow only numbers and one decimal point, max 6 digits total
                                                        if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 6)) {
                                                            setReceptionForm(prev => ({ ...prev, receivedQty: val }));
                                                            // INTEGRATION: Trigger real-time inline validation on every keystroke
                                                            validateQty(val, receptionForm.itemCode);
                                                        }
                                                    }}
                                                />
                                                {qtyError && (
                                                    <p className="absolute left-0 top-full z-10 mt-0.5 w-max max-w-56 text-[10px] font-medium italic leading-snug text-red-500">
                                                        {qtyError}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex min-w-0 flex-col lg:col-span-3">
                                                <Label className="mb-2 block whitespace-nowrap text-xs font-bold uppercase tracking-wide text-slate-600">
                                                    Receive Date <span className="text-red-500">*</span>
                                                </Label>
                                                <SharedDatePicker
                                                    date={receptionForm.deliveryDate}
                                                    setDate={(d) => setReceptionForm(prev => ({ ...prev, deliveryDate: d }))}
                                                    maxDate={new Date()}
                                                    showClear={false}
                                                />
                                            </div>
                                            <div className="flex min-w-0 flex-col lg:col-span-2">
                                                <Label className="mb-2 block whitespace-nowrap text-xs font-bold uppercase tracking-wide text-slate-600">
                                                    Attachment
                                                </Label>
                                                <div className="flex h-9 w-full items-center gap-2 sm:h-10">
                                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-slate-200 bg-white sm:h-10 sm:w-10" onClick={() => fileInputRef.current?.click()}>
                                                        <Paperclip className="h-4 w-4" />
                                                    </Button>
                                                    {receptionForm.attachmentName && (
                                                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-medium flex items-center gap-1 max-w-[150px] truncate cursor-pointer hover:bg-blue-100" onClick={() => handleDownload(receptionForm.attachmentName)}>
                                                            {truncateFileName(getFileName(receptionForm.attachmentName))}
                                                            <X className="h-3 w-3 cursor-pointer hover:text-red-500 ml-1" onClick={(e) => {
                                                                e.stopPropagation();
                                                                setReceptionForm(prev => ({ ...prev, attachmentName: "", file: null }));
                                                                if (fileInputRef.current) fileInputRef.current.value = "";
                                                            }} />
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            </div>
                                            <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-5 sm:flex-row sm:items-end sm:gap-4 sm:pt-6">
                                            <div className="min-w-0 flex-1">
                                                <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Note/Remarks</Label>
                                                <Input
                                                    placeholder="Add any internal notes..."
                                                    className="h-9 bg-white border-slate-200 text-sm sm:h-10"
                                                    value={receptionForm.note}
                                                    maxLength={150} // VALIDATION: Enforce 150 character limit
                                                    onChange={(e) => {
                                                        // Block input beyond 150 characters
                                                        if (e.target.value.length <= 150) {
                                                            setReceptionForm(prev => ({ ...prev, note: e.target.value }));
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <Button
                                                size="icon"
                                                className="h-9 w-full shrink-0 shadow-lg sm:h-10 sm:w-10"
                                                onClick={handleAddReception}
                                                disabled={!canCreate(permissionModule)}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* History Table */}
                                    <div className="mt-1 overflow-hidden rounded-md border bg-white shadow-sm sm:mt-2">
                                        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
                                            <FileText className="h-4 w-4 text-slate-400" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">New Reception Entries</span>
                                        </div>
                                        <div
                                            className={cn(
                                                "overflow-x-auto",
                                                (((selectedPO?.receptions || []).length) + tempReceptions.length) > 4 &&
                                                    "max-h-[min(42vh,380px)] overflow-y-auto custom-scrollbar"
                                            )}
                                        >
                                        <Table className="w-full min-w-[760px] table-fixed">
                                            <colgroup>
                                                <col className="w-[34%]" />
                                                <col className="w-[8%]" />
                                                <col className="w-[12%]" />
                                                <col className="w-[18%]" />
                                                <col className="w-[22%]" />
                                                <col className="w-[8%]" />
                                            </colgroup>
                                            <TableHeader className="bg-slate-50/50">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="py-3 pl-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                        Item
                                                    </TableHead>
                                                    <TableHead className="py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                        Qty
                                                    </TableHead>
                                                    <TableHead className="py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                        Date
                                                    </TableHead>
                                                    <TableHead className="py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                        Document
                                                    </TableHead>
                                                    <TableHead className="py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                        Note
                                                    </TableHead>
                                                    <TableHead className="py-3 text-center text-[10px] font-bold tracking-wider text-slate-500">
                                                        Actions
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {((selectedPO?.receptions || []).length > 0 || tempReceptions.length > 0) ? (
                                                    <>
                                                        {/* Combined entries (Saved from backend and Staged local) */}
                                                        {[...(selectedPO?.receptions || []) as ExtendedReceptionEntry[], ...tempReceptions].map((r, idx) => {
                                                            // Determine if entry is saved based on presence of backend URL
                                                            const isSaved = !!r.fileUrl;
                                                            return (
                                                                <TableRow key={r.id || idx} className={cn(
                                                                    "transition-colors",
                                                                    // Highlight new unsaved rows with a subtle blue tint
                                                                    !isSaved ? "hover:bg-slate-50/30 border-slate-50 bg-blue-50/10" : "hover:bg-slate-50/10 border-slate-50"
                                                                )}>
                                                                    <TableCell className="max-w-0 overflow-hidden align-top py-3 pl-6">
                                                                        <div className="min-w-0 pr-2">
                                                                            <p className="m-0 line-clamp-2 overflow-hidden text-sm font-medium leading-snug break-words text-slate-900">
                                                                                {r.itemName}
                                                                            </p>
                                                                            <p className="m-0 mt-0.5 line-clamp-1 overflow-hidden font-mono text-[10px] leading-snug text-slate-500">
                                                                                {r.itemCode}
                                                                            </p>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="align-top py-3 text-right font-bold whitespace-nowrap text-slate-900">
                                                                        {r.receivedQty}
                                                                    </TableCell>
                                                                    <TableCell className="align-top py-3 text-xs whitespace-nowrap text-slate-600">
                                                                        {r.deliveryDate}
                                                                    </TableCell>
                                                                    <TableCell className="align-top py-3">
                                                                        {r.attachmentName ? (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Badge 
                                                                                            variant="secondary" 
                                                                                            className={cn(
                                                                                                "border-none font-medium flex items-center gap-1 w-fit transition-all",
                                                                                                isSaved 
                                                                                                    ? "bg-blue-50 text-blue-600 cursor-pointer hover:bg-blue-100" 
                                                                                                    : "bg-slate-100 text-slate-400 cursor-not-allowed grayscale"
                                                                                            )}
                                                                                            onClick={() => isSaved && handleDownload(r.fileUrl!)}
                                                                                        >
                                                                                            <Paperclip className="h-3 w-3" />
                                                                                            {truncateFileName(getFileName(r.attachmentName!))}
                                                                                        </Badge>
                                                                                    </TooltipTrigger>
                                                                                    {!isSaved && (
                                                                                        <TooltipContent>
                                                                                            <p>Document not saved yet</p>
                                                                                        </TooltipContent>
                                                                                    )}
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        ) : (
                                                                            <span className="text-xs text-muted-foreground">-</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="align-top py-3">
                                                                        <p
                                                                            className={cn(
                                                                                "m-0 min-w-0 break-words text-xs italic leading-relaxed text-slate-500 whitespace-pre-wrap",
                                                                                !r.note?.trim() && "text-muted-foreground not-italic"
                                                                            )}
                                                                        >
                                                                            {r.note?.trim() ? r.note : "-"}
                                                                        </p>
                                                                    </TableCell>
                                                                    <TableCell className="align-top py-3 pr-6 text-center">
                                                                        <div className="flex justify-center gap-1">
                                                                            {isEditMode && canDelete(permissionModule) && (
                                                                                <Button 
                                                                                    variant="ghost" 
                                                                                    size="icon" 
                                                                                    className={cn(
                                                                                        "h-8 w-8 transition-colors",
                                                                                        isSaved ? "text-slate-400 hover:text-destructive hover:bg-destructive/10" : "text-destructive hover:bg-destructive/20"
                                                                                    )}
                                                                                    title={isSaved ? "Delete Permanently" : "Remove Entry"}
                                                                                    onClick={() => handleDeleteReception(r)}
                                                                                >
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </>
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="h-24 text-center text-slate-400 text-sm">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <AlertCircle className="h-5 w-5 opacity-20" />
                                                                No reception history found.
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                        </div>
                                    </div>
                            </TabsContent>
                        </Tabs>
                        </>
                        )}
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 gap-2 border-t bg-background px-4 pb-4 pt-3 sm:justify-end sm:px-5">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSavingGRN} className="w-full sm:w-auto">
                            Close
                        </Button>
                        {isEditMode && canEdit(permissionModule) && (
                            <Button
                                className="w-full px-8 font-bold shadow-md disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto"
                                onClick={handleSaveGRN}
                                loading={isSavingGRN}
                                disabled={isSavingGRN || isDetailLoading || tempReceptions.length === 0}
                            >
                                <Check className="mr-2 h-4 w-4" />
                                Save
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
