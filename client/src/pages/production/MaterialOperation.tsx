import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
<TabsTrigger
  value="batch-tracking"
  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
>
  Batch Tracking
</TabsTrigger>
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInputBorderless,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, ChevronLeft, ChevronRight, AlertTriangle, Trash2, ArrowLeft, ChevronsUpDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date to DD-MM-YYYY format
 */
const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Get current date in YYYY-MM-DD format for input fields
 */
const getCurrentDateForInput = (): string => {
  return new Date().toISOString().split('T')[0];
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * MR Request interface
 * Represents a Material Request for production operations
 */
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
  isFinalized: boolean; // Internal flag - NOT shown in UI
  isInventoryIssued: boolean; // Track if inventory issue is done
  receivedAt?: string; // When marked as received
  receivedBy?: string; // Who marked as received
  items: MRRequestItem[];
}

/**
 * MR Request Item interface
 * Represents individual items in an MR Request
 */
interface MRRequestItem {
  id: number;
  itemCode: string;
  itemName: string;
  uom: string;
  availableQty: number;
  requiredQty: number;
}

/**
 * Pre-Procure interface
 * Represents a Pre-Procurement request for future stock
 */
interface PreProcure {
  id: number;
  preProcureNumber: string;
  date: string;
  operation: string;
  workCenter: string;
  warehouse: string;
  requestedBy: string;
  totalItems: number;
  isReceived: boolean; // Track if stock is received
  receivedAt?: string; // When marked as received
  receivedBy?: string; // Who marked as received
  procurementRequestId?: number; // Link to created PR
  grnStatus?: string; // GRN status for enabling Mark as Received
  items: PreProcureItem[];
}

/**
 * Pre-Procure Item interface
 * Represents individual items in a Pre-Procure request
 */
interface PreProcureItem {
  id: number;
  itemCode: string;
  itemName: string;
  uom: string;
  availableQty: number;
  plannedQty: number;
}

/**
 * Batch Tracking interface
 * Represents a batch tracking record for production operations
 */
interface BatchTracking {
  id: number;
  batchNo: string;
  date: string;
  mrNo: string;
  operation: string;
  workCenter: string;
  warehouse: string;
  totalInputItems: number;
  totalOutputItems: number;
  status?: "In Process" | "Completed";
  startTime?: string;
  endTime?: string;
  inputItems?: { id: number; item: string; uom: string; qtySupplied: number }[];
  outputItems?: { id: number; item: string; uom: string; qtyProduced: number }[];
}

/**
 * Operation mapping interface
 * Maps operations to their default work centers and required items
 */
interface OperationMapping {
  operation: string;
  workCenter: string;
  items: {
    itemCode: string;
    itemName: string;
    uom: string;
    standardQty: number;
  }[];
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

// ============================================================================
// MOCK DATA - Operations, Work Centers, Warehouses, Items
// ============================================================================

const OPERATIONS = ["Cutting", "Welding", "Assembly", "Painting", "Quality Check"];
const WORK_CENTERS = ["WC-001 Cutting Bay", "WC-002 Welding Station", "WC-003 Assembly Line", "WC-004 Paint Shop"];
const WAREHOUSES = ["Production Store", "Raw Material Store", "Finished Goods Store"];

// Mock operation-to-item mapping (BOM-like data)
const OPERATION_MAPPINGS: OperationMapping[] = [
  {
    operation: "Cutting",
    workCenter: "WC-001 Cutting Bay",
    items: [
      { itemCode: "MAT001", itemName: "Steel Sheet", uom: "KG", standardQty: 100 },
      { itemCode: "MAT002", itemName: "Aluminum Rod", uom: "KG", standardQty: 50 },
    ]
  },
  {
    operation: "Welding",
    workCenter: "WC-002 Welding Station",
    items: [
      { itemCode: "MAT003", itemName: "Welding Wire", uom: "KG", standardQty: 10 },
      { itemCode: "MAT004", itemName: "Gas Cylinder", uom: "NOS", standardQty: 2 },
    ]
  },
  {
    operation: "Assembly",
    workCenter: "WC-003 Assembly Line",
    items: [
      { itemCode: "MAT005", itemName: "Bolts M10", uom: "NOS", standardQty: 200 },
      { itemCode: "MAT006", itemName: "Nuts M10", uom: "NOS", standardQty: 200 },
      { itemCode: "MAT007", itemName: "Washers", uom: "NOS", standardQty: 400 },
    ]
  },
];

// Mock warehouse stock data
const WAREHOUSE_STOCK: { [warehouse: string]: { [itemCode: string]: number } } = {
  "Production Store": {
    "MAT001": 150,
    "MAT002": 30, // Shortage scenario
    "MAT003": 50,
    "MAT004": 5,
    "MAT005": 500,
    "MAT006": 450,
    "MAT007": 300, // Shortage scenario
  },
  "Raw Material Store": {
    "MAT001": 500,
    "MAT002": 250,
    "MAT003": 100,
    "MAT004": 10,
    "MAT005": 1000,
    "MAT006": 1000,
    "MAT007": 800,
  },
};

// Mock operation output mapping (what each operation produces)
const OPERATION_OUTPUT_MAPPINGS: Record<string, { itemCode: string; itemName: string; uom: string }[]> = {
  "Cutting": [
    { itemCode: "CUT001", itemName: "Cut Steel Plate", uom: "PCS" },
  ],
  "Welding": [
    { itemCode: "WLD001", itemName: "Welded Frame", uom: "PCS" },
  ],
  "Assembly": [
    { itemCode: "ASM001", itemName: "Assembled Unit", uom: "PCS" },
    { itemCode: "ASM002", itemName: "Sub Assembly", uom: "PCS" },
  ],
  "Painting": [
    { itemCode: "PNT001", itemName: "Painted Component", uom: "PCS" },
  ],
  "Quality Check": [
    { itemCode: "QC001", itemName: "Approved Product", uom: "PCS" },
  ],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MaterialOperation() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // Route matching for form views (specific routes first, then generic)
  const [matchNew] = useRoute("/production/material-operation/new");
  const [matchPreProcureNew] = useRoute("/production/material-operation/pre-procure/new");
  const [matchBatchNew] = useRoute("/production/material-operation/batch-tracking/new");
  const [matchBatchEdit, batchEditParams] = useRoute("/production/material-operation/batch-tracking/:id/edit");
  const [matchEdit, params] = useRoute("/production/material-operation/:id");
  
  // Exclude "mr-request", "pre-procure", and "batch-tracking" from being treated as an ID
  const isValidId = params?.id && params.id !== "mr-request" && params.id !== "pre-procure" && params.id !== "batch-tracking" && !isNaN(parseInt(params.id));
  const isFormView = matchNew || (matchEdit && isValidId) || matchPreProcureNew || matchBatchNew || matchBatchEdit;
  const editingId = isValidId ? parseInt(params.id) : null;
  const isPreProcureForm = matchPreProcureNew;
  const batchEditingId = batchEditParams?.id ? parseInt(batchEditParams.id) : null;
  const isBatchForm = matchBatchNew || matchBatchEdit;

  // ============================================================================
  // STATE - LISTING PAGE
  // ============================================================================
  
  const [activeTab, setActiveTab] = useState("mr-request");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [statusFilter, setStatusFilter] = useState("Request to Warehouse"); // Default to Request to Warehouse for MR Request
  const [batchStatusFilter, setBatchStatusFilter] = useState("In Process"); // Status filter for Batch Tracking

  // Modal state for viewing MR
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingMR, setViewingMR] = useState<MRRequest | null>(null);
  
  // Modal state for viewing Pre-Procure
  const [isViewPreProcureModalOpen, setIsViewPreProcureModalOpen] = useState(false);
  const [viewingPreProcure, setViewingPreProcure] = useState<PreProcure | null>(null);

  // Modal state for viewing Batch Tracking
  const [isViewBatchModalOpen, setIsViewBatchModalOpen] = useState(false);
  const [viewingBatch, setViewingBatch] = useState<BatchTracking | null>(null);

  // Validation state for quantity inputs
  const [qtyValidationErrors, setQtyValidationErrors] = useState<Record<number, string>>({});
  const [plannedQtyValidationErrors, setPlannedQtyValidationErrors] = useState<Record<number, string>>({});

  // Sample MR Requests data
  const [mrRequests, setMrRequests] = useState<MRRequest[]>([
    {
      id: 1,
      mrNumber: "MR-2024-001",
      date: "2024-01-15",
      requiredByDate: "2024-01-20",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      requestedBy: "John Doe",
      totalItems: 2,
      isFinalized: false, // Submitted status
      isInventoryIssued: true, // Inventory issue done - button enabled
      items: [
        { id: 1, itemCode: "MAT001", itemName: "Steel Sheet", uom: "KG", availableQty: 150, requiredQty: 100 },
        { id: 2, itemCode: "MAT002", itemName: "Aluminum Rod", uom: "KG", availableQty: 30, requiredQty: 50 },
      ]
    },
    {
      id: 2,
      mrNumber: "MR-2024-002",
      date: "2024-01-16",
      requiredByDate: "2024-01-22",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      requestedBy: "Jane Smith",
      totalItems: 2,
      isFinalized: false, // Submitted status
      isInventoryIssued: false, // Inventory issue not done yet - button disabled
      items: [
        { id: 1, itemCode: "MAT003", itemName: "Welding Wire", uom: "KG", availableQty: 50, requiredQty: 10 },
        { id: 2, itemCode: "MAT004", itemName: "Gas Cylinder", uom: "NOS", availableQty: 5, requiredQty: 2 },
      ]
    },
    {
      id: 3,
      mrNumber: "MR-2024-003",
      date: "2024-01-10",
      requiredByDate: "2024-01-15",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      requestedBy: "Mike Johnson",
      totalItems: 3,
      isFinalized: true, // Received status - already completed
      isInventoryIssued: true, // Inventory was issued
      receivedAt: "2024-01-18T10:30:00",
      receivedBy: "Admin User",
      items: [
        { id: 1, itemCode: "MAT005", itemName: "Bolts M10", uom: "NOS", availableQty: 500, requiredQty: 200 },
        { id: 2, itemCode: "MAT006", itemName: "Nuts M10", uom: "NOS", availableQty: 450, requiredQty: 200 },
        { id: 3, itemCode: "MAT007", itemName: "Washers", uom: "NOS", availableQty: 300, requiredQty: 400 },
      ]
    },
  ]);

  // Sample Pre-Procure data
  const [preProcures, setPreProcures] = useState<PreProcure[]>([
    {
      id: 1,
      preProcureNumber: "PP-2024-001",
      date: "2024-01-15",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      requestedBy: "John Doe",
      totalItems: 2,
      isReceived: false, // Submitted status
      procurementRequestId: 101,
      grnStatus: "Completed", // GRN completed - button enabled
      items: [
        { id: 1, itemCode: "MAT001", itemName: "Steel Sheet", uom: "KG", availableQty: 150, plannedQty: 200 },
        { id: 2, itemCode: "MAT002", itemName: "Aluminum Rod", uom: "KG", availableQty: 30, plannedQty: 100 },
      ]
    },
    {
      id: 2,
      preProcureNumber: "PP-2024-002",
      date: "2024-01-16",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      requestedBy: "Jane Smith",
      totalItems: 2,
      isReceived: false, // Submitted status
      procurementRequestId: 102,
      grnStatus: "Pending", // GRN not completed - button disabled
      items: [
        { id: 1, itemCode: "MAT003", itemName: "Welding Wire", uom: "KG", availableQty: 50, plannedQty: 50 },
        { id: 2, itemCode: "MAT004", itemName: "Gas Cylinder", uom: "NOS", availableQty: 5, plannedQty: 10 },
      ]
    },
    {
      id: 3,
      preProcureNumber: "PP-2024-003",
      date: "2024-01-10",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      requestedBy: "Mike Johnson",
      totalItems: 3,
      isReceived: true, // Received status - already completed
      receivedAt: "2024-01-18T10:30:00",
      receivedBy: "Admin User",
      procurementRequestId: 103,
      grnStatus: "Completed",
      items: [
        { id: 1, itemCode: "MAT005", itemName: "Bolts M10", uom: "NOS", availableQty: 500, plannedQty: 500 },
        { id: 2, itemCode: "MAT006", itemName: "Nuts M10", uom: "NOS", availableQty: 450, plannedQty: 500 },
        { id: 3, itemCode: "MAT007", itemName: "Washers", uom: "NOS", availableQty: 300, plannedQty: 1000 },
      ]
    },
  ]);

  // Sample Batch Tracking data
  const [batchTrackings, setBatchTrackings] = useState<BatchTracking[]>([
    {
      id: 1,
      batchNo: "BATCH-2024-001",
      date: "2024-01-15",
      mrNo: "MR-2024-001",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      totalInputItems: 2,
      totalOutputItems: 1,
      status: "Completed",
    },
    {
      id: 2,
      batchNo: "BATCH-2024-002",
      date: "2024-01-16",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      totalInputItems: 2,
      totalOutputItems: 1,
      status: "Completed",
    },
    {
      id: 3,
      batchNo: "BATCH-2024-003",
      date: "2024-01-10",
      mrNo: "MR-2024-003",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      totalInputItems: 3,
      totalOutputItems: 2,
      status: "Completed",
    },
    {
      id: 4,
      batchNo: "BATCH-2026-004",
      date: "2026-02-19",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      totalInputItems: 2,
      totalOutputItems: 0,
      status: "In Process",
    },
    {
      id: 4,
      batchNo: "BATCH-2026-004",
      date: "2026-02-19",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      totalInputItems: 2,
      totalOutputItems: 0,
      status: "In Process",
      startTime: new Date().toISOString(),
    },
  ]);

  // ============================================================================
  // STATE - FORM PAGE (MODAL)
  // ============================================================================
  
  const [formData, setFormData] = useState<Partial<MRRequest>>({
    mrNumber: `MR-${new Date().getFullYear()}-${String(mrRequests.length + 1).padStart(3, '0')}`,
    date: getCurrentDateForInput(),
    requestedBy: "Current User", // Would come from auth context
    requiredByDate: getCurrentDateForInput(),
    operation: "",
    workCenter: "",
    warehouse: "Production Store", // Default warehouse
    items: []
  });
  
  // Pre-Procure form data state
  const [preProcureFormData, setPreProcureFormData] = useState<Partial<PreProcure>>({
    preProcureNumber: `PP-${new Date().getFullYear()}-${String(preProcures.length + 1).padStart(3, '0')}`,
    date: getCurrentDateForInput(),
    requestedBy: "Current User", // Would come from auth context
    operation: "",
    workCenter: "",
    warehouse: "Production Store", // Default warehouse
    items: []
  });

  // Batch Tracking form data state
  const [batchFormData, setBatchFormData] = useState({
    batchNo: `BATCH-${new Date().getFullYear()}-${String(batchTrackings.length + 1).padStart(3, '0')}`,
    date: getCurrentDateForInput(),
    createdBy: "Current User",
    mrNo: "",
    operation: "",
    startTime: null as string | null,
    endTime: null as string | null,
    savedBatchId: null as number | null,
    inputItems: [] as { id: number; item: string; uom: string; qtySupplied: number }[],
    outputItems: [] as { id: number; item: string; uom: string; qtyProduced: number }[]
  });

  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showShortageDialog, setShowShortageDialog] = useState(false);
  const [showPreProcureConfirmDialog, setShowPreProcureConfirmDialog] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBatchSubmitConfirmOpen, setIsBatchSubmitConfirmOpen] = useState(false);

  // ============================================================================
  // EFFECT - Reset form when entering new form view
  // ============================================================================
  
  useEffect(() => {
    if (matchNew) {
      // Reset MR form data when creating new MR
      setFormData({
        mrNumber: `MR-${new Date().getFullYear()}-${String(mrRequests.length + 1).padStart(3, '0')}`,
        date: getCurrentDateForInput(),
        requestedBy: "Current User",
        requiredByDate: getCurrentDateForInput(),
        operation: "",
        workCenter: "",
        warehouse: "Production Store",
        items: []
      });
      setQtyValidationErrors({});
      setIsReadOnly(false);
    } else if (matchPreProcureNew) {
      // Reset Pre-Procure form data when creating new Pre-Procure
      setPreProcureFormData({
        preProcureNumber: `PP-${new Date().getFullYear()}-${String(preProcures.length + 1).padStart(3, '0')}`,
        date: getCurrentDateForInput(),
        requestedBy: "Current User",
        operation: "",
        workCenter: "",
        warehouse: "Production Store",
        items: []
      });
      setPlannedQtyValidationErrors({});
      setIsReadOnly(false);
    } else if (matchBatchNew) {
      // Reset Batch form data when creating new Batch
      setBatchFormData({
        batchNo: `BATCH-${new Date().getFullYear()}-${String(batchTrackings.length + 1).padStart(3, '0')}`,
        date: getCurrentDateForInput(),
        createdBy: "Current User",
        mrNo: "",
        operation: "",
        startTime: null,
        endTime: null,
        savedBatchId: null,
        inputItems: [],
        outputItems: []
      });
      setIsReadOnly(false);
    } else if (matchBatchEdit && batchEditingId) {
      const existingBatch = batchTrackings.find(b => b.id === batchEditingId);
      if (existingBatch) {
        const outputItems = (existingBatch.outputItems && existingBatch.outputItems.length > 0)
          ? existingBatch.outputItems
          : (() => {
              const outputMapping = OPERATION_OUTPUT_MAPPINGS[existingBatch.operation] || [];
              return outputMapping.map((item, index) => ({
                id: index + 1,
                item: item.itemName,
                uom: item.uom,
                qtyProduced: 0
              }));
            })();

        setBatchFormData({
          batchNo: existingBatch.batchNo,
          date: existingBatch.date,
          createdBy: "Current User",
          mrNo: existingBatch.mrNo,
          operation: existingBatch.operation,
          startTime: existingBatch.startTime || null,
          endTime: existingBatch.endTime || null,
          savedBatchId: existingBatch.id,
          inputItems: existingBatch.inputItems || [],
          outputItems
        });
        setIsReadOnly(existingBatch.status === "Completed");
      }
    } else if (matchEdit && editingId) {
      // Load existing MR data when editing
      const existingMR = mrRequests.find(mr => mr.id === editingId);
      if (existingMR) {
        setFormData({
          mrNumber: existingMR.mrNumber,
          date: existingMR.date,
          requestedBy: existingMR.requestedBy,
          requiredByDate: existingMR.requiredByDate,
          operation: existingMR.operation,
          workCenter: existingMR.workCenter,
          warehouse: existingMR.warehouse,
          items: existingMR.items
        });
        setQtyValidationErrors({});
        setIsReadOnly(false);
      }
    }
  }, [matchNew, matchPreProcureNew, matchBatchNew, matchBatchEdit, batchEditingId, matchEdit, editingId, mrRequests.length, preProcures.length, batchTrackings.length]);
  
  // ============================================================================
  // EFFECT - Update URL to mr-request route when on listing view
  // ============================================================================
  
  useEffect(() => {
    // If we're on the listing view (not form view) and on base route, redirect to mr-request
    if (!isFormView && location === "/production/material-operation") {
      setLocation("/production/material-operation/mr-request");
    }
    // Update active tab based on current route
    if (location.includes("/batch-tracking")) {
      setActiveTab("batch-tracking");
    } else if (location.includes("/pre-procure")) {
      setActiveTab("pre-procure");
    } else if (location.includes("/mr-request")) {
      setActiveTab("mr-request");
    }
  }, [isFormView, location, setLocation]);

  // ============================================================================
  // LISTING PAGE - FILTER & PAGINATION
  // ============================================================================
  
  /**
   * Filter MR requests by search term (MR Number and Operation) and status
   * Status filter: "Request to Warehouse" = not received (isFinalized false), "Received by Production" = received (isFinalized true)
   */
  const filteredRequests = mrRequests.filter(item => {
    // Search filter
    const matchesSearch = item.mrNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.operation.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === "Request to Warehouse" 
      ? !item.isFinalized  // Request to Warehouse = not finalized yet
      : item.isFinalized;  // Received by Production = finalized
    
    return matchesSearch && matchesStatus;
  });
  
  /**
   * Filter Pre-Procure requests by search term (Pre-Procure Number and Operation) and status
   * Status filter: "Submitted" = not received (isReceived false), "Received" = received (isReceived true)
   */
  const filteredPreProcures = preProcures.filter(item => {
    // Search filter
    const matchesSearch = item.preProcureNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.operation.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === "Submitted" 
      ? !item.isReceived  // Submitted = not received yet
      : item.isReceived;  // Received = received
    
    return matchesSearch && matchesStatus;
  });

  /**
   * Filter Batch Tracking by search term (Batch No, MR No, and Operation) and status
   */
  const filteredBatchTrackings = batchTrackings.filter(item => {
    const matchesSearch = item.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.mrNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.operation.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = batchStatusFilter === "All" || item.status === batchStatusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Pagination calculations (only for listing view)
  const totalPages = isFormView ? 0 : Math.ceil(
    (activeTab === "mr-request" ? filteredRequests.length : 
     activeTab === "batch-tracking" ? filteredBatchTrackings.length : 
     filteredPreProcures.length) / itemsPerPage
  );
  const paginatedData = isFormView ? [] : (
    activeTab === "mr-request" ? filteredRequests : 
    activeTab === "batch-tracking" ? filteredBatchTrackings :
    filteredPreProcures
  ).slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ============================================================================
  // FORM PAGE - HANDLERS
  // ============================================================================

  /**
   * Handle operation change
   * Auto-loads work center and items from mapping
   */
  const handleOperationChange = (operation: string) => {
    const mapping = OPERATION_MAPPINGS.find(m => m.operation === operation);
    
    if (mapping) {
      // Auto-fill work center from mapping
      const workCenter = mapping.workCenter;
      
      // Auto-load items from mapping with available qty from warehouse
      const items: MRRequestItem[] = mapping.items.map((item, index) => ({
        id: index + 1,
        itemCode: item.itemCode,
        itemName: item.itemName,
        uom: item.uom,
        availableQty: WAREHOUSE_STOCK[formData.warehouse || "Production Store"]?.[item.itemCode] || 0,
        requiredQty: item.standardQty // Auto-filled but editable
      }));

      setFormData({
        ...formData,
        operation,
        workCenter,
        items
      });
      
      // Clear validation errors when operation changes
      setQtyValidationErrors({});
    } else {
      setFormData({
        ...formData,
        operation,
        items: []
      });
      
      // Clear validation errors when operation changes
      setQtyValidationErrors({});
    }
  };

  /**
   * Handle warehouse change
   * Refreshes available qty for all items
   */
  const handleWarehouseChange = (warehouse: string) => {
    const updatedItems = formData.items?.map(item => ({
      ...item,
      availableQty: WAREHOUSE_STOCK[warehouse]?.[item.itemCode] || 0
    })) || [];

    setFormData({
      ...formData,
      warehouse,
      items: updatedItems
    });
  };

  /**
   * Handle required qty change for an item
   */
  const handleRequiredQtyChange = (itemId: number, newQty: number) => {
    // Validate the input
    let error = "";
    
    // Check if value is greater than 0
    if (newQty <= 0) {
      error = "Must be greater than 0";
    }
    // Check if value exceeds 6 digits (999999)
    else if (newQty > 999999) {
      error = "Maximum 6 digits allowed";
    }
    
    // Update validation errors
    setQtyValidationErrors(prev => ({
      ...prev,
      [itemId]: error
    }));
    
    const updatedItems = formData.items?.map(item =>
      item.id === itemId ? { ...item, requiredQty: newQty } : item
    ) || [];

    setFormData({
      ...formData,
      items: updatedItems
    });
  };

  /**
   * Check if there are any shortages
   * Returns true if any item has required qty > available qty
   */
  const hasShortage = (): boolean => {
    return formData.items?.some(item => item.requiredQty > item.availableQty) || false;
  };

  /**
   * Handle form submission
   * Shows shortage dialog if needed, otherwise submits directly
   */
  const handleSubmit = () => {
    // Validation
    if (!formData.requiredByDate) {
      toast({ variant: "destructive", title: "Validation Error", description: "Required By Date is required" });
      return;
    }
    if (!formData.operation) {
      toast({ variant: "destructive", title: "Validation Error", description: "Operation is required" });
      return;
    }
    if (!formData.workCenter) {
      toast({ variant: "destructive", title: "Validation Error", description: "Work Center is required" });
      return;
    }
    if (!formData.warehouse) {
      toast({ variant: "destructive", title: "Validation Error", description: "Warehouse is required" });
      return;
    }
    if (!formData.items || formData.items.length === 0) {
      toast({ variant: "destructive", title: "Validation Error", description: "No items mapped for this operation" });
      return;
    }
    if (formData.items.some(item => item.requiredQty <= 0)) {
      toast({ variant: "destructive", title: "Validation Error", description: "Required Qty must be greater than 0 for all items" });
      return;
    }

    // Check for shortage
    if (hasShortage()) {
      setShowShortageDialog(true);
    } else {
      submitMRRequest();
    }
  };

  /**
   * Submit MR Request
   * Creates the MR and auto-creates procurement request if shortage exists
   * 
   * SAFEGUARD: Uses non-null assertions (!) only after validation in handleSubmit
   * This is safe because handleSubmit validates all required fields first
   */
  const submitMRRequest = () => {
    const newMR: MRRequest = {
      id: mrRequests.length + 1,
      mrNumber: formData.mrNumber!,
      date: formData.date!,
      requiredByDate: formData.requiredByDate!,
      operation: formData.operation!,
      workCenter: formData.workCenter!,
      warehouse: formData.warehouse!,
      requestedBy: formData.requestedBy!,
      totalItems: (formData.items ?? []).length,
      isFinalized: false, // New MR starts as "Submitted" (not received yet)
      isInventoryIssued: false, // New MR - inventory not issued yet
      items: formData.items ?? []
    };

    // If shortage exists, auto-create procurement request
    if (hasShortage()) {
      // SAFEGUARD: Use (items ?? []).filter() to safely filter shortage items
      // Ensure both quantities are numbers before comparison
      const shortageItems = (formData.items ?? []).filter(item => 
        (Number(item.requiredQty) || 0) > (Number(item.availableQty) || 0)
      );
      console.log("Auto-creating Procurement Request for shortage items:", shortageItems);
      // In real implementation, call API to create procurement request
    }

    setMrRequests([...mrRequests, newMR]);
    toast({ title: "Success", description: "MR Request created successfully" });
    setShowShortageDialog(false);
    setLocation("/production/material-operation/mr-request"); // Navigate back to listing
  };

  /**
   * Handle view action
   * Opens modal with MR details
   */
  const handleView = (id: number) => {
    const mr = mrRequests.find(m => m.id === id);
    if (mr) {
      setViewingMR(mr);
      setIsViewModalOpen(true);
    }
  };

  /**
   * Handle close view modal
   */
  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setViewingMR(null);
  };

  /**
   * Handle mark as received
   * Marks the MR as received (only enabled if inventory issue is done)
   */
  const handleMarkAsReceived = () => {
    if (viewingMR && viewingMR.isInventoryIssued) {
      // Update the MR status
      const updatedRequests = mrRequests.map(mr =>
        mr.id === viewingMR.id ? { 
          ...mr, 
          isFinalized: true,
          receivedAt: new Date().toISOString(),
          receivedBy: "Current User"
        } : mr
      );
      setMrRequests(updatedRequests);
      toast({ title: "Success", description: `MR ${viewingMR.mrNumber} marked as received` });
      setIsViewModalOpen(false);
      setViewingMR(null);
    }
  };

  /**
   * Check if inventory issue is done for an MR
   */
  const isInventoryIssueDone = (mr: MRRequest | null): boolean => {
    return mr?.isInventoryIssued || false;
  };
  
  // ============================================================================
  // PRE-PROCURE HANDLERS
  // ============================================================================
  
  /**
   * Handle Pre-Procure operation change
   * Auto-loads work center and items from mapping
   */
  const handlePreProcureOperationChange = (operation: string) => {
    const mapping = OPERATION_MAPPINGS.find(m => m.operation === operation);
    
    if (mapping) {
      // Auto-fill work center from mapping
      const workCenter = mapping.workCenter;
      
      // Auto-load items from mapping with available qty from warehouse
      const items: PreProcureItem[] = mapping.items.map((item, index) => ({
        id: index + 1,
        itemCode: item.itemCode,
        itemName: item.itemName,
        uom: item.uom,
        availableQty: WAREHOUSE_STOCK[preProcureFormData.warehouse || "Production Store"]?.[item.itemCode] || 0,
        plannedQty: item.standardQty // Auto-filled but editable
      }));

      setPreProcureFormData({
        ...preProcureFormData,
        operation,
        workCenter,
        items
      });
      
      // Clear validation errors when operation changes
      setPlannedQtyValidationErrors({});
    } else {
      setPreProcureFormData({
        ...preProcureFormData,
        operation,
        items: []
      });
      
      // Clear validation errors when operation changes
      setPlannedQtyValidationErrors({});
    }
  };

  /**
   * Handle Pre-Procure warehouse change
   * Refreshes available qty for all items
   */
  const handlePreProcureWarehouseChange = (warehouse: string) => {
    const updatedItems = preProcureFormData.items?.map(item => ({
      ...item,
      availableQty: WAREHOUSE_STOCK[warehouse]?.[item.itemCode] || 0
    })) || [];

    setPreProcureFormData({
      ...preProcureFormData,
      warehouse,
      items: updatedItems
    });
  };

  /**
   * Handle planned qty change for a Pre-Procure item
   */
  const handlePlannedQtyChange = (itemId: number, newQty: number) => {
    // Validate the input
    let error = "";
    
    // Check if value is greater than 0
    if (newQty <= 0) {
      error = "Must be greater than 0";
    }
    // Check if value exceeds 6 digits (999999)
    else if (newQty > 999999) {
      error = "Maximum 6 digits allowed";
    }
    
    // Update validation errors
    setPlannedQtyValidationErrors(prev => ({
      ...prev,
      [itemId]: error
    }));
    
    const updatedItems = preProcureFormData.items?.map(item =>
      item.id === itemId ? { ...item, plannedQty: newQty } : item
    ) || [];

    setPreProcureFormData({
      ...preProcureFormData,
      items: updatedItems
    });
  };

  /**
   * Check if there are any quantity validation errors
   */
  const hasQtyValidationErrors = (): boolean => {
    return Object.values(qtyValidationErrors).some(error => error !== "");
  };

  /**
   * Check if there are any planned quantity validation errors
   */
  const hasPlannedQtyValidationErrors = (): boolean => {
    return Object.values(plannedQtyValidationErrors).some(error => error !== "");
  };

  /**
   * Handle Pre-Procure form submission
   * Shows confirmation dialog before submitting
   */
  const handlePreProcureSubmit = () => {
    // Validation
    if (!preProcureFormData.operation) {
      toast({ variant: "destructive", title: "Validation Error", description: "Operation is required" });
      return;
    }
    if (!preProcureFormData.workCenter) {
      toast({ variant: "destructive", title: "Validation Error", description: "Work Center is required" });
      return;
    }
    if (!preProcureFormData.warehouse) {
      toast({ variant: "destructive", title: "Validation Error", description: "Warehouse is required" });
      return;
    }
    if (!preProcureFormData.items || preProcureFormData.items.length === 0) {
      toast({ variant: "destructive", title: "Validation Error", description: "No items mapped for this operation" });
      return;
    }
    if (preProcureFormData.items.some(item => item.plannedQty <= 0)) {
      toast({ variant: "destructive", title: "Validation Error", description: "Planned Qty must be greater than 0 for all items" });
      return;
    }

    // Show confirmation dialog
    setShowPreProcureConfirmDialog(true);
  };

  /**
   * Submit Pre-Procure Request
   * Creates the Pre-Procure and auto-creates procurement request for all items
   */
  const submitPreProcureRequest = () => {
    const newPreProcure: PreProcure = {
      id: preProcures.length + 1,
      preProcureNumber: preProcureFormData.preProcureNumber!,
      date: preProcureFormData.date!,
      operation: preProcureFormData.operation!,
      workCenter: preProcureFormData.workCenter!,
      warehouse: preProcureFormData.warehouse!,
      requestedBy: preProcureFormData.requestedBy!,
      totalItems: (preProcureFormData.items ?? []).length,
      isReceived: false, // New Pre-Procure starts as "Submitted"
      procurementRequestId: 200 + preProcures.length, // Mock PR ID
      grnStatus: "Pending", // Mock GRN status
      items: preProcureFormData.items ?? []
    };

    // Auto-create procurement request for all items
    console.log("Auto-creating Procurement Request for Pre-Procure items:", preProcureFormData.items);
    // In real implementation, call API to create procurement request

    setPreProcures([...preProcures, newPreProcure]);
    toast({ title: "Success", description: "Pre-Procure request created successfully" });
    setShowPreProcureConfirmDialog(false);
    setLocation("/production/material-operation/pre-procure"); // Navigate back to listing
  };

  /**
   * Handle view Pre-Procure action
   * Opens modal with Pre-Procure details
   */
  const handleViewPreProcure = (id: number) => {
    const pp = preProcures.find(p => p.id === id);
    if (pp) {
      setViewingPreProcure(pp);
      setIsViewPreProcureModalOpen(true);
    }
  };

  /**
   * Handle close Pre-Procure view modal
   */
  const handleClosePreProcureViewModal = () => {
    setIsViewPreProcureModalOpen(false);
    setViewingPreProcure(null);
  };

  /**
   * Handle MR No selection in batch form
   * Auto-loads input items from MR and output items from operation mapping
   */
  const handleBatchMRSelection = (mrNo: string) => {
    const selectedMR = mrRequests.find(mr => mr.mrNumber === mrNo);
    
    if (selectedMR) {
      // Load input items from MR
      const inputItems = selectedMR.items.map((item, index) => ({
        id: index + 1,
        item: item.itemName,
        uom: item.uom,
        qtySupplied: 0
      }));

      // Load output items from operation output mapping
      const outputMapping = OPERATION_OUTPUT_MAPPINGS[selectedMR.operation] || [];
      const outputItems = outputMapping.map((item, index) => ({
        id: index + 1,
        item: item.itemName,
        uom: item.uom,
        qtyProduced: 0
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

  /**
   * Handle batch save (sets start time and creates/updates batch record)
   */
  const handleBatchSave = () => {
    // Validation: MR No required
    if (!batchFormData.mrNo) {
      toast({ variant: "destructive", title: "Validation Error", description: "MR No is required" });
      return;
    }

    // Validation: At least one input qty > 0
    const hasInputQty = batchFormData.inputItems.some(item => item.qtySupplied > 0);
    if (!hasInputQty) {
      toast({ variant: "destructive", title: "Validation Error", description: "At least one input quantity must be greater than 0" });
      return;
    }

    const startTime = batchFormData.startTime || new Date().toISOString();

    // Save input data, set startTime (if empty), and mark as "In Process"
    if (batchFormData.savedBatchId) {
      const updatedBatchTrackings = batchTrackings.map(batch => {
        if (batch.id === batchFormData.savedBatchId) {
          return {
            ...batch,
            status: "In Process" as const,
            startTime,
            mrNo: batchFormData.mrNo,
            operation: batchFormData.operation,
            workCenter: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.workCenter || "",
            warehouse: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.warehouse || "",
            totalInputItems: batchFormData.inputItems.length,
            inputItems: batchFormData.inputItems,
            outputItems: batch.outputItems || batchFormData.outputItems || [],
            totalOutputItems: batch.totalOutputItems ?? 0
          };
        }
        return batch;
      });
      setBatchTrackings(updatedBatchTrackings);
      setBatchFormData({ ...batchFormData, startTime });
    } else {
      const newBatch: BatchTracking = {
        id: batchTrackings.length + 1,
        batchNo: batchFormData.batchNo,
        date: batchFormData.date,
        mrNo: batchFormData.mrNo,
        operation: batchFormData.operation,
        workCenter: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.workCenter || "",
        warehouse: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.warehouse || "",
        totalInputItems: batchFormData.inputItems.length,
        totalOutputItems: 0,
        status: "In Process",
        startTime,
        inputItems: batchFormData.inputItems,
        outputItems: batchFormData.outputItems || []
      };
      setBatchTrackings([...batchTrackings, newBatch]);
      setBatchFormData({ ...batchFormData, startTime, savedBatchId: newBatch.id });
    }

    toast({ title: "Saved", description: "Batch saved successfully." });

    // Redirect to listing page; do not open view modal
    setLocation("/production/material-operation/batch-tracking");
  };

  /**
   * Handle batch complete (sets end time and updates/creates batch)
   */
  const handleBatchComplete = () => {
    // Validation: MR No required
    if (!batchFormData.mrNo) {
      toast({ variant: "destructive", title: "Validation Error", description: "MR No is required" });
      return;
    }

    // Validation: At least one output qty > 0
    const hasOutputQty = batchFormData.outputItems.some(item => item.qtyProduced > 0);
    if (!hasOutputQty) {
      toast({ variant: "destructive", title: "Validation Error", description: "At least one output quantity must be greater than 0" });
      return;
    }

    const endTime = new Date().toISOString();
    
    // Check if batch was already saved (has savedBatchId)
    if (batchFormData.savedBatchId) {
      // Update existing batch
      let completedBatch: BatchTracking | null = null;
      const updatedBatchTrackings = batchTrackings.map(batch => {
        if (batch.id === batchFormData.savedBatchId) {
          const updated: BatchTracking = {
            ...batch,
            status: "Completed" as const,
            endTime: endTime,
            totalOutputItems: batchFormData.outputItems.length,
            outputItems: batchFormData.outputItems
          };
          completedBatch = updated;
          return updated;
        }
        return batch;
      });
      
      setBatchTrackings(updatedBatchTrackings);
      toast({ title: "Success", description: `Batch ${batchFormData.batchNo} completed successfully` });

      if (completedBatch) {
        setBatchFormData({ ...batchFormData, endTime });
        setIsReadOnly(true);
      }
      
      // After submit, redirect to listing page
      setLocation("/production/material-operation/batch-tracking");
    } else {
      // Create new batch tracking record (if Save wasn't clicked first)
      const newBatch: BatchTracking = {
        id: batchTrackings.length + 1,
        batchNo: batchFormData.batchNo,
        date: batchFormData.date,
        mrNo: batchFormData.mrNo,
        operation: batchFormData.operation,
        workCenter: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.workCenter || "",
        warehouse: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.warehouse || "",
        totalInputItems: batchFormData.inputItems.length,
        totalOutputItems: batchFormData.outputItems.length,
        status: "Completed",
        startTime: batchFormData.startTime || new Date().toISOString(),
        endTime: endTime,
        inputItems: batchFormData.inputItems,
        outputItems: batchFormData.outputItems
      };

      setBatchTrackings([...batchTrackings, newBatch]);
      toast({ title: "Success", description: `Batch ${batchFormData.batchNo} completed successfully` });

      setBatchFormData({ ...batchFormData, startTime: newBatch.startTime || null, endTime, savedBatchId: newBatch.id });
      setIsReadOnly(true);
      
      // After submit, redirect to listing page
      setLocation("/production/material-operation/batch-tracking");
    }
  };

  /**
   * Check if Save button should be enabled
   */
  const isSaveEnabled = () => {
    return batchFormData.inputItems.some(item => item.qtySupplied > 0);
  };

  /**
   * Check if Complete button should be shown
   */
  const isCompleteVisible = () => {
    return batchFormData.outputItems.some(item => item.qtyProduced > 0);
  };

  /**
   * Handle view Batch Tracking action
   * Opens modal with Batch details
   */
  const handleViewBatch = (batch: BatchTracking) => {
    if (batch.status === "In Process") {
      setLocation(`/production/material-operation/batch-tracking/${batch.id}/edit`);
      return;
    }

    // Completed => open read-only modal
    setViewingBatch(batch);
    setIsViewBatchModalOpen(true);
  };

  /**
   * Handle close Batch view modal
   */
  const handleCloseBatchViewModal = () => {
    setIsViewBatchModalOpen(false);
    setViewingBatch(null);
  };

  /**
   * Handle create batch button click
   */
  const handleCreateBatch = () => {
    setLocation("/production/material-operation/batch-tracking/new");
  };

  /**
   * Handle mark Pre-Procure as received
   * Marks the Pre-Procure as received (only enabled if GRN is completed)
   */
  const handleMarkPreProcureAsReceived = () => {
    if (viewingPreProcure && isGRNCompleted(viewingPreProcure)) {
      // Update the Pre-Procure status
      const updatedPreProcures = preProcures.map(pp =>
        pp.id === viewingPreProcure.id ? { 
          ...pp, 
          isReceived: true,
          receivedAt: new Date().toISOString(),
          receivedBy: "Current User"
        } : pp
      );
      setPreProcures(updatedPreProcures);
      toast({ title: "Success", description: `Pre-Procure ${viewingPreProcure.preProcureNumber} marked as received` });
      setIsViewPreProcureModalOpen(false);
      setViewingPreProcure(null);
    }
  };

  /**
   * Check if GRN is completed for a Pre-Procure
   */
  const isGRNCompleted = (pp: PreProcure | null): boolean => {
    return pp?.grnStatus === "Completed";
  };

  /**
   * Handle back to listing
   */
  const handleBack = () => {
    if (isBatchForm) {
      setLocation("/production/material-operation/batch-tracking");
      setBatchFormData({
        batchNo: `BATCH-${new Date().getFullYear()}-${String(batchTrackings.length + 1).padStart(3, '0')}`,
        date: getCurrentDateForInput(),
        createdBy: "Current User",
        mrNo: "",
        operation: "",
        startTime: null,
        endTime: null,
        savedBatchId: null,
        inputItems: [],
        outputItems: []
      });
    } else if (isPreProcureForm) {
      setLocation("/production/material-operation/pre-procure");
      setPreProcureFormData({
        preProcureNumber: `PP-${new Date().getFullYear()}-${String(preProcures.length + 1).padStart(3, '0')}`,
        date: getCurrentDateForInput(),
        requestedBy: "Current User",
        operation: "",
        workCenter: "",
        warehouse: "Production Store",
        items: []
      });
    } else {
      setLocation("/production/material-operation/mr-request");
      setFormData({
        mrNumber: `MR-${new Date().getFullYear()}-${String(mrRequests.length + 1).padStart(3, '0')}`,
        date: getCurrentDateForInput(),
        requestedBy: "Current User",
        requiredByDate: getCurrentDateForInput(),
        operation: "",
        workCenter: "",
        warehouse: "Production Store",
        items: []
      });
    }
    setIsReadOnly(false);
  };

  /**
   * Handle delete MR Request
   * Removes the MR request from the list
   */
  const handleDelete = () => {
    if (editingId) {
      const updatedRequests = mrRequests.filter(mr => mr.id !== editingId);
      setMrRequests(updatedRequests);
      toast({ title: "Success", description: "MR Request deleted successfully" });
      setIsDeleteOpen(false);
      setLocation("/production/material-operation/mr-request");
    }
  };

  // ============================================================================
  // RENDER - FORM VIEW
  // ============================================================================

  if (isFormView) {
    // ============================================================================
    // BATCH TRACKING FORM VIEW
    // ============================================================================
    if (isBatchForm) {
      return (
        <div className="flex flex-col gap-6 h-full">
          {/* Form Header with Back Arrow */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Create Batch</h1>
          </div>

          {/* Header Section */}
          <Card>
            <CardHeader>
              <CardTitle>Batch Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Batch No - Auto-generated, read-only */}
                <div>
                  <Label>Batch No</Label>
                  <Input value={batchFormData.batchNo} readOnly className="bg-muted" />
                </div>

                {/* Date - Auto today, read-only */}
                <div>
                  <Label>Date</Label>
                  <Input value={formatDate(batchFormData.date)} readOnly className="bg-muted" />
                </div>

                {/* Created By - From logged-in user, read-only */}
                <div>
                  <Label>Created By</Label>
                  <Input value={batchFormData.createdBy} readOnly className="bg-muted" />
                </div>

                {/* MR No - Dropdown */}
                <div>
                  <Label>MR No <span className="text-red-500">*</span></Label>
                  <Select value={batchFormData.mrNo} onValueChange={handleBatchMRSelection} disabled={isReadOnly}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select MR No" />
                    </SelectTrigger>
                    <SelectContent>
                      {mrRequests.map((mr) => (
                        <SelectItem key={mr.id} value={mr.mrNumber}>
                          {mr.mrNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Start and End Time Display */}
              {(batchFormData.startTime || batchFormData.endTime) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {batchFormData.startTime && (
                    <div>
                      <Label>Start Time</Label>
                      <Input value={new Date(batchFormData.startTime).toLocaleString()} readOnly className="bg-muted" />
                    </div>
                  )}
                  {batchFormData.endTime && (
                    <div>
                      <Label>End Time</Label>
                      <Input value={new Date(batchFormData.endTime).toLocaleString()} readOnly className="bg-muted" />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Split Panel - Input and Output */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
            {/* LEFT PANEL - Input */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Input</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead className="text-right">Qty Supplied</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchFormData.inputItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            {batchFormData.mrNo ? "No input items" : "Select an MR No to load input items"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        batchFormData.inputItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.item}</TableCell>
                            <TableCell>{item.uom}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={item.qtySupplied}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Validate: max 6 digits, >= 0
                                  if (value === '' || (/^\d+$/.test(value) && value.length <= 6)) {
                                    const numValue = parseFloat(value) || 0;
                                    if (numValue >= 0 && numValue <= 999999) {
                                      const updatedItems = batchFormData.inputItems.map(i =>
                                        i.id === item.id ? { ...i, qtySupplied: numValue } : i
                                      );
                                      setBatchFormData({ ...batchFormData, inputItems: updatedItems });
                                    }
                                  }
                                }}
                                onKeyPress={(e) => {
                                  // Prevent non-numeric characters
                                  if (!/[0-9]/.test(e.key)) {
                                    e.preventDefault();
                                  }
                                }}
                                className="w-24 text-right"
                                min={0}
                                max={999999}
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

            {/* RIGHT PANEL - Output */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Output</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
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
                                type="number"
                                value={item.qtyProduced}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Validate: max 6 digits, >= 0
                                  if (value === '' || (/^\d+$/.test(value) && value.length <= 6)) {
                                    const numValue = parseFloat(value) || 0;
                                    if (numValue >= 0 && numValue <= 999999) {
                                      const updatedItems = batchFormData.outputItems.map(i =>
                                        i.id === item.id ? { ...i, qtyProduced: numValue } : i
                                      );
                                      setBatchFormData({ ...batchFormData, outputItems: updatedItems });
                                    }
                                  }
                                }}
                                onKeyPress={(e) => {
                                  // Prevent non-numeric characters
                                  if (!/[0-9]/.test(e.key)) {
                                    e.preventDefault();
                                  }
                                }}
                                className="w-24 text-right"
                                min={0}
                                max={999999}
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

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleBack}>
              Cancel
            </Button>
            <Button 
              variant="outline" 
              onClick={handleBatchSave}
              disabled={!isSaveEnabled() || isReadOnly}
            >
              Save
            </Button>
            <Button onClick={() => setIsBatchSubmitConfirmOpen(true)} disabled={isReadOnly}>
              Submit
            </Button>
          </div>
          
          {/* Submit Confirmation Dialog */}
          <AlertDialog open={isBatchSubmitConfirmOpen} onOpenChange={setIsBatchSubmitConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Submit Batch</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to submit this batch? Once submitted, the batch will be marked as completed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setIsBatchSubmitConfirmOpen(false);
                    handleBatchComplete();
                  }}
                >
                  Submit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    }

    // ============================================================================
    // PRE-PROCURE FORM VIEW
    // ============================================================================
    if (isPreProcureForm) {
      return (
        <div className="flex flex-col gap-6 h-full">
          {/* Form Header with Back Arrow */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Create Pre-Procure</h1>
          </div>

          {/* Header Section - Auto-generated fields */}
          <Card>
            <CardHeader>
              <CardTitle>Pre-Procure Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Pre-Procure Number - Auto-generated, read-only */}
                <div>
                  <Label>Pre-Procure Number</Label>
                  <Input value={preProcureFormData.preProcureNumber} readOnly className="bg-muted" />
                </div>

                {/* Date - Auto today, read-only */}
                <div>
                  <Label>Date</Label>
                  <Input value={formatDate(preProcureFormData.date || '')} readOnly className="bg-muted" />
                </div>

                {/* Requested By - From logged-in user, read-only */}
                <div>
                  <Label>Requested By</Label>
                  <Input value={preProcureFormData.requestedBy} readOnly className="bg-muted" />
                </div>

                {/* Department - Fixed "Production", read-only */}
                <div>
                  <Label>Department</Label>
                  <Input value="Production" readOnly className="bg-muted" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selection Section - Operation, Work Center, Warehouse */}
          <Card>
            <CardHeader>
              <CardTitle>Selection Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Operation - Required, triggers item loading */}
                <SearchableSelect
                  label="Operation"
                  value={preProcureFormData.operation}
                  options={OPERATIONS}
                  onChange={handlePreProcureOperationChange}
                  required
                />

                {/* Work Center - Auto-filled from mapping, editable */}
                <SearchableSelect
                  label="Work Center"
                  value={preProcureFormData.workCenter}
                  options={WORK_CENTERS}
                  onChange={(value) => setPreProcureFormData({ ...preProcureFormData, workCenter: value })}
                  required
                />

                {/* Warehouse - Default to Production Store, editable */}
                <SearchableSelect
                  label="Warehouse"
                  value={preProcureFormData.warehouse}
                  options={WAREHOUSES}
                  onChange={handlePreProcureWarehouseChange}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Items Table - Auto-loaded from mapping */}
          <Card>
            <CardHeader>
              <CardTitle>Items (Auto-loaded from Operation Mapping)</CardTitle>
            </CardHeader>
            <CardContent>
              {!preProcureFormData.items || preProcureFormData.items.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  {preProcureFormData.operation ? (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-5 w-5" />
                      <span>No items mapped for this operation</span>
                    </div>
                  ) : (
                    <span>Select an operation to load items</span>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item Code</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead className="text-right">Planned Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preProcureFormData.items.map((item) => {
                        const validationError = plannedQtyValidationErrors[item.id];
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.itemCode}</TableCell>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell>{item.uom}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-1">
                                <Input
                                  type="number"
                                  value={item.plannedQty}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    // Only allow numeric input and prevent more than 6 digits
                                    if (value === '' || (/^\d+$/.test(value) && value.length <= 6)) {
                                      handlePlannedQtyChange(item.id, parseFloat(value) || 0);
                                    }
                                  }}
                                  onKeyPress={(e) => {
                                    // Prevent non-numeric characters
                                    if (!/[0-9]/.test(e.key)) {
                                      e.preventDefault();
                                    }
                                  }}
                                  min={0}
                                  max={999999}
                                  className={`w-20 text-right ${validationError ? "border-red-500" : ""}`}
                                />
                                {validationError && (
                                  <span className="text-xs text-red-500">{validationError}</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleBack}>
              Cancel
            </Button>
            <Button onClick={handlePreProcureSubmit} disabled={hasPlannedQtyValidationErrors()}>
              Submit
            </Button>
          </div>

          {/* Pre-Procure Confirmation Dialog */}
          <Dialog open={showPreProcureConfirmDialog} onOpenChange={setShowPreProcureConfirmDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Procurement Request</DialogTitle>
                <DialogDescription>
                  Create Procurement Request for future stock? Continue?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreProcureConfirmDialog(false)}>
                  No
                </Button>
                <Button onClick={submitPreProcureRequest}>
                  Yes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    // ============================================================================
    // MR REQUEST FORM VIEW
    // ============================================================================
    return (
      <div className="flex flex-col gap-6 h-full">
        {/* Form Header with Back Arrow */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {isReadOnly ? "View MR Request" : editingId ? "Edit MR Request" : "Create MR Request"}
          </h1>
        </div>

        {/* Header Section - Auto-generated fields */}
        <Card>
          <CardHeader>
            <CardTitle>Request Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* MR Number - Auto-generated, read-only */}
              <div>
                <Label>MR Number</Label>
                <Input value={formData.mrNumber} readOnly className="bg-muted" />
              </div>

              {/* Date - Auto today, read-only */}
              <div>
                <Label>Date</Label>
                <Input value={formatDate(formData.date || '')} readOnly className="bg-muted" />
              </div>

              {/* Requested By - From logged-in user, read-only */}
              <div>
                <Label>Requested By</Label>
                <Input value={formData.requestedBy} readOnly className="bg-muted" />
              </div>

              {/* Department - Fixed "Production", read-only */}
              <div>
                <Label>Department</Label>
                <Input value="Production" readOnly className="bg-muted" />
              </div>

              {/* Required By Date - Editable, required */}
              <div>
                <Label>Required By Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={formData.requiredByDate}
                  onChange={(e) => setFormData({ ...formData, requiredByDate: e.target.value })}
                  disabled={isReadOnly}
                  min={formData.date}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selection Section - Operation, Work Center, Warehouse */}
        <Card>
          <CardHeader>
            <CardTitle>Selection Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Operation - Required, triggers item loading */}
              <SearchableSelect
                label="Operation"
                value={formData.operation}
                options={OPERATIONS}
                onChange={handleOperationChange}
                required
                disabled={isReadOnly}
              />

              {/* Work Center - Auto-filled from mapping, editable */}
              <SearchableSelect
                label="Work Center"
                value={formData.workCenter}
                options={WORK_CENTERS}
                onChange={(value) => setFormData({ ...formData, workCenter: value })}
                required
                disabled={isReadOnly}
              />

              {/* Warehouse - Default to Production Store, editable */}
              <SearchableSelect
                label="Warehouse"
                value={formData.warehouse}
                options={WAREHOUSES}
                onChange={handleWarehouseChange}
                required
                disabled={isReadOnly}
              />
            </div>
          </CardContent>
        </Card>

        {/* Items Table - Auto-loaded from mapping */}
        <Card>
          <CardHeader>
            <CardTitle>Items (Auto-loaded from Operation Mapping)</CardTitle>
          </CardHeader>
          <CardContent>
            {!formData.items || formData.items.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {formData.operation ? (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                    <span>No items mapped for this operation</span>
                  </div>
                ) : (
                  <span>Select an operation to load items</span>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead className="text-right">Available Qty</TableHead>
                      <TableHead className="text-right">Required Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item) => {
                      const hasShortage = item.requiredQty > item.availableQty;
                      const validationError = qtyValidationErrors[item.id];
                      return (
                        <TableRow key={item.id} className={hasShortage ? "bg-red-50" : ""}>
                          <TableCell className="font-mono">{item.itemCode}</TableCell>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{item.uom}</TableCell>
                          <TableCell className="text-right">{item.availableQty}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <Input
                                type="number"
                                value={item.requiredQty}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Only allow numeric input and prevent more than 6 digits
                                  if (value === '' || (/^\d+$/.test(value) && value.length <= 6)) {
                                    handleRequiredQtyChange(item.id, parseFloat(value) || 0);
                                  }
                                }}
                                onKeyPress={(e) => {
                                  // Prevent non-numeric characters
                                  if (!/[0-9]/.test(e.key)) {
                                    e.preventDefault();
                                  }
                                }}
                                disabled={isReadOnly}
                                min={0}
                                max={999999}
                                className={`w-20 text-right ${hasShortage || validationError ? "border-red-500" : ""}`}
                              />
                              {validationError && (
                                <span className="text-xs text-red-500">{validationError}</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          {/* Delete Button - Only shown in edit mode (positioned on left) */}
          {!isReadOnly && editingId && (
            <div className="mr-auto">
              <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the MR Request "{formData.mrNumber}".
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
          {/* Cancel button - shown in all modes (view, edit, create) */}
          <Button variant="outline" onClick={handleBack}>
            Cancel
          </Button>
          {/* Submit button - only shown in edit and create modes */}
          {!isReadOnly && (
            <Button onClick={handleSubmit} disabled={hasQtyValidationErrors()}>
              Submit
            </Button>
          )}
        </div>

        {/* Shortage Confirmation Dialog */}
        <Dialog open={showShortageDialog} onOpenChange={setShowShortageDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Stock Shortage Detected</DialogTitle>
              <DialogDescription>
                Required quantity is not available in stock. Remaining quantity will be sent to Procurement. Continue?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowShortageDialog(false)}>
                No
              </Button>
              <Button onClick={submitMRRequest}>
                Yes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ============================================================================
  // RENDER - LISTING VIEW
  // ============================================================================

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Page Header with Title */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Material & Operation</h1>
        <p className="text-muted-foreground">
          Manage material requests for production operations.
        </p>
      </div>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        setSearchTerm("");
        setCurrentPage(1);
        setStatusFilter("Request to Warehouse");
        setBatchStatusFilter("In Process");
        if (value === "mr-request") {
          setLocation("/production/material-operation/mr-request");
        } else if (value === "batch-tracking") {
          setLocation("/production/material-operation/batch-tracking");
        } else if (value === "pre-procure") {
          setLocation("/production/material-operation/pre-procure");
        }
      }} className="w-full flex-1 flex flex-col">
        <div className="border-b border-border">
          <TabsList className="h-auto w-full justify-start gap-0 bg-transparent p-0">
            <TabsTrigger
              value="mr-request"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            >
              MR Request
            </TabsTrigger>
            <TabsTrigger
              value="batch-tracking"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            >
              Batch Tracking
            </TabsTrigger>
            <TabsTrigger
              value="pre-procure"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2 text-sm font-medium border-b-2 border-transparent transition-colors rounded-none text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            >
              Pre-Procure
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="mr-request" className="m-0 h-full flex flex-col gap-6 mt-6">
          {/* Search Section with Status Filter and MR Request Button */}
          <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
            <div className="w-full sm:flex-1">
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by MR Number or Operation..."
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
              <SearchableSelect
                label="Status"
                value={statusFilter}
                options={["Request to Warehouse", "Received by Production"]}
                onChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1); // Reset to page 1 when filter changes
                }}
              />
            </div>
            <div className="w-full sm:w-auto">
              <Button onClick={() => setLocation("/production/material-operation/new")} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                MR Request
              </Button>
            </div>
          </div>

          {/* MR Requests Table */}
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>MR Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Work Center</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No MR Requests found
                        </TableCell>
                      </TableRow>
                    ) : (
                      (paginatedData as MRRequest[]).map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium font-mono">{request.mrNumber}</TableCell>
                          <TableCell>{formatDate(request.date)}</TableCell>
                          <TableCell>{request.operation}</TableCell>
                          <TableCell>{request.workCenter}</TableCell>
                          <TableCell>{request.warehouse}</TableCell>
                          <TableCell className="text-right">
                            {/* View - Always shown */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() => handleView(request.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {filteredRequests.length > 0 && (
                <div className="flex justify-between items-center px-1 mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredRequests.length)} of {filteredRequests.length} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages || totalPages === 0}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batch Tracking Tab Content */}
        <TabsContent value="batch-tracking" className="m-0 h-full flex flex-col gap-6 mt-6">
          {/* Search Section with Create Batch Button */}
          <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
            <div className="w-full sm:flex-1">
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Batch No / MR No / Operation..."
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
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
              <Select value={batchStatusFilter} onValueChange={(value) => {
                setBatchStatusFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="In Process" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="In Process">In Process</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full sm:w-auto h-10" onClick={handleCreateBatch}>
              <Plus className="mr-2 h-4 w-4" />
              Create Batch
            </Button>
          </div>

          {/* Batch Tracking Table */}
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Batch No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>MR No</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Work Center</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No batch tracking records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      (paginatedData as BatchTracking[]).map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-mono font-medium">{batch.batchNo}</TableCell>
                          <TableCell>{formatDate(batch.date)}</TableCell>
                          <TableCell className="font-mono">{batch.mrNo}</TableCell>
                          <TableCell>{batch.operation}</TableCell>
                          <TableCell>{batch.workCenter}</TableCell>
                          <TableCell>{batch.warehouse}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewBatch(batch)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {filteredBatchTrackings.length > 0 && (
                <div className="flex justify-between items-center px-1 mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredBatchTrackings.length)} of {filteredBatchTrackings.length} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages || totalPages === 0}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pre-Procure Tab Content */}
        <TabsContent value="pre-procure" className="m-0 h-full flex flex-col gap-6 mt-6">
          {/* Search Section with Pre-Procure Button */}
          <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
            <div className="w-full sm:flex-1">
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Pre-Procure Number or Operation..."
                  className="pl-9 h-10"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <Button onClick={() => setLocation("/production/material-operation/pre-procure/new")} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Pre-Procure
              </Button>
            </div>
          </div>

          {/* Pre-Procure Table */}
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Pre-Procure Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Work Center</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No Pre-Procure Requests found
                        </TableCell>
                      </TableRow>
                    ) : (
                      (paginatedData as PreProcure[]).map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium font-mono">{request.preProcureNumber}</TableCell>
                          <TableCell>{formatDate(request.date)}</TableCell>
                          <TableCell>{request.operation}</TableCell>
                          <TableCell>{request.workCenter}</TableCell>
                          <TableCell>{request.warehouse}</TableCell>
                          <TableCell className="text-right">
                            {/* View - Always shown */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() => handleViewPreProcure(request.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {filteredPreProcures.length > 0 && (
                <div className="flex justify-between items-center px-1 mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPreProcures.length)} of {filteredPreProcures.length} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages || totalPages === 0}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View MR Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View MR Request</DialogTitle>
          </DialogHeader>

          {viewingMR && (
            <div className="space-y-6">
              {/* Header Section - Read-only fields */}
              <Card>
                <CardHeader>
                  <CardTitle>Request Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* MR Number */}
                    <div>
                      <Label>MR Number</Label>
                      <Input value={viewingMR.mrNumber} readOnly className="bg-muted" />
                    </div>

                    {/* Date */}
                    <div>
                      <Label>Date</Label>
                      <Input value={formatDate(viewingMR.date)} readOnly className="bg-muted" />
                    </div>

                    {/* Requested By */}
                    <div>
                      <Label>Requested By</Label>
                      <Input value={viewingMR.requestedBy} readOnly className="bg-muted" />
                    </div>

                    {/* Department */}
                    <div>
                      <Label>Department</Label>
                      <Input value="Production" readOnly className="bg-muted" />
                    </div>

                    {/* Required By Date */}
                    <div>
                      <Label>Required By Date</Label>
                      <Input value={formatDate(viewingMR.requiredByDate)} readOnly className="bg-muted" />
                    </div>

                    {/* Received Date - Only show if received */}
                    {viewingMR.isFinalized && viewingMR.receivedAt && (
                      <div>
                        <Label>Received Date</Label>
                        <Input value={formatDate(viewingMR.receivedAt)} readOnly className="bg-muted" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Selection Section - Read-only */}
              <Card>
                <CardHeader>
                  <CardTitle>Selection Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Operation */}
                    <div>
                      <Label>Operation</Label>
                      <Input value={viewingMR.operation} readOnly className="bg-muted" />
                    </div>

                    {/* Work Center */}
                    <div>
                      <Label>Work Center</Label>
                      <Input value={viewingMR.workCenter} readOnly className="bg-muted" />
                    </div>

                    {/* Warehouse */}
                    <div>
                      <Label>Warehouse</Label>
                      <Input value={viewingMR.warehouse} readOnly className="bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items Table - Read-only */}
              <Card>
                <CardHeader>
                  <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent>
                  {viewingMR.items && viewingMR.items.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Item Code</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>UOM</TableHead>
                            <TableHead className="text-right">Available Qty</TableHead>
                            <TableHead className="text-right">Required Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewingMR.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono">{item.itemCode}</TableCell>
                              <TableCell>{item.itemName}</TableCell>
                              <TableCell>{item.uom}</TableCell>
                              <TableCell className="text-right">{item.availableQty}</TableCell>
                              <TableCell className="text-right">{item.requiredQty}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      No items found
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseViewModal}>
              Close
            </Button>
            {/* Only show Mark as Received button if inventory is issued and not yet received */}
            {isInventoryIssueDone(viewingMR) && !viewingMR?.isFinalized && (
              <Button 
                onClick={handleMarkAsReceived}
                variant="default"
              >
                Mark as Received
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Pre-Procure Modal */}
      <Dialog open={isViewPreProcureModalOpen} onOpenChange={setIsViewPreProcureModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Pre-Procure</DialogTitle>
          </DialogHeader>

          {viewingPreProcure && (
            <div className="space-y-6">
              {/* Header Section - Read-only fields */}
              <Card>
                <CardHeader>
                  <CardTitle>Pre-Procure Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Pre-Procure Number */}
                    <div>
                      <Label>Pre-Procure Number</Label>
                      <Input value={viewingPreProcure.preProcureNumber} readOnly className="bg-muted" />
                    </div>

                    {/* Date */}
                    <div>
                      <Label>Date</Label>
                      <Input value={formatDate(viewingPreProcure.date)} readOnly className="bg-muted" />
                    </div>

                    {/* Requested By */}
                    <div>
                      <Label>Requested By</Label>
                      <Input value={viewingPreProcure.requestedBy} readOnly className="bg-muted" />
                    </div>

                    {/* Department */}
                    <div>
                      <Label>Department</Label>
                      <Input value="Production" readOnly className="bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Selection Section - Read-only */}
              <Card>
                <CardHeader>
                  <CardTitle>Selection Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Operation */}
                    <div>
                      <Label>Operation</Label>
                      <Input value={viewingPreProcure.operation} readOnly className="bg-muted" />
                    </div>

                    {/* Work Center */}
                    <div>
                      <Label>Work Center</Label>
                      <Input value={viewingPreProcure.workCenter} readOnly className="bg-muted" />
                    </div>

                    {/* Warehouse */}
                    <div>
                      <Label>Warehouse</Label>
                      <Input value={viewingPreProcure.warehouse} readOnly className="bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items Table - Read-only */}
              <Card>
                <CardHeader>
                  <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent>
                  {viewingPreProcure.items && viewingPreProcure.items.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Item Code</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>UOM</TableHead>
                            <TableHead className="text-right">Planned Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewingPreProcure.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono">{item.itemCode}</TableCell>
                              <TableCell>{item.itemName}</TableCell>
                              <TableCell>{item.uom}</TableCell>
                              <TableCell className="text-right">{item.plannedQty}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      No items found
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClosePreProcureViewModal}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Batch Tracking Modal */}
      <Dialog open={isViewBatchModalOpen} onOpenChange={setIsViewBatchModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Batch Tracking</DialogTitle>
          </DialogHeader>

          {viewingBatch && (
            <div className="space-y-6">
              {/* Header Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Batch Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Batch No</Label>
                      <Input value={viewingBatch.batchNo} readOnly className="bg-muted" />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input value={formatDate(viewingBatch.date)} readOnly className="bg-muted" />
                    </div>
                    <div>
                      <Label>MR No</Label>
                      <Input value={viewingBatch.mrNo} readOnly className="bg-muted" />
                    </div>
                    <div>
                      <Label>Operation</Label>
                      <Input value={viewingBatch.operation} readOnly className="bg-muted" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label>Work Center</Label>
                      <Input value={viewingBatch.workCenter} readOnly className="bg-muted" />
                    </div>
                    <div>
                      <Label>Warehouse</Label>
                      <Input value={viewingBatch.warehouse} readOnly className="bg-muted" />
                    </div>
                  </div>
                  {(viewingBatch.startTime || viewingBatch.endTime) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {viewingBatch.startTime && (
                        <div>
                          <Label>Start Time</Label>
                          <Input value={new Date(viewingBatch.startTime).toLocaleString()} readOnly className="bg-muted" />
                        </div>
                      )}
                      {viewingBatch.endTime && (
                        <div>
                          <Label>End Time</Label>
                          <Input value={new Date(viewingBatch.endTime).toLocaleString()} readOnly className="bg-muted" />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Input Items */}
              <Card>
                <CardHeader>
                  <CardTitle>Input Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Item</TableHead>
                          <TableHead>UOM</TableHead>
                          <TableHead className="text-right">Qty Supplied</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!viewingBatch.inputItems || viewingBatch.inputItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                              No input items data available
                            </TableCell>
                          </TableRow>
                        ) : (
                          viewingBatch.inputItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.item}</TableCell>
                              <TableCell>{item.uom}</TableCell>
                              <TableCell className="text-right">{item.qtySupplied}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Output Items */}
              <Card>
                <CardHeader>
                  <CardTitle>Output Items</CardTitle>
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
                        {!viewingBatch.outputItems || viewingBatch.outputItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                              No output items data available
                            </TableCell>
                          </TableRow>
                        ) : (
                          viewingBatch.outputItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.item}</TableCell>
                              <TableCell>{item.uom}</TableCell>
                              <TableCell className="text-right">{item.qtyProduced}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewBatchModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
