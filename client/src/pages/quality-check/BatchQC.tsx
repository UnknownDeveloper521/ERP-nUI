// ============================================================================
// BATCH QC MODULE - BATCH-CENTRIC QUALITY CHECK
// ============================================================================
// Moved from Production > QC to Quality Check > Batch QC
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
import * as React from "react";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { TableActionButtons } from "@/components/shared/TableActionButtons";
import { AppListToolbar } from "@/components/shared/AppListToolbar";
import { useToast } from "@/hooks/use-toast";
import { 
    type BatchRecord, 
    type BatchItem as QCItem, 
    type QCParameter,
    mockBatchRecords,
    updateBatchRecord 
} from "@/lib/batchSharedData";


// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Batch QC interface - Batch-centric QC verification
 */
type BatchQC = BatchRecord;

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
  "Lead Generation & Purification": [
    {
      id: 1,
      parameterName: "Purity Percentage",
      description: "Verify lead purity is above 99.9%"
    },
    {
      id: 2,
      parameterName: "Slag Content",
      description: "Check for residual slag in purified blocks"
    }
  ],
  "Grid Creation & Oxidization": [
    {
      id: 1,
      parameterName: "Grid Weight",
      description: "Verify grid weight is within +/- 2g of target"
    },
    {
      id: 2,
      parameterName: "Oxide Layer Consistency",
      description: "Check for uniform oxide layer application"
    }
  ],
  "Assembly line & Packaging": [
    {
      id: 1,
      parameterName: "Voltage Test",
      description: "Perform open circuit voltage test (minimum 12.6V)"
    },
    {
      id: 2,
      parameterName: "Leakage Test",
      description: "Check for any electrolyte leakage from casing"
    },
    {
      id: 3,
      parameterName: "Final Weight",
      description: "Verify total battery weight matches specifications"
    }
  ]
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BatchQC() {
  const { toast } = useToast();

  // ============================================================================
  // STATE
  // ============================================================================
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Sent for QC" | "Verified">("Sent for QC");
  const [operationFilter, setOperationFilter] = useState("All");
  const [workCenterFilter, setWorkCenterFilter] = useState("All");
  // Pagination state - controls page number and rows per page
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingBatch, setViewingBatch] = useState<BatchQC | null>(null);
  const [editableItems, setEditableItems] = useState<QCItem[]>([]);
  const [editableQCParameters, setEditableQCParameters] = useState<QCParameter[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState<string>("");

  // Mock logged-in user
  const currentUser = "QC Inspector - Sarah Lee";

  // Batches sent for QC
  const [batches, setBatches] = useState<BatchQC[]>(mockBatchRecords);

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

  const handleViewBatch = (batch: BatchQC, mode: "view" | "edit" = "view") => {
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

    setEditableItems((batch.outputItems || []).map((item: any) => ({
      ...item,
      verifiedQty: mode === "edit" 
        ? (item.verifiedQty ?? (item.qtyProduced || 0))
        : item.verifiedQty
    })));

    // Load QC parameters based on operation
    const qcParams = batch.qcParameters && batch.qcParameters.length > 0
      ? batch.qcParameters
      : operationParams;

    setEditableQCParameters(qcParams);
    setValidationErrors({});
    setRemarks(batch.remarks || "");
    setViewingBatch(batch);
    setIsReadOnly(mode === "view");
    setIsViewModalOpen(true);
  };

  const handleVerifiedQtyChange = (itemId: any, value: string) => {
    // Update the editable items with the string value
    setEditableItems(items =>
      items.map(item => {
        if (item.id === itemId) {
          return { ...item, verifiedQty: value };
        }
        return item;
      })
    );

    // Validate
    const item = editableItems.find(i => i.id === itemId);
    if (!item) return;

    const errors = { ...validationErrors };
    const numValue = parseFloat(value);
    const qtyProduced = parseFloat((item.qtyProduced || 0).toString());

    if (value === "") {
      errors[itemId] = "Required";
    } else if (isNaN(numValue)) {
      errors[itemId] = "Must be a valid number";
    } else if (numValue < 0) {
      errors[itemId] = "Must be >= 0";
    } else if (numValue > qtyProduced) {
      errors[itemId] = `Must be <= ${qtyProduced}`;
    } else {
      delete errors[itemId];
    }

    setValidationErrors(errors);
  };

  const handleVerifyQC = () => {
    if (!viewingBatch) return;

    // Final validation
    const hasErrors = editableItems.some(item => {
      const verifiedQty = parseFloat((item.verifiedQty ?? 0).toString());
      const qtyProduced = parseFloat((item.qtyProduced || 0).toString());
      return isNaN(verifiedQty) || verifiedQty < 0 || verifiedQty > qtyProduced;
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
      outputItems: editableItems,
      qcParameters: editableQCParameters,
      remarks: remarks,
      status: "Verified QC"
    };

    updateBatchRecord(viewingBatch.id, updatedBatch);
    setBatches([...mockBatchRecords]);

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

    const matchesStatus = 
      (statusFilter === "Sent for QC" && (batch.qcStatus === "Sent for QC" || batch.status === "Sent for QC")) ||
      (statusFilter === "Verified" && (batch.qcStatus === "Verified" || batch.status === "Verified QC"));
    
    const matchesOperation = operationFilter === "All" || batch.operation === operationFilter;
    const matchesWorkCenter = workCenterFilter === "All" || batch.workCenter === workCenterFilter;
    const isQCRequired = batch.qcRequired !== false;

    return matchesSearch && matchesStatus && matchesOperation && matchesWorkCenter && isQCRequired;
  });

  // Pagination calculations - slice data for current page
  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  const paginatedData = filteredBatches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Auto-adjust page when data changes (e.g., after filtering or deleting)
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredBatches.length, currentPage, totalPages]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, operationFilter, workCenterFilter]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Batch QC</h1>
        <p className="text-muted-foreground">
          Verify batches sent for quality inspection
        </p>
      </div>

      <AppListToolbar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search by Batch No / Operation / Work Center..."
        }}
        filters={[
          {
            type: 'select',
            label: 'Operation',
            value: operationFilter,
            options: [
              { label: "All Operations", value: "All" },
              ...uniqueOperations.map(op => ({ label: op, value: op }))
            ],
            onChange: setOperationFilter,
            searchable: true
          },
          {
            type: 'select',
            label: 'Work Center',
            value: workCenterFilter,
            options: [
              { label: "All Work Centers", value: "All" },
              ...uniqueWorkCenters.map(wc => ({ label: wc, value: wc }))
            ],
            onChange: setWorkCenterFilter,
            searchable: true
          },
          {
            type: 'select',
            label: 'Status',
            value: statusFilter,
            options: [
              { label: "Sent for QC", value: "Sent for QC" },
              { label: "Verified QC", value: "Verified" }
            ],
            onChange: (value) => setStatusFilter(value as "Sent for QC" | "Verified"),
            searchable: true
          }
        ]}
      />

      {/* Batches Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Batch No</TableHead>
                  <TableHead>Batch Date</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Work Center</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No batches found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium font-mono">{batch.batchNo}</TableCell>
                      <TableCell>{formatDate(batch.date)}</TableCell>
                      <TableCell>{batch.operation}</TableCell>
                      <TableCell>{batch.workCenter}</TableCell>
                      <TableCell>{batch.shift}</TableCell>
                      <TableCell>
                        <Badge variant={(batch.qcStatus === "Sent for QC" || batch.status === "Sent for QC") ? "default" : "secondary"}>
                          {batch.qcStatus || (batch.status === "Sent for QC" ? "Sent for QC" : batch.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <TableActionButtons
                          onView={() => handleViewBatch(batch, "view")}
                          onEdit={(batch.qcStatus === "Sent for QC" || batch.status === "Sent for QC") ? () => handleViewBatch(batch, "edit") : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* DataTablePagination - standardized pagination component */}
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredBatches.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            options={[10, 15, 30, 50]}
          />
        </CardContent>
      </Card>

      {/* View/Verify QC Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsViewModalOpen(false);
          setViewingBatch(null);
          setEditableItems([]);
          setEditableQCParameters([]);
          setValidationErrors({});
          setRemarks("");
          setIsReadOnly(false);
        } else {
          setIsViewModalOpen(true);
        }
      }}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isReadOnly ? "QC Verification Details" : "Verify Quality Check"}
            </DialogTitle>
            <DialogDescription>
              {isReadOnly
                ? "View verified quality check details"
                : "Review and verify the produced quantities for this batch"}
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
                  <p className="font-medium">{formatDate(viewingBatch.date)}</p>
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
                  <Badge variant={(viewingBatch.qcStatus === "Sent for QC" || viewingBatch.status === "Sent for QC") ? "default" : "secondary"}>
                    {viewingBatch.qcStatus || (viewingBatch.status === "Sent for QC" ? "Sent for QC" : viewingBatch.status)}
                  </Badge>
                </div>
                {(viewingBatch.qcStatus === "Verified" || (isReadOnly && viewingBatch.qcVerifiedBy)) && (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground">Verified By</Label>
                      <p className="font-medium">{viewingBatch.qcVerifiedBy}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Verified On</Label>
                      <p className="font-medium">{formatDate(viewingBatch.qcVerifiedOn || new Date().toISOString())}</p>
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
                          <TableCell className="text-right">{item.qtyProduced || 0}</TableCell>
                          <TableCell className="text-right font-mono">
                            {!isReadOnly ? (
                              <div className="flex flex-col items-end gap-1">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.verifiedQty ?? (item.qtyProduced || 0)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "" || (/^\d*\.?\d*$/.test(val) && val.replace(".", "").length <= 6)) {
                                      handleVerifiedQtyChange(item.id as any, val);
                                    }
                                  }}
                                  className={`w-28 h-9 text-right font-bold ${validationErrors[item.id as any] ? 'border-destructive focus-visible:ring-destructive/20' : 'focus-visible:ring-primary/20'}`}
                                />
                                {validationErrors[item.id as any] && (
                                  <span className="text-[10px] text-destructive font-bold">
                                    {validationErrors[item.id as any]}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="font-bold">
                                {item.verifiedQty !== undefined && item.verifiedQty !== null 
                                  ? item.verifiedQty 
                                  : <span className="text-muted-foreground font-normal italic">Pending</span>}
                              </span>
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
                <Label className="text-sm font-semibold mb-2 block text-primary">Remarks</Label>
                {!isReadOnly ? (
                  <Textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter any remarks or observations..."
                    className="min-h-[100px] resize-none focus-visible:ring-primary/20"
                  />
                ) : (
                  <div className="rounded-md border p-3 bg-muted/30 min-h-[100px] text-sm leading-relaxed">
                    {remarks || <span className="text-muted-foreground italic">No remarks recorded</span>}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="border-t pt-4">
            {!isReadOnly ? (
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
