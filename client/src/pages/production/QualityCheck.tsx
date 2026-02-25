// ============================================================================
// QUALITY CHECK MODULE - BATCH-CENTRIC
// ============================================================================
// This module handles the verification of batches that require QC.
// It provides a workflow for QC inspectors to review produced quantities and
// verify the actual acceptable quantities after quality inspection.
//
// KEY FEATURES:
// - Lists batches sent for QC verification
// - Allows QC inspectors to verify quantities per item
// - Validates verified quantities (must be ≤ produced quantity)
// - Updates batch status from "Sent for QC" to "Verified"
// - Records QC inspector details and verification timestamp
// - Separate tabs for pending and completed verifications
//
// WORKFLOW:
// 1. Batch Tracking module sends batches with requiresQC=true
// 2. QC inspector views batch in "Sent for QC" tab
// 3. Inspector reviews items and enters verified quantities
// 4. System validates: verifiedQty must be numeric, ≥0, and ≤ qtyProduced
// 5. On "Verify QC", status changes to "Verified" and moves to "Verified QC" tab
// 6. Verified batches return to Batch Tracking module with status "QC Verified"
// ============================================================================

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Eye, Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================================================
// SEARCHABLE SELECT COMPONENT
// ============================================================================

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}

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
                    onValueChange(currentValue);
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
// TYPE DEFINITIONS
// ============================================================================

/**
 * QC Item interface
 */
interface QCItem {
  id: number;
  itemCode: string;
  itemName: string;
  uom: string;
  qtyProduced: number;
  verifiedQty?: number;
}

/**
 * QC Parameter interface - Dynamic parameters based on Operation
 * Simplified to show only Parameter Name and Description
 */
interface QCParameter {
  id: number;
  parameterName: string;
  description: string;
}

/**
 * Batch QC interface - Batch-centric QC verification
 */
interface BatchQC {
  id: number;
  batchNo: string;
  batchDate: string;
  shift: "Morning" | "Night";
  operation: string;
  workCenter: string;
  qcStatus: "Sent for QC" | "Verified";
  items: QCItem[];
  qcParameters?: QCParameter[];
  qcVerifiedBy?: string;
  qcVerifiedOn?: string;
  remarks?: string;
}

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
 * Get current datetime in ISO format
 */
const getCurrentDateTime = (): string => {
  return new Date().toISOString();
};

// ============================================================================
// QC PARAMETERS CONFIGURATION BY OPERATION
// ============================================================================

/**
 * Operation-specific QC Parameters
 * These are loaded dynamically based on the Operation selected
 * Now showing only Parameter Name and Description
 */
const OPERATION_QC_PARAMETERS: Record<string, QCParameter[]> = {
  "Welding": [
    {
      id: 1,
      parameterName: "Weld Strength",
      description: "Check weld strength meets minimum requirements"
    },
    {
      id: 2,
      parameterName: "Weld Penetration",
      description: "Verify proper weld penetration depth"
    },
    {
      id: 3,
      parameterName: "Surface Finish",
      description: "Inspect surface for smoothness and cracks"
    },
    {
      id: 4,
      parameterName: "Dimensional Accuracy",
      description: "Verify dimensions are within tolerance"
    }
  ],
  "Assembly": [
    {
      id: 1,
      parameterName: "Torque Specification",
      description: "Check all fasteners are torqued correctly"
    },
    {
      id: 2,
      parameterName: "Alignment Check",
      description: "Verify component alignment"
    },
    {
      id: 3,
      parameterName: "Fastener Count",
      description: "Ensure all fasteners are present"
    },
    {
      id: 4,
      parameterName: "Functional Test",
      description: "Perform functional testing of assembled unit"
    }
  ],
  "Cutting": [
    {
      id: 1,
      parameterName: "Cut Dimensions",
      description: "Verify cut dimensions match specifications"
    },
    {
      id: 2,
      parameterName: "Edge Quality",
      description: "Check edge quality and burr removal"
    },
    {
      id: 3,
      parameterName: "Surface Condition",
      description: "Inspect surface for damage or defects"
    }
  ]
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function QualityCheck() {
  const { toast } = useToast();

  // ============================================================================
  // STATE
  // ============================================================================
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Sent for QC" | "Verified">("Sent for QC");
  const [operationFilter, setOperationFilter] = useState("All");
  const [workCenterFilter, setWorkCenterFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingBatch, setViewingBatch] = useState<BatchQC | null>(null);
  const [editableItems, setEditableItems] = useState<QCItem[]>([]);
  const [editableQCParameters, setEditableQCParameters] = useState<QCParameter[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState<string>("");
  const itemsPerPage = 10;

  // Mock logged-in user
  const currentUser = "QC Inspector - Sarah Lee";

  // ============================================================================
  // MOCK DATA - Batches sent for QC
  // ============================================================================
  const [batches, setBatches] = useState<BatchQC[]>([
    // ========== SENT FOR QC ==========
    {
      id: 1,
      batchNo: "BATCH-2026-001",
      batchDate: "2026-02-10",
      shift: "Morning",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      qcStatus: "Sent for QC",
      items: [
        { id: 1, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 25 },
      ]
    },
    {
      id: 2,
      batchNo: "BATCH-2026-002",
      batchDate: "2026-02-11",
      shift: "Night",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      qcStatus: "Sent for QC",
      items: [
        { id: 2, itemCode: "FG004", itemName: "Assembled Unit", uom: "PCS", qtyProduced: 10 },
        { id: 3, itemCode: "FG005", itemName: "Sub Assembly", uom: "PCS", qtyProduced: 20 },
      ]
    },
    {
      id: 3,
      batchNo: "BATCH-2026-003",
      batchDate: "2026-02-12",
      shift: "Morning",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      qcStatus: "Sent for QC",
      items: [
        { id: 4, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 30 },
        { id: 5, itemCode: "FG006", itemName: "Welded Bracket", uom: "PCS", qtyProduced: 15 },
        { id: 6, itemCode: "FG007", itemName: "Welded Support", uom: "PCS", qtyProduced: 40 },
      ]
    },

    // ========== VERIFIED ==========
    {
      id: 4,
      batchNo: "BATCH-2026-004",
      batchDate: "2026-02-13",
      shift: "Night",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      qcStatus: "Verified",
      qcVerifiedBy: "QC Inspector - Sarah Lee",
      qcVerifiedOn: "2026-02-14T10:30:00",
      items: [
        { id: 7, itemCode: "FG004", itemName: "Assembled Unit", uom: "PCS", qtyProduced: 10, verifiedQty: 9 },
      ]
    },
    {
      id: 5,
      batchNo: "BATCH-2026-005",
      batchDate: "2026-02-14",
      shift: "Morning",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      qcStatus: "Verified",
      qcVerifiedBy: "QC Inspector - Mike Chen",
      qcVerifiedOn: "2026-02-15T14:20:00",
      items: [
        { id: 8, itemCode: "FG003", itemName: "Welded Frame", uom: "PCS", qtyProduced: 50, verifiedQty: 48 },
        { id: 9, itemCode: "FG006", itemName: "Welded Bracket", uom: "PCS", qtyProduced: 25, verifiedQty: 25 },
      ]
    },
    {
      id: 6,
      batchNo: "BATCH-2026-006",
      batchDate: "2026-02-15",
      shift: "Night",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      qcStatus: "Verified",
      qcVerifiedBy: "QC Inspector - Sarah Lee",
      qcVerifiedOn: "2026-02-16T09:15:00",
      items: [
        { id: 10, itemCode: "FG004", itemName: "Assembled Unit", uom: "PCS", qtyProduced: 15, verifiedQty: 14 },
        { id: 11, itemCode: "FG005", itemName: "Sub Assembly", uom: "PCS", qtyProduced: 30, verifiedQty: 28 },
        { id: 12, itemCode: "FG008", itemName: "Final Product", uom: "PCS", qtyProduced: 8, verifiedQty: 8 },
      ]
    },
  ]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, operationFilter, workCenterFilter]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleViewBatch = (batch: BatchQC) => {
      // Check if operation requires QC
      const operationParams = OPERATION_QC_PARAMETERS[batch.operation];
      
      // If operation doesn't have QC parameters defined, it doesn't require QC
      if (!operationParams || operationParams.length === 0) {
        toast({
          title: "QC Not Required",
          description: `Operation "${batch.operation}" does not require QC verification.`,
          variant: "destructive",
        });
        return;
      }

      setViewingBatch(batch);
      // Initialize editable items with current values
      setEditableItems(batch.items.map(item => ({
        ...item,
        verifiedQty: item.verifiedQty ?? item.qtyProduced
      })));

      // Load QC parameters based on operation
      const qcParams = batch.qcParameters && batch.qcParameters.length > 0
        ? batch.qcParameters
        : operationParams;

      setEditableQCParameters(qcParams);
      setValidationErrors({});
      setRemarks(batch.remarks || "");
      setIsViewModalOpen(true);
    };

  const handleVerifiedQtyChange = (itemId: number, value: string) => {
    const numValue = Number(value);
    
    // Update the editable items
    setEditableItems(items =>
      items.map(item => {
        if (item.id === itemId) {
          return { ...item, verifiedQty: numValue };
        }
        return item;
      })
    );

    // Validate
    const item = editableItems.find(i => i.id === itemId);
    if (!item) return;

    const errors = { ...validationErrors };
    
    if (isNaN(numValue)) {
      errors[itemId] = "Must be a valid number";
    } else if (numValue < 0) {
      errors[itemId] = "Must be >= 0";
    } else if (numValue > item.qtyProduced) {
      errors[itemId] = `Must be <= ${item.qtyProduced}`;
    } else {
      delete errors[itemId];
    }

    setValidationErrors(errors);
  };

  const handleVerifyQC = () => {
    if (!viewingBatch) return;

    // Final validation
    const hasErrors = editableItems.some(item => {
      const verifiedQty = item.verifiedQty ?? 0;
      return isNaN(verifiedQty) || verifiedQty < 0 || verifiedQty > item.qtyProduced;
    });

    if (hasErrors || Object.keys(validationErrors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fix all validation errors before verifying.",
        variant: "destructive",
      });
      return;
    }

    // Update the batch
    const updatedBatch: BatchQC = {
      ...viewingBatch,
      qcStatus: "Verified",
      qcVerifiedBy: currentUser,
      qcVerifiedOn: getCurrentDateTime(),
      items: editableItems,
      qcParameters: editableQCParameters,
      remarks: remarks,
    };

    // Update batches array
    setBatches(batches.map(b => 
      b.id === viewingBatch.id ? updatedBatch : b
    ));

    // Close modal
    setIsViewModalOpen(false);

    // Success toast
    toast({
      title: "Success",
      description: `Batch ${viewingBatch.batchNo} verified successfully.`,
    });

    // TODO: In real implementation, this would also update the Batch status to "QC Verified"
    console.log("QC Verified - Batch should be updated to QC Verified status");
  };

  // ============================================================================
  // FILTERING & PAGINATION
  // ============================================================================

  // Get unique operations and work centers for filters
  const uniqueOperations = Array.from(new Set(batches.map(b => b.operation)));
  const uniqueWorkCenters = Array.from(new Set(batches.map(b => b.workCenter)));

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = 
      batch.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.operation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.workCenter.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = batch.qcStatus === statusFilter;
    const matchesOperation = operationFilter === "All" || batch.operation === operationFilter;
    const matchesWorkCenter = workCenterFilter === "All" || batch.workCenter === workCenterFilter;

    return matchesSearch && matchesStatus && matchesOperation && matchesWorkCenter;
  });

  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  const paginatedData = filteredBatches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Quality Check</h1>
        <p className="text-muted-foreground">
          Verify batches sent for quality inspection
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
              placeholder="Search by Batch No / Operation / Work Center..."
              className="pl-9 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="w-full sm:w-48">
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Operation
          </Label>
          <SearchableSelect
            value={operationFilter}
            onValueChange={setOperationFilter}
            options={[
              { value: "All", label: "All" },
              ...uniqueOperations.map(op => ({ value: op, label: op }))
            ]}
            placeholder="Select Operation"
            searchPlaceholder="Search operation..."
          />
        </div>

        <div className="w-full sm:w-48">
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Work Center
          </Label>
          <SearchableSelect
            value={workCenterFilter}
            onValueChange={setWorkCenterFilter}
            options={[
              { value: "All", label: "All" },
              ...uniqueWorkCenters.map(wc => ({ value: wc, label: wc }))
            ]}
            placeholder="Select Work Center"
            searchPlaceholder="Search work center..."
          />
        </div>

        <div className="w-full sm:w-48">
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Status
          </Label>
          <SearchableSelect
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "Sent for QC" | "Verified")}
            options={[
              { value: "Sent for QC", label: "Sent for QC" },
              { value: "Verified", label: "Verified QC" },
            ]}
            placeholder="Select Status"
            searchPlaceholder="Search status..."
          />
        </div>
      </div>

      {/* Batches Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Batch No</TableHead>
                  <TableHead>Batch Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No batches found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium font-mono">{batch.batchNo}</TableCell>
                      <TableCell>{formatDate(batch.batchDate)}</TableCell>
                      <TableCell>{batch.shift}</TableCell>
                      <TableCell>
                        <Badge variant={batch.qcStatus === "Sent for QC" ? "default" : "secondary"}>
                          {batch.qcStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-muted"
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

          {/* Pagination */}
          {filteredBatches.length > 0 && (
            <div className="flex justify-between items-center px-1 mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredBatches.length)} of{" "}
                {filteredBatches.length} entries
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

      {/* View/Verify QC Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingBatch?.qcStatus === "Sent for QC" ? "Verify Quality Check" : "QC Verification Details"}
            </DialogTitle>
            <DialogDescription>
              {viewingBatch?.qcStatus === "Sent for QC"
                ? "Review and verify the produced quantities for this batch"
                : "View verified quality check details"}
            </DialogDescription>
          </DialogHeader>
          {viewingBatch && (
            <div className="space-y-4">
              {/* Header Info - Read Only */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Batch No</Label>
                  <p className="font-medium font-mono">{viewingBatch.batchNo}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Batch Date</Label>
                  <p className="font-medium">{formatDate(viewingBatch.batchDate)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Shift</Label>
                  <p className="font-medium">{viewingBatch.shift}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Operation</Label>
                  <p className="font-medium">{viewingBatch.operation}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Work Center</Label>
                  <p className="font-medium">{viewingBatch.workCenter}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">QC Status</Label>
                  <Badge variant={viewingBatch.qcStatus === "Sent for QC" ? "default" : "secondary"}>
                    {viewingBatch.qcStatus}
                  </Badge>
                </div>
                {viewingBatch.qcStatus === "Verified" && (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground">Verified By</Label>
                      <p className="font-medium">{viewingBatch.qcVerifiedBy}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Verified On</Label>
                      <p className="font-medium">{formatDate(viewingBatch.qcVerifiedOn!)}</p>
                    </div>
                  </>
                )}
              </div>

              {/* QC Parameters Section */}
              {editableQCParameters.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold mb-2 block">QC Parameters</Label>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Parameter</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editableQCParameters.map((param) => (
                          <TableRow key={param.id}>
                            <TableCell className="font-medium">{param.parameterName}</TableCell>
                            <TableCell>{param.description}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Items for Verification</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Item Code</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead className="text-right">Produced Qty</TableHead>
                        <TableHead className="text-right">Verified Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editableItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.itemCode}</TableCell>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{item.uom}</TableCell>
                          <TableCell className="text-right">{item.qtyProduced}</TableCell>
                          <TableCell className="text-right">
                            {viewingBatch.qcStatus === "Sent for QC" ? (
                              <div className="flex flex-col items-end gap-1">
                                <Input
                                  type="number"
                                  value={item.verifiedQty ?? item.qtyProduced}
                                  onChange={(e) => handleVerifiedQtyChange(item.id, e.target.value)}
                                  className={`w-28 h-9 text-right ${validationErrors[item.id] ? 'border-destructive' : ''}`}
                                  min="0"
                                  max={item.qtyProduced}
                                />
                                {validationErrors[item.id] && (
                                  <span className="text-xs text-destructive">
                                    {validationErrors[item.id]}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span>{item.verifiedQty}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Remarks Field */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Remarks</Label>
                {viewingBatch.qcStatus === "Sent for QC" ? (
                  <Textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter any remarks or observations..."
                    className="min-h-[100px]"
                  />
                ) : (
                  <div className="rounded-md border p-3 bg-muted/50 min-h-[100px]">
                    {remarks || <span className="text-muted-foreground italic">No remarks</span>}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            {viewingBatch?.qcStatus === "Sent for QC" ? (
              <div className="flex justify-end gap-3 w-full">
                <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleVerifyQC}
                  disabled={Object.keys(validationErrors).length > 0}
                >
                  Verify QC
                </Button>
              </div>
            ) : (
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
