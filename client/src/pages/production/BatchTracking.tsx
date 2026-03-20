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

import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check, Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { 
  type BatchRecord, 
  type BatchItem,
  mockBatchRecords, 
  addBatchRecord, 
  updateBatchRecord,
  OPERATION_QC_REQUIRED
} from "@/lib/batchSharedData";

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
}

interface MRRequestItem {
  id: number;
  itemCode: string;
  itemName: string;
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
        const prevMonth = new Date(year, month - 1, 0);
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const dayDate = new Date(year, month - 1, prevMonth.getDate() - i);
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
const OPERATION_OUTPUT_MAPPINGS: Record<string, { itemCode: string; itemName: string; uom: string }[]> = {
  "Lead Generation & Purification": [
    { itemCode: "sfg-1", itemName: "Purified Lead", uom: "KG" },
  ],
  "Case Creation": [
    { itemCode: "sfg-2", itemName: "Battery Cases", uom: "NOS" },
    { itemCode: "sfg-3", itemName: "Battery Lids", uom: "NOS" },
  ],
  "Grid Creation & Oxidization": [
    { itemCode: "sfg-4", itemName: "Separators", uom: "PCS" },
  ],
  "Assembly line & Packaging": [
    { itemCode: "fg-1", itemName: "GSV 7", uom: "NOS" },
  ],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BatchTracking() {
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
  const [isBulkBatchModalOpen, setIsBulkBatchModalOpen] = useState(false);

  // Sample MR Requests data (needed for MR selection)
  const [mrRequests] = useState<MRRequest[]>([
    {
      id: 1,
      mrNumber: "MR-2024-001",
      date: "2024-01-15",
      requiredByDate: "2024-01-20",
      operation: "Lead Generation & Purification",
      workCenter: "Lead Furnace Center",
      warehouse: "Jinja WH",
      requestedBy: "John Doe",
      totalItems: 1,
      status: "Request to Warehouse",
      items: [
        { id: 1, itemCode: "rm-1", itemName: "Scrap Battery", uom: "KG", availableQty: 1500, requiredQty: 2000 },
      ]
    },
    {
      id: 2,
      mrNumber: "MR-2024-002",
      date: "2024-01-16",
      requiredByDate: "2024-01-22",
      operation: "Assembly line & Packaging",
      workCenter: "Assembly Line",
      warehouse: "Jinja WH",
      requestedBy: "Jane Smith",
      totalItems: 3,
      status: "Issued by Warehouse",
      items: [
        { id: 1, itemCode: "sfg-2", itemName: "Battery Cases", uom: "NOS", availableQty: 100, requiredQty: 150 },
        { id: 2, itemCode: "sfg-3", itemName: "Battery Lids", uom: "NOS", availableQty: 100, requiredQty: 150 },
        { id: 3, itemCode: "rm-3", itemName: "Acid Type A", uom: "LTR", availableQty: 200, requiredQty: 150 },
      ]
    },
    {
      id: 4,
      mrNumber: "MR-2024-004",
      date: "2024-01-21",
      requiredByDate: "2024-01-26",
      operation: "Case Creation",
      workCenter: "Plastic Casing Center",
      warehouse: "Jinja WH",
      requestedBy: "Sarah Williams",
      totalItems: 1,
      status: "Issued by Warehouse",
      items: [
        { id: 1, itemCode: "rm-2", itemName: "Plastic Pallets", uom: "KG", availableQty: 500, requiredQty: 200 },
      ]
    },
  ]);

  // Sample Batch Tracking data
  const [batchTrackings, setBatchTrackings] = useState<BatchTracking[]>(mockBatchRecords);

  // Batch form data
  const [batchFormData, setBatchFormData] = useState({
    batchNo: `BATCH-${new Date().getFullYear()}-${String(batchTrackings.length + 1).padStart(3, '0')}`,
    date: getCurrentDateForInput(),
    createdBy: "Current User",
    mrNo: "",
    operation: "",
    shift: "" as "Morning" | "Night" | "",
    startTime: null as string | null,
    endTime: null as string | null,
    savedBatchId: null as number | null,
    status: "Batch Created" as "Batch Created" | "Sent for QC" | "Verified QC" | "Batch Closed",
    createdType: "SINGLE" as "SINGLE" | "BULK",
    inputItems: [] as BatchItem[],
    outputItems: [] as BatchItem[]
  });



  // Bulk batch form data
  const [bulkBatchFormData, setBulkBatchFormData] = useState({
    mrNo: "",
    shift: "" as "Morning" | "Night" | "",
    numberOfBatches: 0 as number | string,
    date: getCurrentDateForInput(),
    items: [] as { itemCode: string; itemName: string; uom: string; totalMRQty: number; availableQty: number; qtyPerBatch: number }[]
  });

  const [bulkBatchPreviews, setBulkBatchPreviews] = useState<{
    batchNo: string;
    inputItems: BatchItem[];
    outputItems: BatchItem[];
  }[]>([]);

  const [activeBulkBatchTab, setActiveBulkBatchTab] = useState("batch-1");
  const [bulkBatchValidationError, setBulkBatchValidationError] = useState("");
  const [isReadOnly, setIsReadOnly] = useState(false);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (matchNew) {
      setBatchFormData({
        batchNo: `BATCH-${new Date().getFullYear()}-${String(batchTrackings.length + 1).padStart(3, '0')}`,
        date: getCurrentDateForInput(),
        createdBy: "Current User",
        mrNo: "",
        operation: "",
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

  const handleBatchMRSelection = (mrNo: string) => {
    const selectedMR = mrRequests.find(mr => mr.mrNumber === mrNo);
    if (selectedMR) {
      const inputItems = selectedMR.items.map((item, index) => ({
        id: index + 1,
        item: item.itemName,
        itemCode: item.itemCode,
        itemName: item.itemName,
        uom: item.uom,
        availableQty: item.requiredQty,
        qtySupplied: 0,
        qtyProduced: 0
      }));

      const outputMapping = OPERATION_OUTPUT_MAPPINGS[selectedMR.operation] || [];
      const outputItems = outputMapping.map((item, index) => ({
        id: index + 1,
        item: item.itemName,
        itemCode: item.itemCode,
        itemName: item.itemName,
        uom: item.uom,
        qtyProduced: 0,
        qtySupplied: 0
      }));

      setBatchFormData({
        ...batchFormData,
        mrNo,
        operation: selectedMR.operation,
        inputItems,
        outputItems
      });
    }
  };

  const handleBatchSave = () => {
    if (!batchFormData.mrNo) {
      toast({ variant: "destructive", title: "Validation Error", description: "MR No is required" });
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

    const startTime = batchFormData.startTime || new Date().toISOString();
    const hasOutputQty = batchFormData.outputItems.some(item => parseFloat(item.qtyProduced.toString()) > 0);
    const qcRequired = OPERATION_QC_REQUIRED[batchFormData.operation] !== false;
    
    let newStatus: "Batch Created" | "Sent for QC" | "Verified QC" | "Batch Closed" = "Batch Created";
    if (hasOutputQty) {
      newStatus = qcRequired ? "Sent for QC" : "Verified QC";
    }

    if (batchFormData.savedBatchId) {
      updateBatchRecord(batchFormData.savedBatchId, {
        status: newStatus,
        startTime,
        mrNo: batchFormData.mrNo,
        shift: batchFormData.shift as "Morning" | "Night",
        operation: batchFormData.operation,
        workCenter: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.workCenter || "",
        warehouse: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.warehouse || "",
        totalInputItems: batchFormData.inputItems.length,
        totalOutputItems: batchFormData.outputItems.filter(item => (parseFloat(item.qtyProduced.toString()) || 0) > 0).length,
        inputItems: batchFormData.inputItems,
        outputItems: batchFormData.outputItems,
        qcStatus: qcRequired && newStatus === "Sent for QC" ? "Sent for QC" : undefined,
        qcRequired
      });
      setBatchTrackings([...mockBatchRecords]);
      setBatchFormData({ ...batchFormData, startTime, status: newStatus });
    } else {
      const newBatch: BatchTracking = {
        id: mockBatchRecords.length + 1,
        batchNo: batchFormData.batchNo,
        date: batchFormData.date,
        mrNo: batchFormData.mrNo,
        shift: batchFormData.shift as "Morning" | "Night",
        operation: batchFormData.operation,
        workCenter: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.workCenter || "",
        warehouse: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.warehouse || "",
        totalInputItems: batchFormData.inputItems.length,
        totalOutputItems: batchFormData.outputItems.filter(item => parseFloat(item.qtyProduced.toString()) > 0).length,
        status: newStatus,
        createdType: "SINGLE",
        startTime,
        inputItems: batchFormData.inputItems,
        outputItems: batchFormData.outputItems,
        qcStatus: (qcRequired && newStatus === "Sent for QC" ? "Sent for QC" : undefined) as any,
        qcRequired
      };
      addBatchRecord(newBatch);
      setBatchTrackings([...mockBatchRecords]);
      setBatchFormData({ ...batchFormData, startTime, savedBatchId: newBatch.id, status: newStatus, createdType: "SINGLE" });
    }

    toast({ title: "Saved", description: qcRequired ? `Batch saved as ${newStatus}` : `Batch saved and QC skipped` });
    setIsBatchFormModalOpen(false);
  };

  const handleBatchSubmit = () => {
    if (!batchFormData.mrNo) {
      toast({ variant: "destructive", title: "Validation Error", description: "MR No is required" });
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
    const hasOutputQty = batchFormData.outputItems.some(item => parseFloat(item.qtyProduced.toString()) > 0);
    if (!hasOutputQty) {
      toast({ variant: "destructive", title: "Validation Error", description: "At least one output quantity must be greater than 0 to submit" });
      return;
    }

    const endTime = new Date().toISOString();
    completeBatchSubmission(endTime);
  };

  const completeBatchSubmission = (endTime: string) => {
    const qcRequired = OPERATION_QC_REQUIRED[batchFormData.operation] !== false;
    const finalStatus = qcRequired ? "Sent for QC" : "Verified QC";

    if (batchFormData.savedBatchId) {
      updateBatchRecord(batchFormData.savedBatchId, {
        status: finalStatus,
        endTime: endTime,
        totalInputItems: batchFormData.inputItems.length,
        totalOutputItems: batchFormData.outputItems.filter(item => parseFloat(item.qtyProduced.toString()) > 0).length,
        inputItems: batchFormData.inputItems,
        outputItems: batchFormData.outputItems,
        qcStatus: qcRequired ? "Sent for QC" : undefined,
        qcRequired
      });
      setBatchTrackings([...mockBatchRecords]);
      toast({ title: "Success", description: `Batch ${batchFormData.batchNo} submitted successfully ${qcRequired ? "" : "(QC Skipped)"}` });
      setIsViewBatchModalOpen(false); // Close the modal
    } else {
      const newBatch: BatchTracking = {
        id: mockBatchRecords.length + 1,
        batchNo: batchFormData.batchNo,
        date: batchFormData.date,
        mrNo: batchFormData.mrNo,
        shift: batchFormData.shift as "Morning" | "Night",
        operation: batchFormData.operation,
        workCenter: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.workCenter || "",
        warehouse: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.warehouse || "",
        totalInputItems: batchFormData.inputItems.length,
        totalOutputItems: batchFormData.outputItems.filter(item => parseFloat(item.qtyProduced.toString()) > 0).length,
        status: finalStatus,
        createdType: "SINGLE",
        startTime: batchFormData.startTime || new Date().toISOString(),
        endTime: endTime,
        inputItems: batchFormData.inputItems,
        outputItems: batchFormData.outputItems,
        qcStatus: (qcRequired ? "Sent for QC" : undefined) as any,
        qcRequired
      };
      addBatchRecord(newBatch);
      setBatchTrackings([...mockBatchRecords]);
      toast({ title: "Success", description: `Batch ${batchFormData.batchNo} submitted successfully ${qcRequired ? "" : "(QC Skipped)"}` });
      setIsViewBatchModalOpen(false); // Close the modal
    }
  };

  const handleView = (id: number) => {
    const batch = batchTrackings.find(b => b.id === id);
    if (batch) {
      setViewingBatch(batch);
      const outputItems = (batch.outputItems && batch.outputItems.length > 0)
        ? batch.outputItems
        : (() => {
          const outputMapping = OPERATION_OUTPUT_MAPPINGS[batch.operation] || [];
          return outputMapping.map((item, index) => ({
            id: index + 1,
            item: item.itemName,
            uom: item.uom,
            qtyProduced: 0,
            qtySupplied: 0
          }));
        })();

      const selectedMR = mrRequests.find(mr => mr.mrNumber === batch.mrNo);
      const inputItems = batch.inputItems?.map(item => {
        const mrItem = selectedMR?.items.find(mi => mi.itemName === item.item);
        return {
          ...item,
          availableQty: mrItem?.requiredQty || item.availableQty || 0
        };
      }) || [];

      setBatchFormData({
        batchNo: batch.batchNo,
        date: batch.date,
        createdBy: "Current User",
        mrNo: batch.mrNo,
        operation: batch.operation,
        shift: batch.shift,
        startTime: batch.startTime || null,
        endTime: batch.endTime || null,
        savedBatchId: batch.id,
        status: batch.status,
        createdType: batch.createdType || "SINGLE",
        inputItems: inputItems,
        outputItems: outputItems
      });
      setIsReadOnly(true);
      setBatchFormMode('view');
      setIsViewBatchModalOpen(true);
    }
  };

  const handleEdit = (id: number) => {
    const batch = batchTrackings.find(b => b.id === id);
    if (batch) {
      // Only allow editing if status is "Batch Created"
      if (batch.status === "Batch Created") {
        // Open in modal instead of navigating to edit page
        const outputItems = (batch.outputItems && batch.outputItems.length > 0)
          ? batch.outputItems
          : (() => {
            const outputMapping = OPERATION_OUTPUT_MAPPINGS[batch.operation] || [];
            return outputMapping.map((item, index) => ({
              id: index + 1,
              item: item.itemName,
              uom: item.uom,
              qtyProduced: 0,
              qtySupplied: 0
            }));
          })();

        const selectedMR = mrRequests.find(mr => mr.mrNumber === batch.mrNo);
        const inputItems = batch.inputItems?.map(item => {
          const mrItem = selectedMR?.items.find(mi => mi.itemName === item.item);
          return {
            ...item,
            availableQty: mrItem?.requiredQty || item.availableQty || 0
          };
        }) || [];

        setBatchFormData({
          batchNo: batch.batchNo,
          date: batch.date,
          createdBy: "Current User",
          mrNo: batch.mrNo,
          operation: batch.operation,
          shift: batch.shift,
          startTime: batch.startTime || null,
          endTime: batch.endTime || null,
          savedBatchId: batch.id,
          status: batch.status,
          createdType: batch.createdType || "SINGLE",
          inputItems: inputItems,
          outputItems: outputItems
        });
        setIsReadOnly(false);
        setBatchFormMode('edit');
        setIsViewBatchModalOpen(true); // Open the modal
      } else {
        toast({ 
          variant: "destructive", 
          title: "Cannot Edit", 
          description: `Batch with status "${batch.status}" cannot be edited. Only batches with status "Batch Created" can be edited.` 
        });
      }
    }
  };

  const handleBack = () => {
    setLocation("/production/batch-tracking");
  };

  const isSaveEnabled = () => {
    return batchFormData.mrNo && batchFormData.shift && 
           batchFormData.inputItems.some(item => parseFloat(item.qtySupplied.toString()) > 0);
  };

  const isSubmitEnabled = () => {
    return batchFormData.mrNo && batchFormData.shift && 
           batchFormData.inputItems.some(item => parseFloat(item.qtySupplied.toString()) > 0) &&
           batchFormData.outputItems.some(item => parseFloat(item.qtyProduced.toString()) > 0);
  };

  // ============================================================================
  // BULK BATCH HANDLERS
  // ============================================================================

  const handleBulkBatchMRSelection = (mrNo: string) => {
    const selectedMR = mrRequests.find(mr => mr.mrNumber === mrNo);
    if (!selectedMR) {
      setBulkBatchFormData({ ...bulkBatchFormData, mrNo, items: [] });
      setBulkBatchPreviews([]);
      setBulkBatchValidationError("");
      return;
    }

    if (!selectedMR.items || !Array.isArray(selectedMR.items)) {
      setBulkBatchFormData({ ...bulkBatchFormData, mrNo, items: [] });
      setBulkBatchPreviews([]);
      setBulkBatchValidationError("No items found for selected MR");
      return;
    }

    const itemsWithAvailableQty = selectedMR.items.map(mrItem => {
      const usedQty = batchTrackings
        .filter(batch => batch.mrNo === mrNo)
        .reduce((sum, batch) => {
          const inputItem = batch.inputItems?.find(item => item.item === mrItem.itemName);
          return sum + (inputItem?.qtySupplied || 0);
        }, 0);

      const availableQty = (mrItem.requiredQty || 0) - usedQty;

      return {
        itemCode: mrItem.itemCode || '',
        itemName: mrItem.itemName || '',
        uom: mrItem.uom || '',
        totalMRQty: mrItem.requiredQty || 0,
        availableQty: Math.max(0, availableQty),
        qtyPerBatch: 0
      };
    });

    const updatedFormData = {
      ...bulkBatchFormData,
      mrNo,
      items: itemsWithAvailableQty
    };

    setBulkBatchFormData(updatedFormData);

    if (parseFloat(updatedFormData.numberOfBatches.toString()) >= 1 && itemsWithAvailableQty.length > 0) {
      generateBulkBatchPreviews(parseFloat(updatedFormData.numberOfBatches.toString()), itemsWithAvailableQty, selectedMR);
    }
  };

  const generateBulkBatchPreviews = (numberOfBatches: number, items: typeof bulkBatchFormData.items, selectedMR: MRRequest) => {
    if (!selectedMR || !selectedMR.operation) {
      setBulkBatchValidationError("Invalid MR selected");
      setBulkBatchPreviews([]);
      return;
    }

    if (!items || items.length === 0) {
      const currentYear = new Date().getFullYear();
      const previews = [];

      for (let i = 0; i < numberOfBatches; i++) {
        const batchNo = `BATCH-${currentYear}-${String(batchTrackings.length + i + 1).padStart(3, '0')}`;
        const outputMapping = OPERATION_OUTPUT_MAPPINGS[selectedMR.operation];
        const outputItems = (outputMapping && Array.isArray(outputMapping)) ? outputMapping.map((item, idx) => ({
          id: idx + 1,
          item: item.itemName,
          itemCode: item.itemCode,
          itemName: item.itemName,
          uom: item.uom,
          qtyProduced: 0,
          qtySupplied: 0
        })) : [];

        previews.push({
          batchNo,
          inputItems: [],
          outputItems
        });
      }

      setBulkBatchPreviews(previews);
      setActiveBulkBatchTab("batch-1");
      setBulkBatchValidationError("");
      return;
    }

    const nosOrPcsItems = items.filter(
      item => (item.uom === "NOS" || item.uom === "PCS") && item.availableQty < numberOfBatches
    );

    if (nosOrPcsItems.length > 0) {
      setBulkBatchValidationError(
        `Batch count too high for item: ${nosOrPcsItems.map(i => i.itemName).join(", ")}. Available quantity is less than number of batches.`
      );
      setBulkBatchPreviews([]);
      return;
    }

    setBulkBatchValidationError("");

    const currentYear = new Date().getFullYear();
    const previews = [];

    for (let batchIndex = 0; batchIndex < numberOfBatches; batchIndex++) {
      const batchNo = `BATCH-${currentYear}-${String(batchTrackings.length + batchIndex + 1).padStart(3, '0')}`;

      const inputItems = items.map((item, idx) => {
        const totalToDivide = item.totalMRQty || 0;
        const base = Math.floor(totalToDivide / numberOfBatches);
        const rem = totalToDivide % numberOfBatches;
        const qtyForThisBatch = base + (batchIndex < rem ? 1 : 0);

        return {
          id: idx + 1,
          item: item.itemName,
          itemCode: item.itemCode,
          itemName: item.itemName,
          uom: item.uom,
          qtySupplied: qtyForThisBatch,
          qtyProduced: 0,
          availableQty: item.availableQty
        };
      });

      const outputMapping = OPERATION_OUTPUT_MAPPINGS[selectedMR.operation];
      const outputItems = (outputMapping && Array.isArray(outputMapping)) ? outputMapping.map((item, idx) => ({
        id: idx + 1,
        item: item.itemName,
        itemCode: item.itemCode,
        itemName: item.itemName,
        uom: item.uom,
        qtyProduced: 0,
        qtySupplied: 0
      })) : [];

      previews.push({
        batchNo,
        inputItems,
        outputItems
      });
    }

    setBulkBatchPreviews(previews);
    setActiveBulkBatchTab("batch-1");
  };

  const handleBulkBatchNumberChange = (value: string) => {
    setBulkBatchFormData(prev => ({
      ...prev,
      numberOfBatches: value
    }));

    const numValue = parseFloat(value) || 0;
    if (numValue >= 1 && bulkBatchFormData.mrNo && bulkBatchFormData.items.length > 0) {
      const selectedMR = mrRequests.find(mr => mr.mrNumber === bulkBatchFormData.mrNo);
      if (selectedMR) {
        generateBulkBatchPreviews(numValue, bulkBatchFormData.items, selectedMR);
      }
    } else if (numValue === 0) {
      setBulkBatchPreviews([]);
      setBulkBatchValidationError("");
    }
  };

  const handleSubmitBulkBatches = () => {
    if (!bulkBatchFormData.mrNo) {
      toast({ variant: "destructive", title: "Validation Error", description: "MR No is required" });
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
    if (bulkBatchValidationError) {
      toast({ variant: "destructive", title: "Validation Error", description: bulkBatchValidationError });
      return;
    }

    const selectedMR = mrRequests.find(mr => mr.mrNumber === bulkBatchFormData.mrNo);
    if (!selectedMR) return;

    const bulkGroupId = `BULK-${new Date().getFullYear()}-${String(batchTrackings.length + 1).padStart(3, '0')}`;
    const currentYear = new Date().getFullYear();
    const numberOfBatches = parseFloat(bulkBatchFormData.numberOfBatches.toString());
    const previewsToUse = [];

    for (let batchIndex = 0; batchIndex < numberOfBatches; batchIndex++) {
      const batchNo = `BATCH-${currentYear}-${String(batchTrackings.length + batchIndex + 1).padStart(3, '0')}`;

      const inputItems = bulkBatchFormData.items.map((item, idx) => {
        const totalToDivide = item.totalMRQty || 0;
        const base = Math.floor(totalToDivide / numberOfBatches);
        const rem = totalToDivide % numberOfBatches;
        const qtyForThisBatch = base + (batchIndex < rem ? 1 : 0);

        return {
          id: idx + 1,
          item: item.itemName,
          itemCode: item.itemCode,
          itemName: item.itemName,
          uom: item.uom,
          qtySupplied: qtyForThisBatch,
          qtyProduced: 0,
          availableQty: item.availableQty
        };
      });

      const outputMapping = OPERATION_OUTPUT_MAPPINGS[selectedMR.operation];
      const outputItems = (outputMapping && Array.isArray(outputMapping)) ? outputMapping.map((item, idx) => ({
        id: idx + 1,
        item: item.itemName,
        itemCode: item.itemCode,
        itemName: item.itemName,
        uom: item.uom,
        qtyProduced: 0,
        qtySupplied: 0
      })) : [];

      previewsToUse.push({
        batchNo,
        inputItems,
        outputItems
      });
    }

    const newBatches: BatchTracking[] = previewsToUse.map((preview, index) => ({
      id: batchTrackings.length + index + 1,
      batchNo: preview.batchNo,
      date: bulkBatchFormData.date,
      mrNo: bulkBatchFormData.mrNo,
      shift: bulkBatchFormData.shift as "Morning" | "Night",
      operation: selectedMR.operation,
      workCenter: selectedMR.workCenter,
      warehouse: selectedMR.warehouse,
      totalInputItems: preview.inputItems.length,
      totalOutputItems: 0,
      status: "Batch Created",
      createdType: "BULK",
      bulkBatchGroupId: bulkGroupId,
      startTime: new Date().toISOString(),
      inputItems: preview.inputItems,
      outputItems: preview.outputItems,
      qcRequired: OPERATION_QC_REQUIRED[selectedMR.operation] !== false
    }));

    newBatches.forEach(batch => addBatchRecord(batch));
    
    setBatchTrackings([...mockBatchRecords]);
    setIsBulkBatchModalOpen(false);
    toast({
      title: "Success",
      description: `${bulkBatchFormData.numberOfBatches} batches created successfully`
    });

    setBulkBatchFormData({
      mrNo: "",
      shift: "",
      numberOfBatches: 0,
      date: getCurrentDateForInput(),
      items: []
    });
    setBulkBatchPreviews([]);
    setBulkBatchValidationError("");
  };

  // ============================================================================
  // FILTERING & PAGINATION
  // ============================================================================

  const filteredBatchTrackings = batchTrackings.filter(item => {
    const matchesSearch = item.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.mrNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || item.status === statusFilter;
    const matchesOperation = operationFilter === "All" || item.operation === operationFilter;
    const matchesWorkCenter = workCenterFilter === "All" || item.workCenter === workCenterFilter;
    const matchesShift = shiftFilter === "All" || item.shift === shiftFilter;
    
    let matchesDate = true;
    if (dateFilter) {
      const selectedDate = format(dateFilter, "yyyy-MM-dd");
      matchesDate = item.date === selectedDate;
    }

    return matchesSearch && matchesStatus && matchesOperation && matchesWorkCenter && matchesShift && matchesDate;
  });

  // Pagination calculations - slice data for current page
  const totalPages = Math.ceil(filteredBatchTrackings.length / itemsPerPage);
  const paginatedData = filteredBatchTrackings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Auto-adjust page when data changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredBatchTrackings.length, currentPage, totalPages]);

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
              placeholder="Search by Batch No or MR No..."
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
            options={["All", "Morning", "Night"]}
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
            options={["All", ...OPERATIONS]}
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
            options={["All", "Batch Created", "Sent for QC", "Verified QC", "Batch Closed"]}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="w-full lg:w-auto flex gap-2 mt-4 lg:mt-0">
          <Button onClick={() => setIsBatchFormModalOpen(true)} className="flex-1 lg:flex-none h-10 whitespace-nowrap px-4">
            <Plus className="mr-2 h-4 w-4" />
            Create Batch
          </Button>
          <Button onClick={() => setIsBulkBatchModalOpen(true)} className="flex-1 lg:flex-none h-10 whitespace-nowrap px-4">
            <Plus className="mr-2 h-4 w-4" />
            Create Bulk Batches
          </Button>
        </div>
      </div>

      {/* Table Card - UI matches Materials reference */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Batch No</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Date</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">MR No</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Operation</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Work Center</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Shift</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-center font-bold text-[11px] tracking-wider py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
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
                        <TableActionButtons
                          onView={() => handleView(batch.id)}
                          onEdit={batch.status === "Batch Created" ? () => handleEdit(batch.id) : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination - Same position as Materials reference */}
          {filteredBatchTrackings.length > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredBatchTrackings.length}
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
          setBatchFormData({
            batchNo: "",
            date: "",
            createdBy: "",
            mrNo: "",
            operation: "",
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
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {batchFormMode === 'view' ? 'View Batch' : 'Edit Batch'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Batch No</Label>
                    <Input value={batchFormData.batchNo} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input value={formatDate(batchFormData.date)} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label>MR No</Label>
                    <Input value={batchFormData.mrNo} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label>Shift</Label>
                    <Input value={batchFormData.shift} readOnly className="bg-muted" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label>Operation</Label>
                    <Input value={batchFormData.operation} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label>Work Center</Label>
                    <Input value={mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.workCenter || ""} readOnly className="bg-muted" />
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-green-700">QC Status</Label>
                      <Input value={viewingBatch.qcStatus} readOnly className="bg-white border-green-200" />
                    </div>
                    <div>
                      <Label className="text-green-700">Verified By</Label>
                      <Input value={viewingBatch.qcVerifiedBy || ""} readOnly className="bg-white border-green-200" />
                    </div>
                    <div>
                      <Label className="text-green-700">Verified On</Label>
                      <Input value={viewingBatch.qcVerifiedOn ? formatDate(viewingBatch.qcVerifiedOn) : ""} readOnly className="bg-white border-green-200" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Input Items (Supplied)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead>Total MR Qty</TableHead>
                        <TableHead className="text-right">Qty Supplied</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchFormData.inputItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                            No input items
                          </TableCell>
                        </TableRow>
                      ) : (
                        batchFormData.inputItems.map((item) => {
                          const selectedMR = mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo);
                          const mrItem = selectedMR?.items.find(i => i.itemName === item.item);
                          const totalMRQty = mrItem?.requiredQty || item.availableQty;

                          return (
                            <TableRow key={item.id}>
                              <TableCell>{item.item}</TableCell>
                              <TableCell>{item.uom}</TableCell>
                              <TableCell>{totalMRQty}</TableCell>
                              <TableCell className="text-right">
                                {batchFormData.createdType === "BULK" || isReadOnly ? (
                                  <span className="font-medium">{item.qtySupplied}</span>
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
                                    className="w-28 text-right"
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

            <Card>
              <CardHeader>
                <CardTitle>Output Items (Produced)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead className="text-right">Qty Produced</TableHead>
                        {viewingBatch?.status === "Verified QC" && (
                          <TableHead className="text-right">Verified Qty</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchFormData.outputItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={viewingBatch?.status === "Verified QC" ? 4 : 3} className="text-center py-4 text-muted-foreground">
                            No output items
                          </TableCell>
                        </TableRow>
                      ) : (
                        batchFormData.outputItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.item}</TableCell>
                            <TableCell>{item.uom}</TableCell>
                            <TableCell className="text-right">
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
                                  className="w-28 text-right"
                                />
                              )}
                            </TableCell>
                            {viewingBatch?.status === "Verified QC" && (
                              <TableCell className="text-right">
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

          <DialogFooter>
            {isReadOnly ? (
              <Button variant="outline" onClick={() => setIsViewBatchModalOpen(false)}>
                Close
              </Button>
            ) : (
              <div className="flex justify-end gap-3 w-full">
                <Button variant="outline" onClick={() => setIsViewBatchModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleBatchSubmit}
                  disabled={!isSubmitEnabled()}
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
          setBatchFormData({
            batchNo: `BATCH-${new Date().getFullYear()}-${String(batchTrackings.length + 1).padStart(3, '0')}`,
            date: getCurrentDateForInput(),
            createdBy: "Current User",
            mrNo: "",
            operation: "",
            shift: "",
            startTime: null,
            endTime: null,
            savedBatchId: null,
            status: "Batch Created",
            createdType: "SINGLE",
            inputItems: [],
            outputItems: [],
          });
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Batch</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Date</Label>
                    <Input value={formatDate(batchFormData.date)} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label>Shift <span className="text-red-500">*</span></Label>
                    <Select
                      value={batchFormData.shift}
                      onValueChange={(value: "Morning" | "Night") => setBatchFormData({ ...batchFormData, shift: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Shift" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Morning">Morning</SelectItem>
                        <SelectItem value="Night">Night</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <SearchableSelect
                    label="MR No"
                    value={batchFormData.mrNo}
                    options={mrRequests.map((mr) => mr.mrNumber)}
                    onChange={handleBatchMRSelection}
                    required
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Input</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Item</TableHead>
                          <TableHead>UOM</TableHead>
                          <TableHead className="text-right">Total MR Qty</TableHead>
                          <TableHead className="text-right">Qty Supplied</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batchFormData.inputItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              {batchFormData.mrNo ? "No input items" : "Select an MR No to load input items"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          batchFormData.inputItems.map((item) => {
                            const selectedMR = mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo);
                            const mrItem = selectedMR?.items.find(i => i.itemName === item.item);
                            const totalMRQty = mrItem?.requiredQty || item.availableQty;

                            return (
                              <TableRow key={item.id}>
                                <TableCell>{item.item}</TableCell>
                                <TableCell>{item.uom}</TableCell>
                                <TableCell className="text-right font-medium text-muted-foreground">
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
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Item</TableHead>
                          <TableHead>UOM</TableHead>
                          <TableHead className="text-right">Qty Produced</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batchFormData.outputItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                              {batchFormData.mrNo ? "No output items" : "Select an MR No to load output items"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          batchFormData.outputItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.item}</TableCell>
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

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBatchFormModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleBatchSave}
              disabled={!isSaveEnabled()}
            >
              Save
            </Button>
            <Button
              onClick={() => setIsBatchSubmitConfirmOpen(true)}
              disabled={!isSubmitEnabled()}
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
              onClick={() => {
                setIsBatchSubmitConfirmOpen(false);
                handleBatchSubmit();
                setIsBatchFormModalOpen(false);
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
          setBulkBatchFormData({
            mrNo: "",
            shift: "",
            numberOfBatches: 0,
            date: getCurrentDateForInput(),
            items: []
          });
          setBulkBatchPreviews([]);
          setBulkBatchValidationError("");
          setActiveBulkBatchTab("batch-1");
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Bulk Batches</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <SearchableSelect
                    label="MR No"
                    value={bulkBatchFormData.mrNo}
                    options={mrRequests.map((mr) => mr.mrNumber)}
                    onChange={handleBulkBatchMRSelection}
                    required
                  />

                  <div>
                    <Label>Shift <span className="text-red-500">*</span></Label>
                    <Select
                      value={bulkBatchFormData.shift}
                      onValueChange={(value: "Morning" | "Night") =>
                        setBulkBatchFormData({ ...bulkBatchFormData, shift: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Shift" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Morning">Morning</SelectItem>
                        <SelectItem value="Night">Night</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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
                    <Input
                      value={formatDate(bulkBatchFormData.date)}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {bulkBatchFormData.mrNo && (
              <Card>
                <CardHeader>
                  <CardTitle>Material Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {bulkBatchFormData.items.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No items found for selected MR
                    </div>
                  ) : bulkBatchFormData.items.every(item => item.availableQty === 0) ? (
                    <div className="text-center py-8 text-destructive">
                      No available quantity. All material has been used in previous batches.
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Item Name</TableHead>
                            <TableHead>UOM</TableHead>
                            <TableHead className="text-right">Total MR Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkBatchFormData.items.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{item.itemName}</TableCell>
                              <TableCell>{item.uom}</TableCell>
                              <TableCell className="text-right font-medium">
                                {item.totalMRQty || 0}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {bulkBatchValidationError && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <div className="text-center py-4 text-destructive font-medium">
                    {bulkBatchValidationError}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBulkBatchModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitBulkBatches}
              disabled={!!bulkBatchValidationError}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
