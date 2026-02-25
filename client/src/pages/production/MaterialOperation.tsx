// ============================================================================
// MATERIAL & OPERATION MODULE
// ============================================================================
// This module manages material requests and production operations with three main tabs:
//
// 1. MR REQUEST TAB:
//    - Create material requests for production operations
//    - Track status: Request to Warehouse → Issued by Warehouse → Received by Production
//    - Warehouse issues materials, production receives them
//    - Supports shortage scenarios and pre-procurement
//
// 2. PRE-PROCURE TAB:
//    - Handle material shortages by creating procurement requests
//    - Links to GRN (Goods Receipt Note) verification
//    - Mark as received when GRN is verified
//
// 3. BATCH TRACKING TAB:
//    - Create production batches (single or bulk)
//    - Track batch lifecycle: Batch Created → Sent for QC → Verified QC → Batch Closed
//    - Support for QC verification when required by operation
//    - Bulk batch creation for dividing materials across multiple batches
//
// KEY FEATURES:
// - Searchable dropdowns for better UX
// - Date formatting (DD-MM-YYYY)
// - Pagination for all tables
// - Modal-based forms for create/edit/view
// - Real-time validation
// - QC integration for quality-critical operations
// ============================================================================

// ============================================================================
// MATERIAL & OPERATION MODULE
// ============================================================================
// This module manages material requests and production operations including:
// 
// 1. MR REQUEST (Material Request):
//    - Create material requests for production operations
//    - Track status: Request to Warehouse → Issued by Warehouse → Received by Production
//    - Manage material quantities (required, issued, received)
//    - Auto-load work centers and items based on operation selection
//
// 2. PRE-PROCURE:
//    - Plan future material procurement before actual need
//    - Link to procurement requests and GRN (Goods Receipt Note)
//    - Mark as received when GRN is verified
//    - Track planned quantities vs available quantities
//
// 3. BATCH TRACKING:
//    - Create production batches (single or bulk)
//    - Track input materials consumed and output items produced
//    - Manage batch lifecycle: Batch Created → Sent for QC → Verified QC → Batch Closed
//    - Support for QC verification with verified quantities
//    - Shift-based tracking (Morning/Night)
//
// WORKFLOW:
// - MR Request: Create → Warehouse Issues → Production Receives → Use in Batch
// - Pre-Procure: Create → Procurement → GRN Verified → Mark as Received
// - Batch: Create → Add Output → Submit (QC if required) → QC Verify → Close
//
// KEY FEATURES:
// - Searchable dropdowns for easy selection
// - Real-time quantity validation
// - Automatic calculation of available quantities
// - Bulk batch creation with auto-division of materials
// - QC integration for quality-sensitive operations
// ============================================================================

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
  status: "Request to Warehouse" | "Issued by Warehouse" | "Received by Production";
  issuedAt?: string; // When issued by warehouse
  issuedBy?: string; // Who issued from warehouse
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
  issuedQty?: number; // Quantity issued by warehouse
  receivedQty?: number; // Quantity received by production
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
  shift: "Morning" | "Night"; // Shift field for batch tracking
  totalInputItems: number;
  totalOutputItems: number;
  status: "Batch Created" | "Sent for QC" | "Verified QC" | "Batch Closed";
  createdType: "SINGLE" | "BULK"; // Track how batch was created
  bulkBatchGroupId?: string; // Group ID for bulk batches created together
  startTime?: string;
  endTime?: string;
  inputItems?: { id: number; item: string; uom: string; qtySupplied: number }[];
  outputItems?: { id: number; item: string; uom: string; qtyProduced: number; verifiedQty?: number }[];
  // QC Summary fields (populated when status = "Verified QC")
  qcStatus?: "Sent for QC" | "Verified";
  qcVerifiedBy?: string;
  qcVerifiedOn?: string;
}

/**
 * QC Parameter interface
 * Represents QC parameters from Operation Master
 */
interface QCParameter {
  id: number;
  name: string;
  description: string;
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

/**
 * Operation Master interface
 * Represents operation configuration including QC requirements
 */
interface OperationMaster {
  operation: string;
  isQCRequired: boolean;
  qcParameters: QCParameter[];
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

const OPERATIONS = ["Cutting", "Welding"];
const WORK_CENTERS = ["WC-001 Cutting Bay", "WC-002 Welding Station"];
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
];

// Mock warehouse stock data
const WAREHOUSE_STOCK: { [warehouse: string]: { [itemCode: string]: number } } = {
  "Production Store": {
    "MAT001": 150,
    "MAT002": 30, // Shortage scenario
    "MAT003": 50,
    "MAT004": 5,
  },
  "Raw Material Store": {
    "MAT001": 500,
    "MAT002": 250,
    "MAT003": 100,
    "MAT004": 10,
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
};

// Mock Operation Masters with QC configuration
const OPERATION_MASTERS: OperationMaster[] = [
  {
    operation: "Cutting",
    isQCRequired: false,
    qcParameters: []
  },
  {
    operation: "Welding",
    isQCRequired: true,
    qcParameters: [
      { id: 1, name: "Weld Strength", description: "Check weld integrity and strength" },
      { id: 2, name: "Surface Finish", description: "Inspect surface quality and smoothness" },
      { id: 3, name: "Dimensions", description: "Verify dimensional accuracy" }
    ]
  }
];

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
  const [batchStatusFilter, setBatchStatusFilter] = useState("Batch Created"); // Status filter for Batch Tracking
  const [batchOperationFilter, setBatchOperationFilter] = useState("All"); // Operation filter for Batch Tracking
  const [batchWorkCenterFilter, setBatchWorkCenterFilter] = useState("All"); // Work Center filter for Batch Tracking

  // Modal state for viewing MR
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingMR, setViewingMR] = useState<MRRequest | null>(null);
  
  // Modal state for MR Request Form (Create/Edit)
  const [isMRFormModalOpen, setIsMRFormModalOpen] = useState(false);
  const [mrFormMode, setMRFormMode] = useState<'create' | 'edit'>('create');
  
  // Modal state for viewing Pre-Procure
  const [isViewPreProcureModalOpen, setIsViewPreProcureModalOpen] = useState(false);
  const [viewingPreProcure, setViewingPreProcure] = useState<PreProcure | null>(null);

  // Modal state for viewing Batch Tracking
  const [isViewBatchModalOpen, setIsViewBatchModalOpen] = useState(false);
  const [viewingBatch, setViewingBatch] = useState<BatchTracking | null>(null);
  
  // Modal state for Batch Form (Create/Edit)
  const [isBatchFormModalOpen, setIsBatchFormModalOpen] = useState(false);
  const [batchFormMode, setBatchFormMode] = useState<'create' | 'edit' | 'view'>('create');

  // Modal state for QC Verification
  const [isQCVerifyModalOpen, setIsQCVerifyModalOpen] = useState(false);
  const [qcParameters, setQCParameters] = useState<QCParameter[]>([]);
  const [pendingBatchData, setPendingBatchData] = useState<any>(null);

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
      status: "Request to Warehouse",
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
      status: "Issued by Warehouse",
      issuedAt: "2024-01-17T10:30:00",
      issuedBy: "Warehouse Manager",
      items: [
        { id: 1, itemCode: "MAT003", itemName: "Welding Wire", uom: "KG", availableQty: 50, requiredQty: 10, issuedQty: 10 },
        { id: 2, itemCode: "MAT004", itemName: "Gas Cylinder", uom: "NOS", availableQty: 5, requiredQty: 2, issuedQty: 2 },
      ]
    },
    {
      id: 3,
      mrNumber: "MR-2024-003",
      date: "2024-01-18",
      requiredByDate: "2024-01-25",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      requestedBy: "Mike Johnson",
      totalItems: 2,
      status: "Received by Production",
      issuedAt: "2024-01-19T09:00:00",
      issuedBy: "Warehouse Manager",
      receivedAt: "2024-01-19T14:30:00",
      receivedBy: "Production Supervisor",
      items: [
        { id: 1, itemCode: "MAT001", itemName: "Steel Sheet", uom: "KG", availableQty: 150, requiredQty: 80, issuedQty: 80, receivedQty: 80 },
        { id: 2, itemCode: "MAT003", itemName: "Welding Wire", uom: "KG", availableQty: 50, requiredQty: 15, issuedQty: 15, receivedQty: 15 },
      ]
    },
    {
      id: 4,
      mrNumber: "MR-2024-004",
      date: "2024-02-20",
      requiredByDate: "2024-02-25",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      requestedBy: "Sarah Lee",
      totalItems: 2,
      status: "Received by Production",
      issuedAt: "2024-02-21T08:00:00",
      issuedBy: "Warehouse Manager",
      receivedAt: "2024-02-21T10:00:00",
      receivedBy: "Production Supervisor",
      items: [
        { id: 1, itemCode: "MAT003", itemName: "Welding Wire", uom: "KG", availableQty: 50, requiredQty: 30, issuedQty: 30, receivedQty: 30 },
        { id: 2, itemCode: "MAT004", itemName: "Gas Cylinder", uom: "NOS", availableQty: 5, requiredQty: 5, issuedQty: 5, receivedQty: 5 },
      ]
    },
    {
      id: 5,
      mrNumber: "MR-2024-005",
      date: "2024-02-22",
      requiredByDate: "2024-02-28",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      requestedBy: "Tom Wilson",
      totalItems: 2,
      status: "Received by Production",
      issuedAt: "2024-02-23T09:00:00",
      issuedBy: "Warehouse Manager",
      receivedAt: "2024-02-23T11:00:00",
      receivedBy: "Production Supervisor",
      items: [
        { id: 1, itemCode: "MAT001", itemName: "Steel Sheet", uom: "KG", availableQty: 150, requiredQty: 120, issuedQty: 120, receivedQty: 120 },
        { id: 2, itemCode: "MAT002", itemName: "Aluminum Rod", uom: "KG", availableQty: 30, requiredQty: 25, issuedQty: 25, receivedQty: 25 },
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
      grnStatus: "Verified QC", // GRN Verified QC - button enabled
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
      grnStatus: "Pending", // GRN not Verified QC - button disabled
      items: [
        { id: 1, itemCode: "MAT003", itemName: "Welding Wire", uom: "KG", availableQty: 50, plannedQty: 50 },
        { id: 2, itemCode: "MAT004", itemName: "Gas Cylinder", uom: "NOS", availableQty: 5, plannedQty: 10 },
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
      shift: "Morning",
      totalInputItems: 2,
      totalOutputItems: 1,
      status: "Batch Closed",
      createdType: "SINGLE",
      startTime: "2024-01-15T08:00:00",
      endTime: "2024-01-15T16:00:00",
      inputItems: [
        { id: 1, item: "Steel Sheet", uom: "KG", qtySupplied: 100 },
        { id: 2, item: "Aluminum Rod", uom: "KG", qtySupplied: 50 },
      ],
      outputItems: [
        { id: 1, item: "Cut Steel Plate", uom: "PCS", qtyProduced: 50 },
      ]
    },
    {
      id: 2,
      batchNo: "BATCH-2024-002",
      date: "2024-01-16",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      shift: "Night",
      totalInputItems: 2,
      totalOutputItems: 1,
      status: "Verified QC",
      createdType: "SINGLE",
      startTime: "2024-01-16T20:00:00",
      endTime: "2024-01-17T04:00:00",
      qcStatus: "Verified",
      qcVerifiedBy: "QC Inspector - John Smith",
      qcVerifiedOn: "2024-01-17T10:30:00",
      inputItems: [
        { id: 1, item: "Welding Wire", uom: "KG", qtySupplied: 10 },
        { id: 2, item: "Gas Cylinder", uom: "NOS", qtySupplied: 2 },
      ],
      outputItems: [
        { id: 1, item: "Welded Frame", uom: "PCS", qtyProduced: 25, verifiedQty: 23 },
      ]
    },
    {
      id: 3,
      batchNo: "BATCH-2026-003",
      date: "2026-02-19",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      shift: "Morning",
      totalInputItems: 2,
      totalOutputItems: 0,
      status: "Batch Created",
      createdType: "SINGLE",
      startTime: new Date().toISOString(),
      inputItems: [
        { id: 1, item: "Welding Wire", uom: "KG", qtySupplied: 15 },
        { id: 2, item: "Gas Cylinder", uom: "NOS", qtySupplied: 3 },
      ],
      outputItems: [
        { id: 1, item: "Welded Frame", uom: "PCS", qtyProduced: 0 },
      ]
    },
    {
      id: 4,
      batchNo: "BATCH-2026-004",
      date: "2026-02-19",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      shift: "Morning",
      totalInputItems: 2,
      totalOutputItems: 1,
      status: "Sent for QC",
      createdType: "BULK",
      bulkBatchGroupId: "BULK-2026-001",
      startTime: new Date().toISOString(),
      inputItems: [
        { id: 1, item: "Welding Wire", uom: "KG", qtySupplied: 12 },
        { id: 2, item: "Gas Cylinder", uom: "NOS", qtySupplied: 2 },
      ],
      outputItems: [
        { id: 1, item: "Welded Frame", uom: "PCS", qtyProduced: 20 },
      ]
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
    shift: "" as "Morning" | "Night" | "", // Shift field for batch form
    startTime: null as string | null,
    endTime: null as string | null,
    savedBatchId: null as number | null,
    status: "Batch Created" as "Batch Created" | "Sent for QC" | "Verified QC" | "Batch Closed",
    createdType: "SINGLE" as "SINGLE" | "BULK",
    inputItems: [] as { id: number; item: string; uom: string; availableQty: number; qtySupplied: number }[],
    outputItems: [] as { id: number; item: string; uom: string; qtyProduced: number; verifiedQty?: number }[]
  });

  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showShortageDialog, setShowShortageDialog] = useState(false);
  const [showPreProcureConfirmDialog, setShowPreProcureConfirmDialog] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBatchSubmitConfirmOpen, setIsBatchSubmitConfirmOpen] = useState(false);

  // Bulk Batch Creation state
  const [isBulkBatchModalOpen, setIsBulkBatchModalOpen] = useState(false);
  const [bulkBatchFormData, setBulkBatchFormData] = useState({
    mrNo: "",
    shift: "" as "Morning" | "Night" | "",
    numberOfBatches: 0,
    date: getCurrentDateForInput(),
    items: [] as { itemName: string; uom: string; availableQty: number; qtyPerBatch: number }[]
  });
  const [bulkBatchPreviews, setBulkBatchPreviews] = useState<{
    batchNo: string;
    inputItems: { id: number; item: string; uom: string; qtySupplied: number }[];
    outputItems: { id: number; item: string; uom: string; qtyProduced: number }[];
  }[]>([]);
  const [activeBulkBatchTab, setActiveBulkBatchTab] = useState("batch-1");
  const [bulkBatchValidationError, setBulkBatchValidationError] = useState("");

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

        // Get available qty from MR for input items
        const selectedMR = mrRequests.find(mr => mr.mrNumber === existingBatch.mrNo);
        const inputItems = existingBatch.inputItems?.map(item => {
          const mrItem = selectedMR?.items.find(mi => mi.itemName === item.item);
          return {
            ...item,
            availableQty: mrItem?.availableQty || 0
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
          createdType: existingBatch.createdType,
          inputItems,
          outputItems
        });
        setIsReadOnly(existingBatch.status === "Verified QC");
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
   * Status filter: 
   * - "Request to Warehouse" = not issued yet (isInventoryIssued: false)
   * - "Issued by Warehouse" = issued but not received (isInventoryIssued: true, isFinalized: false)
   * - "Received by Production" = received (isFinalized: true)
   */
  const filteredRequests = mrRequests.filter(item => {
    // Search filter
    const matchesSearch = item.mrNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.operation.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter based on status field
    let matchesStatus = true;
    if (statusFilter !== "All") {
      matchesStatus = item.status === statusFilter;
    }
    // "All" matches everything
    
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
   * Filter Batch Tracking by search term (Batch No, MR No) and filters (Operation, Work Center, Status)
   */
  const filteredBatchTrackings = batchTrackings.filter(item => {
    const matchesSearch = item.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.mrNo.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = batchStatusFilter === "All" || item.status === batchStatusFilter;
    const matchesOperation = batchOperationFilter === "All" || item.operation === batchOperationFilter;
    const matchesWorkCenter = batchWorkCenterFilter === "All" || item.workCenter === batchWorkCenterFilter;
    
    return matchesSearch && matchesStatus && matchesOperation && matchesWorkCenter;
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
      status: "Request to Warehouse",
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
   * Marks the MR as received (only enabled if status is "Issued by Warehouse")
   * Validates that received qty <= issued qty for each item
   */
  const handleMarkAsReceived = () => {
    if (!viewingMR || viewingMR.status !== "Issued by Warehouse") return;

    // Validation: Check that all received quantities are valid
    const hasInvalidQty = viewingMR.items.some(item => {
      const receivedQty = item.receivedQty || 0;
      const issuedQty = item.issuedQty || 0;
      return receivedQty < 0 || receivedQty > issuedQty;
    });

    if (hasInvalidQty) {
      toast({ 
        variant: "destructive",
        title: "Validation Error", 
        description: "Received quantity must be between 0 and issued quantity for all items" 
      });
      return;
    }

    // Update the MR status to "Received by Production"
    const updatedRequests = mrRequests.map(mr =>
      mr.id === viewingMR.id ? { 
        ...mr, 
        status: "Received by Production" as const,
        receivedAt: new Date().toISOString(),
        receivedBy: "Current User",
        items: viewingMR.items // Update items with received quantities
      } : mr
    );
    setMrRequests(updatedRequests);
    toast({ title: "Success", description: `MR ${viewingMR.mrNumber} marked as received` });
    setIsViewModalOpen(false);
    setViewingMR(null);
  };

  /**
   * Check if inventory issue is done for an MR
   */
  const isInventoryIssueDone = (mr: MRRequest | null): boolean => {
    return mr?.status === "Issued by Warehouse" || mr?.status === "Received by Production";
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
      // Load input items from MR with available qty
      const inputItems = selectedMR.items.map((item, index) => ({
        id: index + 1,
        item: item.itemName,
        uom: item.uom,
        availableQty: item.availableQty, // Add available qty from MR
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
   * Handle batch save as Batch Created
   * Allows saving with output qty = 0
   * Validates: MR selected + Shift selected + At least one input qty > 0
   */
  const handleBatchSave = () => {
    // Validation: MR No required
    if (!batchFormData.mrNo) {
      toast({ variant: "destructive", title: "Validation Error", description: "MR No is required" });
      return;
    }

    // Validation: Shift required
    if (!batchFormData.shift) {
      toast({ variant: "destructive", title: "Validation Error", description: "Shift is required" });
      return;
    }

    // Validation: At least one input qty > 0
    const hasInputQty = batchFormData.inputItems.some(item => item.qtySupplied > 0);
    if (!hasInputQty) {
      toast({ variant: "destructive", title: "Validation Error", description: "At least one input quantity must be greater than 0" });
      return;
    }

    const startTime = batchFormData.startTime || new Date().toISOString();
    const hasOutputQty = batchFormData.outputItems.some(item => item.qtyProduced > 0);
    
    // Determine status: Batch Created if no output, IN_PROCESS if has output
    const newStatus = hasOutputQty ? "Sent for QC" : "Batch Created";

    // Save or update batch
    if (batchFormData.savedBatchId) {
      // Update existing batch
      const updatedBatchTrackings = batchTrackings.map(batch => {
        if (batch.id === batchFormData.savedBatchId) {
          return {
            ...batch,
            status: newStatus as "Batch Created" | "Sent for QC",
            startTime,
            mrNo: batchFormData.mrNo,
            shift: batchFormData.shift as "Morning" | "Night",
            operation: batchFormData.operation,
            workCenter: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.workCenter || "",
            warehouse: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.warehouse || "",
            totalInputItems: batchFormData.inputItems.length,
            totalOutputItems: batchFormData.outputItems.filter(item => item.qtyProduced > 0).length,
            inputItems: batchFormData.inputItems,
            outputItems: batchFormData.outputItems,
            createdType: batch.createdType || "SINGLE"
          };
        }
        return batch;
      });
      setBatchTrackings(updatedBatchTrackings);
      setBatchFormData({ ...batchFormData, startTime, status: newStatus });
    } else {
      // Create new batch
      const newBatch: BatchTracking = {
        id: batchTrackings.length + 1,
        batchNo: batchFormData.batchNo,
        date: batchFormData.date,
        mrNo: batchFormData.mrNo,
        shift: batchFormData.shift as "Morning" | "Night",
        operation: batchFormData.operation,
        workCenter: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.workCenter || "",
        warehouse: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.warehouse || "",
        totalInputItems: batchFormData.inputItems.length,
        totalOutputItems: batchFormData.outputItems.filter(item => item.qtyProduced > 0).length,
        status: newStatus,
        createdType: "SINGLE",
        startTime,
        inputItems: batchFormData.inputItems,
        outputItems: batchFormData.outputItems
      };
      setBatchTrackings([...batchTrackings, newBatch]);
      setBatchFormData({ ...batchFormData, startTime, savedBatchId: newBatch.id, status: newStatus, createdType: "SINGLE" });
    }

    toast({ title: "Saved", description: `Batch saved as ${newStatus === "Batch Created" ? "Batch Created" : "Sent for QC"}` });

    // Close modal
    setIsViewBatchModalOpen(false);
  };

  /**
   * Handle batch submit (complete)
   * Validates: MR + Shift + Input qty > 0 + Output qty > 0
   * If QC required for operation, shows QC verification popup
   * Otherwise, sets status to IN_PROCESS (ready for further processing)
   */
  const handleBatchSubmit = () => {
    // Validation: MR No required
    if (!batchFormData.mrNo) {
      toast({ variant: "destructive", title: "Validation Error", description: "MR No is required" });
      return;
    }

    // Validation: Shift required
    if (!batchFormData.shift) {
      toast({ variant: "destructive", title: "Validation Error", description: "Shift is required" });
      return;
    }

    // Validation: At least one input qty > 0
    const hasInputQty = batchFormData.inputItems.some(item => item.qtySupplied > 0);
    if (!hasInputQty) {
      toast({ variant: "destructive", title: "Validation Error", description: "At least one input quantity must be greater than 0" });
      return;
    }

    // Validation: At least one output qty > 0
    const hasOutputQty = batchFormData.outputItems.some(item => item.qtyProduced > 0);
    if (!hasOutputQty) {
      toast({ variant: "destructive", title: "Validation Error", description: "At least one output quantity must be greater than 0 to submit" });
      return;
    }

    // Check if QC is required for this operation
    const operationMaster = OPERATION_MASTERS.find(om => om.operation === batchFormData.operation);
    const isQCRequired = operationMaster?.isQCRequired || false;

    const endTime = new Date().toISOString();
    
    // If QC is required, show QC verification popup
    if (isQCRequired && operationMaster?.qcParameters && operationMaster.qcParameters.length > 0) {
      // Store batch data for later processing
      setPendingBatchData({
        endTime,
        savedBatchId: batchFormData.savedBatchId
      });
      
      // Load QC parameters
      setQCParameters(operationMaster.qcParameters);
      
      // Show QC verification modal
      setIsQCVerifyModalOpen(true);
      return;
    }

    // If QC not required, proceed with normal submission
    completeBatchSubmission(endTime);
  };

  /**
   * Complete batch submission after QC verification (or if QC not required)
   */
  const completeBatchSubmission = (endTime: string) => {
    // Check if batch was already saved (has savedBatchId)
    if (batchFormData.savedBatchId) {
      // Update existing batch
      const updatedBatchTrackings = batchTrackings.map(batch => {
        if (batch.id === batchFormData.savedBatchId) {
          return {
            ...batch,
            status: "Sent for QC" as const,
            endTime: endTime,
            totalInputItems: batchFormData.inputItems.length,
            totalOutputItems: batchFormData.outputItems.filter(item => item.qtyProduced > 0).length,
            inputItems: batchFormData.inputItems,
            outputItems: batchFormData.outputItems
          };
        }
        return batch;
      });
      
      setBatchTrackings(updatedBatchTrackings);
      toast({ title: "Success", description: `Batch ${batchFormData.batchNo} submitted successfully` });
      setBatchFormData({ ...batchFormData, endTime, status: "Sent for QC" });
      
      // Close modal after submit
      setIsViewBatchModalOpen(false);
    } else {
      // Create new batch tracking record (if Save wasn't clicked first)
      const newBatch: BatchTracking = {
        id: batchTrackings.length + 1,
        batchNo: batchFormData.batchNo,
        date: batchFormData.date,
        mrNo: batchFormData.mrNo,
        shift: batchFormData.shift as "Morning" | "Night",
        operation: batchFormData.operation,
        workCenter: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.workCenter || "",
        warehouse: mrRequests.find(mr => mr.mrNumber === batchFormData.mrNo)?.warehouse || "",
        totalInputItems: batchFormData.inputItems.length,
        totalOutputItems: batchFormData.outputItems.filter(item => item.qtyProduced > 0).length,
        status: "Sent for QC",
        createdType: "SINGLE",
        startTime: batchFormData.startTime || new Date().toISOString(),
        endTime: endTime,
        inputItems: batchFormData.inputItems,
        outputItems: batchFormData.outputItems
      };

      setBatchTrackings([...batchTrackings, newBatch]);
      toast({ title: "Success", description: `Batch ${batchFormData.batchNo} submitted successfully` });

      setBatchFormData({ ...batchFormData, startTime: newBatch.startTime || null, endTime, savedBatchId: newBatch.id, status: "Sent for QC", createdType: "SINGLE" });
      
      // Close modal after submit
      setIsViewBatchModalOpen(false);
    }
  };

  /**
   * Handle QC verification confirmation
   */
  const handleQCVerifyConfirm = () => {
    // Close QC modal
    setIsQCVerifyModalOpen(false);
    
    // Complete batch submission with stored data
    if (pendingBatchData) {
      completeBatchSubmission(pendingBatchData.endTime);
      setPendingBatchData(null);
    }
  };

  /**
   * Check if Save button should be enabled
   */
  const isSaveEnabled = () => {
    return batchFormData.mrNo && batchFormData.shift && batchFormData.inputItems.some(item => item.qtySupplied > 0);
  };

  /**
   * Check if Submit button should be enabled
   */
  const isSubmitEnabled = () => {
    return batchFormData.mrNo && 
           batchFormData.shift && 
           batchFormData.inputItems.some(item => item.qtySupplied > 0) &&
           batchFormData.outputItems.some(item => item.qtyProduced > 0);
  };

  /**
   * Handle view Batch Tracking action
   * Opens modal with Batch details for viewing or editing
   */
  const handleViewBatch = (batch: BatchTracking) => {
      // Determine if batch is editable - only "Batch Created" is editable
      const canEdit = batch.status === "Batch Created";

      // Store the viewing batch for reference in the modal
      setViewingBatch(batch);

      // Load batch data into form
      const outputItems = (batch.outputItems && batch.outputItems.length > 0)
        ? batch.outputItems.map(item => ({
            id: item.id,
            item: item.item,
            uom: item.uom,
            qtyProduced: item.qtyProduced,
            verifiedQty: item.verifiedQty
          }))
        : (() => {
            const outputMapping = OPERATION_OUTPUT_MAPPINGS[batch.operation] || [];
            return outputMapping.map((item, index) => ({
              id: index + 1,
              item: item.itemName,
              uom: item.uom,
              qtyProduced: 0
            }));
          })();

      // Get available qty from MR for input items
      const selectedMR = mrRequests.find(mr => mr.mrNumber === batch.mrNo);
      const inputItems = batch.inputItems?.map(item => {
        const mrItem = selectedMR?.items.find(mi => mi.itemName === item.item);
        return {
          ...item,
          availableQty: mrItem?.availableQty || 0
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
        createdType: batch.createdType,
        inputItems,
        outputItems
      });

      // Set read-only mode based on status
      setIsReadOnly(!canEdit);
      setBatchFormMode(canEdit ? 'edit' : 'view');
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
   * Handle create MR Request button click
   */
  const handleCreateMR = () => {
    // Reset form data
    setFormData({
      mrNumber: `MR-${new Date().getFullYear()}-${String(mrRequests.length + 1).padStart(3, '0')}`,
      date: getCurrentDateForInput(),
      requestedBy: "Current User",
      operation: "",
      workCenter: "",
      items: [],
      status: "Request to Warehouse",
    });
    setMRFormMode('create');
    setIsMRFormModalOpen(true);
  };

  /**
   * Handle create batch button click
   */
  const handleCreateBatch = () => {
      // Reset batch form data
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
      setBatchFormMode('create');
      setIsBatchFormModalOpen(true);
    };

  /**
   * Handle MR No selection in bulk batch form
   * Loads MR items and calculates available quantities
   */
  const handleBulkBatchMRSelection = (mrNo: string) => {
    const selectedMR = mrRequests.find(mr => mr.mrNumber === mrNo);
    if (!selectedMR) {
      setBulkBatchFormData({ ...bulkBatchFormData, mrNo, items: [] });
      setBulkBatchPreviews([]);
      setBulkBatchValidationError("");
      return;
    }

    // Safety check for items array
    if (!selectedMR.items || !Array.isArray(selectedMR.items)) {
      setBulkBatchFormData({ ...bulkBatchFormData, mrNo, items: [] });
      setBulkBatchPreviews([]);
      setBulkBatchValidationError("No items found for selected MR");
      return;
    }

    // Calculate available qty for each item (MR Required Qty - Qty already used in batches)
    const itemsWithAvailableQty = selectedMR.items.map(mrItem => {
      // Sum up quantities already used in batches for this MR
      const usedQty = batchTrackings
        .filter(batch => batch.mrNo === mrNo)
        .reduce((sum, batch) => {
          const inputItem = batch.inputItems?.find(item => item.item === mrItem.itemName);
          return sum + (inputItem?.qtySupplied || 0);
        }, 0);

      const availableQty = (mrItem.requiredQty || 0) - usedQty;

      return {
        itemName: mrItem.itemName || '',
        uom: mrItem.uom || '',
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

    // Generate previews if numberOfBatches is already set
    if (updatedFormData.numberOfBatches >= 1 && itemsWithAvailableQty.length > 0) {
      generateBulkBatchPreviews(updatedFormData.numberOfBatches, itemsWithAvailableQty, selectedMR);
    }
  };

  /**
   * Generate bulk batch previews
   * 
   * This function creates preview data for bulk batch creation by:
   * 1. Validating that NOS/PCS items have sufficient quantity (at least 1 per batch)
   * 2. Auto-dividing available quantities equally across all batches
   * 3. Generating output items based on operation mapping
   * 4. Creating preview objects for each batch with unique batch numbers
   * 
   * @param numberOfBatches - Number of batches to create
   * @param items - Available items with quantities
   * @param selectedMR - The selected Material Request
   */
  const generateBulkBatchPreviews = (numberOfBatches: number, items: typeof bulkBatchFormData.items, selectedMR: MRRequest) => {
    // Safety checks
    if (!selectedMR || !selectedMR.operation) {
      setBulkBatchValidationError("Invalid MR selected");
      setBulkBatchPreviews([]);
      return;
    }

    if (!items || items.length === 0) {
      setBulkBatchValidationError("No items available");
      setBulkBatchPreviews([]);
      return;
    }

    // Validate NOS/PCS items - they must have at least 1 unit per batch
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

    // Calculate qty per batch
    const itemsWithQtyPerBatch = items.map(item => ({
      ...item,
      qtyPerBatch: Math.floor(item.availableQty / numberOfBatches)
    }));

    // Generate previews
    const currentYear = new Date().getFullYear();
    const previews = [];

    for (let i = 0; i < numberOfBatches; i++) {
      const batchNo = `BATCH-${currentYear}-${String(batchTrackings.length + i + 1).padStart(3, '0')}`;

      // Input items
      const inputItems = itemsWithQtyPerBatch
        .filter(item => item.qtyPerBatch > 0)
        .map((item, idx) => ({
          id: idx + 1,
          item: item.itemName,
          uom: item.uom,
          qtySupplied: item.qtyPerBatch
        }));

      // Output items - with safety check
      const outputMapping = OPERATION_OUTPUT_MAPPINGS[selectedMR.operation];
      const outputItems = (outputMapping && Array.isArray(outputMapping)) ? outputMapping.map((item, idx) => ({
        id: idx + 1,
        item: item.itemName,
        uom: item.uom,
        qtyProduced: 0
      })) : [];

      previews.push({
        batchNo,
        inputItems,
        outputItems
      });
    }

    setBulkBatchPreviews(previews);
    setActiveBulkBatchTab("batch-1");

    // Update items with qtyPerBatch
    setBulkBatchFormData(prev => ({
      ...prev,
      items: itemsWithQtyPerBatch
    }));
  };

  /**
   * Handle number of batches change in bulk batch form
   * Auto-divides available quantities equally across batches and generates preview
   */
  const handleBulkBatchNumberChange = (numberOfBatches: number) => {
    if (numberOfBatches < 0) numberOfBatches = 0;

    setBulkBatchFormData(prev => ({
      ...prev,
      numberOfBatches
    }));

    // Generate previews if MR is selected and numberOfBatches is at least 1
    if (numberOfBatches >= 1 && bulkBatchFormData.mrNo && bulkBatchFormData.items.length > 0) {
      const selectedMR = mrRequests.find(mr => mr.mrNumber === bulkBatchFormData.mrNo);
      if (selectedMR) {
        generateBulkBatchPreviews(numberOfBatches, bulkBatchFormData.items, selectedMR);
      }
    } else if (numberOfBatches === 0) {
      // Clear previews when numberOfBatches is 0
      setBulkBatchPreviews([]);
      setBulkBatchValidationError("");
    }
  };

  /**
   * Handle create bulk batches - Save Batch Created Bulk
   * Creates N batch records with auto-divided input, output can be 0
   */
  const handleSaveBatchCreatedBulkBatches = () => {
    // Validation: MR No required
    if (!bulkBatchFormData.mrNo) {
      toast({ variant: "destructive", title: "Validation Error", description: "MR No is required" });
      return;
    }

    // Validation: Shift required
    if (!bulkBatchFormData.shift) {
      toast({ variant: "destructive", title: "Validation Error", description: "Shift is required" });
      return;
    }

    // Validation: Number of batches must be at least 1
    if (!bulkBatchFormData.numberOfBatches || bulkBatchFormData.numberOfBatches < 1) {
      toast({ variant: "destructive", title: "Validation Error", description: "Number of batches must be at least 1" });
      return;
    }

    // Validation: Check for validation errors (NOS/PCS items)
    if (bulkBatchValidationError) {
      toast({ variant: "destructive", title: "Validation Error", description: bulkBatchValidationError });
      return;
    }

    // Validation: Check if any item has available qty > 0
    const hasAvailableQty = bulkBatchFormData.items.some(item => item.availableQty > 0);
    if (!hasAvailableQty) {
      toast({ variant: "destructive", title: "Validation Error", description: "No available quantity to create batches. All material has been used." });
      return;
    }

    const selectedMR = mrRequests.find(mr => mr.mrNumber === bulkBatchFormData.mrNo);
    if (!selectedMR) return;

    // Generate bulk batch group ID
    const bulkGroupId = `BULK-${new Date().getFullYear()}-${String(batchTrackings.length + 1).padStart(3, '0')}`;

    // Use the previews to create batches
    // For Save Batch Created: output can be 0, status is Batch Created if all outputs are 0, IN_PROCESS if any output > 0
    const newBatches: BatchTracking[] = bulkBatchPreviews.map((preview, index) => {
      const hasOutputQty = preview.outputItems.some(item => item.qtyProduced > 0);
      return {
        id: batchTrackings.length + index + 1,
        batchNo: preview.batchNo,
        date: bulkBatchFormData.date,
        mrNo: bulkBatchFormData.mrNo,
        shift: bulkBatchFormData.shift as "Morning" | "Night",
        operation: selectedMR.operation,
        workCenter: selectedMR.workCenter,
        warehouse: selectedMR.warehouse,
        totalInputItems: preview.inputItems.length,
        totalOutputItems: preview.outputItems.filter(item => item.qtyProduced > 0).length,
        status: hasOutputQty ? "Sent for QC" : "Batch Created",
        createdType: "BULK",
        bulkBatchGroupId: bulkGroupId,
        startTime: new Date().toISOString(),
        inputItems: preview.inputItems,
        outputItems: preview.outputItems
      };
    });

    // Add all new batches to state
    setBatchTrackings([...batchTrackings, ...newBatches]);

    // Close modal and show success message
    setIsBulkBatchModalOpen(false);
    toast({ 
      title: "Success", 
      description: `${bulkBatchFormData.numberOfBatches} batches saved as Batch Created` 
    });

    // Reset bulk batch form
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

  /**
   * Handle create bulk batches - Submit Bulk
   * Validates that all batches have output qty > 0
   */
  const handleSubmitBulkBatches = () => {
    // Validation: MR No required
    if (!bulkBatchFormData.mrNo) {
      toast({ variant: "destructive", title: "Validation Error", description: "MR No is required" });
      return;
    }

    // Validation: Shift required
    if (!bulkBatchFormData.shift) {
      toast({ variant: "destructive", title: "Validation Error", description: "Shift is required" });
      return;
    }

    // Validation: Number of batches must be at least 1
    if (!bulkBatchFormData.numberOfBatches || bulkBatchFormData.numberOfBatches < 1) {
      toast({ variant: "destructive", title: "Validation Error", description: "Number of batches must be at least 1" });
      return;
    }

    // Validation: Check for validation errors (NOS/PCS items)
    if (bulkBatchValidationError) {
      toast({ variant: "destructive", title: "Validation Error", description: bulkBatchValidationError });
      return;
    }

    // Validation: Check if any item has available qty > 0
    const hasAvailableQty = bulkBatchFormData.items.some(item => item.availableQty > 0);
    if (!hasAvailableQty) {
      toast({ variant: "destructive", title: "Validation Error", description: "No available quantity to create batches. All material has been used." });
      return;
    }

    // Validation: All batches must have output qty > 0
    const allBatchesHaveOutput = bulkBatchPreviews.every(preview => 
      preview.outputItems.some(item => item.qtyProduced > 0)
    );
    if (!allBatchesHaveOutput) {
      toast({ 
        variant: "destructive", 
        title: "Validation Error", 
        description: "All batches must have at least one output quantity greater than 0 to submit" 
      });
      return;
    }

    const selectedMR = mrRequests.find(mr => mr.mrNumber === bulkBatchFormData.mrNo);
    if (!selectedMR) return;

    // Generate bulk batch group ID
    const bulkGroupId = `BULK-${new Date().getFullYear()}-${String(batchTrackings.length + 1).padStart(3, '0')}`;

    // Use the previews to create batches
    // For Submit: all batches have status IN_PROCESS
    const newBatches: BatchTracking[] = bulkBatchPreviews.map((preview, index) => ({
      id: batchTrackings.length + index + 1,
      batchNo: preview.batchNo,
      date: bulkBatchFormData.date,
      mrNo: bulkBatchFormData.mrNo,
      shift: bulkBatchFormData.shift as "Morning" | "Night",
      operation: selectedMR.operation,
      workCenter: selectedMR.workCenter,
      warehouse: selectedMR.warehouse,
      totalInputItems: preview.inputItems.length,
      totalOutputItems: preview.outputItems.filter(item => item.qtyProduced > 0).length,
      status: "Sent for QC",
      createdType: "BULK",
      bulkBatchGroupId: bulkGroupId,
      startTime: new Date().toISOString(),
      inputItems: preview.inputItems,
      outputItems: preview.outputItems
    }));

    // Add all new batches to state
    setBatchTrackings([...batchTrackings, ...newBatches]);

    // Close modal and show success message
    setIsBulkBatchModalOpen(false);
    toast({ 
      title: "Success", 
      description: `${bulkBatchFormData.numberOfBatches} batches submitted successfully` 
    });

    // Reset bulk batch form
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

  /**
   * Handle mark Pre-Procure as received
   * Marks the Pre-Procure as received (only enabled if GRN is Verified QC)
   */
  const handleMarkPreProcureAsReceived = () => {
    if (viewingPreProcure && isGRNVerifiedQC(viewingPreProcure)) {
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
   * Check if GRN is Verified QC for a Pre-Procure
   */
  const isGRNVerifiedQC = (pp: PreProcure | null): boolean => {
    return pp?.grnStatus === "Verified QC";
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
        shift: "",
        startTime: null,
        endTime: null,
        savedBatchId: null,
        status: "Batch Created",
        createdType: "SINGLE",
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

  if (isFormView && !isBatchForm && !matchNew) {
    // Batch form and MR Request form are now rendered as modals, not as full pages
    // See Batch Form Modal and MR Request Form Modal sections below

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
                  Are you sure you want to submit this batch? Once submitted, the batch will be marked as Verified QC.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setIsBatchSubmitConfirmOpen(false);
                    handleBatchSubmit();
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
        setBatchStatusFilter("Batch Created");
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
                options={["Request to Warehouse", "Issued by Warehouse", "Received by Production"]}
                onChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1); // Reset to page 1 when filter changes
                }}
              />
            </div>
            <div className="w-full sm:w-auto">
              <Button onClick={handleCreateMR} className="w-full sm:w-auto">
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
                      (paginatedData as MRRequest[]).map((request) => {
                        return (
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
                        );
                      })
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
                  placeholder="Search by Batch No / MR No..."
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
                label="Operation"
                value={batchOperationFilter}
                options={["All", ...Array.from(new Set(batchTrackings.map(b => b.operation)))]}
                onChange={(value) => {
                  setBatchOperationFilter(value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-48">
              <SearchableSelect
                label="Work Center"
                value={batchWorkCenterFilter}
                options={["All", ...Array.from(new Set(batchTrackings.map(b => b.workCenter)))]}
                onChange={(value) => {
                  setBatchWorkCenterFilter(value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-48">
              <SearchableSelect
                label="Status"
                value={batchStatusFilter}
                options={["All", "Batch Created", "Sent for QC", "Verified QC", "Batch Closed"]}
                onChange={(value) => {
                  setBatchStatusFilter(value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <Button className="w-full sm:w-auto h-10" onClick={handleCreateBatch}>
              <Plus className="mr-2 h-4 w-4" />
              Create Batch
            </Button>
            <Button className="w-full sm:w-auto h-10" onClick={() => {
              // Reset bulk batch form data
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
              setIsBulkBatchModalOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Bulk Batches
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
                      <TableHead>Shift</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No batch tracking records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      (paginatedData as BatchTracking[]).map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-mono font-medium">{batch.batchNo}</TableCell>
                          <TableCell>{formatDate(batch.date)}</TableCell>
                          <TableCell className="font-mono">{batch.mrNo}</TableCell>
                          <TableCell>{batch.shift}</TableCell>
                          <TableCell>{batch.warehouse}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                batch.status === "Batch Created" ? "secondary" :
                                batch.status === "Sent for QC" ? "default" :
                                batch.status === "Verified QC" ? "outline" :
                                "destructive"
                              }
                              className={
                                batch.status === "Batch Created" ? "bg-gray-200 text-gray-700 hover:bg-gray-300" :
                                batch.status === "Sent for QC" ? "bg-blue-500 text-white hover:bg-blue-600" :
                                batch.status === "Verified QC" ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200" :
                                "bg-red-500 text-white hover:bg-red-600"
                              }
                            >
                              {batch.status === "Batch Created" ? "Batch Created" :
                               batch.status === "Sent for QC" ? "Sent for QC" :
                               batch.status === "Verified QC" ? "Verified QC" :
                               "Batch Closed"}
                            </Badge>
                          </TableCell>
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
              {/* Use status from MRRequest */}
              {(() => {
                const mrStatus = viewingMR.status;
                
                return (
                  <>
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
                          {viewingMR.status === "Received by Production" && viewingMR.receivedAt && (
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

                    {/* Items Table - Read-only or editable based on status */}
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
                                  <TableHead className="text-right">Required Qty</TableHead>
                                  {mrStatus !== "Request to Warehouse" && (
                                    <>
                                      <TableHead className="text-right">Issued Qty</TableHead>
                                      <TableHead className="text-right">Received Qty</TableHead>
                                    </>
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {viewingMR.items.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="font-mono">{item.itemCode}</TableCell>
                                    <TableCell>{item.itemName}</TableCell>
                                    <TableCell>{item.uom}</TableCell>
                                    <TableCell className="text-right">{item.requiredQty}</TableCell>
                                    {mrStatus !== "Request to Warehouse" && (
                                      <>
                                        <TableCell className="text-right">{item.issuedQty || 0}</TableCell>
                                        <TableCell className="text-right">
                                          {mrStatus === "Received by Production" ? (
                                            item.receivedQty || 0
                                          ) : (
                                            <Input
                                              type="number"
                                              value={item.receivedQty || item.issuedQty || 0}
                                              onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0;
                                                const updatedItems = viewingMR.items.map(i =>
                                                  i.id === item.id ? { ...i, receivedQty: value } : i
                                                );
                                                setViewingMR({ ...viewingMR, items: updatedItems });
                                              }}
                                              className="w-24 text-right"
                                              min="0"
                                              max={item.issuedQty || 0}
                                            />
                                          )}
                                        </TableCell>
                                      </>
                                    )}
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
                  </>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseViewModal}>
              Close
            </Button>
            {/* Only show Received button if status is "Issued by Warehouse" */}
            {viewingMR && viewingMR.status === "Issued by Warehouse" && (
              <Button 
                onClick={handleMarkAsReceived}
                variant="default"
              >
                Received
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

      {/* View/Edit Batch Tracking Modal */}
      <Dialog open={isViewBatchModalOpen} onOpenChange={setIsViewBatchModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {batchFormMode === 'view' ? 'View Batch' : 'Edit Batch'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Batch Information */}
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

            {/* QC Summary - Only show when status is "Verified QC" */}
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

            {/* Input Items */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Input Items (Supplied)
                  {batchFormData.createdType === "BULK" && (
                    <Badge className="ml-2" variant="secondary">Auto-divided (Batch Closed)</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead>Available Qty</TableHead>
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
                        batchFormData.inputItems.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.item}</TableCell>
                            <TableCell>{item.uom}</TableCell>
                            <TableCell>{item.availableQty}</TableCell>
                            <TableCell className="text-right">
                              {/* SINGLE batches: editable if not Batch Closed */}
                              {/* BULK batches: always read-only */}
                              {batchFormData.createdType === "BULK" || isReadOnly ? (
                                <span className="font-medium">{item.qtySupplied}</span>
                              ) : (
                                <Input
                                  type="number"
                                  value={item.qtySupplied}
                                  onChange={(e) => {
                                    const newQty = Number(e.target.value) || 0;
                                    const updatedItems = [...batchFormData.inputItems];
                                    updatedItems[index] = { ...item, qtySupplied: newQty };
                                    setBatchFormData({ ...batchFormData, inputItems: updatedItems });
                                  }}
                                  className="w-28 text-right"
                                  min="0"
                                  max={item.availableQty}
                                />
                              )}
                            </TableCell>
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
                        batchFormData.outputItems.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.item}</TableCell>
                            <TableCell>{item.uom}</TableCell>
                            <TableCell className="text-right">
                              {/* Output is editable unless Batch Closed */}
                              {isReadOnly ? (
                                <span className="font-medium">{item.qtyProduced}</span>
                              ) : (
                                <Input
                                  type="number"
                                  value={item.qtyProduced}
                                  onChange={(e) => {
                                    const newQty = Number(e.target.value) || 0;
                                    const updatedItems = [...batchFormData.outputItems];
                                    updatedItems[index] = { ...item, qtyProduced: newQty };
                                    setBatchFormData({ ...batchFormData, outputItems: updatedItems });
                                  }}
                                  className="w-28 text-right"
                                  min="0"
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
              // Batch Closed batch - only Close button
              <Button variant="outline" onClick={() => setIsViewBatchModalOpen(false)}>
                Close
              </Button>
            ) : (
              // Editable batch - Save and Submit buttons
              <div className="flex justify-end gap-3 w-full">
                <Button variant="outline" onClick={() => setIsViewBatchModalOpen(false)}>
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
                  onClick={handleBatchSubmit}
                  disabled={!isSubmitEnabled()}
                >
                  Submit
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Form Modal (Create/Edit) */}
      <Dialog open={isBatchFormModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsBatchFormModalOpen(false);
          // Reset form data when closing
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
            <DialogTitle>
              {batchFormMode === 'create' ? 'Create Batch' : batchFormMode === 'edit' ? 'Edit Batch' : 'View Batch'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Batch Information */}
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
                    <Label>Shift <span className="text-red-500">*</span></Label>
                    <Select 
                      value={batchFormData.shift} 
                      onValueChange={(value: "Morning" | "Night") => setBatchFormData({ ...batchFormData, shift: value })}
                      disabled={batchFormMode === 'view'}
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
                    disabled={batchFormMode === 'view'}
                  />
                </div>
                
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

            {/* Input and Output Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Table */}
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
                          <TableHead className="text-right">Available Qty</TableHead>
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
                          batchFormData.inputItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.item}</TableCell>
                              <TableCell>{item.uom}</TableCell>
                              <TableCell className="text-right font-medium text-muted-foreground">
                                {item.availableQty}
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={item.qtySupplied}
                                  disabled={batchFormMode === 'view'}
                                  onChange={(e) => {
                                    const value = e.target.value;
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

              {/* Output Table */}
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
                                  type="number"
                                  value={item.qtyProduced}
                                  disabled={batchFormMode === 'view'}
                                  onChange={(e) => {
                                    const value = e.target.value;
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
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBatchFormModalOpen(false)}>
              {batchFormData.status === "Batch Closed" ? "Close" : "Cancel"}
            </Button>
            {batchFormData.status === "Batch Created" && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleBatchSave}
                  disabled={!isSaveEnabled()}
                >
                  Save
                </Button>
                <Button onClick={() => setIsBatchSubmitConfirmOpen(true)}>
                  Submit / Send for QC
                </Button>
              </>
            )}
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
            {/* Header Fields */}
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* MR No - Searchable Dropdown */}
                  <SearchableSelect
                    label="MR No"
                    value={bulkBatchFormData.mrNo}
                    options={mrRequests.map((mr) => mr.mrNumber)}
                    onChange={handleBulkBatchMRSelection}
                    required
                  />

                  {/* Shift - Dropdown */}
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

                  {/* Number of Batches */}
                  <div>
                    <Label>No. of Batches <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      min={1}
                      value={bulkBatchFormData.numberOfBatches || ""}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        handleBulkBatchNumberChange(value);
                      }}
                      placeholder="Enter number of batches"
                    />
                  </div>

                  {/* Date */}
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

            {/* Items Table */}
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
                            <TableHead className="text-right">Available Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkBatchFormData.items.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{item.itemName}</TableCell>
                              <TableCell>{item.uom}</TableCell>
                              <TableCell className="text-right font-medium">
                                {item.availableQty}
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

            {/* Validation Error Message */}
            {bulkBatchValidationError && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <div className="text-center py-4 text-destructive font-medium">
                    {bulkBatchValidationError}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Batch Preview Section */}
            {bulkBatchPreviews.length > 0 && !bulkBatchValidationError && (
              <Card>
                <CardHeader>
                  <CardTitle>Batch Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeBulkBatchTab} onValueChange={setActiveBulkBatchTab}>
                    <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
                      {bulkBatchPreviews.map((_, index) => (
                        <TabsTrigger key={index} value={`batch-${index + 1}`} className="min-w-[100px]">
                          Batch {index + 1}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {bulkBatchPreviews.map((preview, index) => (
                      <TabsContent key={index} value={`batch-${index + 1}`} className="mt-4">
                        <div className="space-y-4">
                          {/* Batch Number Display */}
                          <div className="text-sm text-muted-foreground">
                            Batch No: <span className="font-mono font-medium text-foreground">{preview.batchNo}</span>
                          </div>

                          {/* Input and Output Tables */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Input Table */}
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base">Input</CardTitle>
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
                                      {!preview.inputItems || preview.inputItems.length === 0 ? (
                                        <TableRow>
                                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                            No input items
                                          </TableCell>
                                        </TableRow>
                                      ) : (
                                        preview.inputItems.map((item) => (
                                          <TableRow key={item.id}>
                                            <TableCell>{item.item}</TableCell>
                                            <TableCell>{item.uom}</TableCell>
                                            <TableCell className="text-right">
                                              <Input
                                                type="number"
                                                value={item.qtySupplied}
                                                readOnly
                                                className="w-24 text-right bg-muted"
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

                            {/* Output Table */}
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base">Output</CardTitle>
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
                                      {!preview.outputItems || preview.outputItems.length === 0 ? (
                                        <TableRow>
                                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                            No output items
                                          </TableCell>
                                        </TableRow>
                                      ) : (
                                        preview.outputItems.map((item) => (
                                          <TableRow key={item.id}>
                                            <TableCell>{item.item}</TableCell>
                                            <TableCell>{item.uom}</TableCell>
                                            <TableCell className="text-right">
                                              <Input
                                                type="number"
                                                value={item.qtyProduced}
                                                onChange={(e) => {
                                                  const value = e.target.value;
                                                  if (value === '' || (/^\d+$/.test(value) && value.length <= 6)) {
                                                    const numValue = parseFloat(value) || 0;
                                                    if (numValue >= 0 && numValue <= 999999) {
                                                      // Update the specific batch preview's output item
                                                      const updatedPreviews = [...bulkBatchPreviews];
                                                      updatedPreviews[index].outputItems = updatedPreviews[index].outputItems.map(outItem =>
                                                        outItem.id === item.id ? { ...outItem, qtyProduced: numValue } : outItem
                                                      );
                                                      setBulkBatchPreviews(updatedPreviews);
                                                    }
                                                  }
                                                }}
                                                onKeyPress={(e) => {
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
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBulkBatchModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="outline"
              onClick={handleSaveBatchCreatedBulkBatches}
              disabled={!!bulkBatchValidationError || bulkBatchPreviews.length === 0}
            >
              Save Batch Created Bulk
            </Button>
            <Button 
              onClick={handleSubmitBulkBatches}
              disabled={!!bulkBatchValidationError || bulkBatchPreviews.length === 0}
            >
              Submit / Send for QC Bulk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QC Verification Dialog */}
      <Dialog open={isQCVerifyModalOpen} onOpenChange={setIsQCVerifyModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Verify QC Parameters</DialogTitle>
            <DialogDescription>
              Review the QC parameters for {batchFormData.operation} operation
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Parameter</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qcParameters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                        No QC parameters defined
                      </TableCell>
                    </TableRow>
                  ) : (
                    qcParameters.map((param) => (
                      <TableRow key={param.id}>
                        <TableCell className="font-medium">{param.name}</TableCell>
                        <TableCell className="text-muted-foreground">{param.description}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsQCVerifyModalOpen(false);
                setPendingBatchData(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleQCVerifyConfirm}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

