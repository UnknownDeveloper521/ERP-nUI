import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInputBorderless,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, ChevronLeft, ChevronRight, ChevronsUpDown, Check, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================================================
// MATERIAL RELEASE MODULE
// ============================================================================
// This module handles the release of produced materials from production operations
// to the warehouse. It manages the complete workflow from creation through QC
// verification and final warehouse delivery.
//
// KEY FEATURES:
// - Create material releases from completed production batches
// - Automatic QC routing for items requiring quality inspection
// - Integration with QualityCheck module for verification
// - Status-based tab filtering for easy tracking
// - Read-only views for completed releases
//
// WORKFLOW OVERVIEW:
// Production → Material Release → QC (if required) → Warehouse → Inventory
// ============================================================================

// ============================================================================
// MATERIAL RELEASE STATUS FLOW
// ============================================================================
// STATUS TRANSITIONS:
// 
// 1. CREATION PHASE:
//    - When a release is created for QC → Status = "Sent for QC"
//    - Shown in "Sent QC" tab
//    - Items are moved to QC stock bucket
//    - QC Request record is created with qcRequestId
//
// 2. QC VERIFICATION PHASE:
//    - When QC team verifies → Status = "Pending" (Pending WH Release)
//    - Shown in "Verified QC" tab
//    - QC verification happens in QualityCheck module
//    - Sets qcVerifiedBy (inspector name) and qcVerifiedOn (datetime) fields
//    - Verified quantities are recorded per item
//
// 3. VERIFIED QC TAB ACTIONS:
//    - View action opens popup with:
//      * Read-only header fields (Release No, MR No, Operation, etc.)
//      * QC Verified By and QC Verified DateTime displayed
//      * Items table showing Produced Qty and Verified Qty
//      * "Release" button to release to warehouse
//
// 4. WAREHOUSE RELEASE PHASE:
//    - On clicking Release → Status = "Released for WH"
//    - Shown in "Released for WH" tab
//    - Items are ready for warehouse receiving
//    - View action opens read-only popup (no Release button)
//
// 5. WAREHOUSE DELIVERY PHASE:
//    - When Warehouse marks as Received → Status = "Delivered To WH"
//    - This happens in Warehouse/Inventory module (separate from this module)
//    - Not shown in specific tabs, only visible in "All" filter
//    - Items are added to warehouse inventory stock
//
// SPECIAL CASES:
// - If requiresQC = false: Release goes directly to "Released for WH" status
// - Skips QC verification steps entirely
// ============================================================================

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

/**
 * Generate next release number
 */
const generateReleaseNumber = (existingReleases: MaterialRelease[]): string => {
  const year = new Date().getFullYear();
  const count = existingReleases.filter(r => r.releaseNo.includes(`REL-${year}`)).length + 1;
  return `REL-${year}-${String(count).padStart(3, '0')}`;
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Material Release Interface
 * 
 * Represents a material release record that tracks the movement of produced
 * items from production operations to the warehouse.
 * 
 * @property id - Unique identifier for the release record
 * @property releaseNo - Auto-generated release number (format: REL-YYYY-NNN)
 * @property releaseDate - Date when the release was created
 * @property mrNo - Material Request number that this release is associated with
 * @property operation - Production operation name (e.g., Welding, Assembly)
 * @property workCenter - Work center where production occurred
 * @property warehouse - Target warehouse for delivery
 * @property releasedBy - User who created the release
 * @property requiresQC - Flag indicating if QC verification is required
 * @property status - Current status of the release in the workflow
 *   - "Sent for QC": Awaiting QC verification
 *   - "Pending": QC verified, pending warehouse release
 *   - "Released for WH": Released to warehouse, awaiting receipt
 *   - "Delivered To WH": Received by warehouse and added to inventory
 * @property items - Array of produced items included in this release
 * @property qcRequestId - Optional QC request ID (only if requiresQC = true)
 * @property qcVerifiedBy - Optional QC inspector name (set after verification)
 * @property qcVerifiedOn - Optional QC verification datetime (set after verification)
 */
interface MaterialRelease {
  id: number;
  releaseNo: string;
  releaseDate: string;
  mrNo: string;
  operation: string;
  workCenter: string;
  warehouse: string;
  releasedBy: string;
  requiresQC: boolean;
  status: "Sent for QC" | "Pending" | "Released for WH" | "Delivered To WH";
  items: ProducedItem[];
  qcRequestId?: number;
  qcVerifiedBy?: string;
  qcVerifiedOn?: string;
}

/**
 * Produced Item Interface
 * 
 * Represents an individual item within a material release.
 * 
 * @property id - Unique identifier for the item
 * @property itemCode - Item/Product code
 * @property itemName - Item/Product name
 * @property uom - Unit of measurement (e.g., PCS, KG, MTR)
 * @property qtyProduced - Quantity produced in the operation
 * @property verifiedQty - Optional verified quantity (set by QC inspector)
 *   - If not set, defaults to qtyProduced
 *   - Can be less than qtyProduced if items are rejected during QC
 */
interface ProducedItem {
  id: number;
  itemCode: string;
  itemName: string;
  uom: string;
  qtyProduced: number;
  verifiedQty?: number;
}

/**
 * MR Request Interface
 * 
 * Represents a Material Request that can be selected when creating a release.
 * Used in the dropdown selector on the create page.
 * 
 * @property mrNumber - Material Request number
 * @property operation - Production operation name
 * @property workCenter - Work center name
 * @property warehouse - Target warehouse
 * @property requiresQC - Flag indicating if QC is required for this MR
 */
interface MRRequest {
  mrNumber: string;
  operation: string;
  workCenter: string;
  warehouse: string;
  requiresQC: boolean;
}

/**
 * Batch Tracking Interface
 * 
 * Represents a completed production batch that can be included in a release.
 * Multiple batches from the same MR can be combined into a single release.
 * 
 * @property batchNo - Unique batch number
 * @property mrNo - Associated Material Request number
 * @property operation - Production operation name
 * @property workCenter - Work center where batch was produced
 * @property warehouse - Target warehouse
 * @property status - Batch status (must be "Completed" to be releasable)
 * @property outputItems - Array of items produced in this batch
 * @property isQcRequired - Flag indicating if QC is required
 * @property qcMode - Optional QC mode (BATCHWISE or CONSOLIDATED)
 */
interface BatchTracking {
  batchNo: string;
  mrNo: string;
  operation: string;
  workCenter: string;
  warehouse: string;
  status: string;
  outputItems: ProducedItem[];
  isQcRequired: boolean;
  qcMode?: "BATCHWISE" | "CONSOLIDATED" | null;
}

// ============================================================================
// SEARCHABLE SELECT COMPONENT
// ============================================================================

/**
 * SearchableSelect Props Interface
 * 
 * Props for the SearchableSelect dropdown component.
 * 
 * @property value - Currently selected value
 * @property onValueChange - Callback when selection changes
 * @property options - Array of selectable options
 * @property placeholder - Placeholder text when no value selected
 * @property searchPlaceholder - Placeholder text in search input
 * @property emptyText - Text shown when no options match search
 * @property className - Optional CSS classes
 */
interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}

/**
 * SearchableSelect Component
 * 
 * A dropdown select component with built-in search functionality.
 * Uses Radix UI Popover and Command components for accessibility.
 * 
 * Features:
 * - Searchable dropdown with keyboard navigation
 * - Visual checkmark for selected option
 * - Accessible with ARIA attributes
 * - Responsive width matching trigger button
 * 
 * @param props - SearchableSelectProps
 * @returns JSX.Element
 */
function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-10 font-normal", className)}
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {value
              ? options.find((option) => option.value === value)?.label
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInputBorderless placeholder={searchPlaceholder} className="h-9" />
          <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    // Command component lowercases the value, so find the original
                    const selectedOption = options.find(
                      opt => opt.value.toLowerCase() === currentValue.toLowerCase()
                    );
                    if (selectedOption) {
                      onValueChange(selectedOption.value);
                    }
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MaterialRelease() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/production/material-release/:action");

  // Determine if we're on the create page
  const isCreatePage = params?.action === "new";

  // ============================================================================
  // STATE - LISTING PAGE
  // ============================================================================
  
  /**
   * searchTerm - Search input value for filtering releases
   * Searches across: Release No, Operation, Work Center
   */
  const [searchTerm, setSearchTerm] = useState("");
  
  /**
   * statusFilter - Current status filter selection
   * Default: "Sent for QC" to show pending QC items first
   * Options: "All", "Sent for QC", "Pending", "Released for WH"
   * Note: "Delivered To WH" is only visible in "All" filter
   */
  const [statusFilter, setStatusFilter] = useState("Sent for QC");
  
  /**
   * currentPage - Current page number for pagination
   * Resets to 1 when search or filter changes
   */
  const [currentPage, setCurrentPage] = useState(1);
  
  /**
   * isViewModalOpen - Controls visibility of the view release modal
   */
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  /**
   * viewingRelease - The release record currently being viewed in the modal
   * Null when modal is closed
   */
  const [viewingRelease, setViewingRelease] = useState<MaterialRelease | null>(null);
  
  /**
   * itemsPerPage - Number of releases to display per page
   * Fixed at 10 for consistent pagination
   */
  const itemsPerPage = 10;

  // ============================================================================
  // STATE - CREATE PAGE
  // ============================================================================
  
  /**
   * selectedMRNo - Currently selected Material Request number
   * Drives auto-population of operation, work center, warehouse, and requiresQC
   * Also triggers loading of related completed batches
   */
  const [selectedMRNo, setSelectedMRNo] = useState("");
  
  /**
   * selectedMR - Full MR Request object for the selected MR No
   * Used to access MR details like operation, work center, etc.
   */
  const [selectedMR, setSelectedMR] = useState<MRRequest | null>(null);
  
  /**
   * selectedBatches - Array of completed batches for the selected MR
   * Filtered to only include batches with status = "Completed"
   * Multiple batches can be combined into a single release
   */
  const [selectedBatches, setSelectedBatches] = useState<BatchTracking[]>([]);
  
  /**
   * formData - Form fields for creating a new release
   * 
   * @property releaseNo - Auto-generated release number (format: REL-YYYY-NNN)
   * @property releaseDate - Current date, auto-filled
   * @property releasedBy - Logged-in user name (from auth context)
   * @property operation - Auto-filled from selected MR
   * @property workCenter - Auto-filled from selected MR
   * @property warehouse - Auto-filled from selected MR
   * @property requiresQC - Auto-filled from selected MR, determines workflow path
   */
  const [formData, setFormData] = useState({
    releaseNo: "",
    releaseDate: getCurrentDateForInput(),
    releasedBy: "Admin User", // TODO: Get from login context
    operation: "",
    workCenter: "",
    warehouse: "",
    requiresQC: false,
  });
  
  /**
   * producedItems - Aggregated items from all selected batches
   * Items with same itemCode are summed together
   * Quantities are editable before submission
   * This represents the final items to be released
   */
  const [producedItems, setProducedItems] = useState<ProducedItem[]>([]);

  // ============================================================================
  // MOCK DATA
  // ============================================================================

  // Sample MR Requests (for dropdown)
  const mrRequests: MRRequest[] = [
    {
      mrNumber: "MR-2024-001",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      requiresQC: false,
    },
    {
      mrNumber: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      requiresQC: true,
    },
    {
      mrNumber: "MR-2024-003",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      requiresQC: true,
    },
  ];

  // Sample Batch Tracking data - Multiple batches for same MR for testing
  const batchTrackingData: BatchTracking[] = [
    {
      batchNo: "BATCH-2026-001",
      mrNo: "MR-2024-001",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      status: "Completed",
      isQcRequired: false,
      outputItems: [
        { id: 1, itemCode: "FG001", itemName: "Steel Plate Cut", uom: "PCS", qtyProduced: 50 },
        { id: 2, itemCode: "FG002", itemName: "Steel Rod Cut", uom: "PCS", qtyProduced: 100 },
      ]
    },
    {
      batchNo: "BATCH-2026-002",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      status: "Completed",
      isQcRequired: true,
      qcMode: "BATCHWISE",
      outputItems: [
        { id: 3, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 25 },
      ]
    },
    {
      batchNo: "BATCH-2026-003",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      status: "Completed",
      isQcRequired: true,
      qcMode: "BATCHWISE",
      outputItems: [
        { id: 4, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 30 },
        { id: 5, itemCode: "FG006", itemName: "Welded Bracket", uom: "PCS", qtyProduced: 15 },
      ]
    },
    {
      batchNo: "BATCH-2026-004",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      status: "Completed",
      isQcRequired: true,
      qcMode: "BATCHWISE",
      outputItems: [
        { id: 6, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 20 },
      ]
    },
    {
      batchNo: "BATCH-2026-005",
      mrNo: "MR-2024-003",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      status: "Completed",
      isQcRequired: true,
      qcMode: "CONSOLIDATED",
      outputItems: [
        { id: 7, itemCode: "FG004", itemName: "Assembled Unit", uom: "PCS", qtyProduced: 10 },
        { id: 8, itemCode: "FG005", itemName: "Sub Assembly", uom: "PCS", qtyProduced: 20 },
      ]
    },
  ];

  // Sample material releases data - Comprehensive test data
  const [releases, setReleases] = useState<MaterialRelease[]>([
    // ========== SENT FOR QC STATUS ==========
    {
      id: 1,
      releaseNo: "REL-2026-001",
      releaseDate: "2026-02-10",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      releasedBy: "John Doe",
      requiresQC: true,
      status: "Sent for QC",
      qcRequestId: 1,
      items: [
        { id: 1, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 25 },
      ]
    },
    {
      id: 2,
      releaseNo: "REL-2026-002",
      releaseDate: "2026-02-11",
      mrNo: "MR-2024-003",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      releasedBy: "Jane Smith",
      requiresQC: true,
      status: "Sent for QC",
      qcRequestId: 2,
      items: [
        { id: 2, itemCode: "FG004", itemName: "Assembled Unit", uom: "PCS", qtyProduced: 10 },
        { id: 3, itemCode: "FG005", itemName: "Sub Assembly", uom: "PCS", qtyProduced: 20 },
      ]
    },
    {
      id: 3,
      releaseNo: "REL-2026-003",
      releaseDate: "2026-02-12",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      releasedBy: "Admin User",
      requiresQC: true,
      status: "Sent for QC",
      qcRequestId: 3,
      items: [
        { id: 4, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 30 },
        { id: 5, itemCode: "FG006", itemName: "Welded Bracket", uom: "PCS", qtyProduced: 15 },
        { id: 6, itemCode: "FG007", itemName: "Welded Support", uom: "PCS", qtyProduced: 40 },
      ]
    },

    // ========== PENDING STATUS (Verified QC, Pending WH Release) ==========
    {
      id: 4,
      releaseNo: "REL-2026-004",
      releaseDate: "2026-02-13",
      mrNo: "MR-2024-003",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      releasedBy: "John Doe",
      requiresQC: true,
      status: "Pending",
      qcRequestId: 4,
      qcVerifiedBy: "QC Inspector - Sarah Lee",
      qcVerifiedOn: "2026-02-14",
      items: [
        { id: 7, itemCode: "FG004", itemName: "Assembled Unit", uom: "PCS", qtyProduced: 10, verifiedQty: 9 },
      ]
    },
    {
      id: 5,
      releaseNo: "REL-2026-005",
      releaseDate: "2026-02-14",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      releasedBy: "Jane Smith",
      requiresQC: true,
      status: "Pending",
      qcRequestId: 5,
      qcVerifiedBy: "QC Inspector - Mike Chen",
      qcVerifiedOn: "2026-02-15",
      items: [
        { id: 8, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 50, verifiedQty: 48 },
        { id: 9, itemCode: "FG006", itemName: "Welded Bracket", uom: "PCS", qtyProduced: 25, verifiedQty: 25 },
      ]
    },
    {
      id: 6,
      releaseNo: "REL-2026-006",
      releaseDate: "2026-02-15",
      mrNo: "MR-2024-003",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      releasedBy: "Admin User",
      requiresQC: true,
      status: "Pending",
      qcRequestId: 6,
      qcVerifiedBy: "QC Inspector - Sarah Lee",
      qcVerifiedOn: "2026-02-16",
      items: [
        { id: 10, itemCode: "FG004", itemName: "Assembled Unit", uom: "PCS", qtyProduced: 15, verifiedQty: 14 },
        { id: 11, itemCode: "FG005", itemName: "Sub Assembly", uom: "PCS", qtyProduced: 30, verifiedQty: 28 },
        { id: 12, itemCode: "FG008", itemName: "Final Product", uom: "PCS", qtyProduced: 8, verifiedQty: 8 },
      ]
    },
    {
      id: 7,
      releaseNo: "REL-2026-007",
      releaseDate: "2026-02-16",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      releasedBy: "John Doe",
      requiresQC: true,
      status: "Pending",
      qcRequestId: 7,
      qcVerifiedBy: "QC Inspector - Mike Chen",
      qcVerifiedOn: "2026-02-17",
      items: [
        { id: 13, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 100, verifiedQty: 95 },
        { id: 14, itemCode: "FG006", itemName: "Welded Bracket", uom: "PCS", qtyProduced: 50, verifiedQty: 49 },
        { id: 15, itemCode: "FG007", itemName: "Welded Support", uom: "PCS", qtyProduced: 75, verifiedQty: 72 },
        { id: 16, itemCode: "FG009", itemName: "Welded Base", uom: "PCS", qtyProduced: 20, verifiedQty: 20 },
      ]
    },

    // ========== RELEASED TO WH STATUS (No QC Required) ==========
    {
      id: 8,
      releaseNo: "REL-2026-008",
      releaseDate: "2026-02-17",
      mrNo: "MR-2024-001",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      releasedBy: "Jane Smith",
      requiresQC: false,
      status: "Released for WH",
      items: [
        { id: 17, itemCode: "FG001", itemName: "Steel Plate Cut", uom: "PCS", qtyProduced: 50 },
        { id: 18, itemCode: "FG002", itemName: "Steel Rod Cut", uom: "PCS", qtyProduced: 100 },
      ]
    },
    {
      id: 9,
      releaseNo: "REL-2026-009",
      releaseDate: "2026-02-18",
      mrNo: "MR-2024-001",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      releasedBy: "Admin User",
      requiresQC: false,
      status: "Released for WH",
      items: [
        { id: 19, itemCode: "FG001", itemName: "Steel Plate Cut", uom: "PCS", qtyProduced: 75 },
      ]
    },
    {
      id: 10,
      releaseNo: "REL-2026-010",
      releaseDate: "2026-02-19",
      mrNo: "MR-2024-001",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      releasedBy: "John Doe",
      requiresQC: false,
      status: "Released for WH",
      items: [
        { id: 20, itemCode: "FG001", itemName: "Steel Plate Cut", uom: "PCS", qtyProduced: 60 },
        { id: 21, itemCode: "FG002", itemName: "Steel Rod Cut", uom: "PCS", qtyProduced: 120 },
        { id: 22, itemCode: "FG010", itemName: "Steel Tube Cut", uom: "PCS", qtyProduced: 80 },
      ]
    },

    // ========== RELEASED FOR WH STATUS (After QC Verification) ==========
    {
      id: 11,
      releaseNo: "REL-2026-011",
      releaseDate: "2026-02-17",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      releasedBy: "Jane Smith",
      requiresQC: true,
      status: "Released for WH",
      qcRequestId: 8,
      qcVerifiedBy: "QC Inspector - Mike Chen",
      qcVerifiedOn: "2026-02-18",
      items: [
        { id: 23, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 40, verifiedQty: 38 },
        { id: 24, itemCode: "FG006", itemName: "Welded Bracket", uom: "PCS", qtyProduced: 20, verifiedQty: 20 },
      ]
    },
    {
      id: 12,
      releaseNo: "REL-2026-012",
      releaseDate: "2026-02-18",
      mrNo: "MR-2024-003",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      releasedBy: "Admin User",
      requiresQC: true,
      status: "Released for WH",
      qcRequestId: 9,
      qcVerifiedBy: "QC Inspector - Sarah Lee",
      qcVerifiedOn: "2026-02-19",
      items: [
        { id: 25, itemCode: "FG004", itemName: "Assembled Unit", uom: "PCS", qtyProduced: 12, verifiedQty: 12 },
      ]
    },
    {
      id: 18,
      releaseNo: "REL-2026-018",
      releaseDate: "2026-02-20",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      releasedBy: "John Doe",
      requiresQC: true,
      status: "Released for WH",
      qcRequestId: 14,
      // No qcVerifiedBy or qcVerifiedOn - QC not completed yet
      items: [
        { id: 39, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 35, verifiedQty: 35 },
        { id: 40, itemCode: "FG006", itemName: "Welded Bracket", uom: "PCS", qtyProduced: 18, verifiedQty: 18 },
      ]
    },

    // ========== DELIVERED TO WH STATUS (Warehouse Received) ==========
    {
      id: 13,
      releaseNo: "REL-2026-013",
      releaseDate: "2026-02-15",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      releasedBy: "John Doe",
      requiresQC: true,
      status: "Delivered To WH",
      qcRequestId: 10,
      qcVerifiedBy: "QC Inspector - Mike Chen",
      qcVerifiedOn: "2026-02-14",
      items: [
        { id: 26, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 30, verifiedQty: 28 },
        { id: 27, itemCode: "FG006", itemName: "Welded Bracket", uom: "PCS", qtyProduced: 15, verifiedQty: 15 },
      ]
    },
    {
      id: 14,
      releaseNo: "REL-2026-014",
      releaseDate: "2026-02-16",
      mrNo: "MR-2024-003",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      releasedBy: "Jane Smith",
      requiresQC: true,
      status: "Delivered To WH",
      qcRequestId: 11,
      qcVerifiedBy: "QC Inspector - Sarah Lee",
      qcVerifiedOn: "2026-02-15",
      items: [
        { id: 28, itemCode: "FG004", itemName: "Assembled Unit", uom: "PCS", qtyProduced: 20, verifiedQty: 19 },
        { id: 29, itemCode: "FG005", itemName: "Sub Assembly", uom: "PCS", qtyProduced: 40, verifiedQty: 38 },
        { id: 30, itemCode: "FG008", itemName: "Final Product", uom: "PCS", qtyProduced: 10, verifiedQty: 10 },
      ]
    },
    {
      id: 15,
      releaseNo: "REL-2026-015",
      releaseDate: "2026-02-17",
      mrNo: "MR-2024-001",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      releasedBy: "Admin User",
      requiresQC: false,
      status: "Delivered To WH",
      items: [
        { id: 31, itemCode: "FG001", itemName: "Steel Plate Cut", uom: "PCS", qtyProduced: 90 },
        { id: 32, itemCode: "FG002", itemName: "Steel Rod Cut", uom: "PCS", qtyProduced: 150 },
      ]
    },
    {
      id: 16,
      releaseNo: "REL-2026-016",
      releaseDate: "2026-02-18",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      releasedBy: "John Doe",
      requiresQC: true,
      status: "Delivered To WH",
      qcRequestId: 12,
      qcVerifiedBy: "QC Inspector - Mike Chen",
      qcVerifiedOn: "2026-02-17",
      items: [
        { id: 33, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 55, verifiedQty: 52 },
        { id: 34, itemCode: "FG006", itemName: "Welded Bracket", uom: "PCS", qtyProduced: 30, verifiedQty: 29 },
        { id: 35, itemCode: "FG007", itemName: "Welded Support", uom: "PCS", qtyProduced: 45, verifiedQty: 44 },
        { id: 36, itemCode: "FG009", itemName: "Welded Base", uom: "PCS", qtyProduced: 25, verifiedQty: 25 },
      ]
    },
    {
      id: 17,
      releaseNo: "REL-2026-017",
      releaseDate: "2026-02-19",
      mrNo: "MR-2024-003",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      releasedBy: "Jane Smith",
      requiresQC: true,
      status: "Delivered To WH",
      qcRequestId: 13,
      qcVerifiedBy: "QC Inspector - Sarah Lee",
      qcVerifiedOn: "2026-02-18",
      items: [
        { id: 37, itemCode: "FG004", itemName: "Assembled Unit", uom: "PCS", qtyProduced: 25, verifiedQty: 24 },
      ]
    },
  ]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Effect: Reset pagination when search or filter changes
   * 
   * Ensures user always sees page 1 when they change search term or status filter.
   * Prevents showing empty pages when filtered results are fewer than current page.
   * 
   * Dependencies: searchTerm, statusFilter
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  /**
   * Effect: Generate release number when entering create page
   * 
   * Auto-generates the next sequential release number based on existing releases.
   * Also ensures release date is set to current date.
   * Only runs when navigating to the create page (isCreatePage becomes true).
   * 
   * Dependencies: isCreatePage
   * Note: releases dependency is intentionally omitted to prevent re-generation
   */
  useEffect(() => {
    if (isCreatePage) {
      setFormData(prev => ({
        ...prev,
        releaseNo: generateReleaseNumber(releases),
        releaseDate: getCurrentDateForInput(),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreatePage]);

  /**
   * Effect: Handle MR No selection - auto-fill related fields and load batches
   * 
   * When user selects an MR No from the dropdown:
   * 1. Finds the full MR object from mrRequests
   * 2. Auto-fills form fields: operation, work center, warehouse, requiresQC
   * 3. Loads all completed batches for this MR from batch tracking
   * 4. Only batches with status = "Completed" are included
   * 
   * When user clears the MR No selection:
   * 1. Resets all auto-filled fields to empty
   * 2. Clears selected batches
   * 3. Clears produced items
   * 
   * This creates a cascading effect where selecting an MR automatically
   * populates all related data needed for the release.
   * 
   * Dependencies: selectedMRNo
   */
  useEffect(() => {
    if (selectedMRNo) {
      const mr = mrRequests.find(m => m.mrNumber === selectedMRNo);
      if (mr) {
        setSelectedMR(mr);
        // Auto-fill operation, work center, warehouse, requiresQC
        setFormData(prev => ({
          ...prev,
          operation: mr.operation,
          workCenter: mr.workCenter,
          warehouse: mr.warehouse,
          requiresQC: mr.requiresQC,
        }));

        // Load batches related to this MR - only Completed batches
        const relatedBatches = batchTrackingData.filter(
          b => b.mrNo === selectedMRNo && b.status === "Completed"
        );
        setSelectedBatches(relatedBatches);
      }
    } else {
      setSelectedMR(null);
      // Reset when MR is cleared
      setFormData(prev => ({
        ...prev,
        operation: "",
        workCenter: "",
        warehouse: "",
        requiresQC: false,
      }));
      setSelectedBatches([]);
      setProducedItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMRNo]);

  /**
   * Effect: Generate produced items by aggregating output from all selected batches
   * 
   * This effect consolidates items from multiple batches into a single list:
   * 1. Iterates through all selected batches
   * 2. For each batch, processes its output items
   * 3. Groups items by itemCode (same items from different batches are combined)
   * 4. Sums quantities for items with the same itemCode
   * 5. Creates a final aggregated list of produced items
   * 
   * Example:
   * - Batch 1: FG003 (25 PCS), FG006 (15 PCS)
   * - Batch 2: FG003 (30 PCS), FG007 (40 PCS)
   * - Result: FG003 (55 PCS), FG006 (15 PCS), FG007 (40 PCS)
   * 
   * This allows multiple batches to be released together as a single release,
   * which is useful for consolidated QC or warehouse operations.
   * 
   * Dependencies: selectedBatches
   */
  useEffect(() => {
    if (selectedBatches.length > 0) {
      // Group items by itemCode and sum quantities
      const itemsMap = new Map<string, ProducedItem>();

      selectedBatches.forEach(batch => {
        batch.outputItems.forEach(item => {
          const existing = itemsMap.get(item.itemCode);
          if (existing) {
            // Sum quantities for same item
            existing.qtyProduced += item.qtyProduced;
          } else {
            // Add new item
            itemsMap.set(item.itemCode, {
              id: item.id,
              itemCode: item.itemCode,
              itemName: item.itemName,
              uom: item.uom,
              qtyProduced: item.qtyProduced,
            });
          }
        });
      });

      // Convert map to array
      const aggregatedItems = Array.from(itemsMap.values());
      setProducedItems(aggregatedItems);
    } else {
      setProducedItems([]);
    }
  }, [selectedBatches]);

  // ============================================================================
  // HANDLERS - LISTING PAGE
  // ============================================================================

  /**
   * Handle View Release Action
   * 
   * Opens the view modal to display release details. Modal behavior varies by status:
   * - "Sent for QC": Read-only view showing release is awaiting QC verification
   * - "Pending": Shows QC verification details + "Release" button to release to warehouse
   * - "Released for WH": Read-only view showing release is awaiting warehouse receipt
   * - "Delivered To WH": Read-only view showing completed delivery
   * 
   * @param release - The MaterialRelease record to view
   */
  const handleViewRelease = (release: MaterialRelease) => {
    setViewingRelease(release);
    setIsViewModalOpen(true);
  };

  /**
   * Handle Add Release Button Click
   * 
   * Navigates to the create page where user can create a new material release.
   * URL changes to /production/material-release/new which triggers isCreatePage = true.
   */
  const handleAddRelease = () => {
    setLocation("/production/material-release/new");
  };

  /**
   * Handle Release Action for "Pending" Status (Verified QC)
   * 
   * This function is called when the user clicks the "Release" button in the
   * view modal for a release with status "Pending" (QC verified, pending WH release).
   * 
   * WORKFLOW:
   * 1. Update release status from "Pending" to "Released for WH"
   * 2. Keep all QC verification data (qcVerifiedBy, qcVerifiedOn, verifiedQty)
   * 3. Close the modal popup
   * 4. Refresh the listing (React state update triggers re-render)
   * 5. Show success toast notification
   * 6. Release moves from "Verified QC" tab to "Released for WH" tab
   * 
   * STATUS TRANSITION:
   * "Pending" → "Released for WH"
   * 
   * NEXT STEP:
   * Warehouse module will mark as received, changing status to "Delivered To WH"
   * 
   * @param release - The MaterialRelease record to release to warehouse
   */
  const handleReleaseFromVerifiedQC = (release: MaterialRelease) => {
    // Update the release status to "Released for WH"
    // Preserve all existing data including QC verification details
    const updatedRelease: MaterialRelease = {
      ...release,
      status: "Released for WH",
    };

    // Update releases array in state
    // This triggers re-render and moves record to "Released for WH" tab
    setReleases(releases.map(r => 
      r.id === release.id ? updatedRelease : r
    ));

    // Close the modal
    setIsViewModalOpen(false);

    // Show success notification to user
    toast({
      title: "Success",
      description: `${release.releaseNo} released to warehouse successfully.`,
    });

    // TODO: In real implementation, this would also:
    // - Create warehouse receipt record
    // - Update stock buckets (move from QC stock to WH pending stock)
    // - Send notification to warehouse team
    console.log("Release sent to warehouse:", updatedRelease.releaseNo);
  };

  // ============================================================================
  // HANDLERS - CREATE PAGE
  // ============================================================================

  /**
   * Handle Cancel Button Click
   * 
   * Navigates back to the listing page and resets all form state.
   * Discards any unsaved changes without confirmation.
   * 
   * Actions performed:
   * 1. Navigates to /production/material-release (listing page)
   * 2. Clears selected MR No
   * 3. Clears selected batches
   * 4. Clears produced items
   * 
   * Note: Consider adding a confirmation dialog if user has made changes
   */
  const handleCancel = () => {
    setLocation("/production/material-release");
    // Reset form
    setSelectedMRNo("");
    setSelectedBatches([]);
    setProducedItems([]);
  };

  /**
   * Handle Quantity Produced Change with Validation
   * 
   * Allows user to edit the produced quantity for each item before submission.
   * Useful for adjusting quantities if some items were damaged or need correction.
   * 
   * Validation rules:
   * - Must be numeric (non-numeric input defaults to 0)
   * - Must be >= 0 (negative values rejected)
   * - Max 6 digits (999999) to prevent unrealistic values
   * 
   * @param itemCode - The item code to update
   * @param newQty - The new quantity value (as string from input)
   */
  const handleQtyProducedChange = (itemCode: string, newQty: string) => {
    // Parse and validate
    const qty = Number(newQty) || 0;
    
    // Validation: >= 0 and max 6 digits
    if (qty >= 0 && qty <= 999999) {
      setProducedItems(items =>
        items.map(item =>
          item.itemCode === itemCode ? { ...item, qtyProduced: qty } : item
        )
      );
    }
  };

  /**
   * Handle Submit - Create Material Release
   * 
   * This function creates a new material release record when the user clicks
   * "Send For QC" or "Release" button on the create page.
   * 
   * VALIDATION STEPS:
   * 1. MR No must be selected
   * 2. At least one batch must be selected (auto-selected when MR is chosen)
   * 3. At least one item must have qtyProduced > 0
   * 
   * WORKFLOW BRANCHING:
   * 
   * IF requiresQC = true:
   *   - Set status = "Sent for QC"
   *   - Generate qcRequestId
   *   - Create QC Request record (links to this release)
   *   - Move items to QC stock bucket
   *   - Release appears in "Sent QC" tab
   *   - Next step: QC module verifies quantities
   * 
   * IF requiresQC = false:
   *   - Set status = "Released for WH"
   *   - No qcRequestId needed
   *   - Skip QC verification entirely
   *   - Release appears in "Released for WH" tab
   *   - Next step: Warehouse receives items
   * 
   * POST-CREATION:
   * - Show success toast with appropriate message
   * - Navigate back to listing page
   * - Reset form state
   * - New release appears in appropriate tab based on status
   */
  const handleSubmit = () => {
    // ========== VALIDATION PHASE ==========
    
    // Validation 1: MR No must be selected
    if (!selectedMRNo) {
      toast({
        title: "Validation Error",
        description: "Please select an MR No",
        variant: "destructive",
      });
      return;
    }

    // Validation 2: At least one batch must be selected
    // (Batches are auto-loaded when MR is selected, but check anyway)
    if (selectedBatches.length === 0) {
      toast({
        title: "Validation Error",
        description: "No batches selected for this MR",
        variant: "destructive",
      });
      return;
    }

    // Validation 3: At least one item must have qtyProduced > 0
    if (producedItems.length === 0 || !producedItems.some(item => item.qtyProduced > 0)) {
      toast({
        title: "Validation Error",
        description: "No produced items found or all quantities are zero",
        variant: "destructive",
      });
      return;
    }

    // ========== STATUS DETERMINATION ==========
    
    // Determine initial status based on QC requirement
    // requiresQC = true  → "Sent for QC" (goes to QC module first)
    // requiresQC = false → "Released for WH" (goes directly to warehouse)
    const status = formData.requiresQC ? "Sent for QC" : "Released for WH";
    
    // Generate QC Request ID only if QC is required
    // This links the release to a QC verification request
    const qcRequestId = formData.requiresQC ? releases.length + 100 : undefined;

    // ========== CREATE RELEASE RECORD ==========
    
    // Create new MaterialRelease record with all form data
    const newRelease: MaterialRelease = {
      id: releases.length + 1,
      releaseNo: formData.releaseNo,
      releaseDate: formData.releaseDate,
      mrNo: selectedMRNo,
      operation: formData.operation,
      workCenter: formData.workCenter,
      warehouse: formData.warehouse,
      releasedBy: formData.releasedBy,
      requiresQC: formData.requiresQC,
      status: status as "Sent for QC" | "Released for WH",
      items: producedItems,
      qcRequestId: qcRequestId,
      // Note: qcVerifiedBy and qcVerifiedOn are undefined initially
      // They will be set by QC module after verification
    };

    // Add new release to state
    setReleases([...releases, newRelease]);

    // ========== QC ROUTING (if required) ==========
    
    // If QC is required, perform additional QC-related actions
    if (formData.requiresQC) {
      // TODO: In real implementation, this would:
      // 1. Create QCRequest record in database (linked to releaseId)
      // 2. Move qtyProduced to QC stock bucket (inventory transaction)
      // 3. Send notification to QC team
      // 4. Update batch status to "Sent for QC"
      console.log("Creating QC Request for release:", newRelease.releaseNo);
      console.log("Moving items to QC stock bucket");
      console.log("QC Request ID:", qcRequestId);
    } else {
      // TODO: In real implementation, this would:
      // 1. Move qtyProduced directly to WH pending stock bucket
      // 2. Send notification to warehouse team
      // 3. Update batch status to "Released"
      console.log("Releasing directly to warehouse:", newRelease.releaseNo);
      console.log("Moving items to WH pending stock bucket");
    }

    // ========== SUCCESS FEEDBACK ==========
    
    // Show appropriate success message based on QC requirement
    const successMessage = formData.requiresQC 
      ? "Material sent for QC successfully." 
      : "Material released successfully.";
    
    toast({
      title: "Success",
      description: successMessage,
    });

    // ========== NAVIGATION & CLEANUP ==========
    
    // Navigate back to listing page
    setLocation("/production/material-release");
    
    // Reset all form state
    setSelectedMRNo("");
    setSelectedMR(null);
    setSelectedBatches([]);
    setProducedItems([]);
  };

  // ============================================================================
  // FILTERING & PAGINATION
  // ============================================================================

  /**
   * Filter releases based on search term and status filter
   * 
   * SEARCH MATCHING:
   * - Searches across: Release No, Operation, Work Center
   * - Case-insensitive matching
   * 
   * STATUS FILTERING:
   * - "All": Shows all releases regardless of status
   * - "Sent for QC": Shows only releases with status = "Sent for QC"
   * - "Pending": Shows only releases with status = "Pending" (Verified QC)
   * - "Released for WH": Shows only releases with status = "Released for WH"
   * 
   * Note: "Delivered To WH" status is only visible in "All" filter
   * (not shown in specific status tabs)
   */
  const filteredReleases = releases.filter(release => {
    // Search term matching (case-insensitive)
    const matchesSearch = 
      release.releaseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.operation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.workCenter.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter matching
    // "All" shows everything, otherwise match exact status
    const matchesStatus = statusFilter === "All" || release.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  /**
   * Calculate pagination values
   * - Total pages based on filtered results
   * - Current page slice of data to display
   */
  const totalPages = Math.ceil(filteredReleases.length / itemsPerPage);
  const paginatedData = filteredReleases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ============================================================================
  // RENDER - CREATE PAGE
  // ============================================================================
  // 
  // The create page allows users to create a new material release from completed
  // production batches. The page is divided into sections:
  // 
  // 1. Header Summary Card: Shows release metadata (auto-filled and user-selected)
  // 2. Selected Batches Section: Lists all completed batches for the selected MR
  // 3. Produced Items Table: Shows aggregated items from all batches (editable quantities)
  // 4. Bottom Buttons: Cancel and Submit (Send For QC or Release)
  // 
  // The form uses cascading auto-fill:
  // - Select MR No → Auto-fills operation, work center, warehouse, requiresQC
  // - Auto-fills → Loads completed batches for that MR
  // - Batches loaded → Aggregates output items into produced items
  // 
  // Submit button is disabled until all required data is present and valid.
  // ============================================================================

  if (isCreatePage) {
    // ========== CREATE PAGE BUTTON LOGIC ==========
    
    /**
     * Primary Button State Logic
     * 
     * Button is DISABLED when any of these conditions are true:
     * 1. No MR selected (selectedMRNo is empty)
     * 2. No batches selected (selectedBatches.length === 0)
     * 3. No produced items (producedItems.length === 0)
     * 4. All produced items have qtyProduced = 0
     * 
     * Button is ENABLED when:
     * - MR is selected
     * - At least one batch is selected (auto-selected when MR is chosen)
     * - At least one item exists in produced items
     * - At least one item has qtyProduced > 0
     */
    const isPrimaryButtonDisabled = 
      !selectedMRNo || 
      selectedBatches.length === 0 || 
      producedItems.length === 0 || 
      !producedItems.some(item => item.qtyProduced > 0);

    /**
     * Primary Button Label Logic
     * 
     * Button label changes based on requiresQC flag:
     * - requiresQC = true  → "Send For QC" (will route to QC module)
     * - requiresQC = false → "Release" (will go directly to warehouse)
     * 
     * This provides clear user feedback about what will happen on submit
     */
    const primaryButtonLabel = formData.requiresQC ? "Send For QC" : "Release";

    return (
      <div className="flex flex-col gap-6 h-full">
        {/* Page Header with Back Button */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleCancel} className="h-8 w-8">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Create Material Release</h1>
        </div>

        {/* Header Summary Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Auto-filled fields (read-only) */}
              <div>
                <Label>Release No</Label>
                <Input value={formData.releaseNo} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Release Date</Label>
                <Input 
                  type="date" 
                  value={formData.releaseDate} 
                  readOnly 
                  className="bg-muted" 
                />
              </div>
              <div>
                <Label>Released By</Label>
                <Input value={formData.releasedBy} readOnly className="bg-muted" />
              </div>

              {/* MR No selection (required) */}
              <div>
                <Label>
                  MR No <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  value={selectedMRNo}
                  onValueChange={setSelectedMRNo}
                  options={mrRequests.map(mr => ({
                    value: mr.mrNumber,
                    label: mr.mrNumber,
                  }))}
                  placeholder="Select MR No"
                  searchPlaceholder="Search MR..."
                  emptyText="No MR found"
                />
              </div>

              {/* Auto-filled from MR (read-only) */}
              <div>
                <Label>Operation</Label>
                <Input value={formData.operation} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Work Center</Label>
                <Input value={formData.workCenter} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Warehouse</Label>
                <Input value={formData.warehouse} readOnly className="bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Batches Section */}
        <Card>
          <CardHeader>
            <CardTitle>Selected Batches</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedMRNo ? (
              <div className="text-center py-12 text-muted-foreground">
                Please select an MR No to view related batches
              </div>
            ) : selectedBatches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No batches found for this MR
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Batch No</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Work Center</TableHead>
                      <TableHead>Items Produced</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedBatches.map((batch) => {
                      // Determine QC status badge value
                      let qcStatusValue = "-";
                      if (batch.isQcRequired) {
                        qcStatusValue = batch.qcMode === "BATCHWISE" ? "Yes" : "No";
                      }
                      
                      return (
                        <TableRow key={batch.batchNo}>
                          <TableCell className="font-medium">{batch.batchNo}</TableCell>
                          <TableCell>{batch.operation}</TableCell>
                          <TableCell>{batch.workCenter}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {batch.outputItems.map((item, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="font-medium">{item.itemCode}:</span>{" "}
                                  <span className="text-muted-foreground">{item.qtyProduced} {item.uom}</span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {qcStatusValue}
                            </Badge>
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

        {/* Produced Items Table - Shows total quantities across all batches */}
        <Card>
          <CardHeader>
            <CardTitle>Produced Items</CardTitle>
          </CardHeader>
          <CardContent>
            {producedItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No produced items to display
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Item</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead>Total Qty Produced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {producedItems.map((item) => (
                      <TableRow key={item.itemCode}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.itemCode}</div>
                            <div className="text-sm text-muted-foreground">{item.itemName}</div>
                          </div>
                        </TableCell>
                        <TableCell>{item.uom}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.qtyProduced}
                            onChange={(e) => handleQtyProducedChange(item.itemCode, e.target.value)}
                            className="w-28 h-9"
                            min="0"
                            max="999999"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Buttons */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPrimaryButtonDisabled}>
            {primaryButtonLabel}
          </Button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER - LISTING PAGE
  // ============================================================================
  // 
  // The listing page displays all material releases in a searchable, filterable table.
  // 
  // Layout sections:
  // 1. Page Header: Title and description
  // 2. Search and Filter Bar: Search input, status dropdown, Add Release button
  // 3. Material Releases Table: Paginated list of releases with View action
  // 4. Pagination Controls: Previous/Next buttons and entry count
  // 5. View Release Modal: Popup showing release details (behavior varies by status)
  // 
  // Status-based tab filtering:
  // - "Sent QC": Shows releases awaiting QC verification
  // - "Verified QC": Shows QC-verified releases with Release button
  // - "Released for WH": Shows releases awaiting warehouse receipt
  // - "All": Shows all releases including "Delivered To WH"
  // 
  // View modal behavior:
  // - "Sent for QC": Read-only view
  // - "Pending": Shows QC details + Release button
  // - "Released for WH": Read-only view
  // - "Delivered To WH": Read-only view
  // ============================================================================

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Material Release</h1>
        <p className="text-muted-foreground">
          Release produced output from production operations
        </p>
      </div>

      {/* Search and Filter Section */}
      <div className="flex flex-col sm:flex-row items-end gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="w-full sm:flex-1">
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Release No / Operation / Work Center..."
              className="pl-9 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="w-full sm:w-48">
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Status
          </Label>
          <SearchableSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { value: "All", label: "All" },
              { value: "Sent for QC", label: "Sent QC" },
              { value: "Pending", label: "Verified QC" },
              { value: "Released for WH", label: "Released for WH" },
            ]}
            placeholder="Select Status"
            searchPlaceholder="Search status..."
          />
        </div>

        <div className="w-full sm:w-auto">
          <Button onClick={handleAddRelease}>
            <Plus className="mr-2 h-4 w-4" />
            Add Release
          </Button>
        </div>
      </div>

      {/* Material Releases Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Material Releases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Release On</TableHead>
                  <TableHead>Release No</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Work Center</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No material releases found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((release) => (
                    <TableRow key={release.id}>
                      <TableCell>{formatDate(release.releaseDate)}</TableCell>
                      <TableCell className="font-medium">{release.releaseNo}</TableCell>
                      <TableCell>{release.operation}</TableCell>
                      <TableCell>{release.workCenter}</TableCell>
                      <TableCell>{release.warehouse}</TableCell>
                      <TableCell>
                        {/* Badge color varies by status:
                            - "Sent for QC": default (blue) - awaiting QC verification
                            - "Pending": secondary (gray) - QC verified, pending WH release
                            - "Released for WH": outline (white) - awaiting warehouse receipt
                            - "Delivered To WH": default (blue) - completed delivery
                            
                            Note: "Pending" status displays as "Pending" in badge
                            (internal status is "Pending" but represents QC-verified state)
                        */}
                        <Badge variant={
                          release.status === "Sent for QC" ? "default" :
                          release.status === "Pending" ? "secondary" :
                          release.status === "Released for WH" ? "outline" :
                          release.status === "Delivered To WH" ? "default" :
                          "default"
                        }>
                          {release.status === "Pending" ? "Pending" : release.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-muted"
                          onClick={() => handleViewRelease(release)}
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

          {/* Pagination */}
          {filteredReleases.length > 0 && (
            <div className="flex justify-between items-center px-1 mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredReleases.length)} of{" "}
                {filteredReleases.length} entries
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || totalPages === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Release Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Material Release Details</DialogTitle>
            <DialogDescription>
              {viewingRelease?.status === "Pending" 
                ? "View verified material release details and release to warehouse" 
                : viewingRelease?.status === "Released for WH"
                ? "View material release details (read-only)"
                : viewingRelease?.status === "Delivered To WH"
                ? "View delivered material release details (read-only)"
                : "View details of material release"}
            </DialogDescription>
          </DialogHeader>
          {viewingRelease && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Release No</Label>
                  <p className="font-medium">{viewingRelease.releaseNo}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Release Date</Label>
                  <p className="font-medium">{formatDate(viewingRelease.releaseDate)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge variant={
                    viewingRelease.status === "Sent for QC" ? "default" :
                    viewingRelease.status === "Pending" ? "secondary" :
                    viewingRelease.status === "Released for WH" ? "outline" :
                    viewingRelease.status === "Delivered To WH" ? "default" :
                    "default"
                  }>
                    {viewingRelease.status === "Pending" ? "Pending" : viewingRelease.status}
                  </Badge>
                </div>
                {viewingRelease.requiresQC && (
                  <div>
                    <Label className="text-xs text-muted-foreground">QC Status</Label>
                    <Badge variant={
                      viewingRelease.status === "Sent for QC" ? "destructive" : "default"
                    }>
                      {viewingRelease.status === "Sent for QC" ? "Pending" : "Verified"}
                    </Badge>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">MR No</Label>
                  <p className="font-medium">{viewingRelease.mrNo}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Operation</Label>
                  <p className="font-medium">{viewingRelease.operation}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Work Center</Label>
                  <p className="font-medium">{viewingRelease.workCenter}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Warehouse</Label>
                  <p className="font-medium">{viewingRelease.warehouse}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Released By</Label>
                  <p className="font-medium">{viewingRelease.releasedBy}</p>
                </div>
                {viewingRelease.requiresQC && viewingRelease.qcVerifiedBy && (
                  <div>
                    <Label className="text-xs text-muted-foreground">QC Verified By</Label>
                    <p className="font-medium">{viewingRelease.qcVerifiedBy}</p>
                  </div>
                )}
                {viewingRelease.requiresQC && viewingRelease.qcVerifiedOn && (
                  <div>
                    <Label className="text-xs text-muted-foreground">QC Verified On</Label>
                    <p className="font-medium">{formatDate(viewingRelease.qcVerifiedOn)}</p>
                  </div>
                )}
              </div>

              {/* Produced Items Table - Conditional columns based on status
              
                  COLUMNS SHOWN:
                  - Always: Item, Qty Produced
                  - Conditionally: Verified Qty (only if requiresQC AND status is post-QC)
                  
                  VERIFIED QTY COLUMN LOGIC:
                  - Shows when: requiresQC = true AND status in ["Pending", "Released for WH", "Delivered To WH"]
                  - Hidden when: requiresQC = false OR status = "Sent for QC"
                  
                  WHY:
                  - "Sent for QC": QC not yet verified, no verifiedQty available
                  - "Pending": QC verified, show verifiedQty
                  - "Released for WH": QC verified, show verifiedQty
                  - "Delivered To WH": QC verified, show verifiedQty
                  - No QC required: verifiedQty not applicable
              */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Produced Items</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item</TableHead>
                        <TableHead>Qty Produced</TableHead>
                        {/* Conditionally show Verified Qty column */}
                        {viewingRelease.requiresQC && 
                         (viewingRelease.status === "Pending" || 
                          viewingRelease.status === "Released for WH" || 
                          viewingRelease.status === "Delivered To WH") && (
                          <TableHead>Verified Qty</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingRelease.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.itemCode}</div>
                              <div className="text-sm text-muted-foreground">{item.itemName}</div>
                              <div className="text-xs text-muted-foreground">{item.uom}</div>
                            </div>
                          </TableCell>
                          <TableCell>{item.qtyProduced}</TableCell>
                          {/* Conditionally show Verified Qty cell */}
                          {viewingRelease.requiresQC && 
                           (viewingRelease.status === "Pending" || 
                            viewingRelease.status === "Released for WH" || 
                            viewingRelease.status === "Delivered To WH") && (
                            <TableCell>{item.verifiedQty || item.qtyProduced}</TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {/* CONDITIONAL FOOTER RENDERING BASED ON STATUS:
            
                STATUS: "Pending" (Verified QC, Pending WH Release)
                - Shows: "Close" button + "Release" button
                - "Release" button triggers handleReleaseFromVerifiedQC()
                - Changes status from "Pending" to "Released for WH"
                - Moves record from "Verified QC" tab to "Released for WH" tab
                
                ALL OTHER STATUSES:
                - "Sent for QC": Read-only, awaiting QC verification
                - "Released for WH": Read-only, awaiting warehouse receipt
                - "Delivered To WH": Read-only, completed delivery
                - Shows: "Close" button only (no actions available)
            */}
            {viewingRelease?.status === "Pending" ? (
              // Footer for Pending (Verified QC) - Show Release button
              <div className="flex justify-end gap-3 w-full">
                <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => handleReleaseFromVerifiedQC(viewingRelease)}>
                  Release
                </Button>
              </div>
            ) : (
              // Read-only footer for all other statuses
              <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
