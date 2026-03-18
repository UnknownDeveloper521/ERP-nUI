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
import { Plus, Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check, Upload, Printer } from "lucide-react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar, FilterField } from "@/components/shared/AppListToolbar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { mockBatchRecords } from "@/lib/batchSharedData";
import { 
  mockReleaseRecords, 
  addReleaseRecord, 
  OperationRelease, 
  ProducedItem 
} from "@/lib/releaseSharedData";

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
 * @property status - Current status: "Issued to Warehouse" or "Received By Warehouse"
 * @property items - Array of produced items included in this release
 */
// OperationRelease and ProducedItem are imported from @/lib/releaseSharedData


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
// ProducedItem is imported from @/lib/releaseSharedData


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
  qcStatus: string; // Changed to string for flexibility with "Verified" value
  outputItems: ProducedItem[]; // Use imported ProducedItem
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
function LocalSearchableSelect({
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
          className={cn(
            "w-full justify-between h-10 font-normal px-3 py-2 text-sm border border-input shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 hover:bg-white",
            className
          )}
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
  const [statusFilter, setStatusFilter] = useState("Issued to Warehouse"); // Default filter to show issued
  const [operationFilter, setOperationFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingRelease, setViewingRelease] = useState<OperationRelease | null>(null);
  const [releases, setReleases] = useState<OperationRelease[]>(mockReleaseRecords);
  // Pagination state - using DataTablePagination component
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Serial Numbers for batches/items: Record<batchNo, Record<itemCode, serialNumbers[]>>
  const [batchSerialNumbers, setBatchSerialNumbers] = useState<Record<string, Record<string, string[]>>>({});

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, operationFilter, shiftFilter]);

  // ============================================================================
  // MOCK DATA
  // ============================================================================

  // Operation Masters with QC requirements
  const operationMasters: OperationMaster[] = [
    { operation: "Lead Generation & Purification", qcRequired: true },
    { operation: "Case Creation", qcRequired: false },
    { operation: "Grid Creation & Oxidization", qcRequired: true },
    { operation: "Assembly line & Packaging", qcRequired: true },
  ];

  // Work Centers mapped to operations
  const workCenterMappings: WorkCenterMapping[] = [
    { operation: "Lead Generation & Purification", workCenter: "Lead Furnace Center" },
    { operation: "Case Creation", workCenter: "Plastic Casing Center" },
    { operation: "Grid Creation & Oxidization", workCenter: "Grid Generation Center" },
    { operation: "Assembly line & Packaging", workCenter: "Assembly Line" },
  ];

  // Warehouses
  const warehouses = ["Jinja WH"];

  // Sample operation releases data moved to releaseSharedData.ts


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
    if (selectedOperation && selectedWorkCenter && selectedWarehouse) {
      // Filter batches by Operation + Work Center + Eligibility from shared records
      const filtered = (mockBatchRecords as any[]).filter(batch => {
        const matchesOperation = batch.operation === selectedOperation;
        const matchesWorkCenter = batch.workCenter === selectedWorkCenter;
        const matchesWarehouse = batch.warehouse === selectedWarehouse;
        
        // Per User Rule: Show only "Verified QC" batches
        // Note: qcStatus is "Verified" when QC is completed successfully
        return matchesOperation && matchesWorkCenter && matchesWarehouse && batch.qcStatus === "Verified";
      });

      setEligibleBatches(filtered);
      setSelectedBatchIds([]); // Clear selections when filters change
      setProducedItems([]); // Clear produced items
    } else {
      setEligibleBatches([]);
      setSelectedBatchIds([]);
      setProducedItems([]);
    }
  }, [selectedOperation, selectedWorkCenter, selectedWarehouse]);

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

    // ✅ ADDED: Store batch-wise produced qty breakdown for Release Details view (frontend-only)
    // NOTE: Frontend-only grouping using existing response data; no backend changes
    const batchDetails = selectedBatches.map(batch => ({
      batchNo: batch.batchNo,
      shift: batch.shift,
      items: batch.outputItems
    }));

    const newRelease: OperationRelease = {
      id: mockReleaseRecords.length + 1,
      releaseNo: formData.releaseNo,
      releaseDate: formData.releaseDate,
      releasedBy: formData.releasedBy,
      operation: selectedOperation,
      workCenter: selectedWorkCenter,
      warehouse: selectedWarehouse,
      batchIds: batchNumbers,
      status: "Issued to Warehouse",
      items: producedItems,
      batchDetails: batchDetails,
    };

    setReleases(addReleaseRecord(newRelease));

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
    setBatchSerialNumbers({}); // Reset serial numbers
  };

  /**
   * Handle Excel import for serial numbers
   */
  const handleImportSerialNumbers = (batchNo: string, itemCode: string, file: File, expectedQty: number) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Assuming serial numbers are in the first column, skipping header if exists
        // Filter out empty rows
        let serialNumbers = json
          .map(row => row[0])
          .filter(val => val !== undefined && val !== "" && val !== null)
          .map(val => String(val).trim());

        // If the first row is likely a header (non-numeric and count is one extra), skip it
        if (serialNumbers.length === expectedQty + 1 && isNaN(Number(serialNumbers[0]))) {
          serialNumbers.shift();
        }

        if (serialNumbers.length !== expectedQty) {
          toast({
            title: "Import Error",
            description: `Number of serial numbers (${serialNumbers.length}) does not match produced quantity (${expectedQty}).`,
            variant: "destructive",
          });
          return;
        }

        setBatchSerialNumbers(prev => ({
          ...prev,
          [batchNo]: {
            ...(prev[batchNo] || {}),
            [itemCode]: serialNumbers,
          },
        }));

        toast({
          title: "Import Success",
          description: `Imported ${serialNumbers.length} serial numbers for batch ${batchNo}.`,
        });
      } catch (error) {
        console.error("Excel import error:", error);
        toast({
          title: "Import Error",
          description: "Failed to parse Excel file.",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /**
   * Handle QR code generation and printing
   */
  const handleGenerateQR = (batchNo: string, itemCode: string, itemName: string) => {
    const serialNumbers = batchSerialNumbers[batchNo]?.[itemCode];
    if (!serialNumbers || serialNumbers.length === 0) {
      toast({
        title: "Error",
        description: "No serial numbers imported for this batch.",
        variant: "destructive",
      });
      return;
    }

    // Create a printable window
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const qrItemsHtml = serialNumbers.map(srNo => `
      <div class="qr-item">
        <div class="qr-code">
          <!-- Simplified representation as we can't easily inject React component -->
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`Batch:${batchNo}|SrNo:${srNo}|Item:${itemName}|Code:${itemCode}`)}" alt="QR" />
        </div>
        <div class="qr-info">
          <div><strong>Batch:</strong> ${batchNo}</div>
          <div><strong>SrNo:</strong> ${srNo}</div>
          <div><strong>Item:</strong> ${itemName}</div>
          <div><strong>Code:</strong> ${itemCode}</div>
        </div>
      </div>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Codes - ${batchNo}</title>
          <style>
            @page { size: auto; margin: 10mm; }
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 10px; color: #333; }
            h2 { text-align: center; color: #000; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .print-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
            }
            .qr-item {
              border: 1.5px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px;
              text-align: center;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: #fff;
              height: 250px;
            }
            .qr-code { margin-bottom: 10px; }
            .qr-info { 
              font-size: 11px; 
              line-height: 1.4;
              text-align: left;
              width: 100%;
              max-width: 180px;
              margin: 0 auto;
            }
            .qr-info div { margin-bottom: 2px; }
            .qr-info strong { color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; margin-right: 4px; }
            @media print {
              .qr-item { border-color: #eee; }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <h2>QR Code Generation - Batch: ${batchNo}</h2>
          <div class="print-grid">
            ${qrItemsHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ============================================================================
  // FILTERING & PAGINATION
  // ============================================================================

  const filteredReleases = releases.filter(release => {
    const matchesSearch =
      release.releaseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.operation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.workCenter.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || release.status === statusFilter;
    const matchesOperation = operationFilter === "all" || release.operation === operationFilter;
    const matchesShift = shiftFilter === "all" || (release.batchDetails?.some(b => b.shift === shiftFilter) ?? false);

    return matchesSearch && matchesStatus && matchesOperation && matchesShift;
  });

  const totalPages = Math.ceil(filteredReleases.length / itemsPerPage);
  const paginatedData = filteredReleases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Auto-adjust page when data changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredReleases.length, currentPage, totalPages]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

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

  // Check if any selected item is Finished Good (FG)
  const isFGProduced = producedItems.some(item => item.itemCode.toLowerCase().startsWith("fg-"));
  const selectedBatches = eligibleBatches.filter(b => selectedBatchIds.includes(b.id));

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1e]">Material Release</h1>
        <p className="text-muted-foreground">
          Release produced output from production operations to warehouse
        </p>
      </div>

      <AppListToolbar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search by Release No / Operation..."
        }}
        filters={[
          {
            type: 'select',
            label: 'Shift',
            value: shiftFilter,
            options: [{ label: "All Shifts", value: "all" }, "Morning", "Night"],
            onChange: setShiftFilter,
            searchable: true
          },
          {
            type: 'select',
            label: 'Operation',
            value: operationFilter,
            options: [{ label: "All Operations", value: "all" }, ...operationMasters.map(om => om.operation)],
            onChange: setOperationFilter,
            searchable: true
          },
          {
            type: 'select',
            label: 'Status',
            value: statusFilter,
            options: [{ label: "All Status", value: "all" }, "Issued to Warehouse", "Received By Warehouse"],
            onChange: setStatusFilter,
            searchable: true
          }
        ]}
        actions={[
          {
            label: "Create Material Release",
            icon: <Plus className="h-4 w-4" />,
            onClick: handleAddRelease
          }
        ]}
      />

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
                  <TableHead className="text-center font-bold text-[11px] tracking-wider py-4">Actions</TableHead>
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
                        <Badge 
                          variant={release.status === "Issued to Warehouse" ? "default" : "secondary"}
                          className="whitespace-nowrap w-fit px-2.5 py-0.5"
                        >
                          {release.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-4">
                        <TableActionButtons
                          onView={() => handleViewRelease(release)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination - using standardized DataTablePagination component */}
          {filteredReleases.length > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredReleases.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              options={[10, 15, 30, 50]}
            />
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
                  <Badge 
                    variant={viewingRelease.status === "Issued to Warehouse" ? "default" : "secondary"}
                    className="whitespace-nowrap w-fit px-2.5 py-0.5"
                  >
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

              {/* Batch-wise Produced Items (Breakdown) */}
              {/* ✅ ADDED: Release Details shows batch-wise produced qty breakdown (batch -> items -> qty) */}
              {/* ✅ NOTE: Frontend-only grouping using existing response data; no backend changes */}
              {viewingRelease.batchDetails && viewingRelease.batchDetails.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Batch-wise Produced Items (Breakdown)</Label>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Shift</TableHead>
                          <TableHead>Batch No</TableHead>
                          <TableHead>Items Produced</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingRelease.batchDetails.map((batchDetail, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge variant="outline">{batchDetail.shift}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{batchDetail.batchNo}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {batchDetail.items.map((item, itemIdx) => (
                                  <div key={itemIdx} className="text-sm">
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
                </div>
              )}

              {/* Total Summary - Produced Items Table */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Total Summary</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Total Qty</TableHead>
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
                          <TableCell className="text-right font-medium">{item.qtyProduced}</TableCell>
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
        <DialogContent className="sm:max-w-[950px] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Material Release</DialogTitle>
            <DialogDescription>
              Release produced output from production operations to warehouse
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Header Summary Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Auto-filled fields (read-only) */}
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
                <LocalSearchableSelect
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
                <LocalSearchableSelect
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
                <LocalSearchableSelect
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

            {/* ✅ NEW: Import Serial Number & QR Generation Table */}
            {isFGProduced && selectedBatches.length > 0 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-primary">Serial Number Import & QR Generation</Label>
                  <Badge variant="secondary" className="font-normal text-[10px] uppercase tracking-wider px-2">
                    Finished Goods Detected
                  </Badge>
                </div>
                <div className="rounded-md border border-primary/20 bg-primary/5 p-1">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary/10 border-none hover:bg-primary/10">
                        <TableHead className="text-primary font-bold">Batch No</TableHead>
                        <TableHead className="text-primary font-bold">Item Details</TableHead>
                        <TableHead className="text-primary font-bold">Import Serial No</TableHead>
                        <TableHead className="text-primary font-bold">Import Count</TableHead>
                        <TableHead className="text-right text-primary font-bold">Generate QR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBatches.flatMap((batch) => {
                        // Filter for FG items in this batch
                        const fgItems = batch.outputItems.filter(item =>
                          item.itemCode.toLowerCase().startsWith("fg-")
                        );

                        return fgItems.map((item) => {
                          const importedCount = batchSerialNumbers[batch.batchNo]?.[item.itemCode]?.length || 0;
                          const expectedQty = item.qtyProduced;

                          return (
                            <TableRow key={`${batch.id}-${item.itemCode}`} className="border-primary/10">
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{batch.batchNo}</span>
                                  <Badge variant="outline" className="w-fit text-[10px] h-4 px-1 mt-1 font-normal">
                                    {batch.shift}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-bold text-sm">{item.itemName}</span>
                                  <span className="text-xs text-muted-foreground">{item.itemCode}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                    id={`file-import-${batch.id}-${item.itemCode}`}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleImportSerialNumbers(batch.batchNo, item.itemCode, file, expectedQty);
                                      }
                                    }}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 border-dashed border-primary/30 hover:bg-primary/10"
                                    onClick={() => document.getElementById(`file-import-${batch.id}-${item.itemCode}`)?.click()}
                                  >
                                    <Upload className="h-3.5 w-3.5 mr-2" />
                                    Import Excel
                                  </Button>
                                  {importedCount > 0 && (
                                    <Badge variant="default" className="bg-green-600 hover:bg-green-700 h-5 px-1.5 animate-in zoom-in-50 duration-300">
                                      <Check className="h-3 w-3" />
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className={cn(
                                    "font-bold",
                                    importedCount === expectedQty ? "text-green-600" : "text-amber-600"
                                  )}>
                                    {importedCount} / {expectedQty}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground uppercase">Imported</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  onClick={() => handleGenerateQR(batch.batchNo, item.itemCode, item.itemName)}
                                  disabled={importedCount === 0}
                                  className="h-8 shadow-sm"
                                >
                                  <Printer className="h-3.5 w-3.5 mr-2" />
                                  Generate Labels
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Produced Items Section - Auto-calculated from selected batches */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold mb-2 block">Produced Items (Total from Selected Batches)</Label>
              {producedItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-md">
                  No items to display. Select batches to see produced items.
                </div>
              ) : (
                <div className="rounded-md border shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 border-none">
                        <TableHead className="font-semibold text-foreground">Item</TableHead>
                        <TableHead className="font-semibold text-foreground">UOM</TableHead>
                        <TableHead className="font-semibold text-foreground text-right pr-6">Total Qty</TableHead>
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
                          <TableCell className="font-bold text-right pr-6">{item.qtyProduced}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6 border-t pt-4">
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
