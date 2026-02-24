// ============================================================================
// QUALITY CHECK MODULE
// ============================================================================
// This module handles the verification of material releases that require QC.
// It provides a workflow for QC inspectors to review produced quantities and
// verify the actual acceptable quantities after quality inspection.
//
// KEY FEATURES:
// - Lists material releases sent for QC verification
// - Allows QC inspectors to verify quantities per item
// - Validates verified quantities (must be ≤ produced quantity)
// - Updates release status from "Sent for QC" to "Verified"
// - Records QC inspector details and verification timestamp
// - Separate tabs for pending and completed verifications
//
// WORKFLOW:
// 1. Material Release module sends releases with requiresQC=true
// 2. QC inspector views release in "Sent for QC" tab
// 3. Inspector reviews items and enters verified quantities
// 4. System validates: verifiedQty must be numeric, ≥0, and ≤ qtyProduced
// 5. On "Verify QC", status changes to "Verified" and moves to "Verified QC" tab
// 6. Verified releases return to Material Release module with status "Pending"
// 7. Material Release module can then release to warehouse
//
// INTEGRATION:
// - Receives releases from Material Release module (status: "Sent for QC")
// - Returns verified releases to Material Release module (status: "Verified")
// - Does NOT handle warehouse release or delivery (separate module)
// ============================================================================

import { useState, useEffect } from "react";
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
 * Material Release QC Item interface
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
 * Material Release for QC interface
 */
interface MaterialReleaseQC {
  id: number;
  releaseNo: string;
  releaseDate: string;
  mrNo: string;
  operation: string;
  workCenter: string;
  warehouse: string;
  releasedBy: string;
  qcStatus: "Sent for QC" | "Verified";
  items: QCItem[];
  qcVerifiedBy?: string;
  qcVerifiedOn?: string;
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
 * Get current date in YYYY-MM-DD format
 */
const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Get current datetime in ISO format
 */
const getCurrentDateTime = (): string => {
  return new Date().toISOString();
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
  const [currentPage, setCurrentPage] = useState(1);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingRelease, setViewingRelease] = useState<MaterialReleaseQC | null>(null);
  const [editableItems, setEditableItems] = useState<QCItem[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const itemsPerPage = 10;

  // Mock logged-in user
  const currentUser = "QC Inspector - Sarah Lee";

  // ============================================================================
  // MOCK DATA - Material Releases sent for QC
  // ============================================================================
  const [releases, setReleases] = useState<MaterialReleaseQC[]>([
    // ========== SENT FOR QC ==========
    {
      id: 1,
      releaseNo: "REL-2026-001",
      releaseDate: "2026-02-10",
      mrNo: "MR-2024-002",
      operation: "Welding",
      workCenter: "WC-002 Welding Station",
      warehouse: "Production Store",
      releasedBy: "John Doe",
      qcStatus: "Sent for QC",
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
      qcStatus: "Sent for QC",
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
      releaseNo: "REL-2026-004",
      releaseDate: "2026-02-13",
      mrNo: "MR-2024-003",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      releasedBy: "John Doe",
      qcStatus: "Verified",
      qcVerifiedBy: "QC Inspector - Sarah Lee",
      qcVerifiedOn: "2026-02-14T10:30:00",
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
      releaseNo: "REL-2026-006",
      releaseDate: "2026-02-15",
      mrNo: "MR-2024-003",
      operation: "Assembly",
      workCenter: "WC-003 Assembly Line",
      warehouse: "Production Store",
      releasedBy: "Admin User",
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
  }, [searchTerm, statusFilter]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleViewRelease = (release: MaterialReleaseQC) => {
    setViewingRelease(release);
    // Initialize editable items with current values
    setEditableItems(release.items.map(item => ({
      ...item,
      verifiedQty: item.verifiedQty ?? item.qtyProduced
    })));
    setValidationErrors({});
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
    if (!viewingRelease) return;

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

    // Update the release
    const updatedRelease: MaterialReleaseQC = {
      ...viewingRelease,
      qcStatus: "Verified",
      qcVerifiedBy: currentUser,
      qcVerifiedOn: getCurrentDateTime(),
      items: editableItems,
    };

    // Update releases array
    setReleases(releases.map(r => 
      r.id === viewingRelease.id ? updatedRelease : r
    ));

    // Close modal
    setIsViewModalOpen(false);

    // Success toast
    toast({
      title: "Success",
      description: `${viewingRelease.releaseNo} verified successfully.`,
    });

    // TODO: In real implementation, this would also update the MaterialRelease status to "Pending"
    console.log("QC Verified - Material Release should be updated to Pending status");
  };

  // ============================================================================
  // FILTERING & PAGINATION
  // ============================================================================

  const filteredReleases = releases.filter(release => {
    const matchesSearch = 
      release.releaseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.mrNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.operation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.workCenter.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = release.qcStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredReleases.length / itemsPerPage);
  const paginatedData = filteredReleases.slice(
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
          Verify material releases sent for quality inspection
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
              placeholder="Search by Release No / MR No / Operation..."
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

      {/* Material Releases Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            {statusFilter === "Sent for QC" ? "Releases Pending QC Verification" : "Verified Releases"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Release Date</TableHead>
                  <TableHead>Release No</TableHead>
                  <TableHead>MR No</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Work Center</TableHead>
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
                      <TableCell>{release.mrNo}</TableCell>
                      <TableCell>{release.operation}</TableCell>
                      <TableCell>{release.workCenter}</TableCell>
                      <TableCell>
                        <Badge variant={release.qcStatus === "Sent for QC" ? "default" : "secondary"}>
                          {release.qcStatus}
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

      {/* View/Verify QC Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingRelease?.qcStatus === "Sent for QC" ? "Verify Quality Check" : "QC Verification Details"}
            </DialogTitle>
            <DialogDescription>
              {viewingRelease?.qcStatus === "Sent for QC"
                ? "Review and verify the produced quantities for this material release"
                : "View verified quality check details"}
            </DialogDescription>
          </DialogHeader>
          {viewingRelease && (
            <div className="space-y-4">
              {/* Header Info - Read Only */}
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
                <div>
                  <Label className="text-xs text-muted-foreground">QC Status</Label>
                  <Badge variant={viewingRelease.qcStatus === "Sent for QC" ? "default" : "secondary"}>
                    {viewingRelease.qcStatus}
                  </Badge>
                </div>
                {viewingRelease.qcStatus === "Verified" && (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground">Verified By</Label>
                      <p className="font-medium">{viewingRelease.qcVerifiedBy}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Verified On</Label>
                      <p className="font-medium">{formatDate(viewingRelease.qcVerifiedOn!)}</p>
                    </div>
                  </>
                )}
              </div>

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
                      {editableItems.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.itemCode}</TableCell>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{item.uom}</TableCell>
                          <TableCell className="text-right">{item.qtyProduced}</TableCell>
                          <TableCell className="text-right">
                            {viewingRelease.qcStatus === "Sent for QC" ? (
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
            </div>
          )}
          <DialogFooter>
            {viewingRelease?.qcStatus === "Sent for QC" ? (
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
