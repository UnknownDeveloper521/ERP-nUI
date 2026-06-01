// ============================================================================
// BATCH TRACKING MODULE
// ============================================================================
// ✅ REFACTORED: Separated from MaterialOperation.tsx into standalone file
// This module manages production batch tracking:
// - Create production batches (single or bulk)
// - Track input materials consumed and output items produced
// - Manage batch lifecycle: Batch Created → Sent for QC → Verified QC → Batch Closed
// - Support for QC verification with verified quantities
// - Shift-based tracking (Morning/Night)
// - Bulk batch creation with auto-division of materials
// ============================================================================

import { useState, useEffect, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { format, parse, isValid } from "date-fns";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check, Calendar as CalendarIcon, ChevronDown, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SearchableSelect as SharedSearchableSelect } from "@/components/shared/SearchableSelect";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { productionApi, commonApi, type BatchCreateRequest } from "@/lib/api";
import { useCommonStore } from "@/store/commonStore";
import { 
  type BatchRecord, 
  type BatchItem,
  OPERATION_QC_REQUIRED
} from "@/lib/batchSharedData";
import { useHasPermission } from "@/hooks/usePermissions";
import Unauthorized from "@/pages/Unauthorized";
import {
  getAssignedIds,
  getFirstAssignedMatch,
  prioritizeByAssigned,
} from "@/utils/assignedDropdown";
import { getBomMockSkusForItem } from "@/lib/bomSkuMockData";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const getCurrentDateForInput = (): string => {
  return new Date().toISOString().split('T')[0];
};

const formatBatchItemSkuLabel = (item: {
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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type BatchTracking = BatchRecord;

interface MRRequest {
  id: number;
  mrNumber: string;
  date: string;
  requiredByDate: string;
  operation: string;
  workCenter: string;
  warehouse: string;
  requestedBy: string;
  totalItems: number;
  status: "Request to Warehouse" | "Issued by Warehouse" | "Received by Production";
  items: MRRequestItem[];
  /** From GET /common/getmrforbatch (same response as `items` lines when API uses inputs/outputs) */
  inputs?: any[];
  outputs?: any[];
}

/** Map one record from GET /common/getmrforbatch to MRRequest (shared by initial load and dropdown refresh). */
function mapGetMrForBatchRecord(r: any): MRRequest {
  const inputs = r.inputs ?? [];
  const outputs = r.outputs ?? [];
  const itemsFromList = (r.items || []) as any[];
  const lineItems: MRRequestItem[] =
    itemsFromList.length > 0
      ? itemsFromList.map((item: any) => ({
          id: item.item_id,
          itemCode: item.item_code,
          itemName: item.item_name,
          skuCode: item.sku_code || "",
          skuName: item.sku_name || "",
          uom: item.uom,
          availableQty: item.available_qty || 0,
          requiredQty: item.required_qty
        }))
      : inputs.map((item: any) => ({
          id: item.item_id,
          itemCode: item.item_code,
          itemName: item.item_name,
          skuCode: item.sku_code || "",
          skuName: item.sku_name || "",
          uom: item.uom_name || item.uom,
          availableQty: item.total_qty ?? 0,
          requiredQty: item.total_qty ?? 0
        }));
  return {
    id: Number(r.mr_id ?? r.id),
    mrNumber: r.mr_code,
    date: r.request_date,
    requiredByDate: r.required_by_date || r.request_date,
    operation: r.operation_name,
    workCenter: r.work_center_name,
    warehouse: r.warehouse_name,
    requestedBy: r.requested_by_name || "System",
    totalItems: lineItems.length || inputs.length,
    status: r.status_name as any,
    items: lineItems,
    inputs,
    outputs
  };
}

/** Map getMRForBatch `inputs` → batch form input lines (no extra API) */
function mapMrForBatchInputsToInputItems(inputs: any[] | undefined): BatchItem[] {
  if (!inputs?.length) return [];
  return inputs.map((row: any, index: number) => ({
    id: row.id ?? row.item_id ?? index + 1,
    item_id: row.item_id,
    item: row.item_name,
    itemCode: row.item_code,
    itemName: row.item_name,
    skuCode: row.sku_code || "",
    skuName: row.sku_name || "",
    uom: row.uom_name || row.uom || "",
    availableQty: row.total_qty ?? row.total_mr_qty ?? 0,
    qtySupplied: 0,
    qtyProduced: 0
  }));
}

/** Map getMRForBatch `outputs` → batch form output lines (no extra API) */
function mapMrForBatchOutputsToOutputItems(outputs: any[] | undefined): BatchItem[] {
  if (!outputs?.length) return [];
  return outputs.map((row: any, index: number) => ({
    id: row.id ?? index + 1,
    item_id: row.item_id,
    item: row.item_name,
    itemCode: row.item_code,
    itemName: row.item_name,
    skuCode: row.sku_code || "",
    skuName: row.sku_name || "",
    uom: row.uom_name || row.uom || "",
    qtyProduced: row.produced_qty != null && row.produced_qty !== "" ? row.produced_qty : 0,
    qtySupplied: 0
  }));
}

/**
 * getBatchById may omit `status_name` or nest status. Prefer detail fields, then list row (same id).
 */
function resolveBatchStatusNameAndId(
  batchData: any,
  listRow: { status?: string; status_id?: number } | undefined
): { statusName: string | undefined; statusId: number | undefined } {
  const name =
    batchData?.status_name ??
    batchData?.batch_status_name ??
    (typeof batchData?.status === "string" ? batchData.status : undefined) ??
    batchData?.status?.name ??
    batchData?.StatusName ??
    listRow?.status;
  let sid: number | undefined;
  if (batchData?.status_id != null && !Number.isNaN(Number(batchData.status_id))) {
    sid = Number(batchData.status_id);
  } else if (batchData?.status?.id != null) {
    sid = Number(batchData.status.id);
  } else if (listRow?.status_id != null) {
    sid = Number(listRow.status_id);
  }
  return { statusName: name, statusId: sid };
}

interface MRRequestItem {
  id: number;
  itemCode: string;
  itemName: string;
  skuCode?: string;
  skuName?: string;
  uom: string;
  availableQty: number;
  requiredQty: number;
  issuedQty?: number;
  receivedQty?: number;
}

// ============================================================================
// SEARCHABLE SELECT COMPONENT
// ============================================================================

interface SearchableSelectProps {
  label: string;
  value?: string;
  options: string[];
  onChange: (val: string) => void;
  required?: boolean;
  disabled?: boolean;
}

function SearchableSelect({
  label,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10 font-normal border-input overflow-hidden"
            disabled={disabled}
          >
            <span className={cn("truncate mr-2", !value && "text-muted-foreground")}>
              {value || `Select ${label}`}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInputBorderless placeholder={`Search ${label.toLowerCase()}...`} className="h-9" />
            <CommandList className="max-h-[200px] overflow-y-auto">
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {options.map((item) => (
                  <CommandItem
                    key={item}
                    value={item}
                    onSelect={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === item ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {item}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DatePicker({ date, setDate, disabled = false, minDate }: {
    date?: Date,
    setDate: (d?: Date) => void,
    disabled?: boolean,
    minDate?: Date
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

        if (!isBeforeMinDate) {
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

        // Previous month's trailing days
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

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            currentDate.setHours(0, 0, 0, 0);
            const isToday = new Date().toDateString() === currentDate.toDateString();
            const isSelected = date && currentDate.toDateString() === date.toDateString();
            const isPast = minimumDate ? currentDate < minimumDate : false;

            days.push({
                date: currentDate,
                isCurrentMonth: true,
                isToday,
                isSelected,
                isPast: isPast
            });
        }

        // Next month's leading days
        const remainingDays = 42 - days.length;
        for (let day = 1; day <= remainingDays; day++) {
            const dayDate = new Date(year, month + 1, day);
            dayDate.setHours(0, 0, 0, 0);
            days.push({
                date: dayDate,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false,
                isPast: minimumDate ? dayDate < minimumDate : false
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
                            disabled={day.isPast}
                            className={cn(
                                "h-8 w-8 text-sm font-normal",
                                !day.isCurrentMonth && "text-muted-foreground opacity-50",
                                day.isToday && "bg-accent text-accent-foreground font-semibold",
                                day.isSelected && "bg-primary text-primary-foreground font-semibold",
                                day.isCurrentMonth && !day.isPast && "hover:bg-accent hover:text-accent-foreground",
                                day.isPast && "opacity-30 cursor-not-allowed text-muted-foreground"
                            )}
                            onClick={() => !day.isPast && handleDateSelect(day.date)}
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
                        "w-full justify-start text-left font-normal flex h-10 rounded-md border border-input px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDisplayDate(date) : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 shadow-lg border rounded-lg z-[9999]" align="start" side="bottom" sideOffset={4}>
                {viewMode === "day" && renderDayView()}
                {viewMode === "month" && renderMonthView()}
                {viewMode === "year" && renderYearView()}
            </PopoverContent>
        </Popover>
    );
}

// ============================================================================
// MOCK DATA
// ============================================================================

const OPERATIONS = [
  "Lead Generation & Purification",
  "Case Creation",
  "Grid Creation & Oxidization",
  "Assembly line & Packaging"
];

const WORK_CENTERS = [
  "Lead Furnace Center",
  "Plastic Casing Center",
  "Grid Generation Center",
  "Assembly Line"
];

const WAREHOUSES = ["Jinja WH"];

// Mock operation output mapping (what each operation produces)
const OPERATION_OUTPUT_MAPPINGS: Record<string, { item_id: number; itemCode: string; itemName: string; uom: string }[]> = {
  "Lead Generation & Purification": [
    { item_id: 71, itemCode: "sfg-1", itemName: "Purified Lead", uom: "KG" },
  ],
  "Case Creation": [
    { item_id: 72, itemCode: "sfg-2", itemName: "Battery Cases", uom: "NOS" },
    { item_id: 73, itemCode: "sfg-3", itemName: "Battery Lids", uom: "NOS" },
  ],
  "Grid Creation & Oxidization": [
    { item_id: 74, itemCode: "sfg-4", itemName: "Separators", uom: "PCS" },
  ],
  "Assembly line & Packaging": [
    { item_id: 75, itemCode: "fg-1", itemName: "GSV 7", uom: "NOS" },
  ],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BatchTracking() {
  const { isMenuVisible, canCreate, canEdit, canView } = useHasPermission();
  const permissionModule = "PRODUCTION/BATCH_TRACKING";

  if (!isMenuVisible(permissionModule)) {
    return <Unauthorized />;
  }

  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Route matching
  const [matchNew] = useRoute("/production/batch-tracking/new");
  const [matchEdit, params] = useRoute("/production/batch-tracking/:id/edit");

  const isValidId = params?.id && !isNaN(parseInt(params.id));
  const isFormView = matchNew || (matchEdit && isValidId);
  const editingId = isValidId ? parseInt(params.id) : null;

  // ============================================================================
  // STATE
  // ============================================================================

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  // Pagination state - controls page number and rows per page
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState("Batch Created");
  const [operationFilter, setOperationFilter] = useState("All");
  const [workCenterFilter, setWorkCenterFilter] = useState("All");
  const [shiftFilter, setShiftFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);

  // Modal states
  const [isViewBatchModalOpen, setIsViewBatchModalOpen] = useState(false);
  const [viewingBatch, setViewingBatch] = useState<BatchTracking | null>(null);
  const [batchFormMode, setBatchFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [isBatchFormModalOpen, setIsBatchFormModalOpen] = useState(false);
  const [isBatchSubmitConfirmOpen, setIsBatchSubmitConfirmOpen] = useState(false);
  const [isBatchSubmitInProgress, setIsBatchSubmitInProgress] = useState(false);
  const [isBulkBatchModalOpen, setIsBulkBatchModalOpen] = useState(false);

  // MR Requests data (needed for MR selection)
  const [mrRequests, setMrRequests] = useState<MRRequest[]>([]);

  // Sample Batch Tracking data
  const [batchTrackings, setBatchTrackings] = useState<BatchTracking[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isFormOpening, setIsFormOpening] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openingBatchId, setOpeningBatchId] = useState<number | null>(null);
  const appliedOperationFilterDefault = useRef(false);
  const listInitRef = useRef(true);
  const initialPendingAssignedOperationId = (() => {
    const ids = getAssignedIds("operation");
    if (!ids.length) return undefined;
    const id = Number(ids[0]);
    return Number.isFinite(id) ? id : undefined;
  })();
  const pendingAssignedOperationIdRef = useRef<number | undefined>(initialPendingAssignedOperationId);
  const [totalRecords, setTotalRecords] = useState(0);
  const [shifts, setShifts] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const batchStatuses = useCommonStore(state => state.batchStatuses);

  const assignedOperationIds = getAssignedIds("operation");
  const assignedOperationKey = assignedOperationIds.join(",");
  const orderedOperations = useMemo(
    () => prioritizeByAssigned(operations, assignedOperationIds, (o) => o.id || o.operation_id),
    [operations, assignedOperationKey]
  );

  const fetchBatchList = async () => {
    setIsListLoading(true);
    try {
      let shiftId = undefined;
      if (shiftFilter !== "All") {
        const s = shifts.find(sh => (sh.shift_name || sh.name || sh.value_name) === shiftFilter);
        shiftId = s?.id || s?.shift_id;
      }

      let opId: number | undefined = undefined;
      if (operationFilter !== "All") {
        const o = operations.find(op => (op.operation_name || op.name) === operationFilter);
        opId = o?.id || o?.operation_id;
      } else if (pendingAssignedOperationIdRef.current != null) {
        opId = pendingAssignedOperationIdRef.current;
      }

      let statusId = undefined;
      if (statusFilter !== "All") {
        const s = batchStatuses.find(st => (st.status_name || st.name || st.value_name) === statusFilter);
        statusId = s?.id || s?.status_id;
      }

      const res = await productionApi.getBatchList({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm || undefined,
        batch_date: dateFilter ? format(dateFilter, "yyyy-MM-dd") : undefined,
        shift_id: shiftId,
        operation_id: opId,
        status_id: statusId
      });

      if (res.isSuccessful && res.data) {
        // Map back to old BatchRecord structure for UI compatibility
        const mappedData = res.data.records.map((record: any) => ({
          id: record.batch_id,
          batchNo: record.batch_code,
          date: record.batch_date,
          mrNo: record.mr_code,
          operation: record.operation_name,
          workCenter: record.work_center_name,
          shift: record.shift_name,
          status: record.status_name as any,
          status_id: record.status_id,
        }));
        setBatchTrackings(mappedData as any);
        setTotalRecords(res.data.pagination.totalRecords);
      }
    } catch (error) {
      console.error("Failed to fetch batches", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load batches"
      });
    } finally {
      setIsListLoading(false);
    }
  };

  useEffect(() => {
    if (listInitRef.current) return;
    fetchBatchList();
  }, [currentPage, itemsPerPage, debouncedSearchTerm, statusFilter, operationFilter, shiftFilter, dateFilter]);

  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const shiftRes = await productionApi.getShiftForProduction();
        if (shiftRes.isSuccessful && shiftRes.data?.records) {
          setShifts(shiftRes.data.records);
        }

        const opRes = await commonApi.getOperations();
        let operationRecords: any[] = [];
        if (opRes.isSuccessful && opRes.data?.records) {
          operationRecords = opRes.data.records;
          setOperations(operationRecords);
        }
        if (
          !appliedOperationFilterDefault.current &&
          assignedOperationIds.length > 0 &&
          operationRecords.length > 0
        ) {
          const ordered = prioritizeByAssigned(
            operationRecords,
            assignedOperationIds,
            (o) => o.id || o.operation_id
          );
          const firstAssigned = getFirstAssignedMatch(
            assignedOperationIds,
            ordered.map((o) => o.id || o.operation_id)
          );
          if (firstAssigned) {
            const op = operationRecords.find(
              (o) => String(o.id || o.operation_id) === firstAssigned
            );
            if (op) {
              setOperationFilter(op.operation_name || op.name);
              appliedOperationFilterDefault.current = true;
              pendingAssignedOperationIdRef.current = undefined;
            }
          }
        }

        const mrRes = await commonApi.getMRForBatch();
        if (mrRes.isSuccessful && mrRes.data?.records) {
          setMrRequests(mrRes.data.records.map(mapGetMrForBatchRecord));
        }
      } catch (err) {
        console.error("Failed to load dropdown data", err);
      }
    };

    const init = async () => {
      listInitRef.current = true;
      await fetchBatchList();
      await loadDropdownData();
      listInitRef.current = false;
    };
    void init();
  }, []);

  // Batch form data
  const [batchFormData, setBatchFormData] = useState({
    batchNo: `BATCH-${new Date().getFullYear()}-${String(batchTrackings.length + 1).padStart(3, '0')}`,
    date: getCurrentDateForInput(),
    createdBy: "Current User",
    mrNo: "",
    operation: "",
    workCenter: "",
    shift: "" as string,
    startTime: null as string | null,
    endTime: null as string | null,
    savedBatchId: null as number | null,
    status: "Batch Created" as "Batch Created" | "Sent for QC" | "Verified QC" | "Batch Closed",
    createdType: "SINGLE" as "SINGLE" | "BULK",
    inputItems: [] as BatchItem[],
    outputItems: [] as BatchItem[]
  });

  /** Create Batch (single): value submitted as mr_id; full record only for inputs/outputs binding. */
  const [selectedMRId, setSelectedMRId] = useState<number | null>(null);
  const [selectedMRDetails, setSelectedMRDetails] = useState<MRRequest | null>(null);

  /** Bulk batch: only mr_id is sent; no inputs/outputs in UI. */
  const [bulkSelectedMRId, setBulkSelectedMRId] = useState<number | null>(null);

  // Bulk batch form data
  const [bulkBatchFormData, setBulkBatchFormData] = useState({
    shift: "",
    numberOfBatches: 0 as number | string,
    date: getCurrentDateForInput()
  });
  const [isReadOnly, setIsReadOnly] = useState(false);

  const resetCreateBatchForm = () => {
    setSelectedMRId(null);
    setSelectedMRDetails(null);
    setBatchFormData({
      batchNo: "",
      date: getCurrentDateForInput(),
      createdBy: "",
      mrNo: "",
      operation: "",
      workCenter: "",
      shift: "",
      startTime: null,
      endTime: null,
      savedBatchId: null,
      status: "Batch Created",
      createdType: "SINGLE",
      inputItems: [],
      outputItems: [],
    });
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (matchNew) {
      setSelectedMRId(null);
      setSelectedMRDetails(null);
      setBatchFormData({
        batchNo: `BATCH-${new Date().getFullYear()}-${String(batchTrackings.length + 1).padStart(3, '0')}`,
        date: getCurrentDateForInput(),
        createdBy: "Current User",
        mrNo: "",
        operation: "",
        workCenter: "",
        shift: "",
        startTime: null,
        endTime: null,
        savedBatchId: null,
        status: "Batch Created",
        createdType: "SINGLE",
        inputItems: [],
        outputItems: []
      });
      setIsReadOnly(false);
    } else if (matchEdit && editingId) {
      const existingBatch = batchTrackings.find(b => b.id === editingId);
      if (existingBatch) {
        const outputItems = (existingBatch.outputItems && existingBatch.outputItems.length > 0)
          ? existingBatch.outputItems
          : (() => {
            const outputMapping = OPERATION_OUTPUT_MAPPINGS[existingBatch.operation] || [];
            return outputMapping.map((item, index) => ({
              id: index + 1,
              item: item.itemName,
              uom: item.uom,
              qtyProduced: 0,
              qtySupplied: 0
            }));
          })();

        const selectedMR = mrRequests.find(mr => mr.mrNumber === existingBatch.mrNo);
        if (selectedMR) {
          setSelectedMRId(selectedMR.id);
          setSelectedMRDetails(selectedMR);
        } else {
          setSelectedMRId(null);
          setSelectedMRDetails(null);
        }
        const inputItems = existingBatch.inputItems?.map(item => {
          const mrItem = selectedMR?.items.find(mi => mi.itemName === item.item);
          return {
            ...item,
            availableQty: mrItem?.requiredQty || item.availableQty || 0
          };
        }) || [];

        setBatchFormData({
          batchNo: existingBatch.batchNo,
          date: existingBatch.date,
          createdBy: "Current User",
          mrNo: existingBatch.mrNo,
          operation: existingBatch.operation,
          workCenter: existingBatch.workCenter || "",
          shift: existingBatch.shift,
          startTime: existingBatch.startTime || null,
          endTime: existingBatch.endTime || null,
          savedBatchId: existingBatch.id,
          status: existingBatch.status,
          createdType: existingBatch.createdType || "SINGLE",
          inputItems: inputItems,
          outputItems: outputItems
        });
        setIsReadOnly(existingBatch.status === "Verified QC" || existingBatch.status === "Batch Closed" || existingBatch.status === "Sent for QC");
      }
    }
  }, [matchNew, matchEdit, editingId, batchTrackings.length]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleInputQtyChange = (id: number | string, value: string) => {
    // Already enforced by Input onChange, but keeping as a safe guard
    const updatedItems = batchFormData.inputItems.map(item =>
      item.id === id ? { ...item, qtySupplied: value } : item
    );
    setBatchFormData({ ...batchFormData, inputItems: updatedItems });
  };

  const handleOutputQtyChange = (id: number | string, value: string) => {
    // Already enforced by Input onChange
    const updatedItems = batchFormData.outputItems.map(item =>
      item.id === id ? { ...item, qtyProduced: value } : item
    );
    setBatchFormData({ ...batchFormData, outputItems: updatedItems });
  };

  const handleBatchMRSelection = (value: string) => {
    if (!value) {
      setSelectedMRId(null);
      setSelectedMRDetails(null);
      setBatchFormData((prev) => ({
        ...prev,
        mrNo: "",
        operation: "",
        workCenter: "",
        inputItems: [],
        outputItems: []
      }));
      return;
    }
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }
    const selectedMR = mrRequests.find((mr) => Number(mr.id) === id);
    if (!selectedMR) {
      return;
    }
    setSelectedMRId(id);
    setSelectedMRDetails(selectedMR);
    const inputItems =
      selectedMR.inputs && selectedMR.inputs.length > 0
        ? mapMrForBatchInputsToInputItems(selectedMR.inputs)
        : selectedMR.items.map((item, index) => ({
            id: index + 1,
            item_id: item.id,
            item: item.itemName,
            itemCode: item.itemCode,
            itemName: item.itemName,
            skuCode: item.skuCode || "",
            skuName: item.skuName || "",
            uom: item.uom,
            availableQty: item.requiredQty,
            qtySupplied: 0,
            qtyProduced: 0
          }));

    const outputItems =
      selectedMR.outputs && selectedMR.outputs.length > 0
        ? mapMrForBatchOutputsToOutputItems(selectedMR.outputs)
        : (() => {
            const outputMapping = OPERATION_OUTPUT_MAPPINGS[selectedMR.operation] || [];
            return outputMapping.map((item, index) => ({
              id: index + 1,
              item_id: item.item_id || index + 70,
              item: item.itemName,
              itemCode: item.itemCode,
              itemName: item.itemName,
              uom: item.uom,
              qtyProduced: 0,
              qtySupplied: 0
            }));
          })();

    setBatchFormData((prev) => ({
      ...prev,
      mrNo: selectedMR.mrNumber,
      operation: selectedMR.operation,
      workCenter: selectedMR.workCenter || "",
      inputItems,
      outputItems
    }));
  };

  const handleBatchSave = async () => {
    if (isSaving) return;
    if (selectedMRId == null || !Number.isFinite(selectedMRId) || selectedMRId <= 0) {
      toast({ variant: "destructive", title: "Validation Error", description: "Select a material request" });
      return;
    }
    if (!batchFormData.shift) {
      toast({ variant: "destructive", title: "Validation Error", description: "Shift is required" });
      return;
    }
    const hasInputQty = batchFormData.inputItems.some(item => parseFloat(item.qtySupplied.toString()) > 0);
    if (!hasInputQty) {
      toast({ variant: "destructive", title: "Validation Error", description: "At least one input quantity must be greater than 0" });
      return;
    }
    if (hasQtySuppliedValidationErrors()) {
      toast({ variant: "destructive", title: "Validation Error", description: "Qty Supplied must exactly match MR quantity" });
      return;
    }

    const shiftRecord = shifts.find((sh) => (sh.shift_name || sh.name || sh.value_name) === batchFormData.shift);
    const rawShift = shiftRecord?.id ?? shiftRecord?.shift_id;
    if (rawShift == null || !Number.isFinite(Number(rawShift))) {
      toast({ variant: "destructive", title: "Validation Error", description: "Could not resolve shift. Refresh and try again." });
      return;
    }
    const shift_id = Number(rawShift);

    // Prepare payload for API
    const payload: BatchCreateRequest = {
      batch_date: batchFormData.date,
      shift_id,
      mr_id: selectedMRId,
      mr_code: batchFormData.mrNo,
      inputs: batchFormData.inputItems
        .filter(item => parseFloat(item.qtySupplied.toString()) > 0)
        .map(item => ({
          item_id: Number(item.item_id || item.id),
          supplied_qty: parseFloat(item.qtySupplied.toString())
        })),
      outputs: batchFormData.outputItems.map(item => ({
        item_id: Number(item.item_id || item.id),
        produced_qty: parseFloat(item.qtyProduced.toString()) || 0
      }))
    };

    try {
      setIsSaving(true);
      const res = await productionApi.createBatch(payload);
      
      if (res.isSuccessful) {
        const d = res.data as { id?: number; batch_id?: number } | undefined;
        const newBatchId = d?.id ?? d?.batch_id;
        if (newBatchId != null) {
          setBatchFormData((prev) => ({ ...prev, savedBatchId: newBatchId }));
        }
        toast({
          variant: "success",
          title: "Success",
          description: res.message || "Batch created successfully",
        });
        setIsBatchFormModalOpen(false);
        fetchBatchList(); // Refresh the listing page
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: res.message || "Failed to create batch",
        });
      }
    } catch (error: any) {
      console.error("Create batch error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An unexpected error occurred during batch creation",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchSubmit = async () => {
    if (isBatchSubmitInProgress || isSaving) return;
    const isEditMode = batchFormMode === "edit";

    if (isEditMode) {
      const hasOutputQtyForEdit = batchFormData.outputItems.some(
        (item) => parseFloat(item.qtyProduced.toString()) > 0
      );
      if (!hasOutputQtyForEdit) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "At least one output quantity must be greater than 0 to submit",
        });
        return;
      }
      try {
        setIsBatchSubmitInProgress(true);
        const endTime = new Date().toISOString();
        await completeBatchSubmission(endTime);
      } finally {
        setIsBatchSubmitInProgress(false);
      }
      return;
    }

    if (selectedMRId == null || !Number.isFinite(selectedMRId) || selectedMRId <= 0) {
      toast({ variant: "destructive", title: "Validation Error", description: "Select a material request" });
      return;
    }
    if (!batchFormData.shift) {
      toast({ variant: "destructive", title: "Validation Error", description: "Shift is required" });
      return;
    }
    const hasInputQty = batchFormData.inputItems.some(item => parseFloat(item.qtySupplied.toString()) > 0);
    if (!hasInputQty) {
      toast({ variant: "destructive", title: "Validation Error", description: "At least one input quantity must be greater than 0" });
      return;
    }
    if (hasQtySuppliedValidationErrors()) {
      toast({ variant: "destructive", title: "Validation Error", description: "Qty Supplied must exactly match MR quantity" });
      return;
    }
    const hasOutputQty = batchFormData.outputItems.some(item => parseFloat(item.qtyProduced.toString()) > 0);
    if (!hasOutputQty) {
      toast({ variant: "destructive", title: "Validation Error", description: "At least one output quantity must be greater than 0 to submit" });
      return;
    }

    try {
      setIsBatchSubmitInProgress(true);
      const endTime = new Date().toISOString();
      await completeBatchSubmission(endTime);
    } finally {
      setIsBatchSubmitInProgress(false);
    }
  };

  const completeBatchSubmission = async (endTime: string) => {
    const qcRequired = OPERATION_QC_REQUIRED[batchFormData.operation] !== false;
    
    // Only validate MR selection if we are CREATING a new batch.
    // In EDIT mode, the MR is already fixed on the record.
    if (batchFormData.savedBatchId == null && (selectedMRId == null || !Number.isFinite(selectedMRId) || selectedMRId <= 0)) {
      toast({ variant: "destructive", title: "Validation Error", description: "Select a material request" });
      return;
    }
    const shiftRecord = shifts.find((sh) => (sh.shift_name || sh.name || sh.value_name) === batchFormData.shift);
    const rawShift = shiftRecord?.id ?? shiftRecord?.shift_id;
    if (rawShift == null || !Number.isFinite(Number(rawShift))) {
      toast({ variant: "destructive", title: "Validation Error", description: "Could not resolve shift. Refresh and try again." });
      return;
    }
    const shift_id = Number(rawShift);
    const mr_id = selectedMRId;

    const outputPayload = batchFormData.outputItems.map((item) => ({
      item_id: Number(item.item_id || item.id),
      produced_qty: parseFloat(String(item.qtyProduced)) || 0
    }));

    const createFullPayload: BatchCreateRequest = {
      batch_date: batchFormData.date,
      shift_id,
      mr_id: mr_id!,
      mr_code: batchFormData.mrNo,
      inputs: batchFormData.inputItems
        .filter((item) => parseFloat(String(item.qtySupplied)) > 0)
        .map((item) => ({
          item_id: Number(item.item_id || item.id),
          supplied_qty: parseFloat(String(item.qtySupplied))
        })),
      outputs: outputPayload
    };

    try {
      setIsSaving(true);
      // For direct Submit in Create Batch flow, backend createBatch already performs
      // "created and sent for QC", so do NOT call updateBatch immediately after create.
      if (batchFormData.savedBatchId == null) {
        const createRes = await productionApi.createBatch(createFullPayload);
        if (!createRes.isSuccessful) {
          throw new Error(createRes.message || "Failed to create and submit batch");
        }

        const d = createRes.data as { id?: number; batch_id?: number } | undefined;
        const newId = d?.id ?? d?.batch_id;
        if (newId != null) {
          setBatchFormData((prev) => ({ ...prev, savedBatchId: newId }));
        }

        toast({
          variant: "success",
          title: "Success",
          description:
            createRes.message ||
            `Batch ${batchFormData.batchNo} submitted successfully${qcRequired ? "" : " (QC Skipped)"}`,
        });
        setIsBatchFormModalOpen(false);
        setIsViewBatchModalOpen(false);
        fetchBatchList();
        return;
      }

      // Existing saved batch flow: update outputs / submit via update API once.
      const res = await productionApi.updateBatch(batchFormData.savedBatchId, { outputs: outputPayload });

      if (res.isSuccessful) {
        toast({
          variant: "success",
          title: "Success",
          description: res.message || `Batch ${batchFormData.batchNo} submitted successfully${qcRequired ? "" : " (QC Skipped)"}`,
        });
        setIsBatchFormModalOpen(false);
        setIsViewBatchModalOpen(false);
        fetchBatchList();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: res.message || "Failed to submit batch",
        });
      }
    } catch (error: any) {
      console.error("Submit batch error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An unexpected error occurred during batch submission",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const fetchMRRequestsForDropdown = async (shiftId?: number | string): Promise<MRRequest[]> => {
    try {
      const mrRes = await commonApi.getMRForBatch({ shift_id: shiftId });
      if (mrRes.isSuccessful && mrRes.data?.records) {
        const list = mrRes.data.records.map(mapGetMrForBatchRecord);
        setMrRequests(list);
        return list;
      }
      setMrRequests([]);
      return [];
    } catch (error) {
      console.error("Failed to load MR requests for dropdown", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load MR requests"
      });
      setMrRequests([]);
      return [];
    }
  };

  const handleOpenBatchForm = async () => {
    if (openingBatchId !== null || isSaving || isFormOpening) return;
    setIsFormOpening(true);
    setIsBatchFormModalOpen(true);
    try {
      resetCreateBatchForm();
      await fetchMRRequestsForDropdown();
    } finally {
      setIsFormOpening(false);
    }
  };

  const handleOpenBulkBatchForm = async () => {
    if (openingBatchId !== null || isSaving || isFormOpening) return;
    setIsFormOpening(true);
    setIsBulkBatchModalOpen(true);
    try {
      await fetchMRRequestsForDropdown();
    } finally {
      setIsFormOpening(false);
    }
  };

  const fetchBatchDetailsAndOpenModal = async (id: number, mode: 'view' | 'edit') => {
    setIsDetailLoading(true);
    setIsViewBatchModalOpen(true);
    setViewingBatch(null);
    try {
      const mrList = await fetchMRRequestsForDropdown();
      const res = await productionApi.getBatchById(id);
      if (res.isSuccessful && res.data) {
        const raw: any = res.data;
        const batchData = raw?.batch_id != null || raw?.batch_code != null ? raw : raw?.data ?? raw;
        const listRow = batchTrackings.find((b) => b.id === id) as
          | { status?: string; status_id?: number }
          | undefined;
        const { statusName, statusId } = resolveBatchStatusNameAndId(batchData, listRow);
        
        // Map inputs
        const inputItems = batchData.inputs?.map((item: any) => ({
          id: item.item_id,
          item_id: item.item_id,
          item: item.item_name,
          itemName: item.item_name,
          itemCode: item.item_code,
          skuCode: item.sku_code || "",
          skuName: item.sku_name || "",
          uom: item.uom_name || item.uom,
          qtySupplied: item.supplied_qty || 0,
          qtyProduced: 0,
          availableQty: item.total_mr_qty || 0
        })) || [];

        // Map outputs
        const outputItems = batchData.outputs?.map((item: any) => ({
          id: item.item_id,
          item_id: item.item_id,
          item: item.item_name,
          itemName: item.item_name,
          itemCode: item.item_code,
          skuCode: item.sku_code || "",
          skuName: item.sku_name || "",
          uom: item.uom_name || item.uom,
          qtyProduced: item.produced_qty || 0,
          qtySupplied: 0,
          verifiedQty: item.verified_qty
        })) || [];

        setViewingBatch({
          id: batchData.batch_id,
          batchNo: batchData.batch_code,
          date: batchData.batch_date,
          mrNo: batchData.mr_code,
          operation: batchData.operation_name,
          workCenter: batchData.work_center_name,
          warehouse: "", // API doesn't return warehouse currently
          shift: batchData.shift_name,
          status: statusName as any,
          inputItems,
          outputItems
        });

        const detailMR = mrList.find((mr) => mr.mrNumber === batchData.mr_code);
        if (detailMR) {
          setSelectedMRId(detailMR.id);
          setSelectedMRDetails(detailMR);
        } else {
          setSelectedMRId(null);
          setSelectedMRDetails(null);
        }

        setBatchFormData({
          batchNo: batchData.batch_code,
          date: batchData.batch_date,
          createdBy: "Current User",
          mrNo: batchData.mr_code,
          operation: batchData.operation_name,
          workCenter: batchData.work_center_name || "",
          shift: batchData.shift_name,
          startTime: null,
          endTime: null,
          savedBatchId: batchData.batch_id,
          status: statusName as any,
          createdType: "SINGLE",
          inputItems,
          outputItems
        });

        if (mode === 'view') {
          setIsReadOnly(true);
          setBatchFormMode('view');
        } else if (mode === 'edit') {
          const createdLabel = "Batch Created";
          // Detail API may omit status_name; list row (same id) is authoritative for label
          const canEdit =
            statusName === createdLabel ||
            listRow?.status === createdLabel ||
            statusId === 1;
          if (canEdit) {
            setIsReadOnly(false);
            setBatchFormMode('edit');
          } else {
            setIsViewBatchModalOpen(false);
            toast({
              variant: "destructive",
              title: "Cannot Edit",
              description: `Batch with status "${statusName ?? listRow?.status ?? "unknown"}" cannot be edited. Only batches with status "${createdLabel}" can be edited.`
            });
          }
        }
      } else {
        setIsViewBatchModalOpen(false);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load batch details."
        });
      }
    } catch (error) {
      console.error("Failed to load batch details", error);
      setIsViewBatchModalOpen(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load batch details."
      });
    } finally {
      setIsDetailLoading(false);
      setOpeningBatchId(null);
    }
  };

  const handleView = async (id: number) => {
    if (openingBatchId !== null || isSaving) return;
    setOpeningBatchId(id);
    await fetchBatchDetailsAndOpenModal(id, 'view');
  };

  const handleEdit = async (id: number) => {
    if (openingBatchId !== null || isSaving) return;
    setOpeningBatchId(id);
    await fetchBatchDetailsAndOpenModal(id, 'edit');
  };

  const handleBack = () => {
    setLocation("/production/batch-tracking");
  };

  const getQtySuppliedValidationMessage = (item: BatchItem): string => {
    const selectedMR = selectedMRDetails ?? mrRequests.find((mr) => mr.mrNumber === batchFormData.mrNo);
    const mrItem = selectedMR?.items.find((i) => i.itemName === item.item);
    const totalMRQty = Number(mrItem?.requiredQty ?? item.availableQty ?? 0);
    const suppliedQty = Number(item.qtySupplied || 0);

    if (suppliedQty < totalMRQty) {
      return "Qty cannot be less than MR quantity";
    }
    if (suppliedQty > totalMRQty) {
      return "Qty cannot be greater than MR quantity";
    }
    return "";
  };

  const hasQtySuppliedValidationErrors = (): boolean => {
    return batchFormData.inputItems.some((item) => getQtySuppliedValidationMessage(item) !== "");
  };

  const isSaveEnabled = () => {
    return (
      selectedMRId != null &&
      Number.isFinite(selectedMRId) &&
      selectedMRId > 0 &&
      Boolean(batchFormData.shift) &&
      batchFormData.inputItems.some((item) => parseFloat(item.qtySupplied.toString()) > 0)
    );
  };

  const isSubmitEnabled = () => {
    if (batchFormMode === "edit") {
      return batchFormData.outputItems.some((item) => parseFloat(item.qtyProduced.toString()) > 0);
    }

    return (
      selectedMRId != null &&
      Number.isFinite(selectedMRId) &&
      selectedMRId > 0 &&
      Boolean(batchFormData.shift) &&
      batchFormData.inputItems.some((item) => parseFloat(item.qtySupplied.toString()) > 0) &&
      batchFormData.outputItems.some((item) => parseFloat(item.qtyProduced.toString()) > 0) &&
      !hasQtySuppliedValidationErrors()
    );
  };

  const canSubmitBulkBatches =
    bulkSelectedMRId != null &&
    Number.isFinite(bulkSelectedMRId) &&
    bulkSelectedMRId > 0 &&
    Boolean(bulkBatchFormData.shift) &&
    parseFloat(String(bulkBatchFormData.numberOfBatches || 0)) >= 1;

  // ============================================================================
  // BULK BATCH HANDLERS
  // ============================================================================

  const handleBulkBatchMRSelection = (value: string) => {
    if (!value) {
      setBulkSelectedMRId(null);
      return;
    }
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) {
      setBulkSelectedMRId(null);
      return;
    }
    if (!mrRequests.some((mr) => Number(mr.id) === id)) {
      setBulkSelectedMRId(null);
      return;
    }
    setBulkSelectedMRId(id);
  };

  const handleBulkBatchNumberChange = (value: string) => {
    setBulkBatchFormData((prev) => ({
      ...prev,
      numberOfBatches: value
    }));
  };

  const handleSubmitBulkBatches = async () => {
    if (isSaving) return;
    if (bulkSelectedMRId == null || !Number.isFinite(bulkSelectedMRId) || bulkSelectedMRId <= 0) {
      toast({ variant: "destructive", title: "Validation Error", description: "Select a material request" });
      return;
    }
    if (!bulkBatchFormData.shift) {
      toast({ variant: "destructive", title: "Validation Error", description: "Shift is required" });
      return;
    }
    if (!bulkBatchFormData.numberOfBatches || parseFloat(bulkBatchFormData.numberOfBatches.toString()) < 1) {
      toast({ variant: "destructive", title: "Validation Error", description: "Number of batches must be at least 1" });
      return;
    }

    const shiftRecord = shifts.find((sh) => (sh.shift_name || sh.name || sh.value_name) === bulkBatchFormData.shift);
    const shift_id = shiftRecord?.id ?? shiftRecord?.shift_id;
    if (shift_id == null || !Number.isFinite(Number(shift_id))) {
      toast({ variant: "destructive", title: "Validation Error", description: "Could not resolve shift. Refresh and try again." });
      return;
    }

    const noOfBatches = Math.floor(parseFloat(bulkBatchFormData.numberOfBatches.toString()));
    const material_request_id = bulkSelectedMRId;

    try {
      setIsSaving(true);
      const res = await productionApi.createBulkBatch({
        material_request_id,
        shift_id: Number(shift_id),
        batch_date: bulkBatchFormData.date,
        no_of_batches: noOfBatches
      });

      if (res.isSuccessful) {
        setIsBulkBatchModalOpen(false);
        toast({
          variant: "success",
          title: "Success",
          description: res.message || "Bulk batches created successfully",
        });
        setBulkSelectedMRId(null);
        setBulkBatchFormData({
          shift: "",
          numberOfBatches: 0,
          date: getCurrentDateForInput()
        });
        fetchBatchList();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: res.message || "Failed to create bulk batches",
        });
      }
    } catch (error: any) {
      console.error("Create bulk batch error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An unexpected error occurred",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isRowActionBusy = openingBatchId !== null || isSaving || isDetailLoading;

  // ============================================================================
  // FILTERING & PAGINATION
  // ============================================================================

  // Using real data from backend
  const paginatedData = batchTrackings;
  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  // Auto-adjust page when data changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalRecords, currentPage, totalPages]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, operationFilter, workCenterFilter, shiftFilter, dateFilter]);

  // ============================================================================
  // RENDER - LISTING VIEW
  // ============================================================================

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Batch Tracking</h1>
        <p className="text-muted-foreground">
          Track production batches and manage batch lifecycle
        </p>
      </div>

      <div className="flex flex-col lg:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm flex-wrap">
        <div className="w-full lg:flex-1 min-w-[200px]">
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Batch Code or MR Code..."
              className="pl-9 h-10"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="w-full sm:w-48">
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <DatePicker date={dateFilter} setDate={setDateFilter} />
            </div>
            {dateFilter && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 border border-input hover:bg-muted"
                onClick={() => setDateFilter(undefined)}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>

        <div className="w-full sm:w-48">
          <SearchableSelect
            label="Shift"
            value={shiftFilter}
            options={["All", ...shifts.map(s => s.shift_name || s.name || s.value_name)]}
            onChange={(value) => {
              setShiftFilter(value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="w-full sm:w-48">
          <SearchableSelect
            label="Operation"
            value={operationFilter}
            options={["All", ...orderedOperations.map(o => o.operation_name || o.name)]}
            onChange={(value) => {
              setOperationFilter(value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="w-full sm:w-48">
          <SearchableSelect
            label="Status"
            value={statusFilter}
            options={["All", ...batchStatuses.map(s => s.status_name || s.name || s.value_name)]}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="w-full lg:w-auto flex gap-2 mt-4 lg:mt-0">
          {canCreate(permissionModule) && (
            <>
              <Button onClick={handleOpenBatchForm} className="flex-1 lg:flex-none h-10 whitespace-nowrap px-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Batch
              </Button>
              <Button onClick={handleOpenBulkBatchForm} className="flex-1 lg:flex-none h-10 whitespace-nowrap px-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Bulk Batches
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Table Card - UI matches Materials reference */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Batch Code</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Date</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">MR Code</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Operation</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Work Center</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Shift</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-center font-bold text-[11px] tracking-wider py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isListLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      No batches found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((batch) => (
                    <TableRow key={batch.id} className="hover:bg-muted/30 transition-colors border-b">
                      <TableCell className="py-4 font-medium font-mono">{batch.batchNo}</TableCell>
                      <TableCell>{formatDate(batch.date)}</TableCell>
                      <TableCell className="font-mono">{batch.mrNo}</TableCell>
                      <TableCell>{batch.operation}</TableCell>
                      <TableCell>{batch.workCenter}</TableCell>
                      <TableCell>{batch.shift}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium",
                            batch.status === "Batch Created" && "border-blue-500 text-blue-600 bg-blue-50",
                            batch.status === "Sent for QC" && "border-yellow-500 text-yellow-600 bg-yellow-50",
                            batch.status === "Verified QC" && "border-green-500 text-green-600 bg-green-50",
                            batch.status === "Batch Closed" && "border-gray-500 text-gray-600 bg-gray-50"
                          )}
                        >
                          {batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-4">
                        <div className={cn(isRowActionBusy && "pointer-events-none opacity-50")}>
                          <TableActionButtons
                            onView={canView(permissionModule) ? () => handleView(batch.id) : undefined}
                            onEdit={(batch.status === "Batch Created" && canEdit(permissionModule)) ? () => handleEdit(batch.id) : undefined}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination - Same position as Materials reference */}
          {!isListLoading && totalRecords > 0 && (
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

      {/* View/Edit Batch Modal */}
      <Dialog open={isViewBatchModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsViewBatchModalOpen(false);
          setViewingBatch(null);
          setIsReadOnly(false);
          setSelectedMRId(null);
          setSelectedMRDetails(null);
          setBatchFormData({
            batchNo: "",
            date: "",
            createdBy: "",
            mrNo: "",
            operation: "",
            workCenter: "",
            shift: "",
            startTime: null,
            endTime: null,
            savedBatchId: null,
            status: "Batch Created",
            createdType: "SINGLE",
            inputItems: [],
            outputItems: []
          });
        }
      }}
      >
        <DialogContent
          className="flex h-auto max-h-[85vh] w-[95%] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="shrink-0 space-y-1 border-b p-4 pb-3 sm:px-5 sm:pb-4">
            <DialogTitle className="text-lg font-bold sm:text-xl">
              {batchFormMode === 'view' ? 'View Batch' : 'Edit Batch'}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
            {isDetailLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <div className="space-y-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Batch Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <div className="min-w-0 space-y-1.5">
                        <Label>Batch Code</Label>
                        <Input value={batchFormData.batchNo} readOnly className="h-9 bg-muted" />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label>Date</Label>
                        <Input value={formatDate(batchFormData.date)} readOnly className="h-9 bg-muted" />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label>MR Code</Label>
                        <Input value={batchFormData.mrNo} readOnly className="h-9 bg-muted" />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label>Shift</Label>
                        <Input value={batchFormData.shift} readOnly className="h-9 bg-muted" />
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="min-w-0 space-y-1.5">
                        <Label>Operation</Label>
                        <Input value={batchFormData.operation} readOnly className="h-9 bg-muted" />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label>Work Center</Label>
                        <Input
                          value={
                            batchFormData.workCenter ||
                            selectedMRDetails?.workCenter ||
                            ""
                          }
                          readOnly
                          className="h-9 bg-muted"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {viewingBatch?.status === "Verified QC" && viewingBatch.qcStatus === "Verified" && (
                  <Card className="border-green-200 bg-green-50/50">
                    <CardHeader>
                      <CardTitle className="text-green-700">QC Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="min-w-0 space-y-1.5">
                          <Label className="text-green-700">QC Status</Label>
                          <Input value={viewingBatch.qcStatus} readOnly className="h-9 bg-white border-green-200" />
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <Label className="text-green-700">Verified By</Label>
                          <Input value={viewingBatch.qcVerifiedBy || ""} readOnly className="h-9 bg-white border-green-200" />
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <Label className="text-green-700">Verified On</Label>
                          <Input value={viewingBatch.qcVerifiedOn ? formatDate(viewingBatch.qcVerifiedOn) : ""} readOnly className="h-9 bg-white border-green-200" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex flex-col gap-5">
                  <Card className="min-w-0">
                    <CardHeader>
                      <CardTitle>Input Items (Supplied)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={cn(
                          "overflow-x-auto overflow-hidden rounded-md border",
                          batchFormData.inputItems.length > 6 &&
                            "max-h-[min(45vh,360px)] overflow-y-auto custom-scrollbar"
                        )}
                      >
                        <Table className="w-full min-w-[640px]">
                          <colgroup>
                            <col className="w-[32%]" />
                            <col className="w-[22%]" />
                            <col className="w-[10%]" />
                            <col className="w-[18%]" />
                            <col className="w-[18%]" />
                          </colgroup>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="py-2 pl-3 text-[10px] font-bold uppercase tracking-wider">
                                Item
                              </TableHead>
                              <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider">
                                SKU
                              </TableHead>
                              <TableHead className="py-2 pr-4 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                                UOM
                              </TableHead>
                              <TableHead className="py-2 pl-2 pr-2 text-center text-[10px] font-bold uppercase tracking-wider leading-tight whitespace-nowrap">
                                <span className="block">Total MR</span>
                                <span className="block">Qty</span>
                              </TableHead>
                              <TableHead className="py-2 pr-3 text-right text-[10px] font-bold uppercase tracking-wider leading-tight whitespace-nowrap">
                                <span className="block">Qty</span>
                                <span className="block">Supplied</span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batchFormData.inputItems.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                                  No input items
                                </TableCell>
                              </TableRow>
                            ) : (
                              batchFormData.inputItems.map((item) => {
                                const selectedMR = selectedMRDetails ?? mrRequests.find((mr) => mr.mrNumber === batchFormData.mrNo);
                                const mrItem = selectedMR?.items.find((i) => i.itemName === item.item);
                                const totalMRQty = mrItem?.requiredQty || item.availableQty;

                                return (
                                  <TableRow key={item.id}>
                                    <TableCell className="align-top pl-3">
                                      <span className="whitespace-normal text-xs leading-snug wrap-break-word">
                                        {item.item}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {formatBatchItemSkuLabel(item)}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap pr-4 text-[11px]">
                                      {item.uom}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap pl-2 pr-2 text-center text-xs tabular-nums">
                                      {totalMRQty}
                                    </TableCell>
                                    <TableCell className="pr-3 text-right">
                                      {batchFormData.createdType === "BULK" || isReadOnly ? (
                                        <span className="text-xs font-medium">{item.qtySupplied}</span>
                                      ) : (
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          value={item.qtySupplied}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 6)) {
                                              handleInputQtyChange(item.id, val);
                                            }
                                          }}
                                          className="h-8 w-24 px-2 text-right text-xs"
                                        />
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="min-w-0">
                    <CardHeader>
                      <CardTitle>Output Items (Produced)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={cn(
                          "overflow-x-auto overflow-hidden rounded-md border",
                          batchFormData.outputItems.length > 6 &&
                            "max-h-[min(45vh,360px)] overflow-y-auto custom-scrollbar"
                        )}
                      >
                        <Table className="w-full min-w-[520px]">
                          <colgroup>
                            <col className="w-[38%]" />
                            <col className="w-[26%]" />
                            <col className="w-[12%]" />
                            {viewingBatch?.status === "Verified QC" ? (
                              <>
                                <col className="w-[12%]" />
                                <col className="w-[12%]" />
                              </>
                            ) : (
                              <col className="w-[24%]" />
                            )}
                          </colgroup>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider">
                                Item
                              </TableHead>
                              <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider">
                                SKU
                              </TableHead>
                              <TableHead className="py-2 text-[10px] font-bold uppercase tracking-wider">
                                UOM
                              </TableHead>
                              <TableHead className="py-2 text-right text-[10px] font-bold uppercase tracking-wider">
                                Qty Produced
                              </TableHead>
                              {viewingBatch?.status === "Verified QC" && (
                                <TableHead className="py-2 text-right text-[10px] font-bold uppercase tracking-wider">
                                  Verified Qty
                                </TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batchFormData.outputItems.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={viewingBatch?.status === "Verified QC" ? 5 : 4}
                                  className="py-4 text-center text-xs text-muted-foreground"
                                >
                                  No output items
                                </TableCell>
                              </TableRow>
                            ) : (
                              batchFormData.outputItems.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="align-top">
                                    <span className="whitespace-normal text-xs leading-snug wrap-break-word">
                                      {item.item}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {formatBatchItemSkuLabel(item)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-xs">
                                    {item.uom}
                                  </TableCell>
                                  <TableCell className="text-right text-xs">
                                    {isReadOnly ? (
                                      <span className="font-medium">{item.qtyProduced}</span>
                                    ) : (
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={item.qtyProduced}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 6)) {
                                            handleOutputQtyChange(item.id, val);
                                          }
                                        }}
                                        className="h-8 w-24 px-2 text-right text-xs"
                                      />
                                    )}
                                  </TableCell>
                                  {viewingBatch?.status === "Verified QC" && (
                                    <TableCell className="text-right text-xs">
                                      <span className="font-medium text-green-700">{item.verifiedQty || 0}</span>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t bg-muted/20 p-4 sm:flex-row sm:justify-end sm:p-5">
            {isReadOnly ? (
              <Button variant="outline" onClick={() => setIsViewBatchModalOpen(false)} disabled={isDetailLoading}>
                Close
              </Button>
            ) : (
              <div className="flex justify-end gap-3 w-full">
                <Button variant="outline" onClick={() => setIsViewBatchModalOpen(false)} disabled={isDetailLoading || isSaving || isBatchSubmitInProgress}>
                  Cancel
                </Button>
                <Button
                  onClick={handleBatchSubmit}
                  loading={isBatchSubmitInProgress || isSaving}
                  disabled={!isSubmitEnabled() || isDetailLoading || isBatchSubmitInProgress || isSaving}
                  className={
                    isSubmitEnabled()
                      ? "bg-blue-600 text-white hover:bg-blue-600/90 border-blue-600"
                      : "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:!opacity-100"
                  }
                >
                  Send for QC
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Form Modal (Create) */}
      <Dialog open={isBatchFormModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsBatchFormModalOpen(false);
        resetCreateBatchForm();
        }
      }}>
        <DialogContent
          className="max-w-6xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Create Batch</DialogTitle>
          </DialogHeader>

          {isFormOpening ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Date</Label>
                    <div
                      className="flex h-10 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-foreground tabular-nums"
                      aria-readonly="true"
                    >
                      {formatDate(batchFormData.date)}
                    </div>
                  </div>
                  <SharedSearchableSelect
                    label="Shift"
                    value={batchFormData.shift}
                    options={shifts.map(s => s.shift_name || s.name || s.value_name)}
                    onChange={(val) => {
                      const shiftRecord = shifts.find((sh) => (sh.shift_name || sh.name || sh.value_name) === val);
                      const shift_id = shiftRecord?.id ?? shiftRecord?.shift_id;
                      setBatchFormData({ ...batchFormData, shift: val, mrNo: "" });
                      setSelectedMRId(null);
                      setSelectedMRDetails(null);
                      if (shift_id) {
                        void fetchMRRequestsForDropdown(shift_id);
                      } else {
                        setMrRequests([]);
                      }
                    }}
                    required
                    className="h-9 min-h-9"
                  />
                  <SharedSearchableSelect
                    label="MR Code"
                    value={selectedMRId != null ? String(selectedMRId) : ""}
                    options={mrRequests.map((mr) => ({ label: mr.mrNumber, value: String(mr.id) }))}
                    onChange={handleBatchMRSelection}
                    disabled={!batchFormData.shift}
                    required
                    className="h-9 min-h-9"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Input</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md border">
                    <Table className="min-w-[720px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Item</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>UOM</TableHead>
                          <TableHead className="text-center">Total MR Qty</TableHead>
                          <TableHead className="text-right">Qty Supplied</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batchFormData.inputItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              {batchFormData.mrNo ? "No input items" : "Select an MR No to load input items"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          batchFormData.inputItems.map((item) => {
                            const selectedMR = selectedMRDetails ?? mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo);
                            const mrItem = selectedMR?.items.find(i => i.itemName === item.item);
                            const totalMRQty = mrItem?.requiredQty || item.availableQty;

                            return (
                              <TableRow key={item.id}>
                                <TableCell>{item.item}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {formatBatchItemSkuLabel(item)}
                                </TableCell>
                                <TableCell>{item.uom}</TableCell>
                                <TableCell className="text-center font-medium text-muted-foreground tabular-nums">
                                  {totalMRQty}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={item.qtySupplied}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 6)) {
                                        handleInputQtyChange(item.id, val);
                                      }
                                    }}
                                    className="w-24 text-right"
                                  />
                                  {getQtySuppliedValidationMessage(item) && (
                                    <p className="mt-1 text-[11px] text-destructive text-left">
                                      {getQtySuppliedValidationMessage(item)}
                                    </p>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Output</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md border">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Item</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>UOM</TableHead>
                          <TableHead className="text-right">Qty Produced</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batchFormData.outputItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              {batchFormData.mrNo ? "No output items" : "Select an MR No to load output items"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          batchFormData.outputItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.item}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatBatchItemSkuLabel(item)}
                              </TableCell>
                              <TableCell>{item.uom}</TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.qtyProduced}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 6)) {
                                      handleOutputQtyChange(item.id, val);
                                    }
                                  }}
                                  className="w-24 text-right"
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBatchFormModalOpen(false)} disabled={isFormOpening || isSaving || isBatchSubmitInProgress}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleBatchSave}
              loading={isSaving}
              disabled={!isSaveEnabled() || isFormOpening || isSaving || isBatchSubmitInProgress}
              className={
                isSaveEnabled()
                  ? ""
                  : "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:!opacity-100"
              }
            >
              Save
            </Button>
            <Button
              onClick={() => setIsBatchSubmitConfirmOpen(true)}
              loading={isBatchSubmitInProgress}
              disabled={!isSubmitEnabled() || isFormOpening || isSaving || isBatchSubmitInProgress}
              className={
                isSubmitEnabled() && !isBatchSubmitInProgress
                  ? "bg-blue-600 text-white hover:bg-blue-600/90 border-blue-600"
                  : "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:!opacity-100"
              }
            >
              Submit / Send for QC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Submit Confirmation Dialog */}
      <AlertDialog open={isBatchSubmitConfirmOpen} onOpenChange={setIsBatchSubmitConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Batch / Send for QC</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit this batch? Once submitted, the batch will be sent for QC verification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isBatchSubmitInProgress}
              onClick={async () => {
                if (isBatchSubmitInProgress) return;
                setIsBatchSubmitConfirmOpen(false);
                await handleBatchSubmit();
              }}
            >
              Submit / Send for QC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Batch Creation Modal */}
      <Dialog open={isBulkBatchModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsBulkBatchModalOpen(false);
          setBulkSelectedMRId(null);
          setBulkBatchFormData({
            shift: "",
            numberOfBatches: 0,
            date: getCurrentDateForInput()
          });
        }
      }}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Create Bulk Batches</DialogTitle>
          </DialogHeader>

          {isFormOpening ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <SharedSearchableSelect
                    label="Shift"
                    value={bulkBatchFormData.shift}
                    options={shifts.map((s) => s.shift_name || s.name || s.value_name)}
                    onChange={(val) => {
                      const shiftRecord = shifts.find((sh) => (sh.shift_name || sh.name || sh.value_name) === val);
                      const shift_id = shiftRecord?.id ?? shiftRecord?.shift_id;
                      setBulkBatchFormData((prev) => ({
                        ...prev,
                        shift: val,
                        mrNo: ""
                      }));
                      setBulkSelectedMRId(null);
                      if (shift_id) {
                        void fetchMRRequestsForDropdown(shift_id);
                      } else {
                        setMrRequests([]);
                      }
                    }}
                    required
                    className="h-9 min-h-9"
                  />
                  <SharedSearchableSelect
                    label="MR Code"
                    value={bulkSelectedMRId != null ? String(bulkSelectedMRId) : ""}
                    options={mrRequests.map((mr) => ({ label: mr.mrNumber, value: String(mr.id) }))}
                    onChange={handleBulkBatchMRSelection}
                    disabled={!bulkBatchFormData.shift}
                    required
                    className="h-9 min-h-9"
                  />

                  <div>
                    <Label>No. of Batches <span className="text-red-500">*</span></Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={bulkBatchFormData.numberOfBatches}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || (/^\d*$/.test(val) && val.length <= 6)) {
                          handleBulkBatchNumberChange(val);
                        }
                      }}
                      placeholder="Enter number of batches"
                    />
                  </div>

                  <div>
                    <Label>Date</Label>
                    <div
                      className="flex h-10 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm text-foreground tabular-nums"
                      aria-readonly="true"
                    >
                      {formatDate(bulkBatchFormData.date)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBulkBatchModalOpen(false)} disabled={isFormOpening || isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitBulkBatches}
              loading={isSaving}
              disabled={!canSubmitBulkBatches || isFormOpening || isSaving}
              className={
                canSubmitBulkBatches
                  ? "bg-blue-600 text-white hover:bg-blue-600/90 border-blue-600"
                  : "bg-muted text-muted-foreground border-muted hover:bg-muted disabled:!opacity-100"
              }
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
