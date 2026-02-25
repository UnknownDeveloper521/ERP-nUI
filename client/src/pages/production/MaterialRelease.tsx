import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Search, Eye, ChevronLeft, ChevronRight, ChevronsUpDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================================================
// OPERATION-WISE RELEASE REQUEST / ISSUE TO WH MODULE
// ============================================================================
// This module handles the release/issue of produced materials from production 
// operations to the warehouse. It is NOT MR-based; instead, it is Operation-based.
//
// KEY FEATURES:
// - Select Operation + Work Center to load eligible batches
// - Multi-select batches with checkboxes
// - Auto-calculate produced items from selected batches
// - QC eligibility filtering (only show batches ready for warehouse)
// - Direct issue to warehouse (no QC routing in this flow)
//
// WORKFLOW OVERVIEW:
// Select Operation/WC → Load Eligible Batches → Select Batches → Issue To WH → Inventory
// ============================================================================

// ============================================================================
// BATCH ELIGIBILITY RULES
// ============================================================================
// BATCHES ARE ELIGIBLE FOR WAREHOUSE ISSUE WHEN:
// 
// 1. IF Operation Master has QC Required = YES:
//    - Show only batches with QC Status = "Verified"
//    - These batches have already passed QC inspection
//
// 2. IF Operation Master has QC Required = NO:
//    - Show only batches with Batch Status = "Completed"
//    - No QC verification needed
//
// BATCH TABLE COLUMNS:
// - Select (checkbox): Multi-select batches to include in release
// - Shift: Morning/Night shift when batch was produced
// - Batch No: Unique batch identifier
// - Items Produced: Summary of output items from batch
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
const generateReleaseNumber = (existingReleases: OperationRelease[]): string => {
  const year = new Date().getFullYear();
  const count = existingReleases.filter(r => r.releaseNo.includes(`REL-${year}`)).length + 1;
  return `REL-${year}-${String(count).padStart(3, '0')}`;
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Operation Release Interface
 * 
 * Represents an operation-wise release/issue record that tracks the movement 
 * of produced items from production operations to the warehouse.
 * This is NOT MR-based; it is Operation + Work Center based.
 * 
 * @property id - Unique identifier for the release record
 * @property releaseNo - Auto-generated release number (format: REL-YYYY-NNN)
 * @property releaseDate - Date when the release was created
 * @property releasedBy - User who created the release
 * @property operation - Production operation name (e.g., Welding, Assembly)
 * @property workCenter - Work center where production occurred
 * @property warehouse - Target warehouse for delivery
 * @property batchIds - Array of batch IDs included in this release
 * @property status - Current status: "Issued to WH" or "Received by WH"
 * @property items - Array of produced items included in this release
 */
interface OperationRelease {
  id: number;
  releaseNo: string;
  releaseDate: string;
  releasedBy: string;
  operation: string;
  workCenter: string;
  warehouse: string;
  batchIds: string[];
  status: "Issued to WH" | "Received by WH";
  items: ProducedItem[];
}

/**
 * Produced Item Interface
 * 
 * Represents an individual item within an operation release.
 * 
 * @property id - Unique identifier for the item
 * @property itemCode - Item/Product code
 * @property itemName - Item/Product name
 * @property uom - Unit of measurement (e.g., PCS, KG, MTR)
 * @property qtyProduced - Total quantity produced across selected batches
 */
interface ProducedItem {
  id: number;
  itemCode: string;
  itemName: string;
  uom: string;
  qtyProduced: number;
}

/**
 * Operation Master Interface
 * 
 * Represents an operation configuration with QC requirements.
 * 
 * @property operation - Operation name
 * @property qcRequired - Whether QC is required for this operation
 */
interface OperationMaster {
  operation: string;
  qcRequired: boolean;
}

/**
 * Work Center Interface
 * 
 * Represents a work center associated with an operation.
 * 
 * @property operation - Parent operation name
 * @property workCenter - Work center name
 */
interface WorkCenterMapping {
  operation: string;
  workCenter: string;
}

/**
 * Batch Tracking Interface
 * 
 * Represents a completed production batch that can be included in a release.
 * Batches are filtered by Operation + Work Center and QC eligibility.
 * 
 * @property id - Unique batch ID
 * @property batchNo - Unique batch number
 * @property operation - Production operation name
 * @property workCenter - Work center where batch was produced
 * @property warehouse - Target warehouse
 * @property shift - Shift when batch was produced (Morning/Night)
 * @property status - Batch status (Completed, In Process, etc.)
 * @property qcStatus - QC verification status (Verified, Pending, N/A)
 * @property outputItems - Array of items produced in this batch
 */
interface BatchTracking {
  id: number;
  batchNo: string;
  operation: string;
  workCenter: string;
  warehouse: string;
  shift: "Morning" | "Night";
  status: string;
  qcStatus: "Verified" | "Pending" | "N/A";
  outputItems: ProducedItem[];
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

  // ============================================================================
  // STATE - LISTING PAGE
  // ============================================================================
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Issued to WH");
  const [currentPage, setCurrentPage] = useState(1);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingRelease, setViewingRelease] = useState<OperationRelease | null>(null);
  const itemsPerPage = 10;

  // ============================================================================
  // STATE - CREATE MODAL
  // ============================================================================
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState("");
  const [selectedWorkCenter, setSelectedWorkCenter] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [eligibleBatches, setEligibleBatches] = useState<BatchTracking[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  
  const [formData, setFormData] = useState({
    releaseNo: "",
    releaseDate: getCurrentDateForInput(),
    releasedBy: "Admin User", // TODO: Get from login context
  });
  
  const [producedItems, setProducedItems] = useState<ProducedItem[]>([]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // ============================================================================
  // MOCK DATA
  // ============================================================================

  // Operation Masters with QC requirements
  const operationMasters: OperationMaster[] = [
    { operation: "Cutting", qcRequired: false },
    { operation: "Welding", qcRequired: true },
    { operation: "Assembly", qcRequired: true },
  ];

  // Work Centers mapped to operations
  const workCenterMappings: WorkCenterMapping[] = [
    { operation: "Cutting", workCenter: "WC-001 Cutting Bay" },
    { operation: "Cutting", workCenter: "WC-005 Cutting Station 2" },
    { operation: "Welding", workCenter: "WC-002 Welding Station" },
    { operation: "Welding", workCenter: "WC-006 Welding Bay 2" },
    { operation: "Assembly", workCenter: "WC-003 Assembly Line" },
    { operation: "Assembly", workCenter: "WC-007 Assembly Station 2" },
  ];

  // Warehouses
  const warehouses = ["Production Store", "Raw Material Store", "Finished Goods Store"];

  // Sample Batch Tracking data with QC status
  const allBatches: BatchTracking[] = [
    // Cutting batches (QC not required - show if Completed)
    {
      id: 1,
      batchNo: "BATCH-2026-001",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      shift: "Morning",
      status: "Completed",
      qcStatus: "N/A",
      outputItems: [
        { id: 1, itemCode: "FG001", itemName: "Steel Plate Cut", uom: "PCS", qtyProduced: 50 },
        { id: 2, itemCode: "FG002", itemName: "Steel Rod Cut", uom: "PCS", qtyProduced: 100 },
      ]
    },
    {
      id: 2,
      batchNo: "BATCH-2026-006",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      shift: "Night",
      status: "Completed",
      qcStatus: "N/A",
      outputItems: [
        { id: 3, itemCode: "FG001", itemName: "Steel Plate Cut", uom: "PCS", qtyProduced: 45 },
      ]
    },
    // Welding batches (QC required - show only if Verified)
    {
      id: 3,
      batchNo: "BATCH-2026-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      shift: "Morning",
      status: "Completed",
      qcStatus: "Verified",
      outputItems: [
        { id: 4, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 25 },
      ]
    },
    {
      id: 4,
      batchNo: "BATCH-2026-003",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      shift: "Night",
      status: "Completed",
      qcStatus: "Verified",
      outputItems: [
        { id: 5, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 30 },
        { id: 6, itemCode: "FG006", itemName: "Welded Bracket", uom: "PCS", qtyProduced: 15 },
      ]
    },
    {
      id: 5,
      batchNo: "BATCH-2026-004",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      shift: "Morning",
      status: "Completed",
      qcStatus: "Pending", // Should NOT show - QC not verified yet
      outputItems: [
        { id: 7, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 20 },
      ]
    },
    // Assembly batches (QC required - show only if Verified)
    {
      id: 6,
      batchNo: "BATCH-2026-005",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      shift: "Morning",
      status: "Completed",
      qcStatus: "Verified",
      outputItems: [
        { id: 8, itemCode: "FG004", itemName: "Assembled Unit", uom: "PCS", qtyProduced: 10 },
        { id: 9, itemCode: "FG005", itemName: "Sub Assembly", uom: "PCS", qtyProduced: 20 },
      ]
    },
  ];

  // Sample operation releases data
  const [releases, setReleases] = useState<OperationRelease[]>([
    {
      id: 1,
      releaseNo: "REL-2026-001",
      releaseDate: "2026-02-10",
      releasedBy: "John Doe",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      batchIds: ["BATCH-2026-002"],
      status: "Issued to WH",
      items: [
        { id: 1, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 25 },
      ]
    },
    {
      id: 2,
      releaseNo: "REL-2026-002",
      releaseDate: "2026-02-15",
      releasedBy: "Jane Smith",
      operation: "Cutting",
      workCenter: "WC-001 Cutting Bay",
      warehouse: "Production Store",
      batchIds: ["BATCH-2026-001"],
      status: "Received by WH",
      items: [
        { id: 2, itemCode: "FG001", itemName: "Steel Plate Cut", uom: "PCS", qtyProduced: 50 },
        { id: 3, itemCode: "FG002", itemName: "Steel Rod Cut", uom: "PCS", qtyProduced: 100 },
      ]
    },
  ]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Load eligible batches when Operation + Work Center are selected
  // Filters batches based on QC requirements:
  // - If QC Required = YES: Show only batches with QC Status = "Verified"
  // - If QC Required = NO: Show only batches with Batch Status = "Completed"
  useEffect(() => {
    if (selectedOperation && selectedWorkCenter) {
      const operationMaster = operationMasters.find(om => om.operation === selectedOperation);
      const qcRequired = operationMaster?.qcRequired || false;

      // Filter batches by Operation + Work Center + Eligibility
      const filtered = allBatches.filter(batch => {
        const matchesOperation = batch.operation === selectedOperation;
        const matchesWorkCenter = batch.workCenter === selectedWorkCenter;
        
        // Eligibility check based on QC requirement
        let isEligible = false;
        if (qcRequired) {
          // QC Required = YES: Show only batches with QC Status = Verified
          isEligible = batch.qcStatus === "Verified";
        } else {
          // QC Required = NO: Show only batches with Batch Status = Completed
          isEligible = batch.status === "Completed";
        }

        return matchesOperation && matchesWorkCenter && isEligible;
      });

      setEligibleBatches(filtered);
      setSelectedBatchIds([]); // Clear selections when filters change
      setProducedItems([]); // Clear produced items
    } else {
      setEligibleBatches([]);
      setSelectedBatchIds([]);
      setProducedItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOperation, selectedWorkCenter]);

  // Auto-calculate produced items when batch selection changes
  // Groups items by itemCode and sums quantities across all selected batches
  useEffect(() => {
    if (selectedBatchIds.length > 0) {
      const selectedBatches = eligibleBatches.filter(b => selectedBatchIds.includes(b.id));
      
      // Group items by itemCode and sum quantities
      const itemsMap = new Map<string, ProducedItem>();

      selectedBatches.forEach(batch => {
        batch.outputItems.forEach(item => {
          const existing = itemsMap.get(item.itemCode);
          if (existing) {
            existing.qtyProduced += item.qtyProduced;
          } else {
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

      const aggregatedItems = Array.from(itemsMap.values());
      setProducedItems(aggregatedItems);
    } else {
      setProducedItems([]);
    }
  }, [selectedBatchIds, eligibleBatches]);

  // ============================================================================
  // HANDLERS - LISTING PAGE
  // ============================================================================

  /**
   * Open view modal to display release details
   */
  const handleViewRelease = (release: OperationRelease) => {
    setViewingRelease(release);
    setIsViewModalOpen(true);
  };

  /**
   * Open create modal to add new release
   */
  const handleAddRelease = () => {
    // Generate new release number
    setFormData(prev => ({
      ...prev,
      releaseNo: generateReleaseNumber(releases),
      releaseDate: getCurrentDateForInput(),
    }));
    
    // Open modal
    setIsCreateModalOpen(true);
  };

  // ============================================================================
  // HANDLERS - CREATE MODAL
  // ============================================================================

  /**
   * Close create modal and reset form state
   */
  const handleCancel = () => {
    // Close modal
    setIsCreateModalOpen(false);
    
    // Reset form
    setSelectedOperation("");
    setSelectedWorkCenter("");
    setSelectedWarehouse("");
    setEligibleBatches([]);
    setSelectedBatchIds([]);
    setProducedItems([]);
  };

  /**
   * Handle operation selection change
   * Resets dependent fields (work center, batches, items)
   */
  const handleOperationChange = (operation: string) => {
    setSelectedOperation(operation);
    // Reset dependent fields
    setSelectedWorkCenter("");
    setEligibleBatches([]);
    setSelectedBatchIds([]);
    setProducedItems([]);
  };

  /**
   * Handle work center selection change
   * Eligible batches will be loaded by useEffect
   */
  const handleWorkCenterChange = (workCenter: string) => {
    setSelectedWorkCenter(workCenter);
    // Batches will be loaded by useEffect
  };

  /**
   * Toggle batch selection for multi-select
   */
  const handleBatchToggle = (batchId: number) => {
    setSelectedBatchIds(prev => {
      if (prev.includes(batchId)) {
        return prev.filter(id => id !== batchId);
      } else {
        return [...prev, batchId];
      }
    });
  };

  /**
   * Submit form to create new material release
   * Validates required fields, creates release record, and issues to warehouse
   */
  const handleSubmit = () => {
    // Validation
    if (!selectedOperation) {
      toast({
        title: "Validation Error",
        description: "Please select an Operation",
        variant: "destructive",
      });
      return;
    }

    if (!selectedWorkCenter) {
      toast({
        title: "Validation Error",
        description: "Please select a Work Center",
        variant: "destructive",
      });
      return;
    }

    if (!selectedWarehouse) {
      toast({
        title: "Validation Error",
        description: "Please select a Warehouse",
        variant: "destructive",
      });
      return;
    }

    if (selectedBatchIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one batch",
        variant: "destructive",
      });
      return;
    }

    // Create new release
    const selectedBatches = eligibleBatches.filter(b => selectedBatchIds.includes(b.id));
    const batchNumbers = selectedBatches.map(b => b.batchNo);

    const newRelease: OperationRelease = {
      id: releases.length + 1,
      releaseNo: formData.releaseNo,
      releaseDate: formData.releaseDate,
      releasedBy: formData.releasedBy,
      operation: selectedOperation,
      workCenter: selectedWorkCenter,
      warehouse: selectedWarehouse,
      batchIds: batchNumbers,
      status: "Issued to WH",
      items: producedItems,
    };

    setReleases([...releases, newRelease]);

    // Update batch statuses to "Issued to WH / Pending WH Receipt"
    // TODO: In real implementation, update batch records in database
    console.log("Updating batch statuses to 'Issued to WH':", batchNumbers);

    // Push to Inventory module
    // TODO: In real implementation, create inventory receipt record
    console.log("Creating inventory receipt record for warehouse:", selectedWarehouse);
    console.log("Items:", producedItems);

    toast({
      title: "Success",
      description: "Material issued to warehouse successfully.",
    });

    // Close modal and reset
    setIsCreateModalOpen(false);
    setSelectedOperation("");
    setSelectedWorkCenter("");
    setSelectedWarehouse("");
    setEligibleBatches([]);
    setSelectedBatchIds([]);
    setProducedItems([]);
  };

  // ============================================================================
  // FILTERING & PAGINATION
  // ============================================================================

  const filteredReleases = releases.filter(release => {
    const matchesSearch = 
      release.releaseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.operation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.workCenter.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "All" || release.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredReleases.length / itemsPerPage);
  const paginatedData = filteredReleases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ============================================================================
  // RENDER - LISTING PAGE
  // ============================================================================

  // Get work centers for selected operation (used in create modal)
  const availableWorkCenters = selectedOperation
    ? workCenterMappings
        .filter(wc => wc.operation === selectedOperation)
        .map(wc => wc.workCenter)
    : [];

  // Check if primary button should be disabled (used in create modal)
  const isPrimaryButtonDisabled = 
    !selectedOperation || 
    !selectedWorkCenter ||
    !selectedWarehouse ||
    selectedBatchIds.length === 0;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Material Release</h1>
        <p className="text-muted-foreground">
          Release produced output from production operations to warehouse
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
              { value: "Issued to WH", label: "Issued to WH" },
              { value: "Received by WH", label: "Received by WH" },
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

      {/* Releases Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Release Date</TableHead>
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
                      No releases found.
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
                        <Badge variant={
                          release.status === "Issued to WH" ? "default" : "secondary"
                        }>
                          {release.status}
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
            <DialogTitle>Release Details</DialogTitle>
            <DialogDescription>
              View operation release details
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
                    viewingRelease.status === "Issued to WH" ? "default" : "secondary"
                  }>
                    {viewingRelease.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Released By</Label>
                  <p className="font-medium">{viewingRelease.releasedBy}</p>
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
                  <Label className="text-xs text-muted-foreground">Batches</Label>
                  <p className="font-medium">{viewingRelease.batchIds.join(", ")}</p>
                </div>
              </div>

              {/* Produced Items Table */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Produced Items</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item</TableHead>
                        <TableHead>Qty Produced</TableHead>
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Release Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => {
        if (!open) {
          handleCancel();
        }
      }}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Material Release</DialogTitle>
            <DialogDescription>
              Release produced output from production operations to warehouse
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header Summary Section */}
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

              {/* Required dropdowns */}
              <div>
                <Label>
                  Operation <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  value={selectedOperation}
                  onValueChange={handleOperationChange}
                  options={operationMasters.map(om => ({
                    value: om.operation,
                    label: om.operation,
                  }))}
                  placeholder="Select Operation"
                  searchPlaceholder="Search operation..."
                  emptyText="No operation found"
                />
              </div>

              <div>
                <Label>
                  Work Center <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  value={selectedWorkCenter}
                  onValueChange={handleWorkCenterChange}
                  options={availableWorkCenters.map(wc => ({
                    value: wc,
                    label: wc,
                  }))}
                  placeholder="Select Work Center"
                  searchPlaceholder="Search work center..."
                  emptyText="No work center found"
                />
              </div>

              <div>
                <Label>
                  Warehouse <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  value={selectedWarehouse}
                  onValueChange={setSelectedWarehouse}
                  options={warehouses.map(wh => ({
                    value: wh,
                    label: wh,
                  }))}
                  placeholder="Select Warehouse"
                  searchPlaceholder="Search warehouse..."
                  emptyText="No warehouse found"
                />
              </div>
            </div>

            {/* Eligible Batches Section with Multi-Select */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Eligible Batches</Label>
              {!selectedOperation || !selectedWorkCenter ? (
                <div className="text-center py-8 text-muted-foreground border rounded-md">
                  Please select Operation and Work Center to view eligible batches
                </div>
              ) : eligibleBatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-md">
                  No eligible batches found for this Operation and Work Center
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Batch No</TableHead>
                        <TableHead>Items Produced</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eligibleBatches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedBatchIds.includes(batch.id)}
                              onChange={() => handleBatchToggle(batch.id)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{batch.shift}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{batch.batchNo}</TableCell>
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Produced Items Section - Auto-calculated from selected batches */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Produced Items (Total from Selected Batches)</Label>
              {producedItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-md">
                  No items to display. Select batches to see produced items.
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
                          <TableCell className="font-medium">{item.qtyProduced}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPrimaryButtonDisabled}>
              Issue To WH
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
